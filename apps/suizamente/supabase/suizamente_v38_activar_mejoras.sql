-- Latido requested activation after completing prompts 32–40.
-- Only switches change. No example content or business is published.
BEGIN;
UPDATE suizamente_private.mejoras_configuracion SET mejoras=
 jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(mejoras,
 '{minuto,activo}','true'),'{espejo,activo}','true'),'{misterio,activo}','true'),
 '{decorar,activo}','true'),'{unToque,activo}','true');
UPDATE suizamente_private.negocios_configuracion SET config=
 jsonb_set(jsonb_set(config,'{activo}','true'),'{cobroAutomatico}','false');
UPDATE suizamente_private.suizamente_configuracion SET juego=jsonb_set(juego,'{mapa,barraCanton}','false');
COMMIT;
