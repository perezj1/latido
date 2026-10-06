-- Sorteos de Latido · primer sorteo: Santiago Cruz en Zürich (2 entradas dobles).
-- Run in the Supabase SQL editor before deploying /santiago-cruz.
-- Requires profiles and public.is_business_promotion_admin().
--
-- Participación gratuita y SIN cuenta obligatoria: cualquiera participa con
-- nombre + email. Si la persona ha iniciado sesión, nombre y email salen de su
-- cuenta. Un mismo email solo puede participar una vez por sorteo.
BEGIN;

CREATE TABLE IF NOT EXISTS public.giveaways (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  winners_count INTEGER NOT NULL DEFAULT 1 CHECK (winners_count > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (ends_at > starts_at)
);

-- Fechas en hora de Suiza: el 31 de octubre ya rige el horario estándar (+01:00).
INSERT INTO public.giveaways (id, title, starts_at, ends_at, winners_count)
VALUES (
  'santiago-cruz-zurich-2026',
  'Santiago Cruz en Zürich · 2 entradas dobles',
  '2026-10-01 00:00:00+02',
  '2026-10-31 23:59:59+01',
  2
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  starts_at = EXCLUDED.starts_at,
  ends_at = EXCLUDED.ends_at,
  winners_count = EXCLUDED.winners_count;

CREATE TABLE IF NOT EXISTS public.giveaway_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id TEXT NOT NULL REFERENCES public.giveaways(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 80),
  email TEXT NOT NULL CHECK (char_length(email) <= 254),
  email_normalized TEXT GENERATED ALWAYS AS (lower(btrim(email))) STORED,
  -- Newsletter: solo con la casilla marcada; la participación no depende de ella.
  marketing_consent BOOLEAN NOT NULL DEFAULT false,
  marketing_consent_at TIMESTAMPTZ,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (giveaway_id, email_normalized)
);

CREATE UNIQUE INDEX IF NOT EXISTS giveaway_entries_user_once_idx
  ON public.giveaway_entries (giveaway_id, user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS giveaway_entries_giveaway_date_idx
  ON public.giveaway_entries (giveaway_id, created_at DESC);

ALTER TABLE public.giveaways ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.giveaways FROM anon, authenticated;
GRANT SELECT ON public.giveaways TO anon, authenticated;
DROP POLICY IF EXISTS giveaways_public_read ON public.giveaways;
CREATE POLICY giveaways_public_read ON public.giveaways
  FOR SELECT TO anon, authenticated USING (true);

-- Las participaciones no se leen ni escriben directamente: solo vía funciones.
ALTER TABLE public.giveaway_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.giveaway_entries FROM anon, authenticated;
GRANT SELECT ON public.giveaway_entries TO authenticated;
DROP POLICY IF EXISTS giveaway_entries_admin_read ON public.giveaway_entries;
CREATE POLICY giveaway_entries_admin_read ON public.giveaway_entries
  FOR SELECT TO authenticated USING (public.is_business_promotion_admin());

CREATE OR REPLACE FUNCTION public.enter_giveaway(
  p_giveaway_id TEXT,
  p_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_marketing_consent BOOLEAN DEFAULT false,
  p_source TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  giveaway public.giveaways%ROWTYPE;
  entry_name TEXT := NULLIF(btrim(COALESCE(p_name, '')), '');
  entry_email TEXT := lower(NULLIF(btrim(COALESCE(p_email, '')), ''));
  consent BOOLEAN := COALESCE(p_marketing_consent, false);
  existing public.giveaway_entries%ROWTYPE;
  saved public.giveaway_entries%ROWTYPE;
BEGIN
  SELECT * INTO giveaway FROM public.giveaways WHERE id = p_giveaway_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'giveaway_not_found' USING ERRCODE = '22023';
  END IF;
  IF clock_timestamp() < giveaway.starts_at THEN
    RAISE EXCEPTION 'giveaway_not_started' USING ERRCODE = '22023';
  END IF;
  IF clock_timestamp() > giveaway.ends_at THEN
    RAISE EXCEPTION 'giveaway_closed' USING ERRCODE = '22023';
  END IF;

  IF current_user_id IS NOT NULL THEN
    -- Cuenta de Latido: identidad resuelta en el servidor, no desde el formulario.
    SELECT
      COALESCE(
        NULLIF(btrim(profile.name), ''),
        NULLIF(btrim(account.raw_user_meta_data ->> 'name'), ''),
        NULLIF(btrim(account.raw_user_meta_data ->> 'full_name'), ''),
        entry_name
      ),
      lower(btrim(account.email))
    INTO entry_name, entry_email
    FROM auth.users AS account
    LEFT JOIN public.profiles AS profile ON profile.id = account.id
    WHERE account.id = current_user_id;

    SELECT * INTO existing FROM public.giveaway_entries
    WHERE giveaway_id = p_giveaway_id AND user_id = current_user_id;
    IF FOUND THEN
      RETURN jsonb_build_object('status', 'already', 'email', existing.email, 'created_at', existing.created_at);
    END IF;
  END IF;

  IF entry_name IS NULL OR char_length(entry_name) < 2 OR char_length(entry_name) > 80 THEN
    RAISE EXCEPTION 'invalid_name' USING ERRCODE = '22023';
  END IF;
  IF entry_email IS NULL
    OR char_length(entry_email) > 254
    OR entry_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$' THEN
    RAISE EXCEPTION 'invalid_email' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO existing FROM public.giveaway_entries
  WHERE giveaway_id = p_giveaway_id AND email_normalized = entry_email;
  IF FOUND THEN
    -- Participó antes sin sesión con el mismo email: se vincula a su cuenta.
    IF current_user_id IS NOT NULL AND existing.user_id IS NULL THEN
      UPDATE public.giveaway_entries SET user_id = current_user_id WHERE id = existing.id;
    END IF;
    RETURN jsonb_build_object('status', 'already', 'email', existing.email, 'created_at', existing.created_at);
  END IF;

  BEGIN
    INSERT INTO public.giveaway_entries (
      giveaway_id, user_id, name, email, marketing_consent, marketing_consent_at, source
    ) VALUES (
      p_giveaway_id,
      current_user_id,
      entry_name,
      entry_email,
      consent,
      CASE WHEN consent THEN clock_timestamp() END,
      left(NULLIF(btrim(COALESCE(p_source, '')), ''), 120)
    )
    RETURNING * INTO saved;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('status', 'already', 'email', entry_email);
  END;

  RETURN jsonb_build_object('status', 'entered', 'email', saved.email, 'created_at', saved.created_at);
END;
$$;

-- Para que una cuenta vea al entrar si ya participa (por su cuenta o su email).
CREATE OR REPLACE FUNCTION public.get_my_giveaway_entry(p_giveaway_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  account_email TEXT;
  result JSONB;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT lower(btrim(email)) INTO account_email FROM auth.users WHERE id = current_user_id;

  SELECT jsonb_build_object('status', 'already', 'email', entry.email, 'created_at', entry.created_at)
  INTO result
  FROM public.giveaway_entries AS entry
  WHERE entry.giveaway_id = p_giveaway_id
    AND (entry.user_id = current_user_id OR entry.email_normalized = account_email)
  ORDER BY entry.created_at
  LIMIT 1;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.enter_giveaway(TEXT, TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enter_giveaway(TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_giveaway_entry(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_giveaway_entry(TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- ── Cuando termine (sábado 31 de octubre, 23:59) ───────────────────────
-- Recuento:
--   SELECT count(*) AS participantes,
--          count(*) FILTER (WHERE user_id IS NOT NULL) AS con_cuenta,
--          count(*) FILTER (WHERE marketing_consent) AS aceptan_novedades
--   FROM public.giveaway_entries WHERE giveaway_id = 'santiago-cruz-zurich-2026';
--
-- Sorteo aleatorio de los 2 ganadores (guarda el resultado antes de contactar):
--   SELECT id, name, email, created_at
--   FROM public.giveaway_entries
--   WHERE giveaway_id = 'santiago-cruz-zurich-2026'
--   ORDER BY random()
--   LIMIT 2;
--
-- Borrado de los datos del sorteo (como máximo 60 días después del concierto).
-- Conserva aparte los emails con marketing_consent = true si vas a usarlos:
--   DELETE FROM public.giveaway_entries WHERE giveaway_id = 'santiago-cruz-zurich-2026';
