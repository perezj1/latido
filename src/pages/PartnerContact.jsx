import { Link } from 'react-router-dom'
import { ChevronLeftIcon } from '../components/UI'
import { useAuth } from '../hooks/useAuth'
import { trackPartnerInteraction } from '../lib/partnerAttribution'
import { Icon } from '../lib/icons'

const MIRA_PARTNER_ID = 'mira'
const MIRA_LOGO = '/partners/mira/mira-removebg-preview.png'
const PHONE_DISPLAY = '079 388 79 38'
const PHONE_HREF = 'tel:0793887938'
const EMAIL = 'mira@kunigo.ch'

function ContactAction({ href, icon, label, value, onClick }) {
  return (
    <a
      href={href}
      className="mira-contact-action"
      onClick={onClick}
    >
      <span className="mira-contact-action-icon" aria-hidden="true"><Icon name={icon} size={18} /></span>
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
      <span className="mira-contact-action-arrow" aria-hidden="true"><Icon name="forward" size={16} /></span>
    </a>
  )
}

export default function PartnerContact() {
  const { user, isAdmin } = useAuth()

  const trackContactClick = (action, destination) => {
    if (isAdmin) return

    trackPartnerInteraction('partner_outbound_click', {
      userId:user?.id,
      partnerId:MIRA_PARTNER_ID,
      placement:'direct',
      action,
      destination,
    })
  }

  return (
    <div className="mira-contact-page">
      <section className="mira-contact-card" aria-labelledby="mira-contact-title">
        <div className="mira-contact-brand">
          <img src={MIRA_LOGO} alt="mira" />
        </div>

        <p className="mira-contact-kicker">Colaborador de Latido</p>
        <h1 id="mira-contact-title">Información y acompañamiento intercultural</h1>
        <p className="mira-contact-description">
          Mira ayuda a personas con experiencia migratoria mediante información,
          asesoramiento e intercambio. Sus mediadoras interculturales hablan
          diferentes idiomas, conocen distintas realidades y se desplazan allí
          donde las personas las necesitan.
        </p>

        <div className="mira-contact-person">
          <span>Persona de contacto</span>
          <strong>Sandra Vogel</strong>
        </div>

        <div className="mira-contact-actions">
          <ContactAction href={PHONE_HREF} icon="phone" label="Teléfono" value={PHONE_DISPLAY} onClick={() => trackContactClick('phone', PHONE_HREF)} />
          <ContactAction href={`mailto:${EMAIL}`} icon="mail" label="Email" value={EMAIL} onClick={() => trackContactClick('email', `mailto:${EMAIL}`)} />
        </div>

        <Link to="/" className="mira-contact-back">
          <ChevronLeftIcon size={16} /> Volver a Latido
        </Link>
      </section>
    </div>
  )
}
