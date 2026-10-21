import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Check, Eye, Gift, Sparkles } from 'lucide-react'
import { useLatidoCardOffer } from './LatidoCardOfferProvider'
import { useLatidoBusinessDisplay } from '../hooks/useLatidoBusinessDisplay'
import LatidoOfferPreview from './LatidoOfferVisual'
import { CARD_INVITATION_DESCRIPTION } from '../lib/latidoCardInvitation'
import './LatidoCardBusinessInvitation.css'

export default function LatidoCardBusinessInvitation({
  business,
  onCreate,
  onDismiss,
  modal = false,
  headingLevel = 2
}) {
  const Heading = `h${headingLevel}`
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
    return <p role="status">✅ Tu oferta ya está publicada en Latido Club.</p>
  const create = (selection) => {
    if (onCreate) onCreate(displayBusiness, selection)
    else openOffer(displayBusiness, selection)
    if (modal) onDismiss()
  }
  const content = (
    <div className="lc-business-invitation-wrap">
    <section className="lc-business-invitation" aria-labelledby={titleId}>
      <div className="lc-invitation-visual">
        {business.published !== false && (
          <p className="lc-invitation-status">
            <span className="lc-invitation-status-icon" aria-hidden="true">
              <Check size={11} strokeWidth={3.2} />
            </span>
            Tu negocio ya está publicado
          </p>
        )}
        <Heading className="lc-invitation-title" id={titleId} ref={titleRef} tabIndex={modal ? -1 : undefined}>
          Atrae más clientes
        </Heading>
        <p className="lc-invitation-description">{CARD_INVITATION_DESCRIPTION}</p>
        <p className="lc-invitation-preview-label">
          <Eye size={14} aria-hidden="true" />
          Así te verán los socios
        </p>
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
        <p className="lc-invitation-choose" id={`${titleId}-choose`}>
          ¿Qué quieres ofrecer?
        </p>
        <div className="lc-invitation-quick" role="group" aria-labelledby={`${titleId}-choose`}>
          {[
            ['%', 'Descuento', 'Ej.: 10 % menos', 'blue', { type: 'percent', value: '10' }],
            ['CHF', 'Cantidad fija', 'Ej.: 5 CHF menos', 'amber', { type: 'fixed', value: '5' }],
            ['2x1', '2x1 o similar', 'Ej.: 2x1, 3x2', 'pink', { type: 'combo' }],
            [<Gift size={17} />, 'Regalo', 'Ej.: café gratis', 'green', { type: 'gift' }],
            [
              <Sparkles size={17} />,
              'Otro beneficio',
              'Ej.: primera consulta gratis, primer mes 50 % de descuento',
              'purple',
              { type: 'other' }
            ]
          ].map(([icon, label, description, tone, selection]) => (
            <button
              key={label}
              type="button"
              className={selection.type === 'other' ? 'lc-invitation-option--wide' : undefined}
              onClick={() => create(selection)}
            >
              <span className={`lc-invitation-option-icon lc-invitation-option-icon--${tone}`} aria-hidden="true">{icon}</span>
              <span className="lc-invitation-option-copy">
                <strong>{label}</strong>
                <span>{description}</span>
              </span>
            </button>
          ))}
        </div>
        <button type="button" className="lc-business-invitation-cta" onClick={() => create()}>
          Crear mi oferta
        </button>
        <p className="lc-invitation-reassurance">
          <span>
            <Check size={15} strokeWidth={2.6} aria-hidden="true" />
            Gratis
          </span>
          <span>
            <Check size={15} strokeWidth={2.6} aria-hidden="true" />
            Tú pones las condiciones
          </span>
        </p>
      </div>
    </section>
    {onDismiss && (
      <button type="button" className="lc-business-invitation-later" onClick={onDismiss}>
        Lo haré más tarde
      </button>
    )}
    </div>
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
