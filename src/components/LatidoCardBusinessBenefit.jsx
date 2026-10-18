import { Link } from 'react-router-dom'
import useCardCatalog from '../hooks/useCardCatalog'
import { businessBenefit } from '../lib/latidoCardExperience'

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
    <section
      className="lc-business-benefit-block"
      style={{ background: '#eff6ff', padding: 16, borderRadius: 16, margin: '16px 0' }}
    >
      <h2 style={{ fontSize: 16 }}>Oferta para socios de Tarjeta Latido</h2>
      <p>
        {benefit}
        {offers[0].city ? ` en ${offers[0].city}` : ''}
      </p>
      <Link
        to={`/card/negocio/${providerId}`}
        style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, fontWeight: 700 }}
      >
        Ver ofertas →
      </Link>
    </section>
  )
}
