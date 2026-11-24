-- Game notifications and browser subscriptions no longer enter Latido's inbox.
BEGIN;
CREATE TABLE IF NOT EXISTS public.suizamente_notificaciones(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN('suizamente_turno','suizamente_plazo','suizamente_asalto','suizamente_comunidad')),
 source_id text NOT NULL,data jsonb NOT NULL DEFAULT '{}',read_at timestamptz,seen_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),enviada_en timestamptz,UNIQUE(recipient_id,kind,source_id)
);
CREATE TABLE IF NOT EXISTS public.suizamente_push_subscriptions(
 endpoint text PRIMARY KEY CHECK(endpoint LIKE 'https://%'),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 p256dh text NOT NULL,auth text NOT NULL,expiration_time timestamptz,origin text NOT NULL,user_agent text,
 enabled boolean NOT NULL DEFAULT true,last_seen_at timestamptz,updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS public.suizamente_push_preferences(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,messages_enabled boolean NOT NULL DEFAULT true,
 zone_enabled boolean NOT NULL DEFAULT false,canton text,categories text[] NOT NULL DEFAULT '{}',updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.suizamente_notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suizamente_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suizamente_push_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.suizamente_notificaciones,public.suizamente_push_subscriptions,public.suizamente_push_preferences FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.suizamente_notificaciones,public.suizamente_push_subscriptions,public.suizamente_push_preferences TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.suizamente_push_subscriptions,public.suizamente_push_preferences TO authenticated;
DROP POLICY IF EXISTS suizamente_push_owner ON public.suizamente_push_subscriptions;
CREATE POLICY suizamente_push_owner ON public.suizamente_push_subscriptions TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
DROP POLICY IF EXISTS suizamente_push_preferences_owner ON public.suizamente_push_preferences;
CREATE POLICY suizamente_push_preferences_owner ON public.suizamente_push_preferences TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
DO $$ BEGIN
 IF to_regclass('public.push_subscriptions') IS NOT NULL THEN
  INSERT INTO public.suizamente_push_subscriptions(endpoint,user_id,p256dh,auth,expiration_time,origin,user_agent,enabled,last_seen_at,updated_at)
   SELECT endpoint,user_id,p256dh,auth,expiration_time,origin,user_agent,enabled,last_seen_at,updated_at FROM public.push_subscriptions WHERE origin='https://suizamente.latido.ch' ON CONFLICT DO NOTHING;
  DELETE FROM public.push_subscriptions WHERE origin='https://suizamente.latido.ch';
 END IF;
END $$;
DO $$ DECLARE r record;definition text;BEGIN
 FOR r IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='suizamente_private' AND p.proname ~ '^v[0-9]+_' AND position('public.app_notifications' IN p.prosrc)>0 LOOP
  SELECT pg_get_functiondef(r.oid) INTO definition;
  EXECUTE replace(definition,'public.app_notifications','public.suizamente_notificaciones');
 END LOOP;
END $$;
-- Move only game entries; never delete or change a Latido notification.
INSERT INTO public.suizamente_notificaciones(id,recipient_id,kind,source_id,data,read_at,seen_at,created_at)
 SELECT id,recipient_id,kind,source_id,data,read_at,nullif(to_jsonb(n)->>'seen_at','')::timestamptz,created_at FROM public.app_notifications n
 WHERE kind IN('suizamente_turno','suizamente_plazo','suizamente_asalto','suizamente_comunidad') ON CONFLICT DO NOTHING;
DELETE FROM public.app_notifications WHERE kind IN('suizamente_turno','suizamente_plazo','suizamente_asalto','suizamente_comunidad');
CREATE OR REPLACE FUNCTION public.suizamente_push_reclamar(p_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE public.suizamente_notificaciones SET enviada_en=clock_timestamp() WHERE id=p_id AND enviada_en IS NULL RETURNING to_jsonb(suizamente_notificaciones)
$$;
REVOKE ALL ON FUNCTION public.suizamente_push_reclamar(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.suizamente_push_reclamar(uuid) TO service_role;
DO $$ DECLARE args text[];endpoint text;headers jsonb;BEGIN
 IF to_regprocedure('supabase_functions.http_request()') IS NULL THEN RETURN;END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='suizamente_push_independiente' AND tgrelid='public.suizamente_notificaciones'::regclass) THEN RETURN;END IF;
 SELECT string_to_array(encode(tgargs,'escape'),E'\\000') INTO args FROM pg_trigger WHERE NOT tgisinternal AND pg_get_triggerdef(oid) ILIKE '%supabase_functions.http_request%' AND pg_get_triggerdef(oid) ILIKE '%latido_push_notification%' ORDER BY oid LIMIT 1;
 IF coalesce(array_length(args,1),0)<3 THEN RAISE NOTICE 'Configura el webhook de suizamente_notificaciones a suizamente-push con el secreto push existente';RETURN;END IF;
 endpoint:=regexp_replace(args[1],'/latido_push_notification/?$','/suizamente-push');headers:=args[3]::jsonb;
 EXECUTE format('CREATE TRIGGER suizamente_push_independiente AFTER INSERT ON public.suizamente_notificaciones FOR EACH ROW EXECUTE FUNCTION supabase_functions.http_request(%L,%L,%L,%L,%L)',endpoint,'POST',headers::text,'{}','5000');
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
