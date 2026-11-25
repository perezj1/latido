(async () => {
let RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const app = $('#app'), layer = $('#layer');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CONFIG = Object.assign({ api: '/api/suizamente', jugadorId: null, datos: '/suizamente/data/preguntas.json', ronda: 10 }, window.SUIZAMENTE_CONFIG || {});
const identidad = await identidadLatido();
const {separarDatos}=await import('/suizamente/datos-opciones.js');
const {compartirHistoria}=await import('/suizamente/historia.js');
const demo=identidad.experience&&CONFIG.experiencia!==false?await import('/suizamente/demostracion.js'):null;
let experiencia = null, arrancando = true;
if (identidad.api && !window.SUIZAMENTE_CONFIG?.api) CONFIG.api = identidad.api;
const CLAVE = identidad.userId ? 'suizamente:v1:' + identidad.userId : 'suizamente:v1';
const TEMAS = ['t-red', 't-blue', 't-orange', 't-sea', 't-sky', 't-mint'];
const MODOS = {
  dilemas:   { nombre: '¿Qué prefieres?',        emoji: '🤔', desc: 'Dilemas suizos sin respuesta mala.', filtro: q => q.tipo === 'dilema' && q.opciones.length === 2 },
  preguntas: { nombre: 'Preguntas y respuestas', emoji: '🕵️', desc: 'Solo una respuesta es verdad.', filtro: q => q.tipo === 'real' },
  mix:       { nombre: 'Mix',                    emoji: '🎲', desc: 'Dilemas y preguntas mezclados.', filtro: q => MODOS.dilemas.filtro(q) || MODOS.preguntas.filtro(q) }
};
let PREG = [];
const tema = q => TEMAS[[...q.id].reduce((a, c) => a + c.charCodeAt(0), 0) % TEMAS.length];
const pregunta = id => PREG.find(x => x.id === id);

/* Logo circular de Suizamente. */
function logo() { return '<img class="logo beat" src="/suizamente/icons/suizamente-circle-logo-512.png" width="112" height="112" alt="Suizamente">'; }

/* ---------- respuestas propias (en este dispositivo) ---------- */
let local = { resp: {} };
try {
  const t = localStorage.getItem(CLAVE) || (!identidad.userId && localStorage.getItem('fondue-o-raclette:v1'));
  if (t) local = { resp: {}, ...JSON.parse(t) };
  if (!local.resp || typeof local.resp !== 'object' || Array.isArray(local.resp)) local.resp = {};
} catch (_) { }
const guardarLocal = () => { try { localStorage.setItem(CLAVE, JSON.stringify(local)); } catch (_) { } };
const misVotos = () => Object.fromEntries(Object.entries(local.resp).map(([q, v]) => [q, v.o]));
const recuperar = mapa => { let cambio = false; for (const [q, o] of Object.entries(mapa || {})) if (pregunta(q) && Number.isInteger(o) && o >= 0 && o < pregunta(q).opciones.length && local.resp[q]?.o !== o) { local.resp[q] = { o, t:Date.now() }; cambio = true; } if (cambio) guardarLocal(); };

/* =====================  PROVEEDOR DE VOTOS  =====================
   votos.js implementa la misma interfaz de la referencia:
     iniciar({alCambiar, misVotos, recuperar})  → empieza a cargar los recuentos
     estado        'cargando' | 'ok' | 'lento' | 'sin' | 'error'
     puedeVotar    boolean
     conteo(id)    → [n0, n1, n2] votos por opción (índice ORIGINAL del JSON), incluido el tuyo
     votar(id, opcion)
   API de Latido o, sin servidor, solo tu elección sin porcentajes. */
function idAnonimo() {
  try {
    let id = localStorage.getItem('suizamente:jugador');
    if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)); localStorage.setItem('suizamente:jugador', id); }
    return id;
  } catch (_) { return null; }
}
const jugadorAnonimo = CONFIG.jugadorId || idAnonimo();
const Votos = CONFIG.api ? votosApi(CONFIG.api, jugadorAnonimo, {
  socialApi:()=>experiencia?.online?identidad.socialApi:null,
  onAnswer:data=>experiencia?.answer(data),
  account:identidad.userId||jugadorAnonimo,
}) : { estado:"sin", puedeVotar:false, conteo:()=>[0,0,0], votar(){}, iniciar(c){c.alCambiar();} };

