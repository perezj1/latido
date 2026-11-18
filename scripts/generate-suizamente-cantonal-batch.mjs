import assert from 'node:assert/strict'
import {writeFile} from 'node:fs/promises'
import {loadContentPack,validateContentPack,publicationSql} from './lib/suizamente-content-pack.mjs'
const pack=await loadContentPack(),report=validateContentPack(pack)
const territories=['ZH','GE','LU','BE','TI','VD']
assert.deepEqual(report.errors,[])
for(const t of territories){
  const count=report.counts[t]
  assert.equal(count.total,50,`${t} must be complete`)
  assert.deepEqual(count.formats,pack.manifest.formats_per_territory)
}
const questions=pack.questions.filter(q=>territories.includes(q.territory))
assert.ok(questions.every(q=>q.next_review_at>report.reference_date))
const path='supabase/suizamente_expansion_cantones_20261117.sql'
await writeFile(path,`-- Lote del 17.11.2026: 50 preguntas por cantón (${territories.join(', ')}).
-- Ejecutar después de suizamente_actualizacion_jugabilidad.sql.
-- No repetir los seis SQL individuales si ya ejecutas este archivo.
${publicationSql(questions,pack.legacy)}`,'utf8')
console.log(`${path}: ${questions.length} entries; generated locally only.`)
