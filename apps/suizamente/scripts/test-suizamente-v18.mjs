import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {database,call,profile,A,B,C} from './lib/suizamente-v2-test-db.mjs'
const db=await database({avatares:true})
const own='https://photos.test/own.jpg',latido='https://photos.test/latido.jpg',provider='https://photos.test/provider.jpg'
try{
 for(const [id,name] of [[A,'Mismo apodo'],[B,'Mismo apodo'],[C,'Caro']]){await call(db,id,'guardar_jugador',profile(name));await call(db,id,'bienvenida')}
 await db.query('UPDATE public.profiles SET avatar_url=$1 WHERE id=$2',[latido,B])
 await db.query('UPDATE auth.users SET raw_user_meta_data=$1 WHERE id=$2',[{picture:provider,email:'private@hidden.test'},C])
 const saved=await call(db,A,'guardar_jugador',{...profile('Mismo apodo'),ajustes:{foto_url:own}});assert.equal(saved.avatares[A],own)
 const m=await call(db,A,'crear_partida',{rival:B})
 const a=await call(db,A,'partida',{id:m.id}),b=await call(db,B,'partida',{id:m.id})
 assert.equal(a.avatares[A],own);assert.equal(a.avatares[B],latido);assert.equal(b.avatares[A],own);assert.equal(b.avatares[B],latido)
 assert.notEqual(a.rival.id,a.tuId,'Equal nicknames never identify a player')
 const people=await call(db,A,'buscar',{q:'Mismo'});assert.equal(people.avatares[B],latido)
 const publicProfile=await call(db,A,'perfil_publico',{id:B});assert.equal(publicProfile.avatares[B],latido)
 const providerProfile=await call(db,A,'perfil_publico',{id:C});assert.equal(providerProfile.avatares[C],provider);assert.ok(!JSON.stringify(providerProfile).includes('private@hidden.test'))
 await call(db,B,'guardar_jugador',{...profile('Mismo apodo'),ajustes:{foto_url:'https://photos.test/new-own.jpg'}})
 assert.equal((await call(db,A,'partida',{id:m.id})).avatares[B],'https://photos.test/new-own.jpg')
 await call(db,B,'guardar_jugador',{...profile('Mismo apodo'),ajustes:{foto_url:'javascript:alert(1)'}})
 assert.equal((await call(db,A,'partida',{id:m.id})).avatares[B],latido,'Unsafe game URL falls back to saved Latido photo')
 await assert.rejects(call(db,null,'partida',{id:m.id}),e=>e.message.includes('SZV2:401:'))
 assert.equal((await db.query("SELECT has_function_privilege('authenticated','suizamente_private.v18_foto(text)','EXECUTE') allowed")).rows[0].allowed,false)
 const profilesBefore=JSON.stringify((await db.query('SELECT * FROM public.profiles ORDER BY id')).rows)
 await db.exec(await readFile('supabase/suizamente_v18_avatares.sql','utf8'));assert.equal((await call(db,A,'config')).apiVersion,18)
 assert.equal(JSON.stringify((await db.query('SELECT * FROM public.profiles ORDER BY id')).rows),profilesBefore,'Migration never modifies Latido profiles')
 console.log('v18: reciprocal match avatars, duplicate nicknames, search/public profile/provider fallback, immediate update, safe URLs, private helpers, account guard, no emails and repeat migration passed.')
}catch(e){console.error(e.message,e.where||'');process.exitCode=1}finally{await db.close()}
