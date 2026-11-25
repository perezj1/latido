// Isolated PostgreSQL container. Never connects to production.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdir,writeFile} from 'node:fs/promises'
import {database,profile,A,B,C} from './lib/suizamente-v2-test-db.mjs'
const container='suizamente-friend-invites-'+process.pid,password='local-fixture-only',out='output/invitar-amigos/concurrencia'
function docker(args,input){return new Promise((resolve,reject)=>{const p=spawn('docker',args,{windowsHide:true,stdio:['pipe','pipe','pipe']}),stdout=[],stderr=[];p.stdout.on('data',b=>stdout.push(b));p.stderr.on('data',b=>stderr.push(b));p.on('error',reject);p.on('close',code=>resolve({code,out:Buffer.concat(stdout).toString(),err:Buffer.concat(stderr).toString()}));p.stdin.on('error',()=>{});p.stdin.end(input)})}
async function sql(text){const r=await docker(['exec','-i','-e','PGPASSWORD='+password,container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-U','supabase_admin','-d','suizamente_qa'],text);if(r.code)throw Error(r.err);return r.out}
const literal=value=>value===null?'NULL':"'"+String(value).replaceAll("'","''")+"'"
const engine={exec:async text=>{await sql(text.replace(/CREATE ROLE (anon|authenticated);|CREATE ROLE service_role BYPASSRLS;?/g,''))},query:async(text,values=[])=>{await sql(text.replace(/\$(\d+)\b/g,(_,n)=>literal(values[Number(n)-1])));return {rows:[]}},close:async()=>{}}
async function rpc(actor,action,args={},pause=false){const out=await sql(`BEGIN;SET LOCAL deadlock_timeout='100ms';SET LOCAL statement_timeout='10s';SELECT set_config('test.uid',${literal(actor)},true);SELECT set_config('test.pause',${literal(pause?'on':'off')},true);SET LOCAL ROLE authenticated;SELECT 'SZ_RESULT:'||public.suizamente_v2(${literal(action)},${literal(JSON.stringify(args))}::jsonb,NULL,NULL)::text;COMMIT;`);return JSON.parse(out.split('\n').find(line=>line.startsWith('SZ_RESULT:')).slice(10))}
let started=false
try{
 const launched=await docker(['run','--rm','-d','--name',container,'--label','suizamente.qa=friend-invites','-e','POSTGRES_PASSWORD='+password,'-e','POSTGRES_DB=suizamente_qa','public.ecr.aws/supabase/postgres:17.4.1.048']);assert.equal(launched.code,0,launched.err);started=true
 for(let i=0;;i++){const ready=await docker(['exec',container,'pg_isready','-h','127.0.0.1','-U','postgres','-d','suizamente_qa']);if(!ready.code)break;if(i>80)throw Error('QA PostgreSQL not ready');await new Promise(r=>setTimeout(r,250))}
 await sql("DO $$ BEGIN IF current_database()<>'suizamente_qa' THEN RAISE EXCEPTION 'Wrong test database';END IF;END $$;DROP SCHEMA IF EXISTS auth CASCADE;CREATE EXTENSION IF NOT EXISTS pg_trgm;")
 await database({invitaciones:true,engine});for(const [id,name] of [[A,'Alex'],[B,'Lu'],[C,'Caro']])await rpc(id,'guardar_jugador',profile(name))
 const a=await rpc(A,'invitar_amigo'),b=await rpc(B,'invitar_amigo')
 const def=await sql("SELECT pg_get_functiondef('suizamente_private.v12_misiones_preparar(text,date)'::regprocedure)"),needle='PERFORM 1 FROM suizamente_private.suizamente_jugadores WHERE jugador_id=actor FOR UPDATE;';assert.ok(def.includes(needle));await sql(def.replace(needle,needle+" IF current_setting('test.pause',true)='on' THEN PERFORM pg_sleep(0.4);END IF;"))
 const reciprocal=await Promise.all([rpc(B,'aceptar_amigo',{codigo:a.codigo},true),rpc(A,'aceptar_amigo',{codigo:b.codigo},true),rpc(C,'jugador')]);assert.equal(reciprocal[0].aceptada,true);assert.equal(reciprocal[1].aceptada,true)
 const repeated=await Promise.all(Array.from({length:6},(_,i)=>i%2?rpc(A,'aceptar_amigo',{codigo:b.codigo}):rpc(B,'aceptar_amigo',{codigo:a.codigo})));assert.ok(repeated.every(r=>r.aceptada))
 assert.equal(Number((await sql('SELECT count(*) FROM suizamente_private.suizamente_amigos')).trim()),2);assert.equal((await rpc(A,'amigos')).lista[0].id,B);assert.equal((await rpc(B,'amigos')).lista[0].id,A)
 await mkdir(out,{recursive:true});const result={realPostgres:true,reciprocalLinksWithoutDeadlock:true,replayCount:repeated.length,friendRows:2};await writeFile(out+'/resultado.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result))
}finally{if(started)await docker(['stop',container])}
