import {QuestionOptions} from './QuestionOptions'
import {useEffect,useMemo,useState} from 'react'
import {Link,useLocation} from 'react-router-dom'
import {useSv} from './Context'
import {Avatar,Brand,Button,Card,Logo,Sheet} from './Shared'
import {ProposalFields} from './Community'
import {useData} from './useData'
import {cantonNames,szApi} from '../../../lib/suizamenteV2'
import './admin.css'
import {proposalLine} from '../../../lib/suizamenteAdmin'

const sections=[['resumen','📊','Resumen'],['propuestas','📥','Propuestas'],['avisos','⚠️','Avisos de datos'],['preguntas','❓','Preguntas'],['jugadores','👥','Jugadores'],['denuncias','🔎','Denuncias'],['dia','📅','Pregunta del día'],['ranking','🏆','Rankings'],['economia','🪙','Economía'],['partidas','🎡','Partidas'],['asaltos','⚔️','Asaltos'],['album','🃏','Álbum'],['eventos','🎉','Eventos'],['ligas','🏔️','Ligas'],['registro','📝','Registro']]
const dateLabel=s=>s?new Intl.DateTimeFormat('es-CH',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Zurich'}).format(new Date(s)):'—'
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Zurich',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const api=async(path,method='GET',body)=>{const data=await szApi('admin/'+path,{method,...(body?{body}:{})});if(method!=='GET')window.dispatchEvent(new Event('suizamente:admin'));return data}
function ErrorBox({error,retry}){return error?<Card><p className="sv-error" role="alert">{error}</p>{retry&&<Button tone="quiet" onClick={retry}>Recargar</Button>}</Card>:null}
function Loading(){return <div className="sv-skeleton" role="status" aria-label="Cargando administración"/>}
function AdminMobileHeader({detail}){
  return <header className="sv-admin-mobile-header">{detail?<>
    <Link aria-label="Volver a Propuestas" to="/suizamente/admin/propuestas">←</Link><b>Moderar propuesta</b>
  </>:<><Logo size={38}/><Brand/><span>Admin</span><Link aria-label="Volver al juego" to="/suizamente">🎮</Link></>}</header>
}
function ProposalPreview({draft}){
  const options=draft.tipo==='mito'?[{e:'✅',t:'Verdad'},{e:'❌',t:'Mito'}]:draft.opciones
  return <Card className="sv-admin-preview">
    <h2>👀 Así se verá</h2><div className="sv-admin-bubble"><span>{draft.emoji}</span>
      <small>{draft.tipo==='dilema'?'🤔 ¿QUÉ PREFIERES?':draft.tipo==='mito'?'✅ VERDAD O MITO':'🧠 CON RESPUESTA'}</small>
      <h3>{draft.pregunta}</h3>
    </div>{draft.tipo!=='dilema'?<QuestionOptions question={{opciones:options.map((o,indice)=>({...o,indice}))}} result={{correcta:draft.tipo==='mito'?(draft.verdad?0:1):draft.correcta}}/>:options.map((o,i)=><div className={'sv-review-option '+((draft.tipo==='real'&&i===draft.correcta)||(draft.tipo==='mito'&&i===(draft.verdad?0:1))?'correct':'')} key={i}>{draft.tipo==='dilema'&&<span>{o.e}</span>}{o.t}</div>)}
  </Card>
}
function SummaryMetric({emoji,label,n,prev,delta,percentage}){
  return <Card><div className="sv-admin-metric-label"><span>{emoji}</span><b>{label}</b></div><strong>{n}</strong>
    <small className={n>=prev?'positive':'negative'}>{delta===null?(n?'Nuevo en este periodo':'Sin cambios'):(delta>=0?'↑ ':'↓ ')+Math.abs(delta)+' %'}</small>
    {percentage!=null&&<small>{percentage} % de activos</small>}
  </Card>
}
function SummaryReview({id,emoji,name,n,since}){
  return <Link to={'/suizamente/admin/'+id}>
    <span className="sv-admin-review-icon">{emoji}</span><b className="sv-admin-review-count">{n}</b>
    <div><strong><span>{emoji} </span>{name}</strong>{since&&<small>La más antigua: {dateLabel(since)}</small>}</div><span>›</span>
  </Link>
}
function SummaryFailures({questions}){
  const {config}=useSv()
  const topic=q=>config.categorias.find(c=>c.temas.includes(q.tema))
  return <Card><h2>😬 Preguntas que más se fallan</h2><p className="sv-muted">Con 30 votos o más en el periodo. Si casi nadie acierta, revisa el dato.</p>
    {questions.length?<>
      <div className="sv-admin-failed-table"><table><thead><tr>{['Pregunta','Tema','Acierto','Votos',''].map((h,i)=><th key={i} scope="col">{h||<span className="sv-sr-only">Acciones</span>}</th>)}</tr></thead><tbody>
        {questions.map(q=><tr key={q.id}><td>{q.pregunta}</td><td><span style={{background:topic(q)?.tinte}}>{topic(q)?.emoji} {q.tema}</span></td><td><b>{q.pct} %</b></td><td>{q.votos}</td><td><Link to={'/suizamente/admin/preguntas/'+q.id}>Ver</Link></td></tr>)}
      </tbody></table></div>
      <div className="sv-admin-failed-cards">{questions.map(q=><Link key={q.id} className="sv-admin-failed" to={'/suizamente/admin/preguntas/'+q.id}><b>{q.pregunta}</b><small>{topic(q)?.emoji} {q.tema} · <b>{q.pct} % aciertos</b> · {q.votos} votos</small></Link>)}</div>
    </>:<p className="sv-admin-empty">Todavía no hay muestra suficiente.</p>}
  </Card>
}
function AdminDetailSplit({type,id,children}){
  return id?<div className="sv-admin-split sv-admin-support-detail"><AdminRelatedList type={type}/><div className="sv-admin-support-content">{children}</div></div>:children
}
function AdminRelatedList({type}){
  const {data,error,reload}=useData('admin/'+type)
  return <section className="sv-admin-list sv-admin-related-list" aria-label={type==='preguntas'?'Lista de preguntas':'Lista de jugadores'}>
    <ErrorBox error={error} retry={reload}/>{data?.filas.map(row=><Link key={row.id} className="sv-admin-list-row" to={'/suizamente/admin/'+type+'/'+row.id}>
      {type==='jugadores'?<Avatar id={row.id} name={row.apodo}/>:<span>{row.emoji}</span>}<div><b>{row.apodo||row.pregunta}</b><small>{row.tema||('Nivel '+row.nivel)}</small></div><b>›</b>
    </Link>)}{!data&&!error&&<Loading/>}
  </section>
}
export function AdminEntry(){const {data}=useData('capacidades');return <section style={{padding:24}}><h2>Suizamente · Administración</h2>{data?.admin?<><p>Revisa propuestas, datos, jugadores y la economía del juego.</p><Link className="sv-button" to="/suizamente/admin">Abrir el panel de Suizamente</Link></>:<p>{data?'Acceso restringido a administración de Latido.':'Comprobando acceso…'}</p>}</section>}
export function AdminPanel(){
  const {capabilities}=useSv(),location=useLocation(),[more,setMore]=useState(false),[pending,setPending]=useState({})
  const [raw,id]=location.pathname.split('/').slice(3),section=raw||'resumen'
  useEffect(()=>{if(!capabilities?.admin)return;let active=true;const refresh=()=>api('resumen').then(d=>{if(active)setPending(d.pendientes)}).catch(()=>{});refresh();window.addEventListener('suizamente:admin',refresh);return()=>{active=false;window.removeEventListener('suizamente:admin',refresh)}},[capabilities?.admin,location.pathname])
  const item=sections.find(s=>s[0]===section)||sections[0]
  if(!capabilities)return <section className="sv-screen"><div className="sv-content"><Loading/></div></section>
  if(!capabilities.admin)return <section className="sv-screen"><div className="sv-welcome"><h1>Acceso restringido</h1><p>Solo administración de Latido.</p><Button to="/suizamente">Volver al juego</Button></div></section>
  const nav=(s,compact=false)=><Link key={s[0]} to={'/suizamente/admin/'+s[0]} aria-current={section===s[0]?'page':undefined} onClick={()=>setMore(false)}><span>{s[1]}</span><b>{compact&&s[0]==='avisos'?'Avisos':s[2]}</b>{pending[s[0]]>0&&<em className="sv-admin-badge">{pending[s[0]]}</em>}</Link>
  return <div className={"sv-admin-layout"+(section==='propuestas'&&id?' is-proposal-detail':'')}><aside className="sv-admin-sidebar"><div className="sv-admin-brand"><Logo size={42}/><div><Brand/><small>Administración</small></div></div><nav>{sections.map(s=>nav(s))}</nav><Link className="sv-admin-return" to="/suizamente">🎮 Volver al juego</Link></aside><div className="sv-admin-body"><AdminMobileHeader detail={section==='propuestas'&&!!id}/><main className={'sv-admin-main '+(id?'has-selection':'')}><header className="sv-admin-page-title"><div><h1>{item[1]} {item[2]}</h1><p>{dateLabel(new Date().toISOString())} · Hora de Zúrich</p></div><span className="sv-admin-tag">Admin</span></header>
    {section==='resumen'?<Summary/>:section==='propuestas'?<AdminProposals id={id}/>:section==='economia'?<EconomyEditor/>:section==='dia'?<Calendar/>:section==='ranking'?<AdminRanking/>:section==='eventos'?<AdminEvents/>:section==='ligas'?<AdminLeagues/>:section==='preguntas'?<AdminDetailSplit type="preguntas" id={id}><Questions id={id}/></AdminDetailSplit>:section==='jugadores'?<AdminDetailSplit type="jugadores" id={id}><Players id={id}/></AdminDetailSplit>:['avisos','denuncias'].includes(section)?<Reports type={section}/>:<Support type={section}/>}
  </main></div><nav className="sv-admin-bottom" aria-label="Administración">{['resumen','propuestas','avisos','jugadores'].map(k=>nav(sections.find(s=>s[0]===k),true))}<button onClick={()=>setMore(true)}><span>☰</span><b>Más</b></button></nav>{more&&<Sheet title="Administración" onClose={()=>setMore(false)}><nav className="sv-admin-more">{sections.filter(s=>!['resumen','propuestas','avisos','jugadores'].includes(s[0])).map(s=>nav(s))}</nav></Sheet>}</div>
}
function Summary(){
  const [period,setPeriod]=useState('hoy'),{data,error,reload}=useData('admin/resumen?periodo='+period)
  const labels=[['activos','👥','Jugadores activos'],['respuestas','💬','Respuestas'],['dia','📊','Pregunta del día votada'],['perfiles','🆕','Perfiles nuevos']]
  return <><div className="sv-admin-period">{[['hoy','Hoy'],['7d','7 días'],['30d','30 días']].map(([k,l])=><button key={k} aria-pressed={period===k} onClick={()=>setPeriod(k)}>{l}</button>)}</div><ErrorBox error={error} retry={reload}/>{data?<><section className="sv-admin-metrics">{labels.map(([k,emoji,label])=>{
    const n=data.actual[k],prev=data.anterior[k],delta=prev?Math.round(100*(n-prev)/prev):null
    return <SummaryMetric key={k} emoji={emoji} label={label} n={n} prev={prev} delta={delta} percentage={k==='dia'&&data.actual.activos?Math.round(100*n/data.actual.activos):null}/>
  })}</section><h2>Por revisar</h2><div className="sv-admin-review-cards">{[['propuestas','📥','Propuestas'],['avisos','⚠️','Avisos de datos'],['denuncias','🔎','Apodos denunciados']].map(([id,e,name])=><SummaryReview key={id} id={id} emoji={e} name={name} n={data.pendientes[id]} since={id==='propuestas'?data.pendientes.desde:null}/>)}</div><div className="sv-admin-summary-columns"><SummaryFailures questions={data.falladas}/><div><Card><h2>Pregunta de hoy</h2><p>{data.dia.votos} votos</p><Button tone="quiet" to="/suizamente/admin/dia">Ver calendario</Button></Card><Card><h2>Ranking de la semana</h2>{data.ranking.slice(0,3).map((p,i)=><p key={p.id}>{['🥇','🥈','🥉'][i]} {p.apodo} · {p.victorias} victorias</p>)}</Card></div></div></>:!error&&<Loading/>}</>
}
function AdminProposals({id}){
  const [status,setStatus]=useState('pendiente'),[query,setQuery]=useState(''),[type,setType]=useState(''),[theme,setTheme]=useState(''),[order,setOrder]=useState('nuevas'),[filters,setFilters]=useState(false),[revision,setRevision]=useState(0),{config}=useSv()
  const url='admin/propuestas?'+new URLSearchParams({estado:status,q:query,tipo:type,tema:theme,orden:order,r:String(revision)}),{data,error,reload}=useData(url)
  const controls=<><label>Tipo<select value={type} onChange={e=>setType(e.target.value)}><option value="">Todos</option><option value="dilema">¿Qué prefieres?</option><option value="real">Con respuesta</option><option value="mito">Verdad o mito</option></select></label><label>Tema<select value={theme} onChange={e=>setTheme(e.target.value)}><option value="">Todos</option>{config.categorias.flatMap(c=>c.temas).map(t=><option key={t}>{t}</option>)}</select></label><label>Orden<select value={order} onChange={e=>setOrder(e.target.value)}><option value="nuevas">Más recientes</option><option value="antiguas">Más antiguas</option></select></label></>
  return <><div className="sv-admin-proposal-filters"><div className="sv-tab-pills">{[['pendiente','⏳ Pendientes'],['aprobada','✅ Aprobadas'],['rechazada','❌ Rechazadas']].map(([key,name])=><button key={key} aria-pressed={status===key} onClick={()=>setStatus(key)}>{name} {data?.contadores?.[key]||0}</button>)}</div><div className="sv-admin-searchline"><input type="search" aria-label="Buscar propuestas" placeholder="Busca por texto o apodo" value={query} onChange={e=>setQuery(e.target.value)}/><button className="sv-mini-button" onClick={()=>setFilters(true)}>🎚️ Filtros</button></div><div className="sv-admin-desktop-filters">{controls}</div></div><ErrorBox error={error} retry={reload}/><div className="sv-admin-split"><section className="sv-admin-list">{data?.filas.map(p=><Link key={p.id} className={'sv-admin-proposal-card '+(id===p.id?'selected':'')} to={'/suizamente/admin/propuestas/'+p.id}><span>{p.contenido.emoji}</span><div><b>{p.pregunta}</b><small>@{p.autor||'Perfil eliminado'} · {p.contenido.tema}</small><small>{dateLabel(p.creadoEn)} · 👍 {p.bien} · 👎 {p.error}</small></div><strong>›</strong></Link>)}{data&&!data.filas.length&&<Card>No hay propuestas con estos filtros.</Card>}{!data&&!error&&<Loading/>}</section><section className="sv-admin-detail">{id?<ProposalDetail key={id} id={id} onSaved={()=>setRevision(v=>v+1)}/>:<Card className="sv-admin-empty">Elige una propuesta para revisarla.</Card>}</section></div>{filters&&<Sheet title="Filtrar propuestas" onClose={()=>setFilters(false)}>{controls}<Button onClick={()=>setFilters(false)}>Aplicar</Button></Sheet>}</>
}
function ProposalDetail({id,onSaved}){
  const {data,error,reload}=useData('admin/propuestas/'+id),[draft,setDraft]=useState(null),[note,setNote]=useState(''),[published,setPublished]=useState(''),[busy,setBusy]=useState(false),[fault,setFault]=useState(''),[confirm,setConfirm]=useState(false),[notice,setNotice]=useState('')
  const line=useMemo(()=>draft?proposalLine(draft):'',[draft])
  useEffect(()=>{if(data){setDraft(data.contenido);setNote(data.nota||'');setPublished(data.preguntaId||'')}},[data])
  async function act(operation){
    setBusy(true);setFault('');setNotice('')
    try{
      if(!['vincular','guardar'].includes(operation)&&!data.preguntaId&&(JSON.stringify(draft)!==JSON.stringify(data.contenido)||note!==(data.nota||'')))await api('propuestas/'+id,'PUT',{contenido:draft,nota:note})
      if(operation==='guardar')await api('propuestas/'+id,'PUT',{contenido:draft,nota:note})
      else await api('propuestas/'+id+'/'+operation,'POST',operation==='vincular'?{preguntaId:published}:{nota:note})
      setNotice('Cambios guardados');setConfirm(false);reload();onSaved()
    }catch(e){setFault(e.message)}finally{setBusy(false)}
  }
  return <><Link className="sv-admin-detail-back" to="/suizamente/admin/propuestas">← Propuestas</Link><ErrorBox error={error||fault} retry={reload}/>{data&&draft?<><div className="sv-admin-person"><Avatar id={data.autor?.id} name={data.autor?.apodo||'?'} color="menta"/><div><b>{data.autor?.apodo||'Perfil eliminado'}</b><small>{data.autor?.pais} · {cantonNames[data.autor?.canton]} · 🏅 {data.autor?.aprobadas||0} aprobadas</small><small>{dateLabel(data.creadoEn)} · {data.estado}</small></div></div><ProposalPreview draft={draft}/><Card><h2>🧪 Comprobaciones</h2><p>{data.comprobaciones.valida?'✅ Longitudes y palabras correctas':'⚠️ '+data.comprobaciones.motivo}</p><p>{data.comprobaciones.sinFuente?'⚠️ Sin fuente':'✅ Con fuente'}</p>{data.comprobaciones.parecida?<Link to={'/suizamente/admin/preguntas/'+data.comprobaciones.parecida.id}>⚠️ Parecida: {data.comprobaciones.parecida.pregunta} ({Math.round(data.comprobaciones.parecida.similitud*100)} %)</Link>:<p>✅ Sin coincidencias de texto relevantes</p>}</Card><Card><h2>✏️ Editar</h2><fieldset disabled={!!data.preguntaId||busy} className="sv-admin-fieldset"><ProposalFields value={draft} onChange={setDraft}/><label>Nota para el autor<textarea aria-label="Nota para el autor" value={note} maxLength={1000} onChange={e=>setNote(e.target.value)}/></label></fieldset></Card><Card><h2>📝 Línea para fuentes/</h2><pre className="sv-export-line" aria-label="Línea para fuentes">{line}</pre><Button tone="quiet" onClick={async()=>{try{await navigator.clipboard.writeText(line);setNotice('Línea copiada')}catch{setFault('Selecciona y copia la línea.')}}}>📋 Copiar línea</Button><p className="sv-muted">Añádela a la fuente de comunidad y genera el banco. Después, vincula aquí el id publicado.</p><label>Id publicado<input aria-label="Id publicado" value={published} onChange={e=>setPublished(e.target.value)} disabled={!!data.preguntaId}/></label><Button disabled={busy||!!data.preguntaId||data.estado!=='aprobada'||!published.trim()} onClick={()=>act('vincular')}>🔗 Vincular</Button></Card><p className="sv-muted">👍 {data.valoraciones.bien} · 👎 {data.valoraciones.error}</p>{notice&&<p role="status">{notice}</p>}<footer className="sv-admin-fixed-actions"><Button tone="quiet" disabled={busy||!!data.preguntaId} onClick={()=>act('guardar')}>💾 Guardar</Button><Button tone="danger" disabled={busy||!!data.preguntaId||data.estado==='rechazada'} onClick={()=>note.trim()?act('rechazar'):setConfirm(true)}>❌ Rechazar</Button><Button disabled={busy||!!data.preguntaId||data.estado==='aprobada'||!data.comprobaciones.valida} onClick={()=>act('aprobar')}>✅ Aprobar</Button></footer></>:!error&&<Loading/>}{confirm&&<Sheet title="¿Rechazar sin nota?" onClose={()=>setConfirm(false)}><p>Una nota ayuda a mejorar la propuesta.</p><Button tone="danger" disabled={busy} onClick={()=>act('rechazar')}>Rechazar sin nota</Button><Button tone="quiet" onClick={()=>setConfirm(false)}>Volver a escribir la nota</Button></Sheet>}</>
}
function EconomyEditor(){
  const {data,error,reload}=useData('admin/economia'),{refreshConfig}=useSv(),[draft,setDraft]=useState(null),[text,setText]=useState(''),[busy,setBusy]=useState(false),[fault,setFault]=useState(''),[notice,setNotice]=useState('')
  useEffect(()=>{if(data){setDraft(data.juego);setText(JSON.stringify(data.juego,null,2))}},[data])
  function change(path,value){
    const next=structuredClone(draft);let obj=next
    path.slice(0,-1).forEach(k=>{obj=obj[k]});obj[path.at(-1)]=value
    if(path[0]==='comodines'&&path[2]==='precio')next.tienda.comodines[next.comodines[path[1]].id]=value
    setDraft(next);setText(JSON.stringify(next,null,2))
  }
  async function save(){setBusy(true);setFault('');setNotice('');try{await api('economia','PUT',{version:data.version,juego:JSON.parse(text)});await refreshConfig();setNotice('Configuración aplicada. Las partidas empezadas conservan sus reglas.');reload()}catch(e){setFault(e.message)}finally{setBusy(false)}}
  const number=(label,path)=>{let value=draft;path.forEach(k=>{value=value[k]});return <label key={path.join('.')}>{label}<input type="number" min={0} step={Number.isInteger(value)?1:.001} value={value} onChange={e=>change(path,Number(e.target.value))}/></label>}
  return <><ErrorBox error={error||fault} retry={reload}/>{draft&&data?<><Card><h2>Valores del juego · versión {data.version}</h2><p>Los cambios se guardan en la base de datos y se aplican sin desplegar.</p></Card><div className="sv-admin-economy-grid"><Card><h2>🪙 Premios</h2>{[['acierto','Acierto'],['selloConPregunta','Sello'],['partidaGanada','Partida ganada'],['partidaPerdida','Partida perdida'],['preguntaDelDia','Pregunta del día']].map(([key,name])=><div className="sv-admin-number-pair" key={key}>{number(name+' · monedas',['recompensas',key,'monedas'])}{number(name+' · XP',['recompensas',key,'xp'])}</div>)}</Card><Card><h2>🛒 Tienda</h2>{draft.comodines.map((c,i)=>number(c.nombre,['comodines',i,'precio']))}{number('Escudo',['tienda','escudo'])}{number('Sobre',['tienda','sobre'])}<h2>⏳ Tiempo</h2>{number('Segundos por pregunta',['partida','segundosPorPregunta'])}{number('Horas por turno',['partida','horasPorTurno'])}</Card></div><details className="sv-admin-advanced"><summary>Configuración completa</summary><textarea aria-label="Configuración JSON" className="sv-code-editor" spellCheck={false} value={text} onChange={e=>setText(e.target.value)}/></details><Button disabled={busy} onClick={save}>💾 Guardar Economía</Button>{notice&&<p role="status">{notice}</p>}<Card><h2>Historial</h2>{data.historial.map(h=><div className="sv-history-row" key={h.version}><span>Versión {h.version} · {dateLabel(h.fecha)}</span><button className="sv-mini-button" onClick={()=>{setDraft(h.juego);setText(JSON.stringify(h.juego,null,2));setNotice('Versión cargada en el editor. Guárdala para aplicarla.')}}>Cargar en el editor</button></div>)}</Card></>:!error&&<Loading/>}</>
}
function SearchLine({value,onChange,label='Buscar'}){return <input type="search" aria-label={label} placeholder={label} value={value} onChange={e=>onChange(e.target.value)}/>}
function Questions({id}){
  const {config}=useSv(),[theme,setTheme]=useState(''),[query,setQuery]=useState(''),[type,setType]=useState(''),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[fault,setFault]=useState(''),{data,error,reload}=useData(id?'admin/preguntas/'+encodeURIComponent(id):'admin/preguntas?'+new URLSearchParams({q:query,tipo:type,tema:theme}))
  async function toggle(){setBusy(true);try{await api('preguntas/'+id+'/'+(data.oculta?'mostrar':'ocultar'),'POST',{motivo:reason});reload()}catch(e){setFault(e.message)}finally{setBusy(false)}}
  return <><ErrorBox error={error||fault} retry={reload}/>{id?<><Link to="/suizamente/admin/preguntas">← Preguntas</Link>{data?<Card><h2>{data.emoji} {data.pregunta}</h2><p>{data.id} · {data.tema} · {data.oculta?'Oculta':'Visible'}</p>{data.opciones.map((o,i)=><p key={i}>{data.tipo==='real'&&i===data.correcta?'✓ ':''}{data.tipo==='dilema'?o.e+' ':''}{o.t}</p>)}<p>💡 {data.dato}</p><p>{data.votos} votos</p>{data.reparto?<p>Reparto: {data.reparto.join(' · ')}{data.aciertoPct!=null?' · Acierto: '+data.aciertoPct+' %':' '}</p>:<p className="sv-privacy">🔒 Porcentajes a partir de 20 votos.</p>}{data.autor&&<p>Propuesta por {data.autor}</p>}{data.desglose?.map(g=><p key={g.tipo+g.grupo}>{g.tipo==='pais'?'País':'Años en Suiza'}: {g.grupo} · {g.aciertoPct!=null?g.aciertoPct+' % de acierto':g.porcentajes.join(' % · ')+' %'}</p>)}<label>Motivo<input aria-label="Motivo del cambio de pregunta" value={reason} maxLength={300} onChange={e=>setReason(e.target.value)}/></label><Button tone={data.oculta?'':'danger'} disabled={busy||!reason.trim()} onClick={toggle}>{data.oculta?'Mostrar pregunta':'Ocultar pregunta'}</Button><h3>Avisos</h3>{data.avisos.map(a=><p key={a.id}>{a.motivo} · {a.estado}</p>)}</Card>:!error&&<Loading/>}</>:<><SearchLine value={query} onChange={setQuery} label="Buscar preguntas"/><select aria-label="Tipo de pregunta" value={type} onChange={e=>setType(e.target.value)}><option value="">Todos los tipos</option><option value="real">Con respuesta</option><option value="dilema">¿Qué prefieres?</option></select><select aria-label="Tema de pregunta" value={theme} onChange={e=>setTheme(e.target.value)}><option value="">Todos los temas</option>{[...new Set(config.categorias.flatMap(c=>c.temas))].map(t=><option key={t}>{t}</option>)}</select><div className="sv-admin-list">{data?.filas.map(q=><Link className="sv-admin-list-row" to={'/suizamente/admin/preguntas/'+q.id} key={q.id}><span>{q.emoji}</span><div><b>{q.pregunta}</b><small>{q.tema} · {q.id} · {q.oculta?'Oculta':'Visible'}</small></div><b>›</b></Link>)}</div></>}</>
}
function Players({id}){
  const [query,setQuery]=useState(''),[nickname,setNickname]=useState(''),[fault,setFault]=useState(''),[busy,setBusy]=useState(false),{data,error,reload}=useData(id?'admin/jugadores/'+id:'admin/jugadores?q='+encodeURIComponent(query))
  useEffect(()=>{if(data?.apodo)setNickname(data.apodo)},[data])
  async function act(operation){setBusy(true);try{await api('jugadores/'+id+'/'+operation,'POST',{apodo:nickname});reload()}catch(e){setFault(e.message)}finally{setBusy(false)}}
  return <><ErrorBox error={error||fault} retry={reload}/>{id?<><Link to="/suizamente/admin/jugadores">← Jugadores</Link>{data&&<Card><h2>{data.apodo}</h2><p>{data.pais} · {cantonNames[data.canton]} · {data.anos_suiza}</p><p>⭐ Nivel {data.nivel} · 🪙 {data.monedas} · 🔥 {data.racha}</p><p>{data.desempeno.ganadas} ganadas · {data.desempeno.perdidas} perdidas · {data.desempeno.abandonadas} abandonadas</p><p>{data.propuestas} propuestas · {data.denuncias} denuncias</p><label>Nuevo apodo<input aria-label="Nuevo apodo" value={nickname} maxLength={20} minLength={2} onChange={e=>setNickname(e.target.value)}/></label><Button disabled={busy||nickname.trim().length<2} onClick={()=>act('renombrar')}>Renombrar y pedir otro apodo</Button><Button tone="quiet" disabled={busy} onClick={()=>act(data.excluidoRanking?'restaurar-ranking':'quitar-ranking')}>{data.excluidoRanking?'Devolver a los rankings':'Quitar de los rankings'}</Button><Button tone={data.bloqueado?'':'danger'} disabled={busy} onClick={()=>act(data.bloqueado?'desbloquear':'bloquear')}>{data.bloqueado?'Desbloquear':'Bloquear'}</Button></Card>}</>:<><SearchLine value={query} onChange={setQuery} label="Buscar jugadores por apodo"/><div className="sv-admin-list">{data?.filas.map(p=><Link className="sv-admin-list-row" key={p.id} to={'/suizamente/admin/jugadores/'+p.id}><Avatar id={p.id} name={p.apodo}/><div><b>{p.apodo}</b><small>Nivel {p.nivel} · {cantonNames[p.canton]} · 🪙 {p.monedas}{p.bloqueado?' · Bloqueado':''}</small></div><b>›</b></Link>)}</div></>}</>
}
function Reports({type}){
  const {data,error,reload}=useData('admin/'+type),[fault,setFault]=useState(''),[busy,setBusy]=useState(false)
  async function act(id,operation){setBusy(true);try{await api(type+'/'+id+'/'+operation,'POST');reload()}catch(e){setFault(e.message)}finally{setBusy(false)}}
  return <><ErrorBox error={error||fault} retry={reload}/>{data?.filas.map(r=><Card key={r.id}>{type==='avisos'?<><Link to={'/suizamente/admin/preguntas/'+r.id}><h2>{r.pregunta}</h2></Link><p>{r.pendientes} pendientes</p>{r.avisos.map(a=><div className="sv-admin-report" key={a.id}><p>{a.motivo}</p><small>{a.estado} · {dateLabel(a.fecha)}</small>{a.estado==='pendiente'&&<div className="sv-admin-inline"><button disabled={busy} onClick={()=>act(a.id,'resolver')}>Marcar resuelto</button><button disabled={busy} onClick={()=>act(a.id,'descartar')}>Descartar</button></div>}</div>)}</>:<><Link to={'/suizamente/admin/jugadores/'+r.jugadorId}><h2>{r.apodo||'Perfil eliminado'}</h2></Link><p>{r.motivo}</p><small>{r.estado} · {dateLabel(r.fecha)}</small>{r.estado==='pendiente'&&<Button tone="quiet" disabled={busy} onClick={()=>act(r.id,'resolver')}>Marcar resuelto</Button>}</>}</Card>)}{data&&!data.filas.length&&<Card>No hay avisos pendientes.</Card>}</>
}
function Calendar(){
  const [from,setFrom]=useState(today),[chosen,setChosen]=useState(null),[pid,setPid]=useState(''),[fault,setFault]=useState(''),{data,error,reload}=useData('admin/dia?desde='+from),[busy,setBusy]=useState(false)
  async function save(){setBusy(true);try{await api('dia/'+chosen.fecha,'PUT',{preguntaId:pid});setChosen(null);reload()}catch(e){setFault(e.message)}finally{setBusy(false)}}
  return <><label>Calendario de 14 días desde<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><ErrorBox error={error||fault} retry={reload}/><div className="sv-calendar-grid">{data?.dias.map(d=><Card key={d.fecha}><small>{d.fecha}</small><h3>{d.pregunta}</h3><p>{d.votos} votos · {d.id}</p>{d.porcentajes&&<p>{d.porcentajes.join(' % · ')} %</p>}<button className="sv-mini-button" disabled={d.fecha<=today()} onClick={()=>{setChosen(d);setPid(d.id)}}>Cambiar</button></Card>)}</div>{chosen&&<Sheet title={'Pregunta del '+chosen.fecha} onClose={()=>setChosen(null)}><label>Id del dilema publicado<input aria-label="Id del dilema" value={pid} onChange={e=>setPid(e.target.value)}/></label><Link to="/suizamente/admin/preguntas" onClick={()=>setChosen(null)}>Buscar en Preguntas</Link><Button disabled={busy||!pid} onClick={save}>Guardar cambio</Button>{fault&&<p role="alert" className="sv-error">{fault}</p>}</Sheet>}</>
}
function AdminRanking(){
  const [week,setWeek]=useState(''),{data,error,reload}=useData('admin/ranking'+(week?'?semana='+week:'')),[fault,setFault]=useState('')
  async function act(id,op){try{await api('ranking/'+op,'POST',{jugadorId:id,semana:data.semana});reload()}catch(e){setFault(e.message)}}
  return <><label>Semana (lunes)<input type="date" value={week||data?.semana||''} onChange={e=>setWeek(e.target.value)}/></label><ErrorBox error={error||fault} retry={reload}/><div className="sv-admin-list">{data?.filas.map(p=><div className="sv-admin-list-row" key={p.id}><b>{p.puesto}</b><span>{p.apodo} · {p.victorias} victorias · {p.sellos} sellos</span><button className="sv-mini-button" onClick={()=>act(p.id,'excluir')}>Excluir</button></div>)}</div>{data?.excluidos.length>0&&<Card><h2>Excluidos de esta semana</h2>{data.excluidos.map(p=><div className="sv-history-row" key={p.id}><b>{p.apodo}</b><button className="sv-mini-button" onClick={()=>act(p.id,'incluir')}>Restaurar</button></div>)}</Card>}</>
}
function Support({type}){
  const [query,setQuery]=useState(''),{data,error,reload}=useData('admin/'+type+(type==='partidas'?'?q='+encodeURIComponent(query):''))
  return <><ErrorBox error={error} retry={reload}/>{type==='partidas'&&<SearchLine value={query} onChange={setQuery} label="Buscar por id o apodo"/>}{!data&&!error?<Loading/>:data&&type==='album'?<div className="sv-admin-data-grid">{data.colecciones.map(c=><Card key={c.id}><h2>{c.nombre}</h2><p>{c.cartas} cartas · {c.repartidas} repartidas</p><p>{c.completadas} colecciones completadas</p><small>{c.mes||'Disponible desde el principio'}</small></Card>)}</div>:data&&type==='asaltos'?<><h2>Actividad de los últimos siete días</h2>{data.actividad.map((r,i)=><Card key={i}><Link to={'/suizamente/admin/jugadores/'+r.jugadorId}><b>{r.apodo}</b></Link><p>{r.ofertas} ofertas · máximo en un día: {r.maxDia}</p><p>{r.victimasDistintas} personas distintas · hasta {r.maxContraUnaPersona} contra la misma persona</p>{r.superaLimite&&<p className="sv-error">⚠️ Supera el límite configurado</p>}</Card>)}<h2>Últimos asaltos</h2>{data.filas.map(r=><Card key={r.id}><b>{r.autor||'Perfil eliminado'} → {r.victima||'Perfil eliminado'}</b><p>{cantonNames[r.canton]} · {r.estado} · 🪙 {r.premio}{r.escudo?' · 🛡️':''}</p><small>{dateLabel(r.fecha)}</small></Card>)}</>:data&&type==='partidas'?data.filas.map(m=><Card key={m.id}><h2>{m.a||'Perfil eliminado'} · {m.b||'Buscando rival'}</h2><p>{m.estado} · ronda {m.ronda} · {m.fase}</p><p>🛂 {m.sellosA.length}–{m.sellosB.length} · turno de {m.turno||'—'}</p><small>{m.id}</small><p className="sv-muted">Plazo: {dateLabel(m.plazo)}</p></Card>):data&&type==='registro'?data.filas.map(r=><Card key={r.id}><b>{r.accion}</b><p>{r.objeto}</p><small>{dateLabel(r.fecha)} · {r.adminId}</small><details><summary>Detalle</summary><pre className="sv-export-line">{JSON.stringify(r.detalle,null,2)}</pre></details></Card>):null}{data&&((data.filas&&!data.filas.length)||(data.colecciones&&!data.colecciones.length))&&<Card>No hay datos que mostrar.</Card>}</>
}

function AdminEvents(){
  const [from,setFrom]=useState(today),[chosen,setChosen]=useState(null),[type,setType]=useState(''),[category,setCategory]=useState('')
  const [busy,setBusy]=useState(false),[fault,setFault]=useState(''),[notice,setNotice]=useState('')
  const {data,error,reload}=useData('admin/eventos?desde='+from)
  function edit(event){setChosen(event);setType(event.tipo);setCategory(event.categoria||data.categorias[0].id);setFault('');setNotice('')}
  async function save(automatic=false){
    setBusy(true);setFault('')
    try{
      await api('eventos/'+chosen.viernes,automatic?'DELETE':'PUT',{version:chosen.version,tipo:type,categoria:category})
      setChosen(null);setNotice(automatic?'Rotación automática restaurada':'Evento programado');reload()
    }catch(e){setFault(e.message)}finally{setBusy(false)}
  }
  return <>
    <label>Fines de semana desde<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
    <p className="sv-muted">De viernes a las 18:00 a domingo a las 23:59, hora de Zúrich. Si no programas uno, se usa la rotación automática.</p>
    <ErrorBox error={error||fault} retry={reload}/>{notice&&<p role="status">{notice}</p>}
    {!data&&!error&&<Loading/>}
    <div className="sv-admin-data-grid">{data?.filas.map(event=><Card key={event.viernes}>
      <small>{event.viernes} · {event.automatico?'Automático':'Programado'}</small>
      <h2>🎉 {event.titulo}</h2><p>{event.efecto}</p>
      <p className="sv-muted">{dateLabel(event.inicio)} → {dateLabel(event.fin)}</p>
      <Button tone="quiet" disabled={Date.parse(event.inicio)<=Date.now()} onClick={()=>edit(event)}>Programar evento</Button>
    </Card>)}</div>
    {chosen&&<Sheet title={'Evento del '+chosen.viernes} onClose={()=>!busy&&setChosen(null)}>
      <label>Tipo de evento<select value={type} onChange={e=>setType(e.target.value)}>{data.tipos.map(t=><option value={t.id} key={t.id}>{t.texto.replace('{categoria}','categoría')}</option>)}</select></label>
      {type==='categoria'&&<label>Categoría del evento<select value={category} onChange={e=>setCategory(e.target.value)}>{data.categorias.map(c=><option value={c.id} key={c.id}>{c.emoji} {c.nombre}</option>)}</select></label>}
      <p>{data.tipos.find(t=>t.id===type)?.efecto}</p>
      <Button disabled={busy} onClick={()=>save()}>Guardar evento</Button>
      {!chosen.automatico&&<Button tone="quiet" disabled={busy} onClick={()=>save(true)}>Restaurar rotación automática</Button>}
      {fault&&<p className="sv-error" role="alert">{fault}</p>}
    </Sheet>}
  </>
}

function AdminLeagues(){
  const [week,setWeek]=useState(''),[division,setDivision]=useState(''),[group,setGroup]=useState('')
  const {data,error,reload}=useData('admin/ligas'+(week?'?semana='+week:''))
  const groups=useMemo(()=>[...new Map((data?.filas||[]).filter(r=>!division||r.division===division).map(r=>[
    r.division+':'+r.grupo,{id:r.division+':'+r.grupo,division:r.division,n:r.grupo},
  ])).values()],[data,division])
  const name=id=>data?.divisiones.find(d=>d.id===id)?.nombre||id
  return <>
    <div className="sv-admin-filters">
      <label>Semana de liga (lunes)<input type="date" value={week||data?.semana||''} onChange={e=>{setWeek(e.target.value);setGroup('')}}/></label>
      <label>División<select value={division} onChange={e=>{setDivision(e.target.value);setGroup('')}}><option value="">Todas</option>{data?.divisiones.map(d=><option key={d.id} value={d.id}>{d.emoji} {d.nombre}</option>)}</select></label>
      <label>Grupo<select value={group} onChange={e=>setGroup(e.target.value)}><option value="">Todos</option>{groups.map(g=><option key={g.id} value={g.id}>{name(g.division)} · {g.n}</option>)}</select></label>
    </div>
    <ErrorBox error={error} retry={reload}/>{!data&&!error&&<Loading/>}
    {data&&<p className="sv-muted">{data.cerrada?'Resultado definitivo':'Clasificación en curso: los ascensos y descensos son provisionales.'}</p>}
    {groups.filter(g=>!group||g.id===group).map(g=><Card key={g.id}>
      <h2>{name(g.division)} · Grupo {g.n}</h2>
      <div className="sv-admin-list">{data.filas.filter(r=>r.division===g.division&&r.grupo===g.n).map(r=>{
        const before=data.divisiones.findIndex(d=>d.id===r.division),after=data.divisiones.findIndex(d=>d.id===r.destino)
        return <div className="sv-admin-list-row sv-admin-league-row" key={r.id}>
          <b>{r.puesto}.</b><Link to={'/suizamente/admin/jugadores/'+r.id}>{r.apodo}</Link><strong>{r.puntos} puntos</strong>
          <small>{r.excluido?'Excluido':after>before?'⬆️ Sube a '+name(r.destino):after<before?'⬇️ Baja a '+name(r.destino):'Permanece'}</small>
        </div>
      })}</div>
    </Card>)}
    {data&&!groups.length&&<Card>No hay grupos en esta semana. Participan las cuentas que jugaron la semana anterior.</Card>}
  </>
}
