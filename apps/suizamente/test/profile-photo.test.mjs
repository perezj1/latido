import test from 'node:test'
import assert from 'node:assert/strict'
import {fixture,alice,bob,token} from './social-db.mjs'

test('photo uploads stay in the authenticated Suizamente account and persist without changing Latido',async()=>{
 const f=await fixture()
 const request=(body,authorization='Bearer '+token(alice))=>f.social({method:'PUT',url:'https://example.test/functions/v1/suizamente-social/photo',headers:{authorization},body})
 const jpeg=Buffer.alloc(128);jpeg[0]=255;jpeg[1]=216;jpeg[126]=255;jpeg[127]=217
 const image='data:image/jpeg;base64,'+jpeg.toString('base64')
 try{
  assert.equal((await request({image},'Bearer invalid')).status,401)
  assert.equal((await f.social({method:'PUT',url:'https://example.test/functions/v1/suizamente-social/photo',headers:{'x-jugador-id':'33333333-3333-4333-8333-333333333333'},body:{image}})).status,401)
  assert.equal((await request({image:'x'.repeat(250000)})).status,400)
  assert.equal((await request({image:'data:image/svg+xml;base64,PHN2Zy8+'})).status,400)
  assert.equal((await request({image:'data:image/jpeg;base64,YmFk'})).status,400)
  assert.equal(f.uploads.size,0)
  const uploaded=await request({image,userId:bob})
  assert.equal(uploaded.status,200)
  assert.ok(uploaded.body.perfil.avatarUrl.includes('/avatars/'+alice+'/suizamente/'))
  const photos=await f.client.rpc('suizamente_social_fotos',{p_usuarios:[alice,bob]})
  assert.deepEqual(photos.data,[{id:alice,url:uploaded.body.perfil.avatarUrl}])
  assert.deepEqual([...f.uploads.values()][0],new Uint8Array(jpeg))
  assert.equal((await f.db.query('SELECT avatar_url FROM public.profiles WHERE id=$1',[alice])).rows[0].avatar_url,'https://avatars.example.test/latido-alice.svg')
  assert.equal((await f.db.query("SELECT has_function_privilege('authenticated','public.suizamente_social_foto_guardar(uuid,text)','EXECUTE') allowed")).rows[0].allowed,false)
  const previous=uploaded.body.perfil.avatarUrl
  const rpc=f.client.rpc
  f.client.rpc=(name,args)=>name==='suizamente_social_foto_guardar'?{error:{message:'offline'}}:rpc(name,args)
  assert.equal((await request({image})).status,503)
  assert.equal(f.uploads.size,1,'Failed metadata save cleans up the new object')
  assert.equal((await rpc('suizamente_social_fotos',{p_usuarios:[alice]})).data[0].url,previous)
 }finally{await f.db.close()}
})
