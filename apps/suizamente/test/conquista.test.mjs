import test from 'node:test'
import assert from 'node:assert/strict'
import {conquistaFixture,alice,bob,token} from './conquista-db.mjs'
import {createSuizamenteConquistaGateway,CONQUISTA_PREVIEW_ORIGIN} from '../../../supabase/functions/_shared/suizamenteConquistaGateway.js'

test('Conquista: protected questions, persistent maps, wallet, advantages, escrow and asynchronous territorial battles',async()=>{
 const f=await conquistaFixture(),{db,call,mutate}=f
 const balance=async id=>(await call('estado',{},id)).saldo
 const correct=async q=>(await db.query('SELECT correcta FROM suizamente_conquista.preguntas WHERE id=$1',[q])).rows[0].correcta
 async function finish(round,{misses=0,id=alice}={}){
  while(round.estado==='activa'){
   const q=round.pregunta,answer=await correct(q.id)
   round=await mutate('responder',{id:round.id,pregunta:q.id,opcion:misses-->0?(answer+1)%4:answer},id)
  }
  return round
 }
 async function owned(canton,id=bob){await db.query('INSERT INTO suizamente_conquista.territorios(usuario,canton) VALUES($1,$2) ON CONFLICT(usuario,canton) DO UPDATE SET poseido=true',[id,canton])}
 async function battle(canton){
  await owned(canton)
  const b=await mutate('desafiar',{canton,defensor:bob})
  assert.equal(b.estado,'pendiente')
  return mutate('aceptar',{id:b.id},bob)
 }
 async function rounds(b){return (await db.query('SELECT id,usuario FROM suizamente_conquista.partidas WHERE batalla=$1',[b.id])).rows}
 try{
  await db.exec(f.sql) // installation is additive and repeatable
  const state=await call('estado');assert.equal(state.cantones.length,26);assert.ok(state.cantones.every(c=>c.preguntasDisponibles===50))
  assert.equal(state.saldo,5000);assert.equal(state.xp,5000);assert.equal((await call('estado')).saldo,5000)
  const gateway=createSuizamenteConquistaGateway({getClient:()=>f.client,getSecret:()=> 'fixture',questions:new Map(f.questions.map(q=>[q.id,q.opciones.length]))})
  for(const path of ['/state','/social/profile','/base/votos/mios']){
   const response=await gateway({method:'GET',url:'https://test/functions/v1/suizamente-conquista'+path,headers:{authorization:'Bearer '+token(alice),origin:CONQUISTA_PREVIEW_ORIGIN},body:{},address:'fixture'})
   assert.equal(response.status,200);assert.equal(response.headers['Access-Control-Allow-Origin'],CONQUISTA_PREVIEW_ORIGIN)
  }
  assert.equal((await f.api({method:'GET',url:'https://test/functions/v1/suizamente-conquista/state',headers:{}})).status,401)
  assert.equal((await f.api({method:'GET',url:'https://test/functions/v1/suizamente-conquista/state',headers:{authorization:'Bearer '+token(alice),origin:'https://evil.example'}})).status,403)
  for(const role of ['anon','authenticated'])assert.equal((await db.query("SELECT has_function_privilege($1,'public.suizamente_conquista_api(uuid,text,jsonb)','EXECUTE') ok",[role])).rows[0].ok,false)
  const request={ventaja:'escudo',solicitud:crypto.randomUUID()}
  const bought=await call('comprar',request);assert.equal(bought.saldo,4940)
  assert.equal((await call('comprar',request)).saldo,4940)
  await assert.rejects(call('comprar',{...request,ventaja:'segunda'}),e=>e.code==='PT409')
  await mutate('comprar',{ventaja:'cincuenta'})
  let round=await mutate('iniciar',{canton:'ZH',ventajas:['escudo','cincuenta']})
  assert.equal((await balance(alice)),4830)
  assert.doesNotMatch(JSON.stringify(round),/"correcta"|"explicacion"|"fuente"/)
  await assert.rejects(call('partida',{id:round.id},bob),e=>e.code==='PT404')
  await assert.rejects(mutate('iniciar',{canton:'BE'}),e=>e.code==='PT409')
  const hint=await mutate('ventaja',{id:round.id,pregunta:round.pregunta.id,ventaja:'cincuenta'})
  assert.equal(hint.pregunta.descartadas.length,2);assert.ok(!hint.pregunta.descartadas.includes(await correct(hint.pregunta.id)))
  await assert.rejects(mutate('ventaja',{id:round.id,pregunta:round.pregunta.id,ventaja:'cincuenta'}),e=>e.code==='PT409')
  const first=round.pregunta.id,answer=await correct(first),safeWrong=[0,1,2,3].find(i=>i!==answer&&!hint.pregunta.descartadas.includes(i))
  const submit={id:round.id,pregunta:first,opcion:safeWrong,solicitud:crypto.randomUUID()}
  round=await call('responder',submit);assert.equal(round.respondidas,1)
  assert.deepEqual(await call('responder',submit),round)
  round=await finish(round);assert.equal(round.estado,'ganada');assert.equal(round.aciertos,5)
  assert.equal((await call('estado')).conquistados,1)
  assert.equal(round.revision.length,5)
  await assert.rejects(mutate('iniciar',{canton:'ZH'}),e=>e.code==='PT409')
  await mutate('comprar',{ventaja:'segunda'})
  round=await mutate('iniciar',{canton:'BE',ventajas:['segunda']})
  const qid=round.pregunta.id,a=await correct(qid),retryRequest={id:round.id,pregunta:qid,opcion:(a+1)%4,solicitud:crypto.randomUUID()}
  round=await call('responder',retryRequest);assert.equal(round.respondidas,0);assert.equal(round.pregunta.reintento,true)
  assert.deepEqual(await call('responder',retryRequest),round)
  round=await finish(round);assert.equal(round.estado,'ganada')
  const xp=(await call('estado')).xp;assert.equal(xp,5000)
  await db.query("INSERT INTO suizamente_social.puntos(jugador,motivo,ref,cantidad) VALUES($1,'test','new',30)",['user:'+alice])
  const before=await balance(alice);assert.equal((await call('estado')).saldo,before);assert.equal((await call('estado')).xp,5030)
  await f.reset()
  await call('estado',{},bob)
  await db.query("INSERT INTO suizamente_social.amistades(solicitante,destinatario,estado) VALUES($1,$2,'aceptada')",['user:'+alice,'user:'+bob])
  await owned('LU')
  await assert.rejects(mutate('desafiar',{canton:'LU',defensor:bob}),e=>e.code==='PT409')
  await mutate('preferencias',{competitivo:true},bob)
  await mutate('preferencias',{competitivo:true})
  const beforeInvite=await balance(alice),invited=await mutate('desafiar',{canton:'LU',defensor:bob})
  await assert.rejects(mutate('iniciar',{canton:'LU'}),e=>e.code==='PT409')
  assert.equal((await call('estado',{},bob)).sinLeer,1)
  assert.equal((await mutate('avisos_leer',{},bob)).sinLeer,0)
  assert.equal(await balance(alice),beforeInvite,'Invitations never reserve the stake')
  const accepted=await mutate('aceptar',{id:invited.id},bob)
  assert.equal(await balance(alice),beforeInvite-100)
  const players=await rounds(accepted),attacker=players.find(p=>p.usuario===alice),defender=players.find(p=>p.usuario===bob)
  const stored=(await db.query('SELECT preguntas FROM suizamente_conquista.partidas WHERE batalla=$1',[accepted.id])).rows
  assert.deepEqual(stored[0].preguntas,stored[1].preguntas)
  const attackerDone=await finish(await call('partida',{id:attacker.id}),{misses:1})
  assert.equal(attackerDone.revision,null,'Solutions stay hidden until both players finish')
  assert.equal((await call('batalla',{id:accepted.id})).susAciertos,null)
  await finish(await call('partida',{id:defender.id},bob),{misses:2,id:bob})
  const resolved=await call('batalla',{id:accepted.id});assert.equal(resolved.ganador,alice);assert.equal(resolved.misAciertos,9);assert.equal(resolved.susAciertos,8)
  assert.equal(await balance(alice),beforeInvite)
  assert.equal((await call('estado')).cantones.find(c=>c.codigo==='LU').poseido,true)
  assert.equal((await call('estado',{},bob)).cantones.find(c=>c.codigo==='LU').poseido,false)
  await call('batalla',{id:accepted.id});assert.equal(await balance(alice),beforeInvite)
  for(const [canton,missA,missB,winner] of [['FR',0,0,null],['GE',2,0,bob]]){
   await f.reset();const startA=await balance(alice),startB=await balance(bob),b=await battle(canton)
   for(const row of await rounds(b))await finish(await call('partida',{id:row.id},row.usuario),{misses:row.usuario===alice?missA:missB,id:row.usuario})
   assert.equal((await call('batalla',{id:b.id})).ganador,winner)
   assert.equal(await balance(alice),startA-(winner===bob?100:0))
   assert.equal(await balance(bob),startB+(winner===bob?100:0))
  }
  await f.reset();await owned('VD');const stakeBefore=await balance(alice)
  const rejected=await mutate('desafiar',{canton:'VD',defensor:bob});await mutate('rechazar',{id:rejected.id},bob);assert.equal(await balance(alice),stakeBefore)
  const expired=await mutate('desafiar',{canton:'VD',defensor:bob});await db.query("UPDATE suizamente_conquista.batallas SET vence_en=now()-interval '1 second' WHERE id=$1",[expired.id]);assert.equal((await call('batalla',{id:expired.id})).estado,'caducada');assert.equal(await balance(alice),stakeBefore)
  const timeout=await battle('TI');await db.query("UPDATE suizamente_conquista.batallas SET vence_en=now()-interval '1 second' WHERE id=$1",[timeout.id]);assert.equal((await call('batalla',{id:timeout.id})).motivo,'sin_finalizar');assert.equal(await balance(alice),stakeBefore)
  await db.query('UPDATE suizamente_conquista.billeteras SET saldo=0 WHERE usuario=$1',[alice])
  const count=(await call('estado')).inventario.escudo||0
  await assert.rejects(mutate('comprar',{ventaja:'escudo'}),e=>e.code==='PT409');assert.equal((await call('estado')).inventario.escudo||0,count)
  assert.equal((await db.query("SELECT count(*)::integer n FROM public.app_notifications")).rows[0].n,0,'Development game notices stay out of the existing app inbox')
  await db.query('UPDATE suizamente_conquista.billeteras SET saldo=1000 WHERE usuario=$1',[alice])
  const deleting=await battle('UR');assert.equal(deleting.estado,'activa');assert.equal(await balance(alice),900)
  const deleted=await gateway({method:'DELETE',url:'https://test/functions/v1/suizamente-conquista/social/profile',headers:{authorization:'Bearer '+token(bob),origin:CONQUISTA_PREVIEW_ORIGIN},body:{confirmacion:'BORRAR',confirmado:true},address:'fixture'})
  assert.equal(deleted.status,200)
  assert.equal(await balance(alice),1000,'Deleting a defender refunds the other player before cascading records')
  assert.equal((await db.query('SELECT count(*)::integer n FROM suizamente_conquista.billeteras WHERE usuario=$1',[bob])).rows[0].n,0)
 }finally{await db.close()}
})
