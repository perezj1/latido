# Push notifications for Latido

## 1. Generate VAPID keys

```bash
npm run vapid:keys
```

Put `VITE_VAPID_PUBLIC_KEY` in `.env.local` and in Vercel production env vars.

Keep `VAPID_PRIVATE_KEY` private. Add these as Supabase Edge Function secrets:

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY="..." \
  VAPID_PRIVATE_KEY="..." \
  VAPID_SUBJECT="mailto:hola@latido.ch" \
  PUSH_WEBHOOK_SECRET="use-a-long-random-string" \
  --project-ref <PROJECT_REF>
```

## 2. Run the SQL patch

Open Supabase SQL Editor and run:

```sql
-- paste supabase/push_notifications.sql
```

## 3. Deploy the Edge Function

```bash
supabase functions deploy latido_push_notification --project-ref <PROJECT_REF>
```

The repo includes `supabase/config.toml` with JWT verification disabled for this function. The function still requires `x-latido-webhook-secret`.

## 4. Connect database webhooks

In Supabase Dashboard, create webhooks pointing to:

```text
https://<PROJECT_REF>.supabase.co/functions/v1/latido_push_notification
```

Add headers:

```text
Content-Type: application/json
x-latido-webhook-secret: <same PUSH_WEBHOOK_SECRET>
```

Create these events:

```text
public.messages: INSERT
public.listings: INSERT, UPDATE
public.jobs: INSERT, UPDATE
public.providers: INSERT, UPDATE
public.events: INSERT, UPDATE
```

If the live database still uses `public.ads`, create the same `INSERT, UPDATE` webhook for `public.ads`.

Alternative from SQL Editor:

1. Open `supabase/push_webhook_triggers.sql`.
2. Replace `PUSH_WEBHOOK_SECRET_VALUE` with the real `PUSH_WEBHOOK_SECRET`.
3. Run the whole file.

To debug trigger deliveries:

```sql
SELECT *
FROM net._http_response
ORDER BY created DESC
LIMIT 20;
```

## 5. Test

Local:

```bash
npm run dev -- --host 127.0.0.1 --port 8080
```

Log in, open `Perfil > Notificaciones push`, activate push, then send a message from another user.

Manual test from a terminal:

```bash
curl -i -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/latido_push_notification" \
  -H "Content-Type: application/json" \
  -H "x-latido-webhook-secret: <PUSH_WEBHOOK_SECRET>" \
  -d '{"table":"test","type":"INSERT","record":{"user_id":"<USER_ID>","title":"Prueba Latido","body":"Push funcionando","url":"/"}}'
```

Production works on `https://www.latido.ch/`. On iOS, web push requires the site to be installed as a PWA from Safari.
