-- Separate logins can operate an account without deletion rights.
-- Memberships are provisioned by the server only. Existing owners keep their permissions.
BEGIN;

CREATE TABLE IF NOT EXISTS public.account_cooperators (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_id <> account_id)
);
ALTER TABLE public.account_cooperators ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_cooperators FROM anon, authenticated;
GRANT SELECT ON public.account_cooperators TO authenticated;
GRANT ALL ON public.account_cooperators TO service_role;
DROP POLICY IF EXISTS account_cooperators_read_self ON public.account_cooperators;
CREATE POLICY account_cooperators_read_self ON public.account_cooperators FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR account_id = auth.uid());

CREATE OR REPLACE FUNCTION public.latido_is_cooperator() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.account_cooperators WHERE user_id = auth.uid() AND active);
$$;
CREATE OR REPLACE FUNCTION public.latido_account_id() RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT membership.account_id FROM public.account_cooperators membership
    WHERE membership.user_id = auth.uid() AND membership.active
      AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id IN (auth.uid(),membership.account_id) AND p.banned)), auth.uid());
$$;
CREATE OR REPLACE FUNCTION public.get_my_account_access() RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE membership public.account_cooperators; profile public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  SELECT * INTO membership FROM public.account_cooperators WHERE user_id = auth.uid() AND active;
  IF NOT FOUND THEN RETURN jsonb_build_object('role', 'owner', 'account_id', auth.uid()); END IF;
  SELECT * INTO STRICT profile FROM public.profiles WHERE id = membership.account_id;
  IF profile.banned OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND banned) THEN
    RAISE EXCEPTION 'ACCOUNT_UNAVAILABLE' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object('role', 'cooperator', 'account_id', membership.account_id,
    'name', profile.name, 'canton', profile.canton, 'avatar_url', profile.avatar_url, 'can_delete', FALSE);
END;
$$;
REVOKE ALL ON FUNCTION public.latido_is_cooperator(), public.latido_account_id(), public.get_my_account_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.latido_is_cooperator(), public.latido_account_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_account_access() TO authenticated;

-- Additional permissions are limited to the delegated account, never to third-party records.
DO $$
DECLARE item RECORD; operation TEXT; predicate TEXT;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('listings', 'user_id'), ('ads', 'user_id'), ('jobs', 'user_id'),
    ('events', 'user_id'), ('providers', 'user_id'), ('communities', 'user_id'),
    ('forum_posts', 'user_id'), ('reviews', 'user_id'), ('listing_reviews', 'user_id'),
    ('saved_searches', 'user_id'), ('push_subscriptions', 'user_id'),
    ('push_notification_preferences', 'user_id'), ('email_notification_preferences', 'user_id'),
    ('business_lead_alert_settings', 'user_id'), ('app_notifications', 'recipient_id'),
    ('analytics_events', 'user_id')
  ) AS allowed(table_name, owner_column)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name=item.table_name AND column_name=item.owner_column) THEN CONTINUE; END IF;
    predicate := format('(SELECT public.latido_is_cooperator()) AND %I = (SELECT public.latido_account_id())', item.owner_column);
    FOREACH operation IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE'] LOOP
      -- Analytics are write-only for ordinary accounts; notifications are server-created.
      IF item.table_name='analytics_events' AND operation <> 'INSERT' THEN CONTINUE; END IF;
      IF item.table_name='app_notifications' AND operation='INSERT' THEN CONTINUE; END IF;
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'cooperator_' || lower(operation), item.table_name);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR %s TO authenticated %s %s',
        'cooperator_' || lower(operation), item.table_name, operation,
        CASE WHEN operation <> 'INSERT' THEN 'USING (' || predicate || ')' ELSE '' END,
        CASE WHEN operation <> 'SELECT' THEN 'WITH CHECK (' || predicate || ')' ELSE '' END);
    END LOOP;
    EXECUTE format('DROP POLICY IF EXISTS cooperator_insert_scope ON public.%I', item.table_name);
    EXECUTE format('CREATE POLICY cooperator_insert_scope ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT (SELECT public.latido_is_cooperator()) OR %I = (SELECT public.latido_account_id()))', item.table_name,item.owner_column);
  END LOOP;
END;
$$;

DO $$
DECLARE operation TEXT; predicate TEXT;
BEGIN
  IF to_regclass('public.provider_photos') IS NOT NULL THEN
    predicate := '(SELECT public.latido_is_cooperator()) AND EXISTS (SELECT 1 FROM public.providers p WHERE p.id=provider_id AND p.user_id=(SELECT public.latido_account_id()))';
    FOREACH operation IN ARRAY ARRAY['SELECT','INSERT','UPDATE'] LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.provider_photos','cooperator_' || lower(operation));
      EXECUTE format('CREATE POLICY %I ON public.provider_photos FOR %s TO authenticated %s %s',
        'cooperator_' || lower(operation),operation,
        CASE WHEN operation<>'INSERT' THEN 'USING (' || predicate || ')' ELSE '' END,
        CASE WHEN operation<>'SELECT' THEN 'WITH CHECK (' || predicate || ')' ELSE '' END);
    END LOOP;
  END IF;
