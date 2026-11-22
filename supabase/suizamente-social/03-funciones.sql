BEGIN;
CREATE OR REPLACE FUNCTION suizamente_social.hoy() RETURNS date
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$ SELECT (now() AT TIME ZONE 'Europe/Zurich')::date $$;

CREATE OR REPLACE FUNCTION suizamente_social.notificar(p_jugador text,p_ref text,p_titulo text,p_texto text,p_href text)
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public,suizamente_social AS $$
BEGIN
  IF p_jugador LIKE 'user:%' AND EXISTS(SELECT 1 FROM suizamente_social.jugadores WHERE id=p_jugador
    AND coalesce((ajustes->>'avisos')::boolean,true)) THEN
    INSERT INTO public.app_notifications(recipient_id,kind,source_id,data)
      VALUES(substring(p_jugador FROM 6)::uuid,'suizamente',p_ref,
        jsonb_build_object('title',p_titulo,'body',p_texto,'href',p_href,'icon','🎲')) ON CONFLICT DO NOTHING;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION suizamente_social.sumar(p_jugador text,p_motivo text,p_ref text,p_puntos integer,p_canton text,p_fecha timestamptz DEFAULT now())
RETURNS void LANGUAGE sql SET search_path=pg_catalog,public,suizamente_social AS $$
  INSERT INTO suizamente_social.puntos VALUES(p_jugador,p_motivo,p_ref,p_puntos,p_canton,p_fecha)
  ON CONFLICT DO NOTHING
$$;

CREATE OR REPLACE FUNCTION suizamente_social.registrar(p_jugador text,p_pregunta text,p_opcion integer,p_fecha timestamptz DEFAULT now())
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public,suizamente_social AS $$
DECLARE q suizamente_social.preguntas; j suizamente_social.jugadores; n integer; racha integer; acierto boolean;
BEGIN
  SELECT * INTO j FROM suizamente_social.jugadores WHERE id=p_jugador FOR UPDATE;
  SELECT * INTO q FROM suizamente_social.preguntas WHERE id=p_pregunta;
  IF q.id IS NULL OR p_opcion<0 OR p_opcion>=q.opciones THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Opción no válida'; END IF;
  acierto:=CASE WHEN q.tipo='real' THEN p_opcion=q.correcta END;
  INSERT INTO suizamente_social.respuestas VALUES(p_jugador,p_pregunta,p_opcion,acierto,j.canton,p_fecha)
    ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n=0 THEN RETURN; END IF;
  IF q.tipo='dilema' THEN PERFORM suizamente_social.sumar(p_jugador,'respuesta',p_pregunta,5,j.canton,p_fecha);
  ELSIF acierto THEN
    racha:=CASE WHEN j.ultimo_acierto>=p_fecha-interval '30 minutes' THEN j.aciertos_seguidos+1 ELSE 1 END;
    UPDATE suizamente_social.jugadores SET aciertos_seguidos=racha,ultimo_acierto=p_fecha WHERE id=p_jugador;
    PERFORM suizamente_social.sumar(p_jugador,'respuesta',p_pregunta,CASE WHEN racha>=3 THEN 15 ELSE 10 END,j.canton,p_fecha);
  ELSE
    UPDATE suizamente_social.jugadores SET aciertos_seguidos=0,ultimo_acierto=NULL WHERE id=p_jugador;
    PERFORM suizamente_social.sumar(p_jugador,'respuesta',p_pregunta,0,j.canton,p_fecha);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION suizamente_social.racha(p_jugador text,p_retos boolean DEFAULT false)
RETURNS integer LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public,suizamente_social AS $$
DECLARE d date; n integer:=0; actual date:=suizamente_social.hoy();
BEGIN
  FOR d IN SELECT DISTINCT dia FROM (
    SELECT (creado_en AT TIME ZONE 'Europe/Zurich')::date dia FROM suizamente_social.respuestas WHERE jugador=p_jugador AND NOT p_retos
    UNION SELECT fecha FROM suizamente_social.diarias WHERE jugador=p_jugador AND p_retos GROUP BY fecha HAVING count(*)=5
  ) dias ORDER BY dia DESC LOOP
    IF n=0 AND d=actual-1 THEN actual:=actual-1; END IF;
    IF d<>actual THEN EXIT; END IF;
    n:=n+1; actual:=actual-1;
  END LOOP;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION suizamente_social.logros(p_jugador text) RETURNS jsonb
