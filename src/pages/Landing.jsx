import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import GlobalSearch from '../components/GlobalSearch'
import { C, PP } from '../lib/theme'

const STATS = [
  { value: '400.000+', label: 'Hispanohablantes en Suiza' },
  { value: '26',       label: 'Cantones cubiertos' },
  { value: '100%',     label: 'Gratuito para usuarios' },
  { value: '1 min',    label: 'Para publicar tu primer anuncio' },
]

const FEATURES = [
  {
    icon: '📌',
    color: '#DBEAFE',
    title: 'Tablón de anuncios',
    desc: 'Pisos, empleo, cuidados, servicios y mercado de segunda mano. Todo en tu cantón, en tu idioma. Filtra por ciudad o código postal.',
  },
  {
    icon: '🤝',
    color: '#D1FAE5',
    title: 'Comunidades',
    desc: 'Grupos de venezolanos en Zúrich, colombianos en Ginebra, familias en Berna. Encuentra a los tuyos donde vives.',
  },
  {
    icon: '🏪',
    color: '#FCE7F3',
    title: 'Negocios latinos',
    desc: 'Restaurantes, peluquerías, tiendas y servicios de nuestra comunidad. Apoya a quien habla tu idioma.',
  },
  {
    icon: '📚',
    color: '#EDE9FE',
    title: 'Guías de trámites',
    desc: 'Krankenkasse, Quellensteuer, permiso B/C/L, buscador de trabajo. La burocracia suiza explicada paso a paso en español.',
  },
  {
    icon: '🎉',
    color: '#FEF3C7',
    title: 'Eventos',
    desc: 'Fiestas, conciertos, quedadas y networking. Sabe siempre qué pasa en tu ciudad y publica los tuyos.',
  },
  {
    icon: '📱',
    color: '#CCFBF1',
    title: 'App gratuita (PWA)',
    desc: 'Instálala en tu móvil sin pasar por ninguna tienda. Un toque desde Safari o Chrome y la tienes en tu pantalla de inicio.',
  },
]

const STEPS = [
  { n: '1', emoji: '✍️', title: 'Crea tu cuenta', desc: 'Gratis, en 2 pasos. Solo tu email y tu cantón.' },
  { n: '2', emoji: '🔍', title: 'Explora o publica', desc: 'Busca lo que necesitas o publica tu anuncio en segundos.' },
  { n: '3', emoji: '💬', title: 'Conecta', desc: 'Habla directamente con la persona. Sin intermediarios, sin comisiones.' },
]

const TESTIMONIALS = [
  {
    text: 'Encontré piso en Basel en 4 días. Publiqué en Latido y a la semana ya estaba firmando el contrato. No lo hubiera conseguido tan rápido en ningún otro sitio.',
    name: 'Carlos M.',
    origin: '🇨🇴 Colombiano · Basel',
    avatar: '👨',
  },
  {
    text: 'Llevo 3 años en Suiza y siempre me sentía sola buscando trabajo. Con Latido encontré una oferta de una empresa que busca personas bilingües. Empiezo el mes que viene.',
    name: 'Lucía V.',
    origin: '🇻🇪 Venezolana · Zúrich',
    avatar: '👩',
  },
  {
    text: 'Registré mi restaurante y en una semana había conseguido 20 reseñas y reservas de gente de la comunidad. Es increíble el poder de tener nuestra propia plataforma.',
    name: 'Roberto S.',
    origin: '🇵🇪 Peruano · Ginebra',
    avatar: '👨‍🍳',
  },
]

const PARTNER_BENEFITS = [
  { icon: '🎯', title: 'Audiencia cualificada', desc: 'La mayor comunidad hispanohablante de Suiza. Llegas exactamente a quien necesitas.' },
  { icon: '🌐', title: 'Visibilidad real', desc: 'Tu negocio, comunidad o empresa aparece donde nuestra gente busca cada día.' },
  { icon: '💬', title: 'Contacto directo', desc: 'Sin intermediarios. Los usuarios te contactan por WhatsApp, email o teléfono.' },
  { icon: '⭐', title: 'Reseñas y confianza', desc: 'Construye reputación con reseñas reales de la comunidad que te elige.' },
]

