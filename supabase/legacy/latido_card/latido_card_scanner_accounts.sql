-- ARCHIVED: retired Scanner/physical-card system. Do not run for the minimal version.
-- Current instructions: docs/LATIDO_CARD_MINIMAL.md
-- Apply AFTER latido_card.sql and latido_card_self_service.sql.
-- Scanner connections identify a Latido account and last until revoked/closed.
-- Rerunnable. Keeps redemptions and revoked/expired historical connections.
BEGIN;
ALTER TABLE public.latido_card_scanner_sessions
 ADD COLUMN IF NOT EXISTS linked_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
 ADD COLUMN IF NOT EXISTS linked_user_name TEXT,
 ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS disconnected_at TIMESTAMPTZ;
ALTER TABLE public.latido_card_scanner_sessions ALTER COLUMN persistent SET DEFAULT true;
-- Preserve active connections, but do not revive expired or revoked access.
UPDATE public.latido_card_scanner_sessions
 SET persistent=true, expires_at=NULL, persistence_requested=false
 WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now());

CREATE OR REPLACE FUNCTION public.lc_open_scanner(p_link_token TEXT,p_label TEXT DEFAULT 'Scanner') RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.latido_card_scanner_links; s public.latido_card_scanner_sessions;
 tok TEXT:=public.lc_new_token(); uid UUID:=auth.uid(); uname TEXT;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 SELECT nullif(btrim(name),'') INTO uname FROM public.profiles WHERE id=uid;
 IF uname IS NULL THEN RAISE EXCEPTION 'PROFILE_NAME_REQUIRED'; END IF;
 SELECT sl.* INTO l FROM public.latido_card_scanner_links sl JOIN public.latido_card_businesses b ON b.provider_id=sl.provider_id
 WHERE sl.token_hash=public.lc_hash(p_link_token) AND sl.revoked_at IS NULL AND b.active FOR UPDATE OF sl;
 IF l.id IS NULL THEN RAISE EXCEPTION 'SCANNER_LINK_INVALID'; END IF;
 IF (SELECT count(*) FROM public.latido_card_scanner_sessions WHERE link_id=l.id AND created_at>now()-interval '1 hour') >= 30 THEN RAISE EXCEPTION 'SCANNER_RATE_LIMIT'; END IF;
 INSERT INTO public.latido_card_scanner_sessions(link_id,provider_id,token_hash,label,persistent,expires_at,linked_user_id,linked_user_name)
 VALUES(l.id,l.provider_id,public.lc_hash(tok),left(coalesce(nullif(btrim(p_label),''),'Scanner'),80),true,NULL,uid,uname) RETURNING * INTO s;
 RETURN jsonb_build_object('token',tok,'session_id',s.id,'expires_at',NULL,'persistent',true,
  'linked_user_id',uid,'user_name',uname,'label',s.label,
  'business_name',(SELECT name FROM public.providers WHERE id=l.provider_id));
