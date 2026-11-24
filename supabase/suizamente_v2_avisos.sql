-- Optional operational activation. Apply after the base + data migrations.
-- Reuses an existing authenticated Latido push webhook without exposing its secret.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('suizamente-turnos','*/5 * * * *','SELECT suizamente_private.v2_tick()');
DO $$
DECLARE args text[]; function_url text; headers jsonb;
BEGIN
  IF to_regclass('public.app_notifications') IS NULL THEN RETURN; END IF;
  IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.app_notifications'::regclass
    AND NOT tgisinternal AND pg_get_triggerdef(oid) ILIKE '%latido_push_notification%') THEN RETURN; END IF;
  SELECT string_to_array(encode(tgargs,'escape'),E'\\000') INTO args FROM pg_trigger
    WHERE NOT tgisinternal AND pg_get_triggerdef(oid) ILIKE '%supabase_functions.http_request%'
    AND pg_get_triggerdef(oid) ILIKE '%latido_push_notification%' ORDER BY oid LIMIT 1;
  IF coalesce(array_length(args,1),0)<3 THEN
    RAISE NOTICE 'Avisos internos activos. Para push, configura un webhook INSERT de app_notifications a latido_push_notification con el secreto existente de Latido.';
    RETURN;
  END IF;
  function_url:=args[1]; headers:=args[3]::jsonb;
  EXECUTE format('CREATE TRIGGER suizamente_push_insert AFTER INSERT ON public.app_notifications FOR EACH ROW EXECUTE FUNCTION supabase_functions.http_request(%L,%L,%L,%L,%L)',
    function_url,'POST',headers::text,'{}','5000');
END $$;
COMMIT;
