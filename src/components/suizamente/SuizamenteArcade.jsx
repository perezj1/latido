import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {Link,useLocation,useNavigate} from 'react-router-dom'
import {useAuth} from '../../hooks/useAuth'
import {invalidateSuizamente,suizamenteCall,useSuizamente,szLevel,szPercent,szProgress,szSourceLabel,SZ_CATEGORIES,SZ_LEVELS} from '../../lib/suizamente'
import MT from '../../data/suizamenteMountains.json'
import {geo,land,trailSVG,WAY} from './trailLandscape'
import {CheckIcon,ReviewIcon,MountainIcon,MountainSky,ProgressBar,SwissFlag} from './SuizamenteVisuals'
import Modal from './SuizamenteSheet'
import Preferences from './SuizamentePreferences'
import Weekly from './SuizamenteWeekly'
import {useTrailScene} from './useTrailScene'
import './SuizamenteArcade.css'
import './SuizamenteLandscape.css'

export const PRIZES={x2:{icon:'⚡',name:'XP doble',description:'Duplica los XP de los primeros aciertos y el bonus de tu próxima etapa nueva. Se activa al empezarla.'},life:{icon:'❤️',name:'Vida extra',description:'Permite un fallo más en el próximo test de cima. Se activa al empezar el test.'},freeze:{icon:'🧊',name:'Protector de racha',description:'Protege un día sin jugar. Se usa automáticamente cuando vuelves a completar una etapa.'}}
export function stageInfo(data,level=data?.player?.level||1,node=data?.trail?.node??-1){
  const m=MT[level],s=m.st[node],summit=node===m.st.length,arrival=node===-1
  return {m,s,summit,arrival,node,level,title:arrival?`Llegada a ${m.n}`:summit?'Test de cima':s?.[0]||'Camino completado',icon:arrival?'🚉':summit?'🏔️':s?.[1]==='rep'?'🔁':s?.[1],total:arrival?3:summit?m.test:s?.[1]==='🎁'?3:m.q}
}
function Navigation({tab}){
  return <nav className="sg-nav" aria-label="Navegación de Suizamente">{[['inicio','🏠','Inicio','/'],['camino','🥾','Camino','/suizamente'],['reto','🏆','Reto','/suizamente/reto'],['progreso','🏔️','Progreso','/suizamente/progreso']].map(([id,icon,label,to])=><Link key={id} to={to} aria-label={id==='inicio'?'Inicio de Latido':label} aria-current={tab===id?'page':undefined}><span aria-hidden="true">{icon}</span>{label}</Link>)}</nav>
}
export function Inventory({inventory={}}){return <ul className="sg-inventory">{Object.entries(PRIZES).map(([id,p])=><li key={id}><span aria-hidden="true">{p.icon}</span><div><b>{p.name}</b><small>{p.description}</small></div><strong>{inventory[id]||0}</strong></li>)}</ul>}
export function StreakWeek({trail}){
  const date=trail?.day||new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Zurich',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),now=new Date(`${date}T12:00:00Z`),weekday=(now.getUTCDay()+6)%7
  return <div className="sg-week" aria-label="Actividad de esta semana">{['L','M','X','J','V','S','D'].map((d,i)=>{const day=new Date(now);day.setUTCDate(now.getUTCDate()+i-weekday);const record=trail?.days?.find(item=>item.day===day.toISOString().slice(0,10));return <span className={`${record?'done':''} ${i===weekday?'now':''}`} key={i}><small>{d}</small><b aria-label={record?.protected?'Racha protegida':record?'Etapa completada':'Sin etapa'}>{record?.protected?'🧊':record?'✓':''}</b></span>})}</div>
}
function TrailMap({data,level,setLevel,open,selected}){
  const m=MT[level],p=szProgress(data),current=data?.trail?.node??-1,viewport=useRef(null),here=useRef(null)
  const G=useMemo(()=>geo(level,m.st.length),[level,m.st.length])
  const {phase,reducedMotion,paused}=useTrailScene(viewport)
  // Supplied SVG artwork, decorative lighting and numeric trail geometry only.
  const landscape=useMemo(()=>land(level,G,{phase,reducedMotion})+trailSVG(G,m.way,level<p.level?m.st.length+2:level===p.level?Math.max(0,current+1):0,szLevel(level).color),[level,G,m.way,p.level,current,phase,reducedMotion])
  const state=node=>level<p.level||p.completed&&level===p.level?'done':level>p.level||node===m.st.length&&p.xp<p.target?'lock':node<current?'done':node===current?'cur':'lock'
  useLayoutEffect(()=>{const frame=requestAnimationFrame(()=>{const vp=viewport.current,el=here.current;if(vp)vp.scrollTo({top:level===p.level&&el?el.getBoundingClientRect().top-vp.getBoundingClientRect().top+vp.scrollTop-vp.clientHeight*.55:0,behavior:'instant'})});return()=>cancelAnimationFrame(frame)},[level,!!data])
  const nodes=[-1,...m.st.map((_,i)=>i),m.st.length]
  return <div className="sg-map-viewport" data-scene={phase} ref={viewport}>
    <header className="sg-mountain-head" style={{'--sg-head':m.bh,'--sg-head-dark':m.bd}}>
      <div className="sg-mountain-switch" role="group" aria-label="Montañas">{SZ_LEVELS.map(l=><button key={l.id} onClick={()=>setLevel(l.id)} aria-pressed={level===l.id} aria-label={`${l.name}${l.id>p.level?', aún bloqueada':l.id<p.level?', completada':', aquí estás'}`}><MountainIcon level={l.id} compact muted={l.id>p.level}/>{l.id<p.level&&<small className="is-complete" aria-hidden="true">✓</small>}{l.id>p.level&&<small aria-hidden="true">🔒</small>}</button>)}<button onClick={()=>open('more')} aria-label="Nuevas cumbres, próximamente">＋</button></div>
      <div className="sg-mountain-title"><div><small>NIVEL {level} · {m.top.toUpperCase()} · {m.alt}</small><h1 title={`${m.n}: ${m.sub}`}>{m.n}: {m.sub}</h1></div><button onClick={()=>open('guide')}><i className={`sg-way ${m.way}`}/>Guía</button></div>
      <p>{WAY[m.way].name} · llegada, {m.st.length} etapas de {m.q} preguntas y test de {m.test}</p>
    </header>
    <div className="sg-map" style={{aspectRatio:`360 / ${G.H}`,'--sg-mountain':szLevel(level).color,'--sg-mountain-dark':m.lcd}}>
      <div className={`sg-landscape${paused?' is-paused':''}`} dangerouslySetInnerHTML={{__html:landscape}}/>
      <div className={`sg-signpost ${m.way}`} style={{top:`${(G.H-226)/G.H*100}%`}} aria-hidden="true"><span className={`sg-sign ${m.way}`}><b>{m.top}</b><small>{m.alt}</small></span><span className={`sg-sign ${m.way}`}><b>{m.st.length} etapas</b><small>y el test de cima</small></span></div>
      {nodes.map(node=>{const info=stageInfo(data,level,node),[x,y]=node===-1?G.start:info.summit?G.sum:G.stops[node],st=state(node),sv=data?.trail?.active,active=sv?.level===level&&sv.node===node?sv:null
        return <div className={`sg-anchor is-${st}`} key={node} ref={st==='cur'?here:undefined} style={{left:`${x/3.6}%`,top:`${y/G.H*100}%`}}>
          {st==='cur'&&<><span className="sg-node-ring" style={{'--sg-node-progress':`${active?active.answered/active.total*100:0}%`}}/><span className="sg-bubble">{active?'Sigue aquí':'Empieza'}</span></>}
          <button className={`sg-node ${info.arrival?'arrival':''} ${info.summit?'summit':''} ${info.s?.[1]==='🎁'?'bonus':''}`} aria-expanded={selected?.node===node&&selected?.level===level} aria-label={`${info.arrival?info.title:info.summit?`${m.top}: test de cima`:`Etapa ${node+1}: ${info.title}`}, ${st==='done'?'hecha':st==='cur'?'tu siguiente etapa':'bloqueada'}`} onClick={()=>open('stage',{node,level})}>{info.summit?<SwissFlag/>:st==='done'?<CheckIcon/>:info.s?.[1]==='rep'?<ReviewIcon/>:<span aria-hidden="true">{info.icon}</span>}</button>
          <span className={`sg-sign ${info.summit?'center':x<180?'right':'left'} ${m.way}`} aria-hidden="true"><b>{info.arrival?'Llegada':info.summit?m.top:info.title}</b><small>{info.summit?`Test · ${info.total} preguntas`:st==='done'?'✓ Hecha':active?`Sigue · ${active.answered}/${active.total}`:info.s?.[1]==='🎁'?`Premio ${PRIZES[info.s[2]]?.icon}`:info.s?.[1]==='rep'?'Errores pendientes':`${info.total} preguntas`}</small></span>
        </div>
      })}
    </div>
  </div>
}
export default function SuizamenteArcade(){
  const location=useLocation(),navigate=useNavigate(),{authUser}=useAuth(),{data,error,loading,refresh}=useSuizamente(),p=szProgress(data)
  const tab=location.pathname.endsWith('/reto')?'reto':location.pathname.endsWith('/progreso')||location.pathname.startsWith('/perfil')?'progreso':'camino'
  const [level,setLevel]=useState(null),[sheet,setSheet]=useState(null),[selected,setSelected]=useState(null),[preferences,setPreferences]=useState(false),[busy,setBusy]=useState(false),[playError,setPlayError]=useState(''),[guestPreferences,setGuestPreferences]=useState({include_general:true,include_canton:true,canton:''})
  const shownLevel=level||p.level,inventory=data?.trail?.inventory||{},trail=data?.trail||{},sources=data?.player||guestPreferences,invN=Object.values(inventory).reduce((a,b)=>a+Number(b||0),0)
  const pending=useRef(false)
  function open(name,value){if(busy)return;setSheet(name==='stage'&&sheet==='stage'&&selected?.node===value?.node&&selected?.level===value?.level?null:name);setSelected(value||null);setPlayError('')}
  useEffect(()=>{if(location.pathname.endsWith('/ascenso')){setSelected({level:p.level,node:MT[p.level].st.length});setSheet('stage')}},[location.pathname,p.level])
  async function start(mode='game',category,options){
    if(pending.current)return
    if(!authUser){navigate('/suizamente/partida/demo',{state:{returnTo:location.pathname}});return}
    pending.current=true;setBusy(true);setPlayError('')
    try{const s=mode==='game'?await suizamenteCall('game_start',options||selected||{}):await suizamenteCall('start',{mode,category});invalidateSuizamente();navigate(`/suizamente/partida/${s.id}`,{state:{returnTo:location.pathname}})}catch(e){setPlayError(e.message)}finally{pending.current=false;setBusy(false)}
  }
  const info=selected?stageInfo(data,selected.level,selected.node):null,current=trail.node??-1,locked=info&&(info.level>p.level||info.level===p.level&&info.node>current),done=info&&(info.level<p.level||info.level===p.level&&(info.node<current||p.completed)),xpReady=p.xp>=p.target
  const summitTomorrow=info?.summit&&!done&&trail.summit_today&&trail.summit_today.level!==info.level
  const stageKind=info?.s?.[1]==='🎁'?'bonus':info?.s?.[1]==='rep'?'review':'stage'
  const stageMinutes=info?.arrival?1:stageKind==='bonus'?2:Math.max(3,Math.round((info?.total||5)*.6))
  const cardTitle=info?.arrival?`LLEGADA · ${info.m.n}`:info?.summit?`TEST DE CIMA · ${info.m.top}`:`${stageKind==='bonus'?'RETO CON PREMIO · ':''}ETAPA ${(info?.node||0)+1} DE ${info?.m.st.length}`
  const content=<main className="sz-arcade" aria-label="Suizamente">
    <header className="sg-topbar"><button className="sg-chip" onClick={()=>setPreferences(true)} aria-label={`Preguntas: ${szSourceLabel(sources)}. Cambiar`} disabled={!!authUser&&!data?.player}><SwissFlag/><span>{sources.include_canton!==false&&sources.canton?`${sources.include_general!==false?'+':''}${sources.canton}`:'CH'}</span></button><button className={`sg-chip fire${trail.today?'':' off'}`} onClick={()=>open('streak')} aria-label={`Racha de ${trail.streak||0} días`}><span aria-hidden="true">🔥</span>{trail.streak||0}</button><Link className="sg-chip xp" to="/suizamente/progreso" aria-label={`${p.xp} XP. Ver progreso`}><span aria-hidden="true">⚡</span>{p.xp}</Link><button className="sg-chip inventory" onClick={()=>open('inventory')} aria-label={`Mochila: ${invN} premios`}><span aria-hidden="true">🎒</span>{invN}</button></header>
    {error&&<div className="sg-alert" role="alert"><span>{error.message}</span><button onClick={refresh}>Reintentar</button><Link to="/suizamente/partida/demo">Probar demo</Link></div>}
    {loading&&!data&&authUser&&<p className="sg-loading" role="status">Cargando tu sendero…</p>}
    {!authUser&&<div className="sg-guest">Prueba el juego. <Link to="/auth?next=%2Fsuizamente">Inicia sesión</Link> para guardar tu ascenso.</div>}
    {data?.config?.enabled===false&&<p className="sg-guest">Suizamente está en mantenimiento. Tu progreso se conserva.</p>}
    {playError&&!sheet&&<p className="sg-alert" role="alert">{playError}</p>}
    {tab==='camino'?<TrailMap data={data} level={shownLevel} setLevel={next=>{setLevel(next);if(sheet==='stage')setSheet(null)}} open={open} selected={sheet==='stage'?selected:null}/>:<div className="sg-content">{tab==='reto'?<Weekly data={data} actor={authUser} busy={busy} start={start} openPreferences={()=>setPreferences('ranking')}/>:<Knowledge data={data} loading={loading} actor={authUser} start={start} busy={busy} onSources={()=>setPreferences(true)} onInventory={()=>open('inventory')}/>}</div>}
    <Navigation tab={tab}/>
    <Preferences open={preferences} onClose={()=>setPreferences(false)} data={data} onGuestSave={setGuestPreferences} guestPreferences={guestPreferences}/>
    <Modal show={!!sheet} onClose={()=>!busy&&setSheet(null)} variant={sheet==='stage'?'card':'sheet'} className={sheet==='stage'?`sg-stage-card ${info?.m.way} ${stageKind==='bonus'?'gold':''}`:sheet==='streak'?'sg-streak-sheet':sheet==='guide'||sheet==='more'?'sg-explainer-sheet':''} showClose={sheet==='stage'} title={sheet==='stage'?<><span>{cardTitle}</span>{!info?.summit&&<small>⏱ {stageMinutes} min</small>}</>:sheet==='inventory'?'🎒 Tu mochila':sheet==='streak'?`🔥 ${trail.streak||0} días de racha`:sheet==='guide'?`📖 ${MT[shownLevel].n} · ${MT[shownLevel].sub}`:'🏔️ Siempre hay otra cumbre'}>
      <div className="sz-stack sg-sheet-content">
        {sheet==='inventory'&&<><p>Gana premios en las preguntas con regalo de las etapas y en los retos de tres preguntas. Cada premio del sendero se gana una vez.</p><Inventory inventory={inventory}/></>}
        {sheet==='streak'&&<><p>{trail.today?'Hoy ya has completado una etapa. Vuelve mañana para sumar otro día.':'Completa una etapa hoy para encender la llama. Solo se suma un día de racha por día, con la hora de Suiza.'}</p><StreakWeek trail={trail}/><p>Tienes {inventory.freeze||0} protectores. Cada uno cubre un día perdido; se aplica al completar tu siguiente etapa.</p></>}
        {sheet==='guide'&&<><p>Los senderos de Suizamente se marcan como los de Suiza. Cuanto más alta es la montaña, más exigente es la marca y más largo el sendero.</p><ul className="sg-tips sg-guide-signs">
          <li><span className="sg-tip-icon" aria-hidden="true"><i className="sg-way w"/></span><span><b>Amarillo · Wanderweg (sendero).</b> Uetliberg y Rigi.</span></li>
          <li><span className="sg-tip-icon" aria-hidden="true"><i className="sg-way b"/></span><span><b>Blanco-rojo-blanco · Bergwanderweg (sendero de montaña).</b> Pilatus y Eiger.</span></li>
          <li><span className="sg-tip-icon" aria-hidden="true"><i className="sg-way a"/></span><span><b>Blanco-azul-blanco · Alpinwanderweg (sendero alpino).</b> Matterhorn.</span></li>
        </ul><p><b>{MT[shownLevel].n}:</b> {MT[shownLevel].st.length} etapas de {MT[shownLevel].q} preguntas y un test de cima de {MT[shownLevel].test}, que apruebas con {MT[shownLevel].pass} aciertos.</p></>}
        {sheet==='more'&&<><p>Suizamente crece: después del Matterhorn llegan nuevos senderos.</p><ul className="sg-tips sg-upcoming-list">
          <li><span className="sg-tip-icon" aria-hidden="true">🏔️</span><span><b>Temporada 2:</b> Säntis, Titlis y Jungfraujoch, con paisajes y preguntas nuevas.</span></li>
          <li><span className="sg-tip-icon" aria-hidden="true">📍</span><span><b>Senderos cantonales:</b> uno por cantón, con sus normas y servicios.</span></li>
          <li><span className="sg-tip-icon" aria-hidden="true">❄️</span><span><b>Modo invierno:</b> vuelve a subir las montañas que ya hiciste, con preguntas más difíciles y el doble de XP.</span></li>
          <li><span className="sg-tip-icon" aria-hidden="true">🏆</span><span><b>Reto semanal:</b> 10 preguntas cada semana, iguales para todos. Ya disponible.</span></li>
        </ul><small className="sg-future-note">Temporada 2, senderos cantonales y modo invierno: próximamente.</small></>}
        {sheet==='stage'&&info&&<><h3 className="sg-stage-name">{info.arrival&&done?'Llegada hecha':info.summit?`Test de ${info.m.top}`:stageKind==='bonus'?`Acierta las 3 y gana ${PRIZES[info.s[2]].icon} ${PRIZES[info.s[2]].name}`:info.title}</h3>
          <p>{locked?'Completa las etapas anteriores de esta montaña para llegar hasta aquí.':done?'Ya has completado este tramo. Puedes repetirlo para practicar, sin duplicar los premios ni el bonus.':info.arrival?`Antes de subir, descubre ${info.m.n}: su historia, cómo se llega y lo que la hace única.`:info.summit?`${info.m.test} preguntas de la montaña. Necesitas ${info.m.pass} aciertos${inventory.life?' (un fallo más con tu vida extra)':''}. Un intento por día, con reinicio a las 00:00, hora de Suiza. Al salir, el intento termina.`:info.s?.[1]==='🎁'?`Tres preguntas: acierta las tres y gana ${PRIZES[info.s[2]].name.toLowerCase()}. Si fallas, puedes repetir el reto para conseguir el premio.`:info.s?.[1]==='rep'?'Repasa tus errores pendientes. Si no hay errores, afianza lo aprendido con preguntas de tu nivel.':'Preguntas de distintos tipos para aprender jugando. Toca la respuesta y descubre la explicación.'}</p>
          {info.summit&&!done&&<p className="sg-requirement">{xpReady?'✓':`🔒`} {p.xp} / {p.target} XP · {current>=info.m.st.length?'✓ Etapas completadas':'Completa todas las etapas'}</p>}
          {summitTomorrow&&<p className="sz-muted">Hoy ya has realizado un test de cima. Puedes seguir practicando y hacer otro test desde las 00:00 del día siguiente, hora de Suiza.</p>}
          {playError&&<p className="sz-error-text" role="alert">{playError}</p>}
          <button className="sz-button sz-button--primary" disabled={busy||locked||summitTomorrow||info.summit&&!done&&!xpReady||data?.config?.enabled===false||!!authUser&&data?.game_version!==4} onClick={()=>start()}>{busy?'Preparando…':locked?'Etapa bloqueada':!authUser?'Probar demostración':summitTomorrow?'Test disponible mañana':done?'Repetir para practicar':trail.active?.node===info.node&&trail.active?.level===info.level?'Continuar mi etapa':info.summit?trail.summit_today?.level===info.level?'Ver mi test de hoy':'Empezar test de cima':'Empezar'}</button>
          {info.summit&&!xpReady&&!locked&&<button className="sz-button sz-button--secondary" disabled={busy} onClick={()=>start('practice')}>Practicar para ganar XP</button>}
        </>}
        {sheet!=='stage'&&<button className="sz-button sz-button--primary" onClick={()=>setSheet(null)}>Entendido</button>}
      </div>
    </Modal>
  </main>
  return createPortal(content,document.body)
}
function Knowledge({data,actor,start,busy,loading,onSources,onInventory}){
  const [scope,setScope]=useState('all'),[level,setLevel]=useState(0),{data:filtered}=useSuizamente({scope,level}),p=szProgress(data),stats=filtered?.stats||{},trail=data?.trail||{},m=MT[p.level]
  const completed=(trail.nodes||[]).filter(n=>n.node>=0&&n.level>=p.level&&n.node<MT[n.level].st.length).length+Object.entries(MT).filter(([lv])=>Number(lv)<p.level).reduce((n,[,v])=>n+v.st.length,0)
  return <div className="sz-stack sg-knowledge"><div className="sz-between"><h1 className="sz-page-title">Tu Suizómetro</h1><small>🔒 Privado</small></div>{!actor?<section className="sz-card"><p>Inicia sesión para guardar tus etapas, tu mochila y tus estadísticas.</p><Link className="sz-button sz-button--primary" to="/auth?next=%2Fsuizamente%2Fprogreso">Iniciar sesión</Link></section>:loading&&!data?<p role="status">Cargando progreso…</p>:<>
    <section className="sg-level-card"><MountainSky level={p.level}/><div className="sz-stack"><div className="sz-between"><strong>{m.n}</strong><small>Nivel {p.level} de 5 · {trail.node===-1?'llegada':`etapa ${Math.min((trail.node||0)+1,m.st.length)} de ${m.st.length}`}</small></div><ProgressBar level={p.level} percent={p.percent}/><div className="sz-between"><b>{p.xp} / {p.target} XP</b><small>{p.completed?'Las cinco cimas completadas':p.remaining?`Faltan ${p.remaining} XP para el test`:'XP del test conseguidos'}</small></div></div></section>
    <div className="sg-stat-grid">{[['🔥',trail.streak||0,'días de racha'],['⚡',p.xp,'XP en total'],['🥾',`${completed} / 51`,'etapas hechas'],['🎯',stats.seen?`${szPercent(stats.first_correct,stats.seen)} %`:'—','acierto inicial']].map(([icon,value,label])=><div key={label}><span aria-hidden="true">{icon}</span><div><b>{value}</b><small>{label}</small></div></div>)}</div>
    <div className="sz-between"><h2 className="sz-h2">🎒 Tu mochila</h2><button className="sz-text-link" onClick={onInventory}>Cómo se usa</button></div><Inventory inventory={trail.inventory}/>
    <button className="sg-source-row" onClick={onSources}><SwissFlag/><span><b>Preguntas de</b><small>{szSourceLabel(data?.player)}</small></span><strong>Cambiar</strong></button>
    <button className="sz-button sz-button--secondary" disabled={busy||!data?.stats?.pending} onClick={()=>start('review')}>🔁 Repasar errores ({data?.stats?.pending||0})</button>
    {data?.legacy_active&&<Link className="sz-text-link" to={`/suizamente/partida/${data.legacy_active.id}`} state={{returnTo:'/suizamente/progreso'}}>Continuar partida guardada →</Link>}
    <h2 className="sz-h2">Tu ascenso</h2><ol className="sg-ascent-list">{SZ_LEVELS.map(l=><li key={l.id} className={l.id===p.level?'current':''}><MountainIcon level={l.id}/><span><b>{l.name} · {MT[l.id].alt}</b><small>{MT[l.id].st.length} etapas · {MT[l.id].q} preguntas · test de {MT[l.id].test}</small></span><strong>{l.id<p.level||p.completed?'✓ Cima':l.id===p.level?'Aquí estás':'🔒'}</strong></li>)}</ol>
    <h2 className="sz-h2">Lo que estás aprendiendo</h2><div className="sz-filters" role="group" aria-label="Ámbito de las estadísticas">{[['all','Todo'],['CH','Suiza general'],...(data?.player?.canton?[['canton',data.player.canton]]:[])].map(([id,label])=><button key={id} aria-pressed={scope===id} onClick={()=>setScope(id)}>{label}</button>)}</div><label className="sz-field">Dificultad<select value={level} onChange={e=>setLevel(Number(e.target.value))}><option value={0}>Todos los niveles</option>{SZ_LEVELS.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
    {SZ_CATEGORIES.map(c=>{const row=filtered?.categories?.find(v=>v.id===c.id)||{};return <section className="sz-card sz-stack" key={c.id}><div className="sz-between"><h3 className="sz-h3">{c.emoji} {c.name}</h3><b>{row.seen?`${szPercent(row.first_correct,row.seen)} %`:'—'}</b></div><ProgressBar level={p.level} percent={szPercent(row.first_correct,row.seen)||0}/><p className="sz-muted">{row.first_correct||0} de {row.seen||0} aciertos iniciales · {row.pending||0} repasos{c.optional?' · idiomas opcionales, sin XP':''}</p>{!!row.recent_seen&&<small>Últimas {row.recent_seen} nuevas: {szPercent(row.recent_correct,row.recent_seen)} %</small>}<button className="sz-text-link" disabled={busy} onClick={()=>start('practice',c.id)}>Practicar {c.short} →</button></section>})}
    <Link className="sz-button sz-button--secondary" to="/suizamente/reto">🏆 Reto semanal y privacidad</Link><p className="sz-muted">Tu progreso es privado. Solo se publica tu alias y el resultado semanal si decides participar. El Suizómetro refleja aprendizaje dentro del juego.</p>
  </>}</div>
}
