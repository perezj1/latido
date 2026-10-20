-- Tarjeta Latido minimal: installer AND upgrade. Run this file first.
-- Prerequisites: existing Latido profiles/providers and is_business_promotion_admin().
-- Preserves memberships, offers, reservations and all recorded uses. No payments are created.
BEGIN;
CREATE TABLE IF NOT EXISTS public.latido_card_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id),
  member_number BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL DEFAULT 'pilot' CHECK (source IN ('pilot','stripe')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (valid_until > starts_at)
);
CREATE TABLE IF NOT EXISTS public.latido_card_businesses (
  provider_id UUID PRIMARY KEY REFERENCES public.providers(id),
  active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.latido_card_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.latido_card_businesses(provider_id),
  title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 120),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  benefit_type TEXT NOT NULL CHECK (benefit_type IN ('percent','fixed','gift','service','two_for_one')),
  benefit_value NUMERIC(10,2),
  minimum_spend NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (minimum_spend >= 0),
  requires_claim BOOLEAN NOT NULL DEFAULT false,
  stock_total INTEGER CHECK (stock_total > 0),
  claim_days INTEGER NOT NULL DEFAULT 7 CHECK (claim_days BETWEEN 1 AND 90),
  usage_period TEXT NOT NULL DEFAULT 'month' CHECK (usage_period IN ('month','lifetime','unlimited')),
  usage_limit INTEGER NOT NULL DEFAULT 1 CHECK (usage_limit BETWEEN 1 AND 1000),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (stock_total IS NULL OR requires_claim),
  CHECK (NOT requires_claim OR (usage_period = 'lifetime' AND usage_limit = 1)),
  CHECK ((benefit_type = 'percent' AND benefit_value IS NOT NULL AND benefit_value > 0 AND benefit_value <= 100)
    OR (benefit_type = 'fixed' AND benefit_value IS NOT NULL AND benefit_value > 0)
    OR (benefit_type IN ('gift','service','two_for_one') AND benefit_value IS NULL))
);
CREATE TABLE IF NOT EXISTS public.latido_card_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID NOT NULL REFERENCES public.latido_card_memberships(id),
  offer_id UUID NOT NULL REFERENCES public.latido_card_offers(id),
  status TEXT NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed','used','released')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (membership_id, offer_id)
);
CREATE TABLE IF NOT EXISTS public.latido_card_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE,
  membership_id UUID NOT NULL REFERENCES public.latido_card_memberships(id),
  offer_id UUID NOT NULL REFERENCES public.latido_card_offers(id),
  provider_id UUID NOT NULL REFERENCES public.latido_card_businesses(provider_id),
  offer_snapshot JSONB NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reversed_at TIMESTAMPTZ,
  reversed_by UUID REFERENCES public.profiles(id),
  reversal_reason TEXT
);
CREATE TABLE IF NOT EXISTS public.latido_card_admin_audit (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_id UUID REFERENCES public.profiles(id),
 entity_type TEXT NOT NULL,
 entity_id UUID NOT NULL,
 action TEXT NOT NULL,
 metadata JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.latido_card_businesses ADD COLUMN IF NOT EXISTS suspended BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.latido_card_offers ADD COLUMN IF NOT EXISTS activation_mode TEXT NOT NULL DEFAULT 'manual' CHECK (activation_mode IN ('automatic','manual'));
ALTER TABLE public.latido_card_offers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.latido_card_offers'::regclass AND conname='lc_offer_deleted_paused') THEN
  ALTER TABLE public.latido_card_offers ADD CONSTRAINT lc_offer_deleted_paused CHECK (deleted_at IS NULL OR NOT active);
 END IF;
END $$;
ALTER TABLE public.latido_card_offers DROP CONSTRAINT IF EXISTS latido_card_offers_usage_period_check;
ALTER TABLE public.latido_card_offers ADD CONSTRAINT latido_card_offers_usage_period_check CHECK (usage_period IN ('day','week','month','lifetime','unlimited'));
ALTER TABLE public.latido_card_redemptions ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'legacy_scanner' CHECK (source IN ('legacy_scanner','member'));
ALTER TABLE public.latido_card_redemptions ADD COLUMN IF NOT EXISTS display_valid_until TIMESTAMPTZ;
ALTER TABLE public.latido_card_redemptions ADD COLUMN IF NOT EXISTS legacy_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='latido_card_redemptions' AND column_name='scanner_session_id') THEN
  ALTER TABLE public.latido_card_redemptions ALTER COLUMN scanner_session_id DROP NOT NULL;
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS lc_offers_business_idx ON public.latido_card_offers(provider_id);
CREATE INDEX IF NOT EXISTS lc_redemptions_usage_idx ON public.latido_card_redemptions(membership_id,offer_id,redeemed_at) WHERE reversed_at IS NULL;
CREATE INDEX IF NOT EXISTS lc_redemptions_business_idx ON public.latido_card_redemptions(provider_id,redeemed_at DESC);
DO $$ DECLARE t TEXT; BEGIN
 FOREACH t IN ARRAY ARRAY['memberships','businesses','offers','claims','redemptions','admin_audit'] LOOP
  EXECUTE format('ALTER TABLE public.latido_card_%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.latido_card_%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT ALL ON public.latido_card_%I TO service_role',t);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.lc_is_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT auth.uid() IS NOT NULL AND public.is_business_promotion_admin()
