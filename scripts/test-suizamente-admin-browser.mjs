import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {chromium,webkit,expect as baseExpect} from '@playwright/test'
import {startSuizamentePreview,testToken,testUser} from './lib/suizamente-v2-preview.mjs'
import {call,A,B,C} from './lib/suizamente-v2-test-db.mjs'

const expect=baseExpect.configure({timeout:15000}),output='output/suizamente-admin'+(process.argv.includes('--webkit')?'/webkit':'/chromium')
let preview,browser,lastPage
const errors=[]
try{
  await mkdir(output,{recursive:true});preview=await startSuizamentePreview(5272)
  browser=await(process.argv.includes('--webkit')?webkit:chromium).launch({headless:true})
  async function signed(id,name,width){
    const ctx=await browser.newContext({viewport:{width,height:960},reducedMotion:'reduce'})
    await ctx.addInitScript(({user,token})=>{
      localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user}))
      localStorage.setItem('suizamente:onboarding','2026-01-01');sessionStorage.setItem('suizamente:apertura','1')
    },{user:testUser(id,name),token:testToken(id)})
    const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));return p
  }
  async function visit(p,path){lastPage=p;await p.goto(preview.origin+'/suizamente/'+path);await p.waitForLoadState('networkidle')}
  async function fits(p){assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow: '+p.url())}
  async function capture(p,name){await fits(p);await p.screenshot({path:output+'/'+name+'.png',fullPage:true})}
  const source=(await preview.db.query("SELECT payload FROM suizamente_private.suizamente_preguntas WHERE payload->>'tipo'='dilema' LIMIT 1")).rows[0].payload
  const proposal=await call(preview.db,A,'proponer',{contenido:{...source,fuente:''}})
  const match=await call(preview.db,A,'crear_partida',{rival:B})
  const week=(await preview.db.query('SELECT suizamente_private.v7_semana()::text w')).rows[0].w
  await preview.db.query('DELETE FROM suizamente_private.suizamente_liga_semanas WHERE semana=$1',[week])
  await preview.db.query("INSERT INTO suizamente_private.suizamente_movimientos(jugador_id,motivo,ref,creado_en) VALUES($1,'partida_perdida','anterior',($3::date-2)::timestamp AT TIME ZONE 'Europe/Zurich'),($2,'partida_perdida','anterior',($3::date-2)::timestamp AT TIME ZONE 'Europe/Zurich')",[A,B,week])
  await preview.db.query("INSERT INTO suizamente_private.suizamente_reportes(jugador_id,pregunta_id,motivo) VALUES($1,$2,'Escribir a privado@example.org')",[A,source.id])
  const normal=await signed(A,'Alex',390),admin=await signed(C,'Caro',1440)
  await visit(normal,'menu');await expect(normal.getByRole('link',{name:/Administración/})).toHaveCount(0)
  await visit(normal,'admin');await expect(normal.getByRole('heading',{name:'Acceso restringido'})).toBeVisible()
  assert.equal(await normal.evaluate(async()=>{const r=await fetch('/api/suizamente/admin/eventos',{headers:{authorization:'Bearer '+JSON.parse(localStorage.getItem('sb-127-auth-token')).access_token}});return r.status}),403)
  await visit(admin,'admin');await expect(admin.getByRole('heading',{name:'📊 Resumen'})).toBeVisible()
  await capture(admin,'AdminResumen-1440')
  await visit(admin,'admin/propuestas');await admin.locator('.sv-admin-proposal-card').first().click()
  await expect(admin.getByRole('heading',{name:'👀 Así se verá'})).toBeVisible()
  await capture(admin,'AdminPropuestas-1440')
  await admin.getByRole('textbox',{name:'¿Sabías que…?',exact:true}).fill('Dato en edición')
  await expect(admin.getByLabel('Línea para fuentes',{exact:true})).toContainText('Dato en edición')
  await admin.getByRole('textbox',{name:'¿Sabías que…?',exact:true}).fill(source.dato)
  await admin.getByRole('button',{name:'✅ Aprobar',exact:true}).click()
  await expect(admin.getByRole('status').filter({hasText:'Cambios guardados'})).toBeVisible()
  for(const [section,heading] of [['avisos','⚠️ Avisos de datos'],['preguntas','❓ Preguntas'],['jugadores','👥 Jugadores'],['denuncias','🔎 Denuncias'],['dia','📅 Pregunta del día'],['ranking','🏆 Rankings'],['asaltos','⚔️ Asaltos'],['album','🃏 Álbum'],['registro','📝 Registro']]){
    await visit(admin,'admin/'+section);await expect(admin.getByRole('heading',{name:heading,exact:true})).toBeVisible()
    assert.equal(await admin.locator('.sv-error').count(),0,section);assert.ok(!(await admin.locator('body').innerText()).includes('example.org'));await fits(admin)
    if(section==='dia')assert.equal(await admin.locator('.sv-calendar-grid>.sv-card').count(),14)
  }
  for(const [section,id] of [['preguntas',source.id],['jugadores',B]]){
    await visit(admin,'admin/'+section+'/'+id)
    await expect(admin.locator('.sv-admin-related-list')).toBeVisible();await fits(admin)
  }
  await visit(admin,'admin/economia');await admin.getByLabel('Sobre',{exact:true}).fill('37')
  await admin.getByRole('button',{name:'💾 Guardar Economía',exact:true}).click()
  await expect(admin.getByRole('status').filter({hasText:'Configuración aplicada'})).toBeVisible()
  await visit(normal,'tienda');await expect(normal.getByRole('button',{name:/37/})).toBeVisible()
  await visit(admin,'admin/partidas');await admin.getByRole('searchbox',{name:'Buscar por id o apodo'}).fill(match.id)
  await expect(admin.locator('.sv-admin-main>.sv-card').filter({hasText:match.id})).toBeVisible()
  assert.ok(!/correcta|opcion|payload|email/.test(JSON.stringify(await admin.evaluate(async()=>{
    const {szApi}=await import('/src/lib/suizamenteV2.js');return szApi('admin/partidas?q=Alex')
  }))))
  await visit(admin,'admin/eventos');await expect(admin.getByRole('button',{name:'Programar evento'}).first()).toBeVisible()
  await admin.getByRole('button',{name:'Programar evento'}).last().click()
  await admin.getByLabel('Tipo de evento').selectOption('cartas')
  await admin.getByRole('button',{name:'Guardar evento',exact:true}).click()
  await expect(admin.getByRole('status').filter({hasText:'Evento programado'})).toBeVisible()
  await capture(admin,'Eventos-1440')
  await admin.getByRole('button',{name:'Programar evento'}).last().click()
  await admin.getByRole('button',{name:'Restaurar rotación automática'}).click()
  await expect(admin.getByRole('status').filter({hasText:'Rotación automática restaurada'})).toBeVisible()
  await visit(admin,'admin/ligas');await expect(admin.getByRole('heading',{name:'Liga Pradera · Grupo 1'})).toBeVisible()
  await expect(admin.locator('.sv-admin-league-row')).toHaveCount(2);await capture(admin,'Ligas-1440')
  await admin.setViewportSize({width:390,height:900})
  await visit(admin,'admin');await expect(admin.locator('.sv-admin-bottom')).toBeVisible();await capture(admin,'AdminMovilResumen-390')
  await visit(admin,'admin/propuestas');await admin.getByRole('button',{name:/Aprobadas/}).click()
  await expect(admin.locator('.sv-admin-proposal-card')).toHaveCount(1);await capture(admin,'AdminMovilPropuestas-390')
  await admin.getByRole('button',{name:'🎚️ Filtros',exact:true}).click()
  await expect(admin.getByRole('dialog',{name:'Filtrar propuestas'})).toBeVisible()
  await admin.getByRole('button',{name:'Aplicar',exact:true}).click()
  await admin.locator('.sv-admin-proposal-card').first().click()
  await expect(admin.getByRole('heading',{name:'👀 Así se verá'})).toBeVisible()
  await expect(admin.locator('.sv-admin-fixed-actions')).toBeVisible();await expect(admin.locator('.sv-admin-bottom')).toBeHidden()
  await capture(admin,'AdminMovilPropuesta-390')
  await admin.getByRole('button',{name:'❌ Rechazar',exact:true}).click()
  await expect(admin.getByRole('dialog',{name:'¿Rechazar sin nota?'})).toBeVisible()
  await admin.getByRole('button',{name:'Volver a escribir la nota'}).click()
  await expect(admin.getByRole('dialog')).toHaveCount(0)
  for(const section of ['eventos','ligas','economia','partidas','preguntas/'+source.id,'jugadores/'+B]){
    await visit(admin,'admin/'+section);await capture(admin,section.split('/')[0]+'-390')
  }
  await admin.setViewportSize({width:320,height:780})
  await admin.evaluate(()=>localStorage.setItem('suizamente:ajustes',JSON.stringify({apariencia:'oscura',menosAnimaciones:true})))
  for(const section of ['','propuestas/'+proposal.id,'eventos','ligas']){
    await visit(admin,'admin/'+section);await capture(admin,'oscuro-320-'+(section.split('/')[0]||'resumen'))
  }
  assert.deepEqual(errors,[])
  console.log('Admin browser: five designed screens, desktop/mobile/dark/320 px, denied access and hidden link, no contact text, proposals/live export, economy applied to shop, 14-day calendar, private support, event scheduling and league groups passed.')
}catch(e){if(lastPage)await lastPage.screenshot({path:output+'/failure.png',fullPage:true}).catch(()=>{});console.error(e);process.exitCode=1}
finally{await browser?.close();await preview?.close()}
