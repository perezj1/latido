-- Reversible free publication. Preserve paid signup, prices, invoices and Stripe.
BEGIN;
ALTER TABLE suizamente_private.negocios ADD COLUMN IF NOT EXISTS alta_gratuita boolean NOT NULL DEFAULT false;
DO $$ BEGIN
 IF to_regprocedure('suizamente_private.neg44_config_base()') IS NULL THEN ALTER FUNCTION suizamente_private.neg_config() RENAME TO neg44_config_base;END IF;
 IF to_regprocedure('suizamente_private.neg44_visible_base(suizamente_private.negocios)') IS NULL THEN ALTER FUNCTION suizamente_private.neg_visible(suizamente_private.negocios) RENAME TO neg44_visible_base;END IF;
 IF to_regprocedure('suizamente_private.neg44_validar_base(jsonb)') IS NULL THEN ALTER FUNCTION suizamente_private.neg_validar(jsonb) RENAME TO neg44_validar_base;END IF;
 IF to_regprocedure('suizamente_private.neg44_api_base(text,jsonb,uuid,text)') IS NULL THEN
  ALTER FUNCTION public.suizamente_negocios(text,jsonb,uuid,text) SET SCHEMA suizamente_private;
  ALTER FUNCTION suizamente_private.suizamente_negocios(text,jsonb,uuid,text) RENAME TO neg44_api_base;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.neg_config() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN coalesce((c->>'gratis')::boolean,false) THEN jsonb_set(c,'{cobroAutomatico}','false') ELSE c END FROM(SELECT suizamente_private.neg44_config_base() c) s
$$;
CREATE OR REPLACE FUNCTION suizamente_private.neg_visible(n suizamente_private.negocios) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN n.alta_gratuita OR coalesce((suizamente_private.neg_config()->>'gratis')::boolean,false)
 THEN n.estado='activo' AND n.publicado IS NOT NULL AND NOT n.baja_solicitada ELSE suizamente_private.neg44_visible_base(n) END
