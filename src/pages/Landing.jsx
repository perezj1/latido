import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import GlobalSearch from '../components/GlobalSearch'
import { C, PP } from '../lib/theme'

/* ─────────────────────────────────────────────────────────────
   DATA
   ───────────────────────────────────────────────────────────── */

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
    title: 'Negocios',
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
  { icon: '🌐', title: 'Visibilidad real',      desc: 'Tu negocio, comunidad o empresa aparece donde nuestra gente busca cada día.' },
  { icon: '💬', title: 'Contacto directo',      desc: 'Sin intermediarios. Los usuarios te contactan por WhatsApp, email o teléfono.' },
  { icon: '⭐', title: 'Reseñas y confianza',   desc: 'Construye reputación con reseñas reales de la comunidad que te elige.' },
]

const AD_CATS_PREVIEW = [
  { emoji: '🏠', label: 'Vivienda',  color: '#DBEAFE', tc: '#1D4ED8', desc: 'Pisos, habitaciones, alquileres', to: '/tablon?cat=vivienda' },
  { emoji: '💼', label: 'Empleo',    color: '#D1FAE5', tc: '#065F46', desc: 'Ofertas para hispanohablantes',  to: '/tablon?cat=empleo'  },
  { emoji: '🛍️', label: 'Mercado',   color: '#FEF3C7', tc: '#92400E', desc: 'Compra, venta y regalos',        to: '/tablon?cat=venta'   },
  { emoji: '🏪', label: 'Negocios',  color: '#CCFBF1', tc: '#0F766E', desc: 'Directorio de negocios latinos', to: '/comunidades' },
  { emoji: '🎉', label: 'Eventos',   color: '#FCE7F3', tc: '#9D174D', desc: 'Lo que pasa en Suiza',           to: '/comunidades?view=eventos' },
  { emoji: '✨', label: 'Y más...',  color: '#F1F5F9', tc: '#475569', desc: 'Servicios, guías y mucho más',    to: '/' },
]

const COUNTRIES = [
  '🇨🇴 Colombia', '🇻🇪 Venezuela', '🇲🇽 México', '🇵🇪 Perú',
  '🇪🇨 Ecuador', '🇦🇷 Argentina', '🇪🇸 España', '🇨🇱 Chile',
  '🇩🇴 R. Dominicana', '🇧🇴 Bolivia', '🇺🇾 Uruguay', '🇵🇾 Paraguay',
  '🇨🇷 Costa Rica', '🇬🇹 Guatemala', '🇭🇳 Honduras', '🇨🇺 Cuba',
]

const APP_PEEK_FEED = [
  { tag: '🏠 Vivienda',  who: 'María · Zürich',    text: 'Busco piso de 2 habitaciones en Oerlikon para julio. Hasta 2.800 CHF.', time: 'hace 3 min', color: '#DBEAFE', tc: '#1D4ED8' },
  { tag: '💼 Empleo',    who: 'Tech Startup · GVA', text: 'Buscamos developer full-stack hispanohablante. Remoto o híbrido.',        time: 'hace 12 min', color: '#D1FAE5', tc: '#065F46' },
  { tag: '🎉 Evento',    who: 'Salsa Club Bern',    text: 'Noche latina este viernes 21h. Entrada libre para la comunidad.',        time: 'hace 1 h',   color: '#FCE7F3', tc: '#9D174D' },
  { tag: '📚 Guía',      who: 'Comunidad Latido',   text: 'Cómo pedir tu permiso C después de 10 años: paso a paso actualizado.',    time: 'hoy',        color: '#EDE9FE', tc: '#6D28D9' },
]

const FAQ = [
  {
    q: '¿Latido es realmente gratis?',
    a: 'Sí. Registrarte, publicar anuncios, unirte a comunidades y asistir a eventos es 100% gratis para usuarios. Las empresas y partners tienen opciones de visibilidad premium opcionales.',
  },
  {
    q: '¿Necesito hablar alemán, francés o italiano?',
    a: 'No. Latido está 100% en español. Es precisamente para eso: un espacio donde no tengas que lidiar con el idioma del cantón mientras buscas piso, trabajo o comunidad.',
  },
  {
    q: '¿Es seguro? ¿Qué pasa con mis datos?',
    a: 'Cumplimos la Ley Federal de Protección de Datos de Suiza (nFADP) y el GDPR europeo. Nunca vendemos tus datos. Los anuncios y perfiles se moderan para evitar fraudes y contenido inapropiado.',
  },
  {
    q: '¿Tengo que vivir en Suiza para registrarme?',
    a: 'Está pensado para quienes ya viven en Suiza o están a punto de mudarse. Si estás preparando tu llegada, puedes registrarte para ir conectando y encontrar piso o empleo antes de aterrizar.',
  },
  {
    q: '¿Funciona en toda Suiza o solo en ciudades grandes?',
    a: 'Cubrimos los 26 cantones. Hay más actividad en Zúrich, Ginebra, Basilea, Lausana y Berna, pero cada semana crecen las comunidades en el resto — y tú puedes ser quien empiece la tuya.',
  },
  {
    q: '¿Necesito descargar algo desde App Store o Google Play?',
    a: 'No. Latido es una app web instalable (PWA). La añades a la pantalla de inicio de tu móvil en un toque desde Safari o Chrome. Ocupa casi nada y se comporta como una app nativa.',
  },
]

