import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'
import { preview, loadEnv } from 'vite'

const origin='http://127.0.0.1:5271'
const env=loadEnv('production',process.cwd(),'VITE_')
const project=new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]
const storageKey=`sb-${project}-auth-token`
const data=JSON.parse(await readFile('../../public/suizamente/data/preguntas.json','utf8'))
const user={id:'11111111-1111-4111-8111-111111111111',email:'prueba@example.test',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email',providers:['email']},user_metadata:{name:'Prueba'},created_at:'2026-01-01T00:00:00Z'}
const access=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:user.id,aud:'authenticated',role:'authenticated',email:user.email,exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)})).toString('base64url')+'.test-signature'
const session={access_token:access,refresh_token:'mock-refresh-token',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user}
const requests=[], votes=new Map(), errors=[]
let browser
const server=await preview({preview:{host:'127.0.0.1',port:5271,strictPort:true}})
await mkdir('test-results',{recursive:true})
async function context(options={}) {
  let authUser={...user,user_metadata:{...user.user_metadata}}
  const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',...options})
  await ctx.addInitScript(()=>{window.SUIZAMENTE_CONFIG={experiencia:false};window.SUIZAMENTE_DISABLE_SSO=true})
  ctx.on('page',page=>page.on('pageerror',e=>errors.push(e.message)))
  await ctx.route('**/*',async route=>{
    const req=route.request(), url=new URL(req.url())
    if (url.origin===origin) return route.continue()
    const headers={'access-control-allow-origin':origin,'access-control-allow-headers':'*'}
    const send=(json,status=200)=>route.fulfill({status,headers,json})
    if (req.method()==='OPTIONS') return route.fulfill({status:204,headers})
    let body
    try {body=req.postDataJSON()} catch {body=null}
    requests.push({url,method:req.method(),body,headers:req.headers()})
    if (url.pathname.includes('/auth/v1/')) {
      if (url.pathname.endsWith('/token')) {if(ctx.pendingConfirmation)return send({code:'email_not_confirmed',message:'Email not confirmed'},400);return send({...session,user:authUser})}
      if (url.pathname.endsWith('/user')) {if(req.method()==='PUT')authUser={...authUser,user_metadata:{...authUser.user_metadata,...body.data}};return send(authUser)}
      if (url.pathname.endsWith('/logout')) return send({})
      if (url.pathname.endsWith('/signup')) {ctx.pendingConfirmation=true;authUser={...user,user_metadata:{...body.data},identities:[{provider:'email'}]};return send(authUser)}
      if (url.pathname.endsWith('/recover')) return send({})
      if (url.pathname.endsWith('/authorize')) return route.fulfill({contentType:'text/html',body:'<title>Proveedor simulado</title>Google simulado'})
      return send({})
    }
    if(url.pathname==='/rest/v1/profiles')return send({},201)
    if(url.pathname.endsWith('/functions/v1/suizamente-social/profile')){assert.equal(req.method(),'PUT');return send({perfil:{}})}
    if (url.pathname.includes('/functions/v1/suizamente-votos/')) {
      const identity=req.headers().authorization===`Bearer ${access}` ? user.id : req.headers()['x-jugador-id']
      if (!votes.has(identity)) votes.set(identity,{})
      const own=votes.get(identity)
      if (url.pathname.endsWith('/resumen')) return send({conteos:Object.fromEntries(data.preguntas.map(q=>[q.id,[0,0,0]]))})
      if (url.pathname.endsWith('/mios')) return send({votos:own})
      const previous=own[body.preguntaId]
      if (previous===undefined) own[body.preguntaId]=body.opcion
      const reparto=[0,0,0]; reparto[own[body.preguntaId]]=1
      return send({reparto,opcion:own[body.preguntaId],yaVotado:previous!==undefined})
    }
    return route.fulfill({status:404,body:'External request blocked by test'})
  })
  return ctx
}
try {
  browser=await chromium.launch({headless:true})
  const guest=await context()
  const page=await guest.newPage()
  let releaseBoot
  const bootReady=new Promise(resolve=>{releaseBoot=resolve})
  await page.route(origin+'/assets/index-*.js',async route=>{await bootReady;await route.continue()})
  await page.goto(origin,{waitUntil:'commit'})
  await expect(page.locator('.startup')).toBeVisible()
  await expect(page.locator('.boot')).toBeHidden()
  await page.emulateMedia({reducedMotion:'no-preference'})
  await expect(page.locator('.ap-rayo')).toHaveCount(5)
  await page.evaluate(()=>{document.getAnimations().forEach(animation=>{animation.pause();animation.currentTime=2700})})
  await page.screenshot({path:'test-results/arranque-movil.png',fullPage:true})
  await page.setViewportSize({width:320,height:740});await page.emulateMedia({colorScheme:'dark'})
  await page.screenshot({path:'test-results/arranque-oscuro-320.png',fullPage:true})
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({colorScheme:'light',reducedMotion:'reduce'})
  releaseBoot()
  const game=page.frameLocator('iframe')
  await expect(game.locator('.title')).toHaveText('Suizamente')
  await expect(game.locator('#nota')).toContainText('Tus votos cuentan')
  await expect(game.locator('.host-actions')).toContainText('Iniciar sesión')
  await expect(game.locator('.host-actions a[href="/instalar"]')).toHaveAttribute('target','_top')
  await page.screenshot({path:'test-results/inicio-movil.png',fullPage:true})
  // All modes still use the same source questions and original answer indices.
  for (const [mode,type] of [['dilemas','dilema'],['preguntas','real'],['mix',null]]) {
    await game.locator(`[data-modo="${mode}"]`).click()
    const types=[]
    const count=mode==='mix'?10:1
    for (let n=0;n<count;n++) {
      const prompt=await game.locator('.q').textContent()
      const labels=await game.locator('.opt .ot').allTextContents()
      const q=data.preguntas.find(q=>q.pregunta===prompt && q.opciones.every(o=>labels.includes(o.t)))
      assert.ok(q)
      if (type) assert.equal(q.tipo,type)
      if (q.tipo==='dilema') assert.equal(labels.length,2)
      types.push(q.tipo)
      await game.locator('.opt').first().click()
      await expect(game.getByRole('dialog')).toBeVisible()
      await expect(game.locator('.tag.mine')).toHaveCount(1)
      await game.locator('#sig').click()
    }
    if (mode==='mix') {
      assert.equal(types.filter(t=>t==='dilema').length,5)
      assert.equal(types.filter(t=>t==='real').length,5)
      await game.locator('#inicio').click()
    } else await page.goto(origin)
    await expect(game.locator('[data-modo="mix"]')).toBeVisible()
  }
  const manifest=await (await page.request.get(origin+'/manifest.webmanifest')).json()
  assert.equal(manifest.name,'Suizamente')
  assert.equal(manifest.start_url,'/')
  assert.equal(manifest.scope,'/')
  assert.equal(manifest.display,'standalone')
  for (const icon of manifest.icons) {
    const bytes=await (await page.request.get(origin+icon.src)).body()
    const size=Number(icon.sizes.split('x')[0])
    assert.equal(bytes.readUInt32BE(16),size)
    assert.equal(bytes.readUInt32BE(20),size)
  }
  // The service worker caches only its public allowlist, never sessions or pages.
  await page.evaluate(async()=>{await navigator.serviceWorker.ready})
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true)
  const cached=await page.evaluate(async()=>{
    const result=[]
    for (const name of await caches.keys()) for (const req of await (await caches.open(name)).keys()) result.push(new URL(req.url).pathname)
    return result
  })
  assert.equal(cached.length,13)
  assert.ok(cached.every(path=>path.startsWith('/icons/')||['/manifest.webmanifest','/favicon.svg','/sin-conexion.html'].includes(path)))
  await page.goto(origin+'/cuenta')
  await expect(page.getByRole('heading',{name:'Crea tu cuenta'})).toBeVisible()
  await expect(page.getByRole('link',{name:'Volver al juego',exact:true})).toHaveCount(0)
  await expect(page.getByRole('button',{name:'Jugar sin cuenta',exact:true})).toHaveCount(0)
  await expect(page.getByRole('link',{name:'Volver',exact:true})).toHaveAttribute('href','/bienvenida')
  await page.goto(origin+'/cuenta')
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content','noindex, nofollow')
  await page.screenshot({path:'test-results/cuenta-movil.png',fullPage:true})
  await page.locator('input[type="email"]').fill(user.email)
  await page.getByLabel('Contraseña',{exact:true}).fill('password-only-for-mock')
  await page.getByRole('checkbox').check()
  await page.getByRole('button',{name:'Crear cuenta',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Tu perfil en Suizamente'})).toBeVisible()
  assert.equal(requests.filter(r=>r.url.pathname.endsWith('/signup')).length,1)
  await page.getByLabel('Nombre de usuario',{exact:true}).fill('  ')
  await page.getByRole('button',{name:'Guardar perfil',exact:true}).click()
  await expect(page.locator('#message')).toContainText('Introduce un nombre de usuario')
  assert.equal(requests.filter(r=>r.url.pathname.endsWith('/signup')).length,1)
  await page.getByLabel('Nombre de usuario',{exact:true}).fill('  Prueba  ')
  await page.getByLabel('País de origen',{exact:true}).selectOption('ES')
  await page.getByLabel('Cantón',{exact:true}).selectOption('ZH')
  await page.getByLabel('¿Cuánto llevas en Suiza?',{exact:true}).selectOption('1a3')
  await page.screenshot({path:'test-results/registro-perfil.png',fullPage:true})
  await page.getByRole('button',{name:'Guardar perfil',exact:true}).click()
  await expect(page.locator('#message')).toContainText('Confirma tu correo')
  const signup=requests.find(r=>r.url.pathname.endsWith('/signup'))
  assert.equal(signup.url.searchParams.get('redirect_to'),origin+'/auth/callback')
  assert.equal(signup.body.data.latido_onboarding_completed,false)
  assert.equal(signup.body.data.name,undefined)
  assert.equal(signup.body.data.suizamente_necesita_perfil,true)
  assert.equal(signup.body.data.registro_origen,'suizamente')
  assert.equal(signup.body.code_challenge_method,'s256')
  guest.pendingConfirmation=false
  await page.getByRole('button',{name:'Guardar perfil',exact:true}).click()
  await expect(game.locator('.title')).toHaveText('Suizamente')
  assert.equal(requests.filter(r=>r.url.pathname.endsWith('/signup')).length,1)
  const profileSave=requests.find(r=>r.url.pathname.endsWith('/suizamente-social/profile'))
  assert.deepEqual(profileSave.body,{pais:'ES',canton:'ZH',anosSuiza:'1a3'})
  const named=requests.find(r=>r.url.pathname==='/rest/v1/profiles'&&r.method==='POST')
  assert.equal(named.body.name,'Prueba')
  const ownAccount=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).user.user_metadata,storageKey)
  assert.equal(ownAccount.registro_origen,'suizamente')
  assert.equal(ownAccount.latido_onboarding_completed,false)
  await page.goto(origin+'/cuenta')
  await page.getByRole('button',{name:'Cerrar sesión en esta app'}).click()
  await page.getByRole('button',{name:/Ya tengo cuenta/}).click()
  await page.getByRole('button',{name:'¿Has olvidado la contraseña?'}).click()
  await page.locator('input[type="email"]').fill(user.email)
  await page.getByRole('button',{name:'Enviar enlace'}).click()
  await expect(page.locator('#message')).toContainText('Si existe una cuenta')
  const recovery=requests.find(r=>r.url.pathname.endsWith('/recover'))
  assert.equal(recovery.url.searchParams.get('redirect_to'),origin+'/auth/restablecer')
  assert.equal(recovery.body.code_challenge_method,'s256')
  await page.getByRole('button',{name:/Ya tengo cuenta/}).click()
  await page.locator('input[type="email"]').fill(user.email)
  await page.getByLabel('Contraseña',{exact:true}).fill('password-only-for-mock')
  await page.getByRole('button',{name:'Entrar',exact:true}).click()
  await expect(game.locator('.host-actions')).toContainText('Tu cuenta')
  const saved=data.preguntas.find(q=>q.tipo==='real')
  votes.set(user.id,{[saved.id]:saved.correcta})
  await page.reload()
  await expect(game.locator('.host-actions')).toContainText('Tu cuenta')
  await expect(game.locator('#nota')).toContainText('Tus votos cuentan')
  await expect(game.locator('.stat').first().locator('b')).toHaveText('1')
  assert.equal(await game.locator('body').evaluate((_node,{key,id})=>JSON.parse(localStorage.getItem(key))?.resp[id]?.o,{key:'suizamente:v1:'+user.id,id:saved.id}),saved.correcta)
  await page.goto(origin+'/auth/restablecer')
  await page.getByLabel('Nueva contraseña',{exact:true}).fill('new-password-for-mock')
  await page.getByLabel('Repite la contraseña').fill('different-password')
  const updates=()=>requests.filter(r=>r.url.pathname.endsWith('/user')&&r.method==='PUT').length
  const updatesBeforePassword=updates()
  await page.getByRole('button',{name:'Guardar contraseña'}).click()
  await expect(page.locator('#message')).toContainText('no coinciden')
  assert.equal(updates(),updatesBeforePassword)
  await page.getByLabel('Repite la contraseña').fill('new-password-for-mock')
  await page.getByRole('button',{name:'Guardar contraseña'}).click()
  await expect(page.getByRole('button',{name:'Cerrar sesión en esta app'})).toBeVisible()
  assert.equal(updates(),updatesBeforePassword+1)
  await page.getByRole('button',{name:'Cerrar sesión en esta app'}).click()
  await expect(page.getByRole('button',{name:'Crear cuenta',exact:true})).toBeVisible()
  assert.equal(requests.find(r=>r.url.pathname.endsWith('/logout')).url.searchParams.get('scope'),'local')
  await page.goto(origin+'/instalar')
  await expect(page.getByRole('heading',{name:'Suizamente en tu móvil'})).toBeVisible()
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content','index, follow')
  await page.getByRole('button',{name:'Instalar Suizamente'}).click()
  await expect(page.locator('[data-install-status]')).toContainText('menú de tu navegador')
  await guest.setOffline(true)
  await page.goto(origin+'/cuenta')
  await expect(page.locator('body')).toContainText('conexión')
  await expect(page.locator('input')).toHaveCount(0)
  await guest.close()

  // The generated account/welcome HTML must show the supplied animation,
  // never a plain placeholder page while JavaScript is downloading.
  for(const route of ['/cuenta','/bienvenida']){
    const loading=await context()
    const loadingPage=await loading.newPage()
    let release
    const ready=new Promise(resolve=>{release=resolve})
    await loadingPage.route(origin+'/assets/index-*.js',async request=>{await ready;await request.continue()})
    await loadingPage.goto(origin+route,{waitUntil:'commit'})
    await expect(loadingPage.locator('.startup')).toBeVisible()
    await expect(loadingPage.locator('.boot')).toBeHidden()
    await loadingPage.screenshot({path:'test-results/carga-'+route.slice(1)+'.png',fullPage:true})
    release()
    await expect(loadingPage.locator('.startup')).toHaveCount(0)
    await loading.close()
  }

  // Delayed real totals must not animate digits or reflow long answer labels.
  const percentages=await context({reducedMotion:'no-preference',viewport:{width:320,height:740}})
  const longQuestion=data.preguntas.find(q=>q.opciones.some(op=>op.t==='Multinacional en Ginebra'))
  await percentages.route('**/suizamente/data/preguntas.json',route=>route.fulfill({json:{preguntas:[longQuestion]}}))
  await percentages.route('**/functions/v1/suizamente-votos/**',async route=>{
    const req=route.request(),url=new URL(req.url())
    const headers={'access-control-allow-origin':origin,'access-control-allow-headers':'*'}
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers})
    if(url.pathname.endsWith('/resumen'))return route.fulfill({headers,json:{conteos:{[longQuestion.id]:[8,2,0]}}})
    if(url.pathname.endsWith('/mios'))return route.fulfill({headers,json:{votos:{}}})
    await new Promise(resolve=>setTimeout(resolve,900))
    return route.fulfill({headers,json:{reparto:[9,2,0],opcion:0,yaVotado:false}})
  })
  const stable=await percentages.newPage();await stable.goto(origin)
  const stableGame=stable.frameLocator('iframe')
  await expect(stableGame.locator('#nota')).toContainText('Tus votos cuentan')
  await stableGame.locator('[data-modo="dilemas"]').click()
  await stableGame.locator('body').evaluate(()=>{
    window.__percentageSnapshots=[]
    new window.MutationObserver(()=>{const el=document.querySelector('.is-picked .res-p');if(el)window.__percentageSnapshots.push(el.textContent)}).observe(document.body,{subtree:true,childList:true,characterData:true})
  })
  await stableGame.locator('.opt[data-o="0"]').click()
  await expect(stableGame.locator('.is-picked .res-p')).toHaveText('80%')
  const before=await stableGame.locator('.is-picked .res-t').boundingBox()
  await expect(stableGame.locator('.is-picked .res-p')).toHaveText('82%')
  const after=await stableGame.locator('.is-picked .res-t').boundingBox()
  assert.equal(before.width,after.width);assert.equal(before.height,after.height)
  const snapshots=await stableGame.locator('body').evaluate(()=>window.__percentageSnapshots)
  assert.ok(snapshots.length>=2&&snapshots.every(text=>['80%','82%'].includes(text)),'Only real totals appear; no counting or flashing through intermediate percentages')
  await stable.screenshot({path:'test-results/porcentaje-estable-320.png',fullPage:true})
  await percentages.close()

  const noJs=await context({javaScriptEnabled:false})
  const fallback=await noJs.newPage();await fallback.goto(origin)
  await expect(fallback.locator('.startup')).toBeHidden()
  await expect(fallback.locator('.boot')).toBeVisible()
  assert.match(await fallback.content(),/<noscript>Activa JavaScript para jugar a Suizamente\.<\/noscript>/)
  await noJs.close()

  // A PKCE code is exchanged exactly once, then removed from the URL.
  const callback=await context({colorScheme:'dark',viewport:{width:320,height:740}})
  await callback.addInitScript(({key})=>{if(location.pathname.startsWith('/auth/'))localStorage.setItem(key+'-code-verifier',JSON.stringify('mock-verifier'))},{key:storageKey})
  const cb=await callback.newPage()
  await cb.goto(origin+'/auth/callback?code=mock-code')
  await expect(cb.frameLocator('iframe').locator('.title')).toHaveText('Suizamente')
  assert.equal(cb.url(),origin+'/')
  const exchanges=requests.filter(r=>r.url.searchParams.get('grant_type')==='pkce')
  assert.equal(exchanges.length,1)
  assert.deepEqual(exchanges[0].body,{auth_code:'mock-code',code_verifier:'mock-verifier'})
  await cb.goto(origin+'/cuenta')
  await expect(cb.locator('.email')).toHaveText(user.email)
  assert.equal(await cb.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  await cb.screenshot({path:'test-results/cuenta-estrecha-oscura.png',fullPage:true})
  // Same browser, different origin: no automatic Latido/subdomain login.
  await callback.route('http://localhost:5271/**',route=>route.continue())
  await cb.goto('http://localhost:5271/cuenta')
  await expect(cb.getByRole('button',{name:'Crear cuenta',exact:true})).toBeVisible()
  await callback.close()

  // Confirming on another device must restore the profile from account
  // metadata. A failed profile save retries without creating a second account.
  const confirmed=await context()
  const pending={pais:'ES',canton:'ZH',anosSuiza:'1a3'}
  await confirmed.addInitScript(({key,value,testOrigin})=>{if(location.origin===testOrigin&&window===window.top&&!sessionStorage.getItem('signup-profile-seeded')){localStorage.setItem(key,JSON.stringify(value));sessionStorage.setItem('signup-profile-seeded','true')}},{testOrigin:origin,key:storageKey,value:{...session,user:{...user,user_metadata:{...user.user_metadata,suizamente_perfil_pendiente:pending}}}})
  const profileWrites=[]
  await confirmed.route('**/functions/v1/suizamente-social/profile',route=>{
    const req=route.request(),headers={'access-control-allow-origin':origin,'access-control-allow-headers':'*'}
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers})
    assert.equal(req.method(),'PUT')
    profileWrites.push(req.postDataJSON())
    return route.fulfill({status:profileWrites.length===1?503:200,headers,json:profileWrites.length===1?{error:'fixture retry'}:{perfil:{}}})
  })
  const confirmation=await confirmed.newPage()
  await confirmation.goto(origin+'/auth/callback')
  await expect(confirmation.getByRole('heading',{name:'Tu perfil en Suizamente'})).toBeVisible()
  await confirmation.getByLabel('Nombre de usuario',{exact:true}).fill('Prueba')
  await confirmation.getByRole('button',{name:'Guardar perfil',exact:true}).click()
  await expect(confirmation.frameLocator('iframe').locator('.title')).toHaveText('Suizamente')
  assert.deepEqual(profileWrites,[pending,pending])
  assert.equal(await confirmation.evaluate(key=>JSON.parse(localStorage.getItem(key)).user.user_metadata.suizamente_perfil_pendiente,storageKey),null)
  await confirmed.close()

  const oauth=await context()
  const google=await oauth.newPage()
  await google.goto(origin+'/cuenta')
  await google.getByRole('button',{name:'Continuar con Google'}).click()
  await expect(google).toHaveTitle('Proveedor simulado')
  const authorize=requests.find(r=>r.url.pathname.endsWith('/authorize'))
  assert.equal(authorize.url.searchParams.get('redirect_to'),origin+'/auth/callback')
  assert.equal(authorize.url.searchParams.get('provider'),'google')
  assert.equal(authorize.url.searchParams.get('code_challenge_method'),'s256')
  await oauth.close()
  assert.deepEqual(errors,[])
  console.log('PASS: shared game/modes, manifest/icons, private cache, offline notice, password login/signup/recovery, local logout, PKCE/OAuth, session isolation and mobile/dark views. Auth/API entirely mocked; no external writes.')
} finally {
  await browser?.close()
  await new Promise(resolve=>server.httpServer.close(resolve))
}
