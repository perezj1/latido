import { Link } from 'react-router-dom'
import { BadgePercent, Heart, BadgeCheck } from 'lucide-react'
import LatidoCardIllustration from './LatidoCardIllustration'
import LatidoCardUsageSteps from './LatidoCardUsageSteps'

export default function LatidoCardIntro({ user, accountUrl, requestUrl, loginUrl, featured }) {
  return (
    <section className="lc-card-intro">
      <div className="lc-intro-presentation">
        <p className="lc-intro-label">Tarjeta Latido</p>
        <h1>Ahorra en los negocios de tu comunidad</h1>
        <LatidoCardIllustration />
        <ul className="lc-intro-benefits">
          <li>
            <span>
              <BadgePercent size={20} aria-hidden="true" />
            </span>
            Descuentos exclusivos
          </li>
          <li>
            <span>
              <BadgeCheck size={20} aria-hidden="true" />
            </span>
            Muestra tu descuento desde el móvil
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
            Solicitar mi tarjeta
          </Link>
        )}
        {!user && (
          <p className="lc-intro-login">
            ¿Ya eres socio? <Link to={loginUrl}>Inicia sesión</Link>
          </p>
        )}
        <small className="lc-intro-note">
          {user
            ? 'Solicita la activación por email a Latido.'
            : 'Crea tu cuenta o inicia sesión para solicitarla.'}
        </small>
      </div>
      <div className="lc-intro-how">
        <h2>¿Cómo funciona?</h2>
        <LatidoCardUsageSteps />
      </div>
      {featured}
    </section>
  )
}
