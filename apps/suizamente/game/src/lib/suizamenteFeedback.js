import {crearSonido} from './suizamenteSonido.js'
export const SV_FEEDBACK='suizamente:feedback'
export const feedback=(kind,options)=>window.dispatchEvent(new window.CustomEvent(SV_FEEDBACK,{detail:options?{kind,...options}:kind}))

// One policy beside the router. Questions and their answers share the same flag.
export function backgroundMusicFor({pathname,onboarding=false,opening=false,question=false}){
 return !onboarding&&!opening&&!question&&!/^\/suizamente\/(primera-vez|pregunta|pregunta-del-dia|admin)(\/|$)/.test(pathname)
}

export function createFeedback(getSettings,host=globalThis,getOwner=()=>null){
 const engine=crearSonido({ajustes:getSettings,host}),memory=new Set()
 let unlocked=false,disposed=false
 const hidden=()=>host.document?.hidden||host.document?.visibilityState==='hidden'
 function receipt(key,scope){
  const owner=getOwner()||'invitado',id=scope+'|'+owner+'|'+key,storage=scope==='session'?host.sessionStorage:host.localStorage,store='suizamente:sonidos:'+owner
  if(memory.has(id))return false
  try{const saved=JSON.parse(storage?.getItem(store)||'[]');if(saved.includes(key)){memory.add(id);return false}storage?.setItem(store,JSON.stringify([...saved,key]))}catch{/* Presentation-only receipts; audio still works without storage. */}
  memory.add(id);return true
 }
 function play(kind,options={}){
  if(disposed||hidden())return 0
  if(options.key&&!receipt(kind+':'+options.key,options.scope||'local'))return 0
  if(unlocked&&getSettings().vibracion!==false&&['acierto','fallo'].includes(kind))host.navigator?.vibrate?.(kind==='acierto'?20:35)
  return engine.tocar(kind==='sello'||kind==='cofre'?'premio':kind,options)
 }
 return {
  unlock(){if(!disposed){unlocked=true;engine.desbloquear()}},play,
  musica:engine.musica,actualizar:engine.actualizar,
  ocultar(){engine.ocultar();host.navigator?.vibrate?.(0)},mostrar:engine.mostrar,
  get sonando(){return engine.sonando},
  dispose(){disposed=true;engine.destruir()},
 }
}
