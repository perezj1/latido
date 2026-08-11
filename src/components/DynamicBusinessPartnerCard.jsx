import { useEffect, useState } from 'react'
import PartnerCard from './PartnerCard'
import BusinessPartnerContactModal from './BusinessPartnerContactModal'
import { useAuth } from '../hooks/useAuth'
import { trackPartnerInteraction } from '../lib/partnerAttribution'
import { getBusinessPartnerCardServiceLabel, hasBusinessPartnerBareLogo } from '../lib/businessPartnerOverrides'

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
  const { user, isAdmin } = useAuth()
  const [contactOpen, setContactOpen] = useState(false)

  useEffect(() => {
    if (!partner?.analyticsId || isAdmin) return undefined

    trackPartnerInteraction('partner_card_impression', {
      userId:user?.id,
      partnerId:partner.analyticsId,
      placement,
      action:'impression',
    })
  }, [isAdmin, partner?.analyticsId, placement, user?.id])

  if (!partner) return null

  const visibleServices = partner.services.slice(0, 3).map(service => ({
    label:getBusinessPartnerCardServiceLabel(partner.id, service),
    originalLabel:service,
    href:partner.destination.href,
    external:partner.destination.external,
  }))

  const services = visibleServices.map((service, index) => {
    const [color, tint] = SERVICE_COLORS[index % SERVICE_COLORS.length]
    return {
      id:`${partner.id}-${service.originalLabel}`,
      label:service.label,
      originalLabel:service.originalLabel,
      href:service.href,
      external:service.external || /^(tel|mailto):/i.test(service.href || ''),
      color,
      tint,
    }
  })

  const trackContactClick = action => {
    if (isAdmin) return
    trackPartnerInteraction('partner_outbound_click', {
      userId:user?.id,
      partnerId:partner.analyticsId,
      placement,
      action:action.type || action.id,
      destination:action.href,
    })
  }

  const className = variant === 'public-featured'
    ? `public-partner-tile partner-card--business partner-card--business-${partner.planKey}`
    : `partner-card--business partner-card--business-${partner.planKey}`
  const hasDirectCta = partner.destination?.direct === true

  const handleCtaClick = () => {
    if (!hasDirectCta) {
      setContactOpen(true)
      return
    }
    if (isAdmin) return

    trackPartnerInteraction('partner_outbound_click', {
      userId:user?.id,
      partnerId:partner.analyticsId,
      placement,
      action:'contact',
      destination:partner.destination.href,
    })
  }

  return (
    <>
      <PartnerCard
        id={`business-${partner.id}`}
        className={className}
        brand={{
          partnerName:partner.name,
          partnerLogo:partner.logoUrl,
          logoBare:hasBusinessPartnerBareLogo(partner.id),
        }}
        title={partner.title}
        description={partner.description}
        services={services}
        cta={hasDirectCta
          ? {
            label:'Contactar',
            href:partner.destination.href,
            external:partner.destination.external,
          }
          : {
            label:'Contactar',
            button:true,
          }}
        accent={partner.accent}
        onServiceClick={service => {
          if (isAdmin) return
          trackPartnerInteraction('partner_service_click', {
            userId:user?.id,
            partnerId:partner.analyticsId,
            placement,
            action:'service',
            service:service.originalLabel,
            destination:service.href,
          })
        }}
        onCtaClick={handleCtaClick}
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