const AD_CATS_PREVIEW = [
  { emoji: '🏠', label: 'Vivienda',  color: '#DBEAFE', tc: '#1D4ED8', desc: 'Pisos, habitaciones, alquileres', to: '/tablon?cat=vivienda' },
  { emoji: '💼', label: 'Empleo',    color: '#D1FAE5', tc: '#065F46', desc: 'Ofertas para hispanohablantes',  to: '/tablon?cat=empleo'  },
  { emoji: '🛍️', label: 'Mercado',   color: '#FEF3C7', tc: '#92400E', desc: 'Compra, venta y regalos',        to: '/tablon?cat=venta'   },
  { emoji: '🔧', label: 'Servicios', color: '#CCFBF1', tc: '#0F766E', desc: 'Profesionales de confianza',     to: '/tablon?cat=servicios' },
  { emoji: '🎉', label: 'Eventos',   color: '#FCE7F3', tc: '#9D174D', desc: 'Lo que pasa en Suiza',           to: '/comunidades?view=eventos' },
  { emoji: '📚', label: 'Guías',     color: '#EDE9FE', tc: '#6D28D9', desc: 'Trámites y burocracia suiza',    to: '/guias'              },
]

export default function Landing({ onInstall }) {
  const [activeTestimonial, setActiveTestimonial] = useState(0)
  const [cols, setCols] = useState(() => window.innerWidth < 500 ? 2 : 3)
  useEffect(() => {
    const fn = () => setCols(window.innerWidth < 500 ? 2 : 3)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  return (
    <div style={{ background: '#fff', overflowX: 'hidden' }}>

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section style={{ background: 'linear-gradient(160deg, #0F1F5C 0%, #1E40AF 45%, #2563EB 100%)', position: 'relative', overflow: 'hidden', padding: '72px 24px 96px' }}>
        <div style={{ position: 'absolute', top: -100, right: -80, width: 360, height: 360, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -40, width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'absolute', top: 120, left: '55%', width: 180, height: 180, borderRadius: '50%', background: 'rgba(96,165,250,0.12)' }} />

        <div style={{ maxWidth: 720, margin: '0 auto', position: 'relative', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.12)', color: '#BAE6FD', fontSize: 11, fontWeight: 700, padding: '8px 18px', borderRadius: 24, marginBottom: 28, fontFamily: PP, border: '1px solid rgba(255,255,255,0.2)', letterSpacing: 0.4 }}>
            🏆 La primera y única plataforma pensada exclusivamente para hispanohablantes en Suiza
          </div>

          <h1 style={{ fontFamily: PP, fontWeight: 900, fontSize: 'clamp(34px, 7vw, 60px)', color: '#fff', lineHeight: 1.08, margin: '0 0 22px', letterSpacing: -1 }}>
            Nuestra fuerza.<br />
            en un solo{' '}
            <span style={{ color: '#60A5FA', fontStyle: 'italic' }}>latido.</span>
          </h1>

          <p style={{ fontFamily: PP, fontSize: 16, color: 'rgba(255,255,255,0.82)', lineHeight: 1.8, marginBottom: 36, maxWidth: 540, margin: '0 auto 36px' }}>
            Latido es la comunidad digital de los<strong style={{ color: '#fff' }}> más de 400.000 hispanohablantes en Suiza</strong>.
            Anuncios, empleo, negocios, eventos y guías de trámites — todo en español, entre nosotros.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 64 }}>
            <Link to="/auth" style={{ fontFamily: PP, fontWeight: 800, fontSize: 15, background: '#fff', color: C.primaryDark, textDecoration: 'none', padding: '15px 30px', borderRadius: 14, display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
              Unirme gratis →
            </Link>
            <Link to="/tablon" style={{ fontFamily: PP, fontWeight: 700, fontSize: 15, background: 'rgba(255,255,255,0.14)', color: '#fff', textDecoration: 'none', padding: '15px 28px', borderRadius: 14, display: 'inline-flex', alignItems: 'center', gap: 7, border: '1.5px solid rgba(255,255,255,0.3)' }}>
              Explorar sin cuenta
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 0, borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 36, maxWidth: 600, margin: '0 auto' }}>
            {STATS.map(({ value, label }) => (
              <div key={label} style={{ padding: '0 8px' }}>
                <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 'clamp(18px,3vw,26px)', color: '#fff', margin: '0 0 5px', letterSpacing: -0.5 }}>{value}</p>
                <p style={{ fontFamily: PP, fontSize: 10, color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.4 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST STRIP ─────────────────────────────────────────── */}
      {/* <div style={{ background: '#F0F6FF', borderBottom: `1px solid ${C.border}`, padding: '16px 24px', overflowX: 'auto' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', gap: 32, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            '🇨🇴 Colombianos', '🇻🇪 Venezolanos', '🇲🇽 Mexicanos',
            '🇵🇪 Peruanos', '🇪🇨 Ecuatorianos', '🇦🇷 Argentinos', '🇪🇸 Españoles', '🇨🇱 Chilenos',
          ].map(flag => (
            <span key={flag} style={{ fontFamily: PP, fontSize: 12, fontWeight: 600, color: C.mid, whiteSpace: 'nowrap' }}>{flag}</span>
          ))}
        </div>
      </div> */}

      {/* ── SEARCH ──────────────────────────────────────────────── */}
      <div style={{ background: '#fff', padding: '40px 24px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 620, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontFamily: PP, fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 6 }}>¿Qué necesitas hoy?</p>
          <p style={{ fontFamily: PP, fontSize: 12, color: C.mid, marginBottom: 16 }}>Pisos, empleo, cuidadoras, trámites, comunidades y mucho más</p>
          <GlobalSearch size="lg" />
        </div>
      </div>

      {/* ── CATEGORY CARDS ──────────────────────────────────────── */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '60px 24px 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <p style={{ fontFamily: PP, fontSize: 11, fontWeight: 700, color: C.primary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Todo en un solo lugar</p>
          <h2 style={{ fontFamily: PP, fontWeight: 800, fontSize: 'clamp(22px,4vw,32px)', color: C.text, margin: '0 0 10px', letterSpacing: -0.5 }}>
            Lo que nuestra comunidad necesita, aquí
          </h2>
          <p style={{ fontFamily: PP, fontSize: 14, color: C.mid, maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
            Seis categorías diseñadas para la realidad diaria de los hispanohablantes en Suiza.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {AD_CATS_PREVIEW.map(cat => (
            <Link
              key={cat.label}
              to={cat.to}
              style={{ background: cat.color, borderRadius: 20, padding: '22px 16px', textDecoration: 'none', textAlign: 'center', border: `1.5px solid transparent`, transition: 'all .2s', display: 'block' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(0,0,0,0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
            >
              <div style={{ fontSize: 36, marginBottom: 10 }}>{cat.emoji}</div>
              <p style={{ fontFamily: PP, fontWeight: 700, fontSize: 14, color: cat.tc, margin: '0 0 5px' }}>{cat.label}</p>
              <p style={{ fontFamily: PP, fontSize: 10, color: cat.tc, opacity: 0.75, margin: 0, lineHeight: 1.4 }}>{cat.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── BRAND PHRASE ─────────────────────────────────────────── */}
      <section style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%)', padding: '80px 24px', marginTop: 64 }}>
        <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontFamily: PP, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 20 }}>Por qué existimos</p>
          <h2 style={{ fontFamily: PP, fontWeight: 900, fontSize: 'clamp(28px,5vw,48px)', color: '#fff', lineHeight: 1.15, letterSpacing: -0.5, marginBottom: 22 }}>
            "Lejos de casa,<br />
            <span style={{ color: '#60A5FA' }}>pero nunca solos."</span>
          </h2>
          <p style={{ fontFamily: PP, fontSize: 15, color: 'rgba(255,255,255,0.72)', lineHeight: 1.85, maxWidth: 520, margin: '0 auto 36px' }}>
            Hablamos español, extrañamos el sol y sabemos lo que cuesta construir una vida aquí.
            Nunca había existido un espacio hecho solo para nosotros — hasta ahora.
            Latido nació para que no tengas que hacerlo solo.
          </p>
          <Link to="/auth" style={{ fontFamily: PP, fontWeight: 800, fontSize: 14, background: '#fff', color: '#1E3A8A', textDecoration: 'none', padding: '16px 34px', borderRadius: 16, display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 10px 32px rgba(0,0,0,0.25)' }}>
            Quiero ser parte de esto →
          </Link>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
      <section style={{ maxWidth: 860, margin: '0 auto', padding: '72px 24px 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <p style={{ fontFamily: PP, fontSize: 11, fontWeight: 700, color: C.primary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Sencillo desde el primer día</p>
          <h2 style={{ fontFamily: PP, fontWeight: 800, fontSize: 'clamp(22px,4vw,32px)', color: C.text, margin: '0 0 10px', letterSpacing: -0.5 }}>
            En 3 pasos, ya estás dentro
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
          {STEPS.map((step, i) => (
            <div key={step.n} style={{ position: 'relative', background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 22, padding: '30px 24px 26px', textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, background: C.primary, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 22 }}>
                {step.emoji}
              </div>
              <div style={{ position: 'absolute', top: 18, left: 18, width: 22, height: 22, background: C.primaryLight, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: PP, fontWeight: 800, fontSize: 11, color: C.primary }}>{step.n}</span>
              </div>
              <h3 style={{ fontFamily: PP, fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 8 }}>{step.title}</h3>
              <p style={{ fontFamily: PP, fontSize: 12, color: C.mid, lineHeight: 1.65, margin: 0 }}>{step.desc}</p>
              {i < STEPS.length - 1 && (
                <div style={{ display: 'none' }} />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────── */}
      <section style={{ background: '#F8FAFF', padding: '72px 24px', marginTop: 72 }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <p style={{ fontFamily: PP, fontSize: 11, fontWeight: 700, color: C.primary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Funcionalidades</p>
            <h2 style={{ fontFamily: PP, fontWeight: 800, fontSize: 'clamp(22px,4vw,32px)', color: C.text, margin: '0 0 10px', letterSpacing: -0.5 }}>
              Construido para nuestra realidad en Suiza
            </h2>
            <p style={{ fontFamily: PP, fontSize: 14, color: C.mid, maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
              Cada función fue diseñada pensando en la vida real de los hispanohablantes aquí: la burocracia, el idioma, la distancia.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(268px,1fr))', gap: 14 }}>
            {FEATURES.map(f => (
              <div
                key={f.title}
                style={{ background: '#fff', borderRadius: 22, padding: '26px 22px', border: `1px solid ${C.border}`, transition: 'all .2s' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 10px 32px rgba(37,99,235,0.13)'; e.currentTarget.style.transform = 'translateY(-4px)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                <div style={{ width: 52, height: 52, background: f.color, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 16 }}>{f.icon}</div>
                <h3 style={{ fontFamily: PP, fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 8 }}>{f.title}</h3>
                <p style={{ fontFamily: PP, fontSize: 12, color: C.mid, lineHeight: 1.75, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRIVACY (hidden) ─────────────────────────────────────── */}
      {false && <section style={{ maxWidth: 860, margin: '72px auto 0', padding: '0 24px' }} />}

      {/* ── TESTIMONIALS ─────────────────────────────────────────── */}
      <section style={{ background: 'linear-gradient(180deg, #EFF6FF 0%, #fff 100%)', padding: '72px 24px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <p style={{ fontFamily: PP, fontSize: 11, fontWeight: 700, color: C.primary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Comunidad real</p>
            <h2 style={{ fontFamily: PP, fontWeight: 800, fontSize: 'clamp(22px,4vw,30px)', color: C.text, margin: 0, letterSpacing: -0.5 }}>
              Lo dicen los que ya están dentro
            </h2>
          </div>

          <div style={{ background: '#fff', borderRadius: 24, padding: '36px 32px', border: `1px solid ${C.border}`, boxShadow: '0 12px 40px rgba(37,99,235,0.08)', marginBottom: 20 }}>
            <div style={{ fontSize: 40, color: C.primaryMid, lineHeight: 1, marginBottom: 18, fontFamily: 'Georgia, serif' }}>"</div>
            <p style={{ fontFamily: PP, fontSize: 16, color: C.text, lineHeight: 1.8, marginBottom: 24, fontWeight: 500 }}>
              {TESTIMONIALS[activeTestimonial].text}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 46, height: 46, background: C.primaryLight, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                {TESTIMONIALS[activeTestimonial].avatar}
              </div>
              <div>
                <p style={{ fontFamily: PP, fontWeight: 700, fontSize: 14, color: C.text, margin: '0 0 2px' }}>{TESTIMONIALS[activeTestimonial].name}</p>
                <p style={{ fontFamily: PP, fontSize: 12, color: C.mid, margin: 0 }}>{TESTIMONIALS[activeTestimonial].origin}</p>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
                {[1,2,3,4,5].map(s => <span key={s} style={{ color: '#F59E0B', fontSize: 14 }}>★</span>)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveTestimonial(i)}
                style={{ width: i === activeTestimonial ? 28 : 10, height: 10, borderRadius: 5, background: i === activeTestimonial ? C.primary : C.border, border: 'none', cursor: 'pointer', padding: 0, transition: 'all .25s' }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── PARTNERS ─────────────────────────────────────────────── */}
      <section style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 60%, #2563EB 100%)', padding: '80px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 48, alignItems: 'center' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.12)', color: '#BAE6FD', fontSize: 11, fontWeight: 700, padding: '7px 16px', borderRadius: 24, marginBottom: 22, fontFamily: PP, border: '1px solid rgba(255,255,255,0.2)', letterSpacing: 0.4 }}>
                🤝 Para empresas y partners
              </div>
              <h2 style={{ fontFamily: PP, fontWeight: 900, fontSize: 'clamp(26px,4vw,40px)', color: '#fff', lineHeight: 1.15, marginBottom: 18, letterSpacing: -0.5 }}>
                El canal directo a la comunidad hispanohablante en Suiza
              </h2>
              <p style={{ fontFamily: PP, fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.8, marginBottom: 28 }}>
                ¿Tienes un negocio, ofreces empleo o buscas conectar con nuestra comunidad?
                Latido es el canal directo hacia el mercado hispanohablante en Suiza.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Link to="/registrar-negocio" style={{ fontFamily: PP, fontWeight: 700, fontSize: 13, background: '#fff', color: C.primaryDark, textDecoration: 'none', padding: '13px 24px', borderRadius: 13, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  Registrar negocio →
                </Link>
                <Link to="/publicar-empleo" style={{ fontFamily: PP, fontWeight: 700, fontSize: 13, background: 'rgba(255,255,255,0.13)', color: '#fff', textDecoration: 'none', padding: '13px 24px', borderRadius: 13, display: 'inline-flex', alignItems: 'center', gap: 7, border: '1.5px solid rgba(255,255,255,0.3)' }}>
                  Publicar empleo
                </Link>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {PARTNER_BENEFITS.map(b => (
                <div key={b.title} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 18, padding: '20px 18px', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>{b.icon}</div>
                  <h3 style={{ fontFamily: PP, fontWeight: 700, fontSize: 13, color: '#fff', marginBottom: 6, lineHeight: 1.3 }}>{b.title}</h3>
                  <p style={{ fontFamily: PP, fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, margin: 0 }}>{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PWA INSTALL ──────────────────────────────────────────── */}
      <section style={{ maxWidth: 720, margin: '72px auto 0', padding: '0 24px' }}>
        <div style={{ background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)', borderRadius: 28, padding: '48px 32px', textAlign: 'center', border: `1.5px solid ${C.primaryMid}` }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>📱</div>
          <h2 style={{ fontFamily: PP, fontWeight: 800, fontSize: 26, color: C.text, marginBottom: 10, letterSpacing: -0.5 }}>
            Latido siempre en tu bolsillo
          </h2>
          <p style={{ fontFamily: PP, fontSize: 14, color: C.mid, lineHeight: 1.75, marginBottom: 32, maxWidth: 420, margin: '0 auto 32px' }}>
            Instálala gratis como app en tu móvil. Sin App Store, sin Google Play. Directamente desde el navegador.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, marginBottom: 28, maxWidth: 560, margin: '0 auto 28px' }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: '16px 14px', border: `1px solid ${C.border}` }}>
              <p style={{ fontFamily: PP, fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 5 }}>🍎 iPhone / iPad</p>
              <p style={{ fontFamily: PP, fontSize: 11, color: C.mid, lineHeight: 1.55, margin: 0 }}>Safari → Compartir 📤 → "Añadir a inicio"</p>
            </div>
            <button
              onClick={onInstall}
              style={{ background: C.primary, borderRadius: 16, padding: '16px 14px', border: 'none', cursor: 'pointer', transition: 'background .2s' }}
              onMouseEnter={e => e.currentTarget.style.background = C.primaryDark}
              onMouseLeave={e => e.currentTarget.style.background = C.primary}
            >
              <p style={{ fontFamily: PP, fontWeight: 700, fontSize: 13, color: '#fff', marginBottom: 5 }}>🤖 Android</p>
              <p style={{ fontFamily: PP, fontSize: 11, color: 'rgba(255,255,255,0.8)', lineHeight: 1.55, margin: 0 }}>📲 Toca aquí para instalar</p>
            </button>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────── */}
      <section style={{ maxWidth: 720, margin: '72px auto 0', padding: '0 24px 80px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, background: `linear-gradient(135deg, ${C.primaryDark}, ${C.primary})`, borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 24px', boxShadow: `0 16px 40px rgba(37,99,235,0.3)` }}>🌎</div>
          <h2 style={{ fontFamily: PP, fontWeight: 900, fontSize: 'clamp(26px,5vw,42px)', color: C.text, margin: '0 0 16px', letterSpacing: -0.5, lineHeight: 1.15 }}>
            Tu comunidad te espera.
          </h2>
          <p style={{ fontFamily: PP, fontSize: 15, color: C.mid, lineHeight: 1.8, marginBottom: 36, maxWidth: 460, margin: '0 auto 36px' }}>
            Únete a miles de hispanohablantes que ya encontraron piso, trabajo, comunidad y mucho más en Latido.
            Gratis. En tu idioma. Entre los tuyos.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/auth" style={{ fontFamily: PP, fontWeight: 800, fontSize: 15, background: C.primary, color: '#fff', textDecoration: 'none', padding: '16px 36px', borderRadius: 16, display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: `0 10px 30px rgba(37,99,235,0.35)` }}>
              Unirme gratis →
            </Link>
            <Link to="/tablon" style={{ fontFamily: PP, fontWeight: 700, fontSize: 15, background: '#fff', color: C.primary, textDecoration: 'none', padding: '16px 28px', borderRadius: 16, display: 'inline-flex', alignItems: 'center', gap: 7, border: `1.5px solid ${C.primaryMid}` }}>
              Ver anuncios
            </Link>
          </div>
          <p style={{ fontFamily: PP, fontSize: 11, color: C.light, marginTop: 18 }}>100% gratuito para usuarios</p>
        </div>
      </section>

    </div>
  )
}
