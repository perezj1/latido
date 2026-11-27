// Import the approved proposal literally; never regenerate the existing catalogue.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises'
import {resolve} from 'node:path'
const reference=resolve(process.env.SUIZAMENTE_DESIGN_ROOT||'../../../latido/suizamente')
const spec=await readFile(resolve(reference,'MEJORAS.md'),'utf8')
const block=JSON.parse('{'+spec.match(/```json\s*([\s\S]*?)```/)[1]+'}').mejoras
const file='server/suizamente/data/juego.json',original=await readFile(file,'utf8')
if(!JSON.parse(original).mejoras)await writeFile(file,original.trimEnd().replace(/\}$/,',\n  "mejoras": '+JSON.stringify(block,null,2).replaceAll('\n','\n  ')+'\n}\n'))
const html=await readFile(resolve(reference,'disenos/mejoras.html'),'utf8'),unique=[...new Set([...html.matchAll(/<svg\b[^>]*viewBox="0 0 48 48"[^>]*>([\s\S]*?)<\/svg>/g)].map(m=>m[1]))]
const shapes={crono:'<rect x="20" y="4"',espejo:'<rect x="4" y="9"',misterio:'<circle cx="20" cy="20" r="13"',pincel:'<path d="M37 5 L43',corazon:'<path d="M24 41 C10',mas:'<circle cx="24" cy="24" r="18" fill="#4A76EF"></circle><path d="M24 15',check:'<circle cx="24" cy="24" r="18" fill="#03AA98">',campana:'<circle cx="24" cy="5.5"'}
const dir='public/suizamente-assets/iconos',spriteFile=dir+'/iconos.svg'
let sprite=await readFile(spriteFile,'utf8')
function appendSymbol(text,symbol,name){
 // The usage comment itself contains </svg>; append to the actual root element.
 const pattern=new RegExp('<symbol id="sz-'+name+'"[\\s\\S]*?<\\/symbol>','g')
 text=text.replace(/<!--[\s\S]*?-->/g,comment=>comment.replace(pattern,''))
 if(!text.replace(/<!--[\s\S]*?-->/g,'').includes('id="sz-'+name+'"'))text=text.replace(/<\/svg>\s*$/,symbol+'\n</svg>\n')
 return text
}
for(const [name,start] of Object.entries(shapes)){
 const body=unique.find(s=>s.startsWith(start));if(!body)throw Error('Missing reference SVG: '+name)
 await writeFile(dir+'/'+name+'.svg','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">'+body+'</svg>\n')
 sprite=appendSymbol(sprite,'<symbol id="sz-'+name+'" viewBox="0 0 48 48">'+body+'</symbol>',name)
}
// Original supplied by Latido in the task conversation (absent from mejoras.html).
const lock='<rect x="10" y="21" width="28" height="21" rx="5" fill="#9AA6B8"/><path d="M16 21 V15 C16 10.5 19.5 7 24 7 C28.5 7 32 10.5 32 15 V21" fill="none" stroke="#9AA6B8" stroke-width="4.5"/><circle cx="24" cy="31" r="3" fill="#FFFFFF"/>'
await writeFile(dir+'/candado.svg','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden="true" focusable="false">'+lock+'</svg>\n')
sprite=appendSymbol(sprite,'<symbol id="sz-candado" viewBox="0 0 48 48">'+lock+'</symbol>','candado')
await writeFile(spriteFile,sprite)
// Extend the reference package too. Existing glyphs remain byte-for-byte intact.
const referenceSpriteFile=resolve(reference,'disenos/iconos/iconos.svg')
let referenceSprite=await readFile(referenceSpriteFile,'utf8')
for(const name of [...Object.keys(shapes),'candado']){
 const symbol=sprite.match(new RegExp('<symbol id="sz-'+name+'"[\\s\\S]*?<\\/symbol>'))[0]
 referenceSprite=appendSymbol(referenceSprite,symbol,name)
 await copyFile(dir+'/'+name+'.svg',resolve(reference,'disenos/iconos',name+'.svg'))
}
await writeFile(referenceSpriteFile,referenceSprite)
await mkdir('public/suizamente-assets/decoraciones',{recursive:true})
for(const name of ['tren','vacas','globo','teleferico','barco','torre','vacaOro','abeto'])await copyFile(resolve(reference,'disenos/decoraciones','deco-'+name+'.webp'),'public/suizamente-assets/decoraciones/deco-'+name+'.webp')
await copyFile(resolve(reference,'disenos/decoraciones3d.js'),'public/suizamente-assets/decoraciones3d.js')
console.log('Added disabled configuration, nine supplied icons and unchanged decoration models/thumbnails.')
