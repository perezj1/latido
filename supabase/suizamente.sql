-- Suizamente API. Run before suizamente_game.sql and suizamente_seed.sql.
-- Re-run this file alone to upgrade v1/v2, preserving questions and player progress.
-- All state/solutions are in an unexposed schema; the only API is a checked RPC.
BEGIN;
CREATE SCHEMA IF NOT EXISTS suizamente_private;
REVOKE ALL ON SCHEMA suizamente_private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS suizamente_private.config (
  id boolean PRIMARY KEY DEFAULT true CHECK(id),
  thresholds integer[] NOT NULL DEFAULT ARRAY[150,400,800,1300,2000],
  xp_weights integer[] NOT NULL DEFAULT ARRAY[10,15,20,25,30],
  daily_bonus integer NOT NULL DEFAULT 5 CHECK(daily_bonus BETWEEN 0 AND 25),
  enabled boolean NOT NULL DEFAULT true,
  school_name text NOT NULL DEFAULT '', school_url text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO suizamente_private.config(id) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS suizamente_private.admins(user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS suizamente_private.players (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  canton text, alias text NOT NULL, leaderboard_opt_in boolean NOT NULL DEFAULT false,
  include_general boolean NOT NULL DEFAULT true, include_canton boolean NOT NULL DEFAULT true,
  xp integer NOT NULL DEFAULT 0 CHECK(xp>=0), level integer NOT NULL DEFAULT 1 CHECK(level BETWEEN 1 AND 5),
  route_completed boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE suizamente_private.players ADD COLUMN IF NOT EXISTS include_general boolean NOT NULL DEFAULT true;
ALTER TABLE suizamente_private.players ADD COLUMN IF NOT EXISTS include_canton boolean NOT NULL DEFAULT true;
CREATE UNIQUE INDEX IF NOT EXISTS suizamente_alias_unique ON suizamente_private.players(lower(alias));
CREATE TABLE IF NOT EXISTS suizamente_private.questions (
  id text PRIMARY KEY, current_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS suizamente_private.versions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question_id text NOT NULL REFERENCES suizamente_private.questions(id), version integer NOT NULL,
  payload jsonb NOT NULL, annulled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(question_id,version)
);
CREATE TABLE IF NOT EXISTS suizamente_private.weeks (
  week_key date PRIMARY KEY, version_ids bigint[] NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS suizamente_private.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK(mode IN ('daily','practice','review','ascent','weekly')),
  day_key date NOT NULL, week_key date NOT NULL, level integer NOT NULL, canton text,
  category text, version_ids bigint[] NOT NULL, option_orders jsonb NOT NULL,
  position integer NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','abandoned')),
  rules jsonb NOT NULL, fallback boolean NOT NULL DEFAULT false,
  xp_gained integer NOT NULL DEFAULT 0, ascent_passed boolean,
  created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS suizamente_one_daily ON suizamente_private.sessions(user_id,day_key) WHERE mode='daily';
CREATE UNIQUE INDEX IF NOT EXISTS suizamente_one_ascent ON suizamente_private.sessions(user_id,day_key) WHERE mode='ascent';
CREATE UNIQUE INDEX IF NOT EXISTS suizamente_one_weekly ON suizamente_private.sessions(user_id,week_key) WHERE mode='weekly';
CREATE INDEX IF NOT EXISTS suizamente_sessions_owner ON suizamente_private.sessions(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS suizamente_private.answers (
  session_id uuid NOT NULL REFERENCES suizamente_private.sessions(id) ON DELETE CASCADE,
  position integer NOT NULL, version_id bigint NOT NULL REFERENCES suizamente_private.versions(id),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  choice integer NOT NULL CHECK(choice BETWEEN 0 AND 3), correct boolean NOT NULL,
  skipped boolean NOT NULL DEFAULT false,
  xp_received integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(session_id,position)
);
CREATE INDEX IF NOT EXISTS suizamente_answers_owner ON suizamente_private.answers(user_id,created_at);
ALTER TABLE suizamente_private.answers ADD COLUMN IF NOT EXISTS skipped boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS suizamente_private.progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id text NOT NULL REFERENCES suizamente_private.questions(id),
  first_version_id bigint NOT NULL REFERENCES suizamente_private.versions(id),
  last_version_id bigint NOT NULL REFERENCES suizamente_private.versions(id),
  first_correct boolean NOT NULL, last_correct boolean NOT NULL, ever_correct boolean NOT NULL,
  seen_count integer NOT NULL DEFAULT 1, first_at timestamptz NOT NULL DEFAULT now(), last_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,question_id)
);
CREATE TABLE IF NOT EXISTS suizamente_private.rewards (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, award_key text NOT NULL,
  amount integer NOT NULL, session_id uuid REFERENCES suizamente_private.sessions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,award_key)
);
CREATE TABLE IF NOT EXISTS suizamente_private.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version_id bigint NOT NULL REFERENCES suizamente_private.versions(id),
  reason text NOT NULL CHECK(reason IN ('incorrect','outdated','scope','other')),
  notes text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,version_id)
);
CREATE TABLE IF NOT EXISTS suizamente_private.audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id uuid, action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='suizamente_private' LOOP
    EXECUTE format('ALTER TABLE suizamente_private.%I ENABLE ROW LEVEL SECURITY',t.tablename);
    EXECUTE format('REVOKE ALL ON suizamente_private.%I FROM PUBLIC,anon,authenticated',t.tablename);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION suizamente_private.is_admin() RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE allowed boolean:=false;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM suizamente_private.admins WHERE user_id=auth.uid()) THEN RETURN true; END IF;
  IF to_regprocedure('public.is_business_promotion_admin()') IS NOT NULL THEN
    EXECUTE 'SELECT public.is_business_promotion_admin()' INTO allowed;
  END IF;
  RETURN coalesce(allowed,false);
END $$;

CREATE OR REPLACE FUNCTION suizamente_private.require_user() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); blocked boolean:=false;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'SZ_AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  IF to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE 'SELECT coalesce((to_jsonb(p)->>''banned'')::boolean,false) FROM public.profiles p WHERE id=$1' INTO blocked USING actor;
  END IF;
  IF coalesce(blocked,false) THEN RAISE EXCEPTION 'SZ_ACCOUNT_UNAVAILABLE' USING ERRCODE='42501'; END IF;
  RETURN actor;
END $$;

