-- Keep each account's requests outside the inner player/rate-limit lock inversion.
-- This changes coordination only: the same RPC, permissions and rules remain in force.
BEGIN;
DO $$ BEGIN
 IF to_regprocedure('suizamente_private.v24_api_base(text,jsonb,uuid,text)') IS NULL THEN
  ALTER FUNCTION public.suizamente_v2(text,jsonb,uuid,text) SET SCHEMA suizamente_private;
  ALTER FUNCTION suizamente_private.suizamente_v2(text,jsonb,uuid,text) RENAME TO v24_api_base;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.suizamente_v2(p_action text,p_args jsonb DEFAULT '{}',p_guest_id uuid DEFAULT NULL,p_guest_token text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();
BEGIN
 IF actor IS NOT NULL THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('suizamente:api:'||actor::text,0));
 END IF;
 RETURN suizamente_private.v24_api_base(p_action,p_args,p_guest_id,p_guest_token);
END $$;
REVOKE ALL ON FUNCTION suizamente_private.v24_api_base(text,jsonb,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
