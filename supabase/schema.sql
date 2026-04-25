-- ================================================================
-- LATIDO.CH — Supabase SQL Schema v3
-- Para instalaciones nuevas: ejecuta este archivo primero.
-- Para proyectos existentes: ejecuta despues supabase/publications_schema_v4.sql.
-- ================================================================

-- ── 1. PROFILES (extends Supabase Auth) ────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT,
  email      TEXT,
  canton     TEXT,
  languages  TEXT[],
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE VIEW public.profile_names AS
SELECT id, name
FROM public.profiles
WHERE COALESCE(name, '') <> '';

GRANT SELECT ON public.profile_names TO anon, authenticated;

CREATE OR REPLACE VIEW public.profile_public AS
SELECT id, name, avatar_url
FROM public.profiles;

GRANT SELECT ON public.profile_public TO anon, authenticated;

-- ── 2. ADS (tablón de anuncios) ────────────────────────────────
CREATE TABLE IF NOT EXISTS ads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  user_name   TEXT,                    -- cached display name
  cat         TEXT NOT NULL,           -- vivienda|hogar|cuidados|documentos|venta|servicios|regalo
  sub         TEXT,                    -- subcategoría
  type        TEXT NOT NULL,           -- busca|ofrece|vende|regala
  title       TEXT NOT NULL,
  "desc"      TEXT,
  price       TEXT,
  price_amount NUMERIC,
  price_unit  TEXT,
  canton      TEXT,                    -- code: ZH, BE, GE...
  plz         TEXT,                    -- código postal 4 dígitos
  privacy     TEXT DEFAULT 'public',   -- 'public' | 'private'
  img_url     TEXT,
  photo_urls  JSONB DEFAULT '[]'::jsonb,
  whatsapp    TEXT,                    -- solo visible si public o usuario autenticado
  email_contact TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  contact_via_app BOOLEAN DEFAULT TRUE,
  verified    BOOLEAN DEFAULT FALSE,
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. CONTACT REVEALS (private ads unlocked per user) ──────────
CREATE TABLE IF NOT EXISTS contact_reveals (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  ad_id      UUID REFERENCES ads(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, ad_id)
);

