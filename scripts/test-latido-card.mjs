import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import {
  extractCardToken,
  classifyLatidoQr,
  readScannerSession,
  storeScannerSession,
  SCANNER_STORAGE_KEY
} from '../src/lib/latidoCardCore.js'
import { buildPhysicalCardEmail } from '../supabase/functions/_shared/latidoCardPhysicalEmail.js'
import { cardOfferShareData, shareCardOffer } from '../src/lib/latidoCardShare.js'

const sharedExample = {
  id: randomUUID(),
  title: 'Café gratis',
  business_name: 'Café Latino',
  benefit_type: 'gift',
  token: 'private-token',
  claim: { id: 'private-reservation' }
}
const shareData = cardOfferShareData(sharedExample, 'https://latido.ch')
assert.equal(new URL(shareData.url).pathname, '/card')
assert.equal(new URL(shareData.url).searchParams.get('oferta'), sharedExample.id)
assert.ok(!JSON.stringify(shareData).includes('private-'))
let nativeShare, copiedShare
assert.equal(
  (
    await shareCardOffer(
      sharedExample,
      {
        share: async (data) => {
          nativeShare = data
        }
      },
      'https://latido.ch'
    )
  ).status,
  'shared'
)
assert.deepEqual(nativeShare, shareData)
assert.equal(
  (
    await shareCardOffer(
      sharedExample,
      {
        share: async () => {
          throw Object.assign(new Error('Cancelled'), { name: 'AbortError' })
        },
        clipboard: {
          writeText: async () => {
            throw new Error('Must not copy after cancel')
          }
        }
      },
      'https://latido.ch'
    )
  ).status,
  'cancelled'
)
assert.equal(
  (
    await shareCardOffer(
      sharedExample,
      {
        share: async () => {
          throw new Error('Unavailable')
        },
        clipboard: {
          writeText: async (text) => {
            copiedShare = text
          }
        }
      },
      'https://latido.ch'
    )
  ).status,
  'copied'
)
assert.ok(copiedShare.endsWith(shareData.url))
assert.equal(
  (
    await shareCardOffer(
      sharedExample,
      {
        clipboard: {
          writeText: async () => {
            throw new Error('Permission denied')
          }
        }
      },
      'https://latido.ch'
    )
  ).status,
  'manual'
)

const token = 'a'.repeat(64)
assert.equal(extractCardToken(`https://latido.ch/c/${token}`), token)
assert.equal(extractCardToken(`https://evil.test/c/${token}`), null)
assert.equal(extractCardToken(`javascript:alert(1)`), null)
assert.equal(extractCardToken(`https://latido.ch/scanner/link/${token}`), null)
assert.equal(extractCardToken(`https://latido.ch/scanner/link/${token}`, 'scanner'), token)
assert.equal(extractCardToken('LC-000001'), null)
assert.deepEqual(classifyLatidoQr(`https://latido.ch/c/${token}`), {
  kind: 'card',
  token
})
assert.deepEqual(classifyLatidoQr(`https://latido.ch/scanner/link/${token}`), {
  kind: 'scanner',
  token
})
assert.equal(classifyLatidoQr(token), null, 'A bare token must not be guessed as a business QR')
assert.equal(classifyLatidoQr(`https://evil.test/scanner/link/${token}`), null)
assert.equal(classifyLatidoQr(`javascript:alert(1)`), null)
assert.equal(classifyLatidoQr(`https://latido.ch/card?oferta=${token}`), null)
const fake = () => ({
  values: new Map(),
  getItem(k) {
    return this.values.get(k) || null
  },
  setItem(k, v) {
    this.values.set(k, v)
  },
  removeItem(k) {
    this.values.delete(k)
  }
})
const local = fake(),
  temporary = fake()
storeScannerSession(
  {
    token,
    persistent: false,
    expires_at: new Date(Date.now() + 10000).toISOString()
  },
  { local, temporary }
)
assert.equal(local.getItem(SCANNER_STORAGE_KEY), null)
assert.equal(readScannerSession({ local, temporary }).token, token)
storeScannerSession({ token, persistent: true, expires_at: null }, { local, temporary })
assert.equal(temporary.getItem(SCANNER_STORAGE_KEY), null)
assert.equal(readScannerSession({ local, temporary }).persistent, true)
temporary.setItem(SCANNER_STORAGE_KEY, 'not-json')
assert.equal(readScannerSession({ local, temporary }).token, token)

