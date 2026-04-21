import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useUnreadMessages } from '../hooks/useUnreadMessages'
import { Avatar } from './UI'
import { C, PP } from '../lib/theme'

const TABS = [
  { path:'/',            emoji:'🏠', label:'Inicio' },
  { path:'/tablon',      emoji:'📌', label:'Anuncios' },
  { path:'/comunidades', emoji:'🤝', label:'Comunidad' },
  { path:'/mensajes',    emoji:'💬', label:'Mensajes' },
  { path:'/perfil',      emoji:'👤', label:'Perfil' },
]

const NO_FAB = ['/mensajes', '/publicar', '/publicar-empleo', '/publicar-evento', '/registrar-negocio', '/registrar-comunidad']

function getFab(pathname, search) {
  if (NO_FAB.includes(pathname)) return null

  const params = new URLSearchParams(search)

  if (pathname === '/comunidades') {
    const view = params.get('view') || 'comunidades'
    if (view === 'negocios')  return { label:'+ Negocio', to:'/registrar-negocio' }
    if (view === 'eventos')   return { label:'+ Evento',  to:'/publicar-evento' }
    return { label:'+ Comunidad', to:'/registrar-comunidad' }
  }

  if (pathname === '/tablon' && params.get('cat') === 'empleo') {
    return { label:'+ Empleo', to:'/publicar-empleo' }
  }

  return { label:'+ Anuncio', to:'/publicar' }
}

export default function BottomNav() {
  const { pathname, search } = useLocation()
  const { isLoggedIn, displayName, avatarUrl } = useAuth()
  const { hasUnread } = useUnreadMessages()

  const fab = getFab(pathname, search)
  const fabTo = fab ? (isLoggedIn ? fab.to : '/auth') : null

  return (
    <>
      {fab && (
        <Link
          to={fabTo}
          className="hide-md"
          style={{
            position:'fixed', bottom:76, right:18, zIndex:60,
            height:46, borderRadius:23,
            background:`linear-gradient(135deg, ${C.primaryDark}, ${C.primary})`,
            color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:13, fontWeight:700, textDecoration:'none',
            boxShadow:`0 4px 20px rgba(37,99,235,0.45)`,
            padding:'0 20px', whiteSpace:'nowrap',
            letterSpacing:-0.2,
          }}
          aria-label={fab.label}
        >
          {fab.label}
        </Link>
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
