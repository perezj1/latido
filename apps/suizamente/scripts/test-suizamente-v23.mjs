import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {database,call,profile,A,B,C} from './lib/suizamente-v2-test-db.mjs'
const db=await database({tres:true}),sql=await readFile('supabase/suizamente_v23_carga.sql','utf8')
try{
 const config=await call(db,null,'config')
 for(const [id,name] of [[A,'Alex'],[B,'Lu'],[C,'Caro']]){await call(db,id,'guardar_jugador',profile(name));await call(db,id,'bienvenida')}
 const m=await call(db,A,'crear_partida',{rival:B}),bet=config.categorias[0].id,take=config.categorias[1].id
 await db.query("UPDATE suizamente_private.suizamente_partidas SET fase='sello',barra_a=3,sellos_a=$2,sellos_b=$3 WHERE id=$1",[m.id,[bet],[take]])
 let state=await call(db,A,'partida',{id:m.id});state=await call(db,A,'duelo',{id:m.id,turnoN:state.turnoN,quitar:take,apostar:bet})
 await db.exec(sql);await db.exec(sql)
 assert.deepEqual(await call(db,null,'config'),config,'configuration/API version unchanged')
 assert.equal((await call(db,A,'partidas')).duelosIncluidos,true);assert.equal((await call(db,A,'partidas')).partidas[0].duelo,undefined,'in-progress duel not presented as completed')
 await db.query("UPDATE suizamente_private.suizamente_duelos_sello SET estado='terminado',ganador=$2,sello=$3 WHERE id=$1",[state.duelo.id,A,take])
 const before=(await db.query('SELECT (SELECT count(*) FROM suizamente_private.suizamente_movimientos) ledger,(SELECT count(*) FROM suizamente_private.suizamente_votos) votes')).rows[0]
 const list=await call(db,A,'partidas',{terminadas:true}),full=await call(db,A,'partida',{id:m.id}),duel=list.partidas.find(x=>x.id===m.id).duelo
 for(const key of ['id','estado','sello','ganador','mostrarResultado'])assert.deepEqual(duel[key],full.duelo[key],key+' matches individual server view')
 assert.deepEqual(Object.keys(duel).sort(),['id','estado','sello','ganador','mostrarResultado'].sort(),'only the saved public summary, no questions or solutions')
 assert.equal((await call(db,C,'partidas',{terminadas:true})).partidas.length,0,'unrelated account cannot see duel')
 await assert.rejects(()=>call(db,null,'partidas'),/Entra/)
 await db.query('UPDATE suizamente_private.suizamente_duelos_sello SET visto_a=true WHERE id=$1',[state.duelo.id])
 assert.equal((await call(db,A,'partidas')).partidas[0].duelo,undefined);assert.equal((await call(db,B,'partidas')).partidas[0].duelo.mostrarResultado,true,'read flags remain per participant')
 assert.deepEqual((await db.query('SELECT (SELECT count(*) FROM suizamente_private.suizamente_movimientos) ledger,(SELECT count(*) FROM suizamente_private.suizamente_votos) votes')).rows[0],before,'reads never change rewards or votes')
 assert.equal((await db.query("SELECT has_function_privilege('authenticated','suizamente_private.v23_api_base(text,jsonb,uuid,text)','EXECUTE') ok")).rows[0].ok,false)
 console.log('v23: compatible saved duel summaries in one match-list response; per-user visibility and read flags; no rewards/votes/configuration changes; idempotent migration and private function restrictions.')
}finally{await db.close()}
