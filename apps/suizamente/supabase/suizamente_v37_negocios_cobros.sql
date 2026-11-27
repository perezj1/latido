-- Additive payment state. The manual v35 RPC and all previous functions stay intact.
BEGIN;
CREATE TABLE IF NOT EXISTS suizamente_private.negocio_cobros(
 negocio uuid PRIMARY KEY REFERENCES suizamente_private.negocios(id) ON DELETE CASCADE,
 cliente text UNIQUE,metodo text NOT NULL CHECK(metodo IN('tarjeta','twint','factura')),
 sesion_setup text UNIQUE,intent_setup text UNIQUE,payment_method text,preparada boolean NOT NULL DEFAULT false,
 suscripcion text UNIQUE,sesion_pago text UNIQUE,pago_desde timestamptz,pago_hasta timestamptz,pago_plan text,pago_importe numeric,schedule text,version integer NOT NULL DEFAULT 0,
 actualizado timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS suizamente_private.negocio_cobro_contexto(persona text NOT NULL,transaccion bigint NOT NULL,metodo text NOT NULL,PRIMARY KEY(persona,transaccion));
CREATE TABLE IF NOT EXISTS suizamente_private.negocio_cobro_trabajos(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),negocio uuid NOT NULL REFERENCES suizamente_private.negocios(id) ON DELETE CASCADE,
 accion text NOT NULL CHECK(accion IN('iniciar','plan','baja','renovar')),datos jsonb NOT NULL DEFAULT '{}',
 estado text NOT NULL DEFAULT 'pendiente' CHECK(estado IN('pendiente','procesando','hecho')),
 creado timestamptz NOT NULL DEFAULT clock_timestamp(),intento timestamptz,lease uuid,intentos integer NOT NULL DEFAULT 0,error text
);
CREATE UNIQUE INDEX IF NOT EXISTS negocio_un_cobro_procesando ON suizamente_private.negocio_cobro_trabajos(negocio) WHERE estado='procesando';
CREATE TABLE IF NOT EXISTS suizamente_private.negocio_stripe_eventos(id text PRIMARY KEY,tipo text NOT NULL,creado timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE IF NOT EXISTS suizamente_private.negocio_stripe_facturas(referencia text PRIMARY KEY,negocio uuid NOT NULL REFERENCES suizamente_private.negocios(id) ON DELETE CASCADE,desde timestamptz NOT NULL,hasta timestamptz NOT NULL,pagada boolean NOT NULL DEFAULT false,importe numeric NOT NULL DEFAULT 0,url text);
CREATE OR REPLACE FUNCTION suizamente_private.cob_servicio() RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT coalesce(nullif(current_setting('request.jwt.claim.role',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role',current_setting('role',true))='service_role'
$$;
CREATE OR REPLACE FUNCTION suizamente_private.cob_guardar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE metodo text;BEGIN
 IF NOT coalesce((suizamente_private.neg_config()->>'cobroAutomatico')::boolean,false) THEN RETURN NEW;END IF;
 IF TG_OP='INSERT' THEN
  SELECT c.metodo INTO metodo FROM suizamente_private.negocio_cobro_contexto c WHERE c.persona=NEW.persona AND c.transaccion=txid_current();
  NEW.metodo:=coalesce(metodo,NEW.metodo);
  IF NEW.metodo<>'tarjeta' AND NEW.periodo<>'ano' THEN RAISE EXCEPTION 'SZV2:400:TWINT y factura QR son solo anuales';END IF;
 ELSE
  IF NEW.estado='activo' AND OLD.estado IN('revision','cambios') AND NEW.metodo='tarjeta' AND NOT EXISTS(SELECT 1 FROM suizamente_private.negocio_cobros WHERE negocio=NEW.id AND preparada) THEN RAISE EXCEPTION 'SZV2:409:El negocio debe guardar su tarjeta en Stripe antes de la aprobación';END IF;
  IF NEW.metodo IN('tarjeta','twint') AND NEW.activo_hasta IS DISTINCT FROM OLD.activo_hasta AND NOT suizamente_private.cob_servicio() AND NOT (NEW.baja_solicitada AND OLD.activo_hasta IS NULL) THEN RAISE EXCEPTION 'SZV2:403:Stripe confirma los pagos automáticos';END IF;
  IF NEW.metodo<>'tarjeta' AND NEW.proximo_periodo='mes' THEN RAISE EXCEPTION 'SZV2:400:TWINT y factura QR son solo anuales';END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.cob_encolar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT coalesce((suizamente_private.neg_config()->>'cobroAutomatico')::boolean,false) OR NEW.metodo='factura' THEN RETURN NEW;END IF;
 IF NEW.estado='activo' AND OLD.estado IN('revision','cambios') THEN INSERT INTO suizamente_private.negocio_cobro_trabajos(negocio,accion) VALUES(NEW.id,'iniciar');END IF;
 IF NEW.baja_solicitada AND NOT OLD.baja_solicitada THEN INSERT INTO suizamente_private.negocio_cobro_trabajos(negocio,accion) VALUES(NEW.id,'baja');END IF;
 IF NEW.proximo_plan IS NOT NULL AND (NEW.proximo_plan,NEW.proximo_periodo) IS DISTINCT FROM (OLD.proximo_plan,OLD.proximo_periodo) THEN INSERT INTO suizamente_private.negocio_cobro_trabajos(negocio,accion,datos) VALUES(NEW.id,'plan',jsonb_build_object('plan',NEW.proximo_plan,'periodo',NEW.proximo_periodo));END IF;
 RETURN NEW;
END $$;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='negocio_cobro_guardia' AND tgrelid='suizamente_private.negocios'::regclass) THEN CREATE TRIGGER negocio_cobro_guardia BEFORE INSERT OR UPDATE ON suizamente_private.negocios FOR EACH ROW EXECUTE FUNCTION suizamente_private.cob_guardar();END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='negocio_cobro_cola' AND tgrelid='suizamente_private.negocios'::regclass) THEN CREATE TRIGGER negocio_cobro_cola AFTER UPDATE ON suizamente_private.negocios FOR EACH ROW EXECUTE FUNCTION suizamente_private.cob_encolar();END IF;
END $$;
CREATE OR REPLACE FUNCTION public.suizamente_negocios_cobros(p_action text,p_args jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor text;bid uuid;result jsonb;n suizamente_private.negocios;c suizamente_private.negocio_cobros;m text:=p_args->>'metodo';
BEGIN
 IF NOT coalesce((suizamente_private.neg_config()->>'activo')::boolean,false) OR NOT coalesce((suizamente_private.neg_config()->>'cobroAutomatico')::boolean,false) THEN RAISE EXCEPTION 'SZV2:404:El cobro automático no está disponible';END IF;
 actor:=suizamente_private.mej_actor();
 IF p_action='alta' THEN
  IF coalesce(m,'') NOT IN('tarjeta','twint','factura') OR (m<>'tarjeta' AND coalesce(p_args->>'periodo','')<>'ano') THEN RAISE EXCEPTION 'SZV2:400:Elige tarjeta o un pago anual con TWINT o factura QR';END IF;
  INSERT INTO suizamente_private.negocio_cobro_contexto VALUES(actor,txid_current(),m);
  result:=public.suizamente_negocios('alta',p_args||jsonb_build_object('metodo','factura'));
  DELETE FROM suizamente_private.negocio_cobro_contexto WHERE persona=actor AND transaccion=txid_current();bid:=(result->>'id')::uuid;
  INSERT INTO suizamente_private.negocio_cobros(negocio,metodo,preparada) VALUES(bid,m,m<>'tarjeta');
  RETURN result||jsonb_build_object('metodo',m);
 END IF;
 bid:=(p_args->>'id')::uuid;SELECT * INTO n FROM suizamente_private.negocios WHERE id=bid FOR UPDATE;
 IF n.id IS NULL OR (n.persona<>actor AND NOT suizamente_private.v7_admin()) THEN RAISE EXCEPTION 'SZV2:403:Este pago es solo para su negocio';END IF;
 SELECT * INTO c FROM suizamente_private.negocio_cobros WHERE negocio=bid;
 IF p_action='estado' THEN RETURN jsonb_build_object('metodo',n.metodo,'tarjetaGuardada',coalesce(c.preparada,false),'suscripcion',c.suscripcion IS NOT NULL,'pagoPendiente',n.metodo='twint' AND (n.activo_hasta IS NULL OR n.activo_hasta<=clock_timestamp()),'trabajosPendientes',(SELECT count(*) FROM suizamente_private.negocio_cobro_trabajos WHERE negocio=bid AND estado<>'hecho'),'facturas',(SELECT coalesce(jsonb_agg(jsonb_build_object('referencia',referencia,'url',url,'pagada',pagada)),'[]') FROM suizamente_private.negocio_stripe_facturas WHERE negocio=bid));END IF;
 IF p_action='preparar' THEN
  IF n.persona<>actor THEN RAISE EXCEPTION 'SZV2:403:El portal es solo para la cuenta del negocio';END IF;
  IF n.estado NOT IN('revision','cambios','activo') THEN RAISE EXCEPTION 'SZV2:409:La solicitud está cerrada';END IF;
  INSERT INTO suizamente_private.negocio_cobros(negocio,metodo,preparada) VALUES(bid,n.metodo,n.metodo<>'tarjeta') ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('negocio',to_jsonb(n),'cobro',(SELECT to_jsonb(x) FROM suizamente_private.negocio_cobros x WHERE negocio=bid));
 END IF;
 IF p_action='renovar' THEN
  IF n.metodo<>'twint' OR n.estado<>'activo' OR n.baja_solicitada OR coalesce(n.activo_hasta,clock_timestamp())>clock_timestamp()+interval '1 day' THEN RAISE EXCEPTION 'SZV2:409:No hay un pago anual pendiente';END IF;
  IF NOT EXISTS(SELECT 1 FROM suizamente_private.negocio_cobro_trabajos WHERE negocio=bid AND estado<>'hecho' AND accion IN('iniciar','renovar')) THEN INSERT INTO suizamente_private.negocio_cobro_trabajos(negocio,accion) VALUES(bid,'renovar');END IF;
  RETURN jsonb_build_object('guardado',true);
 END IF;
 RAISE EXCEPTION 'SZV2:404:Acción de pago no disponible';
END $$;
CREATE OR REPLACE FUNCTION public.suizamente_negocios_stripe(p_action text,p_args jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE bid uuid:=(p_args->>'id')::uuid;n suizamente_private.negocios;c suizamente_private.negocio_cobros;j suizamente_private.negocio_cobro_trabajos;f suizamente_private.negocio_stripe_facturas;added integer;kind text:=p_args->>'tipo';ref text:=p_args->>'referencia';startat timestamptz;endat timestamptz;
BEGIN
 IF NOT suizamente_private.cob_servicio() THEN RAISE EXCEPTION 'SZV2:403:Solo el servidor de cobros';END IF;
 IF p_action='cliente_buscar' THEN SELECT * INTO c FROM suizamente_private.negocio_cobros WHERE cliente=p_args->>'cliente';RETURN to_jsonb(c);END IF;
 IF p_action='trabajo' THEN
  PERFORM pg_advisory_xact_lock(hashtext('suizamente-stripe-worker'));
  UPDATE suizamente_private.negocio_cobro_trabajos SET estado='pendiente',lease=NULL WHERE estado='procesando' AND intento<clock_timestamp()-interval '5 minutes';
  SELECT * INTO j FROM suizamente_private.negocio_cobro_trabajos q WHERE estado='pendiente' AND (bid IS NULL OR negocio=bid) AND NOT EXISTS(SELECT 1 FROM suizamente_private.negocio_cobro_trabajos a WHERE a.negocio=q.negocio AND a.estado='procesando') ORDER BY creado,id LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF j.id IS NULL THEN RETURN NULL;END IF;
  UPDATE suizamente_private.negocio_cobro_trabajos SET estado='procesando',lease=gen_random_uuid(),intento=clock_timestamp(),intentos=intentos+1 WHERE id=j.id RETURNING * INTO j;
  SELECT * INTO n FROM suizamente_private.negocios WHERE id=j.negocio;SELECT * INTO c FROM suizamente_private.negocio_cobros WHERE negocio=j.negocio;
  RETURN jsonb_build_object('trabajo',to_jsonb(j),'negocio',to_jsonb(n),'cobro',to_jsonb(c));
 END IF;
 IF p_action IN('hecho','error') THEN
  UPDATE suizamente_private.negocio_cobro_trabajos SET estado=CASE WHEN p_action='hecho' THEN 'hecho' ELSE 'pendiente' END,error=CASE WHEN p_action='error' THEN left(p_args->>'error',80) END,lease=NULL WHERE id=(p_args->>'trabajo')::uuid AND lease=(p_args->>'lease')::uuid AND estado='procesando';RETURN jsonb_build_object('guardado',true);
 END IF;
 IF p_action='guardar' THEN
  UPDATE suizamente_private.negocio_cobros SET cliente=coalesce(p_args->>'cliente',cliente),sesion_setup=coalesce(p_args->>'sesion_setup',sesion_setup),intent_setup=coalesce(p_args->>'intent_setup',intent_setup),payment_method=coalesce(p_args->>'payment_method',payment_method),preparada=coalesce((p_args->>'preparada')::boolean,preparada),suscripcion=coalesce(p_args->>'suscripcion',suscripcion),sesion_pago=coalesce(p_args->>'sesion_pago',sesion_pago),pago_desde=coalesce((p_args->>'pago_desde')::timestamptz,pago_desde),pago_hasta=coalesce((p_args->>'pago_hasta')::timestamptz,pago_hasta),pago_plan=coalesce(p_args->>'pago_plan',pago_plan),pago_importe=coalesce((p_args->>'pago_importe')::numeric,pago_importe),schedule=coalesce(p_args->>'schedule',schedule),actualizado=clock_timestamp() WHERE negocio=bid;RETURN jsonb_build_object('guardado',true);
 END IF;
 IF p_action='evento' THEN
  SELECT * INTO n FROM suizamente_private.negocios WHERE id=bid FOR UPDATE;SELECT * INTO c FROM suizamente_private.negocio_cobros WHERE negocio=bid;
  IF c.negocio IS NULL OR c.cliente IS DISTINCT FROM p_args->>'cliente' THEN RAISE EXCEPTION 'SZV2:409:Evento sin negocio asociado';END IF;
  INSERT INTO suizamente_private.negocio_stripe_eventos(id,tipo) VALUES(p_args->>'evento',kind) ON CONFLICT DO NOTHING;GET DIAGNOSTICS added=ROW_COUNT;
  IF added=0 THEN RETURN jsonb_build_object('duplicado',true);END IF;
  IF kind='setup' THEN
   IF c.sesion_setup IS DISTINCT FROM p_args->>'sesion' THEN RAISE EXCEPTION 'SZV2:409:La sesión no está registrada todavía';END IF;
   UPDATE suizamente_private.negocio_cobros SET intent_setup=p_args->>'intent_setup',payment_method=p_args->>'payment_method',preparada=true,actualizado=clock_timestamp() WHERE negocio=bid;
  ELSIF kind IN('pagada','fallida') THEN
   startat:=(p_args->>'desde')::timestamptz;endat:=(p_args->>'hasta')::timestamptz;
   IF startat IS NULL OR endat IS NULL OR endat<=startat OR coalesce(p_args->>'moneda','')<>'chf' THEN RAISE EXCEPTION 'SZV2:400:Periodo o moneda de factura no válido';END IF;
   INSERT INTO suizamente_private.negocio_stripe_facturas(referencia,negocio,desde,hasta) VALUES(ref,bid,startat,endat) ON CONFLICT DO NOTHING;
   SELECT * INTO f FROM suizamente_private.negocio_stripe_facturas WHERE referencia=ref FOR UPDATE;
   IF f.negocio<>bid THEN RAISE EXCEPTION 'SZV2:409:Factura de otro negocio';END IF;
   UPDATE suizamente_private.negocio_stripe_facturas SET url=coalesce(p_args->>'url',url) WHERE referencia=ref;
   IF kind='pagada' AND NOT f.pagada THEN
    INSERT INTO suizamente_private.negocio_pagos(negocio,periodo,importe,metodo,estado,referencia,desde,hasta) VALUES(bid,to_char(startat AT TIME ZONE 'Europe/Zurich','YYYY-MM-DD'),(p_args->>'importe')::numeric,n.metodo,'pagada',ref,startat,endat);
    UPDATE suizamente_private.negocio_stripe_facturas SET pagada=true,importe=(p_args->>'importe')::numeric,url=p_args->>'url' WHERE referencia=ref;
    UPDATE suizamente_private.negocios SET activo_hasta=greatest(coalesce(activo_hasta,endat),endat),impago_desde=CASE WHEN endat>=coalesce(activo_hasta,endat) THEN NULL ELSE impago_desde END,plan=CASE WHEN endat>=coalesce(activo_hasta,endat) THEN coalesce(p_args->>'plan',plan) ELSE plan END,periodo=CASE WHEN endat>=coalesce(activo_hasta,endat) THEN coalesce(p_args->>'periodo',periodo) ELSE periodo END,proximo_plan=CASE WHEN proximo_plan=p_args->>'plan' AND proximo_periodo=p_args->>'periodo' THEN NULL ELSE proximo_plan END,proximo_periodo=CASE WHEN proximo_plan=p_args->>'plan' AND proximo_periodo=p_args->>'periodo' THEN NULL ELSE proximo_periodo END WHERE id=bid;
   ELSIF kind='fallida' AND NOT f.pagada AND (n.activo_hasta IS NULL OR n.activo_hasta<=startat) THEN
    UPDATE suizamente_private.negocios SET impago_desde=coalesce(impago_desde,clock_timestamp()) WHERE id=bid;
    INSERT INTO suizamente_private.negocio_avisos(negocio,ref,texto) VALUES(bid,'stripe-fallo:'||ref,'No se pudo cobrar tu factura. Revisa tu pago en Plan y pagos.') ON CONFLICT DO NOTHING;
   END IF;
  ELSIF kind='baja' THEN UPDATE suizamente_private.negocios SET baja_solicitada=true,activo_hasta=coalesce(activo_hasta,clock_timestamp()) WHERE id=bid;
  ELSIF kind='aviso' THEN INSERT INTO suizamente_private.negocio_avisos(negocio,ref,texto) VALUES(bid,'stripe:'||(p_args->>'evento'),left(p_args->>'texto',500)) ON CONFLICT DO NOTHING;
  END IF;
  RETURN jsonb_build_object('guardado',true);
 END IF;
 RAISE EXCEPTION 'SZV2:404:Operación del servidor no disponible';
END $$;
DO $$ DECLARE r record;BEGIN
 FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='suizamente_private' AND tablename IN('negocio_cobros','negocio_cobro_contexto','negocio_cobro_trabajos','negocio_stripe_eventos','negocio_stripe_facturas') LOOP EXECUTE format('ALTER TABLE suizamente_private.%I ENABLE ROW LEVEL SECURITY',r.tablename);EXECUTE format('REVOKE ALL ON suizamente_private.%I FROM PUBLIC,anon,authenticated',r.tablename);END LOOP;
 FOR r IN SELECT p.oid::regprocedure f FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='suizamente_private' AND p.proname LIKE 'cob_%' LOOP EXECUTE 'REVOKE ALL ON FUNCTION '||r.f||' FROM PUBLIC,anon,authenticated';END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.suizamente_negocios_cobros(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.suizamente_negocios_cobros(text,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.suizamente_negocios_stripe(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.suizamente_negocios_stripe(text,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
