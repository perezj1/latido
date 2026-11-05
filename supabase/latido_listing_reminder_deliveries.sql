-- Explicitly approved, one-off reminders. No automatic queue or cron.
CREATE TABLE IF NOT EXISTS public.listing_reminder_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign text NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  email text NOT NULL CHECK(email=lower(btrim(email))),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','sent','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  processing_at timestamptz,
  sent_at timestamptz,
  message_id text,
  last_error text,
  UNIQUE(campaign,email)
);
ALTER TABLE public.listing_reminder_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.listing_reminder_deliveries FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.listing_reminder_deliveries TO service_role;
NOTIFY pgrst,'reload schema';
