import assert from 'node:assert/strict'
import {createSessionTransport} from '../src/lib/sessionTransport.js'
const jwt=(sub,value)=>'header.'+Buffer.from(JSON.stringify({sub,value})).toString('base64url')+'.signature'
const old=jwt('a','old'),fresh=jwt('a','fresh'),other=jwt('b','other')
let session={access_token:old,user:{id:'a'}},refreshes=0,signouts=0,calls=[]
const transport=createSessionTransport({anonKey:'anon',getSession:async()=>({data:{session}}),refreshSession:async()=>{refreshes++;await new Promise(r=>setTimeout(r,10));session={access_token:fresh,user:{id:'a'}};return {data:{session},error:null}},signOut:async()=>{signouts++;session=null},fetchImpl:async(_input,init)=>{const auth=new Headers(init.headers).get('Authorization');calls.push(auth);return Response.json({}, {status:auth==='Bearer '+old?401:200})}})
const results=await Promise.all(Array.from({length:3},()=>transport.fetch('https://project.supabase.co/rest/v1/rpc/example',{method:'POST',headers:{Authorization:'Bearer '+old},body:'{}'})))
assert.ok(results.every(r=>r.status===200));assert.equal(refreshes,1);assert.equal(calls.length,6);assert.equal(signouts,0)
assert.equal((await transport.recover(old)).access_token,fresh,'Late 401 uses the refreshed token')
assert.equal(refreshes,1)
session={access_token:other,user:{id:'b'}};assert.equal(await transport.recover(old),null,'Never retry an old account request as a different account')
let failures=0
const failed=createSessionTransport({anonKey:'anon',getSession:async()=>({data:{session}}),refreshSession:async()=>{failures++;return {data:{session:null},error:{status:400,code:'refresh_token_not_found'}}},signOut:async()=>{signouts++;session=null},fetchImpl:async()=>Response.json({}, {status:401})})
await failed.fetch('https://project.supabase.co/rest/v1/example',{headers:{Authorization:'Bearer '+other}})
assert.equal(signouts,1);assert.equal(failures,1);assert.equal(session,null)
await failed.fetch('https://project.supabase.co/rest/v1/example',{headers:{Authorization:'Bearer anon'}});assert.equal(failures,1)
await failed.fetch('https://project.supabase.co/auth/v1/token',{headers:{Authorization:'Bearer '+old}});assert.equal(failures,1,'Auth traffic never recurses')
session={access_token:old,user:{id:'a'}}
const offline=createSessionTransport({getSession:async()=>({data:{session}}),refreshSession:async()=>({data:{},error:{status:503}}),signOut:async()=>{signouts++;session=null}})
assert.equal(await offline.recover(old),null);assert.equal(session.access_token,old,'Network trouble does not sign out a valid account')
console.log('Session transport: shared refresh, one retry, account isolation, local invalid-session cleanup, anonymous/auth exclusions and offline preservation passed.')
