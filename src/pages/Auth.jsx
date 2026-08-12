import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { trackAnalyticsEvent } from '../lib/analytics'
import { supabase } from '../lib/supabase'
import { C, PP } from '../lib/theme'
import { Btn, ChevronLeftIcon, ProgressBar, Input, Select } from '../components/UI'
import InterestOptionGrid from '../components/InterestOptionGrid'
import { CANTONS } from '../lib/constants'
import { ONBOARDING_INTEREST_OPTIONS } from '../lib/interests'
import toast from 'react-hot-toast'
import { Icon } from '../lib/icons'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
  || '871031259969-sb41jb8hjfethoilmvps9rlsoj843ovk.apps.googleusercontent.com'
const GOOGLE_IDENTITY_SCRIPT_ID = 'google-identity-services'
const GOOGLE_IDENTITY_SCRIPT_SRC = 'https://accounts.google.com/gsi/client?hl=es'
let googleIdentityScriptPromise = null

function getSafeNextPath(value) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

function loadGoogleIdentityServices() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google)
  if (googleIdentityScriptPromise) return googleIdentityScriptPromise

  googleIdentityScriptPromise = new Promise((resolve, reject) => {
    const finish = () => window.google?.accounts?.id
      ? resolve(window.google)
      : reject(new Error('Google Identity Services did not initialize.'))
    const existing = document.getElementById(GOOGLE_IDENTITY_SCRIPT_ID)

    if (existing) {
      existing.addEventListener('load', finish, { once:true })
      existing.addEventListener('error', () => reject(new Error('Google Identity Services could not be loaded.')), { once:true })
      return
    }

    const script = document.createElement('script')
    script.id = GOOGLE_IDENTITY_SCRIPT_ID
    script.src = GOOGLE_IDENTITY_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.addEventListener('load', finish, { once:true })
    script.addEventListener('error', () => reject(new Error('Google Identity Services could not be loaded.')), { once:true })
    document.head.appendChild(script)
  }).catch(error => {
    googleIdentityScriptPromise = null
    throw error
  })

  return googleIdentityScriptPromise
}

async function createGoogleNonce() {
  if (!window.crypto?.getRandomValues || !window.crypto?.subtle) return { raw:'', hashed:'' }

  const bytes = new Uint8Array(32)
  window.crypto.getRandomValues(bytes)
  const raw = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  const hashed = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  return { raw, hashed }
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6A2 2 0 0 0 13.4 13.4" />
      <path d="M9.9 4.2A10.9 10.9 0 0 1 12 4.1c6.5 0 10 7.9 10 7.9a17.6 17.6 0 0 1-3.4 4.3" />
      <path d="M6.6 6.6C3.7 8.6 2 12 2 12s3.5 7.9 10 7.9a10.7 10.7 0 0 0 4.1-.8" />
    </svg>
  )
}

function PasswordVisibilityButton({ visible, onToggle }) {
  const label = visible ? 'Ocultar contraseña' : 'Mostrar contraseña'

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={visible}
      title={label}
      onClick={onToggle}
      onMouseDown={e => e.preventDefault()}
      style={{
        width:30,
        height:30,
        border:'none',
        borderRadius:10,
        background:'transparent',
        color:C.light,
        cursor:'pointer',
        display:'flex',
        alignItems:'center',
        justifyContent:'center',
        padding:0,
      }}
    >
      {visible ? <EyeOffIcon /> : <EyeIcon />}
    </button>
  )
}

