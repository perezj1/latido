import test from 'node:test'
import assert from 'node:assert/strict'
import {clasificacionSemanal,clasificacionCantones} from '../../../public/suizamente/clasificacion.js'
import {cantonesDemo} from '../../../public/suizamente/demostracion.js'

test('one weekly ranking includes new players and preserves their points and photos',()=>{
 const rows=[{id:'user:high',apodo:'Jose',puntos:9000,avatarUrl:'https://example.test/photo.png'},{id:'user:me',apodo:'Yo',puntos:0}]
 const before=rows.map(row=>({...row})),result=clasificacionSemanal(rows,'user:me')
 assert.equal(result[0].id,'user:high');assert.equal(result[0].puesto,1)
 assert.equal(result[0].puntos,9000);assert.equal(result[0].avatarUrl,rows[0].avatarUrl)
 assert.equal(result.at(-1).id,'user:me');assert.equal(new Set(result.map(r=>r.id)).size,result.length)
 assert.deepEqual(rows,before)
})
test('cantonal ranks combine totals and active people using a weighted mean',()=>{
 const baseline=cantonesDemo(),first=baseline[0]
 const rows=baseline.map(row=>({codigo:row.codigo,nombre:row.nombre,activos:row.codigo===first.codigo?2:0,puntos:row.codigo===first.codigo?75:0,media:0}))
 const result=clasificacionCantones(rows),combined=result.find(row=>row.codigo===first.codigo)
 assert.equal(combined.activos,first.activos+2);assert.equal(combined.puntos,first.puntos+75)
 assert.equal(combined.media,Math.round(100*(first.puntos+75)/(first.activos+2))/100)
 assert.equal(result.reduce((n,r)=>n+r.activos,0),322)
})

test('all 26 cantons keep unique positions even when the API omits a canton or scores tie',()=>{
 const result=clasificacionCantones([{codigo:'ZH',nombre:'Zúrich',puntos:0,activos:0}])
 assert.equal(result.length,26)
 assert.equal(new Set(result.map(row=>row.codigo)).size,26)
 assert.deepEqual(result.map(row=>row.puesto),Array.from({length:26},(_,i)=>i+1))
 assert.ok(result.some(row=>row.codigo==='JU'))
})
