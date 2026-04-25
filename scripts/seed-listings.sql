-- ─────────────────────────────────────────────────────────────────────────────
-- SEED: anuncios de muestra para el usuario demo
-- Usuario UID: 1d752ef7-27d9-4883-b9ba-7aaa4f51f25a
--
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO listings
  (cat, sub, type, title, "desc", img_url, price, price_amount, price_unit,
   canton, plz, privacy, contact_via_app, user_id, active, user_name)
VALUES

-- ── VIVIENDA ─────────────────────────────────────────────────────────────────

  ( 'vivienda', 'Se busca habitación', 'busca',
    'Busco habitación en Zürich — zona centro o bien conectada',
    'Chico colombiano, 28 años, trabajo estable en IT. Llevo 6 meses en Suiza. Busco habitación en piso compartido tranquilo. No fumo, sin mascotas. Máximo CHF 950/mes todo incluido. Dispongo de referencias de mi anterior arrendador y nóminas.',
    NULL,
    'hasta CHF 950/mes', 950, 'mes',
    'ZH', '8001', 'public', true,
    '1d752ef7-27d9-4883-b9ba-7aaa4f51f25a', true, 'José M.' ),

  ( 'vivienda', 'Se ofrece piso', 'ofrece',
    'Se alquila piso 2 habitaciones en Carouge, Ginebra',
    'Piso luminoso de 2 habitaciones en el barrio de Carouge, a 10 minutos del centro en tranvía. 55 m², cocina equipada, balcón orientado al sur. Disponible desde el 1 de junio. No fumadores. Se valora estabilidad laboral y buenas referencias.',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=900&h=600&fit=crop',
    'CHF 1.650/mes', 1650, 'mes',
    'GE', '1227', 'public', true,
    '1d752ef7-27d9-4883-b9ba-7aaa4f51f25a', true, 'José M.' ),

  ( 'vivienda', 'Se ofrece habitación', 'ofrece',
    'Habitación en piso compartido — Berna, ambiente latino tranquilo',
    'Habitación de 14 m² en piso con dos latinos (Colombia y Venezuela). Ambiente ordenado y tranquilo. Cocina bien equipada, baño compartido y jardín comunitario. A 15 minutos a pie de la estación central de Berna. Disponible de inmediato.',
    'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=900&h=600&fit=crop',
    'CHF 750/mes', 750, 'mes',
    'BE', '3001', 'public', true,
    '1d752ef7-27d9-4883-b9ba-7aaa4f51f25a', true, 'José M.' ),

-- ── HOGAR ─────────────────────────────────────────────────────────────────────

  ( 'hogar', 'Limpieza', 'ofrece',
    'Limpieza profesional de pisos — Zürich y alrededores',
    'Ofrezco limpieza profunda o mantenimiento semanal. Cuatro años de experiencia en Suiza con referencias comprobables. Puntual, detallista y de total confianza. Productos incluidos. Disponible de lunes a sábado en horario de mañana y tarde.',
    'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=900&h=600&fit=crop',
    'CHF 28/h', 28, 'hora',
    'ZH', '8004', 'public', true,
    '1d752ef7-27d9-4883-b9ba-7aaa4f51f25a', true, 'José M.' ),

  ( 'hogar', 'Reparaciones', 'busca',
    'Busco alguien para pequeñas reparaciones en el hogar — Basilea',
    'Necesito ayuda para instalar unas luminarias, cambiar una persiana y revisar un enchufe que falla en la cocina. Piso en Basilea centro. Disponible fines de semana o tardes entre semana. Pago a precio justo y sin regateos.',
    NULL,
    NULL, NULL, NULL,
    'BS', '4001', 'public', true,
    '1d752ef7-27d9-4883-b9ba-7aaa4f51f25a', true, 'José M.' ),

  ( 'hogar', 'Mudanza', 'ofrece',
    'Ayudo con mudanzas — furgoneta propia, zona Zürich y alrededores',
    'Ofrezco servicio de mudanza con furgoneta de 20 m³. Puedo ir solo o con un ayudante según el volumen. Precios honestos y sin sorpresas. Experiencia en mudanzas dentro de Suiza, especialmente en el cantón de Zürich. Reserva con 48 h de antelación.',
    'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=900&h=600&fit=crop',
    'CHF 60/h', 60, 'hora',
    'ZH', '8050', 'public', true,
    '1d752ef7-27d9-4883-b9ba-7aaa4f51f25a', true, 'José M.' ),

