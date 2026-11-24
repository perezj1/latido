/* global DOMParser, XMLSerializer */
let assets
export function loadMapAssets(){return assets||(assets=Promise.all([import('./world3d'),fetch('/suizamente-assets/mapa3d.json').then(r=>{if(!r.ok)throw Error('Mapa no disponible');return r.json()})]).catch(e=>{assets=null;throw e}))}
export async function flatMapPhoto(state,config,selected){
  const response=await fetch('/suizamente-assets/mapa-cantones.svg');if(!response.ok)throw Error('No se pudo crear la imagen del mapa')
  const doc=new DOMParser().parseFromString(await response.text(),'image/svg+xml'),svg=doc.documentElement
  const colors=config.vueltasMapa.vueltas[Math.min(state.vuelta-1,config.vueltasMapa.vueltas.length-1)]?.colores||config.mapa.coloresNivel
  for(const path of [...svg.querySelectorAll('path')]){
    const id=path.id,index=config.mapa.regiones.findIndex(r=>r.cantones.some(k=>k.id===id))
    if(selected&&id!==selected||index<0){path.remove();continue}
    path.setAttribute('fill',colors[index<state.region?config.mapa.nivelesPorCanton:state.niveles[id]||0]);path.setAttribute('stroke','#3D4757');path.setAttribute('stroke-width','1')
  }
  svg.removeAttribute('style');svg.setAttribute('xmlns','http://www.w3.org/2000/svg');svg.setAttribute('width','1200');svg.setAttribute('height','960')
  const host=document.createElement('div');host.style.cssText='position:fixed;left:-3000px;top:0;width:400px;height:320px';host.append(svg);document.body.append(host)
  try{const b=svg.getBBox();svg.setAttribute('viewBox',`${b.x-5} ${b.y-5} ${b.width+10} ${b.height+10}`);return {foto:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg)),ajuste:'contener'}}finally{host.remove()}
}
export async function scenePhoto(state,config,{selected,whole=false}={}){
  try{
    const [{Mapa3D},datos]=await loadMapAssets(),regiones=config.mapa.regiones.map(r=>({c:r.cantones.map(k=>k.id)}))
    if(whole)return {foto:Mapa3D.fotoEntera({datos,regiones,v:state.vuelta}),ajuste:'cubrir'}
    const host=document.createElement('div');host.style.cssText='position:fixed;left:-600px;top:0;width:400px;height:400px';document.body.append(host)
    let world
    try{world=Mapa3D.crear({datos,regiones,foto:true,reduced:()=>true});world.montar(host);world.estado({v:state.vuelta,r:state.region,niv:state.niveles});world.enfocar(selected||null);world.saltar();return {foto:world.foto('image/jpeg',.9,3),ajuste:'cubrir'}}finally{world?.destruir();host.remove()}
  }catch{return flatMapPhoto(state,config,selected)}
}
