import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useFavorites } from '../hooks/useFavorites'
import { fetchPublicProfilesByIds } from '../lib/profiles'
import { trackSearchEvent } from '../lib/analytics'
import { C, PP, CAT_COLORS } from '../lib/theme'
import { MOCK_ADS, MOCK_JOBS, AD_CATS, AD_TYPES, CANTONS, JOB_INTENTS, JOB_TYPES, formatAdLocation, getAdCategoryId, getAdDisplayCat, getAdDisplayEmoji, getAdSubOption, getJobIntentId, getJobIntentMeta, normalizeAdCat } from '../lib/constants'
import { Tag, PrivacyTag, Avatar, Sheet, FullPageOverlay, Btn, PhotoGallery, ImageLightbox, Stars, ReviewForm, ReviewList } from '../components/UI'
import FavoriteButton from '../components/FavoriteButton'
import DetailActionBar from '../components/DetailActionBar'
import CompactFilterSelect from '../components/CompactFilterSelect'
import { getAdPath, getIdFromSlug, getJobPath } from '../lib/seo'
import { readOfflineSnapshot, writeOfflineSnapshot } from '../lib/offlineCache'
import { getThumbnailImageUrl } from '../lib/imageVariants'
import toast from 'react-hot-toast'

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
const CARD_STACK_GAP = 10
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

function getJobIntentTag(job) {
  const intent = getJobIntentMeta(job)
  return { ...intent, ...(JOB_INTENT_TAG_STYLE[intent.id] || JOB_INTENT_TAG_STYLE.ofrece) }
}

function getAdIntentTag(ad={}) {
  const type = AD_TYPES.find(item => item.id === ad.type)
  if (!type) return null
  return {
    ...type,
    emoji: AD_TYPE_CARD_EMOJI[type.id] || type.emoji,
    shortLabel: AD_TYPE_SHORT_LABEL[type.id] || type.label,
    ...(AD_TYPE_TAG_STYLE[type.id] || AD_TYPE_TAG_STYLE.ofrece),
  }
}

