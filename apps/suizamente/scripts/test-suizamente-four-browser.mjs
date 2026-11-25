import assert from 'node:assert/strict'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {createServer} from 'node:http'
import {resolve,extname} from 'node:path'
import {chromium,webkit,expect as rawExpect} from '@playwright/test'
import {startSuizamentePreview,testToken,testUser} from './lib/suizamente-v2-preview.mjs'
import {A,B,call} from './lib/suizamente-v2-test-db.mjs'
const engine=process.argv.includes('--webkit')?'webkit':'chromium',out='output/cuatro-opciones/'+engine,expect=rawExpect.configure({timeout:15000}),errors=[],checks=[]
const design=resolve(process.env.SUIZAMENTE_DESIGN_ROOT||'../../../latido/suizamente')
let browser,preview,page,reference
try{
 await mkdir(out,{recursive:true});preview=await startSuizamentePreview(engine==='webkit'?5371:5370,{hmr:false})
 const bank=JSON.parse(await readFile('server/suizamente/data/preguntas.json','utf8')).preguntas,q=bank.find(q=>q.pregunta.includes('Grüezi')&&q.opciones.length===4),db=preview.db
 assert.ok(q);await db.query("INSERT INTO suizamente_private.suizamente_votos(pregunta_id,jugador_id,opcion) SELECT $1,'fixture-'||i,$2 FROM generate_series(1,19) i",[q.id,q.correcta])
 await db.exec('UPDATE suizamente_private.suizamente_novedades SET leida=true')
 browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,args:engine==='chromium'?['--enable-unsafe-swiftshader']:[]})
 const context=async actor=>{const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await ctx.addInitScript(({actor,session})=>{localStorage.setItem('sb-127-auth-token',JSON.stringify(session));sessionStorage.setItem('suizamente:cuenta-activa',actor);sessionStorage.setItem('suizamente:apertura','1');Object.defineProperty(navigator,'standalone',{get:()=>true})},{actor,session:{access_token:testToken(actor),refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+86400,user:testUser(actor,actor===A?'Alex':'Lu')}});return ctx}
 async function match(actor){const m=await call(db,actor,'crear_partida',{rival:actor===A?B:A});await db.query("SELECT suizamente_private.v4_preguntar($1,$2,'idioma','normal',$3)",[m.id,actor,JSON.stringify(q)]);const state=await call(db,actor,'partida',{id:m.id});await db.exec('UPDATE suizamente_private.suizamente_novedades SET leida=true');return state}
 const ctx=await context(A);page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message))
 const sent=[];page.on('request',r=>{if(r.url().endsWith('/respuesta')&&r.method()==='POST')sent.push(r.postDataJSON())})
 let state=await match(A);await page.goto(preview.origin+'/suizamente/partida/'+state.id)
 await expect(page.locator('.sv-answer-options button')).toHaveCount(4);await expect(page.locator('.sv-answer-options button>span:not(.sv-sr-only)')).toHaveCount(0)
 assert.equal(await page.locator('.sv-answer-options button').first().evaluate(e=>window.getComputedStyle(e).textAlign),'center')
 async function capture(name){for(const [width,height] of [[320,740],[390,844],[1440,900],[375,667]]){await page.setViewportSize({width,height});await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' no overflow');if(name==='pregunta'){const last=await page.locator('.sv-answer-options button').last().boundingBox(),power=await page.locator('.sv-powerups').boundingBox();assert.ok(last.y+last.height<=power.y+1,'options do not overlap powerups '+width)}await page.screenshot({path:out+'/'+name+'-'+width+'.png',fullPage:true})}await page.setViewportSize({width:390,height:844})}
 await capture('pregunta')
 const elapsed=await call(db,A,'partida',{id:state.id});assert.ok(Date.parse(elapsed.pregunta.venceEn)>Date.now())
 const remove=page.getByRole('button',{name:/^Quita una: tienes/});await expect(remove).toBeEnabled();await remove.click();await expect(page.locator('.sv-option-removed')).toHaveCount(1)
 assert.equal(await page.locator('.sv-option-removed>b').evaluate(e=>window.getComputedStyle(e).textDecorationLine),'line-through')
 state=await call(db,A,'partida',{id:state.id});assert.notEqual(state.pregunta.quitadas[0],state.pregunta.opciones.find(o=>o.t===q.opciones[q.correcta].t).indice)
 const correct=page.locator('.sv-answer-options button').nth(state.pregunta.opciones.findIndex(o=>o.t===q.opciones[q.correcta].t));await correct.click();await expect(page.locator('.sv-result-title')).toHaveText('¡Correcto!');await expect(page.locator('.sv-answer-options .correct')).toContainText('Correcta: ');assert.equal(sent.at(-1).opcion,state.pregunta.opciones.findIndex(o=>o.t===q.opciones[q.correcta].t))
 assert.equal((await db.query('SELECT opcion FROM suizamente_private.suizamente_votos WHERE jugador_id=$1 AND pregunta_id=$2',[A,q.id])).rows[0].opcion,q.correcta)
 await expect(page.locator('.sv-stat')).toContainText('100 %');await capture('acierto');checks.push('four centered emoji-free choices, 320/375×667/390/desktop, powerups never overlap, Quita una and correct original vote/percentage')
 const wrongCtx=await context(B),wrong=await wrongCtx.newPage();let bad=await match(B);await wrong.goto(preview.origin+'/suizamente/partida/'+bad.id);await expect(wrong.locator('.sv-answer-options button')).toHaveCount(4)
 await wrong.locator('.sv-answer-options button').nth(bad.pregunta.opciones.findIndex(o=>o.t===q.opciones[3].t)).click();await expect(wrong.locator('.sv-result-title')).toHaveText('¡Uy! No era esa');await expect(wrong.locator('.sv-answer-options .wrong')).toContainText('Tu respuesta, incorrecta: ')
 assert.equal((await db.query('SELECT opcion FROM suizamente_private.suizamente_votos WHERE jugador_id=$1 AND pregunta_id=$2',[B,q.id])).rows[0].opcion,3);await expect(wrong.locator('.sv-stat')).toContainText('95 %')
 const original=page;page=wrong;await capture('fallo');page=original
 const orders=new Set();for(let i=0;i<8;i++)orders.add((await match(A)).pregunta.opciones.map(o=>o.t).join(','));assert.ok(orders.size>1);checks.push('server order changes between deliveries; wrong option 3 remains original index and 20+ vote statistics use it')
 await page.goto(preview.origin+'/suizamente/proponer');await page.getByRole('combobox',{name:'Tipo',exact:true}).selectOption('real');await expect(page.getByRole('textbox',{name:/^Opción [1-4]$/})).toHaveCount(4);await expect(page.getByRole('textbox',{name:/Emoji opción/})).toHaveCount(0);await page.getByRole('radio',{name:'Correcta: opción 4',exact:true}).check();await page.screenshot({path:out+'/propuesta-390.png',fullPage:true})
 await page.getByRole('combobox',{name:'Tipo',exact:true}).selectOption('dilema');await expect(page.getByRole('textbox',{name:/Emoji opción/})).toHaveCount(3);checks.push('four proposal fields/radios, fourth correct selectable, real option emojis hidden, dilemma emojis retained')
 reference=createServer(async(req,res)=>{try{const p=resolve(design,'.'+decodeURIComponent(req.url.split('?')[0]));if(!p.startsWith(design))throw Error('path');res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml'})[extname(p)]||'application/octet-stream');res.end(await readFile(p))}catch{res.statusCode=404;res.end()}});await new Promise(r=>reference.listen(0,'127.0.0.1',r))
 const ref=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});await ref.goto('http://127.0.0.1:'+reference.address().port+'/disenos/pantallas.html');await ref.evaluate(()=>document.fonts.ready)
 for(const [id,name] of [['PartidaPregunta','pregunta'],['PartidaAcierto','acierto'],['PartidaFallo','fallo']])await ref.locator('#p-'+id+' .marco').screenshot({path:out+'/referencia-'+name+'.png'})
 await writeFile(out+'/comparacion.html','<!doctype html><meta charset="utf-8"><title>Cuatro opciones · diseño y app</title><style>body{font:16px system-ui;background:#eef1f5}section{display:flex;gap:20px;align-items:start;margin-bottom:40px}figure{margin:0}img{width:390px;max-width:100%}</style>'+['pregunta','acierto','fallo'].map(name=>'<h2>'+name+'</h2><section><figure><figcaption>pantallas.html</figcaption><img src="referencia-'+name+'.png"></figure><figure><figcaption>App</figcaption><img src="'+name+'-390.png"></figure></section>').join(''))
 const comparison=await browser.newPage({viewport:{width:850,height:1000}});await comparison.goto('file:///'+resolve(out,'comparacion.html').replaceAll('\\','/'));await comparison.screenshot({path:out+'/comparacion.png',fullPage:true})
 assert.deepEqual(errors,[]);await writeFile(out+'/resultado.json',JSON.stringify({engine,checks,errors},null,2));console.log('Four options '+engine+': '+checks.join('; ')+'.')
}catch(e){console.error(e.message,e.where||'');await page?.screenshot({path:out+'/fallo-test.png',fullPage:true}).catch(()=>{});process.exitCode=1}finally{await browser?.close();await preview?.close();await new Promise(r=>reference?reference.close(r):r())}
