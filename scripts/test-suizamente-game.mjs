import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createSuizamenteDb,szRpc,SZ_ALICE,SZ_BOB} from './lib/suizamente-test-db.mjs'

export async function gameAnswer(db,actor,s,{wrong=false,skip=false}={}){
  const row=(await db.query('SELECT option_orders FROM suizamente_private.sessions WHERE id=$1',[s.id])).rows[0],q=(await db.query('SELECT payload FROM suizamente_private.versions WHERE id=$1',[s.question.version_id])).rows[0].payload,order=row.option_orders[s.question.version_id]
  const args={session_id:s.id,position:s.position}
  if(skip)return szRpc(db,actor,'answer',{...args,skip:true})
  if(q.game_type==='multi')return szRpc(db,actor,'answer',{...args,choices:wrong?[order.indexOf(q.options.findIndex((_,i)=>!q.correct_indices.includes(i)))]:q.correct_indices.map(i=>order.indexOf(i))})
  if(q.game_type==='order')return szRpc(db,actor,'answer',{...args,choices:(wrong?q.correct_order.toReversed():q.correct_order).map(i=>order.indexOf(i))})
  if(q.game_type==='short')return szRpc(db,actor,'answer',{...args,text:wrong?'x'.repeat(Math.min(3,q.max_length||80)):q.accepted_answers[0]})
  if(q.game_type==='match'){
    for(let i=0;i<4;i++)s=await szRpc(db,actor,'answer',{...args,left:i,right:order.indexOf(i)})
    return s
  }
  return szRpc(db,actor,'answer',{...args,choice:wrong?(order.indexOf(q.correct_index)+1)%q.options.length:order.indexOf(q.correct_index)})
}
export async function finishGame(db,actor,s,options={}){
  while(s.status==='active'){
    if(!s.answer)s=await gameAnswer(db,actor,s,options)
    if(s.status==='active')s=await szRpc(db,actor,'session',{id:s.id,advance:true})
  }
  return s
}
async function assignSingleQuestion(db,actor,s,qid){
  const q=(await db.query('SELECT id,payload FROM suizamente_private.versions WHERE question_id=$1 ORDER BY version DESC LIMIT 1',[qid])).rows[0]
  await db.query("UPDATE suizamente_private.sessions SET version_ids=ARRAY[$2::bigint],position=0,option_orders=jsonb_build_object($2::text,$3::jsonb),rules=rules||'{\"node\":-2,\"practice\":true,\"gift\":null,\"gift_at\":-1}'::jsonb WHERE id=$1",[s.id,q.id,JSON.stringify(Array.from({length:q.payload.options.length},(_,i)=>q.payload.options.length-1-i))])
  return szRpc(db,actor,'session',{id:s.id})
}
if(process.argv[1]?.endsWith('test-suizamente-game.mjs')){
  let db
  try{
    db=await createSuizamenteDb({game:true})
    const guest=await szRpc(db,null,'summary');assert.equal(guest.game_version,4);assert.equal(guest.player,undefined)
    const preview=await szRpc(db,SZ_ALICE,'summary');assert.equal(preview.trail.node,-1);assert.equal(preview.player.xp,0)
    assert.equal((await db.query('SELECT count(*)::integer n FROM suizamente_private.players')).rows[0].n,0)
    await assert.rejects(szRpc(db,null,'game_start'),/SZ_AUTH_REQUIRED/)
    await assert.rejects(szRpc(db,SZ_ALICE,'game_start',{node:1}),/SZ_STAGE_LOCKED/)
    await assert.rejects(szRpc(db,SZ_ALICE,'game_start',{level:5,node:-1}),/SZ_STAGE_LOCKED/)
    await assert.rejects(szRpc(db,SZ_ALICE,'start',{mode:'ascent'}),/SZ_STAGE_LOCKED/)
    let s=await szRpc(db,SZ_ALICE,'game_start',{xp:99999,inventory:{life:99}})
    assert.equal(s.mode,'arrival');assert.equal(s.total,3);assert.equal(s.question.correct_index,undefined);assert.equal(s.question.explanation,undefined)
    assert.equal((await szRpc(db,SZ_ALICE,'game_start')).id,s.id)
    await assert.rejects(szRpc(db,SZ_BOB,'session',{id:s.id}),/SZ_SESSION_NOT_FOUND/)
    await assert.rejects(szRpc(db,SZ_BOB,'answer',{session_id:s.id,position:0,choice:0}),/SZ_SESSION_NOT_FOUND/)
    s=await gameAnswer(db,SZ_ALICE,s,{skip:true});assert.equal(s.answer.correct,false);assert.equal(s.answer.xp,0)
    const frozen=await gameAnswer(db,SZ_ALICE,s);assert.equal(frozen.answer.skipped,true)
    s=await finishGame(db,SZ_ALICE,s);assert.equal(s.status,'completed');assert.equal(s.review_answers.length,3)
    let sum=await szRpc(db,SZ_ALICE,'summary');assert.equal(sum.trail.node,0);assert.equal(sum.trail.streak,1);assert.equal(sum.trail.days.length,1)
    console.log('Game: ownership, source defaults, immutable answers, arrival and local-calendar streak passed.')
    const mt=JSON.parse(await readFile('src/data/suizamenteMountains.json','utf8'))
    for(let lv=1;lv<=5;lv++){
      const config=(await db.query('SELECT suizamente_private.mountain($1) m',[lv])).rows[0].m
      assert.equal(config.q,mt[lv].q);assert.equal(config.test,mt[lv].test);assert.equal(config.pass,mt[lv].pass);assert.equal(config.stages.length,mt[lv].st.length)
      if(lv>1)await finishGame(db,SZ_ALICE,await szRpc(db,SZ_ALICE,'game_start'))
      for(let i=0;i<mt[lv].st.length;i++){
        s=await szRpc(db,SZ_ALICE,'game_start',{node:i})
        assert.equal(s.level,lv);assert.equal(s.trail.node,i)
        const expected=mt[lv].st[i][1]==='🎁'?3:mt[lv].q;assert.equal(s.total,expected)
        s=await finishGame(db,SZ_ALICE,s)
        assert.equal(s.status,'completed')
        sum=await szRpc(db,SZ_ALICE,'summary');assert.equal(sum.trail.node,i+1)
        if(i===0&&lv===1){
          const xp=sum.player.xp,inventory=sum.trail.inventory
          const repeated=await finishGame(db,SZ_ALICE,await szRpc(db,SZ_ALICE,'game_start',{node:i}))
          const replay=await szRpc(db,SZ_ALICE,'summary');assert.equal(replay.player.xp-xp,repeated.review_answers.reduce((n,a)=>n+a.xp,0),'Replays only award first correct answers, never another stage bonus');assert.deepEqual(replay.trail.inventory,inventory)
        }
      }
      for(let i=0;sum.player.xp<mt[lv].xp&&i<20;i++){
        await finishGame(db,SZ_ALICE,await szRpc(db,SZ_ALICE,'start',{mode:'practice'}))
        sum=await szRpc(db,SZ_ALICE,'summary')
      }
      assert.ok(sum.player.xp>=mt[lv].xp,`The supplied bank can reach ${mt[lv].n} with legitimate first-correct XP`)
      if(lv===2)await assert.rejects(szRpc(db,SZ_ALICE,'game_start',{node:mt[lv].st.length}),/SZ_SUMMIT_TOMORROW/)
      await db.query("UPDATE suizamente_private.sessions SET created_at=now()-interval '2 hours',day_key=day_key-10 WHERE user_id=$1 AND mode='summit'",[SZ_ALICE])
      const test=await szRpc(db,SZ_ALICE,'game_start',{node:mt[lv].st.length})
      assert.equal(test.total,mt[lv].test);assert.equal(test.trail.pass,mt[lv].pass-(test.trail.life?1:0))
      if(lv===2){
        const boundary=(await db.query("SELECT day_key=(now() AT TIME ZONE 'Europe/Zurich')::date AS swiss_day, created_at>now()-interval '24 hours' AS recent FROM suizamente_private.sessions WHERE id=$1",[test.id])).rows[0]
        assert.equal(boundary.swiss_day,true,'Summit attempts belong to the Swiss calendar day')
        assert.equal(boundary.recent,true)
        const beforeFailure=await szRpc(db,SZ_ALICE,'summary')
        const failed=await szRpc(db,SZ_ALICE,'game_exit',{id:test.id});assert.equal(failed.ascent_passed,false)
        assert.equal((await szRpc(db,SZ_ALICE,'game_start',{node:mt[lv].st.length})).id,test.id)
        const afterFailure=await szRpc(db,SZ_ALICE,'summary')
        assert.equal(afterFailure.player.xp,beforeFailure.player.xp,'A failed test preserves earned XP')
        assert.equal(afterFailure.trail.nodes.length,beforeFailure.trail.nodes.length,'A failed test preserves completed stages')
        await db.query('UPDATE suizamente_private.sessions SET day_key=day_key-1 WHERE id=$1',[test.id])
        const nextDay=await szRpc(db,SZ_ALICE,'game_start',{node:mt[lv].st.length})
        assert.notEqual(nextDay.id,test.id,'A new Swiss calendar day permits a retry even before 24 hours elapse')
      }
      s=await finishGame(db,SZ_ALICE,await szRpc(db,SZ_ALICE,'game_start',{node:mt[lv].st.length}))
      assert.equal(s.ascent_passed,true)
      sum=await szRpc(db,SZ_ALICE,'summary');assert.equal(sum.player.level,Math.min(5,lv+1));assert.equal(sum.player.route_completed,lv===5)
      await db.query("UPDATE suizamente_private.sessions SET created_at=now()-interval '2 hours' WHERE user_id=$1",[SZ_ALICE])
    }
    console.log('Game: all five complete trails, variable test sizes, inventory, replay protection, test exit and promotions passed.')
    const completedBefore=sum.trail.nodes.length
    s=await finishGame(db,SZ_ALICE,await szRpc(db,SZ_ALICE,'game_start',{level:5,node:15}))
    assert.equal(s.trail.summit_practice,true);assert.equal(s.ascent_passed,true)
    assert.equal((await szRpc(db,SZ_ALICE,'summary')).trail.nodes.length,completedBefore,'Practising a completed summit does not create a sixteenth stage')

    // Exercise every solution format through the public RPC; the client cannot submit correct flags or XP.
    let multi=await szRpc(db,SZ_BOB,'start',{mode:'practice',category:'sociedad'})
    assert.equal(multi.game_version,4)
    multi=await assignSingleQuestion(db,SZ_BOB,multi,'game-14-v1')
    assert.equal(multi.question.options.length,5);assert.equal(multi.answer,null);assert.equal(multi.question.correct_indices,undefined)
    await assert.rejects(szRpc(db,SZ_BOB,'answer',{session_id:multi.id,position:0,choices:[0,0]}),/SZ_INVALID_ANSWER/)
    multi=await szRpc(db,SZ_BOB,'answer',{session_id:multi.id,position:0,choices:[2],correct:true,xp:99999})
    assert.equal(multi.answer.correct,false);assert.equal(multi.answer.xp,0)
    assert.equal((await gameAnswer(db,SZ_BOB,multi)).answer.correct,false)
    const corrected=await finishGame(db,SZ_BOB,await szRpc(db,SZ_BOB,'start',{mode:'review'}))
    assert.equal(corrected.question.id,'game-14-v1');assert.equal(corrected.xp_gained,15);assert.ok(!corrected.review_answers[0].chosen_answer.includes('['))
    let pairs=await szRpc(db,SZ_BOB,'start',{mode:'practice',category:'salud'})
    pairs=await assignSingleQuestion(db,SZ_BOB,pairs,'game-12-v1')
    const bad={session_id:pairs.id,position:0,left:0,right:0}
    pairs=await szRpc(db,SZ_BOB,'answer',bad);assert.equal(pairs.pair_state.errors,1)
    assert.equal((await szRpc(db,SZ_BOB,'answer',bad)).pair_state.errors,1,'Retrying a lost response does not count the same wrong pair twice')
    pairs=await szRpc(db,SZ_BOB,'answer',{...bad,right:1});assert.equal(pairs.pair_state.errors,2)
    pairs=await finishGame(db,SZ_BOB,pairs);assert.equal(pairs.answer.correct,false);assert.equal(pairs.answer.xp,0)
    const fixedPairs=await finishGame(db,SZ_BOB,await szRpc(db,SZ_BOB,'start',{mode:'review'}));assert.equal(fixedPairs.xp_gained,20)
    const german=await finishGame(db,SZ_BOB,await szRpc(db,SZ_BOB,'start',{mode:'practice',category:'idioma'}));assert.equal(german.xp_gained,0)
    await db.query("UPDATE suizamente_private.players SET inventory='{\"x2\":1,\"life\":0,\"freeze\":0}' WHERE user_id=$1",[SZ_BOB])
    await finishGame(db,SZ_BOB,await szRpc(db,SZ_BOB,'game_start'))
    const boosted=await szRpc(db,SZ_BOB,'game_start');assert.equal(boosted.trail.x2,true)
    assert.equal((await szRpc(db,SZ_BOB,'game_start')).id,boosted.id)
    assert.equal((await szRpc(db,SZ_BOB,'summary')).trail.inventory.x2,0)
    const boostedEnd=await finishGame(db,SZ_BOB,boosted);assert.equal(boostedEnd.xp_gained-boostedEnd.review_answers.reduce((n,a)=>n+a.xp,0),10)
    assert.ok(boostedEnd.review_answers.every(a=>[0,20,30,40].includes(a.xp)))
    for(let node=1;node<3;node++)await finishGame(db,SZ_BOB,await szRpc(db,SZ_BOB,'game_start',{node}))
    let bonus=await szRpc(db,SZ_BOB,'game_start',{node:3});bonus=await gameAnswer(db,SZ_BOB,bonus,{skip:true});bonus=await finishGame(db,SZ_BOB,bonus)
    const freezeBefore=(await szRpc(db,SZ_BOB,'summary')).trail.inventory.freeze
    assert.equal(bonus.trail.gifts.length,0)
    await finishGame(db,SZ_BOB,await szRpc(db,SZ_BOB,'game_start',{node:3}))
    assert.equal((await szRpc(db,SZ_BOB,'summary')).trail.inventory.freeze,freezeBefore+1)
    await finishGame(db,SZ_BOB,await szRpc(db,SZ_BOB,'game_start',{node:3}))
    assert.equal((await szRpc(db,SZ_BOB,'summary')).trail.inventory.freeze,freezeBefore+1)
    for(let node=4;node<6;node++)await finishGame(db,SZ_BOB,await szRpc(db,SZ_BOB,'game_start',{node}))
    await db.query("UPDATE suizamente_private.players SET inventory=jsonb_set(inventory,'{life}','0') WHERE user_id=$1",[SZ_BOB])
    let annulledTest=await szRpc(db,SZ_BOB,'game_start',{node:6})
    const testIds=(await db.query('SELECT version_ids FROM suizamente_private.sessions WHERE id=$1',[annulledTest.id])).rows[0].version_ids,annulledIds=testIds.slice(-3)
    await db.query('UPDATE suizamente_private.versions SET annulled=true WHERE id=ANY(SELECT jsonb_array_elements_text($1::jsonb)::bigint)',[JSON.stringify(annulledIds)])
    annulledTest=await szRpc(db,SZ_BOB,'session',{id:annulledTest.id});assert.equal(annulledTest.trail.pass,5);assert.equal(annulledTest.valid_total,7)
    while(annulledTest.status==='active'){
      if(!annulledTest.answer)annulledTest=await gameAnswer(db,SZ_BOB,annulledTest,{skip:[5,6].includes(annulledTest.position)})
      if(annulledTest.status==='active')annulledTest=await szRpc(db,SZ_BOB,'session',{id:annulledTest.id,advance:true})
    }
    assert.equal(annulledTest.ascent_passed,true);assert.equal(annulledTest.correct_count,5);assert.equal(annulledTest.annulled_count,3)
    await db.query('UPDATE suizamente_private.versions SET annulled=false WHERE id=ANY(SELECT jsonb_array_elements_text($1::jsonb)::bigint)',[JSON.stringify(annulledIds)])
    console.log('Game: multiple selection, pairing retries, mixed-format review, optional German, double XP and one-time bonus gifts passed.')
    // One protection preserves exactly one missing day, and cannot be fabricated by RPC args.
    await db.query("UPDATE suizamente_private.players SET trail_streak=7,trail_last_day=(now() AT TIME ZONE 'Europe/Zurich')::date-2,inventory='{}'::jsonb||jsonb_build_object('x2',0,'life',0,'freeze',1) WHERE user_id=$1",[SZ_ALICE])
    s=await finishGame(db,SZ_ALICE,await szRpc(db,SZ_ALICE,'game_start',{level:1,node:-1}))
    sum=await szRpc(db,SZ_ALICE,'summary');assert.equal(sum.trail.streak,9);assert.equal(sum.trail.inventory.freeze,0);assert.ok(sum.trail.days.some(d=>d.protected))
    const xpBefore=sum.player.xp
    await db.exec(await readFile('supabase/suizamente.sql','utf8'));await db.exec(await readFile('supabase/suizamente_game.sql','utf8'));await db.exec(await readFile('supabase/suizamente_seed.sql','utf8'))
    assert.equal((await szRpc(db,SZ_ALICE,'summary')).player.xp,xpBefore)
    for(const role of ['anon','authenticated'])await assert.rejects(db.transaction(async tx=>{await tx.exec(`SET LOCAL ROLE ${role}`);return tx.exec('SELECT * FROM suizamente_private.trail_nodes')}),/permission denied/)
    const legacy=await createSuizamenteDb()
    try{
      const old=await gameAnswer(legacy,SZ_ALICE,await szRpc(legacy,SZ_ALICE,'start',{mode:'daily'})),oldXP=(await szRpc(legacy,SZ_ALICE,'summary')).player.xp
      await legacy.exec(await readFile('supabase/suizamente_game.sql','utf8'))
      const updated=await szRpc(legacy,SZ_ALICE,'summary');assert.equal(updated.player.xp,oldXP);assert.equal(updated.legacy_active.id,old.id)
      const resumed=await szRpc(legacy,SZ_ALICE,'session',{id:old.id});assert.deepEqual(resumed.answer,old.answer)
      const completed=await finishGame(legacy,SZ_ALICE,resumed);assert.equal(completed.status,'completed');assert.ok(completed.xp_gained>old.xp_gained)
    }finally{await legacy.close()}
    console.log('Game: annulled tests, freeze consumption, private tables and idempotent upgrades preserve old active sessions and XP. All passed.')
  }catch(e){console.error('Suizamente game test failed:',e.message,e.where||'',e.internalQuery||'');process.exitCode=1}finally{await db?.close()}
}
