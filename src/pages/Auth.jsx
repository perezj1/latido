import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { C, PP } from '../lib/theme'
import { Btn, ProgressBar, Input, Select } from '../components/UI'
import { CANTONS } from '../lib/constants'
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
  const isPartnerAccess = nextPath.startsWith('/servicios-suiza')
  const [mode, setMode] = useState('register')
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [form, setForm] = useState({ name:'', email:'', password:'', canton:'', languages:[] })
  const s = (k, v) => setForm(f => ({ ...f, [k]:v }))
  const toggleLang = l => s('languages', form.languages.includes(l) ? form.languages.filter(x => x !== l) : [...form.languages, l])

  const handleLogin = async () => {
    if (!form.email || !form.password) {
      toast.error('Email y contraseña requeridos')
      return
    }

    setLoading(true)
    try {
      const { error } = await signIn({ email: form.email, password: form.password })
      if (error) toast.error('Email o contraseña incorrectos')
      else {
        toast.success('¡Bienvenido/a!')
        navigate(nextPath)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleForgot = async () => {
    if (!form.email) { toast.error('Introduce tu email'); return }
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

  const handleRegister = async () => {
    if (loading) return
    if (!form.name || !form.email || !form.password) {
      toast.error('Rellena todos los campos')
      return
    }
    if (!form.canton) {
      toast.error('Selecciona tu cantón')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await signUp({
        email: form.email,
        password: form.password,
        name: form.name,
        canton: form.canton,
      })

      if (error) {
        const msg = error.message?.toLowerCase() || ''
        const status = error.status || 0

        if (status === 429 || msg.includes('rate limit') || msg.includes('too many') || msg.includes('over_email')) {
          toast.error('Demasiados intentos de registro. Espera 1-2 minutos e inténtalo de nuevo.', { duration: 7000 })
        } else if (msg.includes('database') || msg.includes('saving')) {
          toast.error('Error interno. Intenta de nuevo en unos segundos.')
        } else if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('user_already_exists')) {
          toast.error('Este email ya está registrado. Inicia sesión.')
        } else if (msg.includes('password') || msg.includes('weak')) {
          toast.error('La contraseña debe tener al menos 6 caracteres.')
        } else if (msg.includes('invalid email')) {
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
          Inicia sesión para acceder a la información y los servicios de nuestros partners.
        </div>
      )}

      <Input label="Email" type="email" placeholder="tu@email.com" value={form.email} onChange={e => s('email', e.target.value)} required />
      <Input
        label="Contraseña"
        type={showLoginPassword ? 'text' : 'password'}
        placeholder="Tu contraseña"
        value={form.password}
        onChange={e => s('password', e.target.value)}
        required
        rightElement={
          <PasswordVisibilityButton visible={showLoginPassword} onToggle={() => setShowLoginPassword(v => !v)} />
        }
      />

      <div style={{ textAlign:'right', marginBottom:16, marginTop:-8 }}>
        <button onClick={() => setMode('forgot')} style={{ fontFamily:PP, fontSize:11, fontWeight:600, color:C.primary, background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>
          ¿Olvidaste tu contraseña?
        </button>
      </div>

      <Btn onClick={handleLogin} disabled={loading}>{loading ? '⏳ Entrando...' : 'Iniciar sesión'}</Btn>

      <p style={{ fontFamily:PP, fontSize:12, color:C.mid, textAlign:'center', marginTop:24 }}>
        ¿Sin cuenta?{' '}
        <button onClick={() => setMode('register')} style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.primary, background:'none', border:'none', cursor:'pointer' }}>
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

      <Input label="Tu email" type="email" placeholder="tu@email.com" value={form.email} onChange={e => s('email', e.target.value)} required />

      <Btn onClick={handleForgot} disabled={loading}>{loading ? '⏳ Enviando...' : 'Enviar enlace'}</Btn>

      <p style={{ fontFamily:PP, fontSize:12, color:C.mid, textAlign:'center', marginTop:14 }}>
        <button onClick={() => setMode('login')} style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.primary, background:'none', border:'none', cursor:'pointer' }}>
          ← Volver al inicio de sesión
        </button>
      </p>
    </div>
  )

  const REG_STEPS = [
    { title:'Crea tu cuenta', sub:'Gratis · Sin spam · Sin comisiones' },
    { title:'¿Dónde estás en Suiza?', sub:'Para mostrarte anuncios cercanos primero' },
  ]

  return (
    <div style={{ maxWidth:440, margin:'48px auto', padding:'0 24px' }}>
      <ProgressBar step={step} total={REG_STEPS.length} />
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:C.text, marginBottom:4 }}>{REG_STEPS[step].title}</h1>
      <p style={{ fontFamily:PP, fontSize:12, color:C.light, marginBottom:22 }}>{REG_STEPS[step].sub}</p>

      {isPartnerAccess && step === 0 && (
        <div style={{ fontFamily:PP, fontSize:12, lineHeight:1.55, color:C.mid, background:C.primaryLight, border:`1px solid ${C.border}`, borderRadius:14, padding:'11px 13px', marginBottom:18 }}>
          Crea tu cuenta gratuita para acceder a la información y los servicios de nuestros partners.
        </div>
      )}

      {step === 0 && (
        <>
          <Input label="Nombre completo" placeholder="María García" required value={form.name} onChange={e => s('name', e.target.value)} />
          <Input label="Email" type="email" placeholder="tu@email.com" required value={form.email} onChange={e => s('email', e.target.value)} />
          <Input
            label="Contraseña"
            type={showRegisterPassword ? 'text' : 'password'}
            placeholder="Mínimo 8 caracteres"
            required
            value={form.password}
            onChange={e => s('password', e.target.value)}
            rightElement={
              <PasswordVisibilityButton visible={showRegisterPassword} onToggle={() => setShowRegisterPassword(v => !v)} />
            }
          />
          <p style={{ fontFamily:PP, fontSize:10, color:C.light, marginBottom:14, lineHeight:1.5 }}>
            Al registrarte aceptas los <Link to="/terminos" style={{ color:C.primary }}>términos de uso</Link> y la <Link to="/privacidad" style={{ color:C.primary }}>política de privacidad</Link>.
          </p>
        </>
      )}

      {step === 1 && (
        <>
          <Select label="Tu cantón" required value={form.canton} onChange={e => s('canton', e.target.value)}>
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

      <div style={{ display:'flex', gap:10 }}>
        {step > 0 && <Btn onClick={() => setStep(s => s - 1)} variant="secondary" style={{ flex:'0 0 100px' }}>← Atrás</Btn>}
        {step < REG_STEPS.length - 1 ? (
          <Btn onClick={() => { if(!form.name || !form.email || !form.password){ toast.error('Rellena todos los campos'); return } setStep(1) }} style={{ flex:1 }}>
            Continuar →
          </Btn>
        ) : (
          <Btn onClick={handleRegister} disabled={loading} style={{ flex:1 }}>
            {loading ? '⏳ Creando cuenta...' : '🎉 Crear cuenta gratis'}
          </Btn>
        )}
      </div>

      <p style={{ fontFamily:PP, fontSize:12, color:C.mid, textAlign:'center', marginTop:24 }}>
        ¿Ya tienes cuenta?{' '}
        <button onClick={() => setMode('login')} style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.primary, background:'none', border:'none', cursor:'pointer' }}>
          Iniciar sesión
        </button>
      </p>
    </div>
  )
}