LANGUAGE plpgsql SET search_path=pg_catalog,public,suizamente_social AS $$
DECLARE detalle jsonb; ganado record;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('id',id,'progreso',least(progreso,meta),'meta',meta,'conseguida',m.medalla IS NOT NULL)) INTO detalle
  FROM (
    SELECT 'puntualidad' id,suizamente_social.racha(p_jugador) progreso,7 meta
    UNION ALL SELECT 'reciclaje',count(*)::int,10 FROM suizamente_social.respuestas r JOIN suizamente_social.preguntas q ON q.id=r.pregunta WHERE r.jugador=p_jugador AND r.acierto AND q.tema='casa'
    UNION ALL SELECT 'fondue',count(*)::int,10 FROM suizamente_social.respuestas r JOIN suizamente_social.preguntas q ON q.id=r.pregunta WHERE r.jugador=p_jugador AND r.acierto AND q.tema='comida'
    UNION ALL SELECT 'papeles',count(*)::int,10 FROM suizamente_social.respuestas r JOIN suizamente_social.preguntas q ON q.id=r.pregunta WHERE r.jugador=p_jugador AND r.acierto AND q.tema='papeles'
    UNION ALL SELECT 'comunidad',count(*)::int,100 FROM suizamente_social.respuestas r JOIN suizamente_social.preguntas q ON q.id=r.pregunta WHERE r.jugador=p_jugador AND q.tipo='dilema'
    UNION ALL SELECT 'poliglota',count(*)::int,20 FROM suizamente_social.respuestas r JOIN suizamente_social.preguntas q ON q.id=r.pregunta WHERE r.jugador=p_jugador AND r.acierto AND q.tema='idioma'
    UNION ALL SELECT 'duelista',count(*)::int,5 FROM suizamente_social.puntos WHERE jugador=p_jugador AND motivo='duelo' AND cantidad=20
    UNION ALL SELECT 'corazon',count(*)::int,1 FROM suizamente_social.propuestas WHERE jugador=p_jugador AND estado='publicada'
    UNION ALL SELECT 'cumbre',suizamente_social.racha(p_jugador,true),30
  ) t LEFT JOIN suizamente_social.medallas m ON m.jugador=p_jugador AND m.medalla=t.id;
  FOR ganado IN SELECT e->>'id' id FROM jsonb_array_elements(detalle) e WHERE (e->>'progreso')::int>=(e->>'meta')::int LOOP
    INSERT INTO suizamente_social.medallas VALUES(p_jugador,ganado.id,now()) ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN (SELECT jsonb_agg(e||jsonb_build_object('conseguida',EXISTS(SELECT 1 FROM suizamente_social.medallas WHERE jugador=p_jugador AND medalla=e->>'id'))) FROM jsonb_array_elements(detalle) e);
END $$;

CREATE OR REPLACE FUNCTION suizamente_social.perfil(p_jugador text) RETURNS jsonb
LANGUAGE plpgsql SET search_path=pg_catalog,public,suizamente_social AS $$
DECLARE j suizamente_social.jugadores; puntos integer; temas jsonb; total integer; reales integer; buenas integer;
  niveles integer[]:=ARRAY[0,150,500,1200,2500,5000]; nombres text[]:=ARRAY['Maleta en mano','Permiso L','Permiso B','Permiso C','Pasaporte rojo','Leyenda alpina']; nivel integer:=1;
  suizo integer; latino integer; medallas jsonb;
