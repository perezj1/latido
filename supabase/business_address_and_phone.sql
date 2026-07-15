-- LATIDO.CH - Dirección navegable y separación de teléfono/WhatsApp.
-- Ejecuta este archivo una vez en Supabase SQL Editor antes de desplegar el frontend.

BEGIN;

ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- Conserva como teléfono todos los valores que antes se guardaban en whatsapp.
UPDATE public.providers
SET phone = NULLIF(trim(whatsapp), '')
WHERE NULLIF(trim(phone), '') IS NULL
  AND NULLIF(trim(whatsapp), '') IS NOT NULL;

-- Recupera las direcciones del lote de profesionales sanitarios ya importado.
UPDATE public.providers
SET address = NULLIF(
  trim(split_part(split_part(description, 'Dirección profesional: ', 2), '. Web profesional verificada', 1)),
  ''
)
WHERE NULLIF(trim(address), '') IS NULL
  AND description LIKE '%Dirección profesional: %';

-- La fecha de verificación y la URL pertenecen a campos internos/website, no a
-- la descripción que ve el usuario.
UPDATE public.providers
SET description = trim(split_part(description, ' Web profesional verificada el ', 1))
WHERE description LIKE '% Web profesional verificada el %';

-- Los prefijos suizos 075-079 son móviles. Para los números suizos fijos,
-- whatsapp queda vacío pero phone se conserva para permitir llamadas.
UPDATE public.providers
SET whatsapp = NULL
WHERE NULLIF(trim(whatsapp), '') IS NOT NULL
  AND regexp_replace(whatsapp, '[^0-9]', '', 'g') ~ '^(0041|41|0)'
  AND regexp_replace(whatsapp, '[^0-9]', '', 'g') !~ '^(0041|41|0)7[5-9][0-9]{7}$';

COMMIT;

-- Comprobación opcional:
-- SELECT name, address, phone, whatsapp FROM public.providers ORDER BY name;
