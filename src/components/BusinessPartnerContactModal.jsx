import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'

function ContactAction({ action, onClick }) {
  const content = (
    <>
      <span className="mira-contact-action-icon" aria-hidden="true">{action.icon}</span>
      <span>
        <small>{action.label}</small>
        <strong>{action.value}</strong>
      </span>
      <span className="mira-contact-action-arrow" aria-hidden="true">→</span>
    </>
  )

  const handleClick = () => onClick?.(action)

  const isSpecialHref = /^(tel|mailto):/i.test(action.href || '')

  if (action.external || isSpecialHref) {
    return (
      <a
        href={action.href}
        className="mira-contact-action"
        target={action.external ? '_blank' : undefined}
        rel={action.external ? 'noopener noreferrer sponsored' : undefined}
        onClick={handleClick}
      >
        {content}
      </a>
    )
  }

  return (
    <Link to={action.href} className="mira-contact-action" onClick={handleClick}>
      {content}
    </Link>
  )
}

export default function BusinessPartnerContactModal({
  open,
  partner,
  placement,
  onClose,
  onContactClick,
}) {
  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose?.()
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open || !partner || typeof document === 'undefined') return null

  const actions = partner.contactActions?.length
    ? partner.contactActions
    : [{
      id:'profile',
      type:'profile',
      icon:'Lat',
      label:'Perfil en Latido',
      value:'Ver negocio',
      href:`/negocios/${partner.id}`,
      external:false,
    }]

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`business-partner-contact-${partner.id}`}
      className="business-partner-contact-overlay"
      onClick={onClose}
    >
      <section
        className="mira-contact-card business-partner-contact-dialog"
        onClick={event => event.stopPropagation()}
      >
        <button
          type="button"
          className="business-partner-contact-close"
          aria-label="Cerrar"
          onClick={onClose}
        >
          x
        </button>

        <div className="mira-contact-brand business-partner-contact-brand">
          <img src={partner.logoUrl} alt={partner.name} />
        </div>

        <p className="mira-contact-kicker">Colaborador de Latido</p>
        <h1 id={`business-partner-contact-${partner.id}`}>{partner.title}</h1>
        <p className="mira-contact-description">{partner.description}</p>

        <div className="mira-contact-person">
          <span>Contacto</span>
          <strong>{partner.name}</strong>
        </div>

        <div className="mira-contact-actions">
          {actions.map(action => (
            <ContactAction
              key={action.id}
              action={action}
              onClick={clickedAction => onContactClick?.(clickedAction, placement)}
            />
          ))}
        </div>
      </section>
    </div>,
    document.body,
  )
}
