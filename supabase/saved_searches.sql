-- =====================================================================
-- LATIDO.CH - Busquedas guardadas y alertas de nuevos resultados
--
-- Ejecuta este archivo en Supabase SQL Editor antes de desplegar la
-- version de la app que incluye búsquedas guardadas.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  query TEXT NOT NULL DEFAULT '',
  entity_kinds TEXT[] NOT NULL,
  category TEXT,
  intent TEXT,
  canton TEXT,
  city TEXT,
  plz TEXT,
  filters JSONB NOT NULL DEFAULT '{}'::JSONB,
  result_path TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily')),
  push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_delivery_attempt_at TIMESTAMPTZ,
  last_notified_at TIMESTAMPTZ,
  last_email_attempt_at TIMESTAMPTZ,
  last_email_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT saved_searches_entity_kinds_not_empty
    CHECK (cardinality(entity_kinds) > 0),
  CONSTRAINT saved_searches_entity_kinds_valid
    CHECK (entity_kinds <@ ARRAY['listing', 'job', 'provider', 'event', 'community', 'creator', 'creator_content']::TEXT[]),
  CONSTRAINT saved_searches_result_path_internal
    CHECK (result_path LIKE '/%'),
  UNIQUE (user_id, fingerprint)
);

CREATE TABLE IF NOT EXISTS public.saved_search_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_search_id UUID NOT NULL REFERENCES public.saved_searches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entity_kind TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  search_name TEXT NOT NULL,
  result_title TEXT NOT NULL,
  result_location TEXT,
  result_path TEXT NOT NULL,
  matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified_at TIMESTAMPTZ,
  push_sent_at TIMESTAMPTZ,
  email_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (email_status IN ('pending', 'processing', 'retry', 'sent', 'failed', 'suppressed')),
  email_attempts INTEGER NOT NULL DEFAULT 0,
  email_due_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email_processing_at TIMESTAMPTZ,
  email_sent_at TIMESTAMPTZ,
  email_error TEXT,
  read_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  CONSTRAINT saved_search_matches_entity_kind_valid
    CHECK (entity_kind IN ('listing', 'job', 'provider', 'event', 'community', 'creator', 'creator_content')),
  CONSTRAINT saved_search_matches_result_path_internal
    CHECK (result_path LIKE '/%'),
  UNIQUE (saved_search_id, entity_kind, entity_id)
);

-- CREATE TABLE IF NOT EXISTS no actualiza restricciones ya desplegadas.
-- Las recreamos para que las instalaciones existentes acepten alertas de
-- perfiles y contenidos de creadores.
ALTER TABLE public.saved_searches
  DROP CONSTRAINT IF EXISTS saved_searches_entity_kinds_valid;
ALTER TABLE public.saved_searches
  ADD CONSTRAINT saved_searches_entity_kinds_valid
  CHECK (entity_kinds <@ ARRAY['listing', 'job', 'provider', 'event', 'community', 'creator', 'creator_content']::TEXT[]);

ALTER TABLE public.saved_search_matches
  DROP CONSTRAINT IF EXISTS saved_search_matches_entity_kind_check;
ALTER TABLE public.saved_search_matches
  DROP CONSTRAINT IF EXISTS saved_search_matches_entity_kind_valid;
ALTER TABLE public.saved_search_matches
  ADD CONSTRAINT saved_search_matches_entity_kind_valid
  CHECK (entity_kind IN ('listing', 'job', 'provider', 'event', 'community', 'creator', 'creator_content'));

ALTER TABLE public.saved_searches
  ADD COLUMN IF NOT EXISTS email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS last_email_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_email_notified_at TIMESTAMPTZ;

