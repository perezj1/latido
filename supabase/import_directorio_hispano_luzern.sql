-- Directorio hispanohablante del canton de Lucerna.
-- Fuente: directorio-hispano-luzern.xlsx (2026-07-21).
-- Comparado con public.providers de Latido el 2026-07-21.
--
-- Incluye solo las 16 fichas ausentes cuyo idioma figura como Confirmado o Probable.
-- Excluye las fichas "Por confirmar" y "No (lusofono)".
-- Es idempotente: compara nombre, dominio web y telefono normalizados antes de insertar.
-- Las valoraciones agregadas del Excel no se insertan como resenas: el archivo contiene
-- resumenes, no comentarios originales de Google, y Latido calcula ratings desde reviews.

BEGIN;

WITH source (
  name,
  category,
  city,
  canton,
  address,
  description,
  services,
  phone,
  email,
  website,
  spanish_status,
  google_rating,
  google_review_count
) AS (
  VALUES
    (
      'El Rincón Argentino',
      'restaurante',
      'Luzern',
      'LU',
      'Moosstrasse 15, 6003 Luzern',
      'Restaurante argentino, comestibles y vinoteca con atención en español y alemán.',
      ARRAY['Restaurante argentino', 'Parrilla', 'Comestibles', 'Vinoteca']::text[],
      '041 240 60 50',
      'info@el-rincon-argentino.ch',
      'https://el-rincon-argentino.ch',
      'Confirmado',
      4.6,
      378
    ),
    (
      'Pikante Peruvian Culinary Art',
      'restaurante',
      'Luzern',
      'LU',
      'Klosterstrasse 4, 6003 Luzern',
      'Restaurante peruano y pisco lounge con versión web en español y chef peruano.',
      ARRAY['Cocina peruana', 'Ceviche', 'Pisco lounge']::text[],
      '041 248 48 00',
      'info@pikante-luzern.ch',
      'https://pikante-luzern.ch',
      'Confirmado',
      4.6,
      564
    ),
    (
      'Tapas Cabañas',
      'restaurante',
      'Luzern',
      'LU',
      'Bruchstrasse 11, 6003 Luzern',
      'Restaurante de tapas y cocina española en Lucerna; la atención en español figura como probable.',
      ARRAY['Tapas', 'Cocina española']::text[],
      '041 240 17 16',
      NULL,
      NULL,
      'Probable',
      4.4,
      323
    ),
    (
      'Italo Hispano Comestibles',
      'tienda',
      'Luzern',
      'LU',
      'Moosstrasse 15, 6003 Luzern',
      'Tienda familiar de productos españoles e italianos en Lucerna.',
      ARRAY['Productos españoles', 'Productos italianos', 'Alimentación']::text[],
      '041 210 18 68',
      NULL,
      NULL,
      'Probable',
      4.9,
      42
    ),
    (
      'Spanisch Studio (by SmartTalk)',
      'otro',
      'Luzern',
      'LU',
      'Töpferstrasse 10, 6004 Luzern',
      'Escuela de español con profesorado nativo, grupos reducidos, preparación DELE y clases online.',
      ARRAY['Cursos de español', 'Preparación DELE', 'Clases online']::text[],
      '041 220 23 19',
      'info@spanisch-studio.ch',
      'https://spanisch-studio.ch',
      'Confirmado',
      5.0,
      28
    ),
    (
      'Escuela Antigua Guatemala',
      'otro',
      'Luzern',
      'LU',
      'Bireggstrasse 36, 6003 Luzern',
      'Escuela de español con enfoque latinoamericano, cursos privados y formación para empresas.',
      ARRAY['Cursos de español', 'Clases privadas', 'Cursos para empresas']::text[],
      '076 414 49 58',
      NULL,
      'https://escuela-antigua.ch',
      'Confirmado',
      5.0,
      12
    ),
    (
      'Spanisch lernen mit Jorge',
      'otro',
      'Luzern',
      'LU',
      'Hirschmattstrasse 13, 6003 Luzern',
      'Clases privadas de español adaptadas a objetivos individuales con profesor nativo.',
      ARRAY['Clases privadas de español', 'Cursos personalizados']::text[],
      '079 704 80 16',
      NULL,
      NULL,
      'Confirmado',
      5.0,
      21
    ),
    (
      'Salsamania Tanzschule',
      'otro',
      'Luzern',
      'LU',
      'Rankhofstrasse 3, 6006 Luzern',
      'Escuela de salsa con actividad en Lucerna y Zug y enfoque en cultura latinoamericana.',
      ARRAY['Salsa', 'Cursos de baile', 'Luzern y Zug']::text[],
      '079 308 66 75',
      NULL,
      'https://salsamania.ch',
      'Probable',
      5.0,
      25
    ),
    (
      'Salsa y más',
      'otro',
      'Kriens',
      'LU',
      'LUK Center, Nidfeldstrasse, 6010 Kriens',
      'Escuela de salsa y workshops en Kriens; la atención en español figura como probable.',
      ARRAY['Salsa', 'Cursos de baile', 'Workshops']::text[],
      '079 350 05 76',
      'info@salsaymas.ch',
      'https://salsaymas.ch',
      'Probable',
      4.6,
      13
    ),
    (
      'Asociación de Inválidos y Pensionistas Españoles de Lucerna',
      'otro',
      'Luzern',
      'LU',
      'Güterstrasse 20, 6005 Luzern',
      'Asociación española de Lucerna con restaurante propio y actividades comunitarias en español.',
      ARRAY['Asociación española', 'Restaurante', 'Actividades comunitarias']::text[],
      '041 534 96 90',
      NULL,
      NULL,
      'Confirmado',
      4.7,
      51
    ),
    (
      'advolaw GmbH',
      'asesoria_tramites',
      'Luzern',
      'LU',
      'Grossmatte O 26, 6014 Luzern',
      'Bufete de abogados con derecho migratorio y asesoramiento jurídico en español.',
      ARRAY['Derecho migratorio', 'Asesoría jurídica', 'Atención en español']::text[],
      '041 460 55 33',
      NULL,
      'https://advolaw.ch',
      'Confirmado',
      3.8,
      10
    ),
    (
      'Neustadt Advokatur',
      'asesoria_tramites',
      'Luzern',
      'LU',
      'Hirschmattstrasse 25, 6003 Luzern',
      'Bufete de abogados y notaría con atención en español, especializado en derecho familiar y laboral.',
      ARRAY['Derecho de familia', 'Derecho laboral', 'Notaría', 'Atención en español']::text[],
      '041 210 77 88',
      NULL,
      'https://neustadt-advokatur.ch',
      'Confirmado',
      4.8,
      4
    ),
    (
      'Thomas Wüthrich, Rechtsanwalt',
      'asesoria_tramites',
      'Luzern',
      'LU',
      'Bruchstrasse 69, 6003 Luzern',
      'Abogado en Lucerna especializado en derecho penal y defensa de oficio, con consultas en español.',
      ARRAY['Derecho penal', 'Defensa de oficio', 'Consultas en español']::text[],
      '041 240 51 51',
      NULL,
      'https://anwalt-luzern.ch',
      'Confirmado',
      4.0,
      4
    ),
    (
      'Cosmetic Institute Beauty Rocío',
      'belleza',
      'Luzern',
      'LU',
      'Zürichstrasse 69, 6004 Luzern',
      'Centro de estética de propietaria peruana con atención en español, maquillaje permanente, masajes y formación.',
      ARRAY['Estética', 'Maquillaje permanente', 'Masajes', 'Formación']::text[],
      '041 420 51 61 / 079 851 12 46',
      NULL,
      'https://beauty-rocio.ch',
      'Confirmado',
      4.6,
      86
    ),
    (
      'Dolmetschdienst Zentralschweiz',
      'asesoria_tramites',
      'Luzern',
      'LU',
      'Grossmatte O 10, 6014 Luzern',
      'Servicio institucional de interpretación multilingüe de Suiza Central; disponibilidad de español probable.',
      ARRAY['Interpretación', 'Traducción institucional', 'Servicios multilingües']::text[],
      '041 368 51 51',
      NULL,
      NULL,
      'Probable',
      5.0,
      2
    ),
    (
      'Traducta Luzern',
      'asesoria_tramites',
      'Luzern',
      'LU',
      'Werftestrasse 4, 6005 Luzern',
      'Agencia de traducción multilingüe en Lucerna; disponibilidad de español probable.',
      ARRAY['Traducción', 'Interpretación', 'Servicios multilingües']::text[],
      '0800 888 440',
      NULL,
      NULL,
      'Probable',
      4.6,
      17
    )
), normalized_source AS (
  SELECT
    s.*,
    lower(regexp_replace(s.name, '[^[:alnum:]]', '', 'g')) AS name_key,
    CASE
      WHEN regexp_replace(coalesce(s.phone, ''), '[^0-9]', '', 'g') LIKE '0041%'
        THEN substr(regexp_replace(s.phone, '[^0-9]', '', 'g'), 3)
      WHEN regexp_replace(coalesce(s.phone, ''), '[^0-9]', '', 'g') LIKE '0%'
        THEN '41' || substr(regexp_replace(s.phone, '[^0-9]', '', 'g'), 2)
      ELSE regexp_replace(coalesce(s.phone, ''), '[^0-9]', '', 'g')
    END AS phone_key,
    split_part(
      regexp_replace(
        regexp_replace(lower(trim(coalesce(s.website, ''))), '^https?://', ''),
        '^www\.',
        ''
      ),
      '/',
      1
    ) AS website_key
  FROM source s
), existing AS (
  SELECT
    p.*,
    lower(regexp_replace(p.name, '[^[:alnum:]]', '', 'g')) AS name_key,
    CASE
      WHEN regexp_replace(coalesce(p.phone, p.whatsapp, ''), '[^0-9]', '', 'g') LIKE '0041%'
        THEN substr(regexp_replace(coalesce(p.phone, p.whatsapp, ''), '[^0-9]', '', 'g'), 3)
      WHEN regexp_replace(coalesce(p.phone, p.whatsapp, ''), '[^0-9]', '', 'g') LIKE '0%'
        THEN '41' || substr(regexp_replace(coalesce(p.phone, p.whatsapp, ''), '[^0-9]', '', 'g'), 2)
      ELSE regexp_replace(coalesce(p.phone, p.whatsapp, ''), '[^0-9]', '', 'g')
    END AS phone_key,
    split_part(
      regexp_replace(
        regexp_replace(lower(trim(coalesce(p.website, ''))), '^https?://', ''),
        '^www\.',
        ''
      ),
      '/',
      1
    ) AS website_key
  FROM public.providers p
), inserted AS (
  INSERT INTO public.providers (
    user_id,
    name,
    category,
    city,
    canton,
    address,
    description,
    services,
    phone,
    whatsapp,
    email,
    website,
    languages,
    spanish_supported,
    verified,
    featured,
    active
  )
  SELECT
    NULL::uuid,
    s.name,
    s.category,
    s.city,
    s.canton,
    s.address,
    s.description,
    s.services,
    s.phone,
    NULL::text,
    s.email,
    s.website,
    CASE WHEN s.spanish_status = 'Confirmado' THEN ARRAY['Español']::text[] ELSE NULL::text[] END,
    CASE WHEN s.spanish_status = 'Confirmado' THEN TRUE ELSE NULL::boolean END,
    FALSE,
    FALSE,
    TRUE
  FROM normalized_source s
  WHERE NOT EXISTS (
    SELECT 1
    FROM existing e
    WHERE
      (e.name_key = s.name_key AND coalesce(e.canton, '') = s.canton)
      OR (s.website_key <> '' AND e.website_key = s.website_key)
      OR (s.phone_key <> '' AND e.phone_key = s.phone_key)
  )
  RETURNING id, name, category, city
)
SELECT *
FROM inserted
ORDER BY name;

