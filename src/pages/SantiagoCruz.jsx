import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  Gift,
  MapPin,
  Play,
  Share2,
  ShieldCheck,
  Ticket,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useCountdown } from '../hooks/useCountdown'
import { trackAnalyticsEvent } from '../lib/analytics'
import { SANTIAGO_CRUZ_EVENT, SANTIAGO_CRUZ_GIVEAWAY } from '../lib/giveaways'
import './SantiagoCruz.css'

// Datos del sorteo y del concierto compartidos con el banner de Inicio.
const GIVEAWAY = SANTIAGO_CRUZ_GIVEAWAY
const EVENT = SANTIAGO_CRUZ_EVENT

const VIDEO = {
  id:'H4JE124-M68',
  title:'Sigo en Pie - Santiago Cruz (Visualizer/Lyric Video)',
  thumbnail:'/events/santiago-cruz/sigo-en-pie-video.jpg',
}

const HERO_IMAGE = GIVEAWAY.heroImage
const PAGE_PATH = GIVEAWAY.path

const CONDITIONS = [
  ['Organizador del sorteo', 'Latido.ch (operador de Latido.ch), Zürich, Suiza · info@latido.ch'],
  ['Premio', `${GIVEAWAY.winners} entradas dobles: ${GIVEAWAY.winners} ganadores × ${GIVEAWAY.ticketsPerWinner} entradas para el concierto de ${EVENT.artist} (${EVENT.tour}) del ${EVENT.dateLabel.toLowerCase()} en ${EVENT.venue}.`],
  ['Precio', 'Participación gratuita.'],
  ['Compra necesaria', 'No.'],
  ['Cuenta Latido necesaria', 'No. Basta con nombre y email.'],
  ['Quién puede participar', 'Personas mayores de 18 años residentes en Suiza. Una participación por persona y email.'],
  ['Inicio', GIVEAWAY.startLabel],
  ['Fin', GIVEAWAY.endLabel],
  ['Selección', `Sorteo aleatorio entre todas las participaciones válidas, el ${GIVEAWAY.drawLabel}.`],
  ['Ganadores', `${GIVEAWAY.winners}.`],
  ['Contacto', 'Por email, a la dirección indicada al participar.'],
  ['Tiempo para responder', `${GIVEAWAY.responseHours} horas desde el aviso.`],
  ['Si no responde', 'El premio se sortea de nuevo entre el resto de participaciones.'],
  ['Premio en efectivo', 'No canjeable por dinero.'],
  ['Datos', 'Solo los necesarios para gestionar el sorteo: nombre y email.'],
  ['Ganadores e invitados', `El nombre de cada ganador se comunica a ${EVENT.promoter}, promotora del concierto, para incluirlo en la lista de invitados (Gästeliste).`],
]

function errorMessage(error) {
  const text = String(error?.message || '')
  if (text.includes('invalid_email')) return 'Revisa el email: parece que no es válido.'
  if (text.includes('invalid_name')) return 'Escribe tu nombre (al menos 2 letras).'
  if (text.includes('giveaway_closed')) return 'El sorteo ya ha terminado.'
  if (text.includes('giveaway_not_started')) return 'El sorteo todavía no ha empezado.'
  return 'No hemos podido guardar tu participación. Inténtalo de nuevo en unos minutos.'
}

function track(eventType, metadata = {}, userId = null) {
  trackAnalyticsEvent(eventType, {
    user_id:userId,
    metadata:{ giveaway_id:GIVEAWAY.id, ...metadata },
  })
}

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior:'smooth', block:'start' })
}

const OPEN_CONDITIONS_EVENT = 'latido:giveaway-open-conditions'

function openConditions() {
  window.dispatchEvent(new Event(OPEN_CONDITIONS_EVENT))
  window.requestAnimationFrame(() => scrollToId('condiciones'))
}

function GiveawayCountdown({ remaining, compact = false }) {
  if (remaining.expired) {
    return <div className={`sc-countdown sc-countdown--closed${compact ? ' sc-countdown--compact' : ''}`}>Sorteo cerrado</div>
  }

  const values = [
    ['Días', remaining.days],
    ['Hrs', remaining.hours],
    ['Min', remaining.minutes],
    ['Seg', remaining.seconds],
  ]
  const accessibleLabel = `El sorteo cierra en ${remaining.days} días, ${remaining.hours} horas, ${remaining.minutes} minutos y ${remaining.seconds} segundos`

  return (
    <div className={`sc-countdown${compact ? ' sc-countdown--compact' : ''}`} data-urgent={remaining.days === 0}>
      <span className="sc-countdown__units" role="timer" aria-label={accessibleLabel}>
        {values.map(([label, value]) => (
          <span className="sc-countdown__unit" key={label}>
            <strong>{String(value).padStart(2, '0')}</strong>
            <small>{label}</small>
          </span>
        ))}
      </span>
    </div>
  )
}

