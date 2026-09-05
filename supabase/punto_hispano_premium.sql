-- Ejecutar en el SQL Editor del proyecto de Latido con permisos administrativos.
-- Concesión manual Premium: no crea cobros ni suscripciones en Stripe.
-- Sin caducidad práctica hasta su desactivación manual. La fecha finita evita
-- incompatibilidades de la app con el valor PostgreSQL 'infinity'.
-- Incluye prioridad, distintivo, tarjetas en inicio/landing y alertas de clientes.
-- El post mensual en redes se gestiona editorialmente fuera de esta migración.
BEGIN;

DO $$
DECLARE
  target_id CONSTANT UUID := 'ee7fd475-acd3-4634-bd62-a921c6810fd4';
  period_end CONSTANT TIMESTAMPTZ := '9999-12-31 00:00:00+00';
  business public.providers%ROWTYPE;
  alert_id UUID;
BEGIN
  SELECT * INTO STRICT business
  FROM public.providers WHERE id = target_id FOR UPDATE;

  IF business.name NOT ILIKE '%Punto Hispano%' OR business.active IS NOT TRUE
     OR business.user_id IS NULL THEN
    RAISE EXCEPTION 'Punto Hispano activo y con propietario requerido';
  END IF;

  PERFORM set_config('latido.promotion_admin', '1', TRUE);
  UPDATE public.providers SET
    promotion_plan = 'premium',
    promotion_starts_at = CASE WHEN promotion_plan = 'premium'
      THEN LEAST(promotion_starts_at, NOW()) ELSE NOW() END,
    promotion_ends_at = period_end,
    featured = TRUE,
    partner_published = TRUE,
    partner_logo_url = COALESCE(NULLIF(partner_logo_url, ''), photo_url),
    partner_card_title = 'Punto Hispano',
    partner_card_description = 'Gestoría, asesoría, seguros e idiomas en Suiza. Atención en español desde Opfikon, Zúrich.',
    partner_cta_label = 'Contactar',
    partner_cta_url = 'https://puntohispano.ch/contacto?utm_source=latido&utm_medium=partner&utm_campaign=punto-hispano-latido',
    website = COALESCE(NULLIF(website, ''), 'https://puntohispano.ch'),
    services = ARRAY['Alquiler', 'Gestoria', 'Vivienda']
  WHERE id = target_id;

  -- Reutiliza únicamente esta concesión manual al volver a ejecutar el SQL.
  SELECT id INTO alert_id FROM public.business_lead_alert_subscriptions
  WHERE provider_id = target_id AND stripe_subscription_id IS NULL
    AND stripe_price_id = 'included:premium:manual:punto-hispano'
  ORDER BY created_at LIMIT 1 FOR UPDATE;

  IF alert_id IS NULL THEN
    INSERT INTO public.business_lead_alert_subscriptions (
      provider_id, user_id, status, price_chf, stripe_price_id,
      current_period_start, current_period_end
    ) VALUES (
      target_id, business.user_id, 'active', 0,
      'included:premium:manual:punto-hispano', NOW(), period_end
    );
  ELSE
    UPDATE public.business_lead_alert_subscriptions SET
      status = 'active', price_chf = 0, current_period_end = period_end,
      cancel_at_period_end = FALSE, canceled_at = NULL, updated_at = NOW()
    WHERE id = alert_id;
  END IF;

  INSERT INTO public.business_lead_alert_settings (
    provider_id, recipient_email, categories, services, cities, cantons, nationwide
  )
  SELECT id, COALESCE(NULLIF(BTRIM(email), ''), 'info@puntohispano.ch'),
    ARRAY['documentos', 'servicios', 'vivienda'], services,
    CASE WHEN NULLIF(BTRIM(city), '') IS NULL THEN '{}'::TEXT[] ELSE ARRAY[city] END,
    CASE WHEN NULLIF(BTRIM(canton), '') IS NULL THEN '{}'::TEXT[] ELSE ARRAY[canton] END,
    FALSE
  FROM public.providers WHERE id = target_id
  ON CONFLICT (provider_id) DO UPDATE SET
    categories = EXCLUDED.categories, services = EXCLUDED.services,
    paused_at = NULL, updated_at = NOW();
END;
$$;

COMMIT;

SELECT id, name, promotion_plan, promotion_starts_at, promotion_ends_at,
  featured, partner_published, partner_cta_label
FROM public.providers WHERE id = 'ee7fd475-acd3-4634-bd62-a921c6810fd4';
