import Stripe from 'npm:stripe@22.2.0'
import { createClient } from 'npm:@supabase/supabase-js@2.101.1'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || ''
const STRIPE_PRICE_LANDING_PAGE = Deno.env.get('STRIPE_PRICE_LANDING_PAGE')
  || Deno.env.get('STRIPE_PRICE_ALERTS')
  || ''
const APP_URL = (Deno.env.get('LATIDO_APP_URL') || 'https://www.latido.ch')
  .replace(/\/+$/, '')

const PLAN_CONFIGS = {
  featured: {
    key: 'featured',
    label: 'Negocio Destacado',
    priceId: Deno.env.get('STRIPE_FEATURED_PRICE_ID')
      || Deno.env.get('STRIPE_PRICE_FEATURED')
      || Deno.env.get('STRIPE_PRICE_ID')
      || '',
  },
  basic: {
    key: 'basic',
    label: 'Colaborador Basico',
    priceId: Deno.env.get('STRIPE_BASIC_PRICE_ID')
      || Deno.env.get('STRIPE_PRICE_BASIC')
      || '',
  },
  premium: {
    key: 'premium',
    label: 'Partner Premium',
    priceId: Deno.env.get('STRIPE_PREMIUM_PRICE_ID')
      || Deno.env.get('STRIPE_PRICE_PREMIUM')
      || '',
  },
} as const

type PlanKey = keyof typeof PLAN_CONFIGS
type PlanConfig = typeof PLAN_CONFIGS[PlanKey]

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion:'2026-05-27.dahlia',
  httpClient:Stripe.createFetchHttpClient(),
})

const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth:{
    persistSession:false,
    autoRefreshToken:false,
  },
})

const allowedOrigins = new Set([
  'https://latido.ch',
  'https://www.latido.ch',
  'https://latidoch.vercel.app',
])

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || ''
  const isLocalOrigin = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)

  return {
    'Access-Control-Allow-Origin':allowedOrigins.has(origin) || isLocalOrigin
      ? origin
      : 'https://www.latido.ch',
    'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods':'POST, OPTIONS',
    'Vary':'Origin',
  }
}

function json(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers:{
      ...corsHeaders(req),
      'Content-Type':'application/json',
    },
  })
}

async function requireUser(req: Request) {
  const authorization = req.headers.get('authorization') || ''
  const token = authorization.replace(/^Bearer\s+/i, '')
  if (!token) throw new Error('AUTH_REQUIRED')

  const { data, error } = await serviceClient.auth.getUser(token)
  if (error || !data.user) throw new Error('AUTH_REQUIRED')

  return data.user
}

function getPlanConfig(value: unknown): PlanConfig {
  const key = typeof value === 'string' && value in PLAN_CONFIGS
    ? value as PlanKey
    : 'featured'

  return PLAN_CONFIGS[key]
}

function requireStripeConfiguration(planConfig: PlanConfig, landingPageEnabled = false) {
  if (
    !SUPABASE_URL
    || !SERVICE_ROLE_KEY
    || !STRIPE_SECRET_KEY
    || !planConfig.priceId
    || (landingPageEnabled && !STRIPE_PRICE_LANDING_PAGE)
  ) {
    throw new Error('STRIPE_NOT_CONFIGURED')
  }
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message

  if (error && typeof error === 'object') {
    const message = 'message' in error && typeof error.message === 'string'
      ? error.message
      : null
    const details = 'details' in error && typeof error.details === 'string'
      ? error.details
      : null
    const hint = 'hint' in error && typeof error.hint === 'string'
      ? error.hint
      : null
    const code = 'code' in error && typeof error.code === 'string'
      ? error.code
      : null

    const parts = [message, details, hint, code].filter(Boolean)
    if (parts.length) return parts.join(' | ')

    try {
      return JSON.stringify(error)
    } catch {}
  }

  return String(error)
}

function isMissingStripeResource(error: unknown) {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && error.code === 'resource_missing'
  )
}

