import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {database,call,profile,step,A,B,C} from './lib/suizamente-v2-test-db.mjs'
import {createSuizamenteHandler} from '../server/suizamente/http.mjs'
import {proposalLine} from '../src/lib/suizamenteAdmin.js'

let db
const prior={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_ANON_KEY}
try{
  db=await database({operaciones:true})
  for(const [id,name] of [[A,'Alex'],[B,'Lu']]){await call(db,id,'guardar_jugador',profile(name));await call(db,id,'bienvenida')}
  process.env.SUPABASE_URL='https://suizamente-test.invalid';process.env.SUPABASE_ANON_KEY='test-anon'
  const handler=createSuizamenteHandler({fetchImpl:async(_url,opts)=>{
    const body=JSON.parse(opts.body),actor=opts.headers.Authorization==='Bearer test-c'?C:opts.headers.Authorization==='Bearer test-a'?A:null
    try{return Response.json(await call(db,actor,body.p_action,body.p_args,body.p_guest_id,body.p_guest_token))}
    catch(e){return Response.json({message:e.message,code:e.code},{status:400})}
  }})
  async function request(path,method='GET',body,actor=C){
    const res={setHeader(){},end(s){this.body=JSON.parse(s)}}
    await handler({url:'/api/suizamente/'+path,method,body,headers:{host:'localhost',...(actor?{authorization:actor===C?'Bearer test-c':'Bearer test-a'}:{})}},res)
    return res
  }
  async function admin(path,method='GET',body){
    const result=await request('admin/'+path,method,body)
    assert.equal(result.statusCode,200,JSON.stringify(result.body));return result.body
  }
  const sections=['resumen','propuestas','avisos','preguntas','jugadores','denuncias','dia','ranking','economia','partidas','asaltos','album','eventos','ligas','registro']
  const before=(await db.query('SELECT count(*) n FROM suizamente_private.suizamente_admin_registro')).rows[0].n
  for(const actor of [null,A])for(const section of sections){
    assert.equal((await request('admin/'+section,'GET',undefined,actor)).statusCode,403)
    assert.equal((await request('admin/'+section,'PUT',{adminId:C,version:0},actor)).statusCode,403)
  }
  assert.equal((await db.query('SELECT count(*) n FROM suizamente_private.suizamente_admin_registro')).rows[0].n,before)
  let events=await admin('eventos'),event=events.filas.at(-1)
  const save=(tipo,extra={})=>admin('eventos/'+event.viernes,'PUT',{version:event.version,tipo,...extra})
  event=await save('categoria',{categoria:'idioma'})
  assert.equal(event.automatico,false);assert.equal(event.version,1)
  assert.equal((await request('admin/eventos/'+event.viernes,'PUT',{version:0,tipo:'obras'})).statusCode,409)
  assert.equal((await request('admin/eventos/'+event.viernes,'PUT',{version:1,tipo:'categoria',categoria:'inventada'})).statusCode,400)
  assert.equal((await request('admin/eventos/2026-01-01','PUT',{version:0,tipo:'obras'})).statusCode,400)
  assert.equal((await request('admin/eventos/2026-01-02','PUT',{version:0,tipo:'obras'})).statusCode,409)
  assert.equal((await request('admin/eventos/fecha-mala','PUT',{version:0,tipo:'obras'})).statusCode,400)
  event=await admin('eventos/'+event.viernes,'DELETE',{version:event.version})
  assert.equal(event.automatico,true);assert.equal(event.version,2)
  assert.equal((await request('admin/eventos/'+event.viernes,'PUT',{version:0,tipo:'obras'})).statusCode,409,'No stale edit after returning to automatic rotation')

  // The same local window includes the spring and autumn daylight-saving changes.
  for(const [friday,hours] of [['2027-03-26',53],['2027-10-29',55]]){
    const e=(await db.query('SELECT suizamente_private.v10_evento($1::date) e',[friday])).rows[0].e
    assert.equal((Date.parse(e.fin)-Date.parse(e.inicio))/3600000,hours)
    assert.equal((await db.query('SELECT suizamente_private.v10_activo($1::timestamptz) e',[new Date(Date.parse(e.inicio)-1).toISOString()])).rows[0].e,null)
    assert.ok((await db.query('SELECT suizamente_private.v10_activo($1::timestamptz) e',[e.inicio])).rows[0].e)
    assert.equal((await db.query('SELECT suizamente_private.v10_activo($1::timestamptz) e',[e.fin])).rows[0].e,null)
  }
  // Freeze only the event clock in this isolated database; no test clock exists in production.
  const clockDefinitions=await db.query("SELECT oid::regprocedure::text sig,pg_get_functiondef(oid) definition FROM pg_proc WHERE oid IN ('suizamente_private.v10_activo(timestamptz)'::regprocedure,'suizamente_private.v10_config_evento(jsonb,timestamptz)'::regprocedure)")
  async function eventClock(instant){for(const r of clockDefinitions.rows){
    assert.ok(r.definition.includes('DEFAULT clock_timestamp()'))
    await db.exec(r.definition.replace('DEFAULT clock_timestamp()',"DEFAULT '"+instant+"'::timestamptz"))
  }}
  event=await save('cartas')
  await eventClock(event.inicio)
  assert.equal((await request('config')).body.album.cartasPorSobre,4)
  assert.equal((await admin('economia')).juego.album.cartasPorSobre,3,'Economy keeps baseline values')
  const pack=await call(db,A,'abrir_sobre',{clave:crypto.randomUUID()})
  for(let i=0;i<4;i++)await call(db,A,'girar_carta',{id:pack.id,indice:i})
  assert.equal((await call(db,A,'sobre',{id:pack.id})).cartas.length,4)
  assert.equal((await admin('album')).colecciones.reduce((n,c)=>n+c.repartidas,0),4,'Includes every delivered card, including duplicates')
  event=await save('obras')
  const balanceBefore=(await call(db,A,'jugador')).jugador.monedas
  const map=await call(db,A,'construir',{canton:'LU',nivel:0,clave:crypto.randomUUID()})
  assert.equal(balanceBefore-map.jugador.monedas,45,'60 coin construction has 25% discount')
  event=await save('sellos')
  const spins=(await db.query("SELECT count(*) FILTER(WHERE suizamente_private.v10_ruleta(suizamente_private.v10_config_base())='sello') n FROM generate_series(1,3000)")).rows[0].n
  assert.ok(spins>600&&spins<900,'Double stamp weighting: '+spins)
  event=await save('categoria',{categoria:'idioma'})
  let match=await call(db,A,'crear_partida',{rival:B})
  await db.query("UPDATE suizamente_private.suizamente_partidas SET reglas=jsonb_set(reglas,'{ruleta,casillas}','[\"idioma\"]') WHERE id=$1",[match.id])
  match=await step(db,A,match)
  await db.query('UPDATE suizamente_private.suizamente_partida_preguntas SET respondida_en=$2 WHERE partida_id=$1',[match.id,event.inicio])
  await db.query('SELECT suizamente_private.v3_respuesta($1,1)',[match.id])
  await db.query('SELECT suizamente_private.v3_respuesta($1,1)',[match.id])
  assert.equal(Number((await db.query("SELECT count(*) n FROM suizamente_private.suizamente_movimientos WHERE motivo='evento_categoria'")).rows[0].n),1)
  assert.equal((await call(db,A,'partida',{id:match.id})).resultado.ganado.monedas,10)
  await eventClock(event.fin)
  assert.equal((await request('config')).body.album.cartasPorSobre,3)
  assert.equal((await request('config')).body.mapa.regiones[0].cantones[0].costes[0],60)
  for(const r of clockDefinitions.rows)await db.exec(r.definition)

  const reportQ=(await db.query('SELECT id FROM suizamente_private.suizamente_preguntas LIMIT 1')).rows[0].id
  await db.query("INSERT INTO suizamente_private.suizamente_reportes(jugador_id,pregunta_id,motivo) VALUES($1,$2,'Consultar con nombre+soporte@example.org')",[A,reportQ])
  assert.ok(!JSON.stringify(await admin('avisos')).includes('example.org'))
  assert.match(JSON.stringify(await admin('avisos')),/contacto oculto/)
  await db.query("INSERT INTO suizamente_private.suizamente_asaltos(jugador_id,victima,pregunta_origen,fecha,region,canton,nivel_inicial,estado,reglas) SELECT $1,$2,i,suizamente_private.v7_hoy(),0,'LU',1,'descartado',suizamente_private.v10_config_base() FROM generate_series(1,4) i",[A,B])
  const raids=await admin('asaltos'),activity=raids.actividad.find(r=>r.jugadorId===A)
  assert.equal(raids.filas.length,4);assert.equal(activity.maxDia,4);assert.equal(activity.maxContraUnaPersona,4)
  assert.equal(activity.victimasDistintas,1);assert.equal(activity.superaLimite,true)
  assert.equal(proposalLine({tipo:'mito',tema:'cultura',emoji:'🎭',pregunta:'A|B\nC',verdad:false,dato:'Dato'}),'V|cultura|🎭|A B C|M|Dato')
  assert.equal(proposalLine({tipo:'real',tema:'cultura',emoji:'🎭',pregunta:'Texto',correcta:1,opciones:[{t:'A'},{t:'B'}],dato:'Dato'}),'R|cultura|🎭|Texto|A|*B|Dato')

  const economy=await admin('economia');economy.juego.tienda.sobre=29
  await admin('economia','PUT',{version:economy.version,juego:economy.juego})
  assert.equal((await request('config')).body.tienda.sobre,29)
  assert.equal((await call(db,B,'comprar',{articulo:'sobre',clave:crypto.randomUUID()})).jugador.monedas,71)
  const invalid=structuredClone(economy.juego);invalid.ligas.tamanoGrupo=0
  assert.equal((await request('admin/economia','PUT',{version:1,juego:invalid})).statusCode,400)

  // Persist real weekly memberships, stable groups, points and tie times.
  const week=(await db.query('SELECT suizamente_private.v7_semana()::text w')).rows[0].w
  const sqlAt=days=>"('"+week+"'::date+"+days+")::timestamp AT TIME ZONE 'Europe/Zurich'"
  await db.exec("DELETE FROM suizamente_private.suizamente_liga_semanas WHERE semana='"+week+"'")
  for(let i=0;i<36;i++){
    const id='55555555-5555-4555-8555-'+String(i).padStart(12,'0')
    await db.query('INSERT INTO auth.users VALUES($1)',[id])
    await db.query("INSERT INTO suizamente_private.suizamente_jugadores(jugador_id,usuario_id,apodo) VALUES($1::text,$1::uuid,$2)",[id,'Persona '+i])
    await db.query("INSERT INTO suizamente_private.suizamente_liga_estado VALUES($1,'bosque')",[id])
    await db.query("INSERT INTO suizamente_private.suizamente_movimientos(jugador_id,motivo,ref,creado_en) VALUES($1,'partida_perdida','previa',"+sqlAt(-3)+")",[id])
  }
  let leagues=await admin('ligas')
  assert.equal(leagues.filas.length,36)
  assert.deepEqual(Object.values(Object.groupBy(leagues.filas,r=>r.grupo)).map(g=>g.length).sort((a,b)=>a-b),[6,30])
  const group=leagues.filas.filter(r=>r.grupo===1)
  const winner=group[0].id,second=group[1].id
  for(const [actor,minute] of [[winner,1],[second,2]]){
    await db.query("INSERT INTO suizamente_private.suizamente_movimientos(jugador_id,motivo,ref,creado_en) VALUES($1,'partida_ganada','actual',"+sqlAt(1)+"+make_interval(mins=>$2))",[actor,minute])
    await db.query("INSERT INTO suizamente_private.suizamente_movimientos(jugador_id,motivo,ref,creado_en) VALUES($1,'sello_ganado','actual',"+sqlAt(1)+"+make_interval(mins=>$2))",[actor,minute])
  }
  leagues=await admin('ligas')
  assert.equal(leagues.filas.find(r=>r.id===winner).puntos,4)
  assert.equal(leagues.filas.find(r=>r.id===winner).puesto,1)
  assert.equal(leagues.filas.find(r=>r.id===second).puesto,2)
  assert.equal(leagues.filas.find(r=>r.id===winner).destino,'glaciar')
  assert.equal(leagues.filas.filter(r=>r.grupo===1&&r.destino==='pradera').length,5)
  await admin('ranking/excluir','POST',{jugadorId:winner,semana:week})
  assert.equal((await admin('ligas')).filas.find(r=>r.id===winner).destino,'bosque')
  await admin('ranking/incluir','POST',{jugadorId:winner,semana:week})
  await db.exec('SELECT suizamente_private.v10_ligas_actualizar('+sqlAt(7)+')')
  await db.exec('SELECT suizamente_private.v10_ligas_actualizar('+sqlAt(7)+')')
  assert.equal((await db.query("SELECT monedas FROM suizamente_private.suizamente_movimientos WHERE jugador_id=$1 AND motivo='liga'",[winner])).rows[0].monedas,750)
  assert.equal((await db.query('SELECT division FROM suizamente_private.suizamente_liga_estado WHERE jugador_id=$1',[winner])).rows[0].division,'glaciar')
  assert.equal(Number((await db.query("SELECT count(*) n FROM suizamente_private.suizamente_movimientos WHERE jugador_id=$1 AND motivo='liga'",[winner])).rows[0].n),1)
  assert.equal((await admin('ligas?semana='+week)).cerrada,true)
  const logs=(await admin('registro')).filas
  for(const action of ['PUT:eventos','DELETE:eventos','PUT:economia','POST:ranking:excluir','POST:ranking:incluir'])assert.ok(logs.some(r=>r.accion===action),action)
  assert.ok(logs.every(r=>r.adminId===C))
  for(const role of ['anon','authenticated'])for(const table of ['suizamente_eventos','suizamente_liga_estado','suizamente_liga_semanas','suizamente_liga_miembros']){
    await assert.rejects(db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE '+role);return tx.exec('SELECT * FROM suizamente_private.'+table)}),/permission denied/)
  }
  await db.exec(await readFile('supabase/suizamente_v2_datos.sql','utf8'))
  await db.exec(await readFile('supabase/suizamente_v10_admin_operaciones.sql','utf8'))
  assert.equal((await request('config')).body.tienda.sobre,29)
  assert.equal((await admin('eventos?desde='+event.viernes)).filas[0].version,event.version)
  console.log('Admin operations: all HTTP 403s, actor audit, no emails, live economy purchases, event schedules/conflicts/DST/effects/expiry, league groups/points/ties/exclusion/closing/rewards once, private tables and repeatable migration passed.')
}catch(e){console.error('Admin operations:',e.message,e.where||'',e.internalQuery||'',e.query||'');process.exitCode=1}
finally{
  await db?.close()
  for(const [key,value] of [['SUPABASE_URL',prior.url],['SUPABASE_ANON_KEY',prior.key]])if(value===undefined)delete process.env[key];else process.env[key]=value
}
