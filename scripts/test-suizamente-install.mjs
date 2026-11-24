// Exercise the built worker and chunks on an isolated static origin.
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createServer} from 'node:http'
import path from 'node:path'
import {chromium,expect} from '@playwright/test'
const root=path.resolve('dist'),worker=await readFile(path.join(root,'sw.js'),'utf8')
const assets=JSON.parse(worker.match(/const PRECACHE_ASSETS = (\[[^\n]+\])/)[1])
assert.equal(assets.length,new Set(assets).size,'Cache.addAll must receive distinct URLs')
assert.ok(!assets.some(p=>/world3d|mapa3d\.json/.test(p)),'Installation does not download the lazy 3D renderer')
const mime={'.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.html':'text/html','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2','.png':'image/png'}
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+decodeURIComponent(url.pathname))
  if(file!==root&&!file.startsWith(root+path.sep)){res.statusCode=403;return res.end()}
  if(url.pathname.startsWith('/api/')){res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify({error:'Algo ha fallado. Inténtalo otra vez.'}))}
  if(url.pathname==='/sw.js'){
   // Only the local-development switch changes, to test production behavior locally.
   res.writeHead(200,{'Content-Type':'text/javascript','Service-Worker-Allowed':'/'})
   return res.end(worker.replace(/const LOCAL_DEVELOPMENT = [^\n]+/,'const LOCAL_DEVELOPMENT = false'))
  }
  let body,type=path.extname(file)
  try{body=await readFile(file)}catch{body=await readFile(path.join(root,'index.html'));type='.html'}
  res.writeHead(200,{'Content-Type':mime[type]||'application/octet-stream'});res.end(body)
 }catch{res.statusCode=500;res.end()}
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const origin='http://127.0.0.1:'+server.address().port
let browser
try{
 browser=await chromium.launch({headless:true})
 const context=await browser.newContext({reducedMotion:'reduce'}),page=await context.newPage(),errors=[]
 await context.route(/^https:\/\//,route=>route.abort()) // No remote services or accounts.
 await page.addInitScript(()=>sessionStorage.setItem('suizamente:apertura','1'))
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto(origin+'/suizamente')
 await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready})
 await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true)
 const cached=await page.evaluate(async paths=>Promise.all(paths.map(async p=>!!await caches.match(p))),assets)
 assert.ok(cached.every(Boolean),'Every built dependency was installed')
 await context.setOffline(true);await page.goto(origin+'/suizamente/mapa')
 await expect(page.locator('.sv-root')).toBeVisible();await expect(page.getByText('Sin conexión · reintentando…',{exact:true})).toBeVisible()
 assert.ok((await page.locator('link[rel=manifest]').getAttribute('href')).includes('suizamente.webmanifest'))
 assert.ok((await page.evaluate(async()=>{const keys=await caches.keys();return(await Promise.all(keys.map(async k=>(await(await caches.open(k)).keys()).map(r=>new URL(r.url).pathname)))).flat()})).every(p=>!p.startsWith('/api/')))
 assert.deepEqual(errors,[])
 console.log('Install: distinct precache URLs, real built-worker activation, every game dependency cached, offline deep-link reopening and uncached API passed.')
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
