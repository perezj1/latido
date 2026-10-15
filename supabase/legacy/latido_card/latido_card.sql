-- ARCHIVED: retired Scanner/physical-card system. Do not run for the minimal version.
-- Current instructions: docs/LATIDO_CARD_MINIMAL.md
-- Latido Card pilot. Run after schema.sql and business_promotion_plans.sql.
-- No live payment, membership or business is created by this migration.
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
CREATE TABLE IF NOT EXISTS public.latido_card_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID NOT NULL REFERENCES public.latido_card_memberships(id),
  token_hash TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('physical','digital')),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lc_credentials_member_idx ON public.latido_card_credentials(membership_id);
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
CREATE INDEX IF NOT EXISTS lc_offers_business_idx ON public.latido_card_offers(provider_id);
CREATE TABLE IF NOT EXISTS public.latido_card_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID NOT NULL REFERENCES public.latido_card_memberships(id),
  offer_id UUID NOT NULL REFERENCES public.latido_card_offers(id),
  status TEXT NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed','used','released')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (membership_id, offer_id)
);
CREATE INDEX IF NOT EXISTS lc_claims_stock_idx ON public.latido_card_claims(offer_id,status,expires_at);
CREATE TABLE IF NOT EXISTS public.latido_card_scanner_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.latido_card_businesses(provider_id),
  token_hash TEXT NOT NULL UNIQUE,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.latido_card_scanner_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES public.latido_card_scanner_links(id),
  provider_id UUID NOT NULL REFERENCES public.latido_card_businesses(provider_id),
  token_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT 'Scanner' CHECK (length(label) BETWEEN 1 AND 80),
  persistent BOOLEAN NOT NULL DEFAULT false,
  persistence_requested BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (persistent OR expires_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS lc_sessions_business_idx ON public.latido_card_scanner_sessions(provider_id);
CREATE TABLE IF NOT EXISTS public.latido_card_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE,
  membership_id UUID NOT NULL REFERENCES public.latido_card_memberships(id),
  offer_id UUID NOT NULL REFERENCES public.latido_card_offers(id),
  provider_id UUID NOT NULL REFERENCES public.latido_card_businesses(provider_id),
  scanner_session_id UUID NOT NULL REFERENCES public.latido_card_scanner_sessions(id),
  offer_snapshot JSONB NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reversed_at TIMESTAMPTZ,
  reversed_by UUID REFERENCES public.profiles(id),
  reversal_reason TEXT
);
CREATE INDEX IF NOT EXISTS lc_redemptions_usage_idx ON public.latido_card_redemptions(membership_id,offer_id,redeemed_at) WHERE reversed_at IS NULL;
CREATE INDEX IF NOT EXISTS lc_redemptions_business_idx ON public.latido_card_redemptions(provider_id,redeemed_at DESC);

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['memberships','credentials','businesses','offers','claims','scanner_links','scanner_sessions','redemptions'] LOOP
    EXECUTE format('ALTER TABLE public.latido_card_%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.latido_card_%I FROM PUBLIC, anon, authenticated',t);
    EXECUTE format('GRANT ALL ON public.latido_card_%I TO service_role',t);
  END LOOP;
END $$;

