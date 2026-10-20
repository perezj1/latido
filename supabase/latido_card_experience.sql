-- Card experience: install after business_participation and offer_activation.
-- Transactional and rerunnable. No direct grants on tables. Never run automatically in production.
BEGIN;
-- The month always starts at midnight in Zurich, including DST changes.
ALTER TABLE public.latido_card_offers ADD COLUMN IF NOT EXISTS original_draft JSONB;
ALTER TABLE public.latido_card_offers DROP CONSTRAINT IF EXISTS lc_original_draft_size;
ALTER TABLE public.latido_card_offers ADD CONSTRAINT lc_original_draft_size CHECK (original_draft IS NULL OR (jsonb_typeof(original_draft)='object' AND octet_length(original_draft::text)<=12000));
CREATE OR REPLACE FUNCTION public.lc_catalog() RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',o.id,'provider_id',o.provider_id,'business_name',p.name,
 'city',p.city,'category',to_jsonb(p)->>'category','business_photo_url',p.photo_url,'title',o.title,'description',o.description,'benefit_type',o.benefit_type,
 'benefit_value',o.benefit_value,'minimum_spend',o.minimum_spend,'requires_claim',o.requires_claim,'activation_mode',o.activation_mode,
 'usage_period',o.usage_period,'usage_limit',o.usage_limit,'ends_at',o.ends_at,
 'remaining',CASE WHEN o.stock_total IS NULL THEN NULL ELSE greatest(0,o.stock_total-(SELECT count(*) FROM public.latido_card_claims c
 WHERE c.offer_id=o.id AND (c.status='used' OR (c.status='claimed' AND c.expires_at>now())))) END)
 ORDER BY p.name,o.requires_claim,o.created_at),'[]'::jsonb)
 FROM public.latido_card_offers o JOIN public.latido_card_businesses b ON b.provider_id=o.provider_id AND b.active
 JOIN public.providers p ON p.id=o.provider_id
 WHERE o.active AND o.deleted_at IS NULL AND o.starts_at<=now() AND o.ends_at>now() AND NOT b.suspended AND coalesce((to_jsonb(p)->>'active')::boolean,true) AND to_jsonb(p)->>'deleted_at' IS NULL
$$;
CREATE OR REPLACE FUNCTION public.lc_participating_businesses() RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'city',p.city,'category',to_jsonb(p)->>'category','photo_url',p.photo_url)
 ORDER BY lower(p.name),p.id),'[]'::jsonb)
 FROM public.latido_card_businesses b JOIN public.providers p ON p.id=b.provider_id
 WHERE b.active AND NOT b.suspended
 AND coalesce((to_jsonb(p)->>'active')::boolean,true) AND to_jsonb(p)->>'deleted_at' IS NULL
 AND EXISTS (SELECT 1 FROM public.latido_card_offers o WHERE o.provider_id=b.provider_id
   AND o.active AND to_jsonb(o)->>'deleted_at' IS NULL AND o.starts_at<=now() AND o.ends_at>now())
$$;
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
 'validation',(SELECT jsonb_build_object('id',r.id,'expires_at',r.display_valid_until) FROM public.latido_card_redemptions r WHERE r.membership_id=m.id AND r.offer_id=o.id AND public.lc_active_member(m.id) AND r.source='member' AND r.reversed_at IS NULL AND r.display_valid_until>now() ORDER BY r.redeemed_at DESC LIMIT 1))),'[]'::jsonb)
 INTO offers FROM jsonb_array_elements(public.lc_catalog()) item JOIN public.latido_card_offers o ON o.id=(item->>'id')::uuid;
 RETURN jsonb_build_object('server_now',clock_timestamp(),'membership',CASE WHEN m.id IS NULL THEN NULL ELSE jsonb_build_object('id',m.id,'member_number',m.member_number,'status',m.status,'active',public.lc_active_member(m.id),'valid_until',m.valid_until) END,'offers',offers,
 'history',(SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (SELECT r.id,r.request_id,r.offer_id,r.provider_id,r.offer_snapshot,r.offer_snapshot->>'title' AS title,coalesce(r.offer_snapshot->>'business_name',p.name) AS business_name,r.redeemed_at,r.reversed_at,r.source,r.display_valid_until FROM public.latido_card_redemptions r JOIN public.providers p ON p.id=r.provider_id WHERE r.membership_id=m.id ORDER BY r.redeemed_at DESC LIMIT 100) x));