END;
$$;

DROP POLICY IF EXISTS cooperator_read_account_profile ON public.profiles;
CREATE POLICY cooperator_read_account_profile ON public.profiles FOR SELECT TO authenticated
  USING ((SELECT public.latido_is_cooperator()) AND id = (SELECT public.latido_account_id()));

DROP POLICY IF EXISTS cooperator_conversations_read ON public.conversations;
CREATE POLICY cooperator_conversations_read ON public.conversations FOR SELECT TO authenticated
  USING ((SELECT public.latido_is_cooperator()) AND (SELECT public.latido_account_id()) IN (sender_id, owner_id));
DROP POLICY IF EXISTS cooperator_conversations_insert ON public.conversations;
CREATE POLICY cooperator_conversations_insert ON public.conversations FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.latido_is_cooperator()) AND sender_id = (SELECT public.latido_account_id()));
DROP POLICY IF EXISTS cooperator_conversations_update ON public.conversations;
CREATE POLICY cooperator_conversations_update ON public.conversations FOR UPDATE TO authenticated
  USING ((SELECT public.latido_is_cooperator()) AND (SELECT public.latido_account_id()) IN (sender_id, owner_id))
  WITH CHECK ((SELECT public.latido_is_cooperator()) AND (SELECT public.latido_account_id()) IN (sender_id, owner_id));
DROP POLICY IF EXISTS cooperator_messages_read ON public.messages;
CREATE POLICY cooperator_messages_read ON public.messages FOR SELECT TO authenticated
  USING ((SELECT public.latido_is_cooperator()) AND EXISTS (SELECT 1 FROM public.conversations c
    WHERE c.id=conversation_id AND (SELECT public.latido_account_id()) IN (c.sender_id,c.owner_id)));
DROP POLICY IF EXISTS cooperator_messages_insert ON public.messages;
CREATE POLICY cooperator_messages_insert ON public.messages FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.latido_is_cooperator()) AND sender_id=(SELECT public.latido_account_id())
    AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id=conversation_id
      AND (SELECT public.latido_account_id()) IN (c.sender_id,c.owner_id)));

-- The trigger also applies to SECURITY DEFINER RPCs, which can bypass row policies.
CREATE OR REPLACE FUNCTION public.guard_cooperator_mutation() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE previous JSONB; updated JSONB; field TEXT;
BEGIN
  IF NOT public.latido_is_cooperator() THEN
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  -- Reading a message clears its internal email delivery queue, never the message itself.
  -- Only a nested server trigger may perform that cleanup; direct requests remain blocked.
  IF TG_OP='DELETE' AND TG_TABLE_SCHEMA='public' AND TG_TABLE_NAME='message_email_notification_state'
    AND pg_trigger_depth()>1 THEN RETURN OLD; END IF;
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'COOPERATOR_CANNOT_DELETE' USING ERRCODE='42501'; END IF;
  previous := to_jsonb(OLD); updated := to_jsonb(NEW);
  IF TG_TABLE_SCHEMA <> 'public' OR TG_TABLE_NAME='account_cooperators' THEN
    RAISE EXCEPTION 'COOPERATOR_CANNOT_CHANGE_ACCESS_OR_FILES' USING ERRCODE='42501';
  END IF;
  IF TG_TABLE_NAME='profiles' AND previous->>'id' IS DISTINCT FROM auth.uid()::TEXT THEN
    RAISE EXCEPTION 'COOPERATOR_CANNOT_CHANGE_ACCOUNT' USING ERRCODE='42501';
  END IF;
  IF TG_TABLE_NAME='messages' AND (previous - ARRAY['read','read_at']) IS DISTINCT FROM (updated - ARRAY['read','read_at']) THEN
    RAISE EXCEPTION 'COOPERATOR_CANNOT_EDIT_MESSAGES' USING ERRCODE='42501';
  END IF;
  FOREACH field IN ARRAY ARRAY['id','user_id','owner_id','sender_id','recipient_id','creator_id','conversation_id','provider_id'] LOOP
    IF previous->field IS DISTINCT FROM updated->field THEN
      RAISE EXCEPTION 'COOPERATOR_CANNOT_TRANSFER_RECORDS' USING ERRCODE='42501';
    END IF;
  END LOOP;
  FOREACH field IN ARRAY ARRAY['deleted_at','archived_at','removed_at','reversed_at','is_deleted'] LOOP
    IF previous->field IS DISTINCT FROM updated->field THEN
      RAISE EXCEPTION 'COOPERATOR_CANNOT_DELETE' USING ERRCODE='42501';
    END IF;
  END LOOP;
  FOREACH field IN ARRAY ARRAY['deleted_by_sender','deleted_by_owner'] LOOP
    IF updated->field='true'::jsonb AND previous->field IS DISTINCT FROM updated->field THEN
      RAISE EXCEPTION 'COOPERATOR_CANNOT_HIDE_CONVERSATIONS' USING ERRCODE='42501';
    END IF;
  END LOOP;
  IF (previous->>'active'='true' AND updated->>'active'='false')
    OR (previous->>'status'='published' AND updated->>'status'<>'published')
    OR (updated->>'lifecycle_status'='resolved' AND previous->>'lifecycle_status' IS DISTINCT FROM 'resolved') THEN
    RAISE EXCEPTION 'COOPERATOR_CANNOT_UNPUBLISH' USING ERRCODE='42501';
  END IF;
  FOREACH field IN ARRAY ARRAY['img_url','photo_url','avatar_url','logo_url','partner_logo_url','thumbnail_url'] LOOP
    IF coalesce(previous->>field,'')<>'' AND coalesce(updated->>field,'')='' THEN
      RAISE EXCEPTION 'COOPERATOR_CANNOT_REMOVE_IMAGES' USING ERRCODE='42501';
    END IF;
  END LOOP;
  IF jsonb_typeof(previous->'photo_urls')='array' AND NOT coalesce(updated->'photo_urls','[]'::jsonb) @> (previous->'photo_urls') THEN
    RAISE EXCEPTION 'COOPERATOR_CANNOT_REMOVE_IMAGES' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_cooperator_mutation() FROM PUBLIC;

