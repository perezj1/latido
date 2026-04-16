import { useState } from 'react'
import { Link } from 'react-router-dom'

const fmtPrice = p => {
  if (!p) return ''
  let s = p.trim()
  s = s.replace(/^([\d.,]+)\s+CHF\b(.*)/, 'CHF $1$2')
  s = s.replace(/^(CHF\s*[\d.,]+)\s+([^\s/].*)$/, '$1/$2')
  return s
}
import GlobalSearch from '../components/GlobalSearch'
import { C, PP } from '../lib/theme'
import { Tag, PrivacyTag, AdCard } from '../components/UI'
import { MOCK_ADS, AD_CATS } from '../lib/constants'

const FEATURES = [
  { icon:'📌', title:'Tablón de anuncios',     desc:'Vivienda, cuidados, ventas, regalos. Filtros por cantón y PLZ como el tablón de Migros, pero digital.', color:'#DBEAFE' },
  { icon:'🔒', title:'Privacidad a tu control',desc:'Cada anuncio puede ser público (visible para todos) o privado (solo usuarios con cuenta pueden ver el contacto).', color:'#FEF3C7' },
  { icon:'🤝', title:'Comunidades reales',     desc:'Grupos de colombianos, venezolanos y familias latinas. Conecta con gente de tu país en tu ciudad de Suiza.', color:'#D1FAE5' },
  { icon:'📚', title:'Guías de trámites',      desc:'Krankenkasse, Quellensteuer, permisos B/C/L. La burocracia suiza explicada en español, paso a paso.', color:'#EDE9FE' },
  { icon:'💼', title:'Empleos para latinos',    desc:'Ofertas en empresas y familias que valoran tu idioma y cultura. Trabajo en Suiza desde la comunidad.', color:'#FCE7F3' },
  { icon:'📱', title:'Instala como app',       desc:'Añade Latido a tu pantalla de inicio. Sin App Store. Sin Google Play. Solo toca "Instalar".', color:'#CCFBF1' },
]

