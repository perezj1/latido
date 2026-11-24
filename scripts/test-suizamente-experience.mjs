import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createSuizamenteDb,szRpc,SZ_ALICE,SZ_BOB} from './lib/suizamente-test-db.mjs'

const bank=JSON.parse(await readFile('supabase/seed-data/suizamente-questions.json','utf8'))
const editorial=JSON.parse(await readFile('supabase/seed-data/suizamente-presentation.json','utf8'))
const upgrade=await readFile('supabase/suizamente_actualizacion_experiencia_12.sql','utf8')
const db=await createSuizamenteDb({game:true})
try{
  // Simulate the exact payloads still served by installations without SQL 12.
  for(const entry of editorial.entries)await db.query("UPDATE suizamente_private.versions SET payload=jsonb_set(payload,'{prompt}',to_jsonb($2::text)) WHERE question_id=$1",[entry.id,entry.original_prompt])
  await db.exec(await readFile('scripts/fixtures/suizamente-game-view-v11.sql','utf8'))
  await db.exec('DROP FUNCTION suizamente_private.game_prompt(jsonb)')
  async function pin(session,qid){
    const row=(await db.query('SELECT id,payload FROM suizamente_private.versions WHERE question_id=$1 ORDER BY version DESC LIMIT 1',[qid])).rows[0]
    const order=Array.from({length:row.payload.options.length},(_,i)=>row.payload.options.length-1-i)
    await db.query(`UPDATE suizamente_private.sessions SET version_ids=ARRAY[$2::bigint],option_orders=jsonb_build_object($2::text,$3::jsonb),rules=rules||'{"node":-2,"practice":true,"gift":null,"gift_at":-1}'::jsonb WHERE id=$1`,[session.id,row.id,JSON.stringify(order)])
    return {row,order}
  }
  const s=await szRpc(db,SZ_ALICE,'game_start'),{row,order}=await pin(s,'game-tf-2-4')
  assert.match((await szRpc(db,SZ_ALICE,'session',{id:s.id})).question.prompt,/Respuesta propuesta/)
  const snapshots=(await db.query('SELECT id,payload FROM suizamente_private.versions ORDER BY id')).rows
  const players=(await db.query('SELECT * FROM suizamente_private.players ORDER BY user_id')).rows
  const sessions=(await db.query('SELECT * FROM suizamente_private.sessions ORDER BY id')).rows
  await db.exec(upgrade);await db.exec(upgrade)
  assert.deepEqual((await db.query('SELECT id,payload FROM suizamente_private.versions ORDER BY id')).rows,snapshots)
  assert.deepEqual((await db.query('SELECT * FROM suizamente_private.players ORDER BY user_id')).rows,players)
  assert.deepEqual((await db.query('SELECT * FROM suizamente_private.sessions ORDER BY id')).rows,sessions)
  const live=await szRpc(db,SZ_ALICE,'session',{id:s.id})
  assert.equal(live.question.prompt,'Liechtenstein comparte frontera con Suiza.')
  assert.equal(live.question.version_id,row.id)
  assert.equal(live.answer,null)
  for(const entry of editorial.entries){
    const q={...bank.find(q=>q.id===entry.id),prompt:entry.original_prompt}
    assert.equal((await db.query('SELECT suizamente_private.game_prompt($1::jsonb) text',[JSON.stringify(q)])).rows[0].text,entry.prompt)
    assert.equal((await db.query('SELECT suizamente_private.game_prompt($1::jsonb) text',[JSON.stringify({...q,id:'legacy-renamed',prompt:q.prompt.replaceAll('\n','\r\n')})])).rows[0].text,entry.prompt)
    assert.equal((await db.query('SELECT suizamente_private.game_prompt($1::jsonb) text',[JSON.stringify({...q,prompt:'Enunciado editado por la persona administradora.'})])).rows[0].text,'Enunciado editado por la persona administradora.')
  }
  const answered=await szRpc(db,SZ_ALICE,'answer',{session_id:s.id,position:0,choice:order.indexOf(row.payload.correct_index)})
  assert.equal(answered.answer.correct,true)
  assert.equal(answered.review_answers[0].prompt,live.question.prompt)
  const match=bank.find(q=>q.game_type==='match')
  const m=await szRpc(db,SZ_BOB,'game_start'),fixture=await pin(m,match.id)
  let view=await szRpc(db,SZ_BOB,'session',{id:m.id})
  assert.equal(view.answer,null);assert.equal(view.question.correct_pairs,undefined)
  await assert.rejects(szRpc(db,SZ_ALICE,'session',{id:m.id}),/SZ_SESSION_NOT_FOUND/)
  view=await szRpc(db,SZ_BOB,'answer',{session_id:m.id,position:0,left:0,right:0,correct_pairs:[{left:'Forged',right:'Forged'}]})
  assert.equal(view.answer,null,'A pairing attempt must not reveal the remaining solutions')
  view=await szRpc(db,SZ_BOB,'answer',{session_id:m.id,position:0,skip:true})
  const expected=match.options.map((left,i)=>({left,right:match.pairs[i]}))
  assert.deepEqual(view.answer.correct_pairs,expected)
  assert.deepEqual(view.review_answers[0].correct_pairs,expected)
  assert.notDeepEqual(view.question.pairs,match.pairs,'Right column remains independently shuffled')
  const confirmed=await szRpc(db,SZ_BOB,'answer',{session_id:m.id,position:0,left:0,right:fixture.order.indexOf(0)})
  assert.deepEqual(confirmed.answer,view.answer,'The correction cannot overwrite a confirmed answer')
  const auth=await db.query("SELECT has_function_privilege('authenticated','suizamente_private.game_prompt(jsonb)','EXECUTE') allowed")
  assert.equal(auth.rows[0].allowed,false)
  console.log('Experience: repeatable upgrade, 20 direct statements, live sessions and version snapshots retained, grading unchanged, private pair solutions disclosed only after answering.')
}finally{await db.close()}
