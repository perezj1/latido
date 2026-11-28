import assert from 'node:assert/strict'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {chromium,webkit,expect as rawExpect} from '@playwright/test'
import {startSuizamentePreview,testToken,testUser} from './lib/suizamente-v2-preview.mjs'
import {A,call} from './lib/suizamente-v2-test-db.mjs'
import {mejoraCall} from './lib/mejoras-test-db.mjs'
const engine=process.argv.includes('--webkit')?'webkit':'chromium',expect=rawExpect.configure({timeout:30000}),out='output/carga-rapida'+(engine==='webkit'?'/webkit':'');let preview,browser,page
try{
 await mkdir(out,{recursive:true});preview=await startSuizamentePreview(5703,{hmr:false,mejoras:true,negocios:true,misterioHoy:true});const {db}=preview
 await call(db,A,'regalo');await db.query("INSERT INTO suizamente_private.suizamente_mapa VALUES($1,1,'LU',3),($1,1,'UR',1)",[A]);await mejoraCall(db,A,'decorar/inicio');await db.exec('UPDATE suizamente_private.persona_decoraciones SET vista=true;UPDATE suizamente_private.suizamente_novedades SET leida=true')
 const mystery=JSON.parse(await readFile('server/suizamente/data/misterios.json','utf8')).misterios[0],today=(await db.query("SELECT (clock_timestamp() AT TIME ZONE 'Europe/Zurich')::date::text d")).rows[0].d;await db.query('INSERT INTO suizamente_private.misterios VALUES($1,$2::jsonb)',[today,JSON.stringify({...mystery,fecha:today})])
 browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,args:engine==='chromium'?['--enable-unsafe-swiftshader']:[]});const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',hasTouch:true,isMobile:true});await context.addInitScript(s=>{localStorage.setItem('sb-127-auth-token',JSON.stringify(s));sessionStorage.setItem('suizamente:apertura','1');Object.defineProperty(navigator,'standalone',{get:()=>true})},{access_token:testToken(A),refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+86400,user:testUser(A,'Alex')});page=await context.newPage();const errors=[],reads=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/api/suizamente/'))reads.push({path:r.url().split('/api/suizamente/')[1],status:r.status()})})
 const go=async path=>page.evaluate(path=>{history.pushState({},'',path);dispatchEvent(new PopStateEvent('popstate'))},'/suizamente'+path)
 const shots=async name=>{for(const [width,height]of [[390,844],[375,667]]){await page.setViewportSize({width,height});await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:out+'/'+name+'-'+width+'.png'})}await page.setViewportSize({width:390,height:844})}
 await page.goto(preview.origin+'/suizamente');await expect(page.locator('.sv-mj-modes>a')).toHaveCount(3)
 await page.getByRole('link',{name:'Tienda',exact:true}).click();await expect(page.getByRole('heading',{name:'Comodines',exact:true})).toBeVisible();await shots('Tienda')
 await page.getByRole('link',{name:'Álbum',exact:true}).click();await expect(page.locator('.sv-album-grid')).toBeVisible();await shots('Album')
 await go('/nueva');await expect(page.getByRole('heading',{name:'Rival al azar',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Buscar rival',exact:true})).toBeEnabled();await expect(page.locator('.sv-np-random')).toContainText('Compite con alguien al azar');await shots('NuevaPartida')
 assert.ok(reads.some(r=>r.path==='nueva'&&r.status===200),'Bundled lobby used')
 await go('/mapa');await expect(page.getByRole('heading',{name:'Suiza central',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:/Decorar tu Suiza/})).toHaveCount(0)
 await page.getByRole('link',{name:'Lucerna: nivel 3 de 3. Verlo de cerca',exact:true}).click();await page.getByRole('link',{name:/Decorar tu Suiza/}).click();await expect(page.getByRole('heading',{name:'Decora Lucerna',exact:true})).toBeVisible();await expect(page.locator('.sv-mj-slot')).toHaveCount(8);await expect(page.locator('.sv-map-loading')).toHaveCount(0)
 assert.ok((await page.locator('.sv-mj-slot').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label')))).every(label=>label.includes('LU-')))
 const scale=await page.evaluate(()=>visualViewport.scale)
 if(engine==='chromium'){
 const cdp=await context.newCDPSession(page),point=await page.getByRole('button',{name:'Colocar una decoración en LU-t1',exact:true}).boundingBox(),before=await page.locator('.sv-mj-slot-lines line').evaluateAll(ns=>ns.map(n=>n.getAttribute('x1')+':'+n.getAttribute('y1')))
 const x=point.x+point.width/2,y=point.y+point.height/2
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1},{x:x+55,y,id:2}]})
 for(let i=1;i<=6;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-i*4,y:y-i*2,id:1},{x:x+55+i*6,y:y+i*2,id:2}]});await page.waitForTimeout(40)}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(500)
 assert.equal(await page.evaluate(()=>visualViewport.scale),scale,'Pinch on ＋ cannot zoom the page')
 const after=await page.locator('.sv-mj-slot-lines line').evaluateAll(ns=>ns.map(n=>n.getAttribute('x1')+':'+n.getAttribute('y1')));assert.notDeepEqual(after,before,'Pinch on ＋ zooms the map camera')
 await expect(page.getByRole('dialog')).toHaveCount(0)
 }else{
 await page.getByRole('button',{name:'Colocar una decoración en LU-t1',exact:true}).tap();await expect(page.getByRole('heading',{name:'Elige una decoración',exact:true})).toBeVisible();await page.keyboard.press('Escape')
 }
 await shots('DecorarLU')
 await page.getByRole('button',{name:'Colocar una decoración en LU-t1',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.getByRole('heading',{name:'Elige una decoración',exact:true})).toBeVisible();await page.keyboard.press('Escape')
 await page.getByRole('link',{name:'← Elegir otro cantón',exact:true}).click();await expect(page).toHaveURL(/\/suizamente\/mapa$/);await expect(page.getByRole('link',{name:/Decorar tu Suiza/})).toHaveCount(0)
 await go('/mapa/decorar');await expect(page).toHaveURL(/\/suizamente\/mapa$/)
 await go('/mapa/decorar?canton=SZ');await expect(page.locator('.sv-mj-slot')).toHaveCount(0);await expect(page.getByRole('link',{name:/Construir/})).toBeVisible()
 await go('/misterio');await expect(page.getByRole('button',{name:'Monumento del León',exact:true})).toBeVisible();await shots('Misterio')
 assert.deepEqual(errors,[]);assert.ok(reads.every(r=>r.status<500));await writeFile(out+'/browser.json',JSON.stringify({engine,reads,pinchPageScale:scale,mapZoomChanged:engine==='chromium',errors},null,2));console.log('PASS '+engine+': shop, album and bundled new game; mobile layouts; selected canton only; touch and keyboard picker; no level 0 slots'+(engine==='chromium'?'; pinch on a ＋ zooms only the map':''))
}catch(e){console.error(e.stack);await page?.screenshot({path:out+'/fallo.png'}).catch(()=>{});process.exitCode=1}finally{await browser?.close();await preview?.close()}
