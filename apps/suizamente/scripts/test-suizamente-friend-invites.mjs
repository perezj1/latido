import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {database,call,profile,A,B,C,G} from './lib/suizamente-v2-test-db.mjs'
const db=await database({invitaciones:true}),migration=await readFile('supabase/suizamente_v25_invitaciones_amigos.sql','utf8')
try{
 for(const [id,name] of [[A,'Alex'],[B,'Lu']])await call(db,id,'guardar_jugador',profile(name))
 for(const action of ['invitar_amigo','aceptar_amigo'])await assert.rejects(call(db,null,action,{codigo:'a'.repeat(32)}),/SZV2:401/)
 await assert.rejects(call(db,C,'aceptar_amigo',{codigo:'a'.repeat(32)}),/SZV2:404:Crea primero tu perfil/)
 const invite=await call(db,A,'invitar_amigo');assert.match(invite.codigo,/^[a-f0-9]{32}$/);assert.equal(invite.enlace,'/suizamente/amigo/'+invite.codigo)
 const saved=(await db.query('SELECT * FROM suizamente_private.suizamente_invitaciones_amigos WHERE codigo=$1',[invite.codigo])).rows[0]
 assert.ok(Math.abs(Date.parse(saved.caduca_en)-Date.now()-7*86400000)<10000,'Same configured seven-day validity')
 await assert.rejects(call(db,A,'aceptar_amigo',{codigo:invite.codigo}),/SZV2:409/)
 await assert.rejects(call(db,B,'aceptar_amigo',{codigo:'missing'}),/SZV2:404/)
 const before=(await db.query('SELECT count(*) n FROM suizamente_private.suizamente_movimientos')).rows[0].n
 await call(db,B,'amistad',{jugadorId:A,operacion:'solicitar'})
 const accepted=await call(db,B,'aceptar_amigo',{codigo:invite.codigo,jugadorId:C});assert.equal(accepted.amigo.id,A)
 assert.deepEqual((await call(db,A,'amigos')).lista.map(p=>p.id),[B]);assert.deepEqual((await call(db,B,'amigos')).lista.map(p=>p.id),[A]);assert.deepEqual((await call(db,A,'amigos')).solicitudes,[])
 await call(db,B,'aceptar_amigo',{codigo:invite.codigo});await db.exec(migration);await call(db,B,'aceptar_amigo',{codigo:invite.codigo})
 assert.equal((await db.query('SELECT count(*) n FROM suizamente_private.suizamente_amigos')).rows[0].n,2,'Refresh, replay and migration never duplicate friendship')
 await call(db,C,'guardar_jugador',profile('Caro'));await call(db,C,'aceptar_amigo',{codigo:invite.codigo});assert.equal((await call(db,A,'amigos')).lista.length,2,'An invitation can be shared to more than one person')
 assert.equal((await db.query('SELECT count(*) n FROM suizamente_private.suizamente_movimientos')).rows[0].n,before,'Friend invitations award nothing')
 assert.equal((await db.query('SELECT count(*) n FROM suizamente_private.suizamente_partidas')).rows[0].n,0,'Friendship does not create an unsolicited match')
 await db.query('UPDATE suizamente_private.suizamente_jugadores SET bloqueado=true WHERE jugador_id=$1',[A]);await assert.rejects(call(db,B,'aceptar_amigo',{codigo:invite.codigo}),/SZV2:404/)
 await db.query('UPDATE suizamente_private.suizamente_jugadores SET bloqueado=false WHERE jugador_id=$1',[A]);await db.query('UPDATE suizamente_private.suizamente_invitaciones_amigos SET caduca_en=clock_timestamp()-interval \'1 second\' WHERE codigo=$1',[invite.codigo]);await assert.rejects(call(db,B,'aceptar_amigo',{codigo:invite.codigo}),/SZV2:404/)
 const old=await call(db,A,'invitaciones');assert.equal(old.codigo.length,8);const match=await call(db,B,'crear_partida',{rival:old.codigo});assert.equal(match.estado,'jugando','Existing match invitations keep working')
 for(const role of ['anon','authenticated'])await assert.rejects(db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE '+role);await tx.exec('SELECT * FROM suizamente_private.suizamente_invitaciones_amigos')}),e=>e.code==='42501')
 await assert.rejects(db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE authenticated');await tx.query('SELECT suizamente_private.v25_api_base($1,$2::jsonb,$3::uuid,$4)',['jugador','{}',G,'x'])}),e=>e.code==='42501')
 console.log('Friend invitations: authenticated, private, reciprocal, idempotent, multiple recipients, expiry, moderation, no rewards/matches, legacy links and repeat migration passed.')
}finally{await db.close()}
