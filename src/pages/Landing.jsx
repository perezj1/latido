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
  { value: '100%',     label: 'Gratis' },
  { value: '1 min',    label: 'Publica en 1 minuto' },
]

const FEATURES = [
  { icon: '📌', color: '#DBEAFE', title: 'Tablón de anuncios',  desc: 'Pisos, empleo, cuidados, servicios y mercado de segunda mano. Todo en tu cantón, en tu idioma. Filtra por ciudad o código postal.' },
  { icon: '🤝', color: '#D1FAE5', title: 'Comunidades',         desc: 'Grupos de venezolanos en Zúrich, colombianos en Ginebra, familias en Berna. Encuentra a los tuyos donde vives.' },
  { icon: '🏪', color: '#FCE7F3', title: 'Negocios',            desc: 'Restaurantes, peluquerías, tiendas y servicios de nuestra comunidad. Apoya a quien habla tu idioma.' },
  { icon: '📚', color: '#EDE9FE', title: 'Guías de trámites',   desc: 'Krankenkasse, Quellensteuer, permiso B/C/L, buscador de trabajo. La burocracia suiza explicada paso a paso en español.' },
  { icon: '🎉', color: '#FEF3C7', title: 'Eventos',             desc: 'Fiestas, conciertos, quedadas y networking. Sabe siempre qué pasa en tu ciudad y publica los tuyos.' },
  { icon: '📱', color: '#CCFBF1', title: 'App gratuita (PWA)',  desc: 'Instálala en tu móvil sin pasar por ninguna tienda. Un toque desde Safari o Chrome y la tienes en tu pantalla de inicio.' },
]

const STEPS = [
  { n: '1', emoji: '✍️', title: 'Crea tu cuenta',    desc: 'Gratis, en 2 pasos. Solo tu email y tu cantón.' },
  { n: '2', emoji: '🔍', title: 'Explora o publica', desc: 'Busca lo que necesitas o publica tu anuncio en segundos.' },
  { n: '3', emoji: '💬', title: 'Conecta',            desc: 'Habla directamente con la persona. Sin intermediarios, sin comisiones.' },
]

