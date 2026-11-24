-- Apply after v11. Durable league table and unattended daily/weekly progression.
BEGIN;
DO $$ DECLARE r record;BEGIN
 IF to_regclass('suizamente_private.suizamente_ligas') IS NULL THEN
  ALTER TABLE suizamente_private.suizamente_liga_miembros RENAME TO suizamente_ligas;
 END IF;
 -- Preserve the existing rows and their foreign keys; update the engine in place.
 FOR r IN SELECT pg_get_functiondef(p.oid) definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='suizamente_private' AND p.prokind='f'
  AND pg_get_functiondef(p.oid) LIKE '%suizamente_private.suizamente_liga_miembros%' LOOP
  EXECUTE replace(r.definition,'suizamente_private.suizamente_liga_miembros','suizamente_private.suizamente_ligas');
 END LOOP;
END $$;
CREATE OR REPLACE VIEW suizamente_private.suizamente_liga_miembros WITH (security_invoker=true) AS SELECT * FROM suizamente_private.suizamente_ligas;
ALTER TABLE suizamente_private.suizamente_ligas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON suizamente_private.suizamente_ligas,suizamente_private.suizamente_liga_miembros FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION suizamente_private.v12_liga_aviso(actor text,w date,previous_division text,next_division text,amount integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE label text;old_index integer;new_index integer;inserted integer;
BEGIN
 SELECT value->>'nombre',i INTO label,new_index FROM suizamente_private.suizamente_liga_semanas,
  LATERAL jsonb_array_elements(reglas->'divisiones') WITH ORDINALITY d(value,i) WHERE semana=w AND value->>'id'=next_division;
 SELECT i INTO old_index FROM suizamente_private.suizamente_liga_semanas,
  LATERAL jsonb_array_elements(reglas->'divisiones') WITH ORDINALITY d(value,i) WHERE semana=w AND value->>'id'=previous_division;
 PERFORM suizamente_private.v7_notificar(actor,'liga',w::text,
  CASE WHEN new_index>old_index THEN '⬆️ ¡Subes a la '||label||'!'
   WHEN new_index<old_index THEN '⬇️ Bajas a la '||label
   ELSE '🏆 Te quedas en la '||label END||CASE WHEN amount>0 THEN ' · 🪙 +'||amount ELSE '' END,'/suizamente/ranking?tab=liga');
 IF next_division='cumbre' THEN
  INSERT INTO suizamente_private.suizamente_logros(jugador_id,logro) VALUES(actor,'cumbre') ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted=ROW_COUNT;
  IF inserted>0 THEN PERFORM suizamente_private.v7_notificar(actor,'logro','cumbre','🏅 Logro nuevo: Cumbre','/suizamente/logros');END IF;
 END IF;
END $$;
DO $$ DECLARE definition text;old_notice text:=$old$PERFORM suizamente_private.v7_notificar(r->>'id','liga',s.semana::text,
        CASE WHEN r->>'division'=r->>'destino' THEN '🏆 Te quedas en ' ELSE '🏆 Tu nueva liga: ' END||(r->>'destino')||' · 🪙 +'||amount,'/suizamente/ranking');$old$;
BEGIN
 SELECT pg_get_functiondef('suizamente_private.v10_ligas_actualizar(timestamptz)'::regprocedure) INTO definition;
 IF position(old_notice IN definition)>0 THEN
  EXECUTE replace(definition,old_notice,'PERFORM suizamente_private.v12_liga_aviso(r->>''id'',s.semana,r->>''division'',r->>''destino'',amount);');
 ELSIF position('v12_liga_aviso' IN definition)=0 THEN RAISE EXCEPTION 'Unexpected league engine; review weekly notification hook';END IF;
END $$;

CREATE OR REPLACE FUNCTION suizamente_private.v12_misiones_preparar(actor text,day date) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE diff text;
BEGIN
 PERFORM 1 FROM suizamente_private.suizamente_jugadores WHERE jugador_id=actor FOR UPDATE;
 IF NOT FOUND THEN RETURN;END IF;
 INSERT INTO suizamente_private.suizamente_misiones_dias VALUES(actor,day,0) ON CONFLICT DO NOTHING;
 FOREACH diff IN ARRAY ARRAY['facil','media','dificil'] LOOP
  IF NOT EXISTS(SELECT 1 FROM suizamente_private.suizamente_misiones WHERE jugador_id=actor AND fecha=day AND dificultad=diff) THEN
   PERFORM suizamente_private.v11_mision_elegir(actor,day,diff);
  END IF;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v11_misiones_preparar(actor text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT suizamente_private.v12_misiones_preparar(actor,suizamente_private.v7_hoy())
$$;
CREATE OR REPLACE FUNCTION suizamente_private.v12_tick(t timestamptz DEFAULT clock_timestamp()) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE day date:=suizamente_private.v7_hoy(t);actor text;prepared integer:=0;
BEGIN
 -- API and cron take the weekly lock before any player lock, including at midnight.
 PERFORM pg_advisory_xact_lock(7217840);
 PERFORM suizamente_private.v10_ligas_actualizar(t);
 FOR actor IN SELECT j.jugador_id FROM suizamente_private.suizamente_jugadores j WHERE NOT j.bloqueado AND NOT EXISTS(
  SELECT 1 FROM suizamente_private.suizamente_misiones_dias d WHERE d.jugador_id=j.jugador_id AND d.fecha=day) ORDER BY j.jugador_id LOOP
  PERFORM suizamente_private.v12_misiones_preparar(actor,day);prepared:=prepared+1;
 END LOOP;
 RETURN jsonb_build_object('fecha',day,'perfilesPreparados',prepared,'semana',date_trunc('week',t AT TIME ZONE 'Europe/Zurich')::date);
END $$;
DO $$ BEGIN
 IF to_regprocedure('suizamente_private.v12_api_base(text,jsonb,uuid,text)') IS NULL THEN
  ALTER FUNCTION public.suizamente_v2(text,jsonb,uuid,text) SET SCHEMA suizamente_private;
  ALTER FUNCTION suizamente_private.suizamente_v2(text,jsonb,uuid,text) RENAME TO v12_api_base;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.suizamente_v2(p_action text,p_args jsonb DEFAULT '{}',p_guest_id uuid DEFAULT NULL,p_guest_token text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NOT NULL THEN PERFORM suizamente_private.v10_ligas_actualizar();END IF;
 IF p_action='cambiar_mision' AND p_args ? 'fecha' AND p_args->>'fecha' IS DISTINCT FROM suizamente_private.v7_hoy()::text THEN
  RAISE EXCEPTION 'SZV2:409:Las misiones de hoy han cambiado. Actualízalas';
 END IF;
 result:=suizamente_private.v12_api_base(p_action,p_args,p_guest_id,p_guest_token);
 IF p_action IN('misiones','cambiar_mision') THEN
  result:=result||jsonb_build_object('evento',suizamente_private.v10_activo(),
   'renuevaEn',((result->>'fecha')::date+1)::timestamp AT TIME ZONE 'Europe/Zurich','servidorAhora',clock_timestamp());
 END IF;
 RETURN result;
END $$;
DO $$ DECLARE r record;BEGIN
 FOR r IN SELECT p.oid::regprocedure sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='suizamente_private' AND (p.proname LIKE 'v12_%' OR p.proname='v11_misiones_preparar') LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION '||r.sig||' FROM PUBLIC,anon,authenticated';
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
