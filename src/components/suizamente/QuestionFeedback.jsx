import {useId,useState} from 'react'

// Older installations return a formatted solution. Recover its pairs only if
// every label and definition matches the current question; never guess a pair.
export function answerPairs(answer,question){
  if(Array.isArray(answer?.correct_pairs)&&answer.correct_pairs.length===4&&answer.correct_pairs.every(p=>typeof p?.left==='string'&&typeof p?.right==='string'))return answer.correct_pairs
  if(question?.type!=='match'||question.options?.length!==4||question.pairs?.length!==4)return []
  const text=String(answer?.correct_answer||''),pairs=[]
  let cursor=0
  for(let i=0;i<4;i++){
    const left=question.options[i],prefix=`${left} → `
    if(!text.startsWith(prefix,cursor))return []
    const start=cursor+prefix.length,end=i===3?text.length:text.indexOf(`; ${question.options[i+1]} → `,start)
    if(end<0)return []
    const right=text.slice(start,end)
    if(!question.pairs.includes(right))return []
    pairs.push({left,right});cursor=end+2
  }
  return new Set(pairs.map(p=>p.right)).size===4?pairs:[]
}

export function AnswerPairs({pairs}){
  return <dl className="sg-answer-pairs">{pairs.map((pair,i)=><div key={i}><dt>{pair.left}</dt><dd><span aria-hidden="true">→</span>{pair.right}</dd></div>)}</dl>
}

export function FeedbackSolution({answer,question,matchedCount=0,wrongPairs=[]}){
  const type=question.type,pairs=answerPairs(answer,question)
  if(type==='match'&&pairs.length){
    const missed=new Set((Array.isArray(wrongPairs)?wrongPairs:[]).filter(value=>/^[0-3]:[0-3]$/.test(value)).map(value=>Number(value[0])))
    const focus=!answer.skipped&&matchedCount===4?pairs.filter(pair=>missed.has(question.options.indexOf(pair.left))):[]
    return <>{!!focus.length&&<div className="sg-pair-focus"><span>Para recordar</span><AnswerPairs pairs={focus}/></div>}<details className="sg-pair-solution" open={answer.skipped||matchedCount<4}><summary>Ver las 4 parejas correctas</summary><AnswerPairs pairs={pairs}/></details></>
  }
  if(answer.correct)return null
  const correct=(answer.correct_options||[]).map(i=>question.options[i]).filter(Boolean)
  return <div className="sg-correct-answer"><span>{type==='multi'?'Respuestas correctas':type==='false'?'La afirmación falsa':'Respuesta correcta'}</span>{type==='multi'&&correct.length?<ul>{correct.map((text,i)=><li key={i}>{text}</li>)}</ul>:<strong>{answer.correct_answer||question.options[answer.correct_option]}</strong>}</div>
}

export function FeedbackExplanation({text,renderText}){
  const [expanded,setExpanded]=useState(false),id=useId(),long=String(text||'').length>180
  return <div className="sg-feedback-reason"><div className={`sg-feedback-explanation ${long&&!expanded?'is-condensed':''}`} id={id}><p>{renderText?renderText(text):text}</p></div>{long&&<button type="button" className="sg-explanation-toggle" aria-expanded={expanded} aria-controls={id} onClick={()=>setExpanded(value=>!value)}>{expanded?'Ver menos':'Ver explicación completa'}</button>}</div>
}
