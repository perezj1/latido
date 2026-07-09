import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.10'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const CRON_SECRET = Deno.env.get('LEAD_ALERTS_CRON_SECRET') || ''
const SMTP_HOSTNAME = Deno.env.get('SMTP_HOSTNAME') || 'authsmtp.securemail.pro'
const SMTP_PORT = Number(Deno.env.get('SMTP_PORT') || '465')
const SMTP_SECURE = (Deno.env.get('SMTP_SECURE') || 'true').toLowerCase() === 'true'
const SMTP_USERNAME = Deno.env.get('SMTP_USERNAME') || ''
const SMTP_PASSWORD = Deno.env.get('SMTP_PASSWORD') || ''
const SMTP_FROM = Deno.env.get('SMTP_FROM') || SMTP_USERNAME
const APP_URL = (Deno.env.get('LATIDO_APP_URL') || 'https://www.latido.ch').replace(/\/+$/, '')
const MAX_BATCH = Math.min(Math.max(Number(Deno.env.get('LEAD_ALERTS_EMAIL_MAX_BATCH') || '25'), 1), 100)

const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
const transport = nodemailer.createTransport({
  host:SMTP_HOSTNAME,
  port:SMTP_PORT,
  secure:SMTP_SECURE,
  auth:{ user:SMTP_USERNAME, pass:SMTP_PASSWORD },
})

type Alert = {
  id:string
  provider_name:string
  recipient_email:string
  listing_title:string
  listing_category:string | null
  listing_city:string | null
  listing_canton:string | null
  listing_path:string
  matched_terms:string[]
  notification_status:string
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers:{ 'Content-Type':'application/json' } })
}
function escapeHtml(value:string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

function slugify(value:string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function listingUrl(alert: Alert) {
  const rawPath = alert.listing_path || ''
  if (/^https?:\/\//i.test(rawPath)) return rawPath

  const idFromPath = rawPath.match(/\/anuncios\/([0-9a-f-]{36})/i)?.[1]
  const slug = slugify(alert.listing_title || '')
  const path = idFromPath
    ? `/anuncios/${idFromPath}${slug ? `--${slug}` : ''}`
    : rawPath.startsWith('/') ? rawPath : `/${rawPath || 'tablon'}`

  return `${APP_URL}${path}`
}

function emailContent(alert: Alert) {
  const url = listingUrl(alert)
  const location = [alert.listing_city, alert.listing_canton].filter(Boolean).join(', ')
  const matches = alert.matched_terms?.join(', ') || 'servicios configurados'
  const provider = escapeHtml(alert.provider_name || 'tu empresa')
  const title = escapeHtml(alert.listing_title || 'Nuevo anuncio')
  return {
    subject:`Nuevo cliente potencial: ${alert.listing_title || 'anuncio relacionado'} · Latido`,
    text:[
      `Hola ${alert.provider_name || ''},`, '',
      'Latido ha encontrado un anuncio que busca un servicio como el tuyo.',
      `Anuncio: ${alert.listing_title}`,
      `Coincidencias: ${matches}`,
      location ? `Zona: ${location}` : '',
      `Ver anuncio: ${url}`,
    ].filter(Boolean).join('\n'),
    html:`<!doctype html><html lang="es"><body style="margin:0;background:#f7f7f5;font-family:Arial,sans-serif;color:#1f2937"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:32px"><tr><td style="font-size:24px;font-weight:700;color:#2563EB;padding-bottom:20px">Latido</td></tr><tr><td style="font-size:16px;line-height:1.6">Hola ${provider},</td></tr><tr><td style="font-size:16px;line-height:1.6;padding:12px 0">Latido ha encontrado un anuncio que busca un servicio como el tuyo.</td></tr><tr><td style="font-size:17px;font-weight:700;padding:8px 0">${title}</td></tr><tr><td style="font-size:13px;color:#475569;line-height:1.6;padding-bottom:22px">Coincidencias: ${escapeHtml(matches)}${location ? `<br>Zona: ${escapeHtml(location)}` : ''}</td></tr><tr><td><a href="${url}" style="display:inline-block;background:#2563EB;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px">Ver anuncio</a></td></tr></table></td></tr></table></body></html>`,
  }
}
async function send(alert: Alert) {
  const content = emailContent(alert)
  await new Promise<void>((resolve, reject) => transport.sendMail({ from:SMTP_FROM, to:alert.recipient_email, ...content }, error => error ? reject(error) : resolve()))
}

Deno.serve(async req => {
  if (req.method !== 'POST') return json({ ok:false, error:'METHOD_NOT_ALLOWED' }, 405)
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !SMTP_USERNAME || !SMTP_PASSWORD || !SMTP_FROM || !CRON_SECRET) return json({ ok:false, error:'MISSING_CONFIGURATION' }, 500)
  if (req.headers.get('x-latido-cron-secret') !== CRON_SECRET) return json({ ok:false, error:'UNAUTHORIZED' }, 401)
  try {
    const { data, error } = await service.rpc('claim_business_lead_alert_deliveries', { p_limit:MAX_BATCH })
    if (error) throw error
    const result = { claimed:(data || []).length, sent:0, retried:0 }
    for (const alert of (data || []) as Alert[]) {
      try {
        if (alert.notification_status !== 'sent') {
          const { error: notificationError } = await service
            .from('business_lead_alerts')
            .update({ notification_status:'sent', notification_sent_at:new Date().toISOString(), updated_at:new Date().toISOString() })
            .eq('id', alert.id)
            .eq('delivery_status', 'processing')
          if (notificationError) throw notificationError
        }
        await send(alert)
        const { error: completionError } = await service.rpc('complete_business_lead_alert_delivery', { p_alert_id:alert.id })
        if (completionError) throw completionError
        result.sent += 1
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error)
        console.error('lead_alert_delivery_failed', { alertId:alert.id, error:text })
        await service.rpc('retry_business_lead_alert_delivery', { p_alert_id:alert.id, p_error:text })
        result.retried += 1
      }
    }
    return json({ ok:true, ...result })
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error)
    console.error('lead_alert_email_batch_failed', text)
    return json({ ok:false, error:text }, 500)
  }
})