$$;
CREATE OR REPLACE FUNCTION public.lc_can_manage(p_provider UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
 SELECT 1 FROM public.providers p WHERE p.id=p_provider AND to_jsonb(p)->>'deleted_at' IS NULL
 AND (p.user_id=auth.uid() OR public.lc_is_admin()))
$$;
CREATE OR REPLACE FUNCTION public.lc_active_member(p_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT EXISTS (SELECT 1 FROM public.latido_card_memberships m
 WHERE m.id=p_id AND m.status='active' AND m.starts_at<=now() AND m.valid_until>now())
$$;
CREATE OR REPLACE FUNCTION public.lc_protect_offer_terms() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF (to_jsonb(NEW)-'active'-'deleted_at') IS DISTINCT FROM (to_jsonb(OLD)-'active'-'deleted_at') AND (
 EXISTS (SELECT 1 FROM public.latido_card_claims WHERE offer_id=OLD.id)
 OR EXISTS (SELECT 1 FROM public.latido_card_redemptions WHERE offer_id=OLD.id)) THEN
 RAISE EXCEPTION 'OFFER_TERMS_LOCKED'; END IF;
 RETURN NEW;
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
CREATE OR REPLACE FUNCTION public.lc_release_claim(p_offer UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 PERFORM 1 FROM public.latido_card_memberships WHERE user_id=auth.uid() FOR UPDATE;
 PERFORM 1 FROM public.latido_card_offers WHERE id=p_offer FOR UPDATE;
 UPDATE public.latido_card_claims SET status='released' WHERE offer_id=p_offer AND status='claimed'
 AND membership_id IN (SELECT id FROM public.latido_card_memberships WHERE user_id=auth.uid());
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
CREATE OR REPLACE FUNCTION public.lc_reverse_redemption(p_redemption UUID,p_reason TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.latido_card_redemptions;
BEGIN
 SELECT * INTO r FROM public.latido_card_redemptions WHERE id=p_redemption;
 IF NOT public.lc_can_manage(r.provider_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF length(btrim(coalesce(p_reason,'')))<3 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
 PERFORM 1 FROM public.latido_card_memberships WHERE id=r.membership_id FOR UPDATE;
 PERFORM 1 FROM public.latido_card_offers WHERE id=r.offer_id FOR UPDATE;
 UPDATE public.latido_card_redemptions SET reversed_at=now(),reversed_by=auth.uid(),reversal_reason=left(p_reason,500) WHERE id=r.id AND reversed_at IS NULL;
 IF FOUND THEN
  UPDATE public.latido_card_claims SET status='claimed' WHERE offer_id=r.offer_id AND membership_id=r.membership_id AND status='used';
  INSERT INTO public.latido_card_admin_audit(actor_id,entity_type,entity_id,action,metadata)
  VALUES(auth.uid(),'latido_card_redemptions',r.id,'REVERSE',jsonb_build_object('reason',left(p_reason,500),'provider_id',r.provider_id,'offer_id',r.offer_id));
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.lc_admin_enroll(p_user UUID,p_valid_until TIMESTAMPTZ,p_status TEXT DEFAULT 'active') RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE mid UUID;
BEGIN
 IF NOT public.lc_is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 INSERT INTO public.latido_card_memberships(user_id,valid_until,status) VALUES(p_user,p_valid_until,p_status)
 ON CONFLICT(user_id) DO UPDATE SET valid_until=excluded.valid_until,status=excluded.status RETURNING id INTO mid;
 RETURN mid;
END $$;
CREATE OR REPLACE FUNCTION public.lc_record_admin_action() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE data JSONB:=to_jsonb(NEW); safe_data JSONB;
BEGIN
 IF NOT public.lc_is_admin() THEN RETURN NEW; END IF;
 safe_data:=jsonb_build_object('status',data->'status','valid_until',data->'valid_until','active',data->'active','suspended',data->'suspended');
 INSERT INTO public.latido_card_admin_audit(actor_id,entity_type,entity_id,action,metadata)
 VALUES(auth.uid(),TG_TABLE_NAME,coalesce((data->>'id')::uuid,(data->>'provider_id')::uuid),TG_OP,safe_data);
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS lc_offer_terms ON public.latido_card_offers;
CREATE TRIGGER lc_offer_terms BEFORE UPDATE ON public.latido_card_offers FOR EACH ROW EXECUTE FUNCTION public.lc_protect_offer_terms();
DROP TRIGGER IF EXISTS lc_membership_admin_audit ON public.latido_card_memberships;
CREATE TRIGGER lc_membership_admin_audit AFTER INSERT OR UPDATE ON public.latido_card_memberships FOR EACH ROW EXECUTE FUNCTION public.lc_record_admin_action();
DROP TRIGGER IF EXISTS lc_business_admin_audit ON public.latido_card_businesses;
CREATE TRIGGER lc_business_admin_audit AFTER INSERT OR UPDATE ON public.latido_card_businesses FOR EACH ROW EXECUTE FUNCTION public.lc_record_admin_action();
-- Calendar periods use the local Swiss calendar, including daylight-saving changes.
CREATE OR REPLACE FUNCTION public.lc_period_start(p_period TEXT,p_at TIMESTAMPTZ DEFAULT now()) RETURNS TIMESTAMPTZ
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE WHEN p_period IN ('day','week','month') THEN date_trunc(p_period,p_at AT TIME ZONE 'Europe/Zurich') AT TIME ZONE 'Europe/Zurich' ELSE '-infinity'::timestamptz END
$$;
CREATE OR REPLACE FUNCTION public.lc_next_period(p_period TEXT,p_at TIMESTAMPTZ DEFAULT now()) RETURNS TIMESTAMPTZ
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE WHEN p_period IN ('day','week','month') THEN
 (date_trunc(p_period,p_at AT TIME ZONE 'Europe/Zurich') + CASE p_period WHEN 'day' THEN interval '1 day' WHEN 'week' THEN interval '1 week' ELSE interval '1 month' END) AT TIME ZONE 'Europe/Zurich' END
$$;
CREATE OR REPLACE FUNCTION public.lc_offer_available(p_member UUID,p_offer UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.latido_card_offers o JOIN public.latido_card_businesses b ON b.provider_id=o.provider_id
 WHERE o.id=p_offer AND o.active AND o.deleted_at IS NULL AND o.starts_at<=now() AND o.ends_at>now() AND b.active AND NOT b.suspended
 AND public.lc_active_member(p_member)
 AND (NOT o.requires_claim OR EXISTS(SELECT 1 FROM public.latido_card_claims c WHERE c.offer_id=o.id AND c.membership_id=p_member AND c.status='claimed' AND c.expires_at>now()))
 AND (o.usage_period='unlimited' OR (SELECT count(*) FROM public.latido_card_redemptions r WHERE r.membership_id=p_member AND r.offer_id=o.id AND r.reversed_at IS NULL AND r.redeemed_at>=public.lc_period_start(o.usage_period))<o.usage_limit))
$$;

-- A receipt is private: knowing its UUID never grants access to another member.
-- Returning it does not extend its original lifetime or record another use.
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

CREATE OR REPLACE FUNCTION public.lc_business_benefits(p_provider UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('business',(SELECT jsonb_build_object('id',p.id,'name',p.name,'city',p.city,'photo_url',p.photo_url) FROM public.providers p JOIN public.latido_card_businesses b ON b.provider_id=p.id WHERE p.id=p_provider AND b.active AND NOT b.suspended),
 'offers',(SELECT coalesce(jsonb_agg(item),'[]'::jsonb) FROM jsonb_array_elements(public.lc_catalog()) item WHERE (item->>'provider_id')::uuid=p_provider))
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
 'validation',(SELECT jsonb_build_object('id',r.id,'expires_at',r.display_valid_until) FROM public.latido_card_redemptions r WHERE r.membership_id=m.id AND r.offer_id=o.id AND r.source='member' AND r.reversed_at IS NULL AND r.display_valid_until>now() ORDER BY r.redeemed_at DESC LIMIT 1))),'[]'::jsonb)
 INTO offers FROM jsonb_array_elements(public.lc_catalog()) item JOIN public.latido_card_offers o ON o.id=(item->>'id')::uuid;
 RETURN jsonb_build_object('membership',CASE WHEN m.id IS NULL THEN NULL ELSE jsonb_build_object('id',m.id,'member_number',m.member_number,'status',m.status,'active',public.lc_active_member(m.id),'valid_until',m.valid_until) END,'offers',offers,
 'history',(SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (SELECT r.id,r.request_id,r.offer_id,r.provider_id,r.offer_snapshot,r.offer_snapshot->>'title' AS title,coalesce(r.offer_snapshot->>'business_name',p.name) AS business_name,r.redeemed_at,r.reversed_at,r.source,r.display_valid_until FROM public.latido_card_redemptions r JOIN public.providers p ON p.id=r.provider_id WHERE r.membership_id=m.id ORDER BY r.redeemed_at DESC LIMIT 100) x));
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
CREATE OR REPLACE FUNCTION public.lc_admin_business(p_provider UUID,p_active BOOLEAN) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.lc_is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF NOT public.lc_can_manage(p_provider) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 INSERT INTO public.latido_card_businesses(provider_id,active,suspended) VALUES(p_provider,p_active,NOT p_active)
 ON CONFLICT(provider_id) DO UPDATE SET active=excluded.active,suspended=excluded.suspended;
END $$;
CREATE OR REPLACE FUNCTION public.lc_business_dashboard(p_provider UUID DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF p_provider IS NOT NULL AND NOT public.lc_can_manage(p_provider) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 RETURN jsonb_build_object('businesses',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'participating',b.provider_id IS NOT NULL,'active',coalesce(b.active,false),'suspended',coalesce(b.suspended,false)) ORDER BY p.name),'[]'::jsonb) FROM public.providers p LEFT JOIN public.latido_card_businesses b ON b.provider_id=p.id WHERE to_jsonb(p)->>'deleted_at' IS NULL AND (p.user_id=auth.uid() OR public.lc_is_admin())),
 'offers',(SELECT coalesce(jsonb_agg(o ORDER BY o.created_at DESC),'[]'::jsonb) FROM public.latido_card_offers o WHERE o.provider_id=p_provider AND o.deleted_at IS NULL),
 'history',(SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (SELECT r.id,r.offer_snapshot->>'title' AS title,r.redeemed_at,r.reversed_at,r.source FROM public.latido_card_redemptions r WHERE r.provider_id=p_provider ORDER BY r.redeemed_at DESC LIMIT 100) x));
