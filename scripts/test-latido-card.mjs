import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import {
  offerAvailability,
  offerBenefitLabel,
  offerComboLabel,
  offerHasEnd,
  offerUsageLabel,
  remainingValidationSeconds
} from '../src/lib/latidoCardCore.js'
import { cardOfferShareData, shareCardBusiness } from '../src/lib/latidoCardShare.js'
import {
  createOfferPayload,
  draftOfferScope,
  initialOfferDraft,
  offerToDraft,
  zurichEndOfDay
} from '../src/lib/latidoCardOfferDraft.js'
import {
  businessBenefit,
  membershipMailUrl,
  offerCapacity
} from '../src/lib/latidoCardExperience.js'
import { cardPublicSeo, renderCardShareHtml } from '../src/lib/latidoCardSeo.js'

const draft = initialOfferDraft()
assert.equal(zurichEndOfDay('2027-01-10'), '2027-01-10T22:59:59.000Z')
assert.equal(zurichEndOfDay('2027-07-10'), '2027-07-10T21:59:59.000Z')
assert.equal(zurichEndOfDay('2027-03-28'), '2027-03-28T21:59:59.000Z')
assert.equal(zurichEndOfDay('2027-10-31'), '2027-10-31T22:59:59.000Z')
const originalDraft = {
  ...draft,
  type: 'combo',
  combo: '3x2',
  scope: 'specific',
  detail: 'el menú',
  ends_at: '2027-07-10'
}
const roundTripOffer = createOfferPayload(originalDraft)
assert.deepEqual(createOfferPayload(offerToDraft(roundTripOffer)), roundTripOffer)
const legacyOffer = { ...roundTripOffer, original_draft: null, title: 'Combo especial para dos' }
assert.equal(createOfferPayload(offerToDraft(legacyOffer)).title, legacyOffer.title)
const mail = new URL(
  membershipMailUrl({
    user: { email: 'ana+latido@example.com' },
    name: 'Ana Núñez',
    member: { member_number: 2481 },
    renew: true
  })
)
assert.match(mail.searchParams.get('body'), /Ana Núñez/)
assert.match(mail.searchParams.get('body'), /ana\+latido@example.com/)
assert.match(mail.searchParams.get('body'), /2481/)
assert.equal(
  offerCapacity([{ active: true, ends_at: 'infinity', requires_claim: false }]).regular.length,
  1
)
assert.equal(offerCapacity([{ active: true, ends_at: '2020-01-01' }]).regular.length, 0)
assert.equal(businessBenefit([{ benefit_type: 'percent', benefit_value: 15 }]), 'Hasta −15 %')
const publicSeo = cardPublicSeo({
  business: { id: 'business', name: 'Café <Latido>', city: 'Zürich', photo_url: '/cafe.jpg' },
  offers: [{ benefit_type: 'percent', benefit_value: 15 }]
})
assert.match(publicSeo.description, /Hasta −15 % para socios en Zürich/)
assert.match(
  renderCardShareHtml(
    '<html><head><title>Latido</title></head><body><div id="root"></div></body></html>',
    publicSeo
  ),
  /Café &lt;Latido&gt;/
)
const noEndOffer = createOfferPayload(draft)
assert.equal(noEndOffer.ends_at, 'infinity')
assert.equal(offerHasEnd(noEndOffer), false)
assert.equal(offerHasEnd({ ends_at: '2027-01-01T12:00:00Z' }), true)
assert.equal(noEndOffer.title, '10 % de descuento')
assert.equal(draftOfferScope({ ...draft, scope: 'specific', detail: 'en el corte' }), 'En el corte')
assert.equal(
  draftOfferScope({ ...draft, type: 'gift', scope: 'specific', detail: 'con el menú' }),
  'Con el menú'
)
assert.equal(
  createOfferPayload({ ...draft, scope: 'specific', detail: 'en el corte' }).title,
  '10 % en el corte'
)
assert.equal(
  createOfferPayload({
    ...draft,
    type: 'gift',
    gift: 'un café',
    scope: 'specific',
    detail: 'con el menú'
  }).title,
  'Regalo: un café con el menú'
)
for (const combo of ['2x1', '3x2', 'second_half']) {
  const payload = createOfferPayload({ ...draft, type: 'combo', combo })
  assert.equal(payload.benefit_type, combo === '2x1' ? 'two_for_one' : 'service')
  assert.equal(payload.benefit_value, null)
  assert.equal(offerComboLabel(payload), combo === 'second_half' ? '2.ª a mitad' : combo)
  if (combo !== '2x1') assert.equal(offerBenefitLabel(payload), payload.title)
}
const custom = createOfferPayload({
  ...draft,
  type: 'other',
  benefit: 'envío gratis',
  scope: 'specific',
  detail: 'stale scope',
  requires_claim: true,
  stock_total: 12,
  usage_period: 'unlimited',
  usage_limit: 10
})
assert.equal(custom.title, 'Envío gratis')
assert.equal(custom.usage_period, 'lifetime')
assert.equal(custom.usage_limit, 1)
assert.equal(custom.stock_total, 12)

