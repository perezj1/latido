import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useZoneAlerts, dismissZoneAlerts } from '../hooks/useZoneAlerts'
import { useUnreadMessages } from '../hooks/useUnreadMessages'
import GlobalSearch from '../components/GlobalSearch'
import { C, PP } from '../lib/theme'
import { Avatar, Tag, PrivacyTag } from '../components/UI'
import { AD_CATS } from '../lib/constants'

const fmtPrice = p => {
  if (!p) return ''
  let s = p.trim()
  s = s.replace(/^([\d.,]+)\s+CHF\b(.*)/, 'CHF $1$2')          // "25 CHF x" → "CHF 25 x"
  s = s.replace(/^(CHF\s*[\d.,]+)\s+([^\s/].*)$/, '$1/$2')     // "CHF 25 total" → "CHF 25/total"
  return s
}

const CAT_COLORS = {
  vivienda:{ bg:'#DBEAFE', tc:'#1D4ED8' },
  hogar:{ bg:'#D1FAE5', tc:'#065F46' },
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

  const getAdHref = (ad) => `/tablon?openAd=${encodeURIComponent(ad.id)}`
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
          .limit(4),

        supabase
          .from('communities')
          .select('id, name, city, members, emoji, cat, desc, contact, created_at, active')
          .or('active.is.null,active.eq.true')
          .order('created_at', { ascending:false })
          .limit(3),

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

      setRecentAds(
        ((adsRes.error ? [] : adsRes.data) || []).map((row) => ({
          id: row.id,
          cat: row.cat || 'servicios',
          title: row.title || '',
          desc: row.desc || '',
          img: row.img_url || '',
          price: row.price || '',
          canton: row.canton || '',
          plz: row.plz || '',
          privacy: row.privacy || 'public',
          user: row.user_name || 'Usuario',
          ts: formatTimeAgo(row.created_at),
        }))
      )

      setCommunityHighlights(
        ((communitiesRes.error ? [] : communitiesRes.data) || []).filter((row) => row.cat !== 'fe').map((row) => ({
          id: row.id,
          name: (row.name || 'Comunidad').replace(/Mam[aá]s Latinas/gi, 'Familias Latinas'),
          city: row.city || 'Suiza',
          members: row.members || 0,
          emoji: row.emoji || '🤝',
          desc: row.desc || '',
          contact: row.contact || '',
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
      <section style={{ background:'linear-gradient(160deg, #1E40AF 0%, #2563EB 58%, #60A5FA 100%)', position:'relative', overflow:'visible', padding:'26px 16px 34px', zIndex:2 }}>
        <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
          <div style={{ position:'absolute', top:-70, right:-60, width:220, height:220, borderRadius:'50%', background:'rgba(255,255,255,0.07)' }} />
          <div style={{ position:'absolute', bottom:-60, left:-20, width:180, height:180, borderRadius:'50%', background:'rgba(255,255,255,0.05)' }} />
        </div>

        <div style={{ maxWidth:980, margin:'0 auto', position:'relative', zIndex:1 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16, marginBottom:24 }}>
            <div style={{ maxWidth:620, flex:1, minWidth:0 }}>
              <p style={{ fontFamily:PP, fontSize:12, color:'rgba(255,255,255,0.75)', margin:'0 0 8px' }}>
                Más cerca de tu gente
              </p>
              <h1 style={{ fontFamily:PP, fontWeight:900, fontSize:'clamp(30px,6vw,48px)', lineHeight:1.2, letterSpacing:-0.5, color:'#fff', margin:'0 0 14px' }}>
                Hola&nbsp;  {firstName}.<br />                
              </h1>
              
              <h1 style={{ fontFamily:PP, fontWeight:900, fontSize:'clamp(20px,6vw,48px)', lineHeight:1.2, letterSpacing:-0.5, color:'#fff', margin:'0 0 14px' }}>
                 Aquí está tu comunidad.
              </h1>

              <p style={{ fontFamily:PP, fontSize:14, color:'rgba(255,255,255,0.82)', lineHeight:1.7, maxWidth:520, margin:0 }}>
                Encuentra información, servicios, empleos y apoyo real en una plataforma creada para ti y para los tuyos.
              </p>
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

          <div style={{ maxWidth:620 }}>
            <div>
              <GlobalSearch
                size="lg"
                placeholder="Encuentra lo que buscas"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── ACCESO RÁPIDO ── */}
      <section style={{ maxWidth:980, margin:'0 auto', padding:'24px 16px 0' }}>
        <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:20, color:C.text, margin:'0 0 14px', letterSpacing:-0.5 }}>🔍 Lo más buscado</h2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12 }}>
          {[
            { emoji:'🏠', label:'Vivienda',  sub:'Pisos y habitaciones', to:'/tablon?cat=vivienda',          bg:'#DBEAFE', tc:'#1D4ED8' },
            { emoji:'💼', label:'Empleo',   sub:'Ofertas de empleo',     to:'/tablon?cat=empleo',            bg:'#D1FAE5', tc:'#065F46' },
            { emoji:'🎉', label:'Eventos',   sub:'Planes y quedadas',     to:'/comunidades?view=eventos',     bg:'#EDE9FE', tc:'#6D28D9' },
            { emoji:'🏪', label:'Negocios',  sub:'Productos y servicios',to:'/comunidades?view=negocios',   bg:'#FEF3C7', tc:'#92400E' },
          ].map(item => (
            <Link key={item.label} to={item.to} style={{ textDecoration:'none' }}>
              <div
                style={{ background:item.bg, borderRadius:16, padding:'20px 16px', textAlign:'center', border:`1.5px solid transparent`, transition:'all .18s', cursor:'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow=`0 8px 20px ${item.bg}` }}
                onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none' }}
              >
                <div style={{ fontSize:32, marginBottom:8 }}>{item.emoji}</div>
                <p style={{ fontFamily:PP, fontWeight:700, fontSize:15, color:item.tc, margin:'0 0 4px', lineHeight:1.2 }}>{item.label}</p>
                <p style={{ fontFamily:PP, fontSize:11, color:item.tc, opacity:.7, margin:0, lineHeight:1.3 }}>{item.sub}</p>
              </div>
            </Link>
          ))}
        </div>
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
              const cat = AD_CATS.find(c => c.id === ad.cat)
              const cc = CAT_COLORS[ad.cat] || { bg:C.primaryLight, tc:C.primary }

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

      <section style={{ maxWidth:980, margin:'0 auto', padding:'40px 16px 0' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <div>
            <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:20, color:C.text, margin:'0 0 4px' }}>
              🤝 Comunidades para ti
            </h2>
            <p style={{ fontFamily:PP, fontSize:12, color:C.mid, margin:0 }}>
              Tus próximos puntos de conexión en Suiza.
            </p>
          </div>

          <Link to="/comunidades" style={{ fontFamily:PP, fontSize:11, fontWeight:700, color:C.primary, textDecoration:'none' }}>
            Ver más →
          </Link>
        </div>

        {loading ? (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height:80, borderRadius:16 }}/>)}
          </div>
        ) : communityHighlights.length === 0 ? (
          <EmptyState text="Todavía no hay comunidades publicadas." />
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:10 }}>
            {communityHighlights.map(group => (
              <Link
                key={group.id}
                to={getCommunityHref(group)}
                style={{
                  textDecoration:'none',
                  background:'#fff',
                  border:`1px solid ${C.border}`,
                  borderRadius:18,
                  padding:'14px 15px',
                  display:'flex',
                  gap:12,
                  alignItems:'center'
                }}
              >
                <span style={{ fontSize:30 }}>{group.emoji}</span>
                <div style={{ minWidth:0 }}>
                  <p style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:C.text, margin:'0 0 3px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {group.name}
                  </p>
                  <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>
                    {group.city} · 👥 {group.members} miembros
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Empleos recientes — oculto temporalmente
      <section style={{ maxWidth:980, margin:'0 auto', padding:'40px 16px 0' }}>
        ...
      </section>
      */}

      <section style={{ maxWidth:980, margin:'0 auto', padding:'40px 16px 0' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <div>
            <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:20, color:C.text, margin:'0 0 4px' }}>
              🎉 Eventos próximos
            </h2>
            <p style={{ fontFamily:PP, fontSize:12, color:C.mid, margin:0 }}>
              Próximos eventos de la comunidad latina.
            </p>
          </div>
          <Link to="/comunidades?view=eventos" style={{ fontFamily:PP, fontSize:11, fontWeight:700, color:C.primary, textDecoration:'none' }}>
            Ver todos →
          </Link>
        </div>

        <div style={{ borderRadius:20, overflow:'hidden', border:`1px solid ${C.border}` }}>
          <iframe
            title="Próximos eventos latinos"
            width="100%"
            height="320"
            style={{ border:'none', display:'block' }}
            src="https://embed.eventfrog.ch/en/events.html?key=77224CCC-2A95-41B2-A934-4DA743FC30CA&color=2563eb&showSearch=false&disableAddEntry=true&excludeOrgs=false&searchTerm=latino&geoRadius=60"
            loading="lazy"
            allow="fullscreen"
          />
        </div>
      </section>

      <section style={{ maxWidth:980, margin:'0 auto', padding:'42px 16px 110px' }}>
        <div style={{ background:'linear-gradient(135deg,#1E3A8A,#2563EB)', borderRadius:28, padding:'24px 22px', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', right:-28, top:-28, width:120, height:120, borderRadius:'50%', background:'rgba(255,255,255,0.08)' }} />

          <div style={{ position:'relative', display:'flex', justifyContent:'space-between', alignItems:'center', gap:16, flexWrap:'wrap' }}>
            <div style={{ maxWidth:520 }}>
              <p style={{ fontFamily:PP, fontWeight:800, fontSize:24, color:'#fff', margin:'0 0 8px', letterSpacing:-0.5 }}>
                Tu sesión se mantendrá activa hasta que cierres manualmente.
              </p>
              <p style={{ fontFamily:PP, fontSize:13, color:'rgba(255,255,255,0.76)', lineHeight:1.7, margin:0 }}>
                Ya no necesitas volver a entrar cada vez. Desde aquí puedes seguir explorando o publicar algo ahora mismo.
              </p>
            </div>

            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              <Link
                to="/publicar"
                style={{
                  fontFamily:PP,
                  fontWeight:700,
                  fontSize:13,
                  background:'#fff',
                  color:C.primary,
                  textDecoration:'none',
                  padding:'13px 20px',
                  borderRadius:14
                }}
              >
                Publicar anuncio
              </Link>

              <Link
                to="/perfil"
                style={{
                  fontFamily:PP,
                  fontWeight:700,
                  fontSize:13,
                  background:'rgba(255,255,255,0.14)',
                  color:'#fff',
                  textDecoration:'none',
                  padding:'13px 20px',
                  borderRadius:14,
                  border:'1px solid rgba(255,255,255,0.22)'
                }}
              >
                Ir a mi perfil
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
