import {Icono} from './Icono'
import {useEffect,useRef,useState} from 'react'
import {Link,useNavigate} from 'react-router-dom'
import {useSv} from './Context'
import {Avatar,Button,Card,Header,Wallet} from './Shared'
import {szApi} from '../../../lib/suizamenteV2'
import {copyInvitationText,peekInvitation,prepareInvitation,discardInvitation} from '../../../lib/suizamenteInvitations'
import {notify} from '../../../lib/suizamenteNotices'
import {useData} from './useData'
import {LoadingCards} from '../../../../Loading'
import './newGame.css'

export function NewGame({invitation}){
 const {user,config}=useSv(),navigate=useNavigate()
 const [query,setQuery]=useState(''),[players,setPlayers]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[invite,setInvite]=useState(()=>{const ready=peekInvitation(user?.id);return ready?location.origin+ready.enlace:''}),[searching,setSearching]=useState(false)
 const inviteRequest=useRef(null),usedInvitation=useRef(null)
 const [inviteLoading,setInviteLoading]=useState(!!user&&!invitation&&!peekInvitation(user?.id))
 const {data:lobby,error:lobbyError,reload:reloadLobby}=useData('emparejamiento',{refreshMs:15000,enabled:!invitation})
 const {data:matchData,error:matchesError,reload:reloadMatches}=useData('partidas',{refreshMs:15000,enabled:!invitation})
 const {data:friendData,error:friendsError,reload:reloadFriends}=useData('amigos',{refreshMs:15000,enabled:!!user&&!invitation,reuseCached:true})
 const friends=[...(friendData?.lista||[])].sort((a,b)=>Number(b.online)-Number(a.online)),online=friends.filter(p=>p.online).length
 const term=query.trim().toLocaleLowerCase('es'),local=friends.filter(p=>p.apodo.toLocaleLowerCase('es').includes(term.replace(/^@/,'')))
 const results=term?[...new Map([...local,...players].map(p=>[p.id,friends.find(f=>f.id===p.id)||p])).values()].sort((a,b)=>Number(!!b.online)-Number(!!a.online)):friends.slice(0,3)
 const matchWith=p=>matchData?.partidas.find(m=>['jugando','buscando'].includes(m.estado)&&m.rival?.id===p.id)
 const login=()=>navigate('/auth?next='+encodeURIComponent('/suizamente/nueva'))
 function prepareInvite(){
  if(!inviteRequest.current){setInviteLoading(!peekInvitation(user.id));inviteRequest.current=prepareInvitation(user.id,'game',config.partida.invitacionDias).then(data=>{const url=location.origin+data.enlace;setInvite(url);return url}).catch(e=>{inviteRequest.current=null;throw e}).finally(()=>setInviteLoading(false))}
  return inviteRequest.current
 }
 // A prepared URL lets native sharing start within the actual button gesture.
 useEffect(()=>{if(user&&!invitation)prepareInvite().catch(e=>setError(e.message))},[user?.id,invitation])
 useEffect(()=>()=>{if(usedInvitation.current)discardInvitation(user?.id,'game',usedInvitation.current)},[user?.id])
 useEffect(()=>{
  if(!user||invitation||!term){setPlayers([]);setSearching(false);return}
  let active=true;setPlayers([]);setSearching(true)
  const timer=setTimeout(()=>szApi('jugadores?q='+encodeURIComponent(query.trim().replace(/^@/,''))).then(result=>{if(active)setPlayers(result)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setSearching(false)}),300)
  return()=>{active=false;clearTimeout(timer)}
 },[query,user?.id,invitation])
 async function start(rival){
  if(busy)return;setBusy(true);setError('')
  try{const m=await szApi('partidas',{method:'POST',body:{rival}});navigate('/suizamente/partida/'+m.id)}catch(e){setError(e.message);if(rival==='azar')reloadLobby()}finally{setBusy(false)}
 }
 async function sendInvite(mode){
  if(!user){login();return}if(busy)return;setBusy(true);setError('')
  try{const url=invite||await prepareInvite();if(mode==='share'&&navigator.share)await navigator.share({title:'Una partida de Suizamente',text:'¿Jugamos una partida?',url});else{await copyInvitationText(url);notify('Enlace de invitación copiado')}usedInvitation.current=new URL(url).pathname}catch(e){if(e.name!=='AbortError')setError(e.message)}finally{setBusy(false)}
 }
 function friend(p){
  const match=matchWith(p),label=p.apodo+', nivel '+p.nivel+(p.online?', en línea':'')+'. '+(match?'Ya jugáis una partida: seguir':'Jugar una partida')
  const content=<><span className="sv-np-avatar"><Avatar id={p.id} name={p.apodo} color={p.color}/>{p.online&&<i aria-hidden="true"/>}</span><span className="sv-np-person"><b>{p.apodo}</b><span>Nivel {p.nivel}{match?' · ya jugáis una partida':p.online?<> · <strong>en línea</strong></>:''}</span></span><span className={'sv-np-play'+(match?' continue':'')} aria-hidden="true">{match?'Seguir':'▶︎ Jugar'}</span></>
  return <div role="listitem" key={p.id}>{match?<Link className="sv-np-friend" aria-label={label} to={'/suizamente/partida/'+match.id}>{content}</Link>:<button type="button" className="sv-np-friend" aria-label={label} disabled={busy||!matchData} onClick={()=>start(p.id)}>{content}</button>}</div>
 }
 const problem=error||matchesError||friendsError
 return <section className={'sv-screen sv-lobby'+(!invitation?' sv-new-game':'')}><Header title={invitation?'Te han invitado':'Nueva partida'} right={!invitation?<Wallet/>:undefined}/>
  {invitation?<div className="sv-content"><Card className="sv-empty"><span aria-hidden="true">📨</span><h2>Tu partida te espera</h2><p>Acepta la invitación y juega tu primer turno.</p><Button disabled={busy} onClick={()=>start(invitation)}>▶ Aceptar invitación</Button></Card></div>:<div className="sv-np-sections">
   <section aria-labelledby="sv-np-amigos" className="sv-np-section">
    <div className="sv-np-heading"><Icono nombre="amigos" size={26}/><h2 id="sv-np-amigos">Tus amigos</h2>{online>0&&<span className="sv-np-online"><i aria-hidden="true"/>{online} en línea</span>}</div>
    <label className="sv-np-search"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 5 5"/></svg><input type="search" aria-label="Buscar entre tus amigos y en Latido" placeholder="Busca por nombre o @usuario" value={query} onChange={e=>setQuery(e.target.value)} disabled={!user}/></label>
    {!user?<Link className="sv-np-login" to={'/auth?next='+encodeURIComponent('/suizamente/nueva')}>Entra con Latido para buscar jugadores</Link>:!friendData&&!friendsError?<LoadingCards label="Cargando tus amigos"/>:<div role="list" aria-label={term?'Jugadores encontrados':'Tus amigos'} className="sv-np-friends" aria-busy={searching}>
     {results.map(friend)}{!results.length&&!searching&&<p role="listitem" className="sv-np-empty">{term?'No encontramos ese apodo. Prueba otro o comparte una invitación.':'Invita a alguien de Latido para jugar.'}</p>}
     {!term&&friends.length>3&&<div role="listitem"><Link className="sv-np-more" to="/suizamente/amigos">Ver tus {friends.length} amigos <span aria-hidden="true">›</span></Link></div>}
    </div>}
    {searching&&<span className="sv-sr-only" role="status">Buscando jugadores</span>}
   </section>
   <section aria-labelledby="sv-np-invitar" className="sv-np-section">
    <div className="sv-np-heading"><Icono nombre="compartir" size={26}/><h2 id="sv-np-invitar">Invitar amigos</h2></div>
    <div className="sv-np-invite"><p>Mándale tu enlace a quien aún no juega: cuando entre, empezáis una partida. El enlace dura {config.partida.invitacionDias} días.</p><div className="sv-np-invite-actions" aria-busy={inviteLoading}><button type="button" disabled={busy||inviteLoading} onClick={()=>sendInvite('copy')}>Copiar enlace</button><button type="button" className="share" disabled={busy||inviteLoading} onClick={()=>sendInvite('share')}><Icono nombre="compartir" size={20}/>Compartir</button></div></div>
   </section>
   <section aria-labelledby="sv-np-azar" className="sv-np-section">
    <div className="sv-np-heading"><Icono nombre="dado" size={26}/><h2 id="sv-np-azar">Rival al azar</h2></div>
    <div className="sv-np-random"><div><b>Alguien de Latido de tu nivel</b><p>Que esté conectado ahora. Empezáis al momento.</p></div><button type="button" className="sv-start-random" disabled={busy||!lobby?.disponible} onClick={()=>start('azar')} aria-describedby={!lobby?.disponible?'sv-random-availability':undefined}><Icono nombre="dado" size={30}/>Buscar rival</button>{!lobby?.disponible&&<p id="sv-random-availability" role="status">{lobby?'Ahora no hay nadie libre. Prueba en un rato.':lobbyError||'Comprobando quién está disponible…'}</p>}{lobbyError&&<button type="button" className="sv-np-retry" onClick={reloadLobby}>Reintentar</button>}</div>
   </section>
  </div>}
  {problem&&<div className="sv-np-error"><p role="alert" className="sv-error">{problem}</p>{(matchesError||friendsError)&&<button className="sv-text-button" onClick={()=>{reloadMatches();reloadFriends()}}>Reintentar</button>}</div>}{busy&&<p className="sv-sr-only" role="status">Preparando la partida…</p>}
 </section>
}
