-- Phase 3. Apply after v2 + v2_datos. Repeatable; never changes the reference bank.
BEGIN;
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_inventario(
  jugador_id text NOT NULL REFERENCES suizamente_private.suizamente_jugadores(jugador_id) ON DELETE CASCADE,
  articulo text NOT NULL,cantidad integer NOT NULL DEFAULT 0 CHECK(cantidad>=0),PRIMARY KEY(jugador_id,articulo)
);
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_logros(
  jugador_id text NOT NULL REFERENCES suizamente_private.suizamente_jugadores(jugador_id) ON DELETE CASCADE,
  logro text NOT NULL,conseguido_en timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(jugador_id,logro)
);
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_actividad_dias(
  jugador_id text NOT NULL REFERENCES suizamente_private.suizamente_jugadores(jugador_id) ON DELETE CASCADE,
  fecha date NOT NULL,PRIMARY KEY(jugador_id,fecha)
);
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_novedades(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,jugador_id text NOT NULL REFERENCES suizamente_private.suizamente_jugadores(jugador_id) ON DELETE CASCADE,
  tipo text NOT NULL,ref text NOT NULL,datos jsonb NOT NULL,leida boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(jugador_id,tipo,ref)
);
ALTER TABLE suizamente_private.suizamente_partida_preguntas ADD COLUMN IF NOT EXISTS omitida boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION suizamente_private.v3_sincronizar(actor text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  INSERT INTO suizamente_private.suizamente_inventario(jugador_id,articulo,cantidad)
    SELECT actor,e.key,greatest(0,sum((e.value#>>'{}')::integer))::integer
    FROM suizamente_private.suizamente_movimientos m CROSS JOIN LATERAL jsonb_each(m.inventario) e
    WHERE m.jugador_id=actor AND jsonb_typeof(e.value)='number' GROUP BY e.key
    ON CONFLICT(jugador_id,articulo) DO UPDATE SET cantidad=excluded.cantidad;
  UPDATE suizamente_private.suizamente_jugadores SET inventario=coalesce((SELECT jsonb_object_agg(articulo,cantidad)
    FROM suizamente_private.suizamente_inventario WHERE jugador_id=actor),'{}') WHERE jugador_id=actor;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v3_anotar(actor text,reason text,reference text,coins integer DEFAULT 0,points integer DEFAULT 0,items jsonb DEFAULT '{}') RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE pl suizamente_private.suizamente_jugadores; n integer; before_level integer; after_level integer; r record;
BEGIN
  SELECT * INTO pl FROM suizamente_private.suizamente_jugadores WHERE jugador_id=actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SZV2:404:Jugador no encontrado'; END IF;
  IF EXISTS(SELECT 1 FROM suizamente_private.suizamente_movimientos WHERE jugador_id=actor AND motivo=reason AND ref=reference) THEN RETURN false; END IF;
  IF pl.monedas+coins<0 THEN RAISE EXCEPTION 'SZV2:402:Te faltan 🪙 %',-(pl.monedas+coins); END IF;
  IF points<0 THEN RAISE EXCEPTION 'SZV2:400:La XP nunca baja'; END IF;
  PERFORM suizamente_private.v3_sincronizar(actor);
  FOR r IN SELECT key,value FROM jsonb_each_text(items) LOOP
    IF coalesce((SELECT cantidad FROM suizamente_private.suizamente_inventario WHERE jugador_id=actor AND articulo=r.key),0)+r.value::integer<0 THEN
      RAISE EXCEPTION 'SZV2:409:No tienes ese artículo';
    END IF;
  END LOOP;
  INSERT INTO suizamente_private.suizamente_movimientos(jugador_id,motivo,ref,monedas,xp,inventario)
    VALUES(actor,reason,reference,coins,points,items) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n=0 THEN RETURN false; END IF;
  before_level:=suizamente_private.v2_nivel(pl.xp);
  UPDATE suizamente_private.suizamente_jugadores SET monedas=monedas+coins,xp=xp+points,actualizado_en=clock_timestamp() WHERE jugador_id=actor;
  PERFORM suizamente_private.v3_sincronizar(actor);
  after_level:=suizamente_private.v2_nivel(pl.xp+points);
  IF after_level>before_level THEN
    INSERT INTO suizamente_private.suizamente_novedades(jugador_id,tipo,ref,datos)
      SELECT actor,'nivel',i::text,jsonb_build_object('texto','⭐ ¡Nivel '||i||'!','nivel',i) FROM generate_series(before_level+1,after_level) i ON CONFLICT DO NOTHING;
  END IF;
  RETURN true;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v3_actividad(actor text,momento timestamptz) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  INSERT INTO suizamente_private.suizamente_actividad_dias VALUES(actor,(momento AT TIME ZONE (suizamente_private.v2_config()->>'zonaHoraria'))::date) ON CONFLICT DO NOTHING
$$;
CREATE OR REPLACE FUNCTION suizamente_private.v3_racha(actor text,hoy date DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE d date; total integer:=0; today date:=coalesce(hoy,(clock_timestamp() AT TIME ZONE (suizamente_private.v2_config()->>'zonaHoraria'))::date);
BEGIN
  SELECT max(fecha) INTO d FROM suizamente_private.suizamente_actividad_dias WHERE jugador_id=actor AND fecha<=today;
  IF d IS NULL OR d<today-1 THEN RETURN 0; END IF;
  WHILE EXISTS(SELECT 1 FROM suizamente_private.suizamente_actividad_dias WHERE jugador_id=actor AND fecha=d) LOOP total:=total+1;d:=d-1; END LOOP;
  RETURN total;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v3_progreso(x integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer:=suizamente_private.v2_nivel(x); c jsonb:=suizamente_private.v2_config(); base integer;
BEGIN
  base:=((c#>>'{niveles,a}')::integer*(n-1)*n/2)+(c#>>'{niveles,b}')::integer*(n-1);
  RETURN jsonb_build_object('nivel',n,'xpNivel',x-base,'xpNecesaria',(c#>>'{niveles,a}')::integer*n+(c#>>'{niveles,b}')::integer);
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v3_avances(actor text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE progress jsonb; wins integer; games integer; r record; cat text; cnt integer;
BEGIN
  SELECT count(*),count(*) FILTER(WHERE ganador=actor) INTO games,wins FROM suizamente_private.suizamente_partidas WHERE actor IN(jugador_a,jugador_b);
  progress:=jsonb_build_object('llegada',games,'permiso_b',wins,'permiso_c',wins,'pasaporte',wins,
    'constancia',suizamente_private.v3_racha(actor),'duelista',0,'suiza_entera',0,'coleccionista',0,'autoria',0,'muralla',0);
  FOR r IN SELECT * FROM (VALUES('idioma','poliglota'),('cultura','folclore'),('comida','gourmet'),('papeles','papeleo'),('casa','vecindad'),('dia','puntualidad')) AS c(category,achievement) LOOP
    SELECT count(*) INTO cnt FROM suizamente_private.suizamente_partida_preguntas WHERE jugador_id=actor AND categoria=r.category AND acierto AND NOT omitida;
    progress:=progress||jsonb_build_object(r.achievement,cnt);
  END LOOP;
  IF to_regclass('suizamente_private.suizamente_duelos_sello') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM suizamente_private.suizamente_duelos_sello WHERE ganador=$1 AND estado=''terminado''' INTO cnt USING actor;
    progress:=progress||jsonb_build_object('duelista',cnt);
  END IF;
  RETURN progress;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v3_logros(actor text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a jsonb; progress jsonb:=suizamente_private.v3_avances(actor); n integer;
BEGIN
  FOR a IN SELECT value FROM jsonb_array_elements(suizamente_private.v2_config()->'logros')
    WHERE value->>'id' NOT IN ('suiza_oro','cumbre','misiones') LOOP
    IF coalesce((progress->>(a->>'id'))::integer,0)>=(a->>'meta')::integer THEN
      INSERT INTO suizamente_private.suizamente_logros(jugador_id,logro) VALUES(actor,a->>'id') ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS n=ROW_COUNT;
      IF n>0 THEN INSERT INTO suizamente_private.suizamente_novedades(jugador_id,tipo,ref,datos)
        VALUES(actor,'logro',a->>'id',jsonb_build_object('texto','🏅 Logro nuevo: '||(a->>'nombre'),'logro',a->>'id')) ON CONFLICT DO NOTHING; END IF;
    END IF;
  END LOOP;
  RETURN coalesce((SELECT jsonb_agg(a.value||jsonb_build_object('avance',least((a.value->>'meta')::integer,coalesce((progress->>(a.value->>'id'))::integer,0)),
      'conseguido',l.logro IS NOT NULL,'conseguidoEn',l.conseguido_en) ORDER BY a.ord)
    FROM jsonb_array_elements(suizamente_private.v2_config()->'logros') WITH ORDINALITY a(value,ord)
    LEFT JOIN suizamente_private.suizamente_logros l ON l.jugador_id=actor AND l.logro=a.value->>'id'
    WHERE a.value->>'id' NOT IN ('suiza_oro','cumbre','misiones')),'[]');
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v3_respuesta(mid uuid,nq integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q suizamente_private.suizamente_partida_preguntas; reward jsonb; c jsonb; reason text;
BEGIN
  SELECT * INTO q FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=mid AND n=nq;
  SELECT reglas INTO c FROM suizamente_private.suizamente_partidas WHERE id=mid;
  IF q.respondida_en IS NULL OR q.omitida THEN RETURN; END IF;
  IF q.opcion IS NOT NULL THEN PERFORM suizamente_private.v3_actividad(q.jugador_id,q.respondida_en); END IF;
  IF q.acierto THEN
    reason:=CASE WHEN q.modo='sello' THEN 'sello_ganado' ELSE 'acierto' END;
    reward:=c->'recompensas'->CASE WHEN q.modo='sello' THEN 'selloConPregunta' ELSE 'acierto' END;
    PERFORM suizamente_private.v3_anotar(q.jugador_id,reason,mid::text||':'||nq,(reward->>'monedas')::integer,(reward->>'xp')::integer);
  END IF;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v3_final(mid uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m suizamente_private.suizamente_partidas; loser text; reward jsonb;
BEGIN
  SELECT * INTO m FROM suizamente_private.suizamente_partidas WHERE id=mid;
  IF m.terminada_en IS NULL OR m.ganador IS NULL THEN RETURN; END IF;
  reward:=m.reglas#>'{recompensas,partidaGanada}';
  PERFORM suizamente_private.v3_anotar(m.ganador,'partida_ganada',mid::text,(reward->>'monedas')::integer,(reward->>'xp')::integer);
  loser:=CASE WHEN m.ganador=m.jugador_a THEN m.jugador_b ELSE m.jugador_a END;
  IF loser IS NOT NULL AND m.motivo_fin NOT IN ('rendicion','plazo') THEN
    reward:=m.reglas#>'{recompensas,partidaPerdida}';
    PERFORM suizamente_private.v3_anotar(loser,'partida_perdida',mid::text,(reward->>'monedas')::integer,(reward->>'xp')::integer);
  END IF;
  PERFORM suizamente_private.v3_logros(m.jugador_a);
  IF m.jugador_b IS NOT NULL THEN PERFORM suizamente_private.v3_logros(m.jugador_b); END IF;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v3_perfil(actor text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cats jsonb; total integer; won integer; lost integer; abandoned integer; specialties jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(s ORDER BY s.pct DESC,s.categoria),'[]') INTO cats FROM(
    SELECT categoria,count(*) respuestas,count(*) FILTER(WHERE acierto) aciertos,round(100.0*count(*) FILTER(WHERE acierto)/count(*)) pct
    FROM suizamente_private.suizamente_partida_preguntas WHERE jugador_id=actor AND respondida_en IS NOT NULL AND NOT omitida GROUP BY categoria) s;
  SELECT count(*) INTO total FROM suizamente_private.suizamente_partida_preguntas WHERE jugador_id=actor AND acierto AND NOT omitida;
  SELECT count(*) FILTER(WHERE ganador=actor),
    count(*) FILTER(WHERE ganador IS NOT NULL AND ganador<>actor AND NOT(motivo_fin IN ('rendicion','plazo'))),
    count(*) FILTER(WHERE ganador IS DISTINCT FROM actor AND motivo_fin IN ('rendicion','plazo'))
    INTO won,lost,abandoned FROM suizamente_private.suizamente_partidas WHERE actor IN(jugador_a,jugador_b) AND terminada_en IS NOT NULL;
  SELECT jsonb_agg(value ORDER BY (value->>'pct')::numeric DESC,value->>'categoria') INTO specialties FROM jsonb_array_elements(cats)
    WHERE (value->>'respuestas')::integer>=(suizamente_private.v2_config()->>'minimoVotosParaPorcentajes')::integer;
  RETURN jsonb_build_object('aciertos',total,'ganadas',won,'perdidas',lost,'abandonadas',abandoned,'categorias',cats,
    'especialidad',CASE WHEN jsonb_array_length(specialties)>=2 THEN specialties->0 ELSE NULL END,
    'cuesta',CASE WHEN jsonb_array_length(specialties)>=2 THEN specialties->(jsonb_array_length(specialties)-1) ELSE NULL END,'logros',suizamente_private.v3_logros(actor));
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v3_enriquecer(data jsonb,actor text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE pl suizamente_private.suizamente_jugadores; view jsonb:=data; detail jsonb; ids jsonb; event_ref text;
BEGIN
  IF jsonb_typeof(data)<>'object' THEN RETURN data; END IF;
  SELECT * INTO pl FROM suizamente_private.suizamente_jugadores WHERE jugador_id=actor;
  IF NOT FOUND THEN RETURN data; END IF;
  PERFORM suizamente_private.v3_sincronizar(actor);
  PERFORM suizamente_private.v3_logros(actor);
  SELECT * INTO pl FROM suizamente_private.suizamente_jugadores WHERE jugador_id=actor;
  view:=view||jsonb_build_object('jugador',(to_jsonb(pl)-'usuario_id'-'bloqueado')||suizamente_private.v3_progreso(pl.xp)||jsonb_build_object('racha',suizamente_private.v3_racha(actor)),
    'novedades',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'tipo',tipo,'datos',datos) ORDER BY id) FROM suizamente_private.suizamente_novedades WHERE jugador_id=actor AND NOT leida),'[]'));
  IF data->'resultado' IS NOT NULL AND data->'resultado'<>'null'::jsonb THEN
    event_ref:=data->>'id'||':'||(data#>>'{resultado,n}');
    view:=jsonb_set(view,'{resultado,ganado}',(SELECT jsonb_build_object('monedas',coalesce(sum(monedas),0),'xp',coalesce(sum(xp),0))
      FROM suizamente_private.suizamente_movimientos WHERE jugador_id=actor AND motivo IN ('acierto','sello_ganado') AND suizamente_movimientos.ref=event_ref));
  END IF;
  IF data->>'fase'='terminada' THEN view:=view||jsonb_build_object('premio',(SELECT jsonb_build_object('monedas',coalesce(sum(monedas),0),'xp',coalesce(sum(xp),0))
    FROM suizamente_private.suizamente_movimientos WHERE jugador_id=actor AND motivo IN ('partida_ganada','partida_perdida') AND suizamente_movimientos.ref=data->>'id')); END IF;
  RETURN view;
END $$;

-- Run inside the existing, authenticated guest merge before deleting the guest.
CREATE OR REPLACE FUNCTION suizamente_private.v3_vincular(actor text,guest_actor text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE deficit boolean; before_level integer; after_level integer;
BEGIN
  IF (SELECT coalesce(sum(monedas),0) FROM suizamente_private.suizamente_movimientos WHERE jugador_id=actor)<0 THEN
    RAISE EXCEPTION 'SZV2:409:El regalo de bienvenida es único. Consigue más monedas antes de vincular el invitado';
  END IF;
  SELECT EXISTS(SELECT 1 FROM suizamente_private.suizamente_movimientos m CROSS JOIN LATERAL jsonb_each(m.inventario) e
    WHERE m.jugador_id=actor AND jsonb_typeof(e.value)='number' GROUP BY e.key HAVING sum((e.value#>>'{}')::integer)<0) INTO deficit;
  IF deficit THEN RAISE EXCEPTION 'SZV2:409:El regalo de bienvenida es único. Consigue los comodines gastados antes de vincular el invitado'; END IF;
  IF (SELECT coalesce(sum((m.inventario->>'escudos')::integer),0) FROM suizamente_private.suizamente_movimientos m WHERE m.jugador_id=actor)
      >(suizamente_private.v2_config()#>>'{escudos,max}')::integer THEN
    RAISE EXCEPTION 'SZV2:409:Usa algún escudo antes de vincular: superarías el máximo del inventario';
  END IF;
  SELECT suizamente_private.v2_nivel(xp) INTO before_level FROM suizamente_private.suizamente_jugadores WHERE jugador_id=actor;
  SELECT suizamente_private.v2_nivel(coalesce(sum(xp),0)::integer) INTO after_level FROM suizamente_private.suizamente_movimientos WHERE jugador_id=actor;
  INSERT INTO suizamente_private.suizamente_novedades(jugador_id,tipo,ref,datos)
    SELECT actor,'nivel',i::text,jsonb_build_object('texto','⭐ ¡Nivel '||i||'!','nivel',i) FROM generate_series(before_level+1,after_level) i ON CONFLICT DO NOTHING;
  INSERT INTO suizamente_private.suizamente_actividad_dias SELECT actor,fecha FROM suizamente_private.suizamente_actividad_dias WHERE jugador_id=guest_actor ON CONFLICT DO NOTHING;
  INSERT INTO suizamente_private.suizamente_logros SELECT actor,logro,conseguido_en FROM suizamente_private.suizamente_logros WHERE jugador_id=guest_actor
    ON CONFLICT(jugador_id,logro) DO UPDATE SET conseguido_en=least(suizamente_logros.conseguido_en,excluded.conseguido_en);
  INSERT INTO suizamente_private.suizamente_novedades(jugador_id,tipo,ref,datos,leida,creado_en)
    SELECT actor,tipo,ref,datos,leida,creado_en FROM suizamente_private.suizamente_novedades WHERE jugador_id=guest_actor ON CONFLICT DO NOTHING;
  IF to_regclass('suizamente_private.suizamente_duelos_sello') IS NOT NULL THEN
    EXECUTE 'UPDATE suizamente_private.suizamente_duelos_sello SET retador=CASE WHEN retador=$2 THEN $1 ELSE retador END,
      defensor=CASE WHEN defensor=$2 THEN $1 ELSE defensor END,ganador=CASE WHEN ganador=$2 THEN $1 ELSE ganador END WHERE retador=$2 OR defensor=$2' USING actor,guest_actor;
    EXECUTE 'UPDATE suizamente_private.suizamente_movimientos a SET detalle=g.detalle FROM suizamente_private.suizamente_movimientos g
      WHERE a.jugador_id=$1 AND g.jugador_id=$2 AND a.motivo=g.motivo AND a.ref=g.ref AND a.detalle=''{}''::jsonb' USING actor,guest_actor;
  END IF;
END $$;

-- Preserve the checked original dispatcher as an implementation detail.
DO $$ BEGIN
  IF to_regprocedure('suizamente_private.v2_api_base(text,jsonb,uuid,text)') IS NULL THEN
    ALTER FUNCTION public.suizamente_v2(text,jsonb,uuid,text) SET SCHEMA suizamente_private;
    ALTER FUNCTION suizamente_private.suizamente_v2(text,jsonb,uuid,text) RENAME TO v2_api_base;
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.suizamente_v2(p_action text,p_args jsonb DEFAULT '{}',p_guest_id uuid DEFAULT NULL,p_guest_token text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE data jsonb; identity jsonb; actor text; custom jsonb;
BEGIN
  IF jsonb_typeof(coalesce(p_args,'{}'))<>'object' OR octet_length(coalesce(p_args,'{}')::text)>10000 THEN RAISE EXCEPTION 'SZV2:400:Solicitud no válida'; END IF;
  IF p_action IN ('perfil','logros','novedades_leer','tienda','comprar','regalo','comodin','duelo','pregunta') THEN
    identity:=suizamente_private.v2_api_base('jugador','{}',p_guest_id,p_guest_token);
    actor:=identity->>'identidad';
    IF identity->'jugador'='null'::jsonb THEN RAISE EXCEPTION 'SZV2:404:Crea primero tu perfil'; END IF;
    IF p_action='perfil' THEN data:=suizamente_private.v3_perfil(actor);
    ELSIF p_action='logros' THEN data:=jsonb_build_object('logros',suizamente_private.v3_logros(actor));
    ELSIF p_action='novedades_leer' THEN
      UPDATE suizamente_private.suizamente_novedades SET leida=true WHERE jugador_id=actor AND id IN(SELECT value::bigint FROM jsonb_array_elements_text(p_args->'ids'));
      data:=jsonb_build_object('leidas',true);
    ELSIF to_regprocedure('suizamente_private.v4_accion(text,text,jsonb)') IS NOT NULL THEN
      data:=suizamente_private.v4_accion(p_action,actor,p_args);
    END IF;
  END IF;
  IF data IS NULL THEN data:=suizamente_private.v2_api_base(p_action,p_args,p_guest_id,p_guest_token); END IF;
  actor:=coalesce(actor,CASE WHEN auth.uid() IS NOT NULL THEN auth.uid()::text ELSE 'invitado-'||p_guest_id::text END);
  IF to_regprocedure('suizamente_private.v4_enriquecer(jsonb,text)') IS NOT NULL THEN data:=suizamente_private.v4_enriquecer(data,actor); END IF;
  RETURN suizamente_private.v3_enriquecer(data,actor);
END $$;

-- Install transactional hooks on an existing v2, without requiring its reinstall.
DO $hooks$ DECLARE definition text; BEGIN
  SELECT pg_get_functiondef('suizamente_private.v2_api_base(text,jsonb,uuid,text)'::regprocedure) INTO definition;
  IF definition NOT LIKE '%v3_vincular(actor,guest.jugador_id)%' THEN
    IF position('      UPDATE suizamente_private.suizamente_jugadores SET monedas=(SELECT' IN definition)=0 THEN RAISE EXCEPTION 'Vinculación v2 no compatible'; END IF;
    EXECUTE replace(definition,'      UPDATE suizamente_private.suizamente_jugadores SET monedas=(SELECT',
      '      PERFORM suizamente_private.v3_vincular(actor,guest.jugador_id);'||chr(10)||'      UPDATE suizamente_private.suizamente_jugadores SET monedas=(SELECT');
  END IF;
  SELECT pg_get_functiondef('suizamente_private.v2_responder(uuid,text,integer,integer,boolean)'::regprocedure) INTO definition;
  IF definition NOT LIKE '%v3_respuesta(mid,nq)%' THEN
    IF position('  threshold:=' IN definition)=0 THEN RAISE EXCEPTION 'Motor v2 no compatible'; END IF;
    EXECUTE replace(definition,'  threshold:=','  PERFORM suizamente_private.v3_respuesta(mid,nq);'||chr(10)||'  threshold:=');
  END IF;
  SELECT pg_get_functiondef('suizamente_private.v2_cerrar(uuid,text,text)'::regprocedure) INTO definition;
  IF definition NOT LIKE '%v3_final(mid)%' THEN
    IF position('WHERE id=mid;' IN definition)=0 THEN RAISE EXCEPTION 'Cierre v2 no compatible'; END IF;
    EXECUTE replace(definition,'WHERE id=mid;','WHERE id=mid;'||chr(10)||'  SELECT suizamente_private.v3_final(mid);');
  END IF;
END $hooks$;

-- Existing v2 activity/rewards are imported once, using the same event references.
DO $backfill$ DECLARE r record; BEGIN
  FOR r IN SELECT partida_id,n FROM suizamente_private.suizamente_partida_preguntas WHERE respondida_en IS NOT NULL AND NOT omitida ORDER BY respondida_en LOOP
    PERFORM suizamente_private.v3_respuesta(r.partida_id,r.n);
  END LOOP;
  FOR r IN SELECT id FROM suizamente_private.suizamente_partidas WHERE terminada_en IS NOT NULL ORDER BY terminada_en LOOP PERFORM suizamente_private.v3_final(r.id); END LOOP;
  FOR r IN SELECT jugador_id FROM suizamente_private.suizamente_jugadores LOOP PERFORM suizamente_private.v3_sincronizar(r.jugador_id); END LOOP;
END $backfill$;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='suizamente_private' AND tablename LIKE 'suizamente_%' LOOP
    EXECUTE format('ALTER TABLE suizamente_private.%I ENABLE ROW LEVEL SECURITY',r.tablename);
    EXECUTE format('REVOKE ALL ON suizamente_private.%I FROM PUBLIC,anon,authenticated',r.tablename);
  END LOOP;
  FOR r IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='suizamente_private' AND (p.proname LIKE 'v3_%' OR p.proname='v2_api_base') LOOP EXECUTE 'REVOKE ALL ON FUNCTION '||r.signature||' FROM PUBLIC,anon,authenticated'; END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
