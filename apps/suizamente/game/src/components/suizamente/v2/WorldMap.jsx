import {forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react'
import {useSv} from './Context'
import {MapDrawing} from './Map'

import {loadMapAssets,flatMapPhoto} from './mapPhotos'
function visibleSlots(points,width,height){
 const placed=[],gap=46,edge=23
 for(const p of points.filter(p=>p.visible&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1)){
  const ax=p.x*width,ay=p.y*height
  let best
  for(let radius=0;radius<=Math.max(width,height)&&!best;radius+=8){
   const steps=radius?Math.ceil(2*Math.PI*radius/8):1
   for(let n=0;n<steps;n++){
    const angle=n/steps*2*Math.PI,x=Math.max(edge,Math.min(width-edge,ax+Math.cos(angle)*radius)),y=Math.max(edge,Math.min(height-edge,ay+Math.sin(angle)*radius))
    if(placed.every(q=>Math.hypot(x-q.x*width,y-q.y*height)>=gap)){best={...p,ax:p.x,ay:p.y,x:x/width,y:y/height};break}
   }
  }
  if(best)placed.push(best)
 }
 return placed
}
export const WorldMap=forwardRef(function WorldMap({state,selected,onSelect=()=>{},animated,onMetadata,onAnimationDone,preview=false,demo=false,mini=false,home=false,decorations,slots,onSlot,onDecoration,regionView=false},ref){
 const {reduced:preference,config}=useSv(),reduced=preference||mini||home||(preview&&!demo),box=useRef(null),world=useRef(null),visible=useRef(true),latest=useRef({state,selected,onSelect,reduced})
 const interactive=!preview&&!mini&&!home
 const [ready,setReady]=useState(false),[slotPositions,setSlotPositions]=useState([])
 const [failed,setFailed]=useState(false),[inView,setInView]=useState(!mini&&!preview)
 const lastAnimation=useRef(null)
 latest.current={state,selected,onSelect,reduced,animated,interactive,decorations,onDecoration}
 useImperativeHandle(ref,()=>({async capture(){if(world.current){world.current.saltar();return {foto:world.current.foto('image/jpeg',.9,3),ajuste:'cubrir'}}return flatMapPhoto(latest.current.state,config,latest.current.selected)}}),[config])
 function animationFor(mark,lessMotion){if(mark===lastAnimation.current)return;lastAnimation.current=mark;return lessMotion?undefined:mark?.canton}
 useEffect(()=>{
  const observer=new IntersectionObserver(entries=>{visible.current=entries[0].isIntersecting;if(visible.current)world.current?.reanudar();if(mini||preview)setInView(entries[0].isIntersecting)})
  observer.observe(box.current)
  return()=>observer.disconnect()
 },[])
 useEffect(()=>{
  if(!inView)return
  let alive=true,instance;setReady(false)
  const fail=()=>{const old=instance;instance=null;world.current=null;try{old?.destruir()}finally{old?.elemento.remove();if(alive)setFailed(true)}}
  Promise.all([loadMapAssets(),decorations?import('../../../lib/suizamenteDecoraciones').then(m=>m.loadDecorations()):null]).then(([[{Mapa3D},geometry],decorEngine])=>{
   if(!alive)return
   const datos=mini||preview?{...geometry,cantones:{[selected]:geometry.cantones[selected]}}:geometry
   instance=Mapa3D.crear({datos,decoraciones:decorEngine,alDecoracion:onDecoration?k=>latest.current.onDecoration?.(k):null,alFallo:fail,foto:preview,mini,mode:mini?'mini':home?'home':preview?'preview':'map',regiones:config.mapa.regiones.map(r=>({c:r.cantones.map(k=>k.id)})),alSeleccionar:k=>latest.current.onSelect(k),reduced:()=>latest.current.reduced,interactive:()=>latest.current.interactive,visible:()=>visible.current,dark:()=>document.documentElement.dataset.suizamenteTheme==='oscura'})
   instance.montar(box.current);instance.interaccion(latest.current.interactive);instance.estado({v:latest.current.state.vuelta,r:latest.current.state.region,niv:latest.current.state.niveles},animationFor(latest.current.animated,latest.current.reduced));instance.enfocar(latest.current.selected)
   if(latest.current.decorations)instance.decorar(latest.current.decorations)
   if(latest.current.reduced||mini||preview)instance.saltar()
   instance.elemento.querySelector('canvas')?.setAttribute('aria-hidden','true');world.current=instance;onMetadata?.(Mapa3D.C3)
   requestAnimationFrame(()=>{if(alive)setReady(true)})
  }).catch(fail)
  const themeObserver=new MutationObserver(()=>{if(instance)instance.estado({v:latest.current.state.vuelta,r:latest.current.state.region,niv:latest.current.state.niveles})})
  themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-suizamente-theme']})
  return()=>{alive=false;themeObserver.disconnect();world.current=null;instance?.destruir();instance?.elemento.remove()}
 },[inView,reduced,!!decorations])
 useEffect(()=>{if(world.current)world.current.estado({v:state.vuelta,r:state.region,niv:state.niveles},animationFor(animated,reduced))},[state,animated,reduced])
 useEffect(()=>{if(decorations)world.current?.decorar(decorations)},[decorations,state,ready])
 useEffect(()=>{
  if(!slots?.length||!ready){setSlotPositions([]);return}
  let frame,last=0;const points=slots.map(h=>({...h,soloProyectar:true}))
  const tick=now=>{const host=box.current;if(!host)return;if(now-last>100&&!document.hidden&&world.current){last=now;const b=host.getBoundingClientRect();setSlotPositions(visibleSlots(world.current.decorar(points),b.width,b.height))}frame=requestAnimationFrame(tick)}
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)
 },[slots,ready])
 useEffect(()=>{if(!regionView){world.current?.enfocar(selected);if(reduced)world.current?.saltar()}},[selected,reduced,regionView])
 useEffect(()=>{if(!regionView)return;if(!selected)world.current?.verRegion(config.mapa.regiones[state.region].cantones.map(k=>k.id));else world.current?.enfocar(selected);if(reduced)world.current?.saltar()},[regionView,regionView?state.region:null,selected,reduced,ready])
 useEffect(()=>world.current?.interaccion(interactive),[interactive])
 useEffect(()=>{
  if(!animated||(!ready&&!failed))return
  let active=true
  ;(async()=>{if(reduced)world.current?.saltar();await world.current?.reposo();if(active)onAnimationDone?.(animated)})()
  return()=>{active=false}
 },[animated,ready,failed,reduced])
 return <div className={'sv-world-map'+(selected?' selected':'')+(preview?' preview':'')+(mini?' mini':'')+(home?' home':'')} ref={box} role={mini?'img':'group'} aria-label={selected?'Maqueta del cantón '+selected+', nivel '+(state.niveles[selected]||0):'Maqueta de los cantones de Suiza'}>
  {!failed&&!ready&&<span className="sv-map-loading sv-skeleton" role="status" aria-label="Cargando tu mapa"/>}{(failed||!ready)&&<MapDrawing levels={state.niveles} region={state.region} vuelta={state.vuelta} only={selected||undefined}/>}
  {!!slots?.length&&<><svg aria-hidden="true" className="sv-mj-slot-lines" viewBox="0 0 100 100" preserveAspectRatio="none">{slotPositions.map(p=><line key={p.id} x1={p.ax*100} y1={p.ay*100} x2={p.x*100} y2={p.y*100}/>)}</svg>{slotPositions.map(p=><button key={p.id} className="sv-mj-slot" style={{left:p.x*100+'%',top:p.y*100+'%'}} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onSlot?.(p.id)}} aria-label={'Colocar una decoración en '+p.id}><span aria-hidden="true">＋</span></button>)}</>}

 </div>
})
