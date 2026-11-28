-- Latido requested free publication. Keep all original prices and payment data.
BEGIN;
UPDATE suizamente_private.negocios_configuracion SET config=jsonb_set(jsonb_set(config,'{gratis}','true'),'{cobroAutomatico}','false');
COMMIT;
