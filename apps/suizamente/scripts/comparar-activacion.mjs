import {mkdir,access,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {chromium} from '@playwright/test'
const out='output/activacion',screens=[]
for(const name of ['Inicio','InicioEspera','Menu','Ajustes','Avisos','Minuto','MinutoJuego','MinutoFin','Espejo','EspejoJuego','EspejoEspera','EspejoResultado','Misterio','MisterioResuelto','Mapa','MapaCanton','MapaDecorar','Decoraciones','MapaAmigo','MomentoDecoracion'])screens.push({name,source:'mejoras',reference:'../mejoras/referencia/'+name+'.png'})
for(const name of ['MapaZH','MapaZHLleno','FichaNegocio','Negocios','PreguntaNegocio','RespuestaNegocio','MenuNegocios','NegocioInfo','NegocioDatos','NegocioPlaza','NegocioFigura','NegocioOferta','NegocioPlan','NegocioPago','NegocioEnviado','NegocioPanel','NegocioResumen','NegocioPregunta','NegocioCuenta','NegocioBaja','NegocioCambios','AdminNegocios','AdminNegocio'])screens.push({name,source:'negocios/chromium',reference:'../negocios/referencia/'+name+'.png'})
for(const [name,ref] of [['Inicio-sin-contenido','Inicio'],['Menu-modos','Menu'],['Ajustes-avisos','Ajustes']])screens.push({name,source:'extra',reference:'../mejoras/referencia/'+ref+'.png'})
screens.push({name:'Inicio-abajo',source:'mejoras',reference:'../mejoras/referencia/Inicio.png'})
await mkdir(out+'/comparaciones',{recursive:true});const browser=await chromium.launch({headless:true})
try{
 const page=await browser.newPage({viewport:{width:1240,height:1100}})
 for(const {name,source,reference}of screens){
  for(const path of [reference,...[390,375].map(w=>source+'/'+name+'-'+w+'.png')])await access(out+'/'+path)
  const html='<!doctype html><meta charset="utf-8"><title>'+name+' · diseño y app</title><style>body{font:14px system-ui;background:#EEF1F5;color:#0F1A2B}main{display:flex;gap:18px;align-items:start}figure{margin:0}img{max-width:390px}</style><h1>'+name+'</h1><p>Mejoras y negocios activos juntos · cobro automático apagado · ejemplos solo locales</p><main><figure><figcaption>Diseño original</figcaption><img src="../'+reference+'"></figure>'+[390,375].map(w=>'<figure><figcaption>App · '+w+' × '+(w===390?844:667)+'</figcaption><img src="../'+source+'/'+name+'-'+w+'.png"></figure>').join('')+'</main>'
  await writeFile(out+'/comparaciones/'+name+'.html',html);await page.goto(pathToFileURL(resolve(out+'/comparaciones/'+name+'.html')).href);await page.screenshot({path:out+'/comparaciones/'+name+'.png',fullPage:true})
 }
 await writeFile(out+'/index.html','<!doctype html><meta charset="utf-8"><title>Suizamente · activación</title><style>body{font:16px system-ui;max-width:900px;margin:30px;background:#FBF9F6}li{padding:7px}a{color:#315BC9}</style><h1>Activación · comparación con el diseño</h1><p>390 × 844 y 375 × 667. Misterio y Café Cumbia son fixtures en PostgreSQL temporal; nunca contenido de producción.</p><ul>'+screens.map(s=>'<li><a href="comparaciones/'+s.name+'.html">'+s.name+'</a> · <a href="comparaciones/'+s.name+'.png">PNG</a></li>').join('')+'</ul><p><a href="../pagos/comparacion.html">Pago automático: pruebas locales, interruptor apagado</a> · <a href="../negocios/apagadas/comparacion.html">Todo apagado</a></p>')
 console.log('Saved '+screens.length+' side-by-side comparisons: '+resolve(out+'/index.html'))
}finally{await browser.close()}
