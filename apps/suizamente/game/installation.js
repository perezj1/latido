// Keep the browser's single-use install event before the lazy game UI mounts.
const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true
let state={prompt:null,busy:false,installed:standalone()}
const listeners=new Set()
const update=next=>{state={...state,...next};listeners.forEach(listener=>listener())}
export const installationSnapshot=()=>state
export function subscribeInstallation(listener){listeners.add(listener);return()=>listeners.delete(listener)}
window.addEventListener('beforeinstallprompt',event=>{
 event.preventDefault()
 if(!standalone())update({prompt:event,installed:false})
})
window.addEventListener('appinstalled',()=>update({prompt:null,busy:false,installed:true}))
window.matchMedia('(display-mode: standalone)').addEventListener('change',()=>{if(standalone())update({prompt:null,busy:false,installed:true})})

// Call synchronously from the click: Android requires the original user gesture.
export async function requestInstallation(){
 if(state.installed||standalone())return 'installed'
 if(state.busy)return 'busy'
 const event=state.prompt
 if(!event)return 'unavailable'
 update({prompt:null,busy:true})
 try{
  const prompted=await event.prompt()
  const choice=event.userChoice?await event.userChoice:prompted
  // Acceptance starts installation; only appinstalled confirms its completion.
  return state.installed?'installed':choice?.outcome==='accepted'?'accepted':'dismissed'
 }catch{return 'unavailable'}finally{update({busy:false})}
}
