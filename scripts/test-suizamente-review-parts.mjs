import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createSuizamenteDb,szRpc,SZ_ALICE} from './lib/suizamente-test-db.mjs'
import {loadContentPack,publicationSql} from './lib/suizamente-content-pack.mjs'
import {gameAnswer} from './test-suizamente-game.mjs'

const read=p=>readFile(p,'utf8')
const files=await Promise.all([1,2,3,4].map(n=>read(`supabase/suizamente_revision_completa_0${n}.sql`)))
const full=await read('supabase/suizamente_revision_completa.sql')
const payload=(sql,tag)=>JSON.parse(sql.match(new RegExp(`\\$${tag}\\$([\\s\\S]*?)\\$${tag}\\$`))[1])
const allTargets=payload(full,'review_bank'),allCatalog=payload(full,'review_catalog')
const sort=rows=>rows.toSorted((a,b)=>a.id.localeCompare(b.id))
assert.deepEqual(files.flatMap(sql=>payload(sql,'review_bank')),allTargets,'Four files contain the exact complete bank, once each')
assert.deepEqual(sort(files.flatMap(sql=>payload(sql,'review_catalog'))),sort(allCatalog),'Every catalogue entry travels with its question')
for(const [i,file]of files.entries()){
  assert.ok(Buffer.byteLength(file)<700000,`Small part ${i+1}`)
  assert.equal(/^BEGIN;/gm.exec(file)?.[0],'BEGIN;')
  assert.match(file,/COMMIT;\s*$/)
  assert.ok(!/sz_review_result|CREATE TEMP TABLE/i.test(file),'No dependency on temporary tables')
  const ids=new Set(payload(file,'review_bank').map(item=>item.question.id))
  assert.ok(payload(file,'review_catalog').every(row=>ids.has(row.id)))
}
const currentSql='SELECT q.id,v.payload FROM suizamente_private.questions q JOIN suizamente_private.versions v ON v.question_id=q.id AND v.version=q.current_version ORDER BY q.id'
const current=async db=>(await db.query(currentSql)).rows
const versions=async db=>(await db.query('SELECT count(*)::int n FROM suizamente_private.versions')).rows[0].n
async function playerState(db){
  const result={}
  for(const table of ['players','sessions','answers','progress','rewards','trail_nodes','trail_days'])result[table]=(await db.query(`SELECT coalesce(jsonb_agg(row ORDER BY row::text),'[]') data FROM (SELECT to_jsonb(t) row FROM suizamente_private.${table} t) s`)).rows[0].data
  return result
}
async function committedImport(db,file,{schema=false}={}){
  if(schema)await db.exec(file.split('-- END_REVIEW_SCHEMA')[0]+'\nCOMMIT;')
  const body=file.split('-- END_REVIEW_SCHEMA')[1]
  const helper=body.slice(body.indexOf('CREATE OR REPLACE FUNCTION'),body.indexOf('-- BEGIN_REVIEW_CALL'))
  const call=body.split('-- BEGIN_REVIEW_CALL')[1].split('-- END_REVIEW_CALL')[0]
  await db.exec(helper);await db.exec('DISCARD TEMP')
  return db.exec(call)
}
let db
try{
  db=await createSuizamenteDb({game:true})
  // Reproduce the old failure if a client commits statements individually.
  await db.exec('CREATE TEMP TABLE sz_review_result(id text) ON COMMIT DROP;')
  await assert.rejects(db.query('SELECT * FROM sz_review_result'),error=>error.code==='42P01')
  for(const [index,file]of files.entries()){
    await committedImport(db,file,{schema:index===0})
    const n=await versions(db);await db.exec(file);assert.equal(await versions(db),n,'Each part is individually repeatable')
    assert.equal((await db.query("SELECT count(*)::int n FROM pg_tables WHERE tablename='sz_review_result'")).rows[0].n,0,'No connection-local state survives COMMIT')
  }
  assert.deepEqual((await current(db)).map(row=>row.payload),allTargets.map(item=>item.question).toSorted((a,b)=>a.id.localeCompare(b.id)))
  const catalog=(await db.query('SELECT question_id AS id,topic,national,original_prompt,prompt FROM suizamente_private.trivia_catalog')).rows
  assert.deepEqual(sort(catalog),sort(allCatalog),'Same catalogue as the complete installer')
  const n=await versions(db);for(const file of files)await db.exec(file);assert.equal(await versions(db),n)
  for(const role of ['anon','authenticated'])assert.equal((await db.query("SELECT has_function_privilege($1,'suizamente_private.import_review_14(jsonb,jsonb)','EXECUTE') allowed",[role])).rows[0].allowed,false)
  await db.close()

  db=await createSuizamenteDb({game:true})
  const pack=await loadContentPack()
  await db.exec(publicationSql(pack.questions,pack.legacy))
  await db.exec(await read('supabase/suizamente_actualizacion_trivial_13.sql'))
  await db.exec(await read('supabase/suizamente_trivia_preguntas_13.sql'))
  let session=await szRpc(db,SZ_ALICE,'game_start')
  session=await gameAnswer(db,SZ_ALICE,session)
  const custom={...pack.questions.find(q=>q.id==='szx-zh-plato-ternera'),status:'published',prompt:'Pregunta propia del administrador: conservar esta edición.'}
  await db.query('SELECT suizamente_private.write_question($1::jsonb)',[JSON.stringify(custom)])
  const before=await playerState(db),oldVersions=(await db.query('SELECT * FROM suizamente_private.versions ORDER BY id')).rows
  const omitted=[]
  for(const file of files){
    const results=await db.exec(file)
    omitted.push(...results.flatMap(r=>r.rows||[]).filter(r=>r.result==='skipped_custom_edit').flatMap(r=>r.omitted_ids))
    assert.deepEqual(await playerState(db),before,'Every part preserves all player state')
  }
  assert.deepEqual(omitted,[custom.id])
  assert.deepEqual((await db.query('SELECT * FROM suizamente_private.versions WHERE id=ANY($1::bigint[]) ORDER BY id',[oldVersions.map(v=>v.id)])).rows,oldVersions)
  assert.deepEqual(await szRpc(db,SZ_ALICE,'session',{id:session.id}),session)
  const installed=await current(db)
  assert.equal(installed.find(q=>q.id===custom.id).payload.prompt,custom.prompt)
  const n2=await versions(db)
  for(const file of files)await db.exec(file)
  assert.equal(await versions(db),n2);assert.deepEqual(await current(db),installed)
  assert.deepEqual(await playerState(db),before)
  // Execute the import definition, permissions and call in separate committed
  // requests. Discard temporary objects between them to emulate session changes.
  for(const file of files)await committedImport(db,file)
  assert.equal(await versions(db),n2);assert.deepEqual(await current(db),installed)
  assert.deepEqual(await playerState(db),before)
  // A data error rolls back the entire question+catalogue call without relying
  // on an outer transaction supplied by the editor.
  const first=allTargets.find(item=>item.question.id!==custom.id)
  const badItems=[{...first,question:{...first.question,id:'sz-test-atomic-review'}},{question:{id:'bad-review-question'},known:[]}]
  await assert.rejects(db.query('SELECT * FROM suizamente_private.import_review_14($1::jsonb,$2::jsonb)',[JSON.stringify(badItems),'[]']),/SZ_INVALID_QUESTION/)
  assert.equal(await versions(db),n2);assert.deepEqual(await current(db),installed)
  console.log('Four SQL parts: exact bank/catalogue, reproduced 42P01, no temporary dependency, separate committed requests, atomic imports, restricted permissions, safe retries and preserved player/admin state passed.')
}finally{await db?.close()}
