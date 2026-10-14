import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ScanLine, Share2 } from 'lucide-react'
import { cardRpc, scannerLinkUrl } from '../lib/latidoCard'
import {
  cardErrorMessage,
  extractCardToken,
  readScannerConnections,
  readScannerSession,
  storeScannerSession,
  forgetScannerConnection
} from '../lib/latidoCardCore'
import { shareScannerConnection } from '../lib/latidoCardShare'
import LatidoCardQr from '../components/LatidoCardQr'
import LatidoCardOfferWizard from '../components/LatidoCardOfferWizard'
import { CardHeader, OfferConditions } from './LatidoCard'
import './LatidoCard.css'
import { useAuth } from '../hooks/useAuth'

export default function LatidoCardBusiness() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const requestedProvider = searchParams.get('negocio')
  const loadSequence = useRef(0)
  const loadedProvider = useRef(null)
  const createPanelRef = useRef(null)
  const qrStorageKey = (id) => `lc-business-qr:${user.id}:${id}`
  const cacheQr = (id, token) => {
    try {
      sessionStorage.setItem(qrStorageKey(id), token)
    } catch {}
  }
  const [provider, setProvider] = useState(''),
    [data, setData] = useState({
      businesses: [],
      offers: [],
      sessions: [],
      history: []
    })
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [link, setLink] = useState(''),
    [loading, setLoading] = useState(true)
  const [shareNotice, setShareNotice] = useState(''),
    [manualStaffLink, setManualStaffLink] = useState('')
  const [staffBusinesses, setStaffBusinesses] = useState([])
  const [staffError, setStaffError] = useState('')
  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      try {
        const connected = await cardRpc('lc_my_scanner_businesses')
        if (!cancelled) {
          setStaffBusinesses(connected)
          setStaffError('')
        }
      } catch (err) {
        if (!cancelled) setStaffError(cardErrorMessage(err))
      }
    }
    refresh()
    window.addEventListener('focus', refresh)
    return () => {
      cancelled = true
      window.removeEventListener('focus', refresh)
    }
  }, [user.id])
  const openStaffScanner = async (business) => {
    if (busy) return
    setBusy(true)
    setStaffError('')
    try {
      if (JSON.parse(sessionStorage.getItem('latido_card_pending_redemption') || 'null')?.requestId)
        throw new Error('PENDING_REDEMPTION')
      const storage = { local: localStorage, temporary: sessionStorage }
      const current = readScannerSession(storage)
      const saved = [current, ...readScannerConnections(localStorage)].find(
        (s) => s?.linked_user_id === user.id && business.session_ids.includes(s.session_id)
      )
      let next
      if (saved) {
        try {
          const valid = await cardRpc('lc_scanner_status', { p_session_token: saved.token })
          if (valid.linked_user_id !== user.id || !business.session_ids.includes(valid.session_id))
            throw new Error('FORBIDDEN')
          next = { ...saved, ...valid }
        } catch (err) {
          if (!String(err.message).includes('SCANNER_EXPIRED')) throw err
          forgetScannerConnection(saved, storage)
        }
      }
      if (!next) next = await cardRpc('lc_resume_scanner', { p_provider: business.id })
      if (next.linked_user_id !== user.id || !next.persistent || next.expires_at)
        throw new Error('FORBIDDEN')
      storeScannerSession(next, storage)
      window.location.assign('/scanner/?camera=1')
    } catch (err) {
      setStaffError(
        err.message === 'PENDING_REDEMPTION'
          ? 'Hay un canje pendiente de confirmar. Abre Scanner y confírmalo antes de cambiar de negocio.'
          : cardErrorMessage(err)
      )
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    setManualStaffLink('')
    setShareNotice('')
  }, [link])
  const load = useCallback(async () => {
    const sequence = ++loadSequence.current
    try {
      let next = await cardRpc('lc_business_dashboard', {
        p_provider: provider || null
      })
      if (sequence !== loadSequence.current) return
      setData(next)
      const chosen =
        next.businesses.find((b) => b.id === provider) ||
        next.businesses.find((b) => b.id === requestedProvider) ||
        next.businesses[0]
      const chosenId = chosen?.id || ''
      loadedProvider.current = `${user.id}:${chosenId}`
      setProvider(chosenId)
      let nextLink = ''
      if (chosenId && !chosen.suspended) {
        let cached = null
        try {
          cached = sessionStorage.getItem(qrStorageKey(chosenId))
        } catch {}
        const result = await cardRpc('lc_business_setup', {
          p_provider: chosenId,
          p_link_token: cached
        })
        cacheQr(chosenId, result.token)
        nextLink = scannerLinkUrl(result.token)
        next = await cardRpc('lc_business_dashboard', { p_provider: chosenId })
      }
      if (sequence !== loadSequence.current) return
      setData(next)
      setLink(nextLink)
      setError('')
    } catch (err) {
      if (sequence === loadSequence.current) setError(cardErrorMessage(err))
    } finally {
      if (sequence === loadSequence.current) setLoading(false)
    }
  }, [provider, user.id, requestedProvider])
  useEffect(() => {
    if (loadedProvider.current === `${user.id}:${provider}`) return
    load()
  }, [load])
  const run = async (fn) => {
    setBusy(true)
    setError('')
    try {
      await fn()
      await load()
      setStaffBusinesses(await cardRpc('lc_my_scanner_businesses'))
    } catch (err) {
      setError(cardErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  const selected = data.businesses.find((b) => b.id === provider) || data.businesses[0]
  return (
    <div className="lc-page">
      <CardHeader />
      {staffBusinesses.length > 0 && (
        <section className="lc-panel">
          <h2>Conectado a</h2>
          <p className="lc-muted">Elige el negocio donde vas a escanear tarjetas.</p>
          <div className="lc-staff-businesses">
            {staffBusinesses.map((business) => (
              <button
                key={business.id}
                className="lc-button lc-button--secondary"
                disabled={busy}
                onClick={() => openStaffScanner(business)}
              >
                <span>{business.name}</span>
                <small>Abrir Scanner</small>
              </button>
            ))}
          </div>
        </section>
      )}
      {staffError && (
        <p className="lc-alert" role="alert">
          {staffError}
        </p>
      )}
      <section className="lc-hero">
        <span className="lc-eyebrow">Negocios participantes</span>
        <h1>Más clientes para tu negocio.</h1>
        <p>Atrae a la comunidad Latido y haz que vuelva con tus ofertas.</p>
        <span className="lc-badge lc-badge--included">Participación gratuita</span>
      </section>
      {error && (
        <div className="lc-alert" role="alert">
          {error}
          <div className="lc-actions">
            <button className="lc-button lc-button--secondary" onClick={load}>
              Reintentar
            </button>
          </div>
        </div>
      )}
      {loading ? (
        <p role="status">Cargando tus negocios…</p>
      ) : selected ? (
        <section className="lc-panel lc-business-selected">
          <span className="lc-eyebrow">Mi negocio</span>
          <h2>{selected.name}</h2>
          <span className="lc-badge">
            {selected.suspended
              ? 'Suspendido'
              : selected.active
                ? 'Participando en Tarjeta Latido'
                : 'Preparando tu negocio…'}
          </span>
        </section>
      ) : (
        !error && (
          <div className="lc-panel lc-business-empty">
            <p>Registra tu negocio para ofrecer ventajas a la comunidad Latido.</p>
            <Link className="lc-button" to="/registrar-negocio">
              Registrar mi negocio
            </Link>
          </div>
        )
      )}
      {selected?.suspended && (
        <p className="lc-alert">
          Latido ha suspendido este negocio. Sus ofertas y accesos a Scanner están deshabilitados.
          Contacta con Latido para revisar el caso.
        </p>
      )}
      {selected?.active && (
        <div className="lc-layout lc-spaced">
          <section>
            <details
              className="lc-panel lc-business-fold lc-scanner-connections"
              key={`scanners-${provider}`}
            >
              <summary>
                <span>
                  <strong>Scanners vinculados</strong>
                  <small>Accesos de tus trabajadores o personal conectados a este negocio.</small>
                </span>
              </summary>
              <div className="lc-fold-body">
                <button className="lc-button lc-button--secondary" onClick={load} disabled={busy}>
                  Actualizar conexiones
                </button>
                <ul className="lc-history">
                  {data.sessions.map((s) => (
                    <li key={s.id}>
                      <strong>{s.user_name || 'Usuario sin identificar'}</strong>
                      <small>{s.label}</small>
                      {!s.user_name && (
                        <small>Vuelve a vincular este dispositivo con una cuenta de Latido.</small>
                      )}
                      <small>
                        {s.disconnected_at
                          ? 'Desconectado'
                          : s.revoked_at
                            ? 'Revocado'
                            : s.expires_at && Date.parse(s.expires_at) <= Date.now()
                              ? 'Caducado'
                              : s.persistent && !s.expires_at
                                ? 'Conexión permanente'
                                : 'Vuelve a vincular tu cuenta'}
                      </small>
                      <div className="lc-actions">
                        {!s.revoked_at && (
                          <button
                            className="lc-button lc-button--danger"
                            disabled={busy}
                            onClick={() =>
                              run(() =>
                                cardRpc('lc_manage_scanner', {
                                  p_session: s.id,
                                  p_action: 'revoke'
                                })
                              )
                            }
                          >
                            Revocar
                          </button>
                        )}
                        <button
                          className="lc-button lc-button--secondary"
                          disabled={busy}
                          onClick={() =>
                            run(() =>
                              cardRpc('lc_manage_scanner', { p_session: s.id, p_action: 'delete' })
                            )
                          }
                        >
                          Eliminar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                {!data.sessions.length && (
                  <p className="lc-muted">
                    Todavía no hay personal conectado. Comparte el QR del negocio para vincular sus
                    dispositivos.
                  </p>
                )}
              </div>
            </details>
            <div className="lc-panel">
              <h2>Últimos canjes registrados</h2>
              <p className="lc-muted">
                Son usos registrados; no representan ventas o ahorro verificados.
              </p>
              <ul className="lc-history">
                {data.history.map((r) => (
                  <li key={r.id}>
                    <strong>{r.title}</strong>
                    <small>
                      {r.scanner_label} ·{' '}
                      {new Date(r.redeemed_at).toLocaleString('es-CH', {
                        timeZone: 'Europe/Zurich'
                      })}
                      {r.reversed_at ? ' · Anulado' : ''}
                    </small>
                    {!r.reversed_at && (
                      <button
                        className="lc-button lc-button--secondary"
                        disabled={busy}
                        onClick={() => {
                          const reason = window.prompt('Motivo de la anulación:')
                          if (reason)
                            run(() =>
                              cardRpc('lc_reverse_redemption', {
                                p_redemption: r.id,
                                p_reason: reason
                              })
                            )
                        }}
                      >
                        Anular uso
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </section>
          <section>
            <details
              className="lc-panel lc-business-fold"
              key={`create-${provider}`}
              ref={createPanelRef}
            >
              <summary>
                <span>
                  <strong>Crear oferta</strong>
                  <small>Prepara una ventaja o una promoción en 3 pasos.</small>
                </span>
              </summary>
              <div className="lc-fold-body">
                <LatidoCardOfferWizard
                  key={provider}
                  businessName={selected.name}
                  onPublish={async (draft) => {
                    setBusy(true)
                    try {
                      await cardRpc('lc_save_offer', {
                        p_provider: provider,
                        p_offer: draft
                      })
                      await load()
                      if (createPanelRef.current) createPanelRef.current.open = false
                    } finally {
                      setBusy(false)
                    }
                  }}
                />
              </div>
            </details>
            {data.offers.map((o) => (
              <article key={o.id} className="lc-offer">
                <span className="lc-badge">{o.active ? 'Publicada' : 'Pausada'}</span>
                <h3>{o.title}</h3>
                <OfferConditions offer={o} />
                <button
                  className="lc-button lc-button--secondary"
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      cardRpc('lc_set_offer_active', {
                        p_offer: o.id,
                        p_active: !o.active
                      })
                    )
                  }
                >
                  {o.active ? 'Pausar' : 'Reactivar'}
                </button>
              </article>
            ))}
          </section>
        </div>
      )}
      {selected?.active && !selected.suspended && (
        <section className="lc-panel lc-business-qr">
          <h2>Tu QR de negocio para los trabajadores</h2>
          <p>
            El QR interno permite vincular Scanners de este negocio. Guárdalo donde solo tenga
            acceso el personal.
          </p>
          <button
            className="lc-button"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  'Se revocarán el QR interno y todos los Scanners actuales. ¿Generar un nuevo acceso?'
                )
              )
                run(async () => {
                  const result = await cardRpc('lc_rotate_scanner_link', {
                    p_provider: provider
                  })
                  cacheQr(provider, result.token)
                  setLink(scannerLinkUrl(result.token))
                })
            }}
          >
            Regenerar QR y revocar accesos
          </button>
          {link && (
            <div className="lc-spaced">
              <LatidoCardQr value={link} label="QR interno del negocio" />
              <h3>Código de conexión</h3>
              <p className="lc-code-display">
                {extractCardToken(link, 'scanner', window.location.origin)}
              </p>
              <div className="lc-actions">
                <button
                  className="lc-button lc-button--secondary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        extractCardToken(link, 'scanner', window.location.origin)
                      )
                      setShareNotice('Código copiado. Compártelo solo con tu personal.')
                    } catch {
                      setShareNotice(
                        'Selecciona el código de arriba para copiarlo y enviarlo a tu personal.'
                      )
                    }
                  }}
                >
                  Copiar código de conexión
                </button>
              </div>
              <div className="lc-actions lc-spaced">
                <button
                  className="lc-button lc-button--secondary"
                  disabled={busy}
                  onClick={async () => {
                    setShareNotice('')
                    setManualStaffLink('')
                    try {
                      const shared = await shareScannerConnection(link, selected.name)
                      if (shared.status === 'copied')
                        setShareNotice('Enlace copiado. Envíalo solo a tu personal.')
                      if (shared.status === 'manual') setManualStaffLink(shared.url)
                    } catch (err) {
                      setError(cardErrorMessage(err))
                    }
                  }}
                >
                  <Share2 size={18} aria-hidden="true" /> Compartir enlace con el personal
                </button>
              </div>
              {shareNotice && (
                <p className="lc-muted" role="status">
                  {shareNotice}
                </p>
              )}
              {manualStaffLink && (
                <label className="lc-form lc-spaced">
                  Enlace para el personal
                  <input readOnly value={manualStaffLink} onFocus={(e) => e.target.select()} />
                </label>
              )}
              <p className="lc-muted">
                El QR se prepara automáticamente. Compártelo solo con tus trabajadores. Regenera el
                QR para crear uno nuevo y eliminar las conexiones antiguas.
              </p>
            </div>
          )}
        </section>
      )}
      {!loading && data.businesses.length > 0 && (
        <section className="lc-panel lc-business-switcher">
          {data.businesses.length > 1 && (
            <div className="lc-form">
              <label>
                Selecciona tu negocio
                <select
                  value={provider}
                  disabled={busy}
                  onChange={(event) => {
                    loadedProvider.current = null
                    setProvider(event.target.value)
                    setLink('')
                    setData((previous) => ({
                      ...previous,
                      offers: [],
                      sessions: [],
                      history: []
                    }))
                  }}
                >
                  {data.businesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <div className="lc-actions">
            <Link className="lc-button lc-button--secondary" to="/registrar-negocio">
              Agregar otro negocio
            </Link>
          </div>
        </section>
      )}
      <a
        className="lc-scanner-fab"
        href={
          selected?.active && !selected.suspended && link
            ? `${link}?camera=1`
            : '/scanner/?camera=1'
        }
      >
        <ScanLine size={24} aria-hidden="true" /> Scanner
      </a>
    </div>
  )
}
