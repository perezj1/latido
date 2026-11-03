-- Requires messages, conversations, profiles,
-- app_notifications, email_notification_preferences and account_cooperators.sql.
-- No historical backfill and no cron is enabled by installing this file.
BEGIN;
CREATE TABLE IF NOT EXISTS public.conversation_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL UNIQUE REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  first_message_at timestamptz NOT NULL,
  due_at timestamptz,
  outcome text NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending','not_yet','yes','no')),
  round integer NOT NULL DEFAULT 1 CHECK (round > 0),
  answered_at timestamptz,
  notified_round integer NOT NULL DEFAULT 0,
  email_token text NOT NULL DEFAULT replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','') UNIQUE,
  token_expires_at timestamptz NOT NULL,
  delivery_status text NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending','processing','sent','skipped')),
  processing_at timestamptz,
  retry_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  email_sent_at timestamptz,
  push_sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.conversation_followups DROP CONSTRAINT IF EXISTS conversation_followups_outcome_check;
ALTER TABLE public.conversation_followups ADD CONSTRAINT conversation_followups_outcome_check CHECK (outcome IN ('pending','not_yet','yes','no'));
ALTER TABLE public.conversation_followups ADD COLUMN IF NOT EXISTS no_reason text;
ALTER TABLE public.conversation_followups ADD COLUMN IF NOT EXISTS reason_answered boolean NOT NULL DEFAULT false;
ALTER TABLE public.conversation_followups ADD COLUMN IF NOT EXISTS dismissed_round integer;
ALTER TABLE public.conversation_followups ADD COLUMN IF NOT EXISTS edit_expires_at timestamptz;
ALTER TABLE public.conversation_followups ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
DROP INDEX IF EXISTS public.conversation_followups_due_idx;
CREATE INDEX conversation_followups_due_idx ON public.conversation_followups(due_at)
  WHERE outcome IN ('pending','not_yet');
CREATE TABLE IF NOT EXISTS public.conversation_followup_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  followup_id uuid NOT NULL REFERENCES public.conversation_followups(id) ON DELETE CASCADE,
  round integer NOT NULL,
  answer text NOT NULL CHECK (answer IN ('yes','not_yet','no')),
  channel text NOT NULL CHECK (channel IN ('chat','email')),
  answered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(followup_id, round)
);
ALTER TABLE public.conversation_followup_answers DROP CONSTRAINT IF EXISTS conversation_followup_answers_answer_check;
ALTER TABLE public.conversation_followup_answers ADD CONSTRAINT conversation_followup_answers_answer_check CHECK (answer IN ('yes','not_yet','no'));
ALTER TABLE public.conversation_followup_answers ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE public.conversation_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_followup_answers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.conversation_followups, public.conversation_followup_answers FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.conversation_followups, public.conversation_followup_answers TO service_role;

DO $$
DECLARE expression text;
BEGIN
  SELECT pg_get_expr(conbin,conrelid) INTO expression FROM pg_constraint
  WHERE conrelid='public.app_notifications'::regclass AND conname='app_notifications_kind_check';
  IF expression IS NOT NULL AND position('conversation_followup' IN expression)=0 THEN
    ALTER TABLE public.app_notifications DROP CONSTRAINT app_notifications_kind_check;
    EXECUTE 'ALTER TABLE public.app_notifications ADD CONSTRAINT app_notifications_kind_check CHECK (kind=''conversation_followup'' OR ('||expression||'))';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.cf_safe_state(f public.conversation_followups)
RETURNS jsonb LANGUAGE sql STABLE SET search_path=public AS $$
  SELECT jsonb_build_object('id', f.id, 'conversation_id', f.conversation_id, 'title', f.title,
    'round', f.round, 'outcome', f.outcome, 'due_at', f.due_at, 'answered_at', f.answered_at,
    'due', f.outcome IN ('pending','not_yet') AND f.due_at <= now(),
    'contact_name',coalesce((SELECT nullif(trim(c.owner_name),'') FROM public.conversations c WHERE c.id=f.conversation_id),'este contacto'),
    'no_reason',f.no_reason,'reason_answered',f.reason_answered,
    'dismissed',coalesce(f.dismissed_round=f.round,false) AND NOT coalesce(f.outcome='not_yet' AND f.due_at<=now(),false))
