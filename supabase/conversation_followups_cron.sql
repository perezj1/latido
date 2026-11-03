-- Apply separately only after review and explicit activation. This file is NOT
-- needed for the local preview. Store conversation_followup_cron_secret in Vault
-- and use the same value for CONVERSATION_FOLLOWUP_CRON_SECRET in Edge secrets.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='conversation_followup_cron_secret') THEN
    RAISE EXCEPTION 'Configure conversation_followup_cron_secret in Vault first';
  END IF;
END $$;
SELECT cron.schedule('latido-conversation-followups','*/10 * * * *',$job$
  SELECT net.http_post(
    url:='https://zmievixfjefjppofebbh.supabase.co/functions/v1/conversation_followup_email',
    headers:=jsonb_build_object('Content-Type','application/json','x-latido-cron-secret',
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='conversation_followup_cron_secret')),
    body:='{}'::jsonb,timeout_milliseconds:=120000
  );
$job$);
COMMIT;
