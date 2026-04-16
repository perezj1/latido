import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import GlobalSearch from '../components/GlobalSearch'
import { C, PP } from '../lib/theme'
import { Avatar, Tag, PrivacyTag } from '../components/UI'
// Tag kept for ad category chips below
import { MOCK_ADS, MOCK_COMMUNITIES, AD_CATS } from '../lib/constants'

const ACTIONS = [
  { href:'/tablon', icon:'📌', title:'Tablón activo', desc:'Pisos, trabajo, cuidados y ventas cerca de ti.', bg:'#DBEAFE', color:'#1D4ED8' },
  { href:'/publicar', icon:'✍️', title:'Publica en minutos', desc:'Crea un anuncio público o privado y listo.', bg:'#E0F2FE', color:'#0369A1' },
  { href:'/comunidades', icon:'🤝', title:'Conecta con gente', desc:'Encuentra tu país, ciudad o grupo afín.', bg:'#D1FAE5', color:'#065F46' },
  { href:'/guias', icon:'📚', title:'Resuelve trámites', desc:'Guías claras para vivir y moverte en Suiza.', bg:'#EDE9FE', color:'#6D28D9' },
]

const CAT_COLORS = {
  vivienda:{ bg:'#DBEAFE', tc:'#1D4ED8' },
  hogar:{ bg:'#D1FAE5', tc:'#065F46' },
  cuidados:{ bg:'#FCE7F3', tc:'#9D174D' },
  documentos:{ bg:'#EDE9FE', tc:'#6D28D9' },
  venta:{ bg:'#FEF3C7', tc:'#92400E' },
  servicios:{ bg:'#CCFBF1', tc:'#0F766E' },
  regalo:{ bg:'#FEE2E2', tc:'#B91C1C' },
}

