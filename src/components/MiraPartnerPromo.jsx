import PartnerCard from './PartnerCard'

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

export default function MiraPartnerPromo({ variant = 'partner-card' }) {
  return (
    <PartnerCard
      id={`mira-${variant}`}
      className={variant === 'public-featured' ? 'public-partner-tile partner-card--mira' : 'partner-card--mira'}
      brand={{
        partnerLogo:MIRA_LOGO,
        partnerName:'mira',
        logoWide:true,
        tagline:'Mobile Informationen Rat & Austausch',
      }}
      title="Información y acompañamiento intercultural"
      description="Mira ayuda a personas con experiencia migratoria con información, asesoramiento e intercambio, en su idioma y cerca de donde viven."
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
    />
  )
}
