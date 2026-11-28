import assert from 'node:assert/strict'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {mejorasDatabase,mejoraCall} from './lib/mejoras-test-db.mjs'
import {call,profile,A,B} from './lib/suizamente-v2-test-db.mjs'
const {db}=await mejorasDatabase(true,{inicioRapido:false})
try{
 for(const [id,name]of [[A,'Alex'],[B,'Lu']])await call(db,id,'guardar_jugador',profile(name))
 const match=await call(db,A,'crear_partida',{rival:B});await db.query('UPDATE suizamente_private.suizamente_partidas SET barra_a=2 WHERE id=$1',[match.id])
 const api=()=>mejoraCall(db,A,'resumen'),fingerprint="SELECT p.oid::regprocedure::text n,pg_get_functiondef(p.oid) d,p.proacl::text a FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace WHERE s.nspname IN('public','suizamente_private') AND p.proname NOT LIKE 'mej_%' ORDER BY n"
 await api();const functions=(await db.query(fingerprint)).rows,start=performance.now(),before=await api(),beforeMs=performance.now()-start
 const sql=await readFile('supabase/suizamente_v39_inicio_rapido.sql','utf8');await db.exec(sql);await db.exec(sql)
 const fastStart=performance.now(),after=await api(),afterMs=performance.now()-fastStart
 assert.deepEqual(after,before,'Same turn, modes and recommendations without three redundant dispatches')
 assert.deepEqual((await db.query(fingerprint)).rows,functions,'Every original game function and ACL is untouched')
 assert.match(after.boton.titulo,/Lu/);assert.match(after.boton.linea,/1 acierto/)
 await db.query("UPDATE suizamente_private.suizamente_partidas SET plazo=clock_timestamp()-interval '1 minute' WHERE id=$1",[match.id]);const expired=await api();assert.notEqual(expired.boton.to,'/suizamente/partida/'+match.id,'Original expiry transition still runs')
 await assert.rejects(mejoraCall(db,null,'resumen'),/401/)
 await db.query('UPDATE public.profiles SET banned=true WHERE id=$1',[A]);await assert.rejects(api(),/403/)
 await mkdir('output/inicio-rapido',{recursive:true});await writeFile('output/inicio-rapido/servidor.json',JSON.stringify({beforeMs,afterMs,sameResult:true,legacyUnchanged:true},null,2))
 console.log(JSON.stringify({beforeMs,afterMs,sameResult:true,legacyUnchanged:true}))
}finally{await db.close()}
