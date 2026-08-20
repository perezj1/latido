import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, ChevronLeft } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { trackAnalyticsEvent } from '../lib/analytics'
import { supabase } from '../lib/supabase'
import { C, PP } from '../lib/theme'
import { Btn, ChevronLeftIcon, Input, Select } from '../components/UI'
import InterestOptionGrid from '../components/InterestOptionGrid'
import { CANTONS } from '../lib/constants'
import { ONBOARDING_INTEREST_OPTIONS } from '../lib/interests'
import { getGooglePostAuthPath } from '../lib/oauthOnboarding'
import toast from 'react-hot-toast'
import './Auth.css'

const GOOGLE_AUTH_ENABLED = true
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
  || '871031259969-sb41jb8hjfethoilmvps9rlsoj843ovk.apps.googleusercontent.com'
const GOOGLE_IDENTITY_SCRIPT_ID = 'google-identity-services'
const GOOGLE_IDENTITY_SCRIPT_SRC = 'https://accounts.google.com/gsi/client?hl=es'
let googleIdentityScriptPromise = null

function getSafeNextPath(value) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

function getGoogleAuthErrorMessage(error) {
  const detail = String(error?.message || error?.code || '').trim()
  return detail
    ? `Google: ${detail.slice(0, 180)}`
    : 'No se pudo conectar con Google. Inténtalo de nuevo.'
}

function isStandalonePwa() {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true
    || document.referrer.startsWith('android-app://')
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
  const raw = window.btoa(String.fromCharCode(...bytes))
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

function GoogleIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.61Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.19l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.96 10.7A5.42 5.42 0 0 1 3.68 9c0-.59.1-1.16.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.03l3-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58A8.64 8.64 0 0 0 9 0 9 9 0 0 0 .96 4.97l3 2.33C4.67 5.17 6.66 3.58 9 3.58Z" />
    </svg>
  )
}

const GOOGLE_BUTTON_HEIGHT = 46

function getGoogleButtonStyle({ disabled=false, loading=false } = {}) {
  return {
    width:'100%',
    minHeight:GOOGLE_BUTTON_HEIGHT,
    display:'flex',
    alignItems:'center',
    justifyContent:'center',
    gap:11,
    padding:'0 18px',
    border:`1.5px solid ${C.border}`,
    borderRadius:14,
    background:'#fff',
    color:C.text,
    fontFamily:PP,
    fontSize:13,
    fontWeight:700,
    cursor:disabled || loading ? 'default' : 'pointer',
    opacity:disabled && !loading ? .55 : 1,
    boxShadow:'0 3px 10px rgba(15,23,42,.05)',
  }
}

function GoogleButtonContent({ loading=false, pending=false }) {
  return (
    <>
      <GoogleIcon />
      {loading ? 'Conectando con Google…' : pending ? 'Cargando Google…' : 'Continuar con Google'}
    </>
  )
}

function GoogleRedirectButton({ loading, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      style={getGoogleButtonStyle({ disabled, loading })}
    >
      <GoogleButtonContent loading={loading} />
    </button>
  )
}

function GooglePwaAuthButton({ loading, disabled, onCredential, onUnavailable }) {
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
        // Google never personalizes medium/small buttons, so this keeps the
        // neutral "Continuar con Google" appearance instead of an account bar.
        size:'medium',
        text:'continue_with',
        shape:'rectangular',
        logo_alignment:'left',
        width,
        locale:'es',
      })

      // Keep Google's working credential surface, but stretch its hit area to
      // the same height as the visible Latido button underneath it.
      window.requestAnimationFrame(() => {
        const surface = buttonRef.current?.firstElementChild
        const renderedHeight = surface?.getBoundingClientRect().height || 0
        if (!surface || !renderedHeight) return
        surface.style.transformOrigin = 'top left'
        surface.style.transform = `scaleY(${GOOGLE_BUTTON_HEIGHT / renderedHeight})`
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
        height:GOOGLE_BUTTON_HEIGHT,
        position:'relative',
        overflow:'hidden',
        pointerEvents:disabled || loading ? 'none' : 'auto',
        opacity:disabled && !loading ? .55 : 1,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          ...getGoogleButtonStyle(),
          height:GOOGLE_BUTTON_HEIGHT,
          color:!ready || loading ? C.mid : C.text,
          cursor:disabled || loading ? 'default' : 'pointer',
        }}
      >
        <GoogleButtonContent loading={loading} pending={!ready} />
      </div>
      <div
        ref={buttonRef}
        style={{
          position:'absolute',
          inset:0,
          zIndex:2,
          width:'100%',
          height:GOOGLE_BUTTON_HEIGHT,
          overflow:'hidden',
          opacity:ready && !loading ? .001 : 0,
          pointerEvents:ready && !loading ? 'auto' : 'none',
        }}
      />
    </div>
  )
}