function reparto(q,{ejemplos=true}={}) {
  const n = Votos.conteo(q.id).slice(0, q.opciones.length).map(v => v || 0);
  const total = n.reduce((a, b) => a + b, 0);
  if(ejemplos&&demo&&Votos.estado==='ok'){
    const rep=demo.repartoDemo(q,n);
    return {...rep,pct:rep.n.map(v=>rep.total?Math.round(v/rep.total*100):0)};
  }
  return { n, total, pct: n.map(v => total ? Math.round(v / total * 100) : 0) };
}
function textoNota() {
  const e = Votos.estado;
  if (e === 'ok' && Votos.puedeVotar) return 'Tus votos cuentan para los porcentajes de la comunidad.';
  if (e === 'ok') return 'Ves los porcentajes de la comunidad, pero tus votos no se suman desde esta cuenta.';
  if (e === 'cargando') return 'Conectando con los votos de la comunidad…';
  if (e === 'lento') return 'Los votos de la comunidad tardan en llegar. Puedes jugar igual.';
  return 'Ahora mismo no se pueden cargar los votos de la comunidad: verás tu elección y el dato, pero no los porcentajes.';
}
function alCambiar() { if(arrancando)return; if (!ronda && PREG.length) { pintarInicio(); return; } const n = $('#nota'); if (n) n.textContent = textoNota(); refrescarResultado(); }

/* ---------- ronda ---------- */
let ronda = null, resultadoAbierto = null, modoActual = 'mix', eligiendo = false, revealTimer;
const mezcla = a => { const copy = a.slice(); for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy; };
function nuevaRonda(modo = modoActual, opciones = {}) {
  modoActual = modo;
  const pool = PREG.filter(q=>MODOS[modo].filtro(q)&&(!opciones.tema||q.tema===opciones.tema));
  const priorizar = preguntas => [...mezcla(preguntas.filter(q => !local.resp[q.id])), ...mezcla(preguntas.filter(q => local.resp[q.id]))];
  let elegidas;
  if (modo === 'mix') {
    const colas = [priorizar(pool.filter(MODOS.dilemas.filtro)), priorizar(pool.filter(MODOS.preguntas.filtro))];
    elegidas = [];
    for (let i = 0; i < Math.min(CONFIG.ronda, pool.length); i++) {
      const cola = colas[i % 2].length ? colas[i % 2] : colas[(i + 1) % 2];
      elegidas.push(cola.shift());
    }
    elegidas = priorizar(elegidas);
  } else elegidas = priorizar(pool).slice(0, CONFIG.ronda);
  const ids = opciones.ids ? opciones.ids.filter(id=>pregunta(id)&&MODOS.mix.filtro(pregunta(id))) : elegidas.map(q => q.id);
  if(!ids.length){if(experiencia)experiencia.exit();return;}
  const orden = {}; for (const id of ids) orden[id] = pregunta(id).opciones.length===2&&pregunta(id).opciones[0].t==='Verdad'&&pregunta(id).opciones[1].t==='Mito'?[0,1]:mezcla(pregunta(id).opciones.map((_, i) => i));
  ronda = { modo, ids, i: 0, orden, marcas: [], res: [], contexto:opciones.contexto||null };
  experiencia?.resetRound();
  pintarPregunta();
  if(opciones.verResultado&&ids.length===1&&local.resp[ids[0]]){
    const q=pregunta(ids[0]),o=local.resp[q.id].o;
    ronda.marcas[0]=q.tipo==='real'?(o===q.correcta?'ok':'ko'):'op';
    ronda.res[0]={id:q.id,o,real:q.tipo==='real',acierto:q.tipo==='real'?o===q.correcta:null};
    abrirResultado(q,o,{x:innerWidth/2,y:innerHeight/2},true);
  }
}

