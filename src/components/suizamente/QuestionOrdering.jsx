export default function QuestionOrdering({options,sequence,onChange,disabled,answer}){
  return <div className="sg-order-question">
    <p className="sz-muted">Toca los bloques en orden. Puedes quitar un bloque para colocarlo de nuevo.</p>
    <ol className="sg-order-selection" aria-label="Tu orden">
      {sequence.map((index,position)=><li key={index}><button type="button" disabled={disabled} onClick={()=>onChange(sequence.filter(i=>i!==index))} aria-label={`Quitar bloque ${position+1}: ${options[index]}`}>{options[index]} <span aria-hidden="true">×</span></button></li>)}
    </ol>
    {!sequence.length&&<p className="sz-muted" role="status">{answer?'La respuesta está guardada.':'Elige el primer bloque.'}</p>}
    <div className="sg-order-bank" aria-label="Bloques disponibles">{options.map((option,index)=><button type="button" className="sg-option" key={index} disabled={disabled||sequence.includes(index)} onClick={()=>onChange([...sequence,index])}>{option}</button>)}</div>
    <p className="sz-muted" role="status">{sequence.length} de {options.length} bloques colocados</p>
  </div>
}
