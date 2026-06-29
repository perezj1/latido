import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.10'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const CRON_SECRET = Deno.env.get('WEEKLY_DIGEST_CRON_SECRET') || Deno.env.get('EMAIL_CRON_SECRET') || ''
const SMTP_HOSTNAME = Deno.env.get('SMTP_HOSTNAME') || 'authsmtp.securemail.pro'
const SMTP_PORT = Number(Deno.env.get('SMTP_PORT') || '465')
const SMTP_SECURE = (Deno.env.get('SMTP_SECURE') || 'true').toLowerCase() === 'true'
const SMTP_USERNAME = Deno.env.get('SMTP_USERNAME') || ''
const SMTP_PASSWORD = Deno.env.get('SMTP_PASSWORD') || ''
const SMTP_FROM = Deno.env.get('SMTP_FROM') || SMTP_USERNAME
const APP_URL = (Deno.env.get('LATIDO_APP_URL') || 'https://www.latido.ch').replace(/\/+$/, '')
const MAX_BATCH = Math.min(
  Math.max(Number(Deno.env.get('WEEKLY_DIGEST_MAX_BATCH') || Deno.env.get('EMAIL_MAX_BATCH') || '25'), 1),
  100,
)

type Recipient = {
  log_id:string
  user_id:string
  email:string
  display_name:string | null
  eligible_date:string
}

type ActivityItem = {
  emoji:string
  label:string
  href:string
  count:number
}

