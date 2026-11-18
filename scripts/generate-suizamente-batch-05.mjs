import assert from 'node:assert/strict'
import {writeFile,readFile} from 'node:fs/promises'
import {loadContentPack,validateContentPack,publicationSql} from './lib/suizamente-content-pack.mjs'
const pack=await loadContentPack(),report=validateContentPack(pack)
assert.deepEqual(report.errors,[])
for(const territory of ['SG','GR','AR','AI']){
  assert.equal(report.counts[territory].total,50)
  assert.deepEqual(report.counts[territory].formats,pack.manifest.formats_per_territory)
}
// The prior release is immutable even when regenerating the cumulative installer.
const fourth=await readFile('supabase/suizamente_expansion_sg_gr_20261117.sql','utf8')
const released=[...fourth.matchAll(/\$sz_target\$(.*?)\$sz_target\$::jsonb/g)].map(m=>JSON.parse(m[1]))
assert.equal(released.length,100)
for(const previous of released)assert.deepEqual({...pack.questions.find(q=>q.id===previous.id),status:'published'},previous)
for(const [territories,path,note] of [
  [['AR','AI'],'supabase/suizamente_expansion_ar_ai_20261117.sql','Lote 05: 50 Appenzell Ausserrhoden + 50 Appenzell Innerrhoden.'],
  [['SG','GR','AR','AI'],'supabase/suizamente_expansion_04_05_20261117.sql','Acumulado 04+05: SG/GR anteriores sin cambios + nuevas AR/AI. Repetir SG/GR no duplica versiones.'],
]){
  const questions=pack.questions.filter(q=>territories.includes(q.territory))
  assert.ok(questions.every(q=>q.next_review_at>report.reference_date))
  await writeFile(path,`-- ${note}
-- Ejecutar después de suizamente_actualizacion_ilustraciones_05.sql.
-- Mantiene XP, etapas, sesiones y las versiones publicadas antes.
${publicationSql(questions,pack.legacy)}`,'utf8')
  console.log(`${path}: ${questions.length} entries; local generation only.`)
}
