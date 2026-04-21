import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { C, PP } from '../lib/theme'
import { Btn, Input } from '../components/UI'
import toast from 'react-hot-toast'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY when it detects the recovery token in the URL hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })

    // Fallback: if already in a session (token processed synchronously), check session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })

    // If after 5s no recovery event fired, the link is likely expired/invalid
    const timer = setTimeout(() => setExpired(true), 5000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  const handleSubmit = async () => {
    if (!password || password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (password !== confirm) {
      toast.error('Las contraseñas no coinciden')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        toast.error('No se pudo actualizar. El enlace puede haber expirado.')
      } else {
        toast.success('¡Contraseña actualizada! Ya puedes entrar.')
        navigate('/')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!ready && expired) return (
    <div style={{ maxWidth:440, margin:'80px auto', padding:'0 24px', textAlign:'center' }}>
      <div style={{ fontSize:52, marginBottom:16 }}>⛔</div>
      <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:20, color:C.text, marginBottom:8 }}>Enlace inválido o expirado</h2>
      <p style={{ fontFamily:PP, fontSize:13, color:C.light, marginBottom:24 }}>
        Este enlace ya no es válido. Solicita uno nuevo desde la pantalla de inicio de sesión.
      </p>
      <Btn onClick={() => navigate('/auth')}>Ir al inicio de sesión</Btn>
    </div>
  )

  if (!ready) return (
    <div style={{ maxWidth:440, margin:'80px auto', padding:'0 24px', textAlign:'center' }}>
      <div style={{ fontSize:48, marginBottom:16 }}>⏳</div>
      <p style={{ fontFamily:PP, fontSize:14, color:C.light }}>Verificando enlace...</p>
    </div>
  )

  return (
    <div style={{ maxWidth:440, margin:'60px auto', padding:'0 24px' }}>
      <div style={{ textAlign:'center', marginBottom:28 }}>
        <div style={{ width:60, height:60, background:C.primaryLight, borderRadius:20, display:'flex', alignItems:'center', justifyContent:'center', fontSize:30, margin:'0 auto 14px' }}>🔐</div>
        <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:24, color:C.text, marginBottom:4 }}>Nueva contraseña</h1>
        <p style={{ fontFamily:PP, fontSize:13, color:C.light }}>Elige una contraseña segura para tu cuenta.</p>
      </div>

      <Input
        label="Nueva contraseña"
        type="password"
        placeholder="Mínimo 6 caracteres"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
      />
      <Input
        label="Confirmar contraseña"
        type="password"
        placeholder="Repite la contraseña"
        value={confirm}
        onChange={e => setConfirm(e.target.value)}
        required
      />

      <Btn onClick={handleSubmit} disabled={loading}>
        {loading ? '⏳ Guardando...' : 'Guardar nueva contraseña'}
      </Btn>
    </div>
  )
}
