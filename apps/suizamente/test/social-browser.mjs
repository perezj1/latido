import assert from 'node:assert/strict'
import { preview,loadEnv } from 'vite'
import { chromium,expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { readFile } from 'node:fs/promises'
import { fixture,alice,bob,session,token } from './social-db.mjs'
import { installLatidoSsoBridge } from '../../../src/lib/suizamenteSsoBridge.js'
const f=await fixture(),origin='http://127.0.0.1:5271',env=loadEnv('production',process.cwd(),'VITE_')
const storageKey='sb-'+new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]+'-auth-token'
const server=await preview({preview:{host:'127.0.0.1',port:5271,strictPort:true}})
const browser=await chromium.launch({headless:true}),errors=[],requests=[]
let otpVerifications=0,slowPeople=false
await mkdir('test-results/social',{recursive:true})
async function create(id,options={}){
 const {sso=false,...browserOptions}=options
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',...browserOptions})
 await context.addInitScript(({key,value,testOrigin,sso})=>{window.SUIZAMENTE_DISABLE_SSO=!sso;if(location.origin!==testOrigin)return;localStorage.setItem('suizamente:bienvenida','true');if(value&&!sessionStorage.getItem('fixture-seeded')){localStorage.setItem(key,JSON.stringify(value));sessionStorage.setItem('fixture-seeded','true')}},{key:storageKey,value:id?session(id):null,testOrigin:origin,sso})
 context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)))
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url())
  if(url.origin===origin)return route.continue()
  if(url.origin==='https://avatars.example.test')return route.fulfill(url.pathname.includes('missing')?{status:404,body:''}:{contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#b8e4d6"/><circle cx="40" cy="29" r="15" fill="#2563eb"/><path d="M10 80a30 30 0 0 1 60 0" fill="#2563eb"/></svg>'})
  if(sso&&['https://latido.ch','https://www.latido.ch'].includes(url.origin)&&url.pathname==='/suizamente/conectar'){
    const rootSession={access_token:token(alice),refresh_token:'root-refresh-must-never-be-copied',user:{id:alice}}
    const script=`(${installLatidoSsoBridge.toString()})({origins:[${JSON.stringify(origin)}],getSession:async()=>({data:{session:${JSON.stringify(rootSession)}}})});window.parent.postMessage({type:'suizamente:sso-ready'},${JSON.stringify(origin)});`
    return route.fulfill({contentType:'text/html',body:'<!doctype html><script>'+script+'</script>'})
  }
  if(sso&&url.pathname==='/auth/v1/verify'){assert.equal(req.postDataJSON().token_hash,'fixture-one-use-otp');otpVerifications++;return route.fulfill({json:session(alice)})}
  if(url.pathname==='/auth/v1/logout')return route.fulfill({status:204,body:''})
  const social=url.pathname.includes('/functions/v1/suizamente-social'),votes=url.pathname.includes('/functions/v1/suizamente-votos')
  if(!social&&!votes)return route.fulfill({json:[]})
  let body={};try{body=req.postDataJSON()||{}}catch{}
  const result=await(social?f.social:f.votes)({method:req.method(),url:req.url(),headers:{...req.headers(),origin},body,address:id||'guest-browser'})
  requests.push({path:url.pathname,method:req.method(),status:result.status})
  if(result.status>=500)console.error('API fixture failure',url.pathname,result.body)
  if(slowPeople&&url.searchParams.get('texto')==='Otr')await new Promise(resolve=>setTimeout(resolve,900))
  return route.fulfill({status:result.status,headers:result.headers,...(result.status===204?{body:''}:{json:result.body})})
 })
 const page=await context.newPage();await page.goto(origin)
 const game=page.frameLocator('iframe.game')
 await expect(game.locator('.social')).toBeVisible()
 await expect(game.locator('.social')).toHaveAttribute('data-online','true')
 return {context,page,game}
}
async function navigate(view,path){await view.page.goto(origin+path);await expect(view.game.locator('.social')).toBeVisible()}
async function answerRound(view,count=10){
 for(let i=0;i<count;i++){
  // The previous dialog button can leave the desktop pointer on a hover edge.
  await view.page.mouse.move(0,0)
  await expect(view.game.locator('.q')).toBeVisible()
  const prompt=await view.game.locator('.q').textContent(),labels=await view.game.locator('.opt .ot').allTextContents()
  const q=f.questions.find(q=>q.pregunta===prompt&&q.opciones.every(op=>labels.includes(op.t)))
  assert.ok(q)
  await view.game.locator('.opt[data-o="'+(q.correcta??0)+'"]').click()
  await expect(view.game.getByRole('dialog')).toBeVisible()
  await expect(view.game.locator('#social-points')).toContainText(/puntos|guardada/)
  await expect(view.game.locator('.s-nav')).toHaveCount(0)
  await view.game.locator('#sig').click()
 }
 await expect(view.game.locator('.done')).toBeVisible()
}
async function awardReadability(view){
 const result=await view.game.locator('.s-award[aria-label]').evaluate(card=>{
  const luminance=color=>{const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722}
  const background=luminance(window.getComputedStyle(card).backgroundColor),bounds=card.getBoundingClientRect()
  return {fits:bounds.left>=0&&bounds.right<=innerWidth,ratios:[...card.querySelectorAll('h2,p')].map(node=>{const text=luminance(window.getComputedStyle(node).color);return (Math.max(text,background)+.05)/(Math.min(text,background)+.05)})}
 })
 assert.ok(result.fits,'Achievement card must fit a narrow mobile screen')
 assert.ok(result.ratios.every(ratio=>ratio>=4.5),'All achievement text must have at least 4.5:1 contrast')
}
let a,b,guest,ssoView
try{
 a=await create(alice)
 await expect(a.game.locator('.s-greeting')).toHaveText('Hola, Nombre Latido 👋')
 await expect(a.game.locator('h1')).toHaveText('¡A jugar!')
 await expect(a.game.locator('[aria-label="Tu perfil"] .s-avatar-photo')).toHaveAttribute('src','https://avatars.example.test/latido-alice.svg')
 await expect(a.game.locator('.s-nav button')).toHaveCount(5)
 await expect(a.game.locator('.s-nav button[aria-current=page]')).toContainText('Jugar')
 await a.page.screenshot({path:'test-results/social/inicio.png',fullPage:true})
 // Keep the question bubble and answer cards; navigation disappears while playing.
 await a.game.locator('[data-play="dilemas"]').click()
 await expect(a.game.locator('.bubble .q')).toBeVisible()
 await expect(a.game.locator('.opt')).toHaveCount(2)
 await expect(a.game.locator('.s-nav')).toHaveCount(0)
 await a.game.locator('.opt').first().click()
 await expect(a.game.getByRole('dialog')).toBeVisible()
 await expect(a.game.locator('#social-points')).toContainText('+5 puntos')
 await expect(a.game.locator('.is-picked .tag.mine')).toHaveCount(1)
 await a.game.locator('#social-bookmark').click()
 await expect(a.game.locator('#social-bookmark')).toContainText('Guardado')
 await a.page.screenshot({path:'test-results/social/resultado.png',fullPage:true})
 const downloadPromise=a.page.waitForEvent('download')
 await a.game.locator('#social-story').click()
 const story=await downloadPromise;await story.saveAs('test-results/social/historia.png')
 const image=await readFile('test-results/social/historia.png');assert.equal(image.readUInt32BE(16),1080);assert.equal(image.readUInt32BE(20),1920)
 await navigate(a,'/libreta')
 await expect(a.game.locator('#book-list article')).toHaveCount(1)
 await a.game.locator('#book-search').fill('not-a-real-fixture-match')
 await expect(a.game.locator('#book-list')).toContainText('No hay datos')
 await navigate(a,'/perfil')
 await expect(a.game.locator('h1').last()).toHaveText('Nombre Latido')
 await expect(a.game.locator('.s-stat').last()).toContainText('1')
 await navigate(a,'/amigos')
 await a.game.locator('#friends-search input').fill('Otra')
 await expect(a.game.locator('#people-results')).toContainText('Otra persona')
 await expect(a.game.locator('#people-results .s-avatar-photo')).toHaveAttribute('src','https://avatars.example.test/suizamente-bob.svg')
 await expect(a.game.locator('#people-results .s-avatar-photo')).toHaveClass(/is-loaded/)
 await a.page.screenshot({path:'test-results/social/amigos-busqueda.png',fullPage:true})
 await a.game.locator('#people-results .s-avatar-photo').evaluate(img=>{img.src='https://avatars.example.test/missing.svg'})
 await expect(a.game.locator('#people-results .s-avatar-photo')).toHaveCount(0)
 await expect(a.game.locator('#people-results .s-avatar')).toHaveText('O')
 await a.game.locator('#friends-search input').fill('O')
 await expect(a.game.locator('#people-results .s-person')).toHaveCount(0)
 slowPeople=true
 const slowRequest=a.page.waitForRequest(r=>new URL(r.url()).searchParams.get('texto')==='Otr')
 await a.game.locator('#friends-search input').fill('Otr');await slowRequest
 await a.game.locator('#friends-search input').fill('Nadie coincide con esta búsqueda')
 await expect(a.game.locator('#people-status')).toContainText('No encontramos')
 await a.page.waitForTimeout(950)
 await expect(a.game.locator('#people-results .s-person')).toHaveCount(0)
 slowPeople=false
 await a.game.locator('#friends-search input').fill('Otra')
 await expect(a.game.locator('#people-results')).toContainText('Otra persona')
 await a.game.getByRole('button',{name:'Agregar',exact:true}).click()
 await expect(a.game.locator('.social')).toContainText('Solicitud enviada')
 b=await create(bob,{colorScheme:'dark',viewport:{width:320,height:740}})
 await navigate(b,'/amigos')
 await b.game.getByRole('button',{name:'Aceptar',exact:true}).click()
 await expect(b.game.locator('.social')).toContainText('Amistad aceptada')
 await f.reset()
 await navigate(a,'/amigos')
 await a.game.getByRole('button',{name:'Retar',exact:false}).click()
 await a.game.locator('#duel-form button').click()
 await expect(a.game.getByRole('heading',{name:'Duelo',exact:true})).toBeVisible()
 const code=new URL(a.page.url()).pathname.split('/').at(-1)
 assert.match(code,/^[A-F0-9]{8}$/)
 await a.game.locator('[data-play-duel]').click()
 await answerRound(a)
 await f.reset()
 await navigate(b,'/duelo/'+code)
 await b.game.getByRole('button',{name:'Aceptar el reto'}).click()
 await b.game.locator('[data-play-duel]').click()
 await answerRound(b)
 await navigate(a,'/duelo/'+code)
 await expect(a.game.locator('.social')).toContainText('Pregunta a pregunta')
 await a.page.screenshot({path:'test-results/social/duelo.png',fullPage:true})
 await f.reset()
 await navigate(a,'/retos')
 await a.game.locator('[data-daily]').click()
 await answerRound(a,5)
 await navigate(a,'/retos')
 await expect(a.game.locator('[data-daily]')).toContainText('Ver mi resultado')
 await a.game.locator('[data-daily]').click()
 await expect(a.game.locator('.social')).toContainText('3 de 3 verdades acertadas')
 await expect(a.game.locator('.s-nav')).toHaveCount(0)
 await navigate(a,'/ranking')
 await expect(a.game.locator('.s-rank')).toHaveCount(26)
 await expect(a.game.locator('.social')).toContainText('media de puntos por jugador activo')
 await a.page.screenshot({path:'test-results/social/liga.png',fullPage:true})
 await navigate(a,'/ranking?tab=amigos')
 await expect(a.game.locator('.social')).toContainText('Otra persona')
 await navigate(a,'/proponer')
 await a.game.locator('[name=tema]').selectOption('comida')
 await a.game.locator('[name=pregunta]').fill('Una pregunta aportada para comprobar el formulario')
 await a.game.locator('[name=opcion0]').fill('Primera opción')
 await a.game.locator('[name=opcion1]').fill('Segunda opción')
 await a.game.locator('[name=dato]').fill('Un dato de prueba que solo se guarda en la base de pruebas.')
 await a.game.locator('#proposal-form button[type=submit]').click()
 await expect(a.game.getByRole('heading',{name:'Retos',exact:true})).toBeVisible()
 await navigate(a,'/moderacion')
 await expect(a.game.locator('.social')).toContainText('Una pregunta aportada')
 await a.game.locator('.moderation-form summary').click()
 await a.game.locator('.moderation-form [name=pregunta]').fill('Una pregunta revisada por el equipo')
 await a.game.locator('.moderation-form [name=opcion0]').fill('Primera opción revisada')
 await a.game.locator('.moderation-form button').click()
 await expect(a.game.locator('.social')).toContainText('Una pregunta revisada por el equipo')
 await expect(a.game.locator('.social')).toContainText('Primera opción revisada')
 await navigate(a,'/ajustes')
 await a.game.locator('[name=apariencia]').selectOption('dark')
 await a.game.locator('[name=menosAnimaciones]').check()
 await a.game.locator('#settings-form button[type=submit]').click()
 await expect(a.game.locator('html')).toHaveAttribute('data-theme','dark')
 await navigate(a,'/medallas')
 await expect(a.game.locator('.s-medal')).toHaveCount(9)
 await navigate(b,'/perfil')
 await expect(b.game.locator('.social')).toContainText('Uri')
 assert.equal(await b.game.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 await b.page.screenshot({path:'test-results/social/perfil-oscuro-320.png',fullPage:true})
 // Earn an actual medal in the fixture and check its presentation in both themes.
 const house=f.questions.filter(q=>q.tipo==='real'&&q.tema==='casa'),actor='user:'+alice
 const previous=(await f.db.query('SELECT pregunta,acierto FROM suizamente_social.respuestas WHERE jugador=$1',[actor])).rows
 const answered=new Set(previous.map(r=>r.pregunta)),target=house.find(q=>!answered.has(q.id))
 const correct=house.filter(q=>previous.some(r=>r.pregunta===q.id&&r.acierto)).length
 assert.ok(correct<10)
 for(const q of house.filter(q=>q.id!==target.id&&!answered.has(q.id)).slice(0,9-correct))await f.db.query('INSERT INTO suizamente_social.respuestas(jugador,pregunta,opcion,acierto) VALUES($1,$2,$3,true)',[actor,q.id,q.correcta])
 await f.db.query("UPDATE suizamente_social.jugadores SET ajustes=ajustes||'{\"apariencia\":\"light\"}'::jsonb WHERE id=$1",[actor])
 await f.reset()
 const ready=a.page.waitForResponse(r=>r.url().endsWith('/bootstrap')&&r.status()===200)
 await a.page.goto(origin+'/jugar?p='+target.id);await ready
 await a.page.mouse.move(0,0)
 await a.game.locator('.opt[data-o="'+target.correcta+'"]').click()
 await a.game.getByRole('dialog').waitFor();await a.game.locator('#sig').click()
 await expect(a.game.locator('.s-award[aria-label]')).toContainText('Madrugón del reciclaje')
 await awardReadability(a)
 await a.page.screenshot({path:'test-results/social/medalla-nueva-clara.png',fullPage:true})
 await a.page.setViewportSize({width:320,height:740})
 await a.game.locator('html').evaluate(node=>{node.dataset.theme='dark'})
 await awardReadability(a)
 await a.page.screenshot({path:'test-results/social/medalla-nueva-oscura.png',fullPage:true})
 // Guest play still works, and private rankings/duel creation require an account.
 guest=await create(null)
 await navigate(guest,'/amigos')
 await expect(guest.game.locator('.social')).toContainText('Entra con tu cuenta')
 await navigate(guest,'/bienvenida')
 await expect(guest.game.locator('h1')).toContainText('Suiza llevas dentro')
 await navigate(guest,'/como-se-juega')
 await expect(guest.game.locator('.s-step')).toHaveCount(4)
 await f.reset()
 ssoView=await create(null,{sso:true})
 await expect(ssoView.game.locator('.s-greeting')).toHaveText('Hola, Nombre Latido 👋')
 assert.equal(otpVerifications,1)
 const stored=await ssoView.page.evaluate(key=>localStorage.getItem(key),storageKey)
 assert.ok(stored.includes('fixture-refresh-'))
 assert.equal(stored.includes('root-refresh-must-never-be-copied'),false)
 // A logout in another tab must replace the identity on a nested game route.
 await f.reset()
 await navigate(b,'/perfil')
 const otherTab=await b.context.newPage()
 await otherTab.goto(origin+'/cuenta')
 await otherTab.getByRole('button',{name:'Cerrar sesión en esta app'}).click()
 await expect(b.game.locator('h1').last()).toHaveText('Invitado')
 await expect(b.game.locator('.social')).not.toContainText('Otra persona')
 await otherTab.close()
 assert.deepEqual(errors,[])
 assert.ok(requests.some(r=>r.path.endsWith('/answer')&&r.status===200))
 console.log('PASS: complete social UI with real PostgreSQL fixtures; names, preserved questions/results, 5 emoji tabs, notebook, friendship requests, two-player duels, daily challenge, mean cantonal league, proposals, moderation, settings and dark/mobile layouts. Zero production writes.')
}catch(error){if(a)await a.page.screenshot({path:'test-results/social/failure.png',fullPage:true});console.error(error.message);process.exitCode=1}
finally{await a?.context.close();await b?.context.close();await guest?.context.close();await ssoView?.context.close();await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));await f.db.close()}
