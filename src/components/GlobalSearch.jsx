import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { C, PP } from '../lib/theme'
import {
  MOCK_ADS,
  MOCK_COMMUNITIES,
  MOCK_JOBS,
  MOCK_NEGOCIOS,
  MOCK_EVENTOS_LATINOS,
  formatAdLocation,
  getAdCat,
  normalizeAdCat,
  NEGOCIO_TYPES,
  EVENTO_TYPES,
} from '../lib/constants'

const BUSINESS_EMOJI = {
  restaurante:'🍽️',
  barberia:'✂️',
  tienda:'🛒',
  pasteleria:'🍰',
  belleza:'💇',
  servicios:'🔧',
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
})

const SEARCH_CACHE = {
  public:null,
  private:null,
}

const TYPE_COLORS = {
  ad:{ bg:'#DBEAFE', color:'#1D4ED8', label:'Tablón' },
  job:{ bg:'#E0F2FE', color:'#0369A1', label:'Empleo' },
  community:{ bg:'#D1FAE5', color:'#065F46', label:'Grupo' },
  business:{ bg:'#FEF3C7', color:'#92400E', label:'Negocio' },
  event:{ bg:'#FCE7F3', color:'#9D174D', label:'Evento' },
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

function normalizeCommunity(group) {
  if (!group || group.cat === 'fe') return null

  return {
    id: group.id,
    name: (group.name || 'Grupo').replace(/Mam[aá]s Latinas/gi, 'Familias Latinas'),
    city: group.city || 'Suiza',
    members: group.members || 0,
    emoji: group.emoji || '👥',
    desc: group.desc || group.description || '',
  }
}

function normalizeBusiness(provider) {
  return {
    id: provider.id,
    name: provider.name || 'Negocio',
    type: provider.type || provider.category || '',
    city: provider.city || provider.canton || 'Suiza',
    desc: provider.desc || provider.description || '',
    emoji: provider.emoji || BUSINESS_EMOJI[provider.category] || '🏪',
    services: Array.isArray(provider.services) ? provider.services : [],
  }
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
  }
}

function normalizeAd(ad) {
  return {
    id: ad.id,
    cat: normalizeAdCat(ad.cat) || '',
    title: ad.title || '',
    desc: ad.desc || ad.description || '',
    city: ad.city || '',
    canton: ad.canton || 'Suiza',
    plz: ad.plz || '',
    price: ad.price || '',
    privacy: ad.privacy || 'public',
  }
}

function normalizeJob(job) {
  return {
    id: job.id,
    title: job.title || '',
    company: job.company || 'Empresa',
    city: job.city || job.canton || 'Suiza',
    type: job.type || 'Trabajo',
    emoji: job.emoji || '💼',
  }
}

function buildFallbackData(isLoggedIn) {
  return {
    ads: (isLoggedIn ? MOCK_ADS : MOCK_ADS.filter(ad => ad.privacy === 'public')).map(normalizeAd),
    jobs: MOCK_JOBS.map(normalizeJob),
    communities: MOCK_COMMUNITIES.map(normalizeCommunity).filter(Boolean),
    businesses: MOCK_NEGOCIOS.map(normalizeBusiness),
    events: MOCK_EVENTOS_LATINOS.map(normalizeEvent),
  }
}

