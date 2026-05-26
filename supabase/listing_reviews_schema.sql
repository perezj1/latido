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
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.listing_reviews
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

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
  USING (user_id = auth.uid() AND active = TRUE)
  WITH CHECK (user_id = auth.uid() AND active = TRUE);

DROP POLICY IF EXISTS "listing_reviews_delete_own" ON public.listing_reviews;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY listing_id, user_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.listing_reviews
  WHERE user_id IS NOT NULL
    AND active = TRUE
)
UPDATE public.listing_reviews review
SET active = FALSE
FROM ranked
WHERE review.id = ranked.id
  AND ranked.rn > 1;

CREATE INDEX IF NOT EXISTS idx_listing_reviews_listing ON public.listing_reviews(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_reviews_created_at ON public.listing_reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_reviews_active ON public.listing_reviews(active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_listing_reviews_one_active_per_user
  ON public.listing_reviews(listing_id, user_id)
  WHERE user_id IS NOT NULL
    AND active = TRUE;

-- ================================================================
-- Reseñas para negocios/proveedores: una reseña activa por usuario.
-- ================================================================

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_insert" ON public.reviews;
CREATE POLICY "reviews_insert"
  ON public.reviews
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.providers
      WHERE id = provider_id
        AND active = TRUE
    )
  );

DROP POLICY IF EXISTS "reviews_update_own" ON public.reviews;
CREATE POLICY "reviews_update_own"
  ON public.reviews
  FOR UPDATE
  USING (user_id = auth.uid() AND active = TRUE)
  WITH CHECK (user_id = auth.uid() AND active = TRUE);

DROP POLICY IF EXISTS "reviews_delete_own" ON public.reviews;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY provider_id, user_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.reviews
  WHERE user_id IS NOT NULL
    AND active = TRUE
)
UPDATE public.reviews review
SET active = FALSE
FROM ranked
WHERE review.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_one_active_per_user_provider
  ON public.reviews(provider_id, user_id)
  WHERE user_id IS NOT NULL
    AND active = TRUE;