$$;
REVOKE ALL ON FUNCTION public.cf_safe_state(public.conversation_followups) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.cf_queue_first_message() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE c public.conversations;
BEGIN
  SELECT * INTO c FROM public.conversations WHERE id=NEW.conversation_id;
  IF c.sender_id IS NULL OR c.sender_id=c.owner_id OR NEW.sender_id<>c.sender_id
    OR coalesce(c.deleted_by_sender,false) OR nullif(trim(c.title),'') IS NULL THEN RETURN NEW; END IF;
  -- A message in an old thread must not launch an unsolicited historical campaign.
  IF EXISTS(SELECT 1 FROM public.messages m WHERE m.conversation_id=c.id AND m.id<>NEW.id AND m.sender_id=c.sender_id) THEN RETURN NEW; END IF;
  INSERT INTO public.conversation_followups(conversation_id,user_id,title,first_message_at,due_at,token_expires_at)
  VALUES(c.id,c.sender_id,c.title,NEW.created_at,NEW.created_at+interval '7 days',NEW.created_at+interval '37 days')
  ON CONFLICT(conversation_id) DO NOTHING;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.cf_queue_first_message() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS conversation_followup_first_message ON public.messages;
CREATE TRIGGER conversation_followup_first_message AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.cf_queue_first_message();

CREATE OR REPLACE FUNCTION public.cf_get(p_conversation uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f public.conversation_followups;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  SELECT q.* INTO f FROM public.conversation_followups q JOIN public.conversations c ON c.id=q.conversation_id
  WHERE q.conversation_id=p_conversation AND q.user_id=public.latido_account_id()
    AND c.sender_id=q.user_id AND NOT coalesce(c.deleted_by_sender,false)
    AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=q.user_id AND p.banned);
  IF NOT FOUND OR (f.outcome='pending' AND f.due_at>now()) THEN RETURN NULL; END IF;
  RETURN public.cf_safe_state(f);
END $$;

CREATE OR REPLACE FUNCTION public.cf_apply_answer(p_id uuid,p_round integer,p_answer text,p_channel text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE f public.conversation_followups;
BEGIN
  IF p_answer IS NULL OR p_answer NOT IN ('yes','not_yet','no') OR p_channel NOT IN ('chat','email') THEN RAISE EXCEPTION 'INVALID_ANSWER'; END IF;
  SELECT * INTO f FROM public.conversation_followups WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FOLLOWUP_NOT_FOUND'; END IF;
  IF p_round IS DISTINCT FROM f.round THEN RAISE EXCEPTION 'FOLLOWUP_CHANGED'; END IF;
  IF f.outcome=p_answer AND NOT coalesce(f.due_at<=now(),false) THEN RETURN public.cf_safe_state(f); END IF;
  IF f.due_at>now() AND NOT (f.outcome='not_yet' AND p_answer IN ('yes','no')) THEN RAISE EXCEPTION 'FOLLOWUP_NOT_DUE'; END IF;
  INSERT INTO public.conversation_followup_answers(followup_id,round,answer,channel) VALUES(f.id,f.round,p_answer,p_channel);
  UPDATE public.app_notifications SET read_at=coalesce(read_at,now()),seen_at=coalesce(seen_at,now())
  WHERE recipient_id=f.user_id AND kind='conversation_followup' AND source_id=f.id::text||':'||f.round::text;
  UPDATE public.conversation_followups SET outcome=p_answer, answered_at=now(),
    due_at=CASE WHEN p_answer='not_yet' THEN now()+interval '7 days' ELSE NULL END,
    round=round+1, email_token=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''),token_expires_at=now()+interval '37 days',
    delivery_status=CASE WHEN p_answer IN ('yes','no') THEN 'skipped' ELSE 'pending' END,
    processing_at=NULL,retry_at=NULL,attempts=0,email_sent_at=NULL,push_sent_at=NULL,last_error=NULL
    ,no_reason=NULL,reason_answered=false,dismissed_round=NULL,edit_expires_at=now()+interval '30 minutes'
  WHERE id=f.id RETURNING * INTO f;
  RETURN public.cf_safe_state(f);
END $$;

CREATE OR REPLACE FUNCTION public.cf_answer(p_conversation uuid,p_round integer,p_answer text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f public.conversation_followups;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  SELECT q.* INTO f FROM public.conversation_followups q JOIN public.conversations c ON c.id=q.conversation_id
  WHERE q.conversation_id=p_conversation AND q.user_id=public.latido_account_id() AND c.sender_id=q.user_id
    AND NOT coalesce(c.deleted_by_sender,false)
    AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=q.user_id AND p.banned) FOR UPDATE OF q;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  RETURN public.cf_apply_answer(f.id,p_round,p_answer,'chat');
END $$;

CREATE OR REPLACE FUNCTION public.cf_email_context(p_token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f public.conversation_followups;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'LINK_UNAVAILABLE'; END IF;
  SELECT q.* INTO f FROM public.conversation_followups q JOIN public.conversations c ON c.id=q.conversation_id
  WHERE q.email_token=p_token AND q.token_expires_at>now() AND q.due_at<=now() AND q.outcome IN ('pending','not_yet')
    AND NOT coalesce(c.deleted_by_sender,false) AND c.sender_id=q.user_id
    AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=q.user_id AND p.banned);
  IF NOT FOUND THEN RAISE EXCEPTION 'LINK_UNAVAILABLE'; END IF;
  RETURN public.cf_safe_state(f);
