-- Totales públicos y anónimos de utilidad reciente por contenido.
-- No expone actores ni interacciones individuales: solo devuelve el agregado
-- necesario para ordenar "Contenido más útil este mes" en la app.

CREATE INDEX IF NOT EXISTS creator_interactions_recent_content_helpful_idx
  ON public.creator_interactions (created_at DESC, target_id)
  WHERE action = 'helpful' AND target_type = 'content';

CREATE OR REPLACE FUNCTION public.get_recent_creator_content_helpful_counts(
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  content_id TEXT,
  recent_helpful_count BIGINT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    interaction.target_id AS content_id,
    COUNT(*)::BIGINT AS recent_helpful_count
  FROM public.creator_interactions AS interaction
  INNER JOIN public.creator_contents AS content
    ON content.id = interaction.target_id
  INNER JOIN public.creator_profiles AS creator
    ON creator.id = content.creator_id
  WHERE interaction.action = 'helpful'
    AND interaction.target_type = 'content'
    AND interaction.created_at >= NOW() - make_interval(
      days => LEAST(GREATEST(COALESCE(p_days, 30), 1), 90)
    )
    AND content.active = TRUE
    AND content.status = 'published'
    AND creator.active = TRUE
    AND creator.status = 'published'
  GROUP BY interaction.target_id;
$$;

REVOKE ALL ON FUNCTION public.get_recent_creator_content_helpful_counts(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_recent_creator_content_helpful_counts(INTEGER) TO anon, authenticated;
