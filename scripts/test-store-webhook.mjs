import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFile } from 'node:fs/promises'
import { transformWithEsbuild } from 'vite'

const source = await readFile(new URL('../supabase/functions/club_stripe_webhook/index.ts', import.meta.url), 'utf8')
const { code } = await transformWithEsbuild(source.replace(/^import .*$/gm, ''), 'webhook.ts', { loader: 'ts' })
let handler, event, duplicate, dbFailure, paymentFailure, adminMailFailure, settled, seenEvents
const messages = [], writes = []
const order = { id: 'order-1', reference: 'LC-001001', payment_status: 'paid', status: 'paid', currency: 'chf', total_amount: 2490, subtotal_amount: 2490, shipping_amount: 0, items: [{ product_name: 'Camiseta', quantity: 1, option_label: 'Color / Talla', option: 'Negro / M', line_total: 2490 }], customer_email: 'buyer@latido.test', customer_name: 'Cliente', shipping_address: { line1: 'Calle 1', postal_code: '8000', city: 'Zürich', country: 'CH' } }
const service = {
  async rpc(name, args) {
    assert.equal(name, 'club_settle_payment')
    assert.equal(args.p_session, 'cs_verified')
    assert.equal(args.p_details.shipping_address.country, 'CH')
    settled++
    return paymentFailure ? { error: new Error('ORDER_AMOUNT_MISMATCH') } : { data: { ...order } }
  },
  from(table) {
    let action, value
    const query = {
      select() { action = 'select'; return query },
      update(data) { action = 'update'; value = data; return query },
      insert(data) { action = 'insert'; value = data; return query },
      eq() { return query }, is() { return query }, in() { return query },
      async maybeSingle() { return { data: duplicate ? { event_id: event.id } : null } },
      then(resolve, reject) {
        if (action === 'insert' && table === 'club_stripe_events') seenEvents++
        writes.push({ table, action, value })
        if (action === 'update' && value.admin_email_sent_at) order.admin_email_sent_at = value.admin_email_sent_at
        if (action === 'update' && value.customer_email_sent_at) order.customer_email_sent_at = value.customer_email_sent_at
        return Promise.resolve({ error: dbFailure ? new Error('DATABASE_UNAVAILABLE') : null }).then(resolve, reject)
      },
    }
    return query
  },
}
class Stripe {
  static createFetchHttpClient() {}
  static createSubtleCryptoProvider() {}
  webhooks = { async constructEventAsync(body, signature) { if (signature !== 'valid') throw new Error('bad signature'); return event } }
}
vm.runInNewContext(code, {
  Stripe, createClient: () => service, Response, Intl, Date, console: { error() {} },
  nodemailer: { createTransport: () => ({ sendMail(options, callback) { messages.push(options); callback(adminMailFailure && options.to === 'owner@latido.test' ? new Error('SMTP_UNAVAILABLE') : null) } }) },
  Deno: { env: { get(name) { return ({ CLUB_ORDER_EMAIL: 'owner@latido.test', SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-only', STRIPE_CLUB_SECRET_KEY: 'test-only', STRIPE_CLUB_WEBHOOK_SECRET: 'test-only', SMTP_FROM: 'shop@latido.test' })[name] } }, serve(value) { handler = value } },
})
function reset(type = 'checkout.session.completed', payment = 'paid') {
  duplicate = dbFailure = paymentFailure = adminMailFailure = false
  settled = seenEvents = 0
  messages.length = writes.length = 0
  order.admin_email_sent_at = order.customer_email_sent_at = null
  event = { id: 'evt_1', type, data: { object: { id: 'cs_verified', payment_status: payment, metadata: { latido_product: 'club_order', latido_order_id: order.id }, amount_total: 2490, currency: 'chf', customer_details: { email: order.customer_email, name: order.customer_name }, collected_information: { shipping_details: { name: order.customer_name, address: order.shipping_address } } } } }
}
const call = signature => handler(new Request('https://test/webhook', { method: 'POST', headers: signature ? { 'stripe-signature': signature } : {}, body: '{}' }))
reset()
assert.equal((await call()).status, 400)
assert.equal((await call('invalid')).status, 400)
assert.equal(settled, 0)
assert.equal((await call('valid')).status, 200)
assert.equal(settled, 1)
assert.equal(seenEvents, 1)
assert.equal(messages.length, 2)
assert.ok(messages[0].text.includes('LC-001001'))
assert.ok(messages[0].text.includes('8000 Zürich'))
assert.ok(messages[0].text.includes('Negro / M'))
reset()
adminMailFailure = true
assert.equal((await call('valid')).status, 500)
assert.equal(settled, 1, 'Payment is saved even if SMTP fails or is missing')
assert.equal(messages.length, 2, 'Customer confirmation is attempted independently')
assert.equal(seenEvents, 0, 'Stripe must retry failed notifications')
assert.ok(order.customer_email_sent_at)
adminMailFailure = false
messages.length = 0
assert.equal((await call('valid')).status, 200)
assert.equal(messages.length, 1, 'Retry skips customer email already sent')
assert.equal(messages[0].to, 'owner@latido.test')
reset()
duplicate = true
assert.equal((await call('valid')).status, 200)
assert.equal(settled, 0)
assert.equal(messages.length, 0)
reset('checkout.session.completed', 'unpaid')
assert.equal((await call('valid')).status, 200)
assert.equal(settled, 0)
assert.ok(writes.some(w => w.value?.payment_status === 'processing'))
reset('checkout.session.async_payment_succeeded', 'paid')
assert.equal((await call('valid')).status, 200)
assert.equal(settled, 1)
reset('checkout.session.async_payment_failed', 'unpaid')
dbFailure = true
assert.equal((await call('valid')).status, 500)
assert.equal(seenEvents, 0)
reset()
paymentFailure = true
assert.equal((await call('valid')).status, 500)
assert.equal(messages.length, 0, 'No confirmation for mismatched payments')
console.log('Store webhook: signature rejection, settlement before email, SMTP retries, duplicate events, delayed payments and database failures passed.')
