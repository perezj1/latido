import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'

const read = (name) => readFile(new URL(`../supabase/${name}`, import.meta.url), 'utf8')
const db = new PGlite()
try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
    CREATE TABLE profiles(id uuid PRIMARY KEY,name text,email text,banned boolean DEFAULT false);
    CREATE TABLE providers(id uuid PRIMARY KEY,user_id uuid REFERENCES profiles(id),name text,city text,photo_url text,active boolean DEFAULT true);
    CREATE FUNCTION is_business_promotion_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
    CREATE TABLE email_notification_preferences(user_id uuid PRIMARY KEY,weekly_digest_enabled boolean DEFAULT true);`)
  const minimal = await read('latido_card_minimal.sql')
  const migration = await read('latido_card_business_invitation.sql')
  await db.exec(minimal)
  await db.exec(migration)
  await db.exec(migration)
  await db.exec(minimal) // Reinstalling the core must not revoke the new owner API.
  const ids = {}
  for (const name of [
    'first',
    'published',
    'changed',
    'preference',
    'optout',
    'inactive',
    'suspended',
    'banned',
    'customer'
  ]) {
    const user = randomUUID(),
      provider = randomUUID()
    ids[name] = { user, provider }
    await db.query('INSERT INTO profiles(id,name,banned) VALUES($1,$2,$3)', [
      user,
      name,
      name === 'banned'
    ])
    if (name !== 'customer')
      await db.query('INSERT INTO providers(id,user_id,name,active) VALUES($1,$2,$3,$4)', [
        provider,
        user,
        name,
        name !== 'inactive'
      ])
  }
  await db.query('INSERT INTO providers(id,user_id,name) VALUES($1,$2,$3)', [
    randomUUID(),
    ids.first.user,
    'Second business, same owner'
  ])
  for (const name of ['published', 'changed', 'suspended'])
    await db.query(
      'INSERT INTO latido_card_businesses(provider_id,active,suspended) VALUES($1,true,$2)',
      [ids[name].provider, name === 'suspended']
    )
  const offer = async (name) =>
    db.query(
      `INSERT INTO latido_card_offers(provider_id,title,benefit_type,benefit_value,ends_at,active,deleted_at)
    VALUES($1,'Oferta anterior','percent',10,now()+interval '1 day',false,now())`,
      [ids[name].provider]
    )
  await offer('published')
  await db.query('INSERT INTO email_notification_preferences VALUES($1,false)', [
    ids.preference.user
  ])
  const as = async (role, user = '') => {
    await db.exec(`RESET ROLE; SET ROLE ${role}`)
    await db.query("SELECT set_config('test.user',$1,false)", [user])
  }
  const rpc = async (name) => (await db.query(`SELECT ${name}() AS value`)).rows[0].value
  await as('authenticated', ids.first.user)
  assert.equal(
    (await rpc('lc_business_invitation')).business.name.includes('business') ||
      (await rpc('lc_business_invitation')).business.name === 'first',
    true
  )
  await assert.rejects(
    () => db.query('SELECT * FROM lc_business_invitation_targets'),
    /permission denied/
  )
  await assert.rejects(
    () => db.query('SELECT * FROM latido_card_business_invitations'),
    /permission denied/
  )
  await assert.rejects(() => rpc('lc_queue_business_invitations'), /permission denied/)
  await assert.rejects(() => rpc('lc_claim_business_invitations'), /permission denied/)
  for (const name of ['published', 'inactive', 'suspended', 'banned', 'customer']) {
    await as('authenticated', ids[name].user)
    assert.equal((await rpc('lc_business_invitation')).business, null, name)
  }
  await as('anon')
  await assert.rejects(() => rpc('lc_business_invitation'), /permission denied/)
  await as('service_role')
  assert.equal(await rpc('lc_queue_business_invitations'), 3)
  assert.equal(
    await rpc('lc_queue_business_invitations'),
    0,
    'Repeated queueing never duplicates a recipient'
  )
  await db.query(
    'UPDATE latido_card_business_invitations SET opted_out_at=now() WHERE user_id=$1',
    [ids.optout.user]
  )
  await db.exec('RESET ROLE')
  await offer('changed')
  await as('service_role')
  const claimed = (await db.query('SELECT * FROM lc_claim_business_invitations(20)')).rows
  assert.equal(claimed.length, 1)
  assert.equal(
    claimed[0].user_id,
    ids.first.user,
    'Multiple businesses receive only one invitation per owner'
  )
  assert.equal(
    (await db.query('SELECT * FROM lc_claim_business_invitations(20)')).rows.length,
    0,
    'Processing jobs cannot be reclaimed automatically'
  )
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM latido_card_business_invitations WHERE status='suppressed'"
      )
    ).rows[0].n,
    2,
    'Opt-out and creation of an offer suppress queued mail'
  )
  await db.query(
    "UPDATE latido_card_business_invitations SET status='sent',sent_at=now() WHERE user_id=$1",
    [ids.first.user]
  )
  assert.equal(
    await rpc('lc_queue_business_invitations'),
    0,
    'Sent and opted-out owners stay excluded'
  )
  await db.exec('RESET ROLE')
  await db.query('DELETE FROM providers WHERE id=$1', [claimed[0].provider_id])
  await as('service_role')
  assert.equal(
    await rpc('lc_queue_business_invitations'),
    0,
    'Deleting one business preserves the owner delivery record'
  )
  console.log(
    'Business invitations: ownership, eligibility, preferences, deduplication and private queue passed'
  )
} catch (error) {
  console.error(error.stack?.split('\n').slice(0, 7).join('\n') || error.message)
  process.exitCode = 1
} finally {
  await db.close()
}
