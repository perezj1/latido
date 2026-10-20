import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  Check,
  Clock3,
  Info,
  ReceiptText,
  Repeat2,
  Share2,
  Store
} from 'lucide-react'
import {
  offerAvailability,
  offerBenefitLabel,
  offerHasEnd,
  offerUsageLabel
} from '../lib/latidoCardCore'
import {
  OfferBenefitBadge,
  OfferBenefitIcon,
  OfferBrandStripe,
  OfferUsageChip
} from './LatidoOfferVisual'
import './LatidoDiscountCard.css'

const date = (value) => new Date(value).toLocaleDateString('es-CH', { timeZone: 'Europe/Zurich' })
const minimum = (offer) =>
  Number(offer.minimum_spend) > 0
    ? `Compra mínima CHF ${Number(offer.minimum_spend)}`
    : 'Sin compra mínima'

export function DiscountBusinessPhoto({ offer, small = false, avatar = false }) {
  const [failed, setFailed] = useState(null)
  const src = offer.business_photo_url
  return (
    <span
      className={`lc-discount-photo ${small ? 'lc-discount-photo--small' : ''} ${avatar ? 'lc-discount-photo--avatar' : ''}`}
      aria-hidden={avatar || undefined}
      data-benefit={!src || failed === src ? offer.benefit_type : undefined}
    >
      {src && failed !== src ? (
        <img
          src={src}
          alt={avatar ? '' : `Imagen de ${offer.business_name}`}
          loading="lazy"
          onError={() => setFailed(src)}
        />
      ) : (
        <span className="lc-discount-photo-symbol" aria-hidden="true">
          {avatar ? <Store size={12} /> : <OfferBenefitIcon type={offer.benefit_type} size={small ? 24 : 28} />}
        </span>
      )}
    </span>
  )
}

