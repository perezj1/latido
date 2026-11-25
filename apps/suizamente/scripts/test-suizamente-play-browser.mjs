// Real UI and SQL, isolated in memory. Never connects to production.
/* global PopStateEvent, getComputedStyle, MutationObserver, performance */
import assert from 'node:assert/strict'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {createServer} from 'node:http'
import {resolve,extname} from 'node:path'
import {chromium,webkit,expect as rawExpect} from '@playwright/test'
import {startSuizamentePreview,testToken,testUser} from './lib/suizamente-v2-preview.mjs'
import {A,B,call,callOriginal} from './lib/suizamente-v2-test-db.mjs'
const expect=rawExpect.configure({timeout:20000}),engine=process.argv.includes('--webkit')?'webkit':'chromium',out='output/play/'+engine
const design=resolve(process.env.SUIZAMENTE_DESIGN_ROOT||'../../../latido/suizamente')
let preview,browser,page,referenceServer
const errors=[],checks=[]
try{
 await mkdir(out,{recursive:true});preview=await startSuizamentePreview(engine==='webkit'?5307:5306)
 for(const actor of [A,B])await preview.db.query("SELECT suizamente_private.v3_anotar($1,'fixture','play',5000,0,'{\"sobres\":5,\"otra\":3,\"salta\":3,\"tiempo\":3}')",[actor])
 await call(preview.db,B,'construir',{canton:'LU',nivel:0,clave:crypto.randomUUID()})
 await call(preview.db,A,'jugador');await call(preview.db,B,'jugador')
 await preview.db.exec('UPDATE suizamente_private.suizamente_novedades SET leida=true')
 browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,args:engine==='chromium'?['--enable-unsafe-swiftshader']:[]})
 async function context(actor=A,reducedMotion='no-preference'){
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion})
  await ctx.addInitScript(s=>{localStorage.setItem('sb-127-auth-token',JSON.stringify(s));sessionStorage.setItem('suizamente:apertura','1');Object.defineProperty(navigator,'standalone',{get:()=>true})},{access_token:testToken(actor),refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+86400,user:testUser(actor,actor===A?'Alex':'Lu')})
  return ctx
 }
 async function enter(p,path){await p.goto(preview.origin+path);await expect(p.locator('.sv-login-screen')).toHaveCount(0)}
 async function dismissMoments(){for(let i=0;i<8&&await page.getByRole('dialog').count();i++){await page.getByRole('button',{name:'Omitir',exact:true}).click();await page.waitForTimeout(50)}await expect(page.getByRole('dialog')).toHaveCount(0)}
 async function navigate(path){await page.evaluate(path=>{history.pushState({},'',path);window.dispatchEvent(new PopStateEvent('popstate'))},path)}
 const ctx=await context();page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message))
 const match=await call(preview.db,A,'crear_partida',{rival:B}),mid=match.id,config=await call(preview.db,A,'config')
 // Deterministic slot ONLY in this disposable SQL fixture; production decides its own slot.
 const category=config.categorias[1]
 await preview.db.query("UPDATE suizamente_private.suizamente_partidas SET reglas=jsonb_set(reglas,'{ruleta,casillas}',$2::jsonb) WHERE id=$1",[mid,JSON.stringify([category.id])])
 await enter(page,'/suizamente/partida/'+mid);await expect(page.getByRole('button',{name:'Girar la ruleta',exact:true})).toBeEnabled()
 async function layout(name,width){
  await page.setViewportSize({width,height:844});await page.evaluate(()=>window.scrollTo(0,0))
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' fits '+width)
  const backdrop=page.locator('[data-latido-backdrop]');await expect(backdrop).toHaveCount(1);assert.equal(await backdrop.getAttribute('aria-hidden'),'true')
  assert.equal(await backdrop.evaluate(el=>getComputedStyle(el).pointerEvents),'none')
  assert.equal(await backdrop.evaluate(el=>getComputedStyle(el).zIndex),'-1')
  await expect(page.locator('.sv-notice')).toHaveCount(0)
  const footer=page.locator('.sv-themed-screen>footer');if(await footer.count()){
   assert.equal(await footer.evaluate(el=>getComputedStyle(el).position),'static')
   assert.equal(await footer.evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)')
   const content=page.locator('.sv-themed-screen>.sv-content,.sv-themed-screen>.sv-wheel-area').last()
   if(await content.count())assert.ok((await footer.boundingBox()).y>=(await content.boundingBox()).y+(await content.boundingBox()).height-1,'Footer follows content')
  }
  await page.screenshot({path:out+'/'+name+'-'+width+'.png',fullPage:true})
 }
 for(const width of [320,390,1440]){
  await layout('partida',width)
  const wheel=await page.locator('.sv-light-wheel').boundingBox(),center=await page.locator('.sv-wheel-center').boundingBox()
  assert.ok(wheel.width<=380&&wheel.x>=0&&wheel.x+wheel.width<=width)
  assert.ok(Math.abs(wheel.height-wheel.width*434/380)<1)
  assert.ok(Math.abs(center.x+center.width/2-wheel.x-wheel.width/2)<1)
  assert.ok(Math.abs(center.y+center.height/2-wheel.y-wheel.height*242/434)<1)
  assert.ok(center.width>=44&&center.height>=44)
  assert.deepEqual(await page.locator('.sv-passport .sv-avatar').evaluateAll(els=>els.map(el=>[el.clientWidth,el.clientHeight])),[[64,64],[64,64]])
  const stampRows=await page.locator('.sv-passport').first().locator('.sv-stamps>span').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().top))
  assert.ok(stampRows.every(top=>Math.abs(top-stampRows[0])<1),'Small passport stays on one row')
 }
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Girar la ruleta',exact:true}).focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab')
 assert.ok(await page.locator('.sv-wheel-center').evaluate(el=>el.matches(':focus-visible')&&getComputedStyle(el).outlineStyle!=='none'),'Keyboard focus is visible')
 await expect(page.getByRole('img',{name:'Barra de sello: 0 de '+config.partida.barraParaSello+' aciertos',exact:true})).toBeVisible()
 assert.equal(await page.locator('.sv-pointer').count(),0)
 await expect(page.locator('.sv-game-inventory>span')).toHaveCount(config.comodines.length)
 assert.equal(await page.locator('.sv-game-inventory button').count(),0)
 assert.deepEqual(await page.locator('.sv-game-inventory>span').evaluateAll(els=>els.map(el=>el.clientHeight)),config.comodines.map(()=>32))
 const player=(await call(preview.db,A,'jugador')).jugador
 for(const c of config.comodines)await expect(page.getByRole('img',{name:c.nombre+': tienes '+(player.inventario[c.id]||0),exact:true})).toBeVisible()
 // The opponent has no spin button and clicking the drawing cannot issue a spin.
 const otherCtx=await context(B),other=await otherCtx.newPage();let opponentSpins=0
 other.on('request',r=>{if(r.url().endsWith('/girar'))opponentSpins++})
 await enter(other,'/suizamente/partida/'+mid);await expect(other.locator('.sv-wheel-center[role=img]')).toBeVisible();await expect(other.getByRole('button',{name:'Girar la ruleta',exact:true})).toHaveCount(0)
 await other.locator('.sv-light-wheel svg').click({position:{x:80,y:150}});assert.equal(opponentSpins,0);await otherCtx.close();await page.bringToFront()
 checks.push('320/390/desktop geometry, 64px avatars, focus, arc, real 32px powerup pills, opponent read-only')
 // Pause the question request so the final lit slot can be inspected before navigation.
 let releaseQuestion,questionReached=false;const gate=new Promise(r=>{releaseQuestion=r})
 const hold=async route=>{questionReached=true;await gate;await route.continue().catch(e=>{if(!page.isClosed()&&!e.message.includes('already handled'))throw e})}
 await page.route('**/partidas/'+mid+'/pregunta',hold)
 await page.locator('.sv-light-wheel').evaluate(el=>{window.lightSteps=[];new MutationObserver(()=>{const value=Number(el.dataset.light);if(window.lightSteps.at(-1)?.value!==value)window.lightSteps.push({value,t:performance.now()})}).observe(el,{attributes:true,attributeFilter:['data-light']})})
 let spins=0;page.on('request',r=>{if(r.url().endsWith('/'+mid+'/girar'))spins++})
 const wheelPaths=await page.locator('[data-slot]>path').evaluateAll(els=>els.map(el=>el.getAttribute('d'))),started=Date.now()
 await page.getByRole('button',{name:'Girar la ruleta',exact:true}).click();await expect(page.getByRole('button',{name:'Girar la ruleta',exact:true})).toBeDisabled()
 await page.waitForTimeout(400);await page.screenshot({path:out+'/partida-giro-390.png',fullPage:true})
 await expect.poll(()=>questionReached).toBe(true)
 const elapsed=Date.now()-started,steps=await page.evaluate(()=>window.lightSteps),n=config.categorias.length+1
 await writeFile(out+'/luz.json',JSON.stringify({elapsed,steps},null,2))
 assert.equal(spins,1);assert.ok(elapsed>=config.ruleta.duracionGiroMs-150)
 assert.equal(steps.at(-1).value,1);assert.equal(steps.filter(s=>s.value===-1).length,2,'Two blinks')
 const travel=steps.slice(0,steps.findIndex(s=>s.value===-1))
 // WebKit can coalesce a fast render frame; a counterclockwise jump is n-1.
 assert.ok(travel.length>=n*2,'Light completes several laps')
 for(let i=1;i<travel.length;i++)assert.ok((travel[i].value-travel[i-1].value+n)%n>0&&(travel[i].value-travel[i-1].value+n)%n<=3,'Clockwise light')
 assert.ok(travel.at(-1).t-travel.at(-2).t>travel[2].t-travel[1].t,'Light slows down')
 assert.deepEqual(await page.locator('[data-slot]>path').evaluateAll(els=>els.map(el=>el.getAttribute('d'))),wheelPaths,'Wheel never rotates')
 await expect(page.locator('[data-ruleta-texto]')).toContainText(category.nombre)
 await page.screenshot({path:out+'/partida-parada-390.png',fullPage:true});releaseQuestion();await page.unroute('**/partidas/'+mid+'/pregunta',hold)
 await expect(page.locator('.sv-question-card')).toBeVisible();await expect(page.locator('.sv-nav')).toHaveCount(0)
 checks.push('server slot, single spin, clockwise deceleration, two blinks, fixed geometry, transition to real question')
 // Solve the current question then use reduced motion for the next spin.
 const state=await call(preview.db,A,'partida',{id:mid}),payload=(await preview.db.query('SELECT payload FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=$1 AND n=$2',[mid,state.pregunta.n])).rows[0].payload
 await page.locator('.sv-options button').nth(state.pregunta.opciones.findIndex(o=>o.t===payload.opciones[payload.correcta].t)).click();await page.getByRole('button',{name:'Continuar',exact:true}).click()
 await page.emulateMedia({reducedMotion:'reduce'});await page.route('**/partidas/'+mid+'/pregunta',async route=>{await new Promise(r=>setTimeout(r,200));await route.continue()})
 await page.locator('.sv-light-wheel').evaluate(el=>{window.reducedSteps=[];new MutationObserver(()=>window.reducedSteps.push(el.dataset.light)).observe(el,{attributes:true,attributeFilter:['data-light']})})
 await page.getByRole('button',{name:'Girar la ruleta',exact:true}).click();await expect(page.locator('.sv-question-card')).toBeVisible();assert.ok((await page.evaluate(()=>window.reducedSteps)).every(s=>s==='1'))
 checks.push('prefers-reduced-motion lights only final server slot')
 const second=await call(preview.db,A,'partida',{id:mid}),secondPayload=(await preview.db.query('SELECT payload FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=$1 AND n=$2',[mid,second.pregunta.n])).rows[0].payload
 await page.locator('.sv-options button').nth(second.pregunta.opciones.findIndex(o=>o.t===secondPayload.opciones[secondPayload.correcta].t)).click()
 await expect(page.locator('.sv-result-title.correct')).toBeVisible()
 // Visual fixtures use the existing SQL functions and configuration. No API mocks.
 await preview.db.exec('DELETE FROM suizamente_private.suizamente_limites')
 await preview.db.query('UPDATE suizamente_private.suizamente_partidas SET sellos_a=$2,sellos_b=$3 WHERE id=$1',[mid,config.categorias.map(c=>c.id),config.categorias.slice(0,2).map(c=>c.id)])
 await preview.db.query('SELECT suizamente_private.v2_cerrar($1,$2,$3)',[mid,A,'sellos'])
 await navigate('/suizamente');await expect(page.locator('.sv-home-screen')).toBeVisible();await navigate('/suizamente/partida/'+mid+'?continuar=1');await expect(page.locator('.sv-game-finish')).toBeVisible();await expect(page.getByRole('dialog')).toBeVisible();await dismissMoments()
 for(const width of [320,390,1440])await layout('fin-partida',width)
 const finished=await call(preview.db,A,'partida',{id:mid})
 if(finished.cofre){await navigate('/suizamente/cofre/'+finished.cofre.id);await expect(page.locator('.sv-chest')).toBeVisible();await expect(page.getByRole('dialog')).toBeVisible();await dismissMoments();await expect(page.locator('.sv-chest .sv-reward-row')).not.toHaveCount(0);await layout('cofre',390)}
 const pack=await call(preview.db,A,'abrir_sobre',{clave:crypto.randomUUID()});await navigate('/suizamente/sobre/'+pack.id);await expect(page.getByRole('dialog').getByRole('heading')).toHaveText('¡Nuevo sobre!');await page.getByRole('button',{name:'Omitir',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.sv-pack-cards')).toBeVisible();await layout('sobre',390)
 await navigate('/suizamente/ataque/'+mid);await expect(page.getByRole('button',{name:'Atacar Lucerna, nivel 1',exact:true})).toBeVisible();for(const width of [320,390,1440])await layout('asalto-elegir-canton',width)
 await page.getByRole('button',{name:'Atacar Lucerna, nivel 1',exact:true}).click();await expect(page.locator('.sv-question-card')).toBeVisible()
 const raidId=page.url().split('/').pop()
 for(let i=1;i<=5;i++){
  await preview.db.exec('DELETE FROM suizamente_private.suizamente_limites')
  const raid=await call(preview.db,A,'asalto',{id:raidId}),q=(await preview.db.query('SELECT payload FROM suizamente_private.suizamente_asaltos WHERE id=$1',[raidId])).rows[0].payload
  await page.locator('.sv-options button').nth(raid.pregunta.opciones.findIndex(o=>o.t===q.opciones[q.correcta].t)).click()
  await page.getByRole('button',{name:i<5?'Siguiente pregunta '+(i+1)+'/5':'Ver el asalto',exact:true}).click()
  if(i<5)await expect(page.locator('.sv-question-card')).toBeVisible()
 }
 await expect(page.locator('.sv-raid.finished')).toBeVisible();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Omitir',exact:true}).click();await navigate('/suizamente/asalto/'+raidId);await expect(page.locator('.sv-raid.finished')).toBeVisible();for(const width of [320,390,1440])await layout('asalto-hecho',width)
 checks.push('finish, chest, pack and five-question raid backgrounds; transparent non-covering footers')
 await preview.db.exec('DELETE FROM suizamente_private.suizamente_limites')
 const duelMatch=await call(preview.db,A,'crear_partida',{rival:B})
 await preview.db.query("UPDATE suizamente_private.suizamente_partidas SET fase='sello',barra_a=3,sellos_a=$2,sellos_b=$3 WHERE id=$1",[duelMatch.id,[config.categorias[0].id],[config.categorias[1].id]])
 await navigate('/suizamente/partida/'+duelMatch.id);await expect(page.locator('.sv-stamp-choice')).toBeVisible()
 for(const width of [320,390,1440])await layout('elegir-sello',width)
 await page.locator('.sv-duel-invite').click();for(const width of [320,390,1440])await layout('duelo-preparar',width)
 await page.getByRole('button',{name:'⚔️ ¡Al duelo!',exact:true}).click();await expect(page.locator('.sv-question-card')).toBeVisible();await navigate('/suizamente')
 for(const actor of [A,B])for(let i=0;i<config.duelo.preguntas;i++){
  await preview.db.exec('DELETE FROM suizamente_private.suizamente_limites')
  let m=await call(preview.db,actor,'partida',{id:duelMatch.id})
  if(!m.pregunta)m=await call(preview.db,actor,'pregunta',{id:m.id,turnoN:m.turnoN})
  const q=(await preview.db.query('SELECT payload FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=$1 AND n=$2',[m.id,m.pregunta.n])).rows[0].payload
  await callOriginal(preview.db,actor,'respuesta',{id:m.id,turnoN:m.turnoN,n:m.pregunta.n,opcion:actor===A?q.correcta:(q.correcta+1)%q.opciones.length})
 }
 await navigate('/suizamente/partida/'+duelMatch.id+'?continuar=1');await expect(page.locator('.sv-duel-result')).toBeVisible();for(const width of [320,390,1440])await layout('duelo-resultado',width)
 await preview.db.query("SELECT suizamente_private.v3_anotar($1,'vuelta','1',$2)",[A,config.vueltasMapa.premioMonedasPorVuelta])
 await preview.db.query('INSERT INTO suizamente_private.suizamente_vueltas VALUES($1,2) ON CONFLICT(jugador_id) DO UPDATE SET vuelta=2',[A])
 await navigate('/suizamente/mapa/vuelta?vuelta=1');await expect(page.locator('.sv-lap-complete')).toBeVisible();for(const width of [320,390,1440])await layout('vuelta-completa',width)
 // Existing one-question raid offer remains compatible with the same backdrop.
 await preview.db.query("UPDATE suizamente_private.suizamente_mapa SET nivel=1 WHERE jugador_id=$1 AND canton='LU'",[B])
 const offered=(await preview.db.query("INSERT INTO suizamente_private.suizamente_asaltos(jugador_id,victima,partida_id,pregunta_origen,fecha,region,canton,nivel_inicial,reglas) SELECT $1,$2,id,999,current_date,0,'LU',1,reglas FROM suizamente_private.suizamente_partidas WHERE id=$3 RETURNING id",[A,B,mid])).rows[0]
 await navigate('/suizamente/asalto/'+offered.id);await expect(page.getByRole('heading',{name:'¡Asalto!',exact:true})).toBeVisible();for(const width of [320,390,1440])await layout('asalto',width)
 checks.push('seal selection, duel preparation/result and lap complete at all three widths; compatible raid offer')
 // The in-app setting works even when the operating system allows animations.
 await preview.db.exec('DELETE FROM suizamente_private.suizamente_limites')
 await preview.db.query("UPDATE suizamente_private.suizamente_jugadores SET ajustes=ajustes||'{\"menosAnimaciones\":true}' WHERE jugador_id=$1",[B])
 const quietMatch=await call(preview.db,B,'crear_partida',{rival:A})
 await preview.db.query("UPDATE suizamente_private.suizamente_partidas SET reglas=jsonb_set(reglas,'{ruleta,casillas}',$2::jsonb) WHERE id=$1",[quietMatch.id,JSON.stringify([category.id])])
 const quietCtx=await context(B),quiet=await quietCtx.newPage();await enter(quiet,'/suizamente/partida/'+quietMatch.id)
 await expect(quiet.locator('.sv-wheel-center')).toBeEnabled();await expect(quiet.locator('html')).toHaveAttribute('data-suizamente-reduced','true')
 await quiet.locator('.sv-light-wheel').evaluate(el=>{window.quietSteps=[];new MutationObserver(()=>window.quietSteps.push(el.dataset.light)).observe(el,{attributes:true,attributeFilter:['data-light']})})
 const quietStarted=Date.now();await quiet.getByRole('button',{name:'Girar la ruleta',exact:true}).click();await expect(quiet.locator('.sv-question-card')).toBeVisible()
 assert.ok(Date.now()-quietStarted<config.ruleta.duracionGiroMs);assert.ok((await quiet.evaluate(()=>window.quietSteps)).every(s=>s==='1'));await quietCtx.close()
 checks.push('Menos animaciones setting bypasses light motion independently of system preference')
 // Optional local design source: serve, play the reference and save exact side-by-side evidence.
 try{
  const original=await readFile(resolve(design,'disenos/juego.html'),'utf8'),assets=await readFile('game/src/components/suizamente/v2/latidoBackdropAssets.js','utf8')
  for(const name of ['DECO','ESCENA'])assert.equal(JSON.parse(assets.match(new RegExp('export const '+name+'\\s*=\\s*(.+);?'))[1].replace(/;$/,'')),original.match(new RegExp('const '+name+' = `([\\s\\S]*?)`;'))[1].replace('display: var(--sz-escena, block)','display: block'),'Exact '+name+' SVG')
  referenceServer=createServer(async(req,res)=>{try{const p=resolve(design,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!p.startsWith(design+'/')&&!p.startsWith(design+'\\'))throw Error('path');res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml'})[extname(p)]||'application/octet-stream');res.end(await readFile(p))}catch{res.statusCode=404;res.end()}})
  await new Promise(r=>referenceServer.listen(0,'127.0.0.1',r));const refOrigin='http://127.0.0.1:'+referenceServer.address().port,ref=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'})
  await ref.goto(refOrigin+'/disenos/juego.html#Inicio',{waitUntil:'domcontentloaded'});await ref.locator('[data-a=abrir][data-v="1"]').click();await expect(ref.locator('[data-ruleta]')).toBeVisible();await ref.locator('[data-a=girar]').first().click();await ref.waitForTimeout(600);await ref.screenshot({path:out+'/referencia-jugable.png',fullPage:true})
  await ref.goto(refOrigin+'/disenos/pantallas.html');await ref.evaluate(()=>document.fonts.ready)
  const references={Partida:'partida',FinPartida:'fin-partida',Asalto:'asalto',AsaltoHecho:'asalto-hecho'}
  for(const [id,name] of Object.entries(references))await ref.locator('#p-'+id+' .marco').screenshot({path:out+'/referencia-'+name+'.png'})
  // A portable HTML contact sheet with the screenshots side by side.
  await writeFile(out+'/comparacion.html','<!doctype html><meta charset="utf-8"><title>Suizamente: diseño y app</title><style>body{font:16px system-ui;background:#eef1f5}section{display:flex;gap:20px;align-items:flex-start;margin-bottom:40px}figure{margin:0}img{width:390px;max-width:100%;border-radius:24px}h1{font-size:24px}</style><h1>Referencia y app · 390 px</h1>'+['partida','fin-partida','asalto','asalto-hecho'].map(name=>'<h2>'+name+'</h2><section><figure><figcaption>pantallas.html</figcaption><img src="referencia-'+name+'.png"></figure><figure><figcaption>App con datos reales de prueba</figcaption><img src="'+name+'-390.png"></figure></section>').join(''))
  const comparison=await browser.newPage({viewport:{width:880,height:1000}});await comparison.goto('file:///'+resolve(out,'comparacion.html').replaceAll('\\','/'));await comparison.screenshot({path:out+'/comparacion.png',fullPage:true});await comparison.close();await ref.close()
  checks.push('exact original SVGs, playable design, reference screenshots and comparison sheet')
 }catch(e){if(e.code==='ENOENT')console.log('Design source absent: set SUIZAMENTE_DESIGN_ROOT for optional reference captures.');else throw e}
 assert.deepEqual(errors,[]);await writeFile(out+'/resultado.json',JSON.stringify({engine,checks,errors},null,2));console.log('Play presentation '+engine+': '+checks.join('; ')+'.')
}catch(e){console.error(e.stack);await page?.screenshot({path:out+'/fallo.png',fullPage:true}).catch(()=>{});process.exitCode=1}finally{await browser?.close();await preview?.close();await new Promise(r=>referenceServer?referenceServer.close(r):r())}
