-- Existing minimal Card installations: activation modes and deletion of paused offers.
-- Rerunnable. Existing offers keep manual activation. Historical uses are preserved.
BEGIN;
ALTER TABLE public.latido_card_offers ADD COLUMN IF NOT EXISTS activation_mode TEXT NOT NULL DEFAULT 'manual' CHECK (activation_mode IN ('automatic','manual'));
ALTER TABLE public.latido_card_offers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.latido_card_offers'::regclass AND conname='lc_offer_deleted_paused') THEN
  ALTER TABLE public.latido_card_offers ADD CONSTRAINT lc_offer_deleted_paused CHECK (deleted_at IS NULL OR NOT active);
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.lc_protect_offer_terms() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF (to_jsonb(NEW)-'active'-'deleted_at') IS DISTINCT FROM (to_jsonb(OLD)-'active'-'deleted_at') AND (
 EXISTS (SELECT 1 FROM public.latido_card_claims WHERE offer_id=OLD.id)
 OR EXISTS (SELECT 1 FROM public.latido_card_redemptions WHERE offer_id=OLD.id)) THEN
 RAISE EXCEPTION 'OFFER_TERMS_LOCKED'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.lc_catalog() RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',o.id,'provider_id',o.provider_id,'business_name',p.name,
 'city',p.city,'business_photo_url',p.photo_url,'title',o.title,'description',o.description,'benefit_type',o.benefit_type,
 'benefit_value',o.benefit_value,'minimum_spend',o.minimum_spend,'requires_claim',o.requires_claim,'activation_mode',o.activation_mode,
 'usage_period',o.usage_period,'usage_limit',o.usage_limit,'ends_at',o.ends_at,
 'remaining',CASE WHEN o.stock_total IS NULL THEN NULL ELSE greatest(0,o.stock_total-(SELECT count(*) FROM public.latido_card_claims c
 WHERE c.offer_id=o.id AND (c.status='used' OR (c.status='claimed' AND c.expires_at>now())))) END)
 ORDER BY p.name,o.requires_claim,o.created_at),'[]'::jsonb)
 FROM public.latido_card_offers o JOIN public.latido_card_businesses b ON b.provider_id=o.provider_id AND b.active
 JOIN public.providers p ON p.id=o.provider_id
 WHERE o.active AND o.deleted_at IS NULL AND o.starts_at<=now() AND o.ends_at>now() AND NOT b.suspended
$$;

