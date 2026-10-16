import './LatidoMembershipCard.css'

export function LatidoMembershipCard({ member, holderName, sample = false }) {
  const number = String(member.member_number ?? '—').padStart(4, '0')
  const until = member.valid_until
    ? new Intl.DateTimeFormat('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'Europe/Zurich'
      }).format(new Date(member.valid_until))
    : 'DD/MM/AAAA'
  const Holder = sample ? 'span' : 'h1'
  return (
    <article
      className="lc-membership-card"
      data-appearance="dark"
      aria-label={`Tarjeta Latido de ${holderName}`}
    >
      <div className="lc-membership-card__glow" aria-hidden="true" />
      <img className="lc-membership-card__watermark" src="/favicon.svg" alt="" aria-hidden="true" />
      <div className="lc-membership-card__inner">
        <div className="lc-membership-card__top">
          <div className="lc-membership-card__brand">
            <img className="lc-membership-card__logo" src="/favicon.svg" alt="" />
            <div>
              <div className="lc-membership-card__brand-name">Latido</div>
              <div className="lc-membership-card__subtitle">Tarjeta de socio</div>
            </div>
          </div>
          <span className="lc-membership-card__status" data-active={Boolean(member.active)}>
            <span aria-hidden="true" />
            {member.active ? 'Activa' : 'Inactiva'}
          </span>
        </div>
        <div>
          <span className="lc-membership-card__label">Nº de socio</span>
          <div className="lc-membership-card__number" data-long={number.length > 8}>
            {number}
          </div>
        </div>
        <div className="lc-membership-card__bottom">
          <div>
            <span className="lc-membership-card__label">Titular</span>
            <Holder className="lc-membership-card__value" title={holderName}>
              {holderName}
            </Holder>
          </div>
          <div>
            <span className="lc-membership-card__label">Válida hasta</span>
            <span className="lc-membership-card__value">{until}</span>
          </div>
        </div>
      </div>
      <div className="lc-membership-card__stripe" aria-hidden="true" />
    </article>
  )
}

export default function LatidoMembershipCardSummary({ member, holderName }) {
  return (
    <section className="lc-membership-summary" aria-label="Mi Tarjeta Latido">
      <LatidoMembershipCard member={member} holderName={holderName} />
      <p className="lc-membership-hint">
        Elige un descuento y pulsa «Mostrar» o «Activar» para enseñarlo al personal.
      </p>
    </section>
  )
}
