import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {CANTONES} from '../../../public/suizamente/experiencia-datos.js'
test('Conquista publishes an attributed 26-canton map and keeps the production answer key private',async()=>{
 const map=JSON.parse(await readFile(new URL('../../../public/suizamente/conquista/mapa.json',import.meta.url),'utf8'))
 assert.equal(map.cantons.length,26);assert.deepEqual(new Set(map.cantons.map(c=>c.code)),new Set(Object.keys(CANTONES)))
 assert.ok(map.cantons.every(c=>c.path.startsWith('M')&&c.path.endsWith('Z')));assert.match(map.attribution,/swisstopo/)
 const schema=await readFile(new URL('../../../supabase/suizamente_conquista_estructura.sql',import.meta.url),'utf8')
 assert.doesNotMatch(schema,/cq-2026-|INSERT INTO suizamente_conquista.preguntas/)
 let bank
 try{bank=JSON.parse(await readFile(new URL('../../../data/suizamente/conquista/preguntas.json',import.meta.url),'utf8')).questions}catch(error){if(error.code!=='ENOENT')throw error}
 if(bank){
  assert.equal(bank.length,1300);assert.equal(new Set(bank.map(q=>q.id)).size,1300)
  for(const code of Object.keys(CANTONES)){
  const rows=bank.filter(q=>q.canton===code);assert.equal(rows.length,50)
  assert.equal(new Set(rows.map(q=>q.pregunta)).size,50)
  for(const q of rows){assert.equal(q.opciones.length,4);assert.equal(new Set(q.opciones).size,4);assert.ok(q.correcta>=0&&q.correcta<=3);assert.match(q.fuente,/^https:\/\/www\.swisstopo\.admin\.ch\//);assert.equal(q.revisada,'2026-11-22');assert.ok(q.explicacion.length>20)}
  }
 }
})
