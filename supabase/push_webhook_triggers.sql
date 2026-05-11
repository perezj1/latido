-- ================================================================
-- LATIDO.CH - Push notification webhook triggers
--
-- Alternativa al Dashboard > Database Webhooks.
-- Reemplaza:
--   PUSH_FUNCTION_URL          -> https://<PROJECT_REF>.supabase.co/functions/v1/latido_push_notification
--   PUSH_WEBHOOK_SECRET_VALUE  -> el mismo valor de PUSH_WEBHOOK_SECRET en Edge Function secrets
--
-- No lo ejecutes si ya tienes webhooks equivalentes creados en el Dashboard,
-- para evitar notificaciones duplicadas.
-- ================================================================

DO $$
DECLARE
  function_url TEXT := 'PUSH_FUNCTION_URL';
  webhook_secret TEXT := 'PUSH_WEBHOOK_SECRET_VALUE';
  headers JSONB;
BEGIN
  IF function_url = 'PUSH_FUNCTION_URL' OR webhook_secret = 'PUSH_WEBHOOK_SECRET_VALUE' THEN
    RAISE EXCEPTION 'Reemplaza PUSH_FUNCTION_URL y PUSH_WEBHOOK_SECRET_VALUE antes de ejecutar este archivo.';
  END IF;

  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-latido-webhook-secret', webhook_secret
  );

  IF to_regclass('public.messages') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS latido_push_messages_insert ON public.messages;
    EXECUTE format(
      'CREATE TRIGGER latido_push_messages_insert AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION supabase_functions.http_request(%L, %L, %L, %L, %L)',
      function_url, 'POST', headers::text, '{}'::text, '5000'
    );
  END IF;

  IF to_regclass('public.listings') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS latido_push_listings_insert_update ON public.listings;
    EXECUTE format(
      'CREATE TRIGGER latido_push_listings_insert_update AFTER INSERT OR UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION supabase_functions.http_request(%L, %L, %L, %L, %L)',
      function_url, 'POST', headers::text, '{}'::text, '5000'
    );
  END IF;

  IF to_regclass('public.ads') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS latido_push_ads_insert_update ON public.ads;
    EXECUTE format(
      'CREATE TRIGGER latido_push_ads_insert_update AFTER INSERT OR UPDATE ON public.ads FOR EACH ROW EXECUTE FUNCTION supabase_functions.http_request(%L, %L, %L, %L, %L)',
      function_url, 'POST', headers::text, '{}'::text, '5000'
    );
  END IF;

  IF to_regclass('public.jobs') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS latido_push_jobs_insert_update ON public.jobs;
    EXECUTE format(
      'CREATE TRIGGER latido_push_jobs_insert_update AFTER INSERT OR UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION supabase_functions.http_request(%L, %L, %L, %L, %L)',
      function_url, 'POST', headers::text, '{}'::text, '5000'
    );
  END IF;

  IF to_regclass('public.providers') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS latido_push_providers_insert_update ON public.providers;
    EXECUTE format(
      'CREATE TRIGGER latido_push_providers_insert_update AFTER INSERT OR UPDATE ON public.providers FOR EACH ROW EXECUTE FUNCTION supabase_functions.http_request(%L, %L, %L, %L, %L)',
      function_url, 'POST', headers::text, '{}'::text, '5000'
    );
  END IF;

  IF to_regclass('public.events') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS latido_push_events_insert_update ON public.events;
    EXECUTE format(
      'CREATE TRIGGER latido_push_events_insert_update AFTER INSERT OR UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION supabase_functions.http_request(%L, %L, %L, %L, %L)',
      function_url, 'POST', headers::text, '{}'::text, '5000'
    );
  END IF;
END $$;

-- Diagnóstico de llamadas webhook:
-- SELECT * FROM net._http_response ORDER BY created DESC LIMIT 20;
