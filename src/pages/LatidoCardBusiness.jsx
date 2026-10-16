import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Share2, Printer, Copy } from 'lucide-react'
import { cardRpc, businessCardUrl } from '../lib/latidoCard'
import { cardErrorMessage } from '../lib/latidoCardCore'
import { shareCardBusiness } from '../lib/latidoCardShare'
import LatidoCardQr from '../components/LatidoCardQr'
import { useLatidoCardOffer } from '../components/LatidoCardOfferProvider'
import LatidoCardBusinessInvitation from '../components/LatidoCardBusinessInvitation'
import { CardHeader, OfferConditions, cardDate } from './LatidoCard'
import './LatidoCard.css'

export default function LatidoCardBusiness() {
  const [params] = useSearchParams()
  const { openOffer, revision } = useLatidoCardOffer()
  const [provider, setProvider] = useState('')
  const [data, setData] = useState({ businesses: [], offers: [], history: [] })
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true)
  const generation = useRef(0),
    lock = useRef(false)
  const publicLinkRef = useRef(null)
  const [copiedLink, setCopiedLink] = useState('')
  const [businessView, setBusinessView] = useState(null)
  useEffect(() => {
    setBusinessView(null)
  }, [provider])
  useEffect(() => {
    if (businessView) {
      document.getElementById('lc-published-offers-title')?.focus({ preventScroll: true })
    }
  }, [businessView])
  const [reversal, setReversal] = useState(null),
    [reason, setReason] = useState('')
  const refresh = useCallback(async () => {
    const version = ++generation.current
    const initial = await cardRpc('lc_business_dashboard')
    const selected =
      initial.businesses.find((b) => b.id === (provider || params.get('negocio'))) ||
      initial.businesses[0]
    if (!selected) {
      if (version === generation.current) setData(initial)
      return
    }
    const detail = await cardRpc('lc_business_dashboard', { p_provider: selected.id })
    if (version === generation.current) {
      setData(detail)
      setProvider(selected.id)
    }
  }, [provider, params])
  useEffect(() => {
    setLoading(true)
    refresh()
      .catch((err) => setError(cardErrorMessage(err)))
      .finally(() => setLoading(false))
    return () => {
      ++generation.current
    }
  }, [refresh, revision])
  const run = async (action) => {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await action()
      await refresh()
    } catch (err) {
      setError(cardErrorMessage(err))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  const business = data.businesses.find((b) => b.id === provider)
  const qrUrl = provider ? businessCardUrl(provider) : ''
  const copyPublicLink = async () => {
    try {
      await navigator.clipboard.writeText(qrUrl)
    } catch {
      const input = publicLinkRef.current
      input?.focus()
      input?.select()
      input?.setSelectionRange(0, input.value.length)
      try {
        if (!document.execCommand('copy')) throw new Error('Copy unavailable')
      } catch {
        setNotice('El enlace está seleccionado. Usa Copiar en el menú de tu dispositivo.')
        return
      }
    }
    setCopiedLink(qrUrl)
  }
  return (
    <div className="lc-page lc-member-page">
      <CardHeader />
      {!loading && !business && (
        <section className="lc-hero lc-business-hero">
          <span className="lc-eyebrow">Negocios participantes</span>
          <h1>Tu negocio y la comunidad, más cerca.</h1>
          <p>
            Ofrece descuentos a la comunidad Latido. El cliente muestra su pantalla y tú aplicas el
            beneficio.
          </p>
          <span className="lc-badge lc-badge--success">Participación gratuita</span>
        </section>
      )}
      {error && (
        <p className="lc-alert" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="lc-alert lc-success" role="status">
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status">Cargando tu negocio…</p>
      ) : !business ? (
        <section className="lc-panel lc-business-current">
          <p>Registra tu negocio para ofrecer descuentos a la comunidad Latido.</p>
          <Link className="lc-button" to="/registrar-negocio">
            Registrar mi negocio
          </Link>
        </section>
      ) : (
        <>
          <section className="lc-panel lc-business-current">
            <span className="lc-eyebrow">Mi negocio</span>
            <h1>{business.name}</h1>
            <span className="lc-badge">
              {business.suspended
                ? 'Participación suspendida'
                : business.active
                  ? 'Participando en Tarjeta Latido'
                  : 'Publica tu primer descuento'}
            </span>
            {!business.suspended && (
              <div className="lc-business-management-actions">
                <button
                  type="button"
                  className="lc-button lc-button--secondary"
                  aria-controls="lc-published-offers"
                  aria-expanded={businessView === 'offers'}
                  onClick={() =>
                    setBusinessView((current) => (current === 'offers' ? null : 'offers'))
                  }
                >
                  Mis ofertas
                </button>
                <button
                  type="button"
                  className="lc-button"
                  aria-controls="lc-create-offer"
                  aria-haspopup="dialog"
                  onClick={() => openOffer(business)}
                >
                  Crear oferta
                </button>
              </div>
            )}
          </section>
          {!business.suspended && !data.offers.length && businessView === null && (
            <LatidoCardBusinessInvitation
              business={business}
                onCreate={(target, selection) => openOffer(target, selection)}
            />
          )}
          {business.suspended ? (
            <p className="lc-alert">
              Latido ha retirado este negocio del programa. Contacta con Latido para revisar su
              participación.
            </p>
          ) : (
            <>
              <section
                className="lc-panel lc-spaced"
                id="lc-published-offers"
                aria-labelledby="lc-published-offers-title"
                hidden={businessView !== 'offers'}
              >
                <h2 id="lc-published-offers-title" tabIndex={-1}>
                  Tus ofertas
                </h2>
                {!data.offers.length && <p>Aún no has publicado descuentos.</p>}
                {data.offers.map((offer) => (
                  <article className="lc-offer" key={offer.id}>
                    <h3>{offer.title}</h3>
                    <OfferConditions offer={offer} />
                    <small>El cliente activa y confirma el descuento al comprar.</small>
                    <div className="lc-actions">
                      <button
                        className="lc-button lc-button--secondary"
                        disabled={busy}
                        onClick={() =>
                          run(() =>
                            cardRpc('lc_set_offer_active', {
                              p_offer: offer.id,
                              p_active: !offer.active
                            })
                          )
                        }
                      >
                        {offer.active ? 'Pausar' : 'Reactivar'}
                      </button>
                      {!offer.active && (
                        <button
                          className="lc-button lc-button--danger"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                '¿Borrar este descuento? Sus usos anteriores se conservarán en el historial.'
                              )
                            ) {
                              run(async () => {
                                await cardRpc('lc_delete_offer', { p_offer: offer.id })
                                setNotice('Descuento borrado. El historial se conserva.')
                              })
                            }
                          }}
                        >
                          Borrar
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </section>
              <section className="lc-panel lc-business-qr">
                <h2>El QR de tu negocio</h2>
                <p>
                  Muestra a los clientes los descuentos de tu negocio. Colócalo en un sitio visible
                  o compártelo.
                </p>
                <div className="lc-business-sticker" id="lc-business-sticker">
                  <strong>TARJETA LATIDO</strong>
                  <h3>{business.name}</h3>
                  <LatidoCardQr value={qrUrl} label={`QR público de ${business.name}`} />
                  <strong className="lc-business-sticker-caption">
                    Escanea para obtener descuentos
                  </strong>
                </div>
                <div className="lc-qr-actions">
                  <button className="lc-button" onClick={() => window.print()}>
                    <Printer size={18} />
                    Imprimir
                  </button>
                  <button
                    className="lc-button lc-button--secondary"
                    onClick={async () => {
                      const result = await shareCardBusiness(provider, business.name)
                      if (result.status === 'copied') setNotice('Enlace del negocio copiado.')
                      if (result.status === 'manual')
                        setNotice('Copia el enlace público que aparece debajo del QR.')
                    }}
                  >
                    <Share2 size={18} />
                    Compartir
                  </button>
                </div>
                <div className="lc-public-link">
                  <label htmlFor="lc-public-business-link">Enlace público</label>
                  <div className="lc-public-link-row">
                    <input
                      id="lc-public-business-link"
                      ref={publicLinkRef}
                      readOnly
                      value={qrUrl}
                      onFocus={(e) => e.target.select()}
                    />
                    <button
                      type="button"
                      className="lc-button lc-button--secondary"
                      aria-label="Copiar enlace público"
                      onClick={copyPublicLink}
                    >
                      <Copy size={16} aria-hidden="true" />
                      <span role="status">{copiedLink === qrUrl ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}
          <details className="lc-panel lc-spaced">
            <summary>Últimos usos registrados</summary>
            <p className="lc-muted">
              Los clientes registran el uso al mostrar el descuento. Estos datos no acreditan ventas
              ni descuentos aplicados en caja.
            </p>
            <ul className="lc-history">
              {data.history.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  <small>
                    {cardDate(item.redeemed_at)} · {item.reversed_at ? 'Anulado' : 'Uso registrado'}
                  </small>
                  {!item.reversed_at && (
                    <button
                      className="lc-text-button"
                      onClick={() => {
                        setReversal(item.id)
                        setReason('')
                      }}
                    >
                      Anular uso
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {reversal && (
              <form
                className="lc-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  run(async () => {
                    await cardRpc('lc_reverse_redemption', {
                      p_redemption: reversal,
                      p_reason: reason
                    })
                    setReversal(null)
                    setNotice('Uso anulado.')
                  })
                }}
              >
                <label>
                  Motivo de la anulación
                  <input
                    required
                    minLength={3}
                    maxLength={500}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <div className="lc-actions">
                  <button className="lc-button lc-button--danger" disabled={busy}>
                    Confirmar anulación
                  </button>
                  <button
                    type="button"
                    className="lc-button lc-button--secondary"
                    onClick={() => setReversal(null)}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </details>
        </>
      )}
      {data.businesses.length > 1 && (
        <div className="lc-form lc-spaced">
          <label>
            Selecciona el negocio que quieres gestionar
            <select
              value={provider}
              disabled={busy || loading}
              onChange={(e) => {
                setProvider(e.target.value)
                setError('')
                setReversal(null)
              }}
            >
              {data.businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {!!data.businesses.length && (
        <div className="lc-actions lc-spaced">
          <Link className="lc-button lc-button--secondary" to="/registrar-negocio">
            ＋ Agregar un negocio
          </Link>
        </div>
      )}
    </div>
  )
}
