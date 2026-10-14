import { useEffect, useRef, useState } from 'react'
import { extractCardToken } from '../lib/latidoCardCore'

export default function LatidoCardConnectionCode({ onConnect, onClose, busy }) {
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
      className="lc-camera lc-code-dialog"
      aria-labelledby="lc-code-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <h2 id="lc-code-title">Conectar con código</h2>
      <p>Pide al encargado del negocio que comparta el código de conexión contigo.</p>
      <p className="lc-muted">El código se encuentra debajo del QR en el apartado «Mi negocio».</p>
      <form
        className="lc-form"
        onSubmit={(event) => {
          event.preventDefault()
          const token = extractCardToken(code, 'scanner', window.location.origin)
          if (!token) {
            setError('Pega el código completo o el enlace de conexión que te han compartido.')
            return
          }
          setError('')
          onConnect(token)
        }}
      >
        <label>
          Código de conexión
          <textarea
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Pega aquí el código"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            required
            rows={3}
            disabled={busy}
          />
        </label>
        {error && (
          <p className="lc-alert" role="alert">
            {error}
          </p>
        )}
        <div className="lc-actions">
          <button className="lc-button" disabled={busy || !code.trim()}>
            {busy ? 'Conectando…' : 'Conectar'}
          </button>
          <button
            type="button"
            className="lc-button lc-button--secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
        </div>
      </form>
      <p className="lc-muted">
        Necesitas una cuenta gratuita de Latido. No necesitas suscribirte al club.
      </p>
    </dialog>
  )
}