CREATE OR REPLACE FUNCTION suizamente_private.profile_canton(p_actor uuid) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE value text;
BEGIN
  SELECT upper(nullif(btrim(to_jsonb(u)->'raw_user_meta_data'->>'canton'),'')) INTO value FROM auth.users u WHERE u.id=p_actor;
  IF value=ANY(ARRAY['AG','AI','AR','BE','BL','BS','FR','GE','GL','GR','JU','LU','NE','NW','OW','SG','SH','SO','SZ','TG','TI','UR','VD','VS','ZG','ZH']) THEN RETURN value; END IF;
  IF to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE 'SELECT upper(nullif(btrim(to_jsonb(p)->>''canton''),'''')) FROM public.profiles p WHERE id=$1' INTO value USING p_actor;
  END IF;
  IF value=ANY(ARRAY['AG','AI','AR','BE','BL','BS','FR','GE','GL','GR','JU','LU','NE','NW','OW','SG','SH','SO','SZ','TG','TI','UR','VD','VS','ZG','ZH']) THEN RETURN value; END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION suizamente_private.ensure_player(p_actor uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  INSERT INTO suizamente_private.players(user_id,alias,canton)
  VALUES(p_actor,'Explorador-'||substr(md5(p_actor::text),1,10),suizamente_private.profile_canton(p_actor)) ON CONFLICT(user_id) DO NOTHING;
  UPDATE suizamente_private.players SET canton=suizamente_private.profile_canton(p_actor)
    WHERE user_id=p_actor AND canton IS NULL AND suizamente_private.profile_canton(p_actor) IS NOT NULL;
END $$;

CREATE OR REPLACE FUNCTION suizamente_private.write_question(p jsonb) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE qid text:=p->>'id'; n integer; previous jsonb;
BEGIN
  IF qid IS NULL OR qid !~ '^[a-z0-9][a-z0-9_-]{2,100}$'
    OR coalesce(p->>'category','') NOT IN ('administracion','vivienda','trabajo','salud','sociedad','idioma')
    OR coalesce(p->>'difficulty','') !~ '^[1-5]$'
    OR coalesce(p->>'scope','') NOT IN ('CH','canton')
    OR coalesce(p->>'status','') NOT IN ('draft','published','retired')
    OR coalesce(p->>'language','') NOT IN ('es','de','fr','it','rm')
    OR coalesce(p->>'correct_index','') !~ '^[0-4]$'
    OR coalesce(p->>'game_type','choice') NOT IN ('choice','false','tf','multi','match','image','order','short')
    OR length(coalesce(p->>'prompt','')) NOT BETWEEN 8 AND 700
    OR length(coalesce(p->>'explanation','')) NOT BETWEEN 8 AND 2500
    OR coalesce(p->>'source_url','') !~ '^https://[^[:space:]]+$'
    OR length(coalesce(p->>'source_title','')) NOT BETWEEN 2 AND 180
    OR coalesce(p->>'reviewed_at','') !~ '^\d{4}-\d{2}-\d{2}$'
    OR jsonb_typeof(p->'options') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'SZ_INVALID_QUESTION'; END IF;
  IF (CASE WHEN p->>'game_type'='short' THEN jsonb_array_length(p->'options')<>0 WHEN p->>'game_type'='order' THEN jsonb_array_length(p->'options') NOT BETWEEN 3 AND 8 WHEN p->>'game_type'='multi' THEN jsonb_array_length(p->'options') NOT BETWEEN 2 AND 5 ELSE jsonb_array_length(p->'options')<>CASE WHEN p->>'game_type'='tf' THEN 2 ELSE 4 END END) OR EXISTS(SELECT 1 FROM jsonb_array_elements(p->'options') o WHERE jsonb_typeof(o)<>'string' OR length(o#>>'{}') NOT BETWEEN 1 AND 500)
    OR (SELECT count(DISTINCT lower(btrim(o))) FROM jsonb_array_elements_text(p->'options') o)<>jsonb_array_length(p->'options')
    OR (p->>'game_type' IS DISTINCT FROM 'short' AND (p->>'correct_index')::integer>=jsonb_array_length(p->'options')) THEN RAISE EXCEPTION 'SZ_INVALID_OPTIONS'; END IF;
  IF p->>'game_type'='order' THEN
    IF jsonb_typeof(p->'correct_order') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'SZ_INVALID_OPTIONS'; END IF;
    IF jsonb_array_length(p->'correct_order')<>jsonb_array_length(p->'options')
      OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p->'correct_order') x WHERE x !~ '^[0-7]$' OR x::integer>=jsonb_array_length(p->'options'))
      OR (SELECT count(DISTINCT x) FROM jsonb_array_elements_text(p->'correct_order') x)<>jsonb_array_length(p->'options') THEN RAISE EXCEPTION 'SZ_INVALID_OPTIONS'; END IF;
  END IF;
  IF p->>'game_type'='short' THEN
    IF jsonb_typeof(p->'accepted_answers') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'SZ_INVALID_OPTIONS'; END IF;
    IF jsonb_array_length(p->'accepted_answers') NOT BETWEEN 1 AND 12 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p->'accepted_answers') x WHERE jsonb_typeof(x)<>'string' OR length(btrim(x#>>'{}')) NOT BETWEEN 1 AND 80) THEN RAISE EXCEPTION 'SZ_INVALID_OPTIONS'; END IF;
    IF p ? 'max_length' AND coalesce(p->>'max_length','') !~ '^([1-9]|[1-7][0-9]|80)$' THEN RAISE EXCEPTION 'SZ_INVALID_OPTIONS'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(p->'accepted_answers') x WHERE x !~ '[^[:space:]]' OR length(x)>coalesce((p->>'max_length')::integer,80)) THEN RAISE EXCEPTION 'SZ_INVALID_OPTIONS'; END IF;
  END IF;
  IF p->>'game_type'='multi' THEN
    IF jsonb_typeof(p->'correct_indices') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'SZ_INVALID_OPTIONS'; END IF;
    IF jsonb_array_length(p->'correct_indices') NOT BETWEEN 1 AND 4 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p->'correct_indices') x WHERE x !~ '^[0-4]$' OR x::integer>=jsonb_array_length(p->'options'))
      OR (SELECT count(DISTINCT x) FROM jsonb_array_elements_text(p->'correct_indices') x)<>jsonb_array_length(p->'correct_indices') THEN RAISE EXCEPTION 'SZ_INVALID_OPTIONS'; END IF;
  END IF;
  IF p->>'game_type'='match' THEN
    IF jsonb_typeof(p->'pairs') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'SZ_INVALID_OPTIONS'; END IF;
    IF jsonb_array_length(p->'pairs')<>4 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p->'pairs') x WHERE jsonb_typeof(x)<>'string' OR length(x#>>'{}') NOT BETWEEN 1 AND 500)
      OR (SELECT count(DISTINCT x) FROM jsonb_array_elements_text(p->'pairs') x)<>4 THEN RAISE EXCEPTION 'SZ_INVALID_OPTIONS'; END IF;
  END IF;
  IF p ? 'image_key' AND p->>'image_key' NOT IN ('ag-interview-card','ag-roman-kit','ag-thermal-pool','ag-three-rivers','ag-water-castle','ai-cave-chapel','ai-cheese-pasta','ai-embroidery-light','ai-open-assembly','ai-senn-costume','aletsch-glacier','apricot','ar-bloch','ar-detour-notice','ar-hackbrett','ar-naturchlaus','ar-rack-rail','basel-munster','bebbi-bag','bellinzona-fortress','berg','bern-arcades','bern-covered-bridge','bilingual-station','bisse-channel','boogg','carnival-mask','chapel-bridge','chienbase','chillon','cuchaule','dixence-dam','emmentaler','fasnacht-lantern','flower-clock','forest-leash','gl-green-cheese','gl-printed-cloth','gl-rock-layers','gl-rock-window','gl-wildlife-notice','gr-capuns','gr-ibex','gr-landwasser','gr-nusstorte','gr-sgraffito','green-bin','grossmunster','hypocaust','italian-closed','jet-deau','ju-cream-tart','ju-horse-carriage','ju-lost-property','ju-medieval-bridge','ju-peat-bog','laundry-notice','lavaux','lion-monument','lu-shield','marine-fossil','marmite','mobilis-ticket','moor','mouette','ne-french-class','ne-pile-dwelling','ne-river-gorge','ne-rock-cirque','ne-watch-bench','night-tram','nw-clean-after-use','nw-cliff-lift','nw-glass-blowing','nw-open-deck','nw-paper-calendar','onion-braid','ow-alpine-descent','ow-carnival-mask','ow-centre-marker','ow-viewing-notice','ow-water-saw','paper-sieve','papet','pet','polenta','poya-panel','priority','raclette-half','rhine-ferry','roman-theatre','sg-bratwurst','sg-embroidery','sg-library','sg-shop-hours','sg-wooden-walkway','sh-bay-window','sh-laundry-friday','sh-painted-houses','sh-rhine-falls','sh-round-fortress','so-eleven-clock','so-hermit-gorge','so-leash-notice','so-stork-roof','so-underground-bin','stained-glass','stop','sz-cave-group','sz-library-notice','sz-paper-calendar','sz-potato-bake','sz-stoos-funicular','tg-apple-press','tg-arenenberg-house','tg-car-ferry','tg-carthusian-cloister','tg-historic-truck','ti-shield','ur-aurochs-shield','ur-crossbow','ur-devils-bridge','ur-pass-closed','ur-wild-hay','vd-shield','water-funicular','yield','zg-cave-drips','zg-cherry-race','zg-clock-tower','zg-kirsch-cake','zg-pile-dwelling','zh','zvv-ticket','zytglogge') THEN RAISE EXCEPTION 'SZ_INVALID_QUESTION'; END IF;
  IF p->>'game_type'='image' AND coalesce(p->>'image_key','') NOT IN ('ag-interview-card','ag-roman-kit','ag-thermal-pool','ag-three-rivers','ag-water-castle','ai-cave-chapel','ai-cheese-pasta','ai-embroidery-light','ai-open-assembly','ai-senn-costume','aletsch-glacier','apricot','ar-bloch','ar-detour-notice','ar-hackbrett','ar-naturchlaus','ar-rack-rail','basel-munster','bebbi-bag','bellinzona-fortress','berg','bern-arcades','bern-covered-bridge','bilingual-station','bisse-channel','boogg','carnival-mask','chapel-bridge','chienbase','chillon','cuchaule','dixence-dam','emmentaler','fasnacht-lantern','flower-clock','forest-leash','gl-green-cheese','gl-printed-cloth','gl-rock-layers','gl-rock-window','gl-wildlife-notice','gr-capuns','gr-ibex','gr-landwasser','gr-nusstorte','gr-sgraffito','green-bin','grossmunster','hypocaust','italian-closed','jet-deau','ju-cream-tart','ju-horse-carriage','ju-lost-property','ju-medieval-bridge','ju-peat-bog','laundry-notice','lavaux','lion-monument','lu-shield','marine-fossil','marmite','mobilis-ticket','moor','mouette','ne-french-class','ne-pile-dwelling','ne-river-gorge','ne-rock-cirque','ne-watch-bench','night-tram','nw-clean-after-use','nw-cliff-lift','nw-glass-blowing','nw-open-deck','nw-paper-calendar','onion-braid','ow-alpine-descent','ow-carnival-mask','ow-centre-marker','ow-viewing-notice','ow-water-saw','paper-sieve','papet','pet','polenta','poya-panel','priority','raclette-half','rhine-ferry','roman-theatre','sg-bratwurst','sg-embroidery','sg-library','sg-shop-hours','sg-wooden-walkway','sh-bay-window','sh-laundry-friday','sh-painted-houses','sh-rhine-falls','sh-round-fortress','so-eleven-clock','so-hermit-gorge','so-leash-notice','so-stork-roof','so-underground-bin','stained-glass','stop','sz-cave-group','sz-library-notice','sz-paper-calendar','sz-potato-bake','sz-stoos-funicular','tg-apple-press','tg-arenenberg-house','tg-car-ferry','tg-carthusian-cloister','tg-historic-truck','ti-shield','ur-aurochs-shield','ur-crossbow','ur-devils-bridge','ur-pass-closed','ur-wild-hay','vd-shield','water-funicular','yield','zg-cave-drips','zg-cherry-race','zg-clock-tower','zg-kirsch-cake','zg-pile-dwelling','zh','zvv-ticket','zytglogge') THEN RAISE EXCEPTION 'SZ_INVALID_QUESTION'; END IF;
  IF p->>'scope'='canton' AND coalesce(p->>'canton','')<>ALL(ARRAY['AG','AI','AR','BE','BL','BS','FR','GE','GL','GR','JU','LU','NE','NW','OW','SG','SH','SO','SZ','TG','TI','UR','VD','VS','ZG','ZH']) THEN RAISE EXCEPTION 'SZ_INVALID_CANTON'; END IF;
  IF p->>'scope'='CH' THEN p:=jsonb_set(p,'{canton}','null'); END IF;
  IF p ? 'arrival_level' AND (coalesce(p->>'arrival_level','') !~ '^[1-5]$' OR p->>'scope'<>'CH') THEN RAISE EXCEPTION 'SZ_INVALID_QUESTION'; END IF;
  IF coalesce(p->>'game_type','choice')<>'choice' OR p ? 'arrival_level' THEN p:=p||'{"game_only":true}'::jsonb; END IF;
  IF nullif(p->>'guide_path','') IS NOT NULL AND p->>'guide_path' !~ '^/(guias|paquetes)(/[a-z0-9-]+)?$' THEN RAISE EXCEPTION 'SZ_INVALID_GUIDE'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('sz-question-'||qid));
  SELECT v.payload INTO previous FROM suizamente_private.questions q JOIN suizamente_private.versions v ON v.question_id=q.id AND v.version=q.current_version WHERE q.id=qid;
  IF previous=p THEN RETURN qid; END IF;
  INSERT INTO suizamente_private.questions(id) VALUES(qid) ON CONFLICT DO NOTHING;
  SELECT coalesce(max(version),0)+1 INTO n FROM suizamente_private.versions WHERE question_id=qid;
  INSERT INTO suizamente_private.versions(question_id,version,payload) VALUES(qid,n,p);
  UPDATE suizamente_private.questions SET current_version=n,updated_at=now() WHERE id=qid;
  RETURN qid;
END $$;

CREATE OR REPLACE FUNCTION suizamente_private.session_view(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s suizamente_private.sessions; v suizamente_private.versions; a suizamente_private.answers;
  choices jsonb; feedback jsonb:=null; history jsonb; states jsonb; reviews jsonb; correct_count integer; annulled_count integer; result jsonb;
BEGIN
  SELECT * INTO s FROM suizamente_private.sessions WHERE id=p_id AND user_id=auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'SZ_SESSION_NOT_FOUND' USING ERRCODE='42501'; END IF;
  IF s.rules->>'game_version'='4' THEN RETURN suizamente_private.game_view(p_id); END IF;
  SELECT * INTO v FROM suizamente_private.versions WHERE id=s.version_ids[s.position+1];
  SELECT jsonb_agg(v.payload->'options'->(n.value::text::integer) ORDER BY n.ordinality) INTO choices
    FROM jsonb_array_elements(s.option_orders->v.id::text) WITH ORDINALITY n;
  SELECT * INTO a FROM suizamente_private.answers WHERE session_id=s.id AND position=s.position;
  IF FOUND THEN
    feedback:=jsonb_build_object('choice',CASE WHEN a.skipped THEN NULL ELSE a.choice END,'skipped',a.skipped,'correct',a.correct,'xp',a.xp_received,
      'correct_option',(SELECT (n.ordinality-1)::integer FROM jsonb_array_elements(s.option_orders->v.id::text) WITH ORDINALITY n WHERE n.value::text::integer=(v.payload->>'correct_index')::integer),
      'explanation',v.payload->>'explanation','source_url',v.payload->>'source_url','source_title',v.payload->>'source_title','guide_path',v.payload->>'guide_path','annulled',v.annulled);
  END IF;
  SELECT coalesce(jsonb_agg(ans.correct AND NOT av.annulled ORDER BY ans.position),'[]'::jsonb),count(*) FILTER(WHERE ans.correct AND NOT av.annulled),count(*) FILTER(WHERE av.annulled)
    INTO history,correct_count,annulled_count FROM suizamente_private.answers ans JOIN suizamente_private.versions av ON av.id=ans.version_id WHERE ans.session_id=s.id;
  SELECT coalesce(jsonb_agg(CASE WHEN av.annulled THEN 'annulled' WHEN ans.skipped THEN 'skipped' WHEN ans.correct THEN 'correct' ELSE 'wrong' END ORDER BY ans.position),'[]'::jsonb)
    INTO states FROM suizamente_private.answers ans JOIN suizamente_private.versions av ON av.id=ans.version_id WHERE ans.session_id=s.id;
  IF s.status='completed' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('position',ans.position,'prompt',av.payload->>'prompt','category',av.payload->>'category',
      'correct',ans.correct AND NOT av.annulled,'skipped',ans.skipped,'annulled',av.annulled,'xp',ans.xp_received,
      'chosen_answer',CASE WHEN ans.skipped THEN NULL ELSE av.payload->'options'->((s.option_orders->av.id::text->>ans.choice)::integer) END,
      'correct_answer',av.payload->'options'->((av.payload->>'correct_index')::integer),'explanation',av.payload->>'explanation',
      'source_url',av.payload->>'source_url','source_title',av.payload->>'source_title') ORDER BY ans.position),'[]'::jsonb)
      INTO reviews FROM suizamente_private.answers ans JOIN suizamente_private.versions av ON av.id=ans.version_id WHERE ans.session_id=s.id;
  END IF;
  result:=jsonb_build_object('id',s.id,'mode',s.mode,'status',s.status,'position',s.position,'total',cardinality(s.version_ids),
    'level',s.level,'canton',s.canton,'category',s.category,'fallback',s.fallback,'include_general',coalesce((s.rules->>'include_general')::boolean,true),'include_canton',coalesce((s.rules->>'include_canton')::boolean,true),'xp_gained',s.xp_gained,'ascent_passed',s.ascent_passed,
    'day',s.day_key,'week',s.week_key,'history',history,'states',states,'review_answers',reviews,'correct_count',correct_count,'annulled_count',annulled_count,
    'question',jsonb_build_object('version_id',v.id,'id',v.question_id,'category',v.payload->>'category','difficulty',(v.payload->>'difficulty')::integer,
      'scope',v.payload->>'scope','canton',v.payload->>'canton','language',v.payload->>'language','prompt',v.payload->>'prompt','options',choices),
    'answer',feedback);
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION suizamente_private.start_session(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE actor uuid:=suizamente_private.require_user(); pl suizamente_private.players; cfg suizamente_private.config;
  mode text:=coalesce(p->>'mode','daily'); category text:=nullif(p->>'category','');
  day_key date:=(now() AT TIME ZONE 'Europe/Zurich')::date;
  week_key date:=date_trunc('week',now() AT TIME ZONE 'Europe/Zurich')::date;
  ids bigint[]:='{}'; chosen bigint; s_id uuid; orders jsonb; topic text; d integer; target integer; n integer;
  difficulty_slots integer[]; local_count integer:=0; fallback boolean:=false;
  filter_sources boolean; desired_local integer;
BEGIN
  PERFORM suizamente_private.ensure_player(actor);
  SELECT * INTO pl FROM suizamente_private.players WHERE user_id=actor FOR UPDATE;
  SELECT * INTO cfg FROM suizamente_private.config WHERE id;
  IF NOT cfg.enabled THEN RAISE EXCEPTION 'SZ_PAUSED'; END IF;
  IF mode NOT IN ('daily','practice','review','ascent','weekly') THEN RAISE EXCEPTION 'SZ_INVALID_MODE'; END IF;
  IF category IS NOT NULL AND category NOT IN ('administracion','vivienda','trabajo','salud','sociedad','idioma') THEN RAISE EXCEPTION 'SZ_INVALID_CATEGORY'; END IF;
  IF mode NOT IN ('practice','review') THEN category:=NULL; END IF;
  filter_sources:=mode IN ('daily','practice') AND category IS DISTINCT FROM 'idioma';
  desired_local:=CASE WHEN pl.include_canton AND pl.canton IS NOT NULL THEN CASE WHEN pl.include_general THEN 2 ELSE 5 END ELSE 0 END;
  IF mode IN ('daily','ascent','weekly') THEN
    SELECT id INTO s_id FROM suizamente_private.sessions s WHERE s.user_id=actor AND s.mode=mode
      AND ((mode='weekly' AND s.week_key=week_key) OR (mode<>'weekly' AND s.day_key=day_key)) LIMIT 1;
    IF s_id IS NOT NULL THEN RETURN suizamente_private.session_view(s_id); END IF;
  ELSE
    SELECT id INTO s_id FROM suizamente_private.sessions s WHERE s.user_id=actor AND s.mode=mode AND s.status='active'
      AND s.category IS NOT DISTINCT FROM category AND s.canton IS NOT DISTINCT FROM pl.canton
      AND (NOT filter_sources OR coalesce((s.rules->>'include_general')::boolean,true)=pl.include_general AND coalesce((s.rules->>'include_canton')::boolean,true)=pl.include_canton)
      ORDER BY created_at DESC LIMIT 1;
    IF s_id IS NOT NULL THEN RETURN suizamente_private.session_view(s_id); END IF;
  END IF;
  IF (SELECT count(*) FROM suizamente_private.sessions WHERE user_id=actor AND created_at>now()-interval '1 hour')>=60 THEN RAISE EXCEPTION 'SZ_RATE_LIMIT'; END IF;
  IF mode='weekly' THEN
    PERFORM pg_advisory_xact_lock(hashtext('sz-week-'||week_key::text));
    SELECT w.version_ids INTO ids FROM suizamente_private.weeks w WHERE w.week_key=week_key;
    IF ids IS NULL THEN
      ids:='{}';
      FOR d IN 1..5 LOOP
        FOR n IN 1..2 LOOP
          SELECT v.id INTO chosen FROM suizamente_private.questions q JOIN suizamente_private.versions v ON v.question_id=q.id AND v.version=q.current_version
          WHERE v.payload->>'status'='published' AND NOT v.annulled AND coalesce(v.payload->>'game_only','false')<>'true' AND v.payload->>'scope'='CH' AND v.payload->>'category'<>'idioma'
            AND (v.payload->>'difficulty')::integer=d AND NOT v.id=ANY(ids)
          ORDER BY md5(q.id||week_key::text) LIMIT 1;
          IF chosen IS NULL THEN RAISE EXCEPTION 'SZ_NOT_ENOUGH_QUESTIONS'; END IF;
          ids:=array_append(ids,chosen);
        END LOOP;
      END LOOP;
      INSERT INTO suizamente_private.weeks(week_key,version_ids) VALUES(week_key,ids);
    END IF;
  ELSIF mode='ascent' THEN
    IF pl.route_completed THEN RAISE EXCEPTION 'SZ_ROUTE_COMPLETED'; END IF;
    IF pl.xp<cfg.thresholds[pl.level] THEN RAISE EXCEPTION 'SZ_XP_REQUIRED'; END IF;
    FOREACH topic IN ARRAY ARRAY['administracion','vivienda','trabajo','salud','sociedad'] LOOP
      FOR n IN 1..2 LOOP
        SELECT v.id INTO chosen FROM suizamente_private.questions q JOIN suizamente_private.versions v ON v.question_id=q.id AND v.version=q.current_version
        WHERE v.payload->>'status'='published' AND NOT v.annulled AND coalesce(v.payload->>'game_only','false')<>'true' AND v.payload->>'category'=topic
          AND (v.payload->>'difficulty')::integer=pl.level AND (v.payload->>'scope'='CH' OR v.payload->>'canton'=pl.canton) AND NOT v.id=ANY(ids)
        ORDER BY random() LIMIT 1;
        IF chosen IS NULL THEN RAISE EXCEPTION 'SZ_NOT_ENOUGH_QUESTIONS'; END IF;
        ids:=array_append(ids,chosen);
      END LOOP;
    END LOOP;
  ELSE
    difficulty_slots:=CASE WHEN pl.level=1 THEN ARRAY[1,1,1,1,2] WHEN pl.level=5 THEN ARRAY[4,5,5,5,5] ELSE ARRAY[pl.level-1,pl.level,pl.level,pl.level,pl.level+1] END;
    FOR n IN 1..5 LOOP
      target:=CASE WHEN mode='daily' THEN difficulty_slots[n] ELSE pl.level END;
      SELECT v.id INTO chosen FROM suizamente_private.questions q JOIN suizamente_private.versions v ON v.question_id=q.id AND v.version=q.current_version
      LEFT JOIN suizamente_private.progress progress ON progress.user_id=actor AND progress.question_id=q.id
      WHERE v.payload->>'status'='published' AND NOT v.annulled AND coalesce(v.payload->>'game_only','false')<>'true' AND NOT v.id=ANY(ids)
        AND (v.payload->>'scope'='CH' OR v.payload->>'canton'=pl.canton)
        AND (NOT filter_sources OR v.payload->>'scope'='CH' OR pl.include_canton AND v.payload->>'canton'=pl.canton)
        AND (mode<>'daily' OR v.payload->>'scope'='CH' OR (v.payload->>'difficulty')::integer>=greatest(1,pl.level-1))
        AND (category IS NULL AND (mode='review' OR v.payload->>'category'<>'idioma') OR v.payload->>'category'=category)
        AND (mode<>'review' OR progress.last_correct IS FALSE AND EXISTS(SELECT 1 FROM suizamente_private.versions previous WHERE previous.id=progress.last_version_id AND NOT previous.annulled))
        AND (mode='review' OR (v.payload->>'difficulty')::integer<=CASE WHEN mode='daily' THEN least(pl.level+1,5) ELSE pl.level END)
      ORDER BY
        CASE WHEN filter_sources AND pl.include_canton AND pl.canton IS NOT NULL AND (mode='daily' OR NOT pl.include_general)
          THEN CASE WHEN NOT pl.include_general OR n>3 THEN CASE WHEN v.payload->>'canton'=pl.canton THEN 0 ELSE 1 END ELSE CASE WHEN v.payload->>'scope'='CH' THEN 0 ELSE 1 END END ELSE 0 END,
        CASE WHEN mode IN ('practice','review') AND progress.last_correct IS FALSE THEN 0 WHEN progress.question_id IS NULL THEN 1 ELSE 2 END,
        abs((v.payload->>'difficulty')::integer-target),
        CASE WHEN progress.question_id IS NULL THEN 0 ELSE 1 END,
        md5(q.id||actor::text||CASE WHEN mode='daily' THEN day_key::text ELSE clock_timestamp()::text END)
      LIMIT 1;
      IF chosen IS NULL THEN EXIT; END IF;
      ids:=array_append(ids,chosen);
    END LOOP;
    IF cardinality(ids)=0 THEN RAISE EXCEPTION 'SZ_NO_QUESTIONS'; END IF;
    IF mode<>'review' AND cardinality(ids)<5 THEN RAISE EXCEPTION 'SZ_NOT_ENOUGH_QUESTIONS'; END IF;
    SELECT count(*) INTO local_count FROM suizamente_private.versions WHERE id=ANY(ids) AND payload->>'scope'='canton';
    fallback:=filter_sources AND desired_local>0 AND local_count<desired_local AND (mode='daily' OR NOT pl.include_general);
  END IF;
  SELECT jsonb_object_agg(vid::text,(SELECT jsonb_agg(i ORDER BY random()) FROM generate_series(0,3) i)) INTO orders FROM unnest(ids) vid;
  INSERT INTO suizamente_private.sessions(user_id,mode,day_key,week_key,level,canton,category,version_ids,option_orders,rules,fallback)
  VALUES(actor,mode,day_key,week_key,pl.level,pl.canton,category,ids,orders,
    jsonb_build_object('xp_weights',cfg.xp_weights,'daily_bonus',cfg.daily_bonus,'include_general',pl.include_general,'include_canton',pl.include_canton),fallback) RETURNING id INTO s_id;
  RETURN suizamente_private.session_view(s_id);
END $$;

CREATE OR REPLACE FUNCTION suizamente_private.answer(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE actor uuid:=suizamente_private.require_user(); s suizamente_private.sessions; v suizamente_private.versions;
  pl suizamente_private.players; position integer; choice integer; actual integer; correct boolean;
  reward integer:=0; bonus integer:=0; affected integer; passes boolean; correct_count integer; topic_count integer;
  skipped boolean:=coalesce((p->>'skip')::boolean,false);
  today date:=(now() AT TIME ZONE 'Europe/Zurich')::date;
BEGIN
  PERFORM suizamente_private.ensure_player(actor);
  SELECT * INTO pl FROM suizamente_private.players WHERE user_id=actor FOR UPDATE;
  SELECT * INTO s FROM suizamente_private.sessions WHERE id=(p->>'session_id')::uuid AND user_id=actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SZ_SESSION_NOT_FOUND' USING ERRCODE='42501'; END IF;
  IF coalesce(p->>'position','') !~ '^\d{1,3}$' OR NOT skipped AND coalesce(p->>'choice','') !~ '^[0-3]$' THEN RAISE EXCEPTION 'SZ_INVALID_ANSWER'; END IF;
  position:=(p->>'position')::integer; choice:=CASE WHEN skipped THEN 0 ELSE (p->>'choice')::integer END;
  IF position<>s.position THEN RAISE EXCEPTION 'SZ_QUESTION_CHANGED'; END IF;
  IF EXISTS(SELECT 1 FROM suizamente_private.answers WHERE session_id=s.id AND answers.position=position) THEN RETURN suizamente_private.session_view(s.id); END IF;
  IF s.status<>'active' THEN RAISE EXCEPTION 'SZ_SESSION_CLOSED'; END IF;
  SELECT * INTO v FROM suizamente_private.versions WHERE id=s.version_ids[position+1];
  actual:=(s.option_orders->v.id::text->>choice)::integer;
  correct:=NOT skipped AND actual=(v.payload->>'correct_index')::integer AND NOT v.annulled;
  IF correct AND s.mode<>'weekly' AND v.payload->>'category'<>'idioma' THEN
    reward:=(s.rules->'xp_weights'->>((v.payload->>'difficulty')::integer-1))::integer;
    INSERT INTO suizamente_private.rewards(user_id,award_key,amount,session_id) VALUES(actor,'question:'||v.question_id,reward,s.id) ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS affected=ROW_COUNT; IF affected=0 THEN reward:=0; END IF;
  END IF;
  INSERT INTO suizamente_private.answers(session_id,position,version_id,user_id,choice,correct,skipped,xp_received) VALUES(s.id,position,v.id,actor,choice,correct,skipped,reward);
  INSERT INTO suizamente_private.progress(user_id,question_id,first_version_id,last_version_id,first_correct,last_correct,ever_correct)
    VALUES(actor,v.question_id,v.id,v.id,correct,correct,correct)
    ON CONFLICT(user_id,question_id) DO UPDATE SET last_version_id=excluded.last_version_id,last_correct=excluded.last_correct,
      ever_correct=progress.ever_correct OR excluded.ever_correct,seen_count=progress.seen_count+1,last_at=now();
  IF position=cardinality(s.version_ids)-1 THEN
    IF s.mode='daily' AND s.day_key=today THEN
      bonus:=(s.rules->>'daily_bonus')::integer;
      INSERT INTO suizamente_private.rewards(user_id,award_key,amount,session_id) VALUES(actor,'daily:'||s.day_key::text,bonus,s.id) ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS affected=ROW_COUNT; IF affected=0 THEN bonus:=0; END IF;
    END IF;
    IF s.mode='ascent' THEN
      SELECT count(*) FILTER(WHERE a.correct),count(DISTINCT v2.payload->>'category') FILTER(WHERE a.correct)
        INTO correct_count,topic_count FROM suizamente_private.answers a JOIN suizamente_private.versions v2 ON v2.id=a.version_id WHERE a.session_id=s.id;
      passes:=correct_count>=8 AND topic_count=5;
      IF passes AND pl.level=s.level THEN
        UPDATE suizamente_private.players SET level=least(level+1,5),route_completed=(level=5) WHERE user_id=actor;
      END IF;
    END IF;
    UPDATE suizamente_private.sessions SET status='completed',completed_at=now(),ascent_passed=passes WHERE id=s.id;
  END IF;
  UPDATE suizamente_private.sessions SET xp_gained=xp_gained+reward+bonus WHERE id=s.id;
  UPDATE suizamente_private.players SET xp=xp+reward+bonus WHERE user_id=actor;
  RETURN suizamente_private.session_view(s.id);
END $$;

CREATE OR REPLACE FUNCTION suizamente_private.summary(p jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); pl suizamente_private.players; cfg suizamente_private.config;
  coverage jsonb; categories jsonb; review jsonb; stats jsonb; daily jsonb; weekly jsonb; ascent jsonb; active jsonb;
  scope_filter text:=coalesce(p->>'scope','all'); level_filter integer:=coalesce((p->>'level')::integer,0);
BEGIN
  SELECT * INTO cfg FROM suizamente_private.config WHERE id;
  SELECT coalesce(jsonb_object_agg(canton,total),'{}'::jsonb) INTO coverage FROM (
    SELECT v.payload->>'canton' canton,count(*) total FROM suizamente_private.questions q JOIN suizamente_private.versions v ON v.question_id=q.id AND v.version=q.current_version
    WHERE v.payload->>'scope'='canton' AND v.payload->>'status'='published' AND NOT v.annulled GROUP BY v.payload->>'canton') c;
  IF actor IS NULL THEN RETURN jsonb_build_object('config',(to_jsonb(cfg)-'id')||'{"schema_version":3}'::jsonb,'coverage',coverage); END IF;
  PERFORM suizamente_private.require_user();
  SELECT * INTO pl FROM suizamente_private.players WHERE user_id=actor;
  -- Reading the Home/Profile preview must not create a game record.
  IF NOT FOUND THEN
    pl.user_id:=actor; pl.alias:='Explorador-'||substr(md5(actor::text),1,10);
    pl.xp:=0; pl.level:=1; pl.route_completed:=false; pl.leaderboard_opt_in:=false;
    pl.include_general:=true; pl.include_canton:=true;
  END IF;
  IF pl.canton IS NULL THEN pl.canton:=suizamente_private.profile_canton(actor); END IF;
  WITH initial AS (
    SELECT pr.*,v.payload,NOT previous.annulled AND NOT current.annulled AND current.payload->>'status'='published'
      AND (current.payload->>'scope'='CH' OR current.payload->>'canton'=pl.canton) reviewable
    FROM suizamente_private.progress pr JOIN suizamente_private.versions v ON v.id=pr.first_version_id
    JOIN suizamente_private.versions previous ON previous.id=pr.last_version_id
    JOIN suizamente_private.questions q ON q.id=pr.question_id
    JOIN suizamente_private.versions current ON current.question_id=q.id AND current.version=q.current_version
    WHERE pr.user_id=actor AND NOT v.annulled AND (scope_filter='all' OR scope_filter='CH' AND v.payload->>'scope'='CH' OR scope_filter='canton' AND v.payload->>'canton'=pl.canton)
      AND (level_filter=0 OR (v.payload->>'difficulty')::integer=level_filter)
  ), totals AS (
    SELECT payload->>'category' category,count(*) seen,count(*) FILTER(WHERE first_correct) first_correct,
      count(*) FILTER(WHERE ever_correct) ever_correct,count(*) FILTER(WHERE NOT last_correct AND reviewable) pending FROM initial GROUP BY payload->>'category'
  ), recent AS (
    SELECT *,row_number() OVER(PARTITION BY payload->>'category' ORDER BY first_at DESC) rn FROM initial
  ) SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.category,'seen',coalesce(t.seen,0),'first_correct',coalesce(t.first_correct,0),
      'ever_correct',coalesce(t.ever_correct,0),'pending',coalesce(t.pending,0),
      'recent_seen',(SELECT count(*) FROM recent r WHERE r.payload->>'category'=c.category AND rn<=20),
      'recent_correct',(SELECT count(*) FROM recent r WHERE r.payload->>'category'=c.category AND rn<=20 AND r.first_correct)) ORDER BY c.ordering),'[]'::jsonb)
    INTO categories FROM unnest(ARRAY['administracion','vivienda','trabajo','salud','sociedad','idioma']) WITH ORDINALITY c(category,ordering) LEFT JOIN totals t ON t.category=c.category;
  SELECT coalesce(jsonb_agg(r),'[]'::jsonb) INTO review FROM (
    SELECT v.question_id,v.id version_id,v.payload->>'prompt' prompt,v.payload->>'category' category,v.payload->>'scope' scope,v.payload->>'canton' canton
    FROM suizamente_private.progress pr JOIN suizamente_private.versions previous ON previous.id=pr.last_version_id
    JOIN suizamente_private.questions q ON q.id=pr.question_id
    JOIN suizamente_private.versions v ON v.question_id=q.id AND v.version=q.current_version
    WHERE pr.user_id=actor AND NOT pr.last_correct AND NOT previous.annulled AND NOT v.annulled AND v.payload->>'status'='published'
      AND (v.payload->>'scope'='CH' OR v.payload->>'canton'=pl.canton) ORDER BY pr.last_at DESC) r;
  WITH days AS (SELECT DISTINCT (created_at AT TIME ZONE 'Europe/Zurich')::date d FROM suizamente_private.answers WHERE user_id=actor),
    anchor AS (SELECT CASE WHEN EXISTS(SELECT 1 FROM days WHERE d=(now() AT TIME ZONE 'Europe/Zurich')::date) THEN (now() AT TIME ZONE 'Europe/Zurich')::date ELSE (now() AT TIME ZONE 'Europe/Zurich')::date-1 END d),
    numbered AS (SELECT d,row_number() OVER(ORDER BY d DESC) rn FROM days WHERE d<=(SELECT d FROM anchor))
    SELECT jsonb_build_object(
      'seen',(SELECT count(*) FROM suizamente_private.progress pr JOIN suizamente_private.versions v ON v.id=pr.first_version_id WHERE pr.user_id=actor AND NOT v.annulled),
      'ever_correct',(SELECT count(*) FROM suizamente_private.progress pr JOIN suizamente_private.versions v ON v.id=pr.first_version_id WHERE pr.user_id=actor AND pr.ever_correct AND NOT v.annulled),
      'first_correct',(SELECT count(*) FROM suizamente_private.progress pr JOIN suizamente_private.versions v ON v.id=pr.first_version_id WHERE pr.user_id=actor AND pr.first_correct AND NOT v.annulled),
      'pending',jsonb_array_length(review),
      'top_topic_correct',(SELECT coalesce(max(n),0) FROM (
        SELECT count(*) n FROM suizamente_private.progress pr JOIN suizamente_private.versions v ON v.id=pr.first_version_id
        WHERE pr.user_id=actor AND pr.ever_correct AND NOT v.annulled AND v.payload->>'category'<>'idioma' GROUP BY v.payload->>'category') t),
      'active_days',(SELECT count(*) FROM days),
      'streak',(SELECT count(*) FROM numbered WHERE d=(SELECT d FROM anchor)-(rn::integer-1)),
      'completed_sessions',(SELECT count(*) FROM suizamente_private.sessions WHERE user_id=actor AND status='completed'),
      'daily_completed',(SELECT count(*) FROM suizamente_private.sessions WHERE user_id=actor AND mode='daily' AND status='completed'),
      'weekly_completed',(SELECT count(*) FROM suizamente_private.sessions WHERE user_id=actor AND mode='weekly' AND status='completed')
    ) INTO stats;
  SELECT jsonb_build_object('id',s.id,'status',s.status,'fallback',s.fallback,'position',s.position,'total',cardinality(s.version_ids),'xp_gained',s.xp_gained,
    'canton',s.canton,'include_general',coalesce((s.rules->>'include_general')::boolean,true),'include_canton',coalesce((s.rules->>'include_canton')::boolean,true),
    'states',(SELECT coalesce(jsonb_agg(CASE WHEN ans.skipped THEN 'skipped' WHEN ans.correct THEN 'correct' ELSE 'wrong' END ORDER BY ans.position),'[]'::jsonb) FROM suizamente_private.answers ans WHERE ans.session_id=s.id))
    INTO daily FROM suizamente_private.sessions s WHERE s.user_id=actor AND s.mode='daily' AND s.day_key=(now() AT TIME ZONE 'Europe/Zurich')::date;
  SELECT jsonb_build_object('id',id,'status',status) INTO weekly FROM suizamente_private.sessions WHERE user_id=actor AND mode='weekly' AND week_key=date_trunc('week',now() AT TIME ZONE 'Europe/Zurich')::date;
  SELECT jsonb_build_object('id',id,'status',status,'level',level,'passed',ascent_passed) INTO ascent FROM suizamente_private.sessions WHERE user_id=actor AND mode='ascent' AND day_key=(now() AT TIME ZONE 'Europe/Zurich')::date;
  SELECT jsonb_build_object('id',id,'mode',mode) INTO active FROM suizamente_private.sessions WHERE user_id=actor AND status='active' ORDER BY created_at DESC LIMIT 1;
  RETURN jsonb_build_object('player',to_jsonb(pl),'profile_canton',suizamente_private.profile_canton(actor),'config',(to_jsonb(cfg)-'id')||'{"schema_version":3}'::jsonb,'coverage',coverage,'categories',categories,'review',review,'stats',stats,'daily',daily,'weekly',weekly,'ascent',ascent,'active',active);
END $$;

CREATE OR REPLACE FUNCTION suizamente_private.leaderboard() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE week_key date:=date_trunc('week',now() AT TIME ZONE 'Europe/Zurich')::date; result jsonb;
BEGIN
  WITH scores AS (
    SELECT s.user_id,p.alias,p.leaderboard_opt_in,
      count(*) FILTER(WHERE a.correct AND NOT v.annulled)*10 score,count(*) FILTER(WHERE NOT v.annulled)*10 maximum
    FROM suizamente_private.sessions s JOIN suizamente_private.players p ON p.user_id=s.user_id
    JOIN suizamente_private.answers a ON a.session_id=s.id JOIN suizamente_private.versions v ON v.id=a.version_id
    WHERE s.mode='weekly' AND s.status='completed' AND s.week_key=week_key GROUP BY s.user_id,p.alias,p.leaderboard_opt_in
  ), ranked AS (SELECT *,rank() OVER(ORDER BY score DESC) position FROM scores WHERE leaderboard_opt_in)
  SELECT jsonb_build_object('week',week_key,
    'rows',coalesce((SELECT jsonb_agg(jsonb_build_object('alias',alias,'score',score,'maximum',maximum,'position',position,'is_me',user_id=auth.uid()) ORDER BY position,alias) FROM (SELECT * FROM ranked ORDER BY position,alias LIMIT 20) r),'[]'::jsonb),
    'mine',(SELECT jsonb_build_object('alias',s.alias,'score',s.score,'maximum',s.maximum,'position',r.position,'opt_in',s.leaderboard_opt_in) FROM scores s LEFT JOIN ranked r ON r.user_id=s.user_id WHERE s.user_id=auth.uid()),
    'participants',(SELECT count(*) FROM ranked)) INTO result;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION suizamente_private.admin_action(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE operation text:=coalesce(p->>'operation','list'); data jsonb; qid text; t integer[]; w integer[]; i integer;
BEGIN
  IF NOT suizamente_private.is_admin() THEN RAISE EXCEPTION 'SZ_FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF operation='save_question' THEN
    qid:=suizamente_private.write_question(p->'question');
    INSERT INTO suizamente_private.audit(actor_id,action,details) VALUES(auth.uid(),operation,jsonb_build_object('question_id',qid));
  ELSIF operation='resolve_report' THEN
    UPDATE suizamente_private.reports SET status='resolved' WHERE id=(p->>'id')::uuid;
  ELSIF operation='annul' THEN
    UPDATE suizamente_private.versions SET annulled=true WHERE id=(p->>'version_id')::bigint;
    INSERT INTO suizamente_private.audit(actor_id,action,details) VALUES(auth.uid(),operation,p-'operation');
  ELSIF operation='config' THEN
    SELECT array_agg(value::integer ORDER BY ordinality) INTO t FROM jsonb_array_elements_text(p->'thresholds') WITH ORDINALITY;
    SELECT array_agg(value::integer ORDER BY ordinality) INTO w FROM jsonb_array_elements_text(p->'xp_weights') WITH ORDINALITY;
    IF coalesce(cardinality(t),0)<>5 OR coalesce(cardinality(w),0)<>5 OR coalesce(p->>'daily_bonus','') !~ '^\d{1,2}$'
      OR (p->>'daily_bonus')::integer NOT BETWEEN 0 AND 25 THEN RAISE EXCEPTION 'SZ_INVALID_CONFIG'; END IF;
    FOR i IN 1..5 LOOP
      IF t[i] IS NULL OR w[i] IS NULL OR t[i]<1 OR t[i]>100000 OR w[i] NOT BETWEEN 1 AND 100 OR (i>1 AND t[i]<=t[i-1]) THEN RAISE EXCEPTION 'SZ_INVALID_CONFIG'; END IF;
    END LOOP;
    IF length(coalesce(p->>'school_name',''))>100 OR (coalesce(p->>'school_url','')<>'' AND p->>'school_url' !~ '^https://[^[:space:]]+$') THEN RAISE EXCEPTION 'SZ_INVALID_CONFIG'; END IF;
    UPDATE suizamente_private.config SET thresholds=t,xp_weights=w,daily_bonus=(p->>'daily_bonus')::integer,
      enabled=coalesce((p->>'enabled')::boolean,true),school_name=coalesce(p->>'school_name',''),school_url=coalesce(p->>'school_url',''),updated_at=now() WHERE id;
    INSERT INTO suizamente_private.audit(actor_id,action,details) VALUES(auth.uid(),operation,p-'operation');
  ELSIF operation<>'list' THEN RAISE EXCEPTION 'SZ_INVALID_ACTION'; END IF;
  SELECT jsonb_build_object(
    'questions',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.updated_at DESC) FROM (
      SELECT q.id,q.current_version,q.updated_at,v.id version_id,v.annulled,v.payload FROM suizamente_private.questions q
      JOIN suizamente_private.versions v ON v.question_id=q.id AND v.version=q.current_version) r),'[]'::jsonb),
    'reports',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC) FROM (
      SELECT reports.id,reports.reason,reports.notes,reports.status,reports.created_at,reports.version_id,v.payload->>'prompt' prompt FROM suizamente_private.reports reports
      JOIN suizamente_private.versions v ON v.id=reports.version_id ORDER BY reports.created_at DESC LIMIT 250) r),'[]'::jsonb),
    'config',(SELECT to_jsonb(c)-'id' FROM suizamente_private.config c WHERE id),
    'players',(SELECT count(*) FROM suizamente_private.players),
    'completed',(SELECT count(*) FROM suizamente_private.sessions WHERE status='completed')
  ) INTO data;
  RETURN data;
END $$;

CREATE OR REPLACE FUNCTION public.suizamente(p_action text,p_args jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; alias_value text; canton_value text; s suizamente_private.sessions; version_value bigint; game_data jsonb;
  general_value boolean; local_value boolean;
BEGIN
  IF p_args IS NULL OR jsonb_typeof(p_args)<>'object' OR octet_length(p_args::text)>25000 THEN RAISE EXCEPTION 'SZ_INVALID_REQUEST'; END IF;
  IF p_action='summary' THEN
    IF to_regprocedure('suizamente_private.game_summary()') IS NOT NULL THEN game_data:=suizamente_private.game_summary(); RETURN suizamente_private.summary(p_args)||game_data; END IF;
    RETURN suizamente_private.summary(p_args);
  END IF;
  IF p_action='leaderboard' THEN RETURN suizamente_private.leaderboard(); END IF;
  actor:=suizamente_private.require_user();
  IF p_action='game_start' THEN RETURN suizamente_private.game_start(p_args); END IF;
  IF p_action='game_exit' THEN RETURN suizamente_private.game_exit(p_args); END IF;
  IF p_action='start' THEN
    IF p_args->>'mode'='practice' AND to_regprocedure('suizamente_private.game_practice(jsonb)') IS NOT NULL THEN RETURN suizamente_private.game_practice(p_args); END IF;
    IF p_args->>'mode'='review' AND to_regprocedure('suizamente_private.game_review(jsonb)') IS NOT NULL THEN RETURN suizamente_private.game_review(p_args); END IF;
    IF p_args->>'mode'='ascent' AND to_regprocedure('suizamente_private.game_summary()') IS NOT NULL THEN
      SELECT * INTO s FROM suizamente_private.sessions WHERE user_id=actor AND mode='ascent' AND day_key=(now() AT TIME ZONE 'Europe/Zurich')::date LIMIT 1;
      IF FOUND THEN RETURN suizamente_private.session_view(s.id); END IF;
      RETURN suizamente_private.game_start(jsonb_build_object('node',jsonb_array_length(suizamente_private.mountain(coalesce((SELECT level FROM suizamente_private.players WHERE user_id=actor),1))->'stages')));
    END IF;
    RETURN suizamente_private.start_session(p_args);
  END IF;
  IF p_action='answer' THEN
    IF EXISTS(SELECT 1 FROM suizamente_private.sessions WHERE id=(p_args->>'session_id')::uuid AND user_id=actor AND rules->>'game_version'='4') THEN RETURN suizamente_private.game_answer(p_args); END IF;
    RETURN suizamente_private.answer(p_args);
  END IF;
  IF p_action='admin' THEN RETURN suizamente_private.admin_action(p_args); END IF;
  IF p_action='session' THEN
    IF coalesce((p_args->>'advance')::boolean,false) THEN
      SELECT * INTO s FROM suizamente_private.sessions WHERE id=(p_args->>'id')::uuid AND user_id=actor FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'SZ_SESSION_NOT_FOUND' USING ERRCODE='42501'; END IF;
      IF s.status='active' AND EXISTS(SELECT 1 FROM suizamente_private.answers WHERE session_id=s.id AND position=s.position)
        AND s.position<cardinality(s.version_ids)-1 THEN UPDATE suizamente_private.sessions SET position=position+1 WHERE id=s.id; END IF;
    END IF;
    RETURN suizamente_private.session_view((p_args->>'id')::uuid);
  END IF;
  IF p_action='preferences' THEN
    PERFORM suizamente_private.ensure_player(actor);
    canton_value:=nullif(p_args->>'canton',''); alias_value:=btrim(coalesce(p_args->>'alias',''));
    SELECT coalesce((p_args->>'include_general')::boolean,include_general),coalesce((p_args->>'include_canton')::boolean,include_canton)
      INTO general_value,local_value FROM suizamente_private.players WHERE user_id=actor;
    IF NOT general_value AND NOT local_value THEN RAISE EXCEPTION 'SZ_NO_SOURCES'; END IF;
    IF local_value AND canton_value IS NULL THEN canton_value:=suizamente_private.profile_canton(actor); END IF;
    IF local_value AND canton_value IS NULL AND (NOT general_value OR p_args ? 'include_canton') THEN RAISE EXCEPTION 'SZ_CANTON_REQUIRED'; END IF;
    IF canton_value IS NOT NULL AND canton_value<>ALL(ARRAY['AG','AI','AR','BE','BL','BS','FR','GE','GL','GR','JU','LU','NE','NW','OW','SG','SH','SO','SZ','TG','TI','UR','VD','VS','ZG','ZH']) THEN RAISE EXCEPTION 'SZ_INVALID_CANTON'; END IF;
    IF length(alias_value) NOT BETWEEN 3 AND 24 OR alias_value !~ '^[[:alnum:] _-]+$' THEN RAISE EXCEPTION 'SZ_INVALID_ALIAS'; END IF;
    UPDATE suizamente_private.players SET canton=canton_value,alias=alias_value,leaderboard_opt_in=coalesce((p_args->>'leaderboard_opt_in')::boolean,false),include_general=general_value,include_canton=local_value WHERE user_id=actor;
    RETURN suizamente_private.summary();
  END IF;
  IF p_action='report' THEN
    version_value:=(p_args->>'version_id')::bigint;
    IF NOT EXISTS(SELECT 1 FROM suizamente_private.answers WHERE user_id=actor AND version_id=version_value) THEN RAISE EXCEPTION 'SZ_REPORT_NOT_ALLOWED' USING ERRCODE='42501'; END IF;
    IF coalesce(p_args->>'reason','') NOT IN ('incorrect','outdated','scope','other') OR length(coalesce(p_args->>'notes',''))>1000 THEN RAISE EXCEPTION 'SZ_INVALID_REPORT'; END IF;
    INSERT INTO suizamente_private.reports(user_id,version_id,reason,notes) VALUES(actor,version_value,p_args->>'reason',coalesce(p_args->>'notes','')) ON CONFLICT(user_id,version_id) DO NOTHING;
    RETURN jsonb_build_object('ok',true);
  END IF;
  RAISE EXCEPTION 'SZ_INVALID_ACTION';
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA suizamente_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA suizamente_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.suizamente(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suizamente(text,jsonb) TO anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