function searchAll(query, datasets, isLoggedIn) {
  const q = query.toLowerCase().trim()
  if (!q || q.length < 2) return []

  const results = []

  datasets.ads
    .filter(ad =>
      (isLoggedIn || ad.privacy === 'public') && (
        ad.title.toLowerCase().includes(q) ||
        ad.desc.toLowerCase().includes(q) ||
        ad.canton.toLowerCase().includes(q) ||
        formatAdLocation(ad).toLowerCase().includes(q)
      )
    )
    .slice(0, 3)
    .forEach(ad => {
      const cat = getAdCat(ad.cat)
      const location = formatAdLocation(ad)
      results.push({
        type:'ad',
        id:ad.id,
        icon:cat?.emoji || '📌',
        label:ad.title,
        sub:[cat?.label || 'Tablón', location, ad.price].filter(Boolean).join(' · '),
        href:`/tablon?openAd=${encodeURIComponent(ad.id)}`,
        privacy:ad.privacy,
      })
    })

  datasets.jobs
    .filter(job =>
      job.title.toLowerCase().includes(q) ||
      job.company.toLowerCase().includes(q) ||
      job.city.toLowerCase().includes(q)
    )
    .slice(0, 2)
    .forEach(job => {
      results.push({
        type:'job',
        id:job.id,
        icon:job.emoji || '💼',
        label:job.title,
        sub:`${job.company} · ${job.city} · ${job.type}`,
        href:`/tablon?cat=empleo&openJob=${encodeURIComponent(job.id)}`,
      })
    })

  datasets.communities
    .filter(group =>
      group.name.toLowerCase().includes(q) ||
      group.desc.toLowerCase().includes(q)
    )
    .slice(0, 2)
    .forEach(group => {
      results.push({
        type:'community',
        id:group.id,
        icon:group.emoji || '👥',
        label:group.name,
        sub:`Grupo · ${group.city} · ${group.members} miembros`,
        href:`/comunidades?openCommunity=${encodeURIComponent(group.id)}`,
      })
    })

  datasets.businesses
    .filter(business =>
      business.name.toLowerCase().includes(q) ||
      business.desc.toLowerCase().includes(q) ||
      business.city.toLowerCase().includes(q) ||
      business.services.some(service => service.toLowerCase().includes(q))
    )
    .slice(0, 2)
    .forEach(business => {
      results.push({
        type:'business',
        id:business.id,
        icon:business.emoji || '🏪',
        label:business.name,
        sub:`${NEGOCIO_TYPES.find(type => type.id === business.type)?.label || 'Negocio'} · ${business.city}`,
        href:`/comunidades?view=negocios&openBusiness=${encodeURIComponent(business.id)}`,
      })
    })

  datasets.events
    .filter(event =>
      event.title.toLowerCase().includes(q) ||
      event.desc.toLowerCase().includes(q) ||
      event.city.toLowerCase().includes(q) ||
      event.venue.toLowerCase().includes(q) ||
      event.host.toLowerCase().includes(q)
    )
    .slice(0, 2)
    .forEach(event => {
      results.push({
        type:'event',
        id:event.id,
        icon:event.emoji || '🎉',
        label:event.title,
        sub:`${EVENTO_TYPES.find(type => type.id === event.type)?.label || 'Evento'} · ${event.city}`,
        href:`/comunidades?view=eventos&openEvent=${encodeURIComponent(event.id)}`,
      })
    })

  return results
}

