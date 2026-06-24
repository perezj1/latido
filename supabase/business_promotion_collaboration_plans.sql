-- =====================================================================
-- LATIDO.CH - Enable paid collaboration plans in Stripe checkout.
-- Run after supabase/business_promotion_plans.sql and
-- supabase/business_promotion_payments.sql.
-- =====================================================================

UPDATE public.business_promotion_plans
SET
  max_active = CASE plan_key
    WHEN 'featured' THEN 20
    WHEN 'basic' THEN 12
    WHEN 'premium' THEN 6
    ELSE max_active
  END,
  enabled = CASE
    WHEN plan_key IN ('featured', 'basic', 'premium') THEN TRUE
    WHEN plan_key = 'exclusive' THEN FALSE
    ELSE enabled
  END,
  updated_at = NOW()
WHERE plan_key IN ('featured', 'basic', 'premium', 'exclusive');

ALTER TABLE public.business_promotion_subscriptions
  DROP CONSTRAINT IF EXISTS business_promotion_subscription_plan_check;

ALTER TABLE public.business_promotion_subscriptions
  ADD CONSTRAINT business_promotion_subscription_plan_check
  CHECK (plan_key IN ('featured', 'basic', 'premium'));

CREATE OR REPLACE FUNCTION public.get_business_promotion_checkout_status(
  p_provider_id UUID,
  p_plan_key TEXT DEFAULT 'featured'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_plan_key TEXT := LOWER(COALESCE(NULLIF(TRIM(p_plan_key), ''), 'featured'));
  selected_provider public.providers%ROWTYPE;
  selected_plan public.business_promotion_plans%ROWTYPE;
  latest_subscription public.business_promotion_subscriptions%ROWTYPE;
  active_slots INTEGER := 0;
  reserved_slots INTEGER := 0;
  available_slots INTEGER := 0;
  promotion_active BOOLEAN := FALSE;
  selected_plan_active BOOLEAN := FALSE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF normalized_plan_key NOT IN ('featured', 'basic', 'premium') THEN
    RAISE EXCEPTION 'PLAN_NOT_FOUND';
  END IF;

  PERFORM public.expire_business_promotions();
  PERFORM public.expire_business_promotion_reservations();

  SELECT *
  INTO selected_provider
  FROM public.providers
  WHERE id = p_provider_id
    AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROVIDER_NOT_FOUND';
  END IF;

  SELECT *
  INTO selected_plan
  FROM public.business_promotion_plans
  WHERE plan_key = normalized_plan_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PLAN_NOT_FOUND';
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO active_slots
  FROM public.providers
  WHERE promotion_plan = normalized_plan_key
    AND active = TRUE
    AND promotion_starts_at <= NOW()
    AND promotion_ends_at > NOW();

  SELECT COUNT(*)::INTEGER
  INTO reserved_slots
  FROM public.business_promotion_subscriptions AS subscriptions
  WHERE subscriptions.plan_key = normalized_plan_key
    AND (
      (
        subscriptions.status IN ('reserved', 'checkout_open', 'processing')
        AND subscriptions.reservation_expires_at > NOW()
      )
      OR (
        subscriptions.status = 'past_due'
        AND subscriptions.stripe_subscription_id IS NOT NULL
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.providers AS reserved_provider
      WHERE reserved_provider.id = subscriptions.provider_id
        AND reserved_provider.promotion_plan = normalized_plan_key
        AND reserved_provider.active = TRUE
        AND reserved_provider.promotion_starts_at <= NOW()
        AND reserved_provider.promotion_ends_at > NOW()
    );

  SELECT *
  INTO latest_subscription
  FROM public.business_promotion_subscriptions
  WHERE provider_id = p_provider_id
    AND plan_key = normalized_plan_key
  ORDER BY created_at DESC
  LIMIT 1;

  promotion_active :=
    selected_provider.promotion_plan <> 'free'
    AND selected_provider.active = TRUE
    AND selected_provider.promotion_starts_at <= NOW()
    AND selected_provider.promotion_ends_at > NOW();

  selected_plan_active :=
    promotion_active
    AND selected_provider.promotion_plan = normalized_plan_key;

  available_slots := CASE
    WHEN selected_plan.max_active IS NULL THEN 999999
    ELSE GREATEST(selected_plan.max_active - active_slots - reserved_slots, 0)
  END;

  RETURN jsonb_build_object(
    'provider', jsonb_build_object(
      'id', selected_provider.id,
      'name', selected_provider.name,
      'verified', selected_provider.verified,
      'active', selected_provider.active,
      'promotionPlan', selected_provider.promotion_plan,
      'promotionActive', promotion_active,
      'selectedPlanActive', selected_plan_active,
      'promotionStartsAt', selected_provider.promotion_starts_at,
      'promotionEndsAt', selected_provider.promotion_ends_at
    ),
    'plan', jsonb_build_object(
      'key', selected_plan.plan_key,
      'label', selected_plan.label,
      'enabled', selected_plan.enabled,
      'maxActive', selected_plan.max_active,
      'activeCount', active_slots,
      'reservedCount', reserved_slots,
      'availableSlots', available_slots
    ),
    'eligible',
      selected_plan.enabled = TRUE,
    'subscription', CASE
      WHEN latest_subscription.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'status', latest_subscription.status,
        'reservationExpiresAt', latest_subscription.reservation_expires_at,
        'currentPeriodStart', latest_subscription.current_period_start,
        'currentPeriodEnd', latest_subscription.current_period_end,
        'cancelAtPeriodEnd', latest_subscription.cancel_at_period_end,
        'canManage',
          latest_subscription.stripe_customer_id IS NOT NULL
          AND latest_subscription.status IN ('active', 'past_due')
      )
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_business_promotion_checkout_status(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_business_promotion_checkout_status(UUID, TEXT)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.get_featured_promotion_checkout_status(
  p_provider_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.get_business_promotion_checkout_status(p_provider_id, 'featured');
END;
$$;

REVOKE ALL ON FUNCTION public.get_featured_promotion_checkout_status(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_featured_promotion_checkout_status(UUID)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.reserve_business_promotion_checkout(
  p_provider_id UUID,
  p_user_id UUID,
  p_plan_key TEXT,
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
  normalized_plan_key TEXT := LOWER(COALESCE(NULLIF(TRIM(p_plan_key), ''), 'featured'));
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

  IF normalized_plan_key NOT IN ('featured', 'basic', 'premium') THEN
    RAISE EXCEPTION 'PLAN_NOT_FOUND';
  END IF;

  PERFORM public.expire_business_promotions();
  PERFORM public.expire_business_promotion_reservations();

  SELECT *
  INTO selected_plan
  FROM public.business_promotion_plans
  WHERE plan_key = normalized_plan_key
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

  IF selected_provider.promotion_plan <> 'free'
     AND selected_provider.promotion_starts_at <= NOW()
     AND selected_provider.promotion_ends_at > NOW() THEN
    RAISE EXCEPTION 'ALREADY_PROMOTED';
  END IF;

  SELECT *
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
    IF existing_reservation.plan_key <> normalized_plan_key THEN
      RAISE EXCEPTION 'CHECKOUT_OPEN_OTHER_PLAN';
    END IF;

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
  WHERE promotion_plan = normalized_plan_key
    AND active = TRUE
    AND promotion_starts_at <= NOW()
    AND promotion_ends_at > NOW();

  SELECT COUNT(*)::INTEGER
  INTO reserved_slots
  FROM public.business_promotion_subscriptions AS subscriptions
  WHERE subscriptions.plan_key = normalized_plan_key
    AND (
      (
        subscriptions.status IN ('reserved', 'checkout_open', 'processing')
        AND subscriptions.reservation_expires_at > NOW()
      )
      OR (
        subscriptions.status = 'past_due'
        AND subscriptions.stripe_subscription_id IS NOT NULL
      )
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
    normalized_plan_key,
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

REVOKE ALL ON FUNCTION public.reserve_business_promotion_checkout(
  UUID,
  UUID,
  TEXT,
  TEXT,
  INTEGER
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_business_promotion_checkout(
  UUID,
  UUID,
  TEXT,
  TEXT,
  INTEGER
) TO service_role;

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
BEGIN
  RETURN QUERY
    SELECT *
    FROM public.reserve_business_promotion_checkout(
      p_provider_id,
      p_user_id,
      'featured',
      p_price_id,
      p_reservation_minutes
    );
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

CREATE OR REPLACE FUNCTION public.activate_business_promotion_subscription(
  p_reservation_id UUID,
  p_provider_id UUID,
  p_user_id UUID,
  p_plan_key TEXT,
  p_subscription_id TEXT,
  p_customer_id TEXT,
  p_price_id TEXT,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ,
  p_cancel_at_period_end BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_plan_key TEXT := LOWER(COALESCE(NULLIF(TRIM(p_plan_key), ''), 'featured'));
  selected_plan public.business_promotion_plans%ROWTYPE;
  selected_provider public.providers%ROWTYPE;
  selected_subscription public.business_promotion_subscriptions%ROWTYPE;
  occupied_slots INTEGER := 0;
BEGIN
  IF normalized_plan_key NOT IN ('featured', 'basic', 'premium') THEN
    RAISE EXCEPTION 'PLAN_NOT_FOUND';
  END IF;

  IF p_period_start IS NULL
     OR p_period_end IS NULL
     OR p_period_end <= p_period_start THEN
    RAISE EXCEPTION 'INVALID_PROMOTION_DATES';
  END IF;

  SELECT *
  INTO selected_plan
  FROM public.business_promotion_plans
  WHERE plan_key = normalized_plan_key
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

  SELECT *
  INTO selected_subscription
  FROM public.business_promotion_subscriptions
  WHERE id = p_reservation_id
    AND provider_id = p_provider_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SUBSCRIPTION_RECORD_NOT_FOUND';
  END IF;

  IF selected_subscription.plan_key <> normalized_plan_key THEN
    RAISE EXCEPTION 'PLAN_MISMATCH';
  END IF;

  IF selected_subscription.stripe_price_id IS NOT NULL
     AND selected_subscription.stripe_price_id <> p_price_id THEN
    RAISE EXCEPTION 'PRICE_MISMATCH';
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO occupied_slots
  FROM public.providers
  WHERE id <> p_provider_id
    AND promotion_plan = normalized_plan_key
    AND active = TRUE
    AND promotion_starts_at < p_period_end
    AND promotion_ends_at > p_period_start;

  IF selected_plan.max_active IS NOT NULL
     AND occupied_slots >= selected_plan.max_active THEN
    RAISE EXCEPTION 'PLAN_FULL_AFTER_PAYMENT';
  END IF;

  PERFORM set_config('latido.promotion_admin', '1', TRUE);

  UPDATE public.providers
  SET
    promotion_plan = normalized_plan_key,
    promotion_starts_at = CASE
      WHEN promotion_plan = normalized_plan_key
        AND promotion_starts_at IS NOT NULL
        AND promotion_ends_at > NOW()
      THEN LEAST(promotion_starts_at, p_period_start)
      ELSE p_period_start
    END,
    promotion_ends_at = p_period_end,
    featured = TRUE
  WHERE id = p_provider_id;

  UPDATE public.business_promotion_subscriptions
  SET
    status = 'active',
    stripe_subscription_id = p_subscription_id,
    stripe_customer_id = p_customer_id,
    stripe_price_id = p_price_id,
    stripe_checkout_url = NULL,
    reservation_expires_at = NULL,
    current_period_start = p_period_start,
    current_period_end = p_period_end,
    cancel_at_period_end = COALESCE(p_cancel_at_period_end, FALSE),
    canceled_at = NULL,
    last_payment_at = NOW(),
    last_error = NULL,
    updated_at = NOW()
  WHERE id = p_reservation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_business_promotion_subscription(
  UUID,
  UUID,
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  BOOLEAN
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_business_promotion_subscription(
  UUID,
  UUID,
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  BOOLEAN
) TO service_role;

CREATE OR REPLACE FUNCTION public.activate_featured_promotion_subscription(
  p_reservation_id UUID,
  p_provider_id UUID,
  p_user_id UUID,
  p_subscription_id TEXT,
  p_customer_id TEXT,
  p_price_id TEXT,
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
  PERFORM public.activate_business_promotion_subscription(
    p_reservation_id,
    p_provider_id,
    p_user_id,
    'featured',
    p_subscription_id,
    p_customer_id,
    p_price_id,
    p_period_start,
    p_period_end,
    p_cancel_at_period_end
  );
END;
$$;

REVOKE ALL ON FUNCTION public.activate_featured_promotion_subscription(
  UUID,
  UUID,
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  BOOLEAN
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_featured_promotion_subscription(
  UUID,
  UUID,
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  BOOLEAN
) TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_business_promotion_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_plan public.business_promotion_plans%ROWTYPE;
  provider_slots INTEGER := 0;
  checkout_slots INTEGER := 0;
BEGIN
  IF NEW.promotion_plan = 'free'
     OR NEW.active IS NOT TRUE
     OR NEW.promotion_ends_at <= NOW() THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO selected_plan
  FROM public.business_promotion_plans
  WHERE plan_key = NEW.promotion_plan
  FOR UPDATE;

  IF NOT FOUND OR selected_plan.max_active IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO provider_slots
  FROM public.providers
  WHERE id <> NEW.id
    AND promotion_plan = NEW.promotion_plan
    AND active = TRUE
    AND promotion_starts_at < NEW.promotion_ends_at
    AND promotion_ends_at > NEW.promotion_starts_at;

  SELECT COUNT(*)::INTEGER
  INTO checkout_slots
  FROM public.business_promotion_subscriptions
  WHERE provider_id <> NEW.id
    AND plan_key = NEW.promotion_plan
    AND (
      (
        status IN ('reserved', 'checkout_open', 'processing')
        AND reservation_expires_at > NOW()
      )
      OR (
        status = 'past_due'
        AND stripe_subscription_id IS NOT NULL
      )
    );

  IF provider_slots + checkout_slots >= selected_plan.max_active THEN
    RAISE EXCEPTION 'PLAN_FULL';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_featured_promotion_capacity
  ON public.providers;
DROP TRIGGER IF EXISTS enforce_business_promotion_capacity
  ON public.providers;
CREATE TRIGGER enforce_business_promotion_capacity
BEFORE INSERT OR UPDATE OF
  promotion_plan,
  promotion_starts_at,
  promotion_ends_at,
  verified,
  active
ON public.providers
FOR EACH ROW
EXECUTE FUNCTION public.enforce_business_promotion_capacity();

CREATE OR REPLACE FUNCTION public.get_business_promotion_availability()
RETURNS TABLE (
  plan_key TEXT,
  label TEXT,
  priority INTEGER,
  rotation_weight NUMERIC,
  max_active INTEGER,
  enabled BOOLEAN,
  active_count BIGINT,
  available_slots INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.expire_business_promotions();
  PERFORM public.expire_business_promotion_reservations();

  RETURN QUERY
  WITH provider_counts AS (
    SELECT
      plans.plan_key,
      COUNT(providers.id) FILTER (
        WHERE providers.active = TRUE
          AND providers.promotion_starts_at <= NOW()
          AND providers.promotion_ends_at > NOW()
      ) AS active_count
    FROM public.business_promotion_plans AS plans
    LEFT JOIN public.providers AS providers
      ON providers.promotion_plan = plans.plan_key
    GROUP BY plans.plan_key
  ),
  reservation_counts AS (
    SELECT
      subscriptions.plan_key,
      COUNT(*)::INTEGER AS reserved_count
    FROM public.business_promotion_subscriptions AS subscriptions
    WHERE (
        subscriptions.status IN ('reserved', 'checkout_open', 'processing')
        AND subscriptions.reservation_expires_at > NOW()
      )
      OR (
        subscriptions.status = 'past_due'
        AND subscriptions.stripe_subscription_id IS NOT NULL
      )
    GROUP BY subscriptions.plan_key
  )
  SELECT
    plans.plan_key,
    plans.label,
    plans.priority,
    plans.rotation_weight,
    plans.max_active,
    plans.enabled,
    COALESCE(provider_counts.active_count, 0),
    CASE
      WHEN plans.max_active IS NULL THEN NULL
      ELSE GREATEST(
        plans.max_active
        - COALESCE(provider_counts.active_count, 0)::INTEGER
        - COALESCE(reservation_counts.reserved_count, 0),
        0
      )
    END
  FROM public.business_promotion_plans AS plans
  LEFT JOIN provider_counts
    ON provider_counts.plan_key = plans.plan_key
  LEFT JOIN reservation_counts
    ON reservation_counts.plan_key = plans.plan_key
  ORDER BY plans.priority ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_business_promotion_availability() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_business_promotion_availability()
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
