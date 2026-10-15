-- ARCHIVED: retired Scanner/physical-card system. Do not run for the minimal version.
-- Current instructions: docs/LATIDO_CARD_MINIMAL.md
-- Latido operations: apply after latido_card.sql and app_notifications.sql.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.app_notifications') IS NULL THEN RAISE EXCEPTION 'Install app_notifications.sql first'; END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.latido_card_physical_requests (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id UUID NOT NULL UNIQUE,
 membership_id UUID NOT NULL REFERENCES public.latido_card_memberships(id),
 request_number BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
 kind TEXT NOT NULL CHECK (kind IN ('initial','replacement')),
 status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','printing','ready','shipped','delivered','rejected','cancelled')),
 fulfillment TEXT NOT NULL CHECK (fulfillment IN ('shipping','pickup')),
 recipient_name TEXT NOT NULL CHECK (length(btrim(recipient_name)) BETWEEN 2 AND 120),
 address_line1 TEXT NOT NULL DEFAULT '' CHECK (length(address_line1)<=180),
 address_line2 TEXT NOT NULL DEFAULT '' CHECK (length(address_line2)<=180),
 postal_code TEXT NOT NULL DEFAULT '',
 city TEXT NOT NULL DEFAULT '' CHECK (length(city)<=100),
 country TEXT NOT NULL DEFAULT 'CH' CHECK (country='CH'),
 contact_email TEXT NOT NULL CHECK (length(contact_email) BETWEEN 3 AND 254 AND contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 credential_id UUID REFERENCES public.latido_card_credentials(id),
 public_note TEXT NOT NULL DEFAULT '' CHECK (length(public_note)<=1000),
 internal_note TEXT NOT NULL DEFAULT '' CHECK (length(internal_note)<=2000),
 tracking_url TEXT NOT NULL DEFAULT '' CHECK (tracking_url='' OR (tracking_url ~ '^https://' AND length(tracking_url)<=1000)),
 version INTEGER NOT NULL DEFAULT 1,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK ((fulfillment='pickup' AND address_line1='' AND address_line2='' AND postal_code='' AND city='')
 OR (fulfillment='shipping' AND length(btrim(address_line1))>=3 AND postal_code ~ '^[0-9]{4}$' AND length(btrim(city))>=2))
);
CREATE UNIQUE INDEX IF NOT EXISTS lc_one_open_physical_request ON public.latido_card_physical_requests(membership_id)
 WHERE status IN ('requested','approved','printing','ready','shipped');
CREATE INDEX IF NOT EXISTS lc_physical_request_queue_idx ON public.latido_card_physical_requests(status,created_at);
CREATE TABLE IF NOT EXISTS public.latido_card_physical_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id UUID NOT NULL REFERENCES public.latido_card_physical_requests(id),
 actor_id UUID REFERENCES public.profiles(id),
 action TEXT NOT NULL,
 from_status TEXT,
 to_status TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lc_physical_events_request_idx ON public.latido_card_physical_events(request_id,created_at);
