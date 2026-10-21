import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { cardRpc } from '../lib/latidoCard'
import { cardErrorMessage } from '../lib/latidoCardCore'
import { refreshCardBusinessAccess } from '../hooks/useCardBusinessAccess'
import { useAuth } from '../hooks/useAuth'
import { trackCardEvent } from '../lib/analytics'
import { invalidateCardCatalog } from '../lib/latidoCardCatalog'
import LatidoOfferPreview from './LatidoOfferVisual'
import LatidoCardBusinessMaterial from './LatidoCardBusinessMaterial'
import LatidoCardOfferForm from './LatidoCardOfferForm'
import { useLatidoBusinessDisplay } from '../hooks/useLatidoBusinessDisplay'
import '../pages/LatidoCard.css'
import './LatidoCardOfferModal.css'
import { CARD_MEMBERS_ENABLED } from '../lib/latidoCardLaunch'

export default function LatidoCardOfferModal({
  providerId,
  open,
  onClose,
  onPublished,
  initialSelection,
  operation
}) {
  const dialogRef = useRef(null),
    titleRef = useRef(null)
  const titleId = useId()
  const { user } = useAuth()
  const [business, setBusiness] = useState(null)
  const displayBusiness = useLatidoBusinessDisplay(business)
  const [loading, setLoading] = useState(false),
    [error, setError] = useState('')
  const [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0)
  const [offers, setOffers] = useState([]),
    [success, setSuccess] = useState(null)
  const progress = useRef({ step: 1, started: false, published: false })
  useEffect(() => {
    if (!open) {
      setSuccess(null)
      return
    }
    progress.current = { step: 1, started: false, published: false }
    return () => {
      if (progress.current.started && !progress.current.published)
        trackCardEvent('form_abandon', {
          step: progress.current.step,
          mode: operation?.mode || 'create'
        })
    }
  }, [open, operation?.mode])
  useEffect(() => {
    if (!open) return undefined
    const dialog = dialogRef.current
    const opener = document.activeElement
    const previousOverflow = document.body.style.overflow
    dialog.showModal()
    titleRef.current?.focus({ preventScroll: true })
    dialog.scrollTop = 0
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [open])
  useEffect(() => {
    if (!open) return undefined
    let active = true
    setLoading(true)
    setError('')
    cardRpc('lc_business_dashboard')
      .then(async (initial) => {
        const owned = initial.businesses.find((item) => item.id === providerId)
        if (!owned) throw new Error('FORBIDDEN')
        if (owned.suspended) throw new Error('BUSINESS_SUSPENDED')
        return owned.participating
          ? cardRpc('lc_business_dashboard', { p_provider: providerId })
          : initial
      })
      .then((data) => {
        const selected = data.businesses.find((item) => item.id === providerId)
        if (!selected) throw new Error('FORBIDDEN')
        if (selected.suspended) throw new Error('BUSINESS_SUSPENDED')
        if (active) {
          setBusiness(selected)
          setOffers(data.offers || [])
        }
      })
      .catch((err) => {
        if (active) setError(cardErrorMessage(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [open, providerId, retry])
  const close = () => {
    if (!busy) onClose()
  }
  return createPortal(
    <dialog
      ref={dialogRef}
      id="lc-create-offer"
      className="lc-offer-modal lc-page"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div className="lc-offer-modal-header">
        <div>
          <h2 id={titleId} ref={titleRef} tabIndex={-1}>
            {success
              ? operation?.mode === 'edit'
                ? '¡Oferta actualizada!'
                : '¡Oferta publicada!'
              : operation?.mode === 'edit'
                ? 'Editar oferta'
                : operation?.mode === 'replace'
                  ? 'Crear nueva versión'
                  : 'Crear oferta'}
            {success && <span aria-hidden="true"> 🎉</span>}
          </h2>
          {business && <p>{business.name}</p>}
        </div>
        <button
          type="button"
          className="lc-offer-modal-close"
          aria-label="Cerrar creación de oferta"
          disabled={busy}
          onClick={close}
        >
          ×
        </button>
      </div>
      <div className="lc-offer-modal-content">
        {loading && <p role="status">Preparando tu oferta…</p>}
        {error && (
          <div role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="lc-button lc-button--secondary"
              onClick={() => setRetry((value) => value + 1)}
            >
              Reintentar
            </button>
          </div>
        )}
        {success ? (
          <div className="lc-offer-success" role="region" aria-label="Oferta publicada">
            <LatidoOfferPreview offer={success.offer} business={displayBusiness} />
            <div className="lc-offer-success-message">
              {!CARD_MEMBERS_ENABLED ? <p>Tu oferta ya está publicada. Puedes gestionarla desde Mi negocio.</p> : success.first ? (
                <>
                  <h3>Siguiente paso: pon tu QR en la caja</h3>
                  <LatidoCardBusinessMaterial business={business} />
                </>
              ) : (
                <p>Tu QR no cambia: los clientes ya verán la nueva oferta.</p>
              )}
            </div>
          </div>
        ) : business?.published === false ? (
          <p>
            Tu negocio está pendiente de revisión. Cuando esté aprobado podrás crear tu oferta
            gratis aquí.
          </p>
        ) : (
          business && (
            <div hidden={loading || Boolean(error)}>
              <LatidoCardOfferForm
                business={displayBusiness}
                initialSelection={initialSelection}
                onStepChange={(step) => {
                  progress.current.step = step
                  if (!progress.current.started) {
                    progress.current.started = true
                    progress.current.published = false
                    trackCardEvent('form_start', { mode: operation?.mode || 'create' })
                  }
                }}
                onPublish={async (offer) => {
                  setBusy(true)
                  try {
                    if (operation?.mode === 'edit')
                      await cardRpc('lc_update_offer', {
                        p_offer_id: operation.offer.id,
                        p_offer: offer
                      })
                    else if (operation?.mode === 'replace')
                      await cardRpc('lc_replace_offer', {
                        p_old: operation.offer.id,
                        p_offer: offer
                      })
                    else await cardRpc('lc_save_offer', { p_provider: providerId, p_offer: offer })
                    progress.current.published = true
                    invalidateCardCatalog()
                    trackCardEvent('offer_published', { mode: operation?.mode || 'create' })
                    setSuccess({ offer, first: !offers.length })
                    refreshCardBusinessAccess(user?.id).catch(() => {})
                    onPublished()
                    requestAnimationFrame(() => titleRef.current?.focus())
                  } finally {
                    setBusy(false)
                  }
                }}
              />
            </div>
          )
        )}
      </div>
      {success && (
        <div className="lc-offer-success-footer">
          <Link
            className="lc-button"
            to={`/card/negocios?negocio=${providerId}`}
            onClick={close}
          >
            Ir a Mi negocio
          </Link>
        </div>
      )}
    </dialog>,
    document.body
  )
}
