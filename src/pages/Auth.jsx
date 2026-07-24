import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { trackAnalyticsEvent } from '../lib/analytics'
import { supabase } from '../lib/supabase'
import { C, PP } from '../lib/theme'
import { Btn, ProgressBar, Input, Select } from '../components/UI'
import { CANTONS } from '../lib/constants'
import { INTEREST_OPTIONS } from '../lib/interests'
import toast from 'react-hot-toast'

function getSafeNextPath(value) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/'
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

export default function Auth() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const nextPath = getSafeNextPath(searchParams.get('next'))
  const isPartnerAccess = nextPath.startsWith('/servicios-suiza') || nextPath.startsWith('/colaboradores/')
  const authEntryPoint = isPartnerAccess ? 'partner' : nextPath === '/' ? 'general' : 'protected_route'
  const [mode, setMode] = useState('register')
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [form, setForm] = useState({ name:'', email:'', password:'', canton:'', languages:[], interests:[] })
  const [errors, setErrors] = useState({})
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
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
        toast.success('¡Bienvenido/a!')
        navigate(nextPath)
      }
    } finally {
      setLoading(false)
    }
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

  const handleRegister = async (interestsOverride = null) => {
    if (loading) return
    if (!validateRegisterAll()) return

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
        metadata: { method:'email', entry_point:authEntryPoint },
      })
      toast.success('¡Cuenta creada! Bienvenido/a 🎉')
      navigate(nextPath)
    } finally {
      setLoading(false)
    }
  }

  if (mode === 'login') return (
    <div style={{ maxWidth:440, margin:'60px auto', padding:'0 24px' }}>
      <div style={{ textAlign:'center', marginBottom:28 }}>
        <div style={{ width:60, height:60, background:C.primaryLight, borderRadius:20, display:'flex', alignItems:'center', justifyContent:'center', fontSize:30, margin:'0 auto 14px' }}>🌎</div>
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

      <Btn onClick={handleLogin} disabled={loading}>{loading ? '⏳ Entrando...' : 'Iniciar sesión'}</Btn>

      <p style={{ fontFamily:PP, fontSize:12, color:C.mid, textAlign:'center', marginTop:24 }}>
        ¿Sin cuenta?{' '}
        <button onClick={() => { setErrors({}); setMode('register') }} style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.primary, background:'none', border:'none', cursor:'pointer' }}>
          Regístrate gratis
        </button>
      </p>
    </div>
  )

  if (mode === 'forgot') return (
    <div style={{ maxWidth:440, margin:'60px auto', padding:'0 24px' }}>
      <div style={{ textAlign:'center', marginBottom:28 }}>
        <div style={{ width:60, height:60, background:C.primaryLight, borderRadius:20, display:'flex', alignItems:'center', justifyContent:'center', fontSize:30, margin:'0 auto 14px' }}>🔑</div>
        <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:24, color:C.text, marginBottom:4 }}>Recuperar contraseña</h1>
        <p style={{ fontFamily:PP, fontSize:13, color:C.light }}>Te enviaremos un enlace para crear una nueva.</p>
      </div>

      <Input label="Tu email" type="email" placeholder="tu@email.com" value={form.email} onChange={e => s('email', e.target.value)} required error={errors.email} errorKey="email" />

      <Btn onClick={handleForgot} disabled={loading}>{loading ? '⏳ Enviando...' : 'Enviar enlace'}</Btn>

      <p style={{ fontFamily:PP, fontSize:12, color:C.mid, textAlign:'center', marginTop:14 }}>
        <button onClick={() => { setErrors({}); setMode('login') }} style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.primary, background:'none', border:'none', cursor:'pointer' }}>
          ← Volver al inicio de sesión
        </button>
      </p>
    </div>
  )

  const REG_STEPS = [
    { title:'Crea tu cuenta', sub:'Gratis · Sin spam · Sin comisiones' },
    { title:'¿Dónde estás en Suiza?', sub:'Para mostrarte anuncios cercanos primero' },
    { title:'¿Qué te interesa ahora?', sub:'Elige hasta tres o continúa sin elegir' },
  ]

  return (
    <div style={{ maxWidth:440, margin:'48px auto', padding:'0 24px' }}>
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
            <p style={{ fontFamily:PP, fontSize:11, color:C.mid, margin:0, lineHeight:1.55 }}>
              📌 Usamos tu cantón para mostrarte los anuncios más cercanos primero. Puedes cambiarlo en tu perfil.
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
          <div style={{ background:C.primaryLight, border:`1px solid ${C.primaryMid}`, borderRadius:14, padding:'12px 13px', marginBottom:16 }}>
            <p style={{ fontFamily:PP, fontSize:11, color:C.primaryDark, margin:0, lineHeight:1.55 }}>
              Cuéntanos qué te interesa para mostrarte contenido más relevante para ti.
            </p>
          </div>
          <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, margin:'0 0 9px', letterSpacing:0.5 }}>
            {form.interests.length}/3 SELECCIONADOS
          </p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
            {INTEREST_OPTIONS.map(option => {
              const selected = form.interests.includes(option.id)
              const unavailable = !selected && form.interests.length >= 3
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  aria-disabled={unavailable}
                  onClick={() => toggleInterest(option.id)}
                  style={{ fontFamily:PP, fontSize:11, fontWeight:700, padding:'9px 13px', borderRadius:999, border:`1.5px solid ${selected ? C.primary : C.border}`, background:selected ? C.primary : '#fff', color:selected ? '#fff' : C.mid, cursor:unavailable ? 'not-allowed' : 'pointer', opacity:unavailable ? 0.5 : 1, boxShadow:selected ? '0 5px 12px rgba(37,99,235,0.2)' : 'none' }}
                >
                  {option.emoji} {option.label}
                </button>
              )
            })}
          </div>
          <p style={{ fontFamily:PP, fontSize:10, color:C.light, margin:'0 0 18px', lineHeight:1.55 }}>
            Es opcional. Podrás cambiar estos intereses cuando quieras desde tu perfil.
          </p>
        </>
      )}

      <div style={{ display:'flex', gap:10 }}>
        {step > 0 && <Btn onClick={() => setStep(s => s - 1)} variant="secondary" style={{ flex:'0 0 100px' }}>← Atrás</Btn>}
        {step < REG_STEPS.length - 1 ? (
          <Btn onClick={() => { if (!validateRegisterStep()) return; setStep(current => current + 1) }} style={{ flex:1 }}>
            Continuar →
          </Btn>
        ) : (
          <Btn onClick={() => handleRegister()} disabled={loading} style={{ flex:1 }}>
            {loading ? '⏳ Creando cuenta...' : '🎉 Crear cuenta gratis'}
          </Btn>
        )}
      </div>

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

      <p style={{ fontFamily:PP, fontSize:12, color:C.mid, textAlign:'center', marginTop:24 }}>
        ¿Ya tienes cuenta?{' '}
        <button onClick={() => { setErrors({}); setMode('login') }} style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.primary, background:'none', border:'none', cursor:'pointer' }}>
          Iniciar sesión
        </button>
      </p>
    </div>
  )
}
