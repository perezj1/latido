import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { offerUsageLabel, remainingValidationSeconds } from '../src/lib/latidoCardCore.js'
import { cardOfferShareData, shareCardBusiness } from '../src/lib/latidoCardShare.js'

const read = (name) => readFile(new URL(`../supabase/${name}`, import.meta.url), 'utf8')
const minimal = await read('latido_card_minimal.sql'),
  cleanup = await read('latido_card_cleanup_legacy.sql'),
  activate = await read('latido_card_activate_offers.sql'),
  directory = await read('latido_card_business_directory.sql'),
  activation = await read('latido_card_offer_activation.sql'),
  verify = await read('latido_card_verify.sql')
assert.equal(offerUsageLabel({ usage_period: 'week', usage_limit: 2 }), '2 usos por semana')
assert.equal(
  remainingValidationSeconds(
    { valid: true, expires_at: '2026-10-15T12:05:00Z', server_now: '2026-10-15T12:00:00Z' },
    1000,
    3000
  ),
  298
)
assert.equal(remainingValidationSeconds({ valid: false }, 1000, 3000), 0)
assert.equal(
  remainingValidationSeconds(
    { valid: true, expires_at: '2026-10-15T12:05:00Z', server_now: '2026-10-15T12:00:00Z' },
    1000,
    400000
  ),
  0
)
const shared = cardOfferShareData(
  {
    id: randomUUID(),
    title: 'Café',
    business_name: 'Café A',
    benefit_type: 'gift',
    secret: 'private'
  },
  'https://latido.ch'
)
assert.ok(!JSON.stringify(shared).includes('private'))
let publicBusiness
await shareCardBusiness(
  'business-id',
  'Café A',
  {
    share: async (data) => {
      publicBusiness = data
    }
  },
  'https://latido.ch'
)
assert.equal(publicBusiness.url, 'https://latido.ch/card/negocio/business-id')

