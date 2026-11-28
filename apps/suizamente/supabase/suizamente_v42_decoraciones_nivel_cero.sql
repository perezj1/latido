BEGIN;
CREATE OR REPLACE FUNCTION suizamente_private.mej_decorar_devolver() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 -- Keep ownership, unlock date and seen moment; only remove the placement.
 UPDATE suizamente_private.persona_decoraciones SET vuelta=NULL,canton=NULL,hueco=NULL
 WHERE persona=NEW.jugador_id AND vuelta=NEW.vuelta AND canton=NEW.canton;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION suizamente_private.mej_decorar_devolver() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE TRIGGER suizamente_decoraciones_nivel_cero AFTER UPDATE OF nivel ON suizamente_private.suizamente_mapa
 FOR EACH ROW WHEN(NEW.nivel=0 AND OLD.nivel>0) EXECUTE FUNCTION suizamente_private.mej_decorar_devolver();
-- Repair old invisible placements without taking away any owned decoration.
UPDATE suizamente_private.persona_decoraciones d SET vuelta=NULL,canton=NULL,hueco=NULL
WHERE d.canton IS NOT NULL AND NOT EXISTS(SELECT 1 FROM suizamente_private.suizamente_mapa m WHERE m.jugador_id=d.persona AND m.vuelta=d.vuelta AND m.canton=d.canton AND m.nivel>=1);
COMMIT;
