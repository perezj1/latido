-- =====================================================================
-- LATIDO.CH - Stripe subscriptions for the "Negocio Destacado" plan
-- Run after supabase/business_promotion_plans.sql.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE public.business_promotion_plans
SET
  max_active = 20,
  enabled = TRUE,
  updated_at = NOW()
WHERE plan_key = 'featured';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'business_promotion_featured_capacity_check'
      AND conrelid = 'public.business_promotion_plans'::regclass
  ) THEN
    ALTER TABLE public.business_promotion_plans
      ADD CONSTRAINT business_promotion_featured_capacity_check
      CHECK (plan_key <> 'featured' OR max_active = 20);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.business_promotion_subscriptions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id                 UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  user_id                     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_key                    TEXT NOT NULL DEFAULT 'featured'
                                REFERENCES public.business_promotion_plans(plan_key),
  status                      TEXT NOT NULL DEFAULT 'reserved',
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
  CONSTRAINT business_promotion_subscription_plan_check
    CHECK (plan_key = 'featured'),
  CONSTRAINT business_promotion_subscription_status_check
    CHECK (
      status IN (
        'reserved',
        'checkout_open',
        'processing',
        'active',
        'past_due',
        'canceled',
        'expired',
        'failed'
      )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_promotion_stripe_subscription
  ON public.business_promotion_subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_promotion_stripe_checkout
  ON public.business_promotion_subscriptions (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_promotion_subscription_provider
  ON public.business_promotion_subscriptions (provider_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_business_promotion_subscription_reservations
  ON public.business_promotion_subscriptions (status, reservation_expires_at)
  WHERE status IN ('reserved', 'checkout_open', 'processing');

CREATE TABLE IF NOT EXISTS public.business_promotion_stripe_events (
  event_id       TEXT PRIMARY KEY,
  event_type     TEXT NOT NULL,
  processed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.business_promotion_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_promotion_stripe_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.business_promotion_subscriptions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.business_promotion_stripe_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.business_promotion_subscriptions TO service_role;
GRANT ALL ON public.business_promotion_stripe_events TO service_role;

CREATE OR REPLACE FUNCTION public.expire_business_promotion_reservations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_rows INTEGER := 0;
BEGIN
  UPDATE public.business_promotion_subscriptions
  SET
    status = 'expired',
    stripe_checkout_url = NULL,
    reservation_expires_at = NULL,
    updated_at = NOW()
  WHERE status IN ('reserved', 'checkout_open', 'processing')
    AND reservation_expires_at IS NOT NULL
    AND reservation_expires_at <= NOW()
    AND current_period_end IS NULL;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_business_promotion_reservations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_business_promotion_reservations() TO service_role;

CREATE OR REPLACE FUNCTION public.get_featured_promotion_checkout_status(
  p_provider_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_provider public.providers%ROWTYPE;
  selected_plan public.business_promotion_plans%ROWTYPE;
  latest_subscription public.business_promotion_subscriptions%ROWTYPE;
  active_slots INTEGER := 0;
  reserved_slots INTEGER := 0;
  available_slots INTEGER := 0;
  promotion_active BOOLEAN := FALSE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
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
  WHERE plan_key = 'featured';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PLAN_NOT_FOUND';
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO active_slots
  FROM public.providers
  WHERE promotion_plan = 'featured'
    AND verified = TRUE
    AND active = TRUE
    AND promotion_starts_at <= NOW()
    AND promotion_ends_at > NOW();

  SELECT COUNT(*)::INTEGER
  INTO reserved_slots
  FROM public.business_promotion_subscriptions AS subscriptions
  WHERE (
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
        AND reserved_provider.promotion_plan = 'featured'
        AND reserved_provider.verified = TRUE
        AND reserved_provider.active = TRUE
        AND reserved_provider.promotion_starts_at <= NOW()
        AND reserved_provider.promotion_ends_at > NOW()
    );

  SELECT *
  INTO latest_subscription
  FROM public.business_promotion_subscriptions
  WHERE provider_id = p_provider_id
  ORDER BY created_at DESC
  LIMIT 1;

  promotion_active :=
    selected_provider.promotion_plan = 'featured'
    AND selected_provider.verified = TRUE
    AND selected_provider.active = TRUE
    AND selected_provider.promotion_starts_at <= NOW()
    AND selected_provider.promotion_ends_at > NOW();

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
      'promotionActive', promotion_active,
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
      selected_provider.verified = TRUE
      AND selected_provider.active = TRUE
      AND selected_plan.enabled = TRUE,
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

REVOKE ALL ON FUNCTION public.get_featured_promotion_checkout_status(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_featured_promotion_checkout_status(UUID)
  TO authenticated;

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

  IF selected_provider.verified IS NOT TRUE OR selected_provider.active IS NOT TRUE THEN
    RAISE EXCEPTION 'BUSINESS_NOT_VERIFIED';
  END IF;

  IF selected_provider.promotion_plan = 'featured'
     AND selected_provider.promotion_starts_at <= NOW()
     AND selected_provider.promotion_ends_at > NOW() THEN
    RAISE EXCEPTION 'ALREADY_FEATURED';
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
    AND verified = TRUE
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

CREATE OR REPLACE FUNCTION public.attach_featured_promotion_checkout(
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
  UPDATE public.business_promotion_subscriptions
  SET
    status = 'checkout_open',
    stripe_checkout_session_id = p_checkout_session_id,
    stripe_checkout_url = p_checkout_url,
    stripe_customer_id = COALESCE(p_customer_id, stripe_customer_id),
    reservation_expires_at = GREATEST(p_expires_at, NOW() + INTERVAL '1 minute'),
    updated_at = NOW(),
    last_error = NULL
  WHERE id = p_reservation_id
    AND status IN ('reserved', 'checkout_open');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RESERVATION_NOT_FOUND';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.attach_featured_promotion_checkout(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TIMESTAMPTZ
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_featured_promotion_checkout(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TIMESTAMPTZ
) TO service_role;

CREATE OR REPLACE FUNCTION public.mark_featured_promotion_checkout_processing(
  p_reservation_id UUID,
  p_subscription_id TEXT,
  p_customer_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.business_promotion_subscriptions
  SET
    status = CASE WHEN status = 'active' THEN status ELSE 'processing' END,
    stripe_subscription_id = COALESCE(p_subscription_id, stripe_subscription_id),
    stripe_customer_id = COALESCE(p_customer_id, stripe_customer_id),
    stripe_checkout_url = NULL,
    reservation_expires_at = CASE
      WHEN status = 'active' THEN NULL
      ELSE NOW() + INTERVAL '24 hours'
    END,
    updated_at = NOW()
  WHERE id = p_reservation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_featured_promotion_checkout_processing(
  UUID,
  TEXT,
  TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_featured_promotion_checkout_processing(
  UUID,
  TEXT,
  TEXT
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
DECLARE
  selected_plan public.business_promotion_plans%ROWTYPE;
  selected_provider public.providers%ROWTYPE;
  selected_subscription public.business_promotion_subscriptions%ROWTYPE;
  occupied_slots INTEGER := 0;
BEGIN
  IF p_period_start IS NULL
     OR p_period_end IS NULL
     OR p_period_end <= p_period_start THEN
    RAISE EXCEPTION 'INVALID_PROMOTION_DATES';
  END IF;

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

  IF selected_provider.verified IS NOT TRUE OR selected_provider.active IS NOT TRUE THEN
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

  SELECT COUNT(*)::INTEGER
  INTO occupied_slots
  FROM public.providers
  WHERE id <> p_provider_id
    AND promotion_plan = 'featured'
    AND verified = TRUE
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
    promotion_plan = 'featured',
    promotion_starts_at = CASE
      WHEN promotion_plan = 'featured'
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

CREATE OR REPLACE FUNCTION public.sync_featured_promotion_subscription_state(
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
  selected_subscription public.business_promotion_subscriptions%ROWTYPE;
  local_status TEXT;
BEGIN
  SELECT *
  INTO selected_subscription
  FROM public.business_promotion_subscriptions
  WHERE stripe_subscription_id = p_subscription_id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  local_status := CASE
    WHEN p_status IN ('active', 'trialing')
      AND selected_subscription.status = 'active' THEN 'active'
    WHEN p_status IN ('active', 'trialing') THEN selected_subscription.status
    WHEN p_status IN ('past_due', 'unpaid', 'incomplete') THEN 'past_due'
    WHEN p_status IN ('canceled', 'incomplete_expired', 'paused') THEN 'canceled'
    ELSE 'processing'
  END;

  UPDATE public.business_promotion_subscriptions
  SET
    status = local_status,
    stripe_customer_id = COALESCE(p_customer_id, stripe_customer_id),
    current_period_start = COALESCE(p_period_start, current_period_start),
    current_period_end = COALESCE(p_period_end, current_period_end),
    cancel_at_period_end = COALESCE(p_cancel_at_period_end, FALSE),
    canceled_at = CASE
      WHEN local_status = 'canceled' THEN NOW()
      ELSE canceled_at
    END,
    last_error = p_last_error,
    updated_at = NOW()
  WHERE id = selected_subscription.id;

  IF local_status IN ('past_due', 'canceled')
     AND NOT EXISTS (
       SELECT 1
       FROM public.business_promotion_subscriptions AS other_subscription
       WHERE other_subscription.provider_id = selected_subscription.provider_id
         AND other_subscription.id <> selected_subscription.id
         AND other_subscription.status = 'active'
         AND other_subscription.current_period_end > NOW()
     ) THEN
    PERFORM set_config('latido.promotion_admin', '1', TRUE);

    UPDATE public.providers
    SET
      promotion_plan = 'free',
      promotion_starts_at = NULL,
      promotion_ends_at = NULL,
      featured = FALSE
    WHERE id = selected_subscription.provider_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_featured_promotion_subscription_state(
  TEXT,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  BOOLEAN,
  TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_featured_promotion_subscription_state(
  TEXT,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  BOOLEAN,
  TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.release_featured_promotion_reservation(
  p_reservation_id UUID,
  p_status TEXT DEFAULT 'expired',
  p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.business_promotion_subscriptions
  SET
    status = CASE WHEN p_status = 'failed' THEN 'failed' ELSE 'expired' END,
    stripe_checkout_url = NULL,
    reservation_expires_at = NULL,
    last_error = p_error,
    updated_at = NOW()
  WHERE id = p_reservation_id
    AND status IN ('reserved', 'checkout_open', 'processing');
END;
$$;

REVOKE ALL ON FUNCTION public.release_featured_promotion_reservation(
  UUID,
  TEXT,
  TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_featured_promotion_reservation(
  UUID,
  TEXT,
  TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_featured_promotion_capacity()
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
  IF NEW.promotion_plan <> 'featured'
     OR NEW.verified IS NOT TRUE
     OR NEW.active IS NOT TRUE
     OR NEW.promotion_ends_at <= NOW() THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO selected_plan
  FROM public.business_promotion_plans
  WHERE plan_key = 'featured'
  FOR UPDATE;

  IF selected_plan.max_active IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO provider_slots
  FROM public.providers
  WHERE id <> NEW.id
    AND promotion_plan = 'featured'
    AND verified = TRUE
    AND active = TRUE
    AND promotion_starts_at < NEW.promotion_ends_at
    AND promotion_ends_at > NEW.promotion_starts_at;

  SELECT COUNT(*)::INTEGER
  INTO checkout_slots
  FROM public.business_promotion_subscriptions
  WHERE provider_id <> NEW.id
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
CREATE TRIGGER enforce_featured_promotion_capacity
BEFORE INSERT OR UPDATE OF
  promotion_plan,
  promotion_starts_at,
  promotion_ends_at,
  verified,
  active
ON public.providers
FOR EACH ROW
EXECUTE FUNCTION public.enforce_featured_promotion_capacity();

CREATE OR REPLACE FUNCTION public.prevent_provider_delete_with_active_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.business_promotion_subscriptions AS subscriptions
    WHERE subscriptions.provider_id = OLD.id
      AND subscriptions.status IN ('active', 'past_due', 'processing')
      AND subscriptions.stripe_subscription_id IS NOT NULL
      AND subscriptions.cancel_at_period_end IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'ACTIVE_BUSINESS_SUBSCRIPTION';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS prevent_provider_delete_with_active_subscription
  ON public.providers;
CREATE TRIGGER prevent_provider_delete_with_active_subscription
BEFORE DELETE ON public.providers
FOR EACH ROW
EXECUTE FUNCTION public.prevent_provider_delete_with_active_subscription();

CREATE OR REPLACE FUNCTION public.get_business_deletion_status(
  p_provider_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  blocking_subscription public.business_promotion_subscriptions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.providers
    WHERE id = p_provider_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'PROVIDER_NOT_FOUND';
  END IF;

  SELECT subscriptions.*
  INTO blocking_subscription
  FROM public.business_promotion_subscriptions AS subscriptions
  WHERE subscriptions.provider_id = p_provider_id
    AND subscriptions.status IN ('active', 'past_due', 'processing')
    AND subscriptions.stripe_subscription_id IS NOT NULL
    AND subscriptions.cancel_at_period_end IS NOT TRUE
  ORDER BY subscriptions.created_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'blocked', blocking_subscription.id IS NOT NULL,
    'subscription', CASE
      WHEN blocking_subscription.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'status', blocking_subscription.status,
        'currentPeriodEnd', blocking_subscription.current_period_end,
        'cancelAtPeriodEnd', blocking_subscription.cancel_at_period_end
      )
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_business_deletion_status(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_business_deletion_status(UUID)
  TO authenticated;

NOTIFY pgrst, 'reload schema';

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
        WHERE providers.verified = TRUE
          AND providers.active = TRUE
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

-- Optional cleanup when pg_cron is available:
-- SELECT cron.schedule(
--   'expire-business-promotion-reservations',
--   '*/5 * * * *',
--   $$SELECT public.expire_business_promotion_reservations();$$
-- );
