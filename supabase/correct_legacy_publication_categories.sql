-- =====================================================================
-- LATIDO.CH - Corrección de categorías en publicaciones antiguas
--
-- Idempotente. Corrige únicamente los tres registros verificados.
-- No modifica reglas de moderación, reportes ni contenido del usuario.
-- =====================================================================

BEGIN;

-- Estas publicaciones describen disponibilidad personal para trabajar,
-- por lo que son solicitudes de empleo y no vacantes de una empresa.
UPDATE public.jobs
SET
  job_intent = 'busca',
  updated_at = NOW()
WHERE id IN (
  '0bbed2bc-51ee-49b0-93f1-43db403ce636',
  'b51104fd-9def-47f4-bf12-253e128ee8fa',
  '677dab98-7955-40cd-a3c5-90322a420ca6'
)
AND job_intent IS DISTINCT FROM 'busca';

-- "Conductor de taxi" ofrece un servicio directo a clientes. Se conserva
-- el identificador para mantener una referencia estable entre tablas.
INSERT INTO public.listings (
  id,
  user_id,
  user_name,
  cat,
  sub,
  emoji,
  type,
  title,
  "desc",
  price,
  price_amount,
  price_unit,
  canton,
  city,
  plz,
  privacy,
  img_url,
  photo_urls,
  contact_phone,
  contact_email,
  contact_via_app,
  active,
  created_at,
  updated_at
)
SELECT
  job.id,
  job.user_id,
  COALESCE(NULLIF(profile.name, ''), NULLIF(job.company, ''), 'Usuario'),
  'servicios',
  'Transporte',
  '🚕',
  'ofrece',
  job.title,
  job."desc",
  NULL,
  NULL,
  NULL,
  job.canton,
  job.city,
  NULL,
  'public',
  job.logo_url,
  CASE
    WHEN COALESCE(job.logo_url, '') = '' THEN '[]'::jsonb
    ELSE jsonb_build_array(job.logo_url)
  END,
  job.contact_phone,
  job.contact_email,
  COALESCE(job.contact_via_app, TRUE),
  job.active,
  job.created_at,
  job.updated_at
FROM public.jobs AS job
LEFT JOIN public.profiles AS profile ON profile.id = job.user_id
WHERE job.id = '8398a8cd-a8fd-462f-bf67-36a2fe69a8ae'
ON CONFLICT (id) DO NOTHING;

-- El original permanece como registro histórico, pero deja de aparecer
-- dentro de Empleo para evitar duplicados.
UPDATE public.jobs
SET
  active = FALSE,
  updated_at = NOW()
WHERE id = '8398a8cd-a8fd-462f-bf67-36a2fe69a8ae'
AND active IS DISTINCT FROM FALSE;

COMMIT;
