import assert from 'node:assert/strict'
import { deleteBusinessPublication } from '../src/lib/businessDeletion.js'

const providerId = '00000000-0000-4000-8000-000000000010'
const userId = '00000000-0000-4000-8000-000000000099'
function fixture({ status = { blocked: false, subscription: null }, error = null,
  cancellation = { ok: true, blocked: false, cancellationScheduled: true }, cancelError = null,
  deleteError = null, accepted = true } = {}) {
  const calls = []
  const deletion = {
    eq(key, value) { calls.push({ type: 'filter', key, value }); return this },
    then(resolve, reject) { calls.push({ type: 'deleted' }); return Promise.resolve({ error: deleteError }).then(resolve, reject) },
  }
  return {
    calls,
    options: { providerId, userId, title: 'Mi negocio', confirm: message => { calls.push({ type: 'confirm', message }); return accepted } },
    client: {
      rpc: async (name, args) => { calls.push({ type: 'status', name, args }); return { data: status, error } },
      functions: { invoke: async (name, args) => { calls.push({ type: 'cancel', name, args }); return { data: cancellation, error: cancelError } } },
      from: table => { calls.push({ type: 'table', table }); return { delete: () => deletion } },
    },
  }
}
const run = f => deleteBusinessPublication(f.client, f.options)
const free = fixture({ cancelError: new Error('Stripe unavailable') })
assert.equal(await run(free), true)
assert.ok(!free.calls.some(c => c.type === 'cancel'), 'Free businesses never contact Stripe')
assert.deepEqual(free.calls.filter(c => c.type === 'filter'), [
  { type: 'filter', key: 'id', value: providerId }, { type: 'filter', key: 'user_id', value: userId },
])
const scheduled = fixture({ status: { subscription: { status: 'active', cancelAtPeriodEnd: true } } })
assert.equal(await run(scheduled), true)
assert.ok(!scheduled.calls.some(c => c.type === 'cancel'))
const active = fixture({ status: { blocked: true, subscription: { status: 'active' } } })
assert.equal(await run(active), true)
assert.match(active.calls.find(c => c.type === 'confirm').message, /Tienes una suscripción activa.*¿Seguro/)
assert.match(active.calls.find(c => c.type === 'confirm').message, /Se cancelará la renovación/)
assert.deepEqual(active.calls.filter(c => c.type === 'cancel'), [{ type: 'cancel', name: 'create_business_promotion_portal', args: { body: { providerId, cancelForDeletion: true } } }])
assert.ok(active.calls.findIndex(c => c.type === 'confirm') < active.calls.findIndex(c => c.type === 'cancel'))
assert.ok(active.calls.findIndex(c => c.type === 'cancel') < active.calls.findIndex(c => c.type === 'deleted'))
for (const status of [{ blocked: false }, { blocked: true }]) {
  const dismissed = fixture({ status, accepted: false })
  assert.equal(await run(dismissed), false)
  assert.ok(!dismissed.calls.some(c => ['cancel', 'deleted'].includes(c.type)), 'Dismissing never changes billing or publications')
}
for (const settings of [{ cancelError: new Error('offline') }, { cancellation: { ok: true, blocked: true } },
  { cancellation: { ok: true, blocked: false } }, { cancellation: { ok: true, url: 'old-function.example' } }]) {
  const failed = fixture({ status: { blocked: true }, ...settings })
  await assert.rejects(run(failed), /Tu negocio no se ha eliminado/)
  assert.ok(!failed.calls.some(c => c.type === 'deleted'), 'Failed or old cancellation endpoints never authorize deletion')
}
const forbidden = fixture({ error: { code: 'P0001', message: 'PROVIDER_NOT_FOUND' } })
await assert.rejects(run(forbidden), e => e.message === 'PROVIDER_NOT_FOUND')
assert.equal(forbidden.calls.length, 1)
const race = fixture({ deleteError: { message: 'ACTIVE_BUSINESS_SUBSCRIPTION' } })
await assert.rejects(run(race), e => e.message === 'ACTIVE_BUSINESS_SUBSCRIPTION')
const legacy = fixture({ error: { code: 'PGRST202', message: 'Missing RPC' }, deleteError: { message: 'ACTIVE_BUSINESS_SUBSCRIPTION' } })
await assert.rejects(run(legacy), e => e.message === 'ACTIVE_BUSINESS_SUBSCRIPTION')
assert.ok(!legacy.calls.some(c => c.type === 'cancel'), 'The legacy database guard is retained')
console.log('Business deletion: free/offline, confirmation, cancellation-before-delete, failures and database guard passed')
await import('./test-business-deletion-edge.mjs')
await import('./test-business-deletion-sql.mjs')
