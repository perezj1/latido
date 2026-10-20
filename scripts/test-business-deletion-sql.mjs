import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
try {
  await db.exec(`CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
    CREATE TABLE providers(id uuid PRIMARY KEY,user_id uuid NOT NULL);
    CREATE TABLE business_promotion_subscriptions(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider_id uuid REFERENCES providers(id) ON DELETE CASCADE,
      status text, stripe_subscription_id text, current_period_end timestamptz,
      cancel_at_period_end boolean DEFAULT false, created_at timestamptz DEFAULT now());`)
  const migration = await readFile(new URL('../supabase/business_promotion_delete_guard.sql', import.meta.url), 'utf8')
  await db.exec(migration)
  await db.exec(migration)
  const owner = randomUUID()
  await db.query("SELECT set_config('test.user',$1,false)", [owner])
  const provider = async () => {
    const id = randomUUID()
    await db.query('INSERT INTO providers VALUES($1,$2)', [id, owner])
    return id
  }
  const status = async id => (await db.query('SELECT get_business_deletion_status($1) AS state', [id])).rows[0].state
  const remove = id => db.query('DELETE FROM providers WHERE id=$1', [id])
  const free = await provider()
  assert.equal((await status(free)).blocked, false, 'No alerts module is required for a free business')
  await remove(free)
  await db.exec('CREATE TABLE business_lead_alert_subscriptions (LIKE business_promotion_subscriptions INCLUDING ALL)')
  for (const table of ['business_promotion_subscriptions', 'business_lead_alert_subscriptions']) {
    for (const renewalStatus of ['active', 'past_due', 'processing']) {
      const id = await provider()
      await db.query(`INSERT INTO ${table}(provider_id,status,stripe_subscription_id) VALUES($1,$2,$3)`, [id, renewalStatus, 'sub_test'])
      assert.equal((await status(id)).blocked, true)
      await assert.rejects(remove(id), /ACTIVE_BUSINESS_SUBSCRIPTION/)
      await db.query(`UPDATE ${table} SET cancel_at_period_end=true WHERE provider_id=$1`, [id])
      assert.equal((await status(id)).blocked, false)
      await remove(id)
    }
  }
  const mixed = await provider()
  for (const table of ['business_promotion_subscriptions', 'business_lead_alert_subscriptions'])
    await db.query(`INSERT INTO ${table}(provider_id,status,stripe_subscription_id) VALUES($1,'active','sub_test')`, [mixed])
  await db.query('UPDATE business_promotion_subscriptions SET cancel_at_period_end=true WHERE provider_id=$1', [mixed])
  assert.equal((await status(mixed)).blocked, true, 'All independently renewing plans must be cancelled')
  await assert.rejects(remove(mixed), /ACTIVE_BUSINESS_SUBSCRIPTION/)
  await db.query('UPDATE business_lead_alert_subscriptions SET cancel_at_period_end=true WHERE provider_id=$1', [mixed])
  assert.equal((await status(mixed)).blocked, false)
  await remove(mixed)
  const other = await provider()
  await db.query("SELECT set_config('test.user',$1,false)", [randomUUID()])
  await assert.rejects(status(other), /PROVIDER_NOT_FOUND/)
  await db.query("SELECT set_config('test.user','',false)")
  await assert.rejects(status(other), /AUTH_REQUIRED/)
  console.log('Business deletion SQL: repeatable migration, optional alerts, free/renewing/cancelled plans, multiple plans and ownership passed')
} finally {
  await db.close()
}
