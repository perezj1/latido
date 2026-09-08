import { useAuth } from '../hooks/useAuth'
import { trackPartnerInteraction } from '../lib/partnerAttribution'
import { SUIZA_ESPANOL_URL } from '../lib/suizaEspanol'
import PartnerCard from './PartnerCard'

const SERVICES = [
  { id:'seguros', label:'Seguro de salud', color:'#2563EB', tint:'#EFF6FF' },
  { id:'tercer-pilar', label:'Tercer pilar', color:'#0F766E', tint:'#ECFDF5' },
  { id:'curso', label:'Curso para llegar', color:'#9D174D', tint:'#FDF2F8' },
]

export default function SuizaEspanolPartnerPromo({ placement, variant = 'partner-card' }) {
  const { user, isLoggedIn, isAdmin } = useAuth()
  const destination = (service = '') => {
    if (isLoggedIn) return SUIZA_ESPANOL_URL
    const params = new URLSearchParams({
      partner:'suiza-en-espanol', from:placement,
      action:service ? 'service' : 'cta',
      ...(service ? { service } : {}),
    })
    return `/auth?next=${encodeURIComponent(`/servicios-suiza?${params}`)}`
  }
  const trackClick = (service = '') => {
    if (!isLoggedIn || isAdmin) return
    trackPartnerInteraction('partner_outbound_click', {
      userId:user?.id,
      partnerId:'suiza-en-espanol',
      campaign:'servicios-latido',
      placement,
      action:service ? 'service' : 'cta',
      service,
      destination:SUIZA_ESPANOL_URL,
    })
  }

  return (
    <PartnerCard
      id={`suiza-en-espanol-${placement}`}
      className={variant === 'public-featured' ? 'public-partner-tile' : ''}
      brand={{ partnerLogo:'/partners/suiza-en-espanol/logo-see.webp', partnerName:'Suiza en Español' }}
      title="Servicios especializados para vivir en Suiza"
      description="Orientación en español con un equipo especializado en seguros, previsión y llegada al país."
      services={SERVICES.map(service => ({ ...service, href:destination(service.id), external:isLoggedIn }))}
      cta={{ href:destination(), label:'Contactar', external:isLoggedIn }}
      onServiceClick={service => trackClick(service.id)}
      onCtaClick={() => trackClick()}
    />
  )
}
