// Stored coordinates only: runtime never runs the authoring allocator.
import {readFileSync} from 'node:fs'
const read=name=>JSON.parse(readFileSync(new URL('./data/'+name+'.json',import.meta.url),'utf8'))
export function resolverHuecos(catalog=read('decoraciones')){
 const huecos=read('huecos'),ajustes=read('huecos-ajustes')
 const resolved=Object.entries(huecos).flatMap(([canton,slots])=>slots.filter(h=>h.tipo!=='plaza').map(h=>({...h,canton,ancla:'pueblo',dy:h.tipo==='aire'?3.4:0,escala:.23*ajustes[canton].factor,giro:0})))
 return {...catalog,huecos:catalog.huecos.map(h=>typeof h==='string'?resolved.find(v=>v.id===h):h)}
}
