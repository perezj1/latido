// Canvas engine ported from the supplied disenos/imagenes-compartir.js.
/* global Image, File, Path2D */
'use strict';
const H = {
  ancho: 1080, alto: 1920, base: 390,
  fondo: '#4A76EF', tinta: '#0F1A2B', suave: '#5A6577', menta: '#24E2C9', blanco: '#FFFFFF', pista: '#F4F7FB',
  linea: '#E4E8EF', maqueta: '#EEF1F5', naranja: '#F9A719', rojo: '#FA2F35',
  barras: ['#4A76EF', '#F9A719', '#24BFE2'],
  fuente: 'Poppins, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "Segoe UI", sans-serif',
};
// Los 6 sellos del pasaporte: emoji y color de su categoría
const SELLOS = {
  idioma: ['🗣️', '#4A76EF', 'Idioma'], cultura: ['🎭', '#FA2F35', 'Cultura'], comida: ['🧀', '#F9A719', 'Comida y naturaleza'],
  papeles: ['📄', '#03AA98', 'Papeles y dinero'], casa: ['🏠', '#24BFE2', 'Casa y trabajo'], dia: ['🚆', '#24E2C9', 'Día a día'],
};
const ORDEN = ['idioma', 'cultura', 'comida', 'papeles', 'casa', 'dia'];
const ENLACE = 'suizamente.latido.ch';