END $$;
CREATE OR REPLACE FUNCTION public.lc_admin_overview(p_search TEXT DEFAULT '') RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.lc_is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 RETURN jsonb_build_object('members',(SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (SELECT p.id AS user_id,p.name,p.email,m.id,m.member_number,m.status,m.valid_until FROM public.profiles p LEFT JOIN public.latido_card_memberships m ON m.user_id=p.id WHERE coalesce(p.name,'') ILIKE '%'||left(p_search,100)||'%' OR coalesce(p.email,'') ILIKE '%'||left(p_search,100)||'%' ORDER BY m.created_at DESC NULLS LAST,p.name LIMIT 100) x),
 'businesses',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'active',coalesce(b.active,false),'suspended',coalesce(b.suspended,false)) ORDER BY p.name),'[]'::jsonb) FROM public.providers p JOIN public.latido_card_businesses b ON b.provider_id=p.id),
 'stats',jsonb_build_object('active_members',(SELECT count(*) FROM public.latido_card_memberships m WHERE public.lc_active_member(m.id)),'active_businesses',(SELECT count(*) FROM public.latido_card_businesses WHERE active AND NOT suspended),'active_offers',(SELECT count(*) FROM public.latido_card_offers o JOIN public.latido_card_businesses b ON b.provider_id=o.provider_id WHERE o.active AND o.ends_at>now() AND b.active AND NOT b.suspended),'uses',(SELECT count(*) FROM public.latido_card_redemptions WHERE reversed_at IS NULL)),
 'audit',(SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (SELECT a.*,p.name AS actor_name FROM public.latido_card_admin_audit a LEFT JOIN public.profiles p ON p.id=a.actor_id ORDER BY a.created_at DESC LIMIT 100) x));
