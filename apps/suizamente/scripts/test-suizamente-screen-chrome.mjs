// Real React/temporary SQL. Native OS bars are not emulated by Playwright.
/* global getComputedStyle */
import assert from 'node:assert/strict'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {chromium,webkit,expect} from '@playwright/test'
import {startSuizamentePreview,testToken,testUser} from './lib/suizamente-v2-preview.mjs'
import {A,B,call} from './lib/suizamente-v2-test-db.mjs'
const engine=process.argv.includes('--webkit')?'webkit':'chromium',out='output/barras-sistema/'+engine,errors=[],metrics=[]
let preview,browser,page
try{
 const html=await readFile('index.html','utf8'),manifest=JSON.parse(await readFile('public/suizamente.webmanifest','utf8'))
 assert.ok(html.includes('name="theme-color" content="#FBF9F6"'));assert.ok(html.includes('name="apple-mobile-web-app-capable" content="yes"'));assert.ok(html.includes('name="apple-mobile-web-app-status-bar-style" content="default"'));assert.equal(manifest.theme_color,'#FBF9F6');assert.equal(manifest.background_color,'#FBF9F6')
 await mkdir(out,{recursive:true});preview=await startSuizamentePreview(engine==='webkit'?5481:5480,{hmr:false});const db=preview.db
 let pack=await call(db,A,'abrir_sobre',{clave:crypto.randomUUID()});while(pack.giradas<pack.total)pack=await call(db,A,'girar_carta',{id:pack.id,indice:pack.giradas})
 browser=await(engine==='webkit'?webkit:chromium).launch({headless:true});const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'})
 await ctx.addInitScript(s=>{localStorage.setItem('sb-127-auth-token',JSON.stringify(s));sessionStorage.setItem('suizamente:apertura','1');Object.defineProperty(navigator,'standalone',{get:()=>true})},{access_token:testToken(A),refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+86400,user:testUser(A,'Alex')})
 page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message))
 const theme=color=>expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content',color)
 const go=async path=>{await page.evaluate(path=>{history.pushState({},'',path);window.dispatchEvent(new window.PopStateEvent('popstate'))},'/suizamente'+path)}
 await page.goto(preview.origin+'/suizamente/sobre/'+pack.id);await expect(page.locator('.sv-pack-cards')).toBeVisible();await theme('#DFE7FC')
 const actions=page.locator('.sv-pack>.sv-footer>.sv-button')
 for(const [width,height] of [[320,568],[375,667],[390,844],[1440,900]]){
  await page.setViewportSize({width,height});await actions.first().scrollIntoViewIfNeeded()
  const boxes=await actions.evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,bottom:b.bottom}})),nav=await page.locator('.sv-nav').boundingBox()
  assert.equal(boxes.length,2);assert.ok(Math.abs(boxes[0].y-boxes[1].y)<1,'both actions share a row');assert.ok(boxes.every(b=>b.height>=48&&b.width>=44&&b.x>=0&&b.x+b.width<=width+1&&b.bottom<=nav.y+1),'targets remain above navigation')
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1))
  assert.deepEqual(await actions.evaluateAll(nodes=>nodes.map(n=>n.tabIndex)),[0,0])
  await actions.first().focus();if(engine==='chromium')await page.keyboard.press('Tab');else await actions.last().focus();await expect(actions.last()).toBeFocused();await page.screenshot({path:out+'/sobre-'+width+'.png',fullPage:true});metrics.push({width,height,actions:boxes})
 }
 await page.keyboard.press('Enter');await expect(page.locator('.sv-album-grid')).toBeVisible();await go('/sobre/'+pack.id);await expect(page.locator('.sv-pack-cards')).toBeVisible()
 await page.setViewportSize({width:390,height:844});const simulated=await page.addStyleTag({content:'.sv-root{--sv-top-inset:32px!important}.sv-system-inset{height:32px!important}'})
 await page.evaluate(()=>window.scrollTo(0,0));assert.ok((await page.locator('.sv-pack>.sv-shop-header').boundingBox()).y>=32)
 assert.equal(await page.locator('.sv-system-inset').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(223, 231, 252)');await page.screenshot({path:out+'/sobre-inset-simulado.png'});await simulated.evaluate(e=>e.remove())
 await go('/tienda');await expect(page.locator('.sv-daily-gift')).toBeVisible();await theme('rgb(255, 255, 255)');await page.locator('.sv-daily-gift').tap();await expect(page.getByRole('dialog')).toHaveAccessibleName('¡Regalo diario!');await theme('#FBF9F6');await page.getByRole('button',{name:'Omitir',exact:true}).click();await theme('rgb(255, 255, 255)')
 let match=await call(db,A,'crear_partida',{rival:B});match=await call(db,A,'girar',{id:match.id,turnoN:match.turnoN});await call(db,A,'pregunta',{id:match.id,turnoN:match.turnoN})
 await go('/partida/'+match.id);await expect(page.locator('.sv-question-header')).toBeVisible();await theme(await page.locator('.sv-question-header').evaluate(e=>getComputedStyle(e).backgroundColor));await page.screenshot({path:out+'/pregunta.png'})
 await go('/primera-vez?repetir=1');await expect(page.locator('[data-onb-step="1"]')).toBeVisible();const tint=await page.locator('[data-latido-backdrop]').getAttribute('data-chrome-color');await theme(tint);await page.getByRole('button',{name:'Ahora no',exact:true}).click();await expect(page.locator('[data-onb-step="2"]')).toBeVisible();await theme(await page.locator('[data-latido-backdrop]').getAttribute('data-chrome-color'))
 await go('/entrar');await page.getByRole('link',{name:'Ya tengo cuenta',exact:true}).click();await expect(page.getByRole('textbox',{name:/^Email/})).toBeVisible();await expect(page.locator('.sv-system-inset')).toHaveCount(0);assert.equal(await page.evaluate(()=>document.documentElement.style.getPropertyValue('--sv-system-color')),'')
 assert.deepEqual(errors,[]);await writeFile(out+'/resultado.json',JSON.stringify({engine,initialMetadata:true,dynamicScreenColor:true,questionAndOnboarding:true,momentRestoresColor:true,simulatedInsetProtected:true,sideBySide48px:true,keyboard:true,cleanup:true,metrics,errors},null,2));console.log(engine+': screen and modal theme colors; safe inset simulation; pack actions side by side at 320/375/390/desktop, 48px targets, no navigation overlap, keyboard and cleanup passed.')
}catch(error){console.error(error.stack);await page?.screenshot({path:out+'/fallo.png',fullPage:true}).catch(()=>{});process.exitCode=1}finally{await browser?.close();await preview?.close()}
