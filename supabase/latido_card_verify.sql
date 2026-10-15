-- STEP 3: read-only verification. All checks must return ok=true.
SELECT 'Core tables: RLS enabled, no direct app access' AS check_name,
 count(*)=6 AND bool_and(c.relrowsecurity AND NOT has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') AND NOT has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE')) AS ok
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('latido_card_memberships','latido_card_businesses','latido_card_offers','latido_card_claims','latido_card_redemptions','latido_card_admin_audit')
UNION ALL SELECT 'New member API enabled; guest cannot redeem',
 has_function_privilege('authenticated','public.lc_use_offer(uuid,uuid)','EXECUTE') AND NOT has_function_privilege('anon','public.lc_use_offer(uuid,uuid)','EXECUTE')
UNION ALL SELECT 'Legacy tables removed from public',NOT EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename IN ('latido_card_credentials','latido_card_scanner_links','latido_card_scanner_sessions','latido_card_manual_codes','latido_card_code_attempts','latido_card_physical_requests','latido_card_physical_events','latido_card_physical_email_queue','latido_card_saved_offers'))
UNION ALL SELECT 'Legacy APIs removed',NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND (p.proname IN ('lc_redeem','lc_issue_digital_card','lc_issue_card_code','lc_business_setup','lc_request_physical_card') OR p.proname LIKE 'lc_%scanner%'))
UNION ALL SELECT 'Archive inaccessible to app users',NOT has_schema_privilege('anon','latido_card_archive','USAGE') AND NOT has_schema_privilege('authenticated','latido_card_archive','USAGE');
SELECT 'memberships' AS entity,count(*) FROM public.latido_card_memberships
UNION ALL SELECT 'businesses',count(*) FROM public.latido_card_businesses
UNION ALL SELECT 'offers',count(*) FROM public.latido_card_offers
UNION ALL SELECT 'claims',count(*) FROM public.latido_card_claims
UNION ALL SELECT 'redemptions (including old history)',count(*) FROM public.latido_card_redemptions;
