import {forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react'
import {useSv} from './Context'
import {MapDrawing} from './Map'

import {loadMapAssets,flatMapPhoto} from './mapPhotos'
export const WorldMap=forwardRef(function WorldMap({state,selected,onSelect=()=>{},animated,onMetadata,onAnimationDone,preview=false,demo=false,mini=false,home=false},ref){
 const {reduced:preference,config}=useSv(),reduced=preference||mini||home||(preview&&!demo),box=useRef(null),world=useRef(null),visible=useRef(true),latest=useRef({state,selected,onSelect,reduced})
 const [interactive,setInteractive]=useState(false)
 const [ready,setReady]=useState(false)
 const [failed,setFailed]=useState(false),[inView,setInView]=useState(!mini&&!preview)
 const lastAnimation=useRef(null)
 latest.current={state,selected,onSelect,reduced,animated,interactive}
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
  loadMapAssets().then(([{Mapa3D},geometry])=>{
   if(!alive)return
   const datos=mini||preview?{...geometry,cantones:{[selected]:geometry.cantones[selected]}}:geometry
   instance=Mapa3D.crear({datos,foto:preview,mini,mode:mini?'mini':home?'home':preview?'preview':'map',regiones:config.mapa.regiones.map(r=>({c:r.cantones.map(k=>k.id)})),alSeleccionar:k=>latest.current.onSelect(k),reduced:()=>latest.current.reduced,interactive:()=>latest.current.interactive,visible:()=>visible.current,dark:()=>document.documentElement.dataset.suizamenteTheme==='oscura'})
   instance.montar(box.current);instance.interaccion(latest.current.interactive);instance.estado({v:latest.current.state.vuelta,r:latest.current.state.region,niv:latest.current.state.niveles},animationFor(latest.current.animated,latest.current.reduced));instance.enfocar(latest.current.selected)
   if(latest.current.reduced||mini||preview)instance.saltar()
   instance.elemento.querySelector('canvas')?.setAttribute('aria-hidden','true');world.current=instance;onMetadata?.(Mapa3D.C3)
   requestAnimationFrame(()=>{if(alive)setReady(true)})
  }).catch(()=>{instance?.destruir();instance?.elemento.remove();instance=null;world.current=null;if(alive)setFailed(true)})
  const themeObserver=new MutationObserver(()=>{if(instance)instance.estado({v:latest.current.state.vuelta,r:latest.current.state.region,niv:latest.current.state.niveles})})
  themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-suizamente-theme']})
  return()=>{alive=false;themeObserver.disconnect();world.current=null;instance?.destruir();instance?.elemento.remove()}
 },[inView])
 useEffect(()=>{if(world.current)world.current.estado({v:state.vuelta,r:state.region,niv:state.niveles},animationFor(animated,reduced))},[state,animated,reduced])
 useEffect(()=>{world.current?.enfocar(selected);if(reduced)world.current?.saltar()},[selected,reduced])
 useEffect(()=>world.current?.interaccion(interactive),[interactive])
 useEffect(()=>{
  if(!animated||(!ready&&!failed))return
  let active=true
  ;(async()=>{if(reduced)world.current?.saltar();await world.current?.reposo();if(active)onAnimationDone?.(animated)})()
  return()=>{active=false}
 },[animated,ready,failed,reduced])
 return <div className={'sv-world-map'+(selected?' selected':'')+(preview?' preview':'')+(mini?' mini':'')+(home?' home':'')} ref={box} role={mini?'img':'group'} aria-label={selected?'Maqueta del cantón '+selected+', nivel '+(state.niveles[selected]||0):'Maqueta de los cantones de Suiza'}>
  {(failed||!ready)&&<MapDrawing levels={state.niveles} region={state.region} vuelta={state.vuelta} only={selected||undefined}/>}
  {!failed&&!preview&&!mini&&<><button className="sv-map-mode" aria-label={interactive?'Bloquear movimiento del mapa':'Activar movimiento del mapa'} aria-pressed={interactive} onClick={()=>setInteractive(value=>!value)}><span aria-hidden="true">{interactive?'🔓':'✋'}</span><span>{interactive?'Bloquear':'Mover'}</span></button></>}
 </div>
})
