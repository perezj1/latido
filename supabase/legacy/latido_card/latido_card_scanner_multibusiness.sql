-- ARCHIVED: retired Scanner/physical-card system. Do not run for the minimal version.
-- Current instructions: docs/LATIDO_CARD_MINIMAL.md
-- Run AFTER latido_card_scanner_accounts.sql. Rerunnable.
-- Account-owned connections only; never exposes business invite secrets.
BEGIN;
CREATE OR REPLACE FUNCTION public.lc_my_scanner_businesses() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(x ORDER BY x.name),'[]'::jsonb) FROM (
  SELECT p.id,p.name,jsonb_agg(s.id ORDER BY s.created_at DESC) AS session_ids
  FROM public.latido_card_scanner_sessions s
  JOIN public.latido_card_scanner_links l ON l.id=s.link_id
  JOIN public.latido_card_businesses b ON b.provider_id=s.provider_id
  JOIN public.providers p ON p.id=s.provider_id
  WHERE s.linked_user_id=auth.uid() AND s.revoked_at IS NULL AND s.hidden_at IS NULL
   AND (s.expires_at IS NULL OR s.expires_at>now()) AND l.revoked_at IS NULL AND b.active
  GROUP BY p.id,p.name
 ) x);
END $$;
REVOKE ALL ON FUNCTION public.lc_my_scanner_businesses() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lc_my_scanner_businesses() TO authenticated;

-- Resume an existing account connection in a new browser without retaining the
-- owner's invite token. Does not revive revoked access or require a paid card.
CREATE OR REPLACE FUNCTION public.lc_resume_scanner(p_provider UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE source public.latido_card_scanner_sessions; s public.latido_card_scanner_sessions;
 uid UUID:=auth.uid(); uname TEXT; tok TEXT:=public.lc_new_token();
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 SELECT nullif(btrim(name),'') INTO uname FROM public.profiles WHERE id=uid;
 IF uname IS NULL THEN RAISE EXCEPTION 'PROFILE_NAME_REQUIRED'; END IF;
 -- Serialize against suspension / regeneration before checking the grant.
 PERFORM 1 FROM public.latido_card_businesses WHERE provider_id=p_provider AND active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'BUSINESS_INACTIVE'; END IF;
 SELECT ss.* INTO source FROM public.latido_card_scanner_sessions ss
 JOIN public.latido_card_scanner_links l ON l.id=ss.link_id
 WHERE ss.provider_id=p_provider AND ss.linked_user_id=uid AND ss.revoked_at IS NULL
  AND ss.hidden_at IS NULL AND (ss.expires_at IS NULL OR ss.expires_at>now()) AND l.revoked_at IS NULL
 ORDER BY ss.created_at DESC LIMIT 1 FOR UPDATE OF ss;
 IF source.id IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF (SELECT count(*) FROM public.latido_card_scanner_sessions
  WHERE provider_id=p_provider AND linked_user_id=uid AND created_at>now()-interval '1 hour') >= 30
 THEN RAISE EXCEPTION 'SCANNER_RATE_LIMIT'; END IF;
 INSERT INTO public.latido_card_scanner_sessions(link_id,provider_id,token_hash,label,persistent,expires_at,linked_user_id,linked_user_name)
 VALUES(source.link_id,p_provider,public.lc_hash(tok),'Scanner',true,NULL,uid,uname) RETURNING * INTO s;
 RETURN jsonb_build_object('token',tok,'session_id',s.id,'provider_id',p_provider,
  'business_name',(SELECT name FROM public.providers WHERE id=p_provider),
  'linked_user_id',uid,'user_name',uname,'label',s.label,'persistent',true,'expires_at',NULL);
END $$;
REVOKE ALL ON FUNCTION public.lc_resume_scanner(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lc_resume_scanner(UUID) TO authenticated;
COMMIT;
