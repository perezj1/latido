import assert from 'node:assert/strict'
import {installLatidoSsoBridge} from '../src/lib/suizamenteSsoBridge.js'

let listener
const sent=[],parent={postMessage:(message,origin)=>sent.push({message,origin})}
const target={parent,opener:null,addEventListener:(_type,fn)=>{listener=fn},removeEventListener:()=>{listener=null}}
const nonce='11111111-1111-4111-8111-111111111111'
const dispose=installLatidoSsoBridge({target,getSession:async()=>({data:{session:{access_token:'fixture-access',refresh_token:'must-never-leave-Latido',user:{id:'account-id'}}}})})
for(const event of [
  {origin:'https://evil.test',source:parent,data:{type:'suizamente:sso-request',nonce}},
  {origin:'https://suizamente.latido.ch',source:{},data:{type:'suizamente:sso-request',nonce}},
  {origin:'https://suizamente.latido.ch',source:parent,data:{type:'suizamente:sso-request',nonce:'invalid'}},
])await listener(event)
assert.equal(sent.length,0)
await listener({origin:'https://suizamente.latido.ch',source:parent,data:{type:'suizamente:sso-request',nonce}})
assert.deepEqual(sent,[{origin:'https://suizamente.latido.ch',message:{type:'suizamente:sso-session',nonce,accessToken:'fixture-access',userId:'account-id'}}])
assert.equal(JSON.stringify(sent).includes('must-never-leave-Latido'),false)
dispose();assert.equal(listener,null)
let release
const late=installLatidoSsoBridge({target,getSession:()=>new Promise(resolve=>{release=resolve})})
const pending=listener({origin:'https://suizamente.latido.ch',source:parent,data:{type:'suizamente:sso-request',nonce}})
late();release({data:{session:{access_token:'late-access',user:{id:'account'}}}});await pending
assert.equal(sent.length,1)
console.log('PASS: exact trusted origin, source window and nonce, no refresh token transfer, no late replies after disposal.')
