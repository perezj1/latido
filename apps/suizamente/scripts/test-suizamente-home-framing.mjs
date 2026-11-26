// Actual 3D snapshots in a standalone-style viewport, with disposable local SQL.
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium,webkit} from '@playwright/test'
import {startSuizamentePreview} from './lib/suizamente-v2-preview.mjs'
import {A,call} from './lib/suizamente-v2-test-db.mjs'

const engine=process.argv.includes('--webkit')?'webkit':'chromium',out='output/encuadre-inicio/'+engine
let preview,browser
try{
 await mkdir(out,{recursive:true});preview=await startSuizamentePreview(engine==='webkit'?5533:5532,{hmr:false})
 const config=await call(preview.db,A,'config'),regiones=config.mapa.regiones.map(r=>({c:r.cantones.map(c=>c.id)}))
 browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,args:engine==='chromium'?['--enable-unsafe-swiftshader']:[]})
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,reducedMotion:'reduce'})
 await ctx.addInitScript(()=>Object.defineProperty(navigator,'standalone',{get:()=>true}))
 const page=await ctx.newPage();await page.route('**/__framing',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><body></body>'}))
 await page.goto(preview.origin+'/__framing')
 const cases=[['central-mixto',0,[3,0,1,1,0,2],306,226],['central-mixto-baja',0,[3,0,1,1,0,2],259,186],['central-completo',0,[3],346,226],['central-tierra',0,[0],306,226],['region-4-completa',3,[3],259,186],['oriental-mixta',6,[1,3,2,0],346,226]],results=[]
 for(const [name,region,levels,width,height] of cases){
  const snapshot=await page.evaluate(async({regiones,region,levels,width,height})=>{
   const [{Mapa3D},datos]=await(await import('/game/src/components/suizamente/v2/mapPhotos.js')).loadMapAssets()
   const niv=Object.fromEntries(regiones[region].c.map((id,i)=>[id,levels[i%levels.length]])),png=Mapa3D.fotoInicio({datos,regiones,v:1,r:region,niv,ancho:width,alto:height})
   const img=new Image();img.src=png;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height
   const x=canvas.getContext('2d');x.drawImage(img,0,0);const d=x.getImageData(0,0,img.width,img.height).data;let edge=0,solid=0
   for(let y=0;y<img.height;y++)for(let x=0;x<img.width;x++)if(d[(y*img.width+x)*4+3]>8){solid++;if(!x||!y||x===img.width-1||y===img.height-1)edge++}
   return {png,edge,solid,width:img.width,height:img.height,remainingCanvas:document.querySelectorAll('canvas').length}
  },{regiones,region,levels,width,height})
  await writeFile(out+'/'+name+'.png',Buffer.from(snapshot.png.split(',')[1],'base64'));delete snapshot.png;results.push({name,...snapshot})
  assert.ok(snapshot.solid>1000,name+' contains the real model');assert.equal(snapshot.edge,0,name+' has transparent margins on every edge, including the front canton');assert.equal(snapshot.remainingCanvas,0,'Snapshot contexts are removed')
 }
 await writeFile(out+'/resultado.json',JSON.stringify({engine,results},null,2));console.log(JSON.stringify({engine,results},null,2))
}catch(error){console.error(error.stack);process.exitCode=1}finally{await browser?.close();await preview?.close()}
