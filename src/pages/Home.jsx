import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useZoneAlerts, dismissZoneAlerts } from '../hooks/useZoneAlerts'
import { useUnreadMessages } from '../hooks/useUnreadMessages'
import { useOverlayHistory } from '../hooks/useOverlayHistory'
import GlobalSearch from '../components/GlobalSearch'
// PARTNERS DESACTIVADOS TEMPORALMENTE:
// import PartnersSection from '../components/PartnersSection'
import { C, PP } from '../lib/theme'
import { Avatar, Tag, PrivacyTag, RatingPill } from '../components/UI'
import EventfrogCalendar from '../components/EventfrogCalendar'
import { MOCK_DOCS, formatAdLocation, getAdCategoryId, getAdDisplayCat, getAdDisplayEmoji, getJobCategoryEmoji, getJobIntentMeta, getNegocioTypeMeta } from '../lib/constants'
import { getBusinessVerificationStatus } from '../lib/businessVerification'
import { getMissingColumnName } from '../lib/supabaseCompat'
import toast from 'react-hot-toast'

const fmtPrice = p => {
  if (!p) return ''
  let s = p.trim()
  s = s.replace(/^([\d.,]+)\s+CHF\b(.*)/, 'CHF $1$2')          // "25 CHF x" → "CHF 25 x"
  s = s.replace(/^(CHF\s*[\d.,]+)\s+([^\s/].*)$/, '$1/$2')     // "CHF 25 total" → "CHF 25/total"
  return s
}

const CAT_COLORS = {
  vivienda:{ bg:'#DBEAFE', tc:'#1D4ED8' },
  cuidados:{ bg:'#FCE7F3', tc:'#9D174D' },
  documentos:{ bg:'#EDE9FE', tc:'#6D28D9' },
  venta:{ bg:'#FEF3C7', tc:'#92400E' },
  servicios:{ bg:'#CCFBF1', tc:'#0F766E' },
  regalo:{ bg:'#FEE2E2', tc:'#B91C1C' },
  empleo:{ bg:'#DBEAFE', tc:'#1D4ED8' },
}

const REVIEWABLE_AD_CATS = new Set(['servicios', 'cuidados'])

function averageRating(reviews) {
  if (!reviews?.length) return null
  return +(reviews.reduce((sum, review) => sum + Number(review.stars || 0), 0) / reviews.length).toFixed(1)
}

const COMMUNITY_HOME_SELECT = {
  withPhoto:'id, name, city, members, emoji, cat, desc, contact, photo_url, created_at, active',
  safe:'id, name, city, members, emoji, cat, desc, contact, created_at, active',
}

async function fetchHomeCommunities() {
  const buildQuery = columns => supabase
    .from('communities')
    .select(columns)
    .or('active.is.null,active.eq.true')
    .order('created_at', { ascending:false })
    .limit(12)

  const response = await buildQuery(COMMUNITY_HOME_SELECT.withPhoto)
  if (getMissingColumnName(response.error, 'communities') === 'photo_url') {
    return buildQuery(COMMUNITY_HOME_SELECT.safe)
  }
  return response
}

function formatTimeAgo(value) {
  if (!value) return 'Ahora'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Ahora'

  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'Ahora'
  if (diffMin < 60) return `hace ${diffMin} min`
  if (diffHour < 24) return `hace ${diffHour} h`
  if (diffDay < 7) return `hace ${diffDay} d`

  return date.toLocaleDateString('es-CH', {
    day:'2-digit',
    month:'2-digit',
    year:'numeric',
  })
}

function EmptyState({ text }) {
  return (
    <div
      style={{
        background:'#fff',
        border:`1px solid ${C.border}`,
        borderRadius:18,
        padding:'18px 16px',
      }}
    >
      <p style={{ fontFamily:PP, fontSize:12, color:C.light, margin:0 }}>
        {text}
      </p>
    </div>
  )
}

const HOME_CACHE_TTL = 5 * 60 * 1000
let homeCache = null
let homeCacheTs = 0

const EVENT_MONTH_INDEX = {
  ENE:0, JAN:0,
  FEB:1,
  MAR:2,
  ABR:3, APR:3,
  MAY:4,
  JUN:5,
  JUL:6,
  AGO:7, AUG:7,
  SEP:8, SET:8,
  OCT:9,
  NOV:10,
  DIC:11, DEC:11,
}
const AD_REVIEW_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000

function normalizeMonthKey(value='') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .slice(0, 3)
    .toUpperCase()
}

function getTimeMs(value) {
  if (!value) return 0
  const date = new Date(value)
  const time = date.getTime()
  return Number.isNaN(time) ? 0 : time
}

function getEventEndDate(row={}) {
  const day = Number.parseInt(row.day, 10)
  const month = EVENT_MONTH_INDEX[normalizeMonthKey(row.month)]
  const year = Number.parseInt(row.year, 10) || new Date().getFullYear()
  if (!day || month === undefined || !year) return null

  const date = new Date(year, month, day, 23, 59, 59, 999)
  return Number.isNaN(date.getTime()) ? null : date
}

function isExpiredEvent(row={}) {
  const endDate = getEventEndDate(row)
  return !!row.active && !!endDate && endDate < new Date()
}

function isExpiredEventDueForReview(row={}, confirmations={}) {
  if (!isExpiredEvent(row)) return false
  const confirmedAt = getTimeMs(confirmations[row.id])
  return !confirmedAt || Date.now() - confirmedAt >= AD_REVIEW_INTERVAL_MS
}

function isPublicationDueForReview(row={}, confirmations={}) {
  if (!row.active) return false
  const createdAt = getTimeMs(row.created_at)
  if (!createdAt || Date.now() - createdAt < AD_REVIEW_INTERVAL_MS) return false

  const reviewAnchor = Math.max(
    createdAt,
    getTimeMs(row.updated_at),
    getTimeMs(confirmations[row.id])
  )

  return Date.now() - reviewAnchor >= AD_REVIEW_INTERVAL_MS
}

function normalizePhotoUrls(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.filter(Boolean)
    } catch {
      return value.split(',').map(url => url.trim()).filter(Boolean)
    }
  }
  return []
}

function hasImageForKind(kind, row={}) {
  if (kind === 'ad') return !!(row.img_url || normalizePhotoUrls(row.photo_urls).length)
  if (kind === 'job') return !!row.logo_url
  if (kind === 'event') return !!row.img_url
  if (kind === 'business' || kind === 'community') return !!row.photo_url
  return false
}

function isMissingImageDueForReview(kind, row={}, confirmations={}) {
  if (!row.active || hasImageForKind(kind, row)) return false
  const confirmedAt = getTimeMs(confirmations[`${kind}:${row.id}`])
  return !confirmedAt || Date.now() - confirmedAt >= AD_REVIEW_INTERVAL_MS
}

function buildExpiredEventsTask(items) {
  return {
    id:'expired-events',
    emoji:'🎉',
    title: items.length === 1 ? 'Evento con fecha pasada' : 'Eventos con fecha pasada',
    text: items.length === 1
      ? 'Tienes un evento activo que ya pasó.'
      : `Tienes ${items.length} eventos activos que ya pasaron.`,
    tone:'warn',
    items,
  }
}

function buildAdReviewTask(items) {
  return {
    id:'ad-review',
    emoji:'📌',
    title: items.length === 1 ? 'Confirma tu anuncio' : 'Confirma tus anuncios',
    text: items.length === 1
      ? 'Un anuncio lleva más de 30 días activo.'
      : `${items.length} anuncios llevan más de 30 días activos.`,
    tone:'primary',
    items,
  }
}

function buildJobReviewTask(items) {
  return {
    id:'job-review',
    emoji:'💼',
    title: items.length === 1 ? 'Confirma tu empleo' : 'Confirma tus empleos',
    text: items.length === 1
      ? 'Un empleo lleva más de 30 días activo.'
      : `${items.length} empleos llevan más de 30 días activos.`,
    tone:'primary',
    items,
  }
}

function buildBusinessReviewTask(items) {
  return {
    id:'business-review',
    emoji:'🏪',
    title: items.length === 1 ? 'Confirma tu negocio' : 'Confirma tus negocios',
    text: items.length === 1
      ? 'Un negocio lleva más de 30 días activo.'
      : `${items.length} negocios llevan más de 30 días activos.`,
    tone:'primary',
    items,
  }
}

