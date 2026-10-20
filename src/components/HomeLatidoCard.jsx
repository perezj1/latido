import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import useCardCatalog from '../hooks/useCardCatalog'
import { useTimedRotationBucket } from '../hooks/useTimedRotationBucket'
import { cardRpc } from '../lib/latidoCard'
import { selectFeaturedCardOffer } from '../lib/latidoCardFeatured'
import { DiscountBusinessPhoto } from './LatidoDiscountCard'
import { OfferBenefitBadge } from './LatidoOfferVisual'
import HorizontalDragScroller from './HorizontalDragScroller'
import './HomeLatidoCard.css'

export default function HomeLatidoCard({ businesses = [] }) {
  const { user, loading, userCanton } = useAuth()
  const [data, setData] = useState(null)
  const catalog = useCardCatalog()
  const minute = useTimedRotationBucket(60_000)
  const featured = useMemo(() => selectFeaturedCardOffer(catalog, {
    canton: userCanton, businesses, now: minute * 60_000
  }), [catalog, userCanton, businesses, minute])
  const scroller = useRef(null)
  const [position, setPosition] = useState(null)
  const summaryId = useId()
  const carouselId = useId()
  useEffect(() => {
    if (loading || !user?.id) return
    let live = true
    let sequence = 0
    const userId = user.id
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return
      const current = ++sequence
      try {
        const result = await cardRpc('lc_member_home')
        if (live && current === sequence) setData({ userId, member: result?.membership || null })
      } catch {
        // The entry point remains usable even when membership cannot be loaded.
      }
    }
    refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      live = false
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [user?.id, loading])

  const member = user && data?.userId === user.id ? data.member : null
  const until = Date.parse(member?.valid_until)
  const active = Boolean(member?.active) && Number.isFinite(until) && until > Date.now()
  const order = featured ? (active ? 'offer-card' : 'card-offer') : 'card'
  const selected = position?.order === order ? position.index : 0
  // Reset only when the order changes, so catalog refreshes preserve a swipe.
  useEffect(() => {
    scroller.current?.scrollTo({ left: 0, behavior: 'instant' })
  }, [order])
  const membership = (
    <Link
      className="home-latido-card"
      to="/card"
      aria-label={member ? 'Ver Tarjeta Latido' : 'Conseguir Tarjeta Latido'}
      aria-describedby={summaryId}
    >
      <img className="home-latido-card-watermark" src="/favicon.svg" alt="" aria-hidden="true" />
      <span className="home-latido-card-logo" aria-hidden="true">
        <img src="/favicon.svg" alt="" />
      </span>
      <span className="home-latido-card-info" id={summaryId}>
        {member?.member_number != null ? (
          <>
            <span className="home-latido-card-label">Socio nº</span>
            <strong className="home-latido-card-number">
              {String(member.member_number).padStart(4, '0')}
            </strong>
          </>
        ) : (
          <strong className="home-latido-card-name">Tarjeta Latido</strong>
        )}
        <span>
          {active ? (
            `Válida hasta ${new Date(until).toLocaleDateString('es-CH', { timeZone: 'Europe/Zurich' })}`
          ) : member ? (
            'Membresía inactiva'
          ) : (
            <>
              Descuentos en negocios
              <br />
              de tu comunidad
            </>
          )}
        </span>
      </span>
      <span className="home-latido-card-actions">
        {member && (
          <span className="home-latido-card-status" data-active={active}>
            <span aria-hidden="true" />
            {active ? 'Activa' : 'Inactiva'}
          </span>
        )}
        <span className="home-latido-card-action">{member ? 'Ver tarjeta' : 'Conseguir'}</span>
      </span>
      <span className="home-latido-card-stripe" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </span>
    </Link>
  )
  if (!featured) return membership

  const featuredCard = (
    <Link
      className="home-latido-card home-latido-featured"
      to={`/card/negocio/${featured.provider_id}?oferta=${featured.id}`}
      aria-label={`Ver oferta: ${featured.title}, ${featured.business_name}`}
    >
      <OfferBenefitBadge offer={featured} />
      <span className="home-latido-featured-info">
        <strong className="home-latido-featured-title">{featured.title}</strong>
        <span className="home-latido-featured-business">
          <DiscountBusinessPhoto offer={featured} avatar />
          <span><b>{featured.business_name}</b>{featured.city && <span className="home-latido-featured-city"> · {featured.city}</span>}</span>
        </span>
      </span>
      <ArrowRight className="home-latido-featured-arrow" size={14} aria-hidden="true" />
      <span className="home-latido-card-stripe" aria-hidden="true">
        <span /><span /><span /><span /><span /><span />
      </span>
    </Link>
  )
  const slides = active
    ? [{ id: 'offer', label: 'Oferta destacada', content: featuredCard }, { id: 'card', label: 'Mi Tarjeta Latido', content: membership }]
    : [{ id: 'card', label: member ? 'Mi Tarjeta Latido' : 'Conseguir Tarjeta Latido', content: membership }, { id: 'offer', label: 'Oferta destacada', content: featuredCard }]
  const goTo = (index) => {
    const track = scroller.current
    if (!track) return
    const slide = track.children[index]
    track.scrollTo({ left: slide.offsetLeft - track.children[0].offsetLeft,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }
  return (
    <section className="home-latido-carousel" aria-label="Ofertas y Tarjeta Latido" aria-roledescription="carrusel">
      <HorizontalDragScroller
        ref={scroller}
        id={carouselId}
        className="home-latido-carousel-track"
        label="Oferta destacada y tarjeta de socio"
        onScroll={(event) => {
          const track = event.currentTarget
          const distance = track.children[1].offsetLeft - track.children[0].offsetLeft
          setPosition({ order, index: track.scrollLeft > distance / 2 ? 1 : 0 })
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return
          const index = event.key === 'ArrowRight' || event.key === 'End' ? 1
            : event.key === 'ArrowLeft' || event.key === 'Home' ? 0 : null
          if (index !== null) { event.preventDefault(); goTo(index) }
        }}
      >
        {slides.map((slide, index) => (
          <div key={slide.id} className="home-latido-carousel-slide" role="group"
            aria-roledescription="diapositiva" aria-label={`${index + 1} de 2: ${slide.label}`}>
            {slide.content}
            {slide.id === 'offer' && (
              <span className="home-latido-featured-pill">
                <Sparkles size={11} aria-hidden="true" />
                Oferta del día
              </span>
            )}
          </div>
        ))}
      </HorizontalDragScroller>
      <div className="home-latido-carousel-dots" aria-label="Elegir tarjeta">
        {slides.map((slide, index) => (
          <button key={slide.id} type="button" aria-label={`Mostrar ${slide.label}`}
            aria-controls={carouselId} aria-current={selected === index ? 'true' : undefined}
            onClick={() => goTo(index)}><span /></button>
        ))}
      </div>
    </section>
  )
}
