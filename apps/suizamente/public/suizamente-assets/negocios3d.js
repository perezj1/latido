/* Suizamente · Tu negocio en el mapa: las figuras low poly de los negocios (THREE r128, como mapa3d.js).
   Propuesta de la página 3 del lienzo, pendiente de aprobar por Latido.
   Cada figura mira hacia +z y mide como una decoración (cabe en la losa hexagonal de radio 1,9).
   El color (toldo, cartel y detalles) es uno de los 6 de Latido; el resto, colores naturales de la maqueta.
   API: Negocios3D.TIPOS, COLORES, modelo(k, color), colocar(escena, n, ancla, u), foto(k, { color, ancho }) */
(function (G) {
'use strict';
const T = () => G.THREE;

const COLORES = ['#24E2C9', '#03AA98', '#F9A719', '#FA2F35', '#4A76EF', '#24BFE2'];
const B = '#FFFFFF', MURO = '#F4F7FB', CREMA = '#FFF3E0', GRIS = '#DCE2EA', PIZARRA = '#5A6577', OSCURO = '#3D4757';
const CRISTAL = '#BDEEF8', MADERA = '#B07A4E', PAN = '#D9A05B', HIERBA = '#97C95A', TIERRA = '#8C5E3C';

const TIPOS = [
  { k: 'restaurante', nombre: 'Restaurante' },
  { k: 'cafe', nombre: 'Café' },
  { k: 'tienda', nombre: 'Tienda' },
  { k: 'panaderia', nombre: 'Panadería' },
  { k: 'peluqueria', nombre: 'Peluquería' },
  { k: 'escuela', nombre: 'Escuela' },
  { k: 'oficina', nombre: 'Oficina' },
  { k: 'foodtruck', nombre: 'Food truck' },
];

/* ---------- Piezas ---------- */
const mats = {};
const mat = c => mats[c] || (mats[c] = new (T().MeshStandardMaterial)({ color: c, roughness: 0.85, metalness: 0, flatShading: true }));
const m = (geo, c, x = 0, y = 0, z = 0) => { const o = new (T().Mesh)(geo, mat(c)); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; };
const Bx = (w, h, d) => new (T().BoxGeometry)(w, h, d);
const Cy = (a, b, h, s = 8) => new (T().CylinderGeometry)(a, b, h, s);
const Co = (r, h, s = 8) => new (T().ConeGeometry)(r, h, s);
const Ic = (r, d = 0) => new (T().IcosahedronGeometry)(r, d);
const grupo = () => new (T().Group)();
const losa = (r = 1.9) => { const g = grupo(); g.add(m(Cy(r, r, 0.45, 6), TIERRA, 0, -0.32, 0)); g.add(m(Cy(r, r, 0.12, 6), HIERBA, 0, -0.04, 0)); return g; };

// Tejado a dos aguas a lo largo de x: largo, fondo (con alero) y alto
const tejado = (largo, fondo, alto, c, y, z = 0) => {
  const r = fondo / 1.732, geo = new (T().CylinderGeometry)(r, r, largo, 3, 1, false, Math.PI / 2);
  geo.rotateZ(Math.PI / 2); geo.scale(1, alto / (1.5 * r), 1);
  return m(geo, c, 0, y + alto / 3, z);
};
// Toldo de rayas (color y blanco) en la fachada: ancho, a la altura y y con la fachada en z
const toldo = (w, c, y, z, n = 6) => {
  const g = grupo(), a = w / n;
  for (let i = 0; i < n; i++) { const t = m(Bx(a, 0.05, 0.5), i % 2 ? B : c, -w / 2 + a * (i + 0.5), 0, 0); g.add(t); }
  g.add(m(Bx(w, 0.12, 0.05), c, 0, -0.06, 0.25));
  g.rotation.x = 0.42; g.position.set(0, y, z + 0.2);
  return g;
};
// Cartel encima del toldo: placa de color con una franja blanca (el nombre va en la app, como etiqueta)
const cartel = (w, c, y, z) => { const g = grupo(); g.add(m(Bx(w, 0.32, 0.06), c, 0, y, z + 0.03)); g.add(m(Bx(w * 0.78, 0.1, 0.02), B, 0, y, z + 0.07)); return g; };
const puerta = (x, z, h = 0.62) => m(Bx(0.36, h, 0.04), PIZARRA, x, h / 2, z + 0.02);
const ventana = (x, y, z, w = 0.42, h = 0.36) => m(Bx(w, h, 0.04), CRISTAL, x, y, z + 0.02);
const mesa = (x, z, c) => { const g = grupo(); g.add(m(Cy(0.04, 0.04, 0.36, 6), PIZARRA, 0, 0.18, 0)); g.add(m(Cy(0.2, 0.2, 0.04, 10), B, 0, 0.38, 0)); if (c) { g.add(m(Cy(0.025, 0.025, 0.55, 6), PIZARRA, 0, 0.66, 0)); g.add(m(Co(0.42, 0.22, 8), c, 0, 0.98, 0)); } g.position.set(x, 0, z); return g; };
const silla = (x, z, c) => m(Bx(0.16, 0.22, 0.16), c, x, 0.11, z);
const maceta = (x, z) => { const g = grupo(); g.add(m(Cy(0.12, 0.09, 0.18, 6), MADERA, 0, 0.09, 0)); g.add(m(Ic(0.17, 0), '#4CA957', 0, 0.3, 0)); g.position.set(x, 0, z); return g; };

/* ---------- Las 8 figuras ---------- */
const MODELOS = {
  restaurante(c) {
    const g = grupo(), z = 0.25;
    g.add(m(Bx(2.4, 1.4, 1.5), CREMA, 0, 0.7, -0.5));
    g.add(tejado(2.6, 1.8, 0.62, PIZARRA, 1.4, -0.5));
    g.add(puerta(0, z)); g.add(ventana(-0.75, 0.62, z)); g.add(ventana(0.75, 0.62, z));
    g.add(toldo(2.2, c, 1.0, z)); g.add(cartel(1.4, c, 1.24, z));
    g.add(mesa(-0.6, 1.0, c)); g.add(mesa(0.65, 1.05, c));
    for (const [x, zz] of [[-0.88, 1.0], [-0.32, 1.0], [0.37, 1.05], [0.93, 1.05]]) g.add(silla(x, zz, B));
    return g;
  },
  cafe(c) {
    const g = grupo(), z = 0.2;
    g.add(m(Bx(1.8, 1.3, 1.4), MURO, 0, 0.65, -0.5));
    g.add(m(Bx(1.95, 0.12, 1.55), GRIS, 0, 1.36, -0.5));
    g.add(puerta(-0.45, z)); g.add(ventana(0.35, 0.62, z, 0.7, 0.42));
    g.add(toldo(1.6, c, 0.98, z)); g.add(cartel(1.1, c, 1.2, z));
    // La taza grande del tejado
    g.add(m(Cy(0.5, 0.5, 0.06, 12), c, 0, 1.45, -0.5));
    g.add(m(Cy(0.34, 0.27, 0.46, 12), B, 0, 1.71, -0.5));
    g.add(m(Cy(0.345, 0.345, 0.1, 12), c, 0, 1.78, -0.5));
    g.add(m(Cy(0.29, 0.29, 0.03, 12), MADERA, 0, 1.94, -0.5));
    const asa = m(new (T().TorusGeometry)(0.13, 0.045, 6, 10), B, 0.38, 1.72, -0.5); g.add(asa);
    g.add(mesa(0.55, 0.95)); g.add(silla(0.28, 0.95, c)); g.add(silla(0.82, 0.95, c)); g.add(maceta(-0.75, 0.6));
    return g;
  },
  tienda(c) {
    const g = grupo(), z = 0.2;
    g.add(m(Bx(2.2, 1.35, 1.4), CREMA, 0, 0.675, -0.5));
    g.add(m(Bx(2.3, 0.12, 1.5), GRIS, 0, 1.4, -0.5));
    g.add(m(Bx(2.3, 0.22, 0.08), GRIS, 0, 1.55, 0.21));
    g.add(puerta(0, z)); g.add(ventana(-0.7, 0.6, z, 0.5)); g.add(ventana(0.7, 0.6, z, 0.5));
    g.add(toldo(2.1, c, 0.98, z, 8)); g.add(cartel(1.3, c, 1.22, z));
    // Cajas de fruta
    const frutas = ['#FA2F35', '#F9A719', '#8CC64F'];
    [[-0.7, 0.95], [0, 1.05], [0.7, 0.95]].forEach(([x, zz], i) => {
      g.add(m(Bx(0.5, 0.24, 0.36), MADERA, x, 0.12, zz));
      for (let j = 0; j < 4; j++) g.add(m(Ic(0.085, 0), frutas[i], x - 0.15 + (j % 2) * 0.3 - (j > 1 ? 0.0 : 0), 0.3, zz - 0.08 + (j > 1 ? 0.16 : 0)));
    });
    return g;
  },
  panaderia(c) {
    const g = grupo(), z = 0.2;
    g.add(m(Bx(1.9, 1.35, 1.4), CREMA, 0, 0.675, -0.5));
    g.add(tejado(2.1, 1.7, 0.6, PIZARRA, 1.35, -0.5));
    g.add(puerta(-0.45, z)); g.add(ventana(0.4, 0.62, z, 0.62, 0.42));
    g.add(toldo(1.7, c, 0.98, z)); g.add(cartel(1.1, c, 1.22, z));
    // Una barra de pan enorme en el tejado
    const pan = m(new (T().SphereGeometry)(0.5, 10, 6), PAN, 0, 2.08, -0.5); pan.scale.set(1.25, 0.42, 0.5); g.add(pan);
    for (const x of [-0.3, 0, 0.3]) { const corte = m(Bx(0.07, 0.04, 0.26), '#F4D19B', x, 2.28, -0.5); corte.rotation.y = 0.5; g.add(corte); }
    g.add(m(Bx(0.5, 0.06, 0.32), MADERA, 0.55, 0.38, 0.55)); g.add(m(Bx(0.05, 0.38, 0.05), MADERA, 0.55, 0.19, 0.55));
    for (const x of [0.42, 0.62]) { const p = m(new (T().SphereGeometry)(0.11, 8, 5), PAN, x, 0.46, 0.55); p.scale.set(1.3, 0.6, 0.8); g.add(p); }
    return g;
  },
  peluqueria(c) {
    const g = grupo(), z = 0.2;
    g.add(m(Bx(1.7, 1.4, 1.35), MURO, 0, 0.7, -0.475));
    g.add(m(Bx(1.85, 0.12, 1.5), GRIS, 0, 1.46, -0.475));
    g.add(puerta(-0.35, z)); g.add(ventana(0.4, 0.66, z, 0.6, 0.5));
    g.add(toldo(1.5, c, 1.04, z)); g.add(cartel(1.0, c, 1.28, z));
    // Poste de peluquería
    g.add(m(Cy(0.13, 0.15, 0.1, 10), PIZARRA, -0.95, 0.05, 0.45));
    g.add(m(Cy(0.09, 0.09, 0.9, 10), B, -0.95, 0.55, 0.45));
    for (let i = 0; i < 4; i++) g.add(m(Cy(0.095, 0.095, 0.08, 10), c, -0.95, 0.2 + i * 0.22, 0.45));
    g.add(m(new (T().SphereGeometry)(0.12, 8, 6), c, -0.95, 1.06, 0.45));
    g.add(maceta(0.85, 0.6));
    return g;
  },
  escuela(c) {
    const g = grupo(), z = 0.2;
    g.add(m(Bx(2.2, 2.0, 1.4), MURO, 0, 1.0, -0.5));
    g.add(tejado(2.4, 1.7, 0.6, PIZARRA, 2.0, -0.5));
    for (const x of [-0.7, 0, 0.7]) g.add(ventana(x, 1.5, z, 0.4, 0.34));
    g.add(ventana(-0.7, 0.62, z, 0.4)); g.add(ventana(0.7, 0.62, z, 0.4)); g.add(puerta(0, z));
    g.add(m(Bx(0.7, 0.06, 0.4), c, 0, 0.74, z + 0.2)); g.add(cartel(1.3, c, 1.1, z));
    // Dos bocadillos de conversación en el tejado (idiomas)
    const b1 = m(Ic(0.36, 1), c, -0.4, 3.0, -0.25); b1.scale.set(1.15, 0.8, 0.4); g.add(b1);
    const c1 = m(Co(0.1, 0.22, 4), c, -0.66, 2.71, -0.25); c1.rotation.z = 0.5; g.add(c1);
    const b2 = m(Ic(0.3, 1), B, 0.42, 2.86, -0.15); b2.scale.set(1.15, 0.8, 0.4); g.add(b2);
    const c2 = m(Co(0.08, 0.18, 4), B, 0.64, 2.62, -0.15); c2.rotation.z = -0.5; g.add(c2);
    return g;
  },
  oficina(c) {
    const g = grupo(), z = 0.2;
    g.add(m(Bx(1.7, 2.7, 1.4), B, 0, 1.35, -0.5));
    g.add(m(Bx(1.8, 0.12, 1.5), GRIS, 0, 2.76, -0.5));
    g.add(m(Bx(1.72, 0.24, 1.42), c, 0, 2.55, -0.5));
    for (const y of [1.2, 1.75, 2.2]) for (const x of [-0.5, 0, 0.5]) g.add(ventana(x, y, z, 0.32, 0.3));
    g.add(m(Bx(0.7, 0.6, 0.04), CRISTAL, 0, 0.3, z + 0.02));
    g.add(m(Bx(0.95, 0.06, 0.5), c, 0, 0.72, z + 0.25));
    g.add(maceta(-0.6, 0.5)); g.add(maceta(0.6, 0.5));
    return g;
  },
  foodtruck(c) {
    const g = grupo();
    g.add(m(Bx(1.6, 0.95, 1.0), c, -0.25, 0.8, 0));
    g.add(m(Bx(1.7, 0.08, 1.06), B, -0.25, 1.31, 0));
    g.add(m(Bx(0.55, 0.7, 0.95), B, 0.82, 0.68, 0));
    g.add(m(Bx(0.04, 0.3, 0.8), CRISTAL, 1.1, 0.85, 0));
    for (const [x, zz] of [[-0.75, 0.48], [0.25, 0.48], [0.8, 0.48], [-0.75, -0.48], [0.25, -0.48], [0.8, -0.48]].filter((p, i) => i !== 1 && i !== 4)) { const r = m(Cy(0.2, 0.2, 0.12, 10), OSCURO, x, 0.2, zz); r.rotation.x = Math.PI / 2; g.add(r); }
    g.add(m(Bx(1.0, 0.42, 0.04), OSCURO, -0.3, 0.92, 0.51));
    g.add(m(Bx(1.0, 0.06, 0.1), B, -0.3, 0.7, 0.56));
    const tapa = m(Bx(1.1, 0.05, 0.4), B, -0.3, 1.2, 0.68); tapa.rotation.x = 0.35; g.add(tapa);
    g.add(m(Bx(1.2, 0.26, 0.05), B, -0.25, 1.48, 0.25)); g.add(m(Bx(0.94, 0.08, 0.02), c, -0.25, 1.48, 0.28));
    g.add(mesa(-0.6, 1.1, c)); g.add(silla(-0.88, 1.1, B));
    const pizarra = m(Bx(0.32, 0.4, 0.05), PIZARRA, 0.65, 0.2, 1.0); pizarra.rotation.x = -0.15; g.add(pizarra);
    return g;
  },
};

const modelo = (k, color = COLORES[0]) => { if (!MODELOS[k]) throw new Error('Negocio desconocido: ' + k); const g = MODELOS[k](color); g.userData.negocio = k; return g; };

// n: { k, color, dx, dz, escala, giro } desde el ancla del cantón, en unidades del cantón (u), como las decoraciones
function colocar(escena, n, ancla, u) {
  const g = modelo(n.k, n.color);
  g.scale.setScalar((n.escala || 1) * u);
  g.position.set(ancla.x + (n.dx || 0) * u, ancla.y + 0.02, ancla.z + (n.dz || 0) * u);
  g.rotation.y = n.giro || 0;
  escena.add(g);
  return g;
}

// Miniatura con la luz de la maqueta, fondo transparente y recortada al dibujo (como Decoraciones3D.foto)
function foto(k, op = {}) {
  const THREE = T(), lado = op.ancho || 360;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(2); r.setSize(lado, lado, false); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  const e = new THREE.Scene();
  e.add(new THREE.HemisphereLight('#FFFFFF', '#B49A7A', 0.6));
  const sol = new THREE.DirectionalLight('#FFF4E0', 0.72); sol.position.set(6, 10, 5); sol.castShadow = true; sol.shadow.mapSize.set(1024, 1024); e.add(sol);
  e.add(new THREE.AmbientLight('#FFFFFF', 0.25));
  const g = modelo(k, op.color); g.add(losa()); e.add(g);
  const caja = new THREE.Box3().setFromObject(g), c = caja.getCenter(new THREE.Vector3()), s = caja.getSize(new THREE.Vector3());
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  cam.position.copy(new THREE.Vector3().setFromSphericalCoords(Math.max(s.x, s.y, s.z) * 2.3, 1.05, 0.5).add(c)); cam.lookAt(c);
  r.render(e, cam);
  const cv = document.createElement('canvas'); cv.width = r.domElement.width; cv.height = r.domElement.height;
  const x = cv.getContext('2d'); x.drawImage(r.domElement, 0, 0);
  const d = x.getImageData(0, 0, cv.width, cv.height).data; let x0 = cv.width, y0 = cv.height, x1 = 0, y1 = 0;
  for (let yy = 0; yy < cv.height; yy++) for (let xx = 0; xx < cv.width; xx++) if (d[(yy * cv.width + xx) * 4 + 3] > 8) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
  const mg = 10, w = Math.max(x1 - x0, y1 - y0) + mg * 2, o = document.createElement('canvas'); o.width = w; o.height = w;
  o.getContext('2d').drawImage(cv, x0 - mg - (w - mg * 2 - (x1 - x0)) / 2, y0 - mg - (w - mg * 2 - (y1 - y0)) / 2, w, w, 0, 0, w, w);
  r.dispose();
  return o;
}

G.Negocios3D = { TIPOS, COLORES, modelo, colocar, foto };
})(typeof window !== 'undefined' ? window : this);
