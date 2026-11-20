import { useEffect, useRef } from 'react'
import { useLocation,useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { connectSuizamenteSession } from '../lib/suizamenteSessionBridge'

// Isolate the reference CSS and full-screen reveal from Latido's global styles.
export default function Suizamente() {
  const frame = useRef(null)
  const signingOut = useRef(false)
  const { authUser } = useAuth()
  const location=useLocation(),navigate=useNavigate()
  const path=location.pathname==='/perfil/suizometro'?'/perfil':location.pathname.startsWith('/admin/suizamente')?'/moderacion':location.pathname.replace(/^\/suizamente/,'')||'/'
  const pathRef=useRef(path+location.search)
  pathRef.current=path+location.search
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
        navigate('/auth?mode=login&next=%2Fsuizamente',{replace:true})
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
  return <iframe key={authUser?.id || 'anon'} ref={frame} src="/suizamente/juego.html"
    title="Suizamente, un juego de Latido" allow="clipboard-write; web-share"
    style={{ display:'block', border:0, position:'fixed', inset:0, width:'100%', height:'100dvh', zIndex:30, background:'#fff' }} />
}
export function Suizometro() { return <Suizamente /> }
