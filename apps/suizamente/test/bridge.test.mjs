import assert from 'node:assert/strict'
import test from 'node:test'
import { connectSuizamenteSession } from '../../../src/lib/suizamenteSessionBridge.js'

function host() {
  let listener
  const sent = []
  const frame = {postMessage:(message,origin) => sent.push({message,origin})}
  const target = {location:{origin:'https://suizamente.latido.ch'},addEventListener:(_name,fn) => {listener=fn},removeEventListener:(_name,fn) => {assert.equal(fn,listener);listener=null}}
  return {frame,target,sent,dispatch:event => listener?.(event),event:{origin:target.location.origin,source:frame,data:{type:'suizamente:identity',requestId:'nonce'}}}
}

test('profile logout is accepted only from the standalone game frame and exact origin',async()=>{
 const h=host();let calls=0
 connectSuizamenteSession({target:h.target,getFrame:()=>h.frame,getSession:async()=>({}),api:'test',standalone:true,onLogout:async()=>{calls++}})
 const event={...h.event,data:{type:'suizamente:logout'}}
 await h.dispatch({...event,origin:'https://www.latido.ch'})
 await h.dispatch({...event,source:{}})
 assert.equal(calls,0)
 await h.dispatch(event);assert.equal(calls,1)
 const integrated=host()
 connectSuizamenteSession({target:integrated.target,getFrame:()=>integrated.frame,getSession:async()=>({}),api:'test',onLogout:()=>{calls++}})
 await integrated.dispatch({...integrated.event,data:{type:'suizamente:logout'}})
 assert.equal(calls,1,'An embedded game cannot close the parent Latido session')
})
test('hands current sessions only to the exact same-origin game window', async () => {
  const h=host()
  let calls=0, token='first'
  const dispose=connectSuizamenteSession({target:h.target,getFrame:()=>h.frame,getSession:async()=>{calls++;return {data:{session:{access_token:token,user:{id:'user-1'}}}}},api:'https://project.supabase.co/functions/v1/suizamente-votos',standalone:true})
  for (const event of [{...h.event,origin:'https://www.latido.ch'},{...h.event,source:{}},{...h.event,data:{type:'other'}},{...h.event,data:{type:'suizamente:identity',requestId:'x'.repeat(101)}}]) await h.dispatch(event)
  assert.equal(calls,0)
  await h.dispatch(h.event)
  token='refreshed'
  await h.dispatch(h.event)
  assert.equal(h.sent[0].message.token,'first')
  assert.equal(h.sent[1].message.token,'refreshed')
  assert.equal(h.sent[1].message.app,'standalone')
  assert.equal(h.sent[1].origin,h.target.location.origin)
  dispose()
  await h.dispatch(h.event)
  assert.equal(calls,2)
})
test('does not leak a late session to a detached frame and keeps the Latido response compatible', async () => {
  const h=host()
  let frame=h.frame, resolve
  connectSuizamenteSession({target:h.target,getFrame:()=>frame,getSession:()=>new Promise(done=>{resolve=done}),api:'/api/suizamente'})
  const pending=h.dispatch(h.event)
  frame=null
  resolve({data:{session:{access_token:'private',user:{id:'user-1'}}}})
  await pending
  assert.equal(h.sent.length,0)
  const guest=host()
  connectSuizamenteSession({target:guest.target,getFrame:()=>guest.frame,getSession:async()=>{throw new Error('offline')},api:'/api/suizamente'})
  await guest.dispatch(guest.event)
  assert.deepEqual(guest.sent[0].message,{type:'suizamente:session',requestId:'nonce',token:null,userId:null,api:'/api/suizamente'})
})
