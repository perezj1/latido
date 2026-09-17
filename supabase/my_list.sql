-- =====================================================================
-- LATIDO.CH - Mi lista
-- Convierte las busquedas guardadas en anotaciones privadas que pueden
-- marcarse como conseguidas. El email queda reservado para una futura
-- funcionalidad de pago.
-- =====================================================================

BEGIN;

ALTER TABLE public.saved_searches
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE public.saved_searches
  ALTER COLUMN email_enabled SET DEFAULT FALSE;

-- La version gratuita muestra las novedades dentro de Latido. Evitamos que
-- las busquedas antiguas sigan entrando en el cron de correo.
UPDATE public.saved_searches
SET email_enabled = FALSE
WHERE email_enabled = TRUE;

-- En Mi lista la anotacion visible es la frase de la persona, sin el prefijo
-- tecnico que usaba la antigua pantalla de busquedas guardadas.
UPDATE public.saved_searches
SET name = LEFT(query, 100)
WHERE NULLIF(BTRIM(query), '') IS NOT NULL
  AND name IS DISTINCT FROM LEFT(query, 100);

-- Las alertas que ya estaban pausadas pasan a la zona Conseguido. De este
-- modo no desaparecen durante la migracion de la interfaz.
UPDATE public.saved_searches
SET completed_at = COALESCE(completed_at, updated_at, NOW())
WHERE active = FALSE
  AND completed_at IS NULL;

CREATE INDEX IF NOT EXISTS saved_searches_user_completed_idx
  ON public.saved_searches (user_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;

-- La funcion historica usaba una variable llamada completed_at. Al existir
-- ahora una columna con el mismo nombre la renombramos para evitar ambiguedad.
CREATE OR REPLACE FUNCTION public.complete_saved_search_email_delivery(
  p_saved_search_id UUID,
  p_match_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  delivery_completed_at TIMESTAMPTZ := NOW();
BEGIN
  UPDATE public.saved_search_matches
  SET
    email_status = 'sent',
    email_sent_at = delivery_completed_at,
    email_processing_at = NULL,
    email_error = NULL
  WHERE saved_search_id = p_saved_search_id
    AND id = ANY(p_match_ids)
    AND email_status = 'processing';

  UPDATE public.saved_searches
  SET
    last_email_attempt_at = delivery_completed_at,
    last_email_notified_at = delivery_completed_at,
    updated_at = delivery_completed_at
  WHERE id = p_saved_search_id;
END;
$$;

-- El limite se aplica a lo que Latido sigue buscando, no al historial de
-- necesidades conseguidas.
CREATE OR REPLACE FUNCTION public.limit_saved_searches_per_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.saved_searches
    WHERE user_id = NEW.user_id
      AND fingerprint = NEW.fingerprint
  ) AND (
    SELECT COUNT(*)
    FROM public.saved_searches
    WHERE user_id = NEW.user_id
      AND active = TRUE
      AND completed_at IS NULL
  ) >= 10 THEN
    RAISE EXCEPTION 'Puedes tener hasta 10 necesidades activas. Marca una como conseguida para añadir otra.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
