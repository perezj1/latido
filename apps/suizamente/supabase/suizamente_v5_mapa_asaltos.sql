-- Apply after v4. Map, region chests and server-owned raids.
BEGIN;
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_mapa(
  jugador_id text NOT NULL REFERENCES suizamente_private.suizamente_jugadores(jugador_id) ON DELETE CASCADE,
  vuelta integer NOT NULL DEFAULT 1,canton text NOT NULL,nivel integer NOT NULL CHECK(nivel BETWEEN 0 AND 3),
  PRIMARY KEY(jugador_id,vuelta,canton)
);
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_cofres(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),jugador_id text NOT NULL REFERENCES suizamente_private.suizamente_jugadores(jugador_id) ON DELETE CASCADE,
  tipo text NOT NULL,ref text NOT NULL,titulo text NOT NULL,contenido jsonb NOT NULL,entregado jsonb,
  creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),abierto_en timestamptz,UNIQUE(jugador_id,tipo,ref)
);
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_asaltos(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),jugador_id text NOT NULL REFERENCES suizamente_private.suizamente_jugadores(jugador_id) ON DELETE CASCADE,
  victima text REFERENCES suizamente_private.suizamente_jugadores(jugador_id) ON DELETE SET NULL,
  partida_id uuid REFERENCES suizamente_private.suizamente_partidas(id) ON DELETE SET NULL,pregunta_origen integer NOT NULL,
  fecha date NOT NULL,region integer NOT NULL,canton text NOT NULL,nivel_inicial integer NOT NULL,
  estado text NOT NULL DEFAULT 'ofrecido',version integer NOT NULL DEFAULT 1,reglas jsonb NOT NULL,
  categoria text,payload jsonb,orden smallint[],enviada_en timestamptz,vence_en timestamptz,
  opcion smallint,acierto boolean,agotada boolean NOT NULL DEFAULT false,respondida_en timestamptz,
  comodines text[] NOT NULL DEFAULT '{}',quitadas smallint[] NOT NULL DEFAULT '{}',intentos smallint[] NOT NULL DEFAULT '{}',
  segunda_usada boolean NOT NULL DEFAULT false,tiempo_extra integer NOT NULL DEFAULT 0,
  escudo boolean NOT NULL DEFAULT false,premio integer NOT NULL DEFAULT 0,nivel_final integer,motivo text,
  creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(partida_id,pregunta_origen)
);
CREATE INDEX IF NOT EXISTS suizamente_asaltos_dia ON suizamente_private.suizamente_asaltos(jugador_id,fecha);
CREATE UNIQUE INDEX IF NOT EXISTS suizamente_asalto_pendiente ON suizamente_private.suizamente_asaltos(jugador_id) WHERE estado IN ('ofrecido','pregunta');

