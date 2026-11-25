// Real React; only the OS-controlled install event is simulated. No real install.
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium,webkit,expect} from '@playwright/test'
import {startSuizamentePreview} from './lib/suizamente-v2-preview.mjs'
const engine=process.argv.includes('--webkit')?'webkit':'chromium',out='output/instalacion-samsung/'+engine,checks=[],errors=[]
const android='Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'
let preview,browser,page
try{
 await mkdir(out,{recursive:true});preview=await startSuizamentePreview(engine==='webkit'?5443:5442,{hmr:false});browser=await(engine==='webkit'?webkit:chromium).launch({headless:true})
 async function context(userAgent=android,standalone=false){const ctx=await browser.newContext({viewport:{width:390,height:844},userAgent,reducedMotion:'reduce',hasTouch:true});await ctx.addInitScript(standalone=>{sessionStorage.setItem('suizamente:apertura','1');Object.defineProperty(navigator,'standalone',{get:()=>standalone});window.installCalls=0;window.installGestures=[]},standalone);return ctx}
 async function offer(p,{outcome='dismissed',hold=false,fail=false,returnOnly=false}={}){return p.evaluate(({outcome,hold,fail,returnOnly})=>{
  const event=new window.Event('beforeinstallprompt',{cancelable:true})
  event.prompt=()=>{window.installCalls++;window.installGestures.push(navigator.userActivation?.isActive??true);if(fail)return Promise.reject(new window.DOMException('Consumed event','InvalidStateError'));return Promise.resolve({outcome})}
  if(!returnOnly)event.userChoice=hold?new Promise(resolve=>window.chooseInstall=resolve):Promise.resolve({outcome})
  window.dispatchEvent(event);return event.defaultPrevented
 },{outcome,hold,fail,returnOnly})}
 const ctx=await context();page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message))
 let releaseGame;const gate=new Promise(resolve=>releaseGame=resolve)
 await page.route('**/game/src/components/suizamente/v2/SuizamenteApp.jsx',async route=>{await gate;await route.continue()})
 await page.goto(preview.origin+'/suizamente',{waitUntil:'domcontentloaded'});await expect(page.locator('.standalone-loading')).toBeVisible()
 assert.equal(await offer(page,{hold:true}),true,'install event captured before lazy game/banner mounts');releaseGame()
 const banner=()=>page.getByRole('complementary',{name:'Instalar Suizamente'}),button=()=>banner().getByRole('button',{name:'Instalar',exact:true})
 await expect(button()).toBeVisible();await button().click();await expect(banner().getByRole('button',{name:'Instalando…',exact:true})).toBeDisabled();assert.equal(await page.evaluate(()=>window.installCalls),1);assert.deepEqual(await page.evaluate(()=>window.installGestures),[true]);await expect(page.getByRole('dialog')).toHaveCount(0)
 await page.evaluate(()=>window.chooseInstall({outcome:'accepted'}));await expect(banner()).toHaveCount(0)
 assert.equal(await page.evaluate(async()=>(await import('/game/installation.js')).installationSnapshot().installed),false,'acceptance is not a false installation receipt')
 await page.evaluate(()=>window.dispatchEvent(new window.Event('appinstalled')));assert.equal(await page.evaluate(async()=>(await import('/game/installation.js')).installationSnapshot().installed),true)
 checks.push('event before lazy UI retained; trusted click calls native prompt once; busy prevents reuse; acceptance waits for appinstalled')
 await page.reload();await expect(banner()).toBeVisible();await expect(banner().getByRole('button',{name:'Cómo instalar',exact:true})).toBeVisible()
 await page.getByRole('link',{name:'Ya tengo cuenta',exact:true}).click();await expect(page.getByRole('textbox',{name:/^Email/})).toBeVisible();assert.equal(await offer(page),true);await page.goBack();await expect(button()).toBeVisible();await button().click();await expect(banner().getByRole('button',{name:'Cómo instalar',exact:true})).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);assert.equal(await page.evaluate(()=>window.installCalls),1)
 await offer(page,{hold:true});await button().evaluate(el=>{el.click();el.click()});assert.equal(await page.evaluate(()=>window.installCalls),2)
 await offer(page);await page.evaluate(()=>window.chooseInstall({outcome:'dismissed'}));await expect(button()).toBeVisible();await button().click();assert.equal(await page.evaluate(()=>window.installCalls),3)
 checks.push('event during login retained across routes; cancellation is not an error; rapid double click suppressed; fresh browser events remain usable')
 await offer(page,{fail:true});await button().click();await expect(page.getByRole('dialog',{name:'Instala Suizamente',exact:true})).toContainText('Añadir a pantalla de inicio');await page.getByRole('button',{name:'Entendido',exact:true}).click()
 await offer(page,{outcome:'accepted',returnOnly:true});await button().click();await expect(banner()).toHaveCount(0)
 checks.push('rejected/consumed prompt falls back without uncaught error; browsers returning choice directly also supported')
 await page.reload();await offer(page,{hold:true});for(const width of [320,390,1440]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));await page.screenshot({path:out+'/banner-'+width+'.png',fullPage:true})}
 await page.getByRole('link',{name:'Ya tengo cuenta',exact:true}).click();await expect(page.getByRole('textbox',{name:/^Email/})).toBeVisible();await page.evaluate(()=>window.dispatchEvent(new window.Event('appinstalled')));await page.goBack();await expect(page.locator('.sv-login-screen')).toBeVisible();await expect(banner()).toHaveCount(0)
 checks.push('installed while banner unmounted stays hidden; no horizontal overflow at 320/390/1440')
 await ctx.close()
 const ios=await context('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1');page=await ios.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(preview.origin+'/suizamente');await expect(button()).toBeVisible();await offer(page);await button().click();await expect(page.getByRole('dialog',{name:'Instala Suizamente',exact:true})).toContainText('Compartir');assert.equal(await page.evaluate(()=>window.installCalls),0);await ios.close()
 const installed=await context(android,true);page=await installed.newPage();await page.goto(preview.origin+'/suizamente');await expect(page.locator('.sv-login-screen')).toBeVisible();await expect(banner()).toHaveCount(0);await installed.close();checks.push('iPhone guide preserved; installed app has no install banner')
 assert.deepEqual(errors,[]);await writeFile(out+'/resultado.json',JSON.stringify({engine,checks,errors},null,2));console.log(engine+': '+checks.join('; '))
}catch(error){console.error(error.stack);await page?.screenshot({path:out+'/fallo.png',fullPage:true}).catch(()=>{});process.exitCode=1}finally{await browser?.close();await preview?.close()}
