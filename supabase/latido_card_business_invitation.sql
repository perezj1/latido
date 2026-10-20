-- Apply after latido_card_minimal.sql. Does not queue or send emails on installation.
BEGIN;
CREATE TABLE IF NOT EXISTS public.latido_card_business_invitations (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES public.providers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','suppressed','failed')),
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  opted_out_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  processing_at timestamptz,
  sent_at timestamptz,
  last_error text
);
ALTER TABLE public.latido_card_business_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.latido_card_business_invitations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.latido_card_business_invitations TO service_role;

-- One target per real owner, never an administrator managing somebody else's business.
-- Paused, expired and deleted offers also count: this invitation is for a FIRST offer.
CREATE OR REPLACE VIEW public.lc_business_invitation_targets AS
SELECT DISTINCT ON (p.user_id) p.user_id, p.id AS provider_id, p.name
FROM public.providers p
JOIN public.profiles profile ON profile.id=p.user_id
LEFT JOIN public.latido_card_businesses cb ON cb.provider_id=p.id
WHERE coalesce((to_jsonb(p)->>'active')::boolean, true)
  AND to_jsonb(p)->>'deleted_at' IS NULL
  AND NOT coalesce((to_jsonb(profile)->>'banned')::boolean, false)
  AND NOT coalesce(cb.suspended, false)
  AND NOT EXISTS (
    SELECT 1 FROM public.latido_card_offers o
    JOIN public.providers owned ON owned.id=o.provider_id
    WHERE owned.user_id=p.user_id
  )
ORDER BY p.user_id, p.id;
REVOKE ALL ON public.lc_business_invitation_targets FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.lc_business_invitation_targets TO service_role;

CREATE OR REPLACE FUNCTION public.lc_business_invitation() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object('business', (
    SELECT jsonb_build_object('id',provider_id,'name',name)
    FROM public.lc_business_invitation_targets WHERE user_id=auth.uid()
  ))
$$;
REVOKE ALL ON FUNCTION public.lc_business_invitation() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lc_business_invitation() TO authenticated;

-- Respect the existing informative-email preference when that optional module is installed.
CREATE OR REPLACE FUNCTION public.lc_invitation_email_enabled(p_user uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE enabled boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM public.latido_card_business_invitations WHERE user_id=p_user AND opted_out_at IS NOT NULL) THEN RETURN false; END IF;
  IF to_regclass('public.email_notification_preferences') IS NOT NULL THEN
    EXECUTE 'SELECT coalesce((to_jsonb(p)->>''weekly_digest_enabled'')::boolean,true) FROM public.email_notification_preferences p WHERE user_id=$1' INTO enabled USING p_user;
  END IF;
  RETURN coalesce(enabled,true);
END $$;
REVOKE ALL ON FUNCTION public.lc_invitation_email_enabled(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lc_invitation_email_enabled(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.lc_queue_business_invitations() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE queued integer;
BEGIN
  INSERT INTO public.latido_card_business_invitations(user_id,provider_id)
  SELECT user_id,provider_id FROM public.lc_business_invitation_targets t
  WHERE public.lc_invitation_email_enabled(t.user_id)
  ON CONFLICT(user_id) DO NOTHING;
  GET DIAGNOSTICS queued = ROW_COUNT;
  RETURN queued;
END $$;
REVOKE ALL ON FUNCTION public.lc_queue_business_invitations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lc_queue_business_invitations() TO service_role;

CREATE OR REPLACE FUNCTION public.lc_claim_business_invitations(p_limit integer DEFAULT 20)
RETURNS SETOF public.latido_card_business_invitations
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.latido_card_business_invitations i SET status='suppressed',last_error='no_longer_eligible'
  WHERE i.status='pending' AND (
    NOT public.lc_invitation_email_enabled(i.user_id) OR NOT EXISTS (
      SELECT 1 FROM public.lc_business_invitation_targets t
      WHERE t.user_id=i.user_id AND t.provider_id=i.provider_id
    )
  );
  RETURN QUERY
  WITH candidates AS (
    SELECT user_id FROM public.latido_card_business_invitations WHERE status='pending'
    ORDER BY created_at,user_id LIMIT least(greatest(coalesce(p_limit,20),1),100)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.latido_card_business_invitations i SET status='processing',processing_at=now()
  FROM candidates c WHERE i.user_id=c.user_id RETURNING i.*;
END $$;
REVOKE ALL ON FUNCTION public.lc_claim_business_invitations(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lc_claim_business_invitations(integer) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
