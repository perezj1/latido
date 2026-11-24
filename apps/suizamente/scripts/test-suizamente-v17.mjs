import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {database,call,profile,step,A,B,C} from './lib/suizamente-v2-test-db.mjs'
const db=await database({ataques:true})
const clear=()=>db.exec('DELETE FROM suizamente_private.suizamente_limites')
const reject=(promise,code)=>assert.rejects(promise,e=>e.message.includes('SZV2:'+code+':'))
try{
 for(const [id,name] of [[A,'Alex'],[B,'Lu'],[C,'Caro']]){await call(db,id,'guardar_jugador',profile(name));await call(db,id,'bienvenida')}
 await db.query("SELECT suizamente_private.v3_anotar($1,'fixture','mapa',5000)",[B]);await call(db,B,'construir',{canton:'LU',nivel:0,clave:crypto.randomUUID()})
 let m=await call(db,A,'crear_partida',{rival:B});const mid=m.id,config=await call(db,A,'config')
 assert.equal(config.apiVersion,17)
 await reject(call(db,A,'ataque_objetivos',{id:mid}),409)
 await db.query("UPDATE suizamente_private.suizamente_partidas SET reglas=jsonb_set(reglas,'{ruleta,casillas}','[\"idioma\"]') WHERE id=$1",[mid])
 for(const category of config.categorias){
  for(let i=0;i<config.partida.barraParaSello;i++){await clear();m=await step(db,A,m,true);assert.equal(m.tuBarra,i+1);assert.equal(m.tusSellos.includes(category.id),false)}
  assert.equal(m.fase,'sello','Three correct answers require a chosen category, not an automatic stamp')
  await clear();m=await step(db,A,m,true,category.id);assert.ok(m.tusSellos.includes(category.id));assert.equal(m.tuBarra,0)
 }
 assert.equal(m.ganador,A);assert.equal(m.tusSellos.length,6);assert.equal(m.estado,'terminada')
 assert.equal((await db.query("SELECT count(*) n FROM suizamente_private.suizamente_asaltos WHERE tipo='acierto'")).rows[0].n,0,'No random interruptions: attacks follow a victory')
 await reject(call(db,null,'atacar',{id:mid,canton:'LU'}),401);await reject(call(db,B,'ataque_objetivos',{id:mid}),403);await reject(call(db,C,'ataque_objetivos',{id:mid}),404)
 const targets=await call(db,A,'ataque_objetivos',{id:mid});assert.equal(targets.preguntas,5);assert.ok(targets.cantones.find(k=>k.id==='LU').disponible)
 await reject(call(db,A,'atacar',{id:mid,canton:'GE'}),409)
 let raid=await call(db,A,'atacar',{id:mid,canton:'LU'});assert.equal(raid.preguntasTotal,5)
 const same=await call(db,A,'atacar',{id:mid,canton:'UR'});assert.equal(same.id,raid.id,'A victory can create only one attack')
 await reject(call(db,B,'asalto',{id:raid.id}),404)
 async function answer(r,correct=true){
  const row=(await db.query('SELECT payload FROM suizamente_private.suizamente_asaltos WHERE id=$1',[r.id])).rows[0]
  return call(db,A,'asalto_respuesta',{id:r.id,turnoN:r.turnoN,n:r.pregunta.n,opcion:correct?row.payload.correcta:(row.payload.correcta+1)%row.payload.opciones.length})
 }
 const before=(await call(db,A,'jugador')).jugador.monedas,beforeVictim=(await call(db,B,'jugador')).jugador.monedas;const seen=new Set();let last
 for(let n=1;n<=5;n++){
  assert.equal(raid.pregunta.n,n);assert.equal('correcta' in raid.pregunta,false)
  const payload=(await db.query('SELECT payload FROM suizamente_private.suizamente_asaltos WHERE id=$1',[raid.id])).rows[0].payload
  assert.ok(!seen.has(payload.id));seen.add(payload.id);last=raid
  raid=await answer(raid);assert.equal(raid.aciertos,n)
  if(n<5){assert.equal(raid.estado,'entre_preguntas');assert.equal(raid.premio,0);assert.equal((await call(db,B,'mapa')).niveles.LU,1);raid=await call(db,A,'asalto_siguiente',{id:raid.id,turnoN:raid.turnoN})}
 }
 assert.equal(raid.estado,'resuelto');assert.equal(raid.premio,config.asaltos.premio);assert.equal((await call(db,B,'mapa')).niveles.LU,0)
 assert.equal((await call(db,A,'jugador')).jugador.monedas,before+config.asaltos.premio)
 assert.equal((await call(db,B,'jugador')).jugador.monedas,beforeVictim-config.asaltos.premio,'Coins are transferred from the victim, never created')
 await reject(answer(last),409);await call(db,A,'asalto',{id:raid.id});assert.equal((await call(db,A,'jugador')).jugador.monedas,before+config.asaltos.premio)
 assert.equal((await db.query("SELECT count(*) n FROM suizamente_private.suizamente_movimientos WHERE jugador_id=$1 AND motivo='asalto' AND ref=$2",[A,raid.id])).rows[0].n,1)
 async function victory(){await clear();await db.query("INSERT INTO suizamente_private.suizamente_mapa VALUES($1,1,'LU',2) ON CONFLICT(jugador_id,vuelta,canton) DO UPDATE SET nivel=2",[B]);const x=await call(db,A,'crear_partida',{rival:B});await db.query("SELECT suizamente_private.v2_cerrar($1,$2,'sellos')",[x.id,A]);return x.id}
 const failedMid=await victory();let fail=await call(db,A,'atacar',{id:failedMid,canton:'LU'});fail=await answer(fail,false)
 assert.equal(fail.estado,'resuelto');assert.equal(fail.premio,0);assert.equal((await call(db,B,'mapa')).niveles.LU,2)
 const shieldMid=await victory();await db.query("SELECT suizamente_private.v3_anotar($1,'fixture','escudo',0,0,'{\"escudos\":1}')",[B]);const beforeShield=(await call(db,B,'jugador')).jugador.monedas;let shield=await call(db,A,'atacar',{id:shieldMid,canton:'LU'})
 for(let n=1;n<=5;n++){shield=await answer(shield);if(n<5)shield=await call(db,A,'asalto_siguiente',{id:shield.id,turnoN:shield.turnoN})}
 assert.equal(shield.escudo,true);assert.equal(shield.premio,70);assert.equal((await call(db,B,'mapa')).niveles.LU,1);assert.equal((await call(db,B,'jugador')).jugador.monedas,beforeShield-70)
 const capped=await victory();assert.equal((await call(db,A,'ataque_objetivos',{id:capped})).limiteAlcanzado,true);await reject(call(db,A,'atacar',{id:capped,canton:'LU'}),409)
 // Free a local fixture slot and verify an expired question settles as failure.
 await db.query("UPDATE suizamente_private.suizamente_asaltos SET fecha=fecha-1 WHERE id=$1",[fail.id]);let timed=await call(db,A,'atacar',{id:capped,canton:'LU'})
 await db.query("UPDATE suizamente_private.suizamente_asaltos SET vence_en=clock_timestamp()-interval '1 minute' WHERE id=$1",[timed.id]);timed=await call(db,A,'asalto',{id:timed.id});assert.equal(timed.estado,'resuelto');assert.equal(timed.premio,0);assert.equal(timed.resultado.agotada,true)
 await db.query("UPDATE suizamente_private.suizamente_asaltos SET fecha=fecha-1 WHERE id=$1",[timed.id]);const lowMid=await victory()
 const victimBalance=(await call(db,B,'jugador')).jugador.monedas;await db.query("SELECT suizamente_private.v3_anotar($1,'fixture','saldo_bajo',$2)",[B,20-victimBalance])
 let low=await call(db,A,'atacar',{id:lowMid,canton:'LU'})
 for(let n=1;n<=5;n++){low=await answer(low);if(n<5)low=await call(db,A,'asalto_siguiente',{id:low.id,turnoN:low.turnoN})}
 assert.equal(low.premio,20);assert.equal((await call(db,B,'jugador')).jugador.monedas,0);assert.equal((await call(db,B,'mapa')).niveles.LU,1)
 assert.equal((await db.query("SELECT has_function_privilege('authenticated','suizamente_private.v5_ofrecer(uuid,integer)','EXECUTE') allowed")).rows[0].allowed,false)
 assert.equal((await db.query("SELECT count(*) n FROM public.app_notifications WHERE kind LIKE 'suizamente_%'")).rows[0].n,0,'Attack notifications remain isolated from Latido')
 await db.exec(await readFile('supabase/suizamente_v17_ataques.sql','utf8'));assert.equal((await call(db,A,'asalto',{id:raid.id})).premio,config.asaltos.premio)
 console.log('v17: 3 correct → chosen seal question → 6 seals win; winner-only target selection; 5 distinct server questions; no early payment/damage; one settlement; failure, timeout, shields, daily cap and repeat migration passed.')
}catch(e){console.error(e.message,e.where||'');process.exitCode=1}finally{await db.close()}
