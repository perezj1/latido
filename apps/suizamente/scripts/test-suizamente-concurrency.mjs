// Real PostgreSQL, isolated container only. Never connects to production.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {database,profile,A,B} from './lib/suizamente-v2-test-db.mjs'
const container='suizamente-locks-'+process.pid,image='public.ecr.aws/supabase/postgres:17.4.1.048',password='local-fixture-only',out='output/sellos/concurrencia'
function docker(args,input){return new Promise((resolve,reject)=>{const p=spawn('docker',args,{windowsHide:true,stdio:['pipe','pipe','pipe']}),stdout=[],stderr=[];p.stdout.on('data',b=>stdout.push(b));p.stderr.on('data',b=>stderr.push(b));p.on('error',reject);p.on('close',code=>resolve({code,out:Buffer.concat(stdout).toString(),err:Buffer.concat(stderr).toString()}));p.stdin.on('error',()=>{});p.stdin.end(input)})}
async function sql(text,{allowError=false}={}){const r=await docker(['exec','-i','-e','PGPASSWORD='+password,container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-U','supabase_admin','-d','suizamente_qa'],text);if(r.code&&!allowError)throw Error(r.err);return r}
const literal=value=>value===null?'NULL':"'"+String(value).replaceAll("'","''")+"'"
const engine={exec:async text=>{await sql(text.replace(/CREATE ROLE (anon|authenticated);|CREATE ROLE service_role BYPASSRLS;?/g,''))},query:async(text,values=[])=>{await sql(text.replace(/\$(\d+)\b/g,(_,n)=>literal(values[Number(n)-1])));return {rows:[]}},close:async()=>{}}
async function rpc(actor,action,args={},pause=false,name='sz-stress'){
 const r=await sql(`BEGIN;SET LOCAL application_name=${literal(name)};SET LOCAL deadlock_timeout='100ms';SELECT set_config('test.uid',${literal(actor)},true);SELECT set_config('test.pause',${literal(pause?'on':'off')},true);SET LOCAL ROLE authenticated;SELECT 'SZ_RESULT:'||public.suizamente_v2(${literal(action)},${literal(JSON.stringify(args))}::jsonb,NULL,NULL)::text;COMMIT;`,{allowError:true})
 return r.code?{error:r.err.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]||r.err}:JSON.parse(r.out.split('\n').find(line=>line.startsWith('SZ_RESULT:')).slice(10))
}
async function waitForPause(){for(let i=0;i<100;i++){const r=await sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='sz-race-normal' AND wait_event='PgSleep'");if(Number(r.out.trim()))return;await new Promise(r=>setTimeout(r,10))}throw Error('Normal API did not reach the controlled pause')}
let started=false
try{
 const launched=await docker(['run','--rm','-d','--name',container,'--label','suizamente.qa=concurrency','-e','POSTGRES_PASSWORD='+password,'-e','POSTGRES_DB=suizamente_qa',image]);assert.equal(launched.code,0,launched.err);started=true
 for(let i=0;;i++){const ready=await docker(['exec',container,'pg_isready','-h','127.0.0.1','-U','postgres','-d','suizamente_qa']);if(!ready.code)break;if(i>80)throw Error('QA PostgreSQL not ready');await new Promise(r=>setTimeout(r,250))}
 await sql("DO $$ BEGIN IF current_database()<>'suizamente_qa' THEN RAISE EXCEPTION 'Wrong test database';END IF;END $$;DROP SCHEMA IF EXISTS auth CASCADE;CREATE EXTENSION IF NOT EXISTS pg_trgm;")
 await database({carga:true,engine});await rpc(A,'guardar_jugador',profile('Alex'));await rpc(B,'guardar_jugador',profile('Lu'));await rpc(A,'bienvenida');await rpc(B,'bienvenida')
 // Pause at the actual player-before-rate-limit inversion, inside the real API.
 const def=(await sql("SELECT pg_get_functiondef('suizamente_private.v12_misiones_preparar(text,date)'::regprocedure)")).out
 const needle='PERFORM 1 FROM suizamente_private.suizamente_jugadores WHERE jugador_id=actor FOR UPDATE;'
 assert.ok(def.includes(needle));await sql(def.replace(needle,needle+" IF current_setting('test.pause',true)='on' THEN PERFORM pg_sleep(1.5);END IF;"))
 async function race(){await sql('DELETE FROM suizamente_private.suizamente_limites');const normal=rpc(A,'jugador',{},true,'sz-race-normal');await waitForPause();const custom=rpc(A,'misiones');return Promise.all([normal,custom])}
 const before=await race();assert.ok(before.some(r=>r.error==='40P01'),'the original real API reproduces the reported deadlock: '+JSON.stringify(before.map(r=>({error:r.error||null}))))
 const migration=await readFile('supabase/suizamente_v24_concurrencia.sql','utf8');await sql(migration);await sql(migration)
 const after=await race();assert.ok(after.every(r=>!r.error),'entry coordination removes the real lock inversion')
 let ended=false;const slow=rpc(A,'jugador',{},true,'sz-race-normal').finally(()=>{ended=true});await waitForPause();assert.ok(!(await rpc(B,'jugador')).error);assert.equal(ended,false,'another account does not wait for the per-account lock');await slow
 await sql('DELETE FROM suizamente_private.suizamente_limites')
 const stress=await Promise.all([A,B].flatMap(actor=>['jugador','misiones','tienda','album','partidas','liga','jugador','tienda'].map(action=>rpc(actor,action))));assert.ok(stress.every(r=>!r.error),JSON.stringify(stress.filter(r=>r.error)))
 await sql(`SELECT suizamente_private.v3_anotar('${A}','fixture','concurrency',5000,0,'{}');`)
 const config=await rpc(A,'config'),key=crypto.randomUUID(),first=await rpc(A,'jugador'),buys=await Promise.all([rpc(A,'comprar',{articulo:'quita',clave:key}),rpc(A,'comprar',{articulo:'quita',clave:key})]),last=await rpc(A,'jugador')
 assert.ok(buys.every(r=>!r.error));assert.equal(first.jugador.monedas-last.jugador.monedas,config.comodines.find(c=>c.id==='quita').precio)
 assert.equal(Number((await sql(`SELECT count(*) FROM suizamente_private.suizamente_movimientos WHERE jugador_id='${A}' AND motivo='compra' AND ref='${key}'`)).out.trim()),1)
 const restricted=await sql("BEGIN;SET LOCAL ROLE authenticated;SELECT suizamente_private.v24_api_base('jugador','{}',NULL,NULL);COMMIT;",{allowError:true});assert.ok(restricted.code&&restricted.err.includes('42501'))
 await mkdir(out,{recursive:true});const result={realPostgres:true,originalDeadlockReproduced:true,afterNoDeadlock:true,otherAccountNotBlocked:true,parallelRequests:stress.length,onePurchaseCharge:true,migrationIdempotent:true,privatePermissions:true};await writeFile(out+'/resultado.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result))
}finally{if(started)await docker(['stop',container])}
