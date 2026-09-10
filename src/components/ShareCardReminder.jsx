import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { C, PP } from '../lib/theme'
import { getNegocioTypeMeta } from '../lib/constants'
import { getBusinessPath } from '../lib/seo'
import { getCreatorForUser, subscribeCreatorUpdates } from '../lib/creators'
import {
  getShareCardReminderState,
  markShareCardReminderShown,
  markShareCardShared,
  shouldShowShareCardReminder,
} from '../lib/shareCardReminder'
import CreatorProfileShareButton from './CreatorProfileShareButton'
import BusinessProfileShareModal from './BusinessProfileShareModal'

const BLOCKED_PATH_PREFIXES = [
  '/auth',
  '/reset-password',
  '/admin-latido',
  '/registrar-',
  '/publicar',
  '/creadores/alta',
]

function reminderCandidate(kind, item, userId) {
  if (!item?.id || !shouldShowShareCardReminder(kind, userId, item.id)) return null
  return {
    kind,
    item,
    lastShownAt:Number(getShareCardReminderState(kind, userId, item.id).lastShownAt || 0),
  }
}

function ReminderArtwork() {
  return (
    <img
      src="/head_modal.png"
      alt="Dos diseños de tarjeta disponibles: tarjeta simple y estilo Latido"
      style={{ display:'block', width:'100%', height:'auto' }}
    />
  )
}

export default function ShareCardReminder() {
  const { user, isLoggedIn, loading } = useAuth()
  const location = useLocation()
  const shownThisSessionRef = useRef('')
  const [creator, setCreator] = useState(null)
  const [businesses, setBusinesses] = useState([])
  const [businessesLoaded, setBusinessesLoaded] = useState(false)
  const [noticeTarget, setNoticeTarget] = useState(null)
  const [shareTarget, setShareTarget] = useState(null)

  useEffect(() => {
    setCreator(null)
    setBusinesses([])
    setBusinessesLoaded(false)
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

    supabase
      .from('providers')
      .select('id,user_id,category,name,city,canton,description,photo_url,services,active,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending:false })
      .then(({ data }) => {
        if (!active) return
        setBusinesses((data || []).map(business => ({
          ...business,
          type:business.category,
          desc:business.description,
        })))
        setBusinessesLoaded(true)
      })

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [isLoggedIn, user?.id])

  useEffect(() => {
    if (loading || !isLoggedIn || !user?.id || !businessesLoaded) return undefined
    if (noticeTarget || shareTarget || shownThisSessionRef.current === String(user.id)) return undefined
    if (BLOCKED_PATH_PREFIXES.some(prefix => location.pathname.startsWith(prefix))) return undefined

    const candidates = [
      creator?.active !== false && creator?.status !== 'draft'
        ? reminderCandidate('creator', creator, user.id)
        : null,
      ...businesses
        .filter(business => business.active !== false)
        .map(business => reminderCandidate('business', business, user.id)),
    ]
      .filter(Boolean)
      .sort((a, b) => a.lastShownAt - b.lastShownAt)

    const nextTarget = candidates[0]
    if (!nextTarget) return undefined

    const timer = window.setTimeout(() => {
      markShareCardReminderShown(nextTarget.kind, user.id, nextTarget.item.id)
      shownThisSessionRef.current = String(user.id)
      setNoticeTarget(nextTarget)
    }, 1100)
    return () => window.clearTimeout(timer)
  }, [businesses, businessesLoaded, creator, isLoggedIn, loading, location.pathname, noticeTarget, shareTarget, user?.id])

  const closeNotice = () => setNoticeTarget(null)

  useEffect(() => {
    if (!noticeTarget) return undefined
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

  const isCreatorNotice = noticeTarget?.kind === 'creator'
  const title = isCreatorNotice
    ? 'Tu perfil en una tarjeta'
    : 'Tu negocio en una tarjeta'
  const description = isCreatorNotice
    ? {
        lead:'Elige tu diseño favorito, compártelo o descarga la imagen y ',
        emphasis:'haz visible tu aportación a la comunidad hispanohablante en Suiza.',
      }
    : {
        lead:'Elige tu diseño favorito, compártelo o descarga la imagen para ',
        emphasis:'dar visibilidad a tu negocio y mostrar tu aportación a la comunidad hispanohablante en Suiza.',
      }

  return (
    <>
      {noticeTarget && createPortal(
        <div
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) closeNotice()
          }}
          style={{ position:'fixed', inset:0, zIndex:880, padding:'18px', display:'grid', placeItems:'center', background:'rgba(15,23,42,0.42)', backdropFilter:'blur(3px)' }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-card-reminder-title"
            style={{ position:'relative', width:'min(412px, 100%)', maxHeight:'calc(100dvh - 36px)', overflowY:'auto', border:`1px solid ${C.border}`, borderRadius:22, background:'#fff', boxShadow:'0 24px 65px rgba(15,23,42,0.2)', fontFamily:PP }}
          >
            <button
              type="button"
              aria-label="Cerrar"
              onClick={closeNotice}
              style={{ position:'absolute', zIndex:1, top:13, right:13, width:34, height:34, padding:0, border:`1px solid ${C.border}`, borderRadius:'50%', background:'#fff', color:C.text, display:'grid', placeItems:'center', fontFamily:'Arial, sans-serif', fontSize:25, fontWeight:300, lineHeight:1, cursor:'pointer' }}
            >
              ×
            </button>

            <div style={{ background:'#fff' }}>
              <ReminderArtwork />
            </div>

            <div style={{ padding:'22px 25px 25px', borderTop:`1px solid ${C.border}` }}>
              <h2 id="share-card-reminder-title" style={{ margin:'0 0 8px', color:C.text, fontFamily:PP, fontSize:'clamp(15px, 4.8vw, 20px)', lineHeight:1.2, fontWeight:900, letterSpacing:'-.45px', whiteSpace:'nowrap' }}>
                {title}
              </h2>
              <p style={{ margin:'0 0 20px', color:C.text, fontSize:14, lineHeight:1.55 }}>
                {description.lead}<strong>{description.emphasis}</strong>
              </p>
              <button
                type="button"
                onClick={openShareCard}
                style={{ width:'100%', minHeight:52, border:0, borderRadius:11, background:C.primary, color:'#fff', fontFamily:PP, fontSize:15, fontWeight:800, cursor:'pointer', boxShadow:'0 10px 22px rgba(37,99,235,0.18)' }}
              >
                Crear mi tarjeta
              </button>
              <button
                type="button"
                onClick={closeNotice}
                style={{ width:'100%', marginTop:12, minHeight:38, padding:0, border:0, background:'transparent', color:C.mid, fontFamily:PP, fontSize:14, fontWeight:500, cursor:'pointer' }}
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

      {shareTarget?.kind === 'business' && (
        <BusinessProfileShareModal
          business={shareTarget.item}
          categoryLabel={getNegocioTypeMeta(shareTarget.item.type)?.label || ''}
          imageUrl={shareTarget.item.photo_url || ''}
          url={getBusinessPath(shareTarget.item)}
          isOwner
          open
          onClose={closeShareCard}
          onShared={() => completeShare(shareTarget)}
        />
      )}
    </>
  )
}
