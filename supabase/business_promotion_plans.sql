-- ================================================================
-- LATIDO.CH - Business promotion plans for the Home carousel
-- Run this file once in the Supabase SQL Editor.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.business_promotion_plans (
  plan_key         TEXT PRIMARY KEY,
  label            TEXT NOT NULL,
  priority         INTEGER NOT NULL DEFAULT 0 CHECK (priority >= 0),
  rotation_weight  NUMERIC(8,2) NOT NULL DEFAULT 1 CHECK (rotation_weight >= 1),
  max_active       INTEGER CHECK (max_active IS NULL OR max_active > 0),
  enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT business_promotion_plan_key_check
    CHECK (plan_key IN ('free', 'featured', 'basic', 'premium', 'exclusive'))
);

INSERT INTO public.business_promotion_plans
  (plan_key, label, priority, rotation_weight, max_active, enabled)
VALUES
  ('free',      'Gratuito',           0,  1, NULL, TRUE),
  ('featured',  'Negocio Destacado',  1,  2,   20, TRUE),
  ('basic',     'Partner Básico',      2,  4,   12, TRUE),
  ('premium',   'Partner Premium',     3,  7,    6, TRUE),
  ('exclusive', 'Partner Exclusivo',   4, 10,    3, TRUE)
ON CONFLICT (plan_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.business_promotion_admins (
  email       TEXT PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add or replace this email if another account manages the plans.
INSERT INTO public.business_promotion_admins (email)
VALUES ('jose13hue@gmail.com')
ON CONFLICT (email) DO NOTHING;

ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS promotion_plan TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS promotion_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS promotion_ends_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'providers_promotion_plan_fkey'
      AND conrelid = 'public.providers'::regclass
  ) THEN
    ALTER TABLE public.providers
      ADD CONSTRAINT providers_promotion_plan_fkey
      FOREIGN KEY (promotion_plan)
      REFERENCES public.business_promotion_plans(plan_key);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'providers_promotion_dates_check'
      AND conrelid = 'public.providers'::regclass
  ) THEN
    ALTER TABLE public.providers
      ADD CONSTRAINT providers_promotion_dates_check
      CHECK (
        promotion_plan = 'free'
        OR (
          promotion_starts_at IS NOT NULL
          AND promotion_ends_at IS NOT NULL
          AND promotion_ends_at > promotion_starts_at
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_providers_promotion_active
  ON public.providers (promotion_plan, promotion_starts_at, promotion_ends_at)
  WHERE active = TRUE;

-- Existing highlighted businesses receive a 30-day Destacado period,
-- respecting the initial plan capacity.
WITH legacy_featured AS (
  SELECT providers.id
  FROM public.providers AS providers
  WHERE providers.featured = TRUE
    AND providers.promotion_plan = 'free'
  ORDER BY providers.created_at ASC, providers.id ASC
  LIMIT (
    SELECT plans.max_active
    FROM public.business_promotion_plans AS plans
    WHERE plans.plan_key = 'featured'
  )
)
UPDATE public.providers AS providers
SET
  promotion_plan = 'featured',
  promotion_starts_at = NOW(),
  promotion_ends_at = NOW() + INTERVAL '30 days'
WHERE providers.id IN (SELECT id FROM legacy_featured);

UPDATE public.providers
SET featured = FALSE
WHERE featured = TRUE
  AND promotion_plan = 'free';

UPDATE public.providers
SET
  promotion_plan = 'free',
  promotion_starts_at = NULL,
  promotion_ends_at = NULL,
  featured = FALSE
WHERE active IS FALSE;

ALTER TABLE public.business_promotion_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_promotion_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "business_promotion_plans_read" ON public.business_promotion_plans;
CREATE POLICY "business_promotion_plans_read"
  ON public.business_promotion_plans
  FOR SELECT
  USING (TRUE);

REVOKE ALL ON public.business_promotion_admins FROM anon, authenticated;
REVOKE ALL ON public.business_promotion_admins FROM PUBLIC;
GRANT SELECT ON public.business_promotion_plans TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_business_promotion_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.business_promotion_admins
    WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
  );
$$;

REVOKE ALL ON FUNCTION public.is_business_promotion_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_business_promotion_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_provider_business_promotion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_context BOOLEAN := COALESCE(
    current_setting('latido.promotion_admin', TRUE),
    ''
  ) = '1';
  promotion_changed BOOLEAN := FALSE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT admin_context THEN
      NEW.promotion_plan := 'free';
      NEW.promotion_starts_at := NULL;
      NEW.promotion_ends_at := NULL;
      NEW.featured := FALSE;
    END IF;
  ELSE
    promotion_changed :=
      NEW.promotion_plan IS DISTINCT FROM OLD.promotion_plan
      OR NEW.promotion_starts_at IS DISTINCT FROM OLD.promotion_starts_at
      OR NEW.promotion_ends_at IS DISTINCT FROM OLD.promotion_ends_at
      OR NEW.featured IS DISTINCT FROM OLD.featured;

    IF promotion_changed AND NOT admin_context THEN
      IF NEW.active IS FALSE THEN
        NEW.promotion_plan := 'free';
        NEW.promotion_starts_at := NULL;
        NEW.promotion_ends_at := NULL;
        NEW.featured := FALSE;
      ELSE
        RAISE EXCEPTION 'PROMOTION_FIELDS_PROTECTED'
          USING HINT = 'Use set_provider_business_promotion().';
      END IF;
    END IF;
  END IF;

  IF NEW.active IS FALSE
     OR (
       NEW.promotion_plan <> 'free'
       AND NEW.promotion_ends_at IS NOT NULL
       AND NEW.promotion_ends_at <= NOW()
     ) THEN
    NEW.promotion_plan := 'free';
    NEW.promotion_starts_at := NULL;
    NEW.promotion_ends_at := NULL;
    NEW.featured := FALSE;
  ELSIF NEW.promotion_plan = 'free' THEN
    NEW.promotion_starts_at := NULL;
    NEW.promotion_ends_at := NULL;
    NEW.featured := FALSE;
  ELSE
    NEW.featured := TRUE;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_provider_business_promotion
  ON public.providers;
CREATE TRIGGER protect_provider_business_promotion
BEFORE INSERT OR UPDATE ON public.providers
FOR EACH ROW
EXECUTE FUNCTION public.protect_provider_business_promotion();

CREATE OR REPLACE FUNCTION public.expire_business_promotions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_rows INTEGER := 0;
BEGIN
  PERFORM set_config('latido.promotion_admin', '1', TRUE);

  UPDATE public.providers
  SET
    promotion_plan = 'free',
    promotion_starts_at = NULL,
    promotion_ends_at = NULL,
    featured = FALSE
  WHERE promotion_plan <> 'free'
    AND promotion_ends_at <= NOW();

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_business_promotions() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.get_business_promotion_availability()
RETURNS TABLE (
  plan_key TEXT,
  label TEXT,
  priority INTEGER,
  rotation_weight NUMERIC,
  max_active INTEGER,
  enabled BOOLEAN,
  active_count BIGINT,
  available_slots INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.expire_business_promotions();

  RETURN QUERY
  SELECT
    plans.plan_key,
    plans.label,
    plans.priority,
    plans.rotation_weight,
    plans.max_active,
    plans.enabled,
    COUNT(providers.id) FILTER (
      WHERE providers.active = TRUE
        AND providers.promotion_starts_at <= NOW()
        AND providers.promotion_ends_at > NOW()
    ) AS active_count,
    CASE
      WHEN plans.max_active IS NULL THEN NULL
      ELSE GREATEST(
        plans.max_active - (
          COUNT(providers.id) FILTER (
            WHERE providers.active = TRUE
              AND providers.promotion_starts_at <= NOW()
              AND providers.promotion_ends_at > NOW()
          )
        )::INTEGER,
        0
      )
    END AS available_slots
  FROM public.business_promotion_plans AS plans
  LEFT JOIN public.providers AS providers
    ON providers.promotion_plan = plans.plan_key
  GROUP BY
    plans.plan_key,
    plans.label,
    plans.priority,
    plans.rotation_weight,
    plans.max_active,
    plans.enabled
  ORDER BY plans.priority ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_business_promotion_availability() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_business_promotion_availability()
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_provider_business_promotion(
  p_provider_id UUID,
  p_plan_key TEXT,
  p_starts_at TIMESTAMPTZ DEFAULT NULL,
  p_ends_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS SETOF public.providers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_plan public.business_promotion_plans%ROWTYPE;
  selected_provider public.providers%ROWTYPE;
  reserved_slots INTEGER := 0;
  starts_at TIMESTAMPTZ;
  ends_at TIMESTAMPTZ;
BEGIN
  IF NOT public.is_business_promotion_admin() THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;

  SELECT *
  INTO selected_provider
  FROM public.providers
  WHERE id = p_provider_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROVIDER_NOT_FOUND';
  END IF;

  IF p_plan_key = 'free' THEN
    PERFORM set_config('latido.promotion_admin', '1', TRUE);

    UPDATE public.providers
    SET
      promotion_plan = 'free',
      promotion_starts_at = NULL,
      promotion_ends_at = NULL,
      featured = FALSE
    WHERE id = p_provider_id;

    RETURN QUERY
      SELECT providers.*
      FROM public.providers AS providers
      WHERE providers.id = p_provider_id;
    RETURN;
  END IF;

  SELECT *
  INTO selected_plan
  FROM public.business_promotion_plans
  WHERE plan_key = p_plan_key
  FOR UPDATE;

  IF NOT FOUND OR selected_plan.enabled IS NOT TRUE THEN
    RAISE EXCEPTION 'PLAN_UNAVAILABLE';
  END IF;

  IF selected_provider.active IS FALSE THEN
    RAISE EXCEPTION 'BUSINESS_NOT_VERIFIED';
  END IF;

  starts_at := COALESCE(p_starts_at, NOW());
  ends_at := p_ends_at;

  IF ends_at IS NULL OR ends_at <= starts_at THEN
    RAISE EXCEPTION 'INVALID_PROMOTION_DATES';
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO reserved_slots
  FROM public.providers
  WHERE id <> p_provider_id
    AND promotion_plan = p_plan_key
    AND active = TRUE
    AND promotion_starts_at < ends_at
    AND promotion_ends_at > starts_at;

  IF selected_plan.max_active IS NOT NULL
     AND reserved_slots >= selected_plan.max_active THEN
    RAISE EXCEPTION 'PLAN_FULL';
  END IF;

  PERFORM set_config('latido.promotion_admin', '1', TRUE);

  UPDATE public.providers
  SET
    promotion_plan = p_plan_key,
    promotion_starts_at = starts_at,
    promotion_ends_at = ends_at,
    featured = TRUE
  WHERE id = p_provider_id;

  RETURN QUERY
    SELECT providers.*
    FROM public.providers AS providers
    WHERE providers.id = p_provider_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_provider_business_promotion(
  UUID,
  TEXT,
  TIMESTAMPTZ,
  TIMESTAMPTZ
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_provider_business_promotion(
  UUID,
  TEXT,
  TIMESTAMPTZ,
  TIMESTAMPTZ
) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_business_promotion_plan(
  p_plan_key TEXT,
  p_max_active INTEGER,
  p_enabled BOOLEAN,
  p_rotation_weight NUMERIC
)
RETURNS SETOF public.business_promotion_plans
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_plans INTEGER := 0;
BEGIN
  IF NOT public.is_business_promotion_admin() THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;

  IF p_plan_key = 'free' THEN
    RAISE EXCEPTION 'FREE_PLAN_IMMUTABLE';
  END IF;

  IF p_max_active IS NULL OR p_max_active < 1 THEN
    RAISE EXCEPTION 'INVALID_PLAN_LIMIT';
  END IF;

  IF p_rotation_weight IS NULL OR p_rotation_weight < 1 THEN
    RAISE EXCEPTION 'INVALID_ROTATION_WEIGHT';
  END IF;

  PERFORM 1
  FROM public.business_promotion_plans
  WHERE plan_key = p_plan_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PLAN_NOT_FOUND';
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO active_plans
  FROM public.providers
  WHERE promotion_plan = p_plan_key
    AND active = TRUE
    AND promotion_ends_at > NOW();

  IF p_max_active < active_plans THEN
    RAISE EXCEPTION 'LIMIT_BELOW_ACTIVE';
  END IF;

  UPDATE public.business_promotion_plans
  SET
    max_active = p_max_active,
    enabled = COALESCE(p_enabled, TRUE),
    rotation_weight = p_rotation_weight,
    updated_at = NOW()
  WHERE plan_key = p_plan_key;

  RETURN QUERY
    SELECT plans.*
    FROM public.business_promotion_plans AS plans
    WHERE plans.plan_key = p_plan_key;
END;
$$;

REVOKE ALL ON FUNCTION public.update_business_promotion_plan(
  TEXT,
  INTEGER,
  BOOLEAN,
  NUMERIC
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_business_promotion_plan(
  TEXT,
  INTEGER,
  BOOLEAN,
  NUMERIC
) TO authenticated;

-- Optional: if pg_cron is enabled, uncomment to clean expired plans hourly.
-- SELECT cron.schedule(
--   'expire-business-promotions',
--   '5 * * * *',
--   $$SELECT public.expire_business_promotions();$$
-- );
