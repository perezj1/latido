import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useUnreadMessages } from '../hooks/useUnreadMessages'
import { usePushActivation } from '../hooks/usePushActivation'
import { Avatar } from './UI'
import { C, PP } from '../lib/theme'
import { isCreatorProfileRoute, isExploreRoute } from '../lib/sections'

const PUBLISH_OPTIONS = [
  { emoji:'📌', label:'Anuncio',   sub:'Vivienda, servicios, cuidados, compraventa o trámites', to:'/publicar' },
  { emoji:'💼', label:'Empleo',    sub:'Oferta o solicitud de empleo', to:'/publicar-empleo' },
  { emoji:'🏪', label:'Negocio',   sub:'Restaurante, tienda, servicio o profesional', to:'/registrar-negocio' },
  { emoji:'👥', label:'Grupo',     sub:'Comunidad, chat o grupo de interés', to:'/registrar-comunidad' },
  { emoji:'🎉', label:'Evento',    sub:'Actividad con fecha: fiesta, concierto o quedada', to:'/publicar-evento' },
  { emoji:'🎙️', label:'Contenido', sub:'Un vídeo, artículo o publicación tuya', to:'/publicar-contenido' },
]

const TABS = [
  { id:'inicio',   path:'/',         emoji:'🏠', label:'Inicio' },
  { id:'explorar', path:'/explorar', emoji:'🔎', label:'Explorar' },
  { id:'publicar', action:'publish', emoji:'✏️', label:'Publicar' },
  { id:'mensajes', path:'/mensajes', emoji:'💬', label:'Mensajes' },
  { id:'perfil',   path:'/perfil',   emoji:'👤', label:'Perfil' },
]

// Flujos de alta/edicion con acciones fijas abajo: la barra estorbaria y se
// solaparia con ellas. /creadores/alta es tambien el editor del perfil.
const PUBLISH_FLOW_PATHS = ['/publicar', '/publicar-empleo', '/publicar-evento', '/registrar-negocio', '/registrar-comunidad', '/publicar-contenido', '/creadores/alta']

