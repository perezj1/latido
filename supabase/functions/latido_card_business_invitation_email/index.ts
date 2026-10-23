import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.10'
import { invitationMessage } from './email-message.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const CRON_SECRET = Deno.env.get('LATIDO_CARD_INVITATION_SECRET') || ''
const SMTP_USERNAME = Deno.env.get('SMTP_USERNAME') || ''
const SMTP_PASSWORD = Deno.env.get('SMTP_PASSWORD') || ''
const SMTP_FROM = Deno.env.get('SMTP_FROM') || SMTP_USERNAME
const APP_URL = (Deno.env.get('LATIDO_APP_URL') || 'https://www.latido.ch').replace(/\/+$/, '')
const service = createClient(SUPABASE_URL, SERVICE_KEY)
const transport = nodemailer.createTransport({
  host: Deno.env.get('SMTP_HOSTNAME') || 'authsmtp.securemail.pro',
  port: Number(Deno.env.get('SMTP_PORT') || '465'),
  secure: (Deno.env.get('SMTP_SECURE') || 'true') === 'true',
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
  auth: { user: SMTP_USERNAME, pass: SMTP_PASSWORD }
})
type Invitation = { user_id: string; provider_id: string; unsubscribe_token: string }
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  })
// Fail closed unless the operator explicitly enables the real campaign via a secret.
const INVITATION_TEST_MODE = Deno.env.get('LATIDO_CARD_INVITATION_TEST_MODE') !== 'false'
const TEST_RECIPIENTS = ['jose13hue@gmail.com', 'play4slim1.2@gmail.com'] as const
const normalizeEmail = (email: string) => email.trim().toLowerCase()

async function send(to: string, name: string, providerId: string | null, token?: string, test = false) {
  const recipient = normalizeEmail(to)
  if ((INVITATION_TEST_MODE || test) && !TEST_RECIPIENTS.some(email => email === recipient))
    throw new Error('TEST_RECIPIENT_NOT_ALLOWED')
  const unsubscribe = token
    ? SUPABASE_URL + '/functions/v1/latido_card_business_invitation_email?unsubscribe=' + encodeURIComponent(token)
    : ''
  const { url, ...content } = invitationMessage({ appUrl: APP_URL, providerId, name, unsubscribe, test: INVITATION_TEST_MODE || test })
  const result = await new Promise<{ messageId: string }>((resolve, reject) =>
    transport.sendMail({ from: SMTP_FROM, to: recipient, ...content },
      (error: Error | null, info: { accepted?: string[]; messageId?: string }) => {
        if (error) return reject(error)
        if (!info?.accepted?.some(email => normalizeEmail(email) === recipient))
          return reject(new Error('SMTP_RECIPIENT_NOT_ACCEPTED'))
        resolve({ messageId: info.messageId || '' })
      })
  )
  return { url, ...result }
}