type WeeklyActivity = {
  since:string
  total:number
  items:ActivityItem[]
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

function escapeHtml(value:string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function singularPlural(count:number, singular:string, plural:string) {
  return count === 1 ? singular : plural
}

async function countRows(table:string, setup:(query:any) => any) {
  const query = setup(service.from(table).select('id', { count:'exact', head:true }))
  const { count, error } = await query
  if (error) throw error
  return count || 0
}

async function getWeeklyActivity():Promise<WeeklyActivity> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString()

  const [
    housingCount,
    jobCount,
    secondHandCount,
    serviceOfferCount,
    businessCount,
    seekingHelpCount,
    eventCount,
    communityCount,
  ] = await Promise.all([
    countRows('listings', query => query
      .or('active.is.null,active.eq.true')
      .gte('created_at', since)
      .eq('cat', 'vivienda')),

    countRows('jobs', query => query
      .or('active.is.null,active.eq.true')
      .gte('created_at', since)),

    countRows('listings', query => query
      .or('active.is.null,active.eq.true')
      .gte('created_at', since)
      .eq('cat', 'venta')
      .in('type', ['vende', 'regala'])),

    countRows('listings', query => query
      .or('active.is.null,active.eq.true')
      .gte('created_at', since)
      .eq('cat', 'servicios')
      .eq('type', 'ofrece')),

    countRows('providers', query => query
      .eq('active', true)
      .gte('created_at', since)),

    countRows('listings', query => query
      .or('active.is.null,active.eq.true')
      .gte('created_at', since)
      .eq('type', 'busca')
      .in('cat', ['servicios', 'cuidados', 'documentos'])),

    countRows('events', query => query
      .eq('active', true)
      .gte('created_at', since)),

    countRows('communities', query => query
      .or('active.is.null,active.eq.true')
      .gte('created_at', since)),
  ])

  const serviceAndBusinessCount = serviceOfferCount + businessCount
  const items:ActivityItem[] = []

  if (housingCount > 0) {
    items.push({
      emoji:'🏠',
      count:housingCount,
      label:`${housingCount} ${singularPlural(housingCount, 'nueva publicación de vivienda', 'nuevas publicaciones de vivienda')}`,
      href:`${APP_URL}/tablon?cat=vivienda`,
    })
  }

  if (jobCount > 0) {
    items.push({
      emoji:'💼',
      count:jobCount,
      label:`${jobCount} ${singularPlural(jobCount, 'nueva oportunidad de empleo', 'nuevas oportunidades de empleo')}`,
      href:`${APP_URL}/tablon?cat=empleo`,
    })
  }

  if (secondHandCount > 0) {
    items.push({
      emoji:'🛋️',
      count:secondHandCount,
      label:`${secondHandCount} ${singularPlural(secondHandCount, 'artículo de segunda mano', 'artículos de segunda mano')}`,
      href:`${APP_URL}/tablon?cat=venta`,
    })
  }

  if (serviceAndBusinessCount > 0) {
    items.push({
      emoji:'🧑‍🔧',
      count:serviceAndBusinessCount,
      label:`${serviceAndBusinessCount} ${singularPlural(serviceAndBusinessCount, 'servicio o negocio publicado', 'servicios o negocios publicados')}`,
      href:`${APP_URL}/tablon?cat=servicios`,
    })
  }

  if (seekingHelpCount > 0) {
    items.push({
      emoji:'📢',
      count:seekingHelpCount,
      label:`${seekingHelpCount} ${singularPlural(seekingHelpCount, 'persona buscando ayuda, recomendaciones o información', 'personas buscando ayuda, recomendaciones o información')}`,
      href:`${APP_URL}/tablon?type=busca`,
    })
  }

  if (eventCount > 0) {
    items.push({
      emoji:'🎉',
      count:eventCount,
      label:`${eventCount} ${singularPlural(eventCount, 'nuevo evento', 'nuevos eventos')}`,
      href:`${APP_URL}/comunidades?view=eventos`,
    })
  }

  if (communityCount > 0) {
    items.push({
      emoji:'👥',
      count:communityCount,
      label:`${communityCount} ${singularPlural(communityCount, 'nuevo grupo de comunidad', 'nuevos grupos de comunidad')}`,
      href:`${APP_URL}/comunidades`,
    })
  }

  return {
    since,
    total:items.reduce((sum, item) => sum + item.count, 0),
    items,
  }
}

function buildWeeklyDigestEmail(name:string | null | undefined, activity:WeeklyActivity) {
  const safeName = escapeHtml(name || '')
  const greeting = safeName ? `Hola ${safeName},` : 'Hola,'
  const appUrl = `${APP_URL}/tablon`
  const totalText = activity.total === 1 ? '1 novedad' : `${activity.total} novedades`

  const text = [
    safeName ? `Hola ${name},` : 'Hola,',
    '',
    `Esta semana en Latido se han publicado ${totalText} para la comunidad en Suiza.`,
    '',
    'Esto es lo nuevo:',
    '',
    ...activity.items.map(item => `${item.emoji} ${item.label}`),
    '',
    'Si hace tiempo que no entras, este es un buen momento para ver qué hay nuevo.',
    '',
    `Entra aquí: ${APP_URL}`,
    '',
    'Y recuerda: también puedes publicar gratis si buscas algo, vendes algo, ofreces un servicio o quieres dar a conocer tu negocio.',
    '',
    'Latido crece contigo.',
  ].join('\n')

  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Esto ha pasado esta semana en Latido</title>
  </head>
  <body style="margin:0;background:#F3F7FF;font-family:Arial,Helvetica,sans-serif;color:#0F172A">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F3F7FF;padding:28px 14px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #DDE7F5;border-radius:22px;overflow:hidden">
            <tr>
              <td style="padding:28px 28px 10px">
                <div style="font-size:14px;font-weight:800;letter-spacing:.08em;color:#2563EB;text-transform:uppercase">Latido.ch</div>
                <h1 style="font-size:26px;line-height:1.12;margin:12px 0 0;color:#0F172A;font-weight:900">
                  Esto ha pasado esta semana en Latido
                </h1>
              </td>
            </tr>

            <tr>
              <td style="padding:8px 28px 0;font-size:15px;line-height:1.65;color:#334155">
                <p style="margin:0 0 14px">${greeting}</p>
                <p style="margin:0 0 18px">
                  Esta semana en Latido se han publicado <strong>${escapeHtml(totalText)}</strong> para la comunidad en Suiza.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:0 28px 8px">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0 9px">
                  ${activity.items.map(item => `
                    <tr>
                      <td style="width:42px;background:#F8FAFC;border:1px solid #E2E8F0;border-right:none;border-radius:14px 0 0 14px;padding:11px 0;text-align:center;font-size:20px">${item.emoji}</td>
                      <td style="background:#F8FAFC;border:1px solid #E2E8F0;border-left:none;border-radius:0 14px 14px 0;padding:11px 13px;font-size:14px;font-weight:700;color:#1E293B">
                        <a href="${item.href}" style="color:#1E293B;text-decoration:none">${escapeHtml(item.label)}</a>
                      </td>
                    </tr>
                  `).join('')}
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:10px 28px 0;font-size:15px;line-height:1.65;color:#334155">
                <p style="margin:0 0 22px">
                  Si hace tiempo que no entras, este es un buen momento para ver qué hay nuevo.
                </p>
                <a href="${appUrl}" style="display:inline-block;background:#2563EB;color:#ffffff;text-decoration:none;font-weight:800;font-size:15px;padding:13px 20px;border-radius:14px">
                  Entrar en Latido →
                </a>
              </td>
            </tr>

            <tr>
              <td style="padding:26px 28px 30px;font-size:13px;line-height:1.65;color:#64748B">
                <p style="margin:0 0 12px">
                  También puedes publicar gratis si buscas algo, vendes algo, ofreces un servicio o quieres dar a conocer tu negocio.
                </p>
                <p style="margin:0;font-weight:800;color:#0F172A">Latido crece contigo.</p>
              </td>
            </tr>
          </table>

          <p style="max-width:520px;margin:14px auto 0;font-size:11px;line-height:1.55;color:#94A3B8">
            Recibes este email porque tienes una cuenta en Latido y hace varios días que no entras. Puedes ignorarlo si no te interesa esta semana.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`

  return {
    subject:'Esto ha pasado esta semana en Latido',
    text,
    html,
  }
}

async function sendMail(to:string, name:string | null | undefined, activity:WeeklyActivity) {
  const content = buildWeeklyDigestEmail(name, activity)

  await new Promise<void>((resolve, reject) => {
    transport.sendMail({
      from:SMTP_FROM,
      to,
      subject:content.subject,
      text:content.text,
      html:content.html,
    }, error => error ? reject(error) : resolve())
  })
}

Deno.serve(async req => {
  if (req.method !== 'POST') {
    return json({ ok:false, error:'METHOD_NOT_ALLOWED' }, 405)
  }

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

    const activity = await getWeeklyActivity()

    if (activity.items.length === 0) {
      return json({
        ok:true,
        skipped:'no_weekly_activity',
        claimed:0,
        sent:0,
        failed:0,
      })
    }

    if (body.test_email) {
      await sendMail(body.test_email, body.test_name || 'Prueba Latido', activity)

      return json({
        ok:true,
        test:true,
        activity:activity.items.map(item => ({
          label:item.label,
          count:item.count,
        })),
      })
    }

    const { data, error } = await service
      .rpc('claim_weekly_digest_recipients', { p_limit:MAX_BATCH })

    if (error) throw error

    const recipients = (data || []) as Recipient[]
    const result = {
      claimed:recipients.length,
      sent:0,
      failed:0,
    }

    for (const recipient of recipients) {
      try {
        await sendMail(recipient.email, recipient.display_name, activity)

        const { error: completionError } = await service.rpc('complete_weekly_digest_delivery', {
          p_log_id:recipient.log_id,
        })

        if (completionError) throw completionError

        result.sent += 1
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error)

        console.error('weekly_digest_delivery_failed', {
          logId:recipient.log_id,
          userId:recipient.user_id,
          error:text,
        })

        await service.rpc('fail_weekly_digest_delivery', {
          p_log_id:recipient.log_id,
          p_error:text,
        })

        result.failed += 1
      }
    }

    return json({ ok:true, ...result })
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error)
    console.error('weekly_digest_batch_failed', text)

    return json({ ok:false, error:text }, 500)
  }
})
