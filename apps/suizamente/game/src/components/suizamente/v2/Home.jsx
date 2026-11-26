import {MusicButton} from './MusicButton'
import {Icono,IconText} from './Icono'
import {lazy,Suspense,useEffect,useLayoutEffect,useRef,useState} from 'react'
import {Link,useLocation} from 'react-router-dom'
import {useSv} from './Context'
import {Avatar,Button,Card,Header} from './Shared'
import {timeLeft} from '../../../lib/suizamenteV2'
import {useData} from './useData'
import {useDailyGift} from './MomentArrival'
import {useOpenPack} from './Rewards'
import {HomeMapPhoto} from './HomeMapPhoto'
import {ESCENA} from './latidoBackdropAssets'
import './home.css'
const NotificationBell=lazy(()=>import('./NotificationBell').then(m=>({default:m.NotificationBell})))
const waves=(ESCENA.match(/<path d="[^"]*" fill="#[0-9A-Fa-f]{6}"><\/path>/g)||[]).join('')
const icon=name=><Icono nombre={name}/>
function Access({to,onClick,label,image,tint,chip,name,alert,green,disabled}){
 const props={className:'sv-home-access','aria-label':label,style:{'--access-tint':tint}}
 const content=<><span className="sv-home-access-icon" aria-hidden="true">{image}</span>{alert&&<i aria-hidden="true">{alert}</i>}<span className={'sv-home-access-chip'+(green?' green':'')} aria-hidden="true"><IconText>{chip}</IconText></span><span className="sv-home-access-name" aria-hidden="true">{name}</span></>
 return to?<Link {...props} to={to}>{content}</Link>:<button {...props} onClick={onClick} disabled={disabled}>{content}</button>
}
function Carousel({label,children}){
 const row=useRef(null),drag=useRef(null),moved=useRef(false),[index,setIndex]=useState(0),items=Array.isArray(children)?children:[children],{reduced}=useSv()
 const keys=items.map(item=>item.key).join('|')
 useLayoutEffect(()=>{row.current.scrollLeft=0;setIndex(0)},[keys])
 const step=()=>row.current.children[1]?.offsetLeft-row.current.children[0].offsetLeft||row.current.clientWidth
 function end(e){if(!drag.current)return;drag.current=null;row.current.style.scrollSnapType='';if(row.current.hasPointerCapture(e.pointerId))row.current.releasePointerCapture(e.pointerId);row.current.scrollTo({left:Math.round(row.current.scrollLeft/step())*step(),behavior:reduced?'instant':'smooth'})}
 return <div className="sv-home-carousel"><div ref={row} className="sv-home-carousel-row" role="list" aria-label={label} onScroll={()=>setIndex(Math.max(0,Math.min(items.length-1,Math.round(row.current.scrollLeft/step()))))}
  onPointerDown={e=>{if(e.pointerType!=='mouse'||e.button!==0)return;drag.current={x:e.clientX,left:row.current.scrollLeft};moved.current=false}}
  onPointerMove={e=>{if(!drag.current)return;const delta=e.clientX-drag.current.x;if(Math.abs(delta)>4){moved.current=true;row.current.setPointerCapture(e.pointerId);row.current.style.scrollSnapType='none';row.current.scrollLeft=drag.current.left-delta}}}
  onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onDragStart={e=>e.preventDefault()} onClickCapture={e=>{if(moved.current){e.preventDefault();e.stopPropagation();moved.current=false}}}
  onFocusCapture={e=>{const item=e.target.closest('[role=listitem]');if(item)row.current.scrollTo({left:item.offsetLeft-row.current.children[0].offsetLeft,behavior:'instant'})}}>{items}</div>
  {items.length>1&&<div className="sv-home-carousel-dots" aria-hidden="true">{items.map((_,i)=><i key={i} className={i===index?'current':''}/>)}</div>}
 </div>
}
function History({data,error,reload}){
 const {config}=useSv(),matches=(data?.partidas||[]).filter(m=>!['buscando','jugando'].includes(m.estado))
 return <section className="sv-screen"><Header title="Partidas terminadas" back="/suizamente"/><div className="sv-content">{!data&&!error?<div className="sv-skeleton" role="status" aria-label="Cargando partidas terminadas"/>:matches.length?matches.map(m=><Card className="sv-match-history" key={m.id}><Link className="sv-match" to={'/suizamente/partida/'+m.id}><Avatar id={m.rival?.id} name={m.rival?.apodo||'?'} color={m.rival?.color}/><div><b>{m.rival?.apodo||'Perfil eliminado'}</b><small>{m.terminadaEn&&new Intl.DateTimeFormat('es-CH',{dateStyle:'medium',timeZone:'Europe/Zurich'}).format(new Date(m.terminadaEn))}</small></div><strong>{m.tusSellos.length}–{m.susSellos.length}</strong></Link>{config.apiVersion>=17&&m.rival&&m.ganador===m.tuId&&<Button tone="quiet" to={'/suizamente/ataque/'+m.id}>Atacar</Button>}</Card>):!error&&<Card>Aún no tienes partidas terminadas</Card>}{error&&<Card><p className="sv-error" role="alert">{error}</p><Button onClick={reload} tone="quiet">Reintentar</Button></Card>}</div></section>
}
export function Home(){
 const {player,config,map}=useSv(),{search}=useLocation(),history=new URLSearchParams(search).get('terminadas')==='1'
 const {data,error,reload}=useData('partidas'+(history?'?terminadas=true':''),{refreshMs:15000})
 const {data:missions,error:missionError,reload:reloadMissions}=useData('misiones',{refreshMs:30000,enabled:!history,reuseCached:true}),{data:league,error:leagueError,reload:reloadLeague}=useData('liga',{refreshMs:30000,enabled:!history,reuseCached:true}),{data:day,error:dayError,reload:reloadDay}=useData('dia',{refreshMs:30000,enabled:!history,reuseCached:true}),{data:shop,error:shopError,reload:reloadShop}=useData('tienda',{refreshMs:30000,enabled:!history,reuseCached:true})
 const gift=useDailyGift(),pack=useOpenPack('/suizamente'),[busy,setBusy]=useState(false),[fault,setFault]=useState(''),lastChange=useRef(player.actualizado_en)
 useEffect(()=>{if(lastChange.current===player.actualizado_en)return;lastChange.current=player.actualizado_en;if(!history){reloadShop();reloadMissions();reloadDay();reloadLeague()}},[player.actualizado_en,history])
 const region=config.mapa.regiones[Math.min(map?.region||0,config.mapa.regiones.length-1)],done=map?region.cantones.reduce((n,k)=>n+(map.niveles[k.id]||0),0):null,total=region.cantones.length*config.mapa.nivelesPorCanton
 const style=map?.estilo||config.vueltasMapa.vueltas[Math.min((map?.vuelta||1)-1,config.vueltasMapa.vueltas.length-1)]
 const matches=(data?.partidas||[]).filter(m=>['jugando','buscando'].includes(m.estado)),mine=matches.filter(m=>m.teToca&&m.rival).sort((a,b)=>Date.parse(a.plazo)-Date.parse(b.plazo)),theirs=matches.filter(m=>!m.teToca||!m.rival).sort((a,b)=>Date.parse(a.plazo)-Date.parse(b.plazo))
 const division=league?.reglas.divisiones.find(d=>d.id===league.division),own=league?.filas.find(p=>p.tu),zone=own&&own.destino!==league.division?(league.reglas.divisiones.findIndex(d=>d.id===own.destino)>league.reglas.divisiones.findIndex(d=>d.id===league.division)?' ⬆️':' ⬇️'):''
 const event=data?.evento&&Date.parse(data.evento.fin)>Date.now()?data.evento:null,eventCategory=config.categorias.find(c=>c.id===event?.categoria)
 const completed=missions?.misiones.filter(m=>m.avance>=m.meta).length,sobres=player.inventario?.sobres||0,escudos=player.inventario?.escudos||0,remaining=m=>Math.max(0,config.partida.barraParaSello-m.tuBarra)
 const sealText=m=>remaining(m)>0?'A '+remaining(m)+' acierto'+(remaining(m)===1?'':'s')+' del sello':'¡Juega por un sello!'
 async function openGift(){if(busy)return;setBusy(true);setFault('');try{await gift();reloadShop()}catch(e){setFault(e.message)}finally{setBusy(false)}}
 if(history)return <History data={data} error={error} reload={reload}/>
 const problems=error||missionError||leagueError||dayError||shopError||fault||pack.error
 return <section className="sv-screen sv-home-screen sv-home-new"><h1 className="sv-sr-only">Hola, {player.apodo}</h1>
  <header className="sv-home-header"><Link to="/suizamente/perfil" aria-label={'Tu perfil. Nivel '+player.nivel}><Avatar id={player.jugador_id} name={player.apodo} color={player.color} level={player.nivel}/></Link><span className="sv-chip" aria-label={'Racha de '+(player.racha||0)+' días'}>{icon('racha')} {player.racha||0}</span><Link className="sv-chip sv-coins" to="/suizamente/tienda" aria-label={player.monedas+' monedas. Abrir Tienda'}>{icon('moneda')} {player.monedas}</Link><Suspense fallback={<span className="sv-icon-space"/>}><NotificationBell matches={data?.partidas||[]}/></Suspense><Link className="sv-icon-button" to="/suizamente/menu" aria-label="Menú">☰</Link><MusicButton/></header>
  <section className="sv-home-stage" aria-label="Tu Suiza"><svg className="sv-home-waves" viewBox="0 0 390 260" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{__html:waves}}/>
   <HomeMapPhoto/><Link className="sv-home-map-target" to="/suizamente/mapa" aria-label={'Tu Suiza en 3D: '+region.nombre+', '+(done??'cargando')+' de '+total+' niveles. Abrir el mapa'}/>
   <div className="sv-home-map-title"><b aria-hidden="true">Tu {style.nombre}</b><Link className="sv-home-region" to="/suizamente/mapa" aria-label={'Tu mapa: '+region.nombre+', '+(done??'cargando')+' de '+total+' niveles. Cofre al completarla'}><span>{region.nombre}</span><i aria-hidden="true"><i style={{width:100*(done||0)/total+'%',background:style.colores[3]}}/></i><b>{done??'…'}/{total}</b><span aria-hidden="true">{icon('regalo')}</span></Link></div>
   <div className="sv-home-accesses left">
    <Access image={icon('regalo')} tint="#FEEDD1" chip={shop?(shop.regaloDisponible?'¡Ábrelo!':'✓ Mañana'):'…'} green={shop?.regaloDisponible} alert={shop?.regaloDisponible?'!':null} name="Regalo" label={shop?shop.regaloDisponible?'Regalo diario: ábrelo':'Regalo diario: ya lo has abierto. Vuelve mañana':'Regalo diario: cargando'} to={shop&&!shop.regaloDisponible?'/suizamente/tienda':undefined} onClick={openGift} disabled={busy||!shop}/>
    <Access image={icon('misiones')} tint="#D3F8F3" chip={(completed??'…')+'/'+(missions?.misiones.length||config.misiones.porDia)} name="Misiones" to="/suizamente/misiones" label={'Misiones: '+(completed??'cargando')+' de '+(missions?.misiones.length||config.misiones.porDia)+(missions?.renuevaEn?'. Se renuevan en '+timeLeft(missions.renuevaEn,Date.parse(missions.servidorAhora)):'')}/>
    <Access image={icon('pregunta')} tint="#DFE7FC" chip={day?(day.hecho?'✓ Hecha':'🪙 +'+config.recompensasComunidad.dia.monedas):'…'} alert={day&&!day.hecho&&!day.noDisponible?'!':null} name="Pregunta" to="/suizamente/pregunta-del-dia" label={day?day.hecho?'Pregunta del día: ya has votado':day.noDisponible?'Pregunta del día: no disponible':'Pregunta del día: vota y gana '+config.recompensasComunidad.dia.monedas+' monedas':'Pregunta del día: cargando'}/>
   </div>
   <div className="sv-home-accesses right">
    {event&&<Access image={icon(eventCategory?'sello-'+eventCategory.id:({cartas:'sobre',obras:'mapa',sellos:'pasaporte'}[event.tipo]||'trofeo'))} tint={eventCategory?.tinte||'#FFE1E2'} chip={'⏳ '+timeLeft(event.fin)} name={eventCategory?.nombre.split(' ')[0]||'Evento'} alert={event.efecto.match(/×\s*[\d.,]+/)?.[0]} to="/suizamente/misiones" label={event.titulo+': '+event.efecto+'. Termina en '+timeLeft(event.fin)}/>}
    <Access image={division?icon(league.division):icon('trofeo')} tint={division?.tinte||'#D3F2F9'} chip={own?own.puesto+'.º'+zone:league?'—':'…'} name="Liga" to="/suizamente/ranking?tab=liga" label={division?division.nombre+': '+(own?'vas '+own.puesto+'.º de '+league.filas.length+(zone?' '+(zone.includes('⬆')?'En zona de ascenso':'En zona de descenso'):''):'aún no tienes grupo'):'Liga: cargando'}/>
    {sobres>0?<Access image={icon('sobre')} tint="#FFE1E2" chip="Abrir" green name={sobres===1?'1 sobre':sobres+' sobres'} label={'Tienes '+sobres+' sobre'+(sobres===1?'':'s')+' de cartas: ábrelo'} onClick={pack.open} disabled={pack.busy}/>:<Access image={icon('escudo')} tint="#F4F7FB" chip={escudos+'/'+config.escudos.max} name="Escudos" label={'Escudos: '+escudos+' de '+config.escudos.max} to="/suizamente/tienda"/>}
   </div>
   <Link className="sv-home-create" to="/suizamente/nueva">＋ Nueva partida</Link>
  </section>
  <div className="sv-home-matches">
   {!data&&!error?<div className="sv-home-empty sv-skeleton" role="status" aria-label="Cargando partidas"/>:mine.length?<Carousel label="Partidas en las que te toca">{mine.map((m,i)=><Link key={m.id} role="listitem" className="sv-home-turn" to={'/suizamente/partida/'+m.id} aria-label={'Te toca contra '+m.rival.apodo+', '+m.tusSellos.length+' a '+m.susSellos.length+'. '+sealText(m)+'. Jugar'}><span className="sv-home-turn-top"><Avatar id={m.rival.id} name={m.rival.apodo} color={m.rival.color}/><span className="sv-home-turn-description"><span><b className="sv-home-turn-label">¡Te toca!</b>{mine.length>1&&<small> · {i+1} de {mine.length}</small>}</span><strong>{m.rival.apodo} · {m.tusSellos.length} – {m.susSellos.length}</strong><small>Ronda {m.ronda} · <Icono nombre="tiempo"/> {timeLeft(m.plazo,Date.parse(m.servidorAhora))}</small></span><span className="sv-home-play" aria-hidden="true">▶︎</span></span><span className="sv-home-seal" aria-hidden="true">{icon('pasaporte')}{Array.from({length:config.partida.barraParaSello},(_,n)=><i key={n} className={n<m.tuBarra?'filled':''}/>)}<span>{sealText(m)}</span></span></Link>)}</Carousel>:data&&<div className="sv-home-empty"><span aria-hidden="true">{matches.length?'🎉':'👋'}</span><span><b>{matches.length?'Estás al día':'Aún no tienes partidas'}</b><small>{matches.length?'Ninguna partida espera tu turno. Empieza otra o reta a alguien.':'Empieza una con «＋ Nueva partida».'}</small></span></div>}
   <Carousel label="Partidas que esperan el turno de la otra persona y las terminadas">{[...theirs.map(m=><Link role="listitem" key={m.id} className="sv-home-wait" to={'/suizamente/partida/'+m.id} aria-label={m.rival?'Turno de '+m.rival.apodo+', '+m.tusSellos.length+' a '+m.susSellos.length+'. Le quedan '+timeLeft(m.plazo,Date.parse(m.servidorAhora)):'Partida pendiente: buscando rival'}><Avatar id={m.rival?.id} name={m.rival?.apodo||'?'} color={m.rival?.color}/><span><b>{m.rival?'Turno de '+m.rival.apodo:'Buscando rival…'}</b><small>{m.tusSellos.length} – {m.susSellos.length} · Ronda {m.ronda}</small></span><strong><Icono nombre="tiempo"/> {timeLeft(m.plazo,Date.parse(m.servidorAhora))}</strong></Link>),<Link role="listitem" key="history" className="sv-home-wait" to="/suizamente?terminadas=1" aria-label="Partidas terminadas: resultados y revancha"><span className="sv-home-history-icon" aria-hidden="true">📜</span><span><b>Partidas terminadas</b><small>Resultados y revancha</small></span><strong aria-hidden="true">›</strong></Link>]}</Carousel>
   {problems&&<div className="sv-home-failure" role="alert">{problems} <button className="sv-text-button" onClick={()=>{setFault('');reload();reloadMissions();reloadLeague();reloadDay();reloadShop()}}>Reintentar</button></div>}
  </div>
 </section>
}
