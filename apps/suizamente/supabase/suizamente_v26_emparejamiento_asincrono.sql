-- Real account opponents may be offline. Preserve games, limits and turn rules.
BEGIN;
CREATE OR REPLACE FUNCTION suizamente_private.v26_rivales(actor text)
RETURNS TABLE(jugador_id text,partidas bigint,diferencia integer,online boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH cfg AS MATERIALIZED(SELECT suizamente_private.v2_config() c),
 abiertas AS MATERIALIZED(
  SELECT m.jugador_a AS jugador FROM suizamente_private.suizamente_partidas m WHERE m.estado IN('buscando','jugando')
  UNION ALL
  SELECT m.jugador_b FROM suizamente_private.suizamente_partidas m WHERE m.estado IN('buscando','jugando') AND m.jugador_b IS NOT NULL
 ),cargas AS(SELECT jugador,count(*) n FROM abiertas GROUP BY jugador)
 SELECT j.jugador_id,coalesce(cargas.n,0),abs(suizamente_private.v2_nivel(j.xp)-suizamente_private.v2_nivel(yo.xp)),
  coalesce(j.ultimo_visto_en>clock_timestamp()-make_interval(secs=>(cfg.c#>>'{comunidad,presenciaSegundos}')::integer),false)
 FROM suizamente_private.suizamente_jugadores j
 JOIN suizamente_private.suizamente_jugadores yo ON yo.jugador_id=actor
 CROSS JOIN cfg LEFT JOIN cargas ON cargas.jugador=j.jugador_id
 WHERE j.jugador_id<>actor AND j.usuario_id IS NOT NULL AND NOT j.bloqueado AND NOT j.renombrar
 AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=j.usuario_id AND p.banned)
 AND coalesce(cargas.n,0)<(cfg.c#>>'{partida,partidasAbiertasMax}')::integer
 AND NOT EXISTS(SELECT 1 FROM suizamente_private.suizamente_partidas m
  WHERE m.estado IN('buscando','jugando') AND actor IN(m.jugador_a,m.jugador_b) AND j.jugador_id IN(m.jugador_a,m.jugador_b))
$$;
DO $$ DECLARE definition text;needle text:='SELECT r INTO rival FROM suizamente_private.v13_rivales(actor) r ORDER BY random() LIMIT 1;';BEGIN
 SELECT pg_get_functiondef('suizamente_private.v2_api_base(text,jsonb,uuid,text)'::regprocedure) INTO definition;
 IF position('v26_rivales(actor)' IN definition)=0 THEN
  IF position(needle IN definition)=0 THEN RAISE EXCEPTION 'Unexpected matchmaking engine; migration not applied';END IF;
  EXECUTE replace(definition,needle,'SELECT r.jugador_id INTO rival FROM suizamente_private.v26_rivales(actor) r ORDER BY r.partidas,random() LIMIT 1;');
 END IF;
 IF to_regprocedure('suizamente_private.v26_api_base(text,jsonb,uuid,text)') IS NULL THEN
  ALTER FUNCTION public.suizamente_v2(text,jsonb,uuid,text) SET SCHEMA suizamente_private;
  ALTER FUNCTION suizamente_private.suizamente_v2(text,jsonb,uuid,text) RENAME TO v26_api_base;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.suizamente_v2(p_action text,p_args jsonb DEFAULT '{}',p_guest_id uuid DEFAULT NULL,p_guest_token text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor text;data jsonb;c jsonb;target text;available boolean;people jsonb;
BEGIN
 -- Acquire matchmaking coordination before any per-account/player-row lock.
 -- The base engine takes the same transaction lock again before choosing.
 IF p_action='crear_partida' AND auth.uid() IS NOT NULL THEN PERFORM pg_advisory_xact_lock(72819423);END IF;
 IF p_action<>'emparejamiento' THEN
  data:=suizamente_private.v26_api_base(p_action,p_args,p_guest_id,p_guest_token);
  IF p_action='config' THEN data:=data||jsonb_build_object('apiVersion',26);END IF;
  RETURN data;
 END IF;
 data:=suizamente_private.v26_api_base('jugador','{}',p_guest_id,p_guest_token);
 actor:=suizamente_private.v2_identidad(p_guest_id,p_guest_token);
 IF data->'jugador' IS NULL OR data->'jugador'='null'::jsonb THEN RAISE EXCEPTION 'SZV2:409:Crea tu perfil para jugar';END IF;
 c:=suizamente_private.v2_config();
 available:=(SELECT count(*) FROM suizamente_private.suizamente_partidas m WHERE actor IN(m.jugador_a,m.jugador_b) AND m.estado IN('buscando','jugando'))<(c#>>'{partida,partidasAbiertasMax}')::integer;
 IF available THEN
  SELECT r.jugador_id INTO target FROM suizamente_private.v26_rivales(actor) r
   WHERE r.online AND r.diferencia<=(c#>>'{partida,rivalAlAzar,margenNivel}')::integer
   ORDER BY r.diferencia,r.partidas,random() LIMIT 1;
  available:=EXISTS(SELECT 1 FROM suizamente_private.v26_rivales(actor));
 END IF;
 people:=CASE WHEN target IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(suizamente_private.v7_persona(target)) END;
 RETURN jsonb_build_object('disponible',available,'jugadores',people,'asincrono',true,'servidorAhora',clock_timestamp(),
  'avatares',CASE WHEN target IS NULL THEN '{}'::jsonb ELSE jsonb_build_object(target,suizamente_private.v18_foto(target)) END);
END $$;
REVOKE ALL ON FUNCTION suizamente_private.v26_rivales(text),suizamente_private.v26_api_base(text,jsonb,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
