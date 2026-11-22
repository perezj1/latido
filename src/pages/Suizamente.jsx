import { useEffect, useRef, useState } from 'react'
import { useLocation,useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { connectSuizamenteSession } from '../lib/suizamenteSessionBridge'
import { createSuizamenteInstall } from '../../apps/suizamente/src/install'
import { completeRegistrationProfile,prepareSuizamenteAccount } from '../../apps/suizamente/src/registration.js'
import {needsSuizamenteOnboarding} from '../../apps/suizamente/src/onboarding.js'
import SuizamenteEntry from '../components/SuizamenteEntry'
import SuizamenteLoading from '../components/SuizamenteLoading'
import {connectSuizamenteAppearance} from '../lib/suizamenteAppearance'
import '../../apps/suizamente/src/access.css'

// Isolate the reference CSS and full-screen reveal from Latido's global styles.
export default function Suizamente() {
  const frame = useRef(null)
  const signingOut = useRef(false)
  const installation = useRef(null),guide = useRef(null)
  const { authUser,loading:authLoading } = useAuth()
  const [checkingGoogle,setCheckingGoogle]=useState(()=>{try{return !!sessionStorage.getItem('suizamente:oauth-inicio')}catch{return false}})
  const [profileError,setProfileError]=useState('')
  const [profileAttempt,setProfileAttempt]=useState(0)
  const [onboardingUser,setOnboardingUser]=useState(null)
  const [checkedUser,setCheckedUser]=useState(null)
  const referenceMode=window.SUIZAMENTE_CONFIG?.experiencia===false
  const socialApi=import.meta.env.DEV?'/api/suizamente/social':import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/,'')+'/functions/v1/suizamente-social'
  const pendingProfile=!!authUser?.user_metadata?.suizamente_perfil_pendiente
  const needsProfile=!referenceMode&&needsSuizamenteOnboarding(authUser)
  const location=useLocation(),navigate=useNavigate()
  const path=location.pathname==='/perfil/suizometro'?'/perfil':location.pathname.startsWith('/admin/suizamente')?'/moderacion':location.pathname.replace(/^\/suizamente/,'')||'/'
  const pathRef=useRef(path+location.search)
  useEffect(()=>connectSuizamenteAppearance({getFrame:()=>frame.current?.contentWindow}),[])
  pathRef.current=path+location.search
  useEffect(()=>{if(needsProfile&&checkedUser===authUser.id)setOnboardingUser(authUser.id);else if(!authUser)setOnboardingUser(null)},[needsProfile,authUser,checkedUser])
  useEffect(()=>{
    if(authLoading)return
    let cancelled=false
    prepareSuizamenteAccount({client:supabase}).catch(error=>{if(!cancelled)setProfileError(error.message)}).finally(()=>{if(!cancelled){setCheckingGoogle(false);setCheckedUser(authUser?.id||null)}})
    return ()=>{cancelled=true}
  },[authUser?.id,authLoading,profileAttempt])
  useEffect(()=>{
    let cancelled=false
    if(pendingProfile&&!needsProfile)completeRegistrationProfile({client:supabase,socialApi}).catch(error=>{if(!cancelled)setProfileError(error.message)})
    return ()=>{cancelled=true}
  },[pendingProfile,needsProfile,socialApi,profileAttempt])
  useEffect(()=>{
    installation.current=createSuizamenteInstall({integrated:true,navigate:next=>navigate('/suizamente'+next)})
    return ()=>{installation.current?.dispose();installation.current=null}
  },[navigate])
  useEffect(()=>{
    installation.current?.setRoute((!authUser&&!referenceMode)?'/bienvenida':needsProfile?'/onboarding':path)
    if(path==='/instalar'&&guide.current){document.title='Instalar Suizamente';installation.current?.renderGuide(guide.current,{back:'/suizamente'})}
  },[path,authUser,referenceMode,needsProfile,authLoading,checkingGoogle,checkedUser])
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
        navigate('/suizamente/bienvenida',{replace:true})
      }catch{
        frame.current?.contentWindow?.postMessage({type:'suizamente:logout-error'},window.location.origin)
      }finally{signingOut.current=false}
    },
    socialApi:import.meta.env.DEV?'/api/suizamente/social':import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/,'')+'/functions/v1/suizamente-social',
    getPath:()=>pathRef.current,
    conquistaApi:import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/,'')+'/functions/v1/suizamente-conquista',
    onNavigate:next=>navigate('/suizamente'+(next==='/'?'':next)),
    api:import.meta.env.PROD && import.meta.env.VITE_SUPABASE_URL
      ? import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '') + '/functions/v1/suizamente-votos'
      : '/api/suizamente',
  }), [navigate])
  useEffect(()=>{frame.current?.contentWindow?.postMessage({type:'suizamente:route',path:path+location.search},window.location.origin)},[path,location.search])
  if(path==='/instalar')return <div className="suizamente-install-host" ref={guide} />
  if(authLoading||checkingGoogle||(needsProfile&&checkedUser!==authUser?.id))return <SuizamenteLoading/>
  if(!authLoading&&!authUser&&!referenceMode)return <SuizamenteEntry key="welcome" onSignup={()=>navigate('/auth?mode=register&next=%2Fsuizamente')} onLogin={()=>navigate('/auth?mode=login&next=%2Fsuizamente')}/>
  if(authUser&&(needsProfile||onboardingUser===authUser.id))return <SuizamenteEntry key={authUser.id} user={authUser} onComplete={()=>installation.current.afterOnboarding(()=>{setOnboardingUser(null);navigate('/suizamente',{replace:true})})}/>
  if(checkingGoogle||pendingProfile||profileError)return <section className="suizamente-access suizamente-profile-sync" data-theme="light"><img src="/suizamente/logo.svg" width="100" height="76" alt="Suizamente"/>{profileError&&<><p role="alert">{profileError}</p><button className="suizamente-access__primary" onClick={()=>{setProfileError('');setProfileAttempt(n=>n+1)}}>Volver a intentarlo</button></>}</section>
  return <iframe key={authUser?.id || 'anon'} ref={frame} src="/suizamente/juego.html"
    title="Suizamente, un juego de Latido" allow="clipboard-write; web-share"
    style={{ display:'block', border:0, position:'fixed', inset:0, width:'100%', height:'100dvh', zIndex:30, background:'#fff' }} />
}
export function Suizometro() { return <Suizamente /> }
