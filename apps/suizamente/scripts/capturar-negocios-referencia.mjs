import {createServer} from 'node:http'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {resolve,extname,sep} from 'node:path'
import {chromium} from '@playwright/test'
const root=resolve('../../../latido/suizamente'),out='output/negocios/referencia';await mkdir(out,{recursive:true})
const server=createServer(async(req,res)=>{try{const file=resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+sep))throw Error('path');res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.webp':'image/webp'})[extname(file)]||'application/octet-stream');res.end(await readFile(file))}catch{res.statusCode=404;res.end()}})
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1200},reducedMotion:'reduce'}),base='http://127.0.0.1:'+server.address().port
 await page.goto(base+'/disenos/negocios.html');await page.evaluate(()=>document.fonts.ready);await page.addStyleTag({content:'.visor{display:none!important}'})
 const texts=[];for(const item of await page.locator('figure.pantalla').all()){const id=(await item.getAttribute('id')).slice(2);texts.push(id+'\n'+await item.innerText());await item.locator('.marco').screenshot({path:out+'/'+id+'.png'})}
 await writeFile(out+'/textos.txt',texts.join('\n\n'));console.log('Captured '+texts.length+' business reference screens')
}finally{await browser?.close();await new Promise(r=>server.close(r))}
