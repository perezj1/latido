import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {runInNewContext} from 'node:vm'

const source=await readFile(new URL('../public/sw.js',import.meta.url),'utf8')
async function activate(keys){
 const listeners={},deleted=[],navigated=[]
 const urls=['/ranking?tab=semana','/retos','/jugar?modo=mix','/jugar?duelo=12345678','/perfil/editar','/cuenta','/onboarding','/ajustes','https://other.example/ranking']
 let claimed=false
 runInNewContext(source,{
  URL,Set,
  caches:{keys:async()=>keys,delete:async key=>{deleted.push(key)}},
  self:{location:{origin:'https://suizamente.latido.ch'},addEventListener:(type,callback)=>{listeners[type]=callback},clients:{claim:async()=>{claimed=true},matchAll:async()=>urls.map(path=>{const url=new URL(path,'https://suizamente.latido.ch').href;return {url,navigate:async target=>{navigated.push(target)}}})}},
 })
 await new Promise((resolve,reject)=>listeners.activate({waitUntil:promise=>promise.then(resolve,reject)}))
 return {deleted,navigated,claimed}
}
test('updating a PWA replaces the open ranking and preserves games and unsaved forms',async()=>{
 const result=await activate(['suizamente-public-old','suizamente-public-__BUILD_ID__','another-app-cache'])
 assert.deepEqual(result.deleted,['suizamente-public-old'])
 assert.deepEqual(result.navigated,['https://suizamente.latido.ch/ranking?tab=semana','https://suizamente.latido.ch/retos'])
 assert.equal(result.claimed,true)
})
test('first install and an already current version do not reload windows',async()=>{
 for(const keys of [[],['suizamente-public-__BUILD_ID__']])assert.deepEqual((await activate(keys)).navigated,[])
})