/* ---------- pantallas ---------- */
function pintarInicio() {
  app.classList.remove('playing');
  ronda = null; cerrarResultado();
  if(experiencia){experiencia.render();return;}
  const jugables = PREG.filter(MODOS.mix.filtro);
  const reales = PREG.filter(q => q.tipo === 'real' && local.resp[q.id]);
  const ok = reales.filter(q => local.resp[q.id].o === q.correcta).length;
  const tarjeta = m => `<button class="mode m-${m}" type="button" data-modo="${m}">
      ${m === 'mix' ? `<span class="row"><span class="em">${MODOS[m].emoji}</span><span><b>${MODOS[m].nombre}</b><br><span class="d">${MODOS[m].desc}</span></span></span>`
                    : `<span class="em">${MODOS[m].emoji}</span><b>${MODOS[m].nombre}</b><span class="d">${MODOS[m].desc}</span>`}
      <span class="go"><i>Jugar</i></span></button>`;
  app.innerHTML = `<section class="home">
    <div class="hero">
      <div class="lg">${logo()}</div>
      <h1 class="title"><span class="a">Suiza</span><span class="b">mente</span></h1>
      <p class="kicker">Un juego de latido.ch</p>
      <p class="lead">Elige, mira qué eligió la comunidad y aprende algo de Suiza en cada pregunta.</p>
    </div>
    <div class="modes" role="group" aria-label="Modos de juego">${tarjeta('dilemas')}${tarjeta('preguntas')}${tarjeta('mix')}</div>
    <div class="stats-row">
      <div class="stat"><b>${jugables.filter(q => local.resp[q.id]).length}</b><span>de ${jugables.length}</span></div>
      <div class="stat"><b>${reales.length ? Math.round(ok / reales.length * 100) : 0}%</b><span>Aciertos</span></div>
      <div class="stat"><b>${ok}</b><span>Verdades</span></div>
    </div>
    <p class="note" id="nota">${esc(textoNota())}</p>
    <p class="foot">Suizamente · <a href="https://latido.ch" target="_blank" rel="noopener">latido.ch</a></p>
    ${identidad.app === 'standalone' ? `<nav class="host-actions" aria-label="Aplicación"><a href="/cuenta" target="_top">${identidad.userId ? 'Tu cuenta' : 'Iniciar sesión'}</a><a href="/instalar" target="_top">Instalar app</a></nav>` : ''}
  </section>`;
  app.querySelectorAll('.mode').forEach(b => b.onclick = () => nuevaRonda(b.dataset.modo));
  window.scrollTo({ top: 0 });
}

function pintarPregunta() {
  app.classList.add('playing');
  const id = ronda.ids[ronda.i], q = pregunta(id), real = q.tipo === 'real';
  const prog = ronda.ids.map((_, i) => `<i class="${ronda.marcas[i] || (i === ronda.i ? 'now' : '')}"></i>`).join('');
  const ops = ronda.orden[id].map((oi, k) => `<button class="opt o${k + 1}${real?' answer':''}" type="button" data-o="${oi}">${real?'':`<span class="oe" aria-hidden="true">${q.opciones[oi].e}</span>`}<span class="ot">${esc(q.opciones[oi].t)}</span></button>`);
  app.innerHTML = `<div class="bar">
      <button class="icon-btn" id="salir" type="button" aria-label="Volver al inicio">×</button>
      <div class="prog" aria-label="Pregunta ${ronda.i + 1} de ${ronda.ids.length}">${prog}</div>
      <button class="skip" id="saltar" type="button">Saltar →</button>
    </div>
    <section class="question ${tema(q)} in">
      <div class="bubble"><span class="q-em" aria-hidden="true">${q.emoji}</span>
        <span class="kind">${real ? '🕵️ Solo una es verdad' : '🤔 ¿Qué prefieres?'}</span>
        <h2 class="q">${esc(q.pregunta)}</h2></div>
      ${experiencia?.authors[q.id]?`<p class="social-credit">Propuesta por ${esc(experiencia.authors[q.id])}</p>`:''}
      <div class="opts${q.opciones.length === 2 ? ' with-or' : ''}">${q.opciones.length === 2 ? ops.join('<span class="vs" aria-hidden="true">O</span>') : ops.join('')}</div>
    </section>`;
  $('#salir').onclick = () => experiencia?experiencia.exit():pintarInicio();
  $('#saltar').onclick = () => { ronda.marcas[ronda.i] = 'sk'; siguiente(); };
  app.querySelectorAll('.opt').forEach(b => b.onclick = () => elegir(q, +b.dataset.o, b));
  window.scrollTo({ top: 0 });
}

