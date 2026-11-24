// Generated from the supplied mapa3d.js by suizamente:v2:sync.
// Referencia de la maqueta 3D del mapa de Suizamente (FUNCIONES.md, sección 23.8.1). Se usa en disenos/juego.html.
/* Suizamente · mapa 3D de los cantones (prototipo).
   Necesita THREE (r128) y THREE.OrbitControls cargados antes.
   Cada cantón es una maqueta: tierra extruida con su trozo de lago y, según el nivel,
   1 naturaleza (montañas, bosque, animales) · 2 pueblo (casitas, carretera, coches) · 3 su monumento (y gente).
   API: const m = Mapa3D.crear({ datos, alSeleccionar });  m.montar(div); m.estado({v, r, niv}); m.enfocar(k|null); m.subir(k) */
import * as Three from 'three'
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js'
const G={THREE:{...Three,OrbitControls},devicePixelRatio:globalThis.devicePixelRatio}

'use strict';
const T = () => G.THREE;

/* ---------- Colores (solo los de Latido, sus tintes y neutros) ---------- */
// La maqueta usa colores naturales de estilo low poly (hierba, tierra, roca, agua); tejados, coches y gente van con
// los colores de Latido. La interfaz que la rodea sigue con los 6 colores de Latido.
const COL = {
  fondo: '#EEF1F5', tierraLado: '#8C5E3C', ladoBloq: '#A9B2BE', bloqueado: '#C3CAD3', bordeActivo: '#4A76EF',
  agua: '#55B8EA', aguaLado: '#3E9BD0', pino: ['#3E9A4E', '#4CA957', '#2F8A47'], copa: ['#8CC64F', '#9DCF5E'], tronco: '#7A5236',
  roca: '#E4E8ED', nieve: '#FFFFFF', piedra: '#D5DBE2', colina: '#8CC456', arbusto: '#68B04A', pared: '#F8F5EE', tejado: ['#FA2F35', '#F9A719'],
  edificio: ['#F4F7FB', '#DFE7FC', '#FFFFFF'], carretera: '#4E5562', bordillo: '#D5DBE2',
  latido: ['#24E2C9', '#03AA98', '#F9A719', '#FA2F35', '#4A76EF', '#24BFE2'],
};
const CAPA = 0.7; // grosor de la capa de hierba sobre la tierra
// Color de la hierba por vuelta y nivel (0 = solo tierra, sin hierba)
const SUELO = [
  ['#E2C994', '#A6D06A', '#97C95A', '#88C14B'],
  ['#E2C994', '#F5DC8F', '#F1CD62', '#ECBD3A'],
  ['#E2C994', '#C2E7F3', '#A2DBEF', '#82CEEA'],
  ['#E2C994', '#F8C1B9', '#F3A296', '#EE8474'],
];

/* ---------- Cada cantón: relieve, ciudad y su monumento (nivel 3) ---------- */
const C3 = {
  ZH: { alpes: 0, ciudad: 3, hito: 'dosTorres', n: 'Grossmünster' },
  BE: { alpes: 2, ciudad: 1, hito: 'cupula', n: 'Palacio Federal' },
  LU: { alpes: 1, ciudad: 1, hito: 'puenteCubierto', n: 'Puente de la Capilla' },
  UR: { alpes: 3, hito: 'estatua', n: 'Monumento a Guillermo Tell' },
  SZ: { alpes: 1, hito: 'mythen', n: 'Los Mythen' },
  OW: { alpes: 2, hito: 'capilla', n: 'Capilla de Flüeli-Ranft' },
  NW: { alpes: 1, hito: 'avion', n: 'Aviones Pilatus' },
  GL: { alpes: 3, hito: 'plaza', n: 'Plaza de la Landsgemeinde' },
  ZG: { alpes: 0, ciudad: 1, hito: 'torreReloj', n: 'Torre del reloj' },
  FR: { alpes: 1, hito: 'castillo', n: 'Castillo de Gruyères' },
  SO: { jura: 1, hito: 'catedral', n: 'Catedral de San Urso' },
  BS: { ciudad: 2, hito: 'rascacielos', n: 'Torre Roche' },
  BL: { jura: 1, hito: 'teatro', n: 'Teatro romano de Augusta Raurica' },
  SH: { hito: 'cascada', n: 'Cataratas del Rin' },
  AR: { alpes: 1, hito: 'antena', n: 'Säntis' },
  AI: { alpes: 1, hito: 'casasPintadas', n: 'Casas pintadas de Appenzell' },
  SG: { alpes: 1, ciudad: 1, hito: 'abadia', n: 'Abadía de San Galo' },
  GR: { alpes: 3, hito: 'viaducto', n: 'Viaducto de Landwasser', animal: 'cabra' },
  AG: { jura: 1, hito: 'castillo', n: 'Castillo de Lenzburg' },
  TG: { hito: 'manzanos', n: 'Manzanos de Turgovia' },
  TI: { alpes: 2, ciudad: 1, hito: 'castillo', n: 'Castillos de Bellinzona' },
  VD: { alpes: 1, ciudad: 1, hito: 'castilloLago', n: 'Castillo de Chillon' },
  VS: { alpes: 3, hito: 'cervino', n: 'Cervino', animal: 'cabra' },
  NE: { jura: 1, hito: 'reloj', n: 'Relojería de Neuchâtel' },
  GE: { ciudad: 2, hito: 'chorro', n: 'Jet d’eau' },
  JU: { jura: 1, hito: 'puentePiedra', n: 'Puente de Saint-Ursanne', animal: 'caballo' },
};
const NIVELES = ['Solo tierra', 'Naturaleza', 'Pueblo', 'Monumento'];
const EMOJI_NIVEL = ['🟫', '🌲', '🏡', '🏰'];

/* ---------- Utilidades ---------- */
const hash = s => { let h = 2166136261; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const azar = sem => { let a = sem || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const dentroAnillo = (x, y, r) => { let d = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) d = !d; } return d; };
const dentroMulti = (x, y, mp) => mp.some(pol => dentroAnillo(x, y, pol[0]) && !pol.slice(1).some(h => dentroAnillo(x, y, h)));
const distSeg = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy; let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0; t = Math.max(0, Math.min(1, t)); const x = ax + t * dx - px, y = ay + t * dy - py; return Math.sqrt(x * x + y * y); };
const distBorde = (x, y, mp) => { let m = Infinity; for (const pol of mp) for (const r of pol) for (let i = 0; i < r.length - 1; i++) m = Math.min(m, distSeg(x, y, r[i][0], r[i][1], r[i + 1][0], r[i + 1][1])); return m; };
const facil = t => 1 - Math.pow(1 - t, 3);
const rebote = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

