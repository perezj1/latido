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

test('an older device session picks up completed onboarding from the verified account',async()=>{
  let current={access_token:'own-access',refresh_token:'own-refresh',user:{id:'account',user_metadata:{name:'Nombre Latido'}}}
  const verified={...current.user,user_metadata:{name:'Nombre Latido',suizamente_onboarding_completed:true}}
  let stored=0
  const client={auth:{getSession:async()=>({data:{session:current}}),getUser:async()=>({data:{user:verified}}),setSession:async tokens=>{assert.deepEqual(tokens,{access_token:'own-access',refresh_token:'own-refresh'});stored++;current={...current,user:verified};return {data:{session:current}}}}}
  const result=await prepareSuizamenteAccount({client,storage:{getItem:()=>null},now})
  assert.equal(result.user.user_metadata.suizamente_onboarding_completed,true)
  assert.equal(stored,1)
})
