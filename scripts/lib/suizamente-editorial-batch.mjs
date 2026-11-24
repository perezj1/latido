import {readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'

// Explicit, reviewed batches only. This helper never invents source reviews or
// turns a successful HTTP response into a verified claim.
export async function editorialBatch(territory,reviewedSources,preserveIds=[],reuseIds={}){
  const root=new URL('../../supabase/seed-data/suizamente-expansion/',import.meta.url)
  if(Object.keys(reuseIds).length){
    const reused=JSON.parse(await readFile(new URL('reused-questions.json',root),'utf8'))
    Object.assign(reused,reuseIds)
    await writeFile(new URL('reused-questions.json',root),JSON.stringify(reused,null,2)+'\n')
  }
  const sources=JSON.parse(await readFile(new URL('sources.json',root),'utf8'))
  for(const source of reviewedSources){
    assert.ok(source.review_note&&source.locator&&source.opened_at)
    const i=sources.findIndex(s=>s.id===source.id),entry={...source,review_status:'checked'}
    if(i<0)sources.push(entry);else sources[i]=entry
  }
  await writeFile(new URL('sources.json',root),JSON.stringify(sources,null,2)+'\n')
  const {checked,saveTerritory}=await import('./suizamente-expansion-author.mjs')
  const current=JSON.parse(await readFile(new URL('questions.json',root),'utf8'))
  const preserved=current.filter(q=>q.territory===territory&&preserveIds.includes(q.id))
  assert.equal(preserved.length,preserveIds.length,'All previous entries must be preserved')
  return {
    q:(key,topic,type,diff,prompt,options,solution,explanation,refs,extra={})=>checked(territory,key,topic,type,diff,prompt,options,solution,explanation,refs,{reviewed_at:'2026-11-17',verified_at:'2026-11-17',next_review_at:['derechos','tramites','convivencia','movilidad'].includes(topic)?'2027-02-17':'2027-11-17',...(type==='image'?{image_rights:'Ilustración SVG original de Latido; sin fotografías, marcas comerciales ni recursos externos.'}:{}),...extra}),
    async save(added){assert.equal(preserved.length+added.length,50);await saveTerritory(territory,[...preserved,...added])},
  }
}