function elegir(q, o, boton) {
  if (resultadoAbierto || eligiendo) return;
  eligiendo = true;
  const repetida = !!local.resp[q.id];
  if (!repetida) { local.resp[q.id] = { o, t: Date.now() }; guardarLocal(); }
  if(!repetida||ronda.contexto)Votos.votar(q.id,o,ronda.contexto);
  experiencia?.choose();
  boton.classList.add('picked');
  app.querySelectorAll('.opt, #saltar').forEach(b => b.disabled = true);
  const real = q.tipo === 'real', rep = reparto(q,{ejemplos:false});
  ronda.marcas[ronda.i] = real ? (o === q.correcta ? 'ok' : 'ko') : 'op';
  ronda.res[ronda.i] = { id: q.id, o, real, acierto: real ? o === q.correcta : null, conMayoria: rep.total > 1 && rep.n[o] === Math.max(...rep.n) };
  const r = boton.getBoundingClientRect();
  revealTimer = setTimeout(() => abrirResultado(q, o, { x: r.left + r.width / 2, y: r.top + r.height / 2 }, repetida), RM ? 0 : 160);
}

function abrirResultado(q, o, punto, repetida) {
  const real = q.tipo === 'real', acierto = real && o === q.correcta, ultima = ronda.i + 1 >= ronda.ids.length;
  eligiendo = false;
  app.inert = true;
  resultadoAbierto = { q, o, repetida };
  layer.innerHTML = `<div class="reveal ${tema(q)} ${RM ? '' : 'anim'}" id="reveal" role="dialog" aria-modal="true" aria-label="Resultado" style="--x:${punto.x}px;--y:${punto.y}px">
    <div class="rv">
      <div class="rv-top">
        <div class="rv-em" aria-hidden="true">${real ? (acierto ? '🎉' : '🙈') : q.opciones[o].e}</div>
        <h2 class="rv-h" id="rv-h"></h2>
        <p class="rv-sub" id="rv-sub" aria-live="polite"></p>
      </div>
      <div class="panel rise" style="animation-delay:.15s">
        <h3>Lo que eligió la comunidad</h3>
        <div id="reparto" style="display:flex;flex-direction:column;gap:20px"></div><div id="dato-comun"></div>
        <p class="votes" id="votos"></p>
      </div>
      <div class="row2">
        <button class="btn light" id="sig" type="button">${ultima ? 'Ver resumen' : 'Siguiente'} →</button>
        <button class="btn line" id="compartir" type="button">Compartir</button>
      </div>
      <p class="copymsg" id="copymsg" aria-live="polite"></p>
    </div></div>`;
  refrescarResultado();
  $('#sig').onclick = siguiente;
  $('#compartir').onclick = () => compartirImagen({titulo:'Suizamente',pregunta:q,conteos:reparto(q).n,eleccion:o,enlace:'https://suizamente.latido.ch/jugar?p='+encodeURIComponent(q.id)},$('#copymsg'));
  experiencia?.decorateResult(q,o,{repetida,contexto:ronda.contexto});
  try { $('#sig').focus({ preventScroll: true }); } catch (_) { }
}
function refrescarResultado() {
  if (!resultadoAbierto) return;
  const { q, o, repetida } = resultadoAbierto, real = q.tipo === 'real', acierto = real && o === q.correcta;
  const rep = reparto(q), hayDatos = Votos.estado === 'ok' && rep.total > 0;
  const h = $('#rv-h'), sub = $('#rv-sub'); if (!h) return;
  if (real) {
    h.textContent = acierto ? '¡Correcto!' : 'Casi…';
    sub.textContent = (acierto ? '' : `La verdadera era «${q.opciones[q.correcta].t}». `) + (hayDatos ? (rep.total < 2 ? 'Eres la primera persona en responder.' : `Lo sabía el ${rep.pct[q.correcta]} % de la comunidad.`) : '');
  } else if (!hayDatos) {
    h.textContent = 'Buena elección'; sub.textContent = '';
  } else if (rep.total < 2) {
    h.textContent = '¡Primer voto!'; sub.textContent = 'Eres la primera persona en votar esta pregunta.';
  } else {
    h.textContent = `Coincides con el ${rep.pct[o]} %`;
    sub.textContent = rep.n[o] === Math.max(...rep.n) ? 'Piensas como la mayoría de Latido.' : 'Eres de la minoría valiente.';
  }
  if (repetida) sub.textContent += ' (Ya la habías respondido: cuenta tu primer voto.)';
  const ordenOpciones = ronda ? ronda.orden[q.id] : q.opciones.map((_, i) => i);
  const orden = [o, ...ordenOpciones.filter(oi => oi !== o)];
  const {opciones:datos,comun}=separarDatos(q);
  $('#reparto').innerHTML = orden.map(oi => {
    const elegida = oi === o;
    const verdadera = real && oi === q.correcta ? '<div class="tags"><span class="tag true">✓ La verdadera</span></div>' : '';
    const dato = datos[oi] ? `<div class="answer-fact"><b><span aria-hidden="true">💡</span> ¿Sabías que…?</b><p>${esc(datos[oi])}</p></div>` : '';
    return `<div class="res o${ordenOpciones.indexOf(oi) + 1}${elegida ? ' is-picked' : ''}">${elegida ? '<span class="tag mine">Tu elección</span>' : ''}<div class="res-top"><span class="res-t">${real?'':q.opciones[oi].e+' '}${esc(q.opciones[oi].t)}</span><span class="res-p" data-p="${hayDatos ? rep.pct[oi] : ''}">${hayDatos ? rep.pct[oi] + '%' : '—'}</span></div>
      <div class="res-bar"><i style="width:${hayDatos ? rep.pct[oi] : 0}%" data-w="${hayDatos ? rep.pct[oi] : 0}"></i></div>${verdadera}${dato}</div>`;
  }).join('');
  $('#dato-comun').innerHTML=comun?`<div class="answer-fact s-common-fact"><b><span aria-hidden="true">💡</span> Sobre este dilema</b><p>${esc(comun)}</p></div>`:'';
  $('#votos').textContent = hayDatos ? `${rep.total.toLocaleString('es-ES')} ${rep.total === 1 ? 'voto' : 'votos'}` : textoNota();
  experiencia?.decorateFacts(q,o);
}
function cerrarResultado() { clearTimeout(revealTimer); eligiendo = false; app.inert = false; resultadoAbierto = null; layer.innerHTML = ''; }
function siguiente() {
  cerrarResultado();
  if (!ronda) return pintarInicio();
  ronda.i++;
  if (ronda.i >= ronda.ids.length) return pintarFinal();
  pintarPregunta();
}

