-- Completa las 16 fichas importadas desde directorio-hispano-luzern.xlsx.
--
-- 1. Añade a cada negocio una imagen procedente de su web oficial.
-- 2. Completa las webs oficiales que faltaban en el Excel.
-- 3. Inserta únicamente comentarios que una fuente pública identifica
--    expresamente como reseñas de Google. Los textos están completos y
--    traducidos al castellano; no se crean reseñas para rellenar puntuaciones.
--
-- Es idempotente: se puede ejecutar de nuevo sin duplicar reseñas.
-- Las fechas relativas publicadas por algunos directorios son aproximadas.

BEGIN;

WITH media (name, website, photo_url) AS (
  VALUES
    (
      'El Rincón Argentino',
      'https://el-rincon-argentino.ch',
      'https://el-rincon-argentino.ch/images/s2dlogo.jpg'
    ),
    (
      'Pikante Peruvian Culinary Art',
      'https://www.pikante-luzern.ch',
      'https://www.pikante-luzern.ch/img/og-image.png'
    ),
    (
      'Tapas Cabañas',
      'https://cabanas.ch',
      'https://cabanas.ch/wp-content/uploads/2019/11/cabanas-restaurant.jpg'
    ),
    (
      'Italo Hispano Comestibles',
      'https://italohispano.ch',
      'https://italohispano.ch/wp/wp-content/uploads/2021/11/italohispano-ravioli.svg'
    ),
    (
      'Spanisch Studio (by SmartTalk)',
      'https://spanisch-studio.ch',
      'https://static.wixstatic.com/media/6c3218_a47ee390230e49a896a221e3ce06c7d5~mv2.png/v1/fill/w_338,h_88,al_c,lg_1,q_85,enc_avif,quality_auto/6c3218_a47ee390230e49a896a221e3ce06c7d5~mv2.png'
    ),
    (
      'Escuela Antigua Guatemala',
      'https://www.escuela-antigua.ch',
      'https://static.wixstatic.com/media/c68591_457a24e3bcc44674bc93eb475608ce48~mv2.png/v1/fit/w_2500,h_1330,al_c/c68591_457a24e3bcc44674bc93eb475608ce48~mv2.png'
    ),
    (
      'Spanisch lernen mit Jorge',
      'https://www.jorgespanischunterricht.ch',
      'https://static.wixstatic.com/media/e624d4_c0268d106d334fc782161479408ab228~mv2.jpg/v1/fill/w_294,h_276,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/IMG_0439.jpg'
    ),
    (
      'Salsamania Tanzschule',
      'https://www.salsamania.ch',
      'https://www.salsamania.ch/wp-content/uploads/2016/07/logo.jpg'
    ),
    (
      'Salsa y más',
      'https://salsaymas.ch',
      'https://salsaymas.ch/home/wp-content/uploads/2020/12/salsa-y-mas1-1024x353.jpg'
    ),
    (
      'Asociación de Inválidos y Pensionistas Españoles de Lucerna',
      'https://www.aipel.ch',
      'https://www.aipel.ch/images/Logotipo.JPG'
    ),
    (
      'advolaw GmbH',
      'https://advolaw.ch',
      'https://b2793988.smushcdn.com/2793988/wp-content/uploads/2020/05/advolaw-rechtsanwaelte-logo.png?lossy=1&strip=1&webp=1'
    ),
    (
      'Neustadt Advokatur',
      'https://neustadt-advokatur.ch',
      'https://images.squarespace-cdn.com/content/v1/604e10f8b76f6f3abff89d38/c43dbfaf-a96a-4901-b75b-1b481b18dca5/Neustadt-Advokatur-Team.jpg?format=1000w'
    ),
    (
      'Thomas Wüthrich, Rechtsanwalt',
      'https://www.anwalt-luzern.ch',
      'https://www.anwalt-luzern.ch/images/Logo/logo-text7.png'
    ),
    (
      'Cosmetic Institute Beauty Rocío',
      'https://beauty-rocio.ch',
      'https://beauty-rocio.ch/wp-content/uploads/2022/12/Design-ohne-Titel-1.png'
    ),
    (
      'Dolmetschdienst Zentralschweiz',
      'https://www.dolmetschdienst.ch',
      'https://www.dolmetschdienst.ch/fileadmin/_processed_/4/9/csm_dolmetschdienst_interkulturelles_dolmetschen_header_6df101ca1f.jpg'
    ),
    (
      'Traducta Luzern',
      'https://www.traducta.ch/uebersetzungsbuero-luzern',
      'https://www.traducta.ch/sites/traducta.ch/files/agency-image/uebersetzungsbuero-traducta-luzern.jpg'
    )
)
UPDATE public.providers AS provider
SET
  website = media.website,
  photo_url = media.photo_url
