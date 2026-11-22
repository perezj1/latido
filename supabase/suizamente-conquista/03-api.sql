CREATE OR REPLACE FUNCTION public.suizamente_conquista_api(p_usuario uuid,p_accion text,p_datos jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
 actor text:='user:'||p_usuario;resultado jsonb;anterior suizamente_conquista.solicitudes;
 solicitud uuid;identificador uuid;otro uuid;seleccionadas text[];ids text[];actual text;opcion integer;
 p suizamente_conquista.partidas;b suizamente_conquista.batallas;c suizamente_conquista.cantones;
 q suizamente_conquista.preguntas;v suizamente_conquista.ventajas;respuesta jsonb;nuevo_uso jsonb;
 punto integer;total integer;descartadas jsonb;item record;mutacion boolean;
BEGIN
 IF p_usuario IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_usuario) OR EXISTS(SELECT 1 FROM public.profiles WHERE id=p_usuario AND coalesce(banned,false)) THEN
   RAISE SQLSTATE 'PT401' USING MESSAGE='Entra con tu cuenta para jugar a Conquista.';
 END IF;
 IF jsonb_typeof(p_datos)<>'object' OR octet_length(p_datos::text)>8192 THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Solicitud no válida.';END IF;
 IF NOT EXISTS(SELECT 1 FROM suizamente_social.jugadores WHERE usuario_id=p_usuario) THEN
   PERFORM public.suizamente_social_api('bootstrap',actor,'{}','conquista-bootstrap');
 END IF;
 INSERT INTO suizamente_conquista.billeteras(usuario) VALUES(p_usuario) ON CONFLICT DO NOTHING;
 -- Lock every affected account in one order before touching an escrow or wallet.
 IF p_datos?'defensor' THEN BEGIN otro:=(p_datos->>'defensor')::uuid;EXCEPTION WHEN invalid_text_representation THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Elige un amigo.';END;END IF;
 PERFORM 1 FROM suizamente_conquista.billeteras WHERE usuario=p_usuario OR usuario=otro OR usuario IN(
   SELECT atacante FROM suizamente_conquista.batallas WHERE p_usuario IN(atacante,defensor) AND estado IN('pendiente','activa')
   UNION SELECT defensor FROM suizamente_conquista.batallas WHERE p_usuario IN(atacante,defensor) AND estado IN('pendiente','activa')
 ) ORDER BY usuario FOR UPDATE;
 PERFORM suizamente_conquista.saldo(p_usuario);
 INSERT INTO suizamente_conquista.limites(usuario) VALUES(p_usuario)
 ON CONFLICT(usuario) DO UPDATE SET cantidad=CASE WHEN suizamente_conquista.limites.ventana<now()-interval '1 minute' THEN 1 ELSE suizamente_conquista.limites.cantidad+1 END,
 ventana=CASE WHEN suizamente_conquista.limites.ventana<now()-interval '1 minute' THEN now() ELSE suizamente_conquista.limites.ventana END;
 IF (SELECT cantidad FROM suizamente_conquista.limites WHERE usuario=p_usuario)>120 THEN RAISE SQLSTATE 'PT429' USING MESSAGE='Espera un momento antes de continuar.';END IF;
 FOR item IN SELECT id,estado FROM suizamente_conquista.batallas WHERE p_usuario IN(atacante,defensor) AND estado IN('pendiente','activa') AND vence_en<=now() FOR UPDATE LOOP
   IF item.estado='pendiente' THEN UPDATE suizamente_conquista.batallas SET estado='caducada',terminado_en=now() WHERE id=item.id;
   ELSE PERFORM suizamente_conquista.resolver(item.id,true);END IF;
 END LOOP;
 UPDATE suizamente_conquista.partidas SET estado='caducada',terminado_en=now() WHERE usuario=p_usuario AND batalla IS NULL AND estado='activa' AND vence_en<=now();
 mutacion:=p_accion IN('comprar','preferencias','iniciar','responder','ventaja','desafiar','aceptar','rechazar','abandonar','avisos_leer');
 IF mutacion THEN
   BEGIN solicitud:=(p_datos->>'solicitud')::uuid;EXCEPTION WHEN invalid_text_representation THEN solicitud:=NULL;END;
   IF solicitud IS NULL THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Vuelve a abrir esta pantalla para continuar.';END IF;
   SELECT * INTO anterior FROM suizamente_conquista.solicitudes WHERE usuario=p_usuario AND id=solicitud;
   IF FOUND THEN
     IF anterior.accion<>p_accion OR anterior.datos<>p_datos THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Esta solicitud ya se utilizó.';END IF;
     RETURN anterior.resultado;
   END IF;
 END IF;
 IF p_accion='estado' THEN resultado:=suizamente_conquista.resumen(p_usuario);
 ELSIF p_accion='avisos_leer' THEN
   UPDATE suizamente_conquista.avisos SET leido=true WHERE usuario=p_usuario AND NOT leido;
   resultado:=suizamente_conquista.resumen(p_usuario);
 ELSIF p_accion='preferencias' THEN
   IF jsonb_typeof(p_datos->'competitivo') IS DISTINCT FROM 'boolean' THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Elige si quieres recibir batallas.';END IF;
   UPDATE suizamente_conquista.billeteras SET competitivo=(p_datos->>'competitivo')::boolean WHERE usuario=p_usuario;
   IF NOT(p_datos->>'competitivo')::boolean THEN UPDATE suizamente_conquista.batallas SET estado='rechazada',terminado_en=now() WHERE p_usuario IN(atacante,defensor) AND estado='pendiente';END IF;
   resultado:=suizamente_conquista.resumen(p_usuario);
 ELSIF p_accion='comprar' THEN
   SELECT * INTO v FROM suizamente_conquista.ventajas WHERE codigo=p_datos->>'ventaja';
   IF NOT FOUND THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Ventaja no válida.';END IF;
   IF coalesce((SELECT cantidad FROM suizamente_conquista.inventario WHERE usuario=p_usuario AND ventaja=v.codigo),0)>=99 THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Ya tienes suficientes unidades de esta ventaja.';END IF;
   PERFORM suizamente_conquista.mover(p_usuario,-v.precio,'compra',solicitud::text);
   INSERT INTO suizamente_conquista.inventario(usuario,ventaja,cantidad) VALUES(p_usuario,v.codigo,1) ON CONFLICT(usuario,ventaja) DO UPDATE SET cantidad=suizamente_conquista.inventario.cantidad+1;
   resultado:=suizamente_conquista.resumen(p_usuario);
 ELSIF p_accion IN('iniciar','desafiar','aceptar') THEN
   IF p_datos?'ventajas' AND (jsonb_typeof(p_datos->'ventajas')<>'array' OR jsonb_array_length(p_datos->'ventajas')>2) THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Elige como máximo dos ventajas.';END IF;
   SELECT coalesce(array_agg(x),'{}') INTO seleccionadas FROM jsonb_array_elements_text(coalesce(p_datos->'ventajas','[]')) x;
   IF p_accion='iniciar' THEN
     SELECT * INTO c FROM suizamente_conquista.cantones WHERE codigo=p_datos->>'canton';
     IF NOT FOUND THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Cantón no encontrado.';END IF;
     IF EXISTS(SELECT 1 FROM suizamente_conquista.territorios WHERE usuario=p_usuario AND canton=c.codigo AND poseido) THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Este cantón ya es tuyo.';END IF;
     IF EXISTS(SELECT 1 FROM suizamente_conquista.batallas WHERE p_usuario IN(atacante,defensor) AND canton=c.codigo AND estado IN('pendiente','activa')) THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Resuelve primero la batalla que tienes por este cantón.';END IF;
     IF EXISTS(SELECT 1 FROM suizamente_conquista.partidas WHERE usuario=p_usuario AND batalla IS NULL AND estado='activa') THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Termina o abandona tu conquista en curso antes de empezar otra.';END IF;
     SELECT array_agg(id ORDER BY orden) INTO ids FROM (SELECT id,random() orden FROM suizamente_conquista.preguntas WHERE canton=c.codigo AND activa ORDER BY orden LIMIT c.cantidad) x;
     IF coalesce(cardinality(ids),0)<c.cantidad THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Este cantón está preparando sus preguntas. Prueba con otro.';END IF;
     PERFORM suizamente_conquista.equipar(p_usuario,seleccionadas);
     PERFORM suizamente_conquista.mover(p_usuario,-c.coste,'conquista',solicitud::text);
     INSERT INTO suizamente_conquista.partidas(usuario,canton,preguntas,ventajas) VALUES(p_usuario,c.codigo,ids,seleccionadas) RETURNING id INTO identificador;
     resultado:=suizamente_conquista.ver_partida(identificador,p_usuario);
   ELSIF p_accion='desafiar' THEN
     IF NOT coalesce((SELECT competitivo FROM suizamente_conquista.billeteras WHERE usuario=p_usuario),false) THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Activa las batallas entre amigos para participar.';END IF;
     IF otro IS NULL OR otro=p_usuario THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Elige un amigo para retarlo.';END IF;
     IF NOT EXISTS(SELECT 1 FROM suizamente_social.amistades WHERE estado='aceptada' AND actor IN(solicitante,destinatario) AND 'user:'||otro IN(solicitante,destinatario)) THEN RAISE SQLSTATE 'PT403' USING MESSAGE='Solo puedes disputar cantones con tus amigos.';END IF;
     IF NOT coalesce((SELECT competitivo FROM suizamente_conquista.billeteras WHERE usuario=otro),false) THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Tu amigo no tiene activadas las batallas.';END IF;
     IF NOT EXISTS(SELECT 1 FROM suizamente_conquista.territorios WHERE usuario=otro AND canton=p_datos->>'canton' AND poseido) OR EXISTS(SELECT 1 FROM suizamente_conquista.territorios WHERE usuario=p_usuario AND canton=p_datos->>'canton' AND poseido) THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Elige un cantón de tu amigo que aún no tengas.';END IF;
     IF (SELECT saldo FROM suizamente_conquista.billeteras WHERE usuario=p_usuario)<100 THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Necesitas 100 puntos disponibles para enviar este desafío.';END IF;
     PERFORM suizamente_conquista.equipar(p_usuario,seleccionadas,false);
     IF EXISTS(SELECT 1 FROM suizamente_conquista.batallas WHERE defensor=otro AND canton=p_datos->>'canton' AND estado IN('pendiente','activa')) THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Ese cantón ya tiene una batalla pendiente.';END IF;
     IF EXISTS(SELECT 1 FROM suizamente_conquista.batallas WHERE atacante=p_usuario AND canton=p_datos->>'canton' AND estado IN('pendiente','activa')) OR EXISTS(SELECT 1 FROM suizamente_conquista.partidas WHERE usuario=p_usuario AND canton=p_datos->>'canton' AND batalla IS NULL AND estado='activa') THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Ya tienes un desafío en curso por este cantón.';END IF;
     INSERT INTO suizamente_conquista.batallas(canton,atacante,defensor,ventajas_atacante) VALUES(p_datos->>'canton',p_usuario,otro,seleccionadas) RETURNING id INTO identificador;
     PERFORM suizamente_conquista.notificar('user:'||otro,'conquista:invitacion:'||identificador,'Te disputan un cantón',(SELECT apodo FROM suizamente_social.jugadores WHERE usuario_id=p_usuario)||' quiere disputar '||(SELECT nombre FROM suizamente_social.cantones WHERE codigo=p_datos->>'canton')||'.','/suizamente/conquista/batalla/'||identificador);
     resultado:=suizamente_conquista.ver_batalla(identificador,p_usuario);
   ELSE
     BEGIN identificador:=(p_datos->>'id')::uuid;EXCEPTION WHEN invalid_text_representation THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Batalla no encontrada.';END;
     SELECT * INTO b FROM suizamente_conquista.batallas WHERE id=identificador AND defensor=p_usuario FOR UPDATE;
     IF NOT FOUND THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Batalla no encontrada.';END IF;
     IF b.estado<>'pendiente' OR b.vence_en<=now() THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Esta invitación ya no está disponible.';END IF;
     IF NOT EXISTS(SELECT 1 FROM suizamente_conquista.territorios WHERE usuario=p_usuario AND canton=b.canton AND poseido) OR EXISTS(SELECT 1 FROM suizamente_conquista.territorios WHERE usuario=b.atacante AND canton=b.canton AND poseido) THEN RAISE SQLSTATE 'PT409' USING MESSAGE='La posesión del cantón ha cambiado. Crea un nuevo desafío.';END IF;
     IF NOT EXISTS(SELECT 1 FROM suizamente_social.amistades WHERE estado='aceptada' AND actor IN(solicitante,destinatario) AND 'user:'||b.atacante IN(solicitante,destinatario)) THEN RAISE SQLSTATE 'PT403' USING MESSAGE='Esta batalla requiere una amistad aceptada.';END IF;
     PERFORM suizamente_conquista.saldo(b.atacante);
     PERFORM suizamente_conquista.equipar(b.atacante,b.ventajas_atacante);
     PERFORM suizamente_conquista.equipar(p_usuario,seleccionadas);
     SELECT array_agg(id ORDER BY orden) INTO ids FROM (SELECT id,random() orden FROM suizamente_conquista.preguntas WHERE canton=b.canton AND activa ORDER BY orden LIMIT 10) x;
     IF coalesce(cardinality(ids),0)<10 THEN RAISE SQLSTATE 'PT409' USING MESSAGE='No hay suficientes preguntas para esta batalla.';END IF;
     PERFORM suizamente_conquista.mover(b.atacante,-b.apuesta,'apuesta_reservada',b.id::text);
     UPDATE suizamente_conquista.batallas SET estado='activa',aceptado_en=now(),vence_en=now()+interval '48 hours',preguntas=ids,ventajas_defensor=seleccionadas WHERE id=b.id;
     INSERT INTO suizamente_conquista.partidas(usuario,canton,batalla,preguntas,ventajas,vence_en) VALUES
      (b.atacante,b.canton,b.id,ids,b.ventajas_atacante,now()+interval '48 hours'),(b.defensor,b.canton,b.id,ids,seleccionadas,now()+interval '48 hours');
     PERFORM suizamente_conquista.notificar('user:'||b.atacante,'conquista:aceptada:'||b.id,'Tu batalla ha sido aceptada','Tienes 48 horas para completar tus diez preguntas.','/suizamente/conquista/batalla/'||b.id);
     resultado:=suizamente_conquista.ver_batalla(b.id,p_usuario);
   END IF;
 ELSIF p_accion IN('partida','responder','ventaja','abandonar') THEN
   BEGIN identificador:=(p_datos->>'id')::uuid;EXCEPTION WHEN invalid_text_representation THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Partida no encontrada.';END;
   SELECT * INTO p FROM suizamente_conquista.partidas WHERE id=identificador AND usuario=p_usuario FOR UPDATE;
   IF NOT FOUND THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Partida no encontrada.';END IF;
   IF p_accion='partida' THEN resultado:=suizamente_conquista.ver_partida(p.id,p_usuario);
   ELSE
     IF p.estado<>'activa' OR p.vence_en<=now() THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Esta partida ya ha terminado.';END IF;
     IF p_accion='abandonar' THEN
       IF p.batalla IS NOT NULL THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Las batallas aceptadas deben resolverse o esperar a su plazo.';END IF;
       UPDATE suizamente_conquista.partidas SET estado='fallida',terminado_en=now() WHERE id=p.id;
       resultado:=suizamente_conquista.ver_partida(p.id,p_usuario);
     ELSE
       SELECT count(*) INTO total FROM jsonb_object_keys(p.respuestas);
       actual:=p.preguntas[total+1];
       IF actual IS DISTINCT FROM p_datos->>'pregunta' THEN RAISE SQLSTATE 'PT409' USING MESSAGE='La pregunta ha cambiado. Vuelve a abrir tu partida.';END IF;
       SELECT * INTO q FROM suizamente_conquista.preguntas WHERE id=actual;
       nuevo_uso:=p.usadas;
       IF p_accion='ventaja' THEN
         IF p_datos->>'ventaja'<>'cincuenta' OR NOT('cincuenta'=ANY(p.ventajas)) OR nuevo_uso?'cincuenta' THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Esta ventaja no está disponible.';END IF;
         SELECT jsonb_agg(i) INTO descartadas FROM (SELECT i FROM generate_series(0,3) i WHERE i<>q.correcta ORDER BY random() LIMIT 2) x;
         nuevo_uso:=nuevo_uso||jsonb_build_object('cincuenta',jsonb_build_object('pregunta',actual,'descartadas',descartadas));
         UPDATE suizamente_conquista.partidas SET usadas=nuevo_uso WHERE id=p.id;
       ELSE
         IF jsonb_typeof(p_datos->'opcion') IS DISTINCT FROM 'number' OR (p_datos->>'opcion') !~ '^[0-3]$' THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Elige una de las cuatro respuestas.';END IF;
         opcion:=(p_datos->>'opcion')::integer;
         IF (nuevo_uso->'cincuenta'->>'pregunta'=actual AND (nuevo_uso->'cincuenta'->'descartadas')@>to_jsonb(ARRAY[opcion])) OR (nuevo_uso->'segunda'->>'pregunta'=actual AND opcion=(nuevo_uso->'segunda'->>'primera')::integer) THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Elige otra respuesta.';END IF;
         punto:=CASE WHEN opcion=q.correcta THEN 1 ELSE 0 END;
         IF punto=0 AND 'segunda'=ANY(p.ventajas) AND NOT(nuevo_uso?'segunda') THEN
           nuevo_uso:=nuevo_uso||jsonb_build_object('segunda',jsonb_build_object('pregunta',actual,'primera',opcion));
           UPDATE suizamente_conquista.partidas SET usadas=nuevo_uso WHERE id=p.id;
         ELSE
           IF punto=0 AND 'escudo'=ANY(p.ventajas) AND NOT(nuevo_uso?'escudo') THEN punto:=1;nuevo_uso:=nuevo_uso||jsonb_build_object('escudo',jsonb_build_object('pregunta',actual));END IF;
           respuesta:=jsonb_build_object('opcion',opcion,'punto',punto,'correcta',opcion=q.correcta);
           UPDATE suizamente_conquista.partidas SET respuestas=respuestas||jsonb_build_object(actual,respuesta),usadas=nuevo_uso,aciertos=aciertos+punto WHERE id=p.id;
           IF total+1=cardinality(p.preguntas) THEN
             UPDATE suizamente_conquista.partidas SET estado=CASE WHEN batalla IS NOT NULL THEN 'terminada' WHEN aciertos=cardinality(preguntas) THEN 'ganada' ELSE 'fallida' END,terminado_en=now() WHERE id=p.id RETURNING * INTO p;
             IF p.batalla IS NOT NULL THEN PERFORM suizamente_conquista.resolver(p.batalla);
             ELSIF p.estado='ganada' THEN PERFORM suizamente_conquista.conquistar(p_usuario,p.canton,'conquista',p.id::text);END IF;
           END IF;
         END IF;
       END IF;
       resultado:=suizamente_conquista.ver_partida(p.id,p_usuario);
     END IF;
   END IF;
 ELSIF p_accion IN('batalla','rechazar') THEN
   BEGIN identificador:=(p_datos->>'id')::uuid;EXCEPTION WHEN invalid_text_representation THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Batalla no encontrada.';END;
   IF p_accion='rechazar' THEN
     UPDATE suizamente_conquista.batallas SET estado='rechazada',terminado_en=now() WHERE id=identificador AND p_usuario IN(atacante,defensor) AND estado='pendiente';
     IF NOT FOUND THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Esta batalla ya no se puede cancelar.';END IF;
   END IF;
   resultado:=suizamente_conquista.ver_batalla(identificador,p_usuario);
 ELSE RAISE SQLSTATE 'PT404' USING MESSAGE='Acción no encontrada.';END IF;
 IF mutacion THEN INSERT INTO suizamente_conquista.solicitudes(usuario,id,accion,datos,resultado) VALUES(p_usuario,solicitud,p_accion,p_datos,resultado);END IF;
 RETURN resultado;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA suizamente_conquista FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.suizamente_conquista_api(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.suizamente_conquista_api(uuid,text,jsonb) TO service_role;
