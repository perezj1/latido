import assert from 'node:assert/strict'
import {writeFile,readFile} from 'node:fs/promises'
import {loadContentPack,validateContentPack,publicationSql} from './lib/suizamente-content-pack.mjs'
const pack=await loadContentPack(),report=validateContentPack(pack)
assert.deepEqual(report.errors,[])
for(const territory of ['GL','ZG']){
 assert.equal(report.counts[territory].total,50)
 assert.deepEqual(report.counts[territory].formats,pack.manifest.formats_per_territory)
}
const byId=new Map(pack.questions.map(q=>[q.id,{...q,status:'published'}]))
for(const file of ['suizamente_expansion_CH.sql','suizamente_expansion_cantones_20261117.sql','suizamente_expansion_bs_bl_20261117.sql','suizamente_expansion_fr_vs_20261117.sql','suizamente_expansion_sg_gr_20261117.sql','suizamente_expansion_ar_ai_20261117.sql','suizamente_expansion_ur_sz_20261117.sql','suizamente_expansion_ow_nw_20261117.sql']){
 const sql=await readFile(`supabase/${file}`,'utf8')
 for(const match of sql.matchAll(/\$sz_target\$(.*?)\$sz_target\$::jsonb/g)){
  const previous=JSON.parse(match[1]);assert.deepEqual(byId.get(previous.id),previous,`Published entry changed: ${previous.id}`)
 }
}
const questions=pack.questions.filter(q=>['GL','ZG'].includes(q.territory))
assert.ok(questions.every(q=>q.next_review_at>report.reference_date))
const path='supabase/suizamente_expansion_gl_zg_20261117.sql'
await writeFile(path,`-- Lote 08: 50 Glarus + 50 Zug. El usuario confirma los lotes anteriores hasta 07.
-- Ejecutar después de suizamente_actualizacion_ilustraciones_08.sql.
-- Mantiene XP, etapas, sesiones y todas las versiones anteriores.
${publicationSql(questions,pack.legacy)}`,'utf8')
console.log(`${path}: ${questions.length} entries; local generation only.`)
