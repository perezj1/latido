import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium,expect,devices } from '@playwright/test'
import { preview,loadEnv } from 'vite'
import {session,alice} from './social-db.mjs'

const origin='http://127.0.0.1:5273',server=await preview({preview:{host:'127.0.0.1',port:5273,strictPort:true}})
const env=loadEnv('production',process.cwd(),'VITE_'),storageKey='sb-'+new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]+'-auth-token'
const browser=await chromium.launch({headless:true}),errors=[]
await mkdir('test-results/installation',{recursive:true})
async function open(device,{installed=false,firstVisit=false}={}){
 const context=await browser.newContext({...devices[device],reducedMotion:'reduce'})
 await context.addInitScript(({installed,firstVisit,key,value})=>{
  window.SUIZAMENTE_DISABLE_SSO=true
  if(!firstVisit)localStorage.setItem(key,JSON.stringify(value))
  if(installed)Object.defineProperty(navigator,'standalone',{value:true})
 },{installed,firstVisit,key:storageKey,value:session(alice)})
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.fulfill({status:503,json:{error:'fixture_offline'}}))
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message))
 await page.goto(origin)
 return {page,context}
}
try{
 const firstVisit=await open('iPhone 13',{firstVisit:true})
 await expect(firstVisit.page).toHaveURL(origin+'/bienvenida')
 await expect(firstVisit.page.getByRole('button',{name:'Crear cuenta',exact:true})).toBeVisible()
 await expect(firstVisit.page.locator('[data-install-banner-slot] .suizamente-install-banner')).toBeVisible()
 await firstVisit.page.screenshot({path:'test-results/installation/bienvenida-iphone.png',fullPage:true})
 await firstVisit.page.locator('.suizamente-install-banner [data-dismiss]').click()
 await firstVisit.page.reload()
 await expect(firstVisit.page.locator('.suizamente-install-banner')).toHaveCount(0)
 await firstVisit.context.close()
 const ios=await open('iPhone 13')
 const banner=ios.page.getByRole('complementary',{name:'Instalar Suizamente'})
 await expect(banner).toContainText('iPhone')
 await ios.page.screenshot({path:'test-results/installation/banner-iphone.png',fullPage:true})
 await banner.getByRole('button',{name:'Cómo instalar'}).click()
 await expect(ios.page).toHaveURL(origin+'/instalar')
 await expect(ios.page.getByRole('heading',{name:'Suizamente en tu móvil'})).toBeVisible()
 await expect(ios.page.locator('.suizamente-install-logo')).toHaveAttribute('src','/suizamente/icons/suizamente-circle-logo-192.png')
 await expect(ios.page.locator('video')).toHaveAttribute('src','/videos/install-ios.mp4')
 await expect(ios.page.locator('.suizamente-install-page')).toContainText('Añadir a pantalla de inicio')
 await ios.page.getByRole('button',{name:'Instalar Suizamente',exact:true}).click()
 await expect(ios.page.locator('[data-install-status]')).toContainText('Safari')
 await ios.page.screenshot({path:'test-results/installation/guia-iphone.png',fullPage:true})
 const range=await ios.page.request.get(origin+'/videos/install-ios.mp4',{headers:{Range:'bytes=0-127'}})
 assert.equal(range.status(),206);assert.equal((await range.body()).length,128)
 assert.match(range.headers()['content-type'],/video\/mp4/)
 await expect.poll(()=>ios.page.locator('video').evaluate(video=>video.readyState)).toBeGreaterThanOrEqual(1)
 await ios.page.emulateMedia({colorScheme:'dark'})
 await ios.page.screenshot({path:'test-results/installation/guia-iphone-oscura.png'})
 await ios.page.locator('video').scrollIntoViewIfNeeded()
 await ios.page.locator('video').evaluate(video=>{video.muted=true;return video.play()})
 await expect.poll(()=>ios.page.locator('video').evaluate(video=>video.currentTime)).toBeGreaterThan(.1)
 await ios.page.locator('video').evaluate(video=>video.pause())
 await ios.page.screenshot({path:'test-results/installation/video-iphone.png'})
 await ios.context.close()

 const android=await open('Pixel 5')
 await expect(android.page.locator('.suizamente-install-banner')).toBeVisible()
 const game=android.page.frameLocator('iframe.game')
 await expect(game.locator('.s-brand img')).toHaveAttribute('src','/suizamente/icons/suizamente-circle-logo-192.png')
 await game.locator('[data-play="dilemas"]').click()
 await expect(game.locator('.q')).toBeVisible()
 await expect(android.page.locator('.suizamente-install-banner')).toHaveCount(0)
 await game.locator('#salir').click()
 await expect(android.page.locator('.suizamente-install-banner')).toBeVisible()
 await android.page.evaluate(()=>{
  const event=new window.Event('beforeinstallprompt',{cancelable:true})
  event.prompt=async()=>{window.__nativeInstalls=(window.__nativeInstalls||0)+1}
  event.userChoice=Promise.resolve({outcome:'accepted'})
  window.dispatchEvent(event)
 })
 await android.page.screenshot({path:'test-results/installation/banner-android.png',fullPage:true})
 await android.page.locator('.suizamente-install-banner [data-install]').click()
 assert.equal(await android.page.evaluate(()=>window.__nativeInstalls),1)
 await expect(android.page.locator('.suizamente-install-banner')).toHaveCount(0)
 await android.page.goto(origin+'/instalar')
 await expect(android.page.locator('.suizamente-install-page')).toContainText('Suizamente ya está instalada')
 await expect(android.page.locator('[data-install]')).toHaveCount(0)
 await android.context.close()

 const dismissed=await open('Pixel 5')
 await dismissed.page.locator('.suizamente-install-banner [data-dismiss]').click()
 await dismissed.page.reload()
 await expect(dismissed.page.locator('iframe.game')).toBeVisible()
 await expect(dismissed.page.locator('.suizamente-install-banner')).toHaveCount(0)
 await dismissed.context.close()
 const installed=await open('iPhone 13',{installed:true})
 await expect(installed.page.locator('iframe.game')).toBeVisible()
 await expect(installed.page.locator('.suizamente-install-banner')).toHaveCount(0)
 await installed.page.goto(origin+'/instalar')
 await expect(installed.page.locator('.suizamente-install-page')).toContainText('Suizamente ya está instalada')
 await installed.context.close()
 assert.deepEqual(errors,[])
 console.log('PASS: iPhone/Android banners, shared installation video with byte ranges, native install gesture, guide fallback, dismissal, installed detection and no banner while answering. API mocked; no production writes.')
}finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve))}
