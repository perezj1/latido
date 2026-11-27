// Real React + disposable SQL. Native share and clipboard stay inside the test.
/* global getComputedStyle */
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium,webkit,expect as rawExpect} from '@playwright/test'
import {startSuizamentePreview,testToken,testUser} from './lib/suizamente-v2-preview.mjs'
import {A,B,call} from './lib/suizamente-v2-test-db.mjs'
const engine=process.argv.includes('--webkit')?'webkit':'chromium',expect=rawExpect.configure({timeout:20000}),out='output/inicio-animado/'+engine,checks=[],errors=[],diagnostics=[]
let browser,preview,page
try{
 await mkdir(out,{recursive:true});preview=await startSuizamentePreview(engine==='webkit'?5593:5592,{hmr:false})
 await call(preview.db,A,'regalo');await preview.db.exec('UPDATE suizamente_private.suizamente_novedades SET leida=true')
 browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,args:engine==='chromium'?['--enable-unsafe-swiftshader']:[]})
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,reducedMotion:'no-preference',hasTouch:true})
 await ctx.addInitScript(session=>{
  localStorage.setItem('sb-127-auth-token',JSON.stringify(session));sessionStorage.setItem('suizamente:apertura','1');Object.defineProperty(navigator,'standalone',{get:()=>true})
  window.inviteSpy={copied:[],shared:[]}
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.inviteSpy.copied.push(text)}})
  Object.defineProperty(navigator,'share',{configurable:true,value:data=>{window.inviteSpy.shared.push({...data,gesture:navigator.userActivation.isActive});return Promise.resolve()}})
 },{access_token:testToken(A),refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+86400,user:testUser(A,'Alex')})
 page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')diagnostics.push(m.text())});page.on('requestfailed',r=>diagnostics.push(r.url()+': '+r.failure()?.errorText))
 const invitationPosts=[];page.on('request',r=>{if(r.method()==='POST'&&/\/api\/suizamente\/(amigos\/)?invitaciones$/.test(r.url()))invitationPosts.push(r.url())})
 await page.goto(preview.origin+'/suizamente')
 const photo=page.locator('.sv-home-photo>img')
 // Cold software WebGL + module compilation can exceed the normal UI timeout.
 await expect(photo).toBeVisible({timeout:45000});await page.waitForLoadState('networkidle')
 assert.equal(invitationPosts.length,2,'Home prepares one game and one friend invite')
 const photoSize=await photo.evaluate(e=>({natural:e.naturalWidth,css:e.getBoundingClientRect().width,src:e.src}))
 assert.ok(photoSize.natural>=photoSize.css*3,'Retina image stays crisp');assert.match(photoSize.src,/^data:image\/png/)
 assert.equal(await photo.evaluate(e=>getComputedStyle(e).animationName),'sz-isla-flota')
 await photo.evaluate(async e=>{const a=e.getAnimations()[0];await a.ready;a.pause();a.currentTime=0})
 const initial=await photo.evaluate(e=>getComputedStyle(e).transform)
 const before=await page.locator('.sv-home-map-target').screenshot({path:out+'/isla-abajo.png'})
 await photo.evaluate(e=>e.getAnimations()[0].currentTime=3000)
 await expect.poll(()=>photo.evaluate(e=>getComputedStyle(e).transform)).not.toBe(initial)
 const after=await page.locator('.sv-home-map-target').screenshot({path:out+'/isla-arriba.png'})
 assert.ok(!before.equals(after),'The rendered island actually moves');assert.equal(await photo.getAttribute('src'),photoSize.src)
 assert.equal(await page.locator('.sv-home-photo canvas').count(),0,'Animation keeps the snapshot and no live WebGL')
 for(const [width,height] of [[390,844],[375,667]]){
  await page.setViewportSize({width,height});await expect(photo).toBeVisible();await page.evaluate(()=>document.fonts.ready)
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
  await page.screenshot({path:out+'/inicio-'+width+'.png'})
 }
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await photo.evaluate(e=>getComputedStyle(e).animationName),'none')
 await page.emulateMedia({reducedMotion:'no-preference'});assert.equal(await photo.evaluate(e=>getComputedStyle(e).animationName),'sz-isla-flota')
 checks.push('Crisp PNG floats visibly without re-rendering or live WebGL; system reduced motion stops it; 390/375 fit')
 // Once Home has prepared the links, deliberately prevent any new POST from helping.
 let blocked=0
 const block=async route=>{blocked++;await route.fulfill({status:503,json:{error:'Test: no request allowed when opening sharing'}})}
 await page.route(/\/api\/suizamente\/(amigos\/)?invitaciones$/,block)
 await page.getByRole('button',{name:'Invitar a alguien a jugar'}).click()
 const sheet=page.getByRole('dialog',{name:'Invitar a un amigo'}),input=sheet.getByRole('textbox',{name:'Enlace de invitación'})
 await expect(input).toHaveValue(/^https:\/\/suizamente\.latido\.ch\/suizamente\/amigo\/[a-f0-9]{32}$/)
 await expect(sheet.getByText('Preparando tu enlace…')).toHaveCount(0)
 await sheet.getByRole('button',{name:'Compartir enlace',exact:true}).click()
 assert.equal((await page.evaluate(()=>window.inviteSpy.shared))[0].gesture,true)
 await sheet.getByRole('button',{name:/Copiar enlace$/}).click();assert.equal((await page.evaluate(()=>window.inviteSpy.copied))[0],await input.inputValue())
 await sheet.getByRole('button',{name:'Cerrar',exact:true}).click()
 await page.locator('.sv-home-create').click();await expect(page.getByRole('heading',{name:'Nueva partida',exact:true})).toBeVisible()
 const copy=page.getByRole('button',{name:'Copiar enlace',exact:true});await expect(copy).toBeEnabled();await copy.click()
 await page.getByRole('button',{name:'Compartir',exact:true}).click()
 const shares=await page.evaluate(()=>window.inviteSpy.shared),copies=await page.evaluate(()=>window.inviteSpy.copied)
 assert.match(copies[1],/\/suizamente\/invitar\/[a-z0-9]{8}$/);assert.equal(shares[1].url,copies[1]);assert.equal(shares[1].gesture,true)
 assert.equal(blocked,0,'Opening either invite view and sharing need no request');assert.equal(invitationPosts.length,2)
 checks.push('Both invitation views open with ready links, even when all new POSTs fail; copy and native share use the same URL and retain the click gesture')
 await page.unroute(/\/api\/suizamente\/(amigos\/)?invitaciones$/,block)
 await page.getByRole('navigation',{name:'Navegación principal'}).getByRole('link',{name:'Inicio',exact:true}).click()
 await expect.poll(()=>invitationPosts.length).toBe(3)
 await page.waitForLoadState('networkidle')
 const gameCount=(await preview.db.query('SELECT count(*) n FROM suizamente_private.suizamente_invitaciones WHERE jugador_id=$1',[A])).rows[0].n
 assert.equal(Number(gameCount),2,'A used game invitation is replaced when leaving New game')
 // A stored in-game preference stops the animation as well.
 await page.evaluate(()=>{history.pushState({},'','/suizamente/ajustes');window.dispatchEvent(new window.PopStateEvent('popstate'))})
 await page.getByRole('switch',{name:'Menos animaciones',exact:true}).click()
 await expect.poll(async()=>(await call(preview.db,A,'jugador')).jugador.ajustes.menosAnimaciones).toBe(true)
 await page.getByRole('navigation',{name:'Navegación principal'}).getByRole('link',{name:'Inicio',exact:true}).click()
 await expect(photo).toBeVisible();assert.equal(await photo.evaluate(e=>getComputedStyle(e).animationName),'none')
 checks.push('Used game invitation rotates for the next visit; saved Menos animaciones setting also stops the island')
 const cache=await page.evaluate(async({A,B})=>{
  const m=await import('/game/src/lib/suizamenteInvitations.js'),a=m.peekInvitation(A),other=m.peekInvitation(B)
  const now=Date.now;let expired;try{Date.now=()=>now()+8*86400000;expired=m.peekInvitation(A)}finally{Date.now=now}
  const {supabase}=await import('/game/src/lib/supabase.js');await supabase.auth.signOut({scope:'local'})
  return {prepared:!!a,other,expired,afterLogout:m.peekInvitation(A)}
 },{A,B})
 assert.deepEqual(cache,{prepared:true,other:null,expired:null,afterLogout:null})
 checks.push('Cache rejects another owner, expires, and is erased on logout')
 assert.deepEqual(errors,[]);await writeFile(out+'/resultado.json',JSON.stringify({engine,checks,errors},null,2));console.log(JSON.stringify({engine,checks,errors},null,2))
}catch(error){console.error(error.stack,JSON.stringify({errors,diagnostics}));await page?.screenshot({path:out+'/fallo.png',fullPage:true,timeout:10000}).catch(()=>{});process.exitCode=1}finally{await browser?.close();await preview?.close()}
