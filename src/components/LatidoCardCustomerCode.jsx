import { useEffect, useState } from 'react'
import { cardRpc } from '../lib/latidoCard'
import { cardErrorMessage } from '../lib/latidoCardCore'

export default function LatidoCardCustomerCode() {
  const [value, setValue] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [expired, setExpired] = useState(false)
  useEffect(() => {
    if (!value) return
    const timer = setTimeout(
      () => {
        setValue(null)
        setExpired(true)
      },
      Math.max(0, Date.parse(value.expires_at) - Date.now())
    )
    return () => clearTimeout(timer)
  }, [value])
  return (
    <div className="lc-client-code">
      {value ? (
        <>
          <small>Código para el personal</small>
          <output aria-label="Código del cliente">
            {value.code.slice(0, 5)} {value.code.slice(5)}
          </output>
          <small>
            Válido hasta{' '}
            {new Date(value.expires_at).toLocaleTimeString('es-CH', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Europe/Zurich'
            })}
          </small>
        </>
      ) : (
        <>
          <button
            className="lc-button lc-button--secondary"
            disabled={busy}
            onClick={async () => {
              if (busy) return
              setBusy(true)
              setError('')
              try {
                const next = await cardRpc('lc_issue_card_code')
                if (!/^\d{10}$/.test(next?.code) || !Number.isFinite(Date.parse(next.expires_at)))
                  throw new Error('INVALID_CODE_RESPONSE')
                setValue(next)
                setExpired(false)
              } catch (err) {
                setError(cardErrorMessage(err))
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? 'Preparando código…' : expired ? 'Generar otro código' : 'Mostrar código'}
          </button>
          <small>
            {expired ? 'El código ha caducado.' : 'Para consultar tu tarjeta sin cámara.'}
          </small>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
