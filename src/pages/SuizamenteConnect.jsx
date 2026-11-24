import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { installLatidoSsoBridge } from '../lib/suizamenteSsoBridge'

export default function SuizamenteConnect() {
  const { loading,isLoggedIn }=useAuth()
  useEffect(()=>{
    document.title='Entrar a Suizamente · Latido'
    let robots=document.querySelector('meta[name="robots"]')
    if(!robots){robots=document.createElement('meta');robots.name='robots';document.head.append(robots)}
    robots.content='noindex, nofollow, noarchive'
    const origins=['https://suizamente.latido.ch',...(import.meta.env.VITE_SUIZAMENTE_SSO_ORIGINS||'').split(',').map(s=>s.trim()).filter(s=>/^https:\/\/[^/]+$/.test(s))]
    if(import.meta.env.DEV)origins.push('http://127.0.0.1:5270','http://127.0.0.1:5271','http://localhost:5270','http://localhost:5271')
    const dispose=installLatidoSsoBridge({getSession:()=>supabase.auth.getSession(),origins})
    const appOrigin=new URLSearchParams(location.search).get('appOrigin')||'https://suizamente.latido.ch'
    if(origins.includes(appOrigin))for(const receiver of [window.parent,window.opener])if(receiver&&receiver!==window)receiver.postMessage({type:'suizamente:sso-ready'},appOrigin)
    return dispose
  },[loading])
  const next=location.pathname+location.search
  return <main style={{maxWidth:480,margin:'48px auto',padding:24,textAlign:'center'}}>
    <img src="/favicon.svg" width="72" height="72" alt="Latido" />
    <h1>Tu cuenta de Latido en Suizamente</h1>
    <p>{loading?'Comprobando tu sesión…':isLoggedIn?'Puedes volver a Suizamente. Estamos conectando tu cuenta.':'Entra con tu cuenta de Latido para continuar en Suizamente.'}</p>
    {!loading&&!isLoggedIn&&<Link to={'/auth?mode=login&next='+encodeURIComponent(next)}>Entrar a Latido</Link>}
  </main>
}
