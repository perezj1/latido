import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { C, PP } from '../lib/theme'
import { getCreatorForUser, subscribeCreatorUpdates } from '../lib/creators'
import {
  getShareCardReminderState,
  markShareCardReminderShown,
  markShareCardShared,
  shouldShowShareCardReminder,
} from '../lib/shareCardReminder'
import CreatorProfileShareButton from './CreatorProfileShareButton'
import LatidoCardBusinessInvitation from './LatidoCardBusinessInvitation'
import { cardRpc } from '../lib/latidoCard'

const BLOCKED_PATH_PREFIXES = [
  '/auth',
  '/reset-password',
  '/admin-latido',
  '/registrar-',
  '/publicar',
  '/creadores/alta',
]

function reminderCandidate(kind, item, userId) {
  const contentId = kind === 'benefits' ? 'first-offer' : item?.id
  if (!item?.id || !shouldShowShareCardReminder(kind, userId, contentId)) return null
  return {
    kind,
    item,
    contentId,
    lastShownAt:Number(getShareCardReminderState(kind, userId, contentId).lastShownAt || 0),
  }
}

function ReminderArtwork() {
  return (
    <div style={{ position:'relative', zIndex:4, width:'90%', margin:'0 auto' }}>
      <div style={{ width:'100%', aspectRatio:'1.636 / 1', overflow:'hidden' }}>
        <img
          src="/head_modal.png"
          alt="Dos diseños de tarjeta disponibles: tarjeta simple y estilo Latido"
          style={{ display:'block', width:'100%', height:'100%', objectFit:'cover', objectPosition:'center' }}
        />
      </div>
      <div style={{ position:'relative', height:14, marginTop:2 }}>
        <span style={{ position:'absolute', left:'30.8%', transform:'translateX(-50%)', color:'#64748b', fontSize:9.5, lineHeight:1.2, fontWeight:800, textAlign:'center' }}>Simple</span>
        <span style={{ position:'absolute', left:'69.4%', transform:'translateX(-50%)', color:'#2563eb', fontSize:9.5, lineHeight:1.2, fontWeight:800, textAlign:'center' }}>Latido</span>
      </div>
    </div>
  )
}

