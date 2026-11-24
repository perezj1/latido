import {useEffect,useState} from 'react'
import {communityCall,COMMUNITY_COUNTRIES,COMMUNITY_YEARS,countryFlag} from '../../lib/suizamenteCommunity'

export default function CommunityAnswers({sessionId,position,isDemo,available}) {
  const [tab,setTab]=useState('country'),[state,setState]=useState({loading:true}),[revision,setRevision]=useState(0)
  useEffect(()=>{
    let live=true
    if(isDemo||!available){setState({loading:false,data:{country:[],years:[]}});return undefined}
    setState({loading:true})
    communityCall('stats',{session_id:sessionId,position}).then(data=>{if(live)setState({loading:false,data})}).catch(error=>{if(live)setState({loading:false,error})})
    return()=>{live=false}
  },[sessionId,position,isDemo,available,revision])
  const rows=state.data?.[tab]||[],labels=tab==='country'?COMMUNITY_COUNTRIES:COMMUNITY_YEARS
  return <section className="sg-community" aria-label="Respuestas de la comunidad">
    <div className="sg-community-heading"><h3><span aria-hidden="true">👥</span> Eligieron lo mismo</h3><div className="sg-community-tabs" role="group" aria-label="Distribución de respuestas">
      {[['country','País'],['years','Años en Suiza']].map(([id,label])=><button type="button" key={id} aria-pressed={tab===id} onClick={()=>setTab(id)}>{label}</button>)}
    </div></div>
    <div aria-live="polite" aria-busy={state.loading}>
      {state.loading?<p>Cargando respuestas…</p>:state.error?<p>{state.error.message} <button type="button" className="sz-text-link" onClick={()=>setRevision(n=>n+1)}>Reintentar</button></p>:rows.length?<ul>{rows.map(row=><li key={row.id}>
        <span className="sg-community-label">{tab==='country'&&<span aria-hidden="true">{countryFlag(row.id)}</span>}{labels.find(([id])=>id===row.id)?.[1]||row.id}</span>
        <span className="sg-community-track" aria-hidden="true"><span style={{width:`${row.percent}%`}}/></span><strong>{row.percent} %</strong>
      </li>)}</ul>:<p>Aún no hay suficientes respuestas{tab==='country'?' por país':' por años en Suiza'}.</p>}
    </div>
    {rows.length>0&&<small>Porcentaje que eligió tu respuesta en cada grupo · al menos {state.data.minimum} personas por grupo.</small>}
  </section>
}
