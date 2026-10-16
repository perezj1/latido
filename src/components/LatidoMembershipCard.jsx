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
      data-appearance="light"
      aria-label={`Tarjeta Latido de ${holderName}`}
    >
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
      <div className="lc-membership-card__stripe" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    </article>
  )
}

export default function LatidoMembershipCardSummary({ member, holderName, renewUrl }) {
  return (
    <section className="lc-membership-summary" aria-label="Mi Tarjeta Latido">
      {!member.active && renewUrl && (
        <div className="lc-membership-renewal">
          <div>
            <strong>Tu membresía está inactiva</strong>
            <p>Solicita la renovación por email a Latido.</p>
          </div>
          <a className="lc-button" href={renewUrl}>
            Renovar
          </a>
        </div>
      )}
      <LatidoMembershipCard member={member} holderName={holderName} />
      <p className="lc-membership-hint">
        {member.active
          ? 'Pulsa «Activar» cuando estés en el negocio y confirma antes de mostrar el descuento.'
          : 'Renueva tu membresía para volver a utilizar los descuentos.'}
      </p>
    </section>
  )
}
