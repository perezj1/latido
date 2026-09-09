-- Run in the Supabase SQL editor before deploying the contact selector.
-- Requires profiles and public.is_business_promotion_admin().
BEGIN;

CREATE TABLE IF NOT EXISTS public.punto_hispano_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  category_id TEXT NOT NULL,
  category_label TEXT NOT NULL,
  service_id TEXT NOT NULL,
  service_label TEXT NOT NULL,
  placement TEXT NOT NULL DEFAULT 'direct',
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (user_id, request_id)
);

CREATE INDEX IF NOT EXISTS punto_hispano_contacts_date_idx
  ON public.punto_hispano_contacts (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS punto_hispano_contacts_category_date_idx
  ON public.punto_hispano_contacts (category_id, created_at DESC, id DESC);

ALTER TABLE public.punto_hispano_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.punto_hispano_contacts FROM anon, authenticated;
GRANT SELECT ON public.punto_hispano_contacts TO authenticated;
DROP POLICY IF EXISTS punto_hispano_contacts_admin_read ON public.punto_hispano_contacts;
CREATE POLICY punto_hispano_contacts_admin_read ON public.punto_hispano_contacts
  FOR SELECT TO authenticated USING (public.is_business_promotion_admin());

CREATE OR REPLACE FUNCTION public.record_punto_hispano_contact(
  p_request_id UUID, p_category TEXT, p_service TEXT, p_placement TEXT DEFAULT 'direct'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  contact_name TEXT;
  contact_email TEXT;
  category_label TEXT;
  service_label TEXT;
  normalized_service TEXT := COALESCE(btrim(p_service), '');
  catalogue CONSTANT JSONB := '[{"id":"gestoria","label":"Gestoría y asesoría","services":[{"id":"rav","label":"Desempleo y RAV"},{"id":"tramites","label":"Trámites y acompañamientos"},{"id":"impuestos","label":"Impuestos y contabilidad"},{"id":"empresas","label":"Creación de empresas"},{"id":"cv","label":"CV y cartas de presentación"},{"id":"legal","label":"Asesoría legal"},{"id":"traducciones","label":"Traducciones generales y oficiales"}]},{"id":"idiomas","label":"Idiomas","services":[{"id":"aleman","label":"Alemán (A1–C1)"},{"id":"ingles","label":"Inglés (A1–C1)"}]},{"id":"seguros","label":"Seguros y pensiones","services":[{"id":"salud","label":"Salud y complementarios"},{"id":"hogar","label":"Hogar, vehículos y viajes"},{"id":"pensiones","label":"Vida y pensiones (pilares)"},{"id":"empresa","label":"Seguros de empresa"},{"id":"prestaciones","label":"Ayudas familiares, primas y baja laboral"},{"id":"polizas","label":"Revisión de pólizas y reclamaciones"}]},{"id":"alquiler","label":"Vehículos y mudanzas","services":[{"id":"coches","label":"Alquiler de coches"},{"id":"furgonetas","label":"Alquiler de furgonetas"},{"id":"mudanzas","label":"Mudanzas"}]},{"id":"vivienda","label":"Vivienda","services":[{"id":"buscar","label":"Alquiler de pisos y habitaciones"},{"id":"contratos","label":"Contratos y depósitos"},{"id":"gestion","label":"Gestión y mantenimiento"},{"id":"limpieza","label":"Mudanza y limpieza"}]},{"id":"relocation","label":"Llegada a Suiza y retorno","services":[{"id":"llegada","label":"Pack de llegada e integración"},{"id":"permisos","label":"Permisos y registro en Suiza"},{"id":"instalacion","label":"Vivienda, banco y servicios básicos"},{"id":"retorno","label":"Pack de retorno al país de origen"}]},{"id":"digital","label":"Soluciones digitales","services":[{"id":"web","label":"Páginas web y tiendas online"},{"id":"crm","label":"Gestión de clientes (CRM)"},{"id":"ia","label":"Inteligencia artificial y automatización"},{"id":"marketing","label":"Marketing y redes sociales"},{"id":"apps","label":"Apps y proyectos personalizados"},{"id":"soporte","label":"Consultoría y soporte digital"}]}]';
  saved public.punto_hispano_contacts%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL OR char_length(COALESCE(p_placement, '')) > 120 THEN
    RAISE EXCEPTION 'Invalid contact request' USING ERRCODE = '22023';
  END IF;

  SELECT category ->> 'label' INTO category_label
  FROM jsonb_array_elements(catalogue) AS category
  WHERE category ->> 'id' = p_category;
  IF category_label IS NULL THEN
    RAISE EXCEPTION 'Invalid category' USING ERRCODE = '22023';
  END IF;

  IF normalized_service = '' THEN
    service_label := 'Sin especificar';
  ELSE
    SELECT service ->> 'label' INTO service_label
    FROM jsonb_array_elements(catalogue) AS category,
      LATERAL jsonb_array_elements(category -> 'services') AS service
    WHERE category ->> 'id' = p_category AND service ->> 'id' = normalized_service;
    IF service_label IS NULL THEN
      RAISE EXCEPTION 'Invalid service' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Identity and timestamp are resolved on the server, never supplied by callers.
  SELECT COALESCE(NULLIF(btrim(profile.name), ''),
      NULLIF(btrim(account.raw_user_meta_data ->> 'name'), ''),
      NULLIF(btrim(account.raw_user_meta_data ->> 'full_name'), '')),
    account.email
  INTO contact_name, contact_email
  FROM auth.users AS account
  LEFT JOIN public.profiles AS profile ON profile.id = account.id
  WHERE account.id = current_user_id;
  IF contact_name IS NULL OR NULLIF(btrim(contact_email), '') IS NULL THEN
    RAISE EXCEPTION 'Complete your Latido name and email before contacting' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.punto_hispano_contacts (
    request_id, user_id, user_name, user_email, category_id, category_label,
    service_id, service_label, placement
  ) VALUES (
    p_request_id, current_user_id, contact_name, contact_email, p_category, category_label,
    normalized_service, service_label, COALESCE(NULLIF(btrim(p_placement), ''), 'direct')
  ) ON CONFLICT (user_id, request_id) DO NOTHING;

  SELECT * INTO STRICT saved FROM public.punto_hispano_contacts
  WHERE user_id = current_user_id AND request_id = p_request_id;
  IF saved.category_id <> p_category OR saved.service_id <> normalized_service THEN
    RAISE EXCEPTION 'Request already used for another service' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object('id', saved.id, 'user_name', saved.user_name,
    'category_label', saved.category_label,
    'service_label', CASE WHEN saved.service_id = '' THEN '' ELSE saved.service_label END,
    'created_at', saved.created_at);
END;
$$;

REVOKE ALL ON FUNCTION public.record_punto_hispano_contact(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_punto_hispano_contact(UUID, TEXT, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