export default function Landing({ onInstall }) {
  const previewAds = MOCK_ADS.slice(0, 6)
  const [revealed, setRevealed] = useState({})

  return (
    <div style={{ background:'#fff' }}>
      {/* ── HERO ── */}
      <section style={{ background:'linear-gradient(160deg, #1E40AF 0%, #2563EB 60%, #3B82F6 100%)', position:'relative', overflow:'hidden', padding:'60px 24px 72px' }}>
        <div style={{ position:'absolute', top:-60, right:-60, width:240, height:240, borderRadius:'50%', background:'rgba(255,255,255,0.05)' }}/>
        <div style={{ position:'absolute', bottom:-40, left:40, width:160, height:160, borderRadius:'50%', background:'rgba(255,255,255,0.04)' }}/>
        <div style={{ maxWidth:680, margin:'0 auto', position:'relative' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.15)', color:'#BAE6FD', fontSize:11, fontWeight:600, padding:'6px 14px', borderRadius:20, marginBottom:20, fontFamily:PP, border:'1px solid rgba(255,255,255,0.2)' }}>
            🇨🇭 La red latina de Suiza — completamente gratis
          </div>
          <h1 style={{ fontFamily:PP, fontWeight:900, fontSize:'clamp(28px,6vw,52px)', color:'#fff', lineHeight:1.15, margin:'0 0 16px', letterSpacing:-1 }}>
            Todo lo que necesitas<br/>en Suiza.<br/>
            <span style={{ color:'#BAE6FD', fontStyle:'italic' }}>En tu idioma.</span>
          </h1>
          <p style={{ fontFamily:PP, fontSize:15, color:'rgba(255,255,255,0.8)', lineHeight:1.7, marginBottom:28, maxWidth:480 }}>
            Tablón de anuncios, comunidades latinas, guías de trámites suizos y empleos — todo en español. Sin comisiones. Siempre gratis.
          </p>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <Link to="/tablon" style={{ fontFamily:PP, fontWeight:700, fontSize:13, background:'#fff', color:C.primary, textDecoration:'none', padding:'13px 24px', borderRadius:14, display:'inline-flex', alignItems:'center', gap:6 }}>
              📌 Ver el tablón
            </Link>
            <Link to="/auth" style={{ fontFamily:PP, fontWeight:700, fontSize:13, background:'rgba(255,255,255,0.15)', color:'#fff', textDecoration:'none', padding:'13px 22px', borderRadius:14, display:'inline-flex', alignItems:'center', gap:6, border:'1px solid rgba(255,255,255,0.3)' }}>
              Crear cuenta gratis
            </Link>
          </div>
          <div className="hero-stats" style={{ marginTop:48, paddingTop:36, borderTop:'1px solid rgba(255,255,255,0.15)' }}>
            {[['400k+','Latinos en Suiza'],['100%','Gratis siempre'],['🔒','Privacidad real'],['8','Secciones']].map(([v,l]) => (
              <div key={l}>
                <p style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:'#fff', margin:'0 0 2px' }}>{v}</p>
                <p style={{ fontFamily:PP, fontSize:11, color:'rgba(255,255,255,0.65)', margin:0 }}>{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ── Global Search ── */}
      <div style={{ background:C.bg, padding:'28px 24px', borderBottom:`1px solid ${C.border}` }}>
        <div style={{ maxWidth:680, margin:'0 auto' }}>
          <p style={{ fontFamily:PP, fontSize:13, color:C.mid, textAlign:'center', marginBottom:14 }}>
            🔍 Busca pisos, cuidadoras, DJs, trámites, comunidades y más
          </p>
          <GlobalSearch size="lg" />
        </div>
      </div>

      {/* ── ADS PREVIEW ── */}
      <section style={{ maxWidth:900, margin:'0 auto', padding:'52px 24px 0' }}>
        <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:26, color:C.text, marginBottom:6, letterSpacing:-0.5 }}>📌 Anuncios recientes</h2>
        <p style={{ fontFamily:PP, fontSize:13, color:C.mid, marginBottom:24, lineHeight:1.6 }}>
          Los anuncios <span style={{ color:'#065F46', fontWeight:600 }}>🌐 públicos</span> son visibles para todos.
          Los <span style={{ color:'#92400E', fontWeight:600 }}>🔒 privados</span> muestran el contacto solo a usuarios registrados.
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:14, marginBottom:20 }}>
          {previewAds.map(ad => {
            const cat = AD_CATS.find(c => c.id === ad.cat)
            const isPrivate = ad.privacy === 'private'
            const isRevealed = !!revealed[ad.id]
            return (
              <div key={ad.id} style={{ background:C.bg, borderRadius:16, border:`1px solid ${C.border}`, padding:'13px 14px' }}>
                <div style={{ display:'flex', gap:5, marginBottom:8, flexWrap:'wrap' }}>
                  {isPrivate
                    ? <Tag bg="#FEF3C7" color="#92400E">🔒 Privado</Tag>
                    : <Tag bg="#D1FAE5" color="#065F46">🌐 Público</Tag>}
                  <Tag bg="#DBEAFE" color={C.primary}>{cat?.emoji} {cat?.label}</Tag>
                  <span style={{ fontFamily:PP, fontSize:9, color:C.light }}>📍 {ad.canton}</span>
                </div>
                <p style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:C.text, marginBottom:4, lineHeight:1.35 }}>{ad.title}</p>
                <p style={{ fontFamily:PP, fontSize:11, color:C.mid, lineHeight:1.5, marginBottom:8, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{ad.desc}</p>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <span style={{ fontFamily:PP, fontSize:10, color:C.light }}>{ad.user} · {ad.ts}</span>
                  <span style={{ fontFamily:PP, fontSize:12, fontWeight:800, color:C.primary }}>{fmtPrice(ad.price)}</span>
                </div>

                {/* Contact area */}
                {isRevealed && !isPrivate ? (
                  <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:10, padding:'10px 12px', display:'flex', flexDirection:'column', gap:6 }}>
                    {ad.contact_phone && (
                      <a href={`https://wa.me/${ad.contact_phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                        style={{ fontFamily:PP, fontSize:12, fontWeight:700, color:'#065F46', textDecoration:'none', display:'flex', alignItems:'center', gap:6 }}>
                        💬 {ad.contact_phone}
                      </a>
                    )}
                    {ad.contact_email && (
                      <a href={`mailto:${ad.contact_email}`}
                        style={{ fontFamily:PP, fontSize:12, fontWeight:700, color:'#065F46', textDecoration:'none', display:'flex', alignItems:'center', gap:6 }}>
                        ✉️ {ad.contact_email}
                      </a>
                    )}
                    {!ad.contact_phone && !ad.contact_email && (
                      <p style={{ fontFamily:PP, fontSize:11, color:'#065F46', margin:0 }}>Sin datos de contacto</p>
                    )}
                  </div>
                ) : isRevealed && isPrivate ? (
                  <div style={{ background:C.warnLight, border:`1px solid ${C.warnMid}`, borderRadius:10, padding:'12px 14px' }}>
                    <p style={{ fontFamily:PP, fontSize:12, fontWeight:600, color:'#92400E', margin:'0 0 8px' }}>
                      🔒 Para ver contactos privados crea una cuenta gratuita
                    </p>
                    <Link to="/auth" style={{ fontFamily:PP, fontWeight:700, fontSize:12, background:C.primary, color:'#fff', textDecoration:'none', borderRadius:10, padding:'9px 14px', display:'inline-flex', alignItems:'center', gap:5 }}>
                      Registrarse gratis →
                    </Link>
                  </div>
                ) : (
                  <button onClick={() => setRevealed(r => ({ ...r, [ad.id]: true }))}
                    style={{ width:'100%', background: isPrivate ? C.warnLight : '#F0FDF4', border:`1px solid ${isPrivate ? C.warnMid : '#BBF7D0'}`, borderRadius:10, padding:'9px 12px', fontFamily:PP, fontSize:11, fontWeight:700, color: isPrivate ? '#92400E' : '#065F46', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                    {isPrivate ? '🔒 Ver contacto →' : '🌐 Ver contacto →'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ textAlign:'center', paddingTop:4, paddingBottom:8 }}>
          <Link to="/tablon" style={{ fontFamily:PP, fontSize:12, fontWeight:600, color:C.primary, textDecoration:'none' }}>Ver todos los anuncios →</Link>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ background:C.bg, marginTop:52, padding:'52px 24px' }}>
        <div style={{ maxWidth:900, margin:'0 auto' }}>
          <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:26, color:C.text, marginBottom:6, textAlign:'center', letterSpacing:-0.5 }}>¿Qué encontrarás?</h2>
          <p style={{ fontFamily:PP, fontSize:13, color:C.mid, textAlign:'center', marginBottom:36 }}>Todo lo que necesitas como latino en Suiza, en un solo lugar</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:14 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{ background:'#fff', borderRadius:20, padding:'20px 18px', border:`1px solid ${C.border}`, transition:'all .2s' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow='0 8px 24px rgba(37,99,235,0.1)'; e.currentTarget.style.transform='translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow='none'; e.currentTarget.style.transform='translateY(0)' }}>
                <div style={{ width:48, height:48, background:f.color, borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, marginBottom:14 }}>{f.icon}</div>
                <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:15, color:C.text, marginBottom:7 }}>{f.title}</h3>
                <p style={{ fontFamily:PP, fontSize:12, color:C.mid, lineHeight:1.65 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRIVACY EXPLAINER ── */}
      <section style={{ maxWidth:900, margin:'0 auto', padding:'52px 24px' }}>
        <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:26, color:C.text, marginBottom:6, letterSpacing:-0.5 }}>🔒 Tu privacidad, tu decisión</h2>
        <p style={{ fontFamily:PP, fontSize:13, color:C.mid, marginBottom:28, lineHeight:1.7 }}>Al publicar un anuncio en Latido.ch, tú eliges quién puede ver tu contacto.</p>
        <div className="grid-2" style={{ gap:16 }}>
          <div style={{ background:C.successLight, border:`2px solid ${C.successMid}`, borderRadius:20, padding:'22px 20px' }}>
            <p style={{ fontSize:32, marginBottom:10 }}>🌐</p>
            <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:17, color:'#065F46', marginBottom:8 }}>Anuncio Público</h3>
            <p style={{ fontFamily:PP, fontSize:12, color:'#065F46', lineHeight:1.7, marginBottom:12, opacity:.9 }}>Tu contacto (WhatsApp, email) es visible para <strong>cualquier persona</strong> que visite la web, sin necesidad de cuenta.</p>
            <p style={{ fontFamily:PP, fontSize:11, color:'#065F46', opacity:.7 }}>✓ Más alcance · ✓ Más respuestas</p>
          </div>
          <div style={{ background:C.warnLight, border:`2px solid ${C.warnMid}`, borderRadius:20, padding:'22px 20px' }}>
            <p style={{ fontSize:32, marginBottom:10 }}>🔒</p>
            <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:17, color:'#92400E', marginBottom:8 }}>Anuncio Privado</h3>
            <p style={{ fontFamily:PP, fontSize:12, color:'#92400E', lineHeight:1.7, marginBottom:12, opacity:.9 }}>Tu contacto solo es visible para usuarios <strong>registrados y verificados</strong>. El anuncio aparece en el tablón, pero el contacto está protegido.</p>
            <p style={{ fontFamily:PP, fontSize:11, color:'#92400E', opacity:.7 }}>✓ Más seguridad · ✓ Mayor calidad de contactos</p>
          </div>
        </div>
      </section>

      {/* ── PWA INSTALL ── */}
      <section style={{ background:'linear-gradient(135deg,#1E3A8A,#1D4ED8)', padding:'52px 24px', margin:'0 0 0' }}>
        <div style={{ maxWidth:700, margin:'0 auto', textAlign:'center' }}>
          <p style={{ fontSize:48, marginBottom:12 }}>📱</p>
          <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:24, color:'#fff', marginBottom:10, letterSpacing:-0.5 }}>Instala Latido como app</h2>
          <p style={{ fontFamily:PP, fontSize:13, color:'rgba(255,255,255,0.75)', lineHeight:1.7, marginBottom:28 }}>
            Sin pasar por la App Store. Sin Google Play. Añádela a tu pantalla de inicio directamente desde el navegador y tendrás la experiencia completa de app.
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:10, marginBottom:28 }}>
            {[['🍎 iPhone / iPad','Safari → Compartir → "Añadir a inicio"'],['🤖 Android','Chrome → Menú → "Instalar app"'],['💻 PC / Mac','Chrome/Edge → Icono en barra de URL']].map(([d,i]) => (
              <div key={d} style={{ background:'rgba(255,255,255,0.08)', borderRadius:14, padding:'14px 12px', textAlign:'center' }}>
                <p style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:'#BAE6FD', marginBottom:5 }}>{d}</p>
                <p style={{ fontFamily:PP, fontSize:11, color:'rgba(255,255,255,0.65)', lineHeight:1.5 }}>{i}</p>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
            <Link to="/tablon" style={{ fontFamily:PP, fontWeight:700, fontSize:13, background:'#fff', color:C.primary, textDecoration:'none', padding:'13px 24px', borderRadius:14, display:'inline-flex', alignItems:'center', gap:6 }}>
              Explorar la web →
            </Link>
            <Link to="/auth" style={{ fontFamily:PP, fontWeight:700, fontSize:13, background:'rgba(255,255,255,0.15)', color:'#fff', textDecoration:'none', padding:'13px 22px', borderRadius:14, display:'inline-flex', alignItems:'center', gap:6, border:'1px solid rgba(255,255,255,0.3)' }}>
              Crear cuenta gratis
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