$$;
CREATE OR REPLACE FUNCTION suizamente_private.neg_validar(d jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l jsonb:=suizamente_private.neg_config()->'limites';v jsonb;phone text;email text;key text;link text;hours jsonb:=coalesce(d->'horario','[null,null,null,null,null,null,null]');h jsonb;
BEGIN
 IF NOT coalesce((suizamente_private.neg_config()->>'gratis')::boolean,false) AND coalesce(current_setting('suizamente.negocio_gratis',true),'')<>'on' THEN RETURN suizamente_private.neg44_validar_base(d);END IF;
 IF jsonb_typeof(d) IS DISTINCT FROM 'object' OR length(trim(coalesce(d->>'nombre',''))) NOT BETWEEN 1 AND (l->>'nombre')::integer OR length(trim(coalesce(d->>'descripcion',''))) NOT BETWEEN 1 AND (l->>'descripcion')::integer THEN RAISE EXCEPTION 'SZV2:400:Revisa el nombre y la descripción del negocio';END IF;
 IF coalesce(d->>'tipo','') NOT IN('restaurante','cafe','tienda','panaderia','peluqueria','escuela','oficina','foodtruck') OR coalesce(d->>'color','') NOT IN('#24E2C9','#03AA98','#F9A719','#FA2F35','#4A76EF','#24BFE2') THEN RAISE EXCEPTION 'SZV2:400:Elige una figura y un color';END IF;
 IF length(trim(coalesce(d->>'direccion',''))) NOT BETWEEN 3 AND 160 OR coalesce(d->>'postal','')!~'^[1-9][0-9]{3}$' OR length(trim(coalesce(d->>'ciudad',''))) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'SZV2:400:Revisa la dirección del negocio';END IF;
 phone:=regexp_replace(trim(coalesce(d->>'telefono','')),'[[:space:]().-]','','g');
 IF phone~'^00' THEN phone:='+'||substr(phone,3);ELSIF phone~'^0[0-9]{9}$' THEN phone:='+41'||substr(phone,2);END IF;
 IF phone<>'' AND phone!~'^\+[1-9][0-9]{7,14}$' THEN RAISE EXCEPTION 'SZV2:400:Revisa el teléfono e incluye el prefijo del país';END IF;
 email:=trim(coalesce(d->>'email',''));
 IF email<>'' AND (email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR length(email)>254) THEN RAISE EXCEPTION 'SZV2:400:Revisa el email de contacto';END IF;
 FOR key IN SELECT unnest(ARRAY['web','instagram']) LOOP link:=d->>key;IF length(link)>500 OR (coalesce(link,'')<>'' AND link!~'^https://[^[:space:]<>]+$') THEN RAISE EXCEPTION 'SZV2:400:Los enlaces deben empezar por https://';END IF;END LOOP;
 IF coalesce(d->>'whatsapp','')<>'' AND d->>'whatsapp'!~'^\+[1-9][0-9]{7,14}$' THEN RAISE EXCEPTION 'SZV2:400:Escribe WhatsApp con el prefijo del país';END IF;
 IF phone='' AND coalesce(d->>'web','')='' AND coalesce(d->>'instagram','')='' AND coalesce(d->>'whatsapp','')='' THEN RAISE EXCEPTION 'SZV2:400:Añade un teléfono o un enlace de contacto del negocio';END IF;
 IF coalesce(d#>>'{oferta,texto}','')<>'' AND (length(d#>>'{oferta,texto}')>(l->>'oferta')::integer OR length(coalesce(d#>>'{oferta,codigo}','')) NOT BETWEEN 1 AND (l->>'codigo')::integer OR length(coalesce(d#>>'{oferta,condiciones}','')) NOT BETWEEN 1 AND 500) THEN RAISE EXCEPTION 'SZV2:400:Revisa la oferta, el código y sus condiciones';END IF;
 IF jsonb_typeof(hours) IS DISTINCT FROM 'array' OR jsonb_array_length(hours)<>7 THEN RAISE EXCEPTION 'SZV2:400:Revisa el horario de los siete días';END IF;
 FOR h IN SELECT value FROM jsonb_array_elements(hours) LOOP IF h<>'null'::jsonb AND (coalesce(h->>'desde','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' OR coalesce(h->>'hasta','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' OR h->>'desde'=h->>'hasta') THEN RAISE EXCEPTION 'SZV2:400:Revisa las horas de apertura y cierre';END IF;END LOOP;
 RETURN jsonb_build_object('nombre',trim(d->>'nombre'),'tipo',d->>'tipo','color',d->>'color','descripcion',trim(d->>'descripcion'),'direccion',trim(d->>'direccion'),'postal',d->>'postal','ciudad',d->>'ciudad','email',email,'telefono',phone,'web',coalesce(d->>'web',''),'instagram',coalesce(d->>'instagram',''),'whatsapp',coalesce(d->>'whatsapp',''),
 'horario',(SELECT jsonb_agg(CASE WHEN hv='null'::jsonb THEN 'null'::jsonb ELSE jsonb_build_object('desde',hv->>'desde','hasta',hv->>'hasta') END ORDER BY i) FROM jsonb_array_elements(hours) WITH ORDINALITY h(hv,i)),
 'oferta',CASE WHEN coalesce(d#>>'{oferta,texto}','')<>'' THEN jsonb_build_object('texto',d#>>'{oferta,texto}','codigo',d#>>'{oferta,codigo}','condiciones',d#>>'{oferta,condiciones}') ELSE NULL END);
END $$;
CREATE OR REPLACE FUNCTION public.suizamente_negocios(p_action text,p_args jsonb DEFAULT '{}',p_guest_id uuid DEFAULT NULL,p_guest_token text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cfg jsonb:=suizamente_private.neg_config();free boolean:=coalesce((cfg->>'gratis')::boolean,false);actor text;ad boolean;n suizamente_private.negocios;d jsonb;h jsonb;capacity integer;bid uuid;result jsonb;previous text:=coalesce(current_setting('suizamente.negocio_gratis',true),'');
BEGIN
 IF NOT coalesce((cfg->>'activo')::boolean,false) THEN RAISE EXCEPTION 'SZV2:404:Esta pantalla no está disponible';END IF;
 IF jsonb_typeof(coalesce(p_args,'{}'))<>'object' OR octet_length(coalesce(p_args,'{}')::text)>20000 THEN RAISE EXCEPTION 'SZV2:400:Solicitud no válida';END IF;
 IF p_action='alta' AND free THEN
  actor:=suizamente_private.mej_actor();PERFORM suizamente_private.neg_mantenimiento();d:=suizamente_private.neg_validar(p_args->'datos');
  IF NOT coalesce((p_args->>'condiciones')::boolean,false) THEN RAISE EXCEPTION 'SZV2:400:Confirma que puedes publicar los datos del negocio';END IF;
  SELECT value INTO h FROM suizamente_private.negocios_configuracion,LATERAL jsonb_array_elements(huecos->(p_args->>'canton')) WHERE value->>'id'=p_args->>'plaza' AND value->>'tipo'='plaza';
  IF h IS NULL THEN RAISE EXCEPTION 'SZV2:400:Elige una plaza libre de tu cantón';END IF;
  IF NOT EXISTS(SELECT 1 FROM suizamente_private.negocio_postales WHERE postal=d->>'postal' AND lower(ciudad)=lower(d->>'ciudad') AND canton=p_args->>'canton') THEN RAISE EXCEPTION 'SZV2:400:Elige la ciudad de la lista del código postal';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('negocio-canton:'||(p_args->>'canton'),0));
  PERFORM pg_advisory_xact_lock(hashtextextended('negocio-plaza:'||(p_args->>'plaza'),0));
  IF EXISTS(SELECT 1 FROM suizamente_private.negocios WHERE plaza_id=p_args->>'plaza' AND estado IN('revision','cambios','activo')) THEN RAISE EXCEPTION 'SZV2:409:Esa plaza se acaba de ocupar. Elige otra';END IF;
  capacity:=suizamente_private.neg_capacidad(p_args->>'canton');
  IF (SELECT count(*) FROM suizamente_private.negocios WHERE canton=p_args->>'canton' AND estado IN('revision','cambios','activo'))>=capacity THEN RAISE EXCEPTION 'SZV2:409:No quedan plazas. Puedes apuntarte a la lista de espera';END IF;
  -- Legacy billing fields stay available, but do not constitute a paid enrollment.
  INSERT INTO suizamente_private.negocios(persona,datos,canton,plaza_id,figura,color,plan,periodo,metodo,condiciones_aceptadas,condiciones_version,alta_gratuita)
   VALUES(actor,d,p_args->>'canton',p_args->>'plaza',d->>'tipo',d->>'color','mapa','ano','factura',clock_timestamp(),'alta-gratuita-v1',true) RETURNING * INTO n;
  RETURN jsonb_build_object('id',n.id,'estado',n.estado,'gratuito',true);
 END IF;
 IF p_action IN('editar','baja','aprobar','plan','pagada') THEN
  actor:=suizamente_private.mej_actor();ad:=suizamente_private.v7_admin();bid:=(p_args->>'id')::uuid;
  SELECT * INTO n FROM suizamente_private.negocios WHERE id=bid FOR UPDATE;
  IF n.id IS NULL THEN RAISE EXCEPTION 'SZV2:404:Negocio no encontrado';END IF;
  IF n.persona<>actor AND NOT ad THEN RAISE EXCEPTION 'SZV2:403:Este panel es solo para su negocio';END IF;
  IF free OR n.alta_gratuita THEN
   IF p_action IN('plan','pagada') THEN RAISE EXCEPTION 'SZV2:409:La publicación de este negocio es gratuita; no hay ningún pago que realizar';END IF;
   IF p_action='aprobar' THEN
    IF NOT ad THEN RAISE EXCEPTION 'SZV2:403:Solo administración de Latido';END IF;
    IF n.estado NOT IN('revision','cambios') THEN RAISE EXCEPTION 'SZV2:409:La solicitud ya está revisada';END IF;
    UPDATE suizamente_private.negocios SET estado='activo',publicado=datos,alta_gratuita=true,aprobado=clock_timestamp(),impago_desde=NULL,cambio_pedido=NULL,mensaje=NULL WHERE id=bid;
    PERFORM suizamente_private.neg_oferta(bid,n.datos);
    INSERT INTO suizamente_private.negocio_avisos(negocio,ref,texto) VALUES(bid,'aprobacion-gratuita','Latido ha aprobado tu negocio. Ya está en el mapa, gratis.') ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('guardado',true,'id',bid,'gratuito',true);
   ELSIF p_action='baja' THEN
    UPDATE suizamente_private.negocios SET estado='baja',baja_solicitada=true,motivo_baja=left(p_args->>'motivo',500) WHERE id=bid;
    RETURN jsonb_build_object('guardado',true,'id',bid);
   END IF;
   PERFORM set_config('suizamente.negocio_gratis','on',true);
  END IF;
 END IF;
 result:=suizamente_private.neg44_api_base(p_action,p_args,p_guest_id,p_guest_token);
 PERFORM set_config('suizamente.negocio_gratis',previous,true);
 IF p_action='inicio' AND free THEN
  result:=result||jsonb_build_object('plazas',(SELECT coalesce(jsonb_object_agg(id,datos),'{}') FROM suizamente_private.mapa_huecos WHERE tipo='plaza'));
 ELSIF p_action='panel' THEN
  result:=result||jsonb_build_object('gratuito',free OR coalesce((result#>>'{negocio,alta_gratuita}')::boolean,false),
   'hueco',(SELECT datos FROM suizamente_private.mapa_huecos WHERE id=result#>>'{negocio,plaza_id}'));
 ELSIF p_action='admin' THEN
  result:=result||jsonb_build_object('impagos',(SELECT count(*) FROM suizamente_private.negocios WHERE estado='activo' AND NOT alta_gratuita AND coalesce(activo_hasta,aprobado)<clock_timestamp()));
 END IF;
 RETURN result;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'SZV2:409:Esa plaza ya está ocupada';
END $$;
DO $$ DECLARE r record;BEGIN
 FOR r IN SELECT p.oid::regprocedure f FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='suizamente_private' AND p.proname LIKE 'neg%' LOOP EXECUTE 'REVOKE ALL ON FUNCTION '||r.f||' FROM PUBLIC,anon,authenticated';END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.suizamente_negocios(text,jsonb,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.suizamente_negocios(text,jsonb,uuid,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
