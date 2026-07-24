import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { trackAnalyticsEvent } from '../lib/analytics'
import { submitSearchResolutionFeedback } from '../lib/feedback'
import {
  clearPendingSearchResolution,
  createSearchAttemptId,
  readPendingSearchResolution,
  rememberSearchResultForResolution,
  subscribeSearchResolutionContext,
  updatePendingSearchResolution,
} from '../lib/searchResolution'
import { C, PP } from '../lib/theme'

const PROMPT_DELAY_MS = import.meta.env.DEV ? 3_000 : 10_000
const ACTION_PROMPT_DELAY_MS = import.meta.env.DEV ? 600 : 1_800
const THANK_YOU_DELAY_MS = 1_500

const ANSWERS = [
  { id:'yes', label:'Sí', icon:'✓', color:'#047857', background:'#ECFDF5', border:'#A7F3D0' },
  { id:'partial', label:'Parcialmente', icon:'◐', color:'#B45309', background:'#FFFBEB', border:'#FDE68A' },
  { id:'no', label:'No', icon:'×', color:'#B91C1C', background:'#FEF2F2', border:'#FECACA' },
]

const REASONS = [
  { id:'more_information', label:'Más información' },
  { id:'different_location', label:'Otra ubicación' },
  { id:'clearer_price', label:'Un precio más claro' },
  { id:'more_options', label:'Más alternativas' },
  { id:'other', label:'Otro motivo' },
]

function currentPath(location) {
  return `${location.pathname}${location.search}`
}

