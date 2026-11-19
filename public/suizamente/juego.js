(async () => {
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const app = $('#app'), layer = $('#layer');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CONFIG = Object.assign({ api: '/api/suizamente', jugadorId: null, datos: '/suizamente/data/preguntas.json', ronda: 10 }, window.SUIZAMENTE_CONFIG || {});
const identidad = await identidadLatido();
if (identidad.api && !window.SUIZAMENTE_CONFIG?.api) CONFIG.api = identidad.api;
const CLAVE = identidad.userId ? 'suizamente:v1:' + identidad.userId : 'suizamente:v1';
const TEMAS = ['t-red', 't-blue', 't-orange', 't-sea', 't-sky', 't-mint'];
const MODOS = {
  dilemas:   { nombre: '¿Qué prefieres?',        emoji: '🤔', desc: 'Dilemas suizos sin respuesta mala. ¿Piensas como la mayoría?', filtro: q => q.tipo === 'dilema' },
  preguntas: { nombre: 'Preguntas y respuestas', emoji: '🕵️', desc: 'Situaciones reales: solo una respuesta es verdad. ¿Cuánta gente lo sabe?', filtro: q => q.tipo === 'real' },
  mix:       { nombre: 'Mix',                    emoji: '🎲', desc: 'Un poco de todo: dilemas y preguntas mezclados.', filtro: () => true }
};
let PREG = [];
const tema = q => TEMAS[[...q.id].reduce((a, c) => a + c.charCodeAt(0), 0) % TEMAS.length];
const pregunta = id => PREG.find(x => x.id === id);

/* Logo oficial que ya utiliza Latido en la portada. */
function logo() { return '<img class="logo beat" src="/favicon.svg" width="112" height="112" alt="Latido">'; }

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
const Votos = CONFIG.api ? votosApi(CONFIG.api, CONFIG.jugadorId || idAnonimo()) : { estado:"sin", puedeVotar:false, conteo:()=>[0,0,0], votar(){}, iniciar(c){c.alCambiar();} };

function reparto(q) {
  const n = Votos.conteo(q.id).slice(0, q.opciones.length).map(v => v || 0);
  const total = n.reduce((a, b) => a + b, 0);
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
function alCambiar() { if (!ronda && PREG.length) { pintarInicio(); return; } const n = $('#nota'); if (n) n.textContent = textoNota(); refrescarResultado(); }

/* ---------- ronda ---------- */
let ronda = null, resultadoAbierto = null, modoActual = 'mix', eligiendo = false, revealTimer;
const mezcla = a => { const copy = a.slice(); for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy; };
function nuevaRonda(modo = modoActual) {
  modoActual = modo;
  const pool = PREG.filter(MODOS[modo].filtro);
  const sin = pool.filter(q => !local.resp[q.id]), con = pool.filter(q => local.resp[q.id]);
  const ids = [...mezcla(sin), ...mezcla(con)].slice(0, CONFIG.ronda).map(q => q.id);
  const orden = {}; for (const id of ids) orden[id] = mezcla(pregunta(id).opciones.map((_, i) => i));
  ronda = { modo, ids, i: 0, orden, marcas: [], res: [] };
  pintarPregunta();
}

/* ---------- pantallas ---------- */
function pintarInicio() {
  ronda = null; cerrarResultado();
  const cuenta = m => { const p = PREG.filter(MODOS[m].filtro); return `${p.filter(q => local.resp[q.id]).length}/${p.length}`; };
  const reales = PREG.filter(q => q.tipo === 'real' && local.resp[q.id]);
  const ok = reales.filter(q => local.resp[q.id].o === q.correcta).length;
  const tarjeta = m => `<button class="mode m-${m}" type="button" data-modo="${m}">
      ${m === 'mix' ? `<span class="row"><span class="em">${MODOS[m].emoji}</span><span><b>${MODOS[m].nombre}</b><br><span class="d">${MODOS[m].desc}</span></span></span>`
                    : `<span class="em">${MODOS[m].emoji}</span><b>${MODOS[m].nombre}</b><span class="d">${MODOS[m].desc}</span>`}
      <span class="go"><span>${cuenta(m)} respondidas</span><i>Jugar →</i></span></button>`;
  app.innerHTML = `<section class="home">
    <div class="hero">
      <div class="lg">${logo()}</div>
      <p class="kicker">Un juego de Latido</p>
      <h1 class="title"><span class="a">Suiza</span><span class="b">mente</span></h1>
      <p class="lead">Elige, mira qué eligió la comunidad y aprende algo de Suiza en cada pregunta.</p>
    </div>
    <div class="modes" role="group" aria-label="Modos de juego">${tarjeta('dilemas')}${tarjeta('preguntas')}${tarjeta('mix')}</div>
    <div class="stats-row">
      <div class="stat"><b>${Object.keys(local.resp).filter(pregunta).length}</b><span>de ${PREG.length}</span></div>
      <div class="stat"><b>${reales.length ? Math.round(ok / reales.length * 100) : 0}%</b><span>Aciertos</span></div>
      <div class="stat"><b>${ok}</b><span>Verdades</span></div>
    </div>
    <p class="note" id="nota">${esc(textoNota())}</p>
    <p class="foot">Suizamente · <a href="https://latido.ch" target="_blank" rel="noopener">latido.ch</a></p>
  </section>`;
  app.querySelectorAll('.mode').forEach(b => b.onclick = () => nuevaRonda(b.dataset.modo));
  window.scrollTo({ top: 0 });
}

function pintarPregunta() {
  const id = ronda.ids[ronda.i], q = pregunta(id), real = q.tipo === 'real';
  const prog = ronda.ids.map((_, i) => `<i class="${ronda.marcas[i] || (i === ronda.i ? 'now' : '')}"></i>`).join('');
  const ops = ronda.orden[id].map((oi, k) => `<button class="opt o${k + 1}" type="button" data-o="${oi}"><span class="oe" aria-hidden="true">${q.opciones[oi].e}</span><span class="ot">${esc(q.opciones[oi].t)}</span></button>`);
  app.innerHTML = `<div class="bar">
      <button class="icon-btn" id="salir" type="button" aria-label="Volver al inicio">×</button>
      <div class="prog" aria-label="Pregunta ${ronda.i + 1} de ${ronda.ids.length}">${prog}</div>
      <button class="skip" id="saltar" type="button">Saltar →</button>
    </div>
    <section class="${tema(q)} in" style="display:flex;flex-direction:column;gap:12px">
      <div class="bubble"><span class="q-em" aria-hidden="true">${q.emoji}</span>
        <span class="kind">${real ? '🕵️ Solo una es verdad' : '🤔 ¿Qué prefieres?'}</span>
        <h2 class="q">${esc(q.pregunta)}</h2></div>
      <div class="opts">${q.opciones.length === 2 ? ops.join('<span class="vs" aria-hidden="true">o</span>') : ops.join('')}</div>
    </section>`;
  $('#salir').onclick = pintarInicio;
  $('#saltar').onclick = () => { ronda.marcas[ronda.i] = 'sk'; siguiente(); };
  app.querySelectorAll('.opt').forEach(b => b.onclick = () => elegir(q, +b.dataset.o, b));
  window.scrollTo({ top: 0 });
}

function elegir(q, o, boton) {
  if (resultadoAbierto || eligiendo) return;
  eligiendo = true;
  const repetida = !!local.resp[q.id];
  if (!repetida) { local.resp[q.id] = { o, t: Date.now() }; guardarLocal(); Votos.votar(q.id, o); }
  boton.classList.add('picked');
  app.querySelectorAll('.opt, #saltar').forEach(b => b.disabled = true);
  const real = q.tipo === 'real', rep = reparto(q);
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
        <div id="reparto" style="display:flex;flex-direction:column;gap:14px"></div>
        <p class="votes" id="votos"></p>
      </div>
      <div class="panel rise" style="animation-delay:.3s">
        <div class="fact"><span class="fe" aria-hidden="true">💡</span><p><b>¿Sabías que…?</b>${esc(q.dato)}</p></div>
      </div>
      <div class="row2">
        <button class="btn light" id="sig" type="button">${ultima ? 'Ver resumen' : 'Siguiente'} →</button>
        <button class="btn line" id="compartir" type="button">Compartir</button>
      </div>
      <p class="copymsg" id="copymsg" aria-live="polite"></p>
    </div></div>`;
  refrescarResultado(true);
  $('#sig').onclick = siguiente;
  $('#compartir').onclick = () => copiar(textoPregunta(q), $('#copymsg'));
  try { $('#sig').focus({ preventScroll: true }); } catch (_) { }
}
function refrescarResultado(primera = false) {
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
  const orden = ronda ? ronda.orden[q.id] : q.opciones.map((_, i) => i);
  const anima = primera && !RM;
  $('#reparto').innerHTML = orden.map((oi, k) => {
    const tags = [oi === o ? '<span class="tag mine">Tu elección</span>' : '', real && oi === q.correcta ? '<span class="tag true">✓ La verdadera</span>' : ''].join('');
    return `<div class="res o${k + 1}"><div class="res-top"><span class="res-t">${q.opciones[oi].e} ${esc(q.opciones[oi].t)}</span><span class="res-p" data-p="${hayDatos ? rep.pct[oi] : ''}">${hayDatos ? (anima ? 0 : rep.pct[oi]) + '%' : '—'}</span></div>
      <div class="res-bar"><i style="width:${anima ? 0 : (hayDatos ? rep.pct[oi] : 0)}%" data-w="${hayDatos ? rep.pct[oi] : 0}"></i></div>${tags ? `<div class="tags">${tags}</div>` : ''}</div>`;
  }).join('');
  $('#votos').textContent = hayDatos ? `${rep.total.toLocaleString('es-ES')} ${rep.total === 1 ? 'voto' : 'votos'}` : textoNota();
  if (anima) setTimeout(() => {
    document.querySelectorAll('#reparto .res-bar i').forEach(i => i.style.width = i.dataset.w + '%');
    document.querySelectorAll('#reparto .res-p').forEach(el => {
      if (el.dataset.p === '') return; const fin = +el.dataset.p, t0 = performance.now();
      const paso = t => { const k = Math.min(1, (t - t0) / 1000); el.textContent = Math.round(fin * (1 - Math.pow(1 - k, 3))) + '%'; if (k < 1) requestAnimationFrame(paso); };
      requestAnimationFrame(paso);
    });
  }, 450);
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
  const res = ronda.res.filter(Boolean), reales = res.filter(r => r.real), dilemas = res.filter(r => !r.real);
  const ok = reales.filter(r => r.acierto).length, mayoria = dilemas.filter(r => { const rep = reparto(pregunta(r.id)); return Votos.estado === 'ok' && rep.total > 1 && rep.n[r.o] === Math.max(...rep.n); }).length;
  const cuadros = ronda.ids.map((_, i) => ({ ok: '🟩', ko: '🟥', op: '🟦', sk: '⬜' }[ronda.marcas[i]] || '⬜')).join('');
  const frase = !reales.length ? '¡Ronda completada!' : ok === reales.length ? '¡Sabes un montón de Suiza!' : ok >= reales.length / 2 ? '¡Vas muy bien!' : 'Hoy has aprendido mucho';
  const cajas = [reales.length ? `<div><b>${ok}/${reales.length}</b><span>verdades acertadas</span></div>` : '', dilemas.length ? `<div><b>${mayoria}/${dilemas.length}</b><span>veces pensaste como la mayoría</span></div>` : ''].join('');
  app.innerHTML = `<section class="done">
    <div class="lg">${logo()}</div>
    <p class="kicker">${esc(MODOS[ronda.modo].emoji + ' ' + MODOS[ronda.modo].nombre)}</p>
    <p class="big">${frase}</p>
    <div class="squares" aria-label="Resumen de la ronda">${cuadros}</div>
    <div class="score">${cajas}</div>
    <button class="btn red" id="otra" type="button">Otra ronda →</button>
    <div class="row2" style="width:100%"><button class="btn line" id="comp" type="button">Copiar resultado</button><button class="btn line" id="inicio" type="button">Cambiar de modo</button></div>
    <p class="copymsg" id="copymsg" aria-live="polite"></p>
  </section>`;
  $('#otra').onclick = () => nuevaRonda(ronda.modo);
  $('#inicio').onclick = pintarInicio;
  const lineas = [reales.length ? `Verdades: ${ok}/${reales.length}` : '', dilemas.length ? `Como la mayoría: ${mayoria}/${dilemas.length}` : ''].filter(Boolean).join(' · ');
  $('#comp').onclick = () => copiar(`Suizamente · ${MODOS[ronda.modo].nombre}\n${cuadros}\n${lineas}\n¿Cuánto sabes de Suiza? latido.ch`, $('#copymsg'));
  window.scrollTo({ top: 0 });
}

/* ---------- compartir ---------- */
function textoPregunta(q) {
  const rep = reparto(q), hay = Votos.estado === 'ok' && rep.total > 1;
  const lineas = q.opciones.map((op, i) => `${op.e} ${op.t}${hay ? ` — ${rep.pct[i]} %` : ''}`).join('\n');
  return `${q.emoji} ${q.pregunta}\n${lineas}\n¿Y tú qué eliges? Suizamente · latido.ch`;
}
function copiar(texto, msg) {
  const fallback = () => { const box = document.createElement('textarea'); box.className = 'copybox'; box.readOnly = true; box.value = texto; msg.after(box); box.focus(); box.select(); msg.textContent = 'Selecciona el texto y cópialo.'; };
  try { navigator.clipboard.writeText(texto).then(() => { msg.textContent = 'Copiado. Pégalo en tus stories o en el grupo.'; }, fallback); } catch (_) { fallback(); }
}

/* ---------- teclado: 1-3 elige, Esc o Enter pasa ---------- */
document.addEventListener('keydown', e => {
  if (resultadoAbierto && e.key === 'Tab') {
    const controls = [...layer.querySelectorAll('button, textarea')];
    const edge = e.shiftKey ? controls[0] : controls.at(-1);
    if (document.activeElement === edge) { e.preventDefault(); (e.shiftKey ? controls.at(-1) : controls[0]).focus(); }
    return;
  }
  if (resultadoAbierto && e.key === 'Escape') { e.preventDefault(); siguiente(); return; }
  if (!resultadoAbierto && ronda && /^[1-3]$/.test(e.key)) { const b = app.querySelectorAll('.opt')[+e.key - 1]; if (b) b.click(); }
});

/* ---------- arranque ---------- */
/* Si las preguntas vienen dentro de la página (<script type="application/json" id="preguntas-embebidas">), se usan;
   si no, se cargan de CONFIG.datos (data/preguntas.json). */
const embebidas = document.getElementById('preguntas-embebidas');
(embebidas ? Promise.resolve(JSON.parse(embebidas.textContent)) : fetch(CONFIG.datos).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })).then(d => {
  PREG = d.preguntas || [];
  for (const [id, value] of Object.entries(local.resp)) {
    const q = pregunta(id);
    if (!q || !Number.isInteger(value?.o) || value.o < 0 || value.o >= q.opciones.length) delete local.resp[id];
  }
  pintarInicio();
  Votos.iniciar({ alCambiar, misVotos, recuperar });
}).catch(() => {
  app.innerHTML = `<div class="loading"><div class="lg">${logo()}</div><p class="big">No se han podido cargar las preguntas</p><p class="note">Si abriste el archivo directamente desde el ordenador, sírvelo con un servidor local (lo explica INTEGRACION.md).</p></div>`;
});
})();
