import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.10'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const CRON_SECRET = Deno.env.get('SAVED_SEARCH_EMAIL_CRON_SECRET')
  || Deno.env.get('EMAIL_CRON_SECRET')
  || Deno.env.get('WEEKLY_DIGEST_CRON_SECRET')
  || ''
const SMTP_HOSTNAME = Deno.env.get('SMTP_HOSTNAME') || 'authsmtp.securemail.pro'
const SMTP_PORT = Number(Deno.env.get('SMTP_PORT') || '465')
const SMTP_SECURE = (Deno.env.get('SMTP_SECURE') || 'true').toLowerCase() === 'true'
const SMTP_USERNAME = Deno.env.get('SMTP_USERNAME') || ''
const SMTP_PASSWORD = Deno.env.get('SMTP_PASSWORD') || ''
const SMTP_FROM = Deno.env.get('SMTP_FROM') || SMTP_USERNAME
const APP_URL = (Deno.env.get('LATIDO_APP_URL') || 'https://www.latido.ch').replace(/\/+$/, '')
const MAX_BATCH = Math.min(
  Math.max(Number(Deno.env.get('SAVED_SEARCH_EMAIL_MAX_BATCH') || '25'), 1),
  100,
)

type EmailMatch = {
  id:string
  title:string
  location:string | null
  path:string
  matched_at:string
}

type EmailDelivery = {
  saved_search_id:string
  user_id:string
  search_name:string
  result_path:string
  match_ids:string[]
  match_count:number
  results:EmailMatch[]
}

const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth:{ persistSession:false, autoRefreshToken:false },
})

const transport = nodemailer.createTransport({
  host:SMTP_HOSTNAME,
  port:SMTP_PORT,
  secure:SMTP_SECURE,
  auth:{ user:SMTP_USERNAME, pass:SMTP_PASSWORD },
})

function json(body:Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers:{ 'Content-Type':'application/json' },
  })
}

function escapeHtml(value:unknown) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function appendParam(path:string, key:string, value:string) {
  if (!value) return path
  return `${path}${path.includes('?') ? '&' : '?'}${encodeURIComponent(key)}=${encodeURIComponent(value)}`
}

function absoluteUrl(path:string, delivery:EmailDelivery, matchId = '') {
  const internalPath = path.startsWith('/') ? path : `/${path}`
  const withSearch = appendParam(internalPath, 'savedSearch', delivery.saved_search_id)
  const withMatch = matchId ? appendParam(withSearch, 'savedMatch', matchId) : withSearch
  return `${APP_URL}${appendParam(withMatch, 'source', 'email')}`
}

