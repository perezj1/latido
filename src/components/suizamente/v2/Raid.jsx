import {useCallback,useEffect,useRef,useState} from 'react'
import {Link,useParams} from 'react-router-dom'
import {useSv,useQuestionScreen} from './Context'
import {Avatar,Button,Card,Earnings,Header} from './Shared'
import {Powerups} from './Duels'
import {MapDrawing} from './Map'
import {cantonNames,szApi} from '../../../lib/suizamenteV2'
import {feedback} from '../../../lib/suizamenteFeedback'
import {FactCard} from './Sharing'

export function Raid(){
  const {id}=useParams(),{config}=useSv(),[data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[now,setNow]=useState(Date.now()),[summary,setSummary]=useState(false)
  const pending=useRef(false),offset=useRef(0),mounted=useRef(true),heard=useRef(false)
  const receive=useCallback(d=>{if(!mounted.current)return;offset.current=Date.parse(d.servidorAhora)-Date.now();setData(d);setNow(Date.now())},[])
  const load=useCallback(async()=>{try{receive(await szApi('asaltos/'+id));setError('')}catch(e){if(mounted.current)setError(e.message)}},[id,receive])
  useEffect(()=>{
    mounted.current=true;load()
    const poll=setInterval(()=>{if(!pending.current)load()},10000),clock=setInterval(()=>setNow(Date.now()),200)
    const reconnect=()=>load();window.addEventListener('online',reconnect)
    return()=>{mounted.current=false;clearInterval(poll);clearInterval(clock);window.removeEventListener('online',reconnect)}
  },[load])
  async function act(operation,args={}){
    if(pending.current)return
    pending.current=true;setBusy(true);setError('')
    try{receive(await szApi('asaltos/'+id+'/'+operation,{method:'POST',body:{turnoN:data.turnoN,...args}}))}
    catch(e){setError(e.message);if(e.status===409)await load()}
    finally{pending.current=false;if(mounted.current)setBusy(false)}
  }
  const q=data?.pregunta,result=data?.resultado,remaining=q?Math.max(0,Math.ceil((Date.parse(q.venceEn)-now-offset.current)/1000)):0
  useQuestionScreen(!!q)
  useEffect(()=>{if(result&&!heard.current){heard.current=true;feedback(result.ok?'acierto':'fallo')}if(q||result){const heading=document.querySelector('.sv-game h1');heading?.setAttribute('tabindex','-1');heading?.focus()}},[q?.n,result?.ok])
  useEffect(()=>{
    if(!q)return
    const timer=setTimeout(()=>{if(!pending.current)act('respuesta',{agotada:true})},Math.max(0,Date.parse(q.venceEn)+config.partida.margenServidorSegundos*1000-Date.now()-offset.current+100))
    return()=>clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[q?.venceEn,data?.turnoN])
  const back=data?.partidaId?'/suizamente/partida/'+data.partidaId+'?continuar=1':'/suizamente'
  if(!data)return <section className="sv-screen"><Header title="Asalto"/><div className="sv-content">{error?<><p className="sv-error" role="alert">{error}</p><Button onClick={load}>Reintentar</Button></>:<div className="sv-skeleton" role="status" aria-label="Cargando asalto"/>}</div></section>
  const target=<Card className="sv-raid-target"><div className="sv-raid-canton"><MapDrawing only={data.canton} levels={{[data.canton]:summary&&data.nivelFinal!==null?data.nivelFinal:data.nivelInicial}} label={cantonNames[data.canton]}/></div><div><div className="sv-raid-person"><Avatar name={data.victima?.apodo||'?'} color={data.victima?.color}/><b>Mapa de {data.victima?.apodo||'otra persona'}</b></div><strong>{cantonNames[data.canton]}</strong><small>{summary&&data.nivelFinal!==null?'Nivel '+data.nivelFinal:'Nivel '+data.nivelInicial+' · '+(data.tieneEscudo?'con escudo':'sin escudo')}</small></div></Card>
  const fault=error&&<p className="sv-error" role="alert">{error} <button className="sv-text-button" onClick={load}>Reintentar</button></p>
  if(q||(result&&!summary)){
    const category=config.categorias.find(c=>c.id===(q?.categoria||result.categoria))
    return <section className="sv-screen sv-game"><header className="sv-question-header" style={{background:category.color,color:category.colorTexto}}><span>{category.emoji}</span><div><small>⚔️ ASALTO · {cantonNames[data.canton].toUpperCase()}</small><b>{category.nombre}</b></div><span className={'sv-clock'+(remaining<=5&&!result?' urgent':'')}>{result?result.ok?'✓':'✕':remaining}</span>{q&&<div className="sv-time-bar"><i style={{width:Math.min(100,100*remaining/q.tiempo)+'%'}}/></div>}</header>
      <div className="sv-content sv-question-content">{q?<><Card className="sv-question-card"><span>{q.emoji}</span><h1>{q.pregunta}</h1></Card>{q.otraUsada&&<p className="sv-retry" role="status">🔁 ¡Otra oportunidad! Elige otra vez</p>}<div className="sv-options">{q.opciones.map(o=><button key={o.indice} disabled={busy||remaining===0||q.quitadas.includes(o.indice)||q.falladas.includes(o.indice)} className={q.quitadas.includes(o.indice)||q.falladas.includes(o.indice)?'sv-option-removed':''} onClick={()=>act('respuesta',{opcion:o.indice})}><span>{o.e}</span><b>{o.t}</b></button>)}</div>{remaining===0&&<p role="status">⏰ ¡Se acabó el tiempo!</p>}</>:<><h1 className={'sv-result-title '+(result.ok?'correct':'wrong')}>{result.agotada?'⏰ ¡Se acabó el tiempo!':result.ok?'¡Correcto!':'¡Uy! No era esa'}</h1><p className="sv-result-question">{result.pregunta}</p><div className="sv-options result">{result.opciones.map(o=><div key={o.indice} className={o.indice===result.correcta?'correct':o.indice===result.opcion?'wrong':'muted'}><span>{o.indice===result.correcta?'✓':o.indice===result.opcion?'✕':o.e}</span><b>{o.t}</b></div>)}</div>{result.pct!==null&&<p className="sv-stat">👥 El {result.pct} % de hispanohablantes en Suiza acertó</p>}<FactCard id={result.preguntaId} dato={result.dato} question={result.pregunta}/></>}{fault}</div>
      {q?<Powerups match={data} act={act} busy={busy} remaining={remaining}/>:<footer className="sv-footer"><Earnings value={{monedas:data.premio}}/><Button onClick={()=>setSummary(true)}>Ver el asalto</Button></footer>}
    </section>
  }
  const finished=data.estado!=='ofrecido',cancelled=data.estado==='cancelado'
  return <section className={'sv-screen sv-raid '+(finished?'finished':'')}><div className="sv-reward-heading"><span>{finished?cancelled?'🗺️':data.escudo?'🛡️':data.premio>0?'💥':'💨':'⚔️'}</span><h1>{finished?cancelled?'Asalto cancelado':data.escudo?'¡Un escudo lo paró!':data.premio>0?'¡Asalto conseguido!':'Esta vez no':'¡Asalto!'}</h1><p>{finished?cancelled?'El objetivo ya no está disponible.':data.escudo?'El cantón sigue a salvo.':data.premio>0?'Su cantón baja un nivel.':'El mapa sigue como estaba.':'Acierta una pregunta y te llevas monedas de otro mapa'}</p></div>
    <div className="sv-content">{target}<div className="sv-chips"><span className="sv-chip">{finished?'🪙 +'+data.premio:'🪙 '+data.maxPremio+' si aciertas'}</span></div>{!finished&&<p className="sv-muted sv-center">Si fallas no pierdes nada. Con escudo, te llevas 🪙 {data.premioConEscudo}.</p>}{fault}</div><footer className="sv-footer">{finished?<Button to={back}>▶ Seguir la partida</Button>:<><Button tone="danger" disabled={busy} onClick={()=>act('empezar')}>⚔️ ¡A por ello!</Button><Link className="sv-text-button sv-center" to={back} onClick={()=>act('descartar')}>Volver a la partida</Link></>}</footer></section>
}
