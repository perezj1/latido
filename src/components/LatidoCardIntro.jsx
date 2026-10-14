import { Link } from 'react-router-dom'
import { ArrowRight, BadgePercent, Heart, HeartPulse, QrCode, Store } from 'lucide-react'

export default function LatidoCardIntro({ user, accountUrl, requestUrl, sharedOffer }) {
  return (
    <section className="lc-card-intro">
      <div className="lc-intro-sample" role="img" aria-label="Ejemplo de Tarjeta Latido">
        <div className="lc-intro-sample-top" aria-hidden="true">
          <strong>
            <HeartPulse size={22} /> Latido
          </strong>
          <span>Socio</span>
        </div>
        <div className="lc-intro-sample-bottom" aria-hidden="true">
          <div>
            <small>Tarjeta de ventajas</small>
            <strong>•••• 2481</strong>
          </div>
          <span>
            <QrCode size={30} />
          </span>
        </div>
      </div>
      <p className="lc-intro-label">Tarjeta Latido</p>
      <h1>Ahorra en los negocios de tu comunidad</h1>
      {sharedOffer && (
        <p className="lc-intro-shared">
          <strong>{sharedOffer.title}</strong> en {sharedOffer.business_name}. Esta ventaja también
          puede ser tuya.
        </p>
      )}
      <ul className="lc-intro-benefits">
        <li>
          <span>
            <BadgePercent size={20} aria-hidden="true" />
          </span>
          Descuentos y ventajas exclusivas
        </li>
        <li>
          <span>
            <QrCode size={20} aria-hidden="true" />
          </span>
          Tarjeta física o QR en tu móvil
        </li>
        <li>
          <span>
            <Heart size={20} aria-hidden="true" />
          </span>
          Apoyas a los negocios de tu gente
        </li>
      </ul>
      <p className="lc-intro-price">
        CHF 6,90 <small>/ mes</small>
      </p>
      {user ? (
        <a className="lc-button lc-intro-cta" href={requestUrl}>
          Solicitar mi tarjeta
        </a>
      ) : (
        <Link className="lc-button lc-intro-cta" to={accountUrl}>
          {sharedOffer ? 'Crear cuenta y conseguir mi tarjeta' : 'Solicitar mi tarjeta'}
        </Link>
      )}
      <small className="lc-intro-note">
        {user
          ? 'La activación del piloto se solicita por email a Latido.'
          : 'Crea tu cuenta o inicia sesión para solicitarla.'}
      </small>
      <Link className="lc-intro-business" to="/card/negocios">
        <Store size={18} aria-hidden="true" />
        <span>
          ¿Tienes un negocio? <strong>Únete gratis</strong>
        </span>
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </section>
  )
}
