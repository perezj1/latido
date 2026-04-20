import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { C, PP } from '../lib/theme'
import { Avatar } from './UI'

const NAV = [
  { href:'/tablon', label:'📌 Tablón' },
  { href:'/comunidades', label:'🤝 Comunidades' },
  { href:'/guias', label:'📚 Guías' },
  { href:'/tablon?cat=empleo', label:'💼 Empleos' },
]

export default function Header({ transparent }) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const { isLoggedIn, displayName, signOut } = useAuth()

  return (
    <header
      className="show-md"
      style={{
        position:'sticky',
        top:0,
        zIndex:50,
        background: transparent ? 'rgba(255,255,255,0)' : 'rgba(240,246,255,0.95)',
        backdropFilter:'blur(12px)',
        borderBottom: transparent ? 'none' : `1px solid ${C.border}`,
        transition:'all .3s',
      }}
    >
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'12px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
        <Link to="/" style={{ display:'flex', alignItems:'center', gap:8, textDecoration:'none', flexShrink:0 }}>
          <img src="/favicon.svg" alt="Latido" style={{ width:32, height:32 }} />
          <span style={{ fontFamily:PP, fontWeight:800, fontSize:17, color:C.primary, letterSpacing:-0.5 }}>Latido</span>
        </Link>

        <nav className="show-lg" style={{ gap:2, alignItems:'center' }}>
          {NAV.map(link => {
            const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href.split('?')[0])
            return (
              <Link key={link.href} to={link.href} style={{ fontFamily:PP, fontWeight:600, fontSize:12, textDecoration:'none', padding:'7px 12px', borderRadius:10, background: active ? C.primaryMid : 'transparent', color: active ? C.primaryDark : C.mid, transition:'all .15s' }}>
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Link to="/publicar" style={{ fontFamily:PP, fontWeight:700, fontSize:12, background:C.primary, color:'#fff', textDecoration:'none', padding:'9px 16px', borderRadius:12, display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
            + Publicar
          </Link>
          {isLoggedIn ? (
            <Link to="/perfil" style={{ textDecoration:'none' }}>
              <Avatar name={displayName} size={36} />
            </Link>
          ) : (
            <Link to="/auth" style={{ fontFamily:PP, fontWeight:600, fontSize:12, color:C.primary, textDecoration:'none', padding:'9px 14px', borderRadius:12, border:`1.5px solid ${C.primaryMid}`, flexShrink:0 }}>
              Entrar
            </Link>
          )}
          <button onClick={() => setOpen(!open)} className="hide-lg" style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:'8px 10px', cursor:'pointer', flexDirection:'column', gap:4 }}>
            {[0, 1, 2].map(i => <span key={i} style={{ width:18, height:2, background:C.mid, borderRadius:2, display:'block' }} />)}
          </button>
        </div>
      </div>

      {open && (
        <div className="fade-up lg:hidden" style={{ background:C.surface, borderTop:`1px solid ${C.border}`, padding:'12px 20px 16px' }}>
          {NAV.map(link => (
            <Link key={link.href} to={link.href} onClick={() => setOpen(false)} style={{ fontFamily:PP, fontWeight:600, fontSize:13, textDecoration:'none', display:'flex', alignItems:'center', gap:8, padding:'11px 12px', borderRadius:12, color: pathname.startsWith(link.href.split('?')[0]) ? C.primary : C.mid, background: pathname.startsWith(link.href.split('?')[0]) ? C.primaryLight : 'transparent', marginBottom:4 }}>
              {link.label}
            </Link>
          ))}
          {isLoggedIn ? (
            <button onClick={() => { signOut(); setOpen(false) }} style={{ fontFamily:PP, fontWeight:600, fontSize:12, color:C.danger, background:C.dangerLight, border:'none', borderRadius:12, padding:'11px 0', width:'100%', cursor:'pointer', marginTop:8 }}>
              Cerrar sesión
            </button>
          ) : (
            <Link to="/auth" onClick={() => setOpen(false)} style={{ fontFamily:PP, fontWeight:700, fontSize:13, background:C.primary, color:'#fff', textDecoration:'none', padding:'12px 0', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', marginTop:8 }}>
              Iniciar sesión
            </Link>
          )}
        </div>
      )}
    </header>
  )
}
