import Stripe from 'npm:stripe@22.2.0'
import { createClient } from 'npm:@supabase/supabase-js@2.101.1'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || ''
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_ALERTS_WEBHOOK_SECRET') || ''
const STRIPE_PRICE_ALERTS = Deno.env.get('STRIPE_PRICE_ALERTS') || ''
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion:'2026-05-27.dahlia', httpClient:Stripe.createFetchHttpClient() })
const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth:{ persistSession:false, autoRefreshToken:false } })

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers:{ 'Content-Type':'application/json' } })
}
function stripeId(value: unknown) {
  if (typeof value === 'string') return value
  return value && typeof value === 'object' && 'id' in value && typeof (value as { id?:unknown }).id === 'string'
    ? (value as { id:string }).id : null
}
function metadata(value: { metadata?: Stripe.Metadata | null }) {
  return value.metadata || {}
}
function period(subscription: Stripe.Subscription) {
  const item = subscription.items.data.find(item => stripeId(item.price) === STRIPE_PRICE_ALERTS) || subscription.items.data[0]
  const end = item?.current_period_end || item?.billed_until
  return {
    start:typeof item?.current_period_start === 'number' ? new Date(item.current_period_start * 1000).toISOString() : null,
    end:typeof end === 'number' ? new Date(end * 1000).toISOString() : null,
  }
}
function isLeadAlertSubscription(subscription: Stripe.Subscription) {
  return metadata(subscription).latido_alerts_enabled === 'true'
    && subscription.items.data.some(item => stripeId(item.price) === STRIPE_PRICE_ALERTS)
}
function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  return stripeId(invoice.parent?.subscription_details?.subscription)
    || stripeId((invoice as Stripe.Invoice & { subscription?:unknown }).subscription)
}
async function sync(subscription: Stripe.Subscription, statusOverride?:string, lastError:string | null = null) {
  const currentPeriod = period(subscription)
  const { error } = await service.rpc('sync_business_lead_alert_subscription_state', {
    p_subscription_id:subscription.id,
    p_customer_id:stripeId(subscription.customer),
    p_status:statusOverride || subscription.status,
    p_period_start:currentPeriod.start,
    p_period_end:currentPeriod.end,
    p_cancel_at_period_end:subscription.cancel_at_period_end || typeof subscription.cancel_at === 'number',
    p_last_error:lastError,
  })
  if (error) throw error
}
async function activate(subscription: Stripe.Subscription) {
  const meta = metadata(subscription)
  const providerId = meta.latido_provider_id
  const userId = meta.latido_user_id
  const recipientEmail = meta.latido_alert_recipient_email
  if (!providerId || !userId || !recipientEmail || !isLeadAlertSubscription(subscription)) return
  const currentPeriod = period(subscription)
  if (!currentPeriod.start || !currentPeriod.end) throw new Error('SUBSCRIPTION_PERIOD_MISSING')
  const { error: bundleError } = await service.rpc('activate_business_lead_alert_from_promotion', {
    p_provider_id:providerId,
    p_user_id:userId,
    p_subscription_id:subscription.id,
    p_customer_id:stripeId(subscription.customer),
    p_price_id:STRIPE_PRICE_ALERTS,
    p_period_start:currentPeriod.start,
    p_period_end:currentPeriod.end,
    p_recipient_email:recipientEmail,
    p_cancel_at_period_end:subscription.cancel_at_period_end || typeof subscription.cancel_at === 'number',
  })
  if (bundleError) throw bundleError
}

Deno.serve(async req => {
  if (req.method !== 'POST') return json({ ok:false, error:'METHOD_NOT_ALLOWED' }, 405)
  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET || !STRIPE_PRICE_ALERTS) {
      throw new Error('WEBHOOK_NOT_CONFIGURED')
    }
    const signature = req.headers.get('stripe-signature')
    if (!signature) return json({ ok:false, error:'SIGNATURE_MISSING' }, 400)
    const event = await stripe.webhooks.constructEventAsync(
      await req.text(), signature, STRIPE_WEBHOOK_SECRET, undefined, Stripe.createSubtleCryptoProvider(),
    )
    const { data: seen } = await service
      .from('business_lead_alert_stripe_events')
      .select('event_id')
      .eq('event_id', event.id)
      .maybeSingle()
    if (seen) return json({ ok:true, duplicate:true })

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (metadata(session).latido_alerts_enabled !== 'true') break
        const subscriptionId = stripeId(session.subscription)
        if (subscriptionId) await activate(await stripe.subscriptions.retrieve(subscriptionId))
        break
      }
      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session
        // La reserva pertenece al plan profesional; su propio webhook libera
        // la plaza. AquÃ­ no existe una reserva de alertas independiente.
        if (metadata(session).latido_alerts_enabled !== 'true') break
        break
      }
      case 'invoice.paid': {
        const subscriptionId = invoiceSubscriptionId(event.data.object as Stripe.Invoice)
        if (!subscriptionId) break
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        if (isLeadAlertSubscription(subscription)) await activate(subscription)
        break
      }
      case 'invoice.payment_failed': {
        const subscriptionId = invoiceSubscriptionId(event.data.object as Stripe.Invoice)
        if (!subscriptionId) break
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        if (isLeadAlertSubscription(subscription)) await sync(subscription, 'past_due', 'El ultimo cobro de Alertas no se pudo completar.')
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        if (isLeadAlertSubscription(subscription)) await sync(subscription)
        break
      }
      default:
        break
    }

    const { error } = await service
      .from('business_lead_alert_stripe_events')
      .insert({ event_id:event.id, event_type:event.type })
    if (error && error.code !== '23505') throw error
    return json({ ok:true })
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error)
    console.error('lead_alert_stripe_webhook_failed', text)
    return json({ ok:false, error:text }, 400)
  }
})
