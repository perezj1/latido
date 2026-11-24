import {useCallback,useEffect,useRef,useState} from 'react'
import {Link,Navigate,useLocation,useNavigate,useParams} from 'react-router-dom'
import {useSv,useQuestionScreen} from './Context'
import {Avatar,Button,Card,Earnings,Header,Sheet,StampBar,Stamps,Wallet,Wheel} from './Shared'
import {szApi,timeLeft} from '../../../lib/suizamenteV2'
import {loadPushSettings,subscribeToPushNotifications} from '../../../lib/pushNotifications'
import {usePushActivation} from '../../../hooks/usePushActivation'
import {DuelPrepare,DuelResult,Powerups} from './Duels'
import {HomeMap} from './Map'
import {Breakdown,FactCard,ShareSheet,storyData} from './Sharing'
import {feedback} from '../../../lib/suizamenteFeedback'
import {Confetti} from './Finish'
import {DurationHome} from './Duration'

function Passport({name,avatarName,color,owned,active,categories,id,fresh}){
  return <div className={'sv-passport'+(active?' active':'')}><Link to={id?'/suizamente/jugador/'+id:'/suizamente/perfil'} aria-label={'Perfil de '+name}><Avatar name={name.includes('Buscando')?'\ud83d\udd0d':avatarName||name} color={name.includes('Buscando')?'gris':color}/></Link><div><b>{name}</b><small>{owned.length}/{categories.length} sellos</small></div><Stamps categories={categories} owned={owned} freshIds={fresh?[fresh]:[]}/></div>
}
function MatchHistoryRow({match}){
  const {user}=useSv(),navigate=useNavigate(),[busy,setBusy]=useState(false),[error,setError]=useState('')
  async function rematch(){
    if(!user){navigate('/suizamente/entrar');return}
    setBusy(true);try{const result=await szApi('partidas',{method:'POST',body:{rival:match.rival.id}});navigate('/suizamente/partida/'+result.id)}catch(e){setError(e.message)}finally{setBusy(false)}
  }
  return <Card className="sv-match-history"><Link className="sv-match" to={'/suizamente/partida/'+match.id}>
    <Avatar name={match.rival?.apodo||'?'} color={match.rival?.color}/><div><b>{match.rival?.apodo||'Perfil eliminado'}</b><small>{match.terminadaEn&&new Intl.DateTimeFormat('es-CH',{dateStyle:'medium',timeZone:'Europe/Zurich'}).format(new Date(match.terminadaEn))}</small></div><strong>{match.tusSellos.length}–{match.susSellos.length}</strong>
  </Link>{match.rival&&<Button tone="quiet" disabled={busy} onClick={rematch}>🔁 Revancha</Button>}{error&&<p role="alert" className="sv-error">{error}</p>}</Card>
}
export function Home(){
  const {player,config}=useSv()
  const [matches,setMatches]=useState([]),[event,setEvent]=useState(null),[error,setError]=useState(''),[history,setHistory]=useState(false)
  const load=useCallback(async()=>{
    try{const data=await szApi('partidas'+(history?'?terminadas=true':''));setMatches(data.partidas.filter(m=>!history||!['buscando','jugando'].includes(m.estado)));setEvent(data.evento);setError('')}catch(e){setError(e.message)}
  },[history])
  useEffect(()=>{load();const timer=setInterval(load,15000);return()=>clearInterval(timer)},[load])
  const waiting=matches.filter(m=>m.teToca&&['jugando','buscando'].includes(m.estado)).length
  return <section className="sv-screen sv-home-screen"><header className="sv-home-header"><Link to="/suizamente/perfil" aria-label={'Tu perfil. Nivel '+player.nivel}><Avatar name={player.apodo} color={player.color} level={player.nivel}/></Link><span className="sv-chip" aria-label={'Racha de '+(player.racha||0)+' días'}>🔥 {player.racha||0}</span><Wallet/><Link className="sv-icon-button" to="/suizamente/menu" aria-label="Menú">☰</Link></header>
    <div className="sv-content">{event&&Date.parse(event.fin)>Date.now()&&<Card className="sv-weekend-event"><b>🎉 {event.titulo}</b><p>{event.efecto}</p><small>⏳ {timeLeft(event.fin)}</small></Card>}<h1 className="sv-sr-only">Hola, {player.apodo}</h1><HomeMap/><Button to="/suizamente/nueva">▶ Jugar</Button><div className="sv-between sv-section-heading"><h2>Tus partidas</h2><span>{waiting?waiting+' te esperan':''}</span></div>
    {error?<Card><p className="sv-error" role="alert">{error}</p><Button onClick={load} tone="quiet">Reintentar</Button></Card>:!matches.length?<Card className="sv-empty"><span aria-hidden="true">🎡</span><p>{history?'Aún no tienes partidas terminadas':'Aún no tienes partidas'}</p><Link to="/suizamente/nueva">▶ Jugar</Link></Card>:<div className={history?"sv-match-list":"sv-match-carousel"}>{!history&&<Link className="sv-new-match" to="/suizamente/nueva"><span>＋</span>Nueva</Link>}{matches.map(m=>history?<MatchHistoryRow key={m.id} match={m}/>:<Link key={m.id} className={'sv-match '+(m.teToca?'your-turn':'')} to={'/suizamente/partida/'+m.id}><Avatar name={m.rival?.apodo||'?'} color={m.rival?.color}/><div><b>{m.rival?.apodo||'Buscando rival…'}</b><small>{m.tusSellos.length} – {m.susSellos.length} sellos</small></div><div><b>{!['jugando','buscando'].includes(m.estado)?m.ganador===m.tuId?'Victoria':'Terminada':m.teToca?'¡Te toca!':'Su turno'}</b><small>{['jugando','buscando'].includes(m.estado)?'⏳ '+timeLeft(m.plazo):''}</small></div></Link>)}</div>}
    <button className="sv-text-button" onClick={()=>setHistory(x=>!x)}>{history?'Ver solo abiertas':'Ver terminadas ›'}</button><DurationHome/></div>
  </section>
}
export function NewGame({invitation}){
  const {user}=useSv(),navigate=useNavigate()
  const [query,setQuery]=useState(''),[players,setPlayers]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[invite,setInvite]=useState('')
  const [lobby,setLobby]=useState(null),[matches,setMatches]=useState([]),[filter,setFilter]=useState('todas'),[searching,setSearching]=useState(false)
  useEffect(()=>{
    if(invitation)return
    let alive=true
    const refresh=async()=>{
      if(document.hidden)return
      const results=await Promise.allSettled([szApi('emparejamiento'),szApi('partidas')])
      if(!alive)return
      if(results[0].status==='fulfilled'){setLobby(results[0].value);setError('')}else{setLobby(null);setError(results[0].reason.message)}
      if(results[1].status==='fulfilled')setMatches(results[1].value.partidas)
    }
    refresh();const timer=setInterval(refresh,15000)
    window.addEventListener('focus',refresh)
    return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',refresh)}
  },[invitation])
  useEffect(()=>{
    if(!user||invitation||!query.trim()){setPlayers([]);setSearching(false);return}
    let active=true
    setSearching(true)
    const timer=setTimeout(()=>szApi('jugadores?q='+encodeURIComponent(query)).then(result=>{if(active)setPlayers(result)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setSearching(false)}),300)
    return()=>{active=false;clearTimeout(timer)}
  },[query,user,invitation])
  async function start(rival){
    if(busy)return
    setBusy(true);setError('')
    try{const m=await szApi('partidas',{method:'POST',body:{rival}});navigate('/suizamente/partida/'+m.id)}catch(e){setError(e.message);if(rival==='azar')setLobby(null)}finally{setBusy(false)}
  }
  async function makeInvite(){
    if(!user){navigate('/auth?next='+encodeURIComponent('/suizamente/nueva'));return}
    setBusy(true);setError('')
    try{
      const data=await szApi('invitaciones',{method:'POST'})
      const link=location.origin+data.enlace
      setInvite(link)
      if(navigator.share)await navigator.share({title:'Una partida de Suizamente',text:'¿Jugamos una partida?',url:link})
      else if(navigator.clipboard)await navigator.clipboard.writeText(link)
    }catch(e){if(e.name!=='AbortError')setError(e.message)}finally{setBusy(false)}
  }
  return <section className="sv-screen sv-lobby"><Header title={invitation?'Te han invitado':'Nueva partida'}/><div className="sv-content">
    {invitation?<Card className="sv-empty"><span aria-hidden="true">📨</span><h2>Tu partida te espera</h2><p>Acepta la invitación y juega tu primer turno.</p><Button disabled={busy} onClick={()=>start(invitation)}>▶ Aceptar invitación</Button></Card>:<>
      <label className="sv-search"><span aria-hidden="true">🔍</span><input type="search" aria-label="Buscar jugadores por apodo" placeholder="Buscar un jugador por apodo" value={query} onChange={e=>setQuery(e.target.value)} disabled={!user}/></label>
      {!user&&<Link className="sv-text-button" to={'/auth?next='+encodeURIComponent('/suizamente/nueva')}>Entra con Latido para buscar jugadores</Link>}
      {query.trim()&&user&&<div className="sv-player-list" aria-live="polite">{searching?<p role="status">Buscando jugadores…</p>:players.length?players.map(p=><div key={p.id}><Avatar name={p.apodo} color={p.color}/><span><b>{p.apodo}</b><small>Nivel {p.nivel}</small></span><button disabled={busy} onClick={()=>start(p.id)}>▶ Jugar</button></div>):<p>No encontramos ese apodo. Prueba otro o comparte una invitación.</p>}</div>}
      <div className="sv-lobby-invites"><button disabled={busy} onClick={makeInvite}><span aria-hidden="true">📨</span><b>Invitar amigos</b><small>Comparte una partida</small></button><Link to="/suizamente/amigos"><span aria-hidden="true">👥</span><b>Tus amigos</b><small>Encuentra con quién jugar</small></Link></div>
      {invite&&<Card><p>Enlace listo para compartir</p><input aria-label="Enlace de invitación" readOnly value={invite} onFocus={e=>e.target.select()}/><Button tone="quiet" onClick={async()=>{try{await navigator.clipboard.writeText(invite)}catch{setError('Selecciona y copia el enlace.')}}}>Copiar enlace</Button></Card>}
      <div className="sv-between sv-section-heading sv-lobby-section"><h2>Seguir jugando</h2><label className="sv-lobby-filter"><span className="sv-sr-only">Filtrar partidas</span><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="todas">Todas</option><option value="turno">Mi turno</option><option value="rival">Su turno</option></select></label></div>
      {matches.filter(m=>filter==='todas'||(filter==='turno'?m.teToca:!m.teToca)).length?<div className="sv-match-carousel">{matches.filter(m=>filter==='todas'||(filter==='turno'?m.teToca:!m.teToca)).map(m=><Link key={m.id} className={'sv-match '+(m.teToca&&m.rival?'your-turn':'')} to={'/suizamente/partida/'+m.id}><Avatar name={m.rival?.apodo||'?'} color={m.rival?.color}/><b>{m.rival?.apodo||'Espera rival'}</b><small>{m.tusSellos.length} – {m.susSellos.length} sellos</small><b>{!m.rival?'Pendiente':m.teToca?'¡Te toca!':'Su turno'}</b><small>{timeLeft(m.plazo)}</small></Link>)}</div>:<Card><p className="sv-muted">{matches.length?'No tienes partidas con este filtro.':'Todavía no tienes partidas abiertas.'}</p></Card>}
      <h2 className="sv-section-heading">Iniciar una partida</h2><div className="sv-start-players"><button className="sv-start-random" disabled={busy||!lobby?.disponible} onClick={()=>start('azar')} aria-describedby="sv-random-availability"><span aria-hidden="true">🎲</span><b>Rival al azar</b><small>{lobby?.disponible?'Hay alguien para jugar':'Sin rivales disponibles'}</small></button>{lobby?.jugadores.map(p=><button key={p.id} disabled={busy||!user} onClick={()=>start(p.id)}><Avatar name={p.apodo} color={p.color}/><b>{p.apodo}</b><small>Nivel {p.nivel} · Disponible</small></button>)}</div><p id="sv-random-availability" className="sv-muted">{lobby?.disponible?'Empezarás con otra persona de Latido.':lobby?'Ahora no hay nadie disponible. Invita a un amigo o vuelve en un momento.':'Comprobando quién está disponible…'}</p>
    </>}
    {error&&<p role="alert" className="sv-error">{error}</p>}{busy&&<p role="status">Preparando la partida…</p>}
  </div></section>
}
export function Game(){
  const {id,sessionId}=useParams(),mid=id||sessionId
  const location=useLocation(),resume=useRef(new URLSearchParams(location.search).has('continuar'))
  const {config:globalConfig,player,user,settings}=useSv(),navigate=useNavigate()
  const [m,setM]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[rotation,setRotation]=useState(0),[spinning,setSpinning]=useState(false)
  const config={...globalConfig,...m?.configPartida}
  const [dismissed,setDismissed]=useState(null),[resign,setResign]=useState(false),[pushPrompt,setPushPrompt]=useState(false),[now,setNow]=useState(Date.now()),[offline,setOffline]=useState(!navigator.onLine)
  const [preparingDuel,setPreparingDuel]=useState(false)
  const [sharing,setSharing]=useState(false)
  const [handoff,setHandoff]=useState(false),[stampNotice,setStampNotice]=useState('')
  const [advantage,setAdvantage]=useState(null)
  const previousStamps=useRef(null),heard=useRef(new Set()),pendingStamp=useRef(''),[stampHit,setStampHit]=useState('')
  const offset=useRef(0),timer=useRef(null),pending=useRef(false),mounted=useRef(true)
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
    const poll=setInterval(()=>{if(!pending.current)load()},10000),clock=setInterval(()=>setNow(Date.now()),200)
    const recover=()=>load(),disconnected=()=>setOffline(true)
    window.addEventListener('online',recover);window.addEventListener('offline',disconnected)
    return()=>{mounted.current=false;clearInterval(poll);clearInterval(clock);clearTimeout(timer.current);window.removeEventListener('online',recover);window.removeEventListener('offline',disconnected)}
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
    const next=await act('girar')
    if(!next)return
    setDismissed(m?.resultado?.n)
    const slots=[...config.categorias.map(c=>c.id),'sello'],target=(360-slots.indexOf(next.casilla)*360/slots.length)%360
    setRotation(old=>old+1440+((target-old%360+360)%360))
    feedback('ruleta');setSpinning(true)
    const reduced=settings.menosAnimaciones||matchMedia('(prefers-reduced-motion: reduce)').matches
    timer.current=setTimeout(async()=>{
      setSpinning(false)
      if(next.fase==='elegida')await act('pregunta',{},next)
    },reduced?0:config.ruleta.duracionGiroMs)
  }
  const q=m?.pregunta
  useQuestionScreen(!!q)
  const activeResult=m?.resultado&&m.resultado.n!==dismissed&&!q?m.resultado:null
  useEffect(()=>{
    if(!activeResult)return
    const key=mid+':'+activeResult.n
    if(!heard.current.has(key)){heard.current.add(key);feedback(activeResult.ok?'acierto':'fallo')}
  },[activeResult?.n,activeResult?.ok,mid])
  useEffect(()=>{
    if(!m)return
    const fresh=previousStamps.current&&m.tusSellos.find(id=>!previousStamps.current.includes(id))
    previousStamps.current=m.tusSellos
    if(fresh){pendingStamp.current=fresh;feedback('sello');setStampNotice('🛂 Sello ganado: '+config.categorias.find(c=>c.id===fresh)?.nombre);const timer=setTimeout(()=>setStampNotice(''),3000);return()=>clearTimeout(timer)}
  },[m?.tusSellos.join(',')])
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
  async function continueResult(){
    setDismissed(m.resultado.n)
    if(pendingStamp.current){setStampHit(pendingStamp.current);pendingStamp.current='';setTimeout(()=>{if(mounted.current)setStampHit('')},500)}
    if(m.duelo?.mostrarResultado)return
    if(m.duelo&&m.duelo.estado!=='terminado'&&m.teToca&&m.fase==='duelo'){
      await act('pregunta');return
    }
    if(!m.teToca&&['jugando','buscando'].includes(m.estado))setHandoff(true)
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
  const passports=<div className="sv-passports sv-match-players"><Passport name={player.apodo} color={player.color} fresh={stampHit} owned={m.tusSellos} active={!!m.teToca&&!!m.rival} categories={categories}/><div className="sv-match-score" aria-label={m.tusSellos.length+' a '+m.susSellos.length+' sellos'}><strong>{m.tusSellos.length}</strong><small>VS</small><strong>{m.susSellos.length}</strong></div><Passport id={m.rival?.jugador_id||m.rival?.id} name={m.rival?.apodo||'Espera rival'} color={m.rival?.color} owned={m.susSellos} active={!m.teToca&&!!m.rival} categories={categories}/></div>
  if(preparingDuel)return <DuelPrepare match={m} act={act} onClose={()=>setPreparingDuel(false)}/>
  if(m.asalto?.estado==='pregunta')return <Navigate to={'/suizamente/asalto/'+m.asalto.id} replace/>
  if(!q&&!result&&m.duelo?.mostrarResultado)return <DuelResult match={m} act={act} busy={busy}/>
  return <section className="sv-screen sv-game">
    {stampNotice&&<div className="sv-notice" role="status">{stampNotice}</div>}
    {ended&&m.ganador===m.tuId&&<Confetti/>}
    {handoff&&<Sheet title={'Le toca a '+(m.rival?.apodo||'tu rival')} onClose={finishTurn}><p>Te avisamos cuando vuelva a tocarte.</p><Button onClick={finishTurn}>Volver a Inicio</Button></Sheet>}
    {offline&&<p className="sv-connection" role="status">Sin conexión · reintentando…</p>}
    {q||result?<><header className="sv-question-header" style={{background:category.color,color:category.colorTexto}}><span>{category.emoji}</span><div><small>RONDA {m.ronda} · CONTRA {m.rival?.apodo?.toUpperCase()||'TU RIVAL'}</small><b>{category.nombre}</b></div><span className={'sv-clock'+(remaining<=5&&!result?' urgent':'')}>{result?result.ok?'✓':'✕':remaining}</span>{q&&<div className="sv-time-bar"><i style={{width:Math.min(100,remaining/q.tiempo*100)+'%'}}/></div>}</header>
      <div className="sv-content sv-question-content">
        {q?<><Card className="sv-question-card"><span aria-hidden="true">{q.emoji}</span><h1 tabIndex={-1}>{q.pregunta}</h1>{q.autor&&<small>Propuesta por {q.autor}</small>}</Card>{q.otraUsada&&<p className="sv-retry" role="status">🔁 ¡Otra oportunidad! Elige otra vez</p>}<div className="sv-options">{q.opciones.map(o=><button key={o.indice} disabled={busy||remaining===0||q.quitadas?.includes(o.indice)||q.falladas?.includes(o.indice)} className={q.quitadas?.includes(o.indice)||q.falladas?.includes(o.indice)?'sv-option-removed':''} onClick={()=>act('respuesta',{n:q.n,opcion:o.indice})}><span aria-hidden="true">{o.e}</span><b>{o.t}</b></button>)}</div>{remaining===0&&<p role="status">⏰ ¡Se acabó el tiempo!</p>}</>:<>
          <h1 tabIndex={-1} className={'sv-result-title '+(result.ok?'correct':'wrong')}>{result.agotada?'⏰ ¡Se acabó el tiempo!':result.ok?'¡Correcto!':'¡Uy! No era esa'}</h1><p className="sv-result-question">{result.pregunta}</p>
          <div className="sv-options result">{result.opciones.map(o=><div key={o.indice} className={o.indice===result.correcta?'correct':o.indice===result.opcion?'wrong':'muted'}><span>{o.indice===result.correcta?'✓':o.indice===result.opcion?'✕':o.e}</span><b>{o.t}</b></div>)}</div>
          {result.pct!==null&&<p className="sv-stat">👥 El {result.pct} % de hispanohablantes en Suiza acertó</p>}
          <FactCard id={result.preguntaId} dato={result.dato} question={result.pregunta} guardada={result.guardada}/>
          <Breakdown id={result.preguntaId} real/>
        </>}
        {error&&<p className="sv-error" role="alert">{error} <button className="sv-text-button" onClick={load}>Reintentar</button></p>}
      </div>
      {q&&<Powerups match={m} act={act} busy={busy} remaining={remaining}/>}
      {result&&<footer className="sv-footer"><Earnings value={result.ganado}/>{result.evento&&<p className="sv-center">{result.evento}</p>}{m.asalto&&<Button tone="danger" to={"/suizamente/asalto/"+m.asalto.id}>⚔️ ¡Asalto disponible!</Button>}<StampBar value={m.tuBarra} max={config.partida.barraParaSello}/><Button onClick={continueResult}>{m.duelo?.mostrarResultado?'Ver resultado del duelo':ended?'Ver resultado':m.teToca?(m.fase==='sello'?'🛂 ¡Juega por un sello!':m.fase==='duelo'?'▶ Siguiente pregunta':'🎡 Girar otra vez'):'Le toca a '+(m.rival?.apodo||'tu rival')}</Button></footer>}
    </>:ended?<><Header title={m.ganador===m.tuId?'¡Victoria!':m.ganador?'Esta vez no':'Partida terminada'}/><div className="sv-content sv-finish"><span className="sv-finish-emoji" aria-hidden="true">{m.ganador===m.tuId?'🏆':'🛂'}</span><h1>{m.tusSellos.length} – {m.susSellos.length}</h1>{passports}<Earnings value={m.premio}/><p>{m.motivoFin==='plazo'?'El plazo del turno ha terminado.':m.motivoFin==='rendicion'?'La partida ha terminado por abandono.':m.motivoFin==='rondas'?'Fin de las '+m.rondasMax+' rondas.':'Pasaporte completo.'}</p></div><footer className="sv-footer"><Button tone="quiet" onClick={()=>setSharing(true)}>📤 Compartir</Button>{m.cofre&&<Button to={"/suizamente/cofre/"+m.cofre.id+"?volver="+encodeURIComponent("/suizamente/partida/"+m.id+"?continuar=1")}>{m.cofre.abierto?"🎁 Ver el cofre":"🎁 Abrir el cofre"}</Button>}{m.rival&&<Button disabled={busy} onClick={async()=>{setBusy(true);try{const next=await szApi('partidas',{method:'POST',body:{rival:m.rival.id}});navigate('/suizamente/partida/'+next.id)}catch(e){setError(e.message)}finally{setBusy(false)}}}>🔁 Revancha</Button>}<Button tone="quiet" to="/suizamente">🏠 Inicio</Button>{error&&<p role="alert" className="sv-error">{error}</p>}</footer></>:
    <><Header title={'Ronda '+m.ronda} right={<button className="sv-icon-button" aria-label="Más opciones: rendirse" onClick={()=>setResign(true)}>⋯</button>}/><p className="sv-round-limit">de {m.rondasMax} como máximo</p><div className="sv-game-inventory" aria-label="Tus comodines">{config.comodines.map(c=><button key={c.id} onClick={()=>setAdvantage(c)} aria-label={c.nombre+': tienes '+(player.inventario?.[c.id]||0)}><span aria-hidden="true">{c.emoji}</span><b>{player.inventario?.[c.id]||0}</b></button>)}</div>{passports}<div className="sv-wheel-area">
      <b>{spinning?'…':!m.rival?'🔍 Buscando rival…':m.teToca?m.fase==='sello'?'🛂 Elige tu sello':'¡Te toca! Gira la ruleta':'⏳ Turno de '+m.rival.apodo}</b>
      {m.fase==='sello'&&m.teToca&&!spinning?<><div className="sv-stamp-choice">{categories.map(c=><button disabled={busy||m.tusSellos.includes(c.id)} key={c.id} style={{'--category':c.color,'--tint':c.tinte}} onClick={()=>act('pregunta',{modo:'sello',categoria:c.id})}><span>{c.emoji}</span><b>{c.nombre}</b>{m.tusSellos.includes(c.id)&&<small>✓ Lo tienes</small>}</button>)}</div>{m.dueloDisponible&&<button className="sv-duel-invite" disabled={busy} onClick={()=>setPreparingDuel(true)}>⚔️ Duelo de sellos<small>Quítale un sello a tu rival</small></button>}</>:m.fase==='duelo'?<Card className="sv-empty sv-duel-wait"><span>⚔️</span><h2>Duelo de sellos</h2><p>{m.duelo?.desempate?'Pregunta de desempate':(m.duelo?.tusAciertos.length||0)+' de '+config.duelo.preguntas+' preguntas respondidas'}</p><div className="sv-duel-progress">{categories.map((c,i)=><span key={c.id} title={c.nombre}>{m.duelo?.tusAciertos[i]===undefined?c.emoji:m.duelo.tusAciertos[i]?'✓':'✕'}</span>)}</div></Card>:<Wheel categories={categories} rotation={rotation} spinning={spinning} duration={settings.menosAnimaciones?0:config.ruleta.duracionGiroMs} onSpin={spin} disabled={busy||spinning||!m.teToca||!m.rival||m.fase!=='girar'}/>}
      {!m.rival&&<p className="sv-muted">Esta partida aún no tiene rival. Vuelve a Nueva partida para elegir a alguien disponible.</p>}
      <StampBar value={m.tuBarra} max={config.partida.barraParaSello}/>
      {error&&<p className="sv-error" role="alert">{error}</p>}
    </div><footer className="sv-footer">{m.fase!=='sello'&&<Button disabled={busy||spinning||!m.teToca||!m.rival||m.fase==='espera'} onClick={()=>['elegida','duelo'].includes(m.fase)?act('pregunta'):spin()}>{busy?'Conectando…':spinning?'Girando…':!m.teToca?'⏳ Turno de '+(m.rival?.apodo||'tu rival'):m.fase==='duelo'?'⚔️ Seguir el duelo':m.fase==='elegida'?'▶ Seguir':'🎡 ¡Girar!'}</Button>}<small className="sv-muted">⏳ {timeLeft(m.plazo)} para jugar el turno</small></footer></>}
    {advantage&&<Sheet title={advantage.emoji+' '+advantage.nombre} onClose={()=>setAdvantage(null)}><p>Tienes {player.inventario?.[advantage.id]||0}. Puedes activarlo al responder una pregunta, cuando esté disponible.</p><Button to="/suizamente/tienda">Ver en la tienda</Button></Sheet>}
    {resign&&<Sheet title="¿Rendirte?" onClose={()=>setResign(false)}><p>La partida cuenta como abandonada.</p><Button onClick={()=>setResign(false)}>Seguir jugando</Button><Button tone="danger-text" disabled={busy} onClick={async()=>{await act('rendirse');setResign(false)}}>Rendirme</Button></Sheet>}
    {sharing&&<ShareSheet data={storyData('fin',{...m,categorias:categories})} onClose={()=>setSharing(false)}/>}
    {pushPrompt&&<Sheet title="🔔 ¿Te avisamos cuando te toque?" onClose={()=>{setPushPrompt(false);navigate('/suizamente')}}><Button onClick={async()=>{
      try{await subscribeToPushNotifications({user,settings:loadPushSettings(),userCanton:player.canton});await refreshPush();setPushPrompt(false);navigate('/suizamente')}catch(e){setError(e.message);setPushPrompt(false)}
    }}>Sí, avisadme</Button><Button tone="quiet" onClick={()=>{setPushPrompt(false);navigate('/suizamente')}}>Ahora no</Button></Sheet>}
  </section>
}
