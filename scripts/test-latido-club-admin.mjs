import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const sql = await readFile(new URL('../supabase/latido_club_admin_metrics.sql', import.meta.url), 'utf8')
const db = new PGlite()
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE FUNCTION public.lc_is_admin() RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT current_setting('test.admin', true) = 'true'
    $$;
    CREATE TABLE profiles(id uuid PRIMARY KEY, name text, email text);
    CREATE TABLE providers(id uuid PRIMARY KEY, name text, city text, active boolean, deleted_at timestamptz);
    CREATE TABLE latido_card_memberships(id uuid PRIMARY KEY, user_id uuid, member_number bigint, status text, starts_at timestamptz, valid_until timestamptz, created_at timestamptz DEFAULT now());
    CREATE TABLE latido_card_businesses(provider_id uuid PRIMARY KEY, active boolean, suspended boolean, created_at timestamptz DEFAULT now());
    CREATE TABLE latido_card_offers(id uuid PRIMARY KEY, provider_id uuid, title text, benefit_type text DEFAULT 'percent', benefit_value numeric DEFAULT 10, active boolean DEFAULT true, starts_at timestamptz DEFAULT now() - interval '1 day', ends_at timestamptz DEFAULT now() + interval '1 year', deleted_at timestamptz, created_at timestamptz DEFAULT now());
    CREATE TABLE latido_card_redemptions(id uuid PRIMARY KEY, offer_id uuid, provider_id uuid, membership_id uuid, offer_snapshot jsonb DEFAULT '{}', redeemed_at timestamptz DEFAULT now(), reversed_at timestamptz);
    CREATE TABLE latido_card_claims(id uuid PRIMARY KEY, offer_id uuid, membership_id uuid, status text, expires_at timestamptz);
  `)
  const members = []
  for (const [index, state] of ['active', 'expired', 'paused', 'cancelled', 'scheduled', 'test'].entries()) {
    const user = randomUUID(), id = randomUUID()
    await db.query('INSERT INTO profiles VALUES($1,$2,$3)', [user, state === 'test' ? '[TEST] Persona' : `Persona ${state}`, `${state}@latido.test`])
    await db.query(`INSERT INTO latido_card_memberships(id,user_id,member_number,status,starts_at,valid_until) VALUES($1,$2,$3,$4,
      now() + $5::interval, now() + $6::interval)`, [id, user, index + 1,
      ['paused', 'cancelled'].includes(state) ? state : 'active', state === 'scheduled' ? '1 day' : '-30 days', state === 'expired' ? '-1 day' : '90 days'])
    members.push(id)
  }
  const businesses = []
  for (const state of ['active', 'empty', 'suspended', 'archived', 'unpublished', 'inactive', 'test']) {
    const id = randomUUID()
    await db.query(`INSERT INTO providers VALUES($1,$2,'Zürich',$3,CASE WHEN $4 THEN now() ELSE null END)`, [id, state === 'test' ? '[TEST] Negocio' : `Negocio ${state}`, state !== 'unpublished', state === 'archived'])
    await db.query('INSERT INTO latido_card_businesses(provider_id,active,suspended) VALUES($1,$2,$3)', [id, state !== 'inactive', state === 'suspended'])
    businesses.push(id)
  }
  const offers = []
  for (const [index, state] of ['published', 'paused', 'expired', 'scheduled', 'archived', 'suspended', 'archived_business', 'unpublished', 'inactive', 'test', 'test_business'].entries()) {
    const id = randomUUID()
    const businessIndex = ({ suspended: 2, archived_business: 3, unpublished: 4, inactive: 5, test_business: 6 })[state] ?? 0
    await db.query(`INSERT INTO latido_card_offers(id,provider_id,title,active,starts_at,ends_at,deleted_at)
      VALUES($1,$2,$3,$4,now()+$5::interval,now()+$6::interval,CASE WHEN $7 THEN now() ELSE null END)`,
    [id, businesses[businessIndex], state === 'test' ? '[TEST] Oferta' : `Oferta ${state} ${index}`, !['paused', 'archived'].includes(state), state === 'scheduled' ? '1 day' : '-30 days', state === 'expired' ? '-1 day' : '90 days', state === 'archived'])
    offers.push(id)
  }
  const use = async (offerIndex, memberIndex = 0, { reversed = false, age = '0 days', snapshot = {} } = {}) => db.query(`
    INSERT INTO latido_card_redemptions(id,offer_id,provider_id,membership_id,offer_snapshot,redeemed_at,reversed_at)
    VALUES($1,$2,$3,$4,$5,now()-$6::interval,CASE WHEN $7 THEN now() ELSE null END)`,
  [randomUUID(), offers[offerIndex], businesses[0], members[memberIndex], JSON.stringify(snapshot), age, reversed])
  await use(0)
  await use(4) // Historical use survives archival of the offer.
  await use(0, 0, { reversed: true })
  await use(0, 0, { age: '60 days' })
  await use(9) // Marked test offer.
  await use(0, 5) // Marked test member.
  await use(0, 0, { snapshot: { title: '[TEST] Old title' } })
  await db.query(`INSERT INTO latido_card_claims VALUES($1,$2,$3,'claimed',now()+interval '1 day'),($4,$2,$3,'claimed',now()-interval '1 day')`, [randomUUID(), offers[0], members[0], randomUUID()])
  await db.exec(sql)
  const counts = () => db.query('SELECT (SELECT count(*) FROM latido_card_offers) AS offers,(SELECT count(*) FROM latido_card_redemptions) AS uses')
  const before = (await counts()).rows
  await db.exec(sql)
  assert.deepEqual((await counts()).rows, before, 'Installing twice preserves all data')

  const report = async (args = []) => (await db.query(`SELECT lc_admin_metrics(${args.map((_, i) => `$${i + 1}`).join(',')}) AS report`, args)).rows[0].report
  await db.exec('SET ROLE anon')
  await assert.rejects(() => report(), /permission denied/)
  await db.exec('RESET ROLE; SET ROLE authenticated')
  await db.query("SELECT set_config('test.admin','false',false)")
  await assert.rejects(() => report(), /FORBIDDEN/)
  await db.query("SELECT set_config('test.admin','true',false)")
  const result = await report()
  assert.equal(result.stats.members_total, 5)
  assert.equal(result.stats.members_active, 1)
  assert.equal(result.stats.members_expired, 1)
  assert.equal(result.stats.members_paused, 1)
  assert.equal(result.stats.members_cancelled, 1)
  assert.equal(result.stats.offers_total, 8)
  assert.equal(result.stats.offers_published, 1)
  assert.equal(result.stats.offers_archived, 1)
  assert.equal(result.stats.offers_expired, 1)
  assert.equal(result.stats.offers_paused, 1)
  assert.equal(result.stats.offers_scheduled, 1)
  assert.equal(result.stats.offers_unavailable, 4)
  assert.equal(result.stats.businesses_total, 5)
  assert.equal(result.stats.businesses_participating, 2)
  assert.equal(result.stats.businesses_with_offers, 1)
  assert.equal(result.stats.businesses_without_offers, 1)
  assert.equal(result.stats.uses_total, 3)
  assert.equal(result.stats.uses_period, 2)
  assert.equal(result.stats.uses_reversed, 1)
  assert.equal(result.stats.using_members_period, 1)
  assert.equal(result.stats.claims_active, 1)
  assert.equal(result.daily.length, 30)
  assert.equal(result.daily.reduce((sum, row) => sum + row.uses, 0), 2)
  assert.equal(result.daily.reduce((sum, row) => sum + row.members, 0), result.stats.members_new)
  assert.equal(result.daily.reduce((sum, row) => sum + row.offers, 0), result.stats.offers_new)
  assert.equal(new Set(result.daily.map(row => row.day)).size, 30)
  assert.equal(result.period.timezone, 'Europe/Zurich')
  await db.exec('RESET ROLE')
  assert.deepEqual((await counts()).rows, before, 'Reporting does not change offers or their history')
  await db.exec('SET ROLE authenticated')
  const allTests = await report([30, 'offers', '', 'all', 1, 25, false])
  assert.equal(allTests.stats.members_total, 6)
  assert.equal(allTests.stats.offers_published, 3)
  assert.equal(allTests.stats.uses_total, 6)
  assert.equal((await report([30, 'members', '', 'scheduled'])).records.rows[0].member_number, 5)
  assert.equal((await report([30, 'offers', '', 'archived'])).records.total, 1)
  assert.equal((await report([30, 'businesses', '', 'without_offers'])).records.rows[0].id, businesses[1])
  assert.deepEqual((await report([7, 'members', 'missing'])).stats, (await report([7, 'offers'])).stats, 'Search never changes global totals')
  await assert.rejects(() => report([30, 'unknown']), /INVALID_REPORT_KIND/)
  await assert.rejects(() => report([30, 'members', '', 'published']), /INVALID_REPORT_STATUS/)
  await db.exec('RESET ROLE')
  for (let i = 0; i < 60; i++) await db.query('INSERT INTO latido_card_offers(id,provider_id,title) VALUES($1,$2,$3)', [randomUUID(), businesses[0], i === 0 ? 'Descuento 50%' : `Página ${i}`])
  await db.exec('SET ROLE authenticated')
  const first = await report([90, 'offers', '', 'all', 1, 25])
  const second = await report([90, 'offers', '', 'all', 2, 25])
  assert.equal(first.records.total, 69)
  assert.equal(first.records.rows.length, 25)
  assert.equal(second.records.rows.length, 25)
  assert.equal(first.records.rows.some(row => second.records.rows.some(other => row.id === other.id)), false)
  assert.equal((await report([30, 'offers', '%'])).records.total, 1, 'Search treats wildcard characters literally')
  const bounded = await report([999, 'members', '', 'all', -5, 999])
  assert.equal(bounded.period.days, 90)
  assert.equal(bounded.records.page, 1)
  assert.equal(bounded.records.page_size, 100)
  await db.exec('RESET ROLE; ALTER TABLE providers DROP COLUMN deleted_at; SET ROLE authenticated')
  await report()
  console.log('Latido Club admin: SQL permissions, effective statuses, test exclusion, historical uses, exact totals, pagination, literal search and repeatable installation passed')
} finally {
  await db.close()
}