function buildCommunityReviewTask(items) {
  return {
    id:'community-review',
    emoji:'👥',
    title: items.length === 1 ? 'Confirma tu grupo' : 'Confirma tus grupos',
    text: items.length === 1
      ? 'Un grupo lleva más de 30 días activo.'
      : `${items.length} grupos llevan más de 30 días activos.`,
    tone:'primary',
    items,
  }
}

function buildMissingImageTask(items) {
  return {
    id:'missing-image',
    emoji:'🖼',
    title: items.length === 1 ? 'Añade una imagen' : 'Añade imágenes',
    text: items.length === 1
      ? 'Una publicación activa no tiene imagen.'
      : `${items.length} publicaciones activas no tienen imagen.`,
    tone:'primary',
    mode:'image',
    items,
  }
}

function buildAttentionTask(taskId, items) {
  if (taskId === 'missing-image') return buildMissingImageTask(items)
  if (taskId === 'expired-events') return buildExpiredEventsTask(items)
  if (taskId === 'job-review') return buildJobReviewTask(items)
  if (taskId === 'business-review') return buildBusinessReviewTask(items)
  if (taskId === 'community-review') return buildCommunityReviewTask(items)
  return buildAdReviewTask(items)
}

const ATTENTION_TASK_STORAGE = {
  'missing-image':'latido_missing_image_confirmations',
  'expired-events':'latido_event_review_confirmations',
  'ad-review':'latido_ad_review_confirmations',
  'job-review':'latido_job_review_confirmations',
  'business-review':'latido_business_review_confirmations',
  'community-review':'latido_community_review_confirmations',
}

const ATTENTION_TASK_TABLE = {
  'missing-image':'listings',
  'expired-events':'events',
  'ad-review':'listings',
  'job-review':'jobs',
  'business-review':'providers',
  'community-review':'communities',
}

const ATTENTION_TASK_KIND = {
  'missing-image':'ad',
  'expired-events':'event',
  'ad-review':'ad',
  'job-review':'job',
  'business-review':'business',
  'community-review':'community',
}

function makeAttentionItem(kind, row, overrides={}) {
  return {
    id: row.id,
    uid:`${kind}:${row.id}`,
    kind,
    table: overrides.table || ATTENTION_TASK_TABLE[`${kind}-review`] || 'listings',
    title: overrides.title || row.title || row.name || 'Publicación',
    meta: overrides.meta || '',
    image: overrides.image || '',
    emoji: overrides.emoji || '📌',
  }
}

