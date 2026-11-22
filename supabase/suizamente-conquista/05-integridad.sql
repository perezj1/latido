-- Deleting a game profile must never strand somebody else's reserved stake.
CREATE OR REPLACE FUNCTION suizamente_conquista.antes_borrar_jugador() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE b suizamente_conquista.batallas;
BEGIN
 IF OLD.usuario_id IS NULL THEN RETURN OLD;END IF;
 PERFORM 1 FROM suizamente_conquista.billeteras WHERE usuario=OLD.usuario_id OR usuario IN(
  SELECT atacante FROM suizamente_conquista.batallas WHERE defensor=OLD.usuario_id AND estado='activa'
 ) ORDER BY usuario FOR UPDATE;
 FOR b IN SELECT * FROM suizamente_conquista.batallas WHERE OLD.usuario_id IN(atacante,defensor) AND estado='activa' FOR UPDATE LOOP
  IF b.atacante<>OLD.usuario_id THEN PERFORM suizamente_conquista.mover(b.atacante,b.apuesta,'perfil_eliminado',b.id::text);END IF;
  UPDATE suizamente_conquista.batallas SET estado='caducada',motivo='perfil_eliminado',terminado_en=now() WHERE id=b.id;
 END LOOP;
 RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS cq_borrar_jugador ON suizamente_social.jugadores;
CREATE TRIGGER cq_borrar_jugador BEFORE DELETE ON suizamente_social.jugadores FOR EACH ROW EXECUTE FUNCTION suizamente_conquista.antes_borrar_jugador();
REVOKE ALL ON FUNCTION suizamente_conquista.antes_borrar_jugador() FROM PUBLIC,anon,authenticated;
