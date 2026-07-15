import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { usePWA } from '../hooks/usePWA'
import { useFavorites } from '../hooks/useFavorites'
import { notifyZoneAlertsUpdated } from '../hooks/useZoneAlerts'
import { PUSH_STATUS_EVENT, getPushStatus, subscribeToPushNotifications, syncPushPreferences, unsubscribeFromPushNotifications } from '../lib/pushNotifications'
import { MAX_PUBLICATION_IMAGES, uploadAvatar, getStorageErrorMessage, uploadPublicationImage, uploadPublicationImages } from '../lib/storage'
import { invalidateAvatarCache } from '../lib/profiles'
import { C, PP } from '../lib/theme'
import { Avatar, Btn, EmptyState, ImageUploadField, InfoBanner, Input, Modal, Select, Sheet, Tag } from '../components/UI'
import { AD_TYPES, CANTONS, COMMUNITY_CATS, EVENTO_TYPES, JOB_INTENTS, JOB_SECTORS, JOB_TYPES, VISIBLE_NEGOCIO_TYPES, formatAdLocation, getAdCategoriesForType, getAdDisplayCat, getAdDisplayEmoji, getAdSubLabel, getAdSubOptions, getJobIntentMeta, getNegocioTypeMeta, normalizeAdCat, normalizeNegocioType } from '../lib/constants'
import { normalizeExternalUrl } from '../lib/links'
import { getBusinessPromotionMeta, isBusinessPromotionActive, PAID_BUSINESS_FEATURES_VISIBLE } from '../lib/businessPromotion'
import { getThumbnailImageUrl } from '../lib/imageVariants'
import { canUseWhatsappNumber } from '../lib/businessContact'
import toast from 'react-hot-toast'

const PUBLICATION_TABS = [
  { id:'all', label:'Todo' },
  { id:'ad', label:'📌 Anuncios' },
  { id:'job', label:'💼 Empleos' },
  { id:'event', label:'🎉 Eventos' },
  { id:'business', label:'🏪 Negocios' },
  { id:'community', label:'👥 Grupos' },
]

const MULTI_PHOTO_AD_CATS = new Set(['vivienda', 'venta'])
const BLOCKING_BUSINESS_SUBSCRIPTION_STATUSES = new Set([
  'active',
  'past_due',
  'processing',
])

function isActiveBusinessSubscriptionError(error) {
  if (!error) return false

  const errorText = [
    error.message,
    error.details,
    error.hint,
    error.code,
  ].filter(Boolean).join(' ')

  return errorText.includes('ACTIVE_BUSINESS_SUBSCRIPTION')
}

const COMMUNITY_OPTIONS = []
for (const item of COMMUNITY_CATS) {
  if (item.id === 'fe') continue
  COMMUNITY_OPTIONS.push(item.id === 'mamas'
    ? { ...item, id:'familia', emoji:'????????', label:'Familia' }
    : item)
}

const ALERT_CATS = [
  { id:'eventos', emoji:'🎉', label:'Eventos' },
  { id:'vivienda', emoji:'🏠', label:'Vivienda' },
  { id:'servicios', emoji:'🔧', label:'Servicios' },
  { id:'empleo', emoji:'💼', label:'Empleo' },
  { id:'venta', emoji:'🛍️', label:'Mercado' },
  { id:'cuidados', emoji:'❤️', label:'Cuidados' },
  { id:'documentos', emoji:'📄', label:'Trámites' },
  { id:'regalo', emoji:'🎁', label:'Regalos' },
]

const LANGS = ['Español', 'Alemán', 'Francés', 'Italiano', 'Inglés', 'Portugués']
const PRICE_UNITS = [
  { id:'hora', label:'Por hora' },
  { id:'dia', label:'Por día' },
  { id:'mes', label:'Por mes' },
  { id:'once', label:'Total' },
]
const PRICE_UNIT_IDS = new Set(PRICE_UNITS.map(unit => unit.id))
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

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6A2 2 0 0 0 13.4 13.4" />
      <path d="M9.9 4.2A10.9 10.9 0 0 1 12 4.1c6.5 0 10 7.9 10 7.9a17.6 17.6 0 0 1-3.4 4.3" />
      <path d="M6.6 6.6C3.7 8.6 2 12 2 12s3.5 7.9 10 7.9a10.7 10.7 0 0 0 4.1-.8" />
    </svg>
  )
}

function PasswordVisibilityButton({ visible, onToggle }) {
  const label = visible ? 'Ocultar contraseña' : 'Mostrar contraseña'

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={visible}
      title={label}
      onClick={onToggle}
      onMouseDown={event => event.preventDefault()}
      style={{
        width:30,
        height:30,
        border:'none',
        borderRadius:10,
        background:'transparent',
        color:C.light,
        cursor:'pointer',
        display:'flex',
        alignItems:'center',
        justifyContent:'center',
        padding:0,
      }}
    >
      {visible ? <EyeOffIcon /> : <EyeIcon />}
    </button>
  )
}
const ATTENTION_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000
const AD_REVIEW_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000
const EDITOR_IMAGE_CONFIG = {
  job: { field:'logo_url', folder:'jobs', label:'Imagen del empleo', hint:'Puedes subir un logo, una foto del puesto o una imagen representativa.' },
  event: { field:'img_url', folder:'events', label:'Imagen del evento', hint:'Una imagen ayuda a que el evento destaque en la sección de eventos.' },
  business: { field:'photo_url', folder:'businesses', label:'Imagen del negocio', hint:'Sube una foto del negocio, logo, producto o servicio principal.' },
  community: { field:'photo_url', folder:'communities', label:'Imagen del grupo', hint:'Una imagen hace que el grupo se vea más cercano y reconocible.' },
}

function normalizeCommunityCategory(value='') {
  if (value === 'mamas') return 'familia'
  if (value === 'fe') return ''
  return value
}

function normalizeAlertCategories(categories=[]) {
  return Array.from(new Set((categories || []).map(normalizeAdCat).filter(Boolean)))
}

function normalizeMonthKey(value='') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .slice(0, 3)
    .toUpperCase()
}

function getEventEndDate(row={}) {
  const day = Number.parseInt(row.day, 10)
  const month = EVENT_MONTH_INDEX[normalizeMonthKey(row.month)]
  const year = Number.parseInt(row.year, 10) || new Date().getFullYear()
  if (!day || month === undefined || !year) return null

  const date = new Date(year, month, day, 23, 59, 59, 999)
  return Number.isNaN(date.getTime()) ? null : date
}

function isExpiredEventPublication(item, confirmations={}) {
  if (item?.kind !== 'event' || !item.active) return false
  const endDate = getEventEndDate(item.raw)
  if (!endDate || endDate >= new Date()) return false
  const confirmedAt = getTimeMs(confirmations[item.id])
  return !confirmedAt || Date.now() - confirmedAt >= AD_REVIEW_INTERVAL_MS
}

function formatEventSchedule(row={}) {
  const date = [row.day, row.month, row.year].filter(Boolean).join(' ')
  return [date, row.time].filter(Boolean).join(' · ') || 'Fecha pasada'
}

function getTimeMs(value) {
  if (!value) return 0
  const date = new Date(value)
  const time = date.getTime()
  return Number.isNaN(time) ? 0 : time
}

function formatTimeSince(value) {
  const time = getTimeMs(value)
  if (!time) return 'hace un tiempo'

  const days = Math.max(0, Math.floor((Date.now() - time) / (24 * 60 * 60 * 1000)))
  if (days === 0) return 'hoy'
  if (days === 1) return 'ayer'
  if (days < 30) return `hace ${days} días`

  const months = Math.floor(days / 30)
  if (months < 12) return `hace ${months} ${months === 1 ? 'mes' : 'meses'}`

  const years = Math.floor(days / 365)
  return `hace ${years} ${years === 1 ? 'año' : 'años'}`
}

function isAdDueForReview(item, confirmations={}) {
  if (item?.kind !== 'ad' || !item.active) return false

  const createdAt = getTimeMs(item.createdAt)
  if (!createdAt || Date.now() - createdAt < AD_REVIEW_INTERVAL_MS) return false

  const reviewAnchor = Math.max(
    createdAt,
    getTimeMs(item.raw?.updated_at),
    getTimeMs(confirmations[item.id])
  )

  return Date.now() - reviewAnchor >= AD_REVIEW_INTERVAL_MS
}

const KIND_META = {
  ad: { label:'Anuncio', icon:'📌', table:'listings' },
  job: { label:'Empleo', icon:'💼', table:'jobs' },
  event: { label:'Evento', icon:'🎉', table:'events' },
  business: { label:'Negocio', icon:'🏪', table:'providers' },
  community: { label:'Grupo', icon:'👥', table:'communities' },
}

function splitList(value) {
  return value.split(',').map(item => item.trim()).filter(Boolean)
}

function supportsMultipleAdPhotos(cat) {
  return MULTI_PHOTO_AD_CATS.has(normalizeAdCat(cat))
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

function uniqueUrls(urls) {
  return Array.from(new Set((urls || []).filter(Boolean)))
}

function getAdPhotoUrls(row={}) {
  return uniqueUrls([
    ...normalizePhotoUrls(row.photo_urls),
    row.img_url,
    row.img,
  ])
}

function getPublicationImageUrl(item) {
  if (!item) return ''
  if (item.kind === 'ad') return getAdPhotoUrls(item.raw)[0] || ''
  if (item.kind === 'job') return item.raw?.logo_url || ''
  if (item.kind === 'event') return item.raw?.img_url || ''
  if (item.kind === 'business' || item.kind === 'community') return item.raw?.photo_url || ''
  return ''
}

function formatAdPrice(priceValue, priceUnit='hora') {
  const value = String(priceValue || '').trim()
  if (!value) return ''

  if (priceUnit === 'once') return `CHF ${value} total`
  if (priceUnit === 'hora') return `CHF ${value} / hora`
  if (priceUnit === 'dia') return `CHF ${value} / día`
  if (priceUnit === 'mes') return `CHF ${value} / mes`

  return `CHF ${value}`
}

function parseAdPrice(row={}) {
  const structuredAmount = row.price_amount
  if (structuredAmount !== null && structuredAmount !== undefined && structuredAmount !== '') {
    const unit = PRICE_UNIT_IDS.has(row.price_unit) ? row.price_unit : 'hora'
    return { value:String(structuredAmount), unit }
  }

  const raw = String(row.price || '').trim()
  const match = raw.match(/\d+(?:[.,]\d+)?/)
  if (!match) return { value:'', unit:'hora' }

  const normalized = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  let unit = 'once'
  if (/(?:\/\s*h\b|\bhora?s?\b|por hora)/.test(normalized)) unit = 'hora'
  else if (/(?:\/\s*d\b|\bdia?s?\b|por dia)/.test(normalized)) unit = 'dia'
  else if (/(?:\/\s*m\b|\bmes(?:es)?\b|por mes)/.test(normalized)) unit = 'mes'

  return { value:match[0], unit }
}

function AdPriceEditor({ form, onChange }) {
  const formatted = formatAdPrice(form.priceValue, form.priceUnit)

  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ display:'block', fontFamily:PP, fontSize:12, fontWeight:700, color:C.light, marginBottom:8 }}>
        Precio (opcional)
      </label>
      <div style={{ display:'flex', gap:8, alignItems:'stretch' }}>
        <div style={{ display:'flex', border:`1.5px solid ${C.border}`, borderRadius:14, overflow:'hidden', flex:1, background:'#fff' }}>
          <div style={{ padding:'13px 14px', background:C.primaryLight, color:C.primary, fontWeight:800, fontSize:12, whiteSpace:'nowrap', display:'flex', alignItems:'center' }}>
            CHF
          </div>
          <input
            type="text"
            inputMode="decimal"
            placeholder="Ej: 30"
            value={form.priceValue || ''}
            onChange={event => onChange('priceValue', event.target.value.replace(/[^0-9.,]/g, ''))}
            style={{ flex:1, minWidth:0, border:'none', outline:'none', background:'transparent', padding:'13px 14px', fontFamily:PP, fontSize:13, color:C.text }}
          />
        </div>
        <select
          value={form.priceUnit || 'hora'}
          onChange={event => onChange('priceUnit', event.target.value)}
          style={{ border:`1.5px solid ${C.border}`, borderRadius:14, padding:'0 12px', fontFamily:PP, fontSize:12, color:C.text, background:'#fff', cursor:'pointer', minWidth:96 }}
        >
          {PRICE_UNITS.map(unit => <option key={unit.id} value={unit.id}>{unit.label}</option>)}
        </select>
      </div>
      {formatted && (
        <p style={{ fontFamily:PP, fontSize:11, color:C.primary, margin:'8px 0 0', background:C.primaryLight, padding:'8px 12px', borderRadius:10 }}>
          Se mostrará como: <strong>{formatted}</strong>
        </p>
      )}
    </div>
  )
}

function formatDate(value) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return date.toLocaleDateString('es-ES', { day:'numeric', month:'short', year:'numeric' })
}

function normalizePublication(kind, row) {
  if (kind === 'ad') {
    const cat = getAdDisplayCat(row)
    const type = AD_TYPES.find(item => item.id === row.type)
    return {
      id: row.id,
      kind,
      icon: getAdDisplayEmoji(row) || cat?.emoji || KIND_META[kind].icon,
      title: row.title,
      summary: `${type?.label || 'Anuncio'}${row.price ? ` · ${row.price}` : ''}`,
      meta: [formatAdLocation(row), row.privacy === 'private' ? 'Privado' : 'Público'].filter(Boolean).join(' · '),
      active: !!row.active,
      createdAt: row.created_at,
      raw: row,
    }
  }

  if (kind === 'job') {
    const intent = getJobIntentMeta(row)
    return {
      id: row.id,
      kind,
      icon: row.emoji || KIND_META[kind].icon,
      title: row.title,
      summary: [intent.label, row.company, row.type].filter(Boolean).join(' · ') || 'Empleo',
      meta: [row.city || row.canton, row.salary].filter(Boolean).join(' · '),
      active: !!row.active,
      createdAt: row.created_at,
      raw: row,
    }
  }

  if (kind === 'event') {
    const type = EVENTO_TYPES.find(item => item.id === row.type)
    return {
      id: row.id,
      kind,
      icon: row.emoji || type?.label?.split(' ')[0] || KIND_META[kind].icon,
      title: row.title,
      summary: [type?.label?.replace(/^[^\s]+\s/, ''), row.venue].filter(Boolean).join(' · ') || 'Evento',
      meta: [row.city || row.canton, [row.day, row.month, row.time].filter(Boolean).join(' ')].filter(Boolean).join(' · '),
      active: !!row.active,
      createdAt: row.created_at,
      raw: row,
    }
  }

  if (kind === 'business') {
    const type = getNegocioTypeMeta(row.category)
    return {
      id: row.id,
      kind,
      icon: type?.label?.split(' ')[0] || KIND_META[kind].icon,
      title: row.name,
      summary: [type?.label?.replace(/^[^\s]+\s/, ''), row.city || row.canton].filter(Boolean).join(' · ') || 'Negocio',
      meta: [row.featured ? 'Destacado' : null, row.verified ? 'Verificada' : null].filter(Boolean).join(' · '),
      active: !!row.active,
      createdAt: row.created_at,
      raw: row,
    }
  }

  const category = COMMUNITY_OPTIONS.find(item => item.id === normalizeCommunityCategory(row.cat))
  return {
    id: row.id,
    kind,
    icon: row.emoji || category?.emoji || KIND_META[kind].icon,
    title: (row.name || '').replace(/Mam[aá]s Latinas/gi, 'Familias Latinas'),
    summary: [category?.label, row.city].filter(Boolean).join(' · ') || 'Grupo',
    meta: row.contact || '',
    active: !!row.active,
    createdAt: row.created_at,
    raw: row,
  }
}

