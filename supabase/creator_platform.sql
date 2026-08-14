-- Creator profiles and content shared by every Latido client.
-- Safe to run more than once in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.creator_profiles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  owner_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT NOT NULL DEFAULT '',
  handle TEXT NOT NULL,
  tagline TEXT NOT NULL,
  bio TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  canton TEXT NOT NULL DEFAULT '',
  reach TEXT NOT NULL DEFAULT 'Toda Suiza',
  topics TEXT[] NOT NULL DEFAULT '{}',
  socials JSONB NOT NULL DEFAULT '[]'::JSONB,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'published',
  review_status TEXT NOT NULL DEFAULT 'pending',
  accent TEXT NOT NULL DEFAULT '#2563EB',
  featured_content_ids TEXT[] NOT NULL DEFAULT '{}',
  selection_updated_at TIMESTAMPTZ,
  helpful_count INTEGER NOT NULL DEFAULT 0 CHECK (helpful_count >= 0),
  saved_count INTEGER NOT NULL DEFAULT 0 CHECK (saved_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT creator_profiles_status_check CHECK (status IN ('draft', 'published')),
  CONSTRAINT creator_profiles_review_status_check CHECK (review_status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT creator_profiles_topics_limit CHECK (
    cardinality(topics) BETWEEN 1 AND 4
    AND topics <@ ARRAY['tramites', 'trabajo', 'negocios', 'vivienda', 'familia', 'dinero', 'planes', 'gastronomia', 'integracion']::TEXT[]
  ),
  CONSTRAINT creator_profiles_socials_check CHECK (jsonb_typeof(socials) = 'array' AND jsonb_array_length(socials) BETWEEN 1 AND 7),
  CONSTRAINT creator_profiles_slug_format CHECK (slug ~ '^([a-z0-9]+-)*[a-z0-9]+$'),
  CONSTRAINT creator_profiles_name_length CHECK (char_length(name) BETWEEN 2 AND 60),
  CONSTRAINT creator_profiles_tagline_length CHECK (char_length(tagline) BETWEEN 20 AND 120),
  CONSTRAINT creator_profiles_bio_length CHECK (char_length(bio) BETWEEN 80 AND 600),
  CONSTRAINT creator_profiles_handle_format CHECK (handle ~ '^@[a-z0-9._-]{3,}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS creator_profiles_slug_unique
  ON public.creator_profiles (LOWER(slug));
CREATE UNIQUE INDEX IF NOT EXISTS creator_profiles_handle_unique
  ON public.creator_profiles (LOWER(handle));
CREATE INDEX IF NOT EXISTS creator_profiles_directory_idx
  ON public.creator_profiles (status, active, updated_at DESC);
CREATE INDEX IF NOT EXISTS creator_profiles_topics_idx
  ON public.creator_profiles USING GIN (topics);

CREATE TABLE IF NOT EXISTS public.creator_contents (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  creator_id TEXT NOT NULL REFERENCES public.creator_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  url TEXT NOT NULL,
  platform TEXT NOT NULL,
  video_id TEXT NOT NULL DEFAULT '',
  resolved_url TEXT NOT NULL DEFAULT '',
  embed_url TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT 'video',
  topic TEXT NOT NULL,
  canton TEXT NOT NULL DEFAULT 'Toda Suiza',
  duration TEXT NOT NULL DEFAULT '',
  thumbnail_url TEXT NOT NULL DEFAULT '',
  thumbnail_kind TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'published',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  helpful_count INTEGER NOT NULL DEFAULT 0 CHECK (helpful_count >= 0),
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT creator_contents_status_check CHECK (status IN ('draft', 'published')),
  CONSTRAINT creator_contents_platform_check CHECK (platform IN ('youtube', 'instagram', 'facebook', 'tiktok', 'linkedin', 'spotify', 'web')),
  CONSTRAINT creator_contents_topic_check CHECK (topic IN ('tramites', 'trabajo', 'negocios', 'vivienda', 'familia', 'dinero', 'planes', 'gastronomia', 'integracion')),
  CONSTRAINT creator_contents_url_check CHECK (url ~* '^https?://'),
  CONSTRAINT creator_contents_title_length CHECK (char_length(title) BETWEEN 15 AND 100),
  CONSTRAINT creator_contents_summary_length CHECK (char_length(summary) BETWEEN 40 AND 300)
);

CREATE INDEX IF NOT EXISTS creator_contents_creator_idx
  ON public.creator_contents (creator_id, status, active, published_at DESC);
CREATE INDEX IF NOT EXISTS creator_contents_topic_idx
  ON public.creator_contents (topic, status, active, published_at DESC);

-- Review-only information is kept out of the publicly readable profile row.
CREATE TABLE IF NOT EXISTS public.creator_private_data (
  creator_id TEXT PRIMARY KEY REFERENCES public.creator_profiles(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  follower_ranges JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT creator_private_follower_ranges_check CHECK (jsonb_typeof(follower_ranges) = 'object')
);

CREATE INDEX IF NOT EXISTS creator_private_data_owner_idx
  ON public.creator_private_data (owner_id);

CREATE TABLE IF NOT EXISTS public.creator_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT creator_interactions_action_check CHECK (action IN ('helpful', 'saved')),
  CONSTRAINT creator_interactions_target_check CHECK (target_type IN ('creator', 'content')),
  CONSTRAINT creator_interactions_unique UNIQUE (actor_id, action, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS creator_interactions_target_idx
  ON public.creator_interactions (action, target_type, target_id);

CREATE TABLE IF NOT EXISTS public.creator_metrics (
  creator_id TEXT NOT NULL REFERENCES public.creator_profiles(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,
  content_id TEXT NOT NULL DEFAULT '',
  count BIGINT NOT NULL DEFAULT 0 CHECK (count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (creator_id, metric, content_id),
  CONSTRAINT creator_metrics_metric_check CHECK (metric IN ('profile_view', 'content_click', 'content_impression', 'content_share', 'social_click'))
);

CREATE OR REPLACE FUNCTION public.touch_creator_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creator_profiles_touch_updated_at ON public.creator_profiles;
CREATE TRIGGER creator_profiles_touch_updated_at
BEFORE UPDATE ON public.creator_profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_creator_updated_at();

DROP TRIGGER IF EXISTS creator_contents_touch_updated_at ON public.creator_contents;
CREATE TRIGGER creator_contents_touch_updated_at
BEFORE UPDATE ON public.creator_contents
FOR EACH ROW EXECUTE FUNCTION public.touch_creator_updated_at();

DROP TRIGGER IF EXISTS creator_private_data_touch_updated_at ON public.creator_private_data;
CREATE TRIGGER creator_private_data_touch_updated_at
BEFORE UPDATE ON public.creator_private_data
FOR EACH ROW EXECUTE FUNCTION public.touch_creator_updated_at();

CREATE OR REPLACE FUNCTION public.is_creator_platform_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result BOOLEAN := FALSE;
BEGIN
  IF to_regclass('public.business_promotion_admins') IS NULL THEN
    RETURN FALSE;
  END IF;
  EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.business_promotion_admins WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> ''email'', '''')))' INTO result;
  RETURN COALESCE(result, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.is_creator_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_creator_platform_admin() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.protect_creator_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  system_context BOOLEAN := COALESCE(current_setting('latido.creator_system', TRUE), '') = '1';
BEGIN
  -- Audience ranges are review data and must never be copied into the public
  -- profile JSON, even when a stale client sends the legacy shape.
  NEW.socials := (
    SELECT COALESCE(jsonb_agg(item - 'follower_range'), '[]'::JSONB)
    FROM jsonb_array_elements(COALESCE(NEW.socials, '[]'::JSONB)) AS social(item)
  );

  IF auth.role() = 'service_role' OR public.is_creator_platform_admin() OR system_context THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.owner_id := auth.uid();
    NEW.verified := FALSE;
    NEW.active := COALESCE(NEW.active, TRUE);
    NEW.review_status := 'pending';
    NEW.helpful_count := 0;
    NEW.saved_count := 0;
  ELSE
    NEW.owner_id := OLD.owner_id;
    NEW.verified := OLD.verified;
    NEW.active := CASE WHEN OLD.active = FALSE THEN FALSE ELSE COALESCE(NEW.active, OLD.active) END;
    NEW.review_status := OLD.review_status;
    NEW.helpful_count := OLD.helpful_count;
    NEW.saved_count := OLD.saved_count;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creator_profiles_protect_fields ON public.creator_profiles;
CREATE TRIGGER creator_profiles_protect_fields
BEFORE INSERT OR UPDATE ON public.creator_profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_creator_profile_fields();

CREATE OR REPLACE FUNCTION public.protect_creator_content_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  system_context BOOLEAN := COALESCE(current_setting('latido.creator_system', TRUE), '') = '1';
BEGIN
  IF auth.role() = 'service_role' OR public.is_creator_platform_admin() OR system_context THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.active := COALESCE(NEW.active, TRUE);
    NEW.helpful_count := 0;
  ELSE
    NEW.creator_id := OLD.creator_id;
    NEW.active := CASE WHEN OLD.active = FALSE THEN FALSE ELSE COALESCE(NEW.active, OLD.active) END;
    NEW.helpful_count := OLD.helpful_count;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creator_contents_protect_fields ON public.creator_contents;
CREATE TRIGGER creator_contents_protect_fields
BEFORE INSERT OR UPDATE ON public.creator_contents
FOR EACH ROW EXECUTE FUNCTION public.protect_creator_content_fields();

CREATE OR REPLACE FUNCTION public.cleanup_creator_interactions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'creator_profiles' THEN
    DELETE FROM public.creator_interactions
    WHERE (target_type = 'creator' AND target_id = OLD.id)
      OR (
        target_type = 'content'
        AND target_id IN (SELECT id FROM public.creator_contents WHERE creator_id = OLD.id)
      );
  ELSE
    DELETE FROM public.creator_interactions
    WHERE target_type = 'content' AND target_id = OLD.id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS creator_profiles_cleanup_interactions ON public.creator_profiles;
CREATE TRIGGER creator_profiles_cleanup_interactions
BEFORE DELETE ON public.creator_profiles
FOR EACH ROW EXECUTE FUNCTION public.cleanup_creator_interactions();

DROP TRIGGER IF EXISTS creator_contents_cleanup_interactions ON public.creator_contents;
CREATE TRIGGER creator_contents_cleanup_interactions
BEFORE DELETE ON public.creator_contents
FOR EACH ROW EXECUTE FUNCTION public.cleanup_creator_interactions();

ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_private_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS creator_profiles_select_visible ON public.creator_profiles;
CREATE POLICY creator_profiles_select_visible ON public.creator_profiles
FOR SELECT USING (
  (active AND status = 'published')
  OR owner_id = auth.uid()
  OR public.is_creator_platform_admin()
);

DROP POLICY IF EXISTS creator_profiles_insert_own ON public.creator_profiles;
CREATE POLICY creator_profiles_insert_own ON public.creator_profiles
FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS creator_profiles_update_own_or_admin ON public.creator_profiles;
CREATE POLICY creator_profiles_update_own_or_admin ON public.creator_profiles
FOR UPDATE TO authenticated
USING (owner_id = auth.uid() OR public.is_creator_platform_admin())
WITH CHECK (owner_id = auth.uid() OR public.is_creator_platform_admin());

DROP POLICY IF EXISTS creator_profiles_delete_own_or_admin ON public.creator_profiles;
CREATE POLICY creator_profiles_delete_own_or_admin ON public.creator_profiles
FOR DELETE TO authenticated
USING (owner_id = auth.uid() OR public.is_creator_platform_admin());

DROP POLICY IF EXISTS creator_contents_select_visible ON public.creator_contents;
CREATE POLICY creator_contents_select_visible ON public.creator_contents
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.creator_profiles profile
    WHERE profile.id = creator_id
      AND (
        (creator_contents.active AND creator_contents.status = 'published' AND profile.active AND profile.status = 'published')
        OR profile.owner_id = auth.uid()
        OR public.is_creator_platform_admin()
      )
  )
);

DROP POLICY IF EXISTS creator_contents_insert_own ON public.creator_contents;
CREATE POLICY creator_contents_insert_own ON public.creator_contents
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.creator_profiles profile WHERE profile.id = creator_id AND profile.owner_id = auth.uid())
);

DROP POLICY IF EXISTS creator_contents_update_own_or_admin ON public.creator_contents;
CREATE POLICY creator_contents_update_own_or_admin ON public.creator_contents
FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.creator_profiles profile WHERE profile.id = creator_id AND (profile.owner_id = auth.uid() OR public.is_creator_platform_admin()))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.creator_profiles profile WHERE profile.id = creator_id AND (profile.owner_id = auth.uid() OR public.is_creator_platform_admin()))
);

DROP POLICY IF EXISTS creator_contents_delete_own_or_admin ON public.creator_contents;
CREATE POLICY creator_contents_delete_own_or_admin ON public.creator_contents
FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.creator_profiles profile WHERE profile.id = creator_id AND (profile.owner_id = auth.uid() OR public.is_creator_platform_admin()))
);

DROP POLICY IF EXISTS creator_private_data_select_own_or_admin ON public.creator_private_data;
CREATE POLICY creator_private_data_select_own_or_admin ON public.creator_private_data
FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.is_creator_platform_admin());

DROP POLICY IF EXISTS creator_private_data_insert_own ON public.creator_private_data;
CREATE POLICY creator_private_data_insert_own ON public.creator_private_data
FOR INSERT TO authenticated WITH CHECK (
  owner_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.creator_profiles profile WHERE profile.id = creator_id AND profile.owner_id = auth.uid())
);

DROP POLICY IF EXISTS creator_private_data_update_own_or_admin ON public.creator_private_data;
CREATE POLICY creator_private_data_update_own_or_admin ON public.creator_private_data
FOR UPDATE TO authenticated
USING (owner_id = auth.uid() OR public.is_creator_platform_admin())
WITH CHECK (
  (owner_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.creator_profiles profile WHERE profile.id = creator_id AND profile.owner_id = auth.uid()
  ))
  OR public.is_creator_platform_admin()
);

DROP POLICY IF EXISTS creator_interactions_select_own ON public.creator_interactions;
CREATE POLICY creator_interactions_select_own ON public.creator_interactions
FOR SELECT TO authenticated USING (actor_id = auth.uid());

DROP POLICY IF EXISTS creator_metrics_select_owner_or_admin ON public.creator_metrics;
CREATE POLICY creator_metrics_select_owner_or_admin ON public.creator_metrics
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.creator_profiles profile
    WHERE profile.id = creator_id
      AND (profile.owner_id = auth.uid() OR public.is_creator_platform_admin())
  )
);

CREATE OR REPLACE FUNCTION public.toggle_creator_interaction(
  p_action TEXT,
  p_target_type TEXT,
  p_target_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  is_active BOOLEAN;
  total_count INTEGER;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF p_action NOT IN ('helpful', 'saved')
    OR p_target_type NOT IN ('creator', 'content')
    OR (p_action = 'saved' AND p_target_type <> 'creator')
    OR COALESCE(p_target_id, '') = '' THEN
    RAISE EXCEPTION 'INVALID_INTERACTION';
  END IF;
  IF p_target_type = 'creator' AND NOT EXISTS (
    SELECT 1 FROM public.creator_profiles WHERE id = p_target_id AND active AND status = 'published'
  ) THEN
    RAISE EXCEPTION 'CREATOR_NOT_FOUND';
  END IF;
  IF p_target_type = 'content' AND NOT EXISTS (
    SELECT 1
    FROM public.creator_contents content
    JOIN public.creator_profiles profile ON profile.id = content.creator_id
    WHERE content.id = p_target_id
      AND content.active
      AND content.status = 'published'
      AND profile.active
      AND profile.status = 'published'
  ) THEN
    RAISE EXCEPTION 'CONTENT_NOT_FOUND';
  END IF;

  DELETE FROM public.creator_interactions
  WHERE actor_id = current_user_id
    AND action = p_action
    AND target_type = p_target_type
    AND target_id = p_target_id;

  IF FOUND THEN
    is_active := FALSE;
  ELSE
    INSERT INTO public.creator_interactions (actor_id, action, target_type, target_id)
    VALUES (current_user_id, p_action, p_target_type, p_target_id);
    is_active := TRUE;
  END IF;

  SELECT COUNT(*)::INTEGER INTO total_count
  FROM public.creator_interactions
  WHERE action = p_action AND target_type = p_target_type AND target_id = p_target_id;

  PERFORM set_config('latido.creator_system', '1', TRUE);

  IF p_target_type = 'creator' AND p_action = 'helpful' THEN
    UPDATE public.creator_profiles SET helpful_count = total_count WHERE id = p_target_id;
  ELSIF p_target_type = 'creator' AND p_action = 'saved' THEN
    UPDATE public.creator_profiles SET saved_count = total_count WHERE id = p_target_id;
  ELSIF p_target_type = 'content' AND p_action = 'helpful' THEN
    UPDATE public.creator_contents SET helpful_count = total_count WHERE id = p_target_id;
  END IF;

  RETURN jsonb_build_object('active', is_active, 'count', total_count);
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_creator_interaction(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_creator_interaction(TEXT, TEXT, TEXT) TO authenticated;

-- Solo expone agregados por contenido. La fecha del voto, no la fecha de la
-- publicación, determina si cuenta dentro de la ventana solicitada.
CREATE INDEX IF NOT EXISTS creator_interactions_recent_content_helpful_idx
  ON public.creator_interactions (created_at DESC, target_id)
  WHERE action = 'helpful' AND target_type = 'content';

CREATE OR REPLACE FUNCTION public.get_recent_creator_content_helpful_counts(
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  content_id TEXT,
  recent_helpful_count BIGINT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    interaction.target_id AS content_id,
    COUNT(*)::BIGINT AS recent_helpful_count
  FROM public.creator_interactions AS interaction
  INNER JOIN public.creator_contents AS content
    ON content.id = interaction.target_id
  INNER JOIN public.creator_profiles AS creator
    ON creator.id = content.creator_id
  WHERE interaction.action = 'helpful'
    AND interaction.target_type = 'content'
    AND interaction.created_at >= NOW() - make_interval(
      days => LEAST(GREATEST(COALESCE(p_days, 30), 1), 90)
    )
    AND content.active = TRUE
    AND content.status = 'published'
    AND creator.active = TRUE
    AND creator.status = 'published'
  GROUP BY interaction.target_id;
$$;

REVOKE ALL ON FUNCTION public.get_recent_creator_content_helpful_counts(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_recent_creator_content_helpful_counts(INTEGER) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.increment_creator_metric(
  p_creator_id TEXT,
  p_metric TEXT,
  p_content_id TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_metric NOT IN ('profile_view', 'content_click', 'content_impression', 'content_share', 'social_click') THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.creator_profiles WHERE id = p_creator_id AND active AND status = 'published') THEN
    RETURN;
  END IF;
  IF p_metric IN ('content_click', 'content_impression', 'content_share') AND NOT EXISTS (
    SELECT 1
    FROM public.creator_contents
    WHERE id = COALESCE(p_content_id, '')
      AND creator_id = p_creator_id
      AND active
      AND status = 'published'
  ) THEN
    RETURN;
  END IF;
  IF p_metric = 'social_click' AND COALESCE(p_content_id, '') NOT IN ('youtube', 'instagram', 'facebook', 'tiktok', 'linkedin', 'spotify', 'web') THEN
    RETURN;
  END IF;

  INSERT INTO public.creator_metrics (creator_id, metric, content_id, count)
  VALUES (p_creator_id, p_metric, COALESCE(p_content_id, ''), 1)
  ON CONFLICT (creator_id, metric, content_id)
  DO UPDATE SET count = public.creator_metrics.count + 1, updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.increment_creator_metric(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_creator_metric(TEXT, TEXT, TEXT) TO anon, authenticated;

GRANT SELECT ON public.creator_profiles, public.creator_contents TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.creator_profiles, public.creator_contents TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.creator_private_data TO authenticated;
GRANT SELECT ON public.creator_interactions, public.creator_metrics TO authenticated;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.creator_profiles;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.creator_contents;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END;
$$;
