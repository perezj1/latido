import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { C, PP } from '../lib/theme'

const PENDING_STATUSES = new Set(['reserved', 'checkout_open', 'processing'])

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
    PLAN_FULL:'Las 20 plazas estan ocupadas en este momento.',
    PLAN_UNAVAILABLE:'El plan no esta disponible temporalmente.',
    BUSINESS_NOT_VERIFIED:'Este negocio no puede destacarse en este momento.',
    ALREADY_FEATURED:'Este negocio ya esta destacado.',
    SUBSCRIPTION_EXISTS:'Ya existe una suscripcion asociada a este negocio.',
    CHECKOUT_EXPIRED_RETRY:'La reserva anterior ha caducado. Pulsa de nuevo para continuar.',
    STRIPE_NOT_CONFIGURED:'Stripe aun no esta configurado en Supabase.',
    STRIPE_PRICE_NOT_FOUND:'La tarifa configurada no pertenece a esta cuenta de Stripe.',
    STRIPE_KEY_INVALID:'La clave privada de Stripe no es valida o ha caducado.',
    CHECKOUT_EXPIRATION_INVALID:'Stripe rechazo el tiempo de reserva del pago.',
    PAYMENT_METHOD_UNAVAILABLE:'No hay un metodo de pago compatible habilitado en Stripe.',
    PORTAL_CREATE_FAILED:'No se pudo abrir la gestion de la suscripcion.',
  }

  return messages[code] || 'No se pudo completar la operacion. Intentalo de nuevo.'
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

