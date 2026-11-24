-- Presentation metadata only: preserve the existing transactional collection award.
BEGIN;
ALTER TABLE suizamente_private.suizamente_sobres ADD COLUMN IF NOT EXISTS colecciones_completadas jsonb NOT NULL DEFAULT '[]';
DO $$ BEGIN
 IF to_regprocedure('suizamente_private.v19_sobre_base(uuid,text)') IS NULL THEN ALTER FUNCTION suizamente_private.v6_sobre_ver(uuid,text) RENAME TO v19_sobre_base;END IF;
 IF to_regprocedure('suizamente_private.v19_album_base(text,text,jsonb)') IS NULL THEN ALTER FUNCTION suizamente_private.v6_accion(text,text,jsonb) RENAME TO v19_album_base;END IF;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v6_sobre_ver(sid uuid,actor text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE data jsonb;
BEGIN
 data:=suizamente_private.v19_sobre_base(sid,actor);
 RETURN data||jsonb_build_object('coleccionesCompletadas',(SELECT colecciones_completadas FROM suizamente_private.suizamente_sobres WHERE id=sid AND jugador_id=actor));
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v6_accion(action text,actor text,body jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE before_refs text[];data jsonb;completed jsonb;
BEGIN
 IF action='abrir_sobre' THEN
  PERFORM 1 FROM suizamente_private.suizamente_jugadores WHERE jugador_id=actor FOR UPDATE;
  SELECT coalesce(array_agg(ref),'{}') INTO before_refs FROM suizamente_private.suizamente_movimientos WHERE jugador_id=actor AND motivo='coleccion';
 END IF;
 data:=suizamente_private.v19_album_base(action,actor,body);
 IF action='abrir_sobre' THEN
  SELECT coalesce(jsonb_agg(c||jsonb_build_object('premioEntregado',jsonb_build_object('monedas',m.monedas,'inventario',m.inventario)) ORDER BY c->>'id'),'[]') INTO completed
   FROM jsonb_array_elements(suizamente_private.v6_colecciones()) c
   JOIN suizamente_private.suizamente_movimientos m ON m.jugador_id=actor AND m.motivo='coleccion' AND m.ref=c->>'id'
   WHERE NOT m.ref=ANY(before_refs);
  UPDATE suizamente_private.suizamente_sobres SET colecciones_completadas=completed WHERE id=(data->>'id')::uuid AND jugador_id=actor;
  RETURN suizamente_private.v6_sobre_ver((data->>'id')::uuid,actor);
 END IF;
 RETURN data;
END $$;
REVOKE ALL ON FUNCTION suizamente_private.v19_sobre_base(uuid,text),suizamente_private.v19_album_base(text,text,jsonb),suizamente_private.v6_sobre_ver(uuid,text),suizamente_private.v6_accion(text,text,jsonb) FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