-- sha256(bytea) and gen_random_uuid() are PostgreSQL built-ins, no new extension.
CREATE OR REPLACE FUNCTION public.lc_hash(p_token TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE STRICT SET search_path = public AS $$ SELECT encode(sha256(convert_to(p_token,'UTF8')),'hex') $$;
CREATE OR REPLACE FUNCTION public.lc_new_token() RETURNS TEXT
LANGUAGE sql VOLATILE SET search_path = public AS $$ SELECT replace(gen_random_uuid()::text || gen_random_uuid()::text,'-','') $$;
CREATE OR REPLACE FUNCTION public.lc_is_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT auth.uid() IS NOT NULL AND public.is_business_promotion_admin()
$$;
CREATE OR REPLACE FUNCTION public.lc_can_manage(p_provider UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT auth.uid() IS NOT NULL AND (public.lc_is_admin() OR EXISTS (
 SELECT 1 FROM public.providers WHERE id=p_provider AND user_id=auth.uid()))
$$;
CREATE OR REPLACE FUNCTION public.lc_active_member(p_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT EXISTS (SELECT 1 FROM public.latido_card_memberships m
 WHERE m.id=p_id AND m.status='active' AND m.starts_at<=now() AND m.valid_until>now())
$$;
CREATE OR REPLACE FUNCTION public.lc_scanner(p_token TEXT) RETURNS public.latido_card_scanner_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.latido_card_scanner_sessions;
BEGIN
 SELECT ss.* INTO s FROM public.latido_card_scanner_sessions ss
 JOIN public.latido_card_scanner_links l ON l.id=ss.link_id
 JOIN public.latido_card_businesses b ON b.provider_id=ss.provider_id
 WHERE ss.token_hash=public.lc_hash(p_token) AND ss.revoked_at IS NULL
 AND l.revoked_at IS NULL AND b.active AND (ss.expires_at IS NULL OR ss.expires_at>now())
 FOR UPDATE OF ss;
 IF s.id IS NULL THEN RAISE EXCEPTION 'SCANNER_EXPIRED'; END IF;
 UPDATE public.latido_card_scanner_sessions SET last_seen_at=now() WHERE id=s.id;
 RETURN s;
END $$;
CREATE OR REPLACE FUNCTION public.lc_card_member(p_token TEXT) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE mid UUID;
BEGIN
 SELECT membership_id INTO mid FROM public.latido_card_credentials
 WHERE token_hash=public.lc_hash(p_token) AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now());
 IF mid IS NULL THEN RAISE EXCEPTION 'CARD_INVALID'; END IF;
 -- The member lock serializes limits across different scanners and credentials.
 PERFORM 1 FROM public.latido_card_memberships WHERE id=mid FOR UPDATE;
 IF NOT EXISTS (SELECT 1 FROM public.latido_card_credentials WHERE token_hash=public.lc_hash(p_token)
 AND membership_id=mid AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now())) THEN RAISE EXCEPTION 'CARD_INVALID'; END IF;
 IF NOT public.lc_active_member(mid) THEN RAISE EXCEPTION 'MEMBERSHIP_INACTIVE'; END IF;
 RETURN mid;
END $$;
CREATE OR REPLACE FUNCTION public.lc_offer_available(p_member UUID,p_offer UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT EXISTS (SELECT 1 FROM public.latido_card_offers o
 JOIN public.latido_card_businesses b ON b.provider_id=o.provider_id AND b.active
 WHERE o.id=p_offer AND o.active AND o.starts_at<=now() AND o.ends_at>now()
 AND public.lc_active_member(p_member)
 AND (NOT o.requires_claim OR EXISTS (SELECT 1 FROM public.latido_card_claims c
 WHERE c.offer_id=o.id AND c.membership_id=p_member AND c.status='claimed' AND c.expires_at>now()))
 AND (o.usage_period='unlimited' OR (SELECT count(*) FROM public.latido_card_redemptions r
 WHERE r.offer_id=o.id AND r.membership_id=p_member AND r.reversed_at IS NULL
 AND (o.usage_period='lifetime' OR r.redeemed_at >= (date_trunc('month',now() AT TIME ZONE 'Europe/Zurich') AT TIME ZONE 'Europe/Zurich'))) < o.usage_limit))
$$;
CREATE OR REPLACE FUNCTION public.lc_protect_offer_terms() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF (to_jsonb(NEW)-'active') IS DISTINCT FROM (to_jsonb(OLD)-'active') AND (
 EXISTS (SELECT 1 FROM public.latido_card_claims WHERE offer_id=OLD.id)
 OR EXISTS (SELECT 1 FROM public.latido_card_redemptions WHERE offer_id=OLD.id)) THEN
 RAISE EXCEPTION 'OFFER_TERMS_LOCKED'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS lc_offer_terms ON public.latido_card_offers;
CREATE TRIGGER lc_offer_terms BEFORE UPDATE ON public.latido_card_offers FOR EACH ROW EXECUTE FUNCTION public.lc_protect_offer_terms();

CREATE OR REPLACE FUNCTION public.lc_catalog() RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',o.id,'provider_id',o.provider_id,'business_name',p.name,
 'city',p.city,'title',o.title,'description',o.description,'benefit_type',o.benefit_type,
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
 RETURN jsonb_build_object('membership',CASE WHEN m.id IS NULL THEN NULL ELSE jsonb_build_object(
 'id',m.id,'member_number',m.member_number,'status',m.status,'active',public.lc_active_member(m.id),'valid_until',m.valid_until) END,
 'offers',offers,'history',(SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (SELECT r.id,r.offer_snapshot->>'title' AS title,p.name AS business_name,r.redeemed_at,r.reversed_at
 FROM public.latido_card_redemptions r JOIN public.providers p ON p.id=r.provider_id WHERE r.membership_id=m.id ORDER BY r.redeemed_at DESC LIMIT 50) x));
END $$;
CREATE OR REPLACE FUNCTION public.lc_issue_digital_card() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.latido_card_memberships; tok TEXT:=public.lc_new_token(); expiry TIMESTAMPTZ:=now()+interval '5 minutes';
BEGIN
 SELECT * INTO m FROM public.latido_card_memberships WHERE user_id=auth.uid() FOR UPDATE;
 IF NOT public.lc_active_member(m.id) THEN RAISE EXCEPTION 'MEMBERSHIP_INACTIVE'; END IF;
 UPDATE public.latido_card_credentials SET revoked_at=now() WHERE membership_id=m.id AND kind='digital' AND revoked_at IS NULL;
 INSERT INTO public.latido_card_credentials(membership_id,token_hash,kind,expires_at) VALUES(m.id,public.lc_hash(tok),'digital',expiry);
 RETURN jsonb_build_object('token',tok,'expires_at',expiry,'member_number',m.member_number);
END $$;
CREATE OR REPLACE FUNCTION public.lc_report_lost_card() RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 PERFORM 1 FROM public.latido_card_memberships WHERE user_id=auth.uid() FOR UPDATE;
 UPDATE public.latido_card_credentials SET revoked_at=now() WHERE kind='physical' AND revoked_at IS NULL
 AND membership_id IN (SELECT id FROM public.latido_card_memberships WHERE user_id=auth.uid());
END $$;
CREATE OR REPLACE FUNCTION public.lc_claim_offer(p_offer UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.latido_card_memberships; o public.latido_card_offers; c public.latido_card_claims; used_stock BIGINT;
BEGIN
 SELECT * INTO m FROM public.latido_card_memberships WHERE user_id=auth.uid() FOR UPDATE;
 IF NOT public.lc_active_member(m.id) THEN RAISE EXCEPTION 'MEMBERSHIP_INACTIVE'; END IF;
 SELECT * INTO o FROM public.latido_card_offers WHERE id=p_offer FOR UPDATE;
 IF o.id IS NULL OR NOT o.requires_claim OR NOT o.active OR o.starts_at>now() OR o.ends_at<=now()
 OR NOT EXISTS(SELECT 1 FROM public.latido_card_businesses WHERE provider_id=o.provider_id AND active) THEN RAISE EXCEPTION 'OFFER_UNAVAILABLE'; END IF;
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

CREATE OR REPLACE FUNCTION public.lc_open_scanner(p_link_token TEXT,p_label TEXT DEFAULT 'Scanner') RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.latido_card_scanner_links; s public.latido_card_scanner_sessions; tok TEXT:=public.lc_new_token();
BEGIN
 SELECT sl.* INTO l FROM public.latido_card_scanner_links sl JOIN public.latido_card_businesses b ON b.provider_id=sl.provider_id
 WHERE sl.token_hash=public.lc_hash(p_link_token) AND sl.revoked_at IS NULL AND b.active FOR UPDATE OF sl;
 IF l.id IS NULL THEN RAISE EXCEPTION 'SCANNER_LINK_INVALID'; END IF;
 -- Bounded creation protects a shared credential from unbounded session spam.
 IF (SELECT count(*) FROM public.latido_card_scanner_sessions WHERE link_id=l.id AND created_at>now()-interval '1 hour') >= 30 THEN RAISE EXCEPTION 'SCANNER_RATE_LIMIT'; END IF;
 INSERT INTO public.latido_card_scanner_sessions(link_id,provider_id,token_hash,label,expires_at)
 VALUES(l.id,l.provider_id,public.lc_hash(tok),left(coalesce(nullif(btrim(p_label),''),'Scanner'),80),now()+interval '8 hours') RETURNING * INTO s;
 RETURN jsonb_build_object('token',tok,'session_id',s.id,'expires_at',s.expires_at,'persistent',false,
 'business_name',(SELECT name FROM public.providers WHERE id=l.provider_id));
END $$;
CREATE OR REPLACE FUNCTION public.lc_scanner_status(p_session_token TEXT,p_request_persistence BOOLEAN DEFAULT false) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.latido_card_scanner_sessions:=public.lc_scanner(p_session_token);
BEGIN
 IF p_request_persistence THEN UPDATE public.latido_card_scanner_sessions SET persistence_requested=true WHERE id=s.id; s.persistence_requested:=true; END IF;
 RETURN jsonb_build_object('session_id',s.id,'label',s.label,'business_name',(SELECT name FROM public.providers WHERE id=s.provider_id),
 'expires_at',s.expires_at,'persistent',s.persistent,'persistence_requested',s.persistence_requested);
END $$;
CREATE OR REPLACE FUNCTION public.lc_scan_card(p_session_token TEXT,p_card_token TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.latido_card_scanner_sessions:=public.lc_scanner(p_session_token); mid UUID:=public.lc_card_member(p_card_token); result JSONB;
BEGIN
 SELECT jsonb_build_object('member_number',m.member_number,
 'member_name',split_part(coalesce(nullif(p.name,''),'Socio'),' ',1),
 'business_name',(SELECT name FROM public.providers WHERE id=s.provider_id),
 'offers',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',o.id,'title',o.title,'description',o.description,'minimum_spend',o.minimum_spend,
 'benefit_type',o.benefit_type,'benefit_value',o.benefit_value,'usage_period',o.usage_period,'usage_limit',o.usage_limit,'requires_claim',o.requires_claim,'ends_at',o.ends_at)
 ORDER BY o.requires_claim DESC,o.created_at),'[]'::jsonb)
 FROM public.latido_card_offers o WHERE o.provider_id=s.provider_id AND public.lc_offer_available(mid,o.id))) INTO result
 FROM public.latido_card_memberships m JOIN public.profiles p ON p.id=m.user_id WHERE m.id=mid;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.lc_redeem(p_session_token TEXT,p_card_token TEXT,p_offer UUID,p_request_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.latido_card_scanner_sessions:=public.lc_scanner(p_session_token); mid UUID;
 o public.latido_card_offers; r public.latido_card_redemptions;
BEGIN
 IF p_request_id IS NULL THEN RAISE EXCEPTION 'REQUEST_REQUIRED'; END IF;
 SELECT * INTO r FROM public.latido_card_redemptions WHERE request_id=p_request_id;
 IF r.id IS NOT NULL THEN
   SELECT membership_id INTO mid FROM public.latido_card_credentials WHERE token_hash=public.lc_hash(p_card_token);
   IF r.scanner_session_id IS DISTINCT FROM s.id OR r.membership_id IS DISTINCT FROM mid OR r.offer_id IS DISTINCT FROM p_offer THEN RAISE EXCEPTION 'REQUEST_CONFLICT'; END IF;
   RETURN jsonb_build_object('id',r.id,'redeemed_at',r.redeemed_at,'reversed',r.reversed_at IS NOT NULL);
 END IF;
 mid:=public.lc_card_member(p_card_token);
 SELECT * INTO o FROM public.latido_card_offers WHERE id=p_offer FOR UPDATE;
 IF o.provider_id IS DISTINCT FROM s.provider_id OR NOT public.lc_offer_available(mid,p_offer) THEN RAISE EXCEPTION 'OFFER_UNAVAILABLE'; END IF;
 INSERT INTO public.latido_card_redemptions(request_id,membership_id,offer_id,provider_id,scanner_session_id,offer_snapshot)
 VALUES(p_request_id,mid,o.id,s.provider_id,s.id,to_jsonb(o)) RETURNING * INTO r;
 IF o.requires_claim THEN UPDATE public.latido_card_claims SET status='used' WHERE membership_id=mid AND offer_id=o.id; END IF;
 RETURN jsonb_build_object('id',r.id,'redeemed_at',r.redeemed_at,'reversed',false);
END $$;

CREATE OR REPLACE FUNCTION public.lc_close_scanner(p_session_token TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.latido_card_scanner_sessions:=public.lc_scanner(p_session_token);
BEGIN
 UPDATE public.latido_card_scanner_sessions SET revoked_at=now() WHERE id=s.id;
END $$;
CREATE OR REPLACE FUNCTION public.lc_business_dashboard(p_provider UUID DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF p_provider IS NOT NULL AND NOT public.lc_can_manage(p_provider) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 RETURN jsonb_build_object('businesses',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'participating',b.provider_id IS NOT NULL,'active',coalesce(b.active,false)) ORDER BY p.name),'[]'::jsonb)
 FROM public.providers p LEFT JOIN public.latido_card_businesses b ON b.provider_id=p.id WHERE p.user_id=auth.uid() OR public.lc_is_admin()),
 'offers',(SELECT coalesce(jsonb_agg(o ORDER BY o.created_at DESC),'[]'::jsonb) FROM public.latido_card_offers o WHERE o.provider_id=p_provider),
 'sessions',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'label',s.label,'persistent',s.persistent,'persistence_requested',s.persistence_requested,'expires_at',s.expires_at,'revoked_at',s.revoked_at,'last_seen_at',s.last_seen_at) ORDER BY s.created_at DESC),'[]'::jsonb) FROM public.latido_card_scanner_sessions s WHERE s.provider_id=p_provider),
 'history',(SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (SELECT r.id,r.offer_snapshot->>'title' AS title,r.redeemed_at,r.reversed_at,s.label AS scanner_label FROM public.latido_card_redemptions r
 JOIN public.latido_card_scanner_sessions s ON s.id=r.scanner_session_id WHERE r.provider_id=p_provider ORDER BY r.redeemed_at DESC LIMIT 100) x));
