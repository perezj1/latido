import {useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
import {useSv,useQuestionScreen} from './Context'
import {Button,Card,Header} from './Shared'
import {QuestionOptions} from './QuestionOptions'
import {szApi} from '../../../lib/suizamenteV2'
import './negocios.css'
const request=(action,body)=>szApi('negocios/'+action,{method:'POST',body})
export function BusinessQuestion({partida,onDone}){
 const {config}=useSv(),[data,setData]=useState(null),[result,setResult]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[deadline,setDeadline]=useState(0),[seconds,setSeconds]=useState(0)
 useQuestionScreen(!!data?.pregunta)
 useEffect(()=>{let active=true;request('pregunta',{partida}).then(d=>{if(!active)return;if(!d.pregunta||d.respuesta){onDone();return}const duration=Date.parse(d.limite)-Date.parse(d.servidorAhora);setData(d);setSeconds(Math.max(0,Math.ceil(duration/1000)));setDeadline(performance.now()+duration)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[partida])
 useEffect(()=>{if(!deadline||result)return;const tick=()=>setSeconds(Math.max(0,Math.ceil((deadline-performance.now())/1000)));tick();const timer=setInterval(tick,200);return()=>clearInterval(timer)},[deadline,result])
 async function answer(opcion){if(busy||result)return;setBusy(true);try{const r=await request('pregunta_responder',{partida,opcion});setResult({...r,opcion});setError('')}catch(e){setError(e.message)}finally{setBusy(false)}}
 useEffect(()=>{if(deadline&&seconds===0&&!result&&!busy)answer(-1)},[seconds,deadline])
 if(error&&!data)return <section className="sv-screen sv-neg-page"><Header title="Partida"/><div className="sv-content"><p role="alert">{error}</p><Button onClick={onDone}>Volver a la partida</Button></div></section>
 if(!data)return <section className="sv-screen"><div className="sv-content"><p role="status">Preparando la partida…</p></div></section>
 const question={...data.pregunta,opciones:data.pregunta.opciones.map((t,indice)=>({t,indice}))}
 return <section className="sv-screen sv-neg-page sv-neg-question"><Header title="Pregunta"/><div className="sv-content"><span className="sv-neg-sponsored">Pregunta de {data.pregunta.nombre} · Patrocinado</span>{!result&&<p role="timer" aria-live="off" aria-label={seconds+' segundos'}>{seconds} s</p>}<h2>{question.pregunta}</h2><QuestionOptions question={question} result={result} onAnswer={answer} busy={busy} expired={!!deadline&&seconds===0}/><p className="sv-muted">Sin monedas, comodines ni XP.</p><p role="alert">{error}</p>{result&&<><Card><p>{result.ok?'¡Correcto!':'Esta era la respuesta'}</p><p>{result.dato}</p><Link className="sv-neg-sponsor-footer" to={'/suizamente/negocios/'+result.negocio} onClick={()=>request(result.negocio+'/estadistica',{tipo:'desde_pregunta'}).catch(()=>{})}>Te la trae {data.pregunta.nombre} · Conocer ›</Link></Card><Button onClick={onDone}>Seguir jugando</Button></>}</div></section>
}
