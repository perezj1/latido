-- Tarjeta Latido: open business participation, automatic private QR and saved offers.
-- Apply after latido_card.sql and latido_card_physical_requests.sql.
-- Rerunnable; does not create paid memberships or send emails.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.latido_card_businesses') IS NULL THEN
  RAISE EXCEPTION 'Install latido_card.sql first';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
  AND table_name='latido_card_businesses' AND column_name='suspended') THEN
  ALTER TABLE public.latido_card_businesses ADD COLUMN suspended BOOLEAN NOT NULL DEFAULT false;
  -- Existing explicit administrator deactivations remain blocked.
  UPDATE public.latido_card_businesses SET suspended=true WHERE NOT active;
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.latido_card_saved_offers (
 user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 offer_id UUID NOT NULL REFERENCES public.latido_card_offers(id) ON DELETE CASCADE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,offer_id)
);
ALTER TABLE public.latido_card_saved_offers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.latido_card_saved_offers FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.latido_card_saved_offers TO service_role;

CREATE OR REPLACE FUNCTION public.lc_save_favorite(p_offer UUID,p_saved BOOLEAN) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF p_saved THEN
  IF NOT EXISTS(SELECT 1 FROM public.latido_card_offers o JOIN public.latido_card_businesses b
   ON b.provider_id=o.provider_id AND b.active WHERE o.id=p_offer AND o.active AND o.ends_at>now()) THEN
   RAISE EXCEPTION 'OFFER_UNAVAILABLE';
  END IF;
  INSERT INTO public.latido_card_saved_offers(user_id,offer_id) VALUES(auth.uid(),p_offer)
  ON CONFLICT DO NOTHING;
 ELSE
  DELETE FROM public.latido_card_saved_offers WHERE user_id=auth.uid() AND offer_id=p_offer;
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.lc_business_setup(p_provider UUID,p_link_token TEXT DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b public.latido_card_businesses; tok TEXT;
BEGIN
 -- Serialize setup against ownership changes and other setup requests.
 PERFORM 1 FROM public.providers WHERE id=p_provider FOR UPDATE;
 IF NOT public.lc_can_manage(p_provider) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 INSERT INTO public.latido_card_businesses(provider_id,active) VALUES(p_provider,true)
 ON CONFLICT DO NOTHING;
 SELECT * INTO b FROM public.latido_card_businesses WHERE provider_id=p_provider FOR UPDATE;
 IF b.suspended THEN RAISE EXCEPTION 'BUSINESS_SUSPENDED'; END IF;
 IF NOT b.active THEN UPDATE public.latido_card_businesses SET active=true WHERE provider_id=p_provider; END IF;
 IF p_link_token ~ '^[a-f0-9]{64}$' AND EXISTS(SELECT 1 FROM public.latido_card_scanner_links
  WHERE provider_id=p_provider AND token_hash=public.lc_hash(p_link_token) AND revoked_at IS NULL) THEN
  tok:=p_link_token;
 ELSE
  IF (SELECT count(*) FROM public.latido_card_scanner_links WHERE provider_id=p_provider
   AND created_at>now()-interval '1 day') >= 30 THEN RAISE EXCEPTION 'SCANNER_LINK_RATE_LIMIT'; END IF;
  tok:=public.lc_new_token();
  INSERT INTO public.latido_card_scanner_links(provider_id,token_hash) VALUES(p_provider,public.lc_hash(tok));
 END IF;
 -- No rotation here: opening the page never revokes printed links or worker sessions.
 RETURN jsonb_build_object('token',tok,'business_name',(SELECT name FROM public.providers WHERE id=p_provider));
END $$;

CREATE OR REPLACE FUNCTION public.lc_admin_business(p_provider UUID,p_active BOOLEAN) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.lc_is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 INSERT INTO public.latido_card_businesses(provider_id,active,suspended) VALUES(p_provider,p_active,NOT p_active)
 ON CONFLICT(provider_id) DO UPDATE SET active=excluded.active,suspended=excluded.suspended;
 IF NOT p_active THEN
  UPDATE public.latido_card_scanner_links SET revoked_at=now() WHERE provider_id=p_provider AND revoked_at IS NULL;
  UPDATE public.latido_card_scanner_sessions SET revoked_at=now() WHERE provider_id=p_provider AND revoked_at IS NULL;
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.lc_catalog() RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',o.id,'provider_id',o.provider_id,'business_name',p.name,
 'city',p.city,'business_photo_url',p.photo_url,'title',o.title,'description',o.description,'benefit_type',o.benefit_type,
 'benefit_value',o.benefit_value,'minimum_spend',o.minimum_spend,'requires_claim',o.requires_claim,
 'usage_period',o.usage_period,'usage_limit',o.usage_limit,'ends_at',o.ends_at,
 'remaining',CASE WHEN o.stock_total IS NULL THEN NULL ELSE greatest(0,o.stock_total-(SELECT count(*) FROM public.latido_card_claims c
 WHERE c.offer_id=o.id AND (c.status='used' OR (c.status='claimed' AND c.expires_at>now())))) END)
 ORDER BY p.name,o.requires_claim,o.created_at),'[]'::jsonb)
 FROM public.latido_card_offers o JOIN public.latido_card_businesses b ON b.provider_id=o.provider_id AND b.active
 JOIN public.providers p ON p.id=o.provider_id
 WHERE o.active AND o.starts_at<=now() AND o.ends_at>now()
