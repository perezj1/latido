import { useCallback, useEffect, useState } from 'react'
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
        Latido Card
      </Link>
      <nav className="lc-links" aria-label="Latido Card">
        <Link to="/perfil">Mi perfil</Link>
        <NavLink to="/card" end>
          Mi tarjeta y ventajas
        </NavLink>
        <NavLink to="/card/negocios">Mi negocio</NavLink>
        {isAdmin && <Link to="/admin-latido">Panel Latido</Link>}
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
export default function LatidoCard() {
  const { user, displayName, isAdmin, loading: authLoading } = useAuth()
  const [data, setData] = useState({ membership: null, offers: [], history: [] })
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [busy, setBusy] = useState('')
  const [digital, setDigital] = useState(null),
    [notice, setNotice] = useState('')
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
      refresh()
    }
  }, [refresh, authLoading])
  useEffect(() => {
    if (!digital) return
    const timer = setTimeout(
      () => setDigital(null),
      Math.max(0, Date.parse(digital.expires_at) - Date.now())
    )
    return () => clearTimeout(timer)
  }, [digital])
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
  const member = data.membership
  return (
    <div className="lc-page">
      <CardHeader />
      <section className="lc-hero">
        <span className="lc-eyebrow">Una tarjeta. Tus negocios. Tus ventajas.</span>
        <h1>Tu comunidad también tiene ventajas.</h1>
        <p>
          Presenta tu Latido Card física o digital en los negocios participantes. Las ventajas de
          socio están incluidas; solo tienes que reclamar las promociones especiales.
        </p>
        <div className="lc-hero-facts">
          <span className="lc-price">
            CHF 6,90 <small>/ mes · socios</small>
          </span>
          <span>💳 Física y digital</span>
          <span>🤝 Negocios: participación gratuita</span>
        </div>
        {!user && (
          <Link className="lc-button" to="/auth?next=%2Fcard">
            Entrar en Latido
          </Link>
        )}
        {isAdmin && (
          <Link className="lc-button lc-button--secondary" to="/card/admin">
            Administración Latido Card
          </Link>
        )}
      </section>
      {error && (
        <div className="lc-alert" role="alert">
          {error}
          <div className="lc-actions">
            <button className="lc-button lc-button--secondary" onClick={refresh}>
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
        <p role="status">Cargando Latido Card…</p>
      ) : (
        <div className="lc-layout">
          <aside>
            <section className="lc-card">
              <div className="lc-card-top">
                <span className="lc-eyebrow">Latido · Tu comunidad</span>
                <span className="lc-card-status">
                  {member ? (member.active ? '● Activa' : 'Inactiva') : 'Tarjeta de socio'}
                </span>
              </div>
              <h2>CARD</h2>
              <p>{user ? displayName : 'Tu tarjeta de socio'}</p>
              {member ? (
                <>
                  <p>Socio #{member.member_number}</p>
                  <p>{member.active ? 'Membresía activa' : 'Membresía inactiva'}</p>
                  <small>
                    Vigencia: {new Date(member.valid_until).toLocaleDateString('es-CH')}
                  </small>
                  {digital && (
                    <>
                      <LatidoCardQr value={cardUrl(digital.token)} />
                      <small>QR válido durante 5 minutos. Puedes renovarlo aquí.</small>
                    </>
                  )}
                </>
              ) : (
                <p>
                  {user
                    ? 'Todavía no tienes una membresía Latido Card.'
                    : 'Física o digital, la misma membresía.'}
                </p>
              )}
            </section>
            {member?.active && (
              <div className="lc-actions">
                <button
                  className="lc-button"
                  disabled={!!busy}
                  onClick={() =>
                    act('digital', async () => setDigital(await cardRpc('lc_issue_digital_card')))
                  }
                >
                  {busy === 'digital' ? 'Preparando…' : 'Mostrar mi QR digital'}
                </button>
                <button
                  className="lc-button lc-button--secondary"
                  disabled={!!busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        '¿Bloquear tu tarjeta física perdida? La digital seguirá funcionando.'
                      )
                    )
                      act('lost', async () => {
                        await cardRpc('lc_report_lost_card')
                        setNotice('Tarjeta física bloqueada. Solicita una reposición a Latido.')
                      })
                  }}
                >
                  He perdido mi tarjeta física
                </button>
              </div>
            )}
            {user && !member && (
              <p className="lc-muted">
                La inscripción de esta primera versión se gestiona mediante invitación al piloto.
              </p>
            )}
            {member && (
              <LatidoCardPhysicalRequest
                key={user.id}
                active={member.active}
                displayName={displayName}
              />
            )}
            {!!data.history.length && (
              <section className="lc-panel lc-spaced">
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
          </aside>
          <section aria-label="Ventajas en negocios participantes">
            <div className="lc-section-heading">
              <div>
                <h2>Ventajas en negocios participantes</h2>
                <p className="lc-muted">Descubre lo que tu comunidad tiene para ti.</p>
              </div>
              <span className="lc-badge">{data.offers.length} ventajas</span>
            </div>
            {!data.offers.length && (
              <div className="lc-panel">
                <p>
                  Las primeras ventajas aparecerán aquí cuando los negocios participantes las
                  publiquen.
                </p>
              </div>
            )}
            <div className="lc-grid">
              {data.offers.map((offer) => (
                <article className="lc-offer" key={offer.id}>
                  <div className="lc-offer-top">
                    <span className="lc-offer-icon" aria-hidden="true">
                      {
                        {
                          percent: '🎟️',
                          fixed: '🛍️',
                          gift: '🎁',
                          service: '🤝',
                          two_for_one: '✨'
                        }[offer.benefit_type]
                      }
                    </span>
                    <span
                      className={`lc-badge ${offer.requires_claim ? 'lc-badge--special' : 'lc-badge--included'}`}
                    >
                      {offer.requires_claim ? 'Promoción especial' : 'Incluido con tu membresía'}
                    </span>
                  </div>
                  <p className="lc-eyebrow">
                    {offer.business_name}
                    {offer.city ? ` · ${offer.city}` : ''}
                  </p>
                  <h3>{offer.title}</h3>
                  <OfferConditions offer={offer} />
                  {offer.requires_claim && (
                    <>
                      <p className="lc-muted">
                        {offer.claim?.status === 'used'
                          ? 'Utilizado'
                          : offer.claim?.status === 'claimed'
                            ? `Reclamado · hasta ${new Date(offer.claim.expires_at).toLocaleDateString('es-CH')}`
                            : offer.claim?.status === 'expired'
                              ? 'Reserva caducada'
                              : offer.remaining === 0
                                ? 'Agotado por el momento'
                                : 'Disponible para reclamar'}
                        {offer.remaining !== null && ` · ${offer.remaining} disponibles`}
                      </p>
                      {member?.active && offer.claim?.status !== 'used' && (
                        <div className="lc-actions">
                          <button
                            className="lc-button"
                            disabled={
                              !!busy || offer.claim?.status === 'claimed' || offer.remaining === 0
                            }
                            onClick={() =>
                              act(offer.id, () => cardRpc('lc_claim_offer', { p_offer: offer.id }))
                            }
                          >
                            {offer.claim?.status === 'claimed'
                              ? 'Reclamado'
                              : offer.remaining === 0
                                ? 'Agotado'
                                : busy === offer.id
                                  ? 'Reclamando…'
                                  : 'Reclamar'}
                          </button>
                          {offer.claim?.status === 'claimed' && (
                            <button
                              className="lc-button lc-button--secondary"
                              disabled={!!busy}
                              onClick={() =>
                                act(offer.id, () =>
                                  cardRpc('lc_release_claim', { p_offer: offer.id })
                                )
                              }
                            >
                              Liberar reserva
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  {!offer.requires_claim && member?.active && (
                    <p className="lc-muted">
                      {offer.available
                        ? 'Disponible: presenta tu tarjeta.'
                        : 'Límite de uso alcanzado.'}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
