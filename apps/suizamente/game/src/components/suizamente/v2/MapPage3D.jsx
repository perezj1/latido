import {MusicButton} from './MusicButton'
import {Icono,iconizar,lapIcon} from './Icono'
import {useEffect,useRef,useState} from 'react'
import {Link,useNavigate,useParams,useSearchParams} from 'react-router-dom'
import {useSv} from './Context'
import {Button,Card,Header,Wallet} from './Shared'
import {ChestLinks,MapDrawing} from './Map'
import {WorldMap} from './WorldMap'
import {szApi,szKey} from '../../../lib/suizamenteV2'
import {mapImage} from './shareData'
import {useMoment} from './Moment'
import {cantonSteps} from './moments'
import {notify} from '../../../lib/suizamenteNotices'
import './mapCards.css'
import {useDecorations,DecorateBadge} from './MejorasDecorar'
import {mejoraActiva} from './MejorasShared'
import {useMapBusinesses,MapBusinesses} from './NegociosMap'

const stages=['Solo tierra','Naturaleza','Pueblo','Monumento']
export function MapPage(){
 const {data:businesses}=useMapBusinesses()
 const {data:decorations}=useDecorations()
 const [search]=useSearchParams(),{config,player,map}=useSv(),navigate=useNavigate(),[data,setData]=useState(map),[selected,setSelected]=useState(()=>{const id=search.get('canton');return config.mapa.regiones[map?.region||0]?.cantones.some(k=>k.id===id)?id:null}),[animated,setAnimated]=useState(null)
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 const {show}=useMoment(),world=useRef(null),animationDone=useRef(null),[celebration,setCelebration]=useState(null)
 const [landmarks,setLandmarks]=useState({})
 async function load(){try{setData(await szApi('mapa'));setError('')}catch(e){setError(e.message)}}
 useEffect(()=>{let active=true;const refresh=()=>{if(!document.hidden)szApi('mapa').then(d=>{if(active)setData(d)}).catch(e=>{if(active)setError(e.message)})};refresh();window.addEventListener('focus',refresh);const timer=setInterval(refresh,30000);return()=>{active=false;window.removeEventListener('focus',refresh);clearInterval(timer)}},[])
 useEffect(()=>{if(map)setData(map)},[map])
 function choose(id){
  const region=config.mapa.regiones.findIndex(r=>r.cantones.some(k=>k.id===id)),canton=config.mapa.regiones[region]?.cantones.find(k=>k.id===id)
  if(region!==data.region){setNotice((canton?.nombre||id)+' es de otra región: llegarás más adelante');return}
  setSelected(id);setNotice('')
 }
 async function build(id=selected){
  if(busy||!id)return
  const price=data.costes?.[id]?.[data.niveles[id]||0]
  if(Number.isFinite(price)&&player.monedas<price){notify('Te faltan 🪙 '+(price-player.monedas)+'. Juega una partida para ganarlas.',{error:true});return}
  setSelected(id)
  setBusy(true);setError('')
  try{
   const next=await szApi('mapa/construir',{method:'POST',body:{canton:id,nivel:data.niveles[id]||0,vuelta:data.vuelta,clave:szKey()}})
   const complete=data.niveles[id]===config.mapa.nivelesPorCanton-1&&(next.vueltaCompleta||(next.niveles[id]===config.mapa.nivelesPorCanton))
   const visual={...data,niveles:{...data.niveles,[id]:config.mapa.nivelesPorCanton}}
   const finished=complete?new Promise(resolve=>{animationDone.current=resolve}):null
   if(complete)setCelebration(visual)
   setData(next);setAnimated({canton:id})
   if(complete){await finished;const photo=await world.current.capture(),name=region.cantones.find(k=>k.id===id).nombre,landmark=landmarks[id]?.n;await show(cantonSteps(name,landmark,mapImage(visual,player,config,{...photo,selected:id,landmark})),{key:'canton:'+visual.vuelta+':'+id+':'+szKey()});setCelebration(null)}
   if(next.vueltaCompleta)navigate('/suizamente/mapa/vuelta?vuelta='+next.vueltaCompleta.vuelta)
   else if(next.cofre){setSelected(null);navigate('/suizamente/cofre/'+next.cofre.id+'?volver=/suizamente/mapa')}
  }catch(e){setError(e.message);if(e.status===409)await load()}finally{setBusy(false)}
 }
 if(!data)return <section className="sv-screen"><div className="sv-content">{error?<Card><p role="alert">{error}</p><Button onClick={load}>Reintentar</Button></Card>:<div className="sv-skeleton" role="status" aria-label="Cargando mapa"/>}</div></section>
 const barra=config.mapa.barraCanton===true
 const view=celebration||data,region=config.mapa.regiones[Math.min(view.region,config.mapa.regiones.length-1)],maximum=config.mapa.nivelesPorCanton,k=region.cantones.find(k=>k.id===selected)
 const level=view.niveles[selected]||0,cost=data.costes?.[selected]?.[level]??k?.costes[level]
 const style=view.estilo||config.vueltasMapa.vueltas[Math.min((view.vuelta||1)-1,config.vueltasMapa.vueltas.length-1)]
 const progress=region.cantones.reduce((n,k)=>n+(view.niveles[k.id]||0),0),total=region.cantones.length*maximum
 return <section className="sv-screen sv-map-page"><header className="sv-map-header"><h1>{region.nombre}</h1><Wallet/><MusicButton/><div className="sv-map-header-pills"><span className="sv-map-stage">Vuelta {view.vuelta}</span><span className="sv-map-stage">Región {view.region+1} de {config.mapa.regiones.length}</span><span className="sv-shields" aria-label={(player.inventario.escudos||0)+' escudos'}><Icono nombre="escudo"/> {player.inventario.escudos||0}/{config.escudos.max}</span></div></header>
  <div className="sv-region-progress"><div className="sv-xp-bar" role="progressbar" aria-label="Niveles de la región" aria-valuemin={0} aria-valuemax={total} aria-valuenow={progress}><i style={{width:100*progress/total+'%'}}/></div><b>{progress}/{total}</b><span><Icono nombre="cofre"/></span></div>
  <div className={'sv-map-frame'+(selected&&barra?' has-canton':'')}>{mejoraActiva(config,'decorar')&&selected&&level>=1&&<DecorateBadge data={decorations} canton={selected} decoration={search.get('decoracion')}/>}{selected&&<button className="sv-map-all" onClick={()=>setSelected(null)}>← Toda Suiza</button>}<WorldMap ref={world} businesses={businesses?.negocios} onBusiness={id=>navigate('/suizamente/negocios/'+id)} decorations={mejoraActiva(config,'decorar')?decorations?.puestas||[]:undefined} state={celebration||data} selected={selected} onSelect={choose} animated={animated} onAnimationDone={()=>{animationDone.current?.();animationDone.current=null}} onMetadata={setLandmarks}/>
   {selected&&barra&&<div className="sv-world-focus-info"><div className="sv-canton-info"><span className="sv-canton-info-title"><b>{k?.nombre}</b><span className="sv-canton-levels" aria-hidden="true">{Array.from({length:maximum},(_,i)=><i key={i} className={i<level?'filled':''}/>)}</span></span><span>Nivel {level}/{maximum} · {level===maximum?landmarks[selected]?.n||stages[level]:stages[level]}</span>{level<maximum&&<span className="sv-canton-arrival">Llega: {level+1===maximum?landmarks[selected]?.n||stages[level+1]:stages[level+1]}</span>}</div>
    {level<maximum?<button className={'sv-canton-build '+(player.monedas>=cost?'affordable':'')} disabled={busy||cost===undefined} onClick={()=>build()} aria-label={'Subir '+k?.nombre+' a nivel '+(level+1)+' por '+cost+' monedas. Llega: '+(level+1===maximum?landmarks[selected]?.n||stages[level+1]:stages[level+1])+(player.monedas<cost?'. Te faltan monedas':'')}><span>⬆️ Subir a nivel {level+1}</span><span className="sv-inline-value"><Icono nombre="moneda" size={18}/>{cost}</span></button>:<span className="sv-canton-complete" style={{background:style.colores[1]}}>✓ Completo</span>}
   </div>}
  </div>
  {!selected&&<div className="sv-map-hint-slot"><p className="sv-map-hint">{view.vuelta>1&&<><Icono nombre={lapIcon(view.estilo)}/> {view.estilo.nombre}: todo cuesta ×{view.multiplicador}. </>}👆 Elige un cantón para verlo de cerca y subirlo de nivel.</p></div>}
  <div className="sv-canton-strip">{region.cantones.map(k=>{const n=view.niveles[k.id]||0,complete=n===maximum,price=data.costes?.[k.id]?.[n]??k.costes?.[n],affordable=player.monedas>=price;return !barra?<div key={k.id} className={'sv-canton-card sv-canton-controls'+(complete?' complete':'')+(selected===k.id?' selected':'')} style={{'--lap-color':style.colores[3],'--lap-tint':style.colores[1]}}>
   <Link to={'?canton='+k.id} onClick={e=>{if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();choose(k.id)}}} aria-label={k.nombre+': nivel '+n+' de '+maximum+'. Verlo de cerca'}>
    <span className="sv-canton-plate" aria-hidden="true"><MapDrawing levels={view.niveles} region={view.region} vuelta={view.vuelta} only={k.id}/></span><b className="sv-canton-name">{k.nombre}</b>
    <span className="sv-canton-level-label" aria-hidden="true"><span className="sv-canton-levels">{Array.from({length:maximum},(_,i)=><i key={i} className={i<n?'filled':''}/>)}</span><small>Nivel {n}/{maximum}</small></span>
   </Link>
   {complete?<span className="sv-canton-price complete">✓ Completo</span>:<button className={'sv-canton-price'+(affordable?' affordable':'')} disabled={busy||price===undefined} onClick={()=>build(k.id)} aria-label={'Subir '+k.nombre+' a nivel '+(n+1)+' por '+price+' monedas. Llega: '+(n+1===maximum?landmarks[k.id]?.n||stages[n+1]:stages[n+1])}>Subir <Icono nombre="moneda" size={16}/>{price}</button>}
  </div>:<button key={k.id} className={'sv-canton-card'+(complete?' complete':'')} aria-pressed={selected===k.id} onClick={()=>choose(k.id)} aria-label={k.nombre+': nivel '+n+' de '+maximum+(complete?', completo':'. Subir a nivel '+(n+1)+': '+price+' monedas'+(affordable?'':', te faltan monedas'))} style={{'--lap-color':style.colores[3],'--lap-tint':style.colores[1]}}><span className="sv-canton-plate" aria-hidden="true"><MapDrawing levels={view.niveles} region={view.region} vuelta={view.vuelta} only={k.id}/></span><b className="sv-canton-name">{k.nombre}</b><span className="sv-canton-level-label" aria-hidden="true"><span className="sv-canton-levels">{Array.from({length:maximum},(_,i)=><i key={i} className={i<n?'filled':''}/>)}</span><small>Nivel {n}/{maximum}</small></span><span aria-hidden="true" className={'sv-canton-price'+(complete?' complete':affordable?' affordable':'')}>{complete?'✓ Completo':<><Icono nombre="moneda" size={18}/>{price}</>}</span></button>})}</div>
  <MapBusinesses canton={selected||region.cantones[0].id} data={businesses}/>
  <div className="sv-content"><ChestLinks chests={data.cofres}/>{notice&&<p role="status">{notice}</p>}{error&&<Card><p role="alert" className="sv-error">{error}</p><Button tone="quiet" onClick={load}>Reintentar</Button></Card>}</div>
