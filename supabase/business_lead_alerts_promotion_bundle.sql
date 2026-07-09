-- =====================================================================
-- LATIDO.CH - Alertas incluidas en un plan profesional
-- Ejecuta este parche despues de business_lead_alerts.sql.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.activate_business_lead_alert_from_promotion(
  p_provider_id UUID,
  p_user_id UUID,
  p_subscription_id TEXT,
  p_customer_id TEXT,
  p_price_id TEXT,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ,
  p_recipient_email TEXT,
  p_cancel_at_period_end BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_provider public.providers%ROWTYPE;
  existing_alert_subscription public.business_lead_alert_subscriptions%ROWTYPE;
  alert_categories TEXT[];
  alert_services TEXT[];
  alert_cities TEXT[];
  alert_cantons TEXT[];
  selected_user_email TEXT := '';
  normalized_email TEXT := LOWER(BTRIM(COALESCE(p_recipient_email, '')));
  included_in_plan BOOLEAN := COALESCE(p_price_id, '') LIKE 'included:%';
  alert_price NUMERIC(10,2) := CASE WHEN included_in_plan THEN 0.00 ELSE 49.00 END;
BEGIN
  IF p_period_start IS NULL OR p_period_end IS NULL OR p_period_end <= p_period_start THEN
    RAISE EXCEPTION 'INVALID_ALERT_DATES';
  END IF;

  SELECT *
  INTO selected_provider
  FROM public.providers
  WHERE id = p_provider_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROVIDER_NOT_FOUND';
  END IF;

  SELECT email
  INTO selected_user_email
  FROM auth.users
  WHERE id = p_user_id;

  normalized_email := LOWER(BTRIM(COALESCE(
    NULLIF(normalized_email, ''),
    NULLIF(selected_provider.email, ''),
    NULLIF(selected_user_email, ''),
    ''
  )));

  IF normalized_email = '' THEN
    RAISE EXCEPTION 'ALERT_EMAIL_REQUIRED';
  END IF;

  alert_categories := CASE selected_provider.category
    WHEN 'hogar' THEN ARRAY['servicios', 'vivienda']::TEXT[]
    WHEN 'vehiculos' THEN ARRAY['servicios']::TEXT[]
    WHEN 'belleza' THEN ARRAY['servicios']::TEXT[]
    WHEN 'salud' THEN ARRAY['servicios', 'cuidados']::TEXT[]
    WHEN 'asesoria_tramites' THEN ARRAY['documentos', 'servicios']::TEXT[]
    WHEN 'restaurante' THEN ARRAY['venta']::TEXT[]
    WHEN 'pasteleria' THEN ARRAY['venta']::TEXT[]
    WHEN 'tienda' THEN ARRAY['venta']::TEXT[]
    ELSE ARRAY['servicios']::TEXT[]
  END;
  alert_services := COALESCE(selected_provider.services, '{}'::TEXT[]);
  alert_cities := CASE
    WHEN COALESCE(BTRIM(selected_provider.city), '') = '' THEN '{}'::TEXT[]
    ELSE ARRAY[selected_provider.city]
  END;
  alert_cantons := CASE
    WHEN COALESCE(BTRIM(selected_provider.canton), '') = '' THEN '{}'::TEXT[]
    ELSE ARRAY[selected_provider.canton]
  END;

  SELECT *
  INTO existing_alert_subscription
  FROM public.business_lead_alert_subscriptions
  WHERE stripe_subscription_id = p_subscription_id
  FOR UPDATE;

  -- En una suscripción de Alertas sin plan profesional existe primero una
  -- reserva creada antes de que Stripe asigne el id de suscripción. La
  -- reutilizamos en vez de dejar una reserva pendiente y crear otra fila.
  IF NOT FOUND THEN
    SELECT *
    INTO existing_alert_subscription
    FROM public.business_lead_alert_subscriptions
    WHERE provider_id = p_provider_id
      AND user_id = p_user_id
      AND status IN ('reserved', 'checkout_open', 'processing')
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF FOUND THEN
    UPDATE public.business_lead_alert_subscriptions
    SET
      provider_id = p_provider_id,
      user_id = p_user_id,
      status = 'active',
      price_chf = alert_price,
      stripe_customer_id = p_customer_id,
      stripe_price_id = p_price_id,
      current_period_start = p_period_start,
      current_period_end = p_period_end,
      cancel_at_period_end = COALESCE(p_cancel_at_period_end, FALSE),
      reservation_expires_at = NULL,
      stripe_checkout_url = NULL,
      canceled_at = NULL,
      last_payment_at = NOW(),
      last_error = NULL,
      updated_at = NOW()
    WHERE id = existing_alert_subscription.id;
  ELSE
    INSERT INTO public.business_lead_alert_subscriptions (
      provider_id, user_id, status, price_chf, stripe_customer_id,
      stripe_subscription_id, stripe_price_id, current_period_start,
      current_period_end, cancel_at_period_end, last_payment_at
    ) VALUES (
      p_provider_id, p_user_id, 'active', alert_price, p_customer_id,
      p_subscription_id, p_price_id, p_period_start,
      p_period_end, COALESCE(p_cancel_at_period_end, FALSE), NOW()
    );
  END IF;

  INSERT INTO public.business_lead_alert_settings (
    provider_id, recipient_email, categories, services, keywords,
    cities, cantons, plzs, nationwide, paused_at
  ) VALUES (
    p_provider_id, normalized_email, alert_categories, alert_services, '{}'::TEXT[],
    alert_cities, alert_cantons, '{}'::TEXT[],
    CARDINALITY(alert_cities) = 0 AND CARDINALITY(alert_cantons) = 0,
    NULL
  )
  ON CONFLICT (provider_id) DO UPDATE
  SET
    recipient_email = EXCLUDED.recipient_email,
    categories = EXCLUDED.categories,
    services = EXCLUDED.services,
    keywords = '{}'::TEXT[],
    cities = EXCLUDED.cities,
    cantons = EXCLUDED.cantons,
    plzs = '{}'::TEXT[],
    nationwide = EXCLUDED.nationwide,
    paused_at = NULL,
    updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.activate_business_lead_alert_from_promotion(
  UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, BOOLEAN
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_business_lead_alert_from_promotion(
  UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, BOOLEAN
) TO service_role;
