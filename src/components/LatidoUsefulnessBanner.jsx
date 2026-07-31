import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { trackAnalyticsEvent } from '../lib/analytics'
import {
  getLatidoRating,
  isLatidoRatingDue,
  notifyLatidoUsefulnessSubmitted,
  saveLatidoUsefulnessFeedback,
} from '../lib/feedback'
import { C, PP } from '../lib/theme'

const BANNER_LIFT_VAR = '--latido-install-banner-lift'
const THANK_YOU_DELAY_MS = 2_200

const ANSWERS = [
  { id:'yes', label:'Sí', icon:'✓', color:'#047857', background:'#ECFDF5', border:'#A7F3D0' },
  { id:'partial', label:'Parcialmente', icon:'◐', color:'#B45309', background:'#FFFBEB', border:'#FDE68A' },
  { id:'no', label:'No mucho', icon:'×', color:'#B91C1C', background:'#FEF2F2', border:'#FECACA' },
]

const FOLLOW_UPS = {
  yes:{
    title:'¿En qué te ha ayudado Latido?',
    options:[
      { id:'found_what_needed', label:'Encontré lo que buscaba', icon:'🔎' },
      { id:'contacted_someone', label:'Contacté con alguien', icon:'🤝' },
      { id:'discovered_nearby', label:'Descubrí algo cerca de mí', icon:'📍' },
      { id:'published_got_responses', label:'Publiqué y recibí respuestas', icon:'📣' },
      { id:'found_useful_information', label:'Encontré información útil', icon:'💡' },
      { id:'connected_with_community', label:'Me ayudó a conectar con la comunidad', icon:'👥' },
    ],
  },
  partial:{
    title:'¿Qué necesitas para que Latido te resulte más útil?',
    options:[
      { id:'more_offers', label:'Más ofertas', icon:'📣' },
      { id:'clearer_information', label:'Información más clara', icon:'📝' },
      { id:'more_relevant_results', label:'Resultados más relevantes', icon:'🎯' },
      { id:'more_nearby_content', label:'Más contenido cerca de mí', icon:'📍' },
      { id:'better_filters', label:'Mejores filtros', icon:'⚙️' },
      { id:'new_content_alerts', label:'Avisos sobre novedades', icon:'🔔' },
      { id:'other', label:'Otro motivo', icon:'💬' },
    ],
  },
  no:{
    title:'¿Qué te ha faltado?',
    options:[
      { id:'cannot_find', label:'No encuentro lo que busco', icon:'🔎' },
      { id:'few_offers', label:'Hay pocas ofertas', icon:'📉' },
      { id:'irrelevant_content', label:'El contenido no es relevante para mí', icon:'🎯' },
      { id:'unclear_how_it_works', label:'No entiendo bien cómo funciona', icon:'❓' },
      { id:'not_used_enough', label:'Todavía no lo he usado suficiente', icon:'⏳' },
      { id:'other', label:'Otro motivo', icon:'💬' },
    ],
  },
}

