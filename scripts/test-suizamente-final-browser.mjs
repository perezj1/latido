import assert from 'node:assert/strict'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {chromium,webkit,expect as rawExpect} from '@playwright/test'
import {startSuizamentePreview,testToken,testUser} from './lib/suizamente-v2-preview.mjs'
import {call,A,B} from './lib/suizamente-v2-test-db.mjs'

const expect=rawExpect.configure({timeout:15000}),engine=process.argv.includes('--webkit')?'webkit':'chromium',out='output/suizamente-final/'+engine
let preview,browser,lastPage,mid,reference
const errors=[],review=[]
try{
 await mkdir(out,{recursive:true});preview=await startSuizamentePreview(5280)
 browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,args:engine==='chromium'?['--enable-unsafe-swiftshader']:[]})
 const config=JSON.parse(await readFile('server/suizamente/data/juego.json','utf8'))
 async function signed(actor,name,width){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'})
  await context.addInitScript(({user,token})=>{
   localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user}))
   localStorage.setItem('suizamente:onboarding','2026-01-01');sessionStorage.setItem('suizamente:apertura','1')
   window.__nativePermissions=0
   if('Notification'in window)Notification.requestPermission=async()=>{window.__nativePermissions++;return 'denied'}
  },{user:testUser(actor,name),token:testToken(actor)})
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return page
 }
 // UI is accelerated in QA. Reset only the minute throttle, never votes, stamps or rewards.
 async function budget(){await preview.db.exec('DELETE FROM suizamente_private.suizamente_limites')}
 async function go(page,path){lastPage=page;await budget();await page.goto(preview.origin+'/suizamente/'+path);await page.waitForLoadState('networkidle')}
 async function view(actor){await budget();return call(preview.db,actor,'partida',{id:mid})}
 async function capture(page,name,design){
  lastPage=page
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow '+name)
  assert.ok(!/[\p{Regional_Indicator}\u{1F3F3}\u{1F3F4}\u{1F6A9}]/u.test(await page.locator('.sv-root').innerText()),'No flags '+name)
  await page.screenshot({path:out+'/'+name+'.png',fullPage:true})
  if(design){
   await reference.setViewportSize(page.viewportSize())
   await reference.goto(preview.origin+'/suizamente/disenos/pantallas.html#'+design,{waitUntil:'domcontentloaded'})
   await reference.addStyleTag({content:'.visor{display:none!important}'});await reference.locator('#p-'+design+' .marco').screenshot({path:out+'/referencia-'+name+'.png'})
   review.push({screen:design,app:page.url(),width:page.viewportSize().width,image:name+'.png',reference:'referencia-'+name+'.png'})
   const originalSize=page.viewportSize(),originalTheme=await page.locator('html').getAttribute('data-suizamente-theme')
   for(const width of [390,1440]){
    await page.setViewportSize({width,height:900});await page.evaluate(()=>{document.documentElement.dataset.suizamenteTheme='clara'})
    await page.screenshot({path:out+'/'+design+'-'+width+'.png',fullPage:true})
    await reference.setViewportSize({width,height:900});await reference.locator('#p-'+design+' .marco').screenshot({path:out+'/referencia-'+design+'-'+width+'.png'})
    await page.evaluate(()=>{document.documentElement.dataset.suizamenteTheme='oscura'})
    await page.screenshot({path:out+'/oscuro-'+design+'-'+width+'.png',fullPage:true})
   }
   await page.evaluate(theme=>{document.documentElement.dataset.suizamenteTheme=theme},originalTheme);await page.setViewportSize(originalSize)
  }
 }
 const a=await signed(A,'Alex',390),b=await signed(B,'Lu',1440)
 reference=await browser.newPage({viewport:{width:390,height:900},reducedMotion:'reduce'})
 await reference.addInitScript(()=>{Math.random=()=>.05})
 // Play an actual reference turn alongside the app before comparing the screens.
 await reference.goto(preview.origin+'/suizamente/disenos/juego.html')
 await reference.getByText('Saltar',{exact:true}).click();await reference.locator('[data-a=abrir]').first().click()
 await reference.locator('[data-a=girar]').click();await reference.locator('[data-a=responder]').first().waitFor({timeout:20000})
 await reference.locator('[data-a=responder]').first().click();await reference.screenshot({path:out+'/prototipo-turno.png',fullPage:true})
 await go(a,'');await expect(a.getByRole('heading',{name:'Hola, Alex'})).toBeVisible();await capture(a,'Inicio-390','Inicio')
 const manifest=await a.evaluate(async()=>{const link=document.querySelector('link[rel=manifest]');return (await fetch(link.href)).json()})
 assert.equal(manifest.id,'/suizamente');assert.equal(manifest.background_color,'#FFFFFF');assert.equal(manifest.display,'standalone')
 for(const icon of manifest.icons)assert.equal((await a.request.get(preview.origin+icon.src)).status(),200)
 await go(b,'mapa');await b.getByRole('button',{name:/Ver Lucerna/}).click()
 await capture(b,'MapaCanton-1440','MapaCanton')
 await expect(b.getByRole('button',{name:/Subir a nivel 1/})).toBeVisible()
 assert.equal((await call(preview.db,B,'mapa')).niveles.LU,undefined,'Selecting never spends coins')
 await b.getByRole('button',{name:/Subir a nivel 1/}).click();await expect.poll(async()=>(await call(preview.db,B,'mapa')).niveles.LU).toBe(1)
 await capture(b,'Mapa-1440','Mapa')
 await go(a,'tienda');await a.getByRole('button',{name:/Regalo diario/}).click()
 await expect(a.getByRole('button',{name:/Vuelve mañana/})).toBeDisabled()
 await a.getByRole('button',{name:/Comprar \+15 s por/}).click();await expect(a.getByRole('status').filter({hasText:'Comprado'})).toBeVisible()
 let match=await call(preview.db,A,'crear_partida',{rival:B});mid=match.id
 // Force the server's RNG branches for a reproducible complete game, retaining real question selection and validation.
 async function wheel(kind){await budget();await preview.db.query("UPDATE suizamente_private.suizamente_partidas SET reglas=jsonb_set(jsonb_set(reglas,'{ruleta,casillas}',$2::jsonb),'{asaltos,probabilidadPorAcierto}','1') WHERE id=$1",[mid,JSON.stringify([kind])])}
 async function enter(page){await go(page,'partida/'+mid+'?continuar=1')}
 async function settleHandoff(page){
  await page.waitForLoadState('networkidle')
  if(await page.getByRole('button',{name:'Volver a Inicio',exact:true}).isVisible())await page.getByRole('button',{name:'Volver a Inicio',exact:true}).click()
  await page.waitForLoadState('networkidle')
  if(await page.getByRole('button',{name:'Ahora no',exact:true}).isVisible()){
   assert.equal(await page.evaluate(()=>window.__nativePermissions),0,'No native permission before consent')
   await page.screenshot({path:out+'/permiso-propio.png',fullPage:true});await page.getByRole('button',{name:'Ahora no',exact:true}).click()
  }
 }
 async function continueResult(page){await page.locator('.sv-footer button.sv-button').last().click();await settleHandoff(page)}
 async function answer(page,actor,right=true){
  lastPage=page;await expect(page.locator('.sv-question-card')).toBeVisible()
  const m=await view(actor)
  assert.ok(m.pregunta);assert.equal(m.pregunta.correcta,undefined);assert.equal(m.pregunta.dato,undefined)
  const q=(await preview.db.query('SELECT payload,orden FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=$1 AND n=$2',[mid,m.pregunta.n])).rows[0]
  const chosen=right?q.payload.correcta:(q.payload.correcta+1)%q.payload.opciones.length
  const index=m.pregunta.opciones.findIndex(o=>o.indice===chosen)
  await page.locator('.sv-options button').nth(index).click()
  await expect(page.getByRole('heading',{name:right?'¡Correcto!':'¡Uy! No era esa',exact:true})).toBeVisible()
  return view(actor)
 }
 const seenScreens=new Set()
 async function spinNormal(page,actor,right){await enter(page);await wheel('idioma');if(!seenScreens.has('Partida')){seenScreens.add('Partida');await capture(page,'Partida-390','Partida')}await page.getByRole('button',{name:'🎡 ¡Girar!',exact:true}).click();if(!seenScreens.has('PartidaPregunta')){seenScreens.add('PartidaPregunta');await expect(page.locator('.sv-question-card')).toBeVisible();await capture(page,'PartidaPregunta-390','PartidaPregunta')}await answer(page,actor,right)}
 async function loseTurn(page,actor){await spinNormal(page,actor,false);if(!seenScreens.has('PartidaFallo')){seenScreens.add('PartidaFallo');await capture(page,'PartidaFallo-390','PartidaFallo')}await continueResult(page)}
 async function seal(page,actor,category){
  await enter(page);await wheel('sello');await page.getByRole('button',{name:'🎡 ¡Girar!',exact:true}).click()
  if(!seenScreens.has('ElegirSello')){seenScreens.add('ElegirSello');await capture(page,'ElegirSello-390','ElegirSello')}
  await page.locator('.sv-stamp-choice').getByRole('button',{name:new RegExp(category.nombre)}).click();await answer(page,actor,true);await continueResult(page)
 }
 await spinNormal(a,A,true)
 await capture(a,'PartidaAcierto-390','PartidaAcierto')
 await a.getByRole('button',{name:'⚠️ Reportar',exact:true}).click()
 await expect(a.getByRole('dialog',{name:'¿Qué está mal?'})).toBeVisible()
 await a.getByRole('textbox',{name:'Qué está mal'}).fill('Revisar este dato con su fuente original.')
 await a.getByRole('button',{name:'Enviar aviso',exact:true}).click();await expect(a.getByRole('status').filter({hasText:'Gracias por avisar'})).toBeVisible()
 const offered=(await view(A)).asalto
 assert.ok(offered?.id)
 await a.getByRole('link',{name:'⚔️ ¡Asalto disponible!',exact:true}).click();await expect(a.getByRole('heading',{name:'¡Asalto!',exact:true})).toBeVisible();await capture(a,'Asalto-390','Asalto');await a.getByRole('button',{name:'⚔️ ¡A por ello!',exact:true}).click()
 await expect(a.locator('.sv-question-card')).toBeVisible()
 const raid=(await call(preview.db,A,'asalto',{id:offered.id})),rawRaid=(await preview.db.query('SELECT payload FROM suizamente_private.suizamente_asaltos WHERE id=$1',[offered.id])).rows[0].payload
 assert.equal(raid.pregunta.correcta,undefined);assert.equal(raid.pregunta.dato,undefined)
 await a.locator('.sv-options button').nth(raid.pregunta.opciones.findIndex(o=>o.indice===rawRaid.correcta)).click()
 await a.getByRole('button',{name:'Ver el asalto',exact:true}).click();await expect(a.getByRole('heading',{name:'¡Asalto conseguido!'})).toBeVisible()
 await capture(a,'AsaltoHecho-390','AsaltoHecho');await a.getByRole('link',{name:'▶ Seguir la partida',exact:true}).click()
 assert.equal((await call(preview.db,B,'mapa')).niveles.LU,0)
 await loseTurn(a,A);await seal(b,B,config.categorias.find(c=>c.id==='cultura'))
 if((await view(B)).teToca)await loseTurn(b,B)
 await seal(a,A,config.categorias.find(c=>c.id==='idioma'))
 if(!(await view(A)).teToca)await loseTurn(b,B)
 await enter(a);await wheel('sello');await a.getByRole('button',{name:'🎡 ¡Girar!',exact:true}).click()
 await a.getByRole('button',{name:/⚔️ Duelo de sellos/}).click();await capture(a,'DueloPreparar-390','DueloPreparar')
 await a.getByRole('button',{name:'⚔️ ¡Al duelo!',exact:true}).click()
 for(let i=0;i<config.duelo.preguntas;i++){await answer(a,A,true);await continueResult(a)}
 await enter(b)
 if(await b.getByRole('button',{name:'⚔️ Seguir el duelo',exact:true}).isVisible())await b.getByRole('button',{name:'⚔️ Seguir el duelo',exact:true}).click()
 for(let i=0;i<config.duelo.preguntas;i++){await answer(b,B,false);await continueResult(b)}
 await expect(b.getByRole('heading',{name:'Duelo perdido',exact:true})).toBeVisible();await capture(b,'DueloResultado-1440','DueloResultado')
 await b.getByRole('button',{name:'▶ Seguir la partida',exact:true}).click()
 await enter(a);await expect(a.getByRole('heading',{name:'¡Duelo ganado!',exact:true})).toBeVisible();await a.getByRole('button',{name:'▶ Seguir la partida',exact:true}).click()
 assert.ok((await view(A)).tusSellos.includes('cultura'))
 console.log('E2E: two accounts, normal answers, report, handoff, raid and full two-person duel passed.')
 let guard=0
 while((match=await view(A)).tusSellos.length<config.partida.sellosParaGanar){
  assert.ok(++guard<20,'Match advances toward six stamps')
  if(!match.teToca){await loseTurn(b,B);continue}
  await seal(a,A,config.categorias.find(c=>!match.tusSellos.includes(c.id)))
 }
 await expect(a.getByRole('heading',{name:'¡Victoria!',exact:true})).toBeVisible();await capture(a,'FinPartida-390','FinPartida')
 match=await view(A);assert.equal(match.tusSellos.length,config.partida.sellosParaGanar);assert.ok(match.cofre.id)
 await a.getByRole('link',{name:'🎁 Abrir el cofre',exact:true}).click();await expect(a.getByRole('heading',{name:'Cofre de victoria'})).toBeVisible();await capture(a,'Cofre-390','Cofre')
 await a.getByRole('button',{name:'🃏 Abrir sobre de cartas',exact:true}).click()
 await expect(a.getByRole('heading',{name:'🃏 Sobre de cartas',exact:true})).toBeVisible()
 const packId=new URL(a.url()).pathname.split('/').at(-1),pack=await call(preview.db,A,'sobre',{id:packId})
 assert.equal(pack.cartas.length,0)
 for(let i=0;i<pack.total;i++)await a.getByRole('button',{name:'Girar carta '+(i+1),exact:true}).click()
 await capture(a,'Sobre-390','Sobre')
 assert.equal((await call(preview.db,A,'sobre',{id:packId})).cartas.length,pack.total)
 await go(a,'mapa');await a.getByRole('button',{name:/Ver Lucerna/}).click();await a.getByRole('button',{name:/Subir a nivel 1/}).click()
 await expect.poll(async()=>(await call(preview.db,A,'mapa')).niveles.LU).toBe(1)
 await capture(a,'Mapa-390','Mapa')
 // Lose a purchase response after the server commits; retry through the real UI.
 await go(a,'tienda');const balance=(await call(preview.db,A,'jugador')).jugador.monedas
 let dropped=false
 await a.route('**/api/suizamente/tienda/comprar',async route=>{if(!dropped){dropped=true;await route.fetch();await route.abort()}else await route.continue()})
 await a.getByRole('button',{name:/Comprar \+15 s por/}).click();await expect(a.getByRole('alert').first()).toBeVisible()
 await a.getByRole('button',{name:/Comprar \+15 s por/}).click();await expect(a.getByRole('status').filter({hasText:'Comprado'})).toBeVisible()
 assert.equal(balance-(await call(preview.db,A,'jugador')).jugador.monedas,config.tienda.comodines.tiempo)
 await a.unroute('**/api/suizamente/tienda/comprar')
 console.log('E2E: complete six-stamp win, chest, pack, map construction, shop and interrupted-purchase recovery passed.')
 for(const width of [390,1440]){
  await a.setViewportSize({width,height:900})
  for(const [path,screen] of [['','Inicio'],['nueva','NuevaPartida'],['mapa','Mapa'],['mapa/ayuda','MapaAyuda'],['album','Album'],['tienda','Tienda'],['amigos','Amigos'],['ranking','Ranking'],['perfil','Perfil'],['logros','Logros'],['menu','Menu'],['misiones','Misiones'],['libreta','Libreta'],['proponer','Proponer'],['ajustes','Ajustes']]){
   await go(a,path);assert.equal(await a.locator('.sv-error').count(),0,path);await capture(a,screen+'-'+width,screen)
  }
 }
 await go(a,'ajustes');await a.getByRole('combobox',{name:'Apariencia'}).selectOption('oscura');await expect(a.locator('html')).toHaveAttribute('data-suizamente-theme','oscura')
 await a.getByRole('switch',{name:'Sonidos',exact:true}).uncheck();await a.getByRole('switch',{name:'Vibración',exact:true}).uncheck();await a.getByRole('switch',{name:'Menos animaciones',exact:true}).check()
 for(const path of ['mapa','album','tienda','ranking','misiones','perfil','ajustes']){
  await go(a,path);await capture(a,'oscuro-'+path)
  assert.equal(await a.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length),0,'Reduced motion '+path)
 }
 // Reconnect after a question expired on the server: never pause or trust browser time.
 await budget();const reconnect=await call(preview.db,A,'crear_partida',{rival:B});mid=reconnect.id
 await spinNormal(a,A,true);await continueResult(a);await enter(a);await wheel('idioma');await a.getByRole('button',{name:'🎡 ¡Girar!',exact:true}).click();await expect(a.locator('.sv-question-card')).toBeVisible()
 await a.context().setOffline(true);await expect(a.getByRole('status').filter({hasText:'Sin conexión'}).first()).toBeVisible()
 await preview.db.query("UPDATE suizamente_private.suizamente_partida_preguntas SET vence_en=clock_timestamp()-interval '10 seconds' WHERE partida_id=$1 AND respondida_en IS NULL",[mid])
 await a.context().setOffline(false);await expect(a.getByRole('heading',{name:'⏰ ¡Se acabó el tiempo!',exact:true})).toBeVisible()
 assert.equal((await view(A)).resultado.ok,false)
 assert.deepEqual(errors,[])
 await writeFile(out+'/recorrido.json',JSON.stringify({engine,reviews:review,completeMatch:match.id,checks:['two-account complete game','duel','raid','chest','pack','purchase','build','lost purchase response','offline server expiry','390/1440 design pairs','dark/reduced motion','manifest']},null,2))
 console.log('Final browser: design pairs, dark/reduced motion, install metadata and offline server expiry passed.')
}catch(e){if(lastPage)await lastPage.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});console.error('Final browser:',e);if(lastPage)console.error((await lastPage.locator('body').innerText()).slice(-3500));process.exitCode=1}
finally{await browser?.close();await preview?.close()}