for (const upgrade of [false, true]) {
  const db = new PGlite()
  const ids = Object.fromEntries(
    ['admin', 'owner', 'member', 'other', 'inactive', 'business'].map((key) => [key, randomUUID()])
  )
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
    CREATE TABLE profiles(id uuid PRIMARY KEY,name text,email text);
    CREATE TABLE providers(id uuid PRIMARY KEY,user_id uuid REFERENCES profiles(id),name text,city text,photo_url text);
    CREATE TABLE business_promotion_admins(email text PRIMARY KEY);
    CREATE FUNCTION is_business_promotion_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM business_promotion_admins WHERE email=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'email')) $$;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
    CREATE SCHEMA cron;
    CREATE TABLE cron.job(jobid bigint PRIMARY KEY,jobname text);
    INSERT INTO cron.job VALUES(1,'latido-card-physical-email'),(2,'another-latido-job');
    CREATE FUNCTION cron.unschedule(p_jobid bigint) RETURNS boolean LANGUAGE plpgsql AS $$ BEGIN DELETE FROM cron.job WHERE jobid=p_jobid; RETURN true; END $$;`)
  for (const key of ['admin', 'owner', 'member', 'other', 'inactive'])
    await db.query('INSERT INTO profiles VALUES($1,$2,$3)', [ids[key], key, `${key}@latido.test`])
  await db.query('INSERT INTO business_promotion_admins VALUES($1)', ['admin@latido.test'])
  await db.query('INSERT INTO providers VALUES($1,$2,$3,$4,NULL)', [
    ids.business,
    ids.owner,
    'Restaurante A',
    'Zürich'
  ])
  const as = async (key, role = 'authenticated') => {
    await db.exec(`RESET ROLE; SET ROLE ${role};`)
    await db.query("SELECT set_config('request.jwt.claims',$1,false)", [
      JSON.stringify(key ? { sub: ids[key], email: `${key}@latido.test` } : {})
    ])
  }
  const root = async (sql, args = []) => {
    await db.exec('RESET ROLE')
    return db.query(sql, args)
  }
  const rpc = async (name, args = []) =>
    (
      await db.query(
        `SELECT public.${name}(${args.map((_, i) => `$${i + 1}`).join(',')}) AS result`,
        args
      )
    ).rows[0].result
  let legacyId
  if (upgrade) {
    await db.exec(await read('legacy/latido_card/latido_card.sql'))
    const notifications = (await read('app_notifications.sql')).split(
      '-- One interaction creates'
    )[0]
    await db.exec(notifications)
    for (const file of [
      'physical_requests',
      'self_service',
      'scanner_accounts',
      'scanner_multibusiness',
      'manual_codes'
    ])
      await db.exec(await read(`legacy/latido_card/latido_card_${file}.sql`))
    await as('admin')
    await rpc('lc_admin_enroll', [ids.member, new Date(Date.now() + 86400000).toISOString()])
    await rpc('lc_admin_business', [ids.business, true])
    await as('owner')
    const link = await rpc('lc_business_setup', [ids.business, null])
    const session = await rpc('lc_open_scanner', [link.token, 'Historical worker'])
    const oid = await rpc('lc_save_offer', [
      ids.business,
      {
        title: 'Historical offer',
        benefit_type: 'percent',
        benefit_value: 15,
        minimum_spend: 50,
        ends_at: new Date(Date.now() + 86400000).toISOString(),
        usage_period: 'unlimited'
      }
    ])
    await as('member')
    const card = await rpc('lc_issue_digital_card')
    legacyId = (await rpc('lc_redeem', [session.token, card.token, oid, randomUUID()])).id
    await rpc('lc_issue_card_code')
    await rpc('lc_request_physical_card', [
      randomUUID(),
      { fulfillment: 'pickup', recipient_name: 'Test member' },
      'initial'
    ])
    await root('UPDATE latido_card_offers SET active=false WHERE id=$1', [oid])
  }
  await db.exec(minimal)
  await db.exec(minimal)
  await db.exec(cleanup)
  await db.exec(cleanup)
  await db.exec(minimal)
  await db.exec(activate)
  await db.exec(activate)
  await db.exec('DROP FUNCTION public.lc_participating_businesses()')
  await db.exec(directory)
  await db.exec(directory)
  if (upgrade) {
    await db.exec(
      'ALTER TABLE public.latido_card_offers DROP COLUMN activation_mode; ALTER TABLE public.latido_card_offers DROP COLUMN deleted_at; DROP FUNCTION public.lc_delete_offer(uuid)'
    )
  }
  await db.exec(activation)
  await db.exec(activation)
  const verification = await db.exec(verify)
  assert.ok(
    verification[0].rows.every((r) => r.ok),
    JSON.stringify(verification[0].rows)
  )
  if (legacyId) {
    const row = (await root('SELECT * FROM latido_card_redemptions WHERE id=$1', [legacyId]))
      .rows[0]
    assert.equal(row.source, 'legacy_scanner')
    assert.equal(row.legacy_metadata.scanner_label, 'Historical worker')
    assert.ok(await root('SELECT * FROM latido_card_archive.latido_card_scanner_sessions'))
    assert.equal(
      (
        await root(
          'SELECT count(*)::int AS total FROM latido_card_archive.latido_card_physical_requests'
        )
      ).rows[0].total,
      1
    )
    assert.ok(
      (
        await root(
          'SELECT count(*)::int AS total FROM latido_card_archive.latido_card_physical_email_queue'
        )
      ).rows[0].total > 0
    )
    await as('member')
    await assert.rejects(
      () => db.query('SELECT * FROM latido_card_archive.latido_card_physical_requests'),
      /permission denied/
    )
  }
  assert.deepEqual((await root('SELECT jobname FROM cron.job')).rows, [
    { jobname: 'another-latido-job' }
  ])
  await as(null, 'anon')
  assert.deepEqual(await rpc('lc_catalog'), [])
  await assert.rejects(() => rpc('lc_use_offer', [randomUUID(), randomUUID()]), /permission denied/)
  await assert.rejects(() => db.query('SELECT * FROM latido_card_memberships'), /permission denied/)
  await as('member')
  await assert.rejects(() => rpc('lc_admin_overview'), /FORBIDDEN/)
  await assert.rejects(() => rpc('lc_join_card_business', [ids.business]), /FORBIDDEN/)
  await as('owner')
  await rpc('lc_join_card_business', [ids.business])
  await as(null, 'anon')
  assert.deepEqual(
    await rpc('lc_participating_businesses'),
    [{ id: ids.business, name: 'Restaurante A', city: 'Zürich', photo_url: null }],
    'The public directory includes participants without offers and only public fields'
  )
  await root('UPDATE latido_card_businesses SET active=false WHERE provider_id=$1', [ids.business])
  await as(null, 'anon')
  assert.deepEqual(await rpc('lc_participating_businesses'), [])
  await root('UPDATE latido_card_businesses SET active=true,suspended=true WHERE provider_id=$1', [
    ids.business
  ])
  await as(null, 'anon')
  assert.deepEqual(
    await rpc('lc_participating_businesses'),
    [],
    'Suspended businesses are never public'
  )
  await root('UPDATE latido_card_businesses SET suspended=false WHERE provider_id=$1', [
    ids.business
  ])
  await as('admin')
  for (const key of ['member', 'other'])
    await rpc('lc_admin_enroll', [ids[key], new Date(Date.now() + 86400000 * 60).toISOString()])
  const makeOffer = async (overrides = {}) => {
    await as('owner')
    return rpc('lc_save_offer', [
      ids.business,
      {
        title: '15 % desde CHF 50',
        description: 'En restaurante',
        benefit_type: 'percent',
        benefit_value: 15,
        minimum_spend: 50,
        usage_period: 'month',
        usage_limit: 1,
        ends_at: new Date(Date.now() + 86400000 * 50).toISOString(),
        ...overrides
      }
    ])
  }
  let oid = await makeOffer()
  await as(null, 'anon')
  const local = await rpc('lc_business_benefits', [ids.business])
  assert.equal(local.business.name, 'Restaurante A')
  assert.equal(local.offers[0].id, oid)
  assert.equal(local.offers[0].activation_mode, 'manual', 'Existing/default offers remain manual')
  assert.ok(!JSON.stringify(local).includes('user_id'))
  await as('inactive')
  await assert.rejects(() => rpc('lc_use_offer', [oid, randomUUID()]), /MEMBERSHIP_INACTIVE/)
  await as('member')
  const request = randomUUID(),
    receipt = await rpc('lc_use_offer', [oid, request])
  assert.equal(receipt.valid, true)
  assert.equal(receipt.offer.minimum_spend, 50)
  assert.ok(Date.parse(receipt.expires_at) - Date.parse(receipt.redeemed_at) <= 300000)
  assert.equal((await rpc('lc_use_offer', [oid, request])).id, receipt.id)
  assert.equal((await rpc('lc_use_offer', [oid, randomUUID()])).id, receipt.id)
  const home = await rpc('lc_member_home')
  assert.equal(home.offers[0].available, false)
  assert.equal(home.offers[0].used_count, 1)
  assert.ok(home.offers[0].next_available_at)
  assert.equal(home.offers[0].validation.id, receipt.id)
  await as('other')
  await assert.rejects(() => rpc('lc_validation', [receipt.id]), /VALIDATION_NOT_FOUND/)
  await assert.rejects(() => rpc('lc_use_offer', [oid, request]), /REQUEST_CONFLICT/)
  await root(
    "UPDATE latido_card_redemptions SET display_valid_until=now()-interval '1 second' WHERE id=$1",
    [receipt.id]
  )
  await as('member')
  assert.equal((await rpc('lc_validation', [receipt.id])).valid, false)
  assert.equal(
    (await rpc('lc_use_offer', [oid, request])).valid,
    false,
    'Committed retries cannot restart the timer'
  )
  await assert.rejects(() => rpc('lc_use_offer', [oid, randomUUID()]), /OFFER_UNAVAILABLE/)
  await assert.rejects(
    () => root('UPDATE latido_card_offers SET minimum_spend=99 WHERE id=$1', [oid]),
    /OFFER_TERMS_LOCKED/
  )
  await as('owner')
  await assert.rejects(() => rpc('lc_reverse_redemption', [receipt.id, '']), /REASON_REQUIRED/)
  await rpc('lc_reverse_redemption', [receipt.id, 'Customer tapped by mistake'])
  await as('member')
  const renewed = await rpc('lc_use_offer', [oid, randomUUID()])
  assert.notEqual(renewed.id, receipt.id)
  await as('admin')
  await rpc('lc_admin_business', [ids.business, false])
  await as('member')
  assert.equal((await rpc('lc_validation', [renewed.id])).valid, false)
  await as('owner')
  await assert.rejects(() => rpc('lc_join_card_business', [ids.business]), /BUSINESS_SUSPENDED/)
  await as('admin')
  await rpc('lc_admin_business', [ids.business, true])
  await root('UPDATE latido_card_offers SET active=false WHERE id=$1', [oid])
  for (const period of ['day', 'week', 'month', 'lifetime', 'unlimited']) {
    oid = await makeOffer({ usage_period: period })
    await as('member')
    const r = await rpc('lc_use_offer', [oid, randomUUID()])
    await root(
      "UPDATE latido_card_redemptions SET display_valid_until=now()-interval '1 second' WHERE id=$1",
      [r.id]
    )
    await as('member')
    if (period === 'unlimited')
      assert.notEqual((await rpc('lc_use_offer', [oid, randomUUID()])).id, r.id)
    else {
      await assert.rejects(() => rpc('lc_use_offer', [oid, randomUUID()]), /OFFER_UNAVAILABLE/)
      if (period !== 'lifetime') {
        await root(
          "UPDATE latido_card_redemptions SET redeemed_at=public.lc_period_start($1)-interval '1 second' WHERE id=$2",
          [period, r.id]
        )
        await as('member')
        assert.ok((await rpc('lc_use_offer', [oid, randomUUID()])).valid)
      }
    }
    await root('UPDATE latido_card_offers SET active=false WHERE id=$1', [oid])
  }
  oid = await makeOffer({
    title: 'Café gratis',
    benefit_type: 'gift',
    benefit_value: null,
    minimum_spend: 0,
    requires_claim: true,
    stock_total: 1,
    usage_period: 'lifetime',
    usage_limit: 1
  })
  await as('member')
  const reservation = await rpc('lc_claim_offer', [oid])
  assert.equal((await rpc('lc_claim_offer', [oid])).id, reservation.id)
  await as('other')
  await assert.rejects(() => rpc('lc_claim_offer', [oid]), /OFFER_SOLD_OUT/)
  await as('member')
  await rpc('lc_release_claim', [oid])
  await as('other')
  const used = await rpc('lc_use_offer', [oid, randomUUID()])
  assert.equal(used.valid, true, 'A limited offer activates directly without claiming first')
  assert.equal((await rpc('lc_use_offer', [oid, randomUUID()])).id, used.id)
  assert.equal((await rpc('lc_member_home')).offers.find((o) => o.id === oid).claim.status, 'used')
  await as('owner')
  await rpc('lc_reverse_redemption', [used.id, 'Wrong benefit'])
  await as('other')
  assert.equal(
    (await rpc('lc_member_home')).offers.find((o) => o.id === oid).claim.status,
    'claimed'
  )
  await root(
    "UPDATE latido_card_claims SET expires_at=now()-interval '1 second' WHERE offer_id=$1",
    [oid]
  )
  await as('other')
  const usedAgain = await rpc('lc_use_offer', [oid, randomUUID()])
  assert.equal(
    usedAgain.valid,
    true,
    'An expired legacy reservation is renewed and consumed atomically'
  )
  await as('member')
  await assert.rejects(() => rpc('lc_use_offer', [oid, randomUUID()]), /OFFER_SOLD_OUT/)
  await as('other')
  const usedHistory = (await rpc('lc_member_home')).history.find((row) => row.id === usedAgain.id)
  assert.equal(usedHistory.provider_id, ids.business)
  assert.equal(usedHistory.offer_snapshot.title, 'Café gratis')
  const automaticId = await makeOffer({
    title: 'Descuento automático',
    activation_mode: 'automatic',
    usage_period: 'unlimited'
  })
  await as('member')
  const autoHome = await rpc('lc_member_home')
  assert.equal(autoHome.offers.find((item) => item.id === automaticId).activation_mode, 'automatic')
  assert.ok(
    !autoHome.history.some((item) => item.offer_id === automaticId),
    'Listing automatic offers never consumes them'
  )
  const autoRequest = randomUUID()
  const automaticReceipt = await rpc('lc_use_offer', [automaticId, autoRequest])
  assert.equal(automaticReceipt.offer.activation_mode, 'automatic')
  assert.equal((await rpc('lc_use_offer', [automaticId, autoRequest])).id, automaticReceipt.id)
  await assert.rejects(() => rpc('lc_delete_offer', [automaticId]), /FORBIDDEN/)
  await as(null, 'anon')
  await assert.rejects(() => rpc('lc_delete_offer', [automaticId]), /permission denied/)
  await as('owner')
  await assert.rejects(() => rpc('lc_delete_offer', [automaticId]), /OFFER_PAUSE_REQUIRED/)
  await assert.rejects(
    () => root("UPDATE latido_card_offers SET activation_mode='manual' WHERE id=$1", [automaticId]),
    /OFFER_TERMS_LOCKED/
  )
  await as('owner')
  await rpc('lc_set_offer_active', [automaticId, false])
  await rpc('lc_delete_offer', [automaticId])
  await rpc('lc_delete_offer', [automaticId])
  assert.ok(
    !(await rpc('lc_business_dashboard', [ids.business])).offers.some(
      (item) => item.id === automaticId
    )
  )
  await assert.rejects(() => rpc('lc_set_offer_active', [automaticId, true]), /OFFER_UNAVAILABLE/)
  await as('member')
  assert.equal((await rpc('lc_validation', [automaticReceipt.id])).valid, false)
  assert.ok(
    (await rpc('lc_member_home')).history.some((item) => item.id === automaticReceipt.id),
    'Deleting an offer preserves customer history'
  )
  assert.ok(!(await rpc('lc_catalog')).some((item) => item.id === automaticId))
  await assert.rejects(() => makeOffer({ activation_mode: 'invalid' }), /check constraint/)
  // Calendar/DST: a Swiss day at the March transition is 23 hours, October 25.
  const periods = await root(
    `SELECT lc_period_start('day','2026-03-29T12:00Z') AS spring_start,lc_next_period('day','2026-03-29T12:00Z') AS spring_end,lc_period_start('day','2026-10-25T12:00Z') AS fall_start,lc_next_period('day','2026-10-25T12:00Z') AS fall_end,lc_next_period('month','2026-10-15T12:00Z') AS next_month,lc_period_start('week','2026-10-18T12:00Z') AS week_start`
  )
  const dates = periods.rows[0]
  assert.equal((new Date(dates.spring_end) - new Date(dates.spring_start)) / 3600000, 23)
  assert.equal((new Date(dates.fall_end) - new Date(dates.fall_start)) / 3600000, 25)
  assert.equal(new Date(dates.next_month).toISOString(), '2026-10-31T23:00:00.000Z')
  assert.equal(new Date(dates.week_start).toISOString(), '2026-10-11T22:00:00.000Z')
  await as('owner')
  const dashboard = await rpc('lc_business_dashboard', [ids.business])
  assert.equal(dashboard.sessions, undefined)
  assert.ok(dashboard.history.length)
  await as('admin')
  assert.equal((await rpc('lc_admin_overview')).stats.active_members, 2)
  await as('member')
  await assert.rejects(() => rpc('lc_business_dashboard', [ids.business]), /FORBIDDEN/)
  await db.close()
  console.log(`Card minimal: ${upgrade ? 'legacy upgrade + archive' : 'fresh install'} passed`)
}