function GoogleAuthButton({ loading, disabled, onCredential, onUnavailable }) {
  const buttonRef = useRef(null)
  const credentialHandlerRef = useRef(onCredential)
  const unavailableHandlerRef = useRef(onUnavailable)
  const [ready, setReady] = useState(false)

  useEffect(() => { credentialHandlerRef.current = onCredential }, [onCredential])
  useEffect(() => { unavailableHandlerRef.current = onUnavailable }, [onUnavailable])

  useEffect(() => {
    let active = true

    const renderGoogleButton = async () => {
      const [{ raw, hashed }, google] = await Promise.all([
        createGoogleNonce(),
        loadGoogleIdentityServices(),
      ])
      if (!active || !buttonRef.current) return

      google.accounts.id.initialize({
        client_id:GOOGLE_CLIENT_ID,
        callback:response => {
          if (response?.credential) credentialHandlerRef.current?.(response.credential, raw)
          else unavailableHandlerRef.current?.()
        },
        nonce:hashed || undefined,
        ux_mode:'popup',
        auto_select:false,
        itp_support:true,
      })

      const width = Math.max(240, Math.min(400, buttonRef.current.clientWidth || 400))
      buttonRef.current.replaceChildren()
      google.accounts.id.renderButton(buttonRef.current, {
        type:'standard',
        theme:'outline',
        size:'large',
        text:'continue_with',
        shape:'rectangular',
        logo_alignment:'left',
        width,
        locale:'es',
      })
      if (active) setReady(true)
    }

    renderGoogleButton().catch(error => {
      console.error('Google Identity Services failed:', error)
      if (active) unavailableHandlerRef.current?.()
    })

    return () => { active = false }
  }, [])

  return (
    <div
      aria-busy={!ready || loading}
      style={{
        width:'100%',
        minHeight:46,
        position:'relative',
        overflow:'hidden',
        pointerEvents:disabled || loading ? 'none' : 'auto',
        opacity:disabled && !loading ? .55 : 1,
      }}
    >
      <div ref={buttonRef} style={{ width:'100%', minHeight:46, display:ready ? 'grid' : 'none', placeItems:'center' }} />
      {(!ready || loading) && (
        <div style={{ minHeight:46, display:'grid', placeItems:'center', border:`1.5px solid ${C.border}`, borderRadius:14, background:'#fff', color:C.mid, fontFamily:PP, fontSize:12, fontWeight:700, boxShadow:'0 3px 10px rgba(15,23,42,.05)' }}>
          {loading ? 'Conectando con Google…' : 'Cargando Google…'}
        </div>
      )}
    </div>
  )
}

function AuthDivider() {
  return (
    <div aria-hidden="true" style={{ display:'flex', alignItems:'center', gap:12, margin:'18px 0', color:C.light }}>
      <span style={{ height:1, flex:1, background:C.border }} />
      <span style={{ fontFamily:PP, fontSize:10, fontWeight:600 }}>o continúa con Google</span>
      <span style={{ height:1, flex:1, background:C.border }} />
    </div>
  )
}

