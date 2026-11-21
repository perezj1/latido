-- Gestión de retos: ejecutar completo en Supabase SQL Editor.
-- Conserva respuestas, votos, puntos y datos existentes.
BEGIN;

CREATE TABLE IF NOT EXISTS suizamente_social.duelos_ocultos (
  codigo text NOT NULL REFERENCES suizamente_social.duelos(codigo) ON DELETE CASCADE,
  jugador text NOT NULL REFERENCES suizamente_social.jugadores(id) ON DELETE CASCADE,
  creado_en timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(codigo,jugador)
);
ALTER TABLE suizamente_social.duelos_ocultos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON suizamente_social.duelos_ocultos FROM PUBLIC,anon,authenticated;


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
    'mias',CASE WHEN p_jugador=d.creador THEN a WHEN p_jugador=d.rival THEN b ELSE '{}'::jsonb END,
    'puntosCreador',CASE WHEN propio AND ca=10 AND cb=10 THEN puntos_a END,
    'puntosRival',CASE WHEN propio AND ca=10 AND cb=10 THEN puntos_b END,
    'respuestasCreador',CASE WHEN propio AND ca=10 AND cb=10 THEN a ELSE '{}'::jsonb END,
    'respuestasRival',CASE WHEN propio AND ca=10 AND cb=10 THEN b ELSE '{}'::jsonb END);
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA suizamente_social FROM PUBLIC,anon,authenticated;


