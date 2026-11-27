import {readFile,writeFile,mkdir,access} from 'node:fs/promises'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {chromium} from '@playwright/test'
const names=['Minuto','MinutoJuego','MinutoFin','Espejo','EspejoJuego','EspejoEspera','EspejoResultado','Misterio','MisterioResuelto','Mapa','MapaCanton','MapaDecorar','Decoraciones','MapaAmigo','MomentoDecoracion','Inicio','InicioEspera','Avisos','Ajustes','Menu'],out='output/mejoras/comparaciones'
await mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true})
try{
 const page=await browser.newPage({viewport:{width:1240,height:1200},reducedMotion:'reduce'})
 for(const name of names){
  const source=name==='MomentoDecoracion'?'casos-webkit':'final',capture=name
  for(const path of ['referencia/'+name+'.png',source+'/'+capture+'-390.png',source+'/'+capture+'-375.png'])await access('output/mejoras/'+path)
  const html='<!doctype html><meta charset="utf-8"><style>body{font:14px system-ui;background:#EEF1F5}main{display:flex;gap:20px;align-items:start}figure{margin:0}img{width:390px}</style><h1>'+name+'</h1><main><figure><figcaption>mejoras.html · #'+name+'</figcaption><img src="../referencia/'+name+'.png"></figure>'+[[390,844],[375,667]].map(([w,h])=>'<figure><figcaption>App '+w+' × '+h+'</figcaption><img style="width:'+w+'px" src="../'+source+'/'+capture+'-'+w+'.png"></figure>').join('')+'</main>'
  await writeFile(out+'/'+name+'.html',html);await page.goto(pathToFileURL(resolve(out+'/'+name+'.html')).href);await page.screenshot({path:out+'/'+name+'.png',fullPage:true})
 }
 const results={};for(const path of ['servidor.json','chromium/resultado.json','webkit/resultado.json','casos-chromium/resultado.json','casos-webkit/resultado.json','apagadas/pixeles.json','huecos/informe.json']){try{results[path]=JSON.parse(await readFile('output/mejoras/'+path,'utf8'))}catch{/* A pending suite has no result yet. */}}
 await writeFile(out+'/resultados.json',JSON.stringify(results,null,2));await writeFile(out+'/index.html','<!doctype html><meta charset="utf-8"><title>Suizamente · mejoras</title><style>body{font:16px system-ui;margin:30px;background:#FBF9F6}li{padding:8px}a{color:#315BC9}</style><h1>Suizamente · app y diseño</h1><p>Comparaciones a 390 × 844 y 375 × 667. Las cuentas y el contenido visible son pruebas locales.</p><ul>'+names.map(n=>'<li><a href="'+n+'.html">'+n+'</a> · <a href="'+n+'.png">PNG</a></li>').join('')+'</ul><p><a href="../apagadas/comparacion.html">Mejoras apagadas: antes y después</a> · <a href="../huecos/informe.json">Huecos y renderizado</a> · <a href="resultados.json">Resultados</a></p>')
 console.log('Saved '+names.length+' comparisons and index: '+out+'/index.html')
}finally{await browser.close()}