/* ---------- Mapa 3D ---------- */
function crear(op) {
  const THREE = T(), D = op.datos, W = D.ancho, H = D.alto, OX = -W / 2, OZ = -H / 2;
  const ALTO = 3, ALTO_BLOQ = 1.6;
  const caja = document.createElement('div');
  caja.style.cssText = 'position: absolute; inset: 0; touch-action: none';
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: !!op.foto });
  renderer.setPixelRatio(Math.min(G.devicePixelRatio || 1,op.mini?1.5:2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  caja.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = 'display: block; width: 100%; height: 100%; border-radius: inherit';

  const escena = new THREE.Scene();
  escena.background = new THREE.Color(op.dark?.()?'#161C26':COL.fondo);
  const camara = new THREE.PerspectiveCamera(32, 1, 1, 3000);
  const controles = new THREE.OrbitControls(camara, renderer.domElement);
  Object.assign(controles, { enableDamping: true, dampingFactor: 0.08, minPolarAngle: 0.3, maxPolarAngle: 1.15, minDistance: 12, maxDistance: 900, screenSpacePanning: false, rotateSpeed: 0.6, zoomSpeed: 0.9 });
  escena.add(new THREE.HemisphereLight('#FFFFFF', '#B49A7A', 0.6));
  const sol = new THREE.DirectionalLight('#FFF4E0', 0.72);
  sol.position.set(-120, 220, 140); sol.castShadow = true;
  sol.shadow.mapSize.set(op.mini?256:2048,op.mini?256:2048);
  Object.assign(sol.shadow.camera, { left: -220, right: 220, top: 180, bottom: -180, near: 10, far: 700 });
  escena.add(sol, sol.target);
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.ShadowMaterial({ opacity: 0.16 }));
  suelo.rotation.x = -Math.PI / 2; suelo.position.y = -0.01; suelo.receiveShadow = true;
  escena.add(suelo);

  // Materiales compartidos
  const mats = {};
  const mat = (color, extra = {}) => { const k = color + JSON.stringify(extra); return mats[k] || (mats[k] = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true, ...extra })); };
  const malla = (geo, color, x, y, z) => { const m = new THREE.Mesh(geo, mat(color)); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true; return m; };

  /* Forma extruida de un MultiPolygon (coordenadas del mapa) */
  const extruir = (mp, prof) => {
    const formas = mp.map(pol => {
      const f = new THREE.Shape(pol[0].map(([x, y]) => new THREE.Vector2(x, -y)));
      f.holes = pol.slice(1).map(h => new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, -y))));
      return f;
    });
    const g = new THREE.ExtrudeGeometry(formas, { depth: prof, bevelEnabled: false });
    g.rotateX(-Math.PI / 2); g.translate(OX, 0, OZ);
    return g;
  };
  const borde = (mp, y, color) => {
    const pts = [];
    for (const pol of mp) for (const r of pol) for (let i = 0; i < r.length - 1; i++) pts.push(new THREE.Vector3(r[i][0] + OX, y, r[i][1] + OZ), new THREE.Vector3(r[i + 1][0] + OX, y, r[i + 1][1] + OZ));
    return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color }));
  };

  /* Facetado low poly: desplaza los vértices (sin tocar la base) con una semilla */
  const facetar = (geo, r, f, base) => {
    const p = geo.attributes.position, mov = {};
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (y <= base + 1e-3) continue;
      const k = x.toFixed(3) + ',' + y.toFixed(3) + ',' + z.toFixed(3);
      const d = mov[k] || (mov[k] = [(r() - 0.5) * f, (r() - 0.5) * f * 0.5, (r() - 0.5) * f]);
      p.setXYZ(i, x + d[0], y + d[1], z + d[2]);
    }
    p.needsUpdate = true; geo.computeVertexNormals(); return geo;
  };

  /* ---------- Piezas low-poly ---------- */
  const P = {
    // Pino de dos o tres pisos
    arbol(u, r) {
      if (r() < 0.3) return P.arbolRedondo(u, COL.copa[Math.floor(r() * 2)]);
      const g = new THREE.Group(), h = (1.2 + r() * 0.6) * u, color = COL.pino[Math.floor(r() * 3)], pisos = r() < 0.5 ? 2 : 3;
      g.add(malla(new THREE.CylinderGeometry(0.07 * u, 0.1 * u, 0.3 * h, 5), COL.tronco, 0, 0.15 * h, 0));
      for (let i = 0; i < pisos; i++) { const s = 1 - i * 0.26; g.add(malla(new THREE.ConeGeometry(0.46 * u * s, 0.55 * h * s, 6), color, 0, 0.3 * h + i * 0.27 * h + 0.27 * h * s, 0)); }
      g.rotation.y = r() * Math.PI;
      return g;
    },
    arbolRedondo(u, color) {
      const g = new THREE.Group();
      g.add(malla(new THREE.CylinderGeometry(0.07 * u, 0.09 * u, 0.45 * u, 5), COL.tronco, 0, 0.22 * u, 0));
      g.add(malla(new THREE.IcosahedronGeometry(0.46 * u, 0), color || COL.copa[0], 0, 0.78 * u, 0));
      g.add(malla(new THREE.IcosahedronGeometry(0.3 * u, 0), color || COL.copa[0], 0.25 * u, 0.62 * u, 0.1 * u));
      return g;
    },
    // Montaña facetada de roca clara, con nieve en los Alpes
    montana(u, r, alto) {
      const g = new THREE.Group(), h = (alto ? 4.2 + r() * 1.8 : 3 + r() * 1.4) * u, rad = (1.8 + r() * 0.8) * u;
      const geo = facetar(new THREE.ConeGeometry(rad, h, 7, 3), r, rad * 0.28, -h / 2);
      g.add(malla(geo, COL.roca, 0, h / 2, 0));
      if (alto) { const n = facetar(new THREE.ConeGeometry(rad * 0.42, h * 0.4, 7, 1), r, rad * 0.12, -h * 0.2); g.add(malla(n, COL.nieve, 0, h - h * 0.2, 0)); }
      // un pico más pequeño al lado
      const h2 = h * 0.55, geo2 = facetar(new THREE.ConeGeometry(rad * 0.6, h2, 6, 2), r, rad * 0.2, -h2 / 2);
      g.add(malla(geo2, COL.roca, rad * 0.75, h2 / 2, rad * 0.2));
      g.rotation.y = r() * Math.PI;
      return g;
    },
    colina(u, r) { const geo = facetar(new THREE.SphereGeometry((1.6 + r()) * u, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), r, 0.25 * u, 0.01); const m = malla(geo, COL.colina); m.scale.y = 0.5; return m; },
    roca(u, r) { const s = (0.25 + r() * 0.3) * u; const m = malla(facetar(new THREE.DodecahedronGeometry(s, 0), r, s * 0.35, -s * 2), COL.piedra, 0, s * 0.45, 0); m.scale.y = 0.7; m.rotation.y = r() * 3; return m; },
    arbusto(u, r) { const s = (0.22 + r() * 0.15) * u; return malla(new THREE.IcosahedronGeometry(s, 0), COL.arbusto, 0, s * 0.7, 0); },
    casa(u, r) {
      const g = new THREE.Group(), a = 0.8 * u, h = (0.55 + r() * 0.25) * u;
      g.add(malla(new THREE.BoxGeometry(a, h, a * 0.8), COL.pared, 0, h / 2, 0));
      const t = malla(new THREE.ConeGeometry(a * 0.78, 0.5 * u, 4), COL.tejado[r() < 0.6 ? 0 : 1], 0, h + 0.25 * u, 0); t.rotation.y = Math.PI / 4; g.add(t);
      g.rotation.y = r() * Math.PI;
      return g;
    },
    edificio(u, r, alto) {
      const h = (alto || 2.2 + r() * 2.4) * u, a = (0.7 + r() * 0.4) * u;
      const g = new THREE.Group();
      g.add(malla(new THREE.BoxGeometry(a, h, a), COL.edificio[Math.floor(r() * 3)], 0, h / 2, 0));
      g.add(malla(new THREE.BoxGeometry(a * 1.02, 0.08 * u, a * 1.02), '#4A76EF', 0, h * 0.66, 0));
      g.add(malla(new THREE.BoxGeometry(a * 1.02, 0.08 * u, a * 1.02), '#4A76EF', 0, h * 0.33, 0));
      return g;
    },
    vaca(u, color = '#FFFFFF') {
      const g = new THREE.Group();
      g.add(malla(new THREE.BoxGeometry(0.45 * u, 0.24 * u, 0.22 * u), color, 0, 0.26 * u, 0));
      g.add(malla(new THREE.BoxGeometry(0.16 * u, 0.16 * u, 0.16 * u), color, 0.28 * u, 0.32 * u, 0));
      if (color === '#FFFFFF') g.add(malla(new THREE.BoxGeometry(0.16 * u, 0.02 * u, 0.12 * u), '#3D4757', -0.05 * u, 0.385 * u, 0));
      for (const [x, z] of [[0.15, 0.07], [0.15, -0.07], [-0.15, 0.07], [-0.15, -0.07]]) g.add(malla(new THREE.BoxGeometry(0.05 * u, 0.15 * u, 0.05 * u), '#8A94A6', x * u, 0.075 * u, z * u));
      return g;
    },
    coche(u, color) {
      const g = new THREE.Group();
      g.add(malla(new THREE.BoxGeometry(0.42 * u, 0.14 * u, 0.22 * u), color, 0, 0.12 * u, 0));
      g.add(malla(new THREE.BoxGeometry(0.22 * u, 0.12 * u, 0.2 * u), '#FFFFFF', -0.02 * u, 0.24 * u, 0));
      return g;
    },
    persona(u, color) {
      const g = new THREE.Group();
      g.add(malla(new THREE.CylinderGeometry(0.06 * u, 0.08 * u, 0.24 * u, 6), color, 0, 0.12 * u, 0));
      g.add(malla(new THREE.SphereGeometry(0.065 * u, 6, 5), '#FEEDD1', 0, 0.3 * u, 0));
      return g;
    },
    barco(u) {
      const g = new THREE.Group();
      g.add(malla(new THREE.BoxGeometry(0.5 * u, 0.1 * u, 0.2 * u), '#FFFFFF', 0, 0.05 * u, 0));
      const v = malla(new THREE.ConeGeometry(0.16 * u, 0.42 * u, 3), '#FFFFFF', 0, 0.3 * u, 0); g.add(v);
      return g;
    },
    nube(u) {
      const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 1, flatShading: true });
      for (const [x, y, s] of [[0, 0, 1], [0.9, -0.15, 0.75], [-0.85, -0.2, 0.7], [0.3, 0.35, 0.65]]) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(s * u, 1), m); b.position.set(x * u, y * u, 0); g.add(b); }
      return g;
    },
  };

  /* Monumentos (nivel 3). Devuelven un grupo y, si tienen, una animación */
  const HITO = {
    dosTorres(u) { const g = new THREE.Group(); g.add(malla(new THREE.BoxGeometry(2.2 * u, 1.2 * u, 1.4 * u), '#F4F7FB', 0, 0.6 * u, 0)); for (const x of [-0.6, 0.6]) { g.add(malla(new THREE.BoxGeometry(0.7 * u, 3 * u, 0.7 * u), '#FFFFFF', x * u, 1.5 * u, 0.4 * u)); const t = malla(new THREE.ConeGeometry(0.5 * u, 0.9 * u, 4), '#4A76EF', x * u, 3.45 * u, 0.4 * u); t.rotation.y = Math.PI / 4; g.add(t); } return { g }; },
    cupula(u) { const g = new THREE.Group(); g.add(malla(new THREE.BoxGeometry(3.4 * u, 1.3 * u, 1.6 * u), '#F4F7FB', 0, 0.65 * u, 0)); g.add(malla(new THREE.CylinderGeometry(0.7 * u, 0.8 * u, 0.5 * u, 10), '#FFFFFF', 0, 1.55 * u, 0)); g.add(malla(new THREE.SphereGeometry(0.75 * u, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#03AA98', 0, 1.8 * u, 0)); return { g }; },
    puenteCubierto(u) { const g = new THREE.Group(); const p = malla(new THREE.BoxGeometry(3.6 * u, 0.25 * u, 0.45 * u), '#F9A719', 0, 0.5 * u, 0); p.rotation.y = 0.5; g.add(p); const t = malla(new THREE.CylinderGeometry(0.42 * u, 0.48 * u, 1.6 * u, 8), '#F4F7FB', 0.7 * u, 0.8 * u, -0.6 * u); g.add(t); g.add(malla(new THREE.ConeGeometry(0.55 * u, 0.7 * u, 8), '#FA2F35', 0.7 * u, 1.95 * u, -0.6 * u)); for (const x of [-1.2, 0, 1.2]) { const pi = malla(new THREE.BoxGeometry(0.12 * u, 0.5 * u, 0.12 * u), '#8A94A6', x * u * Math.cos(0.5), 0.25 * u, -x * u * Math.sin(0.5)); g.add(pi); } return { g }; },
    estatua(u) { const g = new THREE.Group(); g.add(malla(new THREE.BoxGeometry(0.9 * u, 0.9 * u, 0.9 * u), '#B8C0CC', 0, 0.45 * u, 0)); g.add(malla(new THREE.CylinderGeometry(0.22 * u, 0.3 * u, 1.1 * u, 7), '#5A6577', 0, 1.45 * u, 0)); g.add(malla(new THREE.SphereGeometry(0.2 * u, 7, 6), '#5A6577', 0, 2.15 * u, 0)); g.add(malla(new THREE.BoxGeometry(0.7 * u, 0.08 * u, 0.08 * u), '#5A6577', 0.25 * u, 1.7 * u, 0)); return { g }; },
    mythen(u) { const g = new THREE.Group(); for (const [x, h] of [[-0.8, 4.6], [0.9, 3.8]]) { g.add(malla(new THREE.ConeGeometry(1.1 * u, h * u, 5), COL.roca, x * u, h * u / 2, 0)); g.add(malla(new THREE.ConeGeometry(0.35 * u, 1.1 * u, 5), COL.nieve, x * u, h * u - 0.55 * u, 0)); } return { g }; },
    capilla(u) { const g = new THREE.Group(); g.add(malla(new THREE.BoxGeometry(1.2 * u, 0.9 * u, 0.8 * u), '#FFFFFF', 0, 0.45 * u, 0)); const t = malla(new THREE.ConeGeometry(0.75 * u, 0.7 * u, 4), '#5A6577', 0, 1.25 * u, 0); t.rotation.y = Math.PI / 4; g.add(t); g.add(malla(new THREE.BoxGeometry(0.35 * u, 1.9 * u, 0.35 * u), '#FFFFFF', 0.75 * u, 0.95 * u, 0)); g.add(malla(new THREE.ConeGeometry(0.28 * u, 0.8 * u, 4), '#5A6577', 0.75 * u, 2.3 * u, 0)); return { g }; },
    avion(u) {
      const g = new THREE.Group();
      const avion = () => { const a = new THREE.Group(); const f = malla(new THREE.CylinderGeometry(0.16 * u, 0.12 * u, 1.6 * u, 8), '#FFFFFF'); f.rotation.z = Math.PI / 2; a.add(f); a.add(malla(new THREE.BoxGeometry(0.4 * u, 0.05 * u, 1.9 * u), '#FA2F35', 0.1 * u, 0, 0)); a.add(malla(new THREE.BoxGeometry(0.25 * u, 0.4 * u, 0.05 * u), '#FA2F35', -0.7 * u, 0.2 * u, 0)); return a; };
      g.add(malla(new THREE.BoxGeometry(2.4 * u, 0.9 * u, 1.4 * u), '#DFE7FC', -0.6 * u, 0.45 * u, 0));
      const enSuelo = avion(); enSuelo.position.set(1.1 * u, 0.25 * u, 0.9 * u); g.add(enSuelo);
      const vuela = avion(); g.add(vuela);
      return { g, anim: t => { const a = t * 0.6; vuela.position.set(Math.cos(a) * 4 * u, 4.5 * u, Math.sin(a) * 4 * u); vuela.rotation.y = -a; vuela.rotation.x = -0.25; } };
    },
    plaza(u) { const g = new THREE.Group(); g.add(malla(new THREE.CylinderGeometry(1.6 * u, 1.6 * u, 0.06 * u, 16), '#B8C0CC', 0, 0.03 * u, 0)); g.add(malla(new THREE.BoxGeometry(0.8 * u, 0.4 * u, 0.5 * u), '#F9A719', 0, 0.2 * u, 0)); const gente = []; for (let i = 0; i < 14; i++) { const p = P.persona(u, COL.latido[i % 6]); const a = i / 14 * Math.PI * 2; p.position.set(Math.cos(a) * 1.25 * u, 0.06 * u, Math.sin(a) * 1.25 * u); g.add(p); gente.push(p); } return { g, anim: t => gente.forEach((p, i) => { p.position.y = 0.06 * u + Math.max(0, Math.sin(t * 6 + i)) * 0.08 * u; }) }; },
    torreReloj(u) { const g = new THREE.Group(); g.add(malla(new THREE.BoxGeometry(0.9 * u, 2.8 * u, 0.9 * u), '#FFFFFF', 0, 1.4 * u, 0)); const r = malla(new THREE.CylinderGeometry(0.32 * u, 0.32 * u, 0.06 * u, 16), '#4A76EF', 0, 2.1 * u, 0.47 * u); r.rotation.x = Math.PI / 2; g.add(r); const t = malla(new THREE.ConeGeometry(0.72 * u, 1 * u, 4), '#FA2F35', 0, 3.3 * u, 0); t.rotation.y = Math.PI / 4; g.add(t); return { g }; },
    castillo(u) { const g = new THREE.Group(); g.add(malla(new THREE.BoxGeometry(1.4 * u, 1.8 * u, 1.4 * u), '#F4F7FB', 0, 0.9 * u, 0)); const t0 = malla(new THREE.ConeGeometry(1.05 * u, 0.9 * u, 4), '#FA2F35', 0, 2.25 * u, 0); t0.rotation.y = Math.PI / 4; g.add(t0); for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { g.add(malla(new THREE.CylinderGeometry(0.3 * u, 0.3 * u, 1.4 * u, 8), '#FFFFFF', x * 1.1 * u, 0.7 * u, z * 1.1 * u)); g.add(malla(new THREE.ConeGeometry(0.38 * u, 0.6 * u, 8), '#FA2F35', x * 1.1 * u, 1.7 * u, z * 1.1 * u)); } for (const [x, z, w, d] of [[0, 1.1, 2.2, 0.2], [0, -1.1, 2.2, 0.2], [1.1, 0, 0.2, 2.2], [-1.1, 0, 0.2, 2.2]]) g.add(malla(new THREE.BoxGeometry(w * u, 0.7 * u, d * u), '#DCE2EA', x * u, 0.35 * u, z * u)); return { g }; },
    catedral(u) { const g = new THREE.Group(); g.add(malla(new THREE.BoxGeometry(1.4 * u, 1.3 * u, 2.6 * u), '#F4F7FB', 0, 0.65 * u, 0)); g.add(malla(new THREE.BoxGeometry(0.9 * u, 2.6 * u, 0.9 * u), '#FFFFFF', 0, 1.3 * u, 1.5 * u)); g.add(malla(new THREE.SphereGeometry(0.5 * u, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#03AA98', 0, 2.6 * u, 1.5 * u)); g.add(malla(new THREE.SphereGeometry(0.6 * u, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#03AA98', 0, 1.3 * u, -0.6 * u)); return { g }; },
    rascacielos(u) { const g = new THREE.Group(); let y = 0; for (const [w, h] of [[1.3, 2.2], [1.05, 1.8], [0.8, 1.4], [0.55, 1]]) { g.add(malla(new THREE.BoxGeometry(w * u, h * u, w * 0.8 * u), '#FFFFFF', (1.3 - w) * 0.4 * u, (y + h / 2) * u, 0)); y += h; } return { g }; },
    teatro(u) { const g = new THREE.Group(); for (let i = 0; i < 4; i++) { const m = malla(new THREE.CylinderGeometry((1.9 - i * 0.35) * u, (1.9 - i * 0.35) * u, (0.25 + i * 0.25) * u, 16, 1, false, 0, Math.PI), '#B8C0CC', 0, (0.125 + i * 0.125) * u, 0); g.add(m); } g.add(malla(new THREE.BoxGeometry(1.6 * u, 0.12 * u, 0.6 * u), '#F4F7FB', 0, 0.06 * u, -0.3 * u)); return { g }; },
    cascada(u) {
      const g = new THREE.Group();
      g.add(malla(new THREE.BoxGeometry(3 * u, 1.2 * u, 0.9 * u), COL.roca, 0, 0.6 * u, -0.8 * u));
      g.add(malla(new THREE.BoxGeometry(3 * u, 0.1 * u, 1.6 * u), COL.agua, 0, 0.06 * u, 0.5 * u));
      const gotas = [];
      for (let i = 0; i < 18; i++) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.16 * u, 0.32 * u, 0.06 * u), new THREE.MeshStandardMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.85 })); d.position.set((-1.3 + (i % 9) * 0.32) * u, 1.2 * u, -0.32 * u); d.userData.f = i / 18; g.add(d); gotas.push(d); }
      return { g, anim: t => gotas.forEach(d => { const f = (t * 0.9 + d.userData.f) % 1; d.position.y = (1.2 - f * 1.15) * u; d.position.z = (-0.32 + f * 0.25) * u; }) };
    },
    antena(u) { const g = new THREE.Group(); g.add(malla(new THREE.ConeGeometry(1.8 * u, 3.6 * u, 6), COL.roca, 0, 1.8 * u, 0)); g.add(malla(new THREE.ConeGeometry(0.6 * u, 1.2 * u, 6), COL.nieve, 0, 3 * u, 0)); g.add(malla(new THREE.CylinderGeometry(0.05 * u, 0.08 * u, 1.6 * u, 6), '#FFFFFF', 0, 4.4 * u, 0)); g.add(malla(new THREE.SphereGeometry(0.16 * u, 6, 5), '#FA2F35', 0, 5.2 * u, 0)); return { g }; },
    casasPintadas(u) { const g = new THREE.Group(); for (let i = 0; i < 5; i++) { g.add(malla(new THREE.BoxGeometry(0.62 * u, 1.1 * u, 0.7 * u), COL.latido[(i + 1) % 6], (i - 2) * 0.66 * u, 0.55 * u, 0)); const t = malla(new THREE.CylinderGeometry(0.01, 0.45 * u, 0.5 * u, 4), '#F4F7FB', (i - 2) * 0.66 * u, 1.35 * u, 0); t.rotation.y = Math.PI / 4; g.add(t); } return { g }; },
    abadia(u) { const g = new THREE.Group(); g.add(malla(new THREE.BoxGeometry(1.2 * u, 1.3 * u, 2.8 * u), '#FFFFFF', 0, 0.65 * u, 0)); for (const x of [-0.45, 0.45]) { g.add(malla(new THREE.BoxGeometry(0.45 * u, 2.6 * u, 0.45 * u), '#F4F7FB', x * u, 1.3 * u, 1.5 * u)); g.add(malla(new THREE.SphereGeometry(0.3 * u, 8, 6), '#03AA98', x * u, 2.75 * u, 1.5 * u)); } return { g }; },
    viaducto(u) {
      const g = new THREE.Group();
      g.add(malla(new THREE.BoxGeometry(5 * u, 0.25 * u, 0.5 * u), '#B8C0CC', 0, 2.2 * u, 0));
      for (let i = -2; i <= 2; i++) g.add(malla(new THREE.BoxGeometry(0.35 * u, 2.1 * u, 0.45 * u), '#B8C0CC', i * 1.15 * u, 1.05 * u, 0));
      const tren = new THREE.Group(); for (let i = 0; i < 3; i++) tren.add(malla(new THREE.BoxGeometry(0.7 * u, 0.35 * u, 0.36 * u), '#FA2F35', i * 0.75 * u, 0, 0)); g.add(tren);
      return { g, anim: t => { const f = (Math.sin(t * 0.5) + 1) / 2; tren.position.set((-2.8 + f * 3.8) * u, 2.5 * u, 0); } };
    },
    manzanos(u) { const g = new THREE.Group(); for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const a = P.arbolRedondo(u * 0.9, COL.copa[0]); a.position.set((i - 1.5) * 0.9 * u, 0, (j - 1) * 0.9 * u); for (let k = 0; k < 3; k++) a.add(malla(new THREE.SphereGeometry(0.07 * u, 5, 4), '#FA2F35', (k - 1) * 0.22 * u, 0.75 * u, 0.36 * u)); g.add(a); } return { g }; },
    castilloLago(u) { return HITO.castillo(u); },
    cervino(u) { const g = new THREE.Group(); const m = malla(new THREE.ConeGeometry(1.9 * u, 6.4 * u, 4), COL.roca, 0, 3.2 * u, 0); m.rotation.y = 0.3; m.rotation.z = 0.08; g.add(m); const n = malla(new THREE.ConeGeometry(0.75 * u, 2.5 * u, 4), COL.nieve, 0.1 * u, 5.15 * u, 0); n.rotation.y = 0.3; n.rotation.z = 0.08; g.add(n); return { g }; },
    reloj(u) {
      const g = new THREE.Group();
      g.add(malla(new THREE.BoxGeometry(0.5 * u, 1.2 * u, 0.5 * u), '#B8C0CC', 0, 0.6 * u, 0));
      const cara = new THREE.Group(); cara.position.set(0, 2.1 * u, 0); g.add(cara);
      const aro = malla(new THREE.TorusGeometry(0.9 * u, 0.14 * u, 6, 20), '#F9A719'); cara.add(aro);
      const fondo = malla(new THREE.CylinderGeometry(0.85 * u, 0.85 * u, 0.08 * u, 20), '#FFFFFF'); fondo.rotation.x = Math.PI / 2; cara.add(fondo);
      const h = malla(new THREE.BoxGeometry(0.08 * u, 0.5 * u, 0.04 * u), '#0F1A2B', 0, 0.22 * u, 0.07 * u); const m = malla(new THREE.BoxGeometry(0.05 * u, 0.7 * u, 0.04 * u), '#4A76EF', 0, 0.32 * u, 0.09 * u);
      const ph = new THREE.Group(), pm = new THREE.Group(); ph.add(h); pm.add(m); cara.add(ph, pm);
      return { g, anim: t => { pm.rotation.z = -t * 1.2; ph.rotation.z = -t * 0.1; } };
    },
    chorro(u) {
      const g = new THREE.Group(), gotas = [];
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * u, 0.22 * u, 6 * u, 8), new THREE.MeshStandardMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.8 })); col.position.y = 3 * u; g.add(col);
      for (let i = 0; i < 24; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.1 * u, 5, 4), new THREE.MeshStandardMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.9 })); d.userData = { f: i / 24, a: i * 2.4 }; g.add(d); gotas.push(d); }
      return { g, anim: t => { col.scale.y = 0.94 + Math.sin(t * 3) * 0.06; gotas.forEach(d => { const f = (t * 0.5 + d.userData.f) % 1; d.position.set(Math.cos(d.userData.a) * f * 1.4 * u, (6 - f * f * 6) * u, Math.sin(d.userData.a) * f * 1.4 * u); }); } };
    },
    puentePiedra(u) { const g = new THREE.Group(); g.add(malla(new THREE.BoxGeometry(3.2 * u, 0.3 * u, 0.8 * u), '#B8C0CC', 0, 1.1 * u, 0)); for (const x of [-0.8, 0.8]) { const a = malla(new THREE.TorusGeometry(0.65 * u, 0.2 * u, 5, 10, Math.PI), '#B8C0CC', x * u, 0.3 * u, 0); g.add(a); } g.add(malla(new THREE.BoxGeometry(3.6 * u, 0.06 * u, 1.6 * u), COL.agua, 0, 0.04 * u, 0)); return { g }; },
  };

  /* ---------- Cantones ---------- */
  const cantones = {};
  for (const [k, c] of Object.entries(D.cantones)) {
    const grupo = new THREE.Group(); escena.add(grupo);
    const tierraGeo = extruir(c.tierra, 1);
    const base = new THREE.Mesh(tierraGeo, [new THREE.MeshStandardMaterial({ color: COL.tierraLado, roughness: 1 }), new THREE.MeshStandardMaterial({ color: COL.tierraLado, roughness: 1, flatShading: true })]);
    base.receiveShadow = true; base.castShadow = true; grupo.add(base);
    const tierra = new THREE.Mesh(tierraGeo, [new THREE.MeshStandardMaterial({ color: SUELO[0][0], roughness: 0.95 }), new THREE.MeshStandardMaterial({ color: SUELO[0][1], roughness: 0.95 })]);
    tierra.receiveShadow = true; tierra.castShadow = true; tierra.userData.k = k; grupo.add(tierra);
    let agua = null;
    if (c.agua.length) { agua = new THREE.Mesh(extruir(c.agua, 1), [new THREE.MeshStandardMaterial({ color: COL.agua, roughness: 0.3 }), new THREE.MeshStandardMaterial({ color: COL.aguaLado, roughness: 0.4 })]); agua.receiveShadow = true; grupo.add(agua); }
    const lineas = borde(c.tierra, 0, COL.bordeActivo); grupo.add(lineas);
    const [bx0, by0, bx1, by1] = c.b;
    const u = Math.max(0.6, Math.min(3.8, Math.sqrt(Math.max(c.area, 20)) / 13));
    cantones[k] = { k, c, grupo, base, tierra, agua, lineas, u, b: [bx0, by0, bx1, by1], deco: [null, null, null, null], nivel: -1, alto: ALTO, anims: [], ocupado: [] };
  }

  // Centro del pueblo: el punto más lejos del borde (sobre tierra)
  const centro = can => {
    if (can.centro) return can.centro;
    const r = azar(hash(can.k + 'centro')), [x0, y0, x1, y1] = can.b; let mejor = [can.c.cx, can.c.cy], md = -1;
    for (let i = 0; i < 260; i++) { const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0); if (!dentroMulti(x, y, can.c.tierra)) continue; const d = distBorde(x, y, can.c.tierra) - (can.c.agua.length ? 0 : 0); if (d > md) { md = d; mejor = [x, y]; } }
    if (C3[can.k].hito === 'chorro' && can.c.agua.length) { // el chorro va en el agua
      let best = null, bd = -1; for (let i = 0; i < 400; i++) { const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0); if (!dentroMulti(x, y, can.c.agua)) continue; const d = distBorde(x, y, can.c.agua); if (d > bd) { bd = d; best = [x, y]; } }
      if (best) can.hitoEnAgua = best;
    }
    return (can.centro = mejor, can.radio = md, mejor);
  };
  const libre = (can, x, y, d) => can.ocupado.every(o => Math.hypot(o[0] - x, o[1] - y) > d + o[2]);
  const puntos = (can, n, d, semilla, filtro, fb = 0.9) => {
    const r = azar(hash(can.k + semilla)), [x0, y0, x1, y1] = can.b, res = [];
    for (let i = 0; i < n * 80 && res.length < n; i++) {
      const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0);
      if (!dentroMulti(x, y, can.c.tierra) || distBorde(x, y, can.c.tierra) < d * fb || !libre(can, x, y, d) || (filtro && !filtro(x, y))) continue;
      res.push([x, y]); can.ocupado.push([x, y, d * 0.5]);
    }
    return res;
  };
  const poner = (obj, x, y, alto) => { obj.position.set(x + OX, alto, y + OZ); return obj; };

  const construirNivel = (can, n) => {
    const g = new THREE.Group(), u = can.u, conf = C3[can.k], [cx, cy] = centro(can), anims = [];
    const dCentro = (x, y) => Math.hypot(x - cx, y - cy), rp = Math.max(2.2 * u, Math.min(can.radio * 0.8, 5 * u));
    const r = azar(hash(can.k + 'n' + n));
    if (n === 1) {
      can.ocupado.push([cx, cy, rp * 0.9]); // reservar el centro para el pueblo
      const nm = conf.alpes ? Math.max(1, Math.min(7, Math.round(can.c.area / 900) + conf.alpes)) : 0;
      for (const [x, y] of puntos(can, nm, 2.2 * u, 'm', (x, y) => dCentro(x, y) > rp * 0.85, 0.55)) g.add(poner(P.montana(u, r, conf.alpes >= 2), x, y, 0));
      if (conf.jura) for (const [x, y] of puntos(can, 3, 2 * u, 'j', (x, y) => dCentro(x, y) > rp)) g.add(poner(P.colina(u, r), x, y, 0));
      const na = Math.max(6, Math.min(26, Math.round(can.c.area / 90) + 6));
      for (const [x, y] of puntos(can, na, 0.75 * u, 'a', (x, y) => dCentro(x, y) > rp * 0.7)) g.add(poner(P.arbol(u, r), x, y, 0));
      for (const [x, y] of puntos(can, Math.max(2, Math.min(6, Math.round(can.c.area / 300))), 0.5 * u, 'r', (x, y) => dCentro(x, y) > rp * 0.6)) g.add(poner(P.roca(u, r), x, y, 0));
      for (const [x, y] of puntos(can, Math.max(3, Math.min(8, Math.round(can.c.area / 250))), 0.4 * u, 'b', (x, y) => dCentro(x, y) > rp * 0.6)) g.add(poner(P.arbusto(u, r), x, y, 0));
      const tipo = conf.animal || 'vaca', color = tipo === 'caballo' ? '#8A94A6' : tipo === 'cabra' ? '#DCE2EA' : '#FFFFFF';
      for (const [x, y] of puntos(can, Math.max(2, Math.min(6, Math.round(can.c.area / 400))), 0.9 * u, 'v')) {
        const a = poner(P.vaca(u, color), x, y, 0); g.add(a);
        const fase = r() * 10, rad = 0.5 * u;
        anims.push(t => { const ang = t * 0.25 + fase; a.position.x = x + OX + Math.cos(ang) * rad; a.position.z = y + OZ + Math.sin(ang) * rad; a.rotation.y = -ang - Math.PI / 2 + Math.PI; });
      }
      // Barcos si hay lago
      if (can.c.agua.length) {
        const ra = azar(hash(can.k + 'b')), [x0, y0, x1, y1] = can.b;
        for (let i = 0, puestos = 0; i < 600 && puestos < 2; i++) {
          const x = x0 + ra() * (x1 - x0), y = y0 + ra() * (y1 - y0);
          if (!dentroMulti(x, y, can.c.agua) || distBorde(x, y, can.c.agua) < 1.2 * u) continue;
          const b = poner(P.barco(u * 0.9), x, y, 0); g.add(b); puestos++;
          const dir = ra() * Math.PI, f = ra() * 10;
          anims.push(t => { const s = Math.sin(t * 0.3 + f) * 0.9 * u; const nx = x + Math.cos(dir) * s, ny = y + Math.sin(dir) * s; if (dentroMulti(nx, ny, can.c.agua)) { b.position.x = nx + OX; b.position.z = ny + OZ; } b.rotation.y = -dir; b.position.y = Math.sin(t * 2 + f) * 0.04 * u; });
        }
      }
    }
    if (n === 2) {
      const nc = Math.max(4, Math.min(14, Math.round(can.c.area / 200) + 4));
      can.ocupado = can.ocupado.filter(o => !(o[0] === cx && o[1] === cy)); // liberar el centro
      can.ocupado.push([cx, cy, 2.2 * u]); // pero no el sitio del monumento
      // Carretera en círculo alrededor del centro
      let rc = Math.min(rp * 0.75, 3.2 * u); const ok = rr => Array.from({ length: 24 }, (_, i) => [cx + Math.cos(i / 24 * Math.PI * 2) * rr, cy + Math.sin(i / 24 * Math.PI * 2) * rr]).every(([x, y]) => dentroMulti(x, y, can.c.tierra));
      while (rc > 1.2 * u && !ok(rc)) rc *= 0.85;
      if (rc > 1.2 * u) {
        const bord = new THREE.Mesh(new THREE.RingGeometry(rc - 0.26 * u, rc + 0.26 * u, 40), mat(COL.bordillo)); bord.rotation.x = -Math.PI / 2; bord.receiveShadow = true; g.add(poner(bord, cx, cy, 0.015));
        const via = new THREE.Mesh(new THREE.RingGeometry(rc - 0.2 * u, rc + 0.2 * u, 40), mat(COL.carretera)); via.rotation.x = -Math.PI / 2; via.receiveShadow = true; g.add(poner(via, cx, cy, 0.03));
        for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, d = malla(new THREE.BoxGeometry(0.04 * u, 0.01, 0.22 * u), '#FFFFFF'); d.rotation.y = -a; g.add(poner(d, cx + Math.cos(a) * rc, cy + Math.sin(a) * rc, 0.045)); }
        for (let i = 0; i < 3; i++) { const c = P.coche(u, COL.latido[(i * 2 + 2) % 6]); g.add(c); const f = i / 3 * Math.PI * 2, v = 0.35 + i * 0.05; anims.push(t => { const a = t * v + f; c.position.set(cx + OX + Math.cos(a) * rc, 0.05, cy + OZ + Math.sin(a) * rc); c.rotation.y = -a; }); }
      }
      const casas = puntos(can, nc, 0.95 * u, 'c', (x, y) => dCentro(x, y) < rp * 1.6 && Math.abs(dCentro(x, y) - rc) > 0.5 * u);
      for (const [x, y] of casas) g.add(poner(P.casa(u, r), x, y, 0));
    }
    if (n === 3) {
      const h = HITO[conf.hito](u * 1.5); h.g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
      const [hx, hy] = can.hitoEnAgua || [cx, cy];
      g.add(poner(h.g, hx, hy, 0)); if (h.anim) anims.push(t => h.anim(t));
      if (conf.ciudad) for (const [x, y] of puntos(can, conf.ciudad * 2, 1.1 * u, 'e', (x, y) => dCentro(x, y) < rp * 1.9)) g.add(poner(P.edificio(u, r), x, y, 0));
      for (let i = 0; i < 6; i++) { const p = P.persona(u, COL.latido[i]); g.add(p); const f = i / 6 * Math.PI * 2, rr = 1.6 * u + (i % 2) * 0.3 * u, v = 0.4 + i * 0.03; anims.push(t => { const a = t * v * (i % 2 ? 1 : -1) + f; p.position.set(hx + OX + Math.cos(a) * rr, Math.abs(Math.sin(t * 8 + i)) * 0.03 * u, hy + OZ + Math.sin(a) * rr); }); }
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return { g, anims };
  };

  /* ---------- Estado: niveles, colores y alturas ---------- */
  let est = { v: 1, r: 0, niv: {} }, foco = null;
  const regionDe = k => op.regiones.findIndex(r => r.c.includes(k));
  const nivelDe = k => { const r = regionDe(k); if (est.v > 1) return r < est.r ? 3 : r > est.r ? 3 : (est.niv[k] || 0); return r < est.r ? 3 : r > est.r ? -1 : (est.niv[k] || 0); };
  const sueloDe = (k, n) => { const r = regionDe(k), v = est.v; if (n < 0) return COL.bloqueado; if (v > 1 && r > est.r) return SUELO[Math.min(v - 2, 3)][3]; return SUELO[Math.min(v - 1, 3)][Math.max(0, n)]; };
  const aplicar = (can, n, animar) => {
    const k = can.k, activo = regionDe(k) === est.r;
    const alto = n < 0 ? ALTO_BLOQ : ALTO;
    can.base.scale.y = alto - CAPA; can.tierra.position.y = alto - CAPA; can.tierra.scale.y = CAPA;
    if (can.agua) can.agua.scale.y = alto - 0.45; can.lineas.position.y = alto + 0.03; can.alto = alto;
    const arriba = new THREE.Color(sueloDe(k, n));
    can.tierra.material[0].color.copy(arriba);
    can.tierra.material[1].color.copy(arriba).offsetHSL(0, 0, n < 0 ? -0.06 : -0.12);
    can.base.material[1].color.set(n < 0 ? COL.ladoBloq : COL.tierraLado);
    can.lineas.visible = activo && n >= 0;
    for (let i = 1; i <= 3; i++) {
      if (n >= i && !can.deco[i]) { can.deco[i] = construirNivel(can, i); can.deco[i].g.position.y = alto; can.grupo.add(can.deco[i].g); if (animar && i === n) aparecer(can.deco[i].g); }
      if (can.deco[i]) { can.deco[i].g.visible = n >= i; can.deco[i].g.position.y = alto; }
    }
    can.nivel = n;
  };
  const tweens = [];
  const aparecer = g => { g.children.forEach((o, i) => { const s = o.scale.clone(); o.scale.setScalar(0.001); tweens.push({ t0: reloj + i * 0.03, dur: 0.6, f: p => o.scale.copy(s).multiplyScalar(Math.max(0.001, rebote(p))) }); }); };

  // Confeti al subir de nivel
  const confeti = [];
  const lanzarConfeti = (x, y, z, u) => { for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.25 * u, 0.12 * u), new THREE.MeshBasicMaterial({ color: COL.latido[i % 6], side: THREE.DoubleSide, transparent: true })); m.position.set(x, y, z); m.userData = { v: new THREE.Vector3((Math.random() - 0.5) * 6 * u, (4 + Math.random() * 5) * u, (Math.random() - 0.5) * 6 * u), giro: Math.random() * 8, vida: 1.6 }; escena.add(m); confeti.push(m); } };

  // Nubes
  const nubes = [];
  for (let i = 0; i < 6; i++) { const n = P.nube(5 + (i % 3) * 2); n.position.set(-150 + i * 60, 45 + (i % 2) * 12, -60 + (i * 37) % 120); n.userData = { v: 1.5 + (i % 3), casa: n.position.clone(), limite: 220 }; escena.add(n); nubes.push(n); }
  // En una maqueta, dos nubes pequeñas alrededor del cantón; en el mapa entero, todas
  const nubesA = can => nubes.forEach((n, i) => { if (!can) { n.visible = true; n.scale.setScalar(1); n.position.copy(n.userData.casa); n.userData.limite = 220; n.userData.min = -220; return; }
    const [x0, y0, x1, y1] = can.b, s = Math.max(x1 - x0, y1 - y0); n.visible = i < 2; n.scale.setScalar(s / 110);
    n.position.set((i ? x1 : x0) + OX, can.alto + s * (0.42 + i * 0.1), (i ? y0 : y1) + OZ - s * 0.1); n.userData.min = x0 + OX - s * 0.4; n.userData.limite = x1 + OX + s * 0.4; });

  /* ---------- Cámara ---------- */
  let vuelo = null;
  const volarA = (objetivo, dist, polar = 0.95, azim = 0.38) => {
    const desde = { t: controles.target.clone(), p: camara.position.clone() };
    const hacia = new THREE.Vector3().setFromSphericalCoords(dist, polar, azim).add(objetivo);
    vuelo = { t0: reloj, dur: 0.9, desde, hacia: { t: objetivo.clone(), p: hacia } };
  };
  const centroMundo = can => { const [cx, cy] = centro(can); return new THREE.Vector3(cx + OX, can.alto, cy + OZ); };
  // Distancia para que quepa un ancho w (y un fondo h) en pantalla
  const distPara = (w, h) => { const v = THREE.MathUtils.degToRad(camara.fov) / 2, hz = Math.atan(Math.tan(v) * camara.aspect); return Math.max((w / 2) / Math.tan(hz), (h / 2) / Math.tan(v)) * 1.08; };
  const verTodo = () => { Object.values(cantones).forEach(c => { c.grupo.visible = true; }); volarA(new THREE.Vector3(0, 0, 4), distPara(W, H * 1.25) * 1.05, 0.82, 0.18); controles.autoRotate = false; nubesA(null); };
  const enfocar = k => { dirty=true;
    foco = k || null;
    if (!foco) return verTodo();
    const can = cantones[foco]; if (!can) return;
    Object.values(cantones).forEach(c => { c.grupo.visible = c.k === foco; });
    const [x0, y0, x1, y1] = can.b, s = Math.max(x1 - x0, y1 - y0);
    volarA(new THREE.Vector3((x0 + x1) / 2 + OX, can.alto + s * 0.06, (y0 + y1) / 2 + OZ), distPara(s * 1.18, s * 1.05) + 4, 0.9, 0.42);
    nubesA(can);
    controles.autoRotate = !op.foto; controles.autoRotateSpeed = 0.5;
  };
  controles.addEventListener('start', () => { controles.autoRotate = false; vuelo = null; });

  /* ---------- Toque: seleccionar cantón ---------- */
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let abajo = null;
  renderer.domElement.addEventListener('pointerdown', e => { abajo = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!abajo || Math.hypot(e.clientX - abajo[0], e.clientY - abajo[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ptr, camara);
    const tierras = Object.values(cantones).filter(c => c.grupo.visible).map(c => c.tierra);
    const hit = ray.intersectObjects(tierras)[0];
    if (hit && op.alSeleccionar) op.alSeleccionar(hit.object.userData.k);
  });

  /* ---------- Bucle ---------- */
  let reloj = 0, ultimo = performance.now(), vivo = true, dirty=true;controles.addEventListener('change',()=>{dirty=true});
  const tamano = () => { const p = caja.parentElement; if (!p) return; dirty=true;const w = p.clientWidth, h = p.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camara.aspect = w / h; camara.updateProjectionMatrix(); };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(tamano) : null;
  const frame = ahora => {
    if (!vivo) return;
    requestAnimationFrame(frame);
    if (document.hidden || op.visible?.()===false || (!document.body.contains(caja) && !op.foto)) { ultimo = ahora; return; }
    escena.background.set(op.dark?.()?'#161C26':COL.fondo);if(op.reduced?.()) { controles.autoRotate=false;controles.enableDamping=false;if(vuelo){controles.target.copy(vuelo.hacia.t);camara.position.copy(vuelo.hacia.p);vuelo=null;}tweens.forEach(tw=>tw.f(1));tweens.length=0; }
    if(op.reduced?.()&&!dirty)return;dirty=false;controles.enableDamping=!op.reduced?.();const dt = op.reduced?.()?0:Math.min(0.05, (ahora - ultimo) / 1000); ultimo = ahora; reloj += dt;
    if (vuelo) { const p = facil(Math.min(1, (reloj - vuelo.t0) / vuelo.dur)); controles.target.lerpVectors(vuelo.desde.t, vuelo.hacia.t, p); camara.position.lerpVectors(vuelo.desde.p, vuelo.hacia.p, p); if (p >= 1) vuelo = null; }
    for (let i = tweens.length - 1; i >= 0; i--) { const tw = tweens[i], p = (reloj - tw.t0) / tw.dur; if (p < 0) continue; tw.f(Math.min(1, p)); if (p >= 1) tweens.splice(i, 1); }
    for (const can of Object.values(cantones)) if (can.grupo.visible) for (let i = 1; i <= 3; i++) if (can.deco[i] && can.deco[i].g.visible) can.deco[i].anims.forEach(a => a(reloj));
    for (let i = confeti.length - 1; i >= 0; i--) { const m = confeti[i], d = m.userData; d.v.y -= 9 * dt; m.position.addScaledVector(d.v, dt); m.rotation.x += d.giro * dt; m.rotation.y += d.giro * dt; d.vida -= dt; m.material.opacity = Math.max(0, d.vida); if (d.vida <= 0) { escena.remove(m);m.geometry.dispose();m.material.dispose();confeti.splice(i, 1); } }
    nubes.forEach(n => { if (!n.visible) return; n.position.x += n.userData.v * dt * n.scale.x; if (n.position.x > n.userData.limite) n.position.x = n.userData.min ?? -220; });
    controles.update();
    renderer.render(escena, camara);
  };
  camara.position.set(0, 300, 260); controles.target.set(0, 0, 8);
  requestAnimationFrame(frame);

  return {
    elemento: caja,
    montar(div) { div.appendChild(caja); if (ro) { ro.disconnect(); ro.observe(div); } tamano(); },
    // animarK: el cantón que acaba de subir (sus piezas nuevas aparecen con animación y confeti)
    estado(nuevo, animarK) { dirty=true;
      est = { ...est, ...nuevo, niv: { ...(nuevo.niv || {}) } };
      Object.values(cantones).forEach(c => aplicar(c, nivelDe(c.k), c.k === animarK));
      if (animarK && cantones[animarK]) { const can = cantones[animarK], p = centroMundo(can); lanzarConfeti(p.x, p.y + 1, p.z, can.u); }
    },
    enfocar,
    subir(k) { const can = cantones[k]; if (!can) return; aplicar(can, nivelDe(k), true); const p = centroMundo(can); lanzarConfeti(p.x, p.y + 1, p.z, can.u); },
    zoom(factor){vuelo=null;controles.autoRotate=false;camara.position.sub(controles.target).multiplyScalar(factor).add(controles.target);dirty=true;},
    rotar(angle){vuelo=null;controles.autoRotate=false;camara.position.sub(controles.target).applyAxisAngle(new THREE.Vector3(0,1,0),angle).add(controles.target);dirty=true;},
    foco: () => foco,
    info: k => ({ hito: C3[k].hito, nombreHito: C3[k].n, alpes: C3[k].alpes || 0 }),
    saltar() { if (vuelo) { controles.target.copy(vuelo.hacia.t); camara.position.copy(vuelo.hacia.p); vuelo = null; } tweens.forEach(tw => tw.f(1)); tweens.length = 0; },
    foto(tipo = 'image/webp', calidad = 0.82) { renderer.render(escena, camara); return renderer.domElement.toDataURL(tipo, calidad); },
    destruir() { vivo = false; if (ro) ro.disconnect(); controles.dispose();const geos=new Set(),materials=new Set();escena.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m))});geos.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.forceContextLoss(); },
  };
}

export const Mapa3D = { crear, C3, NIVELES, EMOJI_NIVEL };
