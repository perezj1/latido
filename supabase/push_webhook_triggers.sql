-- ================================================================
-- LATIDO.CH - Push notification webhook triggers
--
-- Alternativa al Dashboard > Database Webhooks.
-- Si ya existe un webhook hacia latido_push_notification, este archivo
-- reutiliza automaticamente su URL y secreto sin mostrarlos.
-- En una instalacion nueva reemplaza PUSH_WEBHOOK_SECRET_VALUE por el mismo
-- valor de PUSH_WEBHOOK_SECRET configurado en Edge Function secrets.
--
-- No lo ejecutes si ya tienes webhooks equivalentes creados en el Dashboard,
-- para evitar notificaciones duplicadas.
-- ================================================================

DO $$
DECLARE
  function_url TEXT := 'https://zmievixfjefjppofebbh.supabase.co/functions/v1/latido_push_notification';
  webhook_secret TEXT := 'PUSH_WEBHOOK_SECRET_VALUE';
  headers JSONB;
  source_args TEXT[];
BEGIN
  IF webhook_secret = 'PUSH_WEBHOOK_SECRET_VALUE' THEN
    SELECT string_to_array(encode(trigger_row.tgargs, 'escape'), E'\\000')
    INTO source_args
    FROM pg_trigger AS trigger_row
    WHERE NOT trigger_row.tgisinternal
      AND pg_get_triggerdef(trigger_row.oid) ILIKE '%supabase_functions.http_request%'
      AND pg_get_triggerdef(trigger_row.oid) ILIKE '%latido_push_notification%'
    ORDER BY trigger_row.oid
    LIMIT 1;

    IF COALESCE(array_length(source_args, 1), 0) >= 3 THEN
      function_url := COALESCE(NULLIF(source_args[1], ''), function_url);
      webhook_secret := COALESCE(
        NULLIF((source_args[3]::JSONB ->> 'x-latido-webhook-secret'), ''),
        webhook_secret
      );
    END IF;
  END IF;

  IF webhook_secret = 'PUSH_WEBHOOK_SECRET_VALUE' THEN
    RAISE EXCEPTION 'No existe un webhook push del que reutilizar el secreto. Sustituye PUSH_WEBHOOK_SECRET_VALUE por el PUSH_WEBHOOK_SECRET de la Edge Function.';
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

  IF to_regclass('public.communities') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS latido_push_communities_insert_update ON public.communities;
    EXECUTE format(
      'CREATE TRIGGER latido_push_communities_insert_update AFTER INSERT OR UPDATE ON public.communities FOR EACH ROW EXECUTE FUNCTION supabase_functions.http_request(%L, %L, %L, %L, %L)',
      function_url, 'POST', headers::text, '{}'::text, '5000'
    );
  END IF;
END $$;

-- Diagnóstico de llamadas webhook:
-- SELECT * FROM net._http_response ORDER BY created DESC LIMIT 20;
