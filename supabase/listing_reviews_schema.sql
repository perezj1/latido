-- ================================================================
-- LATIDO.CH - Reseñas para anuncios de servicios y cuidados
-- Ejecuta este archivo en Supabase SQL Editor.
-- ================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.listing_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  canton      TEXT,
  stars       SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  text        TEXT NOT NULL,
  verified    BOOLEAN DEFAULT FALSE,
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.listing_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listing_reviews_read" ON public.listing_reviews;
CREATE POLICY "listing_reviews_read"
  ON public.listing_reviews
  FOR SELECT
  USING (active = TRUE);

DROP POLICY IF EXISTS "listing_reviews_insert_auth" ON public.listing_reviews;
CREATE POLICY "listing_reviews_insert_auth"
  ON public.listing_reviews
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.listings
      WHERE id = listing_id
        AND active = TRUE
        AND cat IN ('servicios', 'cuidados')
    )
  );

DROP POLICY IF EXISTS "listing_reviews_update_own" ON public.listing_reviews;
CREATE POLICY "listing_reviews_update_own"
  ON public.listing_reviews
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "listing_reviews_delete_own" ON public.listing_reviews;
CREATE POLICY "listing_reviews_delete_own"
  ON public.listing_reviews
  FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_listing_reviews_listing ON public.listing_reviews(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_reviews_created_at ON public.listing_reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_reviews_active ON public.listing_reviews(active);
