-- Suizamente: persistent mountain trails (v4).
-- Run AFTER suizamente.sql, BEFORE suizamente_seed.sql. Safe to re-run.
BEGIN;
ALTER TABLE suizamente_private.players ADD COLUMN IF NOT EXISTS inventory jsonb NOT NULL DEFAULT '{"x2":0,"life":0,"freeze":0}';
ALTER TABLE suizamente_private.players ADD COLUMN IF NOT EXISTS trail_streak integer NOT NULL DEFAULT 0;
ALTER TABLE suizamente_private.players ADD COLUMN IF NOT EXISTS trail_last_day date;
ALTER TABLE suizamente_private.answers ADD COLUMN IF NOT EXISTS response jsonb;
ALTER TABLE suizamente_private.answers DROP CONSTRAINT IF EXISTS answers_choice_check;
ALTER TABLE suizamente_private.answers ADD CONSTRAINT answers_choice_check CHECK(choice BETWEEN 0 AND 4);
ALTER TABLE suizamente_private.sessions DROP CONSTRAINT IF EXISTS sessions_mode_check;
ALTER TABLE suizamente_private.sessions ADD CONSTRAINT sessions_mode_check CHECK(mode IN ('daily','practice','review','ascent','weekly','arrival','stage','bonus','trail_review','summit'));
CREATE TABLE IF NOT EXISTS suizamente_private.trail_nodes(
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, level integer NOT NULL CHECK(level BETWEEN 1 AND 5),
  node integer NOT NULL CHECK(node BETWEEN -1 AND 14), session_id uuid REFERENCES suizamente_private.sessions(id) ON DELETE SET NULL,
  completed_at timestamptz NOT NULL DEFAULT now(), prize_awarded boolean NOT NULL DEFAULT false,
  PRIMARY KEY(user_id,level,node)
);
CREATE TABLE IF NOT EXISTS suizamente_private.trail_days(
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, day date NOT NULL, protected boolean NOT NULL DEFAULT false,
  PRIMARY KEY(user_id,day)
);
CREATE UNIQUE INDEX IF NOT EXISTS suizamente_summit_daily ON suizamente_private.sessions(user_id,day_key) WHERE mode='summit';
ALTER TABLE suizamente_private.trail_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE suizamente_private.trail_days ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON suizamente_private.trail_nodes,suizamente_private.trail_days FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION suizamente_private.mountain(lv integer) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT ('[
 {"name":"Uetliberg","q":5,"test":10,"pass":8,"stages":[["Primeros pasos","👋","administracion"],["Emergencias","🩺","salud"],["Transporte","🚆","sociedad"],["Reto con premio","🎁","freeze"],["Repaso","🔁","review"],["Salud básica","💊","salud"]]},
 {"name":"Rigi","q":6,"test":12,"pass":9,"stages":[["Trámites básicos","🏛️","administracion"],["Vivienda","🏠","vivienda"],["Vivienda y trabajo","💼","trabajo"],["Reto con premio","🎁","life"],["Transporte y ciudad","🚆","sociedad"],["Salud","🩺","salud"],["Repaso","🔁","review"],["Reto con premio","🎁","freeze"]]},
 {"name":"Pilatus","q":7,"test":15,"pass":11,"stages":[["Seguros","🛡️","salud"],["Impuestos","🧾","trabajo"],["Reto con premio","🎁","x2"],["Escuela","🎒","sociedad"],["Trabajo","💼","trabajo"],["Repaso","🔁","review"],["Votaciones","🗳️","administracion"],["Reto con premio","🎁","life"],["Medio ambiente","♻️","sociedad"],["Repaso","🔁","review"]]},
 {"name":"Eiger","q":8,"test":18,"pass":14,"stages":[["Permisos","🪪","administracion"],["Pensiones","🏦","trabajo"],["Reto con premio","🎁","x2"],["Alquiler","🏠","vivienda"],["Sanidad","🏥","salud"],["Repaso","🔁","review"],["Familia","👪","sociedad"],["Reto con premio","🎁","life"],["Política cantonal","🏛️","administracion"],["Fiscalidad","🧮","trabajo"],["Repaso","🔁","review"],["Reto con premio","🎁","freeze"]]},
 {"name":"Matterhorn","q":10,"test":20,"pass":16,"stages":[["Naturalización","📜","administracion"],["Derecho laboral","⚖️","trabajo"],["Reto con premio","🎁","x2"],["Fiscalidad","🧮","trabajo"],["Historia","🏰","sociedad"],["Repaso","🔁","review"],["Federalismo","🗺️","administracion"],["Democracia directa","🗳️","administracion"],["Reto con premio","🎁","life"],["Seguridad social","🛡️","salud"],["Medios y cultura","📰","sociedad"],["Repaso","🔁","review"],["Geografía","🧭","sociedad"],["Reto con premio","🎁","freeze"],["Gran repaso","🔁","review"]]}
 ]'::jsonb)->(lv-1)
$$;

CREATE OR REPLACE FUNCTION suizamente_private.game_summary() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); pl suizamente_private.players; nodes jsonb; days jsonb; active jsonb; legacy jsonb; summit_today jsonb; cur integer:=-1;
  today date:=(now() AT TIME ZONE 'Europe/Zurich')::date; streak integer:=0; gap integer;