CREATE TABLE IF NOT EXISTS public.latido_card_physical_email_queue (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id UUID NOT NULL REFERENCES public.latido_card_physical_events(id),
 recipient_email TEXT NOT NULL,
 audience TEXT NOT NULL CHECK (audience IN ('admin','member')),
 payload JSONB NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed')),
 attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 lease_id UUID,
 lease_until TIMESTAMPTZ,
 sent_at TIMESTAMPTZ,
 last_error TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(event_id,recipient_email)
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
ALTER TABLE public.latido_card_admin_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.latido_card_admin_audit FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.latido_card_admin_audit TO service_role;
CREATE OR REPLACE FUNCTION public.lc_record_admin_action() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE data JSONB:=to_jsonb(NEW); safe_data JSONB;
BEGIN
 IF NOT public.lc_is_admin() THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='latido_card_credentials' AND data->>'kind'<>'physical' THEN RETURN NEW; END IF;
 safe_data:=jsonb_build_object('status',data->'status','valid_until',data->'valid_until','active',data->'active',
 'membership_id',data->'membership_id','kind',data->'kind','revoked_at',data->'revoked_at');
 INSERT INTO public.latido_card_admin_audit(actor_id,entity_type,entity_id,action,metadata)
 VALUES(auth.uid(),TG_TABLE_NAME,coalesce((data->>'id')::uuid,(data->>'provider_id')::uuid),TG_OP,safe_data);
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS lc_membership_admin_audit ON public.latido_card_memberships;
CREATE TRIGGER lc_membership_admin_audit AFTER INSERT OR UPDATE ON public.latido_card_memberships FOR EACH ROW EXECUTE FUNCTION public.lc_record_admin_action();
DROP TRIGGER IF EXISTS lc_business_admin_audit ON public.latido_card_businesses;
CREATE TRIGGER lc_business_admin_audit AFTER INSERT OR UPDATE ON public.latido_card_businesses FOR EACH ROW EXECUTE FUNCTION public.lc_record_admin_action();
DROP TRIGGER IF EXISTS lc_credential_admin_audit ON public.latido_card_credentials;
CREATE TRIGGER lc_credential_admin_audit AFTER INSERT OR UPDATE ON public.latido_card_credentials FOR EACH ROW EXECUTE FUNCTION public.lc_record_admin_action();
ALTER TABLE public.latido_card_physical_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.latido_card_physical_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.latido_card_physical_email_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.latido_card_physical_requests,public.latido_card_physical_events,public.latido_card_physical_email_queue FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.latido_card_physical_requests,public.latido_card_physical_events,public.latido_card_physical_email_queue TO service_role;

-- Preserve any notification kinds installed by other Latido modules.
DO $$ DECLARE expression TEXT; BEGIN
 SELECT pg_get_expr(conbin,conrelid) INTO expression FROM pg_constraint
 WHERE conrelid='public.app_notifications'::regclass AND conname='app_notifications_kind_check';
 IF expression IS NULL THEN RAISE EXCEPTION 'Missing app_notifications_kind_check'; END IF;
 IF position('card_physical_request' IN expression)=0 THEN
  ALTER TABLE public.app_notifications DROP CONSTRAINT app_notifications_kind_check;
  EXECUTE 'ALTER TABLE public.app_notifications ADD CONSTRAINT app_notifications_kind_check CHECK (('||expression||') OR kind IN (''card_physical_request'',''card_physical_status''))';
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.lc_physical_public(p public.latido_card_physical_requests) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT jsonb_build_object('id',p.id,'reference','LCP-'||lpad(p.request_number::text,6,'0'),
 'kind',p.kind,'status',p.status,'fulfillment',p.fulfillment,'recipient_name',p.recipient_name,
 'address_line1',p.address_line1,'address_line2',p.address_line2,'postal_code',p.postal_code,
 'city',p.city,'country',p.country,'public_note',p.public_note,'tracking_url',p.tracking_url,
 'created_at',p.created_at,'updated_at',p.updated_at)
$$;
CREATE OR REPLACE FUNCTION public.lc_physical_notify(p_request UUID,p_action TEXT,p_from TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.latido_card_physical_requests; notification_event UUID; uid UUID; ref TEXT; payload JSONB;
BEGIN
 SELECT * INTO r FROM public.latido_card_physical_requests WHERE id=p_request;
 SELECT user_id INTO uid FROM public.latido_card_memberships WHERE id=r.membership_id;
 ref:='LCP-'||lpad(r.request_number::text,6,'0');
 INSERT INTO public.latido_card_physical_events(request_id,actor_id,action,from_status,to_status)
 VALUES(r.id,auth.uid(),p_action,p_from,r.status) RETURNING id INTO notification_event;
 payload:=jsonb_build_object('reference',ref,'status',r.status,'fulfillment',r.fulfillment);
 -- The operational inbox is authoritative. Notifications never contain address,
 -- raw QR tokens, internal notes or shipment links.
 IF p_action='requested' THEN
  INSERT INTO public.app_notifications(recipient_id,kind,source_id,data)
  SELECT p.id,'card_physical_request',notification_event::text,payload||jsonb_build_object('href','/card/admin')
  FROM public.profiles p JOIN public.business_promotion_admins a ON lower(a.email)=lower(p.email)
  ON CONFLICT(recipient_id,kind,source_id) DO NOTHING;
  INSERT INTO public.latido_card_physical_email_queue(event_id,recipient_email,audience,payload)
  SELECT notification_event,lower(a.email),'admin',payload FROM public.business_promotion_admins a
  ON CONFLICT(event_id,recipient_email) DO NOTHING;
 END IF;
 INSERT INTO public.app_notifications(recipient_id,kind,source_id,data)
 VALUES(uid,'card_physical_status',notification_event::text,payload||jsonb_build_object('href','/card'))
 ON CONFLICT(recipient_id,kind,source_id) DO NOTHING;
 INSERT INTO public.latido_card_physical_email_queue(event_id,recipient_email,audience,payload)
 VALUES(notification_event,r.contact_email,'member',payload) ON CONFLICT(event_id,recipient_email) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.lc_member_physical_requests() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE mid UUID;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 SELECT id INTO mid FROM public.latido_card_memberships WHERE user_id=auth.uid();
 RETURN jsonb_build_object('issued_before',EXISTS(SELECT 1 FROM public.latido_card_credentials WHERE membership_id=mid AND kind='physical'),
 'requests',(SELECT coalesce(jsonb_agg(public.lc_physical_public(r) ORDER BY r.created_at DESC),'[]'::jsonb)
 FROM public.latido_card_physical_requests r WHERE r.membership_id=mid));
END $$;
CREATE OR REPLACE FUNCTION public.lc_request_physical_card(p_request_id UUID,p_details JSONB,p_kind TEXT DEFAULT 'initial') RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.latido_card_memberships; r public.latido_card_physical_requests; email TEXT; method TEXT:=p_details->>'fulfillment';
BEGIN
 SELECT * INTO m FROM public.latido_card_memberships WHERE user_id=auth.uid() FOR UPDATE;
 IF NOT public.lc_active_member(m.id) THEN RAISE EXCEPTION 'MEMBERSHIP_INACTIVE'; END IF;
 IF p_request_id IS NULL OR jsonb_typeof(p_details) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'PHYSICAL_DETAILS_INVALID'; END IF;
 IF p_kind IS NULL OR p_kind NOT IN ('initial','replacement') OR method IS NULL OR method NOT IN ('shipping','pickup')
 OR length(btrim(coalesce(p_details->>'recipient_name',''))) NOT BETWEEN 2 AND 120
 OR (method='shipping' AND (length(btrim(coalesce(p_details->>'address_line1',''))) NOT BETWEEN 3 AND 180
 OR coalesce(p_details->>'postal_code','') !~ '^[0-9]{4}$' OR length(btrim(coalesce(p_details->>'city',''))) NOT BETWEEN 2 AND 100)) THEN RAISE EXCEPTION 'PHYSICAL_DETAILS_INVALID'; END IF;
 SELECT * INTO r FROM public.latido_card_physical_requests WHERE request_id=p_request_id;
 IF r.id IS NOT NULL THEN
  IF r.membership_id IS DISTINCT FROM m.id OR r.kind IS DISTINCT FROM p_kind THEN RAISE EXCEPTION 'REQUEST_CONFLICT'; END IF;
  RETURN public.lc_physical_public(r);
 END IF;
 IF EXISTS(SELECT 1 FROM public.latido_card_physical_requests WHERE membership_id=m.id AND status IN ('requested','approved','printing','ready','shipped')) THEN RAISE EXCEPTION 'PHYSICAL_REQUEST_ALREADY_OPEN'; END IF;
 IF (SELECT count(*) FROM public.latido_card_physical_requests WHERE membership_id=m.id AND created_at>now()-interval '1 day')>=5 THEN RAISE EXCEPTION 'PHYSICAL_REQUEST_RATE_LIMIT'; END IF;
 IF (p_kind='initial') = EXISTS(SELECT 1 FROM public.latido_card_credentials WHERE membership_id=m.id AND kind='physical') THEN RAISE EXCEPTION 'PHYSICAL_REQUEST_KIND_INVALID'; END IF;
 SELECT lower(btrim(p.email)) INTO email FROM public.profiles p WHERE p.id=m.user_id;
 IF email IS NULL OR email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'CONTACT_EMAIL_REQUIRED'; END IF;
 INSERT INTO public.latido_card_physical_requests(request_id,membership_id,kind,fulfillment,recipient_name,address_line1,address_line2,postal_code,city,contact_email)
 VALUES(p_request_id,m.id,p_kind,method,btrim(p_details->>'recipient_name'),
 CASE WHEN method='shipping' THEN btrim(coalesce(p_details->>'address_line1','')) ELSE '' END,
 CASE WHEN method='shipping' THEN btrim(coalesce(p_details->>'address_line2','')) ELSE '' END,
 CASE WHEN method='shipping' THEN btrim(coalesce(p_details->>'postal_code','')) ELSE '' END,
 CASE WHEN method='shipping' THEN btrim(coalesce(p_details->>'city','')) ELSE '' END,email) RETURNING * INTO r;
 PERFORM public.lc_physical_notify(r.id,'requested',NULL);
 RETURN public.lc_physical_public(r);
END $$;
CREATE OR REPLACE FUNCTION public.lc_cancel_physical_request(p_request UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE mid UUID; r public.latido_card_physical_requests;
BEGIN
 SELECT id INTO mid FROM public.latido_card_memberships WHERE user_id=auth.uid() FOR UPDATE;
 SELECT * INTO r FROM public.latido_card_physical_requests WHERE id=p_request AND membership_id=mid FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF r.status NOT IN ('requested','approved') OR r.credential_id IS NOT NULL THEN RAISE EXCEPTION 'PHYSICAL_REQUEST_IN_PROGRESS'; END IF;
 UPDATE public.latido_card_physical_requests SET status='cancelled',version=version+1,updated_at=now() WHERE id=r.id;
 PERFORM public.lc_physical_notify(r.id,'cancelled',r.status);
END $$;

CREATE OR REPLACE FUNCTION public.lc_admin_overview(p_search TEXT DEFAULT '') RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.lc_is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 RETURN jsonb_build_object('stats',jsonb_build_object(
 'active_members',(SELECT count(*) FROM public.latido_card_memberships WHERE public.lc_active_member(id)),
 'pending_requests',(SELECT count(*) FROM public.latido_card_physical_requests WHERE status='requested'),
 'in_progress',(SELECT count(*) FROM public.latido_card_physical_requests WHERE status IN ('approved','printing','ready','shipped')),
 'email_pending',(SELECT count(*) FROM public.latido_card_physical_email_queue WHERE status IN ('pending','sending')),
 'email_failed',(SELECT count(*) FROM public.latido_card_physical_email_queue WHERE status='failed')),
 'members',(SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (SELECT p.id,p.name,p.email,m.member_number,m.status,m.valid_until
 FROM public.profiles p LEFT JOIN public.latido_card_memberships m ON m.user_id=p.id
 WHERE coalesce(p.name,'') ILIKE '%'||left(p_search,120)||'%' OR coalesce(p.email,'') ILIKE '%'||left(p_search,120)||'%' OR p.id::text=p_search
 ORDER BY p.name NULLS LAST,p.id LIMIT 40) x),
 'audit',(SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (SELECT a.actor_id,coalesce(nullif(p.name,''),p.email,'Administrador') AS actor_name,a.entity_type,a.entity_id,a.action,a.metadata,a.created_at FROM public.latido_card_admin_audit a LEFT JOIN public.profiles p ON p.id=a.actor_id ORDER BY a.created_at DESC LIMIT 30) x),
 'businesses',(SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (SELECT p.id,p.name,coalesce(b.active,false) AS participating
 FROM public.providers p LEFT JOIN public.latido_card_businesses b ON b.provider_id=p.id ORDER BY p.name LIMIT 200) x));
END $$;
CREATE OR REPLACE FUNCTION public.lc_admin_physical_queue(p_status TEXT DEFAULT 'open') RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.lc_is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(x ORDER BY x->>'created_at'),'[]'::jsonb) FROM (
 SELECT public.lc_physical_public(r)||jsonb_build_object('version',r.version,'contact_email',r.contact_email,'user_id',m.user_id,
 'member_number',m.member_number,'credential_id',r.credential_id,'internal_note',r.internal_note,
 'events',(SELECT coalesce(jsonb_agg(jsonb_build_object('action',e.action,'from_status',e.from_status,'to_status',e.to_status,'actor_id',e.actor_id,'actor_name',(SELECT coalesce(nullif(p.name,''),p.email,'Usuario') FROM public.profiles p WHERE p.id=e.actor_id),'created_at',e.created_at) ORDER BY e.created_at),'[]'::jsonb) FROM public.latido_card_physical_events e WHERE e.request_id=r.id),
 'emails',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',q.id,'audience',q.audience,'status',q.status,'attempts',q.attempts,'sent_at',q.sent_at)),'[]'::jsonb)
 FROM public.latido_card_physical_email_queue q JOIN public.latido_card_physical_events e ON e.id=q.event_id WHERE e.request_id=r.id)) AS x
 FROM public.latido_card_physical_requests r JOIN public.latido_card_memberships m ON m.id=r.membership_id
 WHERE p_status='all' OR (p_status='open' AND r.status IN ('requested','approved','printing','ready','shipped')) OR r.status=p_status
 ORDER BY r.created_at DESC LIMIT 100) q);
