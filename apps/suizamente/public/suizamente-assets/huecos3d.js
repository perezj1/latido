/* Suizamente · Reparto de huecos en un cantón: las plazas de negocio, alrededor del pueblo, y los huecos de decoración
   (tierra, agua y aire), repartidos por todo el cantón lo más separados posible. Se calcula una vez por cantón y se
   guarda en data/huecos.json (no se recalcula en el juego, para que un hueco no cambie de sitio).
   No depende de THREE: recibe funciones que preguntan a la maqueta.
   entrada: {
     u,                          // tamaño de referencia del cantón (can.u)
     centro: [x, z],             // centro del pueblo (centroMundo)
     radioPueblo,                // el radio que la maqueta reserva para el pueblo: max(2,2 u, min(0,8 × can.radio, 5 u))
     caja: [x0, z0, x1, z1],     // rectángulo del cantón en el mundo
     enTierra(x, z),             // true si es tierra del cantón (no agua)
     enAgua(x, z),               // true si es agua del cantón
     obstaculos: [[x, z, r]],    // pueblo, monumento y montañas en nivel 3 (no los árboles: esos se apartan)
     tapado(x, z),               // true si desde la cámara de siempre algo alto lo tapa (el monumento, una montaña)
   }
   opciones: { plazas: 5, tierra: 6, agua: 1, aire: 1 }
   Devuelve { plazas: [[dx, dz]], tierra: [[dx, dz]], agua: [[dx, dz]], aire: [[dx, dz]] } en unidades u desde el centro. */
(function (G) {
'use strict';

function repartir(e, op = {}) {
  const N = { plazas: 5, tierra: 6, agua: 1, aire: 1, ...op }, u = e.u, [cx, cz] = e.centro, [x0, z0, x1, z1] = e.caja;
  const paso = 0.4 * u, d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const lejosDelBorde = (x, z, r) => { for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; if (!e.enTierra(x + Math.cos(a) * r, z + Math.sin(a) * r)) return false; } return true; };
  const libre = (p, margen) => e.obstaculos.every(o => d(p, o) > o[2] + margen);
  // 1 · Candidatos en tierra: lejos del borde, de los obstáculos y sin nada alto delante
  const tierra = [];
  for (let x = x0; x <= x1; x += paso) for (let z = z0; z <= z1; z += paso) {
    const p = [x, z];
    if (e.enTierra(x, z) && lejosDelBorde(x, z, 0.9 * u) && libre(p, 0.7 * u) && !e.tapado(x, z)) tierra.push(p);
  }
  // Lo más separado posible: cada vez, el candidato más lejos de todo lo ya elegido
  const elegir = (cands, n, fijos, sep) => {
    const res = [], todos = [...fijos];
    for (let k = 0; k < n; k++) {
      let mejor = null, md = -1;
      for (const c of cands) { const m = todos.length ? Math.min(...todos.map(t => d(c, t))) : Infinity; if (m >= sep && m > md) { md = m; mejor = c; } }
      if (!mejor) break;
      res.push(mejor); todos.push(mejor);
    }
    return res;
  };
  // 2 · Plazas de negocio: en el pueblo, entre las casas (anillo de 0,75 a 1,4 veces el radio que la maqueta reserva
  //     para el pueblo); la primera, la más cercana a la cámara (la más visible)
  const R = e.radioPueblo || 3 * u;
  const anillo = tierra.filter(p => { const r = d(p, e.centro); return r > 0.75 * R && r < 1.4 * R; });
  const primera = anillo.slice().sort((a, b) => (b[1] - cz) - (a[1] - cz))[0];
  const plazas = primera ? [primera, ...elegir(anillo, N.plazas - 1, [primera], 1.6 * u)] : [];
  // 3 · Decoraciones en tierra: por todo el cantón, lejos de las plazas, del pueblo y entre sí
  const tierraDeco = elegir(tierra.filter(p => plazas.every(q => d(p, q) > 1.5 * u)), N.tierra, [...plazas, e.centro], 1.7 * u);
  // 4 · Agua: el punto con más agua alrededor (para el barco)
  const agua = [];
  for (let x = x0; x <= x1; x += paso) for (let z = z0; z <= z1; z += paso) if (e.enAgua(x, z)) {
    let r = 0; while (r < 3 * u && [0, 1, 2, 3, 4, 5, 6, 7].every(i => e.enAgua(x + Math.cos(i * Math.PI / 4) * (r + 0.2 * u), z + Math.sin(i * Math.PI / 4) * (r + 0.2 * u)))) r += 0.2 * u;
    agua.push([x, z, r]);
  }
  agua.sort((a, b) => b[2] - a[2]);
  // 5 · Aire: sobre el hueco de tierra que sobra más lejos del pueblo (el globo flota a 3,4 u)
  const aire = elegir(tierra.filter(p => [...plazas, ...tierraDeco].every(q => d(p, q) > 1.2 * u)), N.aire, [e.centro, ...tierraDeco], 0);
  const rel = p => [+((p[0] - cx) / u).toFixed(2), +((p[1] - cz) / u).toFixed(2)];
  return { plazas: plazas.map(rel), tierra: tierraDeco.map(rel), agua: agua.slice(0, N.agua).map(rel), aire: aire.map(rel), candidatos: tierra.length };
}

G.Huecos3D = { repartir };
})(typeof window !== 'undefined' ? window : this);
