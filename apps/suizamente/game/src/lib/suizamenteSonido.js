/* Suizamente · sonido y música (FUNCIONES.md, sección 23.19)
 *
 * Melodía propia de Suizamente: «sui-za-MEN-te» (Sol · Do · Sol · Mi) y su final en Do agudo.
 * Todo se genera con Web Audio en el navegador: no hay archivos de audio que descargar.
 *
 *   sintonia  la melodía corta (unos 2 s): animación de apertura y regalo de bienvenida
 *   musica    la melodía larga de fondo (8 compases de cumbia que se repiten): pantallas sin pregunta
 *   acierto   al acertar una pregunta (0,5 s)
 *   fallo     al fallar o al acabarse el tiempo (0,6 s)
 *   premio    «¡tachán!»: al abrir un regalo, un cofre o un sobre, y al ganar un sello (1 s)
 *   victoria  al ganar una partida (3 s)
 *
 * Uso:
 *   const sonido = SZSonido.crear({ ajustes: () => ({ musica: true, sonidos: true }) });
 *   // El navegador no deja sonar nada hasta el primer toque o tecla:
 *   ['pointerdown', 'pointerup', 'touchend', 'click'].forEach(tipo => document.addEventListener(tipo, sonido.desbloquear, true));
 *   document.addEventListener('keydown', sonido.desbloquear, true);
 *   document.addEventListener('visibilitychange', () => document.hidden ? sonido.ocultar() : sonido.mostrar());
 *   sonido.musica(true);               // en cada cambio de pantalla: true si la pantalla lleva música
 *   sonido.tocar('acierto');           // devuelve lo que dura, en segundos (0 si no ha sonado)
 *   sonido.tocar('sintonia', { esperar: 3000 }); // si aún no se puede, suena con el primer toque de los próximos 3 s
 *   sonido.actualizar();               // después de cambiar «Música» o «Sonidos» en Ajustes
 *   sonido.destruir();
 *
 * La sintonía y la victoria paran la música mientras suenan y la música vuelve sola al acabar.
 * El premio, el acierto y el fallo solo la bajan un momento.
 * Al volver, la música sigue desde el principio de la frase en la que se quedó.
 */