END $$;
CREATE OR REPLACE FUNCTION public.lc_save_offer(p_provider UUID,p_offer JSONB) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE oid UUID;
BEGIN
 IF NOT public.lc_can_manage(p_provider) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM 1 FROM public.latido_card_businesses WHERE provider_id=p_provider AND active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'BUSINESS_INACTIVE'; END IF;
 IF (SELECT count(*) FROM public.latido_card_offers WHERE provider_id=p_provider AND active AND ends_at>now() AND requires_claim=coalesce((p_offer->>'requires_claim')::boolean,false))
 >= (CASE WHEN coalesce((p_offer->>'requires_claim')::boolean,false) THEN 2 ELSE 1 END) THEN RAISE EXCEPTION 'OFFER_CAPACITY'; END IF;
 INSERT INTO public.latido_card_offers(provider_id,title,description,benefit_type,benefit_value,minimum_spend,requires_claim,stock_total,claim_days,usage_period,usage_limit,ends_at)
 VALUES(p_provider,p_offer->>'title',coalesce(p_offer->>'description',''),p_offer->>'benefit_type',nullif(p_offer->>'benefit_value','')::numeric,
 coalesce(nullif(p_offer->>'minimum_spend','')::numeric,0),coalesce((p_offer->>'requires_claim')::boolean,false),nullif(p_offer->>'stock_total','')::integer,
 coalesce((p_offer->>'claim_days')::integer,7),coalesce(p_offer->>'usage_period','month'),coalesce((p_offer->>'usage_limit')::integer,1),(p_offer->>'ends_at')::timestamptz) RETURNING id INTO oid;
 RETURN oid;
