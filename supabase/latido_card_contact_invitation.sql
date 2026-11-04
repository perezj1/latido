-- Explicit, one-time contact campaign. Installing this migration sends nothing.
BEGIN;
CREATE TABLE IF NOT EXISTS public.latido_card_contact_invitations (
  email text PRIMARY KEY CHECK (email=lower(btrim(email))),
  provider_id uuid REFERENCES public.providers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','sent','suppressed','failed')),
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  opted_out_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  processing_at timestamptz,
  sent_at timestamptz,
  message_id text,
  last_error text
);
ALTER TABLE public.latido_card_contact_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.latido_card_contact_invitations FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.latido_card_contact_invitations TO service_role;

CREATE OR REPLACE VIEW public.lc_contact_invitation_targets AS
SELECT DISTINCT ON (lower(btrim(p.email))) lower(btrim(p.email)) AS email,p.id AS provider_id,p.name
FROM public.providers p
LEFT JOIN public.latido_card_businesses cb ON cb.provider_id=p.id
WHERE p.user_id IS NULL AND p.active AND p.deleted_at IS NULL
  AND p.email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  AND NOT coalesce(cb.suspended,false)
  AND NOT EXISTS(SELECT 1 FROM public.latido_card_offers o WHERE o.provider_id=p.id)
  AND NOT EXISTS (
    SELECT 1 FROM auth.users u
    LEFT JOIN public.latido_card_business_invitations i ON i.user_id=u.id
    WHERE lower(btrim(u.email))=lower(btrim(p.email))
      AND (i.sent_at IS NOT NULL OR NOT public.lc_invitation_email_enabled(u.id))
  )
  AND NOT EXISTS(SELECT 1 FROM public.latido_card_contact_invitations i
    WHERE i.email=lower(btrim(p.email)) AND i.opted_out_at IS NOT NULL)
ORDER BY lower(btrim(p.email)),p.id;
REVOKE ALL ON public.lc_contact_invitation_targets FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.lc_contact_invitation_targets TO service_role;

CREATE OR REPLACE FUNCTION public.lc_queue_contact_invitations() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE queued integer;
BEGIN
  INSERT INTO public.latido_card_contact_invitations(email,provider_id)
  SELECT email,provider_id FROM public.lc_contact_invitation_targets
  ON CONFLICT(email) DO NOTHING;
  GET DIAGNOSTICS queued=ROW_COUNT;
  RETURN queued;
END $$;

CREATE OR REPLACE FUNCTION public.lc_claim_contact_invitations(p_limit integer DEFAULT 1)
RETURNS SETOF public.latido_card_contact_invitations
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.latido_card_contact_invitations i SET status='suppressed',last_error='no_longer_eligible'
  WHERE i.status='pending' AND NOT EXISTS(SELECT 1 FROM public.lc_contact_invitation_targets t
    WHERE t.email=i.email AND t.provider_id=i.provider_id);
  RETURN QUERY WITH picked AS (
    SELECT email FROM public.latido_card_contact_invitations WHERE status='pending'
    ORDER BY created_at,email LIMIT least(greatest(coalesce(p_limit,1),1),20)
    FOR UPDATE SKIP LOCKED
  ) UPDATE public.latido_card_contact_invitations i SET status='processing',processing_at=now()
    FROM picked WHERE i.email=picked.email RETURNING i.*;
END $$;
REVOKE ALL ON FUNCTION public.lc_queue_contact_invitations() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.lc_claim_contact_invitations(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lc_queue_contact_invitations() TO service_role;
GRANT EXECUTE ON FUNCTION public.lc_claim_contact_invitations(integer) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