/* ─────────────────────────────────────────────────────────────
   HOOKS & SMALL COMPONENTS
   ───────────────────────────────────────────────────────────── */

// Fade-in on scroll (respects prefers-reduced-motion)
function useInView(threshold = 0.15) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) { setInView(true); return }
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); obs.disconnect() }
    }, { threshold, rootMargin: '0px 0px -40px 0px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, inView]
}

function Reveal({ children, delay = 0, as: Tag = 'div', style = {}, ...rest }) {
  const [ref, inView] = useInView()
  return (
    <Tag
      ref={ref}
      style={{
        ...style,
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity .7s ease-out ${delay}ms, transform .7s ease-out ${delay}ms`,
        willChange: 'opacity, transform',
      }}
      {...rest}
    >
      {children}
    </Tag>
  )
}

// Animated number counter with "400.000+" / "26" / "100%" / "1 min" support
function AnimatedStat({ value, duration = 1400 }) {
  const [ref, inView] = useInView(0.4)
  const [out, setOut] = useState(value)

  useEffect(() => {
    if (!inView) return
    const match = value.match(/[\d.]+/)
    if (!match) { setOut(value); return }
    const numStr = match[0].replace(/\./g, '')
    const target = parseInt(numStr, 10)
    if (!Number.isFinite(target) || target === 0) { setOut(value); return }
    const prefix = value.slice(0, match.index)
    const suffix = value.slice(match.index + match[0].length)
    const start = performance.now()
    let raf
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      const current = Math.floor(target * eased)
      const formatted = current >= 1000 ? current.toLocaleString('de-CH').replace(/,/g, '.') : String(current)
      setOut(prefix + formatted + suffix)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, value, duration])

  return <span ref={ref}>{out}</span>
}

/* ─────────────────────────────────────────────────────────────
   MAIN
   ───────────────────────────────────────────────────────────── */

export default function Landing({ onInstall }) {
  const [activeTestimonial, setActiveTestimonial] = useState(0)
  const [paused, setPaused] = useState(false)
  const [openFaq, setOpenFaq] = useState(0)
  const [cols, setCols] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 500 ? 2 : 3))

  useEffect(() => {
    const fn = () => setCols(window.innerWidth < 500 ? 2 : 3)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  // Auto-rotate testimonials every 6s (pauses on hover)
  useEffect(() => {
    if (paused) return
    const id = setInterval(() => {
      setActiveTestimonial(i => (i + 1) % TESTIMONIALS.length)
    }, 6000)
    return () => clearInterval(id)
  }, [paused])

  return (
    <div style={{ background: '#fff', overflowX: 'hidden' }}>

      {/* ── GLOBAL KEYFRAMES (scoped via style tag) ────────────── */}
      <style>{`
        @keyframes latido-fade-up { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes latido-pulse-dot { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.8); opacity: 0.35; } }
        @keyframes latido-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes latido-gradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes latido-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes latido-shine { 0% { transform: translateX(-120%) skewX(-20deg); } 100% { transform: translateX(220%) skewX(-20deg); } }
        .latido-enter-1 { animation: latido-fade-up .7s ease-out both; }
        .latido-enter-2 { animation: latido-fade-up .7s ease-out .12s both; }
        .latido-enter-3 { animation: latido-fade-up .7s ease-out .24s both; }
        .latido-enter-4 { animation: latido-fade-up .7s ease-out .36s both; }
        .latido-enter-5 { animation: latido-fade-up .7s ease-out .48s both; }
        .latido-cta-primary { position: relative; overflow: hidden; transition: transform .15s ease, box-shadow .2s ease; }
        .latido-cta-primary:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 14px 34px rgba(15,31,92,0.28); }
        .latido-cta-primary:active { transform: translateY(0) scale(.99); }
        .latido-cta-primary::after { content: ''; position: absolute; top: 0; left: 0; width: 40%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent); transform: translateX(-120%) skewX(-20deg); }
        .latido-cta-primary:hover::after { animation: latido-shine .9s ease-out; }
        .latido-cta-ghost { transition: background .2s ease, border-color .2s ease, transform .15s ease; }
        .latido-cta-ghost:hover { background: rgba(255,255,255,0.22) !important; border-color: rgba(255,255,255,0.55) !important; transform: translateY(-2px); }
        .latido-float { animation: latido-float 7s ease-in-out infinite; }
        .latido-float-slow { animation: latido-float 11s ease-in-out infinite; }
        .latido-pulse-dot { animation: latido-pulse-dot 1.8s ease-out infinite; }
        .latido-marquee-track { display: inline-flex; gap: 40px; animation: latido-marquee 40s linear infinite; }
        .latido-hero-bg { background-size: 180% 180%; animation: latido-gradient 22s ease infinite; }
        .latido-card-hover { transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease; }
        @media (prefers-reduced-motion: reduce) {
          .latido-enter-1, .latido-enter-2, .latido-enter-3, .latido-enter-4, .latido-enter-5,
          .latido-float, .latido-float-slow, .latido-pulse-dot, .latido-marquee-track, .latido-hero-bg { animation: none !important; }
          .latido-cta-primary, .latido-cta-ghost, .latido-card-hover { transition: none !important; }
        }
      `}</style>

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section
        className="latido-hero-bg"
        style={{
          background: 'linear-gradient(160deg, #0F1F5C 0%, #1E40AF 45%, #2563EB 100%)',
          position: 'relative',
          overflow: 'hidden',
          padding: '80px 24px 104px',
        }}
      >
        {/* floating decorative blobs */}
        <div className="latido-float" style={{ position: 'absolute', top: -100, right: -80, width: 360, height: 360, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', filter: 'blur(2px)' }} />
        <div className="latido-float-slow" style={{ position: 'absolute', bottom: -60, left: -40, width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', filter: 'blur(2px)' }} />
        <div className="latido-float" style={{ position: 'absolute', top: 140, left: '55%', width: 180, height: 180, borderRadius: '50%', background: 'rgba(96,165,250,0.16)', filter: 'blur(4px)' }} />

        <div style={{ maxWidth: 760, margin: '0 auto', position: 'relative', textAlign: 'center' }}>
          {/* Badge with pulsing live dot */}
          <div
            className="latido-enter-1"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.12)', color: '#BAE6FD', fontSize: 11, fontWeight: 700, padding: '8px 18px', borderRadius: 24, marginBottom: 28, fontFamily: PP, border: '1px solid rgba(255,255,255,0.22)', letterSpacing: 0.4, backdropFilter: 'blur(8px)' }}
          >
            <span style={{ position: 'relative', display: 'inline-block', width: 8, height: 8 }}>
              <span className="latido-pulse-dot" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#4ADE80' }} />
              <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#22C55E' }} />
            </span>
            La primera plataforma pensada exclusivamente para hispanohablantes en Suiza
          </div>

          {/* H1 fixed: single clean line + italic accent */}
          <h1
            className="latido-enter-2"
            style={{ fontFamily: PP, fontWeight: 900, fontSize: 'clamp(36px, 7.2vw, 64px)', color: '#fff', lineHeight: 1.05, margin: '0 0 22px', letterSpacing: -1.2 }}
          >
            Nuestra fuerza,
            <br />
            en un solo{' '}
            <span style={{ color: '#60A5FA', fontStyle: 'italic', position: 'relative' }}>
              latido.
            </span>
          </h1>

          <p
            className="latido-enter-3"
            style={{ fontFamily: PP, fontSize: 17, color: 'rgba(255,255,255,0.85)', lineHeight: 1.75, maxWidth: 560, margin: '0 auto 32px' }}
          >
            Únete a los <strong style={{ color: '#fff' }}>+400.000 hispanohablantes</strong> que ya están construyendo su vida en Suiza.
            Pisos, empleo, trámites, comunidad y eventos — todo en español, entre los nuestros.
          </p>

          <div
            className="latido-enter-4"
            style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 18 }}
          >
            <Link
              to="/auth"
              className="latido-cta-primary"
              style={{ fontFamily: PP, fontWeight: 800, fontSize: 15, background: '#fff', color: C.primaryDark, textDecoration: 'none', padding: '15px 30px', borderRadius: 14, display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 10px 28px rgba(0,0,0,0.22)' }}
            >
              Unirme gratis →
            </Link>
            <Link
              to="/tablon"
              className="latido-cta-ghost"
              style={{ fontFamily: PP, fontWeight: 700, fontSize: 15, background: 'rgba(255,255,255,0.14)', color: '#fff', textDecoration: 'none', padding: '15px 28px', borderRadius: 14, display: 'inline-flex', alignItems: 'center', gap: 7, border: '1.5px solid rgba(255,255,255,0.32)', backdropFilter: 'blur(6px)' }}
            >
              Explorar sin cuenta
            </Link>
          </div>

          <p className="latido-enter-5" style={{ fontFamily: PP, fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 56 }}>
            ✨ Gratis para siempre · 30 segundos para registrarte
          </p>

          {/* Stats with animated counters */}
          <div
            className="latido-enter-5"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 0, borderTop: '1px solid rgba(255,255,255,0.18)', paddingTop: 32, maxWidth: 620, margin: '0 auto' }}
          >
            {STATS.map(({ value, label }) => (
              <div key={label} style={{ padding: '0 8px' }}>
                <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 'clamp(18px,3vw,26px)', color: '#fff', margin: '0 0 5px', letterSpacing: -0.5 }}>
                  <AnimatedStat value={value} />
                </p>
                <p style={{ fontFamily: PP, fontSize: 10, color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.4 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COUNTRY MARQUEE (social proof strip) ─────────────────── */}
      <div style={{ background: '#F0F6FF', borderBottom: `1px solid ${C.border}`, padding: '14px 0', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: 60, height: '100%', background: 'linear-gradient(90deg, #F0F6FF, rgba(240,246,255,0))', zIndex: 2 }} />
        <div style={{ position: 'absolute', top: 0, right: 0, width: 60, height: '100%', background: 'linear-gradient(270deg, #F0F6FF, rgba(240,246,255,0))', zIndex: 2 }} />
        <div className="latido-marquee-track" style={{ whiteSpace: 'nowrap' }}>
          {[...COUNTRIES, ...COUNTRIES].map((c, i) => (
            <span
              key={`${c}-${i}`}
              style={{ fontFamily: PP, fontSize: 13, fontWeight: 600, color: C.mid, whiteSpace: 'nowrap' }}
            >
              {c}
            </span>
          ))}
        </div>
      </div>

      {/* ── SEARCH ──────────────────────────────────────────────── */}
      <Reveal>
        <div style={{ background: '#fff', padding: '48px 24px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ maxWidth: 620, margin: '0 auto', textAlign: 'center' }}>
            <p style={{ fontFamily: PP, fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 6 }}>¿Qué necesitas hoy?</p>
            <p style={{ fontFamily: PP, fontSize: 13, color: C.mid, marginBottom: 18 }}>Pisos, empleo, cuidadoras, trámites, comunidades y mucho más</p>
            <GlobalSearch size="lg" />
          </div>
        </div>
      </Reveal>

      {/* ── CATEGORY CARDS ──────────────────────────────────────── */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '60px 24px 0' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <p style={{ fontFamily: PP, fontSize: 11, fontWeight: 700, color: C.primary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Todo en un solo lugar</p>
            <h2 style={{ fontFamily: PP, fontWeight: 800, fontSize: 'clamp(22px,4vw,32px)', color: C.text, margin: '0 0 10px', letterSpacing: -0.5 }}>
              Lo que nuestra comunidad necesita, aquí
            </h2>
            <p style={{ fontFamily: PP, fontSize: 14, color: C.mid, maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
              Categorías diseñadas para la realidad diaria de los hispanohablantes en Suiza.
            </p>
          </div>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: 10 }}>
          {AD_CATS_PREVIEW.map((cat, i) => (
            <Reveal key={cat.label} delay={i * 60}>
              <Link
                to={cat.to}
                className="latido-card-hover"
                style={{ background: cat.color, borderRadius: 18, padding: 'clamp(14px,3vw,22px) clamp(10px,2vw,16px)', textDecoration: 'none', textAlign: 'center', border: '1.5px solid transparent', display: 'block' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 14px 32px rgba(37,99,235,0.16)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
              >
                <div style={{ fontSize: 'clamp(28px,6vw,36px)', marginBottom: 8 }}>{cat.emoji}</div>
                <p style={{ fontFamily: PP, fontWeight: 700, fontSize: 'clamp(11px,2.5vw,14px)', color: cat.tc, margin: '0 0 4px' }}>{cat.label}</p>
                <p style={{ fontFamily: PP, fontSize: 'clamp(9px,1.8vw,10px)', color: cat.tc, opacity: 0.75, margin: 0, lineHeight: 1.4 }}>{cat.desc}</p>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── BRAND PHRASE (WHY) ───────────────────────────────────── */}
      <section style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%)', padding: '96px 24px', marginTop: 72, position: 'relative', overflow: 'hidden' }}>
        <div className="latido-float-slow" style={{ position: 'absolute', top: -80, right: -60, width: 260, height: 260, borderRadius: '50%', background: 'rgba(96,165,250,0.08)', filter: 'blur(8px)' }} />
        <Reveal>
          <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
            <p style={{ fontFamily: PP, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 20 }}>Por qué existimos</p>
            <h2 style={{ fontFamily: PP, fontWeight: 900, fontSize: 'clamp(28px,5vw,48px)', color: '#fff', lineHeight: 1.15, letterSpacing: -0.5, marginBottom: 22 }}>
              "Lejos de casa,<br />
              <span style={{ color: '#60A5FA' }}>pero nunca solos."</span>
            </h2>
            <p style={{ fontFamily: PP, fontSize: 16, color: 'rgba(255,255,255,0.78)', lineHeight: 1.85, maxWidth: 540, margin: '0 auto 36px' }}>
              El primer invierno en Suiza es oscuro. El idioma se siente un muro. El banco pide papeles que nadie te explicó.
              Y esa sensación de que <em>nadie entiende de dónde vienes</em>. Eso cambia cuando encuentras a los tuyos — y Latido nació para eso.
            </p>
            <Link
              to="/auth"
              className="latido-cta-primary"
              style={{ fontFamily: PP, fontWeight: 800, fontSize: 14, background: '#fff', color: '#1E3A8A', textDecoration: 'none', padding: '16px 34px', borderRadius: 16, display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 10px 32px rgba(0,0,0,0.25)' }}
            >
              Quiero ser parte de esto →
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
      <section style={{ maxWidth: 860, margin: '0 auto', padding: '88px 24px 0' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <p style={{ fontFamily: PP, fontSize: 11, fontWeight: 700, color: C.primary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Sencillo desde el primer día</p>
            <h2 style={{ fontFamily: PP, fontWeight: 800, fontSize: 'clamp(22px,4vw,32px)', color: C.text, margin: '0 0 10px', letterSpacing: -0.5 }}>
              En 3 pasos, ya estás conectado
            </h2>
          </div>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
          {STEPS.map((step, i) => (
            <Reveal key={step.n} delay={i * 120}>
              <div
                className="latido-card-hover"
                style={{ position: 'relative', background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 22, padding: '32px 24px 28px', textAlign: 'center', height: '100%' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.primaryMid; e.currentTarget.style.boxShadow = '0 10px 28px rgba(37,99,235,0.12)'; e.currentTarget.style.transform = 'translateY(-4px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                <div style={{ width: 52, height: 52, background: `linear-gradient(135deg, ${C.primaryDark}, ${C.primary})`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', fontSize: 24, boxShadow: '0 8px 20px rgba(37,99,235,0.28)' }}>
                  {step.emoji}
                </div>
                <div style={{ position: 'absolute', top: 18, left: 18, width: 24, height: 24, background: C.primaryLight, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: PP, fontWeight: 800, fontSize: 11, color: C.primary }}>{step.n}</span>
                </div>
                <h3 style={{ fontFamily: PP, fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 8 }}>{step.title}</h3>
                <p style={{ fontFamily: PP, fontSize: 12, color: C.mid, lineHeight: 1.65, margin: 0 }}>{step.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────── */}
      <section style={{ background: '#F8FAFF', padding: '88px 24px', marginTop: 88 }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 44 }}>
              <p style={{ fontFamily: PP, fontSize: 11, fontWeight: 700, color: C.primary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Funcionalidades</p>
              <h2 style={{ fontFamily: PP, fontWeight: 800, fontSize: 'clamp(22px,4vw,32px)', color: C.text, margin: '0 0 10px', letterSpacing: -0.5 }}>
                Construido para nuestra realidad en Suiza
              </h2>
              <p style={{ fontFamily: PP, fontSize: 14, color: C.mid, maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
                Cada función fue diseñada pensando en la vida real de los hispanohablantes aquí: la burocracia, el idioma, la distancia.
              </p>
            </div>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(268px,1fr))', gap: 14 }}>
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 80}>
                <div
                  className="latido-card-hover"
                  style={{ background: '#fff', borderRadius: 22, padding: '28px 22px', border: `1px solid ${C.border}`, height: '100%' }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 14px 36px rgba(37,99,235,0.14)'; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = C.primaryMid }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = C.border }}
                >
                  <div style={{ width: 52, height: 52, background: f.color, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 16 }}>{f.icon}</div>
                  <h3 style={{ fontFamily: PP, fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 8 }}>{f.title}</h3>
                  <p style={{ fontFamily: PP, fontSize: 12, color: C.mid, lineHeight: 1.75, margin: 0 }}>{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── PEEK INSIDE THE APP ─────────────────────────────────── */}
      <section style={{ maxWidth: 960, margin: '0 auto', padding: '88px 24px 0' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <p style={{ fontFamily: PP, fontSize: 11, fontWeight: 700, color: C.primary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Mira por dentro</p>
            <h2 style={{ fontFamily: PP, fontWeight: 800, fontSize: 'clamp(22px,4vw,32px)', color: C.text, margin: '0 0 10px', letterSpacing: -0.5 }}>
              Así se ve la comunidad cada día
            </h2>
            <p style={{ fontFamily: PP, fontSize: 14, color: C.mid, maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
              Un vistazo real al flujo de anuncios, ofertas y eventos que publican los hispanohablantes en Suiza.
            </p>
          </div>
        </Reveal>

        <Reveal>
          <div style={{ position: 'relative', background: 'linear-gradient(180deg, #F0F6FF 0%, #fff 100%)', borderRadius: 28, padding: '28px', border: `1px solid ${C.border}`, boxShadow: '0 20px 60px rgba(15,31,92,0.08)' }}>
            {/* Fake browser/app chrome */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444' }} />
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#F59E0B' }} />
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981' }} />
              <div style={{ flex: 1, textAlign: 'center', fontFamily: PP, fontSize: 11, color: C.mid }}>latido.app · feed en vivo</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
              {APP_PEEK_FEED.map((item, i) => (
                <Reveal key={i} delay={i * 90}>
                  <div
                    className="latido-card-hover"
                    style={{ background: '#fff', borderRadius: 16, padding: '16px 16px 14px', border: `1px solid ${C.border}` }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 10px 24px rgba(37,99,235,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontFamily: PP, fontSize: 10, fontWeight: 700, color: item.tc, background: item.color, padding: '4px 10px', borderRadius: 100 }}>{item.tag}</span>
                      <span style={{ fontFamily: PP, fontSize: 10, color: C.light }}>{item.time}</span>
                    </div>
                    <p style={{ fontFamily: PP, fontSize: 13, color: C.text, lineHeight: 1.55, margin: '0 0 10px', fontWeight: 500 }}>{item.text}</p>
                    <p style={{ fontFamily: PP, fontSize: 11, color: C.mid, margin: 0 }}>{item.who}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <Link
                to="/tablon"
                className="latido-cta-ghost"
                style={{ fontFamily: PP, fontWeight: 700, fontSize: 13, color: C.primary, background: 'rgba(37,99,235,0.08)', textDecoration: 'none', padding: '11px 22px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 6, border: `1.5px solid ${C.primaryLight}` }}
              >
                Ver el feed completo →
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── TESTIMONIALS (auto-rotate + hover pause) ─────────────── */}
      <section style={{ background: 'linear-gradient(180deg, #EFF6FF 0%, #fff 100%)', padding: '88px 24px', marginTop: 88 }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <p style={{ fontFamily: PP, fontSize: 11, fontWeight: 700, color: C.primary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Comunidad real</p>
              <h2 style={{ fontFamily: PP, fontWeight: 800, fontSize: 'clamp(22px,4vw,30px)', color: C.text, margin: 0, letterSpacing: -0.5 }}>
                Lo dicen los que ya están dentro
              </h2>
            </div>
          </Reveal>

          <div
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            style={{ background: '#fff', borderRadius: 24, padding: '40px 32px', border: `1px solid ${C.border}`, boxShadow: '0 16px 44px rgba(37,99,235,0.08)', marginBottom: 20, position: 'relative', minHeight: 240, transition: 'box-shadow .2s' }}
          >
            <div style={{ fontSize: 44, color: C.primaryMid, lineHeight: 1, marginBottom: 14, fontFamily: 'Georgia, serif' }}>"</div>

            {/* Crossfade container */}
            <div style={{ position: 'relative' }}>
              {TESTIMONIALS.map((t, i) => (
                <div
                  key={i}
                  style={{
                    position: i === activeTestimonial ? 'relative' : 'absolute',
                    inset: 0,
                    opacity: i === activeTestimonial ? 1 : 0,
                    transform: i === activeTestimonial ? 'translateY(0)' : 'translateY(8px)',
                    transition: 'opacity .5s ease, transform .5s ease',
                    pointerEvents: i === activeTestimonial ? 'auto' : 'none',
                  }}
                >
                  <p style={{ fontFamily: PP, fontSize: 16, color: C.text, lineHeight: 1.8, marginBottom: 24, fontWeight: 500 }}>
                    {t.text}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 46, height: 46, background: C.primaryLight, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                      {t.avatar}
                    </div>
                    <div>
                      <p style={{ fontFamily: PP, fontWeight: 700, fontSize: 14, color: C.text, margin: '0 0 2px' }}>{t.name}</p>
                      <p style={{ fontFamily: PP, fontSize: 12, color: C.mid, margin: 0 }}>{t.origin}</p>
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
                      {[1,2,3,4,5].map(s => <span key={s} style={{ color: '#F59E0B', fontSize: 14 }}>★</span>)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveTestimonial(i)}
                aria-label={`Testimonio ${i + 1}`}
                style={{ width: i === activeTestimonial ? 28 : 10, height: 10, borderRadius: 5, background: i === activeTestimonial ? C.primary : C.border, border: 'none', cursor: 'pointer', padding: 0, transition: 'all .25s' }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── PARTNERS ─────────────────────────────────────────────── */}
      <section style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 60%, #2563EB 100%)', padding: '88px 24px', position: 'relative', overflow: 'hidden' }}>
        <div className="latido-float" style={{ position: 'absolute', top: -40, right: -40, width: 220, height: 220, borderRadius: '50%', background: 'rgba(96,165,250,0.1)', filter: 'blur(6px)' }} />
        <div style={{ maxWidth: 900, margin: '0 auto', position: 'relative' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 48, alignItems: 'center' }}>
            <Reveal>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.12)', color: '#BAE6FD', fontSize: 11, fontWeight: 700, padding: '7px 16px', borderRadius: 24, marginBottom: 22, fontFamily: PP, border: '1px solid rgba(255,255,255,0.2)', letterSpacing: 0.4 }}>
                  🤝 Para empresas y partners
                </div>
                <h2 style={{ fontFamily: PP, fontWeight: 900, fontSize: 'clamp(26px,4vw,40px)', color: '#fff', lineHeight: 1.15, marginBottom: 18, letterSpacing: -0.5 }}>
                  El canal directo a la comunidad hispanohablante en Suiza
                </h2>
                <p style={{ fontFamily: PP, fontSize: 15, color: 'rgba(255,255,255,0.8)', lineHeight: 1.8, marginBottom: 28 }}>
                  ¿Tienes un negocio, ofreces empleo o buscas conectar con nuestra comunidad?
                  Latido es el canal directo al mercado hispanohablante en Suiza.
                </p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <Link
                    to="/registrar-negocio"
                    className="latido-cta-primary"
                    style={{ fontFamily: PP, fontWeight: 700, fontSize: 13, background: '#fff', color: C.primaryDark, textDecoration: 'none', padding: '13px 24px', borderRadius: 13, display: 'inline-flex', alignItems: 'center', gap: 7 }}
                  >
                    Registrar negocio →
                  </Link>
                  <Link
                    to="/publicar-empleo"
                    className="latido-cta-ghost"
                    style={{ fontFamily: PP, fontWeight: 700, fontSize: 13, background: 'rgba(255,255,255,0.13)', color: '#fff', textDecoration: 'none', padding: '13px 24px', borderRadius: 13, display: 'inline-flex', alignItems: 'center', gap: 7, border: '1.5px solid rgba(255,255,255,0.3)' }}
                  >
                    Publicar empleo
                  </Link>
                </div>
              </div>
            </Reveal>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {PARTNER_BENEFITS.map((b, i) => (
                <Reveal key={b.title} delay={i * 100}>
                  <div
                    className="latido-card-hover"
                    style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 18, padding: '20px 18px', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', height: '100%' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.13)'; e.currentTarget.style.transform = 'translateY(-3px)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'translateY(0)' }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 10 }}>{b.icon}</div>
                    <h3 style={{ fontFamily: PP, fontWeight: 700, fontSize: 13, color: '#fff', marginBottom: 6, lineHeight: 1.3 }}>{b.title}</h3>
                    <p style={{ fontFamily: PP, fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, margin: 0 }}>{b.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PWA INSTALL ──────────────────────────────────────────── */}
      <section style={{ maxWidth: 720, margin: '88px auto 0', padding: '0 24px' }}>
        <Reveal>
          <div style={{ background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)', borderRadius: 28, padding: '52px 32px', textAlign: 'center', border: `1.5px solid ${C.primaryMid}`, position: 'relative', overflow: 'hidden' }}>
            <div className="latido-float" style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(37,99,235,0.08)' }} />
            <div style={{ fontSize: 56, marginBottom: 16, position: 'relative' }}>📱</div>
            <h2 style={{ fontFamily: PP, fontWeight: 800, fontSize: 28, color: C.text, marginBottom: 10, letterSpacing: -0.5, position: 'relative' }}>
              Latido siempre en tu bolsillo
            </h2>
            <p style={{ fontFamily: PP, fontSize: 14, color: C.mid, lineHeight: 1.75, marginBottom: 32, maxWidth: 420, margin: '0 auto 32px', position: 'relative' }}>
              Instálala gratis como app en tu móvil. Sin App Store, sin Google Play. Directamente desde el navegador.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, marginBottom: 28, maxWidth: 560, margin: '0 auto 28px', position: 'relative' }}>
              <div style={{ background: '#fff', borderRadius: 16, padding: '16px 14px', border: `1px solid ${C.border}` }}>
                <p style={{ fontFamily: PP, fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 5 }}>🍎 iPhone / iPad</p>
                <p style={{ fontFamily: PP, fontSize: 11, color: C.mid, lineHeight: 1.55, margin: 0 }}>Safari → Compartir 📤 → "Añadir a inicio"</p>
              </div>
              <button
                onClick={onInstall}
                className="latido-cta-primary"
                style={{ background: C.primary, borderRadius: 16, padding: '16px 14px', border: 'none', cursor: 'pointer' }}
              >
                <p style={{ fontFamily: PP, fontWeight: 700, fontSize: 13, color: '#fff', marginBottom: 5 }}>🤖 Android</p>
                <p style={{ fontFamily: PP, fontSize: 11, color: 'rgba(255,255,255,0.85)', lineHeight: 1.55, margin: 0 }}>📲 Toca aquí para instalar</p>
              </button>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 760, margin: '88px auto 0', padding: '0 24px' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <p style={{ fontFamily: PP, fontSize: 11, fontWeight: 700, color: C.primary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Preguntas frecuentes</p>
            <h2 style={{ fontFamily: PP, fontWeight: 800, fontSize: 'clamp(22px,4vw,30px)', color: C.text, margin: '0 0 10px', letterSpacing: -0.5 }}>
              Todo lo que te estás preguntando
            </h2>
            <p style={{ fontFamily: PP, fontSize: 14, color: C.mid, maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
              Si te falta algo por aclarar, escríbenos — te leemos todos los días.
            </p>
          </div>
        </Reveal>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FAQ.map((item, i) => {
            const isOpen = openFaq === i
            return (
              <Reveal key={i} delay={i * 40}>
                <div
                  style={{
                    background: isOpen ? '#F8FAFF' : '#fff',
                    border: `1.5px solid ${isOpen ? C.primaryMid : C.border}`,
                    borderRadius: 16,
                    overflow: 'hidden',
                    transition: 'background .2s, border-color .2s',
                  }}
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? -1 : i)}
                    aria-expanded={isOpen}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      padding: '18px 22px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: PP,
                    }}
                  >
                    <span style={{ fontFamily: PP, fontWeight: 700, fontSize: 15, color: C.text, lineHeight: 1.4 }}>{item.q}</span>
                    <span
                      aria-hidden
                      style={{
                        flexShrink: 0,
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: isOpen ? C.primary : C.primaryLight,
                        color: isOpen ? '#fff' : C.primary,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        fontWeight: 700,
                        transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                        transition: 'transform .25s, background .2s, color .2s',
                      }}
                    >
                      +
                    </span>
                  </button>
                  <div
                    style={{
                      maxHeight: isOpen ? 400 : 0,
                      overflow: 'hidden',
                      transition: 'max-height .35s ease',
                    }}
                  >
                    <p style={{ fontFamily: PP, fontSize: 13.5, color: C.mid, lineHeight: 1.75, margin: 0, padding: '0 22px 20px' }}>
                      {item.a}
                    </p>
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────── */}
      <section style={{ maxWidth: 720, margin: '88px auto 0', padding: '0 24px 96px' }}>
        <Reveal>
          <div style={{ textAlign: 'center' }}>
            <div
              className="latido-float"
              style={{ width: 72, height: 72, background: `linear-gradient(135deg, ${C.primaryDark}, ${C.primary})`, borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 24px', boxShadow: '0 16px 40px rgba(37,99,235,0.32)' }}
            >🌎</div>
            <h2 style={{ fontFamily: PP, fontWeight: 900, fontSize: 'clamp(26px,5vw,42px)', color: C.text, margin: '0 0 16px', letterSpacing: -0.5, lineHeight: 1.15 }}>
              Tu comunidad te espera.
            </h2>
            <p style={{ fontFamily: PP, fontSize: 15, color: C.mid, lineHeight: 1.8, marginBottom: 36, maxWidth: 460, margin: '0 auto 36px' }}>
              Únete a miles de hispanohablantes que ya encontraron piso, trabajo, comunidad y mucho más en Latido.
              Gratis. En tu idioma. Entre los tuyos.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link
                to="/auth"
                className="latido-cta-primary"
                style={{ fontFamily: PP, fontWeight: 800, fontSize: 15, background: C.primary, color: '#fff', textDecoration: 'none', padding: '16px 36px', borderRadius: 16, display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 12px 32px rgba(37,99,235,0.38)' }}
              >
                Unirme gratis →
              </Link>
              <Link
                to="/tablon"
                className="latido-cta-ghost"
                style={{ fontFamily: PP, fontWeight: 700, fontSize: 15, background: '#fff', color: C.primary, textDecoration: 'none', padding: '16px 28px', borderRadius: 16, display: 'inline-flex', alignItems: 'center', gap: 7, border: `1.5px solid ${C.primaryMid}` }}
              >
                Ver anuncios
              </Link>
            </div>
            <p style={{ fontFamily: PP, fontSize: 11, color: C.light, marginTop: 18 }}>
              ✨ Gratis · 30 segundos · En español
            </p>
          </div>
        </Reveal>
      </section>

    </div>
  )
}