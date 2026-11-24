import {useEffect,useRef,useState} from 'react'
import {Button,Logo,Sheet} from './Shared'

let dismissed=false,appInstalled=false,deferredPrompt=null
const installed=()=>appInstalled||matchMedia('(display-mode: standalone)').matches||navigator.standalone===true
export function InstallBanner({hidden=false}){
 const [visible,setVisible]=useState(()=>!installed()&&!dismissed),[guide,setGuide]=useState(false),[busy,setBusy]=useState(false),prompt=useRef(deferredPrompt)
 const apple=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)
 useEffect(()=>{
  const before=e=>{e.preventDefault();deferredPrompt=prompt.current=e},done=()=>{appInstalled=true;setVisible(false);setGuide(false);deferredPrompt=prompt.current=null},again=()=>{if(!installed()){dismissed=false;setVisible(true)}}
  const media=matchMedia('(display-mode: standalone)'),change=()=>{if(installed())done()}
  window.addEventListener('beforeinstallprompt',before);window.addEventListener('appinstalled',done);window.addEventListener('suizamente:instalar-tras-perfil',again);media.addEventListener('change',change)
  return()=>{window.removeEventListener('beforeinstallprompt',before);window.removeEventListener('appinstalled',done);window.removeEventListener('suizamente:instalar-tras-perfil',again);media.removeEventListener('change',change)}
 },[])
 async function install(){
  if(!prompt.current){setGuide(true);return}
  setBusy(true)
  try{const event=prompt.current;deferredPrompt=prompt.current=null;await event.prompt();const result=await event.userChoice;if(result.outcome==='accepted'){appInstalled=true;setVisible(false)}}catch{setGuide(true)}finally{setBusy(false)}
 }
 if(installed()||hidden)return null
 return <>{visible&&<aside className="sv-install-banner" aria-label="Instalar Suizamente"><Logo size={36}/><div><b>Lleva Suizamente contigo</b><small>Instala la app en tu móvil</small></div><button disabled={busy} onClick={install}>Instalar</button><button className="sv-install-close" aria-label="Cerrar aviso de instalación" onClick={()=>{dismissed=true;setVisible(false)}}>×</button></aside>}{guide&&<Sheet title="Instala Suizamente" onClose={()=>setGuide(false)}>{apple?<><p>En Safari, abre Compartir. Si hace falta, toca «Ver más».</p><p>Elige «Añadir a pantalla de inicio» y confirma con «Añadir».</p><p>Si aparece «Abrir como app web», déjalo activado.</p></>:<><p>Abre el menú del navegador y elige «Instalar aplicación» o «Añadir a pantalla de inicio».</p><p>Después podrás abrir el juego desde su icono.</p></>}<Button onClick={()=>setGuide(false)}>Entendido</Button></Sheet>}</>
}
