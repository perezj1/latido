-- Apply after latido_card_minimal.sql (also included in the current installer).
-- DELETE removes the publication while retaining private rows required by Card history.
BEGIN;
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
COMMIT;
