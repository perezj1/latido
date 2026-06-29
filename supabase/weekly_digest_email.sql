-- =====================================================================
-- LATIDO.CH - Email de actividad para usuarios inactivos 7 dias
--
-- Ejecuta este archivo una vez en Supabase SQL Editor ANTES de desplegar
-- la Edge Function latido_weekly_digest_email.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- La app actualiza profiles.last_seen_at cuando el usuario entra.
-- Estos ALTER son idempotentes por si el proyecto tiene usuarios antiguos.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banned BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_at
  ON public.profiles (last_seen_at DESC);

-- Reutilizamos la tabla de preferencias de email si ya existe.
CREATE TABLE IF NOT EXISTS public.email_notification_preferences (
  user_id                 UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_emails_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  weekly_digest_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.email_notification_preferences
  ADD COLUMN IF NOT EXISTS weekly_digest_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.email_notification_preferences ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.email_notification_preferences TO authenticated;

DROP POLICY IF EXISTS "email_preferences_select_own" ON public.email_notification_preferences;
CREATE POLICY "email_preferences_select_own"
  ON public.email_notification_preferences
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "email_preferences_insert_own" ON public.email_notification_preferences;
CREATE POLICY "email_preferences_insert_own"
  ON public.email_notification_preferences
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "email_preferences_update_own" ON public.email_notification_preferences;
CREATE POLICY "email_preferences_update_own"
  ON public.email_notification_preferences
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.weekly_digest_email_log (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email                  TEXT NOT NULL,
  week_start             DATE,
  eligible_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  inactivity_started_at  TIMESTAMPTZ,
  eligible_at            TIMESTAMPTZ,
  status                 TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'suppressed')),
  attempts               INTEGER NOT NULL DEFAULT 0,
  processing_started_at  TIMESTAMPTZ,
  sent_at                TIMESTAMPTZ,
  last_error             TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.weekly_digest_email_log
  ADD COLUMN IF NOT EXISTS eligible_date DATE NOT NULL DEFAULT CURRENT_DATE;

ALTER TABLE public.weekly_digest_email_log
  ADD COLUMN IF NOT EXISTS inactivity_started_at TIMESTAMPTZ;

ALTER TABLE public.weekly_digest_email_log
  ADD COLUMN IF NOT EXISTS eligible_at TIMESTAMPTZ;

DO $$
BEGIN
  ALTER TABLE public.weekly_digest_email_log
    DROP CONSTRAINT IF EXISTS weekly_digest_email_log_user_id_week_start_key;
EXCEPTION
  WHEN OTHERS THEN NULL;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_digest_email_log_user_eligible_date
  ON public.weekly_digest_email_log (user_id, eligible_date);

CREATE INDEX IF NOT EXISTS idx_weekly_digest_email_log_status
  ON public.weekly_digest_email_log (status, attempts, created_at);

CREATE INDEX IF NOT EXISTS idx_weekly_digest_email_log_user_created
  ON public.weekly_digest_email_log (user_id, created_at DESC);

ALTER TABLE public.weekly_digest_email_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.weekly_digest_email_log FROM anon, authenticated;
GRANT ALL ON public.weekly_digest_email_log TO service_role;

-- Necesario si existia la version anterior que devolvia week_start.
DROP FUNCTION IF EXISTS public.claim_weekly_digest_recipients(INTEGER);

CREATE OR REPLACE FUNCTION public.claim_weekly_digest_recipients(
  p_limit INTEGER DEFAULT 25
)
RETURNS TABLE (
  log_id UUID,
  user_id UUID,
  email TEXT,
  display_name TEXT,
  eligible_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  safe_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);
