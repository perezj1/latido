-- Per-account visibility limits for listings and jobs. No publications are deleted.
BEGIN;
CREATE TABLE IF NOT EXISTS public.user_publication_lifetimes (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  lifetime_hours INTEGER NOT NULL CHECK (lifetime_hours BETWEEN 1 AND 8760),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_publication_lifetimes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_publication_lifetimes FROM anon, authenticated;
GRANT SELECT ON public.user_publication_lifetimes TO authenticated;
GRANT ALL ON public.user_publication_lifetimes TO service_role;
DROP POLICY IF EXISTS publication_lifetime_read_own ON public.user_publication_lifetimes;
CREATE POLICY publication_lifetime_read_own ON public.user_publication_lifetimes
  FOR SELECT TO authenticated USING (user_id=auth.uid());

CREATE OR REPLACE FUNCTION public.user_publication_deadline(p_user UUID,p_created_at TIMESTAMPTZ)
RETURNS TIMESTAMPTZ LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT p_created_at + make_interval(hours => lifetime_hours)
  FROM public.user_publication_lifetimes WHERE user_id=p_user;
$$;
REVOKE ALL ON FUNCTION public.user_publication_deadline(UUID,TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_publication_deadline(UUID,TIMESTAMPTZ) TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.enforce_user_publication_lifetime() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE hours INTEGER;
BEGIN
  SELECT lifetime_hours INTO hours FROM public.user_publication_lifetimes WHERE user_id=NEW.user_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  -- The server assigns the initial publication time; edits cannot reset it.
  IF TG_OP='INSERT' THEN NEW.created_at := now();
  ELSE NEW.created_at := coalesce(OLD.created_at,now()); END IF;
  NEW.expires_at := NEW.created_at + make_interval(hours => hours);
  IF NEW.expires_at <= now() THEN
    NEW.active := FALSE;
    IF coalesce(NEW.lifecycle_status,'active')='active' THEN NEW.lifecycle_status := 'expired'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_user_publication_lifetime() FROM PUBLIC;

DO $$
DECLARE publication_table TEXT;
BEGIN
  FOREACH publication_table IN ARRAY ARRAY['listings','jobs'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS zzz_user_publication_lifetime ON public.%I',publication_table);
    EXECUTE format('CREATE TRIGGER zzz_user_publication_lifetime BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_user_publication_lifetime()',publication_table);
    -- Restrictive policies also apply when another public-read policy would allow a row.
    EXECUTE format('DROP POLICY IF EXISTS user_publication_lifetime_visible ON public.%I',publication_table);
    EXECUTE format('CREATE POLICY user_publication_lifetime_visible ON public.%I AS RESTRICTIVE FOR SELECT TO anon,authenticated USING (
      public.user_publication_deadline(user_id,created_at) IS NULL
      OR public.user_publication_deadline(user_id,created_at)>now()
      OR user_id=auth.uid() OR user_id=public.latido_account_id()
      OR public.is_business_promotion_admin() OR public.is_latido_admin())',publication_table);
    -- Expired publications remain available to their owner in the management panel.
    EXECUTE format('DROP POLICY IF EXISTS limited_publications_read_own ON public.%I',publication_table);
    EXECUTE format('CREATE POLICY limited_publications_read_own ON public.%I FOR SELECT TO authenticated USING (
      public.user_publication_deadline(user_id,created_at) IS NOT NULL
      AND (user_id=auth.uid() OR user_id=public.latido_account_id()))',publication_table);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(user_id,expires_at) WHERE active IS TRUE',publication_table || '_user_expiry_idx',publication_table);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_limited_user_publications() RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE listings_count INTEGER; jobs_count INTEGER;
BEGIN
  UPDATE public.listings publication SET active=FALSE,
    lifecycle_status=CASE WHEN publication.lifecycle_status='active' THEN 'expired' ELSE publication.lifecycle_status END
  FROM public.user_publication_lifetimes rule
  WHERE publication.user_id=rule.user_id AND publication.active IS TRUE
    AND publication.created_at + make_interval(hours=>rule.lifetime_hours)<=now();
  GET DIAGNOSTICS listings_count=ROW_COUNT;
  UPDATE public.jobs publication SET active=FALSE,
    lifecycle_status=CASE WHEN publication.lifecycle_status='active' THEN 'expired' ELSE publication.lifecycle_status END
  FROM public.user_publication_lifetimes rule
  WHERE publication.user_id=rule.user_id AND publication.active IS TRUE
    AND publication.created_at + make_interval(hours=>rule.lifetime_hours)<=now();
  GET DIAGNOSTICS jobs_count=ROW_COUNT;
  RETURN listings_count + jobs_count;
END;
$$;
REVOKE ALL ON FUNCTION public.expire_limited_user_publications() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.expire_limited_user_publications() TO service_role;

CREATE OR REPLACE FUNCTION public.set_user_publication_lifetime(p_user UUID,p_hours INTEGER) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE listings_count INTEGER; jobs_count INTEGER;
BEGIN
  INSERT INTO public.user_publication_lifetimes(user_id,lifetime_hours) VALUES(p_user,p_hours)
    ON CONFLICT(user_id) DO UPDATE SET lifetime_hours=excluded.lifetime_hours,updated_at=now();
  UPDATE public.listings SET expires_at=created_at+make_interval(hours=>p_hours)
    WHERE user_id=p_user AND (expires_at IS DISTINCT FROM created_at+make_interval(hours=>p_hours)
      OR (active IS TRUE AND created_at+make_interval(hours=>p_hours)<=now()));
  GET DIAGNOSTICS listings_count=ROW_COUNT;
  UPDATE public.jobs SET expires_at=created_at+make_interval(hours=>p_hours)
    WHERE user_id=p_user AND (expires_at IS DISTINCT FROM created_at+make_interval(hours=>p_hours)
      OR (active IS TRUE AND created_at+make_interval(hours=>p_hours)<=now()));
  GET DIAGNOSTICS jobs_count=ROW_COUNT;
  RETURN listings_count + jobs_count;
END;
$$;
REVOKE ALL ON FUNCTION public.set_user_publication_lifetime(UUID,INTEGER) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_publication_lifetime(UUID,INTEGER) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