export default function LatidoUsefulnessBanner({ blocked = false }) {
  const location = useLocation()
  const { user, isLoggedIn, isAdmin } = useAuth()
  const bannerRef = useRef(null)
  const completionTimerRef = useRef(null)
  const [loaded, setLoaded] = useState(false)
  const [answered, setAnswered] = useState(false)
  const [step, setStep] = useState('question')
  const [answer, setAnswer] = useState('')
  const [detail, setDetail] = useState('')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const previewRequested = new URLSearchParams(location.search).get('usefulness-preview') === '1'
  const preview = previewRequested && (import.meta.env.DEV || isAdmin)
  const isEligible = preview || (
    isLoggedIn
    && !isAdmin
    && isLatidoRatingDue(user?.created_at)
    && loaded
    && !answered
  )
  const shouldShow = location.pathname === '/'
    && isEligible
    && !blocked
    && step !== 'hidden'

  useEffect(() => {
    setLoaded(false)
    setAnswered(false)
    setStep('question')
    setAnswer('')
    setDetail('')
    setComment('')
    setErrorMessage('')

    if (!isLoggedIn || !user?.id || isAdmin) {
      setLoaded(true)
      return undefined
    }

    let active = true
    void getLatidoRating(user.id)
      .then(rating => {
        if (!active) return
        setAnswered(Boolean(rating?.usefulness_answer))
        setLoaded(true)
      })
      .catch(error => {
        console.warn('Could not load Latido usefulness feedback:', error)
        if (active) setLoaded(false)
      })

    return () => {
      active = false
    }
  }, [isAdmin, isLoggedIn, user?.id])

  useEffect(() => () => {
    if (completionTimerRef.current) window.clearTimeout(completionTimerRef.current)
  }, [])

  useLayoutEffect(() => {
    if (!shouldShow) return undefined

    const node = bannerRef.current
    if (!node) return undefined

    const updateLift = () => {
      const height = node.getBoundingClientRect().height
      document.documentElement.style.setProperty(BANNER_LIFT_VAR, `${Math.ceil(height + 20)}px`)
    }

    updateLift()
    window.addEventListener('resize', updateLift)

    let observer
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateLift)
      observer.observe(node)
    }

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', updateLift)
      document.documentElement.style.removeProperty(BANNER_LIFT_VAR)
    }
  }, [shouldShow, step])

  const finish = () => {
    setStep('thanks')
    if (completionTimerRef.current) window.clearTimeout(completionTimerRef.current)
    completionTimerRef.current = window.setTimeout(() => setStep('hidden'), THANK_YOU_DELAY_MS)
  }

  const saveResponse = async (nextAnswer, nextDetail, nextComment = '') => {
    if (!user?.id || saving) return null

    setSaving(true)
    setErrorMessage('')
    try {
      const rating = await saveLatidoUsefulnessFeedback({
        userId:user.id,
        answer:nextAnswer,
        detail:nextDetail,
        comment:nextComment,
        accountCreatedAt:user.created_at,
      })
      notifyLatidoUsefulnessSubmitted(rating)
      if (!isAdmin) {
        trackAnalyticsEvent('latido_usefulness_feedback', {
          user_id:user.id,
          metadata:{
            answer:nextAnswer,
            detail:nextDetail,
            has_comment:Boolean(String(nextComment || '').trim()),
          },
        })
      }
      return rating
    } catch (error) {
      console.warn('Could not save Latido usefulness feedback:', error)
      setErrorMessage('No pudimos guardar tu respuesta. Inténtalo de nuevo.')
      return null
    } finally {
      setSaving(false)
    }
  }

  const chooseAnswer = nextAnswer => {
    if (saving) return
    setAnswer(nextAnswer)
    setDetail('')
    setErrorMessage('')
    setStep('followup')
  }

  const chooseDetail = async nextDetail => {
    if (!answer || saving) return
    setDetail(nextDetail)
    const saved = await saveResponse(answer, nextDetail)
    if (!saved) return

    if (answer === 'no') {
      setStep('comment')
    } else {
      finish()
    }
  }

  const submitComment = async event => {
    event.preventDefault()
    const saved = await saveResponse(answer, detail, comment)
    if (saved) finish()
  }

  if (!shouldShow) return null

  const followUp = FOLLOW_UPS[answer]

  return (
    <div
      ref={bannerRef}
      style={{
        position:'fixed',
        bottom:'calc(96px + env(safe-area-inset-bottom))',
        left:'env(safe-area-inset-left)',
        right:'env(safe-area-inset-right)',
        zIndex:200,
        padding:'0 12px',
        pointerEvents:'none',
      }}
    >
      <aside
        className="fade-up"
        role="dialog"
        aria-labelledby="latido-usefulness-title"
        aria-describedby="latido-usefulness-description"
        style={{
          position:'relative',
          width:'100%',
          maxWidth:480,
          margin:'0 auto',
          padding:16,
          background:'rgba(255,255,255,0.98)',
          border:`1px solid ${C.border}`,
          borderRadius:20,
          boxShadow:'0 18px 50px rgba(15,23,42,0.2)',
          backdropFilter:'blur(16px)',
          WebkitBackdropFilter:'blur(16px)',
          pointerEvents:'all',
        }}
      >
        {step === 'thanks' ? (
          <div aria-live="polite" style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 2px' }}>
            <span aria-hidden="true" style={{ width:42, height:42, display:'grid', placeItems:'center', flexShrink:0, borderRadius:14, background:C.successLight, color:'#047857', fontSize:22, fontWeight:900 }}>✓</span>
            <div>
              <p id="latido-usefulness-title" style={{ margin:'0 0 3px', fontFamily:PP, fontSize:15, fontWeight:850, color:C.text }}>¡Gracias!</p>
              <p id="latido-usefulness-description" style={{ margin:0, fontFamily:PP, fontSize:11.5, lineHeight:1.5, color:C.mid }}>Tu opinión es lo más importante para nosotros.</p>
            </div>
          </div>
        ) : step === 'comment' ? (
          <form onSubmit={submitComment}>
            <p id="latido-usefulness-title" style={{ margin:'0 0 4px', fontFamily:PP, fontSize:16, fontWeight:850, color:C.text }}>
              ¿Qué te gustaría encontrar en Latido?
            </p>
            <p id="latido-usefulness-description" style={{ margin:'0 0 10px', fontFamily:PP, fontSize:11.5, lineHeight:1.5, color:C.mid }}>
              La respuesta es opcional.
            </p>
            <textarea
              value={comment}
              onChange={event => setComment(event.target.value.slice(0, 150))}
              maxLength={150}
              rows={2}
              placeholder="Escribe una respuesta breve…"
              style={{
                width:'100%',
                minHeight:62,
                resize:'none',
                border:`1px solid ${C.border}`,
                borderRadius:12,
                padding:'10px 11px',
                outline:'none',
                fontFamily:PP,
                fontSize:11,
                lineHeight:1.45,
                color:C.text,
                background:'#F8FAFC',
              }}
            />
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, marginTop:8 }}>
              <span style={{ fontFamily:PP, fontSize:9.5, color:C.light }}>{comment.length}/150</span>
              <div style={{ display:'flex', gap:7 }}>
                <button
                  type="button"
                  onClick={finish}
                  disabled={saving}
                  style={{ border:'none', background:'transparent', color:C.mid, padding:'8px 9px', fontFamily:PP, fontSize:10.5, fontWeight:750, cursor:'pointer' }}
                >
                  Omitir
                </button>
                <button
                  type="submit"
                  disabled={saving || !comment.trim()}
                  style={{ border:'none', borderRadius:10, background:C.primary, color:'#fff', padding:'8px 14px', fontFamily:PP, fontSize:10.5, fontWeight:800, cursor:saving || !comment.trim() ? 'default' : 'pointer', opacity:saving || !comment.trim() ? 0.55 : 1 }}
                >
                  {saving ? 'Guardando…' : 'Enviar'}
                </button>
              </div>
            </div>
          </form>
        ) : step === 'followup' && followUp ? (
          <>
            <p id="latido-usefulness-title" style={{ margin:'0 0 10px', fontFamily:PP, fontSize:15, fontWeight:850, lineHeight:1.35, color:C.text }}>
              {followUp.title}
            </p>
            <p id="latido-usefulness-description" style={{ position:'absolute', width:1, height:1, overflow:'hidden', clip:'rect(0 0 0 0)' }}>
              Elige una opción.
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:7 }}>
              {followUp.options.map(option => (
                <button
                  key={option.id}
                  type="button"
                  disabled={saving}
                  onClick={() => chooseDetail(option.id)}
                  style={{
                    minWidth:0,
                    minHeight:48,
                    display:'flex',
                    alignItems:'center',
                    gap:7,
                    padding:'7px 8px',
                    border:`1px solid ${detail === option.id ? C.primary : C.border}`,
                    borderRadius:13,
                    background:detail === option.id ? C.primaryLight : '#F8FAFC',
                    color:detail === option.id ? C.primary : C.mid,
                    fontFamily:PP,
                    fontSize:9.5,
                    lineHeight:1.25,
                    fontWeight:750,
                    textAlign:'left',
                    cursor:saving ? 'wait' : 'pointer',
                    opacity:saving && detail !== option.id ? 0.6 : 1,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width:28,
                      height:28,
                      display:'grid',
                      placeItems:'center',
                      flexShrink:0,
                      borderRadius:9,
                      background:detail === option.id ? '#DBEAFE' : '#EEF2F8',
                      fontSize:13,
                    }}
                  >
                    {option.icon}
                  </span>
                  <span style={{ flex:1, minWidth:0 }}>{option.label}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p id="latido-usefulness-title" style={{ margin:'0 0 4px', fontFamily:PP, fontSize:16, fontWeight:850, color:C.text }}>
              ¿Te parece útil Latido?
            </p>
            <p id="latido-usefulness-description" style={{ margin:'0 0 13px', fontFamily:PP, fontSize:11.5, lineHeight:1.5, color:C.mid }}>
              Queremos adaptar Latido a lo que realmente necesitas.
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0, 1fr))', gap:7 }}>
              {ANSWERS.map(option => (
                <button
                  key={option.id}
                  type="button"
                  disabled={saving}
                  onClick={() => chooseAnswer(option.id)}
                  style={{
                    minHeight:42,
                    padding:'8px 4px',
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

        {errorMessage && (
          <p role="alert" style={{ margin:'9px 0 0', fontFamily:PP, fontSize:10.5, lineHeight:1.4, color:'#B91C1C' }}>
            {errorMessage}
          </p>
        )}
      </aside>
    </div>
  )
}
