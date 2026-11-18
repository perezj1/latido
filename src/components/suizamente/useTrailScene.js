import {useEffect,useState} from 'react'
import {landscapePhase} from './trailLandscape'

export function useTrailScene(viewport){
  const [phase,setPhase]=useState(landscapePhase)
  const [reducedMotion,setReducedMotion]=useState(()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [paused,setPaused]=useState(()=>typeof document!=='undefined'&&document.hidden)
  useEffect(()=>{
    const media=window.matchMedia('(prefers-reduced-motion: reduce)')
    let visible=true
    const refresh=()=>{setPhase(landscapePhase());setPaused(document.hidden||!visible)}
    const motion=()=>setReducedMotion(media.matches)
    const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting!==false;refresh()})
    if(viewport.current)observer?.observe(viewport.current)
    media.addEventListener('change',motion)
    document.addEventListener('visibilitychange',refresh)
    const timer=setInterval(refresh,60000)
    refresh()
    return()=>{clearInterval(timer);observer?.disconnect();media.removeEventListener('change',motion);document.removeEventListener('visibilitychange',refresh)}
  },[viewport])
  return {phase,reducedMotion,paused}
}
