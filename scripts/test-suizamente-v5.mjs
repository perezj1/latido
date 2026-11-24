import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {database,call,profile,step,A,B,C} from './lib/suizamente-v2-test-db.mjs'
let db
try{
  db=await database({mapa:true})
  const config=JSON.parse(await readFile('server/suizamente/data/juego.json','utf8'))
  for(const [id,name] of [[A,'Alex'],[B,'Lu'],[C,'Caro']]){
    await call(db,id,'guardar_jugador',profile(name));await call(db,id,'bienvenida')
  }
  await assert.rejects(call(db,A,'construir',{canton:'ZH',nivel:0,clave:crypto.randomUUID()}),/409/)
  let state=await call(db,A,'construir',{canton:'LU',nivel:0,clave:crypto.randomUUID()})
  assert.equal(state.jugador.monedas,40);assert.equal(state.niveles.LU,1)
  await assert.rejects(call(db,A,'construir',{canton:'LU',nivel:1,clave:crypto.randomUUID()}),/402:Te faltan 🪙 50/)
  await db.query("SELECT suizamente_private.v3_anotar($1,'fixture','mapa',100000)",[A])
  const initial=(await call(db,A,'jugador')).jugador.monedas
  let spent=0,chestIds=[]
  for(const [ri,region] of config.mapa.regiones.entries()){
    await db.exec('DELETE FROM suizamente_private.suizamente_limites')
    for(const canton of region.cantones){
      for(let n=ri===0&&canton.id==='LU'?1:0;n<config.mapa.nivelesPorCanton;n++){
        const key=crypto.randomUUID()
        state=await call(db,A,'construir',{canton:canton.id,nivel:n,clave:key})
        spent+=canton.costes[n]
        assert.equal(state.niveles[canton.id],n+1)
        assert.equal(state.jugador.monedas,initial-spent)
        await assert.rejects(call(db,A,'construir',{canton:canton.id,nivel:n,clave:key}),/409/)
      }
    }
    assert.equal(state.region,ri+1)
    assert.ok(state.cofre?.id)
    chestIds.push(state.cofre.id)
  }
  assert.equal(Object.keys(state.niveles).length,26)
  assert.equal(state.cofres.length,7)
  assert.ok((await call(db,A,'logros')).logros.find(l=>l.id==='suiza_entera').conseguido)
  await db.exec('DELETE FROM suizamente_private.suizamente_limites')
  let cofre=await call(db,A,'abrir_cofre',{id:chestIds[0]})
  assert.equal(cofre.contenido.monedas,200)
  assert.equal(cofre.contenido.inventario.sobres,1)
  await assert.rejects(call(db,A,'abrir_cofre',{id:chestIds[0]}),/409/)
  await assert.rejects(call(db,B,'abrir_cofre',{id:chestIds[0]}),/404/)
  for(const id of chestIds.slice(1,4))await call(db,A,'abrir_cofre',{id})
  assert.equal((await call(db,A,'jugador')).jugador.inventario.escudos,config.escudos.max)
  assert.equal((await call(db,A,'cofre',{id:chestIds[3]})).contenido.escudosAlMaximo,true)
  console.log('Map: all 26 cantons/configured costs, three levels, seven region transitions, 402, duplicate builds, one chest per region and shield reward cap passed.')
  await db.exec('DELETE FROM suizamente_private.suizamente_limites')
  for(const actor of [B,C]){
    await db.query("SELECT suizamente_private.v3_anotar($1,'fixture','mapa',1000)",[actor])
    await call(db,actor,'construir',{canton:'LU',nivel:0,clave:crypto.randomUUID()})
  }
  await db.exec("CREATE TABLE suizamente_private.suizamente_amigos(seguidor text,seguido text,estado text)")
  await db.query("INSERT INTO suizamente_private.suizamente_amigos VALUES($1,$2,'aceptado')",[A,B])
  let m=await call(db,A,'crear_partida',{rival:B})
  await db.query("UPDATE suizamente_private.suizamente_partidas SET reglas=jsonb_set(jsonb_set(reglas,'{ruleta,casillas}','[\"idioma\"]'),'{asaltos,probabilidadPorAcierto}','1') WHERE id=$1",[m.id])
  await db.exec("UPDATE suizamente_private.suizamente_preguntas SET oculta=jsonb_array_length(payload->'opciones')<>3")
  await db.query("SELECT suizamente_private.v3_anotar($1,'fixture','comodines',0,0,'{\"otra\":1,\"tiempo\":1,\"salta\":1}')",[A])
  async function raidAnswer(a,right){
    const q=(await db.query('SELECT payload FROM suizamente_private.suizamente_asaltos WHERE id=$1',[a.id])).rows[0].payload
    return call(db,A,'asalto_respuesta',{id:a.id,turnoN:a.turnoN,opcion:right?q.correcta:(q.correcta+1)%q.opciones.length})
  }
  for(let i=0;i<3;i++){
    await db.exec('DELETE FROM suizamente_private.suizamente_limites')
    m=await step(db,A,m,true)
    assert.ok(m.asalto?.id,'Offer is created transactionally from the correct answer')
    assert.equal(m.asalto.victima.apodo,'Lu','Friends are preferred over other eligible maps')
    const mainState={turnoN:m.turnoN,barra:m.tuBarra,xp:m.jugador.xp},before=m.jugador.monedas
    let a=await call(db,A,'asalto_empezar',{id:m.asalto.id,turnoN:m.asalto.turnoN})
    assert.equal(a.pregunta.correcta,undefined);assert.equal(a.pregunta.dato,undefined)
    await assert.rejects(call(db,A,'asalto_comodin',{id:a.id,turnoN:a.turnoN,tipo:'salta'}),/409/)
    if(i===0){
      const expiry=a.pregunta.venceEn
      a=await call(db,A,'asalto_comodin',{id:a.id,turnoN:a.turnoN,tipo:'tiempo'})
      assert.equal(Date.parse(a.pregunta.venceEn)-Date.parse(expiry),15000)
      await assert.rejects(call(db,A,'asalto_comodin',{id:a.id,turnoN:a.turnoN,tipo:'tiempo'}),/409/)
      a=await call(db,A,'asalto_comodin',{id:a.id,turnoN:a.turnoN,tipo:'otra'})
      a=await raidAnswer(a,false);assert.ok(a.pregunta);assert.equal(a.resultado,null)
    }
    if(i===1)await db.query("SELECT suizamente_private.v3_anotar($1,'fixture','escudo',0,0,'{\"escudos\":1}')",[B])
    if(i===2)await db.query("UPDATE suizamente_private.suizamente_asaltos SET vence_en=clock_timestamp()-interval '4 seconds' WHERE id=$1",[a.id])
    const answeredVersion=a.turnoN
    a=await raidAnswer(a,i<2)
    assert.equal(a.premio,i===0?100:i===1?30:0)
    if(i===2)assert.equal(a.resultado.agotada,true)
    await assert.rejects(call(db,A,'asalto_respuesta',{id:a.id,turnoN:answeredVersion,opcion:0}),/409/)
    assert.equal(a.jugador.monedas,before+a.premio)
    const after=await call(db,A,'partida',{id:m.id})
    assert.equal(after.turnoN,mainState.turnoN);assert.equal(after.tuBarra,mainState.barra);assert.equal(after.jugador.xp,mainState.xp)
    assert.equal((await call(db,B,'mapa')).niveles.LU,i===0?0:1)
    if(i===0)await call(db,B,'construir',{canton:'LU',nivel:0,clave:crypto.randomUUID()})
    if(i===1)assert.equal((await call(db,B,'jugador')).jugador.inventario.escudos,0)
  }
  m=await step(db,A,m,true,'idioma')
  assert.equal(m.asalto,undefined,'Daily cap counts offers, including failed attempts')
  assert.equal(Number((await db.query('SELECT count(*) n FROM suizamente_private.suizamente_asaltos WHERE jugador_id=$1',[A])).rows[0].n),3)
  assert.equal(Number((await db.query("SELECT count(*) n FROM public.app_notifications WHERE kind='suizamente_asalto' AND recipient_id=$1",[B])).rows[0].n),2)
  // A pending question may not damage a region which has since been completed.
  await db.exec("DELETE FROM suizamente_private.suizamente_limites; UPDATE suizamente_private.suizamente_asaltos SET fecha=fecha-1")
  m=await call(db,A,'crear_partida',{rival:B})
  await db.query("UPDATE suizamente_private.suizamente_partidas SET reglas=jsonb_set(jsonb_set(reglas,'{ruleta,casillas}','[\"idioma\"]'),'{asaltos,probabilidadPorAcierto}','1') WHERE id=$1",[m.id])
  m=await step(db,A,m,true)
  let a=await call(db,A,'asalto_empezar',{id:m.asalto.id,turnoN:m.asalto.turnoN})
  await assert.rejects(call(db,A,'girar',{id:m.id,turnoN:m.turnoN}),/409:Termina el asalto/)
  const beforeCancel=a.jugador.monedas
  await db.query("INSERT INTO suizamente_private.suizamente_mapa SELECT $1,1,k->>'id',3 FROM jsonb_array_elements(suizamente_private.v2_config()#>'{mapa,regiones,0,cantones}') k ON CONFLICT(jugador_id,vuelta,canton) DO UPDATE SET nivel=3",[B])
  a=await raidAnswer(a,true)
  assert.equal(a.estado,'cancelado');assert.equal(a.motivo,'objetivo_no_disponible');assert.equal(a.premio,0)
  assert.equal(a.jugador.monedas,beforeCancel)
  assert.equal((await call(db,B,'mapa')).niveles.LU,3)
  assert.equal((await call(db,A,'partida',{id:m.id})).turnoN,m.turnoN)
  await db.exec(await readFile('supabase/suizamente_v5_mapa_asaltos.sql','utf8'))
  assert.equal((await call(db,A,'mapa')).cofres.length,3)
  // Merge map progress and an unopened region chest without duplicating its reward.
  const guest='dddddddd-dddd-4ddd-8ddd-dddddddddddd',guestActor='invitado-'+guest,secret='d'.repeat(64)
  await db.exec('DELETE FROM suizamente_private.suizamente_limites')
  await call(db,null,'guardar_jugador',profile('Visita mapa'),guest,secret)
  await call(db,null,'bienvenida',{},guest,secret)
  await db.query("SELECT suizamente_private.v3_anotar($1,'fixture','guestmap',3000)",[guestActor])
  await db.query("INSERT INTO suizamente_private.suizamente_mapa SELECT $1,1,k->>'id',3 FROM jsonb_array_elements(suizamente_private.v2_config()#>'{mapa,regiones,0,cantones}') k",[guestActor])
  const guestChest=(await db.query("SELECT suizamente_private.v5_cofre($1,'region','1:0','Región completa',suizamente_private.v2_config()#>'{cofres,region}') id",[guestActor])).rows[0].id
  await call(db,C,'vincular',{},guest,secret)
  assert.equal((await call(db,C,'mapa')).region,1)
  assert.equal((await call(db,C,'cofre',{id:guestChest})).abierto,false)
  assert.equal((await call(db,C,'abrir_cofre',{id:guestChest})).contenido.monedas,200)
  for(const role of ['anon','authenticated'])for(const table of ['suizamente_mapa','suizamente_cofres','suizamente_asaltos']){
    await assert.rejects(db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE '+role);return tx.query('SELECT * FROM suizamente_private.'+table)}),/permission denied/)
  }
  console.log('Raids: friend priority, server-only questions, power-ups, retry, first votes, damage/shield/failure, unique payouts, unchanged match turn/XP, daily cap, notifications and RLS passed.')
}catch(e){console.error('Map/raids:',e.message,e.where||'',e.internalQuery||'');process.exitCode=1}
finally{await db?.close()}
