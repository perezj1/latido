import PartnerServicesPromo from './PartnerServicesPromo'
import BelliniPartnerPromo from './BelliniPartnerPromo'
import MiraPartnerPromo from './MiraPartnerPromo'
import SynaPartnerPromo from './SynaPartnerPromo'
import Virtus360PartnerPromo from './Virtus360PartnerPromo'

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
    id:'mira',
    render:placement => <MiraPartnerPromo key="mira" placement={placement} variant="partner-card" />,
  },
]

export default function PartnersSection({ placement = 'app_home_partners' }) {
  const hasSinglePartner = HOME_PARTNERS.length === 1

  return (
    <section className="home-partners-section" aria-labelledby="home-partners-title">
      <div className="home-partners-heading">
        <div>
          <h2 id="home-partners-title">🚀 Colaboradores</h2>
          <p>Equipos especializados para ayudarte en Suiza.</p>
        </div>
      </div>

      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <div className={`home-partners-scroll no-scroll${hasSinglePartner ? ' home-partners-scroll--single' : ''}`}>
          <div className="home-partners-track">
            {HOME_PARTNERS.map(partner => partner.render(`${placement}_${partner.id}`))}
          </div>
        </div>
      </div>
    </section>
  )
}
