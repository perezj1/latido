import { useId } from 'react'
import './LatidoMembershipCard.css'

export function LatidoMembershipCard({ member, holderName, sample = false, id }) {
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
      id={id}
      tabIndex={id ? -1 : undefined}
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
  const cardId = useId()
  const days = Math.ceil((Date.parse(member.valid_until) - Date.now()) / 86400000)
  const card = <LatidoMembershipCard member={member} holderName={holderName} id={cardId} />
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
      {member.active ? (
        <div className="lc-member-strip">
          <div className="lc-member-strip-heading">
            <span aria-hidden="true">💳</span>
            <span>
              <strong>Socio nº {String(member.member_number).padStart(4, '0')}</strong>
              <span>
                Activa hasta{' '}
                {new Date(member.valid_until).toLocaleDateString('es-CH', {
                  timeZone: 'Europe/Zurich'
                })}
              </span>
            </span>
            <a className="lc-member-strip-action" href={`#${cardId}`}>
              Ver tarjeta
            </a>
          </div>
          {card}
        </div>
      ) : (
        card
      )}
      {member.active && days >= 0 && Date.parse(member.valid_until) - Date.now() < 7 * 86400000 && (
        <p className="lc-membership-expiry" role="status">
          Tu membresía {days <= 1 ? 'vence en menos de 24 horas' : `vence en ${days} días`}.{' '}
          <a href={renewUrl}>Renovar</a>
        </p>
      )}
    </section>
  )
}