function getTablonContext(cat='', isEmpleos=false) {
  if (isEmpleos) {
    return {
      title:'💼 Empleo',
      subtitle:'Ofertas de trabajo y perfiles disponibles en la comunidad.',
      resultLabel:'publicaciones de empleo',
      searchPlaceholder:'Buscar puesto, perfil, empresa o sector...',
      emptyTitle:'No hay empleos con estos filtros',
      emptyText:'Prueba otro cantón, otro tipo de empleo o publica una búsqueda.',
    }
  }

  const meta = AD_CATS.find(item => item.id === cat)
  if (meta) {
    return {
      title:`${meta.emoji} ${meta.label}`,
      subtitle:meta.desc,
      resultLabel:'anuncios',
      searchPlaceholder:`Buscar en ${meta.label.toLowerCase()}...`,
      emptyTitle:`Sin anuncios de ${meta.label.toLowerCase()}`,
      emptyText:'Prueba otros filtros o publica el primero.',
    }
  }

  return {
    title:'📌 Anuncios',
    subtitle:'Vivienda, servicios, cuidados, mercado y trámites de la comunidad.',
    resultLabel:'publicaciones',
    searchPlaceholder:'Buscar vivienda, servicios, productos o trámites...',
    emptyTitle:'Sin resultados',
    emptyText:'Prueba otros filtros o publica lo que buscas.',
  }
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
        {job.logo_url ? <img src={getThumbnailImageUrl(job.logo_url)} alt={job.title || job.company} loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:'contain', display:'block' }} /> : (job.emoji || '💼')}
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
  const normalizedCat = getAdCategoryId(ad)
  const cat = getAdDisplayCat(ad)
  const cc  = CAT_COLORS[normalizedCat] || { bg:C.primaryLight, tc:C.primary }
  const dateStr = ad.ts || (ad.created_at ? new Date(ad.created_at).toLocaleDateString('es-ES',{day:'numeric',month:'short'}) : '')
  const photos = getAdPhotos(ad)
  const coverPhoto = photos[0]
  const location = formatAdLocation(ad)
  const displayEmoji = getAdDisplayEmoji(ad)
  const subOption = getAdSubOption(normalizedCat, ad.sub)
  const metaBits = [ad.user_name || ad.user || 'Usuario', location || ad.canton, dateStr].filter(Boolean)
  const rating = averageRating(reviews)
  const showReviews = isReviewableAd(ad)
  const intent = getAdIntentTag(ad)
  return (
    <div onClick={onClick} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onClick()} style={{ ...LIST_CARD_STYLE, minHeight:136 }}>
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
          <Tag bg={cc.bg} color={cc.tc}>{cat?.emoji} {cat?.label}</Tag>
          {ad.sub && <Tag bg={C.bg} color={C.mid}>{subOption?.emoji ? `${subOption.emoji} ` : ''}{ad.sub}</Tag>}
          <PrivacyTag privacy={ad.privacy}/>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:7, marginTop:'auto', minWidth:0 }}>
          <Avatar name={ad.user_name || ad.user} size={18} src={avatarSrc}/>
          <span style={{ fontFamily:PP, fontSize:10, color:C.light, lineHeight:1.3, ...CLAMP_1 }}>{metaBits.join(' - ')}</span>
        </div>
      </div>
      <FavoriteButton isFav={isFav} onClick={onToggleFav} style={{ position:'absolute', top:10, right:10, width:34, height:34, fontSize:17 }} />
    </div>
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
          {ad.sub && <Tag bg={C.bg} color={C.mid}>{subOption?.emoji ? `${subOption.emoji} ` : ''}{ad.sub}</Tag>}
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
          <p style={{ fontFamily:PP, fontSize:12, color:C.light, margin:'0 0 4px' }}>Precio</p>
          <p style={{ fontFamily:PP, fontWeight:900, fontSize:28, color:C.primary, lineHeight:1.1, margin:0, ...WRAPPING_TEXT }}>{fmtPrice(ad.price)}</p>
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
  return (
    <div onClick={onClick} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onClick()} style={{ ...LIST_CARD_STYLE, minHeight:122 }}>
      <div style={{ ...LIST_THUMB_STYLE, background:C.primaryLight }}>
        {mediaSrc
          ? <img src={getThumbnailImageUrl(mediaSrc)} alt={job.company || job.title} loading="lazy" decoding="async" style={LIST_MEDIA_STYLE} />
          : <div style={LIST_FALLBACK_STYLE}>{job.emoji || '💼'}</div>}
      </div>
      <div style={{ flex:1, minWidth:0, padding:'1px 42px 1px 0', display:'flex', flexDirection:'column' }}>
        <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:14, color:C.text, lineHeight:1.32, margin:'0 0 4px', ...CLAMP_2 }}>{job.title || job.company}</h3>
        {job.salary && <p style={{ fontFamily:PP, fontSize:14, fontWeight:800, color:C.primary, lineHeight:1.15, margin:'0 0 5px', ...CLAMP_1 }}>{fmtPrice(job.salary)}</p>}
        {job.company && job.company !== job.title && <p style={{ fontFamily:PP, fontSize:11, color:C.mid, lineHeight:1.35, margin:'0 0 3px', ...CLAMP_1 }}>{isSeekingJob ? '👤' : '🏢'} {job.company}</p>}
        {languages && <p style={{ fontFamily:PP, fontSize:11, color:C.light, lineHeight:1.35, margin:'0 0 7px', ...CLAMP_1 }}>{languages}</p>}
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginTop:'auto' }}>
          <Tag bg={intent.bg} color={intent.color}>{intent.emoji} {intent.label}</Tag>
          {job.type && <Tag bg={job.type==='Full-time'?C.primaryLight:'#D1FAE5'} color={job.type==='Full-time'?C.primary:'#065F46'}>{job.type}</Tag>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:7, marginTop:7, minWidth:0 }}>
          <Avatar name={author} size={18} src={avatarSrc}/>
          <span style={{ fontFamily:PP, fontSize:10, color:C.light, lineHeight:1.3, ...CLAMP_1 }}>{metaBits.join(' - ')}</span>
        </div>
      </div>
      <FavoriteButton isFav={isFav} onClick={onToggleFav} style={{ position:'absolute', top:10, right:10, width:34, height:34, fontSize:17 }} />
    </div>
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
            <p style={{ fontFamily:PP, fontSize:13, fontWeight:700, color:C.mid, margin:'6px 0 0', lineHeight:1.4, ...WRAPPING_TEXT }}>{isSeekingJob ? 'Perfil' : 'Empresa'}: {job.company}</p>
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

      {(languages || job.desc || job.description) && (
        <div style={{ padding:'20px', borderBottom:`1px solid ${C.border}` }}>
          <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:18, color:C.text, margin:'0 0 10px' }}>Detalles</h2>
          {languages && <p style={{ fontFamily:PP, fontSize:13, color:C.mid, lineHeight:1.6, margin:'0 0 12px', ...WRAPPING_TEXT }}>Idiomas requeridos: {languages}</p>}
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
  const { isLoggedIn, user, displayName, userCanton, isAdmin } = useAuth()
  const { isFavorite, toggleFavorite } = useFavorites()
  const [userProfiles, setUserProfiles] = useState(new Map())
  const [ads, setAds] = useState(() => TABLON_CACHE.publicAds || [])
  const [jobs, setJobs] = useState(() => TABLON_CACHE.jobs || [])
  const [housingPortals, setHousingPortals] = useState([])
  const [employmentPortals, setEmploymentPortals] = useState([])
  const [loading, setLoading] = useState(() => !(TABLON_CACHE.publicAds || TABLON_CACHE.jobs))
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [portalsOpen, setPortalsOpen] = useState(false)
  const [selectedAd, setSelectedAd] = useState(null)
  const [selectedJob, setSelectedJob] = useState(null)
  const [selectedPortal, setSelectedPortal] = useState(null)
  const [adReviews, setAdReviews] = useState({})
  const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const deferredSearch = useDeferredValue(norm(search.trim()))

  const cat      = normalizeAdCat(searchParams.get('cat') || '')
  const type     = searchParams.get('type') || ''
  const canton   = searchParams.get('canton') || ''
  const plz      = searchParams.get('plz') || ''
  const privacy  = searchParams.get('privacy') || ''
  const jobType  = searchParams.get('jobType') || ''
  const jobIntent = searchParams.get('jobIntent') || ''
  const legacyMaxPrice = searchParams.get('maxPrice') || ''
  const priceRange = searchParams.get('priceRange') || ''
  const hasPriceFilter = Boolean(priceRange || legacyMaxPrice)
  const openAdId  = searchParams.get('openAd') || ''
  const openJobId = searchParams.get('openJob') || ''
  const routeAdId = adSlug ? getIdFromSlug(adSlug) : ''
  const routeJobId = jobSlug ? getIdFromSlug(jobSlug) : ''
  const targetOpenAdId = openAdId || routeAdId
  const targetOpenJobId = openJobId || routeJobId

  const isEmpleos  = cat === 'empleo'
  const isMercado  = cat === 'venta'
  const isCleanAdRoute = !!routeAdId
  const isCleanJobRoute = !!routeJobId

  const scrollPageTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }

  const setFilter = (k, v) => {
    const p = new URLSearchParams(searchParams)
    v ? p.set(k, v) : p.delete(k)
    setSearchParams(p, showFilters ? { replace:true } : undefined)
  }
  const setFilterAndScroll = (k, v) => {
    setFilter(k, v)
    scrollPageTop()
  }
  const setCategoryFilter = value => {
    const p = new URLSearchParams(searchParams)
    value ? p.set('cat', value) : p.delete('cat')

    if (value === 'empleo') {
      if (['busca', 'ofrece'].includes(type)) p.set('jobIntent', type)
      p.delete('type')
      p.delete('priceRange')
      p.delete('maxPrice')
      p.delete('privacy')
    } else {
      if (['busca', 'ofrece'].includes(jobIntent)) p.set('type', jobIntent)
      p.delete('jobIntent')
      p.delete('jobType')

      const nextType = p.get('type') || ''
      if (value === 'venta' && nextType === 'ofrece') p.delete('type')
      if (value && value !== 'venta' && ['vende', 'regala'].includes(nextType)) p.delete('type')
    }

    setSearchParams(p)
    scrollPageTop()
  }
  const setPriceRangeFilter = value => {
    const p = new URLSearchParams(searchParams)
    value ? p.set('priceRange', value) : p.delete('priceRange')
    p.delete('maxPrice')
    setSearchParams(p)
    scrollPageTop()
  }
  const clearFilters = () => {
    const p = new URLSearchParams()
    if (cat) p.set('cat', cat)
    setSearchParams(p, showFilters ? { replace:true } : undefined)
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
  const activeCount = isEmpleos
    ? [jobIntent, jobType, canton, plz].filter(Boolean).length
    : [type, canton, plz, privacy, hasPriceFilter].filter(Boolean).length
  const secondaryActiveCount = [plz, privacy].filter(Boolean).length

  useEffect(() => {
    if (isAdmin) return undefined

    const query = search.trim()
    if (query.length < 2) return undefined

    const timer = window.setTimeout(() => {
      trackSearchEvent({
        query,
        scope: isEmpleos ? 'empleos' : 'tablon',
        user_id: user?.id || null,
        metadata: {
          cat: cat || null,
          type: type || null,
          canton: canton || null,
          plz: plz || null,
          privacy: privacy || null,
          job_type: jobType || null,
          job_intent: jobIntent || null,
          price_range: priceRange || null,
          max_price: legacyMaxPrice || null,
        },
      })
    }, 900)

    return () => window.clearTimeout(timer)
  }, [canton, cat, isAdmin, isEmpleos, jobIntent, jobType, legacyMaxPrice, plz, priceRange, privacy, search, type, user?.id])


  useEffect(() => {
    setLoading(true)
    let cancelled = false

    async function loadJobs() {
      if (TABLON_CACHE.jobs) {
        setJobs(TABLON_CACHE.jobs)
        setLoading(false)
      }

      try {
        const { data, error } = await supabase.from('jobs').select('*').or('active.is.null,active.eq.true').order('created_at', { ascending:false }).limit(150)
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
        let query = supabase.from('listings').select('*').or('active.is.null,active.eq.true').order('created_at', { ascending:false }).limit(150)
        if (!isLoggedIn) query = query.or('privacy.is.null,privacy.eq.public')
        const { data, error } = await query
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

  const filteredAds = useMemo(() => ads.filter(a => {
    if (!(isLoggedIn || !a.privacy || a.privacy === 'public')) return false
    if (!cat && getAdCategoryId(a) === 'empleo') return false
    if (cat && getAdCategoryId(a) !== cat) return false
    if (type) {
      const typeMatches = cat === 'venta' && type === 'vende'
        ? a.type === 'vende' || a.type === 'ofrece'
        : a.type === type
      if (!typeMatches) return false
    }
    if (canton && a.canton !== canton) return false
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
    if (deferredSearch && !norm(a.title).includes(deferredSearch) && !norm(a.desc).includes(deferredSearch)) return false
    return true
  }), [ads, canton, cat, deferredSearch, hasPriceFilter, isLoggedIn, legacyMaxPrice, plz, priceRange, privacy, type])

  const communityJobs = useMemo(() => {
    const fromJobs = jobs.filter(j =>
      (!jobIntent || getJobIntentId(j) === jobIntent) &&
      (!jobType || j.type === jobType) &&
      (!canton || j.canton === canton) &&
      (!plz || j.plz?.startsWith(plz)) &&
      (!deferredSearch || norm(j.title).includes(deferredSearch) || norm(j.company).includes(deferredSearch) || norm(getJobIntentMeta(j).label).includes(deferredSearch))
    )
    const fromAds = []
    for (const a of ads) {
      if (
        getAdCategoryId(a) === 'empleo' &&
        (isLoggedIn || !a.privacy || a.privacy === 'public') &&
        (!jobIntent || getJobIntentId(a) === jobIntent) &&
        (!jobType || a.type === jobType || a.sub === jobType) &&
        (!canton || a.canton === canton) &&
        (!plz || a.plz?.startsWith(plz)) &&
        (!deferredSearch || norm(a.title).includes(deferredSearch) || norm(a.desc).includes(deferredSearch) || norm(getJobIntentMeta(a).label).includes(deferredSearch))
      ) {
        fromAds.push({
          id: a.id, title: a.title, company: a.company || a.title, city: a.city || a.canton,
          canton: a.canton, type: ['busca','ofrece'].includes(a.type) ? (a.sub || '') : a.type, job_intent: getJobIntentId(a), salary: a.salary, emoji: a.emoji || '\u{1F4BC}',
          logo_url: getAdPhotos(a)[0] || '', lang: a.lang, languages: a.languages,
          desc: a.desc, user_id: a.user_id, user_name: a.user_name, user: a.user, created_at: a.created_at,
        })
      }
    }
    return [...fromJobs, ...fromAds]
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
  }, [ads, canton, deferredSearch, isLoggedIn, jobIntent, jobType, jobs, plz])

  const filteredJobs = communityJobs
  const tablonItems = useMemo(() => {
    if (cat) return filteredAds.map(ad => ({ kind:'ad', item:ad, sortDate:ad.created_at || '' }))

    const jobsForCurrentFilters = hasPriceFilter
      ? []
      : type
        ? ['busca', 'ofrece'].includes(type)
          ? filteredJobs.filter(job => getJobIntentId(job) === type)
          : []
        : filteredJobs

    return [
      ...filteredAds.map(ad => ({ kind:'ad', item:ad, sortDate:ad.created_at || '' })),
      ...jobsForCurrentFilters.map(job => ({ kind:'job', item:job, sortDate:job.created_at || '' })),
    ].sort((a, b) => String(b.sortDate).localeCompare(String(a.sortDate)))
  }, [cat, filteredAds, filteredJobs, hasPriceFilter, type])

  const relatedAdsForSelected = useMemo(() => {
    if (!selectedAd) return []
    const selectedCat = getAdCategoryId(selectedAd)
    const selectedSub = selectedAd.sub || ''

    return ads
      .filter(ad =>
        String(ad.id) !== String(selectedAd.id) &&
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
        getAdCategoryId(ad) === 'empleo' && (isLoggedIn || !ad.privacy || ad.privacy === 'public')
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
        || jobs.find(entry => String(entry.id) === targetOpenJobId)
      if (job) {
        setSelectedJob(job)
        setSelectedAd(null)
      }
      return
    }

    setSelectedJob(null)

    if (!targetOpenAdId) {
      setSelectedAd(null)
      return
    }

    const ad = ads.find(entry => String(entry.id) === targetOpenAdId)
    if (ad) setSelectedAd(ad)
  }, [ads, filteredJobs, jobs, loading, targetOpenAdId, targetOpenJobId])


  const orderedCats = [...AD_CATS].sort((a, b) => {
    const priority = { vivienda:0, empleo:1, venta:2, servicios:3, cuidados:4, documentos:5 }
    return (priority[a.id] ?? 99) - (priority[b.id] ?? 99)
  })

  const catOptions = [{ id:'', label:'Todos' }, ...orderedCats.map(c => ({ id:c.id, label:`${c.emoji} ${c.label}` }))]
  const cantonOptions = [{ id:'', label:'Toda Suiza' }, ...CANTONS.map(c => ({ id:c.code, label:`${c.code} · ${c.name}` }))]
  const generalIntentOptions = [{ id:'', label:'Todas' }, ...AD_TYPES.map(t => ({ id:t.id, label:`${t.emoji} ${t.label}` }))]
  const standardIntentOptions = [{ id:'', label:'Todas' }, ...AD_TYPES.flatMap(t => ['busca', 'ofrece'].includes(t.id) ? [{ id:t.id, label:`${t.emoji} ${t.label}` }] : [])]
  const marketIntentOptions = [{ id:'', label:'Todas' }, ...AD_TYPES.flatMap(t => ['busca', 'vende', 'regala'].includes(t.id) ? [{ id:t.id, label:`${t.emoji} ${t.label}` }] : [])]
  const jobIntentOptions = [{ id:'', label:'Todas' }, ...JOB_INTENTS.map(intent => ({ id:intent.id, label:`${intent.emoji} ${intent.label}` }))]
  const jobTypeOptions = [{ id:'', label:'Todos' }, ...JOB_TYPES.map(jobTypeOption => ({ id:jobTypeOption.id, label:`${jobTypeOption.emoji} ${jobTypeOption.label}` }))]
  const intentOptions = isEmpleos
    ? jobIntentOptions
    : isMercado
      ? marketIntentOptions
      : cat
        ? standardIntentOptions
        : generalIntentOptions
  const intentValue = isEmpleos ? jobIntent : type
  const pageContext = getTablonContext(cat, isEmpleos)

  return (
    <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 20px 100px' }}>
      <div style={{ width:'100vw', marginLeft:'calc(50% - 50vw)', marginRight:'calc(50% - 50vw)', background:C.bg }}>
        <div style={{ width:'100%', maxWidth:1240, margin:'0 auto', padding:'24px 20px 0px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:24, color:C.text, letterSpacing:0, marginBottom:4 }}>
            {pageContext.title}
          </h1>
          <p style={{ fontFamily:PP, fontSize:13, color:C.mid, lineHeight:1.55, margin:'0 0 3px' }}>
            {pageContext.subtitle}
          </p>
          {canton && (
            <p style={{ fontFamily:PP, fontSize:12, color:C.light, margin:0 }}>
              📍 Cantón {canton}
            </p>
          )}
        </div>
      </div>

        </div>
      </div>

      <div className="cat-bar sticky-toolbar-shell" style={{ width:'100vw', marginLeft:'calc(50% - 50vw)', marginRight:'calc(50% - 50vw)', marginBottom:18, padding:'10px 0 12px' }}>
        <div style={{ width:'100%', maxWidth:1240, margin:'0 auto', padding:'0 8px' }}>
          <div className="tablon-toolbar-card" style={{ background:'#fff', border:`1px solid ${C.border}`, borderRadius:22, padding:12, boxShadow:'0 10px 24px rgba(15,23,42,0.06)' }}>
      {/* Search */}
      <div style={{ display:'flex', gap:8, marginBottom:10 }}>
        <div style={{ flex:1, position:'relative' }}>
          <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:14, color:C.light }}>🔍</span>
          <input
            style={{ width:'100%', border:`1.5px solid ${C.border}`, borderRadius:13, padding:'10px 12px 10px 34px', fontSize:12, fontFamily:PP, outline:'none', background:'#fff', color:C.text, boxSizing:'border-box' }}
            placeholder={pageContext.searchPlaceholder}
            value={search} onChange={e=>setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Contextual filters */}
      <div className="tablon-filter-row no-scroll">
        <CompactFilterSelect
          className="tablon-filter-category"
          label="Categoría"
          value={cat}
          options={catOptions}
          onChange={setCategoryFilter}
        />
        <CompactFilterSelect
          label="Cantón"
          value={canton}
          options={cantonOptions}
          onChange={value => setFilterAndScroll('canton', value)}
        />
        <CompactFilterSelect
          className="tablon-filter-intent"
          label="Intención"
          value={intentValue}
          options={intentOptions}
          onChange={value => setFilterAndScroll(isEmpleos ? 'jobIntent' : 'type', value)}
        />
        {isEmpleos ? (
          <CompactFilterSelect
            className="tablon-filter-context"
            label="Tipo de empleo"
            value={jobType}
            options={jobTypeOptions}
            onChange={value => setFilterAndScroll('jobType', value)}
          />
        ) : (
          <CompactFilterSelect
            className="tablon-filter-context"
            label="Precio"
            value={priceRange}
            options={PRICE_RANGES}
            onChange={setPriceRangeFilter}
          />
        )}
        <button
          type="button"
          className={`tablon-more-filter-button ${secondaryActiveCount ? 'is-active' : ''}`}
          onClick={()=>setShowFilters(true)}
        >
          <span>⚙️</span>
          <span>Más</span>
          {secondaryActiveCount > 0 && <strong>{secondaryActiveCount}</strong>}
        </button>
        {activeCount > 0 && (
          <button type="button" className="tablon-clear-filter-button" onClick={clearFilters} aria-label="Limpiar todos los filtros">
            ✕
          </button>
        )}
      </div>
          </div>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height:isEmpleos?122:136, borderRadius:16 }}/>)}
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
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {employmentPortals.map(p => (
                    <PortalCard key={p.id} portal={p} defaultEmoji="💼" onClick={() => setSelectedPortal({ ...p, defaultEmoji:'💼' })} />
                  ))}
                </div>
              )}
            </div>
          )}
          {filteredJobs.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 20px' }}>
              <div style={{ fontSize:52, marginBottom:14 }}>📭</div>
              <h3 style={{ fontFamily:PP, fontWeight:800, fontSize:18, color:C.text, marginBottom:8 }}>{pageContext.emptyTitle}</h3>
              <p style={{ fontFamily:PP, fontSize:12, color:C.light, margin:'0 0 16px' }}>{pageContext.emptyText}</p>
              <Link to="/publicar-empleo" style={{ fontFamily:PP, fontWeight:700, fontSize:13, background:C.primary, color:'#fff', textDecoration:'none', borderRadius:13, padding:'11px 22px', display:'inline-flex', alignItems:'center', gap:6 }}>Publicar empleo</Link>
            </div>
          ) : (
            <>
              <p style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:C.light, letterSpacing:1, marginBottom:10 }}>EMPLEOS DE LA COMUNIDAD</p>
              <div style={{ display:'flex', flexDirection:'column', gap:CARD_STACK_GAP }}>
                {filteredJobs.map(j => (
                  <JobCard key={j.id} job={j} onClick={() => openJobDetails(j)} isFav={isFavorite('jobs', j.id)} onToggleFav={() => toggleFavorite('jobs', j.id)} avatarSrc={userProfiles.get(j.user_id)?.avatarUrl} authorName={userProfiles.get(j.user_id)?.name} />
                ))}
                <div style={{ marginTop:16, border:`2px dashed ${C.border}`, borderRadius:16, padding:'18px 20px', textAlign:'center', background:C.primaryLight }}>
                  <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:15, color:C.text, marginBottom:6 }}>¿Buscas u ofreces trabajo?</h3>
                  <p style={{ fontFamily:PP, fontSize:12, color:C.mid, marginBottom:12 }}>Publica gratis y llega a la comunidad hispanohablante en Suiza.</p>
                  <Link to="/publicar-empleo" style={{ fontFamily:PP, fontWeight:700, fontSize:12, background:C.primary, color:'#fff', textDecoration:'none', padding:'10px 22px', borderRadius:13, display:'inline-flex' }}>Publicar empleo gratis</Link>
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
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {housingPortals.map(p => (
                  <PortalCard key={p.id} portal={p} defaultEmoji="🏠" onClick={() => setSelectedPortal({ ...p, defaultEmoji:'🏠' })} />
                ))}
              </div>
            )}
          </div>
          {filteredAds.length > 0 && (
            <>
              <p style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:C.light, letterSpacing:1, marginBottom:10 }}>ANUNCIOS DE LA COMUNIDAD</p>
              <div style={{ display:'flex', flexDirection:'column', gap:CARD_STACK_GAP }}>{filteredAds.map(ad => <AdCard key={ad.id} ad={ad} onClick={() => openAdDetails(ad)} isFav={isFavorite('ads', ad.id)} onToggleFav={() => toggleFavorite('ads', ad.id)} avatarSrc={userProfiles.get(ad.user_id)?.avatarUrl} reviews={adReviews[ad.id] || []} />)}</div>
            </>
          )}
        </>
      ) : tablonItems.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 20px' }}>
          <div style={{ fontSize:52, marginBottom:14 }}>📭</div>
          <h3 style={{ fontFamily:PP, fontWeight:800, fontSize:18, color:C.text, marginBottom:8 }}>{pageContext.emptyTitle}</h3>
          <p style={{ fontFamily:PP, fontSize:12, color:C.light, marginBottom:16 }}>{pageContext.emptyText}</p>
          <Link to={cat && cat !== 'empleo' ? `/publicar?cat=${encodeURIComponent(cat)}` : '/publicar'} style={{ fontFamily:PP, fontWeight:700, fontSize:13, background:C.primary, color:'#fff', textDecoration:'none', borderRadius:13, padding:'11px 22px', display:'inline-flex', alignItems:'center', gap:6 }}>Publicar anuncio</Link>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:CARD_STACK_GAP }}>
          {tablonItems.map(({ kind, item }) => kind === 'job' ? (
            <JobCard key={`job-${item.id}`} job={item} onClick={() => openJobDetails(item)} isFav={isFavorite('jobs', item.id)} onToggleFav={() => toggleFavorite('jobs', item.id)} avatarSrc={userProfiles.get(item.user_id)?.avatarUrl} authorName={userProfiles.get(item.user_id)?.name} />
          ) : (
            <AdCard key={`ad-${item.id}`} ad={item} onClick={() => openAdDetails(item)} isFav={isFavorite('ads', item.id)} onToggleFav={() => toggleFavorite('ads', item.id)} avatarSrc={userProfiles.get(item.user_id)?.avatarUrl} reviews={adReviews[item.id] || []} />
          ))}
        </div>
      )}

      {/* Filters sheet */}
      <Sheet show={showFilters} onClose={()=>setShowFilters(false)} title="Más filtros">
        <div style={{ marginBottom:22 }}>
          <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, marginBottom:10 }}>PLZ (código postal)</p>
          <input
            style={{ width:'100%', border:`1.5px solid ${plz?C.primary:C.border}`, borderRadius:12, padding:'11px 14px', fontSize:13, fontFamily:PP, outline:'none', background:'#fff', color:C.text, boxSizing:'border-box' }}
            placeholder="Ej: 8001, 3000, 1200..." value={plz} onChange={e=>setFilter('plz',e.target.value)} maxLength={4}
          />
        </div>

        {!isEmpleos && isLoggedIn && (
          <div style={{ marginBottom:22 }}>
            <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, marginBottom:10 }}>VISIBILIDAD</p>
            <select
              value={privacy}
              onChange={event=>setFilter('privacy', event.target.value)}
              style={{ width:'100%', fontFamily:PP, fontSize:13, fontWeight:500, color:privacy?C.text:C.light, border:`1.5px solid ${privacy?C.primary:C.border}`, borderRadius:12, padding:'11px 14px', background:'#fff', outline:'none', cursor:'pointer' }}
            >
              <option value="">Todas las publicaciones</option>
              <option value="public">Públicas</option>
              <option value="private">Solo para usuarios</option>
            </select>
          </div>
        )}

        <Btn onClick={()=>setShowFilters(false)}>Aplicar filtros</Btn>
        {activeCount > 0 && (
          <button onClick={()=>{clearFilters();setShowFilters(false);}} style={{ fontFamily:PP, fontWeight:600, fontSize:12, color:C.mid, background:'none', border:'none', cursor:'pointer', width:'100%', marginTop:10, padding:'6px 0' }}>
            Limpiar todos los filtros
          </button>
        )}
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
