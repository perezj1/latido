import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import { cardRpc } from '../lib/latidoCard'
import { cardErrorMessage } from '../lib/latidoCardCore'
import LatidoCardOfferForm from './LatidoCardOfferForm'
import { useLatidoBusinessDisplay } from '../hooks/useLatidoBusinessDisplay'
import '../pages/LatidoCard.css'
import './LatidoCardOfferModal.css'

export default function LatidoCardOfferModal({ providerId, open, onClose, onPublished }) {
  const dialogRef = useRef(null),
    titleRef = useRef(null)
  const titleId = useId()
  const [business, setBusiness] = useState(null)
  const displayBusiness = useLatidoBusinessDisplay(business)
  const [loading, setLoading] = useState(false),
    [error, setError] = useState('')
  const [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0)
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
    cardRpc('lc_business_dashboard', { p_provider: providerId })
      .then((data) => {
        const selected = data.businesses.find((item) => item.id === providerId)
        if (!selected) throw new Error('FORBIDDEN')
        if (selected.suspended) throw new Error('BUSINESS_SUSPENDED')
        if (active) setBusiness(selected)
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
            Crear descuento
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
        {business && (
          <div hidden={loading || Boolean(error)}>
            <LatidoCardOfferForm
              business={displayBusiness}
              onPublish={async (offer) => {
                setBusy(true)
                try {
                  await cardRpc('lc_save_offer', { p_provider: providerId, p_offer: offer })
                  toast.success('Descuento publicado. Ya está disponible para la comunidad.')
                  onPublished()
                } finally {
                  setBusy(false)
                }
              }}
            />
          </div>
        )}
      </div>
    </dialog>,
    document.body
  )
}
