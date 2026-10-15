import { createClient } from 'npm:@supabase/supabase-js@2.101.1'
// @deno-types="npm:@types/nodemailer@6.4.17"
import nodemailer from 'npm:nodemailer@6.9.10'
import { buildPhysicalCardEmail } from '../_shared/latidoCardPhysicalEmail.js'

const projectUrl = Deno.env.get('SUPABASE_URL') || ''
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const cronSecret = Deno.env.get('LATIDO_CARD_EMAIL_CRON_SECRET') || ''
const username = Deno.env.get('SMTP_USERNAME') || ''
const password = Deno.env.get('SMTP_PASSWORD') || ''
const from = Deno.env.get('LATIDO_CARD_EMAIL_FROM') || Deno.env.get('SMTP_FROM') || username
const appUrl = Deno.env.get('LATIDO_APP_URL') || 'https://www.latido.ch'
const service = createClient(
  projectUrl || 'https://placeholder.supabase.co',
  serviceKey || 'placeholder',
  { auth: { persistSession: false, autoRefreshToken: false } }
)
const transport = nodemailer.createTransport({
  host: Deno.env.get('SMTP_HOSTNAME') || 'authsmtp.securemail.pro',
  port: Number(Deno.env.get('SMTP_PORT') || '465'),
  secure: (Deno.env.get('SMTP_SECURE') || 'true') === 'true',
  auth: { user: username, pass: password },
  connectionTimeout: 15000,
  socketTimeout: 20000
})
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405)
  if (!cronSecret || req.headers.get('x-latido-card-cron-secret') !== cronSecret)
    return json({ ok: false, error: 'UNAUTHORIZED' }, 401)
  if (!projectUrl || !serviceKey || !username || !password || !from)
    return json({ ok: false, error: 'EMAIL_CONFIGURATION_MISSING' }, 500)
  const { data, error } = await service.rpc('lc_claim_physical_emails', { p_limit: 20 })
  if (error) return json({ ok: false, error: 'QUEUE_UNAVAILABLE' }, 500)
  const result = { claimed: (data || []).length, sent: 0, retried: 0, acknowledgement_failed: 0 }
  for (const job of data || []) {
    let sent = false,
      failure = 'SMTP_DELIVERY_FAILED'
    try {
      await transport.sendMail({
        from,
        to: job.recipient_email,
        messageId: `<latido-card-${job.id}@latido.ch>`,
        ...buildPhysicalCardEmail(job, appUrl)
      })
      sent = true
      result.sent++
    } catch (err) {
      const code = String((err as { code?: string })?.code || '')
      if (/^[A-Z0-9_]{1,64}$/.test(code)) failure = code
      result.retried++
    }
    const acknowledgement = await service.rpc('lc_finish_physical_email', {
      p_id: job.id,
      p_lease: job.lease_id,
      p_success: sent,
      p_error: failure
    })
    if (acknowledgement.error || acknowledgement.data !== true) result.acknowledgement_failed++
  }
  return json({ ok: true, ...result })
})
