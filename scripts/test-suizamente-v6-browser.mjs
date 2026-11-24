import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {chromium,webkit,expect as baseExpect} from '@playwright/test'
import {startSuizamentePreview,testToken,testUser} from './lib/suizamente-v2-preview.mjs'
import {call,A,B} from './lib/suizamente-v2-test-db.mjs'
const expect=baseExpect.configure({timeout:15000}),output='output/latido-card/suizamente-v6'
let preview,browser,lastPage
const errors=[]
try{
  await mkdir(output,{recursive:true});preview=await startSuizamentePreview(5268)
  browser=await(process.argv.includes('--webkit')?webkit:chromium).launch({headless:true})
  async function signed(id,name,width=390){
    const ctx=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'})
    await ctx.addInitScript(({user,token})=>{
      localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user}))
      localStorage.setItem('suizamente:onboarding','2026-01-01');sessionStorage.setItem('suizamente:apertura','1')
    },{user:testUser(id,name),token:testToken(id)})
    const page=await ctx.newPage();page.setDefaultTimeout(15000);lastPage=page
    page.on('pageerror',e=>errors.push(e.message));return page
  }
  async function visit(p,path){
    lastPage=p
    if(p.url().startsWith(preview.origin))await p.waitForLoadState('networkidle')
    await p.goto(preview.origin+path);await p.waitForLoadState('networkidle')
  }
  const a=await signed(A,'Alex'),b=await signed(B,'Lu',1280)
  await visit(a,'/suizamente')
  await a.getByRole('link',{name:/Tu mapa:/}).click()
  await expect(a.getByRole('heading',{name:'Suiza central',exact:true})).toBeVisible()
  await expect(a.locator('.sv-map-frame canvas')).toHaveCount(1)
  assert.equal((await call(preview.db,A,'mapa')).niveles.LU||0,0)
  await a.screenshot({path:output+'/mapa-390.png',fullPage:true})
  await a.getByRole('link',{name:'Cómo funciona el mapa'}).click()
  await expect(a.getByRole('heading',{name:'🗺️ Tu Suiza, paso a paso'})).toBeVisible()
  await a.getByRole('link',{name:'Entendido'}).click()
  await a.getByRole('button',{name:/Ver Lucerna/}).click();await a.getByRole('button',{name:/Subir a nivel/}).click()
  await expect(a.getByRole('link',{name:'40 monedas. Abrir Tienda'})).toBeVisible()
  assert.equal((await call(preview.db,A,'mapa')).niveles.LU||0,1)
  await a.getByRole('button',{name:/Ver Lucerna/}).click();await a.getByRole('button',{name:/Subir a nivel/}).click()
  await expect(a.getByRole('alert')).toContainText('Te faltan 🪙 50')
  await preview.db.query("SELECT suizamente_private.v3_anotar($1,'fixture','mapa',1000)",[A])
  await visit(a,'/suizamente/mapa')
  await a.getByRole('button',{name:/Ver Lucerna/}).click();await a.getByRole('button',{name:/Subir a nivel/}).click()
  assert.equal((await call(preview.db,A,'mapa')).niveles.LU||0,2)
  await preview.db.query("INSERT INTO suizamente_private.suizamente_mapa SELECT $1,1,k->>'id',3 FROM jsonb_array_elements(suizamente_private.v2_config()#>'{mapa,regiones,0,cantones}') k WHERE k->>'id'<>'LU' ON CONFLICT(jugador_id,vuelta,canton) DO UPDATE SET nivel=3",[A])
  await a.getByRole('button',{name:/Ver Lucerna/}).click();await a.getByRole('button',{name:/Subir a nivel/}).click()
  await expect(a.getByRole('heading',{name:'¡Suiza central completa!'})).toBeVisible()
  await expect(a.getByText('200 monedas',{exact:true})).toBeVisible()
  await a.screenshot({path:output+'/cofre-region-390.png',fullPage:true})
  const chestPath=new URL(a.url()).pathname
  const before=(await call(preview.db,A,'jugador')).jugador.monedas
  await a.reload();await expect(a.getByText('200 monedas',{exact:true})).toBeVisible()
  assert.equal((await call(preview.db,A,'jugador')).jugador.monedas,before)
  await a.getByRole('link',{name:'Seguir',exact:true}).click()
  await expect(a.getByRole('heading',{name:'Zúrich',exact:true})).toBeVisible()
  assert.equal((await call(preview.db,A,'mapa')).niveles.LU||0,3)
  await a.getByRole('link',{name:'Álbum',exact:true}).click()
  await expect(a.getByText('Colección 1 de 5 · 0/9')).toBeVisible()
  await a.locator('.sv-album-grid>button').first().click()
  await expect(a.getByRole('dialog')).toContainText('Aún no la tienes · Sale en los sobres')
  await a.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).click()
  await a.screenshot({path:output+'/album-390.png',fullPage:true})
  await a.getByRole('button',{name:/Tienes 2 sobres sin abrir/}).click()
  await expect(a.getByRole('heading',{name:'🃏 Sobre de cartas'})).toBeVisible()
  await expect(a.getByRole('button',{name:'Girar carta 3'})).toBeDisabled()
  await a.getByRole('button',{name:'Girar carta 1'}).click()
  await expect(a.locator('.sv-pack-cards .sv-album-card')).toHaveCount(1)
  const packPath=new URL(a.url()).pathname
  await a.screenshot({path:output+'/sobre-girando-390.png',fullPage:true})
  await a.reload();await expect(a.getByRole('button',{name:'Girar carta 2'})).toBeEnabled()
  await a.getByRole('button',{name:'Girar carta 2'}).click()
  await a.getByRole('button',{name:'Girar carta 3'}).click()
  await expect(a.locator('.sv-pack-cards .sv-album-card')).toHaveCount(3)
  await a.screenshot({path:output+'/sobre-390.png',fullPage:true})
  await a.locator('.sv-pack-cards .sv-album-card').first().click()
  await expect(a.getByRole('dialog')).toContainText('💡 ¿Sabías que…?')
  await a.screenshot({path:output+'/carta-detalle-390.png',fullPage:true})
  await a.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).click()
  await a.getByRole('link',{name:'🃏 Ver el álbum',exact:true}).click()
  await expect(a.locator('.sv-album-grid>button')).toHaveCount(9)
  await a.getByRole('button',{name:'Colección siguiente'}).click()
  await expect(a.getByRole('heading',{name:'Palabras en suizo'})).toBeVisible()
  const firstCard=(await preview.db.query('SELECT cartas FROM suizamente_private.suizamente_sobres WHERE id=$1',[packPath.split('/').pop()])).rows[0].cartas[0]
  await visit(a,'/suizamente/album')
  for(let i=0;i<firstCard.coleccionId;i++)await a.getByRole('button',{name:'Colección siguiente'}).click()
  await a.locator('.sv-album-grid>button:not(.missing)').first().click()
  await expect(a.getByRole('dialog')).toContainText('💡 ¿Sabías que…?')
  await a.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).click()
  await a.screenshot({path:output+'/album-con-cartas-390.png',fullPage:true})
  // The raid comes from a real correct answer, against another real test account.
  await call(preview.db,B,'construir',{canton:'LU',nivel:0,clave:crypto.randomUUID()})
  await preview.db.exec('DELETE FROM suizamente_private.suizamente_limites')
  let m=await call(preview.db,A,'crear_partida',{rival:B})
  await preview.db.query("UPDATE suizamente_private.suizamente_partidas SET reglas=jsonb_set(jsonb_set(reglas,'{ruleta,casillas}','[\"idioma\"]'),'{asaltos,probabilidadPorAcierto}','1') WHERE id=$1",[m.id])
  await visit(a,'/suizamente/partida/'+m.id)
  await a.getByRole('button',{name:'🎡 ¡Girar!'}).click()
  await expect(a.locator('.sv-question-card')).toBeVisible()
  const q=(await preview.db.query('SELECT payload FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=$1 AND respondida_en IS NULL',[m.id])).rows[0].payload
  await a.locator('.sv-options').getByRole('button',{name:q.opciones[q.correcta].t,exact:false}).click()
  await a.getByRole('link',{name:'⚔️ ¡Asalto disponible!'}).click()
  await expect(a.getByRole('heading',{name:'¡Asalto!',exact:true})).toBeVisible()
  await expect(a.getByText('Mapa de Lu')).toBeVisible()
  await a.screenshot({path:output+'/asalto-390.png',fullPage:true})
  await a.getByRole('button',{name:'⚔️ ¡A por ello!'}).click()
  await expect(a.locator('.sv-question-card')).toBeVisible()
  await expect(a.getByRole('button',{name:/Cambiar: tienes/})).toBeDisabled()
  const aid=new URL(a.url()).pathname.split('/').pop()
  const aq=(await preview.db.query('SELECT payload FROM suizamente_private.suizamente_asaltos WHERE id=$1',[aid])).rows[0].payload
  assert.ok(!(await a.content()).includes('"correcta":'))
  await a.locator('.sv-options').getByRole('button',{name:aq.opciones[aq.correcta].t,exact:false}).click()
  await expect(a.getByRole('heading',{name:'¡Correcto!',exact:true})).toBeVisible()
  await a.getByRole('button',{name:'Ver el asalto'}).click()
  await expect(a.getByRole('heading',{name:'¡Asalto conseguido!'})).toBeVisible()
  await expect(a.getByText('🪙 +100',{exact:true})).toBeVisible()
  await expect(a.getByRole('link',{name:'▶ Seguir la partida'})).toBeEnabled()
  await a.screenshot({path:output+'/asalto-hecho-390.png',fullPage:true})
  await a.getByRole('link',{name:'▶ Seguir la partida'}).click()
  await expect(a.getByRole('button',{name:'🎡 ¡Girar!'})).toBeVisible()
  await expect(a.getByRole('progressbar',{name:'Barra de sello'})).toHaveAttribute('aria-valuenow','1')
  await visit(b,'/suizamente/mapa')
  await expect(b.getByRole('link',{name:'Ver mapa',exact:true})).toBeVisible()
  assert.equal((await call(preview.db,B,'mapa')).niveles.LU||0,0)
  await b.screenshot({path:output+'/mapa-asaltado-1280.png',fullPage:true})
  await visit(a,'/suizamente/ajustes');await a.getByRole('combobox',{name:'Apariencia'}).selectOption('oscura')
  await expect(a.locator('html')).toHaveAttribute('data-suizamente-theme','oscura')
  for(const path of ['/suizamente/mapa','/suizamente/album',packPath,chestPath]){
    for(const width of [320,390,1280]){
      await a.setViewportSize({width,height:844});await visit(a,path)
      assert.ok(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No overflow '+path+' '+width)
    }
  }
  await a.setViewportSize({width:390,height:844});await visit(a,'/suizamente/mapa')
  await expect(a.locator('html')).toHaveAttribute('data-suizamente-theme','oscura')
  await a.screenshot({path:output+'/mapa-oscuro-390.png',fullPage:true})
  await visit(a,'/suizamente/album');await a.screenshot({path:output+'/album-oscuro-390.png',fullPage:true})
  assert.deepEqual(errors,[])
  console.log('Browser world: SVG geometry/levels, build/402, region chest/reload, album/detail, ordered persistent flips, real two-account raid/return/notice, dark mode and 320/390/1280 layouts passed.')
}catch(e){
  console.error('Browser map/album:',e.message)
  if(lastPage&&!lastPage.isClosed()){console.error((await lastPage.locator('body').innerText()).slice(0,5000));await lastPage.screenshot({path:output+'/failure.png',fullPage:true})}
  console.error(errors);process.exitCode=1
}finally{await browser?.close();await preview?.close()}