$$;
CREATE OR REPLACE FUNCTION public.lc_member_home() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.latido_card_memberships; offers JSONB;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 SELECT * INTO m FROM public.latido_card_memberships WHERE user_id=auth.uid();
 SELECT coalesce(jsonb_agg(item || jsonb_build_object('available',public.lc_offer_available(m.id,(item->>'id')::uuid),
 'claim', (SELECT jsonb_build_object('status',CASE WHEN c.status='claimed' AND c.expires_at<=now() THEN 'expired' ELSE c.status END,
 'expires_at',c.expires_at) FROM public.latido_card_claims c WHERE c.membership_id=m.id AND c.offer_id=(item->>'id')::uuid))),'[]'::jsonb)
 INTO offers FROM jsonb_array_elements(public.lc_catalog()) item;
 RETURN jsonb_build_object('saved_offers',(SELECT coalesce(jsonb_agg(s.offer_id),'[]'::jsonb) FROM public.latido_card_saved_offers s WHERE s.user_id=auth.uid()),'membership',CASE WHEN m.id IS NULL THEN NULL ELSE jsonb_build_object(
 'id',m.id,'member_number',m.member_number,'status',m.status,'active',public.lc_active_member(m.id),'valid_until',m.valid_until) END,
 'offers',offers,'history',(SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (SELECT r.id,r.offer_snapshot->>'title' AS title,p.name AS business_name,r.redeemed_at,r.reversed_at
 FROM public.latido_card_redemptions r JOIN public.providers p ON p.id=r.provider_id WHERE r.membership_id=m.id ORDER BY r.redeemed_at DESC LIMIT 50) x));
END $$;
CREATE OR REPLACE FUNCTION public.lc_business_dashboard(p_provider UUID DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF p_provider IS NOT NULL AND NOT public.lc_can_manage(p_provider) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 RETURN jsonb_build_object('businesses',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'participating',b.provider_id IS NOT NULL,'active',coalesce(b.active,false),'suspended',coalesce(b.suspended,false)) ORDER BY p.name),'[]'::jsonb)
 FROM public.providers p LEFT JOIN public.latido_card_businesses b ON b.provider_id=p.id WHERE p.user_id=auth.uid() OR public.lc_is_admin()),
 'offers',(SELECT coalesce(jsonb_agg(o ORDER BY o.created_at DESC),'[]'::jsonb) FROM public.latido_card_offers o WHERE o.provider_id=p_provider),
 'sessions',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'label',s.label,'persistent',s.persistent,'persistence_requested',s.persistence_requested,'expires_at',s.expires_at,'revoked_at',s.revoked_at,'last_seen_at',s.last_seen_at) ORDER BY s.created_at DESC),'[]'::jsonb) FROM public.latido_card_scanner_sessions s WHERE s.provider_id=p_provider),
 'history',(SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (SELECT r.id,r.offer_snapshot->>'title' AS title,r.redeemed_at,r.reversed_at,s.label AS scanner_label FROM public.latido_card_redemptions r
 JOIN public.latido_card_scanner_sessions s ON s.id=r.scanner_session_id WHERE r.provider_id=p_provider ORDER BY r.redeemed_at DESC LIMIT 100) x));
END $$;

REVOKE ALL ON FUNCTION public.lc_save_favorite(UUID,BOOLEAN),public.lc_business_setup(UUID,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lc_save_favorite(UUID,BOOLEAN),public.lc_business_setup(UUID,TEXT) TO authenticated;
-- CREATE OR REPLACE preserves the existing reviewed grants for these functions.
COMMIT;
