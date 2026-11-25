import {useEffect,useRef} from 'react'
import {useSv} from './Context'
import {createFeedback,SV_FEEDBACK} from '../../../lib/suizamenteFeedback'

export function Feedback({music=false}){
  const {settings,player,user}=useSv(),latest=useRef(settings),owner=useRef(null),audio=useRef(null)
  latest.current=settings
  owner.current=player?.jugador_id||user?.id
  useEffect(()=>{
    const instance=createFeedback(()=>latest.current,globalThis,()=>owner.current);audio.current=instance
    const unlock=()=>instance.unlock(),play=e=>{const d=typeof e.detail==='string'?{kind:e.detail}:e.detail;instance.play(d.kind,d)},hide=()=>document.hidden?instance.ocultar():instance.mostrar()
    // Touch activation happens on release; keep retrying after interruptions, too.
    const gestures=['pointerdown','pointerup','touchend','click','keydown'],pause=()=>instance.ocultar()
    gestures.forEach(type=>document.addEventListener(type,unlock,true))
    window.addEventListener(SV_FEEDBACK,play);document.addEventListener('visibilitychange',hide)
    window.addEventListener('pageshow',hide);window.addEventListener('pagehide',pause)
    hide()
    return()=>{gestures.forEach(type=>document.removeEventListener(type,unlock,true));window.removeEventListener(SV_FEEDBACK,play);document.removeEventListener('visibilitychange',hide);window.removeEventListener('pageshow',hide);window.removeEventListener('pagehide',pause);instance.dispose()}
  },[])
  useEffect(()=>audio.current?.musica(music),[music])
  useEffect(()=>audio.current?.actualizar(),[settings.musica,settings.sonidos])
  useEffect(()=>{if(settings.vibracion===false)navigator.vibrate?.(0)},[settings.vibracion])
  return null
}
export function Confetti(){
  const {reduced}=useSv()
  return reduced?null:<div className="sv-confetti" aria-hidden="true">{Array.from({length:24},(_,i)=><i key={i} style={{'--x':(i*37)%100+'%','--delay':(i%6)*.07+'s','--color':['#24E2C9','#03AA98','#F9A719','#FA2F35','#4A76EF','#24BFE2'][i%6]}}/>)}</div>
}
export function InstallMetadata(){
  useEffect(()=>{
    const root=document.documentElement,oldTheme=root.getAttribute('data-theme'),sync=()=>{root.dataset.theme=root.dataset.suizamenteTheme==='oscura'?'dark':'light'}
    const observer=new MutationObserver(sync);observer.observe(root,{attributes:true,attributeFilter:['data-suizamente-theme']});sync()
    const links=[['link[rel="manifest"]','href','/suizamente.webmanifest'],['link[rel="apple-touch-icon"]','href','/suizamente-assets/icon-180.png'],['meta[name="theme-color"]','content','#24E2C9']]
    const originals=links.map(([selector,attr,value])=>{const el=document.querySelector(selector),old=el?.getAttribute(attr);el?.setAttribute(attr,value);return()=>{if(el&&old!=null)el.setAttribute(attr,old)}})
    return()=>{observer.disconnect();originals.forEach(restore=>restore());if(oldTheme==null)root.removeAttribute('data-theme');else root.setAttribute('data-theme',oldTheme)}
  },[])
  return null
}
