-- Run after latido_card_scanner_accounts.sql (and the other Card migrations).
-- Rerunnable. Manual customer codes are distinct from private business invites.
BEGIN;
CREATE TABLE IF NOT EXISTS public.latido_card_manual_codes (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 membership_id UUID NOT NULL REFERENCES public.latido_card_memberships(id),
 code_hash TEXT NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL,
 revoked_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lc_manual_codes_member_idx ON public.latido_card_manual_codes(membership_id);
-- Six-digit codes must be reusable after expiry; history keeps its own UUID.
ALTER TABLE public.latido_card_manual_codes DROP CONSTRAINT IF EXISTS latido_card_manual_codes_code_hash_key;
CREATE UNIQUE INDEX IF NOT EXISTS lc_manual_codes_live_hash_idx ON public.latido_card_manual_codes(code_hash) WHERE revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS public.latido_card_code_attempts (
 scope TEXT PRIMARY KEY,
 window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 attempts INTEGER NOT NULL DEFAULT 0,
 failed_attempts INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.latido_card_code_attempts ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.latido_card_manual_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.latido_card_code_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.latido_card_manual_codes,public.latido_card_code_attempts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.latido_card_manual_codes,public.latido_card_code_attempts TO service_role;
ALTER TABLE public.latido_card_credentials ADD COLUMN IF NOT EXISTS manual_code_id UUID
 REFERENCES public.latido_card_manual_codes(id);
CREATE INDEX IF NOT EXISTS lc_credentials_manual_idx ON public.latido_card_credentials(manual_code_id) WHERE manual_code_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.lc_issue_card_code() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.latido_card_memberships; code TEXT; cid UUID; previous_hash TEXT; tries INTEGER;
 expiry TIMESTAMPTZ:=now()+interval '5 minutes';
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 SELECT * INTO m FROM public.latido_card_memberships WHERE user_id=auth.uid() FOR UPDATE;
 IF NOT public.lc_active_member(m.id) THEN RAISE EXCEPTION 'MEMBERSHIP_INACTIVE'; END IF;
 IF (SELECT count(*) FROM public.latido_card_manual_codes WHERE membership_id=m.id
  AND created_at>now()-interval '1 hour')>=30 THEN RAISE EXCEPTION 'CARD_CODE_ISSUE_LIMIT'; END IF;
 SELECT code_hash INTO previous_hash FROM public.latido_card_manual_codes WHERE membership_id=m.id
  ORDER BY (revoked_at IS NULL) DESC,created_at DESC LIMIT 1;
 UPDATE public.latido_card_manual_codes SET revoked_at=now() WHERE membership_id=m.id AND revoked_at IS NULL;
 UPDATE public.latido_card_credentials SET revoked_at=now() WHERE membership_id=m.id AND manual_code_id IS NOT NULL AND revoked_at IS NULL;
 FOR tries IN 1..100 LOOP
  -- UUID v4's random first 40 bits; no predictable member number, no random().
  code:=lpad(((('x'||substr(replace(gen_random_uuid()::text,'-',''),1,10))::bit(40)::bigint)%1000000)::text,6,'0');
  IF public.lc_hash(code)=previous_hash THEN CONTINUE; END IF;
  UPDATE public.latido_card_manual_codes SET revoked_at=now()
   WHERE code_hash=public.lc_hash(code) AND revoked_at IS NULL AND expires_at<=now();
  INSERT INTO public.latido_card_manual_codes(membership_id,code_hash,expires_at)
   VALUES(m.id,public.lc_hash(code),expiry) ON CONFLICT(code_hash) WHERE revoked_at IS NULL DO NOTHING RETURNING id INTO cid;
  EXIT WHEN cid IS NOT NULL;
 END LOOP;
 IF cid IS NULL THEN RAISE EXCEPTION 'CARD_CODE_CAPACITY'; END IF;
 RETURN jsonb_build_object('code',code,'expires_at',expiry);
END $$;
REVOKE ALL ON FUNCTION public.lc_issue_card_code() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lc_issue_card_code() TO authenticated;

CREATE OR REPLACE FUNCTION public.lc_scan_card_code(p_session_token TEXT,p_code TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.latido_card_scanner_sessions:=public.lc_scanner(p_session_token);
 c public.latido_card_manual_codes; code TEXT:=regexp_replace(coalesce(p_code,''),'[[:space:]-]','','g');
 scope_key TEXT; n INTEGER; failures INTEGER; blocked BOOLEAN:=false; tok TEXT;
BEGIN
 -- Separate failed guesses from valid customer lookups so a busy waiter
 -- can serve more than five customers per minute without being locked out.
 -- Returning errors instead of raising preserves counters on failed guesses.
 FOREACH scope_key IN ARRAY ARRAY[
  CASE WHEN s.linked_user_id IS NULL THEN 'session:'||s.id::text ELSE 'user:'||s.linked_user_id::text END,
  'business:'||s.provider_id::text
 ] LOOP
  INSERT INTO public.latido_card_code_attempts(scope) VALUES(scope_key) ON CONFLICT DO NOTHING;
  UPDATE public.latido_card_code_attempts SET
   attempts=CASE WHEN window_started_at<=now()-interval '1 minute' THEN 1 ELSE attempts+1 END,
   failed_attempts=CASE WHEN window_started_at<=now()-interval '1 minute' THEN 1 ELSE failed_attempts+1 END,
   window_started_at=CASE WHEN window_started_at<=now()-interval '1 minute' THEN now() ELSE window_started_at END
  WHERE scope=scope_key RETURNING attempts,failed_attempts INTO n,failures;
  IF n>(CASE WHEN scope_key LIKE 'business:%' THEN 300 ELSE 60 END)
   OR failures>(CASE WHEN scope_key LIKE 'business:%' THEN 30 ELSE 5 END)
  THEN blocked:=true; END IF;
 END LOOP;
 IF blocked THEN RETURN jsonb_build_object('error','CARD_CODE_RATE_LIMIT'); END IF;
 IF code !~ '^[0-9]{6}$' THEN RETURN jsonb_build_object('error','CARD_CODE_INVALID'); END IF;
 SELECT * INTO c FROM public.latido_card_manual_codes WHERE code_hash=public.lc_hash(code) AND revoked_at IS NULL AND expires_at>now();
 IF c.id IS NULL THEN RETURN jsonb_build_object('error','CARD_CODE_INVALID'); END IF;
 -- Same lock order as issuing/renewing the customer's credentials.
 PERFORM 1 FROM public.latido_card_memberships WHERE id=c.membership_id FOR UPDATE;
 SELECT * INTO c FROM public.latido_card_manual_codes WHERE id=c.id FOR UPDATE;
 IF c.revoked_at IS NOT NULL OR c.expires_at<=now() OR NOT public.lc_active_member(c.membership_id)
 THEN RETURN jsonb_build_object('error','CARD_CODE_INVALID'); END IF;
 tok:=public.lc_new_token();
 INSERT INTO public.latido_card_credentials(membership_id,token_hash,kind,expires_at,manual_code_id)
 VALUES(c.membership_id,public.lc_hash(tok),'digital',c.expires_at,c.id);
 UPDATE public.latido_card_code_attempts SET failed_attempts=greatest(0,failed_attempts-1)
 WHERE scope IN (CASE WHEN s.linked_user_id IS NULL THEN 'session:'||s.id::text ELSE 'user:'||s.linked_user_id::text END,
  'business:'||s.provider_id::text);
 RETURN jsonb_build_object('card_token',tok,'card',public.lc_scan_card(p_session_token,tok));
END $$;
REVOKE ALL ON FUNCTION public.lc_scan_card_code(TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lc_scan_card_code(TEXT,TEXT) TO anon,authenticated;

-- Renewing the QR must not interrupt a manual lookup already in progress.
CREATE OR REPLACE FUNCTION public.lc_issue_digital_card() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.latido_card_memberships; tok TEXT:=public.lc_new_token(); expiry TIMESTAMPTZ:=now()+interval '5 minutes';
BEGIN
 SELECT * INTO m FROM public.latido_card_memberships WHERE user_id=auth.uid() FOR UPDATE;
 IF NOT public.lc_active_member(m.id) THEN RAISE EXCEPTION 'MEMBERSHIP_INACTIVE'; END IF;
 UPDATE public.latido_card_credentials SET revoked_at=now() WHERE membership_id=m.id AND kind='digital' AND manual_code_id IS NULL AND revoked_at IS NULL;
 INSERT INTO public.latido_card_credentials(membership_id,token_hash,kind,expires_at) VALUES(m.id,public.lc_hash(tok),'digital',expiry);
 RETURN jsonb_build_object('token',tok,'expires_at',expiry,'member_number',m.member_number);
END $$;
COMMIT;
