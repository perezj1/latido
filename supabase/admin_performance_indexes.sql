-- Indexes used by the admin dashboard.
-- Safe to run more than once and tolerant of optional tables.

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_profiles_created_at_admin ON public.profiles (created_at DESC, id ASC)';
  END IF;

  IF to_regclass('public.listings') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_listings_created_at_admin ON public.listings (created_at DESC, id ASC)';
  END IF;

  IF to_regclass('public.jobs') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_jobs_created_at_admin ON public.jobs (created_at DESC, id ASC)';
  END IF;

  IF to_regclass('public.providers') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_providers_created_at_admin ON public.providers (created_at DESC, id ASC)';
  END IF;

  IF to_regclass('public.reports') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_reports_created_at_admin ON public.reports (created_at DESC, id ASC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_reports_status_created_at_admin ON public.reports (status, created_at DESC)';
  END IF;

  IF to_regclass('public.moderation_queue') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_moderation_created_at_admin ON public.moderation_queue (created_at DESC, id ASC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_moderation_status_created_at_admin ON public.moderation_queue (status, created_at DESC)';
  END IF;

  IF to_regclass('public.analytics_events') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_analytics_created_at_admin ON public.analytics_events (created_at DESC, id ASC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_analytics_type_created_at_admin ON public.analytics_events (event_type, created_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_analytics_user_created_at_admin ON public.analytics_events (user_id, created_at DESC) WHERE user_id IS NOT NULL';
  END IF;

  IF to_regclass('public.messages') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_messages_created_at_admin ON public.messages (created_at DESC, id ASC)';
  END IF;
END
$$;
