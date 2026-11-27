import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {chromium,expect as rawExpect} from '@playwright/test'
import {startSuizamentePreview,testToken,testUser} from './lib/suizamente-v2-preview.mjs'
import {A,call} from './lib/suizamente-v2-test-db.mjs'
import {fixtureBusiness} from './lib/negocios-test-db.mjs'
const expect=rawExpect.configure({timeout:30000})
const out='output/pagos',errors=[];let preview,browser
try{
 await mkdir(out,{recursive:true});preview=await startSuizamentePreview(5698,{hmr:false,negocios:true,cobroAutomatico:true});await call(preview.db,A,'regalo')
 browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'})
 await context.addInitScript(s=>{localStorage.setItem('sb-127-auth-token',JSON.stringify(s));sessionStorage.setItem('suizamente:apertura','1');Object.defineProperty(navigator,'standalone',{get:()=>true})},{access_token:testToken(A),refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+86400,user:testUser(A,'Alex')})
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
 async function shot(name){for(const [width,height]of [[390,844],[375,667]]){await page.setViewportSize({width,height});await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:out+'/'+name+'-'+width+'.png'})}await page.setViewportSize({width:390,height:844})}
 await page.goto(preview.origin+'/suizamente/negocios/alta')
 for(const [label,key]of [['Nombre del negocio','nombre'],['Una frase sobre tu negocio','descripcion'],['Dirección','direccion'],['Código postal','postal'],['Email para las facturas','email']])await page.getByLabel(label,{exact:true}).fill(fixtureBusiness[key])
 await page.getByLabel('Ciudad',{exact:true}).selectOption('Zürich|ZH');await page.getByRole('button',{name:'Seguir',exact:true}).click();await page.getByRole('radio',{name:/Plaza A/}).check()
 for(let n=0;n<4;n++)await page.getByRole('button',{name:'Seguir',exact:true}).click()
 await expect(page.getByRole('radio',{name:/Tarjeta/})).toBeChecked();await page.getByRole('radio',{name:/TWINT/}).check();await page.getByRole('button',{name:'Atrás',exact:true}).click();await expect(page.getByRole('radio',{name:'Cada año',exact:true})).toBeChecked();await page.getByRole('button',{name:'Seguir',exact:true}).click();await page.getByRole('radio',{name:/Tarjeta/}).check()
 await shot('NegocioPago');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Enviar a revisión',exact:true}).click();await expect(page.getByRole('heading',{name:'¡Recibido!',exact:true})).toBeVisible()
 const id=page.url().split('/').at(-2);await expect(page.getByRole('button',{name:'Guardar tarjeta en Stripe',exact:true})).toBeVisible()
 assert.equal(await page.locator('input[autocomplete="cc-number"],input[autocomplete="cc-csc"]').count(),0)
 await preview.db.query("UPDATE suizamente_private.negocio_cobros SET cliente='cus_local',preparada=true,payment_method='pm_local',suscripcion='sub_local' WHERE negocio=$1",[id])
 await page.goto(preview.origin+'/suizamente/negocios/'+id+'/panel/cuenta');await expect(page.getByRole('button',{name:'Gestionar tarjeta y facturas',exact:true})).toBeVisible();await shot('NegocioCuenta')
 await page.getByRole('link',{name:/Darme de baja/}).click();await expect(page.getByRole('button',{name:'Confirmar mi baja al final del periodo',exact:true})).toBeVisible();await shot('NegocioBaja')
 let html='<!doctype html><meta charset="utf-8"><title>Pagos · comparación local</title><style>body{font:16px system-ui;background:#EEF1F5}section{display:flex;gap:20px;align-items:start}figure{margin:0}img{max-width:390px}</style><h1>Stripe · interfaz local, sin conectar con la cuenta</h1>'
 for(const name of ['NegocioPago','NegocioCuenta','NegocioBaja'])html+='<h2>'+name+'</h2><section><figure><figcaption>Diseño</figcaption><img src="../negocios/referencia/'+name+'.png"></figure>'+[390,375].map(w=>'<figure><figcaption>App · '+w+'</figcaption><img src="'+name+'-'+w+'.png"></figure>').join('')+'</section>'
 await writeFile(out+'/comparacion.html',html);await page.goto('file:///'+resolve(out+'/comparacion.html').replaceAll('\\','/'));await page.setViewportSize({width:1240,height:1000});await page.screenshot({path:out+'/comparacion.png',fullPage:true})
 assert.deepEqual(errors,[]);console.log('PASS interfaz pagos: tres métodos, anual obligatorio, sin campos de tarjeta en Latido, cuenta/portal y baja; ambos tamaños; capturas con diseño')
}finally{await browser?.close();await preview?.close()}
