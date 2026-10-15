import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Link,
  NavLink,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams
} from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { cardRpc } from '../lib/latidoCard'
import { cardErrorMessage, offerBenefitLabel, offerUsageLabel } from '../lib/latidoCardCore'
import { shareCardOffer } from '../lib/latidoCardShare'
import LatidoCardIntro from '../components/LatidoCardIntro'
import LatidoMembershipCardSummary from '../components/LatidoMembershipCard'
import LatidoDiscountCard, {
  LatidoDiscountConfirmation,
  LatidoDiscountHistory
} from '../components/LatidoDiscountCard'
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
          <span aria-hidden="true">👤</span>Mi perfil
        </Link>
        <NavLink to="/card" end>
          <span aria-hidden="true">💳</span>Mi tarjeta
        </NavLink>
        <NavLink to="/card/negocios">
          <span aria-hidden="true">🏪</span>Mi negocio
        </NavLink>
        {isAdmin && (
          <NavLink to="/card/admin">
            <span aria-hidden="true">🛠️</span>Administración
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
        Válido hasta {cardDate(offer.ends_at)}
        <br />
        No acumulable con otros descuentos Latido.
      </small>
    </>
  )
}
export const cardDate = (value) =>
  new Date(value).toLocaleDateString('es-CH', { timeZone: 'Europe/Zurich' })
const requestUrl =
  'mailto:info@latido.ch?subject=Tarjeta%20Latido%20-%20Membres%C3%ADa%20CHF%206%2C90%20al%20mes'

