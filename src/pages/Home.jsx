import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useZoneAlerts, dismissZoneAlerts } from '../hooks/useZoneAlerts'
import { useBusinessLeadAlerts } from '../hooks/useBusinessLeadAlerts'
import { useUnreadMessages } from '../hooks/useUnreadMessages'
import { useOverlayHistory } from '../hooks/useOverlayHistory'
import { usePushActivation } from '../hooks/usePushActivation'
import { subscribeToPushNotifications, loadPushSettings, PUSH_SETTINGS_KEY } from '../lib/pushNotifications'
import GlobalSearch from '../components/GlobalSearch'
import PartnersSection from '../components/PartnersSection'
import { C, PP } from '../lib/theme'
import { readOfflineSnapshot, writeOfflineSnapshot } from '../lib/offlineCache'
import { Avatar, Tag, PrivacyTag, RatingPill, Modal } from '../components/UI'
import EventfrogCalendar from '../components/EventfrogCalendar'
import { CANTONS, MOCK_DOCS, formatAdLocation, getAdCategoryId, getAdDisplayCat, getAdDisplayEmoji, getJobCategoryEmoji, getJobIntentMeta, getNegocioTypeMeta } from '../lib/constants'
import { getBusinessVerificationStatus } from '../lib/businessVerification'
import { getMissingColumnName } from '../lib/supabaseCompat'
import {
  getBusinessPromotionMeta,
  isBusinessPromotionActive,
  rotateHomeBusinesses,
} from '../lib/businessPromotion'
import { getThumbnailImageUrl } from '../lib/imageVariants'
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

const HOME_SEARCH_CATEGORY_OPTIONS = [
  { value:'', label:'Todos' },
  { value:'anuncios', label:'Anuncios' },
  { value:'vivienda', label:'Vivienda' },
  { value:'empleo', label:'Empleo' },
  { value:'servicios', label:'Servicios' },
  { value:'cuidados', label:'Cuidados' },
  { value:'venta', label:'Mercado' },
  { value:'documentos', label:'Trámites' },
  { value:'negocios', label:'Negocios' },
  { value:'grupos', label:'Grupos' },
  { value:'eventos', label:'Eventos' },
  { value:'guias', label:'Guías' },
]

const HOME_SEARCH_INTENT_OPTIONS = [
  { value:'', label:'Todas' },
  { value:'busca', label:'Busco o necesito' },
  { value:'ofrece', label:'Ofrezco' },
  { value:'vende', label:'Vendo' },
  { value:'regala', label:'Regalo' },
]

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

const HOME_PROVIDER_SELECT = {
  withPromotion:'id, name, category, city, canton, description, services, photo_url, verified, featured, created_at, active, promotion_plan, promotion_starts_at, promotion_ends_at',
  safe:'id, name, category, city, canton, description, services, photo_url, verified, featured, created_at, active',
}

