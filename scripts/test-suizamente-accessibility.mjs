import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium,webkit,expect as rawExpect} from '@playwright/test'
import {startSuizamentePreview,testToken,testUser} from './lib/suizamente-v2-preview.mjs'
import {call,A,B} from './lib/suizamente-v2-test-db.mjs'

const expect=rawExpect.configure({timeout:20000}),engine=process.argv.includes('--webkit')?'webkit':'chromium',out='output/suizamente-final/'+engine
let preview,browser,page
const errors=[],audit=[]
try{
 await mkdir(out,{recursive:true});preview=await startSuizamentePreview(5281)
 browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,args:engine==='chromium'?['--enable-unsafe-swiftshader']:[]})
 const context=await browser.newContext({viewport:{width:390,height:900},reducedMotion:'no-preference',colorScheme:'light'})
 async function identity(ctx){await ctx.addInitScript(({user,token})=>{
  localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user}))
  localStorage.setItem('suizamente:onboarding','2026-01-01');sessionStorage.setItem('suizamente:apertura','1')
 },{user:testUser(A,'Alex'),token:testToken(A)})}
 await identity(context);page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
 async function go(path){if(page.url().startsWith(preview.origin))await page.waitForLoadState('networkidle');await preview.db.exec('DELETE FROM suizamente_private.suizamente_limites');await page.goto(preview.origin+'/suizamente/'+path);await page.waitForLoadState('networkidle')}
 async function review(path){
  const result=await page.evaluate(()=>{
   const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width&&r.height&&s.visibility!=='hidden'&&s.display!=='none'}
   const targets=[...document.querySelectorAll('.sv-root button,.sv-root a,.sv-root input,.sv-root select,.sv-sheet button')].filter(visible).map(el=>{
    const label=el.labels?.[0],r=(label||el).getBoundingClientRect();return {text:el.getAttribute('aria-label')||el.textContent.trim()||el.type,w:r.width,h:r.height}
   }).filter(r=>r.w<43.9||r.h<43.9)
   const rgb=s=>(s.match(/[\d.]+/g)||[]).map(Number),blend=(a,b)=>a.slice(0,3).map((v,i)=>v*(a[3]??1)+b[i]*(1-(a[3]??1)))
   function background(el){const s=getComputedStyle(el),c=rgb(s.backgroundColor);return blend(c,el.parentElement?background(el.parentElement):[255,255,255])}
   const luminance=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0)
   const contrast=[...document.querySelectorAll('.sv-root *')].filter(el=>visible(el)&&[...el.childNodes].some(n=>n.nodeType===3&&/[a-z\dáéíóúñ]/i.test(n.textContent))&&!el.closest('button:disabled,[aria-disabled=true],svg')).flatMap(el=>{
    const style=getComputedStyle(el);if(Number(style.opacity)<.8||style.backgroundImage!=='none')return []
    const bg=background(el),fg=blend(rgb(style.color),bg),a=luminance(bg),b=luminance(fg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05),large=parseFloat(style.fontSize)>=24||(parseFloat(style.fontSize)>=18.66&&Number(style.fontWeight)>=700)
    return ratio+.02<(large?3:4.5)?[{text:el.textContent.trim().slice(0,70),ratio:Number(ratio.toFixed(2)),fg:style.color,bg:bg.map(Math.round),class:el.className}]:[]
   })
   return {targets,contrast,overflow:document.documentElement.scrollWidth>innerWidth+1}
  })
  audit.push({path,width:page.viewportSize().width,...result});assert.equal(result.overflow,false,path)
 }
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:900})
  for(const path of ['','nueva','mapa','album','tienda','amigos','perfil','ranking','misiones','ajustes','menu','libreta','logros','proponer']){await go(path);await review(path)}
 }
 await page.setViewportSize({width:390,height:900});await page.emulateMedia({colorScheme:'dark'})
 for(const path of ['','mapa','album','tienda','amigos','perfil','ranking','misiones','ajustes','menu','proponer']){await go(path);await review(path+'#oscuro')}
 await go('ajustes');await page.getByRole('switch',{name:'Menos animaciones',exact:true}).check()
 await expect(page.locator('html')).toHaveAttribute('data-suizamente-reduced','true')
 await page.emulateMedia({colorScheme:'dark'});await expect(page.locator('html')).toHaveAttribute('data-suizamente-theme','oscura')
 await page.getByRole('combobox',{name:'Apariencia'}).selectOption('clara');await expect(page.locator('html')).toHaveAttribute('data-suizamente-theme','clara')
 await go('mapa');const choose=page.getByRole('button',{name:/Ver Lucerna/});await choose.focus();await page.keyboard.press('Enter')
 await expect(page.getByRole('button',{name:/Subir a nivel 1/})).toBeVisible();assert.equal((await call(preview.db,A,'mapa')).niveles.LU,undefined)
 await expect(page.locator('.sv-map-frame>.sv-world-map canvas')).toHaveCount(1)
 await page.getByRole('button',{name:'Acercar mapa',exact:true}).focus();await page.keyboard.press('Enter')
 const image=await page.locator('.sv-map-frame>.sv-world-map canvas').screenshot();await page.waitForTimeout(250)
 assert.deepEqual(await page.locator('.sv-map-frame>.sv-world-map canvas').screenshot(),image,'The reduced-motion map does not drift')
 await page.getByRole('link',{name:'Así crece Lucerna ›'}).click();await expect(page.getByRole('heading',{name:'Así crece Lucerna'})).toBeVisible()
 await expect(page.locator('.sv-map-levels figure')).toHaveCount(4);await expect(page.locator('.sv-map-levels canvas')).toHaveCount(4)
 await page.screenshot({path:out+'/MapaNiveles-1440.png',fullPage:true})
 const match=await call(preview.db,A,'crear_partida',{rival:B});await go('partida/'+match.id)
 const more=page.getByRole('button',{name:'Más opciones: rendirse'});await more.focus();await page.keyboard.press('Enter')
 const dialog=page.getByRole('dialog',{name:'¿Rendirte?'});await expect(dialog).toBeFocused()
 await page.keyboard.press('Shift+Tab');await expect(dialog.getByRole('button',{name:'Cerrar',exact:true})).toBeFocused()
 await page.keyboard.press('Tab');await expect(dialog.getByRole('button',{name:'Seguir jugando'})).toBeFocused()
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(more).toBeFocused()
 // The stamp appears in the passport after leaving the answer, with a real award.
 await go('ajustes');await page.getByRole('switch',{name:'Menos animaciones',exact:true}).uncheck()
 await preview.db.query("UPDATE suizamente_private.suizamente_partidas SET fase='sello' WHERE id=$1",[match.id])
 await go('partida/'+match.id);await page.locator('.sv-stamp-choice').getByRole('button',{name:/Idioma/i}).click()
 await expect(page.locator('.sv-question-card')).toBeVisible()
 const question=(await preview.db.query('SELECT payload FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=$1 AND respondida_en IS NULL',[match.id])).rows[0].payload
 const state=await call(preview.db,A,'partida',{id:match.id}),option=state.pregunta.opciones.findIndex(o=>o.indice===question.correcta)
 await page.locator('.sv-options button').nth(option).click();await expect(page.getByRole('heading',{name:'¡Correcto!',exact:true})).toBeVisible()
 await review('partida-sello-resultado')
 await page.locator('.sv-footer button.sv-button').last().click();await expect(page.locator('.sv-passports .just-stamped')).toHaveCount(1)
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length),0)
 const fallback=await browser.newContext({viewport:{width:390,height:900},reducedMotion:'reduce'});await identity(fallback)
 await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:original.call(this,type,...args)}})
 const flat=await fallback.newPage();flat.on('pageerror',e=>errors.push(e.message));await flat.goto(preview.origin+'/suizamente/mapa')
 await expect(flat.locator('.sv-map-frame>.sv-world-map svg')).toBeVisible();await expect(flat.locator('.sv-world-map canvas')).toHaveCount(0)
 await flat.getByRole('button',{name:/Ver Lucerna/}).focus();await flat.keyboard.press('Enter');await expect(flat.getByRole('button',{name:/Subir a nivel 1/})).toBeVisible()
 await flat.screenshot({path:out+'/Mapa-sin-WebGL-390.png',fullPage:true})
 await writeFile(out+'/accesibilidad.json',JSON.stringify(audit,null,2))
 assert.deepEqual(audit.filter(r=>r.targets.length),[],'All interactive hit areas are at least 44 px')
 assert.deepEqual(audit.filter(r=>r.contrast.length),[],'WCAG AA text contrast on reviewed surfaces')
 assert.deepEqual(errors,[])
 console.log('Accessibility: 390/1440 hit targets/contrast, keyboard/modal focus, appearance, reduced-motion static 3D, real stamp animation/system suppression, four levels and no-WebGL fallback passed.')
}catch(e){await page?.screenshot({path:out+'/accessibility-failure.png',fullPage:true}).catch(()=>{});console.error(e.message);process.exitCode=1}
finally{await browser?.close();await preview?.close()}
