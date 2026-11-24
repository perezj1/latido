import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium,webkit,expect as rawExpect} from '@playwright/test'
import {startSuizamentePreview,testToken,testUser} from './lib/suizamente-v2-preview.mjs'
import {call,A,B,C} from './lib/suizamente-v2-test-db.mjs'
const expect=rawExpect.configure({timeout:20000}),engine=process.argv.includes('--webkit')?'webkit':'chromium',out='output/suizamente-final/'+engine
let preview,browser,page
const errors=[]
try{
 await mkdir(out,{recursive:true});preview=await startSuizamentePreview(engine==='webkit'?5288:5287,{demo:true})
 browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,args:engine==='chromium'?['--enable-unsafe-swiftshader']:[]})
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'no-preference'})
 await context.addInitScript(({user,token})=>{
  localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user}));sessionStorage.setItem('suizamente:apertura','1')
 },{user:testUser(A,'Alex'),token:testToken(A)})
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
 async function go(path){await preview.db.exec('DELETE FROM suizamente_private.suizamente_limites');await page.goto(preview.origin+'/suizamente/'+path);await page.getByRole('button',{name:'Entrar con cuenta de Latido',exact:true}).click();await page.getByRole('button',{name:/A jugar/}).click();await page.waitForLoadState('networkidle')}
 async function nav(){const el=page.getByRole('navigation',{name:'Navegación principal'});await expect(el).toBeVisible();assert.equal(await el.count(),1);const r=await el.boundingBox();assert.ok(Math.abs(r.y+r.height-page.viewportSize().height)<2,'Navigation is fixed to viewport bottom')}
 async function capture(name){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');await page.screenshot({path:out+'/produccion-'+name+'.png',fullPage:true})}
 await go('');await nav();await expect(page.locator('.sv-home-map canvas')).toBeVisible();await capture('inicio-390')
 const home=page.locator('.sv-home-map canvas'),homeA=await home.screenshot();await page.waitForTimeout(250);assert.ok(!(await home.screenshot()).equals(homeA),'Home renders the same live model with moving life')
 await preview.db.exec("UPDATE suizamente_private.suizamente_jugadores SET ultimo_visto_en=clock_timestamp()-interval '1 day' WHERE jugador_id<>'"+A+"'")
 await go('nueva');await nav();const random=page.getByRole('button',{name:/Rival al azar/});await expect(random).toBeDisabled();await capture('nueva-sin-rival-390')
 assert.equal((await preview.db.query('SELECT count(*) n FROM suizamente_private.suizamente_partidas')).rows[0].n,0)
 await call(preview.db,B,'jugador');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(random).toBeEnabled()
 await page.getByRole('searchbox',{name:'Buscar jugadores por apodo'}).fill('Lu');await expect(page.locator('.sv-player-list').getByRole('button',{name:'▶ Jugar'})).toBeVisible()
 await capture('nueva-disponible-390');await random.click();await expect(page).toHaveURL(/partida\//);await nav()
 const mid=page.url().split('/').pop(),match=await call(preview.db,A,'partida',{id:mid});assert.equal(match.rival.id,B)
 await preview.db.query("UPDATE suizamente_private.suizamente_partidas SET reglas=jsonb_set(reglas,'{ruleta,casillas}','[\"idioma\"]') WHERE id=$1",[mid])
 await expect(page.locator('.sv-game-inventory button')).toHaveCount((await call(preview.db,A,'config')).comodines.length)
 const wheel=await page.locator('.sv-wheel').boundingBox();assert.ok(wheel.width>=350,'Large roulette at 390px')
 await capture('ruleta-390');await page.getByRole('button',{name:'Girar la ruleta',exact:true}).click();await expect(page.locator('.sv-question-card')).toBeVisible()
 await expect(page.getByRole('navigation',{name:'Navegación principal'})).toHaveCount(0)
 await page.screenshot({path:out+'/produccion-pregunta-sin-barra.png',fullPage:true})
 const state=await call(preview.db,A,'partida',{id:mid}),payload=(await preview.db.query('SELECT payload FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=$1 AND n=$2',[mid,state.pregunta.n])).rows[0].payload
 await page.locator('.sv-options button').nth(state.pregunta.opciones.findIndex(o=>o.indice===payload.correcta)).click();await nav()
 await go('mapa');await nav();await expect(page.locator('.sv-map-frame>.sv-world-map canvas')).toBeVisible()
 const card=page.getByRole('button',{name:/Ver Lucerna/});await expect(card.locator('canvas')).toBeVisible()
 await card.click();await expect(page.getByRole('button',{name:'← Toda Suiza',exact:true})).toBeVisible()
 await page.getByRole('button',{name:/Subir a nivel 1/}).click();await expect.poll(async()=>(await call(preview.db,A,'mapa')).niveles.LU).toBe(1)
 await expect(card.getByRole('img')).toHaveAttribute('aria-label',/nivel 1/)
 const miniA=await card.locator('canvas').screenshot();await page.waitForTimeout(300);assert.ok(!(await card.locator('canvas').screenshot()).equals(miniA),'The current canton model is animated')
 await capture('mapa-miniaturas-390')
 await page.getByRole('button',{name:'← Toda Suiza',exact:true}).click()
 for(const width of [320,1440]){
  await page.setViewportSize({width,height:844})
  for(const path of ['','nueva','mapa','tienda','album','amigos','menu','ajustes','perfil','misiones','ranking']){await go(path);await nav();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No overflow '+path+' '+width)}
  await go('nueva');await capture('nueva-'+width);await go('partida/'+mid+'?continuar=1');await nav();await capture('ruleta-'+width)
 }
 await page.setViewportSize({width:390,height:844});await go('ajustes');await page.getByRole('switch',{name:'Menos animaciones',exact:true}).check()
 await expect.poll(async()=>(await call(preview.db,A,'jugador')).jugador.ajustes.menosAnimaciones).toBe(true)
 await go('mapa');await page.getByRole('button',{name:/Ver Lucerna/}).click();const main=page.locator('.sv-map-frame>.sv-world-map canvas');await page.waitForTimeout(200)
 const still=await main.screenshot();await page.waitForTimeout(200);assert.ok((await main.screenshot()).equals(still),'Reduced motion keeps the map still')
 await page.emulateMedia({colorScheme:'dark'});assert.equal(await page.locator('html').getAttribute('data-suizamente-theme'),'clara');await capture('mapa-claro-reducido')
 assert.deepEqual(errors,[]);await writeFile(out+'/produccion.json',JSON.stringify({engine,checks:['fixed navigation except active questions','random disabled without real available player','server starts with real rival','search/invite/continue/start lobby','large wheel and actual inventory','live home 3D','animated current-level canton models','build updates main and miniature','320/390/1440','forced light/reduced motion']},null,2))
 console.log('Production browser '+engine+': mobile/desktop navigation, real matchmaking, lobby, roulette, home/canton 3D, construction and reduced motion passed.')
}catch(e){await page?.screenshot({path:out+'/produccion-fallo.png',fullPage:true}).catch(()=>{});console.error(e.message);process.exitCode=1}
finally{await browser?.close();await preview?.close()}
