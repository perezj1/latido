import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import GlobalSearch from '../components/GlobalSearch'
import { C, PP } from '../lib/theme'
import { Avatar, Tag, PrivacyTag } from '../components/UI'
import { MOCK_ADS, MOCK_COMMUNITIES, MOCK_POSTS, AD_CATS } from '../lib/constants'

export default function Home() {
  const { isLoggedIn, displayName, userCanton } = useAuth()
  const recentAds = MOCK_ADS.slice(0, 4)

  const QUICK = [
    { icon:'📌', label:'Tablón\nde anuncios', href:'/tablon',      bg:'#1D4ED8', sub:'Vivienda · cuidados · ventas' },
    { icon:'🤝', label:'Comunidades',        href:'/comunidades',  bg:'#059669', sub:'Grupos latinos en Suiza' },
    { icon:'📚', label:'Guías &\nTrámites',  href:'/documentos',   bg:'#7C3AED', sub:'Suiza en español' },
    { icon:'🎉', label:'Directorio\nEventos',href:'/directorio',   bg:'#B45309', sub:'DJs · catering · foto' },
  ]

  return (
    <div style={{ maxWidth:600, margin:'0 auto', padding:'16px 16px 100px' }}>
      {/* Greeting */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
        <div>
          <p style={{ fontFamily:PP, fontSize:11, color:C.light, marginBottom:1 }}>Buenas 👋</p>
          <p style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:C.text, letterSpacing:-0.5 }}>
            {isLoggedIn ? displayName.split(' ')[0] : '¡Bienvenido/a!'}
          </p>
          {userCanton && <p style={{ fontFamily:PP, fontSize:11, color:C.light, marginTop:1 }}>📍 Cantón {userCanton}</p>}
        </div>
        {isLoggedIn
          ? <Link to="/perfil"><Avatar name={displayName} size={44} /></Link>
          : <Link to="/auth" style={{ fontFamily:PP, fontWeight:700, fontSize:11, background:C.primary, color:'#fff', textDecoration:'none', borderRadius:12, padding:'9px 15px' }}>Entrar</Link>
        }
      </div>

      {/* Global search */}
      <div style={{ marginBottom:18 }}>
        <GlobalSearch size="sm" />
      </div>

      {/* 2×2 quick actions */}
      <div className="grid-2" style={{ gap:10, marginBottom:22 }}>
        {QUICK.map(a => (
          <Link key={a.href} to={a.href} style={{ background:a.bg, borderRadius:18, padding:'16px 14px', display:'flex', flexDirection:'column', gap:6, textDecoration:'none', position:'relative', overflow:'hidden', transition:'transform .15s' }}
            onMouseEnter={e => e.currentTarget.style.transform='scale(0.98)'}
            onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
            <div style={{ position:'absolute', right:-8, top:-8, width:52, height:52, borderRadius:'50%', background:'rgba(255,255,255,0.07)' }}/>
            <span style={{ fontSize:24 }}>{a.icon}</span>
            <span style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:'#fff', lineHeight:1.3, whiteSpace:'pre-line' }}>{a.label}</span>
            <span style={{ fontFamily:PP, fontSize:9, color:'rgba(255,255,255,0.65)' }}>{a.sub}</span>
          </Link>
        ))}
      </div>

      {/* Recent ads */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <p style={{ fontFamily:PP, fontWeight:700, fontSize:15, color:C.text }}>📌 Anuncios recientes</p>
        <Link to="/tablon" style={{ fontFamily:PP, fontSize:11, fontWeight:600, color:C.primary, textDecoration:'none' }}>Ver todos →</Link>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:22 }}>
        {recentAds.map(ad => {
          const cat = AD_CATS.find(c => c.id === ad.cat)
          const CC = { vivienda:{bg:'#DBEAFE',tc:'#1D4ED8'}, hogar:{bg:'#D1FAE5',tc:'#065F46'}, cuidados:{bg:'#FCE7F3',tc:'#9D174D'}, documentos:{bg:'#EDE9FE',tc:'#6D28D9'}, venta:{bg:'#FEF3C7',tc:'#92400E'}, servicios:{bg:'#CCFBF1',tc:'#0F766E'}, regalo:{bg:'#FEE2E2',tc:'#B91C1C'} }
          const cc = CC[ad.cat] || {bg:C.primaryLight,tc:C.primary}
          return (
            <Link key={ad.id} to="/tablon" style={{ textDecoration:'none' }}>
              <div style={{ background:'#fff', borderRadius:13, border:`1px solid ${C.border}`, padding:'10px 13px', display:'flex', gap:10, alignItems:'flex-start' }}>
                <div style={{ width:36, height:36, background:cc.bg, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, flexShrink:0 }}>{cat?.emoji}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontFamily:PP, fontWeight:600, fontSize:12, color:C.text, lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:4 }}>{ad.title}</p>
                  <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                    <PrivacyTag privacy={ad.privacy}/>
                    <Tag bg={cc.bg} color={cc.tc}>{cat?.emoji} {cat?.label}</Tag>
                    <span style={{ fontFamily:PP, fontSize:9, color:C.light }}>· {ad.canton} · {ad.ts}</span>
                  </div>
                </div>
                <span style={{ fontFamily:PP, fontSize:11, fontWeight:800, color:C.primary, flexShrink:0 }}>{ad.price}</span>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Communities */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <p style={{ fontFamily:PP, fontWeight:700, fontSize:15, color:C.text }}>🤝 Comunidades activas</p>
        <Link to="/comunidades" style={{ fontFamily:PP, fontSize:11, fontWeight:600, color:C.primary, textDecoration:'none' }}>Ver todas →</Link>
      </div>
      <div className="grid-2" style={{ gap:8, marginBottom:22 }}>
        {MOCK_COMMUNITIES.slice(0,4).map(c => (
          <Link key={c.id} to="/comunidades" style={{ textDecoration:'none', background:'#fff', border:`1px solid ${C.border}`, borderRadius:14, padding:'11px 12px', display:'flex', gap:8, alignItems:'center' }}>
            <span style={{ fontSize:22 }}>{c.emoji}</span>
            <div style={{ minWidth:0 }}>
              <p style={{ fontFamily:PP, fontWeight:600, fontSize:10, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:1, lineHeight:1.3 }}>{c.name}</p>
              <p style={{ fontFamily:PP, fontSize:9, color:C.light }}>👥 {c.members}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Publish CTA */}
      <div style={{ background:'linear-gradient(135deg,#1E40AF,#2563EB)', borderRadius:18, padding:'16px 18px', display:'flex', alignItems:'center', gap:14 }}>
        <span style={{ fontSize:28 }}>✏️</span>
        <div style={{ flex:1 }}>
          <p style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:'#fff', marginBottom:2 }}>Publica tu anuncio gratis</p>
          <p style={{ fontFamily:PP, fontSize:10, color:'rgba(255,255,255,0.7)' }}>Público o privado — tú decides quién ve tu contacto</p>
        </div>
        <Link to="/publicar" style={{ fontFamily:PP, fontWeight:700, fontSize:11, background:'#fff', color:C.primary, textDecoration:'none', borderRadius:10, padding:'9px 13px', flexShrink:0 }}>
          Publicar
        </Link>
      </div>
    </div>
  )
}
