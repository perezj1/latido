import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { C, PP } from '../lib/theme'
import { Btn, ProgressBar, Input, Select } from '../components/UI'
import { CANTONS } from '../lib/constants'
import toast from 'react-hot-toast'

export default function Auth() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
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
        navigate('/')
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
      navigate('/')
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

      <Input label="Email" type="email" placeholder="tu@email.com" value={form.email} onChange={e => s('email', e.target.value)} required />
      <Input label="Contraseña" type="password" placeholder="Tu contraseña" value={form.password} onChange={e => s('password', e.target.value)} required />

      <div style={{ textAlign:'right', marginBottom:16, marginTop:-8 }}>
        <button onClick={() => setMode('forgot')} style={{ fontFamily:PP, fontSize:11, color:C.light, background:'none', border:'none', cursor:'pointer' }}>
          ¿Olvidaste tu contraseña?
        </button>
      </div>

      <Btn onClick={handleLogin} disabled={loading}>{loading ? '⏳ Entrando...' : 'Iniciar sesión'}</Btn>

      <p style={{ fontFamily:PP, fontSize:12, color:C.mid, textAlign:'center' }}>
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

      {step === 0 && (
        <>
          <Input label="Nombre completo" placeholder="María García" required value={form.name} onChange={e => s('name', e.target.value)} />
          <Input label="Email" type="email" placeholder="tu@email.com" required value={form.email} onChange={e => s('email', e.target.value)} />
          <Input label="Contraseña" type="password" placeholder="Mínimo 8 caracteres" required value={form.password} onChange={e => s('password', e.target.value)} />
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

      <p style={{ fontFamily:PP, fontSize:12, color:C.mid, textAlign:'center', marginTop:14 }}>
        ¿Ya tienes cuenta?{' '}
        <button onClick={() => setMode('login')} style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.primary, background:'none', border:'none', cursor:'pointer' }}>
          Iniciar sesión
        </button>
      </p>
    </div>
  )
}
