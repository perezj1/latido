import assert from 'node:assert/strict'
import {preview} from 'vite'
import {chromium,expect} from '@playwright/test'

const server=await preview({preview:{host:'127.0.0.1',port:5189,strictPort:true}})
const browser=await chromium.launch({headless:true})
const id='11111111-1111-4111-8111-111111111111'
const user={id,email:'fixture@example.test',aud:'authenticated',role:'authenticated',user_metadata:{name:'Latido',latido_onboarding_completed:false}}
const access=Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fixture-signature'
const session={access_token:access,refresh_token:'refresh-stays-on-Latido',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user}
try{
  const context=await browser.newContext()
  await context.addInitScript(({session})=>{if(location.origin==='https://www.latido.ch')localStorage.setItem('sb-placeholder-auth-token',JSON.stringify(session))},{session})
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url())
    if(url.origin==='https://suizamente.latido.ch')return route.fulfill({contentType:'text/html',body:`<!doctype html><script>window.result=null;const nonce=crypto.randomUUID();window.addEventListener('message',event=>{if(event.origin!=='https://www.latido.ch'||event.source!==document.querySelector('iframe').contentWindow)return;if(event.data.type==='suizamente:sso-ready')event.source.postMessage({type:'suizamente:sso-request',nonce},event.origin);if(event.data.type==='suizamente:sso-session'&&event.data.nonce===nonce)window.result=event.data})</script><iframe src="https://www.latido.ch/suizamente/conectar?appOrigin=https%3A%2F%2Fsuizamente.latido.ch"></iframe>`})
    if(url.origin==='https://www.latido.ch'){
      const response=await route.fetch({url:'http://127.0.0.1:5189'+url.pathname+url.search})
      return route.fulfill({response,headers:{...response.headers(),...(url.pathname==='/suizamente/conectar'?{'content-security-policy':'frame-ancestors https://suizamente.latido.ch'}:{})}})
    }
    if(url.pathname==='/auth/v1/user')return route.fulfill({json:user})
    if(url.pathname==='/rest/v1/profiles')return route.fulfill({json:{id,name:'Latido',banned:false,interests:[]}})
    if(url.pathname==='/rest/v1/rpc/get_my_account_access')return route.fulfill({json:{role:'member'}})
    return route.fulfill({json:[]})
  })
  const page=await context.newPage()
  await page.goto('https://suizamente.latido.ch/bridge-test')
  await expect.poll(()=>page.evaluate(()=>window.result?.accessToken)).toBe(access)
  const result=await page.evaluate(()=>window.result)
  assert.equal(result.userId,id)
  assert.equal(JSON.stringify(result).includes('refresh-stays-on-Latido'),false)
  await expect(page.frameLocator('iframe').getByRole('heading',{name:'Tu cuenta de Latido en Suizamente'})).toBeVisible()
  console.log('PASS: actual Latido build connects a trusted Suizamente iframe, including accounts with pending Latido onboarding, without transferring refresh tokens. Auth is mocked; no external writes.')
}finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve))}
