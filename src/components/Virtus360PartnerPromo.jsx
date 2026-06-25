import { useAuth } from '../hooks/useAuth'
import { trackPartnerInteraction } from '../lib/partnerAttribution'
import PartnerCard from './PartnerCard'

const VIRTUS360_PARTNER_ID = 'virtus360'
const VIRTUS360_LOGO = '/partners/virtus360/logo.svg'
const VIRTUS360_CONTACT_URL = 'https://www.360-virtus.ch/kontakt.html'

const VIRTUS360_SERVICES = [
  {
    id:'gestoria',
    label:'Gestor\u00eda',
    href:VIRTUS360_CONTACT_URL,
    color:'#E64661',
    tint:'#FFF1F4',
  },
  {
    id:'finanzas',
    label:'Finanzas',
    href:VIRTUS360_CONTACT_URL,
    color:'#2563EB',
    tint:'#EFF6FF',
  },
  {
    id:'seguros',
    label:'Seguros',
    href:VIRTUS360_CONTACT_URL,
    color:'#0F766E',
    tint:'#ECFDF5',
  },
]

export default function Virtus360PartnerPromo({
  placement = 'app_home_partners_virtus360',
  variant = 'partner-card',
}) {
  const { user, isAdmin } = useAuth()

  const trackOutbound = ({ action, service = '', destination = VIRTUS360_CONTACT_URL }) => {
    if (isAdmin) return

    trackPartnerInteraction('partner_outbound_click', {
      userId:user?.id,
      partnerId:VIRTUS360_PARTNER_ID,
      placement,
      action,
      service,
      destination,
    })
  }

  return (
    <PartnerCard
      id={`virtus360-${variant}-${placement}`}
      className={variant === 'public-featured' ? 'public-partner-tile partner-card--virtus360' : 'partner-card--virtus360'}
      brand={{
        partnerLogo:VIRTUS360_LOGO,
        partnerName:'Virtus360',
        logoWide:true,
      }}
      title={'Gestor\u00eda y finanzas para vivir en Suiza'}
      description={'Apoyo personal para tr\u00e1mites, impuestos, seguros y burocracia diaria, con atenci\u00f3n multicultural desde Horgen.'}
      services={VIRTUS360_SERVICES.map(service => ({
        ...service,
        external:true,
      }))}
      cta={{
        href:VIRTUS360_CONTACT_URL,
        label:'Contactar',
        external:true,
      }}
      accent={['#2563EB', '#1D4ED8']}
      onServiceClick={service => trackOutbound({ action:'service', service:service.id, destination:service.href })}
      onCtaClick={() => trackOutbound({ action:'cta' })}
    />
  )
}
