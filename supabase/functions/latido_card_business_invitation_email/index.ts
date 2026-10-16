import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.10'

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
  auth: { user: SMTP_USERNAME, pass: SMTP_PASSWORD }
})
type Invitation = { user_id: string; provider_id: string; unsubscribe_token: string }
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  })
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  )

function message(name: string, providerId: string, token?: string) {
  const url = `${APP_URL}/?crear-oferta=${encodeURIComponent(providerId)}`
  const unsubscribe = token
    ? `${SUPABASE_URL}/functions/v1/latido_card_business_invitation_email?unsubscribe=${token}`
    : ''
  const title = 'Juntos hacemos crecer los negocios hispanohablantes en Suiza'
  const lead = 'Demos a nuestra comunidad más razones para visitar nuestros negocios.'
  const description =
    'Ofrece un descuento especial a los socios de Tarjeta Latido y da a conocer tu negocio entre más hispanohablantes en Suiza.'
  const terms = 'Participar es gratis. Tú eliges el descuento, sus condiciones y su duración.'
  return {
    subject: 'Dale a la comunidad una razón más para visitar tu negocio',
    text: [
      `Hola ${name},`,
      '',
      title,
      lead,
      description,
      terms,
      '',
      `Ofrecer mi primer descuento: ${url}`,
      '',
      ...(unsubscribe ? [`No recibir más invitaciones: ${unsubscribe}`] : [])
    ].join('\n'),
    html: `<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f4f6fc;font-family:Arial,sans-serif;color:#10182d"><table role="presentation" width="100%" style="padding:24px 12px"><tr><td align="center"><table role="presentation" width="100%" style="max-width:540px;background:#fff;border-radius:24px;padding:28px"><tr><td><p style="color:#245ff3;font-weight:bold">🤝 Tarjeta Latido</p><p>Hola ${escape(name)},</p><h1 style="font-size:25px;line-height:1.3">${title}</h1><p style="line-height:1.7">${lead}</p><p style="line-height:1.7">${description}</p><p style="padding:16px;background:#f0f5ff;border-radius:12px;line-height:1.6">✨ ${terms}</p><p style="margin:28px 0"><a href="${escape(url)}" style="display:inline-block;background:#245ff3;color:#fff;text-decoration:none;padding:15px 20px;border-radius:12px;font-weight:bold">Ofrecer mi primer descuento</a></p><p style="font-size:12px;color:#64748b;line-height:1.6">Recibes esta invitación porque has publicado un negocio en Latido.${unsubscribe ? ` <a href="${escape(unsubscribe)}">No recibir más invitaciones</a>.` : ''}</p></td></tr></table></td></tr></table></body></html>`,
    ...(unsubscribe
      ? {
          headers: {
            'List-Unsubscribe': `<${unsubscribe}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
          }
        }
      : {})
  }
}

async function send(to: string, name: string, providerId: string, token?: string) {
  await new Promise<void>((resolve, reject) =>
    transport.sendMail(
      { from: SMTP_FROM, to, ...message(name, providerId, token) },
      (error: Error | null) => (error ? reject(error) : resolve())
    )
  )
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
      `<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invitaciones de Tarjeta Latido</title><body style="font-family:Arial,sans-serif;max-width:480px;margin:60px auto;padding:24px"><h1>Tarjeta Latido</h1>${req.method === 'POST' ? '<p>No recibirás más invitaciones para publicar tu primer descuento.</p>' : '<p>¿Quieres dejar de recibir estas invitaciones?</p><form method="post"><button style="padding:14px">No recibir más invitaciones</button></form>'}</body></html>`,
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
    if (body.test_email) {
      if (!SMTP_USERNAME || !SMTP_PASSWORD) throw new Error('MISSING_SMTP_CONFIGURATION')
      const { data, error } = await service
        .from('lc_business_invitation_targets')
        .select('provider_id,name')
        .limit(1)
        .maybeSingle()
      if (error) throw error
      if (!data) return json({ error: 'NO_ELIGIBLE_BUSINESSES' }, 409)
      await send(String(body.test_email), data.name, data.provider_id)
      return json({ ok: true, test_sent: true })
    }
    if (body.action === 'queue') {
      const { data, error } = await service.rpc('lc_queue_business_invitations')
      if (error) throw error
      return json({ ok: true, queued: data })
    }
    // Preview is the default. Installation and a normal function call send nothing.
    if (body.action !== 'send') {
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
      return json({ ok: true, eligible_owners: targets.count, pending: queue.count })
    }
    if (!SMTP_USERNAME || !SMTP_PASSWORD) throw new Error('MISSING_SMTP_CONFIGURATION')
    const { data, error } = await service.rpc('lc_claim_business_invitations', { p_limit: 20 })
    if (error) throw error
    const result = { sent: 0, suppressed: 0, failed: 0 }
    for (const invitation of (data || []) as Invitation[]) {
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
