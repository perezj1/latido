import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { C, PP } from '../lib/theme'

const GOOGLE_OAUTH_PENDING_KEY = 'latido_google_oauth_pending'

function getSafeNextPath(value) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

function getAuthResponseParams(location) {
  const query = new URLSearchParams(location.search)
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''))

  return {
    accessToken:hash.get('access_token'),
    refreshToken:hash.get('refresh_token'),
    code:query.get('code'),
    error:query.get('error_description')
      || hash.get('error_description')
      || query.get('error')
      || hash.get('error'),
    nextPath:getSafeNextPath(query.get('next')),
  }
}

async function waitForOAuthSession(attempts = 12) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    if (data.session) return data.session
    await new Promise(resolve => window.setTimeout(resolve, 250))
  }
  return null
}

export default function AuthCallback() {
  const location = useLocation()
  const navigate = useNavigate()
  const [errorMessage, setErrorMessage] = useState('')
  const completionRef = useRef(null)

  useEffect(() => {
    let active = true

    const completeGoogleSignIn = async () => {
      const response = getAuthResponseParams(location)
      if (response.error) throw new Error(response.error)

      // First accept a session that may already have been restored from local
      // storage (for example, when returning to an existing PWA window).
      const current = await supabase.auth.getSession()
      if (current.error) throw current.error
      let session = current.data.session

      if (!session && response.accessToken && response.refreshToken) {
        // Backwards-compatible fallback for an implicit OAuth attempt started
        // before the PKCE release reached the installed app.
        const { data, error } = await supabase.auth.setSession({
          access_token:response.accessToken,
          refresh_token:response.refreshToken,
        })
        if (error) throw error
        session = data.session
      } else if (!session && response.code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(response.code)
        if (error) throw error
        session = data.session
      } else if (!session) {
        session = await waitForOAuthSession()
      }

      if (!session?.user) throw new Error('No se pudo recuperar la sesión de Google.')
      window.localStorage.removeItem(GOOGLE_OAUTH_PENDING_KEY)
      return response.nextPath
    }

    if (!completionRef.current) completionRef.current = completeGoogleSignIn()

    completionRef.current
      .then(nextPath => {
        if (active) navigate(nextPath, { replace:true })
      })
      .catch(error => {
        console.error('Google OAuth callback failed:', {
          name:error?.name,
          message:error?.message,
          code:error?.code,
          status:error?.status,
          hasAuthCode:Boolean(getAuthResponseParams(location).code),
          hasImplicitTokens:Boolean(getAuthResponseParams(location).accessToken),
          displayMode:window.matchMedia?.('(display-mode: standalone)').matches ? 'standalone' : 'browser',
        })
        window.localStorage.removeItem(GOOGLE_OAUTH_PENDING_KEY)
        if (active) setErrorMessage('No pudimos completar el acceso con Google. Vuelve a intentarlo.')
      })

    return () => { active = false }
  }, [location, navigate])

  if (errorMessage) {
    return (
      <div style={{ minHeight:'100vh', display:'grid', placeItems:'center', padding:24, background:`linear-gradient(180deg, ${C.bg} 0%, #fff 100%)` }}>
        <div style={{ width:'min(390px, 100%)', padding:24, border:`1px solid ${C.border}`, borderRadius:22, background:'#fff', textAlign:'center', boxShadow:'0 14px 36px rgba(15,23,42,.09)' }}>
          <div style={{ marginBottom:12, fontSize:34 }}>🔐</div>
          <h1 style={{ margin:'0 0 8px', color:C.text, fontFamily:PP, fontSize:20, fontWeight:800 }}>No se pudo completar el acceso</h1>
          <p style={{ margin:'0 0 18px', color:C.mid, fontFamily:PP, fontSize:12, lineHeight:1.6 }}>{errorMessage}</p>
          <button
            type="button"
            onClick={() => navigate('/auth', { replace:true })}
            style={{ width:'100%', minHeight:44, border:0, borderRadius:13, background:C.primary, color:'#fff', fontFamily:PP, fontSize:12, fontWeight:800, cursor:'pointer' }}
          >
            Volver al inicio de sesión
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100vh', display:'grid', placeItems:'center', padding:24, background:`linear-gradient(180deg, ${C.bg} 0%, #fff 100%)` }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:62, height:62, display:'grid', placeItems:'center', margin:'0 auto 15px', borderRadius:20, background:C.primaryLight, fontSize:29 }}>🌎</div>
        <p style={{ margin:'0 0 5px', color:C.text, fontFamily:PP, fontSize:18, fontWeight:800 }}>Conectando tu cuenta</p>
        <p style={{ margin:0, color:C.light, fontFamily:PP, fontSize:11.5 }}>Estamos terminando el acceso con Google…</p>
      </div>
    </div>
  )
}