async function fetchHomeProviders() {
  const buildQuery = columns => supabase
    .from('providers')
    .select(columns)
    .or('active.is.null,active.eq.true')
    .neq('category', 'empleo')
    .neq('category', 'vivienda')
    .order('created_at', { ascending:false })
    .limit(100)

  const response = await buildQuery(HOME_PROVIDER_SELECT.withPromotion)
  const missingColumn = getMissingColumnName(response.error, 'providers')
  if (['promotion_plan', 'promotion_starts_at', 'promotion_ends_at'].includes(missingColumn)) {
    return buildQuery(HOME_PROVIDER_SELECT.safe)
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

function SearchFilterSelect({ label, value, options, onChange, flex = 1 }) {
  const selectedLabel = options.find(o => o.value === value)?.label || label
  const isActive = !!value
  const defaultValue = options[0]?.value || ''
  const isDefault = value === defaultValue

  return (
    <label style={{ position:'relative', display:'flex', alignItems:'center', minWidth:0, flex:`${flex} 1 0`, height:40, paddingLeft:12, border:`1.5px solid ${isActive ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.32)'}`, borderRadius:12, background:isActive ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)', overflow:'hidden', backdropFilter:'blur(6px)', transition:'all .15s' }}>
      <span style={{ position:'absolute', top:0, left:0, right:0, bottom:0, display:'flex', alignItems:'center', gap:6, paddingLeft:12, paddingRight:32, fontFamily:PP, fontSize:9.5, fontWeight:900, color:isActive ? '#fff' : 'rgba(255,255,255,0.72)', cursor:'pointer', pointerEvents:'none', whiteSpace:'nowrap', overflow:'hidden', minWidth:0, textTransform:'uppercase', letterSpacing:0.5 }}>
        {label}
        {isActive && !isDefault && (
          <span aria-hidden="true" style={{ width:4, height:4, borderRadius:'50%', background:'#fff', flexShrink:0, marginLeft:'auto' }} />
        )}
      </span>
      <select
        aria-label={label}
        value={value}
        onChange={onChange}
        style={{ position:'absolute', inset:0, width:'100%', height:'100%', border:'none', outline:'none', appearance:'none', WebkitAppearance:'none', background:'transparent', padding:'0 32px 0 12px', fontFamily:PP, fontSize:10.5, fontWeight:700, color:'rgba(255,255,255,0)', cursor:'pointer' }}
      >
        {options.map(option => <option key={option.value || 'all'} value={option.value} style={{ color:C.text, background:'#fff' }}>{option.label}</option>)}
      </select>
      <span aria-hidden="true" style={{ position:'absolute', right:10, top:'50%', width:5, height:5, borderRight:`1.5px solid ${isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.8)'}`, borderBottom:`1.5px solid ${isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.8)'}`, transform:'translateY(-50%) rotate(45deg)', pointerEvents:'none', flexShrink:0 }} />
    </label>
  )
}

const HOME_CACHE_TTL = 5 * 60 * 1000
const HOME_RECENT_ITEM_LIMIT = 18
const SHOW_HOME_BUSINESS_PROMOTION_TASK = false
const persistedHomeSnapshot = readOfflineSnapshot('home-public')
let homeCache = persistedHomeSnapshot?.data || null
let homeCacheTs = persistedHomeSnapshot?.savedAt || 0

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
  const { displayName, isLoggedIn, user, userCanton } = useAuth()
  const navigate = useNavigate()
  const { alertItems, alertCount } = useZoneAlerts()
  const { alerts:businessLeadAlerts, unreadCount:businessLeadUnreadCount, markRead:markBusinessLeadAlertRead } = useBusinessLeadAlerts()
  const { unreadConvIds, hasUnread } = useUnreadMessages()

  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef(null)

  const [recentAds, setRecentAds] = useState(() => homeCache?.recentAds || [])
  const [communityHighlights, setCommunityHighlights] = useState(() => homeCache?.communityHighlights || [])
  const [businessHighlights, setBusinessHighlights] = useState(() => homeCache?.businessHighlights || [])
  const [businessPromotionPlans, setBusinessPromotionPlans] = useState(() => homeCache?.businessPromotionPlans || [])
  const [recentJobs, setRecentJobs] = useState(() => homeCache?.recentJobs || [])
  const [recentEvents, setRecentEvents] = useState(() => homeCache?.recentEvents || [])
  const [attentionTasks, setAttentionTasks] = useState([])
  const [loadingAttention, setLoadingAttention] = useState(false)
  const [expandedAttentionTask, setExpandedAttentionTask] = useState('')
  const attentionCarouselRef = useRef(null)
  const [activeAttentionSlide, setActiveAttentionSlide] = useState(0)
  const [promotableBusinesses, setPromotableBusinesses] = useState([])
  const [businessPromotionModalOpen, setBusinessPromotionModalOpen] = useState(false)
  const [loading, setLoading] = useState(() => !homeCache)
  const [activatingPush, setActivatingPush] = useState(false)
  const [searchFilters, setSearchFilters] = useState({ category:'', canton:'', intent:'' })
  const { needsActivation, refresh: refreshPush } = usePushActivation(user?.id)
  const [selectedGuide, setSelectedGuide] = useState(null)
  useOverlayHistory(!!selectedGuide, () => setSelectedGuide(null))

  const hasNotif = alertCount > 0 || hasUnread || businessLeadUnreadCount > 0
  const rotatedBusinessHighlights = useMemo(
    () => rotateHomeBusinesses(businessHighlights, businessPromotionPlans),
    [businessHighlights, businessPromotionPlans],
  )
  const featuredPromotionAvailability = useMemo(() => {
    const featuredPlan = businessPromotionPlans.find(plan =>
      (plan.plan_key || plan.key) === 'featured'
    )
    const maxActiveValue = Number(featuredPlan?.max_active ?? featuredPlan?.maxActive)
    const maxActive = Number.isFinite(maxActiveValue) && maxActiveValue > 0
      ? maxActiveValue
      : 20
    const availableValue = featuredPlan?.available_slots ?? featuredPlan?.availableSlots
    const parsedAvailable = availableValue == null ? maxActive : Number(availableValue)
    const availableSlots = Number.isFinite(parsedAvailable)
      ? Math.min(Math.max(parsedAvailable, 0), maxActive)
      : maxActive
    const occupiedPercentage = Math.min(
      Math.max(((maxActive - availableSlots) / maxActive) * 100, 0),
      100,
    )

    return { maxActive, availableSlots, occupiedPercentage }
  }, [businessPromotionPlans])
  const visibleAttentionTasks = useMemo(() => loadingAttention ? [] : attentionTasks, [attentionTasks, loadingAttention])
  const showBusinessPromotionTask = SHOW_HOME_BUSINESS_PROMOTION_TASK
    && promotableBusinesses.length > 0
    && featuredPromotionAvailability.availableSlots > 0
  const attentionCarouselCards = [
    ...(isLoggedIn && needsActivation ? [{
      id:'push-activation',
      type:'push',
      emoji:'🔔',
      title:'Activa las notificaciones',
      text:'Recibe respuestas a tus anuncios y novedades en tu zona.',
      actionLabel:activatingPush ? 'Activando...' : 'Activar',
      disabled:activatingPush,
      tone:'primary',
    }] : []),
    ...(showBusinessPromotionTask ? [{
      id:'business-promotion',
      type:'promotion',
      emoji:'✨',
      title:'Destaca tu negocio',
      text:'Consigue más visibilidad entre los usuarios de Latido.',
      actionLabel:'Destacar',
      tone:'primary',
    }] : []),
    ...visibleAttentionTasks.map(task => ({
      ...task,
      type:'review',
      actionLabel:expandedAttentionTask === task.id ? 'Ocultar' : 'Ver',
      count:task.items.length,
    })),
  ]
  const showAttentionSection = attentionCarouselCards.length > 0
  const attentionCarouselCardIds = attentionCarouselCards.map(card => card.id).join('|')
  const expandedAttentionTaskVisible = !expandedAttentionTask
    || attentionCarouselCards.some(card => card.id === expandedAttentionTask)

  const updateAttentionSlideFromScroll = useCallback(() => {
    const scroller = attentionCarouselRef.current
    if (!scroller) return

    const scrollerLeft = scroller.getBoundingClientRect().left
    const slides = Array.from(scroller.children)
    let nextIndex = 0
    let closestDistance = Number.POSITIVE_INFINITY

    slides.forEach((slide, index) => {
      const distance = Math.abs(slide.getBoundingClientRect().left - scrollerLeft)
      if (distance < closestDistance) {
        closestDistance = distance
        nextIndex = index
      }
    })

    setActiveAttentionSlide(current => current === nextIndex ? current : nextIndex)
  }, [])

  const scrollAttentionCardTo = useCallback(index => {
    const scroller = attentionCarouselRef.current
    const target = scroller?.children?.[index]
    if (!target) return

    target.scrollIntoView({ behavior:'smooth', block:'nearest', inline:'start' })
    setActiveAttentionSlide(index)
  }, [])

  useEffect(() => {
    setActiveAttentionSlide(current => Math.min(current, Math.max(attentionCarouselCards.length - 1, 0)))

    if (!expandedAttentionTaskVisible) {
      setExpandedAttentionTask('')
    }
  }, [attentionCarouselCardIds, attentionCarouselCards.length, expandedAttentionTaskVisible])

  async function handleActivatePush() {
    if (activatingPush) return
    setActivatingPush(true)
    try {
      const settings = { ...loadPushSettings(), messagesEnabled: true }
      await subscribeToPushNotifications({ user, settings, userCanton })
      localStorage.setItem(PUSH_SETTINGS_KEY, JSON.stringify(settings))
      toast.success('Notificaciones activadas')
      refreshPush()
    } catch (err) {
      toast.error(err?.message || 'No se pudieron activar las notificaciones')
    } finally {
      setActivatingPush(false)
    }
  }

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
      setPromotableBusinesses([])
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
      const missingImageItems = []
      const addMissingImageItems = (rows, kind, buildItem) => {
        for (const row of rows) {
          if (!isMissingImageDueForReview(kind, row, missingImageConfirmations)) continue
          missingImageItems.push(makeAttentionItem(kind, row, buildItem(row)))
        }
      }

      addMissingImageItems((listingsRes.error ? [] : listingsRes.data) || [], 'ad', row => ({
        table:'listings',
        title: row.title || 'Anuncio',
        meta: [formatAdLocation(row), getAdDisplayCat(row)?.label].filter(Boolean).join(' \u00B7 '),
        emoji: getAdDisplayEmoji(row) || '\u{1F4CC}',
      }))
      addMissingImageItems((jobsRes.error ? [] : jobsRes.data) || [], 'job', row => ({
        table:'jobs',
        title: row.title || 'Empleo',
        meta: [row.company, row.city || row.canton].filter(Boolean).join(' \u00B7 '),
        emoji: getJobCategoryEmoji(row) || '\u{1F4BC}',
      }))
      addMissingImageItems((eventsRes.error ? [] : eventsRes.data) || [], 'event', row => ({
        table:'events',
        title: row.title || 'Evento',
        meta: [[row.day, row.month, row.year].filter(Boolean).join(' '), row.city || row.canton].filter(Boolean).join(' \u00B7 '),
        emoji:'\u{1F389}',
      }))
      addMissingImageItems((providersRes.error ? [] : providersRes.data) || [], 'business', row => ({
        table:'providers',
        title: row.name || 'Negocio',
        meta: [row.city || row.canton, row.category].filter(Boolean).join(' \u00B7 '),
        emoji:'\u{1F3EA}',
      }))
      addMissingImageItems((communitiesRes.error ? [] : communitiesRes.data) || [], 'community', row => ({
        table:'communities',
        title: row.name || 'Grupo',
        meta: [row.city || 'Suiza', row.contact].filter(Boolean).join(' \u00B7 '),
        emoji: row.emoji || '\u{1F465}',
      }))
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

      const userBusinesses = (providersRes.error ? [] : providersRes.data) || []
      const hasFeaturedBusiness = userBusinesses.some(row => isBusinessPromotionActive(row))

      setPromotableBusinesses(hasFeaturedBusiness
        ? []
        : userBusinesses
          .map(row => ({
            id:row.id,
            name:row.name || 'Negocio',
            city:row.city || row.canton || 'Suiza',
            category:row.category || 'Negocio',
            photoUrl:row.photo_url || '',
          }))
      )
      setAttentionTasks(nextTasks)
    } catch (error) {
      console.error('Error loading attention tasks:', error)
      setAttentionTasks([])
      setPromotableBusinesses([])
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
    setBusinessPromotionPlans(snapshot.businessPromotionPlans || [])
    setRecentJobs(snapshot.recentJobs || [])
    setRecentEvents(snapshot.recentEvents || [])
    setLoading(false)
  }, [])

  const fetchHomeData = useCallback(async () => {
    try {
      const [adsRes, communitiesRes, providersRes, providerPhotosRes, jobsRes, eventsRes, promotionPlansRes] = await Promise.all([
        supabase
          .from('listings')
          .select('*')
          .or('active.is.null,active.eq.true')
          .or('privacy.is.null,privacy.eq.public')
          .order('created_at', { ascending:false })
          .limit(HOME_RECENT_ITEM_LIMIT),

        fetchHomeCommunities(),

        fetchHomeProviders(),

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
          .limit(HOME_RECENT_ITEM_LIMIT),

        supabase
          .from('events')
          .select('id, title, day, month, year, city, venue, price, img_url, created_at, active')
          .or('active.is.null,active.eq.true')
          .order('created_at', { ascending:false })
          .limit(12),

        supabase.rpc('get_business_promotion_availability'),
      ])

      if (homeCache && [adsRes, communitiesRes, providersRes, providerPhotosRes, jobsRes, eventsRes].every(result => result.error)) {
        return
      }

      if (adsRes.error) console.error('Error loading recent ads:', adsRes.error)
      if (communitiesRes.error) console.error('Error loading communities:', communitiesRes.error)
      if (providersRes.error) console.error('Error loading providers:', providersRes.error)
      if (providerPhotosRes.error) console.error('Error loading provider photos:', providerPhotosRes.error)
      if (jobsRes.error) console.error('Error loading jobs:', jobsRes.error)
      if (eventsRes.error) console.error('Error loading events:', eventsRes.error)
      if (!promotionPlansRes.error) setBusinessPromotionPlans(promotionPlansRes.data || [])

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
      const reviewableAdIds = []
      for (const ad of adsNorm) {
        if (REVIEWABLE_AD_CATS.has(ad.cat)) reviewableAdIds.push(ad.id)
      }

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

      const recentItems = []
      for (const ad of adsNorm) {
        const reviews = adReviewStats[ad.id] || []
        recentItems.push({
          ...ad,
          rating: averageRating(reviews),
          reviewCount: reviews.length,
        })
      }
      recentItems.push(...jobsNorm)
      recentItems.sort((a, b) => String(b._sort).localeCompare(String(a._sort)))

      const nextRecentAds = []
      for (const { _sort, ...rest } of recentItems.slice(0, HOME_RECENT_ITEM_LIMIT)) {
        nextRecentAds.push(rest)
      }
      setRecentAds(nextRecentAds)

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

      const nextBusinessHighlights = []
      for (const row of ((providersRes.error ? [] : providersRes.data) || [])) {
        if (row.category === 'empleo' || row.category === 'vivienda') continue
        const type = getNegocioTypeMeta(row.category)
        const typeLabel = type?.label?.replace(/^[^\s]+\s/, '') || 'Negocio'
        const verificationStatus = getBusinessVerificationStatus(row)
        const typeEmoji = type?.label?.split(' ')[0] || '\u{1F3EA}'
        nextBusinessHighlights.push({
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
          promotion_plan: row.promotion_plan,
          promotion_starts_at: row.promotion_starts_at,
          promotion_ends_at: row.promotion_ends_at,
        })
      }
      setBusinessHighlights(nextBusinessHighlights)

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
      const upcomingEvents = []
      for (const row of ((eventsRes.error ? [] : eventsRes.data) || [])) {
        if (toEventDate(row) >= today) upcomingEvents.push(row)
      }
      upcomingEvents.sort((a, b) => toEventDate(a) - toEventDate(b))

      const nextRecentEvents = []
      for (const row of upcomingEvents.slice(0, 3)) {
        nextRecentEvents.push({
          id: row.id,
          title: row.title || '',
          day: row.day || '',
          month: row.month || '',
          city: row.city || 'Suiza',
          venue: row.venue || '',
          price: row.price || '',
          img: row.img_url || '',
        })
      }
      setRecentEvents(nextRecentEvents)
    } catch (error) {
      console.error('Error loading home data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (loading) return
    homeCache = { recentAds, communityHighlights, businessHighlights, businessPromotionPlans, recentJobs, recentEvents }
    homeCacheTs = Date.now()
    writeOfflineSnapshot('home-public', {
      ...homeCache,
      recentAds: recentAds.filter(item => !item.privacy || item.privacy === 'public'),
    })
  }, [businessHighlights, businessPromotionPlans, communityHighlights, loading, recentAds, recentEvents, recentJobs])

  useEffect(() => {
    if (homeCache) {
      applySnapshot(homeCache)
    }

    fetchHomeData()

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

        <div style={{ maxWidth:1200, margin:'0 auto', position:'relative', zIndex:1 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16, marginBottom:18 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <h1 style={{ fontFamily:PP, fontWeight:900, fontSize:'clamp(28px,5.5vw,44px)', lineHeight:1.15, letterSpacing:-0.6, color:'#fff', margin:'0 0 4px' }}>
                Hola {firstName}.
              </h1>
              <h2 style={{ fontFamily:PP, fontWeight:500, fontSize:'clamp(16px,4vw,22px)', lineHeight:1.3, letterSpacing:-0.2, color:'rgba(255,255,255,0.85)', margin:0 }}>
                ¡Te estábamos esperando!
              </h2>

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
                  style={{ position:'relative', background:'rgba(255,255,255,0.15)', border:'none', borderRadius:'50%', width:46, height:46, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, cursor:'pointer', marginTop:0 }}
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

                      {businessLeadAlerts.length > 0 && (
                        <div style={{ padding:'10px 14px 6px' }}>
                          <p style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:C.light, margin:'0 0 8px', letterSpacing:0.5 }}>CLIENTES POTENCIALES</p>
                          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                            {businessLeadAlerts.map(alert => (
                              <button
                                key={alert.id}
                                onClick={() => { markBusinessLeadAlertRead(alert.id); closeNotifPanel(); navigate(alert.listing_path) }}
                                style={{ width:'100%', background:alert.read_at ? C.bg : '#EFF6FF', border:`1px solid ${alert.read_at ? C.border : '#BFDBFE'}`, borderRadius:12, padding:'10px 12px', display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', textAlign:'left' }}
                              >
                                <span style={{ fontSize:18, marginTop:1 }}>🔔</span>
                                <div style={{ flex:1, minWidth:0 }}>
                                  <p style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:C.text, margin:'0 0 2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{alert.listing_title}</p>
                                  <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>{alert.provider_name}{alert.matched_terms?.length ? ` · ${alert.matched_terms.join(', ')}` : ''}</p>
                                </div>
                                <span style={{ color:C.light, fontSize:16 }}>›</span>
                              </button>
                            ))}
                          </div>
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
            <GlobalSearch
              size="lg"
              assistantMode
              placeholder="Ej.: busco piso en Zürich hasta 3.000 CHF"
              searchFilters={searchFilters}
              onSearchFiltersChange={setSearchFilters}
              filtersContent={(
                <div className="no-scroll" role="group" aria-label="Filtros de búsqueda" style={{ overflowX:'auto', WebkitOverflowScrolling:'touch', marginTop:8 }}>
                  <div style={{ display:'flex', gap:8, width:'100%', minWidth:340 }}>
                    <SearchFilterSelect
                      label="Categoría"
                      value={searchFilters.category}
                      options={HOME_SEARCH_CATEGORY_OPTIONS}
                      onChange={event => setSearchFilters(current => ({ ...current, category:event.target.value }))}
                    />
                    <SearchFilterSelect
                      label="Cantón"
                      value={searchFilters.canton}
                      flex={1.1}
                      options={[
                        { value:'', label:'Suiza' },
                        ...CANTONS.map(canton => ({ value:canton.code, label:`${canton.code} · ${canton.name}` })),
                      ]}
                      onChange={event => setSearchFilters(current => ({ ...current, canton:event.target.value }))}
                    />
                    <SearchFilterSelect
                      label="Intención"
                      value={searchFilters.intent}
                      flex={1.05}
                      options={HOME_SEARCH_INTENT_OPTIONS}
                      onChange={event => setSearchFilters(current => ({ ...current, intent:event.target.value }))}
                    />
                  </div>
                </div>
              )}
            />
          </div>
        </div>
      </section>

      {showAttentionSection && (
        <section style={{ background:'#fff', padding:'12px 0 2px' }}>
          <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 16px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, marginBottom:8 }}>
              <div>
                <p style={{ fontFamily:PP, fontSize:10, fontWeight:800, color:C.primary, margin:'0 0 3px', textTransform:'uppercase' }}>
                  Necesita atención
                </p>
                <h2 style={{ fontFamily:PP, fontWeight:900, fontSize:18, color:C.text, margin:0 }}>
                  Tareas pendientes
                </h2>
              </div>
              {attentionCarouselCards.length > 1 && (
                <span style={{ fontFamily:PP, fontWeight:800, fontSize:11, color:C.primaryDark, whiteSpace:'nowrap' }}>
                  {Math.min(activeAttentionSlide + 1, attentionCarouselCards.length)}/{attentionCarouselCards.length}
                </span>
              )}
            </div>

            <div
              ref={attentionCarouselRef}
              className="no-scroll"
              onScroll={updateAttentionSlideFromScroll}
              style={{
                display:'flex',
                gap:10,
                margin:'0 -16px',
                padding:'0 16px 12px',
                overflowX:'auto',
                scrollBehavior:'smooth',
                scrollPaddingInline:16,
                scrollSnapType:'x mandatory',
                WebkitOverflowScrolling:'touch',
              }}
              aria-roledescription="carrusel"
              aria-label="Tareas pendientes"
            >
              {isLoggedIn && needsActivation && (
                <div style={{ flex:'0 0 100%', minWidth:0, scrollSnapAlign:'start', scrollSnapStop:'always', background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:16, overflow:'hidden', boxShadow:'0 10px 24px rgba(37, 99, 235, 0.08)' }}>
                  <div style={{ padding:'13px 14px', display:'flex', gap:12, alignItems:'center' }}>
                    <span style={{ width:38, height:38, borderRadius:13, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                      🔔
                    </span>
                    <span style={{ minWidth:0, flex:1 }}>
                      <span style={{ display:'block', fontFamily:PP, fontWeight:800, fontSize:13, color:C.text, marginBottom:2 }}>
                        Activa las notificaciones
                      </span>
                      <span style={{ display:'block', fontFamily:PP, fontSize:11, color:C.primaryDark, lineHeight:1.45 }}>
                        Recibe respuestas a tus anuncios y novedades en tu zona.
                      </span>
                    </span>
                    <button
                      onClick={handleActivatePush}
                      disabled={activatingPush}
                      style={{
                        fontFamily:PP,
                        fontWeight:800,
                        fontSize:10,
                        color:'#fff',
                        background:C.primary,
                        border:'none',
                        borderRadius:999,
                        padding:'7px 12px',
                        flexShrink:0,
                        cursor:activatingPush ? 'default' : 'pointer',
                        opacity:activatingPush ? 0.65 : 1,
                        whiteSpace:'nowrap',
                      }}
                    >
                      {activatingPush ? 'Activando...' : 'Activar'}
                    </button>
                  </div>
                </div>
              )}
              {showBusinessPromotionTask && (
                <div style={{ flex:'0 0 100%', minWidth:0, scrollSnapAlign:'start', scrollSnapStop:'always', background:C.primaryLight, border:`1px solid ${C.primaryMid}`, borderRadius:16, overflow:'hidden', boxShadow:'0 10px 24px rgba(37, 99, 235, 0.08)' }}>
                  <div style={{ padding:'13px 14px', display:'flex', gap:12, alignItems:'center' }}>
                    <span style={{ width:38, height:38, borderRadius:13, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                      ✨
                    </span>
                    <span style={{ minWidth:0, flex:1 }}>
                      <span style={{ display:'block', fontFamily:PP, fontWeight:800, fontSize:13, color:C.text, marginBottom:2 }}>
                        Destaca tu negocio
                      </span>
                      <span style={{ display:'block', fontFamily:PP, fontSize:11, color:C.primaryDark, lineHeight:1.45 }}>
                        Consigue más visibilidad entre los usuarios de Latido.
                      </span>
                    </span>
                    <button
                      onClick={() => setBusinessPromotionModalOpen(true)}
                      style={{ fontFamily:PP, fontWeight:800, fontSize:10, color:'#fff', background:C.primary, border:'none', borderRadius:999, padding:'7px 12px', flexShrink:0, cursor:'pointer', whiteSpace:'nowrap' }}
                    >
                      Destacar
                    </button>
                  </div>
                  <div style={{ padding:'0 14px 13px' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginBottom:6 }}>
                      <span style={{ fontFamily:PP, fontSize:9, fontWeight:700, color:C.primaryDark }}>
                        Disponibles
                      </span>
                      <span style={{ fontFamily:PP, fontSize:9, fontWeight:900, color:C.primaryDark }}>
                        {featuredPromotionAvailability.availableSlots}/{featuredPromotionAvailability.maxActive}
                      </span>
                    </div>
                    <div style={{ height:5, borderRadius:999, background:C.primaryLight, overflow:'hidden' }}>
                      <div
                        style={{
                          width:`${featuredPromotionAvailability.occupiedPercentage}%`,
                          minWidth:featuredPromotionAvailability.occupiedPercentage > 0 ? 5 : 0,
                          height:'100%',
                          borderRadius:999,
                          background:C.primary,
                          transition:'width 220ms ease',
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
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
                      flex:'0 0 100%',
                      minWidth:0,
                      scrollSnapAlign:'start',
                      scrollSnapStop:'always',
                      borderRadius:16,
                      overflow:'hidden',
                      boxShadow:'0 10px 24px rgba(37, 99, 235, 0.08)',
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
                                  <img src={getThumbnailImageUrl(item.image)} alt={item.title} loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
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

            {attentionCarouselCards.length > 1 && (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'0 0 5px' }} aria-label="Tarjetas de tareas pendientes">
                {attentionCarouselCards.map((card, index) => {
                  const active = activeAttentionSlide === index
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => scrollAttentionCardTo(index)}
                      aria-label={`Ver tarea ${index + 1} de ${attentionCarouselCards.length}`}
                      aria-current={active ? 'true' : undefined}
                      style={{
                        width:active ? 18 : 7,
                        height:7,
                        padding:0,
                        border:'none',
                        borderRadius:999,
                        background:active ? C.primary : '#CBD5E1',
                        boxShadow:active ? '0 3px 8px rgba(37, 99, 235, 0.22)' : 'none',
                        cursor:'pointer',
                        transition:'width 180ms ease, background 180ms ease, box-shadow 180ms ease',
                      }}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── ANUNCIOS RECIENTES ── */}
      <Modal
        show={businessPromotionModalOpen}
        onClose={() => setBusinessPromotionModalOpen(false)}
        title="Destaca tu negocio"
        syncHistory={false}
      >
        <div style={{ textAlign:'center', marginBottom:18 }}>
          <div style={{ width:64, height:64, borderRadius:22, background:C.primaryLight, display:'flex', alignItems:'center', justifyContent:'center', fontSize:30, margin:'0 auto 12px' }}>
            ✨
          </div>
          <h3 style={{ fontFamily:PP, fontWeight:900, fontSize:20, color:C.text, margin:'0 0 8px' }}>
            Haz que más clientes te encuentren
          </h3>
          <p style={{ fontFamily:PP, fontSize:12, lineHeight:1.65, color:C.mid, margin:0 }}>
            Tu negocio tendrá prioridad en la rotación de Inicio y mostrará la identificación azul de Negocio Destacado.
          </p>
        </div>

        <div style={{ background:C.primaryLight, border:`1px solid ${C.primaryMid}`, borderRadius:16, padding:'13px 14px', marginBottom:16 }}>
          <p style={{ fontFamily:PP, fontWeight:900, fontSize:18, color:C.primaryDark, margin:'0 0 4px' }}>
            CHF 49 <span style={{ fontSize:11, fontWeight:700 }}>/ mes</span>
          </p>
          <p style={{ fontFamily:PP, fontSize:11, lineHeight:1.5, color:C.primaryDark, margin:0 }}>
            Suscripción mensual, con un máximo de 20 negocios destacados al mismo tiempo.
          </p>
        </div>

        <p style={{ fontFamily:PP, fontWeight:800, fontSize:12, color:C.text, margin:'0 0 9px' }}>
          {promotableBusinesses.length === 1
            ? 'Tu negocio'
            : 'Elige el negocio que quieres destacar'}
        </p>

        <div style={{ display:'grid', gap:9 }}>
          {promotableBusinesses.map(business => (
            <div key={business.id} style={{ display:'flex', alignItems:'center', gap:11, border:`1px solid ${C.border}`, borderRadius:15, padding:10 }}>
              {business.photoUrl ? (
                <img src={getThumbnailImageUrl(business.photoUrl)} alt={business.name} style={{ width:44, height:44, borderRadius:12, objectFit:'cover', flexShrink:0 }} />
              ) : (
                <span style={{ width:44, height:44, borderRadius:12, background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:21, flexShrink:0 }}>
                  🏪
                </span>
              )}
              <span style={{ minWidth:0, flex:1 }}>
                <span style={{ display:'block', fontFamily:PP, fontWeight:800, fontSize:12, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {business.name}
                </span>
                <span style={{ display:'block', fontFamily:PP, fontSize:10, color:C.light, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {[business.category, business.city].filter(Boolean).join(' · ')}
                </span>
              </span>
              <button
                onClick={() => {
                  setBusinessPromotionModalOpen(false)
                  navigate(`/negocios/${business.id}/destacar`)
                }}
                style={{ fontFamily:PP, fontWeight:800, fontSize:10, color:'#fff', background:C.primary, border:'none', borderRadius:11, padding:'9px 11px', cursor:'pointer', flexShrink:0 }}
              >
                Destacar negocio
              </button>
            </div>
          ))}
        </div>
      </Modal>

      <section style={{ padding:'24px 0 0' }}>
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 16px', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:20, color:C.text, margin:0, letterSpacing:0 }}>📌 Anuncios recientes</h2>
          <Link to="/tablon" style={{ fontFamily:PP, fontSize:12, fontWeight:700, color:C.primary, textDecoration:'none', whiteSpace:'nowrap' }}>Ver todos →</Link>
        </div>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
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
                          ? <img src={getThumbnailImageUrl(ad.img)} alt={ad.title} loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:'contain', position:'absolute', inset:0 }} />
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
        </div>
      </section>

      {/* <section style={{ maxWidth:1200, margin:'0 auto', padding:'34px 16px 0' }}>
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
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 16px', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
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

        <div style={{ maxWidth:1200, margin:'0 auto' }}>
        {loading ? (
          <div className="no-scroll" style={{ display:'flex', gap:12, padding:'4px 16px 16px', overflowX:'auto' }}>
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ flexShrink:0, width:152, height:190, borderRadius:16 }}/>)}
          </div>
        ) : rotatedBusinessHighlights.length === 0 ? (
          <div style={{ padding:'0 16px' }}><EmptyState text="Todavía no hay negocios publicados." /></div>
        ) : (
          <div className="no-scroll" style={{ overflowX:'auto', WebkitOverflowScrolling:'touch', padding:'4px 16px 16px' }}>
            <div style={{ display:'flex', gap:12, width:'max-content' }}>
              {rotatedBusinessHighlights.map(business => {
                const promotionMeta = getBusinessPromotionMeta(business.effectivePromotionPlan)
                const hasPromotion = promotionMeta.key !== 'free'

                return (
                  <Link
                    key={business.id}
                    to={getBusinessHref(business)}
                    style={{ flexShrink:0, width:152, display:'block', textDecoration:'none' }}
                  >
                    <div style={{ background:'#fff', borderRadius:16, border:`1px solid ${C.border}`, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
                    <div style={{ position:'relative', height:160, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:44, overflow:'visible' }}>
                      {business.photo_url
                        ? <img src={getThumbnailImageUrl(business.photo_url)} alt={business.name} loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:'contain' }} />
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
                      {hasPromotion && (
                        <span style={{ position:'absolute', left:'50%', bottom:-12, transform:'translateX(-50%)', zIndex:2, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:5, fontFamily:PP, fontSize:9, fontWeight:800, color:promotionMeta.color, background:'#fff', border:`1.5px solid ${promotionMeta.color}`, borderRadius:999, padding:'6px 10px', boxShadow:'0 8px 18px rgba(15,23,42,0.14)', whiteSpace:'nowrap' }}>
                          {promotionMeta.shortLabel}
                        </span>
                      )}
                    </div>
                    <div style={{ padding:hasPromotion ? '18px 10px 12px' : '10px 10px 12px' }}>
                      <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.text, margin:'0 0 4px', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', lineHeight:1.35, minHeight:'2.7em', overflowWrap:'anywhere' }}>
                        {business.name}
                      </p>
                      <p style={{ fontFamily:PP, fontSize:10, color:C.light, margin:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        📍 {business.city}{business.services.length ? ` · ${business.services[0]}` : ''}
                      </p>
                    </div>
                  </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
        </div>
      </section>

      <PartnersSection />

      <section style={{ padding:'40px 0 0' }}>
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 16px', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:0 }}>
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

        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <EventfrogCalendar compact layout="carousel" maxEvents={60} />
        </div>
      </section>

      <section style={{ padding:'40px 0 0' }}>
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 16px', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
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

        <div style={{ maxWidth:1200, margin:'0 auto' }}>
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
                        ? <img src={getThumbnailImageUrl(group.photo_url)} alt={group.name} loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:'contain' }} />
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
        </div>
      </section>

      {/* Empleos recientes — oculto temporalmente
      <section style={{ maxWidth:1200, margin:'0 auto', padding:'40px 16px 0' }}>
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
            <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 16px', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <div>
                <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:20, color:C.text, margin:'0 0 4px' }}>📚 Guías</h2>
                <p style={{ fontFamily:PP, fontSize:12, color:C.mid, margin:0 }}>Permisos, trabajo, vivienda, salud y dinero en español.</p>
              </div>
              <Link to="/guias" style={{ fontFamily:PP, fontSize:11, fontWeight:700, color:C.primary, textDecoration:'none', flexShrink:0 }}>Ver todas →</Link>
            </div>
            <div style={{ maxWidth:1200, margin:'0 auto' }}>
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
            </div>
          </section>
        )
      })()}

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

      <section style={{ maxWidth:1200, margin:'0 auto', padding:'42px 16px 110px' }}>
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
