import { useEffect, useRef, useState } from 'react'
import { cardErrorMessage } from '../lib/latidoCardCore'

export default function LatidoCardManualEntry({ onRead, onClose, busy }) {
  const dialog = useRef(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    dialog.current.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])
  return (
    <dialog
      ref={dialog}
      className="lc-camera"
      aria-labelledby="lc-manual-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <h2 id="lc-manual-title">Introducir manualmente</h2>
      <p>Pide al cliente que abra «Mi tarjeta» y pulse «Mostrar código».</p>
      <form
        className="lc-form"
        onSubmit={async (event) => {
          event.preventDefault()
          const normalized = code.replace(/[\s-]/g, '')
          if (!/^\d{10}$/.test(normalized)) {
            setError('Introduce las 10 cifras del código del cliente.')
            return
          }
          setError('')
          try {
            await onRead(normalized)
            onClose()
          } catch (err) {
            setError(cardErrorMessage(err))
          }
        }}
      >
        <label>
          Código del cliente
          <input
            className="lc-manual-code-input"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="12345 67890"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            maxLength={15}
            disabled={busy}
            required
          />
        </label>
        {error && (
          <p className="lc-alert" role="alert">
            {error}
          </p>
        )}
        <div className="lc-actions">
          <button className="lc-button" disabled={busy || !code.trim()}>
            {busy ? 'Consultando…' : 'Consultar tarjeta'}
          </button>
          <button
            className="lc-button lc-button--secondary"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
        </div>
      </form>
      <p className="lc-muted">El código dura 5 minutos. No necesitas la cámara.</p>
    </dialog>
  )
}