export default function ShareCardReminder() {
  const { user, isLoggedIn, loading } = useAuth()
  const location = useLocation()
  const shownThisSessionRef = useRef('')
  const [creator, setCreator] = useState(null)
  const [benefitBusiness, setBenefitBusiness] = useState(null)
  const [benefitsLoaded, setBenefitsLoaded] = useState(false)
  const [noticeTarget, setNoticeTarget] = useState(null)
  const [shareTarget, setShareTarget] = useState(null)

  useEffect(() => {
    setCreator(null)
    setBenefitBusiness(null)
    setBenefitsLoaded(false)
    setNoticeTarget(null)
    setShareTarget(null)
    shownThisSessionRef.current = ''
    if (!isLoggedIn || !user?.id) return undefined

    let active = true
    const syncCreator = () => {
      if (active) setCreator(getCreatorForUser(user.id))
    }
    syncCreator()
    const unsubscribe = subscribeCreatorUpdates(syncCreator)

    cardRpc('lc_business_invitation')
      .then(data => { if (active) setBenefitBusiness(data?.business || null) })
      .catch(() => { /* Optional invitation must not interrupt entry to Latido. */ })
      .finally(() => { if (active) setBenefitsLoaded(true) })

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [isLoggedIn, user?.id])

  useEffect(() => {
    if (loading || !isLoggedIn || !user?.id || !benefitsLoaded) return undefined
    if (noticeTarget || shareTarget || shownThisSessionRef.current === String(user.id)) return undefined
    if (BLOCKED_PATH_PREFIXES.some(prefix => location.pathname.startsWith(prefix))) return undefined

    const candidates = [
      reminderCandidate('benefits', benefitBusiness, user.id),
      creator?.active !== false && creator?.status !== 'draft'
        ? reminderCandidate('creator', creator, user.id)
        : null,
    ]
      .filter(Boolean)
      .sort((a, b) => Number(b.kind === 'benefits') - Number(a.kind === 'benefits') || a.lastShownAt - b.lastShownAt)

    const nextTarget = candidates[0]
    if (!nextTarget) return undefined

    const timer = window.setTimeout(() => {
      if (document.querySelector('dialog[open], [role="dialog"]')) return
      markShareCardReminderShown(nextTarget.kind, user.id, nextTarget.contentId)
      shownThisSessionRef.current = String(user.id)
      setNoticeTarget(nextTarget)
    }, 1100)
    return () => window.clearTimeout(timer)
  }, [benefitsLoaded, benefitBusiness, creator, isLoggedIn, loading, location.pathname, noticeTarget, shareTarget, user?.id])

  const closeNotice = () => setNoticeTarget(null)

  useEffect(() => {
    if (!noticeTarget || noticeTarget.kind === 'benefits') return undefined
    const previousOverflow = document.body.style.overflow
    const handleKeyDown = event => {
      if (event.key === 'Escape') closeNotice()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [noticeTarget])

  const openShareCard = () => {
    setShareTarget(noticeTarget)
    setNoticeTarget(null)
  }

  const closeShareCard = () => setShareTarget(null)

  const completeShare = target => {
    if (target && user?.id) markShareCardShared(target.kind, user.id, target.item.id)
    setShareTarget(null)
  }

  const title = 'Tu perfil en una tarjeta'
  const description = {
    lead:'Elige tu diseño favorito, compártelo o descarga la imagen y ',
    emphasis:'haz visible tu aportación a la comunidad hispanohablante en Suiza.',
  }

  if (noticeTarget?.kind === 'benefits') {
    return <LatidoCardBusinessInvitation business={noticeTarget.item} modal onDismiss={closeNotice} />
  }

  return (
    <>
      {noticeTarget && createPortal(
        <div
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) closeNotice()
          }}
          style={{ position:'fixed', inset:0, zIndex:880, padding:'10px', display:'grid', placeItems:'center', background:'rgba(15,23,42,0.48)', backdropFilter:'blur(4px)' }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-card-reminder-title"
            style={{ position:'relative', width:'min(440px, 100%)', maxHeight:'calc(100dvh - 20px)', overflowY:'auto', overflowX:'hidden', border:`1px solid ${C.border}`, borderRadius:30, background:'linear-gradient(145deg, #fff 0%, #fdfefe 68%, #f8fbff 100%)', boxShadow:'0 28px 75px rgba(15,23,42,0.26)', fontFamily:PP }}
          >
            <button
              type="button"
              aria-label="Cerrar"
              onClick={closeNotice}
              style={{ position:'absolute', zIndex:5, top:14, right:14, width:34, height:34, padding:0, border:`1px solid ${C.border}`, borderRadius:'50%', background:'rgba(255,255,255,.96)', color:C.text, display:'grid', placeItems:'center', fontFamily:'Arial, sans-serif', fontSize:25, fontWeight:300, lineHeight:1, cursor:'pointer', boxShadow:'0 4px 12px rgba(15,23,42,.04)' }}
            >
              ×
            </button>

            <div style={{ position:'relative', padding:'42px 0 8px', overflow:'hidden', background:'transparent' }}>
              <span aria-hidden="true" style={{ position:'absolute', zIndex:1, top:-92, left:-82, width:190, height:190, borderRadius:'50%', background:'linear-gradient(145deg, #ff4d78, #ff365f)' }} />
              <span aria-hidden="true" style={{ position:'absolute', zIndex:1, top:135, left:34, width:12, height:12, borderRadius:'50%', background:'#fbbf24' }} />
              <span aria-hidden="true" style={{ position:'absolute', zIndex:1, top:115, right:34, width:10, height:10, borderRadius:'50%', background:'#fb3f65' }} />
              <span aria-hidden="true" style={{ position:'absolute', zIndex:1, right:-92, bottom:-46, width:170, height:170, borderRadius:'50%', background:'linear-gradient(145deg, #9cf5ef, #36d8cf)' }} />
              <ReminderArtwork />
            </div>

            <div style={{ position:'relative', zIndex:4, padding:'16px 27px 25px' }}>
              <h2 id="share-card-reminder-title" style={{ margin:'0 0 12px', color:C.text, fontFamily:PP, fontSize:'clamp(15px, 5.2vw, 22px)', lineHeight:1.2, fontWeight:900, letterSpacing:'-.55px', whiteSpace:'nowrap' }}>
                {title}
              </h2>
              <p style={{ margin:'0 0 24px', color:C.text, fontSize:14, lineHeight:1.65 }}>
                {description.lead}<strong>{description.emphasis}</strong>
              </p>
              <button
                type="button"
                onClick={openShareCard}
                style={{ width:'100%', minHeight:48, border:0, borderRadius:14, background:'linear-gradient(135deg, #2563eb 0%, #1675f8 100%)', color:'#fff', fontFamily:PP, fontSize:13, fontWeight:800, cursor:'pointer', boxShadow:'0 10px 22px rgba(37,99,235,0.2)', display:'flex', alignItems:'center', justifyContent:'center', gap:9 }}
              >
                <span>Crear mi tarjeta</span>
                <span aria-hidden="true" style={{ fontFamily:'Arial, sans-serif', fontSize:21, lineHeight:1, fontWeight:400 }}>→</span>
              </button>
              <button
                type="button"
                onClick={closeNotice}
                style={{ width:'100%', marginTop:10, minHeight:34, padding:0, border:0, background:'transparent', color:C.mid, fontFamily:PP, fontSize:12, fontWeight:600, cursor:'pointer' }}
              >
                Ahora no
              </button>
            </div>
          </section>
        </div>,
        document.body,
      )}

      {shareTarget?.kind === 'creator' && (
        <CreatorProfileShareButton
          creator={shareTarget.item}
          isOwner
          showTrigger={false}
          open
          onClose={closeShareCard}
          onShared={() => completeShare(shareTarget)}
        />
      )}

    </>
  )
}
