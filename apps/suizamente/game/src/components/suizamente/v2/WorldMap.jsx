import {useEffect,useRef,useState} from 'react'
import {useSv} from './Context'
import {MapDrawing} from './Map'

let assets
function loadAssets(){return assets||(assets=Promise.all([import('./world3d'),fetch('/suizamente-assets/mapa3d.json').then(r=>{if(!r.ok)throw Error('Mapa no disponible');return r.json()})]).catch(e=>{assets=null;throw e}))}
export function WorldMap({state,selected,onSelect=()=>{},animated,onMetadata,preview=false,mini=false,home=false}){
 const {reduced:preference,config}=useSv(),reduced=preference||preview,box=useRef(null),world=useRef(null),visible=useRef(true),latest=useRef({state,selected,onSelect,reduced})
 const [interactive,setInteractive]=useState(false)
 const [failed,setFailed]=useState(false),[inView,setInView]=useState(!mini)
 const lastAnimation=useRef(null)
 latest.current={state,selected,onSelect,reduced,animated,interactive}
 function animationFor(mark,lessMotion){if(mark===lastAnimation.current)return;lastAnimation.current=mark;return lessMotion?undefined:mark?.canton}
 useEffect(()=>{
  const observer=new IntersectionObserver(entries=>{visible.current=entries[0].isIntersecting;if(mini)setInView(entries[0].isIntersecting)})
  observer.observe(box.current)
  return()=>observer.disconnect()
 },[])
 useEffect(()=>{
  if(!inView)return
  let alive=true,instance
  loadAssets().then(([{Mapa3D},geometry])=>{
   if(!alive)return
   const datos=mini||preview?{...geometry,cantones:{[selected]:geometry.cantones[selected]}}:geometry
   instance=Mapa3D.crear({datos,foto:preview,mini,mode:mini?'mini':home?'home':preview?'preview':'map',regiones:config.mapa.regiones.map(r=>({c:r.cantones.map(k=>k.id)})),alSeleccionar:k=>latest.current.onSelect(k),reduced:()=>latest.current.reduced,interactive:()=>latest.current.interactive,visible:()=>visible.current,dark:()=>document.documentElement.dataset.suizamenteTheme==='oscura'})
   instance.montar(box.current);instance.interaccion(latest.current.interactive);instance.estado({v:latest.current.state.vuelta,r:latest.current.state.region,niv:latest.current.state.niveles},animationFor(latest.current.animated,latest.current.reduced));instance.enfocar(latest.current.selected)
   if(latest.current.reduced||mini||preview)instance.saltar()
   instance.elemento.querySelector('canvas')?.setAttribute('aria-hidden','true');world.current=instance;onMetadata?.(Mapa3D.C3)
  }).catch(()=>{instance?.destruir();instance?.elemento.remove();instance=null;world.current=null;if(alive)setFailed(true)})
  const themeObserver=new MutationObserver(()=>{if(instance)instance.estado({v:latest.current.state.vuelta,r:latest.current.state.region,niv:latest.current.state.niveles})})
  themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-suizamente-theme']})
  return()=>{alive=false;themeObserver.disconnect();world.current=null;instance?.destruir();instance?.elemento.remove()}
 },[inView])
 useEffect(()=>{if(world.current)world.current.estado({v:state.vuelta,r:state.region,niv:state.niveles},animationFor(animated,reduced))},[state,animated,reduced])
 useEffect(()=>{world.current?.enfocar(selected);if(reduced)world.current?.saltar()},[selected,reduced])
 useEffect(()=>world.current?.interaccion(interactive),[interactive])
 return <div className={'sv-world-map'+(selected?' selected':'')+(preview?' preview':'')+(mini?' mini':'')+(home?' home':'')} ref={box} role={mini?'img':'group'} aria-label={selected?'Maqueta del cantón '+selected+', nivel '+(state.niveles[selected]||0):'Maqueta de los cantones de Suiza'}>
  {failed&&<MapDrawing levels={state.niveles} region={state.region} vuelta={state.vuelta} only={selected||undefined}/>}
  {!failed&&!preview&&!mini&&<>{interactive&&<div className="sv-map-tools"><button aria-label="Acercar mapa" onClick={()=>world.current?.zoom(.8)}>＋</button><button aria-label="Alejar mapa" onClick={()=>world.current?.zoom(1.25)}>−</button><button aria-label="Girar mapa a la izquierda" onClick={()=>world.current?.rotar(-Math.PI/8)}>↶</button><button aria-label="Girar mapa a la derecha" onClick={()=>world.current?.rotar(Math.PI/8)}>↷</button></div>}<button className="sv-map-mode" aria-label={interactive?'Bloquear movimiento del mapa':'Activar movimiento del mapa'} aria-pressed={interactive} onClick={()=>setInteractive(value=>!value)}><span aria-hidden="true">{interactive?'🔓':'✋'}</span><span>{interactive?'Bloquear':'Mover'}</span></button></>}
 </div>
}
