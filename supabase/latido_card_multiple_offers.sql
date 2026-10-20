-- Ejecutar manualmente en el SQL Editor de Supabase con rol postgres.
-- Requiere latido_card_experience.sql y los modulos anteriores ya instalados.
-- Permite varias ofertas habituales y promociones activas por negocio.
-- No modifica ofertas existentes, reservas, usos ni condiciones por socio.
-- Transaccional y reutilizable.
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
 INSERT INTO public.latido_card_offers(provider_id,title,description,benefit_type,benefit_value,minimum_spend,requires_claim,stock_total,claim_days,usage_period,usage_limit,ends_at,activation_mode,original_draft)
 VALUES(p_provider,p_offer->>'title',coalesce(p_offer->>'description',''),p_offer->>'benefit_type',nullif(p_offer->>'benefit_value','')::numeric,
 coalesce(nullif(p_offer->>'minimum_spend','')::numeric,0),coalesce((p_offer->>'requires_claim')::boolean,false),nullif(p_offer->>'stock_total','')::integer,
 coalesce((p_offer->>'claim_days')::integer,7),coalesce(p_offer->>'usage_period','month'),coalesce((p_offer->>'usage_limit')::integer,1),(p_offer->>'ends_at')::timestamptz,coalesce(p_offer->>'activation_mode','manual'),p_offer->'original_draft') RETURNING id INTO oid;
 RETURN oid;
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
 UPDATE public.latido_card_offers SET active=p_active WHERE id=p_offer;
END $$;

REVOKE ALL ON FUNCTION public.lc_save_offer(UUID,JSONB),public.lc_update_offer(UUID,JSONB),public.lc_set_offer_active(UUID,BOOLEAN) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lc_save_offer(UUID,JSONB),public.lc_update_offer(UUID,JSONB),public.lc_set_offer_active(UUID,BOOLEAN) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
