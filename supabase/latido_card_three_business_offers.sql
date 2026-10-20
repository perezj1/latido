-- Ejecutar manualmente en el SQL Editor de Supabase con rol postgres.
-- No modifica el esquema ni crea negocios nuevos.
-- Ofertas habituales: 1 uso por socio al mes, sin compra mínima ni caducidad.
-- Los nombres se comparan ignorando mayúsculas, espacios y signos.
-- Se admiten sufijos en el nombre, pero debe coincidir un único negocio.
-- Si falta uno, hay ambigüedad o está inactivo/suspendido, se revierte TODO.
-- Se pueden añadir a otras ofertas activas. No pausa ni reemplaza las existentes.
-- Repetirlo conserva las ofertas ya creadas y su historial de usos.

BEGIN;

DO $$
DECLARE
  item RECORD;
  matches UUID[];
  target UUID;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('allstarbarber', 'Allstar Barber',
       'Lavado de cabeza gratuito',
       'Lavado de cabeza gratuito para socios de Tarjeta Latido.',
       'gift', NULL::numeric),
      ('danceparadise', 'DANCEparadise',
       '25 % de descuento en los cursos',
       '25 % de descuento en los cursos para socios de Tarjeta Latido.',
       'percent', 25::numeric),
      ('guapabeauty', 'Guapa Beauty',
       '5 % de descuento en uñas',
       '5 % de descuento en servicios de uñas para socios de Tarjeta Latido.',
       'percent', 5::numeric)
    ) AS offers(name_key, business_name, title, description, benefit_type, benefit_value)
  LOOP
    SELECT array_agg(p.id ORDER BY p.id) INTO matches
    FROM public.providers p
    WHERE regexp_replace(lower(p.name), '[^a-z0-9]', '', 'g') LIKE item.name_key || '%'
      AND to_jsonb(p)->>'deleted_at' IS NULL;

    IF coalesce(cardinality(matches), 0) <> 1 THEN
      RAISE EXCEPTION 'Se esperaba un único negocio para %, encontrados: %. No se aplica ningún cambio.',
        item.business_name, coalesce(cardinality(matches), 0);
    END IF;
    target := matches[1];

    -- Mismo orden de bloqueo que la publicación desde la app.
    PERFORM 1 FROM public.providers p
    WHERE p.id = target AND to_jsonb(p)->>'deleted_at' IS NULL
      AND coalesce((to_jsonb(p)->>'active')::boolean, true)
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'El negocio % no está publicado/activo.', item.business_name;
    END IF;

    INSERT INTO public.latido_card_businesses(provider_id, active)
    VALUES (target, true) ON CONFLICT (provider_id) DO NOTHING;

    PERFORM 1 FROM public.latido_card_businesses
    WHERE provider_id = target AND NOT suspended FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'El negocio % está suspendido en Tarjeta Latido.', item.business_name;
    END IF;

    -- Idempotencia: reconocer la misma oferta sin editar sus condiciones/usos.
    IF NOT EXISTS (
      SELECT 1 FROM public.latido_card_offers o
      WHERE o.provider_id = target AND o.deleted_at IS NULL AND o.active
        AND o.starts_at <= now() AND o.ends_at = 'infinity'::timestamptz
        AND o.title = item.title AND o.description = item.description
        AND o.benefit_type = item.benefit_type
        AND o.benefit_value IS NOT DISTINCT FROM item.benefit_value
        AND o.minimum_spend = 0 AND NOT o.requires_claim AND o.stock_total IS NULL
        AND o.usage_period = 'month' AND o.usage_limit = 1
        AND o.activation_mode = 'manual'
    ) THEN
      INSERT INTO public.latido_card_offers (
        provider_id, title, description, benefit_type, benefit_value,
        minimum_spend, requires_claim, stock_total, usage_period, usage_limit,
        starts_at, ends_at, active, activation_mode
      ) VALUES (
        target, item.title, item.description, item.benefit_type, item.benefit_value,
        0, false, NULL, 'month', 1, now(), 'infinity'::timestamptz, true, 'manual'
      );
    END IF;

    UPDATE public.latido_card_businesses SET active = true
    WHERE provider_id = target AND NOT active;
  END LOOP;
END $$;

COMMIT;

-- Resultado: comprobar negocio, ciudad y condiciones publicadas.
SELECT p.name AS negocio, p.city AS ciudad, o.id AS oferta_id,
       o.title AS oferta, o.benefit_type AS tipo, o.benefit_value AS valor,
       o.usage_period AS periodo, o.usage_limit AS usos_por_socio,
       o.minimum_spend AS compra_minima, o.ends_at AS caducidad,
       b.active AND NOT b.suspended AND o.active AS activa
FROM public.latido_card_offers o
JOIN public.providers p ON p.id = o.provider_id
JOIN public.latido_card_businesses b ON b.provider_id = p.id
WHERE o.deleted_at IS NULL AND o.active AND o.ends_at > now()
  AND (
    (regexp_replace(lower(p.name), '[^a-z0-9]', '', 'g') LIKE 'allstarbarber%'
      AND o.title = 'Lavado de cabeza gratuito')
    OR (regexp_replace(lower(p.name), '[^a-z0-9]', '', 'g') LIKE 'danceparadise%'
      AND o.title = '25 % de descuento en los cursos')
    OR (regexp_replace(lower(p.name), '[^a-z0-9]', '', 'g') LIKE 'guapabeauty%'
      AND o.title = '5 % de descuento en uñas')
  )
ORDER BY p.name;