function AuthModeSwitch({ mode, onChange }) {
  const options = [
    { value:'register', label:'Crear cuenta' },
    { value:'login', label:'Iniciar sesión' },
  ]

  return (
    <div
      role="group"
      aria-label="Elige cómo acceder"
      style={{
        position:'relative',
        display:'grid',
        gridTemplateColumns:'repeat(2, minmax(0, 1fr))',
        padding:4,
        marginBottom:26,
        border:`1px solid ${C.border}`,
        borderRadius:16,
        background:'#E8EFF9',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position:'absolute',
          top:4,
          bottom:4,
          left:4,
          width:'calc(50% - 4px)',
          borderRadius:12,
          background:C.primary,
          boxShadow:'0 4px 12px rgba(37,99,235,0.24)',
          transform:mode === 'login' ? 'translateX(100%)' : 'translateX(0)',
          transition:'transform .24s ease',
        }}
      />
      {options.map(option => {
        const active = mode === option.value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            style={{
              position:'relative',
              zIndex:1,
              minWidth:0,
              padding:'10px 8px',
              border:'none',
              borderRadius:12,
              background:'transparent',
              color:active ? '#fff' : C.mid,
              fontFamily:PP,
              fontSize:12,
              fontWeight:700,
              cursor:'pointer',
              transition:'color .2s ease',
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export default function Auth() {
  const { signIn, signInWithGoogle, signUp } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const nextPath = getSafeNextPath(searchParams.get('next'))
  const isPartnerAccess = nextPath.startsWith('/servicios-suiza') || nextPath.startsWith('/colaboradores/')
  const authEntryPoint = isPartnerAccess ? 'partner' : nextPath === '/' ? 'general' : 'protected_route'
  const [mode, setMode] = useState('register')
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [registrationIntent, setRegistrationIntent] = useState('')
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [form, setForm] = useState({ name:'', email:'', password:'', canton:'', languages:[], interests:[] })
  const [errors, setErrors] = useState({})
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const oauthError = queryParams.get('error_description')
      || hashParams.get('error_description')
      || queryParams.get('error')
      || hashParams.get('error')

    if (!oauthError) return

    toast.error('No se pudo iniciar sesión con Google. Inténtalo de nuevo.')
    const cleanUrl = new URL(window.location.href)
    const errorKeys = ['error', 'error_code', 'error_description']
    errorKeys.forEach(key => cleanUrl.searchParams.delete(key))
    cleanUrl.hash = ''
    window.history.replaceState({}, '', `${cleanUrl.pathname}${cleanUrl.search}`)
  }, [])
  const clearFieldError = key => setErrors(prev => {
    if (!prev[key]) return prev
    const next = { ...prev }
    delete next[key]
    return next
  })
  const s = (k, v) => {
    setForm(f => ({ ...f, [k]:v }))
    clearFieldError(k)
  }
  const changeAuthMode = nextMode => {
    setErrors({})
    setMode(nextMode)
  }
  const toggleLang = l => s('languages', form.languages.includes(l) ? form.languages.filter(x => x !== l) : [...form.languages, l])
  const toggleInterest = interest => {
    if (!form.interests.includes(interest) && form.interests.length >= 3) {
      toast('Puedes elegir hasta tres intereses.')
      return
    }
    s(
      'interests',
      form.interests.includes(interest)
        ? form.interests.filter(item => item !== interest)
        : [...form.interests, interest]
    )
  }

  const showErrors = next => {
    setErrors(next)
    const firstKey = Object.keys(next)[0]
    if (firstKey) {
      window.setTimeout(() => {
        document.querySelector(`[data-error-field="${firstKey}"]`)?.scrollIntoView({ behavior:'smooth', block:'center' })
      }, 80)
    }
    return Object.keys(next).length === 0
  }

  const getRegisterStepErrors = targetStep => {
    const next = {}
    if (targetStep === 0) {
      if (!form.name.trim()) next.name = 'Añade tu nombre.'
      if (!form.email.trim()) next.email = 'Añade tu email.'
      else if (!emailPattern.test(form.email.trim())) next.email = 'Introduce un email válido.'
      if (!form.password) next.password = 'Añade una contraseña.'
      else if (form.password.length < 8) next.password = 'La contraseña debe tener al menos 8 caracteres.'
    }
    if (targetStep === 1 && !form.canton) {
      next.canton = 'Selecciona tu cantón.'
    }
    return next
  }

  const validateRegisterStep = () => showErrors(getRegisterStepErrors(step))

  const validateRegisterAll = () => {
    const next = { ...getRegisterStepErrors(0), ...getRegisterStepErrors(1) }
    const valid = showErrors(next)
    if (!valid) {
      if (next.name || next.email || next.password) setStep(0)
      else setStep(1)
    }
    return valid
  }

  const handleLogin = async () => {
    const next = {}
    if (!form.email.trim()) next.email = 'Añade tu email.'
    else if (!emailPattern.test(form.email.trim())) next.email = 'Introduce un email válido.'
    if (!form.password) next.password = 'Añade tu contraseña.'
    if (!showErrors(next)) {
      return
    }

    setLoading(true)
    try {
      const { error } = await signIn({ email: form.email, password: form.password })
      if (error) {
        setErrors({ email:'Email o contraseña incorrectos.', password:'Email o contraseña incorrectos.' })
        toast.error('Email o contraseña incorrectos')
      }
      else {
        trackAnalyticsEvent('login_success', {
          metadata: { method:'email', entry_point:authEntryPoint },
        })
        navigate(nextPath)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleAuth = async (token, nonce) => {
    if (loading || googleLoading) return

    setGoogleLoading(true)
    try {
      const { data, error } = await signInWithGoogle({ token, nonce })
      if (error) {
        toast.error('No se pudo conectar con Google. Inténtalo de nuevo.')
        setGoogleLoading(false)
        return
      }

      trackAnalyticsEvent('login_success', {
        user_id:data?.user?.id || data?.session?.user?.id || null,
        metadata: { method:'google_id_token', entry_point:authEntryPoint },
      })
      navigate(nextPath, { replace:true })
    } catch {
      toast.error('No se pudo conectar con Google. Inténtalo de nuevo.')
      setGoogleLoading(false)
    }
  }

  const handleGoogleUnavailable = () => {
    setGoogleLoading(false)
    toast.error('Google no está disponible ahora. Comprueba la conexión e inténtalo de nuevo.')
  }

  const handleForgot = async () => {
    const next = {}
    if (!form.email.trim()) next.email = 'Introduce tu email.'
    else if (!emailPattern.test(form.email.trim())) next.email = 'Introduce un email válido.'
    if (!showErrors(next)) return
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) {
        toast.error('No se pudo enviar el email. Comprueba la dirección.')
      } else {
        toast.success('¡Email enviado! Revisa tu bandeja de entrada.', { duration: 6000 })
        setMode('login')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (interestsOverride = null, destination = nextPath, intent = 'standard') => {
    if (loading) return
    if (!validateRegisterAll()) return

    setRegistrationIntent(intent)
    setLoading(true)
    try {
      const { data, error } = await signUp({
        email: form.email,
        password: form.password,
        name: form.name,
        canton: form.canton,
        languages:form.languages,
        interests:Array.isArray(interestsOverride) ? interestsOverride : form.interests,
      })

      if (error) {
        const msg = error.message?.toLowerCase() || ''
        const status = error.status || 0

        if (status === 429 || msg.includes('rate limit') || msg.includes('too many') || msg.includes('over_email')) {
          toast.error('Demasiados intentos de registro. Espera 1-2 minutos e inténtalo de nuevo.', { duration: 7000 })
        } else if (msg.includes('database') || msg.includes('saving')) {
          toast.error('Error interno. Intenta de nuevo en unos segundos.')
        } else if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('user_already_exists')) {
          setErrors({ email:'Este email ya está registrado. Inicia sesión.' })
          toast.error('Este email ya está registrado. Inicia sesión.')
        } else if (msg.includes('password') || msg.includes('weak')) {
          setErrors({ password:'La contraseña debe tener al menos 8 caracteres.' })
          toast.error('La contraseña debe tener al menos 8 caracteres.')
        } else if (msg.includes('invalid email')) {
          setErrors({ email:'El email no es válido.' })
          toast.error('El email no es válido.')
        } else {
          toast.error('Error al crear la cuenta. Inténtalo de nuevo.')
        }
        return
      }

      // El perfil se crea automáticamente con el trigger handle_new_user().
      if (!data?.user) {
        toast.error('La cuenta no se pudo crear correctamente. Inténtalo de nuevo.')
        return
      }

      trackAnalyticsEvent('signup_success', {
        user_id:data.user.id,
        metadata: {
          method:'email',
          entry_point:authEntryPoint,
          interest_count:(Array.isArray(interestsOverride) ? interestsOverride : form.interests).length,
          creator_onboarding:intent === 'creator',
        },
      })
      toast.success('¡Cuenta creada! Bienvenido/a')
      navigate(destination)
    } finally {
      setLoading(false)
      setRegistrationIntent('')
    }
  }

  if (mode === 'login') return (
    <div style={{ maxWidth:440, margin:'32px auto 48px', padding:'0 24px' }}>
      <AuthModeSwitch mode={mode} onChange={changeAuthMode} />

      <div style={{ textAlign:'center', marginBottom:28 }}>
        <div style={{ width:60, height:60, background:C.primaryLight, color:C.primary, borderRadius:20, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}><Icon name="world" size={29} /></div>
        <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:24, color:C.text, marginBottom:4 }}>Bienvenido/a</h1>
        <p style={{ fontFamily:PP, fontSize:13, color:C.light }}>Inicia sesión en Latido.ch</p>
      </div>

      {isPartnerAccess && (
        <div style={{ fontFamily:PP, fontSize:12, lineHeight:1.55, color:C.mid, background:C.primaryLight, border:`1px solid ${C.border}`, borderRadius:14, padding:'11px 13px', marginBottom:18 }}>
          Inicia sesión para acceder a la información y los servicios de nuestros colaboradores.
        </div>
      )}

      <Input label="Email" type="email" placeholder="tu@email.com" value={form.email} onChange={e => s('email', e.target.value)} required error={errors.email} errorKey="email" />
      <Input
        label="Contraseña"
        type={showLoginPassword ? 'text' : 'password'}
        placeholder="Tu contraseña"
        value={form.password}
        onChange={e => s('password', e.target.value)}
        required
        error={errors.password}
        errorKey="password"
        rightElement={
          <PasswordVisibilityButton visible={showLoginPassword} onToggle={() => setShowLoginPassword(v => !v)} />
        }
      />

      <div style={{ textAlign:'right', marginBottom:16, marginTop:-8 }}>
        <button onClick={() => { setErrors({}); setMode('forgot') }} style={{ fontFamily:PP, fontSize:11, fontWeight:600, color:C.primary, background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>
          ¿Olvidaste tu contraseña?
        </button>
      </div>

      <Btn onClick={handleLogin} disabled={loading}>{loading ? <><Icon name="loading" size={16} /> Entrando...</> : 'Iniciar sesión'}</Btn>
      <AuthDivider />
      <GoogleAuthButton loading={googleLoading} disabled={loading} onCredential={handleGoogleAuth} onUnavailable={handleGoogleUnavailable} />
    </div>
  )

  if (mode === 'forgot') return (
    <div style={{ maxWidth:440, margin:'60px auto', padding:'0 24px' }}>
      <div style={{ textAlign:'center', marginBottom:28 }}>
        <div style={{ width:60, height:60, background:C.primaryLight, color:C.primary, borderRadius:20, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}><Icon name="lock" size={29} /></div>
        <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:24, color:C.text, marginBottom:4 }}>Recuperar contraseña</h1>
        <p style={{ fontFamily:PP, fontSize:13, color:C.light }}>Te enviaremos un enlace para crear una nueva.</p>
      </div>

      <Input label="Tu email" type="email" placeholder="tu@email.com" value={form.email} onChange={e => s('email', e.target.value)} required error={errors.email} errorKey="email" />

      <Btn onClick={handleForgot} disabled={loading}>{loading ? <><Icon name="loading" size={16} /> Enviando...</> : 'Enviar enlace'}</Btn>

      <p style={{ fontFamily:PP, fontSize:12, color:C.mid, textAlign:'center', marginTop:14 }}>
        <button onClick={() => { setErrors({}); setMode('login') }} style={{ display:'inline-flex', alignItems:'center', gap:4, fontFamily:PP, fontWeight:700, fontSize:12, color:C.primary, background:'none', border:'none', cursor:'pointer' }}>
          <ChevronLeftIcon size={15} /> Volver al inicio de sesión
        </button>
      </p>
    </div>
  )

  const REG_STEPS = [
    { title:'Crea tu cuenta', sub:'Gratis · Sin spam · Sin comisiones' },
    { title:'¿Dónde estás en Suiza?', sub:'Para mostrarte anuncios cercanos primero' },
    { title:'¿Qué buscas en Latido?', sub:'Elige hasta tres para personalizar tu inicio' },
  ]

  return (
    <div style={{ maxWidth:440, margin:'32px auto 48px', padding:'0 24px' }}>
      <AuthModeSwitch mode={mode} onChange={changeAuthMode} />

      <ProgressBar step={step} total={REG_STEPS.length} />
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:C.text, marginBottom:4 }}>{REG_STEPS[step].title}</h1>
      <p style={{ fontFamily:PP, fontSize:12, color:C.light, marginBottom:22 }}>{REG_STEPS[step].sub}</p>

      {isPartnerAccess && step === 0 && (
        <div style={{ fontFamily:PP, fontSize:12, lineHeight:1.55, color:C.mid, background:C.primaryLight, border:`1px solid ${C.border}`, borderRadius:14, padding:'11px 13px', marginBottom:18 }}>
          Crea tu cuenta gratuita para acceder a la información y los servicios de nuestros colaboradores.
        </div>
      )}

      {step === 0 && (
        <>
          <Input label="Nombre completo" placeholder="María García" required value={form.name} onChange={e => s('name', e.target.value)} error={errors.name} errorKey="name" />
          <Input label="Email" type="email" placeholder="tu@email.com" required value={form.email} onChange={e => s('email', e.target.value)} error={errors.email} errorKey="email" />
          <Input
            label="Contraseña"
            type={showRegisterPassword ? 'text' : 'password'}
            placeholder="Mínimo 8 caracteres"
            required
            value={form.password}
            onChange={e => s('password', e.target.value)}
            error={errors.password}
            errorKey="password"
            rightElement={
              <PasswordVisibilityButton visible={showRegisterPassword} onToggle={() => setShowRegisterPassword(v => !v)} />
            }
          />
          <p style={{ fontFamily:PP, fontSize:10, color:C.light, marginBottom:14, lineHeight:1.5 }}>
            Al registrarte aceptas los <Link to="/terminos" style={{ color:C.primary }}>términos de uso</Link> y confirmas que has leído la <Link to="/privacidad" style={{ color:C.primary }}>política de privacidad</Link> y la <Link to="/cookies" style={{ color:C.primary }}>política de cookies</Link>.
          </p>
        </>
      )}

      {step === 1 && (
        <>
          <Select label="Tu cantón" required value={form.canton} onChange={e => s('canton', e.target.value)} error={errors.canton} errorKey="canton">
            <option value="">Seleccionar cantón...</option>
            {CANTONS.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
          </Select>
          <div style={{ background:C.bg, borderRadius:12, padding:'11px 13px', marginBottom:14 }}>
            <p style={{ display:'flex', alignItems:'flex-start', gap:6, fontFamily:PP, fontSize:11, color:C.mid, margin:0, lineHeight:1.55 }}>
              <Icon name="location" size={14} style={{ marginTop:1 }} /> <span>Usamos tu cantón para mostrarte los anuncios más cercanos primero. Puedes cambiarlo en tu perfil.</span>
            </p>
          </div>
          <div style={{ marginBottom:14 }}>
            <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, marginBottom:10 }}>IDIOMAS QUE HABLAS</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {['Español','Alemán','Francés','Italiano','Inglés','Portugués'].map(l => (
                <button
                  key={l}
                  onClick={() => toggleLang(l)}
                  style={{ fontFamily:PP, fontSize:11, fontWeight:600, padding:'6px 14px', borderRadius:20, border:`1.5px solid ${form.languages.includes(l) ? C.primary : C.border}`, background:form.languages.includes(l) ? C.primary : '#fff', color:form.languages.includes(l) ? '#fff' : C.mid, cursor:'pointer' }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, margin:'0 0 9px', letterSpacing:0.5 }}>
            {form.interests.length}/3 SELECCIONADOS
          </p>
          <InterestOptionGrid
            options={ONBOARDING_INTEREST_OPTIONS}
            selectedIds={form.interests}
            onToggle={toggleInterest}
            style={{ marginBottom:12 }}
          />
          <section style={{ display:'grid', gridTemplateColumns:'auto minmax(0,1fr)', gap:11, margin:'4px 0 14px', padding:'14px', background:'#fff', border:`1.5px solid ${C.primaryMid}`, borderRadius:16, boxShadow:'0 6px 18px rgba(37,99,235,.07)' }}>
            <span aria-hidden="true" style={{ display:'grid', width:42, height:42, placeItems:'center', background:C.primaryLight, color:C.primary, borderRadius:13 }}><Icon name="creator" size={22} /></span>
            <div style={{ minWidth:0 }}>
              <strong style={{ display:'block', color:C.text, fontFamily:PP, fontSize:12.5, lineHeight:1.4 }}>¿Eres creador de contenido?</strong>
              <p style={{ margin:'4px 0 10px', color:C.mid, fontFamily:PP, fontSize:10.5, lineHeight:1.6 }}>
                Si tienes redes sociales donde hablas de Suiza y quieres llegar a más personas, crea tu perfil de creador en Latido.
              </p>
              <button
                type="button"
                onClick={() => handleRegister(null, '/creadores/alta?from=onboarding', 'creator')}
                disabled={loading}
                style={{ minHeight:38, padding:'0 13px', color:'#fff', background:C.primary, border:0, borderRadius:11, fontFamily:PP, fontSize:10.5, fontWeight:800, cursor:loading ? 'default' : 'pointer', opacity:loading && registrationIntent !== 'creator' ? .55 : 1 }}
              >
                {loading && registrationIntent === 'creator' ? 'Creando tu cuenta…' : 'Crear perfil de creador'}
              </button>
              <small style={{ display:'block', marginTop:7, color:C.light, fontFamily:PP, fontSize:8.5, lineHeight:1.45 }}>Primero crearemos tu cuenta y después completarás el perfil.</small>
            </div>
          </section>
          <p style={{ fontFamily:PP, fontSize:10, color:C.light, margin:'0 0 18px', lineHeight:1.55 }}>
            Es opcional. Podrás cambiar estos intereses cuando quieras desde tu perfil.
          </p>
        </>
      )}

      <div style={{ display:'flex', gap:10 }}>
        {step > 0 && <Btn onClick={() => setStep(s => s - 1)} variant="secondary" style={{ flex:'0 0 100px' }}><ChevronLeftIcon size={16} /> Atrás</Btn>}
        {step < REG_STEPS.length - 1 ? (
          <Btn onClick={() => { if (!validateRegisterStep()) return; setStep(current => current + 1) }} style={{ flex:1 }}>
            Continuar →
          </Btn>
        ) : (
          <Btn onClick={() => handleRegister()} disabled={loading} style={{ flex:1 }}>
            {loading ? <><Icon name="loading" size={16} /> Creando cuenta...</> : 'Crear cuenta gratis'}
          </Btn>
        )}
      </div>

      {step === 0 && (
        <>
          <AuthDivider />
          <GoogleAuthButton loading={googleLoading} disabled={loading} onCredential={handleGoogleAuth} onUnavailable={handleGoogleUnavailable} />
        </>
      )}

      {step === 2 && (
        <button
          type="button"
          onClick={() => handleRegister([])}
          disabled={loading}
          style={{ width:'100%', fontFamily:PP, fontSize:11, fontWeight:700, color:C.mid, background:'transparent', border:'none', padding:'11px 0 4px', cursor:loading ? 'default' : 'pointer' }}
        >
          Omitir por ahora
        </button>
      )}
    </div>
  )
}
