import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, useSearchParams } from 'react-router-dom'
import { Share2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { cardRpc, cardUrl } from '../lib/latidoCard'
import { cardErrorMessage, offerBenefitLabel, offerUsageLabel } from '../lib/latidoCardCore'
import { shareCardOffer } from '../lib/latidoCardShare'
import LatidoCardQr from '../components/LatidoCardQr'
import LatidoCardPhysicalRequest from '../components/LatidoCardPhysicalRequest'
import './LatidoCard.css'

export function CardHeader() {
  const { isAdmin } = useAuth()
  return (
    <header className="lc-top">
      <Link className="lc-brand" to="/card">
        <img src="/favicon.svg" alt="" />
        Tarjeta Latido
      </Link>
      <nav className="lc-links" aria-label="Navegación de Tarjeta Latido">
        <Link to="/perfil">
          <span aria-hidden="true">👤</span> Mi perfil
        </Link>
        <NavLink to="/card" end>
          <span aria-hidden="true">💳</span> Mi tarjeta
        </NavLink>
        <NavLink to="/card/negocios">
          <span aria-hidden="true">🏪</span> Mi negocio
        </NavLink>
        {isAdmin && (
          <NavLink to="/card/admin">
            <span aria-hidden="true">🛠️</span> Administración
          </NavLink>
        )}
      </nav>
    </header>
  )
}
export function OfferConditions({ offer }) {
  return (
    <>
      <p>{offer.description || offerBenefitLabel(offer)}</p>
      <small>
        {Number(offer.minimum_spend) > 0 && <>Compras desde CHF {Number(offer.minimum_spend)} · </>}
        {offerUsageLabel(offer)}
        <br />
        Válido hasta{' '}
        {new Date(offer.ends_at).toLocaleDateString('es-CH', { timeZone: 'Europe/Zurich' })}
        <br />
        No acumulable con otras ventajas Latido.
      </small>
    </>
  )
}
const offerIcons = { percent: '🎟️', fixed: '🛍️', gift: '🎁', service: '🤝', two_for_one: '✨' }
const requestCardUrl =
  'mailto:info@latido.ch?subject=Solicitud%20de%20Tarjeta%20Latido&body=Hola%2C%20quiero%20solicitar%20mi%20Tarjeta%20Latido%20con%20la%20membres%C3%ADa%20de%20CHF%206%2C90%20al%20mes.'

export default function LatidoCard() {
  const { user, displayName, loading: authLoading } = useAuth()
  const [data, setData] = useState({ membership: null, offers: [], history: [] })
  const [searchParams] = useSearchParams()
  const sharedOfferId = searchParams.get('oferta')
  const [manualShare, setManualShare] = useState(null)
  const sharePanelRef = useRef(null)
  useEffect(() => {
    if (manualShare) {
      sharePanelRef.current?.focus()
      sharePanelRef.current?.scrollIntoView({ block: 'center' })
    }
  }, [manualShare])
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [busy, setBusy] = useState('')
  const [digital, setDigital] = useState(null),
    [notice, setNotice] = useState(''),
    [qrRetry, setQrRetry] = useState(0)
  const [tab, setTab] = useState('available')
  const [expandedOffers, setExpandedOffers] = useState(() => new Set())
  const tabId = useId()
  const refresh = useCallback(async () => {
    setError('')
    try {
      setData(
        user
          ? await cardRpc('lc_member_home')
          : { membership: null, offers: await cardRpc('lc_catalog'), history: [] }
      )
    } catch (err) {
      setError(cardErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [user?.id])
  useEffect(() => {
    if (!authLoading) {
      setLoading(true)
      setDigital(null)
      setTab('available')
      refresh()
    }
  }, [refresh, authLoading])
  const member = data.membership
  useEffect(() => {
    if (!member?.active || authLoading) {
      setDigital(null)
      return
    }
    let stopped = false,
      timer,
      expiresAt = 0,
      renewing = false
    const renew = async () => {
      if (renewing || stopped) return
      renewing = true
      clearTimeout(timer)
      setDigital(null)
      try {
        const next = await cardRpc('lc_issue_digital_card')
        if (stopped) return
        expiresAt = Date.parse(next.expires_at)
        setDigital(next)
        timer = setTimeout(renew, Math.max(1000, expiresAt - Date.now() - 1000))
      } catch (err) {
        if (!stopped) setError(cardErrorMessage(err))
      } finally {
        renewing = false
      }
    }
    renew()
    const onVisible = () => {
      if (document.visibilityState === 'visible' && expiresAt <= Date.now()) renew()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [user?.id, member?.active, authLoading, qrRetry])
  const act = async (key, fn) => {
    setBusy(key)
    setError('')
    setNotice('')
    try {
      await fn()
      await refresh()
    } catch (err) {
      setError(cardErrorMessage(err))
    } finally {
      setBusy('')
    }
  }
  const offers = data.offers
    .filter((o) =>
      tab === 'activated'
        ? member?.active && (o.requires_claim ? o.claim?.status === 'claimed' : o.available)
        : o.claim?.status !== 'claimed' && o.claim?.status !== 'used'
    )
    .sort((a, b) => Number(b.id === sharedOfferId) - Number(a.id === sharedOfferId))
  const sharedOffer = data.offers.find((o) => o.id === sharedOfferId)
  useEffect(() => {
    if (sharedOffer?.claim?.status === 'claimed') setTab('activated')
  }, [sharedOfferId, sharedOffer?.claim?.status])
  const accountUrl = `/auth?${new URLSearchParams({ ...(sharedOfferId ? { mode: 'register' } : {}), next: `/card${sharedOfferId ? `?oferta=${encodeURIComponent(sharedOfferId)}` : ''}` })}`
  const share = async (offer) => {
    setNotice('')
    const result = await shareCardOffer(offer)
    if (result.status === 'copied')
      setNotice('Oferta copiada. Ya puedes enviarla por WhatsApp, mensaje o email.')
    if (result.status === 'manual') setManualShare({ title: offer.title, url: result.url })
  }
  const tabs = [
    ['available', 'Disponibles'],
    ['activated', 'Activas']
  ]
  return (
    <div className="lc-page lc-member-page">
      <CardHeader />
      {error && (
        <div className="lc-alert" role="alert">
          {error}
          <div className="lc-actions">
            <button
              className="lc-button lc-button--secondary"
              onClick={() => {
                refresh()
                setQrRetry((n) => n + 1)
              }}
            >
              Reintentar
            </button>
          </div>
        </div>
      )}
      {notice && (
        <p className="lc-alert lc-success" role="status">
          {notice}
        </p>
      )}
      {loading || authLoading ? (
        <p role="status">Cargando tu Tarjeta Latido…</p>
      ) : (
        <>
          {member ? (
            <section className="lc-card lc-member-card" aria-label="Tu Tarjeta Latido">
              <div className="lc-card-top">
                <h1>TARJETA LATIDO</h1>
                <span className="lc-card-status">{member.active ? '● Activa' : 'Inactiva'}</span>
              </div>
              <div className="lc-card-body">
                <div className="lc-card-owner">
                  <p>{displayName}</p>
                  <small>Número de socio</small>
                  <strong>#{member.member_number}</strong>
                  <small>
                    Vigencia:{' '}
                    {new Date(member.valid_until).toLocaleDateString('es-CH', {
                      timeZone: 'Europe/Zurich'
                    })}
                  </small>
                </div>
                <div className="lc-card-code">
                  {member.active ? (
                    <>
                      {digital ? (
                        <LatidoCardQr value={cardUrl(digital.token)} />
                      ) : (
                        <p role="status">Preparando tu QR…</p>
                      )}
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true">💳</span>
                      <p>Tu membresía está inactiva.</p>
                      <a className="lc-button lc-button--secondary" href={requestCardUrl}>
                        Solicitar reactivación
                      </a>
                    </>
                  )}
                </div>
              </div>
            </section>
          ) : (
            <section className="lc-hero lc-card-intro">
              <span className="lc-eyebrow">Una tarjeta. Tu comunidad. Tus ventajas.</span>
              <h1>
                {sharedOffer
                  ? 'Esta ventaja también puede ser tuya.'
                  : 'Tu Tarjeta Latido te da más.'}
              </h1>
              <p>
                {sharedOffer ? (
                  <>
                    <strong>{sharedOffer.title}</strong> en {sharedOffer.business_name}. Crea tu
                    cuenta y únete al club de ventajas de Latido.
                  </>
                ) : (
                  'Descuentos y ventajas en los negocios de tu comunidad. Lleva tu tarjeta física o presenta el QR digital desde aquí.'
                )}
              </p>
              <div className="lc-hero-facts">
                <span className="lc-price">
                  CHF 6,90 <small>/ mes</small>
                </span>
                <span>💳 Física y digital</span>
                <span>🤝 Negocios: participación gratuita</span>
              </div>
              {user ? (
                <a className="lc-button" href={requestCardUrl}>
                  Solicitar mi tarjeta
                </a>
              ) : (
                <Link className="lc-button" to={accountUrl}>
                  {sharedOffer ? 'Crear cuenta y conseguir mi tarjeta' : 'Quiero mi Tarjeta Latido'}
                </Link>
              )}
              <small className="lc-intro-note">
                {user
                  ? 'La activación del piloto se solicita por email a Latido.'
                  : 'Entra en tu cuenta para solicitarla.'}
              </small>
            </section>
          )}
          <section className="lc-benefits" aria-label="Ventajas en negocios participantes">
            <div className="lc-section-heading">
              <h2>Ventajas para ti</h2>
              <span className="lc-badge">{offers.length} ventajas</span>
            </div>
            <div
              className="lc-offer-tabs"
              role="tablist"
              aria-label="Tus ventajas"
              data-active={tab}
            >
              {tabs.map(([key, label]) => (
                <button
                  key={key}
                  role="tab"
                  id={`${tabId}-${key}`}
                  aria-selected={tab === key}
                  aria-controls={`${tabId}-panel`}
                  tabIndex={tab === key ? 0 : -1}
                  onClick={() => setTab(key)}
                  onKeyDown={(event) => {
                    const direction =
                      event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
                    if (direction) {
                      event.preventDefault()
                      const next =
                        tabs[
                          (tabs.findIndex(([value]) => value === key) + direction + tabs.length) %
                            tabs.length
                        ][0]
                      setTab(next)
                      document.getElementById(`${tabId}-${next}`)?.focus()
                    }
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div
              key={tab}
              role="tabpanel"
              id={`${tabId}-panel`}
              aria-labelledby={`${tabId}-${tab}`}
            >
              {sharedOfferId && !sharedOffer && (
                <p className="lc-alert">
                  Esta oferta ya no está disponible. Descubre las ventajas actuales de Latido.
                </p>
              )}
              {!offers.length && (
                <div className="lc-panel">
                  <p>
                    {tab === 'activated'
                      ? 'Las ventajas incluidas de tu membresía y las promociones que actives aparecerán aquí.'
                      : 'Pronto encontrarás nuevas ventajas de tu comunidad.'}
                  </p>
                </div>
              )}
              <div className="lc-offer-list">
                {offers.map((offer) => {
                  const activated = offer.claim?.status === 'claimed'
                  const expanded = expandedOffers.has(offer.id)
                  return (
                    <article
                      className={`lc-offer lc-offer-row ${offer.id === sharedOfferId ? 'lc-offer-row--shared' : ''}`}
                      key={offer.id}
                    >
                      <button
                        className="lc-share-offer"
                        aria-label={`Compartir ${offer.title}`}
                        title="Compartir oferta"
                        onClick={() => share(offer)}
                      >
                        <Share2 size={17} aria-hidden="true" />
                      </button>
                      <div className="lc-offer-media">
                        {offer.business_photo_url ? (
                          <img
                            src={offer.business_photo_url}
                            alt=""
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.hidden = true
                            }}
                          />
                        ) : (
                          <span aria-hidden="true">{offerIcons[offer.benefit_type]}</span>
                        )}
                      </div>
                      <div className="lc-offer-copy">
                        <h3>{offer.title}</h3>
                        <p className="lc-offer-business">
                          {offer.business_name}
                          {offer.city && ` · ${offer.city}`}
                        </p>
                        <small className="lc-offer-meta">
                          {Number(offer.minimum_spend) > 0 && (
                            <>Desde CHF {Number(offer.minimum_spend)} · </>
                          )}
                          {offer.usage_period === 'unlimited'
                            ? 'Sin límite'
                            : `${offer.usage_limit || 1} uso${(offer.usage_limit || 1) > 1 ? 's' : ''}${offer.usage_period === 'month' ? '/mes' : ''}`}{' '}
                          · Hasta{' '}
                          {new Date(offer.ends_at).toLocaleDateString('es-CH', {
                            timeZone: 'Europe/Zurich'
                          })}
                        </small>
                        {(activated || (!member?.active && offer.remaining === 0)) && (
                          <small className="lc-offer-state">
                            {activated
                              ? `Activa hasta ${new Date(offer.claim.expires_at).toLocaleDateString('es-CH', { timeZone: 'Europe/Zurich' })}`
                              : 'Agotada por el momento'}
                          </small>
                        )}
                        <div className="lc-offer-footer">
                          <button
                            className="lc-button lc-button--secondary"
                            aria-expanded={expanded}
                            aria-controls={`lc-offer-details-${offer.id}`}
                            onClick={() =>
                              setExpandedOffers((previous) => {
                                const next = new Set(previous)
                                if (next.has(offer.id)) next.delete(offer.id)
                                else next.add(offer.id)
                                return next
                              })
                            }
                          >
                            Ver detalles
                          </button>
                          {offer.requires_claim ? (
                            <div className="lc-offer-activation">
                              {member?.active && offer.claim?.status !== 'used' && (
                                <button
                                  className={`lc-button ${activated ? 'lc-button--secondary' : ''}`}
                                  disabled={!!busy || (!activated && offer.remaining === 0)}
                                  onClick={() =>
                                    act(offer.id, () =>
                                      cardRpc(activated ? 'lc_release_claim' : 'lc_claim_offer', {
                                        p_offer: offer.id
                                      })
                                    )
                                  }
                                >
                                  {busy === offer.id
                                    ? 'Un momento…'
                                    : activated
                                      ? 'Desactivar'
                                      : offer.remaining === 0
                                        ? 'Agotada'
                                        : 'Activar'}
                                </button>
                              )}
                            </div>
                          ) : (
                            member?.active && (
                              <span className="lc-badge lc-badge--included">
                                {offer.available ? 'Lista para usar' : 'Límite alcanzado'}
                              </span>
                            )
                          )}
                        </div>
                        <div
                          className="lc-offer-expanded"
                          id={`lc-offer-details-${offer.id}`}
                          hidden={!expanded}
                        >
                          <OfferConditions offer={offer} />
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          </section>
          {manualShare && (
            <section
              className="lc-panel lc-share-panel"
              aria-label="Compartir oferta"
              ref={sharePanelRef}
              tabIndex={-1}
            >
              <h2>Comparte esta oferta</h2>
              <p>{manualShare.title}</p>
              <label>
                Enlace de la oferta
                <input
                  readOnly
                  value={manualShare.url}
                  onFocus={(event) => event.target.select()}
                />
              </label>
              <p className="lc-muted">
                Copia el enlace y envíalo a quien quieras invitar a Latido.
              </p>
              <button
                className="lc-button lc-button--secondary"
                onClick={() => setManualShare(null)}
              >
                Cerrar
              </button>
            </section>
          )}
          {member && (
            <details className="lc-panel lc-card-management">
              <summary>⚙️ Gestionar mi tarjeta e historial</summary>
              <LatidoCardPhysicalRequest
                key={user.id}
                active={member.active}
                displayName={displayName}
              />
              {member.active && (
                <button
                  className="lc-button lc-button--danger"
                  disabled={!!busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        '¿Bloquear tu tarjeta física perdida? La digital seguirá funcionando.'
                      )
                    )
                      act('lost', async () => {
                        await cardRpc('lc_report_lost_card')
                        setNotice('Tarjeta física bloqueada. Puedes solicitar una reposición.')
                      })
                  }}
                >
                  He perdido mi tarjeta física
                </button>
              )}
              {!!data.history.length && (
                <section className="lc-spaced">
                  <h2>Mis usos</h2>
                  <ul className="lc-history">
                    {data.history.map((row) => (
                      <li key={row.id}>
                        <strong>{row.title}</strong>
                        <small>
                          {row.business_name} ·{' '}
                          {new Date(row.redeemed_at).toLocaleDateString('es-CH')}
                          {row.reversed_at ? ' · Anulado' : ''}
                        </small>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </details>
          )}
        </>
      )}
    </div>
  )
}
