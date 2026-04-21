-- ================================================================
-- LATIDO.CH - Publications schema patch v4
-- Ejecuta este archivo en Supabase SQL Editor.
-- Es seguro sobre un proyecto que ya tenga schema.sql v3.
-- ================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE OR REPLACE VIEW public.profile_names AS
SELECT id, name
FROM public.profiles
WHERE COALESCE(name, '') <> '';

GRANT SELECT ON public.profile_names TO anon, authenticated;

CREATE OR REPLACE VIEW public.profile_public AS
SELECT id, name, avatar_url
FROM public.profiles;

GRANT SELECT ON public.profile_public TO anon, authenticated;

-- ================================================================
-- OWNERSHIP PATCH FOR COMMUNITIES / PROVIDERS
-- ================================================================
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS instagram TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ================================================================
-- ADS PATCH
-- Alinea la tabla ads con Publicar + Perfil
-- ================================================================
ALTER TABLE public.ads
  ADD COLUMN IF NOT EXISTS price_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS price_unit TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_via_app BOOLEAN DEFAULT TRUE;

-- ================================================================
-- EVENTS
-- ================================================================
CREATE TABLE IF NOT EXISTS public.events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type       TEXT,
  title      TEXT NOT NULL,
  day        TEXT,
  month      TEXT,
  year       TEXT,
  time       TEXT,
  price      TEXT,
  city       TEXT,
  canton     TEXT,
  venue      TEXT,
  "desc"     TEXT,
  host       TEXT,
  link       TEXT,
  emoji      TEXT,
  img_url    TEXT,
  featured   BOOLEAN DEFAULT FALSE,
  active     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events_read" ON public.events;
CREATE POLICY "events_read"
  ON public.events
  FOR SELECT
  USING (active = TRUE);

DROP POLICY IF EXISTS "events_insert" ON public.events;
CREATE POLICY "events_insert"
  ON public.events
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "events_update_own" ON public.events;
CREATE POLICY "events_update_own"
  ON public.events
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "events_delete_own" ON public.events;
CREATE POLICY "events_delete_own"
  ON public.events
  FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_events_active       ON public.events(active);
CREATE INDEX IF NOT EXISTS idx_events_type         ON public.events(type);
CREATE INDEX IF NOT EXISTS idx_events_canton       ON public.events(canton);
CREATE INDEX IF NOT EXISTS idx_events_featured     ON public.events(featured);
CREATE INDEX IF NOT EXISTS idx_events_created_at   ON public.events(created_at DESC);

-- ================================================================
-- JOBS PATCH
-- Alinea la tabla jobs con PublicarEmpleo + Tablon
-- ================================================================
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sector TEXT,
  ADD COLUMN IF NOT EXISTS salary_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS salary_unit TEXT,
  ADD COLUMN IF NOT EXISTS languages TEXT[],
  ADD COLUMN IF NOT EXISTS contact_via_app BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_link TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP POLICY IF EXISTS "jobs_insert" ON public.jobs;
CREATE POLICY "jobs_insert"
  ON public.jobs
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "jobs_update_own" ON public.jobs;
CREATE POLICY "jobs_update_own"
  ON public.jobs
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "jobs_delete_own" ON public.jobs;
CREATE POLICY "jobs_delete_own"
  ON public.jobs
  FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_jobs_active        ON public.jobs(active);
CREATE INDEX IF NOT EXISTS idx_jobs_type          ON public.jobs(type);
CREATE INDEX IF NOT EXISTS idx_jobs_canton        ON public.jobs(canton);
CREATE INDEX IF NOT EXISTS idx_jobs_sector        ON public.jobs(sector);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at    ON public.jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_user          ON public.jobs(user_id);

-- ================================================================
-- OPTIONAL HARDENING
-- Requiere sesión para insertar comunidades y negocios.
-- ================================================================
DROP POLICY IF EXISTS "communities_insert" ON public.communities;
CREATE POLICY "communities_insert"
  ON public.communities
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "communities_update_own" ON public.communities;
CREATE POLICY "communities_update_own"
  ON public.communities
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "communities_delete_own" ON public.communities;
CREATE POLICY "communities_delete_own"
  ON public.communities
  FOR DELETE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "providers_insert" ON public.providers;
CREATE POLICY "providers_insert"
  ON public.providers
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "providers_update_own" ON public.providers;
CREATE POLICY "providers_update_own"
  ON public.providers
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "providers_delete_own" ON public.providers;
CREATE POLICY "providers_delete_own"
  ON public.providers
  FOR DELETE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "reviews_insert" ON public.reviews;
CREATE POLICY "reviews_insert"
  ON public.reviews
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "photos_insert_own" ON public.provider_photos;
CREATE POLICY "photos_insert_own"
  ON public.provider_photos
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ================================================================
-- SAMPLE EVENTS
-- ================================================================
INSERT INTO public.events (type, title, day, month, year, time, price, city, canton, venue, "desc", host, link, emoji, featured, active)
VALUES
  ('festival',  'Festival Latino de Primavera', '18', 'MAY', '2026', '14:00', 'Desde CHF 12', 'Zürich',  'ZH', 'Rote Fabrik', 'Comida, música en vivo, talleres y zona familiar para toda la comunidad.', 'Asociación Latina Zürich', 'https://latido.ch/eventos/festival-primavera', '🎪', TRUE, TRUE),
  ('quedada',   'Quedada de nuevos en Suiza',   '24', 'MAY', '2026', '17:30', 'Gratis',        'Berna',   'BE', 'Rosengarten Café', 'Encuentro informal para hacer contactos, resolver dudas y conocer gente latina en tu ciudad.', 'Latido Comunidad', 'https://latido.ch/eventos/quedada-berna', '🤝', FALSE, TRUE),
  ('concierto', 'Noche de salsa en Lausanne',   '31', 'MAY', '2026', '21:00', 'CHF 18',        'Lausana', 'VD', 'Le Romandie', 'Banda en vivo, DJ invitado y clases cortas antes del concierto para todos los niveles.', 'Salsa Vaud', 'https://latido.ch/eventos/salsa-lausanne', '🎵', TRUE, TRUE)
ON CONFLICT DO NOTHING;

-- ================================================================
-- STORAGE: PUBLICATION IMAGES
-- Bucket pÃºblico para anuncios, eventos y negocios
-- ================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'publication-images',
  'publication-images',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "publication_images_read" ON storage.objects;
CREATE POLICY "publication_images_read"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'publication-images');

DROP POLICY IF EXISTS "publication_images_insert_own" ON storage.objects;
CREATE POLICY "publication_images_insert_own"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'publication-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "publication_images_update_own" ON storage.objects;
CREATE POLICY "publication_images_update_own"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'publication-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'publication-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "publication_images_delete_own" ON storage.objects;
CREATE POLICY "publication_images_delete_own"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'publication-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ================================================================
-- STORAGE: AVATARS
-- Bucket público para fotos de perfil
-- ================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  TRUE,
  3145728,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "avatars_read" ON storage.objects;
CREATE POLICY "avatars_read"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
