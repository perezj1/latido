import {useEffect,useRef,useState} from 'react'
import {useSv} from './Context'
import {MapDrawing} from './Map'
import {loadMapAssets} from './mapPhotos'

// Presentation only, scoped to account and the saved map. No live WebGL in Home.
const photos=new Map()
export function HomeMapPhoto(){
 const {map,player,config}=useSv(),box=useRef(null),[result,setResult]=useState(null)
 const key=map?JSON.stringify([player.jugador_id,map.vuelta,map.region,Object.entries(map.niveles).sort(([a],[b])=>a.localeCompare(b))]):null
 useEffect(()=>{
  if(!key)return
  let alive=true,idle,timer
  function capture(){
   if(!alive)return
   if(!photos.has(key)){
    const {width,height}=box.current.getBoundingClientRect(),state=map
    const task=loadMapAssets().then(([{Mapa3D},datos])=>Mapa3D.fotoInicio({datos,regiones:config.mapa.regiones.map(r=>({c:r.cantones.map(k=>k.id)})),v:state.vuelta,r:state.region,niv:state.niveles,ancho:Math.max(1,Math.round(width)),alto:Math.max(1,Math.round(height))})).catch(()=>null)
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
