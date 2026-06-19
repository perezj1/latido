import { useAuth } from '../hooks/useAuth'
import { trackPartnerInteraction } from '../lib/partnerAttribution'
import PartnerCard from './PartnerCard'

const SYNA_PARTNER_ID = 'syna'
const SYNA_LOGO = '/partners/syna/logo.svg'
const SYNA_CONTACT_PATH = '/colaboradores/syna'

const SYNA_SERVICES = [
  {
    id:'trabajo',
    label:'Trabajo',
    color:'#174A96',
    tint:'#EFF6FF',
  },
  {
    id:'derechos',
    label:'Derechos laborales',
    color:'#E30613',
    tint:'#FEF2F2',
  },
  {
    id:'sindicato',
    label:'Sindicato',
    color:'#0F766E',
    tint:'#ECFDF5',
  },
]

export default function SynaPartnerPromo({
  placement = 'app_home_partners_syna',
  variant = 'partner-card',
}) {
  const { user, isAdmin } = useAuth()

  const trackContactIntent = ({ action, service = '' }) => {
    if (isAdmin) return

    trackPartnerInteraction('partner_outbound_click', {
      userId:user?.id,
      partnerId:SYNA_PARTNER_ID,
      placement,
      action,
      service,
      destination:SYNA_CONTACT_PATH,
    })
  }

  return (
    <PartnerCard
      id={`syna-${variant}-${placement}`}
      className={variant === 'public-featured' ? 'public-partner-tile partner-card--syna' : 'partner-card--syna'}
      brand={{
        partnerLogo:SYNA_LOGO,
        partnerName:'Syna',
        logoWide:true,
      }}
      title="Asesoramiento laboral y derechos en Suiza"
      description="Syna Luzern acompaña a trabajadores en temas laborales, contratos, salarios y derechos, con atención cercana en Suiza."
      services={SYNA_SERVICES.map(service => ({
        ...service,
        href:SYNA_CONTACT_PATH,
        external:false,
      }))}
      cta={{
        href:SYNA_CONTACT_PATH,
        label:'Contactar',
        external:false,
      }}
      accent={['#174A96', '#E30613']}
      onServiceClick={service => trackContactIntent({ action:'service', service:service.id })}
      onCtaClick={() => trackContactIntent({ action:'cta' })}
    />
  )
}
