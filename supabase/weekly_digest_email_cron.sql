-- =====================================================================
-- LATIDO.CH - Cron horario para usuarios inactivos 7 dias
--
-- Ejecuta este archivo DESPUES de:
-- 1) ejecutar supabase/weekly_digest_email.sql
-- 2) desplegar la Edge Function latido_weekly_digest_email
-- 3) crear el secret WEEKLY_DIGEST_CRON_SECRET o EMAIL_CRON_SECRET
--
-- Sustituye WEEKLY_DIGEST_CRON_SECRET_VALUE por el valor real del secret.
-- No subas nunca el valor real del secret al repositorio.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
DECLARE
  project_url_secret_id UUID;
  cron_secret_id UUID;
BEGIN
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
  WHERE name = 'latido_weekly_digest_cron_secret';

  IF cron_secret_id IS NULL THEN
    PERFORM vault.create_secret(
      'WEEKLY_DIGEST_CRON_SECRET_VALUE',
      'latido_weekly_digest_cron_secret',
      'Shared secret for the Latido inactivity digest email cron'
    );
  ELSE
    PERFORM vault.update_secret(
      cron_secret_id,
      'WEEKLY_DIGEST_CRON_SECRET_VALUE',
      'latido_weekly_digest_cron_secret',
      'Shared secret for the Latido inactivity digest email cron'
    );
  END IF;
END
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('latido-weekly-digest-monday-morning');
EXCEPTION
  WHEN OTHERS THEN NULL;
END
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('latido-inactivity-digest-hourly');
EXCEPTION
  WHEN OTHERS THEN NULL;
END
$$;

-- Se ejecuta cada hora, minuto 17.
-- La Edge Function solo envia si:
-- 1) el usuario lleva 7 dias sin entrar;
-- 2) no recibio este email en los ultimos 7 dias;
-- 3) hubo actividad real en Latido durante los ultimos 7 dias.
SELECT cron.schedule(
  'latido-inactivity-digest-hourly',
  '17 * * * *',
  $$
  SELECT net.http_post(
    url := (
      SELECT decrypted_secret
      FROM vault.decrypted_secrets
      WHERE name = 'latido_project_url'
    ) || '/functions/v1/latido_weekly_digest_email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-latido-cron-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'latido_weekly_digest_cron_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  ) AS request_id;
  $$
);

-- Diagnostico:
-- SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'latido-inactivity-digest-hourly';
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
-- SELECT * FROM public.weekly_digest_email_log ORDER BY created_at DESC LIMIT 50;
