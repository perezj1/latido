import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, Check, ChevronUp, Info, MapPin, Ticket, X } from 'lucide-react'
import GiveawayParticipationCard from './GiveawayParticipationCard'
import { useAuth } from '../hooks/useAuth'
import { useCountdown } from '../hooks/useCountdown'
import { trackAnalyticsEvent } from '../lib/analytics'
import { supabase } from '../lib/supabase'
import {
  isGiveawayOpen,
  SANTIAGO_CRUZ_EVENT as EVENT,
  SANTIAGO_CRUZ_GIVEAWAY as GIVEAWAY,
} from '../lib/giveaways'
import './GiveawayHomeBanner.css'

const COLLAPSE_KEY = `latido:giveaway-banner-collapsed:${GIVEAWAY.id}`
const PARTICIPATION_EVENT = `latido:giveaway-participated:${GIVEAWAY.id}`

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

function ParticipationModal({ open, onClose, onParticipated, source }) {
  const closeRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = event => {
      if (event.key === 'Escape') onClose()
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)
    window.requestAnimationFrame(() => closeRef.current?.focus())
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="gw-modal gw-participation-theme" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <div className="gw-modal__panel" role="dialog" aria-modal="true" aria-labelledby="gw-modal-title">
        <h2 id="gw-modal-title" className="gw-modal__title">Participar en el sorteo</h2>
        <button ref={closeRef} type="button" className="gw-modal__close" onClick={onClose} aria-label="Cerrar formulario">
          <X size={20} aria-hidden="true" />
        </button>
        <GiveawayParticipationCard source={source} onParticipated={onParticipated} />
      </div>
    </div>
  )
}

// Tarjeta del sorteo compartida por Inicio y la landing pública.
export default function GiveawayHomeBanner({
  analyticsPlacement = 'home_banner',
  collapsible = true,
  participationModal = false,
  promotionalModal = false,
  instanceId = analyticsPlacement,
}) {
  const { user } = useAuth()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [modalOpen, setModalOpen] = useState(false)
  const [promotionOpen, setPromotionOpen] = useState(true)
  const [participating, setParticipating] = useState(false)
  const promotionCloseRef = useRef(null)
  const countdown = useCountdown(GIVEAWAY.endsAt)
  const giveawayVisible = !countdown.expired && isGiveawayOpen(GIVEAWAY)
  const contentId = `giveaway-${instanceId}-content`
  const closeParticipation = useCallback(() => setModalOpen(false), [])
  const closePromotion = useCallback(() => setPromotionOpen(false), [])
  const markParticipating = useCallback(() => {
    setParticipating(true)
    window.dispatchEvent(new CustomEvent(PARTICIPATION_EVENT))
  }, [])

  useEffect(() => {
    const syncParticipation = () => setParticipating(true)
    window.addEventListener(PARTICIPATION_EVENT, syncParticipation)
    return () => window.removeEventListener(PARTICIPATION_EVENT, syncParticipation)
  }, [])

  useEffect(() => {
    if (!user?.id) {
      setParticipating(false)
      return undefined
    }

    let cancelled = false
    setParticipating(false)
    supabase.rpc('get_my_giveaway_entry', { p_giveaway_id:GIVEAWAY.id }).then(({ data }) => {
      if (!cancelled && data?.status === 'already') setParticipating(true)
    })
    return () => { cancelled = true }
  }, [user?.id])

  useEffect(() => {
    if (!giveawayVisible || !promotionalModal || !promotionOpen) return undefined
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = event => {
      if (event.key === 'Escape') closePromotion()
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)
    window.requestAnimationFrame(() => promotionCloseRef.current?.focus())
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [closePromotion, giveawayVisible, promotionalModal, promotionOpen])

  if (!giveawayVisible) return null

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
    if (collapsible) collapsePermanently()
    trackClick(analyticsPlacement)
  }

  const openParticipation = () => {
    trackClick(`${analyticsPlacement}_participate`)
    if (promotionalModal) setPromotionOpen(false)
    setModalOpen(true)
  }

  if (collapsible && collapsed) {
    return (
      <section className="latido-page-container gw-home" aria-label="Evento especial">
        <div className="gw-card gw-card--collapsed">
          <Link
            id={contentId}
            to={GIVEAWAY.path}
            className="gw-card__collapsed-link"
            onClick={() => trackClick(`${analyticsPlacement}_collapsed`)}
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
                {participating ? <Check size={14} strokeWidth={2.6} aria-hidden="true" /> : <Ticket size={14} aria-hidden="true" />}
                {participating ? 'Participando' : 'Gana entradas gratis'}
                {!participating && <ArrowRight size={14} strokeWidth={2.4} aria-hidden="true" />}
              </span>
            </span>
          </Link>
        </div>
      </section>
    )
  }

  const expandedContent = (
    <>
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

            {participationModal ? (
              <span className="gw-card__footer gw-card__footer--split">
                <Link
                  to={GIVEAWAY.path}
                  className="gw-card__more"
                  onClick={() => trackClick(`${analyticsPlacement}_more_info`)}
                >
                  <Info size={16} aria-hidden="true" />
                  Más información
                </Link>
                <button type="button" className="gw-card__cta" onClick={openParticipation}>
                  {participating ? <Check size={16} strokeWidth={2.6} aria-hidden="true" /> : <Ticket size={16} aria-hidden="true" />}
                  {participating ? 'Participando' : 'Participar gratis'}
                </button>
              </span>
            ) : (
              <span className="gw-card__footer">
                <span className="gw-card__cta">
                  {participating ? <Check size={16} strokeWidth={2.6} aria-hidden="true" /> : null}
                  {participating ? 'Participando' : 'Participar gratis'}
                  {!participating && <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />}
                </span>
              </span>
            )}
          </span>
    </>
  )

  const card = (
    <div className="gw-card">
        {participationModal ? (
          <div className="gw-card__link" id={contentId}>
            {expandedContent}
          </div>
        ) : (
          <Link
            to={GIVEAWAY.path}
            className="gw-card__link"
            id={contentId}
            onClick={handleExpandedClick}
          >
            {expandedContent}
          </Link>
        )}

        {collapsible && (
          <button
            type="button"
            className="gw-card__toggle"
            onClick={collapsePermanently}
            aria-label="Contraer evento especial"
            aria-expanded="true"
            aria-controls={contentId}
          >
            <ChevronUp size={17} strokeWidth={2.4} />
          </button>
        )}
    </div>
  )

  if (promotionalModal) {
    return (
      <>
        {promotionOpen && (
          <div className="gw-promo-modal" role="presentation" onMouseDown={event => {
            if (event.target === event.currentTarget) closePromotion()
          }}>
            <div className="gw-promo-modal__panel" role="dialog" aria-modal="true" aria-label="Evento especial: sorteo de Santiago Cruz">
              <button ref={promotionCloseRef} type="button" className="gw-promo-modal__close" onClick={closePromotion} aria-label="Cerrar evento especial">
                <X size={18} aria-hidden="true" />
              </button>
              <section className="latido-page-container gw-home" aria-label="Evento especial">
                {card}
              </section>
            </div>
          </div>
        )}
        <ParticipationModal open={modalOpen} onClose={closeParticipation} onParticipated={markParticipating} source={`${analyticsPlacement}_modal`} />
      </>
    )
  }

  return (
    <section className="latido-page-container gw-home" aria-label="Evento especial">
      {card}
      <ParticipationModal open={modalOpen} onClose={closeParticipation} onParticipated={markParticipating} source={`${analyticsPlacement}_modal`} />
    </section>
  )
}
