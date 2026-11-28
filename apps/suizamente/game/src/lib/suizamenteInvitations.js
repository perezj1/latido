import {szApi} from './suizamenteV2'
import {supabase} from './supabase'

// Prepared by the server before the share gesture. Never persisted across accounts.
const drafts=new Map()
let activeOwner
supabase.auth.onAuthStateChange((_event,session)=>{const owner=session?.user?.id||null;if(owner!==activeOwner){activeOwner=owner;drafts.clear()}})
const keyFor=(owner,kind)=>owner+'|'+kind
export function peekInvitation(owner,kind='game'){
 if(!owner||activeOwner!==undefined&&activeOwner!==owner)return null
 const entry=drafts.get(keyFor(owner,kind))
 return entry?.data&&entry.expires>Date.now()?entry.data:null
}
export function prepareInvitation(owner,kind='game',days){
 if(!owner||activeOwner!==undefined&&activeOwner!==owner)return Promise.reject(new Error('Entra con tu cuenta para invitar.'))
 if(activeOwner===undefined)activeOwner=owner
 const key=keyFor(owner,kind),ready=peekInvitation(owner,kind),old=drafts.get(key)
 if(ready)return Promise.resolve(ready)
 if(old?.promise&&!old.data)return old.promise
 const entry={data:null,expires:0,promise:null}
 drafts.set(key,entry)
 entry.promise=szApi(kind==='friend'?'amigos/invitaciones':'invitaciones',{method:'POST',silent:true}).then(data=>{
  if(activeOwner!==owner||drafts.get(key)!==entry)throw new Error('La cuenta ha cambiado. Vuelve a abrir la invitación.')
  entry.data=data;entry.expires=Date.now()+Number(days)*86400000;return data
 }).catch(error=>{if(drafts.get(key)===entry)drafts.delete(key);throw error})
 return entry.promise
}
export function discardInvitation(owner,kind='game',enlace){
 const key=keyFor(owner,kind),entry=drafts.get(key)
 if(!enlace||entry?.data?.enlace===enlace)drafts.delete(key)
}
export function warmInvitations(owner,days){
 return Promise.allSettled(['game','friend'].map(kind=>prepareInvitation(owner,kind,days)))
}

export async function copyInvitationText(text){
 if(navigator.clipboard){await navigator.clipboard.writeText(text);return}
 const area=document.createElement('textarea');area.value=text;area.style.cssText='position:fixed;left:-10000px;top:0';document.body.append(area);area.select()
 try{if(!document.execCommand('copy'))throw new Error('Selecciona y copia el enlace de invitación.')}finally{area.remove()}
}
