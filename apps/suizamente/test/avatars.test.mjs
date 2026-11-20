import test from 'node:test'
import assert from 'node:assert/strict'
import {enrichSuizamenteAvatars} from '../../../supabase/functions/_shared/suizamenteAvatars.js'
import {avatar} from '../../../public/suizamente/experiencia-datos.js'

test('uses the Latido photo first and account image next; returns only public avatar URLs',async()=>{
 const first='11111111-1111-4111-8111-111111111111',second='22222222-2222-4222-8222-222222222222'
 let lookups=0
 const client={from:table=>{assert.equal(table,'profiles');return {select:fields=>{assert.equal(fields,'id,avatar_url');return {in:async()=>({data:[{id:first,avatar_url:'https://photos.example.test/latido.jpg'}]})}}}},auth:{admin:{getUserById:async()=>{lookups++;return {data:{user:{email:'private@example.test',user_metadata:{picture:'https://photos.example.test/suizamente.jpg',private:'never expose'}}}}}}}}
 const data={personas:[{id:'user:'+first,apodo:'Latido'},{id:'user:'+second,apodo:'Suizamente'},{id:'anon:33333333-3333-4333-8333-333333333333',apodo:'Invitado'}]}
 await enrichSuizamenteAvatars(data,client,{id:first,user_metadata:{picture:'https://photos.example.test/older.jpg'}})
 assert.equal(data.personas[0].avatarUrl,'https://photos.example.test/latido.jpg')
 assert.equal(data.personas[1].avatarUrl,'https://photos.example.test/suizamente.jpg')
 assert.equal(data.personas[2].avatarUrl,undefined)
 assert.doesNotMatch(JSON.stringify(data),/private@example|never expose|user_metadata/)
 await enrichSuizamenteAvatars(data,client);assert.equal(lookups,1)
})
test('avatar markup preserves the initial and rejects unsafe image URLs',()=>{
 for(const src of ['javascript:alert(1)','data:image/svg+xml,test','https://name:password@example.test/a.jpg'])assert.doesNotMatch(avatar({apodo:'Ana',avatarUrl:src}),/<img/)
 const markup=avatar({apodo:'Ana',avatarUrl:'https://photos.example.test/a.jpg',color:'azul'})
 assert.match(markup,/>A<img/);assert.match(markup,/referrerpolicy="no-referrer"/)
 assert.doesNotMatch(avatar({apodo:'Invitado'}),/<img/)
})
