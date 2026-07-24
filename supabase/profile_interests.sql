-- ================================================================
-- LATIDO.CH - Preferencias de contenido de Mi Latido
-- Ejecuta este archivo en Supabase SQL Editor en proyectos existentes.
-- ================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS interests TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.profiles.interests IS
  'Categorías elegidas por el usuario para personalizar Mi Latido.';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  signup_languages TEXT[] := '{}';
  signup_interests TEXT[] := '{}';
BEGIN
  IF jsonb_typeof(NEW.raw_user_meta_data->'languages') = 'array' THEN
    SELECT ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'languages'))
    INTO signup_languages;
  END IF;

  IF jsonb_typeof(NEW.raw_user_meta_data->'interests') = 'array' THEN
    SELECT ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'interests'))
    INTO signup_interests;
  END IF;

  INSERT INTO public.profiles (id, name, email, canton, languages, interests)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    NEW.email,
    NEW.raw_user_meta_data->>'canton',
    signup_languages,
    signup_interests
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- El registro de Auth no debe fallar si el perfil no puede crearse.
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
