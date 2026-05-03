import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useFavorites } from '../hooks/useFavorites'
import { fetchAvatarsByIds } from '../lib/profiles'
import { C, PP, CAT_COLORS } from '../lib/theme'
import { MOCK_ADS, MOCK_JOBS, AD_CATS, AD_TYPES, CANTONS, formatAdLocation, getAdCat, normalizeAdCat } from '../lib/constants'
import { Tag, PrivacyTag, Avatar, Sheet, Btn, PillFilters, PhotoGallery } from '../components/UI'
import { getPublishTarget } from '../lib/publishTargets'

function fmtPrice(price) {
  if (!price) return ''
  let s = price.trim()
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

/* ── Compact ad card (list view) ────────────────────────── */
function AdCard({ ad, onClick, isFav, onToggleFav, avatarSrc }) {
  const normalizedCat = normalizeAdCat(ad.cat)
  const cat = getAdCat(ad.cat)
  const cc  = CAT_COLORS[normalizedCat] || { bg:C.primaryLight, tc:C.primary }
  const dateStr = ad.ts || (ad.created_at ? new Date(ad.created_at).toLocaleDateString('es-ES',{day:'numeric',month:'short'}) : '')
  const photos = getAdPhotos(ad)
  const coverPhoto = photos[0]
  const location = formatAdLocation(ad)
  return (
    <div onClick={onClick} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onClick()} style={{ background:'#fff', borderRadius:16, border:`1px solid ${C.border}`, overflow:'hidden', width:'100%', textAlign:'left', cursor:'pointer', position:'relative' }}>
      {coverPhoto && (
        <div style={{ position:'relative' }}>
          <img src={coverPhoto} alt={ad.title} style={{ width:'100%', height:'auto', maxHeight:220, objectFit:'contain', background:'#fff', display:'block' }}/>
          {photos.length > 1 && (
            <span style={{ position:'absolute', left:10, bottom:10, fontFamily:PP, fontSize:10, fontWeight:800, color:'#fff', background:'rgba(15,23,42,0.72)', borderRadius:999, padding:'4px 8px' }}>
              📷 {photos.length}
            </span>
          )}
        </div>
      )}
      <button
        onClick={e => { e.stopPropagation(); onToggleFav?.() }}
        style={{ position:'absolute', top:10, right:10, zIndex:2, background:'rgba(255,255,255,0.92)', border:'none', borderRadius:'50%', width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:17, boxShadow:'0 1px 6px rgba(0,0,0,0.12)' }}
        aria-label={isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      >
        {isFav ? '❤️' : '🤍'}
      </button>
      <div style={{ padding:'13px 15px' }}>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:8 }}>
          <Tag bg={cc.bg} color={cc.tc}>{cat?.emoji} {cat?.label}</Tag>
          {ad.sub && <Tag bg={C.bg} color={C.mid}>{ad.sub}</Tag>}
          <PrivacyTag privacy={ad.privacy}/>
        </div>
        <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:14, color:C.text, lineHeight:1.35, marginBottom:4 }}>{ad.title}</h3>
        {ad.desc && <p style={{ fontFamily:PP, fontSize:12, color:C.mid, lineHeight:1.5, marginBottom:8, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{ad.desc}</p>}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            <Avatar name={ad.user_name || ad.user} size={20} src={avatarSrc}/>
            <span style={{ fontFamily:PP, fontSize:10, color:C.light }}>{ad.user_name || ad.user || 'Usuario'} · 📍 {location || ad.canton}{dateStr ? ` · ${dateStr}` : ''}</span>
          </div>
          {ad.price && <span style={{ fontFamily:PP, fontSize:13, fontWeight:800, color:C.primary }}>{fmtPrice(ad.price)}</span>}
        </div>
      </div>
    </div>
  )
}

