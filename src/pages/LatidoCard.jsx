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
import { ChevronDown } from 'lucide-react'
import { cardRpc } from '../lib/latidoCard'
import {
  cardErrorMessage,
  offerAvailability,
  offerBenefitLabel,
  offerHasEnd,
  offerUsageLabel
} from '../lib/latidoCardCore'
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

export function CardHeader() {
  const { isAdmin, user } = useAuth()
  const [hasBusiness, setHasBusiness] = useState(false)
  useEffect(() => {
    let live = true
    setHasBusiness(false)
    if (user)
      cardRpc('lc_business_dashboard')
        .then((data) => {
          if (live) setHasBusiness(Boolean(data.businesses?.length))
        })
        .catch(() => {})
    return () => {
      live = false
    }
  }, [user?.id])
  const { pathname } = useLocation()
  const cardSelected = pathname === '/card' || pathname.startsWith('/card/negocio/')
  return (
    <header className="lc-top">
      <Link className="lc-brand" to="/" aria-label="Volver al inicio de Latido">
        <span aria-hidden="true">←</span>
        <img src="/favicon.svg" alt="" />
        Latido
      </Link>
      <nav className="lc-links" aria-label="Navegación de Tarjeta Latido">
        <Link to="/card" aria-current={cardSelected ? 'page' : undefined}>
          <span aria-hidden="true">💳</span>Mi tarjeta
        </Link>
        {(hasBusiness || isAdmin || pathname === '/card/negocios') && (
          <NavLink to="/card/negocios">
            <span aria-hidden="true">🏪</span>Mi negocio
          </NavLink>
        )}
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
        {offerHasEnd(offer) ? `Válido hasta ${cardDate(offer.ends_at)}` : 'Sin fecha de fin'}
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
  const [city, setCity] = useState('')
  const [query, setQuery] = useState(''),
    [showAll, setShowAll] = useState(false)
  const [loading, setLoading] = useState(true),
    [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState('available'),
    [confirm, setConfirm] = useState(null)
  const [expandedOfferId, setExpandedOfferId] = useState(null)
  useEffect(() => {
    setExpandedOfferId(null)
  }, [providerId, user?.id, tab, query, city])
  useEffect(() => {
    setTab(params.get('vista') === 'usadas' ? 'used' : 'available')
  }, [params])
  useEffect(() => {
    setQuery('')
    setShowAll(false)
    setCity('')
  }, [providerId])
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
  const sharedOffer =
    !providerId && tab === 'available'
      ? offers.find((offer) => offer.id === params.get('oferta'))
      : null
  const visitorHighlights =
    !member &&
    !providerId &&
    !sharedOffer &&
    tab === 'available' &&
    !query &&
    !city &&
    offers.length > 3
      ? offers.slice(0, 3)
      : []
  const cities = [
    ...new Set(
      [...offers.map((o) => o.city), ...(!providerId ? directory.map((b) => b.city) : [])].filter(
        Boolean
      )
    )
  ].sort((a, b) => a.localeCompare(b, 'es'))
  const eligible = [...(tab === 'used' ? used : offers)].sort((a, b) => {
    if (tab === 'used') return 0
    return (
      Number(offerAvailability(a, { memberActive: Boolean(member?.active) }).unavailable) -
      Number(offerAvailability(b, { memberActive: Boolean(member?.active) }).unavailable)
    )
  })
  const visible = eligible.filter(
    (offer) =>
      (!city || offer.city === city) &&
      matchesCardSearch(
        providerId
          ? [offer.title, offer.description, offerBenefitLabel(offer)]
          : [
              offer.title,
              offer.business_name,
              offer.city,
              offer.description,
              offerBenefitLabel(offer)
            ],
        query
      )
  )
  const shown = (showAll ? visible : visible.slice(0, CARD_PREVIEW_LIMIT)).filter(
    (offer) =>
      tab === 'used' ||
      (offer.id !== sharedOffer?.id && !visitorHighlights.some((item) => item.id === offer.id))
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
      actionLabel={providerId ? 'Usar ahora' : 'Activar'}
      inBusiness={Boolean(providerId)}
      expanded={expandedOfferId === offer.id}
      onToggleDetails={() =>
        setExpandedOfferId((current) => (current === offer.id ? null : offer.id))
      }
    />
  )
  return (
    <div
      className={`lc-page lc-member-page lc-discounts-page${providerId ? ' lc-business-detail-page' : ''}`}
    >
      {providerId ? (
        <LatidoCardBusinessDetail
          business={business}
          count={offers.length}
          query={query}
          loading={loading}
          onQuery={(value) => {
            setQuery(value)
            setShowAll(false)
          }}
        />
      ) : (
        <CardHeader />
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
          {visitorHighlights.length > 0 && (
            <section className="lc-visitor-highlights" aria-labelledby="lc-highlights-title">
              <h2 id="lc-highlights-title">Descuentos destacados</h2>
              <div className="lc-offer-list">
                {visitorHighlights.map((offer) => renderOffer(offer))}
              </div>
            </section>
          )}
          {member && sharedOffer && (
            <section className="lc-featured-offer" aria-label="Descuento compartido">
              <p>Te han compartido este descuento</p>
              {renderOffer(sharedOffer, true)}
            </section>
          )}
          <section className="lc-benefits" aria-labelledby="lc-benefits-title">
            <div className="lc-benefits-heading">
              <h2 id="lc-benefits-title">
                {providerId ? 'Ofertas de este negocio' : 'Descuentos para ti'}
              </h2>
              {!providerId && <CardHowItWorks />}
            </div>
            {!providerId &&
              (offers.length >= 6 || directory.length >= 6 || used.length >= 6 || query) && (
                <CardSearch
                  label="Buscar descuentos y negocios"
                  placeholder="Descuento, negocio o ciudad"
                  value={query}
                  onChange={(value) => {
                    setQuery(value)
                    setShowAll(false)
                  }}
                />
              )}
            {!providerId && cities.length > 1 && (
              <label className="lc-city-select">
                <span className="lc-city-select-pin" aria-hidden="true">📍</span>
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
            <div
              className="lc-offer-tabs"
              role="tablist"
              aria-label={providerId ? 'Ofertas' : 'Tus descuentos'}
              data-active={tab}
            >
              {[
                ['available', 'Disponibles', offers.length],
                ['used', providerId ? 'Usadas' : 'Usados', used.length]
              ].map(([id, label, count]) => (
                <button
                  key={id}
                  role="tab"
                  id={'lc-tab-' + id}
                  aria-controls="lc-offers"
                  aria-selected={tab === id}
                  tabIndex={tab === id ? 0 : -1}
                  onClick={() => {
                    setTab(id)
                    setShowAll(false)
                  }}
                  onKeyDown={(event) => {
                    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                      event.preventDefault()
                      const nextTab =
                        event.key === 'Home'
                          ? 'available'
                          : event.key === 'End'
                            ? 'used'
                            : tab === 'used'
                              ? 'available'
                              : 'used'
                      setTab(nextTab)
                      setShowAll(false)
                      document.getElementById('lc-tab-' + nextTab)?.focus()
                    }
                  }}
                >
                  {label} <span>({count})</span>
                </button>
              ))}
            </div>
            <div
              id="lc-offers"
              role="tabpanel"
              aria-labelledby={'lc-tab-' + tab}
              className={'lc-offer-list ' + (!visible.length ? 'lc-offer-list--empty' : '')}
            >
              {tab === 'used'
                ? visible.length > 0 && (
                    <LatidoDiscountHistory items={shown} inBusiness={Boolean(providerId)} />
                  )
                : shown.map((offer) => renderOffer(offer))}
              {!visible.length && (
                <p className="lc-empty-state">
                  {query.trim() || city
                    ? providerId
                      ? 'No hay ofertas que coincidan con tu búsqueda.'
                      : 'No encontramos descuentos con esa búsqueda.'
                    : tab === 'used'
                      ? providerId
                        ? 'Aquí aparecerán las ofertas que hayas usado en este negocio.'
                        : 'Aquí aparecerán los descuentos que hayas usado.'
                      : 'Todavía no hay descuentos disponibles aquí.'}
                </p>
              )}
            </div>
            <CardListLimit
              total={visible.length}
              expanded={showAll}
              onToggle={() => setShowAll((value) => !value)}
              controls="lc-offers"
              noun={providerId ? 'ofertas' : tab === 'used' ? 'usos' : 'descuentos'}
            />
            {providerId && <BusinessOfferGuide />}
          </section>
          {!providerId && member && annualUses > 0 && (
            <p className="lc-year-uses">
              Has usado {data.history.length >= 100 ? 'al menos ' : ''}
              {annualUses} {annualUses === 1 ? 'descuento' : 'descuentos'} este año.
            </p>
          )}
          {!providerId && (
            <LatidoCardDiscovery
              businesses={directory}
              offers={data.offers}
              error={directoryError}
              query={query}
              city={city}
            />
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
      <ol id="lc-help-steps">
        <li>Elige un descuento.</li>
        <li>Actívalo cuando vayas a pagar.</li>
        <li>Muéstralo al personal en los siguientes 5 minutos.</li>
      </ol>
      <button className="lc-button" type="button" onClick={onClose}>
        Cerrar
      </button>
    </dialog>
  )
}
