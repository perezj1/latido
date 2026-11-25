// Measures real React/3D scenes against temporary SQL, never production.
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import {startSuizamentePreview,testToken,testUser} from './lib/suizamente-v2-preview.mjs'
import {A} from './lib/suizamente-v2-test-db.mjs'
const preview=await startSuizamentePreview(5420,{hmr:false}),browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']}),metrics={}
try{
 for(const reducedMotion of ['no-preference','reduce']){
  const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion})
  await ctx.addInitScript(session=>{
   localStorage.setItem('sb-127-auth-token',JSON.stringify(session));sessionStorage.setItem('suizamente:apertura','1')
   window.framesRequested=0;window.drawCalls=0;const raf=window.requestAnimationFrame
   window.requestAnimationFrame=f=>{window.framesRequested++;return raf(f)}
   for(const type of [window.WebGLRenderingContext,window.WebGL2RenderingContext])if(type){const fn=type.prototype.drawElements;type.prototype.drawElements=function(...args){window.drawCalls++;return fn.apply(this,args)}}
  },{access_token:testToken(A),refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+86400,user:testUser(A,'Alex')})
  const page=await ctx.newPage();await page.goto(preview.origin+'/suizamente/mapa');await page.locator('.sv-map-frame canvas').waitFor();await page.waitForTimeout(2000)
  await page.evaluate(()=>{window.framesRequested=0;window.drawCalls=0});await page.waitForTimeout(2000)
  metrics[reducedMotion]=await page.evaluate(()=>({raf:window.framesRequested,drawCalls:window.drawCalls,models:document.querySelectorAll('canvas').length}))
  assert.ok(metrics[reducedMotion].models>0,'real 3D rendered')
  if(reducedMotion==='reduce'){assert.equal(metrics[reducedMotion].raf,0,'static models do not schedule frames');assert.equal(metrics[reducedMotion].drawCalls,0,'static models do not redraw')}
  else{
   await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new window.Event('visibilitychange'))});await page.waitForTimeout(100)
   await page.evaluate(()=>{window.framesRequested=0;window.drawCalls=0});await page.waitForTimeout(500)
   const hidden=await page.evaluate(()=>({raf:window.framesRequested,drawCalls:window.drawCalls}));assert.deepEqual(hidden,{raf:0,drawCalls:0},'hidden scene stops scheduling and rendering')
   await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new window.Event('visibilitychange'))});await page.waitForTimeout(500)
   assert.ok(await page.evaluate(()=>window.drawCalls>0),'scene resumes on return')
  }
  await ctx.close()
 }
 await mkdir('output/sesion-fluidez',{recursive:true});await writeFile('output/sesion-fluidez/fluidez.json',JSON.stringify(metrics,null,2));console.log(JSON.stringify(metrics));console.log('Static 3D has zero idle frames; hidden scenes stop and resume on return.')
}finally{await browser.close();await preview.close()}
