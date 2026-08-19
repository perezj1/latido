-- LATIDO.CH - Lectura completa y explícita para el panel de administración.
--
-- Las políticas públicas de publicaciones y negocios solo muestran filas
-- activas. Eso es correcto para la app pública, pero hacía que el Admin
-- recibiera subconjuntos silenciosos y los presentara como totales.
-- Requiere public.is_business_promotion_admin().

BEGIN;

-- El panel cuenta perfiles. Repara cuentas de Auth cuyo trigger de alta pudo
-- fallar para que "Usuarios totales" no pierda cuentas registradas.
INSERT INTO public.profiles (id, name, email, canton)
SELECT
  auth_user.id,
  auth_user.raw_user_meta_data ->> 'name',
  auth_user.email,
  auth_user.raw_user_meta_data ->> 'canton'
FROM auth.users AS auth_user
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles AS profile WHERE profile.id = auth_user.id
)
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  table_name TEXT;
  policy_name CONSTANT TEXT := 'admin_dashboard_select_all';
BEGIN
  IF to_regprocedure('public.is_business_promotion_admin()') IS NULL THEN
    RAISE EXCEPTION 'Falta public.is_business_promotion_admin()';
  END IF;

  FOREACH table_name IN ARRAY ARRAY[
    'profiles',
    'listings',
    'jobs',
    'providers',
    'events',
    'communities',
    'messages',
    'reports',
    'moderation_queue'
  ]
  LOOP
    IF to_regclass('public.' || table_name) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_business_promotion_admin())',
      policy_name,
      table_name
    );
  END LOOP;
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
