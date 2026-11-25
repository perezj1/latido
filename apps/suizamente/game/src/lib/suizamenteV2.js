/* global structuredClone, AbortController, Event, CustomEvent */
import {supabase,recoverSupabaseSession,invalidateSupabaseSession} from './supabase'
import {notify} from './suizamenteNotices'
import {normalizeSzSettings} from './suizamenteSettings'
const pendingReads=new Map()
const recentReads=new Map(),readTtl={config:30000,jugador:1000,partidas:1000,emparejamiento:1000,mapa:1500,album:1500,tienda:1500,amigos:1500,perfil:3000,logros:5000,misiones:3000,liga:5000,dia:1000}
let revision=0,reader=null
supabase.auth.onAuthStateChange((_event,session)=>{
 const actor=session?.user?.id||'invitado'
 if(reader!==actor){recentReads.clear();revision++;reader=actor}
})
let guestQueue=Promise.resolve()
export const SV_STATE='suizamente:estado'
export const SV_AVATARS='suizamente:avatares'
// Display only the last server response for the current account while revalidating.
// Memory-only, short-lived, and invalidated by every mutation/account change.
export function peekSzData(path,owner){
 if(!owner||reader!==owner)return null
 const cached=recentReads.get(path+'|'+owner+'|'+revision)
 return cached&&cached.displayUntil>Date.now()?structuredClone(cached.value):null
}
export function szKey(){
  const bytes=new Uint8Array(16);crypto.getRandomValues(bytes)
  bytes[6]=bytes[6]&15|64;bytes[8]=bytes[8]&63|128
  const hex=[...bytes].map(n=>n.toString(16).padStart(2,'0')).join('')
  return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20)
}

