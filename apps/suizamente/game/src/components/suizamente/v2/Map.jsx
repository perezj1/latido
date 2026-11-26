import {Icono} from './Icono'
import {useEffect,useLayoutEffect,useRef,useState} from 'react'
import {Link} from 'react-router-dom'
import {useSv} from './Context'

let mapPaths
function paths(){
  if(!mapPaths)mapPaths=fetch('/suizamente-assets/mapa-cantones.svg').then(r=>{if(!r.ok)throw new Error('No se pudo cargar el mapa');return r.text()}).then(svg=>{
    const doc=new DOMParser().parseFromString(svg,'image/svg+xml')
    return [...doc.querySelectorAll('path[id]')].map(p=>({id:p.id,d:p.getAttribute('d'),name:p.getAttribute('data-nombre')}))
  }).catch(e=>{mapPaths=null;throw e})
  return mapPaths
}
// The geometry is read from the copied, attributed swisstopo SVG, never redrawn.
export function MapDrawing({levels={},region=0,only,label='Mapa de los cantones de Suiza',vuelta:shownLap,regionBadge=false}){
  const {config,map}=useSv(),[data,setData]=useState([]),[error,setError]=useState(false),[box,setBox]=useState('0 0 350 225'),svg=useRef(null)
  useEffect(()=>{let active=true;paths().then(p=>{if(active)setData(p)}).catch(()=>{if(active)setError(true)});return()=>{active=false}},[])
  useLayoutEffect(()=>{
    if(!only||!data.length)return
    const p=svg.current?.querySelector('path')
    if(p){const b=p.getBBox();if(b.width&&b.height)setBox([b.x-3,b.y-3,b.width+6,b.height+6].join(' '))}
  },[only,data])
  if(error)return <span className="sv-muted">Mapa no disponible</span>
  const lap=shownLap||map?.vuelta||1,styles=config.vueltasMapa?.vueltas||[]
  const colors=styles[Math.min(lap-1,styles.length-1)]?.colores||config.mapa.coloresNivel
  const previousColors=styles[Math.max(0,Math.min(lap-2,styles.length-1))]?.colores||config.mapa.coloresNivel
  return <svg ref={svg} className={'sv-map-drawing'+(only?' canton':'')} viewBox={only?box:'0 0 350 225'} role="img" aria-label={label}>
    <title>{label} · Límites © swisstopo</title>
    {data.filter(p=>(!only||p.id===only)&&config.mapa.regiones.some(r=>r.cantones.some(k=>k.id===p.id))).map(p=>{
      const index=config.mapa.regiones.findIndex(r=>r.cantones.some(k=>k.id===p.id)),active=index===region
      const fill=regionBadge?(index===region?colors[3]:index<region?colors[2]:'#DDE2EA'):only?colors[levels[p.id]||0]:index<region?colors[config.mapa.nivelesPorCanton]:active?colors[levels[p.id]||0]:lap>1?previousColors[config.mapa.nivelesPorCanton]:'var(--sv-line)'
      return <path key={p.id} data-canton={p.id} d={p.d} fill={fill} stroke={active&&!only?'#4A76EF':'#9AA6B8'} strokeWidth={active&&!only?1.5:.7} strokeLinejoin="round" vectorEffect="non-scaling-stroke"><title>{p.name||p.id} · Nivel {levels[p.id]||0}</title></path>
    })}
    {!only&&data.find(p=>p.id==='lagos')&&<path d={data.find(p=>p.id==='lagos').d} fill="#D3F2F9" stroke="#9AA6B8" strokeWidth=".4" aria-hidden="true"/>}
  </svg>
}
export function ChestLinks({chests=[],back='/suizamente/mapa'}){
  return chests.length>0&&<div className="sv-pending-chests">{chests.map(c=><Link key={c.id} to={'/suizamente/cofre/'+c.id+'?volver='+encodeURIComponent(back)}><Icono nombre="cofre"/> <b>{c.titulo}</b><span>Abrir ›</span></Link>)}</div>
}
