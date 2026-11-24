-- All gameplay now requires a Latido account. Preserve legacy guest data for linking.
BEGIN;
DO $$ BEGIN
 IF to_regprocedure('suizamente_private.v14_api_base(text,jsonb,uuid,text)') IS NULL THEN
  ALTER FUNCTION public.suizamente_v2(text,jsonb,uuid,text) SET SCHEMA suizamente_private;
  ALTER FUNCTION suizamente_private.suizamente_v2(text,jsonb,uuid,text) RENAME TO v14_api_base;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.suizamente_v2(p_action text,p_args jsonb DEFAULT '{}',p_guest_id uuid DEFAULT NULL,p_guest_token text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL AND p_action NOT IN('config','capacidades') THEN
  IF p_action='admin' THEN RAISE EXCEPTION 'SZV2:403:Solo administración de Latido';END IF;
  RAISE EXCEPTION 'SZV2:401:Entra con tu cuenta de Latido para jugar';
 END IF;
 result:=suizamente_private.v14_api_base(p_action,p_args,p_guest_id,p_guest_token);
 IF p_action='config' THEN result:=result||jsonb_build_object('apiVersion',14,'requiereCuenta',true);END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION suizamente_private.v14_api_base(text,jsonb,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
