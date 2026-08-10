-- Adds share counts to creator content metrics in existing installations.
-- Safe to run more than once in the Supabase SQL editor.

ALTER TABLE public.creator_metrics
  DROP CONSTRAINT IF EXISTS creator_metrics_metric_check;

ALTER TABLE public.creator_metrics
  ADD CONSTRAINT creator_metrics_metric_check
  CHECK (metric IN ('profile_view', 'content_click', 'content_impression', 'content_share', 'social_click'));

CREATE OR REPLACE FUNCTION public.increment_creator_metric(
  p_creator_id TEXT,
  p_metric TEXT,
  p_content_id TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_metric NOT IN ('profile_view', 'content_click', 'content_impression', 'content_share', 'social_click') THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.creator_profiles WHERE id = p_creator_id AND active AND status = 'published') THEN
    RETURN;
  END IF;
  IF p_metric IN ('content_click', 'content_impression', 'content_share') AND NOT EXISTS (
    SELECT 1
    FROM public.creator_contents
    WHERE id = COALESCE(p_content_id, '')
      AND creator_id = p_creator_id
      AND active
      AND status = 'published'
  ) THEN
    RETURN;
  END IF;
  IF p_metric = 'social_click' AND COALESCE(p_content_id, '') NOT IN ('youtube', 'instagram', 'facebook', 'tiktok', 'linkedin', 'spotify', 'web') THEN
    RETURN;
  END IF;

  INSERT INTO public.creator_metrics (creator_id, metric, content_id, count)
  VALUES (p_creator_id, p_metric, COALESCE(p_content_id, ''), 1)
  ON CONFLICT (creator_id, metric, content_id)
  DO UPDATE SET count = public.creator_metrics.count + 1, updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.increment_creator_metric(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_creator_metric(TEXT, TEXT, TEXT) TO anon, authenticated;
