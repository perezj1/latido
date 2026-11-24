-- First visit is a practice session, never a vote or a match. Apply after v19.
BEGIN;
UPDATE suizamente_private.suizamente_configuracion SET juego=jsonb_set(juego,'{primeraVez}',
 '{"ejemplos":["voc_1s99qa8","v_j88frh","r_5vsvsx"],"pregunta":"vidrio_domingo"}'::jsonb);
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_primera_vez(
 jugador_id text PRIMARY KEY,pregunta_id text NOT NULL,opcion integer,terminada_en timestamptz,
 guia jsonb NOT NULL DEFAULT '{"giro":true,"comodin":true}'
);
ALTER TABLE suizamente_private.suizamente_primera_vez ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON suizamente_private.suizamente_primera_vez FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION suizamente_private.v20_excluidas(actor text) RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(array_agg(DISTINCT pregunta_id),'{}') FROM suizamente_private.suizamente_primera_vez
 WHERE jugador_id=actor OR jugador_id IN(SELECT CASE WHEN jugador_a=actor THEN jugador_b ELSE jugador_a END
 FROM suizamente_private.suizamente_partidas WHERE actor IN(jugador_a,jugador_b) AND estado='jugando');
$$;
-- Normal questions have their own selector; preserve its ordering and rules.
DO $$ DECLARE definition text;BEGIN
 SELECT pg_get_functiondef('suizamente_private.v2_api_base(text,jsonb,uuid,text)'::regprocedure) INTO definition;
 IF position('v20_excluidas' IN definition)=0 THEN
  IF position('WHERE NOT p.oculta AND p.payload' IN definition)=0 THEN RAISE EXCEPTION 'Missing normal question selector';END IF;
  EXECUTE replace(definition,'WHERE NOT p.oculta AND p.payload','WHERE NOT p.oculta AND NOT p.id=ANY(suizamente_private.v20_excluidas(actor)) AND p.payload');
 END IF;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v20_pregunta(item jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT jsonb_build_object('id',item->'id','tema',item->'tema','emoji',item->'emoji','pregunta',item->'pregunta',
 'opciones',(SELECT jsonb_agg(jsonb_build_object('indice',n-1,'e',o->'e','t',o->'t') ORDER BY n) FROM jsonb_array_elements(item->'opciones') WITH ORDINALITY a(o,n)));
$$;
DO $$ BEGIN
 IF to_regprocedure('suizamente_private.v20_elegir_base(text,text,text[])') IS NULL THEN
  ALTER FUNCTION suizamente_private.v4_elegir(text,text,text[]) RENAME TO v20_elegir_base;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v4_elegir(actor text,category text,excluded text[] DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 RETURN suizamente_private.v20_elegir_base(actor,category,excluded||suizamente_private.v20_excluidas(actor));
END $$;
DO $$ BEGIN
 IF to_regprocedure('suizamente_private.v20_api_base(text,jsonb,uuid,text)') IS NULL THEN
  ALTER FUNCTION public.suizamente_v2(text,jsonb,uuid,text) SET SCHEMA suizamente_private;
  ALTER FUNCTION suizamente_private.suizamente_v2(text,jsonb,uuid,text) RENAME TO v20_api_base;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.suizamente_v2(p_action text,p_args jsonb DEFAULT '{}',p_guest_id uuid DEFAULT NULL,p_guest_token text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor text:=auth.uid()::text;c jsonb:=suizamente_private.v2_config();data jsonb;item jsonb;examples jsonb;
 rec suizamente_private.suizamente_primera_vez;choice integer;counted integer;guide_key text;settings jsonb;
BEGIN
 IF p_action IN('primera_vez','primera_vez_responder','primera_vez_finalizar') THEN
  IF jsonb_typeof(p_args)<>'object' OR octet_length(p_args::text)>10000 THEN RAISE EXCEPTION 'SZV2:400:Solicitud no válida';END IF;
  actor:=suizamente_private.v2_identidad(p_guest_id,p_guest_token);
  -- Rate limit practice too; no public access to any other question id.
  INSERT INTO suizamente_private.suizamente_limites(clave,minuto,peticiones) VALUES(actor,date_trunc('minute',clock_timestamp()),1)
   ON CONFLICT(clave) DO UPDATE SET minuto=excluded.minuto,peticiones=CASE WHEN suizamente_limites.minuto=excluded.minuto THEN suizamente_limites.peticiones+1 ELSE 1 END RETURNING peticiones INTO counted;
  IF counted>120 THEN RAISE EXCEPTION 'SZV2:429:Espera un momento';END IF;
  -- Carry the anonymous practice across sign-in only with its HttpOnly credential.
  IF auth.uid() IS NOT NULL AND p_guest_id IS NOT NULL AND EXISTS(SELECT 1 FROM suizamente_private.suizamente_sesiones_invitado WHERE id=p_guest_id AND token_hash=encode(sha256(convert_to(p_guest_token,'UTF8')),'hex')) THEN
   INSERT INTO suizamente_private.suizamente_primera_vez SELECT actor,pregunta_id,opcion,terminada_en,guia FROM suizamente_private.suizamente_primera_vez WHERE jugador_id='invitado-'||p_guest_id::text ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO suizamente_private.suizamente_primera_vez(jugador_id,pregunta_id) VALUES(actor,c#>>'{primeraVez,pregunta}') ON CONFLICT DO NOTHING;
  SELECT * INTO rec FROM suizamente_private.suizamente_primera_vez WHERE jugador_id=actor FOR UPDATE;
  SELECT payload INTO item FROM suizamente_private.suizamente_preguntas WHERE id=rec.pregunta_id;
  IF item IS NULL THEN RAISE EXCEPTION 'SZV2:503:Falta la pregunta de bienvenida';END IF;
  IF p_action='primera_vez_responder' THEN
   IF coalesce(p_args->>'opcion','')!~'^[0-9]+$' THEN RAISE EXCEPTION 'SZV2:400:Elige una opción';END IF;
   choice:=(p_args->>'opcion')::integer;
   IF choice<0 OR choice>=jsonb_array_length(item->'opciones') THEN RAISE EXCEPTION 'SZV2:400:Elige una opción';END IF;
   IF rec.opcion IS NULL THEN
    UPDATE suizamente_private.suizamente_primera_vez SET opcion=choice WHERE jugador_id=actor RETURNING * INTO rec;
   END IF;
  END IF;
  IF p_action='primera_vez_finalizar' THEN
   UPDATE suizamente_private.suizamente_primera_vez SET terminada_en=coalesce(terminada_en,clock_timestamp()) WHERE jugador_id=actor RETURNING * INTO rec;
   IF auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM suizamente_private.suizamente_jugadores WHERE jugador_id=actor) THEN
    data:=suizamente_private.v20_api_base('bienvenida','{}',p_guest_id,p_guest_token);
    UPDATE suizamente_private.suizamente_jugadores SET ajustes=(ajustes-'guia')||jsonb_build_object('onboarding',rec.terminada_en)||CASE WHEN rec.guia='{}'::jsonb THEN '{}'::jsonb ELSE jsonb_build_object('guia',rec.guia) END,actualizado_en=clock_timestamp() WHERE jugador_id=actor RETURNING ajustes INTO settings;
    RETURN jsonb_set(data,'{jugador,ajustes}',settings);
   END IF;
   RETURN jsonb_build_object('pendientePerfil',true,'onboarding',rec.terminada_en);
  END IF;
  SELECT jsonb_agg(suizamente_private.v20_pregunta(p.payload) ORDER BY n) INTO examples FROM jsonb_array_elements_text(c#>'{primeraVez,ejemplos}') WITH ORDINALITY a(id,n) JOIN suizamente_private.suizamente_preguntas p ON p.id=a.id;
  data:=jsonb_build_object('ejemplos',examples,'pregunta',suizamente_private.v20_pregunta(item));
  -- Only a persisted answer unlocks the solution. Never send example solutions.
  IF rec.opcion IS NOT NULL THEN data:=data||jsonb_build_object('resultado',jsonb_build_object('opcion',rec.opcion,'correcta',item->'correcta','ok',rec.opcion=(item->>'correcta')::integer,'dato',item->'dato'));END IF;
  RETURN data;
 END IF;
 data:=suizamente_private.v20_api_base(p_action,p_args,p_guest_id,p_guest_token);
 IF p_action='config' THEN RETURN data||jsonb_build_object('apiVersion',20);END IF;
 IF actor IS NOT NULL AND p_action='borrar_jugador' THEN
  DELETE FROM suizamente_private.suizamente_primera_vez WHERE jugador_id=actor OR (jugador_id='invitado-'||p_guest_id::text AND EXISTS(SELECT 1 FROM suizamente_private.suizamente_sesiones_invitado WHERE id=p_guest_id AND token_hash=encode(sha256(convert_to(p_guest_token,'UTF8')),'hex')));
 END IF;
 -- Attach the two hints to the first match only, even if several are created.
 IF actor IS NOT NULL AND p_action IN('crear_partida','partida') AND data->>'estado' IN('jugando','buscando') THEN
  UPDATE suizamente_private.suizamente_primera_vez SET guia=guia||jsonb_build_object('partida',data->>'id') WHERE jugador_id=actor AND guia<>'{}'::jsonb AND NOT guia ? 'partida' RETURNING * INTO rec;
  IF FOUND THEN
   UPDATE suizamente_private.suizamente_jugadores SET ajustes=jsonb_set(ajustes,'{guia}',rec.guia),actualizado_en=clock_timestamp() WHERE jugador_id=actor RETURNING ajustes INTO settings;
   IF data ? 'jugador' THEN data:=jsonb_set(data,'{jugador,ajustes}',settings);END IF;
  END IF;
 END IF;
 -- Dismiss hints in the same successful transaction as the real game action.
 IF actor IS NOT NULL AND p_action IN('girar','respuesta') AND EXISTS(SELECT 1 FROM suizamente_private.suizamente_primera_vez WHERE jugador_id=actor AND guia->>'partida'=p_args->>'id') THEN
  guide_key:=CASE WHEN p_action='girar' THEN 'giro' ELSE 'comodin' END;
  IF p_action='girar' OR EXISTS(SELECT 1 FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=(p_args->>'id')::uuid AND jugador_id=actor AND n=(p_args->>'n')::integer AND modo='normal') THEN
   UPDATE suizamente_private.suizamente_primera_vez SET guia=CASE WHEN (guia-guide_key)-'partida'='{}'::jsonb THEN '{}'::jsonb ELSE guia-guide_key END WHERE jugador_id=actor RETURNING * INTO rec;
   UPDATE suizamente_private.suizamente_jugadores SET ajustes=CASE WHEN rec.guia='{}'::jsonb THEN ajustes-'guia' ELSE jsonb_set(ajustes,'{guia}',rec.guia) END,actualizado_en=clock_timestamp() WHERE jugador_id=actor AND ajustes ? 'guia' RETURNING ajustes INTO settings;
   IF settings IS NOT NULL AND data ? 'jugador' THEN data:=jsonb_set(data,'{jugador,ajustes}',settings);END IF;
  END IF;
 END IF;
 RETURN data;
END $$;
DO $$ DECLARE r record;BEGIN
 FOR r IN SELECT p.oid::regprocedure sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='suizamente_private' AND p.proname LIKE 'v20_%' LOOP EXECUTE 'REVOKE ALL ON FUNCTION '||r.sig||' FROM PUBLIC,anon,authenticated';END LOOP;
END $$;
REVOKE ALL ON FUNCTION suizamente_private.v4_elegir(text,text,text[]) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
