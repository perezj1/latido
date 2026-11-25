// Read-only production diagnostics. Simulates the browser prompt, never installs.
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium,expect} from '@playwright/test'
const origin=new URL(process.argv[2]||'https://suizamente.latido.ch').origin,out='output/instalacion-samsung/produccion'
const browser=await chromium.launch({headless:true})
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'})
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
 let releaseGame;const gate=new Promise(resolve=>releaseGame=resolve)
 await page.route('**/assets/SuizamenteApp-*.js',async route=>{await gate;await route.continue()})
 await page.goto(origin+'/suizamente',{waitUntil:'domcontentloaded'});await expect(page.locator('.standalone-loading')).toBeVisible()
 const prevented=await page.evaluate(()=>{window.installTestCalls=0;const event=new window.Event('beforeinstallprompt',{cancelable:true});event.prompt=()=>{window.installTestCalls++;window.installTestGesture=navigator.userActivation.isActive;return Promise.resolve()};event.userChoice=Promise.resolve({outcome:'dismissed'});window.dispatchEvent(event);return event.defaultPrevented})
 assert.equal(prevented,true,'entry retains prompt before lazy UI');releaseGame()
 const banner=page.getByRole('complementary',{name:'Instalar Suizamente'});await banner.getByRole('button',{name:'Instalar',exact:true}).click();await expect(banner.getByRole('button',{name:'Cómo instalar',exact:true})).toBeVisible();assert.equal(await page.evaluate(()=>window.installTestCalls),1);assert.equal(await page.evaluate(()=>window.installTestGesture),true);await expect(page.getByRole('dialog')).toHaveCount(0)
 await navigatorReady(page)
 const cdp=await ctx.newCDPSession(page);await cdp.send('Page.enable');const manifest=await cdp.send('Page.getAppManifest'),installability=await cdp.send('Page.getInstallabilityErrors')
 assert.equal(manifest.url,origin+'/suizamente.webmanifest');assert.deepEqual(manifest.errors,[]);assert.deepEqual(installability.installabilityErrors,[])
 for(const icon of JSON.parse(manifest.data).icons){const r=await ctx.request.get(new URL(icon.src,origin).href);assert.equal(r.status(),200);assert.ok(r.headers()['content-type'].includes('image/png'))}
 assert.deepEqual(errors,[]);await mkdir(out,{recursive:true});await page.screenshot({path:out+'/chrome-android.png',fullPage:true});const result={origin,manifestErrors:manifest.errors,installabilityErrors:installability.installabilityErrors,earlyCapture:true,promptCalls:1,userGesture:true,cancellationSafe:true};await writeFile(out+'/resultado.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
}finally{await browser.close()}
async function navigatorReady(page){await page.evaluate(()=>navigator.serviceWorker.ready)}
