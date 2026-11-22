-- Keep development game notices out of Latido and the existing game's inbox.
CREATE OR REPLACE FUNCTION suizamente_conquista.notificar(p_jugador text,p_ref text,p_titulo text,p_texto text,p_href text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 INSERT INTO suizamente_conquista.avisos(usuario,referencia,titulo,texto,href)
 SELECT usuario_id,p_ref,p_titulo,p_texto,regexp_replace(p_href,'^/suizamente','') FROM suizamente_social.jugadores
 WHERE id=p_jugador AND usuario_id IS NOT NULL AND coalesce((ajustes->>'avisos')::boolean,true)
 ON CONFLICT(usuario,referencia) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION suizamente_conquista.saldo(p_usuario uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE xp integer;b suizamente_conquista.billeteras; diferencia integer;
BEGIN
 INSERT INTO suizamente_conquista.billeteras(usuario) VALUES(p_usuario) ON CONFLICT DO NOTHING;
 SELECT * INTO b FROM suizamente_conquista.billeteras WHERE usuario=p_usuario FOR UPDATE;
 SELECT coalesce(sum(cantidad),0)::integer INTO xp FROM suizamente_social.puntos WHERE jugador='user:'||p_usuario;
 diferencia:=greatest(0,xp-b.xp_acreditada);
 IF diferencia>0 THEN
   UPDATE suizamente_conquista.billeteras SET saldo=saldo+diferencia,xp_acreditada=xp WHERE usuario=p_usuario;
   INSERT INTO suizamente_conquista.movimientos(usuario,cantidad,concepto,referencia) VALUES(p_usuario,diferencia,'xp',xp::text) ON CONFLICT DO NOTHING;
 END IF;
 RETURN b.saldo+diferencia;
END $$;

CREATE OR REPLACE FUNCTION suizamente_conquista.mover(p_usuario uuid,p_cantidad integer,p_concepto text,p_ref text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 INSERT INTO suizamente_conquista.movimientos(usuario,cantidad,concepto,referencia) VALUES(p_usuario,p_cantidad,p_concepto,p_ref) ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RETURN;END IF;
 UPDATE suizamente_conquista.billeteras SET saldo=saldo+p_cantidad WHERE usuario=p_usuario AND saldo+p_cantidad>=0;
 IF NOT FOUND THEN RAISE SQLSTATE 'PT409' USING MESSAGE='No tienes suficientes puntos disponibles.';END IF;
END $$;

CREATE OR REPLACE FUNCTION suizamente_conquista.equipar(p_usuario uuid,p_ventajas text[],p_consumir boolean DEFAULT true) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v text;
BEGIN
 IF cardinality(p_ventajas)>2 OR cardinality(p_ventajas)<>(SELECT count(DISTINCT x) FROM unnest(p_ventajas) x) THEN
   RAISE SQLSTATE 'PT400' USING MESSAGE='Elige un máximo de dos ventajas diferentes.';
 END IF;
 FOREACH v IN ARRAY p_ventajas LOOP
   IF NOT EXISTS(SELECT 1 FROM suizamente_conquista.ventajas WHERE codigo=v) THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Ventaja no válida.';END IF;
   PERFORM 1 FROM suizamente_conquista.inventario WHERE usuario=p_usuario AND ventaja=v AND cantidad>0 FOR UPDATE;
   IF NOT FOUND THEN RAISE SQLSTATE 'PT409' USING MESSAGE='No tienes alguna de las ventajas elegidas. Visita la tienda.';END IF;
   IF p_consumir THEN UPDATE suizamente_conquista.inventario SET cantidad=cantidad-1 WHERE usuario=p_usuario AND ventaja=v;END IF;
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION suizamente_conquista.conquistar(p_usuario uuid,p_canton text,p_tipo text,p_ref text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE n integer;hito integer;
BEGIN
 INSERT INTO suizamente_conquista.historial(usuario,canton,tipo,referencia) VALUES(p_usuario,p_canton,p_tipo,p_ref) ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RETURN;END IF;
 INSERT INTO suizamente_conquista.territorios(usuario,canton) VALUES(p_usuario,p_canton)
 ON CONFLICT(usuario,canton) DO UPDATE SET poseido=true,conquistado_en=now(),veces=suizamente_conquista.territorios.veces+1;
 SELECT count(DISTINCT canton) INTO n FROM suizamente_conquista.historial WHERE usuario=p_usuario AND tipo IN('conquista','batalla');
 FOREACH hito IN ARRAY ARRAY[5,10,20,26] LOOP
  IF n>=hito THEN INSERT INTO suizamente_conquista.historial(usuario,canton,tipo,referencia) VALUES(p_usuario,'CH','logro','cantones-'||hito) ON CONFLICT DO NOTHING;END IF;
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION suizamente_conquista.resolver(p_batalla uuid,p_caducada boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE b suizamente_conquista.batallas;a suizamente_conquista.partidas;d suizamente_conquista.partidas;v uuid;razon text;
BEGIN
 SELECT * INTO b FROM suizamente_conquista.batallas WHERE id=p_batalla FOR UPDATE;
 IF b.estado<>'activa' THEN RETURN;END IF;
 SELECT * INTO a FROM suizamente_conquista.partidas WHERE batalla=b.id AND usuario=b.atacante;
 SELECT * INTO d FROM suizamente_conquista.partidas WHERE batalla=b.id AND usuario=b.defensor;
 IF a.estado='terminada' AND d.estado='terminada' THEN
   IF a.aciertos>d.aciertos THEN v:=b.atacante;ELSIF d.aciertos>a.aciertos THEN v:=b.defensor;END IF;
   razon:=CASE WHEN v IS NULL THEN 'empate' ELSE 'aciertos' END;
 ELSIF p_caducada THEN
   IF a.estado='terminada' THEN v:=b.atacante;ELSIF d.estado='terminada' THEN v:=b.defensor;END IF;
   razon:=CASE WHEN v IS NULL THEN 'sin_finalizar' ELSE 'incomparecencia' END;
 ELSE RETURN;END IF;
 PERFORM 1 FROM suizamente_conquista.billeteras WHERE usuario IN(b.atacante,b.defensor) ORDER BY usuario FOR UPDATE;
 IF v=b.atacante THEN
   UPDATE suizamente_conquista.territorios SET poseido=false WHERE usuario=b.defensor AND canton=b.canton;
   INSERT INTO suizamente_conquista.historial(usuario,canton,tipo,referencia) VALUES(b.defensor,b.canton,'perdido',b.id::text) ON CONFLICT DO NOTHING;
   PERFORM suizamente_conquista.conquistar(b.atacante,b.canton,'batalla',b.id::text);
   PERFORM suizamente_conquista.mover(b.atacante,b.apuesta,'apuesta_devuelta',b.id::text);
 ELSIF v=b.defensor THEN
   UPDATE suizamente_conquista.territorios SET defensas=defensas+1,victorias=victorias+1 WHERE usuario=b.defensor AND canton=b.canton;
   INSERT INTO suizamente_conquista.historial(usuario,canton,tipo,referencia) VALUES(b.defensor,b.canton,'defensa',b.id::text) ON CONFLICT DO NOTHING;
   PERFORM suizamente_conquista.mover(b.defensor,b.apuesta,'defensa_ganada',b.id::text);
 ELSE
   PERFORM suizamente_conquista.mover(b.atacante,b.apuesta,'apuesta_devuelta',b.id::text);
 END IF;
 UPDATE suizamente_conquista.partidas SET estado='caducada',terminado_en=now() WHERE batalla=b.id AND estado='activa';
 UPDATE suizamente_conquista.batallas SET estado='terminada',ganador=v,motivo=razon,terminado_en=now() WHERE id=b.id;
 PERFORM suizamente_conquista.notificar('user:'||b.atacante,'conquista:resultado:'||b.id,'Batalla territorial terminada','Ya puedes ver el resultado y revisar tus respuestas.','/suizamente/conquista/batalla/'||b.id);
 PERFORM suizamente_conquista.notificar('user:'||b.defensor,'conquista:resultado:'||b.id,'Batalla territorial terminada','Ya puedes ver el resultado y revisar tus respuestas.','/suizamente/conquista/batalla/'||b.id);
END $$;

CREATE OR REPLACE FUNCTION suizamente_conquista.ver_partida(p_id uuid,p_usuario uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE p suizamente_conquista.partidas;q suizamente_conquista.preguntas;actual text;detalle jsonb;respondidas integer;revelar boolean;
BEGIN
 SELECT * INTO p FROM suizamente_conquista.partidas WHERE id=p_id AND usuario=p_usuario;
 IF NOT FOUND THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Partida no encontrada.';END IF;
 SELECT count(*) INTO respondidas FROM jsonb_object_keys(p.respuestas);
 revelar:=p.batalla IS NULL OR EXISTS(SELECT 1 FROM suizamente_conquista.batallas WHERE id=p.batalla AND estado='terminada');
 actual:=p.preguntas[respondidas+1];
 IF p.estado='activa' AND actual IS NOT NULL THEN
   SELECT * INTO q FROM suizamente_conquista.preguntas WHERE id=actual;
   detalle:=jsonb_build_object('id',q.id,'texto',q.pregunta,'opciones',q.opciones,
     'descartadas',CASE WHEN p.usadas->'cincuenta'->>'pregunta'=actual THEN p.usadas->'cincuenta'->'descartadas' ELSE '[]'::jsonb END,
     'reintento',p.usadas->'segunda'->>'pregunta'=actual AND NOT(p.respuestas?actual),
     'primera',CASE WHEN p.usadas->'segunda'->>'pregunta'=actual THEN p.usadas->'segunda'->'primera' ELSE NULL END);
 ELSIF revelar THEN
   SELECT coalesce(jsonb_agg(jsonb_build_object('id',fila.id,'texto',fila.pregunta,'opciones',fila.opciones,'correcta',fila.correcta,
       'respuesta',p.respuestas->fila.id,'explicacion',fila.explicacion,'fuente',fila.fuente,'revisada',fila.revisada) ORDER BY array_position(p.preguntas,fila.id)),'[]') INTO detalle
   FROM suizamente_conquista.preguntas fila WHERE fila.id=ANY(p.preguntas) AND p.respuestas?fila.id;
 END IF;
 RETURN jsonb_build_object('id',p.id,'canton',p.canton,'batalla',p.batalla,'estado',p.estado,'cantidad',cardinality(p.preguntas),
   'respondidas',respondidas,'aciertos',CASE WHEN p.estado<>'activa' THEN p.aciertos ELSE NULL END,
   'ventajas',p.ventajas,'usadas',p.usadas,'venceEn',p.vence_en,
   'pregunta',CASE WHEN p.estado='activa' THEN detalle ELSE NULL END,'revision',CASE WHEN p.estado<>'activa' AND revelar THEN detalle ELSE NULL END);
END $$;

CREATE OR REPLACE FUNCTION suizamente_conquista.ver_batalla(p_id uuid,p_usuario uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE b suizamente_conquista.batallas;propia suizamente_conquista.partidas;otra suizamente_conquista.partidas;datos jsonb;
BEGIN
 SELECT * INTO b FROM suizamente_conquista.batallas WHERE id=p_id AND p_usuario IN(atacante,defensor);
 IF NOT FOUND THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Batalla no encontrada.';END IF;
 SELECT * INTO propia FROM suizamente_conquista.partidas WHERE batalla=b.id AND usuario=p_usuario;
 SELECT * INTO otra FROM suizamente_conquista.partidas WHERE batalla=b.id AND usuario<>p_usuario;
 SELECT jsonb_build_object('atacante',jsonb_build_object('id',a.usuario_id,'apodo',a.apodo),'defensor',jsonb_build_object('id',d.usuario_id,'apodo',d.apodo)) INTO datos
 FROM suizamente_social.jugadores a,suizamente_social.jugadores d WHERE a.usuario_id=b.atacante AND d.usuario_id=b.defensor;
 RETURN datos||jsonb_build_object('id',b.id,'canton',b.canton,'estado',b.estado,'apuesta',b.apuesta,'ganador',b.ganador,'motivo',b.motivo,
  'venceEn',b.vence_en,'ventajasAtacante',b.ventajas_atacante,'ventajasDefensor',b.ventajas_defensor,
  'soyAtacante',b.atacante=p_usuario,'partida',propia.id,'miEstado',propia.estado,
  'misAciertos',CASE WHEN b.estado='terminada' THEN propia.aciertos ELSE NULL END,
  'susAciertos',CASE WHEN b.estado='terminada' THEN otra.aciertos ELSE NULL END);
END $$;

CREATE OR REPLACE FUNCTION suizamente_conquista.resumen(p_usuario uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE b suizamente_conquista.billeteras;territorios jsonb;historial jsonb;inventario jsonb;batallas jsonb;amigos jsonb;catalogo jsonb;activas jsonb;
BEGIN
 SELECT * INTO b FROM suizamente_conquista.billeteras WHERE usuario=p_usuario;
 SELECT jsonb_agg(jsonb_build_object('codigo',c.codigo,'nombre',n.nombre,'nivel',c.nivel,'coste',c.coste,'cantidad',c.cantidad,
  'poseido',coalesce(t.poseido,false),'perdido',t.poseido=false,'fecha',t.conquistado_en,'veces',coalesce(t.veces,0),'defensas',coalesce(t.defensas,0),
  'enDisputa',EXISTS(SELECT 1 FROM suizamente_conquista.batallas x WHERE p_usuario IN(x.atacante,x.defensor) AND x.canton=c.codigo AND x.estado IN('pendiente','activa')),
  'batalla',(SELECT x.id FROM suizamente_conquista.batallas x WHERE p_usuario IN(x.atacante,x.defensor) AND x.canton=c.codigo AND x.estado IN('pendiente','activa') ORDER BY creado_en LIMIT 1),
  'preguntasDisponibles',(SELECT count(*) FROM suizamente_conquista.preguntas q WHERE q.canton=c.codigo AND q.activa)) ORDER BY n.nombre) INTO territorios
 FROM suizamente_conquista.cantones c JOIN suizamente_social.cantones n USING(codigo) LEFT JOIN suizamente_conquista.territorios t ON t.canton=c.codigo AND t.usuario=p_usuario;
 SELECT coalesce(jsonb_agg(x ORDER BY x.creado_en DESC),'[]') INTO historial FROM (SELECT canton,tipo,creado_en FROM suizamente_conquista.historial WHERE usuario=p_usuario ORDER BY creado_en DESC LIMIT 100) x;
 SELECT coalesce(jsonb_object_agg(ventaja,cantidad),'{}') INTO inventario FROM suizamente_conquista.inventario WHERE usuario=p_usuario;
 SELECT coalesce(jsonb_agg(suizamente_conquista.ver_batalla(id,p_usuario) ORDER BY creado_en DESC),'[]') INTO batallas FROM (SELECT * FROM suizamente_conquista.batallas WHERE p_usuario IN(atacante,defensor) ORDER BY creado_en DESC LIMIT 50) x;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',g.usuario_id,'apodo',g.apodo,'disponible',coalesce(w.competitivo,false),'cantones',coalesce((SELECT jsonb_agg(canton) FROM suizamente_conquista.territorios WHERE usuario=g.usuario_id AND poseido),'[]')) ORDER BY g.apodo),'[]') INTO amigos
 FROM suizamente_social.amistades a JOIN suizamente_social.jugadores g ON g.id=CASE WHEN a.solicitante='user:'||p_usuario THEN a.destinatario ELSE a.solicitante END
 LEFT JOIN suizamente_conquista.billeteras w ON w.usuario=g.usuario_id WHERE a.estado='aceptada' AND 'user:'||p_usuario IN(a.solicitante,a.destinatario);
 SELECT jsonb_agg(to_jsonb(v) ORDER BY precio) INTO catalogo FROM suizamente_conquista.ventajas v;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'canton',canton,'batalla',batalla,'venceEn',vence_en) ORDER BY creado_en),'[]') INTO activas FROM suizamente_conquista.partidas WHERE usuario=p_usuario AND estado='activa';
 RETURN jsonb_build_object('saldo',b.saldo,'xp',b.xp_acreditada,'competitivo',b.competitivo,'cantones',coalesce(territorios,'[]'),
 'inventario',inventario,'catalogo',catalogo,'historial',historial,'batallas',batallas,'amigos',amigos,'activas',activas,
 'avisos',coalesce((SELECT jsonb_agg(x ORDER BY x.creado_en DESC) FROM (SELECT id,titulo,texto,href,creado_en,leido FROM suizamente_conquista.avisos WHERE usuario=p_usuario ORDER BY creado_en DESC LIMIT 30) x),'[]'::jsonb),
 'sinLeer',(SELECT count(*) FROM suizamente_conquista.avisos WHERE usuario=p_usuario AND NOT leido),
 'logros',coalesce((SELECT jsonb_agg(replace(referencia,'cantones-','')::integer) FROM suizamente_conquista.historial WHERE usuario=p_usuario AND tipo='logro'),'[]'::jsonb),
 'historicas',(SELECT count(*) FROM suizamente_conquista.historial WHERE usuario=p_usuario AND tipo IN('conquista','batalla')),
 'conquistados',(SELECT count(*) FROM suizamente_conquista.territorios WHERE usuario=p_usuario AND poseido));
END $$;