function buildEditorForm(item) {
  const row = item.raw

  if (item.kind === 'ad') {
    const photoUrls = getAdPhotoUrls(row)
    const parsedPrice = parseAdPrice(row)
    const cat = normalizeAdCat(row.cat) || ''
    const type = row.type || ''
    const sub = getAdSubOptions(cat, type)
      .some(option => getAdSubLabel(option) === row.sub)
      ? row.sub
      : ''
    return {
      cat,
      sub,
      type,
      title: row.title || '',
      desc: row.desc || '',
      img_url: photoUrls[0] || '',
      photo_urls: photoUrls,
      price: row.price || '',
      priceValue: parsedPrice.value,
      priceUnit: parsedPrice.unit,
      canton: row.canton || '',
      plz: row.plz || '',
      privacy: row.privacy || 'public',
      contactPhone: row.contact_phone || '',
      contactEmail: row.contact_email || '',
    }
  }

  if (item.kind === 'job') {
    return {
      jobIntent: row.job_intent || 'ofrece',
      sector: row.sector || row.category || '',
      title: row.title || '',
      company: row.company || '',
      logo_url: row.logo_url || '',
      type: row.type || '',
      city: row.city || '',
      canton: row.canton || '',
      salary: row.salary || '',
      langs: Array.isArray(row.languages) ? row.languages.join(', ') : (row.lang || ''),
      desc: row.desc || '',
      contactPhone: row.contact_phone || '',
      contactEmail: row.contact_email || '',
      contactLink: row.contact_link || '',
    }
  }

  if (item.kind === 'event') {
    return {
      type: row.type || '',
      title: row.title || '',
      day: row.day || '',
      month: row.month || '',
      year: row.year || '',
      time: row.time || '',
      price: row.price || '',
      city: row.city || '',
      canton: row.canton || '',
      venue: row.venue || '',
      desc: row.desc || '',
      img_url: row.img_url || '',
      host: row.host || '',
      link: row.link || '',
    }
  }

  if (item.kind === 'business') {
    return {
      category: row.category || '',
      name: row.name || '',
      city: row.city || '',
      canton: row.canton || '',
      address: row.address || '',
      description: row.description || '',
      photo_url: row.photo_url || '',
      phone: row.phone || row.whatsapp || '',
      hasWhatsapp: Boolean(row.whatsapp),
      whatsapp: row.whatsapp || '',
      email: row.email || '',
      instagram: row.instagram || '',
      website: row.website || '',
      services: Array.isArray(row.services) ? row.services.join(', ') : '',
      partner_logo_url: row.partner_logo_url || '',
      partner_card_title: row.partner_card_title || '',
      partner_card_description: row.partner_card_description || '',
      partner_cta_label: row.partner_cta_label || '',
      partner_cta_url: row.partner_cta_url || '',
      partner_published: row.partner_published !== false,
    }
  }

  return {
    cat: row.cat || '',
    name: row.name || '',
    city: row.city || '',
    desc: row.desc || '',
    photo_url: row.photo_url || '',
    contact: row.contact || '',
  }
}

function loadAlertSettings() {
  try {
    const settings = JSON.parse(localStorage.getItem('latido_alerts') || '{}')
    return {
      messagesEnabled: settings.messagesEnabled !== false,
      ...settings,
      categories: normalizeAlertCategories(settings.categories),
    }
  } catch { return { messagesEnabled: true, categories: [] } }
}