// ES module adapted from the reference; notes, instruments and enabled volumes unchanged.
const SZSonido = (() => {
  'use strict';

  var VOLUMEN = { efectos: 0.9, musica: 0.4 }; // la música, más baja que los efectos
  var FUNDIDO = { entrada: 0.9, salida: 0.35 }; // segundos

  /* ---------- La música de fondo: 8 compases de cumbia a 112 por minuto ---------- */
  var NEGRA = 60 / 112, C = NEGRA / 2, COMPAS = 8 * C;
  // [compás, corchea, duración en corcheas, nota MIDI, papel: 0 sui, 1 za, 2 MEN, 3 te, 4 ¡Do!, 5 adorno]
  var MELODIA = [
    [0,0,1,67,0],[0,1,1,72,1],[0,2,2,79,2],[0,4,2,76,3],
    [1,0,1,67,0],[1,1,1,72,1],[1,2,2,81,2],[1,4,2,77,3],
    [2,0,1,67,0],[2,1,1,74,1],[2,2,2,83,2],[2,4,2,79,3],
    [3,0,4,84,4],
    [4,0,1,67,0],[4,1,1,72,1],[4,2,2,79,2],[4,4,2,76,3],
    [5,0,1,67,0],[5,1,1,72,1],[5,2,2,81,2],[5,4,2,77,3],
    [6,0,1,81,5],[6,1,1,79,5],[6,2,1,77,5],[6,3,1,76,5],[6,4,1,74,5],[6,5,1,76,5],[6,6,1,77,5],[6,7,1,74,5],
    [7,0,4,72,4]
  ];
  var DO = [60,64,67], FA = [60,65,69], SOL = [59,62,67], LAM = [60,64,69], REM = [62,65,69], SOL7 = [59,65,67];
  // Acordeón en las corcheas 2, 4, 6 y 8 (primera mitad, segunda mitad) y bajo [corchea, nota, duración]
  var COMPASES = [
    { ac: [DO, DO],    bajo: [[0,48,1.6],[4,43,1.6]] },
    { ac: [FA, FA],    bajo: [[0,41,1.6],[4,48,1.6]] },
    { ac: [SOL, SOL],  bajo: [[0,43,1.6],[4,50,1.6]] },
    { ac: [DO, null],  bajo: [[0,48,1.6],[4,43,1.6]] },
    { ac: [LAM, LAM],  bajo: [[0,45,1.6],[4,52,1.6]] },
    { ac: [FA, FA],    bajo: [[0,41,1.6],[4,48,1.6]] },
    { ac: [REM, SOL7], bajo: [[0,50,1.6],[4,43,1.4],[6,47,0.8]] },
    { ac: [DO, null],  bajo: [[0,48,3.2],[6,43,0.8]] }
  ];

  function crear(opciones) {
    opciones = opciones || {};
    var host = opciones.host || (typeof window !== 'undefined' ? window : null);
    var ajustes = opciones.ajustes || function () { return {}; };
    var ctx = null, master = null, busEfectos = null, busMusica = null, ruido = null;
    var listo = false, oculto = false, quiereMusica = false, calladaHasta = 0, reloj = null;
    var bucle = null, siguiente = 0, pendiente = null, destruido = false;
    var efectos = new Set(), limpiezas = new Set();
    function diferir(f, ms) { var id = setTimeout(function () { limpiezas.delete(id); f(); }, ms); limpiezas.add(id); return id; }
    function cortarEfectos() { efectos.forEach(function (out) { try { out.disconnect(); } catch { /* ya estaba */ } }); efectos.clear(); }

    var hz = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };
    var conMusica = function () { var a = ajustes() || {}; return a.musica !== false; };
    var conSonidos = function () { var a = ajustes() || {}; return a.sonidos !== false; };
    var enSegundoPlano = function () { return host && host.document && (host.document.hidden || host.document.visibilityState === 'hidden'); };

    /* ---------- Arranque: solo tras un gesto ---------- */
    function montar() {
      var AC = host && (host.AudioContext || host.webkitAudioContext);
      if (!AC) return false;
      try { ctx = new AC(); } catch { ctx = null; return false; }
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
      master = ctx.createGain(); master.gain.value = 0.85;
      busEfectos = ctx.createGain(); busEfectos.gain.value = VOLUMEN.efectos;
      busMusica = ctx.createGain(); busMusica.gain.value = VOLUMEN.musica;
      busEfectos.connect(master); busMusica.connect(master); master.connect(comp); comp.connect(ctx.destination);
      ruido = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var d = ruido.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      if (ctx.addEventListener) ctx.addEventListener('statechange', alCambiar);
      return true;
    }
    function alCambiar() {
      if (!ctx) return;
      if (ctx.state !== 'running') {
        listo = false;
        var anterior = bucle; pararMusica();
        if (anterior) { try { anterior.out.disconnect(); } catch { /* ya estaba */ } }
        cortarEfectos(); calladaHasta = 0; clearTimeout(reloj);
        return;
      }
      if (oculto || enSegundoPlano() || destruido) return;
      master.gain.value = 0.85;
      listo = true;
      if (pendiente) {
        var p = pendiente; pendiente = null;
        if (Date.now() <= p.hasta) tocar(p.tipo);
      }
      revisarMusica();
    }
    function desbloquear() {
      if (destruido || enSegundoPlano()) return;
      if (!ctx && !montar()) return;
      // A foreground gesture also recovers when a PWA missed its pageshow event.
      oculto = false; master.gain.value = 0.85;
      if (ctx.state === 'running') return alCambiar();
      try { var r = ctx.resume(); if (r && r.then) r.then(alCambiar, function () {}); } catch { /* sin sonido */ }
    }

    /* ---------- Instrumentos ---------- */
    function env(g, t, v, a, dec) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
    }
    function osc(tipo, f, t, d, out) {
      var o = ctx.createOscillator(); o.type = tipo; o.frequency.value = f;
      o.connect(out); o.start(t); o.stop(t + d); return o;
    }
    function golpe(t, m, v, out) { // marimba
      var f = hz(m), dec = Math.max(0.4, 0.9 - (m - 67) * 0.025);
      var g1 = ctx.createGain(); g1.connect(out); env(g1, t, v, 0.004, dec); osc('sine', f, t, dec + 0.05, g1);
      var g2 = ctx.createGain(); g2.connect(out); env(g2, t, v * 0.3, 0.002, 0.07); osc('sine', f * 4, t, 0.1, g2);
      var g3 = ctx.createGain(); g3.connect(out); env(g3, t, v * 0.1, 0.001, 0.025); osc('sine', f * 9.9, t, 0.04, g3);
    }
    function marimba(t, m, d, v, out) { // las notas largas, con redoble
      if (d < 0.7) { golpe(t, m, v, out); return; }
      var f = hz(m), paso = 0.075, x = t, k = 0;
      var g = ctx.createGain(), g4 = ctx.createGain(); g.connect(out); g4.connect(out);
      g.gain.setValueAtTime(0.0001, t); g4.gain.setValueAtTime(0.0001, t);
      for (; x < t + d - 0.02; x += paso, k++) {
        var a = k === 0 ? v : v * 0.55;
        g.gain.exponentialRampToValueAtTime(a, x + 0.004);
        g.gain.exponentialRampToValueAtTime(a * 0.4, x + paso - 0.006);
        g4.gain.exponentialRampToValueAtTime(a * 0.22, x + 0.002);
        g4.gain.exponentialRampToValueAtTime(0.0001, x + 0.04);
      }
      g.gain.exponentialRampToValueAtTime(0.0001, x + 0.45);
      osc('sine', f, t, x - t + 0.5, g); osc('sine', f * 4, t, x - t + 0.1, g4);
    }
    function campana(t, m, v, out) {
      var f = hz(m);
      [[1, 1, 1.4], [2.756, 0.45, 0.5], [5.404, 0.22, 0.25]].forEach(function (p) {
        var g = ctx.createGain(); g.connect(out); env(g, t, v * p[1], 0.002, p[2]); osc('sine', f * p[0], t, p[2] + 0.05, g);
      });
    }
    function acordeon(t, notas, d, v, out) {
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = 0.6;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.015);
      g.gain.setValueAtTime(v, t + d * 0.6); g.gain.linearRampToValueAtTime(0.0001, t + d);
      lp.connect(g); g.connect(out);
      notas.forEach(function (m) {
        osc('sawtooth', hz(m), t, d + 0.02, lp).detune.value = -9;
        osc('square', hz(m), t, d + 0.02, lp).detune.value = 9;
      });
    }
    function bajo(t, m, d, v, out) {
      var f = hz(m);
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3;
      lp.frequency.setValueAtTime(1100, t); lp.frequency.exponentialRampToValueAtTime(260, t + Math.max(0.1, d));
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.006);
      g.gain.exponentialRampToValueAtTime(v * 0.45, t + d * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + d + 0.05);
      lp.connect(g); g.connect(out);
      osc('sawtooth', f, t, d + 0.08, lp); osc('triangle', f, t, d + 0.08, lp);
    }
    function guiro(t, largo, v, out) {
      var s = ctx.createBufferSource(); s.buffer = ruido;
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = largo ? 3000 : 4500; bp.Q.value = 1.4;
      var g = ctx.createGain(), d = largo ? 0.17 : 0.04;
      g.gain.setValueAtTime(0.0001, t);
      if (largo) {
        var n = 8, p = d / n;
        for (var i = 0; i < n; i++) {
          g.gain.setValueAtTime(v * (0.6 + 0.4 * i / n), t + 0.001 + i * p);
          g.gain.setValueAtTime(v * 0.15, t + 0.001 + i * p + p * 0.55);
        }
        g.gain.setValueAtTime(0.0001, t + d + 0.01);
      } else {
        g.gain.exponentialRampToValueAtTime(v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      }
      s.connect(bp); bp.connect(g); g.connect(out);
      s.start(t, Math.random() * 0.7, d + 0.03);
    }
    function bombo(t, v, out) {
      var o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
      var g = ctx.createGain(); env(g, t, v, 0.003, 0.26);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.32);
    }

    /* ---------- Las piezas ---------- */
    var PIEZAS = {
      sintonia: function (t, out) { // sui-za-MEN-te ¡tin!
        var e = 0.19;
        [[0, 67, e, 0.52], [1, 72, e, 0.52], [2, 79, 2 * e, 0.6], [4, 76, e, 0.52]].forEach(function (n) {
          marimba(t + n[0] * e, n[1], n[2], n[3], out); guiro(t + n[0] * e, false, 0.045, out);
        });
        campana(t + 2 * e, 91, 0.07, out);
        var tf = t + 5 * e;
        marimba(tf, 84, 0.85, 0.6, out); campana(tf, 84, 0.12, out); campana(tf, 96, 0.07, out);
        acordeon(tf, [60, 64, 67, 72], 0.32, 0.045, out); bajo(tf, 48, 0.6, 0.3, out); bombo(tf, 0.4, out); guiro(tf, true, 0.06, out);
        return 2.1;
      },
      acierto: function (t, out) { // las tres primeras notas, rápidas
        marimba(t, 67, 0.07, 0.45, out); marimba(t + 0.07, 72, 0.07, 0.5, out); marimba(t + 0.14, 79, 0.3, 0.58, out);
        campana(t + 0.14, 91, 0.1, out); campana(t + 0.14, 79, 0.07, out);
        return 0.5;
      },
      fallo: function (t, out) { // dos notas suaves hacia abajo
        marimba(t, 75, 0.15, 0.36, out); marimba(t + 0.17, 71, 0.4, 0.4, out); bajo(t + 0.17, 47, 0.25, 0.16, out);
        return 0.6;
      },
      premio: function (t, out) { // ¡tachán!: un «ta» corto en Sol y un «chán» grande en Do con campanitas que suben
        acordeon(t, [59, 62, 67], 0.1, 0.04, out); marimba(t, 79, 0.1, 0.5, out); bajo(t, 43, 0.12, 0.26, out); guiro(t, false, 0.05, out);
        var tc = t + 0.16;
        acordeon(tc, [60, 64, 67, 72], 0.7, 0.05, out);
        marimba(tc, 84, 0.75, 0.62, out); marimba(tc, 76, 0.3, 0.4, out);
        bajo(tc, 48, 0.7, 0.34, out); bombo(tc, 0.45, out); guiro(tc, true, 0.06, out);
        campana(tc, 84, 0.12, out); campana(tc, 96, 0.08, out);
        [88, 91, 96, 100].forEach(function (m, i) { campana(tc + 0.05 + 0.05 * i, m, 0.05, out); });
        return 1.1;
      },
      victoria: function (t, out) { // las tres frases seguidas y el final con campanitas
        var e = 0.13, M = [[67, 72, 79, 76], [67, 72, 81, 77], [67, 74, 83, 79]];
        var A = [[60, 64, 67], [60, 65, 69], [59, 62, 67]], B = [48, 41, 43];
        M.forEach(function (fr, j) {
          var t0 = t + j * 5 * e;
          fr.forEach(function (m, i) { marimba(t0 + i * e, m, e, i === 2 ? 0.58 : 0.5, out); });
          campana(t0 + 2 * e, fr[2] + 12, 0.07, out);
          bajo(t0, B[j], 0.45, 0.28, out); bombo(t0, 0.35, out); guiro(t0, true, 0.055, out);
          acordeon(t0 + e, A[j], 0.12, 0.035, out); acordeon(t0 + 3 * e, A[j], 0.12, 0.035, out);
        });
        var tf = t + 15 * e;
        marimba(tf, 84, 1.1, 0.62, out); campana(tf, 84, 0.13, out); campana(tf, 96, 0.08, out);
        [84, 88, 91, 96, 100, 103].forEach(function (m, i) { campana(tf + 0.06 * i, m, 0.05, out); });
        acordeon(tf, [60, 64, 67, 72], 0.5, 0.045, out); bajo(tf, 48, 0.9, 0.32, out); bombo(tf, 0.45, out);
        return 3.1;
      }
    };
    var CALLAN_LA_MUSICA = { sintonia: true, victoria: true };
    var BAJAN_LA_MUSICA = { premio: true, acierto: true, fallo: true };
    // Keep the game's original wheel motif, routed through this same context.
    PIEZAS.ruleta = function (t, out) {
      [510,430,570,470,620].forEach(function (f,i) {
        var g = ctx.createGain(), when = t + i * 0.075;
        g.gain.setValueAtTime(0,when); g.gain.linearRampToValueAtTime(0.045,when+0.008); g.gain.exponentialRampToValueAtTime(0.0001,when+0.115);
        g.connect(out); osc('sine',f,when,0.12,g);
      });
      return 0.42;
    };
    function agachar(dura) { // baja la música mientras suena un efecto y la sube después
      var g = busMusica.gain, ahora = ctx.currentTime;
      if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(ahora); else { g.cancelScheduledValues(ahora); g.setValueAtTime(g.value, ahora); }
      g.setTargetAtTime(VOLUMEN.musica * 0.25, ahora, 0.03);
      g.setTargetAtTime(VOLUMEN.musica, ahora + dura, 0.25);
    }

    function compas(b, t, out) {
      var k = COMPASES[b];
      MELODIA.forEach(function (n) {
        if (n[0] !== b) return;
        var v = n[4] === 2 ? 0.56 : n[4] === 5 ? 0.42 : 0.5;
        marimba(t + n[1] * C, n[3], n[2] * C * 0.95, v, out);
        if (n[4] === 2 || (n[4] === 4 && n[3] > 80)) campana(t + n[1] * C, n[3] + 12, 0.05, out);
      });
      k.bajo.forEach(function (n) { bajo(t + n[0] * C, n[1], n[2] * C, 0.26, out); });
      [1, 3, 5, 7].forEach(function (e) { var ac = k.ac[e < 4 ? 0 : 1]; if (ac) acordeon(t + e * C, ac, 0.13, 0.03, out); });
      for (var q = 0; q < 4; q++) {
        var tq = t + q * NEGRA;
        guiro(tq, true, 0.05, out); guiro(tq + C, false, 0.04, out); guiro(tq + C * 1.5, false, 0.035, out);
      }
      bombo(t, 0.32, out); bombo(t + 4 * C, 0.26, out);
    }

    /* ---------- Música de fondo ---------- */
    function empezarMusica() {
      var out = ctx.createGain(), t0 = ctx.currentTime + 0.06, primero = siguiente;
      out.gain.setValueAtTime(0.0001, t0); out.gain.exponentialRampToValueAtTime(1, t0 + FUNDIDO.entrada);
      out.connect(busMusica);
      bucle = { out: out, t0: t0, primero: primero, n: 0 };
      var programar = function () {
        if (!bucle || bucle.out !== out) return;
        while (t0 + bucle.n * COMPAS < ctx.currentTime + COMPAS * 1.25) {
          compas((primero + bucle.n) % 8, t0 + bucle.n * COMPAS, out); bucle.n++;
        }
      };
      programar(); bucle.reloj = setInterval(programar, 200);
    }
    function pararMusica() {
      if (!bucle) return;
      var b = bucle; bucle = null;
      clearInterval(b.reloj);
      // Al volver, sigue desde el principio de la frase en la que estaba (compás 1 o 5)
      var sonando = Math.max(0, Math.floor((ctx.currentTime - b.t0) / COMPAS));
      siguiente = Math.floor(((b.primero + sonando) % 8) / 4) * 4;
      var g = b.out.gain, ahora = ctx.currentTime;
      if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(ahora); else { g.cancelScheduledValues(ahora); g.setValueAtTime(g.value, ahora); }
      g.setTargetAtTime(0, ahora, FUNDIDO.salida / 3);
      diferir(function () { try { b.out.disconnect(); } catch { /* ya estaba */ } }, FUNDIDO.salida * 1000 + 400);
    }
    function revisarMusica() {
      if (!ctx) return;
      var debe = listo && !oculto && quiereMusica && conMusica() && ctx.currentTime >= calladaHasta;
      if (debe && !bucle) empezarMusica();
      else if (!debe && bucle) pararMusica();
    }

    /* ---------- Lo que usa la app ---------- */
    function tocar(tipo, op) {
      if (destruido || !PIEZAS[tipo] || !conSonidos()) return 0;
      if (!listo || !ctx || ctx.state !== 'running') {
        // Aún no se puede: si lo piden, se guarda para el primer toque y se intenta arrancar
        if (op && op.esperar) { pendiente = { tipo: tipo, hasta: Date.now() + op.esperar }; desbloquear(); }
        return 0;
      }
      if (oculto) return 0;
      var out = ctx.createGain(); out.connect(busEfectos); efectos.add(out);
      var dura = PIEZAS[tipo](ctx.currentTime + 0.03, out);
      diferir(function () { efectos.delete(out); try { out.disconnect(); } catch { /* ya estaba */ } }, (dura + 1.5) * 1000);
      if (CALLAN_LA_MUSICA[tipo]) {
        calladaHasta = ctx.currentTime + dura + 0.2;
        pararMusica();
        clearTimeout(reloj); reloj = setTimeout(revisarMusica, (dura + 0.3) * 1000);
      } else if (BAJAN_LA_MUSICA[tipo] && bucle) agachar(dura);
      return dura;
    }
    function musica(si) { quiereMusica = !!si; revisarMusica(); }
    function ocultar() {
      oculto = true; pendiente = null;
      if (!ctx) return;
      var anterior = bucle; pararMusica();
      if (anterior) { try { anterior.out.disconnect(); } catch { /* ya estaba */ } }
      master.gain.value = 0; cortarEfectos(); calladaHasta = 0; clearTimeout(reloj);
      try { var r = ctx.suspend(); if (r && r.catch) r.catch(function () {}); } catch { /* sin sonido */ }
    }
    function mostrar() {
      if (destruido || enSegundoPlano()) return;
      oculto = false;
      if (!ctx) return;
      master.gain.value = 0.85;
      try { var r = ctx.resume(); if (r && r.then) r.then(alCambiar, function () {}); } catch { /* sin sonido */ }
    }
    function actualizar() {
      if (busEfectos) busEfectos.gain.value = conSonidos() ? VOLUMEN.efectos : 0;
      if (!conSonidos()) { pendiente = null; cortarEfectos(); calladaHasta = 0; clearTimeout(reloj); }
      revisarMusica();
    }
    function destruir() {
      destruido = true; pararMusica(); clearTimeout(reloj); pendiente = null; listo = false; cortarEfectos();
      limpiezas.forEach(clearTimeout); limpiezas.clear();
      if (ctx) { try { var r = ctx.close(); if (r && r.catch) r.catch(function () {}); } catch { /* ya estaba */ } ctx = null; }
    }

    return {
      desbloquear: desbloquear,
      tocar: tocar,
      musica: musica,
      ocultar: ocultar,
      mostrar: mostrar,
      actualizar: actualizar,
      destruir: destruir,
      get sonando() { return { musica: !!bucle, listo: listo }; }
    };
  }

  return { crear: crear, PIEZAS: ['sintonia', 'acierto', 'fallo', 'premio', 'victoria', 'ruleta'], VOLUMEN: VOLUMEN };
})();
export default SZSonido;
export const crearSonido = SZSonido.crear;
