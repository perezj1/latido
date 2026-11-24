-- Optional attack after a victory. Existing single-question raids remain compatible.
BEGIN;
ALTER TABLE suizamente_private.suizamente_asaltos
 ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'acierto',
 ADD COLUMN IF NOT EXISTS preguntas_total integer NOT NULL DEFAULT 1,
 ADD COLUMN IF NOT EXISTS pregunta_numero integer NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS aciertos integer NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS historial jsonb NOT NULL DEFAULT '[]';
UPDATE suizamente_private.suizamente_configuracion
 SET juego=jsonb_set(juego,'{asaltos}',(juego->'asaltos')||jsonb_build_object('preguntasTrasVictoria',coalesce(juego#>'{asaltos,preguntasTrasVictoria}','5'::jsonb),'momento',coalesce(juego#>'{asaltos,momento}','"victoria"'::jsonb),'premio',100,'premioConEscudo',70));
UPDATE suizamente_private.suizamente_configuracion SET juego=jsonb_set(juego,'{logros}',
 (SELECT jsonb_agg(CASE WHEN value->>'id'='muralla' THEN value||jsonb_build_object('condicion','Reduce el robo en '||(value->>'meta')||' ataques con tus escudos') ELSE value END) FROM jsonb_array_elements(juego->'logros')));
DO $$ BEGIN
 IF to_regprocedure('suizamente_private.v17_ofrecer_base(uuid,integer)') IS NULL THEN ALTER FUNCTION suizamente_private.v5_ofrecer(uuid,integer) RENAME TO v17_ofrecer_base;END IF;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v5_ofrecer(mid uuid,nq integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF suizamente_private.v2_config()#>>'{asaltos,momento}'='victoria' THEN RETURN;END IF;
 PERFORM suizamente_private.v17_ofrecer_base(mid,nq);
END $$;

CREATE OR REPLACE FUNCTION suizamente_private.v17_objetivos(mid uuid,actor text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m suizamente_private.suizamente_partidas;target text;c jsonb:=suizamente_private.v2_config();v integer;r integer;aid uuid;used integer;
BEGIN
 SELECT * INTO m FROM suizamente_private.suizamente_partidas WHERE id=mid;
 IF NOT FOUND OR actor NOT IN(m.jugador_a,coalesce(m.jugador_b,'')) THEN RAISE EXCEPTION 'SZV2:404:Partida no encontrada';END IF;
 IF m.estado IN('jugando','buscando') THEN RAISE EXCEPTION 'SZV2:409:Termina la partida antes de atacar';END IF;
 IF m.ganador IS DISTINCT FROM actor THEN RAISE EXCEPTION 'SZV2:403:Solo quien gana puede atacar';END IF;
 target:=CASE WHEN actor=m.jugador_a THEN m.jugador_b ELSE m.jugador_a END;
 IF target IS NULL OR NOT EXISTS(SELECT 1 FROM suizamente_private.suizamente_jugadores WHERE jugador_id=target AND NOT bloqueado) THEN RAISE EXCEPTION 'SZV2:404:El rival ya no está disponible';END IF;
 v:=suizamente_private.v11_vuelta(target);r:=suizamente_private.v5_region(target);
 SELECT id INTO aid FROM suizamente_private.suizamente_asaltos WHERE partida_id=mid AND jugador_id=actor AND tipo='victoria';
 SELECT count(*) INTO used FROM suizamente_private.suizamente_asaltos WHERE jugador_id=actor AND fecha=suizamente_private.v7_hoy() AND tipo='victoria';
 RETURN jsonb_build_object('partidaId',mid,'ataqueId',aid,'preguntas',c#>'{asaltos,preguntasTrasVictoria}',
  'premio',c#>'{asaltos,premio}','premioConEscudo',c#>'{asaltos,premioConEscudo}',
  'limiteAlcanzado',aid IS NULL AND used>=(c#>>'{asaltos,maxPorDia}')::integer,
  'victima',(SELECT jsonb_build_object('id',jugador_id,'apodo',apodo,'color',color,'escudos',coalesce((inventario->>'escudos')::integer,0)) FROM suizamente_private.suizamente_jugadores WHERE jugador_id=target),
  'mapa',jsonb_build_object('vuelta',v,'region',r,'niveles',coalesce((SELECT jsonb_object_agg(canton,nivel) FROM suizamente_private.suizamente_mapa WHERE jugador_id=target AND vuelta=v),'{}')),
  'cantones',(SELECT jsonb_agg(jsonb_build_object('id',k->>'id','nombre',k->>'nombre','nivel',coalesce(t.nivel,0),'protegido',region.ordinality-1<>r,
   'disponible',coalesce(t.nivel,0)>=(c#>>'{asaltos,nivelMinimoDelCanton}')::integer AND region.ordinality-1=r) ORDER BY region.ordinality,k->>'nombre')
   FROM jsonb_array_elements(c#>'{mapa,regiones}') WITH ORDINALITY region(value,ordinality)
   CROSS JOIN LATERAL jsonb_array_elements(region.value->'cantones') k
   LEFT JOIN suizamente_private.suizamente_mapa t ON t.jugador_id=target AND t.vuelta=v AND t.canton=k->>'id'));
END $$;

CREATE OR REPLACE FUNCTION suizamente_private.v17_preguntar(aid uuid,actor text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a suizamente_private.suizamente_asaltos;cat text;item jsonb;excluded text[];
BEGIN
 SELECT * INTO a FROM suizamente_private.suizamente_asaltos WHERE id=aid AND jugador_id=actor FOR UPDATE;
 IF a.tipo<>'victoria' OR a.estado NOT IN('ofrecido','entre_preguntas') OR a.pregunta_numero>=a.preguntas_total THEN RAISE EXCEPTION 'SZV2:409:No hay otra pregunta disponible';END IF;
 SELECT coalesce(array_agg(value->'payload'->>'id'),'{}') INTO excluded FROM jsonb_array_elements(a.historial);
 SELECT value->>'id' INTO cat FROM jsonb_array_elements(a.reglas->'categorias') ORDER BY random() LIMIT 1;
 item:=suizamente_private.v4_elegir(actor,cat,excluded);
 UPDATE suizamente_private.suizamente_asaltos SET estado='pregunta',pregunta_numero=pregunta_numero+1,categoria=cat,payload=item,
  orden=(SELECT array_agg(i::smallint ORDER BY random()) FROM generate_series(0,jsonb_array_length(item->'opciones')-1) i),
  enviada_en=clock_timestamp(),vence_en=clock_timestamp()+make_interval(secs=>(a.reglas#>>'{partida,segundosPorPregunta}')::integer),
  opcion=NULL,acierto=NULL,agotada=false,respondida_en=NULL,comodines='{}',quitadas='{}',intentos='{}',segunda_usada=false,tiempo_extra=0,version=version+1 WHERE id=aid;
END $$;

CREATE OR REPLACE FUNCTION suizamente_private.v17_liquidar(aid uuid,actor text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a suizamente_private.suizamente_asaltos;lvl integer;shields integer;coins integer;balance integer;shield boolean;note text;canton_name text;
BEGIN
 SELECT * INTO a FROM suizamente_private.suizamente_asaltos WHERE id=aid AND jugador_id=actor FOR UPDATE;
 IF a.estado<>'resolviendo' OR a.aciertos<>a.preguntas_total THEN RAISE EXCEPTION 'SZV2:409:El ataque aún no está completo';END IF;
 PERFORM suizamente_private.v3_sincronizar(a.victima);
 SELECT monedas,coalesce((inventario->>'escudos')::integer,0) INTO balance,shields FROM suizamente_private.suizamente_jugadores WHERE jugador_id=a.victima FOR UPDATE;
 SELECT nivel INTO lvl FROM suizamente_private.suizamente_mapa WHERE jugador_id=a.victima AND vuelta=a.vuelta_victima AND canton=a.canton FOR UPDATE;
 IF a.victima IS NULL OR a.victima=actor OR suizamente_private.v11_vuelta(a.victima)<>a.vuelta_victima OR suizamente_private.v5_region(a.victima)<>a.region OR coalesce(lvl,0)<(a.reglas#>>'{asaltos,nivelMinimoDelCanton}')::integer THEN
  UPDATE suizamente_private.suizamente_asaltos SET estado='cancelado',motivo='objetivo_no_disponible' WHERE id=aid;RETURN;
 END IF;
 shield:=shields>0;
 coins:=least(balance,CASE WHEN shield THEN (a.reglas#>>'{asaltos,premioConEscudo}')::integer ELSE (a.reglas#>>'{asaltos,premio}')::integer END);
 IF NOT suizamente_private.v3_anotar(actor,'asalto',aid::text,coins) THEN RAISE EXCEPTION 'SZV2:409:Este ataque ya está cobrado';END IF;
 IF NOT suizamente_private.v3_anotar(a.victima,'asalto_recibido',aid::text,-coins,0,CASE WHEN shield THEN '{"escudos":-1}'::jsonb ELSE '{}'::jsonb END) THEN RAISE EXCEPTION 'SZV2:409:Este ataque ya está resuelto';END IF;
 UPDATE suizamente_private.suizamente_mapa SET nivel=nivel-1 WHERE jugador_id=a.victima AND vuelta=a.vuelta_victima AND canton=a.canton;
 UPDATE suizamente_private.suizamente_asaltos SET estado='resuelto',escudo=shield,premio=coins,nivel_final=lvl-1 WHERE id=aid;
 UPDATE suizamente_private.suizamente_movimientos SET detalle=jsonb_build_object('canton',a.canton,'escudo',shield,'nivelFinal',lvl-1,'monedasRobadas',coins,'partida',a.partida_id) WHERE motivo IN('asalto','asalto_recibido') AND ref=aid::text;
 SELECT k->>'nombre' INTO canton_name FROM jsonb_array_elements(a.reglas#>ARRAY['mapa','regiones',a.region::text,'cantones']) k WHERE k->>'id'=a.canton;
 note:=CASE WHEN shield THEN '🛡️ Tu escudo ha reducido el robo a '||coins||' monedas. ' ELSE '⚔️ Te han robado '||coins||' monedas. ' END||canton_name||' baja un nivel.';
 PERFORM suizamente_private.v7_notificar(a.victima,'asalto',aid::text,note,'/suizamente/mapa');
 PERFORM suizamente_private.v3_logros(actor);PERFORM suizamente_private.v3_logros(a.victima);
END $$;

CREATE OR REPLACE FUNCTION suizamente_private.v17_responder(aid uuid,actor text,choice integer,automatic boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a suizamente_private.suizamente_asaltos;b suizamente_private.suizamente_asaltos;expired boolean;ok boolean;
BEGIN
 SELECT * INTO a FROM suizamente_private.suizamente_asaltos WHERE id=aid AND jugador_id=actor FOR UPDATE;
 IF a.estado IS DISTINCT FROM 'pregunta' OR a.tipo<>'victoria' THEN RAISE EXCEPTION 'SZV2:409:Esta pregunta ya no admite respuestas';END IF;
 expired:=clock_timestamp()>a.vence_en+make_interval(secs=>(a.reglas#>>'{partida,margenServidorSegundos}')::integer);
 IF automatic AND NOT expired THEN RAISE EXCEPTION 'SZV2:409:El tiempo sigue corriendo';END IF;
 IF NOT expired AND (choice IS NULL OR choice<0 OR choice>=jsonb_array_length(a.payload->'opciones')) THEN RAISE EXCEPTION 'SZV2:400:Elige una opción válida';END IF;
 IF NOT expired AND (choice=ANY(a.quitadas) OR choice=ANY(a.intentos)) THEN RAISE EXCEPTION 'SZV2:409:Esa opción ya no está disponible';END IF;
 ok:=NOT expired AND choice=(a.payload->>'correcta')::integer;
 IF NOT ok THEN
  -- Existing retry powerup and timeout handling; a failure never settles an attack.
  PERFORM suizamente_private.v5_asalto_responder(aid,actor,choice,automatic);
 ELSE
  INSERT INTO suizamente_private.suizamente_votos(pregunta_id,jugador_id,opcion) VALUES(a.payload->>'id',actor,choice) ON CONFLICT DO NOTHING;
  PERFORM suizamente_private.v3_actividad(actor,clock_timestamp());
  UPDATE suizamente_private.suizamente_asaltos SET estado=CASE WHEN pregunta_numero=preguntas_total THEN 'resolviendo' ELSE 'entre_preguntas' END,opcion=choice,acierto=true,respondida_en=clock_timestamp(),version=version+1 WHERE id=aid;
 END IF;
 SELECT * INTO b FROM suizamente_private.suizamente_asaltos WHERE id=aid;
 IF b.respondida_en IS NOT NULL THEN
  UPDATE suizamente_private.suizamente_asaltos SET aciertos=aciertos+CASE WHEN b.acierto THEN 1 ELSE 0 END,
   historial=historial||jsonb_build_array(jsonb_build_object('n',a.pregunta_numero,'payload',a.payload,'orden',a.orden,'opcion',b.opcion,'acierto',b.acierto,'agotada',b.agotada,'enviadaEn',a.enviada_en,'respondidaEn',b.respondida_en)) WHERE id=aid;
 END IF;
 IF ok AND a.pregunta_numero=a.preguntas_total THEN PERFORM suizamente_private.v17_liquidar(aid,actor);END IF;
END $$;

CREATE OR REPLACE FUNCTION suizamente_private.v17_ver(aid uuid,actor text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a suizamente_private.suizamente_asaltos;result jsonb;
BEGIN
 SELECT * INTO a FROM suizamente_private.suizamente_asaltos WHERE id=aid AND jugador_id=actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'SZV2:404:Asalto no encontrado';END IF;
 IF a.tipo='victoria' AND a.estado='pregunta' AND clock_timestamp()>a.vence_en+make_interval(secs=>(a.reglas#>>'{partida,margenServidorSegundos}')::integer) THEN
  PERFORM suizamente_private.v17_responder(aid,actor,NULL,true);
 END IF;
 result:=suizamente_private.v5_asalto_ver(aid,actor);
 SELECT * INTO a FROM suizamente_private.suizamente_asaltos WHERE id=aid;
 result:=result||jsonb_build_object('tipo',a.tipo,'preguntasTotal',a.preguntas_total,'preguntaNumero',a.pregunta_numero,'aciertos',a.aciertos);
 IF result->'pregunta'<>'null'::jsonb THEN result:=jsonb_set(result,'{pregunta,n}',to_jsonb(a.pregunta_numero));END IF;
 IF result->'resultado'<>'null'::jsonb THEN result:=jsonb_set(result,'{resultado,n}',to_jsonb(a.pregunta_numero));END IF;
 RETURN result;
END $$;

DO $$ BEGIN
 IF to_regprocedure('suizamente_private.v17_api_base(text,jsonb,uuid,text)') IS NULL THEN
  ALTER FUNCTION public.suizamente_v2(text,jsonb,uuid,text) SET SCHEMA suizamente_private;
  ALTER FUNCTION suizamente_private.suizamente_v2(text,jsonb,uuid,text) RENAME TO v17_api_base;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.suizamente_v2(p_action text,p_args jsonb DEFAULT '{}',p_guest_id uuid DEFAULT NULL,p_guest_token text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor text:=auth.uid()::text;data jsonb;objectives jsonb;a suizamente_private.suizamente_asaltos;target text;mid uuid;aid uuid;v integer;r integer;lvl integer;c jsonb;identity jsonb;
BEGIN
 IF p_action NOT IN('ataque_objetivos','atacar','asalto','asalto_empezar','asalto_siguiente','asalto_respuesta','asalto_comodin','asalto_descartar') THEN
  data:=suizamente_private.v17_api_base(p_action,p_args,p_guest_id,p_guest_token);
  IF p_action='config' THEN data:=data||jsonb_build_object('apiVersion',17);END IF;
  RETURN data;
 END IF;
 IF actor IS NULL THEN RAISE EXCEPTION 'SZV2:401:Entra con tu cuenta para jugar';END IF;
 IF p_action IN('ataque_objetivos','atacar') THEN
  mid:=(p_args->>'id')::uuid;
  SELECT CASE WHEN actor=jugador_a THEN jugador_b ELSE jugador_a END INTO target FROM suizamente_private.suizamente_partidas WHERE id=mid AND actor IN(jugador_a,jugador_b);
 ELSE
  SELECT * INTO a FROM suizamente_private.suizamente_asaltos WHERE id=(p_args->>'id')::uuid AND jugador_id=actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'SZV2:404:Asalto no encontrado';END IF;
  target:=a.victima;
 END IF;
 -- Deterministic lock order, including two simultaneous attacks in opposite directions.
 PERFORM 1 FROM suizamente_private.suizamente_jugadores WHERE jugador_id IN(actor,target) ORDER BY jugador_id FOR UPDATE;
 identity:=suizamente_private.v17_api_base('jugador','{}',p_guest_id,p_guest_token);
 IF identity->'jugador'='null'::jsonb THEN RAISE EXCEPTION 'SZV2:404:Crea primero tu perfil';END IF;
 IF EXISTS(SELECT 1 FROM suizamente_private.suizamente_jugadores WHERE jugador_id=actor AND (bloqueado OR renombrar)) THEN RAISE EXCEPTION 'SZV2:403:Revisa el estado de tu perfil';END IF;
 IF p_action IN('ataque_objetivos','atacar') THEN
  PERFORM 1 FROM suizamente_private.suizamente_partidas WHERE id=mid FOR UPDATE;
  objectives:=suizamente_private.v17_objetivos(mid,actor);
  IF p_action='ataque_objetivos' THEN RETURN objectives;END IF;
  IF objectives->>'ataqueId' IS NOT NULL THEN RETURN suizamente_private.v3_enriquecer(suizamente_private.v17_ver((objectives->>'ataqueId')::uuid,actor),actor);END IF;
  IF (objectives->>'limiteAlcanzado')::boolean THEN RAISE EXCEPTION 'SZV2:409:Ya has alcanzado el límite de asaltos de hoy';END IF;
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(objectives->'cantones') k WHERE k->>'id'=p_args->>'canton' AND (k->>'disponible')::boolean) THEN RAISE EXCEPTION 'SZV2:409:Elige un cantón disponible';END IF;
  c:=suizamente_private.v2_config();v:=(objectives#>>'{mapa,vuelta}')::integer;r:=(objectives#>>'{mapa,region}')::integer;
  SELECT nivel INTO lvl FROM suizamente_private.suizamente_mapa WHERE jugador_id=target AND vuelta=v AND canton=p_args->>'canton' FOR UPDATE;
  INSERT INTO suizamente_private.suizamente_asaltos(jugador_id,victima,partida_id,pregunta_origen,fecha,region,canton,nivel_inicial,reglas,tipo,preguntas_total,vuelta_victima)
   VALUES(actor,target,mid,-1,suizamente_private.v7_hoy(),r,p_args->>'canton',lvl,c,'victoria',(c#>>'{asaltos,preguntasTrasVictoria}')::integer,v) RETURNING id INTO aid;
  PERFORM suizamente_private.v17_preguntar(aid,actor);
 ELSE
  IF a.tipo<>'victoria' THEN RETURN suizamente_private.v17_api_base(p_action,p_args,p_guest_id,p_guest_token);END IF;
  SELECT * INTO a FROM suizamente_private.suizamente_asaltos WHERE id=a.id FOR UPDATE;
  IF p_action<>'asalto' AND (p_args->>'turnoN')::integer IS DISTINCT FROM a.version THEN RAISE EXCEPTION 'SZV2:409:El asalto ha cambiado. Actualízalo';END IF;
  aid:=a.id;
  IF p_action='asalto_siguiente' THEN PERFORM suizamente_private.v17_preguntar(aid,actor);
  ELSIF p_action='asalto_respuesta' THEN
   IF (p_args->>'n')::integer IS DISTINCT FROM a.pregunta_numero THEN RAISE EXCEPTION 'SZV2:409:La pregunta ha cambiado';END IF;
   PERFORM suizamente_private.v17_responder(aid,actor,(p_args->>'opcion')::integer,coalesce((p_args->>'agotada')::boolean,false));
  ELSIF p_action='asalto_comodin' THEN
   PERFORM suizamente_private.v5_accion(p_action,actor,p_args);
  ELSIF p_action<>'asalto' THEN RAISE EXCEPTION 'SZV2:409:Este ataque ya está empezado';END IF;
 END IF;
 data:=suizamente_private.v17_ver(aid,actor);
 IF data->'resultado'<>'null'::jsonb THEN
  data:=jsonb_set(data,'{resultado,preguntaId}',(SELECT payload->'id' FROM suizamente_private.suizamente_asaltos WHERE id=aid));
 END IF;
 RETURN suizamente_private.v3_enriquecer(data,actor);
END $$;
DO $$ DECLARE r record;BEGIN
 FOR r IN SELECT p.oid::regprocedure sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='suizamente_private' AND p.proname LIKE 'v17_%' LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION '||r.sig||' FROM PUBLIC,anon,authenticated';
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION suizamente_private.v5_ofrecer(uuid,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
