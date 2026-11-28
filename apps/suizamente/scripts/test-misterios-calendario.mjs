import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {mejorasDatabase} from './lib/mejoras-test-db.mjs'
const source=await readFile('fuentes/misterios.txt','utf8'),records=JSON.parse(await readFile('server/suizamente/data/misterios.json','utf8')).misterios,audit=JSON.parse(await readFile('fuentes/misterios-calendario-2026-2027.json','utf8'))
assert.equal(records.length,366);assert.equal(records[0].fecha,'2026-11-28');assert.equal(records.at(-1).fecha,'2027-11-28')
const unique=new Set()
for(const [i,m]of records.entries()){
 assert.equal(Date.parse(m.fecha+'T12:00Z'),Date.parse(records[0].fecha+'T12:00Z')+i*86400000,'No missing calendar days')
 const key=JSON.stringify([m.tipo,m.pregunta,m.pistas,m.opciones]);assert.ok(!unique.has(key),'No identical mysteries in the calendar');unique.add(key)
 assert.equal(m.pistas.length,3);assert.equal(m.opciones.length,4)
}
for(const entry of audit.entradas){const line=source.split(/\r?\n/).find(s=>s.startsWith(entry.fecha+' |'));assert.equal(createHash('sha256').update(line).digest('hex'),entry.sha256)}
const {db}=await mejorasDatabase(true)
try{
 const sql=await readFile('supabase/suizamente_v43_misterios_anual.sql','utf8');await db.exec(sql);await db.exec(sql)
 assert.equal((await db.query('SELECT count(*) n FROM suizamente_private.misterios')).rows[0].n,366)
 for(const m of records){
  const view=(await db.query('SELECT suizamente_private.mej_misterio_vista($1,$2::date) v',['calendario-sin-persona',m.fecha])).rows[0].v
  assert.equal(view.pistas.length,1);assert.equal(view.disponible,true);assert.ok(!('correcta' in view));assert.ok(!('dato' in view));assert.ok(!('solucion' in view))
  assert.deepEqual(view.pistas,[m.pistas[0]])
 }
 const absent=(await db.query("SELECT suizamente_private.mej_misterio_vista('calendario-sin-persona','2027-11-29') v")).rows[0].v;assert.equal(absent.disponible,false)
 // Re-publication never edits an already-published answer or option order.
 await db.exec("UPDATE suizamente_private.misterios SET payload=jsonb_set(payload,'{dato}','\"Contenido ya publicado\"') WHERE fecha='2026-11-28'");await db.exec(sql)
 assert.equal((await db.query("SELECT payload->>'dato' d FROM suizamente_private.misterios WHERE fecha='2026-11-28'")).rows[0].d,'Contenido ya publicado')
 assert.equal((await db.query("SELECT has_table_privilege('authenticated','suizamente_private.misterios','SELECT') allowed")).rows[0].allowed,false)
 console.log('PASS: 366 continuous dated mysteries, distinct puzzles, source hashes, private future days and hints, idempotent publication without editing an existing day')
}catch(e){console.error(e.message);process.exitCode=1}finally{await db.close()}