DO $$
DECLARE item RECORD;
BEGIN
  FOR item IN SELECT schemaname,tablename FROM pg_tables
    WHERE schemaname='public' OR (schemaname='storage' AND tablename='objects') OR (schemaname='auth' AND tablename='users')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS aaa_cooperator_guard ON %I.%I', item.schemaname,item.tablename);
    EXECUTE format('CREATE TRIGGER aaa_cooperator_guard BEFORE DELETE OR UPDATE ON %I.%I FOR EACH ROW EXECUTE FUNCTION public.guard_cooperator_mutation()', item.schemaname,item.tablename);
    IF item.schemaname <> 'auth' THEN
      EXECUTE format('DROP POLICY IF EXISTS cooperator_no_delete ON %I.%I', item.schemaname,item.tablename);
      EXECUTE format('CREATE POLICY cooperator_no_delete ON %I.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT (SELECT public.latido_is_cooperator()))', item.schemaname,item.tablename);
    END IF;
  END LOOP;
END;
$$;

-- Upload new publication images under the account. Existing files cannot be overwritten or deleted.
DROP POLICY IF EXISTS cooperator_publication_upload ON storage.objects;
CREATE POLICY cooperator_publication_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.latido_is_cooperator()) AND bucket_id='publication-images'
    AND (storage.foldername(name))[1]=(SELECT public.latido_account_id())::TEXT);

CREATE OR REPLACE FUNCTION public.mark_conversation_messages_read(p_conversation_id UUID) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE account UUID := public.latido_account_id(); updated_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversations WHERE id=p_conversation_id AND account IN (sender_id,owner_id)) THEN
    RAISE EXCEPTION 'Conversation access denied' USING ERRCODE='42501';
  END IF;
  UPDATE public.messages SET read=TRUE,read_at=coalesce(read_at,now())
    WHERE conversation_id=p_conversation_id AND sender_id<>account AND read IS DISTINCT FROM TRUE;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Adapt only ownership checks in these existing APIs; their other validation stays intact.
DO $$
DECLARE item RECORD; definition TEXT;
BEGIN
  FOR item IN SELECT oid,proname FROM pg_proc WHERE pronamespace='public'::regnamespace
    AND proname IN ('can_manage_creator','lc_can_manage','lc_business_dashboard')
  LOOP
    definition := pg_get_functiondef(item.oid);
    IF item.proname='can_manage_creator' THEN
      definition := replace(definition,'profile.owner_id = auth.uid()', 'profile.owner_id = public.latido_account_id()');
    ELSE
      definition := replace(definition,'p.user_id=auth.uid()', 'p.user_id=public.latido_account_id()');
    END IF;
    EXECUTE definition;
  END LOOP;
END;
$$;
NOTIFY pgrst, 'reload schema';
COMMIT;