CREATE OR REPLACE FUNCTION suizamente_private.v5_region(actor text) RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb; idx integer:=0; maximum integer:=(suizamente_private.v2_config()#>>'{mapa,nivelesPorCanton}')::integer;
BEGIN
  FOR r IN SELECT value FROM jsonb_array_elements(suizamente_private.v2_config()#>'{mapa,regiones}') LOOP
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(r->'cantones') k LEFT JOIN suizamente_private.suizamente_mapa m
      ON m.jugador_id=actor AND m.vuelta=1 AND m.canton=k->>'id' WHERE coalesce(m.nivel,0)<maximum) THEN RETURN idx; END IF;
    idx:=idx+1;
  END LOOP;
  RETURN idx;
END $$;
-- Clamp free shield rewards exactly as in the reference prototype; ledger stores what was delivered.
CREATE OR REPLACE FUNCTION suizamente_private.v5_premiar(actor text,reason text,reference text,coins integer,items jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actual jsonb:=items; shields integer; maximum integer:=(suizamente_private.v2_config()#>>'{escudos,max}')::integer;
BEGIN
  PERFORM suizamente_private.v3_sincronizar(actor);
  SELECT coalesce((inventario->>'escudos')::integer,0) INTO shields FROM suizamente_private.suizamente_jugadores WHERE jugador_id=actor FOR UPDATE;
  IF actual ? 'escudos' THEN actual:=jsonb_set(actual,'{escudos}',to_jsonb(least((actual->>'escudos')::integer,greatest(0,maximum-shields)))); END IF;
  IF NOT suizamente_private.v3_anotar(actor,reason,reference,coins,0,actual) THEN RAISE EXCEPTION 'SZV2:409:Este premio ya está recibido'; END IF;
  RETURN jsonb_build_object('monedas',coins,'inventario',actual,'escudosAlMaximo',actual ? 'escudos' AND actual->'escudos'<>items->'escudos');
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v5_cofre(actor text,kind text,reference text,title text,reward jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cid uuid; cm text; content jsonb:=reward-'comodinesAlAzar';
BEGIN
  IF coalesce((reward->>'comodinesAlAzar')::integer,0)>0 THEN
    SELECT value->>'id' INTO cm FROM jsonb_array_elements(suizamente_private.v2_config()->'comodines') ORDER BY random() LIMIT 1;
    content:=content||jsonb_build_object('comodines',jsonb_build_object(cm,(reward->>'comodinesAlAzar')::integer));
  END IF;
  INSERT INTO suizamente_private.suizamente_cofres(jugador_id,tipo,ref,titulo,contenido) VALUES(actor,kind,reference,title,content)
    ON CONFLICT(jugador_id,tipo,ref) DO NOTHING;
  SELECT id INTO cid FROM suizamente_private.suizamente_cofres WHERE jugador_id=actor AND tipo=kind AND ref=reference;
  RETURN cid;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v5_cofre_ver(cid uuid,actor text) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object('id',id,'tipo',tipo,'ref',ref,'titulo',titulo,'abierto',abierto_en IS NOT NULL,
    'contenido',CASE WHEN abierto_en IS NOT NULL THEN entregado ELSE NULL END)
    FROM suizamente_private.suizamente_cofres WHERE id=cid AND jugador_id=actor
$$;
CREATE OR REPLACE FUNCTION suizamente_private.v5_mapa(actor text) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object('region',suizamente_private.v5_region(actor),'vuelta',1,
    'niveles',coalesce((SELECT jsonb_object_agg(canton,nivel) FROM suizamente_private.suizamente_mapa WHERE jugador_id=actor AND vuelta=1),'{}'),
    'cofres',coalesce((SELECT jsonb_agg(suizamente_private.v5_cofre_ver(id,actor) ORDER BY creado_en) FROM suizamente_private.suizamente_cofres WHERE jugador_id=actor AND abierto_en IS NULL),'[]'))
$$;
CREATE OR REPLACE FUNCTION suizamente_private.v5_es_amigo(actor text,other text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result boolean:=false;
BEGIN
  -- No Latido player friendship table exists yet. Phase 7 can populate this adapter.
  IF to_regclass('suizamente_private.suizamente_amigos') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS(SELECT 1 FROM suizamente_private.suizamente_amigos WHERE estado=''aceptado'' AND
      ((seguidor=$1 AND seguido=$2) OR (seguidor=$2 AND seguido=$1)))' INTO result USING actor,other;
  END IF;
  RETURN result;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v5_ofrecer(mid uuid,nq integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q suizamente_private.suizamente_partida_preguntas; m suizamente_private.suizamente_partidas; target record; day date;
BEGIN
  SELECT * INTO q FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=mid AND n=nq;
  IF NOT coalesce(q.acierto,false) OR q.omitida OR q.modo='asalto' THEN RETURN; END IF;
  SELECT * INTO m FROM suizamente_private.suizamente_partidas WHERE id=mid;
  IF NOT suizamente_private.v3_anotar(q.jugador_id,'asalto_sorteo',mid::text||':'||nq) THEN RETURN; END IF;
  day:=(clock_timestamp() AT TIME ZONE (m.reglas->>'zonaHoraria'))::date;
  IF EXISTS(SELECT 1 FROM suizamente_private.suizamente_asaltos WHERE jugador_id=q.jugador_id AND estado IN ('ofrecido','pregunta'))
    OR EXISTS(SELECT 1 FROM suizamente_private.suizamente_asaltos WHERE partida_id=mid AND pregunta_origen=nq)
    OR (SELECT count(*) FROM suizamente_private.suizamente_asaltos WHERE jugador_id=q.jugador_id AND fecha=day)>=(m.reglas#>>'{asaltos,maxPorDia}')::integer
    OR random()>=(m.reglas#>>'{asaltos,probabilidadPorAcierto}')::numeric THEN RETURN; END IF;
  SELECT p.jugador_id,t.canton,t.nivel,suizamente_private.v5_region(p.jugador_id) r INTO target
    FROM suizamente_private.suizamente_jugadores p CROSS JOIN LATERAL(
      SELECT t.canton,t.nivel FROM suizamente_private.suizamente_mapa t
      WHERE t.jugador_id=p.jugador_id AND t.vuelta=1 AND t.nivel>=(m.reglas#>>'{asaltos,nivelMinimoDelCanton}')::integer
        AND EXISTS(SELECT 1 FROM jsonb_array_elements(m.reglas#>ARRAY['mapa','regiones',suizamente_private.v5_region(p.jugador_id)::text,'cantones']) k WHERE k->>'id'=t.canton)
      ORDER BY random() LIMIT 1
    ) t WHERE p.jugador_id<>q.jugador_id AND NOT p.bloqueado
    ORDER BY suizamente_private.v5_es_amigo(q.jugador_id,p.jugador_id) DESC,random() LIMIT 1;
  IF target.jugador_id IS NULL THEN RETURN; END IF;
  INSERT INTO suizamente_private.suizamente_asaltos(jugador_id,victima,partida_id,pregunta_origen,fecha,region,canton,nivel_inicial,reglas)
    VALUES(q.jugador_id,target.jugador_id,mid,nq,day,target.r,target.canton,target.nivel,m.reglas) ON CONFLICT DO NOTHING;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v5_asalto_ver(aid uuid,actor text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a suizamente_private.suizamente_asaltos; question jsonb; result jsonb; total integer; hits integer; shields integer;
BEGIN
  SELECT * INTO a FROM suizamente_private.suizamente_asaltos WHERE id=aid AND jugador_id=actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'SZV2:404:Asalto no encontrado'; END IF;
  IF a.estado='pregunta' AND clock_timestamp()>a.vence_en+make_interval(secs=>(a.reglas#>>'{partida,margenServidorSegundos}')::integer) THEN
    PERFORM suizamente_private.v5_asalto_responder(aid,actor,NULL,true);
    SELECT * INTO a FROM suizamente_private.suizamente_asaltos WHERE id=aid;
  END IF;
  SELECT coalesce((inventario->>'escudos')::integer,0) INTO shields FROM suizamente_private.suizamente_jugadores WHERE jugador_id=a.victima;
  IF a.payload IS NOT NULL THEN
    question:=jsonb_build_object('n',1,'modo','asalto','categoria',a.categoria,'emoji',a.payload->'emoji','pregunta',a.payload->'pregunta',
      'opciones',(SELECT jsonb_agg(jsonb_build_object('indice',i,'e',a.payload->'opciones'->i->>'e','t',a.payload->'opciones'->i->>'t') ORDER BY ord) FROM unnest(a.orden) WITH ORDINALITY o(i,ord)),
      'enviadaEn',a.enviada_en,'venceEn',a.vence_en,'tiempo',(a.reglas#>>'{partida,segundosPorPregunta}')::integer+a.tiempo_extra,
      'usados',a.comodines,'quitadas',a.quitadas,'falladas',a.intentos,'otraUsada',a.segunda_usada);
    IF a.respondida_en IS NOT NULL THEN
      SELECT count(*),count(*) FILTER(WHERE opcion=(a.payload->>'correcta')::integer) INTO total,hits FROM suizamente_private.suizamente_votos WHERE pregunta_id=a.payload->>'id';
      result:=question||jsonb_build_object('ok',a.acierto,'opcion',a.opcion,'correcta',a.payload->'correcta','dato',a.payload->'dato','agotada',a.agotada,
        'pct',CASE WHEN total>=(a.reglas->>'minimoVotosParaPorcentajes')::integer THEN round(100.0*hits/total) ELSE NULL END);
      question:=NULL;
    END IF;
  END IF;
  RETURN jsonb_build_object('id',a.id,'partidaId',a.partida_id,'turnoN',a.version,'estado',a.estado,'canton',a.canton,'region',a.region,'nivelInicial',a.nivel_inicial,
    'nivelFinal',a.nivel_final,'escudo',a.escudo,'tieneEscudo',coalesce(shields,0)>0,'premio',a.premio,'motivo',a.motivo,
    'maxPremio',a.reglas#>'{asaltos,premio}','premioConEscudo',a.reglas#>'{asaltos,premioConEscudo}',
    'victima',(SELECT jsonb_build_object('apodo',apodo,'color',color) FROM suizamente_private.suizamente_jugadores WHERE jugador_id=a.victima),
    'pregunta',question,'resultado',result,'servidorAhora',clock_timestamp());
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v5_asalto_responder(aid uuid,actor text,choice integer,automatic boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a suizamente_private.suizamente_asaltos; expired boolean; ok boolean; lvl integer; shields integer; coins integer:=0; stopped boolean:=false; note text; victim_uid uuid;
BEGIN
  SELECT * INTO a FROM suizamente_private.suizamente_asaltos WHERE id=aid AND jugador_id=actor FOR UPDATE;
  IF a.estado IS DISTINCT FROM 'pregunta' THEN RAISE EXCEPTION 'SZV2:409:Este asalto ya no admite respuestas'; END IF;
  expired:=clock_timestamp()>a.vence_en+make_interval(secs=>(a.reglas#>>'{partida,margenServidorSegundos}')::integer);
  IF automatic AND NOT expired THEN RAISE EXCEPTION 'SZV2:409:El tiempo sigue corriendo'; END IF;
  IF NOT expired AND (choice IS NULL OR choice<0 OR choice>=jsonb_array_length(a.payload->'opciones')) THEN RAISE EXCEPTION 'SZV2:400:Elige una opción válida'; END IF;
  IF NOT expired AND (choice=ANY(a.quitadas) OR choice=ANY(a.intentos)) THEN RAISE EXCEPTION 'SZV2:409:Esa opción ya no está disponible'; END IF;
  ok:=NOT expired AND choice=(a.payload->>'correcta')::integer;
  IF NOT expired THEN
    INSERT INTO suizamente_private.suizamente_votos(pregunta_id,jugador_id,opcion) VALUES(a.payload->>'id',actor,choice) ON CONFLICT DO NOTHING;
    PERFORM suizamente_private.v3_actividad(actor,clock_timestamp());
    UPDATE suizamente_private.suizamente_asaltos SET intentos=array_append(intentos,choice::smallint) WHERE id=aid;
    IF NOT ok AND 'otra'=ANY(a.comodines) AND NOT a.segunda_usada THEN
      UPDATE suizamente_private.suizamente_asaltos SET segunda_usada=true,version=version+1 WHERE id=aid; RETURN;
    END IF;
  END IF;
  IF ok THEN
    SELECT usuario_id INTO victim_uid FROM suizamente_private.suizamente_jugadores WHERE jugador_id=a.victima FOR UPDATE;
    PERFORM suizamente_private.v3_sincronizar(a.victima);
    SELECT coalesce((inventario->>'escudos')::integer,0) INTO shields FROM suizamente_private.suizamente_jugadores WHERE jugador_id=a.victima;
    SELECT nivel INTO lvl FROM suizamente_private.suizamente_mapa WHERE jugador_id=a.victima AND vuelta=1 AND canton=a.canton FOR UPDATE;
    -- Latido: if the target is no longer eligible, cancel without prize or damage.
    IF a.victima IS NULL OR a.victima=actor OR suizamente_private.v5_region(a.victima)<>a.region OR coalesce(lvl,0)<(a.reglas#>>'{asaltos,nivelMinimoDelCanton}')::integer THEN
      UPDATE suizamente_private.suizamente_asaltos SET estado='cancelado',motivo='objetivo_no_disponible',version=version+1,
        opcion=CASE WHEN expired THEN NULL ELSE choice END,acierto=ok,agotada=expired,respondida_en=clock_timestamp() WHERE id=aid;
      RETURN;
    END IF;
    stopped:=shields>0;coins:=CASE WHEN stopped THEN (a.reglas#>>'{asaltos,premioConEscudo}')::integer ELSE (a.reglas#>>'{asaltos,premio}')::integer END;
    PERFORM suizamente_private.v3_anotar(actor,'asalto',aid::text,coins);
    PERFORM suizamente_private.v3_anotar(a.victima,'asalto_recibido',aid::text,0,0,CASE WHEN stopped THEN '{"escudos":-1}'::jsonb ELSE '{}'::jsonb END);
    IF NOT stopped THEN
      UPDATE suizamente_private.suizamente_mapa SET nivel=nivel-1 WHERE jugador_id=a.victima AND vuelta=1 AND canton=a.canton;
      lvl:=lvl-1;
    END IF;
    UPDATE suizamente_private.suizamente_movimientos SET detalle=jsonb_build_object('canton',a.canton,'escudo',stopped,'nivelFinal',lvl)
      WHERE motivo IN ('asalto','asalto_recibido') AND ref=aid::text;
    note:=CASE WHEN stopped THEN '🛡️ Tu escudo ha parado un asalto' ELSE '⚔️ '||(SELECT apodo FROM suizamente_private.suizamente_jugadores WHERE jugador_id=actor)||' ha asaltado '||
      (SELECT k->>'nombre' FROM jsonb_array_elements(a.reglas#>ARRAY['mapa','regiones',a.region::text,'cantones']) k WHERE k->>'id'=a.canton) END;
    IF victim_uid IS NOT NULL AND to_regclass('public.app_notifications') IS NOT NULL THEN
      EXECUTE 'INSERT INTO public.app_notifications(recipient_id,kind,source_id,data) VALUES($1,''suizamente_asalto'',$2,$3) ON CONFLICT DO NOTHING'
        USING victim_uid,aid::text,jsonb_build_object('title',note,'href','/suizamente/mapa');
    END IF;
    INSERT INTO suizamente_private.suizamente_novedades(jugador_id,tipo,ref,datos)
      VALUES(a.victima,'asalto',aid::text,jsonb_build_object('texto',note,'href','/suizamente/mapa')) ON CONFLICT DO NOTHING;
  ELSE
    PERFORM suizamente_private.v3_anotar(actor,'asalto_fallido',aid::text);
  END IF;
  UPDATE suizamente_private.suizamente_asaltos SET estado='resuelto',opcion=CASE WHEN expired THEN NULL ELSE choice END,acierto=ok,agotada=expired,
    respondida_en=clock_timestamp(),escudo=stopped,premio=coins,nivel_final=lvl,version=version+1 WHERE id=aid;
  PERFORM suizamente_private.v3_logros(actor);
  IF a.victima IS NOT NULL THEN PERFORM suizamente_private.v3_logros(a.victima); END IF;
END $$;

CREATE OR REPLACE FUNCTION suizamente_private.v5_accion(action text,actor text,body jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c jsonb:=suizamente_private.v2_config(); reg integer; k jsonb; lvl integer; cost integer; cid uuid; key text;
  chest suizamente_private.suizamente_cofres; a suizamente_private.suizamente_asaltos; content jsonb; items jsonb; cm jsonb; removed integer; cat text; item jsonb;
BEGIN
  IF action='mapa' THEN RETURN suizamente_private.v5_mapa(actor);
  ELSIF action='construir' THEN
    key:=body->>'clave';
    IF coalesce(key,'')!~'^[0-9a-f-]{36}$' THEN RAISE EXCEPTION 'SZV2:400:Construcción no válida'; END IF;
    IF EXISTS(SELECT 1 FROM suizamente_private.suizamente_movimientos WHERE jugador_id=actor AND motivo='construccion' AND ref=key) THEN RAISE EXCEPTION 'SZV2:409:Esta construcción ya está hecha'; END IF;
    reg:=suizamente_private.v5_region(actor);
    SELECT value INTO k FROM jsonb_array_elements(c#>ARRAY['mapa','regiones',reg::text,'cantones']) WHERE value->>'id'=body->>'canton';
    IF k IS NULL THEN RAISE EXCEPTION 'SZV2:409:Construye en tu región actual'; END IF;
    SELECT coalesce((SELECT nivel FROM suizamente_private.suizamente_mapa WHERE jugador_id=actor AND vuelta=1 AND canton=body->>'canton'),0) INTO lvl;
    IF (body->>'nivel')::integer IS DISTINCT FROM lvl OR lvl>=(c#>>'{mapa,nivelesPorCanton}')::integer THEN RAISE EXCEPTION 'SZV2:409:El nivel del cantón ha cambiado'; END IF;
    cost:=(k->'costes'->>lvl)::integer;
    PERFORM suizamente_private.v3_anotar(actor,'construccion',key,-cost);
    UPDATE suizamente_private.suizamente_movimientos SET detalle=jsonb_build_object('canton',k->>'id','vuelta',1,'nivel',lvl+1) WHERE jugador_id=actor AND motivo='construccion' AND ref=key;
    INSERT INTO suizamente_private.suizamente_mapa VALUES(actor,1,k->>'id',lvl+1) ON CONFLICT(jugador_id,vuelta,canton) DO UPDATE SET nivel=excluded.nivel;
    IF suizamente_private.v5_region(actor)>reg THEN
      cid:=suizamente_private.v5_cofre(actor,'region','1:'||reg,'¡'||(c#>>ARRAY['mapa','regiones',reg::text,'nombre'])||' completa!',c#>'{cofres,region}');
    END IF;
    PERFORM suizamente_private.v3_logros(actor);
    RETURN suizamente_private.v5_mapa(actor)||jsonb_build_object('cofre',CASE WHEN cid IS NOT NULL THEN suizamente_private.v5_cofre_ver(cid,actor) ELSE NULL END);
  ELSIF action IN ('cofre','abrir_cofre') THEN
    SELECT * INTO chest FROM suizamente_private.suizamente_cofres WHERE id=(body->>'id')::uuid AND jugador_id=actor FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'SZV2:404:Cofre no encontrado'; END IF;
    IF action='abrir_cofre' THEN
      IF chest.abierto_en IS NOT NULL THEN RAISE EXCEPTION 'SZV2:409:Este cofre ya está abierto'; END IF;
      items:=coalesce(chest.contenido->'comodines','{}');
      IF chest.contenido ? 'sobres' THEN items:=items||jsonb_build_object('sobres',chest.contenido->'sobres'); END IF;
      IF chest.contenido ? 'escudos' THEN items:=items||jsonb_build_object('escudos',chest.contenido->'escudos'); END IF;
      content:=suizamente_private.v5_premiar(actor,'cofre_'||chest.tipo,chest.ref,(chest.contenido->>'monedas')::integer,items);
      UPDATE suizamente_private.suizamente_cofres SET abierto_en=clock_timestamp(),entregado=content WHERE id=chest.id;
    END IF;
    RETURN suizamente_private.v5_cofre_ver(chest.id,actor);
  END IF;
  IF action NOT IN ('asalto','asalto_empezar','asalto_respuesta','asalto_comodin','asalto_descartar') THEN RETURN NULL; END IF;
  SELECT * INTO a FROM suizamente_private.suizamente_asaltos WHERE id=(body->>'id')::uuid AND jugador_id=actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SZV2:404:Asalto no encontrado'; END IF;
  IF action='asalto' THEN RETURN suizamente_private.v5_asalto_ver(a.id,actor); END IF;
  IF (body->>'turnoN')::integer IS DISTINCT FROM a.version THEN RAISE EXCEPTION 'SZV2:409:El asalto ha cambiado. Actualízalo'; END IF;
  IF action='asalto_descartar' THEN
    IF a.estado<>'ofrecido' THEN RAISE EXCEPTION 'SZV2:409:El asalto ya está empezado'; END IF;
    UPDATE suizamente_private.suizamente_asaltos SET estado='cancelado',motivo='descartado',version=version+1 WHERE id=a.id;
  ELSIF action='asalto_empezar' THEN
    IF a.estado<>'ofrecido' THEN RAISE EXCEPTION 'SZV2:409:El asalto ya está empezado'; END IF;
    SELECT value->>'id' INTO cat FROM jsonb_array_elements(a.reglas->'categorias') ORDER BY random() LIMIT 1;
    item:=suizamente_private.v4_elegir(actor,cat);
    UPDATE suizamente_private.suizamente_asaltos SET estado='pregunta',categoria=cat,payload=item,
      orden=(SELECT array_agg(i::smallint ORDER BY random()) FROM generate_series(0,jsonb_array_length(item->'opciones')-1) i),
      enviada_en=clock_timestamp(),vence_en=clock_timestamp()+make_interval(secs=>(a.reglas#>>'{partida,segundosPorPregunta}')::integer),version=version+1 WHERE id=a.id;
  ELSIF action='asalto_respuesta' THEN
    PERFORM suizamente_private.v5_asalto_responder(a.id,actor,(body->>'opcion')::integer,coalesce((body->>'agotada')::boolean,false));
  ELSE
    SELECT value INTO cm FROM jsonb_array_elements(a.reglas->'comodines') WHERE value->>'id'=body->>'tipo';
    IF a.estado<>'pregunta' OR clock_timestamp()>=a.vence_en OR cm IS NULL OR (cm->>'id')=ANY(a.comodines)
      OR cm->'noEnModos' ? 'asalto' OR a.reglas#>'{asaltos,comodinesNoPermitidos}' ? (cm->>'id')
      OR (coalesce((cm->>'soloConTresOpciones')::boolean,false) AND jsonb_array_length(a.payload->'opciones')<>3) THEN RAISE EXCEPTION 'SZV2:409:No puedes usar ese comodín ahora'; END IF;
    PERFORM suizamente_private.v3_anotar(actor,'comodin_asalto',a.id::text||':'||(cm->>'id'),0,0,jsonb_build_object(cm->>'id',-1));
    IF cm->>'id'='quita' THEN
      SELECT i INTO removed FROM generate_series(0,jsonb_array_length(a.payload->'opciones')-1) i WHERE i<>(a.payload->>'correcta')::integer AND NOT i=ANY(a.intentos) ORDER BY random() LIMIT 1;
      IF removed IS NULL THEN RAISE EXCEPTION 'SZV2:409:No queda ninguna opción que quitar'; END IF;
      UPDATE suizamente_private.suizamente_asaltos SET quitadas=array_append(quitadas,removed::smallint) WHERE id=a.id;
    ELSIF cm->>'id'='tiempo' THEN
      UPDATE suizamente_private.suizamente_asaltos SET vence_en=vence_en+make_interval(secs=>(cm->>'segundosExtra')::integer),tiempo_extra=tiempo_extra+(cm->>'segundosExtra')::integer WHERE id=a.id;
    END IF;
    UPDATE suizamente_private.suizamente_asaltos SET comodines=array_append(comodines,cm->>'id'),version=version+1 WHERE id=a.id;
  END IF;
  RETURN suizamente_private.v5_asalto_ver(a.id,actor);
END $$;

-- Preserve the previous checked public dispatcher as an implementation detail.
DO $$ BEGIN
  IF to_regprocedure('suizamente_private.v4_api(text,jsonb,uuid,text)') IS NULL THEN
    ALTER FUNCTION public.suizamente_v2(text,jsonb,uuid,text) SET SCHEMA suizamente_private;
    ALTER FUNCTION suizamente_private.suizamente_v2(text,jsonb,uuid,text) RENAME TO v4_api;
  END IF;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v5_enriquecer(data jsonb,actor text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE view jsonb:=data; aid uuid;
BEGIN
  IF jsonb_typeof(data)<>'object' THEN RETURN data; END IF;
  IF data->>'tuId' IS NOT NULL THEN
    SELECT id INTO aid FROM suizamente_private.suizamente_asaltos WHERE jugador_id=actor AND partida_id=(data->>'id')::uuid AND estado IN ('ofrecido','pregunta');
    IF aid IS NOT NULL THEN view:=view||jsonb_build_object('asalto',suizamente_private.v5_asalto_ver(aid,actor)); END IF;
  END IF;
  IF data ? 'jugador' THEN view:=view||jsonb_build_object('mapa',suizamente_private.v5_mapa(actor)); END IF;
  RETURN view;
END $$;
CREATE OR REPLACE FUNCTION public.suizamente_v2(p_action text,p_args jsonb DEFAULT '{}',p_guest_id uuid DEFAULT NULL,p_guest_token text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE data jsonb; identity jsonb; actor text;
BEGIN
  IF jsonb_typeof(coalesce(p_args,'{}'))<>'object' OR octet_length(coalesce(p_args,'{}')::text)>10000 THEN RAISE EXCEPTION 'SZV2:400:Solicitud no válida'; END IF;
  IF p_action IN ('mapa','construir','cofre','abrir_cofre','asalto','asalto_empezar','asalto_respuesta','asalto_comodin','asalto_descartar') THEN
    identity:=suizamente_private.v2_api_base('jugador','{}',p_guest_id,p_guest_token);actor:=identity->>'identidad';
    IF identity->'jugador'='null'::jsonb THEN RAISE EXCEPTION 'SZV2:404:Crea primero tu perfil'; END IF;
    data:=suizamente_private.v5_accion(p_action,actor,p_args);
    data:=suizamente_private.v3_enriquecer(data,actor);
  ELSE
    actor:=CASE WHEN auth.uid() IS NOT NULL THEN auth.uid()::text ELSE 'invitado-'||p_guest_id::text END;
    IF p_action IN ('girar','pregunta','respuesta','rendirse') AND EXISTS(
      SELECT 1 FROM suizamente_private.suizamente_asaltos WHERE jugador_id=actor AND estado='pregunta' AND partida_id=(p_args->>'id')::uuid) THEN
      identity:=suizamente_private.v2_api_base('jugador','{}',p_guest_id,p_guest_token);
      RAISE EXCEPTION 'SZV2:409:Termina el asalto antes de seguir la partida';
    END IF;
    data:=suizamente_private.v4_api(p_action,p_args,p_guest_id,p_guest_token);
    actor:=CASE WHEN auth.uid() IS NOT NULL THEN auth.uid()::text ELSE 'invitado-'||p_guest_id::text END;
    IF p_action IN ('girar','pregunta') THEN
      UPDATE suizamente_private.suizamente_asaltos SET estado='cancelado',motivo='descartado',version=version+1
        WHERE jugador_id=actor AND estado='ofrecido' AND partida_id=(p_args->>'id')::uuid;
    END IF;
  END IF;
  RETURN suizamente_private.v5_enriquecer(data,actor);
END $$;

-- Extend progress/profile from actual server-side raid responses.
DO $$ BEGIN
  IF to_regprocedure('suizamente_private.v4_avances(text)') IS NULL THEN ALTER FUNCTION suizamente_private.v3_avances(text) RENAME TO v4_avances; END IF;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v3_avances(actor text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE progress jsonb:=suizamente_private.v4_avances(actor); r record; cnt integer;
BEGIN
  FOR r IN SELECT * FROM (VALUES('idioma','poliglota'),('cultura','folclore'),('comida','gourmet'),('papeles','papeleo'),('casa','vecindad'),('dia','puntualidad')) c(category,achievement) LOOP
    SELECT count(*) INTO cnt FROM suizamente_private.suizamente_asaltos WHERE jugador_id=actor AND acierto AND respondida_en IS NOT NULL AND categoria=r.category;
    progress:=jsonb_set(progress,ARRAY[r.achievement],to_jsonb((progress->>r.achievement)::integer+cnt));
  END LOOP;
  RETURN progress||jsonb_build_object('suiza_entera',(SELECT count(*) FROM suizamente_private.suizamente_mapa WHERE jugador_id=actor AND vuelta=1 AND nivel=(suizamente_private.v2_config()#>>'{mapa,nivelesPorCanton}')::integer),
    'muralla',(SELECT count(*) FROM suizamente_private.suizamente_movimientos WHERE jugador_id=actor AND motivo='asalto_recibido' AND (detalle->>'escudo')::boolean),
    'coleccionista',(SELECT count(*) FROM suizamente_private.suizamente_movimientos WHERE jugador_id=actor AND motivo='coleccion'));
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v3_perfil(actor text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cats jsonb; total integer; won integer; lost integer; abandoned integer; specialties jsonb;
BEGIN
  WITH responses AS(
    SELECT categoria,acierto FROM suizamente_private.suizamente_partida_preguntas WHERE jugador_id=actor AND respondida_en IS NOT NULL AND NOT omitida
    UNION ALL SELECT categoria,acierto FROM suizamente_private.suizamente_asaltos WHERE jugador_id=actor AND respondida_en IS NOT NULL
  ) SELECT coalesce(jsonb_agg(s ORDER BY s.pct DESC,s.categoria),'[]'),coalesce(sum(s.aciertos),0) INTO cats,total FROM(
    SELECT categoria,count(*) respuestas,count(*) FILTER(WHERE acierto) aciertos,round(100.0*count(*) FILTER(WHERE acierto)/count(*)) pct FROM responses GROUP BY categoria) s;
  SELECT count(*) FILTER(WHERE ganador=actor),count(*) FILTER(WHERE ganador IS NOT NULL AND ganador<>actor AND motivo_fin NOT IN ('rendicion','plazo')),
    count(*) FILTER(WHERE ganador IS DISTINCT FROM actor AND motivo_fin IN ('rendicion','plazo')) INTO won,lost,abandoned
    FROM suizamente_private.suizamente_partidas WHERE actor IN(jugador_a,jugador_b) AND terminada_en IS NOT NULL;
  SELECT jsonb_agg(value ORDER BY (value->>'pct')::numeric DESC,value->>'categoria') INTO specialties FROM jsonb_array_elements(cats)
    WHERE (value->>'respuestas')::integer>=(suizamente_private.v2_config()->>'minimoVotosParaPorcentajes')::integer;
  RETURN jsonb_build_object('aciertos',total,'ganadas',won,'perdidas',lost,'abandonadas',abandoned,'categorias',cats,
    'especialidad',CASE WHEN jsonb_array_length(specialties)>=2 THEN specialties->0 ELSE NULL END,
    'cuesta',CASE WHEN jsonb_array_length(specialties)>=2 THEN specialties->(jsonb_array_length(specialties)-1) ELSE NULL END,'logros',suizamente_private.v3_logros(actor));
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v5_vincular(actor text,guest_actor text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE idx integer;
BEGIN
  INSERT INTO suizamente_private.suizamente_mapa SELECT actor,vuelta,canton,nivel FROM suizamente_private.suizamente_mapa WHERE jugador_id=guest_actor
    ON CONFLICT(jugador_id,vuelta,canton) DO UPDATE SET nivel=greatest(suizamente_mapa.nivel,excluded.nivel);
  UPDATE suizamente_private.suizamente_cofres a SET abierto_en=coalesce(a.abierto_en,g.abierto_en),entregado=coalesce(a.entregado,g.entregado)
    FROM suizamente_private.suizamente_cofres g WHERE a.jugador_id=actor AND g.jugador_id=guest_actor AND a.tipo=g.tipo AND a.ref=g.ref;
  UPDATE suizamente_private.suizamente_cofres g SET jugador_id=actor WHERE g.jugador_id=guest_actor
    AND NOT EXISTS(SELECT 1 FROM suizamente_private.suizamente_cofres a WHERE a.jugador_id=actor AND a.tipo=g.tipo AND a.ref=g.ref);
  -- Keep guest chest UUIDs when no same-region/account chest exists; duplicates are covered by natural ledger refs.
  UPDATE suizamente_private.suizamente_asaltos SET estado='cancelado',motivo='vinculacion',version=version+1
    WHERE estado IN ('ofrecido','pregunta') AND jugador_id IN(actor,guest_actor);
  UPDATE suizamente_private.suizamente_asaltos SET jugador_id=actor WHERE jugador_id=guest_actor;
  UPDATE suizamente_private.suizamente_asaltos SET victima=actor WHERE victima=guest_actor;
  FOR idx IN 0..suizamente_private.v5_region(actor)-1 LOOP
    PERFORM suizamente_private.v5_cofre(actor,'region','1:'||idx,
      '¡'||(suizamente_private.v2_config()#>>ARRAY['mapa','regiones',idx::text,'nombre'])||' completa!',suizamente_private.v2_config()#>'{cofres,region}');
  END LOOP;
  UPDATE suizamente_private.suizamente_jugadores SET actualizado_en=clock_timestamp() WHERE jugador_id=actor;
END $$;
DO $hooks$ DECLARE definition text; BEGIN
  SELECT pg_get_functiondef('suizamente_private.v3_respuesta(uuid,integer)'::regprocedure) INTO definition;
  IF definition NOT LIKE '%v5_ofrecer(mid,nq)%' THEN EXECUTE replace(definition,'END $function$','  PERFORM suizamente_private.v5_ofrecer(mid,nq);'||chr(10)||'END $function$'); END IF;
  SELECT pg_get_functiondef('suizamente_private.v3_vincular(text,text)'::regprocedure) INTO definition;
  IF definition NOT LIKE '%v5_vincular(actor,guest_actor)%' THEN EXECUTE replace(definition,'END $function$','  PERFORM suizamente_private.v5_vincular(actor,guest_actor);'||chr(10)||'END $function$'); END IF;
END $hooks$;
DO $$ DECLARE r record; expression text; BEGIN
  IF to_regclass('public.app_notifications') IS NOT NULL THEN
    SELECT pg_get_expr(conbin,conrelid) INTO expression FROM pg_constraint WHERE conrelid='public.app_notifications'::regclass AND conname='app_notifications_kind_check';
    IF expression IS NOT NULL AND position('suizamente_asalto' IN expression)=0 THEN
      ALTER TABLE public.app_notifications DROP CONSTRAINT app_notifications_kind_check;
      EXECUTE 'ALTER TABLE public.app_notifications ADD CONSTRAINT app_notifications_kind_check CHECK(kind=''suizamente_asalto'' OR ('||expression||'))';
    END IF;
  END IF;
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='suizamente_private' AND tablename IN('suizamente_mapa','suizamente_cofres','suizamente_asaltos') LOOP
    EXECUTE format('ALTER TABLE suizamente_private.%I ENABLE ROW LEVEL SECURITY',r.tablename);
    EXECUTE format('REVOKE ALL ON suizamente_private.%I FROM PUBLIC,anon,authenticated',r.tablename);
  END LOOP;
  FOR r IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='suizamente_private' AND (p.proname LIKE 'v5_%' OR p.proname IN ('v4_api','v4_avances','v3_avances')) LOOP EXECUTE 'REVOKE ALL ON FUNCTION '||r.signature||' FROM PUBLIC,anon,authenticated'; END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
