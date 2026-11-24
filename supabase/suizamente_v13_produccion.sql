-- Apply after v12_progreso.sql. Existing games, rewards and accounts are preserved.
BEGIN;
CREATE OR REPLACE FUNCTION suizamente_private.v13_rivales(actor text) RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT j.jugador_id FROM suizamente_private.suizamente_jugadores j
 JOIN suizamente_private.suizamente_jugadores yo ON yo.jugador_id=actor
 CROSS JOIN LATERAL (SELECT suizamente_private.v2_config() c) cfg
 WHERE j.jugador_id<>actor AND j.usuario_id IS NOT NULL AND NOT j.bloqueado AND NOT j.renombrar
 AND j.ultimo_visto_en>clock_timestamp()-make_interval(secs=>(c#>>'{comunidad,presenciaSegundos}')::integer)
 AND abs(suizamente_private.v2_nivel(j.xp)-suizamente_private.v2_nivel(yo.xp))<=(c#>>'{partida,rivalAlAzar,margenNivel}')::integer
 AND (SELECT count(*) FROM suizamente_private.suizamente_partidas m WHERE j.jugador_id IN(m.jugador_a,m.jugador_b) AND m.estado IN('buscando','jugando'))<(c#>>'{partida,partidasAbiertasMax}')::integer
 AND NOT EXISTS(SELECT 1 FROM suizamente_private.suizamente_partidas m WHERE actor IN(m.jugador_a,m.jugador_b) AND j.jugador_id IN(m.jugador_a,m.jugador_b) AND m.estado IN('buscando','jugando'))
$$;
-- Change the installed base engine, including installations that already have v2.
DO $$ DECLARE definition text;start_at integer;end_at integer;replacement text:=$code$
      IF rival='azar' THEN
        PERFORM pg_advisory_xact_lock(72819423);
        SELECT r INTO rival FROM suizamente_private.v13_rivales(actor) r ORDER BY random() LIMIT 1;
        IF rival IS NULL THEN RAISE EXCEPTION 'SZV2:409:Ahora no hay rivales disponibles. Invita a alguien o vuelve en un momento'; END IF;
$code$;
BEGIN
 SELECT pg_get_functiondef('suizamente_private.v2_api_base(text,jsonb,uuid,text)'::regprocedure) INTO definition;
 IF position('v13_rivales(actor)' IN definition)=0 THEN
  start_at:=position('      IF rival=''azar'' THEN' IN definition);
  end_at:=position('      ELSE' IN substr(definition,start_at));
  IF start_at=0 OR end_at=0 OR position('rival:=NULL;' IN substr(definition,start_at,end_at))=0 THEN RAISE EXCEPTION 'Unexpected matchmaking engine; migration not applied';END IF;
  EXECUTE substr(definition,1,start_at-1)||replacement||substr(definition,start_at+end_at-1);
 END IF;
 SELECT pg_get_functiondef('suizamente_private.v2_ver(uuid,text)'::regprocedure) INTO definition;
 IF position('''teToca'',m.turno=actor' IN definition)>0 THEN
  EXECUTE replace(definition,'''teToca'',m.turno=actor','''teToca'',m.jugador_b IS NOT NULL AND m.turno=actor');
 END IF;
 IF to_regprocedure('suizamente_private.v13_api_base(text,jsonb,uuid,text)') IS NULL THEN
  ALTER FUNCTION public.suizamente_v2(text,jsonb,uuid,text) SET SCHEMA suizamente_private;
  ALTER FUNCTION suizamente_private.suizamente_v2(text,jsonb,uuid,text) RENAME TO v13_api_base;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.suizamente_v2(p_action text,p_args jsonb DEFAULT '{}',p_guest_id uuid DEFAULT NULL,p_guest_token text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor text;result jsonb;available jsonb;
BEGIN
 IF p_action='emparejamiento' THEN
  result:=suizamente_private.v13_api_base('jugador','{}',p_guest_id,p_guest_token);
  actor:=suizamente_private.v2_identidad(p_guest_id,p_guest_token);
  IF result->'jugador' IS NULL OR result->'jugador'='null'::jsonb THEN RAISE EXCEPTION 'SZV2:409:Crea tu perfil para jugar';END IF;
  SELECT coalesce(jsonb_agg(suizamente_private.v7_persona(r)),'[]') INTO available FROM (SELECT r FROM suizamente_private.v13_rivales(actor) r ORDER BY r LIMIT 20) candidates;
  RETURN jsonb_build_object('disponible',jsonb_array_length(available)>0 AND (SELECT count(*) FROM suizamente_private.suizamente_partidas m WHERE actor IN(m.jugador_a,m.jugador_b) AND m.estado IN('buscando','jugando'))<(suizamente_private.v2_config()#>>'{partida,partidasAbiertasMax}')::integer,'jugadores',available,'servidorAhora',clock_timestamp());
 END IF;
 IF p_action IN('girar','pregunta','respuesta','comodin','duelo') THEN
  actor:=suizamente_private.v2_identidad(p_guest_id,p_guest_token);
  IF EXISTS(SELECT 1 FROM suizamente_private.suizamente_partidas WHERE id=(p_args->>'id')::uuid AND actor IN(jugador_a,jugador_b) AND jugador_b IS NULL) THEN
   RAISE EXCEPTION 'SZV2:409:Esta partida espera rival. Inicia otra con alguien disponible o acepta una invitación';
  END IF;
 END IF;
 result:=suizamente_private.v13_api_base(p_action,p_args,p_guest_id,p_guest_token);
 IF p_action='config' THEN result:=result||jsonb_build_object('apiVersion',13);END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION suizamente_private.v13_rivales(text),suizamente_private.v13_api_base(text,jsonb,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
