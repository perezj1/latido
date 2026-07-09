-- =====================================================================
-- LATIDO.CH - Landing dedicada extra + alertas incluidas en Premium
-- Ejecuta despues de business_lead_alerts.sql, business_lead_alerts_promotion_bundle.sql
-- y business_promotion_collaboration_plans.sql.
-- =====================================================================

ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS partner_landing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS partner_landing_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS partner_landing_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS partner_landing_published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS partner_landing_price_id TEXT;

ALTER TABLE public.business_lead_alert_subscriptions
  DROP CONSTRAINT IF EXISTS business_lead_alert_subscription_price_check;

ALTER TABLE public.business_lead_alert_subscriptions
  ADD CONSTRAINT business_lead_alert_subscription_price_check
  CHECK (price_chf IN (0.00, 49.00));

CREATE OR REPLACE FUNCTION public.activate_business_landing_from_promotion(
  p_provider_id UUID,
  p_user_id UUID,
  p_price_id TEXT,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_provider public.providers%ROWTYPE;
BEGIN
  IF p_period_start IS NULL OR p_period_end IS NULL OR p_period_end <= p_period_start THEN
    RAISE EXCEPTION 'INVALID_LANDING_DATES';
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

  UPDATE public.providers
  SET
    partner_landing_enabled = TRUE,
    partner_landing_starts_at = p_period_start,
    partner_landing_ends_at = p_period_end,
    partner_landing_published_at = COALESCE(partner_landing_published_at, NOW()),
    partner_landing_price_id = p_price_id,
    partner_published = TRUE,
    partner_logo_url = COALESCE(NULLIF(partner_logo_url, ''), photo_url),
    partner_card_title = COALESCE(NULLIF(partner_card_title, ''), name),
    partner_card_description = COALESCE(
      NULLIF(partner_card_description, ''),
      NULLIF(description, ''),
      'Servicio recomendado para la comunidad hispanohablante en Suiza.'
    ),
    partner_cta_label = COALESCE(NULLIF(partner_cta_label, ''), 'Ver landing en Latido'),
    updated_at = NOW()
  WHERE id = p_provider_id;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_business_landing_from_promotion(
  UUID, UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_business_landing_from_promotion(
  UUID, UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ
) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_business_landing_from_promotion(
  p_provider_id UUID,
  p_enabled BOOLEAN,
  p_period_start TIMESTAMPTZ DEFAULT NULL,
  p_period_end TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.providers
  SET
    partner_landing_enabled = COALESCE(p_enabled, FALSE),
    partner_landing_starts_at = CASE WHEN COALESCE(p_enabled, FALSE) THEN p_period_start ELSE partner_landing_starts_at END,
    partner_landing_ends_at = CASE WHEN COALESCE(p_enabled, FALSE) THEN p_period_end ELSE NOW() END,
    updated_at = NOW()
  WHERE id = p_provider_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_business_landing_from_promotion(
  UUID, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_business_landing_from_promotion(
  UUID, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ
) TO service_role;

NOTIFY pgrst, 'reload schema';
