import Stripe from 'npm:stripe@22.2.0'
import { createClient } from 'npm:@supabase/supabase-js@2.101.1'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || ''
const APP_URL = (Deno.env.get('LATIDO_APP_URL') || 'https://www.latido.ch').replace(/\/+$/, '')
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion:'2026-05-27.dahlia', httpClient:Stripe.createFetchHttpClient() })
const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth:{ persistSession:false, autoRefreshToken:false } })

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
function stripeId(value: unknown) {
  if (typeof value === 'string') return value
  return value && typeof value === 'object' && 'id' in value && typeof (value as { id?:unknown }).id === 'string'
    ? (value as { id:string }).id : null
}
function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
async function currentUser(req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) throw new Error('AUTH_REQUIRED')
  const { data, error } = await service.auth.getUser(token)
  if (error || !data.user) throw new Error('AUTH_REQUIRED')
  return data.user
}
function period(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0]
  return {
    start:typeof item?.current_period_start === 'number' ? new Date(item.current_period_start * 1000).toISOString() : null,
    end:typeof (item?.current_period_end || item?.billed_until) === 'number'
      ? new Date((item.current_period_end || item.billed_until) * 1000).toISOString() : null,
  }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers:cors(req) })
  if (req.method !== 'POST') return json(req, { ok:false, error:'METHOD_NOT_ALLOWED' }, 405)
  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !STRIPE_SECRET_KEY) throw new Error('STRIPE_NOT_CONFIGURED')
    const user = await currentUser(req)
    const body = await req.json().catch(() => ({}))
    if (!isUuid(body?.providerId)) return json(req, { ok:false, error:'INVALID_PROVIDER_ID' }, 400)

    const { data: subscriptions, error } = await service
      .from('business_lead_alert_subscriptions')
      .select('stripe_customer_id, stripe_subscription_id, status')
      .eq('provider_id', body.providerId)
      .eq('user_id', user.id)
      .order('created_at', { ascending:false })
    if (error) throw error
    const customerId = subscriptions?.find(row => row.stripe_customer_id)?.stripe_customer_id
    if (!customerId) return json(req, { ok:false, error:'CUSTOMER_NOT_FOUND' }, 404)

    for (const row of subscriptions || []) {
      if (!row.stripe_subscription_id || !['active', 'past_due', 'processing'].includes(row.status)) continue
      const subscription = await stripe.subscriptions.retrieve(row.stripe_subscription_id).catch(() => null)
      if (!subscription) continue
      const subscriptionPeriod = period(subscription)
      await service.rpc('sync_business_lead_alert_subscription_state', {
        p_subscription_id:subscription.id,
        p_customer_id:stripeId(subscription.customer),
        p_status:subscription.status,
        p_period_start:subscriptionPeriod.start,
        p_period_end:subscriptionPeriod.end,
        p_cancel_at_period_end:subscription.cancel_at_period_end || typeof subscription.cancel_at === 'number',
        p_last_error:null,
      })
    }

    if (body?.syncOnly === true) return json(req, { ok:true, synced:true })
    await stripe.customers.update(customerId, { preferred_locales:['es'] })
    const portal = await stripe.billingPortal.sessions.create({
      customer:customerId,
      locale:'es',
      return_url:`${APP_URL}/negocios/${body.providerId}/alertas?portal=return`,
    })
    return json(req, { ok:true, url:portal.url })
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error)
    console.error('lead_alert_portal_failed', text)
    return json(req, { ok:false, error:text.includes('AUTH_REQUIRED') ? 'AUTH_REQUIRED' : 'PORTAL_CREATE_FAILED' }, text.includes('AUTH_REQUIRED') ? 401 : 500)
  }
})
