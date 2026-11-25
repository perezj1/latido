import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium,webkit,expect as rawExpect} from '@playwright/test'
import {startSuizamentePreview,testToken,testUser} from './lib/suizamente-v2-preview.mjs'
import {A,B,call} from './lib/suizamente-v2-test-db.mjs'
const expect=rawExpect.configure({timeout:20000}),engine=process.argv.includes('--webkit')?'webkit':'chromium',out='output/entrada-perfil/'+engine
let preview,browser,page
const errors=[];let phase='entry'
try{
 await mkdir(out,{recursive:true});preview=await startSuizamentePreview(engine==='webkit'?5297:5296)
 browser=await(engine==='webkit'?webkit:chromium).launch({headless:true})
 const user=testUser(A,'Alex'),session={access_token:testToken(A),refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user}
 const ctx=await browser.newContext({viewport:{width:390,height:844},colorScheme:'dark',reducedMotion:'reduce'})
 await ctx.addInitScript(session=>{if(!sessionStorage.getItem('qa-session-seeded')){localStorage.setItem('sb-127-auth-token',JSON.stringify(session));localStorage.setItem('suizamente:ajustes',JSON.stringify({apariencia:'oscura',avisos:false,onboarding:'foreign-account',foto_url:'data:image/jpeg;base64,'+'a'.repeat(5000)}));sessionStorage.setItem('suizamente:apertura','1');sessionStorage.setItem('qa-session-seeded','1')}},session)
 page=await ctx.newPage();page.on('pageerror',e=>{errors.push(e.message);console.error('Browser error during '+phase+': '+e.stack)});const requests=[];let latidoWrites=0;page.on('request',r=>{requests.push(r.url());if(r.url().includes('/rest/v1/profiles')&&r.method()!=='GET')latidoWrites++})
 await page.route('**/mock-supabase/rest/v1/profiles?**',r=>r.fulfill({json:{id:A,name:'Alex de Latido',avatar_url:'https://photos.suizamente.test/latido.jpg',interests:[]}}))
 await page.route('https://photos.suizamente.test/**',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#03AA98"/></svg>'}))
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:844});await page.goto(preview.origin+'/suizamente');await expect(page.locator('.sv-home-screen')).toBeVisible();await expect(page.locator('.sv-login-screen')).toHaveCount(0)
  assert.equal(await page.locator('html').getAttribute('data-suizamente-theme'),'clara');assert.equal(await page.locator('html').getAttribute('data-theme'),'light')
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:out+'/entrada-'+width+'.png',fullPage:true})
 }
 // A new game player inherits the Latido identity only after choosing it.
 await preview.db.query('DELETE FROM suizamente_private.suizamente_jugadores WHERE jugador_id=$1',[A])
 await page.goto(preview.origin+'/suizamente')
 await page.getByRole('button',{name:'Saltar',exact:true}).click();await page.getByRole('button',{name:'Omitir',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Tu perfil',exact:true})).toBeVisible();await expect(page.getByRole('textbox',{name:'Tu apodo',exact:true})).toHaveValue('Alex de Latido');await expect(page.getByText('Perfil reconocido de Latido',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Usar otro perfil',exact:true})).toBeVisible()
 await expect(page.locator('.sv-profile-avatar img')).toHaveAttribute('src','https://photos.suizamente.test/latido.jpg')
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:out+'/perfil-'+width+'.png',fullPage:true})}
 await page.setViewportSize({width:390,height:844})
 const input=page.locator('input[type=file]'),camera=page.getByRole('button',{name:'Elegir o cambiar foto de perfil'})
 const chooser=page.waitForEvent('filechooser');await camera.click();await chooser
 await input.setInputFiles({name:'invalido.txt',mimeType:'text/plain',buffer:Buffer.from('no photo')});await expect(page.getByRole('alert')).toContainText('Elige una foto')
 const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=24;const x=c.getContext('2d');x.fillStyle='#4A76EF';x.fillRect(0,0,24,24);return c.toDataURL('image/png').split(',')[1]})
 await input.setInputFiles({name:'foto.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});await expect(page.locator('.sv-profile-avatar img')).toHaveAttribute('src',/^data:image\/jpeg/)
 let uploaded
 await page.route('**/mock-supabase/storage/v1/object/suizamente-avatars/**',async r=>{uploaded=r.request();await r.fulfill({json:{Key:'suizamente-avatars/photo.jpg',Id:'qa'}})})
 phase='save photo';await page.getByRole('button',{name:/A jugar/}).click();await expect(page).toHaveURL(preview.origin+'/suizamente/nueva');await page.waitForLoadState('networkidle')
 const player=(await call(preview.db,A,'jugador')).jugador
 assert.equal(player.apodo,'Alex de Latido');assert.equal(player.ajustes.apariencia,'clara');assert.equal(player.ajustes.avisos.turnos,false);assert.ok(player.ajustes.foto_url.includes('/suizamente-avatars/'+A+'/'))
 assert.ok(uploaded.url().includes('/suizamente-avatars/'+A+'/'));assert.ok(uploaded.postDataBuffer().includes(Buffer.from('Content-Type: image/jpeg')));assert.ok(uploaded.postDataBuffer().length<200000)
 assert.equal(latidoWrites,0,'Profile/photo editing never writes to Latido profiles')
 phase='settings';await page.goto(preview.origin+'/suizamente/ajustes');await expect(page.locator('.sv-login-screen')).toHaveCount(0)
 await expect(page.getByRole('heading',{name:'Ajustes',exact:true})).toBeVisible();await expect(page.getByRole('combobox',{name:'Apariencia'})).toHaveCount(0);assert.equal(await page.locator('html').getAttribute('data-suizamente-theme'),'clara')
 await page.waitForLoadState('networkidle');phase='switch profile';await page.goto(preview.origin+'/suizamente/perfil/nuevo');await expect(page.getByRole('button',{name:'Usar otro perfil',exact:true})).toBeVisible()
 await page.setViewportSize({width:375,height:667});await page.getByRole('button',{name:'Usar otro perfil',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:out+'/usar-otro-perfil-375.png',fullPage:true})
 await page.getByRole('textbox',{name:'Tu apodo',exact:true}).fill('');await page.getByRole('button',{name:'Usar otro perfil',exact:true}).click();await expect(page).toHaveURL(preview.origin+'/suizamente/bienvenida');await expect(page.locator('.sv-login-screen')).toBeVisible()
 assert.deepEqual(await page.locator('.sv-login-button b').allTextContents(),['Crear cuenta gratis','Ya tengo cuenta','Entrar con Google','Conectar con tu cuenta de Latido']);assert.equal(await page.evaluate(()=>localStorage.getItem('suizamente:bienvenida-pendiente')),null)
 await page.reload();await expect(page.locator('.sv-login-screen')).toBeVisible();assert.equal((await call(preview.db,A,'jugador')).jugador.ajustes.foto_url,player.ajustes.foto_url,'Switching preserves the first account')
 await page.unroute('**/mock-supabase/rest/v1/profiles?**');await page.route('**/mock-supabase/auth/v1/token?grant_type=password',r=>r.fulfill({json:{access_token:testToken(B),refresh_token:'test-refresh',expires_in:86400,token_type:'bearer',user:testUser(B,'Lu')}}))
 await page.getByRole('link',{name:'Ya tengo cuenta',exact:true}).click();await page.getByRole('textbox',{name:/^Email/}).fill('lu@suizamente.test');await page.getByLabel('Contraseña',{exact:false}).first().fill('local-test-password');await page.getByRole('button',{name:'Entrar →',exact:true}).click();await expect(page.locator('.sv-home-screen')).toBeVisible();await page.waitForLoadState('networkidle')
 await page.goto(preview.origin+'/suizamente/perfil/editar');await expect(page.getByRole('textbox',{name:'Tu apodo',exact:true})).toHaveValue('Lu');await expect(page.locator('.sv-profile-avatar img')).toHaveCount(0);await page.waitForLoadState('networkidle');await page.reload();await expect(page.getByRole('textbox',{name:'Tu apodo',exact:true})).toHaveValue('Lu');await page.waitForLoadState('networkidle')
 phase='closing first context';await ctx.close();phase='SSO'
 // A Latido account is authenticated within Suizamente, with no external window.
 const sso=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'})
 page=await sso.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(preview.origin+'/suizamente/entrar');await page.getByRole('button',{name:'Conectar con tu cuenta de Latido',exact:true}).click();await expect(page.getByRole('textbox',{name:/^Email/})).toBeVisible();assert.ok(page.url().startsWith(preview.origin+'/auth?'));assert.equal(sso.pages().length,1)
 assert.deepEqual(errors,[]);await writeFile(out+'/resultado.json',JSON.stringify({engine,checks:['persistent cached session restored','forced light with stored/system dark','legacy boolean notifications and foreign settings metadata repaired','email/create remain selectable','Latido login within the app','name/avatar and recognized profile label from Latido','camera picker and invalid file','JPEG resize and own bucket persistence','A jugar enters game','Use another profile signs out, clears pending welcome, survives reload and preserves account A','Account B logs in without account A name/photo and persists on reload','new tabs keep the authenticated account','no appearance selector'],errors},null,2))
 console.log('Entry/profile '+engine+': legacy preferences, recognized Latido profile, save/play, switch account and reload isolation, camera/upload and mobile/desktop passed.')
}catch(e){await page?.screenshot({path:out+'/fallo.png',fullPage:true}).catch(()=>{});console.error(e.stack);process.exitCode=1}
finally{await browser?.close();await preview?.close()}
