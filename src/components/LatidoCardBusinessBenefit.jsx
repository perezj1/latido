import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import useCardCatalog from '../hooks/useCardCatalog'
import { businessBenefit } from '../lib/latidoCardExperience'
import { OfferBrandStripe } from './LatidoOfferVisual'
import './LatidoCardBusinessBenefit.css'

export default function LatidoCardBusinessBenefit({ providerId, block = false, pill = false }) {
  const catalog = useCardCatalog()
  const offers = catalog.filter((o) => o.provider_id === providerId)
  if (!offers.length) return null
  const benefit = businessBenefit(offers)
  if (pill)
    return (
      <span className="lc-business-card-pill">
        <img src="/favicon.svg" alt="" width="16" height="16" />
        Tarjeta Latido
      </span>
    )
  if (!block)
    return <span className="lc-business-benefit-badge">{benefit.replace('Hasta ', '')} socios</span>
  return (
    <Link
      className="lc-business-benefit-block"
      to={`/card/negocio/${providerId}`}
      aria-label={`Ver ${offers.length} ${offers.length === 1 ? 'oferta' : 'ofertas'} de Tarjeta Latido`}
    >
      <span className="lc-business-benefit-logo" aria-hidden="true">
        <img src="/favicon.svg" alt="" width="22" height="22" />
      </span>
      <span className="lc-business-benefit-copy">
        <strong>
          {benefit.startsWith('Hasta ') ? benefit.replace('−', '') : benefit} para socios
        </strong>
        <span>
          Tarjeta Latido · {offers.length} {offers.length === 1 ? 'oferta' : 'ofertas'}
        </span>
      </span>
      <ChevronRight size={20} aria-hidden="true" />
      <OfferBrandStripe />
    </Link>
  )
}
