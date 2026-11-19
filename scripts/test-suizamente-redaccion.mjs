import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'

const original = JSON.parse(execFileSync(process.execPath, ['scripts/generar-suizamente-preguntas.cjs', '--json-original'], { encoding:'utf8' }))
const actual = JSON.parse(await readFile('public/suizamente/data/preguntas.json', 'utf8'))
const revision = JSON.parse(await readFile('data/suizamente/revision-redaccion.json', 'utf8'))
assert.equal(actual.preguntas.length, original.preguntas.length)
assert.equal(new Set(revision.map(r => r.original)).size, revision.length, 'Hay correcciones repetidas')
const cifras = text => text.match(/\d+(?:[.,:]\d+)*/g) || []
let modificadas = 0

function separar(q) {
  const partes = q.opciones.map((op, opcion) => {
    const titulo = `${op.e} ${op.t}:`
    return { opcion, titulo, inicio:q.dato.indexOf(titulo) }
  }).filter(p => p.inicio >= 0).sort((a,b) => a.inicio - b.inicio)
  if (!partes.length || partes[0].inicio !== 0) return [{ opcion:null, texto:q.dato }]
  return partes.map((p, i) => ({ opcion:p.opcion, texto:q.dato.slice(p.inicio+p.titulo.length, partes[i+1]?.inicio ?? q.dato.length).trim() }))
}
const textosOriginales = new Set(original.preguntas.flatMap(q => separar(q).map(p => p.texto)))
for (const { original:antes, revisado:despues } of revision) {
  assert.ok(textosOriginales.has(antes), `Corrección sin texto de origen: ${antes}`)
  assert.ok(despues.trim() && antes !== despues)
  assert.deepEqual(cifras(despues), cifras(antes), `Se han cambiado cifras: ${antes}`)
  assert.ok(!despues.includes('\uFFFD'), 'Hay caracteres dañados')
}
for (let i=0; i<original.preguntas.length; i++) {
  const { dato:antes, ...preguntaAntes } = original.preguntas[i]
  const { dato:despues, ...preguntaDespues } = actual.preguntas[i]
  assert.deepEqual(preguntaDespues, preguntaAntes, `Han cambiado preguntas, opciones o índices: ${preguntaAntes.id}`)
  assert.deepEqual(cifras(despues), cifras(antes), `Han cambiado cifras o fechas: ${preguntaAntes.id}`)
  assert.ok(despues.length <= 300 && despues.trim())
  const a = separar(original.preguntas[i]), b = separar(actual.preguntas[i])
  assert.deepEqual(b.map(p => p.opcion), a.map(p => p.opcion), `Se ha perdido el dato de una opción: ${preguntaAntes.id}`)
  if (antes !== despues) modificadas++
}
assert.ok(actual.preguntas.some(q => q.dato.includes('Ofrece cine al aire libre')))
assert.ok(actual.preguntas.some(q => q.dato.includes('Es un concurso de tiro juvenil')))
console.log(`PASS: ${actual.preguntas.length} preguntas revisadas, ${revision.length} correcciones editoriales y ${modificadas} explicaciones actualizadas; IDs, opciones, respuestas correctas, cifras, fechas y datos por opción conservados.`)
