import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import vm from 'node:vm'

const source=await readFile('public/sw.js','utf8')
function harness(hostname){
  const listeners=new Map(),calls={fetch:0,enable:0,disable:0},origin=`https://${hostname}`
  const cache={match:async key=>key==='/index.html'?new Response('<html>cached production shell</html>',{headers:{'content-type':'text/html'}}):undefined,put:async()=>{},keys:async()=>[]}
  vm.runInNewContext(source,{
    self:{location:{hostname,origin},addEventListener:(name,fn)=>listeners.set(name,fn),clients:{claim:async()=>{}},registration:{navigationPreload:{enable:async()=>calls.enable++,disable:async()=>calls.disable++}}},
    caches:{keys:async()=>[],open:async()=>cache,delete:async()=>true},
    fetch:async()=>{calls.fetch++;throw Error('simulated unavailable network')},URL,Request,Response,Headers,setTimeout,clearTimeout,console,
  })
  return {listeners,calls,origin}
}
for(const host of ['localhost','127.0.0.1','[::1]']){
  const h=harness(host)
  let activated
  h.listeners.get('activate')({waitUntil:p=>{activated=p}})
  await activated
  assert.equal(h.calls.disable,1);assert.equal(h.calls.enable,0)
  for(const suffix of ['/suizamente','/src/main.jsx','/@vite/client']){
    const request=new Request(`${h.origin}${suffix}`)
    if(suffix==='/suizamente')Object.defineProperty(request,'mode',{value:'navigate'})
    let intercepted=false
    h.listeners.get('fetch')({request,respondWith:()=>{intercepted=true}})
    assert.equal(intercepted,false,`${host}${suffix} uses the native browser network`)
  }
  assert.equal(h.calls.fetch,0,'local requests are not re-issued inside the worker')
  assert.ok(h.listeners.has('push'));assert.ok(h.listeners.has('notificationclick'))
}
const prod=harness('www.latido.ch')
let activated
prod.listeners.get('activate')({waitUntil:p=>{activated=p}});await activated
assert.equal(prod.calls.enable,1);assert.equal(prod.calls.disable,0)
const request=new Request(`${prod.origin}/suizamente`)
Object.defineProperty(request,'mode',{value:'navigate'})
let response
prod.listeners.get('fetch')({request,preloadResponse:Promise.resolve(undefined),respondWith:p=>{response=p},waitUntil:()=>{}})
assert.ok(response,'production navigation retains service-worker handling')
assert.match(await(await response).text(),/cached production shell/)
console.log('Local navigation/modules/HMR bypass the worker; local push remains registered; production navigation preload and offline shell remain intact.')
