import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import vm from 'node:vm'
const directory = new URL('../supabase/functions/conversation_followup_email/', import.meta.url)
const workerSource = (await readFile(new URL('index.ts', directory), 'utf8'))
  .replace(/^import \{ createClient \} .*$/m, 'const createClient=globalThis.mockCreateClient;')
  .replace(/^import nodemailer .*$/m, 'const nodemailer=globalThis.mockNodemailer;')
const bundle = await build({ stdin: { contents: workerSource, loader: 'ts', resolveDir: fileURLToPath(directory) }, bundle: true, write: false, platform: 'node', format: 'iife', target: 'es2022' })
async function run({ authorized = true, enabled = true, emailEnabled = true, confirmed = true, smtpFailure = false, pushFailure = false, emailAlreadySent = false, pushAlreadySent = false, unavailable = false, body, testAccount = false } = {}) {
  let handler, claims = 0
  const mails = [], updates = [], pushes = []
  const row = { id: 'followup', user_id: 'customer', conversation_id: 'conversation', title: '<img src=x onerror=alert(1)>', round: 2, token: 'a'.repeat(64), attempts: 1, email_enabled: emailEnabled, email_sent_at: emailAlreadySent ? 'today' : null, push_sent_at: pushAlreadySent ? 'today' : null }
  const service = {
    async rpc(name) {
      if (name === 'cf_email_context') return unavailable ? { error: { message: 'LINK_UNAVAILABLE' } } : { data: { round: 2, outcome: 'not_yet', contact_name: 'Marta & Co.' } }
      assert.equal(name, 'cf_claim_due'); claims++; return { data: [row] }
    },
    auth: { admin: { async getUserById() { return { data: { user: { email: 'customer@example.test', email_confirmed_at: confirmed ? 'today' : null, user_metadata: { latido_followup_test: testAccount } } } } } } },
    from(table) {
      assert.equal(table, 'conversation_followups')
      let value
      const query = { select() { return query }, eq() { return query }, update(data) { value = data; return query }, async maybeSingle() { return { data: { ...row, email_token: row.token, is_test: testAccount } } }, async single() { return { data: { round: 2, outcome: 'not_yet' } } }, then(resolve, reject) { updates.push(value); return Promise.resolve({ error: null }).then(resolve, reject) } }
      return query
    },
  }
  vm.runInNewContext(bundle.outputFiles[0].text, {
    mockCreateClient: () => service,
    mockNodemailer: { createTransport: () => ({ async sendMail(message) { mails.push(message); if (smtpFailure) throw new Error('smtp failed'); return { accepted: [message.to], messageId: 'test-message' } } }) },
    Deno: { env: { get(name) { return { CONVERSATION_FOLLOWUP_CRON_SECRET: 'test-secret', CONVERSATION_FOLLOWUP_ENABLED: enabled ? 'true' : 'false', PUSH_WEBHOOK_SECRET: 'push-secret', LATIDO_APP_URL: 'https://latido.test', SUPABASE_URL: 'https://backend.test' }[name] } }, serve(fn) { handler = fn } },
    Response, Date, AbortSignal, console,
    async fetch(url, options) { pushes.push({ url, body: JSON.parse(options.body) }); return Response.json(pushFailure ? { failed: 1 } : { sent: 1, failed: 0 }) },
  })
  const response = await handler(new Request('https://backend.test/worker', { method: 'POST', headers: { 'x-latido-cron-secret': authorized ? 'test-secret' : 'invalid' }, ...(body ? {body: JSON.stringify(body)} : {}) }))
  return { status: response.status, body: await response.json(), mails, updates, pushes, claims }
}
let r = await run()
assert.equal(r.body.sent, 1)
assert.equal(r.mails[0].to, 'customer@example.test')
assert.equal(r.mails[0].html.includes('<img src=x'), false)
assert.ok(r.mails[0].html.includes('&lt;img'))
assert.ok(r.mails[0].text.includes('/seguimiento#token='))
assert.ok(r.mails[0].text.includes('respuesta=not_yet'))
assert.ok(r.mails[0].text.includes('respuesta=no'))
assert.ok(r.mails[0].html.includes('>En proceso</span>'))
assert.ok(r.mails[0].html.includes('>No</span>'))
assert.ok(r.mails[0].html.includes('Marta &amp; Co.'))
assert.equal(r.mails[0].subject, '¿Cómo fue tu consulta con Marta & Co.?')
assert.equal(/\{\{[a-z_]+\}\}/.test(r.mails[0].html), false, 'The supplied template must have no unresolved variables')
assert.ok(r.mails[0].html.includes('src="https://latido.test/icon-192.png"'))
assert.ok(!r.mails[0].html.includes('Ajustar avisos de correo'))
assert.equal(r.pushes[0].body.table, 'conversation_followups')
r = await run({ authorized: false }); assert.equal(r.status, 401); assert.equal(r.claims, 0)
r = await run({ enabled: false }); assert.equal(r.body.disabled, true); assert.equal(r.claims, 0)
const testBody = { test_email: 'latidoch@gmail.com', conversation_id: '11111111-1111-4111-8111-111111111111', test_app_url: 'http://127.0.0.1:5244' }
r = await run({ enabled: false, body: testBody, testAccount: true })
assert.equal(r.body.test, true); assert.equal(r.mails[0].to, 'latidoch@gmail.com'); assert.equal(r.claims, 0); assert.equal(r.pushes.length, 0); assert.equal(r.updates.length, 0)
assert.ok(r.mails[0].html.includes('http://127.0.0.1:5244/seguimiento#token='))
assert.ok(r.mails[0].html.includes('https://latido.test/icon-192.png'))
r = await run({ enabled: false, body: testBody }); assert.equal(r.status, 403); assert.equal(r.mails.length, 0); assert.equal(r.claims, 0)
r = await run({ enabled: false, body: { ...testBody, test_email: 'other@example.test' }, testAccount: true }); assert.equal(r.status, 400); assert.equal(r.mails.length, 0)
r = await run({ authorized: false, body: testBody, testAccount: true }); assert.equal(r.status, 401); assert.equal(r.mails.length, 0)
r = await run({ enabled: false, body: testBody, testAccount: true, smtpFailure: true }); assert.equal(r.status, 500); assert.equal(r.claims, 0)
r = await run({ smtpFailure: true }); assert.equal(r.body.retried, 1); assert.ok(r.updates.some(u => u.push_sent_at)); assert.ok(r.updates.some(u => u.delivery_status === 'pending'))
r = await run({ pushFailure: true }); assert.equal(r.mails.length, 1); assert.ok(r.updates.some(u => u.email_sent_at)); assert.equal(r.body.retried, 1)
r = await run({ emailAlreadySent: true }); assert.equal(r.mails.length, 0)
r = await run({ pushAlreadySent: true }); assert.equal(r.pushes.length, 0)
r = await run({ emailEnabled: false }); assert.equal(r.mails.length, 0); assert.equal(r.body.skipped, 1)
r = await run({ confirmed: false }); assert.equal(r.mails.length, 0)
r = await run({ unavailable: true }); assert.equal(r.mails.length, 0); assert.equal(r.pushes.length, 0); assert.equal(r.body.skipped, 1)

