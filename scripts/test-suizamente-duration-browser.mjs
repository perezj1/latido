import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {chromium,webkit,expect as rawExpect} from '@playwright/test'
import {startSuizamentePreview,testToken,testUser} from './lib/suizamente-v2-preview.mjs'
import {call,A,B} from './lib/suizamente-v2-test-db.mjs'
const expect=rawExpect.configure({timeout:20000}),engine=process.argv.includes('--webkit')?'webkit':'chromium',out='output/suizamente-final/'+engine
let preview,browser,page
try{
 await mkdir(out,{recursive:true});preview=await startSuizamentePreview(engine==='webkit'?5286:5284)
 browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,args:engine==='chromium'?['--enable-unsafe-swiftshader']:[]})
 const context=await browser.newContext({viewport:{width:390,height:900},reducedMotion:'reduce'})
 await context.addInitScript(({user,token})=>{localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user}));sessionStorage.setItem('suizamente:apertura','1')},{user:testUser(A,'Alex'),token:testToken(A)})
 page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message))
 async function go(path){if(page.url().startsWith(preview.origin))await page.waitForLoadState('networkidle');await preview.db.exec('DELETE FROM suizamente_private.suizamente_limites');await page.goto(preview.origin+'/suizamente/'+path);await page.waitForLoadState('networkidle')}
 const db=preview.db,config=JSON.parse(await readFile('server/suizamente/data/juego.json','utf8'))
 const week=(await db.query('SELECT suizamente_private.v7_semana()::text w')).rows[0].w
 await db.query('DELETE FROM suizamente_private.suizamente_ligas WHERE semana=$1',[week]);await db.query('DELETE FROM suizamente_private.suizamente_liga_semanas WHERE semana=$1',[week])
 for(const id of [A,B])await db.query("INSERT INTO suizamente_private.suizamente_movimientos(jugador_id,motivo,ref,creado_en) VALUES($1,'partida_perdida','previa',($2::date-1)::timestamp AT TIME ZONE 'Europe/Zurich')",[id,week])
 await db.exec('SELECT suizamente_private.v12_tick()')
 await db.query("SELECT suizamente_private.v3_anotar($1,'partida_ganada','actual')",[A]);await db.query("SELECT suizamente_private.v3_anotar($1,'sello_ganado','actual')",[A])
 await go('ranking');await expect(page.getByRole('tab',{name:'Liga',exact:true})).toHaveAttribute('aria-selected','true');await expect(page.locator('.sv-rank-row.you>strong')).toHaveText('4')
 await page.getByRole('tab',{name:'Amigos',exact:true}).click();await expect(page.getByText(/Partidas ganadas esta semana/)).toBeVisible()
 await go('perfil');await expect(page.locator('.sv-league-entry')).toContainText('Liga Pradera')
 await go('');await expect(page.locator('.sv-missions-entry')).toBeVisible();await expect(page.locator('.sv-league-entry')).toContainText('1.º de 2')
 await go('menu');await expect(page.getByRole('link',{name:/Misiones y eventos/})).toBeVisible()
 for(const [difficulty,type] of [['facil','dia'],['media','construir'],['dificil','sellos']]){
  const definition=config.misiones.tipos.find(t=>t.id===type),target=definition.n[difficulty]
  await db.query("UPDATE suizamente_private.suizamente_misiones SET tipo=$3,meta=$4,texto=$5,categoria=NULL,cobrada=false,desde=clock_timestamp() WHERE jugador_id=$1 AND dificultad=$2 AND fecha=suizamente_private.v7_hoy()",[A,difficulty,type,target,definition.texto.replace('{n}',target)])
 }
 await go('misiones');await page.getByRole('button',{name:'🔄 Cambiar',exact:true}).nth(1).click()
 await expect.poll(async()=>(await call(db,A,'misiones')).cambiosRestantes).toBe(0)
 await page.waitForLoadState('networkidle')
 await expect(page.getByRole('button',{name:'🔄 Cambiar',exact:true}).first()).toBeDisabled()
 // Restore a known configured target for the rest of this visual fixture.
 const buildingMission=config.misiones.tipos.find(t=>t.id==='construir')
 await db.query("UPDATE suizamente_private.suizamente_misiones SET tipo='construir',meta=$2,texto=$3,desde=clock_timestamp() WHERE jugador_id=$1 AND dificultad='media' AND fecha=suizamente_private.v7_hoy()",[A,buildingMission.n.media,buildingMission.texto.replace('{n}',buildingMission.n.media)])
 await go('pregunta-del-dia');await page.locator('.sv-options button').first().click();await expect(page.getByRole('heading',{name:/¡Primer voto/})).toBeVisible()
 await db.query("SELECT suizamente_private.v3_anotar($1,'fixture','monedas',2000)",[A])
 for(let level=1;level<=config.misiones.tipos.find(t=>t.id==='construir').n.media;level++){
  await go('mapa');await page.getByRole('button',{name:/Ver Lucerna/}).click();await page.getByRole('button',{name:new RegExp('Subir a nivel '+level)}).click();await expect.poll(async()=>(await call(db,A,'mapa')).niveles.LU).toBe(level)
 }
 for(let i=0;i<config.misiones.tipos.find(t=>t.id==='sellos').n.dificil;i++)await db.query("SELECT suizamente_private.v3_anotar($1,'sello_ganado',$2)",[A,'objetivo-'+i])
 await go('misiones');await expect(page.getByRole('link',{name:'🎁 Abrir cofre diario',exact:true})).toBeVisible()
 await page.getByRole('link',{name:'🎁 Abrir cofre diario',exact:true}).click();await expect(page.getByRole('heading',{name:'Cofre diario',exact:true})).toBeVisible()
 const balance=(await call(db,A,'jugador')).jugador.monedas;await page.reload();await page.waitForLoadState('networkidle');assert.equal((await call(db,A,'jugador')).jugador.monedas,balance)
 await page.screenshot({path:out+'/duracion-cofre-diario.png',fullPage:true})
 const album=JSON.parse(await readFile('server/suizamente/data/album.json','utf8')),monthly=album.colecciones.filter(c=>c.mes).sort((a,b)=>a.mes.localeCompare(b.mes))[0]
 const monthDefinition=(await db.query("SELECT pg_get_functiondef('suizamente_private.v11_mes(timestamptz)'::regprocedure) d")).rows[0].d
 await db.exec(monthDefinition.replace('DEFAULT clock_timestamp()',"DEFAULT '"+monthly.mes+"-15T12:00:00Z'::timestamptz"))
 await go('album');await page.getByRole('button',{name:new RegExp('Nueva este mes: '+monthly.nombre)}).click();await expect(page.getByRole('heading',{name:'✨ '+monthly.nombre,exact:true})).toBeVisible()
 await page.screenshot({path:out+'/duracion-coleccion-mensual.png',fullPage:true})
 const friday=(await db.query("SELECT (date_trunc('week',clock_timestamp() AT TIME ZONE 'Europe/Zurich')::date+4)::text d")).rows[0].d
 await db.query("INSERT INTO suizamente_private.suizamente_eventos(viernes,tipo,admin_id) VALUES($1,'obras',$2)",[friday,A])
 const event=(await db.query('SELECT suizamente_private.v10_evento($1::date) e',[friday])).rows[0].e
 const definitions=(await db.query("SELECT pg_get_functiondef(oid) d FROM pg_proc WHERE oid IN ('suizamente_private.v10_activo(timestamptz)'::regprocedure,'suizamente_private.v10_config_evento(jsonb,timestamptz)'::regprocedure)")).rows
 async function eventClock(instant){for(const r of definitions)await db.exec(r.d.replace('DEFAULT clock_timestamp()',"DEFAULT '"+instant+"'::timestamptz"))}
 await eventClock(event.inicio)
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:900})
  for(const path of ['','misiones']){await go(path);await expect(page.locator('.sv-weekend-event')).toContainText(event.titulo);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:out+'/duracion-evento-'+(path||'inicio')+'-'+width+'.png',fullPage:true})}
 }
 // Leave the screen mounted: event expiry must override its older bootstrap config.
 await eventClock(event.fin);await page.evaluate(()=>window.dispatchEvent(new Event('online')))
 await expect(page.locator('.sv-weekend-event')).toHaveCount(0)
 // SVG/fallback colour checks run without WebGL. The live 3D renderer has its own gesture/build test.
 await context.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:original.call(this,type,...args)}})
 // Finish a real lap from an almost-complete visual fixture.
 const cantons=config.mapa.regiones.flatMap(r=>r.cantones),last=cantons.at(-1)
 for(const k of cantons)await db.query('INSERT INTO suizamente_private.suizamente_mapa VALUES($1,1,$2,$3) ON CONFLICT(jugador_id,vuelta,canton) DO UPDATE SET nivel=excluded.nivel',[A,k.id,config.mapa.nivelesPorCanton-(k.id===last.id?1:0)])
 await go('mapa');await page.locator('.sv-canton-strip').evaluate(el=>{el.scrollLeft=el.scrollWidth});await page.getByRole('button',{name:new RegExp('Ver '+last.nombre)}).click();await page.getByRole('button',{name:/Subir a nivel 3/}).click()
 await expect(page.getByRole('heading',{name:/¡Suiza completa!/})).toBeVisible()
 await expect(page.locator('.sv-lap-complete path[data-canton=LU]')).toHaveAttribute('fill',config.vueltasMapa.vueltas[0].colores[3])
 await page.getByRole('link',{name:'▶ A por la vuelta 2',exact:true}).click();await expect(page.getByText(/VUELTA 2 · REGIÓN 1/)).toBeVisible()
 await page.getByRole('button',{name:/Ver Lucerna/}).click();await expect(page.getByRole('button',{name:/Subir a nivel 1/})).toContainText(String(config.mapa.regiones[0].cantones[0].costes[0]*config.vueltasMapa.vueltas[1].multiplicadorCoste))
 await go('');await expect(page.locator('.sv-home-map path[data-canton=ZH]')).toHaveAttribute('fill',config.vueltasMapa.vueltas[0].colores[3])
 assert.deepEqual(errors,[])
 console.log('Duration UI: mission/menu/home, automatic progress/cofre once, one swap, league/profile/friends tab, monthly banner navigation, live weekend notices/expiry at 390/1440 passed.')
}catch(e){await page?.screenshot({path:out+'/duration-failure.png',fullPage:true}).catch(()=>{});console.error('Duration UI:',e.message);if(preview)console.error((await preview.db.query('SELECT dificultad,tipo,meta,cobrada,texto FROM suizamente_private.suizamente_misiones WHERE jugador_id=$1 AND fecha=suizamente_private.v7_hoy()',[A])).rows);process.exitCode=1}
finally{await browser?.close();await preview?.close()}
