-- =====================================================================
-- LATIDO.CH - Alertas de clientes potenciales
-- Producto extra de pago: CHF 49 / mes por empresa.
--
-- Ejecuta este archivo una vez en Supabase SQL Editor.
-- Es idempotente para instalaciones existentes y no modifica los planes
-- de colaboraciÃ³n ni usa el plan Exclusivo.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF to_regclass('public.listings') IS NULL THEN
    RAISE EXCEPTION 'La tabla public.listings no existe. Esta migraciÃ³n debe ejecutarse en la base de datos que usa la app actual.';
  END IF;
END;
$$;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS city TEXT;

-- Normaliza texto espaÃ±ol para comparar servicios y palabras clave sin
-- depender de mayÃºsculas, tildes ni puntuaciÃ³n.
CREATE OR REPLACE FUNCTION public.normalize_business_lead_alert_text(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT BTRIM(REGEXP_REPLACE(
    REGEXP_REPLACE(
      LOWER(TRANSLATE(
        COALESCE(p_value, ''),
        U&'\00E1\00E0\00E4\00E2\00E3\00E5\00E9\00E8\00EB\00EA\00ED\00EC\00EF\00EE\00F3\00F2\00F6\00F4\00F5\00FA\00F9\00FC\00FB\00F1\00E7\00C1\00C0\00C4\00C2\00C3\00C5\00C9\00C8\00CB\00CA\00CD\00CC\00CF\00CE\00D3\00D2\00D6\00D4\00D5\00DA\00D9\00DC\00DB\00D1\00C7',
        'aaaaaaeeeeiiiiooooouuuuncAAAAAAEEEEIIIIOOOOOUUUUNC'
      )),
      '[^a-z0-9]+', ' ', 'g'
    ),
    '\s+', ' ', 'g'
  ));
$$;

CREATE OR REPLACE FUNCTION public.normalize_business_lead_alert_text_array(p_values TEXT[])
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE(
    ARRAY_AGG(DISTINCT normalized ORDER BY normalized),
    '{}'::TEXT[]
  )
  FROM (
    SELECT public.normalize_business_lead_alert_text(value) AS normalized
    FROM UNNEST(COALESCE(p_values, '{}'::TEXT[])) AS value
  ) values_to_normalize
  WHERE normalized <> '';
$$;

-- Comprueba coincidencias por palabra y por una raíz suficiente. Así se
-- reconocen variaciones normales de un servicio español sin depender de
-- mayúsculas, tildes o plurales: jardin/jardineria, limpiar/limpieza, etc.
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

CREATE TABLE IF NOT EXISTS public.business_lead_alert_subscriptions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id                 UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  user_id                     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status                      TEXT NOT NULL DEFAULT 'reserved',
  price_chf                   NUMERIC(10,2) NOT NULL DEFAULT 49.00,
  stripe_customer_id          TEXT,
  stripe_subscription_id      TEXT,
  stripe_checkout_session_id  TEXT,
  stripe_checkout_url         TEXT,
  stripe_price_id             TEXT,
  reservation_expires_at      TIMESTAMPTZ,
  current_period_start        TIMESTAMPTZ,
  current_period_end          TIMESTAMPTZ,
  cancel_at_period_end        BOOLEAN NOT NULL DEFAULT FALSE,
  canceled_at                 TIMESTAMPTZ,
  last_payment_at             TIMESTAMPTZ,
  last_error                  TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT business_lead_alert_subscription_price_check
    CHECK (price_chf = 49.00),
  CONSTRAINT business_lead_alert_subscription_status_check
    CHECK (status IN (
      'reserved',
      'checkout_open',
      'processing',
      'active',
      'past_due',
      'canceled',
      'expired',
      'failed'
    ))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_lead_alert_stripe_subscription
  ON public.business_lead_alert_subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_lead_alert_stripe_checkout
  ON public.business_lead_alert_subscriptions (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_lead_alert_subscription_provider
  ON public.business_lead_alert_subscriptions (provider_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_business_lead_alert_subscription_active
  ON public.business_lead_alert_subscriptions (provider_id, current_period_end)
  WHERE status = 'active' AND cancel_at_period_end = FALSE;

CREATE TABLE IF NOT EXISTS public.business_lead_alert_settings (
  provider_id      UUID PRIMARY KEY REFERENCES public.providers(id) ON DELETE CASCADE,
  recipient_email  TEXT NOT NULL DEFAULT '',
  categories       TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  services         TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  keywords         TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  cities           TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  cantons          TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  plzs             TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  nationwide       BOOLEAN NOT NULL DEFAULT FALSE,
  paused_at        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT business_lead_alert_settings_categories_check
    CHECK (categories <@ ARRAY['vivienda', 'servicios', 'cuidados', 'documentos', 'venta', 'regalo']::TEXT[]),
  CONSTRAINT business_lead_alert_settings_email_check
    CHECK (recipient_email = '' OR recipient_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);

CREATE INDEX IF NOT EXISTS idx_business_lead_alert_settings_enabled
  ON public.business_lead_alert_settings (provider_id)
  WHERE paused_at IS NULL;

CREATE OR REPLACE FUNCTION public.normalize_business_lead_alert_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.recipient_email := LOWER(BTRIM(COALESCE(NEW.recipient_email, '')));
  NEW.categories := public.normalize_business_lead_alert_text_array(NEW.categories);
  NEW.services := public.normalize_business_lead_alert_text_array(NEW.services);
  NEW.keywords := public.normalize_business_lead_alert_text_array(NEW.keywords);
  NEW.cities := public.normalize_business_lead_alert_text_array(NEW.cities);
  NEW.cantons := ARRAY(
    SELECT DISTINCT UPPER(BTRIM(value))
    FROM UNNEST(COALESCE(NEW.cantons, '{}'::TEXT[])) AS value
    WHERE BTRIM(value) <> ''
    ORDER BY UPPER(BTRIM(value))
  );
  NEW.plzs := ARRAY(
    SELECT DISTINCT BTRIM(value)
    FROM UNNEST(COALESCE(NEW.plzs, '{}'::TEXT[])) AS value
    WHERE BTRIM(value) <> ''
    ORDER BY BTRIM(value)
  );
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_business_lead_alert_settings ON public.business_lead_alert_settings;
CREATE TRIGGER normalize_business_lead_alert_settings
BEFORE INSERT OR UPDATE ON public.business_lead_alert_settings
FOR EACH ROW
EXECUTE FUNCTION public.normalize_business_lead_alert_settings();

CREATE TABLE IF NOT EXISTS public.business_lead_alerts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id             UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  subscription_id         UUID REFERENCES public.business_lead_alert_subscriptions(id) ON DELETE SET NULL,
  listing_id              UUID NOT NULL,
  provider_name           TEXT NOT NULL,
  recipient_email         TEXT NOT NULL,
  listing_title           TEXT NOT NULL,
  listing_category        TEXT,
  listing_city            TEXT,
  listing_canton          TEXT,
  listing_path            TEXT NOT NULL,
  matched_terms           TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  plan_snapshot           TEXT NOT NULL DEFAULT 'free',
  priority                SMALLINT NOT NULL DEFAULT 4,
  notification_status     TEXT NOT NULL DEFAULT 'pending',
  notification_sent_at    TIMESTAMPTZ,
  email_status            TEXT NOT NULL DEFAULT 'pending',
  email_sent_at           TIMESTAMPTZ,
  email_attempts          INTEGER NOT NULL DEFAULT 0,
  delivery_status         TEXT NOT NULL DEFAULT 'pending',
  next_delivery_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivery_locked_at      TIMESTAMPTZ,
  delivery_last_error     TEXT,
  read_at                 TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT business_lead_alert_provider_listing_unique UNIQUE (provider_id, listing_id),
  CONSTRAINT business_lead_alert_plan_snapshot_check
    CHECK (plan_snapshot IN ('premium', 'basic', 'featured', 'free')),
  CONSTRAINT business_lead_alert_priority_check
    CHECK (priority BETWEEN 1 AND 4),
  CONSTRAINT business_lead_alert_notification_status_check
    CHECK (notification_status IN ('pending', 'sent', 'failed')),
  CONSTRAINT business_lead_alert_email_status_check
    CHECK (email_status IN ('pending', 'sent', 'failed')),
  CONSTRAINT business_lead_alert_delivery_status_check
    CHECK (delivery_status IN ('pending', 'processing', 'sent', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_business_lead_alert_history
  ON public.business_lead_alerts (provider_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_business_lead_alert_delivery_queue
  ON public.business_lead_alerts (priority, next_delivery_at, created_at)
  WHERE delivery_status IN ('pending', 'processing');

CREATE TABLE IF NOT EXISTS public.business_lead_alert_stripe_events (
  event_id      TEXT PRIMARY KEY,
  event_type    TEXT NOT NULL,
  processed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.business_lead_alert_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_lead_alert_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_lead_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_lead_alert_stripe_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.business_lead_alert_subscriptions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.business_lead_alert_stripe_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.business_lead_alert_subscriptions TO service_role;
GRANT ALL ON public.business_lead_alert_stripe_events TO service_role;
GRANT ALL ON public.business_lead_alert_settings TO service_role;
GRANT ALL ON public.business_lead_alerts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_lead_alert_settings TO authenticated;
GRANT SELECT ON public.business_lead_alerts TO authenticated;

DROP POLICY IF EXISTS "business_lead_alert_settings_manage_own" ON public.business_lead_alert_settings;
CREATE POLICY "business_lead_alert_settings_manage_own"
  ON public.business_lead_alert_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.providers provider
      WHERE provider.id = business_lead_alert_settings.provider_id
        AND provider.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.providers provider
      WHERE provider.id = business_lead_alert_settings.provider_id
        AND provider.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "business_lead_alerts_select_own" ON public.business_lead_alerts;
CREATE POLICY "business_lead_alerts_select_own"
  ON public.business_lead_alerts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.providers provider
      WHERE provider.id = business_lead_alerts.provider_id
        AND provider.user_id = auth.uid()
    )
  );

-- Marca una alerta interna como leÃ­da sin conceder acceso de actualizaciÃ³n
-- general sobre el historial.
CREATE OR REPLACE FUNCTION public.mark_business_lead_alert_read(p_alert_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  UPDATE public.business_lead_alerts alert
  SET read_at = COALESCE(alert.read_at, NOW()), updated_at = NOW()
  WHERE alert.id = p_alert_id
    AND EXISTS (
      SELECT 1
      FROM public.providers provider
      WHERE provider.id = alert.provider_id
        AND provider.user_id = auth.uid()
    );
END;
$$;

REVOKE ALL ON FUNCTION public.mark_business_lead_alert_read(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_business_lead_alert_read(UUID) TO authenticated;

-- El estado que consume el panel de empresa. El acceso se valida dentro de
-- Supabase, no en el navegador.
CREATE OR REPLACE FUNCTION public.get_business_lead_alert_status(p_provider_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_provider public.providers%ROWTYPE;
  selected_settings public.business_lead_alert_settings%ROWTYPE;
  selected_subscription public.business_lead_alert_subscriptions%ROWTYPE;
  subscription_enabled BOOLEAN := FALSE;
  configuration_complete BOOLEAN := FALSE;
  effective_state TEXT := 'inactive';
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  PERFORM public.expire_business_lead_alert_reservations();

  SELECT *
  INTO selected_provider
  FROM public.providers
  WHERE id = p_provider_id
    AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROVIDER_NOT_FOUND';
  END IF;

  SELECT *
  INTO selected_settings
  FROM public.business_lead_alert_settings
  WHERE provider_id = p_provider_id;

  SELECT *
  INTO selected_subscription
  FROM public.business_lead_alert_subscriptions
  WHERE provider_id = p_provider_id
  ORDER BY
    CASE status
      WHEN 'active' THEN 1
      WHEN 'past_due' THEN 2
      WHEN 'checkout_open' THEN 3
      WHEN 'reserved' THEN 4
      ELSE 5
    END,
    created_at DESC
  LIMIT 1;

  configuration_complete := selected_settings.provider_id IS NOT NULL
    AND selected_settings.recipient_email <> ''
    AND CARDINALITY(selected_settings.categories) > 0
    AND CARDINALITY(selected_settings.services) + CARDINALITY(selected_settings.keywords) > 0
    AND (
      selected_settings.nationwide
      OR CARDINALITY(selected_settings.cities) > 0
      OR CARDINALITY(selected_settings.cantons) > 0
      OR CARDINALITY(selected_settings.plzs) > 0
    );

  subscription_enabled := selected_subscription.id IS NOT NULL
    AND selected_subscription.status = 'active'
    AND selected_subscription.cancel_at_period_end IS NOT TRUE
    AND selected_subscription.current_period_end > NOW();

  effective_state := CASE
    WHEN selected_subscription.id IS NULL THEN 'inactive'
    WHEN selected_subscription.status = 'past_due' THEN 'payment_failed'
    WHEN selected_subscription.cancel_at_period_end IS TRUE
      OR selected_subscription.status = 'canceled' THEN 'canceled'
    WHEN selected_subscription.status IN ('reserved', 'checkout_open', 'processing') THEN 'pending_payment'
    WHEN selected_settings.paused_at IS NOT NULL AND subscription_enabled THEN 'paused'
    WHEN subscription_enabled AND configuration_complete THEN 'active'
    WHEN subscription_enabled THEN 'needs_configuration'
    ELSE 'inactive'
  END;

  RETURN JSONB_BUILD_OBJECT(
    'provider', JSONB_BUILD_OBJECT(
      'id', selected_provider.id,
      'name', selected_provider.name,
      'active', selected_provider.active
    ),
    'priceChf', 49,
    'configurationComplete', configuration_complete,
    'active', effective_state = 'active',
    'state', effective_state,
    'settings', CASE
      WHEN selected_settings.provider_id IS NULL THEN NULL
      ELSE JSONB_BUILD_OBJECT(
        'recipientEmail', selected_settings.recipient_email,
        'categories', selected_settings.categories,
        'services', selected_settings.services,
        'keywords', selected_settings.keywords,
        'cities', selected_settings.cities,
        'cantons', selected_settings.cantons,
        'plzs', selected_settings.plzs,
        'nationwide', selected_settings.nationwide,
        'pausedAt', selected_settings.paused_at
      )
    END,
    'subscription', CASE
      WHEN selected_subscription.id IS NULL THEN NULL
      ELSE JSONB_BUILD_OBJECT(
        'status', selected_subscription.status,
        'priceChf', selected_subscription.price_chf,
        'currentPeriodStart', selected_subscription.current_period_start,
        'currentPeriodEnd', selected_subscription.current_period_end,
        'cancelAtPeriodEnd', selected_subscription.cancel_at_period_end,
        'canManage', selected_subscription.stripe_customer_id IS NOT NULL
      )
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_business_lead_alert_status(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_business_lead_alert_status(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.expire_business_lead_alert_reservations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_rows INTEGER := 0;
BEGIN
  UPDATE public.business_lead_alert_subscriptions
  SET
    status = 'expired',
    stripe_checkout_url = NULL,
    reservation_expires_at = NULL,
    updated_at = NOW()
  WHERE status IN ('reserved', 'checkout_open', 'processing')
    AND reservation_expires_at IS NOT NULL
    AND reservation_expires_at <= NOW();

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_business_lead_alert_reservations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_business_lead_alert_reservations() TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_business_lead_alert_checkout(
  p_provider_id UUID,
  p_user_id UUID,
  p_price_id TEXT,
  p_reservation_minutes INTEGER DEFAULT 35
)
RETURNS TABLE (
  reservation_id UUID,
  reservation_expires_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_checkout_session_id TEXT,
  stripe_checkout_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_provider public.providers%ROWTYPE;
  existing_reservation public.business_lead_alert_subscriptions%ROWTYPE;
  existing_customer_id TEXT;
  expires_at TIMESTAMPTZ;
BEGIN
  IF p_provider_id IS NULL OR p_user_id IS NULL OR COALESCE(BTRIM(p_price_id), '') = '' THEN
    RAISE EXCEPTION 'INVALID_CHECKOUT_REQUEST';
  END IF;

  PERFORM public.expire_business_lead_alert_reservations();

  SELECT *
  INTO selected_provider
  FROM public.providers
  WHERE id = p_provider_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROVIDER_NOT_FOUND';
  END IF;

  IF selected_provider.active IS NOT TRUE THEN
    RAISE EXCEPTION 'BUSINESS_NOT_VERIFIED';
  END IF;

  SELECT *
  INTO existing_reservation
  FROM public.business_lead_alert_subscriptions subscription
  WHERE subscription.provider_id = p_provider_id
    AND subscription.user_id = p_user_id
    AND subscription.status IN ('reserved', 'checkout_open', 'processing')
    AND subscription.reservation_expires_at > NOW()
  ORDER BY subscription.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    RETURN QUERY
      SELECT
        existing_reservation.id,
        existing_reservation.reservation_expires_at,
        existing_reservation.stripe_customer_id,
        existing_reservation.stripe_checkout_session_id,
        existing_reservation.stripe_checkout_url;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.business_lead_alert_subscriptions subscription
    WHERE subscription.provider_id = p_provider_id
      AND subscription.user_id = p_user_id
      AND subscription.status IN ('active', 'past_due')
      AND subscription.stripe_subscription_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'SUBSCRIPTION_EXISTS';
  END IF;

  SELECT subscription.stripe_customer_id
  INTO existing_customer_id
  FROM public.business_lead_alert_subscriptions subscription
  WHERE subscription.provider_id = p_provider_id
    AND subscription.user_id = p_user_id
    AND subscription.stripe_customer_id IS NOT NULL
  ORDER BY subscription.created_at DESC
  LIMIT 1;

  expires_at := NOW() + MAKE_INTERVAL(mins => LEAST(GREATEST(p_reservation_minutes, 5), 60));

  INSERT INTO public.business_lead_alert_subscriptions (
    provider_id,
    user_id,
    status,
    price_chf,
    stripe_customer_id,
    stripe_price_id,
    reservation_expires_at
  )
  VALUES (
    p_provider_id,
    p_user_id,
    'reserved',
    49.00,
    existing_customer_id,
    BTRIM(p_price_id),
    expires_at
  )
  RETURNING id, reservation_expires_at, stripe_customer_id, stripe_checkout_session_id, stripe_checkout_url
  INTO reservation_id, reservation_expires_at, stripe_customer_id, stripe_checkout_session_id, stripe_checkout_url;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_business_lead_alert_checkout(UUID, UUID, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_business_lead_alert_checkout(UUID, UUID, TEXT, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.attach_business_lead_alert_checkout(
  p_reservation_id UUID,
  p_checkout_session_id TEXT,
  p_checkout_url TEXT,
  p_customer_id TEXT,
  p_expires_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.business_lead_alert_subscriptions
  SET
    status = 'checkout_open',
    stripe_checkout_session_id = p_checkout_session_id,
    stripe_checkout_url = p_checkout_url,
    stripe_customer_id = COALESCE(p_customer_id, stripe_customer_id),
    reservation_expires_at = p_expires_at,
    updated_at = NOW()
  WHERE id = p_reservation_id
    AND status IN ('reserved', 'checkout_open', 'processing');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CHECKOUT_RESERVATION_NOT_FOUND';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.attach_business_lead_alert_checkout(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_business_lead_alert_checkout(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_business_lead_alert_checkout(
  p_reservation_id UUID,
  p_subscription_id TEXT,
  p_customer_id TEXT,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ,
  p_cancel_at_period_end BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.business_lead_alert_subscriptions
  SET
    status = 'active',
    stripe_subscription_id = p_subscription_id,
    stripe_customer_id = COALESCE(p_customer_id, stripe_customer_id),
    current_period_start = p_period_start,
    current_period_end = p_period_end,
    cancel_at_period_end = COALESCE(p_cancel_at_period_end, FALSE),
    reservation_expires_at = NULL,
    stripe_checkout_url = NULL,
    last_payment_at = NOW(),
    last_error = NULL,
    updated_at = NOW()
  WHERE id = p_reservation_id
    AND status IN ('reserved', 'checkout_open', 'processing', 'active');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CHECKOUT_RESERVATION_NOT_FOUND';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_business_lead_alert_checkout(UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_business_lead_alert_checkout(UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_business_lead_alert_subscription_state(
  p_subscription_id TEXT,
  p_customer_id TEXT,
  p_status TEXT,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ,
  p_cancel_at_period_end BOOLEAN,
  p_last_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_subscription public.business_lead_alert_subscriptions%ROWTYPE;
  local_status TEXT;
BEGIN
  SELECT *
  INTO selected_subscription
  FROM public.business_lead_alert_subscriptions subscription
  WHERE subscription.stripe_subscription_id = p_subscription_id
  ORDER BY subscription.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  local_status := CASE
    WHEN p_status IN ('active', 'trialing') THEN 'active'
    WHEN p_status IN ('past_due', 'unpaid', 'incomplete') THEN 'past_due'
    WHEN p_status IN ('canceled', 'incomplete_expired', 'paused') THEN 'canceled'
    ELSE 'processing'
  END;

  UPDATE public.business_lead_alert_subscriptions
  SET
    status = local_status,
    stripe_customer_id = COALESCE(p_customer_id, stripe_customer_id),
    current_period_start = COALESCE(p_period_start, current_period_start),
    current_period_end = COALESCE(p_period_end, current_period_end),
    cancel_at_period_end = COALESCE(p_cancel_at_period_end, FALSE),
    canceled_at = CASE
      WHEN local_status = 'canceled' OR COALESCE(p_cancel_at_period_end, FALSE) THEN NOW()
      ELSE canceled_at
    END,
    last_error = p_last_error,
    updated_at = NOW()
  WHERE id = selected_subscription.id;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_business_lead_alert_subscription_state(TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_business_lead_alert_subscription_state(TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, TEXT) TO service_role;

-- Crea una sola alerta por empresa y anuncio. La funciÃ³n se ejecuta al
-- publicar, por lo que guarda la prioridad y la configuraciÃ³n vigentes en
-- ese instante, antes de pasarla a la cola de entrega.
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

    -- En el formulario de anuncios, ciudad/cantón/PLZ vacíos significan
    -- "Todos los cantones". En ese caso el anuncio busca el servicio en
    -- toda Suiza y no se limita a la zona configurada por cada empresa.
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

CREATE OR REPLACE FUNCTION public.queue_business_lead_alerts_for_listing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.active IS TRUE
     AND LOWER(COALESCE(NEW.type, '')) = 'busca'
     AND (
       TG_OP = 'INSERT'
       OR OLD.active IS DISTINCT FROM TRUE
     ) THEN
    PERFORM public.match_business_lead_alerts_for_listing(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS queue_business_lead_alerts_for_listing ON public.listings;
CREATE TRIGGER queue_business_lead_alerts_for_listing
AFTER INSERT OR UPDATE OF active ON public.listings
FOR EACH ROW
EXECUTE FUNCTION public.queue_business_lead_alerts_for_listing();

-- La Edge Function de correo reclama la cola en este orden. SKIP LOCKED
-- permite ejecuciones simultÃ¡neas sin duplicar entregas.
CREATE OR REPLACE FUNCTION public.claim_business_lead_alert_deliveries(p_limit INTEGER DEFAULT 25)
RETURNS TABLE (
  id UUID,
  provider_id UUID,
  provider_name TEXT,
  recipient_email TEXT,
  listing_title TEXT,
  listing_category TEXT,
  listing_city TEXT,
  listing_canton TEXT,
  listing_path TEXT,
  matched_terms TEXT[],
  priority SMALLINT,
  notification_status TEXT,
  email_status TEXT,
  email_attempts INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT alert.id
    FROM public.business_lead_alerts alert
    WHERE (
      alert.delivery_status = 'pending'
      AND alert.next_delivery_at <= NOW()
    ) OR (
      alert.delivery_status = 'processing'
      AND alert.delivery_locked_at < NOW() - INTERVAL '5 minutes'
    )
    ORDER BY alert.priority ASC, alert.next_delivery_at ASC, alert.created_at ASC
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.business_lead_alerts alert
    SET
      delivery_status = 'processing',
      delivery_locked_at = NOW(),
      email_attempts = alert.email_attempts + 1,
      updated_at = NOW()
    FROM candidates
    WHERE alert.id = candidates.id
    RETURNING alert.*
  )
  SELECT
    alert.id,
    alert.provider_id,
    alert.provider_name,
    alert.recipient_email,
    alert.listing_title,
    alert.listing_category,
    alert.listing_city,
    alert.listing_canton,
    alert.listing_path,
    alert.matched_terms,
    alert.priority,
    alert.notification_status,
    alert.email_status,
    alert.email_attempts
  FROM claimed alert
  ORDER BY alert.priority ASC, alert.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_business_lead_alert_deliveries(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_business_lead_alert_deliveries(INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_business_lead_alert_delivery(
  p_alert_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.business_lead_alerts
  SET
    notification_status = 'sent',
    notification_sent_at = COALESCE(notification_sent_at, NOW()),
    email_status = 'sent',
    email_sent_at = COALESCE(email_sent_at, NOW()),
    delivery_status = 'sent',
    delivery_locked_at = NULL,
    delivery_last_error = NULL,
    updated_at = NOW()
  WHERE id = p_alert_id
    AND delivery_status = 'processing';
END;
$$;

REVOKE ALL ON FUNCTION public.complete_business_lead_alert_delivery(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_business_lead_alert_delivery(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.retry_business_lead_alert_delivery(
  p_alert_id UUID,
  p_error TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attempt_number INTEGER;
BEGIN
  SELECT email_attempts
  INTO attempt_number
  FROM public.business_lead_alerts
  WHERE id = p_alert_id
    AND delivery_status = 'processing'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.business_lead_alerts
  SET
    notification_status = CASE
      WHEN notification_status = 'sent' THEN 'sent'
      ELSE 'pending'
    END,
    email_status = 'pending',
    delivery_status = 'pending',
    next_delivery_at = NOW() + MAKE_INTERVAL(mins => LEAST(GREATEST(attempt_number * 5, 5), 60)),
    delivery_locked_at = NULL,
    delivery_last_error = LEFT(COALESCE(p_error, 'DELIVERY_FAILED'), 1000),
    updated_at = NOW()
  WHERE id = p_alert_id;
END;
$$;

REVOKE ALL ON FUNCTION public.retry_business_lead_alert_delivery(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.retry_business_lead_alert_delivery(UUID, TEXT) TO service_role;

-- DiagnÃ³stico manual despuÃ©s de la activaciÃ³n:
-- SELECT * FROM public.business_lead_alert_subscriptions ORDER BY created_at DESC;
-- SELECT provider_name, listing_title, matched_terms, priority, notification_status, email_status
-- FROM public.business_lead_alerts ORDER BY created_at DESC;