BEGIN
  IF actor IS NULL THEN RETURN jsonb_build_object('game_version',4,'trail',jsonb_build_object('node',-1,'nodes','[]'::jsonb,'days','[]'::jsonb,'streak',0,'today',false,'inventory','{"x2":0,"life":0,"freeze":0}'::jsonb)); END IF;
  PERFORM suizamente_private.require_user();
  SELECT * INTO pl FROM suizamente_private.players WHERE user_id=actor;
  SELECT coalesce(jsonb_agg(jsonb_build_object('level',level,'node',node,'prize_awarded',prize_awarded)),'[]'::jsonb) INTO nodes FROM suizamente_private.trail_nodes WHERE user_id=actor;
  IF pl.user_id IS NOT NULL THEN
    WHILE EXISTS(SELECT 1 FROM suizamente_private.trail_nodes n WHERE n.user_id=actor AND n.level=pl.level AND n.node=cur) LOOP cur:=cur+1; END LOOP;
    streak:=pl.trail_streak;
    gap:=greatest(0,today-coalesce(pl.trail_last_day,today)-1);
    IF gap>coalesce((pl.inventory->>'freeze')::integer,0) THEN streak:=0; END IF;
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('day',day,'protected',protected) ORDER BY day),'[]'::jsonb) INTO days FROM suizamente_private.trail_days WHERE user_id=actor AND day>=date_trunc('week',today)::date;
  SELECT jsonb_build_object('id',id,'level',level,'node',(rules->>'node')::integer,'position',position,'total',cardinality(version_ids),'answered',(SELECT count(*) FROM suizamente_private.answers WHERE session_id=s.id)) INTO active
    FROM suizamente_private.sessions s WHERE user_id=actor AND rules->>'game_version'='4' AND status='active' AND level=coalesce(pl.level,1) AND (rules->>'node')::integer=cur ORDER BY created_at DESC LIMIT 1;
  SELECT jsonb_build_object('id',id,'mode',mode) INTO legacy FROM suizamente_private.sessions WHERE user_id=actor AND status='active' AND coalesce(rules->>'game_version','')<>'4' AND mode<>'weekly' ORDER BY created_at DESC LIMIT 1;
  SELECT jsonb_build_object('id',id,'level',level,'status',status,'passed',ascent_passed) INTO summit_today FROM suizamente_private.sessions WHERE user_id=actor AND mode='summit' AND day_key=today LIMIT 1;
  RETURN jsonb_build_object('game_version',4,'legacy_active',legacy,'trail',jsonb_build_object('node',cur,'nodes',nodes,'days',days,'streak',streak,'today',coalesce(pl.trail_last_day=today,false),'summit_today',summit_today,
    'inventory',coalesce(pl.inventory,'{"x2":0,"life":0,"freeze":0}'::jsonb),'active',active,'day',today));
END $$;

