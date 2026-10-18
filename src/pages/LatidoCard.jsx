import LatidoCardUsageSteps from '../components/LatidoCardUsageSteps'
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
import { ArrowLeft, Bell, CircleHelp, ChevronDown, MapPin } from 'lucide-react'
import { cardRpc } from '../lib/latidoCard'
import {
  cardErrorMessage,
  offerAvailability,
  offerBenefitLabel,
  offerHasEnd,
  offerUsageLabel
} from '../lib/latidoCardCore'
import useCardBusinessAccess from '../hooks/useCardBusinessAccess'
import LatidoCardOpenValidation from '../components/LatidoCardOpenValidation'
import LatidoCardNotificationPreferences from '../components/LatidoCardNotificationPreferences'
import { membershipMailUrl } from '../lib/latidoCardExperience'
import { CANTONS } from '../lib/constants'
import { trackCardEvent } from '../lib/analytics'
import { cardPublicSeo } from '../lib/latidoCardSeo'
import { applySeo } from '../components/Seo'
import { shareCardOffer } from '../lib/latidoCardShare'
import LatidoCardIntro from '../components/LatidoCardIntro'
import LatidoMembershipCardSummary from '../components/LatidoMembershipCard'
import LatidoCardBusinessDetail, {
  BusinessOfferGuide
} from '../components/LatidoCardBusinessDetail'
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
import './LatidoCardCustomer.css'
import './LatidoCardApp.css'