END $$;
REVOKE ALL ON FUNCTION public.lc_open_scanner(TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lc_open_scanner(TEXT,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.lc_scanner_status(p_session_token TEXT,p_request_persistence BOOLEAN DEFAULT false) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.latido_card_scanner_sessions:=public.lc_scanner(p_session_token);
BEGIN
 RETURN jsonb_build_object('session_id',s.id,'label',s.label,'business_name',(SELECT name FROM public.providers WHERE id=s.provider_id),
  'expires_at',s.expires_at,'persistent',s.persistent,'persistence_requested',false,
  'linked_user_id',s.linked_user_id,'user_name',coalesce((SELECT nullif(btrim(name),'') FROM public.profiles WHERE id=s.linked_user_id),s.linked_user_name));
END $$;

CREATE OR REPLACE FUNCTION public.lc_close_scanner(p_session_token TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.latido_card_scanner_sessions:=public.lc_scanner(p_session_token);
BEGIN
 UPDATE public.latido_card_scanner_sessions SET revoked_at=now(),disconnected_at=now() WHERE id=s.id;
END $$;

CREATE OR REPLACE FUNCTION public.lc_manage_scanner(p_session UUID,p_action TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.latido_card_scanner_sessions;
BEGIN
 SELECT * INTO s FROM public.latido_card_scanner_sessions WHERE id=p_session FOR UPDATE;
 IF s.id IS NULL OR NOT public.lc_can_manage(s.provider_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF p_action='revoke' THEN
  UPDATE public.latido_card_scanner_sessions SET revoked_at=coalesce(revoked_at,now()) WHERE id=s.id;
 ELSIF p_action='delete' THEN
  -- Logical removal also blocks access and preserves the redemption audit trail.
  UPDATE public.latido_card_scanner_sessions SET revoked_at=coalesce(revoked_at,now()),hidden_at=coalesce(hidden_at,now()) WHERE id=s.id;
 ELSE RAISE EXCEPTION 'SCANNER_ACTION_INVALID'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.lc_business_dashboard(p_provider UUID DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF p_provider IS NOT NULL AND NOT public.lc_can_manage(p_provider) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 RETURN jsonb_build_object('businesses',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'participating',b.provider_id IS NOT NULL,'active',coalesce(b.active,false),'suspended',coalesce(b.suspended,false)) ORDER BY p.name),'[]'::jsonb)
 FROM public.providers p LEFT JOIN public.latido_card_businesses b ON b.provider_id=p.id WHERE p.user_id=auth.uid() OR public.lc_is_admin()),
 'offers',(SELECT coalesce(jsonb_agg(o ORDER BY o.created_at DESC),'[]'::jsonb) FROM public.latido_card_offers o WHERE o.provider_id=p_provider),
 'sessions',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'label',s.label,'user_id',s.linked_user_id,'user_name',coalesce(nullif(btrim(p.name),''),s.linked_user_name),
  'persistent',s.persistent,'expires_at',s.expires_at,'revoked_at',s.revoked_at,'disconnected_at',s.disconnected_at,'last_seen_at',s.last_seen_at,'created_at',s.created_at) ORDER BY s.created_at DESC),'[]'::jsonb)
 FROM public.latido_card_scanner_sessions s LEFT JOIN public.profiles p ON p.id=s.linked_user_id WHERE s.provider_id=p_provider AND s.hidden_at IS NULL),
 'history',(SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (SELECT r.id,r.offer_snapshot->>'title' AS title,r.redeemed_at,r.reversed_at,
 coalesce(nullif(btrim(p.name),''),s.linked_user_name,s.label) AS scanner_label FROM public.latido_card_redemptions r
 JOIN public.latido_card_scanner_sessions s ON s.id=r.scanner_session_id LEFT JOIN public.profiles p ON p.id=s.linked_user_id
 WHERE r.provider_id=p_provider ORDER BY r.redeemed_at DESC LIMIT 100) x));
END $$;
CREATE OR REPLACE FUNCTION public.lc_rotate_scanner_link(p_provider UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE tok TEXT:=public.lc_new_token();
BEGIN
 IF NOT public.lc_can_manage(p_provider) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM 1 FROM public.latido_card_businesses WHERE provider_id=p_provider AND active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'BUSINESS_INACTIVE'; END IF;
 UPDATE public.latido_card_scanner_links SET revoked_at=now() WHERE provider_id=p_provider AND revoked_at IS NULL;
 -- Remove old connections from the list while preserving their redemption history.
 UPDATE public.latido_card_scanner_sessions SET revoked_at=coalesce(revoked_at,now()),hidden_at=coalesce(hidden_at,now())
 WHERE provider_id=p_provider AND hidden_at IS NULL;
 INSERT INTO public.latido_card_scanner_links(provider_id,token_hash) VALUES(p_provider,public.lc_hash(tok));
 RETURN jsonb_build_object('token',tok);
END $$;
COMMIT;
