import {lazy,Suspense,useEffect,useState} from 'react'
import {Link,useLocation,useNavigate} from 'react-router-dom'
import {useSv} from './Context'
import {Avatar,Button,Card,Header,Wallet} from './Shared'
import {szApi,timeLeft} from '../../../lib/suizamenteV2'
import {HomeMap} from './Map'
import {DurationHome} from './Duration'
import {useData} from './useData'
import {LoadingCards} from '../../../../Loading'
const NotificationBell=lazy(()=>import('./NotificationBell').then(m=>({default:m.NotificationBell})))

function MatchHistoryRow({match}){
  const {config}=useSv()
  return <Card className="sv-match-history"><Link className="sv-match" to={'/suizamente/partida/'+match.id}>
    <Avatar id={match.rival?.id} name={match.rival?.apodo||'?'} color={match.rival?.color}/><div><b>{match.rival?.apodo||'Perfil eliminado'}</b><small>{match.terminadaEn&&new Intl.DateTimeFormat('es-CH',{dateStyle:'medium',timeZone:'Europe/Zurich'}).format(new Date(match.terminadaEn))}</small></div><strong>{match.tusSellos.length}–{match.susSellos.length}</strong>
  </Link>{config.apiVersion>=17&&match.rival&&match.ganador===match.tuId&&<Button tone="quiet" to={'/suizamente/ataque/'+match.id}>Atacar</Button>}</Card>
}
export function Home(){
  const {player,config}=useSv(),{search}=useLocation(),navigate=useNavigate(),history=new URLSearchParams(search).get('terminadas')==='1'
  const {data,error,reload:load}=useData('partidas'+(history?'?terminadas=true':''),{refreshMs:15000}),matches=(data?.partidas||[]).filter(m=>!history||!['buscando','jugando'].includes(m.estado)),event=data?.evento
  const waiting=matches.filter(m=>m.teToca&&['jugando','buscando'].includes(m.estado)).length
  return <section className="sv-screen sv-home-screen"><header className="sv-home-header"><Link to="/suizamente/perfil" aria-label={'Tu perfil. Nivel '+player.nivel}><Avatar id={player.jugador_id} name={player.apodo} color={player.color} level={player.nivel}/></Link><span className="sv-chip" aria-label={'Racha de '+(player.racha||0)+' días'}>🔥 {player.racha||0}</span><Wallet/><Suspense fallback={<span className="sv-icon-space"/>}><NotificationBell matches={data?.partidas||[]}/></Suspense><Link className="sv-icon-button" to="/suizamente/menu" aria-label="Menú">☰</Link></header>
    <div className="sv-content">{event&&Date.parse(event.fin)>Date.now()&&<Card className="sv-weekend-event"><b>🎉 {event.titulo}</b><p>{event.efecto}</p><small>⏳ {timeLeft(event.fin)}</small></Card>}<h1 className="sv-sr-only">Hola, {player.apodo}</h1><HomeMap/><Button to="/suizamente/nueva">▶ Jugar</Button><div className="sv-between sv-section-heading"><h2>Tus partidas</h2><span>{waiting?waiting+' te esperan':''}</span></div>
    {!data&&!error?<LoadingCards label="Cargando partidas"/>:error?<Card><p className="sv-error" role="alert">{error}</p><Button onClick={load} tone="quiet">Reintentar</Button></Card>:!matches.length?<Card className="sv-empty"><span aria-hidden="true">🎡</span><p>{history?'Aún no tienes partidas terminadas':'Aún no tienes partidas'}</p><Link to="/suizamente/nueva">▶ Jugar</Link></Card>:<div className={history?"sv-match-list":"sv-match-carousel"}>{!history&&<Link className="sv-new-match" to="/suizamente/nueva"><span>＋</span>Nueva</Link>}{matches.map(m=>history?<MatchHistoryRow key={m.id} match={m}/>:<Link key={m.id} className={'sv-match '+(m.teToca?'your-turn':'')} to={'/suizamente/partida/'+m.id}><Avatar id={m.rival?.id} name={m.rival?.apodo||'?'} color={m.rival?.color}/><div><b>{m.rival?.apodo||'Buscando rival…'}</b><small>{m.tusSellos.length} – {m.susSellos.length} sellos</small></div><div><b>{!['jugando','buscando'].includes(m.estado)?m.ganador===m.tuId?'Victoria':'Terminada':m.teToca?'¡Te toca!':'Su turno'}</b><small>{['jugando','buscando'].includes(m.estado)?'⏳ '+timeLeft(m.plazo):''}</small></div></Link>)}</div>}
    <button className="sv-text-button" onClick={()=>navigate('/suizamente'+(history?'':'?terminadas=1'))}>{history?'Ver solo abiertas':'Ver terminadas ›'}</button><DurationHome/></div>
  </section>
}
export function NewGame({invitation}){
  const {user}=useSv(),navigate=useNavigate()
  const [query,setQuery]=useState(''),[players,setPlayers]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[invite,setInvite]=useState('')
  const {data:lobby,setData:setLobby,error:lobbyError,reload:reloadLobby}=useData('emparejamiento',{refreshMs:15000,enabled:!invitation})
  const {data:matchData,error:matchesError,reload:reloadMatches}=useData('partidas',{refreshMs:15000,enabled:!invitation}),matches=matchData?.partidas||[]
  const [filter,setFilter]=useState('todas'),[searching,setSearching]=useState(false)
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
      {query.trim()&&user&&<div className="sv-player-list" aria-live="polite">{searching?<LoadingCards label="Buscando jugadores"/>:players.length?players.map(p=><div key={p.id}><Avatar id={p.id} name={p.apodo} color={p.color}/><span><b>{p.apodo}</b><small>Nivel {p.nivel}</small></span><button disabled={busy} onClick={()=>start(p.id)}>▶ Jugar</button></div>):<p>No encontramos ese apodo. Prueba otro o comparte una invitación.</p>}</div>}
      <div className="sv-lobby-invites"><button disabled={busy} onClick={makeInvite}><span aria-hidden="true">📨</span><b>Invitar amigos</b><small>Comparte una partida</small></button><Link to="/suizamente/amigos"><span aria-hidden="true">👥</span><b>Tus amigos</b><small>Encuentra con quién jugar</small></Link></div>
      {invite&&<Card><p>Enlace listo para compartir</p><input aria-label="Enlace de invitación" readOnly value={invite} onFocus={e=>e.target.select()}/><Button tone="quiet" onClick={async()=>{try{await navigator.clipboard.writeText(invite)}catch{setError('Selecciona y copia el enlace.')}}}>Copiar enlace</Button></Card>}
      <div className="sv-between sv-section-heading sv-lobby-section"><h2>Seguir jugando</h2><label className="sv-lobby-filter"><span className="sv-sr-only">Filtrar partidas</span><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="todas">Todas</option><option value="turno">Mi turno</option><option value="rival">Su turno</option></select></label></div>
      {!matchData&&!matchesError?<LoadingCards label="Cargando tus partidas"/>:matchesError?<Card><p role="alert" className="sv-error">{matchesError}</p><Button tone="quiet" onClick={reloadMatches}>Reintentar</Button></Card>:matches.filter(m=>filter==='todas'||(filter==='turno'?m.teToca:!m.teToca)).length?<div className="sv-match-carousel">{matches.filter(m=>filter==='todas'||(filter==='turno'?m.teToca:!m.teToca)).map(m=><Link key={m.id} className={'sv-match '+(m.teToca&&m.rival?'your-turn':'')} to={'/suizamente/partida/'+m.id}><Avatar id={m.rival?.id} name={m.rival?.apodo||'?'} color={m.rival?.color}/><b>{m.rival?.apodo||'Espera rival'}</b><small>{m.tusSellos.length} – {m.susSellos.length} sellos</small><b>{!m.rival?'Pendiente':m.teToca?'¡Te toca!':'Su turno'}</b><small>{timeLeft(m.plazo)}</small></Link>)}</div>:<Card><p className="sv-muted">{matches.length?'No tienes partidas con este filtro.':'Todavía no tienes partidas abiertas.'}</p></Card>}
      <h2 className="sv-section-heading">Iniciar una partida</h2>{!lobby&&!lobbyError?<LoadingCards label="Buscando rivales disponibles"/>:lobbyError?<Card><p role="alert" className="sv-error">{lobbyError}</p><Button tone="quiet" onClick={reloadLobby}>Reintentar</Button></Card>:<><div className="sv-start-players"><button className="sv-start-random" disabled={busy||!lobby?.disponible} onClick={()=>start('azar')} aria-describedby="sv-random-availability"><span aria-hidden="true">🎲</span><b>Rival al azar</b><small>{lobby?.disponible?'Hay alguien para jugar':'Sin rivales disponibles'}</small></button>{lobby?.jugadores.map(p=><button key={p.id} disabled={busy||!user} onClick={()=>start(p.id)}><Avatar id={p.id} name={p.apodo} color={p.color}/><b>{p.apodo}</b><small>Nivel {p.nivel} · Disponible</small></button>)}</div><p id="sv-random-availability" className="sv-muted">{lobby?.disponible?'Empezarás con otra persona de Latido.':lobby?'Ahora no hay nadie disponible. Invita a un amigo o vuelve en un momento.':'Comprobando quién está disponible…'}</p></>}
    </>}
    {error&&<p role="alert" className="sv-error">{error}</p>}{busy&&<p role="status">Preparando la partida…</p>}
  </div></section>
}
