import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, ChevronUp, MapPin, Ticket } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useCountdown } from '../hooks/useCountdown'
import { trackAnalyticsEvent } from '../lib/analytics'
import {
  isGiveawayOpen,
  SANTIAGO_CRUZ_EVENT as EVENT,
  SANTIAGO_CRUZ_GIVEAWAY as GIVEAWAY,
} from '../lib/giveaways'
import './GiveawayHomeBanner.css'

const COLLAPSE_KEY = `latido:giveaway-banner-collapsed:${GIVEAWAY.id}`

function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

function BannerCountdown({ remaining, compact = false }) {
  const units = [
    ['Días', remaining.days],
    ['Hrs', remaining.hours],
    ['Min', remaining.minutes],
    ['Seg', remaining.seconds],
  ]
  const accessibleLabel = `El sorteo cierra en ${remaining.days} días, ${remaining.hours} horas, ${remaining.minutes} minutos y ${remaining.seconds} segundos`

  return (
    <span className={`gw-card__countdown${compact ? ' gw-card__countdown--mini' : ''}`} role="timer" aria-label={accessibleLabel}>
      {units.map(([label, value]) => (
        <span className="gw-card__countdown-unit" key={label}>
          <strong>{String(value).padStart(2, '0')}</strong>
          <small>{label}</small>
        </span>
      ))}
    </span>
  )
}

// Tarjeta del sorteo en Inicio: foto enmarcada, datos clave y una sola acción.
export default function GiveawayHomeBanner() {
  const { user } = useAuth()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const countdown = useCountdown(GIVEAWAY.endsAt)

  if (countdown.expired || !isGiveawayOpen(GIVEAWAY)) return null

  const trackClick = placement => trackAnalyticsEvent('giveaway_cta_click', {
    user_id:user?.id || null,
    metadata:{ giveaway_id:GIVEAWAY.id, placement },
  })

  const collapsePermanently = () => {
    setCollapsed(true)
    try {
      window.localStorage.setItem(COLLAPSE_KEY, '1')
    } catch {
      // Sin almacenamiento, se mantiene contraído durante esta visita.
    }
  }

  const handleExpandedClick = () => {
    collapsePermanently()
    trackClick('home_banner')
  }

  if (collapsed) {
    return (
      <section className="latido-page-container gw-home" aria-label="Evento especial">
        <div className="gw-card gw-card--collapsed">
          <Link
            id="giveaway-home-card-content"
            to={GIVEAWAY.path}
            className="gw-card__collapsed-link"
            onClick={() => trackClick('home_banner_collapsed')}
          >
            <span className="gw-card__collapsed-media">
              <img src={GIVEAWAY.heroImage} alt="" loading="lazy" decoding="async" />
            </span>
            <span className="gw-card__collapsed-body">
              <small>Evento especial</small>
              <strong>{EVENT.artist} en Zürich</strong>
              <span>
                <span><CalendarDays size={13} aria-hidden="true" /> {EVENT.compactDateLabel}</span>
                <span><MapPin size={13} aria-hidden="true" /> {EVENT.venue}</span>
              </span>
              <BannerCountdown remaining={countdown} compact />
              <span className="gw-card__collapsed-cta">
                <Ticket size={14} aria-hidden="true" />
                Gana un pase gratis
                <ArrowRight size={14} strokeWidth={2.4} aria-hidden="true" />
              </span>
            </span>
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="latido-page-container gw-home" aria-label="Evento especial">
      <div className="gw-card">
        <Link
          to={GIVEAWAY.path}
          className="gw-card__link"
          id="giveaway-home-card-content"
          onClick={handleExpandedClick}
        >
          <span className="gw-card__media">
            <img
              className="gw-card__image"
              src={GIVEAWAY.heroImage}
              alt={`${EVENT.artist}, foto oficial de la gira`}
              loading="lazy"
              decoding="async"
            />
            <span className="gw-card__chip">
              <img src="/favicon.svg" alt="" width="18" height="18" />
              Evento especial
            </span>
          </span>

          <span className="gw-card__body">
            <span className="gw-card__title">{EVENT.artist} en Zürich</span>
            <span className="gw-card__prize">
              <Ticket size={15} aria-hidden="true" />
              <span>
                <strong>Gana un pase doble</strong>
                <small>{GIVEAWAY.winners} ganadores</small>
              </span>
            </span>
            <span className="gw-card__meta">
              <span><MapPin size={15} aria-hidden="true" /> {EVENT.venue}</span>
              <span><CalendarDays size={15} aria-hidden="true" /> {EVENT.compactDateLabel}</span>
            </span>

            <BannerCountdown remaining={countdown} />

            <span className="gw-card__footer">
              <span className="gw-card__cta">
                Participar gratis
                <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
              </span>
            </span>
          </span>
        </Link>

        <button
          type="button"
          className="gw-card__toggle"
          onClick={collapsePermanently}
          aria-label="Contraer evento especial"
          aria-expanded="true"
          aria-controls="giveaway-home-card-content"
        >
          <ChevronUp size={17} strokeWidth={2.4} />
        </button>
      </div>
    </section>
  )
}
