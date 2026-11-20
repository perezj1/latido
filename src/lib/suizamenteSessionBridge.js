// Used by both hosts. A session is handed only to the game's same-origin frame;
// no tokens are put in URLs or sent between Latido and the standalone domain.
export function isSuizamentePath(value) {
  if(typeof value!=='string'||value.length>600||!value.startsWith('/')||value.startsWith('//')||/[\u0000-\u001f\u007f]/.test(value)||value.includes('\\'))return false
  try {
    const url=new URL(value,'https://suizamente.latido.ch')
    return url.origin==='https://suizamente.latido.ch'&&!url.hash&&/^\/(?:retos|ranking|libreta|perfil(?:\/editar)?|amigos|bienvenida|como-se-juega|medallas|ajustes|proponer|moderacion|avisos|jugar|duelo\/[A-Fa-f0-9]{8})?$/.test(url.pathname)
  }catch{return false}
}
export function connectSuizamenteSession({ getFrame, getSession, api, standalone=false, allowLogout=standalone, experience=false, socialApi=null, getPath=()=> '/', onNavigate, onLogout, target=window }) {
  async function identify(event) {
    const frame = getFrame()
    if (!frame || event.origin !== target.location.origin || event.source !== frame) return
    if(event.data?.type==='suizamente:logout') {
      if(allowLogout)await onLogout?.()
      return
    }
    if(event.data?.type==='suizamente:navigate') {
      if(isSuizamentePath(event.data.path))onNavigate?.(event.data.path)
      return
    }
    if (event.data?.type !== 'suizamente:identity'
      || typeof event.data.requestId !== 'string' || event.data.requestId.length > 100) return
    let session = null
    try { session = (await getSession()).data?.session || null } catch { /* Game remains playable as a guest. */ }
    if (event.source !== getFrame()) return
    event.source.postMessage({
      type:'suizamente:session', requestId:event.data.requestId,
      token:session?.access_token || null, userId:session?.user?.id || null,
      api, ...(standalone ? { app:'standalone' } : {}),
      ...(experience ? {experience:true,socialApi,path:getPath(),userName:session?.user?.user_metadata?.name||null,accountPath:standalone?'/cuenta':'/auth?next=%2Fsuizamente',installPath:standalone?'/instalar':null,canLogout:allowLogout&&typeof onLogout==='function'} : {}),
    }, target.location.origin)
  }
  target.addEventListener('message', identify)
  return () => target.removeEventListener('message', identify)
}
