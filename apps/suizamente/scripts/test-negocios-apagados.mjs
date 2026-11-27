// Compare against the actual prior commit, with identical isolated fixtures.
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import {resolve} from 'node:path'
import {chromium,expect as rawExpect} from '@playwright/test'
import {startSuizamentePreview,testToken,testUser} from './lib/suizamente-v2-preview.mjs'
import {A,B,call} from './lib/suizamente-v2-test-db.mjs'
const cwd=process.cwd(),baseRoot=resolve(process.env.SUIZAMENTE_BASE_ROOT||'../../../suizamente-negocios-base/apps/suizamente'),out=resolve('output/negocios/apagadas'),expect=rawExpect.configure({timeout:30000}),results=[]
let browser,preview
async function fixtures(db){await call(db,A,'regalo');await db.query("UPDATE suizamente_private.suizamente_jugadores SET monedas=150,xp=0,inventario='{}' WHERE jugador_id=$1",[A]);await db.query('DELETE FROM suizamente_private.suizamente_inventario WHERE jugador_id=$1',[A]);await db.query("UPDATE suizamente_private.suizamente_movimientos SET inventario='{}' WHERE jugador_id=$1",[A]);await db.query("SELECT suizamente_private.v3_anotar($1,'fixture','off-inventory',0,0,'{\"quita\":3,\"otra\":2,\"salta\":1,\"tiempo\":2,\"escudos\":2}')",[A]);await db.query("INSERT INTO suizamente_private.suizamente_amigos(seguidor,seguido,estado) VALUES($1,$2,'aceptado'),($2,$1,'aceptado')",[A,B]);await db.exec('UPDATE suizamente_private.suizamente_novedades SET leida=true')}
try{
 await mkdir(out,{recursive:true});browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']})
 for(const version of ['antes','despues']){
  if(version==='antes'){process.chdir(baseRoot);const old=await import(pathToFileURL(baseRoot+'/scripts/lib/suizamente-v2-preview.mjs'));preview=await old.startSuizamentePreview(5680,{hmr:false})}
  else{process.chdir(cwd);preview=await startSuizamentePreview(5681,{hmr:false,mejoras:{},negocios:'apagado',barraCanton:true})}
  await fixtures(preview.db)
  const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:'reduce'});await ctx.addInitScript(s=>{localStorage.setItem('sb-127-auth-token',JSON.stringify(s));sessionStorage.setItem('suizamente:apertura','1');Object.defineProperty(navigator,'standalone',{get:()=>true})},{access_token:testToken(A),refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+86400,user:testUser(A,'Alex')})
  const page=await ctx.newPage(),requests=[];page.on('request',r=>{if(/\/api\/suizamente\/(mejoras|negocios)(?:\/|$)/.test(r.url()))requests.push(r.url())})
  await page.goto(preview.origin+'/suizamente');await expect(page.locator('.sv-home-photo>img')).toBeVisible({timeout:45000})
  for(const [path,name,ready]of [['','Inicio','.sv-home-photo>img'],['/menu','Menu','.sv-menu-features'],['/ajustes','Ajustes','.sv-settings'],['/amigos','Amigos','.sv-people'],['/mapa','Mapa','.sv-world-map canvas']]){
   await page.evaluate(path=>{history.pushState({},'',path);window.dispatchEvent(new window.PopStateEvent('popstate'))},'/suizamente'+path);await expect(page.locator(ready).first()).toBeVisible();await page.waitForLoadState('networkidle');await page.evaluate(()=>document.fonts.ready)
   for(const [width,height]of [[390,844],[375,667]]){await page.setViewportSize({width,height});await page.waitForTimeout(500);if(name==='Inicio')await expect(page.locator(ready).first()).toBeVisible();await page.screenshot({path:out+'/'+version+'-'+name+'-'+width+'.png',timeout:15000});results.push({version,name,width,horizontal:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),layout:name==='Inicio'?await page.locator('.sv-root').evaluate(root=>[...root.querySelectorAll('h1,h2,a,button,svg,img')].map(el=>{const b=el.getBoundingClientRect();return [el.tagName,el.getAttribute('aria-label'),el.textContent.trim().replace(/\s+/g,' '),...[b.x,b.y,b.width,b.height].map(n=>Math.round(n*1000)/1000)]})):undefined,newAccesses:await page.locator('a[href^="/suizamente/minuto"],a[href^="/suizamente/espejo"],a[href="/suizamente/misterio"],a[href="/suizamente/mapa/decorar"],a[href="/suizamente/avisos"]').count()})}
   await page.setViewportSize({width:390,height:844})
  }
  if(version==='despues'){assert.deepEqual(requests,[],'All off: no improvement requests, including decoration assets or notices');for(const r of results.filter(r=>r.version==='despues')){assert.equal(r.horizontal,false);assert.equal(r.newAccesses,0)}}
  await ctx.close();await preview.close();preview=null
 }
 await writeFile(out+'/resultado.json',JSON.stringify({base:'7888920',results},null,2))
 await writeFile(out+'/comparacion.html','<!doctype html><meta charset="utf-8"><style>body{font:16px system-ui;background:#EEF1F5}article{display:flex;gap:12px;margin-bottom:24px}img{width:390px}</style><h1>Mejoras apagadas · antes y después</h1>'+['Inicio','Menu','Ajustes','Amigos','Mapa'].map(name=>'<h2>'+name+'</h2><article><figure><figcaption>Antes</figcaption><img src="antes-'+name+'-390.png"></figure><figure><figcaption>Después</figcaption><img src="despues-'+name+'-390.png"></figure></article>').join(''))
 console.log(JSON.stringify({base:'7888920',results:results.map(({layout,...r})=>r)},null,2))
}finally{process.chdir(cwd);await browser?.close();await preview?.close()}
