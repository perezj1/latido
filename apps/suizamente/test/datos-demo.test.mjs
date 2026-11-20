import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {separarDatos} from '../../../public/suizamente/datos-opciones.js'
import {DEMO,repartoDemo,perfilesDemo,cantonesDemo} from '../../../public/suizamente/demostracion.js'
const {preguntas}=JSON.parse(await readFile(new URL('../../../public/suizamente/data/preguntas.json',import.meta.url),'utf8'))

test('all 2000 facts stay attached to their original answer or neutral question context',()=>{
  for(const q of preguntas){
    const {opciones,comun}=separarDatos(q)
    if(q.tipo==='real'){assert.deepEqual(opciones,{[q.correcta]:q.dato});assert.equal(comun,'')}
    else if(comun){assert.equal(comun,q.dato);assert.equal(Object.keys(opciones).length,0)}
    else{
      assert.equal(Object.keys(opciones).length,q.opciones.length,q.id)
      for(const [i,fact]of Object.entries(opciones)){assert(fact.trim(),q.id);assert(q.dato.includes(`${q.opciones[i].e} ${q.opciones[i].t}: ${fact}`),q.id)}
    }
  }
  const lake=separarDatos(preguntas.find(q=>q.id==='montana_lago'))
  assert.match(lake.opciones[0],/Alpes/);assert.match(lake.opciones[1],/lagos/)
  assert(!lake.opciones[0].includes('lagos'))
})
test('320 deterministic demo profiles are isolated and canton ranks use their actual mean',()=>{
  const players=perfilesDemo(),cantons=cantonesDemo()
  assert.equal(players.length,320);assert.equal(new Set(players.map(p=>p.id)).size,320)
  assert.equal(cantons.reduce((sum,c)=>sum+c.activos,0),320)
  for(const c of cantons){const members=players.filter(p=>p.canton===c.codigo);assert.equal(c.media,members.reduce((sum,p)=>sum+p.puntos,0)/members.length)}
  for(const q of preguntas){const sample=repartoDemo(q,[]);assert.equal(sample.total,DEMO.profiles);assert.equal(sample.n.reduce((sum,n)=>sum+n,0),320);assert(sample.n.every(n=>n>=0));assert.deepEqual(sample,repartoDemo(q,[]))}
})
test('real votes are not mutated or mixed and replace the example at the threshold',()=>{
  const q=preguntas[0],counts=[20,4],original=counts.slice()
  assert.equal(repartoDemo(q,counts).demo,false);assert.deepEqual(counts,original)
  assert.equal(repartoDemo(q,[1,0]).realTotal,1)
  globalThis.SUIZAMENTE_DEMO=false
  try{assert.equal(repartoDemo(q,[1,0]).demo,false)}finally{delete globalThis.SUIZAMENTE_DEMO}
})