const TESTIMONIALS = [
  { text: 'Encontré piso en Basel en 4 días. Publiqué en Latido y a la semana ya estaba firmando el contrato. No lo hubiera conseguido tan rápido en ningún otro sitio.', name: 'Carlos M.',  origin: '🇨🇴 Colombiano · Basel',  avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=96&h=96&fit=crop&crop=face' },
  { text: 'Llevo 3 años en Suiza y siempre me sentía sola buscando trabajo. Con Latido encontré una oferta de una empresa que busca personas bilingües. Empiezo el mes que viene.', name: 'Lucía V.',  origin: '🇻🇪 Venezolana · Zúrich', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=96&h=96&fit=crop&crop=face' },
  { text: 'Registré mi restaurante y en una semana había conseguido 20 reseñas y reservas de gente de la comunidad. Es increíble el poder de tener nuestra propia plataforma.',       name: 'Roberto S.', origin: '🇵🇪 Peruano · Ginebra',   avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=96&h=96&fit=crop&crop=face' },
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
  { tag: '🏠 Vivienda',  who: 'María · Zürich',    text: 'Busco piso de 2 habitaciones en Oerlikon para julio. Hasta 2.800 CHF.', time: 'hace 3 min',  color: '#DBEAFE', tc: '#1D4ED8' },
  { tag: '💼 Empleo',    who: 'Tech Startup · GVA', text: 'Buscamos developer full-stack hispanohablante. Remoto o híbrido.',        time: 'hace 12 min', color: '#D1FAE5', tc: '#065F46' },
  { tag: '🎉 Evento',    who: 'Salsa Club Bern',    text: 'Noche latina este viernes 21h. Entrada libre para la comunidad.',        time: 'hace 1 h',    color: '#FCE7F3', tc: '#9D174D' },
  { tag: '📚 Guía',      who: 'Comunidad Latido',   text: 'Cómo pedir tu permiso C después de 10 años: paso a paso actualizado.',    time: 'hoy',         color: '#EDE9FE', tc: '#6D28D9' },
]

const FAQ = [
  { q: '¿Latido es realmente gratis?',                       a: 'Sí. Registrarte, publicar anuncios, unirte a comunidades y asistir a eventos es 100% gratis para usuarios. Las empresas y partners tienen opciones de visibilidad premium opcionales.' },
  { q: '¿Necesito hablar alemán, francés o italiano?',       a: 'No. Latido está 100% en español. Es precisamente para eso: un espacio donde no tengas que lidiar con el idioma del cantón mientras buscas piso, trabajo o comunidad.' },
  { q: '¿Es seguro? ¿Qué pasa con mis datos?',               a: 'Cumplimos la Ley Federal de Protección de Datos de Suiza (nFADP) y el GDPR europeo. Nunca vendemos tus datos. Los anuncios y perfiles se moderan para evitar fraudes y contenido inapropiado.' },
  { q: '¿Tengo que vivir en Suiza para registrarme?',        a: 'Está pensado para quienes ya viven en Suiza o están a punto de mudarse. Si estás preparando tu llegada, puedes registrarte para ir conectando y encontrar piso o empleo antes de aterrizar.' },
  { q: '¿Funciona en toda Suiza o solo en ciudades grandes?', a: 'Cubrimos los 26 cantones. Hay más actividad en Zúrich, Ginebra, Basilea, Lausana y Berna, pero cada semana crecen las comunidades en el resto — y tú puedes ser quien empiece la tuya.' },
  { q: '¿Necesito descargar algo desde App Store o Google Play?', a: 'No. Latido es una app web instalable (PWA). La añades a la pantalla de inicio de tu móvil en un toque desde Safari o Chrome. Ocupa casi nada y se comporta como una app nativa.' },
]

/* ─────────────────────────────────────────────────────────────
   HOOKS & SMALL COMPONENTS
   ───────────────────────────────────────────────────────────── */

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
   MENU PANELS
   ───────────────────────────────────────────────────────────── */

function PanelSobre() {
  return (
    <section style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%)', borderRadius: 24, padding: '48px 28px' }}>
      <p style={{ fontFamily: PP, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 20 }}>La historia detrás de Latido</p>
      <h2 style={{ fontFamily: PP, fontWeight: 900, fontSize: 'clamp(22px,4.5vw,36px)', color: '#fff', lineHeight: 1.2, letterSpacing: -0.5, marginBottom: 32 }}>
        {'Llegué a Suiza desde España en 2017.'}<br />
        <span style={{ color: '#60A5FA' }}>{'El comienzo no fue fácil.'}</span>
      </h2>
      <div style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <p style={{ fontFamily: PP, fontSize: 15, color: 'rgba(255,255,255,0.82)', lineHeight: 1.85, margin: 0 }}>
          {'No hablaba el idioma, apenas me defendía con el inglés, no conocía a nadie y no sabía bien por dónde empezar.'}
        </p>
        <p style={{ fontFamily: PP, fontSize: 15, color: 'rgba(255,255,255,0.82)', lineHeight: 1.85, margin: 0 }}>
          {'Pero con el tiempo entendí algo: la dificultad no era el país — era no tener cerca a gente con la que compartía mi forma de ver la vida.'}
        </p>
        <p style={{ fontFamily: PP, fontSize: 15, color: 'rgba(255,255,255,0.82)', lineHeight: 1.85, margin: 0 }}>
          {'Todo cambiaba cada vez que conocía a alguien que hablaba español. La cercanía, el humor, la forma de expresarnos… el idioma nos unía. Porque el idioma no son solo palabras — es cultura, es identidad, es hogar.'}
        </p>
        <p style={{ fontFamily: PP, fontSize: 'clamp(16px,2.4vw,19px)', color: '#fff', lineHeight: 1.6, margin: 0, fontWeight: 800, letterSpacing: -0.2 }}>
          {'Por eso creé Latido.'}
        </p>
        <p style={{ fontFamily: PP, fontSize: 15, color: 'rgba(255,255,255,0.82)', lineHeight: 1.85, margin: 0 }}>
          {'Para que nadie tenga que pasar años buscando a los suyos. Para que desde el primer día tengas un lugar donde encontrar ayuda, trabajo, piso, eventos y personas que hablan tu idioma.'}
        </p>
        <p style={{ fontFamily: PP, fontSize: 15, color: 'rgba(255,255,255,0.82)', lineHeight: 1.85, margin: 0 }}>
          {'Un lugar donde sentirte acompañado.'}
        </p>
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p style={{ fontFamily: PP, fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4, margin: 0, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>Latido</p>
          <p style={{ fontFamily: PP, fontSize: 'clamp(16px,2.5vw,20px)', color: '#93C5FD', lineHeight: 1.5, margin: 0, fontWeight: 700, fontStyle: 'italic' }}>
            {'Lejos de casa, pero nunca solos.'}
          </p>
        </div>
      </div>
      <div style={{ marginTop: 36, paddingTop: 28, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <img src="/founder.jpg" alt="José Pérez González" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid rgba(255,255,255,0.2)' }} />
        <div>
          <p style={{ fontFamily: PP, fontWeight: 700, fontSize: 13, color: '#fff', margin: '0 0 2px' }}>{'José Pérez González'}</p>
          <p style={{ fontFamily: PP, fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: 0 }}>Fundador · Español en Suiza desde 2017 · Luzern</p>
        </div>
        <Link to="/auth" style={{ marginLeft: 'auto', fontFamily: PP, fontWeight: 800, fontSize: 13, background: '#fff', color: '#1E3A8A', textDecoration: 'none', padding: '12px 22px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          Quiero ser parte de esto
        </Link>
      </div>
    </section>
  )
}

function PanelFaq() {
  const [openFaq, setOpenFaq] = useState(0)
  const [question, setQuestion] = useState('')
  const [emptyMsg, setEmptyMsg] = useState(false)

  const handleSend = () => {
    const q = question.trim()
    if (!q) { setEmptyMsg(true); setTimeout(() => setEmptyMsg(false), 2500); return }
    setEmptyMsg(false)
    window.location.href = `mailto:latidoch@gmail.com?subject=${encodeURIComponent('Pregunta desde Latido')}&body=${encodeURIComponent(q)}`
  }

  return (
    <div>
      <p style={{ fontFamily: PP, fontSize: 14, color: C.mid, marginBottom: 28, lineHeight: 1.7 }}>
        Si te falta algo por aclarar, escríbenos — te leemos todos los días.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {FAQ.map((item, i) => {
          const isOpen = openFaq === i
          return (
            <div key={i} style={{ background: isOpen ? '#F8FAFF' : '#fff', border: `1.5px solid ${isOpen ? C.primaryMid : C.border}`, borderRadius: 16, overflow: 'hidden', transition: 'background .2s, border-color .2s' }}>
              <button
                onClick={() => setOpenFaq(isOpen ? -1 : i)}
                style={{ width: '100%', background: 'transparent', border: 'none', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, cursor: 'pointer', textAlign: 'left', fontFamily: PP }}
              >
                <span style={{ fontFamily: PP, fontWeight: 700, fontSize: 14, color: C.text, lineHeight: 1.4 }}>{item.q}</span>
                <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', background: isOpen ? C.primary : C.primaryLight, color: isOpen ? '#fff' : C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700, transform: isOpen ? 'rotate(45deg)' : 'none', transition: 'transform .25s, background .2s' }}>+</span>
              </button>
              <div style={{ maxHeight: isOpen ? 400 : 0, overflow: 'hidden', transition: 'max-height .35s ease' }}>
                <p style={{ fontFamily: PP, fontSize: 13, color: C.mid, lineHeight: 1.75, margin: 0, padding: '0 20px 18px' }}>{item.a}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 32, background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 20, padding: '22px 20px' }}>
        <p style={{ fontFamily: PP, fontWeight: 700, fontSize: 14, color: C.text, margin: '0 0 6px' }}>¿No encuentras tu respuesta?</p>
        <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: '0 0 14px', lineHeight: 1.6 }}>{'Escríbenos tu pregunta y responderemos lo antes posible.'}</p>
        <textarea
          value={question}
          onChange={e => { setQuestion(e.target.value); setEmptyMsg(false) }}
          placeholder="Escribe tu pregunta aquí..."
          rows={3}
          style={{ width: '100%', boxSizing: 'border-box', fontFamily: PP, fontSize: 13, color: C.text, border: `1.5px solid ${emptyMsg ? '#e53935' : C.border}`, borderRadius: 12, padding: '12px 14px', resize: 'none', outline: 'none', background: '#fff', lineHeight: 1.6, marginBottom: emptyMsg ? 6 : 10, transition: 'border-color .2s' }}
        />
        {emptyMsg && <p style={{ fontFamily: PP, fontSize: 12, color: '#e53935', margin: '0 0 10px', fontWeight: 600 }}>{'Escribe tu pregunta antes de enviar.'}</p>}
        <button
          onClick={handleSend}
          style={{ width: '100%', fontFamily: PP, fontWeight: 700, fontSize: 13, background: C.primary, color: '#fff', border: 'none', borderRadius: 12, padding: '13px 0', cursor: 'pointer' }}
        >
          {'📬 Enviar pregunta'}
        </button>
      </div>
    </div>
  )
}

function PanelPartners() {
  return (
    <div>
      <div style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 60%, #2563EB 100%)', borderRadius: 24, padding: '40px 28px', marginBottom: 28 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.12)', color: '#BAE6FD', fontSize: 11, fontWeight: 700, padding: '6px 14px', borderRadius: 20, marginBottom: 18, fontFamily: PP, border: '1px solid rgba(255,255,255,0.2)', letterSpacing: 0.4 }}>
          🤝 Para empresas y partners
        </div>
        <h2 style={{ fontFamily: PP, fontWeight: 900, fontSize: 'clamp(22px,4vw,36px)', color: '#fff', lineHeight: 1.15, marginBottom: 14, letterSpacing: -0.5 }}>
          El canal directo a la comunidad hispanohablante en Suiza
        </h2>
        <p style={{ fontFamily: PP, fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 1.8, marginBottom: 24 }}>
          ¿Tienes un negocio, ofreces empleo o buscas conectar con nuestra comunidad?
          Latido es el canal directo al mercado hispanohablante en Suiza.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/registrar-negocio" style={{ fontFamily: PP, fontWeight: 700, fontSize: 13, background: '#fff', color: C.primaryDark, textDecoration: 'none', padding: '12px 22px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            Registrar negocio →
          </Link>
          <Link to="/publicar-empleo" style={{ fontFamily: PP, fontWeight: 700, fontSize: 13, background: 'rgba(255,255,255,0.13)', color: '#fff', textDecoration: 'none', padding: '12px 22px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 7, border: '1.5px solid rgba(255,255,255,0.3)' }}>
            Publicar empleo
          </Link>
        </div>
      </div>

      <h3 style={{ fontFamily: PP, fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 16 }}>¿Por qué Latido?</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12, marginBottom: 32 }}>
        {PARTNER_BENEFITS.map((b) => (
          <div key={b.title} style={{ background: '#F8FAFF', borderRadius: 18, padding: '20px 18px', border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>{b.icon}</div>
            <h3 style={{ fontFamily: PP, fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 6, lineHeight: 1.3 }}>{b.title}</h3>
            <p style={{ fontFamily: PP, fontSize: 11, color: C.mid, lineHeight: 1.6, margin: 0 }}>{b.desc}</p>
          </div>
        ))}
      </div>

      <div style={{ background: C.primaryLight, borderRadius: 18, padding: '24px', textAlign: 'center' }}>
        <p style={{ fontFamily: PP, fontWeight: 700, fontSize: 14, color: C.primaryDark, margin: '0 0 6px' }}>¿Hablamos?</p>
        <p style={{ fontFamily: PP, fontSize: 13, color: C.mid, margin: '0 0 16px', lineHeight: 1.6 }}>Cuéntanos tu caso y exploramos cómo Latido puede ayudarte a llegar a la comunidad hispanohablante en Suiza.</p>
        <a href="mailto:latidoch@gmail.com" style={{ fontFamily: PP, fontWeight: 700, fontSize: 13, background: C.primary, color: '#fff', textDecoration: 'none', padding: '12px 24px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          📧 latidoch@gmail.com
        </a>
      </div>
    </div>
  )
}

function PanelContacto() {
  return (
    <div>
      <p style={{ fontFamily: PP, fontSize: 14, color: C.mid, marginBottom: 28, lineHeight: 1.75 }}>
        Somos un equipo pequeño y comprometido. Leemos todos los mensajes y respondemos en menos de 48 horas.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 32 }}>
        <a href="mailto:latidoch@gmail.com" style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 18, padding: '20px 22px', textDecoration: 'none' }}>
          <div style={{ width: 48, height: 48, background: C.primaryLight, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>📧</div>
          <div>
            <p style={{ fontFamily: PP, fontWeight: 700, fontSize: 14, color: C.text, margin: '0 0 3px' }}>Email</p>
            <p style={{ fontFamily: PP, fontSize: 13, color: C.primary, margin: 0 }}>latidoch@gmail.com</p>
          </div>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 18, padding: '20px 22px' }}>
          <div style={{ width: 48, height: 48, background: '#FEF3C7', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>⏱️</div>
          <div>
            <p style={{ fontFamily: PP, fontWeight: 700, fontSize: 14, color: C.text, margin: '0 0 3px' }}>Tiempo de respuesta</p>
            <p style={{ fontFamily: PP, fontSize: 13, color: C.mid, margin: 0 }}>Menos de 48 horas (días laborables)</p>
          </div>
        </div>
      </div>

      <a
        href="mailto:latidoch@gmail.com?subject=Pregunta%20sobre%20Latido"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', background: C.primary, border: 'none', borderRadius: 16, padding: '16px 24px', cursor: 'pointer', textDecoration: 'none', marginBottom: 16, boxSizing: 'border-box' }}
      >
        <span style={{ fontSize: 20 }}>✉️</span>
        <div style={{ textAlign: 'left' }}>
          <p style={{ fontFamily: PP, fontWeight: 800, fontSize: 14, color: '#fff', margin: 0 }}>Envíanos tu pregunta</p>
          <p style={{ fontFamily: PP, fontSize: 11, color: 'rgba(255,255,255,0.75)', margin: 0 }}>Te responderemos lo antes posible</p>
        </div>
      </a>

      <div style={{ background: 'linear-gradient(135deg, #0F172A, #1E3A8A)', borderRadius: 20, padding: '28px 24px', textAlign: 'center' }}>
        <p style={{ fontFamily: PP, fontWeight: 800, fontSize: 16, color: '#fff', margin: '0 0 8px' }}>¿Ya tienes cuenta?</p>
        <p style={{ fontFamily: PP, fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: '0 0 20px', lineHeight: 1.65 }}>Entra a Latido, es gratis. Encuentra piso, empleo, comunidad y mucho más en español.</p>
        <Link to="/auth" style={{ fontFamily: PP, fontWeight: 800, fontSize: 14, background: '#fff', color: C.primaryDark, textDecoration: 'none', padding: '13px 28px', borderRadius: 13, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          Registrarme gratis →
        </Link>
      </div>
    </div>
  )
}

const PANEL_TITLES = {
  sobre:    'Sobre Latido',
  faq:      'Preguntas frecuentes',
  partners: 'Para empresas y partners',
  contacto: 'Contacto',
}

function MenuPanel({ menuPage, setMenuPage }) {
  useEffect(() => {
    if (!menuPage) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [menuPage])

  if (!menuPage) return null
  const title = PANEL_TITLES[menuPage] || ''

  return (
    <div className="no-scroll" style={{ position: 'fixed', inset: 0, zIndex: 150, background: '#fff', overflowY: 'auto', display: 'flex', flexDirection: 'column', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      {/* Panel header */}
      <div style={{ position: 'sticky', top: 0, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(10px)', borderBottom: `1px solid ${C.border}`, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 14, zIndex: 1, flexShrink: 0 }}>
        <button
          onClick={() => setMenuPage(null)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.bg, border: 'none', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontFamily: PP, fontWeight: 600, fontSize: 13, color: C.mid }}
        >
          ← Volver
        </button>
        <span style={{ fontFamily: PP, fontWeight: 700, fontSize: 16, color: C.text }}>{title}</span>
      </div>
      {/* Panel content */}
      <div style={{ padding: '32px 24px 64px', maxWidth: 860, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {menuPage === 'sobre'    && <PanelSobre />}
        {menuPage === 'faq'     && <PanelFaq />}
        {menuPage === 'partners' && <PanelPartners />}
        {menuPage === 'contacto' && <PanelContacto />}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   MAIN
   ───────────────────────────────────────────────────────────── */

const isIOS = typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

const isAndroid = typeof navigator !== 'undefined' && /Android/.test(navigator.userAgent)

export default function Landing({ onInstall, menuPage, setMenuPage }) {
  const [cols, setCols] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 500 ? 2 : 3))

  useEffect(() => {
    const fn = () => setCols(window.innerWidth < 500 ? 2 : 3)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  return (
    <div style={{ background: '#fff', overflowX: 'hidden' }}>

      {/* ── GLOBAL KEYFRAMES ────────────────────────────────────── */}
      <style>{`
        @keyframes latido-fade-up { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
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
        .latido-marquee-track { display: inline-flex; gap: 40px; animation: latido-marquee 40s linear infinite; }
        .latido-hero-bg { background-size: 180% 180%; animation: latido-gradient 22s ease infinite; }
        .latido-card-hover { transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease; }
        @media (prefers-reduced-motion: reduce) {
          .latido-enter-1, .latido-enter-2, .latido-enter-3, .latido-enter-4, .latido-enter-5,
          .latido-float, .latido-float-slow, .latido-marquee-track, .latido-hero-bg { animation: none !important; }
          .latido-cta-primary, .latido-cta-ghost, .latido-card-hover { transition: none !important; }
        }
      `}</style>

      {/* ── SLIDE-IN PANEL OVERLAY ─────────────────────────────── */}
      <MenuPanel menuPage={menuPage} setMenuPage={setMenuPage} />

      {/* ── HERO ─────────────────────────────────────────────────── */}
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
  <div className="latido-float" style={{ position: 'absolute', top: -100, right: -80, width: 360, height: 360, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', filter: 'blur(2px)' }} />
  <div className="latido-float-slow" style={{ position: 'absolute', bottom: -60, left: -40, width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', filter: 'blur(2px)' }} />
  <div className="latido-float" style={{ position: 'absolute', top: 140, left: '55%', width: 180, height: 180, borderRadius: '50%', background: 'rgba(96,165,250,0.16)', filter: 'blur(4px)' }} />

  <div style={{ maxWidth: 760, margin: '0 auto', position: 'relative', textAlign: 'center' }}>
    <div className="latido-enter-1" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.12)', color: '#BAE6FD', fontSize: 11, fontWeight: 700, padding: '8px 18px', borderRadius: 24, marginBottom: 28, fontFamily: PP, border: '1px solid rgba(255,255,255,0.22)', letterSpacing: 0.4, backdropFilter: 'blur(8px)' }}>
      <span style={{ fontSize: 14 }}>🏆</span>
      La primera plataforma para hispanohablantes en Suiza
    </div>

    <h1 className="latido-enter-2" style={{ fontFamily: PP, fontWeight: 900, fontSize: 'clamp(36px, 7.2vw, 64px)', color: '#fff', lineHeight: 1.05, margin: '0 0 22px', letterSpacing: -1.2 }}>
      Todo lo que necesitas en Suiza,
      <br />
      <span style={{ color: '#60A5FA', fontStyle: 'italic' }}>
        en tu idioma.
      </span>
    </h1>

    <p className="latido-enter-3" style={{ fontFamily: PP, fontSize: 17, color: 'rgba(255,255,255,0.86)', lineHeight: 1.75, maxWidth: 580, margin: '0 auto 18px' }}>
      Pisos, trabajo, ayuda, servicios, comunidad y eventos — todo en español, en un solo lugar.
    </p>

   <p className="latido-enter-3" style={{ fontFamily: PP, fontSize: 18, color: '#fff', fontWeight: 500, fontStyle: 'italic', lineHeight: 1.35, maxWidth: 560, margin: '0 auto 26px' }}>
  "Lejos de casa, pero nunca solos."
</p>

    <div className="latido-enter-4" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
      <Link to="/auth" className="latido-cta-primary" style={{ fontFamily: PP, fontWeight: 800, fontSize: 15, background: '#fff', color: C.primaryDark, textDecoration: 'none', padding: '15px 30px', borderRadius: 14, display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 10px 28px rgba(0,0,0,0.22)' }}>
        Crear cuenta gratis →
      </Link>

      <Link to="/tablon" className="latido-cta-ghost" style={{ fontFamily: PP, fontWeight: 700, fontSize: 15, background: 'rgba(255,255,255,0.14)', color: '#fff', textDecoration: 'none', padding: '15px 28px', borderRadius: 14, display: 'inline-flex', alignItems: 'center', gap: 7, border: '1.5px solid rgba(255,255,255,0.32)', backdropFilter: 'blur(6px)' }}>
        Explorar ahora
      </Link>
    </div>

    <p className="latido-enter-5" style={{ fontFamily: PP, fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 56 }}>
      ✨ Gratis para siempre · Registro en 30 segundos
    </p>

    <div className="latido-enter-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 0, borderTop: '1px solid rgba(255,255,255,0.18)', paddingTop: 32, maxWidth: 620, margin: '0 auto' }}>
      {STATS.map(({ value, label }) => (
        <div key={label} style={{ padding: '0 8px' }}>
          <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 'clamp(18px,3vw,26px)', color: '#fff', margin: '0 0 5px', letterSpacing: -0.5 }}>
            <AnimatedStat value={value} />
          </p>
          <p style={{ fontFamily: PP, fontSize: 10, color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.4 }}>
            {label}
          </p>
        </div>
      ))}
    </div>
  </div>
</section>

      {/* ── COUNTRY MARQUEE ──────────────────────────────────────── */}
      <div style={{ background: '#F0F6FF', borderBottom: `1px solid ${C.border}`, padding: '14px 0', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: 60, height: '100%', background: 'linear-gradient(90deg, #F0F6FF, rgba(240,246,255,0))', zIndex: 2 }} />
        <div style={{ position: 'absolute', top: 0, right: 0, width: 60, height: '100%', background: 'linear-gradient(270deg, #F0F6FF, rgba(240,246,255,0))', zIndex: 2 }} />
        <div className="latido-marquee-track" style={{ whiteSpace: 'nowrap' }}>
          {[...COUNTRIES, ...COUNTRIES].map((c, i) => (
            <span key={`${c}-${i}`} style={{ fontFamily: PP, fontSize: 13, fontWeight: 600, color: C.mid, whiteSpace: 'nowrap' }}>{c}</span>
          ))}
        </div>
      </div>

      {/* ── SEARCH ──────────────────────────────────────────────── */}
      <Reveal style={{ position: 'relative', zIndex: 10 }}>
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
            <h2 style={{ fontFamily: PP, fontWeight: 800, fontSize: 'clamp(22px,4vw,32px)', color: C.text, margin: '0 0 10px', letterSpacing: -0.5 }}>Lo que nuestra comunidad necesita, aquí</h2>
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

      {/* ── PWA INSTALL BANNER ───────────────────────────────────── */}
      <section style={{ maxWidth: 760, margin: '72px auto 0', padding: '0 24px' }}>
        {isIOS ? (
          <div style={{ width: '100%', background: `linear-gradient(90deg, ${C.primary}, ${C.primaryDark})`, borderRadius: 16, padding: '16px 20px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 22 }}>📲</span>
              <p style={{ fontFamily: PP, fontWeight: 800, fontSize: 14, color: '#fff', margin: 0 }}>Instala Latido en tu iPhone</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
             {[
  { icon: '①', text: 'Pulsa ••• en el navegador' },
  { icon: '②', text: 'Toca "Compartir" 📤' },
  { icon: '③', text: 'Selecciona "Añadir a pantalla de inicio"' },
  { icon: '✓', text: '¡listo!' },
].map((step) => (
  <div key={step.icon} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ fontFamily: PP, fontWeight: 800, fontSize: 12, color: 'rgba(255,255,255,0.6)', flexShrink: 0 }}>
      {step.icon}
    </span>
    <p style={{ fontFamily: PP, fontSize: 12, color: 'rgba(255,255,255,0.9)', margin: 0 }}>
      {step.text}
    </p>
  </div>
))}
            </div>
          </div>
        ) : (
          <button
            onClick={onInstall}
            style={{ width: '100%', background: `linear-gradient(90deg, ${C.primary}, ${C.primaryDark})`, border: 'none', borderRadius: 16, padding: '16px 24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24 }}>📲</span>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontFamily: PP, fontWeight: 800, fontSize: 14, color: '#fff', margin: 0 }}>Instala Latido app — GRATIS</p>
                <p style={{ fontFamily: PP, fontSize: 11, color: 'rgba(255,255,255,0.75)', margin: 0 }}>Sin App Store ni Google Play. Directo desde el navegador.</p>
              </div>
            </div>
            <span style={{ fontFamily: PP, fontWeight: 700, fontSize: 12, color: '#fff', background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: '7px 14px', flexShrink: 0 }}>Instalar →</span>
          </button>
        )}
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────── */}
      <section style={{ maxWidth: 720, margin: '88px auto 0', padding: '0 24px 96px' }}>
        <Reveal>
          <div style={{ textAlign: 'center' }}>
            <div className="latido-float" style={{ width: 72, height: 72, background: `linear-gradient(135deg, ${C.primaryDark}, ${C.primary})`, borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 24px', boxShadow: '0 16px 40px rgba(37,99,235,0.32)' }}>🌎</div>
            <h2 style={{ fontFamily: PP, fontWeight: 900, fontSize: 'clamp(26px,5vw,42px)', color: C.text, margin: '0 0 16px', letterSpacing: -0.5, lineHeight: 1.15 }}>
              Tu comunidad te espera.
            </h2>
            <p style={{ fontFamily: PP, fontSize: 15, color: C.mid, lineHeight: 1.8, marginBottom: 36, maxWidth: 460, margin: '0 auto 36px' }}>
              Únete a miles de hispanohablantes que ya encontraron piso, trabajo, comunidad y mucho más en Latido.
              Gratis. En tu idioma. Entre los tuyos.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/auth" className="latido-cta-primary" style={{ fontFamily: PP, fontWeight: 800, fontSize: 15, background: C.primary, color: '#fff', textDecoration: 'none', padding: '16px 36px', borderRadius: 16, display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 12px 32px rgba(37,99,235,0.38)' }}>
                Unirme gratis →
              </Link>
              <Link to="/tablon" className="latido-cta-ghost" style={{ fontFamily: PP, fontWeight: 700, fontSize: 15, background: '#fff', color: C.primary, textDecoration: 'none', padding: '16px 28px', borderRadius: 16, display: 'inline-flex', alignItems: 'center', gap: 7, border: `1.5px solid ${C.primaryMid}` }}>
                Ver anuncios
              </Link>
            </div>
            <p style={{ fontFamily: PP, fontSize: 11, color: C.light, marginTop: 18 }}>
              ✨ Gratis · 30 segundos · En español
            </p>
          </div>
        </Reveal>
      </section>

      {/* ── REDES SOCIALES ───────────────────────────────────────── */}
      <section style={{ maxWidth: 720, margin: '0 auto 72px', padding: '0 24px', textAlign: 'center' }}>
        <p style={{ fontFamily: PP, fontSize: 12, color: C.light, marginBottom: 14 }}>Síguenos en redes</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <a
            href="https://www.instagram.com/latido_ch"
            target="_blank"
            rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 14, padding: '10px 18px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="2" width="20" height="20" rx="5.5" stroke="url(#ig)" strokeWidth="2"/>
              <circle cx="12" cy="12" r="4.5" stroke="url(#ig)" strokeWidth="2"/>
              <circle cx="17.5" cy="6.5" r="1" fill="#E1306C"/>
              <defs>
                <linearGradient id="ig" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#F58529"/>
                  <stop offset="0.5" stopColor="#E1306C"/>
                  <stop offset="1" stopColor="#833AB4"/>
                </linearGradient>
              </defs>
            </svg>
            <span style={{ fontFamily: PP, fontWeight: 700, fontSize: 12, color: C.text }}>@latido_ch</span>
          </a>

          <a
            href="https://www.tiktok.com/@latido_ch"
            target="_blank"
            rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 14, padding: '10px 18px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07Z" fill="#000"/>
            </svg>
            <span style={{ fontFamily: PP, fontWeight: 700, fontSize: 12, color: C.text }}>@latido_ch</span>
          </a>
        </div>
      </section>

    </div>
  )
}
