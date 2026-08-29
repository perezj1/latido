-- Shared management access for creator profiles.
-- Run once in the Supabase SQL editor after supabase/creator_platform.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS public.creator_members (
  creator_id TEXT NOT NULL REFERENCES public.creator_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (creator_id, user_id)
);

CREATE INDEX IF NOT EXISTS creator_members_user_idx
  ON public.creator_members (user_id, creator_id);

ALTER TABLE public.creator_members ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER keeps creator policies from recursively evaluating the
-- membership table's own RLS policy. The function only answers for auth.uid().
CREATE OR REPLACE FUNCTION public.can_manage_creator(p_creator_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1
      FROM public.creator_profiles AS profile
      WHERE profile.id = p_creator_id
        AND profile.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.creator_members AS member
      WHERE member.creator_id = p_creator_id
        AND member.user_id = auth.uid()
    )
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_creator(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_creator(TEXT) TO anon, authenticated;

DROP POLICY IF EXISTS creator_members_select_related ON public.creator_members;
CREATE POLICY creator_members_select_related ON public.creator_members
FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.creator_profiles AS profile
    WHERE profile.id = creator_id
      AND profile.owner_id = auth.uid()
  )
  OR public.is_creator_platform_admin()
);

DROP POLICY IF EXISTS creator_members_insert_owner_or_admin ON public.creator_members;
CREATE POLICY creator_members_insert_owner_or_admin ON public.creator_members
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.creator_profiles AS profile
    WHERE profile.id = creator_id
      AND profile.owner_id = auth.uid()
  )
  OR public.is_creator_platform_admin()
);

DROP POLICY IF EXISTS creator_members_delete_owner_or_admin ON public.creator_members;
CREATE POLICY creator_members_delete_owner_or_admin ON public.creator_members
FOR DELETE TO authenticated USING (
  EXISTS (
    SELECT 1
    FROM public.creator_profiles AS profile
    WHERE profile.id = creator_id
      AND profile.owner_id = auth.uid()
  )
  OR public.is_creator_platform_admin()
);

DROP POLICY IF EXISTS creator_profiles_select_visible ON public.creator_profiles;
CREATE POLICY creator_profiles_select_visible ON public.creator_profiles
FOR SELECT USING (
  (active AND status = 'published')
  OR public.can_manage_creator(id)
  OR public.is_creator_platform_admin()
);

DROP POLICY IF EXISTS creator_profiles_update_own_or_admin ON public.creator_profiles;
CREATE POLICY creator_profiles_update_own_or_admin ON public.creator_profiles
FOR UPDATE TO authenticated
USING (public.can_manage_creator(id) OR public.is_creator_platform_admin())
WITH CHECK (public.can_manage_creator(id) OR public.is_creator_platform_admin());

-- Only the original owner or a platform administrator may delete the complete
-- profile. Members can edit the profile and fully manage its content.
DROP POLICY IF EXISTS creator_profiles_delete_own_or_admin ON public.creator_profiles;
CREATE POLICY creator_profiles_delete_own_or_admin ON public.creator_profiles
FOR DELETE TO authenticated
USING (owner_id = auth.uid() OR public.is_creator_platform_admin());

DROP POLICY IF EXISTS creator_contents_select_visible ON public.creator_contents;
CREATE POLICY creator_contents_select_visible ON public.creator_contents
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.creator_profiles AS profile
    WHERE profile.id = creator_id
      AND (
        (creator_contents.active AND creator_contents.status = 'published' AND profile.active AND profile.status = 'published')
        OR public.can_manage_creator(profile.id)
        OR public.is_creator_platform_admin()
      )
  )
);

DROP POLICY IF EXISTS creator_contents_insert_own ON public.creator_contents;
CREATE POLICY creator_contents_insert_own ON public.creator_contents
FOR INSERT TO authenticated WITH CHECK (
  public.can_manage_creator(creator_id)
  OR public.is_creator_platform_admin()
);

DROP POLICY IF EXISTS creator_contents_update_own_or_admin ON public.creator_contents;
CREATE POLICY creator_contents_update_own_or_admin ON public.creator_contents
FOR UPDATE TO authenticated
USING (public.can_manage_creator(creator_id) OR public.is_creator_platform_admin())
WITH CHECK (public.can_manage_creator(creator_id) OR public.is_creator_platform_admin());

DROP POLICY IF EXISTS creator_contents_delete_own_or_admin ON public.creator_contents;
CREATE POLICY creator_contents_delete_own_or_admin ON public.creator_contents
FOR DELETE TO authenticated USING (
  public.can_manage_creator(creator_id)
  OR public.is_creator_platform_admin()
);

DROP POLICY IF EXISTS creator_private_data_select_own_or_admin ON public.creator_private_data;
CREATE POLICY creator_private_data_select_own_or_admin ON public.creator_private_data
FOR SELECT TO authenticated USING (
  public.can_manage_creator(creator_id)
  OR public.is_creator_platform_admin()
);

DROP POLICY IF EXISTS creator_private_data_insert_own ON public.creator_private_data;
CREATE POLICY creator_private_data_insert_own ON public.creator_private_data
FOR INSERT TO authenticated WITH CHECK (
  (
    public.can_manage_creator(creator_id)
    AND owner_id = (SELECT profile.owner_id FROM public.creator_profiles AS profile WHERE profile.id = creator_id)
  )
  OR public.is_creator_platform_admin()
);

DROP POLICY IF EXISTS creator_private_data_update_own_or_admin ON public.creator_private_data;
CREATE POLICY creator_private_data_update_own_or_admin ON public.creator_private_data
FOR UPDATE TO authenticated
USING (public.can_manage_creator(creator_id) OR public.is_creator_platform_admin())
WITH CHECK (
  (
    public.can_manage_creator(creator_id)
    AND owner_id = (SELECT profile.owner_id FROM public.creator_profiles AS profile WHERE profile.id = creator_id)
  )
  OR public.is_creator_platform_admin()
);

DROP POLICY IF EXISTS creator_metrics_select_owner_or_admin ON public.creator_metrics;
CREATE POLICY creator_metrics_select_owner_or_admin ON public.creator_metrics
FOR SELECT TO authenticated USING (
  public.can_manage_creator(creator_id)
  OR public.is_creator_platform_admin()
);

GRANT SELECT, INSERT, DELETE ON public.creator_members TO authenticated;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.creator_members;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
