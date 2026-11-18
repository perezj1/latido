import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createSuizamenteDb,szRpc,SZ_ALICE,SZ_BOB,SZ_ADMIN} from './lib/suizamente-test-db.mjs'
import {finishGame} from './test-suizamente-game.mjs'
import {loadContentPack,publicationSql} from './lib/suizamente-content-pack.mjs'
import {isStatement} from '../src/lib/suizamenteQuestionText.js'
import {ARCADE_DEMO} from '../src/data/suizamenteArcadeDemo.js'
import {IMG} from '../src/components/suizamente/questionArt.js'
const read=path=>readFile(path,'utf8')
const pack=await loadContentPack(),trivia=JSON.parse(await read('supabase/seed-data/suizamente-trivia.json'))
const catalog=new Map(trivia.catalog.map(q=>[q.id,q]))
const bank=new Map([...JSON.parse(await read('supabase/seed-data/suizamente-questions.json')),...pack.questions,...trivia.questions].map(q=>[q.id,q]))
for(const q of trivia.refinements){
  const original=bank.get(q.id)
  assert.equal(q.correct_index,original.correct_index)
  assert.equal(q.options[q.correct_index],original.options[original.correct_index])
  assert.equal(q.source_url,original.source_url)
}
for(const entry of trivia.catalog){
  const q=bank.get(entry.id);assert.ok(q,entry.id);assert.equal(entry.original_prompt,q.prompt)
  assert.ok(q.source_url.startsWith('https://'));assert.ok(q.explanation)
  if(q.game_type==='tf')assert.ok(isStatement(entry.prompt),entry.id)
  if(q.game_type==='image'){assert.ok(IMG[q.image_key]);assert.equal(q.options.length,4)}
}
for(const q of trivia.questions){
  assert.ok(q.prompt.length<140);assert.ok(q.explanation.length<190)
  assert.equal(q.verified_at,'2026-11-18');assert.ok(q.sources[0].locator)
}
assert.equal(ARCADE_DEMO[0].prompt,'¿Dónde está el Rigi?')
assert.equal(ARCADE_DEMO.find(q=>q.game_type==='multi').correct_indices.length,2)
assert.ok(ARCADE_DEMO.some(q=>q.image_key==='swiss-trivia-flag'))
let db
try{
  db=await createSuizamenteDb({game:true})
  await db.exec(publicationSql(pack.questions,pack.legacy))
  const oldSession=await szRpc(db,SZ_ALICE,'game_start')
  const before=(await db.query('SELECT version_ids,option_orders,rules FROM suizamente_private.sessions WHERE id=$1',[oldSession.id])).rows[0]
  const versions=(await db.query('SELECT count(*)::integer n FROM suizamente_private.versions')).rows[0].n
  const migration=await read('supabase/suizamente_actualizacion_trivial_13.sql'),seed=await read('supabase/suizamente_trivia_preguntas_13.sql')
  await db.exec(migration);await db.exec(seed);await db.exec(migration);await db.exec(seed)
  assert.deepEqual((await db.query('SELECT version_ids,option_orders,rules FROM suizamente_private.sessions WHERE id=$1',[oldSession.id])).rows[0],before)
  assert.equal((await szRpc(db,SZ_ALICE,'game_start')).id,oldSession.id)
  assert.equal((await db.query('SELECT count(*)::integer n FROM suizamente_private.versions')).rows[0].n,versions+14+trivia.refinements.length)
  await assert.rejects(db.exec('SET ROLE authenticated; SELECT * FROM suizamente_private.trivia_catalog'),/permission denied/);await db.exec('RESET ROLE')
  const mt=JSON.parse(await read('src/data/suizamenteMountains.json'))
  // Complete real routes with their actual answer evaluator, XP thresholds,
  // immutable versions and first-answer safeguards. No free XP is injected.
  for(const [actor,general,local] of [[SZ_ALICE,true,true],[SZ_BOB,true,false],[SZ_ADMIN,false,true]]){
    await szRpc(db,actor,'preferences',{canton:'ZH',alias:`Trivial-${actor.slice(0,2)}`,include_general:general,include_canton:local,leaderboard_opt_in:false})
    let count=0,fun=0,national=0;const formats=new Set()
    for(let lv=1;lv<=5;lv++){
      await finishGame(db,actor,await szRpc(db,actor,'game_start'))
      for(let node=0;node<mt[lv].st.length;node++){
        let session=await szRpc(db,actor,'game_start',{node})
        while(session.status==='active'){
          const q=session.question;assert.equal(q.correct_index,undefined);assert.equal(q.explanation,undefined)
          assert.equal(session.trail.general_versions,undefined)
          formats.add(q.type);count++;if(q.trivia_topic)fun++
          if(q.scope==='CH'&&bank.get(q.id).scope==='canton'){national++;assert.ok(catalog.get(q.id).national);assert.equal(q.canton,null)}
          if(!general)assert.ok(q.scope==='CH'||q.canton==='ZH','Only selected canton or explicit fallback')
          if(!local)assert.equal(q.scope,'CH')
          const {gameAnswer}=await import('./test-suizamente-game.mjs')
          session=await gameAnswer(db,actor,session)
          if(session.status==='active')session=await szRpc(db,actor,'session',{id:session.id,advance:true})
        }
        await db.query("UPDATE suizamente_private.sessions SET created_at=now()-interval '2 hours' WHERE user_id=$1",[actor])
      }
      const summary=await szRpc(db,actor,'summary')
      assert.ok(summary.player.xp>=mt[lv].xp,`Level ${lv} attainable without grinding for ${general}/${local}: ${summary.player.xp}`)
      await db.query("UPDATE suizamente_private.sessions SET day_key=day_key-10 WHERE user_id=$1 AND mode='summit'",[actor])
      assert.equal((await finishGame(db,actor,await szRpc(db,actor,'game_start',{node:mt[lv].st.length}))).ascent_passed,true)
      await db.query("UPDATE suizamente_private.sessions SET created_at=now()-interval '2 hours' WHERE user_id=$1",[actor])
    }
    assert.ok(fun/count>.68,`Cultural majority ${fun}/${count}`)
    if(general){assert.ok(national>30);assert.ok(formats.has('image')&&formats.has('tf')&&formats.has('match')&&formats.has('multi'))}
    console.log(`Trivia ${general?'general':''}/${local?'ZH':''}: ${fun}/${count} cultural questions, ${formats.size} formats, five summits, no extra practice.`)
  }
  // Re-running release 13 never overrides an administrator's different wording.
  const weeklyA=await szRpc(db,SZ_ALICE,'start',{mode:'weekly'}),weeklyB=await szRpc(db,SZ_BOB,'start',{mode:'weekly'})
  assert.equal(weeklyA.question.scope,'CH');assert.equal(weeklyA.question.canton,null)
  assert.ok(weeklyA.question.trivia_topic);assert.equal(weeklyA.question.correct_index,undefined)
  const weeklyIds=async id=>(await db.query('SELECT version_ids FROM suizamente_private.sessions WHERE id=$1',[id])).rows[0].version_ids
  assert.deepEqual(await weeklyIds(weeklyA.id),await weeklyIds(weeklyB.id),'Everyone receives the same weekly challenge')
  const week=(await db.query('SELECT question_id FROM suizamente_private.versions WHERE id=ANY($1::bigint[])',[await weeklyIds(weeklyA.id)])).rows
  assert.ok(week.filter(q=>catalog.get(q.question_id)?.national).length>=8,'The weekly challenge also favours trivia')
  await db.exec(migration)
  assert.equal((await szRpc(db,SZ_ALICE,'start',{mode:'weekly'})).id,weeklyA.id,'An assigned week remains frozen')
  const q=bank.get('szx-zh-plato-ternera')
  await db.query('SELECT suizamente_private.write_question($1::jsonb)',[JSON.stringify({...q,status:'published',prompt:'En la receta tradicional de Zürich, ¿qué carne lleva el Geschnetzeltes?'})])
  await db.exec(migration)
  assert.equal((await db.query("SELECT suizamente_private.game_prompt(payload) p FROM suizamente_private.versions WHERE question_id=$1 ORDER BY version DESC LIMIT 1",[q.id])).rows[0].p,'En la receta tradicional de Zürich, ¿qué carne lleva el Geschnetzeltes?')
  console.log(`Trivia: ${trivia.catalog.length} catalogued, ${trivia.catalog.filter(q=>q.national).length} national; RLS, repeatable upgrade, preserved sessions and editorial changes passed.`)
}finally{await db?.close()}
