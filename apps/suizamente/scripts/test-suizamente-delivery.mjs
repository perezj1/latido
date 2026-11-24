import assert from 'node:assert/strict'
import {readFile,readdir,stat} from 'node:fs/promises'
import vm from 'node:vm'
const source=await readFile('dist/sw.js','utf8'),listeners={},stores=new Map(),downloads=[]
let network=true,fetches=0
const key=value=>typeof value==='string'?value:value.url
const caches={async keys(){return [...stores.keys()]},async delete(name){return stores.delete(name)},async open(name){if(!stores.has(name))stores.set(name,new Map());const values=stores.get(name);return {async addAll(files){downloads.push(...files);for(const file of files)values.set(file,new Response(file))},async match(request){return values.get(key(request))?.clone()},async put(request,response){values.set(key(request),response)}}},async match(request){for(const values of stores.values())if(values.has(key(request)))return values.get(key(request)).clone()}}
const self={location:{origin:'https://suizamente.test'},clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(name,fn)=>{listeners[name]=fn}}
vm.runInNewContext(source,{self,caches,URL,fetch:async request=>{fetches++;if(!network)throw Error('offline');return new Response(key(request))}})
let pending=[];listeners.install({waitUntil:p=>pending.push(p)});await Promise.all(pending)
assert.ok(!downloads.some(file=>/\/(Admin|Community|Game|Economy|Rewards|world3d)-/.test(file)),'Installation does not download unopened routes or 3D')
assert.ok(downloads.some(file=>file.endsWith('.js')))
const fetchEvent=async path=>{pending=[];let response;listeners.fetch({request:{method:'GET',url:'https://suizamente.test'+path,mode:'cors'},respondWith:p=>{response=p},waitUntil:p=>pending.push(p)});const result=await response;await Promise.all(pending);return result}
assert.equal(await fetchEvent('/api/suizamente/jugador'),undefined,'Personal API responses never enter service worker caches')
assert.equal(await fetchEvent('/auth/callback'),undefined)
await fetchEvent('/assets/Admin-example.js');const count=fetches;network=false;assert.equal((await fetchEvent('/assets/Admin-example.js')).status,200);assert.equal(fetches,count,'A previously opened route works from its runtime cache')
const files=await readdir('dist/assets'),app=files.find(file=>/^SuizamenteApp-.*\.js$/.test(file)),bytes=(await stat('dist/assets/'+app)).size
assert.ok(bytes<110000,'Main game payload stays below 110 kB after route splitting')
console.log('Delivery: main game '+bytes+' bytes; minimal precache, on-demand route caching, no API/auth caching passed.')
