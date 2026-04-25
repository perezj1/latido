-- ─────────────────────────────────────────────────────────────────────────────
-- SEED: ofertas de empleo de muestra
-- Usuario UID: 1d752ef7-27d9-4883-b9ba-7aaa4f51f25a
--
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO jobs
  (user_id, sector, category, emoji, title, company, type,
   city, canton, salary, salary_amount, salary_unit,
   lang, languages, "desc", logo_url, contact, contact_via_app, active)
VALUES

-- ── 1. HOSTELERÍA — Full-time, Zürich ────────────────────────────────────────
  (
    '1d752ef7-27d9-4883-b9ba-7aaa4f51f25a',
    'hosteleria', 'hosteleria', '👨‍🍳',
    'Cocinero/a especialidad latinoamericana — jornada completa',
    'El Rincón Latino Zürich',
    'Full-time',
    'Zürich', 'ZH',
    'CHF 4.500 / mes', 4500, 'mes',
    'Español · Alemán básico',
    ARRAY['Español', 'Alemán'],
    'Buscamos cocinero/a con experiencia en cocina latinoamericana para nuestro restaurante en Zürich centro. Las tareas incluyen preparación de platos típicos (arepas, ceviches, bandeja paisa), gestión de mise en place y trabajo en equipo durante el servicio. Ofrecemos contrato estable con período de prueba de 3 meses, buen ambiente y posibilidad de crecimiento interno. Se requiere permiso de trabajo válido.',
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900&h=600&fit=crop',
    NULL, true, true
  ),

-- ── 2. CUIDADOS — Part-time, Ginebra ─────────────────────────────────────────
  (
    '1d752ef7-27d9-4883-b9ba-7aaa4f51f25a',
    'cuidados', 'cuidados', '👶',
    'Cuidadora de niños (4 y 7 años) — tardes de lunes a viernes, Ginebra',
    'Familia particular',
    'Part-time',
    'Ginebra', 'GE',
    'CHF 25 / hora', 25, 'hora',
    'Español · Francés',
    ARRAY['Español', 'Francés'],
    'Familia con dos niños (4 y 7 años) busca cuidadora de confianza para tardes de lunes a viernes de 15:30 a 19:00. Las tareas incluyen recogida del colegio, preparación de merienda, ayuda con deberes y juego supervisado. Imprescindible español con fluidez; se valora francés básico. Referencias de empleos anteriores obligatorias. Contrato con seguro incluido.',
    'https://images.unsplash.com/photo-1476703993599-0035a21b17a9?w=900&h=600&fit=crop',
    NULL, true, true
  ),

-- ── 3. LIMPIEZA — Full-time, Basilea ─────────────────────────────────────────
  (
    '1d752ef7-27d9-4883-b9ba-7aaa4f51f25a',
    'limpieza', 'limpieza', '🧹',
    'Auxiliar de limpieza — oficinas corporativas, jornada completa',
    'CleanPro Suisse GmbH',
    'Full-time',
    'Basilea', 'BS',
    'CHF 22 / hora', 22, 'hora',
    'Alemán básico · Español',
    ARRAY['Alemán', 'Español'],
    'Empresa de servicios de limpieza con 15 años de presencia en Suiza busca auxiliar para limpieza de oficinas corporativas en Basilea. Horario de 06:00 a 14:00, de lunes a viernes. Se requiere permiso de trabajo válido (B o C), puntualidad y actitud profesional. Experiencia previa en limpieza profesional valorada pero no indispensable; formamos nosotros. Salario según convenio colectivo.',
    'https://images.unsplash.com/photo-1628177142898-93e36e4e3a50?w=900&h=600&fit=crop',
    NULL, true, true
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificar:
-- SELECT id, sector, title, company, canton, salary FROM jobs
-- WHERE user_id = '1d752ef7-27d9-4883-b9ba-7aaa4f51f25a'
-- ORDER BY created_at DESC;
-- ─────────────────────────────────────────────────────────────────────────────
