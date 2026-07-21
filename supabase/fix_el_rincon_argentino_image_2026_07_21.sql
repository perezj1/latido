-- Sustituye la imagen de El Rincón Argentino alojada en un dominio cuyo
-- certificado está caducado por una copia accesible mediante HTTPS válido.

UPDATE public.providers
SET photo_url = 'https://img.restaurantguru.com/w550/h367/r18b-El-Rincon-Argentino-design-2024-12-3.jpg'
WHERE active IS TRUE
  AND lower(trim(name)) = lower('El Rincón Argentino');

SELECT id, name, photo_url
FROM public.providers
WHERE lower(trim(name)) = lower('El Rincón Argentino');
