-- Corrige las imágenes externas que el navegador no puede mostrar porque
-- bloquean la carga desde Latido, devuelven 403 o tienen problemas de TLS.
-- Solo se conservan imágenes verificadas en la web oficial de la entidad.
-- Si no existe una imagen reutilizable, photo_url queda vacío y la app usa emoji.

BEGIN;

WITH replacements (id, name, photo_url) AS (
  VALUES
    ('6d0b9f60-c283-4e9c-900f-e8124d7ba9f9'::uuid, 'Consejería de Trabajo, Migraciones y Seguridad Social', NULL::text),
    ('46301ee8-4bd8-4d7d-8f25-6cb4c69341f0'::uuid, 'Consulado de Colombia en Berna', 'https://suiza.embajada.gov.co/sites/default/files/inline-images/logo-cancilleria.png'),
    ('064a62c4-5c77-405d-820c-8ef3cebdc7d9'::uuid, 'Consulado General de España en Berna', NULL::text),
    ('3c14e455-4d87-4133-ba95-20376b097adf'::uuid, 'Consulado General de España en Ginebra', NULL::text),
    ('03283706-1023-48b0-aeb9-6dd7ae7dbd4e'::uuid, 'Consulado General de España en Zúrich', NULL::text),
    ('65a63e20-bdb2-4bc8-b41c-f79e75f8ee4f'::uuid, 'Embajada de España en Berna', NULL::text),
    ('f57baade-2f11-4cc7-85c8-84084bd2984d'::uuid, 'frabina', NULL::text),
    ('5ffc7c23-2aba-4ba4-8293-515341b1310c'::uuid, 'Mónica Montero', NULL::text)
)
UPDATE public.providers AS provider
SET photo_url = replacement.photo_url
FROM replacements AS replacement
WHERE provider.id = replacement.id
  AND lower(trim(provider.name)) = lower(trim(replacement.name));

COMMIT;

SELECT id, name, photo_url
FROM public.providers
WHERE id IN (
  '6d0b9f60-c283-4e9c-900f-e8124d7ba9f9'::uuid,
  '46301ee8-4bd8-4d7d-8f25-6cb4c69341f0'::uuid,
  '064a62c4-5c77-405d-820c-8ef3cebdc7d9'::uuid,
  '3c14e455-4d87-4133-ba95-20376b097adf'::uuid,
  '03283706-1023-48b0-aeb9-6dd7ae7dbd4e'::uuid,
  '65a63e20-bdb2-4bc8-b41c-f79e75f8ee4f'::uuid,
  'f57baade-2f11-4cc7-85c8-84084bd2984d'::uuid,
  '5ffc7c23-2aba-4ba4-8293-515341b1310c'::uuid
)
ORDER BY name;
