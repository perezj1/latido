import assert from 'node:assert/strict'
import {database,call,profile,A,B} from './lib/suizamente-v2-test-db.mjs'
import {createSuizamenteHandler} from '../server/suizamente/http.mjs'
const db=await database({invitaciones:true}),oldUrl=process.env.SUPABASE_URL,oldKey=process.env.SUPABASE_ANON_KEY,oldError=console.error
try{
 for(const [id,name] of [[A,'Alex'],[B,'Lu']])await call(db,id,'guardar_jugador',profile(name))
 await db.query("SELECT suizamente_private.v3_anotar($1,'fixture','batch',0,0,'{\"sobres\":2}')",[A])
 const pack=await call(db,A,'abrir_sobre',{clave:crypto.randomUUID()}),balance=(await call(db,A,'jugador')).jugador.monedas,operations=[];let failAfterReveal=false
 process.env.SUPABASE_URL='https://fixture.invalid';process.env.SUPABASE_ANON_KEY='fixture';console.error=()=>{}
 const handler=createSuizamenteHandler({fetchImpl:async(_url,options)=>{
  const b=JSON.parse(options.body);operations.push({action:b.p_action,index:b.p_args.indice});const actor=options.headers.Authorization==='Bearer account-b'?B:A
  try{const data=await call(db,actor,b.p_action,b.p_args);if(failAfterReveal&&b.p_action==='girar_carta'){failAfterReveal=false;throw new TypeError('Unknown socket outcome')}return Response.json(data)}
  catch(e){if(e instanceof TypeError)throw e;return Response.json({message:e.message,code:e.code},{status:400})}
 }})
 async function request(id,body={todas:true},auth='Bearer account-a'){const req={method:'POST',url:'/api/suizamente/sobres/'+id+'/girar',body,headers:{host:'localhost',...(auth?{authorization:auth}:{})}},res={setHeader(){},end(text){this.data=JSON.parse(text)}};await handler(req,res);return res}
 const shown=await request(pack.id);assert.equal(shown.statusCode,200);assert.equal(shown.data.giradas,pack.total);assert.equal(shown.data.cartas.length,pack.total);assert.deepEqual(operations,[{action:'sobre',index:undefined},...Array.from({length:pack.total},(_,index)=>({action:'girar_carta',index}))]);assert.equal((await call(db,A,'jugador')).jugador.monedas,balance)
 operations.length=0;assert.equal((await request(pack.id)).data.giradas,pack.total);assert.deepEqual(operations,[{action:'sobre',index:undefined}],'Replay only reads the saved complete pack')
 operations.length=0;assert.equal((await request(pack.id,{todas:true},'')).statusCode,401);assert.equal((await request(pack.id,{todas:'true'})).statusCode,400);assert.equal(operations.length,0)
 assert.equal((await request(pack.id,{todas:true},'Bearer account-b')).statusCode,404,'Owner-only RPC guards the batch too')
 const second=await call(db,A,'abrir_sobre',{clave:crypto.randomUUID()}),before=(await call(db,A,'jugador')).jugador.monedas
 failAfterReveal=true;operations.length=0;assert.equal((await request(second.id)).statusCode,503);assert.equal(operations.filter(o=>o.action==='girar_carta').length,1,'Unknown network outcome is not replayed')
 assert.equal((await call(db,A,'sobre',{id:second.id})).giradas,1);assert.equal((await request(second.id)).data.giradas,second.total);assert.equal((await call(db,A,'jugador')).jugador.monedas,before)
 console.log('Pack HTTP batch: existing owner-only RPCs, ordered saved reveals in one mobile request, no award changes, replay, validation and recovery after an unknown outcome passed.')
}finally{console.error=oldError;if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;if(oldKey===undefined)delete process.env.SUPABASE_ANON_KEY;else process.env.SUPABASE_ANON_KEY=oldKey;await db.close()}
