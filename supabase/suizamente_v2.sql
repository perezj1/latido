-- Suizamente: base and asynchronous 1-v-1 game. Apply before suizamente_v2_datos.sql.
-- Additive migration: legacy questions, versions, answers and progress are untouched.
BEGIN;
CREATE SCHEMA IF NOT EXISTS suizamente_private;
REVOKE ALL ON SCHEMA suizamente_private FROM PUBLIC,anon,authenticated;

CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_configuracion(
  id boolean PRIMARY KEY DEFAULT true CHECK(id), juego jsonb NOT NULL, album jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_preguntas(
  id text PRIMARY KEY, payload jsonb NOT NULL, oculta boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_jugadores(
  jugador_id text PRIMARY KEY, usuario_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  apodo text NOT NULL, color text NOT NULL DEFAULT 'menta', pais text NOT NULL DEFAULT 'otro',
  canton text NOT NULL DEFAULT 'ZH', anos_suiza text NOT NULL DEFAULT 'menos1',
  en_ranking boolean NOT NULL DEFAULT true, ajustes jsonb NOT NULL DEFAULT '{}',
  xp integer NOT NULL DEFAULT 0 CHECK(xp>=0), monedas integer NOT NULL DEFAULT 0 CHECK(monedas>=0),
  inventario jsonb NOT NULL DEFAULT '{}', bloqueado boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now(), actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_sesiones_invitado(
  id uuid PRIMARY KEY, token_hash text NOT NULL,
  jugador_id text REFERENCES suizamente_private.suizamente_jugadores(jugador_id) ON DELETE SET NULL,
  vinculada_a uuid, creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_movimientos(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, jugador_id text NOT NULL,
  motivo text NOT NULL, ref text NOT NULL, xp integer NOT NULL DEFAULT 0,
  monedas integer NOT NULL DEFAULT 0, inventario jsonb NOT NULL DEFAULT '{}',
  creado_en timestamptz NOT NULL DEFAULT now(), UNIQUE(jugador_id,motivo,ref)
);
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_votos(
  pregunta_id text NOT NULL REFERENCES suizamente_private.suizamente_preguntas(id),
  jugador_id text NOT NULL, opcion smallint NOT NULL CHECK(opcion BETWEEN 0 AND 2),
  creado_en timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(pregunta_id,jugador_id)
);
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_partidas(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jugador_a text NOT NULL, jugador_b text, turno text, turno_n integer NOT NULL DEFAULT 1,
  ronda integer NOT NULL DEFAULT 1, turnos_jugados integer NOT NULL DEFAULT 0,
  sellos_a text[] NOT NULL DEFAULT '{}', sellos_b text[] NOT NULL DEFAULT '{}',
  barra_a integer NOT NULL DEFAULT 0 CHECK(barra_a BETWEEN 0 AND 3),
  barra_b integer NOT NULL DEFAULT 0 CHECK(barra_b BETWEEN 0 AND 3),
  aciertos_a integer NOT NULL DEFAULT 0, aciertos_b integer NOT NULL DEFAULT 0,
  tiempo_a numeric NOT NULL DEFAULT 0, tiempo_b numeric NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'buscando', fase text NOT NULL DEFAULT 'girar',
  casilla text, ganador text, motivo_fin text, plazo timestamptz NOT NULL,
  reglas jsonb NOT NULL, creada_en timestamptz NOT NULL DEFAULT now(), terminada_en timestamptz,
  CHECK(jugador_a IS DISTINCT FROM jugador_b)
);
CREATE INDEX IF NOT EXISTS suizamente_v2_partidas_a ON suizamente_private.suizamente_partidas(jugador_a,creada_en DESC);
CREATE INDEX IF NOT EXISTS suizamente_v2_partidas_b ON suizamente_private.suizamente_partidas(jugador_b,creada_en DESC);
CREATE INDEX IF NOT EXISTS suizamente_v2_plazos ON suizamente_private.suizamente_partidas(plazo) WHERE estado IN ('buscando','jugando');
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_partida_preguntas(
  partida_id uuid NOT NULL REFERENCES suizamente_private.suizamente_partidas(id) ON DELETE CASCADE,
  jugador_id text NOT NULL, n integer NOT NULL, modo text NOT NULL, categoria text NOT NULL,
  pregunta_id text NOT NULL, payload jsonb NOT NULL, orden smallint[] NOT NULL,
  enviada_en timestamptz NOT NULL DEFAULT now(), vence_en timestamptz NOT NULL,
  opcion smallint, acierto boolean, respondida_en timestamptz, agotada boolean NOT NULL DEFAULT false,
  version_respuesta integer, PRIMARY KEY(partida_id,n)
);
CREATE INDEX IF NOT EXISTS suizamente_v2_vistas ON suizamente_private.suizamente_partida_preguntas(jugador_id,pregunta_id,enviada_en DESC);
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_invitaciones(
  codigo text PRIMARY KEY, jugador_id text NOT NULL, caduca_en timestamptz NOT NULL,
  usada_por text, partida_id uuid REFERENCES suizamente_private.suizamente_partidas(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_avisos(
  jugador_id text NOT NULL, partida_id uuid NOT NULL, turno_n integer NOT NULL,
  tipo text NOT NULL, texto text NOT NULL, creado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(jugador_id,partida_id,turno_n,tipo)
);
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_limites(
  clave text PRIMARY KEY, minuto timestamptz NOT NULL, peticiones integer NOT NULL
);
-- Preserve all existing notification kinds when extending Latido's inbox.
DO $$ DECLARE definition text; BEGIN
  IF to_regclass('public.app_notifications') IS NOT NULL THEN
    SELECT pg_get_constraintdef(oid) INTO definition FROM pg_constraint
      WHERE conrelid='public.app_notifications'::regclass AND conname='app_notifications_kind_check';
    IF definition IS NOT NULL AND definition NOT LIKE '%suizamente_turno%' THEN
      ALTER TABLE public.app_notifications DROP CONSTRAINT app_notifications_kind_check;
      EXECUTE 'ALTER TABLE public.app_notifications ADD CONSTRAINT app_notifications_kind_check '||
        regexp_replace(definition,'^CHECK \(','CHECK (kind IN (''suizamente_turno'',''suizamente_plazo'') OR ');
    END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION suizamente_private.v2_config() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT juego FROM suizamente_private.suizamente_configuracion WHERE id
$$;
CREATE OR REPLACE FUNCTION suizamente_private.v2_nivel(x integer) RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer:=1; restante integer:=x; c jsonb:=suizamente_private.v2_config();
BEGIN
  WHILE restante>=((c#>>'{niveles,a}')::integer*n+(c#>>'{niveles,b}')::integer) LOOP
    restante:=restante-((c#>>'{niveles,a}')::integer*n+(c#>>'{niveles,b}')::integer); n:=n+1;
  END LOOP;
  RETURN n;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v2_identidad(guest uuid,token text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=auth.uid(); actor text; s suizamente_private.suizamente_sesiones_invitado; banned boolean;
BEGIN
  IF uid IS NOT NULL THEN
    IF to_regclass('public.profiles') IS NOT NULL THEN
      EXECUTE 'SELECT coalesce((to_jsonb(p)->>''banned'')::boolean,false) FROM public.profiles p WHERE id=$1' INTO banned USING uid;
      IF banned THEN RAISE EXCEPTION 'SZV2:403:Esta cuenta no puede jugar'; END IF;
    END IF;
    RETURN uid::text;
  END IF;
  IF guest IS NULL OR length(coalesce(token,''))<40 OR length(token)>256 THEN RAISE EXCEPTION 'SZV2:401:Sesión de invitado no válida'; END IF;
  SELECT * INTO s FROM suizamente_private.suizamente_sesiones_invitado WHERE id=guest FOR UPDATE;
  IF FOUND THEN
    IF s.token_hash<>encode(sha256(convert_to(token,'UTF8')),'hex') OR s.vinculada_a IS NOT NULL THEN RAISE EXCEPTION 'SZV2:401:Sesión de invitado no válida'; END IF;
  ELSE
    INSERT INTO suizamente_private.suizamente_sesiones_invitado(id,token_hash)
      VALUES(guest,encode(sha256(convert_to(token,'UTF8')),'hex'));
  END IF;
  actor:='invitado-'||guest::text;
  RETURN actor;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v2_avisar(m suizamente_private.suizamente_partidas,tipo text DEFAULT 'suizamente_turno') RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid; other_name text; message text; inserted integer; notification_version integer;
BEGIN
  IF m.turno IS NULL THEN RETURN; END IF;
  SELECT usuario_id INTO uid FROM suizamente_private.suizamente_jugadores WHERE jugador_id=m.turno
    AND coalesce((ajustes#>>'{avisos,turnos}')::boolean,true);
  SELECT apodo INTO other_name FROM suizamente_private.suizamente_jugadores
    WHERE jugador_id=CASE WHEN m.turno=m.jugador_a THEN m.jugador_b ELSE m.jugador_a END;
  message:=CASE WHEN tipo='suizamente_plazo' THEN '⏳ Te quedan 6 h contra ' ELSE '¡Te toca contra ' END||coalesce(other_name,'tu rival')||CASE WHEN tipo='suizamente_turno' THEN '!' ELSE '' END;
  notification_version:=CASE WHEN tipo='suizamente_plazo' THEN m.turnos_jugados ELSE m.turno_n END;
  INSERT INTO suizamente_private.suizamente_avisos(jugador_id,partida_id,turno_n,tipo,texto)
    VALUES(m.turno,m.id,notification_version,tipo,message) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted=ROW_COUNT;
  IF uid IS NOT NULL AND inserted>0 AND to_regclass('public.app_notifications') IS NOT NULL THEN
    EXECUTE 'INSERT INTO public.app_notifications(recipient_id,kind,source_id,data) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING'
      USING uid,tipo,m.id::text||':'||notification_version::text,
      jsonb_build_object('title',message,'href','/suizamente/partida/'||m.id::text);
  END IF;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v2_cerrar(mid uuid,winner text,reason text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  UPDATE suizamente_private.suizamente_partida_preguntas SET respondida_en=clock_timestamp(),acierto=false,agotada=true,
    version_respuesta=(SELECT turno_n+1 FROM suizamente_private.suizamente_partidas WHERE id=mid)
    WHERE partida_id=mid AND respondida_en IS NULL;
  UPDATE suizamente_private.suizamente_partidas SET estado=CASE WHEN reason='plazo' THEN 'caducada' WHEN reason='rendicion' THEN 'abandonada' ELSE 'terminada' END,
    ganador=winner,motivo_fin=reason,fase='terminada',terminada_en=clock_timestamp(),turno_n=turno_n+1 WHERE id=mid;
$$;
CREATE OR REPLACE FUNCTION suizamente_private.v2_responder(mid uuid,actor text,nq integer,choice integer,automatic boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m suizamente_private.suizamente_partidas; q suizamente_private.suizamente_partida_preguntas;
  ok boolean; expired boolean; t timestamptz:=clock_timestamp(); other text; winner text; duration numeric; cfg jsonb; threshold integer;
BEGIN
  SELECT * INTO m FROM suizamente_private.suizamente_partidas WHERE id=mid FOR UPDATE;
  SELECT * INTO q FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=mid AND n=nq FOR UPDATE;
  IF q.partida_id IS NULL OR q.jugador_id<>actor OR q.respondida_en IS NOT NULL OR m.turno IS DISTINCT FROM actor OR m.fase<>'pregunta'
    THEN RAISE EXCEPTION 'SZV2:409:La pregunta ya no está disponible'; END IF;
  expired:=t>q.vence_en+make_interval(secs=>(m.reglas#>>'{partida,margenServidorSegundos}')::integer);
  IF NOT automatic AND NOT expired AND (choice IS NULL OR choice<0 OR choice>=jsonb_array_length(q.payload->'opciones'))
    THEN RAISE EXCEPTION 'SZV2:400:Elige una opción válida'; END IF;
  IF automatic AND NOT expired THEN RAISE EXCEPTION 'SZV2:409:El tiempo sigue corriendo'; END IF;
  ok:=NOT expired AND choice=(q.payload->>'correcta')::integer;
  duration:=least(greatest(0,extract(epoch FROM t-q.enviada_en)),
    (m.reglas#>>'{partida,segundosPorPregunta}')::integer+(m.reglas#>>'{partida,margenServidorSegundos}')::integer);
  UPDATE suizamente_private.suizamente_partida_preguntas SET opcion=CASE WHEN expired THEN NULL ELSE choice END,
    acierto=ok,agotada=expired,respondida_en=t,version_respuesta=m.turno_n+1 WHERE partida_id=mid AND n=nq;
  IF NOT expired THEN
    INSERT INTO suizamente_private.suizamente_votos(pregunta_id,jugador_id,opcion)
      VALUES(q.pregunta_id,actor,choice) ON CONFLICT DO NOTHING;
  END IF;
  -- Every change of stamps is also represented in the idempotent ledger.
  IF ok AND q.modo='sello' THEN
    INSERT INTO suizamente_private.suizamente_movimientos(jugador_id,motivo,ref,inventario)
      VALUES(actor,'sello',mid::text||':'||nq::text,jsonb_build_object('sello',q.categoria)) ON CONFLICT DO NOTHING;
  END IF;
  threshold:=(m.reglas#>>'{partida,barraParaSello}')::integer;
  IF actor=m.jugador_a THEN
    m.tiempo_a:=m.tiempo_a+duration; m.aciertos_a:=m.aciertos_a+CASE WHEN ok THEN 1 ELSE 0 END;
    m.barra_a:=CASE WHEN q.modo='sello' OR NOT ok THEN 0 ELSE least(threshold,m.barra_a+1) END;
    IF ok AND q.modo='sello' THEN m.sellos_a:=array_append(m.sellos_a,q.categoria); END IF;
  ELSE
    m.tiempo_b:=m.tiempo_b+duration; m.aciertos_b:=m.aciertos_b+CASE WHEN ok THEN 1 ELSE 0 END;
    m.barra_b:=CASE WHEN q.modo='sello' OR NOT ok THEN 0 ELSE least(threshold,m.barra_b+1) END;
    IF ok AND q.modo='sello' THEN m.sellos_b:=array_append(m.sellos_b,q.categoria); END IF;
  END IF;
  IF NOT ok THEN
    other:=CASE WHEN actor=m.jugador_a THEN m.jugador_b ELSE m.jugador_a END;
    m.turno:=other; m.turnos_jugados:=m.turnos_jugados+1;
    m.ronda:=m.turnos_jugados/2+1;
    m.fase:=CASE WHEN other IS NULL THEN 'espera' ELSE 'girar' END;
    m.plazo:=t+make_interval(hours=>(m.reglas#>>'{partida,horasPorTurno}')::integer);
  ELSE
    m.fase:=CASE WHEN (CASE WHEN actor=m.jugador_a THEN m.barra_a ELSE m.barra_b END)>=threshold THEN 'sello' ELSE 'girar' END;
  END IF;
  UPDATE suizamente_private.suizamente_partidas SET sellos_a=m.sellos_a,sellos_b=m.sellos_b,barra_a=m.barra_a,barra_b=m.barra_b,
    aciertos_a=m.aciertos_a,aciertos_b=m.aciertos_b,tiempo_a=m.tiempo_a,tiempo_b=m.tiempo_b,
    turno=m.turno,turnos_jugados=m.turnos_jugados,ronda=m.ronda,fase=m.fase,casilla=NULL,plazo=m.plazo,turno_n=turno_n+1 WHERE id=mid;
  IF cardinality(m.sellos_a)>=(m.reglas#>>'{partida,sellosParaGanar}')::integer OR cardinality(m.sellos_b)>=(m.reglas#>>'{partida,sellosParaGanar}')::integer THEN
    PERFORM suizamente_private.v2_cerrar(mid,actor,'sellos');
  ELSIF m.ronda>(m.reglas#>>'{partida,rondasMax}')::integer THEN
    winner:=CASE WHEN cardinality(m.sellos_a)>cardinality(m.sellos_b) THEN m.jugador_a
      WHEN cardinality(m.sellos_b)>cardinality(m.sellos_a) THEN m.jugador_b
      WHEN m.aciertos_a>m.aciertos_b THEN m.jugador_a WHEN m.aciertos_b>m.aciertos_a THEN m.jugador_b
      WHEN m.tiempo_a<m.tiempo_b THEN m.jugador_a WHEN m.tiempo_b<m.tiempo_a THEN m.jugador_b ELSE NULL END;
    PERFORM suizamente_private.v2_cerrar(mid,winner,'rondas');
  ELSIF NOT ok THEN
    SELECT * INTO m FROM suizamente_private.suizamente_partidas WHERE id=mid;
    PERFORM suizamente_private.v2_avisar(m);
  END IF;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v2_actualizar(mid uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m suizamente_private.suizamente_partidas; q suizamente_private.suizamente_partida_preguntas; t timestamptz:=clock_timestamp();
BEGIN
  SELECT * INTO m FROM suizamente_private.suizamente_partidas WHERE id=mid FOR UPDATE;
  IF m.estado NOT IN ('buscando','jugando') THEN RETURN; END IF;
  IF m.jugador_b IS NOT NULL AND m.plazo<t THEN
    PERFORM suizamente_private.v2_cerrar(mid,CASE WHEN m.turno=m.jugador_a THEN m.jugador_b ELSE m.jugador_a END,'plazo');
    RETURN;
  END IF;
  SELECT * INTO q FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=mid AND respondida_en IS NULL;
  IF q.partida_id IS NOT NULL AND q.vence_en+make_interval(secs=>(m.reglas#>>'{partida,margenServidorSegundos}')::integer)<t THEN
    PERFORM suizamente_private.v2_responder(mid,q.jugador_id,q.n,NULL,true);
  END IF;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v2_ver(mid uuid,actor text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m suizamente_private.suizamente_partidas; q suizamente_private.suizamente_partida_preguntas;
  other text; mine boolean; question jsonb; result jsonb; counts jsonb; total integer; correct_votes integer; c jsonb;
BEGIN
  SELECT * INTO m FROM suizamente_private.suizamente_partidas WHERE id=mid;
  IF m.id IS NULL OR (actor<>m.jugador_a AND actor IS DISTINCT FROM m.jugador_b) THEN RAISE EXCEPTION 'SZV2:404:Partida no encontrada'; END IF;
  PERFORM suizamente_private.v2_actualizar(mid);
  SELECT * INTO m FROM suizamente_private.suizamente_partidas WHERE id=mid;
  mine:=actor=m.jugador_a; other:=CASE WHEN mine THEN m.jugador_b ELSE m.jugador_a END;
  SELECT * INTO q FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=mid AND jugador_id=actor ORDER BY n DESC LIMIT 1;
  IF q.partida_id IS NOT NULL THEN
    question:=jsonb_build_object('n',q.n,'modo',q.modo,'categoria',q.categoria,'preguntaId',q.pregunta_id,
      'emoji',q.payload->'emoji','pregunta',q.payload->'pregunta','opciones',
      (SELECT jsonb_agg(jsonb_build_object('indice',i,'e',q.payload->'opciones'->i->>'e','t',q.payload->'opciones'->i->>'t') ORDER BY ord) FROM unnest(q.orden) WITH ORDINALITY AS o(i,ord)),
      'enviadaEn',q.enviada_en,'venceEn',q.vence_en,'tiempo',(m.reglas#>>'{partida,segundosPorPregunta}')::integer);
    IF q.respondida_en IS NOT NULL THEN
      SELECT count(*),count(*) FILTER(WHERE opcion=(q.payload->>'correcta')::integer) INTO total,correct_votes
        FROM suizamente_private.suizamente_votos WHERE pregunta_id=q.pregunta_id;
      result:=question||jsonb_build_object('ok',q.acierto,'opcion',q.opcion,'correcta',q.payload->'correcta','dato',q.payload->'dato','agotada',q.agotada,
        'pct',CASE WHEN total>=(m.reglas->>'minimoVotosParaPorcentajes')::integer THEN round(100.0*correct_votes/total) ELSE NULL END);
      IF q.version_respuesta<>m.turno_n AND NOT (m.fase='terminada' AND q.version_respuesta=m.turno_n-1) THEN result:=NULL; END IF;
      question:=NULL;
    END IF;
  END IF;
  RETURN jsonb_build_object('id',m.id,'turnoN',m.turno_n,'ronda',least(m.ronda,(m.reglas#>>'{partida,rondasMax}')::integer),
    'rondasMax',m.reglas#>'{partida,rondasMax}','estado',m.estado,'fase',m.fase,'casilla',m.casilla,'teToca',m.turno=actor,
    'plazo',m.plazo,'ganador',m.ganador,'motivoFin',m.motivo_fin,'tuId',actor,
    'tusSellos',CASE WHEN mine THEN to_jsonb(m.sellos_a) ELSE to_jsonb(m.sellos_b) END,
    'susSellos',CASE WHEN mine THEN to_jsonb(m.sellos_b) ELSE to_jsonb(m.sellos_a) END,
    'tuBarra',CASE WHEN mine THEN m.barra_a ELSE m.barra_b END,'suBarra',CASE WHEN mine THEN m.barra_b ELSE m.barra_a END,
    'rival',(SELECT jsonb_build_object('id',jugador_id,'apodo',apodo,'color',color,'nivel',suizamente_private.v2_nivel(xp)) FROM suizamente_private.suizamente_jugadores WHERE jugador_id=other),
    'pregunta',question,'resultado',result,'servidorAhora',clock_timestamp());
END $$;

CREATE OR REPLACE FUNCTION public.suizamente_v2(p_action text,p_args jsonb DEFAULT '{}',p_guest_id uuid DEFAULT NULL,p_guest_token text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor text; uid uuid:=auth.uid(); c jsonb; pl suizamente_private.suizamente_jugadores;
  m suizamente_private.suizamente_partidas; q suizamente_private.suizamente_partida_preguntas;
  inv suizamente_private.suizamente_invitaciones; guest suizamente_private.suizamente_sesiones_invitado;
  body jsonb:=coalesce(p_args,'{}'); result jsonb; item jsonb; rival text; mid uuid; category text; mode text;
  num integer; choice integer; inserted integer; gift jsonb; gift_coins integer; legacy_xp integer:=0;
  seen_before boolean:=false; rec record; minute_start timestamptz:=date_trunc('minute',clock_timestamp()); request_count integer;
BEGIN
  c:=suizamente_private.v2_config();
  IF c IS NULL THEN RAISE EXCEPTION 'SZV2:503:Faltan los datos de Suizamente. Aplica suizamente_v2_datos.sql'; END IF;
  IF jsonb_typeof(body)<>'object' OR octet_length(body::text)>10000 THEN RAISE EXCEPTION 'SZV2:400:Solicitud no válida'; END IF;
  actor:=suizamente_private.v2_identidad(p_guest_id,p_guest_token);
  IF p_action='crear_partida' THEN PERFORM pg_advisory_xact_lock(72819423); END IF;
  INSERT INTO suizamente_private.suizamente_limites(clave,minuto,peticiones) VALUES(actor,minute_start,1)
    ON CONFLICT(clave) DO UPDATE SET minuto=excluded.minuto,
      peticiones=CASE WHEN suizamente_limites.minuto=excluded.minuto THEN suizamente_limites.peticiones+1 ELSE 1 END RETURNING peticiones INTO request_count;
  IF request_count>60 THEN RAISE EXCEPTION 'SZV2:429:Espera un momento antes de continuar'; END IF;
  SELECT * INTO pl FROM suizamente_private.suizamente_jugadores WHERE jugador_id=actor FOR UPDATE;
  IF pl.bloqueado THEN RAISE EXCEPTION 'SZV2:403:Esta cuenta no puede jugar'; END IF;
  IF p_action='jugador' THEN
    RETURN jsonb_build_object('jugador',CASE WHEN pl.jugador_id IS NULL THEN NULL ELSE to_jsonb(pl)-'bloqueado'-'usuario_id'||jsonb_build_object('nivel',suizamente_private.v2_nivel(pl.xp)) END,
      'identidad',actor,'conCuenta',uid IS NOT NULL,'servidorAhora',clock_timestamp());
  END IF;
  IF p_action='guardar_jugador' THEN
    IF body->>'apodo' IS NULL OR btrim(body->>'apodo') !~ '^[[:alnum:] ._-]{2,20}$' OR lower(body->>'apodo') ~ '(mierda|puta|puto|cabron|cabrón|fuck|shit)'
      OR coalesce(body->>'color','') NOT IN ('menta','naranja','rojo','azul','cielo','mar')
      OR coalesce(body->>'pais','') NOT IN ('AR','BO','CL','CO','CR','CU','DO','EC','SV','GQ','ES','GT','HN','MX','NI','PA','PY','PE','PR','UY','VE','CH','otro')
      OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(c#>'{mapa,regiones}') r CROSS JOIN LATERAL jsonb_array_elements(r->'cantones') k WHERE k->>'id'=body->>'canton')
      OR coalesce(body->>'anos_suiza','') NOT IN ('menos1','1a3','3a10','mas10')
      THEN RAISE EXCEPTION 'SZV2:400:Revisa los datos del perfil'; END IF;
    IF body ? 'ajustes' AND (jsonb_typeof(body->'ajustes')<>'object' OR octet_length((body->'ajustes')::text)>2500) THEN RAISE EXCEPTION 'SZV2:400:Ajustes no válidos'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_each(coalesce(body->'ajustes','{}')) a WHERE
      (a.key IN ('sonidos','vibracion','menosAnimaciones') AND jsonb_typeof(a.value)<>'boolean')
      OR (a.key='apariencia' AND a.value#>>'{}' NOT IN ('auto','clara','oscura'))
      OR (a.key='avisos' AND jsonb_typeof(a.value)<>'object'))
      THEN RAISE EXCEPTION 'SZV2:400:Ajustes no válidos'; END IF;
    IF body#>'{ajustes,avisos}' IS NOT NULL AND EXISTS(SELECT 1 FROM jsonb_each(body#>'{ajustes,avisos}') a WHERE jsonb_typeof(a.value)<>'boolean') THEN RAISE EXCEPTION 'SZV2:400:Avisos no válidos'; END IF;
    INSERT INTO suizamente_private.suizamente_jugadores(jugador_id,usuario_id,apodo,color,pais,canton,anos_suiza,en_ranking,ajustes)
      VALUES(actor,uid,btrim(body->>'apodo'),body->>'color',body->>'pais',body->>'canton',body->>'anos_suiza',coalesce((body->>'en_ranking')::boolean,true),coalesce(body->'ajustes','{}'))
      ON CONFLICT(jugador_id) DO UPDATE SET apodo=excluded.apodo,color=excluded.color,pais=excluded.pais,canton=excluded.canton,
        anos_suiza=excluded.anos_suiza,en_ranking=excluded.en_ranking,ajustes=suizamente_jugadores.ajustes||excluded.ajustes,actualizado_en=clock_timestamp();
    IF uid IS NULL THEN UPDATE suizamente_private.suizamente_sesiones_invitado SET jugador_id=actor WHERE id=p_guest_id; END IF;
  ELSIF p_action='vincular' THEN
    IF uid IS NULL THEN RAISE EXCEPTION 'SZV2:401:Entra con tu cuenta de Latido'; END IF;
    SELECT * INTO guest FROM suizamente_private.suizamente_sesiones_invitado WHERE id=p_guest_id FOR UPDATE;
    IF guest.id IS NULL THEN RETURN jsonb_build_object('vinculado',false); END IF;
    IF guest.token_hash<>encode(sha256(convert_to(coalesce(p_guest_token,''),'UTF8')),'hex') OR (guest.vinculada_a IS NOT NULL AND guest.vinculada_a<>uid)
      THEN RAISE EXCEPTION 'SZV2:401:No se puede vincular este invitado'; END IF;
    IF guest.vinculada_a=uid THEN RETURN jsonb_build_object('vinculado',true); END IF;
    IF guest.jugador_id IS NOT NULL THEN
      -- Avoid turning an active match between these identities into a self-match.
      IF EXISTS(SELECT 1 FROM suizamente_private.suizamente_partidas WHERE estado IN ('buscando','jugando') AND
        ((jugador_a=actor AND jugador_b=guest.jugador_id) OR (jugador_b=actor AND jugador_a=guest.jugador_id))) THEN
        RAISE EXCEPTION 'SZV2:409:Termina primero la partida entre tu cuenta y tu invitado';
      END IF;
      INSERT INTO suizamente_private.suizamente_jugadores(jugador_id,usuario_id,apodo,color,pais,canton,anos_suiza,en_ranking,ajustes)
        SELECT actor,uid,apodo,color,pais,canton,anos_suiza,en_ranking,ajustes FROM suizamente_private.suizamente_jugadores WHERE jugador_id=guest.jugador_id ON CONFLICT DO NOTHING;
      SELECT * INTO pl FROM suizamente_private.suizamente_jugadores WHERE jugador_id=actor FOR UPDATE;
      INSERT INTO suizamente_private.suizamente_votos SELECT pregunta_id,actor,opcion,creado_en FROM suizamente_private.suizamente_votos WHERE jugador_id=guest.jugador_id ON CONFLICT DO NOTHING;
      INSERT INTO suizamente_private.suizamente_movimientos(jugador_id,motivo,ref,xp,monedas,inventario,creado_en)
        SELECT actor,motivo,ref,xp,monedas,inventario,creado_en FROM suizamente_private.suizamente_movimientos WHERE jugador_id=guest.jugador_id ON CONFLICT DO NOTHING;
      IF to_regclass('suizamente_private.answers') IS NOT NULL THEN
        EXECUTE 'SELECT EXISTS(SELECT 1 FROM suizamente_private.answers WHERE user_id=$1)' INTO seen_before USING uid;
        IF seen_before THEN
          UPDATE suizamente_private.suizamente_movimientos SET monedas=greatest(monedas,(c#>>'{recompensas,quienYaJugaba,monedas}')::integer)
            WHERE jugador_id=actor AND motivo='bienvenida' AND ref='unica';
        END IF;
      END IF;
      UPDATE suizamente_private.suizamente_jugadores SET monedas=(SELECT coalesce(sum(monedas),0) FROM suizamente_private.suizamente_movimientos WHERE jugador_id=actor),
        xp=(SELECT coalesce(sum(xp),0) FROM suizamente_private.suizamente_movimientos WHERE jugador_id=actor),
        inventario=CASE WHEN EXISTS(SELECT 1 FROM suizamente_private.suizamente_movimientos WHERE jugador_id=actor AND motivo='bienvenida') THEN c#>'{recompensas,bienvenida,comodines}'||jsonb_build_object('sobres',c#>'{recompensas,bienvenida,sobres}') ELSE '{}'::jsonb END,
        ajustes=(SELECT ajustes FROM suizamente_private.suizamente_jugadores WHERE jugador_id=guest.jugador_id)||pl.ajustes WHERE jugador_id=actor;
      UPDATE suizamente_private.suizamente_partidas SET jugador_a=CASE WHEN jugador_a=guest.jugador_id THEN actor ELSE jugador_a END,
        jugador_b=CASE WHEN jugador_b=guest.jugador_id THEN actor ELSE jugador_b END,
        turno=CASE WHEN turno=guest.jugador_id THEN actor ELSE turno END,
        ganador=CASE WHEN ganador=guest.jugador_id THEN actor ELSE ganador END WHERE jugador_a=guest.jugador_id OR jugador_b=guest.jugador_id;
      UPDATE suizamente_private.suizamente_partida_preguntas SET jugador_id=actor WHERE jugador_id=guest.jugador_id;
      DELETE FROM suizamente_private.suizamente_votos WHERE jugador_id=guest.jugador_id;
      DELETE FROM suizamente_private.suizamente_movimientos WHERE jugador_id=guest.jugador_id;
      DELETE FROM suizamente_private.suizamente_jugadores WHERE jugador_id=guest.jugador_id;
    END IF;
    UPDATE suizamente_private.suizamente_sesiones_invitado SET vinculada_a=uid WHERE id=p_guest_id;
    RETURN jsonb_build_object('vinculado',true);
  ELSE
    IF pl.jugador_id IS NULL THEN RAISE EXCEPTION 'SZV2:404:Crea primero tu perfil'; END IF;
    IF p_action='bienvenida' THEN
      gift:=c#>'{recompensas,bienvenida}'; gift_coins:=(gift->>'monedas')::integer;
      IF uid IS NOT NULL AND to_regclass('suizamente_private.answers') IS NOT NULL THEN
        EXECUTE 'SELECT EXISTS(SELECT 1 FROM suizamente_private.answers WHERE user_id=$1)' INTO seen_before USING uid;
      END IF;
      IF seen_before THEN gift_coins:=(c#>>'{recompensas,quienYaJugaba,monedas}')::integer; END IF;
      INSERT INTO suizamente_private.suizamente_movimientos(jugador_id,motivo,ref,monedas,inventario)
        VALUES(actor,'bienvenida','unica',gift_coins,gift->'comodines'||jsonb_build_object('sobres',gift->'sobres')) ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS inserted=ROW_COUNT;
      IF inserted>0 THEN UPDATE suizamente_private.suizamente_jugadores SET monedas=monedas+gift_coins,
        inventario=gift->'comodines'||jsonb_build_object('sobres',gift->'sobres') WHERE jugador_id=actor; END IF;
      UPDATE suizamente_private.suizamente_jugadores SET ajustes=ajustes||jsonb_build_object('onboarding',coalesce(ajustes->>'onboarding',clock_timestamp()::text)) WHERE jugador_id=actor;
    ELSIF p_action='borrar_jugador' THEN
      IF body->>'confirmacion' IS DISTINCT FROM 'BORRAR' THEN RAISE EXCEPTION 'SZV2:400:Confirma el borrado'; END IF;
      FOR rec IN SELECT id FROM suizamente_private.suizamente_partidas WHERE actor IN (jugador_a,jugador_b) AND estado IN ('buscando','jugando') ORDER BY id LOOP
        SELECT * INTO m FROM suizamente_private.suizamente_partidas WHERE id=rec.id FOR UPDATE;
        PERFORM suizamente_private.v2_cerrar(m.id,CASE WHEN actor=m.jugador_a THEN m.jugador_b ELSE m.jugador_a END,'rendicion');
      END LOOP;
      UPDATE suizamente_private.suizamente_votos SET jugador_id='borrado-'||gen_random_uuid()::text WHERE jugador_id=actor;
      DELETE FROM suizamente_private.suizamente_partidas WHERE actor IN (jugador_a,jugador_b);
      DELETE FROM suizamente_private.suizamente_invitaciones WHERE jugador_id=actor;
      DELETE FROM suizamente_private.suizamente_movimientos WHERE jugador_id=actor;
      DELETE FROM suizamente_private.suizamente_avisos WHERE jugador_id=actor;
      DELETE FROM suizamente_private.suizamente_jugadores WHERE jugador_id=actor;
      RETURN jsonb_build_object('borrado',true);
    ELSIF p_action IN ('votos','votos_mios','votos_resumen') THEN
      IF p_action='votos_mios' THEN RETURN jsonb_build_object('votos',coalesce((SELECT jsonb_object_agg(pregunta_id,opcion) FROM suizamente_private.suizamente_votos WHERE jugador_id=actor),'{}')); END IF;
      IF p_action='votos' THEN
        SELECT payload INTO item FROM suizamente_private.suizamente_preguntas WHERE id=body->>'preguntaId' AND NOT oculta;
        choice:=(body->>'opcion')::integer;
        IF item IS NULL OR choice IS NULL OR choice<0 OR choice>=jsonb_array_length(item->'opciones') THEN RAISE EXCEPTION 'SZV2:400:Voto no válido'; END IF;
        -- Real questions may only be answered through the game state machine.
        IF item->>'tipo'<>'dilema' THEN RAISE EXCEPTION 'SZV2:409:Responde esta pregunta dentro de una partida'; END IF;
        INSERT INTO suizamente_private.suizamente_votos(pregunta_id,jugador_id,opcion) VALUES(body->>'preguntaId',actor,choice) ON CONFLICT DO NOTHING;
        GET DIAGNOSTICS inserted=ROW_COUNT;
        RETURN jsonb_build_object('yaVotado',inserted=0,'opcion',(SELECT opcion FROM suizamente_private.suizamente_votos WHERE pregunta_id=body->>'preguntaId' AND jugador_id=actor),
          'reparto',(SELECT jsonb_agg((SELECT count(*) FROM suizamente_private.suizamente_votos WHERE pregunta_id=body->>'preguntaId' AND opcion=i) ORDER BY i) FROM generate_series(0,jsonb_array_length(item->'opciones')-1) i),
          'dato',item->'dato');
      END IF;
      RETURN jsonb_build_object('conteos',coalesce((SELECT jsonb_object_agg(id,counts) FROM (
        SELECT p.id,(SELECT jsonb_agg((SELECT count(*) FROM suizamente_private.suizamente_votos WHERE pregunta_id=p.id AND opcion=i) ORDER BY i) FROM generate_series(0,jsonb_array_length(p.payload->'opciones')-1) i) counts
        FROM suizamente_private.suizamente_preguntas p WHERE EXISTS(SELECT 1 FROM suizamente_private.suizamente_votos WHERE pregunta_id=p.id)) sub),'{}'));
    ELSIF p_action='jugadores' THEN
      IF uid IS NULL THEN RAISE EXCEPTION 'SZV2:401:Entra para buscar jugadores'; END IF;
      RETURN coalesce((SELECT jsonb_agg(v) FROM (SELECT jugador_id AS id,apodo,color,suizamente_private.v2_nivel(xp) nivel
        FROM suizamente_private.suizamente_jugadores WHERE usuario_id IS NOT NULL AND jugador_id<>actor AND NOT bloqueado
        AND apodo ILIKE '%'||left(coalesce(body->>'q',''),30)||'%' ORDER BY apodo LIMIT 20) v),'[]');
    ELSIF p_action='invitaciones' THEN
      IF uid IS NULL THEN RAISE EXCEPTION 'SZV2:401:Entra para invitar a alguien'; END IF;
      INSERT INTO suizamente_private.suizamente_invitaciones(codigo,jugador_id,caduca_en)
        VALUES(substr(md5(gen_random_uuid()::text),1,8),actor,clock_timestamp()+make_interval(days=>(c#>>'{partida,invitacionDias}')::integer)) RETURNING * INTO inv;
      RETURN jsonb_build_object('codigo',inv.codigo,'enlace','/suizamente/invitar/'||inv.codigo);
    ELSIF p_action='crear_partida' THEN
      IF (SELECT count(*) FROM suizamente_private.suizamente_partidas WHERE actor IN (jugador_a,jugador_b) AND estado IN ('buscando','jugando')) >= (c#>>'{partida,partidasAbiertasMax}')::integer THEN RAISE EXCEPTION 'SZV2:409:Tienes demasiadas partidas abiertas'; END IF;
      rival:=body->>'rival';
      IF coalesce(rival,'')='' THEN RAISE EXCEPTION 'SZV2:400:Elige un rival'; END IF;
      IF rival<>'azar' AND length(rival)=8 THEN
        SELECT * INTO inv FROM suizamente_private.suizamente_invitaciones WHERE codigo=rival FOR UPDATE;
        IF inv.codigo IS NULL OR inv.caduca_en<clock_timestamp() THEN RAISE EXCEPTION 'SZV2:404:La invitación ha caducado'; END IF;
        IF inv.usada_por IS NOT NULL THEN RAISE EXCEPTION 'SZV2:409:La invitación ya se ha usado'; END IF;
        rival:=inv.jugador_id;
      END IF;
      IF rival='azar' THEN
        -- Serialize queue matching, not gameplay. No simulated opponent.
        PERFORM pg_advisory_xact_lock(72819423);
        SELECT a.* INTO m FROM suizamente_private.suizamente_partidas a JOIN suizamente_private.suizamente_jugadores j ON j.jugador_id=a.jugador_a
          WHERE a.jugador_b IS NULL AND a.estado='buscando' AND a.jugador_a<>actor
          AND (j.usuario_id IS NOT NULL OR uid IS NOT NULL) AND NOT j.bloqueado
          AND (abs(suizamente_private.v2_nivel(j.xp)-suizamente_private.v2_nivel(pl.xp))<=(c#>>'{partida,rivalAlAzar,margenNivel}')::integer
            OR a.creada_en<clock_timestamp()-make_interval(hours=>(c#>>'{partida,rivalAlAzar,cualquierNivelTrasHoras}')::integer))
          ORDER BY a.creada_en LIMIT 1 FOR UPDATE OF a;
        IF m.id IS NOT NULL THEN
          UPDATE suizamente_private.suizamente_partidas SET jugador_b=actor,estado='jugando',
            turno=coalesce(turno,actor),fase=CASE WHEN fase='espera' THEN 'girar' ELSE fase END,
            plazo=clock_timestamp()+make_interval(hours=>(c#>>'{partida,horasPorTurno}')::integer),turno_n=turno_n+1 WHERE id=m.id RETURNING * INTO m;
          PERFORM suizamente_private.v2_avisar(m);
          RETURN suizamente_private.v2_ver(m.id,actor);
        END IF;
        rival:=NULL;
      ELSE
        IF rival=actor THEN RAISE EXCEPTION 'SZV2:400:Elige a otra persona'; END IF;
        IF uid IS NULL AND inv.codigo IS NULL THEN RAISE EXCEPTION 'SZV2:401:Entra para elegir rival'; END IF;
        IF NOT EXISTS(SELECT 1 FROM suizamente_private.suizamente_jugadores WHERE jugador_id=rival AND usuario_id IS NOT NULL AND NOT bloqueado) THEN RAISE EXCEPTION 'SZV2:404:Jugador no encontrado'; END IF;
        IF (SELECT count(*) FROM suizamente_private.suizamente_partidas WHERE rival IN (jugador_a,jugador_b) AND estado IN ('buscando','jugando')) >= (c#>>'{partida,partidasAbiertasMax}')::integer THEN RAISE EXCEPTION 'SZV2:409:Esa persona tiene demasiadas partidas abiertas'; END IF;
      END IF;
      INSERT INTO suizamente_private.suizamente_partidas(jugador_a,jugador_b,turno,estado,plazo,reglas)
        VALUES(actor,rival,actor,CASE WHEN rival IS NULL THEN 'buscando' ELSE 'jugando' END,
          clock_timestamp()+make_interval(hours=>(c#>>'{partida,horasPorTurno}')::integer),c) RETURNING id INTO mid;
      IF inv.codigo IS NOT NULL THEN UPDATE suizamente_private.suizamente_invitaciones SET usada_por=actor,partida_id=mid WHERE codigo=inv.codigo; END IF;
      RETURN suizamente_private.v2_ver(mid,actor);
    ELSIF p_action IN ('inicio','partidas') THEN
      FOR rec IN SELECT id FROM suizamente_private.suizamente_partidas WHERE actor IN (jugador_a,jugador_b) AND estado IN ('buscando','jugando') ORDER BY id LOOP
        PERFORM suizamente_private.v2_actualizar(rec.id);
      END LOOP;
      RETURN jsonb_build_object('partidas',coalesce((SELECT jsonb_agg(suizamente_private.v2_ver(id,actor) ORDER BY (turno=actor) DESC NULLS LAST,creada_en DESC)
        FROM suizamente_private.suizamente_partidas WHERE actor IN (jugador_a,jugador_b) AND
          (estado IN ('buscando','jugando') OR coalesce((body->>'terminadas')::boolean,false))),'[]'));
    ELSIF p_action IN ('partida','girar','pregunta','respuesta','rendirse') THEN
      mid:=(body->>'id')::uuid;
      SELECT * INTO m FROM suizamente_private.suizamente_partidas WHERE id=mid FOR UPDATE;
      IF m.id IS NULL OR (actor<>m.jugador_a AND actor IS DISTINCT FROM m.jugador_b) THEN RAISE EXCEPTION 'SZV2:404:Partida no encontrada'; END IF;
      IF p_action='partida' THEN RETURN suizamente_private.v2_ver(mid,actor); END IF;
      IF (body->>'turnoN')::integer IS DISTINCT FROM m.turno_n OR m.estado NOT IN ('buscando','jugando') THEN RAISE EXCEPTION 'SZV2:409:La partida ha cambiado. Actualízala'; END IF;
      -- Expiry is committed even when a stale client sends a mutation.
      IF m.jugador_b IS NOT NULL AND m.plazo<clock_timestamp() THEN
        PERFORM suizamente_private.v2_actualizar(mid);
        RETURN jsonb_build_object('conflicto',true,'partida',suizamente_private.v2_ver(mid,actor));
      END IF;
      IF p_action='rendirse' THEN
        PERFORM suizamente_private.v2_cerrar(mid,CASE WHEN actor=m.jugador_a THEN m.jugador_b ELSE m.jugador_a END,'rendicion');
      ELSE
        IF m.turno IS DISTINCT FROM actor THEN RAISE EXCEPTION 'SZV2:409:Ahora le toca a tu rival'; END IF;
        IF p_action='girar' THEN
          IF m.fase<>'girar' THEN RAISE EXCEPTION 'SZV2:409:No puedes girar ahora'; END IF;
          SELECT value#>>'{}' INTO category FROM jsonb_array_elements(m.reglas#>'{ruleta,casillas}') ORDER BY random() LIMIT 1;
          UPDATE suizamente_private.suizamente_partidas SET casilla=category,fase=CASE WHEN category='sello' THEN 'sello' ELSE 'elegida' END,turno_n=turno_n+1 WHERE id=mid;
        ELSIF p_action='pregunta' THEN
          mode:=CASE WHEN m.fase='sello' THEN 'sello' ELSE 'normal' END;
          category:=CASE WHEN mode='sello' THEN body->>'categoria' ELSE m.casilla END;
          IF m.fase NOT IN ('sello','elegida') OR (body ? 'modo' AND body->>'modo'<>mode)
            OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(m.reglas->'categorias') v WHERE v->>'id'=category)
            OR (mode='sello' AND category=ANY(CASE WHEN actor=m.jugador_a THEN m.sellos_a ELSE m.sellos_b END))
            THEN RAISE EXCEPTION 'SZV2:409:Elige una categoría disponible'; END IF;
          SELECT p.payload INTO item FROM suizamente_private.suizamente_preguntas p
            WHERE NOT p.oculta AND p.payload->>'tipo'='real' AND EXISTS(
              SELECT 1 FROM jsonb_array_elements(m.reglas->'categorias') cat WHERE cat->>'id'=category AND (cat->'temas') ? (p.payload->>'tema'))
            ORDER BY coalesce((SELECT max(enviada_en) FROM suizamente_private.suizamente_partida_preguntas WHERE jugador_id=actor AND pregunta_id=p.id),'-infinity'::timestamptz)
              >clock_timestamp()-make_interval(days=>(m.reglas#>>'{partida,diasSinRepetirPregunta}')::integer),
              (SELECT max(enviada_en) FROM suizamente_private.suizamente_partida_preguntas WHERE jugador_id=actor AND pregunta_id=p.id) ASC NULLS FIRST,random() LIMIT 1;
          IF item IS NULL THEN RAISE EXCEPTION 'SZV2:503:No hay preguntas disponibles para esta categoría'; END IF;
          SELECT coalesce(max(n),0)+1 INTO num FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=mid;
          INSERT INTO suizamente_private.suizamente_partida_preguntas(partida_id,jugador_id,n,modo,categoria,pregunta_id,payload,orden,enviada_en,vence_en)
            VALUES(mid,actor,num,mode,category,item->>'id',item,(SELECT array_agg(i::smallint ORDER BY random()) FROM generate_series(0,jsonb_array_length(item->'opciones')-1) i),
              clock_timestamp(),clock_timestamp()+make_interval(secs=>(m.reglas#>>'{partida,segundosPorPregunta}')::integer));
          UPDATE suizamente_private.suizamente_partidas SET fase='pregunta',turno_n=turno_n+1 WHERE id=mid;
        ELSE
          PERFORM suizamente_private.v2_responder(mid,actor,(body->>'n')::integer,(body->>'opcion')::integer,coalesce((body->>'agotada')::boolean,false));
        END IF;
      END IF;
      RETURN suizamente_private.v2_ver(mid,actor);
    ELSE
      RAISE EXCEPTION 'SZV2:404:Ruta no disponible';
    END IF;
  END IF;
  SELECT * INTO pl FROM suizamente_private.suizamente_jugadores WHERE jugador_id=actor;
  RETURN jsonb_build_object('jugador',to_jsonb(pl)-'bloqueado'-'usuario_id'||jsonb_build_object('nivel',suizamente_private.v2_nivel(pl.xp)),'identidad',actor,'conCuenta',uid IS NOT NULL);
END $$;

CREATE OR REPLACE FUNCTION suizamente_private.v2_tick() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m suizamente_private.suizamente_partidas;
BEGIN
  FOR m IN SELECT * FROM suizamente_private.suizamente_partidas WHERE estado IN ('buscando','jugando')
    AND jugador_b IS NOT NULL AND plazo<clock_timestamp()+make_interval(hours=>(reglas#>>'{partida,avisoAntesDeCaducarHoras}')::integer)
    ORDER BY id FOR UPDATE SKIP LOCKED LOOP
    IF m.plazo<clock_timestamp() THEN PERFORM suizamente_private.v2_actualizar(m.id);
    ELSE PERFORM suizamente_private.v2_avisar(m,'suizamente_plazo'); END IF;
  END LOOP;
END $$;

-- All state and solutions stay private, including against direct PostgREST calls.
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='suizamente_private' AND tablename LIKE 'suizamente_%' LOOP
    EXECUTE format('ALTER TABLE suizamente_private.%I ENABLE ROW LEVEL SECURITY',t.tablename);
    EXECUTE format('REVOKE ALL ON suizamente_private.%I FROM PUBLIC,anon,authenticated',t.tablename);
  END LOOP;
  FOR t IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='suizamente_private' AND p.proname LIKE 'v2_%' LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION '||t.signature||' FROM PUBLIC,anon,authenticated';
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
