import {createServer} from 'vite'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import assert from 'node:assert/strict'
const config=JSON.parse(await readFile('server/suizamente/data/juego.json','utf8')),out='output/negocios/huecos'
await mkdir(out,{recursive:true})
const server=await createServer({configFile:false,css:{postcss:{plugins:[]}},cacheDir:'output/vite-huecos',plugins:[{name:'huecos-config',configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url!=='/api/suizamente/config')return next();res.setHeader('Content-Type','application/json');res.end(JSON.stringify(config))})}}],server:{host:'127.0.0.1',port:5681,strictPort:true}})
await server.listen();let browser
try{
 browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1000,height:1020}})
 page.on('pageerror',e=>console.error(e.message));await page.goto('http://127.0.0.1:5681/herramientas/generar-huecos.html');await page.waitForFunction(()=>!!window.huecosQA,{},{timeout:180000})
 const {resultado,informe,ajustes}=await page.evaluate(()=>({resultado:window.huecosQA.resultado,informe:window.huecosQA.informe,ajustes:window.huecosQA.ajustes}))
 console.log(JSON.stringify(informe))
 await writeFile(out+'/informe.json',JSON.stringify(informe,null,2)+'\n')
 if(process.argv.includes('--escribir')){await writeFile('server/suizamente/data/huecos.json',JSON.stringify(resultado,null,2)+'\n');await writeFile('server/suizamente/data/huecos-ajustes.json',JSON.stringify(ajustes,null,2)+'\n')}
 else assert.deepEqual(resultado,JSON.parse(await readFile('server/suizamente/data/huecos.json','utf8')),'Stored slot ids and coordinates match the reviewed allocator input')
 for(const k of Object.keys(resultado)){await page.evaluate(k=>window.huecosQA.mostrar(k),k);await page.locator('#map').screenshot({path:out+'/'+k+'.png'})}
 const quality=await page.evaluate(()=>{
  const {world:w,resultado:slots,ajustes,ids}=window.huecosQA,reports=[]
  w.decorar([]);w.ocuparHuecos([],'revision')
  for(const k of ids){
   w.enfocar(k);w.saltar();const e=w.consultarHuecos(k),before=e.naturaleza,errors=[]
   for(const h of slots[k])if(h.tipo!=='aire'){
    const x=e.centro[0]+h.dx*e.u,z=e.centro[1]+h.dz*e.u
    if(!(h.tipo==='agua'?e.enAgua(x,z):e.enTierra(x,z)))errors.push(h.id+' outside its surface')
    if(h.tipo!=='agua'&&e.tapado(x,z))errors.push(h.id+' behind an obstacle')
   }
   w.ocuparHuecos(slots[k].map(h=>({...h,canton:k})),'revision');const during=w.consultarHuecos(k).naturaleza
   for(const tree of during){const near=slots[k].some(h=>!['aire','agua'].includes(h.tipo)&&Math.hypot(tree.x-e.centro[0]-h.dx*e.u,tree.z-e.centro[1]-h.dz*e.u)<.95*e.u);if(tree.visible===near)errors.push('Nature visibility '+tree.id)}
   w.ocuparHuecos([],'revision');const restored=JSON.stringify(before)===JSON.stringify(w.consultarHuecos(k).naturaleza)
   reports.push({canton:k,errors,restored,hidden:during.filter(t=>!t.visible).length})
  }
  w.enfocar('ZH');w.saltar();const sample=()=>{const a=[];for(let i=0;i<6;i++){const t=performance.now();w.foto('image/jpeg',.8);a.push(performance.now()-t)}return a.slice(1).sort((a,b)=>a-b)[2]},base=sample(),list=Object.entries(slots).flatMap(([canton,hs])=>hs.filter(h=>h.tipo==='plaza').map((h,i)=>({...h,canton,id:h.id,nombre:'Figura de prueba',tipo:window.Negocios3D.TIPOS[i%8].k,color:window.Negocios3D.COLORES[i%6],escala:.32*ajustes[canton].factor})))
  w.negocios(list);const full=sample(),geometry=[];for(const g of w._negocios.values())g.traverse(o=>{if(o.isMesh)geometry.push([o.uuid,o.geometry.uuid,o.material.uuid])})
  w.negocios(list);const again=[];for(const g of w._negocios.values())g.traverse(o=>{if(o.isMesh)again.push([o.uuid,o.geometry.uuid,o.material.uuid])})
  return {reports,performance:{focusedBaseMs:base,focusedBusinessesMs:full,figures:list.length,meshes:geometry.length,reused:JSON.stringify(geometry)===JSON.stringify(again)}}
 })
 for(const r of quality.reports){assert.deepEqual(r.errors,[],r.canton);assert.ok(r.restored,r.canton+' restores every tree and stone')}
 assert.ok(quality.performance.reused);assert.ok(quality.performance.focusedBusinessesMs<quality.performance.focusedBaseMs*2+30,'Business figures keep the focused model inside the local rendering budget')
 await writeFile(out+'/calidad.json',JSON.stringify(quality,null,2)+'\n');console.log(JSON.stringify(quality.performance))
}finally{await browser?.close();await server.close()}
