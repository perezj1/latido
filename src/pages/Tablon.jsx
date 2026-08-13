import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useFavorites } from '../hooks/useFavorites'
import { fetchPublicProfilesByIds } from '../lib/profiles'
import { C, PP, CAT_COLORS } from '../lib/theme'
import { MOCK_ADS, MOCK_JOBS, AD_CATS, AD_TYPES, CANTONS, JOB_TYPES, formatAdLocation, getAdCategoryId, getAdDisplayCat, getAdDisplayEmoji, getAdSubOption, getCategoryIntentMeta, getCategoryIntentViews, getDefaultCategoryIntent, getJobIntentId, getJobIntentMeta, getPublishPathForIntent, normalizeAdCat } from '../lib/constants'
import { Avatar, Card, EmptyState, FullPageOverlay, ImageLightbox, PhotoGallery, PrivacyTag, ReviewForm, ReviewList, Sheet, SkeletonCard, Stars, Tag } from '../components/UI'
import FavoriteButton from '../components/FavoriteButton'
import DetailActionBar from '../components/DetailActionBar'
import GlobalSearch from '../components/GlobalSearch'
import SavedSearchButton from '../components/SavedSearchButton'
import SearchRecoveryEmptyState from '../components/SearchRecoveryEmptyState'
import { FilterButton, FilterChips, FilterResultSummary, SegmentedTabs, FILTER_PANEL_TITLE_STYLE } from '../components/FilterWorkspace'
import SectionTabs from '../components/SectionTabs'
import { getAdPath, getIdFromSlug, getJobPath } from '../lib/seo'
import { readOfflineSnapshot, writeOfflineSnapshot } from '../lib/offlineCache'
import { getThumbnailImageUrl, handleThumbnailImageError } from '../lib/imageVariants'
import { matchesCantonOrNationwide } from '../lib/locationScope'
import { buildSearchProfile, profileHasIntent, scoreSearchFields } from '../lib/naturalSearch'
import { isPublicationOpen } from '../lib/publicationLifecycle'
import { EmploymentLevelBadge } from '../components/EmploymentProfileForm'
import {
  employmentProfileFromJob,
  getEmploymentProfileLevel,
  getEmploymentProfileRows,
  hasEmploymentProfileData,
} from '../lib/employmentProfile'
import toast from 'react-hot-toast'
import { markSavedSearchDigestOpened, markSavedSearchMatchOpened } from '../lib/savedSearches'

function fmtPrice(price) {
  if (!price) return ''
  let s = price.trim()
  s = s.replace(/\s*\/\s*/g, '/')
  s = s.replace(/(\d)\s*[-–]\s*(\d)/g, '$1-$2')
  s = s.replace(/^([\d.,]+)\s+CHF\b(.*)/, 'CHF $1$2')
  s = s.replace(/^(CHF\s*[\d.,]+)\s+([^\s/].*)$/, '$1/$2')
  return s
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

function getAdPhotos(ad) {
  return Array.from(new Set([
    ...normalizePhotoUrls(ad.photo_urls),
    ad.img_url,
    ad.img,
  ].filter(Boolean)))
}

const REVIEWABLE_AD_CATS = new Set(['servicios', 'cuidados'])

function isReviewableAd(ad) {
  return REVIEWABLE_AD_CATS.has(getAdCategoryId(ad))
}

function averageRating(reviews) {
  if (!reviews?.length) return null
  return +(reviews.reduce((sum, review) => sum + Number(review.stars || 0), 0) / reviews.length).toFixed(1)
}

function formatRelativeDate(value) {
  if (!value) return 'Ahora'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Ahora'

  const diff = Date.now() - date.getTime()
  const days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Hace 1 día'
  if (days < 30) return `Hace ${days} días`
  const months = Math.floor(days / 30)
  if (months <= 1) return 'Hace 1 mes'
  return `Hace ${months} meses`
}

function normalizeListingReview(review) {
  return {
    id: review.id,
    listing_id: review.listing_id,
    user_id: review.user_id || '',
    author: review.author_name || 'Usuario',
    canton: review.canton || '',
    stars: Number(review.stars || 0),
    date: formatRelativeDate(review.created_at),
    text: review.text || '',
  }
}

const persistedTablonSnapshot = readOfflineSnapshot('tablon-public')
const TABLON_CACHE = {
  publicAds:persistedTablonSnapshot?.data?.ads || null,
  publicAdsTs:persistedTablonSnapshot?.savedAt || 0,
  privateAds:null,
  privateAdsTs:0,
  jobs:persistedTablonSnapshot?.data?.jobs || null,
  jobsTs:persistedTablonSnapshot?.savedAt || 0,
}

function persistTablonCache() {
  writeOfflineSnapshot('tablon-public', {
    ads:TABLON_CACHE.publicAds || [],
    jobs:TABLON_CACHE.jobs || [],
  })
}
const TABLON_SEARCH_RESULT_TYPES = ['ad', 'job']
const TABLON_DATA_PAGE_SIZE = 500

async function fetchAllTablonRows(buildQuery) {
  const rows = []

  for (let from = 0; ; from += TABLON_DATA_PAGE_SIZE) {
    const response = await buildQuery().range(from, from + TABLON_DATA_PAGE_SIZE - 1)
    if (response.error) return response

    const page = response.data || []
    rows.push(...page)
    if (page.length < TABLON_DATA_PAGE_SIZE) return { data:rows, error:null }
  }
}
const FILTER_PARAM_KEYS = ['canton', 'plz', 'privacy', 'jobType', 'employmentLevel', 'priceRange', 'maxPrice', 'sort']
const WRAPPING_TEXT = { minWidth:0, overflowWrap:'anywhere', wordBreak:'break-word' }
const LIST_CARD_STYLE = {
  background:'#fff',
  borderRadius:16,
  border:`1px solid ${C.border}`,
  padding:10,
  display:'flex',
  alignItems:'stretch',
  gap:12,
  width:'100%',
  textAlign:'left',
  cursor:'pointer',
  position:'relative',
}
const LIST_THUMB_STYLE = {
  width:96,
  height:108,
  minHeight:108,
  alignSelf:'flex-start',
  background:'#fff',
  borderRadius:14,
  overflow:'hidden',
  display:'flex',
  alignItems:'center',
  justifyContent:'center',
  flexShrink:0,
  position:'relative',
}
const LIST_MEDIA_STYLE = { width:'100%', height:'100%', objectFit:'contain', display:'block' }
const LIST_FALLBACK_STYLE = { width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:38 }
const CLAMP_1 = { minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }
const CLAMP_2 = { display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', ...WRAPPING_TEXT }
const JOB_INTENT_TAG_STYLE = {
  ofrece:{ bg:'#E0F2FE', color:'#0369A1' },
  busca:{ bg:'#FEF3C7', color:'#92400E' },
}
const AD_TYPE_TAG_STYLE = {
  busca:{ bg:'#FEF3C7', color:'#92400E' },
  ofrece:{ bg:'#E0F2FE', color:'#0369A1' },
  vende:{ bg:'#ECFDF5', color:'#047857' },
  regala:{ bg:'#FCE7F3', color:'#BE185D' },
}
const AD_TYPE_SHORT_LABEL = {
  busca:'Busco',
  ofrece:'Ofrezco',
  vende:'Vendo',
  regala:'Regalo',
}
const AD_TYPE_CARD_EMOJI = {
  ofrece:'🏷️',
}

const PRICE_RANGES = [
  { id:'', label:'Cualquier precio' },
  { id:'0-50', label:'Hasta CHF 50', min:0, max:50 },
  { id:'50-150', label:'CHF 50 - 150', min:50, max:150 },
  { id:'150-500', label:'CHF 150 - 500', min:150, max:500 },
  { id:'500-1000', label:'CHF 500 - 1.000', min:500, max:1000 },
  { id:'1000-plus', label:'Más de CHF 1.000', min:1000, max:null },
]

const SORT_OPTIONS = [
  { id:'newest', label:'Más reciente' },
  { id:'oldest', label:'Más antiguo' },
  { id:'price_asc', label:'Precio más bajo' },
  { id:'price_desc', label:'Precio más caro' },
]

const EMPLOYMENT_LEVEL_FILTER_OPTIONS = [
  { id:'', label:'Todos los niveles' },
  { id:'apprentice', label:'Aprendiz' },
  { id:'intermediate', label:'Nivel medio' },
  { id:'professional', label:'Profesional' },
  { id:'unrated', label:'Sin valorar' },
]
const EMPLOYMENT_LEVEL_IDS = new Set(
  EMPLOYMENT_LEVEL_FILTER_OPTIONS.map(option => option.id).filter(Boolean)
)

function getJobEmploymentLevelId(job={}) {
  const derivedLevel = getEmploymentProfileLevel(employmentProfileFromJob(job))
  if (derivedLevel?.id) return derivedLevel.id
  if (EMPLOYMENT_LEVEL_IDS.has(job.employment_level)) return job.employment_level
  return 'unrated'
}

function getJobProfessionalSearchText(job={}) {
  const profile = employmentProfileFromJob(job)
  const rows = getEmploymentProfileRows(profile)
  const level = getEmploymentProfileLevel(profile)
  return [
    level?.label,
    ...rows.flatMap(row => [row.label, row.value]),
  ].filter(Boolean).join(' ')
}

const GENERAL_INTENT_VIEWS = [
  { id:'ofrece', emoji:'📣', label:'Ofertas', shortLabel:'Ofertas' },
  { id:'busca', emoji:'🔎', label:'Solicitudes', shortLabel:'Solicitudes' },
]

const FILTER_CONTROL_STYLE = {
  width:'100%',
  boxSizing:'border-box',
  border:`1.5px solid ${C.border}`,
  borderRadius:13,
  padding:'12px 14px',
  fontFamily:PP,
  fontSize:12,
  fontWeight:600,
  background:'#fff',
  outline:'none',
}

function getFilterControlStyle(value, defaultValue='') {
  return {
    ...FILTER_CONTROL_STYLE,
    color:String(value ?? '') === String(defaultValue ?? '') ? C.light : C.text,
  }
}

function parseListingPrice(value='') {
  if (!value) return null
  if (/gratis/i.test(value)) return 0

  const match = String(value).replace(/[’']/g, '').match(/\d[\d\s.,]*/)
  if (!match) return null

  const normalized = match[0]
    .replace(/\s/g, '')
    .replace(/[.,](?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.')
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function getPublicationPrice(item={}) {
  const structuredPrice = item.price_amount ?? item.salary_amount
  if (structuredPrice !== null && structuredPrice !== undefined && structuredPrice !== '') {
    const parsed = Number(structuredPrice)
    if (Number.isFinite(parsed)) return parsed
  }
  return parseListingPrice(item.price || item.salary || '')
}

function getPublicationTimestamp(item={}) {
  const parsed = Date.parse(item.created_at || item.createdAt || '')
  return Number.isFinite(parsed) ? parsed : 0
}

function comparePublications(a, b, order='newest') {
  const first = a?.item || a
  const second = b?.item || b

  if (order === 'relevance') return 0

  if (order === 'price_asc' || order === 'price_desc') {
    const firstPrice = getPublicationPrice(first)
    const secondPrice = getPublicationPrice(second)
    if (firstPrice === null && secondPrice !== null) return 1
    if (firstPrice !== null && secondPrice === null) return -1
    if (firstPrice !== null && secondPrice !== null && firstPrice !== secondPrice) {
      return order === 'price_asc' ? firstPrice - secondPrice : secondPrice - firstPrice
    }
  }

  const dateDifference = getPublicationTimestamp(second) - getPublicationTimestamp(first)
  return order === 'oldest' ? -dateDifference : dateDifference
}

function getJobIntentTag(job) {
  const intent = getJobIntentMeta(job)
  return { ...intent, ...(JOB_INTENT_TAG_STYLE[intent.id] || JOB_INTENT_TAG_STYLE.ofrece) }
}

function getAdIntentTag(ad={}) {
  const type = AD_TYPES.find(item => item.id === ad.type)
  if (!type) return null
  const categoryId = getAdCategoryId(ad)
  const normalizedType = categoryId === 'venta' && ad.type === 'ofrece' ? 'vende' : ad.type
  const contextual = getCategoryIntentMeta(categoryId, normalizedType)
  return {
    ...type,
    emoji: contextual?.emoji || AD_TYPE_CARD_EMOJI[type.id] || type.emoji,
    shortLabel: contextual?.itemLabel || contextual?.shortLabel || AD_TYPE_SHORT_LABEL[type.id] || type.label,
    ...(AD_TYPE_TAG_STYLE[type.id] || AD_TYPE_TAG_STYLE.ofrece),
  }
}

function getTablonContext(cat='', isEmpleos=false, intentMeta=null) {
  if (isEmpleos) {
    return {
      title:'💼 Empleo',
      subtitle:'Ofertas y solicitudes de empleo en un solo lugar.',
      resultLabel:'publicaciones de empleo',
      searchPlaceholder:'Buscar puesto, solicitud, empresa o sector...',
      emptyTitle:intentMeta?.emptyTitle || 'No hay empleos con estos filtros',
      emptyText:intentMeta?.emptyText || 'Prueba otro cantón u otro tipo de empleo.',
    }
  }

  const meta = AD_CATS.find(item => item.id === cat)
  if (meta) {
    return {
      title:`${meta.emoji} ${meta.label}`,
      subtitle:intentMeta?.label || meta.desc,
      resultLabel:'anuncios',
      searchPlaceholder:`Buscar en ${meta.label.toLowerCase()}...`,
      emptyTitle:intentMeta?.emptyTitle || `Sin anuncios de ${meta.label.toLowerCase()}`,
      emptyText:intentMeta?.emptyText || 'Prueba otros filtros o publica el primero.',
    }
  }

  return {
    title:'📣 Anuncios',
    subtitle:'Vivienda, empleo, servicios, cuidados, compraventa y trámites.',
    resultLabel:'publicaciones',
    searchPlaceholder:'Buscar vivienda, servicios, productos o trámites...',
    emptyTitle:'Sin resultados',
    emptyText:'Prueba otros filtros o publica lo que buscas.',
  }
}

function IntentTabs({ views=[], value='', onChange }) {
  return (
    <SegmentedTabs
      items={views}
      value={value}
      onChange={onChange}
      ariaLabel="Tipo de publicación"
      className="tablon-intent-tabs"
    />
  )
}

function getAdShareText(ad) {
  const meta = [fmtPrice(ad.price), formatAdLocation(ad) || ad.canton].filter(Boolean).join(' - ')
  return ['Mira este anuncio en Latido.', meta].filter(Boolean).join('\n')
}

function getJobShareText(job) {
  const meta = [job.company && job.company !== job.title ? job.company : '', job.city || job.canton].filter(Boolean).join(' - ')
  return ['Mira este empleo en Latido.', meta].filter(Boolean).join('\n')
}

function RelatedRail({ title, children, empty=false }) {
  if (empty) return null
  return (
    <div style={{ padding:'20px', borderBottom:`1px solid ${C.border}`, background:'#fff' }}>
      <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:18, color:C.text, margin:'0 0 12px' }}>{title}</h2>
      <div className="no-scroll" style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:4, margin:'0 -20px', paddingLeft:20, paddingRight:20 }}>
        {children}
      </div>
    </div>
  )
}

function RelatedAdCard({ ad, onClick }) {
  const photos = getAdPhotos(ad)
  const cat = getAdDisplayCat(ad)
  return (
    <button type="button" onClick={onClick} style={{ width:156, flex:'0 0 156px', background:'#fff', border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden', padding:0, textAlign:'left', cursor:'pointer' }}>
      <div style={{ height:112, background:C.primaryLight, display:'flex', alignItems:'center', justifyContent:'center', fontSize:34 }}>
        {photos[0] ? <img src={getThumbnailImageUrl(photos[0])} alt={ad.title} loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:'contain', display:'block' }} /> : getAdDisplayEmoji(ad)}
      </div>
      <div style={{ padding:10 }}>
        <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.text, lineHeight:1.35, margin:'0 0 6px', ...CLAMP_2 }}>{ad.title}</p>
        {ad.price && <p style={{ fontFamily:PP, fontWeight:900, fontSize:13, color:C.primary, margin:'0 0 5px', ...CLAMP_1 }}>{fmtPrice(ad.price)}</p>}
        <p style={{ fontFamily:PP, fontSize:10, color:C.light, margin:0, ...CLAMP_1 }}>{cat?.label || 'Anuncio'}</p>
      </div>
    </button>
  )
}

function RelatedJobCard({ job, onClick }) {
  const intent = getJobIntentTag(job)
  return (
    <button type="button" onClick={onClick} style={{ width:156, flex:'0 0 156px', background:'#fff', border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden', padding:0, textAlign:'left', cursor:'pointer' }}>
      <div style={{ height:112, background:C.primaryLight, display:'flex', alignItems:'center', justifyContent:'center', fontSize:34 }}>
        {job.logo_url ? <img src={getThumbnailImageUrl(job.logo_url)} onError={event => handleThumbnailImageError(event, job.logo_url)} alt={job.title || job.company} loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:'contain', display:'block' }} /> : (job.emoji || '💼')}
      </div>
      <div style={{ padding:10 }}>
        <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.text, lineHeight:1.35, margin:'0 0 6px', ...CLAMP_2 }}>{job.title || job.company}</p>
        {job.salary && <p style={{ fontFamily:PP, fontWeight:900, fontSize:13, color:C.primary, margin:'0 0 5px', ...CLAMP_1 }}>{fmtPrice(job.salary)}</p>}
        <p style={{ fontFamily:PP, fontSize:10, color:C.light, margin:0, ...CLAMP_1 }}>{intent.label}</p>
      </div>
    </button>
  )
}

