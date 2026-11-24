import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createSuizamenteDb,szRpc,SZ_ALICE} from './lib/suizamente-test-db.mjs'
import {gameAnswer} from './test-suizamente-game.mjs'
const read=p=>readFile(p,'utf8')
const questions=JSON.parse(await read('supabase/seed-data/suizamente-language-exercises.json'))
const reviewed=JSON.parse(await read('supabase/seed-data/suizamente-reviewed.json'))
const sql=await read('supabase/suizamente_actualizacion_idiomas_16.sql')
assert.equal(questions.length,64)
for(const [task,count]of Object.entries({choose_word:16,meaning:16,complete_sentence:16,order_sentence:12,match_words:4}))assert.equal(questions.filter(q=>q.language_task===task).length,count)
assert.equal(new Set(questions.map(q=>q.id)).size,64)
assert.equal(new Set(questions.map(q=>q.prompt)).size,64)
for(const q of questions){
  assert.equal(q.learning_language,'de');assert.notEqual(q.game_type,'short')
  assert.equal(q.options.length,q.game_type==='order'?q.correct_order.length:4)
  assert.ok(q.sources.every(s=>s.checked_at==='2026-11-18'&&s.url.startsWith('https://')))
  assert.deepEqual(reviewed.find(r=>r.id===q.id),q,'Live bank includes every new exercise exactly')
}
let db
const countVersions=async()=> (await db.query('SELECT count(*)::int n FROM suizamente_private.versions')).rows[0].n
async function snapshot(){
  const s={}
  for(const t of ['players','sessions','answers','progress','rewards','trail_nodes','trail_days'])s[t]=(await db.query(`SELECT coalesce(jsonb_agg(x ORDER BY x::text),'[]') data FROM (SELECT to_jsonb(t) x FROM suizamente_private.${t} t) s`)).rows[0].data
  return s
}
try{
  db=await createSuizamenteDb({game:true})
  let old=await szRpc(db,SZ_ALICE,'game_start')
  old=await gameAnswer(db,SZ_ALICE,old)
  const before=await snapshot(),versions=await countVersions()
  await db.exec(sql)
  assert.equal(await countVersions(),versions+64)
  assert.deepEqual(await snapshot(),before)
  assert.deepEqual(await szRpc(db,SZ_ALICE,'session',{id:old.id}),old)
  await db.exec(sql);assert.equal(await countVersions(),versions+64)
  assert.deepEqual(await snapshot(),before)
  const actor='66666666-6666-4666-8666-666666666666'
  await db.query('INSERT INTO auth.users(id) VALUES($1)',[actor])
  for(const q of questions){
    await db.query("UPDATE suizamente_private.sessions SET created_at=now()-interval '2 hours' WHERE user_id=$1 AND created_at>now()-interval '1 hour'",[actor])
    let session=await szRpc(db,actor,'start',{mode:'practice',category:'idioma'})
    const v=(await db.query('SELECT v.id FROM suizamente_private.questions q JOIN suizamente_private.versions v ON v.question_id=q.id AND v.version=q.current_version WHERE q.id=$1',[q.id])).rows[0]
    const order=Array.from({length:q.options.length},(_,i)=>q.options.length-1-i)
    await db.query("UPDATE suizamente_private.sessions SET version_ids=ARRAY[$2::bigint],position=0,option_orders=jsonb_build_object($2::text,$3::jsonb) WHERE id=$1",[session.id,v.id,JSON.stringify(order)])
    session=await szRpc(db,actor,'session',{id:session.id})
    assert.equal(session.question.correct_order,undefined);assert.equal(session.question.correct_index,undefined)
    session=await gameAnswer(db,actor,session)
    assert.equal(session.answer.correct,true,q.id);assert.equal(session.answer.xp,0,q.id)
    if(session.status==='active')session=await szRpc(db,actor,'session',{id:session.id,advance:true})
    assert.equal(session.status,'completed',q.id)
  }
  const custom={...questions[0],prompt:'Ejercicio adaptado por el administrador: conservar esta edición.'}
  await db.query('SELECT suizamente_private.write_question($1::jsonb)',[JSON.stringify(custom)])
  const n=await countVersions()
  const result=(await db.exec(sql)).flatMap(r=>r.rows||[]).find(r=>r.result==='skipped_custom_edit')
  assert.deepEqual(result.omitted_ids,[custom.id]);assert.equal(await countVersions(),n)
  for(const role of ['anon','authenticated']){
    await assert.rejects(db.exec(`SET ROLE ${role}; SELECT * FROM suizamente_private.versions`),/permission denied/);await db.exec('RESET ROLE')
    assert.equal((await db.query("SELECT has_function_privilege($1,'suizamente_private.is_language_exercise(jsonb)','EXECUTE') allowed",[role])).rows[0].allowed,false)
  }
  console.log('64 language exercises: exact live-bank integration, every answer graded after shuffling, zero typing, no XP farming, safe repeats, custom edits, RLS and frozen progress passed.')
}finally{await db?.close()}
