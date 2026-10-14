-- Apply in development AFTER deployment/testing of latido_card_physical_email.
-- Store these in Supabase Vault first (do not commit their values):
-- latido_project_url: project's https://...supabase.co URL
-- latido_card_email_cron_secret: matches LATIDO_CARD_EMAIL_CRON_SECRET
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='latido_project_url') OR
 NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='latido_card_email_cron_secret') THEN
 RAISE EXCEPTION 'Configure latido_project_url and latido_card_email_cron_secret in Vault first';
 END IF;
END $$;
DO $$ DECLARE job_id BIGINT; BEGIN
 SELECT jobid INTO job_id FROM cron.job WHERE jobname='latido-card-physical-email';
 IF job_id IS NOT NULL THEN PERFORM cron.unschedule(job_id); END IF;
END $$;
SELECT cron.schedule('latido-card-physical-email','* * * * *',$job$
 SELECT net.http_post(
  url:=(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='latido_project_url')||'/functions/v1/latido_card_physical_email',
  headers:=jsonb_build_object('Content-Type','application/json','x-latido-card-cron-secret',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='latido_card_email_cron_secret')),
  body:='{}'::jsonb,timeout_milliseconds:=10000
 );
$job$);
