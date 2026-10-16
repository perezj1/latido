import { Repeat2 } from 'lucide-react'
import { offerBenefitLabel, offerUsageLabel } from '../lib/latidoCardCore'
import './LatidoOfferVisual.css'

const amount = (value) =>
  Number(value) > 0
    ? new Intl.NumberFormat('es-CH', { maximumFractionDigits: 2 }).format(Number(value))
    : '…'

export function OfferBenefitBadge({ offer }) {
  const value = amount(offer.benefit_value)
  const [number, unit] =
    offer.benefit_type === 'percent'
      ? [`${value} %`, 'dto.']
      : offer.benefit_type === 'fixed'
        ? [value, 'CHF']
        : offer.benefit_type === 'two_for_one'
          ? ['2 × 1', 'promo']
          : offer.benefit_type === 'service'
            ? ['🤝', 'Servicio']
            : ['🎁', 'Regalo']
  return (
    <span
      className="lc-offer-value"
      role="img"
      aria-label={offerBenefitLabel(offer)}
      data-long={number.length > 6}
    >
      <span className="lc-offer-value-number">{number}</span>
      <span className="lc-offer-value-unit">{unit}</span>
    </span>
  )
}

export function OfferBrandStripe() {
  return (
    <span className="lc-offer-brand-stripe" aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <span key={index} />
      ))}
    </span>
  )
}

export function OfferUsageChip({ offer }) {
  return (
    <span className="lc-offer-usage-chip">
      <Repeat2 size={13} aria-hidden="true" />
      {offerUsageLabel(offer)}
    </span>
  )
}

export default function LatidoOfferPreview({ offer, business, example = false }) {
  return (
    <div
      className="lc-offer-preview"
      aria-label={
        example ? 'Ejemplo de descuento, todavía sin publicar' : 'Vista previa del descuento'
      }
    >
      <div className="lc-offer-preview-head">
        <OfferBenefitBadge offer={offer} />
        <div className="lc-offer-preview-info">
          <strong>{offer.title || offerBenefitLabel(offer)}</strong>
          <p>
            <b>{business?.name || 'Tu negocio'}</b>
            {business?.city && (
              <>
                {' '}
                · <span>{business.city}</span>
              </>
            )}
          </p>
        </div>
      </div>
      <div className="lc-offer-preview-footer">
        <OfferUsageChip offer={offer} />
        <span className="lc-offer-preview-action" aria-hidden="true">
          Activar
        </span>
      </div>
      <OfferBrandStripe />
    </div>
  )
}
