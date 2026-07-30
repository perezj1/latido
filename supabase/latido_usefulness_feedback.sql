-- Run once in the Supabase SQL editor.
-- Extends the existing latido_ratings table for the usefulness banner.

BEGIN;

ALTER TABLE public.latido_ratings
  ALTER COLUMN overall_rating DROP NOT NULL,
  ALTER COLUMN usefulness_rating DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS usefulness_answer TEXT,
  ADD COLUMN IF NOT EXISTS usefulness_detail TEXT,
  ADD COLUMN IF NOT EXISTS usefulness_comment TEXT,
  ADD COLUMN IF NOT EXISTS usefulness_answered_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.latido_ratings'::regclass
      AND conname = 'latido_ratings_usefulness_answer_check'
  ) THEN
    ALTER TABLE public.latido_ratings
      ADD CONSTRAINT latido_ratings_usefulness_answer_check
      CHECK (
        usefulness_answer IS NULL
        OR usefulness_answer IN ('yes', 'partial', 'no')
      );
  END IF;

  ALTER TABLE public.latido_ratings
    DROP CONSTRAINT IF EXISTS latido_ratings_usefulness_detail_check;
  ALTER TABLE public.latido_ratings
    ADD CONSTRAINT latido_ratings_usefulness_detail_check
    CHECK (
      usefulness_detail IS NULL
      OR usefulness_detail IN (
        'jobs',
        'housing',
        'businesses',
        'events',
        'community',
        'found_what_needed',
        'contacted_someone',
        'discovered_nearby',
        'published_got_responses',
        'found_useful_information',
        'connected_with_community',
        'more_offers',
        'clearer_information',
        'more_relevant_results',
        'more_nearby_content',
        'better_filters',
        'new_content_alerts',
        'cannot_find',
        'few_offers',
        'irrelevant_content',
        'unclear_how_it_works',
        'not_used_enough',
        'other'
      )
    );

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.latido_ratings'::regclass
      AND conname = 'latido_ratings_usefulness_comment_check'
  ) THEN
    ALTER TABLE public.latido_ratings
      ADD CONSTRAINT latido_ratings_usefulness_comment_check
      CHECK (
        usefulness_comment IS NULL
        OR char_length(usefulness_comment) <= 150
      );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_latido_ratings_usefulness_answer
  ON public.latido_ratings (usefulness_answer, usefulness_answered_at DESC);

COMMENT ON COLUMN public.latido_ratings.usefulness_answer
  IS 'Banner answer: yes, partial or no.';
COMMENT ON COLUMN public.latido_ratings.usefulness_detail
  IS 'Selected follow-up option for the usefulness answer.';
COMMENT ON COLUMN public.latido_ratings.usefulness_comment
  IS 'Optional free-text response, limited to 150 characters.';
COMMENT ON COLUMN public.latido_ratings.usefulness_answered_at
  IS 'When the usefulness banner response was last saved.';

NOTIFY pgrst, 'reload schema';

COMMIT;
