-- Frozen selectors from revision 14, for upgrade tests only.

CREATE OR REPLACE FUNCTION suizamente_private.game_start(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE actor uuid:=suizamente_private.require_user(); pl suizamente_private.players; cfg suizamente_private.config;
  lv integer; node integer; cur integer:=-1; m jsonb; st jsonb; kind text; ids bigint[]:='{}'; chosen bigint; orders jsonb; sid uuid;
  day date:=(now() AT TIME ZONE 'Europe/Zurich')::date; total integer; target text; local_wanted integer; local_found integer; fallback boolean:=false;
  practice boolean:=false; gift text; gift_at integer:=-1; doubled boolean:=false; life boolean:=false; n integer; need_local boolean; attempt_level integer;
  desired_kind text; previous_kind text; previous_topic text;
  has_trivia boolean:=EXISTS(SELECT 1 FROM suizamente_private.trivia_catalog); want_trivia boolean; general_versions bigint[]:='{}';
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
    want_trivia:=n%4<>0;
    desired_kind:=CASE WHEN has_trivia AND n=1 THEN 'image' WHEN NOT has_trivia AND kind='stage' AND node%5=4 AND n=total THEN 'short'
      ELSE (CASE WHEN has_trivia THEN ARRAY['image','choice','tf','match','multi','order','false'] ELSE ARRAY['choice','image','tf','match','multi','order','false'] END)[1+(n-1+greatest(node,0)+lv-1)%7] END;
    IF has_trivia AND n>1 AND desired_kind='image' THEN desired_kind:='choice'; END IF;
    SELECT v.id INTO chosen FROM suizamente_private.questions q JOIN suizamente_private.versions v ON v.question_id=q.id AND v.version=q.current_version
      LEFT JOIN suizamente_private.trivia_catalog tc ON tc.question_id=q.id AND tc.original_prompt=v.payload->>'prompt'
      LEFT JOIN suizamente_private.progress g ON g.user_id=actor AND g.question_id=q.id
      WHERE v.payload->>'status'='published' AND NOT v.annulled AND NOT v.id=ANY(ids)
        AND v.payload->>'category'<>'idioma'
        AND (coalesce(v.payload->>'game_type','choice')<>'short' OR desired_kind='short')
        AND (CASE WHEN kind='arrival' THEN v.payload->>'arrival_level'=lv::text ELSE NOT v.payload ? 'arrival_level' END)
        AND (v.payload->>'scope'='CH' OR pl.include_canton AND v.payload->>'canton'=pl.canton OR tc.national AND (pl.include_general OR kind='summit'))
        AND (kind='arrival' OR (v.payload->>'difficulty')::integer<=lv AND (kind<>'summit' OR v.payload->>'scope'='CH' OR tc.national))
        AND (kind='arrival' OR v.payload->>'scope'='CH' OR tc.question_id IS NOT NULL OR (v.payload->>'difficulty')::integer>=greatest(1,lv-1))
      ORDER BY CASE WHEN need_local THEN CASE WHEN v.payload->>'scope'='canton' AND v.payload->>'canton'=pl.canton THEN 0 ELSE 1 END ELSE CASE WHEN v.payload->>'scope'='CH' OR tc.national THEN 0 ELSE 1 END END,
        CASE WHEN kind='trail_review' AND g.last_correct IS FALSE THEN 0 WHEN g.question_id IS NULL THEN 1 WHEN g.last_correct IS FALSE THEN 2 ELSE 3 END,
        CASE WHEN has_trivia THEN CASE WHEN (tc.question_id IS NOT NULL)=want_trivia THEN 0 ELSE 1 END WHEN target IS NOT NULL AND n%2=1 AND v.payload->>'category'=target THEN 0 ELSE 1 END,
        CASE WHEN NOT has_trivia THEN abs((v.payload->>'difficulty')::integer-lv) ELSE 0 END,
        CASE WHEN coalesce(v.payload->>'game_type','choice')=desired_kind THEN 0 WHEN coalesce(v.payload->>'game_type','choice') IS DISTINCT FROM previous_kind THEN 1 ELSE 2 END,
        CASE WHEN has_trivia AND tc.topic IS NOT DISTINCT FROM previous_topic THEN 1 ELSE 0 END,
        abs((v.payload->>'difficulty')::integer-lv),
        CASE WHEN NOT has_trivia AND target IS NOT NULL AND v.payload->>'category'=target THEN 0 ELSE 1 END,
        coalesce(g.seen_count,0),g.last_at NULLS FIRST,
        md5(q.id||actor::text||clock_timestamp()::text) LIMIT 1;
    IF chosen IS NULL THEN RAISE EXCEPTION 'SZ_NOT_ENOUGH_QUESTIONS'; END IF;
    ids:=array_append(ids,chosen);
    SELECT tc.topic INTO previous_topic FROM suizamente_private.versions v JOIN suizamente_private.trivia_catalog tc ON tc.question_id=v.question_id WHERE v.id=chosen;
    IF EXISTS(SELECT 1 FROM suizamente_private.versions v JOIN suizamente_private.trivia_catalog tc ON tc.question_id=v.question_id AND tc.original_prompt=v.payload->>'prompt'
      WHERE v.id=chosen AND tc.national AND v.payload->>'scope'='canton' AND (NOT need_local OR v.payload->>'canton' IS DISTINCT FROM pl.canton)) THEN
      general_versions:=array_append(general_versions,chosen);
    END IF;
    SELECT coalesce(payload->>'game_type','choice') INTO previous_kind FROM suizamente_private.versions WHERE id=chosen;
  END LOOP;
  SELECT count(*) INTO local_found FROM suizamente_private.versions WHERE id=ANY(ids) AND payload->>'scope'='canton' AND NOT id=ANY(general_versions);
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
      jsonb_build_object('game_version',4,'general_versions',to_jsonb(general_versions),'node',node,'title',CASE WHEN node=-1 THEN 'Llegada a '||(m->>'name') WHEN node=jsonb_array_length(m->'stages') THEN 'Test de cima' ELSE st->>0 END,
        'practice',practice,'summit_practice',practice AND node=jsonb_array_length(m->'stages'),'gift',gift,'gift_at',gift_at,'x2',doubled,'life',life,'pass',greatest(0,(m->>'pass')::integer-CASE WHEN life THEN 1 ELSE 0 END),
        'include_general',pl.include_general,'include_canton',pl.include_canton,'xp_weights',cfg.xp_weights,'gifts','[]'::jsonb),fallback) RETURNING id INTO sid;
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