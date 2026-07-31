-- =====================================================================
-- LATIDO.CH - Entrega de acumulados de busquedas guardadas
--
-- Ejecuta este archivo DESPUES de:
--   1. supabase/saved_searches.sql
--   2. desplegar latido_push_notification
--
-- Si ya existe un webhook hacia latido_push_notification, este archivo
-- reutiliza automaticamente su secreto sin mostrarlo. En una instalacion
-- nueva sustituye PUSH_WEBHOOK_SECRET_VALUE por el PUSH_WEBHOOK_SECRET.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
DECLARE
  project_url_secret_id UUID;
  push_secret_id UUID;
  push_webhook_secret TEXT := 'PUSH_WEBHOOK_SECRET_VALUE';
  source_args TEXT[];
BEGIN
  IF push_webhook_secret = 'PUSH_WEBHOOK_SECRET_VALUE' THEN
    SELECT string_to_array(encode(trigger_row.tgargs, 'escape'), E'\\000')
    INTO source_args
    FROM pg_trigger AS trigger_row
    WHERE NOT trigger_row.tgisinternal
      AND pg_get_triggerdef(trigger_row.oid) ILIKE '%supabase_functions.http_request%'
      AND pg_get_triggerdef(trigger_row.oid) ILIKE '%latido_push_notification%'
    ORDER BY trigger_row.oid
    LIMIT 1;

    IF COALESCE(array_length(source_args, 1), 0) >= 3 THEN
      push_webhook_secret := COALESCE(
        NULLIF((source_args[3]::JSONB ->> 'x-latido-webhook-secret'), ''),
        push_webhook_secret
      );
    END IF;
  END IF;

  IF push_webhook_secret = 'PUSH_WEBHOOK_SECRET_VALUE' THEN
    RAISE EXCEPTION 'No existe un webhook push del que reutilizar el secreto. Sustituye PUSH_WEBHOOK_SECRET_VALUE por el PUSH_WEBHOOK_SECRET de la Edge Function.';
  END IF;

  SELECT id INTO project_url_secret_id
  FROM vault.secrets
  WHERE name = 'latido_project_url';

  IF project_url_secret_id IS NULL THEN
    PERFORM vault.create_secret(
      'https://zmievixfjefjppofebbh.supabase.co',
      'latido_project_url',
      'Latido Supabase project URL'
    );
  END IF;

  SELECT id INTO push_secret_id
  FROM vault.secrets
  WHERE name = 'latido_push_webhook_secret';

  IF push_secret_id IS NULL THEN
    PERFORM vault.create_secret(
      push_webhook_secret,
      'latido_push_webhook_secret',
      'Shared secret for saved search push delivery'
    );
  ELSE
    PERFORM vault.update_secret(
      push_secret_id,
      push_webhook_secret,
      'latido_push_webhook_secret',
      'Shared secret for saved search push delivery'
    );
  END IF;
END
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('latido-saved-search-digest-hourly');
EXCEPTION
  WHEN OTHERS THEN NULL;
END
$$;

SELECT cron.schedule(
  'latido-saved-search-digest-hourly',
  '17 * * * *',
  $$
  SELECT net.http_post(
    url := (
      SELECT decrypted_secret
      FROM vault.decrypted_secrets
      WHERE name = 'latido_project_url'
    ) || '/functions/v1/latido_push_notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-latido-webhook-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'latido_push_webhook_secret'
      )
    ),
    body := jsonb_build_object(
      'table', 'saved_search_digest',
      'type', 'INSERT',
      'record', jsonb_build_object('requested_at', NOW())
    ),
    timeout_milliseconds := 20000
  ) AS request_id;
  $$
);

-- Diagnostico:
-- SELECT * FROM cron.job WHERE jobname = 'latido-saved-search-digest-hourly';
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