CREATE OR REPLACE FUNCTION suizamente_private.game_start(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE actor uuid:=suizamente_private.require_user(); pl suizamente_private.players; cfg suizamente_private.config;
  lv integer; node integer; cur integer:=-1; m jsonb; st jsonb; kind text; ids bigint[]:='{}'; chosen bigint; orders jsonb; sid uuid;
  day date:=(now() AT TIME ZONE 'Europe/Zurich')::date; total integer; target text; local_wanted integer; local_found integer; fallback boolean:=false;
  practice boolean:=false; gift text; gift_at integer:=-1; doubled boolean:=false; life boolean:=false; n integer; need_local boolean; attempt_level integer;
  desired_kind text; previous_kind text;
BEGIN
  PERFORM suizamente_private.ensure_player(actor);
  SELECT * INTO pl FROM suizamente_private.players WHERE user_id=actor FOR UPDATE;
  SELECT * INTO cfg FROM suizamente_private.config WHERE id;
  IF NOT cfg.enabled THEN RAISE EXCEPTION 'SZ_PAUSED'; END IF;
  IF p ? 'level' AND coalesce(p->>'level','') !~ '^[1-5]$' OR p ? 'node' AND coalesce(p->>'node','') !~ '^(-1|[0-9]|1[0-5])$' THEN RAISE EXCEPTION 'SZ_INVALID_REQUEST'; END IF;
  lv:=coalesce((p->>'level')::integer,pl.level); m:=suizamente_private.mountain(lv);
  WHILE EXISTS(SELECT 1 FROM suizamente_private.trail_nodes t WHERE t.user_id=actor AND t.level=lv AND t.node=cur) LOOP cur:=cur+1; END LOOP;
  node:=coalesce((p->>'node')::integer,cur);
  total:=jsonb_array_length(m->'stages');
  IF lv>pl.level OR node>total OR lv=pl.level AND node>cur THEN RAISE EXCEPTION 'SZ_STAGE_LOCKED'; END IF;
  practice:=lv<pl.level OR EXISTS(SELECT 1 FROM suizamente_private.trail_nodes t WHERE t.user_id=actor AND t.level=lv AND t.node=node) OR pl.route_completed;
  st:=m->'stages'->node;
  kind:=CASE WHEN node=-1 THEN 'arrival' WHEN node=total THEN 'summit' WHEN st->>1='🎁' THEN 'bonus' WHEN st->>2='review' THEN 'trail_review' ELSE 'stage' END;
  IF kind='summit' AND NOT practice THEN
    IF pl.xp<cfg.thresholds[lv] THEN RAISE EXCEPTION 'SZ_XP_REQUIRED'; END IF;
    SELECT id,level INTO sid,attempt_level FROM suizamente_private.sessions WHERE user_id=actor AND mode='summit' AND day_key=day;
    IF sid IS NOT NULL THEN
      IF attempt_level<>lv THEN RAISE EXCEPTION 'SZ_SUMMIT_TOMORROW'; END IF;
      RETURN suizamente_private.game_view(sid);
    END IF;
  END IF;
  SELECT id INTO sid FROM suizamente_private.sessions s WHERE user_id=actor AND status='active' AND rules->>'game_version'='4' AND level=lv AND (rules->>'node')::integer=node ORDER BY created_at DESC LIMIT 1;
  IF sid IS NOT NULL THEN RETURN suizamente_private.game_view(sid); END IF;
  IF (SELECT count(*) FROM suizamente_private.sessions WHERE user_id=actor AND created_at>now()-interval '1 hour')>=60 THEN RAISE EXCEPTION 'SZ_RATE_LIMIT'; END IF;
  -- Replaying an old summit is practice, so it does not occupy today's real test.
  IF kind='summit' AND practice THEN kind:='stage'; END IF;
  total:=CASE WHEN node=-1 THEN 3 WHEN node=jsonb_array_length(m->'stages') THEN (m->>'test')::integer WHEN kind='bonus' THEN 3 ELSE (m->>'q')::integer END;
  target:=CASE WHEN kind='stage' THEN st->>2 ELSE NULL END;
  local_wanted:=CASE WHEN kind='arrival' OR kind='summit' OR NOT pl.include_canton OR pl.canton IS NULL THEN 0 WHEN pl.include_general THEN greatest(1,total*2/5) ELSE total END;
  FOR n IN 1..total LOOP
    -- Distribute canton questions through the stage rather than grouping them at the end.
    need_local:=floor(n*local_wanted::numeric/total)>floor((n-1)*local_wanted::numeric/total);
    -- Rotate the starting format between stages. Typing stays exceptional; it is
    -- never required in arrivals, bonus challenges or summit tests.
    desired_kind:=CASE WHEN kind='stage' AND node%5=4 AND n=total THEN 'short'
      ELSE (ARRAY['choice','image','tf','match','multi','order','false'])[1+(n-1+greatest(node,0)+lv-1)%7] END;
    SELECT v.id INTO chosen FROM suizamente_private.questions q JOIN suizamente_private.versions v ON v.question_id=q.id AND v.version=q.current_version
      LEFT JOIN suizamente_private.progress g ON g.user_id=actor AND g.question_id=q.id
      WHERE v.payload->>'status'='published' AND NOT v.annulled AND NOT v.id=ANY(ids)
        AND v.payload->>'category'<>'idioma'
        AND (coalesce(v.payload->>'game_type','choice')<>'short' OR desired_kind='short')
        AND (CASE WHEN kind='arrival' THEN v.payload->>'arrival_level'=lv::text ELSE NOT v.payload ? 'arrival_level' END)
        AND (v.payload->>'scope'='CH' OR pl.include_canton AND v.payload->>'canton'=pl.canton)
        AND (kind='arrival' OR (v.payload->>'difficulty')::integer<=lv AND (kind<>'summit' OR v.payload->>'scope'='CH'))
        AND (kind='arrival' OR v.payload->>'scope'='CH' OR (v.payload->>'difficulty')::integer>=greatest(1,lv-1))
      ORDER BY CASE WHEN (v.payload->>'scope'='canton')=need_local THEN 0 ELSE 1 END,
        CASE WHEN kind='trail_review' AND g.last_correct IS FALSE THEN 0 WHEN g.question_id IS NULL THEN 1 WHEN g.last_correct IS FALSE THEN 2 ELSE 3 END,
        CASE WHEN target IS NOT NULL AND n%2=1 AND v.payload->>'category'=target THEN 0 ELSE 1 END,
        abs((v.payload->>'difficulty')::integer-lv),
        CASE WHEN coalesce(v.payload->>'game_type','choice')=desired_kind THEN 0 WHEN coalesce(v.payload->>'game_type','choice') IS DISTINCT FROM previous_kind THEN 1 ELSE 2 END,
        CASE WHEN target IS NOT NULL AND v.payload->>'category'=target THEN 0 ELSE 1 END,
        coalesce(g.seen_count,0),g.last_at NULLS FIRST,
        md5(q.id||actor::text||clock_timestamp()::text) LIMIT 1;
    IF chosen IS NULL THEN RAISE EXCEPTION 'SZ_NOT_ENOUGH_QUESTIONS'; END IF;
    ids:=array_append(ids,chosen);
    SELECT coalesce(payload->>'game_type','choice') INTO previous_kind FROM suizamente_private.versions WHERE id=chosen;
  END LOOP;
  SELECT count(*) INTO local_found FROM suizamente_private.versions WHERE id=ANY(ids) AND payload->>'scope'='canton';
  fallback:=local_found<local_wanted;
  SELECT jsonb_object_agg(v.id::text,(SELECT coalesce(jsonb_agg(i ORDER BY random()),'[]'::jsonb) FROM generate_series(0,jsonb_array_length(v.payload->'options')-1) i)) INTO orders FROM suizamente_private.versions v WHERE id=ANY(ids);
  IF kind='bonus' THEN gift:=st->>2;
  ELSIF kind IN ('stage','trail_review') AND NOT practice THEN gift:=(ARRAY['x2','freeze','life'])[(node+lv)%3+1]; gift_at:=least(4,total-2); END IF;
  IF NOT practice AND kind IN ('stage','bonus','trail_review') AND (pl.inventory->>'x2')::integer>0 THEN
    doubled:=true; UPDATE suizamente_private.players SET inventory=jsonb_set(inventory,'{x2}',to_jsonb((inventory->>'x2')::integer-1)) WHERE user_id=actor;
  END IF;
  IF NOT practice AND kind='summit' AND (pl.inventory->>'life')::integer>0 THEN
    life:=true; UPDATE suizamente_private.players SET inventory=jsonb_set(inventory,'{life}',to_jsonb((inventory->>'life')::integer-1)) WHERE user_id=actor;
  END IF;
  INSERT INTO suizamente_private.sessions(user_id,mode,day_key,week_key,level,canton,category,version_ids,option_orders,rules,fallback)
    VALUES(actor,kind,day,date_trunc('week',day)::date,lv,pl.canton,target,ids,orders,
      jsonb_build_object('game_version',4,'node',node,'title',CASE WHEN node=-1 THEN 'Llegada a '||(m->>'name') WHEN node=jsonb_array_length(m->'stages') THEN 'Test de cima' ELSE st->>0 END,
        'practice',practice,'summit_practice',practice AND node=jsonb_array_length(m->'stages'),'gift',gift,'gift_at',gift_at,'x2',doubled,'life',life,'pass',greatest(0,(m->>'pass')::integer-CASE WHEN life THEN 1 ELSE 0 END),
        'include_general',pl.include_general,'include_canton',pl.include_canton,'xp_weights',cfg.xp_weights,'gifts','[]'::jsonb),fallback) RETURNING id INTO sid;
  RETURN suizamente_private.game_view(sid);
END $$;

CREATE OR REPLACE FUNCTION suizamente_private.game_order_solution(p jsonb) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT CASE WHEN p->>'game_type'='short' THEN p->'accepted_answers'->>0
    ELSE (SELECT string_agg(p->'options'->>x.value::integer,' ' ORDER BY x.ordinality) FROM jsonb_array_elements_text(p->'correct_order') WITH ORDINALITY x) END
$$;

CREATE OR REPLACE FUNCTION suizamente_private.game_view(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s suizamente_private.sessions; v suizamente_private.versions; a suizamente_private.answers; opts jsonb; feedback jsonb;
  history jsonb; states jsonb; reviews jsonb; ncorrect integer; annulled integer; annulled_total integer; correct_opts jsonb; pairs jsonb; kind text;
BEGIN
  SELECT * INTO s FROM suizamente_private.sessions WHERE id=p_id AND user_id=auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'SZ_SESSION_NOT_FOUND' USING ERRCODE='42501'; END IF;
  SELECT * INTO v FROM suizamente_private.versions WHERE id=s.version_ids[s.position+1]; kind:=coalesce(v.payload->>'game_type','choice');
  SELECT count(*) INTO annulled_total FROM suizamente_private.versions WHERE id=ANY(s.version_ids) AND versions.annulled;
  SELECT coalesce(jsonb_agg(v.payload->'options'->(n.value::text::integer) ORDER BY n.ordinality),'[]'::jsonb) INTO opts FROM jsonb_array_elements(s.option_orders->v.id::text) WITH ORDINALITY n;
  IF kind='match' THEN
    opts:=v.payload->'options';
    SELECT jsonb_agg(v.payload->'pairs'->(n.value::text::integer) ORDER BY n.ordinality) INTO pairs FROM jsonb_array_elements(s.option_orders->v.id::text) WITH ORDINALITY n;
  END IF;
  SELECT * INTO a FROM suizamente_private.answers WHERE session_id=s.id AND position=s.position;
  IF FOUND THEN
    SELECT jsonb_agg((n.ordinality-1)::integer ORDER BY n.ordinality) INTO correct_opts FROM jsonb_array_elements(s.option_orders->v.id::text) WITH ORDINALITY n
      WHERE CASE WHEN kind='multi' THEN v.payload->'correct_indices' @> jsonb_build_array(n.value::text::integer) ELSE n.value::text::integer=(v.payload->>'correct_index')::integer END;
    feedback:=jsonb_build_object('choice',CASE WHEN a.skipped THEN NULL ELSE a.choice END,'response',a.response,'skipped',a.skipped,'correct',a.correct AND NOT v.annulled,'annulled',v.annulled,'xp',a.xp_received,
      'correct_option',correct_opts->0,'correct_options',correct_opts,'selected_options',(SELECT jsonb_agg(n.ordinality::integer-1) FROM jsonb_array_elements(s.option_orders->v.id::text) WITH ORDINALITY n WHERE kind='multi' AND a.response @> jsonb_build_array(n.value::text::integer)), 'correct_answer',CASE WHEN kind='match' THEN (SELECT string_agg(l.value||' → '||(v.payload->'pairs'->> (l.ordinality::integer-1)), '; ' ORDER BY l.ordinality) FROM jsonb_array_elements_text(v.payload->'options') WITH ORDINALITY l) WHEN kind='multi' THEN (SELECT string_agg(v.payload->'options'->> x::integer,'; ') FROM jsonb_array_elements_text(v.payload->'correct_indices') x) ELSE v.payload->'options'->>((v.payload->>'correct_index')::integer) END,
      'explanation',v.payload->>'explanation','source_url',v.payload->>'source_url','source_title',v.payload->>'source_title','guide_path',v.payload->>'guide_path');
  END IF;
  IF a.session_id IS NOT NULL AND kind IN ('order','short') THEN
    feedback:=feedback||jsonb_build_object('correct_answer',suizamente_private.game_order_solution(v.payload),'correct_option',NULL,'correct_options','[]'::jsonb);
  END IF;
  SELECT coalesce(jsonb_agg(ans.correct AND NOT av.annulled ORDER BY ans.position),'[]'::jsonb),coalesce(jsonb_agg(CASE WHEN av.annulled THEN 'annulled' WHEN ans.skipped THEN 'skipped' WHEN ans.correct THEN 'correct' ELSE 'wrong' END ORDER BY ans.position),'[]'::jsonb),count(*) FILTER(WHERE ans.correct AND NOT av.annulled),count(*) FILTER(WHERE av.annulled)
    INTO history,states,ncorrect,annulled FROM suizamente_private.answers ans JOIN suizamente_private.versions av ON av.id=ans.version_id WHERE ans.session_id=s.id;
  IF s.status='completed' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('position',ans.position,'prompt',av.payload->>'prompt','category',av.payload->>'category','correct',ans.correct AND NOT av.annulled,'skipped',ans.skipped,'annulled',av.annulled,'xp',ans.xp_received,
      'chosen_answer',CASE WHEN ans.skipped THEN NULL WHEN av.payload->>'game_type'='short' THEN ans.response#>>'{}' WHEN av.payload->>'game_type'='order' THEN (SELECT string_agg(av.payload->'options'->>x.value::integer,' ' ORDER BY x.ordinality) FROM jsonb_array_elements_text(ans.response) WITH ORDINALITY x) WHEN av.payload->>'game_type'='match' THEN 'Parejas completadas · '||(ans.response->>'errors')||' errores' WHEN av.payload->>'game_type'='multi' THEN (SELECT string_agg(av.payload->'options'->>x::integer,'; ') FROM jsonb_array_elements_text(ans.response) x) ELSE av.payload->'options'->>((s.option_orders->av.id::text->>ans.choice)::integer) END,
      'correct_answer',CASE WHEN av.payload->>'game_type' IN ('order','short') THEN suizamente_private.game_order_solution(av.payload) WHEN av.payload->>'game_type'='multi' THEN (SELECT string_agg(av.payload->'options'->> x::integer,'; ') FROM jsonb_array_elements_text(av.payload->'correct_indices') x) WHEN av.payload->>'game_type'='match' THEN (SELECT string_agg(l.value||' → '||(av.payload->'pairs'->>(l.ordinality::integer-1)),'; ' ORDER BY l.ordinality) FROM jsonb_array_elements_text(av.payload->'options') WITH ORDINALITY l) ELSE av.payload->'options'->>((av.payload->>'correct_index')::integer) END,
      'explanation',av.payload->>'explanation','source_url',av.payload->>'source_url','source_title',av.payload->>'source_title') ORDER BY ans.position),'[]'::jsonb) INTO reviews
      FROM suizamente_private.answers ans JOIN suizamente_private.versions av ON av.id=ans.version_id WHERE ans.session_id=s.id;
  END IF;
  RETURN jsonb_build_object('id',s.id,'mode',s.mode,'status',s.status,'game_version',4,'position',s.position,'total',cardinality(s.version_ids),'valid_total',cardinality(s.version_ids)-annulled_total,'level',s.level,'canton',s.canton,'category',s.category,'fallback',s.fallback,
    'xp_gained',s.xp_gained,'ascent_passed',s.ascent_passed,'history',history,'states',states,'review_answers',reviews,'correct_count',ncorrect,'annulled_count',annulled,
    'day',s.day_key,'week',s.week_key,'created_at',s.created_at,'completed_at',s.completed_at,
    'trail',(s.rules-'xp_weights'-'pairs')||jsonb_build_object('pass',greatest(1,coalesce((s.rules->>'pass')::integer,1)-annulled_total)),'pair_state',coalesce(s.rules->'pairs'->s.position::text,'{"matched":[],"errors":0}'::jsonb)||jsonb_build_object('matched_right',coalesce((SELECT jsonb_agg(n.ordinality::integer-1) FROM jsonb_array_elements(s.option_orders->v.id::text) WITH ORDINALITY n WHERE coalesce(s.rules->'pairs'->s.position::text->'matched','[]') @> jsonb_build_array(n.value::text::integer)),'[]'::jsonb)),
    'question',jsonb_build_object('version_id',v.id,'id',v.question_id,'type',kind,'image_key',v.payload->>'image_key','category',v.payload->>'category','difficulty',(v.payload->>'difficulty')::integer,'scope',v.payload->>'scope','canton',v.payload->>'canton','language',v.payload->>'language','prompt',v.payload->>'prompt','options',opts,'pairs',pairs,'max_length',coalesce((v.payload->>'max_length')::integer,80)),'answer',feedback);
