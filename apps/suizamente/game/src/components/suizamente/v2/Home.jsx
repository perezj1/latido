import {MusicButton} from './MusicButton'
import {Icono} from './Icono'
import {useEffect,useRef,useState} from 'react'
import {Link,useLocation} from 'react-router-dom'
import {useSv} from './Context'
import {Avatar} from './Shared'
import {timeLeft} from '../../../lib/suizamenteV2'
import {useData} from './useData'
import {useDailyGift} from './MomentArrival'
import {useOpenPack} from './Rewards'
import {HomeMapPhoto} from './HomeMapPhoto'
import {MapDrawing} from './Map'
import {HOME_SCENE} from './homeScene'
import {HomeBadge,HomeRow,HomeAction,HomeMatch} from './HomeSceneParts'
import {FriendInviteSheet} from './Sharing'
import {MatchHistory} from './MatchHistory'
import './home.css'
const icon=name=><Icono nombre={name}/>
export function Home(){const {search}=useLocation();return new URLSearchParams(search).get('terminadas')==='1'?<MatchHistory/>:<HomeScene/>}
function HomeScene(){
 const {player,config,map}=useSv()
 const {data,error,reload}=useData('partidas',{refreshMs:15000})
 const {data:missions,error:missionError,reload:reloadMissions}=useData('misiones',{refreshMs:30000,reuseCached:true}),{data:league,error:leagueError,reload:reloadLeague}=useData('liga',{refreshMs:30000,reuseCached:true}),{data:day,error:dayError,reload:reloadDay}=useData('dia',{refreshMs:30000,reuseCached:true}),{data:shop,error:shopError,reload:reloadShop}=useData('tienda',{refreshMs:30000,reuseCached:true})
 const gift=useDailyGift(),pack=useOpenPack('/suizamente'),[busy,setBusy]=useState(false),[fault,setFault]=useState(''),lastChange=useRef(player.actualizado_en)
 useEffect(()=>{if(lastChange.current===player.actualizado_en)return;lastChange.current=player.actualizado_en;reloadShop();reloadMissions();reloadDay();reloadLeague()},[player.actualizado_en])
 const region=config.mapa.regiones[Math.min(map?.region||0,config.mapa.regiones.length-1)],done=map?region.cantones.reduce((n,k)=>n+(map.niveles[k.id]||0),0):null,total=region.cantones.length*config.mapa.nivelesPorCanton
 const style=map?.estilo||config.vueltasMapa.vueltas[Math.min((map?.vuelta||1)-1,config.vueltasMapa.vueltas.length-1)]
 const matches=(data?.partidas||[]).filter(m=>['jugando','buscando'].includes(m.estado)),mine=matches.filter(m=>m.teToca&&m.rival).sort((a,b)=>Date.parse(a.plazo)-Date.parse(b.plazo)),theirs=matches.filter(m=>!m.teToca||!m.rival).sort((a,b)=>Date.parse(a.plazo)-Date.parse(b.plazo))
 const division=league?.reglas.divisiones.find(d=>d.id===league.division),own=league?.filas.find(p=>p.tu),zone=own&&own.destino!==league.division?(league.reglas.divisiones.findIndex(d=>d.id===own.destino)>league.reglas.divisiones.findIndex(d=>d.id===league.division)?' ⬆️':' ⬇️'):''
 const event=data?.evento&&Date.parse(data.evento.fin)>Date.now()?data.evento:null,eventCategory=config.categorias.find(c=>c.id===event?.categoria)
 const completed=missions?.misiones.filter(m=>m.avance>=m.meta).length,sobres=player.inventario?.sobres||0,escudos=player.inventario?.escudos||0,remaining=m=>Math.max(0,config.partida.barraParaSello-m.tuBarra)
 const sealText=m=>remaining(m)>0?'A '+remaining(m)+' acierto'+(remaining(m)===1?'':'s')+' del sello':'¡Juega por un sello!'
 async function openGift(){if(busy)return;setBusy(true);setFault('');try{await gift();reloadShop()}catch(e){setFault(e.message)}finally{setBusy(false)}}
 const problems=error||missionError||leagueError||dayError||shopError||fault||pack.error

 const [inviting,setInviting]=useState(false)
 const filterKey='suizamente:inicio-filtro:'+player.jugador_id
 const [filter,setFilter]=useState(()=>{try{return sessionStorage.getItem(filterKey)==='espera'?'espera':'seguir'}catch{return 'seguir'}})
 const tabs=useRef({})
 function selectFilter(value){setFilter(value);try{sessionStorage.setItem(filterKey,value)}catch{/* Storage can be unavailable in private sessions. */}}
 function filterKeys(e){if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const value=e.key==='Home'?'seguir':e.key==='End'?'espera':filter==='seguir'?'espera':'seguir';selectFilter(value);tabs.current[value]?.focus({preventScroll:true})}
 return <section className="sv-screen sv-home-screen sv-home-new"><h1 className="sv-sr-only">Hola, {player.apodo}</h1>
  <section className="sv-home-stage sv-home-scene-stage" aria-label="Tu región"><div className="sv-home-scene-backdrop" data-chrome-color="#5FCDE8" aria-hidden="true" dangerouslySetInnerHTML={{__html:HOME_SCENE}}/>
   <header className="sv-home-header"><Link className="sv-home-profile" to="/suizamente/perfil" aria-label={'Tu perfil. Nivel '+player.nivel}><Avatar id={player.jugador_id} name={player.apodo} color={player.color} level={player.nivel}/></Link><span className="sv-home-datum" aria-label={'Racha de '+(player.racha||0)+' días'}><Icono nombre="racha" size={26}/>{player.racha||0}</span><i className="sv-home-separator" aria-hidden="true"/><Link className="sv-home-datum" to="/suizamente/tienda" aria-label={player.monedas+' monedas. Abrir Tienda'}><Icono nombre="moneda" size={26}/>{player.monedas}</Link><i className="sv-home-separator" aria-hidden="true"/><MusicButton home/><i className="sv-home-separator" aria-hidden="true"/><Link className="sv-home-menu" to="/suizamente/menu" aria-label="Menú">☰</Link></header>
   <Link className="sv-home-region" to="/suizamente/mapa" aria-label={'Tu mapa: '+region.nombre+', '+(done??'cargando')+' de '+total+' niveles. Cofre al completarla'}><span className="sv-home-region-name">{region.nombre}</span><span className="sv-home-region-main" aria-hidden="true"><span className="sv-home-minimap"><MapDrawing levels={map?.niveles} region={map?.region} vuelta={map?.vuelta} regionBadge/></span><span className="sv-home-region-bar"><i style={{width:100*(done||0)/total+'%',background:style.colores[3]}}/><b>{done??'…'}/{total}</b></span><Icono nombre="cofre" size={34}/></span></Link>
   <div className="sv-home-accesses left">
    <HomeBadge image={icon('regalo')} tint="#FEEDD1" chip={shop?(shop.regaloDisponible?'¡Ábrelo!':'✓ Mañana'):'…'} green={shop?.regaloDisponible} alert={shop?.regaloDisponible?'!':null} name="Regalo" label={shop?shop.regaloDisponible?'Regalo diario: ábrelo':'Regalo diario: ya lo has abierto. Vuelve mañana':'Regalo diario: cargando'} to={shop&&!shop.regaloDisponible?'/suizamente/tienda':undefined} onClick={openGift} disabled={busy||!shop}/>
    <HomeBadge image={icon('misiones')} tint="#D3F8F3" chip={(completed??'…')+'/'+(missions?.misiones.length||config.misiones.porDia)} name="Misiones" to="/suizamente/misiones" label={'Misiones: '+(completed??'cargando')+' de '+(missions?.misiones.length||config.misiones.porDia)+(missions?.renuevaEn?'. Se renuevan en '+timeLeft(missions.renuevaEn,Date.parse(missions.servidorAhora)):'')}/>
    <HomeBadge image={icon('pregunta')} tint="#DFE7FC" chip={day?(day.hecho?'✓ Hecha':'🪙 +'+config.recompensasComunidad.dia.monedas):'…'} alert={day&&!day.hecho&&!day.noDisponible?'!':null} name="Pregunta" to="/suizamente/pregunta-del-dia" label={day?day.hecho?'Pregunta del día: ya has votado':day.noDisponible?'Pregunta del día: no disponible':'Pregunta del día: vota y gana '+config.recompensasComunidad.dia.monedas+' monedas':'Pregunta del día: cargando'}/>
   </div>
   <div className="sv-home-accesses right">
    {event&&<HomeBadge image={icon(eventCategory?'sello-'+eventCategory.id:({cartas:'sobre',obras:'mapa',sellos:'pasaporte'}[event.tipo]||'trofeo'))} tint={eventCategory?.tinte||'#FFE1E2'} chip={'⏳ '+timeLeft(event.fin)} name={eventCategory?.nombre.split(' ')[0]||'Evento'} alert={event.efecto.match(/×\s*[\d.,]+/)?.[0]} to="/suizamente/misiones" label={event.titulo+': '+event.efecto+'. Termina en '+timeLeft(event.fin)}/>}
    <HomeBadge image={division?icon(league.division):icon('trofeo')} tint={division?.tinte||'#D3F2F9'} chip={own?own.puesto+'.º'+zone:league?'—':'…'} name="Liga" to="/suizamente/ranking?tab=liga" label={division?division.nombre+': '+(own?'vas '+own.puesto+'.º de '+league.filas.length+(zone?' '+(zone.includes('⬆')?'En zona de ascenso':'En zona de descenso'):''):'aún no tienes grupo'):'Liga: cargando'}/>
    {sobres>0?<HomeBadge image={icon('sobre')} tint="#FFE1E2" chip="Abrir" green name={sobres===1?'1 sobre':sobres+' sobres'} label={'Tienes '+sobres+' sobre'+(sobres===1?'':'s')+' de cartas: ábrelo'} onClick={pack.open} disabled={pack.busy}/>:<HomeBadge image={icon('escudo')} tint="#F4F7FB" chip={escudos+'/'+config.escudos.max} name="Escudos" label={'Escudos: '+escudos+' de '+config.escudos.max} to="/suizamente/tienda"/>}
   </div>

   <Link className="sv-home-map-target" to="/suizamente/mapa" aria-label={region.nombre+' en 3D: '+(done??'cargando')+' de '+total+' niveles. Abrir el mapa'}><HomeMapPhoto/></Link>
   <Link className="sv-home-create" to="/suizamente/nueva"><span className="sv-home-create-ring" aria-hidden="true"><i/></span><span className="sv-home-create-plus" aria-hidden="true">＋</span>Nueva partida</Link>
  </section>
  <section className="sv-home-matches" aria-label="Tus partidas">
   <div className="sv-home-filters" role="tablist" aria-label="Tus partidas" onKeyDown={filterKeys}>
    {[['seguir','Seguir jugando',mine.length],['espera','En espera',theirs.length]].map(([key,label,count])=><button key={key} ref={el=>tabs.current[key]=el} type="button" role="tab" id={'sv-home-tab-'+key} aria-selected={filter===key} aria-controls={'sv-home-panel-'+key} tabIndex={filter===key?0:-1} aria-label={label+': '+count+' '+(count===1?'partida':'partidas')} onClick={()=>{selectFilter(key);tabs.current[key]?.focus({preventScroll:true})}}>{label}{count>0&&<span className={'sv-home-count '+key} aria-hidden="true">{count}</span>}</button>)}
   </div>
   <div role="tabpanel" id="sv-home-panel-seguir" aria-labelledby="sv-home-tab-seguir" hidden={filter!=='seguir'}>
    <HomeRow label="Partidas en las que te toca"><HomeAction onClick={()=>setInviting(true)} icon="amigos" label="Invitar a alguien a jugar" subtitle="Comparte tu enlace para jugar">Invitar a alguien</HomeAction>{!data&&!error?<div role="listitem" className="sv-home-empty sv-skeleton" aria-label="Cargando partidas"/>:mine.length?mine.map(m=><HomeMatch key={m.id} match={m} mine sealText={sealText(m)}/>):data&&<div role="listitem" className="sv-home-empty"><span className="sv-home-empty-icon" aria-hidden="true">{matches.length?'🎉':'👋'}</span><span className="sv-home-row-text"><b>{matches.length?'Estás al día':'Aún no tienes partidas'}</b><span>{matches.length?'Ninguna partida espera tu turno':'Empieza una con «＋ Nueva partida»'}</span></span></div>}</HomeRow>
   </div>
   <div role="tabpanel" id="sv-home-panel-espera" aria-labelledby="sv-home-tab-espera" hidden={filter!=='espera'}>
    <HomeRow label="Partidas terminadas y las que esperan el turno de la otra persona"><HomeAction to="/suizamente/amigos?terminadas=1" icon="trofeo" label="Partidas terminadas: resultados y revancha" subtitle="Resultados y revancha">Partidas terminadas</HomeAction>{theirs.map(m=><HomeMatch key={m.id} match={m}/>)}</HomeRow>
   </div>
  </section>
  {problems&&<div className="sv-home-failure" role="alert">{problems} <button className="sv-text-button" onClick={()=>{setFault('');reload();reloadMissions();reloadLeague();reloadDay();reloadShop()}}>Reintentar</button></div>}
  {inviting&&<FriendInviteSheet onClose={()=>setInviting(false)}/>}
 </section>
}
