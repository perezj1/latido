-- Administration. Apply after v7; v10 adds league/event operations.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
ALTER TABLE suizamente_private.suizamente_configuracion ADD COLUMN IF NOT EXISTS economia_override jsonb NOT NULL DEFAULT '{}';
ALTER TABLE suizamente_private.suizamente_configuracion ADD COLUMN IF NOT EXISTS economia_version integer NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_admin_registro(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,admin_id uuid NOT NULL,accion text NOT NULL,objeto text NOT NULL,
  detalle jsonb NOT NULL DEFAULT '{}',creado_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_economia_historial(
  version integer PRIMARY KEY,admin_id uuid,juego jsonb NOT NULL,creado_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION suizamente_private.v9_estadisticas(pid text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE q jsonb; n integer; minimum integer:=(suizamente_private.v2_config()->>'minimoVotosParaPorcentajes')::integer; groups jsonb;
BEGIN
  SELECT payload INTO q FROM suizamente_private.suizamente_preguntas WHERE id=pid;
  SELECT count(*) INTO n FROM suizamente_private.suizamente_votos WHERE pregunta_id=pid;
  WITH metadata AS(
    SELECT 'pais' kind,pais grupo,opcion FROM suizamente_private.suizamente_votos WHERE pregunta_id=pid AND pais IS NOT NULL
    UNION ALL SELECT 'anos',anos_suiza,opcion FROM suizamente_private.suizamente_votos WHERE pregunta_id=pid AND anos_suiza IS NOT NULL
  ), counts AS(SELECT kind,grupo,count(*) total FROM metadata GROUP BY kind,grupo HAVING count(*)>=minimum)
  SELECT coalesce(jsonb_agg(jsonb_build_object('tipo',c.kind,'grupo',c.grupo,'votos',c.total,
    'porcentajes',(SELECT jsonb_agg(round(100.0*(SELECT count(*) FROM metadata m WHERE m.kind=c.kind AND m.grupo=c.grupo AND m.opcion=i)/c.total) ORDER BY i) FROM generate_series(0,jsonb_array_length(q->'opciones')-1) i),
    'aciertoPct',CASE WHEN q->>'tipo'='real' THEN (SELECT round(100.0*count(*) FILTER(WHERE m.opcion=(q->>'correcta')::integer)/count(*)) FROM metadata m WHERE m.kind=c.kind AND m.grupo=c.grupo) ELSE NULL END) ORDER BY c.kind,c.total DESC,c.grupo),'[]') INTO groups FROM counts c;
  RETURN jsonb_build_object('votos',n,'reparto',CASE WHEN n>=minimum THEN (SELECT jsonb_agg((SELECT count(*) FROM suizamente_private.suizamente_votos WHERE pregunta_id=pid AND opcion=i) ORDER BY i) FROM generate_series(0,jsonb_array_length(q->'opciones')-1) i) ELSE NULL END,
    'aciertoPct',CASE WHEN n>=minimum AND q->>'tipo'='real' THEN (SELECT round(100.0*count(*) FILTER(WHERE opcion=(q->>'correcta')::integer)/count(*)) FROM suizamente_private.suizamente_votos WHERE pregunta_id=pid) ELSE NULL END,'desglose',groups,
    'autor',(SELECT j.apodo FROM suizamente_private.suizamente_propuestas p JOIN suizamente_private.suizamente_jugadores j ON j.jugador_id=p.jugador_id WHERE p.pregunta_id=pid));
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v9_merge(base jsonb,patch jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb:=base; r record;
BEGIN
  IF jsonb_typeof(base)<>'object' OR jsonb_typeof(patch)<>'object' THEN RETURN patch; END IF;
  FOR r IN SELECT key,value FROM jsonb_each(patch) LOOP
    result:=jsonb_set(result,ARRAY[r.key],CASE WHEN result ? r.key THEN suizamente_private.v9_merge(result->r.key,r.value) ELSE r.value END);
  END LOOP;
  RETURN result;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v9_diff(base jsonb,edited jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb:='{}';r record;
BEGIN
  IF jsonb_typeof(base)<>'object' OR jsonb_typeof(edited)<>'object' THEN RETURN edited; END IF;
  FOR r IN SELECT key,value FROM jsonb_each(edited) LOOP
    IF base->r.key IS DISTINCT FROM r.value THEN result:=result||jsonb_build_object(r.key,suizamente_private.v9_diff(base->r.key,r.value)); END IF;
  END LOOP;
  RETURN result;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v2_config() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT suizamente_private.v9_merge('{"comunidad":{"propuestasPorDia":3,"denunciasPorDia":5,"libretaMax":500,"presenciaSegundos":300,"preguntaMax":140,"opcionMax":90,"datoMax":300,"diasSinRepetir":365}}'::jsonb||juego,economia_override)
    FROM suizamente_private.suizamente_configuracion WHERE id=true
$$;
INSERT INTO suizamente_private.suizamente_economia_historial(version,juego) SELECT 0,suizamente_private.v2_config() ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION suizamente_private.v9_shape(base jsonb,edited jsonb,path text DEFAULT '') RETURNS void
LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r record;i integer;
BEGIN
  IF jsonb_typeof(base) IS DISTINCT FROM jsonb_typeof(edited) THEN RAISE EXCEPTION 'SZV2:400:Tipo de valor no válido: %',path; END IF;
  IF jsonb_typeof(base)='object' THEN
    IF (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(base) key) IS DISTINCT FROM (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(edited) key) THEN RAISE EXCEPTION 'SZV2:400:Conserva los campos de configuración: %',path; END IF;
    FOR r IN SELECT key,value FROM jsonb_each(base) LOOP PERFORM suizamente_private.v9_shape(r.value,edited->r.key,path||'.'||r.key); END LOOP;
  ELSIF jsonb_typeof(base)='array' THEN
    IF jsonb_array_length(base)<>jsonb_array_length(edited) THEN RAISE EXCEPTION 'SZV2:400:La estructura requiere una migración: %',path; END IF;
    FOR i IN 0..jsonb_array_length(base)-1 LOOP PERFORM suizamente_private.v9_shape(base->i,edited->i,path||'['||i||']'); END LOOP;
  ELSIF jsonb_typeof(base)='number' THEN
    IF (edited#>>'{}')::numeric<0 OR (edited#>>'{}')::numeric>2147483647 OR (path !~ '(probabilidad|multiplicador|pesoRareza|porNivel)' AND (base#>>'{}')::numeric=trunc((base#>>'{}')::numeric) AND (edited#>>'{}')::numeric<>trunc((edited#>>'{}')::numeric)) THEN RAISE EXCEPTION 'SZV2:400:Importe o cantidad no válido: %',path; END IF;
  ELSIF jsonb_typeof(base)='string' AND base<>edited THEN RAISE EXCEPTION 'SZV2:400:Los textos e identificadores se mantienen: %',path;
  END IF;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v9_norm(value text) RETURNS text
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT btrim(regexp_replace(translate(lower(coalesce(value,'')),'áéíóúàèìòùäëïöüâêîôûñç','aeiouaeiouaeiouaeiounc'),'[^a-z0-9]+',' ','g'))
$$;
CREATE OR REPLACE FUNCTION suizamente_private.v9_similar(a text,b text) RETURNS real
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE ns text;score real;
BEGIN
  SELECT n.nspname INTO ns FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pg_trgm';
  EXECUTE format('SELECT %I.similarity($1,$2)',ns) INTO score USING suizamente_private.v9_norm(a),suizamente_private.v9_norm(b);
  RETURN score;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v9_propuesta(pid uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p suizamente_private.suizamente_propuestas;q jsonb;line text;part text;similar_question jsonb;valid boolean:=true;reason text;
BEGIN
  SELECT * INTO p FROM suizamente_private.suizamente_propuestas WHERE id=pid;
  IF NOT FOUND THEN RAISE EXCEPTION 'SZV2:404:Propuesta no encontrada'; END IF;
  q:=p.contenido;
  BEGIN PERFORM suizamente_private.v7_validar_propuesta(q);EXCEPTION WHEN OTHERS THEN valid:=false;reason:=SQLERRM; END;
  line:=CASE q->>'tipo' WHEN 'dilema' THEN 'D' WHEN 'mito' THEN 'V' ELSE 'R' END||'|'||(q->>'tema')||'|'||(q->>'emoji')||'|'||regexp_replace(q->>'pregunta','[|\r\n]+',' ','g');
  IF q->>'tipo'='mito' THEN line:=line||'|'||CASE WHEN (q->>'verdad')::boolean THEN 'V' ELSE 'M' END;
  ELSE
    FOR part IN SELECT CASE WHEN q->>'tipo'='real' AND ord-1=(q->>'correcta')::integer THEN '*' ELSE '' END||regexp_replace(btrim(coalesce(value->>'e','')||' '||(value->>'t')),'[|\r\n]+',' ','g') FROM jsonb_array_elements(q->'opciones') WITH ORDINALITY k(value,ord) LOOP line:=line||'|'||part; END LOOP;
  END IF;
  line:=line||'|'||regexp_replace(q->>'dato','[|\r\n]+',' ','g');
  SELECT jsonb_build_object('id',id,'pregunta',payload->>'pregunta','similitud',score) INTO similar_question FROM(
    SELECT id,payload,suizamente_private.v9_similar(q->>'pregunta',payload->>'pregunta') score FROM suizamente_private.suizamente_preguntas) s WHERE score>=.5 ORDER BY score DESC,id LIMIT 1;
  RETURN jsonb_build_object('id',p.id,'contenido',q,'estado',p.estado,'nota',p.nota,'preguntaId',p.pregunta_id,'creadoEn',p.creado_en,
    'autor',(SELECT jsonb_build_object('id',jugador_id,'apodo',apodo,'pais',pais,'canton',canton,'aprobadas',(SELECT count(*) FROM suizamente_private.suizamente_propuestas WHERE jugador_id=p.jugador_id AND estado='aprobada')) FROM suizamente_private.suizamente_jugadores WHERE jugador_id=p.jugador_id),
    'comprobaciones',jsonb_build_object('valida',valid,'motivo',reason,'sinFuente',coalesce(q->>'fuente','')='','parecida',similar_question),
    'valoraciones',jsonb_build_object('bien',(SELECT count(*) FROM suizamente_private.suizamente_valoraciones WHERE propuesta_id=p.id AND valor=1),'error',(SELECT count(*) FROM suizamente_private.suizamente_valoraciones WHERE propuesta_id=p.id AND valor=-1)),
    'linea',line);
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v9_metricas(start_at timestamptz,end_at timestamptz) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  WITH answers AS(
    SELECT jugador_id FROM suizamente_private.suizamente_partida_preguntas WHERE respondida_en>=start_at AND respondida_en<end_at AND NOT omitida AND (opcion IS NOT NULL OR cardinality(intentos)>0)
    UNION ALL SELECT jugador_id FROM suizamente_private.suizamente_asaltos WHERE respondida_en>=start_at AND respondida_en<end_at AND (opcion IS NOT NULL OR cardinality(intentos)>0)
    UNION ALL SELECT jugador_id FROM suizamente_private.suizamente_dia_votos WHERE creado_en>=start_at AND creado_en<end_at
  ) SELECT jsonb_build_object('activos',(SELECT count(DISTINCT jugador_id) FROM answers),'respuestas',(SELECT count(*) FROM answers),
    'dia',(SELECT count(DISTINCT jugador_id) FROM suizamente_private.suizamente_dia_votos WHERE creado_en>=start_at AND creado_en<end_at),
    'perfiles',(SELECT count(*) FROM suizamente_private.suizamente_jugadores WHERE creado_en>=start_at AND creado_en<end_at))
$$;
CREATE OR REPLACE FUNCTION suizamente_private.v9_accion(actor uuid,body jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE route text:=coalesce(body->>'ruta','resumen');method text:=coalesce(body->>'metodo','GET');section text;object_id text;operation text;result jsonb;before_data jsonb;detail jsonb:='{}';
  proposal suizamente_private.suizamente_propuestas;pid text;target text;newcfg jsonb;defaults jsonb;version_now integer;day date:=suizamente_private.v7_hoy();w date;
  start_at timestamptz;end_at timestamptz:=clock_timestamp();prev_start timestamptz;prev_end timestamptz;days integer;key text;local_now timestamp:=clock_timestamp() AT TIME ZONE (suizamente_private.v2_config()->>'zonaHoraria');
BEGIN
  IF NOT suizamente_private.v7_admin() THEN RAISE EXCEPTION 'SZV2:403:Solo administración de Latido'; END IF;
  section:=split_part(route,'/',1);object_id:=split_part(route,'/',2);operation:=split_part(route,'/',3);
  IF method='GET' AND section='resumen' THEN
    days:=CASE body->>'periodo' WHEN '7d' THEN 7 WHEN '30d' THEN 30 ELSE 1 END;
    start_at:=(day-(days-1))::timestamp AT TIME ZONE (suizamente_private.v2_config()->>'zonaHoraria');
    prev_start:=(day-(days-1)-CASE WHEN days=1 THEN 7 ELSE days END)::timestamp AT TIME ZONE (suizamente_private.v2_config()->>'zonaHoraria');
    prev_end:=(local_now-make_interval(days=>CASE WHEN days=1 THEN 7 ELSE days END)) AT TIME ZONE (suizamente_private.v2_config()->>'zonaHoraria');
    result:=jsonb_build_object('actual',suizamente_private.v9_metricas(start_at,end_at),'anterior',suizamente_private.v9_metricas(prev_start,prev_end),
      'pendientes',jsonb_build_object('propuestas',(SELECT count(*) FROM suizamente_private.suizamente_propuestas WHERE estado='pendiente'),
        'avisos',(SELECT count(DISTINCT pregunta_id) FROM suizamente_private.suizamente_reportes WHERE estado='pendiente'),'denuncias',(SELECT count(*) FROM suizamente_private.suizamente_denuncias WHERE estado='pendiente'),
        'desde',(SELECT min(creado_en) FROM suizamente_private.suizamente_propuestas WHERE estado='pendiente')),
      'falladas',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'pregunta',payload->>'pregunta','tema',payload->>'tema','votos',n,'pct',pct) ORDER BY pct,id),'[]') FROM(
        SELECT p.id,p.payload,count(*) n,round(100.0*count(*) FILTER(WHERE v.opcion=(p.payload->>'correcta')::integer)/count(*)) pct FROM suizamente_private.suizamente_preguntas p JOIN suizamente_private.suizamente_votos v ON v.pregunta_id=p.id
          WHERE p.payload->>'tipo'='real' AND v.creado_en>=start_at AND v.creado_en<end_at GROUP BY p.id HAVING count(*)>=30 ORDER BY pct,p.id LIMIT 10) s),
      'dia',jsonb_build_object('id',suizamente_private.v7_dia(day),'votos',(SELECT count(*) FROM suizamente_private.suizamente_dia_votos WHERE fecha=day)),
      'ranking',suizamente_private.v7_ranking(actor::text)->'filas');
  ELSIF section='propuestas' THEN
    IF object_id='' AND method='GET' THEN
      result:=jsonb_build_object('filas',coalesce((SELECT jsonb_agg(row ORDER BY sort_at) FROM(
        SELECT jsonb_build_object('id',p.id,'pregunta',contenido->>'pregunta','contenido',contenido,'autor',j.apodo,'estado',estado,'creadoEn',p.creado_en,
          'bien',(SELECT count(*) FROM suizamente_private.suizamente_valoraciones WHERE propuesta_id=p.id AND valor=1),
          'error',(SELECT count(*) FROM suizamente_private.suizamente_valoraciones WHERE propuesta_id=p.id AND valor=-1)) row,
          CASE WHEN body->>'orden'='antiguas' THEN extract(epoch FROM p.creado_en) ELSE -extract(epoch FROM p.creado_en) END sort_at
        FROM suizamente_private.suizamente_propuestas p LEFT JOIN suizamente_private.suizamente_jugadores j ON j.jugador_id=p.jugador_id
        WHERE (coalesce(body->>'estado','')='' OR estado=body->>'estado') AND (coalesce(body->>'tipo','')='' OR contenido->>'tipo'=body->>'tipo')
          AND (coalesce(body->>'tema','')='' OR contenido->>'tema'=body->>'tema') AND (contenido->>'pregunta'||' '||coalesce(j.apodo,'')) ILIKE '%'||left(coalesce(body->>'q',''),100)||'%' ORDER BY sort_at,p.id LIMIT 100) s),'[]'),
        'contadores',coalesce((SELECT jsonb_object_agg(estado,n) FROM(SELECT estado,count(*) n FROM suizamente_private.suizamente_propuestas GROUP BY estado) s),'{}'));
    ELSE
      SELECT * INTO proposal FROM suizamente_private.suizamente_propuestas WHERE id=object_id::uuid FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'SZV2:404:Propuesta no encontrada'; END IF;
      before_data:=jsonb_build_object('estado',proposal.estado,'contenido',proposal.contenido,'nota',proposal.nota,'preguntaId',proposal.pregunta_id);
      IF method='PUT' THEN
        IF proposal.pregunta_id IS NOT NULL THEN RAISE EXCEPTION 'SZV2:409:Corrige la pregunta publicada desde sus fuentes'; END IF;
        PERFORM suizamente_private.v7_validar_propuesta(body->'contenido');
        UPDATE suizamente_private.suizamente_propuestas SET contenido=body->'contenido',nota=left(coalesce(body->>'nota',''),1000),actualizado_en=clock_timestamp() WHERE id=proposal.id;
      ELSIF method='POST' AND operation IN('aprobar','rechazar') THEN
        IF proposal.pregunta_id IS NOT NULL OR proposal.estado=(CASE WHEN operation='aprobar' THEN 'aprobada' ELSE 'rechazada' END) THEN RAISE EXCEPTION 'SZV2:409:Esta propuesta ya está resuelta'; END IF;
        IF operation='aprobar' THEN PERFORM suizamente_private.v7_validar_propuesta(proposal.contenido); END IF;
        UPDATE suizamente_private.suizamente_propuestas SET estado=CASE WHEN operation='aprobar' THEN 'aprobada' ELSE 'rechazada' END,
          nota=left(coalesce(body->>'nota',proposal.nota,''),1000),actualizado_en=clock_timestamp() WHERE id=proposal.id;
        IF proposal.jugador_id IS NOT NULL THEN PERFORM suizamente_private.v7_notificar(proposal.jugador_id,'propuesta',proposal.id::text||':'||operation,
          CASE WHEN operation='aprobar' THEN '✅ Tu propuesta está aprobada' ELSE '📝 Hemos revisado tu propuesta' END,'/suizamente/proponer'); END IF;
      ELSIF method='POST' AND operation='vincular' THEN
        pid:=body->>'preguntaId';
        IF proposal.estado<>'aprobada' OR proposal.pregunta_id IS NOT NULL OR NOT EXISTS(SELECT 1 FROM suizamente_private.suizamente_preguntas WHERE id=pid)
          OR EXISTS(SELECT 1 FROM suizamente_private.suizamente_propuestas WHERE pregunta_id=pid) THEN RAISE EXCEPTION 'SZV2:409:Revisa el id publicado y el estado de la propuesta'; END IF;
        UPDATE suizamente_private.suizamente_propuestas SET pregunta_id=pid,actualizado_en=clock_timestamp() WHERE id=proposal.id;
        IF proposal.jugador_id IS NOT NULL THEN
          PERFORM suizamente_private.v3_anotar(proposal.jugador_id,'propuesta_publicada',proposal.id::text,(suizamente_private.v2_config()#>>'{recompensas,propuestaAprobada,monedas}')::integer,(suizamente_private.v2_config()#>>'{recompensas,propuestaAprobada,xp}')::integer);
          PERFORM suizamente_private.v3_logros(proposal.jugador_id);
          PERFORM suizamente_private.v7_notificar(proposal.jugador_id,'publicada',proposal.id::text,'✍️ ¡Tu pregunta ya está publicada!','/suizamente/proponer');
        END IF;
      ELSIF method<>'GET' THEN RAISE EXCEPTION 'SZV2:404:Acción no disponible'; END IF;
      result:=suizamente_private.v9_propuesta(proposal.id);
      detail:=jsonb_build_object('antes',before_data,'despues',result-'autor'-'valoraciones'-'comprobaciones');
    END IF;
  ELSIF section='economia' THEN
    SELECT economia_version INTO version_now FROM suizamente_private.suizamente_configuracion WHERE id=true FOR UPDATE;
    IF method='PUT' THEN
      IF (body->>'version')::integer IS DISTINCT FROM version_now THEN RAISE EXCEPTION 'SZV2:409:La configuración ha cambiado. Recarga antes de guardar'; END IF;
      newcfg:=body->'juego';
      SELECT '{"comunidad":{"propuestasPorDia":3,"denunciasPorDia":5,"libretaMax":500,"presenciaSegundos":300,"preguntaMax":140,"opcionMax":90,"datoMax":300,"diasSinRepetir":365}}'::jsonb||juego INTO defaults FROM suizamente_private.suizamente_configuracion WHERE id=true;
      PERFORM suizamente_private.v9_shape(defaults,newcfg);
      IF newcfg->'niveles'<>defaults->'niveles' OR newcfg#>'{mapa,nivelesPorCanton}'<>defaults#>'{mapa,nivelesPorCanton}'
        OR (newcfg#>>'{partida,segundosPorPregunta}')::integer<=0 OR (newcfg#>>'{partida,horasPorTurno}')::integer<=0
        OR (newcfg#>>'{partida,barraParaSello}')::integer NOT BETWEEN 1 AND 3 OR (newcfg#>>'{partida,sellosParaGanar}')::integer NOT BETWEEN 1 AND 6
        OR (newcfg#>>'{asaltos,probabilidadPorAcierto}')::numeric>1 OR (newcfg#>>'{partida,rondasMax}')::integer<=0
        OR (newcfg#>>'{escudos,max}')::integer<=0 OR (newcfg#>>'{album,cartasPorSobre}')::integer<=0
        OR (SELECT sum(value::numeric) FROM jsonb_each_text(newcfg#>'{album,pesoRareza}'))<>1
        OR (newcfg#>>'{comunidad,propuestasPorDia}')::integer<=0 OR (newcfg#>>'{comunidad,presenciaSegundos}')::integer<=0 OR (newcfg->>'minimoVotosParaPorcentajes')::integer<20
        THEN RAISE EXCEPTION 'SZV2:400:Revisa tiempos, probabilidades y límites; niveles y estructura requieren migración'; END IF;
      before_data:=suizamente_private.v2_config();version_now:=version_now+1;
      UPDATE suizamente_private.suizamente_configuracion SET economia_override=suizamente_private.v9_diff(defaults,newcfg),economia_version=version_now WHERE id=true;
      INSERT INTO suizamente_private.suizamente_economia_historial(version,admin_id,juego) VALUES(version_now,actor,newcfg);
      detail:=jsonb_build_object('version',version_now,'antes',before_data,'despues',newcfg);
    ELSIF method<>'GET' THEN RAISE EXCEPTION 'SZV2:404:Acción no disponible'; END IF;
    result:=jsonb_build_object('version',version_now,'juego',suizamente_private.v2_config(),'historial',(SELECT jsonb_agg(jsonb_build_object('version',version,'adminId',admin_id,'fecha',creado_en,'juego',juego) ORDER BY version DESC) FROM suizamente_private.suizamente_economia_historial));
  ELSIF section='preguntas' THEN
    IF method='POST' AND operation IN('ocultar','mostrar') THEN
      IF NOT EXISTS(SELECT 1 FROM suizamente_private.suizamente_preguntas WHERE id=object_id) THEN RAISE EXCEPTION 'SZV2:404:Pregunta no encontrada'; END IF;
      UPDATE suizamente_private.suizamente_preguntas SET oculta=operation='ocultar' WHERE id=object_id;
      detail:=jsonb_build_object('motivo',left(coalesce(body->>'motivo',''),300));
    ELSIF method<>'GET' THEN RAISE EXCEPTION 'SZV2:404:Acción no disponible'; END IF;
    IF object_id<>'' THEN
      result:=(SELECT payload||suizamente_private.v9_estadisticas(object_id)||jsonb_build_object('oculta',oculta,
        'avisos',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'motivo',motivo,'estado',estado,'fecha',creado_en) ORDER BY creado_en DESC),'[]') FROM suizamente_private.suizamente_reportes WHERE pregunta_id=object_id))
        FROM suizamente_private.suizamente_preguntas WHERE id=object_id);
    ELSE
      result:=jsonb_build_object('filas',coalesce((SELECT jsonb_agg(payload||jsonb_build_object('oculta',oculta) ORDER BY id) FROM(
        SELECT * FROM suizamente_private.suizamente_preguntas WHERE (payload->>'pregunta') ILIKE '%'||left(coalesce(body->>'q',''),100)||'%'
          AND (coalesce(body->>'tipo','')='' OR payload->>'tipo'=body->>'tipo') AND (coalesce(body->>'tema','')='' OR payload->>'tema'=body->>'tema') ORDER BY id LIMIT 50) s),'[]'));
    END IF;
  ELSIF section='jugadores' THEN
    IF object_id<>'' THEN
      SELECT jugador_id INTO target FROM suizamente_private.suizamente_jugadores WHERE jugador_id=object_id FOR UPDATE;
      IF target IS NULL THEN RAISE EXCEPTION 'SZV2:404:Jugador no encontrado'; END IF;
      IF method='POST' THEN
        IF operation='renombrar' THEN
          IF btrim(coalesce(body->>'apodo','')) !~ '^[[:alnum:] ._-]{2,20}$' OR lower(body->>'apodo')~'(mierda|puta|puto|cabr[oó]n|fuck|shit)' THEN RAISE EXCEPTION 'SZV2:400:Revisa el apodo'; END IF;
          UPDATE suizamente_private.suizamente_jugadores SET apodo=btrim(body->>'apodo'),renombrar=true,actualizado_en=clock_timestamp() WHERE jugador_id=target;
          PERFORM suizamente_private.v7_notificar(target,'apodo',gen_random_uuid()::text,'📝 Elige otro apodo para seguir jugando','/suizamente/perfil/editar');
        ELSIF operation IN('quitar-ranking','restaurar-ranking') THEN
          UPDATE suizamente_private.suizamente_jugadores SET excluido_ranking=operation='quitar-ranking',actualizado_en=clock_timestamp() WHERE jugador_id=target;
        ELSIF operation IN('bloquear','desbloquear') THEN UPDATE suizamente_private.suizamente_jugadores SET bloqueado=operation='bloquear',actualizado_en=clock_timestamp() WHERE jugador_id=target;
        ELSE RAISE EXCEPTION 'SZV2:404:Acción no disponible'; END IF;
        detail:=jsonb_build_object('apodo',body->>'apodo','motivo',left(coalesce(body->>'motivo',''),300));
      ELSIF method<>'GET' THEN RAISE EXCEPTION 'SZV2:404:Acción no disponible'; END IF;
      result:=(SELECT jsonb_build_object('id',jugador_id,'apodo',apodo,'pais',pais,'canton',canton,'anos_suiza',anos_suiza,'nivel',suizamente_private.v2_nivel(xp),'monedas',monedas,
        'racha',suizamente_private.v3_racha(jugador_id),'bloqueado',bloqueado,'enRanking',en_ranking AND NOT excluido_ranking,'excluidoRanking',excluido_ranking,'renombrar',renombrar,'desempeno',suizamente_private.v3_perfil(jugador_id),
        'denuncias',(SELECT count(*) FROM suizamente_private.suizamente_denuncias WHERE denunciado=target),'propuestas',(SELECT count(*) FROM suizamente_private.suizamente_propuestas WHERE jugador_id=target))
        FROM suizamente_private.suizamente_jugadores WHERE jugador_id=target);
    ELSE
      result:=jsonb_build_object('filas',coalesce((SELECT jsonb_agg(jsonb_build_object('id',jugador_id,'apodo',apodo,'nivel',suizamente_private.v2_nivel(xp),'canton',canton,'monedas',monedas,'bloqueado',bloqueado,'enRanking',en_ranking) ORDER BY apodo)
        FROM(SELECT * FROM suizamente_private.suizamente_jugadores WHERE apodo ILIKE '%'||left(coalesce(body->>'q',''),100)||'%' ORDER BY apodo LIMIT 50) s),'[]'));
    END IF;
  ELSIF section IN('avisos','denuncias') THEN
    IF method='POST' AND operation IN('resolver','descartar') THEN
      IF section='avisos' THEN UPDATE suizamente_private.suizamente_reportes SET estado=CASE WHEN operation='resolver' THEN 'resuelto' ELSE 'descartado' END WHERE id=object_id::uuid;
      ELSE UPDATE suizamente_private.suizamente_denuncias SET estado='resuelto' WHERE id=object_id::uuid; END IF;
    ELSIF method<>'GET' THEN RAISE EXCEPTION 'SZV2:404:Acción no disponible'; END IF;
    IF section='avisos' THEN result:=jsonb_build_object('filas',coalesce((SELECT jsonb_agg(jsonb_build_object('id',pregunta_id,'pregunta',p.payload->>'pregunta','pendientes',n,'avisos',rows) ORDER BY n DESC) FROM(
      SELECT pregunta_id,count(*) FILTER(WHERE estado='pendiente') n,jsonb_agg(jsonb_build_object('id',id,'motivo',motivo,'estado',estado,'fecha',creado_en) ORDER BY creado_en DESC) rows FROM suizamente_private.suizamente_reportes GROUP BY pregunta_id) g JOIN suizamente_private.suizamente_preguntas p ON p.id=g.pregunta_id),'[]'));
    ELSE result:=jsonb_build_object('filas',coalesce((SELECT jsonb_agg(jsonb_build_object('id',d.id,'apodo',j.apodo,'jugadorId',d.denunciado,'motivo',motivo,'estado',estado,'fecha',d.creado_en) ORDER BY d.creado_en DESC)
      FROM suizamente_private.suizamente_denuncias d LEFT JOIN suizamente_private.suizamente_jugadores j ON j.jugador_id=d.denunciado),'[]')); END IF;
  ELSIF section='dia' THEN
    IF method='PUT' THEN
      w:=object_id::date;pid:=body->>'preguntaId';
      IF w<=day OR w>day+13 THEN RAISE EXCEPTION 'SZV2:409:Solo se cambian días futuros del calendario'; END IF;
      PERFORM pg_advisory_xact_lock(7217832);
      IF NOT EXISTS(SELECT 1 FROM suizamente_private.suizamente_preguntas WHERE id=pid AND NOT oculta AND payload->>'tipo'='dilema')
        OR EXISTS(SELECT 1 FROM suizamente_private.suizamente_dia WHERE fecha<>w AND pregunta_id=pid AND abs(fecha-w)<=(suizamente_private.v2_config()#>>'{comunidad,diasSinRepetir}')::integer) THEN RAISE EXCEPTION 'SZV2:409:Elige un dilema disponible sin repetir'; END IF;
      INSERT INTO suizamente_private.suizamente_dia(fecha,pregunta_id) VALUES(w,pid) ON CONFLICT(fecha) DO UPDATE SET pregunta_id=excluded.pregunta_id;
      detail:=jsonb_build_object('preguntaId',pid);
    ELSIF method<>'GET' THEN RAISE EXCEPTION 'SZV2:404:Acción no disponible'; END IF;
    w:=coalesce(nullif(body->>'desde','')::date,day);
    result:=jsonb_build_object('dias',(SELECT jsonb_agg(jsonb_build_object('fecha',d::date,'id',suizamente_private.v7_dia(d::date),
      'pregunta',(SELECT payload->>'pregunta' FROM suizamente_private.suizamente_preguntas WHERE id=suizamente_private.v7_dia(d::date)),
      'votos',(SELECT count(*) FROM suizamente_private.suizamente_dia_votos WHERE fecha=d::date),
      'porcentajes',CASE WHEN (SELECT count(*) FROM suizamente_private.suizamente_dia_votos WHERE fecha=d::date)>=(suizamente_private.v2_config()->>'minimoVotosParaPorcentajes')::integer THEN
        (SELECT jsonb_agg(round(100.0*(SELECT count(*) FROM suizamente_private.suizamente_dia_votos WHERE fecha=d::date AND opcion=i)/(SELECT count(*) FROM suizamente_private.suizamente_dia_votos WHERE fecha=d::date)) ORDER BY i)
          FROM generate_series(0,(SELECT jsonb_array_length(payload->'opciones')-1 FROM suizamente_private.suizamente_preguntas WHERE id=suizamente_private.v7_dia(d::date))) i) ELSE NULL END) ORDER BY d)
      FROM generate_series(w::timestamp,(w+13)::timestamp,interval '1 day') d));
  ELSIF section='ranking' THEN
    w:=coalesce(nullif(body->>'semana','')::date,suizamente_private.v7_semana());
    IF extract(isodow FROM w)<>1 THEN RAISE EXCEPTION 'SZV2:400:La semana empieza en lunes'; END IF;
    IF method='POST' AND object_id IN('excluir','incluir') THEN
      target:=body->>'jugadorId';
      IF NOT EXISTS(SELECT 1 FROM suizamente_private.suizamente_jugadores WHERE jugador_id=target) THEN RAISE EXCEPTION 'SZV2:404:Jugador no encontrado'; END IF;
      IF object_id='excluir' THEN INSERT INTO suizamente_private.suizamente_ranking_exclusiones(jugador_id,semana,admin_id) VALUES(target,w,actor) ON CONFLICT DO NOTHING;
      ELSE DELETE FROM suizamente_private.suizamente_ranking_exclusiones WHERE jugador_id=target AND semana=w; END IF;
      detail:=jsonb_build_object('jugadorId',target,'semana',w);
    ELSIF method<>'GET' THEN RAISE EXCEPTION 'SZV2:404:Acción no disponible'; END IF;
    result:=suizamente_private.v7_ranking(actor::text,'suiza',w)||jsonb_build_object('excluidos',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.jugador_id,'apodo',j.apodo)),'[]') FROM suizamente_private.suizamente_ranking_exclusiones e JOIN suizamente_private.suizamente_jugadores j ON j.jugador_id=e.jugador_id WHERE semana=w));
  ELSIF section='partidas' AND method='GET' THEN
    result:=jsonb_build_object('filas',coalesce((SELECT jsonb_agg(row ORDER BY created DESC) FROM(
      SELECT jsonb_build_object('id',m.id,'a',a.apodo,'b',b.apodo,'estado',m.estado,'fase',m.fase,'ronda',m.ronda,'sellosA',m.sellos_a,'sellosB',m.sellos_b,'barraA',m.barra_a,'barraB',m.barra_b,
        'turno',CASE WHEN m.turno=m.jugador_a THEN a.apodo ELSE b.apodo END,'plazo',m.plazo,'creadaEn',m.creada_en,'terminadaEn',m.terminada_en) row,m.creada_en created
      FROM suizamente_private.suizamente_partidas m LEFT JOIN suizamente_private.suizamente_jugadores a ON a.jugador_id=m.jugador_a LEFT JOIN suizamente_private.suizamente_jugadores b ON b.jugador_id=m.jugador_b
      WHERE (m.id::text||' '||coalesce(a.apodo,'')||' '||coalesce(b.apodo,'')) ILIKE '%'||left(coalesce(body->>'q',''),100)||'%' ORDER BY m.creada_en DESC LIMIT 50) s),'[]'));
  ELSIF section='asaltos' AND method='GET' THEN
    result:=jsonb_build_object('filas',coalesce((SELECT jsonb_agg(row ORDER BY created DESC) FROM(
      SELECT jsonb_build_object('id',r.id,'autor',a.apodo,'victima',v.apodo,'canton',r.canton,'estado',r.estado,'premio',r.premio,'escudo',r.escudo,'fecha',r.creado_en) row,r.creado_en created
        FROM suizamente_private.suizamente_asaltos r LEFT JOIN suizamente_private.suizamente_jugadores a ON a.jugador_id=r.jugador_id LEFT JOIN suizamente_private.suizamente_jugadores v ON v.jugador_id=r.victima ORDER BY r.creado_en DESC LIMIT 50) s),'[]'),
      'actividad',(SELECT coalesce(jsonb_agg(jsonb_build_object('jugadorId',j.jugador_id,'apodo',j.apodo,'ofertas',s.n,'maxDia',s.max_day,'superaLimite',s.max_day>(suizamente_private.v2_config()#>>'{asaltos,maxPorDia}')::integer,
        'victimasDistintas',(SELECT count(DISTINCT victima) FROM suizamente_private.suizamente_asaltos WHERE jugador_id=s.jugador_id AND fecha>=day-6),
        'maxContraUnaPersona',(SELECT coalesce(max(n),0) FROM(SELECT count(*) n FROM suizamente_private.suizamente_asaltos WHERE jugador_id=s.jugador_id AND fecha>=day-6 AND victima IS NOT NULL GROUP BY victima) targets)) ORDER BY s.n DESC),'[]') FROM(
        SELECT jugador_id,sum(n) n,max(n) max_day FROM(SELECT jugador_id,fecha,count(*) n FROM suizamente_private.suizamente_asaltos WHERE fecha>=day-6 GROUP BY jugador_id,fecha) d GROUP BY jugador_id) s JOIN suizamente_private.suizamente_jugadores j ON j.jugador_id=s.jugador_id));
  ELSIF section='album' AND method='GET' THEN
    result:=jsonb_build_object('colecciones',(SELECT jsonb_agg(jsonb_build_object('id',c->'id','nombre',c->'nombre','mes',c->'mes','cartas',jsonb_array_length(c->'cartas'),
      'repartidas',(SELECT count(*) FROM suizamente_private.suizamente_movimientos a WHERE motivo IN ('carta','carta_repetida') AND EXISTS(SELECT 1 FROM jsonb_array_elements(c->'cartas') k WHERE k->>'id'=a.detalle->>'carta')),
      'enAlbum',(SELECT count(*) FROM suizamente_private.suizamente_cartas a WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(c->'cartas') k WHERE k->>'id'=a.carta_id)),
      'completadas',(SELECT count(*) FROM suizamente_private.suizamente_movimientos WHERE motivo='coleccion' AND ref=c->>'id')) ORDER BY (c->>'id')::integer)
      FROM suizamente_private.suizamente_configuracion CROSS JOIN LATERAL jsonb_array_elements(album->'colecciones') c));
  ELSIF section='registro' AND method='GET' THEN
    result:=jsonb_build_object('filas',(SELECT coalesce(jsonb_agg(row ORDER BY n DESC),'[]') FROM(
      SELECT id n,jsonb_build_object('id',id,'adminId',admin_id,'accion',accion,'objeto',objeto,'detalle',detalle,'fecha',creado_en) row FROM suizamente_private.suizamente_admin_registro ORDER BY id DESC LIMIT 100) s));
  ELSE RAISE EXCEPTION 'SZV2:404:Sección no disponible'; END IF;
  INSERT INTO suizamente_private.suizamente_admin_registro(admin_id,accion,objeto,detalle) VALUES(actor,method||':'||section||CASE WHEN operation<>'' THEN ':'||operation ELSE CASE WHEN section='ranking' THEN ':'||object_id ELSE '' END END,route,detail);
  RETURN result;
END $$;
DO $$ BEGIN
  IF to_regprocedure('suizamente_private.v7_api(text,jsonb,uuid,text)') IS NULL THEN
    ALTER FUNCTION public.suizamente_v2(text,jsonb,uuid,text) SET SCHEMA suizamente_private;
    ALTER FUNCTION suizamente_private.suizamente_v2(text,jsonb,uuid,text) RENAME TO v7_api;
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.suizamente_v2(p_action text,p_args jsonb DEFAULT '{}',p_guest_id uuid DEFAULT NULL,p_guest_token text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF p_action='admin' THEN
    IF NOT suizamente_private.v7_admin() THEN RAISE EXCEPTION 'SZV2:403:Solo administración de Latido'; END IF;
    IF jsonb_typeof(coalesce(p_args,'{}'))<>'object' OR octet_length(p_args::text)>150000 THEN RAISE EXCEPTION 'SZV2:400:Solicitud no válida'; END IF;
    RETURN suizamente_private.v9_accion(auth.uid(),p_args);
  END IF;
  RETURN suizamente_private.v7_api(p_action,p_args,p_guest_id,p_guest_token);
END $$;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='suizamente_private' AND tablename IN('suizamente_admin_registro','suizamente_economia_historial') LOOP
    EXECUTE format('ALTER TABLE suizamente_private.%I ENABLE ROW LEVEL SECURITY',r.tablename);EXECUTE format('REVOKE ALL ON suizamente_private.%I FROM PUBLIC,anon,authenticated',r.tablename);
  END LOOP;
  FOR r IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='suizamente_private' AND (p.proname LIKE 'v9_%' OR p.proname='v7_api') LOOP EXECUTE 'REVOKE ALL ON FUNCTION '||r.signature||' FROM PUBLIC,anon,authenticated'; END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
