// Facts with option headings belong to those original indices, never to the
// shuffled position or whichever option the player happens to select.
export function separarDatos(q) {
  if(q.tipo==='real')return {opciones:{[q.correcta]:q.dato},comun:''}
  const parts=q.opciones.map((op,indice)=>{
    const titulo=`${op.e} ${op.t}:`
    return {indice,titulo,inicio:q.dato.indexOf(titulo)}
  }).filter(p=>p.inicio>=0).sort((a,b)=>a.inicio-b.inicio)
  if(parts.length!==q.opciones.length||parts[0]?.inicio!==0)return {opciones:{},comun:q.dato}
  return {opciones:Object.fromEntries(parts.map((p,i)=>[p.indice,q.dato.slice(p.inicio+p.titulo.length,parts[i+1]?.inicio??q.dato.length).trim()])),comun:''}
}
