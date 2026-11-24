import {supabase} from './supabase'
const pendingReads=new Map()
let guestQueue=Promise.resolve()
export const SV_STATE='suizamente:estado'
export function szKey(){
  const bytes=new Uint8Array(16);crypto.getRandomValues(bytes)
  bytes[6]=bytes[6]&15|64;bytes[8]=bytes[8]&63|128
  const hex=[...bytes].map(n=>n.toString(16).padStart(2,'0')).join('')
  return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20)
}

export async function szApi(path, {method='GET',body}={}) {
  let guest=localStorage.getItem('suizamente:jugador')
  if(!guest&&crypto.randomUUID){guest=crypto.randomUUID();localStorage.setItem('suizamente:jugador',guest)}
  const {data:{session}}=await supabase.auth.getSession()
  const key=path+'|'+(session?.user?.id||'invitado')
  if(method==='GET'&&pendingReads.has(key))return pendingReads.get(key)
  const execute=async()=>{
  const response=await fetch('/api/suizamente/'+path,{
    method,credentials:'same-origin',cache:'no-store',
    headers:{'Content-Type':'application/json',...(guest?{'X-Jugador-Id':guest}:{}),...(session?.access_token?{Authorization:'Bearer '+session.access_token}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),
  }).catch(()=>{window.dispatchEvent(new Event('suizamente:error-conexion'));throw new Error('Algo ha fallado. Inténtalo otra vez.')})
  let data
  try{data=await response.json()}catch{throw new Error('No se pudo conectar con Suizamente. Inténtalo otra vez.')}
  if(!response.ok){if(response.status>=500)window.dispatchEvent(new Event('suizamente:error-conexion'));const error=new Error(data.error||'Algo ha fallado. Inténtalo otra vez.');error.status=response.status;error.partida=data.partida;throw error}
  data=withoutFlags(data)
  if(data.identidad?.startsWith('invitado-'))localStorage.setItem('suizamente:jugador',data.identidad.slice(9))
  if(data.jugador)window.dispatchEvent(new CustomEvent(SV_STATE,{detail:data}))
  return data
  }
  // The first anonymous response establishes the HttpOnly credential. Serialize
  // anonymous calls so parallel cards/bootstrap requests cannot replace it.
  const request=session?execute():guestQueue.then(execute)
  if(!session)guestQueue=request.catch(()=>{})
  if(method==='GET')pendingReads.set(key,request)
  try{return await request}finally{if(pendingReads.get(key)===request)pendingReads.delete(key)}
}
// Preserve canonical ids and option indexes; flags are replaced only in the view.
function withoutFlags(value){
  if(typeof value==='string')return value.replace(/\p{Regional_Indicator}{2}|\u{1F3F3}\uFE0F?|\u{1F3F4}|\u{1F6A9}/gu,'📍').replace(/[\w.+%\-]+@[\w.\-]+\.[a-z]{2,}/gi,'[contacto oculto]')
  if(Array.isArray(value))return value.map(withoutFlags)
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,withoutFlags(v)]))
  return value
}
export function szSettings() {
  const defaults={sonidos:true,vibracion:true,menosAnimaciones:false,apariencia:'auto'}
  try{return {...defaults,...JSON.parse(localStorage.getItem('suizamente:ajustes')||'{}')}}catch{return defaults}
}
export const cantonNames={
  ZH:'Zúrich',BE:'Berna',LU:'Lucerna',UR:'Uri',SZ:'Schwyz',OW:'Obwalden',NW:'Nidwalden',GL:'Glaris',ZG:'Zug',FR:'Friburgo',SO:'Soleura',BS:'Basilea-Ciudad',BL:'Basilea-Campiña',SH:'Schaffhausen',AR:'Appenzell Rodas Exteriores',AI:'Appenzell Rodas Interiores',SG:'San Galo',GR:'Grisones',AG:'Argovia',TG:'Turgovia',TI:'Tesino',VD:'Vaud',VS:'Valais',NE:'Neuchâtel',GE:'Ginebra',JU:'Jura',
}
export const countryNames={AR:'Argentina',BO:'Bolivia',CL:'Chile',CO:'Colombia',CR:'Costa Rica',CU:'Cuba',DO:'República Dominicana',EC:'Ecuador',SV:'El Salvador',GQ:'Guinea Ecuatorial',ES:'España',GT:'Guatemala',HN:'Honduras',MX:'México',NI:'Nicaragua',PA:'Panamá',PY:'Paraguay',PE:'Perú',PR:'Puerto Rico',UY:'Uruguay',VE:'Venezuela',CH:'Suiza, nací aquí',otro:'Otro país'}
export function timeLeft(when,now=Date.now()) {
  const hours=Math.max(0,Math.ceil((Date.parse(when)-now)/3600000))
  return hours>=24?Math.floor(hours/24)+' d '+hours%24+' h':hours+' h'
}
