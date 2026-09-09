import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import {
  PUNTO_HISPANO_SERVICES, getPuntoHispanoService, buildPuntoHispanoWhatsappUrl,
  puntoHispanoContactsCsv, fetchAllPuntoHispanoContacts,
} from '../src/lib/puntoHispanoServices.js'

const migration = readFileSync(new URL('../supabase/punto_hispano_contacts.sql', import.meta.url), 'utf8')
const sqlCatalogue = JSON.parse(migration.match(/catalogue CONSTANT JSONB := '(.+)';/)[1].replaceAll("''", "'"))
assert.deepEqual(sqlCatalogue, PUNTO_HISPANO_SERVICES, 'Client and server service labels must agree')
assert.equal(PUNTO_HISPANO_SERVICES.length, 7)
assert.ok(PUNTO_HISPANO_SERVICES.every(category => category.services.length <= 7))
assert.equal(getPuntoHispanoService('idiomas', 'rav'), null)
assert.equal(getPuntoHispanoService('invalid', 'invalid'), null)
assert.equal(getPuntoHispanoService('idiomas', ''), null)
const url = new URL(buildPuntoHispanoWhatsappUrl('José & Ana', 'Gestoría y asesoría', 'Desempleo y RAV'))
assert.equal(url.origin + url.pathname, 'https://wa.me/41766232664')
assert.equal(url.searchParams.get('text'), 'Hola soy José & Ana y vengo de Latido.ch. Tengo interés en Gestoría y asesoría: Desempleo y RAV. Saludos.')
assert.throws(() => buildPuntoHispanoWhatsappUrl('José', 'Idiomas', ''))
assert.throws(() => buildPuntoHispanoWhatsappUrl('', 'Idiomas', 'Alemán'))
const csv = puntoHispanoContactsCsv([{ user_name:'  =HYPERLINK("bad")', user_email:'ana@example.com', service_label:'Traducción; "oficial"\nnueva línea' }])
assert.ok(csv.startsWith('\uFEFFsep=;\r\n'))
assert.ok(csv.includes('"\'  =HYPERLINK(""bad"")"'))
assert.ok(csv.includes('"Traducción; ""oficial""\nnueva línea"'))
const manyRows = Array.from({ length:1205 }, (_, id) => ({ id }))
const offsets = []
const all = await fetchAllPuntoHispanoContacts(async (start, end) => {
  offsets.push(start)
  return { data:manyRows.slice(start, end + 1) }
})
assert.deepEqual(all, manyRows)
assert.deepEqual(offsets, [0, 500, 1000])
await assert.rejects(() => fetchAllPuntoHispanoContacts(async () => ({ error:new Error('Connection lost') })), /Connection lost/)
console.log('Punto Hispano: service selection, WhatsApp message, Excel escaping and complete pagination passed')

// Optional real PostgreSQL engine in memory; pass the path to PGlite's index.js.
if (process.argv[2]) {
  const { PGlite } = await import(pathToFileURL(process.argv[2]).href)
  const db = new PGlite()
  const user = '11111111-1111-4111-8111-111111111111'
  const other = '22222222-2222-4222-8222-222222222222'
  const admin = '33333333-3333-4333-8333-333333333333'
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb);
      CREATE TABLE public.profiles (id uuid PRIMARY KEY, name text);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
        $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      CREATE FUNCTION public.is_business_promotion_admin() RETURNS boolean LANGUAGE sql AS
        $$ SELECT auth.uid() = '${admin}'::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated, anon;
      INSERT INTO auth.users VALUES
        ('${user}', 'ana@example.com', '{"name":"Old name"}'),
        ('${other}', 'other@example.com', '{"name":"Other"}');
      INSERT INTO public.profiles VALUES ('${user}', 'Ana Latido');
    `)
    await db.exec(migration)
    await db.exec(migration)
    const asUser = async id => {
      await db.exec('RESET ROLE')
      await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id])
      await db.exec('SET ROLE authenticated')
    }
    const record = (id, category = 'gestoria', service = 'rav') => db.query(
      'SELECT public.record_punto_hispano_contact($1, $2, $3, $4) AS contact',
      [id, category, service, 'test'],
    )
    await asUser(user)
    const request = randomUUID()
    const first = (await record(request)).rows[0].contact
    assert.equal(first.user_name, 'Ana Latido')
    assert.equal(first.service_label, 'Desempleo y RAV')
    assert.ok(Math.abs(Date.now() - Date.parse(first.created_at)) < 10000)
    assert.deepEqual((await record(request)).rows[0].contact, first, 'Retry must retain ID, name and timestamp')
    await assert.rejects(() => record(request, 'idiomas', 'aleman'), /another service/)
    await assert.rejects(() => record(randomUUID(), 'idiomas', 'rav'), /Invalid service/)
    await assert.rejects(() => record(randomUUID(), 'idiomas', ''), /Invalid service/)
    assert.equal((await db.query('SELECT * FROM public.punto_hispano_contacts')).rows.length, 0)
    await assert.rejects(() => db.exec('DELETE FROM public.punto_hispano_contacts'), /permission denied/)
    await assert.rejects(() => db.exec('UPDATE public.punto_hispano_contacts SET user_email = \'fake@example.com\''), /permission denied/)
    await assert.rejects(() => db.exec('INSERT INTO public.punto_hispano_contacts DEFAULT VALUES'), /permission denied/)
    for (const category of PUNTO_HISPANO_SERVICES) {
      for (const service of category.services) {
        assert.equal((await record(randomUUID(), category.id, service.id)).rows[0].contact.service_label, service.label)
      }
    }
    await asUser(other)
    assert.equal((await db.query('SELECT * FROM public.punto_hispano_contacts')).rows.length, 0)
    assert.notEqual((await record(request)).rows[0].contact.id, first.id, 'Request IDs cannot expose another user contact')
    await asUser('')
    await assert.rejects(() => record(randomUUID()), /Authentication required/)
    await db.exec('SET ROLE anon')
    await assert.rejects(() => record(randomUUID()), /permission denied/)
    await assert.rejects(() => db.exec('SELECT * FROM public.punto_hispano_contacts'), /permission denied/)
    await asUser(admin)
    const saved = (await db.query('SELECT * FROM public.punto_hispano_contacts WHERE id = $1', [first.id])).rows[0]
    assert.equal(saved.user_email, 'ana@example.com')
    assert.equal(saved.user_id, user)
    console.log('Punto Hispano: PostgreSQL migration, all services, identity, timestamp, idempotency and admin-only access passed')
  } finally {
    await db.close()
  }
}
