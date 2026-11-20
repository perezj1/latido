import assert from 'node:assert/strict'
import test from 'node:test'
import {prepareSuizamenteAccount} from '../src/registration.js'

const now=Date.parse('2026-11-20T12:00:00Z')
function fixture({created=now,metadata={},intent=true}={}){
  let session={user:{id:'account',created_at:new Date(created).toISOString(),app_metadata:{providers:['google']},user_metadata:metadata}}
  const changes=[],values=new Map(intent?[['suizamente:oauth-inicio',String(now-3000)]]:[])
  const storage={getItem:key=>values.get(key),removeItem:key=>values.delete(key)}
  const client={auth:{getSession:async()=>({data:{session}}),updateUser:async({data})=>{changes.push(data);session={user:{...session.user,user_metadata:{...session.user.user_metadata,...data}}};return {data:{user:session.user}}}}}
  return {client,storage,changes,values}
}
test('new Google registration belongs to Suizamente and leaves Latido onboarding pending',async()=>{
  const f=fixture()
  const session=await prepareSuizamenteAccount({...f,now})
  assert.equal(session.user.user_metadata.registro_origen,'suizamente')
  assert.equal(session.user.user_metadata.suizamente_necesita_perfil,true)
  assert.equal(session.user.user_metadata.latido_onboarding_completed,false)
  assert.equal(f.values.size,0)
})
test('using an existing Latido account never changes its origin, name or onboarding',async()=>{
  for(const options of [{created:now-86400000,metadata:{name:'Nombre Latido'}},{metadata:{name:'Nombre Latido',latido_onboarding_completed:true}},{intent:false,metadata:{name:'Nombre Latido'}}]){
    const f=fixture(options)
    const session=await prepareSuizamenteAccount({...f,now})
    assert.equal(session.user.user_metadata.name,'Nombre Latido')
    assert.equal(f.changes.length,0)
  }
})
