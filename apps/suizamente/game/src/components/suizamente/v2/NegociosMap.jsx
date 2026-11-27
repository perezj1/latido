import {Link} from 'react-router-dom'
import {useSv} from './Context'
import {Icono} from './Icono'
import {useData} from './useData'
import {businessThumbnail,BUSINESS_TYPES} from '../../../lib/suizamenteNegocios'
import './negocios.css'
export function useMapBusinesses(){const {config}=useSv();return useData('negocios',{enabled:config.negocios?.activo===true,refreshMs:30000})}
export function MapBusinesses({canton,data}){
 const {config}=useSv();if(!config.negocios?.activo||!data)return null
 const name=config.mapa.regiones.flatMap(r=>r.cantones).find(k=>k.id===canton)?.nombre,items=data.negocios.filter(b=>b.canton===canton),slots=(data.huecos[canton]||[]).filter(h=>h.tipo==='plaza'),full=slots.filter(h=>data.ocupadas.includes(h.id)).length>=(data.capacidades[canton]??slots.length)
 return <section className="sv-neg-canton" aria-labelledby="sv-neg-canton"><h2 id="sv-neg-canton"><Icono nombre="negocio"/> Negocios en {name}</h2><ul className="sv-neg-list">{items.map(b=><li key={b.id}><Link className="sv-neg-business-row" to={'/suizamente/negocios/'+b.id}><img className="sv-neg-picture" width="58" height="58" src={businessThumbnail(b.tipo,b.color)} alt=""/><span><b>{b.nombre}</b><small>{BUSINESS_TYPES.find(([id])=>id===b.tipo)?.[1]} · {b.ciudad}</small><span className="sv-neg-sponsored">Patrocinado</span></span>{b.oferta&&<span className="sv-neg-offer-chip">Oferta ›</span>}</Link></li>)}</ul><Link className="sv-neg-row" to={'/suizamente/negocios/info?canton='+canton}><Icono nombre="negocio" size={28}/><span><b>¿Tienes un negocio?</b><small>{full?'Apúntate a la lista de espera':'Ponlo en el mapa · Patrocinado'}</small></span><span aria-hidden="true">›</span></Link></section>
}