END $$;
CREATE OR REPLACE FUNCTION public.lc_save_offer(p_provider UUID,p_offer JSONB) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE oid UUID;
BEGIN
 IF NOT public.lc_can_manage(p_provider) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 -- Publication and program enrollment are one transaction. Invalid offers roll both back.
 PERFORM 1 FROM public.providers p WHERE p.id=p_provider
   AND coalesce((to_jsonb(p)->>'active')::boolean,true) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'BUSINESS_INACTIVE'; END IF;
 IF NOT public.lc_can_manage(p_provider) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 INSERT INTO public.latido_card_businesses(provider_id,active) VALUES(p_provider,true) ON CONFLICT DO NOTHING;
 PERFORM 1 FROM public.latido_card_businesses WHERE provider_id=p_provider AND suspended FOR UPDATE;
 IF FOUND THEN RAISE EXCEPTION 'BUSINESS_SUSPENDED'; END IF;
 UPDATE public.latido_card_businesses SET active=true WHERE provider_id=p_provider AND NOT active;
 PERFORM 1 FROM public.latido_card_businesses WHERE provider_id=p_provider AND active AND NOT suspended FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'BUSINESS_INACTIVE'; END IF;
 INSERT INTO public.latido_card_offers(provider_id,title,description,benefit_type,benefit_value,minimum_spend,requires_claim,stock_total,claim_days,usage_period,usage_limit,ends_at,activation_mode,original_draft)
 VALUES(p_provider,p_offer->>'title',coalesce(p_offer->>'description',''),p_offer->>'benefit_type',nullif(p_offer->>'benefit_value','')::numeric,
 coalesce(nullif(p_offer->>'minimum_spend','')::numeric,0),coalesce((p_offer->>'requires_claim')::boolean,false),nullif(p_offer->>'stock_total','')::integer,
 coalesce((p_offer->>'claim_days')::integer,7),coalesce(p_offer->>'usage_period','month'),coalesce((p_offer->>'usage_limit')::integer,1),(p_offer->>'ends_at')::timestamptz,coalesce(p_offer->>'activation_mode','manual'),p_offer->'original_draft') RETURNING id INTO oid;
 RETURN oid;
END $$;
CREATE OR REPLACE FUNCTION public.lc_business_benefits(p_provider UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('business',(SELECT jsonb_build_object('id',p.id,'name',p.name,'city',p.city,
 'photo_url',p.photo_url,'category',to_jsonb(p)->>'category','address',to_jsonb(p)->>'address',
 'phone',to_jsonb(p)->>'phone','hours',coalesce(to_jsonb(p)->'opening_hours',to_jsonb(p)->'hours'))
 FROM public.providers p JOIN public.latido_card_businesses b ON b.provider_id=p.id
 WHERE p.id=p_provider AND b.active AND NOT b.suspended
 AND coalesce((to_jsonb(p)->>'active')::boolean,true) AND to_jsonb(p)->>'deleted_at' IS NULL),
 'offers',(SELECT coalesce(jsonb_agg(item),'[]'::jsonb) FROM jsonb_array_elements(public.lc_catalog()) item WHERE (item->>'provider_id')::uuid=p_provider))
$$;

CREATE OR REPLACE FUNCTION public.lc_business_dashboard(p_provider UUID DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE month_start TIMESTAMPTZ := date_trunc('month',now() AT TIME ZONE 'Europe/Zurich') AT TIME ZONE 'Europe/Zurich';
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF p_provider IS NOT NULL AND NOT public.lc_can_manage(p_provider) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 RETURN jsonb_build_object('server_now',clock_timestamp(),
 'businesses',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'city',p.city,'photo_url',p.photo_url,
 'published',coalesce((to_jsonb(p)->>'active')::boolean,true),'participating',b.provider_id IS NOT NULL,
 'active',coalesce(b.active,false),'suspended',coalesce(b.suspended,false)) ORDER BY p.name),'[]'::jsonb)
 FROM public.providers p LEFT JOIN public.latido_card_businesses b ON b.provider_id=p.id
 WHERE to_jsonb(p)->>'deleted_at' IS NULL AND (p.user_id=auth.uid() OR public.lc_is_admin())),
 'summary',(SELECT jsonb_build_object('month_uses',count(*) FILTER (WHERE r.redeemed_at>=month_start),
 'month_members',count(DISTINCT r.membership_id) FILTER (WHERE r.redeemed_at>=month_start),'total_uses',count(*))
 FROM public.latido_card_redemptions r WHERE r.provider_id=p_provider AND r.reversed_at IS NULL),
 'offers',(SELECT coalesce(jsonb_agg(to_jsonb(o)||jsonb_build_object(
 'has_activity',EXISTS(SELECT 1 FROM public.latido_card_claims c WHERE c.offer_id=o.id) OR EXISTS(SELECT 1 FROM public.latido_card_redemptions r WHERE r.offer_id=o.id),
 'month_uses',(SELECT count(*) FROM public.latido_card_redemptions r WHERE r.offer_id=o.id AND r.reversed_at IS NULL AND r.redeemed_at>=month_start),
 'remaining',CASE WHEN o.stock_total IS NULL THEN NULL ELSE greatest(0,o.stock_total-(SELECT count(*) FROM public.latido_card_claims c WHERE c.offer_id=o.id AND (c.status='used' OR (c.status='claimed' AND c.expires_at>now())))) END)
 ORDER BY o.created_at DESC),'[]'::jsonb) FROM public.latido_card_offers o WHERE o.provider_id=p_provider AND o.deleted_at IS NULL),
 'history',(SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (SELECT r.id,r.offer_id,r.offer_snapshot->>'title' AS title,r.redeemed_at,r.reversed_at,r.source,
 '•••• '||right(lpad(m.member_number::text,4,'0'),4) AS member_reference
 FROM public.latido_card_redemptions r JOIN public.latido_card_memberships m ON m.id=r.membership_id
 WHERE r.provider_id=p_provider ORDER BY r.redeemed_at DESC LIMIT 100) x));
