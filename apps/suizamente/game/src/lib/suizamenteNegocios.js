let pending
export function loadBusinesses(){
 if(window.Negocios3D)return Promise.resolve(window.Negocios3D)
 return pending||(pending=import('three').then(Three=>new Promise((resolve,reject)=>{window.THREE=Three;const script=document.createElement('script');script.src='/suizamente-assets/negocios3d.js';script.onload=()=>resolve(window.Negocios3D);script.onerror=()=>{pending=null;script.remove();reject(Error('No se pudieron cargar las figuras de negocio'))};document.head.append(script)})))
}
export const BUSINESS_TYPES=[['restaurante','Restaurante'],['cafe','Café'],['tienda','Tienda'],['panaderia','Panadería'],['peluqueria','Peluquería'],['escuela','Escuela'],['oficina','Oficina'],['foodtruck','Food truck']]
export const BUSINESS_COLORS=['#24E2C9','#03AA98','#F9A719','#FA2F35','#4A76EF','#24BFE2']
export const businessThumbnail=(type,color)=>'/suizamente-assets/negocios/neg-'+type+'-'+Math.max(0,BUSINESS_COLORS.indexOf(color))+'.webp'
export function businessOpen(hours,now=new Date()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Zurich',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value])),day=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].indexOf(parts.weekday),time=parts.hour+':'+parts.minute,h=hours?.[day],previous=hours?.[(day+6)%7]
 if(previous&&previous.desde>previous.hasta&&time<previous.hasta)return {abierto:true,hasta:previous.hasta}
 return h&&((h.desde<h.hasta&&time>=h.desde&&time<h.hasta)||(h.desde>h.hasta&&time>=h.desde))?{abierto:true,hasta:h.hasta}:{abierto:false}
}