END $$;
CREATE OR REPLACE FUNCTION public.lc_admin_update_physical_request(p_request UUID,p_expected_version INTEGER,p_status TEXT,p_public_note TEXT DEFAULT '',p_internal_note TEXT DEFAULT '',p_tracking_url TEXT DEFAULT '') RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE mid UUID; r public.latido_card_physical_requests; allowed BOOLEAN;
BEGIN
 IF NOT public.lc_is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT membership_id INTO mid FROM public.latido_card_physical_requests WHERE id=p_request;
 PERFORM 1 FROM public.latido_card_memberships WHERE id=mid FOR UPDATE;
 SELECT * INTO r FROM public.latido_card_physical_requests WHERE id=p_request FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'PHYSICAL_REQUEST_NOT_FOUND'; END IF;
 IF r.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'PHYSICAL_REQUEST_CHANGED'; END IF;
 allowed:=p_status=r.status OR (r.status='requested' AND p_status IN ('approved','rejected','cancelled'))
 OR (r.status='approved' AND p_status IN ('rejected','cancelled'))
 OR (r.status='printing' AND p_status IN ('ready','cancelled'))
 OR (r.status='ready' AND (p_status='cancelled' OR (r.fulfillment='shipping' AND p_status='shipped') OR (r.fulfillment='pickup' AND p_status='delivered')))
 OR (r.status='shipped' AND p_status IN ('delivered','cancelled'));
 IF NOT allowed THEN RAISE EXCEPTION 'PHYSICAL_STATUS_INVALID'; END IF;
 IF p_status IN ('rejected','cancelled') AND length(btrim(p_public_note))<3 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
 IF p_status='shipped' AND r.fulfillment<>'shipping' THEN RAISE EXCEPTION 'PHYSICAL_STATUS_INVALID'; END IF;
 IF p_status IS DISTINCT FROM r.status AND p_status IN ('ready','shipped','delivered') AND NOT EXISTS(SELECT 1 FROM public.latido_card_credentials WHERE id=r.credential_id AND revoked_at IS NULL) THEN RAISE EXCEPTION 'PHYSICAL_CARD_INVALID'; END IF;
 UPDATE public.latido_card_physical_requests SET status=p_status,public_note=p_public_note,internal_note=p_internal_note,tracking_url=p_tracking_url,version=version+1,updated_at=now() WHERE id=r.id;
 IF p_status IN ('cancelled','rejected') AND r.credential_id IS NOT NULL THEN UPDATE public.latido_card_credentials SET revoked_at=now() WHERE id=r.credential_id AND revoked_at IS NULL; END IF;
 IF p_status IS DISTINCT FROM r.status THEN PERFORM public.lc_physical_notify(r.id,'status_changed',r.status);
 ELSE INSERT INTO public.latido_card_physical_events(request_id,actor_id,action,from_status,to_status) VALUES(r.id,auth.uid(),'details_updated',r.status,r.status); END IF;
