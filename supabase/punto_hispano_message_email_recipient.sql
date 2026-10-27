-- Assign the verified, existing cooperator as the recipient of Punto Hispano's message notices.
-- Run after message_email_cooperators.sql and deploying latido_message_email.
BEGIN;
DO $$
DECLARE account UUID; recipient UUID; affected INTEGER;
BEGIN
  SELECT provider.user_id INTO STRICT account
  FROM public.providers provider JOIN auth.users owner ON owner.id=provider.user_id
  WHERE provider.id='ee7fd475-acd3-4634-bd62-a921c6810fd4'
    AND lower(owner.email)='info@puntohispano.ch';

  SELECT id INTO STRICT recipient FROM auth.users
  WHERE lower(email)='gestoria@puntohispano.ch'
    AND email_confirmed_at IS NOT NULL
    AND (banned_until IS NULL OR banned_until <= now());

  UPDATE public.account_cooperators SET receives_message_emails=TRUE
  WHERE user_id=recipient AND account_id=account AND active;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'Expected active Punto Hispano cooperator; no routing changed'; END IF;
END;
$$;
COMMIT;
