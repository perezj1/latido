import { useEffect, useRef, useState } from 'react'
import PartnerServicesPromo from './PartnerServicesPromo'
import BelliniPartnerPromo from './BelliniPartnerPromo'
import MiraPartnerPromo from './MiraPartnerPromo'
import SynaPartnerPromo from './SynaPartnerPromo'
import Virtus360PartnerPromo from './Virtus360PartnerPromo'
import GildaPartnerPromo from './GildaPartnerPromo'
import DynamicBusinessPartnerCard from './DynamicBusinessPartnerCard'
import { fetchActiveBusinessPartners } from '../lib/businessPartners'

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
  const hasSinglePartner = businessPartners.length + HOME_PARTNERS.length === 1

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
  }, [businessPartners.length])

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
            {businessPartners.map(partner => (
              <DynamicBusinessPartnerCard
                key={partner.id}
                partner={partner}
                placement={`${placement}_business_${partner.id}`}
              />
            ))}
            {HOME_PARTNERS.map(partner => partner.render(`${placement}_${partner.id}`))}
          </div>
        </div>
      </div>
    </section>
  )
}
