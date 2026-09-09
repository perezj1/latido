import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import PuntoHispanoContactForm from './PuntoHispanoContactForm'

export default function PuntoHispanoContactModal({ open, placement, initialCategory = '', onClose }) {
  useEffect(() => {
    if (!open) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = event => { if (event.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="ph-contact-modal-overlay" role="dialog" aria-modal="true" aria-label="Contactar con Punto Hispano" onClick={onClose}>
      <section className="ph-contact-modal" onClick={event => event.stopPropagation()}>
        <button type="button" className="ph-contact-modal-close" aria-label="Cerrar" onClick={onClose}>×</button>
        <PuntoHispanoContactForm compact placement={placement} initialCategory={initialCategory} />
      </section>
    </div>,
    document.body,
  )
}
