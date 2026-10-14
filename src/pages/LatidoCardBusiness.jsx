import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ScanLine } from 'lucide-react'
import { cardRpc, scannerLinkUrl } from '../lib/latidoCard'
import { cardErrorMessage } from '../lib/latidoCardCore'
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
            <details className="lc-panel lc-business-fold" key={`scanners-${provider}`}>
              <summary>
                <span>
                  <strong>Scanners vinculados</strong>
                  <small>Accesos de tus trabajadores o personal conectados a este negocio.</small>
                </span>
              </summary>
              <div className="lc-fold-body">
                <button className="lc-button lc-button--secondary" onClick={load} disabled={busy}>
                  Actualizar solicitudes
                </button>
                <ul className="lc-history">
                  {data.sessions.map((s) => (
                    <li key={s.id}>
                      <strong>{s.label}</strong>
                      <small>
                        {s.revoked_at
                          ? 'Revocado'
                          : s.persistent
                            ? 'Acceso habitual'
                            : Date.parse(s.expires_at) <= Date.now()
                              ? 'Caducado'
                              : `Turno hasta ${new Date(s.expires_at).toLocaleTimeString('es-CH', { timeZone: 'Europe/Zurich' })}`}
                      </small>
                      {!s.revoked_at && (
                        <div className="lc-actions">
                          {s.persistence_requested &&
                            !s.persistent &&
                            Date.parse(s.expires_at) > Date.now() && (
                              <button
                                className="lc-button"
                                disabled={busy}
                                onClick={() =>
                                  run(() =>
                                    cardRpc('lc_manage_scanner', {
                                      p_session: s.id,
                                      p_action: 'approve'
                                    })
                                  )
                                }
                              >
                                Autorizar acceso habitual
                              </button>
                            )}
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
                        </div>
                      )}
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
              <p className="lc-secret">{link}</p>
              <p className="lc-muted">
                El QR se prepara automáticamente. Compártelo solo con tus trabajadores. Los QR
                impresos siguen siendo válidos hasta que regeneres el acceso o Latido suspenda el
                negocio.
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
      {selected?.active && !selected.suspended && link && (
        <a className="lc-scanner-fab" href={`${link}?camera=1`}>
          <ScanLine size={24} aria-hidden="true" /> Scanner
        </a>
      )}
    </div>
  )
}
