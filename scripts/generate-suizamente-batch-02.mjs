import assert from 'node:assert/strict'
import {writeFile} from 'node:fs/promises'
import {loadContentPack,validateContentPack,publicationSql} from './lib/suizamente-content-pack.mjs'
const pack=await loadContentPack(),report=validateContentPack(pack),territories=['BS','BL']
assert.deepEqual(report.errors,[])
for(const territory of territories){
  assert.equal(report.counts[territory].total,50)
  assert.deepEqual(report.counts[territory].formats,pack.manifest.formats_per_territory)
}
const questions=pack.questions.filter(q=>territories.includes(q.territory))
assert.ok(questions.every(q=>q.next_review_at>report.reference_date))
const path='supabase/suizamente_expansion_bs_bl_20261117.sql'
await writeFile(path,`-- Lote 02: 50 preguntas Basel-Stadt + 50 Basel-Landschaft.
-- Ejecutar después de suizamente_actualizacion_ilustraciones_02.sql.
-- Las 350 entradas de la entrega anterior permanecen sin cambios.
${publicationSql(questions,pack.legacy)}`,'utf8')
console.log(`${path}: ${questions.length} entries; local generation only.`)
