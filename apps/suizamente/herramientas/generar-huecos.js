import {Mapa3D} from '../game/src/components/suizamente/v2/world3d.js'
import {loadDecorations} from '../game/src/lib/suizamenteDecoraciones.js'
const script=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.append(s)})
const [datos,config]=await Promise.all([fetch('/suizamente-assets/mapa3d.json').then(r=>r.json()),fetch('/api/suizamente/config').then(r=>r.json())])
const engine=await loadDecorations();await script('/suizamente-assets/negocios3d.js');await script('/suizamente-assets/huecos3d.js')
const ids=Object.keys(datos.cantones),world=Mapa3D.crear({datos,decoraciones:engine,negocios:window.Negocios3D,regiones:config.mapa.regiones.map(r=>({c:r.cantones.map(k=>k.id)})),reduced:()=>true,interactive:()=>false,foto:true}),host=document.querySelector('#map'),select=document.querySelector('#canton')
world.montar(host);world.estado({v:1,r:config.mapa.regiones.length,niv:Object.fromEntries(ids.map(k=>[k,3]))});world.saltar()
const resultado={},informe=[],names=Object.fromEntries(config.mapa.regiones.flatMap(r=>r.cantones.map(k=>[k.id,k.nombre])))
// Only the geometric input can be tuned. The supplied allocator is never modified.
export const AJUSTES_ENTRADA={}
for(const k of ids){
 world.enfocar(k);world.saltar();const entrada=world.consultarHuecos(k),n=config.negocios.plazasPorCanton[k]??config.negocios.plazasPorCanton.porDefecto
 let r,factor=1,radio=1
 // Latido authorized smaller per-canton input margins (27 Nov 2026). Geometry,
 // camera and the original allocator remain intact; output uses the original u.
 search:for(const f of [1,.9,.8,.7,.6,.5,.4,.35])for(const rr of [1,1.15,1.3,1.5,1.8,2.1,2.4]){
  const m=.03*entrada.u,tapado=(x,z)=>[[0,0],[m,0],[-m,0],[0,m],[0,-m]].some(([dx,dz])=>entrada.tapado(x+dx,z+dz))
  const candidate=window.Huecos3D.repartir({...entrada,u:entrada.u*f,radioPueblo:entrada.radioPueblo*rr,tapado},{plazas:n,tierra:6,agua:entrada.tieneAgua?1:0,aire:1})
  if(candidate.plazas.length===n&&candidate.tierra.length===6&&candidate.aire.length===1&&candidate.agua.length===(entrada.tieneAgua?1:0)){r=candidate;factor=f;radio=rr;break search}
 }
 if(!r)throw Error('No caben todos los huecos sin tapar la maqueta: '+k)
 AJUSTES_ENTRADA[k]={factor,radio}
 resultado[k]=[['plazas','plaza','p'],['tierra','tierra','t'],['agua','agua','a'],['aire','aire','v']].flatMap(([group,tipo,suffix])=>r[group].map(([dx,dz],i)=>({id:k+'-'+suffix+(i+1),tipo,dx:+(dx*factor).toFixed(4),dz:+(dz*factor).toFixed(4)})))
 informe.push({canton:k,plazas:r.plazas.length,previstas:n,tierra:r.tierra.length,agua:r.agua.length,aire:r.aire.length,candidatos:r.candidatos,factor,radio})
 select.add(new Option(names[k]||k,k));await new Promise(resolve=>setTimeout(resolve,0))
}
let business=[]
function limpiar(){for(const g of business){g.parent.remove(g);g.traverse(o=>o.geometry?.dispose())}business=[]}
function mostrar(k){
 limpiar();world.enfocar(k);world.saltar();world.decorar([]);const entry=world.consultarHuecos(k),slots=resultado[k],nature=world.ocuparHuecos(slots.map(h=>({...h,canton:k})),'revision')
 const types=engine.TIPOS.filter(t=>t.hueco==='tierra');let land=0
 // The preview deliberately fills every slot; real users own one of each decoration.
 const factor=AJUSTES_ENTRADA[k].factor
 const previews=slots.filter(h=>h.tipo!=='plaza').map(h=>({...h,canton:k,k:h.tipo==='aire'?'globo':h.tipo==='agua'?'barco':types[land++%types.length].k,dy:h.tipo==='aire'?3.4:0,escala:.23*factor,ancla:'pueblo',cacheId:h.id}))
 world.decorar(previews)
 for(const [i,h]of slots.filter(h=>h.tipo==='plaza').entries()){
  const g=window.Negocios3D.modelo(window.Negocios3D.TIPOS[i%8].k,window.Negocios3D.COLORES[i%6]);g.scale.setScalar(.32*factor*entry.u);g.position.set(entry.centro[0]+h.dx*entry.u,3.02,entry.centro[1]+h.dz*entry.u);world.anadirFiguraHueco(g);business.push(g)
 }
 document.querySelector('#informe').textContent=JSON.stringify({canton:k,...informe.find(r=>r.canton===k),naturaleza:nature,huecos:slots},null,2);select.value=k;return world.foto('image/png',1,1)
}
select.onchange=()=>mostrar(select.value)
document.querySelector('#descargar').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(resultado,null,2)+'\n'],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='huecos.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
document.querySelector('#revisar').onclick=async()=>{const gallery=document.querySelector('#galeria');gallery.replaceChildren();for(const k of ids){const fig=document.createElement('figure'),img=new Image(),caption=document.createElement('figcaption');img.src=mostrar(k);img.alt=names[k]+' en nivel 3, con todas sus plazas y decoraciones';caption.textContent=names[k];fig.append(img,caption);gallery.append(fig);await new Promise(r=>setTimeout(r,0))}}
mostrar('ZH');document.querySelector('#estado').textContent='Revisión de los 26 cantones · nivel 3 · todos los huecos ocupados';document.querySelector('#descargar').disabled=false;document.querySelector('#revisar').disabled=false
window.huecosQA={world,resultado,informe,mostrar,ids,ajustes:AJUSTES_ENTRADA}
