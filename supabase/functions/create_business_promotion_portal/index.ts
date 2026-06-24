import Stripe from 'npm:stripe@22.2.0'
import { createClient } from 'npm:@supabase/supabase-js@2.101.1'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || ''
const APP_URL = (Deno.env.get('LATIDO_APP_URL') || 'https://www.latido.ch')
  .replace(/\/+$/, '')

const PLAN_CONFIGS = {
  featured: {
    key: 'featured',
    priceId: Deno.env.get('STRIPE_FEATURED_PRICE_ID')
      || Deno.env.get('STRIPE_PRICE_FEATURED')
      || Deno.env.get('STRIPE_PRICE_ID')
      || '',
  },
  basic: {
    key: 'basic',
    priceId: Deno.env.get('STRIPE_BASIC_PRICE_ID')
      || Deno.env.get('STRIPE_PRICE_BASIC')
      || '',
  },
  premium: {
    key: 'premium',
    priceId: Deno.env.get('STRIPE_PREMIUM_PRICE_ID')
      || Deno.env.get('STRIPE_PRICE_PREMIUM')
      || '',
  },
} as const

type PlanKey = keyof typeof PLAN_CONFIGS

const PRICE_TO_PLAN = new Map(
  Object.values(PLAN_CONFIGS)
    .filter(plan => plan.priceId)
    .map(plan => [plan.priceId, plan.key]),
)

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

function requireStripeConfiguration() {
  if (
    !SUPABASE_URL
    || !SERVICE_ROLE_KEY
    || !STRIPE_SECRET_KEY
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

function getStripeId(value: unknown) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' ? id : null
  }
  return null
}

function getPlanKey(value: unknown): PlanKey {
  return typeof value === 'string' && value in PLAN_CONFIGS
    ? value as PlanKey
    : 'featured'
}

function getSubscriptionPeriod(subscription: Stripe.Subscription) {
  const item = subscription.items?.data?.find(subscriptionItem =>
    PRICE_TO_PLAN.has(getStripeId(subscriptionItem.price) || '')
  ) || subscription.items?.data?.[0]

  const start = item?.current_period_start
  const end = item?.current_period_end || item?.billed_until

  return {
    start:typeof start === 'number' ? new Date(start * 1000).toISOString() : null,
    end:typeof end === 'number' ? new Date(end * 1000).toISOString() : null,
  }
}

function hasScheduledCancellation(subscription: Stripe.Subscription) {
  return subscription.cancel_at_period_end
    || typeof subscription.cancel_at === 'number'
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

  try {
    requireStripeConfiguration()
    const user = await requireUser(req)
    const body = await req.json().catch(() => ({}))
    const providerId = body?.providerId
    const syncOnly = body?.syncOnly === true
    const returnPlanKey = getPlanKey(body?.planKey)

    if (!isUuid(providerId)) {
      return json(req, { ok: false, error: 'INVALID_PROVIDER_ID' }, 400)
    }

    const { data: provider } = await serviceClient
      .from('providers')
      .select('id')
      .eq('id', providerId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!provider) {
      return json(req, { ok: false, error: 'PROVIDER_NOT_FOUND' }, 404)
    }

    const { data: subscriptions, error } = await serviceClient
      .from('business_promotion_subscriptions')
      .select('stripe_customer_id, stripe_subscription_id, status')
      .eq('provider_id', providerId)
      .eq('user_id', user.id)
      .order('created_at', { ascending:false })

    if (error) throw error
    const stripeCustomerId = subscriptions
      ?.find(subscription => subscription.stripe_customer_id)
      ?.stripe_customer_id

    const subscriptionIds = [...new Set(
      (subscriptions || [])
        .filter(subscription =>
          ['active', 'past_due', 'processing'].includes(subscription.status)
        )
        .map(subscription => subscription.stripe_subscription_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    )]
    const syncedSubscriptions = []

    for (const subscriptionId of subscriptionIds) {
      let stripeSubscription: Stripe.Subscription

      try {
        stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId)
      } catch (retrieveError) {
        if (!isMissingStripeResource(retrieveError)) throw retrieveError

        const { error: missingSyncError } = await serviceClient
          .rpc('sync_featured_promotion_subscription_state', {
            p_subscription_id: subscriptionId,
            p_customer_id: null,
            p_status: 'canceled',
            p_period_start: null,
            p_period_end: null,
            p_cancel_at_period_end: true,
            p_last_error: 'La suscripcion ya no existe en Stripe.',
          })

        if (missingSyncError) throw missingSyncError
        syncedSubscriptions.push({
          id:subscriptionId,
          status:'canceled',
          cancellationScheduled:true,
        })
        continue
      }

      const period = getSubscriptionPeriod(stripeSubscription)
      const cancellationScheduled = hasScheduledCancellation(stripeSubscription)
      const { error: syncError } = await serviceClient
        .rpc('sync_featured_promotion_subscription_state', {
          p_subscription_id: stripeSubscription.id,
          p_customer_id: getStripeId(stripeSubscription.customer),
          p_status: stripeSubscription.status,
          p_period_start: period.start,
          p_period_end: period.end,
          p_cancel_at_period_end: cancellationScheduled,
          p_last_error: null,
        })

      if (syncError) throw syncError
      syncedSubscriptions.push({
        id:stripeSubscription.id,
        status:stripeSubscription.status,
        cancellationScheduled,
      })
    }

    if (syncOnly) {
      const blockingSubscription = syncedSubscriptions.find(subscription =>
        ['active', 'past_due', 'processing'].includes(subscription.status)
        && !subscription.cancellationScheduled
      )

      return json(req, {
        ok: true,
        synced: true,
        blocked:Boolean(blockingSubscription),
        cancellationScheduled:
          syncedSubscriptions.length > 0 && !blockingSubscription,
      })
    }

    if (!stripeCustomerId) {
      return json(req, { ok: false, error: 'CUSTOMER_NOT_FOUND' }, 404)
    }

    await stripe.customers.update(stripeCustomerId, {
      preferred_locales: ['es'],
    })

    const portal = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      locale: 'es',
      return_url: `${APP_URL}/negocios/${providerId}/destacar?plan=${returnPlanKey}&portal=return`,
    })

    return json(req, { ok: true, url: portal.url })
  } catch (error) {
    const message = errorMessage(error)
    console.error('Could not create Stripe portal:', message)
    return json(req, { ok: false, error: 'PORTAL_CREATE_FAILED' }, 500)
  }
})
