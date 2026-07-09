import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { C, PP } from '../lib/theme'
import { BUSINESS_PROMOTION_PLAN_DETAILS, PAID_BUSINESS_FEATURES_VISIBLE } from '../lib/businessPromotion'

const PENDING_STATUSES = new Set(['reserved', 'checkout_open', 'processing'])
const PLAN_KEYS = ['featured', 'basic', 'premium']
const PLAN_KEY_SET = new Set(PLAN_KEYS)

const PLAN_COPY = BUSINESS_PROMOTION_PLAN_DETAILS

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('es-CH', {
    day:'2-digit',
    month:'long',
    year:'numeric',
  }).format(date)
}

function friendlyError(code='') {
  const messages = {
    PLAN_FULL:'Las plazas de este plan están ocupadas en este momento.',
    PLAN_UNAVAILABLE:'Este plan no está disponible temporalmente.',
    PLAN_NOT_FOUND:'Este plan no existe o no está activado.',
    BUSINESS_NOT_VERIFIED:'Este negocio no puede activarse en este momento.',
    ALREADY_FEATURED:'Este negocio ya tiene un plan activo.',
    ALREADY_PROMOTED:'Este negocio ya tiene un plan activo.',
    SUBSCRIPTION_EXISTS:'Ya existe una suscripción asociada a este negocio.',
    CHECKOUT_OPEN_OTHER_PLAN:'Ya hay un pago abierto para otro plan. Continúalo o espera unos minutos para intentarlo de nuevo.',
    CHECKOUT_EXPIRED_RETRY:'La reserva anterior ha caducado. Pulsa de nuevo para continuar.',
    STRIPE_NOT_CONFIGURED:'Stripe aún no está configurado en Supabase.',
    STRIPE_PRICE_NOT_FOUND:'La tarifa configurada no pertenece a esta cuenta de Stripe.',
    STRIPE_KEY_INVALID:'La clave privada de Stripe no es válida o ha caducado.',
    CHECKOUT_EXPIRATION_INVALID:'Stripe rechazó el tiempo de reserva del pago.',
    PAYMENT_METHOD_UNAVAILABLE:'No hay un método de pago compatible habilitado en Stripe.',
    PORTAL_CREATE_FAILED:'No se pudo abrir la gestión de la suscripción.',
  }

  return messages[code] || 'No se pudo completar la operación. Inténtalo de nuevo.'
}

async function getFunctionErrorPayload(error, data, response) {
  if (data?.error) return data

  const errorResponse = response || error?.context
  if (errorResponse && typeof errorResponse.json === 'function') {
    try {
      return await errorResponse.json()
    } catch {}
  }

  return null
}

function formatErrorDetail(detail) {
  if (!detail) return ''
  if (typeof detail === 'string') return detail

  try {
    return JSON.stringify(detail)
  } catch {
    return String(detail)
  }
}

function isMissingRpc(error, rpcName) {
  const message = String(error?.message || '')
  return error?.code === 'PGRST202' || message.includes(rpcName)
}

function getPlanState(planKey, status) {
  const plan = status?.plan
  const provider = status?.provider
  const subscription = status?.subscription
  const maxActive = Number(plan?.maxActive || 0)
  const activeCount = Number(plan?.activeCount || 0)
  const reservedCount = Number(plan?.reservedCount || 0)
  const usedSlots = maxActive > 0 ? Math.min(maxActive, activeCount + reservedCount) : activeCount + reservedCount
  const availableSlots = Number(plan?.availableSlots ?? 0)
  const percentage = maxActive > 0 ? Math.min(100, (usedSlots / maxActive) * 100) : 0
  const paymentPending = PENDING_STATUSES.has(subscription?.status)
  const checkoutResumable = ['reserved', 'checkout_open'].includes(subscription?.status)
  const paymentProcessing = subscription?.status === 'processing'
  const isPromoted = provider?.promotionActive === true
  const currentProviderPlan = provider?.promotionPlan || (isPromoted ? planKey : 'free')
  const selectedPlanActive = isPromoted && currentProviderPlan === planKey
  const checkoutEligible = plan?.enabled === true
  const canStartCheckout = checkoutEligible
    && !isPromoted
    && !paymentProcessing
    && (checkoutResumable || availableSlots > 0)

  let statusText = 'Disponible'
  if (selectedPlanActive) statusText = 'Plan activo'
  else if (isPromoted) statusText = 'Otro plan activo'
  else if (checkoutResumable) statusText = 'Pago pendiente'
  else if (paymentProcessing) statusText = 'Confirmando pago'
  else if (availableSlots < 1) statusText = 'Sin plazas disponibles'

  return {
    plan,
    provider,
    subscription,
    maxActive,
    availableSlots,
    percentage,
    reservedCount,
    paymentPending,
    checkoutResumable,
    paymentProcessing,
    isPromoted,
    selectedPlanActive,
    canStartCheckout,
    statusText,
  }
}