-- ── MERCADO ───────────────────────────────────────────────────────────────────

  ( 'venta', 'Electrónica', 'ofrece',
    'iPhone 14 Pro 256 GB — impecable, con caja y factura suiza',
    'Vendo iPhone 14 Pro 256 GB color negro espacial. Comprado en Suiza, factura disponible. Batería al 94 %. Siempre usado con funda y cristal templado: sin golpes ni arañazos. Cargador original incluido. Precio negociable para venta rápida.',
    'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=900&h=600&fit=crop',
    'CHF 580 total', 580, 'once',
    'ZH', '8001', 'public', true,
    '1d752ef7-27d9-4883-b9ba-7aaa4f51f25a', true, 'José M.' ),

  ( 'venta', 'Muebles', 'regala',
    'Regalo sofá esquinero gris — Ginebra, solo recoger esta semana',
    'Sofá esquinero gris en buen estado general. Nos mudamos a un piso más pequeño y no cabe. Solo para quien pueda recogerlo con furgoneta esta semana. Primera persona que confirme y pueda venir se lo lleva. No hago reservas sin fecha concreta.',
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=900&h=600&fit=crop',
    'Gratis', NULL, NULL,
    'GE', '1201', 'public', true,
    '1d752ef7-27d9-4883-b9ba-7aaa4f51f25a', true, 'José M.' ),

  ( 'venta', 'Ropa', 'busca',
    'Busco ropa de invierno talla M-L para hombre — Zürich',
    'Busco abrigos, jerséis y pantalones de invierno en talla M-L de hombre. Interesa especialmente ropa de abrigo en buen estado. Marcas tipo Zara, H&M, Jack & Jones o similar. Pago precio razonable y puedo desplazarme por Zürich ciudad.',
    NULL,
    NULL, NULL, NULL,
    'ZH', '8005', 'public', true,
    '1d752ef7-27d9-4883-b9ba-7aaa4f51f25a', true, 'José M.' ),

-- ── CUIDADOS ──────────────────────────────────────────────────────────────────

  ( 'cuidados', 'Cuidado niños', 'ofrece',
    'Niñera con experiencia — tardes en Zürich, español e inglés',
    'Educadora colombiana de 31 años con más de 6 años cuidando niños de 0 a 10 años. Disponible de lunes a viernes de 15:00 a 20:00 y fines de semana con cita previa. Hablo español nativo, inglés avanzado y alemán básico. Referencias disponibles.',
    'https://images.unsplash.com/photo-1536640712-4d4c36ff0e4e?w=900&h=600&fit=crop',
    'CHF 22/h', 22, 'hora',
    'ZH', '8002', 'public', true,
    '1d752ef7-27d9-4883-b9ba-7aaa4f51f25a', true, 'José M.' ),

  ( 'cuidados', 'Cuidado mayores', 'busca',
    'Busco cuidadora para mi madre (70 años) — zona Berna',
    'Mi madre necesita compañía y ayuda diaria: preparación de comidas, paseos cortos y recordatorio de medicación. Imprescindible que hable español con fluidez. Se prefiere mujer con experiencia en el sector. Horario de lunes a viernes, mañanas.',
    NULL,
    'CHF 25/h', 25, 'hora',
    'BE', '3012', 'private', true,
    '1d752ef7-27d9-4883-b9ba-7aaa4f51f25a', true, 'José M.' ),

  ( 'cuidados', 'Au pair', 'ofrece',
    'Au pair disponible — Ginebra y alrededores, con carta de referencia',
    'Colombiana de 26 años busca familia en Ginebra o alrededores. Tengo 2 años de experiencia como au pair en España con carta de referencia. Me encantan los niños, soy responsable, alegre y muy activa. Disponibilidad inmediata o desde el 1 de mayo.',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=900&h=600&fit=crop',
    NULL, NULL, NULL,
    'GE', '1200', 'public', true,
    '1d752ef7-27d9-4883-b9ba-7aaa4f51f25a', true, 'José M.' ),

