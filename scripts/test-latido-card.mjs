import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import {
  extractCardToken,
  readScannerSession,
  storeScannerSession,
  SCANNER_STORAGE_KEY
} from '../src/lib/latidoCardCore.js'

const token = 'a'.repeat(64)
assert.equal(extractCardToken(`https://latido.ch/c/${token}`), token)
assert.equal(extractCardToken(`https://evil.test/c/${token}`), null)
assert.equal(extractCardToken(`javascript:alert(1)`), null)
assert.equal(extractCardToken(`https://latido.ch/scanner/link/${token}`), null)
assert.equal(extractCardToken(`https://latido.ch/scanner/link/${token}`, 'scanner'), token)
assert.equal(extractCardToken('LC-000001'), null)
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
  { token, persistent: false, expires_at: new Date(Date.now() + 10000).toISOString() },
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
    { ...offer, title: '10 % siempre', usage_period: 'unlimited', benefit_value: 10 }
  ])
  const freshLink = await rpc('lc_rotate_scanner_link', [ids.business])
  await as(null, 'anon')
  const freshSession = await rpc('lc_open_scanner', [freshLink.token, 'Caja nueva'])
  await rpc('lc_redeem', [freshSession.token, replacementDigital.token, unlimited, randomUUID()])
  await rpc('lc_redeem', [freshSession.token, replacementDigital.token, unlimited, randomUUID()])
  await rpc('lc_close_scanner', [freshSession.token])
  await rejects('lc_scanner_status', [freshSession.token, false], 'SCANNER_EXPIRED')
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
  const privileged = (
    await db.query(
      "SELECT proname,prosecdef,proconfig FROM pg_proc WHERE proname LIKE 'lc_%' AND prosecdef"
    )
  ).rows
  assert.ok(privileged.every((f) => f.proconfig?.includes('search_path=public')))
  console.log(
    'Latido Card: core, repeatable PostgreSQL migration, permissions, stock, expiry, usage limits, reversals and idempotency passed.'
  )
} finally {
  await db.close()
}