function VideoFacade() {
  const [playing, setPlaying] = useState(false)

  if (playing) {
    return (
      <div className="sc-video__frame">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${VIDEO.id}?autoplay=1&rel=0&modestbranding=1`}
          title={VIDEO.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    )
  }

  // Sin petición a YouTube hasta que la persona decide reproducir.
  return (
    <button
      type="button"
      className="sc-video__frame sc-video__facade"
      onClick={() => {
        setPlaying(true)
        track('giveaway_video_play', { video_id:VIDEO.id })
      }}
      aria-label={`Reproducir vídeo: ${VIDEO.title}`}
    >
      <img src={VIDEO.thumbnail} alt="" loading="lazy" decoding="async" />
      <span className="sc-video__play" aria-hidden="true"><Play size={28} fill="currentColor" /></span>
      <span className="sc-video__caption">
        <strong>Sigo en Pie</strong>
        <small>Santiago Cruz · Visualizer oficial</small>
      </span>
    </button>
  )
}

function ShareButton({ className = 'sc-share', label = 'Compartir', userId }) {
  const share = async () => {
    const url = `${window.location.origin}${PAGE_PATH}`
    const text = `🎤 ${EVENT.artist} en Zürich: participa gratis en el sorteo de ${GIVEAWAY.winners} entradas dobles en Latido.`
    track('giveaway_share', { method:navigator.share ? 'native' : 'copy' }, userId)
    if (navigator.share) {
      try {
        await navigator.share({ title:`${EVENT.artist} en Zürich · Sorteo Latido`, text, url })
        return
      } catch (error) {
        if (error?.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`)
      toast.success('Enlace copiado')
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <button type="button" className={className} onClick={share}>
      <Share2 size={16} aria-hidden="true" />
      <span>{label}</span>
    </button>
  )
}

