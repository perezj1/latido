import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {preview,loadEnv} from 'vite'
import {chromium,webkit,expect} from '@playwright/test'
import {conquistaFixture,alice,bob} from './conquista-db.mjs'
import {session} from './social-db.mjs'
const f=await conquistaFixture(),origin='http://127.0.0.1:5271',env=loadEnv('production',process.cwd(),'VITE_')
const key='sb-'+new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]+'-auth-token'
const server=await preview({preview:{host:'127.0.0.1',port:5271,strictPort:true}})
const engine=process.argv.includes('--webkit')?webkit:chromium,browser=await engine.launch(),errors=[]
const output='test-results/conquista'+(engine===webkit?'-webkit':'')
await mkdir(output,{recursive:true})
let loseStartResponse=false
async function open(id,path='/'){
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'})
 await context.addInitScript(({origin,key,value})=>{window.SUIZAMENTE_DISABLE_SSO=true;if(location.origin!==origin)return;localStorage.setItem('suizamente:pwa-installed','1');localStorage.setItem('suizamente:bienvenida','true');if(!sessionStorage.getItem('seeded')){localStorage.setItem(key,JSON.stringify(value));sessionStorage.setItem('seeded','true')}},{origin,key,value:session(id)})
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url())
  if(url.origin===origin)return route.continue()
  if(url.origin==='https://avatars.example.test')return route.fulfill({status:404,body:''})
  const conquest=url.pathname.includes('/functions/v1/suizamente-conquista'),social=url.pathname.includes('/functions/v1/suizamente-social'),votes=url.pathname.includes('/functions/v1/suizamente-votos')
  if(!conquest&&!social&&!votes)return route.fulfill({json:[]})
  let body={};try{body=req.postDataJSON()||{}}catch{}
  const result=await(conquest?f.api:social?f.social:f.votes)({method:req.method(),url:req.url(),headers:{...req.headers(),origin},body,address:'conquista-browser'})
  if(result.status>=500)console.error(result.body)
  if(conquest&&req.method()==='POST'&&url.pathname.endsWith('/rounds')&&loseStartResponse){loseStartResponse=false;return route.abort()}
  return route.fulfill({status:result.status,headers:result.headers,...(result.status===204?{body:''}:{json:result.body})})
 })
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+path)
 const game=page.frameLocator('iframe.game');await expect(game.locator('.social')).toHaveAttribute('data-online','true')
 return {context,page,game,id}
}
async function go(view,path){await view.page.goto(origin+path);await expect(view.game.locator('.cq')).toBeVisible()}
async function finish(view,{misses=0}={}){
 await expect(view.game.locator('.cq-answers')).toBeVisible()
 while(await view.game.locator('.cq-answers').count()){
  const text=await view.game.locator('.cq-question h1').textContent()
  const q=(await f.db.query('SELECT id,correcta FROM suizamente_conquista.preguntas WHERE pregunta=$1',[text])).rows[0]
  assert.ok(q,'Question comes from the protected server bank')
  const url=view.page.url(),current=Number(await view.game.locator('.cq-round-top>b').textContent().then(t=>t.split('/')[0]))
  const option=misses-->0?(q.correcta+1)%4:q.correcta
  await view.game.locator(`[data-cq-action="answer"][data-option="${option}"]`).click()
  await expect.poll(async()=>{
   if(await view.game.locator('.cq-round-result').count())return true
   const next=await view.game.locator('.cq-question h1').textContent().catch(()=>null)
   const number=await view.game.locator('.cq-round-top>b').textContent().catch(()=>null)
   return next!==text||number!==current+'/'+(number?.split('/')[1])||view.page.url()!==url
  }).toBe(true)
 }
 await expect(view.game.locator('.cq-round-result')).toBeVisible()
}
let a,b
try{
 await f.call('estado',{},bob);await f.mutate('preferencias',{competitivo:true},bob)
 await f.db.query("INSERT INTO suizamente_social.amistades(solicitante,destinatario,estado) VALUES($1,$2,'aceptada')",['user:'+alice,'user:'+bob])
 await f.db.query("INSERT INTO suizamente_conquista.territorios(usuario,canton) VALUES($1,'TI')",[bob])
 a=await open(alice)
 await expect(a.game.locator('.s-nav button')).toHaveCount(6)
 await a.game.locator('.s-conquista-entry').click()
 await expect(a.game.locator('.cq-land')).toHaveCount(26)
 await expect(a.game.locator('.cq-wallet')).toContainText('5000')
 for(const width of [390,320]){
  await a.page.setViewportSize({width,height:844})
  assert.equal(await a.game.locator('.cq').evaluate(n=>n.scrollWidth<=n.clientWidth),true)
  await a.page.screenshot({path:output+`/mapa-${width}.png`,fullPage:true})
 }
 await a.game.locator('html').evaluate(n=>{n.dataset.theme='dark'})
 await a.page.screenshot({path:output+'/mapa-oscuro.png',fullPage:true})
 await a.page.setViewportSize({width:390,height:844})
 await a.game.locator('.cq-tabs [data-go="/conquista/tienda"]').click()
 await a.game.locator('[data-cq-action=buy][data-code=escudo]').click()
 await expect(a.game.locator('.cq-shop-card').filter({has:a.game.getByRole('heading',{name:'Escudo',exact:true})})).toContainText('Tienes 1')
 await a.page.screenshot({path:output+'/tienda.png',fullPage:true})
 await go(a,'/conquista/canton/LU')
 await a.game.locator('[name=ventajas][value=escudo]').check()
 await a.page.screenshot({path:output+'/preparar-conquista.png',fullPage:true})
 const walletBefore=(await f.call('estado')).saldo
 loseStartResponse=true
 await a.game.getByRole('button',{name:/Conquistar Lucerna/}).click()
 await expect(a.game.locator('.cq-feedback')).toContainText('No se ha podido conectar')
 await a.game.getByRole('button',{name:/Conquistar Lucerna/}).click()
 await expect(a.game.locator('.cq-answers button')).toHaveCount(4)
 assert.equal((await f.call('estado')).saldo,walletBefore-75,'Lost response retries exactly once')
 await a.page.screenshot({path:output+'/pregunta.png',fullPage:true})
 await finish(a,{misses:1})
 await expect(a.game.locator('.cq-round-result')).toContainText('Lucerna es tuyo')
 await a.page.screenshot({path:output+'/conquistado.png',fullPage:true})
 await a.game.getByRole('button',{name:'Ver mi mapa',exact:true}).click()
 await expect(a.game.locator('.cq-land.owned')).toHaveCount(1)
 await a.game.locator('.cq-tabs [data-go="/conquista/coleccion"]').click()
 await expect(a.game.locator('.cq-collection-badge')).toHaveCount(26)
 await expect(a.game.locator('.cq-collection-badge.owned')).toHaveCount(1)
 await a.page.screenshot({path:output+'/coleccion.png',fullPage:true})
 await go(a,'/conquista/canton/BE')
 await a.game.getByRole('button',{name:/Conquistar Berna/}).click()
 await expect(a.game.locator('.cq-answers')).toBeVisible()
 await a.game.getByRole('button',{name:'Salir y guardar la partida',exact:true}).click()
 await expect(a.game.locator('.cq-resume')).toContainText('Berna')
 await a.page.reload()
 await a.game.locator('.cq-resume button').click()
 await expect(a.game.locator('.cq-answers')).toBeVisible()
 await a.game.locator('[data-cq-action=abandon]').click()
 await a.game.locator('[data-cq-action=confirm-abandon]').click()
 await expect(a.game.locator('.cq-round-result')).toBeVisible()
 await go(a,'/conquista/batallas')
 await expect(a.game.locator('[data-cq-competition]')).not.toBeChecked()
 await a.game.locator('[data-cq-competition]').check()
 await expect(a.game.locator('[data-cq-competition]')).toBeChecked()
 await a.game.getByRole('button',{name:'＋ Desafiar a un amigo',exact:true}).click()
 await expect(a.game.locator('[name=defensor]')).toHaveValue(bob)
 await a.game.getByRole('button',{name:'Enviar desafío',exact:true}).click()
 await expect(a.game.locator('.cq-territory')).toContainText('Esperando a Otra persona')
 const battlePath=new URL(a.page.url()).pathname
 await a.game.locator('body').evaluate(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:async value=>{window.__battleShare=value}})})
 await a.game.locator('[data-cq-action=share-battle]').click()
 const shared=await a.game.locator('body').evaluate(()=>window.__battleShare)
 assert.equal(shared.url,origin+battlePath);assert.equal(shared.files,undefined)
 b=await open(bob,battlePath)
 await expect(b.game.locator('.cq-territory')).toContainText('te disputa el cantón')
 await b.page.screenshot({path:output+'/invitacion.png',fullPage:true})
 await b.game.getByRole('button',{name:/Aceptar y defender/}).click()
 await expect(b.game.getByRole('button',{name:'Jugar mi defensa',exact:true})).toBeVisible()
 await go(a,battlePath)
 await a.game.getByRole('button',{name:'Jugar mi ataque',exact:true}).click()
 await finish(a)
 await expect(a.game.locator('.cq-review')).toHaveCount(0)
 await b.game.getByRole('button',{name:'Jugar mi defensa',exact:true}).click()
 await finish(b,{misses:1})
 await go(a,battlePath)
 await expect(a.game.locator('.cq-territory')).toContainText('Has conquistado Tesino')
 await expect(a.game.locator('.cq-versus>strong')).toHaveText('10–9')
 await expect(a.game.locator('.cq')).toContainText('El atacante conquista el cantón y recupera sus 100 puntos.')
 await a.page.screenshot({path:output+'/batalla-ganada.png',fullPage:true})
 await go(b,'/conquista/coleccion')
 await expect(b.game.locator('.cq-collection-badge.lost')).toHaveCount(1)
 await go(a,'/conquista')
 await expect(a.game.locator('.cq-land.owned')).toHaveCount(2)
 assert.equal((await f.call('estado')).xp,5000)
 assert.deepEqual(errors,[])
 console.log('PASS: '+(engine===webkit?'WebKit':'Chromium')+'; 26 official map targets, mobile/dark layouts, purchases, equipment, lost-response idempotency, persistent conquest, collection, resume/abandon, voluntary friend battles, direct invitation links, shield, protected solutions and territory transfer. No production writes.')
}finally{await a?.context.close();await b?.context.close();await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));await f.db.close()}
