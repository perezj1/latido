import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createSuizamenteDb,szRpc,SZ_ALICE,SZ_BOB,SZ_ADMIN} from './lib/suizamente-test-db.mjs'
import {gameAnswer,finishGame} from './test-suizamente-game.mjs'
const read=p=>readFile(p,'utf8'),json=async p=>JSON.parse(await read(p))
const patch=await read('supabase/suizamente_actualizacion_idiomas_15.sql')
const mt=await json('src/data/suizamenteMountains.json')
const current='SELECT q.id,v.id version_id,v.payload FROM suizamente_private.questions q JOIN suizamente_private.versions v ON v.question_id=q.id AND v.version=q.current_version'
let db
async function age(actor){await db.query("UPDATE suizamente_private.sessions SET created_at=now()-interval '2 hours' WHERE user_id=$1 AND created_at>now()-interval '1 hour'",[actor])}
async function state(){
  const result={}
  for(const table of ['players','sessions','answers','progress','rewards','trail_nodes','trail_days','versions'])result[table]=(await db.query(`SELECT coalesce(jsonb_agg(row ORDER BY row::text),'[]') data FROM (SELECT to_jsonb(t) row FROM suizamente_private.${table} t) s`)).rows[0].data
  return result
}
try{
  db=await createSuizamenteDb({game:true})
  await db.exec(await read('supabase/suizamente_revision_completa.sql'))
  await db.exec(await read('scripts/fixtures/suizamente-language-selectors-v14.sql'))
  const old=await gameAnswer(db,SZ_ALICE,await szRpc(db,SZ_ALICE,'game_start'))
  const before=await state()
  await db.exec(patch);await db.exec(patch)
  assert.deepEqual(await state(),before,'Small patch changes no versions or player data')
  assert.deepEqual(await szRpc(db,SZ_ALICE,'session',{id:old.id}),old,'Assigned question stays identical')
  assert.equal((await szRpc(db,SZ_ALICE,'game_start')).id,old.id)
  assert.equal((await db.query(`SELECT count(*)::int n FROM (${current}) v WHERE suizamente_private.is_language_exercise(v.payload)`)).rows[0].n,364)
  for(const role of ['anon','authenticated'])assert.equal((await db.query("SELECT has_function_privilege($1,'suizamente_private.is_language_exercise(jsonb)','EXECUTE') allowed",[role])).rows[0].allowed,false)
  for(const [actor,canton,skipLanguage]of [[SZ_ALICE,'ZH',true],[SZ_BOB,'GE',false],[SZ_ADMIN,'TI',false]]){
    await szRpc(db,actor,'preferences',{canton,alias:`Language-${canton}`,include_general:true,include_canton:true,leaderboard_opt_in:false})
    let languageCount=0,cultural=0,count=0,summitLanguages=0;const formats=new Set()
    for(let level=1;level<=5;level++){
      await finishGame(db,actor,await szRpc(db,actor,'game_start'))
      for(let node=0;node<mt[level].st.length;node++){
        let session=await szRpc(db,actor,'game_start',{node}),seen=0
        const ordinary=session.mode==='stage'
        while(session.status==='active'){
          const q=session.question,isLanguage=q.category==='idioma'
          count++;if(q.trivia_topic)cultural++
          assert.equal(q.correct_index,undefined);assert.equal(q.correct_order,undefined)
          if(isLanguage){
            seen++;languageCount++;formats.add(q.type)
            assert.ok(ordinary);assert.notEqual(q.type,'short');assert.notEqual(session.position,0)
            assert.notEqual(session.position,session.trail.gift_at,'Prize never depends on the language exercise')
            assert.ok(q.scope==='CH'||q.canton===canton,'Selected canton or general Swiss-language vocabulary')
          }
          session=await gameAnswer(db,actor,session,{skip:isLanguage&&skipLanguage})
          if(isLanguage)assert.equal(session.answer.xp,0,'Existing optional-language XP rule retained')
          if(session.status==='active')session=await szRpc(db,actor,'session',{id:session.id,advance:true})
        }
        assert.equal(seen,ordinary?1:0,`${canton} ${level}/${node}: one exercise per normal stage`)
        await age(actor)
      }
      const sum=await szRpc(db,actor,'summary')
      assert.ok(sum.player.xp>=mt[level].xp,`XP threshold ${level}/${canton}: ${sum.player.xp}`)
      let summitSession=await szRpc(db,actor,'game_start',{node:mt[level].st.length})
      const assigned=(await db.query('SELECT v.payload FROM suizamente_private.sessions s JOIN suizamente_private.versions v ON v.id=ANY(s.version_ids) WHERE s.id=$1',[summitSession.id])).rows.map(row=>row.payload)
      const languageQuestions=assigned.filter(q=>q.category==='idioma')
      assert.equal(summitSession.total,mt[level].test)
      assert.equal(summitSession.trail.pass,mt[level].pass-(summitSession.trail.life?1:0))
      assert.equal(languageQuestions.length,Math.floor(mt[level].test/5))
      assert.ok(languageQuestions.every(q=>q.game_type!=='short'&&q.difficulty<=level))
      const concepts=languageQuestions.flatMap(q=>q.learning_concepts||[q.concept_id||q.id])
      assert.equal(new Set(concepts).size,concepts.length,'A summit cannot teach the answer to a later exercise on the same word')
      assert.equal(new Set(assigned.map(q=>q.id)).size,assigned.length)
      summitLanguages+=languageQuestions.length
      if(actor===SZ_ALICE&&level===1){
        // Failing language really consumes the existing error allowance. Skip
        // enough other answers to cross that allowance, including an extra life.
        let extraErrors=summitSession.total-summitSession.trail.pass-languageQuestions.length+1
        while(summitSession.status==='active'){
          const language=summitSession.question.category==='idioma'
          const skip=language||extraErrors-->0
          summitSession=await gameAnswer(db,actor,summitSession,{skip})
          if(summitSession.status==='active')summitSession=await szRpc(db,actor,'session',{id:summitSession.id,advance:true})
        }
        assert.equal(summitSession.ascent_passed,false,'Language mistakes count towards failing a summit')
        assert.equal((await szRpc(db,actor,'summary')).player.level,level)
        assert.equal((await szRpc(db,actor,'game_start',{node:mt[level].st.length})).id,summitSession.id,'One real attempt per Swiss day remains enforced')
        await db.query('UPDATE suizamente_private.sessions SET day_key=day_key-100 WHERE id=$1',[summitSession.id])
        summitSession=await szRpc(db,actor,'game_start',{node:mt[level].st.length})
      }
      const summit=await finishGame(db,actor,summitSession)
      assert.equal(summit.ascent_passed,true)
      assert.equal(summit.review_answers.filter(q=>q.category==='idioma').length,Math.floor(mt[level].test/5))
      assert.ok(summit.review_answers.filter(q=>q.category==='idioma').every(q=>q.correct&&q.xp===0))
      await db.query("UPDATE suizamente_private.sessions SET day_key=day_key-($2::int*10) WHERE user_id=$1 AND mode='summit' AND level=$2::int",[actor,level])
      await age(actor)
    }
    assert.ok(formats.has('match')&&formats.has('order')&&formats.size>=3)
    assert.ok(cultural/count>.55,'Cultural trivia remains the majority')
    assert.equal(summitLanguages,14)
    console.log(`${canton}: ${languageCount} stage + ${summitLanguages} summit language exercises, ${[...formats].join('/')}; five summits${skipLanguage?' while skipping ordinary-stage language':''}.`)
  }
  for(const [general,local]of [[true,false],[false,true]]){
    await szRpc(db,SZ_ALICE,'preferences',{canton:'ZH',alias:'Language-ZH',include_general:general,include_canton:local,leaderboard_opt_in:false})
    const practice=await finishGame(db,SZ_ALICE,await szRpc(db,SZ_ALICE,'start',{mode:'practice'}))
    const chosen=(await db.query('SELECT v.payload FROM suizamente_private.sessions s JOIN suizamente_private.versions v ON v.id=ANY(s.version_ids) WHERE s.id=$1',[practice.id])).rows.map(q=>q.payload)
    assert.equal(chosen.filter(q=>q.category==='idioma').length,1)
    if(!local)assert.ok(chosen.every(q=>q.scope==='CH'))
    if(!general)assert.ok(chosen.every(q=>q.scope==='CH'||q.canton==='ZH'))
  }
  const languageOnly=await finishGame(db,SZ_ALICE,await szRpc(db,SZ_ALICE,'start',{mode:'practice',category:'idioma'}))
  assert.equal(languageOnly.xp_gained,0)
  const week=await szRpc(db,SZ_ALICE,'start',{mode:'weekly'})
  assert.equal((await db.query("SELECT count(*)::int n FROM suizamente_private.sessions s JOIN suizamente_private.versions v ON v.id=ANY(s.version_ids) WHERE s.id=$1 AND v.payload->>'category'='idioma'",[week.id])).rows[0].n,0)
  // Replaying an old summit uses the same language quota, without spending a
  // real daily attempt, consuming prizes or awarding another summit bonus.
  const replay=await finishGame(db,SZ_ALICE,await szRpc(db,SZ_ALICE,'game_start',{level:1,node:mt[1].st.length}))
  assert.ok(replay.trail.summit_practice)
  assert.equal(replay.review_answers.filter(q=>q.category==='idioma').length,2)
  const todayAttempts=(await db.query("SELECT count(*)::int n FROM suizamente_private.sessions WHERE user_id=$1 AND mode='summit' AND day_key=(now() AT TIME ZONE 'Europe/Zurich')::date",[SZ_ALICE])).rows[0].n
  assert.equal(todayAttempts,0)
  // Upgrade an already assigned stage-only-v15 summit practice unchanged.
  await db.exec(await read('scripts/fixtures/suizamente-game-start-stages-language-v15.sql'))
  const pinned=await szRpc(db,SZ_ADMIN,'game_start',{level:1,node:mt[1].st.length})
  const pinnedState=await state()
  await db.exec(patch);await db.exec(patch)
  assert.deepEqual(await state(),pinnedState)
  assert.deepEqual(await szRpc(db,SZ_ADMIN,'session',{id:pinned.id}),pinned)
  const fallbackActor='55555555-5555-4555-8555-555555555555'
  await db.query('INSERT INTO auth.users(id) VALUES($1)',[fallbackActor])
  await finishGame(db,fallbackActor,await szRpc(db,fallbackActor,'game_start'))
  await db.query("UPDATE suizamente_private.versions SET annulled=true WHERE payload->>'category'='idioma'")
  const fallback=await finishGame(db,fallbackActor,await szRpc(db,fallbackActor,'game_start',{node:0}))
  assert.equal(fallback.status,'completed','A sparse/custom bank without language exercises still works')
  console.log('Language patch: immutable sessions, RLS, preferences, one free-practice exercise, language XP, weekly stability and sparse-bank fallback passed.')
}finally{await db?.close()}
