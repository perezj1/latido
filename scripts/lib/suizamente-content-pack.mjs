import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {IMG} from '../../src/components/suizamente/questionArt.js'
import {isStatement} from '../../src/lib/suizamenteQuestionText.js'

const base=new URL('../../supabase/seed-data/suizamente-expansion/',import.meta.url)
const normalize=s=>s.normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('es')
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s
const zurichToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Zurich',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
export async function loadContentPack(){
  const [manifest,questions,sources,legacy]=await Promise.all(['manifest.json','questions.json','sources.json'].map(async name=>JSON.parse(await readFile(new URL(name,base),'utf8'))).concat([readFile(new URL('../../supabase/seed-data/suizamente-questions.json',import.meta.url),'utf8').then(JSON.parse)]))
  return {manifest,questions,sources,legacy}
}
export function validateContentPack({manifest,questions,sources,legacy},{today=zurichToday()}={}){
  const ids=new Set(),prompts=new Set(),concepts=new Set(),sourceMap=new Map(sources.map(s=>[s.id,s])),legacyIds=new Set(legacy.map(q=>q.id))
  const formats=['choice','multi','tf','match','order','image','short'],topics=Object.keys(manifest.topics),reviewDue=[],upcoming=[],errors=[],warnings=[]
  const counts=Object.fromEntries(manifest.territories.map(t=>[t,{total:0,formats:Object.fromEntries(Object.keys(manifest.formats_per_territory).map(f=>[f,0])),topics:Object.fromEntries(topics.map(c=>[c,0])),difficulty:{facil:0,media:0,dificil:0}}]))
  for(const q of questions){
    try{
      const require=(condition,message)=>assert.ok(condition,`${q.id}: ${message}`)
      require(/^[a-z0-9][a-z0-9_-]{2,100}$/.test(q.id),'invalid ID');require(!ids.has(q.id),'duplicate ID');ids.add(q.id)
      require(counts[q.territory],'unknown territory');require(q.collection===manifest.id,'unknown collection')
      require(topics.includes(q.topic),'unknown topic');require(formats.includes(q.game_type),'unknown format')
      require(q.scope===(q.territory==='CH'?'CH':'canton')&&q.canton===(q.territory==='CH'?null:q.territory),'territory/scope mismatch')
      require([1,3,5].includes(q.difficulty),'difficulty must map to one of the three editorial tiers')
      require(['facil','media','dificil'].includes(q.editorial_difficulty),'missing editorial tier')
      require(q.validation_status==='verified'&&q.status==='prepared','unverified or unexpected status')
      require(q.verified_at===q.reviewed_at&&validDate(q.verified_at)&&q.verified_at<=today,'invalid verification date')
      require(typeof q.prompt==='string'&&q.prompt.length>=8&&q.prompt.length<=700,'invalid prompt')
      require(typeof q.explanation==='string'&&q.explanation.length>=8&&q.explanation.length<=2500,'missing explanation')
      require(!prompts.has(normalize(q.prompt)),'duplicate prompt');prompts.add(normalize(q.prompt))
      require(q.concept_id&&!concepts.has(q.concept_id),'duplicate concept');concepts.add(q.concept_id)
      require(Array.isArray(q.options),'missing options')
      const size=q.options.length
      require(new Set(q.options.map(normalize)).size===size,'duplicate options')
      require(q.options.every(s=>typeof s==='string'&&s.trim()&&s.length<=500),'invalid option')
      if(['choice','multi','image'].includes(q.game_type))require(size===4,'selection/image must have four options')
      if(q.game_type==='tf'){require(size===2,'true/false requires two options');require(isStatement(q.prompt),'true/false requires a declarative statement')}
      if(q.game_type==='multi')require(Array.isArray(q.correct_indices)&&q.correct_indices.length>=1&&q.correct_indices.length<=4&&new Set(q.correct_indices).size===q.correct_indices.length&&q.correct_indices.every(i=>Number.isInteger(i)&&i>=0&&i<size),'invalid correct choices')
      else if(q.game_type==='match')require(size===4&&q.pairs?.length===4&&q.pairs.every(s=>typeof s==='string'&&s.trim())&&new Set(q.pairs.map(normalize)).size===4,'invalid matching pairs')
      else if(q.game_type==='order')require(size>=3&&size<=8&&q.correct_order?.length===size&&new Set(q.correct_order).size===size&&q.correct_order.every(i=>Number.isInteger(i)&&i>=0&&i<size),'order must be a full permutation')
      else if(q.game_type==='short')require(size===0&&q.accepted_answers?.length>0&&q.accepted_answers.length<=12&&q.accepted_answers.every(s=>typeof s==='string'&&s.trim()&&s.length<=(q.max_length||80)),'invalid accepted short answers')
      else require(Number.isInteger(q.correct_index)&&q.correct_index>=0&&q.correct_index<size,'invalid correct index')
      if(q.game_type==='image')require(typeof IMG[q.image_key]==='function'&&q.image_rights&&q.image_alt,'missing actual artwork, rights or accessible description')
      require(q.sources?.length>0,'missing sources')
      for(const ref of q.sources){const source=sourceMap.get(ref.id);require(source?.review_status==='checked'&&source.url===ref.url&&source.locator&&source.review_note&&ref.checked_at===source.opened_at&&source.opened_at<=q.verified_at,'source has not been substantively reviewed');require(new URL(ref.url).protocol==='https:','source must use HTTPS')}
      require(q.source_url===q.sources[0].url&&q.source_title===q.sources[0].title,'primary source mismatch')
      require(validDate(q.next_review_at)&&q.next_review_at>=q.verified_at,'missing next review date')
      if(q.next_review_at<=today)reviewDue.push(q.id)
      else if(Date.parse(q.next_review_at)-Date.parse(today)<=30*86400000)upcoming.push(q.id)
      if(q.reuses_question_id){
        require(q.id===q.reuses_question_id&&legacyIds.has(q.id),'invalid legacy reuse')
        require(q.category===legacy.find(old=>old.id===q.id).category,'reused question changed its statistical category')
      }
      else require(!legacyIds.has(q.id),'unreviewed legacy collision')
      const c=counts[q.territory];c.total++;c.formats[['choice','multi'].includes(q.game_type)?'selection':q.game_type]++;c.topics[q.topic]++;c.difficulty[q.editorial_difficulty]++
    }catch(e){errors.push(e.message)}
  }
  const missing=manifest.territories.flatMap(t=>{
    const c=counts[t],issues=[]
    if(c.total!==50)issues.push(`${t}: ${c.total}/50`)
    for(const [f,n]of Object.entries(manifest.formats_per_territory))if(c.formats[f]!==n)issues.push(`${t}/${f}: ${c.formats[f]}/${n}`)
    return issues
  })
  if(reviewDue.length)warnings.push(`${reviewDue.length} entries are due for a new substantive review`)
  return {reference_date:today,target_total:manifest.target_total,prepared_total:questions.length,structurally_valid_total:Object.values(counts).reduce((n,c)=>n+c.total,0),remaining:Math.max(0,manifest.target_total-questions.length),complete:!errors.length&&!missing.length&&!reviewDue.length,counts,errors,missing,warnings,review_due:reviewDue,review_next_30_days:upcoming,reused_ids:questions.filter(q=>q.reuses_question_id).map(q=>q.id),keyboard_percentage:questions.length?questions.filter(q=>q.game_type==='short').length/questions.length*100:0,limitations:['La estructura, los recuentos y la presencia de fuentes se comprueban automáticamente. La pertinencia de las fuentes, las traducciones y la ausencia de duplicados semánticos requieren revisión editorial.','El informe no equipara tener un enlace con haber contrastado una afirmación. La revisión sustantiva se registra separadamente en sources.json.']}
}
export function solution(q){
  if(q.game_type==='multi')return q.correct_indices.map(i=>q.options[i]).join(' · ')
  if(q.game_type==='match')return q.options.map((s,i)=>`${s} → ${q.pairs[i]}`).join('; ')
  if(q.game_type==='order')return q.correct_order.map(i=>q.options[i]).join(' → ')
  if(q.game_type==='short')return q.accepted_answers.join(' / ')
  return q.options[q.correct_index]
}
export function publicationSql(questions,legacy){
  const old=new Map(legacy.map(q=>[q.id,q])),literal=(value,tag)=>{const s=JSON.stringify(value);assert.ok(!s.includes(`$${tag}$`));return `$${tag}$${s}$${tag}$::jsonb`}
  return ['-- Banco privado. No importar este archivo en el cliente.','-- Ejecutar después de suizamente.sql, suizamente_game.sql y del seed inicial.','-- Identificadores y versiones estables; aborta si una pregunta existente fue editada fuera de este paquete.','BEGIN;',...questions.map(q=>{
    const target={...q,status:'published'},expected=old.get(q.id)
    return `DO $sz_import$ DECLARE current_payload jsonb; target jsonb:=${literal(target,'sz_target')}; BEGIN\n  IF (target->>'next_review_at')::date <= (now() AT TIME ZONE 'Europe/Zurich')::date THEN RAISE EXCEPTION 'SZ_CONTENT_REVIEW_DUE'; END IF;\n  PERFORM pg_advisory_xact_lock(hashtext('sz-question-${q.id}'));\n  SELECT v.payload INTO current_payload FROM suizamente_private.questions q JOIN suizamente_private.versions v ON v.question_id=q.id AND v.version=q.current_version WHERE q.id='${q.id}';\n  IF current_payload=target THEN RETURN; END IF;\n  IF current_payload IS NOT NULL${expected?` AND current_payload<>${literal(expected,'sz_expected')}`:''} THEN RAISE EXCEPTION 'SZ_CONTENT_CONFLICT: ${q.id}'; END IF;\n  PERFORM suizamente_private.write_question(target);\nEND $sz_import$;`
  }),"NOTIFY pgrst,'reload schema';",'COMMIT;',''].join('\n')
}
