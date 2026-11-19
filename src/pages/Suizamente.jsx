import { useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

// Isolate the reference CSS and full-screen reveal from Latido's global styles.
export default function Suizamente() {
  const frame = useRef(null)
  const { authUser } = useAuth()
  useEffect(() => {
    async function identify(event) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow
        || event.data?.type !== 'suizamente:identity') return
      const { data } = await supabase.auth.getSession()
      if (event.source !== frame.current?.contentWindow) return
      event.source.postMessage({
        type:'suizamente:session', requestId:event.data.requestId,
        token:data.session?.access_token || null, userId:data.session?.user?.id || null,
      }, window.location.origin)
    }
    window.addEventListener('message', identify)
    return () => window.removeEventListener('message', identify)
  }, [])
  return <iframe key={authUser?.id || 'anon'} ref={frame} src="/suizamente/juego.html"
    title="Suizamente, un juego de Latido" allow="clipboard-write; web-share"
    style={{ display:'block', border:0, position:'fixed', inset:0, width:'100%', height:'100dvh', zIndex:30, background:'#fff' }} />
}
export function Suizometro() { return <Suizamente /> }
