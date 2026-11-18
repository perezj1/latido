-- Suizamente: actualización incremental de jugabilidad e ilustraciones.
-- Para instalaciones que ya ejecutaron los SQL anteriores del juego.
-- Ejecutar ANTES de los nuevos lotes cantonales. No reinicializa datos ni RLS.
BEGIN;
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
  IF p ? 'image_key' AND p->>'image_key' NOT IN ('ai-cave-chapel','ai-cheese-pasta','ai-embroidery-light','ai-open-assembly','ai-senn-costume','aletsch-glacier','apricot','ar-bloch','ar-detour-notice','ar-hackbrett','ar-naturchlaus','ar-rack-rail','basel-munster','bebbi-bag','bellinzona-fortress','berg','bern-arcades','bern-covered-bridge','bilingual-station','bisse-channel','boogg','carnival-mask','chapel-bridge','chienbase','chillon','cuchaule','dixence-dam','emmentaler','fasnacht-lantern','flower-clock','forest-leash','gr-capuns','gr-ibex','gr-landwasser','gr-nusstorte','gr-sgraffito','green-bin','grossmunster','hypocaust','italian-closed','jet-deau','laundry-notice','lavaux','lion-monument','lu-shield','marine-fossil','marmite','mobilis-ticket','moor','mouette','night-tram','onion-braid','paper-sieve','papet','pet','polenta','poya-panel','priority','raclette-half','rhine-ferry','roman-theatre','sg-bratwurst','sg-embroidery','sg-library','sg-shop-hours','sg-wooden-walkway','stained-glass','stop','sz-cave-group','sz-library-notice','sz-paper-calendar','sz-potato-bake','sz-stoos-funicular','ti-shield','ur-aurochs-shield','ur-crossbow','ur-devils-bridge','ur-pass-closed','ur-wild-hay','vd-shield','water-funicular','yield','zh','zvv-ticket','zytglogge') THEN RAISE EXCEPTION 'SZ_INVALID_QUESTION'; END IF;
  IF p->>'game_type'='image' AND coalesce(p->>'image_key','') NOT IN ('ai-cave-chapel','ai-cheese-pasta','ai-embroidery-light','ai-open-assembly','ai-senn-costume','aletsch-glacier','apricot','ar-bloch','ar-detour-notice','ar-hackbrett','ar-naturchlaus','ar-rack-rail','basel-munster','bebbi-bag','bellinzona-fortress','berg','bern-arcades','bern-covered-bridge','bilingual-station','bisse-channel','boogg','carnival-mask','chapel-bridge','chienbase','chillon','cuchaule','dixence-dam','emmentaler','fasnacht-lantern','flower-clock','forest-leash','gr-capuns','gr-ibex','gr-landwasser','gr-nusstorte','gr-sgraffito','green-bin','grossmunster','hypocaust','italian-closed','jet-deau','laundry-notice','lavaux','lion-monument','lu-shield','marine-fossil','marmite','mobilis-ticket','moor','mouette','night-tram','onion-braid','paper-sieve','papet','pet','polenta','poya-panel','priority','raclette-half','rhine-ferry','roman-theatre','sg-bratwurst','sg-embroidery','sg-library','sg-shop-hours','sg-wooden-walkway','stained-glass','stop','sz-cave-group','sz-library-notice','sz-paper-calendar','sz-potato-bake','sz-stoos-funicular','ti-shield','ur-aurochs-shield','ur-crossbow','ur-devils-bridge','ur-pass-closed','ur-wild-hay','vd-shield','water-funicular','yield','zh','zvv-ticket','zytglogge') THEN RAISE EXCEPTION 'SZ_INVALID_QUESTION'; END IF;
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
REVOKE ALL ON FUNCTION suizamente_private.write_question(jsonb),
  suizamente_private.admin_action(jsonb),suizamente_private.game_start(jsonb)
  FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