END $$;
CREATE OR REPLACE FUNCTION public.lc_admin_issue_request_card(p_request UUID,p_expected_version INTEGER,p_reissue BOOLEAN DEFAULT false) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE mid UUID; m public.latido_card_memberships; r public.latido_card_physical_requests; result JSONB; cid UUID;
BEGIN
 IF NOT public.lc_is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT membership_id INTO mid FROM public.latido_card_physical_requests WHERE id=p_request;
 SELECT * INTO m FROM public.latido_card_memberships WHERE id=mid FOR UPDATE;
 SELECT * INTO r FROM public.latido_card_physical_requests WHERE id=p_request FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'PHYSICAL_REQUEST_NOT_FOUND'; END IF;
 IF r.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'PHYSICAL_REQUEST_CHANGED'; END IF;
 IF r.status NOT IN ('approved','printing','ready') THEN RAISE EXCEPTION 'PHYSICAL_STATUS_INVALID'; END IF;
 IF r.credential_id IS NOT NULL AND NOT p_reissue THEN RAISE EXCEPTION 'PHYSICAL_CARD_ALREADY_ISSUED'; END IF;
 result:=public.lc_admin_physical_card(m.user_id);
 SELECT id INTO cid FROM public.latido_card_credentials WHERE token_hash=public.lc_hash(result->>'token');
 UPDATE public.latido_card_physical_requests SET credential_id=cid,status='printing',version=version+1,updated_at=now() WHERE id=r.id;
 PERFORM public.lc_physical_notify(r.id,CASE WHEN p_reissue THEN 'card_reissued' ELSE 'card_issued' END,r.status);
 RETURN result||jsonb_build_object('request_id',r.id,'reference','LCP-'||lpad(r.request_number::text,6,'0'));
