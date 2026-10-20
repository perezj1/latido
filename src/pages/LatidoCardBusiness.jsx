import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { MapPin, Pencil, Share2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { shareCardOffer } from '../lib/latidoCardShare'
import { cardRpc } from '../lib/latidoCard'
import { cardErrorMessage, offerUsageLabel } from '../lib/latidoCardCore'
import { liveOffers, offerState } from '../lib/latidoCardExperience'
import { offerToDraft } from '../lib/latidoCardOfferDraft'
import { trackCardEvent } from '../lib/analytics'
import { invalidateCardCatalog } from '../lib/latidoCardCatalog'
import { useLatidoCardOffer } from '../components/LatidoCardOfferProvider'
import LatidoCardBusinessMaterial from '../components/LatidoCardBusinessMaterial'
import LatidoCardBusinessImage from '../components/LatidoCardBusinessImage'
import { OfferBenefitBadge, OfferBrandStripe } from '../components/LatidoOfferVisual'
import { CardHeader } from './LatidoCard'
import './LatidoCard.css'
import { CARD_MEMBERS_ENABLED } from '../lib/latidoCardLaunch'

const activityDate = (value) =>
  new Date(value).toLocaleString('es-CH', {
    timeZone: 'Europe/Zurich',
    dateStyle: 'short',
    timeStyle: 'short'
  })

export default function LatidoCardBusiness() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { openOffer, revision } = useLatidoCardOffer()
  const provider = params.get('negocio') || ''
  const [data, setData] = useState({ businesses: [], offers: [], history: [] })
  const [error, setError] = useState(''),
    [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true)
  const [historyLimit, setHistoryLimit] = useState(20)
  const [reversal, setReversal] = useState(null),
    [reason, setReason] = useState('')
  const generation = useRef(0),
    lock = useRef(false)
  const refresh = useCallback(async () => {
    const version = ++generation.current
    const initial = await cardRpc('lc_business_dashboard')
    const selected = initial.businesses.find((b) => b.id === provider) || initial.businesses[0]
    const canLoadOffers = selected?.participating && !selected.suspended
    // Preserve the business identity if loading its offers fails. Only load
    // offer management for businesses that have joined and are not suspended.
    if (version === generation.current) {
      setData((current) => ({
        ...initial,
        offers: canLoadOffers && current.selectedProvider === selected.id ? current.offers : [],
        history: canLoadOffers && current.selectedProvider === selected.id ? current.history : [],
        selectedProvider: selected?.id || ''
      }))
    }
    const detail = canLoadOffers
      ? await cardRpc('lc_business_dashboard', { p_provider: selected.id })
      : initial
    if (version === generation.current) {
      setData({ ...detail, selectedProvider: selected?.id || '' })
      setError('')
    }
  }, [provider])
  useEffect(() => {
    let live = true
    setLoading(true)
    setReversal(null)
    setHistoryLimit(20)
    refresh()
      .catch((err) => {
        if (live) setError(cardErrorMessage(err))
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
      ++generation.current
    }
  }, [refresh, revision])
  useEffect(() => {
    trackCardEvent('business_visit')
  }, [])
  const run = async (action) => {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await action()
      invalidateCardCatalog()
      await refresh()
    } catch (err) {
      setError(cardErrorMessage(err))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  const business = data.businesses.find((b) => b.id === data.selectedProvider) || data.businesses[0]
  return (
    <div className="lc-page lc-member-page lc-business-page lc-app-page">
      <CardHeader />
      {error && business && (
        <p className="lc-muted" role="alert">
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
      ) : error && !business ? (
        <section className="lc-panel lc-business-current" role="alert">
          <h1>No pudimos cargar tu negocio</h1>
          <p>{error}</p>
          <button className="lc-button" type="button" onClick={() => {
            setLoading(true)
            refresh().catch((err) => setError(cardErrorMessage(err))).finally(() => setLoading(false))
          }}>Reintentar</button>
        </section>
      ) : !business ? (
        <section className="lc-panel lc-business-current">
          <span className="lc-eyebrow">Participación gratuita</span>
          <h1>Tu negocio y la comunidad, más cerca.</h1>
          <p>
            Promociona tu negocio gratis y atrae más clientes de la comunidad. Publica tu negocio
            y crea tu primera oferta con tus propias condiciones.
          </p>
          <Link className="lc-button" to="/registrar-negocio?origen=tarjeta">
            Registrar mi negocio
          </Link>
        </section>
      ) : (
        <>
          <section className="lc-panel lc-business-current">
            <div className="lc-business-profile-row">
              <LatidoCardBusinessImage
                business={business}
                offers={data.offers}
                className="lc-business-profile-logo"
              />
              <div>
                <h1>{business.name}</h1>
                <p className="lc-business-profile-meta">
                  {business.city && (
                    <span>
                      <MapPin size={14} aria-hidden="true" />
                      {business.city}
                    </span>
                  )}
                  <span className="lc-badge">
                    {business.suspended
                      ? 'Participación suspendida'
                      : business.published === false
                        ? 'Pendiente de revisión'
                        : 'Publicado'}
                  </span>
                </p>
              </div>
            </div>
            <div className="lc-business-profile-actions">
              <Link
                className="lc-button lc-button--secondary"
                to={'/perfil?editar=business:' + business.id}
              >
                <Pencil size={16} aria-hidden="true" />
                Editar negocio
              </Link>
            </div>
            <div className="lc-form lc-spaced">
              <label>
                Negocio que quieres gestionar
                <select
                  aria-label="Negocio que quieres gestionar"
                  value={business.id}
                  disabled={busy}
                  onChange={(e) => {
                    if (e.target.value === 'add') navigate('/registrar-negocio?origen=tarjeta')
                    else setParams({ negocio: e.target.value })
                  }}
                >
                  {data.businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                  <option value="add">＋ Agregar un negocio</option>
                </select>
              </label>
            </div>
          </section>
          {business.suspended ? (
            <p className="lc-alert">
              Latido ha retirado este negocio del programa. Contacta con Latido para revisar su
              participación.
            </p>
          ) : business.published === false ? (
            <p className="lc-panel">
              Tu negocio está pendiente de revisión. Cuando esté aprobado, podrás publicar tu
              primera oferta gratis aquí.
            </p>
          ) : (
            <>
              <section
                className="lc-panel lc-spaced"
                id="lc-published-offers"
                aria-labelledby="lc-published-offers-title"
              >
                <div className="lc-business-section-heading">
                  <h2 id="lc-published-offers-title">Tus ofertas</h2>
                  <span className="lc-muted">
                    {data.offers.filter((offer) => offerState(offer) === 'Activa').length} activas
                  </span>
                </div>
                {!data.offers.length && (
                  <p>Tu primera oferta empieza con un descuento para tu comunidad.</p>
                )}
                <div className="lc-managed-offers">
                  {data.offers.map((offer) => (
                    <article className="lc-managed-offer lc-coupon" key={offer.id}>
                      <div className="lc-managed-offer-head">
                        <OfferBenefitBadge offer={offer} />
                        <div className="lc-managed-offer-info">
                          <div className="lc-managed-offer-title">
                            <h3>{offer.title}</h3>
                            <span className="lc-badge" data-state={offerState(offer)}>
                              {offerState(offer)}
                            </span>
                          </div>
                          <p>{offerUsageLabel(offer)}</p>
                          {offer.requires_claim && (
                            <p className="lc-managed-offer-limit">
                              Promoción limitada
                              {offer.remaining != null ? ' · Quedan ' + offer.remaining : ''}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="lc-managed-offer-meta lc-coupon-footer">
                        <button
                          className="lc-text-button"
                          disabled={busy}
                          onClick={() =>
                            openOffer(business, offerToDraft(offer), {
                              mode: offer.has_activity ? 'replace' : 'edit',
                              offer
                            })
                          }
                        >
                          <Pencil size={15} aria-hidden="true" />
                          Editar
                        </button>
                        <button
                          className="lc-text-button"
                          onClick={async () => {
                            try {
                              const result = await shareCardOffer({
                                ...offer,
                                provider_id: business.id,
                                business_name: business.name
                              })
                              if (result.status === 'copied')
                                toast.success('Enlace de la oferta copiado.')
                              if (result.status === 'manual')
                                setNotice('Enlace público de la oferta: ' + result.url)
                            } catch {
                              toast.error('No se pudo compartir la oferta. Vuelve a intentarlo.')
                            }
                          }}
                        >
                          <Share2 size={15} aria-hidden="true" />
                          Compartir
                        </button>
                        <details className="lc-action-menu">
                          <summary aria-label={`Acciones de ${offer.title}`}>⋯</summary>
                          <div>
                            <button
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
                            {CARD_MEMBERS_ENABLED && !offer.active && (
                              <button
                                disabled={busy}
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      '¿Borrar este descuento? Sus usos anteriores se conservarán en el historial.'
                                    )
                                  )
                                    run(async () => {
                                      await cardRpc('lc_delete_offer', { p_offer: offer.id })
                                      setNotice('Descuento borrado. El historial se conserva.')
                                    })
                                }}
                              >
                                Borrar
                              </button>
                            )}
                          </div>
                        </details>
                      </div>
                      <OfferBrandStripe />
                    </article>
                  ))}
                </div>
              </section>
              {CARD_MEMBERS_ENABLED && <section
                className="lc-business-summary lc-panel"
                aria-label="Resultados de tu negocio"
              >
                <h2>Resultados</h2>
                {data.summary ? (
                  <div className="lc-business-month-result">
                    <p>Descuentos usados este mes en tu negocio</p>
                    <strong>{data.summary.month_uses}</strong>
                  </div>
                ) : (
                  <p className="lc-muted">
                    El resumen estará disponible al actualizar el servicio de Tarjeta Latido.
                  </p>
                )}
              </section>}
              {CARD_MEMBERS_ENABLED && <section className="lc-panel lc-spaced" aria-labelledby="lc-activity-title">
                <h2 id="lc-activity-title">Actividad</h2>
                <p className="lc-muted">Usos que los socios han mostrado en tu negocio.</p>
                {!data.history.length && <p>Aquí verás los primeros usos de tus ofertas.</p>}
                <ul className="lc-history">
                  {data.history.slice(0, historyLimit).map((item) => (
                    <li key={item.id}>
                      <strong>{item.title}</strong>
                      <small>
                        {activityDate(item.redeemed_at)} · {item.member_reference || '••••'}
                      </small>
                      <small>{item.reversed_at ? 'Anulado' : 'Registrado'}</small>
                      {!item.reversed_at && (
                        <details className="lc-action-menu">
                          <summary aria-label={`Acciones del uso de ${item.title}`}>⋯</summary>
                          <div>
                            <button
                              onClick={() => {
                                setReversal(item.id)
                                setReason('')
                              }}
                            >
                              Anular uso
                            </button>
                          </div>
                        </details>
                      )}
                    </li>
                  ))}
                </ul>
                {data.history.length > historyLimit && (
                  <button
                    className="lc-button lc-button--secondary"
                    onClick={() => setHistoryLimit((n) => n + 20)}
                  >
                    Ver más
                  </button>
                )}
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
                        autoFocus
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
              </section>}
              {CARD_MEMBERS_ENABLED && <details className="lc-panel lc-spaced">
                <summary>Material para tu local</summary>
                {liveOffers(data.offers).length ? (
                  <LatidoCardBusinessMaterial key={business.id} business={business} />
                ) : (
                  <p>Publica tu primera oferta para obtener tu QR.</p>
                )}
              </details>}
            </>
          )}
        </>
      )}
      {!loading && business && !business.suspended && business.published !== false && (
        <div className="lc-business-create-bar">
          <button
            className="lc-button"
            aria-haspopup="dialog"
            disabled={busy}
            onClick={() => openOffer(business)}
          >
            <span aria-hidden="true">+</span> Crear oferta
          </button>
        </div>
      )}
    </div>
  )
}
