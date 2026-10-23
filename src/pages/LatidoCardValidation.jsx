import { useCallback, useEffect, useRef, useState } from 'react'
import LinkedText from '../components/LinkedText'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { cardRpc } from '../lib/latidoCard'
import {
  cardErrorMessage,
  offerUsageLabel,
  remainingValidationSeconds
} from '../lib/latidoCardCore'
import './LatidoCard.css'
import './LatidoCardValidation.css'

export default function LatidoCardValidation() {
  const { redemptionId } = useParams()
  const { user } = useAuth()
  const [receipt, setReceipt] = useState(null),
    [verifiedAt, setVerifiedAt] = useState(null)
  const [error, setError] = useState(''),
    [checking, setChecking] = useState(true),
    [now, setNow] = useState(performance.now())
  const sequence = useRef(0)
  const check = useCallback(async () => {
    const current = ++sequence.current
    setChecking(true)
    const started = performance.now()
    try {
      const result = await cardRpc('lc_validation', { p_redemption: redemptionId })
      if (current !== sequence.current) return
      // Subtract round-trip time as well, so a slow response never extends validity.
      setReceipt(result)
      setVerifiedAt(started)
      setNow(performance.now())
      setError('')
    } catch (err) {
      if (current === sequence.current) {
        setReceipt(null)
        setError(cardErrorMessage(err))
      }
    } finally {
      if (current === sequence.current) setChecking(false)
    }
  }, [redemptionId, user?.id])
  useEffect(() => {
    setReceipt(null)
    check()
    const clock = setInterval(() => setNow(performance.now()), 1000)
    const verify = setInterval(check, 30000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') check()
      else {
        ++sequence.current
        setChecking(true)
      }
    }
    const onOffline = () => {
      ++sequence.current
      setReceipt(null)
      setChecking(false)
      setError('Conéctate a internet para comprobar el descuento.')
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', check)
    window.addEventListener('online', check)
    window.addEventListener('offline', onOffline)
    return () => {
      ++sequence.current
      clearInterval(clock)
      clearInterval(verify)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', check)
      window.removeEventListener('online', check)
      window.removeEventListener('offline', onOffline)
    }
  }, [check])
  const seconds = remainingValidationSeconds(receipt, verifiedAt, now)
  const valid = !checking && !error && seconds > 0
  const offer = receipt?.offer
  const vibrated = useRef(null)
  useEffect(() => {
    if (valid && vibrated.current !== redemptionId) {
      vibrated.current = redemptionId
      try {
        navigator.vibrate?.(40)
      } catch {}
    }
  }, [valid, redemptionId])
  useEffect(() => {
    if (!receipt?.valid || error || seconds <= 0) return
    let active = true,
      lock = null,
      requesting = false
    const acquire = async () => {
      if (
        !active ||
        requesting ||
        lock ||
        document.visibilityState !== 'visible' ||
        !navigator.wakeLock
      )
        return
      requesting = true
      try {
        const requested = await navigator.wakeLock.request('screen')
        if (!active || document.visibilityState !== 'visible') await requested.release()
        else {
          lock = requested
          requested.addEventListener('release', () => {
            if (lock === requested) lock = null
          })
        }
      } catch {
      } finally {
        requesting = false
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') acquire()
      else {
        const previous = lock
        lock = null
        previous?.release().catch(() => {})
      }
    }
    acquire()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      active = false
      document.removeEventListener('visibilitychange', onVisibility)
      lock?.release().catch(() => {})
    }
  }, [receipt?.valid, redemptionId, Boolean(error), seconds > 0])
  const benefit = offer?.benefit_type
  const discount =
    benefit === 'percent'
      ? `${Number(offer.benefit_value)}%`
      : benefit === 'fixed'
        ? `CHF ${Number(offer.benefit_value)}`
        : benefit === 'two_for_one'
          ? '2×1'
          : benefit === 'service'
            ? 'Servicio'
            : 'Regalo'
  const discountText =
    benefit === 'percent' || benefit === 'fixed'
      ? 'de descuento'
      : benefit === 'two_for_one'
        ? ''
        : 'incluido'
  const serverDate =
    receipt && Number.isFinite(verifiedAt)
      ? new Date(Date.parse(receipt.server_now) + Math.max(0, now - verifiedAt))
      : null
  const serverDateTime =
    receipt && Number.isFinite(verifiedAt)
      ? new Intl.DateTimeFormat('es-CH', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: 'Europe/Zurich'
        }).format(serverDate)
      : ''
  return (
    <main
      className={`lc-page lc-validation ${valid ? 'lc-validation--valid' : ''} ${valid && seconds <= 60 ? 'lc-validation--ending' : ''}`}
    >
      <Link className="lc-brand" to="/card">
        <img src="/favicon.svg" alt="" /> Latido Club
      </Link>
      <div className="lc-proof-frame">
        <section className="lc-proof" aria-labelledby="lc-proof-title" aria-busy={checking}>
          {valid ? (
            <>
              <span className="lc-proof-status" role="status">
                <span aria-hidden="true" />
                Descuento válido
              </span>
              <div className="lc-proof-label lc-proof-business-label">Descuento en</div>
              <h1 id="lc-proof-title">{receipt.business_name}</h1>
              <p className="lc-proof-offer-title">{offer.title}</p>
              <div className="lc-proof-discount">
                <strong className="lc-proof-amount" data-kind={benefit}>
                  {discount}
                </strong>
                {discountText && <span>{discountText}</span>}
              </div>
              <span className="lc-proof-chip">
                {Number(receipt.offer.minimum_spend) > 0
                  ? `Desde CHF ${Number(receipt.offer.minimum_spend)}`
                  : 'Sin compra mínima'}
              </span>
              <p
                className="lc-proof-conditions"
                tabIndex={0}
                aria-label="Condiciones del descuento"
              >
                <LinkedText>{offer.description || offerUsageLabel(offer)}</LinkedText>
              </p>
              <div className="lc-proof-tear" aria-hidden="true" />
              <div className="lc-proof-seal" aria-hidden="true">
                <div>
                  <img src="/favicon.svg" alt="" />
                </div>
              </div>
              <div className="lc-proof-label lc-proof-timer-label">Válido durante</div>
              <div
                className="lc-proof-timer"
                role="timer"
                aria-live="off"
                aria-label="Tiempo restante"
              >
                {String(Math.floor(seconds / 60)).padStart(2, '0')}:
                {String(seconds % 60).padStart(2, '0')}
              </div>
              <div className="lc-proof-timer-bar" aria-hidden="true">
                <div style={{ width: `${Math.min(100, (seconds / 300) * 100)}%` }} />
              </div>
              <p className="lc-proof-instruction">Muestra esta pantalla al personal</p>
              <div className="lc-proof-meta">
                <span>
                  Socio <strong>{receipt.member_reference}</strong>
                </span>
                <time dateTime={serverDate?.toISOString()}>{serverDateTime}</time>
              </div>
              <div className="lc-proof-stripe" aria-hidden="true" />
            </>
          ) : (
            <>
              <h1 id="lc-proof-title">
                {checking
                  ? 'Comprobando descuento…'
                  : error
                    ? 'No se puede validar'
                    : receipt?.reversed
                      ? 'Uso anulado'
                      : 'Validación finalizada'}
              </h1>
              {error ? (
                <p role="alert">{error}</p>
              ) : (
                !checking && (
                  <p>
                    Esta pantalla ya no sirve para obtener el beneficio. El uso permanece en tu
                    historial.
                  </p>
                )
              )}
              {!checking && error && (
                <button className="lc-button" onClick={check}>
                  Comprobar conexión
                </button>
              )}
            </>
          )}
        </section>
      </div>
      <Link className="lc-button lc-button--secondary" to="/card">
        Volver a mi tarjeta
      </Link>
    </main>
  )
}