END $$;

CREATE OR REPLACE FUNCTION public.lc_claim_physical_emails(p_limit INTEGER DEFAULT 20) RETURNS SETOF public.latido_card_physical_email_queue
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.latido_card_physical_email_queue SET status='failed',last_error='Delivery lease exhausted' WHERE status='sending' AND attempts>=8 AND lease_until<now();
 RETURN QUERY
 WITH candidates AS (SELECT id FROM public.latido_card_physical_email_queue
 WHERE attempts<8 AND next_attempt_at<=now() AND (status='pending' OR (status='sending' AND lease_until<now()))
 ORDER BY created_at LIMIT greatest(1,least(p_limit,50)) FOR UPDATE SKIP LOCKED)
 UPDATE public.latido_card_physical_email_queue q SET status='sending',attempts=q.attempts+1,lease_id=gen_random_uuid(),lease_until=now()+interval '10 minutes'
 FROM candidates c WHERE q.id=c.id RETURNING q.*;
END
$$;
CREATE OR REPLACE FUNCTION public.lc_finish_physical_email(p_id UUID,p_lease UUID,p_success BOOLEAN,p_error TEXT DEFAULT '') RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.latido_card_physical_email_queue SET
 status=CASE WHEN p_success THEN 'sent' WHEN attempts>=8 THEN 'failed' ELSE 'pending' END,
 sent_at=CASE WHEN p_success THEN now() ELSE NULL END,
 last_error=CASE WHEN p_success THEN NULL ELSE left(p_error,500) END,
 next_attempt_at=now()+make_interval(mins=>least(60,greatest(1,attempts*attempts))),lease_until=NULL
 WHERE id=p_id AND lease_id=p_lease AND status='sending';
 RETURN FOUND;
