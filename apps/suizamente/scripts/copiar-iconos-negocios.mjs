import {readFile,writeFile} from 'node:fs/promises'
const source=await readFile('../../../latido/suizamente/disenos/negocios.html','utf8'),unique=[...new Set([...source.matchAll(/<svg\b[^>]*viewBox="0 0 48 48"[^>]*>(.*?)<\/svg>/gs)].map(m=>m[1]))]
const icons={pin:10,negocio:5,web:11,camara:12,mensaje:13,ruta:14,grafico:30,factura:38,tarjeta:34,movil:35,qr:36,etiqueta:4,ojo:39,toque:40,alerta:15,reloj:42,lapiz:27,preg:31}
const dir='public/suizamente-assets/iconos/',path=dir+'iconos.svg';let sprite=await readFile(path,'utf8')
for(const [name,index]of Object.entries(icons)){
 const body=unique[index];if(!body)throw Error('SVG missing '+name)
 // Existing interface icons stay byte-for-byte identical. The business variant is namespaced.
 const id=name==='lapiz'?'neg-lapiz':name
 await writeFile(dir+id+'.svg','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden="true" focusable="false">'+body+'</svg>\n')
 if(!sprite.includes('id="sz-'+id+'"'))sprite=sprite.replace(/<\/svg>\s*$/,'<symbol id="sz-'+id+'" viewBox="0 0 48 48">'+body+'</symbol>\n</svg>\n')
}
await writeFile(path,sprite)
