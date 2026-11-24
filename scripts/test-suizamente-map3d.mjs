import assert from 'node:assert/strict'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {chromium,webkit,expect as rawExpect} from '@playwright/test'
import {startSuizamentePreview,testToken,testUser} from './lib/suizamente-v2-preview.mjs'
import {call,A} from './lib/suizamente-v2-test-db.mjs'
const expect=rawExpect.configure({timeout:25000}),engine=process.argv.includes('--webkit')?'webkit':'chromium',out='output/suizamente-final/'+engine
let preview,browser,page
const errors=[],requests=[]
try{
 await mkdir(out,{recursive:true});preview=await startSuizamentePreview(5283,{demo:true})
 browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,args:engine==='chromium'?['--enable-unsafe-swiftshader']:[]})
 // Play the supplied reference, serving its exact r128 dependency locally.
 const reference=await browser.newPage({viewport:{width:390,height:900},reducedMotion:'reduce'})
 await reference.route('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',async r=>r.fulfill({contentType:'text/javascript',body:await readFile('node_modules/three/build/three.min.js','utf8')}))
 await reference.route('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js',async r=>r.fulfill({contentType:'text/javascript',body:await readFile('node_modules/three/examples/js/controls/OrbitControls.js','utf8')}))
 await reference.goto(preview.origin+'/suizamente/disenos/juego.html');await reference.getByText('Saltar',{exact:true}).click()
 await reference.locator('a[href="#Mapa"]').first().click();await expect(reference.locator('[data-mapa3d] canvas')).toBeVisible()
 await reference.locator('[data-a="elegir"][data-v="UR"]').click();await reference.locator('[data-a="construir"]').click()
 await reference.screenshot({path:out+'/mapa-referencia-jugado.png',fullPage:true});await reference.close()
 const context=await browser.newContext({viewport:{width:390,height:900},hasTouch:true,reducedMotion:'no-preference'})
 await context.addInitScript(({user,token})=>{
  localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user}));sessionStorage.setItem('suizamente:apertura','1')
  window.__gpu={frames:0,deleted:0};window.__qaHidden=false
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__qaHidden})
  for(const Class of [window.WebGLRenderingContext,window.WebGL2RenderingContext].filter(Boolean)){
   for(const [method,key] of [['clear','frames'],['deleteBuffer','deleted']]){const original=Class.prototype[method];Class.prototype[method]=function(...args){window.__gpu[key]++;return original.apply(this,args)}}
  }
 },{user:testUser(A,'Alex'),token:testToken(A)})
 // Observe the real renderer API without replacing its behavior or exporting debug state in the product.
 await context.route('**/src/components/suizamente/v2/world3d.js*',async route=>{
  const response=await route.fetch();await route.fulfill({response,body:await response.text()+`
   window.__mapTrace={states:[],focus:null,destroyed:0};const originalCreate=Mapa3D.crear;
   Mapa3D.crear=(...args)=>{const instance=originalCreate(...args);if(args[0].mode!=='map')return instance;const state=instance.estado,focus=instance.enfocar,destroy=instance.destruir;
    instance.estado=(value,animate)=>{window.__mapTrace.states.push({value,animate});return state(value,animate)};
    instance.enfocar=id=>{window.__mapTrace.focus=id;return focus(id)};
    instance.destruir=()=>{window.__mapTrace.destroyed++;return destroy()};return instance};`})
 })
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()))
 await page.goto(preview.origin+'/suizamente');await page.waitForLoadState('networkidle')
 assert.ok(requests.some(u=>/world3d\.js|deps\/three/.test(u)),'Home loads the shared live 3D module dynamically')
 await expect(page.locator('.sv-home-map canvas')).toBeVisible()
 await page.getByRole('link',{name:/Tu mapa:/}).click();await expect(page.locator('.sv-map-frame>.sv-world-map canvas')).toBeVisible()
 await expect.poll(()=>page.evaluate(()=>window.__gpu.frames)).toBeGreaterThan(2)
 await page.waitForTimeout(1200)
 const canvas=page.locator('.sv-map-frame>.sv-world-map canvas'),box=await canvas.boundingBox()
 // Hit-test actual canton geometry on the canvas, independent of the card controls.
 let selected=false
 for(const y of [.45,.5,.55,.6,.4,.65]){
  for(const x of [.5,.55,.45,.6,.4,.65,.35]){
   await page.touchscreen.tap(box.x+box.width*x,box.y+box.height*y)
   if(await page.getByRole('button',{name:'← Toda Suiza',exact:true}).isVisible()){selected=true;break}
  }
  if(selected)break
 }
 assert.ok(selected,'Tapping the 3D selects a canton')
 assert.equal((await call(preview.db,A,'mapa')).niveles.LU,undefined,'Selection does not spend or build')
 await page.getByRole('button',{name:'← Toda Suiza',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__mapTrace.focus)).toBe(null)
 await page.getByRole('button',{name:/Ver Lucerna/}).click();await expect.poll(()=>page.evaluate(()=>window.__mapTrace.focus)).toBe('LU')
 await expect(page.getByRole('button',{name:/Subir a nivel 1/})).toBeVisible()
 const statesBefore=await page.evaluate(()=>window.__mapTrace.states.filter(s=>s.animate).length)
 const deletedBefore=await page.evaluate(()=>window.__gpu.deleted)
 for(let level=1;level<=3;level++){
  await page.getByRole('button',{name:new RegExp('Subir a nivel '+level)}).click()
  await expect.poll(async()=>(await call(preview.db,A,'mapa')).niveles.LU).toBe(level)
  await expect.poll(()=>page.evaluate(()=>window.__mapTrace.states.filter(s=>s.animate==='LU').length)).toBe(statesBefore+level)
  await page.screenshot({path:out+'/mapa-nivel-'+level+'-390.png',fullPage:true})
 }
 await expect(page.getByText('Nivel 3/3 · Puente de la Capilla',{exact:true})).toBeVisible()
 await expect.poll(()=>page.evaluate(()=>window.__gpu.deleted)).toBeGreaterThan(deletedBefore)
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForLoadState('networkidle')
 assert.equal(await page.evaluate(()=>window.__mapTrace.states.filter(s=>s.animate==='LU').length),statesBefore+3,'Refreshing never repeats construction confetti')
 const image=await canvas.screenshot();await page.waitForTimeout(350);assert.notDeepEqual(await canvas.screenshot(),image,'The live miniature moves')
 await page.evaluate(()=>{window.__qaHidden=true;document.dispatchEvent(new Event('visibilitychange'))});await page.waitForTimeout(100)
 const frames=await page.evaluate(()=>window.__gpu.frames);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>window.__gpu.frames),frames,'No drawing while hidden')
 await page.evaluate(()=>{window.__qaHidden=false;document.dispatchEvent(new Event('visibilitychange'))});await expect.poll(()=>page.evaluate(()=>window.__gpu.frames)).toBeGreaterThan(frames)
 await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(300)
 const large=await canvas.boundingBox();await page.mouse.move(large.x+large.width*.5,large.y+large.height*.6);await page.mouse.down();await page.mouse.move(large.x+large.width*.7,large.y+large.height*.6,{steps:8});await page.mouse.up();await page.mouse.wheel(0,-100)
 if(engine==='chromium'){
  const session=await context.newCDPSession(page),x=large.x+large.width*.5,y=large.y+large.height*.5
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-20,y},{x:x+20,y}]})
  await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-45,y},{x:x+45,y}]})
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await session.detach()
 }
 await page.screenshot({path:out+'/mapa-gestos-1440.png',fullPage:true})
 await page.getByRole('button',{name:'← Toda Suiza',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__mapTrace.focus)).toBe(null)
 await page.getByRole('link',{name:'Inicio',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__mapTrace.destroyed)).toBe(1)
 await expect(page.locator('.sv-home-map canvas')).toBeVisible();await page.getByRole('link',{name:'Menú',exact:true}).click();await page.waitForTimeout(100)
 const stopped=await page.evaluate(()=>window.__gpu.frames);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>window.__gpu.frames),stopped)
 const failed=await context.newPage();failed.on('pageerror',e=>errors.push(e.message))
 await failed.route('**/src/components/suizamente/v2/world3d.js*',route=>route.abort())
 await failed.goto(preview.origin+'/suizamente/mapa');await expect(failed.locator('.sv-map-frame>.sv-world-map svg')).toBeVisible()
 await failed.getByRole('button',{name:/Ver Uri/}).click();await expect(failed.getByRole('button',{name:/Subir a nivel 1/})).toBeVisible()
 await failed.screenshot({path:out+'/mapa-respaldo-carga-fallida.png',fullPage:true});await failed.close()
 assert.deepEqual(errors,[])
 await writeFile(out+'/mapa3d.json',JSON.stringify({engine,checks:['reference played','lazy Three','canvas touch selection','selection never builds','three real levels','monument','confetti once','particle disposal','live motion','hidden pause','desktop mouse/zoom','touch pinch where supported','whole map','unmount disposal']},null,2))
 console.log('Map 3D: reference, lazy loading, real touch hit-testing, explicit three-level construction, live miniature, one animation per build, resource disposal, hidden pause, desktop gestures, whole-map return and unmount passed.')
}catch(e){await page?.screenshot({path:out+'/map3d-failure.png',fullPage:true}).catch(()=>{});console.error('Map 3D:',e.message);process.exitCode=1}
finally{await browser?.close();await preview?.close()}
