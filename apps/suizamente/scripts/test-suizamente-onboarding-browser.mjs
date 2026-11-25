import assert from 'node:assert/strict'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {createServer} from 'node:http'
import {resolve,extname} from 'node:path'
import {chromium,webkit,expect as rawExpect} from '@playwright/test'
import {startSuizamentePreview,testToken,testUser} from './lib/suizamente-v2-preview.mjs'
import {A,C,call} from './lib/suizamente-v2-test-db.mjs'
const engine=process.argv.includes('--webkit')?'webkit':'chromium',out='output/primera-vez/'+engine,expect=rawExpect.configure({timeout:15000})
let preview,browser,page,refServer
const errors=[],checks=[],design=resolve(process.env.SUIZAMENTE_DESIGN_ROOT||'../../../latido/suizamente')
try{
 await mkdir(out,{recursive:true});preview=await startSuizamentePreview(engine==='webkit'?5351:5350,{hmr:false})
 await call(preview.db,C,'borrar_jugador',{confirmacion:'BORRAR'})
 browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,args:engine==='chromium'?['--enable-unsafe-swiftshader']:[]})
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'})
 await ctx.addInitScript(()=>{sessionStorage.setItem('suizamente:apertura','1');Object.defineProperty(navigator,'standalone',{get:()=>true})})
 page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message))
 const firstResponse=page.waitForResponse(r=>r.url().endsWith('/api/suizamente/primera-vez')&&r.status()===200)
 await page.goto(preview.origin+'/suizamente');await expect(page.getByRole('img',{name:'Paso 1 de 5'})).toBeVisible()
 const safe=await(await firstResponse).json();assert.ok(!/correcta|dato|resultado/.test(JSON.stringify(safe)))
 await expect(page.getByRole('img',{name:/Ejemplos de preguntas:/})).toBeVisible();await expect(page.getByText(/siempre real/)).toHaveCount(0)
 async function capture(name){for(const width of [320,390,1440]){await page.setViewportSize({width,height:844});await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);await page.screenshot({path:out+'/'+name+'-'+width+'.png',fullPage:true})}await page.setViewportSize({width:390,height:844})}
 await capture('paso-1');await page.getByRole('button',{name:'Empezar',exact:true}).click();await expect(page.getByRole('img',{name:'Paso 2 de 5'})).toBeVisible();await capture('paso-2')
 await page.locator('.sv-onb-practice .sv-options button').nth(safe.pregunta.opciones.findIndex(o=>o.t==='Te devuelven el dinero del billete')).click();await expect(page.locator('.sv-onb-practice .correct')).toHaveCount(1);await expect(page.locator('.sv-onb-practice .wrong')).toHaveCount(1);await expect(page.locator('.sv-onboarding-copy h1')).toBeFocused();await capture('paso-2-respondido')
 await page.getByRole('button',{name:'Siguiente',exact:true}).click();await capture('paso-3');await expect(page.locator('.sv-onb-wheel [data-light]')).toHaveAttribute('data-light','2')
 await page.getByRole('button',{name:'Siguiente',exact:true}).click();await expect(page.locator('.sv-onb-levels .active')).toContainText('Monumento');await capture('paso-4');await page.waitForTimeout(1600);await expect(page.locator('.sv-onb-levels .active')).toContainText('Monumento')
 assert.equal(await page.locator('.sv-onb-new').evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==='running').length),0,'reduced motion is static')
 await page.getByRole('button',{name:'Siguiente',exact:true}).click();await expect(page.locator('.sv-onb-map-frame canvas')).toHaveCount(0);await capture('paso-5')
 await page.setViewportSize({width:320,height:568});assert.ok((await page.getByRole('button',{name:'🎁 Abrir mi regalo',exact:true}).boundingBox()).y<568);await expect(page.getByRole('button',{name:'🎁 Abrir mi regalo',exact:true})).toBeInViewport();await page.screenshot({path:out+'/pantalla-baja-320.png'});await page.setViewportSize({width:390,height:844})
 await page.getByRole('button',{name:'🎁 Abrir mi regalo',exact:true}).click();await expect(page.getByRole('dialog')).toHaveAccessibleName('¡Tu regalo de bienvenida!');await capture('momento-cerrado');await page.keyboard.press('Enter');await expect(page.getByRole('dialog')).toHaveAccessibleName('¡Esto es para ti!');await expect(page.getByText('Toca para jugar',{exact:true})).toBeVisible();await capture('momento-abierto');await page.getByRole('button',{name:'Omitir',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0)
 assert.equal((await preview.db.query("SELECT count(*)::int n FROM suizamente_private.suizamente_movimientos WHERE jugador_id=$1 AND motivo='bienvenida'",[C])).rows[0].n,0,'no gift before profile exists')
 await page.reload();await expect(page.locator('.sv-onb-new')).toHaveCount(0)
 await page.evaluate(session=>localStorage.setItem('sb-127-auth-token',JSON.stringify(session)),{access_token:testToken(C),refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+86400,user:testUser(C,'Caro')})
 await page.reload();await page.getByRole('button',{name:'Entrar con cuenta de Latido',exact:true}).click();await expect(page.getByRole('heading',{name:'Tu perfil',exact:true})).toBeVisible();await page.getByRole('button',{name:/A jugar/}).click();await expect(page.getByRole('heading',{name:'Nueva partida',exact:true})).toBeVisible()
 const player=await call(preview.db,C,'jugador');assert.deepEqual(player.jugador.ajustes.guia,{giro:true,comodin:true})
 checks.push('five steps, safe real practice, focused correction, accessible fan/progress, three widths, static reduced 3D, deferred gift and profile → New game')
 const match=await call(preview.db,C,'crear_partida',{rival:A})
 await preview.db.query("UPDATE suizamente_private.suizamente_partidas SET reglas=jsonb_set(reglas,'{ruleta,casillas}','[\"casa\"]') WHERE id=$1",[match.id])
 const navigate=async path=>page.evaluate(path=>{history.pushState({},'',path);window.dispatchEvent(new window.PopStateEvent('popstate'))},path)
 await navigate('/suizamente/partida/'+match.id);await expect(page.getByRole('note')).toContainText('Tu primera partida');await capture('pista-ruleta');await page.getByRole('button',{name:'Girar la ruleta',exact:true}).click();await expect(page.getByRole('note')).toContainText('¿Dudas? Usa un comodín');await capture('pista-pregunta')
 const q=await call(preview.db,C,'partida',{id:match.id});assert.notEqual(q.pregunta.preguntaId,'vidrio_domingo');assert.ok(Date.parse(q.pregunta.venceEn)>Date.now())
 await page.locator('.sv-game .sv-options button').first().click();await expect(page.getByRole('note')).toHaveCount(0);assert.equal((await call(preview.db,C,'jugador')).jugador.ajustes.guia,undefined)
 await navigate('/suizamente/primera-vez?repetir=1');await page.getByRole('button',{name:'Saltar',exact:true}).click();await expect(page.getByRole('img',{name:'Paso 5 de 5'})).toBeVisible();await page.getByRole('button',{name:'✓ Listo',exact:true}).click();await expect(page.getByRole('heading',{name:'Ajustes',exact:true})).toBeVisible()
 await call(preview.db,C,'primera_vez_finalizar');assert.equal((await call(preview.db,C,'jugador')).jugador.ajustes.guia,undefined)
 assert.equal((await preview.db.query("SELECT count(*)::int n FROM suizamente_private.suizamente_movimientos WHERE jugador_id=$1 AND motivo='bienvenida'",[C])).rows[0].n,1)
 checks.push('both notes within play, real timer runs, persistent dismissal, skip → step 5, settings replay without gift, reload and retry do not award twice')
 // Real animation cycle and disposal; an isolated anonymous visitor exercises WebGL.
 const motionCtx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'no-preference'}),motion=await motionCtx.newPage()
 await motion.addInitScript(()=>sessionStorage.setItem('suizamente:apertura','1'));await motion.goto(preview.origin+'/suizamente');await motion.getByRole('button',{name:'Empezar',exact:true}).click();await motion.getByRole('button',{name:'Ahora no',exact:true}).click();await motion.getByRole('button',{name:'Siguiente',exact:true}).click()
 await expect(motion.locator('.sv-onb-levels .active')).toContainText('Naturaleza');await expect(motion.locator('.sv-onb-levels .active')).toContainText('Pueblo');await expect(motion.locator('.sv-onb-levels .active')).toContainText('Monumento');if(engine==='chromium')await expect(motion.locator('.sv-onb-map-frame canvas')).toHaveCount(1)
 await motion.getByRole('button',{name:'Siguiente',exact:true}).click();await expect(motion.locator('.sv-onb-map-frame canvas')).toHaveCount(0);await motion.getByRole('button',{name:'🎁 Abrir mi regalo',exact:true}).click();await motion.keyboard.press('Escape');await expect(motion.getByRole('dialog')).toHaveCount(0);await motionCtx.close()
 const fallbackCtx=await browser.newContext({reducedMotion:'no-preference',viewport:{width:320,height:740}}),fallback=await fallbackCtx.newPage()
 await fallback.addInitScript(()=>{sessionStorage.setItem('suizamente:apertura','1');localStorage.setItem('suizamente:ajustes',JSON.stringify({menosAnimaciones:true}));const get=window.HTMLCanvasElement.prototype.getContext;window.HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:get.call(this,type,...args)}})
 await fallback.goto(preview.origin+'/suizamente');await fallback.getByRole('button',{name:'Empezar',exact:true}).click();await fallback.getByRole('button',{name:'Ahora no',exact:true}).click();await fallback.getByRole('button',{name:'Siguiente',exact:true}).click();await expect(fallback.locator('.sv-onb-map-frame svg')).toBeVisible();await fallback.screenshot({path:out+'/sin-webgl-320.png'});await fallbackCtx.close()
 for(const direct of ['/suizamente/invitar/ejemplo','/suizamente/pregunta-del-dia','/suizamente?p=ejemplo']){const directCtx=await browser.newContext(),directPage=await directCtx.newPage();await directPage.goto(preview.origin+direct);await expect(directPage.locator('.sv-login-screen')).toBeVisible();await expect(directPage.locator('.sv-onb-new')).toHaveCount(0);await directCtx.close()}
 checks.push('animated Lucerne 1 → 2 → 3 and WebGL disposal, SVG fallback, Escape, invitation/day deep links bypass onboarding')
 if(!process.argv.includes('--functional-only')){
 refServer=createServer(async(req,res)=>{try{const path=resolve(design,'.'+decodeURIComponent(req.url.split('?')[0]));if(!path.startsWith(design))throw Error('path');res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml'})[extname(path)]||'application/octet-stream');res.end(await readFile(path))}catch{res.statusCode=404;res.end()}});await new Promise(r=>refServer.listen(0,'127.0.0.1',r))
 const ref=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});await ref.goto('http://127.0.0.1:'+refServer.address().port+'/disenos/pantallas.html');await ref.evaluate(()=>document.fonts.ready)
 const pairs=[['OnbHola','paso-1'],['OnbElige','paso-2'],['OnbAprende','paso-3'],['OnbReta','paso-4'],['OnbEmpieza','paso-5'],['MomentoBienvenida','momento-cerrado'],['PartidaPrimera','pista-ruleta'],['PreguntaPrimera','pista-pregunta']]
 for(const [id,name] of pairs)await ref.locator('#p-'+id+' .marco').screenshot({path:out+'/referencia-'+name+'.png'})
 await writeFile(out+'/comparacion.html','<!doctype html><meta charset="utf-8"><title>Primera vez · referencia y app</title><style>body{font:16px system-ui;background:#eef1f5}section{display:flex;gap:20px;align-items:start;margin-bottom:40px}figure{margin:0}img{width:390px;max-width:100%}</style><h1>Onboarding · 390 px</h1>'+pairs.map(([,name])=>'<h2>'+name+'</h2><section><figure><figcaption>pantallas.html</figcaption><img src="referencia-'+name+'.png"></figure><figure><figcaption>App</figcaption><img src="'+name+'-390.png"></figure></section>').join(''))
 const comparison=await browser.newPage({viewport:{width:850,height:1000}});await comparison.goto('file:///'+resolve(out,'comparacion.html').replaceAll('\\','/'));await comparison.screenshot({path:out+'/comparacion.png',fullPage:true})
 }
 assert.deepEqual(errors,[]);await writeFile(out+'/resultado.json',JSON.stringify({engine,checks,errors},null,2));console.log('Onboarding '+engine+': '+checks.join('; ')+'.')
}catch(error){console.error(error.stack);await page?.screenshot({path:out+'/fallo.png',fullPage:true}).catch(()=>{});process.exitCode=1}finally{await browser?.close();await preview?.close();await new Promise(r=>refServer?refServer.close(r):r())}