END $$;

-- Retire every old API immediately, even before the separate archival cleanup.
DO $$ DECLARE f RECORD; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'lc\_%' ESCAPE '\' LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.lc_catalog(),public.lc_business_benefits(UUID),public.lc_participating_businesses() TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lc_member_home(),public.lc_claim_offer(UUID),public.lc_release_claim(UUID),public.lc_use_offer(UUID,UUID),public.lc_validation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lc_business_dashboard(UUID),public.lc_join_card_business(UUID),public.lc_save_offer(UUID,JSONB),public.lc_set_offer_active(UUID,BOOLEAN),public.lc_delete_offer(UUID),public.lc_reverse_redemption(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lc_admin_overview(TEXT),public.lc_admin_enroll(UUID,TIMESTAMPTZ,TEXT),public.lc_admin_business(UUID,BOOLEAN) TO authenticated;
-- Preserve optional owner invitations when this installer is re-run after the add-on.
DO $$ BEGIN
 IF to_regprocedure('public.lc_business_invitation()') IS NOT NULL THEN
  GRANT EXECUTE ON FUNCTION public.lc_business_invitation() TO authenticated;
 END IF;
END $$;
NOTIFY pgrst,'reload schema';
-- Removing a publication retains the private records needed by its usage history.
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lc_hide_deleted_providers ON public.providers;
CREATE POLICY lc_hide_deleted_providers ON public.providers AS RESTRICTIVE
  FOR ALL TO anon,authenticated USING(deleted_at IS NULL) WITH CHECK(deleted_at IS NULL);

