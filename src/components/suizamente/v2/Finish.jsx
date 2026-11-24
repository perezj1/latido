import {useEffect,useRef} from 'react'
import {useSv} from './Context'
import {createFeedback,SV_FEEDBACK} from '../../../lib/suizamenteFeedback'

export function Feedback(){
  const {settings}=useSv(),latest=useRef(settings),audio=useRef(null)
  latest.current=settings
  useEffect(()=>{
    const instance=createFeedback(()=>latest.current);audio.current=instance
    const unlock=()=>instance.unlock(),play=e=>instance.play(e.detail),hide=()=>{if(document.hidden)instance.stop()}
    document.addEventListener('pointerdown',unlock,true);document.addEventListener('keydown',unlock,true)
    window.addEventListener(SV_FEEDBACK,play);document.addEventListener('visibilitychange',hide)
    return()=>{document.removeEventListener('pointerdown',unlock,true);document.removeEventListener('keydown',unlock,true);window.removeEventListener(SV_FEEDBACK,play);document.removeEventListener('visibilitychange',hide);instance.dispose()}
  },[])
  useEffect(()=>{if(settings.sonidos===false)audio.current?.stop()},[settings.sonidos])
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