export default function LatidoDiscountCard({
  offer,
  memberActive,
  memberInactive = false,
  user,
  loginUrl,
  requestUrl,
  busy,
  shared,
  onActivate,
  onShare,
  manualShareUrl,
  hideJoinAction = false,
  previewOnly = false,
  actionLabel = 'Activar',
  inBusiness = false,
  expanded = false,
  onToggleDetails
}) {
  const detailsId = useId()
  const availability = offerAvailability(offer, { memberActive })
  const daysLeft = Math.ceil((Date.parse(offer.ends_at) - Date.now()) / 86400000)
  const action = (
    <div className="lc-discount-actions">
      {(!hideJoinAction || memberActive) && (
        <div className="lc-discount-buttons">
          {!memberActive ? (
            user ? (
              <a className="lc-discount-primary" href={requestUrl}>
                {memberInactive ? 'Renovar' : 'Conseguir tarjeta'}
              </a>
            ) : (
              <Link className="lc-discount-primary" to={loginUrl}>
                Inicia sesión
              </Link>
            )
          ) : availability.used ? (
            <button
              type="button"
              className="lc-discount-primary lc-discount-secondary"
              disabled={busy}
              onClick={() => onShare(offer)}
            >
              <Share2 size={16} aria-hidden="true" />
              Compartir
            </button>
          ) : (
            <button
              className="lc-discount-primary"
              disabled={busy || availability.unavailable}
              onClick={() => onActivate(offer)}
            >
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
  return (
    <article
      className={`lc-offer-row lc-discount-card lc-coupon ${inBusiness ? 'lc-discount-card--in-business' : ''} ${shared ? 'lc-discount-card--shared' : ''} ${availability.unavailable ? 'lc-discount-card--unavailable' : ''}`}
      onClick={(event) => {
        if (!event.target.closest('button, a, input, label')) onToggleDetails()
      }}
    >
      <div className="lc-discount-main">
        <OfferBenefitBadge offer={offer} />
        <div className="lc-discount-info">
          <h3 className="lc-discount-title">
            <button
              className="lc-discount-open"
              aria-expanded={expanded}
              aria-controls={detailsId}
              onClick={onToggleDetails}
            >
              {offer.title}
            </button>
          </h3>
          {!inBusiness && (
            <button
              type="button"
              className="lc-discount-business"
              aria-expanded={expanded}
              aria-controls={detailsId}
              onClick={onToggleDetails}
            >
              <DiscountBusinessPhoto offer={offer} avatar />
              <span className="lc-discount-business-name">
                {offer.business_name}
                {offer.city && <span className="lc-discount-city"> · {offer.city}</span>}
              </span>
            </button>
          )}
        </div>
        <button
          className="lc-discount-share"
          aria-label={`Compartir ${offer.title}`}
          onClick={() => onShare(offer)}
        >
          <Share2 size={19} aria-hidden="true" />
        </button>
      </div>
      {inBusiness && offer.requires_claim && (
        <p className="lc-business-offer-limit">
          <Clock3 size={13} aria-hidden="true" />
          Limitada
          {offer.remaining != null
            ? ` · ${Number(offer.remaining) > 0 ? `Quedan ${offer.remaining}` : 'Agotada'}`
            : ''}
        </p>
      )}
      <div className="lc-discount-summary lc-coupon-footer">
        <div className="lc-discount-bottom">
          <OfferUsageChip offer={offer} />
          {!inBusiness && (
            <div className="lc-discount-tags">
              {offer.requires_claim && <span>Limitada</span>}
              {daysLeft > 0 && daysLeft <= 3 && (
                <span>Termina {daysLeft === 1 ? 'en menos de 24 h' : `en ${daysLeft} días`}</span>
              )}
              {offer.remaining != null && (
                <span>{Number(offer.remaining) > 0 ? `Quedan ${offer.remaining}` : 'Agotado'}</span>
              )}
            </div>
          )}
          {inBusiness && daysLeft > 0 && daysLeft <= 3 && (
            <p className="lc-discount-availability">
              Termina {daysLeft === 1 ? 'en menos de 24 h' : `en ${daysLeft} días`}
            </p>
          )}
          {availability.message && (
            <p className="lc-discount-availability">{availability.message}</p>
          )}
        </div>
        {!previewOnly && action}
      </div>
      <div className="lc-discount-details" id={detailsId} hidden={!expanded}>
        <p>{offer.description || offerBenefitLabel(offer)}</p>
        <ul>
          <li>
            <ReceiptText size={17} aria-hidden="true" />
            <span>{minimum(offer)}</span>
          </li>
          <li>
            <Repeat2 size={17} aria-hidden="true" />
            <span>{offerUsageLabel(offer)}</span>
          </li>
          {offerHasEnd(offer) ? (
            <li>
              <CalendarDays size={17} aria-hidden="true" />
              <span>Válido hasta el {date(offer.ends_at)}</span>
            </li>
          ) : (
            <li>
              <CalendarDays size={17} aria-hidden="true" />
              <span>Sin fecha de fin</span>
            </li>
          )}
          {offer.remaining != null && (
            <li>
              <Store size={17} aria-hidden="true" />
              <span>{offer.remaining} unidades disponibles</span>
            </li>
          )}
        </ul>
      </div>
      {manualShareUrl && (
        <label className="lc-discount-share-link">
          Enlace de la oferta
          <input readOnly value={manualShareUrl} onFocus={(event) => event.target.select()} />
        </label>
      )}
      <OfferBrandStripe />
    </article>
  )
}

export function LatidoDiscountHistory({ items, inBusiness = false }) {
  if (inBusiness)
    return (
      <ul className="lc-business-used-offers">
        {items.map((offer) => (
          <li key={offer.id}>
            <article className="lc-business-used-offer lc-coupon">
              <div>
                <OfferBenefitBadge offer={offer} />
                <h3>{offer.title}</h3>
              </div>
              <span className="lc-business-used-date lc-coupon-footer">
                <Check size={13} aria-hidden="true" />
                Usada el <time dateTime={offer.redeemed_at}>{date(offer.redeemed_at)}</time>
              </span>
              <OfferBrandStripe />
            </article>
          </li>
        ))}
      </ul>
    )
  return (
    <div className="lc-discount-history">
      <ul>
        {items.map((offer) => (
          <li className="lc-use-row lc-coupon" key={offer.redemptionId}>
            <DiscountBusinessPhoto offer={offer} small />
            <div className="lc-use-info">
              <h3>{offer.title}</h3>
              <span>{offer.business_name}</span>
              <div className="lc-use-meta lc-coupon-footer">
                <time dateTime={offer.redeemed_at}>{date(offer.redeemed_at)}</time>
                <span className="lc-use-pill">
                  <Check size={12} aria-hidden="true" />
                  Usado
                </span>
              </div>
            </div>
            <OfferBrandStripe />
          </li>
        ))}
      </ul>
    </div>
  )
}

export function LatidoDiscountConfirmation({ offer, onClose, onConfirm, busy, error }) {
  const dialog = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    dialog.current.showModal()
    return () => previous?.focus()
  }, [])
  return (
    <dialog
      ref={dialog}
      className="lc-confirm-sheet"
      aria-labelledby="lc-confirm-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
      onClick={(event) => {
        if (event.target === dialog.current && !busy) {
          const rect = dialog.current.getBoundingClientRect()
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose()
        }
      }}
    >
      <div className="lc-confirm-clock" aria-hidden="true">
        <Clock3 size={28} />
      </div>
      <h2 id="lc-confirm-title">¿Usar este descuento ahora?</h2>
      <div className="lc-confirm-summary">
        <DiscountBusinessPhoto offer={offer} small />
        <div>
          <strong>{offer.title}</strong>
          <span>{offer.business_name}</span>
          <span>{minimum(offer)}</span>
        </div>
      </div>
      <div className="lc-confirm-notice">
        <Info size={20} aria-hidden="true" />
        <p>
          <strong>Actívalo cuando vayas a pagar</strong> y muéstralo al personal para recibir el
          descuento.
        </p>
      </div>
      {error && (
        <p className="lc-alert" role="alert">
          {error}
        </p>
      )}
      <div className="lc-confirm-actions">
        <button className="lc-discount-primary" disabled={busy} onClick={onConfirm}>
          {busy ? 'Confirmando…' : 'Usar ahora'}
        </button>
        <button className="lc-confirm-cancel" disabled={busy} onClick={onClose}>
          Cancelar
        </button>
      </div>
    </dialog>
  )
}
