-- Apply after latido_card_business_invitation.sql and deploying the invitation Edge.
-- Store LATIDO_CARD_INVITATION_SECRET in Vault as latido_card_invitation_secret first.
-- Checking hourly drains batches; each owner can receive at most one email per 20 days.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='latido_card_invitation_secret') THEN
    RAISE EXCEPTION 'Configure latido_card_invitation_secret in Vault first';
  END IF;
END $$;
SELECT cron.schedule('latido-card-business-invitations','37 * * * *',$job$
  SELECT net.http_post(
    url:='https://zmievixfjefjppofebbh.supabase.co/functions/v1/latido_card_business_invitation_email',
    headers:=jsonb_build_object('Content-Type','application/json','x-latido-cron-secret',
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='latido_card_invitation_secret')),
    body:='{"action":"run"}'::jsonb,
    timeout_milliseconds:=120000
  );
$job$);
COMMIT;