END $$;

CREATE OR REPLACE FUNCTION public.lc_update_offer(p_offer_id UUID,p_offer JSONB) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old_offer public.latido_card_offers; target UUID;
BEGIN
 SELECT provider_id INTO target FROM public.latido_card_offers WHERE id=p_offer_id;
 IF target IS NULL OR NOT public.lc_can_manage(target) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 -- Serialize edits, replacements and new publications using the same lock order.
 PERFORM 1 FROM public.providers WHERE id=target FOR UPDATE;
 SELECT * INTO old_offer FROM public.latido_card_offers WHERE id=p_offer_id FOR UPDATE;
 IF old_offer.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'OFFER_UNAVAILABLE'; END IF;
 IF EXISTS(SELECT 1 FROM public.latido_card_claims WHERE offer_id=p_offer_id)
 OR EXISTS(SELECT 1 FROM public.latido_card_redemptions WHERE offer_id=p_offer_id) THEN RAISE EXCEPTION 'OFFER_TERMS_LOCKED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.providers p WHERE p.id=target AND coalesce((to_jsonb(p)->>'active')::boolean,true)) THEN RAISE EXCEPTION 'BUSINESS_INACTIVE'; END IF;
 PERFORM 1 FROM public.latido_card_businesses WHERE provider_id=target AND NOT suspended FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'BUSINESS_SUSPENDED'; END IF;
 UPDATE public.latido_card_offers SET title=p_offer->>'title',description=coalesce(p_offer->>'description',''),
 benefit_type=p_offer->>'benefit_type',benefit_value=nullif(p_offer->>'benefit_value','')::numeric,
 minimum_spend=coalesce((p_offer->>'minimum_spend')::numeric,0),requires_claim=coalesce((p_offer->>'requires_claim')::boolean,false),
 stock_total=nullif(p_offer->>'stock_total','')::integer,usage_period=coalesce(p_offer->>'usage_period','month'),
 usage_limit=coalesce((p_offer->>'usage_limit')::integer,1),ends_at=(p_offer->>'ends_at')::timestamptz,
 activation_mode='manual',original_draft=p_offer->'original_draft' WHERE id=p_offer_id;
 RETURN p_offer_id;
END $$;

CREATE OR REPLACE FUNCTION public.lc_replace_offer(p_old UUID,p_offer JSONB) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old_offer public.latido_card_offers; target UUID; new_id UUID;
BEGIN
 SELECT provider_id INTO target FROM public.latido_card_offers WHERE id=p_old;
 IF target IS NULL OR NOT public.lc_can_manage(target) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM 1 FROM public.providers WHERE id=target FOR UPDATE;
 SELECT * INTO old_offer FROM public.latido_card_offers WHERE id=p_old FOR UPDATE;
 IF old_offer.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'OFFER_UNAVAILABLE'; END IF;
 UPDATE public.latido_card_offers SET active=false WHERE id=p_old;
 new_id := public.lc_save_offer(target,p_offer);
 RETURN new_id;
END $$;

REVOKE ALL ON FUNCTION public.lc_update_offer(UUID,JSONB),public.lc_replace_offer(UUID,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lc_update_offer(UUID,JSONB),public.lc_replace_offer(UUID,JSONB) TO authenticated;
REVOKE ALL ON FUNCTION public.lc_business_dashboard(UUID),public.lc_member_home(),public.lc_save_offer(UUID,JSONB) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.lc_business_dashboard(UUID),public.lc_member_home(),public.lc_save_offer(UUID,JSONB) TO authenticated;
REVOKE ALL ON FUNCTION public.lc_catalog(),public.lc_participating_businesses(),public.lc_business_benefits(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lc_catalog(),public.lc_participating_businesses(),public.lc_business_benefits(UUID) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
