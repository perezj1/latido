import {Link,useNavigate} from 'react-router-dom'
import {useRef,useState} from 'react'
import {szApi} from '../../../lib/suizamenteV2'
import {useSv} from './Context'
import {Avatar,Button,Card,Header} from './Shared'
import {useData} from './useData'
export function MatchHistory(){
 const {data,error,reload}=useData('partidas?terminadas=true',{refreshMs:15000})
 const navigate=useNavigate(),pending=useRef(false),[busy,setBusy]=useState(false),[fault,setFault]=useState('')
 async function replay(rival){if(pending.current)return;pending.current=true;setBusy(true);setFault('');try{const match=await szApi('partidas',{method:'POST',body:{rival}});navigate('/suizamente/partida/'+match.id)}catch(e){setFault(e.message)}finally{pending.current=false;setBusy(false)}}
 const {config}=useSv(),matches=(data?.partidas||[]).filter(m=>!['buscando','jugando'].includes(m.estado))
 return <section className="sv-screen"><Header title="Partidas terminadas" back="/suizamente/amigos"/><div className="sv-content">{!data&&!error?<div className="sv-skeleton" role="status" aria-label="Cargando partidas terminadas"/>:matches.length?matches.map(m=><Card className="sv-match-history" key={m.id}><Link className="sv-match" to={'/suizamente/partida/'+m.id}><Avatar id={m.rival?.id} name={m.rival?.apodo||'?'} color={m.rival?.color}/><div><b>{m.rival?.apodo||'Perfil eliminado'}</b><small>{m.terminadaEn&&new Intl.DateTimeFormat('es-CH',{dateStyle:'medium',timeZone:'Europe/Zurich'}).format(new Date(m.terminadaEn))}</small></div><strong>{m.tusSellos.length}–{m.susSellos.length}</strong></Link>{m.rival&&<Button tone="quiet" disabled={busy} aria-label={"Revancha contra "+m.rival.apodo} onClick={()=>replay(m.rival.id)}>🔁 Revancha</Button>}{config.apiVersion>=17&&m.rival&&m.ganador===m.tuId&&<Button tone="quiet" to={'/suizamente/ataque/'+m.id}>Atacar</Button>}</Card>):!error&&<Card>Aún no tienes partidas terminadas</Card>}{fault&&<p className="sv-error" role="alert">{fault}</p>}{error&&<Card><p className="sv-error" role="alert">{error}</p><Button onClick={reload} tone="quiet">Reintentar</Button></Card>}</div></section>
}
