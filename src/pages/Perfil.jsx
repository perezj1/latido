import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { C, PP } from '../lib/theme'
import { Avatar, Btn } from '../components/UI'
import toast from 'react-hot-toast'

export default function Perfil() {
  const { isLoggedIn, displayName, userCanton, user, signOut } = useAuth()
  const navigate = useNavigate()

  if (!isLoggedIn) return (
    <div style={{ maxWidth:440, margin:'80px auto', padding:'0 24px', textAlign:'center' }}>
      <div style={{ fontSize:52, marginBottom:16 }}>👤</div>
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:C.text, marginBottom:10 }}>Tu perfil</h1>
      <p style={{ fontFamily:PP, fontSize:13, color:C.mid, marginBottom:24, lineHeight:1.7 }}>
        Inicia sesión para gestionar tus anuncios, mensajes y configuración.
      </p>
      <Btn onClick={() => navigate('/auth')}>Iniciar sesión</Btn>
      <button onClick={() => navigate('/auth')} style={{ fontFamily:PP, fontWeight:600, fontSize:13, color:C.primary, background:'none', border:`1.5px solid ${C.primaryMid}`, borderRadius:14, padding:'12px 0', width:'100%', cursor:'pointer', marginTop:10 }}>
        Crear cuenta gratis
      </button>
    </div>
  )

  const handleSignOut = async () => {
    await signOut()
    toast.success('Sesión cerrada')
    navigate('/')
  }

  const MENU = [
    { icon:'📌', label:'Mis anuncios',    sub:'Gestiona los anuncios que has publicado',  href:'/tablon' },
    { icon:'🔖', label:'Guardados',       sub:'Anuncios que has marcado para luego',       href:'#' },
    { icon:'💬', label:'Mensajes',        sub:'Conversaciones con otros usuarios',         href:'#' },
    { icon:'🔔', label:'Alertas de zona', sub:'Nuevos anuncios en tu cantón y PLZ',       href:'#' },
    { icon:'⚙️', label:'Configuración',   sub:'Cantón, idiomas, contraseña, privacidad',  href:'#' },
  ]

  return (
    <div style={{ maxWidth:600, margin:'0 auto', padding:'32px 24px 100px' }}>
      {/* Profile card */}
      <div style={{ background:'linear-gradient(135deg,#1D4ED8,#2563EB)', borderRadius:24, padding:'24px 20px 28px', marginBottom:20, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-20, right:-20, width:80, height:80, borderRadius:'50%', background:'rgba(255,255,255,0.06)' }}/>
        <div style={{ display:'flex', gap:16, alignItems:'center', marginBottom:18 }}>
          <Avatar name={displayName} size={64} />
          <div>
            <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:'#fff', marginBottom:4, letterSpacing:-0.3 }}>{displayName}</h1>
            <p style={{ fontFamily:PP, fontSize:12, color:'rgba(255,255,255,0.7)', margin:0 }}>{user?.email}</p>
            {userCanton && <p style={{ fontFamily:PP, fontSize:12, color:'rgba(255,255,255,0.7)', margin:'2px 0 0' }}>📍 Cantón {userCanton}</p>}
          </div>
        </div>
        <div style={{ display:'flex', gap:20, padding:'14px 0 0', borderTop:'1px solid rgba(255,255,255,0.15)' }}>
          {[['3','Anuncios'],['0','Mensajes'],['5','Guardados']].map(([v,l]) => (
            <div key={l} style={{ textAlign:'center' }}>
              <p style={{ fontFamily:PP, fontWeight:700, fontSize:18, color:'#fff', margin:'0 0 2px' }}>{v}</p>
              <p style={{ fontFamily:PP, fontSize:10, color:'rgba(255,255,255,0.65)', margin:0 }}>{l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Plan info */}
      <div style={{ background:C.primaryLight, border:`1.5px solid ${C.primaryMid}`, borderRadius:16, padding:'14px 16px', marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <p style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:C.primaryDark, marginBottom:2 }}>Plan gratuito</p>
          <p style={{ fontFamily:PP, fontSize:11, color:C.primary, margin:0 }}>3 anuncios activos · Contacto ilimitado</p>
        </div>
        <span style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.primary, background:'#fff', padding:'5px 10px', borderRadius:10, border:`1px solid ${C.primaryMid}`, cursor:'pointer' }}>
          Ver Premium
        </span>
      </div>

      {/* Menu options */}
      {MENU.map(o => (
        <Link key={o.label} to={o.href} style={{ textDecoration:'none', display:'block' }}>
          <div style={{ background:'#fff', border:`1px solid ${C.border}`, borderRadius:14, padding:'13px 15px', display:'flex', gap:12, alignItems:'center', marginBottom:8, cursor:'pointer', transition:'all .15s' }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=C.primaryMid;e.currentTarget.style.background=C.primaryLight}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background='#fff'}}>
            <div style={{ width:42, height:42, background:C.bg, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{o.icon}</div>
            <div style={{ flex:1 }}>
              <p style={{ fontFamily:PP, fontWeight:600, fontSize:13, color:C.text, marginBottom:1 }}>{o.label}</p>
              <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>{o.sub}</p>
            </div>
            <span style={{ color:C.light, fontSize:16 }}>›</span>
          </div>
        </Link>
      ))}

      {/* Sign out */}
      <button onClick={handleSignOut} style={{ fontFamily:PP, fontWeight:600, fontSize:13, color:'#EF4444', background:'#FEF2F2', border:'none', borderRadius:14, padding:'13px 0', width:'100%', cursor:'pointer', marginTop:8 }}>
        Cerrar sesión
      </button>
    </div>
  )
}