function ParticipationCard({ onParticipated, giveawayEnded }) {
  const { user, isLoggedIn, loading:authLoading, displayName } = useAuth()
  const [form, setForm] = useState({ name:'', email:'', marketing:false, website:'' })
  const [status, setStatus] = useState('idle')
  const [entryEmail, setEntryEmail] = useState('')
  const [error, setError] = useState('')
  const nameRef = useRef(null)
  const now = Date.now()
  const closed = giveawayEnded || now > new Date(GIVEAWAY.endsAt).getTime()
  const notStarted = now < new Date(GIVEAWAY.startsAt).getTime()

  // Una cuenta que ya participó lo ve al entrar, sin tener que volver a pulsar.
  useEffect(() => {
    if (!isLoggedIn) return undefined
    let cancelled = false
    supabase.rpc('get_my_giveaway_entry', { p_giveaway_id:GIVEAWAY.id }).then(({ data }) => {
      if (cancelled || !data?.status) return
      setEntryEmail(data.email || user?.email || '')
      setStatus('already')
      onParticipated?.()
    })
    return () => { cancelled = true }
  }, [isLoggedIn, user?.email, onParticipated])

  const submit = async event => {
    event.preventDefault()
    if (status === 'submitting') return
    setError('')

    // Campo trampa: los bots lo rellenan, las personas no lo ven.
    if (form.website) {
      setStatus('entered')
      return
    }

    if (!isLoggedIn) {
      if (form.name.trim().length < 2) {
        setError('Escribe tu nombre (al menos 2 letras).')
        nameRef.current?.focus()
        return
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(form.email.trim())) {
        setError('Revisa el email: parece que no es válido.')
        return
      }
    }

    setStatus('submitting')
    const { data, error:rpcError } = await supabase.rpc('enter_giveaway', {
      p_giveaway_id:GIVEAWAY.id,
      p_name:isLoggedIn ? displayName : form.name.trim(),
      p_email:isLoggedIn ? user?.email : form.email.trim(),
      p_marketing_consent:form.marketing,
      p_source:new URLSearchParams(window.location.search).get('utm_source') || 'landing',
    })

    if (rpcError) {
      if (String(rpcError.message || '').includes('giveaway_closed')) {
        setStatus('closed')
        return
      }
      setStatus('idle')
      setError(errorMessage(rpcError))
      return
    }

    setEntryEmail(data?.email || form.email.trim() || user?.email || '')
    setStatus(data?.status === 'already' ? 'already' : 'entered')
    onParticipated?.()
    if (data?.status !== 'already') {
      track('giveaway_entry', {
        entry_type:isLoggedIn ? 'account' : 'guest',
        marketing_consent:form.marketing,
      }, user?.id || null)
    }
  }

  if (status === 'entered' || status === 'already') {
    return (
      <div className="sc-card sc-card--success" role="status" aria-live="polite">
        <span className="sc-success__icon" aria-hidden="true"><Check size={26} strokeWidth={3} /></span>
        <h2 className="sc-card__title">¡Ya estás participando!</h2>
        <p className="sc-card__text">
          {status === 'already' ? 'Este email ya estaba en el sorteo. ' : ''}
          Si ganas, te escribiremos{entryEmail ? <> a <strong>{entryEmail}</strong></> : ''} el {GIVEAWAY.drawLabel}.
        </p>

        {!isLoggedIn && (
          <div className="sc-join">
            <p>Únete a la comunidad hispanohablante en Suiza.</p>
            <Link
              to={`/auth?mode=register&next=${encodeURIComponent('/')}`}
              className="sc-button sc-button--blue"
              onClick={() => track('giveaway_signup_click')}
            >
              Crear mi perfil gratis
            </Link>
          </div>
        )}

        <div className="sc-share-box">
          <p>¿Conoces a alguien que quiera ver a {EVENT.artist}?</p>
          <ShareButton userId={user?.id || null} />
        </div>
      </div>
    )
  }

  if (closed || status === 'closed') {
    return (
      <div className="sc-card" role="status">
        <span className="sc-card__eyebrow">Sorteo finalizado</span>
        <h2 className="sc-card__title">La participación está cerrada</h2>
        <p className="sc-card__text">
          El plazo terminó el {GIVEAWAY.endLabel}. Contactaremos por email con las personas ganadoras.
        </p>
      </div>
    )
  }

  return (
    <form className="sc-card" onSubmit={submit} noValidate>
      <span className="sc-card__eyebrow">Sorteo gratuito</span>
      <h2 className="sc-card__title">Participa en el sorteo</h2>

      {notStarted ? (
        <p className="sc-card__notice">El sorteo empieza el {GIVEAWAY.startLabel}.</p>
      ) : authLoading ? (
        <div className="sc-card__loading" aria-hidden="true" />
      ) : isLoggedIn ? (
        <div className="sc-account">
          <span className="sc-account__avatar" aria-hidden="true">{(displayName || 'L').slice(0, 1).toUpperCase()}</span>
          <span className="sc-account__text">
            <small>Participas con tu cuenta de Latido</small>
            <strong>{displayName}</strong>
            <span>{user?.email}</span>
          </span>
        </div>
      ) : (
        <div className="sc-fields">
          <label className="sc-field">
            <span>Nombre</span>
            <input
              ref={nameRef}
              type="text"
              name="name"
              autoComplete="name"
              maxLength={80}
              value={form.name}
              onChange={event => setForm(previous => ({ ...previous, name:event.target.value }))}
              placeholder="Tu nombre y apellido"
              required
            />
          </label>
          <label className="sc-field">
            <span>Email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              maxLength={254}
              value={form.email}
              onChange={event => setForm(previous => ({ ...previous, email:event.target.value }))}
              placeholder="tu@email.com"
              required
            />
          </label>
          <label className="sc-honeypot" aria-hidden="true">
            Web
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={event => setForm(previous => ({ ...previous, website:event.target.value }))}
            />
          </label>
          <label className="sc-check">
            <input
              type="checkbox"
              checked={form.marketing}
              onChange={event => setForm(previous => ({ ...previous, marketing:event.target.checked }))}
            />
            <span>Quiero recibir novedades de Latido por email. <em>(opcional)</em></span>
          </label>
        </div>
      )}

      {error && <p className="sc-error" role="alert">{error}</p>}

      {!notStarted && (
        <button type="submit" className="sc-button sc-button--primary sc-button--block" disabled={status === 'submitting' || authLoading}>
          <Ticket size={19} aria-hidden="true" />
          {status === 'submitting' ? 'Guardando…' : 'Participar gratis'}
        </button>
      )}

      <div className="sc-legal">
        <p><ShieldCheck size={15} aria-hidden="true" /> Gratis · Sin compra · Sin cuenta</p>
        <p>
          Al participar aceptas las{' '}
          <button type="button" className="sc-link" onClick={openConditions}>condiciones del sorteo</button>
          {' '}y la <Link to="/privacidad" className="sc-link">política de privacidad</Link>.
        </p>
      </div>
    </form>
  )
}

