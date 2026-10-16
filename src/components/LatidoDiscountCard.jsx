import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Check, Clock3, Info, ReceiptText, Share2, Store } from 'lucide-react'
import { offerAvailability, offerBenefitLabel, offerUsageLabel } from '../lib/latidoCardCore'
import './LatidoDiscountCard.css'

const date = (value) => new Date(value).toLocaleDateString('es-CH', { timeZone: 'Europe/Zurich' })
const offerEmojis = { percent: '🎟️', fixed: '🛍️', gift: '🎁', service: '🤝', two_for_one: '✨' }
const minimum = (offer) =>
  Number(offer.minimum_spend) > 0
    ? `Compra mínima CHF ${Number(offer.minimum_spend)}`
    : 'Sin compra mínima'

export function DiscountBusinessPhoto({ offer, small = false }) {
  const [failed, setFailed] = useState(null)
  const src = offer.business_photo_url
  return (
    <div className={`lc-discount-photo ${small ? 'lc-discount-photo--small' : ''}`}>
      {src && failed !== src ? (
        <img
          src={src}
          alt={`Imagen de ${offer.business_name}`}
          loading="lazy"
          onError={() => setFailed(src)}
        />
      ) : (
        <span className="lc-discount-photo-emoji" aria-hidden="true">
          {offerEmojis[offer.benefit_type] || '🏪'}
        </span>
      )}
    </div>
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
  actionLabel = 'Activar'
}) {
  const [expanded, setExpanded] = useState(false)
  const detailsId = useId()
  const availability = offerAvailability(offer, { memberActive })
  const daysLeft = Math.ceil((Date.parse(offer.ends_at) - Date.now()) / 86400000)
  const compactTitle = String(offer.title || '')
    .toLocaleLowerCase('es')
    .replace(/\s/g, '')
  const repeatsBenefit =
    offer.benefit_type === 'percent'
      ? compactTitle.includes(`${Number(offer.benefit_value)}%`)
      : offer.benefit_type === 'fixed'
        ? compactTitle.includes(`chf${Number(offer.benefit_value)}`)
        : offer.benefit_type === 'two_for_one'
          ? /2[×x]1/.test(compactTitle)
          : compactTitle.includes(
              offerBenefitLabel(offer).toLocaleLowerCase('es').replace(/\s/g, '')
            )
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
      className={`lc-offer-row lc-discount-card ${shared ? 'lc-discount-card--shared' : ''} ${availability.unavailable ? 'lc-discount-card--unavailable' : ''}`}
      onClick={(event) => {
        if (!event.target.closest('button, a, input, label')) setExpanded((value) => !value)
      }}
    >
      <div className="lc-discount-main">
        <DiscountBusinessPhoto offer={offer} />
        <div className="lc-discount-info">
          <h3 className="lc-discount-title">
            <button
              className="lc-discount-open"
              aria-expanded={expanded}
              aria-controls={detailsId}
              onClick={() => setExpanded((value) => !value)}
            >
              {offer.title}
            </button>
          </h3>
          <Link className="lc-discount-business" to={`/card/negocio/${offer.provider_id}`}>
            {offer.business_name}
            {offer.city && ` · ${offer.city}`}
          </Link>
          {!repeatsBenefit && <p className="lc-discount-benefit">{offerBenefitLabel(offer)}</p>}
          <div className="lc-discount-summary">
            <div className="lc-discount-bottom">
              <p>{offerUsageLabel(offer)}</p>
              {action}
            </div>
            <div className="lc-discount-tags">
              {offer.requires_claim && <span>Promoción limitada</span>}
              {daysLeft > 0 && daysLeft <= 3 && (
                <span>Termina {daysLeft === 1 ? 'en menos de 24 h' : `en ${daysLeft} días`}</span>
              )}
              {offer.remaining != null && (
                <span>{Number(offer.remaining) > 0 ? `Quedan ${offer.remaining}` : 'Agotado'}</span>
              )}
            </div>
            {availability.message && (
              <p className="lc-discount-availability">{availability.message}</p>
            )}
          </div>
        </div>
        <button
          className="lc-discount-share"
          aria-label={`Compartir ${offer.title}`}
          onClick={() => onShare(offer)}
        >
          <Share2 size={19} aria-hidden="true" />
        </button>
      </div>
      <div className="lc-discount-details" id={detailsId} hidden={!expanded}>
        <p>{offer.description || offerBenefitLabel(offer)}</p>
        <ul>
          <li>
            <ReceiptText size={17} aria-hidden="true" />
            <span>{minimum(offer)}</span>
          </li>
          <li>
            <span>{offerUsageLabel(offer)}</span>
          </li>
          {offer.ends_at && (
            <li>
              <CalendarDays size={17} aria-hidden="true" />
              <span>Válido hasta el {date(offer.ends_at)}</span>
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
    </article>
  )
}

export function LatidoDiscountHistory({ items }) {
  return (
    <div className="lc-discount-history">
      <ul>
        {items.map((offer) => (
          <li className="lc-use-row" key={offer.redemptionId}>
            <DiscountBusinessPhoto offer={offer} small />
            <div className="lc-use-info">
              <h3>{offer.title}</h3>
              <span>{offer.business_name}</span>
              <div className="lc-use-meta">
                <time dateTime={offer.redeemed_at}>{date(offer.redeemed_at)}</time>
                <span className="lc-use-pill">
                  <Check size={12} aria-hidden="true" />
                  Usado
                </span>
              </div>
            </div>
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
          <strong>Actívalo cuando vayas a pagar.</strong> Tendrás hasta <strong>5 minutos</strong>{' '}
          para enseñarlo en caja.{' '}
          {offer.usage_period !== 'unlimited' || offer.requires_claim
            ? 'Al confirmar se consume un uso, aunque pasen los 5 minutos sin enseñarlo.'
            : 'El uso quedará guardado en tu historial.'}
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