</section>
}

export function MapLevels(){
 const {canton}=useParams(),{config,map}=useSv(),region=config.mapa.regiones.findIndex(r=>r.cantones.some(k=>k.id===canton)),k=config.mapa.regiones[region]?.cantones.find(k=>k.id===canton)
 if(!k)return <section className="sv-screen"><Header title="Cantón no encontrado" back="/suizamente/mapa"/></section>
 const descriptions=['La losa de tierra del cantón.','Relieve, árboles, animales y lagos.','Casitas y una carretera con coches.','El monumento y la vida del cantón.']
 return <section className="sv-screen"><Header title={'Así crece '+k.nombre} back={'/suizamente/mapa?canton='+canton}/><div className="sv-content"><p className="sv-muted">Cada nivel añade algo a la maqueta del cantón.</p><div className="sv-map-levels">{Array.from({length:config.mapa.nivelesPorCanton+1},(_,level)=><figure key={level}><WorldMap preview state={{...map,vuelta:map?.vuelta||1,region,niveles:{[canton]:level}}} selected={canton}/><figcaption><b>{level} · {stages[level]}</b><p>{descriptions[level]}</p></figcaption></figure>)}</div><Button to={'/suizamente/mapa?canton='+canton}>Volver al cantón</Button></div></section>
}
