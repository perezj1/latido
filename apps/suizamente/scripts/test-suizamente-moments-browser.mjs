// Real React + real SQL, disposable in-memory database. No production credentials.
import assert from 'node:assert/strict'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {createServer} from 'node:http'
import {resolve,extname} from 'node:path'
import {chromium,webkit,expect as rawExpect} from '@playwright/test'
import {startSuizamentePreview,testToken,testUser} from './lib/suizamente-v2-preview.mjs'
import {A,B,C,call,callOriginal} from './lib/suizamente-v2-test-db.mjs'
const expect=rawExpect.configure({timeout:15000}),engine=process.argv.includes('--webkit')?'webkit':'chromium',out='output/momentos/'+engine
let preview,browser,page,referenceServer
const checks=[],errors=[]
try{
  await mkdir(out,{recursive:true});preview=await startSuizamentePreview(engine==='webkit'?5319:5318,{hmr:false})
  const db=preview.db,config=await call(db,A,'config'),rules=(await db.query('SELECT juego FROM suizamente_private.suizamente_configuracion')).rows[0].juego
  async function solveDuel(mid,actors,winner){
    for(const actor of actors)for(let i=0;i<config.duelo.preguntas;i++){
      await db.exec('DELETE FROM suizamente_private.suizamente_limites')
      let state=await call(db,actor,'partida',{id:mid})
      if(!state.pregunta)state=await call(db,actor,'pregunta',{id:state.id,turnoN:state.turnoN})
      const q=(await db.query('SELECT payload FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=$1 AND n=$2',[state.id,state.pregunta.n])).rows[0].payload
      await callOriginal(db,actor,'respuesta',{id:state.id,turnoN:state.turnoN,n:state.pregunta.n,opcion:actor===winner?q.correcta:(q.correcta+1)%q.opciones.length})
    }
  }
  for(const actor of [A,B,C])await db.query("SELECT suizamente_private.v3_anotar($1,'fixture','moments',5000,0,'{\"sobres\":6}')",[actor])
  await db.exec('UPDATE suizamente_private.suizamente_novedades SET leida=true')
  await db.query("INSERT INTO suizamente_private.suizamente_novedades(jugador_id,tipo,ref,datos) VALUES($1,'asalto','fixture-moment','{\"texto\":\"⚔️ Lu ha asaltado Lucerna\",\"detalle\":\"Baja al nivel 2\"}')",[A])
  browser=await(engine==='webkit'?webkit:chromium).launch({headless:true})
  async function context(actor=A,reducedMotion='reduce'){
    const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion})
    await ctx.addInitScript(session=>{localStorage.setItem('sb-127-auth-token',JSON.stringify(session));sessionStorage.setItem('suizamente:apertura','1');Object.defineProperty(navigator,'standalone',{get:()=>true})},{access_token:testToken(actor),refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+86400,user:testUser(actor,actor===A?'Alex':actor===B?'Lu':'Caro')})
    return ctx
  }
  async function choose(p){if(await p.evaluate(()=>!!sessionStorage.getItem('suizamente:cuenta-activa')))return;await p.getByRole('button',{name:'Entrar con cuenta de Latido',exact:true}).click();await p.getByRole('button',{name:/A jugar/}).click()}
  async function enter(p,path){await p.goto(preview.origin+path);await choose(p)}
  async function navigate(path){await page.evaluate(path=>{history.pushState({},'',path);window.dispatchEvent(new PopStateEvent('popstate'))},path)}
  const ctx=await context();page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message))
  const dialog=()=>page.getByRole('dialog'),title=()=>dialog().getByRole('heading',{level:1})
  async function layout(name){
    for(const width of [320,390,1440]){
      await page.setViewportSize({width,height:844});await expect(dialog()).toBeVisible()
      assert.equal(await page.locator('[data-momento]').count(),1,'Only one moment')
      assert.ok(await dialog().evaluate(el=>el.clientWidth===innerWidth&&el.clientHeight===innerHeight&&el.scrollWidth<=el.clientWidth),'Fullscreen, no horizontal overflow '+JSON.stringify(await dialog().evaluate(el=>({w:el.clientWidth,h:el.clientHeight,sw:el.scrollWidth,iw:innerWidth,ih:innerHeight,dpr:devicePixelRatio,css:getComputedStyle(el).height}))))
      assert.ok(await page.locator('.sv-moment-page').evaluate(el=>el.scrollWidth<=el.clientWidth),'Content fits')
      assert.ok(await dialog().evaluate(el=>el===document.activeElement||el.contains(document.activeElement)),'Focus stays in dialog')
      assert.equal(await page.locator('#root').evaluate(el=>el.inert),true)
      assert.ok(await page.evaluate(()=>!!document.elementFromPoint(20,innerHeight-20)?.closest('[data-momento]')),'Layer covers bottom navigation')
      const snapshot=await dialog().ariaSnapshot();assert.ok(snapshot.includes(await title().innerText()))
      await page.screenshot({path:out+'/'+name+'-'+width+'.png'})
      if(name==='regalo-abierto'&&width===390){await page.setViewportSize({width:390,height:1008});await page.screenshot({path:out+'/regalo-abierto-referencia.png'})}
    }
    await page.setViewportSize({width:390,height:844})
  }
  async function skip(){await dialog().getByRole('button',{name:'Omitir',exact:true}).click()}
  const money=async actor=>(await call(db,actor,'jugador')).jugador.monedas
  await enter(page,'/suizamente');await expect(title()).toHaveText('Mientras no estabas');await layout('ausencia')
  assert.equal((await db.query("SELECT leida FROM suizamente_private.suizamente_novedades WHERE ref='fixture-moment'")).rows[0].leida,false)
  await page.keyboard.press('Tab');await expect(dialog().getByRole('button',{name:'Omitir'})).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(dialog()).toBeFocused()
  let failRead=true
  await page.route('**/novedades/leer',async route=>{if(failRead){failRead=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Sin conexión de prueba'})})}else await route.continue()})
  await page.keyboard.press('Escape');await expect(title()).toHaveText('¡Regalo diario!')
  assert.equal((await db.query("SELECT leida FROM suizamente_private.suizamente_novedades WHERE ref='fixture-moment'")).rows[0].leida,false)
  assert.ok((await page.evaluate(owner=>JSON.parse(localStorage.getItem('suizamente:momentos:lecturas:'+owner)),A)).length)
  await page.unroute('**/novedades/leer')
  await layout('regalo');const claimed=await money(A)
  await page.keyboard.press('Enter');await expect(title()).toHaveText('¡Esto es para ti!');await layout('regalo-abierto')
  assert.match(await dialog().ariaSnapshot(),/monedas/);assert.ok((await dialog().ariaSnapshot()).includes('+'+rules.recompensas.regaloDiario.monedas))
  await skip();await expect(dialog()).toHaveCount(0);assert.equal(await money(A),claimed)
  await page.reload();await choose(page);await expect(page.locator('.sv-home-screen')).toBeVisible();await page.waitForTimeout(600);await expect(dialog()).toHaveCount(0)
  assert.equal((await db.query("SELECT leida FROM suizamente_private.suizamente_novedades WHERE ref='fixture-moment'")).rows[0].leida,true)
  checks.push('absence before gift; read only on close; Enter/Space/Escape/Omitir; focus trap and ARIA; no repeat after reload')
  // Shop uses the very same claim and layer, and skipping the closed object keeps the reward.
  const shopCtx=await context(C,'no-preference'),shopPage=await shopCtx.newPage();await enter(shopPage,'/suizamente/tienda')
  const beforeGift=await money(C);await shopPage.locator('.sv-daily-gift').click();await expect(shopPage.getByRole('dialog').getByRole('heading')).toHaveText('¡Regalo diario!')
  assert.equal(await money(C),beforeGift+rules.recompensas.regaloDiario.monedas)
  await expect(shopPage.locator('.sv-moment-gift')).toHaveCSS('animation-name','sz-flotar')
  await shopPage.getByRole('dialog').click({position:{x:40,y:300}});await expect(shopPage.locator('.sv-moment-content')).toHaveClass(/opening/)
  await expect(shopPage.getByRole('dialog').getByRole('heading')).toHaveText('¡Esto es para ti!');await shopPage.getByRole('button',{name:'Omitir',exact:true}).click();await expect(shopPage.locator('.sv-daily-gift')).toBeDisabled()
  // The first pack on a clean account necessarily has at least one new card.
  const newPack=await call(db,C,'abrir_sobre',{clave:crypto.randomUUID()})
  await shopPage.evaluate(path=>{history.pushState({},'',path);window.dispatchEvent(new PopStateEvent('popstate'))},'/suizamente/sobre/'+newPack.id)
  await expect(shopPage.getByRole('dialog').getByRole('heading')).toHaveText('¡Nuevo sobre!');await shopPage.keyboard.press('Escape');await expect(shopPage.getByRole('dialog')).toHaveCount(0)
  assert.ok((await call(db,C,'sobre',{id:newPack.id})).cartas.some(c=>c.nueva))
  await shopCtx.close();checks.push('shop shares daily gift; rewards committed before display; opening animation; new cards survive skipping closed pack')
  // Every card is already owned in this fixture: duplicate compensation is deterministic.
  await db.query("INSERT INTO suizamente_private.suizamente_cartas(jugador_id,carta_id) SELECT $1,card->>'id' FROM jsonb_array_elements(suizamente_private.v6_colecciones()) col CROSS JOIN LATERAL jsonb_array_elements(col->'cartas') card ON CONFLICT DO NOTHING",[A])
  const pack=await call(db,A,'abrir_sobre',{clave:crypto.randomUUID()})
  await navigate('/suizamente/sobre/'+pack.id);await expect(title()).toHaveText('¡Nuevo sobre!');await layout('sobre')
  const savedPack=await call(db,A,'sobre',{id:pack.id});assert.equal(savedPack.giradas,savedPack.total)
  await page.keyboard.press('Space');await expect(title()).toHaveText(/cartas? nuevas?|Todas repetidas/);await layout('cartas')
  await expect(dialog().locator('.sv-moment-card')).toHaveCount(savedPack.total);await expect(dialog()).toContainText('🪙 +'+savedPack.cartas.find(c=>!c.nueva).monedas)
  const afterPack=await money(A);await skip();await page.reload();await choose(page);await expect(page.locator('.sv-pack')).toBeVisible();await expect(dialog()).toHaveCount(0);assert.equal(await money(A),afterPack)
  checks.push('pack saved in full before reveal; duplicate compensation from response; skip/reload do not award twice')
  // Every chest type shares one opening path, including capped shields.
  for(const [type,titleText,reward] of [['region','¡Región completada!',rules.cofres.region],['diario','Cofre diario',config.misiones.cofreDiario]]){
    const content=reward||rules.cofres.victoria
    const chest=(await db.query('SELECT suizamente_private.v5_cofre($1,$2,$3,$4,$5::jsonb) id',[A,type,crypto.randomUUID(),titleText,JSON.stringify(content)])).rows[0]
    await navigate('/suizamente/cofre/'+chest.id);await expect(title()).toHaveText(titleText);await layout('cofre-'+type)
    await page.keyboard.press('Enter');await expect(title()).toHaveText('Dentro había…');await layout('cofre-'+type+'-abierto');await skip()
    assert.ok((await call(db,A,'cofre',{id:chest.id})).abierto);await page.reload();await choose(page);await expect(page.locator('.sv-chest')).toBeVisible();await expect(dialog()).toHaveCount(0)
  }
  // A seal's actual answer result leads to its moment, then back to the match.
  await db.exec('DELETE FROM suizamente_private.suizamente_limites')
  const match=await call(db,A,'crear_partida',{rival:B}),mid=match.id
  await db.query("UPDATE suizamente_private.suizamente_partidas SET fase='sello',barra_a=3 WHERE id=$1",[mid])
  let m=await call(db,A,'partida',{id:mid});m=await call(db,A,'pregunta',{id:mid,turnoN:m.turnoN,modo:'sello',categoria:config.categorias[2].id})
  await navigate('/suizamente/partida/'+mid);await expect(page.locator('.sv-question-card')).toBeVisible()
  const payload=(await db.query('SELECT payload FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=$1 AND n=$2',[mid,m.pregunta.n])).rows[0].payload
  await page.locator('.sv-options button').nth(m.pregunta.opciones.findIndex(o=>o.t===payload.opciones[payload.correcta].t)).click();await page.getByRole('button',{name:'Continuar',exact:true}).click()
  await expect(title()).toHaveText('¡Sello conseguido!');await layout('sello');await skip();await expect(dialog()).toHaveCount(0)
  // Duel won/lost, then a win after the final stolen seal: must queue rather than overlap.
  await db.exec('DELETE FROM suizamente_private.suizamente_limites')
  const duelMatch=await call(db,A,'crear_partida',{rival:B}),take=config.categorias.at(-1).id,bet=config.categorias[0].id
  await db.query("UPDATE suizamente_private.suizamente_partidas SET fase='sello',barra_a=3,sellos_a=$2,sellos_b=$3 WHERE id=$1",[duelMatch.id,config.categorias.slice(0,-1).map(c=>c.id),[take]])
  m=await call(db,A,'partida',{id:duelMatch.id});m=await call(db,A,'duelo',{id:m.id,turnoN:m.turnoN,quitar:take,apostar:bet})
  await solveDuel(duelMatch.id,[A,B],A)
  await navigate('/suizamente/partida/'+m.id+'?continuar=1');await expect(title()).toHaveText('¡Duelo ganado!');await layout('duelo-ganado');await skip();await expect(page.locator('.sv-duel-result')).toBeVisible()
  await page.getByRole('button',{name:'▶ Seguir la partida',exact:true}).click();await expect(title()).toHaveText('¡Victoria!');await layout('victoria')
  const winMoney=await money(A);await skip();await expect(page.locator('.sv-game-finish')).toBeVisible();await page.reload();await choose(page);await expect(page.locator('.sv-game-finish')).toBeVisible();await expect(dialog()).toHaveCount(0);assert.equal(await money(A),winMoney)
  const finished=await call(db,A,'partida',{id:m.id});await navigate('/suizamente/cofre/'+finished.cofre.id);await expect(title()).toHaveText(finished.cofre.titulo);await page.keyboard.press('Enter');await expect(title()).toHaveText('Dentro había…');await skip()
  const loserCtx=await context(B),loser=await loserCtx.newPage();await enter(loser,'/suizamente/partida/'+m.id+'?continuar=1');await expect(loser.getByRole('dialog').getByRole('heading')).toHaveText('Duelo perdido')
  const original=page;page=loser;await layout('duelo-perdido');await skip();await page.getByRole('button',{name:'▶ Seguir la partida',exact:true}).click();await expect(title()).toHaveText('Esta vez no');await layout('derrota');await skip();await loserCtx.close();page=original
  checks.push('all chest types; seal; duel won/lost before DuelResult; duel then victory; defeat; finish not repeated on reload')
  // A real five-answer raid, both with and without a shield, plus a failed one.
  for(const variant of ['exito','escudo','fallo']){
    await db.exec('DELETE FROM suizamente_private.suizamente_limites')
    await db.query("INSERT INTO suizamente_private.suizamente_mapa(jugador_id,vuelta,canton,nivel) VALUES($1,1,'LU',1) ON CONFLICT(jugador_id,vuelta,canton) DO UPDATE SET nivel=1",[B])
    if(variant==='escudo')await db.query("SELECT suizamente_private.v3_anotar($1,'fixture',$2,0,0,'{\"escudos\":1}')",[B,crypto.randomUUID()])
    const raidMatch=await call(db,A,'crear_partida',{rival:B});await db.query("SELECT suizamente_private.v2_cerrar($1,$2,'sellos')",[raidMatch.id,A])
    const raid=await call(db,A,'atacar',{id:raidMatch.id,canton:'LU'})
    await navigate('/suizamente/asalto/'+raid.id);await expect(page.locator('.sv-question-card')).toBeVisible()
    const total=variant==='fallo'?1:config.asaltos.preguntasTrasVictoria
    for(let i=1;i<=total;i++){
      await db.exec('DELETE FROM suizamente_private.suizamente_limites')
      const state=await call(db,A,'asalto',{id:raid.id}),payload=(await db.query('SELECT payload FROM suizamente_private.suizamente_asaltos WHERE id=$1',[raid.id])).rows[0].payload
      const option=variant==='fallo'?(payload.correcta+1)%payload.opciones.length:payload.correcta
      await page.locator('.sv-options button').nth(state.pregunta.opciones.findIndex(o=>o.t===payload.opciones[option].t)).click()
      await page.getByRole('button',{name:i<total?'Siguiente pregunta '+(i+1)+'/'+config.asaltos.preguntasTrasVictoria:'Ver el asalto',exact:true}).click()
      if(i<total)await expect(page.locator('.sv-question-card')).toBeVisible()
    }
    await expect(title()).toHaveText(variant==='exito'?'¡Asalto con éxito!':variant==='escudo'?'¡Lo paró un escudo!':'Asalto fallido');await layout('asalto-'+variant)
    const saved=await call(db,A,'asalto',{id:raid.id});if(saved.premio)await expect(dialog()).toContainText('+'+saved.premio)
    await skip();await expect(page).toHaveURL(new RegExp('/partida/'+raidMatch.id));await expect(title()).toHaveText('¡Victoria!');await skip()
  }
  checks.push('raid success/shield/failure use server amounts and losses; return to match')
  // Returning player: actual unread raids and a finished duel, then their daily gift.
  await db.exec('DELETE FROM suizamente_private.suizamente_limites')
  const away=await call(db,B,'crear_partida',{rival:C})
  await db.query("UPDATE suizamente_private.suizamente_partidas SET fase='sello',barra_a=3,sellos_a=$2,sellos_b=$3 WHERE id=$1",[away.id,[bet],[take]])
  const beforeAway=await call(db,B,'partida',{id:away.id})
  await call(db,B,'duelo',{id:away.id,turnoN:beforeAway.turnoN,quitar:take,apostar:bet});await solveDuel(away.id,[B,C],B)
  const awayCtx=await context(B),awayPage=await awayCtx.newPage();await enter(awayPage,'/suizamente');await expect(awayPage.getByRole('dialog').getByRole('heading')).toHaveText('Mientras no estabas')
  await expect(awayPage.getByRole('dialog')).toContainText('Has ganado el duelo contra Caro');await expect(awayPage.getByRole('dialog')).toContainText('Lucerna')
  assert.equal((await call(db,B,'partida',{id:away.id})).duelo.mostrarResultado,true)
  await awayPage.keyboard.press('Escape');await expect(awayPage.getByRole('dialog').getByRole('heading')).toHaveText('¡Regalo diario!')
  await expect.poll(async()=>(await call(db,B,'partida',{id:away.id})).duelo.mostrarResultado).toBe(false)
  await expect.poll(async()=>(await call(db,B,'jugador')).novedades.filter(n=>n.tipo==='asalto').length).toBe(0)
  await awayPage.keyboard.press('Escape');await awayPage.reload();await choose(awayPage);await expect(awayPage.locator('.sv-home-screen')).toBeVisible();await awayPage.waitForTimeout(600);await expect(awayPage.getByRole('dialog')).toHaveCount(0);await awayCtx.close()
  checks.push('real unread raids and completed duel acknowledged on absence close; gift follows; no repetition after reconnect')
  // In-app reduction disables every animation independently of the OS.
  await page.emulateMedia({reducedMotion:'no-preference'})
  await db.query("UPDATE suizamente_private.suizamente_jugadores SET ajustes=ajustes||'{\"menosAnimaciones\":true}' WHERE jugador_id=$1",[A])
  const quietMatch=await call(db,A,'crear_partida',{rival:B});await db.query("SELECT suizamente_private.v2_cerrar($1,$2,'sellos')",[quietMatch.id,A])
  await page.reload();await choose(page);await expect(page.locator('.sv-game-finish')).toBeVisible();await navigate('/suizamente/partida/'+quietMatch.id+'?continuar=1');await expect(dialog()).toBeVisible()
  assert.ok(await dialog().evaluate(el=>[el,...el.querySelectorAll('*')].every(node=>getComputedStyle(node).animationName==='none')))
  await page.setViewportSize({width:320,height:568});assert.ok(await page.locator('.sv-moment-page').evaluate(el=>el.scrollWidth<=el.clientWidth));await skip()
  checks.push('Menos animaciones and OS reduction; 320x568 scrollable content')
  // Test-only mounted harness: two calls in the same effect, plus a duplicate key.
  // Nothing is exported to the production app to expose this test.
  await writeFile('output/momentos/queue-harness.jsx',`import React,{useEffect} from 'react';import {createRoot} from 'react-dom/client';import {MomentProvider,useMoment} from '../../game/src/components/suizamente/v2/Moment';function Trigger(){const {show}=useMoment();useEffect(()=>{for(const n of [1,2,2])show([{title:'En cola '+n,body:<p>Premio {n}</p>}],{key:'queue-'+n,onFinish:()=>window.queueFinished.push(n)})},[show]);return null}export function mount(){window.queueFinished=[];const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);root.render(<MomentProvider owner="qa" reduced><Trigger/></MomentProvider>);return()=>{root.unmount();host.remove()}}`)
  await page.evaluate(async()=>{const harness=await import('/output/momentos/queue-harness.jsx');window.unmountQueue=harness.mount()})
  await expect(title()).toHaveText('En cola 1');assert.equal(await dialog().count(),1);await page.keyboard.press('Enter');await expect(title()).toHaveText('En cola 2');assert.equal(await dialog().count(),1);await skip();await expect(dialog()).toHaveCount(0);assert.deepEqual(await page.evaluate(()=>window.queueFinished),[1,2]);await page.evaluate(()=>window.unmountQueue())
  checks.push('simultaneous calls queue in order, deduplicate keys, and never render two dialogs')
  // Exact pantallas.html reference captures and a portable side-by-side contact sheet.
  const design=resolve(process.env.SUIZAMENTE_DESIGN_ROOT||'../../../latido/suizamente')
  referenceServer=createServer(async(req,res)=>{try{const path=resolve(design,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!path.startsWith(design))throw Error('path');res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml'})[extname(path)]||'application/octet-stream');res.end(await readFile(path))}catch{res.statusCode=404;res.end()}})
  await new Promise(r=>referenceServer.listen(0,'127.0.0.1',r));const ref=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'})
  await ref.goto('http://127.0.0.1:'+referenceServer.address().port+'/disenos/pantallas.html');await ref.evaluate(()=>document.fonts.ready)
  for(const [id,name] of [['MomentoRegaloAbierto','regalo-abierto'],['MomentoSello','sello'],['MomentoVictoria','victoria']])await ref.locator('#p-'+id+' .marco').screenshot({path:out+'/referencia-'+name+'.png'})
  await writeFile(out+'/comparacion.html','<!doctype html><meta charset="utf-8"><title>Momentos · diseño y app</title><style>body{font:16px system-ui;background:#eef1f5}section{display:flex;gap:20px;align-items:start;margin-bottom:40px}figure{margin:0}img{width:390px;max-width:100%}</style><h1>Momentos · 390 px</h1>'+['regalo-abierto','sello','victoria'].map(name=>'<h2>'+name+'</h2><section><figure><figcaption>pantallas.html</figcaption><img src="referencia-'+name+'.png"></figure><figure><figcaption>App · SQL temporal</figcaption><img src="'+name+(name==='regalo-abierto'?'-referencia':'-390')+'.png"></figure></section>').join(''))
  const comparison=await browser.newPage({viewport:{width:850,height:1000}});await comparison.goto('file:///'+resolve(out,'comparacion.html').replaceAll('\\','/'));await comparison.screenshot({path:out+'/comparacion.png',fullPage:true})
  assert.deepEqual(errors,[]);await writeFile(out+'/resultado.json',JSON.stringify({engine,checks,errors},null,2));console.log('Momentos '+engine+': '+checks.join('; ')+'.')
}catch(error){console.error(error.stack);await page?.screenshot({path:out+'/fallo.png',fullPage:true}).catch(()=>{});process.exitCode=1}
finally{await browser?.close();await preview?.close();await new Promise(r=>referenceServer?referenceServer.close(r):r())}
