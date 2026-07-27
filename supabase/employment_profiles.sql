-- =====================================================================
-- LATIDO.CH - Perfil profesional básico para solicitudes de empleo
--
-- Datos declarados por la persona usuaria. La valoración es orientativa
-- y no constituye una verificación, certificación ni garantía de empleo.
--
-- Idempotente. Ejecutar después de publication_structure_and_lifecycle.sql.
-- =====================================================================

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS employment_profile JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS employment_level TEXT,
  ADD COLUMN IF NOT EXISTS employment_profile_updated_at TIMESTAMPTZ;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS employment_profile JSONB,
  ADD COLUMN IF NOT EXISTS employment_level TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_employment_level_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_employment_level_check
      CHECK (employment_level IS NULL OR employment_level IN ('apprentice', 'intermediate', 'professional'))
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'jobs_employment_level_check'
      AND conrelid = 'public.jobs'::regclass
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_employment_level_check
      CHECK (employment_level IS NULL OR employment_level IN ('apprentice', 'intermediate', 'professional'))
      NOT VALID;
  END IF;
END
$$;

UPDATE public.jobs
SET
  employment_profile = JSONB_STRIP_NULLS(JSONB_BUILD_OBJECT(
    'experience',
      CASE
        WHEN experience_years >= 4 THEN 'four_plus'
        WHEN experience_years >= 1 THEN 'one_to_three'
        WHEN experience_years = 0 THEN 'none'
        ELSE NULL
      END,
    'availability',
      CASE
        WHEN available_from IS NULL THEN NULL
        WHEN available_from <= CURRENT_DATE + 3 THEN 'immediate'
        WHEN available_from <= CURRENT_DATE + 18 THEN 'two_weeks'
        WHEN available_from <= CURRENT_DATE + 45 THEN 'one_month'
        ELSE 'flexible'
      END,
    'workPermit', NULL,
    'mobility', CASE WHEN driving_license IS TRUE THEN 'driving_license' ELSE NULL END,
    'languages', COALESCE(languages, ARRAY[]::TEXT[])
  )),
  employment_level = CASE
    WHEN experience_years >= 4 THEN 'professional'
    WHEN experience_years >= 1 THEN 'intermediate'
    WHEN experience_years = 0 THEN 'apprentice'
    ELSE NULL
  END
WHERE job_intent = 'busca'
  AND (employment_profile IS NULL OR employment_profile = '{}'::JSONB);

WITH latest_request AS (
  SELECT DISTINCT ON (user_id)
    user_id,
    employment_profile,
    employment_level,
    updated_at
  FROM public.jobs
  WHERE user_id IS NOT NULL
    AND job_intent = 'busca'
    AND employment_profile IS NOT NULL
    AND employment_profile <> '{}'::JSONB
  ORDER BY user_id, updated_at DESC NULLS LAST, created_at DESC
)
UPDATE public.profiles AS profile
SET
  employment_profile = latest_request.employment_profile,
  employment_level = latest_request.employment_level,
  employment_profile_updated_at = COALESCE(latest_request.updated_at, NOW())
FROM latest_request
WHERE profile.id = latest_request.user_id
  AND (profile.employment_profile IS NULL OR profile.employment_profile = '{}'::JSONB);

COMMENT ON COLUMN public.profiles.employment_profile IS
  'Perfil laboral básico autodeclarado: experiencia, disponibilidad, permiso laboral, movilidad e idiomas.';
COMMENT ON COLUMN public.profiles.employment_level IS
  'Nivel orientativo calculado desde la experiencia declarada; no es una verificación de Latido.';
COMMENT ON COLUMN public.jobs.employment_profile IS
  'Copia del perfil laboral autodeclarado al publicar o actualizar una solicitud de empleo.';
COMMENT ON COLUMN public.jobs.employment_level IS
  'Nivel orientativo del perfil laboral en el momento de actualizar la solicitud.';

COMMIT;