export default function GlobalSearch({ size = 'lg', placeholder, onClose }) {
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const loadPromiseRef = useRef(null)
  const mountedRef = useRef(true)
  const accessLevelRef = useRef(getCacheKey(isLoggedIn))

  const [datasets, setDatasets] = useState(() => getCachedSearchData(isLoggedIn) || EMPTY_DATASETS)
  const [dataReady, setDataReady] = useState(() => !!getCachedSearchData(isLoggedIn))
  const [loadingData, setLoadingData] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [focused, setFocused] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)

  const deferredQuery = useDeferredValue(q)
  const fallbackDatasets = useMemo(() => buildFallbackData(isLoggedIn), [isLoggedIn])
  const accessLevel = getCacheKey(isLoggedIn)

  const ph = placeholder || (size === 'lg'
    ? 'Encuentra lo que buscas'
    : 'Buscar anuncios, empleos o grupos...')

  useEffect(() => {
    accessLevelRef.current = accessLevel
  }, [accessLevel])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
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
        let adsQuery = supabase
          .from('listings')
          .select('*')
          .eq('active', true)
          .order('created_at', { ascending:false })

        if (!isLoggedIn) adsQuery = adsQuery.eq('privacy', 'public')

        const [adsRes, jobsRes, communitiesRes, providersRes, eventsRes] = await Promise.all([
          adsQuery,
          supabase.from('jobs').select('*').eq('active', true).order('created_at', { ascending:false }),
          supabase.from('communities').select('*').eq('active', true).order('members', { ascending:false }),
          supabase
            .from('providers')
            .select('*')
            .eq('active', true)
            .order('featured', { ascending:false })
            .order('verified', { ascending:false })
            .order('created_at', { ascending:false }),
          supabase
            .from('events')
            .select('*')
            .eq('active', true)
            .order('featured', { ascending:false })
            .order('created_at', { ascending:false }),
        ])

        const nextDatasets = {
          ads: adsRes.error || !adsRes.data?.length ? fallbackDatasets.ads : adsRes.data.map(normalizeAd),
          jobs: jobsRes.error || !jobsRes.data?.length ? fallbackDatasets.jobs : jobsRes.data.map(normalizeJob),
          communities: communitiesRes.error || !communitiesRes.data?.length
            ? fallbackDatasets.communities
            : communitiesRes.data.map(normalizeCommunity).filter(Boolean),
          businesses: providersRes.error || !providersRes.data?.length
            ? fallbackDatasets.businesses
            : providersRes.data.map(normalizeBusiness),
          events: eventsRes.error || !eventsRes.data?.length
            ? fallbackDatasets.events
            : eventsRes.data.map(normalizeEvent),
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

  useEffect(() => {
    if (focused || deferredQuery.trim().length >= 2) {
      ensureDataLoaded()
    }
  }, [deferredQuery, ensureDataLoaded, focused])

  useEffect(() => {
    const baseDatasets = dataReady ? datasets : fallbackDatasets
    setResults(searchAll(deferredQuery, baseDatasets, isLoggedIn))
    setActiveIdx(-1)
  }, [dataReady, datasets, deferredQuery, fallbackDatasets, isLoggedIn])

  const goTo = href => {
    navigate(href)
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

    if (e.key === 'Enter' && activeIdx >= 0) goTo(results[activeIdx].href)

    if (e.key === 'Escape') {
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
          onFocus={() => {
            setFocused(true)
            ensureDataLoaded()
          }}
          onBlur={() => setTimeout(() => setFocused(false), 160)}
          onKeyDown={handleKey}
          autoComplete="off"
        />
        {q && (
          <button onClick={() => { setQ(''); inputRef.current?.focus() }} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:C.border, border:'none', borderRadius:'50%', width:20, height:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:C.mid }}>
            ✕
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="fade-up" style={{ position:'absolute', top:'100%', left:0, right:0, marginTop:10, background:'#fff', borderRadius:20, boxShadow:'0 18px 48px rgba(15,23,42,0.18)', border:`1px solid ${C.border}`, zIndex:200, overflow:'hidden', maxHeight:'min(420px, 62vh)', overflowY:'auto' }}>
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
                    <button onClick={() => goTo('/tablon')} style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:C.primary, background:'none', border:'none', cursor:'pointer', padding:0 }}>
                      explora el tablón
                    </button>
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              {results.map((result, idx) => {
                const color = TYPE_COLORS[result.type] || TYPE_COLORS.ad
                return (
                  <div
                    key={`${result.type}-${result.id}`}
                    onClick={() => goTo(result.href)}
                    style={{ padding:'13px 16px', display:'flex', alignItems:'flex-start', gap:12, cursor:'pointer', background: idx === activeIdx ? C.primaryLight : '#fff', borderBottom: idx < results.length - 1 ? `1px solid ${C.borderLight}` : 'none', transition:'background .1s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.primaryLight }}
                    onMouseLeave={e => { e.currentTarget.style.background = idx === activeIdx ? C.primaryLight : '#fff' }}
                  >
                    <span style={{ width:size === 'lg' ? 42 : 34, height:size === 'lg' ? 42 : 34, borderRadius:14, background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:size === 'lg' ? 22 : 18, flexShrink:0 }}>
                      {result.icon}
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
              <div style={{ padding:'12px 16px', borderTop:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, background:'#FCFDFF' }}>
                <span style={{ fontFamily:PP, fontSize:10, color:C.light }}>{results.length} resultado{results.length !== 1 ? 's' : ''}</span>
                <button onClick={() => goTo('/tablon')} style={{ fontFamily:PP, fontWeight:600, fontSize:10, color:C.primary, background:'none', border:'none', cursor:'pointer', padding:0 }}>
                  Ver todo en el tablón →
                </button>
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
