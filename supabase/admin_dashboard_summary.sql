-- LATIDO.CH - Resumen agregado y de solo lectura para Estado general.
--
-- Mejora el tiempo de carga del Admin evitando descargar analytics_events y
-- messages completos para calcular las tarjetas iniciales en el navegador.
-- Es aditivo: no modifica tablas ni reemplaza las consultas actuales, que la
-- aplicacion conserva como fallback mientras esta funcion no este instalada.
-- Requiere public.is_business_promotion_admin().

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_dashboard_summary_v1(
  p_days INTEGER DEFAULT 7
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  safe_days INTEGER := LEAST(70, GREATEST(1, COALESCE(p_days, 7)));
  today_swiss DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Zurich')::DATE;
  current_from TIMESTAMPTZ;
  current_to TIMESTAMPTZ;
  previous_from TIMESTAMPTZ;
  result JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_business_promotion_admin() THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = '42501';
  END IF;

  current_from := ((today_swiss - (safe_days - 1))::TIMESTAMP AT TIME ZONE 'Europe/Zurich');
  current_to := ((today_swiss + 1)::TIMESTAMP AT TIME ZONE 'Europe/Zurich');
  previous_from := ((today_swiss - (safe_days * 2 - 1))::TIMESTAMP AT TIME ZONE 'Europe/Zurich');

  WITH admin_ids AS (
    SELECT profile.id
    FROM public.profiles AS profile
    JOIN public.business_promotion_admins AS admin_user
      ON lower(admin_user.email) = lower(profile.email)
  ),
  user_stats AS (
    SELECT
      count(*) AS total,
      count(*) FILTER (WHERE profile.banned IS TRUE) AS banned,
      count(*) FILTER (
        WHERE profile.created_at >= current_from AND profile.created_at < current_to
      ) AS created_current,
      count(*) FILTER (
        WHERE profile.created_at >= previous_from AND profile.created_at < current_from
      ) AS created_previous,
      count(*) FILTER (
        WHERE profile.last_seen_at >= current_from AND profile.last_seen_at < current_to
      ) AS active_current
    FROM public.profiles AS profile
    WHERE NOT EXISTS (SELECT 1 FROM admin_ids WHERE admin_ids.id = profile.id)
  ),
  analytics_stats AS (
    SELECT
      count(*) FILTER (
        WHERE event.created_at >= current_from AND event.created_at < current_to
      ) AS interactions_current,
      count(*) FILTER (
        WHERE event.created_at >= previous_from AND event.created_at < current_from
      ) AS interactions_previous,
      count(*) FILTER (
        WHERE event.created_at >= current_from AND event.created_at < current_to
          AND event.event_type = 'page_view'
      ) AS page_views_current,
      count(*) FILTER (
        WHERE event.created_at >= current_from AND event.created_at < current_to
          AND event.event_type = 'search'
      ) AS searches_current,
      count(*) FILTER (
        WHERE event.created_at >= current_from AND event.created_at < current_to
          AND event.event_type = 'search_result_open'
      ) AS search_opens_current,
      count(DISTINCT COALESCE(event.user_id::TEXT, NULLIF(event.session_id, ''))) FILTER (
        WHERE event.created_at >= current_from AND event.created_at < current_to
          AND event.event_type = 'page_view'
      ) AS visitors_current,
      count(DISTINCT COALESCE(event.user_id::TEXT, NULLIF(event.session_id, ''))) FILTER (
        WHERE event.created_at >= previous_from AND event.created_at < current_from
          AND event.event_type = 'page_view'
      ) AS visitors_previous
    FROM public.analytics_events AS event
    WHERE event.created_at >= previous_from
      AND event.created_at < current_to
      AND event.event_type IN (
        'page_view',
        'search',
        'search_result_open',
        'search_solution_action',
        'search_resolution',
        'search_resolution_reason',
        'partner_card_impression',
        'partner_outbound_click',
        'partner_page_view',
        'partner_service_click',
        'partner_cross_click',
        'partner_promo_open',
        'partner_page_redirect'
      )
      AND COALESCE(event.path, '') NOT LIKE '/admin-latido%'
      AND NOT EXISTS (SELECT 1 FROM admin_ids WHERE admin_ids.id = event.user_id)
  ),
  message_stats AS (
    SELECT
      count(*) FILTER (
        WHERE message.created_at >= current_from AND message.created_at < current_to
      ) AS current_count,
      count(*) FILTER (
        WHERE message.created_at >= previous_from AND message.created_at < current_from
      ) AS previous_count
    FROM public.messages AS message
    WHERE message.created_at >= previous_from
      AND message.created_at < current_to
      AND NOT EXISTS (SELECT 1 FROM admin_ids WHERE admin_ids.id = message.sender_id)
  ),
  listing_stats AS (
    SELECT
      count(*) AS total,
      count(*) FILTER (WHERE listing.active IS DISTINCT FROM FALSE) AS active,
      count(*) FILTER (
        WHERE listing.created_at >= current_from AND listing.created_at < current_to
      ) AS created_current,
      count(*) FILTER (
        WHERE listing.created_at >= previous_from AND listing.created_at < current_from
      ) AS created_previous
    FROM public.listings AS listing
  ),
  job_stats AS (
    SELECT
      count(*) AS total,
      count(*) FILTER (WHERE job.active IS DISTINCT FROM FALSE) AS active,
      count(*) FILTER (
        WHERE job.created_at >= current_from AND job.created_at < current_to
      ) AS created_current,
      count(*) FILTER (
        WHERE job.created_at >= previous_from AND job.created_at < current_from
      ) AS created_previous
    FROM public.jobs AS job
  ),
  business_stats AS (
    SELECT
      count(*) AS total,
      count(*) FILTER (WHERE business.active IS DISTINCT FROM FALSE) AS active,
      count(*) FILTER (
        WHERE business.created_at >= current_from AND business.created_at < current_to
      ) AS created_current,
      count(*) FILTER (
        WHERE business.created_at >= previous_from AND business.created_at < current_from
      ) AS created_previous,
      count(*) FILTER (WHERE business.verification_status = 'pending') AS verification_pending
    FROM public.providers AS business
  ),
  report_stats AS (
    SELECT
      count(*) FILTER (WHERE report.status = 'pending') AS pending,
      count(*) FILTER (
        WHERE report.created_at >= current_from AND report.created_at < current_to
      ) AS created_current,
      count(*) FILTER (
        WHERE report.created_at >= previous_from AND report.created_at < current_from
      ) AS created_previous
    FROM public.reports AS report
  ),
  moderation_stats AS (
    SELECT count(*) FILTER (WHERE item.status = 'pending') AS pending
    FROM public.moderation_queue AS item
  ),
  creator_stats AS (
    SELECT
      count(*) AS total,
      count(*) FILTER (
        WHERE creator.status = 'published' AND creator.active IS DISTINCT FROM FALSE
      ) AS live,
      count(*) FILTER (WHERE creator.review_status = 'pending') AS review_pending,
      count(*) FILTER (
        WHERE creator.created_at >= current_from AND creator.created_at < current_to
      ) AS created_current,
      count(*) FILTER (
        WHERE creator.created_at >= previous_from AND creator.created_at < current_from
      ) AS created_previous
    FROM public.creator_profiles AS creator
  ),
  creator_content_stats AS (
    SELECT
      count(*) FILTER (
        WHERE content.created_at >= current_from AND content.created_at < current_to
      ) AS created_current,
      count(*) FILTER (
        WHERE content.created_at >= previous_from AND content.created_at < current_from
      ) AS created_previous
    FROM public.creator_contents AS content
  )
  SELECT jsonb_build_object(
    'version', 1,
    'generated_at', CURRENT_TIMESTAMP,
    'period', jsonb_build_object(
      'days', safe_days,
      'from', current_from,
      'to', current_to,
      'previous_from', previous_from
    ),
    'users', jsonb_build_object(
      'total', user_stats.total,
      'banned', user_stats.banned,
      'new', user_stats.created_current,
      'new_previous', user_stats.created_previous,
      'active', user_stats.active_current
    ),
    'analytics', jsonb_build_object(
      'interactions', analytics_stats.interactions_current,
      'interactions_previous', analytics_stats.interactions_previous,
      'page_views', analytics_stats.page_views_current,
      'searches', analytics_stats.searches_current,
      'search_opens', analytics_stats.search_opens_current,
      'visitors', analytics_stats.visitors_current,
      'visitors_previous', analytics_stats.visitors_previous
    ),
    'messages', jsonb_build_object(
      'total', message_stats.current_count,
      'previous', message_stats.previous_count
    ),
    'content', jsonb_build_object(
      'listings_total', listing_stats.total,
      'listings_active', listing_stats.active,
      'listings_new', listing_stats.created_current,
      'listings_new_previous', listing_stats.created_previous,
      'jobs_total', job_stats.total,
      'jobs_active', job_stats.active,
      'jobs_new', job_stats.created_current,
      'jobs_new_previous', job_stats.created_previous
    ),
    'businesses', jsonb_build_object(
      'total', business_stats.total,
      'active', business_stats.active,
      'new', business_stats.created_current,
      'new_previous', business_stats.created_previous,
      'verification_pending', business_stats.verification_pending
    ),
    'reports', jsonb_build_object(
      'pending', report_stats.pending,
      'new', report_stats.created_current,
      'new_previous', report_stats.created_previous
    ),
    'moderation', jsonb_build_object('pending', moderation_stats.pending),
    'creators', jsonb_build_object(
      'total', creator_stats.total,
      'live', creator_stats.live,
      'review_pending', creator_stats.review_pending,
      'new', creator_stats.created_current,
      'new_previous', creator_stats.created_previous,
      'content_new', creator_content_stats.created_current,
      'content_new_previous', creator_content_stats.created_previous
    )
  )
  INTO result
  FROM user_stats,
       analytics_stats,
       message_stats,
       listing_stats,
       job_stats,
       business_stats,
       report_stats,
       moderation_stats,
       creator_stats,
       creator_content_stats;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_dashboard_summary_v1(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_summary_v1(INTEGER) TO authenticated;

COMMENT ON FUNCTION public.admin_dashboard_summary_v1(INTEGER) IS
  'Resumen agregado de solo lectura para el Estado general del Admin de Latido.';

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Comprobacion de instalacion desde SQL Editor:
-- SELECT to_regprocedure('public.admin_dashboard_summary_v1(integer)');
-- El resultado agregado se comprueba abriendo Estado general con una sesion admin.