CREATE OR REPLACE FUNCTION public.suizamente_social_api(p_accion text,p_jugador text,p_datos jsonb DEFAULT '{}',p_direccion text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,suizamente_social AS $$
#variable_conflict use_column
<<social_api>>
DECLARE
  j suizamente_social.jugadores; q suizamente_social.preguntas; d suizamente_social.duelos;
  uid uuid; nombre text; canton_latido text; invitado text; destino text; codigo text;
  hoy date:=suizamente_social.hoy(); inicio timestamptz:=(date_trunc('week',now() AT TIME ZONE 'Europe/Zurich') AT TIME ZONE 'Europe/Zurich');
  fin timestamptz:=((date_trunc('week',now() AT TIME ZONE 'Europe/Zurich')+interval '7 days') AT TIME ZONE 'Europe/Zurich');
  ids text[]; resultado jsonb; anterior jsonb; perfil jsonb; filas jsonb; detalle jsonb;
  antes integer; despues integer; n integer; a integer; b integer; opcion integer; punto integer; contador integer; nota integer;
  clave text; ref text; tipo text; modo text; item record; es_admin boolean; revancha boolean:=false;
BEGIN
  IF p_jugador IS NULL OR p_jugador !~ '^(user|anon):[a-f0-9-]{36}$' OR p_direccion IS NULL OR jsonb_typeof(p_datos)<>'object' THEN
    RAISE SQLSTATE 'PT400' USING MESSAGE='Solicitud no válida';
  END IF;
  FOREACH clave IN ARRAY ARRAY['ip:'||p_direccion,p_jugador] LOOP
    INSERT INTO suizamente_social.limites AS l VALUES(clave,date_trunc('minute',now()),1)
    ON CONFLICT(clave) DO UPDATE SET ventana=excluded.ventana,
      cantidad=CASE WHEN l.ventana=excluded.ventana THEN l.cantidad+1 ELSE 1 END RETURNING cantidad INTO contador;
    IF contador>60 THEN RAISE SQLSTATE 'PT429' USING MESSAGE='Demasiadas peticiones'; END IF;
  END LOOP;
  DELETE FROM suizamente_social.limites WHERE ventana<now()-interval '1 day';
  IF p_jugador LIKE 'user:%' THEN
    uid:=substring(p_jugador FROM 6)::uuid;
    IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=uid) OR EXISTS(SELECT 1 FROM public.profiles WHERE id=uid AND banned) THEN
      RAISE SQLSTATE 'PT403' USING MESSAGE='Cuenta no disponible';
    END IF;
    SELECT coalesce(nullif(trim(p.name),''),nullif(trim(u.raw_user_meta_data->>'name'),''),'Usuario de Latido'),p.canton
      INTO nombre,canton_latido FROM auth.users u LEFT JOIN public.profiles p ON p.id=u.id WHERE u.id=uid;
    SELECT c.codigo INTO canton_latido FROM suizamente_social.cantones c
      WHERE lower(canton_latido) IN(lower(c.codigo),lower(c.nombre),lower(c.alias));
  END IF;
  INSERT INTO suizamente_social.jugadores(id,usuario_id,apodo,canton,perfil_iniciado)
    VALUES(p_jugador,uid,coalesce(nombre,'Invitado'),canton_latido,true)
    ON CONFLICT(id) DO UPDATE SET apodo=CASE WHEN uid IS NOT NULL THEN excluded.apodo ELSE suizamente_social.jugadores.apodo END,
      canton=CASE WHEN suizamente_social.jugadores.perfil_iniciado THEN suizamente_social.jugadores.canton ELSE excluded.canton END,perfil_iniciado=true;
  SELECT * INTO j FROM suizamente_social.jugadores WHERE id=p_jugador FOR UPDATE;
  es_admin:=uid IS NOT NULL AND EXISTS(SELECT 1 FROM public.admin_users WHERE user_id=uid);

  -- Importa las respuestas existentes con su fecha original. Nunca vuelve a premiarlas.
  FOR item IN SELECT v.* FROM public.suizamente_votos v JOIN suizamente_social.preguntas sq ON sq.id=v.pregunta_id
    WHERE v.jugador_id=p_jugador AND NOT EXISTS(SELECT 1 FROM suizamente_social.respuestas r WHERE r.jugador=p_jugador AND r.pregunta=v.pregunta_id)
    ORDER BY v.creado_en,v.pregunta_id LOOP
    PERFORM suizamente_social.registrar(p_jugador,item.pregunta_id,item.opcion,item.creado_en);
  END LOOP;

  IF p_accion='perfil_guardar' THEN
    IF p_datos?'enRanking' AND jsonb_typeof(p_datos->'enRanking')<>'boolean' THEN
      RAISE SQLSTATE 'PT400' USING MESSAGE='Revisa los ajustes de privacidad';
    END IF;
    IF p_datos?'ajustes' THEN
      IF jsonb_typeof(p_datos->'ajustes')<>'object' THEN
        RAISE SQLSTATE 'PT400' USING MESSAGE='Revisa los ajustes';
      END IF;
      IF EXISTS(SELECT 1 FROM jsonb_each(p_datos->'ajustes') e WHERE
        e.key NOT IN ('apariencia','sonidos','vibracion','menosAnimaciones','avisos')
        OR (e.key='apariencia' AND (jsonb_typeof(e.value)<>'string' OR e.value#>>'{}' NOT IN ('auto','light','dark')))
        OR (e.key<>'apariencia' AND jsonb_typeof(e.value)<>'boolean')) THEN
        RAISE SQLSTATE 'PT400' USING MESSAGE='Revisa los ajustes';
      END IF;
    END IF;
    IF uid IS NULL AND (length(trim(p_datos->>'apodo')) NOT BETWEEN 2 AND 40 OR (p_datos->>'apodo') !~ '^[[:alnum:] ._-]+$') THEN
      RAISE SQLSTATE 'PT400' USING MESSAGE='Revisa el nombre del perfil';
    END IF;
    UPDATE suizamente_social.jugadores SET
      apodo=CASE WHEN uid IS NULL THEN coalesce(nullif(trim(p_datos->>'apodo'),''),apodo) ELSE apodo END,
      color=coalesce(p_datos->>'color',color),pais=CASE WHEN p_datos?'pais' THEN nullif(p_datos->>'pais','') ELSE pais END,
      canton=CASE WHEN p_datos?'canton' THEN nullif(p_datos->>'canton','') ELSE canton END,anos_suiza=CASE WHEN p_datos?'anosSuiza' THEN nullif(p_datos->>'anosSuiza','') ELSE anos_suiza END,
      en_ranking=coalesce((p_datos->>'enRanking')::boolean,en_ranking),
      ajustes=ajustes||(coalesce(p_datos->'ajustes','{}')-ARRAY['puntos','admin','usuarioId'])
      WHERE id=p_jugador;
    RETURN jsonb_build_object('perfil',suizamente_social.perfil(p_jugador));
  ELSIF p_accion='vincular' THEN
    IF uid IS NULL THEN RAISE SQLSTATE 'PT401' USING MESSAGE='Entra con tu cuenta de Latido'; END IF;
    invitado:='anon:'||(p_datos->>'invitado');
    IF invitado !~ '^anon:[a-f0-9-]{36}$' THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Invitado no válido'; END IF;
    IF NOT EXISTS(SELECT 1 FROM suizamente_social.jugadores WHERE id=invitado)
      AND EXISTS(SELECT 1 FROM public.suizamente_votos WHERE jugador_id=invitado) THEN
      INSERT INTO suizamente_social.jugadores(id) VALUES(invitado);
      FOR item IN SELECT v.* FROM public.suizamente_votos v JOIN suizamente_social.preguntas q ON q.id=v.pregunta_id
        WHERE v.jugador_id=invitado ORDER BY v.creado_en,v.pregunta_id LOOP
        PERFORM suizamente_social.registrar(invitado,item.pregunta_id,item.opcion,item.creado_en);
      END LOOP;
    END IF;
    IF NOT EXISTS(SELECT 1 FROM suizamente_social.jugadores WHERE id=invitado) THEN
      RETURN jsonb_build_object('perfil',suizamente_social.perfil(p_jugador),'vinculado',false);
    END IF;
    PERFORM 1 FROM suizamente_social.jugadores WHERE id=invitado FOR UPDATE;
    -- Primero conserva el voto que ya tenía la cuenta; después incorpora los que faltan.
    DELETE FROM public.suizamente_votos g USING public.suizamente_votos a
      WHERE g.jugador_id=invitado AND a.jugador_id=p_jugador AND a.pregunta_id=g.pregunta_id;
    UPDATE public.suizamente_votos SET jugador_id=p_jugador,usuario_id=uid WHERE jugador_id=invitado;
    INSERT INTO suizamente_social.respuestas SELECT p_jugador,pregunta,opcion,acierto,canton,creado_en FROM suizamente_social.respuestas WHERE jugador=invitado ON CONFLICT DO NOTHING;
    INSERT INTO suizamente_social.puntos SELECT p_jugador,motivo,ref,cantidad,canton,creado_en FROM suizamente_social.puntos WHERE jugador=invitado ON CONFLICT DO NOTHING;
    INSERT INTO suizamente_social.diarias SELECT fecha,p_jugador,pregunta,opcion,acierto,creado_en FROM suizamente_social.diarias WHERE jugador=invitado ON CONFLICT DO NOTHING;
    INSERT INTO suizamente_social.libreta SELECT p_jugador,pregunta,creado_en FROM suizamente_social.libreta WHERE jugador=invitado ORDER BY creado_en DESC
      LIMIT greatest(0,500-(SELECT count(*)::int FROM suizamente_social.libreta WHERE jugador=p_jugador)) ON CONFLICT DO NOTHING;
    -- Una cuenta no puede convertirse en su propia rival al vincular un invitado.
    DELETE FROM suizamente_social.puntos WHERE motivo='duelo' AND ref IN(SELECT codigo FROM suizamente_social.duelos
      WHERE (creador=invitado AND rival=p_jugador) OR (creador=p_jugador AND rival=invitado));
    DELETE FROM suizamente_social.duelos WHERE (creador=invitado AND rival=p_jugador) OR (creador=p_jugador AND rival=invitado);
    INSERT INTO suizamente_social.duelo_respuestas SELECT codigo,p_jugador,pregunta,opcion,punto,creado_en FROM suizamente_social.duelo_respuestas WHERE jugador=invitado ON CONFLICT DO NOTHING;
    UPDATE suizamente_social.duelos SET rival=p_jugador WHERE rival=invitado;
    UPDATE suizamente_social.duelos SET creador=p_jugador WHERE creador=invitado;
    UPDATE suizamente_social.jugadores a SET pais=coalesce(a.pais,g.pais),canton=coalesce(a.canton,g.canton),anos_suiza=coalesce(a.anos_suiza,g.anos_suiza)
      ,ajustes=g.ajustes||a.ajustes,en_ranking=a.en_ranking AND g.en_ranking
      FROM suizamente_social.jugadores g WHERE a.id=p_jugador AND g.id=invitado;
    DELETE FROM suizamente_social.jugadores WHERE id=invitado;
    RETURN jsonb_build_object('perfil',suizamente_social.perfil(p_jugador),'vinculado',true);
  ELSIF p_accion='respuesta' THEN
    SELECT * INTO q FROM suizamente_social.preguntas WHERE id=p_datos->>'preguntaId';
    opcion:=(p_datos->>'opcion')::integer;
    IF q.id IS NULL OR opcion IS NULL OR opcion<0 OR opcion>=q.opciones THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Pregunta u opción no válida'; END IF;
    tipo:=p_datos->'contexto'->>'tipo';
    IF tipo='reto' THEN
      IF p_datos->'contexto'->>'fecha'<>hoy::text THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Este reto ya ha terminado'; END IF;
      ids:=suizamente_social.diario(hoy);
      IF NOT q.id=ANY(ids) THEN RAISE SQLSTATE 'PT400' USING MESSAGE='La pregunta no pertenece a este reto'; END IF;
    ELSIF tipo='duelo' THEN
      codigo:=p_datos->'contexto'->>'codigo';
      SELECT * INTO d FROM suizamente_social.duelos WHERE suizamente_social.duelos.codigo=social_api.codigo FOR UPDATE;
      IF d.codigo IS NULL OR NOT coalesce(p_jugador IN(d.creador,d.rival),false) THEN RAISE SQLSTATE 'PT403' USING MESSAGE='No participas en este duelo'; END IF;
      IF d.estado='caducado' OR (d.estado='esperando' AND d.caduca_en<=now()) THEN RAISE SQLSTATE 'PT409' USING MESSAGE='El duelo ha caducado'; END IF;
      IF NOT q.id=ANY(d.preguntas) THEN RAISE SQLSTATE 'PT400' USING MESSAGE='La pregunta no pertenece al duelo'; END IF;
    ELSIF tipo IS NOT NULL THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Contexto no válido'; END IF;
    SELECT coalesce(sum(cantidad),0) INTO antes FROM suizamente_social.puntos WHERE jugador=p_jugador;
    anterior:=suizamente_social.perfil(p_jugador);
    resultado:=public.suizamente_votos_api('votar',p_jugador,q.id,opcion,'social:'||p_direccion);
    PERFORM suizamente_social.registrar(p_jugador,q.id,(resultado->>'opcion')::int);
    IF tipo='reto' THEN
      INSERT INTO suizamente_social.diarias VALUES(hoy,p_jugador,q.id,opcion,CASE WHEN q.tipo='real' THEN opcion=q.correcta END,now()) ON CONFLICT DO NOTHING;
      IF (SELECT count(*) FROM suizamente_social.diarias WHERE fecha=hoy AND jugador=p_jugador)=5 THEN
        PERFORM suizamente_social.sumar(p_jugador,'reto',hoy::text,30,j.canton);
      END IF;
    ELSIF tipo='duelo' THEN
      IF q.tipo='real' THEN punto:=CASE WHEN opcion=q.correcta THEN 1 ELSE 0 END;
      ELSE
        -- El empate también es mayoría, pero no se inventa una mayoría con un único voto.
        SELECT CASE WHEN sum(c)>1 AND max(c)=(SELECT count(*) FROM public.suizamente_votos WHERE pregunta_id=q.id AND suizamente_votos.opcion=social_api.opcion) THEN 1 ELSE 0 END
          INTO punto FROM (SELECT count(*) c FROM public.suizamente_votos WHERE pregunta_id=q.id GROUP BY suizamente_votos.opcion) v;
      END IF;
      INSERT INTO suizamente_social.duelo_respuestas VALUES(codigo,p_jugador,q.id,opcion,punto,now()) ON CONFLICT DO NOTHING;
      IF (SELECT count(*) FROM suizamente_social.duelo_respuestas r WHERE r.codigo=d.codigo)=20 THEN
        UPDATE suizamente_social.duelos SET estado='terminado',terminado_en=now() WHERE suizamente_social.duelos.codigo=d.codigo;
        SELECT sum(r.punto) FILTER(WHERE r.jugador=d.creador),sum(r.punto) FILTER(WHERE r.jugador=d.rival)
          INTO a,b FROM suizamente_social.duelo_respuestas r WHERE r.codigo=d.codigo;
        PERFORM suizamente_social.sumar(d.creador,'duelo',d.codigo,CASE WHEN a>b THEN 20 WHEN a=b THEN 10 ELSE 0 END,(SELECT canton FROM suizamente_social.jugadores WHERE id=d.creador));
        PERFORM suizamente_social.sumar(d.rival,'duelo',d.codigo,CASE WHEN b>a THEN 20 WHEN a=b THEN 10 ELSE 0 END,(SELECT canton FROM suizamente_social.jugadores WHERE id=d.rival));
        IF d.estado<>'terminado' THEN
          PERFORM suizamente_social.notificar(d.creador,'duelo:'||d.codigo,'Duelo terminado','Ya puedes ver el resultado.','/suizamente/duelo/'||d.codigo);
          PERFORM suizamente_social.notificar(d.rival,'duelo:'||d.codigo,'Duelo terminado','Ya puedes ver el resultado.','/suizamente/duelo/'||d.codigo);
        END IF;
      END IF;
    END IF;
    perfil:=suizamente_social.perfil(p_jugador);
    despues:=(perfil->>'puntos')::int;
    SELECT coalesce(jsonb_agg(m),'[]') INTO detalle FROM jsonb_array_elements(perfil->'medallas') m
      WHERE (m->>'conseguida')::boolean AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(anterior->'medallas') am WHERE am->>'id'=m->>'id' AND (am->>'conseguida')::boolean);
    RETURN resultado||jsonb_build_object('puntos',despues-antes,'perfil',perfil,'medallasNuevas',detalle,'nivelNuevo',(perfil->>'nivel')::int>(anterior->>'nivel')::int);
  ELSIF p_accion='reto' THEN
    ids:=suizamente_social.diario(hoy);
    SELECT coalesce(jsonb_object_agg(pregunta,opcion),'{}') INTO detalle FROM suizamente_social.diarias WHERE fecha=hoy AND jugador=p_jugador;
    SELECT coalesce(jsonb_agg(EXISTS(SELECT 1 FROM suizamente_social.diarias WHERE jugador=p_jugador AND fecha=(inicio AT TIME ZONE 'Europe/Zurich')::date+i GROUP BY fecha HAVING count(*)=5) ORDER BY i),'[]')
      INTO filas FROM generate_series(0,6) i;
    SELECT jsonb_build_object('aciertos',count(*) FILTER(WHERE acierto),'hecho',count(*)=5) INTO anterior FROM suizamente_social.diarias WHERE fecha=hoy-1 AND jugador=p_jugador;
    SELECT CASE WHEN count(*)>0 THEN round(100.0*count(*) FILTER(WHERE t.aciertos<(anterior->>'aciertos')::int)/count(*))::int END INTO n
      FROM (SELECT jugador,count(*) FILTER(WHERE acierto) aciertos FROM suizamente_social.diarias WHERE fecha=hoy-1 GROUP BY jugador HAVING count(*)=5) t;
    SELECT count(*) FILTER(WHERE acierto) INTO nota FROM suizamente_social.diarias WHERE fecha=hoy AND jugador=p_jugador;
    RETURN jsonb_build_object('fecha',hoy,'preguntas',ids,'respuestas',detalle,'aciertos',nota,'hecho',(SELECT count(*) FROM jsonb_object_keys(detalle))=5,
      'terminaEn',((hoy+1)::timestamp AT TIME ZONE 'Europe/Zurich'),'semana',filas,'ayer',anterior||jsonb_build_object('mejorQuePct',n));
  ELSIF p_accion IN('duelos','duelo','duelo_unirse','duelo_crear','duelo_revancha','duelo_eliminar') THEN
    IF p_accion='duelo_eliminar' THEN
      SELECT * INTO d FROM suizamente_social.duelos WHERE codigo=upper(p_datos->>'codigo') FOR UPDATE;
      IF d.codigo IS NULL OR NOT coalesce(p_jugador IN(d.creador,d.rival,d.invitado),false) THEN
        RAISE SQLSTATE 'PT403' USING MESSAGE='Este reto no está en tu lista';
      END IF;
      IF d.creador=p_jugador AND d.estado='esperando' THEN
        UPDATE suizamente_social.duelos SET estado='caducado',caduca_en=least(caduca_en,now()) WHERE codigo=d.codigo;
      END IF;
      INSERT INTO suizamente_social.duelos_ocultos(codigo,jugador) VALUES(d.codigo,p_jugador) ON CONFLICT DO NOTHING;
      RETURN jsonb_build_object('eliminado',true);
    END IF;
    IF p_accion='duelo_revancha' THEN
      SELECT * INTO d FROM suizamente_social.duelos WHERE codigo=upper(p_datos->>'codigo') FOR UPDATE;
      IF d.codigo IS NULL OR NOT coalesce(p_jugador IN(d.creador,d.rival),false) THEN RAISE SQLSTATE 'PT403' USING MESSAGE='No participas en este duelo'; END IF;
      IF d.estado<>'terminado' THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Primero terminad el duelo'; END IF;
      destino:=CASE WHEN d.creador=p_jugador THEN d.rival ELSE d.creador END;
      IF destino IS NULL THEN RAISE SQLSTATE 'PT404' USING MESSAGE='El rival ya no está disponible'; END IF;
      p_datos:=jsonb_build_object('modo',d.modo,'rival',destino);p_accion:='duelo_crear';revancha:=true;
    END IF;
    IF p_accion='duelos' THEN
      SELECT coalesce(jsonb_agg(suizamente_social.duelo(p_jugador,t.codigo) ORDER BY t.creado_en DESC),'[]') INTO filas
        FROM (SELECT * FROM suizamente_social.duelos d WHERE p_jugador IN(creador,rival,invitado)
          AND NOT EXISTS(SELECT 1 FROM suizamente_social.duelos_ocultos o WHERE o.codigo=d.codigo AND o.jugador=p_jugador)
          ORDER BY creado_en DESC LIMIT 50) t;
      RETURN jsonb_build_object('duelos',filas);
    ELSIF p_accion='duelo_crear' THEN
      IF uid IS NULL THEN RAISE SQLSTATE 'PT401' USING MESSAGE='Entra con tu cuenta para retar'; END IF;
      IF (SELECT count(*) FROM suizamente_social.duelos WHERE creador=p_jugador AND estado='esperando' AND caduca_en>now())>=10 THEN RAISE SQLSTATE 'PT429' USING MESSAGE='Tienes diez duelos abiertos'; END IF;
      modo:=p_datos->>'modo';
      IF modo IS NULL OR modo NOT IN('dilemas','preguntas','mix') THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Elige un modo de juego'; END IF;
      destino:=nullif(p_datos->>'rival','');
      IF destino IS NOT NULL AND EXISTS(SELECT 1 FROM suizamente_social.amistades WHERE estado='bloqueada' AND p_jugador IN(solicitante,destinatario) AND destino IN(solicitante,destinatario)) THEN RAISE SQLSTATE 'PT403' USING MESSAGE='El duelo no está disponible'; END IF;
      IF destino IS NOT NULL AND NOT revancha AND NOT EXISTS(SELECT 1 FROM suizamente_social.amistades WHERE estado='aceptada' AND p_jugador IN(solicitante,destinatario) AND destino IN(solicitante,destinatario) AND destino<>p_jugador) THEN
        RAISE SQLSTATE 'PT403' USING MESSAGE='Elige una amistad aceptada o comparte el enlace';
      END IF;
      SELECT array_agg(id ORDER BY random()) INTO ids FROM (
        (SELECT id FROM suizamente_social.preguntas WHERE tipo='dilema' AND opciones=2 AND modo IN('dilemas','mix') ORDER BY random() LIMIT CASE WHEN modo='mix' THEN 5 ELSE 10 END)
        UNION ALL (SELECT id FROM suizamente_social.preguntas WHERE tipo='real' AND modo IN('preguntas','mix') ORDER BY random() LIMIT CASE WHEN modo='mix' THEN 5 ELSE 10 END)
      ) t;
      codigo:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
      INSERT INTO suizamente_social.duelos(codigo,modo,preguntas,creador,invitado) VALUES(codigo,modo,ids,p_jugador,destino);
      IF destino IS NOT NULL THEN PERFORM suizamente_social.notificar(destino,'reto:'||codigo,'Te han retado',j.apodo||' quiere jugar contigo.','/suizamente/duelo/'||codigo); END IF;
      RETURN suizamente_social.duelo(p_jugador,codigo);
    ELSE
      codigo:=upper(p_datos->>'codigo');
      IF p_accion='duelo_unirse' THEN
        SELECT * INTO d FROM suizamente_social.duelos WHERE suizamente_social.duelos.codigo=social_api.codigo FOR UPDATE;
        IF d.codigo IS NULL THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Duelo no encontrado'; END IF;
        IF d.creador=p_jugador OR (d.rival IS NOT NULL AND d.rival<>p_jugador) OR (d.invitado IS NOT NULL AND d.invitado<>p_jugador) THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Este duelo no está disponible para esta cuenta'; END IF;
        IF d.caduca_en<=now() OR d.estado<>'esperando' THEN RAISE SQLSTATE 'PT409' USING MESSAGE='El duelo ya ha terminado'; END IF;
        UPDATE suizamente_social.duelos SET rival=p_jugador WHERE suizamente_social.duelos.codigo=social_api.codigo;
      END IF;
      RETURN suizamente_social.duelo(p_jugador,codigo);
    END IF;
  ELSIF p_accion='ranking' THEN
    tipo:=coalesce(p_datos->>'tipo','cantones');
    IF tipo='cantones' THEN
      WITH elegibles AS (SELECT id FROM suizamente_social.jugadores WHERE usuario_id IS NOT NULL AND en_ranking),
      actividad AS (
        SELECT r.canton,r.jugador FROM suizamente_social.respuestas r JOIN elegibles e ON e.id=r.jugador WHERE r.creado_en>=inicio AND r.creado_en<fin
        UNION SELECT p.canton,p.jugador FROM suizamente_social.puntos p JOIN elegibles e ON e.id=p.jugador WHERE p.creado_en>=inicio AND p.creado_en<fin AND p.cantidad>0
      ), activos AS (SELECT canton,count(DISTINCT jugador) n FROM actividad GROUP BY canton),
      totales AS (SELECT p.canton,sum(cantidad) puntos FROM suizamente_social.puntos p JOIN elegibles e ON e.id=p.jugador WHERE p.creado_en>=inicio AND p.creado_en<fin GROUP BY p.canton),
      datos AS (SELECT c.codigo,c.nombre,coalesce(t.puntos,0) puntos,coalesce(a.n,0) activos,
        CASE WHEN a.n>0 THEN round(coalesce(t.puntos,0)*1.0/a.n,2) ELSE 0 END media
        FROM suizamente_social.cantones c LEFT JOIN activos a ON a.canton=c.codigo LEFT JOIN totales t ON t.canton=c.codigo),
      orden AS (SELECT *,CASE WHEN activos>0 THEN dense_rank() OVER(ORDER BY (activos>0) DESC,media DESC) END puesto FROM datos)
      SELECT jsonb_agg(to_jsonb(o) ORDER BY (activos>0) DESC,media DESC,nombre) INTO filas FROM orden o;
      SELECT coalesce(sum(cantidad),0) INTO n FROM suizamente_social.puntos WHERE jugador=p_jugador AND creado_en>=inicio AND creado_en<fin AND canton=j.canton;
      RETURN jsonb_build_object('filas',filas,'miCanton',j.canton,'aporte',n,'inicio',inicio,'fin',fin,'criterio','media_por_jugador_activo');
    ELSIF tipo IN('semana','amigos') THEN
      WITH datos AS (
        SELECT g.id,g.apodo,g.color,g.canton,coalesce(sum(p.cantidad) FILTER(WHERE p.creado_en>=inicio AND p.creado_en<fin),0)::int puntos
        FROM suizamente_social.jugadores g LEFT JOIN suizamente_social.puntos p ON p.jugador=g.id
        WHERE g.usuario_id IS NOT NULL AND g.en_ranking AND g.perfil_iniciado AND (tipo='semana' OR g.id=p_jugador OR EXISTS(SELECT 1 FROM suizamente_social.amistades a WHERE a.estado='aceptada' AND p_jugador IN(a.solicitante,a.destinatario) AND g.id IN(a.solicitante,a.destinatario)))
        GROUP BY g.id
      ), orden AS(SELECT *,dense_rank() OVER(ORDER BY puntos DESC) puesto FROM datos)
      SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY puesto,apodo),'[]') INTO filas FROM orden o WHERE puesto<=50 OR id=p_jugador;
      RETURN jsonb_build_object('filas',filas,'yo',p_jugador,'fin',fin);
    END IF;
    RAISE SQLSTATE 'PT400' USING MESSAGE='Clasificación no válida';
  ELSIF p_accion IN('amigos','amigo_solicitar','amigo_responder','amigo_quitar','buscar') THEN
    IF uid IS NULL THEN RAISE SQLSTATE 'PT401' USING MESSAGE='Entra con tu cuenta para agregar amigos'; END IF;
    IF p_accion='buscar' THEN
      ref:=trim(p_datos->>'texto');
      IF length(ref)<2 OR length(ref)>80 THEN RETURN jsonb_build_object('personas','[]'::jsonb); END IF;
      SELECT coalesce(jsonb_agg(t),'[]') INTO filas FROM (
        SELECT 'user:'||p.id id,p.name apodo,coalesce(g.color,'menta') color,p.canton
        FROM public.profiles p LEFT JOIN suizamente_social.jugadores g ON g.usuario_id=p.id
        WHERE p.id<>uid AND NOT coalesce(p.banned,false) AND position(lower(ref) IN lower(p.name))>0
          AND NOT EXISTS(SELECT 1 FROM suizamente_social.amistades a WHERE a.estado='bloqueada' AND p_jugador IN(a.solicitante,a.destinatario) AND 'user:'||p.id IN(a.solicitante,a.destinatario))
        ORDER BY p.name LIMIT 20) t;
      RETURN jsonb_build_object('personas',filas);
    ELSIF p_accion<>'amigos' THEN
      destino:=p_datos->>'id';
      IF destino IS NULL OR destino=p_jugador OR destino !~ '^user:[a-f0-9-]{36}$' THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Persona no válida'; END IF;
      IF p_accion='amigo_solicitar' THEN
        IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=substring(destino FROM 6)::uuid AND NOT coalesce(banned,false)) THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Persona no disponible'; END IF;
        INSERT INTO suizamente_social.jugadores(id,usuario_id,apodo) SELECT destino,id,name FROM public.profiles WHERE id=substring(destino FROM 6)::uuid ON CONFLICT DO NOTHING;
        IF EXISTS(SELECT 1 FROM suizamente_social.amistades WHERE estado='bloqueada' AND p_jugador IN(solicitante,destinatario) AND destino IN(solicitante,destinatario)) THEN RAISE SQLSTATE 'PT403' USING MESSAGE='Solicitud no disponible'; END IF;
        INSERT INTO suizamente_social.amistades(solicitante,destinatario) VALUES(p_jugador,destino) ON CONFLICT DO NOTHING;
        GET DIAGNOSTICS n=ROW_COUNT;
        IF n>0 THEN PERFORM suizamente_social.notificar(destino,'amistad:'||p_jugador,'Solicitud de amistad',j.apodo||' quiere agregarte.','/suizamente/amigos'); END IF;
      ELSIF p_accion='amigo_responder' THEN
        IF p_datos->>'respuesta'='aceptar' THEN
          UPDATE suizamente_social.amistades SET estado='aceptada' WHERE solicitante=destino AND destinatario=p_jugador AND estado='pendiente';
        ELSIF p_datos->>'respuesta'='bloquear' THEN
          DELETE FROM suizamente_social.amistades WHERE p_jugador IN(solicitante,destinatario) AND destino IN(solicitante,destinatario) AND (estado<>'bloqueada' OR solicitante=p_jugador);
          INSERT INTO suizamente_social.amistades VALUES(p_jugador,destino,'bloqueada',now()) ON CONFLICT DO NOTHING;
        ELSE DELETE FROM suizamente_social.amistades WHERE solicitante=destino AND destinatario=p_jugador AND estado='pendiente'; END IF;
      ELSE DELETE FROM suizamente_social.amistades WHERE p_jugador IN(solicitante,destinatario) AND destino IN(solicitante,destinatario) AND (estado<>'bloqueada' OR solicitante=p_jugador); END IF;
    END IF;
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',g.id,'apodo',g.apodo,'color',g.color,'canton',g.canton,'estado',a.estado,'recibida',a.destinatario=p_jugador)),'[]') INTO filas
      FROM suizamente_social.amistades a JOIN suizamente_social.jugadores g ON g.id=CASE WHEN a.solicitante=p_jugador THEN a.destinatario ELSE a.solicitante END
      WHERE p_jugador IN(a.solicitante,a.destinatario) AND a.estado<>'bloqueada';
    RETURN jsonb_build_object('amistades',filas);
  ELSIF p_accion IN('libreta','libreta_guardar','libreta_quitar') THEN
    IF p_accion='libreta_guardar' THEN
      IF (SELECT count(*) FROM suizamente_social.libreta WHERE jugador=p_jugador)>=500 AND NOT EXISTS(SELECT 1 FROM suizamente_social.libreta WHERE jugador=p_jugador AND pregunta=p_datos->>'preguntaId') THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Tu libreta admite 500 datos'; END IF;
      INSERT INTO suizamente_social.libreta VALUES(p_jugador,p_datos->>'preguntaId',now()) ON CONFLICT DO NOTHING;
    ELSIF p_accion='libreta_quitar' THEN DELETE FROM suizamente_social.libreta WHERE jugador=p_jugador AND pregunta=p_datos->>'preguntaId'; END IF;
    SELECT coalesce(jsonb_agg(pregunta ORDER BY creado_en DESC),'[]') INTO filas FROM suizamente_social.libreta WHERE jugador=p_jugador;
    RETURN jsonb_build_object('libreta',filas);
  ELSIF p_accion IN('propuestas','propuesta_crear','moderar','moderacion','autores') THEN
    IF p_accion='autores' THEN
      SELECT coalesce(jsonb_object_agg(p.pregunta_id,coalesce(g.apodo,'Comunidad Latido')),'{}') INTO filas FROM suizamente_social.propuestas p LEFT JOIN suizamente_social.jugadores g ON g.id=p.jugador WHERE p.estado='publicada';
      RETURN jsonb_build_object('autores',filas);
    END IF;
    IF uid IS NULL THEN RAISE SQLSTATE 'PT401' USING MESSAGE='Entra con tu cuenta para proponer'; END IF;
    IF p_accion='propuesta_crear' THEN
      IF (SELECT count(*) FROM suizamente_social.propuestas WHERE jugador=p_jugador AND creado_en>=(hoy::timestamp AT TIME ZONE 'Europe/Zurich'))>=3 THEN RAISE SQLSTATE 'PT429' USING MESSAGE='Puedes enviar tres propuestas al día'; END IF;
      tipo:=p_datos->>'tipo'; detalle:=p_datos->'opciones';
      IF tipo NOT IN('dilema','real','mito','correccion') OR p_datos->>'tema' NOT IN('comida','casa','papeles','trabajo','dinero','salud','transporte','idioma','social','fiestas','naturaleza','cultura') THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Tipo o tema no válido'; END IF;
      IF tipo IN('real','dilema') THEN
        IF jsonb_typeof(detalle)<>'array' OR jsonb_array_length(detalle) NOT BETWEEN 2 AND 3 OR (tipo='dilema' AND jsonb_array_length(detalle)<>2)
          OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(detalle) o WHERE length(trim(o)) NOT BETWEEN 1 AND 90) THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Revisa las opciones'; END IF;
      END IF;
      IF tipo='real' AND ((p_datos->>'correcta')::int IS NULL OR (p_datos->>'correcta')::int NOT BETWEEN 0 AND jsonb_array_length(detalle)-1) THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Marca la respuesta correcta'; END IF;
      IF tipo='mito' AND p_datos->>'correcta' NOT IN('0','1') THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Marca verdad o mito'; END IF;
      INSERT INTO suizamente_social.propuestas(jugador,tipo,tema,pregunta,opciones,correcta,dato,fuente)
        VALUES(p_jugador,tipo,p_datos->>'tema',trim(p_datos->>'pregunta'),detalle,(p_datos->>'correcta')::smallint,trim(p_datos->>'dato'),nullif(trim(p_datos->>'fuente'),''));
    ELSIF p_accion IN('moderacion','moderar') THEN
      IF NOT es_admin THEN RAISE SQLSTATE 'PT403' USING MESSAGE='Solo el equipo de Latido puede moderar'; END IF;
      IF p_accion='moderar' THEN
        tipo:=p_datos->>'estado';
        IF tipo NOT IN('aprobada','rechazada','publicada') THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Estado no válido'; END IF;
        SELECT * INTO item FROM suizamente_social.propuestas WHERE id=(p_datos->>'id')::bigint FOR UPDATE;
        IF item.id IS NULL THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Propuesta no encontrada'; END IF;
        IF item.estado='publicada' THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Esta propuesta ya está publicada'; END IF;
        IF p_datos?'contenido' THEN
          detalle:=p_datos->'contenido';
          IF jsonb_typeof(detalle)<>'object' THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Contenido no válido'; END IF;
          IF item.tipo IN('dilema','real') AND detalle?'opciones' THEN
            IF jsonb_typeof(detalle->'opciones')<>'array' THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Revisa las opciones'; END IF;
            IF jsonb_array_length(detalle->'opciones') NOT BETWEEN 2 AND 3
              OR (item.tipo='dilema' AND jsonb_array_length(detalle->'opciones')<>2)
              OR EXISTS(SELECT 1 FROM jsonb_array_elements(detalle->'opciones') o
                WHERE jsonb_typeof(o)<>'string' OR length(trim(o#>>'{}')) NOT BETWEEN 1 AND 90) THEN
              RAISE SQLSTATE 'PT400' USING MESSAGE='Revisa las opciones';
            END IF;
          END IF;
          opcion:=CASE WHEN detalle?'correcta' THEN (detalle->>'correcta')::int ELSE item.correcta END;
          IF (item.tipo='real' AND (opcion IS NULL OR opcion NOT BETWEEN 0 AND jsonb_array_length(coalesce(detalle->'opciones',item.opciones))-1))
            OR (item.tipo='mito' AND (opcion IS NULL OR opcion NOT IN(0,1))) THEN
            RAISE SQLSTATE 'PT400' USING MESSAGE='Revisa la respuesta correcta';
          END IF;
          UPDATE suizamente_social.propuestas SET pregunta=coalesce(trim(detalle->>'pregunta'),pregunta),
            dato=coalesce(trim(detalle->>'dato'),dato),fuente=CASE WHEN detalle?'fuente' THEN nullif(trim(detalle->>'fuente'),'') ELSE fuente END,
            opciones=CASE WHEN item.tipo IN('dilema','real') THEN coalesce(detalle->'opciones',opciones) ELSE opciones END,
            correcta=CASE WHEN item.tipo IN('real','mito') THEN opcion ELSE NULL END WHERE id=item.id;
        END IF;
        IF tipo='publicada' AND (item.estado<>'aprobada' OR NOT EXISTS(SELECT 1 FROM suizamente_social.preguntas WHERE id=p_datos->>'preguntaId')) THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Primero aprueba e incorpora la pregunta al banco'; END IF;
        UPDATE suizamente_social.propuestas SET estado=social_api.tipo,nota=left(p_datos->>'nota',500),pregunta_id=CASE WHEN social_api.tipo='publicada' THEN p_datos->>'preguntaId' END,revisado_en=now() WHERE id=item.id;
        IF tipo='publicada' AND item.jugador IS NOT NULL THEN
          PERFORM suizamente_social.sumar(item.jugador,'propuesta',item.id::text,100,(SELECT canton FROM suizamente_social.jugadores WHERE id=item.jugador));
          PERFORM suizamente_social.logros(item.jugador);
        END IF;
        PERFORM suizamente_social.notificar(item.jugador,'propuesta:'||item.id,'Tu propuesta ha sido revisada','Consulta el estado y la nota del equipo.','/suizamente/proponer');
      END IF;
      SELECT coalesce(jsonb_agg(t ORDER BY t.creado_en DESC),'[]') INTO filas FROM
        (SELECT p.*,g.apodo FROM suizamente_social.propuestas p LEFT JOIN suizamente_social.jugadores g ON g.id=p.jugador ORDER BY p.creado_en DESC LIMIT 100) t;
      RETURN jsonb_build_object('propuestas',filas);
    END IF;
    SELECT coalesce(jsonb_agg(to_jsonb(p)-'jugador' ORDER BY creado_en DESC),'[]') INTO filas FROM suizamente_social.propuestas p WHERE jugador=p_jugador;
    RETURN jsonb_build_object('propuestas',filas);
  ELSIF p_accion='desglose' THEN
    ref:=p_datos->>'preguntaId'; tipo:=coalesce(p_datos->>'por','pais');
    IF tipo NOT IN('pais','anos') THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Desglose no válido'; END IF;
    IF NOT EXISTS(SELECT 1 FROM suizamente_social.preguntas WHERE id=ref) THEN
      RAISE SQLSTATE 'PT400' USING MESSAGE='Pregunta no válida';
    END IF;
    SELECT count(*) INTO contador FROM public.suizamente_votos WHERE pregunta_id=ref;
    IF contador<20 AND to_regprocedure('suizamente_social.desglose_demo(text,text)') IS NOT NULL THEN
      RETURN suizamente_social.desglose_demo(ref,tipo)||jsonb_build_object('tuGrupo',CASE WHEN tipo='pais' THEN j.pais ELSE j.anos_suiza END,'votosReales',contador);
    END IF;
    SELECT coalesce(jsonb_agg(t ORDER BY votos DESC),'[]') INTO filas FROM (
      SELECT CASE WHEN tipo='pais' THEN g.pais ELSE g.anos_suiza END grupo,count(*) votos,
        jsonb_build_array(count(*) FILTER(WHERE v.opcion=0),count(*) FILTER(WHERE v.opcion=1),count(*) FILTER(WHERE v.opcion=2)) conteos
      FROM public.suizamente_votos v JOIN suizamente_social.jugadores g ON g.id=v.jugador_id WHERE v.pregunta_id=ref
      AND (CASE WHEN tipo='pais' THEN g.pais ELSE g.anos_suiza END) IS NOT NULL
      GROUP BY grupo HAVING count(*)>=20) t;
    RETURN jsonb_build_object('grupos',filas,'demo',false,'minimo',20,'tuGrupo',CASE WHEN tipo='pais' THEN j.pais ELSE j.anos_suiza END);
  ELSIF p_accion='comunidad' THEN
    SELECT jsonb_build_object('preguntaId',pregunta_id,'opcion',opcion,'pct',round(100.0*n/total)::int,'votos',total) INTO resultado FROM (
      SELECT v.pregunta_id,v.opcion,count(*) n,sum(count(*)) OVER(PARTITION BY v.pregunta_id) total,
        row_number() OVER(PARTITION BY v.pregunta_id ORDER BY count(*) DESC,v.opcion) puesto
      FROM public.suizamente_votos v JOIN suizamente_social.preguntas q ON q.id=v.pregunta_id
      WHERE q.tipo='dilema' AND q.opciones=2 AND v.creado_en>=now()-interval '24 hours' GROUP BY v.pregunta_id,v.opcion
    ) t WHERE total>=30 AND puesto=1 ORDER BY total DESC,pregunta_id LIMIT 1;
    RETURN jsonb_build_object('comunidad',resultado);
  ELSIF p_accion IN('avisos','avisos_leer') THEN
    IF uid IS NULL THEN RETURN jsonb_build_object('avisos','[]'::jsonb); END IF;
    IF p_accion='avisos_leer' THEN UPDATE public.app_notifications SET read_at=now() WHERE recipient_id=uid AND kind='suizamente' AND read_at IS NULL; END IF;
    SELECT coalesce(jsonb_agg(t ORDER BY t.created_at DESC),'[]') INTO filas FROM
      (SELECT id,data,created_at,read_at FROM public.app_notifications WHERE recipient_id=uid AND kind='suizamente' ORDER BY created_at DESC LIMIT 30) t;
    RETURN jsonb_build_object('avisos',filas);
  ELSIF p_accion='borrar' THEN
    IF p_datos->>'confirmacion'<>'BORRAR' OR NOT coalesce((p_datos->>'confirmado')::boolean,false) THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Confirma el borrado de tus datos de Suizamente'; END IF;
    UPDATE public.suizamente_votos SET jugador_id='anon:'||gen_random_uuid()::text,usuario_id=NULL WHERE jugador_id=p_jugador;
    IF uid IS NOT NULL THEN DELETE FROM public.app_notifications WHERE recipient_id=uid AND kind='suizamente'; END IF;
    DELETE FROM suizamente_social.propuestas WHERE jugador=p_jugador AND estado='pendiente';
    DELETE FROM suizamente_social.jugadores WHERE id=p_jugador;
    RETURN jsonb_build_object('borrado',true);
  ELSIF p_accion NOT IN('perfil','bootstrap') THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Función no encontrada';
  END IF;
  RETURN jsonb_build_object('perfil',suizamente_social.perfil(p_jugador));
EXCEPTION WHEN check_violation OR foreign_key_violation OR invalid_text_representation OR numeric_value_out_of_range OR not_null_violation THEN
  RAISE SQLSTATE 'PT400' USING MESSAGE='Revisa los datos enviados';
END $$;
REVOKE ALL ON FUNCTION public.suizamente_social_api(text,text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.suizamente_social_api(text,text,jsonb,text) TO service_role;

COMMIT;
