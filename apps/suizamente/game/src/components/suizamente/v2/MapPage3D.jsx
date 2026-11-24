import {useEffect,useState} from 'react'
import {Link,useNavigate,useParams,useSearchParams} from 'react-router-dom'
import {useSv} from './Context'
import {Button,Card,Header,Wallet} from './Shared'
import {ChestLinks,MapDrawing} from './Map'
import {WorldMap} from './WorldMap'
import {szApi,szKey} from '../../../lib/suizamenteV2'

const stages=['Solo tierra','Naturaleza','Pueblo','Monumento']
export function MapPage(){
 const [search]=useSearchParams(),{config,player,map}=useSv(),navigate=useNavigate(),[data,setData]=useState(map),[selected,setSelected]=useState(()=>{const id=search.get('canton');return config.mapa.regiones[map?.region||0]?.cantones.some(k=>k.id===id)?id:null}),[animated,setAnimated]=useState(null)
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 const [landmarks,setLandmarks]=useState({})
 async function load(){try{setData(await szApi('mapa'));setError('')}catch(e){setError(e.message)}}
 useEffect(()=>{let active=true;const refresh=()=>{if(!document.hidden)szApi('mapa').then(d=>{if(active)setData(d)}).catch(e=>{if(active)setError(e.message)})};refresh();window.addEventListener('focus',refresh);const timer=setInterval(refresh,30000);return()=>{active=false;window.removeEventListener('focus',refresh);clearInterval(timer)}},[])
 useEffect(()=>{if(map)setData(map)},[map])
 function choose(id){
  const region=config.mapa.regiones.findIndex(r=>r.cantones.some(k=>k.id===id)),canton=config.mapa.regiones[region]?.cantones.find(k=>k.id===id)
  if(region!==data.region){setNotice((canton?.nombre||id)+' es de otra región: llegarás más adelante');return}
  setSelected(id);setNotice('')
 }
 async function build(){
  if(busy||!selected)return
  setBusy(true);setError('')
  try{
   const next=await szApi('mapa/construir',{method:'POST',body:{canton:selected,nivel:data.niveles[selected]||0,vuelta:data.vuelta,clave:szKey()}})
   setData(next);setAnimated({canton:selected})
   if(next.vueltaCompleta)navigate('/suizamente/mapa/vuelta?vuelta='+next.vueltaCompleta.vuelta)
   else if(next.cofre){setSelected(null);navigate('/suizamente/cofre/'+next.cofre.id+'?volver=/suizamente/mapa')}
  }catch(e){setError(e.message);if(e.status===409)await load()}finally{setBusy(false)}
 }
 if(!data)return <section className="sv-screen"><div className="sv-content">{error?<Card><p role="alert">{error}</p><Button onClick={load}>Reintentar</Button></Card>:<div className="sv-skeleton" role="status" aria-label="Cargando mapa"/>}</div></section>
 const region=config.mapa.regiones[Math.min(data.region,config.mapa.regiones.length-1)],maximum=config.mapa.nivelesPorCanton,k=region.cantones.find(k=>k.id===selected)
 const level=data.niveles[selected]||0,cost=data.costes?.[selected]?.[level]??k?.costes[level]
 const progress=region.cantones.reduce((n,k)=>n+(data.niveles[k.id]||0),0),total=region.cantones.length*maximum
 return <section className="sv-screen sv-map-page"><header className="sv-map-header"><div><small>VUELTA {data.vuelta} · REGIÓN {data.region+1} DE {config.mapa.regiones.length}</small><h1>{region.nombre}</h1></div><span className="sv-shields" aria-label={(player.inventario.escudos||0)+' escudos'}>🛡️ {player.inventario.escudos||0}/{config.escudos.max}</span><Wallet/></header>
  <div className="sv-region-progress"><div className="sv-xp-bar" role="progressbar" aria-label="Niveles de la región" aria-valuemin={0} aria-valuemax={total} aria-valuenow={progress}><i style={{width:100*progress/total+'%'}}/></div><b>{progress}/{total}</b><span>🎁</span></div>
  <div className="sv-map-frame">{selected&&<button className="sv-map-all" onClick={()=>setSelected(null)}>← Toda Suiza</button>}<WorldMap state={data} selected={selected} onSelect={choose} animated={animated} onMetadata={setLandmarks}/>{selected&&<div className="sv-world-focus-info"><b>{k?.nombre}</b><span>Nivel {level}/{maximum} · {level===maximum?landmarks[selected]?.n||stages[level]:stages[level]}</span></div>}</div>
  {selected?<div className="sv-content" aria-live="polite">{level<maximum?<Button className={'sv-button sv-build '+(player.monedas>=cost?'affordable':'')} disabled={busy} onClick={build}><span>⬆️</span><span><b>Subir a nivel {level+1}</b><small>Llega: {level+1===maximum?landmarks[selected]?.n||stages[level+1]:stages[level+1]}</small></span><strong>🪙 {cost}</strong></Button>:<Card>✅ Cantón completo</Card>}</div>:<p className="sv-map-hint">Elige un cantón para verlo de cerca</p>}
  {data.vuelta>1&&<p className="sv-map-hint">{data.estilo.emoji} {data.estilo.nombre}: todo cuesta ×{data.multiplicador}</p>}
  {selected&&<Link className="sv-text-button" to={'/suizamente/mapa/niveles/'+selected}>Así crece {k?.nombre} ›</Link>}
  <div className="sv-canton-strip">{region.cantones.map(k=>{const n=data.niveles[k.id]||0,price=data.costes?.[k.id]?.[n]??k.costes[n];return <button key={k.id} aria-pressed={selected===k.id} onClick={()=>choose(k.id)} aria-label={'Ver '+k.nombre+', nivel '+n+' de '+maximum}><WorldMap mini state={data} selected={k.id}/><b>{k.nombre}</b><span className="sv-canton-levels">{Array.from({length:maximum},(_,i)=><i key={i} className={i<n?'filled':''}/>)}</span><strong className={player.monedas>=price?'affordable':''}>{n===maximum?'✓ Completo':'🪙 '+price}</strong></button>})}</div>
  <div className="sv-content"><ChestLinks chests={data.cofres}/>{notice&&<p role="status">{notice}</p>}{error&&<Card><p role="alert" className="sv-error">{error}</p><Button tone="quiet" onClick={load}>Reintentar</Button></Card>}</div>
 </section>
}

export function MapLevels(){
 const {canton}=useParams(),{config,map}=useSv(),region=config.mapa.regiones.findIndex(r=>r.cantones.some(k=>k.id===canton)),k=config.mapa.regiones[region]?.cantones.find(k=>k.id===canton)
 if(!k)return <section className="sv-screen"><Header title="Cantón no encontrado" back="/suizamente/mapa"/></section>
 const descriptions=['La losa de tierra del cantón.','Relieve, árboles, animales y lagos.','Casitas y una carretera con coches.','El monumento y la vida del cantón.']
 return <section className="sv-screen"><Header title={'Así crece '+k.nombre} back={'/suizamente/mapa?canton='+canton}/><div className="sv-content"><p className="sv-muted">Cada nivel añade algo a la maqueta del cantón.</p><div className="sv-map-levels">{Array.from({length:config.mapa.nivelesPorCanton+1},(_,level)=><figure key={level}><WorldMap preview state={{...map,vuelta:map?.vuelta||1,region,niveles:{[canton]:level}}} selected={canton}/><figcaption><b>{level} · {stages[level]}</b><p>{descriptions[level]}</p></figcaption></figure>)}</div><Button to={'/suizamente/mapa?canton='+canton}>Volver al cantón</Button></div></section>
}
