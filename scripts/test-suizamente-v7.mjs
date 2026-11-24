import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {database,call,profile,A,B,C,G} from './lib/suizamente-v2-test-db.mjs'
let db
try{
 db=await database({comunidad:true})
 for(const [id,n]of[[A,'Alex'],[B,'Lu'],[C,'Caro']]){await call(db,id,'guardar_jugador',profile(n));await call(db,id,'bienvenida')}
 const cfg=(await call(db,A,'config'))
 assert.equal(cfg.comunidad.propuestasPorDia,3)
 const day=await call(db,A,'dia')
 assert.equal(day.correcta,undefined);assert.equal(day.dato,undefined);assert.equal(day.resultado,null)
 let voted=await call(db,A,'votar_dia',{fecha:day.fecha,preguntaId:day.id,opcion:0})
 assert.equal(voted.jugador.monedas,105);assert.equal(voted.jugador.xp,5);assert.equal(voted.resultado.pct,null)
 voted=await call(db,A,'votar_dia',{fecha:day.fecha,preguntaId:day.id,opcion:1})
 assert.equal(voted.jugador.monedas,105);assert.equal(voted.resultado.opcion,0)
 for(let i=0;i<19;i++){
   const id='muestra-'+i
   await db.query("INSERT INTO suizamente_private.suizamente_jugadores(jugador_id,apodo,color,pais,canton,anos_suiza) VALUES($1,$1,'menta',$2,'ZH',$3)",[id,i===18?'AR':'ES',i===18?'mas10':'1a3'])
   await db.query('INSERT INTO suizamente_private.suizamente_votos(pregunta_id,jugador_id,opcion) VALUES($1,$2,$3)',[day.id,id,i===18?1:0])
 }
 let result=await call(db,A,'resultado',{id:day.id})
 assert.equal(result.pct,95);assert.deepEqual(result.desglose.pais,[]);assert.deepEqual(result.desglose.anos,[])
 await db.query("INSERT INTO suizamente_private.suizamente_jugadores(jugador_id,apodo,color,pais,canton,anos_suiza) VALUES('muestra-final','Muestra','menta','ES','ZH','1a3')")
 await db.query("INSERT INTO suizamente_private.suizamente_votos(pregunta_id,jugador_id,opcion) VALUES($1,'muestra-final',0)",[day.id])
 result=await call(db,A,'resultado',{id:day.id})
 assert.equal(result.desglose.pais[0].pct,100)
 assert.equal(result.desglose.pais.length,1);assert.equal(result.desglose.anos.length,1)
 assert.equal((await call(db,B,'dia')).id,day.id)
 const future=await db.query("SELECT suizamente_private.v7_dia(suizamente_private.v7_hoy()+g) id FROM generate_series(0,13) g")
 assert.equal(new Set(future.rows.map(x=>x.id)).size,14)
 await assert.rejects(call(db,A,'votar_dia',{fecha:'2000-01-01',preguntaId:day.id,opcion:0}),/409/)
 await call(db,A,'guardar_dato',{preguntaId:day.id,guardar:true})
 assert.equal((await call(db,A,'libreta')).datos.length,1)
 await call(db,A,'guardar_dato',{preguntaId:day.id,guardar:false})
 assert.equal((await call(db,A,'libreta')).datos.length,0)
 await call(db,null,'votar_dia',{fecha:day.fecha,preguntaId:day.id,opcion:0})
 await assert.rejects(call(db,null,'amistad',{jugadorId:A,operacion:'seguir'}),/404/)
 await call(db,null,'guardar_jugador',profile('Invitado'))
 let guest=await call(db,null,'bienvenida')
 assert.equal(guest.jugador.monedas,105)
 await assert.rejects(call(db,null,'amistad',{jugadorId:A,operacion:'seguir'}),/403/)
 await call(db,A,'amistad',{jugadorId:B,operacion:'solicitar'})
 assert.equal((await call(db,B,'amigos')).solicitudes[0].id,A)
 await call(db,B,'amistad',{jugadorId:A,operacion:'aceptar'})
 assert.equal((await call(db,A,'amigos')).lista[0].id,B)
 assert.equal((await call(db,A,'perfil_publico',{id:B})).loSigues,true)
 await call(db,A,'amistad',{jugadorId:C,operacion:'solicitar'})
 await call(db,C,'amistad',{jugadorId:A,operacion:'rechazar'})
 assert.equal((await call(db,C,'amigos')).solicitudes.length,0)
 await call(db,A,'amistad',{jugadorId:C,operacion:'seguir'})
 await call(db,A,'amistad',{jugadorId:C,operacion:'dejar_seguir'})
 const dates=[['2026-10-25 22:30+00','2026-10-19'],['2026-10-25 23:30+00','2026-10-26'],['2026-03-29 22:30+00','2026-03-30']]
 for(const [t,expected]of dates)assert.equal((await db.query('SELECT suizamente_private.v7_semana($1)::text w',[t])).rows[0].w,expected)
 const week=(await db.query('SELECT suizamente_private.v7_semana()::text w')).rows[0].w
 for(const [winner,offset]of[[A,"-interval '1 microsecond'"],[B,"+interval '1 second'"],[B,"+interval '2 seconds'"],[A,"+interval '1 day'"]]){
   await db.query("INSERT INTO suizamente_private.suizamente_partidas(jugador_a,jugador_b,turno,estado,fase,ganador,plazo,reglas,terminada_en) VALUES($1,$2,NULL,'terminada','terminada',$3,clock_timestamp(),suizamente_private.v2_config(),($4::date::timestamp AT TIME ZONE 'Europe/Zurich')"+offset+")",[A,B,winner,week])
 }
 let ranking=await call(db,A,'ranking',{ambito:'amigos'})
 assert.equal(ranking.filas[0].id,B);assert.equal(ranking.filas[0].victorias,2)
 assert.equal(ranking.tuFila.victorias,1);assert.equal(ranking.diferencia,1)
 await db.query("INSERT INTO suizamente_private.suizamente_partidas(jugador_a,jugador_b,turno,estado,fase,ganador,plazo,reglas,terminada_en) SELECT $1,$2,NULL,'terminada','terminada',$1,clock_timestamp(),suizamente_private.v2_config(),($3::date::timestamp AT TIME ZONE 'Europe/Zurich')+interval '3 days' FROM generate_series(1,2)",[C,B,week])
 await db.query("SELECT suizamente_private.v3_anotar($1,'sello_ganado','fixture-tie',20,10)",[C])
 assert.equal((await call(db,B,'ranking')).filas[0].id,C,'Equal wins use actual earned stamps')
 const payload=(await db.query("SELECT payload FROM suizamente_private.suizamente_preguntas WHERE payload->>'tipo'='real' LIMIT 1")).rows[0].payload
 const proposal={tipo:'real',tema:payload.tema,emoji:payload.emoji,pregunta:payload.pregunta,opciones:payload.opciones,correcta:payload.correcta,dato:payload.dato,fuente:''}
 await db.exec('DELETE FROM suizamente_private.suizamente_limites')
 for(let i=0;i<3;i++)await call(db,A,'proponer',{contenido:proposal})
 await assert.rejects(call(db,A,'proponer',{contenido:proposal}),/409/)
 await assert.rejects(call(db,null,'proponer',{contenido:proposal}),/403/)
 const own=await call(db,B,'proponer',{contenido:proposal})
 await assert.rejects(call(db,B,'valorar',{id:own.id,valor:1}),/409/)
 for(let i=0;i<11;i++){
   const id=(await db.query('INSERT INTO suizamente_private.suizamente_propuestas(jugador_id,contenido) VALUES($1,$2) RETURNING id',[C,JSON.stringify(proposal)])).rows[0].id
   await call(db,B,'valorar',{id,valor:1})
   await assert.rejects(call(db,B,'valorar',{id,valor:1}),/409/)
 }
 assert.equal((await call(db,B,'jugador')).jugador.monedas,120)
 assert.equal((await call(db,B,'valorar_siguiente')).monedasHoy,20)
 await call(db,C,'vincular')
 assert.equal((await call(db,C,'jugador')).jugador.monedas,125,'Daily receipt and earned stamp merged once with the guest')
 const size=Number((await db.query("SELECT count(*) n FROM suizamente_private.suizamente_movimientos WHERE jugador_id=$1 AND motivo='pregunta_dia'",[C])).rows[0].n)
 assert.equal(size,1)
 for(let i=0;i<5;i++)await call(db,A,'denunciar',{jugadorId:B,motivo:'Revisar apodo'})
 await assert.rejects(call(db,A,'denunciar',{jugadorId:B,motivo:'Revisar apodo'}),/429|409/)
 const active=await call(db,A,'crear_partida',{rival:B})
 await db.query("UPDATE suizamente_private.suizamente_partidas SET reglas=jsonb_set(reglas,'{ruleta,casillas}','[\"idioma\"]') WHERE id=$1",[active.id])
 const spun=await call(db,A,'girar',{id:active.id,turnoN:active.turnoN})
 const pending=await call(db,A,'pregunta',{id:active.id,turnoN:spun.turnoN,categoria:'idioma'})
 await assert.rejects(call(db,A,'resultado',{id:pending.pregunta.preguntaId}),/409/)
 await assert.rejects(call(db,A,'guardar_dato',{preguntaId:pending.pregunta.preguntaId,guardar:true}),/409/)
 // More than fifty accounts: own row is still returned, and next Monday is exclusive.
 for(let i=0;i<51;i++){
   const id='90000000-0000-4000-8000-'+String(i).padStart(12,'0')
   await db.query('INSERT INTO auth.users VALUES($1)',[id])
   await db.query("INSERT INTO suizamente_private.suizamente_jugadores(jugador_id,usuario_id,apodo,color,pais,canton,anos_suiza) VALUES($1::text,$1::uuid,$2,'menta','ES','ZH','1a3')",[id,'Muestra '+i])
   await db.query("INSERT INTO suizamente_private.suizamente_partidas(jugador_a,jugador_b,turno,estado,fase,ganador,plazo,reglas,terminada_en) SELECT $1,$2,NULL,'terminada','terminada',$1,clock_timestamp(),suizamente_private.v2_config(),($3::date::timestamp AT TIME ZONE 'Europe/Zurich')+interval '2 days' FROM generate_series(1,3)",[id,B,week])
 }
 ranking=await call(db,A,'ranking',{ambito:'suiza'})
 assert.equal(ranking.filas.length,50);assert.ok(ranking.tuFila.puesto>50);assert.equal(ranking.tuFila.victorias,1)
 await db.query("INSERT INTO suizamente_private.suizamente_partidas(jugador_a,jugador_b,turno,estado,fase,ganador,plazo,reglas,terminada_en) VALUES($1,$2,NULL,'terminada','terminada',$1,clock_timestamp(),suizamente_private.v2_config(),(($3::date+7)::timestamp AT TIME ZONE 'Europe/Zurich'))",[A,B,week])
 assert.equal((await call(db,A,'ranking')).tuFila.victorias,1)
 // Erasure keeps anonymous aggregate votes and removes pending proposals and bookmarks.
 await call(db,C,'guardar_dato',{preguntaId:day.id,guardar:true})
 await call(db,C,'borrar_jugador',{confirmacion:'BORRAR'})
 for(const table of ['suizamente_dia_votos','suizamente_valoraciones','suizamente_propuestas','suizamente_libreta'])assert.equal(Number((await db.query('SELECT count(*) n FROM suizamente_private.'+table+' WHERE jugador_id=$1',[C])).rows[0].n),0)
 await db.exec(await readFile('supabase/suizamente_v7_comunidad.sql','utf8'))
 assert.equal((await call(db,A,'dia')).resultado.opcion,0)
 console.log('Community: same deterministic day, first vote, one daily award, pre-profile guest reward, 20-vote/group thresholds, requests/following, Zurich/DST week, notebook, proposal/rating limits and repeatable SQL passed.')
}catch(e){console.error('Community:',e.message,e.where||'',e.internalQuery||'');process.exitCode=1}
finally{await db?.close()}