export default function BottomNav() {
  const { pathname, search } = useLocation()
  const { isLoggedIn, user, displayName, avatarUrl } = useAuth()
  const { hasUnread } = useUnreadMessages()
  const { needsActivation: needsPushActivation } = usePushActivation(user?.id)
  const navigate = useNavigate()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  const [messagesChatOpen, setMessagesChatOpen] = useState(false)

  useEffect(() => {
    const onFocusIn = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        setKeyboardVisible(true)
      }
    }
    const onFocusOut = () => {
      setTimeout(() => {
        const el = document.activeElement
        if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) {
          setKeyboardVisible(false)
        }
      }, 150)
    }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])

  useEffect(() => {
    if (!pickerOpen) return
    window.history.pushState({ picker: true }, '')
    const handlePop = () => setPickerOpen(false)
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [pickerOpen])

  useEffect(() => {
    if (!pathname.startsWith('/mensajes')) {
      setMessagesChatOpen(false)
      return undefined
    }
    const sync = event => setMessagesChatOpen(Boolean(event.detail?.open))
    setMessagesChatOpen(Boolean(window.__latidoMessagesChatOpen))
    window.addEventListener('latido:messages-chat-open', sync)
    return () => window.removeEventListener('latido:messages-chat-open', sync)
  }, [pathname])

  const isAdminPage = pathname === '/admin-latido' || pathname.startsWith('/admin-latido/')
  const isPublishFlow = PUBLISH_FLOW_PATHS.some(path => pathname === path || pathname.startsWith(`${path}/`))
  const isCreatorProfileArea = isCreatorProfileRoute(pathname)
  const hideMobileNav = isAdminPage || isPublishFlow || (pathname.startsWith('/mensajes') && messagesChatOpen)
  const isTabActive = tab => {
    if (tab.action) return false
    if (tab.id === 'inicio') return pathname === '/'
    if (tab.id === 'perfil') return pathname.startsWith('/perfil') || isCreatorProfileArea
    if (tab.id === 'explorar') return isExploreRoute(pathname)
    return pathname.startsWith(tab.path)
  }

  return (
    <>
      {/* Publish picker sheet */}
      {pickerOpen && (
        <div
          className="latido-overlay-backdrop latido-publish-picker"
          onClick={() => window.history.back()}
          style={{ position:'fixed', inset:0, zIndex:260, background:'rgba(0,0,0,0.45)', display:'flex', flexDirection:'column', justifyContent:'flex-end' }}
        >
          <div className="latido-sheet-panel latido-publish-picker__panel" onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:'24px 24px 0 0', padding:'16px 20px 40px' }}>
            <div style={{ width:36, height:4, background:'#E2EAF4', borderRadius:4, margin:'0 auto 20px' }} />
            <p style={{ fontFamily:PP, fontWeight:800, fontSize:17, color:'#0F172A', marginBottom:6 }}>¿Qué quieres publicar?</p>
            <p style={{ fontFamily:PP, fontSize:12, color:'#64748B', marginBottom:20 }}>Elige el tipo de publicación</p>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {PUBLISH_OPTIONS.map((opt, index) => (
                <button
                  key={opt.to}
                  className="latido-publish-picker__option"
                  onClick={() => { setPickerOpen(false); navigate(opt.to) }}
                  style={{ '--publish-option-index':index, display:'flex', alignItems:'center', gap:14, background:'#F8FAFF', border:'1px solid #E2EAF4', borderRadius:16, padding:'14px 16px', cursor:'pointer', textAlign:'left' }}
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

      {!hideMobileNav && <nav className="hide-md bottom-nav" style={{ transform: keyboardVisible && pathname.startsWith('/mensajes') ? 'translateY(calc(100% + 24px))' : 'translateZ(0)', transition:'transform 0.12s ease' }}>
        {TABS.map(tab => {
          const active = isTabActive(tab)
          const needsNotificationDot = tab.id === 'perfil' && needsPushActivation
          const to = (!isLoggedIn && (tab.id === 'mensajes' || tab.id === 'perfil')) ? '/auth' : tab.path

          if (tab.action === 'publish') {
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPickerOpen(true)}
                className="bottom-nav-item bottom-nav-publish"
                aria-haspopup="dialog"
                aria-expanded={pickerOpen}
                aria-label="Publicar"
              >
                <span className="bottom-nav-publish-mark" aria-hidden="true">
                  <span>{tab.emoji}</span>
                </span>
                <span className="bottom-nav-label" style={{ fontFamily:PP, fontSize:9, fontWeight:500 }}>{tab.label}</span>
              </button>
            )
          }

          return (
            <Link
              key={tab.id}
              to={to}
              className={`bottom-nav-item${active ? ' is-active' : ''}`}
              style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'8px 0 10px', gap:2, textDecoration:'none', color: active ? C.primary : C.light }}
            >
              <span className="bottom-nav-icon" style={{ position:'relative', display:'inline-flex' }}>
                {tab.id === 'perfil' && isLoggedIn
                  ? <Avatar name={displayName} size={24} src={avatarUrl} />
                  : <span style={{ fontSize:20, lineHeight:1 }}>{tab.emoji}</span>
                }
                {tab.id === 'mensajes' && hasUnread && (
                  <span style={{ position:'absolute', top:-2, right:-4, minWidth:8, height:8, borderRadius:4, background:'#EF4444', border:'1.5px solid #fff' }} />
                )}
                {needsNotificationDot && (
                  <span style={{ position:'absolute', top:-4, right:-5, minWidth:9, height:9, borderRadius:5, background:'#EF4444', border:'1.5px solid #fff', boxShadow:'0 0 0 2px rgba(239,68,68,0.14)' }} />
                )}
              </span>
              <span className="bottom-nav-label" style={{ fontFamily:PP, fontSize:9, fontWeight: active ? 700 : 500 }}>{tab.label}</span>
            </Link>
          )
        })}
      </nav>}
    </>
  )
}
