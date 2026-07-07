-- =====================================================================
-- LATIDO.CH - Automatic business collaboration cards and monthly reports
-- Run after the business promotion SQL files.
-- =====================================================================

ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS partner_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS partner_card_title TEXT,
  ADD COLUMN IF NOT EXISTS partner_card_description TEXT,
  ADD COLUMN IF NOT EXISTS partner_cta_label TEXT,
  ADD COLUMN IF NOT EXISTS partner_cta_url TEXT,
  ADD COLUMN IF NOT EXISTS partner_published BOOLEAN DEFAULT TRUE;

UPDATE public.providers
SET partner_published = TRUE
WHERE partner_published IS NULL;

CREATE INDEX IF NOT EXISTS idx_providers_active_business_partners
  ON public.providers (
    promotion_plan,
    promotion_starts_at,
    promotion_ends_at,
    name
  )
  WHERE active = TRUE
    AND partner_published = TRUE
    AND promotion_plan IN ('basic', 'premium');

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  path TEXT,
  search TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "analytics_events_insert" ON public.analytics_events;
CREATE POLICY "analytics_events_insert"
  ON public.analytics_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (auth.uid() IS NULL AND user_id IS NULL)
    OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "analytics_events_select_admin" ON public.analytics_events;
CREATE POLICY "analytics_events_select_admin"
  ON public.analytics_events
  FOR SELECT
  TO authenticated
  USING (public.is_business_promotion_admin());

CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at
  ON public.analytics_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_partner_month
  ON public.analytics_events ((metadata->>'partner_id'), created_at DESC)
  WHERE event_type IN (
    'partner_card_impression',
    'partner_outbound_click',
    'partner_service_click'
  );

GRANT INSERT ON public.analytics_events TO anon, authenticated;
GRANT SELECT ON public.analytics_events TO authenticated;
GRANT SELECT ON public.analytics_events TO service_role;

CREATE OR REPLACE FUNCTION public.get_business_partner_monthly_report(
  p_provider_id UUID,
  p_month DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_provider public.providers%ROWTYPE;
  month_start TIMESTAMPTZ := date_trunc('month', COALESCE(p_month, CURRENT_DATE))::TIMESTAMPTZ;
  month_end TIMESTAMPTZ := month_start + INTERVAL '1 month';
  partner_id TEXT := 'business:' || p_provider_id::TEXT;
  totals JSONB;
  placements JSONB;
  services JSONB;
BEGIN
  IF NOT public.is_business_promotion_admin() THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT *
  INTO selected_provider
  FROM public.providers
  WHERE id = p_provider_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROVIDER_NOT_FOUND';
  END IF;

  SELECT jsonb_build_object(
    'impressions', COUNT(*) FILTER (WHERE event_type = 'partner_card_impression'),
    'ctaClicks', COUNT(*) FILTER (WHERE event_type = 'partner_outbound_click'),
    'serviceClicks', COUNT(*) FILTER (WHERE event_type = 'partner_service_click'),
    'totalClicks', COUNT(*) FILTER (
      WHERE event_type IN ('partner_outbound_click', 'partner_service_click')
    )
  )
  INTO totals
  FROM public.analytics_events
  WHERE metadata->>'partner_id' = partner_id
    AND created_at >= month_start
    AND created_at < month_end;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'placement', placement,
        'impressions', impressions,
        'clicks', clicks
      )
      ORDER BY clicks DESC, impressions DESC, placement ASC
    ),
    '[]'::jsonb
  )
  INTO placements
  FROM (
    SELECT
      COALESCE(NULLIF(metadata->>'placement', ''), 'Sin ubicacion') AS placement,
      COUNT(*) FILTER (WHERE event_type = 'partner_card_impression') AS impressions,
      COUNT(*) FILTER (
        WHERE event_type IN ('partner_outbound_click', 'partner_service_click')
      ) AS clicks
    FROM public.analytics_events
    WHERE metadata->>'partner_id' = partner_id
      AND created_at >= month_start
      AND created_at < month_end
    GROUP BY COALESCE(NULLIF(metadata->>'placement', ''), 'Sin ubicacion')
  ) AS placement_rows;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'service', service,
        'clicks', clicks
      )
      ORDER BY clicks DESC, service ASC
    ),
    '[]'::jsonb
  )
  INTO services
  FROM (
    SELECT
      COALESCE(NULLIF(metadata->>'service', ''), 'CTA') AS service,
      COUNT(*) AS clicks
    FROM public.analytics_events
    WHERE metadata->>'partner_id' = partner_id
      AND event_type IN ('partner_outbound_click', 'partner_service_click')
      AND created_at >= month_start
      AND created_at < month_end
    GROUP BY COALESCE(NULLIF(metadata->>'service', ''), 'CTA')
  ) AS service_rows;

  RETURN jsonb_build_object(
    'provider', jsonb_build_object(
      'id', selected_provider.id,
      'name', selected_provider.name,
      'promotionPlan', selected_provider.promotion_plan
    ),
    'period', jsonb_build_object(
      'start', month_start,
      'end', month_end
    ),
    'totals', totals,
    'byPlacement', placements,
    'byService', services
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_business_partner_monthly_report(UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_business_partner_monthly_report(UUID, DATE)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
