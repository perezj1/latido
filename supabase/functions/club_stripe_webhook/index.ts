import Stripe from 'npm:stripe@22.6.0'
import { createClient } from 'npm:@supabase/supabase-js@2.101.1'
import nodemailer from 'npm:nodemailer@6.9.10'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_CLUB_SECRET_KEY') || Deno.env.get('STRIPE_SECRET_KEY') || ''
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_CLUB_WEBHOOK_SECRET') || ''
const SMTP_HOSTNAME = Deno.env.get('SMTP_HOSTNAME') || 'authsmtp.securemail.pro'
const SMTP_PORT = Number(Deno.env.get('SMTP_PORT') || '465')
const SMTP_SECURE = (Deno.env.get('SMTP_SECURE') || 'true').toLowerCase() === 'true'
const SMTP_USERNAME = Deno.env.get('SMTP_USERNAME') || ''
const SMTP_PASSWORD = Deno.env.get('SMTP_PASSWORD') || ''
const SMTP_FROM = Deno.env.get('CLUB_EMAIL_FROM') || Deno.env.get('SMTP_FROM') || SMTP_USERNAME
const ORDER_EMAIL = Deno.env.get('CLUB_ORDER_EMAIL') || 'latidoch@gmail.com'

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion:'2026-08-26.dahlia',
  httpClient:Stripe.createFetchHttpClient(),
})
const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth:{ persistSession:false, autoRefreshToken:false },
})
const transport = nodemailer.createTransport({
  host:SMTP_HOSTNAME,
  port:SMTP_PORT,
  secure:SMTP_SECURE,
  auth:{ user:SMTP_USERNAME, pass:SMTP_PASSWORD },
})

type ClubItem = {
  sku:string
  gelato_product_id:string
  gelato_variant_id:string
  product_name:string
  product_title:string
  option_label:string
  option:string
  unit_amount:number
  quantity:number
  line_total:number
}
type ClubOrder = {
  id:string
  reference:string
  items:ClubItem[]
  currency:string
  subtotal_amount:number
  shipping_amount:number
  total_amount:number
  customer_email:string | null
  customer_name:string | null
  customer_phone:string | null
  shipping_address:Record<string, string> | null
  admin_email_sent_at:string | null
  customer_email_sent_at:string | null
}

