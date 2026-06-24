import { useEffect, useState } from 'react'
import PartnerCard from './PartnerCard'
import BusinessPartnerContactModal from './BusinessPartnerContactModal'
import { trackPartnerInteraction } from '../lib/partnerAttribution'

const SERVICE_COLORS = [
  ['#2563EB', '#EFF6FF'],
  ['#0F766E', '#ECFDF5'],
  ['#7C3AED', '#F3E8FF'],
  ['#EF3340', '#FFF1F2'],
]

export default function DynamicBusinessPartnerCard({
  partner,
  placement,
  variant = 'partner-card',
}) {
  const [contactOpen, setContactOpen] = useState(false)

  useEffect(() => {
    if (!partner?.analyticsId) return undefined

    trackPartnerInteraction('partner_card_impression', {
      partnerId:partner.analyticsId,
      placement,
      action:'impression',
    })
  }, [partner?.analyticsId, placement])

  if (!partner) return null

  const visibleServices = partner.services.slice(0, 3).map(service => ({
    label:service,
    href:partner.destination.href,
    external:partner.destination.external,
  }))

  const services = visibleServices.map((service, index) => {
    const [color, tint] = SERVICE_COLORS[index % SERVICE_COLORS.length]
    return {
      id:`${partner.id}-${service.label}`,
      label:service.label,
      href:service.href,
      external:service.external || /^(tel|mailto):/i.test(service.href || ''),
      color,
      tint,
    }
  })

  const trackContactClick = action => {
    trackPartnerInteraction('partner_outbound_click', {
      partnerId:partner.analyticsId,
      placement,
      action:action.type || action.id,
      destination:action.href,
    })
  }

  const className = variant === 'public-featured'
    ? `public-partner-tile partner-card--business partner-card--business-${partner.planKey}`
    : `partner-card--business partner-card--business-${partner.planKey}`

  return (
    <>
      <PartnerCard
        id={`business-${partner.id}`}
        className={className}
        brand={{
          partnerName:partner.name,
          partnerLogo:partner.logoUrl,
        }}
        title={partner.title}
        description={partner.description}
        services={services}
        cta={{
          label:'Contactar',
          button:true,
        }}
        accent={partner.accent}
        onServiceClick={service => {
          trackPartnerInteraction('partner_service_click', {
            partnerId:partner.analyticsId,
            placement,
            action:'service',
            service:service.label,
            destination:service.href,
          })
        }}
        onCtaClick={() => setContactOpen(true)}
      />

      <BusinessPartnerContactModal
        open={contactOpen}
        partner={partner}
        placement={placement}
        onClose={() => setContactOpen(false)}
        onContactClick={trackContactClick}
      />
    </>
  )
}
