import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium,webkit,expect as rawExpect} from '@playwright/test'
import {startSuizamentePreview,testToken,testUser} from './lib/suizamente-v2-preview.mjs'
import {A,call} from './lib/suizamente-v2-test-db.mjs'
const expect=rawExpect.configure({timeout:20000}),engine=process.argv.includes('--webkit')?'webkit':'chromium',out='output/suizamente-final/'+engine
let preview,browser,page
const errors=[],reviews=[]
try{
 await mkdir(out,{recursive:true});preview=await startSuizamentePreview(engine==='webkit'?5291:5290,{demo:true})
 browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,args:engine==='chromium'?['--enable-unsafe-swiftshader']:[]})
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'})
 // A leftover token for a different Supabase project must never expose a cached user.
 await context.addInitScript(()=>localStorage.setItem('sb-other-project-auth-token',JSON.stringify({access_token:'unrelated',user:{id:'foreign-user'},expires_at:Math.floor(Date.now()/1000)+3600})))
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));const requests=[];page.on('request',r=>requests.push(r.url()))
 const initialGuests=(await preview.db.query('SELECT count(*) n FROM suizamente_private.suizamente_sesiones_invitado')).rows[0].n
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:844})
  for(const path of ['','nueva','perfil/nuevo','mapa','pregunta-del-dia','invitar/abcdefgh']){
   await page.goto(preview.origin+'/suizamente/'+path);await page.waitForLoadState('networkidle')
   await expect(page.locator('.sv-login-screen')).toBeVisible();await expect(page.getByText('Jugar sin cuenta',{exact:true})).toHaveCount(0)
   assert.deepEqual(await page.locator('.sv-login-button b').allTextContents(),['Iniciar sesión con Latido','Continuar con Google','Entrar con email'])
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
  }
  await page.screenshot({path:out+'/acceso-cuenta-'+width+'.png',fullPage:true})
 }
 assert.ok(!requests.some(u=>/get_my_account_access|lc_business_invitation|app_notifications|\/api\/suizamente\/(jugador|partidas|mapa)/.test(u)),'Logged-out entry makes no private requests, including with foreign cached tokens')
 assert.equal((await preview.db.query('SELECT count(*) n FROM suizamente_private.suizamente_sesiones_invitado')).rows[0].n,initialGuests,'No guest player/session is created by the login screen')
 await page.getByRole('link',{name:'Entrar con email',exact:true}).click();await expect(page.getByRole('textbox',{name:/^Email/})).toBeVisible();assert.ok(page.url().includes('metodo=email'));await expect(page.getByRole('button',{name:/Google/})).toHaveCount(0)
 await page.goto(preview.origin+'/suizamente/invitar/abcdefgh')
 let google
 await page.route('**/mock-supabase/auth/v1/authorize?**',route=>{google=new URL(route.request().url());return route.fulfill({contentType:'text/html',body:'<h1>Proveedor de acceso</h1>'})})
 await page.getByRole('button',{name:'Continuar con Google',exact:true}).click();await expect.poll(()=>google?.searchParams.get('provider')).toBe('google')
 const callback=new URL(google.searchParams.get('redirect_to'));assert.equal(callback.pathname,'/auth/callback');assert.equal(callback.search,'');assert.equal(await page.evaluate(()=>sessionStorage.getItem('suizamente:auth-destino')),'/suizamente/invitar/abcdefgh')
 await context.close()
 const signed=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'})
 await signed.addInitScript(({user,token})=>{localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user}));sessionStorage.setItem('suizamente:apertura','1')},{user:testUser(A,'Alex'),token:testToken(A)})
 page=await signed.newPage();page.on('pageerror',e=>errors.push(e.message))
 await call(preview.db,A,'guardar_jugador',{apodo:'Apodo de veinte abc',color:'menta',pais:'ES',canton:'ZH',anos_suiza:'1a3',ajustes:{}})
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:844});await page.goto(preview.origin+'/suizamente/nueva');await page.waitForLoadState('networkidle')
  const filter=page.getByRole('combobox',{name:'Filtrar partidas'})
  for(const value of ['todas','turno','rival']){
   await filter.selectOption(value)
   const result=await page.evaluate(()=>{const el=document.querySelector('.sv-lobby-filter select'),s=getComputedStyle(el),c=document.createElement('canvas').getContext('2d');c.font=s.font;return {text:el.selectedOptions[0].text,width:c.measureText(el.selectedOptions[0].text).width,space:el.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight),overflow:document.documentElement.scrollWidth>innerWidth+1}})
   assert.ok(result.width<=result.space,'Filter text fits '+JSON.stringify(result));assert.equal(result.overflow,false);reviews.push({viewport:width,...result})
  }
  await page.screenshot({path:out+'/filtro-textos-'+width+'.png',fullPage:true})
 }
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.documentElement.style.fontSize='200%');await page.screenshot({path:out+'/filtro-textos-ampliados.png',fullPage:true})
 assert.deepEqual(errors,[]);await writeFile(out+'/acceso-cuenta.json',JSON.stringify({engine,reviews,errors},null,2))
 console.log('Account entry '+engine+': three methods, deep-link gate, no anonymous/private requests, foreign token ignored, email/Google destination and filter text at 320/390/1440 passed.')
}catch(e){await page?.screenshot({path:out+'/acceso-cuenta-fallo.png',fullPage:true}).catch(()=>{});console.error(e.message);process.exitCode=1}
finally{await browser?.close();await preview?.close()}