CREATE OR REPLACE FUNCTION public.lc_claim_offer(p_offer UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.latido_card_memberships; o public.latido_card_offers; c public.latido_card_claims; used_stock BIGINT;
BEGIN
 SELECT * INTO m FROM public.latido_card_memberships WHERE user_id=auth.uid() FOR UPDATE;
 IF NOT public.lc_active_member(m.id) THEN RAISE EXCEPTION 'MEMBERSHIP_INACTIVE'; END IF;
 SELECT * INTO o FROM public.latido_card_offers WHERE id=p_offer FOR UPDATE;
 IF o.id IS NULL OR o.deleted_at IS NOT NULL OR NOT o.requires_claim OR NOT o.active OR o.starts_at>now() OR o.ends_at<=now()
 OR NOT EXISTS(SELECT 1 FROM public.latido_card_businesses WHERE provider_id=o.provider_id AND active AND NOT suspended) THEN RAISE EXCEPTION 'OFFER_UNAVAILABLE'; END IF;
 SELECT * INTO c FROM public.latido_card_claims WHERE offer_id=o.id AND membership_id=m.id;
 IF c.status='used' THEN RAISE EXCEPTION 'OFFER_USED'; END IF;
 IF c.status='claimed' AND c.expires_at>now() THEN RETURN to_jsonb(c); END IF;
 SELECT count(*) INTO used_stock FROM public.latido_card_claims WHERE offer_id=o.id AND (status='used' OR (status='claimed' AND expires_at>now()));
 IF o.stock_total IS NOT NULL AND used_stock>=o.stock_total THEN RAISE EXCEPTION 'OFFER_SOLD_OUT'; END IF;
 INSERT INTO public.latido_card_claims(membership_id,offer_id,expires_at) VALUES(m.id,o.id,least(o.ends_at,now()+make_interval(days=>o.claim_days)))
 ON CONFLICT(membership_id,offer_id) DO UPDATE SET status='claimed',expires_at=excluded.expires_at,created_at=now() RETURNING * INTO c;
 RETURN to_jsonb(c);
END $$;

CREATE OR REPLACE FUNCTION public.lc_save_offer(p_provider UUID,p_offer JSONB) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE oid UUID;
BEGIN
 IF NOT public.lc_can_manage(p_provider) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM 1 FROM public.latido_card_businesses WHERE provider_id=p_provider AND active AND NOT suspended FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'BUSINESS_INACTIVE'; END IF;
 IF (SELECT count(*) FROM public.latido_card_offers WHERE provider_id=p_provider AND active AND ends_at>now() AND requires_claim=coalesce((p_offer->>'requires_claim')::boolean,false))
 >= (CASE WHEN coalesce((p_offer->>'requires_claim')::boolean,false) THEN 2 ELSE 1 END) THEN RAISE EXCEPTION 'OFFER_CAPACITY'; END IF;
 INSERT INTO public.latido_card_offers(provider_id,title,description,benefit_type,benefit_value,minimum_spend,requires_claim,stock_total,claim_days,usage_period,usage_limit,ends_at,activation_mode)
 VALUES(p_provider,p_offer->>'title',coalesce(p_offer->>'description',''),p_offer->>'benefit_type',nullif(p_offer->>'benefit_value','')::numeric,
 coalesce(nullif(p_offer->>'minimum_spend','')::numeric,0),coalesce((p_offer->>'requires_claim')::boolean,false),nullif(p_offer->>'stock_total','')::integer,
 coalesce((p_offer->>'claim_days')::integer,7),coalesce(p_offer->>'usage_period','month'),coalesce((p_offer->>'usage_limit')::integer,1),(p_offer->>'ends_at')::timestamptz,coalesce(p_offer->>'activation_mode','manual')) RETURNING id INTO oid;
 RETURN oid;
END $$;

CREATE OR REPLACE FUNCTION public.lc_set_offer_active(p_offer UUID,p_active BOOLEAN) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid UUID;
BEGIN
 SELECT provider_id INTO pid FROM public.latido_card_offers WHERE id=p_offer;
 IF NOT public.lc_can_manage(pid) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM 1 FROM public.latido_card_businesses WHERE provider_id=pid FOR UPDATE;
 PERFORM 1 FROM public.latido_card_offers WHERE id=p_offer AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'OFFER_UNAVAILABLE'; END IF;
 IF p_active AND NOT EXISTS(SELECT 1 FROM public.latido_card_businesses WHERE provider_id=pid AND active AND NOT suspended) THEN RAISE EXCEPTION 'BUSINESS_INACTIVE'; END IF;
 IF p_active AND EXISTS(SELECT 1 FROM public.latido_card_offers o WHERE o.id=p_offer AND NOT o.active AND o.ends_at>now()) AND
 (SELECT count(*) FROM public.latido_card_offers o WHERE o.provider_id=pid AND o.active AND o.ends_at>now() AND o.requires_claim=(SELECT requires_claim FROM public.latido_card_offers WHERE id=p_offer))
 >= (CASE WHEN (SELECT requires_claim FROM public.latido_card_offers WHERE id=p_offer) THEN 2 ELSE 1 END) THEN RAISE EXCEPTION 'OFFER_CAPACITY'; END IF;
 UPDATE public.latido_card_offers SET active=p_active WHERE id=p_offer;
END $$;

CREATE OR REPLACE FUNCTION public.lc_delete_offer(p_offer UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid UUID; o public.latido_card_offers;
BEGIN
 SELECT provider_id INTO pid FROM public.latido_card_offers WHERE id=p_offer;
 IF NOT public.lc_can_manage(pid) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM 1 FROM public.latido_card_businesses WHERE provider_id=pid FOR UPDATE;
 SELECT * INTO o FROM public.latido_card_offers WHERE id=p_offer FOR UPDATE;
 IF o.active THEN RAISE EXCEPTION 'OFFER_PAUSE_REQUIRED'; END IF;
 IF o.deleted_at IS NOT NULL THEN RETURN; END IF;
 UPDATE public.latido_card_offers SET deleted_at=now() WHERE id=p_offer;
 INSERT INTO public.latido_card_admin_audit(actor_id,entity_type,entity_id,action,metadata)
 VALUES(auth.uid(),'latido_card_offers',p_offer,'DELETE',jsonb_build_object('provider_id',pid,'title',o.title));
END $$;

CREATE OR REPLACE FUNCTION public.lc_offer_available(p_member UUID,p_offer UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.latido_card_offers o JOIN public.latido_card_businesses b ON b.provider_id=o.provider_id
 WHERE o.id=p_offer AND o.active AND o.deleted_at IS NULL AND o.starts_at<=now() AND o.ends_at>now() AND b.active AND NOT b.suspended
 AND public.lc_active_member(p_member)
 AND (NOT o.requires_claim OR EXISTS(SELECT 1 FROM public.latido_card_claims c WHERE c.offer_id=o.id AND c.membership_id=p_member AND c.status='claimed' AND c.expires_at>now()))
 AND (o.usage_period='unlimited' OR (SELECT count(*) FROM public.latido_card_redemptions r WHERE r.membership_id=p_member AND r.offer_id=o.id AND r.reversed_at IS NULL AND r.redeemed_at>=public.lc_period_start(o.usage_period))<o.usage_limit))
$$;

CREATE OR REPLACE FUNCTION public.lc_validation(p_redemption UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.latido_card_redemptions; m public.latido_card_memberships; valid BOOLEAN;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 SELECT * INTO m FROM public.latido_card_memberships WHERE user_id=auth.uid();
 SELECT * INTO r FROM public.latido_card_redemptions WHERE id=p_redemption AND membership_id=m.id AND source='member';
 IF r.id IS NULL THEN RAISE EXCEPTION 'VALIDATION_NOT_FOUND'; END IF;
 valid:=r.reversed_at IS NULL AND r.display_valid_until>now() AND public.lc_active_member(m.id)
 AND EXISTS(SELECT 1 FROM public.latido_card_businesses b JOIN public.latido_card_offers o ON o.provider_id=b.provider_id WHERE o.id=r.offer_id AND b.active AND NOT b.suspended AND o.active AND o.deleted_at IS NULL AND o.starts_at<=now() AND o.ends_at>now());
 RETURN jsonb_build_object('id',r.id,'offer_id',r.offer_id,'provider_id',r.provider_id,'business_name',r.offer_snapshot->>'business_name',
 'offer',r.offer_snapshot,'member_reference','•••• '||right(lpad(m.member_number::text,4,'0'),4),
 'redeemed_at',r.redeemed_at,'expires_at',r.display_valid_until,'server_now',clock_timestamp(),'valid',coalesce(valid,false),'reversed',r.reversed_at IS NOT NULL);
END $$;

CREATE OR REPLACE FUNCTION public.lc_business_dashboard(p_provider UUID DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF p_provider IS NOT NULL AND NOT public.lc_can_manage(p_provider) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 RETURN jsonb_build_object('businesses',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'participating',b.provider_id IS NOT NULL,'active',coalesce(b.active,false),'suspended',coalesce(b.suspended,false)) ORDER BY p.name),'[]'::jsonb) FROM public.providers p LEFT JOIN public.latido_card_businesses b ON b.provider_id=p.id WHERE p.user_id=auth.uid() OR public.lc_is_admin()),
 'offers',(SELECT coalesce(jsonb_agg(o ORDER BY o.created_at DESC),'[]'::jsonb) FROM public.latido_card_offers o WHERE o.provider_id=p_provider AND o.deleted_at IS NULL),
 'history',(SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (SELECT r.id,r.offer_snapshot->>'title' AS title,r.redeemed_at,r.reversed_at,r.source FROM public.latido_card_redemptions r WHERE r.provider_id=p_provider ORDER BY r.redeemed_at DESC LIMIT 100) x));
END $$;
REVOKE ALL ON FUNCTION public.lc_protect_offer_terms(),public.lc_catalog(),public.lc_claim_offer(UUID),public.lc_save_offer(UUID,JSONB),public.lc_set_offer_active(UUID,BOOLEAN),public.lc_delete_offer(UUID),public.lc_offer_available(UUID,UUID),public.lc_validation(UUID),public.lc_business_dashboard(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lc_catalog() TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lc_claim_offer(UUID),public.lc_save_offer(UUID,JSONB),public.lc_set_offer_active(UUID,BOOLEAN),public.lc_delete_offer(UUID),public.lc_validation(UUID),public.lc_business_dashboard(UUID) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