function buildEmail(name:string, delivery:EmailDelivery) {
  const results = Array.isArray(delivery.results) ? delivery.results : []
  const visibleResults = results.slice(0, 5)
  const count = Number(delivery.match_count || results.length)
  const greeting = name ? `Hola ${name},` : 'Hola,'
  const safeGreeting = escapeHtml(greeting)
  const safeSearchName = escapeHtml(delivery.search_name)
  const subject = count === 1
    ? `Nuevo resultado para ${delivery.search_name} · Latido`
    : `${count} nuevos resultados para ${delivery.search_name} · Latido`
  const mainUrl = count === 1 && visibleResults[0]
    ? absoluteUrl(visibleResults[0].path, delivery, visibleResults[0].id)
    : absoluteUrl(delivery.result_path, delivery)
  const manageUrl = `${APP_URL}/perfil?notificaciones=1`

  const text = [
    greeting,
    '',
    count === 1
      ? `Ha aparecido un nuevo resultado para tu alerta "${delivery.search_name}".`
      : `Han aparecido ${count} nuevos resultados para tu alerta "${delivery.search_name}".`,
    '',
    ...visibleResults.flatMap(result => [
      `${result.title}${result.location ? ` · ${result.location}` : ''}`,
      absoluteUrl(result.path, delivery, result.id),
      '',
    ]),
    count > visibleResults.length ? `Y ${count - visibleResults.length} resultados más.` : '',
    `Ver novedades: ${mainUrl}`,
    '',
    `Puedes pausar o eliminar esta alerta desde ${manageUrl}`,
  ].filter(Boolean).join('\n')

  const cards = visibleResults.map(result => {
    const url = absoluteUrl(result.path, delivery, result.id)
    return `
      <tr>
        <td style="padding:0 0 9px">
          <a href="${url}" style="display:block;text-decoration:none;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:14px;padding:13px 15px">
            <span style="display:block;font-size:14px;font-weight:800;line-height:1.4;color:#0F172A">${escapeHtml(result.title)}</span>
            ${result.location ? `<span style="display:block;margin-top:3px;font-size:12px;line-height:1.4;color:#64748B">📍 ${escapeHtml(result.location)}</span>` : ''}
          </a>
        </td>
      </tr>
    `
  }).join('')

  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;background:#F3F7FF;font-family:Arial,Helvetica,sans-serif;color:#0F172A">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F3F7FF;padding:28px 14px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#FFFFFF;border:1px solid #DDE7F5;border-radius:22px;overflow:hidden">
            <tr>
              <td style="padding:28px 28px 10px">
                <div style="font-size:14px;font-weight:800;letter-spacing:.08em;color:#2563EB;text-transform:uppercase">Latido.ch</div>
                <h1 style="font-size:24px;line-height:1.2;margin:12px 0 0;color:#0F172A;font-weight:900">
                  ${count === 1 ? 'Hay una novedad para ti' : `Hay ${count} novedades para ti`}
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 16px;font-size:15px;line-height:1.65;color:#334155">
                <p style="margin:0 0 10px">${safeGreeting}</p>
                <p style="margin:0">
                  Encontramos ${count === 1 ? 'un resultado nuevo' : `${count} resultados nuevos`} para tu alerta
                  <strong>«${safeSearchName}»</strong>.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 8px">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  ${cards}
                </table>
                ${count > visibleResults.length ? `
                  <p style="margin:4px 0 10px;font-size:12px;color:#64748B">
                    Y ${count - visibleResults.length} resultados más.
                  </p>
                ` : ''}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 28px">
                <a href="${mainUrl}" style="display:inline-block;background:#2563EB;color:#FFFFFF;text-decoration:none;font-weight:800;font-size:14px;padding:13px 20px;border-radius:14px">
                  Ver ${count === 1 ? 'resultado' : 'novedades'} →
                </a>
              </td>
            </tr>
          </table>
          <p style="max-width:520px;margin:14px auto 0;font-size:11px;line-height:1.55;color:#94A3B8">
            Recibes este correo porque guardaste esta búsqueda en Latido.
            <a href="${manageUrl}" style="color:#64748B">Pausar o eliminar la alerta</a>.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`

  return { subject, text, html }
}

async function sendMail(to:string, name:string, delivery:EmailDelivery) {
  const content = buildEmail(name, delivery)
  await new Promise<void>((resolve, reject) => {
    transport.sendMail({
      from:SMTP_FROM,
      to,
      subject:content.subject,
      text:content.text,
      html:content.html,
    }, (error:Error | null) => error ? reject(error) : resolve())
  })
}

async function getRecipient(delivery:EmailDelivery) {
  const [authResponse, profileResponse] = await Promise.all([
    service.auth.admin.getUserById(delivery.user_id),
    service
      .from('profiles')
      .select('name,email')
      .eq('id', delivery.user_id)
      .maybeSingle(),
  ])

  if (profileResponse.error) throw profileResponse.error
  if (authResponse.error) {
    console.warn('saved_search_auth_lookup_failed', {
      userId:delivery.user_id,
      error:authResponse.error.message,
    })
  }

  const authUser = authResponse.data?.user
  return {
    email:authUser?.email || profileResponse.data?.email || '',
    name:profileResponse.data?.name || authUser?.user_metadata?.name || 'Usuario',
  }
}

async function suppressDelivery(delivery:EmailDelivery, reason:string) {
  const { error } = await service
    .from('saved_search_matches')
    .update({
      email_status:'suppressed',
      email_processing_at:null,
      email_error:reason.slice(0, 1000),
    })
    .eq('saved_search_id', delivery.saved_search_id)
    .in('id', delivery.match_ids)
    .eq('email_status', 'processing')

  if (error) throw error
}

Deno.serve(async req => {
  if (req.method !== 'POST') return json({ ok:false, error:'METHOD_NOT_ALLOWED' }, 405)
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !SMTP_USERNAME || !SMTP_PASSWORD || !SMTP_FROM || !CRON_SECRET) {
    return json({ ok:false, error:'MISSING_CONFIGURATION' }, 500)
  }
  if (req.headers.get('x-latido-cron-secret') !== CRON_SECRET) {
    return json({ ok:false, error:'UNAUTHORIZED' }, 401)
  }

  try {
    const body = await req.json().catch(() => ({})) as {
      test_email?:string
      test_name?:string
    }

    if (body.test_email) {
      const sample:EmailDelivery = {
        saved_search_id:crypto.randomUUID(),
        user_id:crypto.randomUUID(),
        search_name:'Empleo: limpieza · LU',
        result_path:'/tablon?cat=empleo&canton=LU&q=limpieza',
        match_ids:[crypto.randomUUID()],
        match_count:1,
        results:[{
          id:crypto.randomUUID(),
          title:'Personal de limpieza en Lucerna',
          location:'Luzern, LU',
          path:'/tablon?cat=empleo&openJob=prueba',
          matched_at:new Date().toISOString(),
        }],
      }
      await sendMail(body.test_email, body.test_name || 'Prueba Latido', sample)
      return json({ ok:true, test:true })
    }

    const { data, error } = await service
      .rpc('claim_saved_search_email_deliveries', { p_limit:MAX_BATCH })

    if (error) throw error
    const deliveries = (data || []) as EmailDelivery[]
    const result = {
      claimed:deliveries.length,
      matches:deliveries.reduce((sum, delivery) => sum + Number(delivery.match_count || 0), 0),
      sent:0,
      suppressed:0,
      retried:0,
    }

    for (const delivery of deliveries) {
      try {
        const recipient = await getRecipient(delivery)
        if (!recipient.email) {
          await suppressDelivery(delivery, 'missing_email')
          result.suppressed += 1
          continue
        }

        await sendMail(recipient.email, recipient.name, delivery)
        const { error: completionError } = await service.rpc(
          'complete_saved_search_email_delivery',
          {
            p_saved_search_id:delivery.saved_search_id,
            p_match_ids:delivery.match_ids,
          },
        )
        if (completionError) throw completionError
        result.sent += 1
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('saved_search_email_delivery_failed', {
          savedSearchId:delivery.saved_search_id,
          userId:delivery.user_id,
          error:message,
        })
        await service.rpc('retry_saved_search_email_delivery', {
          p_saved_search_id:delivery.saved_search_id,
          p_match_ids:delivery.match_ids,
          p_error:message,
        })
        result.retried += 1
      }
    }

    console.log('saved_search_email_batch', result)
    return json({ ok:true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('saved_search_email_batch_failed', message)
    return json({ ok:false, error:message }, 500)
  }
})