function targetPath(href) {
  if (!href || /^https?:\/\//i.test(href)) return ''
  try {
    const url = new URL(href, window.location.origin)
    return `${url.pathname}${url.search}`
  } catch {
    return String(href).split('#')[0]
  }
}

function isRelevantLocation(context, location) {
  if (
    !context
    || location.pathname.startsWith('/admin-latido')
    || location.pathname.startsWith('/auth')
    || location.pathname.startsWith('/reset-password')
  ) return false
  if (context.action_recorded_at) return true

  const path = currentPath(location)
  const destination = targetPath(context.result_href)
  return !destination
    || path === destination
    || path === context.source_path
    || Date.now() - Number(context.opened_at || 0) < 5 * 60 * 1000
}

function getMeaningfulAction(target) {
  const element = target instanceof Element ? target.closest('a, button') : null
  if (!element || element.closest('[data-search-resolution-prompt]')) return null

  const label = String(element.textContent || element.getAttribute('aria-label') || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
  const href = element instanceof HTMLAnchorElement ? element.href : ''
  const rawHref = element instanceof HTMLAnchorElement ? element.getAttribute('href') || '' : ''
  const normalizedLabel = label.toLowerCase()

  if (normalizedLabel.includes('inicia sesión')) return null
  if (/^tel:/i.test(rawHref)) return { action:'phone', label, href:rawHref }
  if (/^mailto:/i.test(rawHref)) return { action:'email', label, href:rawHref }
  if (/wa\.me|whatsapp/i.test(href)) return { action:'whatsapp', label, href }

  if (/^https?:/i.test(href)) {
    try {
      if (new URL(href).origin !== window.location.origin) {
        return { action:'external_website', label, href }
      }
    } catch {}
  }

  if (/(enviar mensaje|contactar|llamar|escribir|unirme por)/i.test(label)) {
    return { action:'contact', label, href:rawHref }
  }

  return null
}

export default function SearchResolutionPrompt() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const timerRef = useRef(null)
  const completionTimerRef = useRef(null)
  const previewCreatedRef = useRef(false)
  const [pending, setPending] = useState(readPendingSearchResolution)
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState('question')
  const [answer, setAnswer] = useState('')

  useEffect(() => subscribeSearchResolutionContext(context => {
    setPending(context)
    if (context) {
      setStep('question')
      setAnswer('')
    } else {
      setVisible(false)
    }
  }), [])

  useEffect(() => {
    if (
      !import.meta.env.DEV
      || previewCreatedRef.current
      || new URLSearchParams(location.search).get('resolution-preview') !== '1'
    ) return

    previewCreatedRef.current = true
    rememberSearchResultForResolution({
      search_attempt_id:createSearchAttemptId(),
      query:'fontanero en Lucerna',
      result_id:'preview-provider',
      result_type:'business',
      result_label:'Fontanería García',
      result_href:'/',
      source_path:currentPath(location),
      opened_at:Date.now() - PROMPT_DELAY_MS,
    })
  }, [location])

  useEffect(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    setVisible(false)

    if (
      isAdmin
      || !pending
      || !isRelevantLocation(pending, location)
    ) return undefined

    const baseTime = Number(pending.action_recorded_at || pending.opened_at)
    const delay = pending.action_recorded_at ? ACTION_PROMPT_DELAY_MS : PROMPT_DELAY_MS
    const remaining = Math.max(0, baseTime + delay - Date.now())

    timerRef.current = window.setTimeout(() => {
      if (document.visibilityState === 'visible') setVisible(true)
    }, remaining)

    const showOnReturn = () => {
      if (
        document.visibilityState === 'visible'
        && Date.now() >= baseTime + delay
      ) setVisible(true)
    }
    document.addEventListener('visibilitychange', showOnReturn)

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      document.removeEventListener('visibilitychange', showOnReturn)
    }
  }, [isAdmin, location, pending])

  useEffect(() => {
    const handleAction = event => {
      const context = readPendingSearchResolution()
      if (
        isAdmin
        || !context
        || context.action_recorded_at
        || !isRelevantLocation(context, location)
      ) return

      const action = getMeaningfulAction(event.target)
      if (!action) return

      const recordedAt = Date.now()
      const nextContext = updatePendingSearchResolution({
        action:action.action,
        action_recorded_at:recordedAt,
      })
      setPending(nextContext)

      trackAnalyticsEvent('search_solution_action', {
        user_id:user?.id || null,
        metadata:{
          search_attempt_id:context.search_attempt_id,
          query:context.query,
          result_id:context.result_id,
          result_type:context.result_type,
          result_label:context.result_label,
          action:action.action,
          time_to_action_ms:Math.max(0, recordedAt - Number(context.opened_at || recordedAt)),
        },
      })
    }

    document.addEventListener('click', handleAction, true)
    return () => document.removeEventListener('click', handleAction, true)
  }, [isAdmin, location, user?.id])

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    if (completionTimerRef.current) window.clearTimeout(completionTimerRef.current)
  }, [])

  const finish = messageStep => {
    setStep(messageStep)
    if (completionTimerRef.current) window.clearTimeout(completionTimerRef.current)
    completionTimerRef.current = window.setTimeout(() => {
      clearPendingSearchResolution()
      setPending(null)
      setVisible(false)
    }, THANK_YOU_DELAY_MS)
  }

  const saveResponse = (context, nextAnswer, reason = null) => {
    void submitSearchResolutionFeedback(context, nextAnswer, reason).catch(error => {
      console.warn('Could not save search resolution feedback:', error)
    })
  }

  const submitAnswer = nextAnswer => {
    if (!pending || step !== 'question') return

    setAnswer(nextAnswer)
    trackAnalyticsEvent('search_resolution', {
      user_id:user?.id || null,
      metadata:{
        search_attempt_id:pending.search_attempt_id,
        query:pending.query,
        result_id:pending.result_id,
        result_type:pending.result_type,
        result_label:pending.result_label,
        answer:nextAnswer,
        had_solution_action:Boolean(pending.action_recorded_at),
        solution_action:pending.action || '',
        time_to_feedback_ms:Math.max(0, Date.now() - Number(pending.opened_at || Date.now())),
      },
    })
    saveResponse(pending, nextAnswer)

    if (nextAnswer === 'yes') {
      finish('thanks')
    } else {
      setStep('reason')
    }
  }

  const submitReason = reason => {
    if (!pending || !answer) return

    trackAnalyticsEvent('search_resolution_reason', {
      user_id:user?.id || null,
      metadata:{
        search_attempt_id:pending.search_attempt_id,
        query:pending.query,
        result_id:pending.result_id,
        result_type:pending.result_type,
        result_label:pending.result_label,
        answer,
        reason,
      },
    })
    saveResponse(pending, answer, reason)
    finish('thanks')
  }

  const dismiss = () => {
    clearPendingSearchResolution()
    setPending(null)
    setVisible(false)
  }

  const searchAgain = () => {
    dismiss()
    navigate('/')
  }

  if (!visible || !pending) return null

  return (
    <aside
      className="search-resolution-prompt fade-up"
      data-search-resolution-prompt
      role="dialog"
      aria-labelledby="search-resolution-title"
      aria-describedby="search-resolution-description"
      style={{
        position:'fixed',
        zIndex:240,
        width:'min(410px, calc(100vw - 24px))',
        padding:16,
        background:'rgba(255,255,255,0.98)',
        border:`1px solid ${C.border}`,
        borderRadius:20,
        boxShadow:'0 22px 60px rgba(15,23,42,0.22)',
        backdropFilter:'blur(16px)',
        WebkitBackdropFilter:'blur(16px)',
      }}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Cerrar pregunta"
        style={{
          position:'absolute',
          top:10,
          right:10,
          width:32,
          height:32,
          border:'none',
          borderRadius:'50%',
          background:C.bg,
          color:C.mid,
          fontFamily:PP,
          fontSize:18,
          cursor:'pointer',
        }}
      >
        ×
      </button>

      {step === 'thanks' ? (
        <div aria-live="polite" style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 34px 8px 2px' }}>
          <span aria-hidden="true" style={{ width:42, height:42, display:'grid', placeItems:'center', borderRadius:14, background:C.successLight, color:'#047857', fontSize:22, fontWeight:900 }}>✓</span>
          <div>
            <p style={{ margin:'0 0 3px', fontFamily:PP, fontSize:15, fontWeight:850, color:C.text }}>Gracias por ayudarnos</p>
            <p style={{ margin:0, fontFamily:PP, fontSize:11.5, lineHeight:1.5, color:C.mid }}>Tu respuesta nos ayuda a mejorar los resultados de Latido.</p>
          </div>
        </div>
      ) : step === 'reason' ? (
        <>
          <p id="search-resolution-title" style={{ margin:'0 36px 4px 0', fontFamily:PP, fontSize:16, fontWeight:850, color:C.text }}>
            ¿Qué te faltó?
          </p>
          <p id="search-resolution-description" style={{ margin:'0 28px 12px 0', fontFamily:PP, fontSize:11.5, lineHeight:1.5, color:C.mid }}>
            La respuesta es opcional y nos ayuda a mejorar esta búsqueda.
          </p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
            {REASONS.map(reason => (
              <button
                key={reason.id}
                type="button"
                onClick={() => submitReason(reason.id)}
                style={{
                  minHeight:36,
                  padding:'8px 11px',
                  border:`1px solid ${C.border}`,
                  borderRadius:999,
                  background:'#F8FAFC',
                  color:C.mid,
                  fontFamily:PP,
                  fontSize:10.5,
                  fontWeight:750,
                  cursor:'pointer',
                }}
              >
                {reason.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={searchAgain}
            style={{
              marginTop:12,
              border:'none',
              background:'transparent',
              color:C.primary,
              padding:0,
              fontFamily:PP,
              fontSize:11,
              fontWeight:800,
              cursor:'pointer',
            }}
          >
            Volver a buscar →
          </button>
        </>
      ) : (
        <>
          <p id="search-resolution-title" style={{ margin:'0 36px 4px 0', fontFamily:PP, fontSize:16, fontWeight:850, color:C.text }}>
            ¿Encontraste lo que necesitabas?
          </p>
          <p id="search-resolution-description" style={{ margin:'0 28px 13px 0', fontFamily:PP, fontSize:11.5, lineHeight:1.5, color:C.mid }}>
            Sobre tu búsqueda “{pending.query}”
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0, 1fr))', gap:7 }}>
            {ANSWERS.map(option => (
              <button
                key={option.id}
                type="button"
                onClick={() => submitAnswer(option.id)}
                style={{
                  minHeight:42,
                  padding:'8px 5px',
                  border:`1px solid ${option.border}`,
                  borderRadius:12,
                  background:option.background,
                  color:option.color,
                  fontFamily:PP,
                  fontSize:10.5,
                  fontWeight:800,
                  cursor:'pointer',
                }}
              >
                <span aria-hidden="true" style={{ marginRight:4 }}>{option.icon}</span>
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </aside>
  )
}
