// Visual fixtures only, isolated from production and from the full-match E2E.
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {chromium,expect as rawExpect} from '@playwright/test'
import assert from 'node:assert/strict'
import {startSuizamentePreview,testToken,testUser} from './lib/suizamente-v2-preview.mjs'
import {call,A,B,C} from './lib/suizamente-v2-test-db.mjs'
const expect=rawExpect.configure({timeout:20000}),out='output/suizamente-final/chromium',screens=[]
let preview,browser,page
try{
 await mkdir(out,{recursive:true});preview=await startSuizamentePreview(5282)
 browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']})
 const reference=await browser.newPage({reducedMotion:'reduce'})
 const guest=await browser.newContext({viewport:{width:390,height:900},reducedMotion:'reduce'})
 await guest.addInitScript(()=>sessionStorage.setItem('suizamente:apertura','1'));page=await guest.newPage()
 async function go(path){await preview.db.exec('DELETE FROM suizamente_private.suizamente_limites');await page.goto(preview.origin+'/suizamente/'+path);await page.waitForLoadState('networkidle')}
 async function capture(id,widths=[390,1440]){
  await reference.goto(preview.origin+'/suizamente/disenos/pantallas.html#'+id);await reference.addStyleTag({content:'.visor{display:none!important}'})
  const theme=await page.locator('html').getAttribute('data-suizamente-theme')
  for(const width of widths){
   await page.setViewportSize({width,height:900});await reference.setViewportSize({width,height:900})
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),id+' '+width)
   await page.evaluate(()=>document.documentElement.dataset.suizamenteTheme='clara');await page.screenshot({path:out+'/'+id+'-'+width+'.png',fullPage:true})
   await reference.locator('#p-'+id+' .marco').screenshot({path:out+'/referencia-'+id+'-'+width+'.png'})
   await page.evaluate(()=>document.documentElement.dataset.suizamenteTheme='oscura');await page.screenshot({path:out+'/oscuro-'+id+'-'+width+'.png',fullPage:true})
  }
  await page.evaluate(theme=>document.documentElement.dataset.suizamenteTheme=theme,theme);screens.push(id)
 }
 await go('primera-vez');await expect(page.getByRole('heading',{name:'El juego de preguntas de Suiza'})).toBeVisible()
 for(const [i,id] of ['OnbHola','OnbElige','OnbAprende','OnbReta','OnbEmpieza'].entries()){
  if(i)await page.getByRole('button',{name:i===1?'Empezar':'Siguiente',exact:true}).click()
  await capture(id)
 }
 for(const [path,id] of [['bienvenida','Main'],['como-se-juega','ComoSeJuega'],['entrar','Entrar'],['perfil/nuevo','CrearPerfil']]){await go(path);await capture(id)}
 const signed=await browser.newContext({viewport:{width:390,height:900},reducedMotion:'reduce'})
 await signed.addInitScript(({user,token})=>{localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user}));localStorage.setItem('suizamente:onboarding','2026-01-01');sessionStorage.setItem('suizamente:apertura','1')},{user:testUser(A,'Alex'),token:testToken(A)})
 page=await signed.newPage()
 await go('pregunta-del-dia');await expect(page.locator('.sv-options button').first()).toBeVisible();await capture('Pregunta')
 await page.locator('.sv-options button').first().click();await expect(page.getByRole('heading',{name:/¡Primer voto/})).toBeVisible();await capture('ResultadoPocos')
 await page.getByRole('button',{name:'📤 Compartir',exact:true}).last().click();await expect(page.getByRole('dialog')).toBeVisible();await capture('CompartirHoja');await page.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).click()
 const day=await call(preview.db,A,'dia')
 // A known sample for visual review; the E2E never fabricates votes.
 for(let i=0;i<24;i++)await preview.db.query("INSERT INTO suizamente_private.suizamente_votos(pregunta_id,jugador_id,opcion,pais,anos_suiza) VALUES($1,$2,0,'ES','1a3')",[day.id,'visual-'+i])
 await go('pregunta-del-dia');await capture('Resultado')
 await go('crea-preguntas');await capture('CreaPreguntas')
 await go('misiones');await capture('Misiones')
 await go('ranking?tab=amigos');await capture('RankingAmigos')
 await go('perfil');await page.getByRole('button',{name:'📤 Compartir',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await capture('Compartir');await page.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).click()
 const config=JSON.parse(await readFile('server/suizamente/data/juego.json','utf8')),cantons=config.mapa.regiones.flatMap(r=>r.cantones),last=cantons.at(-1)
 await preview.db.query("SELECT suizamente_private.v3_anotar($1,'fixture','visual-fondos',10000)",[A])
 for(const k of cantons)await preview.db.query('INSERT INTO suizamente_private.suizamente_mapa VALUES($1,1,$2,$3)',[A,k.id,config.mapa.nivelesPorCanton-(k.id===last.id?1:0)])
 await call(preview.db,A,'construir',{vuelta:1,canton:last.id,nivel:config.mapa.nivelesPorCanton-1,clave:crypto.randomUUID()})
 await go('mapa/vuelta?vuelta=1');await expect(page.getByRole('heading',{name:/¡Suiza completa!/})).toBeVisible();await capture('VueltaCompleta')
 await go('mapa');await capture('MapaOro');await page.getByRole('button',{name:/Ver Lucerna/}).click();await capture('MapaCanton')
 await page.getByRole('link',{name:'Así crece Lucerna ›'}).click();await expect(page.locator('.sv-map-levels canvas')).toHaveCount(4);await capture('MapaNiveles')
 for(const [path,id] of [['/','LatidoInicio'],['/perfil','LatidoPerfil']]){await page.goto(preview.origin+path);await page.waitForLoadState('networkidle');await capture(id)}
 const source=(await preview.db.query("SELECT payload FROM suizamente_private.suizamente_preguntas WHERE payload->>'tipo'='dilema' LIMIT 1")).rows[0].payload
 await call(preview.db,A,'proponer',{contenido:{...source,fuente:''}})
 const admin=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'})
 await admin.addInitScript(({user,token})=>{localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user}));sessionStorage.setItem('suizamente:apertura','1')},{user:testUser(C,'Caro'),token:testToken(C)})
 page=await admin.newPage();await go('admin');await capture('AdminResumen',[1440]);await capture('AdminMovilResumen',[390])
 await go('admin/propuestas');await capture('AdminMovilPropuestas',[390]);await page.locator('.sv-admin-proposal-card').first().click();await capture('AdminMovilPropuesta',[390]);await capture('AdminPropuestas',[1440])
 const opening=await browser.newContext({viewport:{width:390,height:900},reducedMotion:'reduce'})
 await opening.addInitScript(()=>{const original=setTimeout;window.setTimeout=(fn,ms,...args)=>original(fn,ms===700||ms===3000?60000:ms,...args)})
 page=await opening.newPage();await page.goto(preview.origin+'/suizamente');await expect(page.getByRole('button',{name:'Saltar apertura'})).toBeVisible();await capture('Apertura')
 await writeFile(out+'/pantallas-adicionales.json',JSON.stringify({screens,widths:[390,1440],themes:['clara','oscura'],visualFixturesOnly:true},null,2))
 console.log('Visual review: onboarding, entry/profile, daily question/results/privacy/share, community, map detail/levels and lap/gold paired at 390/1440 in both themes.')
}catch(e){await page?.screenshot({path:out+'/design-failure.png',fullPage:true}).catch(()=>{});console.error(e.message);process.exitCode=1}
finally{await browser?.close();await preview?.close()}
