-- Existing installations: enrollment happens only when an offer is published.
-- Run after the current minimal/activation modules. Rerunnable; preserves offers and history.
BEGIN;
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
 INSERT INTO public.latido_card_offers(provider_id,title,description,benefit_type,benefit_value,minimum_spend,requires_claim,stock_total,claim_days,usage_period,usage_limit,ends_at,activation_mode)
 VALUES(p_provider,p_offer->>'title',coalesce(p_offer->>'description',''),p_offer->>'benefit_type',nullif(p_offer->>'benefit_value','')::numeric,
 coalesce(nullif(p_offer->>'minimum_spend','')::numeric,0),coalesce((p_offer->>'requires_claim')::boolean,false),nullif(p_offer->>'stock_total','')::integer,
 coalesce((p_offer->>'claim_days')::integer,7),coalesce(p_offer->>'usage_period','month'),coalesce((p_offer->>'usage_limit')::integer,1),(p_offer->>'ends_at')::timestamptz,coalesce(p_offer->>'activation_mode','manual')) RETURNING id INTO oid;
 RETURN oid;
END $$;
CREATE OR REPLACE FUNCTION public.lc_join_card_business(p_provider UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b public.latido_card_businesses;
BEGIN
 PERFORM 1 FROM public.providers WHERE id=p_provider FOR UPDATE;
 IF NOT public.lc_can_manage(p_provider) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.latido_card_offers WHERE provider_id=p_provider AND active
   AND deleted_at IS NULL AND starts_at<=now() AND ends_at>now()) THEN RAISE EXCEPTION 'OFFER_REQUIRED'; END IF;
 INSERT INTO public.latido_card_businesses(provider_id,active) VALUES(p_provider,true) ON CONFLICT DO NOTHING;
 SELECT * INTO b FROM public.latido_card_businesses WHERE provider_id=p_provider FOR UPDATE;
 IF b.suspended THEN RAISE EXCEPTION 'BUSINESS_SUSPENDED'; END IF;
 UPDATE public.latido_card_businesses SET active=true WHERE provider_id=p_provider AND NOT active;
END $$;
CREATE OR REPLACE FUNCTION public.lc_participating_businesses() RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'city',p.city,'photo_url',p.photo_url)
 ORDER BY lower(p.name),p.id),'[]'::jsonb)
 FROM public.latido_card_businesses b JOIN public.providers p ON p.id=b.provider_id
 WHERE b.active AND NOT b.suspended
 AND coalesce((to_jsonb(p)->>'active')::boolean,true) AND to_jsonb(p)->>'deleted_at' IS NULL
 AND EXISTS (SELECT 1 FROM public.latido_card_offers o WHERE o.provider_id=b.provider_id
   AND o.active AND to_jsonb(o)->>'deleted_at' IS NULL AND o.starts_at<=now() AND o.ends_at>now())
$$;
REVOKE ALL ON FUNCTION public.lc_participating_businesses() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lc_participating_businesses() TO anon,authenticated;

-- Retire empty registrations left by the previous manager preview, preserving all history.
REVOKE ALL ON FUNCTION public.lc_save_offer(UUID,JSONB),public.lc_join_card_business(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lc_save_offer(UUID,JSONB),public.lc_join_card_business(UUID) TO authenticated;
UPDATE public.latido_card_businesses b SET active=false WHERE b.active
AND NOT EXISTS (SELECT 1 FROM public.latido_card_offers o WHERE o.provider_id=b.provider_id);
NOTIFY pgrst,'reload schema';
COMMIT;
