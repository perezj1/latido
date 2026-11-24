import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
import {createSuizamenteDb,szRpc,SZ_ALICE,SZ_BOB} from './lib/suizamente-test-db.mjs'

const db=await createSuizamenteDb({game:true})
async function communityRpc(db,actor,action,args={}){
  return db.transaction(async tx=>{
    await tx.query("SELECT set_config('test.uid',$1,true)",[actor||''])
    await tx.exec(`SET LOCAL ROLE ${actor?'authenticated':'anon'}`)
    return (await tx.query('SELECT public.suizamente_community($1,$2::jsonb) result',[action,JSON.stringify(args)])).rows[0].result
  })
}
try{
  const migration=await readFile('supabase/suizamente_community.sql','utf8')
  const empty=new PGlite()
  try{
    await assert.rejects(empty.exec(migration),error=>{
      assert.equal(error.message,'Suizamente no está instalado en esta base de datos.')
      assert.match(error.hint,/suizamente_revision_completa_01.sql/)
      return true
    })
    await empty.exec('ROLLBACK')
    assert.equal((await empty.query("SELECT to_regnamespace('suizamente_private') AS schema")).rows[0].schema,null)
    await empty.exec('CREATE SCHEMA suizamente_private')
    await assert.rejects(empty.exec(migration),/La instalación principal de Suizamente está incompleta o desactualizada/)
    await empty.exec('ROLLBACK')
    assert.equal((await empty.query("SELECT to_regclass('suizamente_private.players') AS players")).rows[0].players,null)
  }finally{await empty.close()}
  await db.exec(migration);await db.exec(migration)
  await communityRpc(db,SZ_ALICE,'profile',{country:'CO',years:'1_3'})
  const player=(await szRpc(db,SZ_ALICE,'summary')).player
  assert.equal(player.community_country,'CO');assert.equal(player.community_years,'1_3')
  await assert.rejects(communityRpc(db,SZ_ALICE,'profile',{country:'XX'}),/SZ_INVALID_REQUEST/)
  await assert.rejects(communityRpc(db,SZ_ALICE,'profile',{years:'99'}),/SZ_INVALID_REQUEST/)
  await assert.rejects(communityRpc(db,null,'profile',{}),/permission denied/)
  const v=(await db.query("SELECT id FROM suizamente_private.versions WHERE payload->>'game_type'='choice' AND NOT annulled LIMIT 1")).rows[0]
  async function vote(user,canonical=0,order=[0,1,2,3],{skip=false,version=v.id,response=null}={}){
    const s=(await db.query(`INSERT INTO suizamente_private.sessions(user_id,mode,day_key,week_key,level,version_ids,option_orders,rules)
      VALUES($1,'practice',current_date,current_date,1,ARRAY[$2::bigint],jsonb_build_object($2::text,$3::jsonb),'{}') RETURNING id`,[user,version,JSON.stringify(order)])).rows[0]
    await db.query(`INSERT INTO suizamente_private.answers(session_id,position,version_id,user_id,choice,correct,skipped,response)
      VALUES($1,0,$2,$3,$4,true,$5,$6::jsonb)`,[s.id,version,user,Math.max(0,order.indexOf(canonical)),skip,JSON.stringify(response)])
    return {session_id:s.id,position:0}
  }
  const current=await vote(SZ_ALICE,0,[3,2,1,0])
  assert.deepEqual((await communityRpc(db,SZ_ALICE,'stats',current)).country,[])
  for(let i=1;i<=5;i++){
    const user=`aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12,'0')}`
    await db.query('INSERT INTO auth.users(id) VALUES($1)',[user])
    await db.query('INSERT INTO public.profiles(id) VALUES($1)',[user])
    await communityRpc(db,user,'profile',{country:'CO',years:'1_3'})
    await vote(user,i<=2?0:1)
    if(i===5)await db.query('UPDATE public.profiles SET banned=true WHERE id=$1',[user])
  }
  let stats=await communityRpc(db,SZ_ALICE,'stats',current)
  assert.deepEqual(stats.country,[{id:'CO',percent:60}],'Stable indices, first vote, banned user excluded')
  assert.deepEqual(stats.years,[{id:'1_3',percent:60}])
  for(let i=0;i<6;i++)await vote(SZ_ALICE,1)
  assert.deepEqual(await communityRpc(db,SZ_ALICE,'stats',current),stats,'Practice cannot inflate counts')
  await communityRpc(db,SZ_BOB,'profile',{country:'CO',years:'1_3'})
  const skipped=await vote(SZ_BOB,1,[0,1,2,3],{skip:true})
  assert.deepEqual((await communityRpc(db,SZ_BOB,'stats',skipped)).country,[])
  assert.deepEqual(await communityRpc(db,SZ_ALICE,'stats',current),stats,'Skipped answers excluded')
  await assert.rejects(communityRpc(db,SZ_BOB,'stats',current),/SZ_SESSION_NOT_FOUND/)
  const unanswered=await szRpc(db,SZ_BOB,'game_start')
  await assert.rejects(communityRpc(db,SZ_BOB,'stats',{session_id:unanswered.id,position:0}),/SZ_INVALID_REQUEST/)
  await assert.rejects(db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE authenticated');await tx.query('SELECT * FROM suizamente_private.players')}),/permission denied/)
  await communityRpc(db,SZ_ALICE,'profile',{country:null,years:null})
  stats=await communityRpc(db,SZ_ALICE,'stats',current)
  assert.deepEqual(stats.country,[],'Withdrawing optional data removes it from aggregates')
  assert.deepEqual(stats.years,[])
  // A different version of a question must never join the existing sample.
  const changed=(await db.query(`INSERT INTO suizamente_private.versions(question_id,version,payload)
    SELECT question_id,version+1000,payload FROM suizamente_private.versions WHERE id=$1 RETURNING id`,[v.id])).rows[0]
  const other=await vote(SZ_BOB,0,[0,1,2,3],{version:changed.id})
  assert.deepEqual((await communityRpc(db,SZ_BOB,'stats',other)).country,[])
  // Multiple selections compare canonical arrays, independent of display order.
  const multi=(await db.query("SELECT id FROM suizamente_private.versions WHERE payload->>'game_type'='multi' AND NOT annulled LIMIT 1")).rows[0]
  const m=await vote(SZ_ALICE,0,[3,2,1,0],{version:multi.id,response:[0,2]})
  await communityRpc(db,SZ_ALICE,'profile',{country:'ES',years:'10_plus'})
  for(let i=1;i<=4;i++){
    const user=`aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12,'0')}`
    await communityRpc(db,user,'profile',{country:'ES',years:'10_plus'})
    await vote(user,0,[0,1,2,3],{version:multi.id,response:i<=2?[0,2]:[1,2]})
  }
  assert.deepEqual((await communityRpc(db,SZ_ALICE,'stats',m)).country,[{id:'ES',percent:60}])
  console.log('Community statistics: canonical choices, multi answers, one vote, exclusions, minimum sample, withdrawal, version isolation, ownership and permissions passed.')
}finally{await db.close()}
