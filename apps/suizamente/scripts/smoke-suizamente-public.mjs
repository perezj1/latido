// Public, read-only production check. No real accounts, votes or notifications.
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium,webkit,expect} from '@playwright/test'
const origin=new URL(process.argv[2]||'https://suizamente.latido.ch').origin,out='output/sesion-fluidez/produccion',results=[]
await mkdir(out,{recursive:true})
for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch({headless:true})
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await ctx.addInitScript(()=>Object.defineProperty(navigator,'standalone',{get:()=>true}))
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
  const initialHtml=await(await ctx.request.get(origin+'/suizamente')).text();assert.ok(initialHtml.includes('class="standalone-loading"')&&initialHtml.includes('sv-loading-preview'),'HTML shows loading before JavaScript')
  await page.goto(origin+'/suizamente');await expect(page.locator('.sv-login-screen')).toBeVisible();await expect(page.locator('.sv-onb-new')).toHaveCount(0)
  const logo=page.locator('.sv-login-button.latido img');await expect(logo).toBeVisible();await expect.poll(()=>logo.evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true)
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));await page.screenshot({path:out+'/'+engine+'-acceso-'+width+'.png',fullPage:true})}
  await page.getByRole('button',{name:'Conectar con tu cuenta de Latido',exact:true}).click();await expect(page.getByRole('textbox',{name:/^Email/})).toBeVisible();assert.equal(new URL(page.url()).origin,origin);assert.equal(ctx.pages().length,1)
  const config=await ctx.request.get(origin+'/api/suizamente/config');assert.equal(config.status(),200)
  const privateData=await ctx.request.get(origin+'/api/suizamente/album');assert.equal(privateData.status(),401)
  const sw=await ctx.request.get(origin+'/sw.js');assert.equal(sw.status(),200);assert.ok((await sw.text()).includes('function notificationUrl'))
  assert.deepEqual(errors,[]);results.push({engine,loginBeforeOnboarding:true,logo:true,inAppLatido:true,privateData:401,pushRouting:true})
 }finally{await browser.close()}
}
await writeFile(out+'/resultado.json',JSON.stringify({origin,results},null,2));console.log(JSON.stringify({origin,results},null,2))