export default function Perfil() {
  const { isLoggedIn, displayName, userCanton, user, signOut, avatarUrl, updateAvatar, isAdmin } = useAuth()
  const { isPWA, canInstall, promptInstall } = usePWA()
  const navigate = useNavigate()
  const location = useLocation()

  // publications
  const [manageOpen, setManageOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [publications, setPublications] = useState([])
  const [loadingPublications, setLoadingPublications] = useState(false)
  const [issues, setIssues] = useState([])
  const [deletingKey, setDeletingKey] = useState('')
  const [editorItem, setEditorItem] = useState(null)
  const [editorForm, setEditorForm] = useState({})
  const [uploadingEditorImage, setUploadingEditorImage] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actionItem, setActionItem] = useState(null)
  const [businessDeleteBlock, setBusinessDeleteBlock] = useState(null)
  const [openingBusinessPortal, setOpeningBusinessPortal] = useState(false)
  const [professionalOpen, setProfessionalOpen] = useState(false)
  const [expiredEventsOpen, setExpiredEventsOpen] = useState(false)
  const [expiredEventsDismissed, setExpiredEventsDismissed] = useState(false)
  const [adReminderOpen, setAdReminderOpen] = useState(false)
  const [adReminderDismissed, setAdReminderDismissed] = useState(false)
  const [adReviewConfirmations, setAdReviewConfirmations] = useState({})
  const [eventReviewConfirmations, setEventReviewConfirmations] = useState({})

  // avatar
  const avatarInputRef = useRef(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // alerts
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [alertSettings, setAlertSettings] = useState(loadAlertSettings)
  const [pushStatus, setPushStatus] = useState({ supported: false, permission: 'default', subscribed: false })
  const [savingPush, setSavingPush] = useState(false)
  const needsPushActivation = pushStatus.supported && !pushStatus.subscribed

  // config
  const [configOpen, setConfigOpen] = useState(false)
  const [configForm, setConfigForm] = useState({})
  const [savingConfig, setSavingConfig] = useState(false)
  const [showConfigNewPassword, setShowConfigNewPassword] = useState(false)
  const [showConfigConfirmPassword, setShowConfigConfirmPassword] = useState(false)

  // favorites
  const { favorites, toggleFavorite, isFavorite } = useFavorites()
  const [favOpen, setFavOpen] = useState(false)
  const [favItems, setFavItems] = useState([])
  const [loadingFavs, setLoadingFavs] = useState(false)

  // share
  const [shareOpen, setShareOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [uploadingPartnerLogo, setUploadingPartnerLogo] = useState(false)


  const loadPublications = async () => {
    if (!user?.id) return
    setLoadingPublications(true)
    try {
      const results = await Promise.allSettled([
        supabase.from('listings').select('*').eq('user_id', user.id).order('created_at', { ascending:false }),
        supabase.from('jobs').select('*').eq('user_id', user.id).order('created_at', { ascending:false }),
        supabase.from('events').select('*').eq('user_id', user.id).order('created_at', { ascending:false }),
        supabase.from('providers').select('*').eq('user_id', user.id).order('created_at', { ascending:false }),
        supabase.from('communities').select('*').eq('user_id', user.id).order('created_at', { ascending:false }),
      ])
      const nextIssues = []
      const nextPublications = []
      const mapping = [
        { kind:'ad', result:results[0], issue:'anuncios' },
        { kind:'job', result:results[1], issue:'empleos' },
        { kind:'event', result:results[2], issue:'eventos' },
        { kind:'business', result:results[3], issue:'negocios' },
        { kind:'community', result:results[4], issue:'grupos' },
      ]
      mapping.forEach(({ kind, result, issue }) => {
        if (result.status === 'rejected') {
          console.error(`Could not load ${issue}:`, result.reason)
          nextIssues.push(`No se pudieron cargar tus ${issue}.`)
          return
        }
        if (result.value.error) {
          console.error(`Could not load ${issue}:`, result.value.error)
          nextIssues.push(`No se pudieron cargar tus ${issue}. Inténtalo de nuevo más tarde.`)
          return
        }
        ;(result.value.data || []).forEach(row => nextPublications.push(normalizePublication(kind, row)))
      })
      nextPublications.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      setPublications(nextPublications)
      setIssues(nextIssues)
    } finally {
      setLoadingPublications(false)
    }
  }

  useEffect(() => {
    if (!isLoggedIn || !user?.id) return
    loadPublications()
  }, [isLoggedIn, user?.id])

  useEffect(() => {
    if (!user?.id) {
      setAdReviewConfirmations({})
      setEventReviewConfirmations({})
      return
    }

    try {
      setAdReviewConfirmations(JSON.parse(localStorage.getItem(`latido_ad_review_confirmations:${user.id}`) || '{}'))
    } catch {
      setAdReviewConfirmations({})
    }
    try {
      setEventReviewConfirmations(JSON.parse(localStorage.getItem(`latido_event_review_confirmations:${user.id}`) || '{}'))
    } catch {
      setEventReviewConfirmations({})
    }
  }, [user?.id])

  const loadFavorites = async () => {
    setLoadingFavs(true)
    const adIds = favorites.ads || []
    const jobIds = favorites.jobs || []
    const results = []
    if (adIds.length) {
      const { data } = await supabase.from('listings').select('*').in('id', adIds)
      const foundIds = new Set((data || []).map(a => a.id))
      if (data) results.push(...data.map(a => ({ ...a, _kind:'ad' })))
      for (const id of adIds) {
        if (!foundIds.has(id)) results.push({ id, _kind:'ad', _unavailable:true })
      }
    }
    if (jobIds.length) {
      const { data } = await supabase.from('jobs').select('*').in('id', jobIds)
      const foundIds = new Set((data || []).map(j => j.id))
      if (data) results.push(...data.map(j => ({ ...j, _kind:'job' })))
      for (const id of jobIds) {
        if (!foundIds.has(id)) results.push({ id, _kind:'job', _unavailable:true })
      }
    }
    setFavItems(results)
    setLoadingFavs(false)
  }

  const counts = useMemo(() => {
    const total = publications.length
    const active = publications.filter(item => item.active).length
    return { total, active, inactive: total - active }
  }, [publications])

  const filteredPublications = useMemo(() => {
    if (activeTab === 'all') return publications
    return publications.filter(item => item.kind === activeTab)
  }, [activeTab, publications])
  const businessPublications = useMemo(
    () => publications.filter(item => item.kind === 'business'),
    [publications]
  )
  const promotableBusinessPublications = useMemo(
    () => businessPublications.filter(item => !isBusinessPromotionActive(item.raw)),
    [businessPublications]
  )

  const activeFilter = PUBLICATION_TABS.find(item => item.id === activeTab)
  const testExpiredEventsPrompt = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('probarModalEventos') === '1'
  }, [location.search])
  const testAdReminderPrompt = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('probarModalAnuncios') === '1'
  }, [location.search])
  const suppressAttentionPrompts = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.has('atencion') || params.has('editar')
  }, [location.search])

  useEffect(() => {
    if (location.hash !== '#instalar-ios') return

    const scrollToInstallCard = () => {
      document.getElementById('instalar-ios')?.scrollIntoView({ behavior:'smooth', block:'start' })
    }

    const first = window.setTimeout(scrollToInstallCard, 80)
    const second = window.setTimeout(scrollToInstallCard, 350)

    return () => {
      window.clearTimeout(first)
      window.clearTimeout(second)
    }
  }, [location.hash])

  const realExpiredEvents = useMemo(
    () => publications.filter(item => isExpiredEventPublication(item, eventReviewConfirmations)),
    [eventReviewConfirmations, publications]
  )
  const expiredEvents = useMemo(() => {
    if (realExpiredEvents.length || !testExpiredEventsPrompt) return realExpiredEvents
    return [{
      id:'demo-expired-event',
      kind:'event',
      icon:'🎉',
      title:'Evento demo caducado',
      summary:'Vista de prueba',
      meta:'Zürich · fecha pasada',
      active:true,
      createdAt:new Date().toISOString(),
      raw:{
        day:'12',
        month:'MAY',
        year:String(new Date().getFullYear() - 1),
        time:'19:00',
        city:'Zürich',
        canton:'ZH',
      },
    }]
  }, [realExpiredEvents, testExpiredEventsPrompt])
  const expiredEventsSignature = useMemo(
    () => expiredEvents.map(item => item.id).sort().join('|'),
    [expiredEvents]
  )
  const eventAlertsEnabled = alertSettings.enabled && (alertSettings.categories || []).includes('eventos')
  const realAdReminderItems = useMemo(
    () => publications.filter(item => isAdDueForReview(item, adReviewConfirmations)),
    [adReviewConfirmations, publications]
  )
  const adReminderItems = useMemo(() => {
    if (realAdReminderItems.length || !testAdReminderPrompt) return realAdReminderItems
    return [{
      id:'demo-ad-reminder',
      kind:'ad',
      icon:'📌',
      title:'Anuncio demo para revisar',
      summary:'Servicios · CHF 30 / hora',
      meta:'ZH · Público',
      active:true,
      createdAt:new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      raw:{
        id:'demo-ad-reminder',
        title:'Anuncio demo para revisar',
        price:'CHF 30 / hora',
        canton:'ZH',
        privacy:'public',
        created_at:new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      },
    }]
  }, [realAdReminderItems, testAdReminderPrompt])
  const adReminderItem = adReminderItems[0]
  const adReminderSignature = useMemo(
    () => adReminderItems.map(item => item.id).sort().join('|'),
    [adReminderItems]
  )

  const rememberExpiredEventsDismissal = useCallback(() => {
    if (!testExpiredEventsPrompt && user?.id && expiredEventsSignature) {
      localStorage.setItem(`latido_attention_expired_events:${user.id}`, JSON.stringify({
        signature: expiredEventsSignature,
        dismissedAt: new Date().toISOString(),
      }))
    }
    setExpiredEventsDismissed(true)
  }, [expiredEventsSignature, testExpiredEventsPrompt, user?.id])

  const closeExpiredEventsPrompt = useCallback(() => {
    rememberExpiredEventsDismissal()
    setExpiredEventsOpen(false)
  }, [rememberExpiredEventsDismissal])

  const reviewExpiredEvents = () => {
    rememberExpiredEventsDismissal()
    setExpiredEventsOpen(false)
    setActiveTab('event')
    setManageOpen(true)
  }

  const activateEventAlerts = async () => {
    const categories = Array.from(new Set([...(alertSettings.categories || []), 'eventos']))
    const nextSettings = {
      ...alertSettings,
      enabled: true,
      messagesEnabled: true,
      categories,
      canton: alertSettings.canton || userCanton || '',
    }

    if (needsPushActivation) {
      await enablePush(nextSettings)
      return
    }

    await saveAlerts(nextSettings)
    toast.success('Alertas de eventos activadas')
  }

  const saveAdReviewConfirmations = useCallback((next) => {
    setAdReviewConfirmations(next)
    if (user?.id) {
      localStorage.setItem(`latido_ad_review_confirmations:${user.id}`, JSON.stringify(next))
    }
  }, [user?.id])

  const rememberAdReminderDismissal = useCallback(() => {
    if (!testAdReminderPrompt && user?.id && adReminderSignature) {
      localStorage.setItem(`latido_attention_ad_review:${user.id}`, JSON.stringify({
        signature: adReminderSignature,
        dismissedAt: new Date().toISOString(),
      }))
    }
    setAdReminderDismissed(true)
  }, [adReminderSignature, testAdReminderPrompt, user?.id])

  const closeAdReminderPrompt = useCallback(() => {
    rememberAdReminderDismissal()
    setAdReminderOpen(false)
  }, [rememberAdReminderDismissal])

  const confirmAdsStillActive = () => {
    const now = new Date().toISOString()
    const next = { ...adReviewConfirmations }
    adReminderItems.forEach(item => { next[item.id] = now })
    saveAdReviewConfirmations(next)
    setAdReminderDismissed(true)
    setAdReminderOpen(false)
    toast.success('Perfecto, te lo recordaremos en 30 días')
  }

  const reviewAdReminder = () => {
    rememberAdReminderDismissal()
    setAdReminderOpen(false)
    setActiveTab('ad')
    setManageOpen(true)
  }

  const editAdReminder = () => {
    if (!adReminderItem) return
    if (testAdReminderPrompt && adReminderItem.id === 'demo-ad-reminder') {
      toast.success('En un anuncio real se abriría el editor')
      return
    }
    rememberAdReminderDismissal()
    setAdReminderOpen(false)
    openEditor(adReminderItem)
  }

  const deleteAdReminder = () => {
    if (!adReminderItem) return
    if (testAdReminderPrompt && adReminderItem.id === 'demo-ad-reminder') {
      toast.success('En un anuncio real Latido pediría confirmación antes de borrar')
      return
    }
    rememberAdReminderDismissal()
    setAdReminderOpen(false)
    handleDeletePublication(adReminderItem)
  }

  useEffect(() => {
    if (!isLoggedIn || !user?.id || loadingPublications || expiredEventsDismissed || !expiredEvents.length) return
    if (!testExpiredEventsPrompt) return
    if (suppressAttentionPrompts) return
    if (manageOpen || editorItem || actionItem || alertsOpen || configOpen || favOpen || professionalOpen || shareOpen || adReminderOpen) return

    if (!testExpiredEventsPrompt) {
      const key = `latido_attention_expired_events:${user.id}`
      let stored = {}
      try {
        stored = JSON.parse(localStorage.getItem(key) || '{}')
      } catch {
        stored = {}
      }

      const dismissedAt = stored.dismissedAt ? new Date(stored.dismissedAt).getTime() : 0
      const snoozed = stored.signature === expiredEventsSignature && dismissedAt && Date.now() - dismissedAt < ATTENTION_SNOOZE_MS
      if (snoozed) return
    }

    const timer = setTimeout(() => setExpiredEventsOpen(true), 900)
    return () => clearTimeout(timer)
  }, [
    isLoggedIn,
    user?.id,
    loadingPublications,
    expiredEventsDismissed,
    expiredEvents.length,
    expiredEventsSignature,
    testExpiredEventsPrompt,
    suppressAttentionPrompts,
    manageOpen,
    editorItem,
    actionItem,
    alertsOpen,
    configOpen,
    favOpen,
    professionalOpen,
    shareOpen,
    adReminderOpen,
  ])

  useEffect(() => {
    if (!isLoggedIn || !user?.id || loadingPublications || adReminderDismissed || !adReminderItems.length) return
    if (!testAdReminderPrompt) return
    if (suppressAttentionPrompts) return
    if (manageOpen || editorItem || actionItem || alertsOpen || configOpen || favOpen || professionalOpen || shareOpen || expiredEventsOpen) return
    if (!testAdReminderPrompt && expiredEvents.length) return

    if (!testAdReminderPrompt) {
      const key = `latido_attention_ad_review:${user.id}`
      let stored = {}
      try {
        stored = JSON.parse(localStorage.getItem(key) || '{}')
      } catch {
        stored = {}
      }

      const dismissedAt = stored.dismissedAt ? new Date(stored.dismissedAt).getTime() : 0
      const snoozed = stored.signature === adReminderSignature && dismissedAt && Date.now() - dismissedAt < ATTENTION_SNOOZE_MS
      if (snoozed) return
    }

    const timer = setTimeout(() => setAdReminderOpen(true), 1100)
    return () => clearTimeout(timer)
  }, [
    isLoggedIn,
    user?.id,
    loadingPublications,
    adReminderDismissed,
    adReminderItems.length,
    adReminderSignature,
    testAdReminderPrompt,
    suppressAttentionPrompts,
    expiredEvents.length,
    expiredEventsOpen,
    manageOpen,
    editorItem,
    actionItem,
    alertsOpen,
    configOpen,
    favOpen,
    professionalOpen,
    shareOpen,
  ])

  const handleSignOut = async () => {
    await signOut()
    toast.success('Sesión cerrada')
    navigate('/')
  }

  const handleAvatarUpload = async e => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    setUploadingAvatar(true)
    try {
      const publicUrl = await uploadAvatar({ file, userId: user.id })
      const { error: profileErr } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)
      if (profileErr) {
        console.error('Avatar profile update failed:', profileErr)
        toast.error('No pudimos guardar tu foto de perfil. Inténtalo de nuevo más tarde.')
        return
      }
      invalidateAvatarCache(user.id)
      updateAvatar(publicUrl)
      toast.success('Foto actualizada')
    } catch (err) {
      toast.error(getStorageErrorMessage(err))
    } finally {
      setUploadingAvatar(false)
      e.target.value = ''
    }
  }

  const refreshPushStatus = useCallback(async () => {
    try {
      setPushStatus(await getPushStatus())
    } catch {
      setPushStatus({ supported: false, permission: 'unsupported', subscribed: false })
    }
  }, [])

  useEffect(() => {
    if (!alertsOpen) return
    refreshPushStatus()
  }, [alertsOpen, refreshPushStatus])

  useEffect(() => {
    if (!isLoggedIn) return
    refreshPushStatus()

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshPushStatus()
    }

    window.addEventListener(PUSH_STATUS_EVENT, refreshPushStatus)
    window.addEventListener('focus', refreshPushStatus)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener(PUSH_STATUS_EVENT, refreshPushStatus)
      window.removeEventListener('focus', refreshPushStatus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [isLoggedIn, refreshPushStatus])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('notificaciones') === '1') setAlertsOpen(true)
    if (PAID_BUSINESS_FEATURES_VISIBLE && params.get('seccion') === 'profesional') setProfessionalOpen(true)
    if (params.get('atencion') === 'eventos') {
      setActiveTab('event')
      setManageOpen(true)
    }
    if (params.get('atencion') === 'anuncios') {
      setActiveTab('ad')
      setManageOpen(true)
    }
  }, [location.search])

  const saveAlerts = async next => {
    const normalizedNext = {
      messagesEnabled: next.messagesEnabled !== false,
      ...next,
      categories: normalizeAlertCategories(next.categories),
      canton: next.canton ?? alertSettings.canton ?? userCanton ?? '',
    }

    const prevCats = [...(alertSettings.categories || [])].sort().join('|')
    const nextCats = [...(normalizedNext.categories || [])].sort().join('|')
    const filtersChanged = normalizedNext.canton !== (alertSettings.canton ?? userCanton ?? '') || nextCats !== prevCats

    // Anchor lastCheck whenever alerts are enabled or filters change, so only future publications notify.
    if (normalizedNext.enabled && (!alertSettings.enabled || filtersChanged || !localStorage.getItem('latido_alerts_last_check'))) {
      localStorage.setItem('latido_alerts_last_check', new Date().toISOString())
    }
    setAlertSettings(normalizedNext)
    localStorage.setItem('latido_alerts', JSON.stringify(normalizedNext))
    notifyZoneAlertsUpdated()

    if (user?.id && pushStatus.subscribed) {
      try {
        await syncPushPreferences({
          user,
          settings: normalizedNext,
          userCanton,
          messagesEnabled: normalizedNext.messagesEnabled !== false,
        })
      } catch (err) {
        console.warn('Could not sync push preferences:', err)
      }
    }
  }

  const enablePush = async (settings = alertSettings) => {
    if (!user?.id) {
      toast.error('Inicia sesión para activar las notificaciones')
      return
    }

    setSavingPush(true)
    try {
      const nextSettings = { ...settings, messagesEnabled: true }
      const status = await subscribeToPushNotifications({ user, settings: nextSettings, userCanton })
      setPushStatus(status)
      await saveAlerts(nextSettings)
      toast.success('Notificaciones activadas')
    } catch (err) {
      toast.error(err?.message || 'No se pudieron activar las notificaciones')
    } finally {
      setSavingPush(false)
    }
  }

  const disablePush = async () => {
    setSavingPush(true)
    try {
      const status = await unsubscribeFromPushNotifications({ user })
      setPushStatus(status)
      await saveAlerts({ ...alertSettings, messagesEnabled: false })
      toast.success('Notificaciones desactivadas')
    } catch (err) {
      toast.error(err?.message || 'No se pudieron desactivar')
    } finally {
      setSavingPush(false)
    }
  }

  const toggleZoneAlerts = async () => {
    const next = { ...alertSettings, enabled: !alertSettings.enabled, messagesEnabled: true }
    await saveAlerts(next)
  }

  const toggleAlertCat = cat => {
    const cats = alertSettings.categories || []
    const next = cats.includes(cat) ? cats.filter(c => c !== cat) : [...cats, cat]
    saveAlerts({ ...alertSettings, categories: next })
  }

  const SHARE_URL  = window.location.origin
  const SHARE_TEXT = '¡Únete a Latido! La app de los hispanohablantes en Suiza: anuncios, empleos, grupos y más. ❤️'

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title:'Latido', text: SHARE_TEXT, url: SHARE_URL })
      } catch {}
    } else {
      setShareOpen(true)
    }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(SHARE_URL).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const openConfig = () => {
    setConfigForm({ name: displayName, canton: userCanton, newPassword:'', confirmPassword:'' })
    setShowConfigNewPassword(false)
    setShowConfigConfirmPassword(false)
    setConfigOpen(true)
  }

  const handleSaveConfig = async () => {
    setSavingConfig(true)
    try {
      const meta = {}
      const newName = configForm.name?.trim()
      const nameChanged = newName && newName !== displayName
      if (nameChanged) meta.name = newName
      if (configForm.canton && configForm.canton !== userCanton) meta.canton = configForm.canton
      if (Object.keys(meta).length) {
        const { error } = await supabase.auth.updateUser({ data: meta })
        if (error) throw error
      }
      if (configForm.newPassword) {
        if (configForm.newPassword !== configForm.confirmPassword) {
          toast.error('Las contraseñas no coinciden')
          setSavingConfig(false)
          return
        }
        if (configForm.newPassword.length < 6) {
          toast.error('La contraseña debe tener al menos 6 caracteres')
          setSavingConfig(false)
          return
        }
        const { error } = await supabase.auth.updateUser({ password: configForm.newPassword })
        if (error) throw error
      }
      if (nameChanged) {
        await Promise.all([
          supabase.from('profiles').update({ name: newName }).eq('id', user.id),
          supabase.from('listings').update({ user_name: newName }).eq('user_id', user.id),
          supabase.from('conversations').update({ sender_name: newName }).eq('sender_id', user.id),
          supabase.from('conversations').update({ owner_name: newName }).eq('owner_id', user.id),
        ])
      }
      toast.success('Configuración guardada')
      setConfigOpen(false)
    } catch (err) {
      toast.error(err?.message || 'Error al guardar')
    } finally {
      setSavingConfig(false)
    }
  }

  const openEditor = item => { setEditorItem(item); setEditorForm(buildEditorForm(item)) }
  const closeEditor = () => { setEditorItem(null); setEditorForm({}); setSaving(false); setUploadingEditorImage(false); setUploadingPartnerLogo(false) }
  const updateEditorField = (key, value) => setEditorForm(prev => ({ ...prev, [key]: value }))
  const updateEditorAdType = value => setEditorForm(prev => {
    const compatibleCategories = getAdCategoriesForType(value)
    const currentCat = normalizeAdCat(prev.cat)
    const catStillFits = compatibleCategories.some(category => category.id === currentCat)
    const nextCat = catStillFits
      ? currentCat
      : compatibleCategories.length === 1
        ? compatibleCategories[0].id
        : ''
    const subStillFits = getAdSubOptions(nextCat, value)
      .some(option => getAdSubLabel(option) === prev.sub)

    return {
      ...prev,
      type:value,
      cat:nextCat,
      sub:subStillFits ? prev.sub : '',
    }
  })
  const updateEditorAdCategory = value => setEditorForm(prev => ({
    ...prev,
    cat:value,
    sub:'',
  }))
  const handleEditPublication = item => {
    if (!item) return
    setActionItem(null)
    openEditor(item)
  }
  const openProfessionalBusinessEditor = item => {
    if (!item) return
    setProfessionalOpen(false)
    window.setTimeout(() => openEditor(item), 0)
  }

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const editTarget = params.get('editar')
    if (!editTarget || loadingPublications || !publications.length) return

    const [kind, encodedId] = editTarget.split(':')
    const id = decodeURIComponent(encodedId || '')
    if (!kind || !id) return

    const item = publications.find(entry => entry.kind === kind && String(entry.id) === id)
    if (!item) return

    setManageOpen(false)
    setActionItem(null)
    openEditor(item)
  }, [loadingPublications, location.search, publications])

  const handleEditorImageUpload = async files => {
    if (!files?.length || !editorItem) return
    const isAd = editorItem.kind === 'ad'
    const imageConfig = EDITOR_IMAGE_CONFIG[editorItem.kind]
    if (!isAd && !imageConfig) return

    const allowsMultiple = isAd && supportsMultipleAdPhotos(editorForm.cat)
    setUploadingEditorImage(true)

    try {
      if (isAd) {
        if (allowsMultiple) {
          const currentUrls = uniqueUrls([editorForm.img_url, ...(editorForm.photo_urls || [])])
          const remainingSlots = MAX_PUBLICATION_IMAGES - currentUrls.length
          if (remainingSlots <= 0) {
            toast.error(`Puedes subir un máximo de ${MAX_PUBLICATION_IMAGES} imágenes por publicación.`)
            return
          }
          const selectedFiles = Array.from(files).slice(0, remainingSlots)
          const uploadedUrls = await uploadPublicationImages({
            files:selectedFiles,
            userId: user?.id,
            folder:'ads',
          })

          setEditorForm(prev => {
            const nextUrls = uniqueUrls([prev.img_url, ...(prev.photo_urls || []), ...uploadedUrls])
              .slice(0, MAX_PUBLICATION_IMAGES)
            return {
              ...prev,
              img_url: prev.img_url || nextUrls[0] || '',
              photo_urls: nextUrls,
            }
          })
          toast.success(
            files.length > selectedFiles.length
              ? `${uploadedUrls.length} foto(s) añadida(s). Máximo ${MAX_PUBLICATION_IMAGES} por publicación.`
              : `${uploadedUrls.length} foto(s) añadida(s)`
          )
        } else {
          const publicUrl = await uploadPublicationImage({
            file: files[0],
            userId: user?.id,
            folder:'ads',
          })
          setEditorForm(prev => ({ ...prev, img_url: publicUrl, photo_urls: [publicUrl] }))
          toast.success('Imagen actualizada')
        }
      } else {
        const publicUrl = await uploadPublicationImage({
          file: files[0],
          userId: user?.id,
          folder:imageConfig.folder,
        })
        setEditorForm(prev => ({ ...prev, [imageConfig.field]: publicUrl }))
        toast.success('Imagen actualizada')
      }
    } catch (error) {
      toast.error(getStorageErrorMessage(error))
    } finally {
      setUploadingEditorImage(false)
    }
  }

  const handlePartnerLogoUpload = async files => {
    if (!files?.length || editorItem?.kind !== 'business') return

    setUploadingPartnerLogo(true)

    try {
      const publicUrl = await uploadPublicationImage({
        file:files[0],
        userId:user?.id,
        folder:'business-partners',
      })
      setEditorForm(prev => ({ ...prev, partner_logo_url:publicUrl }))
      toast.success('Logo actualizado')
    } catch (error) {
      toast.error(getStorageErrorMessage(error))
    } finally {
      setUploadingPartnerLogo(false)
    }
  }

  const handleEditorImageReplace = async (index, files) => {
    if (!files?.length || !editorItem) return
    const isAd = editorItem.kind === 'ad'
    const imageConfig = EDITOR_IMAGE_CONFIG[editorItem.kind]
    if (!isAd && !imageConfig) return

    setUploadingEditorImage(true)

    try {
      const publicUrl = await uploadPublicationImage({
        file: files[0],
        userId: user?.id,
        folder:isAd ? 'ads' : imageConfig.folder,
      })

      if (isAd) {
        setEditorForm(prev => {
          const currentUrls = prev.photo_urls?.length ? prev.photo_urls : (prev.img_url ? [prev.img_url] : [])
          const oldUrl = currentUrls[index]
          const nextUrls = uniqueUrls(currentUrls.map((url, currentIndex) => currentIndex === index ? publicUrl : url))
          return {
            ...prev,
            img_url: prev.img_url === oldUrl || index === 0 ? publicUrl : prev.img_url,
            photo_urls: nextUrls,
          }
        })
      } else {
        setEditorForm(prev => ({ ...prev, [imageConfig.field]: publicUrl }))
      }
      toast.success('Imagen actualizada')
    } catch (error) {
      toast.error(getStorageErrorMessage(error))
    } finally {
      setUploadingEditorImage(false)
    }
  }

  const handleDeletePublication = async item => {
    const table = KIND_META[item.kind].table
    const deleteKey = `${item.kind}-${item.id}`
    setDeletingKey(deleteKey)

    try {
      if (item.kind === 'business') {
        const { data: syncResult, error: syncError } = await supabase.functions
          .invoke('create_business_promotion_portal', {
            body:{
              providerId:item.id,
              syncOnly:true,
            },
          })

        if (syncError) {
          console.warn('Could not refresh Stripe subscription before deletion:', syncError)
          throw new Error(
            'No se pudo comprobar la suscripción en Stripe. Inténtalo de nuevo.',
          )
        }

        const { data: deletionStatus, error: deletionStatusError } = await supabase
          .rpc('get_business_deletion_status', {
            p_provider_id:item.id,
          })

        const deletionStatusUnavailable =
          deletionStatusError?.code === 'PGRST202'
          || deletionStatusError?.message?.includes('get_business_deletion_status')

        if (deletionStatusError && !deletionStatusUnavailable) {
          throw deletionStatusError
        }

        const subscription = deletionStatus?.subscription
        const deletionBlocked = deletionStatus?.blocked
          || BLOCKING_BUSINESS_SUBSCRIPTION_STATUSES.has(subscription?.status)

        if (deletionBlocked) {
          setBusinessDeleteBlock({
            providerId:item.id,
            subscription,
          })
          return
        }

        if (syncResult?.blocked === true) {
          setBusinessDeleteBlock({
            providerId:item.id,
            subscription:null,
          })
          return
        }

        setBusinessDeleteBlock(null)
      }

      const confirmed = window.confirm(`¿Seguro que quieres borrar esta publicación?\n\n${item.title}`)
      if (!confirmed) return

      const { error } = await supabase.from(table).delete().eq('id', item.id).eq('user_id', user.id)
      if (isActiveBusinessSubscriptionError(error)) {
        setBusinessDeleteBlock({
          providerId:item.id,
          subscription:null,
        })
        return
      }
      if (error) throw error
      setPublications(prev => prev.filter(entry => !(entry.kind === item.kind && entry.id === item.id)))
      if (editorItem?.kind === item.kind && editorItem?.id === item.id) closeEditor()
      if (actionItem?.kind === item.kind && actionItem?.id === item.id) setActionItem(null)
      setBusinessDeleteBlock(null)
      toast.success(`${KIND_META[item.kind].label} eliminada`)
    } catch (error) {
      if (item.kind === 'business' && isActiveBusinessSubscriptionError(error)) {
        setBusinessDeleteBlock({
          providerId:item.id,
          subscription:null,
        })
        return
      }
      toast.error(error?.message || 'No se pudo eliminar la publicación')
    } finally {
      setDeletingKey('')
    }
  }

  const openBusinessSubscriptionPortal = async providerId => {
    setOpeningBusinessPortal(true)

    try {
      const { data, error } = await supabase.functions
        .invoke('create_business_promotion_portal', {
          body:{ providerId },
        })

      if (error || !data?.url) {
        throw new Error(data?.error || 'PORTAL_CREATE_FAILED')
      }

      window.location.assign(data.url)
    } catch (error) {
      console.error('Could not open Stripe portal:', error)
      toast.error('No se pudo abrir la gestión de la suscripción.')
    } finally {
      setOpeningBusinessPortal(false)
    }
  }

  const handleSavePublication = async () => {
    if (!editorItem) return
    const item = editorItem
    const table = KIND_META[item.kind].table
    let payload = {}

    if (item.kind === 'ad') {
      const normalizedCat = normalizeAdCat(editorForm.cat)
      const categoryIsCompatible = getAdCategoriesForType(editorForm.type)
        .some(category => category.id === normalizedCat)
      if (!categoryIsCompatible) {
        toast.error('Elige una categoría compatible con el tipo de anuncio')
        return
      }
      const compatibleSub = getAdSubOptions(normalizedCat, editorForm.type)
        .some(option => getAdSubLabel(option) === editorForm.sub)
      const allowsMultiplePhotos = supportsMultipleAdPhotos(editorForm.cat)
      const photoUrls = uniqueUrls([
        editorForm.img_url,
        ...(allowsMultiplePhotos ? (editorForm.photo_urls || []) : []),
      ]).slice(0, MAX_PUBLICATION_IMAGES)
      const priceValue = String(editorForm.priceValue || '').trim()
      const priceAmount = priceValue
        ? Number(priceValue.replace(',', '.'))
        : null
      const finalPrice = formatAdPrice(priceValue, editorForm.priceUnit)
      payload = {
        cat: normalizedCat || null, sub: compatibleSub ? editorForm.sub?.trim() || null : null,
        type: editorForm.type || null, title: editorForm.title?.trim(),
        desc: editorForm.desc?.trim() || null,
        price: finalPrice || null,
        price_amount: Number.isNaN(priceAmount) ? null : priceAmount,
        price_unit: priceValue ? editorForm.priceUnit || 'hora' : null,
        img_url: photoUrls[0] || null,
        photo_urls: allowsMultiplePhotos && photoUrls.length > 0 ? photoUrls : null,
        canton: editorForm.canton || null, plz: editorForm.plz?.trim() || null,
        privacy: editorForm.privacy || 'public',
        contact_phone: editorForm.contactPhone?.trim() || null,
        contact_email: editorForm.contactEmail?.trim() || null,
        updated_at: new Date().toISOString(),
      }
      if (!payload.title || !payload.type) { toast.error('Completa al menos el título y el tipo del anuncio'); return }
    }

    if (item.kind === 'job') {
      const languages = splitList(editorForm.langs || '')
      payload = {
        job_intent: editorForm.jobIntent || 'ofrece',
        sector: editorForm.sector?.trim() || null, category: editorForm.sector?.trim() || null,
        title: editorForm.title?.trim(), company: editorForm.company?.trim() || null,
        logo_url: editorForm.logo_url?.trim() || null,
        type: editorForm.type || null, city: editorForm.city?.trim() || null,
        canton: editorForm.canton || null, salary: editorForm.salary?.trim() || null,
        lang: languages.length ? languages.join(' · ') : null,
        languages: languages.length ? languages : null,
        desc: editorForm.desc?.trim() || null,
        contact_phone: editorForm.contactPhone?.trim() || null,
        contact_email: editorForm.contactEmail?.trim() || null,
        contact_link: editorForm.contactLink?.trim() || null,
        contact: editorForm.contactEmail?.trim() || editorForm.contactLink?.trim() || null,
        updated_at: new Date().toISOString(),
      }
      if (!payload.title || !payload.canton) { toast.error('Completa al menos el título y el cantón del empleo'); return }
    }

    if (item.kind === 'event') {
      const link = normalizeExternalUrl(editorForm.link)
      if (editorForm.link?.trim() && !link) {
        toast.error('Añade un link válido, por ejemplo instagram.com/usuario o @usuario')
        return
      }

      payload = {
        type: editorForm.type || null, title: editorForm.title?.trim(),
        day: editorForm.day?.trim() || null, month: editorForm.month?.trim() || null,
        year: editorForm.year?.trim() || null, time: editorForm.time?.trim() || null,
        price: editorForm.price?.trim() || null, city: editorForm.city?.trim() || null,
        canton: editorForm.canton || null, venue: editorForm.venue?.trim() || null,
        desc: editorForm.desc?.trim() || null, host: editorForm.host?.trim() || null,
        img_url: editorForm.img_url?.trim() || null,
        link: link || null, updated_at: new Date().toISOString(),
      }
      if (!payload.title || !payload.canton) { toast.error('Completa al menos el título y el cantón del evento'); return }
    }

    if (item.kind === 'business') {
      const services = splitList(editorForm.services || '').slice(0, 3)
      const partnerCtaUrl = normalizeExternalUrl(editorForm.partner_cta_url)
      if (editorForm.partner_cta_url?.trim() && !partnerCtaUrl) {
        toast.error('Añade un enlace válido para la tarjeta de colaborador')
        return
      }
      payload = {
        category: editorForm.category || null, name: editorForm.name?.trim(),
        city: editorForm.city?.trim() || null, canton: editorForm.canton || null,
        address: editorForm.address?.trim() || null,
        description: editorForm.description?.trim() || null,
        photo_url: editorForm.photo_url?.trim() || null,
        phone: editorForm.phone?.trim() || null,
        whatsapp: editorForm.hasWhatsapp && canUseWhatsappNumber(editorForm.phone) ? editorForm.phone.trim() : null,
        email: editorForm.email?.trim() || null,
        instagram: editorForm.instagram?.trim() || null, website: editorForm.website?.trim() || null,
        services: services.length ? services : null,
        partner_logo_url: editorForm.partner_logo_url?.trim() || null,
        partner_card_title: editorForm.partner_card_title?.trim() || null,
        partner_card_description: editorForm.partner_card_description?.trim() || null,
        partner_cta_label: editorForm.partner_cta_label?.trim() || null,
        partner_cta_url: partnerCtaUrl || null,
        partner_published: editorForm.partner_published !== false,
        updated_at: new Date().toISOString(),
      }
      if (!payload.name || !payload.canton) { toast.error('Completa al menos el nombre y el cantón del negocio'); return }
      if (![payload.phone, payload.email, payload.instagram].some(Boolean)) { toast.error('Añade al menos un método de contacto para el negocio'); return }
    }

    if (item.kind === 'community') {
      const category = COMMUNITY_OPTIONS.find(entry => entry.id === normalizeCommunityCategory(editorForm.cat))
      payload = {
        cat: editorForm.cat || null, name: editorForm.name?.trim(),
        city: editorForm.city?.trim() || null, desc: editorForm.desc?.trim() || null,
        contact: editorForm.contact?.trim() || null,
        photo_url: editorForm.photo_url?.trim() || null,
        emoji: category?.emoji || item.raw.emoji || '👥',
        updated_at: new Date().toISOString(),
      }
      if (!payload.name || !payload.contact) { toast.error('Completa al menos el nombre y el enlace del grupo'); return }
    }

    setSaving(true)
    try {
      const { error } = await supabase.from(table).update(payload).eq('id', item.id).eq('user_id', user.id)
      if (error) throw error
      await loadPublications()
      toast.success('Cambios guardados')
      closeEditor()
    } catch (error) {
      console.error('Save publication changes failed:', error)
      const message = String(error?.message || '')
      if (message.toLowerCase().includes('website')) {
        toast.error('No pudimos guardar los cambios ahora. Inténtalo de nuevo más tarde.')
      } else {
        toast.error(message || 'No se pudieron guardar los cambios')
      }
      setSaving(false)
    }
  }

  const menuSections = [
    {
      title: 'Mi actividad',
      items: [
        { icon:'📌', color:'#F1F5F9', label:'Mis publicaciones', sub:'Editar o borrar lo que ya has publicado', action:() => { setManageOpen(true); loadPublications() } },
        { icon:'❤️', color:'#F1F5F9', label:'Favoritos', sub:`${(favorites.ads?.length||0)+(favorites.jobs?.length||0)} guardados · toca el corazón en los anuncios`, action:() => { setFavOpen(true); loadFavorites() } },
      ],
    },
    ...(PAID_BUSINESS_FEATURES_VISIBLE ? [{
      title: 'Profesional',
      items: [
        { icon:'✨', color:'#F1F5F9', label:'Ventajas para tu negocio', sub: promotableBusinessPublications.length ? `${promotableBusinessPublications.length} ${promotableBusinessPublications.length === 1 ? 'negocio listo' : 'negocios listos'} para activar un plan` : businessPublications.length ? 'Tus negocios ya tienen un plan activo' : 'Publica un negocio para desbloquear esta ventaja', action:() => setProfessionalOpen(true) },
      ],
    }] : []),
    ...(isAdmin ? [{
      title: 'Administrador',
      items: [
        { icon:'🛡️', color:'#FEF2F2', label:'Administrar', sub:'Reportes, usuarios, moderacion y contenido pendiente', action:() => navigate('/admin-latido') },
      ],
    }] : []),
    {
      title: 'Descubrir',
      items: [
        { icon:'📚', color:'#F1F5F9', label:'Guías', sub:'Trámites y recursos útiles para vivir en Suiza', action:() => navigate('/guias') },
        {
          icon:'🔔',
          color:'#F1F5F9',
          label:'Notificaciones',
          sub: needsPushActivation
            ? 'Actívalas para recibir mensajes, nuevos anuncios y alertas de tu zona'
            : 'Mensajes, anuncios y alertas de zona',
          attention: needsPushActivation,
          action:() => setAlertsOpen(true),
        },
      ],
    },
    {
      title: 'Ajustes',
      items: [
        { icon:'⚙️', color:'#F1F5F9', label:'Configuración', sub:'Nombre, cantón, idiomas, contraseña', action:openConfig },
        { icon:'🔗', color:'#F1F5F9', label:'Compartir Latido', sub:'Invita a amigos y familiares a unirse', action:handleShare },
        { icon:'✉️', color:'#F1F5F9', label:'Contactar con Latido', sub:'Preguntas, sugerencias o feedback', action:() => window.location.href = `mailto:info@latido.ch?subject=${encodeURIComponent('Mensaje desde Latido')}` },
      ],
    },
  ]
  const menu = menuSections.flatMap(s => s.items)

  if (!isLoggedIn) return (
    <div style={{ maxWidth:440, margin:'80px auto', padding:'0 24px', textAlign:'center' }}>
      <div style={{ fontSize:52, marginBottom:16 }}>👤</div>
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:C.text, marginBottom:10 }}>Tu perfil</h1>
      <p style={{ fontFamily:PP, fontSize:13, color:C.mid, marginBottom:24, lineHeight:1.7 }}>
        Inicia sesión para gestionar tus anuncios, mensajes y configuración.
      </p>
      <Btn onClick={() => navigate('/auth')}>Iniciar sesión</Btn>
      <button onClick={() => navigate('/auth')} style={{ fontFamily:PP, fontWeight:600, fontSize:13, color:C.primary, background:'none', border:`1.5px solid ${C.primaryMid}`, borderRadius:14, padding:'12px 0', width:'100%', cursor:'pointer', marginTop:10 }}>
        Crear cuenta gratis
      </button>
    </div>
  )

  return (
    <div style={{ maxWidth:600, margin:'0 auto', padding:'32px 24px 100px' }}>

      {/* Avatar + header card */}
      <div style={{ background:'linear-gradient(135deg,#1D4ED8,#2563EB)', borderRadius:24, padding:'28px 20px 24px', marginBottom:20, position:'relative', overflow:'hidden', textAlign:'center' }}>
        <div style={{ position:'absolute', top:-30, right:-30, width:120, height:120, borderRadius:'50%', background:'rgba(255,255,255,0.06)' }}/>
        <div style={{ position:'absolute', bottom:-20, left:-20, width:80, height:80, borderRadius:'50%', background:'rgba(255,255,255,0.04)' }}/>

        {/* Avatar with camera overlay */}
        <div
          style={{ position:'relative', display:'inline-block', marginBottom:12, cursor:'pointer' }}
          onClick={() => !uploadingAvatar && avatarInputRef.current?.click()}
        >
          <Avatar name={displayName} size={80} src={avatarUrl} />
          <div style={{ position:'absolute', bottom:0, right:0, width:26, height:26, borderRadius:'50%', background:'#fff', border:'2px solid #2563EB', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13 }}>
            {uploadingAvatar ? '⏳' : '📷'}
          </div>
          <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display:'none' }} />
        </div>

        {/* Name & info */}
        <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:'#fff', margin:'0 0 4px', letterSpacing:-0.3 }}>{displayName}</h1>
        <p style={{ fontFamily:PP, fontSize:12, color:'rgba(255,255,255,0.65)', margin:'0 0 8px' }}>{user?.email}</p>
        {userCanton && (
          <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:'rgba(255,255,255,0.15)', borderRadius:20, padding:'4px 12px', fontFamily:PP, fontSize:11, fontWeight:600, color:'#fff' }}>
            📍 Cantón {userCanton}
          </span>
        )}

        {/* Stats */}
        <div style={{ display:'flex', justifyContent:'center', gap:0, marginTop:20, borderTop:'1px solid rgba(255,255,255,0.15)', paddingTop:16 }}>
          {[
            { icon:'📌', value: counts.total, label:'Publicaciones' },
            { icon: alertSettings.enabled ? '🔔' : '🔕', value: alertSettings.enabled ? '✅' : '❌', label:'Alertas', isText: true },
            { icon:'❤️', value: (favorites.ads?.length||0)+(favorites.jobs?.length||0), label:'Favoritos' },
          ].map(({ icon, value, label, isText }, i, arr) => (
            <div key={label} style={{ flex:1, textAlign:'center', borderRight: i < arr.length-1 ? '1px solid rgba(255,255,255,0.12)' : 'none' }}>
              <p style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:'#fff', margin:'0 0 2px', letterSpacing:-0.5 }}>{value}</p>
              <p style={{ fontFamily:PP, fontSize:10, color:'rgba(255,255,255,0.6)', margin:0 }}>{icon} {label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Twint promo banner */}
      {/* <div style={{ background:'linear-gradient(135deg,#f0fdf4,#dcfce7)', border:'1.5px solid #86efac', borderRadius:16, padding:'14px 16px', marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
        <div>
          <p style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:'#15803d', marginBottom:3 }}>💚 Apoya a Latido</p>
          <p style={{ fontFamily:PP, fontSize:11, color:'#166534', margin:0, lineHeight:1.5 }}>
            Publica tu anuncio, da a conocer tu negocio o apoya a tu comunidad.<br/>
            ¿No encuentras lo que buscas? ¡Publícalo y deja que la comunidad te ayude!
          </p>
        </div>
        <a
          href="twint://send?phone=%2B41786543234"
          style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:'#fff', background:'#16a34a', padding:'7px 12px', borderRadius:10, textDecoration:'none', flexShrink:0, textAlign:'center', lineHeight:1.4 }}
        >
          Pagar<br/>Twint
        </a>
      </div>
 */}
      {menuSections.map(section => (
        <div key={section.title} style={{ marginBottom:20 }}>
          <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1.2, marginBottom:8, paddingLeft:4 }}>{section.title.toUpperCase()}</p>
          <div style={{ background:'#fff', borderRadius:18, border:`1px solid ${C.border}`, overflow:'hidden' }}>
            {section.items.map((item, i) => {
              const content = (
                <div style={{ padding:'14px 16px', display:'flex', gap:14, alignItems:'center', cursor:item.disabled ? 'not-allowed' : 'pointer', borderBottom: i < section.items.length - 1 ? `1px solid ${C.border}` : 'none', opacity:item.disabled ? 0.6 : 1 }}>
                  <div style={{ width:40, height:40, background:item.color || C.bg, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontSize:19, flexShrink:0, position:'relative' }}>
                    {item.icon}
                    {item.attention && <span style={{ position:'absolute', top:5, right:5, width:9, height:9, borderRadius:5, background:'#EF4444', border:'1.5px solid #fff' }} />}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontFamily:PP, fontWeight:600, fontSize:13, color:C.text, marginBottom:1, display:'flex', alignItems:'center', gap:6 }}>
                      {item.label}
                      {item.attention && <span style={{ width:7, height:7, borderRadius:4, background:'#EF4444', flexShrink:0 }} />}
                    </p>
                    <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>{item.sub}</p>
                  </div>
                  <span style={{ color:C.light, fontSize:18, fontWeight:300 }}>{item.disabled ? '🔒' : '›'}</span>
                </div>
              )
              if (item.disabled) return <div key={item.label}>{content}</div>
              return (
                <button key={item.label} onClick={item.action} style={{ width:'100%', background:'none', border:'none', padding:0, textAlign:'left', display:'block' }}>
                  {content}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {/* Install app card */}
      {!isPWA && (
        <div id="instalar-ios" style={{ scrollMarginTop:96, background:`linear-gradient(135deg,${C.primaryDark},${C.primary})`, borderRadius:16, padding:'16px 18px', marginTop:8, marginBottom:8, boxShadow:'0 8px 24px rgba(37,99,235,0.3)' }}>
          <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
            <div style={{ fontSize:28, flexShrink:0 }}>📲</div>
            <div style={{ flex:1 }}>
              <p style={{ fontFamily:PP, fontWeight:700, fontSize:14, color:'#fff', margin:'0 0 10px', letterSpacing:-0.3 }}>Instalar Latido</p>
              {/iPad|iPhone|iPod/.test(navigator.userAgent) ? (
                <>
                  <div style={{ background:'rgba(255,255,255,0.15)', borderRadius:10, padding:'8px 12px' }}>
                    {[
                      '1. Pulsa ••• en el navegador',
                      '2. Toca "Compartir" 📤 ',
                      '3. Selecciona "Añadir a pantalla de inicio"',
                    ].map(s => (
                      <p key={s} style={{ fontFamily:PP, fontSize:11, color:'rgba(255,255,255,0.65)', margin:'2px 0', lineHeight:1.4 }}>{s}</p>
                    ))}
                  </div>
                  <video
                    src="/videos/install-ios.mp4"
                    controls
                    playsInline
                    preload="metadata"
                    aria-label="Video para instalar Latido en iPhone"
                    style={{ width:'100%', maxHeight:360, objectFit:'contain', background:'#0F172A', borderRadius:12, marginTop:10, display:'block', border:'1px solid rgba(255,255,255,0.2)' }}
                  />
                </>
              ) : (
                <>
                  <button onClick={promptInstall} disabled={!canInstall} style={{ fontFamily:PP, fontWeight:700, fontSize:13, background:C.primary, color:'#fff', border:'none', borderRadius:12, padding:'11px 0', cursor: canInstall ? 'pointer' : 'default', opacity: canInstall ? 1 : 0.5, width:'100%', display:'block' }}>
                    Instalar app
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <button onClick={handleSignOut} style={{ fontFamily:PP, fontWeight:600, fontSize:13, color:'#EF4444', background:'#FEF2F2', border:'none', borderRadius:14, padding:'13px 0', width:'100%', cursor:'pointer', marginTop:8 }}>
        Cerrar sesión
      </button>

      {/* ── Favoritos ── */}
      <Sheet show={favOpen} onClose={() => setFavOpen(false)} title="❤️ Favoritos">
        {loadingFavs ? (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[1,2].map(i => <div key={i} className="skeleton" style={{ height:80, borderRadius:14 }} />)}
          </div>
        ) : favItems.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 20px' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🤍</div>
            <p style={{ fontFamily:PP, fontWeight:700, fontSize:15, color:C.text, marginBottom:6 }}>Sin favoritos todavía</p>
            <p style={{ fontFamily:PP, fontSize:12, color:C.light, lineHeight:1.6 }}>
              Toca el corazón 🤍 en cualquier anuncio o empleo para guardarlo aquí.
            </p>
          </div>
        ) : (
          favItems.map(item => {
            const isJob = item._kind === 'job'
            const jobIntent = isJob ? getJobIntentMeta(item) : null
            const favType = isJob ? 'jobs' : 'ads'
            const href = isJob ? `/tablon?cat=empleo&openJob=${item.id}` : `/tablon?openAd=${item.id}`

            if (item._unavailable) return (
              <div key={item.id} style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:14, padding:'13px 15px', marginBottom:10, display:'flex', gap:12, alignItems:'center' }}>
                <div style={{ width:44, height:44, borderRadius:12, background:'#F1F5F9', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>🗑️</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontFamily:PP, fontWeight:600, fontSize:13, color:'#B91C1C', margin:'0 0 2px' }}>Anuncio no disponible</p>
                  <p style={{ fontFamily:PP, fontSize:11, color:'#EF4444', margin:0 }}>Este anuncio fue eliminado o ya no está activo</p>
                </div>
                <button
                  onClick={() => { toggleFavorite(favType, item.id); setFavItems(prev => prev.filter(x => x.id !== item.id)) }}
                  style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, padding:'4px', flexShrink:0, color:'#EF4444' }}
                  aria-label="Eliminar de favoritos"
                >✕</button>
              </div>
            )

            return (
              <div key={item.id} style={{ background:'#fff', border:`1px solid ${C.border}`, borderRadius:14, padding:'13px 15px', marginBottom:10, display:'flex', gap:12, alignItems:'center' }}>
                <button
                  onClick={() => navigate(href)}
                  style={{ display:'flex', gap:12, alignItems:'center', flex:1, minWidth:0, background:'none', border:'none', cursor:'pointer', padding:0, textAlign:'left' }}
                >
                  <div style={{ width:44, height:44, borderRadius:12, background:C.primaryLight, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
                    {isJob ? (item.emoji || '💼') : getAdDisplayEmoji(item)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:C.text, margin:'0 0 2px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.title || item.company}</p>
                    <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>
                      {isJob ? `${jobIntent.emoji} ${jobIntent.label} · ${item.company || item.city || item.canton || ''}` : `📍 ${formatAdLocation(item)}`}
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => { toggleFavorite(favType, item.id); setFavItems(prev => prev.filter(x => x.id !== item.id)) }}
                  style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, padding:'4px', flexShrink:0 }}
                  aria-label="Quitar de favoritos"
                >
                  ❤️
                </button>
              </div>
            )
          })
        )}
      </Sheet>

      {/* ── Notifications ── */}
      <Sheet show={professionalOpen} onClose={() => setProfessionalOpen(false)} title="✨ Profesional" syncHistory={false}>
        <div style={{ background:`linear-gradient(135deg,${C.primaryDark},${C.primary})`, borderRadius:18, padding:'18px 16px', marginBottom:14, color:'#fff', overflow:'hidden', position:'relative' }}>
          <div style={{ position:'absolute', top:-32, right:-24, width:110, height:110, borderRadius:'50%', background:'rgba(255,255,255,0.08)' }} />
          <p style={{ fontFamily:PP, fontWeight:900, fontSize:18, margin:'0 0 6px', position:'relative' }}>
            Ventajas profesionales
          </p>
          <p style={{ fontFamily:PP, fontSize:12, lineHeight:1.65, margin:0, color:'rgba(255,255,255,0.78)', position:'relative' }}>
            Herramientas para que tu negocio tenga mas visibilidad y puedas gestionarlo desde Latido.
          </p>
        </div>

        <div style={{ display:'grid', gap:8, marginBottom:16 }}>
          {[
            'Prioridad en la rotacion de negocios de Inicio',
            'Acceso rapido para destacar tu negocio',
            'Mas visibilidad para clientes de la comunidad',
          ].map(text => (
            <div key={text} style={{ display:'flex', gap:9, alignItems:'flex-start', background:C.primaryLight, border:`1px solid ${C.primaryMid}`, borderRadius:13, padding:'10px 12px' }}>
              <span style={{ width:22, height:22, borderRadius:11, background:'#fff', color:C.primary, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:PP, fontWeight:900, fontSize:13, flexShrink:0 }}>+</span>
              <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.primaryDark, margin:0, lineHeight:1.45 }}>{text}</p>
            </div>
          ))}
        </div>

        <p style={{ fontFamily:PP, fontWeight:800, fontSize:13, color:C.text, margin:'0 0 10px' }}>
          Tus negocios
        </p>

        {loadingPublications ? (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[1,2].map(index => <div key={index} className="skeleton" style={{ height:74, borderRadius:14 }} />)}
          </div>
        ) : businessPublications.length === 0 ? (
          <EmptyState
            emoji="🏪"
            title="Publica un negocio"
            sub="Cuando publiques tu primer negocio, este apartado profesional se activara con sus ventajas."
            action="Registrar negocio"
            onAction={() => {
              setProfessionalOpen(false)
              navigate('/registrar-negocio')
            }}
          />
        ) : (
          <div style={{ display:'grid', gap:10 }}>
            {businessPublications.map(item => {
              const hasActivePlan = isBusinessPromotionActive(item.raw)
              const activePlan = getBusinessPromotionMeta(item.raw?.promotion_plan)
              return (
                <div key={item.id} style={{ background:'#fff', border:`1px solid ${C.border}`, borderRadius:15, padding:'12px', display:'flex', gap:11, alignItems:'center' }}>
                  <div style={{ width:42, height:42, borderRadius:13, background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                    {item.icon}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontFamily:PP, fontWeight:800, fontSize:13, color:C.text, margin:'0 0 2px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {item.title || 'Negocio'}
                    </p>
                    <p style={{ fontFamily:PP, fontSize:10, color:C.light, margin:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {hasActivePlan ? `Plan activo: ${activePlan.shortLabel}` : item.summary || 'Listo para elegir un plan'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setProfessionalOpen(false)
                      if (hasActivePlan) {
                        openProfessionalBusinessEditor(item)
                        return
                      }
                      navigate(`/negocios/${item.id}/destacar`)
                    }}
                    style={{
                      fontFamily:PP,
                      fontWeight:900,
                      fontSize:11,
                      color:'#fff',
                      background:C.primary,
                      border:'none',
                      borderRadius:999,
                      padding:'10px 15px',
                      cursor:'pointer',
                      flexShrink:0,
                    }}
                  >
                    {hasActivePlan ? 'Editar' : 'Elegir'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Sheet>

      <Sheet show={alertsOpen} onClose={() => setAlertsOpen(false)} title="🔔 Notificaciones">
        <p style={{ fontFamily:PP, fontSize:12, color:C.mid, marginBottom:16, lineHeight:1.6 }}>
          Recibe una alerta cuando te escriban o cuando aparezca un anuncio de tu interés en la zona que elijas.
        </p>

        {needsPushActivation && (
          <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:14, padding:'11px 13px', marginBottom:14, display:'flex', gap:10, alignItems:'flex-start' }}>
            <span style={{ width:9, height:9, borderRadius:5, background:'#EF4444', marginTop:5, flexShrink:0 }} />
            <p style={{ fontFamily:PP, fontSize:11, color:'#991B1B', margin:0, lineHeight:1.5 }}>
              Activa las notificaciones para recibir alertas de mensajes, nuevos anuncios, empleos y eventos.
            </p>
          </div>
        )}

        <div style={{ background:C.bg, border:`1px solid ${needsPushActivation ? '#FCA5A5' : C.border}`, borderRadius:14, padding:'12px 14px', marginBottom:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
            <div style={{ minWidth:0 }}>
              <p style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:C.text, margin:'0 0 2px', display:'flex', alignItems:'center', gap:6 }}>
                Mensajes y avisos
                {needsPushActivation && <span style={{ width:7, height:7, borderRadius:4, background:'#EF4444', flexShrink:0 }} />}
              </p>
              <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>
                {pushStatus.subscribed ? 'Activas en este dispositivo.' : 'Actívalas para recibir mensajes, nuevos anuncios, empleos y eventos.'}
              </p>
            </div>
            <button
              onClick={() => pushStatus.subscribed ? disablePush() : enablePush()}
              disabled={savingPush}
              style={{ fontFamily:PP, fontWeight:700, fontSize:11, border:'none', borderRadius:12, padding:'9px 12px', cursor:savingPush ? 'default' : 'pointer', background: pushStatus.subscribed ? '#E5E7EB' : C.primary, color: pushStatus.subscribed ? C.mid : '#fff', flexShrink:0 }}
            >
              {savingPush ? '...' : pushStatus.subscribed ? 'Desactivar' : 'Activar'}
            </button>
          </div>
          {!pushStatus.supported && (
            <p style={{ fontFamily:PP, fontSize:11, color:'#B45309', margin:'10px 0 0', lineHeight:1.5 }}>
              Este navegador solo permite notificaciones en HTTPS o localhost compatible.
            </p>
          )}
          {pushStatus.permission === 'denied' && (
            <p style={{ fontFamily:PP, fontSize:11, color:'#B45309', margin:'10px 0 0', lineHeight:1.5 }}>
              El navegador tiene las notificaciones bloqueadas. Actívalas en los ajustes del sitio y vuelve a intentarlo.
            </p>
          )}
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:C.bg, border:`1px solid ${C.border}`, borderRadius:14, padding:'12px 14px', marginBottom:14 }}>
          <div>
            <p style={{ fontFamily:PP, fontWeight:600, fontSize:13, color:C.text, margin:'0 0 2px' }}>Alertas de zona</p>
            <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>Actívalo para recibir avisos de anuncios de tu interés en tu zona.</p>
          </div>
          <button
            onClick={toggleZoneAlerts}
            style={{ width:44, height:24, borderRadius:12, border:'none', cursor:'pointer', background: alertSettings.enabled ? C.primary : '#D1D5DB', transition:'background .2s', position:'relative', flexShrink:0 }}
            aria-label="Toggle alertas"
          >
            <span style={{ position:'absolute', top:2, left: alertSettings.enabled ? 22 : 2, width:20, height:20, borderRadius:'50%', background:'#fff', transition:'left .2s', boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }} />
          </button>
        </div>

        {alertSettings.enabled && (
          <>
            <Select
              label="Cantón de alertas"
              value={alertSettings.canton || userCanton || ''}
              onChange={e => saveAlerts({ ...alertSettings, canton: e.target.value })}
            >
              <option value="">Todos los cantones</option>
              {CANTONS.map(item => <option key={item.code} value={item.code}>{item.code} — {item.name}</option>)}
            </Select>

            <p style={{ fontFamily:PP, fontWeight:600, fontSize:12, color:C.text, margin:'14px 0 8px' }}>Categorías</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16 }}>
              {ALERT_CATS.map(cat => {
                const active = (alertSettings.categories || []).includes(cat.id)
                return (
                  <button
                    key={cat.id}
                    onClick={() => toggleAlertCat(cat.id)}
                    style={{ fontFamily:PP, fontSize:11, fontWeight:600, padding:'6px 12px', borderRadius:20, border:`1.5px solid ${active ? C.primary : C.border}`, background: active ? C.primaryLight : '#fff', color: active ? C.primaryDark : C.mid, cursor:'pointer', transition:'all .15s' }}
                  >
                    {cat.emoji} {cat.label}
                  </button>
                )
              })}
            </div>

          </>
        )}

        <Btn onClick={() => { toast.success('Alertas guardadas'); setAlertsOpen(false) }} style={{ marginTop:8 }}>
          Guardar
        </Btn>
      </Sheet>

      <Modal show={expiredEventsOpen} onClose={closeExpiredEventsPrompt} title="🎉 Eventos con fecha pasada" syncHistory={false}>
        <div style={{ background:C.warnLight, border:`1px solid ${C.warnMid}`, borderRadius:18, padding:'15px 16px', marginBottom:14 }}>
          <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
            <div style={{ width:42, height:42, borderRadius:14, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
              🎉
            </div>
            <div style={{ minWidth:0 }}>
              <p style={{ fontFamily:PP, fontWeight:800, fontSize:15, color:C.text, margin:'0 0 4px' }}>
                Hay {expiredEvents.length} {expiredEvents.length === 1 ? 'evento activo que ya pasó' : 'eventos activos que ya pasaron'}
              </p>
              <p style={{ fontFamily:PP, fontSize:12, color:'#92400E', margin:0, lineHeight:1.55 }}>
                Revísalos para ocultarlos, actualizarlos o volver a publicarlos. Así la comunidad ve contenido fresco sin que tengas que estar pendiente todo el tiempo.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:14 }}>
          {expiredEvents.slice(0, 3).map(item => (
            <div key={`expired-${item.id}`} style={{ display:'flex', gap:10, alignItems:'center', background:C.bg, border:`1px solid ${C.border}`, borderRadius:14, padding:'10px 12px' }}>
              <span style={{ width:34, height:34, borderRadius:12, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                {item.icon}
              </span>
              <div style={{ minWidth:0, flex:1 }}>
                <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.text, margin:'0 0 2px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {item.title}
                </p>
                <p style={{ fontFamily:PP, fontSize:10, color:C.light, margin:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {[formatEventSchedule(item.raw), item.raw?.city || item.raw?.canton].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
          ))}
          {expiredEvents.length > 3 && (
            <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:'0 2px' }}>
              +{expiredEvents.length - 3} más para revisar
            </p>
          )}
        </div>

        {!eventAlertsEnabled && (
          <div style={{ background:C.primaryLight, border:`1px solid ${C.primaryMid}`, borderRadius:16, padding:'12px 13px', marginBottom:16, display:'flex', gap:10, alignItems:'flex-start' }}>
            <span style={{ fontSize:20, lineHeight:1 }}>🔔</span>
            <p style={{ fontFamily:PP, fontSize:11, color:C.primaryDark, margin:0, lineHeight:1.55 }}>
              {needsPushActivation
                ? 'Activa notificaciones para recibir avisos útiles de Latido, incluidos eventos nuevos cerca de ti.'
                : 'Puedes activar alertas de eventos para que Latido te avise cuando haya novedades en tu zona.'}
            </p>
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <Btn onClick={reviewExpiredEvents}>Revisar eventos</Btn>
          {!eventAlertsEnabled && (
            <button
              onClick={activateEventAlerts}
              disabled={savingPush}
              style={{ width:'100%', fontFamily:PP, fontWeight:700, fontSize:12, color:C.primaryDark, background:C.primaryLight, border:`1.5px solid ${C.primaryMid}`, borderRadius:14, padding:'12px 16px', cursor:savingPush ? 'default' : 'pointer' }}
            >
              {savingPush ? 'Activando...' : needsPushActivation ? 'Activar notificaciones' : 'Activar alertas de eventos'}
            </button>
          )}
          <button
            onClick={closeExpiredEventsPrompt}
            style={{ width:'100%', fontFamily:PP, fontWeight:700, fontSize:12, color:C.mid, background:'#fff', border:`1.5px solid ${C.border}`, borderRadius:14, padding:'12px 16px', cursor:'pointer' }}
          >
            Lo reviso luego
          </button>
        </div>
      </Modal>

      <Modal show={adReminderOpen} onClose={closeAdReminderPrompt} title="📌 Revisar anuncio activo" syncHistory={false}>
        {adReminderItem && (
          <>
            <div style={{ background:C.primaryLight, border:`1px solid ${C.primaryMid}`, borderRadius:18, padding:'15px 16px', marginBottom:14 }}>
              <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                <div style={{ width:42, height:42, borderRadius:14, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
                  📌
                </div>
                <div style={{ minWidth:0 }}>
                  <p style={{ fontFamily:PP, fontWeight:800, fontSize:15, color:C.text, margin:'0 0 4px' }}>
                    ¿Este anuncio sigue activo?
                  </p>
                  <p style={{ fontFamily:PP, fontSize:12, color:C.primaryDark, margin:0, lineHeight:1.55 }}>
                    Se publicó {formatTimeSince(adReminderItem.createdAt)}. Confírmalo, edítalo o elimínalo para que Latido muestre información actual.
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display:'flex', gap:10, alignItems:'center', background:C.bg, border:`1px solid ${C.border}`, borderRadius:14, padding:'11px 12px', marginBottom:12 }}>
              {adReminderItem.raw?.img_url ? (
                <div style={{ width:42, height:42, borderRadius:12, overflow:'hidden', flexShrink:0, background:'#fff' }}>
                  <img src={getThumbnailImageUrl(adReminderItem.raw.img_url)} alt={adReminderItem.title} loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                </div>
              ) : (
                <span style={{ width:42, height:42, borderRadius:12, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                  {adReminderItem.icon}
                </span>
              )}
              <div style={{ minWidth:0, flex:1 }}>
                <p style={{ fontFamily:PP, fontWeight:800, fontSize:13, color:C.text, margin:'0 0 3px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {adReminderItem.title}
                </p>
                <p style={{ fontFamily:PP, fontSize:11, color:C.mid, margin:'0 0 2px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {adReminderItem.summary || 'Anuncio activo'}
                </p>
                <p style={{ fontFamily:PP, fontSize:10, color:C.light, margin:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {adReminderItem.meta || 'Publicado en Latido'}
                </p>
              </div>
            </div>

            {adReminderItems.length > 1 && (
              <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:'0 2px 14px', lineHeight:1.5 }}>
                Hay {adReminderItems.length - 1} {adReminderItems.length === 2 ? 'anuncio más' : 'anuncios más'} para revisar. Si confirmas, todos quedarán revisados por 30 días.
              </p>
            )}

            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <Btn onClick={confirmAdsStillActive}>
                {adReminderItems.length > 1 ? 'Sí, siguen activos' : 'Sí, sigue activo'}
              </Btn>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <button
                  onClick={editAdReminder}
                  style={{ width:'100%', fontFamily:PP, fontWeight:700, fontSize:12, color:C.primaryDark, background:C.primaryLight, border:`1.5px solid ${C.primaryMid}`, borderRadius:14, padding:'12px 10px', cursor:'pointer' }}
                >
                  ✏️ Editar
                </button>
                <button
                  onClick={deleteAdReminder}
                  style={{ width:'100%', fontFamily:PP, fontWeight:700, fontSize:12, color:'#B91C1C', background:C.dangerLight, border:'1.5px solid #FECACA', borderRadius:14, padding:'12px 10px', cursor:'pointer' }}
                >
                  🗑️ Eliminar
                </button>
              </div>
              <button
                onClick={reviewAdReminder}
                style={{ width:'100%', fontFamily:PP, fontWeight:700, fontSize:12, color:C.text, background:'#fff', border:`1.5px solid ${C.border}`, borderRadius:14, padding:'12px 16px', cursor:'pointer' }}
              >
                Ver mis anuncios
              </button>
              <button
                onClick={closeAdReminderPrompt}
                style={{ width:'100%', fontFamily:PP, fontWeight:700, fontSize:12, color:C.mid, background:'#fff', border:'none', borderRadius:14, padding:'8px 16px', cursor:'pointer' }}
              >
                Recordarme luego
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* ── Configuración ── */}
      <Sheet show={configOpen} onClose={() => setConfigOpen(false)} title="⚙️ Configuración">
        <Input
          label="Nombre visible"
          value={configForm.name || ''}
          onChange={e => setConfigForm(prev => ({ ...prev, name: e.target.value }))}
        />
        <Select
          label="Tu cantón"
          value={configForm.canton || ''}
          onChange={e => setConfigForm(prev => ({ ...prev, canton: e.target.value }))}
        >
          <option value="">Seleccionar cantón...</option>
          {CANTONS.map(item => <option key={item.code} value={item.code}>{item.code} — {item.name}</option>)}
        </Select>

        <p style={{ fontFamily:PP, fontWeight:600, fontSize:12, color:C.text, margin:'16px 0 6px' }}>Cambiar contraseña</p>
        <Input
          label="Nueva contraseña"
          type={showConfigNewPassword ? 'text' : 'password'}
          value={configForm.newPassword || ''}
          onChange={e => setConfigForm(prev => ({ ...prev, newPassword: e.target.value }))}
          rightElement={
            <PasswordVisibilityButton
              visible={showConfigNewPassword}
              onToggle={() => setShowConfigNewPassword(visible => !visible)}
            />
          }
        />
        <Input
          label="Confirmar contraseña"
          type={showConfigConfirmPassword ? 'text' : 'password'}
          value={configForm.confirmPassword || ''}
          onChange={e => setConfigForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
          rightElement={
            <PasswordVisibilityButton
              visible={showConfigConfirmPassword}
              onToggle={() => setShowConfigConfirmPassword(visible => !visible)}
            />
          }
        />

        <p style={{ fontFamily:PP, fontSize:11, color:C.light, marginBottom:16, lineHeight:1.5 }}>
          Deja la contraseña en blanco si no quieres cambiarla.
        </p>

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={() => setConfigOpen(false)} style={{ flex:1, fontFamily:PP, fontWeight:700, fontSize:12, background:'#fff', color:C.mid, border:`1.5px solid ${C.border}`, borderRadius:12, padding:'11px 0', cursor:'pointer' }}>
            Cancelar
          </button>
          <Btn onClick={handleSaveConfig} disabled={savingConfig} style={{ flex:1 }}>
            {savingConfig ? 'Guardando...' : 'Guardar'}
          </Btn>
        </div>
      </Sheet>

      {/* ── Mis publicaciones modal ── */}
      <Modal show={manageOpen} onClose={() => setManageOpen(false)} title="Mis publicaciones">
        {issues.length > 0 && (
          <InfoBanner emoji="⚠️" title="No pudimos cargar todo" text={issues[0]} bg={C.warnLight} border={C.warnMid} color="#92400E" />
        )}
        <div style={{ display:'flex', gap:12, alignItems:'flex-end', marginBottom:16 }}>
          <div style={{ flex:1 }}>
            <Select label="Filtrar publicaciones" value={activeTab} onChange={event => setActiveTab(event.target.value)}>
              {PUBLICATION_TABS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </Select>
          </div>
          <div style={{ minWidth:82, textAlign:'right', paddingBottom:10 }}>
            <p style={{ fontFamily:PP, fontSize:10, color:C.light, margin:'0 0 3px' }}>Mostrando</p>
            <p style={{ fontFamily:PP, fontWeight:800, fontSize:20, color:C.text, margin:0 }}>{filteredPublications.length}</p>
          </div>
        </div>
        <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:14, padding:'10px 12px', marginBottom:14 }}>
          <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.text, margin:'0 0 3px' }}>{activeFilter?.label || 'Todo'}</p>
          <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>Abre el menú `⋯` de cada tarjeta para editar o borrar sin recargar el panel.</p>
        </div>

        {loadingPublications ? (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[1,2,3].map(index => <div key={index} className="skeleton" style={{ height:92, borderRadius:16 }} />)}
          </div>
        ) : filteredPublications.length === 0 ? (
          <EmptyState emoji="🗂️" title="Todavía no tienes publicaciones aquí" sub="Cuando publiques anuncios, empleos, eventos, negocios o grupos, podrás gestionarlos desde este panel." />
        ) : (
          filteredPublications.map(item => {
            const deleteKey = `${item.kind}-${item.id}`
            const expiredEvent = isExpiredEventPublication(item, eventReviewConfirmations)
            const adNeedsReview = isAdDueForReview(item, adReviewConfirmations)
            const imageUrl = getPublicationImageUrl(item)
            return (
              <div key={deleteKey} style={{ background:'#fff', border:`1px solid ${C.border}`, borderRadius:16, padding:'14px 15px', marginBottom:10 }}>
                <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                  {imageUrl ? (
                    <div style={{ width:42, height:42, borderRadius:12, overflow:'hidden', flexShrink:0 }}>
                      <img src={getThumbnailImageUrl(imageUrl)} alt={item.title} loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    </div>
                  ) : (
                    <div style={{ width:42, height:42, borderRadius:12, background:C.primaryLight, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                      {item.icon}
                    </div>
                  )}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:6 }}>
                      <Tag bg="#DBEAFE" color={C.primaryDark}>{KIND_META[item.kind].label}</Tag>
                      <Tag bg={expiredEvent ? '#FEF3C7' : item.active ? '#D1FAE5' : '#E5E7EB'} color={expiredEvent ? '#92400E' : item.active ? '#065F46' : '#475569'}>
                        {expiredEvent ? 'Fecha pasada' : item.active ? 'Activa' : 'Oculta'}
                      </Tag>
                      {adNeedsReview && <Tag bg="#FEF3C7" color="#92400E">Revisar</Tag>}
                    </div>
                    <p style={{ fontFamily:PP, fontWeight:700, fontSize:14, color:C.text, margin:'0 0 4px', lineHeight:1.35, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.title}</p>
                    {item.summary && (
                      <p style={{ fontFamily:PP, fontSize:12, color:C.mid, margin:'0 0 3px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {item.summary}
                      </p>
                    )}
                    <div style={{ display:'flex', alignItems:'center', gap:4, minWidth:0 }}>
                      {item.meta && <span style={{ fontFamily:PP, fontSize:10, color:C.light, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.meta}</span>}
                      <span style={{ fontFamily:PP, fontSize:10, color:C.light, flexShrink:0 }}>{item.meta ? '· ' : ''}{formatDate(item.createdAt)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setBusinessDeleteBlock(null)
                      setActionItem(item)
                    }}
                    style={{ width:36, height:36, borderRadius:12, border:`1px solid ${C.border}`, background:C.bg, color:C.mid, fontSize:18, cursor:'pointer', flexShrink:0 }}
                    aria-label={`Gestionar ${item.title}`}
                  >
                    ⋯
                  </button>
                </div>
                {deletingKey === deleteKey && (
                  <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:'10px 0 0', paddingTop:10, borderTop:`1px solid ${C.border}` }}>
                    Borrando publicación...
                  </p>
                )}
              </div>
            )
          })
        )}
      </Modal>

      <Sheet
        show={!!actionItem}
        onClose={() => {
          setBusinessDeleteBlock(null)
          setActionItem(null)
        }}
        title={actionItem ? actionItem.title : 'Acciones'}
        syncHistory={false}
      >
        {actionItem && (
          <>
            <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:16, padding:'12px 14px', marginBottom:14 }}>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:6 }}>
                <Tag bg="#DBEAFE" color={C.primaryDark}>{KIND_META[actionItem.kind].label}</Tag>
                <Tag bg={actionItem.active ? '#D1FAE5' : '#E5E7EB'} color={actionItem.active ? '#065F46' : '#475569'}>
                  {actionItem.active ? 'Activa' : 'Oculta'}
                </Tag>
                {isAdDueForReview(actionItem, adReviewConfirmations) && <Tag bg="#FEF3C7" color="#92400E">Revisar</Tag>}
              </div>
              <p style={{ fontFamily:PP, fontWeight:700, fontSize:14, color:C.text, margin:'0 0 4px', lineHeight:1.35 }}>{actionItem.title}</p>
              <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>{formatDate(actionItem.createdAt)}</p>
            </div>
            <Btn onClick={() => handleEditPublication(actionItem)} style={{ marginBottom:10 }}>✏️ Editar publicación</Btn>
            {PAID_BUSINESS_FEATURES_VISIBLE && actionItem.kind === 'business' && (
              <button
                onClick={() => {
                  const providerId = actionItem.id
                  setActionItem(null)
                  setManageOpen(false)
                  navigate(`/negocios/${providerId}/destacar`)
                }}
                style={{ width:'100%', fontFamily:PP, fontWeight:800, fontSize:13, background:C.primaryLight, color:C.primaryDark, border:`1.5px solid ${C.primaryMid}`, borderRadius:14, padding:'12px 16px', cursor:'pointer', marginBottom:10 }}
              >
                Ver planes de colaboración
              </button>
            )}
            {actionItem.kind === 'business'
              && businessDeleteBlock?.providerId === actionItem.id && (
              <div style={{ background:'#FFF7ED', border:'1.5px solid #FDBA74', borderRadius:16, padding:'14px 15px', marginBottom:12 }}>
                <p style={{ fontFamily:PP, fontWeight:800, fontSize:13, color:'#9A3412', margin:'0 0 5px' }}>
                  No se puede eliminar este negocio
                </p>
                <p style={{ fontFamily:PP, fontSize:11, color:'#9A3412', lineHeight:1.55, margin:'0 0 12px' }}>
                  Este negocio tiene una suscripción profesional que todavía se renovará. Cancélala primero desde Stripe para poder eliminarlo.
                </p>
                <button
                  onClick={() => openBusinessSubscriptionPortal(actionItem.id)}
                  disabled={openingBusinessPortal}
                  style={{ width:'100%', fontFamily:PP, fontWeight:800, fontSize:12, color:'#fff', background:'#EA580C', border:'none', borderRadius:12, padding:'11px 14px', cursor:openingBusinessPortal ? 'default' : 'pointer', opacity:openingBusinessPortal ? 0.65 : 1 }}
                >
                  {openingBusinessPortal
                    ? 'Abriendo Stripe...'
                    : 'Cancelar suscripcion'}
                </button>
              </div>
            )}
            <button
              onClick={() => handleDeletePublication(actionItem)}
              disabled={
                deletingKey === `${actionItem.kind}-${actionItem.id}`
              }
              style={{ width:'100%', fontFamily:PP, fontWeight:700, fontSize:13, background:'#FEF2F2', color:'#DC2626', border:'none', borderRadius:14, padding:'12px 16px', cursor:deletingKey === `${actionItem.kind}-${actionItem.id}` ? 'default' : 'pointer', opacity:deletingKey === `${actionItem.kind}-${actionItem.id}` ? 0.65 : 1, marginBottom:8 }}
            >
              {deletingKey === `${actionItem.kind}-${actionItem.id}`
                ? 'Comprobando...'
                : businessDeleteBlock?.providerId === actionItem.id
                ? 'Volver a comprobar y borrar'
                : '🗑️ Borrar publicación'}
            </button>
            <button
              onClick={() => {
                setBusinessDeleteBlock(null)
                setActionItem(null)
              }}
              style={{ width:'100%', fontFamily:PP, fontWeight:700, fontSize:12, color:'#475569', background:'#F8FAFC', border:'1.5px solid #CBD5E1', borderRadius:14, padding:'11px 16px', cursor:'pointer' }}
            >
              Cancelar
            </button>
          </>
        )}
      </Sheet>

      {/* ── Compartir Latido ── */}
      <Sheet show={shareOpen} onClose={() => setShareOpen(false)} title="🔗 Compartir Latido">
        <p style={{ fontFamily:PP, fontSize:13, color:C.mid, marginBottom:20, lineHeight:1.6 }}>
          Invita a tus amigos y familiares a unirse a la comunidad latina en Suiza.
        </p>

        {[
          {
            icon:'💬',
            label:'WhatsApp',
            color:'#25D366',
            bg:'#F0FDF4',
            border:'#86EFAC',
            href:`https://wa.me/?text=${encodeURIComponent(SHARE_TEXT + '\n' + SHARE_URL)}`,
          },
          {
            icon:'✉️',
            label:'Email',
            color:'#2563EB',
            bg:C.primaryLight,
            border:C.primaryMid,
            href:`mailto:?subject=${encodeURIComponent('Te invito a Latido')}&body=${encodeURIComponent(SHARE_TEXT + '\n\n' + SHARE_URL)}`,
          },
          {
            icon:'📱',
            label:'Telegram',
            color:'#0088CC',
            bg:'#EFF6FF',
            border:'#BFDBFE',
            href:`https://t.me/share/url?url=${encodeURIComponent(SHARE_URL)}&text=${encodeURIComponent(SHARE_TEXT)}`,
          },
        ].map(opt => (
          <a
            key={opt.label}
            href={opt.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display:'flex', alignItems:'center', gap:14, background:opt.bg, border:`1.5px solid ${opt.border}`, borderRadius:14, padding:'13px 16px', marginBottom:10, textDecoration:'none' }}
          >
            <span style={{ fontSize:26 }}>{opt.icon}</span>
            <span style={{ fontFamily:PP, fontWeight:700, fontSize:14, color:opt.color }}>{opt.label}</span>
            <span style={{ marginLeft:'auto', fontFamily:PP, fontSize:12, color:opt.color }}>›</span>
          </a>
        ))}

        <button
          onClick={copyLink}
          style={{ width:'100%', display:'flex', alignItems:'center', gap:14, background: copied ? '#F0FDF4' : C.bg, border:`1.5px solid ${copied ? '#86EFAC' : C.border}`, borderRadius:14, padding:'13px 16px', cursor:'pointer', marginTop:4 }}
        >
          <span style={{ fontSize:26 }}>{copied ? '✅' : '🔗'}</span>
          <span style={{ fontFamily:PP, fontWeight:700, fontSize:14, color: copied ? '#15803D' : C.text }}>
            {copied ? '¡Enlace copiado!' : 'Copiar enlace'}
          </span>
        </button>
      </Sheet>

      <Modal show={!!editorItem} onClose={closeEditor} title={editorItem ? `Editar ${KIND_META[editorItem.kind].label.toLowerCase()}` : 'Editar'}>
        {editorItem?.kind === 'ad' && (
          <>
            <Select label="Tipo" value={editorForm.type || ''} onChange={event => updateEditorAdType(event.target.value)}>
              <option value="">Seleccionar...</option>
              {AD_TYPES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </Select>
            <Select label="Categoría" value={editorForm.cat || ''} onChange={event => updateEditorAdCategory(event.target.value)} disabled={!editorForm.type}>
              <option value="">Seleccionar...</option>
              {getAdCategoriesForType(editorForm.type).map(item => <option key={item.id} value={item.id}>{item.emoji} {item.label}</option>)}
            </Select>
            {getAdSubOptions(editorForm.cat, editorForm.type).length > 0 && (
              <Select label="Subcategoría (opcional)" value={editorForm.sub || ''} onChange={event => updateEditorField('sub', event.target.value)}>
                <option value="">Sin subcategoría</option>
                {getAdSubOptions(editorForm.cat, editorForm.type).map(option => {
                  const label = getAdSubLabel(option)
                  return <option key={label} value={label}>{option?.emoji ? `${option.emoji} ` : ''}{label}</option>
                })}
              </Select>
            )}
            <ImageUploadField
              label="Imágenes del anuncio"
              previewUrl={editorForm.img_url || ''}
              previewUrls={supportsMultipleAdPhotos(editorForm.cat) ? (editorForm.photo_urls || []) : []}
              uploading={uploadingEditorImage}
              multiple={supportsMultipleAdPhotos(editorForm.cat)}
              maxImages={MAX_PUBLICATION_IMAGES}
              onFilesSelected={handleEditorImageUpload}
              onRemove={() => setEditorForm(prev => ({ ...prev, img_url:'', photo_urls:[] }))}
              onRemoveAt={index => setEditorForm(prev => {
                const removedUrl = prev.photo_urls?.[index]
                const nextUrls = (prev.photo_urls || []).filter((_, i) => i !== index)
                return {
                  ...prev,
                  img_url: prev.img_url === removedUrl ? nextUrls[0] || '' : prev.img_url,
                  photo_urls: nextUrls,
                }
              })}
              onReplaceAt={handleEditorImageReplace}
              hint={supportsMultipleAdPhotos(editorForm.cat)
                ? `Borra una foto con X, cámbiala o añade hasta ${MAX_PUBLICATION_IMAGES} imágenes.`
                : 'Sube una nueva imagen para cambiar la actual, o bórrala con X.'}
            />
            <Input label="Título" value={editorForm.title || ''} onChange={event => updateEditorField('title', event.target.value)} />
            <Input label="Descripción" rows={4} value={editorForm.desc || ''} onChange={event => updateEditorField('desc', event.target.value)} />
            <AdPriceEditor form={editorForm} onChange={updateEditorField} />
            <div className="grid-2" style={{ gap:10 }}>
              <Select label="Cantón" value={editorForm.canton || ''} onChange={event => updateEditorField('canton', event.target.value)}>
                <option value="">Seleccionar...</option>
                {CANTONS.map(item => <option key={item.code} value={item.code}>{item.code} — {item.name}</option>)}
              </Select>
              <Input label="PLZ" value={editorForm.plz || ''} onChange={event => updateEditorField('plz', event.target.value)} />
            </div>
            <Select label="Privacidad" value={editorForm.privacy || 'public'} onChange={event => updateEditorField('privacy', event.target.value)}>
              <option value="public">Público</option>
              <option value="private">Privado</option>
            </Select>
          </>
        )}

        {editorItem?.kind === 'job' && (
          <>
            <Select label="Busco / ofrezco" value={editorForm.jobIntent || 'ofrece'} onChange={event => updateEditorField('jobIntent', event.target.value)}>
              {JOB_INTENTS.map(intent => <option key={intent.id} value={intent.id}>{intent.label}</option>)}
            </Select>
            <ImageUploadField
              label={EDITOR_IMAGE_CONFIG.job.label}
              previewUrl={editorForm.logo_url || ''}
              uploading={uploadingEditorImage}
              onFilesSelected={handleEditorImageUpload}
              onRemove={() => updateEditorField('logo_url', '')}
              onReplaceAt={handleEditorImageReplace}
              hint={EDITOR_IMAGE_CONFIG.job.hint}
            />
            <Select label={editorForm.jobIntent === 'busca' ? 'Sector en el que buscas trabajo' : 'Sector de la oferta'} value={editorForm.sector || ''} onChange={event => updateEditorField('sector', event.target.value)}>
              <option value="">Seleccionar...</option>
              {editorForm.sector && !JOB_SECTORS.some(sector => sector.id === editorForm.sector) && (
                <option value={editorForm.sector}>{editorForm.sector}</option>
              )}
              {JOB_SECTORS.map(sector => <option key={sector.id} value={sector.id}>{sector.emoji} {sector.label}</option>)}
            </Select>
            <Input label={editorForm.jobIntent === 'busca' ? 'Puesto o trabajo que buscas' : 'Título del puesto'} value={editorForm.title || ''} onChange={event => updateEditorField('title', event.target.value)} />
            <Input label={editorForm.jobIntent === 'busca' ? 'Nombre o perfil profesional (opcional)' : 'Empresa o empleador (opcional)'} value={editorForm.company || ''} onChange={event => updateEditorField('company', event.target.value)} />
            <Select label={editorForm.jobIntent === 'busca' ? 'Tipo de contrato o disponibilidad' : 'Tipo de contrato'} value={editorForm.type || ''} onChange={event => updateEditorField('type', event.target.value)}>
              <option value="">Seleccionar...</option>
              {editorForm.type && !JOB_TYPES.some(type => type.id === editorForm.type) && (
                <option value={editorForm.type}>{editorForm.type}</option>
              )}
              {JOB_TYPES.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}
            </Select>
            <div className="grid-2" style={{ gap:10 }}>
              <Input label="Ciudad" value={editorForm.city || ''} onChange={event => updateEditorField('city', event.target.value)} />
              <Select label="Cantón" value={editorForm.canton || ''} onChange={event => updateEditorField('canton', event.target.value)}>
                <option value="">Seleccionar...</option>
                {CANTONS.map(item => <option key={item.code} value={item.code}>{item.code} — {item.name}</option>)}
              </Select>
            </div>
            <Input label="Salario" value={editorForm.salary || ''} onChange={event => updateEditorField('salary', event.target.value)} />
            <Input label="Idiomas (separados por coma)" value={editorForm.langs || ''} onChange={event => updateEditorField('langs', event.target.value)} />
            <Input label="Descripción" rows={4} value={editorForm.desc || ''} onChange={event => updateEditorField('desc', event.target.value)} />
          </>
        )}

        {editorItem?.kind === 'event' && (
          <>
            <Select label="Tipo de evento" value={editorForm.type || ''} onChange={event => updateEditorField('type', event.target.value)}>
              <option value="">Seleccionar...</option>
              {EVENTO_TYPES.map(item => item.id ? <option key={item.id} value={item.id}>{item.label}</option> : null)}
            </Select>
            <ImageUploadField
              label={EDITOR_IMAGE_CONFIG.event.label}
              previewUrl={editorForm.img_url || ''}
              uploading={uploadingEditorImage}
              onFilesSelected={handleEditorImageUpload}
              onRemove={() => updateEditorField('img_url', '')}
              onReplaceAt={handleEditorImageReplace}
              hint={EDITOR_IMAGE_CONFIG.event.hint}
            />
            <Input label="Título" value={editorForm.title || ''} onChange={event => updateEditorField('title', event.target.value)} />
            <div className="grid-2" style={{ gap:10 }}>
              <Input label="Día" value={editorForm.day || ''} onChange={event => updateEditorField('day', event.target.value)} />
              <Input label="Mes" value={editorForm.month || ''} onChange={event => updateEditorField('month', event.target.value)} />
            </div>
            <div className="grid-2" style={{ gap:10 }}>
              <Input label="Año" value={editorForm.year || ''} onChange={event => updateEditorField('year', event.target.value)} />
              <Input label="Hora" value={editorForm.time || ''} onChange={event => updateEditorField('time', event.target.value)} />
            </div>
            <Input label="Precio" value={editorForm.price || ''} onChange={event => updateEditorField('price', event.target.value)} />
            <div className="grid-2" style={{ gap:10 }}>
              <Input label="Ciudad" value={editorForm.city || ''} onChange={event => updateEditorField('city', event.target.value)} />
              <Select label="Cantón" value={editorForm.canton || ''} onChange={event => updateEditorField('canton', event.target.value)}>
                <option value="">Seleccionar...</option>
                {CANTONS.map(item => <option key={item.code} value={item.code}>{item.code} — {item.name}</option>)}
              </Select>
            </div>
            <Input label="Venue" value={editorForm.venue || ''} onChange={event => updateEditorField('venue', event.target.value)} />
            <Input label="Descripción" rows={4} value={editorForm.desc || ''} onChange={event => updateEditorField('desc', event.target.value)} />
            <Input label="Organizador" value={editorForm.host || ''} onChange={event => updateEditorField('host', event.target.value)} />
            <Input label="Link" value={editorForm.link || ''} onChange={event => updateEditorField('link', event.target.value)} />
          </>
        )}

        {editorItem?.kind === 'business' && (
          <>
            <Select label="Categoría" value={normalizeNegocioType(editorForm.category || '')} onChange={event => updateEditorField('category', event.target.value)}>
              <option value="">Seleccionar...</option>
              {VISIBLE_NEGOCIO_TYPES.map(item => item.id ? <option key={item.id} value={item.id}>{item.label}</option> : null)}
            </Select>
            <ImageUploadField
              label={EDITOR_IMAGE_CONFIG.business.label}
              previewUrl={editorForm.photo_url || ''}
              uploading={uploadingEditorImage}
              onFilesSelected={handleEditorImageUpload}
              onRemove={() => updateEditorField('photo_url', '')}
              onReplaceAt={handleEditorImageReplace}
              hint={EDITOR_IMAGE_CONFIG.business.hint}
            />
            <Input label="Nombre" value={editorForm.name || ''} onChange={event => updateEditorField('name', event.target.value)} />
            <div className="grid-2" style={{ gap:10 }}>
              <Input label="Ciudad" value={editorForm.city || ''} onChange={event => updateEditorField('city', event.target.value)} />
              <Select label="Cantón" value={editorForm.canton || ''} onChange={event => updateEditorField('canton', event.target.value)}>
                <option value="">Seleccionar...</option>
                {CANTONS.map(item => <option key={item.code} value={item.code}>{item.code} — {item.name}</option>)}
              </Select>
            </div>
            <Input label="Dirección" placeholder="Ej: Bahnhofstrasse 10, 8001 Zürich" value={editorForm.address || ''} onChange={event => updateEditorField('address', event.target.value)} />
            <Input label="Descripción" rows={4} value={editorForm.description || ''} onChange={event => updateEditorField('description', event.target.value)} />
            <Input label="Teléfono" placeholder="079 123 45 67 o +41 22 123 45 67" value={editorForm.phone || ''} onChange={event => {
              updateEditorField('phone', event.target.value)
              if (!canUseWhatsappNumber(event.target.value)) updateEditorField('hasWhatsapp', false)
            }} />
            <label style={{ display:'flex', alignItems:'center', gap:9, fontFamily:PP, fontSize:12, color:canUseWhatsappNumber(editorForm.phone) ? C.mid : C.light, margin:'-2px 2px 4px', cursor:canUseWhatsappNumber(editorForm.phone) ? 'pointer' : 'not-allowed' }}>
              <input
                type="checkbox"
                checked={Boolean(editorForm.hasWhatsapp && canUseWhatsappNumber(editorForm.phone))}
                disabled={!canUseWhatsappNumber(editorForm.phone)}
                onChange={event => updateEditorField('hasWhatsapp', event.target.checked)}
                style={{ accentColor:C.primary }}
              />
              Este número también está disponible en WhatsApp
            </label>
            <p style={{ fontFamily:PP, fontSize:10.5, color:C.light, margin:'0 2px 12px', lineHeight:1.45 }}>
              Los números fijos suizos se mostrarán solo como teléfono.
            </p>
            <Input label="Email" type="email" value={editorForm.email || ''} onChange={event => updateEditorField('email', event.target.value)} />
            <Input label="Instagram" value={editorForm.instagram || ''} onChange={event => updateEditorField('instagram', event.target.value)} />
            <Input label="Web (opcional)" type="url" value={editorForm.website || ''} onChange={event => updateEditorField('website', event.target.value)} />
            <Input
              label={isBusinessPromotionActive(editorItem.raw) && ['basic', 'premium'].includes(editorItem.raw?.promotion_plan) ? 'Los 3 servicios principales que ofrece tu empresa' : 'Servicios principales (máximo 3)'}
              placeholder="Ej: Gestoría, Finanzas, Seguros"
              value={editorForm.services || ''}
              onChange={event => updateEditorField('services', event.target.value)}
            />
            {isBusinessPromotionActive(editorItem.raw) && ['basic', 'premium'].includes(editorItem.raw?.promotion_plan) && (
              <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:16, padding:'13px 14px', margin:'8px 0 12px' }}>
                <p style={{ fontFamily:PP, fontWeight:900, fontSize:13, color:C.text, margin:'0 0 4px' }}>
                  Tarjeta de colaborador
                </p>
                <p style={{ fontFamily:PP, fontSize:11, color:C.light, lineHeight:1.55, margin:'0 0 12px' }}>
                  Si dejas estos campos vacíos, Latido usará automáticamente la información principal del negocio.
                </p>
                <ImageUploadField
                  label="Logo para la tarjeta"
                  previewUrl={editorForm.partner_logo_url || ''}
                  uploading={uploadingPartnerLogo}
                  onFilesSelected={handlePartnerLogoUpload}
                  onRemove={() => updateEditorField('partner_logo_url', '')}
                  hint="Sube un logo cuadrado o horizontal. Si no subes uno, usaremos la imagen principal del negocio."
                />
                <Input label="Título de la tarjeta" value={editorForm.partner_card_title || ''} placeholder={editorForm.name || 'Nombre del negocio'} onChange={event => updateEditorField('partner_card_title', event.target.value)} />
                <Input label="Descripción corta" rows={3} value={editorForm.partner_card_description || ''} placeholder={editorForm.description || 'Resumen breve para la tarjeta de colaborador'} onChange={event => updateEditorField('partner_card_description', event.target.value)} />
                <Input label="Enlace de contacto o web" value={editorForm.partner_cta_url || ''} placeholder={editorForm.website || 'https://...'} onChange={event => updateEditorField('partner_cta_url', event.target.value)} />
                <label style={{ display:'flex', gap:10, alignItems:'flex-start', fontFamily:PP, fontSize:12, color:C.mid, lineHeight:1.45, cursor:'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editorForm.partner_published !== false}
                    onChange={event => updateEditorField('partner_published', event.target.checked)}
                    style={{ marginTop:2, accentColor:C.primary }}
                  />
                  Mostrar la tarjeta mientras el plan esté activo
                </label>
              </div>
            )}
          </>
        )}

        {editorItem?.kind === 'community' && (
          <>
            <Select label="Categoría" value={editorForm.cat || ''} onChange={event => updateEditorField('cat', event.target.value)}>
              <option value="">Seleccionar...</option>
              {COMMUNITY_OPTIONS.map(item => <option key={item.id} value={item.id}>{item.emoji} {item.label}</option>)}
            </Select>
            <ImageUploadField
              label={EDITOR_IMAGE_CONFIG.community.label}
              previewUrl={editorForm.photo_url || ''}
              uploading={uploadingEditorImage}
              onFilesSelected={handleEditorImageUpload}
              onRemove={() => updateEditorField('photo_url', '')}
              onReplaceAt={handleEditorImageReplace}
              hint={EDITOR_IMAGE_CONFIG.community.hint}
            />
            <Input label="Nombre" value={editorForm.name || ''} onChange={event => updateEditorField('name', event.target.value)} />
            <Input label="Ciudad / zona" value={editorForm.city || ''} onChange={event => updateEditorField('city', event.target.value)} />
            <Input label="Descripción" rows={4} value={editorForm.desc || ''} onChange={event => updateEditorField('desc', event.target.value)} />
            <Input label="Link o contacto" value={editorForm.contact || ''} onChange={event => updateEditorField('contact', event.target.value)} />
          </>
        )}

        <div style={{ display:'flex', gap:10, marginTop:18 }}>
          <button onClick={closeEditor} style={{ flex:1, fontFamily:PP, fontWeight:700, fontSize:12, background:'#F8FAFC', color:'#475569', border:'1.5px solid #CBD5E1', borderRadius:12, padding:'11px 0', cursor:'pointer' }}>
            Cancelar
          </button>
          <Btn onClick={handleSavePublication} disabled={saving} style={{ flex:1 }}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Btn>
        </div>
      </Modal>
    </div>
  )
}
