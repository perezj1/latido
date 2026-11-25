import {Icono} from './Icono'
import {useEffect,useState} from 'react'
import {Link,useNavigate} from 'react-router-dom'
import {useSv} from './Context'
import {Avatar,Button,Card,Header} from './Shared'
import {szApi,timeLeft} from '../../../lib/suizamenteV2'
import {useData} from './useData'
import {LoadingCards} from '../../../../Loading'

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
      <div className="sv-lobby-invites"><button disabled={busy} onClick={makeInvite}><span aria-hidden="true">📨</span><b>Invitar amigos</b><small>Comparte una partida</small></button><Link to="/suizamente/amigos"><span aria-hidden="true"><Icono nombre="amigos"/></span><b>Tus amigos</b><small>Encuentra con quién jugar</small></Link></div>
      {invite&&<Card><p>Enlace listo para compartir</p><input aria-label="Enlace de invitación" readOnly value={invite} onFocus={e=>e.target.select()}/><Button tone="quiet" onClick={async()=>{try{await navigator.clipboard.writeText(invite)}catch{setError('Selecciona y copia el enlace.')}}}>Copiar enlace</Button></Card>}
      <div className="sv-between sv-section-heading sv-lobby-section"><h2>Seguir jugando</h2><label className="sv-lobby-filter"><span className="sv-sr-only">Filtrar partidas</span><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="todas">Todas</option><option value="turno">Mi turno</option><option value="rival">Su turno</option></select></label></div>
      {!matchData&&!matchesError?<LoadingCards label="Cargando tus partidas"/>:matchesError?<Card><p role="alert" className="sv-error">{matchesError}</p><Button tone="quiet" onClick={reloadMatches}>Reintentar</Button></Card>:matches.filter(m=>filter==='todas'||(filter==='turno'?m.teToca:!m.teToca)).length?<div className="sv-match-carousel">{matches.filter(m=>filter==='todas'||(filter==='turno'?m.teToca:!m.teToca)).map(m=><Link key={m.id} className={'sv-match '+(m.teToca&&m.rival?'your-turn':'')} to={'/suizamente/partida/'+m.id}><Avatar id={m.rival?.id} name={m.rival?.apodo||'?'} color={m.rival?.color}/><b>{m.rival?.apodo||'Espera rival'}</b><small>{m.tusSellos.length} – {m.susSellos.length} sellos</small><b>{!m.rival?'Pendiente':m.teToca?'¡Te toca!':'Su turno'}</b><small>{timeLeft(m.plazo)}</small></Link>)}</div>:<Card><p className="sv-muted">{matches.length?'No tienes partidas con este filtro.':'Todavía no tienes partidas abiertas.'}</p></Card>}
      <h2 className="sv-section-heading">Iniciar una partida</h2>{!lobby&&!lobbyError?<LoadingCards label="Buscando rivales disponibles"/>:lobbyError?<Card><p role="alert" className="sv-error">{lobbyError}</p><Button tone="quiet" onClick={reloadLobby}>Reintentar</Button></Card>:<><div className="sv-start-players"><button className="sv-start-random" disabled={busy||!lobby?.disponible} onClick={()=>start('azar')} aria-describedby="sv-random-availability"><span aria-hidden="true">🎲</span><b>Rival al azar</b><small>{lobby?.disponible?'Hay alguien para jugar':'Sin rivales disponibles'}</small></button>{lobby?.jugadores.map(p=><button key={p.id} disabled={busy||!user} onClick={()=>start(p.id)}><Avatar id={p.id} name={p.apodo} color={p.color}/><b>{p.apodo}</b><small>Nivel {p.nivel} · Disponible</small></button>)}</div><p id="sv-random-availability" className="sv-muted">{lobby?.disponible?'Empezarás con otra persona de Latido.':lobby?'Ahora no hay nadie disponible. Invita a un amigo o vuelve en un momento.':'Comprobando quién está disponible…'}</p></>}
    </>}
    {error&&<p role="alert" className="sv-error">{error}</p>}{busy&&<p role="status">Preparando la partida…</p>}
  </div></section>
}
