-- Invitations to friendship are independent from single-use match invitations.
BEGIN;
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_invitaciones_amigos(
 codigo text PRIMARY KEY CHECK(codigo ~ '^[a-f0-9]{32}$'),
 jugador_id text NOT NULL REFERENCES suizamente_private.suizamente_jugadores(jugador_id) ON DELETE CASCADE,
 caduca_en timestamptz NOT NULL,creado_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE suizamente_private.suizamente_invitaciones_amigos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON suizamente_private.suizamente_invitaciones_amigos FROM PUBLIC,anon,authenticated;
DO $$ BEGIN
 IF to_regprocedure('suizamente_private.v25_api_base(text,jsonb,uuid,text)') IS NULL THEN
  ALTER FUNCTION public.suizamente_v2(text,jsonb,uuid,text) SET SCHEMA suizamente_private;
  ALTER FUNCTION suizamente_private.suizamente_v2(text,jsonb,uuid,text) RENAME TO v25_api_base;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.suizamente_v2(p_action text,p_args jsonb DEFAULT '{}',p_guest_id uuid DEFAULT NULL,p_guest_token text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor text:=auth.uid()::text;state jsonb;inv suizamente_private.suizamente_invitaciones_amigos;target text;pl suizamente_private.suizamente_jugadores;
BEGIN
 IF p_action NOT IN('invitar_amigo','aceptar_amigo') THEN
  RETURN suizamente_private.v25_api_base(p_action,p_args,p_guest_id,p_guest_token);
 END IF;
 IF actor IS NULL THEN RAISE EXCEPTION 'SZV2:401:Entra con tu cuenta para aceptar la invitación';END IF;
 IF p_action='aceptar_amigo' THEN
  SELECT * INTO inv FROM suizamente_private.suizamente_invitaciones_amigos WHERE codigo=p_args->>'codigo';
  target:=inv.jugador_id;
  IF target IS NOT NULL THEN
   -- Lock both accounts in the same order BEFORE the base API locks a player
   -- row. Otherwise simultaneous reciprocal links can deadlock on the FKs.
   PERFORM pg_advisory_xact_lock(hashtextextended('suizamente:api:'||least(actor,target),0));
   PERFORM pg_advisory_xact_lock(hashtextextended('suizamente:api:'||greatest(actor,target),0));
  END IF;
 END IF;
 -- Retain the account, moderation, per-account lock and rate checks of the API.
 state:=suizamente_private.v25_api_base('jugador',p_args,p_guest_id,p_guest_token);
 IF state->'jugador' IS NULL OR state->'jugador'='null'::jsonb THEN RAISE EXCEPTION 'SZV2:404:Crea primero tu perfil';END IF;
 IF coalesce((state#>>'{jugador,renombrar}')::boolean,false) THEN RAISE EXCEPTION 'SZV2:403:Revisa el estado de tu perfil antes de continuar';END IF;
 IF p_action='invitar_amigo' THEN
  INSERT INTO suizamente_private.suizamente_invitaciones_amigos(codigo,jugador_id,caduca_en)
   VALUES(replace(gen_random_uuid()::text,'-',''),actor,clock_timestamp()+make_interval(days=>(suizamente_private.v2_config()#>>'{partida,invitacionDias}')::integer)) RETURNING * INTO inv;
  RETURN jsonb_build_object('codigo',inv.codigo,'enlace','/suizamente/amigo/'||inv.codigo);
 END IF;
 IF inv.codigo IS NULL OR inv.caduca_en<clock_timestamp() THEN RAISE EXCEPTION 'SZV2:404:La invitación ha caducado. Pide un enlace nuevo';END IF;
 IF actor=target THEN RAISE EXCEPTION 'SZV2:409:Este es tu enlace. Compártelo con un amigo';END IF;
 SELECT * INTO pl FROM suizamente_private.suizamente_jugadores WHERE jugador_id=target;
 IF pl.jugador_id IS NULL OR pl.usuario_id IS NULL OR pl.bloqueado OR pl.renombrar THEN RAISE EXCEPTION 'SZV2:404:Jugador no disponible';END IF;
 INSERT INTO suizamente_private.suizamente_amigos(seguidor,seguido,estado)
  VALUES(actor,target,'aceptado'),(target,actor,'aceptado')
  ON CONFLICT(seguidor,seguido) DO UPDATE SET estado='aceptado';
 RETURN jsonb_build_object('aceptada',true,'amigo',suizamente_private.v7_persona(target));
END $$;
REVOKE ALL ON FUNCTION suizamente_private.v25_api_base(text,jsonb,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
