import assert from 'node:assert/strict'
import {database,call,profile,A} from './lib/suizamente-v2-test-db.mjs'
import {createSuizamenteHandler} from '../server/suizamente/http.mjs'
const db=await database({concurrencia:true}),oldUrl=process.env.SUPABASE_URL,oldKey=process.env.SUPABASE_ANON_KEY,oldWarn=console.warn,oldError=console.error
try{
 await call(db,A,'guardar_jugador',profile('Alex'));await call(db,A,'bienvenida')
 process.env.SUPABASE_URL='https://fixture.invalid';process.env.SUPABASE_ANON_KEY='fixture';console.warn=()=>{};console.error=()=>{}
 async function request(fetchImpl,body={articulo:'quita',clave:crypto.randomUUID()}){
  const handler=createSuizamenteHandler({fetchImpl}),req={method:'POST',url:'/api/suizamente/tienda/comprar',body,headers:{host:'localhost',authorization:'Bearer fixture.token'}},res={headers:{},setHeader(k,v){this.headers[k]=v},end(text){this.data=JSON.parse(text)}}
  await handler(req,res);return res
 }
 const key=crypto.randomUUID(),before=await call(db,A,'jugador'),config=await call(db,A,'config');let attempts=0,requestBody
 const successful=await request(async(_url,options)=>{
  attempts++;if(requestBody)assert.equal(options.body,requestBody,'every retry preserves identity, arguments and the purchase key');requestBody=options.body
  const b=JSON.parse(options.body)
  try{
   const data=await db.transaction(async tx=>{
    await tx.query("SELECT set_config('test.uid',$1,true)",[A]);await tx.exec('SET LOCAL ROLE authenticated')
    const data=(await tx.query('SELECT public.suizamente_v2($1,$2::jsonb,$3::uuid,$4) AS result',[b.p_action,JSON.stringify(b.p_args),b.p_guest_id,b.p_guest_token])).rows[0].result
    if(attempts<3){const error=new Error('transaction aborted');error.code=attempts===1?'40P01':'40001';throw error}
    return data
   });return Response.json(data)
  }catch(error){return Response.json({code:error.code,message:'transaction aborted'},{status:500})}
 },{articulo:'quita',clave:key})
 assert.equal(successful.statusCode,200);assert.equal(attempts,3)
 const after=await call(db,A,'jugador');assert.equal(before.jugador.monedas-after.jugador.monedas,config.comodines.find(c=>c.id==='quita').precio)
 assert.equal((await db.query("SELECT count(*)::integer AS n FROM suizamente_private.suizamente_movimientos WHERE motivo='compra' AND ref=$1",[key])).rows[0].n,1,'failed attempts roll back; one committed purchase')
 for(const code of ['40P01','40001']){let calls=0;const result=await request(async()=>{calls++;return Response.json({code,message:'transaction aborted'},{status:500})});assert.equal(calls,3);assert.equal(result.statusCode,503)}
 for(const [code,status] of [['23505',409],['XX000',500],['P0001',400],['PGRST301',401]]){
  let calls=0;await request(async()=>{calls++;return Response.json({code,message:'unrelated error'},{status})});assert.equal(calls,1,'no speculative mutation retry for '+code)
 }
 let calls=0;await request(async()=>{calls++;throw Error('network outcome unknown')});assert.equal(calls,1)
 calls=0;await request(async()=>{calls++;return new Response('gateway failure',{status:502})});assert.equal(calls,1)
 console.log('Retry: whole transaction rollback proven before safe 40P01/40001 recovery; identical keys/body; one purchase charge; maximum three attempts; no retry on unknown/network/auth/integrity outcomes.')
}finally{console.warn=oldWarn;console.error=oldError;if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;if(oldKey===undefined)delete process.env.SUPABASE_ANON_KEY;else process.env.SUPABASE_ANON_KEY=oldKey;await db.close()}
