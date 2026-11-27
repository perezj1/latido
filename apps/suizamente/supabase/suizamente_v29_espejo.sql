BEGIN;
CREATE TABLE IF NOT EXISTS suizamente_private.espejo_retos(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),creador text NOT NULL REFERENCES suizamente_private.suizamente_jugadores(jugador_id) ON DELETE CASCADE,
 rival text REFERENCES suizamente_private.suizamente_jugadores(jugador_id) ON DELETE CASCADE,codigo text UNIQUE NOT NULL DEFAULT replace(gen_random_uuid()::text,'-',''),
 preguntas jsonb NOT NULL,creado timestamptz NOT NULL DEFAULT clock_timestamp(),caduca timestamptz NOT NULL,
 estado text NOT NULL DEFAULT 'esperando' CHECK(estado IN('esperando','jugado','caducado')),reglas jsonb NOT NULL,resultado jsonb,
 clave uuid NOT NULL,revancha_de uuid REFERENCES suizamente_private.espejo_retos ON DELETE SET NULL,UNIQUE(creador,clave),CHECK(creador IS DISTINCT FROM rival)
);
CREATE TABLE IF NOT EXISTS suizamente_private.espejo_jugadas(
 reto uuid NOT NULL REFERENCES suizamente_private.espejo_retos ON DELETE CASCADE,persona text NOT NULL REFERENCES suizamente_private.suizamente_jugadores(jugador_id) ON DELETE CASCADE,
 aciertos integer NOT NULL DEFAULT 0,ms_total bigint NOT NULL DEFAULT 0,respuestas jsonb NOT NULL DEFAULT '[]',terminado boolean NOT NULL DEFAULT false,
 pregunta_desde timestamptz NOT NULL DEFAULT clock_timestamp(),orden smallint[],PRIMARY KEY(reto,persona)
);
CREATE INDEX IF NOT EXISTS espejo_pendientes ON suizamente_private.espejo_retos(caduca) WHERE estado='esperando';
ALTER TABLE suizamente_private.espejo_retos ENABLE ROW LEVEL SECURITY;
ALTER TABLE suizamente_private.espejo_jugadas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON suizamente_private.espejo_retos,suizamente_private.espejo_jugadas FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION suizamente_private.mej_espejo_caducar() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r record;
BEGIN
 FOR r IN UPDATE suizamente_private.espejo_retos SET estado='caducado' WHERE estado='esperando' AND caduca<clock_timestamp() RETURNING id,creador LOOP
  PERFORM suizamente_private.mej_aviso(r.creador,'espejo_caducado',r.id::text,'Tu reto ha caducado','/suizamente/espejo/'||r.id);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.mej_espejo_cerrar(pid uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r suizamente_private.espejo_retos;a suizamente_private.espejo_jugadas;b suizamente_private.espejo_jugadas;winner text;pa jsonb;pb jsonb;
BEGIN
 SELECT * INTO r FROM suizamente_private.espejo_retos WHERE id=pid FOR UPDATE;
 IF r.estado<>'esperando' OR r.rival IS NULL THEN RETURN;END IF;
 SELECT * INTO a FROM suizamente_private.espejo_jugadas WHERE reto=pid AND persona=r.creador;
 SELECT * INTO b FROM suizamente_private.espejo_jugadas WHERE reto=pid AND persona=r.rival;
 IF NOT coalesce(a.terminado,false) OR NOT coalesce(b.terminado,false) THEN RETURN;END IF;
 IF (a.aciertos,-a.ms_total)>(b.aciertos,-b.ms_total) THEN winner:=r.creador;ELSIF (a.aciertos,-a.ms_total)<(b.aciertos,-b.ms_total) THEN winner:=r.rival;END IF;
 pa:=CASE WHEN winner=r.creador THEN r.reglas->'premioVictoria' WHEN winner IS NULL THEN jsonb_build_object('monedas',floor((r.reglas#>>'{premioVictoria,monedas}')::numeric/2),'xp',floor((r.reglas#>>'{premioVictoria,xp}')::numeric/2)) ELSE r.reglas->'premioJugar' END;
 pb:=CASE WHEN winner=r.rival THEN r.reglas->'premioVictoria' WHEN winner IS NULL THEN pa ELSE r.reglas->'premioJugar' END;
 PERFORM suizamente_private.v3_anotar(r.creador,'espejo',pid::text||':'||r.creador,coalesce((pa->>'monedas')::integer,0),coalesce((pa->>'xp')::integer,0));
 PERFORM suizamente_private.v3_anotar(r.rival,'espejo',pid::text||':'||r.rival,coalesce((pb->>'monedas')::integer,0),coalesce((pb->>'xp')::integer,0));
 UPDATE suizamente_private.espejo_retos SET estado='jugado',resultado=jsonb_build_object('ganador',winner,'empate',winner IS NULL,'premios',jsonb_build_object(r.creador,pa,r.rival,pb)) WHERE id=pid;
 PERFORM suizamente_private.mej_aviso(r.creador,'espejo_jugado',pid::text,(SELECT apodo FROM suizamente_private.suizamente_jugadores WHERE jugador_id=r.rival)||' ha jugado tu reto','/suizamente/espejo/'||pid);
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.mej_espejo_vista(pid uuid,actor text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r suizamente_private.espejo_retos;j suizamente_private.espejo_jugadas;other text;q jsonb;total integer;opponent jsonb;mine jsonb;
BEGIN
 SELECT * INTO r FROM suizamente_private.espejo_retos WHERE id=pid;
 IF actor<>r.creador AND actor IS DISTINCT FROM r.rival THEN RAISE EXCEPTION 'SZV2:403:Este reto no es tuyo';END IF;
 other:=CASE WHEN actor=r.creador THEN r.rival ELSE r.creador END;
 SELECT * INTO j FROM suizamente_private.espejo_jugadas WHERE reto=pid AND persona=actor;
 SELECT jsonb_build_object('aciertos',aciertos,'ms_total',ms_total,'terminado',terminado)||CASE WHEN r.estado='jugado' THEN jsonb_build_object('respuestas',(SELECT jsonb_agg(jsonb_build_object('acierto',v->'acierto')) FROM jsonb_array_elements(respuestas) v)) ELSE '{}' END
 INTO opponent FROM suizamente_private.espejo_jugadas WHERE reto=pid AND persona=other;
 total:=jsonb_array_length(r.preguntas);
 IF j.persona IS NOT NULL THEN
  mine:=jsonb_build_object('aciertos',j.aciertos,'ms_total',j.ms_total,'terminado',j.terminado,'respuestas',(SELECT coalesce(jsonb_agg(jsonb_build_object('acierto',v->'acierto')),'[]') FROM jsonb_array_elements(j.respuestas) v));
  IF j.terminado THEN mine:=mine||jsonb_build_object('datos',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',v->>'preguntaId','dato',v->>'dato','pregunta',(SELECT question_item->>'pregunta' FROM jsonb_array_elements(r.preguntas) question_item WHERE question_item->>'id'=v->>'preguntaId'))),'[]') FROM jsonb_array_elements(j.respuestas) v));END IF;
  IF NOT j.terminado AND r.estado='esperando' THEN q:=suizamente_private.mej_pregunta(r.preguntas->jsonb_array_length(j.respuestas),j.orden)||jsonb_build_object('n',jsonb_array_length(j.respuestas),'vence',j.pregunta_desde+make_interval(secs=>(r.reglas->>'segundosPorPregunta')::integer));END IF;
 END IF;
 RETURN jsonb_build_object('id',r.id,'estado',r.estado,'creador',suizamente_private.mej_persona(r.creador),'rival',CASE WHEN other IS NOT NULL THEN suizamente_private.mej_persona(other) ELSE NULL END,
 'caduca',r.caduca,'total',total,'tuJugada',mine,'suJugada',opponent,'pregunta',q,'servidorAhora',clock_timestamp(),'enlace','/suizamente/reto/'||r.codigo,
 'resultado',r.resultado,'premio',r.resultado#>ARRAY['premios',actor],'puedesJugar',r.estado='esperando' AND NOT coalesce(j.terminado,false));
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.mej_espejo(actor text,action text,args jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r suizamente_private.espejo_retos;j suizamente_private.espejo_jugadas;parent suizamente_private.espejo_retos;target text;questions jsonb;q jsonb;rules jsonb:=suizamente_private.mej_config()->'espejo';n integer;opt integer;ok boolean;elapsed integer;result jsonb;amount integer;pid uuid;
BEGIN
 PERFORM suizamente_private.mej_espejo_caducar();
 IF action='inicio' THEN
  RETURN jsonb_build_object('retos',(SELECT coalesce(jsonb_agg(suizamente_private.mej_espejo_vista(id,actor) ORDER BY creado DESC),'[]') FROM suizamente_private.espejo_retos WHERE actor IN(creador,rival) AND estado='esperando'));
 END IF;
 IF action IN('crear','revancha') THEN
  IF NOT coalesce(args->>'clave','') ~* '^[0-9a-f-]{36}$' THEN RAISE EXCEPTION 'SZV2:400:Solicitud no válida';END IF;
  SELECT * INTO r FROM suizamente_private.espejo_retos WHERE creador=actor AND clave=(args->>'clave')::uuid;
  IF FOUND THEN RETURN suizamente_private.mej_espejo_vista(r.id,actor);END IF;
  target:=args->>'amigo';
  IF action='revancha' THEN
   SELECT * INTO parent FROM suizamente_private.espejo_retos WHERE id=(args->>'id')::uuid AND actor IN(creador,rival) AND estado='jugado';
   IF NOT FOUND THEN RAISE EXCEPTION 'SZV2:403:No puedes pedir esta revancha';END IF;
   target:=CASE WHEN actor=parent.creador THEN parent.rival ELSE parent.creador END;
  END IF;
  IF target IS NOT NULL AND NOT suizamente_private.mej_amigos(actor,target) AND action<>'revancha' THEN RAISE EXCEPTION 'SZV2:403:Elige un amigo';END IF;
  IF target=actor THEN RAISE EXCEPTION 'SZV2:400:No puedes retarte a ti';END IF;
  IF (SELECT count(*) FROM suizamente_private.espejo_retos WHERE actor IN(creador,rival) AND estado='esperando')>=(rules->>'retosAbiertosMax')::integer
  OR target IS NOT NULL AND (SELECT count(*) FROM suizamente_private.espejo_retos WHERE target IN(creador,rival) AND estado='esperando')>=(rules->>'retosAbiertosMax')::integer THEN RAISE EXCEPTION 'SZV2:409:Se ha alcanzado el máximo de retos abiertos';END IF;
  WITH candidates AS(SELECT p.payload||jsonb_build_object('categoria',suizamente_private.mej_categoria(p.payload)) item,
  row_number() OVER(PARTITION BY suizamente_private.mej_categoria(p.payload) ORDER BY random()) position
  FROM suizamente_private.suizamente_preguntas p WHERE NOT oculta AND payload->>'tipo'='real' AND payload ? 'correcta'
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(parent.preguntas,'[]')) old WHERE old->>'id'=p.id)),
  chosen AS(SELECT item FROM candidates ORDER BY position,random() LIMIT (rules->>'preguntas')::integer)
  SELECT jsonb_agg(item) INTO questions FROM chosen;
  IF coalesce(jsonb_array_length(questions),0)<>(rules->>'preguntas')::integer THEN RAISE EXCEPTION 'SZV2:503:No hay preguntas disponibles para este reto';END IF;
  INSERT INTO suizamente_private.espejo_retos(creador,rival,preguntas,caduca,reglas,clave,revancha_de)
  VALUES(actor,target,questions,clock_timestamp()+make_interval(hours=>(rules->>'horasParaJugar')::integer),rules,(args->>'clave')::uuid,parent.id) RETURNING * INTO r;
  IF target IS NOT NULL THEN PERFORM suizamente_private.mej_aviso(target,'espejo_reto',r.id::text,(SELECT apodo FROM suizamente_private.suizamente_jugadores WHERE jugador_id=actor)||' te ha retado','/suizamente/espejo/'||r.id);END IF;
  RETURN suizamente_private.mej_espejo_vista(r.id,actor);
 END IF;
 IF action='aceptar' THEN SELECT * INTO r FROM suizamente_private.espejo_retos WHERE codigo=args->>'codigo' FOR UPDATE;
 ELSE SELECT * INTO r FROM suizamente_private.espejo_retos WHERE id=(args->>'id')::uuid AND actor IN(creador,rival) FOR UPDATE;END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'SZV2:404:Reto no encontrado';END IF;
 pid:=r.id;
 IF action='aceptar' THEN
  IF actor=r.creador THEN RETURN suizamente_private.mej_espejo_vista(pid,actor);END IF;
  IF r.estado<>'esperando' THEN RAISE EXCEPTION 'SZV2:409:El reto ha caducado o terminado';END IF;
  IF r.rival IS NOT NULL AND r.rival<>actor THEN RAISE EXCEPTION 'SZV2:409:Otra persona ya ha aceptado este reto';END IF;
  IF r.rival IS NULL THEN
   IF (SELECT count(*) FROM suizamente_private.espejo_retos WHERE actor IN(creador,rival) AND estado='esperando')>=(rules->>'retosAbiertosMax')::integer THEN RAISE EXCEPTION 'SZV2:409:Se ha alcanzado el máximo de retos abiertos';END IF;
   UPDATE suizamente_private.espejo_retos SET rival=actor WHERE id=pid;
  END IF;
  RETURN suizamente_private.mej_espejo_vista(pid,actor);
 END IF;
 IF r.estado<>'esperando' THEN RETURN suizamente_private.mej_espejo_vista(pid,actor);END IF;
 IF action='empezar' THEN
  INSERT INTO suizamente_private.espejo_jugadas(reto,persona,orden) VALUES(pid,actor,suizamente_private.v21_orden(r.preguntas->0)) ON CONFLICT DO NOTHING;
 ELSIF action='respuesta' THEN
  SELECT * INTO j FROM suizamente_private.espejo_jugadas WHERE reto=pid AND persona=actor FOR UPDATE;
  IF NOT FOUND OR j.terminado THEN RAISE EXCEPTION 'SZV2:409:Esta jugada no está disponible';END IF;
  n:=jsonb_array_length(j.respuestas);
  IF (args->>'n')::integer<n THEN RETURN suizamente_private.mej_espejo_vista(pid,actor);END IF;
  IF (args->>'n')::integer IS DISTINCT FROM n THEN RAISE EXCEPTION 'SZV2:409:La pregunta ha cambiado';END IF;
  q:=r.preguntas->n;elapsed:=greatest(0,least((r.reglas->>'segundosPorPregunta')::integer*1000,floor(extract(epoch FROM clock_timestamp()-j.pregunta_desde)*1000)::integer));
  IF args->>'opcion' IS NOT NULL AND (NOT (args->>'opcion') ~ '^[0-9]+$' OR (args->>'opcion')::integer>=cardinality(j.orden)) THEN RAISE EXCEPTION 'SZV2:400:Opción no válida';END IF;
  IF args->>'opcion' IS NULL AND clock_timestamp()<j.pregunta_desde+make_interval(secs=>(r.reglas->>'segundosPorPregunta')::integer) THEN RAISE EXCEPTION 'SZV2:409:Aún queda tiempo para responder';END IF;
  opt:=(args->>'opcion')::integer;ok:=opt IS NOT NULL AND elapsed<(r.reglas->>'segundosPorPregunta')::integer*1000 AND j.orden[opt+1]=(q->>'correcta')::integer;
  result:=jsonb_build_object('preguntaId',q->>'id','opcion',opt,'correcta',array_position(j.orden,(q->>'correcta')::smallint)-1,'acierto',ok,'dato',q->>'dato','ms',elapsed);
  UPDATE suizamente_private.espejo_jugadas SET respuestas=respuestas||jsonb_build_array(result),aciertos=aciertos+ok::integer,ms_total=ms_total+elapsed,
  terminado=n+1=jsonb_array_length(r.preguntas),pregunta_desde=clock_timestamp(),orden=CASE WHEN n+1<jsonb_array_length(r.preguntas) THEN suizamente_private.v21_orden(r.preguntas->(n+1)) END WHERE reto=pid AND persona=actor;
  PERFORM suizamente_private.v3_actividad(actor,clock_timestamp());PERFORM suizamente_private.mej_espejo_cerrar(pid);
  RETURN suizamente_private.mej_espejo_vista(pid,actor)||jsonb_build_object('respuesta',result);
 END IF;
 RETURN suizamente_private.mej_espejo_vista(pid,actor);
END $$;
DO $$ DECLARE f regprocedure;BEGIN FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='suizamente_private' AND p.proname LIKE 'mej_%' LOOP EXECUTE 'REVOKE ALL ON FUNCTION '||f||' FROM PUBLIC,anon,authenticated';END LOOP;END $$;
COMMIT;