const read = (name) => readFile(new URL(`../supabase/${name}`, import.meta.url), 'utf8')
const minimal = await read('latido_card_minimal.sql'),
  cleanup = await read('latido_card_cleanup_legacy.sql'),
  activate = await read('latido_card_activate_offers.sql'),
  directory = await read('latido_card_business_directory.sql'),
  activation = await read('latido_card_offer_activation.sql'),
  deletion = await read('latido_card_business_deletion.sql'),
  participation = await read('latido_card_business_participation.sql'),
  verify = await read('latido_card_verify.sql'),
  experience = await read('latido_card_experience.sql'),
  notifications = await read('latido_card_notifications.sql')
assert.equal(offerUsageLabel({ usage_period: 'week', usage_limit: 2 }), '2 usos por semana')
const monthlyUsed = offerAvailability(
  {
    usage_period: 'month',
    usage_limit: 1,
    used_count: 1,
    next_available_at: '2026-10-31T23:00:00Z'
  },
  { memberActive: true, now: Date.parse('2026-10-16T12:00:00Z') }
)
assert.equal(monthlyUsed.unavailable, true)
assert.match(monthlyUsed.message, /Disponible de nuevo el 1 nov/)
assert.equal(
  offerAvailability(
    { usage_period: 'unlimited', used_count: 10, available: true },
    { memberActive: true }
  ).unavailable,
  false
)
assert.equal(
  offerAvailability({ requires_claim: true, claim: { status: 'used' }, remaining: 0 }).message,
  'Ya has utilizado este descuento.'
)
assert.equal(
  offerAvailability({ requires_claim: true, remaining: 0 }).message,
  'Sin unidades disponibles.'
)
assert.equal(
  offerAvailability({ requires_claim: true, claim: { status: 'claimed' }, remaining: 0 })
    .unavailable,
  false
)
assert.equal(
  offerAvailability({ available: false }, { memberActive: false }).unavailable,
  false,
  'Inactive membership is not mistaken for an unavailable offer'
)
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
    CREATE TABLE providers(id uuid PRIMARY KEY,user_id uuid REFERENCES profiles(id),name text,city text,photo_url text,active boolean DEFAULT true);
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
  await db.exec(deletion)
  await db.exec(deletion)
  const emptyParticipant = randomUUID()
  await db.query('INSERT INTO providers(id,user_id,name) VALUES($1,$2,$3)', [
    emptyParticipant,
    ids.inactive,
    'Sin descuentos'
  ])
  await db.query('INSERT INTO latido_card_businesses(provider_id,active) VALUES($1,true)', [
    emptyParticipant
  ])
  await db.exec(participation)
  await db.exec(participation)
  assert.equal(
    (
      await db.query('SELECT active FROM latido_card_businesses WHERE provider_id=$1', [
        emptyParticipant
      ])
    ).rows[0].active,
    false
  )
  await db.query(`UPDATE latido_card_businesses SET active=true WHERE provider_id=$1`, [
    emptyParticipant
  ])
  await db.query(
    `INSERT INTO latido_card_offers(provider_id,title,benefit_type,starts_at,ends_at) VALUES
    ($1,'Expired offer','gift',now()-interval '2 days',now()-interval '1 day'),
    ($1,'Future offer','gift',now()+interval '1 day',now()+interval '2 days')`,
    [emptyParticipant]
  )
  await db.exec(experience)
  await db.exec(experience)
  await db.exec(
    `CREATE TABLE IF NOT EXISTS app_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),recipient_id uuid REFERENCES profiles(id),kind text,source_id text,data jsonb,created_at timestamptz DEFAULT now(),CONSTRAINT app_notifications_kind_check CHECK (kind IN ('message')),UNIQUE(recipient_id,kind,source_id));`
  )
  await db.exec(notifications)
  await db.exec(notifications)
  const verification = await db.exec(verify)
  const checks = verification.flatMap((result) => result.rows).filter((row) => 'ok' in row)
  assert.equal(checks.length, 11)
  assert.ok(
    checks.every((row) => row.ok),
    JSON.stringify(checks)
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
  await assert.rejects(() => rpc('lc_join_card_business', [ids.business]), /OFFER_REQUIRED/)
  const beforeFailedPublication = (
    await root('SELECT * FROM latido_card_businesses WHERE provider_id=$1', [ids.business])
  ).rows
  await as('owner')
  await assert.rejects(
    () =>
      rpc('lc_save_offer', [
        ids.business,
        {
          title: 'x',
          benefit_type: 'percent',
          benefit_value: 10,
          ends_at: new Date(Date.now() + 86400000).toISOString()
        }
      ]),
    /check constraint/
  )
  assert.deepEqual(
    (await root('SELECT * FROM latido_card_businesses WHERE provider_id=$1', [ids.business])).rows,
    beforeFailedPublication,
    'A failed first offer never enrolls or reactivates a business'
  )
  await as(null, 'anon')
  assert.deepEqual(
    await rpc('lc_participating_businesses'),
    [],
    'The public directory excludes empty registrations and businesses with only paused, expired or future offers'
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
  let oid = await makeOffer({ ends_at: 'infinity' })
  await as(null, 'anon')
  assert.deepEqual(
    await rpc('lc_participating_businesses'),
    [{ id: ids.business, name: 'Restaurante A', city: 'Zürich', category: null, photo_url: null }],
    'Publishing the first offer enrolls the business and exposes only public directory fields'
  )
  const local = await rpc('lc_business_benefits', [ids.business])
  assert.equal(local.business.name, 'Restaurante A')
  assert.equal(local.offers[0].id, oid)
  assert.equal(local.offers[0].ends_at, 'infinity', 'Offers without an end date remain public')
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
  assert.ok(home.server_now)
  await as('owner')
  const results = await rpc('lc_business_dashboard', [ids.business])
  assert.equal(results.summary.total_uses, upgrade ? 2 : 1)
  assert.equal(results.summary.month_uses, upgrade ? 2 : 1)
  assert.equal(results.summary.month_members, 1)
  assert.match(results.history[0].member_reference, /^•••• \d{4}$/)
  assert.ok(!JSON.stringify(results).includes(ids.member))
  await assert.rejects(() => rpc('lc_update_offer', [oid, noEndOffer]), /OFFER_TERMS_LOCKED/)
  const firstNotices = await root('SELECT * FROM app_notifications WHERE source_id=$1', [
    `first:${ids.business}`
  ])
  assert.equal(firstNotices.rows.length, upgrade ? 0 : 1)
  await as('member')
  assert.equal((await rpc('lc_notification_preferences')).new_offers, false)
  assert.equal((await rpc('lc_notification_preferences', [true, 'Zürich'])).new_offers, true)
  await assert.rejects(
    () => db.query('SELECT * FROM latido_card_notification_preferences'),
    /permission denied/
  )
  await as('other')
  assert.equal((await rpc('lc_notification_preferences')).new_offers, false)
  await assert.rejects(() => rpc('lc_send_scheduled_notifications'), /permission denied/)
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
  await as(null, 'anon')
  assert.deepEqual(
    await rpc('lc_participating_businesses'),
    [],
    'Pausing the last offer removes the business from the directory'
  )
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
  assert.equal(
    (
      await root('SELECT count(*) AS count FROM app_notifications WHERE source_id=$1', [
        `stock:${oid}`
      ])
    ).rows[0].count,
    1
  )
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
  // A business publication can be removed without destroying its offers or member history.
  await db.exec('RESET ROLE')
  await db.exec(`GRANT SELECT,UPDATE,DELETE ON providers TO anon,authenticated;
    CREATE POLICY test_provider_read ON providers FOR SELECT USING(true);
    CREATE POLICY test_provider_update ON providers FOR UPDATE USING(user_id=auth.uid());
    CREATE POLICY test_provider_delete ON providers FOR DELETE USING(user_id=auth.uid());
    CREATE FUNCTION test_subscription_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF current_setting('test.block_delete',true)='true' THEN RAISE EXCEPTION 'ACTIVE_BUSINESS_SUBSCRIPTION'; END IF;
      RETURN OLD;
    END $$;
    CREATE TRIGGER prevent_provider_delete_with_active_subscription BEFORE DELETE ON providers
      FOR EACH ROW EXECUTE FUNCTION test_subscription_guard();
    UPDATE latido_card_offers SET active=false;`)
  await as('owner')
  const retiringOffer = await makeOffer({ usage_period: 'unlimited' })
  await as('member')
  const retiringReceipt = await rpc('lc_use_offer', [retiringOffer, randomUUID()])
  assert.equal(retiringReceipt.valid, true)
  const historyBeforeDelete = (await rpc('lc_member_home')).history.length
  await as('other')
  await db.query('DELETE FROM providers WHERE id=$1', [ids.business])
  assert.equal(
    (await root('SELECT deleted_at FROM providers WHERE id=$1', [ids.business])).rows[0].deleted_at,
    null
  )
  await as('owner')
  await db.query("SELECT set_config('test.block_delete','true',false)")
  await assert.rejects(
    () => db.query('DELETE FROM providers WHERE id=$1', [ids.business]),
    /ACTIVE_BUSINESS_SUBSCRIPTION/
  )
  await db.query("SELECT set_config('test.block_delete','false',false)")
  await db.query('DELETE FROM providers WHERE id=$1', [ids.business])
  assert.equal(
    (await db.query('SELECT * FROM providers WHERE id=$1', [ids.business])).rows.length,
    0,
    'Retired publication is hidden from its owner too'
  )
  await db.query('UPDATE providers SET active=true,deleted_at=null WHERE id=$1', [ids.business])
  await assert.rejects(() => rpc('lc_join_card_business', [ids.business]), /FORBIDDEN/)
  assert.ok(
    !(await rpc('lc_business_dashboard')).businesses.some((item) => item.id === ids.business)
  )
  const retired = (
    await root('SELECT active,deleted_at FROM providers WHERE id=$1', [ids.business])
  ).rows[0]
  assert.equal(retired.active, false)
  assert.ok(retired.deleted_at)
  assert.equal(
    (await root('SELECT active FROM latido_card_offers WHERE id=$1', [retiringOffer])).rows[0]
      .active,
    false
  )
  await as('member')
  assert.equal((await rpc('lc_member_home')).history.length, historyBeforeDelete)
  assert.equal((await rpc('lc_validation', [retiringReceipt.id])).valid, false)
  await as(null, 'anon')
  assert.equal(
    (await db.query('SELECT * FROM providers WHERE id=$1', [ids.business])).rows.length,
    0
  )
  assert.ok(!(await rpc('lc_catalog')).some((item) => item.provider_id === ids.business))
  assert.ok(!(await rpc('lc_participating_businesses')).some((item) => item.id === ids.business))
  await as('admin')
  await assert.rejects(() => rpc('lc_admin_business', [ids.business, true]), /FORBIDDEN/)
  const unrelated = randomUUID()
  await root('INSERT INTO providers(id,user_id,name) VALUES($1,$2,$3)', [
    unrelated,
    ids.owner,
    'No Card participation'
  ])
  await as('owner')
  await db.query('DELETE FROM providers WHERE id=$1', [unrelated])
  assert.equal((await root('SELECT * FROM providers WHERE id=$1', [unrelated])).rows.length, 0)
  // Exercise edits/replacements in a separate business, including rollback at capacity.
  const managedBusiness = randomUUID()
  await root('INSERT INTO providers(id,user_id,name,city) VALUES($1,$2,$3,$4)', [
    managedBusiness,
    ids.owner,
    'Experience test',
    'Zürich'
  ])
  await as('owner')
  const editable = await rpc('lc_save_offer', [managedBusiness, noEndOffer])
  const updatedPayload = createOfferPayload({ ...draft, value: '15' })
  assert.equal(await rpc('lc_update_offer', [editable, updatedPayload]), editable)
  assert.equal(
    (await rpc('lc_business_dashboard', [managedBusiness])).offers[0].title,
    '15 % de descuento'
  )
  assert.equal(
    (await rpc('lc_business_dashboard', [managedBusiness])).offers[0].original_draft.value,
    '15'
  )
  await assert.rejects(
    () => rpc('lc_replace_offer', [editable, { ...updatedPayload, benefit_value: -5 }]),
    /check constraint/
  )
  assert.equal(
    (await rpc('lc_business_dashboard', [managedBusiness])).offers[0].active,
    true,
    'Failed replacement restores the old active offer'
  )
  await as('other')
  await assert.rejects(() => rpc('lc_update_offer', [editable, updatedPayload]), /FORBIDDEN/)
  await assert.rejects(() => rpc('lc_replace_offer', [editable, updatedPayload]), /FORBIDDEN/)
  await root(
    "UPDATE latido_card_memberships SET status='active',valid_until=now()+interval '30 days' WHERE user_id=$1",
    [ids.member]
  )
  await as('member')
  const oldReceipt = await rpc('lc_use_offer', [editable, randomUUID()])
  await as('owner')
  await assert.rejects(() => rpc('lc_update_offer', [editable, noEndOffer]), /OFFER_TERMS_LOCKED/)
  const replacement = await rpc('lc_replace_offer', [editable, noEndOffer])
  const versions = (await rpc('lc_business_dashboard', [managedBusiness])).offers
  assert.equal(versions.find((o) => o.id === editable).active, false)
  assert.equal(versions.find((o) => o.id === replacement).active, true)
  await as('member')
  assert.equal(
    (await rpc('lc_member_home')).history.find((r) => r.id === oldReceipt.id).offer_snapshot.title,
    updatedPayload.title
  )
  await as('owner')
  // More than the 100-row history cap: results must still count all uses.
  await root(
    `INSERT INTO latido_card_redemptions(request_id,membership_id,offer_id,provider_id,offer_snapshot,redeemed_at)
    SELECT gen_random_uuid(),m.id,$1,$2,$3::jsonb,now()-interval '1 minute' FROM latido_card_memberships m CROSS JOIN generate_series(1,120) s WHERE m.user_id=$4`,
    [replacement, managedBusiness, JSON.stringify(noEndOffer), ids.member]
  )
  await as('owner')
  const aggregate = await rpc('lc_business_dashboard', [managedBusiness])
  assert.equal(aggregate.history.length, 100)
  assert.equal(aggregate.summary.total_uses, 121)
  assert.equal(aggregate.summary.month_uses, 121)
  assert.equal(aggregate.summary.month_members, 1)
  const endingOffer = await rpc('lc_save_offer', [
    managedBusiness,
    {
      ...noEndOffer,
      requires_claim: true,
      stock_total: 10,
      usage_period: 'lifetime',
      usage_limit: 1,
      ends_at: new Date(Date.now() + 3 * 86400000).toISOString()
    }
  ])
  await root(
    "UPDATE latido_card_memberships SET valid_until=now()+interval '7 days' WHERE user_id=$1",
    [ids.member]
  )
  // Scheduled delivery is idempotent and consent can be withdrawn.
  await root(
    "UPDATE latido_card_notification_preferences SET enabled_at=now()-interval '1 day',last_new_offers_at=NULL WHERE user_id=$1",
    [ids.member]
  )
  const delivered = (await root('SELECT lc_send_scheduled_notifications() AS sent')).rows[0].sent
  assert.ok(delivered >= 1)
  assert.equal((await root('SELECT lc_send_scheduled_notifications() AS sent')).rows[0].sent, 0)
  const newOffersNotices = await root(
    "SELECT * FROM app_notifications WHERE kind='card_member' AND source_id LIKE 'new-offers:%'"
  )
  assert.equal(newOffersNotices.rows.length, 1)
  assert.equal(
    (
      await root('SELECT count(*) AS count FROM app_notifications WHERE source_id LIKE $1', [
        `ending:${endingOffer}:%`
      ])
    ).rows[0].count,
    1
  )
  assert.equal(
    (
      await root(
        "SELECT count(*) AS count FROM app_notifications WHERE recipient_id=$1 AND source_id LIKE 'membership:%'",
        [ids.member]
      )
    ).rows[0].count,
    1
  )
  await as('member')
  assert.equal((await rpc('lc_notification_preferences', [false, 'Zürich'])).new_offers, false)
  await as(null, 'anon')
  await assert.rejects(() => rpc('lc_notification_preferences'), /permission denied/)
  await assert.rejects(() => rpc('lc_update_offer', [replacement, noEndOffer]), /permission denied/)
  await db.close()
  console.log(`Card minimal: ${upgrade ? 'legacy upgrade + archive' : 'fresh install'} passed`)
}
