-- Additive business engine. Existing matches, economy, moderation and RPCs are untouched.
BEGIN;
CREATE TABLE IF NOT EXISTS suizamente_private.negocios_configuracion(id boolean PRIMARY KEY DEFAULT true CHECK(id),config jsonb NOT NULL,huecos jsonb NOT NULL,condiciones_url text);
CREATE TABLE IF NOT EXISTS suizamente_private.negocios(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),persona text NOT NULL REFERENCES suizamente_private.suizamente_jugadores(jugador_id) ON DELETE CASCADE,
 datos jsonb NOT NULL,canton text NOT NULL,plaza_id text NOT NULL,figura text NOT NULL,color text NOT NULL,plan text NOT NULL CHECK(plan IN('mapa','plus')),periodo text NOT NULL CHECK(periodo IN('mes','ano')),
 estado text NOT NULL DEFAULT 'revision' CHECK(estado IN('revision','cambios','activo','baja','rechazado')),publicado jsonb,
 creado timestamptz NOT NULL DEFAULT clock_timestamp(),aprobado timestamptz,cambio_pedido timestamptz,mensaje text,
 activo_hasta timestamptz,impago_desde timestamptz,baja_solicitada boolean NOT NULL DEFAULT false,motivo_baja text,proximo_plan text,proximo_periodo text,
 metodo text NOT NULL DEFAULT 'factura' CHECK(metodo IN('factura','tarjeta','twint')),condiciones_aceptadas timestamptz NOT NULL,condiciones_version text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS negocio_plaza_reservada ON suizamente_private.negocios(plaza_id) WHERE estado IN('revision','cambios','activo');
