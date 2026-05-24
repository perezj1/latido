import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useFavorites } from '../hooks/useFavorites'
import { fetchPublicProfilesByIds } from '../lib/profiles'
import { C, PP, CAT_COLORS } from '../lib/theme'
import { MOCK_ADS, MOCK_JOBS, AD_CATS, AD_TYPES, CANTONS, JOB_INTENTS, formatAdLocation, getAdCategoryId, getAdDisplayCat, getAdDisplayEmoji, getAdSubOption, getJobIntentId, getJobIntentMeta, normalizeAdCat } from '../lib/constants'
import { Tag, PrivacyTag, Avatar, Sheet, FullPageOverlay, Btn, PillFilters, PhotoGallery, ImageLightbox } from '../components/UI'
import { getPublishTarget } from '../lib/publishTargets'
import ReportButton from '../components/ReportButton'
import ShareButton from '../components/ShareButton'
import FavoriteButton from '../components/FavoriteButton'
import { getAdPath, getIdFromSlug, getJobPath } from '../lib/seo'

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

const TABLON_CACHE_TTL = 5 * 60 * 1000
const TABLON_CACHE = {
  publicAds:null,
  publicAdsTs:0,
  privateAds:null,
  privateAdsTs:0,
  jobs:null,
  jobsTs:0,
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

function getJobIntentTag(job) {
  const intent = getJobIntentMeta(job)
  return { ...intent, ...(JOB_INTENT_TAG_STYLE[intent.id] || JOB_INTENT_TAG_STYLE.ofrece) }
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
        {photos[0] ? <img src={photos[0]} alt={ad.title} loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:'contain', display:'block' }} /> : getAdDisplayEmoji(ad)}
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
        {job.logo_url ? <img src={job.logo_url} alt={job.title || job.company} loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:'contain', display:'block' }} /> : (job.emoji || '💼')}
      </div>
      <div style={{ padding:10 }}>
        <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.text, lineHeight:1.35, margin:'0 0 6px', ...CLAMP_2 }}>{job.title || job.company}</p>
        {job.salary && <p style={{ fontFamily:PP, fontWeight:900, fontSize:13, color:'#059669', margin:'0 0 5px', ...CLAMP_1 }}>{fmtPrice(job.salary)}</p>}
        <p style={{ fontFamily:PP, fontSize:10, color:C.light, margin:0, ...CLAMP_1 }}>{intent.label}</p>
      </div>
    </button>
  )
}