-- ── 4. COMMUNITIES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS communities (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  cat        TEXT,
  city       TEXT,
  emoji      TEXT,
  "desc"     TEXT,
  members    INTEGER DEFAULT 0,
  contact    TEXT,
  verified   BOOLEAN DEFAULT FALSE,
  active     BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. PROVIDERS (directorio de eventos) ───────────────────────
CREATE TABLE IF NOT EXISTS providers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,
  city        TEXT,
  canton      TEXT,
  description TEXT,
  services    TEXT[],
  price_range TEXT,
  whatsapp    TEXT,
  instagram   TEXT,
  email       TEXT,
  website     TEXT,
  photo_url   TEXT,
  languages   TEXT[],
  verified    BOOLEAN DEFAULT FALSE,
  featured    BOOLEAN DEFAULT FALSE,
  active      BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. FORUM POSTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS forum_posts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  author     TEXT,
  category   TEXT,
  title      TEXT NOT NULL,
  body       TEXT,
  solved     BOOLEAN DEFAULT FALSE,
  replies    INTEGER DEFAULT 0,
  views      INTEGER DEFAULT 0,
  active     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7. JOBS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sector     TEXT,
  title      TEXT NOT NULL,
  company    TEXT,
  city       TEXT,
  canton     TEXT,
  type       TEXT,
  salary     TEXT,
  salary_amount NUMERIC,
  salary_unit TEXT,
  lang       TEXT,
  category   TEXT,
  emoji      TEXT,
  "desc"     TEXT,
  contact    TEXT,
  contact_via_app BOOLEAN DEFAULT TRUE,
  contact_phone TEXT,
  contact_email TEXT,
  contact_link TEXT,
  logo_url   TEXT,
  languages  TEXT[],
  active     BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 8. ROW LEVEL SECURITY ──────────────────────────────────────
ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads            ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_reveals ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_posts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs           ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/write their own
DROP POLICY IF EXISTS "profile_select_own" ON profiles;
DROP POLICY IF EXISTS "profile_insert_own" ON profiles;
DROP POLICY IF EXISTS "profile_update_own" ON profiles;
CREATE POLICY "profile_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profile_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profile_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Ads: public ads readable by all; private contact visible only to auth users
DROP POLICY IF EXISTS "ads_select_public" ON ads;
DROP POLICY IF EXISTS "ads_insert_auth" ON ads;
DROP POLICY IF EXISTS "ads_update_own" ON ads;
DROP POLICY IF EXISTS "ads_delete_own" ON ads;
CREATE POLICY "ads_select_public" ON ads FOR SELECT USING (active = TRUE);
CREATE POLICY "ads_insert_auth"   ON ads FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "ads_update_own"    ON ads FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "ads_delete_own"    ON ads FOR DELETE USING (user_id = auth.uid());

-- Contact reveals
DROP POLICY IF EXISTS "reveals_select_own" ON contact_reveals;
DROP POLICY IF EXISTS "reveals_insert_auth" ON contact_reveals;
CREATE POLICY "reveals_select_own" ON contact_reveals FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "reveals_insert_auth" ON contact_reveals FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Communities, providers, jobs, forum: public read, auth insert
DROP POLICY IF EXISTS "communities_read" ON communities;
DROP POLICY IF EXISTS "communities_insert" ON communities;
DROP POLICY IF EXISTS "providers_read" ON providers;
DROP POLICY IF EXISTS "providers_insert" ON providers;
DROP POLICY IF EXISTS "forum_read" ON forum_posts;
DROP POLICY IF EXISTS "forum_insert" ON forum_posts;
DROP POLICY IF EXISTS "jobs_read" ON jobs;
DROP POLICY IF EXISTS "jobs_insert" ON jobs;
CREATE POLICY "communities_read"   ON communities  FOR SELECT USING (active = TRUE);
CREATE POLICY "communities_insert" ON communities  FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "providers_read"     ON providers    FOR SELECT USING (active = TRUE);
CREATE POLICY "providers_insert"   ON providers    FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "forum_read"         ON forum_posts  FOR SELECT USING (active = TRUE);
CREATE POLICY "forum_insert"       ON forum_posts  FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "jobs_read"          ON jobs         FOR SELECT USING (active = TRUE);
CREATE POLICY "jobs_insert"        ON jobs         FOR INSERT WITH CHECK (TRUE);

-- ── 9. INDEXES ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ads_cat      ON ads(cat);
CREATE INDEX IF NOT EXISTS idx_ads_canton   ON ads(canton);
CREATE INDEX IF NOT EXISTS idx_ads_plz      ON ads(plz);
CREATE INDEX IF NOT EXISTS idx_ads_type     ON ads(type);
CREATE INDEX IF NOT EXISTS idx_ads_privacy  ON ads(privacy);
CREATE INDEX IF NOT EXISTS idx_ads_active   ON ads(active);
CREATE INDEX IF NOT EXISTS idx_ads_user     ON ads(user_id);
CREATE INDEX IF NOT EXISTS idx_prov_cat     ON providers(category);
CREATE INDEX IF NOT EXISTS idx_prov_feat    ON providers(featured);
CREATE INDEX IF NOT EXISTS idx_comm_cat     ON communities(cat);
CREATE INDEX IF NOT EXISTS idx_posts_cat    ON forum_posts(category);

-- ── 10. AUTO-PROFILE ON SIGNUP ─────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, canton)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    NEW.email,
    NEW.raw_user_meta_data->>'canton'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block signup even if profile insert fails
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── 11. SAMPLE DATA ────────────────────────────────────────────
INSERT INTO communities (name,cat,city,emoji,"desc",members,contact,verified,active)
SELECT 'Colombianos en Zürich','pais','Zürich','🇨🇴','La comunidad más grande de colombianos en Suiza.',342,'https://chat.whatsapp.com/ejemplo',TRUE,TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM communities WHERE name = 'Colombianos en Zürich' AND city = 'Zürich'
);

INSERT INTO communities (name,cat,city,emoji,"desc",members,contact,verified,active)
SELECT 'Mamás Latinas Suiza','mamas','Toda Suiza','👩‍👧','Red de madres latinoamericanas. Crianza y apoyo mutuo.',891,'https://t.me/mamaslatinasch',TRUE,TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM communities WHERE name = 'Mamás Latinas Suiza' AND city = 'Toda Suiza'
);

INSERT INTO communities (name,cat,city,emoji,"desc",members,contact,verified,active)
SELECT 'Venezolanos en Suiza','pais','Toda Suiza','🇻🇪','Comunidad venezolana unida. Asesoría, trabajo y vivienda.',523,'https://t.me/venezusuiza',TRUE,TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM communities WHERE name = 'Venezolanos en Suiza' AND city = 'Toda Suiza'
);

