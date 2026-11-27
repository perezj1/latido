// Author new data from the unchanged live maqueta, then render every region for QA.
import {createServer} from 'vite'
import react from '@vitejs/plugin-react'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import assert from 'node:assert/strict'
import {resolve} from 'node:path'
const dataFile='server/suizamente/data/decoraciones.json',catalog=JSON.parse(await readFile(dataFile,'utf8')),config=JSON.parse(await readFile('server/suizamente/data/juego.json','utf8')),geometry=JSON.parse(await readFile('public/suizamente-assets/mapa3d.json','utf8')),out='output/mejoras/huecos'
await mkdir(out,{recursive:true})
const server=await createServer({configFile:false,cacheDir:'output/vite-decoraciones',plugins:[react()],server:{host:'127.0.0.1',port:5670,strictPort:true}});await server.listen();let browser
try{
 browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1000,height:850},reducedMotion:'reduce'})
 await page.route('**/__decor_layout',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0;background:#FBF9F6;font:16px system-ui}h1{padding:10px}#map{width:1000px;height:760px}</style><h1>Decoraciones · revisión de huecos</h1><div id="map"></div>'}));await page.goto('http://127.0.0.1:5670/__decor_layout')
 await page.evaluate(()=>{Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>4});Object.defineProperty(navigator,'deviceMemory',{get:()=>4})})
 const measurements=await page.evaluate(async config=>{
  const [{Mapa3D},{loadDecorations},datos]=await Promise.all([import('/game/src/components/suizamente/v2/world3d.js'),import('/game/src/lib/suizamenteDecoraciones.js'),fetch('/suizamente-assets/mapa3d.json').then(r=>r.json())]),engine=await loadDecorations()
  const world=Mapa3D.crear({datos,decoraciones:engine,regiones:config.mapa.regiones.map(r=>({c:r.cantones.map(k=>k.id)})),reduced:()=>true,interactive:()=>false});world.montar(document.querySelector('#map'));world.estado({v:1,r:config.mapa.regiones.length,niv:{}});world.saltar();window.qaWorld=world
  const sizes=Object.fromEntries(engine.TIPOS.map(t=>{const model=engine.modelo(t.k),b=new window.THREE.Box3().setFromObject(model);return [t.k,{x:b.max.x-b.min.x,z:b.max.z-b.min.z}]}))
  return {layout:world.decorar([]),sizes}
 },config)
 const insideRing=(x,y,ring)=>{let ok=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])ok=!ok}return ok}
 const inside=(x,y,multi)=>multi.some(r=>insideRing(x,y,r[0])&&!r.slice(1).some(h=>insideRing(x,y,h)))
 const segmentDistance=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)}
 const border=(x,y,multi)=>Math.min(...multi.flatMap(p=>p.flatMap(r=>r.map((a,i)=>segmentDistance(x,y,a,r[(i+1)%r.length])))))
 const rectangleDistance=(x,y,b)=>Math.hypot(Math.max(b[0]-x,0,x-b[2]),Math.max(b[1]-y,0,y-b[3]))
 const slots=[],reports=[]
 for(const c of measurements.layout){
  const shape=geometry.cantones[c.canton],landTypes=catalog.tipos.filter(t=>t.hueco==='tierra'),radius=Math.max(...landTypes.map(t=>Math.hypot(measurements.sizes[t.id].x,measurements.sizes[t.id].z)/2))
  const [x0,y0,x1,y1]=c.borde,candidates=[]
  for(let ix=0;ix<=90;ix++)for(let iy=0;iy<=90;iy++){const x=x0+(x1-x0)*ix/90,y=y0+(y1-y0)*iy/90;if(!inside(x,y,shape.tierra))continue;const space=Math.min(border(x,y,shape.tierra),...c.obstaculos.map(b=>rectangleDistance(x,y,b)),...c.ocupado.map(o=>Math.max(0,Math.hypot(x-o[0],y-o[1])-o[2])));candidates.push({x,y,space})}
  candidates.sort((a,b)=>b.space-a.space||a.x-b.x||a.y-b.y)
  const picked=[]
  for(let n=0;n<3;n++){
   const p=candidates.find(p=>picked.every(q=>Math.hypot(p.x-q.x,p.y-q.y)>q.r+Math.min(p.space*.75,c.u*radius*.7)+c.u*.03));if(!p||p.space<c.u*.18)break
   const scale=Math.min(.7,p.space*.75/(radius*c.u)),r=radius*scale*c.u
   picked.push({...p,r});slots.push({id:c.canton+'-tierra-'+(n+1),canton:c.canton,tipo:'tierra',dx:+((p.x-c.centro[0])/c.u).toFixed(4),dy:0,dz:+((p.y-c.centro[1])/c.u).toFixed(4),escala:+scale.toFixed(4),giro:n*.4})
  }
  if(!picked.length)throw Error('No safe land slot in '+c.canton)
  slots.push({id:c.canton+'-aire',canton:c.canton,tipo:'aire',dx:0,dy:7,dz:0,escala:.65,giro:0})
  if(shape.agua.length){let best;for(let ix=0;ix<=90;ix++)for(let iy=0;iy<=90;iy++){const x=x0+(x1-x0)*ix/90,y=y0+(y1-y0)*iy/90;if(!inside(x,y,shape.agua))continue;const gap=border(x,y,shape.agua);if(!best||gap>best.gap)best={x,y,gap}}
   if(best&&c.agua){const size=measurements.sizes.barco,scale=Math.min(.6,best.gap*.8/(Math.hypot(size.x,size.z)/2*c.u));slots.push({id:c.canton+'-agua',canton:c.canton,tipo:'agua',dx:+((best.x-c.agua[0])/c.u).toFixed(4),dy:0,dz:+((best.y-c.agua[1])/c.u).toFixed(4),escala:+scale.toFixed(4),giro:.6})}
  }
  reports.push({canton:c.canton,tierra:picked.length,aire:1,agua:slots.some(h=>h.canton===c.canton&&h.tipo==='agua'),minScale:Math.min(...slots.filter(h=>h.canton===c.canton).map(h=>h.escala))})
 }
 if(process.argv.includes('--escribir')){catalog.huecos=slots;await writeFile(dataFile,JSON.stringify(catalog,null,2)+'\n')}
 else if(JSON.stringify(catalog.huecos)!==JSON.stringify(slots))throw Error('Los huecos no coinciden con la maqueta comprobada; revisar y usar --escribir')
 for(const [i,r]of config.mapa.regiones.entries()){
  // Eight owned objects is the actual maximum, never one instance per empty slot.
  const used=new Set(),placed=[]
  for(const t of catalog.tipos){const h=slots.find(h=>r.cantones.some(c=>c.id===h.canton)&&h.tipo===t.hueco&&!used.has(h.id));if(h){used.add(h.id);placed.push({...h,k:t.id,vuelta:1})}}
  await page.evaluate(({placed,ids,name})=>{document.querySelector('h1').textContent=name+' · modelos completos y huecos sin tapar casas, monumentos ni caminos';window.qaWorld.decorar(placed);window.qaWorld.verRegion(ids);window.qaWorld.saltar()}, {placed,ids:r.cantones.map(c=>c.id),name:r.nombre})
  await page.screenshot({path:out+'/region-'+(i+1)+'.png'})
 }
 const performanceReport=await page.evaluate(({catalog,config})=>{
  const w=window.qaWorld,used=new Set(),all=[]
  for(const t of catalog.tipos){const h=catalog.huecos.find(h=>h.tipo===t.hueco&&!used.has(h.id));if(h){used.add(h.id);all.push({...h,k:t.id,vuelta:1})}}
  w.estado({v:1,r:config.mapa.regiones.length,niv:{}});w.enfocar(null);w.saltar()
  const sample=()=>{const values=[];for(let n=0;n<6;n++){const start=performance.now();w.foto('image/jpeg',.7);values.push(performance.now()-start)}return values.slice(1).sort((a,b)=>a-b)[2]}
  w.decorar([]);const emptyMs=sample();w.decorar(all);const fullMs=sample(),objects=[...w._decoraciones.values()],before=[]
  for(const g of objects)g.traverse(o=>{if(o.isMesh)before.push([o.uuid,o.geometry.uuid,o.material.uuid])})
  w.decorar(all.map(h=>({...h,giro:.3})));const after=[],shadows=[]
  for(const g of w._decoraciones.values())g.traverse(o=>{if(o.isMesh){after.push([o.uuid,o.geometry.uuid,o.material.uuid]);shadows.push(o.castShadow||o.receiveShadow)}})
  w.decorar([])
  return {emptyMs,fullMs,models:objects.length,meshCount:before.length,reused:JSON.stringify(before)===JSON.stringify(after),slowDeviceShadows:shadows.some(Boolean),removed:[...w._decoraciones.values()].every(o=>!o.visible)}
 },{catalog,config})
 assert.equal(performanceReport.models,8);assert.ok(performanceReport.reused,'Move reuses all meshes, geometries and materials');assert.equal(performanceReport.slowDeviceShadows,false);assert.ok(performanceReport.removed)
 assert.ok(performanceReport.fullMs<performanceReport.emptyMs*2+20,'All eight decorations remain within the local rendering budget')
 const reference=resolve(process.env.SUIZAMENTE_DESIGN_ROOT||'../../../latido/suizamente')
 assert.deepEqual(await readFile('public/suizamente-assets/decoraciones3d.js'),await readFile(resolve(reference,'disenos/decoraciones3d.js')))
 for(const t of catalog.tipos)assert.deepEqual(await readFile('public/suizamente-assets/decoraciones/deco-'+t.id+'.webp'),await readFile(resolve(reference,'disenos/decoraciones/deco-'+t.id+'.webp')))
 await writeFile(out+'/informe.json',JSON.stringify({reports,measurements,slots,performance:performanceReport},null,2));console.log(JSON.stringify({cantones:reports.length,huecos:slots.length,reports,performance:performanceReport},null,2))
 await page.evaluate(()=>window.qaWorld.destruir())
}finally{await browser?.close();await server.close()}