export default function DestacarNegocio() {
  const { providerId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedPlanKey = searchParams.get('plan') || 'featured'
  const resultPlanKey = PLAN_KEY_SET.has(requestedPlanKey) ? requestedPlanKey : 'featured'
  const resultPlanCopy = PLAN_COPY[resultPlanKey]
  const [statuses, setStatuses] = useState({})
  const [businessDetails, setBusinessDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [startingCheckout, setStartingCheckout] = useState('')
  const [openingPortal, setOpeningPortal] = useState('')
  const [confirmationFinished, setConfirmationFinished] = useState(false)
  const [activePlanIndex, setActivePlanIndex] = useState(() => Math.max(0, PLAN_KEYS.indexOf(resultPlanKey)))
  const carouselRef = useRef(null)
  const checkoutResult = searchParams.get('checkout')
  const portalResult = searchParams.get('portal')

  const loadPlanStatus = useCallback(async currentPlanKey => {
    let response = await supabase
      .rpc('get_business_promotion_checkout_status', {
        p_provider_id:providerId,
        p_plan_key:currentPlanKey,
      })

    if (
      response.error
      && currentPlanKey === 'featured'
      && isMissingRpc(response.error, 'get_business_promotion_checkout_status')
    ) {
      response = await supabase
        .rpc('get_featured_promotion_checkout_status', {
          p_provider_id:providerId,
        })
    }

    if (response.error) throw response.error
    return response.data
  }, [providerId])

  const loadStatus = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true)

    try {
      const [entries, businessResponse] = await Promise.all([
        Promise.all(PLAN_KEYS.map(async currentPlanKey => [
          currentPlanKey,
          await loadPlanStatus(currentPlanKey),
        ])),
        supabase
          .from('providers')
          .select('id, email, services, city, canton, category')
          .eq('id', providerId)
          .maybeSingle(),
      ])
      const nextStatuses = Object.fromEntries(entries)
      setStatuses(nextStatuses)
      if (!businessResponse.error) setBusinessDetails(businessResponse.data || null)
      if (!quiet) setLoading(false)
      return nextStatuses
    } catch (error) {
      console.error('Could not load promotion checkout status:', error)
      if (!quiet) {
        toast.error('No se pudo comprobar la disponibilidad.')
        setLoading(false)
      }
      return null
    }
  }, [loadPlanStatus])

  useEffect(() => {
    if (!PAID_BUSINESS_FEATURES_VISIBLE) {
      setLoading(false)
      return
    }
    loadStatus()
  }, [loadStatus])

  useEffect(() => {
    window.scrollTo({ top:0, left:0, behavior:'auto' })
  }, [providerId])

  useEffect(() => {
    if (portalResult !== 'return') return

    let stopped = false

    const syncPortalChanges = async () => {
      const { error } = await supabase.functions
        .invoke('create_business_promotion_portal', {
          body:{
            providerId,
            syncOnly:true,
            planKey:resultPlanKey,
          },
        })

      if (error) {
        console.error('Could not refresh Stripe subscription:', error)
      }
      if (stopped) return

      await loadStatus({ quiet:true })
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('portal')
      setSearchParams(nextParams, { replace:true })
    }

    syncPortalChanges()
    return () => {
      stopped = true
    }
  }, [loadStatus, portalResult, providerId, resultPlanKey, searchParams, setSearchParams])

  useEffect(() => {
    if (checkoutResult !== 'success') return undefined

    let attempts = 0
    let stopped = false
    let timer
    setConfirmationFinished(false)

    const checkPayment = async () => {
      attempts += 1
      const nextStatuses = await loadStatus({ quiet:true })
      if (stopped) return

      if (nextStatuses?.[resultPlanKey]?.provider?.promotionActive) {
        setConfirmationFinished(true)
        return
      }

      if (attempts < 10) {
        timer = window.setTimeout(checkPayment, 2000)
      } else {
        setConfirmationFinished(true)
      }
    }

    checkPayment()
    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
  }, [checkoutResult, loadStatus, resultPlanKey])

  const selectedStatus = statuses[resultPlanKey]
  const selectedState = getPlanState(resultPlanKey, selectedStatus)
  const provider = selectedState.provider || PLAN_KEYS.map(key => statuses[key]?.provider).find(Boolean)

  const syncCarouselIndex = useCallback(() => {
    const carousel = carouselRef.current
    if (!carousel) return

    const carouselRect = carousel.getBoundingClientRect()
    const carouselCenter = carouselRect.left + carouselRect.width / 2
    let closestIndex = 0
    let closestDistance = Infinity

    Array.from(carousel.children).forEach((child, index) => {
      const childRect = child.getBoundingClientRect()
      const childCenter = childRect.left + childRect.width / 2
      const distance = Math.abs(childCenter - carouselCenter)
      if (distance < closestDistance) {
        closestDistance = distance
        closestIndex = index
      }
    })

    setActivePlanIndex(closestIndex)
  }, [])

  useEffect(() => {
    if (loading) return

    const selectedIndex = Math.max(0, PLAN_KEYS.indexOf(resultPlanKey))
    const carousel = carouselRef.current
    const selectedCard = carousel?.children?.[selectedIndex]

    if (carousel && selectedCard) {
      const centeredLeft = selectedCard.offsetLeft - ((carousel.clientWidth - selectedCard.clientWidth) / 2)
      carousel.scrollTo({ left:Math.max(0, centeredLeft), behavior:'auto' })
    }

    setActivePlanIndex(selectedIndex)
  }, [loading, resultPlanKey])

  const startCheckout = async (targetPlanKey, alertOptions = {}) => {
    setStartingCheckout(targetPlanKey)
    try {
      const { data, error, response } = await supabase.functions
        .invoke('create_business_promotion_checkout', {
          body:{
            providerId,
            planKey:targetPlanKey,
            landingPageEnabled:alertOptions.landingPageEnabled === true,
          },
        })

      if (error || !data?.ok) {
        const payload = await getFunctionErrorPayload(error, data, response)
        if (payload?.detail) {
          console.error('Stripe Checkout detail:', formatErrorDetail(payload.detail))
        }
        throw new Error(payload?.error || 'CHECKOUT_CREATE_FAILED')
      }
      if (data.url) {
        window.location.assign(data.url)
        return
      }

      await loadStatus()
    } catch (error) {
      console.error('Could not start Checkout:', error)
      toast.error(friendlyError(error.message))
    } finally {
      setStartingCheckout('')
    }
  }

  const openPortal = async targetPlanKey => {
    setOpeningPortal(targetPlanKey)
    try {
      const { data, error, response } = await supabase.functions
        .invoke('create_business_promotion_portal', {
          body:{ providerId, planKey:targetPlanKey },
        })

      if (error || !data?.url) {
        const payload = await getFunctionErrorPayload(error, data, response)
        throw new Error(payload?.error || 'PORTAL_CREATE_FAILED')
      }

      window.location.assign(data.url)
    } catch (error) {
      console.error('Could not open Stripe portal:', error)
      toast.error(friendlyError(error.message))
    } finally {
      setOpeningPortal('')
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth:620, margin:'0 auto', padding:'28px 18px 60px' }}>
        <div className="skeleton" style={{ height:44, width:180, borderRadius:14, marginBottom:18 }} />
        <div className="skeleton" style={{ height:390, borderRadius:24 }} />
      </div>
    )
  }

  if (!PAID_BUSINESS_FEATURES_VISIBLE) {
    return (
      <div style={{ maxWidth:560, margin:'0 auto', padding:'60px 20px', textAlign:'center' }}>
        <div style={{ width:72, height:72, borderRadius:24, background:C.primaryLight, color:C.primary, display:'grid', placeItems:'center', fontSize:34, margin:'0 auto 20px' }}>
          ✨
        </div>
        <h1 style={{ fontFamily:PP, fontWeight:900, fontSize:24, color:C.text, margin:'0 0 10px' }}>
          Opciones profesionales temporalmente pausadas
        </h1>
        <p style={{ fontFamily:PP, fontSize:13, color:C.mid, lineHeight:1.7, margin:'0 0 24px' }}>
          Los planes y extras de pago no se muestran por ahora. El código sigue preparado para reactivarlos rápidamente.
        </p>
        <button onClick={() => navigate('/perfil')} style={{ fontFamily:PP, fontWeight:800, fontSize:13, color:'#fff', background:C.primary, border:'none', borderRadius:14, padding:'12px 18px', cursor:'pointer' }}>
          Volver al perfil
        </button>
      </div>
    )
  }

  if (!provider) {
    return (
      <div style={{ maxWidth:560, margin:'0 auto', padding:'60px 20px', textAlign:'center' }}>
        <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:C.text }}>
          No se pudo cargar el plan
        </h1>
        <p style={{ fontFamily:PP, fontSize:13, color:C.mid, lineHeight:1.6 }}>
          Comprueba que el SQL de colaboraciones está instalado en Supabase.
        </p>
        <button onClick={() => navigate('/perfil')} style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:C.primary, background:C.primaryLight, border:'none', borderRadius:14, padding:'12px 18px', cursor:'pointer' }}>
          Volver al perfil
        </button>
      </div>
    )
  }

  if (checkoutResult === 'success') {
    return (
      <PaymentSuccess
        businessName={provider?.name}
        confirmed={selectedState.isPromoted}
        confirmationFinished={confirmationFinished}
        planCopy={resultPlanCopy}
        onReturn={() => navigate('/')}
      />
    )
  }

  return (
    <div style={{ maxWidth:620, margin:'0 auto', padding:'24px 0 60px' }}>
      <div style={{ padding:'0 16px' }}>
        <button
          onClick={() => navigate('/perfil')}
          style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.mid, background:'#fff', border:`1px solid ${C.border}`, borderRadius:12, padding:'9px 13px', cursor:'pointer', marginBottom:14 }}
        >
          Volver al perfil
        </button>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', gap:12, margin:'0 0 12px' }}>
          <div>
            <p style={{ fontFamily:PP, fontWeight:900, fontSize:14, color:C.text, margin:'0 0 3px', lineHeight:1.2 }}>
              Elige el plan que necesites
            </p>
            <p style={{ fontFamily:PP, fontSize:10, color:C.light, margin:0 }}>
              Desliza para comparar opciones
            </p>
          </div>
          <div aria-hidden="true" style={{ display:'flex', gap:5, alignItems:'center', paddingBottom:2 }}>
            {PLAN_KEYS.map((key, index) => (
              <span
                key={key}
                style={{
                  width:activePlanIndex === index ? 20 : 7,
                  height:7,
                  borderRadius:999,
                  background:activePlanIndex === index ? PLAN_COPY[key].accent : '#CBD5E1',
                  transition:'all .2s ease',
                  display:'block',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div
        ref={carouselRef}
        aria-label="Planes profesionales"
        onScroll={syncCarouselIndex}
        style={{
          display:'flex',
          gap:14,
          overflowX:'auto',
          WebkitOverflowScrolling:'touch',
          scrollSnapType:'x mandatory',
          padding:'0 16px 16px',
        }}
      >
        {PLAN_KEYS.map(currentPlanKey => {
          const state = getPlanState(currentPlanKey, statuses[currentPlanKey])
          return (
            <PlanCheckoutCard
              key={currentPlanKey}
              planKey={currentPlanKey}
              planCopy={PLAN_COPY[currentPlanKey]}
              provider={state.provider || provider}
              businessDetails={businessDetails}
              state={state}
              checkoutResult={checkoutResult}
              openingPortal={openingPortal === currentPlanKey}
              startingCheckout={startingCheckout === currentPlanKey}
              onOpenPortal={() => openPortal(currentPlanKey)}
              onStartCheckout={alertOptions => startCheckout(currentPlanKey, alertOptions)}
            />
          )
        })}
      </div>
    </div>
  )
}

function PlanCheckoutCard({
  planCopy,
  provider,
  businessDetails,
  state,
  checkoutResult,
  openingPortal,
  startingCheckout,
  onOpenPortal,
  onStartCheckout,
}) {
  const [landingOpen, setLandingOpen] = useState(false)
  const [landingPageEnabled, setLandingPageEnabled] = useState(false)
  const {
    subscription,
    maxActive,
    availableSlots,
    percentage,
    reservedCount,
    paymentPending,
    checkoutResumable,
    paymentProcessing,
    isPromoted,
    selectedPlanActive,
    canStartCheckout,
    statusText,
  } = state
  const statusColor = selectedPlanActive
    ? '#166534'
    : paymentPending || availableSlots > 0 ? C.primary : '#B91C1C'
  const statusBackground = selectedPlanActive
    ? '#DCFCE7'
    : paymentPending || availableSlots > 0 ? '#DBEAFE' : '#FEE2E2'
  const totalMonthlyPrice = Number(planCopy.monthlyPrice || 0) + (landingPageEnabled ? 49 : 0)

  const continueCheckout = () => {
    onStartCheckout({ landingPageEnabled })
  }

  return (
    <section
      style={{
        flex:'0 0 min(88vw, 500px)',
        scrollSnapAlign:'center',
        background:'#fff',
        border:`1px solid ${C.border}`,
        borderRadius:24,
        overflow:'hidden',
        boxShadow:'0 16px 44px rgba(15,23,42,0.08)',
      }}
    >
      <div style={{ padding:'22px 22px 20px', background:`linear-gradient(135deg,${planCopy.soft},#FFFFFF)` }}>
        <div style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'flex-start' }}>
          <div>
            <p style={{ fontFamily:PP, fontWeight:800, fontSize:11, color:planCopy.accent, textTransform:'uppercase', letterSpacing:0.8, margin:'0 0 7px' }}>
              {planCopy.eyebrow}
            </p>
            <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:23, color:C.text, margin:'0 0 5px', lineHeight:1.25 }}>
              {provider?.name}
            </h1>
            <p style={{ fontFamily:PP, fontSize:12, color:C.mid, margin:0, lineHeight:1.55 }}>
              {planCopy.description}
            </p>
          </div>
          <span style={{ fontFamily:PP, fontWeight:800, fontSize:10, color:statusColor, background:statusBackground, borderRadius:999, padding:'7px 10px', whiteSpace:'nowrap' }}>
            {statusText}
          </span>
        </div>
      </div>

      <div style={{ padding:22 }}>
        <div style={{ display:'flex', alignItems:'flex-end', gap:7, marginBottom:20 }}>
          <span style={{ fontFamily:PP, fontWeight:800, fontSize:34, color:C.text, letterSpacing:-1.2 }}>
            CHF {totalMonthlyPrice}
          </span>
          <span style={{ fontFamily:PP, fontWeight:600, fontSize:13, color:C.light, paddingBottom:5 }}>
            / mes
          </span>
        </div>
        <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:16, padding:'15px 16px', marginBottom:18 }}>
          <div style={{ display:'flex', justifyContent:'space-between', gap:12, marginBottom:9 }}>
            <span style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.text }}>
              Disponibilidad
            </span>
            <span style={{ fontFamily:PP, fontWeight:800, fontSize:12, color:availableSlots > 0 ? C.primary : '#B91C1C' }}>
              {maxActive > 0 ? `${availableSlots} de ${maxActive} plazas libres` : 'Sin límite'}
            </span>
          </div>
          {maxActive > 0 && (
            <div style={{ height:8, background:'#E2E8F0', borderRadius:999, overflow:'hidden' }}>
              <div style={{ width:`${percentage}%`, height:'100%', borderRadius:999, background:availableSlots > 0 ? planCopy.accent : '#EF4444', transition:'width .25s ease' }} />
            </div>
          )}
          {reservedCount > 0 && (
            <p style={{ fontFamily:PP, fontSize:10, color:C.light, margin:'8px 0 0' }}>
              {reservedCount} {reservedCount === 1 ? 'plaza está reservada durante un pago' : 'plazas están reservadas durante pagos'}.
            </p>
          )}
        </div>

        <div style={{ display:'grid', gap:10, marginBottom:22 }}>
          {planCopy.benefits.map(benefit => (
            <div key={benefit} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
              <span style={{ width:20, height:20, borderRadius:10, background:planCopy.soft, color:planCopy.accent, display:'grid', placeItems:'center', fontFamily:PP, fontWeight:900, fontSize:11, flexShrink:0 }}>
                +
              </span>
              <span style={{ fontFamily:PP, fontSize:12, color:C.mid, lineHeight:1.55 }}>
                {benefit}
              </span>
            </div>
          ))}
        </div>

        <div style={{ background:landingPageEnabled ? '#EFF6FF' : '#F8FAFC', border:`1px solid ${landingPageEnabled ? '#93C5FD' : C.border}`, borderRadius:16, overflow:'hidden', marginBottom:16 }}>
          <button
            type="button"
            onClick={() => setLandingOpen(open => !open)}
            style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'13px 14px', border:'none', background:'transparent', cursor:'pointer', textAlign:'left' }}
          >
            <span>
              <span style={{ display:'block', fontFamily:PP, fontWeight:800, fontSize:13, color:C.text, marginBottom:3 }}>Landing page dedicada en Latido</span>
              <span style={{ display:'block', fontFamily:PP, fontSize:11, color:C.mid, lineHeight:1.45 }}>CHF 49/mes extra · página Latido x {provider?.name || 'Negocio'}</span>
            </span>
            <span style={{ fontFamily:PP, fontWeight:800, fontSize:17, color:C.primary }}>{landingOpen ? '−' : '+'}</span>
          </button>
          {landingOpen && (
            <div style={{ padding:'0 14px 14px', borderTop:`1px solid ${landingPageEnabled ? '#BFDBFE' : C.border}` }}>
              <label style={{ display:'flex', alignItems:'center', gap:9, margin:'13px 0', cursor:'pointer' }}>
                <input type="checkbox" checked={landingPageEnabled} onChange={event => setLandingPageEnabled(event.target.checked)} />
                <span style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.text }}>Sí, quiero crear una landing dedicada</span>
              </label>
              <p style={{ fontFamily:PP, fontSize:11, color:C.mid, lineHeight:1.55, margin:'0 0 11px' }}>
                Latido crea automáticamente una página pública con formato de colaboración, usando el logo, descripción, servicios y contactos guardados de <strong>{provider?.name}</strong>.
              </p>
              {businessDetails?.services?.length > 0 && <p style={{ fontFamily:PP, fontSize:10, color:C.light, lineHeight:1.5, margin:'0 0 9px' }}>Servicios: {businessDetails.services.join(', ')}</p>}
              {(businessDetails?.city || businessDetails?.canton) && <p style={{ fontFamily:PP, fontSize:10, color:C.light, lineHeight:1.5, margin:'0 0 10px' }}>Zona: {[businessDetails.city, businessDetails.canton].filter(Boolean).join(' · ')}</p>}
              {landingPageEnabled && <p style={{ fontFamily:PP, fontSize:10, color:'#166534', background:'#DCFCE7', borderRadius:9, padding:'8px 9px', margin:'0' }}>La landing quedará activa al confirmarse el pago y se enlazará desde las tarjetas de colaborador.</p>}
            </div>
          )}
        </div>

        {checkoutResult === 'canceled' && (
          <Notice
            text="El pago se canceló y no se realizó ningún cargo."
            background="#FFF7ED"
            border="#FED7AA"
            color="#9A3412"
          />
        )}

        {selectedPlanActive && (
          <Notice
            title="Tu plan está activo"
            text={`${subscription?.cancelAtPeriodEnd ? 'Finaliza' : 'Siguiente renovación'}: ${formatDate(subscription?.currentPeriodEnd || provider?.promotionEndsAt)}`}
            background="#F0FDF4"
            border="#BBF7D0"
            color="#166534"
          />
        )}

        {isPromoted && !selectedPlanActive && (
          <Notice
            title="Este negocio ya tiene un plan activo"
            text="Para cambiar de plan, gestiona primero la suscripción actual desde Stripe."
            background="#EFF6FF"
            border="#BFDBFE"
            color={C.primaryDark}
          />
        )}

        {paymentPending && !isPromoted && checkoutResult !== 'success' && (
          <Notice
            text="Hay un pago abierto o pendiente de confirmación para este negocio."
            background="#EFF6FF"
            border="#BFDBFE"
            color={C.primaryDark}
          />
        )}

        {subscription?.canManage ? (
          <PrimaryButton onClick={onOpenPortal} disabled={openingPortal}>
            {openingPortal ? 'Abriendo...' : 'Gestionar suscripción'}
          </PrimaryButton>
        ) : (
          <PrimaryButton
            onClick={continueCheckout}
            disabled={!canStartCheckout || startingCheckout}
          >
            {startingCheckout
              ? 'Reservando plaza...'
              : isPromoted
                ? 'Plan activo'
                : availableSlots < 1
                ? 'Plan completo'
                : checkoutResumable
                  ? 'Continuar pago'
                  : paymentProcessing
                    ? 'Confirmando pago'
                  : `Continuar al pago · CHF ${totalMonthlyPrice}/mes`}
          </PrimaryButton>
        )}

        <p style={{ fontFamily:PP, fontSize:10, color:C.light, textAlign:'center', margin:'11px 4px 0', lineHeight:1.5 }}>
          El pago se procesa de forma segura en Stripe. Latido no almacena los datos de tu tarjeta.
        </p>
      </div>
    </section>
  )
}

