import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { build } from 'esbuild'

const entry = new URL('../supabase/functions/latido_card_business_invitation_email/index.ts', import.meta.url)
const source = (await readFile(entry, 'utf8'))
  .replace(/^import \{ createClient \} .*$/m, 'const createClient = globalThis.mockCreateClient')
  .replace(/^import nodemailer .*$/m, 'const nodemailer = globalThis.mockNodemailer')
const bundle = await build({ stdin: { contents: source, loader: 'ts', resolveDir: fileURLToPath(new URL('.', entry)) }, bundle: true, write: false, platform: 'node', format: 'iife', target: 'es2022' })
async function endpoint({ smtpFailure = false, accepted = true, testMode = true, eligible = true, enabled = true, confirmed = true, status = 'processing' } = {}) {
  let handler
  let claimed = false
  const mails = [], calls = []
  const profiles = {
    'jose13hue@gmail.com': { id: 'owner-jose', name: 'Jose' },
    'play4slim1.2@gmail.com': { id: 'owner-play', name: 'Jose Play' },
  }
  const service = {
    async rpc(name) {
      if (testMode) throw new Error(`Mass campaign RPC must never run: ${name}`)
      calls.push({ rpc: name })
      if (name === 'lc_queue_business_invitations') return { data: 1, error: null }
      if (name === 'lc_claim_business_invitations') {
        const data = claimed ? [] : [{ user_id: 'real-owner', provider_id: 'real-business', unsubscribe_token: '11111111-1111-4111-8111-111111111111' }]
        claimed = true
        return { data, error: null }
      }
      if (name === 'lc_invitation_email_enabled') return { data: enabled, error: null }
      throw new Error(`Unexpected RPC: ${name}`)
    },
    auth: { admin: { async getUserById() { return { data: { user: { email: 'owner@example.com', email_confirmed_at: confirmed ? '2026-01-01' : null } }, error: null } } } },
    from(table) {
      const filters = {}
      const call = { table, filters }
      calls.push(call)
      return {
        select() { return this }, ilike(key, value) { filters[key] = value; return this },
        eq(key, value) { filters[key] = value; return this }, is(key, value) { filters[key] = value; return this },
        order() { return this }, limit() { return this },
        update(value) { call.update = value; return this },
        async single() { return { data: { status }, error: null } },
        then(resolve, reject) { return Promise.resolve({ data: null, error: null, count: 1 }).then(resolve, reject) },
        async maybeSingle() {
          if (table === 'lc_business_invitation_targets') return { data: eligible ? { provider_id: 'real-business', name: 'Real business' } : null, error: null }
          if (table === 'profiles') return { data: profiles[filters.email] || null, error: null }
          if (table === 'providers') {
            assert.equal(filters.active, true)
            assert.equal(filters.deleted_at, null)
            return { data: filters.user_id === 'owner-jose' ? { id: '11111111-1111-4111-8111-111111111111' } : null, error: null }
          }
          throw new Error(`Unexpected table: ${table}`)
        },
      }
    },
  }
  const env = { SUPABASE_URL: 'https://mock.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'fake', LATIDO_CARD_INVITATION_SECRET: 'private-test-secret', SMTP_USERNAME: 'test@example.com', SMTP_PASSWORD: 'fake', LATIDO_APP_URL: 'https://www.latido.ch' }
  if (!testMode) env.LATIDO_CARD_INVITATION_TEST_MODE = 'false'
  vm.runInNewContext(bundle.outputFiles[0].text, {
    Request, Response, URL, console,
    Deno: { env: { get: key => env[key] }, serve: callback => { handler = callback } },
    mockCreateClient: () => service,
    mockNodemailer: { createTransport: () => ({ sendMail(mail, callback) {
      mails.push(mail)
      callback(smtpFailure ? new Error('Mock SMTP failure') : null, { accepted: accepted ? [mail.to] : [], messageId: `mock-${mails.length}` })
    } }) },
  })
  const request = async (body, secret = 'private-test-secret') => {
    const result = await handler(new Request('https://mock.supabase.co/functions/v1/latido_card_business_invitation_email', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-latido-cron-secret': secret }, body: JSON.stringify(body),
    }))
    return { status: result.status, data: await result.json() }
  }
  return { request, mails, calls }
}
const app = await endpoint()
assert.equal((await app.request({ action: 'send' }, 'wrong')).status, 401)
assert.equal(app.mails.length, 0)
assert.equal((await app.request({})).data.test_mode, true)
assert.equal(app.mails.length, 0)
assert.equal((await app.request({ action: 'queue' })).status, 403)
for (const email of ['someone@example.com', 'Other <jose13hue@gmail.com>', 'jose13hue@gmail.com,other@example.com']) {
  assert.equal((await app.request({ test_email: email })).status, 403)
}
assert.equal(app.calls.length, 0)
const result = await app.request({ action: 'send', test_mode: false, recipients: ['someone@example.com'] })
assert.equal(result.data.sent, 2)
assert.equal(result.data.failed, 0)
assert.deepEqual(app.mails.map(mail => mail.to), ['jose13hue@gmail.com', 'play4slim1.2@gmail.com'])
assert.equal(result.data.deliveries[0].provider_id, '11111111-1111-4111-8111-111111111111')
assert.equal(result.data.deliveries[1].provider_id, null)
for (const mail of app.mails) {
  assert.match(mail.subject, /^\[PRUEBA\]/)
  assert.equal(mail.html.includes('{{URL_CREAR_OFERTA}}'), false)
  assert.equal(mail.html.includes('data:image/'), false)
  assert.match(mail.html.replace(/<[^>]*>/g, ''), /¡Haz crecer tu negocio con Latido!/)
  assert.equal(mail.attachments.length, 2)
  assert.equal(mail.cc, undefined)
  assert.equal(mail.bcc, undefined)
  for (const image of mail.attachments) {
    assert.ok(mail.html.includes(`cid:${image.cid}`))
    assert.equal(Buffer.from(image.content, 'base64').subarray(1, 4).toString(), 'PNG')
  }
}
assert.match(app.mails[0].html, /negocio=11111111-1111-4111-8111-111111111111&amp;crear=1/)
assert.match(app.mails[1].text, /Crear oferta gratis: https:\/\/www.latido.ch\/card\/negocios\n/)
const single = await endpoint()
assert.equal((await single.request({ test_email: 'JOSE13HUE@gmail.com' })).data.sent, 1)
assert.equal(single.mails.length, 1)
for (const options of [{ smtpFailure: true }, { accepted: false }]) {
  const failed = await endpoint(options)
  const response = await failed.request({ action: 'send' })
  assert.equal(response.data.sent, 0)
  assert.equal(response.data.failed, 2)
  assert.equal(failed.mails.length, 2, 'No automatic delivery retries')
}
const live = await endpoint({ testMode: false })
assert.equal((await live.request({})).data.reminder_days, 20)
assert.equal(live.mails.length, 0, 'Preview never sends')
assert.equal((await live.request({ test_email: 'other@example.com' })).status, 403)
assert.equal((await live.request({ action: 'run' })).data.sent, 1)
const campaignMail = live.mails[0]
assert.equal(campaignMail.to, 'owner@example.com')
assert.equal(campaignMail.subject.startsWith('[PRUEBA]'), false)
assert.match(campaignMail.html, /negocio=real-business&amp;crear=1/)
assert.match(campaignMail.html, /No recibir m/)
assert.ok(campaignMail.headers['List-Unsubscribe'])
assert.ok(live.calls.find(call => call.update?.status === 'sent' && call.filters.status === 'processing'))
assert.deepEqual(live.calls.filter(call => call.rpc).map(call => call.rpc), ['lc_queue_business_invitations', 'lc_claim_business_invitations', 'lc_invitation_email_enabled', 'lc_claim_business_invitations'])
for (const options of [{ eligible: false }, { enabled: false }, { confirmed: false }, { status: 'suppressed' }]) {
  const suppressed = await endpoint({ testMode: false, ...options })
  assert.equal((await suppressed.request({ action: 'run' })).data.suppressed, 1)
  assert.equal(suppressed.mails.length, 0, 'Re-check eligibility, preferences, verified email and opt-out before SMTP')
}
const uncertain = await endpoint({ testMode: false, smtpFailure: true })
assert.equal((await uncertain.request({ action: 'run' })).data.failed, 1)
assert.ok(uncertain.calls.find(call => call.update?.status === 'failed'))
assert.equal(uncertain.mails.length, 1)
console.log('Invitation email: preview, test allowlist, campaign, preferences, opt-out, personal links, CID images and SMTP failures passed; no real mail sent')