/* ---------- Utilidades ---------- */
async function cargarFuentes() {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all(['500', '600', '700', '800'].map(p => document.fonts.load(`${p} 20px Poppins`).catch(() => null)));
}
function cargarImagen(src) {
  if (!src) return Promise.resolve(null);
  if (typeof src !== 'string') return Promise.resolve(src);
  return new Promise(res => { const img = new Image(); img.onload = () => res(img); img.onerror = () => res(null); img.src = src; });
}
function rectRedondo(ctx, x, y, w, h, r) {
  r = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function partir(ctx, texto, ancho) {
  const palabras = String(texto).split(/\s+/).filter(Boolean), lineas = [];
  let linea = '';
  for (const p of palabras) {
    const prueba = linea ? linea + ' ' + p : p;
    if (!linea || ctx.measureText(prueba).width <= ancho) linea = prueba; else { lineas.push(linea); linea = p; }
  }
  if (linea) lineas.push(linea);
  return lineas;
}
function recortar(ctx, texto, ancho) {
  if (ctx.measureText(texto).width <= ancho) return texto;
  let t = texto;
  while (t.length > 1 && ctx.measureText(t + '…').width > ancho) t = t.slice(0, -1);
  return t.trimEnd() + '…';
}
const fuente = (peso, tam) => `${peso} ${tam}px ${H.fuente}`;

/* Titular con una parte resaltada (pastilla menta). Devuelve las líneas ya colocadas. */
function colocarTitular(ctx, partes, ancho, tam) {
  ctx.font = fuente(800, tam);
  const espacio = ctx.measureText(' ').width, pad = 8;
  const fichas = [];
  for (const parte of partes) {
    if (parte.resaltado) fichas.push({ t: parte.t.trim(), resaltado: true, w: ctx.measureText(parte.t.trim()).width + pad * 2 });
    else for (const p of parte.t.split(/\s+/).filter(Boolean)) fichas.push({ t: p, w: ctx.measureText(p).width, pegado: /^[!?.,:;]/.test(p) });
  }
  const lineas = [[]]; let x = 0;
  for (const f of fichas) {
    const actual = lineas[lineas.length - 1], sep = actual.length && !f.pegado ? espacio : 0;
    if (x + sep + f.w > ancho && actual.length) { lineas.push([]); x = 0; }
    const l = lineas[lineas.length - 1], s = l.length && !f.pegado ? espacio : 0;
    l.push({ ...f, x: x + s });
    x += s + f.w;
  }
  return lineas;
}
// El tamaño más grande (30 → 22 px) con el que el titular cabe en maxLineas
function titularQueCabe(ctx, partes, ancho, maxLineas) {
  let tam = 30, lineas;
  for (; tam >= 22; tam--) { lineas = colocarTitular(ctx, partes, ancho, tam); if (lineas.length <= maxLineas) break; }
  return { tam: Math.max(tam, 22), lineas, alto: lineas.length * Math.max(tam, 22) * 1.15 };
}
function pintarTitular(ctx, lineas, tam, x, y) {
  ctx.font = fuente(800, tam);
  const altoLinea = tam * 1.15;
  lineas.forEach((linea, i) => {
    const yy = y + i * altoLinea + altoLinea / 2;
    for (const f of linea) {
      if (f.resaltado) {
        ctx.fillStyle = H.menta; rectRedondo(ctx, x + f.x, yy - altoLinea / 2 + 1, f.w, altoLinea - 2, 10); ctx.fill();
        ctx.fillStyle = H.tinta; ctx.fillText(f.t, x + f.x + 8, yy + 1);
      } else { ctx.fillStyle = H.blanco; ctx.fillText(f.t, x + f.x, yy + 1); }
    }
  });
}
function dibujarLogo(ctx, cx, cy, ancho, alto) {
  const k = Math.min(ancho / 1230, alto / 930);
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-715, -545);
  ctx.lineCap = 'round'; ctx.lineWidth = 112;
  [['M182 527 346 584', '#03AA98'], ['M377 247 483 373', '#F9A719'], ['M710 157V323', '#FA2F35'],
   ['M1045 243 936 372', '#4A76EF'], ['M1072 580 1245 525', '#24BFE2']].forEach(([d, c]) => { ctx.strokeStyle = c; ctx.stroke(new Path2D(d)); });
  ctx.fillStyle = '#FA2F35'; rectRedondo(ctx, 435, 446, 545, 544, 135); ctx.fill();
  ctx.fillStyle = '#FFFFFF'; ctx.fill(new Path2D('M649 543h118v117h117v118H767v117H649V778H532V660h117Z'));
  ctx.restore();
}
// Tarjeta blanca girada (grados), con sombra. dibujo(ctx) pinta dentro con el origen en su esquina.
function tarjeta(ctx, x, y, w, h, grados, dibujo, radio = 26) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2); ctx.rotate(grados * Math.PI / 180); ctx.translate(-w / 2, -h / 2);
  ctx.shadowColor = 'rgba(15,26,43,0.18)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
  ctx.fillStyle = H.blanco; rectRedondo(ctx, 0, 0, w, h, radio); ctx.fill();
  ctx.shadowColor = 'transparent';
  dibujo(ctx);
  ctx.restore();
}
// Imagen recortada en un rectángulo redondeado: 'cubrir' llena el hueco; 'contener' la enseña entera
function pintarFoto(ctx, img, x, y, w, h, r, ajuste) {
  ctx.save();
  rectRedondo(ctx, x, y, w, h, r); ctx.clip();
  ctx.fillStyle = H.maqueta; ctx.fillRect(x, y, w, h);
  if (img) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const k = ajuste === 'contener' ? Math.min((w - 24) / iw, (h - 24) / ih) : Math.max(w / iw, h / ih);
    const dw = iw * k, dh = ih * k;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }
  ctx.restore();
}
function emoji(ctx, e, cx, cy, tam) {
  ctx.save(); ctx.font = fuente(400, tam); ctx.textAlign = 'center'; ctx.fillStyle = H.tinta; ctx.fillText(e, cx, cy + tam * 0.06); ctx.restore();
}
function pintarSello(ctx, k, cx, cy, d, tiene = true) {
  const [e, color] = SELLOS[k] || ['❔', H.suave];
  ctx.save();
  if (tiene) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = Math.max(3, d / 13);
    ctx.beginPath(); ctx.arc(cx, cy, d / 2 - ctx.lineWidth / 2 - 1, 0, Math.PI * 2); ctx.stroke();
    emoji(ctx, e, cx, cy, d * 0.48);
  } else {
    ctx.fillStyle = H.pista; ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, Math.PI * 2); ctx.fill();
    ctx.setLineDash([5, 4]); ctx.strokeStyle = '#C9D0DB'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 0.3; emoji(ctx, e, cx, cy, d * 0.42);
  }
  ctx.restore();
}
function marco(ctx, ANCHO, ALTO) {
  ctx.fillStyle = H.fondo; ctx.fillRect(0, 0, ANCHO, ALTO);
  // Rayos decorativos (abajo a la derecha)
  ctx.save();
  ctx.globalAlpha = 0.9; ctx.translate(ANCHO - 300 + 120, ALTO - 300 + 110); ctx.scale(0.75, 0.75);
  ctx.lineCap = 'round'; ctx.lineWidth = 34;
  [['M40 210 95 228', '#03AA98'], ['M105 115 140 157', '#F9A719'], ['M200 70v55', '#FA2F35'], ['M295 115 260 157', '#FFFFFF']]
    .forEach(([d, c]) => { ctx.strokeStyle = c; ctx.stroke(new Path2D(d)); });
  ctx.restore();
  // Cabecera: logo en placa blanca + «Suizamente»
  const M = 28;
  ctx.fillStyle = H.blanco; rectRedondo(ctx, M, 40, 60, 60, 18); ctx.fill();
  dibujarLogo(ctx, M + 30, 70, 48, 36);
  ctx.fillStyle = H.blanco; ctx.font = fuente(800, 24); ctx.fillText('Suizamente', M + 70, 71);
  const pieAbajo = ALTO - 32, linea2 = pieAbajo - 11, linea1 = linea2 - 11 - 6 - 15;
  return { M, util: ANCHO - M * 2, titularY: 122, linea1, linea2 };
}
function pie(ctx, m, datos, cierre) {
  ctx.fillStyle = H.blanco;
  ctx.font = fuente(800, 20); ctx.fillText(datos.cierre || cierre, m.M, m.linea1);
  ctx.font = fuente(600, 15); ctx.fillText('👉 Juega en ' + (datos.enlace || ENLACE), m.M, m.linea2);
}

