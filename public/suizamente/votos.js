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

function votosApi(base, jugadorId, extras = {}) {
  const st = { estado:'cargando', conteos:{}, puede:true };
  let ctx, running = false;
  const queueKey='suizamente:pendientes:'+(extras.account||jugadorId||'anon');
  let pendientes=[];
  try{pendientes=JSON.parse(localStorage.getItem(queueKey)||'[]');if(!Array.isArray(pendientes))pendientes=[];}catch{}
  const guardar=()=>{try{localStorage.setItem(queueKey,JSON.stringify(pendientes));}catch{}};
  async function pedir(ruta, opts = {}) {
    const session = await identidadLatido();
    const headers = { 'Content-Type':'application/json' };
    if (jugadorId) headers['X-Jugador-Id'] = jugadorId;
    if (session.token) headers.Authorization = 'Bearer ' + session.token;
    const {api=base,...init}=opts;
    return fetch(api.replace(/\/$/, '') + ruta, {
      ...init, headers, credentials:'same-origin', signal:AbortSignal.timeout(15000),
    });
  }
  async function enviar(id, opcion, contexto=null) {
    const social=extras.socialApi?.();
    if(contexto&&!social)throw new Error('Reto pendiente de conexión');
    const response = await pedir(social?'/answer':'/votos', { method:'POST', api:social||base, body:JSON.stringify({ preguntaId:id, opcion, ...(contexto?{contexto}:{}) }) });
    if (response.status === 401 || (response.status === 403&&!contexto)) st.puede = false;
    if (!response.ok) throw Object.assign(new Error('No se pudo guardar el voto'),{status:response.status});
    const data = await response.json();
    extras.onAnswer?.({...data,preguntaId:id});
    st.conteos[id] = data.reparto;
    ctx.recuperar({ [id]:data.opcion });
    st.estado = 'ok';
    ctx.alCambiar();
    return data;
  }
  async function actualizar() {
    if (running) return;
    running = true;
    try{const stored=JSON.parse(localStorage.getItem(queueKey)||'[]');if(Array.isArray(stored))pendientes=stored;}catch{}
    const slow = setTimeout(() => { st.estado = 'lento'; ctx.alCambiar(); }, 10000);
    try {
      const [summary, mine] = await Promise.all([pedir('/votos/resumen?actual=1'), pedir('/votos/mios')]);
      if (!summary.ok) throw new Error('Sin recuentos');
      st.conteos = (await summary.json()).conteos || {};
      if (!mine.ok && mine.status !== 401 && mine.status !== 403) throw new Error('Sin votos propios');
      st.puede = mine.ok;
      const saved = mine.ok ? (await mine.json()).votos || {} : {};
      ctx.recuperar(saved);
      for(const entry of pendientes.slice(0,20)){
        try{const result=await enviar(entry.id,entry.opcion,entry.contexto);saved[entry.id]=result.opcion;pendientes=pendientes.filter(p=>p.key!==entry.key);guardar();}
        catch(error){if([400,403,404,409].includes(error.status)){pendientes=pendientes.filter(p=>p.key!==entry.key);guardar();}else throw error;}
      }
      // Retry offline choices and obtain totals that include our saved votes.
      let reenviadas=0;
      if (st.puede) for (const [id, option] of Object.entries(ctx.misVotos())) if (saved[id] === undefined && reenviadas++<20) await enviar(id, option);
      st.estado = pendientes.length?'error':'ok';
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
    async votar(id, opcion, contexto=null) {
      if (!st.puede) return;
      const key=JSON.stringify([id,contexto]);
      if(!pendientes.some(p=>p.key===key)){pendientes.push({key,id,opcion,contexto});guardar();}
      try { await enviar(id, opcion, contexto);pendientes=pendientes.filter(p=>p.key!==key);guardar(); }
      catch (error) {if([400,403,404,409].includes(error.status)){pendientes=pendientes.filter(p=>p.key!==key);guardar();} st.estado = 'error'; ctx.alCambiar(); }
    },
  };
}
