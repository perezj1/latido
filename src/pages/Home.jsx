import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useZoneAlerts, dismissZoneAlerts } from '../hooks/useZoneAlerts'
import { useUnreadMessages } from '../hooks/useUnreadMessages'
import { useOverlayHistory } from '../hooks/useOverlayHistory'
import GlobalSearch from '../components/GlobalSearch'
import { C, PP } from '../lib/theme'
import { Avatar, Tag, PrivacyTag } from '../components/UI'
import EventfrogCalendar from '../components/EventfrogCalendar'
import { MOCK_DOCS, getAdCat, normalizeAdCat } from '../lib/constants'

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

export default function Home() {
  const { displayName, isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const { alertItems, alertCount } = useZoneAlerts()
  const { unreadConvIds, hasUnread } = useUnreadMessages()

  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef(null)

  const [recentAds, setRecentAds] = useState([])
  const [communityHighlights, setCommunityHighlights] = useState([])
  const [recentJobs, setRecentJobs] = useState([])
  const [recentEvents, setRecentEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedGuide, setSelectedGuide] = useState(null)
  useOverlayHistory(!!selectedGuide, () => setSelectedGuide(null))

  const hasNotif = alertCount > 0 || hasUnread

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

  const getAdHref = (ad) => ad.id.startsWith('job_')
    ? `/tablon?cat=empleo&openJob=${encodeURIComponent(ad.id.replace('job_', ''))}`
    : `/tablon?openAd=${encodeURIComponent(ad.id)}`
  const getCommunityHref = (group) => `/comunidades?openCommunity=${encodeURIComponent(group.id)}`
  const getJobHref = (job) => `/tablon?cat=empleo&openJob=${encodeURIComponent(job.id)}`

  const applySnapshot = useCallback((snapshot) => {
    setRecentAds(snapshot.recentAds || [])
    setCommunityHighlights(snapshot.communityHighlights || [])
    setRecentJobs(snapshot.recentJobs || [])
    setRecentEvents(snapshot.recentEvents || [])
    setLoading(false)
  }, [])

  const fetchHomeData = useCallback(async () => {
    try {
      const [adsRes, communitiesRes, jobsRes, eventsRes] = await Promise.all([
        supabase
          .from('listings')
          .select('id, cat, title, desc, img_url, price, canton, plz, privacy, user_name, created_at, active')
          .or('active.is.null,active.eq.true')
          .order('created_at', { ascending:false })
          .limit(50),

        supabase
          .from('communities')
          .select('id, name, city, members, emoji, cat, desc, contact, photo_url, created_at, active')
          .or('active.is.null,active.eq.true')
          .order('created_at', { ascending:false })
          .limit(50),

        supabase
          .from('jobs')
          .select('id, title, company, city, type, salary, emoji, logo_url, created_at, active')
          .or('active.is.null,active.eq.true')
          .order('created_at', { ascending:false })
          .limit(3),

        supabase
          .from('events')
          .select('id, title, day, month, year, city, venue, price, img_url, created_at, active')
          .or('active.is.null,active.eq.true')
          .limit(50),
      ])

      if (adsRes.error) console.error('Error loading recent ads:', adsRes.error)
      if (communitiesRes.error) console.error('Error loading communities:', communitiesRes.error)
      if (jobsRes.error) console.error('Error loading jobs:', jobsRes.error)
      if (eventsRes.error) console.error('Error loading events:', eventsRes.error)

      const adsNorm = ((adsRes.error ? [] : adsRes.data) || []).map((row) => ({
        id: row.id,
        cat: normalizeAdCat(row.cat) || 'servicios',
        title: row.title || '',
        desc: row.desc || '',
        img: row.img_url || '',
        price: row.price || '',
        canton: row.canton || '',
        plz: row.plz || '',
        privacy: row.privacy || 'public',
        user: row.user_name || 'Usuario',
        ts: formatTimeAgo(row.created_at),
        _sort: row.created_at || '',
      }))

      const jobsNorm = ((jobsRes.error ? [] : jobsRes.data) || []).map((row) => ({
        id: `job_${row.id}`,
        cat: 'empleo',
        title: row.title || '',
        desc: row.company || '',
        img: row.logo_url || '',
        price: row.salary || '',
        canton: row.city || '',
        plz: '',
        privacy: 'public',
        user: row.company || '',
        ts: formatTimeAgo(row.created_at),
        _sort: row.created_at || '',
      }))

      setRecentAds(
        [...adsNorm, ...jobsNorm]
          .sort((a, b) => (b._sort > a._sort ? 1 : -1))
          .map(({ _sort, ...rest }) => rest)
      )

      setCommunityHighlights(
        ((communitiesRes.error ? [] : communitiesRes.data) || []).map((row) => ({
          id: row.id,
          name: (row.name || 'Comunidad').replace(/Mam[aá]s Latinas/gi, 'Familias Latinas'),
          city: row.city || 'Suiza',
          members: row.members || 0,
          emoji: row.emoji || '🤝',
          desc: row.desc || '',
          contact: row.contact || '',
          photo_url: row.photo_url || '',
        }))
      )

      setRecentJobs(
        ((jobsRes.error ? [] : jobsRes.data) || []).map((row) => ({
          id: row.id,
          title: row.title || '',
          company: row.company || 'Empresa',
          city: row.city || 'Suiza',
          type: row.type || 'Trabajo',
          salary: row.salary || '',
          emoji: row.emoji || '💼',
          logo_url: row.logo_url || '',
        }))
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
    homeCache = { recentAds, communityHighlights, recentJobs, recentEvents }
    homeCacheTs = Date.now()
  }, [communityHighlights, loading, recentAds, recentEvents, recentJobs])

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
            <GlobalSearch size="lg" placeholder="Encuentra lo que buscas" />
            <div className="no-scroll" style={{ overflowX:'auto', WebkitOverflowScrolling:'touch', marginTop:12 }}>
              <div className="hero-pills">
                {[
                  { emoji:'🏠', label:'Vivienda',    to:'/tablon?cat=vivienda' },
                  { emoji:'💼', label:'Empleo',       to:'/tablon?cat=empleo' },
                  { emoji:'👨‍👩‍👧', label:'Familia',     to:'/comunidades?cat=familia' },
                  { emoji:'🛍️', label:'Mercado',      to:'/tablon?cat=venta' },
                  { emoji:'🔧', label:'Servicios',    to:'/tablon?cat=servicios' },
                  { emoji:'❤️', label:'Cuidados',     to:'/tablon?cat=cuidados' },
                  { emoji:'🎉', label:'Eventos',      to:'/comunidades?view=eventos' },
                  { emoji:'🤝', label:'Comunidad',    to:'/comunidades' },
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

      {/* ── ANUNCIOS RECIENTES ── */}
      <section style={{ padding:'24px 0 0' }}>
        <div style={{ maxWidth:980, margin:'0 auto', padding:'0 16px', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:20, color:C.text, margin:0, letterSpacing:-0.5 }}>📌 Anuncios recientes</h2>
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
                const normalizedCat = normalizeAdCat(ad.cat)
                const cat = getAdCat(ad.cat)
                const cc = CAT_COLORS[normalizedCat] || { bg:C.primaryLight, tc:C.primary }
                return (
                  <Link key={ad.id} to={getAdHref(ad)} style={{ textDecoration:'none', flexShrink:0, width:152, display:'block' }}>
                    <div style={{ background:'#fff', borderRadius:16, border:`1px solid ${C.border}`, overflow:'hidden', height:'100%', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
                      <div style={{ height:120, background:cc.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:44, position:'relative' }}>
                        {ad.img
                          ? <img src={ad.img} alt={ad.title} style={{ width:'100%', height:'100%', objectFit:'cover', position:'absolute', inset:0 }} />
                          : <span>{cat?.emoji || '📌'}</span>
                        }
                        <span style={{ position:'absolute', top:8, left:8, fontFamily:PP, fontSize:9, fontWeight:700, background:'rgba(255,255,255,0.92)', color:cc.tc, padding:'3px 7px', borderRadius:999 }}>{cat?.label}</span>
                      </div>
                      <div style={{ padding:'10px 10px 12px' }}>
                        <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.text, margin:'0 0 4px', lineHeight:1.35, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', minHeight:'2.7em' }}>{ad.title}</p>
                        <p style={{ fontFamily:PP, fontWeight:800, fontSize:13, color:C.primary, margin:'0 0 4px' }}>{fmtPrice(ad.price) || '—'}</p>
                        <p style={{ fontFamily:PP, fontSize:10, color:C.light, margin:0 }}>📍 {ad.canton} · {ad.ts}</p>
                      </div>
                    </div>
                  </Link>
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
              const normalizedCat = normalizeAdCat(ad.cat)
              const cat = getAdCat(ad.cat)
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

                    <p style={{ fontFamily:PP, fontSize:12, color:C.mid, lineHeight:1.65, margin:'0 0 14px', display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
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
              🤝 Comunidades para ti
            </h2>
            <p style={{ fontFamily:PP, fontSize:12, color:C.mid, margin:0 }}>
              Tus próximos puntos de conexión en Suiza.
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
        ) : communityHighlights.length === 0 ? (
          <div style={{ padding:'0 16px' }}><EmptyState text="Todavía no hay comunidades publicadas." /></div>
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
                    <div style={{ height:120, background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:44, overflow:'hidden' }}>
                      {group.photo_url
                        ? <img src={group.photo_url} alt={group.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        : <span>{group.emoji || '🤝'}</span>
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
                <p style={{ fontFamily:PP, fontSize:12, color:C.mid, margin:0 }}>Trámites y burocracia suiza en español.</p>
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
                            <img src={doc.img} alt={doc.title} loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
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

      <div
        style={{
          display:'flex',
          flexDirection:'column',
          gap:10,
          alignItems:'center',
          justifyContent:'center'
        }}
      >
        <Link
          to="/publicar"
          style={{
            fontFamily:PP,
            fontWeight:700,
            fontSize:13,
            background:'#fff',
            color:C.primary,
            textDecoration:'none',
            padding:'13px 22px',
            borderRadius:14,
            textAlign:'center',
            whiteSpace:'nowrap',
            minWidth:220
          }}
        >
          📌 Publicar anuncio
        </Link>

        <Link
          to="/tablon"
          style={{
            fontFamily:PP,
            fontWeight:600,
            fontSize:13,
            background:'rgba(255,255,255,0.12)',
            color:'#fff',
            textDecoration:'none',
            padding:'11px 22px',
            borderRadius:14,
            border:'1px solid rgba(255,255,255,0.2)',
            textAlign:'center',
            whiteSpace:'nowrap',
            minWidth:220
          }}
        >
          Ver el tablón →
        </Link>
      </div>
    </div>
  </div>
</section>
    </div>
  )
}
