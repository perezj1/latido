-- Ejecutar en el SQL Editor de Supabase con permisos administrativos.
-- SOLO crea la ficha en Negocios; conserva el colaborador SYNA existente.
-- partner_published = FALSE evita crear otra tarjeta de colaborador.
-- La pill Premium y su prioridad usan promotion_plan, no partner_published.
-- No modifica fichas existentes ni crea pagos, suscripciones o nuevas landings.
-- Logo y contacto reutilizados de SynaPartnerContact.jsx.

BEGIN;
SELECT pg_advisory_xact_lock(hashtext('latido:syna-luzern-provider'));
SELECT set_config('latido.promotion_admin', '1', TRUE);

INSERT INTO public.providers (
  id, name, category, city, canton, address, description, services,
  languages, phone, whatsapp, email, website, photo_url,
  active, verified, featured,
  promotion_plan, promotion_starts_at, promotion_ends_at,
  partner_published
)
SELECT
  '7edd3612-cf9e-4d92-9b6e-861544127030'::UUID,
  'SYNA Luzern',
  'asesoria_tramites',
  'Lucerna',
  'LU',
  'Bireggstrasse 2, 6003 Luzern',
  'SYNA Luzern es un sindicato que acompaña a trabajadores en Suiza con asesoramiento sobre derecho laboral, contratos, salarios, condiciones de trabajo y convenios colectivos. Ofrece apoyo en asuntos de derecho laboral y seguros sociales a sus afiliados, según sus condiciones de cobertura. También dispone de caja de desempleo. La oficina regional ofrece atención en español. Contacto directo de Latido: Carlos Canosa.',
  ARRAY[
    'Asesoría laboral', 'Derechos laborales', 'Contratos de trabajo',
    'Salarios y condiciones de trabajo', 'Convenios colectivos',
    'Sindicato', 'Seguros sociales', 'Caja de desempleo'
  ]::TEXT[],
  ARRAY['Español', 'Alemán', 'Francés', 'Italiano', 'Portugués', 'Inglés']::TEXT[],
  '+41796608308',
  '+41796608308',
  'carlos.canosa@syna.ch',
  'https://syna.ch/luzern/',
  '/partners/syna/logo.svg',
  TRUE, TRUE, TRUE,
  'premium', NOW(), '9999-12-31 00:00:00+00'::TIMESTAMPTZ,
  FALSE
WHERE NOT EXISTS (
  SELECT 1 FROM public.providers
  WHERE id = '7edd3612-cf9e-4d92-9b6e-861544127030'::UUID
     OR LOWER(BTRIM(name)) IN ('syna', 'syna luzern', 'syna - luzern', 'syna – luzern')
)
ON CONFLICT (id) DO NOTHING;

COMMIT;

SELECT id, name, active, promotion_plan, promotion_ends_at,
  partner_published, photo_url
FROM public.providers
WHERE id = '7edd3612-cf9e-4d92-9b6e-861544127030'::UUID
   OR LOWER(BTRIM(name)) IN ('syna', 'syna luzern', 'syna - luzern', 'syna – luzern');