export default function Home() {
  const { displayName, isLoggedIn, user } = useAuth()
  const navigate = useNavigate()
  const { alertItems, alertCount } = useZoneAlerts()
  const { unreadConvIds, hasUnread } = useUnreadMessages()

  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef(null)

  const [recentAds, setRecentAds] = useState([])
  const [communityHighlights, setCommunityHighlights] = useState([])
  const [businessHighlights, setBusinessHighlights] = useState([])
  const [recentJobs, setRecentJobs] = useState([])
  const [recentEvents, setRecentEvents] = useState([])
  const [attentionTasks, setAttentionTasks] = useState([])
  const [loadingAttention, setLoadingAttention] = useState(false)
  const [expandedAttentionTask, setExpandedAttentionTask] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedGuide, setSelectedGuide] = useState(null)
  useOverlayHistory(!!selectedGuide, () => setSelectedGuide(null))

  const hasNotif = alertCount > 0 || hasUnread
  const visibleAttentionTasks = useMemo(() => loadingAttention ? [] : attentionTasks, [attentionTasks, loadingAttention])

  // Close panel on outside click
  function closeNotifPanel() {
    dismissZoneAlerts() // mark zone alerts as seen on close
    setNotifOpen(false)
  }

  useEffect(() => {
    if (!notifOpen) return
    function onClickOut(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) closeNotifPanel()
    }
    document.addEventListener('mousedown', onClickOut)
    return () => document.removeEventListener('mousedown', onClickOut)
  }, [notifOpen])

  const firstName = (displayName || 'amigo').split(' ')[0]

  const getAdHref = (ad) => String(ad.id).startsWith('job_')
    ? `/tablon?cat=empleo&openJob=${encodeURIComponent(String(ad.id).replace('job_', ''))}`
    : `/tablon?openAd=${encodeURIComponent(ad.id)}`
  const getCommunityHref = (group) => `/comunidades?openCommunity=${encodeURIComponent(group.id)}`
  const getBusinessHref = (business) => `/comunidades?view=negocios&openBusiness=${encodeURIComponent(business.id)}`
  const getJobHref = (job) => `/tablon?cat=empleo&openJob=${encodeURIComponent(job.id)}`

  const fetchAttentionTasks = useCallback(async () => {
    if (!isLoggedIn || !user?.id) {
      setAttentionTasks([])
      return
    }

    setLoadingAttention(true)
    try {
      const [eventsRes, listingsRes, jobsRes, providersRes, communitiesRes] = await Promise.all([
        supabase
          .from('events')
          .select('*')
          .eq('user_id', user.id)
          .eq('active', true)
          .order('created_at', { ascending:false })
          .limit(30),
        supabase
          .from('listings')
          .select('*')
          .eq('user_id', user.id)
          .eq('active', true)
          .order('created_at', { ascending:false })
          .limit(50),
        supabase
          .from('jobs')
          .select('*')
          .eq('user_id', user.id)
          .eq('active', true)
          .order('created_at', { ascending:false })
          .limit(40),
        supabase
          .from('providers')
          .select('*')
          .eq('user_id', user.id)
          .eq('active', true)
          .order('created_at', { ascending:false })
          .limit(40),
        supabase
          .from('communities')
          .select('*')
          .eq('user_id', user.id)
          .eq('active', true)
          .order('created_at', { ascending:false })
          .limit(40),
      ])

      if (eventsRes.error) console.error('Error loading attention events:', eventsRes.error)
      if (listingsRes.error) console.error('Error loading attention listings:', listingsRes.error)
      if (jobsRes.error) console.error('Error loading attention jobs:', jobsRes.error)
      if (providersRes.error) console.error('Error loading attention providers:', providersRes.error)
      if (communitiesRes.error) console.error('Error loading attention communities:', communitiesRes.error)

      const loadConfirmations = key => {
        try {
          return JSON.parse(localStorage.getItem(`${key}:${user.id}`) || '{}')
        } catch {
          return {}
        }
      }

      const eventConfirmations = loadConfirmations(ATTENTION_TASK_STORAGE['expired-events'])
      const adConfirmations = loadConfirmations(ATTENTION_TASK_STORAGE['ad-review'])
      const jobConfirmations = loadConfirmations(ATTENTION_TASK_STORAGE['job-review'])
      const businessConfirmations = loadConfirmations(ATTENTION_TASK_STORAGE['business-review'])
      const communityConfirmations = loadConfirmations(ATTENTION_TASK_STORAGE['community-review'])
      const missingImageConfirmations = loadConfirmations(ATTENTION_TASK_STORAGE['missing-image'])

      const expiredEvents = ((eventsRes.error ? [] : eventsRes.data) || []).filter(row => isExpiredEventDueForReview(row, eventConfirmations))
      const adsToReview = ((listingsRes.error ? [] : listingsRes.data) || []).filter(row => isPublicationDueForReview(row, adConfirmations))
      const jobsToReview = ((jobsRes.error ? [] : jobsRes.data) || []).filter(row => isPublicationDueForReview(row, jobConfirmations))
      const businessesToReview = ((providersRes.error ? [] : providersRes.data) || []).filter(row => isPublicationDueForReview(row, businessConfirmations))
      const communitiesToReview = ((communitiesRes.error ? [] : communitiesRes.data) || []).filter(row => isPublicationDueForReview(row, communityConfirmations))
      const missingImageItems = [
        ...((listingsRes.error ? [] : listingsRes.data) || [])
          .filter(row => isMissingImageDueForReview('ad', row, missingImageConfirmations))
          .map(row => makeAttentionItem('ad', row, {
            table:'listings',
            title: row.title || 'Anuncio',
            meta: [formatAdLocation(row), getAdDisplayCat(row)?.label].filter(Boolean).join(' · '),
            emoji: getAdDisplayEmoji(row) || '📌',
          })),
        ...((jobsRes.error ? [] : jobsRes.data) || [])
          .filter(row => isMissingImageDueForReview('job', row, missingImageConfirmations))
          .map(row => makeAttentionItem('job', row, {
            table:'jobs',
            title: row.title || 'Empleo',
            meta: [row.company, row.city || row.canton].filter(Boolean).join(' · '),
            emoji: getJobCategoryEmoji(row) || '💼',
          })),
        ...((eventsRes.error ? [] : eventsRes.data) || [])
          .filter(row => isMissingImageDueForReview('event', row, missingImageConfirmations))
          .map(row => makeAttentionItem('event', row, {
            table:'events',
            title: row.title || 'Evento',
            meta: [[row.day, row.month, row.year].filter(Boolean).join(' '), row.city || row.canton].filter(Boolean).join(' · '),
            emoji:'🎉',
          })),
        ...((providersRes.error ? [] : providersRes.data) || [])
          .filter(row => isMissingImageDueForReview('business', row, missingImageConfirmations))
          .map(row => makeAttentionItem('business', row, {
            table:'providers',
            title: row.name || 'Negocio',
            meta: [row.city || row.canton, row.category].filter(Boolean).join(' · '),
            emoji:'🏪',
          })),
        ...((communitiesRes.error ? [] : communitiesRes.data) || [])
          .filter(row => isMissingImageDueForReview('community', row, missingImageConfirmations))
          .map(row => makeAttentionItem('community', row, {
            table:'communities',
            title: row.name || 'Grupo',
            meta: [row.city || 'Suiza', row.contact].filter(Boolean).join(' · '),
            emoji: row.emoji || '👥',
          })),
      ]
      const nextTasks = []

      if (missingImageItems.length) {
        nextTasks.push(buildMissingImageTask(missingImageItems))
      }

      if (expiredEvents.length) {
        nextTasks.push(buildExpiredEventsTask(expiredEvents.map(row => ({
          id: row.id,
          kind:'event',
          title: row.title || 'Evento',
          meta: [[row.day, row.month, row.year].filter(Boolean).join(' '), row.city || row.canton].filter(Boolean).join(' · '),
          image: row.img_url || '',
          emoji:'🎉',
        }))))
      }

      if (adsToReview.length) {
        nextTasks.push(buildAdReviewTask(adsToReview.map(row => ({
          id: row.id,
          kind:'ad',
          title: row.title || 'Anuncio',
          meta: [formatAdLocation(row), row.price].filter(Boolean).join(' · '),
          image: row.img_url || '',
          emoji: getAdDisplayEmoji(row) || '📌',
        }))))
      }

      if (jobsToReview.length) {
        nextTasks.push(buildJobReviewTask(jobsToReview.map(row => ({
          id: row.id,
          kind:'job',
          title: row.title || 'Empleo',
          meta: [row.company, row.city || row.canton, row.salary].filter(Boolean).join(' · '),
          image: row.logo_url || '',
          emoji: getJobCategoryEmoji(row) || '💼',
        }))))
      }

      if (businessesToReview.length) {
        nextTasks.push(buildBusinessReviewTask(businessesToReview.map(row => ({
          id: row.id,
          kind:'business',
          title: row.name || 'Negocio',
          meta: [row.city || row.canton, row.category].filter(Boolean).join(' · '),
          image: row.photo_url || '',
          emoji:'🏪',
        }))))
      }

      if (communitiesToReview.length) {
        nextTasks.push(buildCommunityReviewTask(communitiesToReview.map(row => ({
          id: row.id,
          kind:'community',
          title: row.name || 'Grupo',
          meta: [row.city || 'Suiza', row.contact].filter(Boolean).join(' · '),
          image: row.photo_url || '',
          emoji: row.emoji || '👥',
        }))))
      }

      setAttentionTasks(nextTasks)
    } catch (error) {
      console.error('Error loading attention tasks:', error)
      setAttentionTasks([])
    } finally {
      setLoadingAttention(false)
    }
  }, [isLoggedIn, user?.id])

  const removeAttentionItem = useCallback((taskId, itemId) => {
    setAttentionTasks(prev => prev.flatMap(task => {
      if (task.id !== taskId) return [task]
      const items = task.items.filter(item => (item.uid || item.id) !== itemId)
      if (!items.length) return []
      return [buildAttentionTask(taskId, items)]
    }))
  }, [])

  const keepAttentionItem = useCallback((taskId, item) => {
    if (!user?.id) return
    const storageKey = `${ATTENTION_TASK_STORAGE[taskId] || ATTENTION_TASK_STORAGE['ad-review']}:${user.id}`

    let confirmations = {}
    try {
      confirmations = JSON.parse(localStorage.getItem(storageKey) || '{}')
    } catch {
      confirmations = {}
    }

    localStorage.setItem(storageKey, JSON.stringify({
      ...confirmations,
      [item.uid || item.id]: new Date().toISOString(),
    }))
    removeAttentionItem(taskId, item.uid || item.id)
    toast.success(taskId === 'missing-image'
      ? 'Se mantiene sin imagen por ahora'
      : taskId === 'expired-events'
        ? 'Evento mantenido'
        : 'Publicación confirmada')
  }, [removeAttentionItem, user?.id])

  const editAttentionItem = useCallback((taskId, item) => {
    const kind = item.kind || ATTENTION_TASK_KIND[taskId] || 'ad'
    navigate(`/perfil?editar=${kind}:${encodeURIComponent(item.id)}`)
  }, [navigate])

  const deleteAttentionItem = useCallback(async (taskId, item) => {
    if (!user?.id) return
    const confirmed = window.confirm(`¿Seguro que quieres eliminar?\n\n${item.title}`)
    if (!confirmed) return

    const table = item.table || ATTENTION_TASK_TABLE[taskId] || 'listings'
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', item.id)
        .eq('user_id', user.id)

      if (error) throw error
      removeAttentionItem(taskId, item.uid || item.id)
      toast.success(taskId === 'expired-events' ? 'Evento eliminado' : 'Publicación eliminada')
    } catch (error) {
      toast.error(error?.message || 'No se pudo eliminar')
    }
  }, [removeAttentionItem, user?.id])

  const applySnapshot = useCallback((snapshot) => {
    setRecentAds(snapshot.recentAds || [])
    setCommunityHighlights(snapshot.communityHighlights || [])
    setBusinessHighlights(snapshot.businessHighlights || [])
    setRecentJobs(snapshot.recentJobs || [])
    setRecentEvents(snapshot.recentEvents || [])
    setLoading(false)
  }, [])

  const fetchHomeData = useCallback(async () => {
    try {
      const [adsRes, communitiesRes, providersRes, providerPhotosRes, jobsRes, eventsRes] = await Promise.all([
        supabase
          .from('listings')
          .select('*')
          .or('active.is.null,active.eq.true')
          .order('created_at', { ascending:false })
          .limit(18),

        fetchHomeCommunities(),

        supabase
          .from('providers')
          .select('id, name, category, city, canton, description, services, photo_url, verified, featured, created_at, active')
          .or('active.is.null,active.eq.true')
          .neq('category', 'empleo')
          .neq('category', 'vivienda')
          .order('created_at', { ascending:false })
          .limit(24),

        supabase
          .from('provider_photos')
          .select('provider_id, url, is_main, sort_order')
          .order('is_main', { ascending:false })
          .order('sort_order', { ascending:true })
          .limit(300),

        supabase
          .from('jobs')
          .select('*')
          .or('active.is.null,active.eq.true')
          .order('created_at', { ascending:false })
          .limit(3),

        supabase
          .from('events')
          .select('id, title, day, month, year, city, venue, price, img_url, created_at, active')
          .or('active.is.null,active.eq.true')
          .order('created_at', { ascending:false })
          .limit(12),
      ])

      if (adsRes.error) console.error('Error loading recent ads:', adsRes.error)
      if (communitiesRes.error) console.error('Error loading communities:', communitiesRes.error)
      if (providersRes.error) console.error('Error loading providers:', providersRes.error)
      if (providerPhotosRes.error) console.error('Error loading provider photos:', providerPhotosRes.error)
      if (jobsRes.error) console.error('Error loading jobs:', jobsRes.error)
      if (eventsRes.error) console.error('Error loading events:', eventsRes.error)

      const adsNorm = ((adsRes.error ? [] : adsRes.data) || []).map((row) => ({
        id: row.id,
        cat: getAdCategoryId(row) || 'servicios',
        sub: row.sub || '',
        emoji: row.emoji || '',
        title: row.title || '',
        desc: row.desc || '',
        img: row.img_url || '',
        price: row.price || '',
        city: row.city || '',
        canton: row.canton || '',
        plz: row.plz || '',
        privacy: row.privacy || 'public',
        user: row.user_name || 'Usuario',
        ts: formatTimeAgo(row.created_at),
        _sort: row.created_at || '',
      }))

      const jobsNorm = ((jobsRes.error ? [] : jobsRes.data) || []).map((row) => {
        const intent = getJobIntentMeta(row)
        return {
          id: `job_${row.id}`,
          cat: 'empleo',
          sub: row.sector || row.category || '',
          emoji: getJobCategoryEmoji(row),
          title: row.title || '',
          desc: [intent.label, row.company].filter(Boolean).join(' · '),
          img: row.logo_url || '',
          price: row.salary || '',
          canton: row.city || '',
          plz: '',
          privacy: 'public',
          user: row.company || intent.label,
          ts: formatTimeAgo(row.created_at),
          _sort: row.created_at || '',
        }
      })

      const adReviewStats = {}
      const reviewableAdIds = adsNorm
        .filter(ad => REVIEWABLE_AD_CATS.has(ad.cat))
        .map(ad => ad.id)

      if (reviewableAdIds.length) {
        const { data: reviewsData, error: reviewsError } = await supabase
          .from('listing_reviews')
          .select('listing_id, stars')
          .eq('active', true)
          .in('listing_id', reviewableAdIds)

        if (!reviewsError && Array.isArray(reviewsData)) {
          reviewsData.forEach(review => {
            if (!review?.listing_id) return
            adReviewStats[review.listing_id] = [
              ...(adReviewStats[review.listing_id] || []),
              review,
            ]
          })
        }
      }

      setRecentAds(
        [
          ...adsNorm.map(ad => {
            const reviews = adReviewStats[ad.id] || []
            return {
              ...ad,
              rating: averageRating(reviews),
              reviewCount: reviews.length,
            }
          }),
          ...jobsNorm,
        ]
          .sort((a, b) => (b._sort > a._sort ? 1 : -1))
          .map(({ _sort, ...rest }) => rest)
      )

      setCommunityHighlights(
        ((communitiesRes.error ? [] : communitiesRes.data) || []).map((row) => ({
          id: row.id,
          name: (row.name || 'Grupo').replace(/Mam[aá]s Latinas/gi, 'Familias Latinas'),
          city: row.city || 'Suiza',
          members: row.members || 0,
          emoji: row.emoji || '👥',
          desc: row.desc || '',
          contact: row.contact || '',
          photo_url: row.photo_url || '',
        }))
      )

      const providerPhotoMap = {}
      ;((providerPhotosRes.error ? [] : providerPhotosRes.data) || []).forEach(photo => {
        if (!photo?.provider_id || !photo?.url) return
        providerPhotoMap[photo.provider_id] = [...(providerPhotoMap[photo.provider_id] || []), photo.url]
      })

      setBusinessHighlights(
        ((providersRes.error ? [] : providersRes.data) || [])
          .filter(row => row.category !== 'empleo' && row.category !== 'vivienda')
          .map((row) => {
            const type = getNegocioTypeMeta(row.category)
            const typeLabel = type?.label?.replace(/^[^\s]+\s/, '') || 'Negocio'
            const verificationStatus = getBusinessVerificationStatus(row)
            const typeEmoji = type?.label?.split(' ')[0] || '🏪'
            return {
              id: row.id,
              name: row.name || 'Negocio',
              type: row.category || '',
              typeLabel,
              emoji: typeEmoji,
              city: row.city || row.canton || 'Suiza',
              desc: row.description || '',
              services: Array.isArray(row.services) ? row.services : [],
              photo_url: row.photo_url || providerPhotoMap[row.id]?.[0] || '',
              verified: verificationStatus === 'verified',
              verification_status: verificationStatus,
              featured: !!row.featured,
              created_at: row.created_at || '',
            }
          })
      )

      setRecentJobs(
        ((jobsRes.error ? [] : jobsRes.data) || []).map((row) => {
          const intent = getJobIntentMeta(row)
          return {
            id: row.id,
            title: row.title || '',
            company: row.company || (intent.id === 'busca' ? 'Perfil profesional' : 'Empresa'),
            city: row.city || 'Suiza',
            type: row.type || 'Trabajo',
            job_intent: intent.id,
            intentLabel: intent.label,
            salary: row.salary || '',
            emoji: getJobCategoryEmoji(row),
            sector: row.sector || row.category || '',
            logo_url: row.logo_url || '',
          }
        })
      )

      const MONTH_IDX = { ENE:0,FEB:1,MAR:2,ABR:3,MAY:4,JUN:5,JUL:6,AGO:7,SEP:8,OCT:9,NOV:10,DIC:11,JAN:0,APR:3,AUG:7,DEC:11 }
      const toEventDate = (row) => {
        const y = parseInt(row.year || new Date().getFullYear(), 10)
        const m = MONTH_IDX[String(row.month).toUpperCase()] ?? 0
        const d = parseInt(row.day || 1, 10)
        return new Date(y, m, d)
      }
      const today = new Date(); today.setHours(0,0,0,0)
      setRecentEvents(
        ((eventsRes.error ? [] : eventsRes.data) || [])
          .filter(row => toEventDate(row) >= today)
          .sort((a, b) => toEventDate(a) - toEventDate(b))
          .slice(0, 3)
          .map((row) => ({
            id: row.id,
            title: row.title || '',
            day: row.day || '',
            month: row.month || '',
            city: row.city || 'Suiza',
            venue: row.venue || '',
            price: row.price || '',
            img: row.img_url || '',
          }))
      )
    } catch (error) {
      console.error('Error loading home data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (loading) return
    homeCache = { recentAds, communityHighlights, businessHighlights, recentJobs, recentEvents }
    homeCacheTs = Date.now()
  }, [businessHighlights, communityHighlights, loading, recentAds, recentEvents, recentJobs])

  useEffect(() => {
    if (homeCache) {
      applySnapshot(homeCache)
    }

    if (!homeCache || Date.now() - homeCacheTs > HOME_CACHE_TTL) {
      fetchHomeData()
    }

    const refreshIfStale = () => {
      if (document.visibilityState === 'hidden') return
      if (!homeCache || Date.now() - homeCacheTs > HOME_CACHE_TTL) {
        fetchHomeData()
      }
    }

    window.addEventListener('focus', refreshIfStale)
    document.addEventListener('visibilitychange', refreshIfStale)

    return () => {
      window.removeEventListener('focus', refreshIfStale)
      document.removeEventListener('visibilitychange', refreshIfStale)
    }
  }, [applySnapshot, fetchHomeData])

  useEffect(() => {
    fetchAttentionTasks()

    const refreshAttention = () => {
      if (document.visibilityState === 'hidden') return
      fetchAttentionTasks()
    }

    window.addEventListener('focus', refreshAttention)
    document.addEventListener('visibilitychange', refreshAttention)

    return () => {
      window.removeEventListener('focus', refreshAttention)
      document.removeEventListener('visibilitychange', refreshAttention)
    }
  }, [fetchAttentionTasks])

  return (
    <div style={{ background:'#fff' }}>
      <section className="hero-section" style={{ background:'linear-gradient(160deg, #1E40AF 0%, #2563EB 58%, #60A5FA 100%)', position:'relative', overflow:'visible', zIndex:2 }}>
        <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
          <div style={{ position:'absolute', top:-70, right:-60, width:220, height:220, borderRadius:'50%', background:'rgba(255,255,255,0.07)' }} />
          <div style={{ position:'absolute', bottom:-60, left:-20, width:180, height:180, borderRadius:'50%', background:'rgba(255,255,255,0.05)' }} />
        </div>

        <div style={{ maxWidth:980, margin:'0 auto', position:'relative', zIndex:1 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16, marginBottom:24 }}>
            <div style={{ flex:1, minWidth:0 }}>
              {/* <p style={{ fontFamily:PP, fontSize:12, color:'rgba(255,255,255,0.75)', margin:'0 0 8px' }}>
                Más cerca de tu gente
              </p> */}
              <h1 style={{ fontFamily:PP, fontWeight:900, fontSize:'clamp(30px,6vw,48px)', lineHeight:1.2, letterSpacing:-0.5, color:'#fff', margin:'0 0 10px' }}>
                Hola&nbsp;  {firstName}.<br />                
              </h1>
              
              <h2
  style={{
    fontFamily:PP,
    fontWeight:600,
    fontSize:'clamp(16px,4vw,28px)',
    lineHeight:1.2,
    letterSpacing:-0.3,
    color:'#fff',
    margin:'0 0 8px'
  }}
>
¡Te estábamos esperando!</h2>

              {/* <p style={{ fontFamily:PP, fontSize:14, color:'rgba(255,255,255,0.82)', lineHeight:1.7, maxWidth:520, margin:0 }}>
                Encuentra información, servicios, empleos y apoyo real en una plataforma creada para ti y para los tuyos.
              </p> */}
            </div>

            {isLoggedIn && (
              <div ref={notifRef} style={{ position:'relative', flexShrink:0 }}>
                <button
                  onClick={() => {
                    if (notifOpen) closeNotifPanel()
                    else setNotifOpen(true)
                  }}
                  style={{ position:'relative', background:'rgba(255,255,255,0.15)', border:'none', borderRadius:'50%', width:46, height:46, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, cursor:'pointer', marginTop:6 }}
                  aria-label="Notificaciones"
                >
                  🔔
                  {hasNotif && (
                    <span style={{ position:'absolute', top:7, right:7, width:9, height:9, borderRadius:'50%', background:'#EF4444', border:'2px solid rgba(255,255,255,0.4)' }} />
                  )}
                </button>

                {notifOpen && (
                  <div style={{
                    position:'absolute', top:56, right:0, width:320, maxHeight:'70vh',
                    background:'#fff', borderRadius:18, boxShadow:'0 8px 40px rgba(0,0,0,0.18)',
                    zIndex:200, overflow:'hidden', display:'flex', flexDirection:'column',
                  }}>
                    <div style={{ padding:'14px 16px 10px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <span style={{ fontFamily:PP, fontWeight:800, fontSize:15, color:C.text }}>Notificaciones</span>
                      {!hasNotif && <span style={{ fontFamily:PP, fontSize:12, color:C.light }}>Todo al día ✓</span>}
                    </div>

                    <div style={{ overflowY:'auto', flex:1 }}>
                      {/* Messages section */}
                      {hasUnread && (
                        <div style={{ padding:'10px 14px 6px' }}>
                          <p style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:C.light, margin:'0 0 8px', letterSpacing:0.5 }}>MENSAJES</p>
                          <button
                            onClick={() => { closeNotifPanel(); navigate('/mensajes') }}
                            style={{ width:'100%', background:C.primaryLight, border:'none', borderRadius:12, padding:'10px 12px', display:'flex', alignItems:'center', gap:10, cursor:'pointer', textAlign:'left' }}
                          >
                            <span style={{ fontSize:20 }}>💬</span>
                            <div style={{ flex:1, minWidth:0 }}>
                              <p style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:C.primary, margin:0 }}>
                                {unreadConvIds.size === 1 ? '1 conversación nueva' : `${unreadConvIds.size} conversaciones nuevas`}
                              </p>
                              <p style={{ fontFamily:PP, fontSize:11, color:C.mid, margin:0 }}>Toca para ver los mensajes</p>
                            </div>
                            <span style={{ color:C.primary, fontSize:16 }}>›</span>
                          </button>
                        </div>
                      )}

                      {/* Zone alerts section */}
                      {alertItems.length > 0 && (
                        <div style={{ padding:'10px 14px 10px' }}>
                          <p style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:C.light, margin:'0 0 8px', letterSpacing:0.5 }}>ALERTAS DE ZONA</p>
                          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                            {alertItems.map(item => (
                              <button
                                key={item.key}
                                onClick={() => { closeNotifPanel(); navigate(item.href) }}
                                style={{ width:'100%', background:`${C.bg}`, border:`1px solid ${C.border}`, borderRadius:12, padding:'10px 12px', display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', textAlign:'left' }}
                              >
                                <span style={{ fontSize:18, marginTop:1 }}>{item.icon}</span>
                                <div style={{ flex:1, minWidth:0 }}>
                                  <p style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:C.text, margin:'0 0 2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.title}</p>
                                  <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>{item.kindLabel} · {item.canton}</p>
                                </div>
                                <span style={{ color:C.light, fontSize:16 }}>›</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {!hasNotif && (
                        <div style={{ padding:'30px 16px', textAlign:'center' }}>
                          <div style={{ fontSize:36, marginBottom:8 }}>🔔</div>
                          <p style={{ fontFamily:PP, fontSize:13, color:C.light, margin:0 }}>No hay notificaciones nuevas</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="hero-search-wrap">
            <GlobalSearch size="lg" placeholder="¿Qué necesitas hoy?" />
            <div className="no-scroll" style={{ overflowX:'auto', WebkitOverflowScrolling:'touch', marginTop:12 }}>
              <div className="hero-pills">
                {[
                  { emoji:'📌', label:'Anuncios',    to:'/tablon' },
                  { emoji:'🏠', label:'Vivienda',    to:'/tablon?cat=vivienda' },
                  { emoji:'💼', label:'Empleo',       to:'/tablon?cat=empleo' },
                  { emoji:'🛍️', label:'Mercado',      to:'/tablon?cat=venta' },
                  { emoji:'🔧', label:'Servicios',    to:'/tablon?cat=servicios' },
                  { emoji:'❤️', label:'Cuidados',     to:'/tablon?cat=cuidados' },
                  { emoji:'🏪', label:'Negocios',     to:'/comunidades?view=negocios' },
                  { emoji:'👥', label:'Grupos',       to:'/comunidades?view=comunidades' },
                  { emoji:'🎉', label:'Eventos',      to:'/comunidades?view=eventos' },
                  { emoji:'📚', label:'Guías',        to:'/guias' },
                ].map(cat => (
                  <Link
                    key={cat.label}
                    to={cat.to}
                    style={{ display:'inline-flex', alignItems:'center', gap:5, background:'rgba(255,255,255,0.15)', border:'1.5px solid rgba(255,255,255,0.25)', borderRadius:999, padding:'7px 14px', fontFamily:PP, fontWeight:600, fontSize:12, color:'#fff', textDecoration:'none', whiteSpace:'nowrap' }}
                  >
                    <span style={{ fontSize:14 }}>{cat.emoji}</span>
                    {cat.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {visibleAttentionTasks.length > 0 && (
        <section style={{ background:'#fff', padding:'18px 0 2px' }}>
          <div style={{ maxWidth:980, margin:'0 auto', padding:'0 16px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, marginBottom:10 }}>
              <div>
                <p style={{ fontFamily:PP, fontSize:10, fontWeight:800, color:C.primary, margin:'0 0 3px', textTransform:'uppercase' }}>
                  Necesita atención
                </p>
                <h2 style={{ fontFamily:PP, fontWeight:900, fontSize:18, color:C.text, margin:0 }}>
                  Tareas pendientes
                </h2>
              </div>
            </div>

            <div style={{ display:'grid', gap:10 }}>
              {visibleAttentionTasks.map(task => {
                const warn = task.tone === 'warn'
                const expanded = expandedAttentionTask === task.id
                const imageTask = task.mode === 'image'
                return (
                  <div
                    key={task.id}
                    style={{
                      background: warn ? C.warnLight : C.primaryLight,
                      border:`1px solid ${warn ? C.warnMid : C.primaryMid}`,
                      borderRadius:16,
                      overflow:'hidden',
                    }}
                  >
                    <button
                      onClick={() => setExpandedAttentionTask(current => current === task.id ? '' : task.id)}
                      style={{
                        width:'100%',
                        textAlign:'left',
                        background:'transparent',
                        border:'none',
                        padding:'13px 14px',
                        display:'flex',
                        gap:12,
                        alignItems:'center',
                        cursor:'pointer',
                      }}
                    >
                      <span style={{ width:38, height:38, borderRadius:13, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                        {task.emoji}
                      </span>
                      <span style={{ minWidth:0, flex:1 }}>
                        <span style={{ display:'block', fontFamily:PP, fontWeight:800, fontSize:13, color:C.text, marginBottom:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                          {task.title}
                        </span>
                        <span style={{ display:'block', fontFamily:PP, fontSize:11, color:warn ? '#92400E' : C.primaryDark, lineHeight:1.45 }}>
                          {task.text}
                        </span>
                      </span>
                      <span style={{ fontFamily:PP, fontWeight:800, fontSize:10, color:warn ? '#92400E' : C.primaryDark, background:'#fff', border:`1px solid ${warn ? C.warnMid : C.primaryMid}`, borderRadius:999, padding:'6px 10px', flexShrink:0, minWidth:54, textAlign:'center' }}>
                        {expanded ? 'Ocultar' : 'Ver'}
                      </span>
                    </button>

                    {expanded && (
                      <div style={{ borderTop:`1px solid ${warn ? C.warnMid : C.primaryMid}`, padding:'8px 8px 10px', display:'grid', gap:8 }}>
                        {task.items.map(item => (
                          <div key={item.id} style={{ background:'#fff', border:`1px solid ${C.border}`, borderRadius:14, padding:10, boxSizing:'border-box', overflow:'hidden' }}>
                            <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:10, minWidth:0 }}>
                              {item.image ? (
                                <div style={{ width:42, height:42, borderRadius:12, overflow:'hidden', flexShrink:0, background:C.bg }}>
                                  <img src={item.image} alt={item.title} loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                </div>
                              ) : (
                                <span style={{ width:42, height:42, borderRadius:12, background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:19, flexShrink:0 }}>
                                  {item.emoji}
                                </span>
                              )}
                              <span style={{ minWidth:0, flex:1, paddingTop:1 }}>
                                <span style={{ display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', fontFamily:PP, fontWeight:800, fontSize:12, color:C.text, marginBottom:3, lineHeight:1.28, overflow:'hidden', overflowWrap:'anywhere' }}>
                                  {item.title}
                                </span>
                                <span style={{ display:'block', fontFamily:PP, fontSize:10, color:C.light, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', lineHeight:1.25 }}>
                                  {item.meta || 'Publicado en Latido'}
                                </span>
                              </span>
                            </div>
                            <div style={{ display:'grid', gridTemplateColumns:'minmax(104px, 1.2fr) minmax(72px, .8fr) minmax(70px, .8fr)', gap:6, minWidth:0 }}>
                              <button onClick={() => imageTask ? editAttentionItem(task.id, item) : keepAttentionItem(task.id, item)} style={{ fontFamily:PP, fontWeight:800, fontSize:10, color:imageTask ? C.primaryDark : '#065F46', background:imageTask ? C.primaryLight : '#D1FAE5', border:`1px solid ${imageTask ? C.primaryMid : '#A7F3D0'}`, borderRadius:10, padding:'8px 4px', cursor:'pointer', whiteSpace:'nowrap', minWidth:0 }}>
                                {imageTask ? 'Agregar imagen' : 'Mantener'}
                              </button>
                              <button onClick={() => imageTask ? keepAttentionItem(task.id, item) : editAttentionItem(task.id, item)} style={{ fontFamily:PP, fontWeight:800, fontSize:10, color:imageTask ? '#065F46' : C.primaryDark, background:imageTask ? '#D1FAE5' : C.primaryLight, border:`1px solid ${imageTask ? '#A7F3D0' : C.primaryMid}`, borderRadius:10, padding:'8px 4px', cursor:'pointer', whiteSpace:'nowrap', minWidth:0 }}>
                                {imageTask ? 'Mantener' : 'Editar'}
                              </button>
                              <button onClick={() => deleteAttentionItem(task.id, item)} style={{ fontFamily:PP, fontWeight:800, fontSize:10, color:'#B91C1C', background:C.dangerLight, border:'1px solid #FECACA', borderRadius:10, padding:'8px 4px', cursor:'pointer', whiteSpace:'nowrap', minWidth:0 }}>
                                Borrar
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── ANUNCIOS RECIENTES ── */}
      <section style={{ padding:'24px 0 0' }}>
        <div style={{ maxWidth:980, margin:'0 auto', padding:'0 16px', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:20, color:C.text, margin:0, letterSpacing:0 }}>📌 Anuncios recientes</h2>
          <Link to="/tablon" style={{ fontFamily:PP, fontSize:12, fontWeight:700, color:C.primary, textDecoration:'none', whiteSpace:'nowrap' }}>Ver todos →</Link>
        </div>
        {loading ? (
          <div className="no-scroll" style={{ overflowX:'auto', WebkitOverflowScrolling:'touch', padding:'0 16px' }}>
            <div style={{ display:'flex', gap:12, width:'max-content' }}>
              {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ width:152, height:220, borderRadius:16, flexShrink:0 }} />)}
            </div>
          </div>
        ) : recentAds.length === 0 ? (
          <div style={{ padding:'0 16px' }}><EmptyState text="Todavía no hay anuncios publicados." /></div>
        ) : (
          <div className="no-scroll" style={{ overflowX:'auto', WebkitOverflowScrolling:'touch', padding:'4px 16px 16px' }}>
            <div style={{ display:'flex', gap:12, width:'max-content' }}>
              {recentAds.map(ad => {
                const normalizedCat = getAdCategoryId(ad)
                const cat = getAdDisplayCat(ad)
                const cc = CAT_COLORS[normalizedCat] || { bg:C.primaryLight, tc:C.primary }
                const location = formatAdLocation(ad)
                const displayEmoji = getAdDisplayEmoji(ad)
                return (
                  <div
                    key={ad.id}
                    role="link"
                    tabIndex={0}
                    onClick={() => navigate(getAdHref(ad))}
                    onKeyDown={event => {
                      if (event.key === 'Enter') navigate(getAdHref(ad))
                    }}
                    style={{ textDecoration:'none', flexShrink:0, width:172, display:'block', cursor:'pointer' }}
                  >
                    <div style={{ background:'#fff', borderRadius:18, border:`1px solid ${C.border}`, overflow:'hidden', height:'100%', boxShadow:'0 10px 24px rgba(15,23,42,0.07)' }}>
                      <div style={{ height:132, background:'#F8FAFC', display:'flex', alignItems:'center', justifyContent:'center', fontSize:44, position:'relative', borderBottom:`1px solid ${C.borderLight}` }}>
                        {ad.img
                          ? <img src={ad.img} alt={ad.title} loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:'contain', position:'absolute', inset:0 }} />
                          : <span style={{ fontSize:44, lineHeight:1 }}>{displayEmoji}</span>
                        }
                        <span style={{ position:'absolute', top:10, left:10, maxWidth:'calc(100% - 76px)', fontFamily:PP, fontSize:9, fontWeight:800, background:'rgba(255,255,255,0.94)', color:cc.tc, padding:'5px 8px', borderRadius:999, boxShadow:'0 6px 14px rgba(15,23,42,0.08)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{cat?.label}</span>
                        {ad.reviewCount > 0 && (
                          <RatingPill
                            rating={ad.rating}
                            count={ad.reviewCount}
                            style={{ position:'absolute', top:10, right:10, background:'#fff', fontSize:10, padding:'5px 8px', borderColor:'#FDE68A', boxShadow:'none' }}
                          />
                        )}
                      </div>
                      <div style={{ padding:'12px 12px 13px' }}>
                        <p style={{ fontFamily:PP, fontWeight:800, fontSize:13, color:C.text, margin:'0 0 8px', lineHeight:1.32, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', minHeight:'2.65em', overflowWrap:'anywhere' }}>{ad.title}</p>
                        <p style={{ fontFamily:PP, fontWeight:900, fontSize:14, color:C.primary, margin:'0 0 7px', lineHeight:1.15, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{fmtPrice(ad.price) || '—'}</p>
                        <p style={{ fontFamily:PP, fontSize:10, color:C.light, margin:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>📍 {location || ad.canton} · {ad.ts}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {/* <section style={{ maxWidth:980, margin:'0 auto', padding:'34px 16px 0' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, gap:12 }}>
          <div>
            <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:20, color:C.text, margin:'0 0 6px', letterSpacing:-0.5 }}>
              📌 Anuncios recientes
            </h2>
            <p style={{ fontFamily:PP, fontSize:12, color:C.mid, margin:0, lineHeight:1.7 }}>
              Los últimos anuncios de la comunidad.
            </p>
          </div>

          <Link to="/tablon" style={{ fontFamily:PP, fontSize:12, fontWeight:700, color:C.primary, textDecoration:'none', whiteSpace:'nowrap' }}>
            Ver todos →
          </Link>
        </div>

        {loading ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:14 }}>
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height:160, borderRadius:18 }}/>)}
          </div>
        ) : recentAds.length === 0 ? (
          <EmptyState text="Todavía no hay anuncios publicados." />
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:14 }}>
            {recentAds.map(ad => {
              const normalizedCat = getAdCategoryId(ad)
              const cat = getAdDisplayCat(ad)
              const cc = CAT_COLORS[normalizedCat] || { bg:C.primaryLight, tc:C.primary }

              return (
                <Link
                  key={ad.id}
                  to={getAdHref(ad)}
                  style={{ textDecoration:'none', display:'block' }}
                >
                  <div style={{ background:C.bg, borderRadius:18, border:`1px solid ${C.border}`, padding:'15px 15px 14px', height:'100%' }}>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
                      <PrivacyTag privacy={ad.privacy} />
                      <Tag bg={cc.bg} color={cc.tc}>{cat?.emoji} {cat?.label}</Tag>
                      <Tag bg="#fff" color={C.light}>{ad.canton}</Tag>
                    </div>

                    <p style={{ fontFamily:PP, fontWeight:700, fontSize:14, color:C.text, lineHeight:1.4, margin:'0 0 7px' }}>
                      {ad.title}
                    </p>

                    <p style={{ fontFamily:PP, fontSize:12, color:C.mid, lineHeight:1.65, margin:'0 0 14px', whiteSpace:'pre-line', display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                      {ad.desc}
                    </p>

                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
                      <span style={{ fontFamily:PP, fontSize:10, color:C.light }}>
                        {ad.user} · {ad.ts}
                      </span>
                      <span style={{ fontFamily:PP, fontSize:12, fontWeight:800, color:C.primary }}>
                        {fmtPrice(ad.price)}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section> */}

      <section style={{ padding:'40px 0 0' }}>
        <div style={{ maxWidth:980, margin:'0 auto', padding:'0 16px', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:0 }}>
          <div>
            <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:20, color:C.text, margin:'0 0 4px' }}>
              🎉 Próximos eventos 
            </h2>
            <p style={{ fontFamily:PP, fontSize:12, color:C.mid, margin:0 }}>
              Próximos eventos para ti.
            </p>
          </div>
          <Link to="/comunidades?view=eventos" style={{ fontFamily:PP, fontSize:11, fontWeight:700, color:C.primary, textDecoration:'none' }}>
            Ver todos →
          </Link>
        </div>

        <EventfrogCalendar compact layout="carousel" maxEvents={60} />
      </section>

      <section style={{ padding:'40px 0 0' }}>
        <div style={{ maxWidth:980, margin:'0 auto', padding:'0 16px', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <div>
            <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:20, color:C.text, margin:'0 0 4px' }}>
              🏪 Negocios
            </h2>
            <p style={{ fontFamily:PP, fontSize:12, color:C.mid, margin:0 }}>
              Servicios y comercios hispanohablantes cerca de ti.
            </p>
          </div>
          <Link to="/comunidades" style={{ fontFamily:PP, fontSize:11, fontWeight:700, color:C.primary, textDecoration:'none', flexShrink:0 }}>
            Ver todos →
          </Link>
        </div>

        {loading ? (
          <div className="no-scroll" style={{ display:'flex', gap:12, padding:'4px 16px 16px', overflowX:'auto' }}>
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ flexShrink:0, width:152, height:190, borderRadius:16 }}/>)}
          </div>
        ) : businessHighlights.length === 0 ? (
          <div style={{ padding:'0 16px' }}><EmptyState text="Todavía no hay negocios publicados." /></div>
        ) : (
          <div className="no-scroll" style={{ overflowX:'auto', WebkitOverflowScrolling:'touch', padding:'4px 16px 16px' }}>
            <div style={{ display:'flex', gap:12, width:'max-content' }}>
              {businessHighlights.map(business => (
                <Link
                  key={business.id}
                  to={getBusinessHref(business)}
                  style={{ flexShrink:0, width:152, display:'block', textDecoration:'none' }}
                >
                    <div style={{ background:'#fff', borderRadius:16, border:`1px solid ${C.border}`, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
                    <div style={{ position:'relative', height:160, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:44, overflow:'visible' }}>
                      {business.photo_url
                        ? <img src={business.photo_url} alt={business.name} loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:'contain' }} />
                        : <span>{business.emoji || '🏪'}</span>
                      }
                      <span
                        title={business.typeLabel}
                        style={{
                          position:'absolute',
                          top:8,
                          left:8,
                          maxWidth:business.verified ? 'calc(100% - 42px)' : 'calc(100% - 16px)',
                          fontFamily:PP,
                          fontSize:9,
                          fontWeight:700,
                          lineHeight:1.2,
                          background:'rgba(255,255,255,0.92)',
                          color:'#0F766E',
                          padding:'4px 7px',
                          borderRadius:999,
                          whiteSpace:'nowrap',
                          overflow:'hidden',
                          textOverflow:'ellipsis',
                          boxSizing:'border-box',
                        }}
                      >
                        {business.emoji} {business.typeLabel}
                      </span>
                      <div style={{ position:'absolute', top:8, right:8, display:'flex', gap:4 }}>
                        {business.verified && <span title="Verificada" style={{ width:24, height:24, borderRadius:12, background:'rgba(255,255,255,0.94)', color:'#065F46', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, boxShadow:'0 6px 16px rgba(15,23,42,0.12)' }}>✓</span>}
                      </div>
                      {business.featured && (
                        <span style={{ position:'absolute', left:'50%', bottom:-12, transform:'translateX(-50%)', zIndex:2, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:5, fontFamily:PP, fontSize:10, fontWeight:800, color:C.primary, background:'#fff', border:`1.5px solid ${C.primaryMid}`, borderRadius:999, padding:'6px 12px', boxShadow:'0 8px 18px rgba(37,99,235,0.14)', whiteSpace:'nowrap' }}>
                          Destacado
                        </span>
                      )}
                    </div>
                    <div style={{ padding:business.featured ? '18px 10px 12px' : '10px 10px 12px' }}>
                      <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.text, margin:'0 0 4px', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', lineHeight:1.35, minHeight:'2.7em', overflowWrap:'anywhere' }}>
                        {business.name}
                      </p>
                      <p style={{ fontFamily:PP, fontSize:10, color:C.light, margin:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        📍 {business.city}{business.services.length ? ` · ${business.services[0]}` : ''}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      <section style={{ padding:'40px 0 0' }}>
        <div style={{ maxWidth:980, margin:'0 auto', padding:'0 16px', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <div>
            <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:20, color:C.text, margin:'0 0 4px' }}>
              👥 Grupos para ti
            </h2>
            <p style={{ fontFamily:PP, fontSize:12, color:C.mid, margin:0 }}>
              Tus próximos puntos de conexión en Suiza.
            </p>
          </div>
          <Link to="/comunidades?view=comunidades" style={{ fontFamily:PP, fontSize:11, fontWeight:700, color:C.primary, textDecoration:'none', flexShrink:0 }}>
            Ver todos →
          </Link>
        </div>

        {loading ? (
          <div className="no-scroll" style={{ display:'flex', gap:12, padding:'4px 16px 16px', overflowX:'auto' }}>
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ flexShrink:0, width:152, height:190, borderRadius:16 }}/>)}
          </div>
        ) : communityHighlights.length === 0 ? (
          <div style={{ padding:'0 16px' }}><EmptyState text="Todavía no hay grupos publicados." /></div>
        ) : (
          <div className="no-scroll" style={{ overflowX:'auto', WebkitOverflowScrolling:'touch', padding:'4px 16px 16px' }}>
            <div style={{ display:'flex', gap:12, width:'max-content' }}>
              {communityHighlights.map(group => (
                <Link
                  key={group.id}
                  to={getCommunityHref(group)}
                  style={{ flexShrink:0, width:152, display:'block', textDecoration:'none' }}
                >
                  <div style={{ background:'#fff', borderRadius:16, border:`1px solid ${C.border}`, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
                    <div style={{ height:160, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:44, overflow:'hidden' }}>
                      {group.photo_url
                        ? <img src={group.photo_url} alt={group.name} loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:'contain' }} />
                        : <span>{group.emoji || '👥'}</span>
                      }
                    </div>
                    <div style={{ padding:'10px 10px 12px' }}>
                      <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.text, margin:'0 0 4px', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', lineHeight:1.35, minHeight:'2.7em' }}>
                        {group.name}
                      </p>
                      <p style={{ fontFamily:PP, fontSize:10, color:C.light, margin:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        📍 {group.city}{!group.photo_url ? ` · 👥 ${group.members}` : ''}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Empleos recientes — oculto temporalmente
      <section style={{ maxWidth:980, margin:'0 auto', padding:'40px 16px 0' }}>
        ...
      </section>
      */}

      {/* ── GUÍAS ── */}
      {(() => {
        const GUIDE_COLORS = {
          permisos:  { bg:'#DBEAFE', tc:'#1D4ED8' },
          impuestos: { bg:'#FEF3C7', tc:'#92400E' },
          salud:     { bg:'#FCE7F3', tc:'#9D174D' },
          banco:     { bg:'#D1FAE5', tc:'#065F46' },
          educacion: { bg:'#EDE9FE', tc:'#6D28D9' },
          trabajo:   { bg:'#CCFBF1', tc:'#0F766E' },
          vivienda:  { bg:'#DBEAFE', tc:'#1D4ED8' },
        }
        return (
          <section style={{ padding:'40px 0 0' }}>
            <div style={{ maxWidth:980, margin:'0 auto', padding:'0 16px', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <div>
                <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:20, color:C.text, margin:'0 0 4px' }}>📚 Guías</h2>
                <p style={{ fontFamily:PP, fontSize:12, color:C.mid, margin:0 }}>Permisos, trabajo, vivienda, salud y dinero en español.</p>
              </div>
              <Link to="/guias" style={{ fontFamily:PP, fontSize:11, fontWeight:700, color:C.primary, textDecoration:'none', flexShrink:0 }}>Ver todas →</Link>
            </div>
            <div className="no-scroll" style={{ overflowX:'auto', WebkitOverflowScrolling:'touch', padding:'4px 16px 16px' }}>
              <div style={{ display:'flex', gap:12, width:'max-content' }}>
                {MOCK_DOCS.map(doc => {
                  const gc = GUIDE_COLORS[doc.cat] || { bg:C.bg, tc:C.primary }
                  return (
                    <div key={doc.id} onClick={() => setSelectedGuide(doc)} style={{ flexShrink:0, width:152, cursor:'pointer' }}>
                      <div style={{ background:'#fff', borderRadius:16, border:`1px solid ${C.border}`, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
                        <div style={{ position:'relative', height:120, background:gc.bg, overflow:'hidden' }}>
                          {doc.img ? (
                            <img src={doc.img} alt={doc.title} loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                          ) : (
                            <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:44 }}>
                              {doc.emoji}
                            </div>
                          )}
                          <span style={{ position:'absolute', left:10, bottom:10, width:34, height:34, borderRadius:12, background:'rgba(255,255,255,0.92)', color:gc.tc, display:'flex', alignItems:'center', justifyContent:'center', fontSize:19, boxShadow:'0 8px 20px rgba(15,23,42,0.18)' }}>
                            {doc.emoji}
                          </span>
                        </div>
                        <div style={{ padding:'10px 10px 12px' }}>
                          <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.text, margin:'0 0 6px', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', lineHeight:1.35, minHeight:'2.7em' }}>
                            {doc.title}
                          </p>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <span style={{ fontFamily:PP, fontSize:10, color:C.light }}>⏱ {doc.time}</span>
                            <span style={{ fontFamily:PP, fontSize:10, fontWeight:700, color: doc.level === 'Básico' ? '#065F46' : '#92400E' }}>{doc.level}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        )
      })()}

      {/* PARTNERS DESACTIVADOS TEMPORALMENTE
      <PartnersSection />
      */}

      {/* Guide modal */}
      {selectedGuide && (
        <div onClick={() => setSelectedGuide(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:'24px 24px 0 0', width:'100%', maxWidth:680, maxHeight:'85vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ padding:'20px 20px 16px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
              <div>
                <span style={{ fontFamily:PP, fontWeight:700, fontSize:10, padding:'3px 10px', borderRadius:999, background: selectedGuide.level === 'Básico' ? '#D1FAE5' : '#FEF3C7', color: selectedGuide.level === 'Básico' ? '#065F46' : '#92400E', display:'inline-block', marginBottom:8 }}>
                  {selectedGuide.level}
                </span>
                <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:17, color:C.text, margin:'0 0 4px', lineHeight:1.3 }}>{selectedGuide.title}</h2>
                <p style={{ fontFamily:PP, fontSize:11, color:C.mid, margin:0 }}>⏱ {selectedGuide.time}</p>
              </div>
              <button onClick={() => setSelectedGuide(null)} style={{ background:C.bg, border:'none', borderRadius:10, width:32, height:32, fontSize:16, cursor:'pointer', flexShrink:0 }}>✕</button>
            </div>
            <div style={{ padding:'18px 20px 32px', overflowY:'auto', flex:1 }}>
              {selectedGuide.img && (
                <img
                  src={selectedGuide.img}
                  alt={selectedGuide.title}
                  loading="lazy"
                  decoding="async"
                  style={{ width:'100%', height:210, objectFit:'cover', borderRadius:18, marginBottom:16, display:'block' }}
                />
              )}
              {selectedGuide.content.split('\n').map((line, i) => (
                <p key={i} style={{ fontFamily:PP, fontSize:13, color: line.startsWith('**') ? C.text : C.mid, fontWeight: line.startsWith('**') ? 700 : 400, lineHeight:1.7, margin:'0 0 5px' }}>
                  {line.replace(/\*\*/g, '')}
                </p>
              ))}
              <Link to="/guias" onClick={() => setSelectedGuide(null)} style={{ display:'inline-flex', marginTop:18, fontFamily:PP, fontWeight:700, fontSize:13, background:C.primary, color:'#fff', textDecoration:'none', borderRadius:12, padding:'12px 22px' }}>
                Ver todas las guías →
              </Link>
            </div>
          </div>
        </div>
      )}

      <section style={{ maxWidth:980, margin:'0 auto', padding:'42px 16px 110px' }}>
  <div style={{ background:'linear-gradient(135deg,#1E3A8A,#2563EB)', borderRadius:28, padding:'28px 24px', position:'relative', overflow:'hidden' }}>
    <div style={{ position:'absolute', right:-40, top:-40, width:160, height:160, borderRadius:'50%', background:'rgba(255,255,255,0.07)' }} />
    <div style={{ position:'absolute', left:-20, bottom:-30, width:100, height:100, borderRadius:'50%', background:'rgba(255,255,255,0.05)' }} />

    <div
      style={{
        position:'relative',
        display:'flex',
        flexDirection:'column',
        justifyContent:'center',
        alignItems:'center',
        gap:20,
        textAlign:'center'
      }}
    >
      <div style={{ maxWidth:520, display:'flex', flexDirection:'column', alignItems:'center' }}>
        <p
          style={{
            fontFamily: PP,
            fontSize: 32,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: '-1px',
            margin: '0 0 16px',
            textAlign: 'center'
          }}
        >
          <span style={{ color: '#fff' }}>"Lejos de casa,</span>
          <br />
          <span style={{ color: '#60A5FA' }}>pero nunca solos."</span>
        </p>

        <p
          style={{
            fontFamily:PP,
            fontSize:18,
            color:'rgba(255,255,255,0.75)',
            lineHeight:1.25,
            margin:'0 0 12px',
            textAlign:'center'
          }}
        >
          Para todo lo que necesites o estés buscando, publica un anuncio y deja que tu comunidad te ayude.
        </p>

        <p
          style={{
            fontFamily:PP,
            fontSize:13,
            color:'rgba(255,255,255,0.75)',
            lineHeight:1.7,
            margin:0,
            textAlign:'center'
          }}
        >
          Para eso estamos aquí. Miles de hispanohablantes en Suiza dispuestos a ayudarse.
        </p>
      </div>

    </div>
  </div>
</section>
    </div>
  )
}
