// Use the server's option indexes for practice and real matches alike.
import './answers.css'
export function QuestionOptions({question,result,onAnswer,busy=false,expired=false}){
 return <div className={'sv-options sv-answer-options'+(result?' result':'')}>{question.opciones.map(o=>{
  if(result){const right=o.indice===result.correcta,wrong=!right&&o.indice===result.opcion;return <div key={o.indice} className={right?'correct':wrong?'wrong':'muted'}>{(right||wrong)&&<span className="sv-answer-mark" aria-hidden="true">{right?'✓':'✕'}</span>}<b>{(right||wrong)&&<span className="sv-sr-only">{right?'Correcta: ':'Tu respuesta, incorrecta: '}</span>}{o.t}</b></div>}
  const removed=question.quitadas?.includes(o.indice)||question.falladas?.includes(o.indice)
  return <button type="button" key={o.indice} disabled={busy||expired||removed} className={removed?'sv-option-removed':''} onClick={()=>onAnswer(o.indice)}>{removed&&<span className="sv-answer-mark" aria-hidden="true">✂️</span>}<b>{removed&&<span className="sv-sr-only">Quitada: </span>}{o.t}</b></button>
 })}</div>
}
