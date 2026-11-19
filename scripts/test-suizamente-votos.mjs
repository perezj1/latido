import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { createSuizamenteHandler } from '../api/suizamente.js'
import { createSuizamenteHttp, suizamenteAllowedOrigin } from '../supabase/functions/_shared/suizamenteHttp.js'

const db = new PGlite()
const alice = '11111111-1111-4111-8111-111111111111'
const bob = '22222222-2222-4222-8222-222222222222'
const questions = JSON.parse(await readFile('public/suizamente/data/preguntas.json', 'utf8')).preguntas
const two = questions.find(q => q.opciones.length === 2)
const three = questions.find(q => q.opciones.length === 3)
let sqlCalls = 0
const rpc = async args => {
  sqlCalls++
  try {
    const { rows } = await db.query('SELECT public.suizamente_votos_api($1,$2,$3,$4,$5) AS result',
      [args.accion, args.jugador, args.pregunta, args.eleccion, args.direccion])
    return { data:rows[0].result, error:null }
  } catch (error) { return { data:null, error } }
}
const handler = createSuizamenteHandler(() => ({
  auth:{ getUser:async token => token === 'alice' ? { data:{ user:{ id:alice } } } : { error:new Error('Invalid') } },
  rpc:(_name, args) => rpc(args),
}))
async function request(path, { method='GET', body, player=alice, token, ip='127.0.0.1', origin } = {}) {
  let payload
  const res = { statusCode:200, headers:{}, setHeader(k,v) { this.headers[k.toLowerCase()] = v }, end(value) { payload = JSON.parse(value) } }
  await handler({ method, url:'/api/suizamente/' + path, body, headers:{ host:'localhost', 'x-jugador-id':player, ...(token ? { authorization:`Bearer ${token}` } : {}), ...(origin ? { origin } : {}) }, socket:{ remoteAddress:ip } }, res)
  return { status:res.statusCode, headers:res.headers, body:payload }
}
try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    INSERT INTO auth.users VALUES ('${alice}');`)
  const sql = await readFile('supabase/suizamente_votos.sql', 'utf8')
  await db.exec(sql)
  await db.exec(sql) // Idempotent installation, preserving votes.
  let result = await request('votos', { method:'POST', body:{ preguntaId:two.id, opcion:1 } })
  assert.equal(result.status, 200)
  assert.deepEqual(result.body, { reparto:[0,1,0], yaVotado:false, opcion:1 })
  result = await request('votos', { method:'POST', body:{ preguntaId:two.id, opcion:0 } })
  assert.deepEqual(result.body, { reparto:[0,1,0], yaVotado:true, opcion:1 })
  result = await request('votos', { method:'POST', player:bob, body:{ preguntaId:two.id, opcion:0 } })
  assert.deepEqual(result.body.reparto, [1,1,0])
  assert.deepEqual((await request('votos/mios')).body, { votos:{ [two.id]:1 } })
  const summary = await request('votos/resumen')
  assert.equal(summary.status, 200)
  assert.deepEqual(summary.body.conteos[two.id], [1,1,0])
  assert.match(summary.headers['cache-control'], /max-age=30/)
  assert.equal((await request('votos/resumen?actual=1')).headers['cache-control'], 'no-store')
  assert.equal(JSON.stringify(summary.body).includes(alice), false)
  for (const body of [{ preguntaId:two.id, opcion:2 }, { preguntaId:two.id, opcion:-1 }, { preguntaId:three.id, opcion:'1' }, { preguntaId:'missing', opcion:0 }, null]) {
    assert.equal((await request('votos', { method:'POST', body })).status, 400)
  }
  assert.equal((await request('votos/mios', { player:'invalid' })).status, 401)
  assert.equal((await request('votos/mios', { token:'invalid' })).status, 401)
  assert.equal((await request('votos', { method:'POST', body:{ preguntaId:three.id, opcion:2 }, token:'alice', player:bob })).status, 200)
  const own = await request('votos/mios', { token:'alice', player:bob })
  assert.deepEqual(own.body, { votos:{ [three.id]:2 } }) // Verified session wins over anonymous header.
  assert.equal((await request('votos', { method:'POST', body:{ preguntaId:two.id, opcion:0 }, origin:'https://unrelated.test' })).status, 403)
  assert.equal((await request('missing')).status, 404)
  assert.equal((await request('votos', { method:'DELETE' })).status, 405)
  assert.equal((await request('votos', { method:'POST', body:'{broken' })).status, 400)
  assert.equal((await request('votos', { method:'POST', body:'x'.repeat(4097) })).status, 413)
  const catalog = JSON.parse(await readFile('supabase/functions/_shared/suizamenteCatalogo.json', 'utf8'))
  assert.deepEqual(catalog, Object.fromEntries(questions.map(q => [q.id, q.opciones.length])))
  const edge = createSuizamenteHttp({
    getClient:() => ({ auth:{ getUser:async () => ({ error:new Error('Invalid') }) }, rpc:(_name, args) => rpc(args) }),
    questions:new Map(Object.entries(catalog)), getSecret:() => 'edge-test', allowedOrigin:suizamenteAllowedOrigin,
  })
  for (const origin of ['https://latido.ch','https://www.latido.ch','https://latidoch-git-suizamente-team.vercel.app','http://localhost:8080']) {
    const preflight = await edge({ method:'OPTIONS', url:'https://project.supabase.co/functions/v1/suizamente-votos/votos', headers:{ origin } })
    assert.equal(preflight.status, 204)
    assert.equal(preflight.headers['Access-Control-Allow-Origin'], origin)
  }
  assert.equal((await edge({ method:'OPTIONS', url:'https://project.supabase.co/suizamente-votos/votos', headers:{ origin:'https://unrelated.test' } })).status, 403)
  const edgeResult = await edge({ method:'GET', url:'https://project.supabase.co/functions/v1/suizamente-votos/votos/resumen?actual=1', headers:{ origin:'https://www.latido.ch' }, address:'edge-client' })
  assert.equal(edgeResult.status, 200)
  assert.deepEqual(edgeResult.body.conteos[two.id], [1,1,0])
  assert.equal(edgeResult.headers['Cache-Control'], 'no-store')
  // Database enforces option bounds even if called without the HTTP validator.
  const invalid = await rpc({ accion:'votar', jugador:`anon:${alice}`, pregunta:two.id, eleccion:2, direccion:'sql-test' })
  assert.equal(invalid.error.code, 'PT400')
  await db.exec('DELETE FROM public.suizamente_votos_limites')
  // Switching anonymous IDs still shares the durable per-IP limit.
  for (let i=0; i<60; i++) assert.equal((await request('votos/resumen', { player:i%2 ? alice : bob, ip:'rate-test' })).status, 200)
  result = await request('votos/resumen', { player:null, ip:'rate-test' })
  assert.equal(result.status, 429)
  assert.equal(result.headers['retry-after'], '60')
  await db.exec('DELETE FROM public.suizamente_votos_limites')
  for (let i=0; i<60; i++) assert.equal((await request('votos/mios', { ip:`ip-${i}` })).status, 200)
  assert.equal((await request('votos/mios', { ip:'new-ip' })).status, 429)
  // User deletion cascades only that user's votes, preserving anonymous choices.
  await db.exec(`DELETE FROM auth.users WHERE id='${alice}'`)
  assert.equal((await db.query("SELECT count(*)::int AS n FROM public.suizamente_votos WHERE jugador_id LIKE 'user:%'")).rows[0].n, 0)
  assert.equal((await db.query("SELECT count(*)::int AS n FROM public.suizamente_votos WHERE jugador_id LIKE 'anon:%'")).rows[0].n, 2)
  for (const role of ['anon','authenticated']) {
    await db.exec(`SET ROLE ${role}`)
    await assert.rejects(db.query('SELECT * FROM public.suizamente_votos'), /permission denied/)
    await assert.rejects(db.query("SELECT public.suizamente_votos_api('resumen',NULL,NULL,NULL,'ip')"), /permission denied/)
    await db.exec('RESET ROLE')
  }
  assert.ok(sqlCalls > 100)
  console.log('PASS: real PostgreSQL + HTTP; first vote, duplicates, counts, validation, identity, privacy, RLS, deletion, durable IP/player limits, repeatable migration.')
} finally { await db.close() }
