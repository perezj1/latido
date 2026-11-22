import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {chromium,expect,devices} from '@playwright/test'
import {preview,loadEnv} from 'vite'
import {fixture,alice,bob,users,session,token} from './social-db.mjs'
import {installLatidoSsoBridge} from '../../../src/lib/suizamenteSsoBridge.js'

const origin='http://127.0.0.1:5271',env=loadEnv('production',process.cwd(),'VITE_')
const key='sb-'+new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]+'-auth-token'
const f=await fixture(),server=await preview({preview:{host:'127.0.0.1',port:5271,strictPort:true}})
const browser=await chromium.launch({headless:true}),errors=[]
await mkdir('test-results/onboarding',{recursive:true})
async function open({allowSso=false,initialSession=null,device}={}){
  const context=await browser.newContext({viewport:{width:390,height:844},...(device?devices[device]:{}),reducedMotion:'reduce',colorScheme:'dark'})
  const state={allowSso,signup:0,confirmed:true,user:{...users[alice],user_metadata:{name:'Nombre Latido',latido_onboarding_completed:true}},profileWrites:[],bootstraps:0}
  const currentSession=()=>({...session(state.user.id),user:state.user})
  if(initialSession)state.user=initialSession.user
  await context.addInitScript(({origin,key,value,device})=>{if(location.origin!==origin)return;if(!device)localStorage.setItem('suizamente:pwa-installed','1');if(value&&!sessionStorage.getItem('seeded')){localStorage.setItem(key,JSON.stringify(value));sessionStorage.setItem('seeded','true')}},{origin,key,value:initialSession,device})
  await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url())
    if(url.origin===origin)return route.continue()
    if(url.origin==='https://avatars.example.test'&&url.pathname.startsWith('/storage/v1/object/public/avatars/'))return route.fulfill({contentType:'image/jpeg',body:Buffer.from(f.uploads.get(url.pathname.replace('/storage/v1/object/public/avatars/',''))||[])})
    if(['https://latido.ch','https://www.latido.ch'].includes(url.origin)&&url.pathname==='/suizamente/conectar'){
      if(!state.allowSso)return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Sin sesión de Latido</title>'})
      const account={access_token:token(alice),user:{id:alice}}
      const script=`(${installLatidoSsoBridge.toString()})({origins:[${JSON.stringify(origin)}],getSession:async()=>({data:{session:${JSON.stringify(account)}}})});for(const receiver of [window.parent,window.opener])if(receiver&&receiver!==window)receiver.postMessage({type:'suizamente:sso-ready'},${JSON.stringify(origin)});`
      return route.fulfill({contentType:'text/html',body:'<!doctype html><script>'+script+'</script>'})
    }
    let body={};try{body=req.postDataJSON()||{}}catch{}
    const headers={'access-control-allow-origin':origin,'access-control-allow-headers':'*'}
    const send=(json,status=200)=>route.fulfill({json,status,headers})
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers})
    if(url.pathname.startsWith('/auth/v1/')){
      if(url.pathname.endsWith('/signup')){
        state.signup++;state.confirmed=false
        state.user={...users[bob],email:body.email,created_at:new Date().toISOString(),user_metadata:body.data,identities:[{provider:'email'}]}
        await f.db.query('UPDATE public.profiles SET name=NULL,canton=NULL WHERE id=$1',[bob])
        return send(state.user)
      }
      if(url.pathname.endsWith('/token'))return state.confirmed?send(currentSession()):send({code:'email_not_confirmed',error_code:'email_not_confirmed',message:'Email not confirmed'},400)
      if(url.pathname.endsWith('/verify'))return send(currentSession())
      if(url.pathname.endsWith('/user')){
        if(req.method()==='PUT'){state.user={...state.user,user_metadata:{...state.user.user_metadata,...body.data}};await f.db.query('UPDATE auth.users SET raw_user_meta_data=$1 WHERE id=$2',[JSON.stringify(state.user.user_metadata),state.user.id])}
        return send(state.user)
      }
      if(url.pathname.endsWith('/authorize'))return route.fulfill({contentType:'text/html',body:'<title>Google de prueba</title>'})
      if(url.pathname.endsWith('/logout'))return send({})
      return send({})
    }
    if(url.pathname==='/rest/v1/profiles'){
      if(req.method()==='POST'){await f.db.query('UPDATE public.profiles SET name=$1,canton=$2 WHERE id=$3',[body.name,body.canton,body.id]);return send({},201)}
      const id=url.searchParams.get('id')?.replace('eq.','')||state.user.id
      return send((await f.db.query('SELECT name,canton FROM public.profiles WHERE id=$1',[id])).rows[0])
    }
    if(url.pathname.includes('/functions/v1/suizamente-social')||url.pathname.includes('/functions/v1/suizamente-votos')){
      const social=url.pathname.includes('/suizamente-social')
      if(url.pathname.endsWith('/bootstrap'))state.bootstraps++
      if(url.pathname.endsWith('/profile')&&req.method()==='PUT')state.profileWrites.push(body)
      const result=await(social?f.social:f.votes)({method:req.method(),url:req.url(),headers:{...req.headers(),origin},body,address:state.user.id})
      return route.fulfill({status:result.status,headers:result.headers,...(result.status===204?{body:''}:{json:result.body})})
    }
    return route.fulfill({status:404,body:'External request blocked'})
  })
  context.on('page',page=>page.on('pageerror',e=>errors.push(e.message)))
  const page=await context.newPage()
  await page.goto(origin,{waitUntil:'commit'})
  return {context,page,state,currentSession}
}
async function finish(view,{skip=false,name='Nombre Latido',installReminder,photo=false}={}){
  const {page,state}=view
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow','1')
  if(skip)await page.getByRole('button',{name:'Saltar',exact:true}).click()
  else for(let i=1;i<=4;i++){
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow',String(i))
    await page.setViewportSize(i===3?{width:320,height:568}:i===2?{width:375,height:667}:{width:390,height:844})
    if(i===2){await page.locator('.onb-op').first().click();await expect(page.locator('.onb-res-0')).toHaveCSS('opacity','1');assert.equal(state.profileWrites.length,0)}
    assert.equal(await page.locator('.s-onboarding').evaluate(n=>n.scrollWidth<=n.clientWidth),true)
    await page.screenshot({path:`test-results/onboarding/paso-${i}.png`,fullPage:true})
    await page.locator('.s-onb-next').click()
  }
  await page.setViewportSize({width:375,height:667})
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow','5')
  await expect(page.locator('[name="canton"] option')).toHaveCount(27)
  await page.getByLabel('Nombre de usuario',{exact:true}).fill('  ')
  await page.getByRole('button',{name:'¡A jugar!',exact:true}).click()
  await expect(page.getByRole('alert')).toContainText('Introduce un nombre de usuario')
  assert.notEqual(state.user.user_metadata.suizamente_onboarding_completed,true)
  assert.equal(state.profileWrites.length,0)
  await page.getByLabel('Nombre de usuario',{exact:true}).fill(name)
  await page.getByLabel('País de origen',{exact:true}).selectOption('ES')
  await page.getByLabel('Cantón',{exact:true}).selectOption('ZH')
  await page.getByLabel('¿Cuánto llevas en Suiza?',{exact:true}).selectOption('1a3')
  if(photo){
    await page.locator('[data-photo-file]').setInputFiles({name:'foto.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="90" height="120"><rect width="90" height="120" fill="#3366dd"/></svg>')})
    await expect(page.locator('[data-photo-preview] img')).toHaveAttribute('src',/^data:image\/jpeg;base64,/)
  }
  await page.reload()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow','5')
  await expect(page.getByLabel('Nombre de usuario',{exact:true})).toHaveValue(name)
  await expect(page.getByLabel('Cantón',{exact:true})).toHaveValue('ZH')
  if(photo)await expect(page.locator('[data-photo-preview] img')).toHaveAttribute('src',/^data:image\/jpeg;base64,/)
  await page.screenshot({path:'test-results/onboarding/paso-5-perfil.png',fullPage:true})
  await page.getByRole('button',{name:'¡A jugar!',exact:true}).click()
  if(installReminder){
    const dialog=page.getByRole('dialog',{name:'Instala Suizamente en tu móvil'})
    await expect(dialog).toBeVisible()
    if(installReminder==='ios'){
      await expect(dialog.locator('video')).toHaveAttribute('src',/^\/videos\/install-ios\.mp4(?:\?v=\d+)?$/)
      await expect(dialog).toContainText('Añadir a pantalla de inicio')
      await expect(dialog.locator('[data-install]')).toHaveCount(0)
      await page.screenshot({path:'test-results/onboarding/instalar-iphone.png',fullPage:true})
      await dialog.getByRole('button',{name:'Ahora no, ir a jugar'}).click()
    }else{
      await page.evaluate(()=>{
        const event=new window.Event('beforeinstallprompt',{cancelable:true})
        event.prompt=async()=>{window.__installs=(window.__installs||0)+1}
        event.userChoice=Promise.resolve({outcome:'accepted'})
        window.dispatchEvent(event)
      })
      await page.screenshot({path:'test-results/onboarding/instalar-android.png',fullPage:true})
      await dialog.getByRole('button',{name:'Instalar Suizamente',exact:true}).click()
    }
    await expect(dialog).toHaveCount(0)
  }else await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.frameLocator('iframe.game').locator('[data-play="dilemas"]')).toBeVisible()
  assert.equal(state.user.user_metadata.suizamente_onboarding_completed,true)
  assert.deepEqual(state.profileWrites.at(-1),{pais:'ES',canton:'ZH',anosSuiza:'1a3'})
  if(photo){
    const saved=await f.client.rpc('suizamente_social_fotos',{p_usuarios:[state.user.id]})
    assert.ok(saved.data[0].url.includes('/avatars/'+state.user.id+'/suizamente/'))
  }
  await page.reload()
  await expect(page.frameLocator('iframe.game').locator('[data-play="dilemas"]')).toBeVisible()
  await expect(page.getByRole('progressbar')).toHaveCount(0)
}
try{
  // Automatic Latido sign-in: no welcome/login page, first visit gets the tour.
  const linked=await open({allowSso:true})
  await finish(linked,{photo:true})
  const anotherDevice=await open({initialSession:linked.currentSession()})
  await expect(anotherDevice.page.frameLocator('iframe.game').locator('[data-play="dilemas"]')).toBeVisible()
  await expect(anotherDevice.page.getByRole('progressbar')).toHaveCount(0)
  await anotherDevice.context.close();await linked.context.close();await f.reset()

  // Missing Latido session: animation, welcome, register, confirm, login, tour.
  const email=await open()
  await expect(email.page.locator('.startup')).toBeVisible()
  await expect(email.page.locator('.s-onb-welcome')).toBeVisible({timeout:7000})
  assert.equal(email.state.bootstraps,0,'Welcome must not create an anonymous game profile')
  await email.page.getByRole('button',{name:'Crear cuenta',exact:true}).click()
  await expect(email.page.getByRole('button',{name:'Continuar con Google'})).toBeVisible()
  await expect(email.page.getByRole('button',{name:'Entrar con mi cuenta de Latido'})).toBeVisible()
  await email.page.getByLabel('Email',{exact:true}).fill('nuevo@example.test')
  await email.page.getByLabel('Contraseña',{exact:true}).fill('fixture-only-password')
  await email.page.getByRole('checkbox').check()
  await email.page.getByRole('button',{name:'Crear cuenta',exact:true}).click()
  await expect(email.page.locator('#message')).toContainText('Confirma tu correo')
  await expect(email.page.getByRole('progressbar')).toHaveCount(0)
  assert.equal(email.state.signup,1)
  email.state.confirmed=true
  await email.page.getByRole('button',{name:/Ya tengo cuenta/}).click()
  await email.page.getByLabel('Email',{exact:true}).fill('nuevo@example.test')
  await email.page.getByLabel('Contraseña',{exact:true}).fill('fixture-only-password')
  await email.page.getByRole('button',{name:'Entrar',exact:true}).click()
  await finish(email,{skip:true,name:'Perfil Suizamente'})
  assert.equal(email.state.user.user_metadata.latido_onboarding_completed,false)
  await email.context.close();await f.reset()

  // Google is the same first-login flow and still requires a profile name.
  const google=await open()
  await expect(google.page.locator('.s-onb-welcome')).toBeVisible({timeout:7000})
  await google.page.getByRole('button',{name:'Ya tengo una cuenta',exact:true}).click()
  await expect(google.page.getByRole('button',{name:'Entrar con mi cuenta de Latido'})).toBeVisible()
  await google.page.getByRole('button',{name:'Continuar con Google'}).click()
  await expect(google.page).toHaveTitle('Google de prueba')
  google.state.user={...users[bob],created_at:new Date().toISOString(),app_metadata:{providers:['google'],provider:'google'},user_metadata:{name:'Nombre Google'}}
  await google.page.goto(origin+'/auth/callback?code=fixture-google-code')
  await finish(google,{skip:true,name:'Perfil Google'})
  assert.equal(google.state.user.user_metadata.registro_origen,'suizamente')
  await google.context.close()
  await f.reset()

  // Dismissing on welcome resurfaces installation once, after the profile saves.
  for(const device of ['iPhone 13','Pixel 5']){
    const view=await open({device})
    const {page}=view
    await expect(page.locator('.suizamente-install-banner')).toBeVisible({timeout:7000})
    if(device==='Pixel 5'){
      await page.evaluate(()=>{
        const event=new window.Event('beforeinstallprompt',{cancelable:true})
        event.prompt=async()=>{}
        event.userChoice=Promise.resolve({outcome:'dismissed'})
        window.dispatchEvent(event)
      })
      await page.locator('.suizamente-install-banner [data-install]').click()
    }else await page.getByRole('button',{name:'Cerrar aviso de instalación'}).click()
    await expect(page.locator('.suizamente-install-banner')).toHaveCount(0)
    await page.getByRole('button',{name:'Ya tengo una cuenta',exact:true}).click()
    await page.getByLabel('Email',{exact:true}).fill('alice@example.test')
    await page.getByLabel('Contraseña',{exact:true}).fill('fixture-only-password')
    await page.getByRole('button',{name:'Entrar',exact:true}).click()
    await finish(view,{skip:true,installReminder:device==='Pixel 5'?'android':'ios'})
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await view.context.close();await f.reset()
  }
  assert.deepEqual(errors,[])
  console.log('PASS: Latido SSO, failed-session animation/welcome, email signup/confirmation/login, Google, all five tutorial pages, skip-to-profile, mandatory name, persisted drafts, server profile save and one-time onboarding across devices. No production writes.')
}finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));await f.db.close()}
