import {perfilesDemo,cantonesDemo,demoEnabled} from './demostracion.js'
import {CANTONES} from './experiencia-datos.js'

export function clasificacionSemanal(rows,me){
  const unique=new Map((demoEnabled()?perfilesDemo():[]).map(p=>[p.id,p]))
  for(const row of rows)unique.set(row.id,row)
  const sorted=[...unique.values()].sort((a,b)=>b.puntos-a.puntos||a.apodo.localeCompare(b.apodo,'es')||a.id.localeCompare(b.id))
  let place=0,previous=null
  return sorted.map(row=>{if(row.puntos!==previous){place++;previous=row.puntos}return {...row,puesto:place}}).filter(row=>row.puesto<=50||row.id===me)
}
export function clasificacionCantones(rows){
  const baseline=new Map((demoEnabled()?cantonesDemo():[]).map(row=>[row.codigo,row]))
  const byCode=new Map(rows.map(row=>[row.codigo,row]))
  const sorted=Object.entries(CANTONES).map(([codigo,nombre])=>{
    const row=byCode.get(codigo)||{codigo,nombre,activos:0,puntos:0}
    const base=baseline.get(row.codigo),activos=Number(row.activos)+(base?.activos||0),puntos=Number(row.puntos)+(base?.puntos||0)
    return {...row,activos,puntos,media:activos?Math.round(100*puntos/activos)/100:0}
  }).sort((a,b)=>Number(b.activos>0)-Number(a.activos>0)||b.media-a.media||a.nombre.localeCompare(b.nombre,'es'))
  return sorted.map((row,index)=>({...row,puesto:index+1}))
}
