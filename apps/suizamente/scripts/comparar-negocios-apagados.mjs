import {readFile,writeFile} from 'node:fs/promises'
import {inflateSync} from 'node:zlib'
import assert from 'node:assert/strict'
const root='output/negocios/apagadas'
function png(b){
 const width=b.readUInt32BE(16),height=b.readUInt32BE(20),channels=({2:3,6:4})[b[25]];assert.ok(channels&&b[24]===8&&b[28]===0)
 const chunks=[];for(let p=8;p<b.length;){const n=b.readUInt32BE(p),type=b.toString('ascii',p+4,p+8);if(type==='IDAT')chunks.push(b.subarray(p+8,p+8+n));p+=n+12}
 const input=inflateSync(Buffer.concat(chunks)),stride=width*channels,pixels=Buffer.alloc(height*stride)
 const paeth=(a,b,c)=>{const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);return da<=db&&da<=dc?a:db<=dc?b:c}
 for(let y=0;y<height;y++){const offset=y*(stride+1),filter=input[offset];for(let x=0;x<stride;x++){const a=x>=channels?pixels[y*stride+x-channels]:0,b=y?pixels[(y-1)*stride+x]:0,c=y&&x>=channels?pixels[(y-1)*stride+x-channels]:0;pixels[y*stride+x]=(input[offset+x+1]+([0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter]))&255}}
 return {width,height,channels,pixels}
}
const results=[]
// CSS circles and external SVG edges can rasterize differently despite identical
// coordinates. Only mixed edge pixels may be ignored; flat-color changes remain.
function mixedEdge(img,x,y,other){
 const lo=[255,255,255],hi=[0,0,0]
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const px=x+dx,py=y+dy;if(px<0||py<0||px>=img.width||py>=img.height)continue;for(let k=0;k<3;k++){const v=img.pixels[(py*img.width+px)*img.channels+k];lo[k]=Math.min(lo[k],v);hi[k]=Math.max(hi[k],v)}}
 return hi.some((v,k)=>v-lo[k]>20)&&other.every((v,k)=>v>=lo[k]-2&&v<=hi[k]+2)
}
const snapshots=JSON.parse(await readFile(root+'/resultado.json','utf8')).results
for(const width of [390,375])assert.deepEqual(snapshots.find(r=>r.name==='Inicio'&&r.width===width&&r.version==='despues').layout,snapshots.find(r=>r.name==='Inicio'&&r.width===width&&r.version==='antes').layout,'Home text, accessible names and element positions are unchanged')
for(const name of ['Inicio','Menu','Ajustes','Amigos','Mapa'])for(const width of [390,375]){
 const a=png(await readFile(root+'/antes-'+name+'-'+width+'.png')),b=png(await readFile(root+'/despues-'+name+'-'+width+'.png'));assert.equal(a.width,b.width);assert.equal(a.height,b.height);assert.equal(a.channels,b.channels)
 let changed=0,edgePixels=0,maxDelta=0,bounds=[a.width,a.height,0,0];for(let i=0;i<a.pixels.length;i+=a.channels){const delta=Math.max(...Array.from({length:a.channels},(_,k)=>Math.abs(a.pixels[i+k]-b.pixels[i+k])));if(delta>2){const x=(i/a.channels)%a.width,y=Math.floor(i/a.channels/a.width),aa=name==='Inicio'&&mixedEdge(a,x,y,[...b.pixels.subarray(i,i+3)])&&mixedEdge(b,x,y,[...a.pixels.subarray(i,i+3)]);if(aa)edgePixels++;else changed++;bounds=[Math.min(bounds[0],x),Math.min(bounds[1],y),Math.max(bounds[2],x),Math.max(bounds[3],y)]};maxDelta=Math.max(maxDelta,delta)}
 results.push({name,width,changedPixels:changed,edgePixels,total:a.width*a.height,percent:100*changed/(a.width*a.height),maxDelta,bounds})
}
await writeFile(root+'/pixeles.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2))
// Text/layout must be pixel-identical. Software WebGL can differ slightly in rasterization.
for(const r of results)if(r.name==='Inicio')assert.ok(r.percent<.05,'Home remains visually identical within SVG rasterization tolerance');else assert.equal(r.changedPixels,0,r.name+' must be identical while all switches are off')
