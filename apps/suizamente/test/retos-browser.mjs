import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {preview,loadEnv} from 'vite'
import {chromium,webkit,expect} from '@playwright/test'
import {fixture,alice,bob,session} from './social-db.mjs'
import {repartoDemo} from '../../../public/suizamente/demostracion.js'

const f=await fixture(),origin='http://127.0.0.1:5271',env=loadEnv('production',process.cwd(),'VITE_')
const engine=process.argv.includes('--webkit')?'webkit':'chromium'
const storageKey='sb-'+new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]+'-auth-token'
const server=await preview({preview:{host:'127.0.0.1',port:5271,strictPort:true}})
const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true})
const context=await browser.newContext({viewport:{width:375,height:812},reducedMotion:'reduce',hasTouch:true,serviceWorkers:'block'})
const errors=[],requests=[]
await mkdir('test-results/retos',{recursive:true})
const rpc=async(action,data={},id=alice)=>(await f.db.query('SELECT public.suizamente_social_api($1,$2,$3::jsonb,$4) r',[action,'user:'+id,JSON.stringify(data),'layout-fixture-'+id])).rows[0].r
await context.addInitScript(({key,value,origin})=>{
 window.SUIZAMENTE_DISABLE_SSO=true
 if(location.origin!==origin)return
 localStorage.setItem('suizamente:bienvenida','true')
 localStorage.setItem('suizamente:pwa-installed','1')
 if(!sessionStorage.getItem('fixture-seeded')){localStorage.setItem(key,JSON.stringify(value));sessionStorage.setItem('fixture-seeded','true')}
},{key:storageKey,value:session(alice),origin})
await context.route('**/*',async route=>{
 const req=route.request(),url=new URL(req.url())
 if(url.origin===origin)return route.continue()
 const social=url.pathname.includes('/functions/v1/suizamente-social'),votes=url.pathname.includes('/functions/v1/suizamente-votos')
 if(!social&&!votes)return route.fulfill({json:[]})
 let body={};try{body=req.postDataJSON()||{}}catch{}
 const response=await(social?f.social:f.votes)({method:req.method(),url:req.url(),headers:{...req.headers(),origin},body,address:'layout-browser'})
 requests.push({method:req.method(),path:url.pathname,status:response.status})
 return route.fulfill({status:response.status,headers:response.headers,...(response.status===204?{body:''}:{json:response.body})})
})
const page=await context.newPage(),game=page.frameLocator('iframe.game')
page.on('pageerror',error=>errors.push(error.message))
async function visit(path){await f.reset();await page.goto(origin+path);await expect(game.locator('.social')).toHaveAttribute('data-online','true')}
async function compact(label){
 const size=await game.locator('.s-challenge').evaluate(card=>{
  const week=card.querySelector('.s-week').getBoundingClientRect(),button=card.querySelector('[data-daily]').getBoundingClientRect()
  return {height:card.getBoundingClientRect().height,week:week.height,gap:button.top-week.bottom,overflow:document.documentElement.scrollWidth>innerWidth}
 })
 assert.ok(size.height<400,`${engine} ${label}: daily card must fit its content (${size.height}px)`)
 assert.ok(size.week<90&&size.gap<35,`${engine} ${label}: no empty space below the week`)
 assert.equal(size.overflow,false)
 await page.screenshot({path:`test-results/retos/${engine}-${label}.png`,fullPage:true})
}
try{
 await visit('/retos');await compact('pendiente')
 const daily=await rpc('reto')
 for(const id of daily.preguntas){const q=f.questions.find(q=>q.id===id);await rpc('respuesta',{preguntaId:id,opcion:q.correcta??0,contexto:{tipo:'reto',fecha:daily.fecha}})}
 await visit('/retos');await expect(game.locator('.s-challenge [data-daily]')).toHaveText('Ver mi resultado');await compact('completado')
 await page.setViewportSize({width:320,height:740});await compact('completado-320')
 await visit('/')
 const card=game.locator('.s-community-card'),q=f.questions.find(q=>q.id==='montana_lago')
 await expect(card).not.toContainText('Respondido')
 await card.click();await game.locator('.opt[data-o="1"]').click();await expect(game.locator('#social-points')).toContainText(/puntos|guardada/)
 await visit('/')
 const pct=Math.round(100*repartoDemo(q,[]).n[1]/320)
 await expect(card).toContainText('Respondido')
 await expect(card).toContainText(`Formas parte del ${pct}% que eligieron «${q.opciones[1].t}»`)
 await page.screenshot({path:`test-results/retos/${engine}-comunidad-respondida.png`,fullPage:true})
 await rpc('amigo_solicitar',{id:'user:'+bob});await rpc('amigo_responder',{id:'user:'+alice,respuesta:'aceptar'},bob)
 const open=await rpc('duelo_crear',{modo:'mix'}),named=await rpc('duelo_crear',{modo:'preguntas',rival:'user:'+bob})
 await visit('/retos')
 const openCard=game.locator(`[data-duel="${open.codigo}"]`),namedCard=game.locator(`[data-duel="${named.codigo}"]`)
 await expect(openCard).toContainText('Reto creado');await expect(openCard).toContainText('Sin rival')
 await expect(namedCard).toContainText('Esperando respuesta de Otra persona')
 const remove=openCard.getByRole('button',{name:'Eliminar reto',exact:true}),send=openCard.getByRole('button',{name:'Enviar reto',exact:true})
 await expect(remove).toHaveText('');await expect(remove.locator('svg')).toHaveCount(1)
 const left=await remove.boundingBox(),right=await send.boundingBox()
 assert.ok(left.x<right.x&&right.x-left.x>60,'Trash belongs on the left and send action on the right')
 await page.screenshot({path:`test-results/retos/${engine}-retos-creados.png`,fullPage:true})
 await rpc('duelo_unirse',{codigo:named.codigo},bob)
 await visit('/retos');await expect(namedCard).toContainText('Esperando respuesta de Otra persona');await expect(namedCard.locator('[data-invite]')).toHaveCount(0)
 await remove.click();await expect(openCard).toHaveCount(0)
 assert.deepEqual(errors,[])
 console.log(`PASS: ${engine} compact pending/completed daily card, saved community response, named rival status, icon-only trash and action placement.`)
}catch(error){await page.screenshot({path:`test-results/retos/${engine}-failure.png`,fullPage:true});console.error('Fixture requests:',requests);throw error}
finally{await context.close();await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));await f.db.close()}
