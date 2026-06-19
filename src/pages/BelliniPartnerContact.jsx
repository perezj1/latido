import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { trackPartnerInteraction } from '../lib/partnerAttribution'

const BELLINI_PARTNER_ID = 'bellini'
const BELLINI_LOGO = '/partners/bellini/logo-wide.svg'
const BELLINI_PHOTO = '/partners/bellini/paulo-souza.png'
const WHATSAPP_DISPLAY = '+41 79 938 14 01'
const WHATSAPP_HREF = 'https://wa.me/41799381401'
const PHONE_DISPLAY = '+41 58 059 59 75'
const PHONE_HREF = 'tel:+41580595975'
const EMAIL = 'paulo.souza@bellini.ch'
const WEBSITE = 'https://www.bellini.ch/'

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
      <span className="mira-contact-action-arrow" aria-hidden="true">-&gt;</span>
    </a>
  )
}

export default function BelliniPartnerContact() {
  const { user, isAdmin } = useAuth()

  const trackContactClick = (action, destination) => {
    if (isAdmin) return

    trackPartnerInteraction('partner_outbound_click', {
      userId:user?.id,
      partnerId:BELLINI_PARTNER_ID,
      placement:'direct',
      action,
      destination,
    })
  }

  return (
    <div className="mira-contact-page">
      <section className="mira-contact-card" aria-labelledby="bellini-contact-title">
        <div className="mira-contact-brand mira-contact-brand--bellini">
          <img src={BELLINI_LOGO} alt="Bellini" />
        </div>

        <p className="mira-contact-kicker">Colaborador de Latido</p>
        <h1 id="bellini-contact-title">Empleo temporal en la construcción</h1>
        <img
          className="mira-contact-photo"
          src={BELLINI_PHOTO}
          alt="Paulo Souza"
        />
        <p className="mira-contact-description">
          Bellini Personal AG ayuda a encontrar oportunidades temporales en el
          sector de la construcción en Suiza. Su equipo acompaña de forma
          personal y justa para conectar experiencia, disponibilidad y empresas.
        </p>

        <div className="mira-contact-person">
          <span>Persona de contacto</span>
          <strong>Paulo Souza</strong>
        </div>

        <div className="mira-contact-actions">
          <ContactAction href={WHATSAPP_HREF} icon="WA" label="WhatsApp" value={WHATSAPP_DISPLAY} external onClick={() => trackContactClick('whatsapp', WHATSAPP_HREF)} />
          <ContactAction href={PHONE_HREF} icon="Tel" label="Llamadas" value={PHONE_DISPLAY} onClick={() => trackContactClick('phone', PHONE_HREF)} />
          <ContactAction href={`mailto:${EMAIL}`} icon="@" label="Email" value={EMAIL} onClick={() => trackContactClick('email', `mailto:${EMAIL}`)} />
          <ContactAction href={WEBSITE} icon="Web" label="Web" value="bellini.ch" external onClick={() => trackContactClick('website', WEBSITE)} />
        </div>

        <Link to="/" className="mira-contact-back">
          &lt;- Volver a Latido
        </Link>
      </section>
    </div>
  )
}