function GoogleAuthButton({ pwa, ...props }) {
  return pwa
    ? <GooglePwaAuthButton {...props} />
    : <GoogleRedirectButton loading={props.loading} disabled={props.disabled} onClick={props.onRedirect} />
}

function AuthDivider() {
  return (
    <div className="latido-auth-divider" aria-hidden="true" style={{ display:'flex', alignItems:'center', gap:12, margin:'18px 0', color:C.light }}>
      <span style={{ height:1, flex:1, background:C.border }} />
      <span style={{ fontFamily:PP, fontSize:10, fontWeight:700, letterSpacing:.3 }}>O</span>
      <span style={{ height:1, flex:1, background:C.border }} />
    </div>
  )
}

const ONBOARDING_SLIDES = [
  {
    id:'directorio',
    emoji:'🏪',
    title:'Negocios y profesionales',
    body:'',
    accent:'sky',
    points:[
      {
        emoji:'🔍',
        label:'Encuentra:',
        text:'un restaurante, una peluquería, un abogado o un mecánico que te atienda en español, cerca de casa.',
      },
      {
        emoji:'✨',
        label:'Publica:',
        text:'tu negocio o tus servicios para darlos a conocer y llegar a más personas totalmente gratis.',
      },
    ],
  },
  {
    id:'oportunidades',
    emoji:'📣',
    title:'Anuncios, empleos y más',
    body:'',
    accent:'violet',
    points:[
      {
        emoji:'🔍',
        label:'Encuentra:',
        text:'ofertas de empleo, vivienda, artículos de segunda mano o un servicio puntual cerca de ti.',
      },
      {
        emoji:'✨',
        label:'Publica:',
        text:'artículos de segunda mano, una oportunidad de trabajo, una habitación libre o cualquier otra oferta.',
      },
    ],
  },
  {
    id:'comunidad',
    emoji:'🎙️',
    title:'Creadores y comunidad',
    body:'',
    accent:'mint',
    points:[
      {
        emoji:'🔍',
        label:'Encuentra:',
        text:'el grupo de hispanohablantes de tu ciudad, la fiesta del sábado o el vídeo que te explica el permiso B sin marearte.',
      },
      {
        emoji:'✨',
        label:'Publica:',
        text:'tu contenido y añade tus redes sociales a tu perfil de creador para llegar a más personas.',
      },
    ],
  },
]

const WELCOME_SLIDES = [
  {
    id:'latido',
    intro:true,
    title:'El punto de encuentro de la comunidad hispanohablante en Suiza.',
    body:'Aquí unos encuentran lo que necesitan y otros dan a conocer lo que ofrecen.',
  },
  ...ONBOARDING_SLIDES,
]

