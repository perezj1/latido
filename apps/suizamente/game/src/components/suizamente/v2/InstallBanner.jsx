import {useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react'
import {Button,Sheet} from './Shared'
import {installationSnapshot,subscribeInstallation,requestInstallation} from '../../../../installation'

let dismissed=false
const installed=()=>installationSnapshot().installed||matchMedia('(display-mode: standalone)').matches||navigator.standalone===true
function IOSVideo(){
 const [open,setOpen]=useState(false)
 return <div className="sv-install-video"><button type="button" className="sv-install-video-toggle" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>{open?'Ocultar vídeo':'Ver vídeo'}</button>{open&&<><p className="sv-install-video-note">El vídeo muestra Latido. Sigue los mismos pasos sin salir de Suizamente.</p><video controls playsInline preload="metadata" src="/suizamente-assets/install-ios.mp4" aria-label="Vídeo para instalar Suizamente en iPhone"/></>}</div>
}
function IOSSteps(){return <ol className="sv-install-steps"><li>Pulsa ••• en el navegador.</li><li>Toca «Compartir».</li><li>Selecciona «Añadir a pantalla de inicio» y confirma con «Añadir».</li></ol>}
export function InstallBanner({hidden=false}){
 const [visible,setVisible]=useState(()=>!installed()&&!dismissed),[guide,setGuide]=useState(false),banner=useRef(null)
 const installation=useSyncExternalStore(subscribeInstallation,installationSnapshot)
 const apple=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)
 const show=visible&&!hidden&&!installed()
 useEffect(()=>{
  const again=()=>{if(!installed()){dismissed=false;setVisible(true)}}
  window.addEventListener('suizamente:instalar-tras-perfil',again)
  return()=>window.removeEventListener('suizamente:instalar-tras-perfil',again)
 },[])
 useEffect(()=>{if(installation.installed){setVisible(false);setGuide(false)}},[installation.installed])
 useLayoutEffect(()=>{
  if(!show)return
  const node=banner.current,root=node?.closest('.sv-root');if(!root)return
  const measure=()=>{root.style.setProperty('--sv-install-space',Math.ceil(node.getBoundingClientRect().height+24)+'px');root.classList.add('sv-has-install')}
  measure();const observer=new ResizeObserver(measure);observer.observe(node);window.addEventListener('resize',measure)
  return()=>{observer.disconnect();window.removeEventListener('resize',measure);root.classList.remove('sv-has-install');root.style.removeProperty('--sv-install-space')}
 },[show])
 async function install(){
  if(installation.busy)return
  if(apple){setGuide(true);return}
  const result=await requestInstallation()
  if(result==='unavailable')setGuide(true)
  else if(result==='accepted'||result==='installed')setVisible(false)
 }
 if(installed()||hidden)return null
 return <>{show&&<aside ref={banner} className="sv-install-banner" aria-label="Instalar Suizamente"><div className="sv-install-card"><div className="sv-install-heading"><span aria-hidden="true">📲</span><div><b>Instala Suizamente en tu {apple?'iPhone':'móvil'}</b><p>Gratis. Sin App Store ni Google Play.<br/>Directo desde el navegador.</p></div></div><div className="sv-install-actions"><button disabled={installation.busy} onClick={install}>{installation.busy?'Instalando…':apple||installation.prompt?'Instalar':'Cómo instalar'}</button><button className="sv-install-close" aria-label="Ahora no, cerrar aviso de instalación" onClick={()=>{dismissed=true;setVisible(false)}}>Ahora no</button></div>{apple&&<IOSVideo/>}</div></aside>}{guide&&<Sheet title="Instala Suizamente" onClose={()=>setGuide(false)}>{apple?<><IOSSteps/><p>Si aparece «Abrir como app web», déjalo activado.</p><IOSVideo/></>:<><p>Abre el menú del navegador y elige «Instalar aplicación» o «Añadir a pantalla de inicio».</p><p>Después podrás abrir el juego desde su icono.</p></>}<Button onClick={()=>setGuide(false)}>Entendido</Button></Sheet>}</>
}
