import Stripe from 'npm:stripe@22.2.0'
import { createClient } from 'npm:@supabase/supabase-js@2.101.1'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || ''
const STRIPE_PRICE_ALERTS = Deno.env.get('STRIPE_PRICE_ALERTS') || ''
const APP_URL = (Deno.env.get('LATIDO_APP_URL') || 'https://www.latido.ch').replace(/\/+$/, '')

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion:'2026-05-27.dahlia',
  httpClient:Stripe.createFetchHttpClient(),
})
const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth:{ persistSession:false, autoRefreshToken:false },
})

const allowedOrigins = new Set(['https://latido.ch', 'https://www.latido.ch', 'https://latidoch.vercel.app'])

function cors(req: Request) {
  const origin = req.headers.get('origin') || ''
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  return {
    'Access-Control-Allow-Origin':allowedOrigins.has(origin) || local ? origin : 'https://www.latido.ch',
    'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods':'POST, OPTIONS',
    Vary:'Origin',
  }
}

function json(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers:{ ...cors(req), 'Content-Type':'application/json' } })
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function message(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const values = ['message', 'details', 'hint', 'code']
      .map(key => (error as Record<string, unknown>)[key])
      .filter((value): value is string => typeof value === 'string')
    if (values.length) return values.join(' | ')
  }
  return String(error)
}

async function userFor(req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) throw new Error('AUTH_REQUIRED')
  const { data, error } = await service.auth.getUser(token)
  if (error || !data.user) throw new Error('AUTH_REQUIRED')
  return data.user
}

type Reservation = {
  reservation_id:string
  reservation_expires_at:string
  stripe_customer_id:string | null
  stripe_checkout_session_id:string | null
  stripe_checkout_url:string | null
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers:cors(req) })
  if (req.method !== 'POST') return json(req, { ok:false, error:'METHOD_NOT_ALLOWED' }, 405)
  return json(req, {
    ok:false,
    error:'ALERTS_INCLUDED_IN_PREMIUM',
    message:'Las alertas de clientes potenciales ya no se venden como complemento separado. Se activan con Partner Premium.',
  }, 410)

  let reservationId = ''
  let sessionId = ''
  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !STRIPE_SECRET_KEY || !STRIPE_PRICE_ALERTS) {
      throw new Error('STRIPE_NOT_CONFIGURED')
    }

    const body = await req.json().catch(() => ({}))
    const providerId = body?.providerId
    const recipientEmail = typeof body?.recipientEmail === 'string' ? body.recipientEmail.trim() : ''
    if (!isUuid(providerId)) return json(req, { ok:false, error:'INVALID_PROVIDER_ID' }, 400)
    if (!isEmail(recipientEmail)) return json(req, { ok:false, error:'ALERT_EMAIL_REQUIRED' }, 400)
    const user = await userFor(req)

    const { data: reservationData, error: reservationError } = await service
      .rpc('reserve_business_lead_alert_checkout', {
        p_provider_id:providerId,
        p_user_id:user.id,
        p_price_id:STRIPE_PRICE_ALERTS,
        p_reservation_minutes:35,
      })
      .single()
    const reservation = reservationData as Reservation | null
    if (reservationError || !reservation) throw reservationError || new Error('CHECKOUT_RESERVATION_FAILED')

    reservationId = reservation.reservation_id
    let customerId = reservation.stripe_customer_id || undefined

    if (reservation.stripe_checkout_session_id) {
      const existing = await stripe.checkout.sessions.retrieve(reservation.stripe_checkout_session_id).catch(() => null)
      if (existing?.status === 'open' && existing.url) {
        return json(req, { ok:true, url:existing.url, expiresAt:reservation.reservation_expires_at })
      }
      if (existing?.status === 'complete') return json(req, { ok:true, pending:true })

      await service
        .from('business_lead_alert_subscriptions')
        .update({ status:'expired', stripe_checkout_url:null, reservation_expires_at:null, updated_at:new Date().toISOString() })
        .eq('id', reservationId)
        .in('status', ['reserved', 'checkout_open', 'processing'])
      return json(req, { ok:false, error:'CHECKOUT_EXPIRED_RETRY' }, 409)
    }

    if (customerId) {
      try {
        await stripe.customers.update(customerId, { preferred_locales:['es'] })
      } catch {
        customerId = undefined
      }
    }

    const expiresAt = Math.floor(Date.now() / 1000) + 35 * 60
    const metadata = {
      latido_product:'business_lead_alert',
      latido_reservation_id:reservationId,
      latido_provider_id:providerId,
      latido_user_id:user.id,
      latido_alerts_enabled:'true',
      latido_alert_recipient_email:recipientEmail,
    }
    const session = await stripe.checkout.sessions.create({
      mode:'subscription',
      customer:customerId,
      customer_email:customerId ? undefined : user.email,
      client_reference_id:reservationId,
      line_items:[{ price:STRIPE_PRICE_ALERTS, quantity:1 }],
      success_url:`${APP_URL}/negocios/${providerId}/alertas?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:`${APP_URL}/negocios/${providerId}/alertas?checkout=canceled`,
      expires_at:expiresAt,
      locale:'es',
      metadata,
      subscription_data:{ metadata, description:'Latido - Alertas de clientes potenciales' },
    }, { idempotencyKey:`latido-lead-alert-checkout-v1-${reservationId}` })

    if (!session.url) throw new Error('CHECKOUT_URL_MISSING')
    sessionId = session.id
    const { error: attachError } = await service.rpc('attach_business_lead_alert_checkout', {
      p_reservation_id:reservationId,
      p_checkout_session_id:session.id,
      p_checkout_url:session.url,
      p_customer_id:typeof session.customer === 'string' ? session.customer : null,
      p_expires_at:new Date((expiresAt + 5 * 60) * 1000).toISOString(),
    })
    if (attachError) throw attachError

    return json(req, { ok:true, url:session.url, expiresAt:new Date(expiresAt * 1000).toISOString() })
  } catch (error) {
    const detail = message(error)
    if (sessionId) await stripe.checkout.sessions.expire(sessionId).catch(() => {})
    if (reservationId) {
      await service
        .from('business_lead_alert_subscriptions')
        .update({ status:'failed', last_error:detail.slice(0, 1000), stripe_checkout_url:null, updated_at:new Date().toISOString() })
        .eq('id', reservationId)
        .in('status', ['reserved', 'checkout_open', 'processing'])
    }
    const known:Record<string, number> = {
      AUTH_REQUIRED:401,
      PROVIDER_NOT_FOUND:404,
      BUSINESS_NOT_VERIFIED:409,
      SUBSCRIPTION_EXISTS:409,
      CHECKOUT_EXPIRED_RETRY:409,
      STRIPE_NOT_CONFIGURED:503,
    }
    const errorCode = Object.keys(known).find(code => detail.includes(code)) || 'CHECKOUT_CREATE_FAILED'
    console.error('lead_alert_checkout_failed', detail)
    return json(req, { ok:false, error:errorCode, detail:detail.slice(0, 500) }, known[errorCode] || 400)
  }
})
