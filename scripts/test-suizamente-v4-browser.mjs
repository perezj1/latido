import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {chromium,webkit,expect as baseExpect} from '@playwright/test'
import {startSuizamentePreview,testToken,testUser} from './lib/suizamente-v2-preview.mjs'
import {call,A,B} from './lib/suizamente-v2-test-db.mjs'
const expect=baseExpect.configure({timeout:15000}),output='output/latido-card/suizamente-v4'
let preview,browser,lastPage
const errors=[]
try{
  await mkdir(output,{recursive:true})
  preview=await startSuizamentePreview(5267)
  browser=await(process.argv.includes('--webkit')?webkit:chromium).launch({headless:true})
  async function signed(id,name,width=390){
    const ctx=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'})
    await ctx.addInitScript(({user,token})=>{
      localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user}))
      localStorage.setItem('suizamente:onboarding','2026-01-01')
      sessionStorage.setItem('suizamente:apertura','1')
    },{user:testUser(id,name),token:testToken(id)})
    const page=await ctx.newPage();page.setDefaultTimeout(15000);lastPage=page;page.on('pageerror',e=>errors.push(e.message))
    return page
  }
  async function visit(page,path){
    lastPage=page
    if(page.url().startsWith(preview.origin))await page.waitForLoadState('networkidle')
    await page.goto(preview.origin+path);await page.waitForLoadState('networkidle')
  }
  async function answer(page,mid,correct=true){
    lastPage=page
    await expect(page.locator('.sv-question-card')).toBeVisible()
    const q=(await preview.db.query('SELECT payload FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=$1 AND respondida_en IS NULL',[mid])).rows[0].payload
    await page.locator('.sv-options').getByRole('button',{name:q.opciones[correct?q.correcta:(q.correcta+1)%q.opciones.length].t,exact:false}).click()
    await expect(page.getByRole('heading',{name:correct?'¡Correcto!':'¡Uy! No era esa',exact:true})).toBeVisible()
  }
  const a=await signed(A,'Alex'),b=await signed(B,'Lu',1280)
  await visit(a,'/suizamente')
  await a.getByRole('link',{name:'100 monedas. Abrir Tienda'}).click()
  await expect(a.getByRole('heading',{name:'🛒 Tienda'})).toBeVisible()
  await a.getByRole('button',{name:/Regalo diario/}).click()
  await expect(a.getByRole('link',{name:'150 monedas. Abrir Tienda'})).toBeVisible()
  await expect(a.getByRole('button',{name:/Vuelve mañana a por otro/})).toBeDisabled()
  for(const name of ['Otra oportunidad','+15 s']){
    await a.getByRole('button',{name:new RegExp('Comprar '+(name==='+15 s'?'\\+15 s':name)+' por')}).click()
    await expect(a.getByRole('status').filter({hasText:'✓ Comprado:'})).toBeVisible()
  }
  await expect(a.getByRole('link',{name:'110 monedas. Abrir Tienda'})).toBeVisible()
  await a.locator('.sv-shop-row').filter({hasText:'Escudo'}).click()
  await expect(a.getByRole('alert')).toHaveText('Te faltan 🪙 40')
  await a.screenshot({path:output+'/tienda-390.png',fullPage:true})
  await preview.db.exec("UPDATE suizamente_private.suizamente_preguntas SET oculta=jsonb_array_length(payload->'opciones')<>3")
  let m=await call(preview.db,A,'crear_partida',{rival:B})
  const mid=m.id
  await preview.db.query("UPDATE suizamente_private.suizamente_partidas SET reglas=jsonb_set(reglas,'{ruleta,casillas}','[\"idioma\"]') WHERE id=$1",[mid])
  await visit(a,'/suizamente/partida/'+mid)
  await a.getByRole('button',{name:'🎡 ¡Girar!'}).click()
  await expect(a.locator('.sv-question-card')).toBeVisible()
  assert.ok(!(await a.content()).includes('"correcta":'))
  await a.getByRole('button',{name:/\+15 s: tienes/}).click()
  await expect(a.getByRole('button',{name:/\+15 s: tienes/})).toBeDisabled()
  await a.getByRole('button',{name:/Otra oportunidad: tienes/}).click()
  await a.getByRole('button',{name:/Quita una: tienes/}).click()
  await expect(a.locator('.sv-option-removed')).toHaveCount(1)
  const qrow=(await preview.db.query('SELECT payload,quitadas FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=$1 AND respondida_en IS NULL',[mid])).rows[0]
  const wrong=qrow.payload.opciones.findIndex((_,i)=>i!==qrow.payload.correcta&&!qrow.quitadas.includes(i))
  await a.locator('.sv-options').getByRole('button',{name:qrow.payload.opciones[wrong].t,exact:false}).click()
  await expect(a.getByText('🔁 ¡Otra oportunidad! Elige otra vez')).toBeVisible()
  await a.screenshot({path:output+'/comodines-390.png',fullPage:true})
  await a.locator('.sv-options').getByRole('button',{name:qrow.payload.opciones[qrow.payload.correcta].t,exact:false}).click()
  await expect(a.getByRole('heading',{name:'¡Correcto!',exact:true})).toBeVisible()
  await expect(a.getByText('🪙 +5',{exact:true})).toBeVisible()
  await expect(a.getByText('⭐ +10 XP',{exact:true})).toBeVisible()
  await visit(a,'/suizamente')
  await expect(a.getByRole('link',{name:'115 monedas. Abrir Tienda'})).toBeVisible()
  await expect(a.getByLabel('Racha de 1 días')).toBeVisible()
  await a.getByRole('link',{name:'Tu perfil. Nivel 1'}).click()
  await expect(a.getByRole('heading',{name:'⭐ Nivel 1'})).toBeVisible()
  await expect(a.getByText('Has acertado')).toContainText('1')
  await a.screenshot({path:output+'/perfil-390.png',fullPage:true})
  await a.getByRole('link',{name:/Logros/}).click()
  await expect(a.locator('.sv-achievements-grid>button')).toHaveCount((await call(preview.db,A,'logros')).logros.length)
  await a.getByRole('button',{name:'Recién llegado: Conseguido'}).click()
  await a.screenshot({path:output+'/logros-390.png',fullPage:true})
  await visit(a,'/suizamente/ajustes')
  await a.getByRole('combobox',{name:'Apariencia'}).selectOption('oscura')
  await expect(a.locator('html')).toHaveAttribute('data-suizamente-theme','oscura')
  await visit(a,'/suizamente/tienda')
  await expect(a.locator('html')).toHaveAttribute('data-suizamente-theme','oscura')
  await a.screenshot({path:output+'/tienda-oscura-390.png',fullPage:true})
  await preview.db.exec('DELETE FROM suizamente_private.suizamente_limites')
  m=await call(preview.db,A,'crear_partida',{rival:B})
  await preview.db.query("UPDATE suizamente_private.suizamente_partidas SET sellos_a=ARRAY['idioma'],sellos_b=ARRAY['cultura'],fase='sello' WHERE id=$1",[m.id])
  await visit(a,'/suizamente/partida/'+m.id)
  await a.getByRole('button',{name:/⚔️ Duelo de sellos/}).click()
  await expect(a.getByRole('heading',{name:'⚔️ Duelo de sellos'})).toBeVisible()
  await a.screenshot({path:output+'/duelo-preparar-390.png',fullPage:true})
  await a.getByRole('button',{name:'⚔️ ¡Al duelo!'}).click()
  for(let i=0;i<6;i++){
    await answer(a,m.id,true)
    await a.getByRole('button',{name:i===5?'Le toca a Lu':'▶ Siguiente pregunta',exact:true}).click();if(i===5)await a.getByRole('button',{name:'Volver a Inicio',exact:true}).click()
  }
  await expect(a.getByRole('heading',{name:'Hola, Alex'})).toBeVisible()
  await visit(b,'/suizamente/partida/'+m.id)
  await b.getByRole('button',{name:'⚔️ Seguir el duelo'}).click()
  for(let i=0;i<6;i++){
    await answer(b,m.id,false)
    await b.getByRole('button',{name:i===5?'Ver resultado del duelo':'▶ Siguiente pregunta',exact:true}).click()
  }
  await expect(b.getByRole('heading',{name:'Duelo perdido'})).toBeVisible()
  await b.screenshot({path:output+'/duelo-perdido-1280.png',fullPage:true})
  await b.getByRole('button',{name:'▶ Seguir la partida'}).click()
  await expect(b.getByRole('button',{name:'🎡 ¡Girar!'})).toBeVisible()
  await visit(a,'/suizamente/partida/'+m.id)
  await expect(a.getByRole('heading',{name:'¡Duelo ganado!'})).toBeVisible()
  await expect(a.getByText('🪙 +20',{exact:true})).toBeVisible()
  await a.screenshot({path:output+'/duelo-ganado-390.png',fullPage:true})
  await a.getByRole('button',{name:'▶ Seguir la partida'}).click()
  await expect(a.getByRole('button',{name:'⏳ Turno de Lu'})).toBeDisabled()
  for(const path of ['tienda','perfil','logros']){
    for(const width of [320,390,1280]){
      await a.setViewportSize({width,height:844});await visit(a,'/suizamente/'+path)
      assert.ok(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No overflow '+path+' '+width)
    }
  }
  assert.deepEqual(errors,[])
  console.log('Browser economy/store/duel: live wallet, daily gift, purchase/402, power-ups/retry/rewards, streak, profile, achievements, dark mode, two-person duel and 320/390/1280 layouts passed.')
}catch(e){
  console.error('Browser economy/store/duel:',e.message)
  if(lastPage&&!lastPage.isClosed()){
    console.error((await lastPage.locator('body').innerText()).slice(0,5000))
    await lastPage.screenshot({path:output+'/failure.png',fullPage:true})
  }
  console.error(errors);process.exitCode=1
}finally{await browser?.close();await preview?.close()}
