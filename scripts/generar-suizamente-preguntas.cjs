#!/usr/bin/env node
/* =========================================================================
   Suizamente · generador del banco de preguntas
   Uso:  node herramientas/generar-preguntas.js
   Lee fuentes/ y escribe data/preguntas.json con OBJETIVO preguntas de cada tipo.
   - fuentes/base.json           Las primeras 100 preguntas (no se tocan nunca)
   - fuentes/manual-*.txt        Preguntas escritas a mano (formatos D, R y V)
   - fuentes/vocabulario.txt     Palabras de suizo alemán, francés de Suiza, Tesino y romanche
   - fuentes/parejas.txt         Cosas suizas para dilemas «¿qué prefieres: A o B?»
   - fuentes/ciudades.txt, cantones.txt, fechas.txt, personas.txt, inventos.txt
   Todo es determinista: el mismo texto da siempre el mismo id y el mismo orden de opciones,
   así los votos guardados siguen apuntando a la opción correcta.
   Formatos en fuentes/LEEME-FUENTES.md
   ========================================================================= */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const F = path.join(RAIZ, 'data', 'suizamente', 'fuentes');
const OBJETIVO = { dilema: 1000, real: 1000 };
const LIM = { pregunta: 140, opcion: 90, dato: 300 };

const seg = new Intl.Segmenter('es', { granularity: 'grapheme' });
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
function rng(seed) { let a = parseInt(hash(String(seed)), 36) || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const barajar = (arr, r) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const tomar = (arr, n, r) => barajar(arr, r).slice(0, n);
const esEmoji = g => /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u.test(g);
function op(s) { s = s.trim(); const g = ([...seg.segment(s)][0] || {}).segment || ''; return esEmoji(g) ? { e: g, t: s.slice(g.length).trim() } : { e: '▫️', t: s }; }
function leer(nombre) {
  const p = path.join(F, nombre); if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(l => l.split('|').map(x => x.trim()));
}
const errores = [];
const TEMAS = ['comida', 'casa', 'papeles', 'trabajo', 'dinero', 'salud', 'transporte', 'idioma', 'social', 'fiestas', 'naturaleza', 'cultura'];

function real(id, tema, emoji, pregunta, opciones, dato, barajarOpciones = true) {
  const ops = opciones.map(s => ({ ok: s.startsWith('*'), ...op(s.replace(/^\*/, '')) }));
  if (ops.filter(o => o.ok).length !== 1) errores.push(`${id}: debe haber exactamente una opción con *  («${pregunta}»)`);
  const lista = barajarOpciones ? barajar(ops, rng(id)) : ops;
  return { id, tipo: 'real', tema, emoji, pregunta, opciones: lista.map(o => ({ e: o.e, t: o.t })), correcta: lista.findIndex(o => o.ok), dato };
}
const dilema = (id, tema, emoji, pregunta, opciones, dato) => ({ id, tipo: 'dilema', tema, emoji, pregunta, opciones: opciones.map(op), dato });
// Cuarta opción (siempre incorrecta): se añade al final, después de montar el banco, para no cambiar ni el id ni el
// orden de las opciones que ya existían. q._cuarta = el texto; si no, la de fuentes/cuarta-opcion.txt
const con4 = (q, texto) => Object.assign(q, { _cuarta: texto });
const otraMas = (lista, usados, id, clave) => barajar(lista.filter(x => !usados.some(u => clave(u).toLowerCase() === clave(x).toLowerCase())), rng(id + '·4'))[0];
const conEmojis = (textos, emojis) => textos.map((t, i) => `${t.startsWith('*') ? '*' : ''}${emojis[i]} ${t.replace(/^\*/, '')}`);

/* ---------- 1. base (100 preguntas originales, intocables) ---------- */
const base = JSON.parse(fs.readFileSync(path.join(F, 'base.json'), 'utf8')).preguntas;

/* ---------- 2. manuales ---------- */
const manualD = [], manualR = [];
for (const archivo of fs.readdirSync(F).filter(f => /^manual-.*\.txt$/.test(f)).sort()) {
  for (const c of leer(archivo)) {
    const [tipo, tema, emoji] = c;
    if (!TEMAS.includes(tema)) { errores.push(`${archivo}: tema «${tema}» no válido en «${c[3]}»`); continue; }
    if (tipo === 'D') { const ops = c.slice(4, -1); manualD.push(dilema('d_' + hash(c[3] + ops.join()), tema, emoji, c[3], ops, c[c.length - 1])); }
    else if (tipo === 'R') { const ops = c.slice(4, -1); manualR.push(real('r_' + hash(c[3] + ops.join()), tema, emoji, c[3], ops, c[c.length - 1])); }
    else if (tipo === 'V') {
      const verdad = c[4].toUpperCase() === 'V';
      manualR.push(real('v_' + hash(c[3]), tema, emoji, `¿Verdad o mito? ${c[3]}`, [`${verdad ? '*' : ''}✅ Verdad`, `${verdad ? '' : '*'}❌ Mito`], c[5], false));
    } else errores.push(`${archivo}: tipo de línea desconocido «${tipo}»`);
  }
}

/* ---------- 3. vocabulario ---------- */
const IDIOMAS = {
  DE: { ida: 'En suizo alemán, ¿qué significa «%»?', vuelta: '¿Cómo se dice «%» en suizo alemán?' },
  FR: { ida: 'En la Suiza francesa, ¿qué significa «%»?', vuelta: '¿Cómo se dice «%» en la Suiza francesa?' },
  IT: { ida: 'En el Tesino, ¿qué significa «%»?', vuelta: '¿Cómo se dice «%» en el Tesino?' },
  RM: { ida: 'En romanche, ¿qué significa «%»?', vuelta: '¿Cómo se dice «%» en romanche?' }
};
const vocab = leer('vocabulario.txt').map(([l, palabra, significado, emoji, dato]) => ({ l, palabra, significado, emoji, dato }));
const vocabIda = [], vocabVuelta = [];
for (const v of vocab) {
  if (!IDIOMAS[v.l]) { errores.push(`vocabulario: idioma «${v.l}» no válido`); continue; }
  const otros = vocab.filter(x => x.l === v.l && x !== v && x.significado.toLowerCase() !== v.significado.toLowerCase() && x.palabra.toLowerCase() !== v.palabra.toLowerCase());
  const id1 = 'voc_' + hash(v.l + v.palabra), d1 = tomar(otros, 2, rng(id1));
  const x1 = otraMas(otros, [v, ...d1], id1, x => x.significado);
  vocabIda.push(con4(real(id1, 'idioma', v.emoji, IDIOMAS[v.l].ida.replace('%', v.palabra), [`*${v.emoji} ${v.significado}`, ...d1.map(x => `${x.emoji} ${x.significado}`)], v.dato), x1 && `${x1.emoji} ${x1.significado}`));
  if (v.significado.length <= 30) {
    const id2 = 'vocr_' + hash(v.l + v.palabra), d2 = tomar(otros, 2, rng(id2));
    const x2 = otraMas(otros, [v, ...d2], id2, x => x.palabra);
    vocabVuelta.push(con4(real(id2, 'idioma', v.emoji, IDIOMAS[v.l].vuelta.replace('%', v.significado), [`*${v.emoji} ${v.palabra}`, ...d2.map(x => `${x.emoji} ${x.palabra}`)], v.dato), x2 && `${x2.emoji} ${x2.palabra}`));
  }
}

/* ---------- 4. cantones y ciudades ---------- */
const cantones = leer('cantones.txt').map(([code, nombre, capital, emoji, dato]) => ({ code, nombre, capital, emoji, dato }));
const capitales = [];
for (const k of cantones.filter(k => k.capital.toLowerCase() !== k.nombre.toLowerCase())) {
  const otros = cantones.filter(x => x !== k);
  const id1 = 'cap_' + hash(k.code), d1 = tomar(otros, 2, rng(id1));
  const x1 = otraMas(otros, [k, ...d1], id1, x => x.capital);
  capitales.push(con4(real(id1, 'cultura', k.emoji, `¿Cuál es la capital del cantón de ${k.nombre}?`, conEmojis([`*${k.capital}`, ...d1.map(x => x.capital)], ['🏛️', '🏙️', '🏘️']), k.dato), x1 && `🏢 ${x1.capital}`));
  const id2 = 'capr_' + hash(k.code), d2 = tomar(otros, 2, rng(id2));
  const x2 = otraMas(otros, [k, ...d2], id2, x => x.nombre);
  capitales.push(con4(real(id2, 'cultura', k.emoji, `¿De qué cantón es capital ${k.capital}?`, conEmojis([`*${k.nombre}`, ...d2.map(x => x.nombre)], ['🗺️', '📍', '🧭']), k.dato), x2 && `🏔️ ${x2.nombre}`));
}
const ciudades = leer('ciudades.txt').map(([ciudad, code, emoji, dato]) => {
  const k = cantones.find(x => x.code === code); if (!k) { errores.push(`ciudades: cantón «${code}» desconocido (${ciudad})`); return null; }
  const id = 'ciu_' + hash(ciudad), d = tomar(cantones.filter(x => x !== k), 2, rng(id));
  const x = otraMas(cantones, [k, ...d], id, c => c.nombre);
  return con4(real(id, 'cultura', emoji, `¿En qué cantón está ${ciudad}?`, conEmojis([`*${k.nombre}`, ...d.map(x => x.nombre)], ['📍', '🗺️', '🧭']), dato), x && `🏔️ ${x.nombre}`);
}).filter(Boolean);

/* ---------- 5. fechas, personas, inventos ---------- */
const fechas = leer('fechas.txt').map(([anio, emoji, evento, dato]) => {
  const y = +anio, id = 'fec_' + hash(evento), r = rng(id);
  const cand = barajar([-61, -43, -29, -17, -9, 8, 14, 23, 38, 52], r).map(o => y + o).filter(a => a > 1000 && a <= 2025);
  return con4(real(id, 'cultura', emoji, `¿En qué año ${evento}?`, conEmojis([`*${y}`, String(cand[0]), String(cand[1])], ['📅', '🗓️', '⏳']), dato), cand[2] && `⌛ ${cand[2]}`);
});
const personas = leer('personas.txt').map(([tiempo, nombre, desc, emoji, dato]) => ({ tiempo, nombre, desc, emoji, dato }));
const personasQ = personas.map(p => {
  const id = 'per_' + hash(p.nombre), d = tomar(personas.filter(x => x !== p), 2, rng(id));
  const x = otraMas(personas, [p, ...d], id, y => y.desc);
  return con4(real(id, 'cultura', p.emoji, `¿Quién ${p.tiempo === 'es' ? 'es' : 'fue'} ${p.nombre}?`, [`*${p.emoji} ${p.desc}`, ...d.map(x => `${x.emoji} ${x.desc}`)], p.dato), x && `${x.emoji} ${x.desc}`);
});
const NO_SUIZOS = ['💡 La bombilla eléctrica', '📞 El teléfono', '📻 La radio', '🖨️ La imprenta', '✈️ El avión', '🖊️ El bolígrafo', '📺 La televisión', '🚗 El automóvil', '🤐 La cremallera', '📷 La fotografía', '🧲 La brújula', '🔭 El telescopio'];
const ENUNCIADOS_INVENTO = ['¿Cuál de estos inventos nació en Suiza?', 'Solo uno de estos inventos es suizo. ¿Cuál?', '¿Qué se inventó en Suiza?'];
const inventos = leer('inventos.txt').map(([invento, emoji, dato]) => {
  const id = 'inv_' + hash(invento), r = rng(id);
  const enunciado = ENUNCIADOS_INVENTO[Math.floor(r() * ENUNCIADOS_INVENTO.length)], d = tomar(NO_SUIZOS, 2, r);
  return con4(real(id, 'cultura', emoji, enunciado, [`*${emoji} ${invento}`, ...d], dato), otraMas(NO_SUIZOS, d, id, s => s));
});

/* ---------- 6. parejas para dilemas ---------- */
const ENUNCIADOS = {
  comida: ['¿Qué prefieres comer?', 'Para una cena suiza perfecta, ¿qué eliges?', 'Solo puedes probar una de estas dos cosas. ¿Cuál?', '¿Qué te pedirías ahora mismo?'],
  ciudad: ['¿Dónde prefieres pasar un fin de semana?', '¿En qué ciudad suiza vivirías?', 'Escapada sorpresa: ¿adónde vas?'],
  naturaleza: ['¿Qué excursión prefieres?', 'Domingo de sol: ¿adónde vas?', '¿Qué foto prefieres para tu perfil?'],
  fiesta: ['¿Qué fiesta suiza prefieres vivir?', '¿A qué tradición te apuntas?', 'Te invitan a dos fiestas el mismo día. ¿A cuál vas?'],
  plan: ['¿Qué plan prefieres?', 'Sábado libre: ¿qué haces?', 'Para conocer gente en Suiza, ¿qué eliges?'],
  palabra: ['¿Qué palabra suiza te gusta más?', '¿Qué palabra suiza adoptarías en tu idioma?', '¿Cuál suena mejor?'],
  experiencia: ['¿Qué experiencia suiza prefieres?', 'Solo puedes hacer una de estas cosas este año. ¿Cuál?'],
  souvenir: ['¿Qué te llevas a tu país como recuerdo?', '¿Qué regalo suizo prefieres recibir?']
};
const TEMA_PAREJA = { comida: 'comida', ciudad: 'cultura', naturaleza: 'naturaleza', fiesta: 'fiestas', plan: 'social', palabra: 'idioma', experiencia: 'cultura', souvenir: 'cultura' };
const items = {};
for (const [cat, nombre, emoji, dato] of leer('parejas.txt')) {
  if (!ENUNCIADOS[cat]) { errores.push(`parejas: categoría «${cat}» no válida`); continue; }
  (items[cat] = items[cat] || []).push({ nombre, emoji, dato });
}
function colaParejas(cat) {
  const L = items[cat], n = L.length, out = [], vistos = new Set();
  for (let s = 1; s < n; s++) for (let i = 0; i < n; i++) {
    const a = L[i], b = L[(i + s) % n], k = [a.nombre, b.nombre].sort().join('·');
    if (vistos.has(k)) continue; vistos.add(k);
    const id = 'par_' + hash(k), r = rng(id), par = r() < .5 ? [a, b] : [b, a];
    let dato = `${par[0].emoji} ${par[0].nombre}: ${par[0].dato} ${par[1].emoji} ${par[1].nombre}: ${par[1].dato}`;
    if (dato.length > LIM.dato) dato = `${a.emoji} ${a.nombre}: ${a.dato}`;
    out.push(dilema(id, TEMA_PAREJA[cat], par[0].emoji, ENUNCIADOS[cat][Math.floor(r() * ENUNCIADOS[cat].length)], par.map(x => `${x.emoji} ${x.nombre}`), dato));
  }
  return out;
}
const categorias = Object.keys(items);
const colas = categorias.map(colaParejas);
// Topes por categoría de pareja para equilibrar temas (palabra = idioma; ciudad, experiencia y souvenir = cultura)
const TOPE_PAREJAS = { palabra: 40, souvenir: 40, ciudad: 90, experiencia: 90 };
// El vocabulario «al revés» repite las mismas palabras: solo una muestra
const TOPE_VOCAB_VUELTA = 40;

/* ---------- 7. montar el banco ---------- */
const todas = [], ids = new Set(), firmas = new Set();
function anadir(q) {
  const firma = (q.pregunta + '|' + q.opciones.map(o => o.t).sort().join('|')).toLowerCase();
  if (ids.has(q.id) || firmas.has(firma)) return false;
  ids.add(q.id); firmas.add(firma); todas.push(q); return true;
}
const cuenta = t => todas.filter(q => q.tipo === t).length;
base.forEach(anadir);
manualD.forEach(anadir);
// dilemas: rellenar con parejas, alternando categorías y respetando los topes
const usadas = {};
for (let ronda = 0; cuenta('dilema') < OBJETIVO.dilema && colas.some(c => c.length > ronda); ronda++)
  colas.forEach((c, k) => {
    const cat = categorias[k];
    if (cuenta('dilema') >= OBJETIVO.dilema || (usadas[cat] || 0) >= (TOPE_PAREJAS[cat] ?? Infinity)) return;
    if (c[ronda] && anadir(c[ronda])) usadas[cat] = (usadas[cat] || 0) + 1;
  });
// reales: por prioridad
const muestraVuelta = barajar(vocabVuelta, rng('vocabulario-vuelta')).slice(0, TOPE_VOCAB_VUELTA);
for (const grupo of [manualR, vocabIda, ciudades, capitales, fechas, personasQ, inventos, muestraVuelta])
  for (const q of grupo) { if (cuenta('real') >= OBJETIVO.real) break; anadir(q); }

/* ---------- 7b. cuarta opción ---------- */
// Las preguntas con respuesta tienen 4 opciones (las de «¿Verdad o mito?», 2). La cuarta va al final: así no
// cambian ni el id ni el índice de las opciones que ya tenían votos. Al jugar se muestran en orden aleatorio.
const CUARTA = Object.fromEntries(leer('cuarta-opcion.txt').map(([id, texto]) => [id, texto]));
const usadasCuarta = new Set();
for (const q of todas) {
  const texto = q._cuarta || CUARTA[q.id];
  delete q._cuarta;
  if (q.tipo !== 'real' || q.opciones.length !== 3) continue;
  if (!texto) { errores.push(`${q.id}: le falta la cuarta opción (fuentes/cuarta-opcion.txt) «${q.pregunta}»`); continue; }
  if (CUARTA[q.id]) usadasCuarta.add(q.id);
  const o = op(texto);
  if (q.opciones.some(x => x.t.toLowerCase() === o.t.toLowerCase())) errores.push(`${q.id}: la cuarta opción repite otra («${o.t}»)`);
  q.opciones.push(o);
}
for (const id of Object.keys(CUARTA)) if (!usadasCuarta.has(id)) errores.push(`cuarta-opcion.txt: «${id}» no es una pregunta de 3 opciones del banco`);

/* ---------- 7c. el emoji de la pregunta no puede dar la respuesta ---------- */
// Las opciones se enseñan sin emoji. Si el emoji de una pregunta con respuesta es el de alguna de sus opciones (pasa
// en el vocabulario, las personas, los inventos y en muchas escritas a mano), delataría la respuesta: se cambia por uno
// neutro, el propio del tipo de pregunta o el del tema. Si ese también coincide con una opción, ❓.
// No cambia el id ni las opciones. Las de «¿Verdad o mito?» (2 opciones) no se tocan.
const EMOJI_TEMA = { comida: '🍽️', casa: '🏠', papeles: '📄', trabajo: '💼', dinero: '💰', salud: '🩺', transporte: '🚆', idioma: '🗣️', social: '🤝', fiestas: '🎉', naturaleza: '🌲', cultura: '🏛️' };
const EMOJI_TIPO = [[/^vocr_/, '💬'], [/^voc_/, '🗣️'], [/^per_/, '👤'], [/^inv_/, '⚙️']];
let neutros = 0;
for (const q of todas) {
  if (q.tipo !== 'real' || q.opciones.length < 3 || !q.opciones.some(o => o.e === q.emoji)) continue;
  const propio = (EMOJI_TIPO.find(([re]) => re.test(q.id)) || [])[1];
  q.emoji = [propio, EMOJI_TEMA[q.tema], '❓'].filter(Boolean).find(e => !q.opciones.some(o => o.e === e)) || '❓';
  neutros++;
}

/* ---------- 8. comprobar y escribir ---------- */
for (const q of todas) {
  if (q.pregunta.length > LIM.pregunta) errores.push(`${q.id}: pregunta de ${q.pregunta.length} caracteres`);
  if (q.dato.length > LIM.dato) errores.push(`${q.id}: dato de ${q.dato.length} caracteres`);
  q.opciones.forEach(o => { if (o.t.length > LIM.opcion) errores.push(`${q.id}: opción de ${o.t.length} caracteres`); if (!o.t) errores.push(`${q.id}: opción vacía`); });
}
const datos = JSON.parse(fs.readFileSync(path.join(F, 'base.json'), 'utf8'));
const orden = q => q.tipo === 'dilema' ? 0 : 1;
todas.sort((a, b) => orden(a) - orden(b));
const txt = '{\n  "version": ' + (datos.version + 1) + ',\n  "nombre": "Suizamente",\n  "descripcion": ' + JSON.stringify(datos.descripcion) + ',\n  "temas": ' + JSON.stringify(datos.temas) + ',\n  "preguntas": [\n' + todas.map(q => '    ' + JSON.stringify(q)).join(',\n') + '\n  ]\n}\n';

const disponibles = { 'manual D': manualD.length, 'parejas posibles': colas.reduce((a, c) => a + c.length, 0), 'manual R+V': manualR.length, 'vocabulario ida': vocabIda.length, 'vocabulario vuelta': vocabVuelta.length, ciudades: ciudades.length, capitales: capitales.length, fechas: fechas.length, personas: personasQ.length, inventos: inventos.length };
console.log('Disponibles:', Object.entries(disponibles).map(([k, v]) => `${k} ${v}`).join(' · '));
console.log(`Emojis de pregunta cambiados porque daban la respuesta: ${neutros}`);
console.log(`Banco: ${todas.length} (dilemas ${cuenta('dilema')}/${OBJETIVO.dilema}, preguntas y respuestas ${cuenta('real')}/${OBJETIVO.real})`);
const porTema = {}; todas.forEach(q => porTema[q.tema] = (porTema[q.tema] || 0) + 1);
console.log('Por tema:', Object.entries(porTema).map(([k, v]) => `${k} ${v}`).join(' · '));
if (errores.length) { console.log(`\nErrores (${errores.length}):\n  ` + errores.slice(0, 60).join('\n  ')); process.exit(1); }
if (process.argv.includes('--comprobar')) {
  const actual = JSON.parse(fs.readFileSync(path.join(RAIZ, 'public', 'suizamente', 'data', 'preguntas.json'), 'utf8'));
  if (JSON.stringify(actual) !== JSON.stringify(JSON.parse(txt))) { console.error('El banco publicado no coincide con sus fuentes.'); process.exit(1); }
  console.log('Banco publicado comprobado contra sus fuentes.');
}
if (process.argv.includes('--escribir')) { fs.writeFileSync(path.join(RAIZ, 'public', 'suizamente', 'data', 'preguntas.json'), txt); console.log('\nEscrito data/preguntas.json'); }
else console.log('\n(Prueba: añade --escribir para guardar data/preguntas.json)');
