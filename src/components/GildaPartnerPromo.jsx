import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { trackPartnerInteraction } from '../lib/partnerAttribution'
import PartnerCard from './PartnerCard'
import BusinessPartnerContactModal from './BusinessPartnerContactModal'

const GILDA_PARTNER_ID = 'gilda'
const GILDA_LOGO = '/partners/gilda/logo.png'
const GILDA_URL = 'https://www.dematos-luzern.ch/cafeweinbar'
const GILDA_PHONE = '041 211 02 92'
const GILDA_PHONE_HREF = 'tel:+41412110292'
const GILDA_EMAIL = 'info@dematos-luzern.ch'
const GILDA_INSTAGRAM = 'https://www.instagram.com/dematos_luzern/'
const GILDA_MAPS_URL = 'https://www.google.com/maps/search/?api=1&query=Burgerstrasse%205%206003%20Luzern'

const GILDA_TITLE = 'Tapas de autor y wine bar en Lucerna'
const GILDA_DESCRIPTION = 'El nuevo tapas bar de Oscar de Matos reune cocina espanola creativa, vinos y pequenos platos para compartir.'

const GILDA_SERVICES = [
  {
    id:'tapas',
    label:'Tapas',
    href:GILDA_URL,
    color:'#111827',
    tint:'#F8FAFC',
  },
  {
    id:'winebar',
    label:'Winebar',
    href:GILDA_URL,
    color:'#B45309',
    tint:'#FEF3C7',
  },
  {
    id:'lunch',
    label:'Lunch',
    href:GILDA_URL,
    color:'#0F766E',
    tint:'#ECFDF5',
  },
]

const GILDA_PARTNER = {
  id:GILDA_PARTNER_ID,
  name:'GILDA by de Matos',
  logoUrl:GILDA_LOGO,
  title:GILDA_TITLE,
  description:GILDA_DESCRIPTION,
  contactActions:[
    {
      id:'address',
      type:'address',
      icon:'Map',
      label:'Direccion',
      value:'Burgerstrasse 5, 6003 Luzern',
      href:GILDA_MAPS_URL,
      external:true,
    },
    {
      id:'phone',
      type:'phone',
      icon:'Tel',
      label:'Telefono',
      value:GILDA_PHONE,
      href:GILDA_PHONE_HREF,
      external:false,
    },
    {
      id:'email',
      type:'email',
      icon:'@',
      label:'Email',
      value:GILDA_EMAIL,
      href:`mailto:${GILDA_EMAIL}`,
      external:false,
    },
    {
      id:'instagram',
      type:'instagram',
      icon:'IG',
      label:'Instagram',
      value:'@dematos_luzern',
      href:GILDA_INSTAGRAM,
      external:true,
    },
  ],
}

export default function GildaPartnerPromo({
  placement = 'app_home_partners_gilda',
  variant = 'partner-card',
}) {
  const { user, isAdmin } = useAuth()
  const [contactOpen, setContactOpen] = useState(false)

  const trackOutbound = ({ action, service = '', destination = GILDA_URL }) => {
    if (isAdmin) return

    trackPartnerInteraction('partner_outbound_click', {
      userId:user?.id,
      partnerId:GILDA_PARTNER_ID,
      placement,
      action,
      service,
      destination,
    })
  }

  return (
    <>
      <PartnerCard
        id={`gilda-${variant}-${placement}`}
        className={variant === 'public-featured' ? 'public-partner-tile partner-card--gilda' : 'partner-card--gilda'}
        brand={{
          partnerLogo:GILDA_LOGO,
          partnerName:'GILDA by de Matos',
          logoWide:true,
        }}
        title={GILDA_TITLE}
        description={GILDA_DESCRIPTION}
        services={GILDA_SERVICES.map(service => ({
          ...service,
          external:true,
        }))}
        cta={{
          label:'Ver info',
          button:true,
        }}
        accent={['#2563EB', '#1D4ED8']}
        onServiceClick={service => trackOutbound({ action:'service', service:service.id, destination:service.href })}
        onCtaClick={() => {
          setContactOpen(true)
          trackOutbound({ action:'cta', destination:'contact-modal' })
        }}
      />

      <BusinessPartnerContactModal
        open={contactOpen}
        partner={GILDA_PARTNER}
        placement={placement}
        onClose={() => setContactOpen(false)}
        onContactClick={action => trackOutbound({
          action:action.type || action.id,
          destination:action.href,
        })}
      />
    </>
  )
}