export default function LatidoCard() {
  const { user, displayName, loading: authLoading } = useAuth()
  const { providerId } = useParams()
  const location = useLocation(),
    navigate = useNavigate()
  const [params] = useSearchParams()
  const [data, setData] = useState({ offers: [], history: [], membership: null })
  const [business, setBusiness] = useState(null)
  const [loading, setLoading] = useState(true),
    [error, setError] = useState('')
  const [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false)
  const [tab, setTab] = useState('available'),
    [confirm, setConfirm] = useState(null)
  useEffect(() => {
    setTab(params.get('vista') === 'usadas' ? 'used' : 'available')
  }, [params])
  const [useError, setUseError] = useState(''),
    [manualShare, setManualShare] = useState('')
  const actionLock = useRef(false),
    pending = useRef({}),
    loadSequence = useRef(0)
  const next = `${location.pathname}${location.search}`
  const loginUrl = `/auth?mode=login&next=${encodeURIComponent(next)}`
  const accountUrl = `/auth?mode=register&next=${encodeURIComponent(next)}`
  const refresh = useCallback(async () => {
    const sequence = ++loadSequence.current
    const [home, local] = await Promise.all([
      user
        ? cardRpc('lc_member_home')
        : cardRpc('lc_catalog').then((offers) => ({ offers, history: [], membership: null })),
      providerId
        ? cardRpc('lc_business_benefits', { p_provider: providerId })
        : Promise.resolve(null)
    ])
    if (sequence === loadSequence.current) {
      // Once the server confirms a recorded attempt, a future visit may start a new one.
      // This also reconciles requests whose first response was lost before a reload.
      for (const recorded of home.history || []) {
        const key = `lc-use:${user?.id}:${recorded.offer_id}`
        try {
          if (sessionStorage.getItem(key) === recorded.request_id) sessionStorage.removeItem(key)
        } catch {}
        if (pending.current[key] === recorded.request_id) delete pending.current[key]
      }
      setData(home)
      setBusiness(local?.business || null)
    }
  }, [user?.id, providerId])
  useEffect(() => {
    if (authLoading) return
    let cancelled = false
    setLoading(true)
    setError('')
    setConfirm(null)
    refresh()
      .catch((err) => {
        if (!cancelled) setError(cardErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      ++loadSequence.current
    }
  }, [refresh, authLoading])
  useEffect(() => {
    if (authLoading) return
    const onVisible = () => {
      if (document.visibilityState === 'visible')
        refresh().catch((err) => setError(cardErrorMessage(err)))
    }
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(onVisible, 30000)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh, authLoading])
  const useOffer = async () => {
    if (actionLock.current || !confirm || !user) return
    actionLock.current = true
    setBusy(true)
    setUseError('')
    const key = `lc-use:${user.id}:${confirm.id}`
    try {
      if (!pending.current[key]) {
        try {
          pending.current[key] = sessionStorage.getItem(key)
        } catch {}
        pending.current[key] ||= crypto.randomUUID()
        try {
          sessionStorage.setItem(key, pending.current[key])
        } catch {}
      }
      const receipt = await cardRpc('lc_use_offer', {
        p_offer: confirm.id,
        p_request_id: pending.current[key]
      })
      try {
        sessionStorage.removeItem(key)
      } catch {}
      delete pending.current[key]
      navigate(`/card/validacion/${receipt.id}`)
    } catch (err) {
      setUseError(cardErrorMessage(err))
    } finally {
      actionLock.current = false
      setBusy(false)
    }
  }
  const activateOffer = (offer) => {
    setUseError('')
    setConfirm(offer)
  }
  const shareOffer = async (offer) => {
    const result = await shareCardOffer(offer)
    if (result.status === 'manual') setManualShare(result.url)
    if (result.status === 'copied') setNotice('Enlace de la oferta copiado.')
  }
  const member = data.membership
  const offers = (data.offers || [])
    .filter((offer) => !providerId || (business && offer.provider_id === providerId))
    .sort((a, b) => Number(b.id === params.get('oferta')) - Number(a.id === params.get('oferta')))
  const used = data.history
    .filter((record) => !record.reversed_at)
    .map((record) => {
      const current = offers.find((offer) => offer.id === record.offer_id)
      return {
        ...current,
        ...record.offer_snapshot,
        id: record.offer_id,
        provider_id:
          record.provider_id || record.offer_snapshot?.provider_id || current?.provider_id,
        title: record.title,
        business_name: record.business_name,
        business_photo_url:
          current?.business_photo_url ||
          record.offer_snapshot?.business_photo_url ||
          data.offers.find(
            (item) =>
              item.provider_id === (record.provider_id || record.offer_snapshot?.provider_id)
          )?.business_photo_url,
        used: true,
        redemptionId: record.id,
        redeemed_at: record.redeemed_at,
        validation:
          record.source === 'member' && Date.parse(record.display_valid_until) > Date.now()
            ? { id: record.id, expires_at: record.display_valid_until }
            : null
      }
    })
    .filter((offer) => !providerId || offer.provider_id === providerId)
  const visible =
    tab === 'used'
      ? used
      : offers.filter((offer) => {
          const capped = offer.usage_period !== 'unlimited' && offer.used_count >= offer.usage_limit
          const reserved = offer.claim?.status === 'claimed'
          return (
            !capped &&
            offer.claim?.status !== 'used' &&
            (!offer.requires_claim || reserved || offer.remaining === null || offer.remaining > 0)
          )
        })
  const sharedOffer = offers.find((offer) => offer.id === params.get('oferta'))
  return (
    <div className="lc-page lc-member-page lc-discounts-page">
      <CardHeader />
      {loading ? (
        <p role="status">Cargando tus descuentos…</p>
      ) : (
        <>
          {providerId && (
            <section className="lc-panel lc-business-current">
              <span className="lc-eyebrow">Tus descuentos aquí</span>
              <h1>{business?.name || 'Negocio no disponible'}</h1>
              <p>
                {business
                  ? business.city
                  : 'Este negocio no participa actualmente en Tarjeta Latido.'}
              </p>
              <Link to="/card">Ver todos los negocios</Link>
            </section>
          )}
          {member?.active ? (
            <LatidoMembershipCardSummary
              member={member}
              holderName={displayName || 'Miembro Latido'}
            />
          ) : (
            <>
              {providerId ? (
                business && (
                  <section className="lc-panel lc-centered lc-spaced">
                    <h2>Estos descuentos pueden ser tuyos</h2>
                    <p>Únete a Tarjeta Latido por CHF 6,90 al mes.</p>
                    {user ? (
                      <a className="lc-button" href={requestUrl}>
                        Conseguir mi Tarjeta Latido
                      </a>
                    ) : (
                      <Link className="lc-button" to={accountUrl}>
                        Conseguir mi Tarjeta Latido
                      </Link>
                    )}
                    <small className="lc-intro-note">
                      La activación del piloto se solicita a Latido por email.
                    </small>
                  </section>
                )
              ) : (
                <LatidoCardIntro
                  user={user}
                  accountUrl={accountUrl}
                  requestUrl={requestUrl}
                  sharedOffer={sharedOffer}
                />
              )}
              {!user && (
                <p className="lc-centered">
                  ¿Ya eres socio? <Link to={loginUrl}>Inicia sesión para usar tus descuentos</Link>
                </p>
              )}
              {member && (
                <p className="lc-alert">
                  Tu membresía está inactiva. Contacta con Latido para renovarla.
                </p>
              )}
            </>
          )}
          {notice && (
            <p className="lc-alert lc-success" role="status">
              {notice}
            </p>
          )}
          {manualShare && (
            <div className="lc-panel">
              <label>
                Copiar enlace de la oferta
                <input
                  aria-label="Enlace de la oferta"
                  readOnly
                  value={manualShare}
                  onFocus={(e) => e.target.select()}
                />
              </label>
            </div>
          )}
          <section className="lc-benefits" aria-labelledby="lc-benefits-title">
            <h2 id="lc-benefits-title" className="lc-centered">
              Descuentos para ti
            </h2>
            <div
              className="lc-offer-tabs"
              role="tablist"
              aria-label="Tus descuentos"
              data-active={tab}
            >
              {[
                ['available', 'Disponibles'],
                ['used', 'Usadas']
              ].map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  id={`lc-tab-${id}`}
                  aria-controls="lc-offers"
                  aria-selected={tab === id}
                  tabIndex={tab === id ? 0 : -1}
                  onClick={() => setTab(id)}
                  onKeyDown={(e) => {
                    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
                      e.preventDefault()
                      const nextTab =
                        e.key === 'Home'
                          ? 'available'
                          : e.key === 'End'
                            ? 'used'
                            : tab === 'used'
                              ? 'available'
                              : 'used'
                      setTab(nextTab)
                      document.getElementById(`lc-tab-${nextTab}`)?.focus()
                    }
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div
              id="lc-offers"
              role="tabpanel"
              aria-labelledby={`lc-tab-${tab}`}
              className="lc-offer-list"
            >
              {tab === 'used'
                ? used.length > 0 && (
                    <LatidoDiscountHistory
                      key="used"
                      items={used}
                      initiallyOpen
                      memberActive={Boolean(member?.active)}
                      busy={busy}
                      onActivate={activateOffer}
                    />
                  )
                : visible.map((offer) => (
                    <LatidoDiscountCard
                      key={offer.id}
                      offer={offer}
                      memberActive={Boolean(member?.active)}
                      user={user}
                      loginUrl={loginUrl}
                      requestUrl={requestUrl}
                      busy={busy}
                      shared={offer.id === params.get('oferta')}
                      onActivate={activateOffer}
                      onShare={shareOffer}
                    />
                  ))}
              {tab === 'available' && providerId && used.length > 0 && (
                <LatidoDiscountHistory
                  key="recent"
                  items={used}
                  memberActive={Boolean(member?.active)}
                  busy={busy}
                  onActivate={activateOffer}
                />
              )}
              {!visible.length && (
                <p className="lc-centered lc-muted">
                  {tab === 'used'
                    ? 'Aquí aparecerán los descuentos que hayas usado.'
                    : 'Todavía no hay descuentos disponibles aquí.'}
                </p>
              )}
            </div>
          </section>
        </>
      )}
      {error && (
        <p className="lc-alert" role="alert">
          {error}
        </p>
      )}
      {confirm && (
        <LatidoDiscountConfirmation
          offer={confirm}
          onClose={() => setConfirm(null)}
          onConfirm={useOffer}
          busy={busy}
          error={useError}
        />
      )}
    </div>
  )
}
