-- =====================================================================
-- LATIDO.CH - Baja del resumen informativo semanal
--
-- Ejecutar una vez en Supabase SQL Editor. Es idempotente y no modifica
-- los avisos de mensajes, busquedas guardadas ni alertas comerciales.
-- =====================================================================

BEGIN;

INSERT INTO public.email_notification_preferences (
  user_id,
  weekly_digest_enabled,
  updated_at
)
SELECT
  profile.id,
  FALSE,
  NOW()
FROM public.profiles profile
WHERE LOWER(BTRIM(COALESCE(profile.email, ''))) = 'pablorope03@icloud.com'
ON CONFLICT (user_id) DO UPDATE
SET
  weekly_digest_enabled = FALSE,
  updated_at = NOW();

UPDATE public.weekly_digest_email_log
SET
  status = 'suppressed',
  processing_started_at = NULL,
  last_error = 'weekly_digest_opt_out',
  updated_at = NOW()
WHERE LOWER(BTRIM(email)) = 'pablorope03@icloud.com'
  AND status IN ('pending', 'processing', 'failed');

COMMIT;

