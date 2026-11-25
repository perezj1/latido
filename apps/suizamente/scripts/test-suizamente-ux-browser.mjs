import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium,webkit,expect as rawExpect} from '@playwright/test'
import {startSuizamentePreview,testToken,testUser} from './lib/suizamente-v2-preview.mjs'
import {A,B,call} from './lib/suizamente-v2-test-db.mjs'
const expect=rawExpect.configure({timeout:20000}),engine=process.argv.includes('--webkit')?'webkit':'chromium',out='output/ux/'+engine
let preview,browser,page
const errors=[],requests=[],checks=[]
try{
 await mkdir(out,{recursive:true});preview=await startSuizamentePreview(engine==='webkit'?5311:5310)
 await preview.db.query("SELECT suizamente_private.v3_anotar($1,'fixture','ux',5000)",[B]);await call(preview.db,B,'construir',{canton:'LU',nivel:0,clave:crypto.randomUUID()})
 const victory=await call(preview.db,A,'crear_partida',{rival:B}),config=await call(preview.db,A,'config')
 await preview.db.query('UPDATE suizamente_private.suizamente_partidas SET sellos_a=$2 WHERE id=$1',[victory.id,config.categorias.map(c=>c.id)])
 await preview.db.query("SELECT suizamente_private.v2_cerrar($1,$2,'sellos')",[victory.id,A])
 const active=await call(preview.db,A,'crear_partida',{rival:B});await preview.db.query('UPDATE suizamente_private.suizamente_jugadores SET monedas=0 WHERE jugador_id=$1',[A])
 await call(preview.db,A,'jugador');await preview.db.exec('UPDATE suizamente_private.suizamente_novedades SET leida=true')
 browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,args:engine==='chromium'?['--enable-unsafe-swiftshader']:[]})
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'})
 await context.addInitScript(session=>{localStorage.setItem('sb-127-auth-token',JSON.stringify(session));sessionStorage.setItem('suizamente:apertura','1');Object.defineProperty(navigator,'standalone',{get:()=>true})},{access_token:testToken(A),refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+86400,user:testUser(A,'Alex')})
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method()}))
 let recovered=false,attempts=0;await page.route('**/api/suizamente/partidas',route=>{attempts++;if(!recovered){recovered=true;return route.fulfill({status:503,contentType:'application/json',body:'{"error":"Temporal QA"}'})}return route.continue()})
 async function navigate(path){await preview.db.exec('DELETE FROM suizamente_private.suizamente_limites');await page.evaluate(path=>{history.pushState({},'',path);window.dispatchEvent(new PopStateEvent('popstate'))},path)}
 await page.goto(preview.origin+'/suizamente');await page.getByRole('button',{name:'Entrar con cuenta de Latido',exact:true}).click();await page.getByRole('button',{name:/A jugar/}).click()
 await expect(page.locator('.sv-match')).toHaveCount(1);assert.ok(attempts>=2,'Temporary 503 is retried');await expect(page.locator('.sv-connection')).toHaveCount(0)
 await page.evaluate(()=>{window.sawYellow=false;new MutationObserver(()=>{if(document.querySelector('.sv-connection'))window.sawYellow=true}).observe(document.body,{subtree:true,childList:true});window.dispatchEvent(new Event('suizamente:error-conexion'))})
 for(const name of ['Admin','Game','Economy','Community'])assert.ok(!requests.some(r=>r.url.includes('/v2/'+name+'.jsx')),'Home does not eagerly load '+name)
 await expect(page.locator('.sv-opening')).toHaveCount(0);checks.push('lazy screens, no returning-player intro delay, quiet recovery from a transient 503')
 // Consecutive account reads reuse a short cache, real match/question reads do not.
 let before=requests.filter(r=>r.url.endsWith('/api/suizamente/config')).length
 await page.evaluate(async()=>{const {szApi}=await import('/game/src/lib/suizamenteV2.js');await szApi('config',{fresh:true});await Promise.all([szApi('config'),szApi('config'),szApi('config')])})
 assert.equal(requests.filter(r=>r.url.endsWith('/api/suizamente/config')).length-before,1)
 before=requests.filter(r=>r.url.endsWith('/api/suizamente/partidas/'+active.id)).length
 await page.evaluate(async id=>{const {szApi}=await import('/game/src/lib/suizamenteV2.js');await szApi('partidas/'+id);await szApi('partidas/'+id)},active.id)
 assert.equal(requests.filter(r=>r.url.endsWith('/api/suizamente/partidas/'+active.id)).length-before,2)
 checks.push('short read cache; live matches/questions excluded')
 await page.getByRole('navigation',{name:'Navegación principal'}).getByRole('link',{name:'Tienda',exact:true}).click();await expect(page.locator('.sv-shop-card')).not.toHaveCount(0)
 const buying=page.getByRole('button',{name:/Comprar.*monedas/}).first(),purchases=requests.filter(r=>r.url.endsWith('/tienda/comprar')).length
 await buying.click();const toast=page.getByRole('alert').filter({hasText:/faltan|monedas|saldo/i});await expect(toast).toBeVisible()
 const bounds=await toast.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390&&bounds.y<100,'Purchase error is visible at the top')
 assert.equal(requests.filter(r=>r.url.endsWith('/tienda/comprar')).length,purchases+1,'Never replay a purchase')
 assert.equal((await call(preview.db,A,'jugador')).jugador.monedas,0);await page.screenshot({path:out+'/error-compra-390.png',fullPage:true});await expect(toast).toHaveCount(0,{timeout:8000})
 checks.push('insufficient balance: short visible alert; one purchase request; no currency change')
 await page.getByRole('navigation',{name:'Navegación principal'}).getByRole('link',{name:'Mapa',exact:true}).click()
 const canvas=page.locator('.sv-map-frame>.sv-world-map canvas');await expect(canvas).toBeVisible();await expect(page.locator('.sv-map-credit')).toHaveCount(0)
 await page.getByRole('button',{name:'Activar movimiento del mapa',exact:true}).click();await expect(page.locator('.sv-map-tools')).toHaveCount(0)
 assert.equal(await canvas.evaluate(el=>getComputedStyle(el).touchAction),'none');const box=await canvas.boundingBox(),still=await canvas.screenshot()
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,-300);await page.waitForTimeout(250);assert.ok(!(await canvas.screenshot()).equals(still),'Mouse gesture moves the actual map')
 await page.getByRole('button',{name:'Bloquear movimiento del mapa',exact:true}).click();assert.equal(await canvas.evaluate(el=>getComputedStyle(el).touchAction),'pan-y')
 await page.screenshot({path:out+'/mapa-gestos-390.png',fullPage:true});checks.push('map gesture only, no extra tools or bottom credit, vertical scrolling restored when locked')
 await navigate('/suizamente/partida/'+victory.id);await expect(page.getByRole('link',{name:'Atacar ahora',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Atacar después',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Atacar después',exact:true}).click();await expect(page).toHaveURL(/terminadas=1/);await expect(page.locator('.sv-match-history')).toHaveCount(1)
 assert.equal((await preview.db.query('SELECT count(*)::integer n FROM suizamente_private.suizamente_asaltos WHERE partida_id=$1',[victory.id])).rows[0].n,0,'Deferring does not spend the attack')
 await page.screenshot({path:out+'/atacar-despues-390.png',fullPage:true});await page.reload();await expect(page.locator('.sv-match-history')).toHaveCount(1)
 await page.locator('.sv-match-history').getByRole('link',{name:'Atacar',exact:true}).click();await expect(page.getByRole('button',{name:'Atacar Lucerna, nivel 1',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Atacar Lucerna, nivel 1',exact:true}).click();await expect(page.locator('.sv-question-card')).toBeVisible()
 assert.equal((await preview.db.query('SELECT count(*)::integer n FROM suizamente_private.suizamente_asaltos WHERE partida_id=$1',[victory.id])).rows[0].n,1)
 checks.push('attack now/later; deferred victory remains available after reload and login; exactly one attack starts when selected')
 await page.evaluate(()=>{window.dispatchEvent(new Event('suizamente:error-conexion'))});await expect(page.locator('.sv-connection')).toHaveCount(0)
 // The same module must never return the previous account's cached player.
 await preview.db.exec('DELETE FROM suizamente_private.suizamente_limites')
 const identity=await page.evaluate(async ({token})=>{const {szApi}=await import('/game/src/lib/suizamenteV2.js'),{supabase}=await import('/game/src/lib/supabase.js');await szApi('jugador');await supabase.auth.setSession({access_token:token,refresh_token:'test'});return (await szApi('jugador')).jugador.jugador_id},{token:testToken(B)})
 assert.equal(identity,B);checks.push('cache isolated after account switch; no yellow connection banner at any point')
 assert.deepEqual(errors,[]);await writeFile(out+'/resultado.json',JSON.stringify({engine,checks,errors},null,2));console.log('UX '+engine+': '+checks.join('; ')+'.')
}catch(error){console.error(error.stack);await page?.screenshot({path:out+'/fallo.png',fullPage:true}).catch(()=>{});process.exitCode=1}finally{await browser?.close();await preview?.close()}