/* ── Compact ad card (list view) ────────────────────────── */
function AdCard({ ad, onClick, isFav, onToggleFav, avatarSrc, reviews=[] }) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const dateStr = ad.ts || (ad.created_at ? new Date(ad.created_at).toLocaleDateString('es-ES',{day:'numeric',month:'short'}) : '')
  const photos = getAdPhotos(ad)
  const coverPhoto = photos[0]
  const location = formatAdLocation(ad)
  const displayEmoji = getAdDisplayEmoji(ad)
  const metaBits = [ad.user_name || ad.user || 'Usuario', location || ad.canton, dateStr].filter(Boolean)
  const rating = averageRating(reviews)
  const showReviews = isReviewableAd(ad)
  const intent = getAdIntentTag(ad)
  return (
    <Card onClick={onClick} aria-label={`Ver anuncio: ${ad.title}`} variant="outlined" padding="none" style={{ ...LIST_CARD_STYLE, minHeight:136 }}>
      <div style={LIST_THUMB_STYLE}>
        {coverPhoto ? (
          <button
            type="button"
            onClick={event => {
              event.stopPropagation()
              setLightboxOpen(true)
            }}
            aria-label="Ampliar fotos del anuncio"
            style={{ width:'100%', height:'100%', padding:0, border:'none', background:'transparent', cursor:'zoom-in', display:'block' }}
          >
            <img src={getThumbnailImageUrl(coverPhoto)} alt={ad.title} loading="lazy" decoding="async" style={LIST_MEDIA_STYLE}/>
          </button>
        ) : (
          <div style={{ ...LIST_FALLBACK_STYLE, background:C.primaryLight }}>
            {displayEmoji}
          </div>
        )}
        {photos.length > 1 && (
          <span style={{ position:'absolute', left:8, bottom:8, fontFamily:PP, fontSize:9, fontWeight:800, color:'#fff', background:'rgba(15,23,42,0.72)', borderRadius:999, padding:'3px 7px' }}>
            Fotos {photos.length}
          </span>
        )}
      </div>
      {coverPhoto && (
        <ImageLightbox
          open={lightboxOpen}
          photos={photos}
          initialIndex={0}
          onClose={() => setLightboxOpen(false)}
          title={ad.title || 'Foto del anuncio'}
        />
      )}
      <div style={{ flex:1, minWidth:0, padding:'1px 42px 1px 0', display:'flex', flexDirection:'column' }}>
        <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:14, color:C.text, lineHeight:1.32, margin:'0 0 4px', ...CLAMP_2 }}>{ad.title}</h3>
        {ad.price && <span style={{ display:'block', maxWidth:'100%', fontFamily:PP, fontSize:14, fontWeight:800, color:C.primary, lineHeight:1.15, marginBottom:5, ...CLAMP_1 }}>{fmtPrice(ad.price)}</span>}
        {ad.desc && <p style={{ fontFamily:PP, fontSize:12, color:C.mid, lineHeight:1.45, margin:'0 0 7px', whiteSpace:'pre-line', ...CLAMP_2 }}>{ad.desc}</p>}
        {showReviews && (
          <div style={{ display:'flex', alignItems:'center', gap:7, margin:'0 0 7px', flexWrap:'wrap', minWidth:0 }}>
            {rating !== null ? (
              <Stars rating={rating} size={13} showNumber count={reviews.length} />
            ) : (
              <span style={{ fontFamily:PP, fontSize:10, color:C.light }}>Sin reseñas aún</span>
            )}
          </div>
        )}
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:7 }}>
          {intent && <Tag bg={intent.bg} color={intent.color}>{intent.emoji} {intent.shortLabel}</Tag>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:7, marginTop:'auto', minWidth:0 }}>
          <Avatar name={ad.user_name || ad.user} size={18} src={avatarSrc}/>
          <span style={{ fontFamily:PP, fontSize:10, color:C.light, lineHeight:1.3, ...CLAMP_1 }}>{metaBits.join(' - ')}</span>
        </div>
      </div>
      <FavoriteButton isFav={isFav} onClick={onToggleFav} style={{ position:'absolute', top:10, right:10, width:34, height:34, fontSize:17 }} />
    </Card>
  )
}

