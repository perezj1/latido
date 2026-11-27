// Referencia de las decoraciones low poly de «Decora tu Suiza» (MEJORAS.md, sección 4). Propuesta pendiente de
// aprobar por Latido: no se usa en juego.html ni cambia nada de mapa3d.js.
/* Suizamente · decoraciones del mapa 3D.
   Necesita THREE (r128) cargado antes, como mapa3d.js. Mismo estilo que la maqueta: geometrías simples,
   flatShading, sombras y los colores de Latido con los naturales de la maqueta.
   API:
     Decoraciones3D.TIPOS                 → [{ k, nombre, coleccion, hueco }] (hueco: 'tierra' | 'agua' | 'aire')
     Decoraciones3D.modelo(k)             → THREE.Group del elemento, a escala 1 (se escala con escala · can.u)
     Decoraciones3D.colocar(escena, h, ancla, u) → pone el elemento del hueco h en la escena:
         posición = ancla + (dx, dy, dz) · u, tamaño = escala · u, giro = giro (radianes, eje Y).
         ancla: el centro del cantón (centroMundo(can) en mapa3d.js) o, para 'agua', el centro de la parte de
         arriba de su lago (Box3 de can.agua); u: can.u (la medida del cantón en mapa3d.js).
     Decoraciones3D.foto(k, { ancho })    → dataURL PNG del elemento sobre su losa hexagonal, con fondo
         transparente y recortado (las miniaturas de disenos/decoraciones/ salen de aquí)
     Decoraciones3D.EJEMPLO               → los 5 huecos de la isla de ejemplo de mejoras.html (#MapaDecorar) */
