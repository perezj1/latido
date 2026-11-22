import test from 'node:test'
import assert from 'node:assert/strict'
import {rememberConquistaRoute,takeConquistaRoute} from '../src/conquistaReturn.js'
test('a Conquista invitation survives login and cannot redirect outside the app',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}
 const path='/conquista/batalla/11111111-1111-4111-8111-111111111111'
 rememberConquistaRoute(storage,path);assert.equal(takeConquistaRoute(storage),path);assert.equal(takeConquistaRoute(storage),'/')
 for(const url of ['https://evil.test','//evil.test','/conquista/../../cuenta','/conquista/batalla/javascript:evil','/conquista\\evil']){rememberConquistaRoute(storage,url);assert.equal(takeConquistaRoute(storage),'/')}
 assert.equal(takeConquistaRoute({getItem:()=>{throw new Error('blocked')}}),'/')
})
