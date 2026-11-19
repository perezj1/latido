import { useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { connectSuizamenteSession } from '../lib/suizamenteSessionBridge'

// Isolate the reference CSS and full-screen reveal from Latido's global styles.
export default function Suizamente() {
  const frame = useRef(null)
  const { authUser } = useAuth()
  useEffect(() => connectSuizamenteSession({
    getFrame:() => frame.current?.contentWindow,
    getSession:() => supabase.auth.getSession(),
    api:import.meta.env.PROD && import.meta.env.VITE_SUPABASE_URL
      ? import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '') + '/functions/v1/suizamente-votos'
      : '/api/suizamente',
  }), [])
  return <iframe key={authUser?.id || 'anon'} ref={frame} src="/suizamente/juego.html"
    title="Suizamente, un juego de Latido" allow="clipboard-write; web-share"
    style={{ display:'block', border:0, position:'fixed', inset:0, width:'100%', height:'100dvh', zIndex:30, background:'#fff' }} />
}
export function Suizometro() { return <Suizamente /> }
