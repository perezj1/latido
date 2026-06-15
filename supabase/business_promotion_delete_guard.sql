-- Prevent deleting a business while its Stripe subscription is still active.
-- Safe to run after business_promotion_payments.sql.

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

NOTIFY pgrst, 'reload schema';
