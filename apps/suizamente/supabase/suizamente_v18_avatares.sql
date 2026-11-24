-- Share only public avatar URLs. Never write to Latido's profiles/auth metadata.
BEGIN;
CREATE OR REPLACE FUNCTION suizamente_private.v18_foto_segura(photo text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT photo IS NOT NULL AND length(photo)<=2048 AND photo~'^https://[^/@[:space:]]+/' AND photo!~'[[:cntrl:]]';
$$;
CREATE OR REPLACE FUNCTION suizamente_private.v18_foto(pid text) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid;photo text;meta jsonb;
BEGIN
 SELECT usuario_id,ajustes->>'foto_url' INTO uid,photo FROM suizamente_private.suizamente_jugadores
 WHERE jugador_id=pid AND (NOT bloqueado OR jugador_id=auth.uid()::text);
 IF uid IS NULL THEN RETURN NULL;END IF;
 IF suizamente_private.v18_foto_segura(photo) THEN RETURN photo;END IF;
 SELECT avatar_url INTO photo FROM public.profiles WHERE id=uid;
 IF suizamente_private.v18_foto_segura(photo) THEN RETURN photo;END IF;
 SELECT raw_user_meta_data INTO meta FROM auth.users WHERE id=uid;
 photo:=meta->>'avatar_url';
 IF suizamente_private.v18_foto_segura(photo) THEN RETURN photo;END IF;
 photo:=meta->>'picture';
 IF suizamente_private.v18_foto_segura(photo) THEN RETURN photo;END IF;
 RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v18_identidades(data jsonb) RETURNS text[]
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE ids text[]:='{}';value jsonb;pid text;
BEGIN
 IF jsonb_typeof(data)='object' THEN
  pid:=coalesce(data->>'jugador_id',data->>'id');
  IF jsonb_typeof(data->'apodo')='string' AND pid~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN ids:=array_append(ids,pid);END IF;
  FOR value IN SELECT e.value FROM jsonb_each(data) e LOOP
   IF jsonb_typeof(value) IN('object','array') THEN ids:=ids||suizamente_private.v18_identidades(value);END IF;
  END LOOP;
 ELSIF jsonb_typeof(data)='array' THEN
  FOR value IN SELECT * FROM jsonb_array_elements(data) LOOP ids:=ids||suizamente_private.v18_identidades(value);END LOOP;
 END IF;
 RETURN ids;
END $$;
DO $$ BEGIN
 IF to_regprocedure('suizamente_private.v18_api_base(text,jsonb,uuid,text)') IS NULL THEN
  ALTER FUNCTION public.suizamente_v2(text,jsonb,uuid,text) SET SCHEMA suizamente_private;
  ALTER FUNCTION suizamente_private.suizamente_v2(text,jsonb,uuid,text) RENAME TO v18_api_base;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.suizamente_v2(p_action text,p_args jsonb DEFAULT '{}',p_guest_id uuid DEFAULT NULL,p_guest_token text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE data jsonb;target text;photos jsonb;
BEGIN
 data:=suizamente_private.v18_api_base(p_action,p_args,p_guest_id,p_guest_token);
 IF p_action='config' THEN RETURN data||jsonb_build_object('apiVersion',18);END IF;
 IF auth.uid() IS NULL OR jsonb_typeof(data)<>'object' THEN RETURN data;END IF;
 -- Legacy raid views identify the victim only by nickname. Add the real id first.
 IF p_action IN('atacar','asalto','asalto_empezar','asalto_siguiente','asalto_respuesta','asalto_comodin','asalto_descartar') AND jsonb_typeof(data->'victima')='object' THEN
  SELECT victima INTO target FROM suizamente_private.suizamente_asaltos WHERE id=(data->>'id')::uuid AND jugador_id=auth.uid()::text;
  IF target IS NOT NULL THEN data:=jsonb_set(data,'{victima}',data->'victima'||jsonb_build_object('id',target));END IF;
 END IF;
 SELECT coalesce(jsonb_object_agg(pid,suizamente_private.v18_foto(pid)),'{}') INTO photos
 FROM (SELECT DISTINCT unnest(suizamente_private.v18_identidades(data)) pid) people;
 RETURN data||jsonb_build_object('avatares',photos);
END $$;
DO $$ DECLARE r record;BEGIN
 FOR r IN SELECT p.oid::regprocedure sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='suizamente_private' AND p.proname LIKE 'v18_%' LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION '||r.sig||' FROM PUBLIC,anon,authenticated';
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
