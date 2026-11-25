// Public production only: no login, game writes or notifications.
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium,expect} from '@playwright/test'
const origin=new URL(process.argv[2]||'https://suizamente.latido.ch').origin,browser=await chromium.launch({headless:true}),out='output/sonido/produccion'
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844}})
 await ctx.addInitScript(()=>{Object.defineProperty(navigator,'standalone',{get:()=>true});const Base=window.AudioContext||window.webkitAudioContext;window.audioCheck={contexts:[],oscillators:0};window.AudioContext=function(...args){const c=new Base(...args),create=c.createOscillator.bind(c);c.createOscillator=()=>{window.audioCheck.oscillators++;return create()};window.audioCheck.contexts.push(c);return c}})
 const page=await ctx.newPage(),errors=[],downloads=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/\.(mp3|ogg|wav|m4a|aac)(\?|$)/i.test(r.url()))downloads.push(r.url())})
 await page.goto(origin+'/suizamente');await expect(page.locator('.sv-login-screen')).toBeVisible();assert.equal(await page.evaluate(()=>window.audioCheck.contexts.length),0)
 await page.locator('.sv-login-heading h1').click();await expect.poll(()=>page.evaluate(()=>window.audioCheck.contexts.length)).toBe(1);await expect.poll(()=>page.evaluate(()=>window.audioCheck.contexts[0].state)).toBe('running');await expect.poll(()=>page.evaluate(()=>window.audioCheck.oscillators)).toBeGreaterThan(0)
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new window.Event('visibilitychange'))});await expect.poll(()=>page.evaluate(()=>window.audioCheck.contexts[0].state)).toBe('suspended')
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new window.Event('visibilitychange'))});await expect.poll(()=>page.evaluate(()=>window.audioCheck.contexts[0].state)).toBe('running')
 await page.getByRole('link',{name:'Ya tengo cuenta',exact:true}).click();await expect(page.getByRole('textbox',{name:/^Email/})).toBeVisible();await expect.poll(()=>page.evaluate(()=>window.audioCheck.contexts[0].state)).toBe('closed');assert.equal(await page.evaluate(()=>window.audioCheck.contexts.length),1)
 assert.deepEqual(errors,[]);assert.deepEqual(downloads,[]);const result={origin,oneNativeContext:true,gesture:true,musicSynthesized:true,hiddenSuspends:true,visibleResumes:true,unmountCloses:true,audioDownloads:0,errors};await mkdir(out,{recursive:true});await writeFile(out+'/resultado.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
}finally{await browser.close()}
