// Editorial export follows fuentes/LEEME-FUENTES.md, using the current unsaved draft.
export function proposalLine(q){
  const clean=value=>String(value??'').replace(/[|\r\n]+/g,' ')
  const fields=[q.tipo==='dilema'?'D':q.tipo==='mito'?'V':'R',q.tema,q.emoji,q.pregunta]
  if(q.tipo==='mito')fields.push(q.verdad?'V':'M')
  else fields.push(...q.opciones.map((o,i)=>(q.tipo==='real'&&i===q.correcta?'*':'')+clean([o.e,o.t].filter(Boolean).join(' '))))
  return [...fields, q.dato].map(clean).join('|')
}
