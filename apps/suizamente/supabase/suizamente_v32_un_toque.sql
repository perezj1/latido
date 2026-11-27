BEGIN;
CREATE OR REPLACE FUNCTION suizamente_private.mej_entregar_directo() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c jsonb:=suizamente_private.mej_config();hora time:=(clock_timestamp() AT TIME ZONE 'Europe/Zurich')::time;quiet boolean;settings suizamente_private.mejoras_ajustes;
BEGIN
 IF NEW.tipo='idea' OR NEW.tipo='misterio_nuevo' THEN RETURN NEW;END IF;
 IF NEW.tipo LIKE 'minuto_%' AND NOT suizamente_private.mej_activa('minuto') OR NEW.tipo LIKE 'espejo_%' AND NOT suizamente_private.mej_activa('espejo') THEN RETURN NEW;END IF;
 SELECT * INTO settings FROM suizamente_private.mejoras_ajustes WHERE persona=NEW.persona;
 quiet:=coalesce(settings.sin_noches,true) AND CASE WHEN (c#>>'{unToque,sinAvisosDe}')::time>(c#>>'{unToque,sinAvisosHasta}')::time THEN hora>=(c#>>'{unToque,sinAvisosDe}')::time OR hora<(c#>>'{unToque,sinAvisosHasta}')::time ELSE hora>=(c#>>'{unToque,sinAvisosDe}')::time AND hora<(c#>>'{unToque,sinAvisosHasta}')::time END;
 IF NOT quiet THEN
  PERFORM suizamente_private.v7_notificar(NEW.persona,NEW.tipo,NEW.ref,NEW.texto,NEW.href);
  UPDATE suizamente_private.mejoras_avisos SET enviado=clock_timestamp() WHERE persona=NEW.persona AND tipo=NEW.tipo AND ref=NEW.ref;
 END IF;
 RETURN NEW;
END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='suizamente_private.mejoras_avisos'::regclass AND tgname='mejoras_entregar_directo') THEN
 CREATE TRIGGER mejoras_entregar_directo AFTER INSERT ON suizamente_private.mejoras_avisos FOR EACH ROW EXECUTE FUNCTION suizamente_private.mej_entregar_directo();END IF;END $$;
