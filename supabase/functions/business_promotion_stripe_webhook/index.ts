import Stripe from 'npm:stripe@22.2.0'
import { createClient } from 'npm:@supabase/supabase-js@2.101.1'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || ''
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''

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

function json(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers:{
      'Access-Control-Allow-Origin':'https://www.latido.ch',
      'Content-Type':'application/json',
    },
  })
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

function getStripeId(value: unknown) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' ? id : null
  }
  return null
}

function getSubscriptionPlanItem(subscription: Stripe.Subscription) {
  const item = subscription.items?.data?.find(subscriptionItem =>
    PRICE_TO_PLAN.has(getStripeId(subscriptionItem.price) || '')
  ) || subscription.items?.data?.[0]
  const priceId = getStripeId(item?.price)

  return {
    item,
    priceId,
    planKey: priceId ? PRICE_TO_PLAN.get(priceId) || null : null,
  }
}

function getSubscriptionPeriod(subscription: Stripe.Subscription) {
  const { item, priceId, planKey } = getSubscriptionPlanItem(subscription)
  const start = item?.current_period_start
  const end = item?.current_period_end || item?.billed_until

  return {
    start:typeof start === 'number' ? new Date(start * 1000).toISOString() : null,
    end:typeof end === 'number' ? new Date(end * 1000).toISOString() : null,
    priceId,
    planKey,
  }
}

function hasScheduledCancellation(subscription: Stripe.Subscription) {
  return subscription.cancel_at_period_end
    || typeof subscription.cancel_at === 'number'
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
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

type LatidoMetadata = {
  latido_reservation_id?: string
  latido_provider_id?: string
  latido_user_id?: string
  latido_plan_key?: string
}

function metadataFor(value: { metadata?: Stripe.Metadata | null }): LatidoMetadata {
  return (value.metadata || {}) as LatidoMetadata
}

async function retrieveSubscription(subscriptionId: string) {
  return stripe.subscriptions.retrieve(subscriptionId)
}

async function syncSubscriptionState(
  subscription: Stripe.Subscription,
  lastError: string | null = null,
  statusOverride: string | null = null,
) {
  const period = getSubscriptionPeriod(subscription)
  const { error } = await serviceClient
    .rpc('sync_featured_promotion_subscription_state', {
      p_subscription_id: subscription.id,
      p_customer_id: getStripeId(subscription.customer),
      p_status: statusOverride || subscription.status,
      p_period_start: period.start,
      p_period_end: period.end,
      p_cancel_at_period_end: hasScheduledCancellation(subscription),
      p_last_error: lastError,
    })

  if (error) throw error
}

async function activateSubscription(subscription: Stripe.Subscription) {
  const metadata = metadataFor(subscription)
  const period = getSubscriptionPeriod(subscription)
  const metadataPlanKey = metadata.latido_plan_key as PlanKey | undefined
  const planKey = metadataPlanKey || period.planKey

  if (
    !metadata.latido_reservation_id
    || !metadata.latido_provider_id
    || !metadata.latido_user_id
  ) {
    throw new Error('LATIDO_METADATA_MISSING')
  }
  if (!period.priceId || !period.planKey) {
    throw new Error('UNEXPECTED_STRIPE_PRICE')
  }
  if (metadataPlanKey && metadataPlanKey !== period.planKey) {
    throw new Error('UNEXPECTED_STRIPE_PRICE')
  }
  if (!planKey) {
    throw new Error('PLAN_KEY_MISSING')
  }
  if (!period.start || !period.end) {
    throw new Error('SUBSCRIPTION_PERIOD_MISSING')
  }

  let activateResponse = await serviceClient
    .rpc('activate_business_promotion_subscription', {
      p_reservation_id: metadata.latido_reservation_id,
      p_provider_id: metadata.latido_provider_id,
      p_user_id: metadata.latido_user_id,
      p_plan_key: planKey,
      p_subscription_id: subscription.id,
      p_customer_id: getStripeId(subscription.customer),
      p_price_id: period.priceId,
      p_period_start: period.start,
      p_period_end: period.end,
      p_cancel_at_period_end: hasScheduledCancellation(subscription),
    })

  if (
    activateResponse.error
    && planKey === 'featured'
    && isMissingRpc(activateResponse.error, 'activate_business_promotion_subscription')
  ) {
    activateResponse = await serviceClient
      .rpc('activate_featured_promotion_subscription', {
        p_reservation_id: metadata.latido_reservation_id,
        p_provider_id: metadata.latido_provider_id,
        p_user_id: metadata.latido_user_id,
        p_subscription_id: subscription.id,
        p_customer_id: getStripeId(subscription.customer),
        p_price_id: period.priceId,
        p_period_start: period.start,
        p_period_end: period.end,
        p_cancel_at_period_end: hasScheduledCancellation(subscription),
      })
  }

  if (activateResponse.error) throw activateResponse.error
}

function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  return getStripeId(invoice.parent?.subscription_details?.subscription)
    || getStripeId((invoice as Stripe.Invoice & { subscription?: unknown }).subscription)
}

Deno.serve(async req => {
  if (req.method !== 'POST') {
    return json(req, { ok:false, error:'METHOD_NOT_ALLOWED' }, 405)
  }

  try {
    requireStripeConfiguration()
    if (!STRIPE_WEBHOOK_SECRET) throw new Error('WEBHOOK_NOT_CONFIGURED')

    const signature = req.headers.get('stripe-signature')
    if (!signature) return json(req, { ok:false, error:'SIGNATURE_MISSING' }, 400)

    const rawBody = await req.text()
    const event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      STRIPE_WEBHOOK_SECRET,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    )

    const { data: processedEvent } = await serviceClient
      .from('business_promotion_stripe_events')
      .select('event_id')
      .eq('event_id', event.id)
      .maybeSingle()

    if (processedEvent) {
      return json(req, { ok:true, duplicate:true })
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const metadata = metadataFor(session)
        if (metadata.latido_reservation_id) {
          const { error } = await serviceClient
            .rpc('mark_featured_promotion_checkout_processing', {
              p_reservation_id: metadata.latido_reservation_id,
              p_subscription_id: getStripeId(session.subscription),
              p_customer_id: getStripeId(session.customer),
            })
          if (error) throw error
        }
        break
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session
        const metadata = metadataFor(session)
        if (metadata.latido_reservation_id) {
          const { error } = await serviceClient
            .rpc('release_featured_promotion_reservation', {
              p_reservation_id: metadata.latido_reservation_id,
              p_status: 'expired',
              p_error: 'Stripe Checkout expired.',
            })
          if (error) throw error
        }
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoiceSubscriptionId(invoice)
        if (subscriptionId) {
          const subscription = await retrieveSubscription(subscriptionId)
          await activateSubscription(subscription)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoiceSubscriptionId(invoice)
        if (subscriptionId) {
          const subscription = await retrieveSubscription(subscriptionId)
          await syncSubscriptionState(
            subscription,
            'El ultimo cobro de la suscripcion no se pudo completar.',
            'past_due',
          )
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await syncSubscriptionState(subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await syncSubscriptionState(subscription, 'Suscripcion cancelada.')
        break
      }

      default:
        break
    }

    const { error: eventError } = await serviceClient
      .from('business_promotion_stripe_events')
      .insert({ event_id:event.id, event_type:event.type })

    if (eventError && eventError.code !== '23505') throw eventError

    return json(req, { ok:true })
  } catch (error) {
    const message = errorMessage(error)
    console.error('Stripe promotion webhook failed:', message)
    return json(req, { ok:false, error:message }, 400)
  }
})