function PaymentSuccess({
  businessName,
  confirmed,
  confirmationFinished,
  planCopy,
  onReturn,
}) {
  const waiting = !confirmed && !confirmationFinished

  return (
    <div style={{ maxWidth:620, margin:'0 auto', padding:'42px 18px 72px' }}>
      <section style={{ background:'#fff', border:'1px solid #BFDBFE', borderRadius:26, padding:'36px 24px 28px', textAlign:'center', boxShadow:'0 18px 50px rgba(37,99,235,0.13)' }}>
        <div style={{ width:74, height:74, margin:'0 auto 22px', borderRadius:37, background:'linear-gradient(135deg,#2563EB,#14B8A6)', color:'#fff', display:'grid', placeItems:'center', fontFamily:PP, fontWeight:900, fontSize:36, boxShadow:'0 12px 28px rgba(37,99,235,0.24)' }}>
          &#10003;
        </div>

        <p style={{ fontFamily:PP, fontWeight:800, fontSize:11, color:C.primary, textTransform:'uppercase', letterSpacing:1, margin:'0 0 9px' }}>
          Pago completado
        </p>
        <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:28, color:C.text, lineHeight:1.2, margin:'0 0 13px' }}>
          Enhorabuena
        </h1>
        <p style={{ fontFamily:PP, fontWeight:700, fontSize:16, color:C.text, lineHeight:1.55, margin:'0 auto 10px', maxWidth:430 }}>
          Ahora {businessName || 'tu negocio'} recibirá más visibilidad para los clientes de Latido.
        </p>
        <p style={{ fontFamily:PP, fontSize:12, color:C.mid, lineHeight:1.6, margin:'0 auto 24px', maxWidth:430 }}>
          {confirmed
            ? planCopy.success
            : waiting
              ? 'Estamos terminando de activar tu plan. Solo tardará unos segundos.'
              : 'El pago está confirmado. La activación puede tardar unos minutos en reflejarse.'}
        </p>

        {waiting && (
          <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:8, margin:'-8px 0 22px' }}>
            <span className="skeleton" style={{ width:10, height:10, borderRadius:5 }} />
            <span style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:C.primary }}>
              Confirmando activación
            </span>
          </div>
        )}

        <PrimaryButton onClick={onReturn}>
          Volver a Latido
        </PrimaryButton>
      </section>
    </div>
  )
}

function Notice({ title='', text, background, border, color }) {
  return (
    <div style={{ background, border:`1px solid ${border}`, borderRadius:14, padding:'12px 14px', marginBottom:14 }}>
      {title && (
        <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color, margin:'0 0 3px' }}>
          {title}
        </p>
      )}
      <p style={{ fontFamily:PP, fontSize:11, color, margin:0, lineHeight:1.5 }}>
        {text}
      </p>
    </div>
  )
}

function PrimaryButton({ children, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ width:'100%', fontFamily:PP, fontWeight:800, fontSize:13, color:'#fff', background:disabled ? '#94A3B8' : C.primary, border:'none', borderRadius:15, padding:'14px 18px', cursor:disabled ? 'default' : 'pointer', opacity:disabled ? 0.72 : 1 }}
    >
      {children}
    </button>
  )
}