function isMissingRpc(error: unknown, rpcName: string) {
  const message = errorMessage(error)
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && error.code === 'PGRST202'
  ) || message.includes(rpcName)
}

function checkoutErrorCode(message: string) {
  const normalized = message.toLowerCase()

  if (normalized.includes('no such price')) return 'STRIPE_PRICE_NOT_FOUND'
  if (
    normalized.includes('invalid api key')
    || normalized.includes('api key expired')
    || normalized.includes('expired api key')
  ) {
    return 'STRIPE_KEY_INVALID'
  }
  if (
    normalized.includes('expires_at')
    || normalized.includes('at least 30 minutes')
  ) {
    return 'CHECKOUT_EXPIRATION_INVALID'
  }
  if (
    normalized.includes('payment method')
    || normalized.includes('payment_method')
  ) {
    return 'PAYMENT_METHOD_UNAVAILABLE'
  }

  return null
}

type Reservation = {
  reservation_id: string
  reservation_expires_at: string
  stripe_customer_id: string | null
  stripe_checkout_session_id: string | null
  stripe_checkout_url: string | null
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) })
  }
  if (req.method !== 'POST') {
    return json(req, { ok: false, error: 'METHOD_NOT_ALLOWED' }, 405)
  }

  let reservationId: string | null = null
  let createdCheckoutSessionId: string | null = null

  try {
    const body = await req.json().catch(() => ({}))
    const planConfig = getPlanConfig(body?.planKey)
    const landingPageEnabled = body?.landingPageEnabled === true
      || body?.landingEnabled === true
    requireStripeConfiguration(planConfig, landingPageEnabled)
    const user = await requireUser(req)
    const providerId = body?.providerId

    if (!isUuid(providerId)) {
      return json(req, { ok: false, error: 'INVALID_PROVIDER_ID' }, 400)
    }

    let reservationResponse = await serviceClient
      .rpc('reserve_business_promotion_checkout', {
        p_provider_id: providerId,
        p_user_id: user.id,
        p_plan_key: planConfig.key,
        p_price_id: planConfig.priceId,
        p_reservation_minutes: 35,
      })
      .single<Reservation>()

    if (
      reservationResponse.error
      && planConfig.key === 'featured'
      && isMissingRpc(reservationResponse.error, 'reserve_business_promotion_checkout')
    ) {
      reservationResponse = await serviceClient
        .rpc('reserve_featured_promotion_checkout', {
          p_provider_id: providerId,
          p_user_id: user.id,
          p_price_id: planConfig.priceId,
          p_reservation_minutes: 35,
        })
        .single<Reservation>()
    }

    const { data, error } = reservationResponse
    if (error) throw error
    reservationId = data.reservation_id
    let checkoutCustomerId = data.stripe_customer_id

    if (data.stripe_checkout_session_id) {
      let existingSession: Stripe.Checkout.Session | null = null

      try {
        existingSession = await stripe.checkout.sessions.retrieve(
          data.stripe_checkout_session_id,
        )
      } catch (retrieveError) {
        if (!isMissingStripeResource(retrieveError)) throw retrieveError
      }

      if (existingSession?.status === 'open') {
        const existingLandingPageEnabled =
          existingSession.metadata?.latido_landing_page_enabled === 'true'
        if (
          existingSession.locale === 'es'
          && existingSession.url
          && existingLandingPageEnabled === landingPageEnabled
        ) {
          return json(req, {
            ok: true,
            url: existingSession.url,
            expiresAt: data.reservation_expires_at,
          })
        }

        // Checkout Sessions keep their locale and line items. Replace older
        // sessions when the language or landing extra selection changed.
        await stripe.checkout.sessions.expire(existingSession.id)
      }

      if (existingSession?.status === 'complete') {
        return json(req, { ok: true, pending: true })
      }

      if (existingSession && existingSession.status !== 'open') {
        await serviceClient.rpc('release_featured_promotion_reservation', {
          p_reservation_id: reservationId,
          p_status: 'expired',
          p_error: 'Stripe Checkout session expired.',
        })

        return json(req, { ok: false, error: 'CHECKOUT_EXPIRED_RETRY' }, 409)
      }
    }

    // Stripe requires Checkout to expire at least 30 minutes in the future.
    // Leave enough margin for request and clock latency.
    const checkoutExpiresAt = Math.floor(Date.now() / 1000) + 35 * 60
    const metadata = {
      latido_reservation_id: reservationId,
      latido_provider_id: providerId,
      latido_user_id: user.id,
      latido_plan_key: planConfig.key,
      latido_landing_page_enabled: landingPageEnabled ? 'true' : 'false',
    }

    if (checkoutCustomerId) {
      try {
        await stripe.customers.update(checkoutCustomerId, {
          preferred_locales: ['es'],
        })
      } catch (updateError) {
        if (!isMissingStripeResource(updateError)) throw updateError
        checkoutCustomerId = null
      }
    }

    const planParam = encodeURIComponent(planConfig.key)
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: checkoutCustomerId || undefined,
      customer_email: checkoutCustomerId ? undefined : user.email,
      client_reference_id: reservationId,
      line_items: [
        { price: planConfig.priceId, quantity: 1 },
        ...(landingPageEnabled ? [{ price: STRIPE_PRICE_LANDING_PAGE, quantity: 1 }] : []),
      ],
      success_url:
        `${APP_URL}/negocios/${providerId}/destacar?plan=${planParam}&checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/negocios/${providerId}/destacar?plan=${planParam}&checkout=canceled`,
      expires_at: checkoutExpiresAt,
      locale: 'es',
      metadata,
      subscription_data: {
        metadata,
        description: `Latido - ${planConfig.label}${landingPageEnabled ? ' + Landing page dedicada' : ''}`,
      },
    }, {
      idempotencyKey: `latido-promotion-checkout-es-v4-${reservationId}-${landingPageEnabled ? 'landing' : 'plan'}`,
    })

    if (!session.url) throw new Error('CHECKOUT_URL_MISSING')
    createdCheckoutSessionId = session.id

    const { error: attachError } = await serviceClient
      .rpc('attach_featured_promotion_checkout', {
        p_reservation_id: reservationId,
        p_checkout_session_id: session.id,
        p_checkout_url: session.url,
        p_customer_id: typeof session.customer === 'string' ? session.customer : null,
        p_expires_at: new Date((checkoutExpiresAt + 5 * 60) * 1000).toISOString(),
      })

    if (attachError) throw attachError

    return json(req, {
      ok: true,
      url: session.url,
      expiresAt: new Date(checkoutExpiresAt * 1000).toISOString(),
    })
  } catch (error) {
    const message = errorMessage(error)

    if (createdCheckoutSessionId) {
      await stripe.checkout.sessions.expire(createdCheckoutSessionId).catch(() => {})
    }

    if (reservationId) {
      await serviceClient.rpc('release_featured_promotion_reservation', {
        p_reservation_id: reservationId,
        p_status: 'failed',
        p_error: message.slice(0, 1000),
      })
    }

    const knownErrors: Record<string, number> = {
      AUTH_REQUIRED: 401,
      PROVIDER_NOT_FOUND: 404,
      BUSINESS_NOT_VERIFIED: 409,
      PLAN_FULL: 409,
      PLAN_UNAVAILABLE: 409,
      PLAN_NOT_FOUND: 409,
      ALREADY_FEATURED: 409,
      ALREADY_PROMOTED: 409,
      SUBSCRIPTION_EXISTS: 409,
      CHECKOUT_OPEN_OTHER_PLAN: 409,
      STRIPE_NOT_CONFIGURED: 503,
    }
    const databaseErrorCode = Object.keys(knownErrors)
      .find(code => message.includes(code))
    const errorCode = databaseErrorCode || checkoutErrorCode(message)

    console.error('Could not create promotion Checkout:', message)
    return json(req, {
      ok: false,
      error: errorCode || 'CHECKOUT_CREATE_FAILED',
      detail: message.slice(0, 500),
    }, databaseErrorCode ? knownErrors[databaseErrorCode] : 200)
  }
})