function json(body:Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers:{ 'Content-Type':'application/json' } })
}
function stripeId(value:unknown) {
  if (typeof value === 'string') return value
  return value && typeof value === 'object' && 'id' in value && typeof (value as { id?:unknown }).id === 'string'
    ? (value as { id:string }).id : null
}
function escapeHtml(value:unknown) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}
function money(amount:number, currency = 'chf') {
  return new Intl.NumberFormat('de-CH', { style:'currency', currency:currency.toUpperCase() }).format(amount / 100)
}
function addressLines(address:Record<string, string> | null) {
  if (!address) return []
  return [
    address.line1,
    address.line2,
    [address.postal_code, address.city].filter(Boolean).join(' '),
    address.state,
    address.country,
  ].filter(Boolean)
}
function shippingDetails(session:Stripe.Checkout.Session) {
  const value = session as Stripe.Checkout.Session & {
    shipping_details?:{ name?:string | null; address?:Stripe.Address | null }
    collected_information?:{ shipping_details?:{ name?:string | null; address?:Stripe.Address | null } | null } | null
  }
  return value.collected_information?.shipping_details || value.shipping_details || null
}
async function sendMail(options:{ to:string; subject:string; text:string; html:string; replyTo?:string }) {
  await new Promise<void>((resolve, reject) => transport.sendMail({
    from:SMTP_FROM,
    to:options.to,
    subject:options.subject,
    text:options.text,
    html:options.html,
    replyTo:options.replyTo,
  }, (error:Error | null) => error ? reject(error) : resolve()))
}
function adminMessage(order:ClubOrder) {
  const lines = order.items.flatMap(item => [
    `${item.quantity} x ${item.product_name}`,
    `${item.option_label}: ${item.option}`,
    `Gelato product: ${item.gelato_product_id}`,
    `Gelato variant: ${item.gelato_variant_id}`,
    `SKU: ${item.sku}`,
  ])
  const address = addressLines(order.shipping_address)
  const text = [
    `NUEVO PEDIDO LATIDO CLUB ${order.reference}`, '',
    ...lines, '',
    'CLIENTE',
    order.customer_name || '',
    order.customer_email || '',
    order.customer_phone || '', '',
    'ENVÍO', ...address, '',
    'PAGO',
    `${money(order.total_amount, order.currency)} · Stripe PAGADO`,
    `Productos: ${money(order.subtotal_amount, order.currency)}`,
    `Envío: ${order.shipping_amount > 0 ? money(order.shipping_amount, order.currency) : 'incluido'}`, '',
    'Abre Gelato > Pedidos > Nuevo pedido > Añadir producto > Seleccionar un producto de mis tiendas > Latido Club.',
  ].join('\n')
  const itemsHtml = order.items.map(item => `<tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb"><strong>${item.quantity} × ${escapeHtml(item.product_name)}</strong><br><span style="color:#64748b">${escapeHtml(item.option_label)}: ${escapeHtml(item.option)}</span><br><small style="color:#94a3b8">Producto ${escapeHtml(item.gelato_product_id)}<br>Variante ${escapeHtml(item.gelato_variant_id)}</small></td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right">${escapeHtml(money(item.line_total, order.currency))}</td></tr>`).join('')
  const shippingLabel = order.shipping_amount > 0 ? money(order.shipping_amount, order.currency) : 'incluido'
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f6f4ef;font-family:Arial,sans-serif;color:#10204a"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border-radius:18px;padding:28px"><tr><td><div style="font-size:12px;font-weight:800;color:#9e1b20;letter-spacing:1px">NUEVO PEDIDO PAGADO</div><h1 style="margin:7px 0 22px;font-size:28px">${escapeHtml(order.reference)}</h1><table width="100%" cellspacing="0" cellpadding="0">${itemsHtml}</table><h2 style="margin:26px 0 8px;font-size:16px">Cliente</h2><p style="margin:0;line-height:1.6">${escapeHtml(order.customer_name)}<br><a href="mailto:${escapeHtml(order.customer_email)}">${escapeHtml(order.customer_email)}</a><br>${escapeHtml(order.customer_phone)}</p><h2 style="margin:26px 0 8px;font-size:16px">Envío</h2><p style="margin:0;line-height:1.6">${address.map(escapeHtml).join('<br>')}</p><div style="margin:26px 0;padding:18px;border-radius:12px;background:#eef4ff"><strong>Total pagado: ${escapeHtml(money(order.total_amount, order.currency))}</strong><br><span style="color:#64748b">Productos ${escapeHtml(money(order.subtotal_amount, order.currency))} · Envío ${escapeHtml(shippingLabel)}</span></div><p style="line-height:1.6">Abre <strong>Gelato → Pedidos → Nuevo pedido → Añadir producto → Seleccionar un producto de mis tiendas → Latido Club</strong>.</p></td></tr></table></td></tr></table></body></html>`
  return { subject:`Pedido pagado ${order.reference} · Latido Club`, text, html }
}
function customerMessage(order:ClubOrder) {
  const summary = order.items.map(item => `${item.quantity} x ${item.product_name} · ${item.option_label}: ${item.option}`).join('\n')
  const text = [`Hola ${order.customer_name || ''},`, '', `Hemos recibido el pago de tu pedido ${order.reference}.`, '', summary, '', `Total: ${money(order.total_amount, order.currency)}`, '', 'Prepararemos tu pedido bajo demanda. El plazo de entrega estimado es de 10 a 15 días. Si pasado ese plazo no lo has recibido, responde a este email.', '', 'Gracias,', 'Latido Club'].join('\n')
  const itemsHtml = order.items.map(item => `<li style="margin-bottom:8px">${item.quantity} × ${escapeHtml(item.product_name)} · ${escapeHtml(item.option_label)}: ${escapeHtml(item.option)}</li>`).join('')
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f6f4ef;font-family:Arial,sans-serif;color:#10204a"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border-radius:18px;padding:30px"><tr><td><div style="font-size:24px;font-weight:800;color:#1757e8">Latido Club</div><h1 style="margin:24px 0 12px;font-size:25px">Pago confirmado</h1><p style="line-height:1.7">Hola ${escapeHtml(order.customer_name)}, hemos recibido correctamente tu pedido <strong>${escapeHtml(order.reference)}</strong>.</p><ul style="padding-left:20px;line-height:1.6">${itemsHtml}</ul><p style="font-size:18px"><strong>Total: ${escapeHtml(money(order.total_amount, order.currency))}</strong></p><p style="line-height:1.7;color:#64748b">Prepararemos tu pedido bajo demanda. El plazo de entrega estimado es de <strong>10 a 15 días</strong>. Si pasado ese plazo no lo has recibido, responde a este email y lo revisamos.</p><p style="margin-top:28px">Gracias por formar parte de Latido Club.</p></td></tr></table></td></tr></table></body></html>`
  return { subject:`Hemos recibido tu pedido ${order.reference} · Latido Club`, text, html }
}

