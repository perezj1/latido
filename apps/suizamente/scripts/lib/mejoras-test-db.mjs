import {readFile} from 'node:fs/promises'
import {database} from './suizamente-v2-test-db.mjs'
import assert from 'node:assert/strict'
import {resolverHuecos} from '../../server/suizamente/huecos.mjs'
export const migrations=['27_mejoras_base','28_minuto','29_espejo','30_misterio','31_decorar','32_un_toque']
export async function mejorasDatabase(flags=false){
 const db=await database({emparejamiento:true})
 try{
  const fingerprint="SELECT p.oid::regprocedure::text name,pg_get_functiondef(p.oid) definition,p.proacl::text acl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','suizamente_private') AND p.proname NOT LIKE 'mej_%' AND p.proname NOT LIKE 'suizamente_mejoras%' ORDER BY name"
  const before=(await db.query(fingerprint)).rows
  for(const name of migrations)await db.exec(await readFile('supabase/suizamente_v'+name+'.sql','utf8'))
  const seed=await readFile('supabase/suizamente_v33_mejoras_datos.sql','utf8');await db.exec(seed);await db.exec(seed)
  const seeded=(await db.query('SELECT mejoras FROM suizamente_private.mejoras_configuracion')).rows[0].mejoras
  for(const key of ['minuto','espejo','misterio','decorar','unToque'])assert.equal(seeded[key].activo,false,'Release seed defaults off even when applied twice')
  assert.deepEqual((await db.query(fingerprint)).rows,before,'Initial additive migration preserves every legacy function and its ACL')
  const juego=JSON.parse(await readFile('server/suizamente/data/juego.json','utf8')),config=juego.mejoras
  for(const [key,value] of Object.entries(config))if(value&&typeof value==='object')value.activo=flags===true||!!flags?.[key]
  const decoraciones=resolverHuecos(JSON.parse(await readFile('server/suizamente/data/decoraciones.json','utf8')))
  await db.query('UPDATE suizamente_private.mejoras_configuracion SET mejoras=$1::jsonb,decoraciones=$2::jsonb',[JSON.stringify(config),JSON.stringify(decoraciones)])
  return {db,config}
 }catch(e){await db.close();throw e}
}
export async function mejoraCall(db,actor,action,args={}){
 return db.transaction(async tx=>{await tx.query("SELECT set_config('test.uid',$1,true)",[actor||'']);await tx.exec('SET LOCAL ROLE '+(actor?'authenticated':'anon'));return (await tx.query('SELECT public.suizamente_mejoras($1,$2::jsonb) result',[action,JSON.stringify(args)])).rows[0].result})
}