function pintarFinal() {
  app.classList.remove('playing');
  const res = ronda.res.filter(Boolean), reales = res.filter(r => r.real), dilemas = res.filter(r => !r.real);
  const ok = reales.filter(r => r.acierto).length, mayoria = dilemas.filter(r => { const rep = reparto(pregunta(r.id),{ejemplos:false}); return Votos.estado === 'ok' && rep.total > 1 && rep.n[r.o] === Math.max(...rep.n); }).length;
  const marcas={ok:['✓','Acierto'],ko:['✕','Fallo'],op:['🤔','Dilema'],sk:['⏭️','Saltada']};
  const cuadros = ronda.ids.map((_,i)=>{const mark=ronda.marcas[i]||'sk';return `<span class="s-round-cell ${mark}" aria-label="Pregunta ${i+1}: ${marcas[mark][1]}">${marcas[mark][0]}</span>`}).join('');
  const frase='¡Ronda terminada!';
  const cajas = `<div><b>${ok} de ${reales.length}</b><span>🎯 Aciertos</span></div><div><b>${mayoria} de ${dilemas.length}</b><span>🤝 Como la mayoría</span></div><div><b id="round-points">+${experiencia?.roundPoints||0}</b><span>⭐ Puntos</span></div>`;
  app.innerHTML = `<section class="done">
    <button class="icon-btn s-round-close" id="cerrar-ronda" type="button" aria-label="Volver al inicio">✕</button>
    <header><h1>${frase}</h1><p>Hoy te llevas ${res.length} ${res.length===1?'dato nuevo':'datos nuevos'} sobre Suiza.</p></header>
    <div class="squares" aria-label="Resumen de la ronda">${cuadros}</div><div class="s-round-legend">${Object.entries(marcas).map(([id,[,label]])=>`<span><i class="${id}"></i>${label}</span>`).join('')}</div>
    <div class="score">${cajas}</div>
    <div class="s-round-actions"><button class="btn s-round-primary" id="otra" type="button">Otra ronda</button>
    <div class="row2"><button class="btn s-round-secondary" id="comp" type="button">📤 Compartir</button><button class="btn s-round-secondary" id="inicio" type="button">Inicio</button></div></div>
    <p class="copymsg" id="copymsg" aria-live="polite"></p>
  </section>`;
  $('#otra').onclick = () => nuevaRonda(ronda.modo);
  $('#inicio').onclick = () => experiencia?experiencia.navigate('/'):pintarInicio();
  $('#cerrar-ronda').onclick=$('#inicio').onclick;
  experiencia?.decorateSummary();
  const lineas = [reales.length ? `Verdades: ${ok}/${reales.length}` : '', dilemas.length ? `Como la mayoría: ${mayoria}/${dilemas.length}` : ''].filter(Boolean).join(' · ');
  const texto=`Suizamente · ${MODOS[ronda.modo].nombre}\n${ronda.ids.map((_,i)=>marcas[ronda.marcas[i]||'sk'][0]).join(' ')}\n${lineas}\n¿Cuánto sabes de Suiza? Juega en https://suizamente.latido.ch`;
  $('#comp').onclick = () => experiencia?experiencia.shareSummary({modo:ronda.modo,texto,titulo:frase,resultado:lineas||'Ronda completada.'}):compartirImagen({titulo:frase,subtitulo:lineas||'Ronda completada.'},$('#copymsg'));
  window.scrollTo({ top: 0 });
}

