-- =====================================================================
-- LATIDO.CH - Cron de emails para Alertas de clientes potenciales
--
-- Ejecuta este archivo solo DESPUES de desplegar la Edge Function
-- latido_business_lead_alert_email y de crear el secret correspondiente.
-- Sustituye LEAD_ALERTS_CRON_SECRET_VALUE por el mismo valor del secret
-- LEAD_ALERTS_CRON_SECRET configurado en Edge Functions.
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
  END IF;

  SELECT id INTO cron_secret_id
  FROM vault.secrets
  WHERE name = 'latido_business_lead_alerts_cron_secret';

  IF cron_secret_id IS NULL THEN
    PERFORM vault.create_secret(
      'LEAD_ALERTS_CRON_SECRET_VALUE',
      'latido_business_lead_alerts_cron_secret',
      'Shared secret for the Latido lead alerts email cron'
    );
  ELSE
    PERFORM vault.update_secret(
      cron_secret_id,
      'LEAD_ALERTS_CRON_SECRET_VALUE',
      'latido_business_lead_alerts_cron_secret',
      'Shared secret for the Latido lead alerts email cron'
    );
  END IF;
END
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('latido-business-lead-alerts-every-minute');
EXCEPTION
  WHEN OTHERS THEN NULL;
END
$$;

SELECT cron.schedule(
  'latido-business-lead-alerts-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := (
      SELECT decrypted_secret
      FROM vault.decrypted_secrets
      WHERE name = 'latido_project_url'
    ) || '/functions/v1/latido_business_lead_alert_email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-latido-cron-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'latido_business_lead_alerts_cron_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  ) AS request_id;
  $$
);

-- DiagnÃ³stico:
-- SELECT * FROM cron.job WHERE jobname = 'latido-business-lead-alerts-every-minute';
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
