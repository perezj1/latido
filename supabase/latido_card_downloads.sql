-- Apply after latido_card_experience.sql and latido_card_multiple_offers.sql.
-- Optional public PDF attachments. Existing offers keep their current behavior.
BEGIN;
ALTER TABLE public.latido_card_offers ADD COLUMN IF NOT EXISTS download_path TEXT;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.latido_card_offers'::regclass AND conname='lc_offer_download_path') THEN
  ALTER TABLE public.latido_card_offers ADD CONSTRAINT lc_offer_download_path
   CHECK (download_path IS NULL OR (length(download_path)<=300 AND download_path ~ '^/downloads/([a-zA-Z0-9_-]+/)*[a-zA-Z0-9_-]+[.]pdf$'));
 END IF;
END $$;

-- Preserve each installation's existing visibility filters and RPC permissions.
DO $migration$
DECLARE definition TEXT;
BEGIN
 SELECT pg_get_functiondef('public.lc_catalog()'::regprocedure) INTO definition;
 IF strpos(definition, '''download_path''')=0 THEN
  IF definition !~ $pattern$'description'\s*,\s*o\.description$pattern$ THEN
   RAISE EXCEPTION 'Cannot identify the public catalog description field';
  END IF;
  EXECUTE regexp_replace(definition,
   $pattern$'description'\s*,\s*o\.description$pattern$,
   $replacement$'description',o.description,'download_path',o.download_path$replacement$);
 END IF;
END $migration$;
NOTIFY pgrst,'reload schema';
COMMIT;
