import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { trackAnalyticsEvent, trackSearchEvent } from '../lib/analytics'
import { C, PP } from '../lib/theme'
import PartnerServicesPromo, { getPartnerServiceMatch } from './PartnerServicesPromo'
import { getEffectiveBusinessPromotionPlan } from '../lib/businessPromotion'
import {
  MOCK_ADS,
  MOCK_COMMUNITIES,
  MOCK_JOBS,
  MOCK_NEGOCIOS,
  MOCK_EVENTOS_LATINOS,
  MOCK_DOCS,
  formatAdLocation,
  getAdCategoryId,
  getAdDisplayCat,
  getAdDisplayEmoji,
  getJobCategoryEmoji,
  getJobIntentMeta,
  getNegocioTypeMeta,
  EVENTO_TYPES,
} from '../lib/constants'
import { SEARCHABLE_SITE_PAGES, getAdPath, getBusinessPath, getEventPath, getGuidePath, getJobPath } from '../lib/seo'
import { getThumbnailImageUrl } from '../lib/imageVariants'

const BUSINESS_EMOJI = {
  restaurante:'🍽️',
  barberia:'💇',
  tienda:'🛒',
  pasteleria:'🍰',
  belleza:'💇',
  hogar:'🏠',
  servicios_hogar:'🏠',
  salud:'🩺',
  salud_bienestar:'🩺',
  asesoria_tramites:'📄',
  servicios:'🏠',
  servicios_profesionales:'📄',
  otro:'✨',
}

const EVENT_EMOJI = {
  concierto:'🎵',
  festival:'🎪',
  quedada:'🤝',
  fiesta:'💃',
  networking:'💼',
  familia:'👨‍👩‍👧',
}

const EMPTY_DATASETS = Object.freeze({
  ads:[],
  jobs:[],
  communities:[],
  businesses:[],
  events:[],
  guides:[],
  pages:[],
})

const SEARCH_CACHE = {
  public:null,
  private:null,
}

const TYPE_COLORS = {
  ad:{ bg:'#DBEAFE', color:'#1D4ED8', label:'Anuncio' },
  job:{ bg:'#E0F2FE', color:'#0369A1', label:'Empleo' },
  community:{ bg:'#D1FAE5', color:'#065F46', label:'Grupo' },
  business:{ bg:'#FEF3C7', color:'#92400E', label:'Negocio' },
  event:{ bg:'#FCE7F3', color:'#9D174D', label:'Evento' },
  guide:{ bg:'#EDE9FE', color:'#6D28D9', label:'Guía' },
  page:{ bg:'#F1F5F9', color:'#475569', label:'Página' },
}

const SEARCH_PAGE_SIZE = 1000
const SEARCH_SELECTS = {
  ads: 'id, cat, title, desc, canton, plz, price, privacy, active, img_url, photo_urls, created_at',
  jobs: 'id, title, company, city, canton, type, sector, category, job_intent, emoji, logo_url, active, created_at',
  communities: 'id, name, city, members, emoji, cat, desc, photo_url, active',
  providers: 'id, name, category, city, canton, description, services, active, featured, verified, promotion_plan, promotion_starts_at, promotion_ends_at, photo_url, created_at',
  events: 'id, type, title, city, canton, venue, host, desc, emoji, img_url, active, featured, created_at',
}

const BUSINESS_SEARCH_PRIORITY = {
  premium:0,
  basic:1,
  featured:2,
  free:3,
}

function getCacheKey(isLoggedIn) {
  return isLoggedIn ? 'private' : 'public'
}

function getCachedSearchData(isLoggedIn) {
  return SEARCH_CACHE[getCacheKey(isLoggedIn)]
}

