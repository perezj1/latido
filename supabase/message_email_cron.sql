-- Run this only after deploying and testing latido_message_email.
-- Replace EMAIL_CRON_SECRET_VALUE first with the exact value configured
-- as the Edge Function secret EMAIL_CRON_SECRET.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
DECLARE
  project_url_secret_id UUID;
  cron_secret_id UUID;
BEGIN
  SELECT id
  INTO project_url_secret_id
  FROM vault.secrets
  WHERE name = 'latido_project_url';

  IF project_url_secret_id IS NULL THEN
    PERFORM vault.create_secret(
      'https://zmievixfjefjppofebbh.supabase.co',
      'latido_project_url',
      'Latido Supabase project URL for the message email cron'
    );
  ELSE
    PERFORM vault.update_secret(
      project_url_secret_id,
      'https://zmievixfjefjppofebbh.supabase.co',
      'latido_project_url',
      'Latido Supabase project URL for the message email cron'
    );
  END IF;

  SELECT id
  INTO cron_secret_id
  FROM vault.secrets
  WHERE name = 'latido_message_email_cron_secret';

  IF cron_secret_id IS NULL THEN
    PERFORM vault.create_secret(
      'EMAIL_CRON_SECRET_VALUE',
      'latido_message_email_cron_secret',
      'Shared secret for the Latido unread-message email cron'
    );
  ELSE
    PERFORM vault.update_secret(
      cron_secret_id,
      'EMAIL_CRON_SECRET_VALUE',
      'latido_message_email_cron_secret',
      'Shared secret for the Latido unread-message email cron'
    );
  END IF;
END
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('latido-message-email-every-minute');
EXCEPTION
  WHEN OTHERS THEN NULL;
END
$$;

SELECT cron.schedule(
  'latido-message-email-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := (
      SELECT decrypted_secret
      FROM vault.decrypted_secrets
      WHERE name = 'latido_project_url'
    ) || '/functions/v1/latido_message_email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-latido-cron-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'latido_message_email_cron_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  ) AS request_id;
  $$
);

-- Diagnostics:
-- SELECT * FROM cron.job WHERE jobname = 'latido-message-email-every-minute';
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
-- SELECT * FROM net._http_response ORDER BY created DESC LIMIT 20;
