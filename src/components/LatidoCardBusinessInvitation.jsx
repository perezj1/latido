import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Check, Eye } from 'lucide-react'
import { useLatidoCardOffer } from './LatidoCardOfferProvider'
import { useLatidoBusinessDisplay } from '../hooks/useLatidoBusinessDisplay'
import LatidoOfferPreview from './LatidoOfferVisual'
import { CARD_INVITATION_TITLE, CARD_INVITATION_DESCRIPTION } from '../lib/latidoCardInvitation'
import './LatidoCardBusinessInvitation.css'

export default function LatidoCardBusinessInvitation({
  business,
  onCreate,
  onDismiss,
  modal = false
}) {
  const titleId = useId()
  const dialogRef = useRef(null)
  const titleRef = useRef(null)
  const { openOffer, publishedProvider } = useLatidoCardOffer()
  const displayBusiness = useLatidoBusinessDisplay(business)
  useEffect(() => {
    if (!modal) return undefined
    const opener = document.activeElement
    const dialog = dialogRef.current
    dialog.showModal()
    titleRef.current?.focus({ preventScroll: true })
    dialog.scrollTop = 0
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = overflow
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [modal])
  if (!modal && publishedProvider === business.id)
    return <p role="status">✅ Tu descuento ya está publicado en Tarjeta Latido.</p>
  const content = (
    <section className="lc-business-invitation" aria-labelledby={titleId}>
      <div className="lc-invitation-visual">
        <span className="lc-invitation-example-label">
          <Eye size={13} aria-hidden="true" />
          Así te verán los socios · Ejemplo
        </span>
        <LatidoOfferPreview
          business={displayBusiness}
          example
          offer={{
            title: '10 % de descuento',
            benefit_type: 'percent',
            benefit_value: 10,
            usage_period: 'month',
            usage_limit: 1
          }}
        />
      </div>
      <div className="lc-invitation-content">
        <ol className="lc-invitation-steps" aria-label="Pasos">
          <li>
            <span className="lc-invitation-step-done">
              <Check size={13} aria-hidden="true" />
            </span>
            Publicado
          </li>
          <li aria-current="step">
            <span>2</span>Tu descuento
          </li>
        </ol>
        <h2 id={titleId} ref={titleRef} tabIndex={modal ? -1 : undefined}>
          {CARD_INVITATION_TITLE}
        </h2>
        <p>{CARD_INVITATION_DESCRIPTION}</p>
        <button
          type="button"
          className="lc-business-invitation-cta"
          onClick={() => {
            if (onCreate) onCreate(displayBusiness)
            else openOffer(displayBusiness)
            if (modal) onDismiss()
          }}
        >
          Crear mi descuento
        </button>
        <p className="lc-invitation-reassurance">
          <span>
            <Check size={15} aria-hidden="true" />
            Gratis
          </span>
          <span>
            <Check size={15} aria-hidden="true" />
            Tú pones las condiciones
          </span>
        </p>
        {onDismiss && (
          <button type="button" className="lc-business-invitation-later" onClick={onDismiss}>
            Lo haré más tarde
          </button>
        )}
      </div>
    </section>
  )
  if (!modal) return content
  return createPortal(
    <dialog
      ref={dialogRef}
      className="lc-business-invitation-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onDismiss()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss()
      }}
    >
      {content}
    </dialog>,
    document.body
  )
}
