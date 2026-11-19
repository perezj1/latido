-- Solo lectura. No es necesario reinstalar la migración si estas comprobaciones pasan.
SELECT
  (SELECT count(*) FROM public.suizamente_catalogo_votos) AS preguntas_registradas,
  to_regprocedure('public.suizamente_votos_api(text,text,text,integer,text)') IS NOT NULL AS funcion_instalada,
  has_function_privilege('service_role', 'public.suizamente_votos_api(text,text,text,integer,text)', 'EXECUTE') AS servidor_puede_ejecutar,
  NOT has_function_privilege('anon', 'public.suizamente_votos_api(text,text,text,integer,text)', 'EXECUTE') AS acceso_anonimo_directo_bloqueado,
  NOT has_function_privilege('authenticated', 'public.suizamente_votos_api(text,text,text,integer,text)', 'EXECUTE') AS acceso_usuario_directo_bloqueado;

-- Debe devolver las tres tablas con rls_activado = true.
SELECT relname AS tabla, relrowsecurity AS rls_activado
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN ('suizamente_catalogo_votos', 'suizamente_votos', 'suizamente_votos_limites')
ORDER BY relname;