export default function DestacarNegocio() {
  const { providerId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [startingCheckout, setStartingCheckout] = useState(false)
  const [openingPortal, setOpeningPortal] = useState(false)
  const [confirmationFinished, setConfirmationFinished] = useState(false)
  const checkoutResult = searchParams.get('checkout')
  const portalResult = searchParams.get('portal')

  const loadStatus = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true)

    const { data, error } = await supabase
      .rpc('get_featured_promotion_checkout_status', {
        p_provider_id:providerId,
      })

    if (error) {
      console.error('Could not load promotion checkout status:', error)
      if (!quiet) toast.error('No se pudo comprobar la disponibilidad.')
    } else {
      setStatus(data)
    }

    if (!quiet) setLoading(false)
    return data
  }, [providerId])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  useEffect(() => {
    if (portalResult !== 'return') return

    let stopped = false

    const syncPortalChanges = async () => {
      const { error } = await supabase.functions
        .invoke('create_business_promotion_portal', {
          body:{
            providerId,
            syncOnly:true,
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
  }, [loadStatus, portalResult, providerId, searchParams, setSearchParams])

  useEffect(() => {
    if (checkoutResult !== 'success') return undefined

    let attempts = 0
    let stopped = false
    let timer
    setConfirmationFinished(false)

    const checkPayment = async () => {
      attempts += 1
      const nextStatus = await loadStatus({ quiet:true })
      if (stopped) return

      if (nextStatus?.provider?.promotionActive) {
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
  }, [checkoutResult, loadStatus])

  const plan = status?.plan
  const provider = status?.provider
  const subscription = status?.subscription
  const maxActive = Number(plan?.maxActive || 20)
  const activeCount = Number(plan?.activeCount || 0)
  const reservedCount = Number(plan?.reservedCount || 0)
  const usedSlots = Math.min(maxActive, activeCount + reservedCount)
  const availableSlots = Number(plan?.availableSlots || 0)
  const percentage = maxActive > 0 ? Math.min(100, (usedSlots / maxActive) * 100) : 0
  const paymentPending = PENDING_STATUSES.has(subscription?.status)
  const checkoutResumable = ['reserved', 'checkout_open'].includes(subscription?.status)
  const paymentProcessing = subscription?.status === 'processing'
  const isFeatured = provider?.promotionActive
  const checkoutEligible = plan?.enabled === true
  const canStartCheckout = checkoutEligible
    && !isFeatured
    && !paymentProcessing
    && (checkoutResumable || availableSlots > 0)

  const statusText = useMemo(() => {
    if (isFeatured) return 'Negocio destacado'
    if (checkoutResumable) return 'Pago pendiente'
    if (paymentProcessing) return 'Confirmando pago'
    if (availableSlots < 1) return 'Sin plazas disponibles'
    return 'Disponible'
  }, [availableSlots, checkoutResumable, isFeatured, paymentProcessing, provider])

  const startCheckout = async () => {
    setStartingCheckout(true)
    try {
      const { data, error, response } = await supabase.functions
        .invoke('create_business_promotion_checkout', {
          body:{ providerId },
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
      setStartingCheckout(false)
    }
  }

  const openPortal = async () => {
    setOpeningPortal(true)
    try {
      const { data, error, response } = await supabase.functions
        .invoke('create_business_promotion_portal', {
          body:{ providerId },
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
      setOpeningPortal(false)
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

  if (!status) {
    return (
      <div style={{ maxWidth:560, margin:'0 auto', padding:'60px 20px', textAlign:'center' }}>
        <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:C.text }}>
          No se pudo cargar el plan
        </h1>
        <p style={{ fontFamily:PP, fontSize:13, color:C.mid, lineHeight:1.6 }}>
          Comprueba que el SQL de pagos esta instalado en Supabase.
        </p>
        <button onClick={() => navigate('/perfil')} style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:C.primary, background:C.primaryLight, border:'none', borderRadius:14, padding:'12px 18px', cursor:'pointer' }}>
          Volver al perfil
        </button>
      </div>
    )
  }

  const statusColor = isFeatured
    ? '#166534'
    : paymentPending || availableSlots > 0 ? C.primary : '#B91C1C'
  const statusBackground = isFeatured
    ? '#DCFCE7'
    : paymentPending || availableSlots > 0 ? '#DBEAFE' : '#FEE2E2'

  if (checkoutResult === 'success') {
    return (
      <PaymentSuccess
        businessName={provider?.name}
        confirmed={isFeatured}
        confirmationFinished={confirmationFinished}
        onReturn={() => navigate('/')}
      />
    )
  }

  return (
    <div style={{ maxWidth:620, margin:'0 auto', padding:'24px 16px 60px' }}>
      <button
        onClick={() => navigate('/perfil')}
        style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.mid, background:'#fff', border:`1px solid ${C.border}`, borderRadius:12, padding:'9px 13px', cursor:'pointer', marginBottom:18 }}
      >
        Volver al perfil
      </button>

      <section style={{ background:'#fff', border:`1px solid ${C.border}`, borderRadius:24, overflow:'hidden', boxShadow:'0 16px 44px rgba(15,23,42,0.08)' }}>
        <div style={{ padding:'22px 22px 20px', background:'linear-gradient(135deg,#EFF6FF,#FFFFFF)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'flex-start' }}>
            <div>
              <p style={{ fontFamily:PP, fontWeight:800, fontSize:11, color:C.primary, textTransform:'uppercase', letterSpacing:0.8, margin:'0 0 7px' }}>
                Negocio Destacado
              </p>
              <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:23, color:C.text, margin:'0 0 5px', lineHeight:1.25 }}>
                {provider?.name}
              </h1>
              <p style={{ fontFamily:PP, fontSize:12, color:C.mid, margin:0 }}>
                Mas visibilidad en la pagina de inicio de Latido
              </p>
            </div>
            <span style={{ fontFamily:PP, fontWeight:800, fontSize:10, color:statusColor, background:statusBackground, borderRadius:999, padding:'7px 10px', whiteSpace:'nowrap' }}>
              {statusText}
            </span>
          </div>
        </div>

        <div style={{ padding:22 }}>
          <div style={{ display:'flex', alignItems:'flex-end', gap:7, marginBottom:22 }}>
            <span style={{ fontFamily:PP, fontWeight:800, fontSize:34, color:C.text, letterSpacing:-1.2 }}>
              CHF 49
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
                {availableSlots} de {maxActive} plazas libres
              </span>
            </div>
            <div style={{ height:8, background:'#E2E8F0', borderRadius:999, overflow:'hidden' }}>
              <div style={{ width:`${percentage}%`, height:'100%', borderRadius:999, background:availableSlots > 0 ? C.primary : '#EF4444', transition:'width .25s ease' }} />
            </div>
            {reservedCount > 0 && (
              <p style={{ fontFamily:PP, fontSize:10, color:C.light, margin:'8px 0 0' }}>
                {reservedCount} {reservedCount === 1 ? 'plaza esta reservada durante un pago' : 'plazas estan reservadas durante pagos'}.
              </p>
            )}
          </div>

          <div style={{ display:'grid', gap:10, marginBottom:22 }}>
            {[
              'Prioridad en la rotacion de negocios de Inicio',
              'Pill azul de Negocio Destacado',
              'Renovacion mensual',
              'Cancela la suscripción en cualquier momento desde tu perfil',
            ].map(benefit => (
              <div key={benefit} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                <span style={{ width:20, height:20, borderRadius:10, background:'#DBEAFE', color:C.primary, display:'grid', placeItems:'center', fontFamily:PP, fontWeight:900, fontSize:11, flexShrink:0 }}>
                  +
                </span>
                <span style={{ fontFamily:PP, fontSize:12, color:C.mid, lineHeight:1.55 }}>
                  {benefit}
                </span>
              </div>
            ))}
          </div>

          {checkoutResult === 'success' && !isFeatured && (
            <Notice
              title="Estamos confirmando el pago"
              text="La activacion se completara cuando Stripe confirme el cobro."
              background="#EFF6FF"
              border="#BFDBFE"
              color={C.primaryDark}
            />
          )}

          {checkoutResult === 'canceled' && (
            <Notice
              text="El pago se cancelo y no se realizo ningun cargo."
              background="#FFF7ED"
              border="#FED7AA"
              color="#9A3412"
            />
          )}

          {isFeatured && (
            <Notice
              title="Tu negocio esta destacado"
              text={`${subscription?.cancelAtPeriodEnd ? 'Finaliza' : 'Siguiente renovacion'}: ${formatDate(subscription?.currentPeriodEnd || provider?.promotionEndsAt)}`}
              background="#F0FDF4"
              border="#BBF7D0"
              color="#166534"
            />
          )}

          {paymentPending && !isFeatured && checkoutResult !== 'success' && (
            <Notice
              text="Hay un pago abierto o pendiente de confirmacion para este negocio."
              background="#EFF6FF"
              border="#BFDBFE"
              color={C.primaryDark}
            />
          )}

          {subscription?.canManage ? (
            <PrimaryButton onClick={openPortal} disabled={openingPortal}>
              {openingPortal ? 'Abriendo...' : 'Gestionar suscripcion'}
            </PrimaryButton>
          ) : (
            <PrimaryButton
              onClick={startCheckout}
              disabled={!canStartCheckout || startingCheckout}
            >
              {startingCheckout
                ? 'Reservando plaza...'
                : isFeatured
                  ? 'Plan activo'
                  : availableSlots < 1
                  ? 'Plan completo'
                  : checkoutResumable
                    ? 'Continuar pago'
                    : paymentProcessing
                      ? 'Confirmando pago'
                    : 'Continuar al pago'}
            </PrimaryButton>
          )}

          <p style={{ fontFamily:PP, fontSize:10, color:C.light, textAlign:'center', margin:'11px 4px 0', lineHeight:1.5 }}>
            El pago se procesa de forma segura en Stripe. Latido no almacena los datos de tu tarjeta.
          </p>
        </div>
      </section>
    </div>
  )
}

function PaymentSuccess({
  businessName,
  confirmed,
  confirmationFinished,
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
          &iexcl;Enhorabuena!
        </h1>
        <p style={{ fontFamily:PP, fontWeight:700, fontSize:16, color:C.text, lineHeight:1.55, margin:'0 auto 10px', maxWidth:430 }}>
          Ahora {businessName || 'tu negocio'} recibira mas visibilidad para los clientes de Latido.
        </p>
        <p style={{ fontFamily:PP, fontSize:12, color:C.mid, lineHeight:1.6, margin:'0 auto 24px', maxWidth:430 }}>
          {confirmed
            ? 'Tu plan de Negocio Destacado ya esta activo.'
            : waiting
              ? 'Estamos terminando de activar tu plan. Solo tardara unos segundos.'
              : 'El pago esta confirmado. La activacion puede tardar unos minutos en reflejarse.'}
        </p>

        {waiting && (
          <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:8, margin:'-8px 0 22px' }}>
            <span className="skeleton" style={{ width:10, height:10, borderRadius:5 }} />
            <span style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:C.primary }}>
              Confirmando activacion
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
