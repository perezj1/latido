-- Run after the current Suizamente game/content migrations. Safe to re-run.
BEGIN;
DO $prerequisites$
BEGIN
  IF to_regnamespace('suizamente_private') IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE='P0001',
      MESSAGE='Suizamente no está instalado en esta base de datos.',
      HINT='Comprueba el proyecto y la rama de Supabase. En el proyecto de Latido, ejecuta completos suizamente_revision_completa_01.sql, 02, 03 y 04, en ese orden; después suizamente_community.sql.';
  END IF;
  IF to_regclass('suizamente_private.players') IS NULL
    OR to_regclass('suizamente_private.answers') IS NULL
    OR to_regclass('suizamente_private.sessions') IS NULL
    OR to_regclass('suizamente_private.versions') IS NULL
    OR to_regclass('public.profiles') IS NULL
    OR to_regprocedure('suizamente_private.require_user()') IS NULL
    OR to_regprocedure('suizamente_private.ensure_player(uuid)') IS NULL
    OR to_regprocedure('suizamente_private.game_view(uuid)') IS NULL
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute
      WHERE attrelid=to_regclass('suizamente_private.answers') AND attname='response' AND NOT attisdropped) THEN
    RAISE EXCEPTION USING
      ERRCODE='P0001',
      MESSAGE='La instalación principal de Suizamente está incompleta o desactualizada.',
      HINT='Completa suizamente_revision_completa_01.sql, 02, 03 y 04, en ese orden; después vuelve a ejecutar suizamente_community.sql. Consulta docs/SUIZAMENTE_SETUP.md.';
  END IF;
END $prerequisites$;
ALTER TABLE suizamente_private.players ADD COLUMN IF NOT EXISTS community_country text
  CHECK(community_country IN ('AR','BO','BR','CL','CO','CR','CU','EC','SV','ES','GT','HN','MX','NI','PA','PY','PE','DO','CH','UY','VE','OTHER'));
ALTER TABLE suizamente_private.players ADD COLUMN IF NOT EXISTS community_years text
  CHECK(community_years IN ('under_1','1_3','4_9','10_plus'));
CREATE INDEX IF NOT EXISTS suizamente_answers_community ON suizamente_private.answers(version_id,user_id,created_at);

-- Convert display positions back to the version's stable option indices.
CREATE OR REPLACE FUNCTION suizamente_private.community_response(a suizamente_private.answers,s suizamente_private.sessions,kind text)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT CASE WHEN a.skipped THEN NULL WHEN kind IN ('multi','order') THEN a.response
    WHEN kind IN ('choice','tf','image','false') THEN s.option_orders->a.version_id::text->a.choice ELSE NULL END
$$;

CREATE OR REPLACE FUNCTION public.suizamente_community(p_action text,p_args jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=suizamente_private.require_user(); current_answer suizamente_private.answers;
  current_session suizamente_private.sessions; kind text; chosen jsonb; result jsonb;
BEGIN
  IF p_args IS NULL OR jsonb_typeof(p_args)<>'object' OR octet_length(p_args::text)>1000 THEN RAISE EXCEPTION 'SZ_INVALID_REQUEST'; END IF;
  IF p_action='profile' THEN
    IF p_args->>'country' IS NOT NULL AND p_args->>'country' NOT IN ('AR','BO','BR','CL','CO','CR','CU','EC','SV','ES','GT','HN','MX','NI','PA','PY','PE','DO','CH','UY','VE','OTHER')
      OR p_args->>'years' IS NOT NULL AND p_args->>'years' NOT IN ('under_1','1_3','4_9','10_plus') THEN RAISE EXCEPTION 'SZ_INVALID_REQUEST'; END IF;
    PERFORM suizamente_private.ensure_player(actor);
    UPDATE suizamente_private.players SET
      community_country=CASE WHEN p_args ? 'country' THEN p_args->>'country' ELSE community_country END,
      community_years=CASE WHEN p_args ? 'years' THEN p_args->>'years' ELSE community_years END WHERE user_id=actor;
    RETURN jsonb_build_object('saved',true);
  END IF;
  IF p_action<>'stats' THEN RAISE EXCEPTION 'SZ_INVALID_REQUEST'; END IF;
  SELECT * INTO current_session FROM suizamente_private.sessions WHERE id=(p_args->>'session_id')::uuid AND user_id=actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'SZ_SESSION_NOT_FOUND' USING ERRCODE='42501'; END IF;
  SELECT * INTO current_answer FROM suizamente_private.answers WHERE session_id=current_session.id AND position=(p_args->>'position')::integer;
  IF NOT FOUND THEN RAISE EXCEPTION 'SZ_INVALID_REQUEST'; END IF;
  SELECT coalesce(payload->>'game_type','choice') INTO kind FROM suizamente_private.versions WHERE id=current_answer.version_id AND NOT annulled;
  chosen:=suizamente_private.community_response(current_answer,current_session,kind);
  IF chosen IS NULL THEN RETURN jsonb_build_object('country','[]'::jsonb,'years','[]'::jsonb,'minimum',5); END IF;
  WITH first_answers AS (
    -- One vote per person and exact version, so practice cannot inflate the figures.
    SELECT DISTINCT ON (a.user_id) a.user_id,p.community_country,p.community_years,
      suizamente_private.community_response(a,s,kind)=chosen same
    FROM suizamente_private.answers a JOIN suizamente_private.sessions s ON s.id=a.session_id
      JOIN suizamente_private.players p ON p.user_id=a.user_id
    WHERE a.version_id=current_answer.version_id AND NOT a.skipped
      AND NOT EXISTS(SELECT 1 FROM public.profiles pr WHERE pr.id=a.user_id AND coalesce(pr.banned,false))
    ORDER BY a.user_id,a.created_at,a.session_id,a.position
  ), groups AS (
    SELECT 'country' dimension,community_country id,count(*) total,count(*) FILTER(WHERE same) matches FROM first_answers WHERE community_country IS NOT NULL GROUP BY community_country
    UNION ALL
    SELECT 'years',community_years,count(*),count(*) FILTER(WHERE same) FROM first_answers WHERE community_years IS NOT NULL GROUP BY community_years
  ) SELECT jsonb_build_object('minimum',5,
    'country',coalesce(jsonb_agg(jsonb_build_object('id',id,'percent',round(100.0*matches/total)) ORDER BY total DESC,id) FILTER(WHERE dimension='country'),'[]'::jsonb),
    'years',coalesce(jsonb_agg(jsonb_build_object('id',id,'percent',round(100.0*matches/total)) ORDER BY array_position(ARRAY['under_1','1_3','4_9','10_plus'],id)) FILTER(WHERE dimension='years'),'[]'::jsonb))
    INTO result FROM groups WHERE total>=5;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION suizamente_private.community_response(suizamente_private.answers,suizamente_private.sessions,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.suizamente_community(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.suizamente_community(text,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
