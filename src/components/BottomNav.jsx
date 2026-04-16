import { Link, useLocation } from 'react-router-dom'
import { C, PP } from '../lib/theme'

const TABS = [
  { path:'/',             emoji:'🏠', label:'Inicio' },
  { path:'/tablon',       emoji:'📌', label:'Tablón' },
  { path:null,            emoji:'+',  label:'',      isFab:true },
  { path:'/comunidades',  emoji:'🤝', label:'Comunidad' },
  { path:'/perfil',       emoji:'👤', label:'Perfil' },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  return (
    <nav className="safe-bottom md:hidden" style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:50, background:'#fff', borderTop:`1px solid ${C.border}`, display:'flex', alignItems:'center' }}>
      {TABS.map((tab, i) => {
        if (tab.isFab) return (
          <div key="fab" style={{ flex:1, display:'flex', justifyContent:'center', alignItems:'center' }}>
            <Link to="/publicar" style={{ width:50, height:50, borderRadius:'50%', background:`linear-gradient(135deg, ${C.primaryDark}, ${C.primary})`, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, textDecoration:'none', marginTop:-20, boxShadow:`0 4px 18px rgba(37,99,235,0.45)`, fontWeight:700 }}>
              +
            </Link>
          </div>
        )
        const active = tab.path === '/' ? pathname === '/' : pathname.startsWith(tab.path)
        return (
          <Link key={tab.path} to={tab.path} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'8px 0 10px', gap:2, textDecoration:'none', color: active ? C.primary : C.light, transition:'color .15s' }}>
            <span style={{ fontSize:20, lineHeight:1 }}>{tab.emoji}</span>
            <span style={{ fontFamily:PP, fontSize:9, fontWeight: active ? 700 : 500 }}>{tab.label}</span>
            {active && <span style={{ width:20, height:3, background:C.primary, borderRadius:2 }} />}
          </Link>
        )
      })}
    </nav>
  )
}
