-- Run after account_cooperators.sql, before deploying latido_message_email.
-- Routing is server-managed; cooperators cannot change their membership or these flags.
BEGIN;
ALTER TABLE public.account_cooperators
  ADD COLUMN IF NOT EXISTS receives_message_emails BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS account_cooperators_message_recipient_idx
  ON public.account_cooperators(account_id)
  WHERE active AND receives_message_emails;
NOTIFY pgrst, 'reload schema';
COMMIT;
