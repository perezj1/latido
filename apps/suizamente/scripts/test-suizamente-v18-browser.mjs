import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium,webkit,expect as rawExpect} from '@playwright/test'
import {startSuizamentePreview,testToken,testUser} from './lib/suizamente-v2-preview.mjs'
import {A,B,call} from './lib/suizamente-v2-test-db.mjs'
const expect=rawExpect.configure({timeout:20000}),engine=process.argv.includes('--webkit')?'webkit':'chromium',out='output/v18/'+engine
let preview,browser,page
const errors=[]
try{
 await mkdir(out,{recursive:true});preview=await startSuizamentePreview(engine==='webkit'?5303:5302)
 const photoA='https://photos.suizamente.test/a.jpg',photoB='https://photos.suizamente.test/b.jpg'
 await preview.db.query("UPDATE suizamente_private.suizamente_jugadores SET apodo='Mismo apodo',ajustes=ajustes||$2::jsonb WHERE jugador_id=$1",[A,JSON.stringify({foto_url:photoA})])
 await preview.db.query("UPDATE suizamente_private.suizamente_jugadores SET apodo='Mismo apodo' WHERE jugador_id=$1",[B]);await preview.db.query('UPDATE public.profiles SET avatar_url=$1 WHERE id=$2',[photoB,B])
 const match=await call(preview.db,A,'crear_partida',{rival:B})
 browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,args:engine==='chromium'?['--enable-unsafe-swiftshader']:[]})
 async function ctx(id,name){const c=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce',userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1'});await c.addInitScript(s=>{localStorage.setItem('sb-127-auth-token',JSON.stringify(s));sessionStorage.setItem('suizamente:apertura','1')},{access_token:testToken(id),refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+86400,user:testUser(id,name)});await c.route('https://photos.suizamente.test/**',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="'+(r.request().url().endsWith('/a.jpg')?'#03AA98':'#4A76EF')+'"/></svg>'}));return c}
 const a=await ctx(A,'Alex');page=await a.newPage();page.on('pageerror',e=>errors.push(e.message));const requests=[];page.on('request',r=>requests.push(r.url()))
 await page.goto(preview.origin+'/suizamente');const banner=page.getByRole('complementary',{name:'Instalar Suizamente'});await expect(banner).toBeVisible()
 let box=await banner.boundingBox();assert.ok(Math.abs(box.y+box.height-832)<2,'Banner is at the bottom without navigation')
 assert.ok(!requests.some(url=>url.includes('install-ios.mp4')),'Collapsed video is not downloaded')
 await banner.getByRole('button',{name:'Ver vídeo',exact:true}).click();const video=banner.locator('video');await expect(video).toBeVisible();await expect(video).toHaveAttribute('playsinline','')
 await expect.poll(()=>video.evaluate(v=>v.readyState)).toBeGreaterThanOrEqual(1);assert.ok(await video.evaluate(v=>v.duration>16&&v.duration<18))
 await video.evaluate(v=>{v.currentTime=6});await page.waitForTimeout(250);await page.screenshot({path:out+'/video-ios-390.png',fullPage:true})
 await banner.getByRole('button',{name:'Ocultar vídeo',exact:true}).click();await expect(banner.locator('video')).toHaveCount(0)
 await banner.getByRole('button',{name:/Ahora no/}).click();await page.getByRole('button',{name:'Entrar con cuenta de Latido',exact:true}).click();await expect(page.getByRole('heading',{name:'Tu perfil',exact:true})).toBeVisible();await expect(page.locator('.sv-notice')).toHaveCount(0)
 await expect(page.locator('.sv-profile-avatar img')).toHaveAttribute('src',photoA)
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:width===320?650:844});await page.evaluate(()=>window.scrollTo(0,0))
  const round=await page.locator('.sv-profile-avatar .sv-avatar').evaluate(el=>({radius:getComputedStyle(el).borderRadius,width:el.clientWidth,height:el.clientHeight}));assert.equal(round.radius,'50%');assert.equal(round.width,round.height)
  const layout=await page.locator('.sv-profile-screen').evaluate(form=>{const footer=form.querySelector('footer'),field=form.querySelectorAll('fieldset')[1];return {position:getComputedStyle(footer).position,after:footer.getBoundingClientRect().top>=field.getBoundingClientRect().bottom,top:footer.getBoundingClientRect().top}})
  assert.equal(layout.position,'static');assert.ok(layout.after);if(width===320)assert.ok(layout.top>650,'A jugar is reached by scrolling past every field')
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));const button=page.getByRole('button',{name:/A jugar/});await expect(button).toBeVisible();const buttonBox=await button.boundingBox(),nav=await page.locator('.sv-nav').boundingBox();assert.ok(buttonBox.y+buttonBox.height<=nav.y+1,'Navigation never covers the submit button')
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:out+'/perfil-final-'+width+'.png',fullPage:true})
 }
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:/A jugar/}).click();await expect(banner).toBeVisible();box=await banner.boundingBox();const nav=await page.locator('.sv-nav').boundingBox();assert.ok(Math.abs(box.y+box.height-(nav.y-12))<2,'Banner floats above navigation')
 await page.screenshot({path:out+'/banner-inferior-390.png',fullPage:true});await banner.getByRole('button',{name:/Ahora no/}).click()
 await page.locator('.sv-match').filter({hasText:'Mismo apodo'}).click();await expect(page.locator('.sv-passport img')).toHaveCount(2);assert.deepEqual(await page.locator('.sv-passport img').evaluateAll(imgs=>imgs.map(img=>img.src)),[photoA,photoB]);await page.screenshot({path:out+'/partida-dos-avatares-390.png',fullPage:true})
 const b=await ctx(B,'Lu'),other=await b.newPage();other.on('pageerror',e=>errors.push(e.message));await other.goto(preview.origin+'/suizamente/partida/'+match.id);await other.getByRole('button',{name:'Entrar con cuenta de Latido',exact:true}).click();await other.getByRole('button',{name:/A jugar/}).click();await expect(other.locator('.sv-passport img')).toHaveCount(2);assert.deepEqual(await other.locator('.sv-passport img').evaluateAll(imgs=>imgs.map(img=>img.src)),[photoB,photoA])
 await page.getByRole('link',{name:'Volver',exact:true}).click();await page.getByRole('navigation',{name:'Navegación principal'}).getByRole('link',{name:'Amigos',exact:true}).click();await page.locator('.sv-search input').fill('Mismo');await expect(page.locator('.sv-person-main img')).toHaveAttribute('src',photoB)
 await page.waitForLoadState('networkidle');await other.waitForLoadState('networkidle');assert.deepEqual(errors,[])
 await writeFile(out+'/resultado.json',JSON.stringify({engine,checks:['circular photo','submit after all fields at 320/390/1440','no navigation overlap','reciprocal avatars with identical names','friends/search avatar','bottom install banner','no video download until expanded','real H264 video metadata and inline player','banner returns after A jugar'],errors},null,2));console.log('v18 browser '+engine+': circular photos, scrolling profile, reciprocal avatars, friends, bottom banner and real iOS video passed.')
}catch(e){await page?.screenshot({path:out+'/fallo.png',fullPage:true}).catch(()=>{});console.error(e.stack);process.exitCode=1}finally{await browser?.close();await preview?.close()}
