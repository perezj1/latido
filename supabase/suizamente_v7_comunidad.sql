-- Community. Apply after v6; reference files remain immutable.
BEGIN;
ALTER TABLE suizamente_private.suizamente_jugadores ADD COLUMN IF NOT EXISTS ultimo_visto_en timestamptz;
ALTER TABLE suizamente_private.suizamente_jugadores ADD COLUMN IF NOT EXISTS renombrar boolean NOT NULL DEFAULT false;
ALTER TABLE suizamente_private.suizamente_jugadores ADD COLUMN IF NOT EXISTS excluido_ranking boolean NOT NULL DEFAULT false;
ALTER TABLE suizamente_private.suizamente_votos ADD COLUMN IF NOT EXISTS pais text;
ALTER TABLE suizamente_private.suizamente_votos ADD COLUMN IF NOT EXISTS anos_suiza text;
ALTER TABLE suizamente_private.suizamente_votos ALTER COLUMN creado_en SET DEFAULT clock_timestamp();
ALTER TABLE suizamente_private.suizamente_movimientos ALTER COLUMN creado_en SET DEFAULT clock_timestamp();
CREATE TABLE IF NOT EXISTS suizamente_private.admins(user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_amigos(
  seguidor text NOT NULL REFERENCES suizamente_private.suizamente_jugadores(jugador_id) ON DELETE CASCADE,
  seguido text NOT NULL REFERENCES suizamente_private.suizamente_jugadores(jugador_id) ON DELETE CASCADE,
  estado text NOT NULL CHECK(estado IN ('pendiente','aceptado')),creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(seguidor,seguido),CHECK(seguidor<>seguido)
);
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_dia(
  fecha date PRIMARY KEY,pregunta_id text NOT NULL REFERENCES suizamente_private.suizamente_preguntas(id),creado_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_dia_votos(
  jugador_id text NOT NULL,fecha date NOT NULL REFERENCES suizamente_private.suizamente_dia(fecha),pregunta_id text NOT NULL,
  opcion integer NOT NULL,recompensada boolean NOT NULL DEFAULT false,creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(jugador_id,fecha)
);
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_libreta(
  jugador_id text NOT NULL REFERENCES suizamente_private.suizamente_jugadores(jugador_id) ON DELETE CASCADE,
  pregunta_id text NOT NULL,contenido jsonb NOT NULL,creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(jugador_id,pregunta_id)
);
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_propuestas(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),jugador_id text REFERENCES suizamente_private.suizamente_jugadores(jugador_id) ON DELETE SET NULL,
  contenido jsonb NOT NULL,estado text NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','aprobada','rechazada')),nota text,
  pregunta_id text UNIQUE REFERENCES suizamente_private.suizamente_preguntas(id),creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),actualizado_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_valoraciones(
  propuesta_id uuid NOT NULL REFERENCES suizamente_private.suizamente_propuestas(id),jugador_id text NOT NULL,
  valor integer NOT NULL CHECK(valor IN (-1,0,1)),creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(propuesta_id,jugador_id)
);
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_denuncias(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),denunciante text NOT NULL,denunciado text REFERENCES suizamente_private.suizamente_jugadores(jugador_id) ON DELETE SET NULL,
  motivo text NOT NULL,estado text NOT NULL DEFAULT 'pendiente',creado_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_reportes(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),jugador_id text NOT NULL,pregunta_id text NOT NULL REFERENCES suizamente_private.suizamente_preguntas(id),
  motivo text NOT NULL,estado text NOT NULL DEFAULT 'pendiente',creado_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_ranking_exclusiones(
  jugador_id text NOT NULL,semana date NOT NULL,admin_id uuid NOT NULL,creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(jugador_id,semana)
);
CREATE INDEX IF NOT EXISTS suizamente_propuestas_fecha ON suizamente_private.suizamente_propuestas(jugador_id,creado_en);
CREATE INDEX IF NOT EXISTS suizamente_ranking_victorias ON suizamente_private.suizamente_partidas(ganador,terminada_en) WHERE terminada_en IS NOT NULL;
CREATE INDEX IF NOT EXISTS suizamente_ranking_sellos ON suizamente_private.suizamente_movimientos(jugador_id,creado_en) WHERE motivo IN('sello_ganado','duelo_sello');
CREATE INDEX IF NOT EXISTS suizamente_solicitudes ON suizamente_private.suizamente_amigos(seguido,estado,creado_en);
CREATE INDEX IF NOT EXISTS suizamente_propuestas_estado ON suizamente_private.suizamente_propuestas(estado,creado_en DESC);
CREATE INDEX IF NOT EXISTS suizamente_valoraciones_fecha ON suizamente_private.suizamente_valoraciones(jugador_id,creado_en);
CREATE INDEX IF NOT EXISTS suizamente_denuncias_fecha ON suizamente_private.suizamente_denuncias(denunciante,creado_en);
CREATE INDEX IF NOT EXISTS suizamente_reportes_pregunta ON suizamente_private.suizamente_reportes(pregunta_id,estado);
CREATE INDEX IF NOT EXISTS suizamente_dia_actividad ON suizamente_private.suizamente_dia_votos(creado_en,jugador_id);
CREATE OR REPLACE FUNCTION suizamente_private.v2_config() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT '{"comunidad":{"propuestasPorDia":3,"denunciasPorDia":5,"libretaMax":500,"presenciaSegundos":300,"preguntaMax":140,"opcionMax":90,"datoMax":300,"diasSinRepetir":365}}'::jsonb||juego FROM suizamente_private.suizamente_configuracion WHERE id=true
$$;
CREATE OR REPLACE FUNCTION suizamente_private.v7_admin() RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE allowed boolean:=false;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF to_regprocedure('suizamente_private.is_admin()') IS NOT NULL THEN EXECUTE 'SELECT suizamente_private.is_admin()' INTO allowed; END IF;
  IF NOT coalesce(allowed,false) AND to_regprocedure('public.is_business_promotion_admin()') IS NOT NULL THEN EXECUTE 'SELECT public.is_business_promotion_admin()' INTO allowed; END IF;
  RETURN coalesce(allowed,false) OR EXISTS(SELECT 1 FROM suizamente_private.admins WHERE user_id=auth.uid());
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v7_hoy(t timestamptz DEFAULT clock_timestamp()) RETURNS date
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT (t AT TIME ZONE (suizamente_private.v2_config()->>'zonaHoraria'))::date $$;
CREATE OR REPLACE FUNCTION suizamente_private.v7_semana(t timestamptz DEFAULT clock_timestamp()) RETURNS date
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT date_trunc('week',t AT TIME ZONE (suizamente_private.v2_config()->>'zonaHoraria'))::date $$;
CREATE OR REPLACE FUNCTION suizamente_private.v7_notificar(actor text,kind text,reference text,message text,href text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid;
BEGIN
  INSERT INTO suizamente_private.suizamente_novedades(jugador_id,tipo,ref,datos) VALUES(actor,kind,reference,jsonb_build_object('texto',message,'href',href)) ON CONFLICT DO NOTHING;
  SELECT usuario_id INTO uid FROM suizamente_private.suizamente_jugadores WHERE jugador_id=actor;
  IF uid IS NOT NULL AND to_regclass('public.app_notifications') IS NOT NULL THEN
    EXECUTE 'INSERT INTO public.app_notifications(recipient_id,kind,source_id,data) VALUES($1,''suizamente_comunidad'',$2,$3) ON CONFLICT DO NOTHING'
      USING uid,kind||':'||reference,jsonb_build_object('title',message,'href',href);
  END IF;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v7_voto_meta() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  SELECT pais,anos_suiza INTO NEW.pais,NEW.anos_suiza FROM suizamente_private.suizamente_jugadores WHERE jugador_id=NEW.jugador_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS suizamente_voto_meta ON suizamente_private.suizamente_votos;
CREATE TRIGGER suizamente_voto_meta BEFORE INSERT ON suizamente_private.suizamente_votos FOR EACH ROW EXECUTE FUNCTION suizamente_private.v7_voto_meta();
CREATE OR REPLACE FUNCTION suizamente_private.v7_dia(fecha date DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE day date:=coalesce(fecha,suizamente_private.v7_hoy()); pid text;
BEGIN
  PERFORM pg_advisory_xact_lock(7217832);
  SELECT pregunta_id INTO pid FROM suizamente_private.suizamente_dia WHERE suizamente_dia.fecha=day;
  IF pid IS NULL THEN
    SELECT id INTO pid FROM suizamente_private.suizamente_preguntas p WHERE NOT oculta AND payload->>'tipo'='dilema'
      AND NOT EXISTS(SELECT 1 FROM suizamente_private.suizamente_dia d WHERE d.pregunta_id=p.id AND abs(d.fecha-day)<=(suizamente_private.v2_config()#>>'{comunidad,diasSinRepetir}')::integer)
      ORDER BY md5(day::text||':'||p.id),p.id LIMIT 1;
    IF pid IS NULL THEN RAISE EXCEPTION 'SZV2:503:No hay un dilema disponible para ese día'; END IF;
    INSERT INTO suizamente_private.suizamente_dia VALUES(day,pid,clock_timestamp());
  END IF;
  RETURN pid;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v7_revelada(actor text,pid text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT (EXISTS(SELECT 1 FROM suizamente_private.suizamente_votos WHERE jugador_id=actor AND pregunta_id=pid)
    OR EXISTS(SELECT 1 FROM suizamente_private.suizamente_partida_preguntas WHERE jugador_id=actor AND pregunta_id=pid AND respondida_en IS NOT NULL AND NOT omitida))
    AND NOT EXISTS(SELECT 1 FROM suizamente_private.suizamente_partida_preguntas WHERE jugador_id=actor AND pregunta_id=pid AND respondida_en IS NULL)
    AND NOT EXISTS(SELECT 1 FROM suizamente_private.suizamente_asaltos WHERE jugador_id=actor AND payload->>'id'=pid AND estado='pregunta')
$$;
CREATE OR REPLACE FUNCTION suizamente_private.v7_resultado(actor text,pid text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q jsonb; total integer; choice integer; pcts jsonb; countries jsonb; years jsonb; own_country text; own_years text; minimum integer:=(suizamente_private.v2_config()->>'minimoVotosParaPorcentajes')::integer;
BEGIN
  IF NOT suizamente_private.v7_revelada(actor,pid) THEN RAISE EXCEPTION 'SZV2:409:Responde antes de ver el resultado'; END IF;
  SELECT payload INTO q FROM suizamente_private.suizamente_preguntas WHERE id=pid;
  SELECT opcion INTO choice FROM suizamente_private.suizamente_votos WHERE jugador_id=actor AND pregunta_id=pid;
  SELECT count(*) INTO total FROM suizamente_private.suizamente_votos WHERE pregunta_id=pid;
  SELECT pais,anos_suiza INTO own_country,own_years FROM suizamente_private.suizamente_jugadores WHERE jugador_id=actor;
  IF total>=minimum THEN
    SELECT jsonb_agg(round(100.0*(SELECT count(*) FROM suizamente_private.suizamente_votos WHERE pregunta_id=pid AND opcion=i)/total) ORDER BY i) INTO pcts
      FROM generate_series(0,jsonb_array_length(q->'opciones')-1) i;
    WITH groups AS(SELECT pais,count(*) n,round(100.0*count(*) FILTER(WHERE opcion=CASE WHEN q->>'tipo'='real' THEN (q->>'correcta')::integer ELSE choice END)/count(*)) pct
      FROM suizamente_private.suizamente_votos WHERE pregunta_id=pid AND pais IS NOT NULL GROUP BY pais HAVING count(*)>=minimum),
    top AS(SELECT * FROM groups ORDER BY n DESC,pais LIMIT 4)
    SELECT coalesce(jsonb_agg(jsonb_build_object('grupo',pais,'pct',pct,'tuyo',pais=own_country) ORDER BY n DESC,pais),'[]') INTO countries
      FROM groups WHERE pais IN(SELECT pais FROM top) OR pais=own_country;
    SELECT coalesce(jsonb_agg(jsonb_build_object('grupo',anos_suiza,'pct',pct,'tuyo',anos_suiza=own_years) ORDER BY anos_suiza),'[]') INTO years FROM(
      SELECT anos_suiza,round(100.0*count(*) FILTER(WHERE opcion=CASE WHEN q->>'tipo'='real' THEN (q->>'correcta')::integer ELSE choice END)/count(*)) pct
      FROM suizamente_private.suizamente_votos WHERE pregunta_id=pid AND anos_suiza IS NOT NULL GROUP BY anos_suiza HAVING count(*)>=minimum) g;
  END IF;
  RETURN jsonb_build_object('id',pid,'tipo',q->'tipo','tema',q->'tema','emoji',q->'emoji','pregunta',q->'pregunta','opciones',q->'opciones','dato',q->'dato','opcion',choice,
    'pct',CASE WHEN pcts IS NOT NULL THEN pcts->choice ELSE NULL END,'porcentajes',pcts,'mayoria',CASE WHEN pcts IS NOT NULL THEN (pcts->>choice)::numeric>=50 ELSE NULL END,
    'desglose',jsonb_build_object('pais',coalesce(countries,'[]'),'anos',coalesce(years,'[]')),'guardada',EXISTS(SELECT 1 FROM suizamente_private.suizamente_libreta WHERE jugador_id=actor AND pregunta_id=pid));
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v7_cobrar_dia(actor text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r record; c jsonb:=suizamente_private.v2_config();
BEGIN
  IF NOT EXISTS(SELECT 1 FROM suizamente_private.suizamente_jugadores WHERE jugador_id=actor) THEN RETURN; END IF;
  FOR r IN SELECT * FROM suizamente_private.suizamente_dia_votos WHERE jugador_id=actor AND NOT recompensada FOR UPDATE LOOP
    PERFORM suizamente_private.v3_anotar(actor,'pregunta_dia',r.fecha::text,(c#>>'{recompensas,preguntaDelDia,monedas}')::integer,(c#>>'{recompensas,preguntaDelDia,xp}')::integer);
    PERFORM suizamente_private.v3_actividad(actor,r.creado_en);
    UPDATE suizamente_private.suizamente_dia_votos SET recompensada=true WHERE jugador_id=actor AND fecha=r.fecha;
  END LOOP;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v7_persona(pid text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('id',jugador_id,'apodo',apodo,'color',color,'canton',canton,'nivel',suizamente_private.v2_nivel(xp),
   'online',ultimo_visto_en>clock_timestamp()-make_interval(secs=>(suizamente_private.v2_config()#>>'{comunidad,presenciaSegundos}')::integer))
 FROM suizamente_private.suizamente_jugadores WHERE jugador_id=pid AND usuario_id IS NOT NULL AND NOT bloqueado
$$;
CREATE OR REPLACE FUNCTION suizamente_private.v7_ranking(actor text,scope text DEFAULT 'suiza',week date DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE w date:=coalesce(week,suizamente_private.v7_semana()); start_at timestamptz; end_at timestamptz; ranked jsonb; own_row jsonb; ahead jsonb;
BEGIN
  start_at:=w::timestamp AT TIME ZONE (suizamente_private.v2_config()->>'zonaHoraria');
  end_at:=(w+7)::timestamp AT TIME ZONE (suizamente_private.v2_config()->>'zonaHoraria');
  WITH scores AS(
    SELECT j.jugador_id,(SELECT count(*) FROM suizamente_private.suizamente_partidas WHERE ganador=j.jugador_id AND terminada_en>=start_at AND terminada_en<end_at) victorias,
      (SELECT count(*) FROM suizamente_private.suizamente_movimientos WHERE jugador_id=j.jugador_id AND motivo IN('sello_ganado','duelo_sello') AND creado_en>=start_at AND creado_en<end_at) sellos
    FROM suizamente_private.suizamente_jugadores j WHERE usuario_id IS NOT NULL AND en_ranking AND NOT bloqueado AND NOT excluido_ranking
      AND (scope='suiza' OR j.jugador_id=actor OR EXISTS(SELECT 1 FROM suizamente_private.suizamente_amigos WHERE seguidor=actor AND seguido=j.jugador_id AND estado='aceptado'))
      AND NOT EXISTS(SELECT 1 FROM suizamente_private.suizamente_ranking_exclusiones e WHERE e.jugador_id=j.jugador_id AND e.semana=w)
  ), positions AS(SELECT *,row_number() OVER(ORDER BY victorias DESC,sellos DESC,jugador_id) puesto FROM scores)
  SELECT coalesce(jsonb_agg(suizamente_private.v7_persona(jugador_id)||jsonb_build_object('puesto',puesto,'victorias',victorias,'sellos',sellos,'tu',jugador_id=actor) ORDER BY puesto),'[]') INTO ranked FROM positions;
  SELECT value INTO own_row FROM jsonb_array_elements(ranked) WHERE value->>'id'=actor;
  SELECT value INTO ahead FROM jsonb_array_elements(ranked) WHERE (value->>'victorias')::integer>coalesce((own_row->>'victorias')::integer,0) ORDER BY (value->>'puesto')::integer DESC LIMIT 1;
  RETURN jsonb_build_object('semana',w,'hasta',w+6,'filas',coalesce((SELECT jsonb_agg(value ORDER BY (value->>'puesto')::integer) FROM jsonb_array_elements(ranked)
    WHERE (value->>'puesto')::integer<=(suizamente_private.v2_config()#>>'{ranking,top}')::integer),'[]'),'tuFila',own_row,'rival',ahead,
    'diferencia',CASE WHEN ahead IS NOT NULL THEN (ahead->>'victorias')::integer-coalesce((own_row->>'victorias')::integer,0) ELSE NULL END);
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v7_validar_propuesta(q jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE limits jsonb:=suizamente_private.v2_config()->'comunidad';
BEGIN
  IF jsonb_typeof(q) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'SZV2:400:Propuesta no válida'; END IF;
  IF coalesce(q->>'tipo','') NOT IN ('dilema','real','mito') OR q->>'pregunta' IS NULL OR char_length(btrim(q->>'pregunta')) NOT BETWEEN 1 AND (limits->>'preguntaMax')::integer
    OR q->>'dato' IS NULL OR char_length(btrim(q->>'dato')) NOT BETWEEN 1 AND (limits->>'datoMax')::integer
    OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(suizamente_private.v2_config()->'categorias') c WHERE c->'temas' ? (q->>'tema'))
    OR char_length(coalesce(q->>'emoji','')) NOT BETWEEN 1 AND 16 OR char_length(coalesce(q->>'fuente',''))>1000
    OR (coalesce(q->>'fuente','')<>'' AND q->>'fuente'!~'^https?://')
    OR lower(q::text) ~ '\m(mierda|puta|puto|cabr[oó]n|fuck|shit)\M'
    OR q::text ~ ('['||chr(127462)||'-'||chr(127487)||']') THEN RAISE EXCEPTION 'SZV2:400:Revisa los textos y el tema de la propuesta'; END IF;
  IF q->>'tipo'='mito' THEN
    IF jsonb_typeof(q->'verdad') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'SZV2:400:Marca si es verdad o mito'; END IF;
  ELSE
    IF jsonb_typeof(q->'opciones') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'SZV2:400:Revisa las opciones'; END IF;
    IF jsonb_array_length(q->'opciones') NOT BETWEEN 2 AND 3
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(q->'opciones') o WHERE char_length(btrim(coalesce(o->>'t',''))) NOT BETWEEN 1 AND (limits->>'opcionMax')::integer
        OR char_length(coalesce(o->>'e','')) NOT BETWEEN 1 AND 16)
      OR (q->>'tipo'='real' AND ((q->>'correcta')::integer IS NULL OR (q->>'correcta')::integer<0 OR (q->>'correcta')::integer>=jsonb_array_length(q->'opciones'))) THEN RAISE EXCEPTION 'SZV2:400:Revisa las opciones y la respuesta correcta'; END IF;
  END IF;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v7_accion(action text,actor text,body jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c jsonb:=suizamente_private.v2_config(); pl suizamente_private.suizamente_jugadores; target text; op text; q jsonb; pid text; prop suizamente_private.suizamente_propuestas;
  choice integer; day date:=suizamente_private.v7_hoy(); inserted integer; amount integer; key text; active boolean; id uuid; base jsonb;
BEGIN
  SELECT * INTO pl FROM suizamente_private.suizamente_jugadores WHERE jugador_id=actor FOR UPDATE;
  IF action IN ('dia','votar_dia','pregunta_publica','portada','resultado') THEN
    pid:=CASE WHEN action IN ('pregunta_publica','resultado') THEN body->>'id' ELSE suizamente_private.v7_dia(day) END;
    SELECT payload INTO q FROM suizamente_private.suizamente_preguntas WHERE suizamente_preguntas.id=pid;
    IF q IS NULL OR (action<>'resultado' AND q->>'tipo'<>'dilema') THEN RAISE EXCEPTION 'SZV2:404:Pregunta no encontrada'; END IF;
    IF action='resultado' THEN RETURN suizamente_private.v7_resultado(actor,pid); END IF;
    IF action='votar_dia' THEN
      IF pl.bloqueado THEN RAISE EXCEPTION 'SZV2:403:Esta cuenta no puede votar'; END IF;
      IF body->>'fecha' IS DISTINCT FROM day::text OR body->>'preguntaId' IS DISTINCT FROM pid THEN RAISE EXCEPTION 'SZV2:409:La pregunta del día ha cambiado'; END IF;
      IF EXISTS(SELECT 1 FROM suizamente_private.suizamente_preguntas WHERE suizamente_preguntas.id=pid AND oculta) THEN RAISE EXCEPTION 'SZV2:409:Esta pregunta no está disponible'; END IF;
      choice:=(body->>'opcion')::integer;
      IF choice IS NULL OR choice<0 OR choice>=jsonb_array_length(q->'opciones') THEN RAISE EXCEPTION 'SZV2:400:Elige una opción válida'; END IF;
      INSERT INTO suizamente_private.suizamente_votos(pregunta_id,jugador_id,opcion) VALUES(pid,actor,choice) ON CONFLICT DO NOTHING;
      SELECT opcion INTO choice FROM suizamente_private.suizamente_votos WHERE jugador_id=actor AND pregunta_id=pid;
      INSERT INTO suizamente_private.suizamente_dia_votos(jugador_id,fecha,pregunta_id,opcion) VALUES(actor,day,pid,choice) ON CONFLICT DO NOTHING;
      PERFORM suizamente_private.v7_cobrar_dia(actor);
    END IF;
    SELECT opcion INTO choice FROM suizamente_private.suizamente_votos WHERE jugador_id=actor AND pregunta_id=pid;
    IF action='portada' THEN
      base:=CASE WHEN choice IS NOT NULL THEN suizamente_private.v7_resultado(actor,pid) ELSE '{}'::jsonb END;
      RETURN jsonb_build_object('jugadoresHoy',(SELECT count(DISTINCT jugador_id) FROM suizamente_private.suizamente_actividad_dias WHERE fecha=day),
        'pregunta',jsonb_build_object('id',pid,'texto',q->>'pregunta'),'tuVoto',choice,'pctIgual',base->'pct','mayoria',base->'mayoria',
        'esperan',(SELECT count(*) FROM suizamente_private.suizamente_partidas WHERE turno=actor AND estado IN('buscando','jugando')));
    END IF;
    RETURN (q-'correcta'-'dato')||jsonb_build_object('fecha',CASE WHEN action='pregunta_publica' THEN NULL ELSE day END,
      'hecho',EXISTS(SELECT 1 FROM suizamente_private.suizamente_dia_votos WHERE jugador_id=actor AND fecha=day),'noDisponible',
      EXISTS(SELECT 1 FROM suizamente_private.suizamente_preguntas WHERE suizamente_preguntas.id=pid AND oculta),
      'resultado',CASE WHEN choice IS NOT NULL THEN suizamente_private.v7_resultado(actor,pid) ELSE NULL END,
      'premio',(SELECT jsonb_build_object('monedas',monedas,'xp',xp) FROM suizamente_private.suizamente_movimientos WHERE jugador_id=actor AND motivo='pregunta_dia' AND ref=day::text));
  END IF;
  IF pl.jugador_id IS NULL THEN RAISE EXCEPTION 'SZV2:404:Crea primero tu perfil'; END IF;
  IF (pl.bloqueado OR pl.renombrar) AND action NOT IN('amigos','perfil_publico','ranking','libreta','propuestas','valorar_siguiente') THEN RAISE EXCEPTION 'SZV2:403:Revisa el estado de tu perfil antes de continuar'; END IF;
  IF action IN('amistad','proponer','valorar','buscar') AND auth.uid() IS NULL THEN RAISE EXCEPTION 'SZV2:403:Entra con Latido para usar esta función'; END IF;
  IF action='buscar' THEN
    RETURN jsonb_build_object('jugadores',coalesce((SELECT jsonb_agg(suizamente_private.v7_persona(j.jugador_id)||jsonb_build_object('relacion',
      (SELECT estado FROM suizamente_private.suizamente_amigos WHERE seguidor=actor AND seguido=j.jugador_id)) ORDER BY apodo)
      FROM(SELECT * FROM suizamente_private.suizamente_jugadores WHERE usuario_id IS NOT NULL AND NOT bloqueado AND jugador_id<>actor
        AND apodo ILIKE '%'||left(coalesce(body->>'q',''),50)||'%' ORDER BY apodo LIMIT 30) j),'[]'));
  ELSIF action='amigos' THEN
    RETURN jsonb_build_object('lista',coalesce((SELECT jsonb_agg(suizamente_private.v7_persona(seguido) ORDER BY p.apodo) FROM suizamente_private.suizamente_amigos a JOIN suizamente_private.suizamente_jugadores p ON p.jugador_id=a.seguido WHERE seguidor=actor AND estado='aceptado' AND NOT p.bloqueado),'[]'),
      'solicitudes',coalesce((SELECT jsonb_agg(suizamente_private.v7_persona(seguidor) ORDER BY a.creado_en) FROM suizamente_private.suizamente_amigos a WHERE seguido=actor AND estado='pendiente'),'[]'),
      'enviadas',coalesce((SELECT jsonb_agg(seguido) FROM suizamente_private.suizamente_amigos WHERE seguidor=actor AND estado='pendiente'),'[]'));
  ELSIF action='amistad' THEN
    target:=body->>'jugadorId';op:=body->>'operacion';
    IF target=actor OR suizamente_private.v7_persona(target) IS NULL THEN RAISE EXCEPTION 'SZV2:404:Jugador no disponible'; END IF;
    IF op IN('seguir','solicitar') THEN
      IF EXISTS(SELECT 1 FROM suizamente_private.suizamente_amigos WHERE seguidor=actor AND seguido=target) THEN RAISE EXCEPTION 'SZV2:409:Esta relación ya está guardada'; END IF;
      INSERT INTO suizamente_private.suizamente_amigos(seguidor,seguido,estado) VALUES(actor,target,CASE WHEN op='seguir' THEN 'aceptado' ELSE 'pendiente' END);
      IF op='solicitar' THEN PERFORM suizamente_private.v7_notificar(target,'solicitud',actor,'👥 '||pl.apodo||' quiere añadirte','/suizamente/amigos'); END IF;
    ELSIF op='aceptar' THEN
      UPDATE suizamente_private.suizamente_amigos SET estado='aceptado' WHERE seguidor=target AND seguido=actor AND estado='pendiente';
      GET DIAGNOSTICS inserted=ROW_COUNT;
      IF inserted=0 THEN RAISE EXCEPTION 'SZV2:409:Esta solicitud ya está resuelta'; END IF;
      INSERT INTO suizamente_private.suizamente_amigos(seguidor,seguido,estado) VALUES(actor,target,'aceptado') ON CONFLICT(seguidor,seguido) DO UPDATE SET estado='aceptado';
      PERFORM suizamente_private.v7_notificar(target,'amistad',actor,'👥 '||pl.apodo||' ha aceptado tu solicitud','/suizamente/amigos');
    ELSIF op='rechazar' THEN DELETE FROM suizamente_private.suizamente_amigos WHERE seguidor=target AND seguido=actor AND estado='pendiente';
    ELSIF op='dejar_seguir' THEN DELETE FROM suizamente_private.suizamente_amigos WHERE seguidor=actor AND seguido=target;
    ELSE RAISE EXCEPTION 'SZV2:400:Acción no válida'; END IF;
    RETURN suizamente_private.v7_accion('amigos',actor,'{}');
  ELSIF action='perfil_publico' THEN
    target:=body->>'id';
    base:=suizamente_private.v7_persona(target);
    IF base IS NULL THEN RAISE EXCEPTION 'SZV2:404:Perfil no disponible'; END IF;
    RETURN base||jsonb_build_object('especialidad',suizamente_private.v3_perfil(target)->'especialidad',
      'logros',(SELECT coalesce(jsonb_agg(value-'avance'),'[]') FROM jsonb_array_elements(suizamente_private.v3_logros(target)) WHERE (value->>'conseguido')::boolean),
      'seguidores',(SELECT count(*) FROM suizamente_private.suizamente_amigos WHERE seguido=target AND estado='aceptado'),
      'siguiendo',(SELECT count(*) FROM suizamente_private.suizamente_amigos WHERE seguidor=target AND estado='aceptado'),
      'loSigues',EXISTS(SELECT 1 FROM suizamente_private.suizamente_amigos WHERE seguidor=actor AND seguido=target AND estado='aceptado'),
      'solicitudPendiente',EXISTS(SELECT 1 FROM suizamente_private.suizamente_amigos WHERE seguidor=actor AND seguido=target AND estado='pendiente'),
      'vosotros',jsonb_build_object('ganadas',(SELECT count(*) FROM suizamente_private.suizamente_partidas WHERE ganador=actor AND target IN(jugador_a,jugador_b) AND actor IN(jugador_a,jugador_b)),
        'perdidas',(SELECT count(*) FROM suizamente_private.suizamente_partidas WHERE ganador=target AND actor IN(jugador_a,jugador_b))));
  ELSIF action='ranking' THEN RETURN suizamente_private.v7_ranking(actor,CASE WHEN body->>'ambito'='amigos' THEN 'amigos' ELSE 'suiza' END);
  ELSIF action='libreta' THEN
    RETURN jsonb_build_object('datos',coalesce((SELECT jsonb_agg(contenido||jsonb_build_object('id',pregunta_id,'guardadoEn',creado_en) ORDER BY creado_en DESC) FROM suizamente_private.suizamente_libreta WHERE jugador_id=actor),'[]'));
  ELSIF action='guardar_dato' THEN
    pid:=body->>'preguntaId';active:=(body->>'guardar')::boolean;
    IF active IS NULL THEN RAISE EXCEPTION 'SZV2:400:Indica si quieres guardar el dato'; END IF;
    IF active THEN
      IF NOT suizamente_private.v7_revelada(actor,pid) THEN RAISE EXCEPTION 'SZV2:409:Responde antes de guardar el dato'; END IF;
      IF (SELECT count(*) FROM suizamente_private.suizamente_libreta WHERE jugador_id=actor)>=(c#>>'{comunidad,libretaMax}')::integer
        AND NOT EXISTS(SELECT 1 FROM suizamente_private.suizamente_libreta WHERE jugador_id=actor AND pregunta_id=pid) THEN RAISE EXCEPTION 'SZV2:409:Tu libreta está llena'; END IF;
      SELECT payload INTO q FROM suizamente_private.suizamente_preguntas WHERE suizamente_preguntas.id=pid;
      INSERT INTO suizamente_private.suizamente_libreta(jugador_id,pregunta_id,contenido) VALUES(actor,pid,jsonb_build_object('tema',q->'tema','emoji',q->'emoji','pregunta',q->'pregunta','dato',q->'dato')) ON CONFLICT DO NOTHING;
    ELSE DELETE FROM suizamente_private.suizamente_libreta WHERE jugador_id=actor AND pregunta_id=pid; END IF;
    RETURN jsonb_build_object('guardada',active);
  ELSIF action='proponer' THEN
    IF (SELECT count(*) FROM suizamente_private.suizamente_propuestas WHERE jugador_id=actor AND suizamente_private.v7_hoy(creado_en)=day)>=(c#>>'{comunidad,propuestasPorDia}')::integer THEN RAISE EXCEPTION 'SZV2:409:Ya has enviado tus propuestas de hoy'; END IF;
    q:=body->'contenido';PERFORM suizamente_private.v7_validar_propuesta(q);
    INSERT INTO suizamente_private.suizamente_propuestas(jugador_id,contenido) VALUES(actor,q) RETURNING * INTO prop;
    RETURN jsonb_build_object('id',prop.id);
  ELSIF action='propuestas' THEN
    RETURN jsonb_build_object('propuestas',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'contenido',contenido,'estado',estado,'nota',nota,'preguntaId',pregunta_id,'creadoEn',creado_en) ORDER BY creado_en DESC)
      FROM suizamente_private.suizamente_propuestas p WHERE jugador_id=actor),'[]'));
  ELSIF action='valorar_siguiente' THEN
    IF auth.uid() IS NULL THEN RETURN jsonb_build_object('propuesta',NULL); END IF;
    SELECT * INTO prop FROM suizamente_private.suizamente_propuestas p WHERE estado='pendiente' AND jugador_id<>actor
      AND NOT EXISTS(SELECT 1 FROM suizamente_private.suizamente_valoraciones WHERE propuesta_id=p.id AND jugador_id=actor) ORDER BY creado_en LIMIT 1;
    RETURN jsonb_build_object('propuesta',CASE WHEN prop.id IS NULL THEN NULL ELSE jsonb_build_object('id',prop.id,'contenido',prop.contenido,'autor',suizamente_private.v7_persona(prop.jugador_id)) END,
      'monedasHoy',(SELECT coalesce(sum(monedas),0) FROM suizamente_private.suizamente_movimientos WHERE jugador_id=actor AND motivo='valoracion' AND suizamente_private.v7_hoy(creado_en)=day),
      'maximo',c#>'{recompensas,valoracionPropuesta,maxPorDia}');
  ELSIF action='valorar' THEN
    SELECT * INTO prop FROM suizamente_private.suizamente_propuestas WHERE suizamente_propuestas.id=(body->>'id')::uuid FOR UPDATE;
    choice:=(body->>'valor')::integer;
    IF prop.id IS NULL OR prop.jugador_id=actor OR prop.estado<>'pendiente' OR choice IS NULL OR choice NOT IN(-1,0,1) THEN RAISE EXCEPTION 'SZV2:409:No puedes valorar esta propuesta'; END IF;
    INSERT INTO suizamente_private.suizamente_valoraciones(propuesta_id,jugador_id,valor) VALUES(prop.id,actor,choice) ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS inserted=ROW_COUNT;
    IF inserted=0 THEN RAISE EXCEPTION 'SZV2:409:Ya has valorado esta propuesta'; END IF;
    SELECT greatest(0,(c#>>'{recompensas,valoracionPropuesta,maxPorDia}')::integer-coalesce(sum(monedas),0)) INTO amount FROM suizamente_private.suizamente_movimientos WHERE jugador_id=actor AND motivo='valoracion' AND suizamente_private.v7_hoy(creado_en)=day;
    amount:=CASE WHEN choice=0 THEN 0 ELSE least(amount,(c#>>'{recompensas,valoracionPropuesta,monedas}')::integer) END;
    PERFORM suizamente_private.v3_anotar(actor,'valoracion',prop.id::text,amount);
    RETURN jsonb_build_object('monedas',amount);
  ELSIF action IN('denunciar','reportar') THEN
    IF char_length(btrim(coalesce(body->>'motivo',''))) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'SZV2:400:Escribe un motivo breve'; END IF;
    IF action='denunciar' THEN
      target:=body->>'jugadorId';
      IF target=actor OR suizamente_private.v7_persona(target) IS NULL THEN RAISE EXCEPTION 'SZV2:404:Jugador no disponible'; END IF;
      IF (SELECT count(*) FROM suizamente_private.suizamente_denuncias WHERE denunciante=actor AND suizamente_private.v7_hoy(creado_en)=day)>=(c#>>'{comunidad,denunciasPorDia}')::integer THEN RAISE EXCEPTION 'SZV2:409:Ya has enviado tus denuncias de hoy'; END IF;
      INSERT INTO suizamente_private.suizamente_denuncias(denunciante,denunciado,motivo) VALUES(actor,target,btrim(body->>'motivo'));
    ELSE
      pid:=body->>'preguntaId';
      IF NOT suizamente_private.v7_revelada(actor,pid) THEN RAISE EXCEPTION 'SZV2:409:Responde antes de avisar de un dato'; END IF;
      INSERT INTO suizamente_private.suizamente_reportes(jugador_id,pregunta_id,motivo) VALUES(actor,pid,btrim(body->>'motivo'));
    END IF;
    RETURN jsonb_build_object('recibida',true);
  END IF;
  RAISE EXCEPTION 'SZV2:404:Acción no disponible';
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v7_config_publica() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object('categorias',c->'categorias','ruleta',c->'ruleta','partida',c->'partida','bienvenida',c#>'{recompensas,bienvenida}',
    'quienYaJugaba',c#>'{recompensas,quienYaJugaba}','comodines',c->'comodines','tienda',c->'tienda','escudos',c->'escudos','duelo',c->'duelo',
    'niveles',c->'niveles','mapa',c->'mapa','asaltos',c->'asaltos','album',c->'album','comunidad',c->'comunidad','ranking',c->'ranking',
    'minimoVotosParaPorcentajes',c->'minimoVotosParaPorcentajes',
    'version',(SELECT coalesce((to_jsonb(conf)->>'economia_version')::integer,0) FROM suizamente_private.suizamente_configuracion conf WHERE id=true),
    'recompensasComunidad',jsonb_build_object('dia',c#>'{recompensas,preguntaDelDia}','valorar',c#>'{recompensas,valoracionPropuesta}')) FROM (SELECT suizamente_private.v2_config() c) s
$$;
DO $$ BEGIN
  IF to_regprocedure('suizamente_private.v6_api(text,jsonb,uuid,text)') IS NULL THEN
    ALTER FUNCTION public.suizamente_v2(text,jsonb,uuid,text) SET SCHEMA suizamente_private;
    ALTER FUNCTION suizamente_private.suizamente_v2(text,jsonb,uuid,text) RENAME TO v6_api;
  END IF;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v7_enriquecer(data jsonb,actor text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE view jsonb:=data; item text; pid text; author text;
BEGIN
  IF jsonb_typeof(data)<>'object' THEN RETURN data; END IF;
  view:=view||jsonb_build_object('configVersion',(SELECT coalesce((to_jsonb(c)->>'economia_version')::integer,0) FROM suizamente_private.suizamente_configuracion c WHERE id=true));
  IF data->>'tuId' IS NOT NULL THEN
    view:=view||(SELECT jsonb_build_object('margenServidorSegundos',reglas#>'{partida,margenServidorSegundos}',
      'configPartida',jsonb_build_object('partida',reglas->'partida','ruleta',reglas->'ruleta','duelo',reglas->'duelo','comodines',reglas->'comodines'))
      FROM suizamente_private.suizamente_partidas WHERE id=(data->>'id')::uuid);
  END IF;
  FOR item IN SELECT unnest(ARRAY['pregunta','resultado']) LOOP
    pid:=data#>>ARRAY[item,'preguntaId'];
    IF pid IS NOT NULL THEN
      SELECT j.apodo INTO author FROM suizamente_private.suizamente_propuestas p JOIN suizamente_private.suizamente_jugadores j ON j.jugador_id=p.jugador_id WHERE p.pregunta_id=pid;
      view:=jsonb_set(view,ARRAY[item],data->item||jsonb_build_object('autor',author,'guardada',EXISTS(SELECT 1 FROM suizamente_private.suizamente_libreta WHERE jugador_id=actor AND pregunta_id=pid)));
    END IF;
  END LOOP;
  RETURN view;
END $$;
CREATE OR REPLACE FUNCTION public.suizamente_v2(p_action text,p_args jsonb DEFAULT '{}',p_guest_id uuid DEFAULT NULL,p_guest_token text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE data jsonb; identity jsonb; actor text; action text:=p_action; body jsonb:=coalesce(p_args,'{}'); blocked boolean;
BEGIN
  IF jsonb_typeof(body)<>'object' OR octet_length(body::text)>20000 THEN RAISE EXCEPTION 'SZV2:400:Solicitud no válida'; END IF;
  IF action='config' THEN RETURN suizamente_private.v7_config_publica(); END IF;
  IF action='capacidades' THEN RETURN jsonb_build_object('admin',suizamente_private.v7_admin(),'conCuenta',auth.uid() IS NOT NULL); END IF;
  actor:=CASE WHEN auth.uid() IS NOT NULL THEN auth.uid()::text ELSE 'invitado-'||p_guest_id::text END;
  SELECT bloqueado OR renombrar INTO blocked FROM suizamente_private.suizamente_jugadores WHERE jugador_id=actor;
  IF blocked AND action NOT IN('jugador','guardar_jugador','borrar_jugador','novedades_leer','perfil','partidas','partida','inicio','votos_mios','votos_resumen','jugadores',
    'dia','pregunta_publica','resultado','portada','buscar','amigos','perfil_publico','ranking','libreta','propuestas','valorar_siguiente','mapa','album','sobre','cofre','asalto','tienda') THEN
    identity:=suizamente_private.v2_api_base('jugador','{}',p_guest_id,p_guest_token);
    RAISE EXCEPTION 'SZV2:403:Revisa el estado de tu perfil antes de continuar';
  END IF;
  IF action='votos' AND body#>>'{contexto,tipo}'='dia' THEN action:='votar_dia';body:=body||jsonb_build_object('fecha',body#>>'{contexto,fecha}'); END IF;
  IF action IN('dia','votar_dia','pregunta_publica','resultado','portada','buscar','amigos','amistad','perfil_publico','ranking','libreta','guardar_dato','proponer','propuestas','valorar_siguiente','valorar','denunciar','reportar') THEN
    identity:=suizamente_private.v2_api_base('jugador','{}',p_guest_id,p_guest_token);actor:=identity->>'identidad';
    data:=suizamente_private.v7_accion(action,actor,body)||jsonb_build_object('identidad',actor);
  ELSE
    data:=suizamente_private.v6_api(action,body,p_guest_id,p_guest_token);
    actor:=CASE WHEN auth.uid() IS NOT NULL THEN auth.uid()::text ELSE 'invitado-'||p_guest_id::text END;
  END IF;
  UPDATE suizamente_private.suizamente_jugadores SET ultimo_visto_en=clock_timestamp() WHERE jugador_id=actor;
  PERFORM suizamente_private.v7_cobrar_dia(actor);
  data:=suizamente_private.v3_enriquecer(data,actor);
  IF action='perfil' THEN data:=data||jsonb_build_object('seguidores',(SELECT count(*) FROM suizamente_private.suizamente_amigos WHERE seguido=actor AND estado='aceptado'),'siguiendo',(SELECT count(*) FROM suizamente_private.suizamente_amigos WHERE seguidor=actor AND estado='aceptado')); END IF;
  RETURN suizamente_private.v7_enriquecer(data,actor);
END $$;
DO $$ BEGIN
  IF to_regprocedure('suizamente_private.v6_avances(text)') IS NULL THEN ALTER FUNCTION suizamente_private.v3_avances(text) RENAME TO v6_avances; END IF;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v3_avances(actor text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  RETURN suizamente_private.v6_avances(actor)||jsonb_build_object('autoria',(SELECT count(*) FROM suizamente_private.suizamente_propuestas WHERE jugador_id=actor AND pregunta_id IS NOT NULL));
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v7_vincular(actor text,guest_actor text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  INSERT INTO suizamente_private.suizamente_dia_votos(jugador_id,fecha,pregunta_id,opcion,recompensada,creado_en)
    SELECT actor,fecha,pregunta_id,coalesce((SELECT opcion FROM suizamente_private.suizamente_votos WHERE jugador_id=actor AND pregunta_id=g.pregunta_id),g.opcion),recompensada,creado_en
    FROM suizamente_private.suizamente_dia_votos g WHERE jugador_id=guest_actor ON CONFLICT DO NOTHING;
  DELETE FROM suizamente_private.suizamente_dia_votos WHERE jugador_id=guest_actor;
  INSERT INTO suizamente_private.suizamente_libreta SELECT actor,pregunta_id,contenido,creado_en FROM suizamente_private.suizamente_libreta WHERE jugador_id=guest_actor
    ON CONFLICT(jugador_id,pregunta_id) DO UPDATE SET creado_en=greatest(suizamente_libreta.creado_en,excluded.creado_en);
  DELETE FROM suizamente_private.suizamente_libreta WHERE jugador_id=actor AND pregunta_id IN(
    SELECT pregunta_id FROM suizamente_private.suizamente_libreta WHERE jugador_id=actor ORDER BY creado_en DESC,pregunta_id OFFSET (suizamente_private.v2_config()#>>'{comunidad,libretaMax}')::integer);
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v7_borrar_comunidad() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE anonymous text:='borrado-'||gen_random_uuid()::text;
BEGIN
  UPDATE suizamente_private.suizamente_dia_votos SET jugador_id=anonymous,recompensada=true WHERE jugador_id=OLD.jugador_id;
  UPDATE suizamente_private.suizamente_valoraciones SET jugador_id=anonymous WHERE jugador_id=OLD.jugador_id;
  UPDATE suizamente_private.suizamente_denuncias SET denunciante=anonymous WHERE denunciante=OLD.jugador_id;
  UPDATE suizamente_private.suizamente_reportes SET jugador_id=anonymous WHERE jugador_id=OLD.jugador_id;
  DELETE FROM suizamente_private.suizamente_valoraciones WHERE propuesta_id IN(SELECT id FROM suizamente_private.suizamente_propuestas WHERE jugador_id=OLD.jugador_id AND estado='pendiente');
  DELETE FROM suizamente_private.suizamente_propuestas WHERE jugador_id=OLD.jugador_id AND estado='pendiente';
  DELETE FROM suizamente_private.suizamente_ranking_exclusiones WHERE jugador_id=OLD.jugador_id;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS suizamente_borrar_comunidad ON suizamente_private.suizamente_jugadores;
CREATE TRIGGER suizamente_borrar_comunidad BEFORE DELETE ON suizamente_private.suizamente_jugadores FOR EACH ROW EXECUTE FUNCTION suizamente_private.v7_borrar_comunidad();
DO $hooks$ DECLARE d text; BEGIN
  SELECT pg_get_functiondef('suizamente_private.v6_vincular(text,text)'::regprocedure) INTO d;
  IF d NOT LIKE '%v7_vincular(actor,guest_actor)%' THEN EXECUTE replace(d,'END $function$','  PERFORM suizamente_private.v7_vincular(actor,guest_actor);'||chr(10)||'END $function$'); END IF;
  SELECT pg_get_functiondef('suizamente_private.v2_api_base(text,jsonb,uuid,text)'::regprocedure) INTO d;
  d:=replace(d,'IF pl.bloqueado THEN','IF pl.bloqueado AND p_action NOT IN (''jugador'',''partida'',''partidas'',''inicio'',''votos_mios'',''votos_resumen'',''jugadores'',''guardar_jugador'',''borrar_jugador'') THEN');
  IF d NOT LIKE '%Elige otro apodo%' THEN
    d:=replace(d,'  IF p_action=''guardar_jugador'' THEN','  IF p_action=''guardar_jugador'' THEN'||chr(10)||'    IF pl.renombrar AND lower(btrim(body->>''apodo''))=lower(pl.apodo) THEN RAISE EXCEPTION ''SZV2:400:Elige otro apodo''; END IF;');
    d:=replace(d,'ON CONFLICT(jugador_id) DO UPDATE SET apodo=excluded.apodo,','ON CONFLICT(jugador_id) DO UPDATE SET renombrar=false,apodo=excluded.apodo,');
  END IF;
  EXECUTE d;
END $hooks$;
DO $$ DECLARE r record; expression text; BEGIN
  IF to_regclass('public.app_notifications') IS NOT NULL THEN
    SELECT pg_get_expr(conbin,conrelid) INTO expression FROM pg_constraint WHERE conrelid='public.app_notifications'::regclass AND conname='app_notifications_kind_check';
    IF expression IS NOT NULL AND position('suizamente_comunidad' IN expression)=0 THEN
      ALTER TABLE public.app_notifications DROP CONSTRAINT app_notifications_kind_check;
      EXECUTE 'ALTER TABLE public.app_notifications ADD CONSTRAINT app_notifications_kind_check CHECK(kind=''suizamente_comunidad'' OR ('||expression||'))';
    END IF;
  END IF;
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='suizamente_private' AND (tablename LIKE 'suizamente_%' OR tablename='admins') LOOP
    EXECUTE format('ALTER TABLE suizamente_private.%I ENABLE ROW LEVEL SECURITY',r.tablename);EXECUTE format('REVOKE ALL ON suizamente_private.%I FROM PUBLIC,anon,authenticated',r.tablename);
  END LOOP;
  FOR r IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='suizamente_private' AND (p.proname LIKE 'v7_%' OR p.proname IN('v6_api','v6_avances','v3_avances')) LOOP EXECUTE 'REVOKE ALL ON FUNCTION '||r.signature||' FROM PUBLIC,anon,authenticated'; END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
