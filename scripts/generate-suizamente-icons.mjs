import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {chromium} from '@playwright/test'
const output='public/suizamente-assets',svg=await readFile(output+'/logo-suizamente.svg','utf8')
await mkdir(output,{recursive:true})
const browser=await chromium.launch()
try{
 const page=await browser.newPage()
 for(const [size,name] of [[180,'icon-180'],[192,'icon-192'],[512,'icon-512'],[512,'icon-maskable-512']]){
  const png=await page.evaluate(async({size,svg,mask})=>{
   const canvas=document.createElement('canvas');canvas.width=canvas.height=size
   const c=canvas.getContext('2d');c.fillStyle='#FFFFFF';c.fillRect(0,0,size,size)
   const image=new Image();image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);await image.decode()
   const max=size*(mask?.6:.8),scale=Math.min(max/image.width,max/image.height),w=image.width*scale,h=image.height*scale
   c.drawImage(image,(size-w)/2,(size-h)/2,w,h);return canvas.toDataURL('image/png').split(',')[1]
  },{size,svg,mask:name.includes('maskable')})
  await writeFile(output+'/'+name+'.png',Buffer.from(png,'base64'))
 }
}finally{await browser.close()}
console.log('Suizamente icons: white background, original logo, 180/192/512 and maskable safe zone.')
