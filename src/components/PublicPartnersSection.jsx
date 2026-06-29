import { useEffect, useRef, useState } from 'react'
import PartnerServicesPromo from './PartnerServicesPromo'
import BelliniPartnerPromo from './BelliniPartnerPromo'
import MiraPartnerPromo from './MiraPartnerPromo'
import SynaPartnerPromo from './SynaPartnerPromo'
import Virtus360PartnerPromo from './Virtus360PartnerPromo'
import DynamicBusinessPartnerCard from './DynamicBusinessPartnerCard'
import { fetchActiveBusinessPartners } from '../lib/businessPartners'

const PUBLIC_PARTNERS = [
  {
    id:'virtus360',
    render:placement => <Virtus360PartnerPromo key="virtus360" placement={placement} variant="public-featured" />,
  },
  {
    id:'suiza-en-espanol',
    render:placement => (
      <PartnerServicesPromo
        key="suiza-en-espanol"
        placement={placement}
        variant="public-featured"
      />
    ),
  },
  {
    id:'syna',
    render:placement => <SynaPartnerPromo key="syna" placement={placement} variant="public-featured" />,
  },
  {
    id:'bellini',
    render:placement => <BelliniPartnerPromo key="bellini" placement={placement} variant="public-featured" />,
  },
  {
    id:'mira',
    render:placement => <MiraPartnerPromo key="mira" placement={placement} variant="public-featured" />,
  },
]

export default function PublicPartnersSection({ placement = 'public_landing' }) {
  const [businessPartners, setBusinessPartners] = useState([])
  const [activePartnerIndex, setActivePartnerIndex] = useState(0)
  const scrollRef = useRef(null)
  const totalPartners = businessPartners.length + PUBLIC_PARTNERS.length
  const hasSinglePartner = totalPartners === 1

  const scrollPartners = direction => {
    const scroller = scrollRef.current
    if (!scroller) return

    scroller.scrollBy({
      left: direction * Math.max(scroller.clientWidth * 0.82, 320),
      behavior: 'smooth',
    })
  }

  const scrollToPartner = index => {
    const scroller = scrollRef.current
    const track = scroller?.querySelector('.public-partners-track')
    const target = track?.children?.[index]
    if (!target) return

    target.scrollIntoView({
      behavior:'smooth',
      block:'nearest',
      inline:'center',
    })
    setActivePartnerIndex(index)
  }

  useEffect(() => {
    let cancelled = false

    fetchActiveBusinessPartners({ plans:['premium'], limit:6 })
      .then(partners => {
        if (!cancelled) setBusinessPartners(partners)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollLeft = 0
    setActivePartnerIndex(0)
  }, [businessPartners.length])

  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller || hasSinglePartner) return undefined

    let frame = 0
    const updateActiveDot = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const track = scroller.querySelector('.public-partners-track')
        const cards = Array.from(track?.children || [])
        if (!cards.length) return

        const viewportCenter = scroller.scrollLeft + scroller.clientWidth / 2
        let closestIndex = 0
        let closestDistance = Number.POSITIVE_INFINITY

        cards.forEach((card, index) => {
          const cardCenter = card.offsetLeft + card.offsetWidth / 2
          const distance = Math.abs(cardCenter - viewportCenter)
          if (distance < closestDistance) {
            closestDistance = distance
            closestIndex = index
          }
        })

        setActivePartnerIndex(closestIndex)
      })
    }

    updateActiveDot()
    scroller.addEventListener('scroll', updateActiveDot, { passive:true })
    window.addEventListener('resize', updateActiveDot)

    return () => {
      window.cancelAnimationFrame(frame)
      scroller.removeEventListener('scroll', updateActiveDot)
      window.removeEventListener('resize', updateActiveDot)
    }
  }, [hasSinglePartner, totalPartners])

  return (
    <section className="public-partner-section" aria-labelledby="public-partners-title">
      <div className="public-partner-vip-star" aria-hidden="true">⭐</div>
      <div className="public-partner-heading">
        <div className="public-partner-heading-title">
          <span>Colaboradores seleccionados</span>
          <h2 id="public-partners-title">Más apoyo para vivir en Suiza con confianza</h2>
        </div>
        <div className="public-partner-heading-copy">
          <p>
            Colaboramos con equipos especializados que entienden las necesidades
            de la comunidad hispanohablante.
          </p>
        </div>
      </div>

      <div
        ref={scrollRef}
        className={`public-partners-scroll no-scroll${hasSinglePartner ? ' public-partners-scroll--single' : ''}`}
        aria-label="Colaboradores de Latido"
      >
        <div className="public-partners-track">
          {businessPartners.map(partner => (
            <DynamicBusinessPartnerCard
              key={partner.id}
              partner={partner}
              placement={`${placement}_business_${partner.id}`}
              variant="public-featured"
            />
          ))}
          {PUBLIC_PARTNERS.map(partner => partner.render(`${placement}_${partner.id}`))}
        </div>
      </div>

      {!hasSinglePartner && (
        <div className="public-partners-dots" aria-label="Navegación de colaboradores">
          {Array.from({ length:totalPartners }).map((_, index) => (
            <button
              key={index}
              type="button"
              className={`public-partners-dot${activePartnerIndex === index ? ' public-partners-dot--active' : ''}`}
              aria-label={`Ver colaborador ${index + 1} de ${totalPartners}`}
              aria-current={activePartnerIndex === index ? 'true' : undefined}
              onClick={() => scrollToPartner(index)}
            />
          ))}
        </div>
      )}

      {!hasSinglePartner && (
        <>
          <button
            type="button"
            className="public-partners-arrow public-partners-arrow--prev"
            onClick={() => scrollPartners(-1)}
            aria-label="Ver colaboradores anteriores"
          >
            ‹
          </button>
          <button
            type="button"
            className="public-partners-arrow public-partners-arrow--next"
            onClick={() => scrollPartners(1)}
            aria-label="Ver más colaboradores"
          >
            ›
          </button>
        </>
      )}
    </section>
  )
}
