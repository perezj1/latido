// The same original option indexes and presentation in practice and real matches.
export function QuestionOptions({question,result,onAnswer,busy=false,expired=false}){
 return <div className={'sv-options'+(result?' result':'')}>{question.opciones.map(o=>{
  if(result)return <div key={o.indice} role="group" aria-label={o.indice===result.correcta?'Respuesta correcta':o.indice===result.opcion?'Tu respuesta, incorrecta':undefined} className={o.indice===result.correcta?'correct':o.indice===result.opcion?'wrong':'muted'}><span aria-hidden="true">{o.indice===result.correcta?'✓':o.indice===result.opcion?'✕':o.e}</span><b>{o.t}</b></div>
  const removed=question.quitadas?.includes(o.indice)||question.falladas?.includes(o.indice)
  return <button type="button" key={o.indice} disabled={busy||expired||removed} className={removed?'sv-option-removed':''} onClick={()=>onAnswer(o.indice)}><span aria-hidden="true">{o.e}</span><b>{o.t}</b></button>
 })}</div>
}
