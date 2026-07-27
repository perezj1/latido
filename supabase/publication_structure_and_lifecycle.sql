-- =====================================================================
-- LATIDO.CH - Estructura y ciclo de vida de solicitudes/perfiles
--
-- Idempotente. No modifica las reglas de moderación ni sus colas.
-- Ejecutar después de publications_schema_v4.sql y pregunta_latido_search.sql.
-- =====================================================================

BEGIN;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS property_type TEXT,
  ADD COLUMN IF NOT EXISTS available_from DATE,
  ADD COLUMN IF NOT EXISTS rooms NUMERIC,
  ADD COLUMN IF NOT EXISTS household_size SMALLINT,
  ADD COLUMN IF NOT EXISTS furnished BOOLEAN,
  ADD COLUMN IF NOT EXISTS pets_allowed BOOLEAN,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS job_intent TEXT NOT NULL DEFAULT 'ofrece',
  ADD COLUMN IF NOT EXISTS experience_years SMALLINT,
  ADD COLUMN IF NOT EXISTS available_from DATE,
  ADD COLUMN IF NOT EXISTS driving_license BOOLEAN,
  ADD COLUMN IF NOT EXISTS profile_visibility TEXT NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'listings_lifecycle_status_check'
      AND conrelid = 'public.listings'::regclass
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT listings_lifecycle_status_check
      CHECK (lifecycle_status IN ('active', 'resolved', 'expired', 'closed')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'jobs_lifecycle_status_check'
      AND conrelid = 'public.jobs'::regclass
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_lifecycle_status_check
      CHECK (lifecycle_status IN ('active', 'resolved', 'expired', 'closed')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'jobs_profile_visibility_check'
      AND conrelid = 'public.jobs'::regclass
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_profile_visibility_check
      CHECK (profile_visibility IN ('public', 'verified_employers')) NOT VALID;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.set_listing_lifecycle_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'busca' AND NEW.expires_at IS NULL THEN
    NEW.expires_at := NOW() + INTERVAL '30 days';
  END IF;

  IF NEW.lifecycle_status IN ('resolved', 'closed') AND NEW.resolved_at IS NULL THEN
    NEW.resolved_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_job_lifecycle_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.job_intent, 'ofrece') = 'busca' AND NEW.expires_at IS NULL THEN
    NEW.expires_at := NOW() + INTERVAL '45 days';
  END IF;

  IF NEW.lifecycle_status IN ('resolved', 'closed') AND NEW.resolved_at IS NULL THEN
    NEW.resolved_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listings_lifecycle_defaults ON public.listings;
CREATE TRIGGER listings_lifecycle_defaults
  BEFORE INSERT OR UPDATE OF type, lifecycle_status, expires_at
  ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_listing_lifecycle_defaults();

DROP TRIGGER IF EXISTS jobs_lifecycle_defaults ON public.jobs;
CREATE TRIGGER jobs_lifecycle_defaults
  BEFORE INSERT OR UPDATE OF job_intent, lifecycle_status, expires_at
  ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_job_lifecycle_defaults();

CREATE OR REPLACE FUNCTION public.prevent_duplicate_active_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.active IS TRUE
     AND NEW.lifecycle_status = 'active'
     AND NEW.type = 'busca'
     AND NEW.cat = 'vivienda'
     AND EXISTS (
       SELECT 1
       FROM public.listings existing
       WHERE existing.user_id = NEW.user_id
         AND existing.id <> NEW.id
         AND existing.active IS TRUE
         AND existing.cat = 'vivienda'
         AND existing.type = 'busca'
         AND COALESCE(existing.lifecycle_status, 'active') = 'active'
         AND (existing.expires_at IS NULL OR existing.expires_at > NOW())
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'ACTIVE_HOUSING_REQUEST_EXISTS';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_duplicate_active_job_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.active IS TRUE
     AND NEW.lifecycle_status = 'active'
     AND COALESCE(NEW.job_intent, 'ofrece') = 'busca'
     AND EXISTS (
       SELECT 1
       FROM public.jobs existing
       WHERE existing.user_id = NEW.user_id
         AND existing.id <> NEW.id
         AND existing.active IS TRUE
         AND COALESCE(existing.job_intent, 'ofrece') = 'busca'
         AND COALESCE(existing.lifecycle_status, 'active') = 'active'
         AND (existing.expires_at IS NULL OR existing.expires_at > NOW())
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'ACTIVE_JOB_PROFILE_EXISTS';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listings_prevent_duplicate_request ON public.listings;
CREATE TRIGGER listings_prevent_duplicate_request
  BEFORE INSERT OR UPDATE OF active, type, cat, lifecycle_status, expires_at
  ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_active_request();

DROP TRIGGER IF EXISTS jobs_prevent_duplicate_profile ON public.jobs;
CREATE TRIGGER jobs_prevent_duplicate_profile
  BEFORE INSERT OR UPDATE OF active, job_intent, lifecycle_status, expires_at
  ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_active_job_profile();

CREATE INDEX IF NOT EXISTS idx_listings_open_requests
  ON public.listings (cat, type, expires_at, created_at DESC)
  WHERE active IS TRUE AND type = 'busca';

CREATE INDEX IF NOT EXISTS idx_jobs_open_profiles
  ON public.jobs (job_intent, expires_at, created_at DESC)
  WHERE active IS TRUE AND job_intent = 'busca';

CREATE INDEX IF NOT EXISTS idx_providers_verified_owner
  ON public.providers (user_id)
  WHERE active IS TRUE AND verified IS TRUE;

-- Los perfiles restringidos solo se muestran a su propietario o a una
-- cuenta que gestione al menos un negocio verificado.
DROP POLICY IF EXISTS "jobs_read" ON public.jobs;
CREATE POLICY "jobs_read"
  ON public.jobs
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      active IS TRUE
      AND COALESCE(lifecycle_status, 'active') = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
      AND (
        COALESCE(job_intent, 'ofrece') <> 'busca'
        OR COALESCE(profile_visibility, 'public') = 'public'
        OR EXISTS (
          SELECT 1
          FROM public.providers provider
          WHERE provider.user_id = auth.uid()
            AND provider.verified IS TRUE
            AND provider.active IS TRUE
        )
      )
    )
  );

COMMIT;
