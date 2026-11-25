// Touch activation and installed-app lifecycle regression; Web Audio policy is simulated.
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium,webkit,expect as rawExpect} from '@playwright/test'
import {startSuizamentePreview,testToken,testUser} from './lib/suizamente-v2-preview.mjs'
import {A} from './lib/suizamente-v2-test-db.mjs'
import {installFakeAudio} from './lib/fake-audio-context.mjs'
const expect=rawExpect.configure({timeout:10000}),engine=process.argv.includes('--webkit')?'webkit':'chromium',out='output/sonido/tactil-'+engine
let preview,browser,page
try{
 await mkdir(out,{recursive:true});preview=await startSuizamentePreview(engine==='webkit'?5465:5464,{hmr:false});browser=await(engine==='webkit'?webkit:chromium).launch({headless:true})
 const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'}),errors=[]
 await ctx.addInitScript(s=>{localStorage.setItem('sb-127-auth-token',JSON.stringify(s));sessionStorage.setItem('suizamente:apertura','1');Object.defineProperty(navigator,'standalone',{get:()=>true})},{access_token:testToken(A),refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+86400,user:testUser(A,'Alex')})
 await ctx.addInitScript(installFakeAudio,{strictTouch:true});page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message))
 await page.goto(preview.origin+'/suizamente/nueva');const heading=page.getByRole('heading',{name:'Nueva partida',exact:true});await expect(heading).toBeVisible()
 assert.equal(await page.evaluate(()=>window.audioProbe.contexts.length),0)
 const music=expected=>expect.poll(()=>page.evaluate(()=>window.audioProbe.music())).toBe(expected)
 // Opening tries to resume before permission. Backgrounding at this point used to leave gain at zero.
 await page.evaluate(async()=>{const {feedback}=await import('/game/src/lib/suizamenteFeedback.js');feedback('sintonia',{esperar:3000});window.dispatchEvent(new window.Event('pagehide'));window.dispatchEvent(new window.Event('pageshow'))})
 await music(false);assert.equal(await page.evaluate(()=>window.audioProbe.contexts[0].state),'suspended')
 await heading.tap();await music(true)
 const resumes=await page.evaluate(()=>window.audioProbe.resumes)
 assert.ok(resumes.some(r=>r.type==='pointerdown'&&!r.allowed),'touch-down alone cannot unlock this policy')
 assert.ok(resumes.some(r=>['touchend','click'].includes(r.type)&&r.allowed),'trusted touch release unlocks')
 assert.equal(await page.evaluate(()=>window.audioProbe.contexts[0].gains[0].gain.value),.85)
 // Safari may interrupt without hiding. Stop scheduling and retry from the next tap.
 await page.evaluate(()=>{const p=window.audioProbe,c=p.contexts[0];p.unlockNeeded=true;c.state='interrupted';c.events.forEach(f=>f())})
 await music(false);await heading.tap();await music(true)
 // pageshow can be missed by installed apps. A visible tap must clear the stale hidden latch.
 await page.evaluate(()=>window.dispatchEvent(new window.Event('pagehide')));await music(false);await heading.tap();await music(true)
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new window.Event('visibilitychange'))});await music(false)
 await heading.tap();assert.equal(await page.evaluate(()=>window.audioProbe.contexts[0].state),'suspended','hidden taps cannot resume')
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new window.Event('visibilitychange'))});await music(true)
 assert.equal(await page.evaluate(()=>window.audioProbe.maxLive),1)
 await page.evaluate(path=>{history.pushState({},'',path);window.dispatchEvent(new window.PopStateEvent('popstate'))},'/suizamente/entrar')
 await page.getByRole('link',{name:'Ya tengo cuenta',exact:true}).tap();await expect(page.getByRole('textbox',{name:/^Email/})).toBeVisible()
 await expect.poll(()=>page.evaluate(()=>window.audioProbe.contexts[0].state)).toBe('closed')
 // Unmounted listeners must not construct another context.
 await page.getByRole('textbox',{name:/^Email/}).tap();assert.equal(await page.evaluate(()=>window.audioProbe.contexts.length),1);assert.deepEqual(errors,[])
 const result={engine,simulatedTouchPolicy:true,releaseUnlocks:true,blockedStartThenBackgroundRecovers:true,interruptionRecovers:true,missedPageshowRecovers:true,hiddenSilent:true,oneContext:true,cleanup:true,errors}
 await writeFile(out+'/resultado.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result))
}catch(error){console.error(error.stack);await page?.screenshot({path:out+'/fallo.png',fullPage:true}).catch(()=>{});process.exitCode=1}finally{await browser?.close();await preview?.close()}