const db = new PGlite()
const ids = {
  admin: randomUUID(),
  owner: randomUUID(),
  owner2: randomUUID(),
  member: randomUUID(),
  member2: randomUUID(),
  outsider: randomUUID(),
  business: randomUUID(),
  business2: randomUUID()
}
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
CREATE TABLE public.profiles(id uuid primary key,name text,email text);
CREATE TABLE public.providers(id uuid primary key,user_id uuid references profiles(id),name text,city text);
CREATE TABLE public.business_promotion_admins(email text primary key);
CREATE FUNCTION public.is_business_promotion_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
 SELECT EXISTS(SELECT 1 FROM public.business_promotion_admins WHERE email=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'email')) $$;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;`)
for (const [key, id] of Object.entries(ids).filter(([key]) => !key.startsWith('business'))) {
  await db.query('INSERT INTO profiles VALUES($1,$2,$3)', [id, key, `${key}@latido.test`])
}
await db.query('INSERT INTO business_promotion_admins VALUES($1)', ['admin@latido.test'])
await db.query('INSERT INTO providers VALUES($1,$2,$3,$4),($5,$6,$7,$8)', [
  ids.business,
  ids.owner,
  'Restaurante A',
  'Zürich',
  ids.business2,
  ids.owner2,
  'Café B',
  'Luzern'
])
const migration = await readFile(new URL('../supabase/latido_card.sql', import.meta.url), 'utf8')
await db.exec(migration)
await db.exec(migration) // Rerunning must not erase credentials or fail on objects.
const notificationsSchema = (
  await readFile(new URL('../supabase/app_notifications.sql', import.meta.url), 'utf8')
).split('-- One interaction creates')[0]
await db.exec(notificationsSchema)
const physicalMigration = await readFile(
  new URL('../supabase/latido_card_physical_requests.sql', import.meta.url),
  'utf8'
)
await db.exec(physicalMigration)
await db.exec(physicalMigration)
await db.exec('ALTER TABLE public.providers ADD COLUMN photo_url text')
const selfServiceMigration = await readFile(
  new URL('../supabase/latido_card_self_service.sql', import.meta.url),
  'utf8'
)
await db.exec(selfServiceMigration)
await db.exec(selfServiceMigration)
async function as(key, role = 'authenticated') {
  await db.exec(`RESET ROLE; SET ROLE ${role};`)
  await db.query("SELECT set_config('request.jwt.claims',$1,false)", [
    JSON.stringify(key ? { sub: ids[key], email: `${key}@latido.test` } : {})
  ])
}
async function root(sql, params = []) {
  await db.exec('RESET ROLE')
  return db.query(sql, params)
}
async function rpc(name, args = []) {
  const params = args.map((_, i) => `$${i + 1}`).join(',')
  if (name === 'lc_claim_physical_emails')
    return (
      await db.query(
        `SELECT coalesce(jsonb_agg(row),'[]'::jsonb) AS result FROM public.${name}(${params}) row`,
        args
      )
    ).rows[0].result
  return (await db.query(`SELECT public.${name}(${params}) AS result`, args)).rows[0].result
}
async function rejects(name, args, code) {
  await assert.rejects(() => rpc(name, args), new RegExp(code))
}
try {
  await as('outsider')
  await rejects(
    'lc_admin_enroll',
    [ids.member, new Date(Date.now() + 86400000), 'active'],
    'FORBIDDEN'
  )
  await assert.rejects(
    () => db.query('SELECT * FROM public.latido_card_memberships'),
    /permission denied/
  )
  await as(null, 'anon')
  await assert.rejects(() => rpc('lc_new_token'), /permission denied/)
  await assert.rejects(() => rpc('lc_member_home'), /permission denied/)
  await assert.rejects(() => rpc('lc_card_member', [token]), /permission denied/)
  await as('admin')
  const validUntil = new Date(Date.now() + 90 * 86400000).toISOString()
  const mid = await rpc('lc_admin_enroll', [ids.member, validUntil, 'active'])
  await rpc('lc_admin_enroll', [ids.member2, validUntil, 'active'])
  await rpc('lc_admin_business', [ids.business, true])
  await rpc('lc_admin_business', [ids.business2, true])
  const physical = await rpc('lc_admin_physical_card', [ids.member])
  const physical2 = await rpc('lc_admin_physical_card', [ids.member2])
  await as('owner')
  const offer = {
    title: '15 % desde CHF 50',
    description: 'No acumulable',
    benefit_type: 'percent',
    benefit_value: 15,
    minimum_spend: 50,
    usage_period: 'month',
    usage_limit: 1,
    ends_at: validUntil
  }
  const oid = await rpc('lc_save_offer', [ids.business, offer])
  await rejects('lc_save_offer', [ids.business, offer], 'OFFER_CAPACITY')
  await rejects('lc_save_offer', [ids.business2, offer], 'FORBIDDEN')
  await rejects('lc_business_dashboard', [ids.business2], 'FORBIDDEN')
  const special = await rpc('lc_save_offer', [
    ids.business,
    {
      ...offer,
      title: 'Café gratis',
      requires_claim: true,
      stock_total: 1,
      benefit_type: 'gift',
      benefit_value: null,
      usage_period: 'lifetime'
    }
  ])
  const link = await rpc('lc_rotate_scanner_link', [ids.business])
  await as(null, 'anon')
  const session = await rpc('lc_open_scanner', [link.token, 'Caja 1'])
  const session2 = await rpc('lc_open_scanner', [link.token, 'Caja 2'])
  const status = await rpc('lc_scanner_status', [session.token, true])
  assert.equal(status.persistent, false)
  await as('owner')
  await rpc('lc_manage_scanner', [session.session_id, 'approve'])
  await as(null, 'anon')
  assert.equal((await rpc('lc_scanner_status', [session.token, false])).persistent, true)
  const scan = await rpc('lc_scan_card', [session.token, physical.token])
  assert.equal(scan.offers.length, 1)
  assert.equal(scan.offers[0].id, oid)
  assert.equal(scan.member_name, 'member')
  assert.equal(scan.email, undefined)
  await as('member')
  const digital = await rpc('lc_issue_digital_card')
  const digital2 = await rpc('lc_issue_digital_card')
  await rpc('lc_claim_offer', [special])
  await rpc('lc_claim_offer', [special])
  await as('member2')
  await rejects('lc_claim_offer', [special], 'OFFER_SOLD_OUT')
  await as('member')
  await rpc('lc_release_claim', [special])
  await as('member2')
  await rpc('lc_claim_offer', [special])
  await rpc('lc_release_claim', [special])
  await as('member')
  await rpc('lc_claim_offer', [special])
  await as(null, 'anon')
  assert.equal((await rpc('lc_scan_card', [session.token, physical.token])).offers.length, 2)
  await rejects('lc_scan_card', [session.token, digital.token], 'CARD_INVALID')
  assert.equal(
    (await rpc('lc_scan_card', [session.token, digital2.token])).member_number,
    physical.member_number
  )
  const req = randomUUID(),
    receipt = await rpc('lc_redeem', [session.token, physical.token, oid, req])
  assert.equal((await rpc('lc_redeem', [session.token, physical.token, oid, req])).id, receipt.id)
  await rejects(
    'lc_redeem',
    [session2.token, physical.token, oid, randomUUID()],
    'OFFER_UNAVAILABLE'
  )
  await rejects('lc_redeem', [session.token, token, oid, req], 'REQUEST_CONFLICT')
  await rejects('lc_redeem', [session.token, physical2.token, oid, req], 'REQUEST_CONFLICT')
  await rpc('lc_redeem', [session.token, physical.token, special, randomUUID()])
  await as('member')
  await rejects('lc_claim_offer', [special], 'OFFER_USED')
  assert.equal((await rpc('lc_member_home')).history.length, 2)
  await as('outsider')
  await rejects('lc_reverse_redemption', [receipt.id, 'Error de caja'], 'FORBIDDEN')
  await as('owner')
  await rpc('lc_reverse_redemption', [receipt.id, 'Error de caja'])
  await rpc('lc_reverse_redemption', [receipt.id, 'Segundo intento'])
  await as(null, 'anon')
  const next = await rpc('lc_redeem', [session.token, physical.token, oid, randomUUID()])
  await root(
    "UPDATE latido_card_redemptions SET redeemed_at=(date_trunc('month',now() AT TIME ZONE 'Europe/Zurich') AT TIME ZONE 'Europe/Zurich')-interval '1 second' WHERE id=$1",
    [next.id]
  )
  await as(null, 'anon')
  await rpc('lc_redeem', [session.token, physical.token, oid, randomUUID()])
  await root(
    "UPDATE latido_card_credentials SET expires_at=now()-interval '1 second' WHERE token_hash=public.lc_hash($1)",
    [digital2.token]
  )
  await as(null, 'anon')
  await rejects('lc_scan_card', [session.token, digital2.token], 'CARD_INVALID')
  await as('member')
  await rpc('lc_report_lost_card')
  const replacementDigital = await rpc('lc_issue_digital_card')
  await as(null, 'anon')
  await rejects('lc_scan_card', [session.token, physical.token], 'CARD_INVALID')
  assert.equal(
    (await rpc('lc_scan_card', [session.token, replacementDigital.token])).member_number,
    physical.member_number
  )
  // Lost/expired card may still retrieve its own already-committed receipt.
  assert.equal((await rpc('lc_redeem', [session.token, physical.token, oid, req])).reversed, true)
  await as('admin')
  await rpc('lc_admin_enroll', [ids.member, validUntil, 'paused'])
  await as(null, 'anon')
  await rejects('lc_scan_card', [session.token, replacementDigital.token], 'MEMBERSHIP_INACTIVE')
  await as('admin')
  await rpc('lc_admin_enroll', [ids.member, validUntil, 'active'])
  await as('owner2')
  const foreignOffer = await rpc('lc_save_offer', [ids.business2, offer])
  await as(null, 'anon')
  await rejects(
    'lc_redeem',
    [session.token, replacementDigital.token, foreignOffer, randomUUID()],
    'OFFER_UNAVAILABLE'
  )
  await root(
    "UPDATE latido_card_scanner_sessions SET expires_at=now()-interval '1 second' WHERE id=$1",
    [session2.session_id]
  )
  await as(null, 'anon')
  await rejects('lc_scanner_status', [session2.token, false], 'SCANNER_EXPIRED')
  await as('owner')
  await rpc('lc_rotate_scanner_link', [ids.business])
  await as(null, 'anon')
  await rejects('lc_open_scanner', [link.token, 'Intruso'], 'SCANNER_LINK_INVALID')
  await rejects('lc_scanner_status', [session.token, false], 'SCANNER_EXPIRED')
  await as('owner')
  const stockOffer = await rpc('lc_save_offer', [
    ids.business,
    {
      ...offer,
      title: 'Último postre',
      requires_claim: true,
      stock_total: 1,
      benefit_type: 'gift',
      benefit_value: null,
      usage_period: 'lifetime'
    }
  ])
  await as('member')
  await rpc('lc_claim_offer', [stockOffer])
  await root(
    "UPDATE latido_card_claims SET expires_at=now()-interval '1 second' WHERE offer_id=$1",
    [stockOffer]
  )
  await as('member2')
  await rpc('lc_claim_offer', [stockOffer])
  await as('member')
  await rejects('lc_claim_offer', [stockOffer], 'OFFER_SOLD_OUT')
  await as('owner')
  await rpc('lc_set_offer_active', [oid, false])
  const unlimited = await rpc('lc_save_offer', [
    ids.business,
    {
      ...offer,
      title: '10 % siempre',
      usage_period: 'unlimited',
      benefit_value: 10
    }
  ])
  const freshLink = await rpc('lc_rotate_scanner_link', [ids.business])
  await as(null, 'anon')
  const freshSession = await rpc('lc_open_scanner', [freshLink.token, 'Caja nueva'])
  await rpc('lc_redeem', [freshSession.token, replacementDigital.token, unlimited, randomUUID()])
  await rpc('lc_redeem', [freshSession.token, replacementDigital.token, unlimited, randomUUID()])
  await rpc('lc_close_scanner', [freshSession.token])
  await rejects('lc_scanner_status', [freshSession.token, false], 'SCANNER_EXPIRED')
  // Physical requests belong to Latido administration, never to a merchant.
  await as('owner')
  await rejects('lc_admin_physical_queue', ['open'], 'FORBIDDEN')
  await assert.rejects(
    () => db.query('SELECT * FROM latido_card_physical_requests'),
    /permission denied/
  )
  await as(null, 'anon')
  await assert.rejects(() => rpc('lc_member_physical_requests'), /permission denied/)
  await as('member')
  const details = {
    fulfillment: 'shipping',
    recipient_name: 'José Prueba',
    address_line1: 'Calle Prueba 10',
    address_line2: '2.º',
    postal_code: '6004',
    city: 'Luzern'
  }
  await rejects(
    'lc_request_physical_card',
    [randomUUID(), { ...details, postal_code: 'bad' }, 'replacement'],
    'PHYSICAL_DETAILS_INVALID'
  )
  await rejects(
    'lc_request_physical_card',
    [randomUUID(), details, 'initial'],
    'PHYSICAL_REQUEST_KIND_INVALID'
  )
  const physicalRequestId = randomUUID()
  const request = await rpc('lc_request_physical_card', [physicalRequestId, details, 'replacement'])
  assert.equal(request.status, 'requested')
  assert.ok(request.reference.startsWith('LCP-'))
  assert.equal(
    (await rpc('lc_request_physical_card', [physicalRequestId, details, 'replacement'])).id,
    request.id
  )
  await rejects(
    'lc_request_physical_card',
    [randomUUID(), details, 'replacement'],
    'PHYSICAL_REQUEST_ALREADY_OPEN'
  )
  assert.equal((await rpc('lc_member_physical_requests')).requests.length, 1)
  assert.equal((await rpc('lc_member_physical_requests')).requests[0].internal_note, undefined)
  await as('member2')
  assert.equal((await rpc('lc_member_physical_requests')).requests.length, 0)
  await rejects('lc_cancel_physical_request', [request.id], 'FORBIDDEN')
  await rejects(
    'lc_request_physical_card',
    [physicalRequestId, details, 'replacement'],
    'REQUEST_CONFLICT'
  )
  await as('admin')
  const inbox = await rpc('lc_admin_physical_queue', ['open'])
  assert.equal(inbox[0].recipient_name, 'José Prueba')
  assert.equal(inbox[0].emails.length, 2)
  assert.equal((await rpc('lc_admin_overview', ['member'])).stats.pending_requests, 1)
  await rejects(
    'lc_admin_update_physical_request',
    [request.id, 1, 'shipped', '', '', ''],
    'PHYSICAL_STATUS_INVALID'
  )
  await rpc('lc_admin_update_physical_request', [
    request.id,
    1,
    'approved',
    'Prepararemos tu tarjeta.',
    'Nota privada de Latido',
    ''
  ])
  await rejects(
    'lc_admin_update_physical_request',
    [request.id, 1, 'approved', '', '', ''],
    'PHYSICAL_REQUEST_CHANGED'
  )
  const printed = await rpc('lc_admin_issue_request_card', [request.id, 2, false])
  assert.equal(printed.reference, request.reference)
  await rejects(
    'lc_admin_issue_request_card',
    [request.id, 3, false],
    'PHYSICAL_CARD_ALREADY_ISSUED'
  )
  const reprinted = await rpc('lc_admin_issue_request_card', [request.id, 3, true])
  assert.notEqual(reprinted.token, printed.token)
  await as('member')
  await rejects('lc_cancel_physical_request', [request.id], 'PHYSICAL_REQUEST_IN_PROGRESS')
  assert.equal((await rpc('lc_member_physical_requests')).requests[0].internal_note, undefined)
  await as('admin')
  await rpc('lc_admin_update_physical_request', [
    request.id,
    4,
    'ready',
    'Lista para envío.',
    'Nota interna',
    ''
  ])
  await rpc('lc_admin_update_physical_request', [
    request.id,
    5,
    'shipped',
    'En camino.',
    'Nota interna',
    'https://post.example/track/test'
  ])
  await rpc('lc_admin_update_physical_request', [
    request.id,
    6,
    'delivered',
    'Entregada.',
    'Nota interna',
    'https://post.example/track/test'
  ])
  const completed = (await rpc('lc_admin_physical_queue', ['delivered']))[0]
  assert.equal(completed.events.length, 7)
  await as('member')
  const nextRequest = await rpc('lc_request_physical_card', [
    randomUUID(),
    {
      fulfillment: 'pickup',
      recipient_name: 'José Prueba',
      address_line1: 'Must not persist'
    },
    'replacement'
  ])
  assert.equal(nextRequest.address_line1, '')
  await rpc('lc_cancel_physical_request', [nextRequest.id])
  const lostShipment = await rpc('lc_request_physical_card', [randomUUID(), details, 'replacement'])
  await as('admin')
  await rpc('lc_admin_update_physical_request', [lostShipment.id, 1, 'approved', '', '', ''])
  await rpc('lc_admin_issue_request_card', [lostShipment.id, 2, false])
  await rpc('lc_admin_update_physical_request', [lostShipment.id, 3, 'ready', '', '', ''])
  await rpc('lc_admin_update_physical_request', [lostShipment.id, 4, 'shipped', '', '', ''])
  await as('member')
  await rpc('lc_report_lost_card')
  await as('admin')
  await rejects(
    'lc_admin_update_physical_request',
    [lostShipment.id, 5, 'delivered', '', '', ''],
    'PHYSICAL_CARD_INVALID'
  )
  await rpc('lc_admin_update_physical_request', [
    lostShipment.id,
    5,
    'cancelled',
    'Envío perdido; solicita reposición.',
    '',
    ''
  ])
  await as('member')
  await rpc('lc_request_physical_card', [randomUUID(), details, 'replacement'])
  await as('owner')
  await assert.rejects(() => rpc('lc_claim_physical_emails', [20]), /permission denied/)
  await as(null, 'service_role')
  const mailJobs = await rpc('lc_claim_physical_emails', [50])
  assert.ok(mailJobs.length > 2)
  assert.equal((await rpc('lc_claim_physical_emails', [50])).length, 0)
  const job = mailJobs[0]
  assert.equal(await rpc('lc_finish_physical_email', [job.id, randomUUID(), true, '']), false)
  assert.equal(
    await rpc('lc_finish_physical_email', [job.id, job.lease_id, false, 'SMTP_FAILED']),
    true
  )
  const sent = mailJobs[1]
  assert.equal(await rpc('lc_finish_physical_email', [sent.id, sent.lease_id, true, '']), true)
  const email = buildPhysicalCardEmail({
    ...job,
    payload: {
      ...job.payload,
      reference: '<script>Bad</script>',
      address_line1: 'secret address',
      token: 'secret token',
      internal_note: 'secret note'
    }
  })
  assert.ok(!email.html.includes('<script>'))
  assert.ok(email.html.includes('&lt;script&gt;'))
  assert.ok(!email.text.includes('secret address'))
  assert.ok(!email.text.includes('secret token'))
  assert.ok(!email.text.includes('secret note'))
  await root(
    "UPDATE latido_card_physical_email_queue SET attempts=8,status='sending',lease_until=now()-interval '1 minute' WHERE id=$1",
    [job.id]
  )
  await as(null, 'service_role')
  await rpc('lc_claim_physical_emails', [50])
  await as('admin')
  await rpc('lc_admin_retry_physical_email', [job.id])
  assert.ok((await rpc('lc_admin_overview', [''])).stats.email_pending > 0)
  const administrativeAudit = (await rpc('lc_admin_overview', [''])).audit
  assert.ok(administrativeAudit.some((row) => row.actor_id === ids.admin))
  assert.ok(administrativeAudit.every((row) => !('token_hash' in row.metadata)))
  await root('SELECT 1')
  await assert.rejects(
    () => db.query("UPDATE latido_card_offers SET title='Cambio' WHERE id=$1", [oid]),
    /OFFER_TERMS_LOCKED/
  )
  await assert.rejects(
    () =>
      db.query(
        "INSERT INTO latido_card_offers(provider_id,title,benefit_type,benefit_value,ends_at) VALUES($1,'Inválida','percent',NULL,now()+interval '1 day')",
        [ids.business]
      ),
    /check constraint/
  )
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::integer AS n FROM latido_card_redemptions WHERE request_id=$1',
        [req]
      )
    ).rows[0].n,
    1
  )
  // Owner starts without membership or administrator admission. Cached and new
  // automatic QR links never disconnect workers; suspension cannot be bypassed.
  const openBusiness = randomUUID()
  await root('INSERT INTO providers(id,user_id,name,city) VALUES($1,$2,$3,$4)', [
    openBusiness,
    ids.owner2,
    'Negocio libre',
    'Bern'
  ])
  await as('outsider')
  await rejects('lc_business_setup', [openBusiness, null], 'FORBIDDEN')
  await as('owner2')
  assert.equal((await rpc('lc_member_home')).membership, null)
  const automaticLink = await rpc('lc_business_setup', [openBusiness, null])
  assert.equal(
    (await rpc('lc_business_setup', [openBusiness, automaticLink.token])).token,
    automaticLink.token
  )
  const freeOffer = await rpc('lc_save_offer', [
    openBusiness,
    { ...offer, title: 'Oferta sin aprobación' }
  ])
  await as(null, 'anon')
  await rejects('lc_business_setup', [openBusiness, null], 'permission denied')
  const workerBeforeReload = await rpc('lc_open_scanner', [automaticLink.token, 'Caja libre'])
  await as('owner2')
  const anotherBrowserLink = await rpc('lc_business_setup', [openBusiness, null])
  assert.notEqual(anotherBrowserLink.token, automaticLink.token)
  await as(null, 'anon')
  assert.equal(
    (await rpc('lc_scanner_status', [workerBeforeReload.token, false])).session_id,
    workerBeforeReload.session_id
  )
  await rpc('lc_open_scanner', [automaticLink.token, 'QR impreso aún válido'])
  await rejects('lc_save_favorite', [freeOffer, true], 'permission denied')
  await as('member')
  await rpc('lc_save_favorite', [freeOffer, true])
  await rpc('lc_save_favorite', [freeOffer, true])
  assert.deepEqual((await rpc('lc_member_home')).saved_offers, [freeOffer])
  await assert.rejects(
    () => db.query('SELECT * FROM latido_card_saved_offers'),
    /permission denied/
  )
  await as('member2')
  assert.deepEqual((await rpc('lc_member_home')).saved_offers, [])
  await rpc('lc_save_favorite', [freeOffer, false])
  await as('member')
  assert.deepEqual((await rpc('lc_member_home')).saved_offers, [freeOffer])
  await rpc('lc_save_favorite', [freeOffer, false])
  assert.deepEqual((await rpc('lc_member_home')).saved_offers, [])
  await as('admin')
  await rpc('lc_admin_business', [openBusiness, false])
  await as('owner2')
  await rejects('lc_business_setup', [openBusiness, anotherBrowserLink.token], 'BUSINESS_SUSPENDED')
  await rejects(
    'lc_save_offer',
    [openBusiness, { ...offer, title: 'No permitido' }],
    'BUSINESS_INACTIVE'
  )
  await as(null, 'anon')
  await rejects('lc_scanner_status', [workerBeforeReload.token, false], 'SCANNER_EXPIRED')
  await rejects('lc_open_scanner', [automaticLink.token, 'Bloqueado'], 'SCANNER_LINK_INVALID')
  assert.ok(!(await rpc('lc_catalog')).some((o) => o.id === freeOffer))
  await as('admin')
  await rpc('lc_admin_business', [openBusiness, true])
  await as('owner2')
  assert.notEqual(
    (await rpc('lc_business_setup', [openBusiness, automaticLink.token])).token,
    automaticLink.token
  )

  // Execute the exact optional Supabase examples, not a separate test seed.
  await root('SELECT 1')
  await db.exec(`CREATE TABLE auth.users(id uuid primary key,email text);
    ALTER TABLE public.providers ADD COLUMN category text;
    ALTER TABLE public.providers ADD COLUMN canton text;
    ALTER TABLE public.providers ADD COLUMN description text;
    ALTER TABLE public.providers ADD COLUMN active boolean DEFAULT false;`)
  const demoSql = await readFile(
    new URL('../supabase/latido_card_test_examples.sql', import.meta.url),
    'utf8'
  )
  await assert.rejects(() => db.exec(demoSql), /Faltan cuentas Auth/)
  await db.exec('ROLLBACK')
  for (const key of ['card.socio', 'card.inactivo', 'card.negocio']) {
    ids[key] = randomUUID()
    await db.query('INSERT INTO auth.users VALUES($1,$2)', [ids[key], `${key}@latido.test`])
    await db.query('INSERT INTO profiles VALUES($1,$2,$3)', [ids[key], key, `${key}@latido.test`])
  }
  const jobsBeforeDemo = (
    await db.query('SELECT count(*)::int AS n FROM latido_card_physical_email_queue')
  ).rows[0].n
  await db.exec(demoSql)
  await db.exec(demoSql)
  assert.equal(
    (await db.query('SELECT count(*)::int AS n FROM latido_card_physical_email_queue')).rows[0].n,
    jobsBeforeDemo
  )
  await as('card.socio')
  const demoHome = await rpc('lc_member_home')
  assert.equal(demoHome.membership.active, true)
  const demoOffers = demoHome.offers.filter((o) => o.title.startsWith('[TEST]'))
  assert.equal(demoOffers.length, 6)
  assert.deepEqual(
    new Set(demoOffers.map((o) => o.benefit_type)),
    new Set(['percent', 'fixed', 'gift', 'service', 'two_for_one'])
  )
  const demoGift = demoOffers.find((o) => o.benefit_type === 'gift')
  await rpc('lc_claim_offer', [demoGift.id])
  await root('SELECT 1')
  await db.exec(demoSql)
  await as('card.socio')
  assert.equal((await rpc('lc_member_home')).offers.find((o) => o.id === demoGift.id).remaining, 19)
  await as('card.inactivo')
  assert.equal((await rpc('lc_member_home')).membership.active, false)
  await rejects('lc_issue_digital_card', [], 'MEMBERSHIP_INACTIVE')
  await as('card.negocio')
  assert.equal((await rpc('lc_member_home')).membership, null)
  assert.equal(
    (await rpc('lc_business_dashboard', ['ca4d0000-0000-4000-8000-000000000101'])).offers.length,
    2
  )
  await root('SELECT 1')
  // Upgrade existing connections without reviving previously revoked/expired
  // devices. Identity is always taken from the authenticated profile.
  await as('owner')
  const accountLink = await rpc('lc_business_setup', [ids.business, null])
  await as(null, 'anon')
  const legacyActive = await rpc('lc_open_scanner', [accountLink.token, 'Legacy active'])
  const legacyExpired = await rpc('lc_open_scanner', [accountLink.token, 'Legacy expired'])
  const legacyRevoked = await rpc('lc_open_scanner', [accountLink.token, 'Legacy revoked'])
  await rpc('lc_close_scanner', [legacyRevoked.token])
  await root(
    "UPDATE latido_card_scanner_sessions SET expires_at=now()-interval '1 second' WHERE id=$1",
    [legacyExpired.session_id]
  )
  const accountsMigration = await readFile(
    new URL('../supabase/latido_card_scanner_accounts.sql', import.meta.url),
    'utf8'
  )
  await db.exec(accountsMigration)
  await db.exec(accountsMigration)
  await as(null, 'anon')
  assert.equal((await rpc('lc_scanner_status', [legacyActive.token, false])).expires_at, null)
  await rejects('lc_scanner_status', [legacyExpired.token, false], 'SCANNER_EXPIRED')
  await rejects('lc_scanner_status', [legacyRevoked.token, false], 'SCANNER_EXPIRED')
  await rejects('lc_open_scanner', [accountLink.token, 'Forged name'], 'permission denied')
  await as(null)
  await rejects('lc_open_scanner', [accountLink.token, 'Forged name'], 'AUTH_REQUIRED')
  await root("UPDATE profiles SET name='' WHERE id=$1", [ids.outsider])
  await as('outsider')
  await rejects('lc_open_scanner', [accountLink.token, 'Forged name'], 'PROFILE_NAME_REQUIRED')
  await root("UPDATE profiles SET name='outsider' WHERE id=$1", [ids.outsider])
  await as('outsider')
  const permanent = await rpc('lc_open_scanner', [accountLink.token, 'Different user name'])
  assert.equal(permanent.linked_user_id, ids.outsider)
  assert.equal(permanent.user_name, 'outsider', 'A device label cannot impersonate a profile name')
  assert.equal(permanent.persistent, true)
  assert.equal(permanent.expires_at, null)
  await as(null, 'anon')
  assert.equal(
    (await rpc('lc_scanner_status', [permanent.token, true])).persistence_requested,
    false
  )
  const permanentOffer = (await rpc('lc_scan_card', [permanent.token, replacementDigital.token]))
    .offers[0]
  assert.ok(permanentOffer)
  await rpc('lc_redeem', [
    permanent.token,
    replacementDigital.token,
    permanentOffer.id,
    randomUUID()
  ])
  await as('owner2')
  await rejects('lc_business_dashboard', [ids.business], 'FORBIDDEN')
  await rejects('lc_manage_scanner', [permanent.session_id, 'delete'], 'FORBIDDEN')
  await as('owner')
  const connectedDashboard = await rpc('lc_business_dashboard', [ids.business])
  assert.equal(
    connectedDashboard.sessions.find((s) => s.id === permanent.session_id).token_hash,
    undefined
  )
  assert.equal(
    connectedDashboard.sessions.find((s) => s.id === permanent.session_id).user_name,
    'outsider'
  )
  assert.ok(connectedDashboard.history.some((r) => r.scanner_label === 'outsider'))
  await rpc('lc_manage_scanner', [permanent.session_id, 'delete'])
  assert.ok(
    !(await rpc('lc_business_dashboard', [ids.business])).sessions.some(
      (s) => s.id === permanent.session_id
    )
  )
  assert.ok(
    (await rpc('lc_business_dashboard', [ids.business])).history.some(
      (r) => r.scanner_label === 'outsider'
    ),
    'Removal preserves redemption history'
  )
  await as(null, 'anon')
  await rejects('lc_scanner_status', [permanent.token, false], 'SCANNER_EXPIRED')
  await as('member2')
  const accountRevoked = await rpc('lc_open_scanner', [accountLink.token, 'Caja'])
  const accountClosed = await rpc('lc_open_scanner', [accountLink.token, 'Caja'])
  await as('owner')
  await rpc('lc_manage_scanner', [accountRevoked.session_id, 'revoke'])
  await as(null, 'anon')
  await rejects('lc_scanner_status', [accountRevoked.token, false], 'SCANNER_EXPIRED')
  await rpc('lc_close_scanner', [accountClosed.token])
  await rejects('lc_scanner_status', [accountClosed.token, false], 'SCANNER_EXPIRED')
  await as('owner')
  assert.ok(
    (await rpc('lc_business_dashboard', [ids.business])).sessions.find(
      (s) => s.id === accountClosed.session_id
    ).disconnected_at
  )
  await as('member2')
  const beforeRotation = await rpc('lc_open_scanner', [accountLink.token, 'Caja'])
  await as('owner')
  await rpc('lc_rotate_scanner_link', [ids.business])
  await as(null, 'anon')
  await rejects('lc_scanner_status', [beforeRotation.token, false], 'SCANNER_EXPIRED')
  await as('member2')
  await rejects('lc_open_scanner', [accountLink.token, 'Caja'], 'SCANNER_LINK_INVALID')
  await root('SELECT 1')
  const preflight = await readFile(
    new URL('../supabase/latido_card_preflight.sql', import.meta.url),
    'utf8'
  )
  const readiness = await db.exec(preflight)
  assert.ok(readiness[0].rows.every((row) => row.estado === 'OK'))
  const privileged = (
    await db.query(
      "SELECT proname,prosecdef,proconfig FROM pg_proc WHERE proname LIKE 'lc_%' AND prosecdef"
    )
  ).rows
  assert.ok(privileged.every((f) => f.proconfig?.includes('search_path=public')))
  console.log(
    'Latido Card: PostgreSQL migrations, permanent account-bound Scanner, revocation/removal, permissions, stock, expiry, idempotency, physical fulfillment, audit, email retries and repeatable examples passed.'
  )
} finally {
  await db.close()
}