// Estructura común de todas las pantallas del flujo: cabecera, zona azul
// (héroe o carrusel) y hoja blanca inferior con la acción principal.
function AuthFlowScreen({ variant, hero, dots=null, onBack, backTo, backLabel='Volver', onSkip, skipLabel='Saltar', children }) {
  return (
    <section className={`latido-auth-flow latido-auth-flow--${variant}`}>
      <div className="latido-auth-flow__orb latido-auth-flow__orb--one" aria-hidden="true" />
      <div className="latido-auth-flow__orb latido-auth-flow__orb--two" aria-hidden="true" />

      <header className="latido-auth-flow__topbar">
        {backTo ? (
          <Link to={backTo} className="latido-auth-pill" aria-label="Volver a Latido">
            <ChevronLeft size={16} aria-hidden="true" />
            {backLabel}
          </Link>
        ) : onBack ? (
          <button type="button" className="latido-auth-pill" onClick={onBack} aria-label="Volver">
            <ChevronLeft size={16} aria-hidden="true" />
            {backLabel}
          </button>
        ) : <span aria-hidden="true" />}
        {onSkip
          ? <button type="button" className="latido-auth-flow__skip" onClick={onSkip}>{skipLabel}</button>
          : <span aria-hidden="true" />}
      </header>

      {hero}
      {dots}

      <div className="latido-auth-flow__sheet">
        <div className="latido-auth-flow__sheet-inner">
          {children}
        </div>
      </div>
    </section>
  )
}

function AuthFlowDots({ total, active, label, onSelect }) {
  return (
    <div className="latido-auth-flow__dots" role="group" aria-label={label}>
      {Array.from({ length:total }, (_, index) => (
        onSelect ? (
          <button
            key={index}
            type="button"
            className={index === active ? 'is-active' : ''}
            onClick={() => onSelect(index)}
            aria-label={`Ver pantalla ${index + 1} de ${total}`}
            aria-current={index === active ? 'true' : undefined}
          />
        ) : (
          <span key={index} className={index === active ? 'is-active' : ''} />
        )
      ))}
    </div>
  )
}

function AuthSlidesCarousel() {
  const scrollerRef = useRef(null)
  const [activeSlide, setActiveSlide] = useState(0)
  const lastSlide = WELCOME_SLIDES.length - 1

  const goToSlide = index => {
    const targetIndex = Math.max(0, Math.min(lastSlide, index))
    const scroller = scrollerRef.current
    const slide = scroller?.children[targetIndex]
    if (!scroller || !slide) return

    const left = slide.offsetLeft - scroller.offsetLeft - (scroller.clientWidth - slide.clientWidth) / 2
    scroller.scrollTo({ left, behavior:'smooth' })
    setActiveSlide(targetIndex)
  }

  const handleScroll = event => {
    const scroller = event.currentTarget
    const center = scroller.scrollLeft + scroller.clientWidth / 2
    let closestIndex = 0
    let closestDistance = Number.POSITIVE_INFINITY

    Array.from(scroller.children).forEach((slide, index) => {
      const slideCenter = slide.offsetLeft - scroller.offsetLeft + slide.clientWidth / 2
      const distance = Math.abs(center - slideCenter)
      if (distance < closestDistance) {
        closestDistance = distance
        closestIndex = index
      }
    })
    setActiveSlide(closestIndex)
  }

  return (
    <div className="latido-auth-welcome-carousel">
      <div
        className="latido-auth-story__scroller"
        ref={scrollerRef}
        onScroll={handleScroll}
        role="region"
        aria-roledescription="carrusel"
        aria-label="Información sobre Latido"
        tabIndex={0}
        onKeyDown={event => {
          if (event.key === 'ArrowLeft') goToSlide(activeSlide - 1)
          if (event.key === 'ArrowRight') goToSlide(activeSlide + 1)
        }}
      >
        {WELCOME_SLIDES.map(({ id, intro, emoji, title, body, points=[], accent }) => (
          intro ? (
            <article className="latido-auth-story__slide latido-auth-story__slide--intro" key={id}>
              <div className="latido-auth-flow__logo">
                <img src="/apple-touch-icon-180.png" alt="Logo de Latido" />
              </div>
              <p className="latido-auth-story__wordmark">Latido</p>
              <h2>{title}</h2>
              <p className="latido-auth-story__intro-copy">{body}</p>
            </article>
          ) : (
            <article className={`latido-auth-story__slide latido-auth-story__slide--${accent}`} key={id}>
              <span className="latido-auth-story__slide-emoji" aria-hidden="true">{emoji}</span>
              <h2>{title}</h2>
              {body && <p>{body}</p>}
              <div className="latido-auth-story__points">
                {points.map(point => (
                  <div className="latido-auth-story__point" key={point.label}>
                    <span aria-hidden="true">{point.emoji}</span>
                    <p><strong>{point.label}</strong> {point.text}</p>
                  </div>
                ))}
              </div>
            </article>
          )
        ))}
      </div>
      <AuthFlowDots
        total={WELCOME_SLIDES.length}
        active={activeSlide}
        label={`Pantalla ${activeSlide + 1} de ${WELCOME_SLIDES.length}`}
        onSelect={goToSlide}
      />
      <p className="latido-auth-story__hint">
        Desliza
        <ArrowRight size={13} aria-hidden="true" />
      </p>
    </div>
  )
}

