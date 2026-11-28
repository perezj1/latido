-- Generated from the approved editorial calendar; no game configuration changes.
BEGIN;
INSERT INTO suizamente_private.misterios(fecha,payload) VALUES('2026-11-28','{"fecha":"2026-11-28","tipo":"monumento","pregunta":"¿Qué monumento es?","imagen":null,"silueta":null,"pistas":["Está en Lucerna.","Se inauguró en 1821.","Representa un león tallado en roca."],"opciones":["Monumento del León","Kapellbrücke","Jet d’Eau","Torre del Reloj"],"correcta":0,"dato":"Recuerda a los guardias suizos muertos en París en 1792."}'::jsonb) ON CONFLICT(fecha) DO NOTHING;
COMMIT;