async function paidOrder(session:Stripe.Checkout.Session) {
  const orderId = session.metadata?.latido_order_id || session.client_reference_id
  if (!orderId || session.metadata?.latido_product !== 'club_order') return null
  const shipping = shippingDetails(session)
  const email = session.customer_details?.email || session.customer_email || null
  const phone = session.customer_details?.phone || null
  const name = shipping?.name || session.customer_details?.name || null
  const address = shipping?.address ? {
    line1:shipping.address.line1 || '',
    line2:shipping.address.line2 || '',
    postal_code:shipping.address.postal_code || '',
    city:shipping.address.city || '',
    state:shipping.address.state || '',
    country:shipping.address.country || '',
  } : null
  const { error:updateError } = await service.from('club_orders').update({
    status:'paid',
    payment_status:'paid',
    customer_email:email,
    customer_name:name,
    customer_phone:phone,
    shipping_address:address,
    stripe_checkout_url:null,
    stripe_payment_intent_id:stripeId(session.payment_intent),
    stripe_customer_id:stripeId(session.customer),
    total_amount:session.amount_total || undefined,
    paid_at:new Date().toISOString(),
    notification_last_error:null,
  }).eq('id', orderId)
  if (updateError) throw updateError

  const { data, error } = await service.from('club_orders').select('*').eq('id', orderId).single()
  if (error || !data) throw error || new Error('ORDER_NOT_FOUND')
  const order = data as ClubOrder
  if (!order.admin_email_sent_at) {
    const message = adminMessage(order)
    await sendMail({ to:ORDER_EMAIL, replyTo:order.customer_email || undefined, ...message })
    const { error:markError } = await service.from('club_orders').update({ admin_email_sent_at:new Date().toISOString() }).eq('id', order.id).is('admin_email_sent_at', null)
    if (markError) throw markError
  }
  if (order.customer_email && !order.customer_email_sent_at) {
    const message = customerMessage(order)
    await sendMail({ to:order.customer_email, replyTo:ORDER_EMAIL || undefined, ...message })
    const { error:markError } = await service.from('club_orders').update({ customer_email_sent_at:new Date().toISOString() }).eq('id', order.id).is('customer_email_sent_at', null)
    if (markError) throw markError
  }
  return order.id
}

Deno.serve(async req => {
  if (req.method !== 'POST') return json({ ok:false, error:'METHOD_NOT_ALLOWED' }, 405)
  let orderId:string | null = null
  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET || !SMTP_USERNAME || !SMTP_PASSWORD || !SMTP_FROM) {
      throw new Error('WEBHOOK_NOT_CONFIGURED')
    }
    const signature = req.headers.get('stripe-signature')
    if (!signature) return json({ ok:false, error:'SIGNATURE_MISSING' }, 400)
    const event = await stripe.webhooks.constructEventAsync(
      await req.text(), signature, STRIPE_WEBHOOK_SECRET, undefined, Stripe.createSubtleCryptoProvider(),
    )
    const { data:seen } = await service.from('club_stripe_events').select('event_id').eq('event_id', event.id).maybeSingle()
    if (seen) return json({ ok:true, duplicate:true })

    const session = event.data.object as Stripe.Checkout.Session
    if (session.metadata?.latido_product === 'club_order') {
      orderId = session.metadata.latido_order_id || session.client_reference_id
      if ((event.type === 'checkout.session.completed' && session.payment_status === 'paid') || event.type === 'checkout.session.async_payment_succeeded') {
        orderId = await paidOrder(session)
      } else if (event.type === 'checkout.session.completed') {
        await service.from('club_orders').update({ status:'payment_processing', payment_status:'processing' }).eq('id', orderId)
      } else if (event.type === 'checkout.session.async_payment_failed') {
        await service.from('club_orders').update({ status:'payment_failed', payment_status:'failed' }).eq('id', orderId)
      } else if (event.type === 'checkout.session.expired') {
        await service.from('club_orders').update({ status:'expired', stripe_checkout_url:null }).eq('id', orderId).eq('payment_status', 'unpaid')
      }
    }

    const { error:eventError } = await service.from('club_stripe_events').insert({
      event_id:event.id,
      event_type:event.type,
      order_id:orderId,
    })
    if (eventError && eventError.code !== '23505') throw eventError
    return json({ ok:true })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    if (orderId) await service.from('club_orders').update({ notification_last_error:detail.slice(0, 1000) }).eq('id', orderId)
    console.error('club_stripe_webhook_failed', detail.slice(0, 500))
    return json({ ok:false, error:'WEBHOOK_PROCESSING_FAILED' }, 500)
  }
})
