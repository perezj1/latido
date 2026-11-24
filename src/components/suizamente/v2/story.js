const HISTORIA = {
  ancho: 1080, alto: 1920, base: 390,                 // se diseña a 390 px de ancho y se escala ×2,77
  fondo: '#4A76EF', tinta: '#0F1A2B', menta: '#24E2C9', blanco: '#FFFFFF', pista: '#F4F7FB',
  barras: ['#4A76EF', '#F9A719', '#24BFE2'],
  fuente: 'Poppins, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "Segoe UI", sans-serif',
};

async function cargarFuentes() {
  if (!document.fonts) return;
  await Promise.all(['500', '600', '700', '800'].map(p => document.fonts.load(`${p} 20px Poppins`).catch(() => null)));
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

/* Titular con una parte resaltada (pastilla menta). Devuelve las líneas ya colocadas. */
function colocarTitular(ctx, partes, ancho, tam) {
  ctx.font = `800 ${tam}px ${HISTORIA.fuente}`;
  const espacio = ctx.measureText(' ').width, pad = 8;
  const fichas = [];
  for (const parte of partes) {
    if (parte.resaltado) fichas.push({ t: parte.t.trim(), resaltado: true, w: ctx.measureText(parte.t.trim()).width + pad * 2 });
    else for (const p of parte.t.split(/\s+/).filter(Boolean)) fichas.push({ t: p, w: ctx.measureText(p).width });
  }
  const lineas = [[]]; let x = 0;
  for (const f of fichas) {
    const extra = lineas[lineas.length - 1].length ? espacio : 0;
    if (x + extra + f.w > ancho && lineas[lineas.length - 1].length) { lineas.push([]); x = 0; }
    const sep = lineas[lineas.length - 1].length ? espacio : 0;
    lineas[lineas.length - 1].push({ ...f, x: x + sep });
    x += sep + f.w;
  }
  return lineas;
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

async function dibujarHistoria(canvas, datos) {
  await cargarFuentes();
  const H = HISTORIA, S = H.ancho / H.base, ALTO = H.alto / S, ANCHO = H.base;
  canvas.width = H.ancho; canvas.height = H.alto;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(S, 0, 0, S, 0, 0);
  ctx.textBaseline = 'middle';

  // Fondo y rayos decorativos (abajo a la derecha)
  ctx.fillStyle = H.fondo; ctx.fillRect(0, 0, ANCHO, ALTO);
  ctx.save();
  ctx.globalAlpha = 0.9; ctx.translate(ANCHO - 300 + 120, ALTO - 300 + 110); ctx.scale(0.75, 0.75);
  ctx.lineCap = 'round'; ctx.lineWidth = 34;
  [['M40 210 95 228', '#03AA98'], ['M105 115 140 157', '#F9A719'], ['M200 70v55', '#FA2F35'], ['M295 115 260 157', '#FFFFFF']]
    .forEach(([d, c]) => { ctx.strokeStyle = c; ctx.stroke(new Path2D(d)); });
  ctx.restore();

  const M = 28, ANCHO_UTIL = ANCHO - M * 2;

  // Cabecera: logo en placa blanca + «Suizamente»
  ctx.fillStyle = H.blanco; rectRedondo(ctx, M, 40, 60, 60, 18); ctx.fill();
  dibujarLogo(ctx, M + 30, 70, 48, 36);
  ctx.fillStyle = H.blanco; ctx.font = `800 24px ${H.fuente}`; ctx.fillText('Suizamente', M + 70, 71);

  // Pie: se calcula primero para saber cuánto sitio queda
  const pieAbajo = ALTO - 32, linea2 = pieAbajo - 11, linea1 = linea2 - 11 - 6 - 15;

  // Tarjeta: medidas
  const tarjetaW = ANCHO_UTIL, pad = 18, interior = tarjetaW - pad * 2;
  ctx.font = `800 15px ${H.fuente}`;
  const lineasPregunta = partir(ctx, datos.pregunta, interior).slice(0, 3);
  const opciones = (datos.opciones || []).slice(0, 3);
  const altoPregunta = lineasPregunta.length * 20.25;
  const altoOpcion = 19.5 + 5 + 12;
  const tarjetaH = pad + altoPregunta + 12 + opciones.length * altoOpcion + Math.max(0, opciones.length - 1) * 12 + pad + (datos.sellos?80:0);

  // Titular: empieza a 30 px y se reduce si no cabe
  const titularY = 40 + 60 + 22;
  let tam = 30, lineasTitular, altoTitular;
  for (; tam >= 22; tam -= 1) {
    lineasTitular = colocarTitular(ctx, datos.titular, ANCHO_UTIL, tam);
    altoTitular = lineasTitular.length * tam * 1.15;
    if (titularY + altoTitular + 22 + tarjetaH + 24 <= linea1 - 15) break;
  }
  ctx.font = `800 ${tam}px ${H.fuente}`;
  const altoLinea = tam * 1.15;
  lineasTitular.forEach((linea, i) => {
    const y = titularY + i * altoLinea + altoLinea / 2;
    for (const f of linea) {
      if (f.resaltado) {
        ctx.fillStyle = H.menta; rectRedondo(ctx, M + f.x, y - altoLinea / 2 + 1, f.w, altoLinea - 2, 10); ctx.fill();
        ctx.fillStyle = H.tinta; ctx.fillText(f.t, M + f.x + 8, y + 1);
      } else { ctx.fillStyle = H.blanco; ctx.fillText(f.t, M + f.x, y + 1); }
    }
  });

  // Tarjeta blanca girada −2°
  const tarjetaY = titularY + altoTitular + 22;
  ctx.save();
  ctx.translate(M + tarjetaW / 2, tarjetaY + tarjetaH / 2); ctx.rotate(-2 * Math.PI / 180); ctx.translate(-tarjetaW / 2, -tarjetaH / 2);
  ctx.shadowColor = 'rgba(15,26,43,0.18)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
  ctx.fillStyle = H.blanco; rectRedondo(ctx, 0, 0, tarjetaW, tarjetaH, 26); ctx.fill();
  ctx.shadowColor = 'transparent';
  let y = pad;
  ctx.fillStyle = H.tinta; ctx.font = `800 15px ${H.fuente}`;
  lineasPregunta.forEach(l => { ctx.fillText(l, pad, y + 10.1); y += 20.25; });
  y += 12;
  opciones.forEach((op, i) => {
    const pct = op.pct == null ? null : Math.max(0, Math.min(100, Math.round(op.pct)));
    ctx.font = `700 13px ${H.fuente}`;
    const textoPct = pct == null ? '' : pct + ' %', anchoPct = ctx.measureText(textoPct).width;
    ctx.fillStyle = H.tinta;
    ctx.fillText(recortar(ctx, op.texto, interior - anchoPct - 12), pad, y + 9.75);
    ctx.textAlign = 'right'; ctx.fillText(textoPct, pad + interior, y + 9.75); ctx.textAlign = 'left';
    y += 19.5 + 5;
    ctx.fillStyle = H.pista; rectRedondo(ctx, pad, y, interior, 12, 6); ctx.fill();
    if (pct > 0) { ctx.fillStyle = H.barras[i] || H.barras[0]; rectRedondo(ctx, pad, y, Math.max(12, interior * pct / 100), 12, 6); ctx.fill(); }
    y += 12 + 12;
  });
  if(datos.sellos){
    datos.sellos.forEach((row,i)=>{
      ctx.fillStyle=H.tinta;ctx.font=`700 12px ${H.fuente}`;ctx.fillText(i?'Rival':'Tú',pad,y+10)
      ctx.font=`700 20px ${H.fuente}`;ctx.fillText(row||'—',pad+52,y+10);y+=34
    })
  }
  ctx.restore();

  // Pie
  ctx.fillStyle = H.blanco;
  ctx.font = `800 20px ${H.fuente}`; ctx.fillText(datos.cierre || '¿Y tú qué eliges? 🤔', M, linea1);
  ctx.font = `600 15px ${H.fuente}`; ctx.fillText('👉 Juega en ' + (datos.enlace || 'latido.ch/suizamente'), M, linea2);
  return canvas;
}

async function historiaPNG(datos) {
  const canvas = document.createElement('canvas');
  await dibujarHistoria(canvas, datos);
  return new Promise(res => canvas.toBlob(res, 'image/png'));
}

async function compartirHistoria(datos) {
  const blob = await historiaPNG(datos);
  const archivo = new File([blob], 'suizamente-historia.png', { type: 'image/png' });
  const texto = 'Suizamente · ' + (datos.enlace || 'latido.ch/suizamente');
  if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
    try { await navigator.share({ files: [archivo], text: texto }); return 'compartida'; }
    catch (e) { if (e && e.name === 'AbortError') return 'cancelada'; }
  }
  descargarBlob(blob, 'suizamente-historia.png');
  return 'descargada';
}

function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = nombre; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export { dibujarHistoria, historiaPNG, compartirHistoria };
