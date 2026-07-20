-- =====================================================================
-- LATIDO.CH - "Pregunta a Latido" (busqueda natural determinista)
--
-- Ejecutar UNA VEZ en Supabase SQL Editor antes de desplegar el frontend
-- que llama a public.search_latido(...).
-- Es idempotente: se puede volver a ejecutar para actualizar las funciones.
-- Requiere que ya existan las tablas principales de Latido.
-- =====================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.listings') IS NULL
     OR to_regclass('public.jobs') IS NULL
     OR to_regclass('public.providers') IS NULL
     OR to_regclass('public.communities') IS NULL
     OR to_regclass('public.events') IS NULL THEN
    RAISE EXCEPTION 'Faltan tablas de Latido. Ejecuta primero schema.sql y publications_schema_v4.sql.';
  END IF;
END $$;

-- Campos estructurados. Los que ya existen se conservan sin cambios.
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS price_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS price_unit TEXT,
  ADD COLUMN IF NOT EXISTS rooms NUMERIC,
  ADD COLUMN IF NOT EXISTS available_from DATE,
  ADD COLUMN IF NOT EXISTS property_type TEXT,
  ADD COLUMN IF NOT EXISTS furnished BOOLEAN,
  ADD COLUMN IF NOT EXISTS pets_allowed BOOLEAN;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS job_intent TEXT DEFAULT 'ofrece',
  ADD COLUMN IF NOT EXISTS salary_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS salary_unit TEXT,
  ADD COLUMN IF NOT EXISTS languages TEXT[],
  ADD COLUMN IF NOT EXISTS german_required BOOLEAN,
  ADD COLUMN IF NOT EXISTS german_level TEXT,
  ADD COLUMN IF NOT EXISTS spanish_supported BOOLEAN,
  ADD COLUMN IF NOT EXISTS workload_min SMALLINT,
  ADD COLUMN IF NOT EXISTS workload_max SMALLINT,
  ADD COLUMN IF NOT EXISTS driving_license_required BOOLEAN,
  ADD COLUMN IF NOT EXISTS accommodation_available BOOLEAN;

ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS languages TEXT[],
  ADD COLUMN IF NOT EXISTS spanish_supported BOOLEAN,
  ADD COLUMN IF NOT EXISTS promotion_plan TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS promotion_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS promotion_ends_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_latido_listings_assistant
  ON public.listings (cat, canton, type, price_amount, created_at DESC)
  WHERE COALESCE(active, TRUE) = TRUE;

CREATE INDEX IF NOT EXISTS idx_latido_listings_city
  ON public.listings (LOWER(city), plz)
  WHERE COALESCE(active, TRUE) = TRUE;

CREATE INDEX IF NOT EXISTS idx_latido_listings_housing
  ON public.listings (rooms, available_from, price_amount)
  WHERE COALESCE(active, TRUE) = TRUE AND cat = 'vivienda';

CREATE INDEX IF NOT EXISTS idx_latido_jobs_assistant
  ON public.jobs (canton, job_intent, sector, created_at DESC)
  WHERE COALESCE(active, TRUE) = TRUE;

CREATE INDEX IF NOT EXISTS idx_latido_providers_assistant
  ON public.providers (canton, promotion_plan, promotion_ends_at, created_at DESC)
  WHERE COALESCE(active, TRUE) = TRUE;

