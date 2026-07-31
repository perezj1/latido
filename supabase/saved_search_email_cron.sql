-- =====================================================================
-- LATIDO.CH - Cron de emails para coincidencias de busquedas guardadas
--
-- Ejecuta este archivo despues de:
--   1. ejecutar de nuevo supabase/saved_searches.sql
--   2. desplegar latido_saved_search_email
--
-- Reutiliza EMAIL_CRON_SECRET o WEEKLY_DIGEST_CRON_SECRET cuando su valor
-- ya esta guardado en Vault por los cron existentes. En una instalacion
-- nueva sustituye SAVED_SEARCH_EMAIL_CRON_SECRET_VALUE por un secreto y
-- configuralo tambien como SAVED_SEARCH_EMAIL_CRON_SECRET en Edge Secrets.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
DECLARE
  project_url_secret_id UUID;
  cron_secret_id UUID;
  cron_secret_value TEXT := 'SAVED_SEARCH_EMAIL_CRON_SECRET_VALUE';
BEGIN
  IF cron_secret_value = 'SAVED_SEARCH_EMAIL_CRON_SECRET_VALUE' THEN
    SELECT decrypted_secret
    INTO cron_secret_value
    FROM vault.decrypted_secrets
    WHERE name IN (
      'latido_message_email_cron_secret',
      'latido_weekly_digest_cron_secret'
    )
    ORDER BY CASE name
      WHEN 'latido_message_email_cron_secret' THEN 1
      ELSE 2
    END
    LIMIT 1;
  END IF;

  IF cron_secret_value IS NULL
    OR cron_secret_value = 'SAVED_SEARCH_EMAIL_CRON_SECRET_VALUE'
  THEN
    RAISE EXCEPTION 'No se encontro un secreto de email reutilizable. Sustituye SAVED_SEARCH_EMAIL_CRON_SECRET_VALUE y crea el mismo SAVED_SEARCH_EMAIL_CRON_SECRET en Edge Functions.';
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
  ELSE
    PERFORM vault.update_secret(
      project_url_secret_id,
      'https://zmievixfjefjppofebbh.supabase.co',
      'latido_project_url',
      'Latido Supabase project URL'
    );
  END IF;

  SELECT id INTO cron_secret_id
  FROM vault.secrets
  WHERE name = 'latido_saved_search_email_cron_secret';

  IF cron_secret_id IS NULL THEN
    PERFORM vault.create_secret(
      cron_secret_value,
      'latido_saved_search_email_cron_secret',
      'Shared secret for saved search email delivery'
    );
  ELSE
    PERFORM vault.update_secret(
      cron_secret_id,
      cron_secret_value,
      'latido_saved_search_email_cron_secret',
      'Shared secret for saved search email delivery'
    );
  END IF;
END
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('latido-saved-search-email-every-five-minutes');
EXCEPTION
  WHEN OTHERS THEN NULL;
END
$$;

SELECT cron.schedule(
  'latido-saved-search-email-every-five-minutes',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (
      SELECT decrypted_secret
      FROM vault.decrypted_secrets
      WHERE name = 'latido_project_url'
    ) || '/functions/v1/latido_saved_search_email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-latido-cron-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'latido_saved_search_email_cron_secret'
      )
    ),
    body := '{}'::JSONB,
    timeout_milliseconds := 25000
  ) AS request_id;
  $$
);

-- Diagnostico:
-- SELECT jobid, jobname, schedule, active
-- FROM cron.job
-- WHERE jobname = 'latido-saved-search-email-every-five-minutes';
--
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
-- SELECT * FROM public.saved_search_matches ORDER BY matched_at DESC LIMIT 50;
