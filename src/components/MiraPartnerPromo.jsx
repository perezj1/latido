import { useAuth } from '../hooks/useAuth'
import { trackPartnerInteraction } from '../lib/partnerAttribution'
import PartnerCard from './PartnerCard'

const MIRA_PARTNER_ID = 'mira'
const MIRA_LOGO = '/partners/mira/mira-removebg-preview.png'
const MIRA_CONTACT_PATH = '/colaboradores/mira'

const MIRA_SERVICES = [
  {
    id:'informacion',
    label:'Información',
    color:'#2563EB',
    tint:'#EFF6FF',
  },
  {
    id:'asesoramiento',
    label:'Asesoramiento',
    color:'#BE3455',
    tint:'#FFF1F4',
  },
  {
    id:'intercambio',
    label:'Intercambio',
    color:'#0F766E',
    tint:'#ECFDF5',
  },
]

export default function MiraPartnerPromo({
  placement = 'app_home_partners_mira',
  variant = 'partner-card',
}) {
  const { user, isAdmin } = useAuth()

  const trackContactIntent = ({ action, service = '' }) => {
    if (isAdmin) return

    trackPartnerInteraction('partner_outbound_click', {
      userId:user?.id,
      partnerId:MIRA_PARTNER_ID,
      placement,
      action,
      service,
      destination:MIRA_CONTACT_PATH,
    })
  }

  return (
    <PartnerCard
      id={`mira-${variant}-${placement}`}
      className={variant === 'public-featured' ? 'public-partner-tile partner-card--mira' : 'partner-card--mira'}
      brand={{
        partnerLogo:MIRA_LOGO,
        partnerName:'mira',
        logoWide:true,
        tagline:'Mobile Informationen Rat & Austausch',
      }}
      title="Información y acompañamiento intercultural"
      description="Mira ayuda a personas ofreciendoles experiencia migratoria con información, asesoramiento e intercambio, en su idioma y cerca de donde viven."
      services={MIRA_SERVICES.map(service => ({
        ...service,
        href:MIRA_CONTACT_PATH,
        external:false,
      }))}
      cta={{
        href:MIRA_CONTACT_PATH,
        label:'Contactar',
        external:false,
      }}
      accent={['#2563EB', '#1D4ED8']}
      onServiceClick={service => trackContactIntent({ action:'service', service:service.id })}
      onCtaClick={() => trackContactIntent({ action:'cta' })}
    />
  )
}
