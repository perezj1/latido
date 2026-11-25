import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import vm from 'node:vm'
const listeners={},shown=[],opened=[],navigated=[],focused=[],origin='https://suizamente.latido.ch',id='11111111-1111-4111-8111-111111111111',path='/suizamente/partida/'+id
let windows=[]
const self={location:{origin},registration:{showNotification:async(title,options)=>shown.push({title,options})},clients:{matchAll:async()=>windows,openWindow:async url=>opened.push(url)},addEventListener:(key,fn)=>listeners[key]=fn}
vm.runInNewContext(await readFile('public/sw.js','utf8'),{self,URL})
let pending
listeners.push({data:{json:()=>({title:'¡Te toca!',url:'https://www.latido.ch'+path})},waitUntil:p=>pending=p});await pending;assert.equal(shown[0].options.data.url,origin+path)
let closed=0;const click=async()=>{listeners.notificationclick({notification:{data:shown[0].options.data,close:()=>closed++},waitUntil:p=>pending=p});await pending}
await click();assert.deepEqual(opened,[origin+path])
windows=[{url:origin+'/suizamente/mapa',navigate:async url=>{navigated.push(url)},focus:async()=>focused.push(true)}];await click();assert.deepEqual(navigated,[origin+path]);assert.equal(focused.length,1)
listeners.push({data:{json:()=>({data:{href:path}})},waitUntil:p=>pending=p});await pending;assert.equal(shown.at(-1).options.data.url,origin+path);assert.equal(closed,2)
console.log('Push: closed app opens the exact match; open app navigates and focuses it; Latido URLs and href payloads normalize to Suizamente.')
