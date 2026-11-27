import {useEffect,useRef,useState} from 'react'
import {useSv} from './Context'
import {MapDrawing} from './Map'
import {loadMapAssets} from './mapPhotos'

// Presentation only, scoped to account and the saved map. No live WebGL in Home.
const photos=new Map()
export function HomeMapPhoto(){
 const {map,player,config}=useSv(),box=useRef(null),[result,setResult]=useState(null),[size,setSize]=useState(null)
 useEffect(()=>{
  let frame
  // The transparent crop removes part of the render: oversample for Retina even
  // after that crop, with a cap on the temporary GPU allocation.
  const measure=()=>{const rect=box.current.getBoundingClientRect(),next={width:Math.round(rect.width),height:Math.round(rect.height),scale:Math.max(4,Math.min(6,Math.ceil((window.devicePixelRatio||1)*1.6)))};if(next.width&&next.height)setSize(old=>old&&old.width===next.width&&old.height===next.height&&old.scale===next.scale?old:next)}
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(measure)}
  measure();const observer=new ResizeObserver(schedule);observer.observe(box.current);window.addEventListener('resize',schedule)
  return()=>{observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',schedule)}
 },[])
 const key=map&&size?JSON.stringify([player.jugador_id,map.vuelta,map.region,Object.entries(map.niveles).sort(([a],[b])=>a.localeCompare(b)),size.width,size.height,size.scale]):null
 useEffect(()=>{
  if(!key)return
  let alive=true,idle,timer
  function capture(){
   if(!alive)return
   if(!photos.has(key)){
    const state=map
    const task=loadMapAssets().then(([{Mapa3D},datos])=>Mapa3D.fotoInicio({datos,regiones:config.mapa.regiones.map(r=>({c:r.cantones.map(k=>k.id)})),v:state.vuelta,r:state.region,niv:state.niveles,ancho:size.width,alto:size.height,escala:size.scale})).catch(()=>null)
    photos.set(key,task)
    // Keep a small session cache; keys include the account, never persistent data.
    if(photos.size>4)photos.delete(photos.keys().next().value)
   }
   photos.get(key).then(foto=>{if(alive)setResult({key,foto})})
  }
  if(photos.has(key))capture()
  else if(window.requestIdleCallback)idle=window.requestIdleCallback(capture,{timeout:1500})
  else timer=setTimeout(capture,0)
  return()=>{alive=false;clearTimeout(timer);if(idle!==undefined)window.cancelIdleCallback?.(idle)}
 },[key])
 const foto=result?.key===key?result.foto:null
 return <div className="sv-home-photo" ref={box} aria-hidden="true">{foto?<img src={foto} alt="" draggable="false"/>:<MapDrawing levels={map?.niveles} region={map?.region} vuelta={map?.vuelta}/>}</div>
}
