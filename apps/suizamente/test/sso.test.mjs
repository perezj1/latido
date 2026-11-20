import assert from 'node:assert/strict'
import test from 'node:test'
import { installLatidoSsoBridge } from '../../../src/lib/suizamenteSsoBridge.js'
import { isSuizamentePath } from '../../../src/lib/suizamenteSessionBridge.js'
import { createSuizamenteSocialHttp } from '../../../supabase/functions/_shared/suizamenteSocialHttp.js'
import { connectLatidoAccount } from '../src/latidoSso.js'

test('standalone SSO waits for a trusted ready message and follows the actual redirected origin',async t=>{
 let listener
 const sent=[],frames=[]
 const parentWindow={addEventListener:(_type,fn)=>{listener=fn},removeEventListener:()=>{listener=null}}
 const documentStub={createElement:()=>{const frame={contentWindow:{postMessage:(data,origin)=>sent.push({data,origin})},remove(){this.removed=true}};frames.push(frame);return frame},body:{append(){}}}
 for(const [name,value] of Object.entries({window:parentWindow,document:documentStub,location:{origin:'https://suizamente.latido.ch'}})){
   const previous=Object.getOwnPropertyDescriptor(globalThis,name)
   Object.defineProperty(globalThis,name,{value,configurable:true,writable:true})
   t.after(()=>{if(previous)Object.defineProperty(globalThis,name,previous);else delete globalThis[name]})
 }
 const promise=connectLatidoAccount({client:{},socialApi:'https://api.test',timeout:50})
 assert.equal(sent.length,0,'No message while an iframe is still about:blank or loading')
 await listener({origin:'https://evil.test',source:frames[0].contentWindow,data:{type:'suizamente:sso-ready'}})
 await listener({origin:'https://latido.ch',source:{},data:{type:'suizamente:sso-ready'}})
 assert.equal(sent.length,0)
 await listener({origin:'https://www.latido.ch',source:frames[0].contentWindow,data:{type:'suizamente:sso-ready'}})
 assert.equal(sent.length,1)
 assert.equal(sent[0].origin,'https://www.latido.ch','Use the confirmed origin after a Latido redirect')
 assert.equal(sent[0].data.type,'suizamente:sso-request')
 assert.equal(await promise,null)
 assert.equal(sent.length,1,'No blind polling of windows that can navigate to another origin')
 assert.ok(frames.every(frame=>frame.removed));assert.equal(listener,null)
})

test('Latido connection validates source, exact origin and nonce; never transfers refresh tokens',async()=>{
 let listener,calls=0
 const sent=[],parent={postMessage:(data,origin)=>sent.push({data,origin})}
 const target={parent,opener:null,addEventListener:(_type,fn)=>{listener=fn},removeEventListener:()=>{listener=null}}
 const dispose=installLatidoSsoBridge({target,getSession:async()=>{calls++;return {data:{session:{access_token:'access-only',refresh_token:'private-refresh',user:{id:'user-id'}}}}}})
 const event={origin:'https://suizamente.latido.ch',source:parent,data:{type:'suizamente:sso-request',nonce:'11111111-1111-4111-8111-111111111111'}}
 for(const invalid of [{...event,origin:'https://evil.test'},{...event,source:{}},{...event,data:{...event.data,nonce:'invalid'}}])await listener(invalid)
 assert.equal(calls,0)
 await listener(event)
 assert.equal(sent[0].origin,event.origin)
 assert.equal(sent[0].data.accessToken,'access-only')
 assert.equal(JSON.stringify(sent).includes('private-refresh'),false)
 dispose();assert.equal(listener,null)
})
test('SSO issues an OTP only for the verified account and does not send an email',async()=>{
 let generated=0,rpc=0
 const user={id:'11111111-1111-4111-8111-111111111111',email:'own@example.test',email_confirmed_at:'2026-01-01'}
 const handle=createSuizamenteSocialHttp({getSecret:()=> 'test-secret',getClient:()=>({auth:{getUser:async token=>token==='valid'?{data:{user}}:{error:{code:'bad_token'}},admin:{generateLink:async params=>{generated++;assert.deepEqual(params,{type:'magiclink',email:user.email});return {data:{user,properties:{hashed_token:'one-use-token'}}}}}},rpc:async(name,args)=>{rpc++;assert.equal(name,'suizamente_social_api');assert.equal(args.p_jugador,'user:'+user.id);return {data:{perfil:{}},error:null}}})})
 const request={method:'POST',url:'https://project.supabase.co/functions/v1/suizamente-social/sso',headers:{origin:'https://suizamente.latido.ch',authorization:'Bearer valid'},body:{email:'other@example.test',usuarioId:'other'},address:'test-ip'}
 const result=await handle(request)
 assert.equal(result.status,200);assert.deepEqual(result.body,{tokenHash:'one-use-token',userId:user.id});assert.equal(generated,1);assert.equal(rpc,1)
 assert.equal((await handle({...request,headers:{...request.headers,origin:'https://evil.test'}})).status,403)
 assert.equal((await handle({...request,headers:{...request.headers,authorization:'Bearer invalid'}})).status,401)
 assert.equal(generated,1)
})
test('game routing rejects cross-origin, unexpected and malformed paths',()=>{
 for(const value of ['/','/retos','/perfil/editar','/duelo/ABCDEF12','/jugar?modo=mix'])assert.equal(isSuizamentePath(value),true,value)
 for(const value of ['https://evil.test','//evil.test','/\\evil.test','/auth','/admin-latido','/duelo/invalid','/perfil#token','/\u0000','/duelo/%2F'])assert.equal(isSuizamentePath(value),false,value)
})