-- Normalizacion sin depender de una API o de una extension externa.
CREATE OR REPLACE FUNCTION public.latido_search_normalize(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT regexp_replace(
    translate(
      lower(COALESCE(p_value, '')),
      'áàäâãåéèëêíìïîóòöôõúùüûñç',
      'aaaaaaeeeeiiiiooooouuuunc'
    ),
    '[^a-z0-9]+',
    ' ',
    'g'
  );
$$;

CREATE OR REPLACE FUNCTION public.latido_search_term_score(
  p_document TEXT,
  p_terms TEXT[]
)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE(COUNT(*), 0)::INTEGER
  FROM unnest(COALESCE(p_terms, ARRAY[]::TEXT[])) AS requested(term)
  WHERE public.latido_search_normalize(requested.term) <> ''
    AND public.latido_search_normalize(p_document)
        LIKE '%' || public.latido_search_normalize(requested.term) || '%';
$$;

CREATE OR REPLACE FUNCTION public.latido_search_canonical_city(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE trim(public.latido_search_normalize(p_value))
    WHEN 'zuerich' THEN 'zurich'
    WHEN 'lucerna' THEN 'luzern'
    WHEN 'ginebra' THEN 'geneve'
    WHEN 'geneva' THEN 'geneve'
    WHEN 'basilea' THEN 'basel'
    WHEN 'berna' THEN 'bern'
    WHEN 'lausana' THEN 'lausanne'
    WHEN 'san galo' THEN 'st gallen'
    WHEN 'friburgo' THEN 'fribourg'
    ELSE trim(public.latido_search_normalize(p_value))
  END;
$$;

CREATE OR REPLACE FUNCTION public.latido_extract_amount(p_value TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  matched TEXT[];
  digits TEXT;
BEGIN
  matched := regexp_match(
    COALESCE(p_value, ''),
    '([0-9]{1,3}([.''’ ][0-9]{3})+|[0-9]{2,7}([,][0-9]{1,2})?)'
  );
  IF matched IS NULL THEN RETURN NULL; END IF;

  digits := regexp_replace(matched[1], '[.''’ ]', '', 'g');
  digits := replace(digits, ',', '.');
  RETURN NULLIF(digits, '')::NUMERIC;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.latido_extract_rooms(p_value TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  matched TEXT[];
BEGIN
  matched := regexp_match(
    translate(
      lower(COALESCE(p_value, '')),
      'áàäâãåéèëêíìïîóòöôõúùüûñç',
      'aaaaaaeeeeiiiiooooouuuunc'
    ),
    '([0-9]+([.,][05])?)[ ]*(habitacion|habitaciones|cuarto|cuartos|dormitorio|dormitorios|zimmer)'
  );
  IF matched IS NULL THEN RETURN NULL; END IF;
  RETURN replace(matched[1], ',', '.')::NUMERIC;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.latido_location_matches(
  p_row_canton TEXT,
  p_row_city TEXT,
  p_row_postal_code TEXT,
  p_canton TEXT,
  p_municipality TEXT,
  p_postal_code TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  row_canton TEXT := upper(trim(COALESCE(p_row_canton, '')));
  row_city TEXT := public.latido_search_canonical_city(p_row_city);
  wanted_city TEXT := public.latido_search_canonical_city(p_municipality);
  row_postal TEXT := trim(COALESCE(p_row_postal_code, ''));
BEGIN
  IF COALESCE(NULLIF(trim(p_canton), ''), NULLIF(trim(p_municipality), ''), NULLIF(trim(p_postal_code), '')) IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Las publicaciones marcadas para toda Suiza siguen siendo candidatas.
  IF row_canton IN ('', 'CH', 'SUIZA', 'TODA SUIZA', 'NACIONAL')
     AND row_city IN ('', 'suiza', 'toda suiza', 'nacional') THEN
    RETURN TRUE;
  END IF;

  IF NULLIF(trim(p_canton), '') IS NOT NULL
     AND row_canton <> upper(trim(p_canton)) THEN
    RETURN FALSE;
  END IF;

  IF NULLIF(wanted_city, '') IS NOT NULL
     AND row_city <> ''
     AND row_city <> public.latido_search_normalize(p_row_canton)
     AND position(wanted_city IN row_city) = 0 THEN
    RETURN FALSE;
  END IF;

  -- Si la ficha tiene CP, se exige el exacto. Si no lo tiene, ciudad/canton
  -- siguen permitiendo encontrar negocios que aun no guardan CP estructurado.
  IF NULLIF(trim(p_postal_code), '') IS NOT NULL
     AND row_postal <> ''
     AND row_postal <> trim(p_postal_code) THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

DROP FUNCTION IF EXISTS public.search_latido(
  TEXT[], TEXT, TEXT[], TEXT, TEXT, TEXT, TEXT[], NUMERIC, NUMERIC,
  NUMERIC, DATE, BOOLEAN, TEXT, INTEGER
);

CREATE OR REPLACE FUNCTION public.search_latido(
  p_entity_types TEXT[] DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_result_intents TEXT[] DEFAULT NULL,
  p_canton TEXT DEFAULT NULL,
  p_municipality TEXT DEFAULT NULL,
  p_postal_code TEXT DEFAULT NULL,
  p_terms TEXT[] DEFAULT NULL,
  p_price_min NUMERIC DEFAULT NULL,
  p_price_max NUMERIC DEFAULT NULL,
  p_rooms_min NUMERIC DEFAULT NULL,
  p_available_on DATE DEFAULT NULL,
  p_spanish_required BOOLEAN DEFAULT FALSE,
  p_german_level TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 120
)
RETURNS TABLE (
  entity_type TEXT,
  entity_id UUID,
  payload JSONB,
  commercial_priority INTEGER,
  semantic_score INTEGER,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH candidates AS (
    SELECT
      'ad'::TEXT AS entity_type,
      listing.id AS entity_id,
      to_jsonb(listing) AS payload,
      1 AS commercial_priority,
      public.latido_search_term_score(
        concat_ws(' ', listing.title, listing."desc", listing.cat, listing.sub, listing.city, listing.canton),
        p_terms
      ) AS semantic_score,
      listing.created_at
    FROM public.listings AS listing
    WHERE (COALESCE(cardinality(p_entity_types), 0) = 0 OR 'ad' = ANY(p_entity_types))
      AND COALESCE(listing.active, TRUE) = TRUE
      AND (COALESCE(listing.privacy, 'public') = 'public' OR auth.uid() IS NOT NULL)
      AND (NULLIF(p_category, '') IS NULL OR listing.cat = p_category)
      AND (COALESCE(cardinality(p_result_intents), 0) = 0 OR listing.type = ANY(p_result_intents))
      AND public.latido_location_matches(
        listing.canton, listing.city, listing.plz,
        p_canton, p_municipality, p_postal_code
      )
      AND (
        p_price_min IS NULL
        OR COALESCE(listing.price_amount, public.latido_extract_amount(listing.price)) >= p_price_min
      )
      AND (
        p_price_max IS NULL
        OR COALESCE(listing.price_amount, public.latido_extract_amount(listing.price)) <= p_price_max
      )
      AND (
        p_rooms_min IS NULL
        OR COALESCE(
          listing.rooms,
          public.latido_extract_rooms(concat_ws(' ', listing.sub, listing.title, listing."desc"))
        ) >= p_rooms_min
      )
      AND (p_available_on IS NULL OR listing.available_from <= p_available_on)

    UNION ALL

    SELECT
      'job'::TEXT,
      job.id,
      to_jsonb(job),
      1,
      public.latido_search_term_score(
        concat_ws(' ', job.title, job.company, job."desc", job.sector, job.category, job.type, job.city, job.canton, job.lang, array_to_string(job.languages, ' ')),
        p_terms
      ),
      job.created_at
    FROM public.jobs AS job
    WHERE (COALESCE(cardinality(p_entity_types), 0) = 0 OR 'job' = ANY(p_entity_types))
      AND COALESCE(job.active, TRUE) = TRUE
      AND (NULLIF(p_category, '') IS NULL OR p_category = 'empleo')
      AND (COALESCE(cardinality(p_result_intents), 0) = 0 OR COALESCE(job.job_intent, 'ofrece') = ANY(p_result_intents))
      AND public.latido_location_matches(job.canton, job.city, NULL, p_canton, p_municipality, p_postal_code)
      AND (p_price_min IS NULL OR job.salary_amount >= p_price_min)
      AND (p_price_max IS NULL OR job.salary_amount <= p_price_max)
      AND (
        NOT COALESCE(p_spanish_required, FALSE)
        OR job.spanish_supported = TRUE
        OR public.latido_search_normalize(concat_ws(' ', job.lang, array_to_string(job.languages, ' ')))
           SIMILAR TO '%(espanol|spanish|castellano)%'
      )
      AND (
        NULLIF(p_german_level, '') IS NULL
        OR lower(p_german_level) <> 'none'
        OR job.german_required = FALSE
        OR job.german_level IS NULL
        OR lower(job.german_level) IN ('none', 'basic', 'basico', 'a1', 'a2')
      )

    UNION ALL

    SELECT
      'business'::TEXT,
      provider.id,
      to_jsonb(provider),
      CASE
        WHEN provider.promotion_plan = 'premium'
          AND provider.promotion_starts_at <= NOW()
          AND provider.promotion_ends_at > NOW() THEN 0
        WHEN provider.promotion_plan = 'basic'
          AND provider.promotion_starts_at <= NOW()
          AND provider.promotion_ends_at > NOW() THEN 1
        WHEN provider.promotion_plan = 'featured'
          AND provider.promotion_starts_at <= NOW()
          AND provider.promotion_ends_at > NOW() THEN 2
        WHEN provider.featured = TRUE AND provider.promotion_plan IS NULL THEN 2
        ELSE 3
      END,
      public.latido_search_term_score(
        concat_ws(' ', provider.name, provider.description, provider.category, array_to_string(provider.services, ' '), array_to_string(provider.languages, ' '), provider.city, provider.canton),
        p_terms
      ),
      provider.created_at
    FROM public.providers AS provider
    WHERE (COALESCE(cardinality(p_entity_types), 0) = 0 OR 'business' = ANY(p_entity_types))
      AND COALESCE(provider.active, TRUE) = TRUE
      AND (
        NULLIF(p_category, '') IS NULL
        OR p_category IN ('negocios', 'servicios', 'documentos', 'cuidados')
      )
      AND (COALESCE(cardinality(p_result_intents), 0) = 0 OR 'ofrece' = ANY(p_result_intents))
      AND public.latido_location_matches(provider.canton, provider.city, NULL, p_canton, p_municipality, p_postal_code)
      AND (
        NOT COALESCE(p_spanish_required, FALSE)
        OR provider.spanish_supported = TRUE
        OR public.latido_search_normalize(array_to_string(provider.languages, ' '))
           SIMILAR TO '%(espanol|spanish|castellano)%'
      )

    UNION ALL

    SELECT
      'community'::TEXT,
      community.id,
      to_jsonb(community),
      1,
      public.latido_search_term_score(
        concat_ws(' ', community.name, community."desc", community.cat, community.city),
        p_terms
      ),
      community.created_at
    FROM public.communities AS community
    WHERE (COALESCE(cardinality(p_entity_types), 0) = 0 OR 'community' = ANY(p_entity_types))
      AND COALESCE(community.active, TRUE) = TRUE
      AND (NULLIF(p_category, '') IS NULL OR p_category = 'grupos')
      AND public.latido_location_matches(NULL, community.city, NULL, p_canton, p_municipality, p_postal_code)

    UNION ALL

    SELECT
      'event'::TEXT,
      event.id,
      to_jsonb(event),
      1,
      public.latido_search_term_score(
        concat_ws(' ', event.title, event."desc", event.type, event.venue, event.host, event.city, event.canton),
        p_terms
      ),
      event.created_at
    FROM public.events AS event
    WHERE (COALESCE(cardinality(p_entity_types), 0) = 0 OR 'event' = ANY(p_entity_types))
      AND COALESCE(event.active, TRUE) = TRUE
      AND (NULLIF(p_category, '') IS NULL OR p_category = 'eventos')
      AND public.latido_location_matches(event.canton, event.city, NULL, p_canton, p_municipality, p_postal_code)
  )
  SELECT
    candidates.entity_type,
    candidates.entity_id,
    candidates.payload,
    candidates.commercial_priority,
    candidates.semantic_score,
    candidates.created_at
  FROM candidates
  WHERE COALESCE(cardinality(p_terms), 0) = 0 OR candidates.semantic_score > 0
  ORDER BY
    candidates.commercial_priority ASC,
    candidates.semantic_score DESC,
    candidates.created_at DESC NULLS LAST
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 120), 1), 300);
$$;

REVOKE ALL ON FUNCTION public.search_latido(
  TEXT[], TEXT, TEXT[], TEXT, TEXT, TEXT, TEXT[], NUMERIC, NUMERIC,
  NUMERIC, DATE, BOOLEAN, TEXT, INTEGER
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.search_latido(
  TEXT[], TEXT, TEXT[], TEXT, TEXT, TEXT, TEXT[], NUMERIC, NUMERIC,
  NUMERIC, DATE, BOOLEAN, TEXT, INTEGER
) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.latido_search_normalize(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.latido_search_canonical_city(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.latido_search_term_score(TEXT, TEXT[]) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.latido_extract_amount(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.latido_extract_rooms(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.latido_location_matches(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.search_latido(
  TEXT[], TEXT, TEXT[], TEXT, TEXT, TEXT, TEXT[], NUMERIC, NUMERIC,
  NUMERIC, DATE, BOOLEAN, TEXT, INTEGER
) IS 'Busqueda estructurada de Pregunta a Latido. La relevancia se valida antes de aplicar la prioridad comercial.';

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Comprobacion opcional despues de ejecutar la migracion:
-- SELECT entity_type, payload->>'title' AS title, payload->>'name' AS name
-- FROM public.search_latido(
--   p_entity_types   => ARRAY['ad'],
--   p_category       => 'vivienda',
--   p_result_intents => ARRAY['ofrece'],
--   p_canton         => 'ZH',
--   p_municipality   => 'Zürich',
--   p_terms          => ARRAY['vivienda','piso','apartamento','habitacion'],
--   p_price_max      => 3000
-- );
