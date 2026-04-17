import { useState } from 'react'
import { Link } from 'react-router-dom'
import GlobalSearch from '../components/GlobalSearch'
import { C, PP } from '../lib/theme'
import { Tag } from '../components/UI'
import { MOCK_ADS, AD_CATS } from '../lib/constants'

const fmtPrice = p => {
  if (!p) return ''
  let s = p.trim()
  s = s.replace(/^([\d.,]+)\s+CHF\b(.*)/, 'CHF $1$2')
  s = s.replace(/^(CHF\s*[\d.,]+)\s+([^\s/].*)$/, '$1/$2')
  return s
}

const FEATURES = [
  {
    icon:'📌',
    title:'El tablón de los nuestros',
    desc:'Pisos, trabajo, cuidados, ventas, regalos. Publica o encuentra en segundos. Filtros por cantón y código postal — como debe ser.',
    color:'#DBEAFE',
  },
  {
    icon:'🤝',
    title:'Tu gente, donde estés',
    desc:'Colombianos en Zürich, venezolanos en Ginebra, familias latinas en Bern. Encuentra a los tuyos en tu ciudad.',
    color:'#D1FAE5',
  },
  {
    icon:'📚',
    title:'Suiza sin laberintos',
    desc:'Krankenkasse, Quellensteuer, permisos B/C/L. La burocracia suiza explicada en español, paso a paso, sin tecnicismos ni sorpresas.',
    color:'#EDE9FE',
  },
  {
    icon:'💼',
    title:'Trabajo para los nuestros',
    desc:'Empresas y familias que valoran tu idioma, tu historia y tu talento. Empleo digno, publicado por y para la comunidad.',
    color:'#FCE7F3',
  },
  /* {
    icon:'🔒',
    title:'Tu privacidad, tu control',
    desc:'Tú decides quién ve tu número. Cada anuncio puede ser público o privado. El control siempre es tuyo.',
    color:'#FEF3C7',
  }, */
  {
    icon:'📱',
    title:'Siempre en tu bolsillo',
    desc:'Instálala como app directamente desde el navegador. Sin App Store, sin Google Play. Un toque y lista.',
    color:'#CCFBF1',
  },
]