CREATE OR REPLACE FUNCTION suizamente_private.mej_resumen(actor text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE hero jsonb;ideas jsonb:='[]';modes jsonb:='[]';best integer;pending integer;challenge jsonb;mystery jsonb;mp jsonb;pl suizamente_private.suizamente_jugadores;match jsonb;k jsonb;price integer;level integer;near jsonb;
BEGIN
 SELECT * INTO pl FROM suizamente_private.suizamente_jugadores WHERE jugador_id=actor;
 IF suizamente_private.mej_activa('minuto') THEN
  SELECT coalesce(max(puntos),0) INTO best FROM suizamente_private.minuto_partidas WHERE persona=actor AND estado='terminado';
  modes:=modes||jsonb_build_array(jsonb_build_object('id','minuto','nombre','El minuto suizo','linea','Récord '||best,'icono','crono','to','/suizamente/minuto'));
 END IF;
 IF suizamente_private.mej_activa('espejo') THEN
  PERFORM suizamente_private.mej_espejo_caducar();
  SELECT count(*) INTO pending FROM suizamente_private.espejo_retos r WHERE r.rival=actor AND r.estado='esperando' AND NOT EXISTS(SELECT 1 FROM suizamente_private.espejo_jugadas j WHERE j.reto=r.id AND j.persona=actor AND j.terminado);
  SELECT suizamente_private.mej_espejo_vista(id,actor) INTO challenge FROM suizamente_private.espejo_retos r WHERE rival=actor AND estado='esperando' AND NOT EXISTS(SELECT 1 FROM suizamente_private.espejo_jugadas j WHERE j.reto=r.id AND j.persona=actor AND j.terminado) ORDER BY caduca LIMIT 1;
  modes:=modes||jsonb_build_array(jsonb_build_object('id','espejo','nombre','Reto espejo','linea',CASE WHEN challenge IS NULL THEN 'Las mismas preguntas, cuando quieras' ELSE (challenge#>>'{creador,apodo}')||' te ha retado' END,'globo',pending,'icono','espejo','to','/suizamente/espejo'));
 END IF;
 IF suizamente_private.mej_activa('misterio') THEN
  mystery:=suizamente_private.mej_misterio_vista(actor,(clock_timestamp() AT TIME ZONE 'Europe/Zurich')::date);
  IF (mystery->>'disponible')::boolean THEN modes:=modes||jsonb_build_array(jsonb_build_object('id','misterio','nombre','El misterio del día','linea',CASE WHEN (mystery->>'terminado')::boolean THEN 'Hoy ya lo has jugado' ELSE 'Nuevo · '||(suizamente_private.mej_config()#>>'{misterio,pistas}')||' pistas' END,'globo',CASE WHEN (mystery->>'terminado')::boolean THEN NULL ELSE '!' END,'icono','misterio','to','/suizamente/misterio'));END IF;
 END IF;
 IF suizamente_private.mej_activa('unToque') THEN
  SELECT value INTO match FROM jsonb_array_elements(public.suizamente_v2('partidas','{}',NULL,NULL)->'partidas')
  WHERE value->>'estado'='jugando' AND (value->>'teToca')::boolean AND value->'rival'<>'null'::jsonb
  ORDER BY jsonb_array_length(value->'tusSellos') DESC,coalesce((value->>'tuBarra')::integer,0) DESC,(value->>'plazo')::timestamptz LIMIT 1;
  IF match IS NOT NULL THEN hero:=jsonb_build_object('id','partida','to','/suizamente/partida/'||(match->>'id'),'titulo','Tu turno contra '||(match#>>'{rival,apodo}'),'linea',CASE WHEN (match->>'tuBarra')::integer=(suizamente_private.v2_config()#>>'{partida,barraParaSello}')::integer-1 THEN 'A 1 acierto de jugar por un sello' ELSE 'Quedan '||greatest(0,ceil(extract(epoch FROM (match->>'plazo')::timestamptz-clock_timestamp())/3600))||' h' END);
  ELSIF challenge IS NOT NULL THEN hero:=jsonb_build_object('id','espejo','to','/suizamente/espejo/'||(challenge->>'id'),'titulo',(challenge#>>'{creador,apodo}')||' te ha retado','linea','Responde las mismas preguntas, cuando quieras');
  ELSIF coalesce((mystery->>'disponible')::boolean,false) AND NOT (mystery->>'terminado')::boolean THEN hero:=jsonb_build_object('id','misterio','to','/suizamente/misterio','titulo','Descubre el misterio de hoy','linea','Cuantas menos pistas, más ganas');
  ELSE hero:=jsonb_build_object('id','nueva','to','/suizamente/nueva','titulo','Nueva partida');END IF;
  mp:=suizamente_private.v5_mapa(actor);
  SELECT value INTO k FROM jsonb_array_elements(suizamente_private.v2_config()#>ARRAY['mapa','regiones',mp->>'region','cantones'])
  WHERE coalesce((mp#>>ARRAY['niveles',value->>'id'])::integer,0)<(suizamente_private.v2_config()#>>'{mapa,nivelesPorCanton}')::integer
  AND coalesce((mp#>>ARRAY['costes',value->>'id',coalesce(mp#>>ARRAY['niveles',value->>'id'],'0')])::integer,2147483647)<=pl.monedas
  ORDER BY coalesce((mp#>>ARRAY['niveles',value->>'id'])::integer,0) DESC,value->>'id' LIMIT 1;
  IF k IS NOT NULL THEN
   level:=coalesce((mp#>>ARRAY['niveles',k->>'id'])::integer,0);price:=(mp#>>ARRAY['costes',k->>'id',level::text])::integer;
   ideas:=ideas||jsonb_build_array(jsonb_build_object('id','canton','titulo','Completa '||(k->>'nombre'),'linea','Tienes las monedas para subir al nivel '||(level+1),'boton','Subir','icono','mapa','to','/suizamente/mapa?canton='||(k->>'id')));
  END IF;
  IF best>0 THEN ideas:=ideas||jsonb_build_array(jsonb_build_object('id','minuto','titulo','Supera tu récord','linea','El minuto suizo · récord '||best,'boton','Jugar','icono','crono','to','/suizamente/minuto'));END IF;
  SELECT value INTO near FROM jsonb_array_elements(suizamente_private.v6_album(actor)->'colecciones') WHERE NOT (value->>'completa')::boolean AND (value->>'tengo')::integer>0 ORDER BY (value->>'tengo')::numeric/greatest(1,jsonb_array_length(value->'cartas')) DESC LIMIT 1;
  IF near IS NOT NULL AND coalesce((pl.inventario->>'sobres')::integer,0)>0 THEN ideas:=ideas||jsonb_build_array(jsonb_build_object('id','album','titulo','Completa tu colección','linea',near->>'nombre','boton','Abrir','icono','sobre','to','/suizamente/album'));END IF;
  SELECT value INTO near FROM jsonb_array_elements(public.suizamente_v2('misiones','{}',NULL,NULL)->'misiones') WHERE (value->>'avance')::numeric>0 AND (value->>'avance')::numeric<(value->>'meta')::numeric ORDER BY (value->>'avance')::numeric/(value->>'meta')::numeric DESC LIMIT 1;
  IF near IS NOT NULL THEN ideas:=ideas||jsonb_build_array(jsonb_build_object('id','misiones','titulo',near->>'titulo','linea',(near->>'avance')||'/'||(near->>'meta'),'boton','Ver','icono','misiones','to','/suizamente/misiones'));END IF;
  SELECT value INTO near FROM jsonb_array_elements(public.suizamente_v2('logros','{}',NULL,NULL)->'logros') WHERE NOT (value->>'conseguido')::boolean AND (value->>'avance')::numeric>0 ORDER BY (value->>'avance')::numeric/greatest(1,(value->>'meta')::numeric) DESC LIMIT 1;
  IF near IS NOT NULL THEN ideas:=ideas||jsonb_build_array(jsonb_build_object('id','logros','titulo',near->>'nombre','linea',(near->>'avance')||'/'||(near->>'meta'),'boton','Ver','icono','trofeo','to','/suizamente/logros'));END IF;
  SELECT coalesce(jsonb_agg(value ORDER BY n),'[]') INTO ideas FROM(SELECT value,n FROM jsonb_array_elements(ideas) WITH ORDINALITY i(value,n) WHERE value->>'to'<>hero->>'to' LIMIT (suizamente_private.mej_config()#>>'{unToque,paraTiMax}')::integer) filtered;
 END IF;
 RETURN jsonb_build_object('boton',hero,'modos',modes,'ideas',ideas);
END $$;
CREATE OR REPLACE FUNCTION public.suizamente_mejoras_avisos(p_ahora timestamptz DEFAULT clock_timestamp()) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a record;r record;hoy date:=(p_ahora AT TIME ZONE 'Europe/Zurich')::date;hora time:=(p_ahora AT TIME ZONE 'Europe/Zurich')::time;c jsonb:=suizamente_private.mej_config();quiet boolean;sent integer:=0;suggestion jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(7217840);
 PERFORM pg_advisory_xact_lock(hashtextextended('suizamente:mejoras:avisos',0));
 IF NOT suizamente_private.mej_activa('minuto') AND NOT suizamente_private.mej_activa('espejo') AND NOT suizamente_private.mej_activa('misterio') AND NOT suizamente_private.mej_activa('unToque') THEN RETURN jsonb_build_object('enviados',0);END IF;
 IF suizamente_private.mej_activa('minuto') THEN
  FOR r IN SELECT id,persona FROM suizamente_private.minuto_partidas WHERE estado='jugando' AND fin_previsto+make_interval(secs=>(suizamente_private.v2_config()#>>'{partida,margenServidorSegundos}')::integer)<clock_timestamp() ORDER BY persona,id LOOP
   PERFORM pg_advisory_xact_lock(hashtextextended('suizamente:api:'||r.persona,0));PERFORM suizamente_private.mej_minuto_cerrar(r.id);
  END LOOP;
 END IF;
 IF suizamente_private.mej_activa('espejo') THEN PERFORM suizamente_private.mej_espejo_caducar();END IF;
 FOR a IN SELECT j.jugador_id,coalesce(s.ideas,false) ideas,coalesce(s.sin_noches,true) sin_noches,coalesce(s.misterio,false) misterio
 FROM suizamente_private.suizamente_jugadores j LEFT JOIN suizamente_private.mejoras_ajustes s ON s.persona=j.jugador_id
 WHERE j.usuario_id IS NOT NULL AND NOT j.bloqueado AND NOT j.renombrar AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=j.usuario_id AND p.banned)
 AND (coalesce(s.ideas,false) AND suizamente_private.mej_activa('unToque') OR coalesce(s.misterio,false) AND suizamente_private.mej_activa('misterio') OR EXISTS(SELECT 1 FROM suizamente_private.mejoras_avisos n WHERE n.persona=j.jugador_id AND n.enviado IS NULL)) ORDER BY j.jugador_id LOOP
  quiet:=a.sin_noches AND CASE WHEN (c#>>'{unToque,sinAvisosDe}')::time>(c#>>'{unToque,sinAvisosHasta}')::time THEN hora>=(c#>>'{unToque,sinAvisosDe}')::time OR hora<(c#>>'{unToque,sinAvisosHasta}')::time ELSE hora>=(c#>>'{unToque,sinAvisosDe}')::time AND hora<(c#>>'{unToque,sinAvisosHasta}')::time END;
  IF quiet THEN CONTINUE;END IF;
  IF suizamente_private.mej_activa('misterio') AND a.misterio AND EXISTS(SELECT 1 FROM suizamente_private.misterios WHERE fecha=hoy) AND NOT EXISTS(SELECT 1 FROM suizamente_private.misterio_intentos WHERE persona=a.jugador_id AND fecha=hoy AND terminado) THEN
   PERFORM suizamente_private.mej_aviso(a.jugador_id,'misterio_nuevo',hoy::text,'Nuevo misterio del día','/suizamente/misterio');
  END IF;
  IF suizamente_private.mej_activa('unToque') AND a.ideas AND (SELECT count(*) FROM suizamente_private.mejoras_avisos WHERE persona=a.jugador_id AND tipo='idea' AND (enviado AT TIME ZONE 'Europe/Zurich')::date=hoy)<(c#>>'{unToque,ideasAlDiaMax}')::integer THEN
   -- Real, affordable canton only; no answer or solution is ever part of a reminder.
   SELECT jsonb_build_object('titulo','Completa '||(k->>'nombre'),'to','/suizamente/mapa?canton='||(k->>'id')) INTO suggestion
   FROM suizamente_private.suizamente_jugadores j CROSS JOIN LATERAL(SELECT suizamente_private.v5_mapa(j.jugador_id) state) m
   CROSS JOIN LATERAL jsonb_array_elements(suizamente_private.v2_config()#>ARRAY['mapa','regiones',m.state->>'region','cantones']) k
   WHERE j.jugador_id=a.jugador_id AND coalesce((m.state#>>ARRAY['niveles',k->>'id'])::integer,0)<(suizamente_private.v2_config()#>>'{mapa,nivelesPorCanton}')::integer
   AND coalesce((m.state#>>ARRAY['costes',k->>'id',coalesce(m.state#>>ARRAY['niveles',k->>'id'],'0')])::integer,2147483647)<=j.monedas ORDER BY k->>'id' LIMIT 1;
   IF suggestion IS NOT NULL THEN PERFORM suizamente_private.mej_aviso(a.jugador_id,'idea',hoy::text,suggestion->>'titulo',suggestion->>'to');END IF;
  END IF;
  FOR r IN SELECT * FROM suizamente_private.mejoras_avisos WHERE persona=a.jugador_id AND enviado IS NULL ORDER BY creado FOR UPDATE LOOP
   IF r.tipo='idea' AND (NOT suizamente_private.mej_activa('unToque') OR NOT a.ideas OR r.ref<>hoy::text) OR r.tipo LIKE 'minuto_%' AND NOT suizamente_private.mej_activa('minuto') OR r.tipo LIKE 'espejo_%' AND NOT suizamente_private.mej_activa('espejo') OR r.tipo='misterio_nuevo' AND (NOT suizamente_private.mej_activa('misterio') OR NOT a.misterio OR r.ref<>hoy::text) THEN CONTINUE;END IF;
   IF r.tipo='idea' AND (SELECT count(*) FROM suizamente_private.mejoras_avisos WHERE persona=a.jugador_id AND tipo='idea' AND (enviado AT TIME ZONE 'Europe/Zurich')::date=hoy)>=(c#>>'{unToque,ideasAlDiaMax}')::integer THEN CONTINUE;END IF;
   PERFORM suizamente_private.v7_notificar(a.jugador_id,r.tipo,r.ref,r.texto,r.href);
   UPDATE suizamente_private.mejoras_avisos SET enviado=p_ahora WHERE persona=r.persona AND tipo=r.tipo AND ref=r.ref;sent:=sent+1;
  END LOOP;
 END LOOP;
 RETURN jsonb_build_object('enviados',sent);
END $$;
REVOKE ALL ON FUNCTION public.suizamente_mejoras_avisos(timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.suizamente_mejoras_avisos(timestamptz) TO service_role;
CREATE OR REPLACE FUNCTION suizamente_private.mej_libreta(actor text,args jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q jsonb;pid text:=args->>'preguntaId';active boolean;
BEGIN
 IF jsonb_typeof(args->'guardar') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'SZV2:400:Indica si quieres guardar el dato';END IF;
 active:=(args->>'guardar')::boolean;
 IF active THEN
  SELECT payload INTO q FROM suizamente_private.minuto_respuestas r JOIN suizamente_private.minuto_partidas m ON m.id=r.partida WHERE m.persona=actor AND r.pregunta=pid AND r.respondida IS NOT NULL LIMIT 1;
  IF q IS NULL THEN SELECT item INTO q FROM suizamente_private.espejo_jugadas j JOIN suizamente_private.espejo_retos r ON r.id=j.reto CROSS JOIN LATERAL jsonb_array_elements(r.preguntas) item WHERE j.persona=actor AND item->>'id'=pid AND EXISTS(SELECT 1 FROM jsonb_array_elements(j.respuestas) response WHERE response->>'preguntaId'=pid) LIMIT 1;END IF;
  IF q IS NULL THEN RAISE EXCEPTION 'SZV2:409:Responde antes de guardar el dato';END IF;
  IF (SELECT count(*) FROM suizamente_private.suizamente_libreta WHERE jugador_id=actor)>=(suizamente_private.v2_config()#>>'{comunidad,libretaMax}')::integer AND NOT EXISTS(SELECT 1 FROM suizamente_private.suizamente_libreta WHERE jugador_id=actor AND pregunta_id=pid) THEN RAISE EXCEPTION 'SZV2:409:Tu libreta está llena';END IF;
  INSERT INTO suizamente_private.suizamente_libreta(jugador_id,pregunta_id,contenido) VALUES(actor,pid,jsonb_build_object('tema',q->'tema','emoji',q->'emoji','pregunta',q->'pregunta','dato',q->'dato')) ON CONFLICT DO NOTHING;
 ELSE DELETE FROM suizamente_private.suizamente_libreta WHERE jugador_id=actor AND pregunta_id=pid;END IF;
 RETURN jsonb_build_object('guardada',active);
END $$;
CREATE OR REPLACE FUNCTION public.suizamente_mejoras(p_action text,p_args jsonb DEFAULT '{}',p_guest_id uuid DEFAULT NULL,p_guest_token text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE kind text:=split_part(p_action,'/',1);action text:=split_part(p_action,'/',2);actor text:=auth.uid()::text;r suizamente_private.espejo_retos;target text;lock_person text;
BEGIN
 IF p_action='config' THEN RETURN suizamente_private.mej_config();END IF;
 IF kind IN('minuto','espejo','misterio','decorar') AND NOT suizamente_private.mej_activa(kind) OR kind='avisos' AND NOT suizamente_private.mej_activa('unToque') THEN RAISE EXCEPTION 'SZV2:404:Ruta no disponible';END IF;
 IF kind='libreta' AND NOT suizamente_private.mej_activa('minuto') AND NOT suizamente_private.mej_activa('espejo') THEN RAISE EXCEPTION 'SZV2:404:Ruta no disponible';END IF;
 IF kind='resumen' AND NOT suizamente_private.mej_activa('minuto') AND NOT suizamente_private.mej_activa('espejo') AND NOT suizamente_private.mej_activa('misterio') AND NOT suizamente_private.mej_activa('unToque') THEN RAISE EXCEPTION 'SZV2:404:Ruta no disponible';END IF;
 IF kind NOT IN('minuto','espejo','misterio','decorar','resumen','avisos','libreta') THEN RAISE EXCEPTION 'SZV2:404:Ruta no disponible';END IF;
 IF actor IS NULL THEN RAISE EXCEPTION 'SZV2:401:Entra con tu cuenta de Latido para jugar';END IF;
 PERFORM pg_advisory_xact_lock(7217840);
 -- Mirror rewards touch two accounts: use the existing engine's sorted locks.
 IF kind='espejo' THEN
  IF action='aceptar' THEN SELECT * INTO r FROM suizamente_private.espejo_retos WHERE codigo=p_args->>'codigo';
  ELSIF p_args->>'id' IS NOT NULL THEN SELECT * INTO r FROM suizamente_private.espejo_retos WHERE id=(p_args->>'id')::uuid;END IF;
  FOR lock_person IN SELECT DISTINCT p FROM unnest(ARRAY[actor,r.creador,r.rival,p_args->>'amigo']) p WHERE p IS NOT NULL ORDER BY p LOOP PERFORM pg_advisory_xact_lock(hashtextextended('suizamente:api:'||lock_person,0));END LOOP;
 END IF;
 actor:=suizamente_private.mej_actor();
 CASE kind
 WHEN 'minuto' THEN RETURN suizamente_private.mej_minuto(actor,action,p_args)||suizamente_private.mej_estado(actor);
 WHEN 'espejo' THEN RETURN suizamente_private.mej_espejo(actor,action,p_args)||suizamente_private.mej_estado(actor);
 WHEN 'misterio' THEN RETURN suizamente_private.mej_misterio(actor,action,p_args)||suizamente_private.mej_estado(actor);
 WHEN 'decorar' THEN RETURN suizamente_private.mej_decorar(actor,action,p_args);
 WHEN 'resumen' THEN RETURN suizamente_private.mej_resumen(actor);
 WHEN 'libreta' THEN RETURN suizamente_private.mej_libreta(actor,p_args);
 WHEN 'avisos' THEN
  INSERT INTO suizamente_private.mejoras_ajustes(persona) VALUES(actor) ON CONFLICT DO NOTHING;
  IF action='guardar' THEN
   IF jsonb_typeof(p_args->'ideas') IS DISTINCT FROM 'boolean' OR jsonb_typeof(p_args->'sin_noches') IS DISTINCT FROM 'boolean' OR jsonb_typeof(p_args->'misterio') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'SZV2:400:Ajustes no válidos';END IF;
   UPDATE suizamente_private.mejoras_ajustes SET ideas=(p_args->>'ideas')::boolean,sin_noches=(p_args->>'sin_noches')::boolean,misterio=(p_args->>'misterio')::boolean WHERE persona=actor;
  END IF;
  RETURN (SELECT to_jsonb(a)-'persona' FROM suizamente_private.mejoras_ajustes a WHERE persona=actor);
 END CASE;
END $$;
REVOKE ALL ON FUNCTION public.suizamente_mejoras(text,jsonb,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suizamente_mejoras(text,jsonb,uuid,text) TO anon,authenticated;
DO $$ DECLARE f regprocedure;BEGIN FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='suizamente_private' AND p.proname LIKE 'mej_%' LOOP EXECUTE 'REVOKE ALL ON FUNCTION '||f||' FROM PUBLIC,anon,authenticated';END LOOP;END $$;
COMMIT;
