import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useUnreadMessages } from '../hooks/useUnreadMessages'
import { Avatar } from './UI'
import { C, PP } from '../lib/theme'
import { getPublishTarget } from '../lib/publishTargets'

const PUBLISH_OPTIONS = [
  { emoji:'📌', label:'Anuncio',   sub:'Publica lo que ofreces o buscas en la comunidad', to:'/publicar' },
  { emoji:'💼', label:'Empleo',    sub:'Publica una oferta de trabajo',          to:'/publicar-empleo' },
  { emoji:'🏪', label:'Negocio',   sub:'Registra tu negocio o empresa',          to:'/registrar-negocio' },
  { emoji:'🤝', label:'Comunidad', sub:'Crea o añade un grupo de la comunidad',  to:'/registrar-comunidad' },
  { emoji:'🎉', label:'Evento',    sub:'Comparte un evento con la comunidad',    to:'/publicar-evento' },
]

const TABS = [
  { path:'/',            emoji:'🏠', label:'Inicio' },
  { path:'/tablon',      emoji:'📌', label:'Anuncios' },
  { path:'/comunidades', emoji:'🤝', label:'Comunidad' },
  { path:'/mensajes',    emoji:'💬', label:'Mensajes' },
  { path:'/perfil',      emoji:'👤', label:'Perfil' },
]

const NO_FAB = ['/publicar', '/publicar-empleo', '/publicar-evento', '/registrar-negocio', '/registrar-comunidad', '/mensajes']

export default function BottomNav() {
  const { pathname, search } = useLocation()
  const { isLoggedIn, displayName, avatarUrl } = useAuth()
  const { hasUnread } = useUnreadMessages()
  const navigate = useNavigate()
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    if (!pickerOpen) return
    window.history.pushState({ picker: true }, '')
    const handlePop = () => setPickerOpen(false)
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [pickerOpen])

  const hideFab = NO_FAB.some(path => pathname === path || pathname.startsWith(`${path}/`))
  const fab = hideFab ? null : getPublishTarget()

  return (
    <>
      {fab && (
        <div style={{
          position:'fixed', bottom:'calc(75px + env(safe-area-inset-bottom))', right:18, zIndex:60,
          padding:2.5, borderRadius:26,
          background:'conic-gradient(#E8403A, #2563EB, #00BCD4, #1DBD8A, #F5A623, #E8403A)',
          boxShadow:'0 4px 20px rgba(37,99,235,0.45)',
        }}>
          {fab.showPicker ? (
            <button
              onClick={() => setPickerOpen(true)}
              style={{
                height:46, borderRadius:23, background:'#fff',
                color:C.primaryDark, display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:13, fontWeight:700, border:'none', cursor:'pointer',
                padding:'0 20px', whiteSpace:'nowrap', letterSpacing:-0.2,
              }}
            >
              ✏️ {fab.label}
            </button>
          ) : (
            <Link
              to={fab.to}
              style={{
                height:46, borderRadius:23, background:'#fff',
                color:C.primaryDark, display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:13, fontWeight:700, textDecoration:'none',
                padding:'0 20px', whiteSpace:'nowrap', letterSpacing:-0.2,
              }}
              aria-label={fab.label}
            >
              {fab.label}
            </Link>
          )}
        </div>
      )}

      {/* Publish picker sheet */}
      {pickerOpen && (
        <div
          onClick={() => window.history.back()}
          style={{ position:'fixed', inset:0, zIndex:90, background:'rgba(0,0,0,0.45)', display:'flex', flexDirection:'column', justifyContent:'flex-end' }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:'24px 24px 0 0', padding:'16px 20px 40px' }}>
            <div style={{ width:36, height:4, background:'#E2EAF4', borderRadius:4, margin:'0 auto 20px' }} />
            <p style={{ fontFamily:PP, fontWeight:800, fontSize:17, color:'#0F172A', marginBottom:6 }}>¿Qué quieres publicar?</p>
            <p style={{ fontFamily:PP, fontSize:12, color:'#64748B', marginBottom:20 }}>Elige el tipo de publicación</p>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {PUBLISH_OPTIONS.map(opt => (
                <button
                  key={opt.to}
                  onClick={() => { setPickerOpen(false); navigate(opt.to) }}
                  style={{ display:'flex', alignItems:'center', gap:14, background:'#F8FAFF', border:'1px solid #E2EAF4', borderRadius:16, padding:'14px 16px', cursor:'pointer', textAlign:'left' }}
                >
                  <div style={{ width:44, height:44, background:'#EFF6FF', borderRadius:13, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>{opt.emoji}</div>
                  <div>
                    <p style={{ fontFamily:PP, fontWeight:700, fontSize:14, color:'#0F172A', margin:'0 0 2px' }}>{opt.label}</p>
                    <p style={{ fontFamily:PP, fontSize:11, color:'#64748B', margin:0 }}>{opt.sub}</p>
                  </div>
                  <span style={{ marginLeft:'auto', color:'#94A3B8', fontSize:18 }}>›</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className="safe-bottom hide-md" style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:50, background:'#fff', borderTop:`1px solid ${C.border}`, display:'flex', alignItems:'center' }}>
        {TABS.map(tab => {
          const active = tab.path === '/' ? pathname === '/' : pathname.startsWith(tab.path)
          const to = (!isLoggedIn && (tab.path === '/mensajes' || tab.path === '/perfil')) ? '/auth' : tab.path

          return (
            <Link
              key={tab.path}
              to={to}
              style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'8px 0 10px', gap:2, textDecoration:'none', color: active ? C.primary : C.light, transition:'color .15s' }}
            >
              <span style={{ position:'relative', display:'inline-flex' }}>
                {tab.path === '/perfil' && isLoggedIn
                  ? <Avatar name={displayName} size={24} src={avatarUrl} />
                  : <span style={{ fontSize:20, lineHeight:1 }}>{tab.emoji}</span>
                }
                {tab.path === '/mensajes' && hasUnread && (
                  <span style={{ position:'absolute', top:-2, right:-4, minWidth:8, height:8, borderRadius:4, background:'#EF4444', border:'1.5px solid #fff' }} />
                )}
              </span>
              <span style={{ fontFamily:PP, fontSize:9, fontWeight: active ? 700 : 500 }}>{tab.label}</span>
              {active && <span style={{ width:20, height:3, background:C.primary, borderRadius:2 }} />}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
