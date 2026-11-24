import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {database,call,profile,A,B} from './lib/suizamente-v2-test-db.mjs'
let db
try{
  db=await database({tienda:true})
  for(const [id,name]of[[A,'Alex'],[B,'Lu']]){await call(db,id,'guardar_jugador',profile(name));await call(db,id,'bienvenida')}
  await db.query("SELECT suizamente_private.v3_anotar($1,'fixture','saldo',1000,0,'{\"quita\":4,\"otra\":4,\"salta\":4,\"tiempo\":4}')",[A])
  let buy=await call(db,A,'comprar',{articulo:'salta',clave:crypto.randomUUID()})
  assert.equal(buy.jugador.monedas,1080)
  await assert.rejects(call(db,B,'comprar',{articulo:'escudo',clave:crypto.randomUUID()}),/402:Te faltan 🪙 50/)
  const key=crypto.randomUUID()
  buy=await call(db,A,'comprar',{articulo:'sobre',clave:key})
  await assert.rejects(call(db,A,'comprar',{articulo:'sobre',clave:key}),/409/)
  for(let i=0;i<3;i++)await call(db,A,'comprar',{articulo:'escudo',clave:crypto.randomUUID()})
  await assert.rejects(call(db,A,'comprar',{articulo:'escudo',clave:crypto.randomUUID()}),/409/)
  const gift=await call(db,A,'regalo')
  assert.ok(gift.comodin)
  await assert.rejects(call(db,A,'regalo'),/409/)
  assert.equal((await call(db,A,'tienda')).regaloDisponible,false)
  const date=(await db.query("SELECT (clock_timestamp() AT TIME ZONE 'Europe/Zurich')::date::text date_key")).rows[0].date_key
  assert.equal((await db.query("SELECT ref FROM suizamente_private.suizamente_movimientos WHERE jugador_id=$1 AND motivo='regalo_diario'",[A])).rows[0].ref,date)
  console.log('Store: configured prices, 402, repeat purchase, shield cap, inventory and Zurich daily gift passed.')
  await db.exec("UPDATE suizamente_private.suizamente_preguntas SET oculta=jsonb_array_length(payload->'opciones')<>3")
  let m=await call(db,A,'crear_partida',{rival:B})
  await db.query("UPDATE suizamente_private.suizamente_partidas SET reglas=jsonb_set(reglas,'{ruleta,casillas}','[\"idioma\"]') WHERE id=$1",[m.id])
  async function ask(actor,state,cat='idioma'){
    let x=state
    if(x.fase==='girar')x=await call(db,actor,'girar',{id:x.id,turnoN:x.turnoN})
    return call(db,actor,'pregunta',{id:x.id,turnoN:x.turnoN,categoria:cat})
  }
  async function answer(actor,state,right=true){
    const q=(await db.query('SELECT payload FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=$1 AND n=$2',[state.id,state.pregunta.n])).rows[0].payload
    return call(db,actor,'respuesta',{id:state.id,turnoN:state.turnoN,n:state.pregunta.n,opcion:right?q.correcta:(q.correcta+1)%q.opciones.length})
  }
  m=await ask(A,m)
  const before=(await call(db,A,'jugador')).jugador
  const q=(await db.query('SELECT payload FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=$1 AND n=$2',[m.id,m.pregunta.n])).rows[0].payload
  const removeArgs={id:m.id,turnoN:m.turnoN,n:m.pregunta.n,tipo:'quita'}
  m=await call(db,A,'comodin',removeArgs)
  assert.equal(m.pregunta.quitadas.length,1)
  assert.notEqual(m.pregunta.quitadas[0],q.correcta)
  assert.equal(m.pregunta.correcta,undefined);assert.equal(m.pregunta.dato,undefined)
  await assert.rejects(call(db,A,'comodin',removeArgs),/409/)
  await assert.rejects(call(db,A,'comodin',{...removeArgs,turnoN:m.turnoN}),/409/,'A new version still cannot spend the same type twice')
  await assert.rejects(call(db,A,'respuesta',{id:m.id,turnoN:m.turnoN,n:m.pregunta.n,opcion:m.pregunta.quitadas[0]}),/409/)
  m=await call(db,A,'comodin',{id:m.id,turnoN:m.turnoN,n:m.pregunta.n,tipo:'otra'})
  const wrong=m.pregunta.opciones.find(o=>o.indice!==q.correcta&&!m.pregunta.quitadas.includes(o.indice)).indice
  m=await call(db,A,'respuesta',{id:m.id,turnoN:m.turnoN,n:m.pregunta.n,opcion:wrong})
  assert.ok(m.pregunta)
  assert.equal(m.pregunta.otraUsada,true)
  assert.equal(m.resultado,null)
  assert.equal(m.jugador.monedas,before.monedas)
  assert.equal((await call(db,A,'votos_mios')).votos[q.id],wrong)
  m=await call(db,A,'respuesta',{id:m.id,turnoN:m.turnoN,n:m.pregunta.n,opcion:q.correcta})
  assert.equal(m.resultado.ok,true)
  assert.equal(m.jugador.monedas,before.monedas+5)
  assert.equal((await call(db,A,'votos_mios')).votos[q.id],wrong)
  m=await ask(A,m)
  const sent=m.pregunta.enviadaEn,expires=m.pregunta.venceEn
  m=await call(db,A,'comodin',{id:m.id,turnoN:m.turnoN,n:m.pregunta.n,tipo:'tiempo'})
  assert.equal(m.pregunta.tiempo,45)
  assert.equal(Date.parse(m.pregunta.venceEn)-Date.parse(expires),15000)
  assert.equal(m.pregunta.enviadaEn,sent)
  const oldN=m.pregunta.n,oldId=m.pregunta.preguntaId
  m=await call(db,A,'comodin',{id:m.id,turnoN:m.turnoN,n:m.pregunta.n,tipo:'salta'})
  assert.notEqual(m.pregunta.n,oldN);assert.notEqual(m.pregunta.preguntaId,oldId)
  assert.equal(m.pregunta.tiempo,30)
  assert.equal((await db.query('SELECT omitida FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=$1 AND n=$2',[m.id,oldN])).rows[0].omitida,true)
  m=await answer(A,m)
  await db.exec("UPDATE suizamente_private.suizamente_preguntas SET oculta=jsonb_array_length(payload->'opciones')<>2")
  m=await ask(A,m)
  for(const tipo of ['quita','otra'])await assert.rejects(call(db,A,'comodin',{id:m.id,turnoN:m.turnoN,n:m.pregunta.n,tipo}),/409/)
  const beforeForbidden=m.jugador.inventario.salta
  await db.query("UPDATE suizamente_private.suizamente_partida_preguntas SET modo='sello' WHERE partida_id=$1 AND n=$2",[m.id,m.pregunta.n])
  await assert.rejects(call(db,A,'comodin',{id:m.id,turnoN:m.turnoN,n:m.pregunta.n,tipo:'salta'}),/409/)
  assert.equal((await call(db,A,'jugador')).jugador.inventario.salta,beforeForbidden)
  for(const role of ['anon','authenticated']){
    for(const table of ['suizamente_movimientos','suizamente_inventario','suizamente_logros','suizamente_duelos_sello']){
      await assert.rejects(db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE '+role);return tx.query('SELECT * FROM suizamente_private.'+table)}),/permission denied/)
    }
  }
  await db.exec('UPDATE suizamente_private.suizamente_preguntas SET oculta=false')
  console.log('Power-ups: server elimination, one use, no early solutions, second chance/first vote, +15s, replacement and two-option restrictions passed.')
  async function duel(){
    // Reset the rate window between independent integration scenarios.
    await db.exec('DELETE FROM suizamente_private.suizamente_limites')
    let x=await call(db,A,'crear_partida',{rival:B})
    await db.query("UPDATE suizamente_private.suizamente_partidas SET sellos_a=ARRAY['idioma'],sellos_b=ARRAY['cultura'],fase='sello' WHERE id=$1",[x.id])
    x=await call(db,A,'partida',{id:x.id})
    assert.equal(x.dueloDisponible,true)
    return call(db,A,'duelo',{id:x.id,turnoN:x.turnoN,quitar:'cultura',apostar:'idioma'})
  }
  async function six(actor,state,correctCount){
    let x=state
    for(let i=0;i<6;i++){
      if(!x.pregunta)x=await ask(actor,x)
      assert.equal(x.pregunta.correcta,undefined)
      await assert.rejects(call(db,actor,'comodin',{id:x.id,turnoN:x.turnoN,n:x.pregunta.n,tipo:'salta'}),/409/)
      x=await answer(actor,x,i<correctCount)
    }
    return x
  }
  m=await duel()
  const did=m.duelo.id
  m=await six(A,m,6)
  assert.equal(m.teToca,false)
  m=await call(db,B,'partida',{id:m.id})
  m=await six(B,m,0)
  assert.equal(m.duelo.ganador,A)
  const pairs=(await db.query("SELECT jugador_id,array_agg(pregunta_id ORDER BY duelo_indice) ids FROM suizamente_private.suizamente_partida_preguntas WHERE duelo_id=$1 GROUP BY jugador_id",[did])).rows
  assert.deepEqual(pairs[0].ids,pairs[1].ids)
  m=await call(db,A,'partida',{id:m.id})
  assert.deepEqual(m.tusSellos,['idioma','cultura']);assert.deepEqual(m.susSellos,[])
  assert.equal(m.teToca,false)
  assert.equal((await db.query("SELECT monedas FROM suizamente_private.suizamente_movimientos WHERE jugador_id=$1 AND motivo='duelo_sello' AND ref=$2",[A,did])).rows[0].monedas,20)
  await db.query('SELECT suizamente_private.v4_final_duelo($1,$2)',[did,A])
  assert.equal(Number((await db.query("SELECT count(*) n FROM suizamente_private.suizamente_movimientos WHERE motivo='duelo_sello' AND ref=$1",[did])).rows[0].n),1)
  m=await duel();m=await six(A,m,3);m=await call(db,B,'partida',{id:m.id});m=await six(B,m,3)
  assert.equal(m.duelo.estado,'desempate_a')
  m=await call(db,A,'partida',{id:m.id});m=await ask(A,m);const tieId=m.pregunta.preguntaId;m=await answer(A,m,true)
  m=await call(db,B,'partida',{id:m.id});m=await ask(B,m);assert.equal(m.pregunta.preguntaId,tieId);m=await answer(B,m,false)
  assert.equal(m.duelo.ganador,A)
  m=await duel();m=await six(A,m,0);m=await call(db,B,'partida',{id:m.id});m=await six(B,m,6)
  assert.equal(m.duelo.ganador,B)
  assert.equal(m.teToca,true)
  assert.deepEqual(m.tusSellos,['cultura','idioma'])
  assert.deepEqual(m.susSellos,[])
  // Equal tie-break correctness is decided with the server's elapsed time.
  m=await duel();m=await six(A,m,3);m=await call(db,B,'partida',{id:m.id});m=await six(B,m,3)
  m=await call(db,A,'partida',{id:m.id});m=await ask(A,m)
  await db.query("UPDATE suizamente_private.suizamente_partida_preguntas SET enviada_en=clock_timestamp()-interval '9 seconds' WHERE partida_id=$1 AND n=$2",[m.id,m.pregunta.n])
  m=await answer(A,m,true)
  m=await call(db,B,'partida',{id:m.id});m=await ask(B,m);m=await answer(B,m,true)
  assert.equal(m.duelo.ganador,B,'Both correct: faster server elapsed time wins')
  // An unfinished duel cannot move stamps after the match has ended.
  for(const reason of ['rendicion','plazo']){
    m=await duel();const cancelledId=m.duelo.id
    const before=(await call(db,A,'jugador')).jugador
    if(reason==='rendicion')m=await call(db,A,'rendirse',{id:m.id,turnoN:m.turnoN})
    else{
      await db.query("UPDATE suizamente_private.suizamente_partidas SET plazo=clock_timestamp()-interval '1 second' WHERE id=$1",[m.id])
      m=await call(db,A,'partida',{id:m.id})
    }
    assert.equal(m.duelo.estado,'cancelado')
    assert.equal(m.jugador.monedas,before.monedas)
    await db.query('SELECT suizamente_private.v4_final_duelo($1,$2)',[cancelledId,B])
    assert.equal(Number((await db.query("SELECT count(*) n FROM suizamente_private.suizamente_movimientos WHERE motivo='duelo_sello' AND ref=$1",[cancelledId])).rows[0].n),0)
    assert.deepEqual(m.tusSellos,['idioma'])
  }
  await db.exec(await readFile('supabase/suizamente_v3_economia.sql','utf8'))
  await db.exec(await readFile('supabase/suizamente_v4_tienda_duelo.sql','utf8'))
  assert.equal((await call(db,B,'partida',{id:m.id})).duelo.estado,'cancelado')
  console.log('Duels: identical six questions, per-player turns, disabled skip, win/loss stakes, tie question, unique stamp prize and repeatable migration passed.')
}catch(e){console.error('Store/duel:',e.message,e.detail||'',e.where||'',e.internalQuery||'',e.position||'');process.exitCode=1}
finally{await db?.close()}
