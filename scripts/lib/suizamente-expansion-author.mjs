// Editorial build helper. Sources must be opened AND their relevant claim read.
// An HTTP 200 or search-engine snippet alone never establishes verification.
import assert from 'node:assert/strict'
import {readFile,writeFile} from 'node:fs/promises'

export const root=new URL('../../supabase/seed-data/suizamente-expansion/',import.meta.url)
export const sourceList=JSON.parse(await readFile(new URL('sources.json',root),'utf8'))
const reused=JSON.parse(await readFile(new URL('reused-questions.json',root),'utf8'))
const legacy=new Map(JSON.parse(await readFile(new URL('../suizamente-questions.json',root),'utf8')).map(q=>[q.id,q]))
const sources=new Map(sourceList.map(s=>[s.id,s]))
const category={convivencia:'vivienda',derechos:'administracion',tramites:'administracion',idioma:'idioma',cultura:'sociedad',naturaleza:'sociedad',movilidad:'sociedad'}
export function checked(territory,key,topic,type,difficulty,prompt,options,solution,explanation,sourceIds,extra={}){
  assert.ok([1,2,3].includes(difficulty),'Editorial difficulty must be easy, medium or hard')
  const refs=sourceIds.split('|').map(id=>{
    const source=sources.get(id)
    assert.equal(source?.review_status,'checked',`Source ${id} requires a substantive review`)
    return {id,url:source.url,title:source.title,authority:source.authority,checked_at:source.opened_at,locator:source.locator}
  })
  const q={id:`szx-${territory.toLowerCase()}-${key}`,collection:'suizamente-integration-1350-v1',territory,scope:territory==='CH'?'CH':'canton',canton:territory==='CH'?null:territory,topic,category:category[topic],difficulty,language:'es',game_type:type,prompt,options,explanation,sources:refs,source_url:refs[0].url,source_title:refs[0].title,reviewed_at:'2026-11-13',verified_at:'2026-11-13',validation_status:'verified',needs_periodic_review:['derechos','tramites','convivencia','movilidad'].includes(topic),next_review_at:['derechos','tramites','convivencia','movilidad'].includes(topic)?'2027-02-13':'2027-11-13',concept_id:`${territory}:${key}`,status:'prepared',...extra}
  q.difficulty=[0,1,3,5][difficulty]
  q.editorial_difficulty=['','facil','media','dificil'][difficulty]
  if(reused[q.id]){
    q.reuses_question_id=reused[q.id];q.editorial_id=q.id;q.id=reused[q.id]
    assert.ok(legacy.has(q.id),`Unknown reused question ${q.id}`)
    q.category=legacy.get(q.id).category
  }
  if(type!=='choice')q.game_only=true
  if(type==='multi'){q.correct_indices=solution;q.correct_index=solution[0]}
  else if(type==='order'){q.correct_order=solution;q.correct_index=0}
  else if(type==='short'){q.accepted_answers=solution;q.correct_index=0}
  else if(type==='match'){q.pairs=solution;q.correct_index=0}
  else q.correct_index=solution
  return q
}
export async function saveTerritory(territory,questions){
  assert.ok(questions.every(q=>q.territory===territory))
  const current=JSON.parse(await readFile(new URL('questions.json',root),'utf8'))
  const next=[...current.filter(q=>q.territory!==territory),...questions]
  await writeFile(new URL('questions.json',root),JSON.stringify(next,null,2)+'\n','utf8')
  console.log(`${territory}: ${questions.length}; collection: ${next.length}`)
}
