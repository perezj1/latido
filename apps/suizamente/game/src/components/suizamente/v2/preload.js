import {szApi} from '../../../lib/suizamenteV2'

// Share imports with React.lazy. No administration, 3D engine or private questions
// are downloaded speculatively; data warming is limited to read-only tab summaries.
const loaders={Home:()=>import('./Home'),Onboarding:()=>import('./Onboarding'),Game:()=>import('./Game'),Economy:()=>import('./Economy'),Rewards:()=>import('./Rewards'),MapPage3D:()=>import('./MapPage3D'),Raid:()=>import('./Raid'),Community:()=>import('./Community'),Admin:()=>import('./Admin'),VictoryAttack:()=>import('./VictoryAttack')},modules=new Map()
export function loadScreen(group){
 if(!modules.has(group))modules.set(group,loaders[group]().catch(error=>{modules.delete(group);throw error}))
 return modules.get(group)
}
const destinations={album:['Rewards','album'],tienda:['Economy','tienda'],amigos:['Community','amigos'],perfil:['Economy','perfil'],mapa:['MapPage3D','mapa'],nueva:[null,'emparejamiento']}
export function warmDestination(path,{data=true}={}){
 if(typeof path!=='string')return
 const name=path.replace(/^\/suizamente\/?/,'').split(/[/?#]/)[0],target=destinations[name]
 if(!target||document.hidden)return
 if(target[0])loadScreen(target[0]).catch(()=>{})
 if(data){szApi(target[1]).catch(()=>{});if(name==='nueva')szApi('partidas').catch(()=>{})}
}
export function warmNavigationCode(){
 if(navigator.connection?.saveData||/^(slow-)?2g$/.test(navigator.connection?.effectiveType||''))return()=>{}
 let cancelled=false,timer,idle,index=0
 const groups=['Game','Rewards','Economy','Community','MapPage3D']
 const schedule=()=>{if(cancelled||index===groups.length||document.hidden)return;if(window.requestIdleCallback)idle=window.requestIdleCallback(next,{timeout:3000});else timer=setTimeout(next,250)}
 const next=()=>{if(cancelled||document.hidden)return;loadScreen(groups[index++]).catch(()=>{}).finally(()=>{timer=setTimeout(schedule,250)})}
 schedule()
 return()=>{cancelled=true;clearTimeout(timer);if(idle!==undefined)window.cancelIdleCallback?.(idle)}
}
