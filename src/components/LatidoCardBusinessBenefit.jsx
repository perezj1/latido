import { Link } from 'react-router-dom'
import useCardCatalog from '../hooks/useCardCatalog'
import { businessBenefit } from '../lib/latidoCardExperience'
import { OfferBrandStripe } from './LatidoOfferVisual'

export default function LatidoCardBusinessBenefit({ providerId, block = false }) {
  const catalog = useCardCatalog()
  const offers = catalog.filter((o) => o.provider_id === providerId)
  if (!offers.length) return null
  const benefit = businessBenefit(offers)
  if (!block)
    return (
      <span
        className="lc-business-benefit-badge"
        style={{
          display: 'inline-block',
          maxWidth: '100%',
          fontSize: 10,
          fontWeight: 700,
          color: '#1d4ed8',
          background: '#eff6ff',
          borderRadius: 8,
          padding: '4px 7px',
          margin: '4px 0'
        }}
      >
        {benefit.replace('Hasta ', '')} socios
      </span>
    )
  return (
    <section className="lc-business-benefit-block lc-coupon">
      <h2>Oferta para socios de Tarjeta Latido</h2>
      <p>
        {benefit}
        {offers[0].city ? ` en ${offers[0].city}` : ''}
      </p>
      <div className="lc-business-benefit-footer lc-coupon-footer">
        <Link className="lc-business-benefit-link" to={`/card/negocio/${providerId}`}>
          Ver ofertas →
        </Link>
      </div>
      <OfferBrandStripe />
    </section>
  )
}
