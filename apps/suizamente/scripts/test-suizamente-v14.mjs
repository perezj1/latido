import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {database,call,profile,A,B,G} from './lib/suizamente-v2-test-db.mjs'
const db=await database({produccion:true})
try{
 await call(db,null,'guardar_jugador',profile('Visita antigua'))
 const legacy=await call(db,null,'bienvenida'),coins=legacy.jugador.monedas
 await db.exec(await readFile('supabase/suizamente_v14_cuentas.sql','utf8'))
 assert.equal((await call(db,null,'config')).apiVersion,14)
 assert.equal((await call(db,null,'config')).requiereCuenta,true)
 assert.equal((await call(db,null,'capacidades')).admin,false)
 for(const action of ['jugador','guardar_jugador','crear_partida','girar','pregunta','respuesta','votos','mapa','construir','regalo','abrir_sobre','misiones','liga','vincular'])await assert.rejects(call(db,null,action,{rival:'azar'}),/SZV2:401/)
 await assert.rejects(call(db,null,'admin',{ruta:'resumen'}),/SZV2:403/)
 const linked=await call(db,A,'vincular');assert.equal(linked.jugador.jugador_id,A);assert.equal(linked.jugador.monedas,coins,'Existing guest progress remains recoverable after signing in')
 await call(db,B,'guardar_jugador',profile('Lu'))
 const m=await call(db,A,'crear_partida',{rival:B});assert.equal(m.estado,'jugando')
 await db.exec(await readFile('supabase/suizamente_v14_cuentas.sql','utf8'))
 assert.equal((await call(db,A,'config')).apiVersion,14)
 await assert.rejects(db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE anon');await tx.query("SELECT suizamente_private.v14_api_base('guardar_jugador','{}',$1::uuid,'x')",[G])}),e=>e.code==='42501')
 console.log('v14: account required for reads/actions/votes/profile, admin 403, public config, account games, preserved legacy linking, private wrapper permissions and repeat migration passed.')
}finally{await db.close()}
