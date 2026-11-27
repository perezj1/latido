import {Link} from 'react-router-dom'
import {useSv} from './Context'
import {Avatar,Card,Header} from './Shared'
import {Icono,powerIcon} from './Icono'
import {NotificationBell} from './NotificationBell'
import {useData} from './useData'
import './menu.css'

function MenuRow({to,icon,tint,title,subtitle,badge,label}){
 return <div role="listitem"><Link to={to} className="sv-menu-row" aria-label={label||title+': '+subtitle}><span className="sv-menu-row-icon" style={{background:tint}}><Icono nombre={icon} size={28}/></span><span className="sv-menu-row-text"><b>{title}</b><span>{subtitle}</span></span>{badge&&<span className="sv-menu-missions" aria-hidden="true">{badge}</span>}<span className="sv-menu-chevron" aria-hidden="true">›</span></Link></div>
}
export function Menu(){
 const {player,config,capabilities}=useSv()
 const {data:achievements,error:achievementError,reload:reloadAchievements}=useData('logros',{refreshMs:30000,reuseCached:true})
 const {data:notebook,error:notebookError,reload:reloadNotebook}=useData('libreta',{refreshMs:30000,reuseCached:true})
 const {data:missions,error:missionError,reload:reloadMissions}=useData('misiones',{refreshMs:30000,reuseCached:true})
 const all=achievements?.logros,done=all?.filter(a=>a.conseguido).length,total=all?.length
 const closest=all?.filter(a=>!a.conseguido).sort((a,b)=>b.avance/Math.max(1,b.meta)-a.avance/Math.max(1,a.meta))[0]
 const saved=notebook?.datos,count=saved?.length,latest=saved?.[0]?.dato
 const completed=missions?.misiones.filter(m=>m.avance>=m.meta).length,missionTotal=config.misiones.porDia
 const inventory=[...config.comodines.map(c=>({id:c.id,icon:powerIcon(c.id),name:({quita:'Quita una',otra:'Otra',salta:'Cambiar',tiempo:'+15 s'})[c.id]||c.nombre,count:player.inventario?.[c.id]||0})),{id:'escudos',icon:'escudo',name:'Escudos',count:player.inventario?.escudos||0}]
 const problem=achievementError||notebookError||missionError
 return <section className="sv-screen sv-menu-page"><Header title="Menú" right={<NotificationBell/>}/><div className="sv-menu-content">
  <Link className="sv-menu-profile" to="/suizamente/perfil" aria-label={'Tu perfil: '+player.apodo+', nivel '+player.nivel+', racha de '+(player.racha||0)+' días. Ver perfil'}><span aria-hidden="true"><Avatar id={player.jugador_id} name={player.apodo} color={player.color} level={player.nivel}/></span><span className="sv-menu-profile-text" aria-hidden="true"><b>{player.apodo}</b><span>Nivel {player.nivel} · <Icono nombre="racha" size={15}/> {player.racha||0} días seguidos</span></span><span className="sv-menu-view" aria-hidden="true">Ver ›</span></Link>
  <section className="sv-menu-block" aria-labelledby="sv-menu-yours"><h2 id="sv-menu-yours">Lo tuyo</h2><div className="sv-menu-features">
   <Link className="sv-menu-feature achievements" to="/suizamente/logros" aria-busy={!achievements&&!achievementError} aria-label={all?'Logros: tienes '+done+' de '+total+'.'+(closest?' El que tienes más cerca: '+closest.nombre+', '+closest.avance+' de '+closest.meta:total?' ¡Los tienes todos!':''):'Logros: cargando tu progreso'}>
    <span className="sv-menu-feature-icon" aria-hidden="true"><Icono nombre="trofeo" size={40}/></span><b aria-hidden="true">Logros</b><span className="sv-menu-number" aria-hidden="true">{done??'…'}<small>/{total??'…'}</small></span>
    <span className="sv-menu-progress" role={total?'progressbar':undefined} aria-label="Progreso de Logros" aria-valuenow={done} aria-valuemin={total?0:undefined} aria-valuemax={total||undefined}>{all&&<i style={{width:(total?100*done/total:0)+'%'}}/>}</span>
    <span className="sv-menu-almost" aria-hidden="true">{closest?<>Casi: <b>{closest.nombre}</b> · {closest.avance}/{closest.meta}</>:all?total?'¡Los tienes todos!':'Todavía no hay logros disponibles':achievementError?'No se pudieron cargar los logros':'Cargando logros…'}</span>
   </Link>
   <Link className="sv-menu-feature notebook" to="/suizamente/libreta" aria-busy={!notebook&&!notebookError} aria-label={saved?'Libreta: '+count+' '+(count===1?'dato guardado':'datos guardados'):'Libreta: cargando tus datos'}><span className="sv-menu-feature-icon" aria-hidden="true"><Icono nombre="libreta" size={40}/></span><b aria-hidden="true">Libreta</b><span className="sv-menu-number" aria-hidden="true">{count??'…'}<small> {count===1?'dato':'datos'}</small></span><span className="sv-menu-latest" aria-hidden="true">{saved?count?latest:'Guarda datos con 🔖 al ver la respuesta':notebookError?'No se pudieron cargar tus datos':'Cargando tus datos…'}</span></Link>
  </div></section>
  <section className="sv-menu-block" aria-labelledby="sv-menu-backpack"><div className="sv-menu-block-heading"><h2 id="sv-menu-backpack">Tu mochila</h2><Link to="/suizamente/tienda">Tienda ›</Link></div><ul className="sv-menu-backpack" aria-label="Tus comodines y escudos">{inventory.map(item=><li key={item.id} aria-label={item.name+': '+item.count}><Icono nombre={item.icon} size={30}/><b aria-hidden="true">{item.count}</b><span aria-hidden="true">{item.name}</span></li>)}</ul></section>
  <section className="sv-menu-block" aria-labelledby="sv-menu-play"><h2 id="sv-menu-play">Juega y participa</h2><div className="sv-menu-list" role="list" aria-label="Juega y participa"><MenuRow to="/suizamente/misiones" icon="misiones" tint="#D3F8F3" title="Misiones y eventos" subtitle="Tres misiones nuevas cada día" badge={(completed??'…')+'/'+missionTotal} label={'Misiones y eventos: '+(completed??'cargando')+' de '+missionTotal+' hechas hoy'}/><MenuRow to="/suizamente/crea-preguntas" icon="lapiz" tint="#FEEDD1" title="Crea preguntas" subtitle="Propón y valora preguntas nuevas"/><MenuRow to="/suizamente/amigos" icon="amigos" tint="#DFE7FC" title="Buscar jugadores" subtitle="Por nombre o @usuario"/></div></section>
  <section className="sv-menu-block" aria-labelledby="sv-menu-help"><h2 id="sv-menu-help">Ayuda y ajustes</h2><div className="sv-menu-list" role="list" aria-label="Ayuda y ajustes"><MenuRow to="/suizamente/como-se-juega" icon="ayuda" tint="#DFE7FC" title="Cómo se juega" subtitle="Las reglas, paso a paso"/><MenuRow to="/suizamente/ajustes" icon="ajustes" tint="#F4F7FB" title="Ajustes" subtitle="Música, avisos, cuenta y privacidad"/>{capabilities?.admin&&<MenuRow to="/suizamente/admin" icon="ajustes" tint="#F4F7FB" title="Administración" subtitle="Administración de Suizamente"/>}</div></section>
  <Card className="sv-latido-card"><img src="/suizamente-assets/latido.svg" width="44" height="44" alt="Latido"/><div><b>Un juego de Latido</b><p>La comunidad hispanohablante en Suiza</p></div><a href="https://www.latido.ch" target="_blank" rel="noopener noreferrer">Abrir</a></Card>
  {problem&&<div className="sv-menu-error"><p role="alert">{problem}</p><button className="sv-text-button" onClick={()=>{reloadAchievements();reloadNotebook();reloadMissions()}}>Reintentar</button></div>}
 </div></section>
}
