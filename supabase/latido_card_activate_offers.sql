-- Existing Card installations: run this update once; rerunnable, no data deletion.
-- Fresh installs already include these functions in latido_card_minimal.sql.
-- Every offer is activated with one confirmation; limited stock is reserved and consumed atomically.
BEGIN;
CREATE OR REPLACE FUNCTION public.lc_use_offer(p_offer UUID,p_request_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.latido_card_memberships; o public.latido_card_offers; r public.latido_card_redemptions; b public.latido_card_businesses; business_name TEXT;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF p_request_id IS NULL THEN RAISE EXCEPTION 'REQUEST_REQUIRED'; END IF;
 -- Fixed lock order serializes limits across tabs/devices, and reservations across members.
 SELECT * INTO m FROM public.latido_card_memberships WHERE user_id=auth.uid() FOR UPDATE;
 SELECT * INTO r FROM public.latido_card_redemptions WHERE request_id=p_request_id;
 IF r.id IS NOT NULL THEN
  IF r.membership_id IS DISTINCT FROM m.id OR r.offer_id IS DISTINCT FROM p_offer OR r.source<>'member' THEN RAISE EXCEPTION 'REQUEST_CONFLICT'; END IF;
  RETURN public.lc_validation(r.id);
 END IF;
 IF NOT public.lc_active_member(m.id) THEN RAISE EXCEPTION 'MEMBERSHIP_INACTIVE'; END IF;
 SELECT * INTO o FROM public.latido_card_offers WHERE id=p_offer;
 IF o.id IS NULL THEN RAISE EXCEPTION 'OFFER_UNAVAILABLE'; END IF;
 SELECT * INTO b FROM public.latido_card_businesses WHERE provider_id=o.provider_id FOR SHARE;
 SELECT * INTO o FROM public.latido_card_offers WHERE id=p_offer FOR UPDATE;
 IF NOT b.active OR b.suspended THEN RAISE EXCEPTION 'BUSINESS_INACTIVE'; END IF;
 SELECT * INTO r FROM public.latido_card_redemptions WHERE membership_id=m.id AND offer_id=o.id AND source='member' AND reversed_at IS NULL AND display_valid_until>now() ORDER BY redeemed_at DESC LIMIT 1;
 IF r.id IS NOT NULL THEN RETURN public.lc_validation(r.id); END IF;
 -- Reserve limited stock and consume it in this same transaction, only on confirmation.
 IF o.requires_claim THEN PERFORM public.lc_claim_offer(o.id); END IF;
 IF NOT public.lc_offer_available(m.id,o.id) THEN RAISE EXCEPTION 'OFFER_UNAVAILABLE'; END IF;
 SELECT name INTO business_name FROM public.providers WHERE id=o.provider_id;
 INSERT INTO public.latido_card_redemptions(request_id,membership_id,offer_id,provider_id,source,offer_snapshot,display_valid_until)
 VALUES(p_request_id,m.id,o.id,o.provider_id,'member',to_jsonb(o)||jsonb_build_object('business_name',business_name),least(now()+interval '5 minutes',m.valid_until,o.ends_at)) RETURNING * INTO r;
 IF o.requires_claim THEN UPDATE public.latido_card_claims SET status='used' WHERE membership_id=m.id AND offer_id=o.id; END IF;
 RETURN public.lc_validation(r.id);
END $$;

CREATE OR REPLACE FUNCTION public.lc_member_home() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.latido_card_memberships; offers JSONB;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 SELECT * INTO m FROM public.latido_card_memberships WHERE user_id=auth.uid();
 SELECT coalesce(jsonb_agg(item||jsonb_build_object('available',public.lc_offer_available(m.id,o.id),
 'claim',(SELECT jsonb_build_object('status',CASE WHEN c.status='claimed' AND c.expires_at<=now() THEN 'expired' ELSE c.status END,'expires_at',c.expires_at) FROM public.latido_card_claims c WHERE c.membership_id=m.id AND c.offer_id=o.id),
 'used_count',(SELECT count(*) FROM public.latido_card_redemptions r WHERE r.membership_id=m.id AND r.offer_id=o.id AND r.reversed_at IS NULL AND r.redeemed_at>=public.lc_period_start(o.usage_period)),
 'next_available_at',CASE WHEN public.lc_next_period(o.usage_period)<o.ends_at THEN public.lc_next_period(o.usage_period) END,
 'validation',(SELECT jsonb_build_object('id',r.id,'expires_at',r.display_valid_until) FROM public.latido_card_redemptions r WHERE r.membership_id=m.id AND r.offer_id=o.id AND r.source='member' AND r.reversed_at IS NULL AND r.display_valid_until>now() ORDER BY r.redeemed_at DESC LIMIT 1))),'[]'::jsonb)
 INTO offers FROM jsonb_array_elements(public.lc_catalog()) item JOIN public.latido_card_offers o ON o.id=(item->>'id')::uuid;
 RETURN jsonb_build_object('membership',CASE WHEN m.id IS NULL THEN NULL ELSE jsonb_build_object('id',m.id,'member_number',m.member_number,'status',m.status,'active',public.lc_active_member(m.id),'valid_until',m.valid_until) END,'offers',offers,
 'history',(SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (SELECT r.id,r.request_id,r.offer_id,r.provider_id,r.offer_snapshot,r.offer_snapshot->>'title' AS title,coalesce(r.offer_snapshot->>'business_name',p.name) AS business_name,r.redeemed_at,r.reversed_at,r.source,r.display_valid_until FROM public.latido_card_redemptions r JOIN public.providers p ON p.id=r.provider_id WHERE r.membership_id=m.id ORDER BY r.redeemed_at DESC LIMIT 100) x));
END $$;
REVOKE ALL ON FUNCTION public.lc_use_offer(UUID,UUID),public.lc_member_home() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lc_use_offer(UUID,UUID),public.lc_member_home() TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
