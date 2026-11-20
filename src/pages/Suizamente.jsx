import { useEffect, useRef, useState } from 'react'
import { useLocation,useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { connectSuizamenteSession } from '../lib/suizamenteSessionBridge'
import { createSuizamenteInstall } from '../../apps/suizamente/src/install'
import { completeRegistrationProfile } from '../../apps/suizamente/src/registration.js'
import '../../apps/suizamente/src/access.css'

// Isolate the reference CSS and full-screen reveal from Latido's global styles.
export default function Suizamente() {
  const frame = useRef(null)
  const signingOut = useRef(false)
  const installation = useRef(null),guide = useRef(null)
  const { authUser } = useAuth()
  const [profileError,setProfileError]=useState('')
  const [profileAttempt,setProfileAttempt]=useState(0)
  const socialApi=import.meta.env.DEV?'/api/suizamente/social':import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/,'')+'/functions/v1/suizamente-social'
  const pendingProfile=!!authUser?.user_metadata?.suizamente_perfil_pendiente
  const location=useLocation(),navigate=useNavigate()
  const path=location.pathname==='/perfil/suizometro'?'/perfil':location.pathname.startsWith('/admin/suizamente')?'/moderacion':location.pathname.replace(/^\/suizamente/,'')||'/'
  const pathRef=useRef(path+location.search)
  pathRef.current=path+location.search
  useEffect(()=>{
    let cancelled=false
    if(pendingProfile)completeRegistrationProfile({client:supabase,socialApi}).catch(error=>{if(!cancelled)setProfileError(error.message)})
    return ()=>{cancelled=true}
  },[pendingProfile,socialApi,profileAttempt])
  useEffect(()=>{
    installation.current=createSuizamenteInstall({integrated:true,navigate:next=>navigate('/suizamente'+next)})
    return ()=>{installation.current?.dispose();installation.current=null}
  },[navigate])
  useEffect(()=>{
    installation.current?.setRoute(path)
    if(path==='/instalar'&&guide.current){document.title='Instalar Suizamente';installation.current?.renderGuide(guide.current,{back:'/suizamente'})}
  },[path])
  useEffect(() => connectSuizamenteSession({
    getFrame:() => frame.current?.contentWindow,
    getSession:() => supabase.auth.getSession(),
    experience:true,
    allowLogout:true,
    onLogout:async()=>{
      if(signingOut.current)return
      signingOut.current=true
      try{
        const {error}=await supabase.auth.signOut({scope:'local'})
        if(error)throw error
        navigate('/auth?mode=register&next=%2Fsuizamente',{replace:true})
      }catch{
        frame.current?.contentWindow?.postMessage({type:'suizamente:logout-error'},window.location.origin)
      }finally{signingOut.current=false}
    },
    socialApi:import.meta.env.DEV?'/api/suizamente/social':import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/,'')+'/functions/v1/suizamente-social',
    getPath:()=>pathRef.current,
    onNavigate:next=>navigate('/suizamente'+(next==='/'?'':next)),
    api:import.meta.env.PROD && import.meta.env.VITE_SUPABASE_URL
      ? import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '') + '/functions/v1/suizamente-votos'
      : '/api/suizamente',
  }), [navigate])
  useEffect(()=>{frame.current?.contentWindow?.postMessage({type:'suizamente:route',path:path+location.search},window.location.origin)},[path,location.search])
  if(pendingProfile)return <section className="suizamente-access" data-theme="light"><div className="suizamente-access__inner"><header className="suizamente-access__heading"><img src="/suizamente/logo.svg" width="72" height="54" alt="Suizamente"/><h1>Preparando tu perfil</h1></header><p role={profileError?'alert':'status'}>{profileError||'Tu cuenta está creada. Estamos guardando tus opciones.'}</p>{profileError&&<button className="suizamente-access__primary" onClick={()=>{setProfileError('');setProfileAttempt(n=>n+1)}}>Volver a intentarlo</button>}</div></section>
  if(path==='/instalar')return <div className="suizamente-install-host" ref={guide} />
  return <iframe key={authUser?.id || 'anon'} ref={frame} src="/suizamente/juego.html"
    title="Suizamente, un juego de Latido" allow="clipboard-write; web-share"
    style={{ display:'block', border:0, position:'fixed', inset:0, width:'100%', height:'100dvh', zIndex:30, background:'#fff' }} />
}
export function Suizometro() { return <Suizamente /> }
