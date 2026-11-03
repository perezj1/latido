-- Explicit historical enrollment requested by the owner.
-- Requires the current conversation_followups.sql. Queues the first historical
-- email, including previous chat-only rows. Re-running preserves answers and
-- deliveries; the existing worker processes the queue in batches.
BEGIN;
SELECT public.cf_enroll_history();
COMMIT;