function setCachedSearchData(isLoggedIn, datasets) {
  SEARCH_CACHE[getCacheKey(isLoggedIn)] = datasets
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

function getFirstImage(...values) {
  for (const value of values) {
    if (Array.isArray(value)) {
      const first = value.find(Boolean)
      if (first) return first
    } else if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return ''
}

function normalizeCommunity(group) {
  if (!group || group.cat === 'fe') return null

  return {
    id: group.id,
    name: (group.name || 'Grupo').replace(/Mam[aá]s Latinas/gi, 'Familias Latinas'),
    city: group.city || 'Suiza',
    members: group.members || 0,
    emoji: group.emoji || '👥',
    desc: group.desc || group.description || '',
    image: group.photo_url || '',
  }
}

function normalizeBusiness(provider) {
  const promotionPlan = getEffectiveBusinessPromotionPlan(provider)

  return {
    id: provider.id,
    name: provider.name || 'Negocio',
    type: provider.type || provider.category || '',
    city: provider.city || provider.canton || 'Suiza',
    desc: provider.desc || provider.description || '',
    emoji: provider.emoji || BUSINESS_EMOJI[provider.category] || '🏪',
    services: Array.isArray(provider.services) ? provider.services : [],
    featured: !!provider.featured,
    verified: !!provider.verified,
    promotionPlan,
    photoUrl: provider.photo_url || provider.img || '',
    created_at: provider.created_at || '',
  }
}

function getBusinessSearchPlan(business) {
  if (business.promotionPlan && business.promotionPlan !== 'free') return business.promotionPlan
  return business.featured ? 'featured' : 'free'
}

function getBusinessSearchPriority(business) {
  return BUSINESS_SEARCH_PRIORITY[getBusinessSearchPlan(business)] ?? 9
}

function sortBusinessesByPromotion(a, b) {
  const planDiff = getBusinessSearchPriority(a) - getBusinessSearchPriority(b)
  if (planDiff !== 0) return planDiff
  if (a.featured !== b.featured) return a.featured ? -1 : 1
  if (a.verified !== b.verified) return a.verified ? -1 : 1
  return new Date(b.created_at || 0) - new Date(a.created_at || 0)
}

function normalizeEvent(event) {
  return {
    id: event.id,
    type: event.type || '',
    title: event.title || 'Evento',
    city: event.city || event.canton || 'Suiza',
    venue: event.venue || '',
    host: event.host || '',
    desc: event.desc || event.description || '',
    emoji: event.emoji || EVENT_EMOJI[event.type] || '🎉',
    image: event.img_url || event.img || event.photo_url || '',
  }
}

function normalizeAd(ad) {
  return {
    id: ad.id,
    cat: getAdCategoryId(ad) || '',
    title: ad.title || '',
    desc: ad.desc || ad.description || '',
    city: ad.city || '',
    canton: ad.canton || 'Toda Suiza',
    plz: ad.plz || '',
    price: ad.price || '',
    privacy: ad.privacy || 'public',
    image: getFirstImage(normalizePhotoUrls(ad.photo_urls), ad.img_url, ad.img),
  }
}

function normalizeJob(job) {
  const intent = getJobIntentMeta(job)
  return {
    id: job.id,
    title: job.title || '',
    company: job.company || (intent.id === 'busca' ? 'Perfil profesional' : 'Empresa'),
    city: job.city || job.canton || 'Suiza',
    type: job.type || 'Trabajo',
    intentLabel: intent.label,
    emoji: getJobCategoryEmoji(job),
    image: job.logo_url || job.img || '',
  }
}

function normalizeGuide(doc) {
  return {
    id: doc.id,
    title: doc.title || '',
    cat: doc.cat || '',
    summary: doc.summary || '',
    content: doc.content || '',
    time: doc.time || '',
    level: doc.level || '',
    emoji: doc.emoji || '📚',
    image: doc.img || doc.image || '',
  }
}

async function fetchAllRows(buildQuery) {
  const rows = []

  for (let from = 0; ; from += SEARCH_PAGE_SIZE) {
    const to = from + SEARCH_PAGE_SIZE - 1
    const res = await buildQuery().range(from, to)

    if (res.error) return res

    const data = res.data || []
    rows.push(...data)

    if (data.length < SEARCH_PAGE_SIZE) {
      return { data: rows, error:null }
    }
  }
}

function buildFallbackData(isLoggedIn) {
  return {
    ads: (isLoggedIn ? MOCK_ADS : MOCK_ADS.filter(ad => ad.privacy === 'public')).map(normalizeAd),
    jobs: MOCK_JOBS.map(normalizeJob),
    communities: MOCK_COMMUNITIES.map(normalizeCommunity).filter(Boolean),
    businesses: MOCK_NEGOCIOS.map(normalizeBusiness),
    events: MOCK_EVENTOS_LATINOS.map(normalizeEvent),
    guides: MOCK_DOCS.map(normalizeGuide),
    pages: SEARCHABLE_SITE_PAGES,
  }
}

function normalizeSearchValue(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function fieldIncludesSearch(value, query) {
  return normalizeSearchValue(value).includes(query)
}

function sortMatchingBusinesses(a, b) {
  const planDiff = getBusinessSearchPriority(a) - getBusinessSearchPriority(b)
  if (planDiff) return planDiff
  if (a.featured !== b.featured) return b.featured ? 1 : -1
  if (a.verified !== b.verified) return b.verified ? 1 : -1
  return String(b.created_at || '').localeCompare(String(a.created_at || ''))
}

function getBusinessPlanSearchLabel(business) {
  const plan = getBusinessSearchPlan(business)
  if (plan === 'premium') return 'Colaborador premium'
  if (plan === 'basic') return 'Colaborador básico'
  if (plan === 'featured') return 'Destacado'
  return ''
}

function searchAll(query, datasets, isLoggedIn) {
  const q = normalizeSearchValue(query)
  if (!q || q.length < 2) return []

  const results = []
  const metaSeparator = ' \u00B7 '

  for (const ad of datasets.ads) {
    if (
      (isLoggedIn || ad.privacy === 'public') && (
        fieldIncludesSearch(ad.title, q) ||
        fieldIncludesSearch(ad.desc, q) ||
        fieldIncludesSearch(ad.canton, q) ||
        fieldIncludesSearch(formatAdLocation(ad), q)
      )
    ) {
      const cat = getAdDisplayCat(ad)
      const location = formatAdLocation(ad)
      results.push({
        type:'ad',
        id:ad.id,
        icon:getAdDisplayEmoji(ad),
        image:ad.image,
        imageFit:'cover',
        label:ad.title,
        sub:[cat?.label || 'Anuncio', location, ad.price].filter(Boolean).join(metaSeparator),
        href:getAdPath(ad),
        privacy:ad.privacy,
      })
    }
  }

  for (const job of datasets.jobs) {
    if (
      fieldIncludesSearch(job.title, q) ||
      fieldIncludesSearch(job.company, q) ||
      fieldIncludesSearch(job.city, q) ||
      fieldIncludesSearch(job.intentLabel, q)
    ) {
      results.push({
        type:'job',
        id:job.id,
        icon:job.emoji || '\u{1F4BC}',
        image:job.image,
        imageFit:'contain',
        label:job.title,
        sub:[job.intentLabel, job.company, job.city, job.type].filter(Boolean).join(metaSeparator),
        href:getJobPath(job),
      })
    }
  }

  for (const group of datasets.communities) {
    if (
      fieldIncludesSearch(group.name, q) ||
      fieldIncludesSearch(group.desc, q) ||
      fieldIncludesSearch(group.city, q)
    ) {
      results.push({
        type:'community',
        id:group.id,
        icon:group.emoji || '\u{1F465}',
        image:group.image,
        imageFit:'cover',
        label:group.name,
        sub:['Grupo', group.city, `${group.members} miembros`].filter(Boolean).join(metaSeparator),
        href:`/comunidades?openCommunity=${encodeURIComponent(group.id)}`,
      })
    }
  }

  const matchingBusinesses = []
  for (const business of datasets.businesses) {
    if (
      fieldIncludesSearch(business.name, q) ||
      fieldIncludesSearch(business.desc, q) ||
      fieldIncludesSearch(business.city, q) ||
      business.services.some(service => fieldIncludesSearch(service, q))
    ) {
      matchingBusinesses.push(business)
    }
  }
  matchingBusinesses.sort(sortMatchingBusinesses)

  const recommendedPartner = matchingBusinesses.find(
    business => getBusinessSearchPlan(business) === 'premium'
  )

  if (recommendedPartner) {
    results.push({
      type:'business',
      id:recommendedPartner.id,
      icon:recommendedPartner.emoji || '\u{1F3EA}',
      image:recommendedPartner.photoUrl,
      imageFit:'contain',
      label:recommendedPartner.name,
      sub:recommendedPartner.services.slice(0, 3).join(metaSeparator) || recommendedPartner.desc || 'Servicios para la comunidad hispanohablante en Suiza.',
      href:getBusinessPath(recommendedPartner),
      isPartnerRecommendation:true,
      searchPriority:-2,
    })
  }

  for (const business of matchingBusinesses) {
    if (recommendedPartner && String(business.id) === String(recommendedPartner.id)) continue
    const planLabel = getBusinessPlanSearchLabel(business)

    results.push({
      type:'business',
      id:business.id,
      icon:business.emoji || '\u{1F3EA}',
      image:business.photoUrl,
      imageFit:'contain',
      label:business.name,
      sub:[planLabel, getNegocioTypeMeta(business.type)?.label || 'Negocio', business.city].filter(Boolean).join(metaSeparator),
      href:getBusinessPath(business),
      featured:business.featured,
      searchPriority:getBusinessSearchPriority(business),
    })
  }

  for (const event of datasets.events) {
    const eventType = EVENTO_TYPES.find(type => type.id === event.type)
    if (
      fieldIncludesSearch(event.title, q) ||
      fieldIncludesSearch(event.desc, q) ||
      fieldIncludesSearch(event.city, q) ||
      fieldIncludesSearch(event.venue, q) ||
      fieldIncludesSearch(event.host, q) ||
      fieldIncludesSearch(eventType?.label, q)
    ) {
      results.push({
        type:'event',
        id:event.id,
        icon:event.emoji || '\u{1F389}',
        image:event.image,
        imageFit:'cover',
        label:event.title,
        sub:[eventType?.label || 'Evento', event.city].filter(Boolean).join(metaSeparator),
        href:getEventPath(event),
      })
    }
  }

  for (const guide of datasets.guides || []) {
    if (
      fieldIncludesSearch(guide.title, q) ||
      fieldIncludesSearch(guide.summary, q) ||
      fieldIncludesSearch(guide.content, q) ||
      fieldIncludesSearch(guide.cat, q) ||
      fieldIncludesSearch(guide.time, q) ||
      fieldIncludesSearch(guide.level, q)
    ) {
      results.push({
        type:'guide',
        id:guide.id,
        icon:guide.emoji || '\u{1F4DA}',
        image:guide.image,
        imageFit:'cover',
        label:guide.title,
        sub:['Gu\u00EDa', guide.cat, guide.time, guide.level].filter(Boolean).join(metaSeparator),
        href:getGuidePath(guide),
      })
    }
  }

  for (const page of datasets.pages || []) {
    if (
      fieldIncludesSearch(page.title, q) ||
      fieldIncludesSearch(page.section, q) ||
      fieldIncludesSearch(page.desc, q)
    ) {
      results.push({
        type:'page',
        id:page.id,
        icon:page.icon || '\u{1F50E}',
        label:page.title,
        sub:[page.section, page.desc].filter(Boolean).join(metaSeparator),
        href:page.href,
      })
    }
  }

  const rankedResults = []
  for (let index = 0; index < results.length; index += 1) {
    rankedResults.push({ ...results[index], searchIndex:index })
  }
  rankedResults.sort((a, b) => (a.searchPriority ?? 1) - (b.searchPriority ?? 1) || a.searchIndex - b.searchIndex)

  const cleanResults = []
  for (const { searchPriority, searchIndex, ...result } of rankedResults) {
    cleanResults.push(result)
  }
  return cleanResults
}

export default function GlobalSearch({ size = 'lg', placeholder, onClose }) {
  const { isLoggedIn, user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const loadPromiseRef = useRef(null)
  const mountedRef = useRef(true)
  const accessLevelRef = useRef(getCacheKey(isLoggedIn))
  const blurCloseTimerRef = useRef(null)

  const [datasets, setDatasets] = useState(() => getCachedSearchData(isLoggedIn) || EMPTY_DATASETS)
  const [dataReady, setDataReady] = useState(() => !!getCachedSearchData(isLoggedIn))
  const [loadingData, setLoadingData] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [focused, setFocused] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [activeFilter, setActiveFilter] = useState(null)

  const deferredQuery = useDeferredValue(q)
  const fallbackDatasets = useMemo(() => buildFallbackData(isLoggedIn), [isLoggedIn])
  const accessLevel = getCacheKey(isLoggedIn)

  const availableTypes = useMemo(() => {
    const seen = new Set()
    const types = []
    for (const r of results) {
      if (!seen.has(r.type)) { seen.add(r.type); types.push(r.type) }
    }
    return types
  }, [results])

  const filteredResults = useMemo(
    () => activeFilter ? results.filter(r => r.type === activeFilter) : results,
    [results, activeFilter]
  )
  const partnerService = useMemo(() => getPartnerServiceMatch(q), [q])

  const ph = placeholder || (size === 'lg'
    ? 'Encuentra lo que buscas'
    : 'Buscar en todo Latido...')

  useEffect(() => {
    accessLevelRef.current = accessLevel
  }, [accessLevel])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (blurCloseTimerRef.current) {
        window.clearTimeout(blurCloseTimerRef.current)
        blurCloseTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const cached = getCachedSearchData(isLoggedIn)
    setDatasets(cached || EMPTY_DATASETS)
    setDataReady(!!cached)
    setLoadingData(false)
    loadPromiseRef.current = null
  }, [isLoggedIn])

  const ensureDataLoaded = useCallback(async () => {
    const cached = getCachedSearchData(isLoggedIn)
    if (cached) {
      setDatasets(cached)
      setDataReady(true)
      return cached
    }

    if (loadPromiseRef.current) return loadPromiseRef.current

    setLoadingData(true)

    const request = (async () => {
      try {
        const [adsRes, jobsRes, communitiesRes, providersRes, eventsRes] = await Promise.all([
          fetchAllRows(() => {
            let query = supabase
              .from('listings')
              .select(SEARCH_SELECTS.ads)
              .eq('active', true)
              .order('created_at', { ascending:false })

            if (!isLoggedIn) query = query.eq('privacy', 'public')
            return query
          }),
          fetchAllRows(() => supabase.from('jobs').select(SEARCH_SELECTS.jobs).eq('active', true).order('created_at', { ascending:false })),
          fetchAllRows(() => supabase.from('communities').select(SEARCH_SELECTS.communities).eq('active', true).order('members', { ascending:false })),
          fetchAllRows(() => supabase
            .from('providers')
            .select(SEARCH_SELECTS.providers)
            .eq('active', true)
            .order('featured', { ascending:false })
            .order('verified', { ascending:false })
            .order('created_at', { ascending:false })),
          fetchAllRows(() => supabase
            .from('events')
            .select(SEARCH_SELECTS.events)
            .eq('active', true)
            .order('featured', { ascending:false })
            .order('created_at', { ascending:false })),
        ])

        const nextDatasets = {
          ads: adsRes.error || !adsRes.data?.length ? fallbackDatasets.ads : adsRes.data.map(normalizeAd),
          jobs: jobsRes.error || !jobsRes.data?.length ? fallbackDatasets.jobs : jobsRes.data.map(normalizeJob),
          communities: communitiesRes.error || !communitiesRes.data?.length
            ? fallbackDatasets.communities
            : communitiesRes.data.map(normalizeCommunity).filter(Boolean),
          businesses: providersRes.error || !providersRes.data?.length
            ? fallbackDatasets.businesses
            : providersRes.data.map(normalizeBusiness).sort(sortBusinessesByPromotion),
          events: eventsRes.error || !eventsRes.data?.length
            ? fallbackDatasets.events
            : eventsRes.data.map(normalizeEvent),
          guides: fallbackDatasets.guides,
          pages: fallbackDatasets.pages,
        }

        setCachedSearchData(isLoggedIn, nextDatasets)

        if (mountedRef.current && accessLevelRef.current === accessLevel) {
          setDatasets(nextDatasets)
          setDataReady(true)
        }

        return nextDatasets
      } catch {
        setCachedSearchData(isLoggedIn, fallbackDatasets)

        if (mountedRef.current && accessLevelRef.current === accessLevel) {
          setDatasets(fallbackDatasets)
          setDataReady(true)
        }

        return fallbackDatasets
      } finally {
        if (mountedRef.current && accessLevelRef.current === accessLevel) {
          setLoadingData(false)
        }
        if (accessLevelRef.current === accessLevel) {
          loadPromiseRef.current = null
        }
      }
    })()

    loadPromiseRef.current = request
    return request
  }, [accessLevel, fallbackDatasets, isLoggedIn])

  const cancelBlurClose = useCallback(() => {
    if (!blurCloseTimerRef.current) return
    window.clearTimeout(blurCloseTimerRef.current)
    blurCloseTimerRef.current = null
  }, [])

  const handleFocus = useCallback(() => {
    cancelBlurClose()
    setFocused(true)
    ensureDataLoaded()
  }, [cancelBlurClose, ensureDataLoaded])

  const handleBlur = useCallback(() => {
    cancelBlurClose()
    blurCloseTimerRef.current = window.setTimeout(() => {
      setFocused(false)
      blurCloseTimerRef.current = null
    }, 160)
  }, [cancelBlurClose])

  const clearSearch = useCallback(() => {
    cancelBlurClose()
    setQ('')
    setFocused(true)
    inputRef.current?.focus()
  }, [cancelBlurClose])

  useEffect(() => {
    if (focused || deferredQuery.trim().length >= 2) {
      ensureDataLoaded()
    }
  }, [deferredQuery, ensureDataLoaded, focused])

  useEffect(() => {
    const baseDatasets = dataReady ? datasets : fallbackDatasets
    setResults(searchAll(deferredQuery, baseDatasets, isLoggedIn))
    setActiveIdx(-1)
    setActiveFilter(null)
  }, [dataReady, datasets, deferredQuery, fallbackDatasets, isLoggedIn])

  useEffect(() => {
    if (isAdmin) return undefined

    const query = q.trim()
    if (query.length < 2) return undefined

    const timer = window.setTimeout(() => {
      trackSearchEvent({
        query,
        scope: 'global',
        user_id: user?.id || null,
        metadata: {
          results_count: results.length,
          active_filter: activeFilter || null,
        },
      })
    }, 900)

    return () => window.clearTimeout(timer)
  }, [activeFilter, isAdmin, q, results.length, user?.id])

  const goTo = target => {
    const result = typeof target === 'string' ? null : target
    const href = result?.href || target
    const query = q.trim()

    if (!isAdmin && result && query.length >= 2) {
      trackAnalyticsEvent('search_result_open', {
        user_id: user?.id || null,
        metadata: {
          query: query.slice(0, 120),
          result_type: result.type || '',
          result_id: result.id || '',
          result_label: result.label || '',
          href,
        },
      })
    }

    navigate(href)
    cancelBlurClose()
    setQ('')
    setFocused(false)
    onClose?.()
  }

  const handleKey = e => {
    if (!results.length) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(idx => Math.min(idx + 1, results.length - 1))
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(idx => Math.max(idx - 1, 0))
    }

    if (e.key === 'Enter' && activeIdx >= 0) goTo(results[activeIdx])

    if (e.key === 'Escape') {
      cancelBlurClose()
      setQ('')
      setFocused(false)
      onClose?.()
    }
  }

  const showDropdown = focused && q.length >= 2

  const inputStyle = size === 'lg'
    ? {
        width:'100%',
        border:`2px solid ${focused ? C.primary : C.border}`,
        borderRadius:18,
        padding:'15px 18px 15px 48px',
        fontSize:15,
        fontFamily:PP,
        outline:'none',
        background:'#fff',
        boxSizing:'border-box',
        color:C.text,
        boxShadow: focused ? `0 0 0 4px ${C.primaryLight}` : '0 2px 12px rgba(0,0,0,0.06)',
        transition:'all .2s',
      }
    : {
        width:'100%',
        border:`1.5px solid ${focused ? C.primary : C.border}`,
        borderRadius:14,
        padding:'11px 14px 11px 36px',
        fontSize:13,
        fontFamily:PP,
        outline:'none',
        background:'#fff',
        boxSizing:'border-box',
        color:C.text,
        transition:'all .15s',
      }

  return (
    <div style={{ position:'relative', width:'100%', zIndex:showDropdown ? 80 : 1 }}>
      <div style={{ position:'relative' }}>
        <span style={{ position:'absolute', left:size === 'lg' ? 16 : 12, top:'50%', transform:'translateY(-50%)', fontSize:size === 'lg' ? 20 : 15, color:focused ? C.primary : C.light, transition:'color .15s', pointerEvents:'none' }}>
          🔍
        </span>
        <input
          ref={inputRef}
          style={inputStyle}
          placeholder={ph}
          value={q}
          onChange={e => setQ(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKey}
          autoComplete="off"
        />
        {q && (
          <button onMouseDown={e => e.preventDefault()} onClick={clearSearch} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:C.border, border:'none', borderRadius:'50%', width:20, height:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:C.mid }}>
            ✕
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="fade-up" onMouseDown={e => e.preventDefault()} style={{ position:'absolute', top:'100%', left:0, right:0, marginTop:10, background:'#fff', borderRadius:20, boxShadow:'0 18px 48px rgba(15,23,42,0.18)', border:`1px solid ${C.border}`, zIndex:200, overflow:'hidden', maxHeight:'min(420px, 62vh)', overflowY:'auto' }}>
          {results.length === 0 ? (
            <div style={{ padding:'20px 18px', textAlign:'center' }}>
              {loadingData && !dataReady ? (
                <>
                  <p style={{ fontFamily:PP, fontSize:13, color:C.text, fontWeight:700, margin:'0 0 6px' }}>Buscando en la comunidad...</p>
                  <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>Estamos cargando los resultados más recientes.</p>
                </>
              ) : (
                <>
                  <p style={{ fontFamily:PP, fontSize:13, color:C.light, margin:0 }}>Sin resultados para <strong style={{ color:C.text }}>{q}</strong></p>
                  <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:'6px 0 0' }}>
                    Prueba con otras palabras o{' '}
                    <button onClick={() => goTo('/')} style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:C.primary, background:'none', border:'none', cursor:'pointer', padding:0 }}>
                      explora Latido
                    </button>
                  </p>
                  {partnerService && (
                    <PartnerServicesPromo
                      placement="global_search_empty"
                      variant="contextual"
                      serviceId={partnerService.id}
                    />
                  )}
                </>
              )}
            </div>
          ) : (
            <>
              {partnerService && (
                <PartnerServicesPromo
                  placement="global_search_results"
                  variant="contextual"
                  serviceId={partnerService.id}
                />
              )}
              {filteredResults.map((result, idx) => {
                const color = TYPE_COLORS[result.type] || TYPE_COLORS.ad
                if (result.isPartnerRecommendation) {
                  return (
                    <div
                      key={`partner-${result.id}`}
                      onClick={() => goTo(result)}
                      style={{ padding:12, cursor:'pointer', background: idx === activeIdx ? C.primaryLight : '#fff', borderBottom:`1px solid ${C.borderLight}` }}
                    >
                      <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:12, alignItems:'center', background:C.primaryLight, border:`1px solid ${C.primaryMid}`, borderRadius:16, padding:'14px 14px 12px' }}>
                        <span style={{ width:46, height:46, borderRadius:14, background:'#fff', border:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, overflow:'hidden', gridRow:'span 2', flexShrink:0 }}>
                          {result.image ? (
                            <img src={getThumbnailImageUrl(result.image)} alt="" loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:result.imageFit || 'contain', display:'block', background:'#fff' }} />
                          ) : result.icon}
                        </span>
                        <div style={{ minWidth:0 }}>
                          <p style={{ fontFamily:PP, fontSize:10, fontWeight:800, letterSpacing:1.2, color:C.primary, margin:'0 0 6px', textTransform:'uppercase' }}>
                            Colaborador recomendado
                          </p>
                          <p style={{ fontFamily:PP, fontWeight:800, fontSize:14, color:C.text, margin:'0 0 5px', lineHeight:1.25, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                            {result.label}
                          </p>
                          <p style={{ fontFamily:PP, fontSize:11, color:C.mid, margin:0, lineHeight:1.45, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                            {result.sub}
                          </p>
                        </div>
                        <span style={{ gridColumn:'2', justifySelf:'start', fontFamily:PP, fontWeight:800, fontSize:11, color:C.primary, background:'#fff', border:`1px solid ${C.primaryMid}`, borderRadius:999, padding:'7px 12px', whiteSpace:'nowrap' }}>
                          Ver servicios →
                        </span>
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={`${result.type}-${result.id}`}
                    onClick={() => goTo(result)}
                    style={{ padding:'13px 16px', display:'flex', alignItems:'flex-start', gap:12, cursor:'pointer', background: idx === activeIdx ? C.primaryLight : '#fff', borderBottom: idx < filteredResults.length - 1 ? `1px solid ${C.borderLight}` : 'none', transition:'background .1s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.primaryLight }}
                    onMouseLeave={e => { e.currentTarget.style.background = idx === activeIdx ? C.primaryLight : '#fff' }}
                  >
                    <span style={{ width:size === 'lg' ? 42 : 34, height:size === 'lg' ? 42 : 34, borderRadius:14, background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:size === 'lg' ? 22 : 18, flexShrink:0, overflow:'hidden', border:result.image ? `1px solid ${C.borderLight}` : 'none' }}>
                      {result.image ? (
                        <img src={getThumbnailImageUrl(result.image)} alt="" loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:result.imageFit || 'cover', display:'block', background:'#fff' }} />
                      ) : result.icon}
                    </span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10, marginBottom:3 }}>
                        <p style={{ fontFamily:PP, fontWeight:700, fontSize:14, color:C.text, margin:0, lineHeight:1.3, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{result.label}</p>
                        <span style={{ fontFamily:PP, fontSize:10, fontWeight:700, background:color.bg, color:color.color, padding:'4px 8px', borderRadius:999, flexShrink:0, whiteSpace:'nowrap' }}>{color.label}</span>
                      </div>
                      <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0, lineHeight:1.45, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{result.sub}</p>
                    </div>
                    {result.privacy === 'private' && <span style={{ fontSize:12, marginTop:6, flexShrink:0 }}>🔒</span>}
                  </div>
                )
              })}
              <div style={{ borderTop:`1px solid ${C.border}`, background:'#FCFDFF', position:'sticky', bottom:0 }}>
                {availableTypes.length > 1 && (
                  <div style={{ padding:'8px 16px', display:'flex', gap:6, flexWrap:'wrap', borderBottom:`1px solid ${C.borderLight}` }}>
                    {availableTypes.map(type => {
                      const color = TYPE_COLORS[type] || TYPE_COLORS.ad
                      const isActive = activeFilter === type
                      return (
                        <button
                          key={type}
                          onClick={() => setActiveFilter(isActive ? null : type)}
                          style={{ fontFamily:PP, fontSize:10, fontWeight:700, padding:'4px 10px', borderRadius:999, border:`1.5px solid ${isActive ? color.color : C.border}`, background: isActive ? color.bg : '#fff', color: isActive ? color.color : C.text, cursor:'pointer', transition:'all .15s' }}
                        >
                          {color.label}
                        </button>
                      )
                    })}
                  </div>
                )}
                <div style={{ padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
                  <span style={{ fontFamily:PP, fontSize:10, color:C.light }}>{filteredResults.length} resultado{filteredResults.length !== 1 ? 's' : ''} en Latido</span>
                  {activeFilter && (
                    <span onClick={() => setActiveFilter(null)} style={{ fontFamily:PP, fontWeight:700, fontSize:10, color:C.primary, cursor:'pointer' }}>
                      Mostrar todos
                    </span>
                  )}
                </div>
              </div>
              {loadingData && (
                <div style={{ padding:'10px 16px', borderTop:`1px solid ${C.borderLight}`, background:'#fff' }}>
                  <span style={{ fontFamily:PP, fontSize:10, color:C.light }}>Actualizando resultados...</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
