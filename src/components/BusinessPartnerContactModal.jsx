import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'

const CONTACT_ACTION_ICONS = {
  address:'📍',
  phone:'📞',
  email:'✉️',
  instagram:'📸',
  tiktok:'🎵',
  whatsapp:'💬',
  website:'🌐',
  profile:'🏪',
}

const CONTACT_TYPE_ORDER = ['address', 'phone', 'whatsapp', 'email', 'website', 'instagram', 'tiktok', 'profile']

const CONTACT_GROUP_SUMMARIES = {
  address:'direcciones',
  phone:'teléfonos',
  whatsapp:'números de WhatsApp',
  email:'emails',
  website:'webs',
  instagram:'cuentas de Instagram',
  tiktok:'cuentas de TikTok',
}

function groupContactActions(actions = []) {
  const groups = new Map()
  actions.forEach(action => {
    const type = action.type || action.id
    if (!groups.has(type)) groups.set(type, { id:type, type, label:action.label, actions:[] })
    groups.get(type).actions.push(action)
  })
  return [...groups.values()].sort((left, right) => (
    CONTACT_TYPE_ORDER.indexOf(left.type) - CONTACT_TYPE_ORDER.indexOf(right.type)
  ))
}

function ContactAction({ action, onClick, nested=false }) {
  const icon = CONTACT_ACTION_ICONS[action.type || action.id] || action.icon
  const content = (
    <>
      <span className="mira-contact-action-icon" aria-hidden="true">{icon}</span>
      <span>
        <small>
          {nested
            ? action.optionLabel || action.label
            : action.isAdditional && action.optionLabel
              ? `${action.label} · ${action.optionLabel}`
              : action.label}
        </small>
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
        className={`mira-contact-action${nested ? ' mira-contact-action--nested' : ''}`}
        target={action.external ? '_blank' : undefined}
        rel={action.external ? 'noopener noreferrer sponsored' : undefined}
        onClick={handleClick}
      >
        {content}
      </a>
    )
  }

  return (
    <Link to={action.href} className={`mira-contact-action${nested ? ' mira-contact-action--nested' : ''}`} onClick={handleClick}>
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
  const [expandedGroup, setExpandedGroup] = useState('')

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

  useEffect(() => {
    if (!open) setExpandedGroup('')
  }, [open])

  if (!open || !partner || typeof document === 'undefined') return null

  const actions = partner.contactActions?.length
    ? partner.contactActions
    : [{
      id:'profile',
      type:'profile',
      icon:'🏪',
      label:'Perfil en Latido',
      value:'Ver negocio',
      href:`/negocios/${partner.id}`,
      external:false,
    }]
  const actionGroups = groupContactActions(actions)

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`business-partner-contact-${partner.id}`}
      className="business-partner-contact-overlay latido-overlay-backdrop"
      onClick={onClose}
    >
      <section
        className="mira-contact-card business-partner-contact-dialog latido-modal-panel"
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
          {actionGroups.map(group => {
            if (group.actions.length === 1) {
              const action = group.actions[0]
              return (
                <ContactAction
                  key={action.id}
                  action={action}
                  onClick={clickedAction => onContactClick?.(clickedAction, placement)}
                />
              )
            }

            const expanded = expandedGroup === group.id
            const icon = CONTACT_ACTION_ICONS[group.type] || group.actions[0]?.icon
            return (
              <div key={group.id} className="mira-contact-action-group">
                <button
                  type="button"
                  className="mira-contact-action mira-contact-action--toggle"
                  aria-expanded={expanded}
                  onClick={() => setExpandedGroup(current => current === group.id ? '' : group.id)}
                >
                  <span className="mira-contact-action-icon" aria-hidden="true">{icon}</span>
                  <span>
                    <small>{group.label}</small>
                    <strong>{group.actions.length} {CONTACT_GROUP_SUMMARIES[group.type] || 'opciones'}</strong>
                  </span>
                  <span className={`mira-contact-action-chevron${expanded ? ' is-expanded' : ''}`} aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false">
                      <path d="m6.5 9 5.5 5.5L17.5 9" />
                    </svg>
                  </span>
                </button>
                {expanded && (
                  <div className="mira-contact-action-options">
                    {group.actions.map(action => (
                      <ContactAction
                        key={action.id}
                        action={action}
                        nested
                        onClick={clickedAction => onContactClick?.(clickedAction, placement)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>,
    document.body,
  )
}
