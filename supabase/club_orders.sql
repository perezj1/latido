-- Pedidos de Latido Club pagados con Stripe y preparados manualmente en Gelato.
-- Ejecutar una sola vez en Supabase SQL Editor antes de desplegar las funciones.

CREATE SEQUENCE IF NOT EXISTS public.club_order_number_seq START 1001;

CREATE TABLE IF NOT EXISTS public.club_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number BIGINT NOT NULL DEFAULT nextval('public.club_order_number_seq'),
  reference TEXT GENERATED ALWAYS AS ('LC-' || lpad(order_number::TEXT, 6, '0')) STORED,
  checkout_request_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'checkout_open'
    CHECK (status IN ('checkout_open', 'payment_processing', 'paid', 'payment_failed', 'expired', 'gelato_ordered', 'shipped', 'delivered', 'refunded', 'failed')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'processing', 'paid', 'failed', 'refunded')),
  currency TEXT NOT NULL DEFAULT 'chf' CHECK (currency = lower(currency)),
  subtotal_amount INTEGER NOT NULL CHECK (subtotal_amount >= 0),
  shipping_amount INTEGER NOT NULL DEFAULT 0 CHECK (shipping_amount >= 0),
  total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
  items JSONB NOT NULL CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) > 0),
  customer_email TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  shipping_address JSONB,
  stripe_checkout_session_id TEXT,
  stripe_checkout_url TEXT,
  stripe_payment_intent_id TEXT,
  stripe_customer_id TEXT,
  request_fingerprint TEXT,
  admin_email_sent_at TIMESTAMPTZ,
  customer_email_sent_at TIMESTAMPTZ,
  notification_last_error TEXT,
  gelato_status TEXT NOT NULL DEFAULT 'pending',
  gelato_order_id TEXT,
  gelato_order_reference TEXT,
  tracking_url TEXT,
  internal_notes TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_number),
  UNIQUE (reference),
  UNIQUE (checkout_request_id),
  UNIQUE (stripe_checkout_session_id)
);

CREATE INDEX IF NOT EXISTS club_orders_status_created_idx
  ON public.club_orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS club_orders_payment_created_idx
  ON public.club_orders (payment_status, created_at DESC);
CREATE INDEX IF NOT EXISTS club_orders_fingerprint_created_idx
  ON public.club_orders (request_fingerprint, created_at DESC)
  WHERE request_fingerprint IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.club_stripe_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  order_id UUID REFERENCES public.club_orders(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.club_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_stripe_events ENABLE ROW LEVEL SECURITY;

-- No se crean políticas públicas: solo las Edge Functions con service_role
-- pueden leer o modificar los pedidos y sus datos personales.
REVOKE ALL ON public.club_orders FROM anon, authenticated;
REVOKE ALL ON public.club_stripe_events FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_club_order_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS club_orders_set_updated_at ON public.club_orders;
CREATE TRIGGER club_orders_set_updated_at
BEFORE UPDATE ON public.club_orders
FOR EACH ROW EXECUTE FUNCTION public.set_club_order_updated_at();

