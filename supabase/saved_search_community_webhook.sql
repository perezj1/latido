-- =====================================================================
-- LATIDO.CH - Webhook adicional para alertas de grupos
--
-- Reutiliza la URL y el secreto de cualquier webhook existente hacia
-- latido_push_notification. No muestra ni obliga a copiar el secreto.
-- Es seguro ejecutarlo cuando los webhooks de las otras tablas ya existen.
-- =====================================================================

DO $$
DECLARE
  function_url TEXT;
  webhook_secret TEXT;
  headers JSONB;
  source_args TEXT[];
BEGIN
  IF to_regclass('public.communities') IS NULL THEN
    RAISE EXCEPTION 'No existe public.communities.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_trigger AS trigger_row
    WHERE NOT trigger_row.tgisinternal
      AND trigger_row.tgrelid = 'public.communities'::REGCLASS
      AND pg_get_triggerdef(trigger_row.oid) ILIKE '%latido_push_notification%'
  ) THEN
    RAISE NOTICE 'El webhook push de communities ya existe. No se hicieron cambios.';
    RETURN;
  END IF;

  SELECT string_to_array(encode(trigger_row.tgargs, 'escape'), E'\\000')
  INTO source_args
  FROM pg_trigger AS trigger_row
  WHERE NOT trigger_row.tgisinternal
    AND pg_get_triggerdef(trigger_row.oid) ILIKE '%supabase_functions.http_request%'
    AND pg_get_triggerdef(trigger_row.oid) ILIKE '%latido_push_notification%'
  ORDER BY trigger_row.oid
  LIMIT 1;

  IF COALESCE(array_length(source_args, 1), 0) < 3 THEN
    RAISE EXCEPTION 'No se encontro un webhook existente hacia latido_push_notification del que reutilizar la configuracion.';
  END IF;

  function_url := NULLIF(source_args[1], '');
  headers := source_args[3]::JSONB;
  webhook_secret := NULLIF(headers ->> 'x-latido-webhook-secret', '');

  IF function_url IS NULL OR webhook_secret IS NULL THEN
    RAISE EXCEPTION 'El webhook existente no contiene la URL o x-latido-webhook-secret esperados.';
  END IF;

  DROP TRIGGER IF EXISTS latido_push_communities_insert_update ON public.communities;
  EXECUTE format(
    'CREATE TRIGGER latido_push_communities_insert_update AFTER INSERT OR UPDATE ON public.communities FOR EACH ROW EXECUTE FUNCTION supabase_functions.http_request(%L, %L, %L, %L, %L)',
    function_url,
    'POST',
    jsonb_build_object(
      'Content-Type', 'application/json',
      'x-latido-webhook-secret', webhook_secret
    )::TEXT,
    '{}'::TEXT,
    '5000'
  );

  RAISE NOTICE 'Webhook push de communities creado correctamente.';
END
$$;

-- Comprobacion sin mostrar secretos:
-- SELECT trigger_name, event_manipulation
-- FROM information_schema.triggers
-- WHERE event_object_schema = 'public'
--   AND event_object_table = 'communities';
