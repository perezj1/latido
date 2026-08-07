-- Extra contact methods shown only in the unified partner card.
-- Each business publication keeps its own independent contact data.
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS partner_contact_options jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.providers
SET partner_contact_options = '[]'::jsonb
WHERE partner_contact_options IS NULL OR jsonb_typeof(partner_contact_options) <> 'array';

ALTER TABLE public.providers
  ALTER COLUMN partner_contact_options SET DEFAULT '[]'::jsonb,
  ALTER COLUMN partner_contact_options SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'providers_partner_contact_options_is_array'
      AND conrelid = 'public.providers'::regclass
  ) THEN
    ALTER TABLE public.providers
      ADD CONSTRAINT providers_partner_contact_options_is_array
      CHECK (jsonb_typeof(partner_contact_options) = 'array');
  END IF;
END
$$;

COMMENT ON COLUMN public.providers.partner_contact_options IS
  'Additional address, phone, email and social contact options displayed in the partner card.';
