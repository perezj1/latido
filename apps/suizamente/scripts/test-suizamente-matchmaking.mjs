import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {database,call,profile,A,B,C,G,TOKEN} from './lib/suizamente-v2-test-db.mjs'
const db=await database({invitaciones:true}),D='44444444-4444-4444-8444-444444444444',E='55555555-5555-4555-8555-555555555555'
try{
 for(const [id,name] of [[A,'Alex'],[B,'Lu'],[C,'Caro']])await call(db,id,'guardar_jugador',profile(name))
 for(const [id,name] of [[D,'Dee'],[E,'Emi']]){await db.query('INSERT INTO auth.users(id) VALUES($1)',[id]);await db.query('INSERT INTO public.profiles(id,banned) VALUES($1,false)',[id]);await call(db,id,'guardar_jugador',profile(name))}
 const original=await call(db,A,'config'),before=(await call(db,A,'jugador')).jugador
 const migration=await readFile('supabase/suizamente_v26_emparejamiento_asincrono.sql','utf8');await db.exec(migration);await db.exec(migration)
 const current=await call(db,A,'config');assert.equal(current.apiVersion,26);assert.deepEqual({...current,apiVersion:0},{...original,apiVersion:0},'No rules, deadlines, prices or rewards changed')
 async function reset(){await db.exec("DELETE FROM suizamente_private.suizamente_partidas;DELETE FROM suizamente_private.suizamente_limites;UPDATE suizamente_private.suizamente_jugadores SET bloqueado=false,renombrar=false,xp=0,ultimo_visto_en=clock_timestamp()-interval '1 day';UPDATE public.profiles SET banned=false");await db.query('UPDATE suizamente_private.suizamente_jugadores SET bloqueado=true WHERE jugador_id=ANY($1)',[[D,E]])}
 async function active(a,b,state='jugando'){await db.query("INSERT INTO suizamente_private.suizamente_partidas(jugador_a,jugador_b,turno,estado,plazo,reglas) VALUES($1,$2,$1,$3,clock_timestamp()+interval '1 day',$4)",[a,b,state,JSON.stringify(current)])}
 await reset();let lobby=await call(db,A,'emparejamiento');assert.equal(lobby.disponible,true);assert.equal(lobby.asincrono,true);assert.deepEqual(lobby.jugadores,[],'No invented online opponents')
 await active(D,B);await active(B,null,'buscando');await db.query('UPDATE suizamente_private.suizamente_jugadores SET xp=100000 WHERE jugador_id=$1',[C])
 let match=await call(db,A,'crear_partida',{rival:'azar'});assert.equal(match.rival.id,C,'The offline account with fewer active games wins even at a different level');assert.equal(match.estado,'jugando');assert.equal(match.teToca,true)
 match=await call(db,A,'crear_partida',{rival:'azar'});assert.equal(match.rival.id,B,'Already paired C is excluded; queue games and both player positions count')
 let count=Number((await db.query('SELECT count(*) n FROM suizamente_private.suizamente_partidas')).rows[0].n)
 await assert.rejects(()=>call(db,A,'crear_partida',{rival:'azar'}),/SZV2:409/);assert.equal(Number((await db.query('SELECT count(*) n FROM suizamente_private.suizamente_partidas')).rows[0].n),count,'No empty or duplicate match is inserted')
 await reset();await active(B,A);match=await call(db,A,'crear_partida',{rival:'azar'});assert.equal(match.rival.id,C,'Existing pair is excluded in either direction')
 await reset();const secondLevel=current.niveles.a+current.niveles.b;await db.query('UPDATE suizamente_private.suizamente_jugadores SET ultimo_visto_en=clock_timestamp(),xp=CASE WHEN jugador_id=$1 THEN $2 ELSE xp END WHERE jugador_id=ANY($3)',[B,secondLevel,[B,C]])
 lobby=await call(db,A,'emparejamiento');assert.equal(lobby.jugadores.length,1);assert.equal(lobby.jugadores[0].id,C,'Online suggestion is the closest level');assert.equal(lobby.jugadores[0].online,true);assert.ok(Object.hasOwn(lobby.avatares,C),'Suggested avatar is retained')
 await db.query("UPDATE suizamente_private.suizamente_jugadores SET ultimo_visto_en=clock_timestamp()-interval '1 day' WHERE jugador_id=$1",[C]);match=await call(db,A,'crear_partida',{rival:C});assert.equal(match.estado,'jugando','An online suggestion can go offline before the click; turns remain asynchronous')
 await reset();await db.query('UPDATE suizamente_private.suizamente_jugadores SET renombrar=true WHERE jugador_id=$1',[B]);await db.query('UPDATE public.profiles SET banned=true WHERE id=$1',[C]);assert.equal((await call(db,A,'emparejamiento')).disponible,false)
 await assert.rejects(()=>call(db,A,'crear_partida',{rival:'azar'}),/SZV2:409/)
 await reset();await db.query('UPDATE suizamente_private.suizamente_jugadores SET usuario_id=NULL WHERE jugador_id=ANY($1)',[[B,C]]);assert.equal((await call(db,A,'emparejamiento')).disponible,false,'Legacy guests are never opponents');await db.query('UPDATE suizamente_private.suizamente_jugadores SET usuario_id=jugador_id::uuid WHERE jugador_id=ANY($1)',[[B,C]])
 await reset();for(let i=0;i<current.partida.partidasAbiertasMax;i++)await active(A,D);assert.equal((await call(db,A,'emparejamiento')).disponible,false);await assert.rejects(()=>call(db,A,'crear_partida',{rival:'azar'}),/demasiadas partidas/)
 await reset();for(const id of [B,C])for(let i=0;i<current.partida.partidasAbiertasMax;i++)await active(id,D);assert.equal((await call(db,A,'emparejamiento')).disponible,false,'Opponent capacity is still enforced')
 await assert.rejects(()=>call(db,null,'emparejamiento',{},G,TOKEN),/SZV2:401/)
 await assert.rejects(()=>db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE authenticated');await tx.query('SELECT * FROM suizamente_private.v26_rivales($1)',[A])}),/permission denied/)
 const after=(await call(db,A,'jugador')).jugador;assert.equal(after.monedas,before.monedas,'Matchmaking gives no reward');assert.equal(after.xp,before.xp)
 console.log('Matchmaking: offline least-busy accounts, both-direction duplicate exclusion, online nearest-level suggestion, avatars, limits, moderation, guest/privacy checks and idempotent migration passed.')
}finally{await db.close()}
