-- Phase 4. Apply after v3_economia. All decisions and inventory changes are transactional.
BEGIN;
ALTER TABLE suizamente_private.suizamente_movimientos ADD COLUMN IF NOT EXISTS detalle jsonb NOT NULL DEFAULT '{}';
ALTER TABLE suizamente_private.suizamente_partidas ADD COLUMN IF NOT EXISTS duelo_id uuid;
ALTER TABLE suizamente_private.suizamente_partida_preguntas
  ADD COLUMN IF NOT EXISTS comodines text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS quitadas smallint[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS intentos smallint[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS segunda_usada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tiempo_extra integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duelo_id uuid,
  ADD COLUMN IF NOT EXISTS duelo_indice integer,
  ADD COLUMN IF NOT EXISTS duelo_ronda integer NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_duelos_sello(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),partida_id uuid NOT NULL REFERENCES suizamente_private.suizamente_partidas(id) ON DELETE CASCADE,
  retador text NOT NULL,defensor text NOT NULL,quitar text NOT NULL,apostar text NOT NULL,
  preguntas jsonb NOT NULL,estado text NOT NULL DEFAULT 'retador',desempate jsonb,ronda_desempate integer NOT NULL DEFAULT 0,
  ganador text,sello text,visto_a boolean NOT NULL DEFAULT false,visto_b boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),terminado_en timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS suizamente_duelo_activo ON suizamente_private.suizamente_duelos_sello(partida_id) WHERE estado<>'terminado';
CREATE OR REPLACE FUNCTION suizamente_private.v4_cancelar() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  UPDATE suizamente_private.suizamente_duelos_sello SET estado='cancelado',terminado_en=clock_timestamp()
    WHERE partida_id=NEW.id AND estado NOT IN ('terminado','cancelado');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS suizamente_cancelar_duelo ON suizamente_private.suizamente_partidas;
CREATE TRIGGER suizamente_cancelar_duelo AFTER UPDATE OF estado ON suizamente_private.suizamente_partidas
  FOR EACH ROW WHEN(NEW.estado NOT IN ('jugando','buscando')) EXECUTE FUNCTION suizamente_private.v4_cancelar();

CREATE OR REPLACE FUNCTION suizamente_private.v4_elegir(actor text,category text,excluded text[] DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; c jsonb:=suizamente_private.v2_config();
BEGIN
  SELECT p.payload INTO result FROM suizamente_private.suizamente_preguntas p WHERE NOT p.oculta AND p.payload->>'tipo'='real'
    AND NOT p.id=ANY(excluded) AND EXISTS(SELECT 1 FROM jsonb_array_elements(c->'categorias') a WHERE a->>'id'=category AND a->'temas' ? (p.payload->>'tema'))
    ORDER BY coalesce((SELECT max(enviada_en) FROM suizamente_private.suizamente_partida_preguntas WHERE jugador_id=actor AND pregunta_id=p.id),'-infinity'::timestamptz)
      >clock_timestamp()-make_interval(days=>(c#>>'{partida,diasSinRepetirPregunta}')::integer),
      (SELECT max(enviada_en) FROM suizamente_private.suizamente_partida_preguntas WHERE jugador_id=actor AND pregunta_id=p.id) ASC NULLS FIRST,random() LIMIT 1;
  IF result IS NULL THEN RAISE EXCEPTION 'SZV2:503:No hay preguntas disponibles'; END IF;
  RETURN result;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v4_preguntar(mid uuid,actor text,category text,mode text,item jsonb DEFAULT NULL,did uuid DEFAULT NULL,idx integer DEFAULT NULL,round_no integer DEFAULT 0) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m suizamente_private.suizamente_partidas; nnext integer; moment timestamptz:=clock_timestamp(); payload jsonb:=item;
BEGIN
  SELECT * INTO m FROM suizamente_private.suizamente_partidas WHERE id=mid FOR UPDATE;
  IF m.turno IS DISTINCT FROM actor OR m.estado NOT IN ('jugando','buscando') OR EXISTS(
    SELECT 1 FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=mid AND respondida_en IS NULL) THEN RAISE EXCEPTION 'SZV2:409:No puedes pedir otra pregunta ahora'; END IF;
  IF payload IS NULL THEN payload:=suizamente_private.v4_elegir(actor,category); END IF;
  SELECT coalesce(max(n),0)+1 INTO nnext FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=mid;
  INSERT INTO suizamente_private.suizamente_partida_preguntas(partida_id,jugador_id,n,modo,categoria,pregunta_id,payload,orden,enviada_en,vence_en,duelo_id,duelo_indice,duelo_ronda)
    VALUES(mid,actor,nnext,mode,category,payload->>'id',payload,
      (SELECT array_agg(i::smallint ORDER BY random()) FROM generate_series(0,jsonb_array_length(payload->'opciones')-1) i),
      moment,moment+make_interval(secs=>(m.reglas#>>'{partida,segundosPorPregunta}')::integer),did,idx,round_no);
  UPDATE suizamente_private.suizamente_partidas SET fase='pregunta',casilla=NULL,turno_n=turno_n+1 WHERE id=mid;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v4_siguiente_turno(mid uuid,who text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m suizamente_private.suizamente_partidas;
BEGIN
  UPDATE suizamente_private.suizamente_partidas SET turno=who,fase='duelo',turno_n=turno_n+1,
    plazo=clock_timestamp()+make_interval(hours=>(reglas#>>'{partida,horasPorTurno}')::integer) WHERE id=mid RETURNING * INTO m;
  PERFORM suizamente_private.v2_avisar(m);
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v4_desempate(did uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d suizamente_private.suizamente_duelos_sello; m suizamente_private.suizamente_partidas; cat text; item jsonb; used text[];
BEGIN
  SELECT * INTO d FROM suizamente_private.suizamente_duelos_sello WHERE id=did FOR UPDATE;
  SELECT * INTO m FROM suizamente_private.suizamente_partidas WHERE id=d.partida_id FOR UPDATE;
  SELECT value#>>'{}' INTO cat FROM jsonb_array_elements(m.reglas#>'{duelo,orden}') ORDER BY random() LIMIT 1;
  SELECT array_agg(pregunta_id) INTO used FROM suizamente_private.suizamente_partida_preguntas WHERE duelo_id=did;
  item:=suizamente_private.v4_elegir(d.retador,cat,coalesce(used,'{}'));
  UPDATE suizamente_private.suizamente_duelos_sello SET estado='desempate_a',ronda_desempate=ronda_desempate+1,
    desempate=jsonb_build_object('categoria',cat,'payload',item) WHERE id=did;
  PERFORM suizamente_private.v4_siguiente_turno(d.partida_id,d.retador);
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v4_final_duelo(did uuid,winner text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d suizamente_private.suizamente_duelos_sello; m suizamente_private.suizamente_partidas;
  loser text; stamp text; loser_stamps text[]; winner_stamps text[]; final_winner text;
BEGIN
  SELECT * INTO d FROM suizamente_private.suizamente_duelos_sello WHERE id=did FOR UPDATE;
  IF d.estado IN ('terminado','cancelado') THEN RETURN; END IF;
  IF winner NOT IN(d.retador,d.defensor) THEN RAISE EXCEPTION 'SZV2:400:Resultado de duelo no válido'; END IF;
  SELECT * INTO m FROM suizamente_private.suizamente_partidas WHERE id=d.partida_id FOR UPDATE;
  loser:=CASE WHEN winner=d.retador THEN d.defensor ELSE d.retador END;
  stamp:=CASE WHEN winner=d.retador THEN d.quitar ELSE d.apostar END;
  winner_stamps:=CASE WHEN winner=m.jugador_a THEN m.sellos_a ELSE m.sellos_b END;
  loser_stamps:=CASE WHEN loser=m.jugador_a THEN m.sellos_a ELSE m.sellos_b END;
  IF stamp=ANY(winner_stamps) OR NOT stamp=ANY(loser_stamps) THEN RAISE EXCEPTION 'SZV2:409:Los sellos del duelo ya han cambiado'; END IF;
  PERFORM suizamente_private.v3_anotar(winner,'duelo_sello',did::text,(m.reglas#>>'{recompensas,selloEnDuelo,monedas}')::integer);
  PERFORM suizamente_private.v3_anotar(loser,'duelo_sello_perdido',did::text);
  UPDATE suizamente_private.suizamente_movimientos SET detalle=jsonb_build_object('sello',stamp,'rival',loser) WHERE jugador_id=winner AND motivo='duelo_sello' AND ref=did::text;
  UPDATE suizamente_private.suizamente_movimientos SET detalle=jsonb_build_object('sello',stamp,'rival',winner) WHERE jugador_id=loser AND motivo='duelo_sello_perdido' AND ref=did::text;
  IF winner=m.jugador_a THEN m.sellos_a:=array_append(m.sellos_a,stamp);m.sellos_b:=array_remove(m.sellos_b,stamp);
  ELSE m.sellos_b:=array_append(m.sellos_b,stamp);m.sellos_a:=array_remove(m.sellos_a,stamp); END IF;
  UPDATE suizamente_private.suizamente_duelos_sello SET estado='terminado',ganador=winner,sello=stamp,terminado_en=clock_timestamp() WHERE id=did;
  UPDATE suizamente_private.suizamente_partidas SET sellos_a=m.sellos_a,sellos_b=m.sellos_b,barra_a=0,barra_b=0,turno=d.defensor,
    turnos_jugados=turnos_jugados+2,ronda=(turnos_jugados+2)/2+1,fase='girar',turno_n=turno_n+1,
    plazo=clock_timestamp()+make_interval(hours=>(reglas#>>'{partida,horasPorTurno}')::integer) WHERE id=m.id RETURNING * INTO m;
  IF cardinality(winner_stamps)+1>=(m.reglas#>>'{partida,sellosParaGanar}')::integer THEN
    PERFORM suizamente_private.v2_cerrar(m.id,winner,'sellos');
  ELSIF m.ronda>(m.reglas#>>'{partida,rondasMax}')::integer THEN
    final_winner:=CASE WHEN cardinality(m.sellos_a)>cardinality(m.sellos_b) THEN m.jugador_a WHEN cardinality(m.sellos_b)>cardinality(m.sellos_a) THEN m.jugador_b
      WHEN m.aciertos_a>m.aciertos_b THEN m.jugador_a WHEN m.aciertos_b>m.aciertos_a THEN m.jugador_b WHEN m.tiempo_a<m.tiempo_b THEN m.jugador_a WHEN m.tiempo_b<m.tiempo_a THEN m.jugador_b ELSE NULL END;
    PERFORM suizamente_private.v2_cerrar(m.id,final_winner,'rondas');
  ELSE PERFORM suizamente_private.v2_avisar(m); END IF;
  PERFORM suizamente_private.v3_logros(d.retador);PERFORM suizamente_private.v3_logros(d.defensor);
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v4_responder(mid uuid,actor text,nq integer,choice integer,automatic boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q suizamente_private.suizamente_partida_preguntas; m suizamente_private.suizamente_partidas; d suizamente_private.suizamente_duelos_sello;
  a suizamente_private.suizamente_partida_preguntas; b suizamente_private.suizamente_partida_preguntas;
  expired boolean; ok boolean; t timestamptz:=clock_timestamp(); answered integer; score_a integer; score_b integer; duration numeric; winner text;
BEGIN
  SELECT * INTO m FROM suizamente_private.suizamente_partidas WHERE id=mid FOR UPDATE;
  SELECT * INTO q FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=mid AND n=nq FOR UPDATE;
  expired:=t>q.vence_en+make_interval(secs=>(m.reglas#>>'{partida,margenServidorSegundos}')::integer);
  IF NOT expired AND automatic THEN RAISE EXCEPTION 'SZV2:409:El tiempo sigue corriendo'; END IF;
  IF NOT expired AND (choice IS NULL OR choice<0 OR choice>=jsonb_array_length(q.payload->'opciones')) THEN RAISE EXCEPTION 'SZV2:400:Elige una opción válida'; END IF;
  IF NOT expired AND (choice=ANY(q.quitadas) OR choice=ANY(q.intentos)) THEN RAISE EXCEPTION 'SZV2:409:Esa opción ya no está disponible'; END IF;
  ok:=NOT expired AND choice=(q.payload->>'correcta')::integer;
  IF NOT expired THEN
    INSERT INTO suizamente_private.suizamente_votos(pregunta_id,jugador_id,opcion) VALUES(q.pregunta_id,actor,choice) ON CONFLICT DO NOTHING;
    PERFORM suizamente_private.v3_actividad(actor,t);
    UPDATE suizamente_private.suizamente_partida_preguntas SET intentos=array_append(intentos,choice::smallint) WHERE partida_id=mid AND n=nq;
    IF NOT ok AND 'otra'=ANY(q.comodines) AND NOT q.segunda_usada THEN
      UPDATE suizamente_private.suizamente_partida_preguntas SET segunda_usada=true WHERE partida_id=mid AND n=nq;
      UPDATE suizamente_private.suizamente_partidas SET turno_n=turno_n+1 WHERE id=mid;
      RETURN true;
    END IF;
  END IF;
  IF q.modo NOT IN ('duelo','desempate') THEN RETURN false; END IF;
  SELECT * INTO d FROM suizamente_private.suizamente_duelos_sello WHERE id=q.duelo_id FOR UPDATE;
  IF d.estado='terminado' THEN RAISE EXCEPTION 'SZV2:409:El duelo ya ha terminado'; END IF;
  UPDATE suizamente_private.suizamente_partida_preguntas SET opcion=CASE WHEN expired THEN NULL ELSE choice END,acierto=ok,
    respondida_en=t,agotada=expired WHERE partida_id=mid AND n=nq;
  duration:=least(greatest(0,extract(epoch FROM t-q.enviada_en)),(m.reglas#>>'{partida,segundosPorPregunta}')::integer+q.tiempo_extra+(m.reglas#>>'{partida,margenServidorSegundos}')::integer);
  UPDATE suizamente_private.suizamente_partidas SET aciertos_a=aciertos_a+CASE WHEN actor=jugador_a AND ok THEN 1 ELSE 0 END,
    aciertos_b=aciertos_b+CASE WHEN actor=jugador_b AND ok THEN 1 ELSE 0 END,
    tiempo_a=tiempo_a+CASE WHEN actor=jugador_a THEN duration ELSE 0 END,tiempo_b=tiempo_b+CASE WHEN actor=jugador_b THEN duration ELSE 0 END,
    fase='duelo',turno_n=turno_n+1 WHERE id=mid;
  PERFORM suizamente_private.v3_respuesta(mid,nq);
  IF q.modo='duelo' THEN
    SELECT count(*) INTO answered FROM suizamente_private.suizamente_partida_preguntas WHERE duelo_id=d.id AND jugador_id=actor AND modo='duelo' AND respondida_en IS NOT NULL;
    IF answered>=(m.reglas#>>'{duelo,preguntas}')::integer THEN
      IF actor=d.retador THEN
        UPDATE suizamente_private.suizamente_duelos_sello SET estado='rival' WHERE id=d.id;
        PERFORM suizamente_private.v4_siguiente_turno(mid,d.defensor);
      ELSE
        SELECT count(*) FILTER(WHERE jugador_id=d.retador AND acierto),count(*) FILTER(WHERE jugador_id=d.defensor AND acierto)
          INTO score_a,score_b FROM suizamente_private.suizamente_partida_preguntas WHERE duelo_id=d.id AND modo='duelo';
        IF score_a=score_b THEN PERFORM suizamente_private.v4_desempate(d.id);
        ELSE PERFORM suizamente_private.v4_final_duelo(d.id,CASE WHEN score_a>score_b THEN d.retador ELSE d.defensor END); END IF;
      END IF;
    END IF;
  ELSIF actor=d.retador THEN
    UPDATE suizamente_private.suizamente_duelos_sello SET estado='desempate_b' WHERE id=d.id;
    PERFORM suizamente_private.v4_siguiente_turno(mid,d.defensor);
  ELSE
    SELECT * INTO a FROM suizamente_private.suizamente_partida_preguntas WHERE duelo_id=d.id AND jugador_id=d.retador AND modo='desempate' AND duelo_ronda=d.ronda_desempate;
    SELECT * INTO b FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=mid AND n=nq;
    IF a.acierto<>b.acierto THEN winner:=CASE WHEN a.acierto THEN d.retador ELSE d.defensor END;
    ELSIF a.respondida_en-a.enviada_en<b.respondida_en-b.enviada_en THEN winner:=d.retador;
    ELSIF b.respondida_en-b.enviada_en<a.respondida_en-a.enviada_en THEN winner:=d.defensor; END IF;
    IF winner IS NULL THEN PERFORM suizamente_private.v4_desempate(d.id);
    ELSE PERFORM suizamente_private.v4_final_duelo(d.id,winner); END IF;
  END IF;
  UPDATE suizamente_private.suizamente_partida_preguntas SET version_respuesta=(SELECT turno_n FROM suizamente_private.suizamente_partidas WHERE id=mid) WHERE partida_id=mid AND n=nq;
  PERFORM suizamente_private.v3_logros(actor);
  RETURN true;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v4_accion(action text,actor text,body jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c jsonb:=suizamente_private.v2_config(); m suizamente_private.suizamente_partidas; q suizamente_private.suizamente_partida_preguntas;
  d suizamente_private.suizamente_duelos_sello; cm jsonb; item jsonb; list jsonb:='[]'; payload jsonb;
  article text; key text; cost integer; reference text; day text; rival text; removed integer; seq integer; cat text; mode text;
BEGIN
  IF action='tienda' THEN
    day:=(clock_timestamp() AT TIME ZONE (c->>'zonaHoraria'))::date::text;
    RETURN jsonb_build_object('regaloDisponible',NOT EXISTS(SELECT 1 FROM suizamente_private.suizamente_movimientos WHERE jugador_id=actor AND motivo='regalo_diario' AND ref=day),
      'comodines',c->'comodines','precios',c->'tienda','maxEscudos',c#>'{escudos,max}','regalo',c#>'{recompensas,regaloDiario}');
  ELSIF action='comprar' THEN
    article:=body->>'articulo';reference:=body->>'clave';
    IF coalesce(reference,'')!~'^[0-9a-f-]{36}$' THEN RAISE EXCEPTION 'SZV2:400:Compra no válida'; END IF;
    IF EXISTS(SELECT 1 FROM suizamente_private.suizamente_movimientos WHERE jugador_id=actor AND motivo='compra' AND ref=reference) THEN RAISE EXCEPTION 'SZV2:409:Esta compra ya está hecha'; END IF;
    SELECT value INTO cm FROM jsonb_array_elements(c->'comodines') WHERE value->>'id'=article;
    key:=CASE WHEN article='escudo' THEN 'escudos' WHEN article='sobre' THEN 'sobres' ELSE article END;
    cost:=CASE WHEN cm IS NOT NULL THEN (cm->>'precio')::integer ELSE (c->'tienda'->>article)::integer END;
    IF cost IS NULL THEN RAISE EXCEPTION 'SZV2:400:Artículo no válido'; END IF;
    PERFORM suizamente_private.v3_sincronizar(actor);
    IF article='escudo' AND coalesce((SELECT cantidad FROM suizamente_private.suizamente_inventario WHERE jugador_id=actor AND articulo='escudos'),0)>=(c#>>'{escudos,max}')::integer THEN RAISE EXCEPTION 'SZV2:409:Ya tienes el máximo de escudos'; END IF;
    PERFORM suizamente_private.v3_anotar(actor,'compra',reference,-cost,0,jsonb_build_object(key,1));
    RETURN jsonb_build_object('comprado',article);
  ELSIF action='regalo' THEN
    day:=(clock_timestamp() AT TIME ZONE (c->>'zonaHoraria'))::date::text;
    IF EXISTS(SELECT 1 FROM suizamente_private.suizamente_movimientos WHERE jugador_id=actor AND motivo='regalo_diario' AND ref=day) THEN RAISE EXCEPTION 'SZV2:409:Vuelve mañana a por otro'; END IF;
    SELECT value INTO cm FROM jsonb_array_elements(c->'comodines') ORDER BY random() LIMIT 1;
    PERFORM suizamente_private.v3_anotar(actor,'regalo_diario',day,(c#>>'{recompensas,regaloDiario,monedas}')::integer,0,
      jsonb_build_object(cm->>'id',(c#>>'{recompensas,regaloDiario,comodinesAlAzar}')::integer));
    RETURN jsonb_build_object('regaloAbierto',true,'comodin',cm->>'id');
  END IF;
  IF action NOT IN ('comodin','duelo','pregunta') THEN RETURN NULL; END IF;
  SELECT * INTO m FROM suizamente_private.suizamente_partidas WHERE id=(body->>'id')::uuid FOR UPDATE;
  IF m.id IS NULL OR (actor<>m.jugador_a AND actor IS DISTINCT FROM m.jugador_b) THEN RAISE EXCEPTION 'SZV2:404:Partida no encontrada'; END IF;
  IF action='pregunta' AND (m.duelo_id IS NULL OR m.fase<>'duelo') THEN RETURN NULL; END IF;
  IF (body->>'turnoN')::integer IS DISTINCT FROM m.turno_n THEN RAISE EXCEPTION 'SZV2:409:La partida ha cambiado. Actualízala'; END IF;
  IF action='duelo' AND body->>'operacion'='continuar' THEN
    SELECT * INTO d FROM suizamente_private.suizamente_duelos_sello WHERE id=m.duelo_id FOR UPDATE;
    IF d.estado IS DISTINCT FROM 'terminado' OR (actor=d.retador AND d.visto_a) OR (actor=d.defensor AND d.visto_b) THEN RAISE EXCEPTION 'SZV2:409:El resultado ya está visto'; END IF;
    UPDATE suizamente_private.suizamente_duelos_sello SET visto_a=visto_a OR actor=retador,visto_b=visto_b OR actor=defensor WHERE id=d.id;
    RETURN suizamente_private.v2_ver(m.id,actor);
  END IF;
  IF m.estado NOT IN ('jugando','buscando') OR m.turno IS DISTINCT FROM actor THEN RAISE EXCEPTION 'SZV2:409:Ahora no es tu turno'; END IF;
  IF m.jugador_b IS NOT NULL AND m.plazo<clock_timestamp() THEN
    PERFORM suizamente_private.v2_actualizar(m.id);
    RETURN jsonb_build_object('conflicto',true,'partida',suizamente_private.v2_ver(m.id,actor));
  END IF;
  IF action='comodin' THEN
    SELECT * INTO q FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=m.id AND n=(body->>'n')::integer FOR UPDATE;
    SELECT value INTO cm FROM jsonb_array_elements(m.reglas->'comodines') WHERE value->>'id'=body->>'tipo';
    IF q.partida_id IS NULL OR q.jugador_id<>actor OR q.respondida_en IS NOT NULL OR m.fase<>'pregunta' OR clock_timestamp()>=q.vence_en
      OR cm IS NULL OR (cm->>'id')=ANY(q.comodines) OR cm->'noEnModos' ? q.modo
      OR (coalesce((cm->>'soloConTresOpciones')::boolean,false) AND jsonb_array_length(q.payload->'opciones')<>3) THEN RAISE EXCEPTION 'SZV2:409:No puedes usar ese comodín ahora'; END IF;
    article:=cm->>'id';
    PERFORM suizamente_private.v3_anotar(actor,'comodin',m.id::text||':'||q.n||':'||article,0,0,jsonb_build_object(article,-1));
    UPDATE suizamente_private.suizamente_partida_preguntas SET comodines=array_append(comodines,article) WHERE partida_id=m.id AND n=q.n;
    IF article='quita' THEN
      SELECT i INTO removed FROM generate_series(0,jsonb_array_length(q.payload->'opciones')-1) i
        WHERE i<>(q.payload->>'correcta')::integer AND NOT i=ANY(q.quitadas) AND NOT i=ANY(q.intentos) ORDER BY random() LIMIT 1;
      IF removed IS NULL THEN RAISE EXCEPTION 'SZV2:409:No queda ninguna opción que quitar'; END IF;
      UPDATE suizamente_private.suizamente_partida_preguntas SET quitadas=array_append(quitadas,removed::smallint) WHERE partida_id=m.id AND n=q.n;
    ELSIF article='tiempo' THEN
      UPDATE suizamente_private.suizamente_partida_preguntas SET vence_en=vence_en+make_interval(secs=>(cm->>'segundosExtra')::integer),
        tiempo_extra=tiempo_extra+(cm->>'segundosExtra')::integer WHERE partida_id=m.id AND n=q.n;
    ELSIF article='salta' THEN
      UPDATE suizamente_private.suizamente_partida_preguntas SET omitida=true,respondida_en=clock_timestamp() WHERE partida_id=m.id AND n=q.n;
      item:=suizamente_private.v4_elegir(actor,q.categoria,ARRAY[q.pregunta_id]);
      PERFORM suizamente_private.v4_preguntar(m.id,actor,q.categoria,'normal',item);
      RETURN suizamente_private.v2_ver(m.id,actor);
    END IF;
    UPDATE suizamente_private.suizamente_partidas SET turno_n=turno_n+1 WHERE id=m.id;
  ELSIF action='duelo' THEN
    rival:=CASE WHEN actor=m.jugador_a THEN m.jugador_b ELSE m.jugador_a END;
    IF rival IS NULL OR m.fase<>'sello' OR body->>'quitar' IS NULL OR body->>'apostar' IS NULL
      OR NOT (body->>'quitar')=ANY(CASE WHEN actor=m.jugador_a THEN m.sellos_b ELSE m.sellos_a END)
      OR (body->>'quitar')=ANY(CASE WHEN actor=m.jugador_a THEN m.sellos_a ELSE m.sellos_b END)
      OR NOT (body->>'apostar')=ANY(CASE WHEN actor=m.jugador_a THEN m.sellos_a ELSE m.sellos_b END)
      OR (body->>'apostar')=ANY(CASE WHEN actor=m.jugador_a THEN m.sellos_b ELSE m.sellos_a END) THEN RAISE EXCEPTION 'SZV2:409:No se pueden cambiar esos sellos'; END IF;
    FOR cat IN SELECT value#>>'{}' FROM jsonb_array_elements(m.reglas#>'{duelo,orden}') LOOP
      item:=suizamente_private.v4_elegir(actor,cat);
      list:=list||jsonb_build_array(jsonb_build_object('categoria',cat,'payload',item));
    END LOOP;
    INSERT INTO suizamente_private.suizamente_duelos_sello(partida_id,retador,defensor,quitar,apostar,preguntas)
      VALUES(m.id,actor,rival,body->>'quitar',body->>'apostar',list) RETURNING * INTO d;
    UPDATE suizamente_private.suizamente_partidas SET duelo_id=d.id,barra_a=0,barra_b=0 WHERE id=m.id;
    PERFORM suizamente_private.v4_preguntar(m.id,actor,list->0->>'categoria','duelo',list->0->'payload',d.id,0);
  ELSE
    SELECT * INTO d FROM suizamente_private.suizamente_duelos_sello WHERE id=m.duelo_id FOR UPDATE;
    IF d.estado='terminado' THEN RAISE EXCEPTION 'SZV2:409:El duelo ya terminó'; END IF;
    IF d.estado IN ('desempate_a','desempate_b') THEN
      payload:=d.desempate;mode:='desempate';seq:=0;
    ELSE
      SELECT count(*) INTO seq FROM suizamente_private.suizamente_partida_preguntas WHERE duelo_id=d.id AND jugador_id=actor AND modo='duelo' AND respondida_en IS NOT NULL;
      payload:=d.preguntas->seq;mode:='duelo';
    END IF;
    IF payload IS NULL THEN RAISE EXCEPTION 'SZV2:409:Espera a tu rival'; END IF;
    PERFORM suizamente_private.v4_preguntar(m.id,actor,payload->>'categoria',mode,payload->'payload',d.id,seq,d.ronda_desempate);
  END IF;
  RETURN suizamente_private.v2_ver(m.id,actor);
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v4_enriquecer(data jsonb,actor text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m suizamente_private.suizamente_partidas; q suizamente_private.suizamente_partida_preguntas; d suizamente_private.suizamente_duelos_sello;
  view jsonb:=data; own jsonb; other jsonb; own_stamp text[]; other_stamp text[];
BEGIN
  IF jsonb_typeof(data)<>'object' OR data->>'tuId' IS NULL THEN RETURN data; END IF;
  SELECT * INTO m FROM suizamente_private.suizamente_partidas WHERE id=(data->>'id')::uuid;
  own_stamp:=CASE WHEN actor=m.jugador_a THEN m.sellos_a ELSE m.sellos_b END;
  other_stamp:=CASE WHEN actor=m.jugador_a THEN m.sellos_b ELSE m.sellos_a END;
  view:=view||jsonb_build_object('dueloDisponible',m.jugador_b IS NOT NULL AND EXISTS(SELECT 1 FROM unnest(own_stamp) s WHERE NOT s=ANY(other_stamp)) AND EXISTS(SELECT 1 FROM unnest(other_stamp) s WHERE NOT s=ANY(own_stamp)));
  IF data->'pregunta'<>'null'::jsonb THEN
    SELECT * INTO q FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=m.id AND n=(data#>>'{pregunta,n}')::integer AND jugador_id=actor;
    view:=jsonb_set(view,'{pregunta}',data->'pregunta'||jsonb_build_object('usados',q.comodines,'quitadas',q.quitadas,'falladas',q.intentos,
      'otraActiva','otra'=ANY(q.comodines) AND NOT q.segunda_usada,'otraUsada',q.segunda_usada,'tiempo',(m.reglas#>>'{partida,segundosPorPregunta}')::integer+q.tiempo_extra));
  END IF;
  IF m.duelo_id IS NOT NULL THEN
    SELECT * INTO d FROM suizamente_private.suizamente_duelos_sello WHERE id=m.duelo_id;
    SELECT coalesce(jsonb_agg(acierto ORDER BY duelo_indice),'[]') INTO own FROM suizamente_private.suizamente_partida_preguntas WHERE duelo_id=d.id AND jugador_id=actor AND modo='duelo' AND respondida_en IS NOT NULL;
    SELECT coalesce(jsonb_agg(acierto ORDER BY duelo_indice),'[]') INTO other FROM suizamente_private.suizamente_partida_preguntas WHERE duelo_id=d.id AND jugador_id<>actor AND modo='duelo' AND respondida_en IS NOT NULL;
    view:=view||jsonb_build_object('duelo',jsonb_build_object('id',d.id,'estado',d.estado,'quitar',d.quitar,'apostar',d.apostar,'sello',d.sello,
      'ganador',d.ganador,'tusAciertos',own,'susAciertos',other,'desempate',d.ronda_desempate>0,
      'premio',jsonb_build_object('monedas',coalesce((SELECT sum(monedas) FROM suizamente_private.suizamente_movimientos WHERE jugador_id=actor AND motivo='duelo_sello' AND ref=d.id::text),0)),
      'mostrarResultado',d.estado='terminado' AND NOT CASE WHEN actor=d.retador THEN d.visto_a ELSE d.visto_b END));
  END IF;
  RETURN view;
END $$;
DO $hooks$ DECLARE definition text; BEGIN
  SELECT pg_get_functiondef('suizamente_private.v2_responder(uuid,text,integer,integer,boolean)'::regprocedure) INTO definition;
  IF definition NOT LIKE '%v4_responder(mid,actor,nq,choice,automatic)%' THEN
    IF position('  expired:=' IN definition)=0 THEN RAISE EXCEPTION 'Motor v2 no compatible'; END IF;
    definition:=replace(definition,'  expired:=','  IF suizamente_private.v4_responder(mid,actor,nq,choice,automatic) THEN RETURN; END IF;'||chr(10)||'  expired:=');
    definition:=replace(definition,'(m.reglas#>>''{partida,segundosPorPregunta}'')::integer+(m.reglas#>>''{partida,margenServidorSegundos}'')::integer',
      '(m.reglas#>>''{partida,segundosPorPregunta}'')::integer+q.tiempo_extra+(m.reglas#>>''{partida,margenServidorSegundos}'')::integer');
    EXECUTE definition;
  END IF;
END $hooks$;
ALTER TABLE suizamente_private.suizamente_duelos_sello ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON suizamente_private.suizamente_duelos_sello FROM PUBLIC,anon,authenticated;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='suizamente_private' AND p.proname LIKE 'v4_%' LOOP EXECUTE 'REVOKE ALL ON FUNCTION '||r.signature||' FROM PUBLIC,anon,authenticated'; END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