const endpointSource = (await readFile(new URL('../supabase/functions/conversation_followup_answer/index.ts', import.meta.url), 'utf8')).replace(/^import \{ createClient \} .*$/m, 'const createClient=globalThis.mockCreateClient;')
const endpoint = await build({ stdin: { contents: endpointSource, loader: 'ts' }, write: false, platform: 'node', format: 'iife', target: 'es2022' })
let handler, calls = []
vm.runInNewContext(endpoint.outputFiles[0].text, { mockCreateClient: () => ({ async rpc(name, args) { calls.push({ name, args }); return { data: { title: 'Consulta' } } } }), Deno: { env: { get() { return '' } }, serve(fn) { handler = fn } }, Response })
assert.equal((await handler(new Request('https://test/answer'))).status, 405)
assert.equal(calls.length, 0, 'Email scanner GETs never record an answer')
const request = body => new Request('https://test/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
assert.equal((await handler(request({ token: 'a'.repeat(64) }))).status, 200)
assert.equal(calls.at(-1).name, 'cf_email_context', 'A token without a selected answer only reads its context')
assert.equal((await handler(request({ token: 'a'.repeat(64), answer: 'not_yet' }))).status, 200)
assert.equal(calls.at(-1).name, 'cf_answer_email')
assert.equal((await handler(request({ token: 'a'.repeat(64), answer: 'no' }))).status, 200)
assert.equal(calls.at(-1).args.p_answer, 'no')
assert.equal((await handler(request({ token: 'a'.repeat(64), round: 2, action: 'reason', value: 'not_replied' }))).status, 200)
assert.equal(calls.at(-1).name, 'cf_email_change')
assert.equal(calls.at(-1).args.p_value, 'not_replied')
assert.equal((await handler(request({ token: 'a'.repeat(64), round: 2, action: 'reason', value: 'arbitrary' }))).status, 400)
assert.equal((await handler(request({ token: 'a'.repeat(64), round: 2, action: 'answer', value: 'not_yet' }))).status, 200)
assert.equal((await handler(request({ token: 'a'.repeat(64), action: 'dismiss' }))).status, 400)
assert.equal((await handler(request({ token: 'bad', answer: 'yes' }))).status, 400)
console.log('Followup email: three response links, disabled-by-default delivery, preferences, verified recipients, independent retries and POST validation passed.')

const pushSource = await readFile(new URL('../supabase/functions/latido_push_notification/index.ts', import.meta.url), 'utf8')
const pushHandler = pushSource.slice(pushSource.indexOf('async function handleConversationFollowup('), pushSource.indexOf('async function enrichPublicationRecord('))
const pushBundle = await build({ stdin: { contents: `${pushHandler}\nglobalThis.handler=handleConversationFollowup;`, loader: 'ts' }, write: false, platform: 'node', format: 'iife', target: 'es2022' })
async function testPush({ outcome = 'pending', round = 2, future = false, deleted = false, enabled = true } = {}) {
  const deliveries = []
  const context = {
    supabase: { from(table) { const q = { select() { return q }, eq() { return q }, async maybeSingle() { return { data: table === 'conversation_followups' ? { id: 'f', user_id: 'customer', conversation_id: 'c', round, outcome, due_at: new Date(Date.now() + (future ? 100000 : -100000)).toISOString() } : table === 'conversations' ? { sender_id: 'customer', deleted_by_sender: deleted } : { messages_enabled: enabled } } } }; return q } },
    text: value => String(value || ''),
    json: (_req, data) => Response.json(data),
    async fetchActiveSubscriptions(ids) { assert.deepEqual([...ids], ['customer']); return [{}] },
    async notifySubscriptions(subs, payload) { deliveries.push(payload); return { sent: 1 } },
    Response,
  }
  vm.runInNewContext(pushBundle.outputFiles[0].text, context)
  await context.handler(new Request('https://test/push'), { id: 'f', round: 2 })
  return deliveries
}
const pushes = await testPush()
assert.equal(pushes[0].title, '¿Cómo fue tu consulta?')
assert.equal(pushes[0].url, '/mensajes?conv=c')
for (const opts of [{ outcome: 'yes' }, { outcome: 'no' }, { round: 3 }, { future: true }, { deleted: true }, { enabled: false }]) assert.equal((await testPush(opts)).length, 0)
console.log('Followup push: private recipient, direct conversation link, round checks, due date, deletion and notification preferences passed.')