BEGIN
  -- Libera procesos que se quedaron a medias por timeout.
  UPDATE public.weekly_digest_email_log
  SET
    status = 'pending',
    processing_started_at = NULL,
    updated_at = NOW(),
    last_error = COALESCE(last_error, 'Processing timeout, retrying.')
  WHERE status = 'processing'
    AND processing_started_at < NOW() - INTERVAL '30 minutes'
    AND attempts < 3;

  -- Crea candidatos cuando ya llevan 7 dias sin entrar.
  INSERT INTO public.weekly_digest_email_log (
    user_id,
    email,
    week_start,
    eligible_date,
    inactivity_started_at,
    eligible_at,
    status
  )
  SELECT
    profile.id,
    LOWER(BTRIM(profile.email)),
    DATE_TRUNC('week', NOW())::DATE,
    CURRENT_DATE,
    COALESCE(profile.last_seen_at, profile.created_at, NOW() - INTERVAL '8 days'),
    COALESCE(profile.last_seen_at, profile.created_at, NOW() - INTERVAL '8 days') + INTERVAL '7 days',
    'pending'
  FROM public.profiles profile
  LEFT JOIN public.email_notification_preferences preference
    ON preference.user_id = profile.id
  WHERE COALESCE(profile.email, '') <> ''
    AND COALESCE(profile.banned, FALSE) IS FALSE
    AND COALESCE(preference.weekly_digest_enabled, TRUE) IS TRUE
    AND COALESCE(profile.last_seen_at, profile.created_at, NOW() - INTERVAL '8 days')
        <= NOW() - INTERVAL '7 days'
    AND NOT EXISTS (
      SELECT 1
      FROM public.weekly_digest_email_log previous
      WHERE previous.user_id = profile.id
        AND previous.status IN ('pending', 'processing', 'sent', 'failed')
        AND previous.created_at > NOW() - INTERVAL '7 days'
    )
  ON CONFLICT (user_id, eligible_date) DO NOTHING;

  -- Reclama lote pendiente. Tambien reintenta fallidos hasta 3 veces.
  RETURN QUERY
  WITH picked AS (
    SELECT log.id
    FROM public.weekly_digest_email_log log
    WHERE log.status IN ('pending', 'failed')
      AND log.attempts < 3
    ORDER BY log.created_at ASC
    LIMIT safe_limit
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE public.weekly_digest_email_log log
    SET
      status = 'processing',
      attempts = log.attempts + 1,
      processing_started_at = NOW(),
      updated_at = NOW()
    FROM picked
    WHERE log.id = picked.id
    RETURNING log.id, log.user_id, log.email, log.eligible_date
  )
  SELECT
    updated.id AS log_id,
    updated.user_id,
    updated.email,
    COALESCE(NULLIF(BTRIM(profile.name), ''), 'Usuario') AS display_name,
    updated.eligible_date
  FROM updated
  JOIN public.profiles profile
    ON profile.id = updated.user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_weekly_digest_delivery(
  p_log_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.weekly_digest_email_log
  SET
    status = 'sent',
    sent_at = NOW(),
    processing_started_at = NULL,
    last_error = NULL,
    updated_at = NOW()
  WHERE id = p_log_id
    AND status = 'processing';
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_weekly_digest_delivery(
  p_log_id UUID,
  p_error TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.weekly_digest_email_log
  SET
    status = CASE WHEN attempts >= 3 THEN 'failed' ELSE 'pending' END,
    processing_started_at = NULL,
    last_error = LEFT(COALESCE(p_error, 'UNKNOWN_ERROR'), 1000),
    updated_at = NOW()
  WHERE id = p_log_id
    AND status = 'processing';
END;
$$;

REVOKE ALL ON FUNCTION public.claim_weekly_digest_recipients(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_weekly_digest_delivery(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fail_weekly_digest_delivery(UUID, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.claim_weekly_digest_recipients(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_weekly_digest_delivery(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_weekly_digest_delivery(UUID, TEXT) TO service_role;

-- Diagnostico:
-- SELECT * FROM public.weekly_digest_email_log ORDER BY created_at DESC LIMIT 50;
-- UPDATE public.profiles SET last_seen_at = NOW() - INTERVAL '8 days' WHERE email = 'TU_EMAIL_DE_PRUEBA';
