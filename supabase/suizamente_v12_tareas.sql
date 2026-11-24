-- Operational activation after v12_progreso. Run as the database administrator.
-- UTC every minute; the engine uses Europe/Zurich, including summer/winter time.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('suizamente-progreso','* * * * *','SELECT suizamente_private.v12_tick()');
COMMIT;