/* ── Full ad detail (inside Sheet) ─────────────────────── */
function AdDetail({ ad, user, displayName='', userCanton='', avatarSrc, relatedAds=[], onOpenRelatedAd, reviews=[], onAddReview, isFav=false, onToggleFavorite }) {
  const navigate = useNavigate()
  const reviewsRef = useRef(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [savingReview, setSavingReview] = useState(false)
  const normalizedCat = getAdCategoryId(ad)
  const cat = getAdDisplayCat(ad)
  const cc  = CAT_COLORS[normalizedCat] || { bg:C.primaryLight, tc:C.primary }
  const isOwnAd = user && ad.user_id === user.id
  const recipientName = encodeURIComponent((ad.user_name || ad.user || '').trim())
  const photos = getAdPhotos(ad)
  const coverPhoto = photos[0]
  const location = formatAdLocation(ad)
  const subOption = getAdSubOption(normalizedCat, ad.sub)
  const showReviews = isReviewableAd(ad)
  const rating = averageRating(reviews)
  const ownReview = user?.id ? reviews.find(review => review.user_id === user.id) : null
  const intent = getAdIntentTag(ad)

  useEffect(() => {
    setShowReviewForm(false)
    setSavingReview(false)
  }, [ad.id])

  const handleSubmitReview = async review => {
    setSavingReview(true)
    const saved = await onAddReview?.(ad, review)
    setSavingReview(false)
    if (saved !== false) setShowReviewForm(false)
  }

  const scrollToReviews = () => {
    reviewsRef.current?.scrollIntoView({ behavior:'smooth', block:'start' })
  }

  return (
    <div style={{ background:'#fff' }}>
      <div style={{ background:'#fff', borderBottom:`1px solid ${C.border}` }}>
        {photos.length > 1 ? (
          <div style={{ padding:'10px 14px 0' }}>
            <PhotoGallery photos={photos.slice(1)} mainPhoto={coverPhoto} />
          </div>
        ) : coverPhoto ? (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            aria-label="Ampliar foto del anuncio"
            style={{ width:'100%', height:'min(58vh, 460px)', minHeight:260, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', border:'none', padding:0, cursor:'zoom-in', position:'relative' }}
          >
            <img src={coverPhoto} alt={ad.title} loading="eager" fetchpriority="high" decoding="async" style={{ width:'100%', height:'100%', objectFit:'contain', display:'block' }}/>
          </button>
        ) : (
          <div style={{ height:260, background:C.primaryLight, display:'flex', alignItems:'center', justifyContent:'center', fontSize:64 }}>
            {getAdDisplayEmoji(ad)}
          </div>
        )}
      </div>
      {coverPhoto && (
        <ImageLightbox
          open={lightboxOpen}
          photos={photos}
          initialIndex={0}
          onClose={() => setLightboxOpen(false)}
          title={ad.title || 'Foto del anuncio'}
        />
      )}

      <div style={{ padding:'22px 20px 16px', borderBottom:`1px solid ${C.border}` }}>
        <div style={{ borderBottom:`1px solid ${C.borderLight}`, paddingBottom:10, marginBottom:9 }}>
          <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:21, color:C.text, lineHeight:1.25, margin:0, ...WRAPPING_TEXT }}>{ad.title}</h1>
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', borderBottom:`1px solid ${C.borderLight}`, paddingBottom:10, marginBottom:12 }}>
          {intent && <Tag bg={intent.bg} color={intent.color}>{intent.emoji} {intent.shortLabel}</Tag>}
          <Tag bg={cc.bg} color={cc.tc}>{cat?.emoji} {cat?.label}</Tag>
          {ad.sub && <Tag bg={C.bg} color={C.mid}>{subOption?.emoji ? `${subOption.emoji} ` : ''}{subOption?.label || ad.sub}</Tag>}
          <PrivacyTag privacy={ad.privacy}/>
          {ad.verified && <Tag bg="#D1FAE5" color="#065F46">✓ Verificada</Tag>}
        </div>
        <div style={{ display:'flex', gap:9, alignItems:'center', minWidth:0 }}>
          <Avatar name={ad.user_name || ad.user} size={34} src={avatarSrc}/>
          <div style={{ minWidth:0, flex:1 }}>
            <p style={{ fontFamily:PP, fontSize:13, fontWeight:700, color:C.text, margin:'0 0 2px', ...WRAPPING_TEXT }}>{ad.user_name || ad.user || 'Usuario'}</p>
            <p style={{ fontFamily:PP, fontSize:12, color:C.light, lineHeight:1.4, margin:0, ...WRAPPING_TEXT }}>
              {location || ad.canton}
              {(ad.ts || ad.created_at) ? ` - ${ad.ts || new Date(ad.created_at).toLocaleDateString('es-ES',{day:'numeric',month:'short'})}` : ''}
            </p>
          </div>
          {showReviews && rating !== null && (
            <button
              type="button"
              onClick={scrollToReviews}
              aria-label={`Ver ${reviews.length} reseña${reviews.length !== 1 ? 's' : ''}`}
              style={{ marginLeft:'auto', flexShrink:0, display:'inline-flex', alignItems:'center', gap:7, fontFamily:PP, fontWeight:900, fontSize:15, color:C.text, background:'#FFFBEB', border:'1.5px solid #FBBF24', borderRadius:999, padding:'7px 13px', cursor:'pointer' }}
            >
              <span style={{ fontSize:18, lineHeight:1, color:'#F59E0B' }}>★</span>
              <span>{rating}</span>
            </button>
          )}
        </div>
      </div>

      {ad.price && (
        <div style={{ padding:'18px 20px 14px', borderBottom:`1px solid ${C.border}` }}>
          <p style={{ fontFamily:PP, fontSize:12, color:C.light, margin:'0 0 4px' }}>{normalizedCat === 'vivienda' && ad.type === 'busca' ? 'Presupuesto máximo' : normalizedCat === 'vivienda' ? 'Alquiler' : 'Precio'}</p>
          <p style={{ fontFamily:PP, fontWeight:900, fontSize:28, color:C.primary, lineHeight:1.1, margin:0, ...WRAPPING_TEXT }}>{fmtPrice(ad.price)}</p>
        </div>
      )}

      {normalizedCat === 'vivienda' && [ad.available_from, ad.rooms, ad.household_size, ad.furnished, ad.pets_allowed].some(value => value !== null && value !== undefined && value !== '') && (
        <div style={{ padding:'18px 20px', borderBottom:`1px solid ${C.border}` }}>
          <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:18, color:C.text, margin:'0 0 12px' }}>Datos de la vivienda</h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(135px, 1fr))', gap:9 }}>
            {ad.available_from && <Tag bg={C.bg} color={C.mid}>📅 Desde {new Date(`${ad.available_from}T00:00:00`).toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})}</Tag>}
            {ad.rooms != null && <Tag bg={C.bg} color={C.mid}>🚪 {ad.rooms} habitaciones</Tag>}
            {ad.household_size != null && <Tag bg={C.bg} color={C.mid}>👥 {ad.household_size} personas</Tag>}
            {ad.furnished != null && <Tag bg={C.bg} color={C.mid}>🛋️ {ad.furnished ? 'Amueblada' : 'Sin amueblar'}</Tag>}
            {ad.pets_allowed != null && <Tag bg={C.bg} color={C.mid}>🐾 {ad.type === 'busca' ? (ad.pets_allowed ? 'Con mascota' : 'Sin mascota') : (ad.pets_allowed ? 'Mascotas permitidas' : 'No admite mascotas')}</Tag>}
          </div>
        </div>
      )}

      {ad.desc && (
        <div style={{ padding:'20px', borderBottom:`1px solid ${C.border}` }}>
          <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:18, color:C.text, margin:'0 0 10px' }}>Descripción</h2>
          <p style={{ fontFamily:PP, fontSize:14, color:C.mid, lineHeight:1.75, margin:0, whiteSpace:'pre-line', ...WRAPPING_TEXT }}>{ad.desc}</p>
        </div>
      )}

      {showReviews && (
        <div ref={reviewsRef} style={{ padding:'20px', borderBottom:`1px solid ${C.border}`, scrollMarginTop:70 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:14 }}>
            <div>
              <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:18, color:C.text, margin:'0 0 4px' }}>Reseñas</h2>
              {rating !== null ? (
                <Stars rating={rating} size={15} showNumber count={reviews.length} />
              ) : (
                <p style={{ fontFamily:PP, fontSize:12, color:C.light, margin:0 }}>Sin reseñas todavía</p>
              )}
            </div>
            {!showReviewForm && (
              <button
                type="button"
                onClick={() => {
                  if (!user) {
                    toast.error('Inicia sesión para escribir una reseña')
                    return
                  }
                  setShowReviewForm(true)
                }}
                style={{ fontFamily:PP, fontWeight:700, fontSize:12, background:C.primaryLight, color:C.primary, border:`1px solid ${C.primaryMid}`, borderRadius:999, padding:'9px 12px', cursor:'pointer', flexShrink:0 }}
              >
                {ownReview ? 'Editar mi reseña' : 'Escribir'}
              </button>
            )}
          </div>

          {reviews.length > 0 && (
            <div style={{ background:C.bg, borderRadius:16, padding:'16px', marginBottom:16, display:'flex', gap:20, alignItems:'center' }}>
              <div style={{ textAlign:'center' }}>
                <p style={{ fontFamily:PP, fontWeight:900, fontSize:34, color:C.text, margin:'0 0 4px', letterSpacing:-1 }}>{rating}</p>
                <Stars rating={rating} size={15} />
                <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:'4px 0 0' }}>{reviews.length} reseña{reviews.length !== 1 ? 's' : ''}</p>
              </div>
              <div style={{ flex:1 }}>
                {[5, 4, 3, 2, 1].map(stars => {
                  const count = reviews.filter(review => review.stars === stars).length
                  const width = reviews.length ? Math.round((count / reviews.length) * 100) : 0
                  return (
                    <div key={stars} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                      <span style={{ fontFamily:PP, fontSize:10, color:C.mid, width:8 }}>{stars}</span>
                      <span style={{ fontSize:10, color:'#F59E0B' }}>★</span>
                      <div style={{ flex:1, height:6, background:C.border, borderRadius:3, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${width}%`, background:'#F59E0B', borderRadius:3, transition:'width .4s' }} />
                      </div>
                      <span style={{ fontFamily:PP, fontSize:10, color:C.light, width:24, textAlign:'right' }}>{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {showReviewForm && (
            <div style={{ opacity:savingReview ? 0.7 : 1, pointerEvents:savingReview ? 'none' : 'auto' }}>
              <ReviewForm
                initialReview={ownReview}
                defaultName={displayName}
                defaultCanton={userCanton}
                lockName
                lockCanton
                submitLabel={ownReview ? 'Guardar cambios' : 'Publicar reseña'}
                onSubmit={handleSubmitReview}
                onCancel={() => setShowReviewForm(false)}
              />
            </div>
          )}

          <ReviewList
            reviews={reviews}
            emptyTitle="Sin reseñas todavía"
            emptyText="Sé la primera persona en contar su experiencia."
          />
        </div>
      )}

      <RelatedRail title="Anuncios parecidos" empty={!relatedAds.length}>
        {relatedAds.map(item => (
          <RelatedAdCard key={item.id} ad={item} onClick={() => onOpenRelatedAd?.(item)} />
        ))}
      </RelatedRail>

      <DetailActionBar
        primaryLabel={!isOwnAd ? (user ? 'Enviar mensaje' : 'Inicia sesión para contactar') : ''}
        onPrimaryClick={!isOwnAd ? () => navigate(user ? `/mensajes?adId=${ad.id}${recipientName ? `&recipientName=${recipientName}` : ''}` : '/auth') : undefined}
        ownerLabel={isOwnAd ? 'Este anuncio es tuyo' : ''}
        primaryColor={C.primary}
        share={{
          title:ad.title || 'Anuncio en Latido',
          text:getAdShareText(ad),
          url:getAdPath(ad),
          ariaLabel:'Enviar anuncio',
        }}
        favorite={{
          isFav,
          onClick:onToggleFavorite,
        }}
        report={!isOwnAd ? {
          contentType:'listing',
          contentId:ad.id,
          ownerId:ad.user_id,
          title:'Reportar anuncio',
          metadata:{ title:ad.title, cat:normalizedCat, sub:ad.sub },
        } : null}
      />

    </div>
  )
}

/* ── Compact job card (list view) ───────────────────────── */
function JobCard({ job, onClick, isFav, onToggleFav, avatarSrc, authorName }) {
  const languages = job.lang || (Array.isArray(job.languages) ? job.languages.join(' · ') : job.languages)
  const intent = getJobIntentTag(job)
  const isSeekingJob = intent.id === 'busca'
  const mediaSrc = job.logo_url
  const dateStr = job.ts || (job.created_at ? new Date(job.created_at).toLocaleDateString('es-ES',{day:'numeric',month:'short'}) : '')
  const author = authorName || job.user_name || job.user || 'Usuario'
  const metaBits = [author, job.city || job.canton, dateStr].filter(Boolean)
  const employmentProfile = isSeekingJob ? employmentProfileFromJob(job) : null
  return (
    <Card onClick={onClick} aria-label={`Ver empleo: ${job.title || job.company}`} variant="outlined" padding="none" style={{ ...LIST_CARD_STYLE, minHeight:122 }}>
      <div style={{ ...LIST_THUMB_STYLE, background:C.primaryLight }}>
        {mediaSrc
          ? <img src={getThumbnailImageUrl(mediaSrc)} onError={event => handleThumbnailImageError(event, mediaSrc)} alt={job.company || job.title} loading="lazy" decoding="async" style={LIST_MEDIA_STYLE} />
          : <div style={LIST_FALLBACK_STYLE}>{job.emoji || '💼'}</div>}
      </div>
      <div style={{ flex:1, minWidth:0, padding:'1px 42px 1px 0', display:'flex', flexDirection:'column' }}>
        <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:14, color:C.text, lineHeight:1.32, margin:'0 0 4px', ...CLAMP_2 }}>{job.title || job.company}</h3>
        {job.salary && <p style={{ fontFamily:PP, fontSize:14, fontWeight:800, color:C.primary, lineHeight:1.15, margin:'0 0 5px', ...CLAMP_1 }}>{fmtPrice(job.salary)}</p>}
        {job.company && job.company !== job.title && <p style={{ fontFamily:PP, fontSize:11, color:C.mid, lineHeight:1.35, margin:'0 0 3px', ...CLAMP_1 }}>{isSeekingJob ? '👤' : '🏢'} {job.company}</p>}
        {languages && <p style={{ fontFamily:PP, fontSize:11, color:C.light, lineHeight:1.35, margin:'0 0 7px', ...CLAMP_1 }}>{languages}</p>}
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginTop:'auto' }}>
          <Tag bg={intent.bg} color={intent.color}>{intent.emoji} {intent.label}</Tag>
          {isSeekingJob && <EmploymentLevelBadge profile={employmentProfile} levelId={job.employment_level} />}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:7, marginTop:7, minWidth:0 }}>
          <Avatar name={author} size={18} src={avatarSrc}/>
          <span style={{ fontFamily:PP, fontSize:10, color:C.light, lineHeight:1.3, ...CLAMP_1 }}>{metaBits.join(' - ')}</span>
        </div>
      </div>
      <FavoriteButton isFav={isFav} onClick={onToggleFav} style={{ position:'absolute', top:10, right:10, width:34, height:34, fontSize:17 }} />
    </Card>
  )
}

/* ── Full job detail (inside Sheet) ─────────────────────── */
function JobDetail({ job, user, avatarSrc, authorName, relatedJobs=[], onOpenRelatedJob, isFav=false, onToggleFavorite }) {
  const navigate = useNavigate()
  const languages = job.lang || (Array.isArray(job.languages) ? job.languages.join(' · ') : job.languages)
  const isOwnJob = user && job.user_id === user.id
  const intent = getJobIntentTag(job)
  const isSeekingJob = intent.id === 'busca'
  const author = authorName || job.user_name || job.user || 'Usuario'
  const dateStr = job.ts || (job.created_at ? new Date(job.created_at).toLocaleDateString('es-ES',{day:'numeric',month:'short'}) : '')
  const employmentProfile = employmentProfileFromJob(job)
  const employmentLevel = getEmploymentProfileLevel(employmentProfile)
  const employmentRows = getEmploymentProfileRows(employmentProfile)
  const hasProfessionalProfile = isSeekingJob && hasEmploymentProfileData(employmentProfile)

  return (
    <div style={{ background:'#fff' }}>
      <div style={{ background:'#fff', borderBottom:`1px solid ${C.border}` }}>
        {job.logo_url ? (
          <div style={{ width:'100%', height:'min(58vh, 460px)', minHeight:260, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', padding:0, boxSizing:'border-box' }}>
            <img src={job.logo_url} alt={job.company || job.title} loading="eager" fetchpriority="high" decoding="async" style={{ width:'100%', height:'100%', objectFit:'contain', display:'block' }} />
          </div>
        ) : (
          <div style={{ height:240, background:C.primaryLight, display:'flex', alignItems:'center', justifyContent:'center', fontSize:70 }}>
            {job.emoji || '💼'}
          </div>
        )}
      </div>

      <div style={{ padding:'22px 20px 16px', borderBottom:`1px solid ${C.border}` }}>
        <div style={{ borderBottom:`1px solid ${C.borderLight}`, paddingBottom:10, marginBottom:9 }}>
          <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:21, color:C.text, lineHeight:1.25, margin:0, ...WRAPPING_TEXT }}>{job.title || job.company}</h1>
          {job.company && job.company !== job.title && (
            <p style={{ fontFamily:PP, fontSize:13, fontWeight:700, color:C.mid, margin:'6px 0 0', lineHeight:1.4, ...WRAPPING_TEXT }}>{isSeekingJob ? 'Solicitante' : 'Empresa'}: {job.company}</p>
          )}
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', borderBottom:`1px solid ${C.borderLight}`, paddingBottom:10, marginBottom:12 }}>
          <Tag bg={intent.bg} color={intent.color}>{intent.emoji} {intent.label}</Tag>
          {job.type && <Tag bg={job.type==='Full-time'?C.primaryLight:'#D1FAE5'} color={job.type==='Full-time'?C.primary:'#065F46'}>{job.type}</Tag>}
          {job.sector && <Tag bg={C.bg} color={C.mid}>{job.sector}</Tag>}
        </div>
        <div style={{ display:'flex', gap:9, alignItems:'center', minWidth:0 }}>
          <Avatar name={author} size={34} src={avatarSrc}/>
          <div style={{ minWidth:0 }}>
            <p style={{ fontFamily:PP, fontSize:13, fontWeight:700, color:C.text, margin:'0 0 2px', ...WRAPPING_TEXT }}>{author}</p>
            <p style={{ fontFamily:PP, fontSize:12, color:C.light, lineHeight:1.4, margin:0, ...WRAPPING_TEXT }}>
              {job.city || job.canton}{dateStr ? ` - ${dateStr}` : ''}
            </p>
          </div>
        </div>
      </div>

      {job.salary && (
        <div style={{ padding:'18px 20px 14px', borderBottom:`1px solid ${C.border}` }}>
          <p style={{ fontFamily:PP, fontSize:12, color:C.light, margin:'0 0 4px' }}>Salario</p>
          <p style={{ fontFamily:PP, fontWeight:900, fontSize:28, color:C.primary, lineHeight:1.1, margin:0, ...WRAPPING_TEXT }}>{fmtPrice(job.salary)}</p>
        </div>
      )}

      {hasProfessionalProfile && (
        <div style={{ padding:'20px', borderBottom:`1px solid ${C.border}` }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:employmentLevel ? 5 : 12 }}>
            <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:18, color:C.text, margin:0 }}>Perfil profesional</h2>
            <EmploymentLevelBadge profile={employmentProfile} levelId={job.employment_level} />
          </div>
          {employmentLevel && (
            <p style={{ fontFamily:PP, fontSize:10.5, color:C.light, lineHeight:1.5, margin:'0 0 13px' }}>
              {employmentLevel.shortDescription}
            </p>
          )}
          <dl style={{ margin:0 }}>
            {employmentRows.map((row, index) => (
              <div key={row.key} style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:14, padding:'9px 0', borderTop:index ? `1px solid ${C.borderLight}` : 'none' }}>
                <dt style={{ flexShrink:0, fontFamily:PP, fontSize:11, fontWeight:700, color:C.light }}>{row.label}</dt>
                <dd style={{ margin:0, fontFamily:PP, fontSize:11, fontWeight:600, color:C.text, textAlign:'right', lineHeight:1.45, ...WRAPPING_TEXT }}>{row.value}</dd>
              </div>
            ))}
          </dl>
          <p style={{ fontFamily:PP, fontSize:9.5, color:C.light, lineHeight:1.55, margin:'10px 0 0', paddingTop:10, borderTop:`1px solid ${C.borderLight}` }}>
            Nivel orientativo basado en datos declarados por la persona. Latido no verifica individualmente el perfil ni garantiza la contratación.
          </p>
        </div>
      )}

      {(job.desc || job.description || (!hasProfessionalProfile && (languages || job.experience_years != null || job.available_from || job.driving_license != null))) && (
        <div style={{ padding:'20px', borderBottom:`1px solid ${C.border}` }}>
          <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:18, color:C.text, margin:'0 0 10px' }}>Detalles</h2>
          {!hasProfessionalProfile && languages && <p style={{ fontFamily:PP, fontSize:13, color:C.mid, lineHeight:1.6, margin:'0 0 8px', ...WRAPPING_TEXT }}>{isSeekingJob ? 'Idiomas' : 'Idiomas requeridos'}: {languages}</p>}
          {!hasProfessionalProfile && job.experience_years != null && <p style={{ fontFamily:PP, fontSize:13, color:C.mid, lineHeight:1.6, margin:'0 0 8px', ...WRAPPING_TEXT }}>Experiencia: {job.experience_years} {Number(job.experience_years) === 1 ? 'año' : 'años'}</p>}
          {!hasProfessionalProfile && job.available_from && <p style={{ fontFamily:PP, fontSize:13, color:C.mid, lineHeight:1.6, margin:'0 0 8px', ...WRAPPING_TEXT }}>Disponible desde: {new Date(`${job.available_from}T00:00:00`).toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}</p>}
          {!hasProfessionalProfile && job.driving_license != null && <p style={{ fontFamily:PP, fontSize:13, color:C.mid, lineHeight:1.6, margin:'0 0 8px', ...WRAPPING_TEXT }}>Carnet de conducir: {job.driving_license ? 'Sí' : 'No'}</p>}
      {(job.desc || job.description) && (
            <p style={{ fontFamily:PP, fontSize:14, color:C.mid, lineHeight:1.75, margin:0, whiteSpace:'pre-line', ...WRAPPING_TEXT }}>
          {job.desc || job.description}
        </p>
      )}
        </div>
      )}

      <RelatedRail title="Empleos parecidos" empty={!relatedJobs.length}>
        {relatedJobs.map(item => (
          <RelatedJobCard key={item.id} job={item} onClick={() => onOpenRelatedJob?.(item)} />
        ))}
      </RelatedRail>

      <DetailActionBar
        primaryLabel={!isOwnJob ? (user ? 'Enviar mensaje' : 'Inicia sesión para contactar') : ''}
        onPrimaryClick={!isOwnJob ? () => navigate(user ? `/mensajes?jobId=${job.id}` : '/auth') : undefined}
        ownerLabel={isOwnJob ? 'Este anuncio es tuyo' : ''}
        primaryColor={C.primary}
        share={{
          title:job.title || job.company || 'Empleo en Latido',
          text:getJobShareText(job),
          url:getJobPath(job),
          ariaLabel:'Enviar empleo',
        }}
        favorite={{
          isFav,
          onClick:onToggleFavorite,
        }}
        report={!isOwnJob ? {
          contentType:'job',
          contentId:job.id,
          ownerId:job.user_id,
          title:'Reportar empleo',
          metadata:{ title:job.title, company:job.company, job_intent:getJobIntentId(job), sector:job.sector },
        } : null}
      />

    </div>
  )
}

/* ── Portal card ─────────────────────────────────────────── */
function PortalCard({ portal, defaultEmoji = '🏠', onClick }) {
  return (
    <button onClick={onClick} style={{ ...LIST_CARD_STYLE, minHeight:106, borderRadius:14 }}>
      <div style={{ ...LIST_THUMB_STYLE, background:C.primaryLight, fontSize:24 }}>
        {portal.photo_url
          ? <img src={getThumbnailImageUrl(portal.photo_url)} alt={portal.name} loading="lazy" decoding="async" style={LIST_MEDIA_STYLE} />
          : <span>{defaultEmoji}</span>}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3, flexWrap:'wrap' }}>
          <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:15, color:C.text, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{portal.name}</h3>
        </div>
        {portal.city && <p style={{ fontFamily:PP, fontSize:12, color:C.light, margin:'0 0 2px' }}>📍 {portal.city}</p>}
        <p style={{ fontFamily:PP, fontSize:12, color:C.light, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{portal.description}</p>
      </div>
      <span style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.primary, flexShrink:0 }}>Ver →</span>
    </button>
  )
}

/* ── Portal detail (inside Sheet) ───────────────────────── */
function PortalDetail({ portal, defaultEmoji = '🏠' }) {
  return (
    <div style={{ background:'#fff' }}>
      <div style={{ background:'#fff', borderBottom:`1px solid ${C.border}` }}>
        {portal.photo_url ? (
          <div style={{ width:'100%', height:'min(58vh, 460px)', minHeight:260, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', padding:0, boxSizing:'border-box' }}>
            <img src={portal.photo_url} alt={portal.name} loading="eager" fetchpriority="high" decoding="async" style={{ width:'100%', height:'100%', objectFit:'contain', display:'block' }} />
          </div>
        ) : (
          <div style={{ height:240, background:C.primaryLight, display:'flex', alignItems:'center', justifyContent:'center', fontSize:70 }}>{defaultEmoji}</div>
        )}
      </div>
      <div style={{ padding:'22px 20px 16px', borderBottom:`1px solid ${C.border}` }}>
        <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:26, color:C.text, margin:'0 0 8px', lineHeight:1.18, ...WRAPPING_TEXT }}>{portal.name}</h1>
        {portal.city && <p style={{ fontFamily:PP, fontSize:13, color:C.light, margin:0 }}>{portal.city}</p>}
      </div>
      {portal.description && (
        <div style={{ padding:'20px', borderBottom:`1px solid ${C.border}` }}>
          <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:18, color:C.text, margin:'0 0 10px' }}>Descripción</h2>
          <p style={{ fontFamily:PP, fontSize:14, color:C.mid, margin:0, lineHeight:1.75, whiteSpace:'pre-line', ...WRAPPING_TEXT }}>{portal.description}</p>
        </div>
      )}
      {portal.website && (
        <div style={{ padding:'18px 20px 24px' }}>
          <a href={portal.website} target="_blank" rel="noreferrer"
            style={{ width:'100%', fontFamily:PP, fontWeight:800, fontSize:14, background:C.primary, color:'#fff', textDecoration:'none', padding:'15px 16px', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxSizing:'border-box' }}>
            Visitar sitio web
          </a>
        </div>
      )}
    </div>
  )
}

/* ── Main page ──────────────────────────────────────────── */
export default function Tablon() {
  const navigate = useNavigate()
  const { adSlug, jobSlug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isLoggedIn, user, displayName, userCanton } = useAuth()
  const { isFavorite, toggleFavorite } = useFavorites()
  const [userProfiles, setUserProfiles] = useState(new Map())
  const [ads, setAds] = useState(() => TABLON_CACHE.publicAds || [])
  const [jobs, setJobs] = useState(() => TABLON_CACHE.jobs || [])
  const [housingPortals, setHousingPortals] = useState([])
  const [employmentPortals, setEmploymentPortals] = useState([])
  const [loading, setLoading] = useState(() => !(TABLON_CACHE.publicAds || TABLON_CACHE.jobs))
  const requestedSearch = searchParams.get('q') || ''
  const [search, setSearch] = useState(requestedSearch)
  const [resolvedSearch, setResolvedSearch] = useState({
    active:false,
    ready:false,
    query:'',
    results:[],
  })
  const [showFilters, setShowFilters] = useState(false)
  const [filterDraft, setFilterDraft] = useState({
    category:'',
    canton:'',
    plz:'',
    privacy:'',
    jobType:'',
    employmentLevel:'',
    priceRange:'',
    sort:'newest',
  })
  const [portalsOpen, setPortalsOpen] = useState(false)
  const [selectedAd, setSelectedAd] = useState(null)
  const [selectedJob, setSelectedJob] = useState(null)
  const [selectedPortal, setSelectedPortal] = useState(null)
  const [adReviews, setAdReviews] = useState({})
  const deferredSearch = useDeferredValue(search.trim())
  const searchProfile = useMemo(() => buildSearchProfile(deferredSearch), [deferredSearch])

  const cat      = normalizeAdCat(searchParams.get('cat') || '')
  const type     = searchParams.get('type') || ''
  const canton   = searchParams.get('canton') || ''
  const plz      = searchParams.get('plz') || ''
  const privacy  = searchParams.get('privacy') || ''
  const jobType  = searchParams.get('jobType') || ''
  const employmentLevel = EMPLOYMENT_LEVEL_IDS.has(searchParams.get('employmentLevel'))
    ? searchParams.get('employmentLevel')
    : ''
  const jobIntent = searchParams.get('jobIntent') || ''
  const legacyMaxPrice = searchParams.get('maxPrice') || ''
  const priceRange = searchParams.get('priceRange') || ''
  const sortOrder = SORT_OPTIONS.some(option => option.id === searchParams.get('sort'))
    ? searchParams.get('sort')
    : 'newest'
  useEffect(() => {
    if (searchParams.get('sort') !== 'relevance') return
    const next = new URLSearchParams(searchParams)
    next.delete('sort')
    setSearchParams(next, { replace:true })
  }, [searchParams, setSearchParams])
  const hasPriceFilter = Boolean(priceRange || legacyMaxPrice) && !employmentLevel
  const openAdId  = searchParams.get('openAd') || ''
  const openJobId = searchParams.get('openJob') || ''
  const routeAdId = adSlug ? getIdFromSlug(adSlug) : ''
  const routeJobId = jobSlug ? getIdFromSlug(jobSlug) : ''
  const targetOpenAdId = openAdId || routeAdId
  const targetOpenJobId = openJobId || routeJobId
  const savedMatchId = searchParams.get('savedMatch') || ''
  const savedSearchId = searchParams.get('savedSearch') || ''
  const hasResolvedSearch = Boolean(
    deferredSearch
    && resolvedSearch.active
    && resolvedSearch.ready
    && resolvedSearch.query === deferredSearch
  )
  const resolvedSearchRank = useMemo(() => {
    const ranks = new Map()
    ;(resolvedSearch.results || []).forEach((result, index) => {
      ranks.set(`${result.type}:${result.id}`, index)
    })
    return ranks
  }, [resolvedSearch.results])
  const getResolvedRank = (typeKey, id) =>
    resolvedSearchRank.get(`${typeKey}:${id}`) ?? Number.MAX_SAFE_INTEGER
  const getJobResolvedRank = job => Math.min(
    getResolvedRank('job', job.id),
    getResolvedRank('ad', job.id),
  )

  const isEmpleos  = cat === 'empleo'
  const categoryIntentViews = getCategoryIntentViews(cat)
  const toolbarIntentViews = cat ? categoryIntentViews : GENERAL_INTENT_VIEWS
  const requestedCategoryIntent = isEmpleos ? jobIntent : type
  const activeCategoryIntent = cat
    ? categoryIntentViews.some(view => view.id === requestedCategoryIntent)
      ? requestedCategoryIntent
      : getDefaultCategoryIntent(cat)
    : type
  const activeToolbarIntent = cat
    ? activeCategoryIntent
    : ['busca', 'ofrece'].includes(type) ? type : 'ofrece'
  const activeJobIntent = isEmpleos
    ? activeCategoryIntent
    : ['busca', 'ofrece'].includes(type)
      ? type
      : 'ofrece'
  const canFilterEmploymentLevel = (!cat || isEmpleos) && activeJobIntent === 'busca'
  const activeAdIntent = !isEmpleos && cat ? activeCategoryIntent : type
  const activeIntentMeta = getCategoryIntentMeta(cat, activeCategoryIntent)
  const isCleanAdRoute = !!routeAdId
  const isCleanJobRoute = !!routeJobId

  useEffect(() => {
    if (requestedSearch) setSearch(requestedSearch)
  }, [requestedSearch])

  useEffect(() => {
    if (!user?.id) return
    if (savedMatchId) void markSavedSearchMatchOpened(savedMatchId, user.id)
    else if (savedSearchId) void markSavedSearchDigestOpened(savedSearchId, user.id)
  }, [savedMatchId, savedSearchId, user?.id])

  const scrollPageTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }

  const setIntentView = value => {
    const next = new URLSearchParams(searchParams)
    if (isEmpleos) {
      next.set('jobIntent', value)
      next.delete('type')
    } else {
      next.set('type', value)
      next.delete('jobIntent')
    }
    if (value !== 'busca') next.delete('employmentLevel')
    next.delete('openAd')
    next.delete('openJob')
    setSearchParams(next)
    setShowFilters(false)
    scrollPageTop()
  }

  const openFilters = () => {
    setFilterDraft({
      category:cat,
      canton,
      plz,
      privacy:isEmpleos ? '' : privacy,
      jobType:isEmpleos ? jobType : '',
      employmentLevel:canFilterEmploymentLevel ? employmentLevel : '',
      priceRange:isEmpleos || employmentLevel ? '' : priceRange,
      sort:sortOrder,
    })
    setShowFilters(true)
  }

  const toggleFilters = () => {
    if (showFilters) {
      setShowFilters(false)
      return
    }
    openFilters()
  }

  const setSortView = value => {
    const next = new URLSearchParams(searchParams)
    if (value && value !== 'newest') next.set('sort', value)
    else next.delete('sort')
    next.delete('openAd')
    next.delete('openJob')
    setSearchParams(next, { replace:true })
    scrollPageTop()
  }

  const updateFilterDraft = (key, value) => {
    setFilterDraft(current => {
      const next = { ...current, [key]:value }
      if (key === 'employmentLevel' && value) next.priceRange = ''
      if (key === 'priceRange' && value) next.employmentLevel = ''
      return next
    })
  }

  const applyFilterDraft = () => {
    const next = new URLSearchParams(searchParams)
    const nextCategory = normalizeAdCat(filterDraft.category)
    const categoryChanged = nextCategory !== cat
    FILTER_PARAM_KEYS.forEach(key => next.delete(key))
    next.delete('openAd')
    next.delete('openJob')

    if (nextCategory) next.set('cat', nextCategory)
    else next.delete('cat')

    if (categoryChanged) {
      next.delete('type')
      next.delete('jobIntent')
      if (nextCategory === 'empleo') {
        next.set('jobIntent', getDefaultCategoryIntent('empleo'))
      } else if (nextCategory) {
        next.set('type', getDefaultCategoryIntent(nextCategory))
      }
    }

    if (filterDraft.canton) next.set('canton', filterDraft.canton)
    if (filterDraft.plz) next.set('plz', filterDraft.plz)

    if (nextCategory === 'empleo') {
      if (filterDraft.jobType) next.set('jobType', filterDraft.jobType)
    } else {
      if (!filterDraft.employmentLevel && filterDraft.priceRange) next.set('priceRange', filterDraft.priceRange)
      if (isLoggedIn && filterDraft.privacy) next.set('privacy', filterDraft.privacy)
    }
    if (canFilterEmploymentLevel && filterDraft.employmentLevel) {
      next.set('employmentLevel', filterDraft.employmentLevel)
    }

    if (filterDraft.sort && filterDraft.sort !== 'newest') next.set('sort', filterDraft.sort)

    setSearchParams(next)
    setShowFilters(false)
    scrollPageTop()
  }

  const clearFilterDraft = () => {
    setFilterDraft({
      category:isEmpleos ? cat : '',
      canton:'',
      plz:'',
      privacy:'',
      jobType:'',
      employmentLevel:'',
      priceRange:'',
      sort:'newest',
    })
  }

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams)
    FILTER_PARAM_KEYS.forEach(key => next.delete(key))
    if (!isEmpleos) {
      next.delete('cat')
      next.delete('type')
    }
    next.delete('openAd')
    next.delete('openJob')
    setSearchParams(next, { replace:true })
    scrollPageTop()
  }

  const expandJobSearch = () => {
    const next = new URLSearchParams(searchParams)
    ;['q', 'canton', 'plz', 'jobType', 'employmentLevel', 'sort', 'openAd', 'openJob'].forEach(key => next.delete(key))
    next.set('cat', 'empleo')
    next.set('jobIntent', 'ofrece')
    next.delete('type')
    setSearch('')
    setResolvedSearch({ active:false, ready:false, query:'', results:[] })
    setSearchParams(next, { replace:true })
    setShowFilters(false)
    scrollPageTop()
    toast.success('Mostrando más profesiones en toda Suiza')
  }

  const expandGeneralSearch = () => {
    const next = new URLSearchParams(searchParams)
    ;['q', 'canton', 'plz', 'jobType', 'employmentLevel', 'priceRange', 'maxPrice', 'privacy', 'sort', 'openAd', 'openJob'].forEach(key => next.delete(key))
    setSearch('')
    setResolvedSearch({ active:false, ready:false, query:'', results:[] })
    setSearchParams(next, { replace:true })
    setShowFilters(false)
    scrollPageTop()
    toast.success(cat ? 'Mostrando todas las opciones de esta sección' : 'Mostrando todas las publicaciones')
  }

  const removeAppliedFilter = key => {
    const next = new URLSearchParams(searchParams)
    if (key === 'priceRange') {
      next.delete('priceRange')
      next.delete('maxPrice')
    } else {
      next.delete(key)
    }
    next.delete('openAd')
    next.delete('openJob')
    setSearchParams(next, { replace:true })
    scrollPageTop()
  }
  const openAdDetails = (ad) => {
    setSelectedAd(ad)
    setSelectedJob(null)
    if (isCleanAdRoute || isCleanJobRoute) {
      navigate(getAdPath(ad))
      return
    }
    const p = new URLSearchParams(searchParams)
    p.set('openAd', ad.id)
    p.delete('openJob')
    setSearchParams(p)
  }
  const closeAdDetails = () => {
    setSelectedAd(null)
    if (isCleanAdRoute) {
      navigate('/tablon', { replace:true })
      return
    }
    const p = new URLSearchParams(searchParams)
    p.delete('openAd')
    setSearchParams(p, { replace:true })
  }
  const openJobDetails = (job) => {
    setSelectedJob(job)
    setSelectedAd(null)
    if (isCleanAdRoute || isCleanJobRoute) {
      navigate(getJobPath(job))
      return
    }
    const p = new URLSearchParams(searchParams)
    p.set('openJob', job.id)
    p.delete('openAd')
    setSearchParams(p)
  }
  const closeJobDetails = () => {
    setSelectedJob(null)
    if (isCleanJobRoute) {
      navigate('/tablon?cat=empleo', { replace:true })
      return
    }
    const p = new URLSearchParams(searchParams)
    p.delete('openJob')
    setSearchParams(p, { replace:true })
  }
  const buildFilterChips = values => {
    const chips = []
    const selectedCanton = CANTONS.find(item => item.code === values.canton)
    const selectedJobType = JOB_TYPES.find(item => item.id === values.jobType)
    const selectedEmploymentLevel = EMPLOYMENT_LEVEL_FILTER_OPTIONS.find(item => item.id === values.employmentLevel)
    const selectedPrice = PRICE_RANGES.find(item => item.id === values.priceRange)

    if (values.canton) chips.push({ key:'canton', label:selectedCanton?.name || values.canton })
    if (values.plz) chips.push({ key:'plz', label:`CP ${values.plz}` })
    if (isEmpleos && values.jobType) chips.push({ key:'jobType', label:selectedJobType?.label || values.jobType })
    if (canFilterEmploymentLevel && values.employmentLevel) {
      chips.push({ key:'employmentLevel', label:selectedEmploymentLevel?.label || values.employmentLevel })
    }
    if (!isEmpleos && !values.employmentLevel && (values.priceRange || values.maxPrice)) {
      chips.push({
        key:'priceRange',
        label:selectedPrice?.label || `Hasta CHF ${values.maxPrice}`,
      })
    }
    if (!isEmpleos && values.privacy) {
      chips.push({ key:'privacy', label:values.privacy === 'public' ? 'Públicas' : 'Solo usuarios' })
    }
    return chips
  }

  const appliedFilterChips = buildFilterChips({
    canton,
    plz,
    privacy,
    jobType,
    employmentLevel,
    priceRange,
    maxPrice:legacyMaxPrice,
    sort:sortOrder,
  })
  const visibleFilterChips = appliedFilterChips
  const activeFilterCount = appliedFilterChips.length + Number(Boolean(cat && !isEmpleos))

  const removeVisibleFilter = key => {
    if (showFilters) {
      updateFilterDraft(key, key === 'sort' ? 'newest' : '')
      return
    }
    removeAppliedFilter(key)
  }

  const clearVisibleFilters = () => {
    if (showFilters) {
      clearFilterDraft()
      return
    }
    clearFilters()
  }

  useEffect(() => {
    setLoading(true)
    let cancelled = false

    async function loadJobs() {
      if (TABLON_CACHE.jobs) {
        setJobs(TABLON_CACHE.jobs)
        setLoading(false)
      }

      try {
        const { data, error } = await fetchAllTablonRows(() => supabase
          .from('jobs')
          .select('*')
          .or('active.is.null,active.eq.true')
          .order('created_at', { ascending:false })
          .order('id', { ascending:false }))
        const nextJobs = error
          ? (TABLON_CACHE.jobs || MOCK_JOBS)
          : (data?.length ? data : MOCK_JOBS)
        if (!error) {
          TABLON_CACHE.jobs = nextJobs
          TABLON_CACHE.jobsTs = Date.now()
          persistTablonCache()
        }
        if (!cancelled) setJobs(nextJobs)
      } catch {
        if (!cancelled) setJobs(TABLON_CACHE.jobs || MOCK_JOBS)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    async function loadAds() {
      const cacheKey = isLoggedIn ? 'privateAds' : 'publicAds'
      const cacheTsKey = isLoggedIn ? 'privateAdsTs' : 'publicAdsTs'
      const cachedAds = TABLON_CACHE[cacheKey] || (isLoggedIn ? TABLON_CACHE.publicAds : null)

      if (cachedAds) {
        setAds(cachedAds)
        setLoading(false)
      }

      try {
        const { data, error } = await fetchAllTablonRows(() => {
          let query = supabase
            .from('listings')
            .select('*')
            .or('active.is.null,active.eq.true')
            .order('created_at', { ascending:false })
            .order('id', { ascending:false })
          if (!isLoggedIn) query = query.or('privacy.is.null,privacy.eq.public')
          return query
        })
        const fallbackAds = cachedAds || MOCK_ADS.filter(ad => isLoggedIn || !ad.privacy || ad.privacy === 'public')
        const nextAds = error ? fallbackAds : (data?.length ? data : fallbackAds)

        if (!error) {
          TABLON_CACHE[cacheKey] = nextAds
          TABLON_CACHE[cacheTsKey] = Date.now()
          if (!isLoggedIn) persistTablonCache()
        }
        if (!cancelled) setAds(nextAds)
      } catch {
        if (!cancelled) {
          setAds(cachedAds || MOCK_ADS.filter(ad => isLoggedIn || !ad.privacy || ad.privacy === 'public'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadJobs()
    loadAds()

    return () => {
      cancelled = true
    }
  }, [isLoggedIn])

  useEffect(() => {
    let cancelled = false

    async function loadAdReviews() {
      try {
        const { data, error } = await supabase
          .from('listing_reviews')
          .select('id, listing_id, user_id, author_name, canton, stars, created_at, text')
          .eq('active', true)
          .order('created_at', { ascending:false })
          .limit(500)

        if (cancelled || error || !Array.isArray(data)) return

        const nextReviews = {}
        data.forEach(review => {
          if (!review?.listing_id) return
          nextReviews[review.listing_id] = [
            ...(nextReviews[review.listing_id] || []),
            normalizeListingReview(review),
          ]
        })
        setAdReviews(nextReviews)
      } catch {}
    }

    loadAdReviews()
    return () => { cancelled = true }
  }, [])

  const handleAddAdReview = async (ad, review) => {
    if (!ad?.id || !isReviewableAd(ad)) return false

    if (!isLoggedIn || !user?.id) {
      toast.error('Inicia sesión para escribir una reseña')
      return false
    }

    const payload = {
      listing_id: ad.id,
      user_id: user.id,
      author_name: displayName || review.name?.trim() || 'Usuario',
      canton: userCanton || review.canton?.trim() || '',
      stars: review.stars,
      text: review.text?.trim(),
      active: true,
    }
    const existingReview = (adReviews[ad.id] || []).find(item => item.user_id === user.id)

    try {
      const query = existingReview?.id
        ? supabase
          .from('listing_reviews')
          .update({
            author_name: payload.author_name,
            canton: payload.canton,
            stars: payload.stars,
            text: payload.text,
            active: true,
          })
          .eq('id', existingReview.id)
          .eq('user_id', user.id)
        : supabase
          .from('listing_reviews')
          .insert(payload)

      const { data, error } = await query
        .select('id, listing_id, user_id, author_name, canton, stars, created_at, text')
        .single()

      if (error) throw error

      const normalized = normalizeListingReview(data || {
        ...payload,
        id:`new-${Date.now()}`,
        created_at:new Date().toISOString(),
      })

      setAdReviews(prev => {
        const current = prev[ad.id] || []
        return {
          ...prev,
          [ad.id]: [normalized, ...current.filter(item => item.id !== normalized.id && item.user_id !== user.id)],
        }
      })
      toast.success(existingReview ? 'Reseña actualizada' : 'Reseña publicada')
      return true
    } catch (error) {
      console.error('Could not save listing review:', error)
      toast.error('No se pudo guardar la reseña')
      return false
    }
  }

  useEffect(() => {
    const ids = [
      ...ads.map(a => a.user_id),
      ...jobs.map(j => j.user_id),
    ]
    if (!ids.length) return
    fetchPublicProfilesByIds(ids).then(setUserProfiles)
  }, [ads, jobs])

  useEffect(() => {
    supabase.from('providers').select('id,name,description,website,photo_url,city,canton').eq('category','vivienda').eq('active',true).order('featured',{ascending:false}).order('name',{ascending:true})
      .then(({ data }) => { if (data?.length) setHousingPortals(data) })
    supabase.from('providers').select('id,name,description,website,photo_url,city,canton').eq('category','empleo').eq('active',true).order('featured',{ascending:false}).order('name',{ascending:true})
      .then(({ data }) => { if (data?.length) setEmploymentPortals(data) })
  }, [])

  const filteredAds = useMemo(() => {
    const matches = ads.filter(a => {
      if (!isPublicationOpen(a)) return false
      if (!(isLoggedIn || !a.privacy || a.privacy === 'public')) return false
      if (!cat && getAdCategoryId(a) === 'empleo') return false
      if (cat && getAdCategoryId(a) !== cat) return false
      if (!cat && !activeAdIntent && ['busca', 'compra'].includes(a.type)) return false
      if (activeAdIntent) {
        const typeMatches = !cat && activeAdIntent === 'ofrece'
          ? !['busca', 'compra'].includes(a.type)
          : !cat && activeAdIntent === 'busca'
            ? ['busca', 'compra'].includes(a.type)
            : cat === 'venta' && activeAdIntent === 'vende'
              ? a.type === 'vende' || a.type === 'ofrece'
              : a.type === activeAdIntent
        if (!typeMatches) return false
      }
      if (!matchesCantonOrNationwide(a, canton)) return false
      if (plz && !a.plz?.startsWith(plz)) return false
      if (privacy && a.privacy !== privacy) return false
      if (hasPriceFilter) {
        const range = PRICE_RANGES.find(option => option.id === priceRange)
        const numericPrice = parseListingPrice(a.price)
        if (numericPrice === null) return false
        if (range?.min != null && numericPrice < range.min) return false
        if (range?.max != null && numericPrice > range.max) return false
        if (!range && legacyMaxPrice && numericPrice > Number.parseFloat(legacyMaxPrice)) return false
      }
      if (deferredSearch) {
        if (hasResolvedSearch) {
          if (!resolvedSearchRank.has(`ad:${a.id}`)) return false
        } else if (!scoreSearchFields(searchProfile, [
          { value:a.title, weight:6 },
          { value:a.desc, weight:4 },
          { value:a.sub, weight:3 },
          { value:getAdDisplayCat(a)?.label, weight:2 },
          { value:a.city, weight:2 },
          { value:a.canton, weight:1 },
        ])) return false
      }
      return true
    })

    return hasResolvedSearch
      ? matches.sort((a, b) => getResolvedRank('ad', a.id) - getResolvedRank('ad', b.id))
      : matches
  }, [activeAdIntent, ads, canton, cat, deferredSearch, hasPriceFilter, hasResolvedSearch, isLoggedIn, legacyMaxPrice, plz, priceRange, privacy, resolvedSearchRank, searchProfile])

  const communityJobs = useMemo(() => {
    const fromJobs = jobs.filter(j =>
      isPublicationOpen(j) &&
      (!activeJobIntent || getJobIntentId(j) === activeJobIntent) &&
      (!jobType || j.type === jobType) &&
      (!employmentLevel || getJobEmploymentLevelId(j) === employmentLevel) &&
      matchesCantonOrNationwide(j, canton) &&
      (!plz || j.plz?.startsWith(plz)) &&
      (!deferredSearch || (
        hasResolvedSearch
          ? resolvedSearchRank.has(`job:${j.id}`)
          : scoreSearchFields(searchProfile, [
            { value:j.title, weight:6 },
            { value:j.company, weight:4 },
            { value:j.desc, weight:4 },
            { value:j.sector || j.category, weight:3 },
            { value:getJobIntentMeta(j).label, weight:2 },
            { value:j.type, weight:2 },
            { value:j.city || j.canton, weight:2 },
            { value:getJobProfessionalSearchText(j), weight:4 },
          ])
      ))
    )
    const fromAds = []
    for (const a of ads) {
      if (
        getAdCategoryId(a) === 'empleo' &&
        isPublicationOpen(a) &&
        (isLoggedIn || !a.privacy || a.privacy === 'public') &&
        (!activeJobIntent || getJobIntentId(a) === activeJobIntent) &&
        (!jobType || a.type === jobType || a.sub === jobType) &&
        (!employmentLevel || getJobEmploymentLevelId(a) === employmentLevel) &&
        matchesCantonOrNationwide(a, canton) &&
        (!plz || a.plz?.startsWith(plz)) &&
        (!deferredSearch || (
          hasResolvedSearch
            ? resolvedSearchRank.has(`ad:${a.id}`)
            : scoreSearchFields(searchProfile, [
              { value:a.title, weight:6 },
              { value:a.desc, weight:4 },
              { value:a.sub, weight:3 },
              { value:getJobIntentMeta(a).label, weight:2 },
              { value:a.city || a.canton, weight:2 },
              { value:getJobProfessionalSearchText(a), weight:4 },
            ])
        ))
      ) {
        fromAds.push({
          id: a.id, title: a.title, company: a.company || a.title, city: a.city || a.canton,
          canton: a.canton, type: ['busca','ofrece'].includes(a.type) ? (a.sub || '') : a.type, job_intent: getJobIntentId(a), salary: a.salary || a.price, salary_amount:a.salary_amount ?? a.price_amount, emoji: a.emoji || '\u{1F4BC}',
          logo_url: getAdPhotos(a)[0] || '', lang: a.lang, languages: a.languages,
          desc: a.desc, user_id: a.user_id, user_name: a.user_name, user: a.user, created_at: a.created_at,
          employment_profile:a.employment_profile, employment_level:a.employment_level,
          experience_years:a.experience_years, available_from:a.available_from, driving_license:a.driving_license,
        })
      }
    }
    return [...fromJobs, ...fromAds]
      .sort((a, b) => hasResolvedSearch
        ? getJobResolvedRank(a) - getJobResolvedRank(b)
        : String(b.created_at || '').localeCompare(String(a.created_at || '')))
  }, [activeJobIntent, ads, canton, deferredSearch, employmentLevel, hasResolvedSearch, isLoggedIn, jobType, jobs, plz, resolvedSearchRank, searchProfile])

  const filteredJobs = communityJobs
  const displayedAds = useMemo(
    () => [...filteredAds].sort((a, b) => comparePublications(a, b, sortOrder)),
    [filteredAds, sortOrder]
  )
  const displayedJobs = useMemo(
    () => [...filteredJobs].sort((a, b) => comparePublications(a, b, sortOrder)),
    [filteredJobs, sortOrder]
  )
  const tablonItems = useMemo(() => {
    if (cat) return displayedAds.map(ad => ({ kind:'ad', item:ad, sortDate:ad.created_at || '' }))

    const adsForCurrentFilters = employmentLevel ? [] : filteredAds
    const jobsForCurrentFilters = hasPriceFilter
      ? []
      : type
        ? ['busca', 'ofrece'].includes(type)
          ? filteredJobs.filter(job => getJobIntentId(job) === type)
          : []
        : filteredJobs

    const items = [
      ...adsForCurrentFilters.map(ad => ({ kind:'ad', item:ad, sortDate:ad.created_at || '' })),
      ...jobsForCurrentFilters.map(job => ({ kind:'job', item:job, sortDate:job.created_at || '' })),
    ]

    return items.sort((a, b) => {
      if (sortOrder === 'relevance' && hasResolvedSearch) {
        return getResolvedRank(a.kind, a.item.id) - getResolvedRank(b.kind, b.item.id)
      }
      return comparePublications(a, b, sortOrder)
    })
  }, [cat, displayedAds, employmentLevel, filteredAds, filteredJobs, hasPriceFilter, hasResolvedSearch, resolvedSearchRank, sortOrder, type])

  const draftResultCount = useMemo(() => {
    const draftCategory = normalizeAdCat(filterDraft.category)
    const draftCategoryChanged = draftCategory !== cat
    const draftIsEmpleos = draftCategory === 'empleo'
    const draftAdIntent = draftCategoryChanged
      ? draftCategory ? getDefaultCategoryIntent(draftCategory) : 'ofrece'
      : activeAdIntent
    const draftJobIntent = draftCategoryChanged ? 'ofrece' : activeJobIntent
    const draftRange = PRICE_RANGES.find(option => option.id === filterDraft.priceRange)
    const draftHasPrice = Boolean(filterDraft.priceRange) && !filterDraft.employmentLevel

    const matchesAdSearch = ad => {
      if (!deferredSearch) return true
      if (hasResolvedSearch) return resolvedSearchRank.has(`ad:${ad.id}`)
      return Boolean(scoreSearchFields(searchProfile, [
        { value:ad.title, weight:6 },
        { value:ad.desc, weight:4 },
        { value:ad.sub, weight:3 },
        { value:getAdDisplayCat(ad)?.label, weight:2 },
        { value:ad.city, weight:2 },
        { value:ad.canton, weight:1 },
      ]))
    }

    const draftAds = ads.filter(ad => {
      if (!isPublicationOpen(ad)) return false
      if (!(isLoggedIn || !ad.privacy || ad.privacy === 'public')) return false
      if (!draftCategory && getAdCategoryId(ad) === 'empleo') return false
      if (draftCategory && getAdCategoryId(ad) !== draftCategory) return false
      if (!draftCategory && !draftAdIntent && ['busca', 'compra'].includes(ad.type)) return false
      if (draftAdIntent) {
        const typeMatches = !draftCategory && draftAdIntent === 'ofrece'
          ? !['busca', 'compra'].includes(ad.type)
          : !draftCategory && draftAdIntent === 'busca'
            ? ['busca', 'compra'].includes(ad.type)
            : draftCategory === 'venta' && draftAdIntent === 'vende'
              ? ad.type === 'vende' || ad.type === 'ofrece'
              : ad.type === draftAdIntent
        if (!typeMatches) return false
      }
      if (!matchesCantonOrNationwide(ad, filterDraft.canton)) return false
      if (filterDraft.plz && !ad.plz?.startsWith(filterDraft.plz)) return false
      if (!draftIsEmpleos && filterDraft.privacy && ad.privacy !== filterDraft.privacy) return false
      if (!draftIsEmpleos && draftHasPrice) {
        const numericPrice = parseListingPrice(ad.price)
        if (numericPrice === null) return false
        if (draftRange?.min != null && numericPrice < draftRange.min) return false
        if (draftRange?.max != null && numericPrice > draftRange.max) return false
      }
      return matchesAdSearch(ad)
    })

    const matchesJobSearch = (job, source='job') => {
      if (!deferredSearch) return true
      if (hasResolvedSearch) return resolvedSearchRank.has(`${source}:${job.id}`)
      return Boolean(scoreSearchFields(searchProfile, [
        { value:job.title, weight:6 },
        { value:job.company, weight:4 },
        { value:job.desc, weight:4 },
        { value:job.sector || job.category || job.sub, weight:3 },
        { value:getJobIntentMeta(job).label, weight:2 },
        { value:job.type, weight:2 },
        { value:job.city || job.canton, weight:2 },
        { value:getJobProfessionalSearchText(job), weight:4 },
      ]))
    }

    const draftJobsCount = jobs.filter(job =>
      isPublicationOpen(job) &&
      (!draftJobIntent || getJobIntentId(job) === draftJobIntent) &&
      (!filterDraft.jobType || job.type === filterDraft.jobType) &&
      (!filterDraft.employmentLevel || getJobEmploymentLevelId(job) === filterDraft.employmentLevel) &&
      matchesCantonOrNationwide(job, filterDraft.canton) &&
      (!filterDraft.plz || job.plz?.startsWith(filterDraft.plz)) &&
      matchesJobSearch(job)
    ).length

    const draftLegacyJobsCount = ads.filter(ad =>
      getAdCategoryId(ad) === 'empleo' &&
      isPublicationOpen(ad) &&
      (isLoggedIn || !ad.privacy || ad.privacy === 'public') &&
      (!draftJobIntent || getJobIntentId(ad) === draftJobIntent) &&
      (!filterDraft.jobType || ad.type === filterDraft.jobType || ad.sub === filterDraft.jobType) &&
      (!filterDraft.employmentLevel || getJobEmploymentLevelId(ad) === filterDraft.employmentLevel) &&
      matchesCantonOrNationwide(ad, filterDraft.canton) &&
      (!filterDraft.plz || ad.plz?.startsWith(filterDraft.plz)) &&
      matchesJobSearch(ad, 'ad')
    ).length

    if (draftIsEmpleos || filterDraft.employmentLevel) return draftJobsCount + draftLegacyJobsCount
    if (draftCategory || draftHasPrice) return draftAds.length
    return draftAds.length + draftJobsCount + draftLegacyJobsCount
  }, [
    activeAdIntent,
    activeJobIntent,
    ads,
    cat,
    deferredSearch,
    filterDraft.canton,
    filterDraft.category,
    filterDraft.employmentLevel,
    filterDraft.jobType,
    filterDraft.plz,
    filterDraft.priceRange,
    filterDraft.privacy,
    hasResolvedSearch,
    isLoggedIn,
    jobs,
    resolvedSearchRank,
    searchProfile,
  ])

  const visibleResultCount = isEmpleos
    ? displayedJobs.length
    : cat
      ? displayedAds.length
      : tablonItems.length
  const currentSortLabel = SORT_OPTIONS.find(option => option.id === sortOrder)?.label || 'Más reciente'
  const savedSearchDraft = useMemo(() => {
    const savedCanton = canton || (plz ? '' : userCanton) || ''
    const hasUsefulContext = Boolean(
      deferredSearch.length >= 2
      || cat
      || canton
      || activeAdIntent
      || plz
      || jobType
      || employmentLevel
      || priceRange
      || privacy,
    )
    if (!hasUsefulContext) return null

    const params = new URLSearchParams()
    if (cat) params.set('cat', cat)
    if (deferredSearch.length >= 2) params.set('q', deferredSearch)
    if (savedCanton) params.set('canton', savedCanton)
    if (plz) params.set('plz', plz)
    if (jobType) params.set('jobType', jobType)
    if (employmentLevel) params.set('employmentLevel', employmentLevel)
    if (priceRange) params.set('priceRange', priceRange)
    if (isEmpleos) params.set('jobIntent', activeJobIntent)
    else if (activeAdIntent) params.set('type', activeAdIntent)

    const categoryLabel = AD_CATS.find(item => item.id === cat)?.label
      || (cat === 'empleo' ? 'Empleo' : 'Anuncios')
    const searchLabel = deferredSearch.length >= 2 ? `“${deferredSearch}”` : categoryLabel
    const locationLabel = savedCanton || plz

    return {
      name:`${categoryLabel}: ${searchLabel}${locationLabel ? ` · ${locationLabel}` : ''}`.slice(0, 100),
      query:deferredSearch.length >= 2 ? deferredSearch : '',
      entityKinds:isEmpleos ? ['job', 'listing'] : cat ? ['listing'] : ['listing', 'job'],
      category:cat,
      intent:isEmpleos ? activeJobIntent : activeAdIntent,
      canton:savedCanton,
      plz,
      filters:{
        jobType,
        employmentLevel,
        priceRange,
        privacy,
      },
      resultPath:`/tablon${params.size ? `?${params.toString()}` : ''}`,
    }
  }, [
    activeAdIntent,
    activeJobIntent,
    canton,
    cat,
    deferredSearch,
    employmentLevel,
    isEmpleos,
    jobType,
    plz,
    priceRange,
    privacy,
    userCanton,
  ])
  const filterSavedSearchDraft = useMemo(() => {
    const draftCategory = normalizeAdCat(filterDraft.category)
    const draftIsEmployment = draftCategory === 'empleo'
    const draftIntent = draftCategory === cat
      ? draftIsEmployment ? activeJobIntent : activeAdIntent
      : draftCategory ? getDefaultCategoryIntent(draftCategory) : ''
    const cleanQuery = deferredSearch.length >= 2 ? deferredSearch : ''
    const params = new URLSearchParams()

    if (draftCategory) params.set('cat', draftCategory)
    if (cleanQuery) params.set('q', cleanQuery)
    if (filterDraft.canton) params.set('canton', filterDraft.canton)
    if (filterDraft.plz) params.set('plz', filterDraft.plz)
    if (filterDraft.sort && filterDraft.sort !== 'newest') params.set('sort', filterDraft.sort)

    if (draftIsEmployment) {
      if (draftIntent) params.set('jobIntent', draftIntent)
      if (filterDraft.jobType) params.set('jobType', filterDraft.jobType)
      if (filterDraft.employmentLevel) params.set('employmentLevel', filterDraft.employmentLevel)
    } else {
      if (draftIntent) params.set('type', draftIntent)
      if (filterDraft.priceRange) params.set('priceRange', filterDraft.priceRange)
      if (filterDraft.privacy) params.set('privacy', filterDraft.privacy)
    }

    const categoryLabel = AD_CATS.find(item => item.id === draftCategory)?.label
      || (draftIsEmployment ? 'Empleo' : 'Anuncios')
    const subject = cleanQuery ? `“${cleanQuery}”` : categoryLabel
    const locationLabel = filterDraft.canton || filterDraft.plz

    return {
      name:`${categoryLabel}: ${subject}${locationLabel ? ` · ${locationLabel}` : ''}`.slice(0, 100),
      query:cleanQuery,
      entityKinds:draftIsEmployment ? ['job', 'listing'] : draftCategory ? ['listing'] : ['listing', 'job'],
      category:draftCategory,
      intent:draftIntent,
      canton:filterDraft.canton,
      plz:filterDraft.plz,
      filters:{
        jobType:draftIsEmployment ? filterDraft.jobType : '',
        employmentLevel:draftIsEmployment ? filterDraft.employmentLevel : '',
        priceRange:draftIsEmployment ? '' : filterDraft.priceRange,
        privacy:draftIsEmployment ? '' : filterDraft.privacy,
      },
      resultPath:`/tablon${params.size ? `?${params.toString()}` : ''}`,
    }
  }, [
    activeAdIntent,
    activeJobIntent,
    cat,
    deferredSearch,
    filterDraft,
  ])
  const isEmploymentQuery = isEmpleos || (
    !cat && (
      profileHasIntent(searchProfile, 'employment')
      || resolvedSearch.assistant?.intent === 'employment'
    )
  )
  const showJobSeekerEmptyState = isEmploymentQuery
    && activeJobIntent === 'ofrece'
    && visibleResultCount === 0
  const showSearchRecovery = visibleResultCount === 0 && (
    showJobSeekerEmptyState
    || deferredSearch.length >= 2
    || activeFilterCount > 0
  )

  const relatedAdsForSelected = useMemo(() => {
    if (!selectedAd) return []
    const selectedCat = getAdCategoryId(selectedAd)
    const selectedSub = selectedAd.sub || ''

    return ads
      .filter(ad =>
        String(ad.id) !== String(selectedAd.id) &&
        isPublicationOpen(ad) &&
        (isLoggedIn || !ad.privacy || ad.privacy === 'public') &&
        getAdCategoryId(ad) === selectedCat
      )
      .sort((a, b) => {
        const subScore = (selectedSub && b.sub === selectedSub ? 1 : 0) - (selectedSub && a.sub === selectedSub ? 1 : 0)
        if (subScore) return subScore
        return String(b.created_at || '').localeCompare(String(a.created_at || ''))
      })
      .slice(0, 12)
  }, [ads, isLoggedIn, selectedAd])

  const relatedJobsForSelected = useMemo(() => {
    if (!selectedJob) return []
    const selectedSector = selectedJob.sector || selectedJob.category || selectedJob.sub || ''
    const selectedIntent = getJobIntentId(selectedJob)
    const selectedType = selectedJob.type || ''
    const jobLikeItems = [
      ...jobs,
      ...ads.flatMap(ad => (
        getAdCategoryId(ad) === 'empleo'
          && isPublicationOpen(ad)
          && (isLoggedIn || !ad.privacy || ad.privacy === 'public')
          ? [{
            id:ad.id,
            title:ad.title,
            company:ad.company || ad.user_name || ad.user || ad.title,
            city:ad.city || ad.canton,
            canton:ad.canton,
            type:['busca', 'ofrece'].includes(ad.type) ? (ad.sub || '') : ad.type,
            job_intent:getJobIntentId(ad),
            salary:ad.salary || ad.price,
            emoji:ad.emoji || getAdDisplayEmoji(ad),
            logo_url:getAdPhotos(ad)[0] || '',
            lang:ad.lang,
            languages:ad.languages,
            desc:ad.desc,
            user_id:ad.user_id,
            user_name:ad.user_name,
            user:ad.user,
            created_at:ad.created_at,
            sector:ad.sub || '',
          }]
          : []
      )),
    ]

    return jobLikeItems
      .filter(job => {
        if (String(job.id) === String(selectedJob.id)) return false
        if (!isPublicationOpen(job)) return false
        const sector = job.sector || job.category || job.sub || ''
        return (
          (selectedSector && sector === selectedSector) ||
          getJobIntentId(job) === selectedIntent ||
          (selectedType && job.type === selectedType)
        )
      })
      .sort((a, b) => {
        const aSector = selectedSector && (a.sector || a.category || a.sub || '') === selectedSector ? 1 : 0
        const bSector = selectedSector && (b.sector || b.category || b.sub || '') === selectedSector ? 1 : 0
        if (aSector !== bSector) return bSector - aSector
        const aIntent = getJobIntentId(a) === selectedIntent ? 1 : 0
        const bIntent = getJobIntentId(b) === selectedIntent ? 1 : 0
        if (aIntent !== bIntent) return bIntent - aIntent
        return String(b.created_at || '').localeCompare(String(a.created_at || ''))
      })
      .slice(0, 12)
  }, [ads, isLoggedIn, jobs, selectedJob])

  useEffect(() => {
    if (loading) return

    if (targetOpenJobId) {
      const job = filteredJobs.find(entry => String(entry.id) === targetOpenJobId)
        || jobs.find(entry => String(entry.id) === targetOpenJobId && isPublicationOpen(entry))
      if (job) {
        setSelectedJob(job)
        setSelectedAd(null)
      } else {
        setSelectedJob(null)
        setSelectedAd(null)
      }
      return
    }

    setSelectedJob(null)

    if (!targetOpenAdId) {
      setSelectedAd(null)
      return
    }

    const ad = ads.find(entry => String(entry.id) === targetOpenAdId && isPublicationOpen(entry))
    setSelectedAd(ad || null)
  }, [ads, filteredJobs, jobs, loading, targetOpenAdId, targetOpenJobId])

  // Empleo sale de las pildoras: ya es una seccion propia en SectionTabs.
  const orderedCats = AD_CATS.filter(item => item.id !== 'empleo').sort((a, b) => {
    const priority = { vivienda:0, venta:2, servicios:3, cuidados:4, documentos:5 }
    return (priority[a.id] ?? 99) - (priority[b.id] ?? 99)
  })

  const cantonOptions = [{ id:'', label:'Toda Suiza' }, ...CANTONS.map(c => ({ id:c.code, label:`${c.code} · ${c.name}` }))]
  const jobTypeOptions = [{ id:'', label:'Todos' }, ...JOB_TYPES.map(jobTypeOption => ({ id:jobTypeOption.id, label:`${jobTypeOption.emoji} ${jobTypeOption.label}` }))]
  const intentValue = cat ? activeToolbarIntent : type
  const pageContext = getTablonContext(cat, isEmpleos, activeIntentMeta)
  const publishHref = cat
    ? getPublishPathForIntent(cat, activeCategoryIntent)
    : '/publicar'
  const publishLabel = activeIntentMeta?.publishLabel || 'Publicar anuncio'

  return (
    <div className="latido-page-container" style={{ paddingBottom:100 }}>
      <div style={{ width:'100vw', marginLeft:'calc(50% - 50vw)', marginRight:'calc(50% - 50vw)', background:'#fff' }}>
        <div className="latido-page-container" style={{ maxWidth:1240, paddingTop:16 }}>
      <div className="section-page-head">
        <h1>{pageContext.title}</h1>
        <p>{pageContext.subtitle}</p>
      </div>

        </div>
      </div>

      <div className="cat-bar sticky-toolbar-shell" style={{ width:'100vw', marginLeft:'calc(50% - 50vw)', marginRight:'calc(50% - 50vw)', marginBottom:18, padding:'10px 0 12px' }}>
        <div className="latido-page-container" style={{ maxWidth:1240 }}>
          <Card className="tablon-toolbar-card" padding="sm" style={{ borderRadius:22 }}>
      <SectionTabs />
      <div style={{ display:'flex', alignItems:'center', gap:8, width:'100%', minWidth:0 }}>
        <div style={{ flex:'1 1 0', minWidth:0 }}>
          <GlobalSearch
            size="sm"
            placeholder={pageContext.searchPlaceholder}
            value={search}
            onValueChange={setSearch}
            resultTypes={TABLON_SEARCH_RESULT_TYPES}
            analyticsScope={isEmpleos ? 'empleos' : 'tablon'}
            assistantMode
            showResultsDropdown={false}
            onResolvedResultsChange={setResolvedSearch}
            searchFilters={{ category:cat, canton, intent:intentValue }}
            onSearchFiltersChange={clearFilters}
            filterCount={activeFilterCount}
            onFiltersRequest={openFilters}
          />
        </div>
        <FilterButton
          count={activeFilterCount}
          open={showFilters}
          onClick={toggleFilters}
        />
      </div>
      {visibleFilterChips.length > 0 && (
        <div style={{ marginTop:9 }}>
          <FilterChips
            items={visibleFilterChips}
            onRemove={removeVisibleFilter}
            onClear={clearVisibleFilters}
          />
        </div>
      )}
      <div style={{ marginTop:11 }}>
        <IntentTabs
          views={toolbarIntentViews}
          value={activeToolbarIntent}
          onChange={setIntentView}
        />
      </div>
      <FilterResultSummary
        count={visibleResultCount}
        sortLabel={currentSortLabel}
        sortOptions={SORT_OPTIONS}
        sortValue={sortOrder}
        onSortChange={setSortView}
      />
      {savedSearchDraft && !showSearchRecovery && (
        <div className="saved-search-prompt saved-search-prompt--toolbar">
          <span>Avísame cuando haya nuevos resultados.</span>
          <SavedSearchButton draft={savedSearchDraft} compact />
        </div>
      )}
          </Card>
        </div>
      </div>

      {/* Results */}
      <div key={`${cat || 'all'}-${activeToolbarIntent}`} className="segmented-content-transition">
      {loading ? (
        <div className="latido-directory-grid">
          {[1,2,3].map(i => <SkeletonCard key={i} variant="list" lines={isEmpleos ? 2 : 1} style={{ minHeight:isEmpleos ? 122 : 136 }} />)}
        </div>
      ) : isEmpleos ? (
        <>
          {employmentPortals.length > 0 && !deferredSearch && (
            <div style={{ marginBottom:16 }}>
              <button onClick={() => setPortalsOpen(o => !o)} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, background:'none', border:'none', cursor:'pointer', padding:'0 16px 0 0', marginBottom: portalsOpen ? 10 : 0 }}>
                <p style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:C.light, letterSpacing:1, margin:0 }}>PORTALES Y AGENCIAS DE EMPLEO</p>
                <span style={{ fontFamily:PP, fontSize:10, fontWeight:800, color:C.primary, letterSpacing:0, textTransform:'none' }}>{portalsOpen ? 'Ocultar' : 'Mostrar'}</span>
              </button>
              {portalsOpen && (
                <div className="latido-directory-grid">
                  {employmentPortals.map(p => (
                    <PortalCard key={p.id} portal={p} defaultEmoji="💼" onClick={() => setSelectedPortal({ ...p, defaultEmoji:'💼' })} />
                  ))}
                </div>
              )}
            </div>
          )}
          {displayedJobs.length === 0 ? (
            showJobSeekerEmptyState ? (
              <SearchRecoveryEmptyState
                employment
                savedSearchDraft={savedSearchDraft}
                onExpandSearch={expandJobSearch}
              />
            ) : (
              <EmptyState
                emoji="📭"
                title={pageContext.emptyTitle}
                sub={pageContext.emptyText}
                action={publishLabel}
                actionComponent={Link}
                actionProps={{ to:publishHref }}
              />
            )
          ) : (
            <>
              <p style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:C.light, letterSpacing:1, marginBottom:10 }}>{activeIntentMeta?.label?.toUpperCase() || 'EMPLEO DE LA COMUNIDAD'}</p>
              <div className="latido-directory-grid">
                {displayedJobs.map(j => (
                  <JobCard key={j.id} job={j} onClick={() => openJobDetails(j)} isFav={isFavorite('jobs', j.id)} onToggleFav={() => toggleFavorite('jobs', j.id)} avatarSrc={userProfiles.get(j.user_id)?.avatarUrl} authorName={userProfiles.get(j.user_id)?.name} />
                ))}
                <div className="latido-directory-grid__full" style={{ marginTop:16, border:`2px dashed ${C.border}`, borderRadius:16, padding:'18px 20px', textAlign:'center', background:C.primaryLight }}>
                  <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:15, color:C.text, marginBottom:6 }}>{activeCategoryIntent === 'busca' ? '¿Quieres que te encuentren empresas y empleadores?' : '¿Necesitas incorporar a alguien?'}</h3>
                  <p style={{ fontFamily:PP, fontSize:12, color:C.mid, marginBottom:12 }}>{activeCategoryIntent === 'busca' ? 'Crea una solicitud de empleo clara y fácil de encontrar.' : 'Publica la oferta gratis para la comunidad hispanohablante en Suiza.'}</p>
                  <Link to={publishHref} style={{ fontFamily:PP, fontWeight:700, fontSize:12, background:C.primary, color:'#fff', textDecoration:'none', padding:'10px 22px', borderRadius:13, display:'inline-flex' }}>{publishLabel}</Link>
                </div>
              </div>
            </>
          )}
        </>
      ) : cat === 'vivienda' && housingPortals.length > 0 && !deferredSearch ? (
        <>
          <div style={{ marginBottom:16 }}>
            <button onClick={() => setPortalsOpen(o => !o)} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, background:'none', border:'none', cursor:'pointer', padding:'0 16px 0 0', marginBottom: portalsOpen ? 10 : 0 }}>
              <p style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:C.light, letterSpacing:1, margin:0 }}>PORTALES Y AGENCIAS DE VIVIENDA</p>
              <span style={{ fontFamily:PP, fontSize:10, fontWeight:800, color:C.primary, letterSpacing:0, textTransform:'none' }}>{portalsOpen ? 'Ocultar' : 'Mostrar'}</span>
            </button>
            {portalsOpen && (
              <div className="latido-directory-grid">
                {housingPortals.map(p => (
                  <PortalCard key={p.id} portal={p} defaultEmoji="🏠" onClick={() => setSelectedPortal({ ...p, defaultEmoji:'🏠' })} />
                ))}
              </div>
            )}
          </div>
          {displayedAds.length > 0 ? (
            <>
              <p style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:C.light, letterSpacing:1, marginBottom:10 }}>{activeIntentMeta?.label?.toUpperCase() || 'VIVIENDA EN LA COMUNIDAD'}</p>
              <div className="latido-directory-grid">{displayedAds.map(ad => <AdCard key={ad.id} ad={ad} onClick={() => openAdDetails(ad)} isFav={isFavorite('ads', ad.id)} onToggleFav={() => toggleFavorite('ads', ad.id)} avatarSrc={userProfiles.get(ad.user_id)?.avatarUrl} reviews={adReviews[ad.id] || []} />)}</div>
            </>
          ) : (
            showSearchRecovery ? (
              <SearchRecoveryEmptyState
                employment={showJobSeekerEmptyState}
                savedSearchDraft={savedSearchDraft}
                onExpandSearch={showJobSeekerEmptyState ? expandJobSearch : expandGeneralSearch}
                publishHref={showJobSeekerEmptyState ? '' : publishHref}
                publishLabel={showJobSeekerEmptyState ? '' : publishLabel}
              />
            ) : (
              <div style={{ textAlign:'center', padding:'50px 20px' }}>
                <div style={{ fontSize:52, marginBottom:14 }}>📭</div>
                <h3 style={{ fontFamily:PP, fontWeight:800, fontSize:18, color:C.text, marginBottom:8 }}>{pageContext.emptyTitle}</h3>
                <p style={{ fontFamily:PP, fontSize:12, color:C.light, margin:'0 0 16px' }}>{pageContext.emptyText}</p>
                <Link to={publishHref} style={{ fontFamily:PP, fontWeight:700, fontSize:13, background:C.primary, color:'#fff', textDecoration:'none', borderRadius:13, padding:'11px 22px', display:'inline-flex', alignItems:'center', gap:6 }}>{publishLabel}</Link>
              </div>
            )
          )}
        </>
      ) : tablonItems.length === 0 ? (
        showSearchRecovery ? (
          <SearchRecoveryEmptyState
            employment={showJobSeekerEmptyState}
            savedSearchDraft={savedSearchDraft}
            onExpandSearch={showJobSeekerEmptyState ? expandJobSearch : expandGeneralSearch}
            publishHref={showJobSeekerEmptyState ? '' : publishHref}
            publishLabel={showJobSeekerEmptyState ? '' : publishLabel}
          />
        ) : (
          <div style={{ textAlign:'center', padding:'60px 20px' }}>
            <div style={{ fontSize:52, marginBottom:14 }}>📭</div>
            <h3 style={{ fontFamily:PP, fontWeight:800, fontSize:18, color:C.text, marginBottom:8 }}>{pageContext.emptyTitle}</h3>
            <p style={{ fontFamily:PP, fontSize:12, color:C.light, marginBottom:16 }}>{pageContext.emptyText}</p>
            <Link to={publishHref} style={{ fontFamily:PP, fontWeight:700, fontSize:13, background:C.primary, color:'#fff', textDecoration:'none', borderRadius:13, padding:'11px 22px', display:'inline-flex', alignItems:'center', gap:6 }}>{publishLabel}</Link>
          </div>
        )
      ) : (
        <>
          {cat && <p style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:C.light, letterSpacing:1, marginBottom:10 }}>{activeIntentMeta?.label?.toUpperCase()}</p>}
          <div className="latido-directory-grid">
            {tablonItems.map(({ kind, item }) => kind === 'job' ? (
              <JobCard key={`job-${item.id}`} job={item} onClick={() => openJobDetails(item)} isFav={isFavorite('jobs', item.id)} onToggleFav={() => toggleFavorite('jobs', item.id)} avatarSrc={userProfiles.get(item.user_id)?.avatarUrl} authorName={userProfiles.get(item.user_id)?.name} />
            ) : (
              <AdCard key={`ad-${item.id}`} ad={item} onClick={() => openAdDetails(item)} isFav={isFavorite('ads', item.id)} onToggleFav={() => toggleFavorite('ads', item.id)} avatarSrc={userProfiles.get(item.user_id)?.avatarUrl} reviews={adReviews[item.id] || []} />
            ))}
          </div>
        </>
      )}
      </div>

      <Sheet show={showFilters} onClose={() => setShowFilters(false)}>
        <form
          className="filter-sheet-content"
          onSubmit={event => {
            event.preventDefault()
            applyFilterDraft()
          }}
        >
          <div className="filter-sheet-heading">
            <h2>Filtros</h2>
            <button type="button" onClick={clearFilterDraft}>Restablecer</button>
          </div>

          <div className="filter-sheet-location-grid">
            <label>
              <span style={FILTER_PANEL_TITLE_STYLE}>Cantón</span>
              <select
                className="filter-sheet-control"
                value={filterDraft.canton}
                onChange={event => updateFilterDraft('canton', event.target.value)}
                style={getFilterControlStyle(filterDraft.canton)}
              >
                {cantonOptions.map(option => <option key={option.id || 'all'} value={option.id}>{option.label}</option>)}
              </select>
            </label>

            <label>
              <span style={FILTER_PANEL_TITLE_STYLE}>Código postal</span>
              <input
                className="filter-sheet-control"
                inputMode="numeric"
                placeholder="PLZ"
                value={filterDraft.plz}
                onChange={event => updateFilterDraft('plz', event.target.value.replace(/\D/g, '').slice(0, 4))}
                maxLength={4}
                style={getFilterControlStyle(filterDraft.plz)}
              />
            </label>
          </div>

          <div className="filter-sheet-options-grid">
            {!isEmpleos && (
              <label>
                <span style={FILTER_PANEL_TITLE_STYLE}>Categoría</span>
                <select
                  className="filter-sheet-control"
                  value={filterDraft.category}
                  onChange={event => updateFilterDraft('category', event.target.value)}
                  style={getFilterControlStyle(filterDraft.category)}
                >
                  <option value="">Todos los anuncios</option>
                  {orderedCats.map(option => (
                    <option key={option.id} value={option.id}>{option.emoji} {option.label}</option>
                  ))}
                </select>
              </label>
            )}

            {isEmpleos ? (
              <label>
                <span style={FILTER_PANEL_TITLE_STYLE}>Tipo de empleo</span>
                <select
                  className="filter-sheet-control"
                  value={filterDraft.jobType}
                  onChange={event => updateFilterDraft('jobType', event.target.value)}
                  style={getFilterControlStyle(filterDraft.jobType)}
                >
                  {jobTypeOptions.map(option => <option key={option.id || 'all'} value={option.id}>{option.label}</option>)}
                </select>
              </label>
            ) : (
              <label>
                <span style={FILTER_PANEL_TITLE_STYLE}>Precio</span>
                <select
                  className="filter-sheet-control"
                  value={filterDraft.priceRange}
                  onChange={event => updateFilterDraft('priceRange', event.target.value)}
                  style={getFilterControlStyle(filterDraft.priceRange)}
                >
                  {PRICE_RANGES.map(option => <option key={option.id || 'all'} value={option.id}>{option.label}</option>)}
                </select>
              </label>
            )}

            {canFilterEmploymentLevel && (
              <label>
                <span style={FILTER_PANEL_TITLE_STYLE}>Nivel profesional</span>
                <select
                  className="filter-sheet-control"
                  value={filterDraft.employmentLevel}
                  onChange={event => updateFilterDraft('employmentLevel', event.target.value)}
                  style={getFilterControlStyle(filterDraft.employmentLevel)}
                >
                  {EMPLOYMENT_LEVEL_FILTER_OPTIONS.map(option => (
                    <option key={option.id || 'all'} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
            )}

            {!isEmpleos && isLoggedIn && (
              <label>
                <span style={FILTER_PANEL_TITLE_STYLE}>Visibilidad</span>
                <select
                  className="filter-sheet-control"
                  value={filterDraft.privacy}
                  onChange={event => updateFilterDraft('privacy', event.target.value)}
                  style={getFilterControlStyle(filterDraft.privacy)}
                >
                  <option value="">Todas las publicaciones</option>
                  <option value="public">Públicas</option>
                  <option value="private">Solo para usuarios</option>
                </select>
              </label>
            )}

            <label>
              <span style={FILTER_PANEL_TITLE_STYLE}>Ordenar por</span>
              <select
                className="filter-sheet-control"
                value={filterDraft.sort}
                onChange={event => updateFilterDraft('sort', event.target.value)}
                style={getFilterControlStyle(filterDraft.sort, 'newest')}
              >
                {SORT_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
          </div>

          <SavedSearchButton
            draft={filterSavedSearchDraft}
            idleLabel="Guardar esta búsqueda y avisarme"
            panel
          />

          <button type="submit" className="filter-show-results filter-sheet-submit">
            Mostrar {draftResultCount} {draftResultCount === 1 ? 'resultado' : 'resultados'}
          </button>
        </form>
      </Sheet>

      {/* Ad detail page */}
      <FullPageOverlay
        show={!!selectedAd}
        onClose={closeAdDetails}
        title="Anuncio"
        syncHistory={false}
        headerVariant="floating"
      >
        {selectedAd && (
          <AdDetail
            ad={selectedAd}
            user={user}
            displayName={displayName}
            userCanton={userCanton}
            avatarSrc={userProfiles.get(selectedAd.user_id)?.avatarUrl}
            relatedAds={relatedAdsForSelected}
            onOpenRelatedAd={openAdDetails}
            reviews={adReviews[selectedAd.id] || []}
            onAddReview={handleAddAdReview}
            isFav={isFavorite('ads', selectedAd.id)}
            onToggleFavorite={() => toggleFavorite('ads', selectedAd.id)}
          />
        )}
      </FullPageOverlay>

      {/* Job detail page */}
      <FullPageOverlay
        show={!!selectedJob}
        onClose={closeJobDetails}
        title="Empleo"
        syncHistory={false}
        headerVariant="floating"
      >
        {selectedJob && (
          <JobDetail
            job={selectedJob}
            user={user}
            avatarSrc={userProfiles.get(selectedJob.user_id)?.avatarUrl}
            authorName={userProfiles.get(selectedJob.user_id)?.name}
            relatedJobs={relatedJobsForSelected}
            onOpenRelatedJob={openJobDetails}
            isFav={isFavorite('jobs', selectedJob.id)}
            onToggleFavorite={() => toggleFavorite('jobs', selectedJob.id)}
          />
        )}
      </FullPageOverlay>

      {/* Portal detail page */}
      <FullPageOverlay show={!!selectedPortal} onClose={() => setSelectedPortal(null)} title={selectedPortal?.name || ''} eyebrow="Portal" headerVariant="floating">
        {selectedPortal && <PortalDetail portal={selectedPortal} defaultEmoji={selectedPortal.defaultEmoji || '🏠'} />}
      </FullPageOverlay>
    </div>
  )
}
