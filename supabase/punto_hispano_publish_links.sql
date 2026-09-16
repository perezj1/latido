-- =====================================================================
-- LATIDO.CH - Enlaces compartibles para publicar como Punto Hispano
--
-- La URL contiene un UUID aleatorio que actua como credencial revocable.
-- El cliente nunca puede elegir el propietario del anuncio: esta funcion
-- siempre usa el propietario actual del negocio Punto Hispano.
-- Requiere business_promotion_plans.sql y publications_schema_v4.sql.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.punto_hispano_publish_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id   UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  created_by    UUID NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ,
  use_count     INTEGER NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT punto_hispano_publish_links_provider_check
    CHECK (provider_id = 'ee7fd475-acd3-4634-bd62-a921c6810fd4'::UUID)
);

CREATE TABLE IF NOT EXISTS public.punto_hispano_link_publications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id     UUID REFERENCES public.punto_hispano_publish_links(id) ON DELETE SET NULL,
  listing_id  UUID NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'listing',
  content_id  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.punto_hispano_link_publications
  ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'listing',
  ADD COLUMN IF NOT EXISTS content_id UUID;

UPDATE public.punto_hispano_link_publications
SET content_id = listing_id
WHERE content_id IS NULL;

CREATE INDEX IF NOT EXISTS punto_hispano_link_publications_link_date_idx
  ON public.punto_hispano_link_publications (link_id, created_at DESC);

