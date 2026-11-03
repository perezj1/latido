-- Explicit historical enrollment requested by the owner.
-- Shows the existing question in eligible chats. No email, push or app alert
-- is queued for this first historical round. Re-running preserves all answers.
BEGIN;
WITH eligible AS (
  SELECT c.id,c.sender_id,coalesce(nullif(trim(c.title),''),'Consulta en Latido') AS title,
    min(m.created_at) AS first_message_at
  FROM public.conversations c
  JOIN public.messages m ON m.conversation_id=c.id AND m.sender_id=c.sender_id
  JOIN public.profiles p ON p.id=c.sender_id
  WHERE c.sender_id IS NOT NULL AND c.owner_id IS DISTINCT FROM c.sender_id
    AND NOT coalesce(c.deleted_by_sender,false) AND NOT coalesce(p.banned,false)
  GROUP BY c.id,c.sender_id,c.title
  HAVING min(m.created_at)<=now()-interval '7 days'
), inserted AS (
  INSERT INTO public.conversation_followups(conversation_id,user_id,title,first_message_at,due_at,token_expires_at,delivery_status)
  SELECT id,sender_id,title,first_message_at,first_message_at+interval '7 days',now()+interval '37 days','skipped'
  FROM eligible
  ON CONFLICT(conversation_id) DO NOTHING
  RETURNING user_id
)
SELECT count(*) AS conversations_added,count(DISTINCT user_id) AS people_added FROM inserted;
COMMIT;