(function (G) {
'use strict';
const T = () => G.THREE;

/* ---------- Colores ---------- */
const AZ = '#4A76EF', RO = '#FA2F35', NA = '#F9A719', CE = '#24BFE2', B = '#FFFFFF';
const HIERBA = '#97C95A', TIERRA = '#8C5E3C', AGUA = '#55B8EA', AGUA_LADO = '#3E9BD0';

/* ---------- Piezas ---------- */
const mats = {};
const mat = (c, x = {}) => { const k = c + JSON.stringify(x); return mats[k] || (mats[k] = new (T().MeshStandardMaterial)({ color: c, roughness: 0.85, metalness: 0, flatShading: true, ...x })); };
const m = (geo, c, x = 0, y = 0, z = 0, x2) => { const o = new (T().Mesh)(geo, mat(c, x2)); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; };
const Bx = (w, h, d) => new (T().BoxGeometry)(w, h, d);
const Cy = (a, b, h, s = 8) => new (T().CylinderGeometry)(a, b, h, s);
const Co = (r, h, s = 6) => new (T().ConeGeometry)(r, h, s);
const Ic = (r, d = 0) => new (T().IcosahedronGeometry)(r, d);
const grupo = () => new (T().Group)();

// Losa hexagonal como las de la maqueta (solo para las miniaturas)
const losa = (arriba = HIERBA, lado = TIERRA, r = 1.9) => { const g = grupo(); g.add(m(Cy(r, r, 0.45, 6), lado, 0, -0.32, 0)); g.add(m(Cy(r, r, 0.12, 6), arriba, 0, -0.04, 0)); return g; };

const vaca = (col = B, mancha = TIERRA, patas = '#8A94A6', x2) => {
  const g = grupo();
  g.add(m(Bx(0.9, 0.48, 0.44), col, 0, 0.52, 0, x2)); g.add(m(Bx(0.34, 0.32, 0.32), col, 0.56, 0.64, 0, x2));
  g.add(m(Bx(0.3, 0.05, 0.4), mancha, -0.12, 0.765, 0, x2)); g.add(m(Bx(0.22, 0.2, 0.05), mancha, 0.12, 0.55, 0.225, x2));
  g.add(m(Bx(0.1, 0.1, 0.34), x2 ? mancha : '#F3A296', 0.73, 0.56, 0, x2));
  for (const z of [0.12, -0.12]) g.add(m(Co(0.035, 0.14, 4), x2 ? mancha : '#F4F7FB', 0.52, 0.86, z, x2));
  for (const [x, z] of [[0.3, 0.14], [0.3, -0.14], [-0.3, 0.14], [-0.3, -0.14]]) g.add(m(Bx(0.1, 0.3, 0.1), patas, x, 0.15, z, x2));
  g.add(m(Co(0.07, 0.12, 6), NA, 0.56, 0.42, 0, x2)); // el cencerro
  return g;
};

/* ---------- Los elementos ---------- */
const MODELOS = {
  tren() {
    const g = grupo();
    for (const z of [0.22, -0.22]) g.add(m(Bx(4.2, 0.06, 0.06), '#8A94A6', 0, 0.06, z));
    for (let i = 0; i < 9; i++) g.add(m(Bx(0.12, 0.05, 0.7), '#7A5236', -1.9 + i * 0.475, 0.02, 0));
    for (let i = 0; i < 3; i++) {
      const c = grupo();
      c.add(m(Bx(1.1, 0.62, 0.62), RO, 0, 0.5, 0)); c.add(m(Bx(1.12, 0.1, 0.64), '#F4F7FB', 0, 0.86, 0)); c.add(m(Bx(0.86, 0.18, 0.64), B, 0, 0.6, 0));
      for (const wx of [-0.35, 0.35]) for (const wz of [0.27, -0.27]) { const w = m(Cy(0.11, 0.11, 0.06, 8), '#3D4757', wx, 0.17, wz); w.rotation.x = Math.PI / 2; c.add(w); }
      if (i === 2) { c.add(m(Bx(0.3, 0.42, 0.6), RO, 0.62, 0.42, 0)); c.add(m(Bx(0.06, 0.16, 0.5), B, 0.78, 0.62, 0)); }
      c.position.x = -1.25 + i * 1.25; g.add(c);
    }
    return g;
  },
  vacas() {
    const g = grupo();
    const a = vaca(); a.position.set(-0.55, 0, 0.3); a.rotation.y = -0.7; g.add(a);
    const b = vaca(B, '#3D4757'); b.position.set(0.55, 0, -0.4); b.rotation.y = -1.9; g.add(b);
    for (const [x, z] of [[1.1, 0.6], [-1.1, -0.6], [0.2, 0.95]]) g.add(m(Ic(0.18), '#68B04A', x, 0.12, z));
    return g;
  },
  globo() {
    const g = grupo();
    const tela = m(new (T().SphereGeometry)(1, 8, 6), RO, 0, 2.6, 0); tela.scale.y = 1.12; g.add(tela);
    g.add(m(Cy(1.02, 1.02, 0.28, 8), NA, 0, 2.55, 0));
    const abajo = m(Co(0.62, 0.7, 8), RO, 0, 1.45, 0); abajo.rotation.x = Math.PI; g.add(abajo);
    g.add(m(Bx(0.46, 0.34, 0.46), '#A36B42', 0, 0.62, 0));
    for (const [x, z] of [[0.2, 0.2], [0.2, -0.2], [-0.2, 0.2], [-0.2, -0.2]]) g.add(m(Cy(0.015, 0.015, 0.5, 4), '#3D4757', x, 1.0, z));
    return g;
  },
  teleferico() {
    const g = grupo();
    g.add(m(Co(1.05, 2.2, 7), '#E4E8ED', 0.9, 1.1, -0.4)); g.add(m(Co(0.42, 0.7, 7), B, 0.9, 1.95, -0.4));
    const pilar = (x, h) => { const p = grupo(); p.add(m(Bx(0.12, h, 0.12), '#A9B2BE', 0, h / 2, 0)); p.add(m(Bx(0.6, 0.08, 0.1), '#A9B2BE', 0, h, 0)); p.position.x = x; return p; };
    g.add(pilar(-1.4, 1.2)); g.add(pilar(0.55, 2.1));
    const V = T().Vector3, abajo = new V(-1.4, 1.2, 0), arriba = new V(0.55, 2.1, 0), medio = abajo.clone().add(arriba).multiplyScalar(0.5);
    const cable = m(Cy(0.018, 0.018, abajo.distanceTo(arriba), 4), '#3D4757', medio.x, medio.y, 0);
    cable.rotation.z = Math.atan2(arriba.y - abajo.y, arriba.x - abajo.x) - Math.PI / 2; g.add(cable);
    const cabina = grupo(); cabina.add(m(Bx(0.42, 0.36, 0.34), RO, 0, 0, 0)); cabina.add(m(Bx(0.44, 0.12, 0.36), B, 0, 0.05, 0)); cabina.add(m(Cy(0.015, 0.015, 0.24, 4), '#3D4757', 0, 0.3, 0));
    cabina.position.set(-0.45, 1.32, 0); g.add(cabina);
    for (const [x, z] of [[-1.1, 0.7], [-0.3, 0.8]]) { const a = grupo(); a.add(m(Cy(0.05, 0.07, 0.25, 5), '#7A5236', 0, 0.12, 0)); a.add(m(Co(0.28, 0.6, 6), '#3E9A4E', 0, 0.5, 0)); a.position.set(x, 0, z); g.add(a); }
    return g;
  },
  barco() {
    const g = grupo();
    g.add(m(Bx(2.0, 0.36, 0.72), B, -0.1, 0.18, 0));
    const proa = m(Bx(0.51, 0.36, 0.51), B, 0.9, 0.18, 0); proa.rotation.y = Math.PI / 4; g.add(proa);
    g.add(m(Bx(2.02, 0.08, 0.74), AZ, -0.1, 0.1, 0)); g.add(m(Bx(1.2, 0.34, 0.56), B, -0.25, 0.53, 0)); g.add(m(Bx(1.24, 0.06, 0.6), '#F4F7FB', -0.25, 0.73, 0));
    for (let i = 0; i < 4; i++) g.add(m(Bx(0.14, 0.12, 0.58), CE, -0.65 + i * 0.27, 0.56, 0)); // ventanas
    g.add(m(Cy(0.13, 0.13, 0.55, 8), NA, 0.05, 1.0, 0)); g.add(m(Cy(0.14, 0.14, 0.1, 8), '#3D4757', 0.05, 1.27, 0)); // chimenea
    for (const z of [0.4, -0.4]) { const r = m(Cy(0.22, 0.22, 0.1, 8), RO, -0.35, 0.3, z); r.rotation.x = Math.PI / 2; g.add(r); } // ruedas de palas
    return g;
  },
  torre() {
    const g = grupo();
    g.add(m(Bx(0.9, 2.4, 0.9), '#F8F5EE', 0, 1.2, 0)); g.add(m(Bx(1.0, 0.16, 1.0), AZ, 0, 1.75, 0)); g.add(m(Bx(1.04, 0.3, 1.04), '#E4E8EF', 0, 0.15, 0));
    const tejado = m(Co(0.78, 0.9, 4), RO, 0, 2.85, 0); tejado.rotation.y = Math.PI / 4; g.add(tejado);
    const esfera = m(Cy(0.3, 0.3, 0.06, 12), B, 0, 2.05, 0.47); esfera.rotation.x = Math.PI / 2; g.add(esfera);
    g.add(m(new (T().TorusGeometry)(0.3, 0.04, 4, 12), NA, 0, 2.05, 0.5));
    g.add(m(Bx(0.04, 0.2, 0.02), '#0F1A2B', 0, 2.12, 0.51)); g.add(m(Bx(0.15, 0.04, 0.02), '#0F1A2B', 0.06, 2.05, 0.51)); // agujas
    g.add(m(Bx(0.3, 0.5, 0.06), AZ, 0, 0.55, 0.46)); // puerta
    return g;
  },
  vacaOro() {
    const g = grupo();
    g.add(m(Bx(1.3, 0.5, 0.9), '#F4F7FB', 0, 0.25, 0)); g.add(m(Bx(1.4, 0.1, 1.0), AZ, 0, 0.52, 0)); // pedestal
    const v = vaca(NA, '#FCD38C', NA, { metalness: 0.15, roughness: 0.5 }); v.scale.setScalar(1.25); v.position.set(-0.1, 0.57, 0); v.rotation.y = -0.9; g.add(v);
    return g;
  },
  abeto() {
    const g = grupo();
    g.add(m(Cy(0.12, 0.16, 0.4, 6), '#7A5236', 0, 0.2, 0));
    [[1.05, 1.0, 0.75], [0.82, 0.9, 1.3], [0.58, 0.8, 1.8]].forEach(([r, h, y]) => g.add(m(Co(r, h, 7), '#2F8A47', 0, y, 0)));
    for (const [x, y, z, c] of [[0.6, 0.62, 0.3, RO], [-0.45, 0.75, 0.45, NA], [0.15, 1.2, 0.55, AZ], [-0.3, 1.45, -0.35, RO], [0.38, 1.0, -0.5, CE], [-0.62, 0.62, -0.25, CE], [0.05, 1.7, 0.3, NA]]) g.add(m(Ic(0.09), c, x, y, z));
    g.add(m(new (T().OctahedronGeometry)(0.2), NA, 0, 2.3, 0)); // la estrella
    return g;
  },
};

// Qué es cada uno y en qué hueco va. Nombres y colecciones: ejemplos pendientes de aprobar por Latido.
const TIPOS = [
  { k: 'tren', nombre: 'Tren regional', coleccion: 'Trenes', hueco: 'tierra' },
  { k: 'vacas', nombre: 'Vacas con cencerro', coleccion: 'Animales', hueco: 'tierra' },
  { k: 'globo', nombre: 'Globo', coleccion: 'Aire', hueco: 'aire' },
  { k: 'teleferico', nombre: 'Teleférico', coleccion: 'Montaña', hueco: 'tierra' },
  { k: 'barco', nombre: 'Barco de vapor', coleccion: 'Agua', hueco: 'agua' },
  { k: 'torre', nombre: 'Torre del reloj', coleccion: 'Monumentos', hueco: 'tierra' },
  { k: 'vacaOro', nombre: 'Vaca de oro', coleccion: 'Prestigio', hueco: 'tierra' },
  { k: 'abeto', nombre: 'Abeto de Navidad', coleccion: 'Fiestas', hueco: 'tierra' },
];

// Los 5 huecos ocupados de la isla de ejemplo (Suiza central, mejoras.html #MapaDecorar).
// dx, dy, dz: desde el ancla, en unidades del cantón (can.u). El globo flota (dy 3.2); el barco va en el lago.
const EJEMPLO = [
  { canton: 'LU', k: 'tren', dx: 0.6, dy: 0, dz: 2.6, escala: 0.7, giro: 0.2 },
  { canton: 'UR', k: 'vacas', dx: -1.6, dy: 0, dz: 1.8, escala: 0.8, giro: 0.1 },
  { canton: 'SZ', k: 'globo', dx: 0.4, dy: 3.2, dz: -0.8, escala: 0.95, giro: 0 },
  { canton: 'UR', k: 'teleferico', dx: 1.6, dy: 0, dz: -2.6, escala: 0.8, giro: 0.3 },
  { canton: 'LU', k: 'barco', dx: 0.6, dy: 0, dz: 0.1, escala: 0.6, giro: 0.6 },
];

const modelo = k => { if (!MODELOS[k]) throw new Error('Decoración desconocida: ' + k); return MODELOS[k](); };

function colocar(escena, h, ancla, u) {
  const g = modelo(h.k);
  g.scale.setScalar((h.escala || 1) * u);
  g.position.set(ancla.x + (h.dx || 0) * u, ancla.y + 0.02 + (h.dy || 0) * u, ancla.z + (h.dz || 0) * u);
  g.rotation.y = h.giro || 0;
  g.userData.decoracion = h.k;
  escena.add(g);
  return g;
}

// Miniatura: escena propia con la misma luz que la maqueta, fondo transparente y recortada al dibujo
function foto(k, op = {}) {
  const THREE = T(), lado = op.ancho || 360;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(2); r.setSize(lado, lado, false); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  const e = new THREE.Scene();
  e.add(new THREE.HemisphereLight('#FFFFFF', '#B49A7A', 0.6));
  const sol = new THREE.DirectionalLight('#FFF4E0', 0.72); sol.position.set(6, 10, 5); sol.castShadow = true; sol.shadow.mapSize.set(1024, 1024); e.add(sol);
  e.add(new THREE.AmbientLight('#FFFFFF', 0.25));
  const tipo = (TIPOS.find(t => t.k === k) || {}).hueco;
  const g = modelo(k); g.add(tipo === 'agua' ? losa(AGUA, AGUA_LADO) : k === 'abeto' ? losa(B, TIERRA) : losa()); e.add(g);
  const caja = new THREE.Box3().setFromObject(g), c = caja.getCenter(new THREE.Vector3()), s = caja.getSize(new THREE.Vector3());
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  cam.position.copy(new THREE.Vector3().setFromSphericalCoords(Math.max(s.x, s.y, s.z) * 2.3, 1.05, 0.6).add(c)); cam.lookAt(c);
  r.render(e, cam);
  const cv = document.createElement('canvas'); cv.width = r.domElement.width; cv.height = r.domElement.height;
  const x = cv.getContext('2d'); x.drawImage(r.domElement, 0, 0);
  const d = x.getImageData(0, 0, cv.width, cv.height).data; let x0 = cv.width, y0 = cv.height, x1 = 0, y1 = 0;
  for (let yy = 0; yy < cv.height; yy++) for (let xx = 0; xx < cv.width; xx++) if (d[(yy * cv.width + xx) * 4 + 3] > 8) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
  const mg = 10, w = Math.max(x1 - x0, y1 - y0) + mg * 2, o = document.createElement('canvas'); o.width = w; o.height = w;
  o.getContext('2d').drawImage(cv, x0 - mg - (w - mg * 2 - (x1 - x0)) / 2, y0 - mg - (w - mg * 2 - (y1 - y0)) / 2, w, w, 0, 0, w, w);
  r.dispose();
  return o.toDataURL('image/png');
}

G.Decoraciones3D = { TIPOS, EJEMPLO, modelo, colocar, foto };
})(typeof window !== 'undefined' ? window : this);
