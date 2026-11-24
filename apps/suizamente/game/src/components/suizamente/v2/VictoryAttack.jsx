import {useEffect,useState} from 'react'
import {useNavigate,useParams} from 'react-router-dom'
import {Button,Card,Header} from './Shared'
import {WorldMap} from './WorldMap'
import {szApi} from '../../../lib/suizamenteV2'

export function VictoryAttack(){
 const {id}=useParams(),navigate=useNavigate(),[data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 async function load(){try{setData(await szApi('partidas/'+id+'/ataque'));setError('')}catch(e){setError(e.message)}}
 useEffect(()=>{load()},[id])
 async function attack(canton){
  if(busy)return;setBusy(true);setError('')
  try{const next=await szApi('partidas/'+id+'/atacar',{method:'POST',body:{canton}});navigate('/suizamente/asalto/'+next.id)}catch(e){setError(e.message);if(e.status===409)await load()}finally{setBusy(false)}
 }
 const cantons=data?.cantones.filter(k=>k.nivel>0)||[]
 return <section className="sv-screen"><Header title="Elige dónde atacar" back={'/suizamente/partida/'+id+'?continuar=1'}/><div className="sv-content">
  {data?<><h2>El mapa de {data.victima.apodo}</h2><p>Acierta las {data.preguntas} preguntas para robar hasta 🪙 {data.premio} y bajar un nivel al cantón que elijas.</p><p className="sv-muted">Si tu rival tiene un escudo, lo usará para reducir el robo a 🪙 {data.premioConEscudo}. El cantón baja igualmente. Con un fallo, no pasa nada.</p>
   {data.ataqueId?<Card><p>Ya has elegido un ataque para esta victoria.</p><Button to={'/suizamente/asalto/'+data.ataqueId}>Ver mi ataque</Button></Card>:<>
    {data.limiteAlcanzado&&<Card>Ya has alcanzado el límite de ataques de hoy.</Card>}
    {!cantons.length?<Card>Tu rival todavía no tiene cantones construidos.</Card>:<div className="sv-attack-cantons">{cantons.map(k=><button key={k.id} disabled={busy||!k.disponible||data.limiteAlcanzado} onClick={()=>attack(k.id)} aria-label={'Atacar '+k.nombre+', nivel '+k.nivel}><WorldMap mini state={data.mapa} selected={k.id}/><b>{k.nombre}</b><small>Nivel {k.nivel}{k.protegido?' · Región protegida':''}</small></button>)}</div>}
   </>}
  </>:!error&&<div className="sv-skeleton" role="status" aria-label="Cargando cantones del rival"/>}
  {error&&<p className="sv-error" role="alert">{error} <button className="sv-text-button" onClick={load}>Reintentar</button></p>}
 </div><footer className="sv-footer"><Button tone="quiet" to="/suizamente">Volver a Inicio</Button></footer></section>
}