END $$;
CREATE OR REPLACE FUNCTION public.lc_set_offer_active(p_offer UUID,p_active BOOLEAN) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid UUID;
BEGIN
 SELECT provider_id INTO pid FROM public.latido_card_offers WHERE id=p_offer;
 IF NOT public.lc_can_manage(pid) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM 1 FROM public.latido_card_businesses WHERE provider_id=pid FOR UPDATE;
 IF p_active AND EXISTS(SELECT 1 FROM public.latido_card_offers o WHERE o.id=p_offer AND NOT o.active AND o.ends_at>now()) AND
 (SELECT count(*) FROM public.latido_card_offers o WHERE o.provider_id=pid AND o.active AND o.ends_at>now() AND o.requires_claim=(SELECT requires_claim FROM public.latido_card_offers WHERE id=p_offer))
 >= (CASE WHEN (SELECT requires_claim FROM public.latido_card_offers WHERE id=p_offer) THEN 2 ELSE 1 END) THEN RAISE EXCEPTION 'OFFER_CAPACITY'; END IF;
 UPDATE public.latido_card_offers SET active=p_active WHERE id=p_offer;
END $$;
CREATE OR REPLACE FUNCTION public.lc_rotate_scanner_link(p_provider UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tok TEXT:=public.lc_new_token();
BEGIN
 IF NOT public.lc_can_manage(p_provider) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM 1 FROM public.latido_card_businesses WHERE provider_id=p_provider AND active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'BUSINESS_INACTIVE'; END IF;
 UPDATE public.latido_card_scanner_links SET revoked_at=now() WHERE provider_id=p_provider AND revoked_at IS NULL;
 UPDATE public.latido_card_scanner_sessions SET revoked_at=now() WHERE provider_id=p_provider AND revoked_at IS NULL;
 INSERT INTO public.latido_card_scanner_links(provider_id,token_hash) VALUES(p_provider,public.lc_hash(tok));
 RETURN jsonb_build_object('token',tok);
END $$;
CREATE OR REPLACE FUNCTION public.lc_manage_scanner(p_session UUID,p_action TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.latido_card_scanner_sessions;
BEGIN
 SELECT * INTO s FROM public.latido_card_scanner_sessions WHERE id=p_session FOR UPDATE;
 IF NOT public.lc_can_manage(s.provider_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF p_action='revoke' THEN UPDATE public.latido_card_scanner_sessions SET revoked_at=now() WHERE id=s.id;
 ELSIF p_action='approve' AND s.revoked_at IS NULL AND s.persistence_requested AND s.expires_at>now() THEN
 UPDATE public.latido_card_scanner_sessions SET persistent=true,expires_at=NULL WHERE id=s.id;
 ELSE RAISE EXCEPTION 'SCANNER_ACTION_INVALID'; END IF;
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
 IF FOUND THEN UPDATE public.latido_card_claims SET status='claimed' WHERE offer_id=r.offer_id AND membership_id=r.membership_id AND status='used'; END IF;
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
CREATE OR REPLACE FUNCTION public.lc_admin_business(p_provider UUID,p_active BOOLEAN) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT public.lc_is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 INSERT INTO public.latido_card_businesses(provider_id,active) VALUES(p_provider,p_active) ON CONFLICT(provider_id) DO UPDATE SET active=excluded.active;
END $$;
CREATE OR REPLACE FUNCTION public.lc_admin_physical_card(p_user UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE mid UUID; tok TEXT:=public.lc_new_token();
BEGIN
 IF NOT public.lc_is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT id INTO mid FROM public.latido_card_memberships WHERE user_id=p_user FOR UPDATE;
 IF NOT public.lc_active_member(mid) THEN RAISE EXCEPTION 'MEMBERSHIP_INACTIVE'; END IF;
 UPDATE public.latido_card_credentials SET revoked_at=now() WHERE membership_id=mid AND kind='physical' AND revoked_at IS NULL;
 INSERT INTO public.latido_card_credentials(membership_id,token_hash,kind) VALUES(mid,public.lc_hash(tok),'physical');
 RETURN jsonb_build_object('token',tok,'member_number',(SELECT member_number FROM public.latido_card_memberships WHERE id=mid));
END $$;

-- Default PostgreSQL function privileges allow PUBLIC execution: close every
-- lc_* function first, then grant only the explicitly reviewed API surface.
DO $$ DECLARE f RECORD; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'lc\_%' ESCAPE '\' LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.lc_catalog() TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lc_member_home(),public.lc_issue_digital_card(),public.lc_report_lost_card(),public.lc_claim_offer(UUID),public.lc_release_claim(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lc_open_scanner(TEXT,TEXT),public.lc_scanner_status(TEXT,BOOLEAN),public.lc_scan_card(TEXT,TEXT),public.lc_redeem(TEXT,TEXT,UUID,UUID) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lc_close_scanner(TEXT) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lc_business_dashboard(UUID),public.lc_save_offer(UUID,JSONB),public.lc_set_offer_active(UUID,BOOLEAN),public.lc_rotate_scanner_link(UUID),public.lc_manage_scanner(UUID,TEXT),public.lc_reverse_redemption(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lc_admin_enroll(UUID,TIMESTAMPTZ,TEXT),public.lc_admin_business(UUID,BOOLEAN),public.lc_admin_physical_card(UUID) TO authenticated;
COMMIT;
