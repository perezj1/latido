import {readFile} from 'node:fs/promises'
import {fixture,alice,bob,token} from './social-db.mjs'
import {createSuizamenteConquistaGateway} from '../../../supabase/functions/_shared/suizamenteConquistaGateway.js'
export {alice,bob,token}
export async function conquistaFixture({publicOnly=process.env.SUIZAMENTE_PUBLIC_TEST_BANK==='1'}={}){
 const f=await fixture()
 let sql
 try{if(publicOnly)throw Object.assign(new Error('Use the public test bank'),{code:'ENOENT'});sql=await readFile(new URL('../../../supabase/suizamente_conquista_instalar.sql',import.meta.url),'utf8')}
 catch(error){
  if(error.code!=='ENOENT')throw error
  sql=await readFile(new URL('../../../supabase/suizamente_conquista_estructura.sql',import.meta.url),'utf8')
  // Test-only arithmetic questions; no production answer key in the repository.
  const codes='ZH BE LU UR SZ OW NW GL ZG FR SO BS BL SH AR AI SG GR AG TG TI VD VS NE GE JU'.split(' ')
  const rows=codes.flatMap(code=>Array.from({length:50},(_,i)=>`('test-${code}-${i}', '${code}','prueba','En ${code}, pregunta de prueba ${i+1}: ¿cuánto es ${i+1} + 1?', '["${i+2}","${i+3}","${i+4}","${i+5}"]'::jsonb,0,'Prueba aislada de validación del servidor.','https://example.test/conquista','2026-11-22')`))
  sql+='\nINSERT INTO suizamente_conquista.preguntas(id,canton,tema,pregunta,opciones,correcta,explicacion,fuente,revisada) VALUES '+rows.join(',')+' ON CONFLICT(id) DO NOTHING;'
 }
 await f.db.exec(sql)
 for(const id of [alice,bob]){
  await f.client.rpc('suizamente_social_api',{p_accion:'bootstrap',p_jugador:'user:'+id,p_datos:{},p_direccion:'fixture'})
  await f.db.query("INSERT INTO suizamente_social.puntos(jugador,motivo,ref,cantidad) VALUES($1,'test','conquista',5000)",['user:'+id])
 }
 const api=createSuizamenteConquistaGateway({getClient:()=>f.client,getSecret:()=> 'fixture-secret',questions:new Map(f.questions.map(q=>[q.id,q.opciones.length]))})
 const call=(action,data={},id=alice)=>f.db.query('SELECT public.suizamente_conquista_api($1::uuid,$2,$3::jsonb) r',[id,action,JSON.stringify(data)]).then(r=>r.rows[0].r)
 const mutate=(action,data={},id=alice)=>call(action,{solicitud:crypto.randomUUID(),...data},id)
 const reset=()=>f.db.exec('DELETE FROM suizamente_conquista.limites')
 return {...f,api,call,mutate,reset,sql}
}
