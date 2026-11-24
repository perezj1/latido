// Supabase management token is supplied by the CLI credential launcher, never logged.
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
const project='zmievixfjefjppofebbh',folder='output/suizamente-final/produccion',action=process.argv[2]||'inspeccionar'
const token=process.env.LATIDO_SUIZAMENTE_MANAGEMENT_TOKEN
if(!token)throw Error('Usa scripts/suizamente-production.ps1 o facilita LATIDO_SUIZAMENTE_MANAGEMENT_TOKEN')
async function query(sql){
 const response=await fetch('https://api.supabase.com/v1/projects/'+project+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({query:sql}),signal:AbortSignal.timeout(120000)})
 const data=await response.json();if(!response.ok)throw Error('Supabase '+response.status+': '+(data.message||'Error al ejecutar SQL'));return data
}
const inspection=`SELECT jsonb_build_object(
 'perfiles',(SELECT count(*) FROM suizamente_private.suizamente_jugadores),
 'partidas',(SELECT count(*) FROM suizamente_private.suizamente_partidas),
 'movimientos',(SELECT count(*) FROM suizamente_private.suizamente_movimientos),
 'versiones',(SELECT jsonb_object_agg(proname,true) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='suizamente_private' AND proname IN('v7_persona','v10_ligas_actualizar','v11_misiones_preparar','v12_tick','v13_rivales','v14_api_base')),
 'admin',to_regclass('suizamente_private.suizamente_admin_registro') IS NOT NULL,
 'tablas',(SELECT jsonb_agg(tablename ORDER BY tablename) FROM pg_tables WHERE schemaname='suizamente_private' AND (tablename LIKE 'suizamente_%' OR tablename='admins'))
) estado`
await mkdir(folder,{recursive:true})
const before=(await query(inspection))[0].estado
console.log('Supabase Latido:',JSON.stringify({...before,tablas:before.tablas.length}))
if(action==='inspeccionar')process.exit(0)
if(action!=='aplicar')throw Error('Acción no válida')
// Backup only the game's tables/functions; never read auth.users or Latido profiles/emails.
const stamp=new Date().toISOString().replaceAll(/[:.]/g,'-'),backup={fecha:new Date().toISOString(),project,estado:before,tablas:{}}
backup.funciones=await query("SELECT n.nspname AS esquema,proname,pg_get_functiondef(p.oid) AS definicion FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='suizamente_private' AND (proname LIKE 'v%')) OR (n.nspname='public' AND proname='suizamente_v2')")
for(const table of before.tablas){if(!/^[a-z0-9_]+$/.test(table))throw Error('Nombre no válido');backup.tablas[table]=await query('SELECT * FROM suizamente_private.'+table)}
const backupPath=folder+'/antes-'+stamp+'.json'
await writeFile(backupPath,JSON.stringify(backup));console.log('Copia local privada guardada:',backupPath)
const phases=[
 ['suizamente_v2_datos.sql',true],
 ['suizamente_v7_comunidad.sql',!before.versiones?.v7_persona],
 ['suizamente_v9_admin.sql',!before.admin],
 ['suizamente_v10_admin_operaciones.sql',!before.versiones?.v10_ligas_actualizar],
 ['suizamente_v11_duracion.sql',!before.versiones?.v11_misiones_preparar],
 ['suizamente_v12_progreso.sql',!before.versiones?.v12_tick],
 ['suizamente_v13_produccion.sql',!before.versiones?.v14_api_base],
 ['suizamente_v14_cuentas.sql',true],
 ['suizamente_v12_tareas.sql',true],
 ['suizamente_v2_avisos.sql',true]
]
const applied=[]
for(const [name,needed] of phases){
 if(!needed)continue
 const sql=await readFile('supabase/'+name,'utf8');await query(sql)
 applied.push({archivo:name,sha256:createHash('sha256').update(sql).digest('hex')});console.log('Aplicado:',name)
}
const after=(await query(inspection))[0].estado
for(const key of ['perfiles','partidas','movimientos'])if(after[key]<before[key])throw Error('Verificar conservación de '+key)
const checks=await query(`SELECT jsonb_build_object(
 'apiVersion',public.suizamente_v2('config')->'apiVersion',
 'privadasExpuestas',EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='suizamente_private' AND tablename LIKE 'suizamente_%' AND (has_table_privilege('anon',quote_ident(schemaname)||'.'||quote_ident(tablename),'SELECT') OR has_table_privilege('authenticated',quote_ident(schemaname)||'.'||quote_ident(tablename),'SELECT') OR NOT rowsecurity)),
 'tareas',(SELECT jsonb_agg(jsonb_build_object('nombre',jobname,'horario',schedule,'activa',active)) FROM cron.job WHERE jobname IN('suizamente-progreso','suizamente-turnos'))
 ) checks`)
const report={fecha:new Date().toISOString(),project,antes:{...before,tablas:before.tablas.length},despues:{...after,tablas:after.tablas.length},applied,checks:checks[0].checks,backup:backupPath}
await writeFile(folder+'/resultado.json',JSON.stringify(report,null,2));console.log('Verificación:',JSON.stringify(report.checks))
if(report.checks.apiVersion!==14||report.checks.privadasExpuestas)throw Error('La comprobación final de producción no pasa')
