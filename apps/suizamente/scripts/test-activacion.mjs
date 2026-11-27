import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import {negociosDatabase} from './lib/negocios-test-db.mjs'
const path='server/suizamente/data/juego.json',actual=JSON.parse(await readFile(path,'utf8')),old=JSON.parse(execFileSync('git',['show','fe6a5aa:apps/suizamente/'+path],{encoding:'utf8'}))
for(const key of ['minuto','espejo','misterio','decorar','unToque'])old.mejoras[key].activo=true
old.negocios.activo=true;old.negocios.cobroAutomatico=false;old.mapa.barraCanton=false
assert.deepEqual(actual,old,'Only the requested switches change in the game data')
const {db}=await negociosDatabase(false)
try{
 await db.exec(await readFile('supabase/suizamente_v37_negocios_cobros.sql','utf8'))
 const fingerprint="SELECT p.oid::regprocedure::text name,pg_get_functiondef(p.oid) definition,p.proacl::text acl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','suizamente_private') ORDER BY name"
 const before=(await db.query(fingerprint)).rows,sql=await readFile('supabase/suizamente_v38_activar_mejoras.sql','utf8')
 await db.exec(sql);await db.exec(sql)
 const config=(await db.query('SELECT mejoras FROM suizamente_private.mejoras_configuracion')).rows[0].mejoras,business=(await db.query('SELECT config FROM suizamente_private.negocios_configuracion')).rows[0].config
 assert.deepEqual(config,actual.mejoras);assert.deepEqual(business,actual.negocios)
 assert.deepEqual((await db.query(fingerprint)).rows,before,'Activation never rewrites functions or permissions')
 assert.equal((await db.query('SELECT count(*)::int n FROM suizamente_private.misterios')).rows[0].n,0)
 assert.equal((await db.query('SELECT count(*)::int n FROM suizamente_private.negocios')).rows[0].n,0)
 for(const key of ['minuto','espejo','misterio','decorar','unToque'])await db.query('UPDATE suizamente_private.mejoras_configuracion SET mejoras=jsonb_set(mejoras,$1::text[],\'false\')',[[key,'activo']])
 await db.exec("UPDATE suizamente_private.negocios_configuracion SET config=jsonb_set(config,'{activo}','false')")
 const disabled=(await db.query('SELECT mejoras FROM suizamente_private.mejoras_configuracion')).rows[0].mejoras;assert.ok(['minuto','espejo','misterio','decorar','unToque'].every(k=>disabled[k].activo===false))
 console.log('PASS activation: exact requested flags; no other values/functions/content change; repeatable migration and switches remain reversible; automatic billing stays off')
}finally{await db.close()}