/* ── Full ad detail (inside Sheet) ─────────────────────── */
function AdDetail({ ad, user, avatarSrc }) {
  const navigate = useNavigate()
  const normalizedCat = normalizeAdCat(ad.cat)
  const cat = getAdCat(ad.cat)
  const cc  = CAT_COLORS[normalizedCat] || { bg:C.primaryLight, tc:C.primary }
  const isOwnAd = user && ad.user_id === user.id
  const recipientName = encodeURIComponent((ad.user_name || ad.user || '').trim())
  const photos = getAdPhotos(ad)
  const coverPhoto = photos[0]
  const location = formatAdLocation(ad)

  return (
    <div>
      {photos.length > 1 ? (
        <PhotoGallery photos={photos.slice(1)} mainPhoto={coverPhoto} />
      ) : coverPhoto && (
        <div style={{ borderRadius:12, overflow:'hidden', marginBottom:14, background:'#fff' }}>
          <img src={coverPhoto} alt={ad.title} style={{ width:'100%', height:'auto', maxHeight:280, objectFit:'contain', display:'block' }}/>
        </div>
      )}
      <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:10 }}>
        <Tag bg={cc.bg} color={cc.tc}>{cat?.emoji} {cat?.label}</Tag>
        {ad.sub && <Tag bg={C.bg} color={C.mid}>{ad.sub}</Tag>}
        <PrivacyTag privacy={ad.privacy}/>
        {ad.verified && <Tag bg="#D1FAE5" color="#065F46">✓ Verificado</Tag>}
      </div>
      <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:16, color:C.text, lineHeight:1.35, marginBottom:8 }}>{ad.title}</h3>
      {ad.desc && <p style={{ fontFamily:PP, fontSize:13, color:C.mid, lineHeight:1.75, marginBottom:14 }}>{ad.desc}</p>}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
        <div style={{ display:'flex', gap:7, alignItems:'center' }}>
          <Avatar name={ad.user_name || ad.user} size={22} src={avatarSrc}/>
          <span style={{ fontFamily:PP, fontSize:11, color:C.light }}>
            {ad.user_name || ad.user || 'Usuario'} · 📍 {location || ad.canton}
            {(ad.ts || ad.created_at) ? ` · ${ad.ts || new Date(ad.created_at).toLocaleDateString('es-ES',{day:'numeric',month:'short'})}` : ''}
          </span>
        </div>
        {ad.price && <span style={{ fontFamily:PP, fontSize:15, fontWeight:800, color:C.primary }}>{fmtPrice(ad.price)}</span>}
      </div>

      {!isOwnAd && user ? (
        <button onClick={() => navigate(`/mensajes?adId=${ad.id}${recipientName ? `&recipientName=${recipientName}` : ''}`)}
          style={{ width:'100%', fontFamily:PP, fontWeight:700, fontSize:13, background:'#F0FDF4', color:'#16A34A', border:'1.5px solid #86EFAC', borderRadius:13, padding:'13px 16px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          💬 Enviar mensaje
        </button>
      ) : !user ? (
        <div style={{ background:'#EFF6FF', border:`1px solid ${C.primaryMid}`, borderRadius:13, padding:'13px 16px', textAlign:'center' }}>
          <p style={{ fontFamily:PP, fontSize:12, color:C.primaryDark, margin:'0 0 8px' }}>Inicia sesión para contactar</p>
          <a href="/auth" style={{ fontFamily:PP, fontWeight:700, fontSize:12, background:C.primary, color:'#fff', textDecoration:'none', borderRadius:10, padding:'8px 16px', display:'inline-block' }}>Entrar →</a>
        </div>
      ) : null}
    </div>
  )
}

/* ── Compact job card (list view) ───────────────────────── */
function JobCard({ job, onClick, isFav, onToggleFav, avatarSrc }) {
  const languages = job.lang || (Array.isArray(job.languages) ? job.languages.join(' · ') : job.languages)
  return (
    <div onClick={onClick} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onClick()} style={{ background:'#fff', borderRadius:14, border:`1px solid ${C.border}`, padding:'15px 17px', display:'flex', alignItems:'center', gap:14, width:'100%', textAlign:'left', cursor:'pointer', position:'relative' }}>
      <div style={{ width:52, height:52, background:C.primaryLight, borderRadius:16, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>
        {job.logo_url
          ? <img src={job.logo_url} alt={job.company} style={{ width:'100%', height:'100%', objectFit:'contain' }} />
          : (job.emoji || '💼')}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3, flexWrap:'wrap' }}>
          <Tag bg="#E0F2FE" color="#0369A1">💼 Empleo</Tag>
          <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:15, color:C.text, margin:0 }}>{job.title || job.company}</h3>
          {job.type && <Tag bg={job.type==='Full-time'?C.primaryLight:'#D1FAE5'} color={job.type==='Full-time'?C.primary:'#065F46'}>{job.type}</Tag>}
        </div>
        {job.company && job.company !== job.title && <p style={{ fontFamily:PP, fontSize:11, color:C.mid, margin:'0 0 2px' }}>🏢 {job.company}</p>}
        <p style={{ fontFamily:PP, fontSize:12, color:C.light, margin:'0 0 2px' }}>📍 {job.city || job.canton}</p>
        {languages && <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>🗣️ {languages}</p>}
        {job.salary && <p style={{ fontFamily:PP, fontSize:13, fontWeight:700, color:'#059669', margin:'4px 0 0' }}>{fmtPrice(job.salary)}</p>}
      </div>
      <button
        onClick={e => { e.stopPropagation(); onToggleFav?.() }}
        style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, padding:'4px', flexShrink:0 }}
        aria-label={isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      >
        {isFav ? '❤️' : '🤍'}
      </button>
    </div>
  )
}

