import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { ScanLine } from 'lucide-react'
import {
  cardErrorMessage,
  extractCardToken,
  classifyLatidoQr,
  readScannerSession,
  storeScannerSession,
  SCANNER_STORAGE_KEY,
  SCANNER_CONNECTION_KEY
} from '../lib/latidoCardCore'
import LatidoCardCamera from '../components/LatidoCardCamera'
import { offerUsageLabel, offerBenefitLabel } from '../lib/latidoCardCore'
import '../pages/LatidoCard.css'

// This client intentionally never reads or modifies the user's Supabase session.
const scannerClient = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
)
const storage = () => ({
  local: window.localStorage,
  temporary: window.sessionStorage
})
async function rpc(name, params) {
  const { data, error } = await scannerClient.rpc(name, params)
  if (error) throw error
  return data
}

export default function ScannerApp() {
  const [session, setSession] = useState(() => {
    try {
      return readScannerSession(storage())
    } catch {
      return null
    }
  })
  const sessionRef = useRef(session),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [camera, setCamera] = useState(false)
  const [input, setInput] = useState(''),
    [label, setLabel] = useState('Scanner'),
    [result, setResult] = useState(null),
    [cardToken, setCardToken] = useState(''),
    [checked, setChecked] = useState(false),
    [success, setSuccess] = useState(null),
    [install, setInstall] = useState(null)
  const pendingRef = useRef(null),
    workingRef = useRef(false)
  const launchRef = useRef({
    link: extractCardToken(window.location.pathname, 'scanner', window.location.origin),
    camera: new URLSearchParams(window.location.search).get('camera') === '1'
  })
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  const save = useCallback((next) => {
    sessionRef.current = next
    setSession(next)
    try {
      storeScannerSession(next, storage())
    } catch {
      setError(
        'El navegador no permite guardar este acceso. Será necesario volver a vincular Scanner al salir.'
      )
    }
  }, [])
  const clear = () => {
    sessionRef.current = null
    setSession(null)
    setResult(null)
    setCardToken('')
    setSuccess(null)
    setCamera(false)
    try {
      localStorage.removeItem(SCANNER_STORAGE_KEY)
      sessionStorage.removeItem(SCANNER_STORAGE_KEY)
    } catch {}
  }
  const status = useCallback(
    async (request = false) => {
      const current = sessionRef.current
      if (!current) return
      try {
        const next = await rpc('lc_scanner_status', {
          p_session_token: current.token,
          p_request_persistence: request
        })
        if (sessionRef.current?.token !== current.token) return
        save({ ...current, ...next })
      } catch (err) {
        if (sessionRef.current?.token !== current.token) return
        if (String(err.message).includes('SCANNER_EXPIRED')) {
          sessionRef.current = null
          setSession(null)
          if (!pendingRef.current) {
            setResult(null)
            setCardToken('')
            setSuccess(null)
          }
          try {
            localStorage.removeItem(SCANNER_STORAGE_KEY)
            sessionStorage.removeItem(SCANNER_STORAGE_KEY)
          } catch {}
        }
        setError(cardErrorMessage(err))
      }
    },
    [save]
  )
  useEffect(() => {
    const linked = launchRef.current.link
    if (linked) {
      setInput(linked)
    }
    if (linked || launchRef.current.camera) window.history.replaceState(null, '', '/scanner/')
    let pending = null
    try {
      pending = JSON.parse(sessionStorage.getItem('latido_card_pending_redemption') || 'null')
    } catch {}
    if (pending) {
      pendingRef.current = pending
      setCardToken(pending.cardToken)
      setResult(pending.result)
      setError(
        'Hay un canje pendiente de confirmar. Reintenta la misma operación antes de continuar.'
      )
    }
    if (pending || !(linked && launchRef.current.camera)) status()
    const interval = setInterval(() => {
      if (!workingRef.current) status()
    }, 30000)
    const onInstall = (e) => {
      e.preventDefault()
      setInstall(e)
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') status()
    }
    window.addEventListener('beforeinstallprompt', onInstall)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      window.removeEventListener('beforeinstallprompt', onInstall)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [status])
  const connect = async (raw) => {
    const token = extractCardToken(raw, 'scanner', window.location.origin)
    setCamera(false)
    if (!token) {
      setError('Utiliza el QR interno o el enlace de acceso de tu negocio.')
      return false
    }
    if (workingRef.current) return false
    if (pendingRef.current && sessionRef.current) {
      setError('Confirma el canje pendiente antes de cambiar de negocio.')
      return false
    }
    workingRef.current = true
    setBusy(true)
    setError('')
    try {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
      const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, '0')
      ).join('')
      sessionStorage.setItem(
        SCANNER_CONNECTION_KEY,
        JSON.stringify({
          token,
          label,
          fingerprint,
          created_at: Date.now()
        })
      )
      // iOS can open the Auth step in Safari outside the installed Scanner.
      // Carry the private handoff in a fragment, never in the login query/logs.
      window.location.assign(
        `/card/scanner/vincular#${new URLSearchParams({ token, label, fingerprint })}`
      )
      return false
    } catch (err) {
      setError(cardErrorMessage(err))
      return false
    } finally {
      workingRef.current = false
      setBusy(false)
    }
  }
  const read = async (raw) => {
    const token = extractCardToken(raw, 'card', window.location.origin)
    setCamera(false)
    if (!token) {
      setError('Este QR no es una Tarjeta Latido válida.')
      return
    }
    if (workingRef.current || pendingRef.current) return
    if (!sessionRef.current) {
      setError('Primero escanea el QR interno de tu negocio para conectar este dispositivo.')
      return
    }
    workingRef.current = true
    setBusy(true)
    setError('')
    setSuccess(null)
    setChecked(false)
    try {
      const data = await rpc('lc_scan_card', {
        p_session_token: sessionRef.current.token,
        p_card_token: token
      })
      setCardToken(token)
      setResult(data)
      setInput('')
    } catch (err) {
      setError(cardErrorMessage(err))
    } finally {
      workingRef.current = false
      setBusy(false)
    }
  }
  const scanQr = async (raw) => {
    setCamera(false)
    const qr = classifyLatidoQr(raw, window.location.origin)
    if (!qr) {
      setError('Escanea el QR interno de un negocio o una Tarjeta Latido.')
      return
    }
    if (qr.kind === 'scanner') await connect(qr.token)
    else await read(qr.token)
  }
  const openCamera = () => {
    if (workingRef.current || pendingRef.current) return
    setError('')
    setResult(null)
    setCardToken('')
    setChecked(false)
    setSuccess(null)
    setCamera(true)
  }
  useEffect(() => {
    const launch = launchRef.current
    if (!launch.camera || pendingRef.current) return
    let cancelled = false
    const start = async () => {
      if (launch.link && !(await connect(launch.link))) return
      if (!cancelled) setCamera(true)
    }
    start()
    return () => {
      cancelled = true
    }
  }, [])
  const redeem = async (offer) => {
    if (workingRef.current) return
    let pending = pendingRef.current
    if (!pending) {
      pending = {
        requestId: crypto.randomUUID(),
        offerId: offer.id,
        cardToken,
        result
      }
      pendingRef.current = pending
      try {
        sessionStorage.setItem('latido_card_pending_redemption', JSON.stringify(pending))
      } catch {}
    }
    workingRef.current = true
    setBusy(true)
    setError('')
    try {
      const receipt = await rpc('lc_redeem', {
        p_session_token: sessionRef.current.token,
        p_card_token: pending.cardToken,
        p_offer: pending.offerId,
        p_request_id: pending.requestId
      })
      setSuccess(receipt)
      pendingRef.current = null
      sessionStorage.removeItem('latido_card_pending_redemption')
      setResult(null)
      setCardToken('')
      setChecked(false)
    } catch (err) {
      // A transport failure may follow a successful commit. Keep its request ID.
      const definitive = [
        'OFFER_UNAVAILABLE',
        'CARD_INVALID',
        'MEMBERSHIP_INACTIVE',
        'REQUEST_CONFLICT'
      ].some((code) => String(err.message).includes(code))
      if (definitive) {
        pendingRef.current = null
        sessionStorage.removeItem('latido_card_pending_redemption')
        setResult(null)
        setCardToken('')
      }
      setError(cardErrorMessage(err))
    } finally {
      workingRef.current = false
      setBusy(false)
    }
  }
  return (
    <main className="lc-page lc-scanner">
      <header className="lc-top">
        <a className="lc-brand" href="/scanner/">
          <img src="/favicon.svg" alt="" />
          Latido Scanner
        </a>
        <a className="lc-muted" href="/card/negocios">
          Mi negocio
        </a>
      </header>
      {error && (
        <p className="lc-alert" role="alert">
          {error}
        </p>
      )}
      {!session ? (
        <section className="lc-panel lc-scanner-start">
          <span className="lc-eyebrow">Personal del establecimiento</span>
          <h1>Escanea y conecta.</h1>
          <p>
            {input && launchRef.current.link
              ? 'Tu enlace de negocio está listo. Pulsa Scanner para conectar y escanear tarjetas.'
              : 'Empieza con el QR de tu negocio. Después, escanea las tarjetas de tus clientes.'}
          </p>
          <div className="lc-actions">
            <button
              className="lc-button lc-button--large"
              disabled={busy || !!pendingRef.current}
              onClick={async () => {
                if (input && launchRef.current.link) {
                  if (await connect(input)) setCamera(true)
                } else openCamera()
              }}
            >
              <ScanLine size={24} aria-hidden="true" /> Scanner
            </button>
          </div>
          <p className="lc-muted">
            Vincula el dispositivo con tu cuenta de Latido. Si todavía no tienes cuenta, crea una
            gratis al conectar. No necesitas una membresía de pago.
          </p>
          <details className="lc-spaced">
            <summary>Vincular con un enlace o poner nombre al dispositivo</summary>
            <form
              className="lc-form"
              onSubmit={(e) => {
                e.preventDefault()
                connect(input)
              }}
            >
              <label>
                Nombre de este Scanner
                <input maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} />
              </label>
              <label>
                Enlace interno del negocio
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Pega el enlace del QR"
                  autoComplete="off"
                />
              </label>
              <button className="lc-button" disabled={busy || !input}>
                {busy ? 'Vinculando…' : 'Continuar en navegador'}
              </button>
            </form>
          </details>
        </section>
      ) : (
        <>
          <p className="lc-eyebrow">{session.business_name}</p>
          <p className="lc-muted">
            {session.user_name || 'Dispositivo anterior sin usuario identificado'} ·{' '}
            {session.persistent && !session.expires_at
              ? 'Conexión permanente'
              : 'Vuelve a vincular tu cuenta'}
          </p>
          {success && (
            <section className="lc-alert lc-success" role="status">
              <h2>{success.reversed ? 'Este canje fue anulado' : '✓ Ventaja utilizada'}</h2>
              <p>
                {success.reversed
                  ? 'Consulta al propietario antes de aplicar la ventaja.'
                  : 'Ya puedes aplicar la ventaja en tu caja o entregar el beneficio.'}
              </p>
              <button
                className="lc-button"
                onClick={() => {
                  setSuccess(null)
                  setCamera(true)
                }}
              >
                Siguiente cliente
              </button>
            </section>
          )}
          {!result && !success && (
            <>
              <button className="lc-button lc-button--large" disabled={busy} onClick={openCamera}>
                <ScanLine size={24} aria-hidden="true" /> {busy ? 'Consultando…' : 'Scanner'}
              </button>
              <p className="lc-muted lc-scanner-hint">
                Escanea una tarjeta de cliente o el QR de otro negocio.
              </p>
            </>
          )}
          {result && (
            <section className="lc-spaced">
              <div className="lc-panel">
                <span className="lc-badge">Membresía activa</span>
                <h2>
                  {result.member_name} · Socio #{result.member_number}
                </h2>
                <p>
                  {result.offers.length
                    ? `${result.offers.length} ventajas disponibles en este negocio.`
                    : 'No hay ventajas disponibles para este socio en tu negocio.'}
                </p>
              </div>
              {!pendingRef.current && !!result.offers.length && (
                <label className="lc-check">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setChecked(e.target.checked)}
                  />
                  He comprobado la compra mínima y las condiciones. Aplicaré una sola ventaja en
                  esta operación.
                </label>
              )}
              {result.offers
                .filter((o) => !pendingRef.current || o.id === pendingRef.current.offerId)
                .map((o) => (
                  <article className="lc-offer lc-spaced" key={o.id}>
                    <span className="lc-badge">
                      {o.requires_claim ? 'Promoción reclamada' : 'Ventaja incluida'}
                    </span>
                    <h3>{o.title}</h3>
                    <p>{o.description || offerBenefitLabel(o)}</p>
                    <small>
                      {Number(o.minimum_spend) > 0 && (
                        <>
                          Compras desde CHF {Number(o.minimum_spend)}
                          <br />
                        </>
                      )}
                      {offerUsageLabel(o)} · No acumulable.
                    </small>
                    <button
                      className="lc-button"
                      disabled={busy || (!checked && !pendingRef.current)}
                      onClick={() => redeem(o)}
                    >
                      {busy
                        ? 'Confirmando…'
                        : pendingRef.current
                          ? 'Reintentar el mismo canje'
                          : 'Canjear'}
                    </button>
                  </article>
                ))}
              {!pendingRef.current && (
                <button
                  className="lc-button lc-button--secondary"
                  disabled={busy}
                  onClick={() => {
                    setResult(null)
                    setCardToken('')
                    setCamera(true)
                  }}
                >
                  Otra tarjeta
                </button>
              )}
            </section>
          )}
          {!pendingRef.current && (
            <div className="lc-actions lc-spaced">
              <button
                className="lc-button lc-button--secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    await rpc('lc_close_scanner', {
                      p_session_token: sessionRef.current.token
                    })
                    clear()
                  } catch (err) {
                    setError(cardErrorMessage(err))
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                Desconectar este dispositivo
              </button>
            </div>
          )}
        </>
      )}
      {camera && <LatidoCardCamera onRead={scanQr} onClose={() => setCamera(false)} />}
      {session && !camera && (result || success) && (
        <button
          className="lc-scanner-fab"
          disabled={busy || !!pendingRef.current}
          onClick={openCamera}
        >
          <ScanLine size={24} aria-hidden="true" /> Scanner
        </button>
      )}
      {!standalone && (
        <section className="lc-panel lc-spaced">
          <h2>Instalar Latido Scanner</h2>
          <p>Guárdalo en la pantalla de inicio para abrirlo directamente.</p>
          {install ? (
            <button
              className="lc-button lc-button--secondary"
              onClick={async () => {
                await install.prompt()
                setInstall(null)
              }}
            >
              Instalar Scanner
            </button>
          ) : (
            <p className="lc-muted">
              En iPhone: Safari → Compartir → Añadir a pantalla de inicio. En Android: menú del
              navegador → Instalar aplicación. Si la instalación abre un acceso sin vincular,
              escanea de nuevo el QR interno del negocio.
            </p>
          )}
        </section>
      )}
    </main>
  )
}