async function sendTestRecipient(email: string) {
  const { data: profile, error: profileError } = await service.from('profiles')
    .select('id,name').ilike('email', email).maybeSingle()
  if (profileError) throw profileError
  let providerId: string | null = null
  if (profile) {
    const { data: provider, error } = await service.from('providers')
      .select('id').eq('user_id', profile.id).eq('active', true).is('deleted_at', null)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (error) throw error
    providerId = provider?.id || null
  }
  const delivery = await send(email, profile?.name || '', providerId, undefined, true)
  return { email, status: 'sent', provider_id: providerId, ...delivery }
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const token = url.searchParams.get('unsubscribe')
  // GET only displays confirmation: email scanners cannot unsubscribe an owner.
  if (token && /^[0-9a-f-]{36}$/i.test(token) && ['GET', 'POST'].includes(req.method)) {
    if (req.method === 'POST') {
      const { error } = await service
        .from('latido_card_business_invitations')
        .update({ opted_out_at: new Date().toISOString(), status: 'suppressed' })
        .eq('unsubscribe_token', token)
      if (error) return json({ ok: false }, 500)
    }
    return new Response(
      `<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invitaciones de Latido Club</title><body style="font-family:Arial,sans-serif;max-width:480px;margin:60px auto;padding:24px"><h1>Latido Club</h1>${req.method === 'POST' ? '<p>No recibirás más invitaciones para publicar tu primer descuento.</p>' : '<p>¿Quieres dejar de recibir estas invitaciones?</p><form method="post"><button style="padding:14px">No recibir más invitaciones</button></form>'}</body></html>`,
      {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'Referrer-Policy': 'no-referrer'
        }
      }
    )
  }
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)
  if (!CRON_SECRET || req.headers.get('x-latido-cron-secret') !== CRON_SECRET)
    return json({ error: 'UNAUTHORIZED' }, 401)
  try {
    const body = await req.json().catch(() => ({}))
    if (INVITATION_TEST_MODE || body.test_email || body.action === 'test') {
      if (['queue', 'run'].includes(body.action)) return json({ ok: false, error: 'TEST_MODE_ONLY' }, 403)
      if (body.test_email && (typeof body.test_email !== 'string' || !TEST_RECIPIENTS.some(email => email === normalizeEmail(body.test_email))))
        return json({ ok: false, error: 'TEST_RECIPIENT_NOT_ALLOWED' }, 403)
      if (!body.test_email && !['send', 'test'].includes(body.action))
        return json({ ok: true, test_mode: true, recipients: TEST_RECIPIENTS, requires_action: 'send' })
      if (!SMTP_USERNAME || !SMTP_PASSWORD) throw new Error('MISSING_SMTP_CONFIGURATION')
      const recipients = body.test_email ? [normalizeEmail(body.test_email)] : [...TEST_RECIPIENTS]
      const deliveries = []
      for (const email of recipients) {
        try { deliveries.push(await sendTestRecipient(email)) }
        catch { deliveries.push({ email, status: 'failed', error: 'delivery_requires_manual_review' }) }
      }
      return json({ ok: deliveries.every(delivery => delivery.status === 'sent'), test_mode: true,
        sent: deliveries.filter(delivery => delivery.status === 'sent').length,
        failed: deliveries.filter(delivery => delivery.status === 'failed').length, deliveries })
    }
    if (['queue', 'run'].includes(body.action)) {
      const { data, error } = await service.rpc('lc_queue_business_invitations')
      if (error) throw error
      if (body.action === 'queue') return json({ ok: true, queued: data })
    }
    // Preview is the default. Installation and a normal function call send nothing.
    if (!['send', 'run'].includes(body.action)) {
      const [targets, queue] = await Promise.all([
        service
          .from('lc_business_invitation_targets')
          .select('provider_id', { count: 'exact', head: true }),
        service
          .from('latido_card_business_invitations')
          .select('user_id', { count: 'exact', head: true })
          .eq('status', 'pending')
      ])
      if (targets.error || queue.error) throw targets.error || queue.error
      return json({ ok: true, test_mode: false, reminder_days: 20, eligible_owners: targets.count, pending: queue.count })
    }
    if (!SMTP_USERNAME || !SMTP_PASSWORD) throw new Error('MISSING_SMTP_CONFIGURATION')
    const result = { sent: 0, suppressed: 0, failed: 0 }
    const startedAt = Date.now()
    // Claim just before sending; a slow SMTP server must not strand the rest of a batch.
    for (let processed = 0; processed < 20 && Date.now() - startedAt < 90000; processed++) {
      const { data, error } = await service.rpc('lc_claim_business_invitations', { p_limit: 1 })
      if (error) throw error
      const invitation = (data as Invitation[] | null)?.[0]
      if (!invitation) break
      try {
        const [target, preference, auth, current] = await Promise.all([
          service
            .from('lc_business_invitation_targets')
            .select('provider_id,name')
            .eq('user_id', invitation.user_id)
            .eq('provider_id', invitation.provider_id)
            .maybeSingle(),
          service.rpc('lc_invitation_email_enabled', { p_user: invitation.user_id }),
          service.auth.admin.getUserById(invitation.user_id),
          service
            .from('latido_card_business_invitations')
            .select('status')
            .eq('user_id', invitation.user_id)
            .single()
        ])
        if (target.error || preference.error || auth.error || current.error)
          throw target.error || preference.error || auth.error || current.error
        if (
          !target.data ||
          !preference.data ||
          !auth.data.user?.email_confirmed_at ||
          !auth.data.user.email ||
          current.data.status !== 'processing'
        ) {
          const { error } = await service
            .from('latido_card_business_invitations')
            .update({ status: 'suppressed', last_error: 'no_longer_eligible_or_unconfirmed_email' })
            .eq('user_id', invitation.user_id)
            .eq('status', 'processing')
          if (error) throw error
          result.suppressed++
          continue
        }
        await send(
          auth.data.user.email,
          target.data.name,
          invitation.provider_id,
          invitation.unsubscribe_token
        )
        const { error } = await service
          .from('latido_card_business_invitations')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('user_id', invitation.user_id)
          .eq('status', 'processing')
        if (error) throw error
        result.sent++
      } catch {
        // SMTP can accept a message before the connection fails. Never retry automatically.
        await service
          .from('latido_card_business_invitations')
          .update({ status: 'failed', last_error: 'delivery_requires_manual_review' })
          .eq('user_id', invitation.user_id)
          .eq('status', 'processing')
        result.failed++
      }
    }
    return json({ ok: true, ...result })
  } catch {
    return json({ ok: false, error: 'INVITATION_BATCH_FAILED' }, 500)
  }
})