INSERT INTO providers (name,category,city,description,services,price_range,whatsapp,instagram,email,website,photo_url,verified,featured,active)
SELECT 'DJ Sebastián Vega','dj','Zürich','DJ especializado en salsa, reggaetón y cumbia. 10 años en Suiza.',ARRAY['Salsa','Reggaetón','Cumbia'],'medio','+41791234567','@djsebastianvega','hola@djsebastianvega.ch','djsebastianvega.ch','https://images.unsplash.com/photo-1571266028243-3716f02d2d50?w=400&h=300&fit=crop',TRUE,TRUE,TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM providers WHERE name = 'DJ Sebastián Vega' AND category = 'dj' AND city = 'Zürich'
);

INSERT INTO providers (name,category,city,description,services,price_range,whatsapp,instagram,email,website,photo_url,verified,featured,active)
SELECT 'Sabor Latino Catering','catering','Zürich','Cocina latinoamericana auténtica. Ceviche, tamales, lechón.',ARRAY['Colombiana','Peruana','Mexicana'],'medio','+41791122334','@saborlatino_ch','hola@saborlatinocatering.ch','saborlatinocatering.ch','https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&h=300&fit=crop',TRUE,TRUE,TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM providers WHERE name = 'Sabor Latino Catering' AND category = 'catering' AND city = 'Zürich'
);

-- ── CONSULTAS ADMIN ─────────────────────────────────────────────
-- Aprobar proveedor:  UPDATE providers SET active=TRUE, verified=TRUE WHERE id='UUID';
-- Aprobar comunidad:  UPDATE communities SET active=TRUE WHERE id='UUID';
-- Ver anuncios hoy:   SELECT id,title,cat,privacy,canton,created_at FROM ads ORDER BY created_at DESC LIMIT 20;
-- Ver registros hoy:  SELECT id,name,email,created_at FROM profiles ORDER BY created_at DESC;

-- ── REVIEWS (para providers del directorio) ─────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id  UUID REFERENCES providers(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  author_name  TEXT NOT NULL,           -- display name (puede ser anon)
  canton       TEXT,
  stars        SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  text         TEXT NOT NULL,
  verified     BOOLEAN DEFAULT FALSE,   -- el admin puede verificar reseñas reales
  active       BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── PROVIDER PHOTOS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS provider_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  caption     TEXT,
  is_main     BOOLEAN DEFAULT FALSE,
  sort_order  SMALLINT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE reviews         ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_photos ENABLE ROW LEVEL SECURITY;

-- Anyone can read reviews/photos of active providers
DROP POLICY IF EXISTS "reviews_read" ON reviews;
DROP POLICY IF EXISTS "reviews_insert" ON reviews;
DROP POLICY IF EXISTS "photos_read" ON provider_photos;
DROP POLICY IF EXISTS "photos_insert_own" ON provider_photos;
CREATE POLICY "reviews_read"      ON reviews         FOR SELECT USING (active = TRUE);
CREATE POLICY "reviews_insert"    ON reviews         FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "photos_read"       ON provider_photos FOR SELECT USING (TRUE);
CREATE POLICY "photos_insert_own" ON provider_photos FOR INSERT WITH CHECK (TRUE);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reviews_provider ON reviews(provider_id);
CREATE INDEX IF NOT EXISTS idx_photos_provider  ON provider_photos(provider_id, sort_order);

-- Helper: computed avg rating (view)
CREATE OR REPLACE VIEW provider_ratings AS
  SELECT provider_id,
         ROUND(AVG(stars)::numeric, 1) AS avg_rating,
         COUNT(*) AS review_count
  FROM reviews
  WHERE active = TRUE
  GROUP BY provider_id;

-- ── ADMIN: moderar reseñas ────────────────────────────────────
-- Ver reseñas pendientes:
-- SELECT r.*, p.name FROM reviews r JOIN providers p ON r.provider_id=p.id ORDER BY r.created_at DESC;
-- Verificar reseña real:  UPDATE reviews SET verified=TRUE WHERE id='UUID';
-- Eliminar reseña spam:   UPDATE reviews SET active=FALSE WHERE id='UUID';
-- Ver rating por proveedor: SELECT * FROM provider_ratings ORDER BY avg_rating DESC;

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
