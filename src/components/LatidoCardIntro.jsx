import { Link } from 'react-router-dom'
import { ArrowRight, BadgePercent, Heart, BadgeCheck, Store } from 'lucide-react'
import { LatidoMembershipCard } from './LatidoMembershipCard'

export default function LatidoCardIntro({ user, accountUrl, requestUrl, loginUrl, featured }) {
  return (
    <section className="lc-card-intro">
      <p className="lc-intro-label">Tarjeta Latido</p>
      <h1>Ahorra en los negocios de tu comunidad</h1>
      {featured}
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
      <div className="lc-intro-card-preview" role="img" aria-label="Ejemplo de Tarjeta Latido">
        <div aria-hidden="true">
          <LatidoMembershipCard
            sample
            member={{ member_number: 1, active: true }}
            holderName="Tu nombre"
          />
        </div>
      </div>
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