CREATE TABLE IF NOT EXISTS suizamente_private.negocio_ofertas(negocio uuid PRIMARY KEY REFERENCES suizamente_private.negocios(id) ON DELETE CASCADE,texto text NOT NULL,codigo text NOT NULL,condiciones text NOT NULL);
CREATE TABLE IF NOT EXISTS suizamente_private.negocio_cambios(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),negocio uuid NOT NULL REFERENCES suizamente_private.negocios(id) ON DELETE CASCADE,datos jsonb NOT NULL,estado text NOT NULL DEFAULT 'revision' CHECK(estado IN('revision','cambios','aprobado','rechazado')),creado timestamptz NOT NULL DEFAULT clock_timestamp(),mensaje text);
CREATE UNIQUE INDEX IF NOT EXISTS negocio_un_cambio ON suizamente_private.negocio_cambios(negocio) WHERE estado IN('revision','cambios');
CREATE TABLE IF NOT EXISTS suizamente_private.negocio_preguntas(id text PRIMARY KEY,negocio uuid NOT NULL REFERENCES suizamente_private.negocios(id) ON DELETE CASCADE,mes date NOT NULL,payload jsonb NOT NULL,estado text NOT NULL DEFAULT 'revision' CHECK(estado IN('revision','cambios','aprobado','rechazado')),mensaje text,UNIQUE(negocio,mes));
CREATE TABLE IF NOT EXISTS suizamente_private.negocio_stats(negocio uuid NOT NULL REFERENCES suizamente_private.negocios(id) ON DELETE CASCADE,fecha date NOT NULL,vistas integer NOT NULL DEFAULT 0,fichas integer NOT NULL DEFAULT 0,enlaces integer NOT NULL DEFAULT 0,rutas integer NOT NULL DEFAULT 0,codigos integer NOT NULL DEFAULT 0,respuestas integer NOT NULL DEFAULT 0,aciertos integer NOT NULL DEFAULT 0,desde_pregunta integer NOT NULL DEFAULT 0,PRIMARY KEY(negocio,fecha));
CREATE TABLE IF NOT EXISTS suizamente_private.negocio_dias(fecha date PRIMARY KEY,secreto text NOT NULL DEFAULT gen_random_uuid()::text);
CREATE TABLE IF NOT EXISTS suizamente_private.negocio_temporales(negocio uuid NOT NULL REFERENCES suizamente_private.negocios(id) ON DELETE CASCADE,fecha date NOT NULL,tipo text NOT NULL,identificador text NOT NULL,PRIMARY KEY(negocio,fecha,tipo,identificador));
CREATE TABLE IF NOT EXISTS suizamente_private.negocio_pagos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),negocio uuid NOT NULL REFERENCES suizamente_private.negocios(id) ON DELETE CASCADE,periodo text NOT NULL,importe numeric(12,2) NOT NULL CHECK(importe>=0),moneda text NOT NULL DEFAULT 'CHF' CHECK(moneda='CHF'),metodo text NOT NULL,estado text NOT NULL CHECK(estado IN('pendiente','pagada','fallida')),referencia text UNIQUE,desde timestamptz NOT NULL,hasta timestamptz NOT NULL,creado timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(negocio,periodo),CHECK(hasta>desde));
CREATE TABLE IF NOT EXISTS suizamente_private.negocio_espera(persona text NOT NULL REFERENCES suizamente_private.suizamente_jugadores(jugador_id) ON DELETE CASCADE,canton text NOT NULL,creado timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(persona,canton));
CREATE TABLE IF NOT EXISTS suizamente_private.negocio_avisos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),negocio uuid NOT NULL REFERENCES suizamente_private.negocios(id) ON DELETE CASCADE,ref text NOT NULL,texto text NOT NULL,creado timestamptz NOT NULL DEFAULT clock_timestamp(),leido boolean NOT NULL DEFAULT false,UNIQUE(negocio,ref));
CREATE TABLE IF NOT EXISTS suizamente_private.negocio_plazas(canton text PRIMARY KEY,cantidad integer NOT NULL CHECK(cantidad>=0),admin_id uuid NOT NULL,actualizado timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE IF NOT EXISTS suizamente_private.negocio_reportes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),negocio uuid NOT NULL REFERENCES suizamente_private.negocios(id) ON DELETE CASCADE,persona text NOT NULL,motivo text NOT NULL,creado timestamptz NOT NULL DEFAULT clock_timestamp());
-- Match counters have no business or person identifier. Per-question leases expire daily.
CREATE TABLE IF NOT EXISTS suizamente_private.negocio_partidas(partida uuid PRIMARY KEY,servidas integer NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS suizamente_private.negocio_preguntas_temporales(partida uuid PRIMARY KEY,negocio uuid NOT NULL REFERENCES suizamente_private.negocios(id) ON DELETE CASCADE,identificador text NOT NULL,payload jsonb NOT NULL,inicio timestamptz NOT NULL,limite timestamptz NOT NULL,fecha date NOT NULL,respuesta jsonb);
CREATE OR REPLACE FUNCTION suizamente_private.neg_config() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT config FROM suizamente_private.negocios_configuracion WHERE id $$;
CREATE OR REPLACE FUNCTION suizamente_private.neg_dia() RETURNS date LANGUAGE sql STABLE SET search_path='' AS $$ SELECT (clock_timestamp() AT TIME ZONE 'Europe/Zurich')::date $$;
CREATE OR REPLACE FUNCTION suizamente_private.neg_capacidad(c text) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((SELECT cantidad FROM suizamente_private.negocio_plazas WHERE canton=c),(suizamente_private.neg_config()#>>ARRAY['plazasPorCanton',c])::integer,(suizamente_private.neg_config()#>>'{plazasPorCanton,porDefecto}')::integer)
$$;
CREATE OR REPLACE FUNCTION suizamente_private.neg_identificador(actor text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s text;d date:=suizamente_private.neg_dia();BEGIN
 INSERT INTO suizamente_private.negocio_dias(fecha) VALUES(d) ON CONFLICT DO NOTHING;
 SELECT secreto INTO s FROM suizamente_private.negocio_dias WHERE fecha=d;
 RETURN md5(s||':'||actor);
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.neg_mantenimiento() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d date:=suizamente_private.neg_dia();BEGIN
 DELETE FROM suizamente_private.negocio_temporales WHERE fecha<d;
 DELETE FROM suizamente_private.negocio_preguntas_temporales WHERE fecha<d;
 DELETE FROM suizamente_private.negocio_dias WHERE fecha<d;
 UPDATE suizamente_private.negocios SET estado='baja' WHERE estado='cambios' AND cambio_pedido+make_interval(days=>(suizamente_private.neg_config()->>'cambioPedidoDiasMax')::integer)<clock_timestamp();
 UPDATE suizamente_private.negocio_cambios SET estado='rechazado',mensaje='Ha terminado el plazo para corregir este cambio' WHERE estado='cambios' AND creado+make_interval(days=>(suizamente_private.neg_config()->>'cambioPedidoDiasMax')::integer)<clock_timestamp();
 UPDATE suizamente_private.negocios SET estado='baja' WHERE estado='activo' AND baja_solicitada AND activo_hasta<=clock_timestamp();
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.neg_visible(n suizamente_private.negocios) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(n.estado='activo' AND n.publicado IS NOT NULL AND (NOT n.baja_solicitada OR n.activo_hasta>clock_timestamp())
 AND (n.activo_hasta>clock_timestamp() OR coalesce(n.impago_desde,n.activo_hasta,n.aprobado)+make_interval(days=>(suizamente_private.neg_config()->>'graciaImpagoDias')::integer)>clock_timestamp()),false)
$$;
CREATE OR REPLACE FUNCTION suizamente_private.neg_publico(n suizamente_private.negocios) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (n.publicado-'email')||coalesce((SELECT datos-'id'-'tipo' FROM suizamente_private.mapa_huecos WHERE id=n.plaza_id),'{}'::jsonb)||jsonb_build_object('id',n.id,'canton',n.canton,'plaza',n.plaza_id,'plan',n.plan,'patrocinado',true,'oferta',(SELECT jsonb_build_object('texto',o.texto,'codigo',o.codigo,'condiciones',o.condiciones) FROM suizamente_private.negocio_ofertas o WHERE o.negocio=n.id))
$$;
CREATE OR REPLACE FUNCTION suizamente_private.neg_validar(d jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l jsonb:=suizamente_private.neg_config()->'limites';key text;v text;oferta jsonb:=d->'oferta';h jsonb;
BEGIN
 IF jsonb_typeof(d) IS DISTINCT FROM 'object' OR length(trim(coalesce(d->>'nombre',''))) NOT BETWEEN 1 AND (l->>'nombre')::integer OR length(trim(coalesce(d->>'descripcion',''))) NOT BETWEEN 1 AND (l->>'descripcion')::integer THEN RAISE EXCEPTION 'SZV2:400:Revisa el nombre y la frase del negocio';END IF;
 IF coalesce(d->>'tipo','') NOT IN('restaurante','cafe','tienda','panaderia','peluqueria','escuela','oficina','foodtruck') OR coalesce(d->>'color','') NOT IN('#24E2C9','#03AA98','#F9A719','#FA2F35','#4A76EF','#24BFE2') THEN RAISE EXCEPTION 'SZV2:400:Elige una figura y un color';END IF;
 IF length(trim(coalesce(d->>'direccion',''))) NOT BETWEEN 3 AND 160 OR coalesce(d->>'postal','')!~'^[1-9][0-9]{3}$' OR length(trim(coalesce(d->>'ciudad',''))) NOT BETWEEN 1 AND 80 OR coalesce(d->>'email','')!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR length(d->>'email')>254 THEN RAISE EXCEPTION 'SZV2:400:Revisa la dirección y el email de facturas';END IF;
 FOR key IN SELECT unnest(ARRAY['web','instagram']) LOOP v:=d->>key;IF length(v)>500 OR (coalesce(v,'')<>'' AND v!~'^https://[^[:space:]<>]+$') THEN RAISE EXCEPTION 'SZV2:400:Los enlaces deben empezar por https://';END IF;END LOOP;
 IF coalesce(d->>'whatsapp','')<>'' AND d->>'whatsapp'!~'^\+[1-9][0-9]{7,14}$' THEN RAISE EXCEPTION 'SZV2:400:Escribe WhatsApp con el prefijo del país';END IF;
 IF oferta IS NOT NULL AND oferta<>'null'::jsonb AND coalesce(oferta->>'texto','')<>'' AND (length(oferta->>'texto')>(l->>'oferta')::integer OR length(coalesce(oferta->>'codigo','')) NOT BETWEEN 1 AND (l->>'codigo')::integer OR length(coalesce(oferta->>'condiciones','')) NOT BETWEEN 1 AND 500) THEN RAISE EXCEPTION 'SZV2:400:Revisa la oferta, el código y sus condiciones';END IF;
 IF jsonb_typeof(d->'horario') IS DISTINCT FROM 'array' OR jsonb_array_length(d->'horario')<>7 THEN RAISE EXCEPTION 'SZV2:400:Completa el horario de los siete días';END IF;
 FOR h IN SELECT value FROM jsonb_array_elements(d->'horario') LOOP IF h<>'null'::jsonb AND (coalesce(h->>'desde','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' OR coalesce(h->>'hasta','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' OR h->>'desde'=h->>'hasta') THEN RAISE EXCEPTION 'SZV2:400:Revisa las horas de apertura y cierre';END IF;END LOOP;
 RETURN jsonb_build_object('nombre',trim(d->>'nombre'),'tipo',d->>'tipo','color',d->>'color','descripcion',trim(d->>'descripcion'),'direccion',trim(d->>'direccion'),'postal',d->>'postal','ciudad',d->>'ciudad','email',trim(d->>'email'),'web',coalesce(d->>'web',''),'instagram',coalesce(d->>'instagram',''),'whatsapp',coalesce(d->>'whatsapp',''),
 'horario',(SELECT jsonb_agg(CASE WHEN hv='null'::jsonb THEN 'null'::jsonb ELSE jsonb_build_object('desde',hv->>'desde','hasta',hv->>'hasta') END ORDER BY i) FROM jsonb_array_elements(d->'horario') WITH ORDINALITY h(hv,i)),
 'oferta',CASE WHEN coalesce(d#>>'{oferta,texto}','')<>'' THEN jsonb_build_object('texto',d#>>'{oferta,texto}','codigo',d#>>'{oferta,codigo}','condiciones',d#>>'{oferta,condiciones}') ELSE NULL END);
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.neg_estadistica(actor text,b uuid,t text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d date:=suizamente_private.neg_dia();added integer;BEGIN
 IF t NOT IN('vistas','fichas','enlaces','rutas','codigos','respuestas','aciertos','desde_pregunta') THEN RAISE EXCEPTION 'SZV2:400:Estadística no válida';END IF;
 INSERT INTO suizamente_private.negocio_temporales(negocio,fecha,tipo,identificador) VALUES(b,d,t,suizamente_private.neg_identificador(actor)) ON CONFLICT DO NOTHING;GET DIAGNOSTICS added=ROW_COUNT;
 IF added=1 THEN
  INSERT INTO suizamente_private.negocio_stats(negocio,fecha) VALUES(b,d) ON CONFLICT DO NOTHING;
  EXECUTE format('UPDATE suizamente_private.negocio_stats SET %I=%I+1 WHERE negocio=$1 AND fecha=$2',t,t) USING b,d;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.neg_oferta(b uuid,d jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 DELETE FROM suizamente_private.negocio_ofertas WHERE negocio=b;
 IF coalesce(d#>>'{oferta,texto}','')<>'' THEN INSERT INTO suizamente_private.negocio_ofertas VALUES(b,d#>>'{oferta,texto}',d#>>'{oferta,codigo}',d#>>'{oferta,condiciones}');END IF;
END $$;
CREATE OR REPLACE FUNCTION public.suizamente_negocios(p_action text,p_args jsonb DEFAULT '{}',p_guest_id uuid DEFAULT NULL,p_guest_token text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor text;n suizamente_private.negocios;cfg jsonb:=suizamente_private.neg_config();d jsonb;h jsonb;row1 record;bid uuid;arr jsonb;ad boolean;count1 integer;amount numeric;periodend timestamptz;startat timestamptz;q jsonb;pl suizamente_private.suizamente_partidas;lease suizamente_private.negocio_preguntas_temporales;correcta integer;ok boolean;
BEGIN
 IF NOT coalesce((cfg->>'activo')::boolean,false) THEN RAISE EXCEPTION 'SZV2:404:Esta pantalla no está disponible';END IF;
 actor:=suizamente_private.mej_actor();ad:=suizamente_private.v7_admin();PERFORM suizamente_private.neg_mantenimiento();
 IF p_action='inicio' THEN
  SELECT coalesce(jsonb_agg(suizamente_private.neg_publico(b) ORDER BY (b.plan='plus') DESC,b.creado),'[]') INTO arr FROM suizamente_private.negocios b WHERE suizamente_private.neg_visible(b);
  RETURN jsonb_build_object('negocios',arr,'capacidades',(SELECT jsonb_object_agg(c,suizamente_private.neg_capacidad(c)) FROM suizamente_private.negocios_configuracion,LATERAL jsonb_object_keys(huecos) c),'huecos',(SELECT huecos FROM suizamente_private.negocios_configuracion WHERE id),'ocupadas',(SELECT coalesce(jsonb_agg(plaza_id),'[]') FROM suizamente_private.negocios WHERE estado IN('revision','cambios','activo')),'mios',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'nombre',datos->>'nombre','estado',estado)),'[]') FROM suizamente_private.negocios WHERE persona=actor),'condiciones',(SELECT condiciones_url FROM suizamente_private.negocios_configuracion WHERE id),'admin',ad);
 END IF;
 IF p_action='espera' THEN
  IF NOT EXISTS(SELECT 1 FROM suizamente_private.negocios_configuracion WHERE huecos ? (p_args->>'canton')) THEN RAISE EXCEPTION 'SZV2:400:Cantón no válido';END IF;
  INSERT INTO suizamente_private.negocio_espera(persona,canton) VALUES(actor,p_args->>'canton') ON CONFLICT DO NOTHING;RETURN jsonb_build_object('guardado',true);
 END IF;
 IF p_action='alta' THEN
  d:=suizamente_private.neg_validar(p_args->'datos');
  IF NOT coalesce((p_args->>'condiciones')::boolean,false) OR (SELECT condiciones_url IS NULL FROM suizamente_private.negocios_configuracion WHERE id) THEN RAISE EXCEPTION 'SZV2:503:Falta el texto de condiciones para negocios de Latido';END IF;
  SELECT value INTO h FROM suizamente_private.negocios_configuracion,LATERAL jsonb_array_elements(huecos->(p_args->>'canton')) WHERE value->>'id'=p_args->>'plaza' AND value->>'tipo'='plaza';
  IF h IS NULL THEN RAISE EXCEPTION 'SZV2:400:Elige una plaza libre de tu cantón';END IF;
  IF coalesce(p_args->>'plan','') NOT IN('mapa','plus') OR coalesce(p_args->>'periodo','') NOT IN('mes','ano') THEN RAISE EXCEPTION 'SZV2:400:Elige un plan y un periodo';END IF;
  IF coalesce(p_args->>'metodo','factura')<>'factura' THEN RAISE EXCEPTION 'SZV2:503:Pago automático: próximamente disponible';END IF;
  -- A verified postal directory is required; never infer a canton from a broad prefix.
  IF NOT EXISTS(SELECT 1 FROM suizamente_private.negocio_postales WHERE postal=d->>'postal' AND lower(ciudad)=lower(d->>'ciudad') AND canton=p_args->>'canton') THEN RAISE EXCEPTION 'SZV2:400:Elige la ciudad de la lista del código postal';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('negocio-canton:'||(p_args->>'canton'),0));
  PERFORM pg_advisory_xact_lock(hashtextextended('negocio-plaza:'||(p_args->>'plaza'),0));
  IF EXISTS(SELECT 1 FROM suizamente_private.negocios WHERE plaza_id=p_args->>'plaza' AND estado IN('revision','cambios','activo')) THEN RAISE EXCEPTION 'SZV2:409:Esa plaza se acaba de ocupar. Elige otra';END IF;
  SELECT coalesce((SELECT cantidad FROM suizamente_private.negocio_plazas WHERE canton=p_args->>'canton'),(cfg#>>ARRAY['plazasPorCanton',p_args->>'canton'])::integer,(cfg#>>'{plazasPorCanton,porDefecto}')::integer) INTO count1;
  IF (SELECT count(*) FROM suizamente_private.negocios WHERE canton=p_args->>'canton' AND estado IN('revision','cambios','activo'))>=count1 THEN RAISE EXCEPTION 'SZV2:409:No quedan plazas. Puedes apuntarte a la lista de espera';END IF;
  INSERT INTO suizamente_private.negocios(persona,datos,canton,plaza_id,figura,color,plan,periodo,metodo,condiciones_aceptadas,condiciones_version) VALUES(actor,d,p_args->>'canton',p_args->>'plaza',d->>'tipo',d->>'color',p_args->>'plan',p_args->>'periodo',coalesce(p_args->>'metodo','factura'),clock_timestamp(),(SELECT condiciones_url FROM suizamente_private.negocios_configuracion WHERE id)) RETURNING * INTO n;
  RETURN jsonb_build_object('id',n.id,'estado',n.estado);
 END IF;
 IF p_action='postales' THEN RETURN jsonb_build_object('ciudades',(SELECT coalesce(jsonb_agg(jsonb_build_object('postal',postal,'ciudad',ciudad,'canton',canton) ORDER BY ciudad),'[]') FROM suizamente_private.negocio_postales WHERE postal=p_args->>'postal'));END IF;
 IF p_action='admin' THEN
  IF NOT ad THEN RAISE EXCEPTION 'SZV2:403:Solo administración de Latido';END IF;
  RETURN jsonb_build_object('negocios',(SELECT coalesce(jsonb_agg(to_jsonb(b) ORDER BY creado DESC),'[]') FROM suizamente_private.negocios b),'cobrado',(SELECT coalesce(sum(importe),0) FROM suizamente_private.negocio_pagos WHERE estado='pagada' AND creado>=date_trunc('month',clock_timestamp() AT TIME ZONE 'Europe/Zurich') AT TIME ZONE 'Europe/Zurich'),'impagos',(SELECT count(*) FROM suizamente_private.negocios WHERE estado='activo' AND coalesce(activo_hasta,aprobado)<clock_timestamp()),'plazas',(SELECT coalesce(jsonb_agg(to_jsonb(p)),'[]') FROM suizamente_private.negocio_plazas p),'reportes',(SELECT coalesce(jsonb_agg(to_jsonb(r)-'persona'),'[]') FROM suizamente_private.negocio_reportes r));
 END IF;
 IF p_action='plazas' THEN
  IF NOT ad THEN RAISE EXCEPTION 'SZV2:403:Solo administración de Latido';END IF;
  IF (p_args->>'cantidad')::integer>(SELECT count(*) FROM suizamente_private.negocios_configuracion,LATERAL jsonb_array_elements(huecos->(p_args->>'canton')) WHERE value->>'tipo'='plaza') THEN RAISE EXCEPTION 'SZV2:400:Genera y revisa los huecos antes de añadir plazas';END IF;
  INSERT INTO suizamente_private.negocio_plazas(canton,cantidad,admin_id) VALUES(p_args->>'canton',(p_args->>'cantidad')::integer,auth.uid()) ON CONFLICT(canton) DO UPDATE SET cantidad=excluded.cantidad,admin_id=excluded.admin_id,actualizado=clock_timestamp();RETURN jsonb_build_object('guardado',true);
 END IF;
 IF p_action IN('pregunta','pregunta_responder') THEN
  SELECT * INTO pl FROM suizamente_private.suizamente_partidas WHERE id=(p_args->>'partida')::uuid FOR UPDATE;
  IF pl.id IS NULL OR (actor IS DISTINCT FROM pl.jugador_a AND actor IS DISTINCT FROM pl.jugador_b) THEN RAISE EXCEPTION 'SZV2:404:Partida no encontrada';END IF;
  SELECT * INTO lease FROM suizamente_private.negocio_preguntas_temporales WHERE partida=pl.id;
  IF lease.partida IS NOT NULL AND lease.identificador=suizamente_private.neg_identificador(actor) THEN
   IF p_action='pregunta_responder' AND lease.respuesta IS NULL THEN
    IF clock_timestamp()>lease.limite+make_interval(secs=>(suizamente_private.v2_config()#>>'{partida,margenServidorSegundos}')::integer) THEN ok:=false;ELSE ok:=coalesce((p_args->>'opcion')::integer,-1)=(lease.payload->>'correcta')::integer;END IF;
    d:=jsonb_build_object('ok',ok,'correcta',lease.payload->'correcta','dato',lease.payload->'dato','negocio',lease.negocio);
    UPDATE suizamente_private.negocio_preguntas_temporales SET respuesta=d WHERE partida=pl.id;
    PERFORM suizamente_private.neg_estadistica(actor,lease.negocio,'respuestas');IF ok THEN PERFORM suizamente_private.neg_estadistica(actor,lease.negocio,'aciertos');END IF;
    RETURN d;
   END IF;
   RETURN jsonb_build_object('pregunta',lease.payload-'correcta'-'dato'-'fuente','limite',lease.limite,'respuesta',lease.respuesta,'negocio',lease.negocio,'servidorAhora',clock_timestamp());
  END IF;
  IF p_action='pregunta_responder' THEN RAISE EXCEPTION 'SZV2:409:Esta pregunta no está disponible';END IF;
  -- Independent sponsored question before the wheel: no turn, stamps, XP or coins are changed.
  IF pl.estado<>'jugando' OR pl.turno<>actor OR pl.fase<>'girar' THEN RETURN jsonb_build_object('pregunta',NULL);END IF;
  INSERT INTO suizamente_private.negocio_partidas(partida) VALUES(pl.id) ON CONFLICT DO NOTHING;
  SELECT servidas INTO count1 FROM suizamente_private.negocio_partidas WHERE partida=pl.id FOR UPDATE;
  IF count1>=(cfg->>'preguntasNegocioPorPartidaMax')::integer OR lease.partida IS NOT NULL THEN RETURN jsonb_build_object('pregunta',NULL);END IF;
  SELECT b.* INTO n FROM suizamente_private.negocios b JOIN suizamente_private.negocio_preguntas q1 ON q1.negocio=b.id AND q1.estado='aprobado' AND q1.mes=date_trunc('month',suizamente_private.neg_dia())::date WHERE b.plan='plus' AND suizamente_private.neg_visible(b) ORDER BY md5(b.id::text||pl.id::text) LIMIT 1;
  IF n.id IS NULL THEN RETURN jsonb_build_object('pregunta',NULL);END IF;
  SELECT payload||jsonb_build_object('id',id,'nombre',n.publicado->>'nombre') INTO q FROM suizamente_private.negocio_preguntas WHERE negocio=n.id AND estado='aprobado' AND mes=date_trunc('month',suizamente_private.neg_dia())::date;
  startat:=clock_timestamp();periodend:=startat+make_interval(secs=>(suizamente_private.v2_config()#>>'{partida,segundosPorPregunta}')::integer);
  INSERT INTO suizamente_private.negocio_preguntas_temporales VALUES(pl.id,n.id,suizamente_private.neg_identificador(actor),q,startat,periodend,suizamente_private.neg_dia(),NULL);
  UPDATE suizamente_private.negocio_partidas SET servidas=servidas+1 WHERE partida=pl.id;
  RETURN jsonb_build_object('pregunta',q-'correcta'-'dato'-'fuente','limite',periodend,'servidorAhora',startat,'negocio',n.id);
 END IF;
 bid:=(p_args->>'id')::uuid;SELECT * INTO n FROM suizamente_private.negocios WHERE id=bid FOR UPDATE;
 IF n.id IS NULL THEN RAISE EXCEPTION 'SZV2:404:Negocio no encontrado';END IF;
 IF p_action IN('ficha','estadistica','reportar') THEN
  IF NOT suizamente_private.neg_visible(n) AND n.persona<>actor AND NOT ad THEN RAISE EXCEPTION 'SZV2:404:Negocio no encontrado';END IF;
  IF p_action='ficha' THEN IF suizamente_private.neg_visible(n) THEN PERFORM suizamente_private.neg_estadistica(actor,bid,'fichas');END IF;RETURN suizamente_private.neg_publico(n);END IF;
  IF p_action='estadistica' THEN
   IF p_args->>'tipo' NOT IN('vistas','fichas','enlaces','rutas','codigos','desde_pregunta') OR NOT suizamente_private.neg_visible(n) THEN RAISE EXCEPTION 'SZV2:400:Acción no disponible';END IF;
   PERFORM suizamente_private.neg_estadistica(actor,bid,p_args->>'tipo');RETURN jsonb_build_object('guardado',true);
  END IF;
  IF length(trim(coalesce(p_args->>'motivo',''))) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'SZV2:400:Cuéntanos qué hay que revisar';END IF;
  INSERT INTO suizamente_private.negocio_reportes(negocio,persona,motivo) VALUES(bid,actor,p_args->>'motivo');RETURN jsonb_build_object('guardado',true);
 END IF;
 IF n.persona<>actor AND NOT ad THEN RAISE EXCEPTION 'SZV2:403:Este panel es solo para su negocio';END IF;
 IF p_action='panel' THEN
  SELECT jsonb_build_object('vistas',coalesce(sum(vistas),0),'fichas',coalesce(sum(fichas),0),'enlaces',coalesce(sum(enlaces),0),'rutas',coalesce(sum(rutas),0),'codigos',coalesce(sum(codigos),0),'respuestas',coalesce(sum(respuestas),0),'aciertos',CASE WHEN sum(respuestas)>=(cfg->>'minimoParaPorcentaje')::integer THEN round(100.0*sum(aciertos)/sum(respuestas)) END) INTO d FROM suizamente_private.negocio_stats WHERE negocio=bid AND fecha>=CASE WHEN p_args->>'periodo'='semana' THEN date_trunc('week',suizamente_private.neg_dia())::date ELSE date_trunc('month',suizamente_private.neg_dia())::date END;
  RETURN jsonb_build_object('negocio',to_jsonb(n),'visible',suizamente_private.neg_visible(n),'stats',d,'preguntas',(SELECT coalesce(jsonb_agg(to_jsonb(question_row) ORDER BY mes DESC),'[]') FROM suizamente_private.negocio_preguntas question_row WHERE negocio=bid),'cambios',(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY creado DESC),'[]') FROM suizamente_private.negocio_cambios c WHERE negocio=bid),'pagos',(SELECT coalesce(jsonb_agg(to_jsonb(pg) ORDER BY desde DESC),'[]') FROM suizamente_private.negocio_pagos pg WHERE negocio=bid),'avisos',(SELECT coalesce(jsonb_agg(to_jsonb(av) ORDER BY creado DESC),'[]') FROM suizamente_private.negocio_avisos av WHERE negocio=bid));
 END IF;
 IF p_action='editar' THEN
  d:=suizamente_private.neg_validar(p_args->'datos');
  IF d->>'postal'<>n.datos->>'postal' OR d->>'ciudad'<>n.datos->>'ciudad' THEN RAISE EXCEPTION 'SZV2:400:Para trasladar el negocio a otro cantón, habla con Latido';END IF;
  IF n.estado IN('revision','cambios') THEN UPDATE suizamente_private.negocios SET datos=d,figura=d->>'tipo',color=d->>'color',estado='revision',cambio_pedido=NULL,mensaje=NULL WHERE id=bid;
  ELSIF n.estado='activo' THEN
   INSERT INTO suizamente_private.negocio_cambios(negocio,datos) VALUES(bid,d) ON CONFLICT(negocio) WHERE estado IN('revision','cambios') DO UPDATE SET datos=excluded.datos,estado='revision',creado=clock_timestamp(),mensaje=NULL;
  ELSE RAISE EXCEPTION 'SZV2:409:Esta solicitud está cerrada';END IF;
 ELSIF p_action='baja' THEN
  UPDATE suizamente_private.negocios SET baja_solicitada=true,estado=CASE WHEN estado IN('revision','cambios') THEN 'baja' ELSE estado END,motivo_baja=left(p_args->>'motivo',500),activo_hasta=coalesce(activo_hasta,clock_timestamp()) WHERE id=bid;
 ELSIF p_action='plan' THEN
  IF coalesce(p_args->>'plan','') NOT IN('mapa','plus') OR coalesce(p_args->>'periodo','') NOT IN('mes','ano') THEN RAISE EXCEPTION 'SZV2:400:Elige un plan y un periodo';END IF;
  UPDATE suizamente_private.negocios SET proximo_plan=p_args->>'plan',proximo_periodo=p_args->>'periodo' WHERE id=bid;
 ELSIF p_action='pregunta_guardar' THEN
  IF n.plan<>'plus' OR n.estado<>'activo' THEN RAISE EXCEPTION 'SZV2:403:La pregunta del mes es del plan Plus';END IF;
  q:=p_args->'pregunta';
  IF length(trim(coalesce(q->>'pregunta',''))) NOT BETWEEN 1 AND (cfg#>>'{limites,pregunta}')::integer OR jsonb_typeof(q->'opciones') IS DISTINCT FROM 'array' OR jsonb_array_length(q->'opciones')<>4 OR coalesce((q->>'correcta')::integer,-1) NOT BETWEEN 0 AND 3 OR length(trim(coalesce(q->>'dato',''))) NOT BETWEEN 1 AND 1000 OR coalesce(q->>'fuente','')!~'^https://[^[:space:]<>]+$' OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(suizamente_private.v2_config()->'categorias') c WHERE c->>'id'=q->>'categoria') THEN RAISE EXCEPTION 'SZV2:400:Completa la pregunta, las cuatro opciones, la correcta, el dato y la fuente';END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(q->'opciones') o WHERE length(trim(o)) NOT BETWEEN 1 AND 140) OR (SELECT count(DISTINCT lower(trim(o))) FROM jsonb_array_elements_text(q->'opciones') o)<>4 THEN RAISE EXCEPTION 'SZV2:400:Escribe cuatro opciones diferentes';END IF;
  startat:=date_trunc('month',(p_args->>'mes')::date)::date;
  IF startat IS NULL OR startat<date_trunc('month',suizamente_private.neg_dia()) OR startat>date_trunc('month',suizamente_private.neg_dia())+interval '1 month' THEN RAISE EXCEPTION 'SZV2:400:Elige este mes o el siguiente';END IF;
  IF (cfg->>'preguntasAlMesPlus')::integer<1 THEN RAISE EXCEPTION 'SZV2:409:No hay preguntas de negocio disponibles este mes';END IF;
  INSERT INTO suizamente_private.negocio_preguntas(id,negocio,mes,payload) VALUES('neg-'||bid||'-'||to_char(startat,'YYYY-MM'),bid,startat,q) ON CONFLICT(negocio,mes) DO UPDATE SET payload=excluded.payload,estado='revision',mensaje=NULL;
 ELSIF p_action IN('aprobar','cambio','rechazar','pagada','pregunta_revisar','cambio_revisar') THEN
  IF NOT ad THEN RAISE EXCEPTION 'SZV2:403:Solo administración de Latido';END IF;
  IF p_action='aprobar' THEN
   IF n.estado NOT IN('revision','cambios') THEN RAISE EXCEPTION 'SZV2:409:La solicitud ya está revisada';END IF;
   UPDATE suizamente_private.negocios SET estado='activo',publicado=datos,aprobado=clock_timestamp(),impago_desde=clock_timestamp(),cambio_pedido=NULL,mensaje=NULL WHERE id=bid;PERFORM suizamente_private.neg_oferta(bid,n.datos);
  ELSIF p_action='cambio' THEN
   IF n.estado NOT IN('revision','cambios') OR length(trim(coalesce(p_args->>'mensaje',''))) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'SZV2:400:Escribe qué hay que corregir en la solicitud';END IF;
   UPDATE suizamente_private.negocios SET estado='cambios',cambio_pedido=clock_timestamp(),mensaje=p_args->>'mensaje' WHERE id=bid;
  ELSIF p_action='rechazar' THEN
   IF n.estado NOT IN('revision','cambios') THEN RAISE EXCEPTION 'SZV2:409:La solicitud ya está revisada';END IF;
   UPDATE suizamente_private.negocios SET estado='rechazado',mensaje=left(p_args->>'mensaje',1000) WHERE id=bid;
  ELSIF p_action='cambio_revisar' THEN
   SELECT * INTO row1 FROM suizamente_private.negocio_cambios WHERE id=(p_args->>'cambio')::uuid AND negocio=bid AND estado IN('revision','cambios') FOR UPDATE;
   IF row1.id IS NULL THEN RAISE EXCEPTION 'SZV2:409:El cambio ya está revisado';END IF;
   IF p_args->>'decision'='aprobar' THEN UPDATE suizamente_private.negocios SET datos=row1.datos,publicado=row1.datos,figura=row1.datos->>'tipo',color=row1.datos->>'color' WHERE id=bid;PERFORM suizamente_private.neg_oferta(bid,row1.datos);UPDATE suizamente_private.negocio_cambios SET estado='aprobado' WHERE id=row1.id;
   ELSE UPDATE suizamente_private.negocio_cambios SET estado=CASE WHEN p_args->>'decision'='rechazar' THEN 'rechazado' ELSE 'cambios' END,mensaje=left(p_args->>'mensaje',1000) WHERE id=row1.id;END IF;
  ELSIF p_action='pregunta_revisar' THEN UPDATE suizamente_private.negocio_preguntas SET estado=CASE WHEN p_args->>'decision'='aprobar' THEN 'aprobado' WHEN p_args->>'decision'='rechazar' THEN 'rechazado' ELSE 'cambios' END,mensaje=left(p_args->>'mensaje',1000) WHERE id=p_args->>'pregunta' AND negocio=bid;
  ELSIF p_action='pagada' THEN
   IF n.estado<>'activo' THEN RAISE EXCEPTION 'SZV2:409:Aprueba primero el negocio';END IF;
   startat:=coalesce(n.activo_hasta,n.aprobado);periodend:=startat+CASE WHEN coalesce(n.proximo_periodo,n.periodo)='ano' THEN interval '1 year' ELSE interval '1 month' END;
   amount:=(cfg#>>ARRAY['planes',coalesce(n.proximo_plan,n.plan),coalesce(n.proximo_periodo,n.periodo)])::numeric;
   IF length(trim(coalesce(p_args->>'referencia',''))) NOT BETWEEN 1 AND 160 THEN RAISE EXCEPTION 'SZV2:400:Escribe la referencia única de la factura';END IF;
   IF EXISTS(SELECT 1 FROM suizamente_private.negocio_pagos WHERE referencia=p_args->>'referencia') THEN
    IF NOT EXISTS(SELECT 1 FROM suizamente_private.negocio_pagos WHERE referencia=p_args->>'referencia' AND negocio=bid) THEN RAISE EXCEPTION 'SZV2:409:Esa referencia pertenece a otra factura';END IF;
    RETURN jsonb_build_object('guardado',true);
   END IF;
   INSERT INTO suizamente_private.negocio_pagos(negocio,periodo,importe,metodo,estado,referencia,desde,hasta) VALUES(bid,to_char(startat AT TIME ZONE 'Europe/Zurich','YYYY-MM-DD'),amount,'factura','pagada',p_args->>'referencia',startat,periodend);
   UPDATE suizamente_private.negocios SET activo_hasta=periodend,impago_desde=NULL,plan=coalesce(proximo_plan,plan),periodo=coalesce(proximo_periodo,periodo),proximo_plan=NULL,proximo_periodo=NULL WHERE id=bid;
  END IF;
  INSERT INTO suizamente_private.negocio_avisos(negocio,ref,texto) VALUES(bid,p_action||':'||coalesce(p_args->>'referencia',p_args->>'cambio',p_args->>'pregunta',clock_timestamp()::text),CASE p_action WHEN 'aprobar' THEN 'Latido ha aprobado tu negocio' WHEN 'cambio' THEN 'Latido pide un cambio: '||(p_args->>'mensaje') WHEN 'pagada' THEN 'Factura pagada' WHEN 'rechazar' THEN 'Latido ha rechazado tu solicitud' ELSE 'Latido ha revisado tus cambios' END) ON CONFLICT DO NOTHING;
 ELSE RAISE EXCEPTION 'SZV2:404:Acción no disponible';END IF;
 RETURN jsonb_build_object('guardado',true,'id',bid);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'SZV2:409:Esa plaza o referencia ya está ocupada';END $$;
CREATE TABLE IF NOT EXISTS suizamente_private.negocio_postales(postal text NOT NULL,ciudad text NOT NULL,canton text NOT NULL,PRIMARY KEY(postal,ciudad,canton));
DO $$ DECLARE r record;BEGIN
 FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='suizamente_private' AND (tablename LIKE 'negocio_%' OR tablename='negocios') LOOP EXECUTE format('ALTER TABLE suizamente_private.%I ENABLE ROW LEVEL SECURITY',r.tablename);EXECUTE format('REVOKE ALL ON suizamente_private.%I FROM PUBLIC,anon,authenticated',r.tablename);END LOOP;
 FOR r IN SELECT p.oid::regprocedure f FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='suizamente_private' AND p.proname LIKE 'neg_%' LOOP EXECUTE 'REVOKE ALL ON FUNCTION '||r.f||' FROM PUBLIC,anon,authenticated';END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.suizamente_negocios(text,jsonb,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.suizamente_negocios(text,jsonb,uuid,text) TO authenticated;
COMMIT;
