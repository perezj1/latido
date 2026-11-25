import assert from 'node:assert/strict'
import {database,call,profile,A} from './lib/suizamente-v2-test-db.mjs'
import {createSuizamenteHandler} from '../server/suizamente/http.mjs'
const db=await database({carga:true})
try{
 await call(db,A,'guardar_jugador',profile('Alex'))
 const initial=await call(db,A,'jugador');assert.equal(initial.jugador.ajustes.musica,undefined,'old profile stays compatible; client defaults on')
 const ledger=(await db.query('SELECT count(*) n FROM suizamente_private.suizamente_movimientos')).rows[0].n
 for(const value of [false,true]){const saved=await call(db,A,'guardar_jugador',{...profile('Alex'),ajustes:{musica:value,sonidos:!value}});assert.equal(saved.jugador.ajustes.musica,value);const loaded=await call(db,A,'jugador');assert.equal(loaded.jugador.ajustes.musica,value);assert.equal(loaded.jugador.ajustes.sonidos,!value)}
 assert.equal((await db.query('SELECT count(*) n FROM suizamente_private.suizamente_movimientos')).rows[0].n,ledger)
 const oldUrl=process.env.SUPABASE_URL,oldKey=process.env.SUPABASE_ANON_KEY;process.env.SUPABASE_URL='https://fixture.invalid';process.env.SUPABASE_ANON_KEY='fixture';let fetches=0
 try{
  const handler=createSuizamenteHandler({fetchImpl:async(_url,options)=>{fetches++;const b=JSON.parse(options.body);assert.equal(typeof b.p_args.ajustes.musica,'boolean');return Response.json({guardado:true})}})
  async function request(musica){const req={method:'PUT',url:'/api/suizamente/jugador',body:{ajustes:{musica}},headers:{host:'localhost',authorization:'Bearer fixture.token'}},res={setHeader(){},end(data){this.data=JSON.parse(data)}};await handler(req,res);return res}
  for(const bad of ['false',0,null,{},[]])assert.equal((await request(bad)).statusCode,400)
  assert.equal(fetches,0)
  for(const value of [true,false])assert.equal((await request(value)).statusCode,200)
  assert.equal(fetches,2)
 }finally{if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;if(oldKey===undefined)delete process.env.SUPABASE_ANON_KEY;else process.env.SUPABASE_ANON_KEY=oldKey}
 console.log('Audio settings: existing JSON saves independent booleans across reads; old profiles remain valid; HTTP rejects non-booleans; no migration or reward change.')
}finally{await db.close()}