export default function Home() {
  const { displayName, userCanton, isLoggedIn } = useAuth()
  const firstName = displayName.split(' ')[0]
  const recentAds = MOCK_ADS.slice(0, 4)
  const communityHighlights = MOCK_COMMUNITIES.slice(0, 3)

  return (
    <div style={{ background:'#fff' }}>
      <section style={{ background:'linear-gradient(160deg, #1E40AF 0%, #2563EB 58%, #60A5FA 100%)', position:'relative', overflow:'hidden', padding:'26px 16px 34px' }}>
        <div style={{ position:'absolute', top:-70, right:-60, width:220, height:220, borderRadius:'50%', background:'rgba(255,255,255,0.07)' }} />
        <div style={{ position:'absolute', bottom:-60, left:-20, width:180, height:180, borderRadius:'50%', background:'rgba(255,255,255,0.05)' }} />
        <div style={{ maxWidth:980, margin:'0 auto', position:'relative' }}>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10 }}>
            {isLoggedIn && (
              <Link to="/perfil" style={{ textDecoration:'none' }}>
                <Avatar name={displayName} size={46} />
              </Link>
            )}
          </div>

          <div style={{ maxWidth:620 }}>
            <p style={{ fontFamily:PP, fontSize:12, color:'rgba(255,255,255,0.75)', margin:'0 0 8px' }}>Tu espacio dentro de Latido</p>
            <h1 style={{ fontFamily:PP, fontWeight:900, fontSize:'clamp(30px,6vw,48px)', lineHeight:1.12, letterSpacing:-1, color:'#fff', margin:'0 0 14px' }}>
              Hola, {firstName}.<br />
              La app ya es tuya.
            </h1>
            <p style={{ fontFamily:PP, fontSize:14, color:'rgba(255,255,255,0.82)', lineHeight:1.7, maxWidth:520, margin:'0 0 24px' }}>
              Publica, busca, conecta y resuelve trámites desde un inicio pensado para usuarios que ya forman parte de la comunidad.
            </p>
            <div style={{ marginBottom:22 }}>
              <GlobalSearch
                size="lg"
                placeholder="Busca pisos, cuidadoras, DJs, comunidades o trámites..."
              />
            </div>
            <Link to="/tablon" style={{ fontFamily:PP, fontWeight:700, fontSize:13, background:'#fff', color:C.primary, textDecoration:'none', padding:'13px 20px', borderRadius:14, display:'inline-flex', alignItems:'center', gap:6 }}>
              Buscar en la comunidad
            </Link>
          </div>
        </div>
      </section>

     {/*  <section style={{ maxWidth:980, margin:'0 auto', padding:'34px 16px 8px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', gap:14, marginBottom:18 }}>
          <div>
            <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:26, color:C.text, margin:'0 0 6px', letterSpacing:-0.5 }}>Tu inicio, como una landing privada</h2>
            <p style={{ fontFamily:PP, fontSize:13, color:C.mid, margin:0, lineHeight:1.7 }}>
              Lo más importante de la plataforma, pero ordenado para alguien que ya entró y quiere actuar rápido.
            </p>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12 }}>
          {ACTIONS.map(action => (
            <Link key={action.href} to={action.href} style={{ background:'#fff', border:`1px solid ${C.border}`, borderRadius:22, padding:'18px 18px 17px', textDecoration:'none', boxShadow:'0 10px 24px rgba(15,23,42,0.04)' }}>
              <div style={{ width:50, height:50, borderRadius:16, background:action.bg, display:'grid', placeItems:'center', fontSize:24, marginBottom:14 }}>{action.icon}</div>
              <p style={{ fontFamily:PP, fontWeight:800, fontSize:16, color:C.text, margin:'0 0 6px' }}>{action.title}</p>
              <p style={{ fontFamily:PP, fontSize:12, color:C.mid, lineHeight:1.65, margin:'0 0 12px' }}>{action.desc}</p>
              <span style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:action.color }}>Abrir →</span>
            </Link>
          ))}
        </div>
      </section> */}

      <section style={{ maxWidth:980, margin:'0 auto', padding:'34px 16px 0' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, gap:12 }}>
          <div>
            <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:20, color:C.text, margin:'0 0 6px', letterSpacing:-0.5 }}>📌 Anuncios recientes</h2>
            <p style={{ fontFamily:PP, fontSize:12, color:C.mid, margin:0, lineHeight:1.7 }}>
              Los últimos anuncios de la comunidad.
            </p>
          </div>
          <Link to="/tablon" style={{ fontFamily:PP, fontSize:12, fontWeight:700, color:C.primary, textDecoration:'none', whiteSpace:'nowrap' }}>Ver todos →</Link>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:14 }}>
          {recentAds.map(ad => {
            const cat = AD_CATS.find(c => c.id === ad.cat)
            const cc = CAT_COLORS[ad.cat] || { bg:C.primaryLight, tc:C.primary }
            return (
              <Link key={ad.id} to="/tablon" style={{ textDecoration:'none' }}>
                <div style={{ background:C.bg, borderRadius:18, border:`1px solid ${C.border}`, padding:'15px 15px 14px', height:'100%' }}>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
                    <PrivacyTag privacy={ad.privacy} />
                    <Tag bg={cc.bg} color={cc.tc}>{cat?.emoji} {cat?.label}</Tag>
                    <Tag bg="#fff" color={C.light}>{ad.canton}</Tag>
                  </div>
                  <p style={{ fontFamily:PP, fontWeight:700, fontSize:14, color:C.text, lineHeight:1.4, margin:'0 0 7px' }}>{ad.title}</p>
                  <p style={{ fontFamily:PP, fontSize:12, color:C.mid, lineHeight:1.65, margin:'0 0 14px', display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{ad.desc}</p>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
                    <span style={{ fontFamily:PP, fontSize:10, color:C.light }}>{ad.user} · {ad.ts}</span>
                    <span style={{ fontFamily:PP, fontSize:12, fontWeight:800, color:C.primary }}>{ad.price}</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      <section style={{ maxWidth:980, margin:'0 auto', padding:'40px 16px 0' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <div>
            <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:20, color:C.text, margin:'0 0 4px' }}>🤝 Comunidades para ti</h2>
            <p style={{ fontFamily:PP, fontSize:12, color:C.mid, margin:0 }}>Tus próximos puntos de conexión en Suiza.</p>
          </div>
          <Link to="/comunidades" style={{ fontFamily:PP, fontSize:11, fontWeight:700, color:C.primary, textDecoration:'none' }}>Ver más →</Link>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:10 }}>
          {communityHighlights.map(group => (
            <Link key={group.id} to="/comunidades" style={{ textDecoration:'none', background:'#fff', border:`1px solid ${C.border}`, borderRadius:18, padding:'14px 15px', display:'flex', gap:12, alignItems:'center' }}>
              <span style={{ fontSize:30 }}>{group.emoji}</span>
              <div style={{ minWidth:0 }}>
                <p style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:C.text, margin:'0 0 3px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{group.name}</p>
                <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>{group.city} · 👥 {group.members} miembros</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section style={{ maxWidth:980, margin:'0 auto', padding:'42px 16px 110px' }}>
        <div style={{ background:'linear-gradient(135deg,#1E3A8A,#2563EB)', borderRadius:28, padding:'24px 22px', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', right:-28, top:-28, width:120, height:120, borderRadius:'50%', background:'rgba(255,255,255,0.08)' }} />
          <div style={{ position:'relative', display:'flex', justifyContent:'space-between', alignItems:'center', gap:16, flexWrap:'wrap' }}>
            <div style={{ maxWidth:520 }}>
              <p style={{ fontFamily:PP, fontWeight:800, fontSize:24, color:'#fff', margin:'0 0 8px', letterSpacing:-0.5 }}>Tu sesión se mantendrá activa hasta que cierres manualmente.</p>
              <p style={{ fontFamily:PP, fontSize:13, color:'rgba(255,255,255,0.76)', lineHeight:1.7, margin:0 }}>
                Ya no necesitas volver a entrar cada vez. Desde aquí puedes seguir explorando o publicar algo ahora mismo.
              </p>
            </div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              <Link to="/publicar" style={{ fontFamily:PP, fontWeight:700, fontSize:13, background:'#fff', color:C.primary, textDecoration:'none', padding:'13px 20px', borderRadius:14 }}>
                Publicar anuncio
              </Link>
              <Link to="/perfil" style={{ fontFamily:PP, fontWeight:700, fontSize:13, background:'rgba(255,255,255,0.14)', color:'#fff', textDecoration:'none', padding:'13px 20px', borderRadius:14, border:'1px solid rgba(255,255,255,0.22)' }}>
                Ir a mi perfil
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