COMMIT;

-- Comprobacion: debe devolver las 16 fichas, sin duplicar si se ejecuta de nuevo.
WITH expected_names(name) AS (
  VALUES
    ('El Rincón Argentino'),
    ('Pikante Peruvian Culinary Art'),
    ('Tapas Cabañas'),
    ('Italo Hispano Comestibles'),
    ('Spanisch Studio (by SmartTalk)'),
    ('Escuela Antigua Guatemala'),
    ('Spanisch lernen mit Jorge'),
    ('Salsamania Tanzschule'),
    ('Salsa y más'),
    ('Asociación de Inválidos y Pensionistas Españoles de Lucerna'),
    ('advolaw GmbH'),
    ('Neustadt Advokatur'),
    ('Thomas Wüthrich, Rechtsanwalt'),
    ('Cosmetic Institute Beauty Rocío'),
    ('Dolmetschdienst Zentralschweiz'),
    ('Traducta Luzern')
)
SELECT p.id, p.name, p.category, p.city, p.canton, p.website, p.phone
FROM public.providers p
JOIN expected_names e ON lower(trim(e.name)) = lower(trim(p.name))
ORDER BY p.name;

-- Incidencia ya existente detectada durante el cruce: TRIAS aparece dos veces.
-- No se elimina automaticamente para no perder resenas o relaciones.
SELECT id, name, category, city, website, phone
FROM public.providers
WHERE lower(coalesce(website, '')) LIKE '%advokatur-trias.ch%'
ORDER BY created_at;
