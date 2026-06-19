import { useAuth } from '../hooks/useAuth'
import { trackPartnerInteraction } from '../lib/partnerAttribution'
import PartnerCard from './PartnerCard'

const BELLINI_PARTNER_ID = 'bellini'
const BELLINI_LOGO = '/partners/bellini/logo-wide.svg'
const BELLINI_CONTACT_PATH = '/colaboradores/bellini'

const BELLINI_SERVICES = [
  {
    id:'empleo',
    label:'Empleo',
    color:'#E30613',
    tint:'#FEF2F2',
  },
  {
    id:'construccion',
    label:'Construcción',
    color:'#111827',
    tint:'#F8FAFC',
  },
  {
    id:'asesoramiento',
    label:'Asesoramiento',
    color:'#2563EB',
    tint:'#EFF6FF',
  },
]

export default function BelliniPartnerPromo({
  placement = 'app_home_partners_bellini',
  variant = 'partner-card',
}) {
  const { user, isAdmin } = useAuth()

  const trackContactIntent = ({ action, service = '' }) => {
    if (isAdmin) return

    trackPartnerInteraction('partner_outbound_click', {
      userId:user?.id,
      partnerId:BELLINI_PARTNER_ID,
      placement,
      action,
      service,
      destination:BELLINI_CONTACT_PATH,
    })
  }

  return (
    <PartnerCard
      id={`bellini-${variant}-${placement}`}
      className={variant === 'public-featured' ? 'public-partner-tile partner-card--bellini' : 'partner-card--bellini'}
      brand={{
        partnerLogo:BELLINI_LOGO,
        partnerName:'Bellini',
        logoWide:true,
      }}
      title="Empleo temporal en la construcción"
      description="Bellini conecta personas con oportunidades en el sector de la construcción en Suiza, con acompañamiento personal y justo."
      services={BELLINI_SERVICES.map(service => ({
        ...service,
        href:BELLINI_CONTACT_PATH,
        external:false,
      }))}
      cta={{
        href:BELLINI_CONTACT_PATH,
        label:'Contactar',
        external:false,
      }}
      accent={['#2563EB', '#1D4ED8']}
      onServiceClick={service => trackContactIntent({ action:'service', service:service.id })}
      onCtaClick={() => trackContactIntent({ action:'cta' })}
    />
  )
}
