import assert from 'node:assert/strict'
import {readFile,mkdir} from 'node:fs/promises'
import {createServer} from 'node:http'
import {resolve,extname} from 'node:path'
import {chromium,expect} from '@playwright/test'
import {createSuizamenteHttp} from '../../../supabase/functions/_shared/suizamenteHttp.js'
const root=resolve('../../public'),bank=JSON.parse(await readFile(root+'/suizamente/data/preguntas.json','utf8')),real=bank.preguntas.find(q=>q.tipo==='real'&&q.opciones.length===4),vm=bank.preguntas.find(q=>q.pregunta.startsWith('¿Verdad o mito?')),dilema=bank.preguntas.find(q=>q.tipo==='dilema'),saved=new Map(),errors=[]
const api=createSuizamenteHttp({questions:new Map(bank.preguntas.map(q=>[q.id,q.opciones.length])),getSecret:()=> 'fixture-only-secret',allowedOrigin:()=>true,getClient:()=>({rpc:async(_name,args)=>{
 if(args.accion==='resumen')return {data:{conteos:{}}}
 if(args.accion==='mios')return {data:{votos:{}}}
 const key=args.jugador+':'+args.pregunta,old=saved.get(key);if(old===undefined)saved.set(key,args.eleccion)
 return {data:{opcion:saved.get(key),yaVotado:old!==undefined,reparto:Array.from({length:bank.preguntas.find(q=>q.id===args.pregunta).opciones.length},(_,i)=>i===saved.get(key)?1:0)}}
 }})})
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost')
 if(url.pathname.startsWith('/api/suizamente')){const chunks=[];for await(const c of req)chunks.push(c);const response=await api({method:req.method,url:url.href,headers:req.headers,body:chunks.length?JSON.parse(Buffer.concat(chunks)):null,address:'fixture'});res.writeHead(response.status,response.headers);return res.end(JSON.stringify(response.body))}
 if(url.pathname==='/fixture.json'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({...bank,preguntas:[{real,vm,dilema}[url.searchParams.get('type')]]}))}
 const path=resolve(root,'.'+url.pathname);if(!path.startsWith(root))throw Error('path');res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'})[extname(path)]||'application/octet-stream');res.end(await readFile(path))
 }catch{res.statusCode=404;res.end()}})
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true}),origin='http://127.0.0.1:'+server.address().port
try{
 await mkdir('output/cuatro-opciones/base',{recursive:true})
 for(const type of ['real','vm','dilema']){
  const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await ctx.addInitScript(type=>{window.SUIZAMENTE_CONFIG={datos:'/fixture.json?type='+type,ronda:1,experiencia:false}},type);const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/suizamente/juego.html');await page.locator('[data-modo="'+(type==='dilema'?'dilemas':'preguntas')+'"]').click()
  if(type==='real'){
   await expect(page.locator('.opt')).toHaveCount(4);await expect(page.locator('.opt .oe')).toHaveCount(0);assert.equal(await page.locator('.opt.o4').evaluate(e=>window.getComputedStyle(e).getPropertyValue('--oc').trim()),'#FA2F35')
   const index=Number(await page.locator('.opt').nth(3).getAttribute('data-o'));await page.keyboard.press('4');await expect(page.getByRole('dialog')).toBeVisible();await expect.poll(()=>saved.size).toBe(1);assert.equal([...saved.values()][0],index);assert.equal(await page.evaluate(id=>JSON.parse(localStorage.getItem('suizamente:v1')).resp[id].o,real.id),index)
   for(const option of real.opciones)assert.ok(!(await page.locator('.res-t').allTextContents()).some(t=>t.includes(option.e)))
   await page.screenshot({path:'output/cuatro-opciones/base/resultado.png',fullPage:true})
  }else if(type==='vm'){assert.deepEqual(await page.locator('.opt .ot').allTextContents(),['Verdad','Mito']);await expect(page.locator('.opt .oe')).toHaveCount(0)}
  else await expect(page.locator('.opt .oe')).toHaveCount(dilema.opciones.length)
  await ctx.close()
 }
 assert.deepEqual(errors,[]);console.log('Base: fourth color, key 4 → original stored/API index, emoji-free real results, fixed Verdad/Mito and dilemma emojis passed.')
}finally{await browser.close();await new Promise(r=>server.close(r))}
