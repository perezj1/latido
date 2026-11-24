import assert from 'node:assert/strict'
import {createSuizamenteHandler} from '../server/suizamente/http.mjs'
import {database,call,profile,A,B,C} from './lib/suizamente-v2-test-db.mjs'
const prior={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_ANON_KEY}
let db
try{
  db=await database({admin:true})
  process.env.SUPABASE_URL='https://suizamente-test.invalid'
  process.env.SUPABASE_ANON_KEY='test-anon'
  const handler=createSuizamenteHandler({fetchImpl:async(_url,opts)=>{
    const b=JSON.parse(opts.body)
    try{return Response.json(await call(db,opts.headers.Authorization==='Bearer test-a'?A:opts.headers.Authorization==='Bearer test-b'?B:opts.headers.Authorization==='Bearer test-c'?C:null,b.p_action,b.p_args,b.p_guest_id,b.p_guest_token))}
    catch(e){return Response.json({message:e.message,code:e.code},{status:400})}
  }})
  async function request(path,method='GET',body,headers={},implementation=handler){
    const res={headers:{},setHeader(key,value){this.headers[key.toLowerCase()]=value},end(text){this.body=JSON.parse(text)}}
    await implementation({url:'/api/suizamente/'+path,method,body,headers:{host:'localhost',...headers}},res)
    return res
  }
  for(const [actor,name] of [[A,'Alex'],[B,'Lu']])await call(db,actor,'guardar_jugador',profile(name))
  let r=await request('config')
  assert.equal(r.statusCode,200)
  assert.equal(r.body.partida.segundosPorPregunta,30)
  assert.ok(!/"(?:correcta|dato)"\s*:/.test(JSON.stringify(r.body)))
  const rewritten=await request('?_ruta=config')
  assert.equal(rewritten.statusCode,200,'The concrete Vercel function dispatches rewritten paths')
  assert.equal(rewritten.body.partida.segundosPorPregunta,30)
  assert.equal((await request('?_ruta=admin/resumen')).statusCode,403,'Rewritten paths retain admin checks')
  r=await request('config')
  const cookie=r.headers['set-cookie'].split(';')[0]
  const auth={authorization:'Bearer test-a',cookie}
  const expired=await request('jugador','GET',null,auth,createSuizamenteHandler({fetchImpl:async()=>Response.json({message:'JWT expired',code:'PGRST301'},{status:401})}))
  assert.equal(expired.statusCode,401);assert.equal(expired.body.sesionCaducada,true)
  const guestCredential=await request('jugador/vincular','POST',{},auth,createSuizamenteHandler({fetchImpl:async()=>Response.json({message:'SZV2:401:Credencial de invitado no válida'},{status:400})}))
  assert.equal(guestCredential.statusCode,401);assert.equal(guestCredential.body.sesionCaducada,undefined,'A guest-link failure must not sign out a valid Latido account')
  assert.match(r.headers['set-cookie'],/HttpOnly/)
  assert.equal(r.headers['cache-control'],'no-store')
  assert.equal((await request('jugador')).statusCode,401)
  assert.equal((await request('jugador','PUT',profile('Visita'),{cookie})).statusCode,401)
  assert.equal((await request('jugador/bienvenida','POST',{}, {cookie})).statusCode,401)
  assert.equal((await request('partidas','POST',{rival:B}, {cookie})).statusCode,401)
  r=await request('jugador/bienvenida','POST',{}, {cookie,origin:'https://malicious.invalid'})
  assert.equal(r.statusCode,403)
  r=await request('jugador','PUT',{...profile(),canton:'XX'}, auth)
  assert.equal(r.statusCode,400)
  const dilemma=(await db.query("SELECT id FROM suizamente_private.suizamente_preguntas WHERE payload->>'tipo'='dilema' LIMIT 1")).rows[0].id
  r=await request('preguntas/'+dilemma,'GET',null,auth)
  assert.equal(r.statusCode,200)
  assert.equal(r.body.dato,undefined)
  r=await request('votos','POST',{preguntaId:dilemma,opcion:0},auth)
  assert.equal(r.body.yaVotado,false)
  assert.ok(r.body.dato)
  r=await request('votos','POST',{preguntaId:dilemma,opcion:1},auth)
  assert.equal(r.body.yaVotado,true)
  assert.equal(r.body.opcion,0)
  r=await request('partidas','POST',{rival:B},auth)
  assert.equal(r.statusCode,200)
  let m=r.body
  await db.query("UPDATE suizamente_private.suizamente_partidas SET reglas=jsonb_set(reglas,'{ruleta,casillas}','[\"idioma\"]') WHERE id=$1",[m.id])
  r=await request('partidas/'+m.id+'/girar','POST',{turnoN:m.turnoN},auth)
  assert.equal(r.statusCode,200)
  let previous=m
  m=r.body
  r=await request('partidas/'+m.id+'/girar','POST',{turnoN:previous.turnoN},auth)
  assert.equal(r.statusCode,409)
  r=await request('partidas/'+m.id+'/pregunta','POST',{turnoN:m.turnoN,categoria:'idioma'},auth)
  assert.equal(r.statusCode,200)
  m=r.body
  assert.equal(m.pregunta.correcta,undefined)
  assert.equal(m.pregunta.dato,undefined)
  r=await request('votos','POST',{preguntaId:m.pregunta.preguntaId,opcion:0},auth)
  assert.equal(r.statusCode,409)
  const q=(await db.query('SELECT payload FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=$1',[m.id])).rows[0].payload
  await db.query("UPDATE suizamente_private.suizamente_partida_preguntas SET vence_en=clock_timestamp()-interval '2 seconds' WHERE partida_id=$1",[m.id])
  r=await request('partidas/'+m.id+'/respuesta','POST',{turnoN:m.turnoN,n:m.pregunta.n,opcion:q.correcta},auth)
  assert.equal(r.statusCode,200)
  assert.equal(r.body.resultado.ok,true,'3 second grace is measured by the server')
  const answer=r.body.resultado
  const existing=Number((await db.query('SELECT count(*) n FROM suizamente_private.suizamente_votos WHERE pregunta_id=$1',[answer.preguntaId])).rows[0].n)
  for(let i=existing;i<19;i++)await db.query('INSERT INTO suizamente_private.suizamente_votos(pregunta_id,jugador_id,opcion) VALUES($1,$2,$3)',[answer.preguntaId,'sample-'+i,q.correcta])
  assert.equal((await request('partidas/'+m.id,'GET',null,auth)).body.resultado.pct,null)
  await db.query('INSERT INTO suizamente_private.suizamente_votos(pregunta_id,jugador_id,opcion) VALUES($1,$2,$3)',[answer.preguntaId,'sample-20',q.correcta])
  assert.equal((await request('partidas/'+m.id,'GET',null,auth)).body.resultado.pct,100)
  r=await request('partidas/not-an-id/girar','POST',{},auth)
  assert.equal(r.statusCode,404)
  r=await request('jugador','POST',{},auth)
  assert.equal(r.statusCode,404)
  // A supplied jugador_id never overrides the authenticated account.
  r=await request('jugador','GET',null,{...auth,'x-jugador-id':B})
  assert.equal(r.body.identidad,A)
  await request('jugador/bienvenida','POST',{},auth)
  r=await request('perfil','GET',null,auth)
  assert.equal(r.statusCode,200)
  assert.equal(r.body.aciertos,1)
  const wallet=r.body.jugador.monedas
  assert.equal((await request('logros','GET',null,auth)).body.logros.length,16)
  r=await request('tienda','GET',null,auth)
  assert.equal(r.statusCode,200);assert.equal(r.body.regaloDisponible,true)
  r=await request('tienda/comprar','POST',{articulo:'escudo',clave:crypto.randomUUID()},auth)
  assert.equal(r.statusCode,402);assert.equal(r.body.error,'Te faltan 🪙 '+(150-wallet))
  r=await request('tienda/regalo','POST',{},auth)
  assert.equal(r.statusCode,200)
  r=await request('tienda/regalo','POST',{},auth);assert.equal(r.statusCode,409)
  r=await request('tienda/comprar','POST',{articulo:'tiempo',clave:crypto.randomUUID()},auth)
  assert.equal(r.statusCode,200)
  m=(await request('partidas/'+m.id,'GET',null,auth)).body
  r=await request('partidas/'+m.id+'/duelo','POST',{turnoN:m.turnoN,quitar:'idioma',apostar:'cultura'},auth)
  assert.equal(r.statusCode,409,'Duel route exists and rejects invalid phase')
  r=await request('partidas/'+m.id+'/girar','POST',{turnoN:m.turnoN},auth);m=r.body
  r=await request('partidas/'+m.id+'/pregunta','POST',{turnoN:m.turnoN,categoria:'idioma'},auth);m=r.body
  r=await request('partidas/'+m.id+'/comodin','POST',{turnoN:m.turnoN,n:m.pregunta.n,tipo:'tiempo'},auth)
  assert.equal(r.statusCode,200);assert.equal(r.body.pregunta.tiempo,45)
  assert.equal(r.body.pregunta.correcta,undefined);assert.equal(r.body.pregunta.dato,undefined)
  await db.exec('DELETE FROM suizamente_private.suizamente_limites')
  assert.equal((await request('mapa','GET',null,auth)).body.region,0)
  r=await request('mapa/construir','POST',{canton:'LU',nivel:0,clave:crypto.randomUUID()},auth)
  assert.equal(r.statusCode,200);assert.equal(r.body.niveles.LU,1)
  assert.equal((await request('album','GET',null,auth)).body.colecciones.length,5)
  const packKey=crypto.randomUUID()
  r=await request('sobres','POST',{clave:packKey,cartas:['carta-del-cliente']},auth)
  assert.equal(r.statusCode,200);assert.deepEqual(r.body.cartas,[])
  r=await request('sobres','POST',{clave:packKey},auth);assert.equal(r.statusCode,409)
  for(let i=0;i<3;i++){
    r=await request('sobres/'+packKey+'/girar','POST',{indice:i},auth)
    assert.equal(r.statusCode,200);assert.equal(r.body.cartas.length,i+1)
  }
  r=await request('partidas/'+m.id+'/rendirse','POST',{turnoN:m.turnoN+1},{authorization:'Bearer test-b',cookie})
  assert.equal(r.statusCode,200)
  m=(await request('partidas/'+m.id,'GET',null,auth)).body
  assert.ok(m.cofre.id)
  r=await request('cofres/'+m.cofre.id,'GET',null,auth);assert.equal(r.body.abierto,false)
  r=await request('cofres/'+m.cofre.id+'/abrir','POST',{},auth);assert.equal(r.body.contenido.monedas,80)
  r=await request('cofres/'+m.cofre.id+'/abrir','POST',{},auth);assert.equal(r.statusCode,409)
  assert.equal((await request('admin/resumen')).statusCode,403)
  assert.equal((await request('admin/economia','GET',null,auth)).statusCode,403)
  assert.equal((await request('capacidades','GET',null,auth)).body.admin,false)
  const adminAuth={authorization:'Bearer test-c'},economy=await request('admin/economia','GET',null,adminAuth)
  assert.equal(economy.statusCode,200)
  economy.body.juego.tienda.sobre=31
  r=await request('admin/economia','PUT',{version:economy.body.version,juego:economy.body.juego},adminAuth)
  assert.equal(r.statusCode,200)
  assert.equal((await request('config')).body.tienda.sobre,31)
  assert.equal((await request('admin/economia','PUT',{version:0,juego:economy.body.juego},adminAuth)).statusCode,409)
  assert.equal((await request('admin/economia','PUT',{juego:'x'.repeat(150000)},adminAuth)).statusCode,413)
  assert.equal((await request('propuestas','POST',{contenido:{},texto:'x'.repeat(20000)},auth)).statusCode,413)
  const day=(await request('dia','GET',null,auth)).body
  r=await request('dia/voto','POST',{fecha:day.fecha,preguntaId:day.id,opcion:0},auth)
  assert.equal(r.statusCode,200);assert.equal(r.body.resultado.pct,null)
  assert.equal((await request('libreta','PUT',{preguntaId:day.id,guardar:true},auth)).statusCode,200)
  assert.equal((await request('ranking?ambito=suiza','GET',null,auth)).statusCode,200)
  assert.equal((await request('perfiles/'+B,'GET',null,auth)).statusCode,200)
  assert.equal((await request('amigos','POST',{jugadorId:B,operacion:'seguir'},auth)).statusCode,200)
  console.log('HTTP: routes/statuses, cookies, same-origin writes, first votes, no early solutions, stale 409, grace, community endpoints, admin 403, body limits and live economy passed.')
}catch(e){console.error('HTTP v2:',e.message,e.where||'');process.exitCode=1}
finally{
  await db?.close()
  if(prior.url===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=prior.url
  if(prior.key===undefined)delete process.env.SUPABASE_ANON_KEY;else process.env.SUPABASE_ANON_KEY=prior.key
}
