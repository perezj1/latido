-- Read-only reporting for the Latido Club section of /admin-latido.
-- Run after latido_card_minimal.sql and the existing offer activation updates.
-- Repeatable: preserves every membership, business, offer and recorded use.
BEGIN;

CREATE OR REPLACE FUNCTION public.lc_admin_metrics(
  p_days INTEGER DEFAULT 30,
  p_kind TEXT DEFAULT 'businesses',
  p_search TEXT DEFAULT '',
  p_status TEXT DEFAULT 'all',
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 25,
  p_exclude_tests BOOLEAN DEFAULT true
) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_days INTEGER := greatest(1, least(coalesce(p_days, 30), 90));
  v_page INTEGER := greatest(1, least(coalesce(p_page, 1), 1000000));
  v_size INTEGER := greatest(1, least(coalesce(p_page_size, 25), 100));
  v_search TEXT := lower(left(btrim(coalesce(p_search, '')), 100));
  v_status TEXT := coalesce(p_status, 'all');
  v_from TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  IF NOT coalesce(public.lc_is_admin(), false) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('members', 'businesses', 'offers', 'uses') THEN
    RAISE EXCEPTION 'INVALID_REPORT_KIND';
  END IF;
  IF v_status <> 'all' AND NOT (
    (p_kind = 'members' AND v_status IN ('active', 'paused', 'expired', 'cancelled', 'scheduled')) OR
    (p_kind = 'businesses' AND v_status IN ('active', 'without_offers', 'suspended', 'inactive', 'unpublished', 'archived')) OR
    (p_kind = 'offers' AND v_status IN ('published', 'paused', 'expired', 'scheduled', 'archived', 'business_unavailable')) OR
    (p_kind = 'uses' AND v_status IN ('used', 'reversed'))
  ) THEN RAISE EXCEPTION 'INVALID_REPORT_STATUS'; END IF;
  v_from := ((v_now AT TIME ZONE 'Europe/Zurich')::date - (v_days - 1))::timestamp AT TIME ZONE 'Europe/Zurich';

  WITH member_rows AS (
    SELECT m.*, p.name, p.email,
      CASE WHEN m.status <> 'active' THEN m.status
        WHEN m.starts_at > v_now THEN 'scheduled'
        WHEN m.valid_until <= v_now THEN 'expired' ELSE 'active' END AS state
    FROM public.latido_card_memberships m JOIN public.profiles p ON p.id = m.user_id
    WHERE NOT coalesce(p_exclude_tests, true) OR btrim(coalesce(p.name, '')) NOT ILIKE '[TEST]%'
  ), business_rows AS (
    SELECT b.provider_id AS id, p.name, p.city, b.created_at,
      CASE WHEN to_jsonb(p)->>'deleted_at' IS NOT NULL THEN 'archived'
        WHEN p.active IS NOT TRUE THEN 'unpublished'
        WHEN b.suspended THEN 'suspended' WHEN NOT b.active THEN 'inactive' ELSE 'active' END AS state
    FROM public.latido_card_businesses b JOIN public.providers p ON p.id = b.provider_id
    WHERE NOT coalesce(p_exclude_tests, true) OR btrim(coalesce(p.name, '')) NOT ILIKE '[TEST]%'
  ), offer_rows AS (
    SELECT o.*, b.name AS business_name, b.city,
      CASE WHEN o.deleted_at IS NOT NULL THEN 'archived'
        WHEN b.state <> 'active' THEN 'business_unavailable'
        WHEN o.ends_at <= v_now THEN 'expired'
        WHEN NOT o.active THEN 'paused'
        WHEN o.starts_at > v_now THEN 'scheduled' ELSE 'published' END AS state
    FROM public.latido_card_offers o JOIN business_rows b ON b.id = o.provider_id
    WHERE NOT coalesce(p_exclude_tests, true) OR btrim(o.title) NOT ILIKE '[TEST]%'
  ), use_rows AS (
    SELECT r.id, r.offer_id, r.membership_id, r.provider_id, r.redeemed_at, r.reversed_at,
      coalesce(r.offer_snapshot->>'title', o.title) AS title,
      coalesce(r.offer_snapshot->>'business_name', o.business_name) AS business_name,
      m.name AS member_name,
      CASE WHEN r.reversed_at IS NULL THEN 'used' ELSE 'reversed' END AS state
    FROM public.latido_card_redemptions r JOIN offer_rows o ON o.id = r.offer_id
    JOIN public.latido_card_memberships membership ON membership.id = r.membership_id
    JOIN public.profiles m ON m.id = membership.user_id
    WHERE NOT coalesce(p_exclude_tests, true) OR (
      btrim(coalesce(r.offer_snapshot->>'title', '')) NOT ILIKE '[TEST]%'
      AND btrim(coalesce(m.name, '')) NOT ILIKE '[TEST]%'
    )
  ), business_totals AS (
    SELECT b.*, count(o.id) FILTER (WHERE o.state <> 'archived') AS offers,
      count(o.id) FILTER (WHERE o.state = 'published') AS published_offers,
      (SELECT count(*) FROM use_rows r WHERE r.provider_id = b.id AND r.state = 'used') AS uses
    FROM business_rows b LEFT JOIN offer_rows o ON o.provider_id = b.id
    GROUP BY b.id, b.name, b.city, b.created_at, b.state
  ), records AS (
    SELECT m.id, m.created_at AS sort_at,
      jsonb_build_object('id', m.id, 'user_id', m.user_id, 'name', m.name, 'email', m.email,
        'member_number', m.member_number, 'status', m.state, 'valid_until', m.valid_until,
        'created_at', m.created_at) AS data
    FROM member_rows m WHERE p_kind = 'members' AND (v_status = 'all' OR m.state = v_status)
      AND strpos(lower(concat_ws(' ', m.name, m.email, m.member_number::text)), v_search) > 0
    UNION ALL
    SELECT b.id, b.created_at,
      jsonb_build_object('id', b.id, 'name', b.name, 'city', b.city, 'status', b.state,
        'offers', b.offers, 'published_offers', b.published_offers, 'uses', b.uses)
    FROM business_totals b WHERE p_kind = 'businesses'
      AND (v_status = 'all' OR b.state = v_status OR (v_status = 'without_offers' AND b.state = 'active' AND b.published_offers = 0))
      AND strpos(lower(concat_ws(' ', b.name, b.city)), v_search) > 0
    UNION ALL
    SELECT o.id, o.created_at,
      jsonb_build_object('id', o.id, 'provider_id', o.provider_id, 'title', o.title,
        'business_name', o.business_name, 'city', o.city, 'status', o.state,
        'benefit_type', o.benefit_type, 'benefit_value', o.benefit_value,
        'created_at', o.created_at, 'ends_at', o.ends_at,
        'uses', (SELECT count(*) FROM use_rows r WHERE r.offer_id = o.id AND r.state = 'used'))
    FROM offer_rows o WHERE p_kind = 'offers' AND (v_status = 'all' OR o.state = v_status)
      AND strpos(lower(concat_ws(' ', o.title, o.business_name, o.city)), v_search) > 0
    UNION ALL
    SELECT r.id, r.redeemed_at,
      jsonb_build_object('id', r.id, 'title', r.title, 'business_name', r.business_name,
        'member_name', r.member_name, 'status', r.state, 'redeemed_at', r.redeemed_at)
    FROM use_rows r WHERE p_kind = 'uses' AND (v_status = 'all' OR r.state = v_status)
      AND r.redeemed_at >= v_from AND r.redeemed_at <= v_now
      AND strpos(lower(concat_ws(' ', r.title, r.business_name, r.member_name)), v_search) > 0
  ), days AS (
    SELECT (v_now AT TIME ZONE 'Europe/Zurich')::date - day AS day
    FROM generate_series(0, v_days - 1) AS day
  )
  SELECT jsonb_build_object(
    'generated_at', v_now,
    'period', jsonb_build_object('days', v_days, 'from', v_from, 'until', v_now, 'timezone', 'Europe/Zurich'),
    'stats', jsonb_build_object(
      'members_total', (SELECT count(*) FROM member_rows),
      'members_active', (SELECT count(*) FROM member_rows WHERE state = 'active'),
      'members_paused', (SELECT count(*) FROM member_rows WHERE state = 'paused'),
      'members_expired', (SELECT count(*) FROM member_rows WHERE state = 'expired'),
      'members_cancelled', (SELECT count(*) FROM member_rows WHERE state = 'cancelled'),
      'members_new', (SELECT count(*) FROM member_rows WHERE created_at BETWEEN v_from AND v_now),
      'businesses_total', (SELECT count(*) FROM business_rows WHERE state <> 'archived'),
      'businesses_participating', (SELECT count(*) FROM business_rows WHERE state = 'active'),
      'businesses_with_offers', (SELECT count(*) FROM business_totals WHERE published_offers > 0),
      'businesses_without_offers', (SELECT count(*) FROM business_totals WHERE state = 'active' AND published_offers = 0),
      'businesses_suspended', (SELECT count(*) FROM business_rows WHERE state = 'suspended'),
      'offers_total', (SELECT count(*) FROM offer_rows WHERE state <> 'archived'),
      'offers_published', (SELECT count(*) FROM offer_rows WHERE state = 'published'),
      'offers_paused', (SELECT count(*) FROM offer_rows WHERE state = 'paused'),
      'offers_expired', (SELECT count(*) FROM offer_rows WHERE state = 'expired'),
      'offers_scheduled', (SELECT count(*) FROM offer_rows WHERE state = 'scheduled'),
      'offers_archived', (SELECT count(*) FROM offer_rows WHERE state = 'archived'),
      'offers_unavailable', (SELECT count(*) FROM offer_rows WHERE state = 'business_unavailable'),
      'offers_new', (SELECT count(*) FROM offer_rows WHERE created_at BETWEEN v_from AND v_now),
      'uses_total', (SELECT count(*) FROM use_rows WHERE state = 'used'),
      'uses_period', (SELECT count(*) FROM use_rows WHERE state = 'used' AND redeemed_at BETWEEN v_from AND v_now),
      'uses_reversed', (SELECT count(*) FROM use_rows WHERE state = 'reversed'),
      'using_members_period', (SELECT count(DISTINCT membership_id) FROM use_rows WHERE state = 'used' AND redeemed_at BETWEEN v_from AND v_now),
      'claims_active', (SELECT count(*) FROM public.latido_card_claims c JOIN offer_rows o ON o.id = c.offer_id
        JOIN member_rows m ON m.id = c.membership_id
        WHERE c.status = 'claimed' AND c.expires_at > v_now AND o.state = 'published' AND m.state = 'active')
    ),
    'daily', (SELECT coalesce(jsonb_agg(jsonb_build_object('day', d.day,
      'members', (SELECT count(*) FROM member_rows m WHERE (m.created_at AT TIME ZONE 'Europe/Zurich')::date = d.day AND m.created_at <= v_now),
      'offers', (SELECT count(*) FROM offer_rows o WHERE (o.created_at AT TIME ZONE 'Europe/Zurich')::date = d.day AND o.created_at <= v_now),
      'uses', (SELECT count(*) FROM use_rows r WHERE (r.redeemed_at AT TIME ZONE 'Europe/Zurich')::date = d.day AND r.redeemed_at <= v_now AND r.state = 'used')) ORDER BY d.day), '[]'::jsonb) FROM days d),
    'records', jsonb_build_object('kind', p_kind, 'page', v_page, 'page_size', v_size,
      'total', (SELECT count(*) FROM records),
      'rows', (SELECT coalesce(jsonb_agg(x.data ORDER BY x.sort_at DESC, x.id DESC), '[]'::jsonb)
        FROM (SELECT * FROM records ORDER BY sort_at DESC, id DESC LIMIT v_size OFFSET (v_page - 1) * v_size) x))
  ) INTO v_result;
  RETURN v_result;
END $$;

REVOKE ALL ON FUNCTION public.lc_admin_metrics(INTEGER,TEXT,TEXT,TEXT,INTEGER,INTEGER,BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lc_admin_metrics(INTEGER,TEXT,TEXT,TEXT,INTEGER,INTEGER,BOOLEAN) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