export function CardHeader({ alerts = false }) {
  const { isAdmin } = useAuth()
  const { hasBusiness, loading } = useCardBusinessAccess()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const cardSelected = pathname !== '/card/negocios' && pathname !== '/card/admin'
  return (
    <header className="lc-top lc-app-header">
      <div className="lc-app-header-row">
        <button
          className="lc-header-round"
          type="button"
          aria-label="Volver al inicio de Latido"
          onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'))}
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <span className="lc-app-header-title">Tarjeta Latido</span>
        {alerts && (
          <a className="lc-header-round" href="#lc-card-alerts" aria-label="Alertas de descuentos">
            <Bell size={19} aria-hidden="true" />
          </a>
        )}
        <Link
          className="lc-header-round"
          to={'/tarjeta-latido' + (cardSelected ? '#socios' : '#negocios')}
          aria-label="Información de Tarjeta Latido"
        >
          <CircleHelp size={20} aria-hidden="true" />
        </Link>
      </div>
      <nav className="lc-links" aria-label="Navegación de Tarjeta Latido" aria-busy={loading}>
        <Link to="/card" aria-current={cardSelected ? 'page' : undefined}>
          <span aria-hidden="true">🎟️</span>
          Descuentos
        </Link>
        {(hasBusiness || isAdmin || pathname === '/card/negocios') && (
          <NavLink to="/card/negocios">
            <span aria-hidden="true">🏪</span>
            Mi negocio
          </NavLink>
        )}
        {isAdmin && (
          <NavLink to="/card/admin">
            <span aria-hidden="true">🛠️</span>
            Administración
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
        {offerHasEnd(offer) ? `Válido hasta ${cardDate(offer.ends_at)}` : 'Sin fecha de fin'}
        <br />
        No acumulable con otros descuentos Latido.
      </small>
    </>
  )
}
export const cardDate = (value) =>
  new Date(value).toLocaleDateString('es-CH', { timeZone: 'Europe/Zurich' })
const refreshToast = 'lc-card-refresh'
const loadErrorText =
  'No se pudieron actualizar tus descuentos. Comprueba tu conexión; volveremos a intentarlo.'

export default function LatidoCard() {
  const { user, displayName, userCanton, loading: authLoading } = useAuth()
  const { providerId } = useParams()
  const location = useLocation(),
    navigate = useNavigate()
  const [params] = useSearchParams()
  const [data, setData] = useState({ offers: [], history: [], membership: null })
  const [business, setBusiness] = useState(null)
  const [directory, setDirectory] = useState([]),
    [directoryError, setDirectoryError] = useState('')
  const [city, setCity] = useState('')
  const [view, setView] = useState('offers')
  const [benefitKind, setBenefitKind] = useState('')
  const [cityNotice, setCityNotice] = useState('')
  const cityInitialized = useRef(false)
  const { participating } = useCardBusinessAccess()
  const [query, setQuery] = useState(''),
    [showAll, setShowAll] = useState(false)
  const [loading, setLoading] = useState(true),
    [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [expandedOfferId, setExpandedOfferId] = useState(null)
  useEffect(() => {
    setExpandedOfferId(null)
  }, [providerId, user?.id, query, city, view, benefitKind])
  useEffect(() => {
    setHistoryOpen(params.get('vista') === 'usadas')
  }, [params])
  useEffect(() => {
    setQuery('')
    setBenefitKind('')
    setShowAll(false)
    setCity('')
    setCityNotice('')
    cityInitialized.current = false
  }, [providerId, userCanton])
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
          setData({ ...home, receivedAt: performance.now() })
          setBusiness(local?.business || null)
          const offeringBusinesses = new Set((home.offers || []).map((offer) => offer.provider_id))
          setDirectory(
            (participants?.items || []).filter((item) => offeringBusinesses.has(item.id))
          )
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
    setData({ offers: [], history: [], membership: null })
    setBusiness(null)
    setDirectory([])
    setDirectoryError('')
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
      trackCardEvent('use_confirmed')
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
  useEffect(() => {
    trackCardEvent('visit')
  }, [providerId])
  const member = data.membership
  const requestUrl = membershipMailUrl({ user, name: displayName, member })
  const renewUrl = membershipMailUrl({ user, name: displayName, member, renew: true })
  const offers = (data.offers || [])
    .filter((offer) => !providerId || (business && offer.provider_id === providerId))
    .sort((a, b) => Number(b.id === params.get('oferta')) - Number(a.id === params.get('oferta')))
  const usedRecords = data.history
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
  const seenUsed = new Set()
  const used = providerId
    ? [...usedRecords]
        .sort((a, b) => Date.parse(b.redeemed_at) - Date.parse(a.redeemed_at))
        .filter((offer) => {
          if (seenUsed.has(offer.id)) return false
          seenUsed.add(offer.id)
          return true
        })
    : usedRecords
  const sharedOffer = !providerId ? offers.find((offer) => offer.id === params.get('oferta')) : null
  useEffect(() => {
    if (loading) return
    const offer = offers.find((item) => item.id === params.get('oferta'))
    const seo = cardPublicSeo({ business: providerId ? business : null, offers, offer })
    if (seo) applySeo(seo)
  }, [loading, data, business, providerId, params])
  const cities = [
    ...new Set(
      [...offers.map((o) => o.city), ...(!providerId ? directory.map((b) => b.city) : [])].filter(
        Boolean
      )
    )
  ].sort((a, b) => a.localeCompare(b, 'es'))
  useEffect(() => {
    if (loading || providerId || cityInitialized.current) return
    cityInitialized.current = true
    const homeCity = CANTONS.find((c) => c.code === userCanton)?.name
    if (!homeCity) return
    if (cities.includes(homeCity)) setCity(homeCity)
    else setCityNotice(`Todavía no hay ofertas en ${homeCity}. Te mostramos todas las ciudades.`)
  }, [loading, providerId, userCanton, cities.join('|')])
  const kindMatches = (offer) =>
    !benefitKind ||
    (benefitKind === 'discount'
      ? ['percent', 'fixed'].includes(offer.benefit_type)
      : benefitKind === 'combo'
        ? offer.benefit_type === 'two_for_one'
        : benefitKind === 'gift'
          ? offer.benefit_type === 'gift'
          : offer.benefit_type === 'service')
  const visible = [...offers]
    .sort(
      (a, b) =>
        Number(offerAvailability(a, { memberActive: Boolean(member?.active) }).unavailable) -
        Number(offerAvailability(b, { memberActive: Boolean(member?.active) }).unavailable)
    )
    .filter(
      (offer) =>
        (!city || offer.city === city) &&
        kindMatches(offer) &&
        matchesCardSearch(
          [
            offer.title,
            offer.business_name,
            offer.city,
            offer.description,
            offerBenefitLabel(offer)
          ],
          query
        )
    )
  // Highlights are a preview above the price. The filtered catalog below must
  // remain complete, even when those are the only offers in the selected city.
  const shown = (showAll ? visible : visible.slice(0, CARD_PREVIEW_LIMIT)).filter(
    (offer) => offer.id !== sharedOffer?.id
  )
  const annualUses = data.history.filter(
    (record) =>
      !record.reversed_at &&
      new Date(record.redeemed_at).toLocaleDateString('en-CA', {
        year: 'numeric',
        timeZone: 'Europe/Zurich'
      }) === new Date().toLocaleDateString('en-CA', { year: 'numeric', timeZone: 'Europe/Zurich' })
  ).length
  const membership = member && (
    <LatidoMembershipCardSummary
      member={member}
      holderName={displayName || 'Miembro Latido'}
      renewUrl={renewUrl}
      historyCount={providerId ? 0 : used.length}
      historyOpen={historyOpen}
      onHistoryToggle={() => setHistoryOpen((value) => !value)}
      history={
        !providerId &&
        historyOpen && (
          <div id="lc-member-history">
            <p>
              Has usado {data.history.length >= 100 ? 'al menos ' : ''}
              {annualUses} descuentos este año.
            </p>
            <LatidoDiscountHistory items={used} inBusiness={Boolean(providerId)} />
          </div>
        )
      }
    />
  )
  const renderOffer = (offer) => (
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
      hideJoinAction={!member?.active}
      actionLabel="Usar ahora"
      inBusiness={Boolean(providerId)}
      expanded={expandedOfferId === offer.id}
      onToggleDetails={() => {
        if (expandedOfferId !== offer.id) trackCardEvent('offer_details')
        setExpandedOfferId((current) => (current === offer.id ? null : offer.id))
      }}
    />
  )
  return (
    <div
      onClickCapture={(event) => {
        if (event.target.closest('a[href^="mailto:"]')) trackCardEvent('request')
      }}
      className={`lc-page lc-member-page lc-discounts-page lc-app-page${providerId ? ' lc-business-detail-page' : ''}`}
    >
      {providerId ? (
        <LatidoCardBusinessDetail
          business={business}
          offers={offers}
          count={offers.length}
          loading={loading}
        />
      ) : (
        <CardHeader alerts={Boolean(member)} />
      )}
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
        <div className="lc-loading" role="status" aria-label="Cargando tus descuentos">
          <div />
          <div />
          <div />
        </div>
      ) : error && !member && !data.offers.length ? null : (
        <>
          {!providerId && membership}
          {!loading && (
            <LatidoCardOpenValidation
              offers={data.offers || []}
              serverNow={data.server_now}
              receivedAt={data.receivedAt}
              providerId={providerId}
            />
          )}

          {!member && !providerId && (
            <LatidoCardIntro
              user={user}
              accountUrl={accountUrl}
              requestUrl={requestUrl}
              loginUrl={loginUrl}
              featured={
                sharedOffer && (
                  <div className="lc-featured-offer" aria-label="Descuento compartido">
                    {renderOffer(sharedOffer, true)}
                  </div>
                )
              }
            />
          )}
          {!member?.active && providerId && (
            <section className="lc-business-join">
              <p>
                {member
                  ? 'Tu membresía está inactiva. Renueva tu tarjeta para usar estas ofertas.'
                  : 'Consigue estas ofertas con Tarjeta Latido por CHF 6,90 al mes.'}
              </p>
              {member ? (
                <a className="lc-button lc-intro-cta" href={renewUrl}>
                  Renovar mi tarjeta
                </a>
              ) : user ? (
                <a className="lc-button lc-intro-cta" href={requestUrl}>
                  Solicitar mi tarjeta
                </a>
              ) : (
                <>
                  <Link className="lc-button lc-intro-cta" to={accountUrl}>
                    Conseguir mi tarjeta
                  </Link>
                  <p>
                    ¿Ya eres socio? <Link to={loginUrl}>Inicia sesión</Link>
                  </p>
                </>
              )}
            </section>
          )}
          {!member && providerId && sharedOffer && (
            <section className="lc-featured-offer" aria-label="Descuento compartido">
              {renderOffer(sharedOffer)}
            </section>
          )}
          {member && sharedOffer && (
            <section className="lc-featured-offer" aria-label="Descuento compartido">
              <p>Te han compartido este descuento</p>
              {renderOffer(sharedOffer, true)}
            </section>
          )}
          <section className="lc-benefits" aria-labelledby="lc-benefits-title">
            {!providerId && (offers.length > 0 || directory.length > 0 || query) && (
              <CardSearch
                label="Buscar descuentos y negocios"
                placeholder="Busca una oferta o un negocio"
                value={query}
                onChange={(value) => {
                  setQuery(value)
                  setShowAll(false)
                }}
              />
            )}
            <div className="lc-catalog-filters">
              {!providerId && cities.length > 1 && (
                <label className="lc-city-select">
                  <span className="lc-city-select-pin" aria-hidden="true">
                    <MapPin size={15} aria-hidden="true" />
                  </span>
                  <span aria-hidden="true">{city || 'Todas las ciudades'}</span>
                  <select
                    aria-label="Ciudad"
                    value={city}
                    onChange={(event) => {
                      setCity(event.target.value)
                      setShowAll(false)
                    }}
                  >
                    <option value="">Todas las ciudades</option>
                    {cities.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={15} aria-hidden="true" />
                </label>
              )}
              {!providerId && (
                <div className="lc-type-filters" role="group" aria-label="Tipo de oferta">
                  {[
                    ['', 'Todo'],
                    ['discount', 'Descuentos'],
                    ['combo', '2x1'],
                    ['gift', 'Regalos'],
                    ['other', 'Otros']
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={benefitKind === value}
                      onClick={() => {
                        setBenefitKind(value)
                        setShowAll(false)
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {cityNotice && !providerId && (
              <p className="lc-muted" role="status">
                {cityNotice}
              </p>
            )}
            {!providerId && (
              <div className="lc-view-selector" role="group" aria-label="Ver">
                <span>Ver:</span>
                {[
                  ['offers', 'Descuentos'],
                  ['businesses', 'Negocios']
                ].map(([id, label]) => (
                  <button key={id} aria-pressed={view === id} onClick={() => setView(id)}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div className="lc-benefits-heading">
              <h2 id="lc-benefits-title">
                {providerId ? 'Ofertas de este negocio' : 'Ofertas disponibles'}
              </h2>
              {!providerId && member && <CardHowItWorks />}
            </div>
            {view === 'businesses' && !providerId ? (
              <LatidoCardDiscovery
                key={benefitKind}
                businesses={directory}
                offers={data.offers.filter(kindMatches)}
                error={directoryError}
                query={query}
                city={city}
              />
            ) : (
              <>
                <div
                  id="lc-offers"
                  className={'lc-offer-list ' + (!visible.length ? 'lc-offer-list--empty' : '')}
                >
                  {shown.map((offer) => renderOffer(offer))}
                  {!visible.length && (
                    <p className="lc-empty-state">
                      {query.trim() || city || benefitKind
                        ? 'No encontramos descuentos con esa búsqueda.'
                        : 'Todavía no hay descuentos disponibles aquí.'}
                    </p>
                  )}
                </div>
                <CardListLimit
                  total={visible.length}
                  expanded={showAll}
                  onToggle={() => setShowAll((value) => !value)}
                  controls="lc-offers"
                  noun={providerId ? 'ofertas' : 'descuentos'}
                />
              </>
            )}
            {!providerId && member && <LatidoCardNotificationPreferences cities={cities} />}
            {providerId && <BusinessOfferGuide />}
            {providerId && used.length > 0 && (
              <section aria-label="Ya usaste aquí">
                <h2>Ya usaste aquí</h2>
                <LatidoDiscountHistory items={used} inBusiness />
              </section>
            )}
          </section>
          {providerId && membership}
          {!providerId && !participating && (
            <Link className="lc-intro-business" to="/card/negocios">
              ¿Tienes un negocio? <strong>Únete gratis →</strong>
            </Link>
          )}
          {!member?.active && (
            <CardJoinBar>
              {member ? (
                <a className="lc-button" href={renewUrl}>
                  Renovar mi tarjeta
                </a>
              ) : user ? (
                <a className="lc-button" href={requestUrl}>
                  Solicitar mi tarjeta
                </a>
              ) : (
                <Link className="lc-button" to={accountUrl}>
                  Conseguir mi tarjeta
                </Link>
              )}
            </CardJoinBar>
          )}
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

function CardJoinBar({ children }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const update = () => {
      const target = document.querySelector('.lc-intro-cta, .lc-membership-renewal')
      setVisible(target ? target.getBoundingClientRect().bottom < 0 : window.scrollY > 300)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])
  return visible && <div className="lc-sticky-join">{children}</div>
}

function CardHowItWorks() {
  const [open, setOpen] = useState(false)
  const trigger = useRef(null)
  return (
    <>
      <button
        ref={trigger}
        className="lc-help-link"
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        ¿Cómo funciona?
      </button>
      {open && <CardHelpDialog onClose={() => setOpen(false)} returnFocusRef={trigger} />}
    </>
  )
}

function CardHelpDialog({ onClose, returnFocusRef }) {
  const dialog = useRef(null)
  useEffect(() => {
    const element = dialog.current
    element.showModal()
    return () => {
      element.close()
      returnFocusRef.current?.focus()
    }
  }, [returnFocusRef])
  return (
    <dialog
      ref={dialog}
      className="lc-help-modal"
      aria-labelledby="lc-help-title"
      aria-describedby="lc-help-steps"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target !== dialog.current) return
        const box = dialog.current.getBoundingClientRect()
        if (
          event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom
        )
          onClose()
      }}
    >
      <h2 id="lc-help-title">¿Cómo funciona?</h2>
      <LatidoCardUsageSteps id="lc-help-steps" />
      <button className="lc-button" type="button" onClick={onClose}>
        Cerrar
      </button>
    </dialog>
  )
}
