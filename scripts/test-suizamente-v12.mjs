import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {database,call,A,B} from './lib/suizamente-v2-test-db.mjs'
import {weeklyFixture} from './lib/suizamente-week-fixture.mjs'
let db
try{
 db=await database({progreso:true})
 for(const [id,name] of [[A,'Alex'],[B,'Lu']])await db.query('INSERT INTO suizamente_private.suizamente_jugadores(jugador_id,usuario_id,apodo) VALUES($1::text,$1::uuid,$2)',[id,name])
 const tick=async t=>(await db.query('SELECT suizamente_private.v12_tick($1::timestamptz) result',[t])).rows[0].result
 for(const [before,after,day] of [
  ['2026-03-28T22:59:59Z','2026-03-28T23:00:00Z','2026-03-29'],
  ['2026-03-29T21:59:59Z','2026-03-29T22:00:00Z','2026-03-30'],
  ['2026-10-24T21:59:59Z','2026-10-24T22:00:00Z','2026-10-25'],
  ['2026-10-25T22:59:59Z','2026-10-25T23:00:00Z','2026-10-26']]){
  await tick(before);assert.equal((await tick(after)).fecha,day)
  const missions=(await db.query('SELECT * FROM suizamente_private.suizamente_misiones WHERE fecha=$1 AND jugador_id=$2 ORDER BY dificultad',[day,A])).rows
  assert.equal(missions.length,3);assert.equal(new Set(missions.map(m=>m.tipo)).size,3)
  assert.equal((await tick(after)).perfilesPreparados,0)
  assert.deepEqual((await db.query('SELECT * FROM suizamente_private.suizamente_misiones WHERE fecha=$1 AND jugador_id=$2 ORDER BY dificultad',[day,A])).rows,missions)
 }
 // Reinstalling preserves the table, rows, permissions and dispatcher.
 await db.exec(await readFile('supabase/suizamente_v12_progreso.sql','utf8'))
 assert.equal((await db.query("SELECT relkind FROM pg_class WHERE oid='suizamente_private.suizamente_ligas'::regclass")).rows[0].relkind,'r')
 const week='2026-11-23',{config,rows}=await weeklyFixture(db,week)
 const groups=Object.values(Object.groupBy(rows,r=>r.division+':'+r.grupo))
 assert.deepEqual(groups.map(g=>g.length).sort((a,b)=>a-b),[7,30,30,30,30])
 for(const group of groups){
  const i=config.ligas.divisiones.findIndex(d=>d.id===group[0].division)
  assert.equal(group.filter(r=>r.destino===config.ligas.divisiones[i+1]?.id).length,i===3?0:config.ligas.suben)
  assert.equal(group.filter(r=>r.destino===config.ligas.divisiones[i-1]?.id).length,i===0?0:Math.min(config.ligas.bajan,Math.max(0,group.length-config.ligas.suben)))
 }
 assert.equal(rows.find(r=>r.puesto===1).puntos,config.ligas.puntos.partidaGanada+(config.ligas.tamanoGrupo-1)*config.ligas.puntos.selloGanado)
 await tick('2026-11-29T22:59:59Z') // Still Sunday 23:59:59 in Zurich.
 assert.equal((await db.query('SELECT cerrada FROM suizamente_private.suizamente_liga_semanas WHERE semana=$1',[week])).rows[0].cerrada,false)
 // A failed scheduler transaction rolls back every receipt and every promotion.
 await assert.rejects(db.transaction(async tx=>{await tx.query('SELECT suizamente_private.v12_tick($1::timestamptz)',['2026-11-29T23:00:00Z']);throw Error('interrupted job')}),/interrupted job/)
 assert.equal(Number((await db.query("SELECT count(*) n FROM suizamente_private.suizamente_movimientos WHERE motivo='liga' AND ref=$1",[week])).rows[0].n),0)
 await tick('2026-11-29T23:00:00Z')
 assert.equal((await db.query('SELECT cerrada FROM suizamente_private.suizamente_liga_semanas WHERE semana=$1',[week])).rows[0].cerrada,true)
 const receipts=(await db.query("SELECT jugador_id,monedas,inventario FROM suizamente_private.suizamente_movimientos WHERE motivo='liga' AND ref=$1 ORDER BY jugador_id",[week])).rows
 for(const r of rows){
  const award=receipts.find(a=>a.jugador_id===r.id),division=config.ligas.divisiones.find(d=>d.id===r.division),prize=config.ligas.premiosDomingo.find(p=>r.puesto>=p.desde&&r.puesto<=p.hasta)
  if(r.puesto===config.ligas.tamanoGrupo)assert.equal(award,undefined,'No activity, no prize')
  else{assert.equal(award.monedas,Math.round(prize.monedas*division.multiplicadorPremio));assert.equal(award.inventario.sobres,Math.round(prize.sobres*division.multiplicadorPremio))}
  assert.equal((await db.query('SELECT division FROM suizamente_private.suizamente_liga_estado WHERE jugador_id=$1',[r.id])).rows[0].division,r.destino)
 }
 const promoted=rows.find(r=>r.division==='glaciar'&&r.destino==='cumbre'),demoted=rows.find(r=>r.division==='bosque'&&r.destino==='pradera')
 for(const [r,prefix] of [[promoted,'⬆️'],[demoted,'⬇️']])assert.ok((await db.query("SELECT datos->>'texto' texto FROM suizamente_private.suizamente_novedades WHERE jugador_id=$1 AND tipo='liga' AND ref=$2",[r.id,week])).rows[0].texto.startsWith(prefix))
 assert.equal(Number((await db.query("SELECT count(*) n FROM suizamente_private.suizamente_logros WHERE jugador_id=$1 AND logro='cumbre'",[promoted.id])).rows[0].n),1)
 const noticeCount=Number((await db.query('SELECT count(*) n FROM suizamente_private.suizamente_novedades')).rows[0].n)
 await tick('2026-11-29T23:00:00Z');await tick('2026-11-30T10:00:00Z')
 assert.deepEqual((await db.query("SELECT jugador_id,monedas,inventario FROM suizamente_private.suizamente_movimientos WHERE motivo='liga' AND ref=$1 ORDER BY jugador_id",[week])).rows,receipts)
 assert.equal(Number((await db.query('SELECT count(*) n FROM suizamente_private.suizamente_novedades')).rows[0].n),noticeCount)
 assert.equal(Number((await db.query('SELECT count(*) n FROM suizamente_private.suizamente_ligas WHERE semana=$1',['2026-11-30'])).rows[0].n),receipts.length)
 const today=await call(db,A,'misiones')
 assert.equal(today.fecha,(await db.query('SELECT suizamente_private.v7_hoy()::text d')).rows[0].d)
 assert.ok(Date.parse(today.renuevaEn)>Date.parse(today.servidorAhora))
 await assert.rejects(call(db,A,'cambiar_mision',{fecha:'1900-01-01',dificultad:'facil',version:0}),/409/)
 assert.equal((await call(db,A,'misiones')).cambiosRestantes,today.cambiosRestantes)
 for(const role of ['anon','authenticated']){
  for(const table of ['suizamente_ligas','suizamente_liga_miembros'])await assert.rejects(db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE '+role);return tx.exec('SELECT * FROM suizamente_private.'+table)}),/permission denied/)
  await assert.rejects(db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE '+role);return tx.exec('SELECT suizamente_private.v12_tick()')}),/permission denied/)
 }
 // PGlite has no scheduler process: test the real activation SQL against its cron API contract.
 await db.exec("CREATE SCHEMA cron; CREATE TABLE cron.job(jobid bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,jobname text UNIQUE,schedule text,command text); CREATE FUNCTION cron.schedule(n text,s text,c text) RETURNS bigint LANGUAGE sql AS $$ INSERT INTO cron.job(jobname,schedule,command) VALUES(n,s,c) ON CONFLICT(jobname) DO UPDATE SET schedule=excluded.schedule,command=excluded.command RETURNING jobid $$;")
 const activation=(await readFile('supabase/suizamente_v12_tareas.sql','utf8')).replace('CREATE EXTENSION IF NOT EXISTS pg_cron;','')
 await db.exec(activation);await db.exec(activation)
 assert.deepEqual((await db.query('SELECT jobname,schedule,command FROM cron.job')).rows,[{jobname:'suizamente-progreso',schedule:'* * * * *',command:'SELECT suizamente_private.v12_tick()'}])
 await db.exec(await readFile('supabase/suizamente_v12_progreso.sql','utf8'))
 console.log('Progression: unattended Zurich/DST daily allocation, 30-person groups, division limits, points, scheduled weekly rollover, transactional rollback, unique prizes/notices, Cumbre, next-week groups, private table/tick and repeatable cron activation passed.')
}catch(e){console.error('Progression:',e.message,e.where||'');process.exitCode=1}finally{await db?.close()}