END $$;
CREATE OR REPLACE FUNCTION public.lc_admin_retry_physical_email(p_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.lc_is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 UPDATE public.latido_card_physical_email_queue SET status='pending',attempts=0,next_attempt_at=now(),lease_id=NULL,lease_until=NULL,last_error=NULL WHERE id=p_id AND status='failed';
END $$;

REVOKE ALL ON FUNCTION public.lc_physical_public(public.latido_card_physical_requests),public.lc_physical_notify(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.lc_record_admin_action() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.lc_member_physical_requests(),public.lc_request_physical_card(UUID,JSONB,TEXT),public.lc_cancel_physical_request(UUID),public.lc_admin_overview(TEXT),public.lc_admin_physical_queue(TEXT),public.lc_admin_update_physical_request(UUID,INTEGER,TEXT,TEXT,TEXT,TEXT),public.lc_admin_issue_request_card(UUID,INTEGER,BOOLEAN),public.lc_claim_physical_emails(INTEGER),public.lc_finish_physical_email(UUID,UUID,BOOLEAN,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lc_member_physical_requests(),public.lc_request_physical_card(UUID,JSONB,TEXT),public.lc_cancel_physical_request(UUID),public.lc_admin_overview(TEXT),public.lc_admin_physical_queue(TEXT),public.lc_admin_update_physical_request(UUID,INTEGER,TEXT,TEXT,TEXT,TEXT),public.lc_admin_issue_request_card(UUID,INTEGER,BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lc_claim_physical_emails(INTEGER),public.lc_finish_physical_email(UUID,UUID,BOOLEAN,TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.lc_admin_retry_physical_email(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lc_admin_retry_physical_email(UUID) TO authenticated;
COMMIT;
