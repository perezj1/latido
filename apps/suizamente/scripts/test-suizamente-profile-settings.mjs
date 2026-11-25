import assert from 'node:assert/strict'
import {database,call,profile,A,B} from './lib/suizamente-v2-test-db.mjs'
import {normalizeSzSettings} from '../game/src/lib/suizamenteSettings.js'
const db=await database({invitaciones:true})
try{
 // The old app stored avisos as a single checkbox boolean under the same key.
 const legacy={apariencia:'light',sonidos:true,vibracion:false,menosAnimaciones:false,avisos:false}
 await assert.rejects(call(db,A,'guardar_jugador',{...profile('Alex'),ajustes:legacy}),/SZV2:400:Ajustes no válidos/)
 for(const avisos of [false,true]){
  const prefs=normalizeSzSettings({...legacy,avisos,musica:'false',sonidos:'on',vibracion:0,onboarding:'another-account',foto_url:'data:image/jpeg;base64,'+'a'.repeat(5000),guia:{partida:'foreign'}})
  assert.deepEqual(prefs,{musica:false,sonidos:true,vibracion:false,menosAnimaciones:false,apariencia:'clara',avisos:{turnos:avisos}})
  const saved=await call(db,A,'guardar_jugador',{...profile('Alex'),ajustes:prefs});assert.equal(saved.jugador.ajustes.avisos.turnos,avisos)
 }
 for(const value of [null,[],12,'invalid'])assert.deepEqual(normalizeSzSettings(value),normalizeSzSettings())
 assert.deepEqual(normalizeSzSettings({avisos:{turnos:'false',bad:null,other:[]}}).avisos,{turnos:false})
 const metadata={onboarding:'2026-11-01T00:00:00Z',guia:{giro:false,pregunta:true},foto_url:'https://photos.suizamente.test/own.jpg'}
 await db.query('UPDATE suizamente_private.suizamente_jugadores SET ajustes=ajustes||$2::jsonb WHERE jugador_id=$1',[A,JSON.stringify(metadata)])
 const before=(await db.query('SELECT count(*) n FROM suizamente_private.suizamente_movimientos')).rows[0].n
 const own=(await call(db,A,'jugador')).jugador,preferences=normalizeSzSettings(own.ajustes),updated=await call(db,A,'guardar_jugador',{...profile('Alex'),ajustes:preferences})
 for(const key of Object.keys(metadata))assert.deepEqual(updated.jugador.ajustes[key],metadata[key],'Server metadata survives a preference update')
 const other=await call(db,B,'guardar_jugador',{...profile('Lu'),ajustes:normalizeSzSettings(own.ajustes)});for(const key of Object.keys(metadata))assert.equal(other.jugador.ajustes[key],undefined,'New accounts do not inherit another profile metadata')
 assert.equal((await db.query('SELECT count(*) n FROM suizamente_private.suizamente_movimientos')).rows[0].n,before)
 console.log('Profile settings: reproduced legacy checkbox failure; normalized preferences save; invalid local data and foreign metadata excluded; own server metadata preserved; no reward changes.')
}finally{await db.close()}
