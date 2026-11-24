export default function SuizamenteFormatFields({editor,setEditor}){
  if(editor.game_type==='short')return <>
    <label className="sz-field">Respuestas aceptadas (una por línea)<textarea required maxLength={1000} value={(editor.accepted_answers||[]).join('\n')} onChange={e=>setEditor(s=>({...s,accepted_answers:e.target.value.split('\n')}))}/></label>
    <p className="sz-muted">La primera se muestra como solución. Se ignoran mayúsculas y espacios repetidos. Añade expresamente las variantes ortográficas válidas; la corrección no es subjetiva.</p>
    <label className="sz-field">Longitud máxima<input type="number" min={1} max={80} required value={editor.max_length||80} onChange={e=>setEditor(s=>({...s,max_length:Number(e.target.value)}))}/></label>
  </>
  if(editor.game_type!=='order')return null
  return <fieldset className="sz-editor-options"><legend>Bloques para ordenar (entre 3 y 8)</legend>
    <p className="sz-muted">El jugador los recibe mezclados. Usa bloques diferentes y una pista que deje una única secuencia correcta.</p>
    {editor.options.map((option,index)=><label className="sz-field" key={index}>Bloque {index+1}<input required maxLength={500} value={option} onChange={e=>setEditor(s=>({...s,options:s.options.map((v,i)=>i===index?e.target.value:v)}))}/></label>)}
    <p><strong>Secuencia correcta</strong></p>
    {editor.options.map((_,position)=><label className="sz-field" key={position}>Posición {position+1}<select value={editor.correct_order?.[position]??position} onChange={e=>setEditor(s=>({...s,correct_order:s.options.map((_,i)=>i===position?Number(e.target.value):s.correct_order?.[i]??i)}))}>{editor.options.map((option,index)=><option key={index} value={index}>{index+1}: {option||'Bloque sin texto'}</option>)}</select></label>)}
    {editor.options.length<8&&<button type="button" className="sz-text-link" onClick={()=>setEditor(s=>({...s,options:[...s.options,''],correct_order:[...(s.correct_order||s.options.map((_,i)=>i)),s.options.length]}))}>Añadir bloque</button>}
    {editor.options.length>3&&<button type="button" className="sz-text-link" onClick={()=>setEditor(s=>({...s,options:s.options.slice(0,-1),correct_order:(s.correct_order||s.options.map((_,i)=>i)).filter(i=>i!==s.options.length-1)}))}>Quitar último bloque</button>}
  </fieldset>
}