/* ---------- Tipo «pregunta»: el resultado de una pregunta ---------- */
function cuerpoPregunta(ctx, m, datos) {
  const tarjetaW = m.util, pad = 18, interior = tarjetaW - pad * 2;
  ctx.font = fuente(800, 15);
  const lineasPregunta = partir(ctx, datos.pregunta || '', interior).slice(0, 3);
  const opciones = (datos.opciones || []).slice(0, 3);
  const altoPregunta = lineasPregunta.length * 20.25;
  const altoOpcion = 19.5 + 5 + 12;
  const tarjetaH = pad + altoPregunta + 12 + opciones.length * altoOpcion + Math.max(0, opciones.length - 1) * 12 + pad;
  // Titular: empieza a 30 px y se reduce si no cabe
  let tam = 30, lineasTitular, altoTitular;
  for (; tam >= 22; tam -= 1) {
    lineasTitular = colocarTitular(ctx, datos.titular || [], m.util, tam);
    altoTitular = lineasTitular.length * tam * 1.15;
    if (m.titularY + altoTitular + 22 + tarjetaH + 24 <= m.linea1 - 15) break;
  }
  tam = Math.max(tam, 22);
  pintarTitular(ctx, lineasTitular, tam, m.M, m.titularY);
  tarjeta(ctx, m.M, m.titularY + altoTitular + 22, tarjetaW, tarjetaH, -2, c => {
    let y = pad;
    c.fillStyle = H.tinta; c.font = fuente(800, 15);
    lineasPregunta.forEach(l => { c.fillText(l, pad, y + 10.1); y += 20.25; });
    y += 12;
    opciones.forEach((op, i) => {
      const pct = Math.max(0, Math.min(100, Math.round(op.pct)));
      c.font = fuente(700, 13);
      const textoPct = pct + ' %', anchoPct = c.measureText(textoPct).width;
      c.fillStyle = H.tinta;
      c.fillText(recortar(c, op.texto, interior - anchoPct - 12), pad, y + 9.75);
      c.textAlign = 'right'; c.fillText(textoPct, pad + interior, y + 9.75); c.textAlign = 'left';
      y += 19.5 + 5;
      c.fillStyle = H.pista; rectRedondo(c, pad, y, interior, 12, 6); c.fill();
      if (pct > 0) { c.fillStyle = H.barras[i] || H.barras[0]; rectRedondo(c, pad, y, Math.max(12, interior * pct / 100), 12, 6); c.fill(); }
      y += 12 + 12;
    });
  });
  pie(ctx, m, datos, '¿Y tú qué eliges? 🤔');
}

