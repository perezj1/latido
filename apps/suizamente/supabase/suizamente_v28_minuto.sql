BEGIN;
CREATE TABLE IF NOT EXISTS suizamente_private.minuto_partidas(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),persona text NOT NULL REFERENCES suizamente_private.suizamente_jugadores(jugador_id) ON DELETE CASCADE,
 clave uuid NOT NULL,categoria text,inicio timestamptz NOT NULL DEFAULT clock_timestamp(),fin_previsto timestamptz NOT NULL,fin timestamptz,
 puntos integer NOT NULL DEFAULT 0,aciertos integer NOT NULL DEFAULT 0,fallos integer NOT NULL DEFAULT 0,racha integer NOT NULL DEFAULT 0,mejor_racha integer NOT NULL DEFAULT 0,
 estado text NOT NULL DEFAULT 'jugando' CHECK(estado IN('jugando','terminado')),reglas jsonb NOT NULL,premiada boolean NOT NULL,numero_dia integer NOT NULL,
 premio jsonb NOT NULL DEFAULT '{}',record_anterior integer NOT NULL DEFAULT 0,nuevo_record boolean NOT NULL DEFAULT false,UNIQUE(persona,clave)
);
CREATE TABLE IF NOT EXISTS suizamente_private.minuto_respuestas(
 partida uuid NOT NULL REFERENCES suizamente_private.minuto_partidas ON DELETE CASCADE,n integer NOT NULL,pregunta text NOT NULL,payload jsonb NOT NULL,orden smallint[] NOT NULL,
 enviada timestamptz NOT NULL DEFAULT clock_timestamp(),opcion smallint,acierto boolean,ms integer,respondida timestamptz,
 PRIMARY KEY(partida,n),UNIQUE(partida,pregunta)
);
CREATE INDEX IF NOT EXISTS minuto_persona_fecha ON suizamente_private.minuto_partidas(persona,inicio);
ALTER TABLE suizamente_private.minuto_partidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE suizamente_private.minuto_respuestas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON suizamente_private.minuto_partidas,suizamente_private.minuto_respuestas FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION suizamente_private.mej_minuto_siguiente(pid uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m suizamente_private.minuto_partidas;q jsonb;seq integer;
BEGIN
 SELECT * INTO m FROM suizamente_private.minuto_partidas WHERE id=pid;
 SELECT p.payload||jsonb_build_object('categoria',suizamente_private.mej_categoria(p.payload)) INTO q
 FROM suizamente_private.suizamente_preguntas p WHERE NOT p.oculta AND p.payload->>'tipo'='real' AND p.payload ? 'correcta'
 AND (m.categoria IS NULL OR suizamente_private.mej_categoria(p.payload)=m.categoria)
 AND NOT EXISTS(SELECT 1 FROM suizamente_private.minuto_respuestas r WHERE r.partida=pid AND r.pregunta=p.id)
 ORDER BY EXISTS(SELECT 1 FROM suizamente_private.minuto_respuestas r JOIN suizamente_private.minuto_partidas h ON h.id=r.partida WHERE h.persona=m.persona AND r.pregunta=p.id AND r.enviada>clock_timestamp()-make_interval(days=>(suizamente_private.v2_config()#>>'{partida,diasSinRepetirPregunta}')::integer)),
 EXISTS(SELECT 1 FROM suizamente_private.suizamente_partida_preguntas r WHERE r.jugador_id=m.persona AND r.pregunta_id=p.id AND r.enviada_en>clock_timestamp()-make_interval(days=>(suizamente_private.v2_config()#>>'{partida,diasSinRepetirPregunta}')::integer)),random() LIMIT 1;
 IF q IS NULL THEN RETURN false;END IF;
 SELECT coalesce(max(n),0)+1 INTO seq FROM suizamente_private.minuto_respuestas WHERE partida=pid;
 INSERT INTO suizamente_private.minuto_respuestas(partida,n,pregunta,payload,orden) VALUES(pid,seq,q->>'id',q,suizamente_private.v21_orden(q));RETURN true;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.mej_minuto_cerrar(pid uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m suizamente_private.minuto_partidas;coins integer:=0;xp integer:=0;best integer;f record;
BEGIN
 SELECT * INTO m FROM suizamente_private.minuto_partidas WHERE id=pid FOR UPDATE;
 IF m.estado='terminado' THEN RETURN;END IF;
 SELECT coalesce(max(puntos),0) INTO best FROM suizamente_private.minuto_partidas WHERE persona=m.persona AND estado='terminado';
 IF m.premiada THEN coins:=floor(m.puntos/(m.reglas->>'puntosPorMoneda')::numeric);xp:=floor(m.puntos*(m.reglas->>'xpPorPunto')::numeric);END IF;
 IF m.premiada THEN PERFORM suizamente_private.v3_anotar(m.persona,'minuto',m.id::text,coins,xp);END IF;
 UPDATE suizamente_private.minuto_partidas SET estado='terminado',fin=clock_timestamp(),premio=jsonb_build_object('monedas',coins,'xp',xp),record_anterior=best,nuevo_record=puntos>best WHERE id=pid;
 IF m.puntos>best AND EXISTS(SELECT 1 FROM suizamente_private.suizamente_jugadores WHERE jugador_id=m.persona AND en_ranking) THEN
  FOR f IN SELECT j.jugador_id FROM suizamente_private.suizamente_jugadores j WHERE j.en_ranking AND NOT j.excluido_ranking AND suizamente_private.mej_amigos(m.persona,j.jugador_id)
  AND (SELECT max(puntos) FROM suizamente_private.minuto_partidas WHERE persona=j.jugador_id AND estado='terminado')>best
  AND (SELECT max(puntos) FROM suizamente_private.minuto_partidas WHERE persona=j.jugador_id AND estado='terminado')<m.puntos LOOP
   PERFORM suizamente_private.mej_aviso(f.jugador_id,'minuto_record',pid::text,(SELECT apodo FROM suizamente_private.suizamente_jugadores WHERE jugador_id=m.persona)||' ha superado tu récord','/suizamente/minuto');
  END LOOP;
 END IF;
 PERFORM suizamente_private.v3_actividad(m.persona,clock_timestamp());
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.mej_minuto_vista(pid uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m suizamente_private.minuto_partidas;r suizamente_private.minuto_respuestas;
BEGIN
 SELECT * INTO m FROM suizamente_private.minuto_partidas WHERE id=pid;
 SELECT * INTO r FROM suizamente_private.minuto_respuestas WHERE partida=pid AND respondida IS NULL ORDER BY n LIMIT 1;
 RETURN (to_jsonb(m)-'clave'-'reglas'-'persona')||jsonb_build_object('servidorAhora',clock_timestamp(),'pregunta',CASE WHEN m.estado='jugando' AND r.n IS NOT NULL THEN suizamente_private.mej_pregunta(r.payload,r.orden)||jsonb_build_object('n',r.n) ELSE NULL END)
 ||CASE WHEN m.estado='terminado' THEN jsonb_build_object('datos',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',pregunta,'pregunta',payload->>'pregunta','dato',payload->>'dato') ORDER BY n),'[]') FROM suizamente_private.minuto_respuestas WHERE partida=pid AND respondida IS NOT NULL)) ELSE '{}'::jsonb END;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.mej_minuto_ranking(actor text,periodo text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE desde timestamp;hasta timestamp;hoy timestamp:=clock_timestamp() AT TIME ZONE 'Europe/Zurich';rows jsonb;
BEGIN
 desde:=date_trunc(CASE periodo WHEN 'semana' THEN 'week' WHEN 'mes' THEN 'month' ELSE 'day' END,hoy);
 hasta:=desde+CASE periodo WHEN 'semana' THEN interval '1 week' WHEN 'mes' THEN interval '1 month' ELSE interval '1 day' END;
 WITH best AS(SELECT DISTINCT ON(m.persona) m.persona,m.puntos,m.fin FROM suizamente_private.minuto_partidas m
 JOIN suizamente_private.suizamente_jugadores p ON p.jugador_id=m.persona
 WHERE m.estado='terminado' AND m.fin>=desde AT TIME ZONE 'Europe/Zurich' AND m.fin<hasta AT TIME ZONE 'Europe/Zurich'
 AND p.en_ranking AND NOT p.excluido_ranking AND NOT p.bloqueado AND NOT p.renombrar
 AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p.usuario_id AND banned)
 AND (m.persona=actor OR suizamente_private.mej_amigos(actor,m.persona)) ORDER BY m.persona,m.puntos DESC,m.fin,m.id),
 ranked AS(SELECT *,row_number() OVER(ORDER BY puntos DESC,fin,persona) puesto FROM best)
 SELECT coalesce(jsonb_agg(suizamente_private.mej_persona(persona)||jsonb_build_object('puntos',puntos,'puesto',puesto,'tuyo',persona=actor) ORDER BY puesto),'[]') INTO rows FROM ranked WHERE puesto<=(suizamente_private.v2_config()#>>'{ranking,top}')::integer;
 RETURN rows;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.mej_minuto(actor text,action text,args jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m suizamente_private.minuto_partidas;r suizamente_private.minuto_respuestas;pid uuid;opt integer;right_answer boolean;points integer;count_day integer;rules jsonb:=suizamente_private.mej_config()->'minuto';outcome jsonb;
BEGIN
 IF action='inicio' THEN
  RETURN jsonb_build_object('record',coalesce((SELECT max(puntos) FROM suizamente_private.minuto_partidas WHERE persona=actor AND estado='terminado'),0),'recordPartida',(SELECT id FROM suizamente_private.minuto_partidas WHERE persona=actor AND estado='terminado' ORDER BY puntos DESC,fin,id LIMIT 1),'clasificacion',suizamente_private.mej_minuto_ranking(actor,coalesce(args->>'periodo','hoy')));
 ELSIF action='empezar' THEN
  IF NOT coalesce(args->>'clave','') ~* '^[0-9a-f-]{36}$' THEN RAISE EXCEPTION 'SZV2:400:Solicitud no válida';END IF;
  SELECT * INTO m FROM suizamente_private.minuto_partidas WHERE persona=actor AND clave=(args->>'clave')::uuid;
  IF FOUND THEN RETURN suizamente_private.mej_minuto_vista(m.id);END IF;
  IF args->>'categoria' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(suizamente_private.v2_config()->'categorias') WHERE value->>'id'=args->>'categoria') THEN RAISE EXCEPTION 'SZV2:400:Categoría no válida';END IF;
  SELECT count(*)+1 INTO count_day FROM suizamente_private.minuto_partidas WHERE persona=actor AND (inicio AT TIME ZONE 'Europe/Zurich')::date=(clock_timestamp() AT TIME ZONE 'Europe/Zurich')::date;
  INSERT INTO suizamente_private.minuto_partidas(persona,clave,categoria,fin_previsto,reglas,premiada,numero_dia)
  VALUES(actor,(args->>'clave')::uuid,args->>'categoria',clock_timestamp()+make_interval(secs=>(rules->>'segundos')::integer),rules,count_day<=(rules->>'partidasConPremioAlDia')::integer,count_day) RETURNING * INTO m;
  IF NOT suizamente_private.mej_minuto_siguiente(m.id) THEN RAISE EXCEPTION 'SZV2:503:No hay preguntas disponibles';END IF;
  RETURN suizamente_private.mej_minuto_vista(m.id);
 END IF;
 SELECT * INTO m FROM suizamente_private.minuto_partidas WHERE minuto_partidas.id=(args->>'id')::uuid AND persona=actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SZV2:404:Partida no encontrada';END IF;
 pid:=m.id;
 IF action='retar' THEN
  IF m.estado<>'terminado' OR NOT suizamente_private.mej_amigos(actor,args->>'amigo') THEN RAISE EXCEPTION 'SZV2:403:Elige un amigo';END IF;
  PERFORM suizamente_private.mej_aviso(args->>'amigo','minuto_reto',pid::text||':'||(args->>'amigo'),(SELECT apodo FROM suizamente_private.suizamente_jugadores WHERE jugador_id=actor)||' ha hecho '||m.puntos||' en El minuto suizo. ¿Lo superas?','/suizamente/minuto');
  RETURN jsonb_build_object('enviado',true);
 END IF;
 IF m.estado='terminado' THEN RETURN suizamente_private.mej_minuto_vista(pid);END IF;
 IF clock_timestamp()>m.fin_previsto+make_interval(secs=>(suizamente_private.v2_config()#>>'{partida,margenServidorSegundos}')::integer) OR action='terminar' THEN
  IF action='terminar' AND clock_timestamp()<m.fin_previsto AND NOT coalesce((args->>'abandonar')::boolean,false) THEN RETURN suizamente_private.mej_minuto_vista(pid);END IF;
  PERFORM suizamente_private.mej_minuto_cerrar(pid);RETURN suizamente_private.mej_minuto_vista(pid);
 END IF;
 IF action='respuesta' THEN
  SELECT * INTO r FROM suizamente_private.minuto_respuestas WHERE partida=pid AND n=(args->>'n')::integer FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SZV2:409:La pregunta ha cambiado';END IF;
  IF r.respondida IS NOT NULL THEN RETURN suizamente_private.mej_minuto_vista(pid);END IF;
  IF NOT coalesce(args->>'opcion','') ~ '^[0-9]+$' OR (args->>'opcion')::integer>=cardinality(r.orden) THEN RAISE EXCEPTION 'SZV2:400:Opción no válida';END IF;
  opt:=(args->>'opcion')::integer;right_answer:=r.orden[opt+1]=(r.payload->>'correcta')::integer;
  points:=CASE WHEN right_answer THEN (m.reglas->>'puntosAcierto')::integer+CASE WHEN m.racha+1>=(m.reglas->>'rachaDesde')::integer THEN (m.reglas->>'puntosRacha')::integer ELSE 0 END ELSE 0 END;
  UPDATE suizamente_private.minuto_respuestas SET opcion=opt,acierto=right_answer,ms=greatest(0,floor(extract(epoch FROM clock_timestamp()-r.enviada)*1000))::integer,respondida=clock_timestamp() WHERE partida=pid AND n=r.n;
  UPDATE suizamente_private.minuto_partidas SET puntos=puntos+points,aciertos=aciertos+right_answer::integer,fallos=fallos+(NOT right_answer)::integer,racha=CASE WHEN right_answer THEN racha+1 ELSE 0 END,
  mejor_racha=greatest(mejor_racha,CASE WHEN right_answer THEN racha+1 ELSE 0 END),fin_previsto=fin_previsto-CASE WHEN right_answer THEN interval '0 seconds' ELSE make_interval(secs=>(m.reglas->>'segundosFallo')::integer) END WHERE minuto_partidas.id=pid RETURNING * INTO m;
  outcome:=jsonb_build_object('acierto',right_answer,'puntos',points,'correcta',array_position(r.orden,(r.payload->>'correcta')::smallint)-1,'opcion',opt,'dato',r.payload->>'dato','preguntaId',r.pregunta);
  IF clock_timestamp()>=m.fin_previsto OR NOT suizamente_private.mej_minuto_siguiente(pid) THEN PERFORM suizamente_private.mej_minuto_cerrar(pid);END IF;
  RETURN suizamente_private.mej_minuto_vista(pid)||jsonb_build_object('resultado',outcome);
 END IF;
 RETURN suizamente_private.mej_minuto_vista(pid);
END $$;
DO $$ DECLARE f regprocedure;BEGIN FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='suizamente_private' AND p.proname LIKE 'mej_%' LOOP EXECUTE 'REVOKE ALL ON FUNCTION '||f||' FROM PUBLIC,anon,authenticated';END LOOP;END $$;
COMMIT;