export default function Landing({ onInstall }) {
  const previewAds = MOCK_ADS.slice(0, 6)
  const [revealed, setRevealed] = useState({})

  return (
    <div style={{ background:'#fff' }}>

      {/* ── HERO ── */}
      <section style={{ background:'linear-gradient(160deg, #1E40AF 0%, #2563EB 58%, #3B82F6 100%)', position:'relative', overflow:'hidden', padding:'64px 24px 80px' }}>
        <div style={{ position:'absolute', top:-80, right:-60, width:280, height:280, borderRadius:'50%', background:'rgba(255,255,255,0.06)' }}/>
        <div style={{ position:'absolute', bottom:-50, left:20, width:200, height:200, borderRadius:'50%', background:'rgba(255,255,255,0.04)' }}/>
        <div style={{ maxWidth:680, margin:'0 auto', position:'relative' }}>
          {/* <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.15)', color:'#BAE6FD', fontSize:11, fontWeight:700, padding:'7px 16px', borderRadius:20, marginBottom:24, fontFamily:PP, border:'1px solid rgba(255,255,255,0.25)', letterSpacing:0.3 }}>
            🇨🇭 La primera plataforma exclusiva para hispanohablantes en Suiza
          </div> */}
          <h1 style={{ fontFamily:PP, fontWeight:900, fontSize:'clamp(32px,6.5vw,56px)', color:'#fff', lineHeight:1.1, margin:'0 0 20px', letterSpacing:-1.5 }}>
            Lejos de casa.<br/>
            Pero nunca<br/>
            <span style={{ color:'#BAE6FD', fontStyle:'italic' }}>solos.</span>
          </h1>
          <p style={{ fontFamily:PP, fontSize:16, color:'rgba(255,255,255,0.85)', lineHeight:1.75, marginBottom:32, maxWidth:500 }}>
            Latido es la <strong style={{ color:'#fff' }}>primera plataforma creada exclusivamente para la comunidad hispanohablante en Suiza</strong>. Anuncios, comunidades, empleos y guías de trámites — todo en español, entre nosotros. <strong style={{ color:'#fff' }}>Sin comisiones. Gratis para siempre.</strong>
          </p>
           <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.15)', color:'#FFFFFF', fontSize:11, fontWeight:500, padding:'7px 16px', borderRadius:20, marginBottom:24, fontFamily:PP, border:'1px solid rgba(255,255,255,0.25)', letterSpacing:0.3 }}>
            La fuerza de nuestra gente en un solo LATIDO
          </div> 
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <Link to="/tablon" style={{ fontFamily:PP, fontWeight:800, fontSize:14, background:'#fff', color:C.primary, textDecoration:'none', padding:'14px 26px', borderRadius:14, display:'inline-flex', alignItems:'center', gap:7 }}>
              Explorar la comunidad →
            </Link>
            <Link to="/auth" style={{ fontFamily:PP, fontWeight:700, fontSize:14, background:'rgba(255,255,255,0.15)', color:'#fff', textDecoration:'none', padding:'14px 22px', borderRadius:14, display:'inline-flex', alignItems:'center', gap:6, border:'1px solid rgba(255,255,255,0.35)' }}>
              Unirme gratis
            </Link>
          </div>
          
          <div className="hero-stats" style={{ marginTop:52, paddingTop:36, borderTop:'1px solid rgba(255,255,255,0.15)' }}>
            {[
              ['400k+', 'Hispanohablantes en Suiza'],
              ['26',    'Cantones cubiertos'],
              ['0 CHF', 'Siempre gratis'],
              ['🤝',    'Entre nosotros'],
            ].map(([v, l]) => (
              <div key={l}>
                <p style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:'#fff', margin:'0 0 3px' }}>{v}</p>
                <p style={{ fontFamily:PP, fontSize:11, color:'rgba(255,255,255,0.6)', margin:0 }}>{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SEARCH ── */}
      <div style={{ background:C.bg, padding:'30px 24px', borderBottom:`1px solid ${C.border}` }}>
        <div style={{ maxWidth:680, margin:'0 auto' }}>
          <p style={{ fontFamily:PP, fontSize:14, fontWeight:600, color:C.text, textAlign:'center', marginBottom:6 }}>
            ¿Qué necesitas hoy?
          </p>
          <p style={{ fontFamily:PP, fontSize:12, color:C.mid, textAlign:'center', marginBottom:16 }}>
            Pisos, cuidadoras, empleos, trámites, comunidades y mucho más
          </p>
          <GlobalSearch size="lg" />
        </div>
      </div>

      {/* ── PRIMERA PLATAFORMA ── */}
      <div style={{ background:'linear-gradient(90deg, #EFF6FF, #F0FDF4)', borderTop:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}`, padding:'22px 24px' }}>
        <p style={{ fontFamily:PP, fontWeight:700, fontSize:14, color:C.text, textAlign:'center', margin:0, lineHeight:1.6 }}>
          🏆 <strong>La primera y única plataforma pensada exclusivamente para hispanohablantes en Suiza.</strong>{' '}
{/*           <span style={{ color:C.mid, fontWeight:400 }}>Sin anuncios de terceros. Sin comisiones. Solo nuestra comunidad.</span>
 */}        </p>
      </div>

      {/* ── ADS PREVIEW ── */}
      <section style={{ maxWidth:900, margin:'0 auto', padding:'56px 24px 0' }}>
        <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:26, color:C.text, marginBottom:8, letterSpacing:-0.5 }}>
          Lo que busca y ofrece la comunidad
        </h2>
        <p style={{ fontFamily:PP, fontSize:14, color:C.mid, marginBottom:28, lineHeight:1.7 }}>
          Anuncios e información en nuestro idioma. Sin intermediarios, directo entre personas.{' '}<br/><br/>
          <span style={{ color:'#065F46', fontWeight:600 }}>🌐 Públicos</span> los ve cualquiera.{' '}<br/>
          <span style={{ color:'#92400E', fontWeight:600 }}>🔒 Privados</span> solo los registrados.
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:14, marginBottom:24 }}>
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
                    <p style={{ fontFamily:PP, fontSize:12, fontWeight:600, color:'#92400E', margin:'0 0 10px' }}>
                      🔒 Crea tu cuenta gratis para ver este contacto
                    </p>
                    <Link to="/auth" style={{ fontFamily:PP, fontWeight:700, fontSize:12, background:C.primary, color:'#fff', textDecoration:'none', borderRadius:10, padding:'9px 16px', display:'inline-flex', alignItems:'center', gap:5 }}>
                      Unirme a Latido →
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
        <div style={{ textAlign:'center', paddingBottom:8 }}>
          <Link to="/tablon" style={{ fontFamily:PP, fontSize:13, fontWeight:700, color:C.primary, textDecoration:'none' }}>
            Ver todos los anuncios →
          </Link>
        </div>
      </section>

      {/* ── BRAND PHRASE ── */}
      <section style={{ background:'linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%)', padding:'64px 24px', marginTop:56 }}>
        <div style={{ maxWidth:700, margin:'0 auto', textAlign:'center' }}>
          <p style={{ fontFamily:PP, fontSize:13, fontWeight:600, color:'rgba(255,255,255,0.5)', letterSpacing:2, textTransform:'uppercase', marginBottom:18 }}>
            Por qué existimos
          </p>
          <h2 style={{ fontFamily:PP, fontWeight:900, fontSize:'clamp(26px,5vw,44px)', color:'#fff', lineHeight:1.2, letterSpacing:-1, marginBottom:20 }}>
            "La fuerza de nuestra gente<br/>
            <span style={{ color:'#60A5FA' }}>en un mismo latido."</span>
          </h2>
          <p style={{ fontFamily:PP, fontSize:15, color:'rgba(255,255,255,0.75)', lineHeight:1.8, maxWidth:540, margin:'0 auto 32px' }}>
            En Suiza somos 400.000. Hablamos español, extrañamos el sol y sabemos lo que cuesta construir una vida aquí.
            Nunca había existido un espacio hecho solo para nosotros — hasta ahora.
            Latido nació para que no tengas que hacerlo solo.
          </p>
          <Link to="/auth" style={{ fontFamily:PP, fontWeight:800, fontSize:14, background:'#fff', color:'#1E3A8A', textDecoration:'none', padding:'15px 32px', borderRadius:16, display:'inline-flex', alignItems:'center', gap:8 }}>
            Quiero ser parte de esto →
          </Link>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ background:C.bg, padding:'60px 24px' }}>
        <div style={{ maxWidth:900, margin:'0 auto' }}>
          <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:28, color:C.text, marginBottom:8, textAlign:'center', letterSpacing:-0.5 }}>
            Construido para nosotros. 
          </h2>
          <p style={{ fontFamily:PP, fontSize:14, color:C.mid, textAlign:'center', marginBottom:40, lineHeight:1.6 }}>
            Cada función de Latido fue diseñada pensando en la realidad de los hispanohablantes en Suiza. En tu idioma, para tu vida aquí.
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:14 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{ background:'#fff', borderRadius:20, padding:'22px 20px', border:`1px solid ${C.border}`, transition:'all .2s' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow='0 8px 28px rgba(37,99,235,0.12)'; e.currentTarget.style.transform='translateY(-3px)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow='none'; e.currentTarget.style.transform='translateY(0)' }}>
                <div style={{ width:50, height:50, background:f.color, borderRadius:15, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, marginBottom:14 }}>{f.icon}</div>
                <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:15, color:C.text, marginBottom:8 }}>{f.title}</h3>
                <p style={{ fontFamily:PP, fontSize:12, color:C.mid, lineHeight:1.7 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRIVACY EXPLAINER ── */}
      <section style={{ maxWidth:900, margin:'0 auto', padding:'56px 24px' }}>
        <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:26, color:C.text, marginBottom:8, letterSpacing:-0.5 }}>
          🔒 Tú decides quién te contacta
        </h2>
        <p style={{ fontFamily:PP, fontSize:14, color:C.mid, marginBottom:30, lineHeight:1.7 }}>
          Tu número es tuyo. Tu email también. Cada anuncio que publicas tiene dos modos — elige el que te da más tranquilidad.
        </p>
        <div className="grid-2" style={{ gap:16 }}>
          <div style={{ background:C.successLight, border:`2px solid ${C.successMid}`, borderRadius:20, padding:'24px 22px' }}>
            <p style={{ fontSize:34, marginBottom:12 }}>🌐</p>
            <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:17, color:'#065F46', marginBottom:10 }}>Anuncio Público</h3>
            <p style={{ fontFamily:PP, fontSize:13, color:'#065F46', lineHeight:1.75, marginBottom:12, opacity:.9 }}>
              Tu contacto (WhatsApp o email) es visible para <strong>cualquier persona</strong> que visite la web, sin necesidad de cuenta. Máximo alcance, máximas respuestas.
            </p>
            <p style={{ fontFamily:PP, fontSize:12, color:'#065F46', opacity:.75 }}>✓ Más alcance &nbsp;·&nbsp; ✓ Más respuestas</p>
          </div>
          <div style={{ background:C.warnLight, border:`2px solid ${C.warnMid}`, borderRadius:20, padding:'24px 22px' }}>
            <p style={{ fontSize:34, marginBottom:12 }}>🔒</p>
            <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:17, color:'#92400E', marginBottom:10 }}>Anuncio Privado</h3>
            <p style={{ fontFamily:PP, fontSize:13, color:'#92400E', lineHeight:1.75, marginBottom:12, opacity:.9 }}>
              Tu contacto solo lo ven usuarios <strong>registrados y verificados</strong>. El anuncio aparece en el tablón público, pero tu número está protegido.
            </p>
            <p style={{ fontFamily:PP, fontSize:12, color:'#92400E', opacity:.75 }}>✓ Más seguridad &nbsp;·&nbsp; ✓ Contactos de calidad</p>
          </div>
        </div>
      </section>

      {/* ── PWA INSTALL ── */}
      <section style={{ background:'linear-gradient(135deg, #1E3A8A, #2563EB)', padding:'60px 24px' }}>
        <div style={{ maxWidth:700, margin:'0 auto', textAlign:'center' }}>
          <p style={{ fontSize:52, marginBottom:14 }}>📱</p>
          <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:26, color:'#fff', marginBottom:12, letterSpacing:-0.5 }}>
            Latido viaja contigo
          </h2>
          <p style={{ fontFamily:PP, fontSize:14, color:'rgba(255,255,255,0.8)', lineHeight:1.75, marginBottom:32, maxWidth:480, margin:'0 auto 32px' }}>
            Instálala en tu móvil como app. Sin pasar por ninguna tienda. Siempre a mano, siempre con tu comunidad.
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:10, marginBottom:36, maxWidth:600, margin:'0 auto 36px' }}>
            {[
              ['🍎 iPhone / iPad', 'Safari → Compartir → "Añadir a inicio"'],
              ['🤖 Android',       'Chrome → Menú → "Instalar app"'],
              ['💻 PC / Mac',      'Chrome o Edge → Icono en la barra de URL'],
            ].map(([d, i]) => (
              <div key={d} style={{ background:'rgba(255,255,255,0.1)', borderRadius:14, padding:'16px 14px', textAlign:'center', border:'1px solid rgba(255,255,255,0.15)' }}>
                <p style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:'#BAE6FD', marginBottom:6 }}>{d}</p>
                <p style={{ fontFamily:PP, fontSize:11, color:'rgba(255,255,255,0.65)', lineHeight:1.55 }}>{i}</p>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
            <Link to="/tablon" style={{ fontFamily:PP, fontWeight:800, fontSize:14, background:'#fff', color:C.primary, textDecoration:'none', padding:'14px 26px', borderRadius:14, display:'inline-flex', alignItems:'center', gap:7 }}>
              Entrar a la comunidad →
            </Link>
            <Link to="/auth" style={{ fontFamily:PP, fontWeight:700, fontSize:14, background:'rgba(255,255,255,0.15)', color:'#fff', textDecoration:'none', padding:'14px 22px', borderRadius:14, display:'inline-flex', alignItems:'center', gap:6, border:'1px solid rgba(255,255,255,0.35)' }}>
              Crear cuenta gratis
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
