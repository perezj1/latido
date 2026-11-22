import {TEMAS,CANTONES,PAISES,ANOS,MEDALLAS,MEDALLAS_ESTILO,NIVELES,MODOS,esc,numero,avatar} from './experiencia-datos.js'
import {compartirHistoria,crearHistoria} from './historia.js'
import {demoEnabled,repartoDemo} from './demostracion.js'
import {clasificacionSemanal,clasificacionCantones} from './clasificacion.js'
import {prepararFoto,guardarFoto} from './foto-perfil.js'
import {crearConquista} from './conquista.js'

const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{/* The game also works with storage disabled. */}}
const empty=(emoji,text)=>`<div class="s-empty"><span class="emoji" aria-hidden="true">${emoji}</span>${esc(text)}</div>`
const button=(label,attrs='',kind='')=>`<button class="s-button ${kind}" type="button" ${attrs}>${label}</button>`
const options=(values,selected,placeholder='Elige una opción')=>`<option value="">${placeholder}</option>`+Object.entries(values).map(([id,label])=>`<option value="${id}" ${id===selected?'selected':''}>${esc(label)}</option>`).join('')
const flag=country=>`<img class="s-country-flag" src="/suizamente/banderas/${Object.hasOwn(PAISES,country)&&/^[A-Z]{2}$/.test(country)?country.toLowerCase():'otro'}.svg" width="20" height="15" alt="" aria-hidden="true">`
const yearOrder=['menos1','1a3','3a10','mas10']
const trashIcon='<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5m4-5v5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
const safePath=value=>typeof value==='string'&&/^\/(?:retos|ranking|libreta|perfil(?:\/editar)?|amigos|bienvenida|como-se-juega|medallas|ajustes|proponer|moderacion|avisos|jugar|conquista(?:\/(?:tienda|batallas|coleccion|retar|avisos|canton\/[A-Z]{2}|(?:partida|batalla)\/[a-f0-9-]{36}))?|duelo\/[A-Fa-f0-9]{8})?(?:\?[^#]*)?$/.test(value)&&value.length<600

export async function crearExperiencia({container,questions,identity,getIdentity,playerId,play,stopGame,getCounts,getDisplayCounts,getSaved,importAnswers,onSettings,getRound=()=>null}) {
  const account=identity.userId||playerId,key='suizamente:experiencia:'+account
  const cached=read(key,{})
  const state={profile:cached.profile||null,books:cached.books||[],sentInvites:cached.sentInvites||{},online:false,loading:true,route:identity.path||'/',authors:{},roundPoints:0,newMedals:[],levelUp:false}
  const cache=new Map();let revision=0,poll,toastTimer,returnRoute='/',stopPeopleSearch=()=>{},shareSheet=null,currentResult=null
  const toastNode=document.createElement('div');toastNode.className='s-toast';toastNode.setAttribute('role','status');toastNode.setAttribute('aria-live','polite');document.body.append(toastNode)
  const question=id=>questions.find(q=>q.id===id)
  const remember=()=>write(key,{profile:state.profile,books:state.books,sentInvites:state.sentInvites})
  const toast=text=>{toastNode.textContent=text;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastNode.textContent='',4500)}
  function settings(){return state.profile?.ajustes||read('suizamente:ajustes',{})}
  function applySettings(){const prefs=settings();document.documentElement.dataset.theme=prefs.apariencia||'light';document.documentElement.dataset.reducedMotion=String(!!prefs.menosAnimaciones);onSettings(prefs);write('suizamente:ajustes',prefs)}
  async function api(path,{method='GET',body,force=false,signal}={}) {
    if(method==='GET'&&!force&&cache.has(path)&&cache.get(path).until>Date.now())return cache.get(path).data
    const id=await getIdentity(),headers={'Content-Type':'application/json','X-Jugador-Id':playerId}
    if(id.token)headers.Authorization='Bearer '+id.token
    let response
    try{response=await fetch(identity.socialApi+path,{method,headers,...(body?{body:JSON.stringify(body)}:{}),signal:signal||AbortSignal.timeout(15000)})}catch(error){if(signal?.aborted)throw error;state.online=false;throw new Error('No podemos conectar ahora. Puedes seguir jugando y volver a intentarlo después.')}
    const data=await response.json().catch(()=>({}))
    if(!response.ok){if(response.status>=500)state.online=false;throw new Error(response.status>=500?'No podemos conectar ahora. Puedes seguir jugando.':data.error||'No se ha podido completar la solicitud.')}
    state.online=true
    if(method==='GET')cache.set(path,{data,until:Date.now()+15000});else cache.clear()
    if(data.perfil){state.profile=data.perfil;remember();applySettings()}
    if(data.libreta){state.books=data.libreta;remember()}
    return data
  }
  const conquista=crearConquista({identity,getIdentity,navigate,toast})
  const logged=()=>!!identity.userId
  const logoutButton=()=>identity.canLogout?button('Cerrar sesión','data-logout','secondary full'):''
  const register=()=>{const url=new URL(identity.accountPath||'/cuenta',location.origin);url.searchParams.set('mode','register');window.top.location.assign(url.pathname+url.search)}
  const login=()=>{window.parent===window?location.assign('/cuenta'):window.top.location.assign(identity.accountPath||'/cuenta')}
  function requireAccount(){if(logged())return true;toast('Entra en Suizamente para continuar.');login();return false}
  function notify(path){identity.path=path;if(window.parent!==window)window.parent.postMessage({type:'suizamente:navigate',path},location.origin)}
  function navigate(path,{fromHost=false}={}){if(!safePath(path))return;shareSheet?.close();stopPeopleSearch();stopGame();state.route=path;if(!fromHost)notify(path);render()}
  function startRound(options,path){returnRoute=state.route.startsWith('/jugar')?'/':state.route;state.route=path||('/jugar?modo='+options.modo);notify(state.route);play(options)}
  function header(title,{back='/',subtitle='',actions=''}={}){return `<div class="s-title-row"><div><h1>${esc(title)}</h1>${subtitle?`<p class="s-soft">${esc(subtitle)}</p>`:''}</div>${actions||button('×',`data-go="${back}" aria-label="Volver"`,'secondary small')}</div>`}
  function navigation(active){return `<nav class="s-nav s-nav-conquista" aria-label="Navegación de Suizamente">${[['/','🎮','Jugar'],['/retos','⚡','Retos'],['/conquista','🗺️','Conquista'],['/ranking','🏆','Ranking'],['/libreta','📒','Libreta'],['/perfil','👤','Perfil']].map(([path,emoji,title])=>`<button type="button" data-go="${path}" ${path==='/perfil'?'aria-label="Tu perfil"':''} ${path===active?'aria-current="page"':''}><span ${path==='/perfil'?'class="s-nav-profile"':''} aria-hidden="true">${path==='/perfil'?avatar(state.profile||{apodo:identity.userName||'Invitado'}):emoji}</span>${title}</button>`).join('')}</nav>`}
  function page(content,{main=false,path=''}={}){stopPeopleSearch();container.classList.remove('playing');container.classList.toggle('welcoming',path==='/bienvenida');container.innerHTML=`<section class="social ${main?'':'detail'} ${path==='/'?'s-home':''}" data-online="${state.online}">${content}</section>${main?navigation(path):''}`;window.scrollTo({top:0});bind()}
  function level(){const p=state.profile;if(!p)return '';return `<div><div class="s-row s-level"><b>Nivel ${p.nivel} · ${esc(p.nombreNivel)}</b><div class="s-progress"><i style="width:${Number(p.progreso)||0}%"></i></div></div><p class="s-level-note">${p.siguiente?`Te faltan ${numero(p.faltan)} puntos para ${esc(p.siguiente)}.`:'Has llegado a Leyenda alpina. Sigue aprendiendo.'}</p></div>`}
  function modes(){return `<nav class="s-modes" aria-label="Modos de juego">${Object.entries(MODOS).map(([id,[emoji,name,desc]])=>`<button type="button" class="s-mode" data-play="${id}" data-modo="${id}"><span class="s-mode-icon" aria-hidden="true">${emoji}</span><span class="s-mode-copy"><b>${name}</b><small>${desc}</small></span><span class="s-mode-play" aria-hidden="true">▶</span></button>`).join('')}</nav>`}
  function offline(){return state.online?'':state.loading?'<p class="s-note" role="status">Conectando con tu progreso…</p>':'<p class="s-note" role="status">Ahora no podemos conectar con la comunidad. Puedes seguir jugando; tus datos guardados se conservan en este dispositivo.</p>'}
  function topics(){return `<div class="s-pills" aria-label="Temas">${Object.entries(TEMAS).map(([id,[emoji,name]])=>`<button class="s-pill" type="button" data-topic="${id}">${emoji} ${name}</button>`).join('')}</div>`}
  function timeLeft(date){const hours=Math.max(0,Math.ceil((new Date(date)-Date.now())/3600000));return hours>=24?`Termina en ${Math.ceil(hours/24)} días`:`Termina en ${hours} h`}
  const shortDate=iso=>new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(iso+'T12:00:00Z')).replace('.','')
  async function home(){
    let daily=null,community=null
    if(state.online)[daily,community]=await Promise.all([api('/daily').catch(()=>null),api('/community').catch(()=>null)])
    const p=state.profile, name=p?.apodo||identity.userName
    let q=question(community?.comunidad?.preguntaId), c=community?.comunidad
    if(!q&&demoEnabled()){q=question('montana_lago');const rep=q&&repartoDemo(q,[]);if(rep)c={pct:Math.round(100*rep.n[0]/rep.total),opcion:0,demo:true}}
    const saved=q&&getSaved()[q.id],selected=Number.isInteger(saved?.o)&&q.opciones[saved.o]?saved.o:null
    const displayed=q&&getDisplayCounts?.(q.id),counts=displayed?.total?displayed:q&&c?.demo?repartoDemo(q,getCounts(q.id)):null
    const selectedPct=selected===null?null:counts?.total?Math.round(100*(counts.n[selected]||0)/counts.total):selected===c?.opcion?c.pct:null
    const dailyCard=daily?`<button type="button" class="s-daily-link" data-daily><span class="s-daily-icon" aria-hidden="true">📅</span><span class="s-grow"><b>Reto del día</b><small>${daily.hecho?'Ver mi resultado':'5 preguntas para todos'} · ${timeLeft(daily.terminaEn)}</small></span><span class="s-mode-play" aria-hidden="true">${daily.hecho?'✓':'▶'}</span><span class="s-visually-hidden">${daily.hecho?'Ver mi resultado':'Jugar el reto'}</span></button>`:''
    return `<div class="s-row s-between"><div class="s-brand"><img src="/suizamente/icons/suizamente-circle-logo-192.png" alt="Suizamente"><span><span class="a">Suiza</span><span class="b">mente</span></span></div>${p?`<span class="s-badge">🔥 ${p.racha}</span>`:''}</div>
      <div class="s-home-progress"><p class="s-greeting">${name&&name!=='Invitado'?`Hola, ${esc(name)} 👋`:'Aprende algo nuevo sobre Suiza'}</p>${level()}</div>${offline()}
      <section class="s-stack s-play-section"><h1>¡A jugar!</h1>${modes()}</section><button class="s-conquista-entry" data-go="/conquista"><span aria-hidden="true">🗺️</span><span><small>APRENDE. CONQUISTA. DEFIENDE.</small><b>Suizamente Conquista</b><small>Tu conocimiento conquista los 26 cantones.</small></span><span aria-hidden="true">↗</span></button>${dailyCard}<section class="s-stack"><h2>🎯 Juega por temas</h2>${topics()}</section>
      ${q&&c?`<button type="button" class="s-card s-row s-community-card${selected!==null?' is-answered':''}" data-question="${q.id}"><span class="s-community-icon" aria-hidden="true">${selected!==null?'✓':'👥'}</span><span class="s-grow"><span class="s-kicker">La comunidad hoy</span>${selected!==null?'<small class="s-community-status">Respondido</small>':'<br>'}<b>${selected!==null?selectedPct===null?`Tu respuesta: «${esc(q.opciones[selected].t)}».`:`Formas parte del ${selectedPct}% que eligieron «${esc(q.opciones[selected].t)}».`:`El ${c.pct}% eligió «${esc(q.opciones[c.opcion].t)}». ¿Y tú?`}</b></span></button>`:''}
      ${!logged()?button('Entrar en Suizamente','data-login','secondary full'):''}<p class="s-soft" style="text-align:center">Un juego de <a href="https://latido.ch" target="_blank" rel="noopener">Latido.ch</a></p>`
  }
  function welcome(){return `<div class="s-entry-brand"><img src="/suizamente/logo.svg" alt="Suizamente" width="140" height="106"><h1><span>Suiza</span><span>mente</span></h1><p>Aprende cómo funciona Suiza jugando con la comunidad hispanohablante.</p></div><div class="s-entry-cards" aria-hidden="true"><div class="s-entry-card dilemma"><span>🤔 ¿QUÉ PREFIERES?</span><b>¿Fondue o raclette en pleno agosto?</b></div><div class="s-entry-card myth"><span>🕵️ ¿VERDAD O MITO?</span><b>Zúrich tiene metro.</b><div><span>Verdad</span><span>Mito</span></div></div><div class="s-entry-card community"><p>Compara <b>tu elección</b> con la comunidad.</p><div class="s-entry-progress"><i></i></div></div></div><div class="s-entry-actions"><button class="s-entry-primary" type="button" data-register>Crear cuenta</button><button class="s-entry-login" type="button" data-login>Ya tengo cuenta</button><p>Un juego de <b>latido.ch</b></p></div>`}

  function how(){return `${header('Así se juega')}<div class="s-steps">${[['🤔','Elige tu respuesta','Dilemas sin respuesta mala y preguntas en las que solo una es verdad.'],['👥','Descubre a la comunidad','Mira cómo ha respondido la comunidad.'],['💡','Aprende algo nuevo','Cada respuesta viene con un dato sobre Suiza. Guarda tus favoritos.'],['⚡','Juega a tu ritmo','Prueba el reto del día o reta a tus amigos a las mismas preguntas.']].map(([emoji,title,text])=>`<div class="s-step"><span aria-hidden="true">${emoji}</span><div><b>${title}</b><p>${text}</p></div></div>`).join('')}</div>${button('Empezar a jugar','data-welcome','full')}`}
  async function retos(){
    if(!state.online)return `${header('Retos',{actions:'<span aria-hidden="true">⚡</span>'})}${offline()}`
    const [daily,list]=await Promise.all([api('/daily'),api('/duels')])
    const days=['L','M','X','J','V','S','D'],today=(new Date(daily.fecha+'T12:00:00Z').getUTCDay()+6)%7
    return `${header('Retos',{subtitle:'Juega cada día y reta a tu gente.',actions:'<button class="s-circle" data-go="/avisos" aria-label="Avisos">🔔</button>'})}
      <div class="s-card s-challenge"><div class="s-row s-between"><span class="s-kicker">Reto del día · ${esc(shortDate(daily.fecha))}</span><span class="s-badge">🔥 ${state.profile?.racha||0} ${state.profile?.racha===1?'día':'días'}</span></div><h2 style="margin-top:12px">5 preguntas, las mismas para toda la comunidad.</h2><div class="s-week" aria-label="Tu semana de retos">${daily.semana.map((done,i)=>`<div class="s-week-day ${done?'is-complete':''} ${i===today?'today':''}" role="img" aria-label="${i===today?'Hoy':days[i]} · ${done?'Completado':'Sin completar'}" ${i===today?'aria-current="date"':''}><span class="s-week-dot" aria-hidden="true">${done?'&#10003;':''}</span><b class="s-week-caption" aria-hidden="true">${i===today?'Hoy':days[i]}</b></div>`).join('')}</div>${button(daily.hecho?'Ver mi resultado':'Jugar el reto','data-daily','full')}<p class="s-soft" style="margin-top:10px">${timeLeft(daily.terminaEn)}</p>${daily.ayer?.hecho?`<p class="s-soft">Ayer: ${daily.ayer.aciertos} de 3${daily.ayer.mejorQuePct===null?'':` · mejor que el ${daily.ayer.mejorQuePct}% de la comunidad`}.</p>`:''}</div>
      <div class="s-title-row s-duels-title"><h2>Duelos</h2>${button('＋ Retar a alguien','data-new-duel','secondary small')}</div>${list.duelos.length?`<div class="s-stack">${list.duelos.map(duelCard).join('')}</div>`:empty('⚔️','Aún no tienes duelos. Invita a alguien y jugad las mismas preguntas.')}
      <div class="s-shortcuts"><button class="s-shortcut" data-go="/ranking?tab=cantones"><span style="font-size:25px">🏆</span><b>Liga de cantones</b><small>Cuenta la media por jugador.</small></button><button class="s-shortcut" data-go="/proponer"><span style="font-size:25px">❤️</span><b>Propón tu pregunta</b><small>Si se publica, ganas una medalla.</small></button></div>${button('👥 Agregar amigos','data-go="/amigos"','secondary full')}`
  }
  function duelCard(d){
    const creator=d.creador?.id===state.profile?.id,rival=creator?(d.rival||d.invitado):d.creador,finished=d.estado==='terminado',closed=['caducado','cancelado'].includes(d.estado)
    const own=creator?d.puntosCreador:d.puntosRival,other=creator?d.puntosRival:d.puntosCreador,name=rival?.apodo||'tu rival'
    const otherResponses=creator?d.respondidasRival:d.respondidasCreador,sent=!!state.sentInvites[d.codigo]
    const title=d.estado==='cancelado'?'Reto cancelado':d.estado==='caducado'?'Reto caducado':finished?`${own>other?'Ganaste a':own<other?'Ganó':'Empataste con'} ${name}`:creator&&rival&&(otherResponses??0)<10?`Esperando respuesta de ${name}`:creator&&!rival?sent?'Invitación enviada':'Reto creado':!d.participante?`${name} te ha retado`:d.respondidas===10?`Esperando respuesta de ${name}`:`Duelo con ${name}`
    const status=finished?`${own} a ${other}`:closed?'Este reto ya no está activo':creator&&!rival?sent?'Esperando a que una persona acepte':'Sin rival · Envía el reto a una persona':otherResponses===10&&d.respondidas<10?'Tu rival ya respondió · Es tu turno':d.respondidas===10?'Tu parte está hecha':d.respondidas?`${d.respondidas} de 10 respondidas`:'10 preguntas para dos personas'
    const action=creator&&d.estado==='esperando'&&!d.rival?button(sent||d.invitado?'Reenviar reto':'Enviar reto',`data-invite="${d.codigo}"`,'small'):d.puedeUnirse?button('Aceptar reto',`data-join="${d.codigo}"`,'small'):button(finished?'Ver resultado':closed||d.respondidas===10?'Ver reto':'Jugar',`data-go="/duelo/${d.codigo}"`,'small')
    return `<article class="s-person s-stack s-duel-list-card" data-duel="${d.codigo}"><button type="button" class="s-duel-summary" data-go="/duelo/${d.codigo}" aria-label="Ver reto: ${esc(title)}">${avatar(rival||{apodo:'?'})}<span class="s-grow"><b>${esc(title)}</b><small>${esc(MODOS[d.modo]?.[1]||'Mix')}</small><small class="s-duel-status">${esc(status)}</small></span><span aria-hidden="true">›</span></button><div class="s-duel-manage"><button type="button" class="s-duel-delete" data-delete-duel="${d.codigo}" aria-label="Eliminar reto" title="Eliminar reto">${trashIcon}</button>${action}</div></article>`
  }
  async function dailyResult(){const daily=await api('/daily',{force:true});return `${header('Tu reto del día',{back:'/retos',subtitle:daily.fecha})}<div class="s-dark"><p class="s-kicker">${daily.hecho?'Reto completado':'Reto en curso'}</p><h2>${daily.aciertos} de 3 verdades acertadas</h2><p class="s-soft">${daily.hecho?'Has conseguido el bonus de 30 puntos por completar el reto.':'Responde las cinco preguntas para completar el reto.'}</p></div><div class="s-stack">${daily.preguntas.map(id=>{const q=question(id),o=daily.respuestas[id];return q?`<article class="s-card"><b>${q.tipo==='real'?(o===undefined?'⬜':o===q.correcta?'✅':'❌'):'🤔'} ${esc(q.pregunta)}</b><p class="s-soft" style="margin-top:9px">${o===undefined?'Sin responder':esc(q.opciones[o].e+' '+q.opciones[o].t)}</p></article>`:''}).join('')}</div>${button(daily.hecho?'Volver a Retos':'Seguir jugando',daily.hecho?'data-go="/retos"':'data-daily','full')}`}
  async function ranking(tab){
    tab=['semana','cantones','amigos'].includes(tab)?tab:'semana'
    const tabs=`<div class="s-tabs" role="tablist" aria-label="Clasificación">${[['semana','Semana'],['cantones','Cantones'],['amigos','Amigos']].map(([id,label])=>`<button type="button" role="tab" aria-selected="${id===tab}" class="${id===tab?'active':''}" data-go="/ranking?tab=${id}">${label}</button>`).join('')}</div>`
    if(!state.online)return `${header('Ranking',{actions:'<span>🏆</span>'})}${tabs}${offline()}`
    const result=await api('/ranking?tipo='+tab)
    if(tab==='semana')result.filas=clasificacionSemanal(result.filas,result.yo)
    else if(tab==='cantones')result.filas=clasificacionCantones(result.filas)
    let list=''
    if(tab==='cantones'){
      const myCanton=result.miCanton||state.profile?.canton,mine=result.filas.find(r=>r.codigo===myCanton),max=Math.max(...result.filas.map(r=>Number(r.media)),1)
      list=`<p class="s-soft">La liga se ordena por la media de puntos por jugador activo esta semana. Cada cuenta cuenta una vez por cantón. Así también compiten los cantones pequeños.</p>${mine?`<div class="s-dark s-row"><span class="s-avatar">${mine.puesto?mine.puesto+'.º':'—'}</span><div><h2 style="font-size:18px;margin:0">Tu cantón: ${esc(mine.nombre)}</h2><p class="s-soft">${numero(mine.media)} puntos de media · ${mine.activos} ${mine.activos===1?'participante':'participantes'}</p><p class="s-soft">Has aportado ${numero(result.aporte)} puntos esta semana.</p></div></div>`:button('Elige tu cantón','data-go="/perfil/editar"','secondary full')}
      <p class="s-kicker">Los ${Object.keys(CANTONES).length} cantones</p><div>${result.filas.map(r=>`<div class="s-rank ${r.codigo===myCanton?'mine':''}"><span class="s-position ${r.activos&&r.puesto<=3?'medal '+(r.puesto===2?'silver':r.puesto===3?'bronze':''):''}">${r.puesto}</span><div><b>${esc(r.nombre)}</b><small>${r.activos} ${r.activos===1?'participante':'participantes'}</small></div><div class="s-progress"><i style="width:${100*Number(r.media)/max}%"></i></div><strong>${r.activos?numero(r.media):'—'}</strong></div>`).join('')}</div>`
    }else{
      list=`${tab==='amigos'?button('👥 Agregar amigos','data-go="/amigos"','secondary full'):''}<p class="s-soft">Puntos de esta semana. Solo aparecen las cuentas que han elegido participar.</p>${result.filas.length?result.filas.map(r=>`<div class="s-person s-row ${r.id===result.yo?'mine':''}"><span class="s-position">${r.puesto}</span>${avatar(r)}<div class="s-grow"><b>${esc(r.apodo)}${r.id===result.yo?' · Tú':''}</b><small>${esc(CANTONES[r.canton]||'')}</small></div><b>${numero(r.puntos)}</b></div>`).join(''):empty('🏆',logged()?'Todavía no hay puntos en esta clasificación.':'Entra con tu cuenta para participar en la clasificación.')}`
    }
    return `${header('Ranking',{actions:'<span>🏆</span>'})}${tabs}${list}<p class="s-soft" style="text-align:center">🕒 ${timeLeft(result.fin)} · De lunes a domingo, hora de Zúrich.</p>`
  }
  function notebook(){return `${header('Libreta',{actions:'<span>📒</span>',subtitle:'Tus datos favoritos sobre Suiza.'})}<input class="s-search" id="book-search" type="search" placeholder="Buscar un dato" aria-label="Buscar en tu libreta"><div class="s-pills" id="book-topics"><button class="s-pill active" data-book-topic="">Todos</button>${Object.entries(TEMAS).map(([id,[emoji,name]])=>`<button class="s-pill" data-book-topic="${id}">${emoji} ${name}</button>`).join('')}</div><div class="s-stack" id="book-list">${bookCards()}</div>`}
  function bookCards(search='',topic=''){const ids=state.books.filter(id=>{const q=question(id);return q&&(!topic||q.tema===topic)&&(!search||(q.pregunta+' '+q.dato).toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')))})
    if(!ids.length)return empty('📒',state.books.length?'No hay datos con ese filtro.':'Aún no has guardado ningún dato. Toca el marcador en un resultado para guardarlo aquí.')
    return ids.map(id=>{const q=question(id);return `<article class="s-card"><div class="s-row s-between"><span class="s-kicker">${TEMAS[q.tema]?.join(' ')||esc(q.tema)}</span><button class="s-circle" data-remove-book="${id}" aria-label="Quitar dato de la libreta">×</button></div><h2 style="font-size:17px;margin:8px 0">${esc(q.pregunta)}</h2><p style="font-size:15px">${esc(q.dato)}</p></article>`}).join('')}
  function profile(){const p=state.profile
    if(!p)return `${header('Perfil',{actions:button('⚙️','data-go="/ajustes" aria-label="Ajustes"','secondary small')})}${offline()}${!logged()?button('Entrar en Suizamente','data-login','full'):''}${logoutButton()}`
    const recent=p.medallas.filter(m=>m.conseguida).slice(-4),weak=p.temas.at(-1)
    return `${header('Perfil',{actions:'<button class="s-circle" data-go="/ajustes" aria-label="Ajustes">⚙️</button>'})}
      <div class="s-row">${photoControl(p)}<div><h1 style="font-size:25px">${esc(p.apodo)}</h1><p class="s-soft">${esc(PAISES[p.pais]||'')}${p.pais&&p.canton?' · ':''}${p.canton?'Vive en '+esc(CANTONES[p.canton]):''}</p>${p.anosSuiza?`<p class="s-soft">En Suiza: ${esc(ANOS[p.anosSuiza])}</p>`:''}</div></div><div class="s-card">${level()}<p class="s-soft" style="margin-top:10px">${numero(p.puntos)} XP</p></div>
      <div class="s-stats"><div class="s-stat"><span>🔥</span><b>${p.racha}</b><small>Días de racha</small></div><div class="s-stat"><span>🎯</span><b>${p.aciertos}%</b><small>Aciertos</small></div><div class="s-stat"><span>💡</span><b>${numero(p.datos)}</b><small>Datos aprendidos</small></div></div>
      <div class="s-dark"><p class="s-kicker">Tu suizómetro</p>${p.suizometro===null?'<h2>Tu forma de vivir Suiza</h2><p class="s-soft">Responde más dilemas para ver tu suizómetro. Necesitamos suficientes respuestas de la comunidad para compararlo.</p>':`<h2>${p.suizometro}% modo suizo · ${100-p.suizometro}% modo latino</h2><div class="s-progress"><i style="width:${p.suizometro}%"></i></div><p class="s-soft" style="margin-top:12px">${p.suizometro>=70?'Separas el vidrio por colores y llegas cinco minutos antes. Los Alpes te reconocen.':p.suizometro>=50?'Reciclas como en Berna, pero la cena sigue siendo a las 21:00.':p.suizometro>=30?'Ya dices «Merci vielmal», pero la fiesta empieza cuando llegas tú.':'Suiza te encanta, pero tu corazón sigue bailando en la lavandería.'}</p>`}</div>
      <section class="s-stack"><h2>Lo que más sabes</h2>${p.temas.length?p.temas.map(t=>`<div class="s-topic-row"><b>${esc(TEMAS[t.tema]?.[1]||t.tema)}</b><div class="s-progress"><i style="width:${t.aciertos}%"></i></div><strong>${t.aciertos}%</strong></div>`).join(''):empty('🎯','Responde al menos cinco preguntas de un tema para ver tus aciertos.')}${weak?`<div class="s-card s-row"><p class="s-grow" style="font-size:14px">Tu punto flojo es ${esc(TEMAS[weak.tema]?.[1]||weak.tema)}. ¿Una ronda para practicar?</p>${button('Practicar',`data-topic="${weak.tema}"`,'small')}</div>`:''}</section>
      <section class="s-stack"><div class="s-title-row"><h2>Medallas</h2><button class="s-link" data-go="/medallas">Ver todas</button></div>${recent.length?`<div class="s-medals">${recent.map(m=>medal(m)).join('')}</div>`:empty('🏅','Cada ronda te acerca a tu primera medalla.')}</section>${button('🗺️ Mis conquistas','data-go="/conquista/coleccion"','secondary full')}${button('👥 Mis amigos','data-go="/amigos"','secondary full')}${!p.pais||!p.canton||!p.anosSuiza?button('Completar mi perfil','data-go="/perfil/editar"','secondary full'):''}${!logged()?button('Guardar mi progreso con mi cuenta de Suizamente','data-login','full'):''}${logoutButton()}`
  }
  function medal(m){const [emoji,title,description]=MEDALLAS[m.id]||['🏅',m.id,''],tone=MEDALLAS_ESTILO[m.id]?.[0]||'ambar';return `<div class="s-medal ${m.conseguida?'earned':'locked'} s-tone-${tone}"><span class="s-medal-icon" aria-hidden="true">${emoji}${m.conseguida?'':'<i>🔒</i>'}</span><b>${esc(title)}</b><small>${esc(description)}</small><span class="s-medal-progress">${m.conseguida?'✓ Conseguida':`${m.progreso} de ${m.meta}`}</span></div>`}
  function medals(){return `${header('Tu camino en Suizamente',{back:'/perfil'})}<div class="s-stack">${NIVELES.map((name,i)=>`<div class="s-person s-row"><span style="font-size:24px">${(state.profile?.nivel||0)>i?'✅':'🔒'}</span><div><b>Nivel ${i+1} · ${name}</b><small>${[0,150,500,1200,2500,5000][i].toLocaleString('es-CH')} puntos</small></div></div>`).join('')}</div><h2>Tus medallas</h2><div class="s-medals">${(state.profile?.medallas||Object.keys(MEDALLAS).map(id=>({id,progreso:0,meta:1}))).map(medal).join('')}</div>`}
  function photoControl(p){return `<div class="s-photo-control"><button type="button" class="s-photo-button" data-choose-photo aria-label="Elegir foto de perfil">${avatar(p,'large')}<span class="s-photo-camera" aria-hidden="true">&#128247;</span></button><input type="file" accept="image/*" data-photo-file hidden></div>`}
  async function savePhoto(image){
    const id=await getIdentity(),data=await guardarFoto(image,{socialApi:identity.socialApi,token:id.token})
    state.profile=data.perfil;cache.clear();remember()
  }
  function bindPhoto(){
    const input=container.querySelector('[data-photo-file]');if(!input)return
    input.onchange=async()=>{
      const file=input.files?.[0];if(!file)return
      const form=container.querySelector('#profile-form'),control=container.querySelector('[data-choose-photo]'),submit=form?.querySelector('[type=submit]')
      control.disabled=true;if(submit)submit.disabled=true
      try{
        const image=await prepararFoto(file)
        if(form){
          form._photo=image
          const preview=document.createElement('img');preview.className='s-avatar-photo is-loaded';preview.alt='';preview.src=image
          const avatar=control.querySelector('.s-avatar');avatar.querySelector('img')?.remove();avatar.append(preview)
          toast('Foto elegida. Guarda el perfil para aplicar el cambio.')
        }else{await savePhoto(image);toast('Foto de perfil guardada.');render()}
      }catch(error){toast(error.message)}
      finally{input.value='';control.disabled=false;if(submit)submit.disabled=false}
    }
  }
  function editProfile(){const p=state.profile||{apodo:'Invitado',color:'menta'};return `${header('Tu perfil',{back:'/perfil',subtitle:logged()?'Este es tu nombre de usuario en Suizamente.':'Elige cómo quieres aparecer en el juego.'})}<form id="profile-form" class="s-form"><div class="s-row">${photoControl(p)}<span class="s-soft">Toca la foto para elegir otra.</span></div><label>${logged()?'Nombre de usuario':'Tu nombre'}<input name="apodo" value="${esc(p.apodo)}" minlength="2" maxlength="${logged()?80:40}" required ${logged()?'readonly':''}></label><label>País de origen<select name="pais">${options(PAISES,p.pais,'Prefiero no indicarlo')}</select></label><label>Cantón<select name="canton">${options(CANTONES,p.canton,'Elige tu cantón')}</select></label><label>¿Cuánto llevas en Suiza?<select name="anosSuiza">${options(ANOS,p.anosSuiza,'Prefiero no indicarlo')}</select></label><p class="s-soft">Tus votos son anónimos. Los grupos por país o años solo se muestran cuando hay al menos 20 votos.</p><button class="s-button full" type="submit">Guardar perfil</button></form>`}
  async function friends(){if(!logged())return `${header('Amigos',{back:'/ranking?tab=amigos'})}${empty('👥','Entra en Suizamente para agregar amigos y retarlos.')}${button('Entrar con mi cuenta','data-login','full')}`
    const data=await api('/friends')
    return `${header('Amigos',{back:'/ranking?tab=amigos',subtitle:'Busca a tu gente de Suizamente o Latido por su nombre de usuario.'})}<form id="friends-search" class="s-form" role="search"><label>Nombre de usuario<input name="texto" type="search" maxlength="80" autocomplete="off" placeholder="Buscar una persona" aria-describedby="people-status" aria-controls="people-results"></label></form><p id="people-status" class="s-soft" role="status">Escribe al menos 2 letras para buscar.</p><div id="people-results" class="s-stack" aria-busy="false"></div><h2>Tu gente</h2>${data.amistades.length?`<div class="s-stack">${data.amistades.map(p=>`<div class="s-person s-stack"><div class="s-row">${avatar(p)}<div class="s-grow"><b>${esc(p.apodo)}</b><small>${p.estado==='aceptada'?'Amistad aceptada':p.recibida?'Quiere agregarte':'Solicitud enviada'}</small></div></div><div class="s-row">${p.estado==='aceptada'?button('⚔️ Retar',`data-new-duel="${p.id}"`,'small'):p.recibida?button('Aceptar',`data-friend-answer="${p.id}" data-response="aceptar"`,'small'):''}${button(p.estado==='aceptada'?'Quitar':p.recibida?'Rechazar':'Cancelar',`data-friend-remove="${p.id}"`,'secondary small')}${p.recibida?button('Bloquear',`data-friend-answer="${p.id}" data-response="bloquear"`,'secondary small'):''}</div></div>`).join('')}</div>`:empty('👥','Todavía no tienes amigos agregados. Busca un nombre o comparte un duelo.')}`
  }
  async function proposals(params){if(!logged())return `${header('Propón tu pregunta',{back:'/retos'})}${empty('❤️','Entra en Suizamente para enviar propuestas al equipo.')}${button('Entrar con mi cuenta','data-login','full')}`
    const data=await api('/proposals'),report=question(params.get('corregir'))
    return `${header(report?'Avisar de un dato':'Propón tu pregunta',{back:'/retos',subtitle:'El equipo de Latido revisará tu propuesta antes de publicarla.'})}<form id="proposal-form" class="s-form">${report?`<input type="hidden" name="tipo" value="correccion"><input type="hidden" name="tema" value="${report.tema}"><label>Pregunta<input name="pregunta" readonly value="${esc(report.pregunta)}"></label>`:`<label>Tipo<select name="tipo" id="proposal-type"><option value="dilema">¿Qué prefieres?</option><option value="real">Con respuesta</option><option value="mito">Verdad o mito</option></select></label><label>Tema<select name="tema" required>${options(Object.fromEntries(Object.entries(TEMAS).map(([id,[,name]])=>[id,name])),'')}</select></label><label>Pregunta<input name="pregunta" maxlength="140" minlength="5" required></label><div id="proposal-options" class="s-stack">${proposalOptions('dilema')}</div>`}<label>${report?'Qué habría que corregir':'¿Sabías que…?'}<textarea name="dato" maxlength="300" minlength="5" required></textarea></label><label>Fuente o enlace (opcional)<input name="fuente" maxlength="500" placeholder="Dónde se puede comprobar"></label><p class="s-soft">Puedes enviar hasta tres propuestas al día.</p><button class="s-button full" type="submit">Enviar al equipo de Latido</button></form><h2>Mis propuestas</h2>${data.propuestas.length?data.propuestas.map(p=>`<article class="s-card"><p class="s-kicker">${esc(p.estado)}</p><b>${esc(p.pregunta)}</b>${p.nota?`<p class="s-soft">${esc(p.nota)}</p>`:''}</article>`).join(''):empty('❤️','Aquí verás el estado de tus propuestas.')}`
  }
  function proposalOptions(type){if(type==='mito')return '<label>La afirmación es<select name="correcta"><option value="0">Verdad</option><option value="1">Mito</option></select></label>';return `<label>Opción 1<input name="opcion0" maxlength="90" required></label><label>Opción 2<input name="opcion1" maxlength="90" required></label>${type==='real'?'<label>Opción 3 (opcional)<input name="opcion2" maxlength="90"></label><label>Respuesta correcta<select name="correcta"><option value="0">Opción 1</option><option value="1">Opción 2</option><option value="2">Opción 3</option></select></label>':''}`}
  function ajustes(){const p=state.profile,prefs=settings();return `${header('Ajustes',{back:'/perfil'})}<div class="s-stack">${button('Editar mi perfil','data-go="/perfil/editar"','secondary full')}${button(logged()?'Mi cuenta de Suizamente':'Entrar en Suizamente','data-login','secondary full')}${identity.installPath?`<a class="s-button secondary full" href="${identity.installPath}" target="_top">Instalar Suizamente</a>`:''}</div><form id="settings-form" class="s-form"><h2>Tu forma de jugar</h2>${[['sonidos','Sonidos'],['vibracion','Vibración'],['menosAnimaciones','Menos animaciones'],['avisos','Avisos de retos y amigos']].map(([id,label])=>`<label class="s-check"><input type="checkbox" name="${id}" ${(id==='avisos'?prefs[id]!==false:prefs[id]===true)?'checked':''}>${label}</label>`).join('')}<label>Apariencia<select name="apariencia">${options({light:'Clara',dark:'Oscura',auto:'Automática'},prefs.apariencia||'light')}</select></label><h2>Privacidad</h2><label class="s-check"><input type="checkbox" name="enRanking" ${p?.enRanking!==false?'checked':''}>Aparecer en los rankings</label><p class="s-soft">Tus votos son anónimos. Solo en un duelo tu rival ve tus respuestas, cuando ambos habéis terminado.</p><button class="s-button full" type="submit">Guardar ajustes</button></form><hr class="s-rule"><h2>Ayuda</h2>${button('Cómo se juega','data-go="/como-se-juega"','secondary full')}${button('Proponer una pregunta','data-go="/proponer"','secondary full')}${p?.admin?button('Revisar propuestas','data-go="/moderacion"','secondary full'):''}<a class="s-link" href="https://latido.ch/privacidad" target="_blank" rel="noopener">Privacidad de Latido</a>${button('Borrar mis datos de Suizamente','data-delete','danger full')}<p class="s-soft">Se conserva tu cuenta de acceso. Puedes cerrar sesión desde tu perfil de Suizamente.</p>`}
  async function duel(code){
    const d=await api('/duels/'+code,{force:true}),creator=d.creador?.id===state.profile?.id,mine=creator?d.creador:d.rival,other=creator?d.rival:d.creador
    const finished=d.estado==='terminado'&&d.participante&&Number.isInteger(d.puntosCreador)&&Number.isInteger(d.puntosRival),ownScore=creator?d.puntosCreador:d.puntosRival,otherScore=creator?d.puntosRival:d.puntosCreador
    const headline=d.estado==='cancelado'?'Este reto se ha cancelado':d.estado==='caducado'?'Este duelo ha caducado':finished?(ownScore>otherScore?'🏆 ¡Ganas el duelo!':ownScore===otherScore?'🤝 ¡Empate!':`Esta vez gana ${other?.apodo||'tu rival'}`):d.estado==='terminado'?'Este resultado ya no está disponible':d.respondidas===10?'¡Tu parte está hecha!':'Un duelo, las mismas preguntas'
    const dilemmas=finished?d.preguntas.filter(id=>question(id)?.tipo==='dilema'):[],same=dilemmas.filter(id=>d.respuestasCreador[id]?.opcion===d.respuestasRival[id]?.opcion).length
    const comparison=dilemmas.length?`Coincidencia en los dilemas: ${same} de ${dilemmas.length}. ${same/dilemmas.length>=.5?'Buena señal para compartir piso.':'Dos formas de ver Suiza. ¡Así se aprende!'}`:''
    const leftPlayer=d.participante?(mine||state.profile):d.creador,rightPlayer=d.participante?other:d.rival
    const rows=finished?d.preguntas.map(id=>{
      const q=question(id),a=(creator?d.respuestasCreador:d.respuestasRival)[id],b=(creator?d.respuestasRival:d.respuestasCreador)[id];if(!q||!a||!b)return ''
      return `<article class="s-duel-question"><b>${esc(q.pregunta)}</b><div class="s-duel-answers"><span class="s-answer-chip ${q.tipo==='real'?(a.punto?'correct':'incorrect'):''}">${q.tipo==='real'?`Tú ${a.punto?'✓':'✕'}`:esc(q.opciones[a.opcion].t)}</span><span class="s-answer-chip ${q.tipo==='real'?(b.punto?'correct':'incorrect'):'other'}">${q.tipo==='real'?`${esc(other?.apodo||'Rival')} ${b.punto?'✓':'✕'}`:esc(q.opciones[b.opcion].t)}</span></div></article>`
    }):[]
    return `${header('Duelo',{back:'/retos',subtitle:`${MODOS[d.modo]?.[1]||'Mix'} · 10 preguntas`})}<div class="s-duel-hero"><div class="s-match"><div class="s-duel-player ${d.participante?'is-me':''}">${avatar(leftPlayer||{})}<b>${d.participante?'Tú':esc(d.creador?.apodo||'Creador')}</b></div><strong>${finished?`${ownScore} – ${otherScore}`:'VS'}</strong><div class="s-duel-player">${avatar(rightPlayer||{apodo:'?'})}<b>${esc(rightPlayer?.apodo||'Tu rival')}</b></div></div><h2>${esc(headline)}</h2>${comparison?`<p>${esc(comparison)}</p>`:d.estado==='esperando'?'<p>El enlace está disponible durante 72 horas. Las respuestas se revelan cuando ambos termináis.</p>':''}</div>
      ${d.puedeUnirse?button('Aceptar el reto',`data-join="${code}"`,'full'):d.participante&&d.estado==='esperando'&&d.respondidas<10?button(d.respondidas?'Seguir jugando':'Jugar mi duelo',`data-play-duel="${code}"`,'full'):''}
      ${creator&&d.estado==='esperando'&&!d.rival?button('Enviar reto',`data-invite="${code}"`,'secondary full'):''}
      ${finished?`<section class="s-stack"><h2>Pregunta a pregunta</h2>${rows.slice(0,4).join('')}${rows.length>4?`<details class="s-duel-more"><summary>Ver las ${rows.length} preguntas</summary><div class="s-stack">${rows.slice(4).join('')}</div></details>`:''}</section><div class="s-duel-actions">${button('Revancha',`data-rematch="${code}"`,'full')}${button('📤 Presumir del resultado',`data-share-duel="${code}"`,'secondary full')}</div>`:d.respondidas?`<p class="s-soft">Has respondido ${d.respondidas} de 10 preguntas.</p>`:''}`
  }
  function moderationFields(p){return `<details><summary>Editar propuesta antes de publicarla</summary><div class="s-stack" style="margin-top:14px"><label>Pregunta<input name="pregunta" minlength="5" maxlength="140" required value="${esc(p.pregunta)}"></label>${['dilema','real'].includes(p.tipo)?[0,1,...(p.tipo==='real'?[2]:[])].map(i=>`<label>Opción ${i+1}${i===2?' (opcional)':''}<input name="opcion${i}" maxlength="90" ${i<2?'required':''} value="${esc(p.opciones?.[i]||'')}"></label>`).join(''):''}${['real','mito'].includes(p.tipo)?`<label>Respuesta correcta<select name="correcta">${(p.tipo==='mito'?['Verdad','Mito']:['Opción 1','Opción 2','Opción 3']).map((label,i)=>`<option value="${i}" ${i===p.correcta?'selected':''}>${label}</option>`).join('')}</select></label>`:''}<label>Información<textarea name="dato" minlength="5" maxlength="300" required>${esc(p.dato)}</textarea></label><label>Fuente<input name="fuente" maxlength="500" value="${esc(p.fuente||'')}"></label></div></details>`}
  async function moderation(){const data=await api('/moderation');return `${header('Revisar propuestas',{back:'/ajustes'})}<p class="s-soft">Aprobar no publica una pregunta. Después hay que incorporarla al banco revisado y asociar su identificador.</p>${data.propuestas.length?data.propuestas.map(p=>`<article class="s-card s-stack"><p class="s-kicker">${esc(p.estado)} · ${esc(p.apodo||'Comunidad Latido')}</p><h2>${esc(p.pregunta)}</h2>${p.opciones?`<p>${p.opciones.map(esc).join(' · ')}</p>`:''}<p>${esc(p.dato)}</p>${p.fuente?`<p class="s-soft">Fuente: ${esc(p.fuente)}</p>`:''}${p.estado!=='publicada'?`<form class="s-form moderation-form" data-id="${p.id}">${moderationFields(p)}<label>Nota del equipo<input name="nota" maxlength="500" value="${esc(p.nota||'')}"></label><label>Estado<select name="estado"><option value="aprobada">Aprobada</option><option value="rechazada">Rechazada</option>${p.estado==='aprobada'?'<option value="publicada">Publicada en el banco</option>':''}</select></label>${p.estado==='aprobada'?'<label>ID de la pregunta publicada<input name="preguntaId" maxlength="100"></label>':''}<button class="s-button">Guardar revisión</button></form>`:''}</article>`).join(''):empty('❤️','No hay propuestas pendientes.')}`}
  async function notifications(){const data=await api('/notifications');return `${header('Avisos',{back:'/retos'})}${data.avisos.length?data.avisos.map(n=>`<button type="button" class="s-card s-stack" style="text-align:left;color:var(--ink)" data-go="${esc((n.data.href||'/retos').replace(/^\/suizamente/,'')||'/')}"><b>🔔 ${esc(n.data.title)}</b><p class="s-soft">${esc(n.data.body)}</p></button>`).join(''):empty('🔔','Aquí verás las novedades de tus amigos, duelos y propuestas.')}${data.avisos.length?button('Marcar como leídos','data-read-notices','secondary full'):''}`}
  async function render(){const stamp=++revision,url=new URL(state.route,'https://suizamente.latido.ch'),path=url.pathname,main=['/','/retos','/ranking','/libreta','/perfil','/conquista','/conquista/tienda','/conquista/batallas','/conquista/coleccion'].includes(path)&&!(path==='/retos'&&url.searchParams.has('resultado'))
    try{
      let content
      if(path==='/')content=await home()
      else if(path==='/bienvenida')content=welcome()
      else if(path==='/como-se-juega')content=how()
      else if(path==='/conquista'||path.startsWith('/conquista/'))content=await conquista.render(url)
      else if(path==='/retos')content=url.searchParams.has('resultado')?await dailyResult():await retos()
      else if(path==='/ranking')content=await ranking(url.searchParams.get('tab'))
      else if(path==='/libreta'){if(state.online)await api('/notebook');content=notebook()}
      else if(path==='/perfil')content=profile()
      else if(path==='/perfil/editar')content=editProfile()
      else if(path==='/medallas')content=medals()
      else if(path==='/ajustes')content=ajustes()
      else if(path==='/amigos')content=await friends()
      else if(path==='/proponer')content=await proposals(url.searchParams)
      else if(path==='/moderacion')content=await moderation()
      else if(path==='/avisos')content=await notifications()
      else if(path.startsWith('/duelo/'))content=await duel(path.split('/')[2].toUpperCase())
      else if(path==='/jugar'){
        const id=url.searchParams.get('p'),topic=url.searchParams.get('tema'),mode=url.searchParams.get('modo')||'mix',reto=url.searchParams.get('reto'),duelo=url.searchParams.get('duelo')
        if(reto){const daily=await api('/daily',{force:true});returnRoute='/retos';if(daily.fecha!==reto||daily.hecho){navigate('/retos');return}play({modo:'mix',ids:daily.preguntas.filter(id=>daily.respuestas[id]===undefined),contexto:{tipo:'reto',fecha:daily.fecha}})}
        else if(duelo){const d=await api('/duels/'+duelo,{force:true});returnRoute='/duelo/'+duelo;if(!d.participante||d.estado!=='esperando'){navigate(returnRoute);return}play({modo:d.modo,ids:d.preguntas.filter(id=>d.mias[id]===undefined),contexto:{tipo:'duelo',codigo:d.codigo}})}
        else {returnRoute='/';if(id&&question(id))play({modo:question(id).tipo==='real'?'preguntas':'dilemas',ids:[id],verResultado:true});else play({modo:MODOS[mode]?mode:'mix',tema:TEMAS[topic]?topic:null})}
        return
      }
      else content=await home()
      if(stamp!==revision)return
      page(content,{main,path:path.startsWith('/conquista')?'/conquista':path});if(path.startsWith('/conquista'))conquista.bind(container);if(path==='/bienvenida'){container.querySelector('.social').classList.add('s-welcome');if(identity.path!==state.route)notify(state.route)}
    }catch(error){if(stamp===revision)page(`${header('Volvamos a intentarlo',{back:'/'})}${empty('📡',error.message)}${button('Volver al juego','data-go="/"','full')}`)}
  }
  function bind(){
    bindPeopleSearch()
    bindPhoto()
    container.onclick=async event=>{
      const target=event.target.closest('button,[data-go]');if(!target||target.disabled)return
      const data=target.dataset
      try{
        if('choosePhoto'in data){if(requireAccount())container.querySelector('[data-photo-file]')?.click();return}
        if(data.go!==undefined){navigate(data.go);return}
        if('login'in data){login();return}
        if('register'in data){register();return}
        if('logout'in data&&identity.canLogout){target.disabled=true;target.textContent='Cerrando sesión…';window.parent.postMessage({type:'suizamente:logout'},location.origin);return}
        if('welcome'in data){write('suizamente:bienvenida',true);navigate(!logged()&&state.online&&state.profile?.apodo==='Invitado'?'/perfil/editar':'/');return}
        if(data.play){startRound({modo:data.play});return}
        if(data.topic){startRound({modo:'mix',tema:data.topic},'/jugar?modo=mix&tema='+data.topic);return}
        if(data.question){startRound({modo:question(data.question).tipo==='real'?'preguntas':'dilemas',ids:[data.question]},'/jugar?p='+data.question);return}
        if('daily'in data){const daily=await api('/daily',{force:true});if(daily.hecho){navigate('/retos?resultado=hoy');return}startRound({modo:'mix',ids:daily.preguntas.filter(id=>daily.respuestas[id]===undefined),contexto:{tipo:'reto',fecha:daily.fecha}},'/jugar?reto='+daily.fecha);return}
        if('newDuel'in data){if(!requireAccount())return;duelPicker(data.newDuel||null);return}
        if(data.join){await api('/duels/'+data.join+'/join',{method:'POST',body:{}});navigate('/duelo/'+data.join);return}
        if(data.playDuel){const d=await api('/duels/'+data.playDuel,{force:true});startRound({modo:d.modo,ids:d.preguntas.filter(id=>d.mias[id]===undefined),contexto:{tipo:'duelo',codigo:d.codigo}},'/jugar?duelo='+d.codigo);return}
        if(data.invite){await shareInvite(data.invite);return}
        if(data.deleteDuel){target.disabled=true;await api('/duels/'+data.deleteDuel,{method:'DELETE',body:{}});toast('Reto eliminado.');navigate('/retos');return}
        if(data.rematch){if(!requireAccount())return;const d=await api('/duels/'+data.rematch+'/rematch',{method:'POST',body:{}});navigate('/duelo/'+d.codigo);toast('Revancha creada para el mismo rival.');return}
        if(data.shareDuel){const d=await api('/duels/'+data.shareDuel);openShareSheet({titulo:`${d.puntosCreador} – ${d.puntosRival}`,subtitulo:'Duelo de Suizamente · 10 preguntas',enlace:'https://suizamente.latido.ch/duelo/'+d.codigo,texto:`Suizamente · ${d.puntosCreador} – ${d.puntosRival}\nJuega en https://suizamente.latido.ch/duelo/${d.codigo}`,challengeMode:d.modo});return}
        if(data.friendAdd){target.disabled=true;await api('/friends',{method:'POST',body:{id:data.friendAdd}});toast('Solicitud enviada.');navigate('/amigos');return}
        if(data.friendAnswer){await api('/friends/respond',{method:'POST',body:{id:data.friendAnswer,respuesta:data.response}});navigate('/amigos');return}
        if(data.friendRemove){await api('/friends',{method:'DELETE',body:{id:data.friendRemove}});navigate('/amigos');return}
        if(data.removeBook){await toggleBook(data.removeBook);navigate('/libreta');return}
        if('bookTopic'in data){container.querySelectorAll('[data-book-topic]').forEach(b=>b.classList.toggle('active',b===target));container.querySelector('#book-list').innerHTML=bookCards(container.querySelector('#book-search').value,data.bookTopic);return}
        if('delete'in data){deleteScreen();return}
        if('readNotices'in data){await api('/notifications',{method:'POST',body:{}});toast('Avisos marcados como leídos.');navigate('/avisos')}
      }catch(error){target.disabled=false;toast(error.message)}
    }
    const search=container.querySelector('#book-search');if(search)search.oninput=()=>container.querySelector('#book-list').innerHTML=bookCards(search.value,container.querySelector('[data-book-topic].active')?.dataset.bookTopic||'')
    const type=container.querySelector('#proposal-type');if(type)type.onchange=()=>container.querySelector('#proposal-options').innerHTML=proposalOptions(type.value)
    const forms=[['#profile-form',async values=>{await api('/profile',{method:'PUT',body:Object.fromEntries(values)});const photo=container.querySelector('#profile-form')?._photo;if(photo)await savePhoto(photo);toast('Perfil guardado.');navigate('/perfil')}],['#settings-form',async values=>{const ajustes={apariencia:values.get('apariencia'),...Object.fromEntries(['sonidos','vibracion','menosAnimaciones','avisos'].map(k=>[k,values.has(k)]))};await api('/profile',{method:'PUT',body:{ajustes,enRanking:values.has('enRanking')}});toast('Ajustes guardados.');navigate('/ajustes')}],['#proposal-form',async values=>{const data=Object.fromEntries(values),tipo=data.tipo;data.opciones=tipo==='mito'?['Verdad','Mito']:tipo==='correccion'?null:[data.opcion0,data.opcion1,data.opcion2].filter(Boolean);data.correcta=data.correcta===undefined?null:Number(data.correcta);await api('/proposals',{method:'POST',body:data});toast('¡Gracias! Te avisamos cuando la revisemos.');navigate('/retos')}]]
    for(const [selector,submit] of forms){const form=container.querySelector(selector);if(form)form.onsubmit=event=>submitForm(event,submit)}
    container.querySelectorAll('.moderation-form').forEach(form=>{form.onsubmit=event=>submitForm(event,async values=>{const contenido={pregunta:values.get('pregunta'),dato:values.get('dato'),fuente:values.get('fuente')};if(values.has('opcion0'))contenido.opciones=[values.get('opcion0'),values.get('opcion1'),values.get('opcion2')].filter(Boolean);if(values.has('correcta'))contenido.correcta=Number(values.get('correcta'));await api('/moderation/'+form.dataset.id,{method:'POST',body:{estado:values.get('estado'),nota:values.get('nota'),preguntaId:values.get('preguntaId'),contenido}});toast('Revisión guardada.');navigate('/moderacion')})})
  }
  function bindPeopleSearch(){
    const form=container.querySelector('#friends-search');if(!form)return
    const input=form.querySelector('input'),results=container.querySelector('#people-results'),status=container.querySelector('#people-status')
    let timer,controller,version=0,people=[]
    const normalize=text=>String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim()
    const show=rows=>{results.innerHTML=rows.map(p=>`<div class="s-person s-row">${avatar(p)}<div class="s-grow"><b>${esc(p.apodo)}</b></div>${button('Agregar',`data-friend-add="${p.id}"`,'small')}</div>`).join('')}
    function search(immediate=false){
      clearTimeout(timer);controller?.abort();const stamp=++version,text=input.value.trim()
      results.setAttribute('aria-busy','false')
      if(text.length<2){people=[];show([]);status.textContent='Escribe al menos 2 letras para buscar.';return}
      show(people.filter(p=>normalize(p.apodo).includes(normalize(text))))
      status.textContent='Buscando personas…';results.setAttribute('aria-busy','true')
      timer=setTimeout(async()=>{
        controller=new AbortController();const signal=controller.signal
        try{
          const data=await api('/people?texto='+encodeURIComponent(text),{signal})
          if(stamp!==version||!results.isConnected||signal.aborted)return
          people=data.personas;show(people)
          status.textContent=people.length?`${people.length} ${people.length===1?'persona encontrada':'personas encontradas'}`:'No encontramos ese nombre. Prueba con otra parte del nombre de usuario.'
        }catch(error){if(stamp===version&&results.isConnected&&!signal.aborted)status.textContent=error.message}
        finally{if(stamp===version&&results.isConnected)results.setAttribute('aria-busy','false')}
      },immediate?0:300)
    }
    input.oninput=()=>search();form.onsubmit=event=>{event.preventDefault();search(true)}
    stopPeopleSearch=()=>{version++;clearTimeout(timer);controller?.abort()}
  }
  async function submitForm(event,submit){event.preventDefault();const form=event.currentTarget,values=new FormData(form),button=form.querySelector('button[type=submit],button:not([type])');if(button)button.disabled=true;try{await submit(values)}catch(error){toast(error.message)}finally{if(button?.isConnected)button.disabled=false}}
  function duelPicker(rival=null,mode='mix'){page(`${header('Retar a alguien',{back:'/retos'})}<p class="s-soft">Diez preguntas, las mismas para los dos. Elige el modo y comparte tu invitación${rival?' con tu amigo':''}.</p><form id="duel-form" class="s-form"><label>Modo<select name="modo">${options(Object.fromEntries(Object.entries(MODOS).map(([id,[,name]])=>[id,name])),mode)}</select></label><button class="s-button full">Crear duelo</button></form>`);container.querySelector('#duel-form').onsubmit=event=>submitForm(event,async values=>{const d=await api('/duels',{method:'POST',body:{modo:values.get('modo'),...(rival?{rival}:{})}});navigate('/duelo/'+d.codigo);toast('Duelo creado. Ya puedes compartir la invitación.')})}
  async function shareInvite(code){
    const d=await api('/duels/'+code,{force:true})
    if(d.creador?.id!==state.profile?.id||d.estado!=='esperando'||d.rival){toast('Este reto ya tiene rival o ha terminado.');return}
    const enlace='https://suizamente.latido.ch/duelo/'+code
    shareSheet?.close()
    const dialog=document.createElement('dialog'),previousFocus=document.activeElement
    dialog.className='s-share-sheet';dialog.setAttribute('aria-labelledby','invite-sheet-title')
    dialog.innerHTML=`<span class="s-sheet-handle" aria-hidden="true"></span><h2 id="invite-sheet-title">Enviar reto</h2><p class="s-soft">Comparte este enlace con una persona. Al abrirlo podrá aceptar y jugar este mismo reto.</p><label class="s-invite-link">Enlace del reto<input type="text" readonly value="${esc(enlace)}" aria-label="Enlace del reto"></label><div class="s-invite-actions"><button type="button" class="s-button full" data-share-invite>Enviar enlace</button><button type="button" class="s-button secondary full" data-copy-invite>Copiar enlace</button></div><p class="s-share-status" role="status" aria-live="polite">${esc(MODOS[d.modo]?.[1]||'Mix')} · 10 preguntas · Un único rival</p><button type="button" class="s-share-close">Cerrar</button>`
    document.body.append(dialog);shareSheet=dialog
    const status=dialog.querySelector('.s-share-status'),input=dialog.querySelector('input'),send=dialog.querySelector('[data-share-invite]')
    const copy=async()=>{
      try{await navigator.clipboard.writeText(enlace);status.textContent='Enlace del reto copiado. Pégalo en el chat de la persona a la que quieres retar.'}
      catch{input.focus();input.select();input.setSelectionRange(0,enlace.length);status.textContent=document.execCommand('copy')?'Enlace del reto copiado.':'El enlace está seleccionado. Cópialo y envíalo a la otra persona.'}
    }
    dialog.querySelector('[data-copy-invite]').onclick=copy
    send.onclick=async()=>{
      if(!navigator.share){await copy();return}
      send.disabled=true
      try{
        await navigator.share({title:'Te reto a Suizamente',text:'¿Jugamos estas diez preguntas sobre Suiza?',url:enlace})
        state.sentInvites[code]=true;remember();status.textContent='Reto compartido. Esperando a que la otra persona lo acepte.'
        const card=container.querySelector(`[data-duel="${code}"]`)
        if(card){const list=document.createElement('div');list.innerHTML=duelCard(d);card.replaceWith(list.firstElementChild)}
      }catch(error){if(error.name!=='AbortError')await copy()}
      finally{if(send.isConnected)send.disabled=false}
    }
    dialog.querySelector('.s-share-close').onclick=()=>dialog.close()
    dialog.addEventListener('close',()=>{dialog.remove();if(shareSheet===dialog)shareSheet=null;if(previousFocus?.isConnected)previousFocus.focus()},{once:true})
    dialog.showModal()
  }
  async function toggleBook(id){const saved=state.books.includes(id);await api('/notebook/'+id,{method:saved?'DELETE':'PUT',body:{}});toast(saved?'Dato quitado de tu libreta.':'Guardado en tu libreta.');return !saved}
  function deleteScreen(){page(`${header('Borrar mis datos de Suizamente',{back:'/ajustes'})}<p class="s-soft">Se eliminarán tu perfil del juego, puntos, amigos, libreta y progreso. Tus votos se conservarán de forma anónima. Tu cuenta de acceso seguirá existiendo.</p><form id="delete-form" class="s-form"><label class="s-check"><input type="checkbox" name="confirmado" required>Entiendo que no podré recuperar estos datos.</label><label>Escribe BORRAR<input name="confirmacion" required pattern="BORRAR" autocomplete="off"></label><button class="s-button danger full">Borrar mis datos</button></form>`);container.querySelector('#delete-form').onsubmit=event=>submitForm(event,async values=>{await api('/profile',{method:'DELETE',body:{confirmacion:values.get('confirmacion'),confirmado:values.has('confirmado')}});try{for(const storageKey of [key,'suizamente:v1'+(identity.userId?':'+identity.userId:''),'suizamente:pendientes:'+account])localStorage.removeItem(storageKey)}catch{}location.reload()})}
  function answer(data){state.lastAnswer=data;if(data.perfil){state.profile=data.perfil;state.online=true;remember()};state.roundPoints+=data.puntos||0;state.newMedals.push(...(data.medallasNuevas||[]));state.levelUp=state.levelUp||data.nivelNuevo;const chip=document.querySelector('#social-points');if(chip?.dataset.preguntaId===data.preguntaId)chip.textContent=data.puntos?`+${data.puntos} puntos${data.perfil?.aciertosSeguidos>=3?' 🔥×'+data.perfil.aciertosSeguidos:''}`:'Respuesta guardada';const summary=document.querySelector('#social-summary');if(summary)summary.innerHTML=summaryContent();const total=document.querySelector('#round-points');if(total)total.textContent='+'+numero(state.roundPoints)}
  function award(m){const [emoji,title]=MEDALLAS[m.id]||['🏅',m.id],tone=MEDALLAS_ESTILO[m.id]?.[0]||'ambar',description=MEDALLAS_ESTILO[m.id]?.[1]||'Un nuevo logro en tu camino por Suiza.';return `<article class="s-award s-tone-${tone}" aria-label="Medalla nueva: ${esc(title)}"><span class="s-award-icon" aria-hidden="true">${emoji}</span><div class="s-award-copy"><p class="s-award-label">🏅 Medalla nueva</p><h2>${esc(title)}</h2><p>${esc(description)}</p></div></article>`}
  function summaryContent(){const p=state.profile;return `${p?`<section class="s-round-level s-card"><div class="s-row s-between"><b>${esc(p.nombreNivel)}</b><b class="s-soft">${esc(p.siguiente||'Nivel máximo')}</b></div><div class="s-progress"><i style="width:${Number(p.progreso)||0}%"></i></div><p class="s-soft">${p.siguiente?`Te faltan ${numero(p.faltan)} puntos para ${esc(p.siguiente)}.`:'Has llegado a Leyenda alpina. ¡Sigue aprendiendo!'}</p></section>`:''}${state.levelUp&&p?`<article class="s-award s-award-level"><span class="s-award-icon" aria-hidden="true">✨</span><div class="s-award-copy"><p class="s-award-label">Nivel nuevo</p><h2>${esc(p.nombreNivel)}</h2><p>Tu camino en Suiza sigue creciendo.</p></div></article>`:''}${[...new Map(state.newMedals.map(m=>[m.id,m])).values()].map(award).join('')}`}
  function decorateSummary(){const node=document.createElement('div');node.id='social-summary';node.className='s-stack';node.innerHTML=summaryContent();container.querySelector('.score')?.after(node)}
  function decorateResult(q,selected,{repetida=false,contexto=null}={}){
    currentResult={q,selected}
    const points=document.createElement('span');points.className='s-point-chip s-result-points';points.id='social-points';points.textContent=state.online?'Guardando tu respuesta…':'Pendiente de conexión';points.dataset.preguntaId=q.id
    document.querySelector('.rv-top')?.append(points)
    const row=document.createElement('div');row.className='social-result-tools';row.innerHTML=state.online?'<div class="s-card"><div class="s-breakdown-heading"><h3>'+(q.tipo==='real'?'¿Quién lo sabía?':'Eligieron lo mismo')+'</h3><div class="s-tabs"><button class="active" type="button" data-breakdown="pais">País</button><button type="button" data-breakdown="anos">Años en Suiza</button></div></div><div id="social-breakdown" class="s-stack" role="region" aria-label="Respuestas por país" tabindex="0"></div></div>':''
    document.querySelector('.rv .panel')?.after(row)
    if(state.lastAnswer?.preguntaId===q.id){const award=state.lastAnswer;points.textContent=award.puntos?`+${award.puntos} puntos`:'Respuesta guardada'}
    if(repetida&&!contexto)points.textContent='Ya respondida · sin puntos extra';
    decorateFacts()
    const share=document.querySelector('#compartir'),next=document.querySelector('#sig'),bar=share?.parentElement
    if(bar){bar.classList.add('s-result-actions');bar.prepend(share);share.classList.add('s-result-share');next.classList.add('s-result-next');share.textContent='📤 Compartir';share.onclick=()=>shareQuestion(q,selected)}
    let breakdownRequest=0
    async function breakdown(type){
      const request=++breakdownRequest,target=row.querySelector('#social-breakdown')
      target.dataset.dimension=type;target.setAttribute('aria-label',type==='pais'?'Respuestas por país':'Respuestas por años en Suiza');target.scrollTop=0
      target.setAttribute('aria-live','polite');target.setAttribute('aria-busy','true')
      try{
        const data=await api('/breakdown?pregunta='+q.id+'&por='+type)
        if(request!==breakdownRequest)return
        const groups=data.demo&&!demoEnabled()?[]:data.grupos
        const shown=groups.slice().sort((a,b)=>type==='anos'?yearOrder.indexOf(a.grupo)-yearOrder.indexOf(b.grupo):b.votos-a.votos||a.grupo.localeCompare(b.grupo))
        const index=q.tipo==='real'?q.correcta:selected
        target.innerHTML=shown.length?shown.map(g=>{
          const same=g.conteos[index]||0,pct=Math.round(100*same/g.votos)
          return `<div class="s-breakdown-item${g.grupo===data.tuGrupo?' mine':''}" data-group="${esc(g.grupo)}"><div class="s-breakdown-main"><span class="s-breakdown-name">${type==='pais'?flag(g.grupo):''}<span>${esc((type==='pais'?PAISES:ANOS)[g.grupo]||g.grupo)}</span></span><div class="s-progress" aria-hidden="true"><i style="width:${100*same/g.votos}%"></i></div><b>${pct}%</b></div><small class="s-soft">${same} de ${g.votos} ${q.tipo==='real'?'acertaron':'eligieron esta respuesta'}</small></div>`
        }).join(''):`<p class="s-soft">Aún hay pocos votos para separar por ${type==='pais'?'país':'años en Suiza'}. Cada grupo necesita al menos 20 votos.</p>`
      }catch{if(request===breakdownRequest)target.textContent='Este desglose no está disponible ahora.'}
      finally{if(request===breakdownRequest)target.setAttribute('aria-busy','false')}
    }
    row.querySelectorAll('[data-breakdown]').forEach(b=>b.onclick=()=>{row.querySelectorAll('[data-breakdown]').forEach(other=>other.classList.toggle('active',b===other));breakdown(b.dataset.breakdown)})
    if(state.online)breakdown('pais')
  }
  function decorateFacts(activeQuestion,selected){
    if(activeQuestion)currentResult={q:activeQuestion,selected}
    if(!currentResult||!document.querySelector('#reveal'))return
    const {q}=currentResult,fact=document.querySelector('.res.is-picked .answer-fact')||document.querySelector('.answer-fact')
    if(!fact||fact.querySelector('#social-bookmark'))return
    const heading=document.createElement('div');heading.className='s-fact-heading'
    const title=fact.querySelector('b'),book=document.createElement('button');book.type='button';book.id='social-bookmark';book.className='s-save-fact';book.innerHTML='<svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true"><path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4Z" fill="currentColor"/></svg>'
    const updateBook=saved=>{book.setAttribute('aria-pressed',String(saved));book.setAttribute('aria-label',saved?'Quitar de la libreta':'Guardar en la libreta');book.title=saved?'Guardado en tu libreta':'Guardar en tu libreta'}
    updateBook(state.books.includes(q.id))
    title.before(heading);heading.append(title,book)
    book.onclick=async()=>{book.disabled=true;try{updateBook(await toggleBook(q.id))}catch(error){toast(error.message)}finally{if(book.isConnected)book.disabled=false}}
    const report=document.createElement('button');report.type='button';report.id='social-report';report.className='s-report-fact';report.innerHTML='<span aria-hidden="true">🚩</span> Proponer corrección';report.onclick=()=>navigate('/proponer?corregir='+q.id);fact.append(report)
  }
  function shareQuestion(q,selected){
    const displayed=getDisplayCounts?.(q.id),counts=displayed?.n||getCounts(q.id),total=counts.reduce((sum,n)=>sum+Number(n||0),0),enlace='https://suizamente.latido.ch/jugar?p='+encodeURIComponent(q.id)
    const texto=['Suizamente',q.pregunta,...q.opciones.map((op,i)=>`${op.e} ${op.t}${total?' · '+Math.round(100*(counts[i]||0)/total)+'%':''}`),'Juega en '+enlace].join('\n')
    openShareSheet({titulo:q.tipo==='real'?(selected===q.correcta?'¡Lo sabía!':'Hoy he aprendido algo nuevo'):'¿Piensas como yo?',pregunta:q,conteos:counts,eleccion:selected,enlace,texto,challengeMode:getRound()?.modo||(q.tipo==='real'?'preguntas':'dilemas')})
  }
  function shareSummary({modo,texto,titulo,resultado}){openShareSheet({titulo,subtitulo:resultado,enlace:'https://suizamente.latido.ch/',texto,resumen:true,challengeMode:modo})}
  function openShareSheet(options){
    shareSheet?.close()
    const dialog=document.createElement('dialog'),previousFocus=document.activeElement;dialog.className='s-share-sheet';dialog.setAttribute('aria-labelledby','share-sheet-title')
    dialog.innerHTML=`<span class="s-sheet-handle" aria-hidden="true"></span><h2 id="share-sheet-title">📤 ${options.invitacion?'Enviar reto':'Compartir resultado'}</h2><div class="s-share-preview"><div class="s-share-thumbnail" aria-hidden="true">💡</div><div><h3>Comparte la imagen</h3><p>${options.invitacion?'Envía esta invitación a una persona. El reto admite un único rival.':options.pregunta?'Con la pregunta, los porcentajes y el enlace del juego.':options.resumen?'Con el resumen de tu ronda y el enlace del juego.':'Con el marcador y el enlace del juego.'}</p></div></div><div class="s-share-grid"><button type="button" class="s-share-option story" id="social-story" disabled><span aria-hidden="true">📥</span><b>Descargar imagen</b><small>Guardar en tu dispositivo</small></button><button type="button" class="s-share-option group" data-share-group disabled><span aria-hidden="true">📤</span><b>Enviar imagen</b><small>WhatsApp, Instagram, Telegram…</small></button>${options.invitacion?'':`<button type="button" class="s-share-option challenge" data-share-challenge><span aria-hidden="true">⚔️</span><b>Retar a alguien</b><small>10 preguntas para dos personas</small></button>`}</div><p class="s-share-status" role="status" aria-live="polite">Preparando la imagen…</p><button type="button" class="s-share-close">Cerrar</button>`
    document.body.append(dialog);shareSheet=dialog
    let historia=null,previewUrl=null
    const status=dialog.querySelector('.s-share-status'),storyButton=dialog.querySelector('#social-story'),sendButton=dialog.querySelector('[data-share-group]')
    const send=async descargar=>{
      storyButton.disabled=true;sendButton.disabled=true
      try{
        const result=await compartirHistoria({...options,historia,descargar});status.textContent=result
      }
      catch{status.textContent='No se ha podido enviar la imagen. Puedes descargarla y adjuntarla.'}
      finally{if(dialog.isConnected){storyButton.disabled=false;sendButton.disabled=false}}
    }
    storyButton.onclick=()=>send(true);sendButton.onclick=()=>send(false)
    const challenge=dialog.querySelector('[data-share-challenge]')
    if(challenge)challenge.onclick=()=>{dialog.close();if(requireAccount()){stopGame();duelPicker(null,options.challengeMode||'mix')}}
    dialog.querySelector('.s-share-close').onclick=()=>dialog.close()
    dialog.addEventListener('click',event=>{const rect=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientY<rect.top||event.clientX<rect.left||event.clientX>rect.right))dialog.close()})
    dialog.addEventListener('close',()=>{if(previewUrl)URL.revokeObjectURL(previewUrl);dialog.remove();if(shareSheet===dialog)shareSheet=null;if(previousFocus?.isConnected)previousFocus.focus()},{once:true})
    dialog.showModal()
    crearHistoria(options).then(value=>{if(!dialog.isConnected)return;historia=value;previewUrl=URL.createObjectURL(value.blob);const image=document.createElement('img');image.src=previewUrl;image.alt='Vista previa de la imagen compartida';dialog.querySelector('.s-share-thumbnail').replaceChildren(image);storyButton.disabled=false;sendButton.disabled=false;status.textContent='Juega en suizamente.latido.ch'}).catch(()=>{if(dialog.isConnected)status.textContent='No se ha podido preparar la imagen. Cierra esta ventana y vuelve a intentarlo.'})
  }
  async function boot(){
    try{
      await api('/bootstrap',{force:true})
      if(logged()&&playerId&&read('suizamente:v1',null)){
        await api('/link',{method:'POST',body:{invitado:playerId}})
        importAnswers(read('suizamente:v1',{resp:{}}).resp||{})
        const oldQueue=read('suizamente:pendientes:'+playerId,[]),newQueue=read('suizamente:pendientes:'+identity.userId,[])
        write('suizamente:pendientes:'+identity.userId,[...new Map([...oldQueue,...newQueue].map(item=>[item.key,item])).values()])
        try{for(const storageKey of ['suizamente:jugador','suizamente:v1','fondue-o-raclette:v1','suizamente:pendientes:'+playerId])localStorage.removeItem(storageKey)}catch{}
      }
      const [books,authors]=await Promise.all([api('/notebook'),api('/authors')]);state.books=books.libreta;state.authors=authors.autores;remember()
    }catch{/* The ordinary modes retain their existing votes/offline behavior. */}
    applySettings()
    state.loading=false
    if(state.route==='/'&&!logged()&&!read('suizamente:bienvenida',false)&&!Object.keys(getSaved()).length)state.route='/bienvenida'
  }
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==window.parent)return
    if(event.data?.type==='suizamente:logout-error'){const target=container.querySelector('[data-logout]');if(target){target.disabled=false;target.textContent='Cerrar sesión'}toast('No se ha podido cerrar la sesión. Vuelve a intentarlo.')}
    if(event.data?.type==='suizamente:route'&&safePath(event.data.path)&&event.data.path!==state.route)navigate(event.data.path,{fromHost:true})
  })
  window.addEventListener('online',async()=>{await boot();if(!container.classList.contains('playing'))render()})
  const photoError=event=>{if(event.target?.matches?.('img.s-avatar-photo'))event.target.remove()}
  const photoLoaded=event=>{if(event.target?.matches?.('img.s-avatar-photo'))event.target.classList.add('is-loaded')}
  document.addEventListener('error',photoError,true)
  document.addEventListener('load',photoLoaded,true)
  window.addEventListener('pagehide',()=>{clearInterval(poll);clearTimeout(toastTimer);stopPeopleSearch();document.removeEventListener('error',photoError,true);document.removeEventListener('load',photoLoaded,true)},{once:true})
  if(state.route==='/'&&!logged()&&!read('suizamente:bienvenida',false)&&!Object.keys(getSaved()).length)state.route='/bienvenida'
  boot().then(()=>{if(!container.classList.contains('playing')&&!container.querySelector('form'))render()})
  poll=setInterval(()=>{if(!document.hidden&&!container.classList.contains('playing')&&!container.querySelector('form')&&state.online&&(/^\/(retos|duelo|avisos)/.test(state.route))){cache.clear();render()}},30000)
  return {render,navigate,answer,decorateResult,decorateFacts,decorateSummary,shareSummary,get roundPoints(){return state.roundPoints},get sharing(){return !!shareSheet},exit(){navigate(returnRoute)},get online(){return state.online},get authors(){return state.authors},resetRound(){state.roundPoints=0;state.newMedals=[];state.levelUp=false;state.lastAnswer=null},choose(){const p=settings();if(p.vibracion)navigator.vibrate?.(15);if(p.sonidos)try{const Audio=window.AudioContext||window.webkitAudioContext,ctx=new Audio(),o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);g.gain.value=.025;o.frequency.value=660;o.start();o.stop(ctx.currentTime+.06);o.onended=()=>ctx.close()}catch{}},get route(){return state.route}}
}
