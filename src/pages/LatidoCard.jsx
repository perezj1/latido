import { useCallback, useEffect, useId, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { cardRpc, cardUrl } from '../lib/latidoCard'
import { cardErrorMessage, offerBenefitLabel, offerUsageLabel } from '../lib/latidoCardCore'
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
  const [data, setData] = useState({ membership: null, offers: [], history: [], saved_offers: [] })
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [busy, setBusy] = useState('')
  const [digital, setDigital] = useState(null),
    [notice, setNotice] = useState(''),
    [qrRetry, setQrRetry] = useState(0)
  const [tab, setTab] = useState('available')
  const tabId = useId()
  const refresh = useCallback(async () => {
    setError('')
    try {
      setData(
        user
          ? await cardRpc('lc_member_home')
          : { membership: null, offers: await cardRpc('lc_catalog'), history: [], saved_offers: [] }
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
  const saved = data.saved_offers || []
  const offers = data.offers.filter((o) =>
    tab === 'saved'
      ? saved.includes(o.id)
      : tab === 'activated'
        ? member?.active && (o.requires_claim ? o.claim?.status === 'claimed' : o.available)
        : o.claim?.status !== 'claimed' && o.claim?.status !== 'used'
  )
  const tabs = [
    ['available', 'Disponibles'],
    ['activated', 'Activadas'],
    ['saved', 'Guardadas']
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
                      <small>Listo para escanear · Se renueva automáticamente</small>
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
              <h1>Tu Tarjeta Latido te da más.</h1>
              <p>
                Descuentos y ventajas en los negocios de tu comunidad. Lleva tu tarjeta física o
                presenta el QR digital desde aquí.
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
                <Link className="lc-button" to="/auth?next=%2Fcard">
                  Quiero mi Tarjeta Latido
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
            <div className="lc-offer-tabs" role="tablist" aria-label="Tus ventajas">
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
            <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`}>
              <div className="lc-section-heading">
                <h2>
                  {tab === 'available'
                    ? 'Ventajas para ti'
                    : tab === 'activated'
                      ? 'Tus ventajas activadas'
                      : 'Tus ventajas guardadas'}
                </h2>
                <span className="lc-badge">{offers.length} ventajas</span>
              </div>
              {!offers.length && (
                <div className="lc-panel">
                  <p>
                    {tab === 'saved'
                      ? 'Guarda las ventajas que te interesen pulsando la estrella.'
                      : tab === 'activated'
                        ? 'Las ventajas incluidas de tu membresía y las promociones que actives aparecerán aquí.'
                        : 'Pronto encontrarás nuevas ventajas de tu comunidad.'}
                  </p>
                </div>
              )}
              <div className="lc-offer-list">
                {offers.map((offer) => {
                  const activated = offer.claim?.status === 'claimed'
                  const isSaved = saved.includes(offer.id)
                  return (
                    <article className="lc-offer lc-offer-row" key={offer.id}>
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
                        <span className="lc-offer-value">{offerBenefitLabel(offer)}</span>
                      </div>
                      <div className="lc-offer-copy">
                        <div className="lc-offer-top">
                          <span
                            className={`lc-badge ${offer.requires_claim ? 'lc-badge--special' : 'lc-badge--included'}`}
                          >
                            {offer.requires_claim ? 'Promoción especial' : 'Incluida en tu tarjeta'}
                          </span>
                          <button
                            className="lc-save-offer"
                            aria-label={`${isSaved ? 'Quitar de guardadas' : 'Guardar'} ${offer.title}`}
                            aria-pressed={isSaved}
                            disabled={!!busy}
                            onClick={() => {
                              if (!user) {
                                setNotice('Entra en tu cuenta para guardar ventajas.')
                                return
                              }
                              act(`save-${offer.id}`, () =>
                                cardRpc('lc_save_favorite', {
                                  p_offer: offer.id,
                                  p_saved: !isSaved
                                })
                              )
                            }}
                          >
                            {isSaved ? '★' : '☆'}
                          </button>
                        </div>
                        <h3>{offer.title}</h3>
                        <OfferConditions offer={offer} />
                        <div className="lc-offer-footer">
                          <div>
                            <strong>{offer.business_name}</strong>
                            {offer.city && <small>{offer.city}</small>}
                          </div>
                          {offer.requires_claim ? (
                            <div className="lc-offer-activation">
                              <small>
                                {activated
                                  ? `Activada hasta ${new Date(offer.claim.expires_at).toLocaleDateString('es-CH')}`
                                  : offer.claim?.status === 'used'
                                    ? 'Utilizada'
                                    : offer.remaining === 0
                                      ? 'Agotada por el momento'
                                      : offer.remaining !== null
                                        ? `${offer.remaining} disponibles`
                                        : 'Disponible'}
                              </small>
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
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          </section>
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
