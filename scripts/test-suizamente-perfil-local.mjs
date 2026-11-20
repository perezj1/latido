import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium,expect } from '@playwright/test'
import { loadEnv } from 'vite'
import { fixture,alice,users,session } from '../apps/suizamente/test/social-db.mjs'

// Exercise the running integrated host, rather than the standalone PWA preview.
// All authentication and API operations use fixtures; production receives no writes.
const origin='http://localhost:8080',env=loadEnv('development',process.cwd(),'VITE_')
const storageKey='sb-'+new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]+'-auth-token'
const f=await fixture(),browser=await chromium.launch({headless:true}),logouts=[],errors=[]
try{
 const context=await browser.newContext({viewport:{width:375,height:667},reducedMotion:'reduce'})
 await context.addInitScript(({origin,key,value})=>{if(location.origin===origin){localStorage.setItem(key,JSON.stringify(value));localStorage.setItem('suizamente:bienvenida','true')}},{origin,key:storageKey,value:session(alice)})
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url())
  if(url.origin===origin&&url.pathname.startsWith('/api/suizamente')){
   let body={};try{body=request.postDataJSON()||{}}catch{}
   const result=await(url.pathname.startsWith('/api/suizamente/social')?f.social:f.votes)({method:request.method(),url:request.url(),headers:{...request.headers(),origin},body,address:'local-profile-fixture'})
   return route.fulfill({status:result.status,headers:result.headers,...(result.status===204?{body:''}:{json:result.body})})
  }
  if(url.origin===origin)return route.continue()
  if(url.pathname==='/auth/v1/logout'){logouts.push(url.searchParams.get('scope'));return route.fulfill({status:204,body:''})}
  if(url.pathname==='/auth/v1/user')return route.fulfill({json:users[alice]})
  if(url.pathname==='/rest/v1/profiles')return route.fulfill({json:{id:alice,name:'Nombre Latido',canton:'Zürich',banned:false,interests:[]}})
  if(url.pathname==='/rest/v1/rpc/get_my_account_access')return route.fulfill({json:{role:'member'}})
  return route.fulfill({json:[]})
 })
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message))
 await page.goto(origin+'/suizamente/perfil')
 const game=page.frameLocator('iframe[title="Suizamente, un juego de Latido"]')
 const logout=game.getByRole('button',{name:'Cerrar sesión',exact:true})
 await expect(logout).toBeVisible()
 await logout.scrollIntoViewIfNeeded()
 await mkdir('output/suizamente-referencia',{recursive:true})
 await page.screenshot({path:'output/suizamente-referencia/perfil-local-8080.png',fullPage:true})
 await logout.click()
 await expect(page).toHaveURL(origin+'/auth?mode=login&next=%2Fsuizamente')
 await expect(page.locator('input[type="email"]')).toBeVisible()
 assert.deepEqual(logouts,['local'])
 assert.equal(await page.evaluate(key=>localStorage.getItem(key),storageKey),null)
 assert.deepEqual(errors,[])
 console.log('PASS: localhost:8080/suizamente/perfil shows Cerrar sesión; local logout opens the login form. Auth/API mocked, no production writes.')
 await context.close()
}finally{await browser.close();await f.db.close()}
