-- Fix ambiguous PL/pgSQL output-column references in the Checkout reservation RPC.
-- Safe to run after business_promotion_payments.sql.

CREATE OR REPLACE FUNCTION public.reserve_featured_promotion_checkout(
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
  selected_plan public.business_promotion_plans%ROWTYPE;
  existing_reservation public.business_promotion_subscriptions%ROWTYPE;
  existing_customer_id TEXT;
  active_slots INTEGER := 0;
  reserved_slots INTEGER := 0;
  new_reservation public.business_promotion_subscriptions%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR COALESCE(TRIM(p_price_id), '') = '' THEN
    RAISE EXCEPTION 'INVALID_CHECKOUT_REQUEST';
  END IF;

  PERFORM public.expire_business_promotions();
  PERFORM public.expire_business_promotion_reservations();

  SELECT *
  INTO selected_plan
  FROM public.business_promotion_plans
  WHERE plan_key = 'featured'
  FOR UPDATE;

  IF NOT FOUND OR selected_plan.enabled IS NOT TRUE THEN
    RAISE EXCEPTION 'PLAN_UNAVAILABLE';
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

  IF selected_provider.active IS NOT TRUE THEN
    RAISE EXCEPTION 'BUSINESS_NOT_VERIFIED';
  END IF;

  IF selected_provider.promotion_plan = 'featured'
     AND selected_provider.promotion_starts_at <= NOW()
     AND selected_provider.promotion_ends_at > NOW() THEN
    RAISE EXCEPTION 'ALREADY_FEATURED';
  END IF;

  SELECT subscriptions.*
  INTO existing_reservation
  FROM public.business_promotion_subscriptions AS subscriptions
  WHERE subscriptions.provider_id = p_provider_id
    AND subscriptions.user_id = p_user_id
    AND subscriptions.status IN ('reserved', 'checkout_open', 'processing')
    AND subscriptions.reservation_expires_at > NOW()
  ORDER BY subscriptions.created_at DESC
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
    FROM public.business_promotion_subscriptions AS subscriptions
    WHERE subscriptions.provider_id = p_provider_id
      AND subscriptions.user_id = p_user_id
      AND subscriptions.status IN ('active', 'past_due')
      AND subscriptions.stripe_subscription_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'SUBSCRIPTION_EXISTS';
  END IF;

  SELECT subscriptions.stripe_customer_id
  INTO existing_customer_id
  FROM public.business_promotion_subscriptions AS subscriptions
  WHERE subscriptions.provider_id = p_provider_id
    AND subscriptions.user_id = p_user_id
    AND subscriptions.stripe_customer_id IS NOT NULL
  ORDER BY subscriptions.created_at DESC
  LIMIT 1;

  SELECT COUNT(*)::INTEGER
  INTO active_slots
  FROM public.providers
  WHERE promotion_plan = 'featured'
    AND active = TRUE
    AND promotion_starts_at <= NOW()
    AND promotion_ends_at > NOW();

  SELECT COUNT(*)::INTEGER
  INTO reserved_slots
  FROM public.business_promotion_subscriptions AS subscriptions
  WHERE (
      subscriptions.status IN ('reserved', 'checkout_open', 'processing')
      AND subscriptions.reservation_expires_at > NOW()
    )
    OR (
      subscriptions.status = 'past_due'
      AND subscriptions.stripe_subscription_id IS NOT NULL
    );

  IF selected_plan.max_active IS NOT NULL
     AND active_slots + reserved_slots >= selected_plan.max_active THEN
    RAISE EXCEPTION 'PLAN_FULL';
  END IF;

  INSERT INTO public.business_promotion_subscriptions (
    provider_id,
    user_id,
    plan_key,
    status,
    stripe_customer_id,
    stripe_price_id,
    reservation_expires_at
  )
  VALUES (
    p_provider_id,
    p_user_id,
    'featured',
    'reserved',
    existing_customer_id,
    p_price_id,
    NOW() + make_interval(mins => GREATEST(p_reservation_minutes, 30))
  )
  RETURNING *
  INTO new_reservation;

  RETURN QUERY
    SELECT
      new_reservation.id,
      new_reservation.reservation_expires_at,
      new_reservation.stripe_customer_id,
      new_reservation.stripe_checkout_session_id,
      new_reservation.stripe_checkout_url;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_featured_promotion_checkout(
  UUID,
  UUID,
  TEXT,
  INTEGER
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.reserve_featured_promotion_checkout(
  UUID,
  UUID,
  TEXT,
  INTEGER
) TO service_role;
