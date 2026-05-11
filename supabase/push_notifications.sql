-- ================================================================
-- LATIDO.CH - Push notifications schema
-- Ejecuta este archivo en Supabase SQL Editor.
-- Es idempotente y seguro para proyectos existentes.
-- ================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint        TEXT NOT NULL UNIQUE,
  p256dh          TEXT NOT NULL,
  auth            TEXT NOT NULL,
  expiration_time TIMESTAMPTZ,
  origin          TEXT,
  user_agent      TEXT,
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at    TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_enabled
  ON public.push_subscriptions(user_id, enabled);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_updated_at
  ON public.push_subscriptions(updated_at DESC);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subscriptions_select_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_select_own"
  ON public.push_subscriptions
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "push_subscriptions_insert_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_insert_own"
  ON public.push_subscriptions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "push_subscriptions_update_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_update_own"
  ON public.push_subscriptions
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "push_subscriptions_delete_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_delete_own"
  ON public.push_subscriptions
  FOR DELETE
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.push_notification_preferences (
  user_id          UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  messages_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  zone_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  canton           TEXT,
  categories       TEXT[] NOT NULL DEFAULT '{}'::text[],
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_preferences_zone
  ON public.push_notification_preferences(zone_enabled, canton);

ALTER TABLE public.push_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_preferences_select_own" ON public.push_notification_preferences;
CREATE POLICY "push_preferences_select_own"
  ON public.push_notification_preferences
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "push_preferences_insert_own" ON public.push_notification_preferences;
CREATE POLICY "push_preferences_insert_own"
  ON public.push_notification_preferences
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "push_preferences_update_own" ON public.push_notification_preferences;
CREATE POLICY "push_preferences_update_own"
  ON public.push_notification_preferences
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Diagnóstico rápido:
-- SELECT user_id, enabled, origin, updated_at FROM public.push_subscriptions ORDER BY updated_at DESC LIMIT 20;
-- SELECT * FROM public.push_notification_preferences ORDER BY updated_at DESC LIMIT 20;
