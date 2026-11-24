import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {database,call,profile,A,B} from './lib/suizamente-v2-test-db.mjs'
const db=await database({cuentas:true})
try{
 await db.exec('CREATE ROLE service_role BYPASSRLS')
 for(const [actor,name] of [[A,'Alex'],[B,'Lu']])await call(db,actor,'guardar_jugador',profile(name))
 await db.query("INSERT INTO public.app_notifications(recipient_id,kind,source_id,data) VALUES($1,'message','latido','{}')",[A])
 await db.query("SELECT suizamente_private.v7_notificar($1,'logro','anterior','Aviso del juego','/suizamente')",[A])
 const migration=await readFile('supabase/suizamente_v15_independiente.sql','utf8');await db.exec(migration)
 assert.equal((await db.query("SELECT count(*) n FROM public.app_notifications WHERE kind LIKE 'suizamente_%'")).rows[0].n,0)
 assert.equal((await db.query("SELECT count(*) n FROM public.app_notifications WHERE kind='message'")).rows[0].n,1,'Latido messages are preserved')
 await db.query("SELECT suizamente_private.v7_notificar($1,'logro','nuevo','Otro aviso del juego','/suizamente')",[A])
 assert.equal((await db.query('SELECT count(*) n FROM public.suizamente_notificaciones')).rows[0].n,2)
 assert.equal((await db.query('SELECT count(*) n FROM public.app_notifications')).rows[0].n,1,'New game activity never enters Latido')
 const id=(await db.query('SELECT id FROM public.suizamente_notificaciones LIMIT 1')).rows[0].id
 await assert.rejects(db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE anon');await tx.query('SELECT public.suizamente_push_reclamar($1)',[id])}),e=>e.code==='42501')
 const claim=()=>db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE service_role');return (await tx.query('SELECT public.suizamente_push_reclamar($1) data',[id])).rows[0].data})
 assert.ok(await claim());assert.equal(await claim(),null,'A repeated webhook cannot send the same notification twice')
 await db.transaction(async tx=>{await tx.query("SELECT set_config('test.uid',$1,true)",[A]);await tx.exec('SET LOCAL ROLE authenticated');await tx.query("INSERT INTO public.suizamente_push_subscriptions(endpoint,user_id,p256dh,auth,origin) VALUES('https://web.push.apple.com/test',$1,'p','a','https://suizamente.latido.ch')",[A])})
 await db.transaction(async tx=>{await tx.query("SELECT set_config('test.uid',$1,true)",[B]);await tx.exec('SET LOCAL ROLE authenticated');assert.equal((await tx.query('SELECT count(*) n FROM public.suizamente_push_subscriptions')).rows[0].n,0)})
 await db.exec(migration);assert.equal((await db.query('SELECT count(*) n FROM public.suizamente_notificaciones')).rows[0].n,2)
 assert.equal((await call(db,A,'config')).apiVersion,14)
 console.log('Independence: preserved Latido inbox, moved only game notifications, isolated new activity/subscriptions, owner-only RLS, one push claim and repeat migration passed.')
}finally{await db.close()}