END $$;
CREATE OR REPLACE FUNCTION public.cf_answer_email(p_token text,p_answer text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE context jsonb; f public.conversation_followups;
BEGIN
  context:=public.cf_email_context(p_token);
  SELECT * INTO f FROM public.conversation_followups WHERE id=(context->>'id')::uuid FOR UPDATE;
  IF f.email_token IS DISTINCT FROM p_token THEN RAISE EXCEPTION 'LINK_UNAVAILABLE'; END IF;
  context:=public.cf_apply_answer(f.id,f.round,p_answer,'email');
  SELECT * INTO f FROM public.conversation_followups WHERE id=f.id;
  RETURN context||jsonb_build_object('edit_token',f.email_token);
END $$;

-- Closing a card only hides the acknowledgment. It never cancels a scheduled
-- "in progress" reminder. Changing the answer is recorded as another version.
CREATE OR REPLACE FUNCTION public.cf_apply_feedback(p_id uuid,p_round integer,p_action text,p_value text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f public.conversation_followups;
BEGIN
  SELECT * INTO f FROM public.conversation_followups WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR f.round IS DISTINCT FROM p_round THEN RAISE EXCEPTION 'FOLLOWUP_CHANGED'; END IF;
  IF p_action='reason' THEN
    IF f.outcome<>'no' OR (p_value IS NOT NULL AND p_value NOT IN ('not_replied','not_match','no_agreement','other')) THEN RAISE EXCEPTION 'INVALID_REASON'; END IF;
    UPDATE public.conversation_followups SET no_reason=p_value,reason_answered=true WHERE id=f.id RETURNING * INTO f;
    UPDATE public.conversation_followup_answers SET reason=p_value WHERE followup_id=f.id AND round=f.round-1;
  ELSIF p_action='dismiss' THEN
    IF f.outcome='pending' OR (f.outcome='not_yet' AND f.due_at<=now()) THEN RAISE EXCEPTION 'INVALID_DISMISS'; END IF;
    UPDATE public.conversation_followups SET dismissed_round=round WHERE id=f.id RETURNING * INTO f;
  ELSE RAISE EXCEPTION 'INVALID_ACTION'; END IF;
  RETURN public.cf_safe_state(f);
END $$;
CREATE OR REPLACE FUNCTION public.cf_feedback(p_conversation uuid,p_round integer,p_action text,p_value text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE context jsonb;
BEGIN
  context:=public.cf_get(p_conversation);
  IF context IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  RETURN public.cf_apply_feedback((context->>'id')::uuid,p_round,p_action,p_value);
END $$;
CREATE OR REPLACE FUNCTION public.cf_email_change(p_token text,p_round integer,p_action text,p_value text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f public.conversation_followups; result jsonb;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'LINK_UNAVAILABLE'; END IF;
  SELECT q.* INTO f FROM public.conversation_followups q JOIN public.conversations c ON c.id=q.conversation_id
  WHERE q.email_token=p_token AND q.edit_expires_at>now() AND c.sender_id=q.user_id
    AND NOT coalesce(c.deleted_by_sender,false)
    AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=q.user_id AND p.banned) FOR UPDATE OF q;
  IF NOT FOUND THEN RAISE EXCEPTION 'LINK_UNAVAILABLE'; END IF;
  IF p_action='answer' THEN result:=public.cf_apply_answer(f.id,p_round,p_value,'email');
  ELSE result:=public.cf_apply_feedback(f.id,p_round,p_action,p_value); END IF;
  SELECT * INTO f FROM public.conversation_followups WHERE id=f.id;
  RETURN result||jsonb_build_object('edit_token',f.email_token);
END $$;

CREATE OR REPLACE FUNCTION public.cf_claim_due(p_limit integer DEFAULT 25) RETURNS SETOF jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f public.conversation_followups; c public.conversations; email_enabled boolean;
BEGIN
  FOR f IN SELECT q.* FROM public.conversation_followups q JOIN public.conversations conv ON conv.id=q.conversation_id
    WHERE NOT q.is_test AND q.outcome IN ('pending','not_yet') AND q.due_at<=now() AND q.token_expires_at>now()
    AND (q.delivery_status='pending' OR (q.delivery_status='processing' AND q.processing_at<now()-interval '10 minutes'))
    AND (q.retry_at IS NULL OR q.retry_at<=now()) AND NOT coalesce(conv.deleted_by_sender,false)
    AND conv.sender_id=q.user_id AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=q.user_id AND p.banned)
    ORDER BY q.due_at,q.id LIMIT greatest(1,least(coalesce(p_limit,25),100)) FOR UPDATE OF q SKIP LOCKED
  LOOP
    INSERT INTO public.app_notifications(recipient_id,kind,source_id,data)
    VALUES(f.user_id,'conversation_followup',f.id::text||':'||f.round::text,
      jsonb_build_object('conversation_id',f.conversation_id,'title',f.title,'href','/mensajes?conv='||f.conversation_id::text))
    ON CONFLICT(recipient_id,kind,source_id) DO NOTHING;
    UPDATE public.conversation_followups SET delivery_status='processing',processing_at=now(),attempts=attempts+1,notified_round=round
    WHERE id=f.id RETURNING * INTO f;
    SELECT coalesce(p.message_emails_enabled,true) INTO email_enabled FROM public.email_notification_preferences p WHERE p.user_id=f.user_id;
    RETURN NEXT jsonb_build_object('id',f.id,'user_id',f.user_id,'conversation_id',f.conversation_id,'title',f.title,
      'round',f.round,'token',f.email_token,'attempts',f.attempts,'email_enabled',coalesce(email_enabled,true),
      'email_sent_at',f.email_sent_at,'push_sent_at',f.push_sent_at);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.cf_admin_report(p_outcome text DEFAULT 'all',p_page integer DEFAULT 1) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_business_promotion_admin() THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF p_outcome IS NULL OR p_outcome NOT IN ('all','pending','not_yet','yes','no','test') THEN RAISE EXCEPTION 'INVALID_FILTER'; END IF;
  WITH records AS (SELECT f.*,p.name,p.email,c.owner_name FROM public.conversation_followups f
    JOIN public.profiles p ON p.id=f.user_id JOIN public.conversations c ON c.id=f.conversation_id
  ), filtered AS (SELECT * FROM records WHERE CASE WHEN p_outcome='test' THEN is_test ELSE NOT is_test AND (p_outcome='all' OR outcome=p_outcome) END), paged AS (
    SELECT * FROM filtered ORDER BY coalesce(answered_at,first_message_at) DESC,id LIMIT 25 OFFSET (greatest(1,least(coalesce(p_page,1),100000))-1)*25
  ) SELECT jsonb_build_object('total',(SELECT count(*) FROM filtered),
    'summary',(SELECT jsonb_build_object('total',count(*),'pending',count(*) FILTER(WHERE outcome='pending'),
      'yes',count(*) FILTER(WHERE outcome='yes'),'not_yet',count(*) FILTER(WHERE outcome='not_yet'),'no',count(*) FILTER(WHERE outcome='no')) FROM records WHERE NOT is_test),
    'test_count',(SELECT count(*) FROM records WHERE is_test),
    'rows',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'conversation_id',conversation_id,'title',title,'name',name,'email',email,
      'owner_name',owner_name,'outcome',outcome,'answered_at',answered_at,'due_at',due_at,'no_reason',no_reason,
      'first_message_at',first_message_at,'is_test',is_test,'delivery_status',delivery_status,'email_sent_at',email_sent_at,'push_sent_at',push_sent_at,'delivery_error',last_error IS NOT NULL,
      'history',coalesce((SELECT jsonb_agg(h ORDER BY h.answered_at DESC,h.round DESC) FROM
        (SELECT a.round,a.answer,a.channel,a.reason,a.answered_at FROM public.conversation_followup_answers a WHERE a.followup_id=paged.id ORDER BY a.answered_at DESC,a.round DESC LIMIT 10) h),'[]'::jsonb),
      'last_channel',(SELECT channel FROM public.conversation_followup_answers a WHERE a.followup_id=paged.id ORDER BY a.answered_at DESC,a.round DESC LIMIT 1)) ORDER BY coalesce(answered_at,first_message_at) DESC,id) FROM paged),'[]'::jsonb)) INTO result;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.cf_get(uuid),public.cf_answer(uuid,integer,text),public.cf_admin_report(text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cf_get(uuid),public.cf_answer(uuid,integer,text),public.cf_admin_report(text,integer) TO authenticated;
REVOKE ALL ON FUNCTION public.cf_apply_answer(uuid,integer,text,text),public.cf_email_context(text),public.cf_answer_email(text,text),public.cf_claim_due(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cf_email_context(text),public.cf_answer_email(text,text),public.cf_claim_due(integer) TO service_role;
REVOKE ALL ON FUNCTION public.cf_apply_feedback(uuid,integer,text,text),public.cf_email_change(text,integer,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cf_email_change(text,integer,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.cf_feedback(uuid,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cf_feedback(uuid,integer,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