BEGIN
  SELECT * INTO j FROM suizamente_social.jugadores WHERE id=p_jugador;
  SELECT coalesce(sum(cantidad),0)::int INTO puntos FROM suizamente_social.puntos WHERE jugador=p_jugador;
  WHILE nivel<6 AND puntos>=niveles[nivel+1] LOOP nivel:=nivel+1; END LOOP;
  SELECT count(*),count(*) FILTER(WHERE r.acierto IS NOT NULL),count(*) FILTER(WHERE r.acierto) INTO total,reales,buenas FROM suizamente_social.respuestas r WHERE r.jugador=p_jugador;
  SELECT coalesce(jsonb_agg(t ORDER BY t.aciertos DESC),'[]') INTO temas FROM
    (SELECT q.tema,count(*) cantidad,round(100.0*count(*) FILTER(WHERE r.acierto)/count(*))::int aciertos
     FROM suizamente_social.respuestas r JOIN suizamente_social.preguntas q ON q.id=r.pregunta
     WHERE r.jugador=p_jugador AND q.tipo='real' GROUP BY q.tema HAVING count(*)>=5) t;
  WITH grupos AS (
    SELECT v.pregunta_id,jj.anos_suiza,count(*) n,
      ARRAY[count(*) FILTER(WHERE v.opcion=0),count(*) FILTER(WHERE v.opcion=1),count(*) FILTER(WHERE v.opcion=2)] votos
    FROM public.suizamente_votos v JOIN suizamente_social.jugadores jj ON jj.id=v.jugador_id
    JOIN suizamente_social.preguntas q ON q.id=v.pregunta_id
    WHERE q.tipo='dilema' AND jj.anos_suiza IN ('menos1','mas10') GROUP BY v.pregunta_id,jj.anos_suiza HAVING count(*)>=20
  ), decisivas AS (
    SELECT a.pregunta_id,a.votos antiguos,a.n na,b.votos nuevos,b.n nn
    FROM grupos a JOIN grupos b ON a.pregunta_id=b.pregunta_id AND b.anos_suiza='menos1'
    WHERE a.anos_suiza='mas10' AND EXISTS(SELECT 1 FROM generate_series(1,3) i WHERE abs(a.votos[i]*1.0/a.n-b.votos[i]*1.0/b.n)>=0.10)
  ) SELECT count(*) FILTER(WHERE d.antiguos[r.opcion+1]*1.0/d.na>d.nuevos[r.opcion+1]*1.0/d.nn),
      count(*) FILTER(WHERE d.antiguos[r.opcion+1]*1.0/d.na<d.nuevos[r.opcion+1]*1.0/d.nn)
    INTO suizo,latino FROM decisivas d JOIN suizamente_social.respuestas r ON r.pregunta=d.pregunta_id AND r.jugador=p_jugador;
  medallas:=suizamente_social.logros(p_jugador);
  RETURN jsonb_build_object('id',j.id,'usuarioId',j.usuario_id,'apodo',j.apodo,'color',j.color,'pais',j.pais,'canton',j.canton,'anosSuiza',j.anos_suiza,
    'enRanking',j.en_ranking,'ajustes',j.ajustes,'puntos',puntos,'nivel',nivel,'nombreNivel',nombres[nivel],
    'siguiente',CASE WHEN nivel<6 THEN nombres[nivel+1] END,'faltan',CASE WHEN nivel<6 THEN niveles[nivel+1]-puntos ELSE 0 END,
    'progreso',CASE WHEN nivel=6 THEN 100 ELSE round(100.0*(puntos-niveles[nivel])/(niveles[nivel+1]-niveles[nivel]))::int END,
    'racha',suizamente_social.racha(p_jugador),'aciertosSeguidos',CASE WHEN j.ultimo_acierto>now()-interval '30 minutes' THEN j.aciertos_seguidos ELSE 0 END,
    'datos',total,'reales',reales,'correctas',buenas,'aciertos',CASE WHEN reales>0 THEN round(100.0*buenas/reales)::int ELSE 0 END,
    'temas',temas,'suizometro',CASE WHEN suizo+latino>=10 THEN round(100.0*suizo/(suizo+latino))::int END,'decisivos',suizo+latino,
    'medallas',medallas,'admin',EXISTS(SELECT 1 FROM public.admin_users WHERE user_id=j.usuario_id));
END $$;

CREATE OR REPLACE FUNCTION suizamente_social.diario(p_fecha date) RETURNS text[]
LANGUAGE plpgsql SET search_path=pg_catalog,public,suizamente_social AS $$
DECLARE ids text[];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('suizamente-dia:'||p_fecha));
  SELECT preguntas INTO ids FROM suizamente_social.dias WHERE fecha=p_fecha;
  IF ids IS NOT NULL THEN RETURN ids; END IF;
  SELECT array_agg(id ORDER BY md5(p_fecha::text||id)) INTO ids FROM (
    (SELECT q.id FROM suizamente_social.preguntas q WHERE q.tipo='real'
      AND NOT EXISTS(SELECT 1 FROM suizamente_social.dias d WHERE d.fecha BETWEEN p_fecha-90 AND p_fecha-1 AND q.id=ANY(d.preguntas)) ORDER BY md5(p_fecha::text||q.id) LIMIT 3)
    UNION ALL
    (SELECT q.id FROM suizamente_social.preguntas q WHERE q.tipo='dilema' AND q.opciones=2
      AND NOT EXISTS(SELECT 1 FROM suizamente_social.dias d WHERE d.fecha BETWEEN p_fecha-90 AND p_fecha-1 AND q.id=ANY(d.preguntas)) ORDER BY md5(p_fecha::text||q.id) LIMIT 2)
  ) seleccion;
  IF cardinality(ids)<>5 THEN RAISE SQLSTATE 'PT503' USING MESSAGE='No hay preguntas suficientes para el reto'; END IF;
  INSERT INTO suizamente_social.dias VALUES(p_fecha,ids);
  RETURN ids;
