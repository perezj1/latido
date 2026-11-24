-- Frozen game_view from the pre-experience release; local upgrade test fixture.
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
