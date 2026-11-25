import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium,webkit,expect as rawExpect} from '@playwright/test'
import {startSuizamentePreview,testToken,testUser} from './lib/suizamente-v2-preview.mjs'
import {A,B,call} from './lib/suizamente-v2-test-db.mjs'
const engine=process.argv.includes('--webkit')?'webkit':'chromium',out='output/navegacion/'+engine,expect=rawExpect.configure({timeout:15000}),errors=[],checks=[]
let preview,browser,page,leavingApp=false
const unloadWarnings=[]
try{
 await mkdir(out,{recursive:true});preview=await startSuizamentePreview(engine==='webkit'?5361:5360,{hmr:false})
 await call(preview.db,A,'regalo');await preview.db.exec('UPDATE suizamente_private.suizamente_novedades SET leida=true')
 browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,args:engine==='chromium'?['--enable-unsafe-swiftshader']:[]})
 const session={access_token:testToken(A),refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+86400,user:testUser(A,'Alex')}
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'})
 await context.addInitScript(session=>{if(!localStorage.getItem('sb-127-auth-token'))localStorage.setItem('sb-127-auth-token',JSON.stringify(session));sessionStorage.setItem('suizamente:apertura','1');Object.defineProperty(navigator,'standalone',{get:()=>true})},session)
 page=await context.newPage();page.on('pageerror',e=>{
  // WebKit reports canceled reads as access-control errors while unloading a
  // document. Only the deliberately verified exit to another origin allows it.
  if(engine==='webkit'&&leavingApp&&/api\/suizamente\/.*due to access control checks\.$/.test(e.message))unloadWarnings.push(e.message)
  else errors.push(e.message)
 })
 // A real document outside the app proves Home Back leaves rather than cycling.
 await page.route('https://outside.suizamente.test/**',r=>r.fulfill({contentType:'text/html',body:'<h1>Fuera de la app</h1>'}))
 await page.goto('https://outside.suizamente.test/antes');await page.goto(preview.origin+'/suizamente')
 await expect(page.locator('.sv-login-screen')).toBeVisible();await page.getByRole('button',{name:'Entrar con cuenta de Latido',exact:true}).click();await page.getByRole('button',{name:/A jugar/}).click();await expect(page.locator('.sv-home-screen')).toBeVisible();await expect.poll(()=>page.evaluate(()=>history.state.idx)).toBe(0)
 const nav=()=>page.getByRole('navigation',{name:'Navegación principal'})
 await nav().getByRole('link',{name:'Álbum',exact:true}).click();await expect(page.locator('.sv-album')).toBeVisible()
 await nav().getByRole('link',{name:/Tienda/}).click();await expect(page.getByRole('heading',{name:/Tienda/})).toBeVisible()
 await page.waitForLoadState('networkidle')
 const before=await page.evaluate(()=>({url:location.href,index:history.state.idx,length:history.length}))
 for(let n=0;n<2;n++){await page.waitForLoadState('networkidle');await page.reload();await expect(page.getByRole('heading',{name:/Tienda/})).toBeVisible();await expect(page.locator('.sv-login-screen,.sv-profile-screen')).toHaveCount(0);assert.deepEqual(await page.evaluate(()=>({url:location.href,index:history.state.idx,length:history.length})),before)}
 await page.goBack();await expect(page.locator('.sv-album')).toBeVisible();await nav().getByRole('link',{name:'Amigos',exact:true}).click();await page.getByRole('link',{name:/Ranking de la semana/}).click();await page.getByRole('button',{name:'Volver',exact:true}).click();await expect(page.locator('.sv-friends')).toBeVisible();await page.goBack();await expect(page.locator('.sv-album')).toBeVisible();await page.goBack();await expect(page.locator('.sv-home-screen')).toBeVisible();checks.push('refresh twice preserves URL, session and history; arrow and browser Back follow the actual previous pages')
 await nav().getByRole('link',{name:/Tienda/}).click()
 await nav().getByRole('link',{name:'Amigos',exact:true}).click();await nav().getByRole('link',{name:'Inicio',exact:true}).click();await expect(page.locator('.sv-home-screen')).toBeVisible();await expect.poll(()=>page.evaluate(()=>history.state.idx)).toBe(0)
 await page.screenshot({path:out+'/inicio-390.png'});await page.waitForLoadState('networkidle');leavingApp=true;await page.goBack();await expect(page.getByRole('heading',{name:'Fuera de la app'})).toBeVisible();leavingApp=false;assert.equal(page.url(),'https://outside.suizamente.test/antes');checks.push('returning Home unwinds previous tabs; native Back leaves the app without reopening login')
 // Reload/direct links preserve their query string and add no entries repeatedly.
 await page.goto(preview.origin+'/suizamente/mapa?canton=LU');await expect(nav()).toBeVisible();await expect(page.locator('.sv-login-screen')).toHaveCount(0)
 const direct=await page.evaluate(()=>({url:location.href,index:history.state.idx,length:history.length}));await page.waitForLoadState('networkidle');await page.reload();await expect(nav()).toBeVisible();assert.deepEqual(await page.evaluate(()=>({url:location.href,index:history.state.idx,length:history.length})),direct)
 await page.goBack();await expect(page.locator('.sv-home-screen')).toBeVisible();checks.push('authenticated direct map URL/query survives refresh; Back returns to seeded Home')
 await preview.db.exec('DELETE FROM suizamente_private.suizamente_limites')
 const match=await call(preview.db,A,'crear_partida',{rival:B});await page.waitForLoadState('networkidle');await page.goto(preview.origin+'/suizamente/partida/'+match.id);await expect(page.locator('.sv-game-board')).toBeVisible();await page.waitForLoadState('networkidle');await page.reload();await expect(page.locator('.sv-game-board')).toBeVisible();assert.ok(page.url().endsWith('/partida/'+match.id));await expect(page.locator('.sv-login-screen,.sv-profile-screen')).toHaveCount(0);checks.push('reload stays in the same live match')
 // A marker for another identity cannot authorize access.
 const other=await browser.newContext({reducedMotion:'reduce'});await other.addInitScript(({session,B})=>{localStorage.setItem('sb-127-auth-token',JSON.stringify(session));sessionStorage.setItem('suizamente:cuenta-activa',B)},{session,B});const foreign=await other.newPage();await foreign.goto(preview.origin+'/suizamente/tienda');await expect(foreign.locator('.sv-login-screen')).toBeVisible();await expect.poll(()=>foreign.evaluate(()=>sessionStorage.getItem('suizamente:cuenta-activa'))).toBe(null);await other.close()
 // A new tab still requires an explicit choice; sign-out invalidates the old one.
 const fresh=await context.newPage();await fresh.goto(preview.origin+'/suizamente/tienda');await expect(fresh.locator('.sv-login-screen')).toBeVisible();await fresh.close()
 await preview.db.exec('DELETE FROM suizamente_private.suizamente_limites')
 await page.waitForLoadState('networkidle');await page.goto(preview.origin+'/suizamente/ajustes');await expect(page.getByRole('heading',{name:'Ajustes',exact:true})).toBeVisible();await page.getByRole('button',{name:'Cerrar sesión de Suizamente',exact:true}).click();await expect(page.locator('.sv-login-screen')).toBeVisible();assert.equal(await page.evaluate(()=>sessionStorage.getItem('suizamente:cuenta-activa')),null);await page.waitForLoadState('networkidle');await page.reload();await expect(page.locator('.sv-login-screen')).toBeVisible();checks.push('account marker is tab-scoped, checked against Supabase identity and removed on sign-out')
 const introContext=await browser.newContext({reducedMotion:'reduce'}),intro=await introContext.newPage();await intro.addInitScript(()=>sessionStorage.setItem('suizamente:apertura','1'));await intro.goto(preview.origin+'/suizamente');await intro.getByRole('button',{name:'Empezar',exact:true}).click();await intro.getByRole('button',{name:'Ahora no',exact:true}).click();await expect(intro.getByRole('img',{name:'Paso 3 de 5'})).toBeVisible();await intro.reload();await expect(intro.getByRole('img',{name:'Paso 3 de 5'})).toBeVisible();await intro.goBack();await expect(intro.getByRole('img',{name:'Paso 2 de 5'})).toBeVisible();await introContext.close();checks.push('welcome step survives reload and native Back returns to its previous step')
 assert.deepEqual(errors,[]);await writeFile(out+'/resultado.json',JSON.stringify({engine,checks,errors,unloadWarnings},null,2));console.log('Navigation '+engine+': '+checks.join('; ')+'.')
}catch(error){console.error(error.stack);await page?.screenshot({path:out+'/fallo.png',fullPage:true}).catch(()=>{});process.exitCode=1}finally{await browser?.close();await preview?.close()}