END $$;

CREATE OR REPLACE FUNCTION suizamente_social.duelo(p_jugador text,p_codigo text) RETURNS jsonb
LANGUAGE plpgsql SET search_path=pg_catalog,public,suizamente_social AS $$
DECLARE d suizamente_social.duelos; a jsonb; b jsonb; ca integer; cb integer; propio boolean; puntos_a integer; puntos_b integer;
BEGIN
  SELECT * INTO d FROM suizamente_social.duelos WHERE codigo=p_codigo FOR UPDATE;
  IF d.codigo IS NULL THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Duelo no encontrado'; END IF;
  IF d.estado='esperando' AND d.caduca_en<=now() THEN
    UPDATE suizamente_social.duelos SET estado='caducado' WHERE codigo=p_codigo; d.estado:='caducado';
  END IF;
  propio:=p_jugador IN(d.creador,d.rival);
  SELECT count(*),coalesce(sum(punto),0),coalesce(jsonb_object_agg(pregunta,jsonb_build_object('opcion',opcion,'punto',punto)),'{}')
    INTO ca,puntos_a,a FROM suizamente_social.duelo_respuestas WHERE codigo=p_codigo AND jugador=d.creador;
  SELECT count(*),coalesce(sum(punto),0),coalesce(jsonb_object_agg(pregunta,jsonb_build_object('opcion',opcion,'punto',punto)),'{}')
    INTO cb,puntos_b,b FROM suizamente_social.duelo_respuestas WHERE codigo=p_codigo AND jugador=d.rival;
  RETURN jsonb_build_object('codigo',d.codigo,'modo',d.modo,'estado',d.estado,'caducaEn',d.caduca_en,
    'creador', (SELECT jsonb_build_object('id',id,'apodo',apodo,'color',color) FROM suizamente_social.jugadores WHERE id=d.creador),
    'rival', (SELECT jsonb_build_object('id',CASE WHEN usuario_id IS NOT NULL OR id=p_jugador THEN id END,'apodo',apodo,'color',color) FROM suizamente_social.jugadores WHERE id=d.rival),
    'invitado',CASE WHEN p_jugador IN(d.creador,d.invitado) THEN (SELECT jsonb_build_object('id',id,'apodo',apodo,'color',color) FROM suizamente_social.jugadores WHERE id=d.invitado) END,
    'participante',coalesce(propio,false),'puedeUnirse',d.estado='esperando' AND d.rival IS NULL AND p_jugador<>d.creador AND (d.invitado IS NULL OR d.invitado=p_jugador),
    'preguntas',CASE WHEN propio THEN to_jsonb(d.preguntas) ELSE '[]'::jsonb END,
    'respondidas',CASE WHEN p_jugador=d.creador THEN ca WHEN p_jugador=d.rival THEN cb ELSE 0 END,
    'respondidasCreador',CASE WHEN propio THEN ca END,'respondidasRival',CASE WHEN propio THEN cb END,
    'mias',CASE WHEN p_jugador=d.creador THEN a WHEN p_jugador=d.rival THEN b ELSE '{}'::jsonb END,
    'puntosCreador',CASE WHEN propio AND ca=10 AND cb=10 THEN puntos_a END,
    'puntosRival',CASE WHEN propio AND ca=10 AND cb=10 THEN puntos_b END,
    'respuestasCreador',CASE WHEN propio AND ca=10 AND cb=10 THEN a ELSE '{}'::jsonb END,
    'respuestasRival',CASE WHEN propio AND ca=10 AND cb=10 THEN b ELSE '{}'::jsonb END);
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA suizamente_social FROM PUBLIC,anon,authenticated;
COMMIT;
