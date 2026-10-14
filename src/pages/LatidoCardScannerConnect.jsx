import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { cardRpc } from '../lib/latidoCard'
import {
  cardErrorMessage,
  SCANNER_CONNECTION_KEY,
  readScannerSession,
  storeScannerSession
} from '../lib/latidoCardCore'
import './LatidoCard.css'

// Only this authenticated app page creates a connection. The operational
// Scanner keeps its own token and never imports the personal Auth client.
export default function LatidoCardScannerConnect() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [handoffReady, setHandoffReady] = useState(() => !window.location.hash)
  const [request] = useState(() => {
    try {
      const fragment = new URLSearchParams(window.location.hash.slice(1))
      if (fragment.has('token')) {
        const token = fragment.get('token'),
          fingerprint = fragment.get('fingerprint')
        if (!/^[a-f0-9]{64}$/.test(token) || !/^[a-f0-9]{64}$/.test(fingerprint)) return null
        return {
          token,
          fingerprint,
          label: (fragment.get('label') || 'Scanner').slice(0, 80),
          created_at: Date.now()
        }
      }
      const value = JSON.parse(sessionStorage.getItem(SCANNER_CONNECTION_KEY) || 'null')
      if (/^[a-f0-9]{64}$/.test(value?.token) && value.created_at > Date.now() - 3600000)
        return value
    } catch {}
    return null
  })
  const [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0)
  const operation = useRef(null)
  useEffect(() => {
    if (!handoffReady) {
      try {
        if (request) sessionStorage.setItem(SCANNER_CONNECTION_KEY, JSON.stringify(request))
        navigate('/card/scanner/vincular', { replace: true })
        setHandoffReady(true)
      } catch {
        setError('Permite el almacenamiento del navegador para continuar con la conexión.')
      }
      return
    }
    if (!authLoading && !user && request) {
      navigate(`/auth?${new URLSearchParams({ mode: 'login', next: '/card/scanner/vincular' })}`, {
        replace: true
      })
    }
  }, [handoffReady, request, authLoading, user?.id, navigate])
  useEffect(() => {
    if (!request || !user?.id || authLoading || !handoffReady) return
    try {
      const pending = JSON.parse(sessionStorage.getItem('latido_card_pending_redemption') || 'null')
      if (pending?.requestId) {
        setError(
          'Hay un canje pendiente de confirmar. Vuelve a Scanner antes de cambiar de conexión.'
        )
        return
      }
    } catch {}
    let cancelled = false
    if (!operation.current || operation.current.userId !== user.id) {
      operation.current = {
        userId: user.id,
        promise: (async () => {
          // Reuse only for the same account and business, with server validation.
          // A different signed-in user must never inherit the previous user's name.
          const current = readScannerSession({ local: localStorage, temporary: sessionStorage })
          if (
            current?.linked_user_id === user.id &&
            current.link_fingerprint === request.fingerprint
          ) {
            try {
              const next = await cardRpc('lc_scanner_status', { p_session_token: current.token })
              return { ...current, ...next }
            } catch (err) {
              if (!String(err.message).includes('SCANNER_EXPIRED')) throw err
            }
          }
          return cardRpc('lc_open_scanner', {
            p_link_token: request.token,
            p_label: request.label || 'Scanner'
          })
        })()
      }
    }
    setError('')
    operation.current.promise
      .then((next) => {
        if (cancelled) return
        try {
          // Fail visibly on an old database: never promise a permanent identified
          // connection while the required migration is missing.
          if (!next.persistent || next.expires_at || next.linked_user_id !== user.id) {
            throw new Error('SCANNER_ACCOUNTS_MIGRATION_REQUIRED')
          }
          storeScannerSession(
            { ...next, link_fingerprint: request.fingerprint },
            {
              local: localStorage,
              temporary: sessionStorage
            }
          )
          sessionStorage.removeItem(SCANNER_CONNECTION_KEY)
          window.location.replace('/scanner/?camera=1')
        } catch (err) {
          setError(
            err.message === 'SCANNER_ACCOUNTS_MIGRATION_REQUIRED'
              ? 'La conexión permanente todavía no está habilitada en este servidor. Contacta con Latido.'
              : 'No se pudo guardar la conexión. Permite el almacenamiento del navegador y reintenta.'
          )
        }
      })
      .catch((err) => {
        if (!cancelled) {
          operation.current = null
          setError(cardErrorMessage(err))
        }
      })
    return () => {
      cancelled = true
    }
  }, [request, user?.id, attempt, authLoading, handoffReady])
  return (
    <main className="lc-page lc-scanner">
      <section className="lc-panel lc-scanner-start">
        <span className="lc-eyebrow">Latido Scanner</span>
        <h1>Conectar con tu cuenta</h1>
        {!request ? (
          <p role="alert">Escanea de nuevo el QR de tu negocio para conectar este dispositivo.</p>
        ) : error ? (
          <p className="lc-alert" role="alert">
            {error}
          </p>
        ) : (
          <p role="status">Vinculando tu cuenta al negocio…</p>
        )}
        <p>
          Tu nombre aparecerá en los accesos del negocio. La conexión se mantiene hasta que se
          revoque o desconectes este dispositivo.
        </p>
        <div className="lc-actions">
          {error && (
            <button className="lc-button" onClick={() => setAttempt((value) => value + 1)}>
              Reintentar
            </button>
          )}
          {error && (
            <Link className="lc-button lc-button--secondary" to="/perfil">
              Mi perfil
            </Link>
          )}
          <a className="lc-button lc-button--secondary" href="/scanner/">
            Volver a Scanner
          </a>
        </div>
      </section>
    </main>
  )
}
