-- =====================================================================
-- LATIDO.CH - Search resolution feedback and Latido app ratings
-- Run once in the Supabase SQL Editor.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.search_resolution_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_attempt_id UUID NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  query TEXT NOT NULL CHECK (char_length(query) BETWEEN 2 AND 120),
  result_id TEXT,
  result_type TEXT,
  result_label TEXT,
  answer TEXT NOT NULL CHECK (answer IN ('yes', 'partial', 'no')),
  reason TEXT CHECK (
    reason IS NULL OR reason IN (
      'more_information',
      'different_location',
      'clearer_price',
      'more_options',
      'other'
    )
  ),
  had_solution_action BOOLEAN NOT NULL DEFAULT FALSE,
  solution_action TEXT,
  time_to_feedback_ms BIGINT CHECK (
    time_to_feedback_ms IS NULL
    OR time_to_feedback_ms BETWEEN 0 AND 604800000
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_resolution_feedback_created_at
  ON public.search_resolution_feedback (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_search_resolution_feedback_answer_created_at
  ON public.search_resolution_feedback (answer, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_search_resolution_feedback_user_created_at
  ON public.search_resolution_feedback (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.search_resolution_feedback ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.search_resolution_feedback FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.latido_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  overall_rating SMALLINT NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  usefulness_rating SMALLINT NOT NULL CHECK (usefulness_rating BETWEEN 1 AND 5),
  comment TEXT CHECK (comment IS NULL OR char_length(comment) <= 2000),
  account_created_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_latido_ratings_created_at
  ON public.latido_ratings (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_latido_ratings_overall
  ON public.latido_ratings (overall_rating, created_at DESC);

ALTER TABLE public.latido_ratings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.latido_ratings FROM PUBLIC, anon;
REVOKE ALL ON public.latido_ratings FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.latido_ratings TO authenticated;

DROP POLICY IF EXISTS "latido_ratings_select_own_or_admin"
  ON public.latido_ratings;
DROP POLICY IF EXISTS "latido_ratings_select_own"
  ON public.latido_ratings;
CREATE POLICY "latido_ratings_select_own"
  ON public.latido_ratings
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "latido_ratings_insert_own"
  ON public.latido_ratings;
CREATE POLICY "latido_ratings_insert_own"
  ON public.latido_ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "latido_ratings_update_own"
  ON public.latido_ratings;
CREATE POLICY "latido_ratings_update_own"
  ON public.latido_ratings
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.set_latido_feedback_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_search_resolution_feedback_updated_at
  ON public.search_resolution_feedback;
CREATE TRIGGER set_search_resolution_feedback_updated_at
  BEFORE UPDATE ON public.search_resolution_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.set_latido_feedback_updated_at();

DROP TRIGGER IF EXISTS set_latido_ratings_updated_at
  ON public.latido_ratings;
CREATE TRIGGER set_latido_ratings_updated_at
  BEFORE UPDATE ON public.latido_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_latido_feedback_updated_at();

CREATE OR REPLACE FUNCTION public.submit_search_resolution_feedback(
  p_search_attempt_id UUID,
  p_query TEXT,
  p_answer TEXT,
  p_result_id TEXT DEFAULT NULL,
  p_result_type TEXT DEFAULT NULL,
  p_result_label TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_had_solution_action BOOLEAN DEFAULT FALSE,
  p_solution_action TEXT DEFAULT NULL,
  p_time_to_feedback_ms BIGINT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  feedback_id UUID;
  clean_query TEXT := left(trim(COALESCE(p_query, '')), 120);
  clean_answer TEXT := lower(trim(COALESCE(p_answer, '')));
  clean_reason TEXT := nullif(lower(trim(COALESCE(p_reason, ''))), '');
BEGIN
  IF p_search_attempt_id IS NULL THEN
    RAISE EXCEPTION 'SEARCH_ATTEMPT_REQUIRED';
  END IF;

  IF char_length(clean_query) < 2 THEN
    RAISE EXCEPTION 'QUERY_REQUIRED';
  END IF;

  IF clean_answer NOT IN ('yes', 'partial', 'no') THEN
    RAISE EXCEPTION 'INVALID_ANSWER';
  END IF;

  IF clean_reason IS NOT NULL AND clean_reason NOT IN (
    'more_information',
    'different_location',
    'clearer_price',
    'more_options',
    'other'
  ) THEN
    RAISE EXCEPTION 'INVALID_REASON';
  END IF;

  INSERT INTO public.search_resolution_feedback (
    search_attempt_id,
    user_id,
    query,
    result_id,
    result_type,
    result_label,
    answer,
    reason,
    had_solution_action,
    solution_action,
    time_to_feedback_ms
  )
  VALUES (
    p_search_attempt_id,
    auth.uid(),
    clean_query,
    nullif(left(trim(COALESCE(p_result_id, '')), 160), ''),
    nullif(left(trim(COALESCE(p_result_type, '')), 80), ''),
    nullif(left(trim(COALESCE(p_result_label, '')), 160), ''),
    clean_answer,
    clean_reason,
    COALESCE(p_had_solution_action, FALSE),
    nullif(left(trim(COALESCE(p_solution_action, '')), 80), ''),
    CASE
      WHEN p_time_to_feedback_ms BETWEEN 0 AND 604800000
        THEN p_time_to_feedback_ms
      ELSE NULL
    END
  )
  ON CONFLICT (search_attempt_id)
  DO UPDATE SET
    user_id = COALESCE(
      public.search_resolution_feedback.user_id,
      EXCLUDED.user_id
    ),
    answer = EXCLUDED.answer,
    reason = COALESCE(
      EXCLUDED.reason,
      public.search_resolution_feedback.reason
    ),
    had_solution_action = EXCLUDED.had_solution_action,
    solution_action = EXCLUDED.solution_action,
    time_to_feedback_ms = EXCLUDED.time_to_feedback_ms
  RETURNING id INTO feedback_id;

  RETURN feedback_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_search_resolution_feedback(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  BOOLEAN,
  TEXT,
  BIGINT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_search_resolution_feedback(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  BOOLEAN,
  TEXT,
  BIGINT
) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
