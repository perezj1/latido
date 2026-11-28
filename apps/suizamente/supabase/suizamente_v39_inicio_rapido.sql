-- Speed up the new Home summary without changing the original game dispatcher.
BEGIN;
CREATE OR REPLACE FUNCTION suizamente_private.mej_partidas_inicio(actor text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r record;data jsonb;
BEGIN
 -- Preserve the existing expiry transition before selecting the current turn.
 FOR r IN SELECT id FROM suizamente_private.suizamente_partidas
  WHERE actor IN(jugador_a,jugador_b) AND estado IN('buscando','jugando') ORDER BY id
 LOOP PERFORM suizamente_private.v2_actualizar(r.id);END LOOP;
 PERFORM suizamente_private.v11_misiones_cobrar(actor);
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.id,'estado',m.estado,
  'teToca',m.turno=actor,'plazo',m.plazo,
  'tusSellos',CASE WHEN m.jugador_a=actor THEN to_jsonb(m.sellos_a) ELSE to_jsonb(m.sellos_b) END,
  'tuBarra',CASE WHEN m.jugador_a=actor THEN m.barra_a ELSE m.barra_b END,
  'rival',CASE WHEN j.jugador_id IS NULL THEN NULL ELSE jsonb_build_object('apodo',j.apodo) END)
  ORDER BY (m.turno=actor) DESC NULLS LAST,m.creada_en DESC),'[]') INTO data
 FROM suizamente_private.suizamente_partidas m LEFT JOIN suizamente_private.suizamente_jugadores j
  ON j.jugador_id=CASE WHEN m.jugador_a=actor THEN m.jugador_b ELSE m.jugador_a END
 WHERE actor IN(m.jugador_a,m.jugador_b) AND m.estado IN('buscando','jugando');
 RETURN data;
END $$;
REVOKE ALL ON FUNCTION suizamente_private.mej_partidas_inicio(text) FROM PUBLIC,anon,authenticated;
DO $$ DECLARE d text;BEGIN
 SELECT pg_get_functiondef('suizamente_private.mej_resumen(text)'::regprocedure) INTO d;
 IF position('mej_partidas_inicio(actor)' IN d)=0 THEN
  IF position('public.suizamente_v2(''partidas'',''{}'',NULL,NULL)->''partidas''' IN d)=0
   OR position('public.suizamente_v2(''misiones'',''{}'',NULL,NULL)->''misiones''' IN d)=0
   OR position('public.suizamente_v2(''logros'',''{}'',NULL,NULL)->''logros''' IN d)=0
  THEN RAISE EXCEPTION 'Unexpected Home summary: no changes applied';END IF;
  d:=replace(d,'public.suizamente_v2(''partidas'',''{}'',NULL,NULL)->''partidas''','suizamente_private.mej_partidas_inicio(actor)');
  d:=replace(d,'public.suizamente_v2(''misiones'',''{}'',NULL,NULL)->''misiones''','suizamente_private.v11_misiones_ver(actor)->''misiones''');
  d:=replace(d,'public.suizamente_v2(''logros'',''{}'',NULL,NULL)->''logros''','suizamente_private.v3_logros(actor)');
  EXECUTE d;
 END IF;
END $$;
COMMIT;