/* ── Full job detail (inside Sheet) ─────────────────────── */
function JobDetail({ job, user }) {
  const navigate = useNavigate()
  const languages = job.lang || (Array.isArray(job.languages) ? job.languages.join(' · ') : job.languages)
  const isOwnJob = user && job.user_id === user.id

  return (
    <div>
      {job.logo_url && (
        <div style={{ width:'100%', borderRadius:16, overflow:'hidden', marginBottom:16, background:'#fff' }}>
          <img src={job.logo_url} alt={job.company} style={{ width:'100%', height:'auto', maxHeight:200, objectFit:'contain', display:'block' }} />
        </div>
      )}
      <div style={{ display:'flex', gap:14, alignItems:'flex-start', marginBottom:16 }}>
        {!job.logo_url && (
          <div style={{ width:60, height:60, background:C.primaryLight, borderRadius:18, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, flexShrink:0 }}>{job.emoji || '💼'}</div>
        )}
        <div style={{ flex:1 }}>
          {job.company && (
            <p style={{ fontFamily:PP, fontSize:13, fontWeight:600, color:C.mid, margin:'0 0 6px', lineHeight:1.4 }}>🏢 {job.company}</p>
          )}
          <p style={{ fontFamily:PP, fontSize:12, color:C.light, margin:'0 0 8px' }}>📍 {job.city || job.canton}</p>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            <Tag bg="#E0F2FE" color="#0369A1">💼 Empleo</Tag>
            {job.type && <Tag bg={job.type==='Full-time'?C.primaryLight:'#D1FAE5'} color={job.type==='Full-time'?C.primary:'#065F46'}>{job.type}</Tag>}
            {job.sector && <Tag bg={C.bg} color={C.mid}>{job.sector}</Tag>}
          </div>
        </div>
      </div>

      {job.salary && <p style={{ fontFamily:PP, fontWeight:800, fontSize:18, color:'#059669', marginBottom:14 }}>{fmtPrice(job.salary)}</p>}
      {languages && <p style={{ fontFamily:PP, fontSize:12, color:C.mid, marginBottom:12 }}>🗣️ Idiomas requeridos: {languages}</p>}
      {(job.desc || job.description) && (
        <p style={{ fontFamily:PP, fontSize:13, color:C.mid, lineHeight:1.75, marginBottom:20, paddingBottom:20, borderBottom:`1px solid ${C.border}` }}>
          {job.desc || job.description}
        </p>
      )}

      {!isOwnJob && user ? (
        <button onClick={() => navigate(`/mensajes?jobId=${job.id}`)}
          style={{ width:'100%', fontFamily:PP, fontWeight:700, fontSize:13, background:'#F0FDF4', color:'#16A34A', border:'1.5px solid #86EFAC', borderRadius:13, padding:'13px 16px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          💬 Enviar mensaje
        </button>
      ) : !user ? (
        <div style={{ background:'#EFF6FF', border:`1px solid ${C.primaryMid}`, borderRadius:13, padding:'13px 16px', textAlign:'center' }}>
          <p style={{ fontFamily:PP, fontSize:12, color:C.primaryDark, margin:'0 0 8px' }}>Inicia sesión para contactar</p>
          <a href="/auth" style={{ fontFamily:PP, fontWeight:700, fontSize:12, background:C.primary, color:'#fff', textDecoration:'none', borderRadius:10, padding:'8px 16px', display:'inline-block' }}>Entrar →</a>
        </div>
      ) : null}
    </div>
  )
}

/* ── Portal card ─────────────────────────────────────────── */
function PortalCard({ portal, defaultEmoji = '🏠', onClick }) {
  return (
    <button onClick={onClick} style={{ background:'#fff', borderRadius:14, border:`1px solid ${C.border}`, padding:'15px 17px', display:'flex', alignItems:'center', gap:14, width:'100%', textAlign:'left', cursor:'pointer' }}>
      <div style={{ width:52, height:52, background:C.primaryLight, borderRadius:16, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>
        {portal.photo_url
          ? <img src={portal.photo_url} alt={portal.name} style={{ width:'100%', height:'100%', objectFit:'contain' }} />
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
    <div>
      {portal.photo_url && (
        <div style={{ width:'100%', borderRadius:16, overflow:'hidden', marginBottom:16, background:'#fff' }}>
          <img src={portal.photo_url} alt={portal.name} style={{ width:'100%', height:'auto', maxHeight:200, objectFit:'contain', display:'block' }} />
        </div>
      )}
      <div style={{ display:'flex', gap:14, alignItems:'flex-start', marginBottom:16 }}>
        {!portal.photo_url && (
          <div style={{ width:60, height:60, background:C.primaryLight, borderRadius:18, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, flexShrink:0 }}>{defaultEmoji}</div>
        )}
        <div style={{ flex:1, minWidth:0 }}>
          <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:20, color:C.text, margin:'0 0 4px', lineHeight:1.2 }}>{portal.name}</h2>
          {portal.city && <p style={{ fontFamily:PP, fontSize:13, color:C.light, margin:0 }}>📍 {portal.city}</p>}
        </div>
      </div>
      {portal.description && (
        <div style={{ background:C.bg, borderRadius:14, padding:'14px 16px', marginBottom:16 }}>
          <p style={{ fontFamily:PP, fontSize:13, color:C.mid, margin:0, lineHeight:1.7 }}>{portal.description}</p>
        </div>
      )}
      {portal.website && (
        <a href={portal.website} target="_blank" rel="noreferrer"
          style={{ fontFamily:PP, fontWeight:700, fontSize:13, background:C.primary, color:'#fff', textDecoration:'none', padding:'13px 18px', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          🌐 Visitar sitio web ↗
        </a>
      )}
    </div>
  )
}

/* ── Main page ──────────────────────────────────────────── */
export default function Tablon() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { isLoggedIn, user } = useAuth()
  const { isFavorite, toggleFavorite } = useFavorites()
  const [userAvatars, setUserAvatars] = useState(new Map())
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
  const deferredSearch = useDeferredValue(search.trim().toLowerCase())

  const cat      = normalizeAdCat(searchParams.get('cat') || '')
  const type     = searchParams.get('type') || ''
  const canton   = searchParams.get('canton') || ''
  const plz      = searchParams.get('plz') || ''
  const privacy  = searchParams.get('privacy') || ''
  const jobType  = searchParams.get('jobType') || ''
  const maxPrice = searchParams.get('maxPrice') || ''
  const openAdId  = searchParams.get('openAd') || ''
  const openJobId = searchParams.get('openJob') || ''

  const isEmpleos  = cat === 'empleo'
  const isMercado  = cat === 'venta'

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
    const p = new URLSearchParams(searchParams)
    p.set('openAd', ad.id)
    p.delete('openJob')
    setSearchParams(p)
  }
  const closeAdDetails = () => {
    setSelectedAd(null)
    const p = new URLSearchParams(searchParams)
    p.delete('openAd')
    setSearchParams(p, { replace:true })
  }
  const openJobDetails = (job) => {
    setSelectedJob(job)
    const p = new URLSearchParams(searchParams)
    p.set('openJob', job.id)
    p.delete('openAd')
    setSearchParams(p)
  }
  const closeJobDetails = () => {
    setSelectedJob(null)
    const p = new URLSearchParams(searchParams)
    p.delete('openJob')
    setSearchParams(p, { replace:true })
  }
  const activeCount = isEmpleos
    ? [jobType, canton, plz].filter(Boolean).length
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
    fetchAvatarsByIds(ids).then(setUserAvatars)
  }, [ads, jobs])

  useEffect(() => {
    supabase.from('providers').select('id,name,description,website,photo_url,city,canton').eq('category','vivienda').eq('active',true).order('featured',{ascending:false}).order('name',{ascending:true})
      .then(({ data }) => { if (data?.length) setHousingPortals(data) })
    supabase.from('providers').select('id,name,description,website,photo_url,city,canton').eq('category','empleo').eq('active',true).order('featured',{ascending:false}).order('name',{ascending:true})
      .then(({ data }) => { if (data?.length) setEmploymentPortals(data) })
  }, [])

  const filteredAds = useMemo(() => ads.filter(a => {
    if (!(isLoggedIn || a.privacy === 'public')) return false
    if (cat && normalizeAdCat(a.cat) !== cat) return false
    if (type) {
      const typeMatches = cat === 'venta' && type === 'vende'
        ? a.type === 'vende' || a.type === 'ofrece'
        : a.type === type
      if (!typeMatches) return false
    }
    if (canton && a.canton !== canton) return false
    if (plz && !a.plz?.startsWith(plz)) return false
    if (privacy && a.privacy !== privacy) return false
    if (maxPrice && a.price) {
      const num = parseFloat(a.price.replace(/[^0-9.]/g, ''))
      if (!isNaN(num) && num > parseFloat(maxPrice)) return false
    }
    if (deferredSearch && !a.title.toLowerCase().includes(deferredSearch) && !a.desc?.toLowerCase().includes(deferredSearch)) return false
    return true
  }), [ads, canton, cat, deferredSearch, isLoggedIn, maxPrice, plz, privacy, type])

  const communityJobs = useMemo(() => {
    const fromJobs = jobs.filter(j =>
      (!jobType || j.type === jobType) &&
      (!canton || j.canton === canton) &&
      (!plz || j.plz?.startsWith(plz)) &&
      (!deferredSearch || j.title?.toLowerCase().includes(deferredSearch) || j.company?.toLowerCase().includes(deferredSearch))
    )
    const fromAds = ads.filter(a =>
      a.cat === 'empleo' &&
      (isLoggedIn || a.privacy === 'public') &&
      (!jobType || a.type === jobType) &&
      (!canton || a.canton === canton) &&
      (!plz || a.plz?.startsWith(plz)) &&
      (!deferredSearch || a.title?.toLowerCase().includes(deferredSearch) || a.desc?.toLowerCase().includes(deferredSearch))
    ).map(a => ({
      id: a.id, title: a.title, company: a.company || a.title, city: a.city || a.canton,
      canton: a.canton, type: a.type, salary: a.salary, emoji: a.emoji || '💼',
      logo_url: a.img_url || '', lang: a.lang, languages: a.languages,
      desc: a.desc, user_id: a.user_id, created_at: a.created_at,
    }))
    return [...fromJobs, ...fromAds]
  }, [ads, canton, deferredSearch, isLoggedIn, jobType, jobs, plz])

  const filteredJobs = communityJobs
  const tablonItems = useMemo(() => {
    if (cat) return filteredAds.map(ad => ({ kind:'ad', item:ad, sortDate:ad.created_at || '' }))

    return [
      ...filteredAds.map(ad => ({ kind:'ad', item:ad, sortDate:ad.created_at || '' })),
      ...filteredJobs.map(job => ({ kind:'job', item:job, sortDate:job.created_at || '' })),
    ].sort((a, b) => String(b.sortDate).localeCompare(String(a.sortDate)))
  }, [cat, filteredAds, filteredJobs])

  useEffect(() => {
    if (loading) return

    if (openJobId) {
      const job = filteredJobs.find(entry => String(entry.id) === openJobId)
        || jobs.find(entry => String(entry.id) === openJobId)
      if (job) {
        setSelectedJob(job)
        setSelectedAd(null)
      }
      return
    }

    setSelectedJob(null)

    if (!openAdId) {
      setSelectedAd(null)
      return
    }

    const ad = ads.find(entry => String(entry.id) === openAdId)
    if (ad) setSelectedAd(ad)
  }, [ads, filteredJobs, jobs, loading, openAdId, openJobId])


  const orderedCats = [...AD_CATS].sort((a, b) => {
    const priority = { vivienda:0, empleo:1, venta:2, servicios:3, cuidados:4, documentos:5 }
    return (priority[a.id] ?? 99) - (priority[b.id] ?? 99)
  })

  const catOptions  = [{ id:'', label:'Todos' }, ...orderedCats.map(c => ({ id:c.id, label:`${c.emoji} ${c.label}` }))]
  const typeOptions = [{ id:'', label:'Todos' }, ...AD_TYPES.map(t => ({ id:t.id, label:`${t.emoji} ${t.label}` }))]
  const jobTypeOpts = [{ id:'', label:'Todos' }, { id:'Full-time', label:'Fijo' }, { id:'Part-time', label:'Temporal' }]

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
            placeholder={isEmpleos ? 'Buscar empleo o empresa...' : 'Buscar en el tablón...'}
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
          {jobType  && <Tag bg={C.primaryMid} color={C.primaryDark}>💼 {jobType === 'Full-time' ? 'Fijo' : 'Temporal'}</Tag>}
          {type     && <Tag bg={C.primaryMid} color={C.primaryDark}>{AD_TYPES.find(t=>t.id===type)?.emoji} {AD_TYPES.find(t=>t.id===type)?.label}</Tag>}
          {maxPrice && <Tag bg={C.primaryMid} color={C.primaryDark}>💰 Máx. CHF {maxPrice}</Tag>}
          {privacy  && <Tag bg={C.primaryMid} color={C.primaryDark}>{privacy==='public'?'🌐 Público':'🔒 Privado'}</Tag>}
          <button onClick={clearFilters} style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.primary, background:'none', border:'none', cursor:'pointer', marginLeft:'auto' }}>✕ Limpiar</button>
        </div>
      )}


      {/* Results */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height:isEmpleos?90:160, borderRadius:16 }}/>)}
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
              <h3 style={{ fontFamily:PP, fontWeight:800, fontSize:18, color:C.text, marginBottom:8 }}>Sin ofertas ahora</h3>
              <p style={{ fontFamily:PP, fontSize:12, color:C.light }}>Vuelve pronto — se actualizan frecuentemente</p>
            </div>
          ) : (
            <>
              <p style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:C.light, letterSpacing:1, marginBottom:10 }}>EMPLEOS DE LA COMUNIDAD</p>
              <div style={{ display:'flex', flexDirection:'column', gap:CARD_STACK_GAP }}>
                {filteredJobs.map(j => (
                  <JobCard key={j.id} job={j} onClick={() => openJobDetails(j)} isFav={isFavorite('jobs', j.id)} onToggleFav={() => toggleFavorite('jobs', j.id)} avatarSrc={userAvatars.get(j.user_id)} />
                ))}
                <div style={{ marginTop:16, border:`2px dashed ${C.border}`, borderRadius:16, padding:'18px 20px', textAlign:'center', background:C.primaryLight }}>
                  <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:15, color:C.text, marginBottom:6 }}>¿Tienes una oferta de trabajo?</h3>
                  <p style={{ fontFamily:PP, fontSize:12, color:C.mid, marginBottom:12 }}>Publica gratis y llega a miles de personas en Suiza.</p>
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
              <div style={{ display:'flex', flexDirection:'column', gap:CARD_STACK_GAP }}>{filteredAds.map(ad => <AdCard key={ad.id} ad={ad} onClick={() => openAdDetails(ad)} isFav={isFavorite('ads', ad.id)} onToggleFav={() => toggleFavorite('ads', ad.id)} avatarSrc={userAvatars.get(ad.user_id)} />)}</div>
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
            <JobCard key={`job-${item.id}`} job={item} onClick={() => openJobDetails(item)} isFav={isFavorite('jobs', item.id)} onToggleFav={() => toggleFavorite('jobs', item.id)} avatarSrc={userAvatars.get(item.user_id)} />
          ) : (
            <AdCard key={`ad-${item.id}`} ad={item} onClick={() => openAdDetails(item)} isFav={isFavorite('ads', item.id)} onToggleFav={() => toggleFavorite('ads', item.id)} avatarSrc={userAvatars.get(item.user_id)} />
          ))}
        </div>
      )}

      {/* Filters sheet */}
      <Sheet show={showFilters} onClose={()=>setShowFilters(false)} title="⚙️ Filtros">
        {isEmpleos ? (
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

      {/* Ad detail sheet */}
      <Sheet show={!!selectedAd} onClose={closeAdDetails} title={selectedAd?.title || ''} syncHistory={false}>
        {selectedAd && (
          <AdDetail
            ad={selectedAd}
            user={user}
            avatarSrc={userAvatars.get(selectedAd.user_id)}
          />
        )}
      </Sheet>

      {/* Job detail sheet */}
      <Sheet show={!!selectedJob} onClose={closeJobDetails} title={selectedJob?.title || ''} syncHistory={false}>
        {selectedJob && <JobDetail job={selectedJob} user={user} />}
      </Sheet>

      {/* Portal detail sheet */}
      <Sheet show={!!selectedPortal} onClose={() => setSelectedPortal(null)} title={selectedPortal?.name || ''}>
        {selectedPortal && <PortalDetail portal={selectedPortal} defaultEmoji={selectedPortal.defaultEmoji || '🏠'} />}
      </Sheet>
    </div>
  )
}
