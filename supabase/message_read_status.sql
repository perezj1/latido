-- Message read receipts for Latido.
-- Run this file in the Supabase SQL Editor.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

UPDATE public.messages
SET read = FALSE
WHERE read IS NULL;

ALTER TABLE public.messages
  ALTER COLUMN read SET DEFAULT FALSE,
  ALTER COLUMN read SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_unread_by_conversation
  ON public.messages (conversation_id, created_at)
  WHERE read = FALSE;

CREATE OR REPLACE FUNCTION public.mark_conversation_messages_read(
  p_conversation_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  updated_count INTEGER := 0;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.conversations conversation
    WHERE conversation.id = p_conversation_id
      AND current_user_id IN (conversation.sender_id, conversation.owner_id)
  ) THEN
    RAISE EXCEPTION 'Conversation access denied' USING ERRCODE = '42501';
  END IF;

  UPDATE public.messages message
  SET
    read = TRUE,
    read_at = COALESCE(message.read_at, NOW())
  WHERE message.conversation_id = p_conversation_id
    AND message.sender_id <> current_user_id
    AND message.read IS DISTINCT FROM TRUE;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_conversation_messages_read(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_conversation_messages_read(UUID) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END
$$;