function AuthWelcome({
  onChoose,
  googleAuthVisible,
  pwa,
  loading,
  googleLoading,
  onGoogleRedirect,
  onGoogleCredential,
  onGoogleUnavailable,
}) {
  return (
    <AuthFlowScreen
      variant="welcome"
      backTo="/"
      hero={<AuthSlidesCarousel />}
    >
      <button type="button" className="latido-auth-flow__primary" onClick={() => onChoose('register')}>
        Crear cuenta gratis
      </button>
      <button type="button" className="latido-auth-flow__secondary" onClick={() => onChoose('login')}>
        Ya tengo cuenta
      </button>
      {googleAuthVisible && (
        <>
          <AuthDivider />
          <GoogleAuthButton
            pwa={pwa}
            loading={googleLoading}
            disabled={loading}
            onRedirect={onGoogleRedirect}
            onCredential={onGoogleCredential}
            onUnavailable={onGoogleUnavailable}
          />
        </>
      )}
      <p className="latido-auth-flow__note">Únete gratis · Sin spam · Sin comisiones</p>
    </AuthFlowScreen>
  )
}

// `onBack` pinta la píldora "Volver" de la cabecera. Las pantallas que ya
// tienen su propio botón "Atrás" abajo lo omiten para no duplicar la acción.
function AuthFormScreen({ onBack, variant='', children }) {
  return (
    <section className={`latido-auth-form-screen${variant ? ` latido-auth-form-screen--${variant}` : ''}`}>
      {onBack && (
        <header className="latido-auth-form-screen__topbar">
          <button type="button" onClick={onBack} aria-label="Volver">
            <ChevronLeft size={17} aria-hidden="true" />
            Volver
          </button>
        </header>
      )}
      <main className="latido-auth-form-screen__content">
        {children}
      </main>
    </section>
  )
}
export default function Auth() {
  const { signIn, signInWithGoogle, signInWithGoogleIdToken, signUp } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const nextPath = getSafeNextPath(searchParams.get('next'))
  const [pwa] = useState(() => isStandalonePwa())
  const isPartnerAccess = nextPath.startsWith('/servicios-suiza') || nextPath.startsWith('/colaboradores/')
  const authEntryPoint = isPartnerAccess ? 'partner' : nextPath === '/' ? 'general' : 'protected_route'
  const [mode, setMode] = useState(() => {
    const requestedMode = searchParams.get('mode')
    if (requestedMode === 'login' || requestedMode === 'register') return requestedMode
    if (searchParams.get('oauth') === 'google' || searchParams.get('password') === 'updated') return 'login'
    return 'welcome'
  })
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showPasswordRecoveryHint, setShowPasswordRecoveryHint] = useState(false)
  const [registrationIntent, setRegistrationIntent] = useState('')
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [form, setForm] = useState({ name:'', email:'', password:'', canton:'', languages:[], interests:[] })
  const [errors, setErrors] = useState({})
  const passwordNoticeShownRef = useRef(false)
  const googleAuthVisible = GOOGLE_AUTH_ENABLED
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  useEffect(() => {
    const requestedMode = searchParams.get('mode')
    const routeMode = requestedMode === 'login' || requestedMode === 'register'
      ? requestedMode
      : searchParams.get('oauth') === 'google' || searchParams.get('password') === 'updated'
        ? 'login'
        : 'welcome'

    setMode(currentMode => currentMode === 'forgot' && routeMode === 'login' ? currentMode : routeMode)
  }, [searchParams])

  useEffect(() => {
    if (searchParams.get('password') !== 'updated' || passwordNoticeShownRef.current) return
    passwordNoticeShownRef.current = true
    toast.success('Contraseña creada. Ya puedes entrar también desde la PWA.')
    const cleanUrl = new URL(window.location.href)
    cleanUrl.searchParams.delete('password')
    window.history.replaceState({}, '', `${cleanUrl.pathname}${cleanUrl.search}`)
  }, [searchParams])

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const oauthError = queryParams.get('error_description')
      || hashParams.get('error_description')
      || queryParams.get('error')
      || hashParams.get('error')

    if (!oauthError) return

    console.error('Google OAuth callback error:', oauthError)
    toast.error(getGoogleAuthErrorMessage(new Error(oauthError)))
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
    if (k === 'email' || k === 'password') setShowPasswordRecoveryHint(false)
  }
  const changeAuthMode = nextMode => {
    setErrors({})
    setShowPasswordRecoveryHint(false)
    setStep(0)
    setMode(nextMode)
    const nextParams = new URLSearchParams(searchParams)
    if (nextMode === 'login' || nextMode === 'register') nextParams.set('mode', nextMode)
    else {
      nextParams.delete('mode')
      nextParams.delete('oauth')
      nextParams.delete('password')
    }
    setSearchParams(nextParams, { replace:false })
  }
  const toggleLang = language => s(
    'languages',
    form.languages.includes(language)
      ? form.languages.filter(item => item !== language)
      : [...form.languages, language]
  )
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
    if (targetStep === 1 && !form.canton) next.canton = 'Selecciona tu cantón.'
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
      const { data, error } = await signIn({ email: form.email, password: form.password })
      if (error) {
        const errorCode = String(error.code || '').toLowerCase()
        const errorMessage = String(error.message || '').toLowerCase()
        const invalidCredentials = errorCode === 'invalid_credentials'
          || errorMessage.includes('invalid login credentials')

        if (invalidCredentials) {
          setErrors({ email:'Email o contraseña incorrectos.', password:'Email o contraseña incorrectos.' })
          setShowPasswordRecoveryHint(true)
          toast.error('Email o contraseña incorrectos')
        } else if (errorCode === 'email_not_confirmed' || errorMessage.includes('email not confirmed')) {
          setErrors({ email:'Confirma primero tu email para poder entrar.' })
          toast.error('Confirma primero tu email para poder entrar.')
        } else {
          toast.error('No se pudo conectar con el servicio de acceso. Comprueba tu conexión e inténtalo de nuevo.')
        }
      }
      else if (data?.session?.user) {
        const { data:persisted, error:persistError } = await supabase.auth.setSession({
          access_token:data.session.access_token,
          refresh_token:data.session.refresh_token,
        })
        if (persistError || !persisted.session?.user) {
          console.error('Email session persistence failed:', persistError)
          toast.error('No se pudo guardar la sesión. Inténtalo de nuevo.')
          return
        }
        setShowPasswordRecoveryHint(false)
        trackAnalyticsEvent('login_success', {
          metadata: { method:'email', entry_point:authEntryPoint },
        })
        navigate(nextPath, { replace:true })
      } else {
        toast.error('No se pudo guardar la sesión. Inténtalo de nuevo.')
      }
    } catch (error) {
      console.error('Email sign-in failed:', error)
      toast.error('No se pudo conectar con el servicio de acceso. Comprueba tu conexión e inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const beginGoogleRedirect = async () => {
    const callbackUrl = new URL('/auth', window.location.origin)
    callbackUrl.searchParams.set('next', nextPath)
    callbackUrl.searchParams.set('oauth', 'google')

    const { error } = await signInWithGoogle({ redirectTo:callbackUrl.toString() })
    if (error) throw error
  }

  const handleGoogleRedirect = async () => {
    if (loading || googleLoading) return

    setGoogleLoading(true)
    try {
      await beginGoogleRedirect()
    } catch (error) {
      console.error('Google OAuth redirect failed:', error)
      toast.error(getGoogleAuthErrorMessage(error))
      setGoogleLoading(false)
    }
  }

  const retryGoogleWithRedirect = async error => {
    console.error('Google ID-token access failed; retrying with OAuth redirect:', {
      code:error?.code,
      status:error?.status,
      message:error?.message,
    })
    toast('Reintentando el acceso seguro con Google…')
    await beginGoogleRedirect()
  }

  const handleGoogleCredential = async (token, nonce) => {
    if (loading || googleLoading) return

    setGoogleLoading(true)
    try {
      const { data, error } = await signInWithGoogleIdToken({ token, nonce })
      if (error) {
        await retryGoogleWithRedirect(error)
        return
      }

      if (!data?.session?.user) {
        await retryGoogleWithRedirect(new Error('Google did not return a session.'))
        return
      }

      const { data:persisted, error:persistError } = await supabase.auth.setSession({
        access_token:data.session.access_token,
        refresh_token:data.session.refresh_token,
      })
      if (persistError || !persisted.session?.user) {
        await retryGoogleWithRedirect(persistError || new Error('Google session could not be persisted.'))
        return
      }

      trackAnalyticsEvent('login_success', {
        user_id:persisted.session.user.id,
        metadata: { method:'google_id_token', entry_point:authEntryPoint },
      })
      navigate(getGooglePostAuthPath(persisted.session.user, nextPath), { replace:true })
    } catch (error) {
      console.error('Google ID token sign-in failed:', error)
      toast.error(getGoogleAuthErrorMessage(error))
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleGoogleUnavailable = async () => {
    if (loading || googleLoading) return
    setGoogleLoading(true)
    try {
      await retryGoogleWithRedirect(new Error('Google Identity Services is unavailable.'))
    } catch (error) {
      console.error('Google fallback redirect failed:', error)
      toast.error(getGoogleAuthErrorMessage(error))
      setGoogleLoading(false)
    }
  }

  const handleForgot = async () => {
    const next = {}
    if (!form.email.trim()) next.email = 'Introduce tu email.'
    else if (!emailPattern.test(form.email.trim())) next.email = 'Introduce un email válido.'
    if (!showErrors(next)) return
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(form.email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) {
        toast.error('No se pudo enviar el email. Comprueba la dirección.')
      } else {
        toast.success('¡Email enviado! Revisa tu bandeja de entrada y spam.', { duration: 6000 })
        setMode('login')
      }
    } catch (error) {
      console.error('Password recovery request failed:', error)
      toast.error('No se pudo enviar el email. Comprueba tu conexión e inténtalo de nuevo.')
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

      if (!data.session?.user) {
        setMode('login')
        setStep(0)
        setShowPasswordRecoveryHint(true)
        const nextParams = new URLSearchParams(searchParams)
        nextParams.set('mode', 'login')
        setSearchParams(nextParams, { replace:true })
        toast('No se inició sesión. Si ya usaste Google, entra con Google o crea una contraseña. Si es una cuenta nueva, revisa tu email.', { duration:8000 })
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
      toast.success('¡Cuenta creada! Bienvenido/a 🎉')
      navigate(destination)
    } finally {
      setLoading(false)
      setRegistrationIntent('')
    }
  }

  if (mode === 'welcome') return (
    <AuthWelcome
      onChoose={changeAuthMode}
      googleAuthVisible={googleAuthVisible}
      pwa={pwa}
      loading={loading}
      googleLoading={googleLoading}
      onGoogleRedirect={handleGoogleRedirect}
      onGoogleCredential={handleGoogleCredential}
      onGoogleUnavailable={handleGoogleUnavailable}
    />
  )

  if (mode === 'login') return (
    <AuthFormScreen onBack={() => changeAuthMode('welcome')}>
      <header className="latido-auth-sheet-heading">
        <h1>Hola de nuevo</h1>
        <p>Entra y sigue donde lo dejaste.</p>
      </header>
      {isPartnerAccess && (
        <p className="latido-auth-notice">
          Inicia sesión para acceder a la información y los servicios de nuestros colaboradores.
        </p>
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

      {showPasswordRecoveryHint && (
        <div style={{ margin:'0 0 16px', padding:'12px 13px', border:`1px solid ${C.primaryMid}`, borderRadius:14, background:C.primaryLight, color:C.mid, fontFamily:PP, fontSize:11, lineHeight:1.55 }}>
          <strong style={{ display:'block', marginBottom:3, color:C.text }}>¿Creaste esta cuenta con Google?</strong>
          Esa cuenta todavía no tiene contraseña. Puedes entrar con Google o crear una contraseña para acceder también con email desde la PWA.
          <button
            type="button"
            onClick={() => { setErrors({}); setShowPasswordRecoveryHint(false); setMode('forgot') }}
            style={{ display:'block', marginTop:7, padding:0, border:0, background:'transparent', color:C.primary, fontFamily:PP, fontSize:11, fontWeight:800, cursor:'pointer', textDecoration:'underline' }}
          >
            Crear una contraseña
          </button>
        </div>
      )}

      <Btn onClick={handleLogin} loading={loading}>Entrar →</Btn>
      {googleAuthVisible && (
        <>
          <AuthDivider />
          <GoogleAuthButton
            pwa={pwa}
            loading={googleLoading}
            disabled={loading}
            onRedirect={handleGoogleRedirect}
            onCredential={handleGoogleCredential}
            onUnavailable={handleGoogleUnavailable}
          />
        </>
      )}

      <p className="latido-auth-flow__switch">
        ¿Aún no tienes cuenta?{' '}
        <button type="button" onClick={() => changeAuthMode('register')}>Créala gratis</button>
      </p>
    </AuthFormScreen>
  )

  if (mode === 'forgot') return (
    <AuthFormScreen onBack={() => setMode('login')}>
      <header className="latido-auth-sheet-heading">
        <h1>Nueva contraseña</h1>
        <p>Te enviaremos un enlace para crear una nueva. También funciona con cuentas creadas mediante Google.</p>
      </header>
      <Input label="Tu email" type="email" placeholder="tu@email.com" value={form.email} onChange={e => s('email', e.target.value)} required error={errors.email} errorKey="email" />

      <Btn onClick={handleForgot} loading={loading}>Enviar enlace</Btn>

      <p style={{ fontFamily:PP, fontSize:12, color:C.mid, textAlign:'center', marginTop:14 }}>
        <button onClick={() => { setErrors({}); setMode('login') }} style={{ display:'inline-flex', alignItems:'center', gap:4, fontFamily:PP, fontWeight:700, fontSize:12, color:C.primary, background:'none', border:'none', cursor:'pointer' }}>
          <ChevronLeftIcon size={15} /> Volver al inicio de sesión
        </button>
      </p>
    </AuthFormScreen>
  )

  const registerSteps = [
    { title:'Crea tu cuenta', body:'Gratis · Sin spam · Sin comisiones' },
    { title:'¿Dónde estás en Suiza?', body:'Para mostrarte primero los anuncios más cercanos' },
    { title:'¿Qué buscas en Latido?', body:'Elige hasta tres opciones para personalizar tu inicio' },
  ]

  const goBackFromRegister = () => {
    setErrors({})
    if (step > 0) {
      setStep(current => current - 1)
      return
    }
    changeAuthMode('welcome')
  }

  return (
    <AuthFormScreen variant="register">
      <div className="latido-auth-register-progress" aria-label={`Paso ${step + 1} de 3`}>
        <div className="latido-auth-register-progress__segments" aria-hidden="true">
          {registerSteps.map((item, index) => <span className={index <= step ? 'is-active' : ''} key={item.title} />)}
        </div>
        <span>Paso {step + 1} de 3</span>
      </div>

      <header className="latido-auth-sheet-heading">
        <h1>{registerSteps[step].title}</h1>
        <p>{registerSteps[step].body}</p>
      </header>

      {isPartnerAccess && step === 0 && (
        <p className="latido-auth-notice">
          Crea tu cuenta gratuita para acceder a la información y los servicios de nuestros colaboradores.
        </p>
      )}

      {step === 0 && (
        <>
          <Input label="Nombre completo" placeholder="María García" required value={form.name} onChange={event => s('name', event.target.value)} error={errors.name} errorKey="name" />
          <Input label="Email" type="email" placeholder="tu@email.com" required value={form.email} onChange={event => s('email', event.target.value)} error={errors.email} errorKey="email" />
          <Input
            label="Contraseña"
            type={showRegisterPassword ? 'text' : 'password'}
            placeholder="Mínimo 8 caracteres"
            required
            value={form.password}
            onChange={event => s('password', event.target.value)}
            error={errors.password}
            errorKey="password"
            rightElement={<PasswordVisibilityButton visible={showRegisterPassword} onToggle={() => setShowRegisterPassword(value => !value)} />}
          />
          <p className="latido-auth-legal">
            Al registrarte aceptas los <Link to="/terminos">términos de uso</Link> y confirmas que has leído la <Link to="/privacidad">política de privacidad</Link> y la <Link to="/cookies">política de cookies</Link>.
          </p>
        </>
      )}

      {step === 1 && (
        <>
          <Select label="Tu cantón" required value={form.canton} onChange={event => s('canton', event.target.value)} error={errors.canton} errorKey="canton">
            <option value="">Seleccionar cantón…</option>
            {CANTONS.map(canton => <option key={canton.code} value={canton.code}>{canton.code} — {canton.name}</option>)}
          </Select>
          <div className="latido-auth-location-note">
            📣 Usamos tu cantón para mostrarte los anuncios más cercanos primero. Puedes cambiarlo en tu perfil.
          </div>
          <div className="latido-auth-language-block">
            <p>IDIOMAS QUE HABLAS</p>
            <div>
              {['Español', 'Alemán', 'Francés', 'Italiano', 'Inglés', 'Portugués'].map(language => (
                <button
                  key={language}
                  type="button"
                  className={form.languages.includes(language) ? 'is-active' : ''}
                  onClick={() => toggleLang(language)}
                >
                  {language}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <p className="latido-auth-selection-count">{form.interests.length}/3 SELECCIONADOS</p>
          <InterestOptionGrid
            options={ONBOARDING_INTEREST_OPTIONS}
            selectedIds={form.interests}
            onToggle={toggleInterest}
            style={{ marginBottom:12 }}
          />
          <section className="latido-auth-creator-prompt">
            <span aria-hidden="true">🎙️</span>
            <div>
              <strong>¿Eres creador de contenido?</strong>
              <p>Si tienes redes sociales donde hablas de Suiza y quieres llegar a más personas, crea tu perfil de creador en Latido.</p>
              <button
                type="button"
                onClick={() => handleRegister(null, '/creadores/alta?from=onboarding', 'creator')}
                disabled={loading}
              >
                {loading && registrationIntent === 'creator' ? 'Creando tu cuenta…' : 'Crear perfil de creador'}
              </button>
            </div>
          </section>
          <p className="latido-auth-interests-note">Podrás cambiar estos intereses cuando quieras desde tu perfil.</p>
        </>
      )}

      <div className="latido-auth-register-actions">
        <Btn onClick={goBackFromRegister} variant="secondary" style={{ flex:'0 0 104px' }}>
          <ChevronLeftIcon size={16} /> Atrás
        </Btn>
        {step < registerSteps.length - 1 ? (
          <Btn
            onClick={() => {
              if (!validateRegisterStep()) return
              setStep(current => current + 1)
            }}
            style={{ flex:1 }}
          >
            Continuar →
          </Btn>
        ) : (
          <Btn onClick={() => handleRegister()} loading={loading} style={{ flex:1 }}>
            🎉 Crear cuenta gratis
          </Btn>
        )}
      </div>

      {googleAuthVisible && step === 0 && (
        <>
          <AuthDivider />
          <GoogleAuthButton
            pwa={pwa}
            loading={googleLoading}
            disabled={loading}
            onRedirect={handleGoogleRedirect}
            onCredential={handleGoogleCredential}
            onUnavailable={handleGoogleUnavailable}
          />
        </>
      )}

    </AuthFormScreen>
  )
}
