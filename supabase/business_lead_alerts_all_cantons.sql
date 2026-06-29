-- =====================================================================
-- LATIDO.CH - Alcance nacional para Alertas de clientes potenciales
--
-- Ejecuta este parche una vez DESPUÉS de business_lead_alerts.sql.
-- Un anuncio con ciudad, cantón y PLZ vacíos representa "Todos los
-- cantones" y podrá avisar a empresas de cualquier zona.
-- =====================================================================

-- Palabras de servicio con una misma raíz también se reconocen como
-- relacionadas: jardin/jardineria, limpiar/limpieza, pintura/pintor, etc.
CREATE OR REPLACE FUNCTION public.business_lead_alert_term_matches_listing(
  p_term TEXT,
  p_listing_text TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  WITH normalized AS (
    SELECT
      public.normalize_business_lead_alert_text(p_term) AS term,
      public.normalize_business_lead_alert_text(p_listing_text) AS listing_text
  ),
  configured_words AS (
    SELECT DISTINCT configured.word
    FROM normalized
    CROSS JOIN LATERAL REGEXP_SPLIT_TO_TABLE(normalized.term, '\s+') AS configured(word)
    WHERE CHAR_LENGTH(configured.word) >= 4
      AND configured.word <> ALL (ARRAY[
        'busco', 'necesito', 'solicito', 'quiero', 'ayuda', 'servicio',
        'servicios', 'profesional', 'profesionales', 'empresa', 'empresas',
        'para', 'desde', 'hasta', 'todo', 'toda', 'todos', 'todas'
      ]::TEXT[])
  ),
  listing_words AS (
    SELECT DISTINCT listing.word
    FROM normalized
    CROSS JOIN LATERAL REGEXP_SPLIT_TO_TABLE(normalized.listing_text, '\s+') AS listing(word)
    WHERE CHAR_LENGTH(listing.word) >= 4
  )
  SELECT EXISTS (
    SELECT 1
    FROM configured_words configured
    JOIN listing_words listing
      ON configured.word = listing.word
      OR (
        LEAST(CHAR_LENGTH(configured.word), CHAR_LENGTH(listing.word)) >= 5
        AND LEFT(configured.word, 5) = LEFT(listing.word, 5)
      )
      OR (
        LEAST(CHAR_LENGTH(configured.word), CHAR_LENGTH(listing.word)) >= 6
        AND LEFT(configured.word, 4) = LEFT(listing.word, 4)
        AND ABS(CHAR_LENGTH(configured.word) - CHAR_LENGTH(listing.word)) <= 4
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.match_business_lead_alerts_for_listing(p_listing_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_listing RECORD;
  candidate RECORD;
  normalized_listing_text TEXT;
  normalized_city TEXT;
  normalized_category TEXT;
  matched_terms TEXT[];
  inserted_count INTEGER := 0;
  snapshot_plan TEXT;
  snapshot_priority SMALLINT;
BEGIN
  SELECT *
  INTO target_listing
  FROM public.listings
  WHERE id = p_listing_id;

  IF NOT FOUND
     OR target_listing.active IS NOT TRUE
     OR LOWER(COALESCE(target_listing.type, '')) <> 'busca' THEN
    RETURN 0;
  END IF;

  normalized_listing_text := public.normalize_business_lead_alert_text(
    CONCAT_WS(' ', target_listing.title, target_listing."desc", target_listing.sub)
  );
  normalized_city := public.normalize_business_lead_alert_text(target_listing.city);
  normalized_category := public.normalize_business_lead_alert_text(target_listing.cat);

  FOR candidate IN
    SELECT
      subscription.id AS subscription_id,
      provider.id AS provider_id,
      provider.name AS provider_name,
      provider.promotion_plan,
      provider.promotion_starts_at,
      provider.promotion_ends_at,
      settings.recipient_email,
      settings.categories,
      settings.services,
      settings.keywords,
      settings.cities,
      settings.cantons,
      settings.plzs,
      settings.nationwide
    FROM public.business_lead_alert_subscriptions subscription
    JOIN public.providers provider
      ON provider.id = subscription.provider_id
    JOIN public.business_lead_alert_settings settings
      ON settings.provider_id = provider.id
    WHERE subscription.status = 'active'
      AND subscription.cancel_at_period_end IS FALSE
      AND subscription.current_period_end > NOW()
      AND provider.active IS TRUE
      AND settings.paused_at IS NULL
      AND settings.recipient_email <> ''
      AND CARDINALITY(settings.categories) > 0
      AND CARDINALITY(settings.services) + CARDINALITY(settings.keywords) > 0
      AND (
        settings.nationwide
        OR CARDINALITY(settings.cities) > 0
        OR CARDINALITY(settings.cantons) > 0
        OR CARDINALITY(settings.plzs) > 0
      )
  LOOP
    IF normalized_category = '' OR NOT (normalized_category = ANY(candidate.categories)) THEN
      CONTINUE;
    END IF;

    -- Los tres valores vacíos proceden de "Todos los cantones" en el
    -- formulario de publicación: el anuncio tiene alcance nacional.
    IF NOT candidate.nationwide
       AND (
         COALESCE(BTRIM(target_listing.city), '') <> ''
         OR COALESCE(BTRIM(target_listing.canton), '') <> ''
         OR COALESCE(BTRIM(target_listing.plz), '') <> ''
       )
       AND NOT (
         (normalized_city <> '' AND normalized_city = ANY(candidate.cities))
         OR (COALESCE(target_listing.canton, '') <> '' AND UPPER(target_listing.canton) = ANY(candidate.cantons))
         OR (COALESCE(target_listing.plz, '') <> '' AND BTRIM(target_listing.plz) = ANY(candidate.plzs))
       ) THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(ARRAY_AGG(DISTINCT term ORDER BY term), '{}'::TEXT[])
    INTO matched_terms
    FROM (
      SELECT public.normalize_business_lead_alert_text(value) AS term
      FROM UNNEST(candidate.services || candidate.keywords) AS value
    ) configured_terms
    WHERE CHAR_LENGTH(term) >= 2
      AND public.business_lead_alert_term_matches_listing(term, normalized_listing_text);

    IF CARDINALITY(matched_terms) = 0 THEN
      CONTINUE;
    END IF;

    snapshot_plan := CASE
      WHEN candidate.promotion_plan = 'premium'
        AND candidate.promotion_starts_at <= NOW()
        AND candidate.promotion_ends_at > NOW() THEN 'premium'
      WHEN candidate.promotion_plan = 'basic'
        AND candidate.promotion_starts_at <= NOW()
        AND candidate.promotion_ends_at > NOW() THEN 'basic'
      WHEN candidate.promotion_plan = 'featured'
        AND candidate.promotion_starts_at <= NOW()
        AND candidate.promotion_ends_at > NOW() THEN 'featured'
      ELSE 'free'
    END;

    snapshot_priority := CASE snapshot_plan
      WHEN 'premium' THEN 1
      WHEN 'basic' THEN 2
      WHEN 'featured' THEN 3
      ELSE 4
    END;

    INSERT INTO public.business_lead_alerts (
      provider_id,
      subscription_id,
      listing_id,
      provider_name,
      recipient_email,
      listing_title,
      listing_category,
      listing_city,
      listing_canton,
      listing_path,
      matched_terms,
      plan_snapshot,
      priority
    )
    VALUES (
      candidate.provider_id,
      candidate.subscription_id,
      target_listing.id,
      candidate.provider_name,
      candidate.recipient_email,
      COALESCE(NULLIF(BTRIM(target_listing.title), ''), 'Nuevo anuncio'),
      target_listing.cat,
      target_listing.city,
      target_listing.canton,
      '/anuncios/' || target_listing.id::TEXT,
      matched_terms,
      snapshot_plan,
      snapshot_priority
    )
    ON CONFLICT (provider_id, listing_id) DO NOTHING;

    IF FOUND THEN
      inserted_count := inserted_count + 1;
    END IF;
  END LOOP;

  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.match_business_lead_alerts_for_listing(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_business_lead_alerts_for_listing(UUID) TO service_role;
