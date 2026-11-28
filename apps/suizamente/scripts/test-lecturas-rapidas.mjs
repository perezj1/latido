import assert from 'node:assert/strict'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {mejorasDatabase,mejoraCall} from './lib/mejoras-test-db.mjs'
import {A,B,C,call,lecturaCall,callOriginal,profile} from './lib/suizamente-v2-test-db.mjs'
const {db}=await mejorasDatabase(true),times={}
const clean=v=>Array.isArray(v)?v.map(clean):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>!['ultimo_visto_en','servidorAhora'].includes(k)).map(([k,v])=>[k,clean(v)])):v
const timed=async(label,fn)=>{const t=performance.now(),r=await fn();times[label]=Math.round(performance.now()-t);return r}
try{
 for(const [id,name]of [[A,'Alex'],[B,'Lu'],[C,'Caro']]){await call(db,id,'guardar_jugador',profile(name));await call(db,id,'bienvenida')}
 const optimized=(await db.query("SELECT pg_get_functiondef('suizamente_private.v5_mapa(text)'::regprocedure) d")).rows[0].d
 const old=(await db.query("SELECT pg_get_functiondef('suizamente_private.v41_mapa_anterior(text)'::regprocedure) d")).rows[0].d.replace('suizamente_private.v41_mapa_anterior(','suizamente_private.v5_mapa(')
 await db.exec(old)
 const baseline={};for(const action of ['jugador','tienda','album'])baseline[action]=await timed('antes_'+action,()=>call(db,A,action))
 await db.exec(optimized)
 for(const action of ['jugador','tienda','album']){
  const data=await timed('despues_'+action,()=>action==='jugador'?call(db,A,action):lecturaCall(db,A,action))
  assert.deepEqual(clean(data),clean(baseline[action]),action+': same payload, inventory, prices, cards and pending rewards')
 }
 // Every original map price, including later laps and the works event, is equal.
 const activeDef=(await db.query("SELECT pg_get_functiondef('suizamente_private.v10_activo(timestamp with time zone)'::regprocedure) d")).rows[0].d
 for(const works of [false,true]){
  await db.exec("CREATE OR REPLACE FUNCTION suizamente_private.v10_activo(t timestamptz DEFAULT clock_timestamp()) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT "+(works?"'{\"tipo\":\"obras\"}'::jsonb":"NULL::jsonb")+' $$')
  for(const lap of [1,2,3,6,9]){
   await db.query('INSERT INTO suizamente_private.suizamente_vueltas VALUES($1,$2) ON CONFLICT(jugador_id) DO UPDATE SET vuelta=excluded.vuelta',[A,lap])
   const maps=(await db.query('SELECT suizamente_private.v41_mapa_anterior($1) a,suizamente_private.lectura_mapa($1) b',[A])).rows[0];assert.deepEqual(maps.b,maps.a,'All canton prices and metadata, lap '+lap+', works '+works)
  }
 }
 await db.exec(activeDef);await db.query('UPDATE suizamente_private.suizamente_vueltas SET vuelta=1 WHERE jugador_id=$1',[A])
 await call(db,A,'amistad',{jugadorId:B,operacion:'seguir'})
 const match=await call(db,A,'crear_partida',{rival:B}),friends=await call(db,A,'amigos'),matches=await call(db,A,'partidas'),availability=await call(db,A,'emparejamiento')
 await db.exec(old);await timed('antes_nueva',async()=>{for(const action of ['amigos','partidas','emparejamiento'])await call(db,A,action)});await db.exec(optimized)
 const lobby=await timed('despues_nueva',()=>lecturaCall(db,A,'nueva',{persona:B}))
 assert.deepEqual(lobby.amigos,((({lista,solicitudes,enviadas})=>({lista,solicitudes,enviadas}))(friends)))
 assert.equal(lobby.emparejamiento.disponible,availability.disponible);assert.ok(lobby.partidas.some(m=>m.id===match.id&&m.rival.id===B))
 assert.equal(lobby.partidas.length,matches.partidas.filter(m=>['jugando','buscando'].includes(m.estado)).length)
 assert.equal(lobby.jugador.jugador_id,A,'Request args cannot impersonate another player');assert.ok(!JSON.stringify(lobby).includes('correcta'))
 await assert.rejects(lecturaCall(db,null,'tienda'),/permission denied|401/)
 await assert.rejects(lecturaCall(db,A,'comprar'),/404/)
 await db.query('UPDATE public.profiles SET banned=true WHERE id=$1',[C]);await assert.rejects(lecturaCall(db,C,'album'),/403/)
 const movements=(await db.query('SELECT * FROM suizamente_private.suizamente_movimientos ORDER BY jugador_id,motivo,ref')).rows
 for(const action of ['tienda','album','nueva'])await lecturaCall(db,A,action)
 assert.deepEqual((await db.query('SELECT * FROM suizamente_private.suizamente_movimientos ORDER BY jugador_id,motivo,ref')).rows,movements,'Reads do not award existing rewards twice')
 // Actual attack settlement removes placements atomically at level zero.
 await db.query("SELECT suizamente_private.v3_anotar($1,'fixture','decoraciones',5000)",[B])
 await db.query("INSERT INTO suizamente_private.suizamente_mapa VALUES($1,1,'LU',1),($1,1,'UR',1)",[B])
 await db.query("INSERT INTO suizamente_private.persona_decoraciones(persona,decoracion,vista) VALUES($1,'vacas',true),($1,'tren',true)",[B])
 await mejoraCall(db,B,'decorar/poner',{decoracion:'vacas',hueco:'LU-t1',vuelta:1});await mejoraCall(db,B,'decorar/poner',{decoracion:'tren',hueco:'UR-t1',vuelta:1})
 for(const level of [2,1])await db.query("UPDATE suizamente_private.suizamente_mapa SET nivel=$2 WHERE jugador_id=$1 AND canton='LU'",[B,level])
 assert.equal((await mejoraCall(db,B,'decorar/inicio')).puestas.find(p=>p.k==='vacas').canton,'LU','Level 1 still supports decorations')
 await db.query("SELECT suizamente_private.v2_cerrar($1,$2,'sellos')",[match.id,A])
 let attack=await call(db,A,'atacar',{id:match.id,canton:'LU'})
 for(let n=1;n<=attack.preguntasTotal;n++){
  const {payload}=(await db.query('SELECT payload FROM suizamente_private.suizamente_asaltos WHERE id=$1',[attack.id])).rows[0]
  attack=await callOriginal(db,A,'asalto_respuesta',{id:attack.id,turnoN:attack.turnoN,n:attack.pregunta.n,opcion:payload.correcta})
  if(attack.estado!=='resuelto')attack=await call(db,A,'asalto_siguiente',{id:attack.id,turnoN:attack.turnoN})
 }
 assert.equal(attack.estado,'resuelto');const decorated=await mejoraCall(db,B,'decorar/inicio')
 assert.equal(decorated.mapa.niveles.LU,0);assert.ok(!decorated.puestas.some(p=>p.k==='vacas'));assert.equal(decorated.puestas.find(p=>p.k==='tren').canton,'UR')
 const owned=decorated.tipos.find(t=>t.id==='vacas');assert.equal(owned.tuya,true);assert.equal(owned.colocada,null);assert.equal(owned.momentoPendiente,false)
 await assert.rejects(mejoraCall(db,B,'decorar/poner',{decoracion:'vacas',hueco:'LU-t1',vuelta:1}),/Construye primero/)
 await call(db,B,'construir',{canton:'LU',nivel:0,vuelta:1,clave:crypto.randomUUID()});assert.equal((await mejoraCall(db,B,'decorar/poner',{decoracion:'vacas',hueco:'LU-t1',vuelta:1})).puestas.find(p=>p.k==='vacas').canton,'LU')
 await db.exec(await readFile('supabase/suizamente_v41_lecturas_rapidas.sql','utf8'));await db.exec(await readFile('supabase/suizamente_v42_decoraciones_nivel_cero.sql','utf8'))
 await db.exec('DELETE FROM suizamente_private.suizamente_limites')
 for(let i=0;i<60;i++)await lecturaCall(db,A,'tienda');await assert.rejects(lecturaCall(db,A,'tienda'),/429/)
 await mkdir('output/carga-rapida',{recursive:true});await writeFile('output/carga-rapida/servidor.json',JSON.stringify({times,parity:true,security:true,attackReturnsDecoration:true},null,2));console.log(JSON.stringify(times));console.log('PASS: identical snapshots; every lap/event price; one lobby request; auth, privacy, limit, original attack and inventory return')
}catch(e){console.error(e.message,e.where||'');process.exitCode=1}finally{await db.close()}
