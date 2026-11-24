import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {database,call,profile,step,A,B,C,G,TOKEN} from './lib/suizamente-v2-test-db.mjs'
let db
try{
 db=await database({duracion:true})
 const config=JSON.parse(await readFile('server/suizamente/data/juego.json','utf8'))
 for(const [id,name] of [[A,'Alex'],[B,'Lu']]){await call(db,id,'guardar_jugador',profile(name));await call(db,id,'bienvenida')}
 const first=await call(db,A,'misiones')
 assert.equal(first.misiones.length,config.misiones.porDia);assert.equal(new Set(first.misiones.map(m=>m.tipo)).size,first.misiones.length)
 assert.deepEqual((await call(db,A,'misiones')).misiones,first.misiones)
 const dayClock=(await db.query("SELECT pg_get_functiondef('suizamente_private.v7_hoy(timestamptz)'::regprocedure) d")).rows[0].d
 for(const [instant,date] of [['2026-03-28T23:01:00Z','2026-03-29'],['2026-03-29T22:01:00Z','2026-03-30']]){
  await db.exec(dayClock.replace('DEFAULT clock_timestamp()',"DEFAULT '"+instant+"'::timestamptz"))
  const fresh=await call(db,B,'misiones');assert.equal(String(fresh.fecha).slice(0,10),date);assert.equal(fresh.misiones.length,config.misiones.porDia);assert.ok(fresh.misiones.every(m=>m.avance===0&&!m.cobrada));assert.equal(fresh.cambiosRestantes,config.misiones.cambiosPorDia)
 }
 await db.exec(dayClock)
 for(const actor of [null,A])await assert.rejects(call(db,actor,'admin',{ruta:'economia',metodo:'GET'}),/403/)
 const economy=await call(db,C,'admin',{ruta:'economia',metodo:'GET'}),invalid=structuredClone(economy.juego)
 invalid.mapa.coste.redondeo=0
 await assert.rejects(call(db,C,'admin',{ruta:'economia',metodo:'PUT',version:economy.version,juego:invalid}),/400/)
 await call(db,A,'cambiar_mision',{dificultad:first.misiones[0].dificultad,version:first.misiones[0].version})
 assert.equal((await call(db,A,'misiones')).cambiosRestantes,0)
 await assert.rejects(call(db,A,'cambiar_mision',{dificultad:first.misiones[1].dificultad,version:0}),/409/)
 // Controlled mission slots using only the configured types, targets and prizes.
 for(const [diff,type] of [['facil','dia'],['media','construir'],['dificil','sellos']]){
  const definition=config.misiones.tipos.find(t=>t.id===type)
  await db.query("UPDATE suizamente_private.suizamente_misiones SET tipo=$3,meta=$4,categoria=NULL,cobrada=false,desde=fecha::timestamp AT TIME ZONE 'Europe/Zurich' WHERE jugador_id=$1 AND dificultad=$2",[A,diff,type,definition.n[diff]])
 }
 let day=await call(db,A,'dia'),before=(await call(db,A,'jugador')).jugador.monedas
 await call(db,A,'votar_dia',{fecha:day.fecha,preguntaId:day.id,opcion:0})
 assert.equal((await call(db,A,'jugador')).jugador.monedas-before,config.recompensas.preguntaDelDia.monedas+config.misiones.premios.facil.monedas)
 await db.query("SELECT suizamente_private.v3_anotar($1,'fixture','fondos',100000)",[A])
 await call(db,A,'construir',{canton:'LU',nivel:0,vuelta:1,clave:crypto.randomUUID()})
 await call(db,A,'construir',{canton:'LU',nivel:1,vuelta:1,clave:crypto.randomUUID()})
 assert.equal((await call(db,A,'misiones')).misiones.find(m=>m.dificultad==='media').cobrada,true)
 for(let i=0;i<config.misiones.tipos.find(t=>t.id==='sellos').n.dificil;i++)await db.query("SELECT suizamente_private.v3_anotar($1,'sello_ganado',$2)",[A,'fixture-sello:'+i])
 const completed=await call(db,A,'misiones')
 assert.ok(completed.misiones.every(m=>m.cobrada));assert.ok(completed.cofre.id)
 before=(await call(db,A,'jugador')).jugador.monedas
 await call(db,A,'misiones');assert.equal((await call(db,A,'jugador')).jugador.monedas,before)
 assert.equal(Number((await db.query("SELECT count(*) n FROM suizamente_private.suizamente_movimientos WHERE jugador_id=$1 AND motivo='mision'",[A])).rows[0].n),config.misiones.porDia)
 await call(db,A,'abrir_cofre',{id:completed.cofre.id});await assert.rejects(call(db,A,'abrir_cofre',{id:completed.cofre.id}),/409/)
 const all=config.mapa.regiones.flatMap(r=>r.cantones),last=all.at(-1)
 async function almostComplete(v){
  for(const k of all)await db.query('INSERT INTO suizamente_private.suizamente_mapa VALUES($1,$2,$3,$4) ON CONFLICT(jugador_id,vuelta,canton) DO UPDATE SET nivel=excluded.nivel',[A,v,k.id,config.mapa.nivelesPorCanton-(k.id===last.id?1:0)])
 }
 await almostComplete(1)
 const key=crypto.randomUUID(),finish=await call(db,A,'construir',{canton:last.id,nivel:config.mapa.nivelesPorCanton-1,vuelta:1,clave:key})
 assert.equal(finish.vueltaCompleta.monedas,config.vueltasMapa.premioMonedasPorVuelta);assert.equal(finish.vuelta,2);assert.deepEqual(finish.niveles,{})
 await assert.rejects(call(db,A,'construir',{canton:last.id,nivel:config.mapa.nivelesPorCanton-1,vuelta:1,clave:key}),/409/)
 assert.equal(finish.costes.LU[0],Math.round(config.mapa.regiones[0].cantones[0].costes[0]*config.vueltasMapa.vueltas[1].multiplicadorCoste))
 const rounding=config.mapa.coste.redondeo
 assert.equal(finish.costes.LU[1],Math.round(config.mapa.regiones[0].cantones[0].costes[1]*config.vueltasMapa.vueltas[1].multiplicadorCoste/rounding)*rounding)
 await almostComplete(2)
 await call(db,A,'construir',{canton:last.id,nivel:config.mapa.nivelesPorCanton-1,vuelta:2,clave:crypto.randomUUID()})
 assert.equal((await call(db,A,'jugador')).marco.nombre,'Suiza de oro')
 assert.ok((await call(db,A,'logros')).logros.find(l=>l.id==='suiza_oro').conseguido)
 assert.equal((await call(db,A,'logros')).logros.length,config.logros.length)
 assert.equal(Number((await db.query("SELECT count(*) n FROM suizamente_private.suizamente_movimientos WHERE motivo='vuelta' AND jugador_id=$1",[A])).rows[0].n),2)
 await call(db,B,'construir',{canton:'LU',nivel:0,vuelta:1,clave:crypto.randomUUID()})
 let match=await call(db,A,'crear_partida',{rival:B})
 await db.query("UPDATE suizamente_private.suizamente_partidas SET reglas=jsonb_set(jsonb_set(reglas,'{ruleta,casillas}','[\"idioma\"]'),'{asaltos,probabilidadPorAcierto}','1') WHERE id=$1",[match.id])
 match=await step(db,A,match)
 assert.ok(match.asalto?.id)
 let raid=await call(db,A,'asalto_empezar',{id:match.asalto.id,turnoN:match.asalto.turnoN})
 const payload=(await db.query('SELECT payload FROM suizamente_private.suizamente_asaltos WHERE id=$1',[raid.id])).rows[0].payload
 await db.query('INSERT INTO suizamente_private.suizamente_vueltas VALUES($1,2) ON CONFLICT(jugador_id) DO UPDATE SET vuelta=2',[B])
 raid=await call(db,A,'asalto_respuesta',{id:raid.id,turnoN:raid.turnoN,opcion:payload.correcta})
 assert.equal(raid.estado,'cancelado','A raid cannot damage a different lap')
 const definition=(await db.query("SELECT pg_get_functiondef('suizamente_private.v11_mes(timestamptz)'::regprocedure) d")).rows[0].d
 await db.exec(definition.replace('DEFAULT clock_timestamp()',"DEFAULT '2027-01-15T12:00:00Z'::timestamptz"))
 const collections=(await db.query('SELECT suizamente_private.v6_colecciones() c')).rows[0].c
 assert.ok(collections.some(c=>c.mes==='2027-01'));assert.ok(collections.every(c=>!c.mes||c.mes<='2027-01'))
 await db.exec('SELECT setseed(0.32)')
 const monthly=collections.find(c=>c.mes==='2027-01'),sample=(await db.query('SELECT suizamente_private.v6_carta() c FROM generate_series(1,1000)')).rows
 const share=sample.filter(r=>r.c.coleccionId===monthly.id).length/sample.length
 assert.ok(share>.42&&share<.58,'Monthly probability: '+share)
 await db.exec(definition)
 const purchaseKey=crypto.randomUUID(),balance=(await call(db,A,'jugador')).jugador.monedas
 await call(db,A,'comprar',{articulo:'tiempo',clave:purchaseKey});assert.equal((await call(db,A,'comprar',{articulo:'tiempo',clave:purchaseKey})).recuperada,true)
 assert.equal(balance-(await call(db,A,'jugador')).jugador.monedas,config.tienda.comodines.tiempo)
 await assert.rejects(call(db,A,'comprar',{articulo:'sobre',clave:purchaseKey}),/409/)
 const guest=await call(db,null,'guardar_jugador',profile('Visita')),guestId=guest.identidad
 await call(db,null,'bienvenida');await call(db,null,'misiones')
 await db.query('INSERT INTO suizamente_private.suizamente_vueltas VALUES($1,2)',[guestId])
 await call(db,B,'vincular')
 assert.equal((await call(db,B,'mapa')).vuelta,2)
 assert.equal(Number((await db.query('SELECT count(*) n FROM suizamente_private.suizamente_misiones WHERE jugador_id=$1',[guestId])).rows[0].n),0)
 for(const role of ['anon','authenticated'])for(const table of ['suizamente_vueltas','suizamente_misiones','suizamente_misiones_dias'])await assert.rejects(db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE '+role);return tx.exec('SELECT * FROM suizamente_private.'+table)}),/permission denied/)
 await db.exec(await readFile('supabase/suizamente_v11_duracion.sql','utf8'))
 assert.equal((await call(db,A,'mapa')).vuelta,3)
 console.log('Duration: deterministic daily missions, one swap, transactional rewards/chest once, laps/costs/frame/achievements, raid lap isolation, monthly release/weight, guest merge, private tables and repeatable SQL passed.')
}catch(e){console.error('Duration:',e.message,e.where||'',e.query||'');process.exitCode=1}finally{await db?.close()}