-- ── DOCUMENTOS / LEGAL ────────────────────────────────────────────────────────

  ( 'documentos', 'Traducción', 'ofrece',
    'Traducciones alemán ↔ español — cartas, contratos y documentos oficiales',
    'Ocho años viviendo en Suiza alemana. Traduzco y explico documentos oficiales, contratos de alquiler, cartas del Migrationsamt, Betreibungsamt y de la administración cantonal. No soy traductora jurada, ideal para uso personal e informativo. Entrega en 24-48 h.',
    'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=900&h=600&fit=crop',
    'CHF 20 total', 20, 'once',
    'ZH', '8001', 'public', true,
    '1d752ef7-27d9-4883-b9ba-7aaa4f51f25a', true, 'José M.' ),

  ( 'documentos', 'Trámites', 'busca',
    'Necesito ayuda para entender la renovación del permiso B — Zürich',
    'Llevo 4 años con permiso B y toca renovar. Tengo todos los documentos pero el formulario del Migrationsamt me resulta confuso, especialmente el apartado de integración. Busco a alguien que lo haya hecho recientemente y pueda orientarme, preferiblemente en persona.',
    NULL,
    NULL, NULL, NULL,
    'ZH', '8003', 'public', true,
    '1d752ef7-27d9-4883-b9ba-7aaa4f51f25a', true, 'José M.' ),

  ( 'documentos', 'Asesoría', 'ofrece',
    'Asesoría para recién llegados — permisos, Anmeldung y primeros pasos en Suiza',
    'Llevo 9 años en Suiza y he ayudado a decenas de latinos a instalarse. Te oriento con el Anmeldung, apertura de cuenta bancaria, búsqueda de piso y trámites del Migrationsamt. Primera consulta de 30 minutos completamente gratuita, sin compromiso.',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=900&h=600&fit=crop',
    'CHF 40/h', 40, 'hora',
    'GE', '1201', 'public', true,
    '1d752ef7-27d9-4883-b9ba-7aaa4f51f25a', true, 'José M.' ),

-- ── SERVICIOS ─────────────────────────────────────────────────────────────────

  ( 'servicios', 'Clases', 'ofrece',
    'Clases de alemán para hispanohablantes — online o presencial en Zürich',
    'Profesora venezolana con certificación C2 en alemán y 5 años de experiencia docente. Método diseñado específicamente para hispanohablantes, desde nivel A1 hasta B2. Clases individuales o grupos de máximo 3 personas. Materiales incluidos. Primera clase de prueba gratuita.',
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=900&h=600&fit=crop',
    'CHF 40/h', 40, 'hora',
    'ZH', '8006', 'public', true,
    '1d752ef7-27d9-4883-b9ba-7aaa4f51f25a', true, 'José M.' ),

  ( 'servicios', 'Peluquería', 'ofrece',
    'Peluquería a domicilio — cortes, tintes y tratamientos, zona Basilea',
    'Peluquera profesional con 10 años de experiencia en Colombia y 3 en Suiza. Especializada en cabello rizado, afrolatino y tratamientos con keratina. Voy a tu domicilio sin que tengas que desplazarte. Zona Basilea y alrededores. Cita previa por mensaje.',
    'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=900&h=600&fit=crop',
    'CHF 35 total', 35, 'once',
    'BS', '4051', 'public', true,
    '1d752ef7-27d9-4883-b9ba-7aaa4f51f25a', true, 'José M.' ),

  ( 'servicios', 'Clases', 'busca',
    'Busco profesor/a de alemán nivel A2 — Berna, tardes o fines de semana',
    'Llevo 8 meses en Suiza y necesito mejorar el alemán para la renovación del permiso B. Busco clases individuales dos veces por semana, preferiblemente tardes o sábados por la mañana. Puedo desplazarme por Berna o hacerlas online sin problema.',
    NULL,
    NULL, NULL, NULL,
    'BE', '3000', 'public', true,
    '1d752ef7-27d9-4883-b9ba-7aaa4f51f25a', true, 'José M.' );

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificar que se insertaron correctamente:
-- SELECT id, cat, type, title, canton FROM listings
-- WHERE user_id = '1d752ef7-27d9-4883-b9ba-7aaa4f51f25a'
-- ORDER BY cat, type;
-- ─────────────────────────────────────────────────────────────────────────────
