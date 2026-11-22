import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {fixture,alice,bob,token} from '../apps/suizamente/test/social-db.mjs'
const f=await fixture(),{db}=f,actor=id=>'user:'+id
const call=(action,data={},user=alice)=>db.query('SELECT public.suizamente_social_api($1,$2,$3::jsonb,$4) r',[action,actor(user),JSON.stringify(data),'management-fixture']).then(r=>r.rows[0].r)
try{
 const sql=await readFile('supabase/suizamente_gestion_retos.sql','utf8')
 await db.exec(sql);await db.exec(sql)
 const third='44444444-4444-4444-8444-444444444444'
 await db.query('INSERT INTO auth.users(id) VALUES($1)',[third])
 await db.query("INSERT INTO public.profiles(id,name,canton) VALUES($1,'Third','ZH')",[third])
 const open=await call('duelo_crear',{modo:'mix'})
 await assert.rejects(call('duelo_eliminar',{codigo:open.codigo},third),e=>e.code==='PT403')
 await call('duelo_unirse',{codigo:open.codigo},bob)
 await assert.rejects(call('duelo_unirse',{codigo:open.codigo},third),e=>e.code==='PT409')
 const joined=await call('duelo',{codigo:open.codigo})
 assert.equal(joined.rival.id,actor(bob))
 assert.equal(joined.respondidasCreador,0);assert.equal(joined.respondidasRival,0)
 const outsider=await call('duelo',{codigo:open.codigo},third)
 assert.equal(outsider.respondidasCreador,null);assert.equal(outsider.respondidasRival,null)
 await call('duelo_eliminar',{codigo:open.codigo},bob)
 assert(!(await call('duelos',{},bob)).duelos.some(d=>d.codigo===open.codigo))
 assert((await call('duelos')).duelos.some(d=>d.codigo===open.codigo))
 assert.equal((await call('duelo',{codigo:open.codigo})).estado,'esperando','Hiding for the rival does not cancel the creator’s challenge')
 const pending=await call('duelo_crear',{modo:'preguntas'})
 const response=await f.social({method:'DELETE',url:'https://latido.ch/functions/v1/suizamente-social/duels/'+pending.codigo,headers:{authorization:'Bearer '+token(alice)},body:{},address:'delete-fixture'})
 assert.equal(response.status,200)
 assert.equal((await call('duelo',{codigo:pending.codigo})).estado,'caducado')
 assert(!(await call('duelos')).duelos.some(d=>d.codigo===pending.codigo))
 await assert.rejects(call('duelo_unirse',{codigo:pending.codigo},bob),e=>e.code==='PT409')
 const q=f.questions.find(q=>q.tipo==='real')
 await assert.rejects(call('respuesta',{preguntaId:pending.preguntas[0],opcion:0,contexto:{tipo:'duelo',codigo:pending.codigo}}),e=>e.code==='PT409')
 const countBefore=(await db.query('SELECT count(*) n FROM public.suizamente_votos')).rows[0].n
 assert.equal(countBefore,0)
 await db.exec('SET ROLE authenticated')
 await assert.rejects(db.query('SELECT * FROM suizamente_social.duelos_ocultos'),e=>e.code==='42501')
 await db.exec('RESET ROLE')
 assert(q)
 console.log('PASS: one rival per challenge, creator cancellation, per-player hiding, ownership, HTTP DELETE, replay rejection and private tables.')
}finally{await db.close()}
