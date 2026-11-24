import {useEffect,useLayoutEffect,useRef,useState} from 'react'
import {Button,Sheet} from './Shared'

let dismissed=false,appInstalled=false,deferredPrompt=null
const installed=()=>appInstalled||matchMedia('(display-mode: standalone)').matches||navigator.standalone===true
function IOSVideo(){
 const [open,setOpen]=useState(false)
 return <div className="sv-install-video"><button type="button" className="sv-install-video-toggle" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>{open?'Ocultar vídeo':'Ver vídeo'}</button>{open&&<><p className="sv-install-video-note">El vídeo muestra Latido. Sigue los mismos pasos sin salir de Suizamente.</p><video controls playsInline preload="metadata" src="/suizamente-assets/install-ios.mp4" aria-label="Vídeo para instalar Suizamente en iPhone"/></>}</div>
}
function IOSSteps(){return <ol className="sv-install-steps"><li>Pulsa ••• en el navegador.</li><li>Toca «Compartir».</li><li>Selecciona «Añadir a pantalla de inicio» y confirma con «Añadir».</li></ol>}
export function InstallBanner({hidden=false}){
 const [visible,setVisible]=useState(()=>!installed()&&!dismissed),[guide,setGuide]=useState(false),[busy,setBusy]=useState(false),prompt=useRef(deferredPrompt),banner=useRef(null)
 const apple=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)
 const show=visible&&!hidden&&!installed()
 useEffect(()=>{
  const before=e=>{e.preventDefault();deferredPrompt=prompt.current=e},done=()=>{appInstalled=true;setVisible(false);setGuide(false);deferredPrompt=prompt.current=null},again=()=>{if(!installed()){dismissed=false;setVisible(true)}}
  const media=matchMedia('(display-mode: standalone)'),change=()=>{if(installed())done()}
  window.addEventListener('beforeinstallprompt',before);window.addEventListener('appinstalled',done);window.addEventListener('suizamente:instalar-tras-perfil',again);media.addEventListener('change',change)
  return()=>{window.removeEventListener('beforeinstallprompt',before);window.removeEventListener('appinstalled',done);window.removeEventListener('suizamente:instalar-tras-perfil',again);media.removeEventListener('change',change)}
 },[])
 useLayoutEffect(()=>{
  if(!show)return
  const node=banner.current,root=node?.closest('.sv-root');if(!root)return
  const measure=()=>{root.style.setProperty('--sv-install-space',Math.ceil(node.getBoundingClientRect().height+24)+'px');root.classList.add('sv-has-install')}
  measure();const observer=new ResizeObserver(measure);observer.observe(node);window.addEventListener('resize',measure)
  return()=>{observer.disconnect();window.removeEventListener('resize',measure);root.classList.remove('sv-has-install');root.style.removeProperty('--sv-install-space')}
 },[show])
 async function install(){
  if(apple||!prompt.current){setGuide(true);return}
  setBusy(true)
  try{const event=prompt.current;deferredPrompt=prompt.current=null;await event.prompt();const result=await event.userChoice;if(result.outcome==='accepted'){appInstalled=true;setVisible(false)}}catch{setGuide(true)}finally{setBusy(false)}
 }
 if(installed()||hidden)return null
 return <>{show&&<aside ref={banner} className="sv-install-banner" aria-label="Instalar Suizamente"><div className="sv-install-card"><div className="sv-install-heading"><span aria-hidden="true">📲</span><div><b>Instala Suizamente en tu {apple?'iPhone':'móvil'}</b><p>Gratis. Sin App Store ni Google Play.<br/>Directo desde el navegador.</p></div></div><div className="sv-install-actions"><button disabled={busy} onClick={install}>Instalar</button><button className="sv-install-close" aria-label="Ahora no, cerrar aviso de instalación" onClick={()=>{dismissed=true;setVisible(false)}}>Ahora no</button></div>{apple&&<IOSVideo/>}</div></aside>}{guide&&<Sheet title="Instala Suizamente" onClose={()=>setGuide(false)}>{apple?<><IOSSteps/><p>Si aparece «Abrir como app web», déjalo activado.</p><IOSVideo/></>:<><p>Abre el menú del navegador y elige «Instalar aplicación» o «Añadir a pantalla de inicio».</p><p>Después podrás abrir el juego desde su icono.</p></>}<Button onClick={()=>setGuide(false)}>Entendido</Button></Sheet>}</>
}
