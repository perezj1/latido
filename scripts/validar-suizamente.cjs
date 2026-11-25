#!/usr/bin/env node
/* Valida data/preguntas.json. Uso: node herramientas/validar-preguntas.js
   Opciones: 4 en las preguntas con respuesta, 2 en «¿Verdad o mito?» y 2 o 3 en los dilemas.
   Sale con código 1 si hay errores (sirve para CI). Sin dependencias. */
const fs = require('fs');
const path = require('path');

const archivo = path.join(__dirname, '..', 'public', 'suizamente', 'data', 'preguntas.json');
let datos;
try { datos = JSON.parse(fs.readFileSync(archivo, 'utf8')); }
catch (e) { console.error('JSON no válido:', e.message); process.exit(1); }

const TEMAS = new Set(datos.temas || []);
const errores = [], avisos = [], ids = new Set();
const largo = (s, max) => typeof s === 'string' && s.trim().length > 0 && s.length <= max;

(datos.preguntas || []).forEach((q, i) => {
  const d = `#${i + 1} ${q.id || '(sin id)'}`;
  if (!/^[a-z0-9_]+$/.test(q.id || '')) errores.push(`${d}: id vacío o con caracteres no válidos`);
  if (ids.has(q.id)) errores.push(`${d}: id repetido`);
  ids.add(q.id);
  if (!['dilema', 'real'].includes(q.tipo)) errores.push(`${d}: tipo debe ser "dilema" o "real"`);
  if (!TEMAS.has(q.tema)) errores.push(`${d}: tema «${q.tema}» no está en la lista de temas`);
  if (!largo(q.emoji, 16)) errores.push(`${d}: falta el emoji`);
  if (!largo(q.pregunta, 140)) errores.push(`${d}: pregunta vacía o de más de 140 caracteres`);
  if (!largo(q.dato, 300)) errores.push(`${d}: dato vacío o de más de 300 caracteres`);
  const vm = q.tipo === 'real' && /^¿Verdad o mito\?/.test(q.pregunta || '');
  const n = q.tipo === 'dilema' ? [2, 3] : vm ? [2] : [4];
  if (!Array.isArray(q.opciones) || !n.includes(q.opciones.length)) errores.push(`${d}: debe tener ${n.join(' o ')} opciones${q.tipo === 'real' ? (vm ? ' (¿Verdad o mito?)' : ' (pregunta con respuesta)') : ' (dilema)'}`);
  else q.opciones.forEach((o, k) => {
    if (!largo(o.e, 16)) errores.push(`${d}: la opción ${k} no tiene emoji`);
    if (!largo(o.t, 90)) errores.push(`${d}: la opción ${k} está vacía o pasa de 90 caracteres`);
  });
  if (q.tipo === 'real' && !(Number.isInteger(q.correcta) && q.correcta >= 0 && q.correcta < (q.opciones || []).length)) errores.push(`${d}: «correcta» falta o no apunta a una opción`);
  if (q.tipo === 'dilema' && q.correcta !== undefined) errores.push(`${d}: un dilema no lleva «correcta»`);
  const extra = Object.keys(q).filter(k => !['id', 'tipo', 'tema', 'emoji', 'pregunta', 'opciones', 'correcta', 'dato'].includes(k));
  if (extra.length) avisos.push(`${d}: campos desconocidos: ${extra.join(', ')}`);
});

const P = datos.preguntas || [];
const porTipo = t => P.filter(q => q.tipo === t).length;
const porTema = {}; P.forEach(q => porTema[q.tema] = (porTema[q.tema] || 0) + 1);
console.log(`Preguntas: ${P.length} (dilemas ${porTipo('dilema')}, preguntas y respuestas ${porTipo('real')})`);
console.log('Por tema:', Object.entries(porTema).map(([k, v]) => `${k} ${v}`).join(' · '));
if (avisos.length) console.log(`\nAvisos:\n  ${avisos.join('\n  ')}`);
if (errores.length) { console.log(`\nErrores (${errores.length}):\n  ${errores.join('\n  ')}`); process.exit(1); }
console.log('\nTodo correcto.');