FROM media
WHERE lower(trim(provider.name)) = lower(trim(media.name))
  AND provider.active = TRUE
  AND provider.user_id IS NULL;

-- Fuentes de los comentarios y estrellas individuales:
-- https://wanderlog.com/de/place/details/3505471/el-rinc%C3%B3n-argentino
-- https://wanderlog.com/place/details/1167244/pikante-peruvian-culinary-art
-- https://de.restaurantguru.com/Cabanas-Lucerne
-- https://restaurantguru.com/AIPEL-Lucerne
-- Wanderlog enlaza cada reseña con Google Maps y Restaurant Guru marca cada
-- comentario incluido como "on Google".
WITH google_reviews (
  provider_name,
  author_name,
  stars,
  review_text,
  published_at
) AS (
  VALUES
    (
      'El Rincón Argentino',
      'Torsten „',
      5,
      'El Rincón es muy recomendable. El servicio es muy amable, cordial y profesional. Para empezar hubo una estupenda selección de tapas; la selección de carnes es muy buena y la calidad, realmente alta. La relación calidad-precio es muy justa para Suiza. También tienen una buena carta de vinos. Para nosotros fue una noche perfecta y la estupenda decoración hace que uno se sienta muy a gusto.',
      '2025-07-05 12:00:00+00'::timestamptz
    ),
    (
      'El Rincón Argentino',
      'Andreas L',
      5,
      'La comida fue excelente. La carne estaba perfectamente cocinada y era de la mejor calidad. El servicio fue excepcionalmente amable y atento, lo que hizo que la visita fuera aún más agradable. Sin duda volveré y recomiendo este restaurante a cualquiera que disfrute de la carne y la buena compañía.',
      '2025-10-22 12:00:00+00'::timestamptz
    ),
    (
      'El Rincón Argentino',
      'Hans M',
      5,
      'Si te gustan los cortes de carne tiernos y jugosos a la parrilla, este es el lugar. El local es relativamente pequeño, así que conviene reservar. Cuando hace buen tiempo se puede comer delante del restaurante. La vista no es digna de Instagram, pero la comida sí.',
      '2025-07-20 12:00:00+00'::timestamptz
    ),
    (
      'Pikante Peruvian Culinary Art',
      'Michele S',
      5,
      '¡Una experiencia fantástica de cocina peruana en Lucerna! Disfrutamos muchísimo de nuestra comida en Pikante: los makis fusión fueron una sorpresa deliciosa, el ceviche estaba lleno de sabor y el pescado era increíblemente fresco. Cada plato tenía una presentación preciosa, con creatividad y atención al detalle. El único inconveniente es que resulta algo caro, pero por la calidad y la experiencia merece totalmente la pena. Una visita imprescindible para quienes disfrutan de la cocina peruana.',
      '2025-01-31 12:00:00+00'::timestamptz
    ),
    (
      'Pikante Peruvian Culinary Art',
      'Swiss B',
      5,
      'Pikante es un restaurante pequeño y precioso que lleva a Lucerna los sabores intensos y la energía cálida de Perú. La comida tiene muchísimo carácter: una verdadera fusión de culturas que sorprende para bien. Los cócteles están equilibrados y preparados con esmero; acompañan perfectamente la comida. El equipo fue acogedor y atento. El ambiente es íntimo y agradable, ideal para una velada tranquila. Un lugar estupendo para disfrutar de algo diferente, sabroso y memorable. Sin duda volveremos.',
      '2025-04-25 12:00:00+00'::timestamptz
    ),
    (
      'Tapas Cabañas',
      'Fabian Fessler',
      5,
      '¡Quedamos absolutamente encantados! Este restaurante español es todo un acierto. Las tapas estaban increíblemente buenas: muy auténticas, recién preparadas y con un sabor de ensueño. El local está bellamente diseñado y junto a uno de los puntos más animados de Lucerna. El ambiente invita a quedarse. Un enorme elogio también para el equipo: el personal es fantástico, atento, cordial y profesional. Te sientes bienvenido desde el primer momento. Sin duda volveremos. ¡Viva España en pleno Lucerna!',
      '2026-06-23 12:00:00+00'::timestamptz
    ),
    (
      'Tapas Cabañas',
      'Andres Silvio Ricalde',
      5,
      'Servicio excelente y comida muy buena. Ambiente precioso y acogedor. Anfitriones muy amables; volveremos encantados.',
      '2026-02-21 12:00:00+00'::timestamptz
    ),
    (
      'Tapas Cabañas',
      'Greg D',
      5,
      'Este es el mejor restaurante español de la ciudad. El propietario y el personal son increíbles. La comida es de primera y está a la altura de las tapas que puedes encontrar en España. Para quienes no entienden la cultura española: la comida hecha a mano al momento necesita tiempo. Ese tiempo hay que pasarlo conversando, bebiendo y disfrutando. La perfección no se puede apresurar, ni tampoco a tus acompañantes. ¡Bravo, Tapas Cabañas!',
      '2025-07-21 12:00:00+00'::timestamptz
    ),
    (
      'Asociación de Inválidos y Pensionistas Españoles de Lucerna',
      'Alves Laura',
      5,
      'Comida buenísima. Comida: 5. Servicio: 5. Ambiente: 5.',
      '2026-03-21 12:00:00+00'::timestamptz
    ),
    (
      'Asociación de Inválidos y Pensionistas Españoles de Lucerna',
      'Alain García',
      5,
      'Comida: 5. Servicio: 5. Ambiente: 5. Precio por persona: CHF 10–20.',
      '2026-03-21 12:00:00+00'::timestamptz
    )
), inserted_reviews AS (
  INSERT INTO public.reviews (
    provider_id,
    user_id,
    author_name,
    canton,
    stars,
    text,
    verified,
    active,
    created_at
  )
  SELECT
    provider.id,
    NULL::uuid,
    google_reviews.author_name || ' · Google',
    provider.canton,
    google_reviews.stars,
    google_reviews.review_text,
    FALSE,
    TRUE,
    google_reviews.published_at
  FROM google_reviews
  JOIN public.providers AS provider
    ON lower(trim(provider.name)) = lower(trim(google_reviews.provider_name))
   AND provider.active = TRUE
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.reviews AS existing_review
    WHERE existing_review.provider_id = provider.id
      AND lower(trim(existing_review.author_name)) =
          lower(trim(google_reviews.author_name || ' · Google'))
      AND existing_review.stars = google_reviews.stars
      AND existing_review.text = google_reviews.review_text
  )
  RETURNING id
)
SELECT count(*) AS google_reviews_inserted
FROM inserted_reviews;

COMMIT;

-- Comprobación: las 16 imágenes deben estar informadas y las reseñas importadas
-- deben aparecer en public.provider_ratings a través de public.reviews.
WITH expected_names (name) AS (
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
SELECT
  provider.id,
  provider.name,
  provider.website,
  provider.photo_url,
  rating.avg_rating,
  coalesce(rating.review_count, 0) AS review_count
FROM public.providers AS provider
JOIN expected_names
  ON lower(trim(expected_names.name)) = lower(trim(provider.name))
LEFT JOIN public.provider_ratings AS rating
  ON rating.provider_id = provider.id
WHERE provider.active = TRUE
ORDER BY provider.name;
