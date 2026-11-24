import assert from 'node:assert/strict'
import {readFile,writeFile,readdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {PGlite} from '@electric-sql/pglite'
import * as editorial from './lib/suizamente-editorial-revision.mjs'
import {IMG} from '../src/components/suizamente/questionArt.js'
import {isStatement,questionStatement} from '../src/lib/suizamenteQuestionText.js'

const read=path=>readFile(path,'utf8'),json=async path=>JSON.parse(await read(path))
const base=await json('supabase/seed-data/suizamente-questions.json')
const expansion=await json('supabase/seed-data/suizamente-expansion/questions.json')
const trivia=await json('supabase/seed-data/suizamente-trivia.json')
const legacy=await json('supabase/seed-data/suizamente-presentation.json')
export function normalize(q){
  const p={...q,status:q.status==='retired'?'retired':'published'}
  if(p.scope==='CH')p.canton=null
  if((p.game_type||'choice')!=='choice'||p.arrival_level)p.game_only=true
  return p
}
const originals=new Map([...base,...expansion,...trivia.questions,...trivia.refinements].map(q=>[q.id,normalize(q)]))
const catalog=new Map(trivia.catalog.map(q=>[q.id,q]))
const known=[]
// Released SQL is immutable. Recognise the exact published payloads, including
// earlier versions, but never overwrite a different administrator-authored edit.
for(const file of await readdir('supabase'))if(/^suizamente.*\.sql$/.test(file)&&!file.startsWith('suizamente_revision_completa')){
  const sql=await read(`supabase/${file}`)
  for(const m of sql.matchAll(/\$(sz_target|sz_expected|sz_question)\$(\{[^\n]*?\})\$\1\$/g))known.push(normalize(JSON.parse(m[2])))
}
known.push(...base.map(normalize),...expansion.map(normalize),...trivia.questions.map(normalize),...trivia.refinements.map(normalize))
for(const entry of legacy.entries){
  const q=originals.get(entry.id);assert.ok(q,entry.id)
  known.push(normalize({...q,prompt:entry.original_prompt}),normalize({...q,prompt:entry.original_prompt.replaceAll('\n','\r\n')}))
}
for(const [key,values]of Object.entries(editorial)){
  for(const id of Array.isArray(values)?values:Object.keys(values))assert.ok(originals.has(id),`${key}: unknown ID ${id}`)
}
const reviewed=[],decisions=[]
for(const [id,original]of originals){
  const q=structuredClone(original),reasons=[]
  const entry=catalog.get(id)
  if(entry&&q.prompt===entry.original_prompt&&q.prompt!==entry.prompt){q.prompt=entry.prompt;reasons.push('Enunciado breve del catálogo cultural incorporado al banco')}
  if(q.game_type==='tf'&&q.prompt!==questionStatement(q)){q.prompt=questionStatement(q);reasons.push('Afirmación directa en verdadero o falso')}
  if(editorial.prompts[id]){q.prompt=editorial.prompts[id];reasons.push('Enunciado directo, contextual o declarativo')}
  if(editorial.optionSets[id]){q.options=editorial.optionSets[id];reasons.push('Opciones comparables y distractores plausibles')}
  if(editorial.wrongChoices[id]){
    assert.equal(editorial.wrongChoices[id].length,3,id)
    let n=0;q.options=q.options.map((option,index)=>index===q.correct_index?option:editorial.wrongChoices[id][n++])
    reasons.push('Distractores relacionados con el tema')
  }
  if(editorial.pairSets[id]){q.pairs=editorial.pairSets[id];reasons.push('Parejas breves y legibles')}
  if(editorial.choiceConversions[id]){
    const [prompt,options]=editorial.choiceConversions[id]
    Object.assign(q,{prompt,options,game_type:'choice',correct_index:0})
    delete q.accepted_answers;delete q.max_length;delete q.normalization
    reasons.push('Cuatro opciones en lugar de escribir cifras')
  }
  if(editorial.extraOptions[id]){q.options=editorial.extraOptions[id];reasons.push('Respuestas coherentes con la pregunta')}
  if(editorial.singleChoiceTranslations.includes(id)){
    assert.equal(q.correct_indices.length,1,id)
    q.correct_index=q.correct_indices[0];q.game_type='choice';delete q.correct_indices
    reasons.push('Una traducción: selección directa sin confirmación adicional')
  }
  if(editorial.patches[id]){
    const {correct_text,...patch}=editorial.patches[id]
    Object.assign(q,patch);if(correct_text)q.options[q.correct_index]=correct_text
    reasons.push(patch.scope==='CH'&&original.scope==='canton'?'Procedencia general para no revelar el cantón de la respuesta':'Enunciado, respuesta y explicación coherentes')
  }
  if(id.endsWith('-canton-portal')){
    q.status='retired';q.replaced_by=`szr-canton-code-${q.canton.toLowerCase()}`
    reasons.push('Sustituida por reconocimiento visual de la sigla cantonal')
  }
  const fields=Object.keys(q).filter(k=>JSON.stringify(q[k])!==JSON.stringify(original[k]))
  for(const k of Object.keys(original))if(!(k in q))fields.push(k)
  if(fields.length)q.editorial_review={date:'2026-11-18',revision:'complete-14',kind:'wording-and-interaction'}
  reviewed.push(q)
  decisions.push({id,decision:q.status==='retired'?'replaced':fields.length?'improved':'retained',fields,reasons:fields.length?reasons:['Revisada: pregunta clara, respuesta verificable y formato adecuado'],before:{prompt:original.prompt,options:original.options,pairs:original.pairs},after:{prompt:q.prompt,options:q.options,pairs:q.pairs},source_url:q.source_url})
}
const names={AG:'Aargau',AI:'Appenzell Innerrhoden',AR:'Appenzell Ausserrhoden',BE:'Bern',BL:'Basel-Landschaft',BS:'Basel-Stadt',FR:'Fribourg',GE:'Genève',GL:'Glarus',GR:'Graubünden',JU:'Jura',LU:'Luzern',NE:'Neuchâtel',NW:'Nidwalden',OW:'Obwalden',SG:'St. Gallen',SH:'Schaffhausen',SO:'Solothurn',SZ:'Schwyz',TG:'Thurgau',TI:'Ticino',UR:'Uri',VD:'Vaud',VS:'Valais',ZG:'Zug',ZH:'Zürich'}
const distractors={AG:['AR','GR','ZG'],AI:['AR','AG','NW'],AR:['AI','AG','OW'],BE:['BL','BS','NE'],BL:['BS','BE','LU'],BS:['BL','BE','SZ'],FR:['GE','VD','VS'],GE:['GL','GR','NE'],GL:['GR','GE','SG'],GR:['GL','GE','TG'],JU:['NE','VD','UR'],LU:['UR','NW','ZH'],NE:['NW','JU','GE'],NW:['OW','NE','LU'],OW:['NW','UR','SZ'],SG:['SH','SZ','ZG'],SH:['SG','SZ','SO'],SO:['SG','SH','SZ'],SZ:['SO','SG','SH'],TG:['SG','ZG','TI'],TI:['TG','UR','VD'],UR:['JU','LU','OW'],VD:['VS','FR','TI'],VS:['VD','FR','GE'],ZG:['ZH','AG','SG'],ZH:['ZG','SH','LU']}
for(const [code,name]of Object.entries(names)){
  const lower=code.toLowerCase(),q={id:`szr-canton-code-${lower}`,collection:'suizamente-complete-review-14',territory:'CH',scope:'CH',canton:null,topic:'cultura',category:'sociedad',difficulty:1,language:'es',status:'published',game_type:'image',game_only:true,prompt:'¿Qué cantón representa esta sigla?',options:[name,...distractors[code].map(c=>names[c])],correct_index:0,explanation:`${code}: ${name}.`,source_url:'https://ws-old.parlament.ch/cantons',source_title:'Parlamento suizo · Cantones y abreviaturas',reviewed_at:'2026-11-18',verified_at:'2026-11-18',validation_status:'verified',next_review_at:'2027-11-18',sources:[{url:'https://ws-old.parlament.ch/cantons',title:'Parlamento suizo · Cantones y abreviaturas',checked_at:'2026-11-18',locator:`Table of Cantons: ${code}`}],image_key:`canton-code-${lower}`,image_alt:`Sigla ${code}`,image_rights:'Ilustración SVG original de Suizamente',replaces:`${lower}-canton-portal`}
  reviewed.push(q);decisions.push({id:q.id,decision:'replacement',replaces:q.replaces,source_url:q.source_url})
  catalog.set(q.id,{id:q.id,topic:'simbolos',national:true,original_prompt:q.prompt,prompt:q.prompt})
  const capital=reviewed.find(q=>q.id===`${lower}-canton-capital`)
  catalog.set(capital.id,{id:capital.id,topic:'lugares',national:true,original_prompt:capital.prompt,prompt:capital.prompt})
}
const languageAdditions=await json('supabase/seed-data/suizamente-language-exercises.json')
for(const addition of languageAdditions){
  assert.ok(!reviewed.some(q=>q.id===addition.id),addition.id)
  const q=normalize(addition)
  reviewed.push(q);known.push(q)
  decisions.push({id:q.id,decision:'added',reasons:['Ejercicio original de vocabulario cotidiano con fuente léxica contrastada'],source_url:q.source_url})
}
for(const q of reviewed){
  assert.ok(q.prompt.length>=8&&q.prompt.length<=700,q.id)
  assert.ok(q.explanation.length>=8&&q.explanation.length<=2500,q.id)
  assert.match(q.source_url,/^https:\/\/\S+$/,q.id)
  if(q.game_type==='tf')assert.ok(isStatement(q.prompt),`${q.id}: statement required`)
  if(q.game_type==='image'){assert.ok(IMG[q.image_key],q.id);assert.equal(q.options.length,4,q.id)}
  if(q.game_type==='match'){assert.equal(q.pairs.length,4,q.id);assert.equal(new Set(q.pairs).size,4,q.id)}
  if(q.game_type==='short')assert.ok(q.accepted_answers.length,q.id)
  else assert.ok(q.correct_index>=0&&q.correct_index<q.options.length,q.id)
  assert.equal(new Set(q.options.map(x=>x.toLowerCase().trim())).size,q.options.length,`${q.id}: duplicate options`)
  if(q.game_type==='multi')assert.ok(q.correct_indices.length>=1&&q.correct_indices.length<=4&&q.correct_indices.every(i=>i>=0&&i<q.options.length),q.id)
  const entry=catalog.get(q.id)
  if(entry)catalog.set(q.id,{...entry,original_prompt:q.prompt,prompt:q.prompt})
}
// PostgreSQL's JSONB text ordering is authoritative for comparisons with installed
// data. Hashes from JS JSON.stringify would not match jsonb::text.
const db=new PGlite(),fingerprints={}
try{
  const rows=(await db.query('SELECT value->>\'id\' id,md5(value::text) hash FROM jsonb_array_elements($1::jsonb)',[JSON.stringify(known)])).rows
  for(const {id,hash}of rows)(fingerprints[id]||=new Set()).add(hash)
}finally{await db.close()}
const targets=reviewed.map(question=>({question,known:[...(fingerprints[question.id]||[])]}))
const schema=(await Promise.all(['supabase/suizamente.sql','supabase/suizamente_game.sql'].map(read))).map(s=>s.replaceAll('\r\n','\n').replace(/^BEGIN;\s*$/m,'').replace(/^COMMIT;\s*$/m,'')).join('\n')
const literal=(x,tag)=>{const s=JSON.stringify(x);assert.ok(!s.includes(`$${tag}$`));return `$${tag}$${s}$${tag}$::jsonb`}
const active=reviewed.filter(q=>q.status==='published'),counts=Object.fromEntries(['improved','retained','replaced','replacement','added'].map(s=>[s,decisions.filter(q=>q.decision===s).length]))
const stats={original:originals.size,published:active.length,total:reviewed.length,...counts,formats:Object.fromEntries([...new Set(active.map(q=>q.game_type||'choice'))].sort().map(t=>[t,active.filter(q=>(q.game_type||'choice')===t).length]))}
const catalogRows=[...catalog.values()].filter(x=>active.some(q=>q.id===x.id))
function reviewSql(partTargets,partCatalog,schemaSql,title){return `-- Suizamente: REVISIÓN COMPLETA 14. ${title}
-- Incluye el esquema vigente y todo el banco revisado. No ejecutar SQL antiguos después.
-- Repetible: conserva versiones asignadas, respuestas, progreso, XP, premios e intentos.
-- Las modificaciones ajenas a las versiones publicadas se omiten y aparecen en el resultado.
BEGIN;
${schemaSql}
-- END_REVIEW_SCHEMA
-- Each import is a single statement: no temporary table or connection-local state.
CREATE OR REPLACE FUNCTION suizamente_private.import_review_14(items jsonb,catalog jsonb)
RETURNS TABLE(id text,result text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $review_helper$
DECLARE item jsonb; target jsonb; previous jsonb; applied text; entry jsonb; catalog_index jsonb;
BEGIN
  SELECT coalesce(jsonb_object_agg(x->>'id',x),'{}'::jsonb) INTO catalog_index FROM jsonb_array_elements(catalog) x;
  FOR item IN SELECT value FROM jsonb_array_elements(items) LOOP
    target:=item->'question';
    PERFORM pg_advisory_xact_lock(hashtext('sz-question-'||(target->>'id')));
    SELECT v.payload INTO previous FROM suizamente_private.questions q JOIN suizamente_private.versions v ON v.question_id=q.id AND v.version=q.current_version WHERE q.id=target->>'id';
    IF previous=target THEN applied:='unchanged';
    ELSIF previous IS NOT NULL AND NOT (item->'known' ? md5(previous::text)) THEN applied:='skipped_custom_edit';
    ELSIF target->>'status'='published' AND target ? 'next_review_at' AND (target->>'next_review_at')::date <= (now() AT TIME ZONE 'Europe/Zurich')::date THEN applied:='skipped_review_due';
    ELSE
      PERFORM suizamente_private.write_question(target);
      applied:=CASE WHEN previous IS NULL THEN 'inserted' ELSE 'updated' END;
    END IF;
    entry:=catalog_index->(target->>'id');
    IF entry IS NOT NULL AND applied IN ('unchanged','inserted','updated') THEN
      INSERT INTO suizamente_private.trivia_catalog(question_id,topic,national,original_prompt,prompt)
      VALUES(entry->>'id',entry->>'topic',(entry->>'national')::boolean,entry->>'original_prompt',entry->>'prompt')
      ON CONFLICT(question_id) DO UPDATE SET topic=excluded.topic,national=excluded.national,original_prompt=excluded.original_prompt,prompt=excluded.prompt;
    END IF;
    id:=target->>'id'; result:=applied; RETURN NEXT;
  END LOOP;
END $review_helper$;
REVOKE ALL ON FUNCTION suizamente_private.import_review_14(jsonb,jsonb) FROM PUBLIC,anon,authenticated;
-- BEGIN_REVIEW_CALL
SELECT result,count(*) AS questions,array_agg(id ORDER BY id) FILTER(WHERE result LIKE 'skipped_%') AS omitted_ids
FROM suizamente_private.import_review_14(${literal(partTargets,'review_bank')},${literal(partCatalog,'review_catalog')}) GROUP BY result ORDER BY result;
-- END_REVIEW_CALL
NOTIFY pgrst,'reload schema';
COMMIT;
`}
const sql=reviewSql(targets,catalogRows,schema,'Instalador completo; para el SQL Editor usar las cuatro partes numeradas.')
await writeFile('supabase/suizamente_revision_completa.sql',sql)
// Each file owns its transaction; its import call is independently atomic.
// Nothing depends on a temporary table or keeping the SQL Editor connection.
// Include matching catalogue rows
// with their questions so partial installation and retries remain consistent.
const catalogById=new Map(catalogRows.map(q=>[q.id,q]))
const weight=item=>Buffer.byteLength(JSON.stringify(item))+Buffer.byteLength(JSON.stringify(catalogById.get(item.question.id)||''))+2
const ideal=(Buffer.byteLength(schema)+targets.reduce((sum,item)=>sum+weight(item),0))/4
const groups=[[]];let size=Buffer.byteLength(schema)
for(const item of targets){
  const bytes=weight(item)
  if(groups.length<4&&size+bytes>ideal){groups.push([]);size=0}
  groups.at(-1).push(item);size+=bytes
}
assert.equal(groups.length,4)
for(const [index,group]of groups.entries()){
  const ids=new Set(group.map(item=>item.question.id)),number=String(index+1).padStart(2,'0')
  const part=reviewSql(group,catalogRows.filter(q=>ids.has(q.id)),index===0?schema:'',`PARTE ${index+1} DE 4. Ejecutar 01 → 02 → 03 → 04; cada archivo completo por separado.`)
  assert.ok(Buffer.byteLength(part)<700000,`Part ${number} exceeds the intended small-file budget`)
  await writeFile(`supabase/suizamente_revision_completa_${number}.sql`,part)
  console.log(`Part ${number}: ${group.length} questions, ${Math.ceil(Buffer.byteLength(part)/1024)} KiB`)
}
await writeFile('supabase/seed-data/suizamente-reviewed.json',JSON.stringify(reviewed,null,2)+'\n')
await writeFile('supabase/seed-data/suizamente-review-audit.json',JSON.stringify({revision:14,date:'2026-11-18',stats,decisions},null,2)+'\n')
const digest=createHash('sha256').update(JSON.stringify(reviewed)).digest('hex')
console.log(JSON.stringify({...stats,sha256:digest},null,2))
