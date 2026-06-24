import { Link } from 'react-router-dom'

export default function PartnerCard({
  id,
  className = '',
  brand,
  title,
  description,
  services = [],
  cta,
  accent = ['#2563EB', '#C8102E'],
  onServiceClick,
  onCtaClick,
}) {
  return (
    <article
      className={`partner-card${className ? ` ${className}` : ''}`}
      aria-labelledby={`partner-card-${id}`}
      style={{
        '--partner-accent-primary':accent[0],
        '--partner-accent-secondary':accent[1],
      }}
    >
      <div className="partner-card-brand" aria-label={brand.partnerName}>
        <span className="partner-card-brand-unit">
          <span className={`partner-card-logo${brand.logoWide ? ' partner-card-logo--wide' : ''}`}>
            <img src={brand.partnerLogo} alt="" />
          </span>
          {brand.showName !== false && (
            <strong className={brand.tagline ? 'partner-card-brand-tagline' : ''}>
              {brand.tagline || brand.partnerName}
            </strong>
          )}
        </span>
      </div>

      <div className="partner-card-copy">
        <h3 id={`partner-card-${id}`}>{title}</h3>
        <p>{description}</p>
      </div>

      <div className="partner-card-services" aria-label={`Servicios de ${brand.partnerName}`}>
        {services.map(service => {
          const content = <span>{service.label}</span>
          const style = { '--service-color':service.color, '--service-tint':service.tint }
          const isSpecialHref = /^(tel|mailto):/i.test(service.href || '')
          const isExternal = service.external !== false || isSpecialHref

          return !isExternal ? (
            <Link
              key={service.id}
              to={service.href}
              onClick={() => onServiceClick?.(service)}
              style={style}
            >
              {content}
            </Link>
          ) : (
            <a
              key={service.id}
              href={service.href}
              target={isSpecialHref ? undefined : '_blank'}
              rel={isSpecialHref ? undefined : 'noopener noreferrer sponsored'}
              onClick={() => onServiceClick?.(service)}
              style={style}
            >
              {content}
            </a>
          )
        })}
      </div>

      {cta.button ? (
        <button
          type="button"
          className="partner-card-cta partner-card-cta--button"
          onClick={onCtaClick}
        >
          {cta.label} <span aria-hidden="true">→</span>
        </button>
      ) : cta.external ? (
        <a
          className="partner-card-cta"
          href={cta.href}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={onCtaClick}
        >
          {cta.label} <span aria-hidden="true">→</span>
        </a>
      ) : (
        <Link className="partner-card-cta" to={cta.href} onClick={onCtaClick}>
          {cta.label} <span aria-hidden="true">→</span>
        </Link>
      )}
    </article>
  )
}
