import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { cardRpc, scannerLinkUrl } from '../lib/latidoCard'
import { cardErrorMessage } from '../lib/latidoCardCore'
import LatidoCardQr from '../components/LatidoCardQr'
import { CardHeader, OfferConditions } from './LatidoCard'
import './LatidoCard.css'
import { useAuth } from '../hooks/useAuth'

const initialOffer = {
  title: '',
  description: '',
  benefit_type: 'percent',
  benefit_value: '10',
  minimum_spend: '0',
  requires_claim: false,
  stock_total: '',
  claim_days: 7,
  usage_period: 'month',
  usage_limit: 1,
  ends_at: ''
}
export default function LatidoCardBusiness() {
  const { user } = useAuth()
  const loadSequence = useRef(0)
  const qrStorageKey = (id) => `lc-business-qr:${user.id}:${id}`
  const cacheQr = (id, token) => {
    try {
      sessionStorage.setItem(qrStorageKey(id), token)
    } catch {}
  }
  const [provider, setProvider] = useState(''),
    [data, setData] = useState({ businesses: [], offers: [], sessions: [], history: [] })
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [link, setLink] = useState(''),
    [offer, setOffer] = useState(initialOffer),
    [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    const sequence = ++loadSequence.current
    try {
      let next = await cardRpc('lc_business_dashboard', { p_provider: provider || null })
      let nextLink = ''
      if (provider && !next.businesses.find((b) => b.id === provider)?.suspended) {
        let cached = null
        try {
          cached = sessionStorage.getItem(qrStorageKey(provider))
        } catch {}
        const result = await cardRpc('lc_business_setup', {
          p_provider: provider,
          p_link_token: cached
        })
        cacheQr(provider, result.token)
        nextLink = scannerLinkUrl(result.token)
        next = await cardRpc('lc_business_dashboard', { p_provider: provider })
      }
      if (sequence !== loadSequence.current) return
      setData(next)
      setLink(nextLink)
      if (!provider && next.businesses.length) setProvider(next.businesses[0].id)
      setError('')
    } catch (err) {
      if (sequence === loadSequence.current) setError(cardErrorMessage(err))
    } finally {
      if (sequence === loadSequence.current) setLoading(false)
    }
  }, [provider, user.id])
  useEffect(() => {
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
  const selected = data.businesses.find((b) => b.id === provider)
  const set = (key, value) => setOffer((prev) => ({ ...prev, [key]: value }))
  return (
    <div className="lc-page">
      <CardHeader />
      <section className="lc-hero">
        <span className="lc-eyebrow">Negocios participantes</span>
        <h1>Más clientes para tu negocio.</h1>
        <p>Atrae a la comunidad Latido y haz que vuelva con tus ofertas.</p>
        <span className="lc-badge lc-badge--included">Participación gratuita</span>
        <div className="lc-actions">
          <a className="lc-button lc-button--secondary" href="/scanner/">
            Abrir Latido Scanner
          </a>
        </div>
      </section>
      {error && (
        <p className="lc-alert" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Cargando tus negocios…</p>
      ) : (
        <div className="lc-form">
          <label>
            Selecciona tu negocio
            <select
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value)
                setLink('')
                setData((prev) => ({ ...prev, offers: [], sessions: [], history: [] }))
              }}
            >
              <option value="">Seleccionar…</option>
              {data.businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.suspended ? ' · Suspendido por Latido' : ''}
                </option>
              ))}
            </select>
          </label>
          <Link className="lc-button lc-button--secondary" to="/registrar-negocio">
            ➕ Agregar un negocio
          </Link>
          {!data.businesses.length && (
            <p>
              Todavía no tienes negocios. <Link to="/registrar-negocio">Registrar un negocio</Link>.
            </p>
          )}
        </div>
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
            <div className="lc-panel">
              <h2>Scanners vinculados</h2>
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
                              cardRpc('lc_manage_scanner', { p_session: s.id, p_action: 'revoke' })
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
            </div>
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
            <div className="lc-panel">
              <h2>Crear una ventaja</h2>
              <p className="lc-muted">
                Una ventaja incluida y hasta dos promociones especiales vigentes. Si una oferta
                tiene reservas o canjes, sus condiciones quedan fijadas.
              </p>
              <form
                className="lc-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  run(async () => {
                    await cardRpc('lc_save_offer', {
                      p_provider: provider,
                      p_offer: {
                        ...offer,
                        benefit_value: ['percent', 'fixed'].includes(offer.benefit_type)
                          ? offer.benefit_value
                          : null,
                        ends_at: new Date(offer.ends_at).toISOString()
                      }
                    })
                    setOffer(initialOffer)
                  })
                }}
              >
                <label>
                  Título
                  <input
                    required
                    minLength={3}
                    maxLength={120}
                    value={offer.title}
                    onChange={(e) => set('title', e.target.value)}
                  />
                </label>
                <label>
                  Condiciones
                  <textarea
                    maxLength={2000}
                    value={offer.description}
                    onChange={(e) => set('description', e.target.value)}
                  />
                </label>
                <label>
                  Tipo de ventaja
                  <select
                    value={offer.benefit_type}
                    onChange={(e) => set('benefit_type', e.target.value)}
                  >
                    <option value="percent">Porcentaje</option>
                    <option value="fixed">Descuento en CHF</option>
                    <option value="gift">Regalo</option>
                    <option value="service">Servicio</option>
                    <option value="two_for_one">2 × 1</option>
                  </select>
                </label>
                {['percent', 'fixed'].includes(offer.benefit_type) && (
                  <label>
                    {offer.benefit_type === 'percent' ? 'Porcentaje' : 'Descuento CHF'}
                    <input
                      required
                      type="number"
                      min="0.01"
                      max={offer.benefit_type === 'percent' ? 100 : undefined}
                      step="0.01"
                      value={offer.benefit_value}
                      onChange={(e) => set('benefit_value', e.target.value)}
                    />
                  </label>
                )}
                <label>
                  Compra mínima CHF
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={offer.minimum_spend}
                    onChange={(e) => set('minimum_spend', e.target.value)}
                  />
                </label>
                <label className="lc-check">
                  <input
                    type="checkbox"
                    checked={offer.requires_claim}
                    onChange={(e) =>
                      setOffer((prev) => ({
                        ...prev,
                        requires_claim: e.target.checked,
                        usage_period: e.target.checked ? 'lifetime' : 'month',
                        usage_limit: 1,
                        stock_total: ''
                      }))
                    }
                  />
                  Promoción especial que requiere reclamar
                </label>
                {offer.requires_claim ? (
                  <>
                    <label>
                      Unidades disponibles
                      <input
                        required
                        type="number"
                        min="1"
                        value={offer.stock_total}
                        onChange={(e) => set('stock_total', e.target.value)}
                      />
                    </label>
                    <label>
                      Días para usar la reserva
                      <input
                        type="number"
                        min="1"
                        max="90"
                        value={offer.claim_days}
                        onChange={(e) => set('claim_days', Number(e.target.value))}
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <label>
                      Frecuencia
                      <select
                        value={offer.usage_period}
                        onChange={(e) => set('usage_period', e.target.value)}
                      >
                        <option value="month">Por mes natural</option>
                        <option value="lifetime">Una vez en total</option>
                        <option value="unlimited">Sin límite</option>
                      </select>
                    </label>
                    {offer.usage_period !== 'unlimited' && (
                      <label>
                        Usos permitidos
                        <input
                          type="number"
                          min="1"
                          max="1000"
                          value={offer.usage_limit}
                          onChange={(e) => set('usage_limit', Number(e.target.value))}
                        />
                      </label>
                    )}
                  </>
                )}
                <label>
                  Válido hasta (hora local)
                  <input
                    required
                    type="datetime-local"
                    value={offer.ends_at}
                    onChange={(e) => set('ends_at', e.target.value)}
                  />
                </label>
                <button className="lc-button" disabled={busy}>
                  Publicar ventaja
                </button>
              </form>
            </div>
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
                      cardRpc('lc_set_offer_active', { p_offer: o.id, p_active: !o.active })
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
    </div>
  )
}
