/* Same-origin session bridge; no credentials in URLs, HTML or local storage. */
async function identidadLatido() {
  if (window.parent === window) return { token:null, userId:null };
  return new Promise(resolve => {
    const requestId = crypto.randomUUID();
    const finish = value => { clearTimeout(timer); window.removeEventListener('message', receive); resolve(value); };
    const receive = event => {
      if (event.origin === location.origin && event.source === window.parent
        && event.data?.type === 'suizamente:session' && event.data.requestId === requestId) finish(event.data);
    };
    const timer = setTimeout(() => finish({ token:null, userId:null }), 3000);
    window.addEventListener('message', receive);
    window.parent.postMessage({ type:'suizamente:identity', requestId }, location.origin);
  });
}

function votosApi(base, jugadorId) {
  const st = { estado:'cargando', conteos:{}, puede:true };
  let ctx, running = false;
  async function pedir(ruta, opts = {}) {
    const session = await identidadLatido();
    const headers = { 'Content-Type':'application/json' };
    if (jugadorId) headers['X-Jugador-Id'] = jugadorId;
    if (session.token) headers.Authorization = 'Bearer ' + session.token;
    return fetch(base.replace(/\/$/, '') + ruta, {
      ...opts, headers, credentials:'same-origin', signal:AbortSignal.timeout(12000),
    });
  }
  async function enviar(id, opcion) {
    const response = await pedir('/votos', { method:'POST', body:JSON.stringify({ preguntaId:id, opcion }) });
    if (response.status === 401 || response.status === 403) st.puede = false;
    if (!response.ok) throw new Error('No se pudo guardar el voto');
    const data = await response.json();
    st.conteos[id] = data.reparto;
    ctx.recuperar({ [id]:data.opcion });
    st.estado = 'ok';
    ctx.alCambiar();
  }
  async function actualizar() {
    if (running) return;
    running = true;
    const slow = setTimeout(() => { st.estado = 'lento'; ctx.alCambiar(); }, 10000);
    try {
      const [summary, mine] = await Promise.all([pedir('/votos/resumen?actual=1'), pedir('/votos/mios')]);
      if (!summary.ok) throw new Error('Sin recuentos');
      st.conteos = (await summary.json()).conteos || {};
      if (!mine.ok && mine.status !== 401 && mine.status !== 403) throw new Error('Sin votos propios');
      st.puede = mine.ok;
      const saved = mine.ok ? (await mine.json()).votos || {} : {};
      ctx.recuperar(saved);
      // Retry offline choices and obtain totals that include our saved votes.
      if (st.puede) for (const [id, option] of Object.entries(ctx.misVotos())) if (saved[id] === undefined) await enviar(id, option);
      st.estado = 'ok';
    } catch (_) { st.estado = 'error'; }
    finally { clearTimeout(slow); running = false; ctx.alCambiar(); }
  }
  return {
    get estado() { return st.estado; },
    get puedeVotar() { return st.puede; },
    iniciar(context) {
      ctx = context;
      actualizar();
      const timer = setInterval(() => { if (!document.hidden) actualizar(); }, 60000);
      window.addEventListener('online', actualizar);
      window.addEventListener('pagehide', () => { clearInterval(timer); window.removeEventListener('online', actualizar); }, { once:true });
    },
    conteo(id) { return (st.conteos[id] || [0, 0, 0]).slice(); },
    async votar(id, opcion) {
      if (!st.puede) return;
      try { await enviar(id, opcion); }
      catch (_) { st.estado = 'error'; ctx.alCambiar(); }
    },
  };
}
