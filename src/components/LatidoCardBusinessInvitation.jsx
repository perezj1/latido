import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
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
    return <p role="status">✅ Tu oferta ya está publicada en Tarjeta Latido.</p>
  const create = (selection) => {
    if (onCreate) onCreate(displayBusiness, selection)
    else openOffer(displayBusiness, selection)
    if (modal) onDismiss()
  }
  const content = (
    <section className="lc-business-invitation" aria-labelledby={titleId}>
      <div className="lc-invitation-visual">
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
        <h2 id={titleId} ref={titleRef} tabIndex={modal ? -1 : undefined}>
          {CARD_INVITATION_TITLE}
        </h2>
        <p>{CARD_INVITATION_DESCRIPTION}</p>
        <p className="lc-invitation-choose" id={`${titleId}-choose`}>
          ¿Qué quieres ofrecer?
        </p>
        <div className="lc-invitation-quick" role="group" aria-labelledby={`${titleId}-choose`}>
          {[
            ['10 %', { type: 'percent', value: '10' }],
            ['2x1', { type: 'combo' }],
            ['Regalo', { type: 'gift' }],
            ['Otro', { type: 'other' }]
          ].map(([label, selection]) => (
            <button key={label} type="button" onClick={() => create(selection)}>
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="lc-business-invitation-cta" onClick={() => create()}>
          Crear mi oferta
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
