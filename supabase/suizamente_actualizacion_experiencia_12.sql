-- Suizamente 12: enunciados directos y corrección estructurada de parejas.
-- Ejecutar una vez en una instalación con el juego existente. Es repetible.
-- No reimporta preguntas ni modifica versiones, XP, etapas, intentos o RLS.
BEGIN;
CREATE OR REPLACE FUNCTION suizamente_private.game_prompt(p jsonb) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT coalesce((SELECT e.statement FROM (VALUES
    ('game-tf-2-0','¿Qué caracteriza a los cantones suizos?
Respuesta propuesta: «Tienen instituciones y competencias propias». ¿Es correcta?','Los cantones suizos tienen instituciones y competencias propias.'),
    ('game-tf-2-1','Antes de usar un sótano o plaza adicional, ¿qué conviene revisar?
Respuesta propuesta: «Si otro vecino tiene un coche». ¿Es correcta?','Antes de usar un sótano o una plaza adicional, basta con comprobar si otro vecino tiene coche.'),
    ('game-tf-2-2','¿Qué conjunto de datos debe quedar claro antes de empezar un trabajo?
Respuesta propuesta: «Función, salario y jornada acordada». ¿Es correcta?','Antes de empezar un trabajo, deben quedar claras la función, el salario y la jornada acordada.'),
    ('game-tf-2-3','¿Qué describe la franquicia del seguro de salud?
Respuesta propuesta: «Una oficina de la aseguradora dentro del hospital». ¿Es correcta?','La franquicia es una oficina de la aseguradora dentro del hospital.'),
    ('game-tf-2-4','¿Qué país comparte frontera con Suiza?
Respuesta propuesta: «Liechtenstein». ¿Es correcta?','Liechtenstein comparte frontera con Suiza.'),
    ('game-tf-3-0','¿Qué cámaras forman el Parlamento federal?
Respuesta propuesta: «Consejo Nacional y Consejo de los Estados». ¿Es correcta?','El Parlamento federal está formado por el Consejo Nacional y el Consejo de los Estados.'),
    ('game-tf-3-1','Varias personas figuran como inquilinas en el mismo contrato. ¿Qué deben entender sobre la renta?
Respuesta propuesta: «Que solo paga quien llega primero». ¿Es correcta?','En un contrato de alquiler conjunto, solo paga quien llega primero.'),
    ('game-tf-3-2','¿Qué idea describe correctamente un contrato de trabajo?
Respuesta propuesta: «Establece obligaciones tanto para la empresa como para la persona empleada». ¿Es correcta?','Un contrato de trabajo establece obligaciones para la empresa y para la persona empleada.'),
    ('game-tf-3-3','¿Qué ocurre generalmente con la prima al elegir una franquicia opcional más alta?
Respuesta propuesta: «Desaparece todo gasto sanitario posible». ¿Es correcta?','Una franquicia más alta elimina cualquier gasto sanitario que puedas tener.'),
    ('game-tf-3-4','¿Qué conviene saber sobre el alemán en la Suiza germanófona?
Respuesta propuesta: «Se usan dialectos suizos en el habla cotidiana y alemán estándar en muchos textos». ¿Es correcta?','En la Suiza germanófona se hablan dialectos suizos y se usa alemán estándar en muchos textos.'),
    ('game-tf-4-0','¿Quién elige a los miembros del Consejo Federal?
Respuesta propuesta: «La Asamblea Federal reunida». ¿Es correcta?','La Asamblea Federal reunida elige a los miembros del Consejo Federal.'),
    ('game-tf-4-1','¿Qué información conviene dejar claramente documentada en un subalquiler?
Respuesta propuesta: «Solo el plazo: las demás condiciones se acuerdan después de ocupar la vivienda». ¿Es correcta?','En un subalquiler, basta con acordar el plazo: las demás condiciones se pueden dejar para después de entrar.'),
    ('game-tf-4-2','¿Cómo se relacionan la jornada pactada y las normas de protección laboral?
Respuesta propuesta: «La jornada pactada debe respetar los límites legales aplicables». ¿Es correcta?','La jornada pactada debe respetar los límites legales aplicables.'),
    ('game-tf-4-3','Para una solicitud de seguro básico sujeta a la obligación de asegurarse, ¿qué distingue la admisión frente a un complementario?
Respuesta propuesta: «Ambos pueden rechazar cualquier solicitud por una enfermedad previa en las mismas condiciones». ¿Es correcta?','El seguro básico obligatorio y el complementario pueden rechazar una solicitud por enfermedad previa en las mismas condiciones.'),
    ('game-tf-4-4','Tu abono cubre muchos trayectos y quieres subir a una línea de montaña. ¿Qué debes comprobar?
Respuesta propuesta: «Su inclusión o descuento en el mapa de validez del abono». ¿Es correcta?','Antes de usar tu abono en una línea de montaña, conviene comprobar su mapa de validez y los descuentos.'),
    ('game-tf-5-0','Debes informarte sobre escuela local y sobre una norma federal. ¿Qué enfoque es correcto?
Respuesta propuesta: «Identificar la autoridad competente para cada asunto». ¿Es correcta?','Para una duda escolar y una norma federal, conviene consultar la autoridad competente de cada asunto.'),
    ('game-tf-5-1','Vais a compartir piso y todos firmaréis. ¿Qué combinación de comprobaciones es adecuada?
Respuesta propuesta: «Repartir la renta entre compañeros y dar por hecho que cada uno responde solo de su parte». ¿Es correcta?','Si todos firmáis el contrato del piso, basta con repartir la renta para que cada uno responda solo de su parte.'),
    ('game-tf-5-2','Dos ofertas tienen el mismo salario anunciado. ¿Qué comparación es más completa?
Respuesta propuesta: «Jornada, vacaciones y condiciones contractuales junto con el salario». ¿Es correcta?','Para comparar dos empleos, conviene mirar también la jornada, las vacaciones y las condiciones del contrato.'),
    ('game-tf-5-3','Una prima baja te atrae, pero apenas tienes ahorro para gastos imprevistos. ¿Qué debes comparar antes de elegir?
Respuesta propuesta: «Solo la cuota mensual: una franquicia más alta reduce siempre cualquier coste total posible». ¿Es correcta?','Al elegir seguro, basta con comparar la prima: una franquicia más alta reduce siempre cualquier coste total.'),
    ('game-tf-5-4','Un abono tiene cobertura en Suiza y planeas seguir hacia el extranjero. ¿Qué comprobación necesitas?
Respuesta propuesta: «Dónde termina su validez y qué título cubre la continuación». ¿Es correcta?','Antes de seguir al extranjero con un abono suizo, conviene comprobar hasta dónde cubre y cómo continuar.')
  ) AS e(id,original,statement) WHERE btrim(regexp_replace(e.original,'[[:space:]]+',' ','g'))=btrim(regexp_replace(p->>'prompt','[[:space:]]+',' ','g')) AND p->>'game_type'='tf'),p->>'prompt')
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
  -- Solutions are disclosed only after this question has an immutable answer.
  IF a.session_id IS NOT NULL AND kind='match' THEN
    feedback:=feedback||jsonb_build_object('correct_pairs',(SELECT jsonb_agg(jsonb_build_object('left',l.value,'right',v.payload->'pairs'->>(l.ordinality::integer-1)) ORDER BY l.ordinality) FROM jsonb_array_elements_text(v.payload->'options') WITH ORDINALITY l));
  END IF;
  IF a.session_id IS NOT NULL AND kind IN ('order','short') THEN
    feedback:=feedback||jsonb_build_object('correct_answer',suizamente_private.game_order_solution(v.payload),'correct_option',NULL,'correct_options','[]'::jsonb);
  END IF;
  SELECT coalesce(jsonb_agg(ans.correct AND NOT av.annulled ORDER BY ans.position),'[]'::jsonb),coalesce(jsonb_agg(CASE WHEN av.annulled THEN 'annulled' WHEN ans.skipped THEN 'skipped' WHEN ans.correct THEN 'correct' ELSE 'wrong' END ORDER BY ans.position),'[]'::jsonb),count(*) FILTER(WHERE ans.correct AND NOT av.annulled),count(*) FILTER(WHERE av.annulled)
    INTO history,states,ncorrect,annulled FROM suizamente_private.answers ans JOIN suizamente_private.versions av ON av.id=ans.version_id WHERE ans.session_id=s.id;
  IF s.status='completed' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('position',ans.position,'prompt',suizamente_private.game_prompt(av.payload),'category',av.payload->>'category','correct',ans.correct AND NOT av.annulled,'skipped',ans.skipped,'annulled',av.annulled,'xp',ans.xp_received,
      'chosen_answer',CASE WHEN ans.skipped THEN NULL WHEN av.payload->>'game_type'='short' THEN ans.response#>>'{}' WHEN av.payload->>'game_type'='order' THEN (SELECT string_agg(av.payload->'options'->>x.value::integer,' ' ORDER BY x.ordinality) FROM jsonb_array_elements_text(ans.response) WITH ORDINALITY x) WHEN av.payload->>'game_type'='match' THEN 'Parejas completadas · '||(ans.response->>'errors')||' errores' WHEN av.payload->>'game_type'='multi' THEN (SELECT string_agg(av.payload->'options'->>x::integer,'; ') FROM jsonb_array_elements_text(ans.response) x) ELSE av.payload->'options'->>((s.option_orders->av.id::text->>ans.choice)::integer) END,
      'correct_answer',CASE WHEN av.payload->>'game_type' IN ('order','short') THEN suizamente_private.game_order_solution(av.payload) WHEN av.payload->>'game_type'='multi' THEN (SELECT string_agg(av.payload->'options'->> x::integer,'; ') FROM jsonb_array_elements_text(av.payload->'correct_indices') x) WHEN av.payload->>'game_type'='match' THEN (SELECT string_agg(l.value||' → '||(av.payload->'pairs'->>(l.ordinality::integer-1)),'; ' ORDER BY l.ordinality) FROM jsonb_array_elements_text(av.payload->'options') WITH ORDINALITY l) ELSE av.payload->'options'->>((av.payload->>'correct_index')::integer) END,
      'correct_pairs',CASE WHEN av.payload->>'game_type'='match' THEN (SELECT jsonb_agg(jsonb_build_object('left',l.value,'right',av.payload->'pairs'->>(l.ordinality::integer-1)) ORDER BY l.ordinality) FROM jsonb_array_elements_text(av.payload->'options') WITH ORDINALITY l) ELSE NULL END,
      'explanation',av.payload->>'explanation','source_url',av.payload->>'source_url','source_title',av.payload->>'source_title') ORDER BY ans.position),'[]'::jsonb) INTO reviews
      FROM suizamente_private.answers ans JOIN suizamente_private.versions av ON av.id=ans.version_id WHERE ans.session_id=s.id;
  END IF;
  RETURN jsonb_build_object('id',s.id,'mode',s.mode,'status',s.status,'game_version',4,'position',s.position,'total',cardinality(s.version_ids),'valid_total',cardinality(s.version_ids)-annulled_total,'level',s.level,'canton',s.canton,'category',s.category,'fallback',s.fallback,
    'xp_gained',s.xp_gained,'ascent_passed',s.ascent_passed,'history',history,'states',states,'review_answers',reviews,'correct_count',ncorrect,'annulled_count',annulled,
    'day',s.day_key,'week',s.week_key,'created_at',s.created_at,'completed_at',s.completed_at,
    'trail',(s.rules-'xp_weights'-'pairs')||jsonb_build_object('pass',greatest(1,coalesce((s.rules->>'pass')::integer,1)-annulled_total)),'pair_state',coalesce(s.rules->'pairs'->s.position::text,'{"matched":[],"errors":0}'::jsonb)||jsonb_build_object('matched_right',coalesce((SELECT jsonb_agg(n.ordinality::integer-1) FROM jsonb_array_elements(s.option_orders->v.id::text) WITH ORDINALITY n WHERE coalesce(s.rules->'pairs'->s.position::text->'matched','[]') @> jsonb_build_array(n.value::text::integer)),'[]'::jsonb)),
    'question',jsonb_build_object('version_id',v.id,'id',v.question_id,'type',kind,'image_key',v.payload->>'image_key','category',v.payload->>'category','difficulty',(v.payload->>'difficulty')::integer,'scope',v.payload->>'scope','canton',v.payload->>'canton','language',v.payload->>'language','prompt',suizamente_private.game_prompt(v.payload),'options',opts,'pairs',pairs,'max_length',coalesce((v.payload->>'max_length')::integer,80)),'answer',feedback);
END $$;
REVOKE ALL ON FUNCTION suizamente_private.game_prompt(jsonb),suizamente_private.game_view(uuid) FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