ALTER TABLE public.punto_hispano_publish_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.punto_hispano_link_publications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.punto_hispano_publish_links FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.punto_hispano_link_publications FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_active_punto_hispano_publish_link(p_link_token TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.punto_hispano_publish_links AS link
    JOIN public.providers AS provider ON provider.id = link.provider_id
    WHERE link.id::TEXT = BTRIM(COALESCE(p_link_token, ''))
      AND link.active = TRUE
      AND provider.active = TRUE
      AND provider.user_id IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_punto_hispano_publish_link(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_punto_hispano_publish_link(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_punto_hispano_publish_link(p_link_token UUID)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_active_punto_hispano_publish_link(p_link_token::TEXT)
      THEN jsonb_build_object('valid', TRUE, 'publisher_name', 'Punto Hispano')
    ELSE jsonb_build_object('valid', FALSE)
  END;
$$;

REVOKE ALL ON FUNCTION public.get_punto_hispano_publish_link(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_punto_hispano_publish_link(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_punto_hispano_publish_link()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
  target_provider CONSTANT UUID := 'ee7fd475-acd3-4634-bd62-a921c6810fd4';
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_business_promotion_admin() THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.providers
    WHERE id = target_provider AND active = TRUE AND user_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'PUNTO_HISPANO_OWNER_REQUIRED';
  END IF;

  INSERT INTO public.punto_hispano_publish_links (provider_id, created_by)
  VALUES (target_provider, auth.uid())
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_punto_hispano_publish_link() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_punto_hispano_publish_link() TO authenticated;

CREATE OR REPLACE FUNCTION public.list_punto_hispano_publish_links()
RETURNS TABLE (
  link_id UUID,
  created_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  use_count INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_business_promotion_admin() THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;

  RETURN QUERY
  SELECT link.id, link.created_at, link.last_used_at, link.use_count
  FROM public.punto_hispano_publish_links AS link
  WHERE link.active = TRUE
    AND link.provider_id = 'ee7fd475-acd3-4634-bd62-a921c6810fd4'::UUID
  ORDER BY link.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_punto_hispano_publish_links() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_punto_hispano_publish_links() TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_punto_hispano_publish_link(p_link_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_business_promotion_admin() THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;

  DELETE FROM public.punto_hispano_publish_links
  WHERE id = p_link_id
    AND provider_id = 'ee7fd475-acd3-4634-bd62-a921c6810fd4'::UUID;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_punto_hispano_publish_link(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_punto_hispano_publish_link(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.publish_punto_hispano_listing(
  p_link_token UUID,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  publish_link public.punto_hispano_publish_links%ROWTYPE;
  business RECORD;
  new_listing_id UUID := gen_random_uuid();
  clean_cat TEXT := LOWER(BTRIM(COALESCE(p_payload ->> 'cat', '')));
  clean_type TEXT := LOWER(BTRIM(COALESCE(p_payload ->> 'type', '')));
  clean_title TEXT := BTRIM(COALESCE(p_payload ->> 'title', ''));
  clean_desc TEXT := BTRIM(COALESCE(p_payload ->> 'desc', ''));
  clean_sub TEXT := NULLIF(BTRIM(COALESCE(p_payload ->> 'sub', '')), '');
  clean_city TEXT := NULLIF(BTRIM(COALESCE(p_payload ->> 'city', '')), '');
  clean_canton TEXT := NULLIF(UPPER(BTRIM(COALESCE(p_payload ->> 'canton', ''))), '');
  clean_plz TEXT := NULLIF(BTRIM(COALESCE(p_payload ->> 'plz', '')), '');
  clean_img_url TEXT := NULLIF(BTRIM(COALESCE(p_payload ->> 'img_url', '')), '');
  clean_photo_urls JSONB := CASE
    WHEN NOT (p_payload ? 'photo_urls') OR p_payload -> 'photo_urls' = 'null'::JSONB THEN '[]'::JSONB
    ELSE p_payload -> 'photo_urls'
  END;
  clean_price_amount NUMERIC;
  clean_rooms NUMERIC;
  clean_household_size SMALLINT;
  clean_available_from DATE;
  needs_review BOOLEAN := COALESCE((p_payload ->> 'needs_review')::BOOLEAN, FALSE);
  expected_photo_prefix TEXT := 'https://zmievixfjefjppofebbh.supabase.co/storage/v1/object/public/publication-images/'
    || p_link_token::TEXT || '/punto-hispano/';
  image_url TEXT;
  recent_count INTEGER;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD';
  END IF;

  SELECT * INTO publish_link
  FROM public.punto_hispano_publish_links
  WHERE id = p_link_token AND active = TRUE
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_OR_REVOKED_LINK';
  END IF;

  SELECT id, user_id, name, active INTO business
  FROM public.providers
  WHERE id = publish_link.provider_id;

  IF NOT FOUND OR business.active IS NOT TRUE OR business.user_id IS NULL THEN
    RAISE EXCEPTION 'PUNTO_HISPANO_OWNER_REQUIRED';
  END IF;

  SELECT COUNT(*) INTO recent_count
  FROM public.punto_hispano_link_publications
  WHERE link_id = publish_link.id
    AND created_at >= NOW() - INTERVAL '1 hour';

  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'LINK_RATE_LIMIT';
  END IF;

  IF clean_cat NOT IN ('vivienda', 'venta', 'cuidados', 'documentos', 'servicios') THEN
    RAISE EXCEPTION 'INVALID_CATEGORY';
  END IF;

  IF NOT (
    (clean_cat = 'vivienda' AND clean_type IN ('busca', 'ofrece'))
    OR (clean_cat = 'venta' AND clean_type IN ('busca', 'vende', 'regala'))
    OR (clean_cat IN ('cuidados', 'documentos', 'servicios') AND clean_type IN ('busca', 'ofrece'))
  ) THEN
    RAISE EXCEPTION 'INVALID_LISTING_TYPE';
  END IF;

  IF CHAR_LENGTH(clean_title) < 4 OR CHAR_LENGTH(clean_title) > 140 THEN
    RAISE EXCEPTION 'INVALID_TITLE';
  END IF;
  IF CHAR_LENGTH(clean_desc) > 5000 OR CHAR_LENGTH(COALESCE(clean_sub, '')) > 100 THEN
    RAISE EXCEPTION 'INVALID_TEXT_LENGTH';
  END IF;
  IF CHAR_LENGTH(COALESCE(clean_city, '')) > 100
     OR CHAR_LENGTH(COALESCE(clean_canton, '')) > 4
     OR (clean_plz IS NOT NULL AND clean_plz !~ '^[0-9]{4}$') THEN
    RAISE EXCEPTION 'INVALID_LOCATION';
  END IF;

  IF jsonb_typeof(clean_photo_urls) <> 'array' OR jsonb_array_length(clean_photo_urls) > 5 THEN
    RAISE EXCEPTION 'INVALID_PHOTOS';
  END IF;

  IF clean_img_url IS NOT NULL
     AND LEFT(clean_img_url, CHAR_LENGTH(expected_photo_prefix)) <> expected_photo_prefix THEN
    RAISE EXCEPTION 'INVALID_PHOTO_URL';
  END IF;

  FOR image_url IN SELECT jsonb_array_elements_text(clean_photo_urls)
  LOOP
    IF LEFT(image_url, CHAR_LENGTH(expected_photo_prefix)) <> expected_photo_prefix THEN
      RAISE EXCEPTION 'INVALID_PHOTO_URL';
    END IF;
  END LOOP;

  clean_price_amount := NULLIF(p_payload ->> 'price_amount', '')::NUMERIC;
  clean_rooms := NULLIF(p_payload ->> 'rooms', '')::NUMERIC;
  clean_household_size := NULLIF(p_payload ->> 'household_size', '')::SMALLINT;
  clean_available_from := NULLIF(p_payload ->> 'available_from', '')::DATE;

  IF clean_price_amount IS NOT NULL AND (clean_price_amount < 0 OR clean_price_amount > 100000000) THEN
    RAISE EXCEPTION 'INVALID_PRICE';
  END IF;
  IF clean_rooms IS NOT NULL AND (clean_rooms <= 0 OR clean_rooms > 100) THEN
    RAISE EXCEPTION 'INVALID_ROOMS';
  END IF;
  IF clean_household_size IS NOT NULL AND (clean_household_size <= 0 OR clean_household_size > 20) THEN
    RAISE EXCEPTION 'INVALID_HOUSEHOLD_SIZE';
  END IF;

  INSERT INTO public.listings (
    id, user_id, user_name, cat, sub, emoji, type, title, "desc",
    img_url, photo_urls, price, price_amount, price_unit, city, canton, plz,
    privacy, contact_via_app, contact_phone, contact_email, active,
    property_type, available_from, rooms, household_size, furnished,
    pets_allowed, expires_at, lifecycle_status
  ) VALUES (
    new_listing_id,
    business.user_id,
    COALESCE(NULLIF(BTRIM(business.name), ''), 'Punto Hispano'),
    clean_cat,
    clean_sub,
    NULLIF(BTRIM(COALESCE(p_payload ->> 'emoji', '')), ''),
    clean_type,
    clean_title,
    NULLIF(clean_desc, ''),
    clean_img_url,
    CASE WHEN jsonb_array_length(clean_photo_urls) > 0 THEN clean_photo_urls ELSE NULL END,
    NULLIF(BTRIM(COALESCE(p_payload ->> 'price', '')), ''),
    clean_price_amount,
    NULLIF(BTRIM(COALESCE(p_payload ->> 'price_unit', '')), ''),
    clean_city,
    clean_canton,
    clean_plz,
    'public',
    TRUE,
    NULL,
    NULL,
    NOT needs_review,
    CASE WHEN clean_cat = 'vivienda' THEN clean_sub ELSE NULL END,
    clean_available_from,
    clean_rooms,
    CASE WHEN clean_cat = 'vivienda' AND clean_type = 'busca' THEN clean_household_size ELSE NULL END,
    CASE WHEN NULLIF(p_payload ->> 'furnished', '') IS NULL THEN NULL ELSE (p_payload ->> 'furnished')::BOOLEAN END,
    CASE WHEN NULLIF(p_payload ->> 'pets_allowed', '') IS NULL THEN NULL ELSE (p_payload ->> 'pets_allowed')::BOOLEAN END,
    CASE WHEN clean_type = 'busca' THEN NOW() + INTERVAL '30 days' ELSE NULL END,
    'active'
  );

  INSERT INTO public.punto_hispano_link_publications (link_id, listing_id, content_type, content_id)
  VALUES (publish_link.id, new_listing_id, 'listing', new_listing_id);

  UPDATE public.punto_hispano_publish_links
  SET last_used_at = NOW(), use_count = use_count + 1
  WHERE id = publish_link.id;

  IF needs_review AND to_regclass('public.moderation_queue') IS NOT NULL THEN
    EXECUTE $queue$
      INSERT INTO public.moderation_queue
        (content_type, content_id, author_id, reason, excerpt, matched_term, metadata)
      VALUES
        ('listing', $1, $2, 'Filtro automatico', $3, $4, $5)
    $queue$
    USING
      new_listing_id::TEXT,
      business.user_id,
      LEFT(CONCAT_WS(E'\n\n', clean_title, clean_desc), 700),
      COALESCE(p_payload ->> 'matched_term', ''),
      jsonb_build_object('cat', clean_cat, 'sub', clean_sub, 'type', clean_type, 'shared_publisher', 'punto_hispano');
  END IF;

  RETURN jsonb_build_object(
    'id', new_listing_id,
    'published_for_review', needs_review
  );
EXCEPTION
  WHEN invalid_text_representation OR numeric_value_out_of_range OR datetime_field_overflow THEN
    RAISE EXCEPTION 'INVALID_FIELD_FORMAT';
END;
$$;

REVOKE ALL ON FUNCTION public.publish_punto_hispano_listing(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_punto_hispano_listing(UUID, JSONB) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.publish_punto_hispano_job(
  p_link_token UUID,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  publish_link public.punto_hispano_publish_links%ROWTYPE;
  business RECORD;
  new_job_id UUID := gen_random_uuid();
  clean_intent CONSTANT TEXT := 'ofrece';
  clean_sector TEXT := LOWER(BTRIM(COALESCE(p_payload ->> 'sector', '')));
  clean_title TEXT := BTRIM(COALESCE(p_payload ->> 'title', ''));
  clean_company TEXT := NULLIF(BTRIM(COALESCE(p_payload ->> 'company', '')), '');
  clean_type TEXT := BTRIM(COALESCE(p_payload ->> 'type', ''));
  clean_city TEXT := NULLIF(BTRIM(COALESCE(p_payload ->> 'city', '')), '');
  clean_canton TEXT := NULLIF(UPPER(BTRIM(COALESCE(p_payload ->> 'canton', ''))), '');
  clean_desc TEXT := NULLIF(BTRIM(COALESCE(p_payload ->> 'desc', '')), '');
  clean_logo_url TEXT := NULLIF(BTRIM(COALESCE(p_payload ->> 'logo_url', '')), '');
  clean_languages_json JSONB := CASE
    WHEN NOT (p_payload ? 'languages') OR p_payload -> 'languages' = 'null'::JSONB THEN '[]'::JSONB
    ELSE p_payload -> 'languages'
  END;
  clean_languages TEXT[];
  clean_salary_amount NUMERIC;
  clean_experience_years INTEGER;
  clean_available_from DATE;
  clean_driving_license BOOLEAN;
  clean_employment_profile JSONB;
  clean_employment_level TEXT;
  needs_review BOOLEAN := COALESCE((p_payload ->> 'needs_review')::BOOLEAN, FALSE);
  expected_photo_prefix TEXT := 'https://zmievixfjefjppofebbh.supabase.co/storage/v1/object/public/publication-images/'
    || p_link_token::TEXT || '/punto-hispano-jobs/';
  recent_count INTEGER;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD';
  END IF;

  SELECT * INTO publish_link
  FROM public.punto_hispano_publish_links
  WHERE id = p_link_token AND active = TRUE
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_OR_REVOKED_LINK';
  END IF;

  SELECT id, user_id, name, active INTO business
  FROM public.providers
  WHERE id = publish_link.provider_id;

  IF NOT FOUND OR business.active IS NOT TRUE OR business.user_id IS NULL THEN
    RAISE EXCEPTION 'PUNTO_HISPANO_OWNER_REQUIRED';
  END IF;

  SELECT COUNT(*) INTO recent_count
  FROM public.punto_hispano_link_publications
  WHERE link_id = publish_link.id
    AND created_at >= NOW() - INTERVAL '1 hour';

  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'LINK_RATE_LIMIT';
  END IF;

  IF clean_sector NOT IN ('hosteleria', 'cuidados', 'limpieza', 'tecnologia', 'estetica', 'construccion', 'transporte', 'administracion', 'educacion', 'servicios', 'salud', 'ventas') THEN
    RAISE EXCEPTION 'INVALID_JOB_SECTOR';
  END IF;
  IF clean_type NOT IN ('Full-time', 'Part-time', 'Freelance', 'Prácticas') THEN
    RAISE EXCEPTION 'INVALID_JOB_TYPE';
  END IF;
  IF CHAR_LENGTH(clean_title) < 4 OR CHAR_LENGTH(clean_title) > 140
     OR CHAR_LENGTH(COALESCE(clean_company, '')) > 140
     OR CHAR_LENGTH(COALESCE(clean_desc, '')) > 5000 THEN
    RAISE EXCEPTION 'INVALID_TEXT_LENGTH';
  END IF;
  IF clean_canton IS NULL OR CHAR_LENGTH(clean_canton) > 4 OR CHAR_LENGTH(COALESCE(clean_city, '')) > 100 THEN
    RAISE EXCEPTION 'INVALID_LOCATION';
  END IF;
  IF clean_logo_url IS NOT NULL
     AND LEFT(clean_logo_url, CHAR_LENGTH(expected_photo_prefix)) <> expected_photo_prefix THEN
    RAISE EXCEPTION 'INVALID_PHOTO_URL';
  END IF;
  IF jsonb_typeof(clean_languages_json) <> 'array' OR jsonb_array_length(clean_languages_json) > 6 THEN
    RAISE EXCEPTION 'INVALID_LANGUAGES';
  END IF;

  SELECT COALESCE(ARRAY_AGG(value), ARRAY[]::TEXT[]) INTO clean_languages
  FROM jsonb_array_elements_text(clean_languages_json) AS language(value)
  WHERE value IN ('Español', 'Alemán', 'Francés', 'Italiano', 'Inglés', 'Portugués');

  IF CARDINALITY(clean_languages) <> jsonb_array_length(clean_languages_json) THEN
    RAISE EXCEPTION 'INVALID_LANGUAGES';
  END IF;

  clean_salary_amount := NULLIF(p_payload ->> 'salary_amount', '')::NUMERIC;
  clean_experience_years := NULLIF(p_payload ->> 'experience_years', '')::INTEGER;
  clean_available_from := NULLIF(p_payload ->> 'available_from', '')::DATE;
  clean_driving_license := NULLIF(p_payload ->> 'driving_license', '')::BOOLEAN;
  clean_employment_profile := CASE
    WHEN NOT (p_payload ? 'employment_profile') OR p_payload -> 'employment_profile' = 'null'::JSONB THEN NULL
    ELSE p_payload -> 'employment_profile'
  END;
  clean_employment_level := NULLIF(BTRIM(COALESCE(p_payload ->> 'employment_level', '')), '');

  IF clean_salary_amount IS NOT NULL AND (clean_salary_amount < 0 OR clean_salary_amount > 100000000) THEN
    RAISE EXCEPTION 'INVALID_SALARY';
  END IF;
  IF clean_salary_amount IS NOT NULL
     AND COALESCE(p_payload ->> 'salary_unit', '') NOT IN ('hora', 'dia', 'semana', 'mes', 'ano', 'once') THEN
    RAISE EXCEPTION 'INVALID_SALARY_UNIT';
  END IF;
  IF clean_experience_years IS NOT NULL AND (clean_experience_years < 0 OR clean_experience_years > 80) THEN
    RAISE EXCEPTION 'INVALID_EXPERIENCE';
  END IF;
  IF clean_employment_profile IS NOT NULL AND jsonb_typeof(clean_employment_profile) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_EMPLOYMENT_PROFILE';
  END IF;
  IF clean_employment_level IS NOT NULL AND clean_employment_level NOT IN ('apprentice', 'intermediate', 'professional') THEN
    RAISE EXCEPTION 'INVALID_EMPLOYMENT_LEVEL';
  END IF;

  INSERT INTO public.jobs (
    id, user_id, job_intent, sector, title, company, type, city, canton,
    salary, salary_amount, salary_unit, lang, languages, category, emoji, "desc",
    contact_via_app, contact, contact_phone, contact_email, contact_link, logo_url,
    active, experience_years, available_from, driving_license, employment_profile,
    employment_level, profile_visibility, expires_at, lifecycle_status
  ) VALUES (
    new_job_id,
    business.user_id,
    clean_intent,
    clean_sector,
    clean_title,
    clean_company,
    clean_type,
    COALESCE(clean_city, clean_canton),
    clean_canton,
    NULLIF(BTRIM(COALESCE(p_payload ->> 'salary', '')), ''),
    clean_salary_amount,
    CASE WHEN clean_salary_amount IS NULL THEN NULL ELSE NULLIF(BTRIM(COALESCE(p_payload ->> 'salary_unit', '')), '') END,
    CASE WHEN CARDINALITY(clean_languages) > 0 THEN ARRAY_TO_STRING(clean_languages, ' · ') ELSE NULL END,
    CASE WHEN CARDINALITY(clean_languages) > 0 THEN clean_languages ELSE NULL END,
    clean_sector,
    NULLIF(BTRIM(COALESCE(p_payload ->> 'emoji', '')), ''),
    clean_desc,
    TRUE,
    NULL,
    NULL,
    NULL,
    NULL,
    clean_logo_url,
    NOT needs_review,
    CASE WHEN clean_intent = 'busca' THEN clean_experience_years ELSE NULL END,
    CASE WHEN clean_intent = 'busca' THEN clean_available_from ELSE NULL END,
    CASE WHEN clean_intent = 'busca' THEN clean_driving_license ELSE NULL END,
    CASE WHEN clean_intent = 'busca' THEN clean_employment_profile ELSE NULL END,
    CASE WHEN clean_intent = 'busca' THEN clean_employment_level ELSE NULL END,
    CASE WHEN clean_intent = 'busca' AND p_payload ->> 'profile_visibility' = 'private' THEN 'private' ELSE 'public' END,
    CASE WHEN clean_intent = 'busca' THEN NOW() + INTERVAL '45 days' ELSE NULL END,
    'active'
  );

  INSERT INTO public.punto_hispano_link_publications (link_id, listing_id, content_type, content_id)
  VALUES (publish_link.id, new_job_id, 'job', new_job_id);

  UPDATE public.punto_hispano_publish_links
  SET last_used_at = NOW(), use_count = use_count + 1
  WHERE id = publish_link.id;

  IF needs_review AND to_regclass('public.moderation_queue') IS NOT NULL THEN
    EXECUTE $queue$
      INSERT INTO public.moderation_queue
        (content_type, content_id, author_id, reason, excerpt, matched_term, metadata)
      VALUES
        ('job', $1, $2, 'Filtro automatico', $3, $4, $5)
    $queue$
    USING
      new_job_id::TEXT,
      business.user_id,
      LEFT(CONCAT_WS(E'\n\n', clean_title, clean_company, clean_desc), 700),
      COALESCE(p_payload ->> 'matched_term', ''),
      jsonb_build_object('job_intent', clean_intent, 'sector', clean_sector, 'type', clean_type, 'shared_publisher', 'punto_hispano');
  END IF;

  RETURN jsonb_build_object('id', new_job_id, 'published_for_review', needs_review);
EXCEPTION
  WHEN invalid_text_representation OR numeric_value_out_of_range OR datetime_field_overflow THEN
    RAISE EXCEPTION 'INVALID_FIELD_FORMAT';
END;
$$;

REVOKE ALL ON FUNCTION public.publish_punto_hispano_job(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_punto_hispano_job(UUID, JSONB) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.publish_punto_hispano_event(
  p_link_token UUID,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  publish_link public.punto_hispano_publish_links%ROWTYPE;
  business RECORD;
  new_event_id UUID := gen_random_uuid();
  clean_type TEXT := LOWER(BTRIM(COALESCE(p_payload ->> 'type', '')));
  clean_title TEXT := BTRIM(COALESCE(p_payload ->> 'title', ''));
  clean_day TEXT := BTRIM(COALESCE(p_payload ->> 'day', ''));
  clean_month TEXT := UPPER(BTRIM(COALESCE(p_payload ->> 'month', '')));
  clean_year TEXT := BTRIM(COALESCE(p_payload ->> 'year', ''));
  clean_time TEXT := NULLIF(BTRIM(COALESCE(p_payload ->> 'time', '')), '');
  clean_price TEXT := NULLIF(BTRIM(COALESCE(p_payload ->> 'price', '')), '');
  clean_city TEXT := NULLIF(BTRIM(COALESCE(p_payload ->> 'city', '')), '');
  clean_canton TEXT := NULLIF(UPPER(BTRIM(COALESCE(p_payload ->> 'canton', ''))), '');
  clean_venue TEXT := NULLIF(BTRIM(COALESCE(p_payload ->> 'venue', '')), '');
  clean_desc TEXT := NULLIF(BTRIM(COALESCE(p_payload ->> 'desc', '')), '');
  clean_host TEXT := NULLIF(BTRIM(COALESCE(p_payload ->> 'host', '')), '');
  clean_link TEXT := NULLIF(BTRIM(COALESCE(p_payload ->> 'link', '')), '');
  clean_img_url TEXT := NULLIF(BTRIM(COALESCE(p_payload ->> 'img_url', '')), '');
  needs_review BOOLEAN := COALESCE((p_payload ->> 'needs_review')::BOOLEAN, FALSE);
  expected_photo_prefix TEXT := 'https://zmievixfjefjppofebbh.supabase.co/storage/v1/object/public/publication-images/'
    || p_link_token::TEXT || '/punto-hispano-events/';
  recent_count INTEGER;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD';
  END IF;

  SELECT * INTO publish_link
  FROM public.punto_hispano_publish_links
  WHERE id = p_link_token AND active = TRUE
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_OR_REVOKED_LINK';
  END IF;

  SELECT id, user_id, name, active INTO business
  FROM public.providers
  WHERE id = publish_link.provider_id;

  IF NOT FOUND OR business.active IS NOT TRUE OR business.user_id IS NULL THEN
    RAISE EXCEPTION 'PUNTO_HISPANO_OWNER_REQUIRED';
  END IF;

  SELECT COUNT(*) INTO recent_count
  FROM public.punto_hispano_link_publications
  WHERE link_id = publish_link.id
    AND created_at >= NOW() - INTERVAL '1 hour';

  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'LINK_RATE_LIMIT';
  END IF;

  IF clean_type NOT IN ('concierto', 'festival', 'quedada', 'fiesta', 'networking', 'familia') THEN
    RAISE EXCEPTION 'INVALID_EVENT_TYPE';
  END IF;
  IF CHAR_LENGTH(clean_title) < 4 OR CHAR_LENGTH(clean_title) > 140
     OR CHAR_LENGTH(COALESCE(clean_venue, '')) > 180
     OR CHAR_LENGTH(COALESCE(clean_host, '')) > 180
     OR CHAR_LENGTH(COALESCE(clean_desc, '')) > 5000
     OR CHAR_LENGTH(COALESCE(clean_price, '')) > 100 THEN
    RAISE EXCEPTION 'INVALID_TEXT_LENGTH';
  END IF;
  IF clean_canton IS NULL OR CHAR_LENGTH(clean_canton) > 4 OR CHAR_LENGTH(COALESCE(clean_city, '')) > 100 THEN
    RAISE EXCEPTION 'INVALID_LOCATION';
  END IF;
  IF clean_day !~ '^(0[1-9]|[12][0-9]|3[01])$'
     OR clean_month NOT IN ('ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC')
     OR clean_year !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'INVALID_EVENT_DATE';
  END IF;
  IF clean_time IS NOT NULL AND clean_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
    RAISE EXCEPTION 'INVALID_EVENT_TIME';
  END IF;
  IF clean_link IS NOT NULL AND (CHAR_LENGTH(clean_link) > 1000 OR clean_link !~* '^https://[^[:space:]]+$') THEN
    RAISE EXCEPTION 'INVALID_EVENT_LINK';
  END IF;
  IF clean_img_url IS NOT NULL
     AND LEFT(clean_img_url, CHAR_LENGTH(expected_photo_prefix)) <> expected_photo_prefix THEN
    RAISE EXCEPTION 'INVALID_PHOTO_URL';
  END IF;

  INSERT INTO public.events (
    id, user_id, type, title, day, month, year, time, price, city, canton,
    venue, "desc", host, link, emoji, img_url, featured, active
  ) VALUES (
    new_event_id,
    business.user_id,
    clean_type,
    clean_title,
    clean_day,
    clean_month,
    clean_year,
    clean_time,
    clean_price,
    clean_city,
    clean_canton,
    clean_venue,
    clean_desc,
    COALESCE(clean_host, NULLIF(BTRIM(business.name), ''), 'Punto Hispano'),
    clean_link,
    NULLIF(BTRIM(COALESCE(p_payload ->> 'emoji', '')), ''),
    clean_img_url,
    FALSE,
    NOT needs_review
  );

  INSERT INTO public.punto_hispano_link_publications (link_id, listing_id, content_type, content_id)
  VALUES (publish_link.id, new_event_id, 'event', new_event_id);

  UPDATE public.punto_hispano_publish_links
  SET last_used_at = NOW(), use_count = use_count + 1
  WHERE id = publish_link.id;

  IF needs_review AND to_regclass('public.moderation_queue') IS NOT NULL THEN
    EXECUTE $queue$
      INSERT INTO public.moderation_queue
        (content_type, content_id, author_id, reason, excerpt, matched_term, metadata)
      VALUES
        ('event', $1, $2, 'Filtro automatico', $3, $4, $5)
    $queue$
    USING
      new_event_id::TEXT,
      business.user_id,
      LEFT(CONCAT_WS(E'\n\n', clean_title, clean_venue, clean_desc), 700),
      COALESCE(p_payload ->> 'matched_term', ''),
      jsonb_build_object('type', clean_type, 'canton', clean_canton, 'city', clean_city, 'shared_publisher', 'punto_hispano');
  END IF;

  RETURN jsonb_build_object('id', new_event_id, 'published_for_review', needs_review);
EXCEPTION
  WHEN invalid_text_representation OR numeric_value_out_of_range OR datetime_field_overflow THEN
    RAISE EXCEPTION 'INVALID_FIELD_FORMAT';
END;
$$;

REVOKE ALL ON FUNCTION public.publish_punto_hispano_event(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_punto_hispano_event(UUID, JSONB) TO anon, authenticated;

DROP POLICY IF EXISTS "punto_hispano_shared_publication_images_insert" ON storage.objects;
CREATE POLICY "punto_hispano_shared_publication_images_insert"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'publication-images'
    AND (storage.foldername(name))[2] IN ('punto-hispano', 'punto-hispano-jobs', 'punto-hispano-events')
    AND public.is_active_punto_hispano_publish_link((storage.foldername(name))[1])
  );

COMMIT;
