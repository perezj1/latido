-- Persistent in-app activity notifications for Latido.
-- Run after creator_platform.sql and message_read_status.sql.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  source_id TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::JSONB,
  seen_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT app_notifications_kind_check CHECK (kind IN (
    'message',
    'creator_follow',
    'creator_helpful',
    'content_helpful',
    'new_creator'
  )),
  CONSTRAINT app_notifications_data_check CHECK (jsonb_typeof(data) = 'object'),
  CONSTRAINT app_notifications_source_unique UNIQUE (recipient_id, kind, source_id)
);

CREATE INDEX IF NOT EXISTS app_notifications_unread_recipient_idx
  ON public.app_notifications (recipient_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_notifications_select_own ON public.app_notifications;
CREATE POLICY app_notifications_select_own ON public.app_notifications
FOR SELECT TO authenticated
USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS app_notifications_update_own ON public.app_notifications;
CREATE POLICY app_notifications_update_own ON public.app_notifications
FOR UPDATE TO authenticated
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());

REVOKE ALL ON public.app_notifications FROM anon, authenticated;
GRANT SELECT, UPDATE ON public.app_notifications TO authenticated;

-- One interaction creates one notification for the owner of the creator.
CREATE OR REPLACE FUNCTION public.sync_creator_interaction_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  interaction public.creator_interactions%ROWTYPE;
  recipient UUID;
  notification_kind TEXT;
  actor_name TEXT;
  creator_name TEXT;
  creator_slug TEXT;
  target_title TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    interaction := OLD;
  ELSE
    interaction := NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.app_notifications
    WHERE source_id = interaction.id::TEXT
      AND kind IN ('creator_follow', 'creator_helpful', 'content_helpful');
    RETURN OLD;
  END IF;

  IF interaction.target_type = 'creator' THEN
    SELECT profile.owner_id, profile.name, profile.slug
      INTO recipient, creator_name, creator_slug
    FROM public.creator_profiles profile
    WHERE profile.id = interaction.target_id;
  ELSE
    SELECT profile.owner_id, profile.name, profile.slug, content.title
      INTO recipient, creator_name, creator_slug, target_title
    FROM public.creator_contents content
    JOIN public.creator_profiles profile ON profile.id = content.creator_id
    WHERE content.id = interaction.target_id;
  END IF;

  IF recipient IS NULL OR recipient = interaction.actor_id THEN
    RETURN NEW;
  END IF;

  SELECT NULLIF(TRIM(profile.name), '')
    INTO actor_name
  FROM public.profiles profile
  WHERE profile.id = interaction.actor_id;

  notification_kind := CASE
    WHEN interaction.action = 'saved' THEN 'creator_follow'
    WHEN interaction.target_type = 'content' THEN 'content_helpful'
    ELSE 'creator_helpful'
  END;

  INSERT INTO public.app_notifications (recipient_id, kind, source_id, data, created_at)
  VALUES (
    recipient,
    notification_kind,
    interaction.id::TEXT,
    jsonb_build_object(
      'actor_id', interaction.actor_id,
      'actor_name', COALESCE(actor_name, 'Alguien'),
      'creator_name', COALESCE(creator_name, ''),
      'target_title', COALESCE(target_title, ''),
      'href', '/creadores/mi-perfil'
    ),
    interaction.created_at
  )
  ON CONFLICT (recipient_id, kind, source_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creator_interactions_sync_notification ON public.creator_interactions;
CREATE TRIGGER creator_interactions_sync_notification
AFTER INSERT OR DELETE ON public.creator_interactions
FOR EACH ROW EXECUTE FUNCTION public.sync_creator_interaction_notification();

-- A profile creates a broadcast only when it becomes visible for the first time.
CREATE OR REPLACE FUNCTION public.sync_new_creator_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  was_visible BOOLEAN := FALSE;
  is_visible BOOLEAN := NEW.active AND NEW.status = 'published';
BEGIN
  IF TG_OP = 'UPDATE' THEN
    was_visible := OLD.active AND OLD.status = 'published';
  END IF;

  IF is_visible AND NOT was_visible THEN
    INSERT INTO public.app_notifications (recipient_id, kind, source_id, data, created_at)
    SELECT
      profile.id,
      'new_creator',
      NEW.id,
      jsonb_build_object(
        'creator_id', NEW.id,
        'creator_name', NEW.name,
        'href', '/comunidades?view=creadores&creatorView=creadores'
      ),
      NOW()
    FROM public.profiles profile
    WHERE profile.id <> NEW.owner_id
    ON CONFLICT (recipient_id, kind, source_id) DO NOTHING;
  ELSIF was_visible AND NOT is_visible THEN
    DELETE FROM public.app_notifications
    WHERE kind = 'new_creator'
      AND source_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creator_profiles_sync_new_creator_notifications ON public.creator_profiles;
CREATE TRIGGER creator_profiles_sync_new_creator_notifications
AFTER INSERT OR UPDATE ON public.creator_profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_new_creator_notifications();

-- Message notifications mirror the existing unread-message state. Reading a
-- conversation also removes its activity from the in-app notification inbox.
CREATE OR REPLACE FUNCTION public.sync_message_app_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  message_row public.messages%ROWTYPE;
  recipient UUID;
  actor_name TEXT;
  conversation_title TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    message_row := OLD;
  ELSE
    message_row := NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.app_notifications
    WHERE kind = 'message' AND source_id = message_row.id::TEXT;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.read IS TRUE AND OLD.read IS DISTINCT FROM TRUE THEN
      UPDATE public.app_notifications
      SET
        seen_at = COALESCE(seen_at, COALESCE(NEW.read_at, NOW())),
        read_at = COALESCE(read_at, COALESCE(NEW.read_at, NOW()))
      WHERE kind = 'message' AND source_id = NEW.id::TEXT;
    END IF;
    RETURN NEW;
  END IF;

  SELECT
    CASE
      WHEN conversation.sender_id = NEW.sender_id THEN conversation.owner_id
      WHEN conversation.owner_id = NEW.sender_id THEN conversation.sender_id
      ELSE NULL
    END,
    conversation.title
  INTO recipient, conversation_title
  FROM public.conversations conversation
  WHERE conversation.id = NEW.conversation_id;

  IF recipient IS NULL OR recipient = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  SELECT NULLIF(TRIM(profile.name), '')
    INTO actor_name
  FROM public.profiles profile
  WHERE profile.id = NEW.sender_id;

  INSERT INTO public.app_notifications (recipient_id, kind, source_id, data, created_at)
  VALUES (
    recipient,
    'message',
    NEW.id::TEXT,
    jsonb_build_object(
      'actor_id', NEW.sender_id,
      'actor_name', COALESCE(actor_name, 'Alguien'),
      'conversation_id', NEW.conversation_id,
      'conversation_title', COALESCE(conversation_title, ''),
      'preview', LEFT(COALESCE(NEW.body, ''), 120)
    ),
    NEW.created_at
  )
  ON CONFLICT (recipient_id, kind, source_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_sync_app_notification ON public.messages;
CREATE TRIGGER messages_sync_app_notification
AFTER INSERT OR UPDATE OF read OR DELETE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.sync_message_app_notification();

-- Preserve unread messages that already existed when this migration is run.
INSERT INTO public.app_notifications (recipient_id, kind, source_id, data, created_at)
SELECT
  CASE
    WHEN conversation.sender_id = message.sender_id THEN conversation.owner_id
    WHEN conversation.owner_id = message.sender_id THEN conversation.sender_id
    ELSE NULL
  END,
  'message',
  message.id::TEXT,
  jsonb_build_object(
    'actor_id', message.sender_id,
    'actor_name', COALESCE(NULLIF(TRIM(profile.name), ''), 'Alguien'),
    'conversation_id', message.conversation_id,
    'conversation_title', COALESCE(conversation.title, ''),
    'preview', LEFT(COALESCE(message.body, ''), 120)
  ),
  message.created_at
FROM public.messages message
JOIN public.conversations conversation ON conversation.id = message.conversation_id
LEFT JOIN public.profiles profile ON profile.id = message.sender_id
WHERE message.read IS DISTINCT FROM TRUE
  AND CASE
    WHEN conversation.sender_id = message.sender_id THEN conversation.owner_id
    WHEN conversation.owner_id = message.sender_id THEN conversation.sender_id
    ELSE NULL
  END IS NOT NULL
ON CONFLICT (recipient_id, kind, source_id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'app_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_notifications;
  END IF;
END
$$;

COMMENT ON TABLE public.app_notifications IS
  'Persistent activity inbox. seen_at prevents session repeats; read_at controls grouping and unread state.';
