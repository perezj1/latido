import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createSuizamenteDb,szRpc,SZ_ALICE,SZ_BOB,SZ_ADMIN} from './lib/suizamente-test-db.mjs'
import {loadContentPack,publicationSql} from './lib/suizamente-content-pack.mjs'
import {gameAnswer,finishGame} from './test-suizamente-game.mjs'
import {isStatement} from '../src/lib/suizamenteQuestionText.js'
import {IMG} from '../src/components/suizamente/questionArt.js'
const read=p=>readFile(p,'utf8'),json=async p=>JSON.parse(await read(p))
const bank=await json('supabase/seed-data/suizamente-reviewed.json'),audit=await json('supabase/seed-data/suizamente-review-audit.json')
const sql=await read('supabase/suizamente_revision_completa.sql'),pack=await loadContentPack()
const baseline=await json('supabase/seed-data/suizamente-questions.json'),trivia=await json('supabase/seed-data/suizamente-trivia.json')
const original=new Map([...baseline,...pack.questions,...trivia.questions,...trivia.refinements].map(q=>[q.id,q]))
assert.equal(original.size,1619);assert.equal(bank.filter(q=>q.status==='published').length,1619)
assert.equal(new Set(audit.decisions.map(d=>d.id)).size,bank.length)
for(const id of original.keys())assert.ok(audit.decisions.some(d=>d.id===id),`Review decision: ${id}`)
for(const q of bank){
  if(original.has(q.id)){
    assert.equal(q.source_url,original.get(q.id).source_url,q.id)
    assert.equal(q.reviewed_at,original.get(q.id).reviewed_at,'Editorial changes never pretend to be new fact checks')
  }
  if(q.game_type==='tf')assert.ok(isStatement(q.prompt),q.id)
  if(q.game_type==='image'){
    assert.equal(q.options.length,4,q.id);assert.ok(IMG[q.image_key],q.id)
    if(/qué cantón/i.test(q.prompt))assert.equal(q.scope,'CH',`${q.id}: the canton chip must not reveal the answer`)
  }
}
assert.equal(bank.filter(q=>q.game_type==='short').length,20)
assert.ok(bank.some(q=>q.game_type==='multi'&&q.correct_indices.length===1))
assert.ok(bank.some(q=>q.game_type==='multi'&&q.correct_indices.length===2))
assert.ok(bank.some(q=>q.game_type==='multi'&&q.correct_indices.length===3))
assert.ok(!bank.some(q=>/Respuesta propuesta:/i.test(q.prompt)))
const queryCurrent='SELECT q.id,v.id version_id,v.payload FROM suizamente_private.questions q JOIN suizamente_private.versions v ON v.question_id=q.id AND v.version=q.current_version'
const versions=async db=>(await db.query('SELECT count(*)::integer n FROM suizamente_private.versions')).rows[0].n
async function snapshot(db){
  const state={}
  for(const t of ['sessions','answers','players','progress','rewards','trail_nodes','trail_days'])state[t]=(await db.query(`SELECT coalesce(jsonb_agg(x ORDER BY x::text),'[]') data FROM (SELECT to_jsonb(t) x FROM suizamente_private.${t} t) s`)).rows[0].data
  return state
}
async function fullRoutes(db){
  const mt=await json('src/data/suizamenteMountains.json')
  for(const [actor,general,local]of [[SZ_ALICE,true,true],[SZ_BOB,true,false],[SZ_ADMIN,false,true]]){
    await szRpc(db,actor,'preferences',{canton:'ZH',alias:`Review-${actor.slice(0,2)}`,include_general:general,include_canton:local,leaderboard_opt_in:false})
    const formats=new Set();let count=0,fun=0
    for(let level=1;level<=5;level++){
      await finishGame(db,actor,await szRpc(db,actor,'game_start'))
      for(let node=0;node<mt[level].st.length;node++){
        let session=await szRpc(db,actor,'game_start',{node})
        while(session.status==='active'){
          const q=session.question
          assert.equal(q.correct_index,undefined);assert.equal(q.explanation,undefined)
          assert.equal(q.correct_indices,undefined);assert.equal(q.accepted_answers,undefined)
          assert.equal(session.trail.general_versions,undefined)
          assert.ok(!q.id.endsWith('-canton-portal'),'Retired portals are never selected')
          if(!local)assert.equal(q.scope,'CH')
          if(!general)assert.ok(q.scope==='CH'||q.canton==='ZH')
          formats.add(q.type);count++;if(q.trivia_topic)fun++
          session=await gameAnswer(db,actor,session)
          if(session.status==='active')session=await szRpc(db,actor,'session',{id:session.id,advance:true})
        }
        await db.query("UPDATE suizamente_private.sessions SET created_at=now()-interval '2 hours' WHERE user_id=$1",[actor])
      }
      assert.ok((await szRpc(db,actor,'summary')).player.xp>=mt[level].xp,`XP threshold ${level}, ${general}/${local}`)
      assert.equal((await finishGame(db,actor,await szRpc(db,actor,'game_start',{node:mt[level].st.length}))).ascent_passed,true)
      await db.query("UPDATE suizamente_private.sessions SET day_key=day_key-($2::integer*10) WHERE user_id=$1 AND mode='summit' AND level=$2::integer",[actor,level])
      await db.query("UPDATE suizamente_private.sessions SET created_at=now()-interval '2 hours' WHERE user_id=$1",[actor])
    }
    assert.ok(fun/count>.68,`${fun}/${count} cultural`)
    console.log(`Reviewed route ${general?'CH':''}/${local?'ZH':''}: five summits, ${fun}/${count} cultural, ${formats.size} formats; no injected XP.`)
  }
}
async function gradeWholeBank(db){
  const actor='44444444-4444-4444-8444-444444444444'
  await db.query('INSERT INTO auth.users(id) VALUES($1)',[actor])
  await db.query("INSERT INTO public.profiles(id,canton) VALUES($1,'ZH')",[actor])
  await szRpc(db,actor,'preferences',{canton:'ZH',alias:'Editorial-sweep',leaderboard_opt_in:false})
  const current=(await db.query(queryCurrent)).rows.filter(r=>r.payload.status==='published')
  for(const row of current){
    // Age only local test sessions to avoid the real hourly abuse limit during
    // this exhaustive editorial sweep. Production rate limits are unchanged.
    await db.query("UPDATE suizamente_private.sessions SET created_at=now()-interval '2 hours' WHERE user_id=$1",[actor])
    let session=await szRpc(db,actor,'start',{mode:'practice'})
    const order=Array.from({length:row.payload.options.length},(_,i)=>row.payload.options.length-1-i)
    await db.query("UPDATE suizamente_private.sessions SET version_ids=ARRAY[$2::bigint],position=0,option_orders=jsonb_build_object($2::text,$3::jsonb),rules=rules||'{\"node\":-2,\"practice\":true,\"gift\":null,\"gift_at\":-1}'::jsonb WHERE id=$1",[session.id,row.version_id,JSON.stringify(order)])
    session=await szRpc(db,actor,'session',{id:session.id})
    session=await gameAnswer(db,actor,session)
    assert.equal(session.answer?.correct,true,`${row.id}: correct answer accepted after reversed option order`)
    if(session.status==='active')session=await szRpc(db,actor,'session',{id:session.id,advance:true})
    assert.equal(session.status,'completed',row.id)
  }
  console.log(`All ${current.length} published questions graded correctly with shuffled options across every format.`)
}
let db
try{
  // An installation with only the original seed needs just the one new SQL.
  db=await createSuizamenteDb({game:true})
  await db.exec(sql)
  assert.equal((await db.query(queryCurrent)).rows.length,bank.length)
  assert.deepEqual((await db.query(queryCurrent)).rows.map(r=>r.payload).sort((a,b)=>a.id.localeCompare(b.id)),bank.toSorted((a,b)=>a.id.localeCompare(b.id)))
  const n=await versions(db);await db.exec(sql);assert.equal(await versions(db),n,'Repeat import creates no versions')
  await gradeWholeBank(db)
  for(const role of ['anon','authenticated']){
    await assert.rejects(db.exec(`SET ROLE ${role}; SELECT * FROM suizamente_private.versions`),/permission denied/);await db.exec('RESET ROLE')
    await assert.rejects(db.exec(`SET ROLE ${role}; SELECT * FROM suizamente_private.trivia_catalog`),/permission denied/);await db.exec('RESET ROLE')
  }
  await fullRoutes(db)
  const a=await szRpc(db,SZ_ALICE,'start',{mode:'weekly'}),b=await szRpc(db,SZ_BOB,'start',{mode:'weekly'})
  const ids=async id=>(await db.query('SELECT version_ids FROM suizamente_private.sessions WHERE id=$1',[id])).rows[0].version_ids
  assert.deepEqual(await ids(a.id),await ids(b.id),'One common weekly challenge')
  await db.close()

  // Existing released bank, an active answered question, a frozen weekly round
  // and a custom administrator edit must all survive the consolidated import.
  db=await createSuizamenteDb({game:true})
  await db.exec(publicationSql(pack.questions,pack.legacy))
  await db.exec(await read('supabase/suizamente_actualizacion_trivial_13.sql'))
  await db.exec(await read('supabase/suizamente_trivia_preguntas_13.sql'))
  let old=await szRpc(db,SZ_ALICE,'game_start')
  old=await gameAnswer(db,SZ_ALICE,old)
  await szRpc(db,SZ_BOB,'start',{mode:'weekly'})
  const custom={...pack.questions.find(q=>q.id==='szx-zh-plato-ternera'),status:'published',prompt:'Pregunta redactada por el administrador, conservar sin cambios.'}
  await db.query('SELECT suizamente_private.write_question($1::jsonb)',[JSON.stringify(custom)])
  const before=await snapshot(db),oldVersions=(await db.query('SELECT * FROM suizamente_private.versions ORDER BY id')).rows
  const result=await db.exec(sql)
  const summary=result.flatMap(r=>r.rows||[]).find(r=>r.result==='skipped_custom_edit')
  assert.deepEqual(summary?.omitted_ids,[custom.id],'Custom edits are explicitly reported')
  assert.deepEqual(await snapshot(db),before,'No changes to any player state or assigned sessions')
  assert.deepEqual((await db.query('SELECT * FROM suizamente_private.versions WHERE id=ANY($1::bigint[]) ORDER BY id',[oldVersions.map(v=>v.id)])).rows,oldVersions,'Immutable versions are never rewritten or annulled')
  assert.equal((await db.query(queryCurrent+' WHERE q.id=$1',[custom.id])).rows[0].payload.prompt,custom.prompt)
  assert.deepEqual(await szRpc(db,SZ_ALICE,'session',{id:old.id}),old,'An already answered active question keeps its exact view')
  const count=await versions(db);await db.exec(sql);assert.equal(await versions(db),count)
  assert.deepEqual(await snapshot(db),before)
  console.log(`Complete review: ${audit.stats.improved} improved, ${audit.stats.retained} retained, 26 visual replacements. Both upgrade paths, idempotency, RLS, custom edits and frozen progress passed.`)
}finally{await db?.close()}
