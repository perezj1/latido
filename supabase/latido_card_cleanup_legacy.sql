-- STEP 2. Run ONLY after latido_card_minimal.sql. Transactional and rerunnable.
-- Removes retired APIs from public and archives their data privately; no CASCADE.
BEGIN;
DO $$ BEGIN
 IF to_regprocedure('public.lc_use_offer(uuid,uuid)') IS NULL OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='latido_card_redemptions' AND column_name='display_valid_until') THEN
  RAISE EXCEPTION 'Run latido_card_minimal.sql first';
 END IF;
END $$;

-- Stop only the dedicated physical-card email job, leaving other Latido jobs alone.
DO $$ DECLARE job RECORD; BEGIN
 IF to_regclass('cron.job') IS NOT NULL THEN
  FOR job IN EXECUTE 'SELECT jobid FROM cron.job WHERE jobname=''latido-card-physical-email''' LOOP
   EXECUTE 'SELECT cron.unschedule($1)' USING job.jobid;
  END LOOP;
 END IF;
END $$;

-- Preserve scanner provenance on historical redemptions before removing the FK.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='latido_card_redemptions' AND column_name='scanner_session_id') THEN
  IF to_regclass('public.latido_card_scanner_sessions') IS NOT NULL THEN
   EXECUTE 'UPDATE public.latido_card_redemptions r SET legacy_metadata=r.legacy_metadata||jsonb_build_object(''scanner_session_id'',r.scanner_session_id,''scanner_label'',s.label) FROM public.latido_card_scanner_sessions s WHERE s.id=r.scanner_session_id';
  END IF;
  ALTER TABLE public.latido_card_redemptions DROP COLUMN scanner_session_id;
 END IF;
END $$;

-- Explicit list: never remove another Latido module's functions or new Card APIs.
DO $$ DECLARE f RECORD; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname=ANY(ARRAY[
  'lc_physical_public','lc_physical_notify','lc_member_physical_requests','lc_request_physical_card','lc_cancel_physical_request',
  'lc_admin_physical_queue','lc_admin_update_physical_request','lc_admin_issue_request_card','lc_claim_physical_emails','lc_finish_physical_email','lc_admin_retry_physical_email',
  'lc_issue_digital_card','lc_report_lost_card','lc_admin_physical_card','lc_scanner','lc_card_member','lc_open_scanner','lc_scanner_status','lc_scan_card','lc_redeem',
  'lc_close_scanner','lc_rotate_scanner_link','lc_manage_scanner','lc_my_scanner_businesses','lc_resume_scanner','lc_business_setup','lc_save_favorite',
  'lc_issue_card_code','lc_scan_card_code','lc_hash','lc_new_token']) LOOP
  EXECUTE format('DROP FUNCTION %s',f.signature);
 END LOOP;
END $$;

CREATE SCHEMA IF NOT EXISTS latido_card_archive;
REVOKE ALL ON SCHEMA latido_card_archive FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA latido_card_archive TO service_role;
DO $$ DECLARE name TEXT; BEGIN
 IF to_regclass('public.latido_card_credentials') IS NOT NULL THEN
  DROP TRIGGER IF EXISTS lc_credential_admin_audit ON public.latido_card_credentials;
 END IF;
 FOREACH name IN ARRAY ARRAY['physical_email_queue','physical_events','physical_requests','credentials','manual_codes','code_attempts','scanner_sessions','scanner_links','saved_offers'] LOOP
  IF to_regclass('public.latido_card_'||name) IS NOT NULL THEN
   IF to_regclass('latido_card_archive.latido_card_'||name) IS NOT NULL THEN RAISE EXCEPTION 'Archive collision: % (no data moved)',name; END IF;
   EXECUTE format('ALTER TABLE public.latido_card_%I ENABLE ROW LEVEL SECURITY',name);
   EXECUTE format('REVOKE ALL ON public.latido_card_%I FROM PUBLIC,anon,authenticated',name);
   EXECUTE format('ALTER TABLE public.latido_card_%I SET SCHEMA latido_card_archive',name);
   EXECUTE format('GRANT ALL ON latido_card_archive.latido_card_%I TO service_role',name);
  END IF;
 END LOOP;
END $$;
-- Historical notifications and admin audit remain available, without sending mail.
-- Do not expose latido_card_archive through PostgREST or grant it to app roles.
NOTIFY pgrst,'reload schema';
COMMIT;
