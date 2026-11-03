import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { clubVariantAttributes } from '../supabase/functions/_shared/clubVariants.ts'

assert.deepEqual(clubVariantAttributes('Negro - M', 'Talla'), { size: 'M', color: 'Negro' })
assert.deepEqual(clubVariantAttributes('Ash / 2XL', 'Color / Talla'), { size: '2XL', color: 'Ash' })
assert.deepEqual(clubVariantAttributes('Natural', 'Color'), { size: null, color: 'Natural' })
assert.deepEqual(clubVariantAttributes('Apple - iPhone 16', 'Modelo'), { size: null, color: null })

const db = new PGlite()
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
    CREATE FUNCTION public.is_business_promotion_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT coalesce(current_setting('test.admin', true), 'false') = 'true' $$;
    CREATE TABLE profiles(id uuid PRIMARY KEY, email text);
    CREATE TABLE business_promotion_admins(email text PRIMARY KEY);
    CREATE TABLE app_notifications(id uuid DEFAULT gen_random_uuid(), recipient_id uuid, kind text, source_id text, data jsonb,
      CONSTRAINT app_notifications_kind_check CHECK(kind IN ('message', 'creator_follow')),
      UNIQUE(recipient_id,kind,source_id));
  `)
  const sql = await readFile(new URL('../supabase/club_orders.sql', import.meta.url), 'utf8')
  const adminSql = await readFile(new URL('../supabase/club_orders_admin.sql', import.meta.url), 'utf8')
  await db.exec(sql)
  await db.exec(adminSql)
  await db.exec(adminSql) // Reapplying must preserve orders and constraints.
  const admin = randomUUID(), id = randomUUID(), unpaid = randomUUID()
  await db.query('INSERT INTO profiles VALUES ($1,$2)', [admin, 'admin@latido.test'])
  await db.query('INSERT INTO business_promotion_admins VALUES ($1)', ['admin@latido.test'])
  const items = [{ product_name: 'Camiseta Latido', size: 'M', color: 'Negro', quantity: 2, unit_amount: 2490, line_total: 4980, sku: 'sku-verified', gelato_product_id: 'product', gelato_variant_id: 'variant' }]
  for (const orderId of [id, unpaid]) await db.query(`INSERT INTO club_orders(id,checkout_request_id,subtotal_amount,total_amount,items,stripe_checkout_session_id) VALUES($1,$2,4980,4980,$3,$4)`, [orderId, randomUUID(), JSON.stringify(items), `cs_${orderId}`])
  const settle = (overrides = {}) => db.query('SELECT club_settle_payment($1,$2,$3,$4,$5) AS result', [id, overrides.session ?? `cs_${id}`, overrides.amount ?? 4980, overrides.currency ?? 'chf', JSON.stringify(overrides.details ?? { customer_name: 'Persona Prueba', customer_email: 'buyer@latido.test', customer_phone: '+41790000000', shipping_address: { line1: 'Calle Prueba 1', line2: 'Piso 2', postal_code: '8000', city: 'Zürich', country: 'CH' }, stripe_payment_intent_id: 'pi_verified' })])
  await db.exec('SET ROLE anon')
  await assert.rejects(() => db.query('SELECT club_admin_orders()'), /permission denied/)
  await assert.rejects(() => settle(), /permission denied/)
  await assert.rejects(() => db.query('SELECT * FROM club_orders'), /permission denied/)
  await db.exec('RESET ROLE; SET ROLE authenticated')
  await assert.rejects(() => db.query('SELECT club_admin_orders()'), /FORBIDDEN/)
  await assert.rejects(() => settle(), /permission denied/)
  await db.exec('RESET ROLE')
  await assert.rejects(() => settle({ amount: 1 }), /ORDER_AMOUNT_MISMATCH/)
  await assert.rejects(() => settle({ currency: 'eur' }), /ORDER_AMOUNT_MISMATCH/)
  await assert.rejects(() => settle({ session: 'another_session' }), /ORDER_SESSION_MISMATCH/)
  await assert.rejects(() => settle({ details: { customer_email: 'buyer@latido.test' } }), /ORDER_SHIPPING_MISSING/)
  await db.exec('SET ROLE service_role')
  const paid = (await settle()).rows[0].result
  assert.equal(paid.payment_status, 'paid')
  assert.equal(paid.shipping_address.line2, 'Piso 2')
  assert.equal(paid.items[0].size, 'M')
  assert.equal(paid.items[0].color, 'Negro')
  const paidAt = paid.paid_at
  await db.exec('RESET ROLE; SET ROLE authenticated')
  await db.query("SELECT set_config('test.uid',$1,false), set_config('test.admin','true',false)", [admin])
  const report = (await db.query('SELECT club_admin_orders() AS result')).rows[0].result
  assert.equal(report.total, 1, 'Default list excludes unpaid checkouts')
  assert.equal(report.pending, 1)
  assert.equal(report.rows[0].customer_email, 'buyer@latido.test')
  assert.equal(report.rows[0].request_fingerprint, undefined)
  const update = (status, expected, orderId = id, tracking = '') => db.query('SELECT club_admin_update_order($1,$2,$3,$4,$5) AS result', [orderId, expected, status, 'Preparar con cuidado', tracking])
  await assert.rejects(() => update('gelato_ordered', 'checkout_open', unpaid), /ORDER_NOT_PAID/)
  await assert.rejects(() => update('delivered', 'paid'), /INVALID_ORDER_TRANSITION/)
  await assert.rejects(() => update('gelato_ordered', 'paid', id, 'javascript:alert(1)'), /INVALID_ORDER_DETAILS/)
  const processing = (await update('gelato_ordered', 'paid')).rows[0].result
  assert.ok(processing.processing_at)
  await assert.rejects(() => update('shipped', 'paid'), /ORDER_CHANGED/)
  const shipped = (await update('shipped', 'gelato_ordered')).rows[0].result
  assert.ok(shipped.shipped_at)
  await db.exec('RESET ROLE; SET ROLE service_role')
  const replay = (await settle()).rows[0].result
  assert.equal(replay.status, 'shipped', 'Replayed payments preserve fulfillment')
  assert.equal(replay.paid_at, paidAt)
  await db.exec('RESET ROLE; SET ROLE authenticated')
  const delivered = (await update('delivered', 'shipped')).rows[0].result
  assert.ok(delivered.delivered_at)
  await assert.rejects(() => update('paid', 'delivered'), /INVALID_ORDER_TRANSITION/)
  await update('delivered', 'delivered') // Notes can be saved after delivery.
  await db.exec('RESET ROLE')
  assert.equal((await db.query('SELECT count(*)::int AS n FROM club_order_history')).rows[0].n, 3)
  assert.equal((await db.query("SELECT count(*)::int AS n FROM app_notifications WHERE kind='store_order'")).rows[0].n, 1, 'One in-app notification per paid order')
  await db.query("UPDATE club_orders SET payment_status='refunded',status='refunded' WHERE id=$1", [id])
  assert.equal((await settle()).rows[0].result.payment_status, 'refunded')
  console.log('Store orders: payment validation, private customer data, variants, admin permissions, transitions, replay and notifications passed.')
} finally { await db.close() }
