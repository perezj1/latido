-- Additive, opt-in engine. No existing table, function, trigger or policy is changed.
BEGIN;
CREATE TABLE IF NOT EXISTS suizamente_private.mejoras_configuracion(
 id boolean PRIMARY KEY DEFAULT true CHECK(id), mejoras jsonb NOT NULL, decoraciones jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS suizamente_private.mejoras_ajustes(
 persona text PRIMARY KEY REFERENCES suizamente_private.suizamente_jugadores(jugador_id) ON DELETE CASCADE,
 ideas boolean NOT NULL DEFAULT false, sin_noches boolean NOT NULL DEFAULT true, misterio boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS suizamente_private.mejoras_avisos(
 persona text NOT NULL REFERENCES suizamente_private.suizamente_jugadores(jugador_id) ON DELETE CASCADE,
 tipo text NOT NULL, ref text NOT NULL, texto text NOT NULL, href text NOT NULL,
 creado timestamptz NOT NULL DEFAULT clock_timestamp(), enviado timestamptz, PRIMARY KEY(persona,tipo,ref)
);
CREATE INDEX IF NOT EXISTS mejoras_avisos_pendientes ON suizamente_private.mejoras_avisos(persona) WHERE enviado IS NULL;
ALTER TABLE suizamente_private.mejoras_configuracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE suizamente_private.mejoras_ajustes ENABLE ROW LEVEL SECURITY;
ALTER TABLE suizamente_private.mejoras_avisos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON suizamente_private.mejoras_configuracion,suizamente_private.mejoras_ajustes,suizamente_private.mejoras_avisos FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION suizamente_private.mej_config() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((SELECT mejoras FROM suizamente_private.mejoras_configuracion WHERE id),'{}'::jsonb)
$$;
CREATE OR REPLACE FUNCTION suizamente_private.mej_activa(feature text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT coalesce((suizamente_private.mej_config()#>>ARRAY[feature,'activo'])::boolean,false) $$;
CREATE OR REPLACE FUNCTION suizamente_private.mej_actor() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor text:=auth.uid()::text;s jsonb;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'SZV2:401:Entra con tu cuenta de Latido para jugar';END IF;
 -- Existing account/moderation/rate/ownership validation, without replacing it.
 s:=public.suizamente_v2('jugador','{}',NULL,NULL);
 IF s->'jugador' IS NULL OR s->'jugador'='null'::jsonb THEN RAISE EXCEPTION 'SZV2:404:Crea primero tu perfil';END IF;
 IF coalesce((s#>>'{jugador,renombrar}')::boolean,false) OR EXISTS(SELECT 1 FROM suizamente_private.suizamente_jugadores WHERE jugador_id=actor AND bloqueado) THEN RAISE EXCEPTION 'SZV2:403:Revisa el estado de tu perfil antes de continuar';END IF;
 RETURN actor;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.mej_amigos(a text,b text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT a<>b AND EXISTS(SELECT 1 FROM suizamente_private.suizamente_amigos WHERE seguidor=a AND seguido=b AND estado='aceptado')
 AND EXISTS(SELECT 1 FROM suizamente_private.suizamente_jugadores WHERE jugador_id=b AND usuario_id IS NOT NULL AND NOT bloqueado AND NOT renombrar)
 AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=b::uuid AND banned)
$$;
CREATE OR REPLACE FUNCTION suizamente_private.mej_persona(p text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (suizamente_private.v7_persona(p)-'canton')||jsonb_build_object('foto',ajustes->>'foto_url') FROM suizamente_private.suizamente_jugadores WHERE jugador_id=p
$$;
CREATE OR REPLACE FUNCTION suizamente_private.mej_estado(actor text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('jugador',(to_jsonb(j)-'usuario_id'-'bloqueado')||suizamente_private.v3_progreso(j.xp)||jsonb_build_object('racha',suizamente_private.v3_racha(actor)),
 'marco',suizamente_private.v11_marco(actor),'novedades',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'tipo',tipo,'datos',datos) ORDER BY id) FROM suizamente_private.suizamente_novedades WHERE jugador_id=actor AND NOT leida),'[]'))
 FROM suizamente_private.suizamente_jugadores j WHERE j.jugador_id=actor
$$;
CREATE OR REPLACE FUNCTION suizamente_private.mej_pregunta(payload jsonb,orden smallint[]) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT jsonb_build_object('id',payload->>'id','pregunta',payload->>'pregunta','categoria',payload->>'categoria','opciones',
 (SELECT jsonb_agg(jsonb_build_object('indice',n-1,'t',payload#>>ARRAY['opciones',i::text,'t']) ORDER BY n) FROM unnest(orden) WITH ORDINALITY o(i,n)))
$$;
CREATE OR REPLACE FUNCTION suizamente_private.mej_categoria(payload jsonb) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT value->>'id' FROM jsonb_array_elements(suizamente_private.v2_config()->'categorias') WHERE (value->'temas') ? (payload->>'tema') LIMIT 1
$$;
CREATE OR REPLACE FUNCTION suizamente_private.mej_aviso(p text,t text,r text,m text,h text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 INSERT INTO suizamente_private.mejoras_avisos(persona,tipo,ref,texto,href) VALUES(p,t,r,m,h) ON CONFLICT DO NOTHING
$$;
DO $$ DECLARE f regprocedure;BEGIN FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='suizamente_private' AND p.proname LIKE 'mej_%' LOOP EXECUTE 'REVOKE ALL ON FUNCTION '||f||' FROM PUBLIC,anon,authenticated';END LOOP;END $$;
COMMIT;
