import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {database,call,profile,A,B,C} from './lib/suizamente-v2-test-db.mjs'
let db
try{
 db=await database({admin:true})
 for(const [id,n]of[[A,'Alex'],[B,'Lu']]){await call(db,id,'guardar_jugador',profile(n));await call(db,id,'bienvenida')}
 for(const actor of [null,A,B])await assert.rejects(call(db,actor,'admin',{ruta:'resumen',metodo:'GET'}),/403/)
 assert.equal((await call(db,A,'capacidades')).admin,false);assert.equal((await call(db,C,'capacidades')).admin,true)
 const admin=(ruta,metodo='GET',body={})=>call(db,C,'admin',{ruta,metodo,...body})
 assert.deepEqual((await admin('propuestas')).contadores,{})
 const payload=(await db.query("SELECT payload FROM suizamente_private.suizamente_preguntas WHERE payload->>'tipo'='real' LIMIT 1")).rows[0].payload
 const content={tipo:'real',tema:payload.tema,emoji:payload.emoji,pregunta:payload.pregunta,opciones:payload.opciones,correcta:payload.correcta,dato:payload.dato,fuente:''}
 const p=await call(db,A,'proponer',{contenido:content})
 const detail=await admin('propuestas/'+p.id)
 assert.equal((await admin('preguntas/'+payload.id)).reparto,null)
 for(let i=0;i<20;i++){
   const actor='stats-'+i
   await db.query("INSERT INTO suizamente_private.suizamente_jugadores(jugador_id,apodo,color,pais,canton,anos_suiza) VALUES($1,$1,'menta','ES','ZH','1a3')",[actor])
   await db.query('INSERT INTO suizamente_private.suizamente_votos(pregunta_id,jugador_id,opcion) VALUES($1,$2,$3)',[payload.id,actor,payload.correcta])
 }
 const stats=await admin('preguntas/'+payload.id)
 assert.equal(stats.aciertoPct,100);assert.equal(stats.desglose.length,2)
 assert.equal(stats.reparto[payload.correcta],20)
 assert.equal(detail.comprobaciones.valida,true);assert.equal(detail.comprobaciones.parecida.id,payload.id)
 assert.ok(detail.linea.startsWith('R|'))
 await admin('propuestas/'+p.id,'PUT',{contenido:content,nota:'Revisada'})
 await admin('propuestas/'+p.id+'/aprobar','POST')
 assert.equal((await call(db,A,'jugador')).jugador.monedas,100)
 await admin('propuestas/'+p.id+'/vincular','POST',{preguntaId:payload.id})
 assert.equal((await call(db,A,'jugador')).jugador.monedas,200)
 assert.equal((await call(db,A,'jugador')).jugador.xp,100)
 assert.ok((await call(db,A,'logros')).logros.find(x=>x.id==='autoria').conseguido)
 await assert.rejects(admin('propuestas/'+p.id+'/vincular','POST',{preguntaId:payload.id}),/409/)
 const econ=await admin('economia')
 const frozen=await call(db,A,'crear_partida',{rival:B})
 econ.juego.comodines.find(x=>x.id==='tiempo').precio=17
 econ.juego.tienda.comodines.tiempo=17
 econ.juego.partida.segundosPorPregunta=45
 econ.juego.partida.barraParaSello=2
 const saved=await admin('economia','PUT',{version:econ.version,juego:econ.juego})
 assert.equal(saved.version,1)
 assert.equal((await call(db,A,'config')).comodines.find(x=>x.id==='tiempo').precio,17)
 assert.equal((await call(db,A,'tienda')).comodines.find(x=>x.id==='tiempo').precio,17)
 const preserved=await call(db,A,'partida',{id:frozen.id})
 assert.equal(preserved.configPartida.partida.segundosPorPregunta,30)
 assert.equal(preserved.configPartida.partida.barraParaSello,3)
 assert.equal((await call(db,A,'crear_partida',{rival:B})).configPartida.partida.segundosPorPregunta,45)
 const bought=await call(db,A,'comprar',{articulo:'tiempo',clave:crypto.randomUUID()})
 assert.equal(bought.jugador.monedas,183)
 await assert.rejects(admin('economia','PUT',{version:0,juego:econ.juego}),/409/)
 const invalid=structuredClone(econ.juego);invalid.album.pesoRareza['1']=.9
 await assert.rejects(admin('economia','PUT',{version:1,juego:invalid}),/400/)
 await admin('preguntas/'+payload.id+'/ocultar','POST',{motivo:'Revisión'})
 assert.equal((await admin('preguntas/'+payload.id)).oculta,true)
 await admin('preguntas/'+payload.id+'/mostrar','POST',{motivo:'Corregida'})
 await admin('jugadores/'+B+'/bloquear','POST')
 assert.equal((await call(db,B,'jugador')).jugador.bloqueado,undefined,'Private moderation flag is not public')
 await assert.rejects(call(db,B,'crear_partida',{rival:A}),/403/)
 await assert.rejects(call(db,B,'comprar',{articulo:'tiempo',clave:crypto.randomUUID()}),/403/)
 await assert.rejects(call(db,B,'proponer',{contenido:content}),/403/)
 await admin('jugadores/'+B+'/desbloquear','POST')
 await admin('jugadores/'+B+'/quitar-ranking','POST')
 await call(db,B,'guardar_jugador',{...profile('Lu'),en_ranking:true})
 assert.equal((await call(db,B,'ranking')).tuFila,null,'A player cannot undo a moderation exclusion in profile settings')
 await admin('jugadores/'+B+'/restaurar-ranking','POST')
 assert.ok((await call(db,B,'ranking')).tuFila)
 await admin('jugadores/'+B+'/renombrar','POST',{apodo:'Nuevo apodo'})
 assert.equal((await call(db,B,'jugador')).jugador.renombrar,true)
 await assert.rejects(call(db,B,'guardar_jugador',profile('Nuevo apodo')),/400:Elige otro apodo/)
 assert.equal((await call(db,B,'guardar_jugador',profile('Lu nueva'))).jugador.renombrar,false)
 await assert.rejects(admin('dia/'+(await call(db,A,'dia')).fecha,'PUT',{preguntaId:payload.id}),/409/)
 await admin('dia')
 const week=(await db.query('SELECT suizamente_private.v7_semana()::text w')).rows[0].w
 await admin('ranking/excluir','POST',{jugadorId:A,semana:week})
 assert.equal((await call(db,A,'ranking')).tuFila,null)
 await admin('ranking/incluir','POST',{jugadorId:A,semana:week})
 let m=await call(db,A,'crear_partida',{rival:B})
 const support=await admin('partidas','GET',{q:m.id})
 assert.equal(support.filas.length,1)
 assert.ok(!/"(?:opcion|correcta|dato|payload|email)"/.test(JSON.stringify(support)))
 for(const section of ['resumen','jugadores','asaltos','album','avisos','denuncias','ranking','registro']){
   const result=await admin(section)
   assert.ok(!JSON.stringify(result).includes('@'))
 }
 const rows=(await admin('registro')).filas
 assert.ok(rows.some(x=>x.accion==='POST:propuestas:aprobar'))
 assert.ok(rows.some(x=>x.accion==='PUT:economia'))
 await db.exec(await readFile('supabase/suizamente_v2_datos.sql','utf8'))
 assert.equal((await call(db,A,'config')).comodines.find(x=>x.id==='tiempo').precio,17,'Reimporting file defaults keeps live overrides')
 await db.exec(await readFile('supabase/suizamente_v9_admin.sql','utf8'))
 assert.equal((await admin('economia')).version,1)
 assert.equal((await call(db,A,'config')).comodines.find(x=>x.id==='tiempo').precio,17)
 for(const role of ['anon','authenticated'])await assert.rejects(db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE '+role);return tx.query('SELECT * FROM suizamente_private.suizamente_admin_registro')}),/permission denied/)
 console.log('Administration: reused server roles, 403, proposal checks/export/publication reward, audit, live economy/version/history, moderation, future calendar, weekly exclusion, private support and repeatable SQL passed.')
}catch(e){console.error('Administration:',e.message,e.where||'',e.internalQuery||'');process.exitCode=1}
finally{await db?.close()}