CREATE OR REPLACE FUNCTION public.lc_archive_deleted_business() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  -- Unrelated businesses keep the existing DELETE behaviour and guards.
  PERFORM 1 FROM public.latido_card_businesses WHERE provider_id=OLD.id FOR UPDATE;
  IF NOT FOUND THEN RETURN OLD; END IF;
  UPDATE public.providers SET active=false,deleted_at=clock_timestamp() WHERE id=OLD.id;
  UPDATE public.latido_card_businesses SET active=false,suspended=true WHERE provider_id=OLD.id;
  UPDATE public.latido_card_offers SET active=false WHERE provider_id=OLD.id AND active;
  -- Suppress the physical DELETE: provider/offers/receipts retain their foreign keys.
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.lc_archive_deleted_business() FROM PUBLIC,anon,authenticated;
-- PostgreSQL runs BEFORE triggers alphabetically. Existing subscription deletion guards
-- (prevent_provider_delete_with_active_subscription) must run before this archive action.
DROP TRIGGER IF EXISTS zz_lc_archive_deleted_business ON public.providers;
CREATE TRIGGER zz_lc_archive_deleted_business BEFORE DELETE ON public.providers
FOR EACH ROW EXECUTE FUNCTION public.lc_archive_deleted_business();

CREATE OR REPLACE FUNCTION public.lc_can_manage(p_provider UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
 SELECT 1 FROM public.providers p WHERE p.id=p_provider AND p.deleted_at IS NULL
 AND (p.user_id=auth.uid() OR public.lc_is_admin()))
$$;
CREATE OR REPLACE FUNCTION public.lc_admin_business(p_provider UUID,p_active BOOLEAN) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.lc_is_admin() OR NOT public.lc_can_manage(p_provider) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 INSERT INTO public.latido_card_businesses(provider_id,active,suspended) VALUES(p_provider,p_active,NOT p_active)
 ON CONFLICT(provider_id) DO UPDATE SET active=excluded.active,suspended=excluded.suspended;
END $$;
CREATE OR REPLACE FUNCTION public.lc_business_dashboard(p_provider UUID DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF p_provider IS NOT NULL AND NOT public.lc_can_manage(p_provider) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 RETURN jsonb_build_object('businesses',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'participating',b.provider_id IS NOT NULL,'active',coalesce(b.active,false),'suspended',coalesce(b.suspended,false)) ORDER BY p.name),'[]'::jsonb) FROM public.providers p LEFT JOIN public.latido_card_businesses b ON b.provider_id=p.id WHERE p.deleted_at IS NULL AND (p.user_id=auth.uid() OR public.lc_is_admin())),
 'offers',(SELECT coalesce(jsonb_agg(o ORDER BY o.created_at DESC),'[]'::jsonb) FROM public.latido_card_offers o WHERE o.provider_id=p_provider AND o.deleted_at IS NULL),
 'history',(SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (SELECT r.id,r.offer_snapshot->>'title' AS title,r.redeemed_at,r.reversed_at,r.source FROM public.latido_card_redemptions r WHERE r.provider_id=p_provider ORDER BY r.redeemed_at DESC LIMIT 100) x));
END $$;
NOTIFY pgrst,'reload schema';

-- Retire empty registrations left by the previous manager preview, preserving all history.
UPDATE public.latido_card_businesses b SET active=false WHERE b.active
AND NOT EXISTS (SELECT 1 FROM public.latido_card_offers o WHERE o.provider_id=b.provider_id);
COMMIT;
