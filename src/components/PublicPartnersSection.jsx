import PartnerServicesPromo from './PartnerServicesPromo'
import MiraPartnerPromo from './MiraPartnerPromo'

const PUBLIC_PARTNERS = [
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
    id:'mira',
    render:() => <MiraPartnerPromo key="mira" variant="public-featured" />,
  },
]

export default function PublicPartnersSection({ placement = 'public_landing' }) {
  const hasSinglePartner = PUBLIC_PARTNERS.length === 1

  return (
    <section className="public-partner-section" aria-labelledby="public-partners-title">
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
