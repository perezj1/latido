import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { trackPartnerInteraction } from '../lib/partnerAttribution'

const SYNA_PARTNER_ID = 'syna'
const SYNA_LOGO = '/partners/syna/logo.svg'
const PHONE_DISPLAY = '+41 79 660 83 08'
const PHONE_HREF = 'tel:+41796608308'
const WHATSAPP_HREF = 'https://wa.me/41796608308'
const EMAIL = 'carlos.canosa@syna.ch'
const WEBSITE = 'https://syna.ch/luzern/'

function ContactAction({ href, icon, label, value, external = false, onClick }) {
  return (
    <a
      href={href}
      className="mira-contact-action"
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer sponsored' : undefined}
      onClick={onClick}
    >
      <span className="mira-contact-action-icon" aria-hidden="true">{icon}</span>
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
      <span className="mira-contact-action-arrow" aria-hidden="true">→</span>
    </a>
  )
}

export default function SynaPartnerContact() {
  const { user, isAdmin } = useAuth()

  const trackContactClick = (action, destination) => {
    if (isAdmin) return

    trackPartnerInteraction('partner_outbound_click', {
      userId:user?.id,
      partnerId:SYNA_PARTNER_ID,
      placement:'direct',
      action,
      destination,
    })
  }

  return (
    <div className="mira-contact-page">
      <section className="mira-contact-card" aria-labelledby="syna-contact-title">
        <div className="mira-contact-brand mira-contact-brand--syna">
          <img src={SYNA_LOGO} alt="Syna Luzern" />
        </div>

        <p className="mira-contact-kicker">Colaborador de Latido</p>
        <h1 id="syna-contact-title">Asesoramiento laboral y derechos en Suiza</h1>
        <p className="mira-contact-description">
          Syna Luzern acompaña a trabajadores en temas laborales, contratos,
          salarios, condiciones de trabajo y derechos en Suiza. Carlos Canosa
          es el contacto directo para recibir orientación.
        </p>

        <div className="mira-contact-person">
          <span>Persona de contacto</span>
          <strong>Carlos Canosa</strong>
        </div>

        <div className="mira-contact-actions">
          <ContactAction href={WHATSAPP_HREF} icon="WA" label="WhatsApp" value={PHONE_DISPLAY} external onClick={() => trackContactClick('whatsapp', WHATSAPP_HREF)} />
          <ContactAction href={PHONE_HREF} icon="Tel" label="Llamadas" value={PHONE_DISPLAY} onClick={() => trackContactClick('phone', PHONE_HREF)} />
          <ContactAction href={`mailto:${EMAIL}`} icon="@" label="Email" value={EMAIL} onClick={() => trackContactClick('email', `mailto:${EMAIL}`)} />
          <ContactAction href={WEBSITE} icon="Web" label="Web" value="syna.ch/luzern" external onClick={() => trackContactClick('website', WEBSITE)} />
        </div>

        <Link to="/" className="mira-contact-back">
          &lt;- Volver a Latido
        </Link>
      </section>
    </div>
  )
}
