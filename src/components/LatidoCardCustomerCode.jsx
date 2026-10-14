import { useEffect, useRef, useState } from 'react'
import { cardRpc } from '../lib/latidoCard'
import { cardErrorMessage } from '../lib/latidoCardCore'

export default function LatidoCardCustomerCode() {
  const [value, setValue] = useState(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [expired, setExpired] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const request = useRef(null)
  useEffect(() => {
    let stopped = false,
      refreshing = false,
      expiryTimer
    let wasHidden = document.visibilityState === 'hidden'
    const openCode = async (reuse = false) => {
      if (stopped || refreshing || document.visibilityState === 'hidden') return
      refreshing = true
      clearTimeout(expiryTimer)
      setBusy(true)
      setValue(null)
      setExpired(false)
      setError('')
      // React StrictMode replays this effect; reuse its initial request rather
      // than generating two codes and displaying one already revoked.
      if (!reuse || !request.current) request.current = cardRpc('lc_issue_card_code')
      try {
        const next = await request.current
        if (stopped) return
        if (!/^\d{6}$/.test(next?.code) || !Number.isFinite(Date.parse(next.expires_at)))
          throw new Error('INVALID_CODE_RESPONSE')
        setValue(next)
        // Expiry does not issue a replacement; reopening or the button does.
        expiryTimer = setTimeout(
          () => setExpired(true),
          Math.max(0, Date.parse(next.expires_at) - Date.now())
        )
      } catch (err) {
        if (!stopped) {
          request.current = null
          setError(cardErrorMessage(err))
        }
      } finally {
        refreshing = false
        if (!stopped) setBusy(false)
      }
    }
    openCode(true)
    const onVisible = () => {
      if (document.visibilityState === 'hidden') wasHidden = true
      else if (wasHidden) {
        wasHidden = false
        openCode()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      clearTimeout(expiryTimer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [attempt])
  return (
    <div className="lc-client-code">
      {value ? (
        <>
          <small>Código para el personal</small>
          <output aria-label="Código del cliente">
            {value.code.slice(0, 3)} {value.code.slice(3)}
          </output>
          <small>
            {expired
              ? 'Código caducado.'
              : `Válido hasta ${new Date(value.expires_at).toLocaleTimeString('es-CH', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'Europe/Zurich'
                })}`}
          </small>
          {expired && (
            <button
              className="lc-button lc-button--secondary"
              disabled={busy}
              onClick={() => {
                if (busy) return
                setBusy(true)
                request.current = null
                setAttempt((n) => n + 1)
              }}
            >
              Generar nuevo código
            </button>
          )}
        </>
      ) : busy ? (
        <p role="status">Preparando código…</p>
      ) : null}
      {error && (
        <>
          <p role="alert">{error}</p>
          <button
            className="lc-button lc-button--secondary"
            disabled={busy}
            onClick={() => setAttempt((n) => n + 1)}
          >
            Reintentar código
          </button>
        </>
      )}
    </div>
  )
}
