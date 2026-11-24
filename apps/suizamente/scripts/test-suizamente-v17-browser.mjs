import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium,webkit,expect as rawExpect} from '@playwright/test'
import {startSuizamentePreview,testToken,testUser} from './lib/suizamente-v2-preview.mjs'
import {A,B,call} from './lib/suizamente-v2-test-db.mjs'
const expect=rawExpect.configure({timeout:20000}),engine=process.argv.includes('--webkit')?'webkit':'chromium',out='output/v17/'+engine
let preview,browser,page
const errors=[]
try{
 await mkdir(out,{recursive:true});preview=await startSuizamentePreview(engine==='webkit'?5301:5300,{demo:true})
 browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,args:engine==='chromium'?['--enable-unsafe-swiftshader']:[]})
 const identity={access_token:testToken(A),refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+86400,user:testUser(A,'Alex')}
 async function context(standalone=false){const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce',userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1'});await ctx.addInitScript(({session,standalone})=>{localStorage.setItem('sb-127-auth-token',JSON.stringify(session));sessionStorage.setItem('suizamente:apertura','1');Object.defineProperty(navigator,'standalone',{get:()=>standalone})},{session:identity,standalone});return ctx}
 const ctx=await context();page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message))
 await page.goto(preview.origin+'/suizamente');await expect(page.getByRole('complementary',{name:'Instalar Suizamente'})).toBeVisible()
 await page.getByRole('button',{name:'Instalar',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Añadir a pantalla de inicio');await page.getByRole('button',{name:'Entendido',exact:true}).click()
 await page.getByRole('button',{name:'Cerrar aviso de instalación'}).click()
 await page.evaluate(()=>{window.nativeInstallCalls=0;const event=new Event('beforeinstallprompt',{cancelable:true});event.prompt=async()=>{window.nativeInstallCalls++};event.userChoice=Promise.resolve({outcome:'dismissed'});window.dispatchEvent(event)})
 await page.getByRole('link',{name:'Ya tengo cuenta',exact:true}).click();await expect(page.getByRole('textbox',{name:/^Email/})).toBeVisible();await page.goBack();await expect(page.locator('.sv-login-screen')).toBeVisible()
 await page.getByRole('button',{name:'Entrar con cuenta de Latido',exact:true}).click();await expect(page.getByRole('complementary',{name:'Instalar Suizamente'})).toHaveCount(0)
 await page.getByRole('button',{name:/A jugar/}).click();await expect(page.getByRole('complementary',{name:'Instalar Suizamente'})).toBeVisible();await page.getByRole('button',{name:'Instalar',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Añadir a pantalla de inicio');await page.getByRole('button',{name:'Entendido',exact:true}).click();assert.equal(await page.evaluate(()=>window.nativeInstallCalls),0);await page.getByRole('button',{name:'Cerrar aviso de instalación'}).click()
 let match=await call(preview.db,A,'crear_partida',{rival:B});const mid=match.id,config=await call(preview.db,A,'config')
 await preview.db.query("UPDATE suizamente_private.suizamente_partidas SET reglas=jsonb_set(reglas,'{ruleta,casillas}','[\"idioma\"]') WHERE id=$1",[mid])
 await page.getByRole('link',{name:'Menú',exact:true}).click();await expect(page.locator('.sv-nav-icon.home>b')).toHaveText('1')
 await page.getByRole('navigation',{name:'Navegación principal'}).getByRole('link',{name:'Mapa',exact:true}).click();await expect(page.locator('.sv-map-gesture,.sv-map-help')).toHaveCount(0)
 const canvas=page.locator('.sv-map-frame>.sv-world-map canvas');await expect(canvas).toBeVisible();assert.equal(await canvas.evaluate(c=>getComputedStyle(c).touchAction),'pan-y')
 assert.ok(await canvas.evaluate(c=>{for(let p=c;p;p=p.parentElement)if(getComputedStyle(p).touchAction==='none')return false;return true}),'No ancestor blocks vertical touch scrolling')
 await page.waitForTimeout(200);const before=await canvas.screenshot(),rect=await canvas.boundingBox()
 await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(rect.x+rect.width/2+60,rect.y+rect.height/2+20,{steps:10});await page.mouse.up();await page.waitForTimeout(100)
 assert.ok((await canvas.screenshot()).equals(before),'Locked map ignores camera gestures')
 await page.getByRole('button',{name:'Activar movimiento del mapa',exact:true}).click();assert.equal(await canvas.evaluate(c=>getComputedStyle(c).touchAction),'none');await expect(page.locator('.sv-map-tools')).toHaveCount(0);await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.wheel(0,-300);await page.waitForTimeout(100);assert.ok(!(await canvas.screenshot()).equals(before),'Enabled map accepts zoom')
 await page.getByRole('button',{name:'Bloquear movimiento del mapa',exact:true}).click();assert.equal(await canvas.evaluate(c=>getComputedStyle(c).touchAction),'pan-y');await page.screenshot({path:out+'/mapa-bloqueado-390.png',fullPage:true})
 // A recovered read clears the former persistent connection warning.
 let aborted=false;await page.route('**/api/suizamente/partidas',async r=>{if(!aborted){aborted=true;return r.abort('failed')}return r.continue()})
 await page.getByRole('navigation',{name:'Navegación principal'}).getByRole('link',{name:'Inicio',exact:true}).click();await expect.poll(()=>aborted).toBe(true);await page.waitForLoadState('networkidle');await expect(page.locator('.sv-nav-icon.home>b')).toHaveText('1');await expect(page.getByText('Reintentar conexión',{exact:true})).toHaveCount(0);await page.unroute('**/api/suizamente/partidas')
 let resumeReads;const readsPaused=new Promise(resolve=>{resumeReads=resolve}),holdReads=async route=>{await readsPaused;await route.continue()}
 await page.route('**/api/suizamente/**',holdReads);await page.evaluate(()=>window.dispatchEvent(new Event('suizamente:error-conexion')));await expect(page.getByText('Reintentar conexión',{exact:true})).toHaveCount(0);resumeReads();await page.unroute('**/api/suizamente/**',holdReads)
 await page.locator('.sv-match').filter({hasText:'Lu'}).click();await expect(page.locator('.sv-wheel')).toBeVisible();await expect(page.getByText('Reintentar conexión',{exact:true})).toHaveCount(0);await expect(page.locator('.sv-nav')).toHaveCount(0);await expect(page.locator('.sv-footer button')).toHaveCount(0)
 async function answerGame(){
  await preview.db.exec('DELETE FROM suizamente_private.suizamente_limites')
  const state=await call(preview.db,A,'partida',{id:mid}),payload=(await preview.db.query('SELECT payload FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=$1 AND n=$2',[mid,state.pregunta.n])).rows[0].payload
  await page.locator('.sv-options button').nth(state.pregunta.opciones.findIndex(o=>o.indice===payload.correcta)).click();await expect(page.locator('.sv-nav')).toHaveCount(0)
 }
 for(let n=1;n<=3;n++){
  await page.locator('.sv-wheel svg').click({position:{x:60,y:120}});await expect(page.locator('.sv-question-card')).toBeVisible();await answerGame()
  if(n<3){await expect(page.getByRole('button',{name:'Continuar',exact:true})).toBeVisible();await page.getByRole('button',{name:'Continuar',exact:true}).click()}
 }
 await expect(page.locator('.sv-stamp-choice')).toBeVisible();await page.screenshot({path:out+'/elegir-sello-390.png',fullPage:true});await page.locator('.sv-stamp-choice button').first().click();await expect(page.locator('.sv-question-card')).toBeVisible();await answerGame();await page.getByRole('button',{name:'Continuar',exact:true}).click()
 assert.equal((await call(preview.db,A,'partida',{id:mid})).tusSellos.length,1)
 // The SQL suite plays all six. Fast-forward only this browser fixture to the last seal.
 await preview.db.query("UPDATE suizamente_private.suizamente_partidas SET sellos_a=$2,barra_a=3,fase='sello' WHERE id=$1",[mid,config.categorias.slice(0,5).map(c=>c.id)])
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.locator('.sv-stamp-choice')).toBeVisible();await page.locator('.sv-stamp-choice button').last().click();await expect(page.locator('.sv-question-card')).toBeVisible();await answerGame();await page.getByRole('button',{name:'Ver resultado',exact:true}).click()
 await expect(page.getByRole('button',{name:/Revancha/})).toHaveCount(0);await page.getByRole('link',{name:'Atacar ahora',exact:true}).click();await expect(page.getByRole('heading',{name:'Elige dónde atacar',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Atacar Lucerna, nivel 1',exact:true}).locator('canvas')).toBeVisible();await page.screenshot({path:out+'/cantones-oponente-390.png',fullPage:true});await page.getByRole('button',{name:'Atacar Lucerna, nivel 1',exact:true}).click()
 await expect(page).toHaveURL(/\/asalto\//);const raidId=page.url().split('/').pop()
 for(let n=1;n<=5;n++){
  await preview.db.exec('DELETE FROM suizamente_private.suizamente_limites')
  await expect(page.locator('.sv-question-card')).toBeVisible();await expect(page.locator('.sv-nav')).toHaveCount(0)
  const state=await call(preview.db,A,'asalto',{id:raidId}),payload=(await preview.db.query('SELECT payload FROM suizamente_private.suizamente_asaltos WHERE id=$1',[raidId])).rows[0].payload
  await page.locator('.sv-options button').nth(state.pregunta.opciones.findIndex(o=>o.indice===payload.correcta)).click()
  if(n<5){assert.equal((await call(preview.db,B,'mapa')).niveles.LU,1);await page.getByRole('button',{name:'Siguiente pregunta '+(n+1)+'/5',exact:true}).click()}else await page.getByRole('button',{name:'Ver el asalto',exact:true}).click()
 }
 await expect(page.getByRole('heading',{name:'¡Asalto conseguido!',exact:true})).toBeVisible();assert.equal((await call(preview.db,B,'mapa')).niveles.LU,0);await page.screenshot({path:out+'/ataque-conseguido-390.png',fullPage:true})
 await page.waitForLoadState('networkidle');await ctx.close()
 const pwa=await context(true);page=await pwa.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(preview.origin+'/suizamente');await page.getByRole('button',{name:'Entrar con cuenta de Latido',exact:true}).click();await page.getByRole('button',{name:/A jugar/}).click();await expect(page.getByRole('navigation',{name:'Navegación principal'})).toBeVisible();await expect(page.getByRole('complementary',{name:'Instalar Suizamente'})).toHaveCount(0)
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:out+'/pwa-inicio-'+width+'.png',fullPage:true})}
 assert.deepEqual(errors,[]);await writeFile(out+'/resultado.json',JSON.stringify({engine,checks:['install on entry and after profile confirmation','no install in standalone iPhone','turn badge','locked/interactive map','iOS read recovery','wheel click only','no nav in roulette/questions/results/victory/attack','3 answers choose seal','category question grants seal','winner chooses victim canton','5 questions settle once'],errors},null,2));console.log('v17 browser '+engine+': game/seals/victory attack, map lock, turn badge, installation and iPhone standalone checks passed.')
}catch(e){await page?.screenshot({path:out+'/fallo.png',fullPage:true}).catch(()=>{});console.error(e.stack);process.exitCode=1}finally{await browser?.close();await preview?.close()}
