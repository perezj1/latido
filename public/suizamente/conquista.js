import {CANTONES,esc,numero,avatar} from './experiencia-datos.js'
const names={escudo:'Escudo',cincuenta:'Pista 50/50',segunda:'Segunda oportunidad'}
const icons={escudo:'🛡️',cincuenta:'💡',segunda:'↩️'}
const levels={facil:'Fácil',medio:'Medio',dificil:'Difícil'}
const base='/conquista'
const button=(text,attributes='',secondary=false)=>`<button type="button" class="s-button${secondary?' secondary':''}" ${attributes}>${text}</button>`
const date=value=>value?new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Zurich'}).format(new Date(value)):''
const ends=value=>value?new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Zurich'}).format(new Date(value)):''
const advantages=values=>values?.length?values.map(v=>`${icons[v]||''} ${esc(names[v]||v)}`).join(' · '):'Sin ventajas'
const attributes=(action,extra='')=>`data-cq-action="${action}" ${extra}`
let mapPromise
const loadMap=()=>mapPromise||=fetch('/suizamente/conquista/mapa.json').then(r=>{if(!r.ok)throw new Error('No se ha podido abrir el mapa.');return r.json()}).catch(error=>{mapPromise=null;throw error})

export function crearConquista({identity,getIdentity,navigate,toast}){
 let data=null,round=null,battle=null,busy=false,route=base
 const requests=new Map()
 const endpoint=identity.conquistaApi||(typeof identity.socialApi==='string'?identity.socialApi.replace(/suizamente-social\/?$/,'suizamente-conquista'):'')
 async function api(path,{method='GET',body}={}){
  if(!endpoint)throw new Error('Conquista no está disponible ahora. Puedes seguir jugando a los otros modos.')
  const session=await getIdentity()
  if(!session.token)throw new Error('Entra con tu cuenta para jugar a Conquista.')
  let response
  try{response=await fetch(endpoint+path,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.token},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)})}
  catch{throw new Error('No se ha podido conectar. Tus puntos y tu partida se conservan. Vuelve a intentarlo.')}
  const result=await response.json().catch(()=>({}))
  if(!response.ok)throw new Error(result.error||'No se ha podido abrir Conquista.')
  return result
 }
 async function mutate(path,body={},method='POST'){
  const key=path+JSON.stringify(body)
  if(!requests.has(key))requests.set(key,crypto.randomUUID())
  const result=await api(path,{method,body:{...body,solicitud:requests.get(key)}})
  requests.delete(key);toast('');return result
 }
 const owned=code=>data.cantones.find(c=>c.codigo===code)
 function header(subtitle='Tu conocimiento, tu territorio.'){
  return `<div class="cq-heading"><div><p class="s-kicker">SUIZAMENTE</p><h1>Conquista<span aria-hidden="true">✦</span></h1><p class="s-soft">${esc(subtitle)}</p></div><div class="cq-header-tools"><button class="cq-notice-bell" data-go="/conquista/avisos" aria-label="Avisos de Conquista${data?.sinLeer?' · '+data.sinLeer+' sin leer':''}">&#128276;${data?.sinLeer?`<i>${data.sinLeer}</i>`:''}</button><span class="cq-wallet" aria-label="${numero(data?.saldo)} puntos disponibles"><span aria-hidden="true">✦</span>${numero(data?.saldo)}<small>disponibles</small></span></div></div>`
 }
 function tabs(active){return `<nav class="cq-tabs" aria-label="Secciones de Conquista">${[['','🗺️','Mapa'],['/tienda','🛍️','Tienda'],['/batallas','⚡','Batallas'],['/coleccion','🏅','Colección']].map(([path,icon,label])=>`<button type="button" data-go="${base+path}" ${active===path?'aria-current="page"':''}><span aria-hidden="true">${icon}</span>${label}</button>`).join('')}</nav>`}
 function loadout(id){return `<fieldset class="cq-loadout"><legend>Equipa hasta dos ventajas</legend><p class="s-soft">Se consumen al empezar, aunque no llegues a usarlas.</p>${data.catalogo.map(v=>`<label class="cq-equipment${!data.inventario[v.codigo]?' is-empty':''}"><input type="checkbox" name="ventajas" value="${v.codigo}" ${!data.inventario[v.codigo]?'disabled':''}><span aria-hidden="true">${icons[v.codigo]}</span><span><b>${esc(v.nombre)}</b><small>${esc(v.descripcion)}</small></span><strong>×${data.inventario[v.codigo]||0}</strong></label>`).join('')}<a href="${base}/tienda" data-go="${base}/tienda">Conseguir ventajas en la tienda</a></fieldset><input type="hidden" name="canton" value="${esc(id||'')}">`}
 function activeRounds(){return data.activas.filter(p=>!p.batalla).map(p=>`<div class="cq-resume"><span aria-hidden="true">⏳</span><div><b>Tu conquista de ${esc(CANTONES[p.canton])}</b><small>La partida está guardada.</small></div>${button('Seguir',`data-go="${base}/partida/${p.id}"`)}</div>`).join('')}
 async function map(){
  const geometry=await loadMap(),states=new Map(data.cantones.map(c=>[c.codigo,c]))
  const status=c=>c.enDisputa?'dispute':c.poseido?'owned':c.perdido?'lost':'available'
  const labels={owned:'Conquistado',available:'Disponible',dispute:'En disputa',lost:'Perdido'}
  const offsets={BS:[-14,-9],BL:[2,10],AR:[18,-9],AI:[20,8],NW:[14,5],ZG:[-5,-4]}
  const svg=`<svg class="cq-map" viewBox="${esc(geometry.viewBox)}" aria-labelledby="cq-map-title" role="group"><title id="cq-map-title">Tu mapa interactivo de los 26 cantones de Suiza</title>${geometry.cantons.map(g=>{const c=states.get(g.code);return `<path d="${g.path}" class="cq-land ${status(c)}" tabindex="0" role="button" aria-label="${esc(c.nombre)} · ${labels[status(c)]}" ${attributes('canton',`data-code="${g.code}"`)}><title>${esc(c.nombre)}</title></path>`}).join('')}<g class="cq-map-labels" aria-hidden="true">${geometry.cantons.map(g=>{const [dx,dy]=offsets[g.code]||[0,0];return `<text x="${g.x+dx}" y="${g.y+dy}" class="${status(states.get(g.code))}">${g.code}</text>`}).join('')}</g></svg>`
  const target=data.cantones.find(c=>!c.poseido&&!c.enDisputa&&c.nivel==='facil')||data.cantones.find(c=>!c.poseido&&!c.enDisputa)
  return `${header()}${tabs('')}<section class="cq-map-card"><div class="cq-map-top"><div><h2>Tu mapa de Suiza</h2><p class="s-soft">26 cantones. Un reto en cada uno.</p></div><span class="cq-map-count">${data.conquistados}<small>/26</small></span></div><div class="cq-map-progress" aria-label="${data.conquistados} de 26 conquistados"><i style="width:${100*data.conquistados/26}%"></i></div><div class="cq-map-window">${svg}</div><button type="button" class="cq-map-zoom" aria-label="Ampliar mapa" aria-pressed="false" data-cq-action="zoom">＋ <span>Ampliar mapa</span></button><div class="cq-legend">${[['owned','Conquistado'],['available','Disponible'],['dispute','En disputa'],['lost','Perdido']].map(([s,l])=>`<span><i class="${s}"></i>${l}</span>`).join('')}</div><p class="cq-attribution"><a href="https://www.swisstopo.admin.ch/en/landscape-model-swissboundaries3d" target="_blank" rel="noopener">© swisstopo · Límites de 2026</a></p></section>
   ${activeRounds()}<label class="cq-find">Explora un cantón<select data-cq-select><option value="">Elige en el mapa o busca aquí</option>${data.cantones.map(c=>`<option value="${c.codigo}">${esc(c.nombre)}${c.poseido?' · ✓':''}</option>`).join('')}</select></label>
   ${target?`<button class="cq-next" data-go="${base}/canton/${target.codigo}"><span class="cq-canton-badge">${target.codigo}</span><span><small>Tu próximo objetivo</small><b>Conquistar ${esc(target.nombre)}</b><small>${target.cantidad} preguntas · ${target.coste} puntos</small></span><span aria-hidden="true">↗</span></button>`:`<div class="cq-celebration"><span>🏆</span><h2>¡Suiza entera es tuya!</h2><p>Has conquistado los 26 cantones.</p></div>`}
   <div class="cq-small-stats"><div><b>${data.historicas}</b><span>Conquistas históricas</span></div><div><b>${numero(data.xp)}</b><span>Experiencia acumulada</span></div></div><details class="cq-rules"><summary>Cómo se conquista</summary><ol><li>Gana puntos jugando a Suizamente.</li><li>Elige un cantón y, si quieres, equipa ventajas.</li><li>Acierta todas sus preguntas para conquistarlo.</li></ol><p>El intento cuesta puntos. La experiencia y el nivel se conservan. Tus cantones se quedan contigo sin límite de tiempo. Competir con amigos es opcional.</p></details>`
 }
 function canton(code){
  const c=owned(code);if(!c)throw new Error('Cantón no encontrado.')
  const active=data.activas.find(p=>p.canton===code&&!p.batalla)
  return `${header(c.poseido?'Este territorio ya forma parte de tu mapa.':'Demuestra cuánto sabes de este cantón.')}<button class="s-link" data-go="${base}">← Volver al mapa</button><section class="cq-territory ${c.poseido?'is-owned':''}"><span class="cq-big-badge">${code}</span><span class="cq-status">${c.enDisputa?'⚡ En disputa':c.poseido?'✓ Conquistado':c.perdido?'Por reconquistar':'Disponible'}</span><h2>${esc(c.nombre)}</h2><p class="s-soft">${levels[c.nivel]} · ${c.preguntasDisponibles} preguntas en el banco</p>${c.poseido?`<p>Conquistado el ${date(c.fecha)}</p><div class="cq-small-stats"><div><b>${c.veces}</b><span>Conquistas</span></div><div><b>${c.defensas}</b><span>Defensas ganadas</span></div></div>`:`<div class="cq-territory-numbers"><div><b>${c.cantidad}</b><small>preguntas</small></div><div><b>${c.coste}</b><small>puntos</small></div><div><b>${c.cantidad}/${c.cantidad}</b><small>para conquistar</small></div></div>`}</section>
  ${c.batalla?button('Ver la batalla por este cantón',`data-go="${base}/batalla/${c.batalla}"`):active?button('Seguir mi conquista',`data-go="${base}/partida/${active.id}"`):c.poseido?`<p class="cq-note">Tu cantón no caduca. Solo puede ponerse en juego si activas las batallas entre amigos y aceptas un desafío.</p>${button('Ver mis batallas',`data-go="${base}/batallas"`)}`:`<form data-cq-form="start">${loadout(code)}<div class="cq-cost"><b>Coste del intento: ${c.coste} puntos</b><p>Se descuentan al empezar. Si no completas todos los aciertos, podrás volver a intentarlo reuniendo más puntos.</p></div><button class="s-button full" type="submit" ${data.saldo<c.coste||c.preguntasDisponibles<c.cantidad?'disabled':''}>${c.perdido?'Reconquistar':'Conquistar'} ${esc(c.nombre)} · ${c.coste} pts</button>${data.saldo<c.coste?`<p class="cq-note">Te faltan ${c.coste-data.saldo} puntos. <a href="/" data-go="/">Juega para conseguirlos</a>.</p>`:''}</form>`}`
 }
 function shop(){return `${header('Elige cómo quieres preparar tu próxima conquista.')}${tabs('/tienda')}<div class="cq-shop-intro"><span aria-hidden="true">🎒</span><div><h2>Tu mochila de ventajas</h2><p class="s-soft">Compra ahora. Equipa antes de jugar.</p></div></div>${data.catalogo.map(v=>`<article class="cq-shop-card"><div class="cq-shop-icon ${v.codigo}" aria-hidden="true">${icons[v.codigo]}</div><div class="cq-shop-copy"><h2>${esc(v.nombre)}</h2><p>${esc(v.descripcion)}</p><small>Tienes ${data.inventario[v.codigo]||0}</small></div><button class="s-button" ${attributes('buy',`data-code="${v.codigo}"`)} ${data.saldo<v.precio?'disabled':''}>${v.precio} <span class="s-visually-hidden">puntos · Comprar ${esc(v.nombre)}</span><span aria-hidden="true">✦</span></button></article>`).join('')}<p class="cq-note">Máximo dos ventajas diferentes por partida. Cada unidad se consume cuando empieza el intento o se acepta la batalla. Las compras usan tu saldo disponible y conservan tu experiencia.</p>${button('Volver al mapa',`data-go="${base}"`,true)}`}
 function battleCard(b){
  const rival=b.soyAtacante?b.defensor:b.atacante,finished=b.estado==='terminada'
  const state=b.estado==='pendiente'?b.soyAtacante?'Esperando a '+rival.apodo:'Te han desafiado':b.estado==='activa'?b.miEstado==='terminada'?'Esperando a '+rival.apodo:'Tu turno':finished?b.ganador===identity.userId?'Victoria':!b.ganador?'Empate':b.motivo==='incomparecencia'?'Resuelta por plazo':'Derrota':b.estado==='rechazada'?'Invitación cerrada':'Invitación caducada'
  return `<button class="cq-battle-card" data-go="${base}/batalla/${b.id}"><span class="cq-canton-badge">${b.canton}</span><span><small>${esc(state)}</small><b>${esc(CANTONES[b.canton])}</b><small>Contra ${esc(rival.apodo)}${finished?` · ${b.misAciertos}–${b.susAciertos}`:''}</small></span><span aria-hidden="true">›</span></button>`
 }
 function battles(){
  const pending=data.batallas.filter(b=>['pendiente','activa'].includes(b.estado)),completed=data.batallas.filter(b=>!['pendiente','activa'].includes(b.estado))
  return `${header('La rivalidad se juega con conocimiento.')}${tabs('/batallas')}<label class="cq-competition"><span><b>Batallas entre amigos</b><small>${data.competitivo?'Tus amigos pueden proponerte desafíos.':'Tus territorios están a salvo. Activa los desafíos cuando quieras.'}</small></span><input type="checkbox" role="switch" aria-label="Activar batallas entre amigos" data-cq-competition ${data.competitivo?'checked':''}></label><p class="cq-note">Tú decides qué desafíos aceptas. Desactivar rechaza las invitaciones pendientes; las batallas ya aceptadas siguen hasta su resultado o plazo.</p>${button('＋ Desafiar a un amigo',`data-go="${base}/retar"`)}${button('Ver avisos'+(data.sinLeer?' · '+data.sinLeer+' nuevos':''),`data-go="${base}/avisos"`,true)}<section class="cq-stack"><h2>En juego${pending.length?' · '+pending.length:''}</h2>${pending.length?pending.map(battleCard).join(''):'<div class="cq-empty"><span>🤝</span><h3>Tu próxima rivalidad empieza aquí</h3><p>Desafía a un amigo por un cantón que todavía no tengas. Tenéis las mismas diez preguntas.</p></div>'}</section>${completed.length?`<section class="cq-stack"><h2>Resultados e invitaciones</h2>${completed.map(battleCard).join('')}</section>`:''}<details class="cq-rules"><summary>Apuestas, empates y plazos</summary><p>El atacante apuesta 100 puntos, que se reservan cuando el defensor acepta. Si gana, conquista el cantón y recupera la apuesta. Si gana el defensor, conserva el cantón y recibe los 100 puntos. En empate, se conserva el cantón y se devuelve la apuesta.</p><p>Hay 24 horas para aceptar y 48 horas desde la aceptación para completar las diez preguntas. Si solo uno termina, gana por incomparecencia. Si ninguno termina, el cantón se conserva y se devuelve la apuesta. Rechazar o dejar caducar una invitación no cuesta puntos.</p></details>`
 }
 function newBattle(params){
  const eligible=data.amigos.filter(f=>f.disponible&&f.cantones.some(c=>!owned(c)?.poseido)),friend=eligible.find(f=>f.id===params.get('amigo'))||eligible[0]
  const codes=friend?.cantones.filter(c=>!owned(c)?.poseido)||[]
  return `${header('Disputa un cantón a una persona de tu gente.')}<button class="s-link" data-go="${base}/batallas">← Volver a Batallas</button><h2>Desafiar a un amigo</h2>${!data.competitivo?`<div class="cq-empty"><span>🤝</span><p>Activa las batallas entre amigos para participar.</p>${button('Activar batallas',attributes('enable'))}</div>`:!friend?`<div class="cq-empty"><span>🗺️</span><p>Necesitas un amigo con batallas activadas y algún cantón que tú aún no tengas.</p>${button('Ver mis amigos','data-go="/amigos"')}</div>`:`<form data-cq-form="battle"><label>Tu rival<select name="defensor" data-cq-friend>${eligible.map(f=>`<option value="${f.id}" ${f.id===friend.id?'selected':''}>${esc(f.apodo)}</option>`).join('')}</select></label><label>Cantón en juego<select name="objetivo">${codes.map(c=>`<option value="${c}" ${c===params.get('canton')?'selected':''}>${esc(CANTONES[c])}</option>`).join('')}</select></label><div class="cq-cost"><b>100 puntos de apuesta · 10 preguntas</b><p>Se reservan solo cuando tu amigo acepta. Las ventajas elegidas también se consumen en ese momento y estarán visibles en la invitación.</p></div>${loadout('')}<button class="s-button full" type="submit" ${data.saldo<100?'disabled':''}>Enviar desafío</button>${data.saldo<100?'<p class="cq-note">Reúne 100 puntos antes de enviar el desafío.</p>':''}</form>`}`
 }
 function battleDetail(){
  const b=battle,rival=b.soyAtacante?b.defensor:b.atacante,mine=b.soyAtacante?b.atacante:b.defensor,done=b.estado==='terminada'
  let title=b.estado==='pendiente'?b.soyAtacante?'Esperando a '+rival.apodo:rival.apodo+' te disputa el cantón':b.estado==='activa'?b.miEstado==='terminada'?'Tu parte está hecha':'Diez preguntas. Un territorio.':done?b.ganador===identity.userId?b.soyAtacante?'¡Has conquistado '+CANTONES[b.canton]+'!':'¡Cantón defendido!':!b.ganador?'El cantón se queda con su defensor.':'La batalla se la lleva '+rival.apodo:b.estado==='rechazada'?'Invitación cerrada':'Invitación caducada'
  return `${header()}<button class="s-link" data-go="${base}/batallas">← Mis batallas</button><section class="cq-territory"><span class="cq-big-badge">${b.canton}</span><h2>${esc(CANTONES[b.canton])}</h2><p>${esc(title)}</p><div class="cq-versus"><div>${avatar({apodo:mine.apodo},'large')}<b>Tú</b><small>${b.soyAtacante?'Atacante':'Defensor'}</small></div><strong>${done?`${b.misAciertos}–${b.susAciertos}`:'VS'}</strong><div>${avatar({apodo:rival.apodo},'large')}<b>${esc(rival.apodo)}</b><small>${b.soyAtacante?'Defensor':'Atacante'}</small></div></div><div class="cq-opponent-loadout"><small>Ventajas del atacante</small><p>${advantages(b.ventajasAtacante)}</p>${b.estado!=='pendiente'?`<small>Ventajas del defensor</small><p>${advantages(b.ventajasDefensor)}</p>`:''}</div></section>
  ${b.estado==='pendiente'?`<p class="cq-note">100 puntos de apuesta del atacante. Plazo para aceptar: ${ends(b.venceEn)}. Después, 48 horas para jugar.</p>${b.soyAtacante?`${button('Enviar enlace del desafío',attributes('share-battle'))}${button('Cancelar invitación',attributes('reject'),true)}`:`<form data-cq-form="accept">${loadout(b.canton)}<button class="s-button full" type="submit">Aceptar y defender ${esc(CANTONES[b.canton])}</button></form>${button('Rechazar desafío',attributes('reject'),true)}`}`:b.estado==='activa'?`<p class="cq-note">Termina el ${ends(b.venceEn)}. Las soluciones se muestran cuando la batalla termina.</p>${b.miEstado==='activa'?button(b.soyAtacante?'Jugar mi ataque':'Jugar mi defensa',`data-go="${base}/partida/${b.partida}"`):`<p class="cq-note">${esc(rival.apodo)} tiene hasta ese momento para terminar. El resultado se resolverá con las reglas de la batalla.</p>${button('Actualizar estado',attributes('refresh'),true)}`}`:done?`<p class="cq-note">${b.motivo==='incomparecencia'?'Resultado por incomparecencia.':b.motivo==='sin_finalizar'?'Ninguno terminó a tiempo. Se devuelve la apuesta y se conserva el cantón.':!b.ganador?'Empate: se devuelve la apuesta al atacante.':b.ganador===b.atacante.id?'El atacante conquista el cantón y recupera sus 100 puntos.':'El defensor conserva su cantón y recibe los 100 puntos de la apuesta.'}</p>${b.partida?button('Revisar mis respuestas',`data-go="${base}/partida/${b.partida}"`,true):''}${!owned(b.canton)?.poseido?button('Proponer revancha',`data-go="${base}/retar?amigo=${rival.id}&canton=${b.canton}"`):''}`:'<p class="cq-note">No se han gastado puntos ni ventajas en esta invitación.</p>'}`
 }
 function collection(){
  const milestones=[5,10,20,26]
  return `${header('Cada cantón guarda una historia que has aprendido.')}${tabs('/coleccion')}<section class="cq-collection-hero"><span aria-hidden="true">🏅</span><div><h2>Mi colección de cantones</h2><p>${data.conquistados} de 26 bajo tu control</p></div></section><div class="cq-milestones">${milestones.map(n=>`<div class="${data.conquistados>=n||data.logros?.includes(n)?'earned':''}"><span aria-hidden="true">${n===26?'🏆':'✦'}</span><b>${n}</b><small>cantones</small></div>`).join('')}</div><div class="cq-badge-grid">${data.cantones.map(c=>`<button class="cq-collection-badge ${c.poseido?'owned':c.perdido?'lost':''}" data-go="${base}/canton/${c.codigo}"><span>${c.codigo}${c.poseido?'<i aria-hidden="true">✓</i>':''}</span><b>${esc(c.nombre)}</b><small>${c.poseido?'Conquistado':c.perdido?'Perdido':'Por descubrir'}</small></button>`).join('')}</div><div class="cq-small-stats"><div><b>${data.historicas}</b><span>Conquistas históricas</span></div><div><b>${data.cantones.reduce((n,c)=>n+c.defensas,0)}</b><span>Defensas ganadas</span></div></div><section class="cq-stack"><h2>Tu historia</h2>${data.historial.length?data.historial.filter(h=>h.tipo!=='logro').map(h=>`<div class="cq-history"><span class="cq-canton-badge">${h.canton}</span><div><b>${esc(({conquista:'Conquistaste',batalla:'Ganaste en batalla',perdido:'Perdiste',defensa:'Defendiste'})[h.tipo]||h.tipo)} ${esc(CANTONES[h.canton]||'')}</b><small>${date(h.creado_en)}</small></div></div>`).join(''):'<p class="s-soft">Tu primera conquista será el inicio de esta colección.</p>'}</section>`
 }
 function roundView(){
  const r=round,c=owned(r.canton),question=r.pregunta,finished=r.estado!=='activa'
  if(finished){
   const success=r.estado==='ganada'
   return `${header()}<section class="cq-round-result ${success?'won':''}"><span>${success?'🏅':r.batalla?'⚡':'🧭'}</span><h2>${success?'¡'+esc(CANTONES[r.canton])+' es tuyo!':r.batalla?'Tu parte está guardada':r.estado==='caducada'?'La partida ha caducado':'Un paso más cerca'}</h2><strong>${r.aciertos??0}<small>/${r.cantidad}</small></strong><p>${success?'La insignia ya está en tu colección.':r.batalla?'El territorio se decide al terminar la batalla.':'Cada respuesta te prepara para el siguiente intento.'}</p></section>${r.batalla?button('Ver la batalla',`data-go="${base}/batalla/${r.batalla}"`):button(success?'Ver mi mapa':'Volver al cantón',`data-go="${success?base:base+'/canton/'+r.canton}"`)}${r.revision?.length?`<section class="cq-stack"><h2>Lo que has aprendido</h2>${r.revision.map(q=>`<article class="cq-review"><span class="cq-review-mark">${q.respuesta?.correcta?'✓':q.respuesta?.punto?'🛡️':'✕'}</span><div><h3>${esc(q.texto)}</h3><p><b>${esc(q.opciones[q.correcta])}</b></p><p>${esc(q.explicacion)}</p><a href="${esc(q.fuente)}" target="_blank" rel="noopener">Fuente · Revisada el ${date(q.revisada)}</a></div></article>`).join('')}</section>`:r.batalla?'<p class="cq-note">Las respuestas correctas y sus explicaciones estarán disponibles cuando termine la batalla.</p>':''}`
  }
  return `<div class="cq-round-top"><button class="s-circle" data-go="${base}${r.batalla?'/batalla/'+r.batalla:''}" aria-label="Salir y guardar la partida">×</button><span>${esc(CANTONES[r.canton])}<small>${r.batalla?'Batalla territorial':'Conquista '+levels[c.nivel].toLowerCase()}</small></span><b>${r.respondidas+1}<small>/${r.cantidad}</small></b></div><div class="cq-round-progress" aria-label="${r.respondidas} de ${r.cantidad} respondidas"><i style="width:${100*r.respondidas/r.cantidad}%"></i></div><section class="cq-question"><p class="s-kicker">${question.reintento?'↩ Segunda oportunidad · Elige otra respuesta':'UN CANTÓN SE GANA CON CONOCIMIENTO'}</p><h1>${esc(question.texto)}</h1><div class="cq-answers">${question.opciones.map((label,index)=>`<button type="button" ${attributes('answer',`data-option="${index}"`)} ${question.descartadas?.includes(index)||question.primera===index?'disabled':''}><span>${String.fromCharCode(65+index)}</span><b>${esc(label)}</b></button>`).join('')}</div></section><div class="cq-round-tools">${r.ventajas.map(v=>`<button type="button" ${v==='cincuenta'?attributes('hint'):''} ${v!=='cincuenta'||r.usadas[v]?'disabled':''} aria-label="${esc(names[v])}${r.usadas[v]?' utilizada':''}"><span>${icons[v]}</span>${esc(names[v])}<small>${r.usadas[v]?'Usada':v==='cincuenta'?'Usar ahora':'Automática'}</small></button>`).join('')||'<p>Sin ventajas equipadas. Confía en lo que sabes.</p>'}</div><p class="cq-round-save">Progreso guardado · Puedes salir y continuar antes del ${ends(r.venceEn)}.</p>${!r.batalla?`<button class="s-link cq-abandon" ${attributes('abandon')}>Abandonar este intento</button>`:''}`
 }
 async function render(url){
  route=url.pathname+url.search;round=null;battle=null
  if(!identity.userId)return `<div class="cq">${header()}<div class="cq-empty"><span>🗺️</span><h2>Tu mapa te espera</h2><p>Entra con tu cuenta para guardar tus conquistas, comprar ventajas y retar a tus amigos.</p>${button('Entrar en Suizamente','data-login')}</div></div>`
  data=await api('/state')
  const path=url.pathname
  let content
  if(path===base)content=await map()
  else if(path===base+'/avisos')content=`${header('Tus desafíos y sus novedades.')}<button class="s-link" data-go="${base}/batallas">← Volver a Batallas</button><h2>Avisos de Conquista</h2>${data.avisos.length?data.avisos.map(n=>`<button class="cq-notice ${n.leido?'':'unread'}" data-go="${esc(n.href)}"><b>${esc(n.titulo)}</b><span>${esc(n.texto)}</span><small>${date(n.creado_en)}</small></button>`).join(''):'<p class="cq-note">Aquí aparecerán tus invitaciones, aceptaciones y resultados.</p>'}${data.sinLeer?button('Marcar como leídos',attributes('read-notices'),true):''}`
  else if(path===base+'/tienda')content=shop()
  else if(path===base+'/batallas')content=battles()
  else if(path===base+'/coleccion')content=collection()
  else if(path===base+'/retar')content=newBattle(url.searchParams)
  else if(path.startsWith(base+'/canton/'))content=canton(path.split('/').at(-1))
  else if(path.startsWith(base+'/partida/')){round=await api('/rounds/'+path.split('/').at(-1));content=roundView()}
  else if(path.startsWith(base+'/batalla/')){battle=await api('/battles/'+path.split('/').at(-1));content=battleDetail()}
  else throw new Error('Esta pantalla de Conquista no existe.')
  return `<div class="cq${round?.estado==='activa'?' cq-playing':''}" data-conquista>${content}<p class="cq-feedback" role="status" aria-live="polite"></p></div>`
 }
 function bind(container){
  const root=container.querySelector('[data-conquista]');if(!root)return
  const boundRound=round,boundBattle=battle,boundRoute=route
  const go=path=>{if(root.isConnected)navigate(path)}
  const refresh=()=>go(boundRoute)
  async function run(action){
   if(busy)return;busy=true
   root.setAttribute('aria-busy','true');root.querySelectorAll('button,input,select').forEach(node=>{node.dataset.wasDisabled=node.disabled?'true':'false';node.disabled=true})
   const status=root.querySelector('.cq-feedback');if(status)status.textContent='Guardando…'
   try{await action()}
   catch(error){if(status)status.textContent=error.message;toast(error.message)}
   finally{busy=false;if(root.isConnected){root.removeAttribute('aria-busy');root.querySelectorAll('button,input,select').forEach(node=>{node.disabled=node.dataset.wasDisabled==='true';delete node.dataset.wasDisabled})}}
  }
  root.onclick=event=>{
   const target=event.target.closest('[data-cq-action]');if(!target||target.disabled)return
   event.stopPropagation()
   const action=target.dataset.cqAction
   if(action==='canton'){go(base+'/canton/'+target.dataset.code);return}
   if(action==='zoom'){const window=root.querySelector('.cq-map-window'),zoom=window.classList.toggle('is-zoomed');target.setAttribute('aria-pressed',String(zoom));target.setAttribute('aria-label',zoom?'Reducir mapa':'Ampliar mapa');target.innerHTML=zoom?'− <span>Reducir mapa</span>':'＋ <span>Ampliar mapa</span>';return}
   if(action==='share-battle'){
    const url=location.origin+base+'/batalla/'+boundBattle.id
    if(navigator.share)navigator.share({title:'Te reto por '+CANTONES[boundBattle.canton],text:'Tu batalla de Suizamente Conquista',url}).catch(error=>{if(error.name!=='AbortError')toast('Puedes copiar el enlace desde la barra de direcciones.')})
    else navigator.clipboard.writeText(url).then(()=>toast('Enlace del desafío copiado.')).catch(()=>toast('Comparte este enlace: '+url))
    return
   }
   run(async()=>{
    if(action==='buy'){data=await mutate('/shop',{ventaja:target.dataset.code});toast('Ventaja guardada en tu mochila.');refresh()}
    if(action==='read-notices'){await mutate('/notices/read');refresh()}
    if(action==='enable'){await mutate('/settings',{competitivo:true},'PUT');refresh()}
    if(action==='answer'){await mutate('/rounds/'+boundRound.id+'/answer',{pregunta:boundRound.pregunta.id,opcion:Number(target.dataset.option)});refresh()}
    if(action==='hint'){await mutate('/rounds/'+boundRound.id+'/advantage',{pregunta:boundRound.pregunta.id,ventaja:'cincuenta'});refresh()}
    if(action==='abandon'){
     if(!root.querySelector('[data-confirm-abandon]')){target.insertAdjacentHTML('afterend',`<div class="cq-cost" data-confirm-abandon><p>El intento se cerrará y no se devolverá su coste.</p>${button('Sí, abandonar',attributes('confirm-abandon'),true)}</div>`);return}
    }
    if(action==='confirm-abandon'){await mutate('/rounds/'+boundRound.id+'/abandon');refresh()}
    if(action==='reject'){await mutate('/battles/'+boundBattle.id+'/reject');go(base+'/batallas')}
    if(action==='refresh')refresh()
   })
  }
  root.onkeydown=event=>{if(event.target.matches('.cq-land')&&['Enter',' '].includes(event.key)){event.preventDefault();event.target.dispatchEvent(new window.MouseEvent('click',{bubbles:true}))}}
  const selector=root.querySelector('[data-cq-select]');if(selector)selector.onchange=()=>{if(selector.value)navigate(base+'/canton/'+selector.value)}
  const competition=root.querySelector('[data-cq-competition]');if(competition)competition.onchange=()=>{const value=competition.checked;run(async()=>{await mutate('/settings',{competitivo:value},'PUT');refresh()})}
  const friend=root.querySelector('[data-cq-friend]');if(friend)friend.onchange=()=>go(base+'/retar?amigo='+friend.value)
  for(const form of root.querySelectorAll('[data-cq-form]')){
   form.onchange=event=>{if(event.target.name==='ventajas'&&form.querySelectorAll('[name=ventajas]:checked').length>2){event.target.checked=false;toast('Puedes equipar como máximo dos ventajas.')}}
   form.onsubmit=event=>{
    event.preventDefault();event.stopPropagation()
    const values=new FormData(form),ventajas=values.getAll('ventajas')
    run(async()=>{
     if(form.dataset.cqForm==='start'){const created=await mutate('/rounds',{canton:values.get('canton'),ventajas});go(base+'/partida/'+created.id)}
     if(form.dataset.cqForm==='battle'){const created=await mutate('/battles',{canton:values.get('objetivo'),defensor:values.get('defensor'),ventajas});go(base+'/batalla/'+created.id)}
     if(form.dataset.cqForm==='accept'){const accepted=await mutate('/battles/'+boundBattle.id+'/accept',{ventajas});go(base+'/batalla/'+accepted.id)}
    })
   }
  }
 }
 return {render,bind}
}
