import assert from 'node:assert/strict'
import {createSuizamenteDb,szRpc,SZ_ALICE,SZ_BOB,SZ_ADMIN} from './lib/suizamente-test-db.mjs'
import {finishGame} from './test-suizamente-game.mjs'
import {loadContentPack,publicationSql} from './lib/suizamente-content-pack.mjs'
const pack=await loadContentPack()
let db
try{
  db=await createSuizamenteDb({game:true})
  await db.exec(publicationSql(pack.questions,pack.legacy))
  const routes=[[SZ_ALICE,'ZH'],[SZ_BOB,'GE'],[SZ_ADMIN,'LU'],[SZ_ALICE,'BE'],[SZ_BOB,'TI'],[SZ_ADMIN,'VD'],[SZ_ALICE,'BS'],[SZ_BOB,'BL'],[SZ_ADMIN,'FR'],[SZ_ALICE,'VS'],[SZ_BOB,'SG'],[SZ_ADMIN,'GR'],[SZ_ALICE,'AR'],[SZ_BOB,'AI'],[SZ_ADMIN,'UR'],[SZ_ALICE,'SZ'],[SZ_BOB,'OW'],[SZ_ADMIN,'NW'],[SZ_ALICE,'GL'],[SZ_BOB,'ZG'],[SZ_ADMIN,'SO'],[SZ_ALICE,'SH'],[SZ_BOB,'AG'],[SZ_ADMIN,'TG'],[SZ_ALICE,'NE'],[SZ_BOB,'JU']]
  for(const [index,[actor,canton]] of routes.entries()){
    if(index>0&&index%3===0){
      await db.close();db=await createSuizamenteDb({game:true})
      await db.exec(publicationSql(pack.questions,pack.legacy))
    }
    await szRpc(db,actor,'preferences',{canton,alias:`Jugador-${canton}`,include_general:true,include_canton:true,leaderboard_opt_in:false})
    const formats=new Set(),scopes=new Set();let practiceCount=0
    for(let level=1;level<=5;level++){
      await finishGame(db,actor,await szRpc(db,actor,'game_start'))
      const mountain=(await db.query('SELECT suizamente_private.mountain($1) m',[level])).rows[0].m
      for(let node=0;node<mountain.stages.length;node++){
        const session=await szRpc(db,actor,'game_start',{node})
        const selected=(await db.query('SELECT v.payload FROM suizamente_private.sessions s CROSS JOIN LATERAL unnest(s.version_ids) WITH ORDINALITY x(id,pos) JOIN suizamente_private.versions v ON v.id=x.id WHERE s.id=$1 ORDER BY x.pos',[session.id])).rows.map(r=>r.payload)
        selected.forEach(q=>{formats.add(q.game_type||'choice');scopes.add(q.scope)})
        assert.ok(selected.filter(q=>q.game_type==='short').length<=1)
        await finishGame(db,actor,session)
        await db.query("UPDATE suizamente_private.sessions SET created_at=now()-interval '2 hours' WHERE user_id=$1",[actor])
      }
      let summary=await szRpc(db,actor,'summary')
      for(let attempts=0;summary.player.xp<summary.config.thresholds[level-1]&&attempts<20;attempts++){
        await finishGame(db,actor,await szRpc(db,actor,'start',{mode:'practice'}));practiceCount++
        summary=await szRpc(db,actor,'summary')
      }
      assert.ok(summary.player.xp>=summary.config.thresholds[level-1],`${canton}: level ${level} must be reachable with legitimate XP`)
      await db.query("UPDATE suizamente_private.sessions SET day_key=day_key-10 WHERE user_id=$1 AND mode='summit'",[actor])
      const summit=await szRpc(db,actor,'game_start',{node:mountain.stages.length})
      assert.equal((await finishGame(db,actor,summit)).ascent_passed,true)
      await db.query("UPDATE suizamente_private.sessions SET created_at=now()-interval '2 hours' WHERE user_id=$1",[actor])
    }
    assert.ok(formats.has('image')&&formats.has('match')&&formats.has('order'),`${canton}: visual and interactive formats must actually be selected`)
    assert.ok(scopes.has('CH')&&scopes.has('canton'))
    assert.equal((await szRpc(db,actor,'summary')).player.route_completed,true)
    console.log(`Balance ${canton}: all five summits reachable; ${formats.size} formats; ${practiceCount} additional practice sessions.`)
  }
  await db.close();db=await createSuizamenteDb({game:true})
  // A controlled pool isolates the selector's guarantees from random content.
  await db.exec('UPDATE suizamente_private.versions SET annulled=true')
  for(const scope of ['CH','canton'])for(const category of ['salud','sociedad'])for(const kind of ['choice','image','tf','match','multi','order','false','short']){
    const q={id:`fixture-${scope.toLowerCase()}-${category}-${kind}`,category,difficulty:3,scope,canton:scope==='canton'?'ZH':null,language:'es',status:'published',prompt:`Pregunta de prueba ${scope} ${category} ${kind}`,options:kind==='short'?[]:kind==='tf'?['Verdadero','Falso']:['Uno','Dos','Tres','Cuatro'],correct_index:0,explanation:'Explicación de prueba local.',source_url:'https://www.ch.ch/',source_title:'Fixture local',reviewed_at:'2026-11-17',game_type:kind,game_only:true}
    if(kind==='multi')q.correct_indices=[0,2]
    if(kind==='match')q.pairs=['Primero','Segundo','Tercero','Cuarto']
    if(kind==='order')q.correct_order=[0,1,2,3]
    if(kind==='short'){q.accepted_answers=['12'];q.max_length=2}
    if(kind==='image')q.image_key='pet'
    await db.query('SELECT suizamente_private.write_question($1::jsonb)',[JSON.stringify(q)])
  }
  await szRpc(db,SZ_ALICE,'preferences',{canton:'ZH',alias:'MezclaTest',include_general:true,include_canton:true,leaderboard_opt_in:false})
  await db.query('UPDATE suizamente_private.players SET level=3 WHERE user_id=$1',[SZ_ALICE])
  await db.query('INSERT INTO suizamente_private.trail_nodes(user_id,level,node) VALUES($1,3,-1)',[SZ_ALICE])
  const session=await szRpc(db,SZ_ALICE,'game_start',{node:0})
  const selected=(await db.query('SELECT v.payload FROM suizamente_private.sessions s CROSS JOIN LATERAL unnest(s.version_ids) WITH ORDINALITY x(id,pos) JOIN suizamente_private.versions v ON v.id=x.id WHERE s.id=$1 ORDER BY x.pos',[session.id])).rows.map(r=>r.payload)
  assert.equal(new Set(selected.map(q=>q.game_type)).size,7,'All seven non-typing formats participate when available')
  assert.deepEqual(selected.flatMap((q,i)=>q.scope==='canton'?[i]:[]),[3,6],'Canton questions are distributed, not grouped at the end')
  assert.ok(selected.filter((q,i)=>i%2===0&&q.category==='salud').length>=3,'The stage keeps its main subject')
  console.log('Variety: rotating seven-format selection, canton interleaving, rare typing and stage subject passed.')
}finally{await db?.close()}
