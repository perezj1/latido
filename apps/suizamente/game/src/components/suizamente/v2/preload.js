import {szApi,peekSzData} from '../../../lib/suizamenteV2'

// Share imports with React.lazy. No administration, 3D engine or private questions
// are downloaded speculatively; data warming is limited to read-only tab summaries.
const loaders={Home:()=>import('./Home'),Onboarding:()=>import('./Onboarding'),Game:()=>import('./Game'),Economy:()=>import('./Economy'),Rewards:()=>import('./Rewards'),MapPage3D:()=>import('./MapPage3D'),Raid:()=>import('./Raid'),Community:()=>import('./Community'),Admin:()=>import('./Admin'),VictoryAttack:()=>import('./VictoryAttack')},modules=new Map()
export function loadScreen(group){
 if(!modules.has(group))modules.set(group,loaders[group]().catch(error=>{modules.delete(group);throw error}))
 return modules.get(group)
}
const destinations={album:['Rewards','album'],tienda:['Economy','tienda'],amigos:['Community','amigos'],perfil:['Economy','perfil'],mapa:['MapPage3D','mapa'],nueva:[null,'nueva']}
export function warmDestination(path,{data=true}={}){
 if(typeof path!=='string')return
 const name=path.replace(/^\/suizamente\/?/,'').split(/[/?#]/)[0],target=destinations[name]
 if(!target||document.hidden)return
 if(target[0])loadScreen(target[0]).catch(()=>{})
 if(data)szApi(target[1]).catch(()=>{})
}
export function warmNavigationCode(){
 if(navigator.connection?.saveData||/^(slow-)?2g$/.test(navigator.connection?.effectiveType||''))return()=>{}
 let cancelled=false,timer,idle,index=0,running=0,scheduled=false
 const groups=['Game','Rewards','Economy','Community','MapPage3D']
 const schedule=()=>{if(cancelled||scheduled||index===groups.length||document.hidden)return;scheduled=true;if(window.requestIdleCallback)idle=window.requestIdleCallback(next,{timeout:1000});else timer=setTimeout(next,50)}
 const next=()=>{scheduled=false;if(cancelled||document.hidden)return;while(running<2&&index<groups.length){running++;loadScreen(groups[index++]).catch(()=>{}).finally(()=>{running--;schedule()})}}
 schedule()
 document.addEventListener('visibilitychange',schedule)
 return()=>{cancelled=true;clearTimeout(timer);if(idle!==undefined)window.cancelIdleCallback?.(idle);document.removeEventListener('visibilitychange',schedule)}
}

// Once per signed-in app entry. Two low-priority reads at most; no questions,
// matches, rewards, administration or WebGL contexts are opened speculatively.
export function warmNavigationData(owner,pathname){
 if(!owner||navigator.connection?.saveData||/^(slow-)?2g$/.test(navigator.connection?.effectiveType||''))return()=>{}
 const current=pathname.replace(/^\/suizamente\/?/,'').split(/[/?#]/)[0],skip=destinations[current]?.[1]
 const queue=['album','tienda','nueva'].filter(path=>path!==skip&&!peekSzData(path,owner))
 let cancelled=false,idle,timer,running=0
 const work=()=>{
  if(cancelled||document.hidden)return
  while(running<2&&queue.length){const path=queue.shift();running++;szApi(path,{priority:'low'}).catch(()=>{}).finally(()=>{running--;if(!cancelled)timer=setTimeout(work,50)})}
 }
 if(window.requestIdleCallback)idle=window.requestIdleCallback(work,{timeout:1000});else timer=setTimeout(work,0)
 document.addEventListener('visibilitychange',work)
 return()=>{cancelled=true;clearTimeout(timer);if(idle!==undefined)window.cancelIdleCallback?.(idle);document.removeEventListener('visibilitychange',work)}
}

export function warmLink(event){
 const link=event.target.closest?.('a[href]');if(!link)return
 const url=new URL(link.href,location.origin)
 if(url.origin===location.origin&&url.pathname!==location.pathname)warmDestination(url.pathname)
}
