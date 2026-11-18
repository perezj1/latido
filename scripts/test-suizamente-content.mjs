import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {loadContentPack,validateContentPack,publicationSql,solution} from './lib/suizamente-content-pack.mjs'
import {createSuizamenteDb,szRpc,SZ_ALICE,SZ_BOB} from './lib/suizamente-test-db.mjs'

const pack=await loadContentPack(),report=validateContentPack(pack)
assert.deepEqual(report.errors,[])
assert.equal(pack.questions.length,1350)
assert.equal(report.complete,true)
assert.equal(Object.keys(report.counts).length,27)
for(const territory of pack.manifest.territories){
  assert.equal(report.counts[territory].total,50)
  assert.deepEqual(report.counts[territory].formats,pack.manifest.formats_per_territory)
}
assert.equal(report.counts.CH.total,50)
assert.deepEqual(report.counts.CH.formats,pack.manifest.formats_per_territory)
assert.equal(report.counts.CH.formats.short/report.counts.CH.total*100,4)
assert.ok(report.keyboard_percentage<=4)
assert.equal(report.remaining,Math.max(0,pack.manifest.target_total-pack.questions.length))
const future=validateContentPack(pack,{today:'2030-01-01'})
assert.equal(future.review_due.length,pack.questions.length)
assert.equal(future.complete,false,'expired sources cannot yield a complete publishable collection')
assert.deepEqual(new Set(pack.questions.filter(q=>q.game_type==='multi').map(q=>q.correct_indices.length)),new Set([1,2,3]))
assert.ok(pack.questions.filter(q=>q.game_type==='image').every(q=>q.options.length===4))
// Previous releases have already been applied remotely by the user. Their
// exact published payloads must stay reproducible to avoid version conflicts.
const byId=new Map(pack.questions.map(q=>[q.id,{...q,status:'published'}]))
for(const [file,count] of [['suizamente_expansion_CH.sql',50],['suizamente_expansion_cantones_20261117.sql',300],['suizamente_expansion_bs_bl_20261117.sql',100],['suizamente_expansion_fr_vs_20261117.sql',100],['suizamente_expansion_sg_gr_20261117.sql',100],['suizamente_expansion_ar_ai_20261117.sql',100],['suizamente_expansion_04_05_20261117.sql',200],['suizamente_expansion_ur_sz_20261117.sql',100],['suizamente_expansion_ow_nw_20261117.sql',100],['suizamente_expansion_gl_zg_20261117.sql',100],['suizamente_expansion_so_sh_20261117.sql',100],['suizamente_expansion_ag_tg_20261117.sql',100],['suizamente_expansion_ne_ju_20261117.sql',100]]){
  const released=await readFile(`supabase/${file}`,'utf8')
  const targets=[...released.matchAll(/\$sz_target\$(.*?)\$sz_target\$::jsonb/g)].map(m=>JSON.parse(m[1]))
  assert.equal(targets.length,count)
  for(const target of targets)assert.deepEqual(byId.get(target.id),target,`Already released payload changed: ${target.id}`)
}
for(const q of pack.questions.filter(q=>q.reuses_question_id))assert.equal(q.category,pack.legacy.find(old=>old.id===q.id).category,'reuse preserves the statistical category')
const forged=structuredClone(pack);forged.questions[0].sources[0].url='https://example.com/invented'
assert.ok(validateContentPack(forged).errors.some(e=>e.includes('substantively reviewed')))
const badOrder=structuredClone(pack),ordered=badOrder.questions.find(q=>q.game_type==='order');ordered.correct_order.fill(0)
assert.ok(validateContentPack(badOrder).errors.some(e=>e.includes('full permutation')))
console.log(`Content: ${pack.questions.length} entries checked, exact CH format quotas, multi with 1/2/3 truths, real artwork and source registry guards.`)

