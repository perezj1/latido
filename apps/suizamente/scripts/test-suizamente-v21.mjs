import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {database,call,profile,A,B} from './lib/suizamente-v2-test-db.mjs'
const db=await database({onboarding:true}),sql=await readFile('supabase/suizamente_v21_cuatro_opciones.sql','utf8'),pid='r_s5o1xw'
try{
 for(const [id,name] of [[A,'Alex'],[B,'Lu']]){await call(db,id,'guardar_jugador',profile(name));await call(db,id,'bienvenida')}
 const before=(await db.query('SELECT id,payload FROM suizamente_private.suizamente_preguntas ORDER BY id')).rows,config=await call(db,A,'config')
 await db.exec("CREATE TABLE public.suizamente_catalogo_votos(pregunta_id text PRIMARY KEY,opciones smallint CHECK(opciones BETWEEN 2 AND 3));CREATE TABLE public.suizamente_votos(pregunta_id text,jugador_id text,opcion smallint CHECK(opcion BETWEEN 0 AND 2));CREATE SCHEMA suizamente_social;CREATE TABLE suizamente_social.preguntas(id text PRIMARY KEY,correcta smallint,opciones smallint CHECK(opciones BETWEEN 2 AND 3));")
 await db.query('INSERT INTO public.suizamente_catalogo_votos VALUES($1,3);',[pid]);await db.query('INSERT INTO public.suizamente_votos VALUES($1,$2,1)',[pid,A]);await db.query('INSERT INTO suizamente_social.preguntas VALUES($1,1,3)',[pid])
 let oldMatch=await call(db,A,'crear_partida',{rival:B})
 await db.query("SELECT suizamente_private.v4_preguntar($1,$2,'dia','normal',(SELECT payload FROM suizamente_private.suizamente_preguntas WHERE id=$3))",[oldMatch.id,A,pid])
 const oldQuestion=(await call(db,A,'partida',{id:oldMatch.id})).pregunta
 await db.exec(sql)
 assert.deepEqual((await call(db,A,'partida',{id:oldMatch.id})).pregunta,oldQuestion,'already sent question remains a three-option snapshot')
 const after=(await db.query('SELECT id,payload FROM suizamente_private.suizamente_preguntas ORDER BY id')).rows
 let added=0,emojis=0
 for(let i=0;i<before.length;i++){const a=before[i].payload,b=after[i].payload;assert.equal(a.id,b.id);assert.deepEqual(a.opciones,b.opciones.slice(0,a.opciones.length));assert.equal(a.correcta,b.correcta);added+=b.opciones.length-a.opciones.length;emojis+=a.emoji!==b.emoji}
 assert.equal(added,631);assert.equal(emojis,419)
 const next=await call(db,A,'config');for(const key of ['comodines','tienda','partida','asaltos','logros','bienvenida'])assert.deepEqual(next[key],config[key],key+' rules remain identical')
 assert.equal((await db.query('SELECT opciones FROM public.suizamente_catalogo_votos WHERE pregunta_id=$1',[pid])).rows[0].opciones,4)
 assert.equal((await db.query('SELECT opciones FROM suizamente_social.preguntas WHERE id=$1',[pid])).rows[0].opciones,4)
 assert.equal((await db.query('SELECT opcion FROM public.suizamente_votos WHERE pregunta_id=$1',[pid])).rows[0].opcion,1)
 await db.query('INSERT INTO public.suizamente_votos VALUES($1,$2,3)',[pid,B])
 const vm=after.find(q=>q.payload.tipo==='real'&&q.payload.opciones.length===2).payload
 for(let i=0;i<12;i++)assert.deepEqual((await db.query('SELECT suizamente_private.v21_orden($1) o',[JSON.stringify(vm)])).rows[0].o,[0,1])
 const orders=new Set();for(let i=0;i<20;i++)orders.add(JSON.stringify((await db.query('SELECT suizamente_private.v21_orden($1) o',[JSON.stringify(after.find(q=>q.id===pid).payload)])).rows[0].o));assert.ok(orders.size>1)
 for(const name of ['v2_api_base','v4_preguntar','v5_accion','v17_preguntar'])assert.ok((await db.query('SELECT prosrc FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname=$1 AND p.proname=$2',['suizamente_private',name])).rows[0].prosrc.includes('v21_orden'),name)
 const practice=await call(db,null,'primera_vez');assert.equal(practice.pregunta.opciones.length,4);assert.ok(!/correcta|dato/.test(JSON.stringify(practice)));assert.deepEqual((await call(db,null,'primera_vez')).pregunta.opciones,practice.pregunta.opciones)
 assert.deepEqual(practice.pregunta.opciones.map(o=>o.indice),[0,1,2,3]);assert.ok(practice.pregunta.opciones.every(o=>!('e' in o)),'practice exposes visual positions without original emoji')
 const solved=await call(db,null,'primera_vez_responder',{opcion:practice.pregunta.opciones.find(o=>o.t==='Lo ves marcharse').indice});assert.equal(solved.resultado.ok,true)
 assert.deepEqual((await call(db,A,'primera_vez')).pregunta.opciones,practice.pregunta.opciones,'signed adoption keeps practice order')
 const proposal={tipo:'real',tema:'casa',emoji:'🧠',pregunta:'¿Qué opción eliges en esta pregunta de prueba?',opciones:Array.from({length:4},(_,i)=>({e:'💡',t:'Opción de prueba '+i})),correcta:3,dato:'Un dato explicativo de prueba para validar las cuatro opciones.',fuente:''}
 await db.query('SELECT suizamente_private.v7_validar_propuesta($1)',[JSON.stringify(proposal)])
 await assert.rejects(()=>db.query('SELECT suizamente_private.v7_validar_propuesta($1)',[JSON.stringify({...proposal,correcta:1,opciones:proposal.opciones.slice(0,3)})]),/Revisa las opciones/)
 // Isolate a reviewed question so the real normal-question endpoint must select it.
 await db.query('UPDATE suizamente_private.suizamente_preguntas SET oculta=id<>$1',[pid])
 // Practice excludes pid for A; use B for the normal match and real powerups.
 const create=async()=>{const m=await call(db,B,'crear_partida',{rival:A});await db.query("UPDATE suizamente_private.suizamente_partidas SET fase='elegida',casilla='dia' WHERE id=$1",[m.id]);return call(db,B,'pregunta',{id:m.id,turnoN:m.turnoN})}
 // The normal selector excludes both players' practice ids. Use a different real question.
 const other=after.find(q=>q.payload.tipo==='real'&&q.payload.opciones.length===4&&q.id!==pid&&q.payload.tema==='transporte').payload
 await db.query('UPDATE suizamente_private.suizamente_preguntas SET oculta=id<>$1',[other.id])
 await db.query("SELECT suizamente_private.v3_anotar($1,'fixture','four',0,0,'{\"quita\":4,\"otra\":4}')",[B])
 let m=await create();assert.equal(m.pregunta.opciones.length,4);assert.ok(!/correcta|dato/.test(JSON.stringify(m.pregunta)));assert.deepEqual(m.pregunta.opciones.map(o=>o.indice),[0,1,2,3]);assert.ok(m.pregunta.opciones.every(o=>!('e' in o)),'new normal questions expose visual positions without original emoji')
 m=await call(db,B,'comodin',{id:m.id,turnoN:m.turnoN,n:m.pregunta.n,tipo:'quita'});assert.equal(m.pregunta.quitadas.length,1);assert.notEqual(m.pregunta.quitadas[0],m.pregunta.opciones.find(o=>o.t===other.opciones[other.correcta].t).indice)
 const correctVisual=m.pregunta.opciones.find(o=>o.t===other.opciones[other.correcta].t).indice
 const incorrect=m.pregunta.opciones.find(o=>o.indice!==correctVisual&&!m.pregunta.quitadas.includes(o.indice)).indice,originalIncorrect=other.opciones.findIndex(o=>o.t===m.pregunta.opciones[incorrect].t)
 m=await call(db,B,'comodin',{id:m.id,turnoN:m.turnoN,n:m.pregunta.n,tipo:'otra'})
 m=await call(db,B,'respuesta',{id:m.id,turnoN:m.turnoN,n:m.pregunta.n,opcion:incorrect});assert.ok(m.pregunta.falladas.includes(incorrect));assert.ok(m.pregunta)
 m=await call(db,B,'respuesta',{id:m.id,turnoN:m.turnoN,n:m.pregunta.n,opcion:correctVisual});assert.equal(m.resultado.ok,true)
 assert.equal(m.resultado.pct,null,'small counts never expose percentages')
 assert.equal((await db.query('SELECT opcion FROM suizamente_private.suizamente_votos WHERE jugador_id=$1 AND pregunta_id=$2',[B,other.id])).rows[0].opcion,originalIncorrect,'first vote keeps original option even after second chance')
 await db.query("INSERT INTO suizamente_private.suizamente_votos(pregunta_id,jugador_id,opcion) SELECT $1,'fixture-'||i,$2 FROM generate_series(1,19) i",[other.id,other.correcta])
 const fresh=await call(db,A,'crear_partida',{rival:B});await db.query("SELECT suizamente_private.v4_preguntar($1,$2,'dia','normal',$3)",[fresh.id,A,JSON.stringify(other)])
 const unanswered=await call(db,A,'partida',{id:fresh.id})
 const wrong=await call(db,A,'respuesta',{id:fresh.id,turnoN:unanswered.turnoN,n:unanswered.pregunta.n,opcion:unanswered.pregunta.opciones.find(o=>o.t===other.opciones[3].t).indice});assert.equal(wrong.resultado.ok,false);assert.equal(wrong.resultado.pct,90)
 assert.equal((await db.query('SELECT opcion FROM suizamente_private.suizamente_votos WHERE jugador_id=$1 AND pregunta_id=$2',[A,other.id])).rows[0].opcion,3)
 await db.exec(sql);assert.equal((await db.query('SELECT count(*)::int n FROM public.suizamente_votos')).rows[0].n,2)
 console.log('v21: +631 append-only options, 419 neutral emojis, unchanged rules/votes/sent snapshots, repeated migration, persistent shuffle/VM, signed practice, index 3, proposals and both powerups passed.')
}catch(e){console.error(e.message,e.where||'',e.internalQuery?.slice(0,700)||'');process.exitCode=1}finally{await db.close()}
