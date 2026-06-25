import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usePushActivation } from '../hooks/usePushActivation'
import { C, PP } from '../lib/theme'
import { Avatar } from './UI'

const PUBLISH_OPTIONS = [
  { emoji:'📌', label:'Anuncio',   sub:'Vivienda, servicios, cuidados, mercado o trámites', to:'/publicar' },
  { emoji:'💼', label:'Empleo',    sub:'Oferta de trabajo o perfil buscando empleo', to:'/publicar-empleo' },
  { emoji:'🏪', label:'Negocio',   sub:'Restaurante, tienda, servicio o profesional', to:'/registrar-negocio' },
  { emoji:'👥', label:'Grupo',     sub:'Comunidad, chat o grupo de interés', to:'/registrar-comunidad' },
  { emoji:'🎉', label:'Evento',    sub:'Actividad con fecha: fiesta, concierto o quedada', to:'/publicar-evento' },
]
const NAV_GUEST = [
  { href:'/tablon', label:'📌 Anuncios' },
  { href:'/tablon?cat=empleo', label:'💼 Empleo' },
  { href:'/comunidades', label:'🤝 Comunidad' },
  { href:'/colaboraciones', label:'🚀 Para Empresas' },
]

const NAV_USER = [
  { href:'/', label:'🏠 Inicio' },
  { href:'/tablon', label:'📌 Anuncios' },
  { href:'/tablon?cat=empleo', label:'💼 Empleo' },
  { href:'/comunidades', label:'🤝 Comunidad' },
  { href:'/colaboraciones', label:'🚀 Para Empresas' },
  { href:'/mensajes', label:'💬 Mensajes' },
]

export default function Header({ transparent }) {
  const [open, setOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const publishRef = useRef(null)
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const { isLoggedIn, user, displayName, signOut, avatarUrl } = useAuth()
  const { needsActivation: needsPushActivation } = usePushActivation(user?.id)
  const NAV = isLoggedIn ? NAV_USER : NAV_GUEST
  const isProfilePage = pathname === '/perfil' || pathname.startsWith('/perfil/')

  useEffect(() => {
    if (!publishOpen) return
    const handler = e => { if (publishRef.current && !publishRef.current.contains(e.target)) setPublishOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [publishOpen])

  useEffect(() => {
    if (isProfilePage) setPublishOpen(false)
  }, [isProfilePage])

  const isActive = (href) => {
    if (href === '/') return pathname === '/'
    const [base, query] = href.split('?')
    if (query) return pathname.startsWith(base) && search.includes(query)
    return pathname.startsWith(base) && !NAV.some(l => {
      const [b, q] = l.href.split('?')
      return q && pathname.startsWith(b) && search.includes(q)
    })
  }

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
      <div style={{ width:'100%', maxWidth:1200, margin:'0 auto', padding:'12px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
        {!isLoggedIn && (
          <Link to="/" style={{ display:'flex', alignItems:'center', gap:8, textDecoration:'none', flexShrink:0 }}>
            <img src="/favicon.svg" alt="Latido" style={{ width:32, height:32 }} />
            <span style={{ fontFamily:PP, fontWeight:800, fontSize:17, color:C.primary, letterSpacing:-0.5 }}>Latido</span>
          </Link>
        )}

        <nav className="show-lg" style={{ gap:2, alignItems:'center', flex: isLoggedIn ? 1 : undefined }}>
          {NAV.map(link => {
            const active = isActive(link.href)
            return (
              <Link key={link.href} to={link.href} style={{ fontFamily:PP, fontWeight:600, fontSize:12, textDecoration:'none', padding:'7px 12px', borderRadius:10, background: active ? C.primaryMid : 'transparent', color: active ? C.primaryDark : C.mid, transition:'all .15s' }}>
                {link.label}
              </Link>
            )
          })}

          {!isProfilePage && (
          <div ref={publishRef} style={{ position:'relative', marginLeft:8 }}>
            <div style={{ padding:2, borderRadius:22, background:'conic-gradient(#E8403A, #2563EB, #00BCD4, #1DBD8A, #F5A623, #E8403A)', boxShadow:'0 2px 12px rgba(37,99,235,0.35)' }}>
              <button
                onClick={() => setPublishOpen(v => !v)}
                style={{ height:36, borderRadius:20, background:'#fff', color:C.primaryDark, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, border:'none', cursor:'pointer', padding:'0 16px', whiteSpace:'nowrap', letterSpacing:-0.2, fontFamily:PP }}
              >
                ✏️ Publicar
              </button>
            </div>
            {publishOpen && (
              <div style={{ position:'absolute', top:'calc(100% + 10px)', left:0, background:'#fff', borderRadius:16, boxShadow:'0 8px 32px rgba(15,23,42,0.16)', border:`1px solid ${C.border}`, padding:'8px', zIndex:200, minWidth:280 }}>
                {PUBLISH_OPTIONS.map(opt => (
                  <button
                    key={opt.to}
                    onClick={() => { setPublishOpen(false); navigate(opt.to) }}
                    style={{ display:'flex', alignItems:'center', gap:12, background:'transparent', border:'none', borderRadius:12, padding:'10px 12px', cursor:'pointer', textAlign:'left', width:'100%' }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.bg }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{ width:36, height:36, background:C.primaryLight, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{opt.emoji}</div>
                    <div>
                      <p style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:C.text, margin:'0 0 1px' }}>{opt.label}</p>
                      <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>{opt.sub}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          )}
        </nav>

        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {isLoggedIn ? (
            <Link to="/perfil" style={{ textDecoration:'none', position:'relative', display:'inline-flex' }}>
              <Avatar name={displayName} size={36} src={avatarUrl} />
              {needsPushActivation && (
                <span style={{ position:'absolute', top:-2, right:-2, width:10, height:10, borderRadius:5, background:'#EF4444', border:'2px solid #fff', boxShadow:'0 0 0 2px rgba(239,68,68,0.14)' }} />
              )}
            </Link>
          ) : (
            <Link to="/auth" style={{ fontFamily:PP, fontWeight:600, fontSize:12, color:C.primary, textDecoration:'none', padding:'9px 14px', borderRadius:12, border:`1.5px solid ${C.primaryMid}`, flexShrink:0 }}>
              Entrar
            </Link>
          )}
          <button onClick={() => setOpen(!open)} className="hide-lg" aria-label={open ? 'Cerrar menú' : 'Abrir menú'} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:'8px 10px', cursor:'pointer', flexDirection:'column', gap:4 }}>
            {[0, 1, 2].map(i => <span key={i} style={{ width:18, height:2, background:C.mid, borderRadius:2, display:'block' }} />)}
          </button>
        </div>
      </div>

      {open && (
        <div className="fade-up lg:hidden" style={{ background:C.surface, borderTop:`1px solid ${C.border}`, padding:'12px 20px 16px' }}>
          {NAV.map(link => (
            <Link key={link.href} to={link.href} onClick={() => setOpen(false)} style={{ fontFamily:PP, fontWeight:600, fontSize:13, textDecoration:'none', display:'flex', alignItems:'center', gap:8, padding:'11px 12px', borderRadius:12, color: isActive(link.href) ? C.primary : C.mid, background: isActive(link.href) ? C.primaryLight : 'transparent', marginBottom:4 }}>
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
