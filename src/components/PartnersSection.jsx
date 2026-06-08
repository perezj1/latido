import PartnerServicesPromo from './PartnerServicesPromo'

const HOME_PARTNERS = [
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
]

export default function PartnersSection({ placement = 'app_home_partners' }) {
  return (
    <section className="home-partners-section" aria-labelledby="home-partners-title">
      <div className="home-partners-heading">
        <div>
          <h2 id="home-partners-title">🤝 Partners</h2>
          <p>Equipos especializados para ayudarte en Suiza.</p>
        </div>
      </div>

      <div className="home-partners-scroll no-scroll">
        <div className="home-partners-track">
          {HOME_PARTNERS.map(partner => partner.render(`${placement}_${partner.id}`))}
        </div>
      </div>
    </section>
  )
}