let db
try{
  db=await createSuizamenteDb({game:true})
  // Existing installations need only the incremental update, repeatable without
  // rerunning seeds. Check that it recreates exactly the canonical definitions.
  const functions=['write_question','admin_action','game_start']
  const defs=async()=> (await db.query("SELECT proname,pg_get_functiondef(p.oid) definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='suizamente_private' AND proname=ANY($1::text[]) ORDER BY proname",[functions])).rows
  const before=await defs(),delta=await readFile('supabase/suizamente_actualizacion_jugabilidad.sql','utf8')
  await db.exec(delta);await db.exec(delta)
  // Simulate an installation that already applied the first 350 questions,
  // whose illustration allowlist must be upgraded before importing BS/BL.
  const previous=pack.questions.filter(q=>['CH','ZH','GE','LU','BE','TI','VD'].includes(q.territory))
  await db.exec(publicationSql(previous,pack.legacy))
  const thirdUpgrade=await readFile('supabase/suizamente_actualizacion_ilustraciones_03.sql','utf8')
  const fourthUpgrade=await readFile('supabase/suizamente_actualizacion_ilustraciones_04.sql','utf8')
  const fifthUpgrade=await readFile('supabase/suizamente_actualizacion_ilustraciones_05.sql','utf8')
  const sixthUpgrade=await readFile('supabase/suizamente_actualizacion_ilustraciones_06.sql','utf8')
  const seventhUpgrade=await readFile('supabase/suizamente_actualizacion_ilustraciones_07.sql','utf8')
  const eighthUpgrade=await readFile('supabase/suizamente_actualizacion_ilustraciones_08.sql','utf8')
  const ninthUpgrade=await readFile('supabase/suizamente_actualizacion_ilustraciones_09.sql','utf8')
  const tenthUpgrade=await readFile('supabase/suizamente_actualizacion_ilustraciones_10.sql','utf8')
  const eleventhUpgrade=await readFile('supabase/suizamente_actualizacion_ilustraciones_11.sql','utf8')
  // The latest update also supports installations that skipped intermediate updates.
  await db.exec(eleventhUpgrade)
  assert.deepEqual(await defs(),before,'Latest illustration upgrade also applies directly after the first release')
  await db.exec(delta)
  const upgrade=await readFile('supabase/suizamente_actualizacion_ilustraciones_02.sql','utf8')
  await db.exec(upgrade);await db.exec(upgrade)
  const secondBatch=await readFile('supabase/suizamente_expansion_bs_bl_20261117.sql','utf8')
  await db.exec(secondBatch);await db.exec(secondBatch)
  await db.exec(thirdUpgrade);await db.exec(thirdUpgrade)
  const thirdBatch=await readFile('supabase/suizamente_expansion_fr_vs_20261117.sql','utf8')
  await db.exec(thirdBatch);await db.exec(thirdBatch)
  const fourthBatch=await readFile('supabase/suizamente_expansion_sg_gr_20261117.sql','utf8')
  const cumulative=await readFile('supabase/suizamente_expansion_04_05_20261117.sql','utf8')
  // Historical 04+05 compatibility: the cumulative installer supports both
  // paths from release 03, with the same published payloads.
  await db.exec(fifthUpgrade)
  await db.exec('BEGIN')
  // Publication SQL owns its transaction: strip only its outer transaction so
  // this first branch can be rolled back to simulate the other installation.
  const body=cumulative.replace(/^BEGIN;\s*/m,'').replace(/COMMIT;\s*$/,'')
  await db.exec(body)
  assert.equal((await db.query('SELECT count(*)::integer n FROM suizamente_private.questions')).rows[0].n,pack.legacy.length+pack.questions.filter(q=>!q.reuses_question_id&&!['UR','SZ','OW','NW','GL','ZG','SO','SH','AG','TG','NE','JU'].includes(q.territory)).length)
  await db.exec('ROLLBACK')
  assert.equal((await db.query('SELECT count(*)::integer n FROM suizamente_private.questions')).rows[0].n,pack.legacy.length+pack.questions.filter(q=>!q.reuses_question_id&&!['SG','GR','AR','AI','UR','SZ','OW','NW','GL','ZG','SO','SH','AG','TG','NE','JU'].includes(q.territory)).length,'Rollback restores the installation through 03 before testing the 04 branch')
  await db.exec(fourthUpgrade);await db.exec(fourthUpgrade)
  await db.exec(fourthBatch);await db.exec(fourthBatch)
  async function single(qid){
    // The editorial sweep spans more sessions than one real hour permits.
    // Age only local fixture sessions; retain the production abuse limit.
    await db.query("UPDATE suizamente_private.sessions SET created_at=now()-interval '2 hours' WHERE user_id=$1",[SZ_ALICE])
    const s=await szRpc(db,SZ_ALICE,'start',{mode:'practice'}),v=(await db.query('SELECT v.id,v.payload FROM suizamente_private.questions q JOIN suizamente_private.versions v ON v.question_id=q.id AND v.version=q.current_version WHERE q.id=$1',[qid])).rows[0]
    const order=Array.from({length:v.payload.options.length},(_,i)=>v.payload.options.length-1-i)
    await db.query("UPDATE suizamente_private.sessions SET version_ids=ARRAY[$2::bigint],position=0,option_orders=jsonb_build_object($2::text,$3::jsonb),rules=rules||'{\"node\":-2,\"practice\":true,\"gift\":null,\"gift_at\":-1}'::jsonb WHERE id=$1",[s.id,v.id,JSON.stringify(order)])
    return {s:await szRpc(db,SZ_ALICE,'session',{id:s.id}),v,order}
  }
  // Freeze an assigned old version and progress before applying the new pack.
  const old=await single('ch-home-conciliacion')
  await szRpc(db,SZ_ALICE,'answer',{session_id:old.s.id,position:0,choice:old.order.indexOf(old.v.payload.correct_index)})
  const xp=(await szRpc(db,SZ_ALICE,'summary')).player.xp,progress=(await db.query('SELECT * FROM suizamente_private.progress WHERE user_id=$1',[SZ_ALICE])).rows
  await db.exec(fifthUpgrade);await db.exec(fifthUpgrade)
  // Release 05 retains its published 75-image catalogue; release 06 extends it.
  const batch=await readFile('supabase/suizamente_expansion_ar_ai_20261117.sql','utf8')
  await db.exec(batch);await db.exec(batch)
  const cumulativeVersions=(await db.query('SELECT count(*)::integer n FROM suizamente_private.versions')).rows[0].n
  await db.exec(cumulative);await db.exec(cumulative)
  assert.equal((await db.query('SELECT count(*)::integer n FROM suizamente_private.versions')).rows[0].n,cumulativeVersions,'Cumulative installer does not duplicate 04 or 05 versions')
  await db.exec(sixthUpgrade);await db.exec(sixthUpgrade)
  const sixthBatch=await readFile('supabase/suizamente_expansion_ur_sz_20261117.sql','utf8')
  await db.exec(sixthBatch)
  const sixthVersions=(await db.query('SELECT count(*)::integer n FROM suizamente_private.versions')).rows[0].n
  await db.exec(sixthBatch)
  assert.equal((await db.query('SELECT count(*)::integer n FROM suizamente_private.versions')).rows[0].n,sixthVersions,'Release 06 never duplicates versions')
  await db.exec(seventhUpgrade);await db.exec(seventhUpgrade)
  const seventhBatch=await readFile('supabase/suizamente_expansion_ow_nw_20261117.sql','utf8')
  await db.exec(seventhBatch)
  const seventhVersions=(await db.query('SELECT count(*)::integer n FROM suizamente_private.versions')).rows[0].n
  await db.exec(seventhBatch)
  assert.equal((await db.query('SELECT count(*)::integer n FROM suizamente_private.versions')).rows[0].n,seventhVersions,'Release 07 never duplicates versions')
  await db.exec(eighthUpgrade);await db.exec(eighthUpgrade)
  const eighthBatch=await readFile('supabase/suizamente_expansion_gl_zg_20261117.sql','utf8')
  await db.exec(eighthBatch)
  const eighthVersions=(await db.query('SELECT count(*)::integer n FROM suizamente_private.versions')).rows[0].n
  await db.exec(eighthBatch)
  assert.equal((await db.query('SELECT count(*)::integer n FROM suizamente_private.versions')).rows[0].n,eighthVersions,'Release 08 never duplicates versions')
  await db.exec(ninthUpgrade);await db.exec(ninthUpgrade)
  const ninthBatch=await readFile('supabase/suizamente_expansion_so_sh_20261117.sql','utf8')
  await db.exec(ninthBatch)
  const ninthVersions=(await db.query('SELECT count(*)::integer n FROM suizamente_private.versions')).rows[0].n
  await db.exec(ninthBatch)
  assert.equal((await db.query('SELECT count(*)::integer n FROM suizamente_private.versions')).rows[0].n,ninthVersions,'Release 09 never duplicates versions')
  await db.exec(tenthUpgrade);await db.exec(tenthUpgrade)
  const tenthBatch=await readFile('supabase/suizamente_expansion_ag_tg_20261117.sql','utf8')
  await db.exec(tenthBatch)
  const tenthVersions=(await db.query('SELECT count(*)::integer n FROM suizamente_private.versions')).rows[0].n
  await db.exec(tenthBatch)
  assert.equal((await db.query('SELECT count(*)::integer n FROM suizamente_private.versions')).rows[0].n,tenthVersions,'Release 10 never duplicates versions')
  await db.exec(eleventhUpgrade);await db.exec(eleventhUpgrade)
  assert.deepEqual(await defs(),before,'Release 11 matches the canonical schema and is repeatable')
  const eleventhBatch=await readFile('supabase/suizamente_expansion_ne_ju_20261117.sql','utf8')
  await db.exec(eleventhBatch)
  const eleventhVersions=(await db.query('SELECT count(*)::integer n FROM suizamente_private.versions')).rows[0].n
  await db.exec(eleventhBatch)
  assert.equal((await db.query('SELECT count(*)::integer n FROM suizamente_private.versions')).rows[0].n,eleventhVersions,'Release 11 never duplicates versions')
  const sql=publicationSql(pack.questions,pack.legacy)
  await db.exec(sql)
  const versions=(await db.query('SELECT count(*)::integer n FROM suizamente_private.versions')).rows[0].n
  await db.exec(sql)
  assert.equal((await db.query('SELECT count(*)::integer n FROM suizamente_private.versions')).rows[0].n,versions,'re-import creates no versions')
  assert.equal((await szRpc(db,SZ_ALICE,'summary')).player.xp,xp)
  assert.deepEqual((await db.query('SELECT * FROM suizamente_private.progress WHERE user_id=$1',[SZ_ALICE])).rows,progress)
  assert.equal((await szRpc(db,SZ_ALICE,'session',{id:old.s.id})).question.prompt,old.v.payload.prompt,'assigned versions remain frozen')
  assert.equal((await db.query('SELECT count(*)::integer n FROM suizamente_private.questions')).rows[0].n,pack.legacy.length+pack.questions.filter(q=>!q.reuses_question_id).length)
  for(const q of pack.questions.filter(q=>['order','short'].includes(q.game_type))){
    const {s,v,order}=await single(q.id),args={session_id:s.id,position:0}
    assert.equal(s.question.correct_order,undefined);assert.equal(s.question.accepted_answers,undefined);assert.equal(s.answer,null)
    await assert.rejects(szRpc(db,SZ_BOB,'answer',{...args,choices:[]}),/SZ_SESSION_NOT_FOUND/)
    if(q.game_type==='order'){
      await assert.rejects(szRpc(db,SZ_ALICE,'answer',{...args,choices:order.map(()=>0)}),/SZ_INVALID_ANSWER/)
      await assert.rejects(szRpc(db,SZ_ALICE,'answer',{...args,choices:order.slice(1)}),/SZ_INVALID_ANSWER/)
    }else{
      await assert.rejects(szRpc(db,SZ_ALICE,'answer',{...args,text:{correct:true}}),/SZ_INVALID_ANSWER/)
      await assert.rejects(szRpc(db,SZ_ALICE,'answer',{...args,text:'x'.repeat(81)}),/SZ_INVALID_ANSWER/)
    }
    const payload=q.game_type==='order'?{choices:q.correct_order.map(i=>order.indexOf(i))}:{text:q.accepted_answers[0].toLowerCase()}
    const answer=await szRpc(db,SZ_ALICE,'answer',{...args,...payload,correct:true,xp:99999})
    assert.equal(answer.answer.correct,true,q.id)
    assert.equal(answer.answer.correct_answer,q.game_type==='order'?q.correct_order.map(i=>q.options[i]).join(' '):q.accepted_answers[0])
    assert.ok(answer.review_answers[0].chosen_answer)
    assert.equal(answer.answer.xp,q.category==='idioma'?0:10)
    assert.deepEqual(await szRpc(db,SZ_ALICE,'answer',{...args,...payload}),answer,'answer retries are immutable')
    const replay=await single(v.payload.id),bad=q.game_type==='short'?{text:'x'.repeat(Math.min(3,q.max_length||80))}:{choices:q.correct_order.toReversed().map(i=>replay.order.indexOf(i))}
    const wrong=await szRpc(db,SZ_ALICE,'answer',{session_id:replay.s.id,position:0,...bad,correct:true,xp:9999})
    assert.equal(wrong.answer.correct,false);assert.equal(wrong.answer.xp,0,'client flags cannot override grading')
  }
  const q=pack.questions.find(q=>!q.reuses_question_id)
  await assert.rejects(db.exec(publicationSql([{...q,next_review_at:'2000-01-01'}],pack.legacy)),/SZ_CONTENT_REVIEW_DUE/)
  await db.exec('ROLLBACK')
  await db.query("UPDATE suizamente_private.versions SET payload=jsonb_set(payload,'{prompt}','\"An independent editorial change\"') WHERE question_id=$1",[q.id])
  await assert.rejects(db.exec(sql),/SZ_CONTENT_CONFLICT/)
  await db.exec('ROLLBACK')
  console.log('Import: safe repeat, editor conflict detection, old sessions/progress/XP retained. Order/short: server grading, bounds, ownership, immutable answers, no solution leaks, replay and language XP verified.')
  assert.ok(solution(pack.questions[0]))
  // Re-running the upgraded schema is also safe with existing answers.
  await db.exec(await readFile('supabase/suizamente.sql','utf8'))
  await db.exec(await readFile('supabase/suizamente_game.sql','utf8'))
}finally{await db?.close()}
