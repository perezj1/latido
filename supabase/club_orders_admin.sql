-- Run after club_orders.sql. Private orders: access only through checked RPCs.
BEGIN;
ALTER TABLE public.club_orders ADD COLUMN IF NOT EXISTS processing_at timestamptz;
ALTER TABLE public.club_orders ADD COLUMN IF NOT EXISTS shipped_at timestamptz;
ALTER TABLE public.club_orders ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
CREATE TABLE IF NOT EXISTS public.club_order_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.club_orders(id),
  from_status text NOT NULL,
  to_status text NOT NULL,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.club_order_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.club_order_history FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.club_orders, public.club_stripe_events, public.club_order_history TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.club_order_number_seq, public.club_order_history_id_seq TO service_role;
DO $$
DECLARE expression text;
BEGIN
  SELECT pg_get_expr(conbin, conrelid) INTO expression FROM pg_constraint
    WHERE conrelid = 'public.app_notifications'::regclass AND conname = 'app_notifications_kind_check';
  IF expression IS NOT NULL AND position('store_order' IN expression) = 0 THEN
    ALTER TABLE public.app_notifications DROP CONSTRAINT app_notifications_kind_check;
    EXECUTE 'ALTER TABLE public.app_notifications ADD CONSTRAINT app_notifications_kind_check CHECK (kind = ''store_order'' OR (' || expression || '))';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.club_admin_orders(p_status text DEFAULT 'paid', p_search text DEFAULT '', p_page integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_business_promotion_admin() THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  WITH filtered AS (
    SELECT o.* FROM public.club_orders o
    WHERE (p_status = 'all' OR (p_status = 'paid' AND o.payment_status = 'paid') OR o.status = p_status)
      AND (coalesce(p_search, '') = '' OR concat_ws(' ', o.reference, o.customer_name, o.customer_email, o.items::text) ILIKE '%' || left(p_search, 160) || '%')
  ), page_rows AS (
    SELECT * FROM filtered ORDER BY created_at DESC, id DESC LIMIT 25 OFFSET (greatest(1, least(coalesce(p_page, 1), 100000)) - 1) * 25
  ) SELECT jsonb_build_object(
    'rows', coalesce((SELECT jsonb_agg(to_jsonb(p) - 'request_fingerprint' - 'stripe_checkout_url' - 'checkout_request_id' ORDER BY p.created_at DESC, p.id DESC) FROM page_rows p), '[]'::jsonb),
    'total', (SELECT count(*) FROM filtered),
    'pending', (SELECT count(*) FROM public.club_orders WHERE payment_status = 'paid' AND status = 'paid'),
    'generated_at', now()
  ) INTO result;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.club_admin_update_order(p_id uuid, p_expected_status text, p_status text, p_notes text DEFAULT '', p_tracking_url text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.club_orders;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_business_promotion_admin() THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  SELECT * INTO o FROM public.club_orders WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  IF o.status IS DISTINCT FROM p_expected_status THEN RAISE EXCEPTION 'ORDER_CHANGED'; END IF;
  IF o.payment_status <> 'paid' THEN RAISE EXCEPTION 'ORDER_NOT_PAID'; END IF;
  IF p_status IS NULL OR NOT (
    (o.status IN ('paid', 'gelato_ordered', 'shipped', 'delivered') AND p_status = o.status)
    OR (o.status = 'paid' AND p_status = 'gelato_ordered')
    OR (o.status = 'gelato_ordered' AND p_status = 'shipped')
    OR (o.status = 'shipped' AND p_status = 'delivered')
  ) THEN RAISE EXCEPTION 'INVALID_ORDER_TRANSITION'; END IF;
  IF length(coalesce(p_notes, '')) > 5000 OR length(coalesce(p_tracking_url, '')) > 2000
    OR (coalesce(p_tracking_url, '') <> '' AND p_tracking_url !~ '^https://[^[:space:]]+$') THEN RAISE EXCEPTION 'INVALID_ORDER_DETAILS'; END IF;
  UPDATE public.club_orders SET status = p_status, internal_notes = nullif(p_notes, ''), tracking_url = nullif(p_tracking_url, ''),
    processing_at = CASE WHEN p_status = 'gelato_ordered' THEN coalesce(processing_at, now()) ELSE processing_at END,
    shipped_at = CASE WHEN p_status = 'shipped' THEN coalesce(shipped_at, now()) ELSE shipped_at END,
    delivered_at = CASE WHEN p_status = 'delivered' THEN coalesce(delivered_at, now()) ELSE delivered_at END
  WHERE id = p_id RETURNING * INTO o;
  IF p_expected_status <> p_status THEN
    INSERT INTO public.club_order_history(order_id, from_status, to_status, actor_id) VALUES(p_id, p_expected_status, p_status, auth.uid());
  END IF;
  RETURN to_jsonb(o) - 'request_fingerprint' - 'stripe_checkout_url' - 'checkout_request_id';
END $$;

-- Atomic settlement: a repeated/late webhook must never reset fulfillment.
CREATE OR REPLACE FUNCTION public.club_settle_payment(p_id uuid, p_session text, p_amount integer, p_currency text, p_details jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.club_orders;
BEGIN
  SELECT * INTO o FROM public.club_orders WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  IF o.stripe_checkout_session_id IS DISTINCT FROM p_session THEN RAISE EXCEPTION 'ORDER_SESSION_MISMATCH'; END IF;
  IF o.total_amount IS DISTINCT FROM p_amount OR o.currency IS DISTINCT FROM p_currency THEN RAISE EXCEPTION 'ORDER_AMOUNT_MISMATCH'; END IF;
  IF o.payment_status = 'refunded' THEN RETURN to_jsonb(o); END IF;
  IF nullif(p_details->>'customer_email', '') IS NULL OR nullif(p_details->>'customer_name', '') IS NULL
    OR nullif(p_details->'shipping_address'->>'line1', '') IS NULL
    OR nullif(p_details->'shipping_address'->>'postal_code', '') IS NULL
    OR nullif(p_details->'shipping_address'->>'city', '') IS NULL
    OR p_details->'shipping_address'->>'country' IS DISTINCT FROM 'CH' THEN RAISE EXCEPTION 'ORDER_SHIPPING_MISSING'; END IF;
  UPDATE public.club_orders SET
    status = CASE WHEN status IN ('gelato_ordered', 'shipped', 'delivered') THEN status ELSE 'paid' END,
    payment_status = 'paid', paid_at = coalesce(paid_at, now()), stripe_checkout_url = null,
    customer_email = p_details->>'customer_email', customer_name = p_details->>'customer_name',
    customer_phone = p_details->>'customer_phone', shipping_address = p_details->'shipping_address',
    stripe_payment_intent_id = p_details->>'stripe_payment_intent_id', stripe_customer_id = p_details->>'stripe_customer_id'
  WHERE id = p_id RETURNING * INTO o;
  INSERT INTO public.app_notifications(recipient_id, kind, source_id, data)
  SELECT p.id, 'store_order', o.id::text, jsonb_build_object('reference', o.reference, 'href', '/admin-latido?section=storeOrders')
  FROM public.profiles p JOIN public.business_promotion_admins a ON lower(a.email) = lower(p.email)
  ON CONFLICT (recipient_id, kind, source_id) DO NOTHING;
  RETURN to_jsonb(o);
END $$;
REVOKE ALL ON FUNCTION public.club_settle_payment(uuid,text,integer,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_settle_payment(uuid,text,integer,text,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.club_admin_orders(text,text,integer), public.club_admin_update_order(uuid,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.club_admin_orders(text,text,integer), public.club_admin_update_order(uuid,text,text,text,text) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
