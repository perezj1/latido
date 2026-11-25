// Disposable SQL + real React; hold responses to prove navigation does not wait for revalidation.
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium,webkit,expect} from '@playwright/test'
import {startSuizamentePreview,testToken,testUser} from './lib/suizamente-v2-preview.mjs'
import {A,B,call} from './lib/suizamente-v2-test-db.mjs'
const engine=process.argv.includes('--webkit')?'webkit':'chromium',out='output/velocidad/'+engine,gates=[]
function gate(){let release;const promise=new Promise(r=>release=r);gates.push(release);return {promise,release}}
let preview,browser,page
try{
 await mkdir(out,{recursive:true});preview=await startSuizamentePreview(engine==='webkit'?5473:5472,{hmr:false});await call(preview.db,A,'regalo')
 browser=await(engine==='webkit'?webkit:chromium).launch({headless:true});const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'})
 await ctx.addInitScript(s=>{localStorage.setItem('sb-127-auth-token',JSON.stringify(s));sessionStorage.setItem('suizamente:apertura','1');Object.defineProperty(navigator,'standalone',{get:()=>true})},{access_token:testToken(A),refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+86400,user:testUser(A,'Alex')})
 const bootstrap=gate(),album=gate(),shop=gate(),write=gate(),calls=[],resources=[],errors=[];let holdAlbum=false,holdShop=false,holdWrite=false
 await ctx.route('**/api/suizamente/**',async r=>{const path=new URL(r.request().url()).pathname.split('/').pop();calls.push({path,method:r.request().method()});if(path==='jugador')await bootstrap.promise;if(path==='album'&&holdAlbum)await album.promise;if(path==='tienda'&&holdShop)await shop.promise;if(path==='invitaciones'&&holdWrite)await write.promise;await r.continue()})
 page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>resources.push(new URL(r.url()).pathname))
 await page.goto(preview.origin+'/suizamente/album',{waitUntil:'domcontentloaded'});await expect.poll(()=>calls.filter(c=>c.path==='album').length).toBe(1)
 await expect(page.locator('.sv-album-grid')).toHaveCount(0);bootstrap.release();await expect(page.locator('.sv-album-grid')).toBeVisible();assert.equal(calls.filter(c=>c.path==='album').length,1,'boot and screen consume one album request')
 const nav=page.getByRole('navigation',{name:'Navegación principal'}),go=name=>nav.getByRole('link',{name,exact:true}).tap()
 await go('Tienda');await expect(page.locator('.sv-daily-gift')).toBeVisible();assert.equal(calls.filter(c=>c.path==='tienda').length,1,'intent and screen share the shop request')
 await go('Amigos');await expect(page.getByRole('heading',{name:'Amigos',exact:true})).toBeVisible()
 await page.waitForTimeout(1600);holdAlbum=true;await go('Álbum');await expect(page.locator('.sv-album-grid')).toBeVisible();await expect.poll(()=>calls.filter(c=>c.path==='album').length).toBe(2)
 await expect(page.getByRole('status',{name:'Cargando álbum'})).toHaveCount(0);album.release()
 await expect.poll(()=>page.evaluate(async A=>(await import('/game/src/lib/suizamenteV2.js')).peekSzData('album',A)?.colecciones.length,A)).toBeGreaterThan(0)
 holdShop=true;await go('Tienda');await expect(page.locator('.sv-daily-gift')).toBeVisible();await expect.poll(()=>calls.filter(c=>c.path==='tienda').length).toBe(2);await expect(page.getByRole('status',{name:'Cargando tienda'})).toHaveCount(0)
 shop.release();await page.screenshot({path:out+'/tienda-al-volver.png'})
 assert.equal(calls.filter(c=>c.path==='partidas').length,1,'tab switches do not restart badge polling')
 assert.equal(calls.filter(c=>c.method!=='GET').length,0,'preloading never performs a game action')
 assert.ok(!resources.some(p=>/\/(Admin|world3d)\.(jsx|js)$/.test(p)),'idle warming excludes administration and 3D')
 const cache=await page.evaluate(async({A,B})=>{const api=await import('/game/src/lib/suizamenteV2.js'),copy=api.peekSzData('album',A);copy.colecciones=[];return {own:api.peekSzData('album',A).colecciones.length,other:api.peekSzData('album',B)}},{A,B});assert.ok(cache.own>0);assert.equal(cache.other,null)
 holdWrite=true;await page.evaluate(async()=>{const api=await import('/game/src/lib/suizamenteV2.js');window.tabWrite=api.szApi('invitaciones',{method:'POST'})})
 await expect.poll(()=>calls.some(c=>c.path==='invitaciones')).toBe(true)
 await page.evaluate(async()=>{await(await import('/game/src/lib/suizamenteV2.js')).szApi('album',{fresh:true})})
 assert.ok(await page.evaluate(async A=>(await import('/game/src/lib/suizamenteV2.js')).peekSzData('album',A),A),'a read can complete during a pending write')
 write.release();await page.evaluate(()=>window.tabWrite)
 assert.equal(await page.evaluate(async A=>(await import('/game/src/lib/suizamenteV2.js')).peekSzData('album',A),A),null,'write completion invalidates the concurrent pre-commit read')
 await page.evaluate(async()=>{await(await import('/game/src/lib/suizamenteV2.js')).szApi('album',{fresh:true});await(await import('/game/src/lib/supabase.js')).supabase.auth.signOut({scope:'local'})})
 assert.equal(await page.evaluate(async A=>(await import('/game/src/lib/suizamenteV2.js')).peekSzData('album',A),A),null);await expect(page.locator('.sv-login-screen')).toBeVisible();assert.deepEqual(errors,[])
 const result={engine,bootOverlapsData:true,oneRequestPerResource:true,immediateReturnWhileRevalidating:true,stableBadgePolling:true,noSpeculativeActions:true,noAdminOr3DWarming:true,accountIsolation:true,writeAndLogoutInvalidation:true,errors}
 await writeFile(out+'/resultado.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result))
}catch(error){console.error(error.stack);await page?.screenshot({path:out+'/fallo.png',fullPage:true}).catch(()=>{});process.exitCode=1}finally{gates.forEach(r=>r());await browser?.close();await preview?.close()}
