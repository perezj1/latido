import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {chromium,webkit,expect as baseExpect} from '@playwright/test'
import {startSuizamentePreview,testToken,testUser} from './lib/suizamente-v2-preview.mjs'
import {A,B} from './lib/suizamente-v2-test-db.mjs'
const expect=baseExpect.configure({timeout:15000})
let preview,browser,lastPage
const errors=[]
const output='output/latido-card/suizamente-v2'
try{
  await mkdir(output,{recursive:true})
  preview=await startSuizamentePreview(5266)
  async function visit(p,path){
    if(p.url().startsWith(preview.origin))await p.waitForLoadState('networkidle')
    await p.goto(preview.origin+path)
    await p.waitForLoadState('networkidle')
  }
  browser=await (process.argv.includes('--webkit')?webkit:chromium).launch({headless:true})
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'})
  const page=await context.newPage()
  lastPage=page
  page.on('pageerror',e=>errors.push(e.message))
  await visit(page,'/suizamente')
  await expect(page.getByRole('heading',{name:'El juego de preguntas de Suiza'})).toBeVisible()
  await page.getByRole('button',{name:'Empezar',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Gira y responde'})).toBeVisible()
  await page.getByRole('button',{name:'Siguiente',exact:true}).click()
  await page.getByRole('button',{name:'Siguiente',exact:true}).click()
  await page.getByRole('button',{name:'Siguiente',exact:true}).click()
  await page.screenshot({path:output+'/onboarding-390.png',fullPage:true})
  await page.getByRole('button',{name:'▶ Jugar mi primera partida'}).click()
  await page.getByRole('link',{name:'Jugar sin cuenta'}).click()
  await page.getByRole('textbox',{name:'Tu apodo'}).fill('Visitante')
  await page.getByRole('button',{name:'▶ ¡A jugar!',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Nueva partida'})).toBeVisible()
  await visit(page,'/suizamente')
  await expect(page.getByText('🪙 100',{exact:true})).toBeVisible()
  await expect(page.getByRole('navigation',{name:'Navegación principal'})).toBeVisible()
  await expect(page.getByRole('link',{name:'Álbum',exact:true})).toHaveCount(1)
  await expect(page.getByRole('link',{name:'Amigos',exact:true})).toHaveCount(1)
  await page.reload()
  await expect(page.getByRole('heading',{name:'Hola, Visitante'})).toBeVisible()
  await page.getByRole('link',{name:'Menú',exact:true}).click()
  await page.getByRole('link',{name:/Ajustes/}).click()
  await page.getByRole('combobox',{name:'Apariencia'}).selectOption('oscura')
  await expect(page.locator('html')).toHaveAttribute('data-suizamente-theme','oscura')
  await page.screenshot({path:output+'/ajustes-oscuro-390.png',fullPage:true})
  await page.getByRole('combobox',{name:'Apariencia'}).selectOption('clara')
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  await page.waitForLoadState('networkidle')
  await context.close()
  async function signed(id,name,width=390){
    const ctx=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'})
    await ctx.addInitScript(({id,user,token})=>{
      localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user}))
      localStorage.setItem('suizamente:onboarding','2026-01-01')
      sessionStorage.setItem('suizamente:apertura','1')
    },{id,user:testUser(id,name),token:testToken(id)})
    const p=await ctx.newPage();lastPage=p;p.on('pageerror',e=>errors.push(e.message))
    return {ctx,page:p}
  }
  const a=await signed(A,'Alex'),b=await signed(B,'Lu',1280)
  await visit(a.page,'/suizamente/nueva')
  await expect(a.page.getByRole('heading',{name:'Nueva partida'})).toBeVisible()
  await a.page.getByRole('textbox',{name:'Buscar jugadores por apodo'}).fill('Lu')
  await a.page.locator('.sv-player-list>div').filter({hasText:'Lu'}).getByRole('button',{name:'▶ Jugar'}).click()
  await expect(a.page.getByRole('button',{name:'🎡 ¡Girar!'})).toBeVisible()
  const mid=new URL(a.page.url()).pathname.split('/').pop()
  await preview.db.query("UPDATE suizamente_private.suizamente_partidas SET reglas=jsonb_set(reglas,'{ruleta,casillas}','[\"idioma\"]') WHERE id=$1",[mid])
  await a.page.screenshot({path:output+'/partida-390.png',fullPage:true})
  await a.page.getByRole('button',{name:'🎡 ¡Girar!'}).click()
  await expect(a.page.locator('.sv-question-card')).toBeVisible()
  const q=(await preview.db.query('SELECT payload FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=$1 ORDER BY n DESC LIMIT 1',[mid])).rows[0].payload
  assert.ok(!(await a.page.content()).includes('"correcta":'))
  await a.page.screenshot({path:output+'/pregunta-390.png',fullPage:true})
  await a.page.getByRole('button',{name:q.opciones[(q.correcta+1)%q.opciones.length].t,exact:false}).click()
  await expect(a.page.getByText('¡Uy! No era esa')).toBeVisible()
  await a.page.reload()
  await expect(a.page.getByText('¡Uy! No era esa')).toBeVisible()
  await a.page.getByRole('button',{name:'Le toca a Lu'}).click();await a.page.getByRole('button',{name:'Volver a Inicio',exact:true}).click()
  await expect(a.page.getByRole('heading',{name:'Hola, Alex'})).toBeVisible()
  await visit(b.page,'/suizamente/partida/'+mid)
  await expect(b.page.getByRole('button',{name:'🎡 ¡Girar!'})).toBeVisible()
  await b.page.screenshot({path:output+'/partida-1280.png',fullPage:true})
  await b.page.getByRole('button',{name:'🎡 ¡Girar!'}).click()
  await expect(b.page.locator('.sv-question-card')).toBeVisible()
  await preview.db.query("UPDATE suizamente_private.suizamente_partida_preguntas SET vence_en=clock_timestamp()-interval '4 seconds' WHERE partida_id=$1 AND respondida_en IS NULL",[mid])
  await b.page.reload()
  await expect(b.page.getByText('⏰ ¡Se acabó el tiempo!')).toBeVisible()
  assert.ok(await b.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  for(const width of [320,390,1280]){
    await a.page.setViewportSize({width,height:844})
    await visit(a.page,'/suizamente/partida/'+mid)
    await expect(a.page.getByRole('button',{name:'🎡 ¡Girar!'})).toBeVisible()
    assert.ok(await a.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No overflow at '+width)
  }
  // Private question catalogs must not be served by development or bundled in dist.
  for(const privatePath of ['/server/suizamente/data/preguntas.json','/supabase/suizamente_v2_datos.sql','/suizamente/data/preguntas.json']){
    assert.equal((await fetch(preview.origin+privatePath)).status,404)
  }
  assert.deepEqual(errors,[])
  console.log('Browser: onboarding, guest profile/gift, reload, settings/themes, real SQL between two accounts, timeout recovery and 320/390/1280 layouts passed.')
}catch(e){
  console.error('Browser v2:',e.message)
  if(lastPage&&!lastPage.isClosed()){console.error((await lastPage.locator('body').innerText()).slice(0,5000));await lastPage.screenshot({path:output+'/failure.png',fullPage:true})}
  console.error(errors)
  process.exitCode=1
}
finally{await browser?.close();await preview?.close()}