/* ── Compact ad card (list view) ────────────────────────── */
function AdCard({ ad, onClick, isFav, onToggleFav, avatarSrc }) {
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
            <img src={coverPhoto} alt={ad.title} loading="lazy" decoding="async" style={LIST_MEDIA_STYLE}/>
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
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:7 }}>
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
function AdDetail({ ad, user, avatarSrc, relatedAds=[], onOpenRelatedAd }) {
  const navigate = useNavigate()
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const normalizedCat = getAdCategoryId(ad)
  const cat = getAdDisplayCat(ad)
  const cc  = CAT_COLORS[normalizedCat] || { bg:C.primaryLight, tc:C.primary }
  const isOwnAd = user && ad.user_id === user.id
  const recipientName = encodeURIComponent((ad.user_name || ad.user || '').trim())
  const photos = getAdPhotos(ad)
  const coverPhoto = photos[0]
  const location = formatAdLocation(ad)
  const subOption = getAdSubOption(normalizedCat, ad.sub)

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
            style={{ width:'100%', minHeight:260, maxHeight:420, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', border:'none', padding:0, cursor:'zoom-in', position:'relative' }}
          >
            <img src={coverPhoto} alt={ad.title} loading="lazy" decoding="async" style={{ width:'100%', height:'auto', maxHeight:420, objectFit:'contain', display:'block' }}/>
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
          <Tag bg={cc.bg} color={cc.tc}>{cat?.emoji} {cat?.label}</Tag>
          {ad.sub && <Tag bg={C.bg} color={C.mid}>{subOption?.emoji ? `${subOption.emoji} ` : ''}{ad.sub}</Tag>}
          <PrivacyTag privacy={ad.privacy}/>
          {ad.verified && <Tag bg="#D1FAE5" color="#065F46">✓ Verificado</Tag>}
        </div>
        <div style={{ display:'flex', gap:9, alignItems:'center', minWidth:0 }}>
          <Avatar name={ad.user_name || ad.user} size={34} src={avatarSrc}/>
          <div style={{ minWidth:0 }}>
            <p style={{ fontFamily:PP, fontSize:13, fontWeight:700, color:C.text, margin:'0 0 2px', ...WRAPPING_TEXT }}>{ad.user_name || ad.user || 'Usuario'}</p>
            <p style={{ fontFamily:PP, fontSize:12, color:C.light, lineHeight:1.4, margin:0, ...WRAPPING_TEXT }}>
              {location || ad.canton}
              {(ad.ts || ad.created_at) ? ` - ${ad.ts || new Date(ad.created_at).toLocaleDateString('es-ES',{day:'numeric',month:'short'})}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div style={{ padding:'18px 20px', borderBottom:`1px solid ${C.border}` }}>
        {ad.price && (
          <>
            <p style={{ fontFamily:PP, fontSize:12, color:C.light, margin:'0 0 4px' }}>Precio</p>
            <p style={{ fontFamily:PP, fontWeight:900, fontSize:28, color:C.primary, lineHeight:1.1, margin:'0 0 16px', ...WRAPPING_TEXT }}>{fmtPrice(ad.price)}</p>
          </>
        )}
        {!isOwnAd && user ? (
          <button onClick={() => navigate(`/mensajes?adId=${ad.id}${recipientName ? `&recipientName=${recipientName}` : ''}`)}
            style={{ width:'100%', fontFamily:PP, fontWeight:800, fontSize:14, background:'#10B981', color:'#fff', border:'none', borderRadius:8, padding:'15px 16px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:10 }}>
            Enviar mensaje
          </button>
        ) : !user ? (
          <a href="/auth" style={{ width:'100%', fontFamily:PP, fontWeight:800, fontSize:14, background:C.primary, color:'#fff', textDecoration:'none', borderRadius:8, padding:'15px 16px', display:'flex', alignItems:'center', justifyContent:'center', boxSizing:'border-box', marginBottom:10 }}>Inicia sesión para contactar</a>
        ) : null}
        {user && !isOwnAd && (
          <ReportButton
            contentType="listing"
            contentId={ad.id}
            ownerId={ad.user_id}
            title="Reportar"
            metadata={{ title: ad.title, cat: normalizedCat, sub: ad.sub }}
            style={{ width:'100%' }}
          />
        )}
      </div>

      {ad.desc && (
        <div style={{ padding:'20px', borderBottom:`1px solid ${C.border}` }}>
          <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:18, color:C.text, margin:'0 0 10px' }}>Descripción</h2>
          <p style={{ fontFamily:PP, fontSize:14, color:C.mid, lineHeight:1.75, margin:0, whiteSpace:'pre-line', ...WRAPPING_TEXT }}>{ad.desc}</p>
        </div>
      )}

      <RelatedRail title="Anuncios parecidos" empty={!relatedAds.length}>
        {relatedAds.map(item => (
          <RelatedAdCard key={item.id} ad={item} onClick={() => onOpenRelatedAd?.(item)} />
        ))}
      </RelatedRail>

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
          ? <img src={mediaSrc} alt={job.company || job.title} loading="lazy" decoding="async" style={LIST_MEDIA_STYLE} />
          : <div style={LIST_FALLBACK_STYLE}>{job.emoji || '💼'}</div>}
      </div>
      <div style={{ flex:1, minWidth:0, padding:'1px 42px 1px 0', display:'flex', flexDirection:'column' }}>
        <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:14, color:C.text, lineHeight:1.32, margin:'0 0 4px', ...CLAMP_2 }}>{job.title || job.company}</h3>
        {job.salary && <p style={{ fontFamily:PP, fontSize:14, fontWeight:800, color:'#059669', lineHeight:1.15, margin:'0 0 5px', ...CLAMP_1 }}>{fmtPrice(job.salary)}</p>}
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
function JobDetail({ job, user, avatarSrc, authorName, relatedJobs=[], onOpenRelatedJob }) {
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
          <div style={{ width:'100%', minHeight:240, maxHeight:380, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
            <img src={job.logo_url} alt={job.company || job.title} loading="lazy" decoding="async" style={{ width:'100%', height:'auto', maxHeight:380, objectFit:'contain', display:'block' }} />
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

      <div style={{ padding:'18px 20px', borderBottom:`1px solid ${C.border}` }}>
        {job.salary && (
          <>
            <p style={{ fontFamily:PP, fontSize:12, color:C.light, margin:'0 0 4px' }}>Salario</p>
            <p style={{ fontFamily:PP, fontWeight:900, fontSize:28, color:'#059669', lineHeight:1.1, margin:'0 0 16px', ...WRAPPING_TEXT }}>{fmtPrice(job.salary)}</p>
          </>
        )}
        {!isOwnJob && user ? (
          <button onClick={() => navigate(`/mensajes?jobId=${job.id}`)}
            style={{ width:'100%', fontFamily:PP, fontWeight:800, fontSize:14, background:'#10B981', color:'#fff', border:'none', borderRadius:8, padding:'15px 16px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:10 }}>
            Enviar mensaje
          </button>
        ) : !user ? (
          <a href="/auth" style={{ width:'100%', fontFamily:PP, fontWeight:800, fontSize:14, background:C.primary, color:'#fff', textDecoration:'none', borderRadius:8, padding:'15px 16px', display:'flex', alignItems:'center', justifyContent:'center', boxSizing:'border-box', marginBottom:10 }}>Inicia sesión para contactar</a>
        ) : null}
        {user && !isOwnJob && (
          <ReportButton
            contentType="job"
            contentId={job.id}
            ownerId={job.user_id}
            title="Reportar"
            metadata={{ title: job.title, company: job.company, job_intent: getJobIntentId(job), sector: job.sector }}
            style={{ width:'100%' }}
          />
        )}
      </div>

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

    </div>
  )
}

/* ── Portal card ─────────────────────────────────────────── */
function PortalCard({ portal, defaultEmoji = '🏠', onClick }) {
  return (
    <button onClick={onClick} style={{ ...LIST_CARD_STYLE, minHeight:106, borderRadius:14 }}>
      <div style={{ ...LIST_THUMB_STYLE, background:C.primaryLight, fontSize:24 }}>
        {portal.photo_url
          ? <img src={portal.photo_url} alt={portal.name} loading="lazy" decoding="async" style={LIST_MEDIA_STYLE} />
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
          <div style={{ width:'100%', minHeight:240, maxHeight:380, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
            <img src={portal.photo_url} alt={portal.name} loading="lazy" decoding="async" style={{ width:'100%', height:'auto', maxHeight:380, objectFit:'contain', display:'block' }} />
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
  const { isLoggedIn, user } = useAuth()
  const { isFavorite, toggleFavorite } = useFavorites()
  const [userProfiles, setUserProfiles] = useState(new Map())
  const [ads, setAds] = useState([])
  const [jobs, setJobs] = useState([])
  const [housingPortals, setHousingPortals] = useState([])
  const [employmentPortals, setEmploymentPortals] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [portalsOpen, setPortalsOpen] = useState(true)
  const [selectedAd, setSelectedAd] = useState(null)
  const [selectedJob, setSelectedJob] = useState(null)
  const [selectedPortal, setSelectedPortal] = useState(null)
  const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const deferredSearch = useDeferredValue(norm(search.trim()))

  const cat      = normalizeAdCat(searchParams.get('cat') || '')
  const type     = searchParams.get('type') || ''
  const canton   = searchParams.get('canton') || ''
  const plz      = searchParams.get('plz') || ''
  const privacy  = searchParams.get('privacy') || ''
  const jobType  = searchParams.get('jobType') || ''
  const jobIntent = searchParams.get('jobIntent') || ''
  const maxPrice = searchParams.get('maxPrice') || ''
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
  const clearFilters = () => {
    setSearchParams({}, showFilters ? { replace:true } : undefined)
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
    : [type, canton, plz, privacy, maxPrice].filter(Boolean).length
  const publishTarget = getPublishTarget('/tablon', searchParams.toString() ? `?${searchParams.toString()}` : '')


  useEffect(() => {
    setLoading(true)
    let cancelled = false

    async function loadJobs() {
      if (TABLON_CACHE.jobs) {
        setJobs(TABLON_CACHE.jobs)
        setLoading(false)
        if (Date.now() - TABLON_CACHE.jobsTs <= TABLON_CACHE_TTL) return
      }

      try {
        const { data, error } = await supabase.from('jobs').select('*').eq('active', true).order('created_at', { ascending:false }).limit(150)
        const nextJobs = error || !data?.length ? MOCK_JOBS : data
        TABLON_CACHE.jobs = nextJobs
        TABLON_CACHE.jobsTs = Date.now()
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
      const cachedAds = TABLON_CACHE[cacheKey]

      if (cachedAds) {
        setAds(cachedAds)
        setLoading(false)
        if (Date.now() - TABLON_CACHE[cacheTsKey] <= TABLON_CACHE_TTL) return
      }

      try {
        let query = supabase.from('listings').select('*').eq('active', true).order('created_at', { ascending:false }).limit(150)
        if (!isLoggedIn) query = query.eq('privacy', 'public')
        const { data, error } = await query
        const nextAds = error || !data?.length
          ? MOCK_ADS.filter(ad => isLoggedIn || ad.privacy === 'public')
          : data

        TABLON_CACHE[cacheKey] = nextAds
        TABLON_CACHE[cacheTsKey] = Date.now()
        if (!cancelled) setAds(nextAds)
      } catch {
        if (!cancelled) {
          setAds(TABLON_CACHE[cacheKey] || MOCK_ADS.filter(ad => isLoggedIn || ad.privacy === 'public'))
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
    if (!(isLoggedIn || a.privacy === 'public')) return false
    if (cat && getAdCategoryId(a) !== cat) return false
    if (type) {
      const typeMatches = cat === 'venta' && type === 'vende'
        ? a.type === 'vende' || a.type === 'ofrece'
        : a.type === type
      if (!typeMatches) return false
    }
    if (canton && a.canton && a.canton !== canton) return false
    if (plz && a.plz && !a.plz.startsWith(plz)) return false
    if (privacy && a.privacy !== privacy) return false
    if (maxPrice && a.price) {
      const num = parseFloat(a.price.replace(/[^0-9.]/g, ''))
      if (!isNaN(num) && num > parseFloat(maxPrice)) return false
    }
    if (deferredSearch && !norm(a.title).includes(deferredSearch) && !norm(a.desc).includes(deferredSearch)) return false
    return true
  }), [ads, canton, cat, deferredSearch, isLoggedIn, maxPrice, plz, privacy, type])

  const communityJobs = useMemo(() => {
    const fromJobs = jobs.filter(j =>
      (!jobIntent || getJobIntentId(j) === jobIntent) &&
      (!jobType || j.type === jobType) &&
      (!canton || !j.canton || j.canton === canton) &&
      (!plz || !j.plz || j.plz?.startsWith(plz)) &&
      (!deferredSearch || norm(j.title).includes(deferredSearch) || norm(j.company).includes(deferredSearch) || norm(getJobIntentMeta(j).label).includes(deferredSearch))
    )
    const fromAds = ads.filter(a =>
      a.cat === 'empleo' &&
      (isLoggedIn || a.privacy === 'public') &&
      (!jobIntent || getJobIntentId(a) === jobIntent) &&
      (!jobType || a.type === jobType || a.sub === jobType) &&
      (!canton || !a.canton || a.canton === canton) &&
      (!plz || !a.plz || a.plz?.startsWith(plz)) &&
      (!deferredSearch || norm(a.title).includes(deferredSearch) || norm(a.desc).includes(deferredSearch) || norm(getJobIntentMeta(a).label).includes(deferredSearch))
    ).map(a => ({
      id: a.id, title: a.title, company: a.company || a.title, city: a.city || a.canton,
      canton: a.canton, type: ['busca','ofrece'].includes(a.type) ? (a.sub || '') : a.type, job_intent: getJobIntentId(a), salary: a.salary, emoji: a.emoji || '💼',
      logo_url: getAdPhotos(a)[0] || '', lang: a.lang, languages: a.languages,
      desc: a.desc, user_id: a.user_id, user_name: a.user_name, user: a.user, created_at: a.created_at,
    }))
    return [...fromJobs, ...fromAds]
  }, [ads, canton, deferredSearch, isLoggedIn, jobIntent, jobType, jobs, plz])

  const filteredJobs = communityJobs
  const tablonItems = useMemo(() => {
    if (cat) return filteredAds.map(ad => ({ kind:'ad', item:ad, sortDate:ad.created_at || '' }))

    return [
      ...filteredAds.map(ad => ({ kind:'ad', item:ad, sortDate:ad.created_at || '' })),
      ...filteredJobs.map(job => ({ kind:'job', item:job, sortDate:job.created_at || '' })),
    ].sort((a, b) => String(b.sortDate).localeCompare(String(a.sortDate)))
  }, [cat, filteredAds, filteredJobs])

  const relatedAdsForSelected = useMemo(() => {
    if (!selectedAd) return []
    const selectedCat = getAdCategoryId(selectedAd)
    const selectedSub = selectedAd.sub || ''

    return ads
      .filter(ad =>
        String(ad.id) !== String(selectedAd.id) &&
        (isLoggedIn || ad.privacy === 'public') &&
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
      ...ads
        .filter(ad => ad.cat === 'empleo' && (isLoggedIn || ad.privacy === 'public'))
        .map(ad => ({
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
        })),
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

  const catOptions  = [{ id:'', label:'Todos' }, ...orderedCats.map(c => ({ id:c.id, label:`${c.emoji} ${c.label}` }))]
  const typeOptions = [{ id:'', label:'Todos' }, ...AD_TYPES.map(t => ({ id:t.id, label:`${t.emoji} ${t.label}` }))]
  const jobTypeOpts = [{ id:'', label:'Todos' }, { id:'Full-time', label:'Full-time' }, { id:'Part-time', label:'Part-time' }, { id:'Freelance', label:'Freelance' }, { id:'Prácticas', label:'Prácticas' }]

  return (
    <div style={{ maxWidth:800, margin:'0 auto', padding:'0 20px 100px' }}>
      <div style={{ width:'100vw', marginLeft:'calc(50% - 50vw)', marginRight:'calc(50% - 50vw)', background:C.bg }}>
        <div style={{ width:'100%', maxWidth:840, margin:'0 auto', padding:'24px 20px 0px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:24, color:C.text, letterSpacing:-0.5, marginBottom:4 }}>
            📌 Tablón de anuncios
          </h1>
          <p style={{ fontFamily:PP, fontSize:13, color:C.light }}>
            {loading ? 'Cargando...' : isEmpleos ? `${filteredJobs.length} anuncios encontrados` : `${filteredAds.length + (!cat ? filteredJobs.length : 0)} anuncios encontrados`}
            {canton && ` · 📍 Cantón ${canton}`}
          </p>
        </div>
      </div>

        </div>
      </div>

      <div className="cat-bar sticky-toolbar-shell" style={{ width:'100vw', marginLeft:'calc(50% - 50vw)', marginRight:'calc(50% - 50vw)', marginBottom:activeCount>0 ? 10 : 18, padding:'10px 0 12px' }}>
        <div style={{ width:'100%', maxWidth:840, margin:'0 auto', padding:'0 8px' }}>
          <div style={{ background:'#fff', border:`1px solid ${C.border}`, borderRadius:22, padding:12, boxShadow:'0 10px 24px rgba(15,23,42,0.06)' }}>
      {/* Search */}
      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <div style={{ flex:1, position:'relative' }}>
          <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:14, color:C.light }}>🔍</span>
          <input
            style={{ width:'100%', border:`1.5px solid ${C.border}`, borderRadius:13, padding:'10px 12px 10px 34px', fontSize:12, fontFamily:PP, outline:'none', background:'#fff', color:C.text, boxSizing:'border-box' }}
            placeholder={isEmpleos ? 'Buscar empleo, perfil o empresa...' : 'Buscar en el tablón...'}
            value={search} onChange={e=>setSearch(e.target.value)}
          />
        </div>
        <button onClick={()=>setShowFilters(true)} style={{ position:'relative', background: activeCount>0?C.primary:C.bg, border:`1.5px solid ${activeCount>0?C.primary:C.border}`, borderRadius:13, padding:'0 16px', cursor:'pointer', fontFamily:PP, fontSize:11, fontWeight:700, color: activeCount>0?'#fff':C.mid, display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
          ⚙️ Filtros
          {activeCount > 0 && <span style={{ background:'#fff', color:C.primary, borderRadius:'50%', width:16, height:16, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800 }}>{activeCount}</span>}
        </button>
      </div>

      {/* Category pills */}
      <div className="no-scroll" style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:2 }}>
        {catOptions.map(o => {
          const active = cat === o.id
          return (
            <button key={o.id} onClick={()=>setFilterAndScroll('cat', active?'':o.id)} style={{ fontFamily:PP, fontSize:10, fontWeight:600, padding:'5px 12px', borderRadius:20, border:`1.5px solid ${active?C.primary:C.border}`, background:active?C.primary:'#fff', color:active?'#fff':C.mid, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
              {o.label}
            </button>
          )
        })}
      </div>
          </div>
        </div>
      </div>


      {/* Active filter strip */}
      {activeCount > 0 && (
        <div style={{ background:C.primaryLight, borderRadius:10, padding:'6px 12px', display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', marginBottom:14 }}>
          {canton   && <Tag bg={C.primaryMid} color={C.primaryDark}>📍 Cantón {canton}</Tag>}
          {plz      && <Tag bg={C.primaryMid} color={C.primaryDark}>📮 PLZ {plz}</Tag>}
          {jobIntent && <Tag bg={C.primaryMid} color={C.primaryDark}>{JOB_INTENTS.find(intent=>intent.id===jobIntent)?.emoji} {JOB_INTENTS.find(intent=>intent.id===jobIntent)?.label}</Tag>}
          {jobType  && <Tag bg={C.primaryMid} color={C.primaryDark}>💼 {jobType}</Tag>}
          {type     && <Tag bg={C.primaryMid} color={C.primaryDark}>{AD_TYPES.find(t=>t.id===type)?.emoji} {AD_TYPES.find(t=>t.id===type)?.label}</Tag>}
          {maxPrice && <Tag bg={C.primaryMid} color={C.primaryDark}>💰 Máx. CHF {maxPrice}</Tag>}
          {privacy  && <Tag bg={C.primaryMid} color={C.primaryDark}>{privacy==='public'?'🌐 Público':'🔒 Privado'}</Tag>}
          <button onClick={clearFilters} style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.primary, background:'none', border:'none', cursor:'pointer', marginLeft:'auto' }}>✕ Limpiar</button>
        </div>
      )}


      {/* Results */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height:isEmpleos?122:136, borderRadius:16 }}/>)}
        </div>
      ) : isEmpleos ? (
        <>
          {employmentPortals.length > 0 && !deferredSearch && (
            <div style={{ marginBottom:16 }}>
              <button onClick={() => setPortalsOpen(o => !o)} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', cursor:'pointer', padding:0, marginBottom: portalsOpen ? 10 : 0 }}>
                <p style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:C.light, letterSpacing:1, margin:0 }}>PORTALES Y AGENCIAS DE EMPLEO</p>
                <span style={{ fontSize:10, color:C.light, transition:'transform .2s', display:'inline-block', transform: portalsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
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
              <h3 style={{ fontFamily:PP, fontWeight:800, fontSize:18, color:C.text, marginBottom:8 }}>Sin empleos ahora</h3>
              <p style={{ fontFamily:PP, fontSize:12, color:C.light }}>Vuelve pronto — se actualizan frecuentemente</p>
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
            <button onClick={() => setPortalsOpen(o => !o)} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', cursor:'pointer', padding:0, marginBottom: portalsOpen ? 10 : 0 }}>
              <p style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:C.light, letterSpacing:1, margin:0 }}>PORTALES Y AGENCIAS DE VIVIENDA</p>
              <span style={{ fontSize:10, color:C.light, transition:'transform .2s', display:'inline-block', transform: portalsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
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
              <div style={{ display:'flex', flexDirection:'column', gap:CARD_STACK_GAP }}>{filteredAds.map(ad => <AdCard key={ad.id} ad={ad} onClick={() => openAdDetails(ad)} isFav={isFavorite('ads', ad.id)} onToggleFav={() => toggleFavorite('ads', ad.id)} avatarSrc={userProfiles.get(ad.user_id)?.avatarUrl} />)}</div>
            </>
          )}
        </>
      ) : tablonItems.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 20px' }}>
          <div style={{ fontSize:52, marginBottom:14 }}>📭</div>
          <h3 style={{ fontFamily:PP, fontWeight:800, fontSize:18, color:C.text, marginBottom:8 }}>Sin resultados</h3>
          <p style={{ fontFamily:PP, fontSize:12, color:C.light, marginBottom:16 }}>Prueba otros filtros o sé el primero en publicar</p>
          <Link to={publishTarget.to} style={{ fontFamily:PP, fontWeight:700, fontSize:13, background:C.primary, color:'#fff', textDecoration:'none', borderRadius:13, padding:'11px 22px', display:'inline-flex', alignItems:'center', gap:6 }}>{publishTarget.label}</Link>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:CARD_STACK_GAP }}>
          {tablonItems.map(({ kind, item }) => kind === 'job' ? (
            <JobCard key={`job-${item.id}`} job={item} onClick={() => openJobDetails(item)} isFav={isFavorite('jobs', item.id)} onToggleFav={() => toggleFavorite('jobs', item.id)} avatarSrc={userProfiles.get(item.user_id)?.avatarUrl} authorName={userProfiles.get(item.user_id)?.name} />
          ) : (
            <AdCard key={`ad-${item.id}`} ad={item} onClick={() => openAdDetails(item)} isFav={isFavorite('ads', item.id)} onToggleFav={() => toggleFavorite('ads', item.id)} avatarSrc={userProfiles.get(item.user_id)?.avatarUrl} />
          ))}
        </div>
      )}

      {/* Filters sheet */}
      <Sheet show={showFilters} onClose={()=>setShowFilters(false)} title="⚙️ Filtros">
        {isEmpleos ? (
          <>
            <div style={{ marginBottom:18 }}>
              <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, marginBottom:10 }}>BUSCO / OFREZCO</p>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {[{ id:'', label:'Todo' }, ...JOB_INTENTS.map(intent => ({ id:intent.id, label:`${intent.emoji} ${intent.label}` }))].map(o => {
                  const active = jobIntent === o.id
                  return (
                    <button key={o.id || 'all'} onClick={()=>setFilterAndScroll('jobIntent', active?'':o.id)} style={{ fontFamily:PP, fontSize:11, fontWeight:600, padding:'7px 14px', borderRadius:20, border:`1.5px solid ${active?C.primary:C.border}`, background:active?C.primary:C.surface, color:active?'#fff':C.mid, cursor:'pointer' }}>
                      {o.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div style={{ marginBottom:18 }}>
              <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, marginBottom:10 }}>TIPO DE EMPLEO</p>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {jobTypeOpts.map(o => {
                  const active = jobType === o.id
                  return (
                    <button key={o.id} onClick={()=>setFilterAndScroll('jobType', active?'':o.id)} style={{ fontFamily:PP, fontSize:11, fontWeight:600, padding:'7px 14px', borderRadius:20, border:`1.5px solid ${active?C.primary:C.border}`, background:active?C.primary:C.surface, color:active?'#fff':C.mid, cursor:'pointer' }}>
                      {o.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        ) : isMercado ? (
          <>
            <div style={{ marginBottom:18 }}>
              <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, marginBottom:10 }}>QUÉ BUSCAS</p>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {[{ id:'', label:'Todo' }, { id:'vende', label:'🏷️ Se vende' }, { id:'busca', label:'🔍 Se busca' }, { id:'regala', label:'🎁 Se regala' }].map(o => {
                  const active = type === o.id
                  return (
                    <button key={o.id} onClick={()=>setFilterAndScroll('type', active?'':o.id)} style={{ fontFamily:PP, fontSize:11, fontWeight:600, padding:'7px 14px', borderRadius:20, border:`1.5px solid ${active?C.primary:C.border}`, background:active?C.primary:C.surface, color:active?'#fff':C.mid, cursor:'pointer' }}>
                      {o.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div style={{ marginBottom:18 }}>
              <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, marginBottom:10 }}>PRECIO MÁXIMO (CHF)</p>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {[{ id:'', label:'Cualquier precio' }, { id:'50', label:'Hasta 50' }, { id:'150', label:'Hasta 150' }, { id:'500', label:'Hasta 500' }, { id:'1000', label:'Hasta 1000' }].map(o => {
                  const active = maxPrice === o.id
                  return (
                    <button key={o.id} onClick={()=>setFilterAndScroll('maxPrice', active?'':o.id)} style={{ fontFamily:PP, fontSize:11, fontWeight:600, padding:'7px 14px', borderRadius:20, border:`1.5px solid ${active?C.primary:C.border}`, background:active?C.primary:C.surface, color:active?'#fff':C.mid, cursor:'pointer' }}>
                      {o.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        ) : (
          <div style={{ marginBottom:18 }}>
            <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, marginBottom:10 }}>TIPO DE ANUNCIO</p>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {typeOptions.map(o => {
                const active = type === o.id
                return (
                  <button key={o.id} onClick={()=>setFilterAndScroll('type', active?'':o.id)} style={{ fontFamily:PP, fontSize:11, fontWeight:600, padding:'7px 14px', borderRadius:20, border:`1.5px solid ${active?C.primary:C.border}`, background:active?C.primary:C.surface, color:active?'#fff':C.mid, cursor:'pointer' }}>
                    {o.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ marginBottom:18 }}>
          <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, marginBottom:10 }}>CANTÓN</p>
          <select
            value={canton}
            onChange={e=>setFilter('canton', e.target.value)}
            style={{ width:'100%', fontFamily:PP, fontSize:13, fontWeight:500, color:canton?C.text:C.light, border:`1.5px solid ${canton?C.primary:C.border}`, borderRadius:12, padding:'11px 14px', background:'#fff', outline:'none', cursor:'pointer', appearance:'auto' }}
          >
            <option value=''>Todos los cantones</option>
            {CANTONS.map(c => (
              <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom:22 }}>
          <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, marginBottom:10 }}>PLZ (código postal)</p>
          <input
            style={{ width:'100%', border:`1.5px solid ${plz?C.primary:C.border}`, borderRadius:12, padding:'11px 14px', fontSize:13, fontFamily:PP, outline:'none', background:'#fff', color:C.text, boxSizing:'border-box' }}
            placeholder="Ej: 8001, 3000, 1200..." value={plz} onChange={e=>setFilter('plz',e.target.value)} maxLength={4}
          />
        </div>

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
        actions={selectedAd && (
          <>
            <ShareButton
              title={selectedAd.title || 'Anuncio en Latido'}
              text={getAdShareText(selectedAd)}
              url={getAdPath(selectedAd)}
              ariaLabel="Compartir anuncio"
            />
            <FavoriteButton
              isFav={isFavorite('ads', selectedAd.id)}
              onClick={() => toggleFavorite('ads', selectedAd.id)}
              style={{ width:38, height:38, fontSize:18, border:`1px solid ${C.border}`, boxShadow:'0 4px 14px rgba(15,23,42,0.06)' }}
            />
          </>
        )}
      >
        {selectedAd && (
          <AdDetail
            ad={selectedAd}
            user={user}
            avatarSrc={userProfiles.get(selectedAd.user_id)?.avatarUrl}
            relatedAds={relatedAdsForSelected}
            onOpenRelatedAd={openAdDetails}
          />
        )}
      </FullPageOverlay>

      {/* Job detail page */}
      <FullPageOverlay
        show={!!selectedJob}
        onClose={closeJobDetails}
        title="Empleo"
        syncHistory={false}
        actions={selectedJob && (
          <>
            <ShareButton
              title={selectedJob.title || selectedJob.company || 'Empleo en Latido'}
              text={getJobShareText(selectedJob)}
              url={getJobPath(selectedJob)}
              ariaLabel="Compartir empleo"
            />
            <FavoriteButton
              isFav={isFavorite('jobs', selectedJob.id)}
              onClick={() => toggleFavorite('jobs', selectedJob.id)}
              style={{ width:38, height:38, fontSize:18, border:`1px solid ${C.border}`, boxShadow:'0 4px 14px rgba(15,23,42,0.06)' }}
            />
          </>
        )}
      >
        {selectedJob && (
          <JobDetail
            job={selectedJob}
            user={user}
            avatarSrc={userProfiles.get(selectedJob.user_id)?.avatarUrl}
            authorName={userProfiles.get(selectedJob.user_id)?.name}
            relatedJobs={relatedJobsForSelected}
            onOpenRelatedJob={openJobDetails}
          />
        )}
      </FullPageOverlay>

      {/* Portal detail page */}
      <FullPageOverlay show={!!selectedPortal} onClose={() => setSelectedPortal(null)} title={selectedPortal?.name || ''} eyebrow="Portal">
        {selectedPortal && <PortalDetail portal={selectedPortal} defaultEmoji={selectedPortal.defaultEmoji || '🏠'} />}
      </FullPageOverlay>
    </div>
  )
}
