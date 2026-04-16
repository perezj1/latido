import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import {
  MOCK_COMMUNITIES,
  MOCK_NEGOCIOS,
  MOCK_NEGOCIO_PHOTOS,
  MOCK_NEGOCIO_REVIEWS,
  MOCK_NEGOCIO_SERVICES,
  MOCK_EVENTOS_LATINOS,
  COMMUNITY_CATS,
  NEGOCIO_TYPES,
  EVENTO_TYPES,
} from '../lib/constants'
import { C, PP } from '../lib/theme'
import { Card, Tag, PillFilters, EmptyState, SegmentedTabs, Modal, InfoBanner, Stars, ReviewCard, ReviewForm, PhotoGallery } from '../components/UI'
import toast from 'react-hot-toast'

const MAIN_TABS = [
  { id:'comunidades', label:'🤝 Comunidades' },
  { id:'negocios', label:'🏪 Negocios' },
  { id:'eventos', label:'🎉 Eventos' },
]

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

function formatRelativeDate(value) {
  if (!value) return 'Hace poco'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Hace poco'
  const diff = Date.now() - date.getTime()
  const days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Hace 1 día'
  if (days < 30) return `Hace ${days} días`
  const months = Math.floor(days / 30)
  if (months <= 1) return 'Hace 1 mes'
  return `Hace ${months} meses`
}

function normalizeProvider(provider) {
  return {
    id: provider.id,
    emoji: BUSINESS_EMOJI[provider.category] || '🏪',
    name: provider.name,
    type: provider.category,
    city: provider.city || provider.canton || 'Suiza',
    canton: provider.canton || '',
    desc: provider.description || 'Negocio latino en Suiza.',
    phone: provider.whatsapp || '',
    instagram: provider.instagram || '',
    verified: !!provider.verified,
    featured: !!provider.featured,
    services: Array.isArray(provider.services) ? provider.services : [],
    photo_url: provider.photo_url || '',
  }
}

function normalizeEvent(event) {
  return {
    id: event.id,
    type: event.type,
    emoji: event.emoji || EVENT_EMOJI[event.type] || '🎉',
    title: event.title,
    city: event.city || event.canton || 'Suiza',
    canton: event.canton || '',
    venue: event.venue || 'Lugar por confirmar',
    day: event.day || '',
    month: event.month || '',
    time: event.time || '',
    price: event.price || 'Consultar',
    host: event.host || 'Organizador',
    featured: !!event.featured,
    desc: event.desc || 'Evento latino en Suiza.',
    img: event.img_url || '',
    link: event.link || '#',
  }
}

function averageRating(reviews) {
  if (!reviews?.length) return null
  return +(reviews.reduce((sum, review) => sum + review.stars, 0) / reviews.length).toFixed(1)
}