END $$;

CREATE OR REPLACE FUNCTION suizamente_private.game_review(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=suizamente_private.require_user(); pl suizamente_private.players; sid uuid; ids bigint[]; orders jsonb; today date:=(now() AT TIME ZONE 'Europe/Zurich')::date;
BEGIN
  PERFORM suizamente_private.ensure_player(actor);
  SELECT * INTO pl FROM suizamente_private.players WHERE user_id=actor FOR UPDATE;
  IF NOT (SELECT enabled FROM suizamente_private.config WHERE id) THEN RAISE EXCEPTION 'SZ_PAUSED'; END IF;
  SELECT id INTO sid FROM suizamente_private.sessions WHERE user_id=actor AND status='active' AND mode='review' AND rules->>'game_version'='4' AND category IS NOT DISTINCT FROM nullif(p->>'category','') ORDER BY created_at DESC LIMIT 1;
  IF sid IS NOT NULL THEN RETURN suizamente_private.game_view(sid); END IF;
  IF (SELECT count(*) FROM suizamente_private.sessions WHERE user_id=actor AND created_at>now()-interval '1 hour')>=60 THEN RAISE EXCEPTION 'SZ_RATE_LIMIT'; END IF;
  SELECT array_agg(id ORDER BY last_at) INTO ids FROM (
    SELECT v.id,g.last_at FROM suizamente_private.progress g JOIN suizamente_private.questions q ON q.id=g.question_id JOIN suizamente_private.versions v ON v.question_id=q.id AND v.version=q.current_version
    WHERE g.user_id=actor AND NOT g.last_correct AND NOT v.annulled AND v.payload->>'status'='published'
      AND (v.payload->>'scope'='CH' OR v.payload->>'canton'=pl.canton)
      AND (nullif(p->>'category','') IS NULL OR v.payload->>'category'=p->>'category')
      AND EXISTS(SELECT 1 FROM suizamente_private.versions old WHERE old.id=g.last_version_id AND NOT old.annulled)
    ORDER BY g.last_at LIMIT 5
  ) pending;
  IF coalesce(cardinality(ids),0)=0 THEN RAISE EXCEPTION 'SZ_NO_QUESTIONS'; END IF;
  SELECT jsonb_object_agg(v.id::text,(SELECT coalesce(jsonb_agg(i ORDER BY random()),'[]'::jsonb) FROM generate_series(0,jsonb_array_length(v.payload->'options')-1) i)) INTO orders FROM suizamente_private.versions v WHERE id=ANY(ids);
  INSERT INTO suizamente_private.sessions(user_id,mode,day_key,week_key,level,canton,category,version_ids,option_orders,rules)
    VALUES(actor,'review',today,date_trunc('week',today)::date,pl.level,pl.canton,nullif(p->>'category',''),ids,orders,
      jsonb_build_object('game_version',4,'node',-2,'title','Mis repasos','practice',true,'gift_at',-1,'x2',false,'life',false,'gifts','[]'::jsonb)) RETURNING id INTO sid;
  RETURN suizamente_private.game_view(sid);
END $$;

CREATE OR REPLACE FUNCTION suizamente_private.game_practice(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=suizamente_private.require_user(); pl suizamente_private.players; sid uuid; ids bigint[]:='{}'; orders jsonb; chosen bigint;
  today date:=(now() AT TIME ZONE 'Europe/Zurich')::date; topic text:=nullif(p->>'category',''); n integer; desired_local integer; local_found integer;
BEGIN
  IF topic IS NOT NULL AND topic<>ALL(ARRAY['administracion','vivienda','trabajo','salud','sociedad','idioma']) THEN RAISE EXCEPTION 'SZ_INVALID_CATEGORY'; END IF;
  PERFORM suizamente_private.ensure_player(actor);
  SELECT * INTO pl FROM suizamente_private.players WHERE user_id=actor FOR UPDATE;
  IF NOT (SELECT enabled FROM suizamente_private.config WHERE id) THEN RAISE EXCEPTION 'SZ_PAUSED'; END IF;
  SELECT id INTO sid FROM suizamente_private.sessions s WHERE user_id=actor AND status='active' AND mode='practice' AND rules->>'game_version'='4' AND category IS NOT DISTINCT FROM topic
    AND canton IS NOT DISTINCT FROM pl.canton AND (topic='idioma' OR (rules->>'include_general')::boolean=pl.include_general AND (rules->>'include_canton')::boolean=pl.include_canton) ORDER BY created_at DESC LIMIT 1;
  IF sid IS NOT NULL THEN RETURN suizamente_private.game_view(sid); END IF;
  IF (SELECT count(*) FROM suizamente_private.sessions WHERE user_id=actor AND created_at>now()-interval '1 hour')>=60 THEN RAISE EXCEPTION 'SZ_RATE_LIMIT'; END IF;
  desired_local:=CASE WHEN topic='idioma' OR NOT pl.include_canton OR pl.canton IS NULL THEN 0 WHEN pl.include_general THEN 2 ELSE 5 END;
  FOR n IN 1..5 LOOP
    SELECT v.id INTO chosen FROM suizamente_private.questions q JOIN suizamente_private.versions v ON v.question_id=q.id AND v.version=q.current_version LEFT JOIN suizamente_private.progress g ON g.user_id=actor AND g.question_id=q.id
      WHERE v.payload->>'status'='published' AND NOT v.annulled AND NOT v.id=ANY(ids) AND NOT v.payload ? 'arrival_level'
        AND (topic IS NULL AND v.payload->>'category'<>'idioma' OR v.payload->>'category'=topic)
        AND (v.payload->>'scope'='CH' OR pl.include_canton AND v.payload->>'canton'=pl.canton)
        AND (v.payload->>'difficulty')::integer<=pl.level
        AND (v.payload->>'scope'='CH' OR (v.payload->>'difficulty')::integer>=greatest(1,pl.level-1))
      ORDER BY CASE WHEN (v.payload->>'scope'='canton')=(n>5-desired_local) THEN 0 ELSE 1 END,
        CASE WHEN g.last_correct IS FALSE THEN 0 WHEN g.question_id IS NULL THEN 1 ELSE 2 END,
        abs((v.payload->>'difficulty')::integer-pl.level),random() LIMIT 1;
    IF chosen IS NULL THEN RAISE EXCEPTION 'SZ_NOT_ENOUGH_QUESTIONS'; END IF;
    ids:=array_append(ids,chosen);
  END LOOP;
  SELECT count(*) INTO local_found FROM suizamente_private.versions WHERE id=ANY(ids) AND payload->>'scope'='canton';
  SELECT jsonb_object_agg(v.id::text,(SELECT coalesce(jsonb_agg(i ORDER BY random()),'[]'::jsonb) FROM generate_series(0,jsonb_array_length(v.payload->'options')-1) i)) INTO orders FROM suizamente_private.versions v WHERE id=ANY(ids);
  INSERT INTO suizamente_private.sessions(user_id,mode,day_key,week_key,level,canton,category,version_ids,option_orders,rules,fallback)
    VALUES(actor,'practice',today,date_trunc('week',today)::date,pl.level,pl.canton,topic,ids,orders,
      jsonb_build_object('game_version',4,'node',-2,'title','Práctica por tema','practice',true,'gift_at',-1,'x2',false,'life',false,'gifts','[]'::jsonb,'include_general',pl.include_general,'include_canton',pl.include_canton),local_found<desired_local) RETURNING id INTO sid;
  RETURN suizamente_private.game_view(sid);
END $$;

CREATE OR REPLACE FUNCTION suizamente_private.game_answer(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE actor uuid:=suizamente_private.require_user(); pl suizamente_private.players; s suizamente_private.sessions; v suizamente_private.versions;
  pos integer; choice integer:=0; response jsonb; kind text; correct boolean:=false; skipped boolean:=coalesce((p->>'skip')::boolean,false);
  reward integer:=0; bonus integer:=0; affected integer; done boolean; passes boolean; ncorrect integer; nwrong integer; node integer; annulled_total integer; required_correct integer;
  gift text; gift_won boolean:=false; eligible boolean; m jsonb; pair_state jsonb; matched jsonb; errors integer; left_i integer; right_i integer; pair_ok boolean; wrong_pairs jsonb;
  today date:=(now() AT TIME ZONE 'Europe/Zurich')::date; gap integer; n integer; run integer;
BEGIN
  SELECT * INTO pl FROM suizamente_private.players WHERE user_id=actor FOR UPDATE;
  SELECT * INTO s FROM suizamente_private.sessions WHERE id=(p->>'session_id')::uuid AND user_id=actor AND rules->>'game_version'='4' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SZ_SESSION_NOT_FOUND' USING ERRCODE='42501'; END IF;
  IF coalesce(p->>'position','') !~ '^\d{1,3}$' THEN RAISE EXCEPTION 'SZ_INVALID_ANSWER'; END IF;
  pos:=(p->>'position')::integer;
  IF pos<>s.position THEN RAISE EXCEPTION 'SZ_QUESTION_CHANGED'; END IF;
  IF EXISTS(SELECT 1 FROM suizamente_private.answers a WHERE a.session_id=s.id AND a.position=pos) THEN RETURN suizamente_private.game_view(s.id); END IF;
  IF s.status<>'active' THEN RAISE EXCEPTION 'SZ_SESSION_CLOSED'; END IF;
  SELECT * INTO v FROM suizamente_private.versions WHERE id=s.version_ids[pos+1]; kind:=coalesce(v.payload->>'game_type','choice');
  node:=(s.rules->>'node')::integer; m:=suizamente_private.mountain(s.level);
  IF NOT skipped THEN
    IF kind='multi' THEN
      response:=p->'choices';
      IF jsonb_typeof(response) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'SZ_INVALID_ANSWER'; END IF;
      IF jsonb_array_length(response) NOT BETWEEN 1 AND 5 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(response) x WHERE x !~ '^[0-4]$' OR x::integer>=jsonb_array_length(v.payload->'options')) OR (SELECT count(DISTINCT x) FROM jsonb_array_elements_text(response) x)<>jsonb_array_length(response) THEN RAISE EXCEPTION 'SZ_INVALID_ANSWER'; END IF;
      SELECT jsonb_agg((s.option_orders->v.id::text->>x::integer)::integer ORDER BY (s.option_orders->v.id::text->>x::integer)::integer) INTO response FROM jsonb_array_elements_text(response) x;
      correct:=response=(SELECT jsonb_agg(x::integer ORDER BY x::integer) FROM jsonb_array_elements_text(v.payload->'correct_indices') x);
    ELSIF kind='order' THEN
      response:=p->'choices';
      IF jsonb_typeof(response) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'SZ_INVALID_ANSWER'; END IF;
      IF jsonb_array_length(response)<>jsonb_array_length(v.payload->'options')
        OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(response) x WHERE x !~ '^[0-7]$' OR x::integer>=jsonb_array_length(v.payload->'options'))
        OR (SELECT count(DISTINCT x) FROM jsonb_array_elements_text(response) x)<>jsonb_array_length(response) THEN RAISE EXCEPTION 'SZ_INVALID_ANSWER'; END IF;
      SELECT jsonb_agg((s.option_orders->v.id::text->>x.value::integer)::integer ORDER BY x.ordinality) INTO response FROM jsonb_array_elements_text(response) WITH ORDINALITY x;
      correct:=response=v.payload->'correct_order';
    ELSIF kind='short' THEN
      IF jsonb_typeof(p->'text') IS DISTINCT FROM 'string' OR length(p->>'text') NOT BETWEEN 1 AND coalesce((v.payload->>'max_length')::integer,80) THEN RAISE EXCEPTION 'SZ_INVALID_ANSWER'; END IF;
      response:=to_jsonb(p->>'text');
      correct:=EXISTS(SELECT 1 FROM jsonb_array_elements_text(v.payload->'accepted_answers') x
        WHERE lower(regexp_replace(normalize(btrim(x),NFKC),'[[:space:]]+',' ','g'))=lower(regexp_replace(normalize(btrim(p->>'text'),NFKC),'[[:space:]]+',' ','g')));
    ELSIF kind='match' THEN
      IF coalesce(p->>'left','') !~ '^[0-3]$' OR coalesce(p->>'right','') !~ '^[0-3]$' THEN RAISE EXCEPTION 'SZ_INVALID_ANSWER'; END IF;
      left_i:=(p->>'left')::integer; right_i:=(p->>'right')::integer;
      pair_state:=coalesce(s.rules->'pairs'->pos::text,'{"matched":[],"errors":0}'::jsonb); matched:=pair_state->'matched'; errors:=(pair_state->>'errors')::integer;
      wrong_pairs:=coalesce(pair_state->'wrong_pairs','[]'::jsonb);
      IF wrong_pairs @> jsonb_build_array(left_i||':'||right_i) THEN RETURN suizamente_private.game_view(s.id); END IF;
      IF matched @> jsonb_build_array(left_i) OR matched @> jsonb_build_array((s.option_orders->v.id::text->>right_i)::integer) THEN RETURN suizamente_private.game_view(s.id); END IF;
      pair_ok:=left_i=(s.option_orders->v.id::text->>right_i)::integer;
      IF pair_ok THEN matched:=matched||jsonb_build_array(left_i); ELSE errors:=errors+1; wrong_pairs:=wrong_pairs||jsonb_build_array(left_i||':'||right_i); END IF;
      pair_state:=jsonb_build_object('matched',matched,'errors',errors,'wrong_pairs',wrong_pairs,'last',jsonb_build_object('left',left_i,'right',right_i,'correct',pair_ok));
      UPDATE suizamente_private.sessions SET rules=jsonb_set(rules,'{pairs}',coalesce(rules->'pairs','{}')||jsonb_build_object(pos::text,pair_state)) WHERE id=s.id;
      IF jsonb_array_length(matched)<4 THEN RETURN suizamente_private.game_view(s.id); END IF;
      response:=pair_state; correct:=errors<=1;
    ELSE
      IF coalesce(p->>'choice','') !~ '^[0-4]$' OR (p->>'choice')::integer>=jsonb_array_length(v.payload->'options') THEN RAISE EXCEPTION 'SZ_INVALID_ANSWER'; END IF;
      choice:=(p->>'choice')::integer; response:=to_jsonb(choice);
      correct:=(s.option_orders->v.id::text->>choice)::integer=(v.payload->>'correct_index')::integer;
    END IF;
  END IF;
  correct:=correct AND NOT v.annulled;
  eligible:=NOT (s.rules->>'practice')::boolean;
  IF correct AND v.payload->>'category'<>'idioma' THEN
    reward:=CASE WHEN kind='match' THEN 20 WHEN kind IN ('multi','image','false') THEN 15 ELSE 10 END * CASE WHEN (s.rules->>'x2')::boolean THEN 2 ELSE 1 END;
    INSERT INTO suizamente_private.rewards(user_id,award_key,amount,session_id) VALUES(actor,'question:'||v.question_id,reward,s.id) ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS affected=ROW_COUNT; IF affected=0 THEN reward:=0; END IF;
  END IF;
  INSERT INTO suizamente_private.answers(session_id,position,version_id,user_id,choice,correct,skipped,xp_received,response) VALUES(s.id,pos,v.id,actor,choice,correct,skipped,reward,response);
  INSERT INTO suizamente_private.progress(user_id,question_id,first_version_id,last_version_id,first_correct,last_correct,ever_correct) VALUES(actor,v.question_id,v.id,v.id,correct,correct,correct)
    ON CONFLICT(user_id,question_id) DO UPDATE SET last_version_id=excluded.last_version_id,last_correct=excluded.last_correct,ever_correct=progress.ever_correct OR excluded.ever_correct,seen_count=progress.seen_count+1,last_at=now();
  SELECT count(*) FILTER(WHERE a.correct AND NOT av.annulled),count(*) FILTER(WHERE NOT a.correct AND NOT av.annulled) INTO ncorrect,nwrong FROM suizamente_private.answers a JOIN suizamente_private.versions av ON av.id=a.version_id WHERE a.session_id=s.id;
  SELECT count(*) INTO annulled_total FROM suizamente_private.versions WHERE id=ANY(s.version_ids) AND annulled;
  required_correct:=greatest(1,coalesce((s.rules->>'pass')::integer,1)-annulled_total);
  done:=pos=cardinality(s.version_ids)-1 OR s.mode='summit' AND nwrong>cardinality(s.version_ids)-annulled_total-required_correct;
  gift:=s.rules->>'gift';
  IF gift IS NOT NULL AND s.mode<>'bonus' AND eligible AND correct AND pos=(s.rules->>'gift_at')::integer THEN gift_won:=true; END IF;
  IF done THEN
    IF s.mode='summit' OR coalesce((s.rules->>'summit_practice')::boolean,false) THEN
      passes:=ncorrect>=required_correct;
      IF passes AND eligible AND pl.level=s.level THEN UPDATE suizamente_private.players SET level=least(level+1,5),route_completed=(level=5) WHERE user_id=actor; END IF;
      IF passes AND eligible THEN bonus:=20; END IF;
    ELSIF node>=-1 AND node<jsonb_array_length(m->'stages') THEN
      INSERT INTO suizamente_private.trail_nodes(user_id,level,node,session_id) VALUES(actor,s.level,node,s.id) ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS affected=ROW_COUNT;
      IF affected>0 AND eligible THEN bonus:=5*CASE WHEN (s.rules->>'x2')::boolean THEN 2 ELSE 1 END; END IF;
      IF s.mode='bonus' AND s.level=pl.level AND NOT pl.route_completed AND cardinality(s.version_ids)>annulled_total AND ncorrect=cardinality(s.version_ids)-annulled_total AND NOT EXISTS(SELECT 1 FROM suizamente_private.trail_nodes t WHERE t.user_id=actor AND t.level=s.level AND t.node=node AND t.prize_awarded) THEN gift_won:=true; END IF;
    END IF;
    IF bonus>0 THEN
      INSERT INTO suizamente_private.rewards(user_id,award_key,amount,session_id) VALUES(actor,'trail:'||s.level||':'||node,bonus,s.id) ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS affected=ROW_COUNT; IF affected=0 THEN bonus:=0; END IF;
    END IF;
    -- Once per local calendar day; protect missed days only when a run actually exists.
    IF pl.trail_last_day IS DISTINCT FROM today THEN
      gap:=greatest(0,today-coalesce(pl.trail_last_day,today)-1); run:=pl.trail_streak;
      IF gap>0 AND run>0 AND gap<=(pl.inventory->>'freeze')::integer THEN
        UPDATE suizamente_private.players SET inventory=jsonb_set(inventory,'{freeze}',to_jsonb((inventory->>'freeze')::integer-gap)) WHERE user_id=actor;
        FOR n IN 1..gap LOOP INSERT INTO suizamente_private.trail_days(user_id,day,protected) VALUES(actor,pl.trail_last_day+n,true) ON CONFLICT DO NOTHING; END LOOP;
        run:=run+gap;
      ELSIF gap>0 THEN run:=0; END IF;
      UPDATE suizamente_private.players SET trail_streak=run+1,trail_last_day=today WHERE user_id=actor;
      UPDATE suizamente_private.sessions SET rules=jsonb_set(rules,'{streak_awarded}','true') WHERE id=s.id;
      INSERT INTO suizamente_private.trail_days(user_id,day) VALUES(actor,today) ON CONFLICT DO NOTHING;
    END IF;
    UPDATE suizamente_private.sessions SET status='completed',completed_at=now(),ascent_passed=passes WHERE id=s.id;
  END IF;
  IF gift_won THEN
    INSERT INTO suizamente_private.rewards(user_id,award_key,amount,session_id) VALUES(actor,'gift:'||s.level||':'||node,0,s.id) ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected>0 THEN
      UPDATE suizamente_private.players SET inventory=jsonb_set(inventory,ARRAY[gift],to_jsonb((inventory->>gift)::integer+1)) WHERE user_id=actor;
      UPDATE suizamente_private.sessions SET rules=jsonb_set(rules,'{gifts}',coalesce(rules->'gifts','[]')||jsonb_build_array(gift)) WHERE id=s.id;
      UPDATE suizamente_private.trail_nodes SET prize_awarded=true WHERE user_id=actor AND level=s.level AND trail_nodes.node=node;
    END IF;
  END IF;
  UPDATE suizamente_private.sessions SET xp_gained=xp_gained+reward+bonus WHERE id=s.id;
  UPDATE suizamente_private.players SET xp=xp+reward+bonus WHERE user_id=actor;
  RETURN suizamente_private.game_view(s.id);
END $$;

CREATE OR REPLACE FUNCTION suizamente_private.game_exit(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=suizamente_private.require_user(); s suizamente_private.sessions;
BEGIN
  PERFORM 1 FROM suizamente_private.players WHERE user_id=actor FOR UPDATE;
  SELECT * INTO s FROM suizamente_private.sessions WHERE id=(p->>'id')::uuid AND user_id=actor AND rules->>'game_version'='4' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SZ_SESSION_NOT_FOUND' USING ERRCODE='42501'; END IF;
  IF s.mode='summit' AND s.status='active' THEN UPDATE suizamente_private.sessions SET status='completed',ascent_passed=false,completed_at=now(),rules=jsonb_set(rules,'{exit_failed}','true') WHERE id=s.id; END IF;
  RETURN suizamente_private.game_view(s.id);
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA suizamente_private FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
