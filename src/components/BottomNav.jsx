import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Avatar } from './UI'
import { C, PP } from '../lib/theme'

const TABS = [
  { path:'/',            emoji:'🏠', label:'Inicio' },
  { path:'/tablon',      emoji:'📋', label:'Anuncios' },
  { path:'/comunidades', emoji:'🤝', label:'Comunidad' },
  { path:'/mensajes',    emoji:'💬', label:'Mensajes' },
  { path:'/perfil',      emoji:'👤', label:'Perfil' },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  const { isLoggedIn, displayName, avatarUrl } = useAuth()

  return (
    <>
      <Link
        to={isLoggedIn ? '/publicar' : '/auth'}
        className="hide-md"
        style={{
          position:'fixed', bottom:76, right:18, zIndex:60,
          width:54, height:54, borderRadius:'50%',
          background:`linear-gradient(135deg, ${C.primaryDark}, ${C.primary})`,
          color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:28, fontWeight:700, textDecoration:'none',
          boxShadow:`0 4px 20px rgba(37,99,235,0.45)`,
        }}
        aria-label="Publicar"
      >
        +
      </Link>

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
              {tab.path === '/perfil' && isLoggedIn
                ? <Avatar name={displayName} size={24} src={avatarUrl} />
                : <span style={{ fontSize:20, lineHeight:1 }}>{tab.emoji}</span>
              }
              <span style={{ fontFamily:PP, fontSize:9, fontWeight: active ? 700 : 500 }}>{tab.label}</span>
              {active && <span style={{ width:20, height:3, background:C.primary, borderRadius:2 }} />}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