/* ---------- Tipo «mapa»: Mi Suiza (la maqueta 3D y tres cifras) ---------- */
function cuerpoMapa(ctx, m, datos, img) {
  const t = titularQueCabe(ctx, datos.titular || [], m.util, 3);
  pintarTitular(ctx, t.lineas, t.tam, m.M, m.titularY);
  const pad = 12, W = m.util, fotoW = W - pad * 2;
  const cifras = (datos.cifras || []).slice(0, 3), altoCifras = cifras.length ? 52 : 0;
  const extra = pad * 2 + (cifras.length ? 10 + altoCifras : 0);
  const arriba = m.titularY + t.alto + 20, abajo = m.linea1 - 15 - 24;
  const fotoH = Math.max(160, Math.min(fotoW / (datos.proporcion || 1), abajo - arriba - extra));
  const alto = fotoH + extra, y0 = arriba + Math.max(0, (abajo - arriba - alto) / 2);
  tarjeta(ctx, m.M, y0, W, alto, -2, c => {
    pintarFoto(c, img, pad, pad, fotoW, fotoH, 18, datos.ajuste);
    if (datos.etiqueta) {
      c.font = fuente(800, 13);
      const txt = recortar(c, datos.etiqueta, fotoW - 44), w = c.measureText(txt).width + 24;
      c.fillStyle = 'rgba(255,255,255,0.94)'; rectRedondo(c, pad + 10, pad + fotoH - 40, w, 30, 15); c.fill();
      c.fillStyle = H.tinta; c.fillText(txt, pad + 22, pad + fotoH - 24.5);
    }
    if (cifras.length) {
      const yc = pad + fotoH + 10, col = fotoW / cifras.length;
      c.textAlign = 'center';
      cifras.forEach((f, i) => {
        const cx = pad + col * (i + 0.5);
        if (i) { c.fillStyle = H.linea; c.fillRect(pad + col * i - 0.5, yc + 6, 1, altoCifras - 12); }
        c.fillStyle = H.tinta; c.font = fuente(800, 18); c.fillText(recortar(c, `${f.e} ${f.n}`, col - 8), cx, yc + 16);
        let tl = 11.5; c.font = fuente(600, tl);
        while (tl > 9.5 && c.measureText(f.t).width > col - 8) c.font = fuente(600, tl -= 0.5);
        c.fillStyle = H.suave; c.fillText(recortar(c, f.t, col - 8), cx, yc + 38);
      });
      c.textAlign = 'left';
    }
  });
  pie(ctx, m, datos, '¿Construyes la tuya? 🏗️');
}