/* ---------- compartir ---------- */
async function compartirImagen(options,msg) {
  try{msg.textContent=await compartirHistoria(options)}catch{msg.textContent='No se ha podido preparar la imagen. Vuelve a intentarlo.'}
}

/* ---------- teclado: 1-4 elige, Esc o Enter pasa ---------- */
document.addEventListener('keydown', e => {
  if(experiencia?.sharing)return;
  if (resultadoAbierto && e.key === 'Tab') {
    const controls = [...layer.querySelectorAll('button, textarea')];
    const edge = e.shiftKey ? controls[0] : controls.at(-1);
    if (document.activeElement === edge) { e.preventDefault(); (e.shiftKey ? controls.at(-1) : controls[0]).focus(); }
    return;
  }
  if (resultadoAbierto && e.key === 'Escape') { e.preventDefault(); siguiente(); return; }
  if (!resultadoAbierto && ronda && /^[1-4]$/.test(e.key)) { const b = app.querySelectorAll('.opt')[+e.key - 1]; if (b) b.click(); }
});

/* ---------- arranque ---------- */
/* Si las preguntas vienen dentro de la página (<script type="application/json" id="preguntas-embebidas">), se usan;
   si no, se cargan de CONFIG.datos (data/preguntas.json). */
const embebidas = document.getElementById('preguntas-embebidas');
(embebidas ? Promise.resolve(JSON.parse(embebidas.textContent)) : fetch(CONFIG.datos).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })).then(async d => {
  PREG = d.preguntas || [];
  for (const [id, value] of Object.entries(local.resp)) {
    const q = pregunta(id);
    if (!q || !Number.isInteger(value?.o) || value.o < 0 || value.o >= q.opciones.length) delete local.resp[id];
  }
  if(identidad.experience&&CONFIG.experiencia!==false){
    const {crearExperiencia}=await import('/suizamente/experiencia.js');
    experiencia=await crearExperiencia({container:app,questions:PREG,identity:identidad,getIdentity:identidadLatido,playerId:jugadorAnonimo,
      play:({modo,...opciones})=>nuevaRonda(modo,opciones),stopGame:()=>{ronda=null;cerrarResultado();app.classList.remove('playing');},
      getCounts:id=>Votos.conteo(id),getDisplayCounts:id=>reparto(pregunta(id)),getSaved:()=>local.resp,getRound:()=>ronda?{modo:ronda.modo,ids:ronda.ids.slice()}:null,
      importAnswers:respuestas=>{for(const [id,r]of Object.entries(respuestas))if(!local.resp[id]&&pregunta(id)&&Number.isInteger(r?.o)&&r.o>=0&&r.o<pregunta(id).opciones.length)local.resp[id]=r;guardarLocal();},
      onSettings:prefs=>{RM=matchMedia('(prefers-reduced-motion: reduce)').matches||!!prefs.menosAnimaciones;},
    });
  }
  arrancando=false;pintarInicio();
  Votos.iniciar({ alCambiar, misVotos, recuperar });
}).catch(() => {
  app.innerHTML = `<div class="loading"><div class="lg">${logo()}</div><p class="big">No se han podido cargar las preguntas</p><p class="note">Si abriste el archivo directamente desde el ordenador, sírvelo con un servidor local (lo explica INTEGRACION.md).</p></div>`;
});
})();