export default function SantiagoCruz() {
  const { user } = useAuth()
  const [conditionsOpen, setConditionsOpen] = useState(false)
  const [participated, setParticipated] = useState(false)
  const [stickyVisible, setStickyVisible] = useState(false)
  const heroActionsRef = useRef(null)
  const formRef = useRef(null)
  const markParticipated = useCallback(() => setParticipated(true), [])
  const countdown = useCountdown(GIVEAWAY.endsAt)

  // Botón fijo en móvil: solo cuando no se ve ni el del banner ni el formulario.
  useEffect(() => {
    const targets = [heroActionsRef.current, formRef.current].filter(Boolean)
    if (!targets.length || typeof IntersectionObserver === 'undefined') return undefined
    const visible = new Map()
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => visible.set(entry.target, entry.isIntersecting))
      setStickyVisible(![...visible.values()].some(Boolean))
    }, { threshold:0.05 })
    targets.forEach(target => {
      visible.set(target, true)
      observer.observe(target)
    })
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const openFromHash = () => {
      if (window.location.hash === '#condiciones') setConditionsOpen(true)
    }
    const open = () => setConditionsOpen(true)
    openFromHash()
    window.addEventListener('hashchange', openFromHash)
    window.addEventListener(OPEN_CONDITIONS_EVENT, open)
    return () => {
      window.removeEventListener('hashchange', openFromHash)
      window.removeEventListener(OPEN_CONDITIONS_EVENT, open)
    }
  }, [])

  const goToForm = placement => {
    track('giveaway_cta_click', { placement }, user?.id || null)
    scrollToId('participar')
  }

  return (
    <div className="sc-page">
      <header className="sc-topbar">
        <Link to="/" className="sc-brand" aria-label="Ir a Latido.ch">
          <img src="/favicon.svg" alt="" width="30" height="30" />
          <span>Latido</span>
        </Link>
        <ShareButton className="sc-topbar__share" label="Compartir" userId={user?.id || null} />
      </header>

      <section className="sc-hero" aria-labelledby="sc-title">
        <div className="sc-hero__card">
          <div className="sc-hero__media">
            <img
              className="sc-hero__image"
              src={HERO_IMAGE}
              alt={`${EVENT.artist}, foto oficial de la gira ${EVENT.tour}`}
              fetchpriority="high"
              decoding="async"
            />
            <span className="sc-chip">
              <img src="/favicon.svg" alt="" width="18" height="18" />
              Evento especial
            </span>
          </div>

          <div className="sc-hero__body">
            <h1 id="sc-title" className="sc-hero__title">{EVENT.artist} en Zürich</h1>
            <div className="sc-prize">
              <Gift size={18} aria-hidden="true" />
              <strong>{GIVEAWAY.winners} pases dobles</strong>
              <span>{GIVEAWAY.winners} ganadores</span>
            </div>
            <div className="sc-meta">
              <span><CalendarDays size={16} aria-hidden="true" /> {EVENT.compactDateLabel}</span>
              <span><MapPin size={16} aria-hidden="true" /> {EVENT.venue}</span>
            </div>

            <GiveawayCountdown remaining={countdown} />

            <div className="sc-hero__footer" ref={heroActionsRef}>
              <button
                type="button"
                className="sc-button sc-button--primary sc-button--block"
                onClick={() => goToForm('hero')}
                disabled={countdown.expired}
              >
                {countdown.expired ? 'Sorteo cerrado' : 'Participar gratis'}
                <ArrowRight size={17} strokeWidth={2.4} aria-hidden="true" />
              </button>
              {!countdown.expired && <small className="sc-hero__trust">Sin compra · Solo nombre y email</small>}
            </div>
          </div>
        </div>
      </section>

      <main className="sc-main">
        <div className="sc-layout">
          <aside className="sc-layout__form" id="participar" ref={formRef} aria-label="Participar en el sorteo">
            <ParticipationCard onParticipated={markParticipated} giveawayEnded={countdown.expired} />
          </aside>

          <div className="sc-layout__content">
            <section className="sc-section" aria-labelledby="sc-concert-title">
              <span className="sc-section__eyebrow">{EVENT.tour}</span>
              <h2 id="sc-concert-title" className="sc-section__title">Información del concierto</h2>
              <dl className="sc-facts">
                <div><dt><CalendarDays size={18} aria-hidden="true" /> Fecha</dt><dd>{EVENT.dateLabel}</dd></div>
                <div><dt><Clock size={18} aria-hidden="true" /> Horario</dt><dd>Puertas {EVENT.doors} · Concierto {EVENT.show} · Fin aprox. {EVENT.end}</dd></div>
                <div>
                  <dt><MapPin size={18} aria-hidden="true" /> Lugar</dt>
                  <dd>
                    {EVENT.venue} · {EVENT.address}
                    <a className="sc-link" href={EVENT.mapsUrl} target="_blank" rel="noreferrer">Ver en el mapa</a>
                  </dd>
                </div>
              </dl>
            </section>

            <section className="sc-section sc-video" id="video" aria-labelledby="sc-video-title">
              <span className="sc-section__eyebrow">Escucha a Santiago</span>
              <h2 id="sc-video-title" className="sc-section__title">“Sigo en Pie”</h2>
              <VideoFacade />
            </section>

            <section className="sc-section sc-conditions" id="condiciones" aria-labelledby="sc-conditions-title">
              <button
                type="button"
                className="sc-conditions__toggle"
                aria-expanded={conditionsOpen}
                aria-controls="sc-conditions-body"
                onClick={() => setConditionsOpen(open => !open)}
              >
                <span>
                  <span className="sc-section__eyebrow">Letra pequeña, en claro</span>
                  <span id="sc-conditions-title" className="sc-section__title">Condiciones del sorteo</span>
                </span>
                <ChevronDown size={22} aria-hidden="true" className="sc-conditions__chevron" />
              </button>
              <div id="sc-conditions-body" hidden={!conditionsOpen}>
                <dl className="sc-terms">
                  {CONDITIONS.map(([term, detail]) => (
                    <div key={term}>
                      <dt>{term}</dt>
                      <dd>{detail}</dd>
                    </div>
                  ))}
                </dl>
                <div className="sc-privacy">
                  <h3>Privacidad</h3>
                  <p>
                    Los datos proporcionados se utilizarán exclusivamente para gestionar la participación y seleccionar y contactar a los ganadores. En caso de resultar ganador, el nombre podrá ser comunicado al organizador del concierto ({EVENT.promoter}) para su inclusión en la lista de invitados.
                  </p>
                  <p>
                    El email no se usará para enviar publicidad salvo que marques la casilla de novedades, que es opcional y no influye en el sorteo. Puedes retirar ese consentimiento cuando quieras escribiendo a info@latido.ch.
                  </p>
                  <p>
                    Los datos específicos del sorteo se eliminarán una vez finalizado el sorteo y transcurrido el plazo necesario para resolver posibles incidencias, como máximo 60 días después del concierto. Más información en la <Link to="/privacidad" className="sc-link">política de privacidad</Link> y el <Link to="/impressum" className="sc-link">Impressum</Link>.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      <div
        className="sc-sticky-cta"
        data-visible={stickyVisible && !participated && !countdown.expired}
        aria-hidden={!stickyVisible || participated || countdown.expired}
      >
        <GiveawayCountdown remaining={countdown} compact />
        <button type="button" className="sc-button sc-button--primary sc-button--block" onClick={() => goToForm('sticky')} tabIndex={stickyVisible && !participated && !countdown.expired ? 0 : -1}>
          <Ticket size={19} aria-hidden="true" />
          Participar gratis
        </button>
      </div>

      <footer className="sc-footer">
        <Link to="/" className="sc-brand" aria-label="Ir a Latido.ch">
          <img src="/favicon.svg" alt="" width="28" height="28" loading="lazy" />
          <span>Latido</span>
        </Link>
        <p>La comunidad hispanohablante en Suiza.</p>
        <nav aria-label="Enlaces legales">
          <Link to="/">Descubre Latido</Link>
          <Link to="/privacidad">Privacidad</Link>
          <Link to="/impressum">Impressum</Link>
        </nav>
        <small>Foto: {EVENT.promoter}. Vídeo: canal oficial de {EVENT.artist} en YouTube.</small>
      </footer>
    </div>
  )
}
