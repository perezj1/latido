import assert from 'node:assert/strict'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {createServer} from 'node:http'
import {resolve,extname} from 'node:path'
import {chromium,webkit,expect as rawExpect} from '@playwright/test'
import {startSuizamentePreview,testToken,testUser} from './lib/suizamente-v2-preview.mjs'
import {A,B,call} from './lib/suizamente-v2-test-db.mjs'
const engine=process.argv.includes('--webkit')?'webkit':'chromium',out='output/compartir/'+engine,expect=rawExpect.configure({timeout:20000})
const design=resolve(process.env.SUIZAMENTE_DESIGN_ROOT||'../../../latido/suizamente'),errors=[],checks=[]
let preview,browser,page,refServer
try{
 await mkdir(out,{recursive:true});preview=await startSuizamentePreview(engine==='webkit'?5341:5340,{hmr:false});const db=preview.db,config=await call(db,A,'config')
 await db.query("SELECT suizamente_private.v3_anotar($1,'fixture','share',20000,0,'{\"sobres\":4}')",[A])
 for(let level=0;level<2;level++)await call(db,A,'construir',{canton:'LU',nivel:level,clave:crypto.randomUUID()})
 await db.exec('UPDATE suizamente_private.suizamente_novedades SET leida=true')
 browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,args:engine==='chromium'?['--enable-unsafe-swiftshader']:[]})
 async function context({fallback=false,mobile=false}={}){
  const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',acceptDownloads:true})
  await ctx.addInitScript(({session,fallback,mobile})=>{
   localStorage.setItem('sb-127-auth-token',JSON.stringify(session));sessionStorage.setItem('suizamente:apertura','1');Object.defineProperty(navigator,'standalone',{get:()=>true})
   if(fallback){const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:get.call(this,type,...args)}}
   if(mobile){window.shared=[];Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.shared.push({text:data.text,files:data.files.map(f=>({name:f.name,type:f.type,size:f.size}))})}})}
  },{session:{access_token:testToken(A),refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+86400,user:testUser(A,'Alex')},fallback,mobile});return ctx
 }
 async function choose(p){await expect(p.locator('.sv-login-screen')).toHaveCount(0);await expect(p.locator('.sv-screen')).toBeVisible()}
 async function enter(p,path){await p.goto(preview.origin+path);await choose(p)}
 async function navigate(path){await page.evaluate(path=>{history.pushState({},'',path);window.dispatchEvent(new PopStateEvent('popstate'))},path)}
 const ctx=await context({mobile:true});page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));const mutations=[]
 page.on('request',r=>{if(r.method()!=='GET'&&r.url().includes('/api/suizamente/'))mutations.push(r.url())})
 await enter(page,'/suizamente/mapa?canton=LU');await expect(page.getByRole('button',{name:'Compartir Lucerna',exact:true})).toBeVisible()
 await expect(page.locator('.sv-map-frame .sv-world-map>div canvas')).toBeVisible().catch(()=>{})
 await page.getByRole('button',{name:'Compartir Lucerna',exact:true}).click();const share=()=>page.locator('.sv-image-share')
 await expect(share().getByRole('switch',{name:'Poner mi apodo'})).toHaveAttribute('aria-checked','false');await expect(share().getByRole('button',{name:'Compartir',exact:true})).toBeEnabled()
 const noName=await share().locator('canvas').evaluate(c=>c.toDataURL()),before=mutations.length
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:844});assert.ok(await share().evaluate(el=>el.scrollWidth<=el.clientWidth));assert.equal(await share().getByRole('switch').getAttribute('aria-checked'),'false');await page.screenshot({path:out+'/compartir-imagen-'+width+'.png'})}
 await share().getByRole('switch').click();await expect(share().getByRole('switch')).toHaveAttribute('aria-checked','true');await expect(share().getByRole('button',{name:'Compartir',exact:true})).toBeEnabled()
 await expect.poll(async()=>(await share().locator('canvas').evaluate(c=>c.toDataURL()))!==noName).toBe(true)
 await share().getByRole('button',{name:'Compartir',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.shared.length)).toBe(1)
 const sent=(await page.evaluate(()=>window.shared))[0];assert.equal(sent.files[0].type,'image/png');assert.ok(sent.text.endsWith('https://suizamente.latido.ch'));assert.equal(mutations.length,before,'Sharing never makes an API mutation')
 await page.keyboard.press('Escape');await expect(share()).toHaveCount(0);await page.setViewportSize({width:390,height:844})
 // Server-confirmed canton completion waits for the scene and queues its celebration.
 await page.getByRole('button',{name:/Subir a nivel 3/}).click();await expect(page.getByRole('dialog').getByRole('heading')).toHaveText('¡Cantón completo!')
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:844});assert.ok(await page.locator('.sv-moment-page').evaluate(el=>el.scrollWidth<=el.clientWidth));await page.screenshot({path:out+'/momento-canton-'+width+'.png'})}
 await page.setViewportSize({width:390,height:844});const moment=page.getByRole('dialog'),button=moment.getByRole('button',{name:'Compartir mi Suiza',exact:true});await expect(button).toBeEnabled()
 const image=await moment.locator('img').getAttribute('src'),size=await page.evaluate(async src=>{const image=new Image();image.src=src;await image.decode();return [image.naturalWidth,image.naturalHeight]},image)
 assert.ok(size[0]>=900,'3x capture is sharp');const preShare=mutations.length;await button.focus();await page.keyboard.press('Enter');await expect.poll(()=>page.evaluate(()=>window.shared.length)).toBe(2);await expect(moment.getByRole('heading')).toHaveText('¡Cantón completo!');assert.equal(mutations.length,preShare)
 await moment.getByRole('button',{name:'Omitir'}).click();checks.push('map capture at 3x, nickname default/privacy, no share API mutation, canton celebration and Enter never advances it')
 await page.getByRole('button',{name:'← Toda Suiza',exact:true}).click();await page.getByRole('button',{name:'Compartir mi Suiza',exact:true}).click();await expect(share().getByRole('button',{name:'Compartir',exact:true})).toBeEnabled();const realMap=await share().locator('canvas').evaluate(c=>c.toDataURL().split(',')[1]);await writeFile(out+'/imagen-mi-suiza-real.png',Buffer.from(realMap,'base64'));await page.keyboard.press('Escape')
 // The region chest must wait behind the canton celebration, not replace it.
 for(const canton of config.mapa.regiones[0].cantones)await db.query('INSERT INTO suizamente_private.suizamente_mapa(jugador_id,vuelta,canton,nivel) VALUES($1,1,$2,$3) ON CONFLICT(jugador_id,vuelta,canton) DO UPDATE SET nivel=excluded.nivel',[A,canton.id,canton.id==='LU'?2:config.mapa.nivelesPorCanton])
 await navigate('/suizamente/album');await expect(page.locator('.sv-album')).toBeVisible();await page.evaluate(async()=>{const m=await import('/game/src/lib/suizamenteV2.js');await m.szApi('mapa',{fresh:true})});await navigate('/suizamente/mapa?canton=LU');await expect(page.getByRole('button',{name:/Subir a nivel 3/})).toBeVisible();await page.getByRole('button',{name:/Subir a nivel 3/}).click();await expect(page.getByRole('dialog').getByRole('heading')).toHaveText('¡Cantón completo!');await page.getByRole('button',{name:'Omitir',exact:true}).click();await expect(page.getByRole('dialog').getByRole('heading')).toHaveText(/completa/);await page.getByRole('button',{name:'Omitir',exact:true}).click();checks.push('region chest queued after canton completion')
 // Deterministic real collection: the server chooses the missing canonical rare card.
 const cols=(await db.query('SELECT suizamente_private.v6_colecciones() cols')).rows[0].cols,col=cols[0],rare=col.cartas.find(c=>c.r===3),payload={...rare,coleccion:col.nombre,coleccionId:col.id}
 await db.query("INSERT INTO suizamente_private.suizamente_cartas(jugador_id,carta_id) SELECT $1,k->>'id' FROM jsonb_array_elements($2::jsonb) k WHERE k->>'id'<>$3 ON CONFLICT DO NOTHING",[A,JSON.stringify(col.cartas),rare.id])
 await db.exec("CREATE OR REPLACE FUNCTION suizamente_private.v6_carta() RETURNS jsonb LANGUAGE sql AS $$ SELECT '"+JSON.stringify(payload).replaceAll("'","''")+"'::jsonb $$")
 const pack=await call(db,A,'abrir_sobre',{clave:crypto.randomUUID()});assert.equal(pack.coleccionesCompletadas.length,1)
 await navigate('/suizamente/sobre/'+pack.id);await expect(page.getByRole('dialog').getByRole('heading')).toHaveText('¡Nuevo sobre!');await page.keyboard.press('Enter');await expect(page.getByRole('button',{name:'Compartir tu carta',exact:true})).toBeEnabled()
 const cardsTitle=await page.getByRole('dialog').getByRole('heading').innerText();await page.getByRole('button',{name:'Compartir tu carta',exact:true}).click();await expect(page.getByRole('dialog').getByRole('heading')).toHaveText(cardsTitle)
 await page.getByRole('dialog').focus();await page.keyboard.press('Enter');await expect(page.getByRole('dialog').getByRole('heading')).toHaveText('¡Colección completa!');await expect(page.getByRole('button',{name:'Compartir tu colección',exact:true})).toBeEnabled();await page.screenshot({path:out+'/momento-coleccion-390.png'});await page.getByRole('button',{name:'Omitir',exact:true}).click()
 checks.push('server-confirmed rare card and collection step; nine cards and the already delivered reward')
 // Completed-lap image is rebuilt independently of the new empty lap.
 await db.query("INSERT INTO suizamente_private.suizamente_movimientos(jugador_id,motivo,ref,monedas,xp,inventario) VALUES($1,'vuelta','1',0,0,'{}') ON CONFLICT DO NOTHING",[A])
 await navigate('/suizamente/mapa/vuelta?vuelta=1');await page.getByRole('button',{name:'Compartir mi Suiza',exact:true}).click();await expect(share().getByRole('button',{name:'Compartir',exact:true})).toBeEnabled();await page.screenshot({path:out+'/vuelta-compartir-390.png'});await page.keyboard.press('Escape')
 // Canonical data builders exclude rivals/emails; all 8 canvases match the supplied engine pixel for pixel.
 const referenceEngine=await readFile(resolve(design,'disenos/imagenes-compartir.js'),'utf8'),examplesHtml=await readFile(resolve(design,'disenos/imagen-historia.html'),'utf8')
 const exampleCode=examplesHtml.slice(examplesHtml.indexOf('const INVENTOS ='),examplesHtml.indexOf('const $ ='))
 const examples=Function(exampleCode+';return EJEMPLOS')(),svg=await readFile(resolve(design,'disenos/mapa-cantones.svg'),'utf8')
 await page.addScriptTag({content:referenceEngine});const datasets=Object.values(examples).map(data=>({...data,...(data.tipo==='mapa'?{foto:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)}:{})}))
 const parity=await page.evaluate(async datasets=>{const engine=await import('/game/src/components/suizamente/v2/story.js'),results=[];for(const data of datasets){const a=document.createElement('canvas'),b=document.createElement('canvas');await engine.dibujar(a,data);await window.SZImagen.dibujar(b,data);results.push(a.toDataURL()===b.toDataURL())}return results},datasets);assert.ok(parity.every(Boolean))
 for(const [i,name] of [[1,'mi-suiza'],[4,'victoria'],[7,'coleccion']]){const png=await page.evaluate(async data=>{const m=await import('/game/src/components/suizamente/v2/story.js'),c=document.createElement('canvas');await m.dibujar(c,data);return c.toDataURL().split(',')[1]},datasets[i]);await writeFile(out+'/imagen-'+name+'.png',Buffer.from(png,'base64'))}
 const privateData=await page.evaluate(async()=>{const m=await import('/game/src/components/suizamente/v2/shareData.js');const s=await import('/game/src/components/suizamente/v2/Sharing.jsx');return {won:m.victoryImage({tusSellos:['casa'],susSellos:['dia'],rival:{apodo:'SECRETO',email:'rival@example.com'}}),question:s.storyData('dia',{id:'test',pct:60,total:19,pregunta:'Pregunta',opciones:[{t:'Sí'},{t:'No'}],porcentajes:[60,40]})}})
 assert.ok(!JSON.stringify(privateData).includes('SECRETO'));assert.ok(!JSON.stringify(privateData).includes('rival@example.com'));assert.ok(privateData.question.opciones.every(o=>o.pct===null))
 checks.push('eight exact engine examples, question preserved, own passport only, canonical links and vote threshold')
 // Desktop download and SVG fallback; export remains local without WebGL.
 const fallbackCtx=await context({fallback:true}),fallback=await fallbackCtx.newPage();await enter(fallback,'/suizamente/mapa');await fallback.getByRole('button',{name:'Compartir mi Suiza',exact:true}).click();await expect(fallback.locator('.sv-image-share').getByRole('button',{name:'⬇️ Guardar la imagen',exact:true})).toBeEnabled()
 const download=fallback.waitForEvent('download');await fallback.getByRole('button',{name:'⬇️ Guardar la imagen',exact:true}).click();await (await download).saveAs(out+'/descarga-sin-webgl.png');await fallbackCtx.close();checks.push('desktop PNG download and SVG contain fallback without WebGL')
 refServer=createServer(async(req,res)=>{try{const path=resolve(design,'.'+decodeURIComponent(req.url.split('?')[0]));if(!path.startsWith(design))throw Error('path');res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml'})[extname(path)]||'application/octet-stream');res.end(await readFile(path))}catch{res.statusCode=404;res.end()}});await new Promise(r=>refServer.listen(0,'127.0.0.1',r))
 const ref=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});await ref.goto('http://127.0.0.1:'+refServer.address().port+'/disenos/pantallas.html');await ref.evaluate(()=>document.fonts.ready)
 for(const [id,name] of [['ImagenMiSuiza','mi-suiza'],['ImagenVictoria','victoria'],['ImagenColeccion','coleccion'],['MomentoCanton','momento-canton']])await ref.locator('#p-'+id+' .marco').screenshot({path:out+'/referencia-'+name+'.png'})
  await writeFile(out+'/comparacion.html','<!doctype html><meta charset="utf-8"><title>Compartir · referencia y app</title><style>body{font:16px system-ui;background:#eef1f5}section{display:flex;gap:20px;align-items:start;margin-bottom:40px}figure{margin:0}img{width:390px;max-width:100%}</style><h1>Compartir · 390 px</h1>'+['mi-suiza','victoria','coleccion','momento-canton'].map(name=>'<h2>'+name+'</h2><section><figure><figcaption>pantallas.html</figcaption><img src="referencia-'+name+'.png"></figure><figure><figcaption>App</figcaption><img src="'+(name==='momento-canton'?'momento-canton-390':name==='mi-suiza'?'imagen-mi-suiza-real':'imagen-'+name)+'.png"></figure></section>').join(''))
 const comparison=await browser.newPage({viewport:{width:850,height:1000}});await comparison.goto('file:///'+resolve(out,'comparacion.html').replaceAll('\\','/'));await comparison.screenshot({path:out+'/comparacion.png',fullPage:true})
 assert.deepEqual(errors,[]);await writeFile(out+'/resultado.json',JSON.stringify({engine,checks,errors},null,2));console.log('Sharing '+engine+': '+checks.join('; ')+'.')
}catch(error){console.error(error.stack);await page?.screenshot({path:out+'/fallo.png',fullPage:true}).catch(()=>{});process.exitCode=1}finally{await browser?.close();await preview?.close();await new Promise(r=>refServer?refServer.close(r):r())}
