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
import toast from 'react-hot-toast'
import { cardRpc } from '../lib/latidoCard'
import { cardErrorMessage, offerBenefitLabel, offerUsageLabel } from '../lib/latidoCardCore'
import { shareCardOffer } from '../lib/latidoCardShare'
import LatidoCardIntro from '../components/LatidoCardIntro'
import LatidoMembershipCardSummary from '../components/LatidoMembershipCard'
import LatidoCardDiscovery, {
  CARD_PREVIEW_LIMIT,
  CardListLimit,
  CardSearch,
  matchesCardSearch
} from '../components/LatidoCardDiscovery'
import LatidoDiscountCard, {
  LatidoDiscountConfirmation,
  LatidoDiscountHistory
} from '../components/LatidoDiscountCard'
import './LatidoCard.css'

export function CardHeader() {
  const { isAdmin } = useAuth()
  const { pathname } = useLocation()
  const cardSelected = pathname === '/card' || pathname.startsWith('/card/negocio/')
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
        <Link to="/card" aria-current={cardSelected ? 'page' : undefined}>
          <span aria-hidden="true">💳</span>Mi tarjeta
        </Link>
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
const renewUrl = 'mailto:info@latido.ch?subject=Renovar%20Tarjeta%20Latido'
const refreshToast = 'lc-card-refresh'
const loadErrorText =
  'No se pudieron actualizar tus descuentos. Comprueba tu conexión; volveremos a intentarlo.'

export default function LatidoCard() {
  const { user, displayName, loading: authLoading } = useAuth()
  const { providerId } = useParams()
  const location = useLocation(),
    navigate = useNavigate()
  const [params] = useSearchParams()
  const [data, setData] = useState({ offers: [], history: [], membership: null })
  const [business, setBusiness] = useState(null)
  const [directory, setDirectory] = useState([]),
    [directoryError, setDirectoryError] = useState('')
  const [query, setQuery] = useState(''),
    [showAll, setShowAll] = useState(false)
  const [loading, setLoading] = useState(true),
    [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState('available'),
    [confirm, setConfirm] = useState(null)
  useEffect(() => {
    setTab(params.get('vista') === 'usadas' ? 'used' : 'available')
  }, [params])
  useEffect(() => {
    setQuery('')
    setShowAll(false)
  }, [tab, providerId])
  useEffect(() => {
    if (!loading && location.hash === '#lc-participating-businesses') {
      document.getElementById('lc-participating-businesses')?.scrollIntoView()
    }
  }, [loading, location.hash, providerId])
  const [useError, setUseError] = useState(''),
    [manualShare, setManualShare] = useState(null)
  const actionLock = useRef(false),
    pending = useRef({}),
    loadSequence = useRef(0)
  const next = `${location.pathname}${location.search}`
  const loginUrl = `/auth?mode=login&next=${encodeURIComponent(next)}`
  const accountUrl = `/auth?mode=register&next=${encodeURIComponent(next)}`
  const refresh = useCallback(
    async ({ background = false } = {}) => {
      const sequence = ++loadSequence.current
      try {
        const [home, local, participants] = await Promise.all([
          user
            ? cardRpc('lc_member_home')
            : cardRpc('lc_catalog').then((offers) => ({ offers, history: [], membership: null })),
          providerId
            ? cardRpc('lc_business_benefits', { p_provider: providerId })
            : Promise.resolve(null),
          providerId
            ? Promise.resolve(null)
            : cardRpc('lc_participating_businesses')
                .then((items) => ({ items, error: '' }))
                .catch((err) => ({
                  items: [],
                  error: cardErrorMessage(
                    err,
                    'No se pudieron actualizar los negocios participantes. Comprueba tu conexión.'
                  )
                }))
        ])
        if (sequence === loadSequence.current) {
          // Once the server confirms a recorded attempt, a future visit may start a new one.
          // This also reconciles requests whose first response was lost before a reload.
          for (const recorded of home.history || []) {
            const key = `lc-use:${user?.id}:${recorded.offer_id}`
            try {
              if (sessionStorage.getItem(key) === recorded.request_id)
                sessionStorage.removeItem(key)
            } catch {}
            if (pending.current[key] === recorded.request_id) delete pending.current[key]
          }
          setData(home)
          setBusiness(local?.business || null)
          setDirectory(participants?.items || [])
          setDirectoryError(participants?.error || '')
          setError('')
          toast.dismiss(refreshToast)
        }
      } catch (err) {
        if (sequence === loadSequence.current) {
          const message = cardErrorMessage(err, loadErrorText)
          if (background) toast.error(message, { id: refreshToast, duration: 6000 })
          else setError(message)
        }
      } finally {
        if (sequence === loadSequence.current) setLoading(false)
      }
    },
    [user?.id, providerId]
  )
  useEffect(() => {
    if (authLoading) return
    setLoading(true)
    setError('')
    setConfirm(null)
    setUseError('')
    setManualShare(null)
    refresh()
    return () => {
      ++loadSequence.current
      toast.dismiss(refreshToast)
    }
  }, [refresh, authLoading])
  useEffect(() => {
    if (authLoading) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh({ background: true })
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
  const useOffer = async (offer) => {
    if (actionLock.current || !offer || !user) return
    actionLock.current = true
    setBusy(true)
    setUseError('')
    const key = `lc-use:${user.id}:${offer.id}`
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
        p_offer: offer.id,
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
    setManualShare(null)
    toast.dismiss('lc-card-share')
    try {
      const result = await shareCardOffer(offer)
      if (result.status === 'manual') {
        setManualShare({ offerId: offer.id, url: result.url })
        toast('Copia el enlace que aparece en este descuento.', { id: 'lc-card-share' })
      }
      if (result.status === 'copied')
        toast.success('Enlace de la oferta copiado.', { id: 'lc-card-share' })
    } catch {
      toast.error('No se pudo compartir el descuento. Vuelve a intentarlo.', {
        id: 'lc-card-share'
      })
    }
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
        redeemed_at: record.redeemed_at
      }
    })
    .filter((offer) => !providerId || offer.provider_id === providerId)
  const eligible = tab === 'used' ? used : offers
  const visible = eligible.filter((offer) =>
    matchesCardSearch(
      [offer.title, offer.business_name, offer.city, offer.description, offerBenefitLabel(offer)],
      query
    )
  )
  const shown = showAll ? visible : visible.slice(0, CARD_PREVIEW_LIMIT)
  const sharedOffer = offers.find((offer) => offer.id === params.get('oferta'))
  return (
    <div className="lc-page lc-member-page lc-discounts-page">
      <CardHeader />
      {error && (
        <div className="lc-alert" role="alert">
          <p>{error}</p>
          <button
            className="lc-button lc-button--secondary"
            disabled={loading}
            onClick={() => {
              setLoading(true)
              refresh()
            }}
          >
            Reintentar
          </button>
        </div>
      )}
      {loading ? (
        <p role="status">Cargando tus descuentos…</p>
      ) : error && !data.membership && !data.offers.length ? null : (
        <>
          {member ? (
            <LatidoMembershipCardSummary
              member={member}
              holderName={displayName || 'Miembro Latido'}
              renewUrl={renewUrl}
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
            </>
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
            <CardSearch
              label="Buscar descuentos"
              placeholder="Descuento, negocio o ciudad"
              value={query}
              onChange={(value) => {
                setQuery(value)
                setShowAll(false)
              }}
            />
            <div
              id="lc-offers"
              role="tabpanel"
              aria-labelledby={`lc-tab-${tab}`}
              className="lc-offer-list"
            >
              {tab === 'used'
                ? visible.length > 0 && (
                    <LatidoDiscountHistory
                      key="used"
                      items={shown}
                      total={visible.length}
                      initiallyOpen
                    />
                  )
                : shown.map((offer) => (
                    <LatidoDiscountCard
                      key={offer.id}
                      offer={offer}
                      memberActive={Boolean(member?.active)}
                      memberInactive={Boolean(member && !member.active)}
                      user={user}
                      loginUrl={loginUrl}
                      requestUrl={member ? renewUrl : requestUrl}
                      busy={busy}
                      shared={offer.id === params.get('oferta')}
                      onActivate={activateOffer}
                      onShare={shareOffer}
                      manualShareUrl={manualShare?.offerId === offer.id ? manualShare.url : ''}
                    />
                  ))}
              {!visible.length && (
                <p className="lc-centered lc-muted">
                  {query.trim()
                    ? 'No encontramos descuentos con esa búsqueda.'
                    : tab === 'used'
                      ? 'Aquí aparecerán los descuentos que hayas usado.'
                      : 'Todavía no hay descuentos disponibles aquí.'}
                </p>
              )}
            </div>
            <CardListLimit
              total={visible.length}
              expanded={showAll}
              onToggle={() => setShowAll((value) => !value)}
              controls="lc-offers"
              noun={tab === 'used' ? 'usos' : 'descuentos'}
            />
          </section>
          {!providerId && <LatidoCardDiscovery businesses={directory} error={directoryError} />}
        </>
      )}
      {confirm && (
        <LatidoDiscountConfirmation
          offer={confirm}
          onClose={() => {
            setConfirm(null)
            setUseError('')
          }}
          onConfirm={() => useOffer(confirm)}
          busy={busy}
          error={useError}
        />
      )}
    </div>
  )
}
