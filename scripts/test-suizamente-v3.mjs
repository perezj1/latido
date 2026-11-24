import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {database,call,profile,step,A,B,G} from './lib/suizamente-v2-test-db.mjs'
let db
try{
  db=await database({economia:true})
  for(const [id,name] of [[A,'Alex'],[B,'Lu']]){
    await call(db,id,'guardar_jugador',profile(name));await call(db,id,'bienvenida')
  }
  let m=await call(db,A,'crear_partida',{rival:B})
  await db.query("UPDATE suizamente_private.suizamente_partidas SET reglas=jsonb_set(reglas,'{ruleta,casillas}','[\"idioma\"]') WHERE id=$1",[m.id])
  m=await step(db,A,m,true)
  assert.equal(m.jugador.monedas,105)
  assert.equal(m.jugador.xp,10)
  assert.equal(m.resultado.ganado.monedas,5)
  assert.equal(m.jugador.racha,1)
  assert.ok(m.novedades.some(n=>n.datos.logro==='llegada'))
  await assert.rejects(call(db,A,'respuesta',{id:m.id,turnoN:m.turnoN-1,n:m.resultado.n,opcion:0}),/409/)
  assert.equal((await call(db,A,'jugador')).jugador.monedas,105)
  m=await step(db,A,m,true)
  m=await step(db,A,m,true)
  m=await step(db,A,m,true,'idioma')
  assert.equal(m.jugador.monedas,135)
  assert.equal(m.jugador.xp,40)
  await db.query("UPDATE suizamente_private.suizamente_partidas SET reglas=jsonb_set(reglas,'{ruleta,casillas}','[\"sello\"]') WHERE id=$1",[m.id])
  for(const cat of ['cultura','comida','papeles','casa','dia'])m=await step(db,A,m,true,cat)
  assert.equal(m.estado,'terminada')
  assert.equal(m.premio.monedas,100)
  assert.equal(m.premio.xp,150)
  assert.equal(m.jugador.monedas,335)
  assert.equal((await call(db,B,'jugador')).jugador.monedas,110)
  const before=m.jugador.monedas
  await db.exec(await readFile('supabase/suizamente_v3_economia.sql','utf8'))
  assert.equal((await call(db,A,'jugador')).jugador.monedas,before)
  assert.equal((await call(db,A,'perfil')).ganadas,1)
  assert.equal((await call(db,B,'perfil')).perdidas,1)
  assert.equal((await call(db,A,'perfil')).especialidad,null,'Category cards need two categories with 20 answers')
  // Real question snapshots, with enough historical responses for the profile threshold.
  for(const [category,right] of [['idioma',true],['cultura',false]]){
    await db.query("INSERT INTO suizamente_private.suizamente_partida_preguntas(partida_id,jugador_id,n,modo,categoria,pregunta_id,payload,orden,enviada_en,vence_en,opcion,acierto,respondida_en) SELECT $1,$2,(SELECT max(n) FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=$1)+g,'normal',$3,pregunta_id,payload,orden,clock_timestamp(),clock_timestamp(),0,$4,clock_timestamp() FROM (SELECT * FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=$1 LIMIT 1) q CROSS JOIN generate_series(1,20) g",[m.id,A,category,right])
  }
  let performance=await call(db,A,'perfil')
  assert.equal(performance.especialidad.categoria,'idioma')
  assert.equal(performance.cuesta.categoria,'cultura')
  assert.equal(performance.logros.find(l=>l.id==='poliglota').conseguido,false)
  await db.query("INSERT INTO suizamente_private.suizamente_partida_preguntas(partida_id,jugador_id,n,modo,categoria,pregunta_id,payload,orden,enviada_en,vence_en,opcion,acierto,respondida_en) SELECT $1,$2,(SELECT max(n) FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=$1)+g,'normal','idioma',pregunta_id,payload,orden,clock_timestamp(),clock_timestamp(),0,true,clock_timestamp() FROM (SELECT * FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=$1 LIMIT 1) q CROSS JOIN generate_series(1,80) g",[m.id,A])
  assert.equal((await call(db,A,'logros')).logros.find(l=>l.id==='poliglota').conseguido,true)
  await call(db,A,'logros')
  assert.equal(Number((await db.query("SELECT count(*) n FROM suizamente_private.suizamente_novedades WHERE jugador_id=$1 AND tipo='logro' AND ref='poliglota'",[A])).rows[0].n),1)
  for(const [xp,level,within,required] of [[0,1,0,350],[349,1,349,350],[350,2,0,500],[850,3,0,650]]){
    const x=(await db.query('SELECT suizamente_private.v3_progreso($1) p',[xp])).rows[0].p
    assert.deepEqual(x,{nivel:level,xpNivel:within,xpNecesaria:required})
  }
  await db.query("SELECT suizamente_private.v3_anotar($1,'prueba','nivel',0,1000)",[A])
  assert.ok((await call(db,A,'jugador')).novedades.some(n=>n.tipo==='nivel'))
  const today='2026-11-23'
  await db.query('DELETE FROM suizamente_private.suizamente_actividad_dias WHERE jugador_id=$1',[A])
  for(const date of ['2026-11-20','2026-11-21','2026-11-22'])await db.query('INSERT INTO suizamente_private.suizamente_actividad_dias VALUES($1,$2)',[A,date])
  assert.equal((await db.query('SELECT suizamente_private.v3_racha($1,$2) n',[A,today])).rows[0].n,3)
  assert.equal((await db.query("SELECT suizamente_private.v3_racha($1,'2026-11-24') n",[A])).rows[0].n,0)
  await db.query("SELECT suizamente_private.v3_actividad($1,'2026-03-28 23:30:00+00')",[A])
  assert.ok((await db.query("SELECT fecha::text FROM suizamente_private.suizamente_actividad_dias WHERE jugador_id=$1",[A])).rows.some(r=>r.fecha==='2026-03-29'))
  await db.query("SELECT suizamente_private.v3_actividad($1,'2026-10-24 22:30:00+00')",[A])
  assert.ok((await db.query("SELECT fecha::text FROM suizamente_private.suizamente_actividad_dias WHERE jugador_id=$1",[A])).rows.some(r=>r.fecha==='2026-10-25'))
  assert.equal((await call(db,A,'logros')).logros.length,16)
  await db.query("INSERT INTO suizamente_private.suizamente_actividad_dias SELECT $1,(clock_timestamp() AT TIME ZONE 'Europe/Zurich')::date-g FROM generate_series(0,6) g ON CONFLICT DO NOTHING",[A])
  assert.equal((await call(db,A,'logros')).logros.find(l=>l.id==='constancia').conseguido,true)
  const notices=(await call(db,A,'jugador')).novedades
  await call(db,A,'novedades_leer',{ids:notices.map(n=>n.id)})
  assert.equal((await call(db,A,'jugador')).novedades.length,0)
  for(const reason of ['rendicion','plazo']){
    await db.exec('DELETE FROM suizamente_private.suizamente_limites')
    let game=await call(db,A,'crear_partida',{rival:B})
    const beforeA=(await call(db,A,'jugador')).jugador,beforeB=(await call(db,B,'jugador')).jugador
    if(reason==='rendicion')game=await call(db,A,'rendirse',{id:game.id,turnoN:game.turnoN})
    else{
      await db.query("UPDATE suizamente_private.suizamente_partidas SET plazo=clock_timestamp()-interval '1 minute' WHERE id=$1",[game.id])
      game=await call(db,A,'partida',{id:game.id})
    }
    assert.equal(game.premio.monedas,0)
    assert.equal(game.jugador.monedas,beforeA.monedas)
    assert.equal(game.jugador.xp,beforeA.xp)
    assert.equal((await call(db,B,'jugador')).jugador.monedas,beforeB.monedas+100)
    await call(db,A,'partida',{id:game.id})
    assert.equal((await call(db,B,'jugador')).jugador.monedas,beforeB.monedas+100)
  }
  await call(db,null,'guardar_jugador',profile('Invitado'))
  await call(db,null,'bienvenida')
  await db.query("SELECT suizamente_private.v3_anotar($1,'prueba','guest',15,10)",['invitado-'+G])
  await db.query("SELECT suizamente_private.v3_actividad($1,clock_timestamp())",['invitado-'+G])
  await db.query("INSERT INTO suizamente_private.suizamente_logros(jugador_id,logro) VALUES($1,'constancia')",['invitado-'+G])
  const preMerge=(await call(db,A,'jugador')).jugador
  await call(db,A,'vincular')
  const merged=(await call(db,A,'jugador')).jugador
  assert.equal(merged.monedas,preMerge.monedas+15,'Welcome remains unique after linking')
  assert.equal(merged.xp,preMerge.xp+10)
  assert.equal(merged.inventario.quita,2)
  assert.ok((await call(db,A,'logros')).logros.find(l=>l.id==='constancia').conseguido)
  assert.equal((await db.query("SELECT count(*) n FROM suizamente_private.suizamente_actividad_dias WHERE jugador_id=$1 AND fecha=(clock_timestamp() AT TIME ZONE 'Europe/Zurich')::date",[A])).rows[0].n,1)
  await call(db,A,'vincular')
  assert.equal((await call(db,A,'jugador')).jugador.monedas,merged.monedas)
  console.log('Economy: one-time awards/backfill, normal/stamp/final rewards, level boundaries, Zurich/DST streaks, achievements, notices and profiles passed.')
}catch(e){console.error('Economy:',e.message,e.detail||'',e.where||'');process.exitCode=1}
finally{await db?.close()}
