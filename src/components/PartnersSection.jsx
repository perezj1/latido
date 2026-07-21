import { useEffect, useMemo, useRef, useState } from 'react'
import PartnerServicesPromo from './PartnerServicesPromo'
import BelliniPartnerPromo from './BelliniPartnerPromo'
import MiraPartnerPromo from './MiraPartnerPromo'
import SynaPartnerPromo from './SynaPartnerPromo'
import Virtus360PartnerPromo from './Virtus360PartnerPromo'
import GildaPartnerPromo from './GildaPartnerPromo'
import DynamicBusinessPartnerCard from './DynamicBusinessPartnerCard'
import { fetchActiveBusinessPartners } from '../lib/businessPartners'
import { BUSINESS_ROTATION_INTERVAL_MS } from '../lib/businessPromotion'
import { rotateItems } from '../lib/rotation'
import { useTimedRotationBucket } from '../hooks/useTimedRotationBucket'

const HOME_PARTNERS = [
  {
    id:'virtus360',
    render:placement => <Virtus360PartnerPromo key="virtus360" placement={placement} variant="partner-card" />,
  },
  {
    id:'suiza-en-espanol',
    render:placement => (
      <PartnerServicesPromo
        key="suiza-en-espanol"
        placement={placement}
        variant="partner-card"
      />
    ),
  },
  {
    id:'syna',
    render:placement => <SynaPartnerPromo key="syna" placement={placement} variant="partner-card" />,
  },
  {
    id:'bellini',
    render:placement => <BelliniPartnerPromo key="bellini" placement={placement} variant="partner-card" />,
  },
  {
    id:'gilda',
    render:placement => <GildaPartnerPromo key="gilda" placement={placement} variant="partner-card" />,
  },
  {
    id:'mira',
    render:placement => <MiraPartnerPromo key="mira" placement={placement} variant="partner-card" />,
  },
]

export default function PartnersSection({ placement = 'app_home_partners' }) {
  const [businessPartners, setBusinessPartners] = useState([])
  const scrollRef = useRef(null)
  const rotationOffset = useTimedRotationBucket(BUSINESS_ROTATION_INTERVAL_MS)
  const partnerCards = useMemo(() => {
    const dynamicCards = businessPartners.map(partner => ({
      id:`business:${partner.id}`,
      type:'business',
      planKey:partner.planKey,
      partner,
    }))
    const editorialCards = HOME_PARTNERS.map(partner => ({
      id:`editorial:${partner.id}`,
      type:'editorial',
      planKey:'premium',
      partner,
    }))
    const premiumCards = [
      ...dynamicCards.filter(card => card.planKey === 'premium'),
      ...editorialCards,
    ]
    const basicCards = dynamicCards.filter(card => card.planKey !== 'premium')

    return [
      ...rotateItems(premiumCards, rotationOffset),
      ...rotateItems(basicCards, rotationOffset),
    ]
  }, [businessPartners, rotationOffset])
  const hasSinglePartner = partnerCards.length === 1

  useEffect(() => {
    let cancelled = false

    fetchActiveBusinessPartners({ plans:['premium', 'basic'], limit:8 })
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
  }, [businessPartners.length, rotationOffset])

  return (
    <section className="home-partners-section" aria-labelledby="home-partners-title">
      <div className="home-partners-heading">
        <div>
          <h2 id="home-partners-title">🚀 Colaboradores</h2>
          <p>Equipos especializados para ayudarte en Suiza.</p>
        </div>
      </div>

      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <div ref={scrollRef} className={`home-partners-scroll no-scroll${hasSinglePartner ? ' home-partners-scroll--single' : ''}`}>
          <div className="home-partners-track">
            {partnerCards.map(card => (
              card.type === 'business' ? (
                <DynamicBusinessPartnerCard
                  key={card.id}
                  partner={card.partner}
                  placement={`${placement}_business_${card.partner.id}`}
                />
              ) : card.partner.render(`${placement}_${card.partner.id}`)
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
