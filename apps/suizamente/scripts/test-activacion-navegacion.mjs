import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {chromium,expect as rawExpect} from '@playwright/test'
import {startSuizamentePreview,testToken,testUser} from './lib/suizamente-v2-preview.mjs'
import {A,call} from './lib/suizamente-v2-test-db.mjs'
const expect=rawExpect.configure({timeout:30000}),out='output/activacion/extra';let preview,browser
try{
 await mkdir(out,{recursive:true});preview=await startSuizamentePreview(5699,{hmr:false,mejoras:true,negocios:true});await call(preview.db,A,'regalo');await preview.db.exec('UPDATE suizamente_private.suizamente_novedades SET leida=true')
 browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await context.addInitScript(s=>{localStorage.setItem('sb-127-auth-token',JSON.stringify(s));sessionStorage.setItem('suizamente:apertura','1');Object.defineProperty(navigator,'standalone',{get:()=>true})},{access_token:testToken(A),refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+86400,user:testUser(A,'Alex')})
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
 async function shot(name,target){for(const [width,height]of [[390,844],[375,667]]){await page.setViewportSize({width,height});await page.evaluate(()=>document.fonts.ready);if(target)await target.scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:out+'/'+name+'-'+width+'.png'})}await page.setViewportSize({width:390,height:844})}
 await page.goto(preview.origin+'/suizamente');await expect(page.locator('.sv-mj-modes>a')).toHaveCount(2);await expect(page.locator('.sv-home-photo>img')).toBeVisible({timeout:45000});await shot('Inicio-sin-contenido')
 const counts=await page.evaluate(async()=>{
  const {szApi}=await import('/game/src/lib/suizamenteV2.js'),original=window.fetch;let requests=0
  window.fetch=(input,...args)=>{if(String(input).includes('/api/suizamente/mejoras/resumen'))requests++;return original(input,...args)}
  try{await szApi('mejoras/resumen',{fresh:true});await szApi('mejoras/resumen');await szApi('mejoras/resumen');const reads=requests;await szApi('mejoras/avisos',{method:'PUT',body:{ideas:false,sin_noches:true,misterio:false}});const beforeRead=requests;await szApi('mejoras/resumen');return {reads,invalidated:requests>beforeRead}}finally{window.fetch=original}
 });assert.deepEqual(counts,{reads:1,invalidated:true},'New summaries reuse one read and invalidate after an authenticated mutation')
 await page.getByRole('link',{name:'Menú',exact:true}).click();const minute=page.getByRole('link',{name:/El minuto suizo/});await expect(minute).toBeVisible();await expect(page.getByRole('link',{name:/El misterio del día/})).toHaveCount(0);await expect(page.getByRole('link',{name:/Negocios:|Negocios/}).first()).toBeVisible();await shot('Menu-modos',minute)
 await page.goto(preview.origin+'/suizamente/ajustes');const ideas=page.getByRole('link',{name:'Ideas para seguir',exact:true});await expect(ideas).toBeVisible();await shot('Ajustes-avisos',ideas);await ideas.click();await expect(page.getByRole('heading',{name:'Ideas para seguir',exact:true})).toBeVisible();await expect(page.getByRole('switch',{name:'Ideas para seguir',exact:true})).not.toBeChecked()
 assert.deepEqual(errors,[]);console.log('PASS activation navigation: no mystery without content, mode/Menu access, Settings opens Notices, real summary requests 3 -> 1, mutation invalidates cache; both widths')
}finally{await browser?.close();await preview?.close()}