/* ---------- Tipo «logro»: pasaporte, sello, carta o colección ---------- */
function medidasHeroe(h, W) {
  if (h.pasaporte) return { w: W, h: 292, giro: -2 };
  if (h.sello) return { w: 252, h: 262, giro: -2 };
  if (h.carta) return { w: 220, h: 312, giro: -4, sola: true };
  if (h.coleccion) return { w: W, h: 400, giro: -2 };
  return { w: W, h: 200, giro: -2 };
}
function pintarHeroe(c, h, d, linea) {
  c.textAlign = 'center';
  const cx = d.w / 2;
  if (h.pasaporte) {
    c.fillStyle = H.tinta; c.font = fuente(800, 15); c.fillText('Mi pasaporte', cx, 32);
    const dm = 84, gap = (d.w - 40 - dm * 3) / 2;
    ORDEN.forEach((k, i) => pintarSello(c, k, 20 + dm / 2 + (i % 3) * (dm + gap), 58 + dm / 2 + Math.floor(i / 3) * (dm + 16), dm, h.pasaporte.includes(k)));
    if (linea) { c.fillStyle = H.suave; c.font = fuente(700, 13.5); c.fillText(linea, cx, d.h - 26); }
  } else if (h.sello) {
    pintarSello(c, h.sello, cx, 24 + 75, 150);
    c.fillStyle = H.tinta; c.font = fuente(800, 18); c.fillText(recortar(c, (SELLOS[h.sello] || [])[2] || '', d.w - 24), cx, 200);
    if (linea) { c.fillStyle = H.suave; c.font = fuente(600, 13); c.fillText(recortar(c, linea, d.w - 24), cx, 226); }
  } else if (h.carta) {
    const k = h.carta;
    c.strokeStyle = H.linea; c.lineWidth = 2; rectRedondo(c, 1, 1, d.w - 2, d.h - 2, 26); c.stroke();
    c.fillStyle = H.naranja; c.font = fuente(800, 22); c.fillText('★'.repeat(k.r || 1), cx, 34);
    emoji(c, k.e, cx, 128, 104);
    c.fillStyle = H.tinta; c.font = fuente(800, 19);
    partir(c, k.n, d.w - 32).slice(0, 2).forEach((l, i, a) => c.fillText(l, cx, 228 + i * 24 - (a.length - 1) * 6));
    if (k.coleccion) { c.fillStyle = H.suave; c.font = fuente(600, 12.5); c.fillText(recortar(c, k.coleccion, d.w - 28), cx, d.h - 24); }
    c.font = fuente(800, 12); const w = c.measureText('NUEVA').width + 20;
    c.fillStyle = H.rojo; rectRedondo(c, cx - w / 2, -11, w, 22, 11); c.fill();
    c.fillStyle = H.blanco; c.fillText('NUEVA', cx, 0.5);
  } else if (h.coleccion) {
    c.fillStyle = H.tinta; c.font = fuente(800, 16); c.fillText(recortar(c, h.coleccion.n, d.w - 32), cx, 32);
    const celda = (d.w - 40 - 20) / 3;
    h.coleccion.cartas.slice(0, 9).forEach((e, i) => {
      const x = 20 + (i % 3) * (celda + 10), y = 54 + Math.floor(i / 3) * (celda + 10);
      c.fillStyle = H.pista; rectRedondo(c, x, y, celda, celda, 16); c.fill();
      emoji(c, e, x + celda / 2, y + celda / 2, 42);
    });
    if (linea) { c.fillStyle = H.suave; c.font = fuente(700, 13.5); c.fillText(linea, cx, d.h - 24); }
  }
  c.textAlign = 'left';
}
function cuerpoLogro(ctx, m, datos) {
  const t = titularQueCabe(ctx, datos.titular || [], m.util, 3);
  pintarTitular(ctx, t.lineas, t.tam, m.M, m.titularY);
  const h = datos.heroe || {}, d = medidasHeroe(h, m.util);
  const extraAbajo = d.sola && datos.linea ? 34 : 0;
  const arriba = m.titularY + t.alto + 24, abajo = m.linea1 - 15 - 24;
  // Si no cabe (titular largo), la tarjeta se encoge entera
  const k = Math.min(1, (abajo - arriba - extraAbajo) / d.h), w = d.w * k, alto = d.h * k;
  const y0 = arriba + Math.max(0, (abajo - arriba - alto - extraAbajo) / 2), x0 = m.M + (m.util - w) / 2;
  tarjeta(ctx, x0, y0, w, alto, d.giro, c => { c.scale(k, k); pintarHeroe(c, h, d, d.sola ? '' : datos.linea); }, 26 * k);
  const finTarjeta = y0 + alto;
  if (extraAbajo) { ctx.fillStyle = H.blanco; ctx.font = fuente(700, 15); ctx.textAlign = 'center'; ctx.fillText(datos.linea, m.M + m.util / 2, finTarjeta + 26); ctx.textAlign = 'left'; }
  pie(ctx, m, datos, '¿Te atreves conmigo? ⚔️');
}

/* ---------- API ---------- */
async function dibujar(canvas, datos = {}) {
  await cargarFuentes();
  const img = datos.tipo === 'mapa' ? await cargarImagen(datos.foto) : null;
  const S = H.ancho / H.base, ALTO = H.alto / S, ANCHO = H.base;
  canvas.width = H.ancho; canvas.height = H.alto;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(S, 0, 0, S, 0, 0);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const m = marco(ctx, ANCHO, ALTO);
  if (datos.tipo === 'mapa') cuerpoMapa(ctx, m, datos, img);
  else if (datos.tipo === 'logro') cuerpoLogro(ctx, m, datos);
  else cuerpoPregunta(ctx, m, datos);
  return canvas;
}
async function png(datos) {
  const canvas = document.createElement('canvas');
  await dibujar(canvas, datos);
  return new Promise(res => canvas.toBlob(res, 'image/png'));
}
function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = nombre; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
async function compartir(datos, nombre = 'suizamente.png', preparado) {
  const blob = preparado || await png(datos);
  const archivo = new File([blob], nombre, { type: 'image/png' });
  const texto = (datos.texto || 'Suizamente') + '\nhttps://' + (datos.enlace || ENLACE);
  if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
    try { await navigator.share({ files: [archivo], text: texto }); return 'compartida'; }
    catch (e) { if (e && e.name === 'AbortError') return 'cancelada'; }
  }
  descargar(blob, nombre);
  return 'descargada';
}


export {dibujar,png,compartir,descargar};
export const dibujarHistoria=dibujar, historiaPNG=png;
export const compartirHistoria=(data,blob)=>compartir(data,'suizamente-historia.png',blob);
