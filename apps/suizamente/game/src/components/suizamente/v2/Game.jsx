import {QuestionOptions} from './QuestionOptions'
import {FirstGameHint} from './FirstGameHint'
import './onboarding.css'
import {useMoment} from './Moment'
import {stampSteps,duelSteps,finishSteps} from './moments'
import {useCallback,useEffect,useRef,useState} from 'react'
import {Link,Navigate,useLocation,useNavigate,useParams} from 'react-router-dom'
import {useSv,useQuestionScreen} from './Context'
import {Avatar,Button,Card,Earnings,Header,Sheet,StampBar,Stamps,LatidoBackdrop,MatchWheel} from './Shared'
import {szApi} from '../../../lib/suizamenteV2'
import {loadPushSettings,subscribeToPushNotifications} from '../../../lib/pushNotifications'
import {usePushActivation} from '../../../hooks/usePushActivation'
import {DuelPrepare,DuelResult,Powerups} from './Duels'
import {Breakdown,FactCard,ShareSheet,storyData} from './Sharing'
import {feedback} from '../../../lib/suizamenteFeedback'
import {Confetti} from './Finish'
import {notify} from '../../../lib/suizamenteNotices'

function Passport({name,avatarName,color,owned,active,categories,id,fresh}){
  const {player}=useSv()
  return <div className={'sv-passport'+(active?' active':'')}><Link to={id&&id!==player.jugador_id?'/suizamente/jugador/'+id:'/suizamente/perfil'} aria-label={'Perfil de '+name}><Avatar id={id} name={name.includes('Buscando')?'\ud83d\udd0d':avatarName||name} color={name.includes('Buscando')?'gris':color}/></Link><div><b>{name}</b><small>{owned.length}/{categories.length} sellos</small></div><Stamps categories={categories} owned={owned} freshIds={fresh?[fresh]:[]}/></div>
}
export function Game(){
  const {id,sessionId}=useParams(),mid=id||sessionId
  const location=useLocation(),resume=useRef(new URLSearchParams(location.search).has('continuar'))
  const {config:globalConfig,player,user}=useSv(),navigate=useNavigate(),{show}=useMoment(),continuing=useRef(false)
  const [m,setM]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[spinning,setSpinning]=useState(false),[spinRun,setSpinRun]=useState(0)
  const spinFlight=useRef(null)
  const config={...globalConfig,...m?.configPartida}
  const [dismissed,setDismissed]=useState(null),[resign,setResign]=useState(false),[pushPrompt,setPushPrompt]=useState(false),[now,setNow]=useState(Date.now()),[offline,setOffline]=useState(!navigator.onLine)
  const [preparingDuel,setPreparingDuel]=useState(false)
  const [sharing,setSharing]=useState(false)
  const [handoff,setHandoff]=useState(false)
  const previousStamps=useRef(null),heard=useRef(new Set()),pendingStamp=useRef(''),[stampHit,setStampHit]=useState('')
  const offset=useRef(0),pending=useRef(false),mounted=useRef(true)
  const {needsActivation,refresh:refreshPush}=usePushActivation(user?.id)
  const receive=useCallback(data=>{
    if(!mounted.current)return
    if(resume.current){
      if(data.resultado&&!data.resultado.agotada)setDismissed(data.resultado.n)
      resume.current=false
      const search=new URLSearchParams(location.search);search.delete('continuar')
      navigate({pathname:location.pathname,search:search.toString()},{replace:true})
    }
    offset.current=Date.parse(data.servidorAhora)-Date.now()
    setM(data);setNow(Date.now());setOffline(false)
  },[])
  const load=useCallback(async()=>{
    try{receive(await szApi('partidas/'+mid));setError('')}
    catch(e){if(mounted.current){setError(e.message);setOffline(!navigator.onLine)}}
  },[mid,receive])
  useEffect(()=>{
    mounted.current=true;load()
    const poll=setInterval(()=>{if(!document.hidden&&!pending.current)load()},10000)
    const recover=()=>{if(!document.hidden&&!pending.current)load()},disconnected=()=>setOffline(true)
    window.addEventListener('online',recover);window.addEventListener('focus',recover);document.addEventListener('visibilitychange',recover);window.addEventListener('offline',disconnected)
    return()=>{mounted.current=false;clearInterval(poll);window.removeEventListener('online',recover);window.removeEventListener('focus',recover);document.removeEventListener('visibilitychange',recover);window.removeEventListener('offline',disconnected)}
  },[load])
  async function act(action,args={},state=m){
    if(pending.current)return null
    pending.current=true;setBusy(true);setError('')
    try{
      const next=await szApi('partidas/'+mid+'/'+action,{method:'POST',body:{turnoN:state.turnoN,...args}})
      receive(next);return next
    }catch(e){
      setError(e.message);setOffline(!navigator.onLine)
      if(e.partida)receive(e.partida)
      else if(e.status===409)await load()
      return null
    }finally{pending.current=false;if(mounted.current)setBusy(false)}
  }
  async function spin(){
    if(spinning||pending.current||!m?.teToca||!m.rival||m.fase!=='girar')return
    const next=await act('girar')
    if(!next)return
    setDismissed(m?.resultado?.n)
    spinFlight.current=next
    feedback('ruleta');setSpinning(true);setSpinRun(value=>value+1)
  }
  async function finishSpin(){
    const next=spinFlight.current;if(!next||!mounted.current)return
    spinFlight.current=null;setSpinning(false)
    if(next.fase==='elegida')await act('pregunta',{},next)
  }
  const q=m?.pregunta
  useQuestionScreen(!!q)
  const stampReady=m?.teToca&&m.fase==='sello'&&m.tuBarra>=config.partida.barraParaSello&&!q
  const activeResult=m?.resultado&&m.resultado.n!==dismissed&&!q&&!stampReady?m.resultado:null
  const solved=activeResult||(stampReady?m?.resultado:null)
  useEffect(()=>{
    if(!solved)return
    const key=mid+':'+solved.n
    if(!heard.current.has(key)){heard.current.add(key);feedback(solved.ok?'acierto':'fallo')}
  },[solved?.n,solved?.ok,mid])
  useEffect(()=>{if(m?.fase==='sello'&&m.teToca&&!spinning&&!q)document.querySelector('.sv-wheel-status')?.focus({preventScroll:true})},[m?.fase,m?.teToca,spinning,q?.n])
  useEffect(()=>{
    if(!m)return
    const fresh=previousStamps.current&&m.tusSellos.find(id=>!previousStamps.current.includes(id))
    previousStamps.current=m.tusSellos
    if(fresh){pendingStamp.current=fresh;feedback('sello')}
  },[m?.tusSellos.join(',')])
  useEffect(()=>{if(!q)return;const clock=setInterval(()=>{if(!document.hidden)setNow(Date.now())},1000);return()=>clearInterval(clock)},[!!q])
  const remaining=q?Math.max(0,Math.ceil((Date.parse(q.venceEn)-now-offset.current)/1000)):0
  useEffect(()=>{
    if(q||activeResult)document.querySelector('.sv-game .sv-question-content h1')?.focus()
    const key=e=>{
      if(!q||pending.current||remaining===0||e.ctrlKey||e.metaKey||e.altKey||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return
      const index=Number(e.key)-1
      if(Number.isInteger(index)&&index>=0&&index<q.opciones.length&&!q.quitadas?.includes(q.opciones[index].indice)&&!q.falladas?.includes(q.opciones[index].indice)){
        e.preventDefault();act('respuesta',{n:q.n,opcion:q.opciones[index].indice})
      }
    }
    window.addEventListener('keydown',key)
    return()=>window.removeEventListener('keydown',key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[q?.n,activeResult?.n,m?.turnoN,remaining===0])
  useEffect(()=>{
    if(!q)return
    const delay=Math.max(0,Date.parse(q.venceEn)+(m.margenServidorSegundos??config.partida.margenServidorSegundos)*1000-Date.now()-offset.current+100)
    const timeout=setTimeout(()=>{if(!pending.current)act('respuesta',{n:q.n,agotada:true})},delay)
    return()=>clearTimeout(timeout)
    // The question id/version uniquely identifies its deadline; use the current action closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[q?.n,q?.venceEn,m?.turnoN])
  useEffect(()=>{
    if(!m||q||activeResult)return
    if(m.duelo?.mostrarResultado){show(duelSteps(m,config),{key:'duelo:'+m.duelo.id,persist:true});return}
    if(!['jugando','buscando'].includes(m.estado))show(finishSteps(m,config),{key:'fin:'+m.id,persist:true})
  },[m,q,activeResult,show])
  async function continueResult(){
    if(continuing.current)return
    continuing.current=true
    try{
      if(m.resultado.ok&&m.resultado.modo==='sello')await show(stampSteps(m,config),{key:'sello:'+m.id+':'+m.resultado.n,persist:true})
      setDismissed(m.resultado.n)
      if(pendingStamp.current){setStampHit(pendingStamp.current);pendingStamp.current='';setTimeout(()=>{if(mounted.current)setStampHit('')},500)}
      if(m.duelo?.mostrarResultado)return
      if(m.duelo&&m.duelo.estado!=='terminado'&&m.teToca&&m.fase==='duelo'){
        await act('pregunta');return
      }
      if(!m.teToca&&['jugando','buscando'].includes(m.estado))setHandoff(true)
    }finally{continuing.current=false}
  }
  function finishTurn(){
    setHandoff(false)
    const last=Number(localStorage.getItem('suizamente:aviso-pedido')||0)
    if(needsActivation&&Date.now()-last>7*86400000){localStorage.setItem('suizamente:aviso-pedido',String(Date.now()));setPushPrompt(true)}
    else navigate('/suizamente')
  }
  if(!m)return <section className="sv-screen"><Header title="Partida"/><div className="sv-content">{error?<><p className="sv-error" role="alert">{error}</p><Button onClick={load}>Reintentar</Button></>:<div className="sv-skeleton" role="status" aria-label="Cargando la partida"/>}</div></section>
  const categories=config.categorias,result=activeResult
  const category=categories.find(c=>c.id===(q?.categoria||result?.categoria))||categories[0]
  const ended=!['jugando','buscando'].includes(m.estado)
  const choosing=m.fase==='sello'&&m.teToca&&!spinning,themed=!q&&!result
  const tint=ended?(m.ganador===m.tuId?'#FEEDD1':'#DFE7FC'):choosing?'#FEEDD1':m.fase==='duelo'?'#FFE1E2':'#D3F2F9'
  const passports=<div className="sv-passports sv-match-players"><Passport id={player.jugador_id} name={player.apodo} color={player.color} fresh={stampHit} owned={m.tusSellos} active={!!m.teToca&&!!m.rival} categories={categories}/><div className="sv-match-score" aria-label={m.tusSellos.length+' a '+m.susSellos.length+' sellos'}><strong>{m.tusSellos.length}</strong><small>VS</small><strong>{m.susSellos.length}</strong></div><Passport id={m.rival?.jugador_id||m.rival?.id} name={m.rival?.apodo||'Espera rival'} color={m.rival?.color} owned={m.susSellos} active={!m.teToca&&!!m.rival} categories={categories}/></div>
  if(preparingDuel)return <DuelPrepare match={m} act={act} onClose={()=>setPreparingDuel(false)}/>
  if(m.asalto?.estado==='pregunta')return <Navigate to={'/suizamente/asalto/'+m.asalto.id} replace/>
  if(!q&&!result&&m.duelo?.mostrarResultado)return <DuelResult match={m} act={act} busy={busy}/>
  return <section className={'sv-screen sv-game'+(themed?' sv-themed-screen '+(ended?'sv-game-finish':choosing?'sv-game-seal':'sv-game-board'):'')}>
    {themed&&<LatidoBackdrop tint={tint} deco={!ended&&!choosing&&m.fase!=='duelo'}/>}
    {ended&&m.ganador===m.tuId&&<Confetti/>}
    {handoff&&<Sheet title={'Le toca a '+(m.rival?.apodo||'tu rival')} onClose={finishTurn}><p>Te avisamos cuando vuelva a tocarte.</p><Button onClick={finishTurn}>Volver a Inicio</Button></Sheet>}
    {offline&&<p className="sv-offline-status" role="status">Sin conexión · reintentando…</p>}
    {q||result?<><header className="sv-question-header" style={{background:category.color,color:category.colorTexto}}><span>{category.emoji}</span><div><small>RONDA {m.ronda} · CONTRA {m.rival?.apodo?.toUpperCase()||'TU RIVAL'}</small><b>{category.nombre}</b></div><span className={'sv-clock'+(remaining<=5&&!result?' urgent':'')}>{result?result.ok?'✓':'✕':remaining}</span>{q&&<div className="sv-time-bar"><i style={{width:Math.min(100,remaining/q.tiempo*100)+'%'}}/></div>}</header>
      <div className="sv-content sv-question-content">
        {q?<><Card className="sv-question-card"><span aria-hidden="true">{q.emoji}</span><h1 tabIndex={-1}>{q.pregunta}</h1>{q.autor&&<small>Propuesta por {q.autor}</small>}</Card>{q.otraUsada&&<p className="sv-retry" role="status">🔁 ¡Otra oportunidad! Elige otra vez</p>}<QuestionOptions question={q} busy={busy} expired={remaining===0} onAnswer={opcion=>act('respuesta',{n:q.n,opcion})}/>{q.modo==='normal'&&player.ajustes?.guia?.comodin&&(!player.ajustes.guia.partida||player.ajustes.guia.partida===mid)&&<FirstGameHint kind="comodin"/>}{remaining===0&&<p role="status">⏰ ¡Se acabó el tiempo!</p>}</>:<>
          <h1 tabIndex={-1} className={'sv-result-title '+(result.ok?'correct':'wrong')}>{result.agotada?'⏰ ¡Se acabó el tiempo!':result.ok?'¡Correcto!':'¡Uy! No era esa'}</h1><p className="sv-result-question">{result.pregunta}</p>
          <QuestionOptions question={result} result={result}/>
          {result.pct!==null&&<p className="sv-stat">👥 El {result.pct} % de hispanohablantes en Suiza acertó</p>}
          <FactCard id={result.preguntaId} dato={result.dato} question={result.pregunta} guardada={result.guardada}/>
          <Breakdown id={result.preguntaId} real/>
        </>}
        {error&&<p className="sv-error" role="alert">{error} <button className="sv-text-button" onClick={load}>Reintentar</button></p>}
      </div>
      {q&&<Powerups match={m} act={act} busy={busy} remaining={remaining}/>}
      {result&&<footer className="sv-footer"><Earnings value={result.ganado}/>{result.evento&&<p className="sv-center">{result.evento}</p>}{m.asalto&&<Button tone="danger" to={"/suizamente/asalto/"+m.asalto.id}>⚔️ ¡Asalto disponible!</Button>}<StampBar value={m.tuBarra} max={config.partida.barraParaSello}/><Button onClick={continueResult}>{m.duelo?.mostrarResultado?'Ver resultado del duelo':ended?'Ver resultado':m.teToca?(m.fase==='sello'?'🛂 ¡Juega por un sello!':m.fase==='duelo'?'▶ Siguiente pregunta':'Continuar'):'Le toca a '+(m.rival?.apodo||'tu rival')}</Button></footer>}
    </>:ended?<><Header title={m.ganador===m.tuId?'¡Victoria!':m.ganador?'Esta vez no':'Partida terminada'}/><div className="sv-content sv-finish"><span className="sv-finish-emoji" aria-hidden="true">{m.ganador===m.tuId?'🏆':'🛂'}</span><h1>{m.tusSellos.length} – {m.susSellos.length}</h1>{passports}<Earnings value={m.premio}/><p>{m.motivoFin==='plazo'?'El plazo del turno ha terminado.':m.motivoFin==='rendicion'?'La partida ha terminado por abandono.':m.motivoFin==='rondas'?'Fin de las '+m.rondasMax+' rondas.':'Pasaporte completo.'}</p></div><footer className="sv-footer"><Button tone="quiet" onClick={()=>setSharing(true)}>📤 Compartir</Button>{m.cofre&&<Button to={"/suizamente/cofre/"+m.cofre.id+"?volver="+encodeURIComponent("/suizamente/partida/"+m.id+"?continuar=1")}>{m.cofre.abierto?"🎁 Ver el cofre":"🎁 Abrir el cofre"}</Button>}{globalConfig.apiVersion>=17&&m.rival&&m.ganador===m.tuId&&<><Button to={'/suizamente/ataque/'+m.id}>Atacar ahora</Button><Button tone="quiet" onClick={()=>{notify('Puedes atacar desde tus partidas terminadas.');navigate('/suizamente?terminadas=1')}}>Atacar después</Button></>}<Button tone="quiet" to="/suizamente">🏠 Inicio</Button>{error&&<p role="alert" className="sv-error">{error}</p>}</footer></>:
    <><Header title={'Ronda '+m.ronda} subtitle={'de '+m.rondasMax+' como máximo'} right={<button className="sv-icon-button" aria-label="Más opciones: rendirse" onClick={()=>setResign(true)}>⋯</button>}/>{passports}<div className="sv-wheel-area">
      {choosing&&<b className="sv-wheel-status" tabIndex={-1} role="heading" aria-level={2}>{spinning?'…':!m.rival?'🔍 Buscando rival…':m.teToca?m.fase==='sello'?(stampReady?'¡'+config.partida.barraParaSello+' aciertos! Elige tu sello':'🛂 Elige tu sello'):'¡Te toca! Gira la ruleta':'⏳ Turno de '+m.rival.apodo}</b>}
      {m.fase==='sello'&&m.teToca&&!spinning?<><div className="sv-stamp-choice">{categories.map(c=><button disabled={busy||m.tusSellos.includes(c.id)} key={c.id} style={{'--category':c.color,'--tint':c.tinte}} onClick={()=>act('pregunta',{modo:'sello',categoria:c.id})}><span>{c.emoji}</span><b>{c.nombre}</b>{m.tusSellos.includes(c.id)&&<small>✓ Lo tienes</small>}</button>)}</div>{m.dueloDisponible&&<button className="sv-duel-invite" disabled={busy} onClick={()=>setPreparingDuel(true)}>⚔️ Duelo de sellos<small>Quítale un sello a tu rival</small></button>}</>:m.fase==='duelo'?<Card className="sv-empty sv-duel-wait"><span>⚔️</span><h2>Duelo de sellos</h2><p>{m.duelo?.desempate?'Pregunta de desempate':(m.duelo?.tusAciertos.length||0)+' de '+config.duelo.preguntas+' preguntas respondidas'}</p><div className="sv-duel-progress">{categories.map((c,i)=><span key={c.id} title={c.nombre}>{m.duelo?.tusAciertos[i]===undefined?c.emoji:m.duelo.tusAciertos[i]?'✓':'✕'}</span>)}</div></Card>:<MatchWheel categories={categories} value={m.tuBarra} max={config.partida.barraParaSello} spinning={spinning} run={spinRun} target={spinFlight.current?.casilla||m.casilla} duration={config.ruleta.duracionGiroMs} onSpin={()=>m.fase==='elegida'?act('pregunta'):spin()} onComplete={finishSpin} yourTurn={!!m.teToca&&!!m.rival} rival={m.rival?.apodo} disabled={busy||spinning||!m.teToca||!m.rival||!['girar','elegida'].includes(m.fase)}/>}
      {m.teToca&&m.rival&&m.fase==='girar'&&!spinning&&player.ajustes?.guia?.giro&&(!player.ajustes.guia.partida||player.ajustes.guia.partida===mid)&&<FirstGameHint kind="giro"/>}
      {!m.rival&&<p className="sv-muted">Esta partida aún no tiene rival. Vuelve a Nueva partida para elegir a alguien disponible.</p>}
      {choosing&&<StampBar value={m.tuBarra} max={config.partida.barraParaSello}/>}
      {error&&<p className="sv-error" role="alert">{error}</p>}
    </div><footer className="sv-footer">{m.fase==='duelo'&&m.teToca&&<Button disabled={busy||spinning} onClick={()=>act('pregunta')}>Continuar</Button>}<div className="sv-game-inventory" role="group" aria-label="Tus comodines: se usan en la pregunta">{config.comodines.map(c=><span key={c.id} role="img" aria-label={c.nombre+': tienes '+(player.inventario?.[c.id]||0)}><span aria-hidden="true">{c.emoji}</span><b aria-hidden="true">{player.inventario?.[c.id]||0}</b></span>)}</div></footer></>}

    {resign&&<Sheet title="¿Rendirte?" onClose={()=>setResign(false)}><p>La partida cuenta como abandonada.</p><Button onClick={()=>setResign(false)}>Seguir jugando</Button><Button tone="danger-text" disabled={busy} onClick={async()=>{await act('rendirse');setResign(false)}}>Rendirme</Button></Sheet>}
    {sharing&&<ShareSheet data={storyData('fin',{...m,categorias:categories})} onClose={()=>setSharing(false)}/>}
    {pushPrompt&&<Sheet title="🔔 ¿Te avisamos cuando te toque?" onClose={()=>{setPushPrompt(false);navigate('/suizamente')}}><Button onClick={async()=>{
      try{await subscribeToPushNotifications({user,settings:loadPushSettings(),userCanton:player.canton});await refreshPush();setPushPrompt(false);navigate('/suizamente')}catch(e){setError(e.message);setPushPrompt(false)}
    }}>Sí, avisadme</Button><Button tone="quiet" onClick={()=>{setPushPrompt(false);navigate('/suizamente')}}>Ahora no</Button></Sheet>}
  </section>
}
