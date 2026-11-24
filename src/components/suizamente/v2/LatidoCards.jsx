import {useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
import {useAuth} from '../../../hooks/useAuth'
import {szApi,SV_STATE} from '../../../lib/suizamenteV2'
import './latido-cards.css'

export default function LatidoCard({surface='home'}){
  const {authUser}=useAuth(),[data,setData]=useState(null),[player,setPlayer]=useState(null)
  useEffect(()=>{let active=true
    if(!authUser){setData(null);setPlayer(null);return}
    Promise.all([szApi('portada'),szApi('jugador')]).then(([d,p])=>{if(active){setData(d);setPlayer(p.jugador)}}).catch(()=>{})
    const update=e=>{if(active&&e.detail?.jugador)setPlayer(e.detail.jugador)}
    window.addEventListener(SV_STATE,update)
    return()=>{active=false;window.removeEventListener(SV_STATE,update)}
  },[authUser?.id])
  const profile=surface==='profile',voted=data?.tuVoto!=null
  const progress=player?Math.min(100,100*(player.xpNivel||0)/(player.xpNecesaria||1)):0
  return <Link className="szm-mini" to={profile||voted?'/suizamente':'/suizamente/pregunta-del-dia'} aria-label={profile?'Abrir Suizamente':'Suizamente · Pregunta del día'}>
    <img src="/suizamente-assets/logo-suizamente.svg" width="44" height="33" alt=""/>
    <span className="szm-mini-copy"><span className="szm-mini-title"><b>Suiza<span>mente</span></b>{player?.racha>0?<small>· 🔥 {player.racha}</small>:!profile&&data&&<small>· 👥 {data.jugadoresHoy} hoy</small>}</span>
      <span className="szm-mini-sub">{profile?(player?'⭐ Nivel '+player.nivel+' · '+(data?.esperan?data.esperan+' partidas te esperan':'¡Juega una partida!'):'🎮 Juega tu primera partida: preguntas sobre la vida en Suiza.'):voted?(data.pctIgual==null?'Tu voto ya cuenta. ¿Una partida?':(data.mayoria?'🙌 El ':'😎 Solo el ')+data.pctIgual+' % opina igual que tú. ¿Una partida?'):'🤔 Pregunta del día: '+(data?.pregunta.texto||'¿Qué elige la comunidad?')}</span>
      {profile&&player&&<span className="szm-mini-progress" role="progressbar" aria-label="Avance del nivel" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}><i style={{width:progress+'%'}}/></span>}
    </span><span className="szm-mini-play" aria-hidden="true">▶</span>
  </Link>
}