function BusinessCard({ business, onClick, servicesMap, photosMap, reviewsMap }) {
  const category = NEGOCIO_TYPES.find(type => type.id === business.type)
  const services = servicesMap[business.id] || business.services || []
  const photos = photosMap[business.id] || (business.photo_url ? [business.photo_url] : [])
  const reviews = reviewsMap[business.id] || []
  const rating = averageRating(reviews)
  const cover = photos[0] || business.photo_url

  return (
    <div
      onClick={onClick}
      style={{ background:'#fff', borderRadius:20, border:`1px solid ${C.border}`, overflow:'hidden', cursor:'pointer', transition:'all .2s' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 28px rgba(37,99,235,0.12)'; e.currentTarget.style.transform = 'translateY(-3px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <div className="provider-cover" style={{ position:'relative', overflow:'hidden', background:C.primaryLight }}>
        {cover ? (
          <img src={cover} alt={business.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        ) : (
          <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:48 }}>{business.emoji}</div>
        )}
        <div style={{ position:'absolute', top:10, left:10, display:'flex', gap:5 }}>
          {business.featured && <Tag bg={C.primary} color="#fff">⭐ Destacado</Tag>}
          {business.verified && <Tag bg="rgba(255,255,255,0.95)" color="#065F46">✓</Tag>}
        </div>
        {photos.length > 0 && (
          <span style={{ position:'absolute', bottom:10, left:10, fontFamily:PP, fontSize:9, fontWeight:600, background:'rgba(0,0,0,0.5)', color:'#fff', padding:'3px 8px', borderRadius:10 }}>
            📷 {photos.length} fotos
          </span>
        )}
        <span style={{ position:'absolute', bottom:10, right:10, fontFamily:PP, fontSize:10, fontWeight:600, background:'rgba(255,255,255,0.92)', color:C.mid, padding:'3px 9px', borderRadius:10 }}>
          {category?.label || 'Negocio'}
        </span>
      </div>

      <div style={{ padding:'14px 16px 16px' }}>
        <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:15, color:C.text, marginBottom:4, lineHeight:1.3 }}>{business.name}</h3>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, flexWrap:'wrap' }}>
          {rating !== null ? (
            <Stars rating={rating} size={13} showNumber count={reviews.length} />
          ) : (
            <span style={{ fontFamily:PP, fontSize:10, color:C.light }}>Sin reseñas aún</span>
          )}
          <span style={{ fontFamily:PP, fontSize:10, color:C.light }}>· 📍 {business.city}</span>
        </div>
        <p style={{ fontFamily:PP, fontSize:12, color:C.mid, lineHeight:1.55, marginBottom:12, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{business.desc}</p>
        {services.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:12 }}>
            {services.slice(0, 3).map(service => <Tag key={service} bg={C.primaryLight} color={C.primary}>{service}</Tag>)}
          </div>
        )}
        <div style={{ display:'flex', gap:8 }}>
          <div style={{ fontFamily:PP, fontWeight:700, fontSize:12, background:C.primary, color:'#fff', padding:'10px 0', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flex:1 }}>Ver perfil →</div>
          {business.phone && (
            <a
              href={`https://wa.me/${business.phone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ width:40, height:40, background:'#D1FAE5', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, textDecoration:'none' }}
            >
              💬
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function BusinessDetail({ business, onClose, servicesMap, photosMap, reviewsMap }) {
  const { isLoggedIn, displayName } = useAuth()
  const category = NEGOCIO_TYPES.find(type => type.id === business.type)
  const services = servicesMap[business.id] || business.services || []
  const photos = photosMap[business.id] || (business.photo_url ? [business.photo_url] : [])
  const [reviews, setReviews] = useState(reviewsMap[business.id] || [])
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [tab, setTab] = useState('info')
  const rating = averageRating(reviews)

  useEffect(() => {
    setReviews(reviewsMap[business.id] || [])
  }, [business.id, reviewsMap])

  const handleAddReview = review => {
    setReviews(prev => [{ id:`new-${Date.now()}`, ...review, author:isLoggedIn ? displayName : review.name }, ...prev])
    setShowReviewForm(false)
    toast.success('¡Reseña publicada!')
  }

  return (
    <div className="fade-in" style={{ position:'fixed', inset:0, zIndex:90, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(3px)' }} onClick={onClose} />
      <div className="fade-up" style={{ position:'relative', background:'#fff', borderRadius:'24px 24px 0 0', width:'100%', maxWidth:680, maxHeight:'92vh', overflowY:'auto', display:'flex', flexDirection:'column' }}>
        <div style={{ position:'sticky', top:0, background:'#fff', borderBottom:`1px solid ${C.border}`, padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', zIndex:10, borderRadius:'24px 24px 0 0' }}>
          <div>
            <p style={{ fontFamily:PP, fontWeight:800, fontSize:17, color:C.text, margin:'0 0 2px' }}>{business.name}</p>
            {rating !== null && <Stars rating={rating} size={12} showNumber count={reviews.length} />}
          </div>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:'50%', background:C.bg, border:'none', cursor:'pointer', fontSize:14, color:C.mid }}>✕</button>
        </div>

        <div style={{ display:'flex', borderBottom:`1px solid ${C.border}`, background:'#fff' }}>
          {[
            { id:'info', label:'ℹ️ Info' },
            { id:'fotos', label:`📷 Fotos (${photos.length})` },
            { id:'resenas', label:`⭐ Reseñas (${reviews.length})` },
          ].map(item => (
            <button key={item.id} onClick={() => setTab(item.id)} style={{ flex:1, fontFamily:PP, fontWeight:600, fontSize:12, padding:'12px 0', background:'none', border:'none', borderBottom:`3px solid ${tab === item.id ? C.primary : 'transparent'}`, cursor:'pointer', color:tab === item.id ? C.primary : C.mid, transition:'all .15s' }}>
              {item.label}
            </button>
          ))}
        </div>

        <div style={{ padding:'16px 20px 28px', flex:1 }}>
          {tab === 'info' && (
            <>
              {photos[0] && (
                <div className="provider-detail-img" style={{ borderRadius:16, overflow:'hidden', marginBottom:14 }}>
                  <img src={photos[0]} alt={business.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                </div>
              )}
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
                {category && <Tag bg="#DBEAFE" color={C.primaryDark}>{category.label}</Tag>}
                {business.verified && <Tag bg="#D1FAE5" color="#065F46">✓ Verificado</Tag>}
                {business.featured && <Tag bg="#FEF3C7" color="#92400E">⭐ Destacado</Tag>}
                <Tag bg={C.bg} color={C.mid}>📍 {business.city}</Tag>
              </div>
              <p style={{ fontFamily:PP, fontSize:13, color:C.mid, lineHeight:1.75, marginBottom:14 }}>{business.desc}</p>
              {services.length > 0 && (
                <div style={{ marginBottom:16 }}>
                  <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, marginBottom:8 }}>SERVICIOS</p>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {services.map(service => <span key={service} style={{ fontFamily:PP, fontSize:12, fontWeight:600, background:C.primaryLight, color:C.primary, padding:'7px 14px', borderRadius:10 }}>{service}</span>)}
                  </div>
                </div>
              )}
              <div className="grid-2" style={{ gap:8, marginBottom:14 }}>
                {business.phone && (
                  <a href={`https://wa.me/${business.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ fontFamily:PP, fontWeight:700, fontSize:13, background:'#25D366', color:'#fff', textDecoration:'none', padding:'13px 0', borderRadius:13, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                    💬 WhatsApp
                  </a>
                )}
                {business.instagram && (
                  <a href={`https://instagram.com/${business.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" style={{ fontFamily:PP, fontWeight:700, fontSize:13, background:'#E1306C', color:'#fff', textDecoration:'none', padding:'13px 0', borderRadius:13, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                    📸 Instagram
                  </a>
                )}
              </div>
              {reviews.length > 0 && (
                <button onClick={() => setTab('resenas')} style={{ width:'100%', background:C.bg, border:`1px solid ${C.border}`, borderRadius:13, padding:'11px 14px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <Stars rating={rating} size={14} />
                    <span style={{ fontFamily:PP, fontSize:12, fontWeight:600, color:C.text }}>{rating} de 5</span>
                  </div>
                  <span style={{ fontFamily:PP, fontSize:11, color:C.primary, fontWeight:600 }}>Ver {reviews.length} reseñas →</span>
                </button>
              )}
            </>
          )}

          {tab === 'fotos' && (
            <>
              <PhotoGallery photos={photos.slice(1)} mainPhoto={photos[0]} />
              <p style={{ fontFamily:PP, fontSize:11, color:C.light, textAlign:'center' }}>
                {photos.length} foto{photos.length !== 1 ? 's' : ''} · Toca las miniaturas para navegar
              </p>
            </>
          )}

          {tab === 'resenas' && (
            <>
              {reviews.length > 0 && (
                <div style={{ background:C.bg, borderRadius:16, padding:'16px', marginBottom:16, display:'flex', gap:20, alignItems:'center' }}>
                  <div style={{ textAlign:'center' }}>
                    <p style={{ fontFamily:PP, fontWeight:900, fontSize:36, color:C.text, margin:'0 0 4px', letterSpacing:-1 }}>{rating}</p>
                    <Stars rating={rating} size={16} />
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

              {!showReviewForm ? (
                <button onClick={() => setShowReviewForm(true)} style={{ width:'100%', background:C.primaryLight, border:`1.5px dashed ${C.primary}`, borderRadius:14, padding:'12px 0', fontFamily:PP, fontWeight:700, fontSize:13, color:C.primary, cursor:'pointer', marginBottom:14 }}>
                  ✍️ Escribir una reseña
                </button>
              ) : (
                <ReviewForm onSubmit={handleAddReview} onCancel={() => setShowReviewForm(false)} />
              )}

              {reviews.length === 0 ? (
                <div style={{ textAlign:'center', padding:'32px 0' }}>
                  <p style={{ fontSize:40, marginBottom:10 }}>⭐</p>
                  <p style={{ fontFamily:PP, fontWeight:700, fontSize:15, color:C.text, marginBottom:5 }}>Sin reseñas todavía</p>
                  <p style={{ fontFamily:PP, fontSize:12, color:C.light }}>¡Sé el primero en dejar una reseña!</p>
                </div>
              ) : (
                reviews.map(review => <ReviewCard key={review.id} review={review} />)
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function EventCard({ event, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{ background:'#fff', borderRadius:20, border:`1px solid ${C.border}`, overflow:'hidden', cursor:'pointer', transition:'all .2s' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 28px rgba(37,99,235,0.12)'; e.currentTarget.style.transform = 'translateY(-3px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <div style={{ position:'relative', height:180, overflow:'hidden', background:C.primaryLight }}>
        {event.img ? (
          <img src={event.img} alt={event.title} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        ) : (
          <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:48 }}>{event.emoji}</div>
        )}
        {event.featured && <span style={{ position:'absolute', top:12, left:12, fontFamily:PP, fontSize:10, fontWeight:700, background:C.primary, color:'#fff', padding:'4px 10px', borderRadius:12 }}>Destacado</span>}
        <div style={{ position:'absolute', right:12, top:12, background:'rgba(255,255,255,0.96)', borderRadius:16, padding:'10px 10px 8px', minWidth:58, textAlign:'center', boxShadow:'0 8px 20px rgba(15,23,42,0.12)' }}>
          <p style={{ fontFamily:PP, fontWeight:900, fontSize:20, color:C.text, margin:'0 0 1px', lineHeight:1 }}>{event.day}</p>
          <p style={{ fontFamily:PP, fontWeight:700, fontSize:10, color:C.primary, margin:0 }}>{event.month}</p>
        </div>
      </div>
      <div style={{ padding:'16px 16px 18px' }}>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
          <Tag bg="#DBEAFE" color={C.primaryDark}>{EVENTO_TYPES.find(type => type.id === event.type)?.label || 'Evento'}</Tag>
          <Tag bg={C.bg} color={C.mid}>📍 {event.city}</Tag>
        </div>
        <h3 style={{ fontFamily:PP, fontWeight:800, fontSize:16, color:C.text, margin:'0 0 6px', lineHeight:1.3 }}>{event.title}</h3>
        <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:'0 0 9px' }}>{event.venue} · {event.time} · {event.price}</p>
        <p style={{ fontFamily:PP, fontSize:12, color:C.mid, lineHeight:1.65, margin:'0 0 14px', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{event.desc}</p>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
          <span style={{ fontFamily:PP, fontSize:11, color:C.light }}>Organiza {event.host}</span>
          <span style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.primary }}>Ver evento →</span>
        </div>
      </div>
    </div>
  )
}

function EventDetail({ event, onClose }) {
  if (!event) return null

  return (
    <Modal show={!!event} onClose={onClose} title={event.title}>
      {event.img && (
        <div style={{ borderRadius:18, overflow:'hidden', marginBottom:16 }}>
          <img src={event.img} alt={event.title} style={{ width:'100%', height:220, objectFit:'cover' }} />
        </div>
      )}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
        <Tag bg="#DBEAFE" color={C.primaryDark}>{EVENTO_TYPES.find(type => type.id === event.type)?.label || 'Evento'}</Tag>
        <Tag bg={C.bg} color={C.mid}>📍 {event.city}</Tag>
        <Tag bg={C.bg} color={C.mid}>🕒 {event.time}</Tag>
        <Tag bg={C.bg} color={C.mid}>🎟 {event.price}</Tag>
      </div>
      <InfoBanner emoji={event.emoji} title={`${event.day} ${event.month} · ${event.venue}`} text={`Organiza ${event.host}`} bg={C.primaryLight} border={C.primaryMid} color={C.primaryDark} />
      <p style={{ fontFamily:PP, fontSize:13, color:C.mid, lineHeight:1.8, marginBottom:18 }}>{event.desc}</p>
      <a href={event.link} target="_blank" rel="noreferrer" style={{ fontFamily:PP, fontWeight:700, fontSize:13, background:C.primary, color:'#fff', textDecoration:'none', padding:'13px 18px', borderRadius:14, display:'inline-flex' }}>
        Ver detalles / reservar
      </a>
    </Modal>
  )
}

export default function Comunidades() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [communities, setCommunities] = useState([])
  const [businesses, setBusinesses] = useState(MOCK_NEGOCIOS)
  const [businessServices, setBusinessServices] = useState(MOCK_NEGOCIO_SERVICES)
  const [businessPhotos, setBusinessPhotos] = useState(MOCK_NEGOCIO_PHOTOS)
  const [businessReviews, setBusinessReviews] = useState(MOCK_NEGOCIO_REVIEWS)
  const [events, setEvents] = useState(MOCK_EVENTOS_LATINOS)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('')
  const [negType, setNegType] = useState('')
  const [eventType, setEventType] = useState('')
  const [selectedBusiness, setSelectedBusiness] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)

  const view = searchParams.get('view')
  const tab = MAIN_TABS.some(item => item.id === view) ? view : 'comunidades'

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        const [communitiesRes, providersRes, photosRes, reviewsRes, eventsRes] = await Promise.all([
          supabase.from('communities').select('*').eq('active', true).order('members', { ascending:false }),
          supabase.from('providers').select('*').eq('active', true).order('featured', { ascending:false }).order('verified', { ascending:false }).order('created_at', { ascending:false }),
          supabase.from('provider_photos').select('*').order('is_main', { ascending:false }).order('sort_order', { ascending:true }),
          supabase.from('reviews').select('*').eq('active', true).order('created_at', { ascending:false }),
          supabase.from('events').select('*').eq('active', true).order('featured', { ascending:false }).order('created_at', { ascending:false }),
        ])

        if (cancelled) return

        setCommunities(communitiesRes.error || !communitiesRes.data?.length ? MOCK_COMMUNITIES : communitiesRes.data)

        const nextBusinesses = providersRes.error || !providersRes.data?.length
          ? MOCK_NEGOCIOS
          : providersRes.data.map(normalizeProvider)
        setBusinesses(nextBusinesses)

        const nextEvents = eventsRes.error || !eventsRes.data?.length
          ? MOCK_EVENTOS_LATINOS
          : eventsRes.data.map(normalizeEvent)
        setEvents(nextEvents)

        const nextServices = { ...MOCK_NEGOCIO_SERVICES }
        const nextPhotos = { ...MOCK_NEGOCIO_PHOTOS }
        const nextReviews = { ...MOCK_NEGOCIO_REVIEWS }

        if (!providersRes.error && providersRes.data?.length) {
          providersRes.data.forEach(provider => {
            const normalized = normalizeProvider(provider)
            if (normalized.services.length) nextServices[normalized.id] = normalized.services
            if (normalized.photo_url) {
              nextPhotos[normalized.id] = [normalized.photo_url, ...(nextPhotos[normalized.id] || [])]
            }
            if (!nextReviews[normalized.id]) nextReviews[normalized.id] = []
          })
        }

        if (!photosRes.error && photosRes.data?.length) {
          photosRes.data.forEach(photo => {
            if (!photo?.provider_id || !photo?.url) return
            nextPhotos[photo.provider_id] = [...(nextPhotos[photo.provider_id] || []), photo.url]
          })
        }

        Object.keys(nextPhotos).forEach(providerId => {
          nextPhotos[providerId] = [...new Set((nextPhotos[providerId] || []).filter(Boolean))]
        })

        if (!reviewsRes.error && reviewsRes.data?.length) {
          reviewsRes.data.forEach(review => {
            if (!review?.provider_id) return
            nextReviews[review.provider_id] = [
              ...(nextReviews[review.provider_id] || []),
              {
                id: review.id,
                author: review.author_name || 'Usuario',
                canton: review.canton || '',
                stars: review.stars,
                date: formatRelativeDate(review.created_at),
                text: review.text,
              },
            ]
          })
        }

        setBusinessServices(nextServices)
        setBusinessPhotos(nextPhotos)
        setBusinessReviews(nextReviews)
      } catch {
        if (cancelled) return
        setCommunities(MOCK_COMMUNITIES)
        setBusinesses(MOCK_NEGOCIOS)
        setBusinessServices(MOCK_NEGOCIO_SERVICES)
        setBusinessPhotos(MOCK_NEGOCIO_PHOTOS)
        setBusinessReviews(MOCK_NEGOCIO_REVIEWS)
        setEvents(MOCK_EVENTOS_LATINOS)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [])

  const handleTabChange = nextTab => {
    const params = new URLSearchParams(searchParams)
    if (nextTab === 'comunidades') params.delete('view')
    else params.set('view', nextTab)
    setSearchParams(params, { replace:true })
    setSearch('')
    setCat('')
    setNegType('')
    setEventType('')
  }

  const catOptions = useMemo(() => [{ id:'', label:'Todas' }, ...COMMUNITY_CATS.map(item => ({ id:item.id, label:`${item.emoji} ${item.label}` }))], [])

  const filteredComm = communities.filter(group =>
    (!cat || group.cat === cat) &&
    (!search || group.name.toLowerCase().includes(search.toLowerCase()) || group.desc.toLowerCase().includes(search.toLowerCase()))
  )

  const filteredNeg = [...businesses]
    .sort((a, b) => Number(b.featured) - Number(a.featured) || Number(b.verified) - Number(a.verified))
    .filter(business =>
      (!negType || business.type === negType) &&
      (!search ||
        business.name.toLowerCase().includes(search.toLowerCase()) ||
        business.desc.toLowerCase().includes(search.toLowerCase()) ||
        business.city.toLowerCase().includes(search.toLowerCase()) ||
        (businessServices[business.id] || business.services || []).some(service => service.toLowerCase().includes(search.toLowerCase())))
    )

  const filteredEvents = [...events]
    .sort((a, b) => Number(b.featured) - Number(a.featured))
    .filter(event =>
      (!eventType || event.type === eventType) &&
      (!search ||
        event.title.toLowerCase().includes(search.toLowerCase()) ||
        event.desc.toLowerCase().includes(search.toLowerCase()) ||
        event.city.toLowerCase().includes(search.toLowerCase()) ||
        event.venue.toLowerCase().includes(search.toLowerCase()) ||
        event.host.toLowerCase().includes(search.toLowerCase()))
    )

  return (
    <div style={{ maxWidth:1000, margin:'0 auto', padding:'32px 24px 100px' }}>
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:26, color:C.text, marginBottom:6, letterSpacing:-0.5 }}>🤝 Comunidad latina</h1>
      <p style={{ fontFamily:PP, fontSize:13, color:C.light, marginBottom:20 }}>Grupos, negocios y eventos para latinos en Suiza</p>

      <SegmentedTabs tabs={MAIN_TABS} value={tab} onChange={handleTabChange} />

      <div style={{ position:'relative', marginBottom:12 }}>
        <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:C.light }}>🔍</span>
        <input
          style={{ width:'100%', border:`1.5px solid ${C.border}`, borderRadius:13, padding:'11px 13px 11px 36px', fontSize:12, fontFamily:PP, outline:'none', background:'#fff', boxSizing:'border-box' }}
          placeholder={
            tab === 'comunidades'
              ? 'Buscar comunidad...'
              : tab === 'negocios'
                ? 'Buscar negocio latino...'
                : 'Buscar evento latino...'
          }
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {tab === 'comunidades' && (
        <>
          <PillFilters options={catOptions} value={cat} onChange={setCat} className="mb-4" />
          {loading ? (
            <div className="skeleton" style={{ height:200, borderRadius:20 }} />
          ) : filteredComm.length === 0 ? (
            <EmptyState emoji="😕" title="Sin resultados" action="Ver todas" onAction={() => { setCat(''); setSearch('') }} />
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
              {filteredComm.map(group => (
                <Card key={group.id}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                    <span style={{ fontSize:36 }}>{group.emoji}</span>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                      {group.verified && <Tag bg="#D1FAE5" color="#065F46">✓ Verificado</Tag>}
                      <span style={{ fontFamily:PP, fontSize:10, color:C.light }}>📍 {group.city}</span>
                    </div>
                  </div>
                  <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:15, color:C.text, marginBottom:5, lineHeight:1.3 }}>{group.name}</h3>
                  <p style={{ fontFamily:PP, fontSize:11, color:C.light, marginBottom:8 }}>👥 {group.members} miembros</p>
                  <p style={{ fontFamily:PP, fontSize:12, color:C.mid, lineHeight:1.6, marginBottom:14 }}>{group.desc}</p>
                  <a href={group.contact} target="_blank" rel="noreferrer" style={{ fontFamily:PP, fontWeight:700, fontSize:12, background:C.primary, color:'#fff', textDecoration:'none', padding:'10px 0', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                    {group.contact?.includes('t.me') ? '📲 Telegram' : '💬 WhatsApp'}
                  </a>
                </Card>
              ))}
            </div>
          )}

          <div style={{ marginTop:28, border:`2px dashed ${C.border}`, borderRadius:20, padding:24, textAlign:'center', background:C.primaryLight }}>
            <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:17, color:C.text, marginBottom:8 }}>➕ ¿Tienes una comunidad latina?</h3>
            <p style={{ fontFamily:PP, fontSize:12, color:C.mid, marginBottom:14 }}>Regístrala aquí y llega a más latinos en Suiza. Gratis.</p>
            <Link to="/registrar-comunidad" style={{ fontFamily:PP, fontWeight:700, fontSize:13, background:C.primary, color:'#fff', textDecoration:'none', padding:'12px 24px', borderRadius:14, display:'inline-flex' }}>Registrar comunidad</Link>
          </div>
        </>
      )}

      {tab === 'negocios' && (
        <>
          <PillFilters options={NEGOCIO_TYPES} value={negType} onChange={setNegType} className="mb-4" />
          {loading ? (
            <div className="skeleton" style={{ height:260, borderRadius:20 }} />
          ) : filteredNeg.length === 0 ? (
            <EmptyState emoji="😕" title="Sin resultados" action="Ver todos" onAction={() => { setNegType(''); setSearch('') }} />
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 }}>
              {filteredNeg.map(business => (
                <BusinessCard
                  key={business.id}
                  business={business}
                  onClick={() => setSelectedBusiness(business)}
                  servicesMap={businessServices}
                  photosMap={businessPhotos}
                  reviewsMap={businessReviews}
                />
              ))}
            </div>
          )}

          <div style={{ marginTop:28, border:`2px dashed ${C.border}`, borderRadius:20, padding:24, textAlign:'center', background:C.primaryLight }}>
            <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:17, color:C.text, marginBottom:8 }}>🏪 ¿Tienes un negocio latino?</h3>
            <p style={{ fontFamily:PP, fontSize:12, color:C.mid, marginBottom:14 }}>Regístralo gratis, sube fotos y recibe reseñas de la comunidad.</p>
            <Link to="/registrar-negocio" style={{ fontFamily:PP, fontWeight:700, fontSize:13, background:C.primary, color:'#fff', textDecoration:'none', padding:'12px 24px', borderRadius:14, display:'inline-flex' }}>Registrar negocio</Link>
          </div>
        </>
      )}

      {tab === 'eventos' && (
        <>
          <PillFilters options={EVENTO_TYPES} value={eventType} onChange={setEventType} className="mb-4" />
          {filteredEvents.length === 0 ? (
            <EmptyState emoji="🎟️" title="Sin eventos ahora mismo" action="Ver todos" onAction={() => { setEventType(''); setSearch('') }} />
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 }}>
              {filteredEvents.map(event => <EventCard key={event.id} event={event} onClick={() => setSelectedEvent(event)} />)}
            </div>
          )}

          <div style={{ marginTop:28, border:`2px dashed ${C.border}`, borderRadius:20, padding:24, textAlign:'center', background:C.primaryLight }}>
            <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:17, color:C.text, marginBottom:8 }}>🎉 ¿Organizas un evento latino?</h3>
            <p style={{ fontFamily:PP, fontSize:12, color:C.mid, marginBottom:14 }}>Conciertos, fiestas, networking, festivales o quedadas: publícalo aquí para la comunidad.</p>
            <Link to="/publicar-evento" style={{ fontFamily:PP, fontWeight:700, fontSize:13, background:C.primary, color:'#fff', textDecoration:'none', padding:'12px 24px', borderRadius:14, display:'inline-flex' }}>Publicar evento</Link>
          </div>
        </>
      )}

      {selectedBusiness && (
        <BusinessDetail
          key={selectedBusiness.id}
          business={selectedBusiness}
          onClose={() => setSelectedBusiness(null)}
          servicesMap={businessServices}
          photosMap={businessPhotos}
          reviewsMap={businessReviews}
        />
      )}
      <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  )
}
