-- ================================================================
-- LATIDO.CH - Delayed unread-message email notifications
-- Run this file in Supabase SQL Editor after message_read_status.sql.
-- It is idempotent and does not alter the current push notification flow.
-- ================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.app_presence_sessions (
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id    TEXT NOT NULL,
  active_until  TIMESTAMPTZ NOT NULL,
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_app_presence_active
  ON public.app_presence_sessions (user_id, active_until DESC);

ALTER TABLE public.app_presence_sessions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_presence_sessions TO authenticated;

DROP POLICY IF EXISTS "app_presence_select_own" ON public.app_presence_sessions;
CREATE POLICY "app_presence_select_own"
  ON public.app_presence_sessions
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "app_presence_insert_own" ON public.app_presence_sessions;
CREATE POLICY "app_presence_insert_own"
  ON public.app_presence_sessions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "app_presence_update_own" ON public.app_presence_sessions;
CREATE POLICY "app_presence_update_own"
  ON public.app_presence_sessions
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "app_presence_delete_own" ON public.app_presence_sessions;
CREATE POLICY "app_presence_delete_own"
  ON public.app_presence_sessions
  FOR DELETE
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.upsert_app_presence_session(
  p_session_id TEXT,
  p_active_until TIMESTAMPTZ,
  p_last_seen_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO public.app_presence_sessions (
    user_id,
    session_id,
    active_until,
    last_seen_at
  )
  VALUES (
    auth.uid(),
    p_session_id,
    p_active_until,
    p_last_seen_at
  )
  ON CONFLICT (user_id, session_id)
  DO UPDATE SET
    active_until = EXCLUDED.active_until,
    last_seen_at = EXCLUDED.last_seen_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_app_presence_session(TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

CREATE TABLE IF NOT EXISTS public.email_notification_preferences (
  user_id                 UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_emails_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.email_notification_preferences ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.email_notification_preferences TO authenticated;

DROP POLICY IF EXISTS "email_preferences_select_own" ON public.email_notification_preferences;
CREATE POLICY "email_preferences_select_own"
  ON public.email_notification_preferences
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "email_preferences_insert_own" ON public.email_notification_preferences;
CREATE POLICY "email_preferences_insert_own"
  ON public.email_notification_preferences
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "email_preferences_update_own" ON public.email_notification_preferences;
CREATE POLICY "email_preferences_update_own"
  ON public.email_notification_preferences
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.message_email_notification_state (
  user_id                  UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  status                   TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'sent', 'suppressed')),
  first_unread_message_id  TEXT,
  last_message_id          TEXT,
  first_unread_at          TIMESTAMPTZ NOT NULL,
  due_at                   TIMESTAMPTZ,
  processing_started_at    TIMESTAMPTZ,
  sent_at                  TIMESTAMPTZ,
  attempts                 INTEGER NOT NULL DEFAULT 0,
  last_error               TEXT,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_email_state_due
  ON public.message_email_notification_state (due_at)
  WHERE status = 'pending';

ALTER TABLE public.message_email_notification_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.message_email_notification_state FROM anon, authenticated;
GRANT ALL ON public.message_email_notification_state TO service_role;

CREATE OR REPLACE FUNCTION public.latido_message_recipient(
  p_conversation_id UUID,
  p_sender_id UUID
)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_sender_id = conversation.sender_id THEN conversation.owner_id
    WHEN p_sender_id = conversation.owner_id THEN conversation.sender_id
    ELSE NULL
  END
  FROM public.conversations conversation
  WHERE conversation.id = p_conversation_id;
$$;

CREATE OR REPLACE FUNCTION public.queue_message_email_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_id UUID;
  has_prior_unread BOOLEAN;
  recipient_active BOOLEAN;
  email_enabled BOOLEAN;
  state_exists BOOLEAN;
  first_unread_time TIMESTAMPTZ := COALESCE(NEW.created_at, NOW());
BEGIN
  recipient_id := public.latido_message_recipient(NEW.conversation_id, NEW.sender_id);
  IF recipient_id IS NULL OR recipient_id = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(recipient_id::TEXT, 0));

  SELECT EXISTS (
    SELECT 1
    FROM public.messages message
    JOIN public.conversations conversation
      ON conversation.id = message.conversation_id
    WHERE message.id <> NEW.id
      AND message.read IS DISTINCT FROM TRUE
      AND message.sender_id <> recipient_id
      AND recipient_id IN (conversation.sender_id, conversation.owner_id)
  )
  INTO has_prior_unread;

  SELECT EXISTS (
    SELECT 1
    FROM public.message_email_notification_state state
    WHERE state.user_id = recipient_id
  )
  INTO state_exists;

  IF state_exists AND has_prior_unread THEN
    UPDATE public.message_email_notification_state
    SET
      last_message_id = NEW.id::TEXT,
      updated_at = NOW()
    WHERE user_id = recipient_id;
    RETURN NEW;
  END IF;

  IF state_exists THEN
    DELETE FROM public.message_email_notification_state
    WHERE user_id = recipient_id;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.app_presence_sessions presence
    WHERE presence.user_id = recipient_id
      AND presence.active_until > NOW()
  )
  INTO recipient_active;

  SELECT COALESCE((
    SELECT preference.message_emails_enabled
    FROM public.email_notification_preferences preference
    WHERE preference.user_id = recipient_id
  ), TRUE)
  INTO email_enabled;

  INSERT INTO public.message_email_notification_state (
    user_id,
    status,
    first_unread_message_id,
    last_message_id,
    first_unread_at,
    due_at,
    updated_at
  )
  VALUES (
    recipient_id,
    CASE
      WHEN has_prior_unread OR recipient_active OR NOT email_enabled THEN 'suppressed'
      ELSE 'pending'
    END,
    NEW.id::TEXT,
    NEW.id::TEXT,
    first_unread_time,
    CASE
      WHEN has_prior_unread OR recipient_active OR NOT email_enabled THEN NULL
      ELSE first_unread_time + INTERVAL '10 minutes'
    END,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    last_message_id = EXCLUDED.last_message_id,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS latido_queue_message_email ON public.messages;
CREATE TRIGGER latido_queue_message_email
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_message_email_notification();

CREATE OR REPLACE FUNCTION public.reset_message_email_notification_when_read()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_id UUID;
  still_has_unread BOOLEAN;
BEGIN
  IF OLD.read IS TRUE OR NEW.read IS DISTINCT FROM TRUE THEN
    RETURN NEW;
  END IF;

  recipient_id := public.latido_message_recipient(NEW.conversation_id, NEW.sender_id);
  IF recipient_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(recipient_id::TEXT, 0));

  SELECT EXISTS (
    SELECT 1
    FROM public.messages message
    JOIN public.conversations conversation
      ON conversation.id = message.conversation_id
    WHERE message.read IS DISTINCT FROM TRUE
      AND message.sender_id <> recipient_id
      AND recipient_id IN (conversation.sender_id, conversation.owner_id)
  )
  INTO still_has_unread;

  IF NOT still_has_unread THEN
    DELETE FROM public.message_email_notification_state
    WHERE user_id = recipient_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS latido_reset_message_email_after_read ON public.messages;
CREATE TRIGGER latido_reset_message_email_after_read
  AFTER UPDATE OF read ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_message_email_notification_when_read();

CREATE OR REPLACE FUNCTION public.claim_pending_message_email_notifications(
  p_limit INTEGER DEFAULT 25
)
RETURNS TABLE (
  user_id UUID,
  attempts INTEGER,
  first_unread_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT state.user_id
    FROM public.message_email_notification_state state
    WHERE (
      state.status = 'pending'
      AND state.due_at <= NOW()
    ) OR (
      state.status = 'processing'
      AND state.processing_started_at < NOW() - INTERVAL '5 minutes'
    )
    ORDER BY state.due_at NULLS LAST, state.first_unread_at
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.message_email_notification_state state
    SET
      status = 'processing',
      processing_started_at = NOW(),
      attempts = state.attempts + 1,
      last_error = NULL,
      updated_at = NOW()
    FROM candidates
    WHERE state.user_id = candidates.user_id
    RETURNING state.user_id, state.attempts, state.first_unread_at
  )
  SELECT claimed.user_id, claimed.attempts, claimed.first_unread_at
  FROM claimed;
END;
$$;

CREATE OR REPLACE FUNCTION public.message_email_delivery_context(
  p_user_id UUID
)
RETURNS TABLE (
  profile_email TEXT,
  display_name TEXT,
  unread_count BIGINT,
  latest_conversation_id TEXT,
  app_opened_since_first_unread BOOLEAN,
  email_enabled BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    profile.email,
    COALESCE(NULLIF(BTRIM(profile.name), ''), 'Usuario'),
    (
      SELECT COUNT(*)
      FROM public.messages message
      JOIN public.conversations conversation
        ON conversation.id = message.conversation_id
      WHERE message.read IS DISTINCT FROM TRUE
        AND message.sender_id <> p_user_id
        AND p_user_id IN (conversation.sender_id, conversation.owner_id)
    ),
    (
      SELECT message.conversation_id::TEXT
      FROM public.messages message
      JOIN public.conversations conversation
        ON conversation.id = message.conversation_id
      WHERE message.read IS DISTINCT FROM TRUE
        AND message.sender_id <> p_user_id
        AND p_user_id IN (conversation.sender_id, conversation.owner_id)
      ORDER BY message.created_at DESC
      LIMIT 1
    ),
    EXISTS (
      SELECT 1
      FROM public.app_presence_sessions presence
      JOIN public.message_email_notification_state state
        ON state.user_id = presence.user_id
      WHERE presence.user_id = p_user_id
        AND (
          presence.active_until > NOW()
          OR presence.last_seen_at >= state.first_unread_at
        )
    ),
    COALESCE((
      SELECT preference.message_emails_enabled
      FROM public.email_notification_preferences preference
      WHERE preference.user_id = p_user_id
    ), TRUE)
  FROM public.profiles profile
  WHERE profile.id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.latido_message_recipient(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_pending_message_email_notifications(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.message_email_delivery_context(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.claim_pending_message_email_notifications(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.message_email_delivery_context(UUID) TO service_role;

-- Diagnostics:
-- SELECT * FROM public.message_email_notification_state ORDER BY updated_at DESC;
-- SELECT * FROM public.app_presence_sessions ORDER BY last_seen_at DESC;
-- UPDATE public.message_email_notification_state SET due_at = NOW() WHERE status = 'pending';
