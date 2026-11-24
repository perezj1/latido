-- Apply after v9. Administration of weekend events and durable weekly league groups.
BEGIN;
DO $$ BEGIN
  IF NOT (suizamente_private.v2_config()#>'{eventosFinDeSemana}') ? 'efectos' THEN
    RAISE EXCEPTION 'Apply the current suizamente_v2_datos.sql before v10 (event effect defaults)';
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_eventos (
  viernes date PRIMARY KEY CHECK(extract(isodow FROM viernes)=5),
  tipo text NOT NULL CHECK(tipo IN ('categoria','cartas','sellos','obras')), categoria text,
  version integer NOT NULL DEFAULT 1, automatico boolean NOT NULL DEFAULT false,
  admin_id uuid NOT NULL, actualizado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK((tipo='categoria')=(categoria IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_liga_estado (
  jugador_id text PRIMARY KEY REFERENCES suizamente_private.suizamente_jugadores ON DELETE CASCADE,
  division text NOT NULL DEFAULT 'pradera'
);
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_liga_semanas (
  semana date PRIMARY KEY CHECK(extract(isodow FROM semana)=1), reglas jsonb NOT NULL,
  cerrada boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_liga_miembros (
  semana date NOT NULL REFERENCES suizamente_private.suizamente_liga_semanas,
  jugador_id text NOT NULL REFERENCES suizamente_private.suizamente_jugadores ON DELETE CASCADE,
  division text NOT NULL, grupo integer NOT NULL, puesto_final integer, destino text,
  PRIMARY KEY(semana,jugador_id)
);
CREATE INDEX IF NOT EXISTS suizamente_liga_grupo ON suizamente_private.suizamente_liga_miembros(semana,division,grupo);

-- Always read the saved economy, independently of temporary event effects.
CREATE OR REPLACE FUNCTION suizamente_private.v10_config_base() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT suizamente_private.v9_merge('{"comunidad":{"propuestasPorDia":3,"denunciasPorDia":5,"libretaMax":500,"presenciaSegundos":300,"preguntaMax":140,"opcionMax":90,"datoMax":300,"diasSinRepetir":365}}'::jsonb||juego,economia_override)
  FROM suizamente_private.suizamente_configuracion WHERE id=true
$$;
CREATE OR REPLACE FUNCTION suizamente_private.v10_evento(d date,c jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE cfg jsonb:=coalesce(c,suizamente_private.v10_config_base()); fri date:=date_trunc('week',d)::date+4;
  e suizamente_private.suizamente_eventos; k integer; cat text; kind text; item jsonb; category jsonb; automatic boolean; effect text;
BEGIN
  SELECT * INTO e FROM suizamente_private.suizamente_eventos WHERE viernes=fri;
  automatic:=NOT FOUND OR e.automatico;
  -- Stable rotation from the first Friday of 2026; no dependence on deploy time.
  k:=floor((fri-date '2026-01-02')/7.0)::integer;
  kind:=CASE WHEN NOT automatic THEN e.tipo ELSE cfg#>>ARRAY['eventosFinDeSemana','tipos',(((k%4)+4)%4)::text,'id'] END;
  cat:=CASE WHEN kind='categoria' THEN CASE WHEN NOT automatic THEN e.categoria ELSE cfg#>>ARRAY['categorias',(((floor(k/4.0)::integer%6)+6)%6)::text,'id'] END END;
  SELECT value INTO item FROM jsonb_array_elements(cfg#>'{eventosFinDeSemana,tipos}') WHERE value->>'id'=kind;
  SELECT value INTO category FROM jsonb_array_elements(cfg->'categorias') WHERE value->>'id'=cat;
  effect:=CASE kind
    WHEN 'categoria' THEN replace(item->>'efecto','×2','×'||(cfg#>>'{eventosFinDeSemana,efectos,categoria,multiplicadorMonedas}'))
    WHEN 'cartas' THEN replace(item->>'efecto','4',cfg#>>'{eventosFinDeSemana,efectos,cartas,cartasPorSobre}')
    WHEN 'obras' THEN replace(item->>'efecto','25',to_char(100*(1-(cfg#>>'{eventosFinDeSemana,efectos,obras,multiplicadorCoste}')::numeric),'FM990'))
    WHEN 'sellos' THEN CASE WHEN cfg#>>'{eventosFinDeSemana,efectos,sellos,pesoSello}'='2' THEN item->>'efecto' ELSE 'La casilla 🛂 tiene peso ×'||(cfg#>>'{eventosFinDeSemana,efectos,sellos,pesoSello}') END
    ELSE item->>'efecto' END;
  RETURN jsonb_build_object('viernes',fri,'tipo',kind,'categoria',cat,'automatico',automatic,'version',coalesce(e.version,0),
    'titulo',replace(item->>'texto','{categoria}',coalesce(category->>'nombre','')),'efecto',effect,
    'inicio',(fri+time '18:00') AT TIME ZONE (cfg->>'zonaHoraria'),
    'fin',((fri+3)::timestamp) AT TIME ZONE (cfg->>'zonaHoraria'));
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v10_activo(t timestamptz DEFAULT clock_timestamp()) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE c jsonb:=suizamente_private.v10_config_base(); e jsonb;
BEGIN
  e:=suizamente_private.v10_evento((t AT TIME ZONE (c->>'zonaHoraria'))::date,c);
  IF t>=(e->>'inicio')::timestamptz AND t<(e->>'fin')::timestamptz THEN RETURN e; END IF;
  RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v10_config_evento(c jsonb,t timestamptz DEFAULT clock_timestamp()) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE e jsonb:=suizamente_private.v10_activo(t); regions jsonb;
BEGIN
  IF e->>'tipo'='cartas' THEN c:=jsonb_set(c,'{album,cartasPorSobre}',c#>'{eventosFinDeSemana,efectos,cartas,cartasPorSobre}');
  ELSIF e->>'tipo'='obras' THEN
    SELECT jsonb_agg(r||jsonb_build_object('cantones',(SELECT jsonb_agg(k||jsonb_build_object('costes',
      (SELECT jsonb_agg(round((v#>>'{}')::numeric*(c#>>'{eventosFinDeSemana,efectos,obras,multiplicadorCoste}')::numeric) ORDER BY n) FROM jsonb_array_elements(k->'costes') WITH ORDINALITY a(v,n))) ORDER BY i)
      FROM jsonb_array_elements(r->'cantones') WITH ORDINALITY a(k,i))) ORDER BY pos) INTO regions
      FROM jsonb_array_elements(c#>'{mapa,regiones}') WITH ORDINALITY a(r,pos);
    c:=jsonb_set(c,'{mapa,regiones}',regions);
  END IF;
  RETURN c;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v2_config() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT CASE WHEN current_setting('suizamente.eventos',true)='on' THEN suizamente_private.v10_config_evento(c) ELSE c END
  FROM (SELECT suizamente_private.v10_config_base() c) s
$$;

-- Roulette weights are evaluated when spinning, so a started match cannot retain an expired event.
CREATE OR REPLACE FUNCTION suizamente_private.v10_ruleta(c jsonb) RETURNS text
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$
  SELECT value#>>'{}' FROM jsonb_array_elements(c#>'{ruleta,casillas}')
  ORDER BY -ln(1-random())/CASE WHEN value='"sello"'::jsonb AND suizamente_private.v10_activo()->>'tipo'='sellos'
    THEN (suizamente_private.v10_config_base()#>>'{eventosFinDeSemana,efectos,sellos,pesoSello}')::integer ELSE 1 END LIMIT 1
$$;
DO $$ DECLARE definition text; old_line text:='SELECT value#>>''{}'' INTO category FROM jsonb_array_elements(m.reglas#>''{ruleta,casillas}'') ORDER BY random() LIMIT 1;'; BEGIN
  SELECT pg_get_functiondef('suizamente_private.v2_api_base(text,jsonb,uuid,text)'::regprocedure) INTO definition;
  IF strpos(definition,old_line)>0 THEN
    EXECUTE replace(definition,old_line,'category:=suizamente_private.v10_ruleta(m.reglas);');
  ELSIF strpos(definition,'v10_ruleta')=0 THEN RAISE EXCEPTION 'Unexpected roulette implementation; review the event hook'; END IF;
END $$;
DO $$ BEGIN
  IF to_regprocedure('suizamente_private.v10_respuesta_base(uuid,integer)') IS NULL THEN
    ALTER FUNCTION suizamente_private.v3_respuesta(uuid,integer) RENAME TO v10_respuesta_base;
  END IF;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v3_respuesta(mid uuid,nq integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q suizamente_private.suizamente_partida_preguntas; e jsonb; amount integer;
BEGIN
  PERFORM suizamente_private.v10_respuesta_base(mid,nq);
  SELECT * INTO q FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=mid AND n=nq;
  e:=suizamente_private.v10_activo(q.respondida_en);
  IF q.acierto AND NOT q.omitida AND e->>'tipo'='categoria' AND e->>'categoria'=q.categoria THEN
    SELECT monedas INTO amount FROM suizamente_private.suizamente_movimientos WHERE jugador_id=q.jugador_id
      AND motivo IN ('acierto','sello_ganado') AND ref=mid::text||':'||nq;
    IF suizamente_private.v3_anotar(q.jugador_id,'evento_categoria',mid::text||':'||nq,round(coalesce(amount,0)*((suizamente_private.v10_config_base()#>>'{eventosFinDeSemana,efectos,categoria,multiplicadorMonedas}')::numeric-1))::integer) THEN
      UPDATE suizamente_private.suizamente_movimientos SET detalle=jsonb_build_object('multiplicador',suizamente_private.v10_config_base()#>'{eventosFinDeSemana,efectos,categoria,multiplicadorMonedas}')
        WHERE jugador_id=q.jugador_id AND motivo='evento_categoria' AND ref=mid::text||':'||nq;
    END IF;
  END IF;
END $$;

-- Points come from the unique reward ledger, never from votes or client-supplied totals.
CREATE OR REPLACE FUNCTION suizamente_private.v10_liga_filas(w date) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  WITH scores AS (
    SELECT m.*,j.apodo,j.bloqueado OR j.excluido_ranking OR EXISTS(SELECT 1 FROM suizamente_private.suizamente_ranking_exclusiones x WHERE x.jugador_id=m.jugador_id AND x.semana=w) excluido,
      coalesce((SELECT sum(CASE l.motivo WHEN 'partida_ganada' THEN (s.reglas#>>'{puntos,partidaGanada}')::integer ELSE (s.reglas#>>'{puntos,selloGanado}')::integer END)
        FROM suizamente_private.suizamente_movimientos l WHERE l.jugador_id=m.jugador_id AND l.motivo IN ('partida_ganada','sello_ganado','duelo_sello')
        AND l.creado_en>=w::timestamp AT TIME ZONE 'Europe/Zurich' AND l.creado_en<(w+7)::timestamp AT TIME ZONE 'Europe/Zurich'),0) puntos,
      (SELECT max(l.creado_en) FROM suizamente_private.suizamente_movimientos l WHERE l.jugador_id=m.jugador_id AND l.motivo IN ('partida_ganada','sello_ganado','duelo_sello')
        AND l.creado_en>=w::timestamp AT TIME ZONE 'Europe/Zurich' AND l.creado_en<(w+7)::timestamp AT TIME ZONE 'Europe/Zurich') alcanzado,
      s.reglas,s.cerrada
    FROM suizamente_private.suizamente_liga_miembros m JOIN suizamente_private.suizamente_liga_semanas s USING(semana)
      JOIN suizamente_private.suizamente_jugadores j USING(jugador_id) WHERE m.semana=w
  ), ranked AS (
    SELECT *,row_number() OVER(PARTITION BY division,grupo ORDER BY excluido,puntos DESC,alcanzado NULLS LAST,jugador_id) puesto,
      count(*) OVER(PARTITION BY division,grupo) miembros FROM scores
  ) SELECT coalesce(jsonb_agg(jsonb_build_object('id',jugador_id,'apodo',apodo,'division',division,'grupo',grupo,'puntos',puntos,'excluido',excluido,
    'puesto',coalesce(puesto_final,puesto),'destino',CASE WHEN cerrada THEN destino ELSE
      CASE WHEN excluido THEN division
        WHEN puesto<=(reglas->>'suben')::integer AND division<>reglas#>>'{divisiones,3,id}' THEN
          (SELECT reglas#>>ARRAY['divisiones',(i+1)::text,'id'] FROM generate_series(0,2) i WHERE reglas#>>ARRAY['divisiones',i::text,'id']=division)
        WHEN puesto>greatest((reglas->>'suben')::integer,miembros-(reglas->>'bajan')::integer) AND division<>reglas#>>'{divisiones,0,id}' THEN
          (SELECT reglas#>>ARRAY['divisiones',(i-1)::text,'id'] FROM generate_series(1,3) i WHERE reglas#>>ARRAY['divisiones',i::text,'id']=division)
        ELSE division END END) ORDER BY division,grupo,puesto),'[]') FROM ranked
$$;
CREATE OR REPLACE FUNCTION suizamente_private.v10_ligas_actualizar(t timestamptz DEFAULT clock_timestamp()) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE current_week date:=date_trunc('week',t AT TIME ZONE 'Europe/Zurich')::date; s record; r jsonb; reward jsonb; factor numeric; amount integer;
BEGIN
  IF EXISTS(SELECT 1 FROM suizamente_private.suizamente_liga_semanas WHERE semana=current_week)
    AND NOT EXISTS(SELECT 1 FROM suizamente_private.suizamente_liga_semanas WHERE semana<current_week AND NOT cerrada) THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(7217840);
  FOR s IN SELECT * FROM suizamente_private.suizamente_liga_semanas WHERE semana<current_week AND NOT cerrada ORDER BY semana LOOP
    FOR r IN SELECT value FROM jsonb_array_elements(suizamente_private.v10_liga_filas(s.semana)) LOOP
      UPDATE suizamente_private.suizamente_liga_miembros SET puesto_final=(r->>'puesto')::integer,destino=r->>'destino'
        WHERE semana=s.semana AND jugador_id=r->>'id';
      INSERT INTO suizamente_private.suizamente_liga_estado VALUES(r->>'id',r->>'destino') ON CONFLICT(jugador_id) DO UPDATE SET division=excluded.division;
      SELECT value INTO reward FROM jsonb_array_elements(s.reglas->'premiosDomingo') WHERE (r->>'puesto')::integer BETWEEN (value->>'desde')::integer AND (value->>'hasta')::integer;
      SELECT (value->>'multiplicadorPremio')::numeric INTO factor FROM jsonb_array_elements(s.reglas->'divisiones') WHERE value->>'id'=r->>'division';
      IF NOT (r->>'excluido')::boolean AND EXISTS(SELECT 1 FROM suizamente_private.suizamente_movimientos WHERE jugador_id=r->>'id'
        AND motivo IN ('partida_ganada','partida_perdida') AND creado_en>=s.semana::timestamp AT TIME ZONE 'Europe/Zurich' AND creado_en<(s.semana+7)::timestamp AT TIME ZONE 'Europe/Zurich') THEN
        amount:=round((reward->>'monedas')::numeric*factor)::integer;
        PERFORM suizamente_private.v3_anotar(r->>'id','liga',s.semana::text,amount,0,jsonb_build_object('sobres',round((reward->>'sobres')::numeric*factor)::integer));
      ELSE amount:=0; END IF;
      PERFORM suizamente_private.v7_notificar(r->>'id','liga',s.semana::text,
        CASE WHEN r->>'division'=r->>'destino' THEN '🏆 Te quedas en ' ELSE '🏆 Tu nueva liga: ' END||(r->>'destino')||' · 🪙 +'||amount,'/suizamente/ranking');
      IF r->>'destino'='cumbre' THEN INSERT INTO suizamente_private.suizamente_logros(jugador_id,logro) VALUES(r->>'id','cumbre') ON CONFLICT DO NOTHING; END IF;
    END LOOP;
    UPDATE suizamente_private.suizamente_liga_semanas SET cerrada=true WHERE semana=s.semana;
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM suizamente_private.suizamente_liga_semanas WHERE semana=current_week) THEN
    INSERT INTO suizamente_private.suizamente_liga_semanas VALUES(current_week,suizamente_private.v10_config_base()->'ligas',false);
    INSERT INTO suizamente_private.suizamente_liga_miembros(semana,jugador_id,division,grupo)
      SELECT current_week,jugador_id,division,1+((row_number() OVER(PARTITION BY division ORDER BY md5(current_week::text||jugador_id),jugador_id)-1)
        /((suizamente_private.v10_config_base()#>>'{ligas,tamanoGrupo}')::integer))::integer
      FROM (SELECT j.jugador_id,coalesce(e.division,'pradera') division FROM suizamente_private.suizamente_jugadores j
        LEFT JOIN suizamente_private.suizamente_liga_estado e USING(jugador_id)
        WHERE j.usuario_id IS NOT NULL AND NOT j.bloqueado AND NOT j.excluido_ranking AND EXISTS(
          SELECT 1 FROM suizamente_private.suizamente_movimientos l WHERE l.jugador_id=j.jugador_id AND l.motivo IN('acierto','sello_ganado','partida_ganada','partida_perdida','duelo_sello')
          AND l.creado_en>=(current_week-7)::timestamp AT TIME ZONE 'Europe/Zurich' AND l.creado_en<current_week::timestamp AT TIME ZONE 'Europe/Zurich')
          OR (j.usuario_id IS NOT NULL AND NOT j.bloqueado AND NOT j.excluido_ranking AND EXISTS(SELECT 1 FROM suizamente_private.suizamente_partida_preguntas q
            WHERE q.jugador_id=j.jugador_id AND NOT q.omitida AND q.respondida_en>=(current_week-7)::timestamp AT TIME ZONE 'Europe/Zurich' AND q.respondida_en<current_week::timestamp AT TIME ZONE 'Europe/Zurich'))) eligible;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION suizamente_private.v10_admin(actor uuid,body jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE route text:=body->>'ruta'; method text:=coalesce(body->>'metodo','GET'); section text:=split_part(route,'/',1);
  object_id text:=split_part(route,'/',2); w date; e jsonb; before_data jsonb; result jsonb; c jsonb:=suizamente_private.v10_config_base();
BEGIN
  IF NOT suizamente_private.v7_admin() THEN RAISE EXCEPTION 'SZV2:403:Solo administración de Latido'; END IF;
  IF section='eventos' THEN
    IF method IN ('PUT','DELETE') AND object_id<>'' THEN
      BEGIN w:=object_id::date; EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RAISE EXCEPTION 'SZV2:400:Fecha no válida'; END;
      IF extract(isodow FROM w)<>5 THEN RAISE EXCEPTION 'SZV2:400:Elige un viernes'; END IF;
      PERFORM pg_advisory_xact_lock(7217841);
      before_data:=suizamente_private.v10_evento(w,c);
      IF (before_data->>'inicio')::timestamptz<=clock_timestamp() THEN RAISE EXCEPTION 'SZV2:409:El evento ya ha empezado'; END IF;
      IF (body->>'version')::integer IS DISTINCT FROM (before_data->>'version')::integer THEN RAISE EXCEPTION 'SZV2:409:El evento ha cambiado. Recarga antes de guardar'; END IF;
      IF method='DELETE' THEN UPDATE suizamente_private.suizamente_eventos SET automatico=true,version=version+1,admin_id=actor,actualizado_en=clock_timestamp() WHERE viernes=w;
      ELSE
        IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(c#>'{eventosFinDeSemana,tipos}') WHERE value->>'id'=body->>'tipo')
          OR (body->>'tipo'='categoria' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(c->'categorias') WHERE value->>'id'=body->>'categoria'))
          THEN RAISE EXCEPTION 'SZV2:400:Revisa el tipo y la categoría'; END IF;
        INSERT INTO suizamente_private.suizamente_eventos(viernes,tipo,categoria,version,admin_id)
          VALUES(w,body->>'tipo',CASE WHEN body->>'tipo'='categoria' THEN body->>'categoria' END,(before_data->>'version')::integer+1,actor)
          ON CONFLICT(viernes) DO UPDATE SET tipo=excluded.tipo,categoria=excluded.categoria,version=excluded.version,automatico=false,admin_id=actor,actualizado_en=clock_timestamp();
      END IF;
      result:=suizamente_private.v10_evento(w,c);
    ELSIF method='GET' AND object_id='' THEN
      BEGIN w:=coalesce(nullif(body->>'desde','')::date,(clock_timestamp() AT TIME ZONE (c->>'zonaHoraria'))::date);
        EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RAISE EXCEPTION 'SZV2:400:Fecha no válida'; END;
      result:=jsonb_build_object('filas',(SELECT jsonb_agg(suizamente_private.v10_evento(w+i*7,c) ORDER BY i) FROM generate_series(0,7) i),
        'tipos',c#>'{eventosFinDeSemana,tipos}','categorias',c->'categorias');
    ELSE RAISE EXCEPTION 'SZV2:404:Acción no disponible'; END IF;
  ELSIF section='ligas' AND method='GET' AND object_id='' THEN
    BEGIN w:=coalesce(nullif(body->>'semana','')::date,suizamente_private.v7_semana());
      EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RAISE EXCEPTION 'SZV2:400:Fecha no válida'; END;
    IF extract(isodow FROM w)<>1 OR w>suizamente_private.v7_semana() THEN RAISE EXCEPTION 'SZV2:400:Elige una semana actual o pasada desde el lunes'; END IF;
    PERFORM suizamente_private.v10_ligas_actualizar();
    result:=jsonb_build_object('semana',w,'cerrada',coalesce((SELECT cerrada FROM suizamente_private.suizamente_liga_semanas WHERE semana=w),false),
      'divisiones',coalesce((SELECT reglas->'divisiones' FROM suizamente_private.suizamente_liga_semanas WHERE semana=w),c#>'{ligas,divisiones}'),
      'filas',suizamente_private.v10_liga_filas(w));
  ELSE
    IF section='economia' AND method='PUT' AND ((body#>>'{juego,ligas,tamanoGrupo}')::integer<1
      OR (body#>>'{juego,ligas,suben}')::integer+(body#>>'{juego,ligas,bajan}')::integer>(body#>>'{juego,ligas,tamanoGrupo}')::integer
      OR (body#>>'{juego,ligas,puntos,partidaGanada}')::integer<1 OR (body#>>'{juego,ligas,puntos,selloGanado}')::integer<1
      OR (body#>>'{juego,eventosFinDeSemana,efectos,categoria,multiplicadorMonedas}')::numeric<1
      OR (body#>>'{juego,eventosFinDeSemana,efectos,cartas,cartasPorSobre}')::integer<1
      OR (body#>>'{juego,eventosFinDeSemana,efectos,sellos,pesoSello}')::integer<1
      OR (body#>>'{juego,eventosFinDeSemana,efectos,obras,multiplicadorCoste}')::numeric NOT BETWEEN 0 AND 1)
      THEN RAISE EXCEPTION 'SZV2:400:Revisa el tamaño, ascensos, descensos y puntos de las ligas'; END IF;
    RETURN suizamente_private.v9_accion(actor,body);
  END IF;
  INSERT INTO suizamente_private.suizamente_admin_registro(admin_id,accion,objeto,detalle)
    VALUES(actor,method||':'||section,route,jsonb_build_object('antes',before_data,'despues',CASE WHEN method<>'GET' THEN result END));
  RETURN result;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v10_sin_contactos(value jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  IF jsonb_typeof(value)='object' THEN SELECT coalesce(jsonb_object_agg(key,suizamente_private.v10_sin_contactos(v)),'{}') INTO result FROM jsonb_each(value) a(key,v) WHERE key NOT IN ('email','correo','telefono','phone');
  ELSIF jsonb_typeof(value)='array' THEN SELECT coalesce(jsonb_agg(suizamente_private.v10_sin_contactos(v) ORDER BY n),'[]') INTO result FROM jsonb_array_elements(value) WITH ORDINALITY a(v,n);
  ELSIF jsonb_typeof(value)='string' THEN result:=to_jsonb(regexp_replace(value#>>'{}','[[:alnum:]_.+%\-]+@[[:alnum:].\-]+\.[[:alpha:]]{2,}','[contacto oculto]','gi'));
  ELSE result:=value; END IF;
  RETURN result;
END $$;
DO $$ BEGIN
  IF to_regprocedure('suizamente_private.v10_api_base(text,jsonb,uuid,text)') IS NULL THEN
    ALTER FUNCTION public.suizamente_v2(text,jsonb,uuid,text) SET SCHEMA suizamente_private;
    ALTER FUNCTION suizamente_private.suizamente_v2(text,jsonb,uuid,text) RENAME TO v10_api_base;
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.suizamente_v2(p_action text,p_args jsonb DEFAULT '{}',p_guest_id uuid DEFAULT NULL,p_guest_token text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; actor text; previous_setting text:=coalesce(current_setting('suizamente.eventos',true),'off');
BEGIN
  IF p_action='admin' THEN
    IF NOT suizamente_private.v7_admin() THEN RAISE EXCEPTION 'SZV2:403:Solo administración de Latido'; END IF;
    IF jsonb_typeof(coalesce(p_args,'{}'))<>'object' OR octet_length(p_args::text)>150000 THEN RAISE EXCEPTION 'SZV2:400:Solicitud no válida'; END IF;
    RETURN suizamente_private.v10_sin_contactos(suizamente_private.v10_admin(auth.uid(),p_args));
  END IF;
  IF auth.uid() IS NOT NULL THEN PERFORM suizamente_private.v10_ligas_actualizar(); END IF;
  PERFORM set_config('suizamente.eventos','on',true);
  result:=suizamente_private.v10_api_base(p_action,p_args,p_guest_id,p_guest_token);
  PERFORM set_config('suizamente.eventos',previous_setting,true);
  IF jsonb_typeof(result)='object' THEN
    result:=result||jsonb_build_object('evento',suizamente_private.v10_activo());
    IF result->'resultado' IS NOT NULL AND result->'resultado'<>'null'::jsonb THEN
      actor:=coalesce(auth.uid()::text,result->>'identidad');
      IF EXISTS(SELECT 1 FROM suizamente_private.suizamente_movimientos WHERE jugador_id=actor AND motivo='evento_categoria' AND ref=result->>'id'||':'||(result#>>'{resultado,n}')) THEN
        result:=jsonb_set(result,'{resultado,evento}',to_jsonb('🎉 ×'||(SELECT detalle->>'multiplicador' FROM suizamente_private.suizamente_movimientos WHERE jugador_id=actor AND motivo='evento_categoria' AND ref=result->>'id'||':'||(result#>>'{resultado,n}'))));
        result:=jsonb_set(result,'{resultado,ganado,monedas}',to_jsonb((result#>>'{resultado,ganado,monedas}')::integer+
          (SELECT monedas FROM suizamente_private.suizamente_movimientos WHERE jugador_id=actor AND motivo='evento_categoria' AND ref=result->>'id'||':'||(result#>>'{resultado,n}'))));
      END IF;
    END IF;
  END IF;
  RETURN result;
END $$;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='suizamente_private' AND tablename IN('suizamente_eventos','suizamente_liga_estado','suizamente_liga_semanas','suizamente_liga_miembros') LOOP
    EXECUTE format('ALTER TABLE suizamente_private.%I ENABLE ROW LEVEL SECURITY',r.tablename);
    EXECUTE format('REVOKE ALL ON suizamente_private.%I FROM PUBLIC,anon,authenticated',r.tablename);
  END LOOP;
  FOR r IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='suizamente_private' AND (p.proname LIKE 'v10_%' OR p.proname='v3_respuesta' OR p.proname='v2_config') LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION '||r.signature||' FROM PUBLIC,anon,authenticated';
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