ALTER TABLE public.saved_search_matches
  ADD COLUMN IF NOT EXISTS email_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS email_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_due_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS email_processing_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_error TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'saved_search_matches_email_status_check'
      AND conrelid = 'public.saved_search_matches'::REGCLASS
  ) THEN
    ALTER TABLE public.saved_search_matches
      ADD CONSTRAINT saved_search_matches_email_status_check
      CHECK (email_status IN ('pending', 'processing', 'retry', 'sent', 'failed', 'suppressed'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS saved_searches_active_kinds_idx
  ON public.saved_searches USING GIN (entity_kinds)
  WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS saved_searches_user_active_idx
  ON public.saved_searches (user_id, active, updated_at DESC);

CREATE INDEX IF NOT EXISTS saved_searches_pending_delivery_idx
  ON public.saved_searches (last_delivery_attempt_at)
  WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS saved_search_matches_user_unread_idx
  ON public.saved_search_matches (user_id, matched_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS saved_search_matches_pending_idx
  ON public.saved_search_matches (saved_search_id, matched_at)
  WHERE notified_at IS NULL;

CREATE INDEX IF NOT EXISTS saved_search_matches_pending_email_idx
  ON public.saved_search_matches (saved_search_id, email_due_at, matched_at)
  WHERE email_status IN ('pending', 'retry');

CREATE OR REPLACE FUNCTION public.touch_saved_search_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.limit_saved_searches_per_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.saved_searches
    WHERE user_id = NEW.user_id
      AND fingerprint = NEW.fingerprint
  ) AND (
    SELECT COUNT(*)
    FROM public.saved_searches
    WHERE user_id = NEW.user_id
  ) >= 10 THEN
    RAISE EXCEPTION 'Puedes guardar hasta 10 búsquedas. Elimina una para crear otra.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS saved_searches_limit_per_user ON public.saved_searches;
CREATE TRIGGER saved_searches_limit_per_user
BEFORE INSERT ON public.saved_searches
FOR EACH ROW
EXECUTE FUNCTION public.limit_saved_searches_per_user();

DROP TRIGGER IF EXISTS saved_searches_touch_updated_at ON public.saved_searches;
CREATE TRIGGER saved_searches_touch_updated_at
BEFORE UPDATE ON public.saved_searches
FOR EACH ROW
EXECUTE FUNCTION public.touch_saved_search_updated_at();

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_search_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saved_searches_select_own ON public.saved_searches;
CREATE POLICY saved_searches_select_own
  ON public.saved_searches
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS saved_searches_insert_own ON public.saved_searches;
CREATE POLICY saved_searches_insert_own
  ON public.saved_searches
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS saved_searches_update_own ON public.saved_searches;
CREATE POLICY saved_searches_update_own
  ON public.saved_searches
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS saved_searches_delete_own ON public.saved_searches;
CREATE POLICY saved_searches_delete_own
  ON public.saved_searches
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS saved_search_matches_select_own ON public.saved_search_matches;
CREATE POLICY saved_search_matches_select_own
  ON public.saved_search_matches
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS saved_search_matches_update_own ON public.saved_search_matches;
CREATE POLICY saved_search_matches_update_own
  ON public.saved_search_matches
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_searches TO authenticated;
GRANT SELECT ON public.saved_search_matches TO authenticated;
GRANT UPDATE (read_at, opened_at) ON public.saved_search_matches TO authenticated;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_search_matches;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE OR REPLACE FUNCTION public.claim_saved_search_email_deliveries(
  p_limit INTEGER DEFAULT 25
)
RETURNS TABLE (
  saved_search_id UUID,
  user_id UUID,
  search_name TEXT,
  result_path TEXT,
  match_ids UUID[],
  match_count INTEGER,
  results JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.saved_search_matches
  SET
    email_status = 'retry',
    email_processing_at = NULL,
    email_due_at = NOW(),
    email_error = COALESCE(email_error, 'processing_timeout')
  WHERE email_status = 'processing'
    AND email_processing_at < NOW() - INTERVAL '20 minutes';

  RETURN QUERY
  WITH due_searches AS MATERIALIZED (
    SELECT
      search_row.id,
      search_row.user_id,
      search_row.name,
      search_row.result_path
    FROM public.saved_searches AS search_row
    WHERE search_row.active = TRUE
      AND search_row.email_enabled = TRUE
      AND (
        search_row.last_email_notified_at IS NULL
        OR search_row.last_email_notified_at <= NOW() - INTERVAL '24 hours'
      )
      AND EXISTS (
        SELECT 1
        FROM public.saved_search_matches AS pending_match
        WHERE pending_match.saved_search_id = search_row.id
          AND pending_match.email_status IN ('pending', 'retry')
          AND pending_match.email_due_at <= NOW()
      )
    ORDER BY (
      SELECT MIN(pending_match.matched_at)
      FROM public.saved_search_matches AS pending_match
      WHERE pending_match.saved_search_id = search_row.id
        AND pending_match.email_status IN ('pending', 'retry')
        AND pending_match.email_due_at <= NOW()
    )
    FOR UPDATE OF search_row SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100)
  ),
  claimed_matches AS (
    UPDATE public.saved_search_matches AS match_row
    SET
      email_status = 'processing',
      email_attempts = match_row.email_attempts + 1,
      email_processing_at = NOW(),
      email_error = NULL
    FROM due_searches
    WHERE match_row.saved_search_id = due_searches.id
      AND match_row.email_status IN ('pending', 'retry')
      AND match_row.email_due_at <= NOW()
    RETURNING match_row.*
  )
  SELECT
    due_searches.id,
    due_searches.user_id,
    due_searches.name,
    due_searches.result_path,
    ARRAY_AGG(claimed_matches.id ORDER BY claimed_matches.matched_at),
    COUNT(claimed_matches.id)::INTEGER,
    JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'id', claimed_matches.id,
        'title', claimed_matches.result_title,
        'location', claimed_matches.result_location,
        'path', claimed_matches.result_path,
        'matched_at', claimed_matches.matched_at
      )
      ORDER BY claimed_matches.matched_at
    )
  FROM due_searches
  JOIN claimed_matches
    ON claimed_matches.saved_search_id = due_searches.id
  GROUP BY
    due_searches.id,
    due_searches.user_id,
    due_searches.name,
    due_searches.result_path;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_saved_search_email_delivery(
  p_saved_search_id UUID,
  p_match_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  completed_at TIMESTAMPTZ := NOW();
BEGIN
  UPDATE public.saved_search_matches
  SET
    email_status = 'sent',
    email_sent_at = completed_at,
    email_processing_at = NULL,
    email_error = NULL
  WHERE saved_search_id = p_saved_search_id
    AND id = ANY(p_match_ids)
    AND email_status = 'processing';

  UPDATE public.saved_searches
  SET
    last_email_attempt_at = completed_at,
    last_email_notified_at = completed_at,
    updated_at = completed_at
  WHERE id = p_saved_search_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.retry_saved_search_email_delivery(
  p_saved_search_id UUID,
  p_match_ids UUID[],
  p_error TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.saved_search_matches
  SET
    email_status = CASE WHEN email_attempts >= 5 THEN 'failed' ELSE 'retry' END,
    email_due_at = CASE
      WHEN email_attempts >= 5 THEN email_due_at
      ELSE NOW() + MAKE_INTERVAL(mins => LEAST(email_attempts * 5, 60))
    END,
    email_processing_at = NULL,
    email_error = LEFT(COALESCE(p_error, 'unknown_error'), 1000)
  WHERE saved_search_id = p_saved_search_id
    AND id = ANY(p_match_ids)
    AND email_status = 'processing';

  UPDATE public.saved_searches
  SET
    last_email_attempt_at = NOW(),
    updated_at = NOW()
  WHERE id = p_saved_search_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_saved_search_email_deliveries(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_saved_search_email_delivery(UUID, UUID[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.retry_saved_search_email_delivery(UUID, UUID[], TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_saved_search_email_deliveries(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_saved_search_email_delivery(UUID, UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.retry_saved_search_email_delivery(UUID, UUID[], TEXT) TO service_role;

-- Resumen interno para medir si las alertas generan aperturas. Se consulta
-- desde SQL Editor o con service_role; no se expone a usuarios normales.
CREATE OR REPLACE VIEW public.saved_search_alert_metrics
WITH (security_invoker = FALSE)
AS
SELECT
  COUNT(DISTINCT search_row.id) AS saved_searches,
  COUNT(DISTINCT search_row.user_id) AS users_with_saved_searches,
  COUNT(match_row.id) AS matched_results,
  COUNT(match_row.push_sent_at) AS pushes_sent,
  COUNT(match_row.opened_at) AS opened_results,
  ROUND(
    100.0
      * COUNT(match_row.id) FILTER (
          WHERE match_row.opened_at IS NOT NULL
            AND match_row.push_sent_at IS NOT NULL
        )
      / NULLIF(COUNT(match_row.push_sent_at), 0),
    1
  ) AS push_open_rate_percent,
  COUNT(match_row.email_sent_at) AS emails_sent,
  ROUND(
    100.0
      * COUNT(match_row.opened_at)
      / NULLIF(
          COUNT(match_row.id) FILTER (
            WHERE match_row.push_sent_at IS NOT NULL
              OR match_row.email_sent_at IS NOT NULL
          ),
          0
        ),
    1
  ) AS delivered_open_rate_percent
FROM public.saved_searches AS search_row
LEFT JOIN public.saved_search_matches AS match_row
  ON match_row.saved_search_id = search_row.id;

REVOKE ALL ON public.saved_search_alert_metrics FROM anon, authenticated;

-- Para comprobar:
-- SELECT * FROM public.saved_search_alert_metrics;
-- SELECT * FROM public.saved_searches ORDER BY created_at DESC;
-- SELECT * FROM public.saved_search_matches ORDER BY matched_at DESC;
