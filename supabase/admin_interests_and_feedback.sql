-- =====================================================================
-- LATIDO.CH - Admin: intereses, valoraciones y resultados de búsqueda
-- Ejecutar una vez en Supabase SQL Editor en proyectos existentes.
-- Requiere public.is_business_promotion_admin().
-- =====================================================================

BEGIN;

GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.latido_ratings TO authenticated;
GRANT SELECT ON public.search_resolution_feedback TO authenticated;

DROP POLICY IF EXISTS "profiles_select_admin_feedback"
  ON public.profiles;
CREATE POLICY "profiles_select_admin_feedback"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_business_promotion_admin());

DROP POLICY IF EXISTS "latido_ratings_select_own"
  ON public.latido_ratings;
DROP POLICY IF EXISTS "latido_ratings_select_own_or_admin"
  ON public.latido_ratings;
CREATE POLICY "latido_ratings_select_own_or_admin"
  ON public.latido_ratings
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_business_promotion_admin()
  );

DROP POLICY IF EXISTS "search_resolution_feedback_select_admin"
  ON public.search_resolution_feedback;
CREATE POLICY "search_resolution_feedback_select_admin"
  ON public.search_resolution_feedback
  FOR SELECT
  TO authenticated
  USING (public.is_business_promotion_admin());

NOTIFY pgrst, 'reload schema';

COMMIT;
