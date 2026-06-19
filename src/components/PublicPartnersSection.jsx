import PartnerServicesPromo from './PartnerServicesPromo'
import BelliniPartnerPromo from './BelliniPartnerPromo'
import MiraPartnerPromo from './MiraPartnerPromo'
import SynaPartnerPromo from './SynaPartnerPromo'
import Virtus360PartnerPromo from './Virtus360PartnerPromo'

const PUBLIC_PARTNERS = [
  {
    id:'virtus360',
    render:placement => <Virtus360PartnerPromo key="virtus360" placement={placement} variant="public-featured" />,
  },
  {
    id:'suiza-en-espanol',
    render:placement => (
      <PartnerServicesPromo
        key="suiza-en-espanol"
        placement={placement}
        variant="public-featured"
      />
    ),
  },
  {
    id:'syna',
    render:placement => <SynaPartnerPromo key="syna" placement={placement} variant="public-featured" />,
  },
  {
    id:'bellini',
    render:placement => <BelliniPartnerPromo key="bellini" placement={placement} variant="public-featured" />,
  },
  {
    id:'mira',
    render:placement => <MiraPartnerPromo key="mira" placement={placement} variant="public-featured" />,
  },
]

export default function PublicPartnersSection({ placement = 'public_landing' }) {
  const hasSinglePartner = PUBLIC_PARTNERS.length === 1

  return (
    <section className="public-partner-section" aria-labelledby="public-partners-title">
      <div className="public-partner-vip-star" aria-hidden="true">⭐</div>
      <div className="public-partner-heading">
        <div className="public-partner-heading-title">
          <span>Colaboradores seleccionados</span>
          <h2 id="public-partners-title">Más apoyo para vivir en Suiza con confianza</h2>
        </div>
        <div className="public-partner-heading-copy">
          <p>
            Colaboramos con equipos especializados que entienden las necesidades
            de la comunidad hispanohablante.
          </p>
        </div>
      </div>

      <div
        className={`public-partners-scroll no-scroll${hasSinglePartner ? ' public-partners-scroll--single' : ''}`}
        aria-label="Colaboradores de Latido"
      >
        <div className="public-partners-track">
          {PUBLIC_PARTNERS.map(partner => partner.render(`${placement}_${partner.id}`))}
        </div>
      </div>
    </section>
  )
}