export async function szApi(path, {method='GET',body,fresh=false}={}) {
  let guest=localStorage.getItem('suizamente:jugador')
  if(!guest&&crypto.randomUUID){guest=crypto.randomUUID();localStorage.setItem('suizamente:jugador',guest)}
  const {data:{session}}=await supabase.auth.getSession()
  const actor=session?.user?.id||'invitado'
  if(reader!==actor||method!=='GET'){recentReads.clear();revision++;reader=actor}
  const key=path+'|'+actor+'|'+revision,ttl=readTtl[path]||0,startedRevision=revision,cached=recentReads.get(key)
  if(method==='GET'&&!fresh&&cached&&cached.until>Date.now()){
    const data=structuredClone(cached.value)
    // A preloaded response can arrive before the game's avatar listener mounts.
    if(data.avatares)window.dispatchEvent(new CustomEvent(SV_AVATARS,{detail:{userId:session?.user?.id,photos:data.avatares}}))
    return data
  }
  if(method==='GET'&&pendingReads.has(key))return pendingReads.get(key)
  const execute=async()=>{
  const send=async token=>{const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);try{return await fetch('/api/suizamente/'+path,{
    method,credentials:'same-origin',cache:'no-store',signal:controller.signal,
    headers:{'Content-Type':'application/json',...(guest?{'X-Jugador-Id':guest}:{}),...(token?{Authorization:'Bearer '+token}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),
  })}finally{clearTimeout(timeout)}}
  // Recover discarded iOS sockets and temporary gateway failures quietly. Never
  // replay a mutation: the server might have already committed its transaction.
  const read=async token=>{for(let attempt=0;;attempt++){
    try{const response=await send(token);if(method!=='GET'||attempt||!navigator.onLine||![500,502,503,504].includes(response.status))return response}
    catch(error){if(method!=='GET'||attempt||!navigator.onLine)throw error}
    await new Promise(resolve=>setTimeout(resolve,200))
  }}
  let response
  try{response=await read(session?.access_token)}catch{const error=new Error(method==='GET'?'No se pudo cargar. Comprueba la conexión y vuelve a intentarlo.':'No se pudo confirmar la acción. Comprueba la conexión y vuelve a intentarlo.');if(method!=='GET')notify(error,{error:true});throw error}
  const sessionRejected=response.status===401&&(await response.clone().json().catch(()=>null))?.sesionCaducada
  if(sessionRejected&&session?.access_token){const renewed=await recoverSupabaseSession(session.access_token,session.user?.id);if(renewed?.access_token){response=await read(renewed.access_token);if(response.status===401&&(await response.clone().json().catch(()=>null))?.sesionCaducada)await invalidateSupabaseSession(renewed.access_token)}}
  let data
  try{data=await response.json()}catch{const error=new Error('No se pudo conectar con Suizamente. Inténtalo otra vez.');if(method!=='GET')notify(error,{error:true});throw error}
  if(!response.ok){const error=new Error(data.error||'Algo ha fallado. Inténtalo otra vez.');error.status=response.status;error.partida=data.partida;if(method!=='GET')notify(error,{error:true});throw error}
  window.dispatchEvent(new Event('suizamente:conexion-restablecida'))
  data=withoutFlags(data)
  if(data.avatares)window.dispatchEvent(new CustomEvent(SV_AVATARS,{detail:{userId:session?.user?.id,photos:data.avatares}}))
  if(data.identidad?.startsWith('invitado-'))localStorage.setItem('suizamente:jugador',data.identidad.slice(9))
  if(data.jugador)window.dispatchEvent(new CustomEvent(SV_STATE,{detail:data}))
  if(method==='GET'&&ttl&&revision===startedRevision)recentReads.set(key,{until:Date.now()+ttl,displayUntil:Date.now()+30000,value:structuredClone(data)})
  return data
  }
  // The first anonymous response establishes the HttpOnly credential. Serialize
  // anonymous calls so parallel cards/bootstrap requests cannot replace it.
  const request=session?execute():guestQueue.then(execute)
  if(!session)guestQueue=request.catch(()=>{})
  if(method==='GET')pendingReads.set(key,request)
  try{return await request}finally{
    // A read may finish while a write is in flight. Discard that snapshot again
    // at completion (also after an unknown network outcome), so it cannot win.
    if(method!=='GET'&&reader===actor){recentReads.clear();revision++}
    if(pendingReads.get(key)===request)pendingReads.delete(key)
  }
}
// Preserve canonical ids and option indexes; flags are replaced only in the view.
function withoutFlags(value){
  if(typeof value==='string')return value.replace(/\p{Regional_Indicator}{2}|\u{1F3F3}\uFE0F?|\u{1F3F4}|\u{1F6A9}/gu,'📍').replace(/[\w.+%\-]+@[\w.\-]+\.[a-z]{2,}/gi,'[contacto oculto]')
  if(Array.isArray(value))return value.map(withoutFlags)
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,withoutFlags(v)]))
  return value
}
export function szSettings() {
  try{return normalizeSzSettings(JSON.parse(localStorage.getItem('suizamente:ajustes')||'{}'))}catch{return normalizeSzSettings()}
}
export const cantonNames={
  ZH:'Zúrich',BE:'Berna',LU:'Lucerna',UR:'Uri',SZ:'Schwyz',OW:'Obwalden',NW:'Nidwalden',GL:'Glaris',ZG:'Zug',FR:'Friburgo',SO:'Soleura',BS:'Basilea-Ciudad',BL:'Basilea-Campiña',SH:'Schaffhausen',AR:'Appenzell Rodas Exteriores',AI:'Appenzell Rodas Interiores',SG:'San Galo',GR:'Grisones',AG:'Argovia',TG:'Turgovia',TI:'Tesino',VD:'Vaud',VS:'Valais',NE:'Neuchâtel',GE:'Ginebra',JU:'Jura',
}
export const countryNames={AR:'Argentina',BO:'Bolivia',CL:'Chile',CO:'Colombia',CR:'Costa Rica',CU:'Cuba',DO:'República Dominicana',EC:'Ecuador',SV:'El Salvador',GQ:'Guinea Ecuatorial',ES:'España',GT:'Guatemala',HN:'Honduras',MX:'México',NI:'Nicaragua',PA:'Panamá',PY:'Paraguay',PE:'Perú',PR:'Puerto Rico',UY:'Uruguay',VE:'Venezuela',CH:'Suiza, nací aquí',otro:'Otro país'}
export function timeLeft(when,now=Date.now()) {
  const hours=Math.max(0,Math.ceil((Date.parse(when)-now)/3600000))
  return hours>=24?Math.floor(hours/24)+' d '+hours%24+' h':hours+' h'
}
