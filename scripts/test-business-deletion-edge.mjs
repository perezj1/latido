import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { transform } from 'esbuild'

const providerId = '00000000-0000-4000-8000-000000000010'
const userId = '00000000-0000-4000-8000-000000000099'
// Execute the actual Edge Function with fake services; never use keys or network.
const source = (await readFile(new URL('../supabase/functions/create_business_promotion_portal/index.ts', import.meta.url), 'utf8'))
  .replace(/^import Stripe .*$/m, 'const Stripe = globalThis.MockStripe')
  .replace(/^import \{ createClient \} .*$/m, 'const createClient = globalThis.mockCreateClient')
const { code } = await transform(source, { loader: 'ts', format: 'iife', target: 'es2022' })
async function endpoint({ rows = [{ stripe_subscription_id: 'sub_one', stripe_customer_id: 'cus_test', status: 'active' }],
  alertRows = [], stripeRows, failUpdate = false, failSync = false, unconfirmed = false, missing = false } = {}) {
  const calls = []
  const remote = new Map((stripeRows || [...rows, ...alertRows].map(r => ({ id: r.stripe_subscription_id, customer: 'cus_test', status: 'active',
    cancel_at_period_end: false, items: { data: [] }, metadata: {} }))).map(r => [r.id, structuredClone(r)]))
  let handler
  const record = value => calls.push(JSON.parse(JSON.stringify(value)))
  class MockStripe {
    static createFetchHttpClient() { return {} }
    subscriptions = {
      retrieve: async id => {
        record({ type: 'retrieve', id })
        if (missing) throw { code: 'resource_missing', statusCode: 404 }
        return structuredClone(remote.get(id))
      },
      update: async (id, args) => {
        record({ type: 'update', id, args })
        if (failUpdate) throw new Error('Stripe offline')
        const updated = { ...remote.get(id), cancel_at_period_end: !unconfirmed }
        remote.set(id, updated)
        return structuredClone(updated)
      },
    }
    customers = { update: async () => record({ type: 'customer' }) }
    billingPortal = { sessions: { create: async () => { record({ type: 'portal' }); return { url: 'https://billing.example/' } } } }
  }
  const service = {
    auth: { getUser: async token => ({ data: { user: token === 'owner' ? { id: userId } : { id: 'someone-else' } } }) },
    from(table) {
      const filters = {}
      return {
        select() { return this },
        eq(key, value) { filters[key] = value; return this },
        async maybeSingle() { return { data: table === 'providers' && filters.id === providerId && filters.user_id === userId ? { id: providerId } : null } },
        async order() {
          assert.equal(filters.provider_id, providerId)
          assert.equal(filters.user_id, userId)
          return { data: structuredClone(table === 'business_lead_alert_subscriptions' ? alertRows : rows), error: null }
        },
      }
    },
    async rpc(name, args) { record({ type: 'sync', name, args }); return { error: failSync && name === 'sync_featured_promotion_subscription_state' ? new Error('DB offline') : null } },
  }
  vm.runInNewContext(code, {
    MockStripe, mockCreateClient: () => service, Request, Response,
    console: { error() {}, warn() {} },
    Deno: { env: { get: name => ({ SUPABASE_URL: 'https://test.invalid', SUPABASE_SERVICE_ROLE_KEY: 'mock-service', STRIPE_SECRET_KEY: 'mock-stripe' })[name] }, serve: fn => { handler = fn } },
    fetch: () => { throw new Error('External requests are forbidden in tests') },
  })
  return {
    calls, remote,
    async request(body, token = 'owner') {
      const response = await handler(new Request('https://test.invalid/portal', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ providerId, ...body }) }))
      return { status: response.status, data: await response.json() }
    },
  }
}
const cancel = await endpoint()
assert.equal((await cancel.request({ cancelForDeletion: true })).data.cancellationScheduled, true)
assert.deepEqual(cancel.calls.filter(c => c.type === 'update'), [{ type: 'update', id: 'sub_one', args: { cancel_at_period_end: true, proration_behavior: 'none' } }])
assert.equal(cancel.calls.find(c => c.type === 'sync').args.p_cancel_at_period_end, true)
assert.ok(!cancel.calls.some(c => c.type === 'portal'), 'Deletion never creates a billing portal session')
await cancel.request({ cancelForDeletion: true })
assert.equal(cancel.calls.filter(c => c.type === 'update').length, 1, 'Retrying a scheduled cancellation does not change billing again')
const syncOnly = await endpoint()
assert.equal((await syncOnly.request({ syncOnly: true })).data.blocked, true)
assert.ok(!syncOnly.calls.some(c => c.type === 'update'), 'Read-only sync never cancels renewals')
const portal = await endpoint()
assert.equal((await portal.request({})).data.url, 'https://billing.example/')
assert.ok(!portal.calls.some(c => c.type === 'update'), 'Opening the normal portal never cancels renewals')
for (const settings of [{ failUpdate: true }, { failSync: true }, { unconfirmed: true }]) {
  const failed = await endpoint(settings)
  assert.equal((await failed.request({ cancelForDeletion: true })).status, 500)
}
const other = await endpoint()
assert.equal((await other.request({ cancelForDeletion: true }, 'other-user')).status, 404)
assert.deepEqual(other.calls, [], 'Another account cannot read or cancel a subscription')
const missing = await endpoint({ missing: true })
assert.equal((await missing.request({ cancelForDeletion: true })).data.blocked, false)
assert.equal(missing.calls.find(c => c.type === 'sync').args.p_status, 'canceled')
const multiple = await endpoint({ rows: ['one', 'two'].map(id => ({ stripe_subscription_id: `sub_${id}`, status: 'active' })) })
assert.equal((await multiple.request({ cancelForDeletion: true })).data.blocked, false)
assert.equal(multiple.calls.filter(c => c.type === 'update').length, 2)
const alerts = await endpoint({ rows: [], alertRows: [{ stripe_subscription_id: 'sub_alert', status: 'active' }] })
assert.equal((await alerts.request({ cancelForDeletion: true })).data.blocked, false)
assert.equal(alerts.calls.find(c => c.type === 'update').id, 'sub_alert')
assert.equal(alerts.calls.find(c => c.type === 'sync').name, 'sync_business_lead_alert_subscription_state')
assert.ok(!alerts.calls.some(c => c.name === 'sync_business_landing_from_promotion'))
const bundle = await endpoint({ alertRows: [{ stripe_subscription_id: 'sub_one', status: 'active' }] })
await bundle.request({ cancelForDeletion: true })
assert.equal(bundle.calls.filter(c => c.type === 'update').length, 1, 'Bundled alerts cancel the shared subscription only once')
assert.ok(bundle.calls.some(c => c.name === 'sync_business_lead_alert_subscription_state'))
console.log('Business deletion Edge: owned subscriptions, confirmed cancellation, retries, multiple plans, offline/DB failures and read-only portal sync passed')
