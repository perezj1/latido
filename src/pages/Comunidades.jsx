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

const COMMUNITY_OPTIONS = COMMUNITY_CATS
  .filter(item => item.id !== 'fe')
  .map(item => item.id === 'mamas'
    ? { ...item, id:'familia', emoji:'👨‍👩‍👧', label:'Familia' }
    : item)

function normalizeCommunityCategory(value='') {
  if (value === 'mamas') return 'familia'
  if (value === 'fe') return ''
  return value
}

function getCommunityMeta(value='') {
  return COMMUNITY_OPTIONS.find(item => item.id === normalizeCommunityCategory(value)) || null
}

function normalizeCommunity(group) {
  if (!group || group.cat === 'fe') return null

  const normalizedCat = normalizeCommunityCategory(group.cat)
  const category = getCommunityMeta(normalizedCat)

  return {
    id: group.id,
    cat: normalizedCat || '',
    name: (group.name || 'Comunidad').replace(/Mam[aá]s Latinas/gi, 'Familias Latinas'),
    city: group.city || 'Suiza',
    members: group.members || 0,
    emoji: group.emoji || category?.emoji || '🤝',
    verified: !!group.verified,
    desc: group.desc || group.description || '',
    contact: group.contact || '',
  }
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

function ensureUrl(value='') {
  if (!value) return ''
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

function formatUrlLabel(value='') {
  return value.replace(/^https?:\/\//i, '').replace(/\/$/, '')
}

function normalizePhoneForTel(value='') {
  return value.replace(/[^\d+]/g, '')
}

function normalizePhoneForWhatsapp(value='') {
  return value.replace(/\D/g, '')
}

function formatInstagramHandle(value='') {
  if (!value) return ''
  return value.startsWith('@') ? value : `@${value}`
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
    phone: provider.phone || provider.whatsapp || '',
    whatsapp: provider.whatsapp || provider.phone || '',
    instagram: provider.instagram || '',
    email: provider.email || '',
    website: provider.website || '',
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

function getBusinessContactMethods(business) {
  const phone = (business.phone || business.whatsapp || '').trim()
  const whatsapp = (business.whatsapp || business.phone || '').trim()
  const email = (business.email || '').trim()
  const instagram = formatInstagramHandle((business.instagram || '').trim())

  const methods = []

  if (phone) {
    methods.push({
      id:'phone',
      icon:'📞',
      label:'Teléfono',
      value:phone,
      href:`tel:${normalizePhoneForTel(phone)}`,
      external:false,
    })
  }

  if (whatsapp) {
    methods.push({
      id:'whatsapp',
      icon:'💬',
      label:'WhatsApp',
      value:whatsapp,
      href:`https://wa.me/${normalizePhoneForWhatsapp(whatsapp)}`,
      external:true,
    })
  }

  if (email) {
    methods.push({
      id:'email',
      icon:'✉️',
      label:'Email',
      value:email,
      href:`mailto:${email}`,
      external:false,
    })
  }

  if (instagram) {
    methods.push({
      id:'instagram',
      icon:'📸',
      label:'Instagram',
      value:instagram,
      href:`https://instagram.com/${instagram.replace('@', '')}`,
      external:true,
    })
  }

  return methods
}

function BusinessCard({ business, onClick, servicesMap, photosMap, reviewsMap }) {
  const category = NEGOCIO_TYPES.find(type => type.id === business.type)
  const services = servicesMap[business.id] || business.services || []
  const photos = photosMap[business.id] || (business.photo_url ? [business.photo_url] : [])
  const reviews = reviewsMap[business.id] || []
  const rating = averageRating(reviews)
  const cover = photos[0] || business.photo_url
  const whatsappNumber = business.whatsapp || business.phone || ''

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
          {whatsappNumber && (
            <a
              href={`https://wa.me/${normalizePhoneForWhatsapp(whatsappNumber)}`}
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
  const [showContacts, setShowContacts] = useState(false)
  const [tab, setTab] = useState('info')
  const rating = averageRating(reviews)
  const contactMethods = getBusinessContactMethods(business)
  const websiteLabel = business.website ? formatUrlLabel(business.website) : ''
  const websiteHref = business.website ? ensureUrl(business.website) : ''

  useEffect(() => {
    setReviews(reviewsMap[business.id] || [])
    setShowContacts(false)
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
              <p style={{ fontFamily:PP, fontSize:13, color:C.mid, lineHeight:1.75, marginBottom:business.website ? 8 : 14 }}>{business.desc}</p>
              {business.website && (
                <a
                  href={websiteHref}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontFamily:PP, fontWeight:600, fontSize:12, color:C.primary, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:6, marginBottom:16 }}
                >
                  🌐 {websiteLabel}
                </a>
              )}
              {services.length > 0 && (
                <div style={{ marginBottom:16 }}>
                  <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, marginBottom:8 }}>SERVICIOS</p>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {services.map(service => <span key={service} style={{ fontFamily:PP, fontSize:12, fontWeight:600, background:C.primaryLight, color:C.primary, padding:'7px 14px', borderRadius:10 }}>{service}</span>)}
                  </div>
                </div>
              )}
              {contactMethods.length > 0 && (
                <div style={{ marginBottom:14 }}>
                  <button
                    onClick={() => setShowContacts(current => !current)}
                    style={{ width:'100%', fontFamily:PP, fontWeight:700, fontSize:13, background:C.primary, color:'#fff', border:'none', textDecoration:'none', padding:'13px 16px', borderRadius:13, display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, cursor:'pointer' }}
                  >
                    <span>📬 Contacto</span>
                    <span style={{ fontSize:12 }}>{showContacts ? 'Ocultar' : 'Ver opciones'}</span>
                  </button>
                  {showContacts && (
                    <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:16, padding:10, marginTop:10, display:'flex', flexDirection:'column', gap:8 }}>
                      {contactMethods.map(method => (
                        <a
                          key={method.id}
                          href={method.href}
                          target={method.external ? '_blank' : undefined}
                          rel={method.external ? 'noreferrer' : undefined}
                          style={{ background:'#fff', border:`1px solid ${C.border}`, borderRadius:12, padding:'12px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, textDecoration:'none' }}
                        >
                          <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                            <span style={{ fontSize:16, flexShrink:0 }}>{method.icon}</span>
                            <div style={{ minWidth:0 }}>
                              <p style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:C.text, margin:'0 0 2px' }}>{method.label}</p>
                              <p style={{ fontFamily:PP, fontSize:12, color:C.mid, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{method.value}</p>
                            </div>
                          </div>
                          <span style={{ fontFamily:PP, fontSize:12, fontWeight:700, color:C.primary, flexShrink:0 }}>
                            {method.external ? 'Abrir ↗' : 'Abrir →'}
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
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

function CommunityDetail({ community, onClose, isLoggedIn }) {
  if (!community) return null

  const category = getCommunityMeta(community.cat)

  return (
    <Modal show={!!community} onClose={onClose} title={community.name}>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
        {category && <Tag bg="#DBEAFE" color={C.primaryDark}>{category.emoji} {category.label}</Tag>}
        <Tag bg={C.bg} color={C.mid}>📍 {community.city}</Tag>
        <Tag bg={C.bg} color={C.mid}>👥 {community.members} miembros</Tag>
        {community.verified && <Tag bg="#D1FAE5" color="#065F46">✓ Verificada</Tag>}
      </div>

      <InfoBanner
        emoji={community.emoji}
        title="Comunidad latina en Suiza"
        text="Descubre de qué va el grupo y entra cuando te encaje."
        bg={C.primaryLight}
        border={C.primaryMid}
        color={C.primaryDark}
      />

      <p style={{ fontFamily:PP, fontSize:13, color:C.mid, lineHeight:1.8, marginBottom:18 }}>
        {community.desc || 'Comunidad latina en Suiza.'}
      </p>

      {community.contact && (() => {
        const url = community.contact
        let icon = '🔗', label = 'Unirme a la comunidad', bg = C.primary
        if (url.includes('chat.whatsapp.com') || url.includes('wa.me')) { icon = '💬'; label = 'Unirme por WhatsApp'; bg = '#25D366' }
        else if (url.includes('t.me') || url.includes('telegram')) { icon = '✈️'; label = 'Unirme por Telegram'; bg = '#229ED9' }
        else if (url.includes('meetup.com')) { icon = '📅'; label = 'Unirme en Meetup'; bg = '#E0393E' }
        else if (url.includes('facebook.com')) { icon = '👥'; label = 'Ver en Facebook'; bg = '#1877F2' }
        else if (url.includes('instagram.com')) { icon = '📸'; label = 'Seguir en Instagram'; bg = '#E1306C' }
        return (
          <a href={url} target="_blank" rel="noreferrer" style={{ fontFamily:PP, fontWeight:700, fontSize:13, background:bg, color:'#fff', textDecoration:'none', padding:'13px 18px', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', gap:8, width:'100%', boxSizing:'border-box', marginBottom:16 }}>
            <span>{icon}</span>{label}
          </a>
        )
      })()}

      {!isLoggedIn && (
        <div style={{ background:'#EFF6FF', border:`1px solid ${C.primaryMid}`, borderRadius:16, padding:'14px 16px' }}>
          <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.primaryDark, margin:'0 0 4px' }}>
            Estás en la versión pública
          </p>
          <p style={{ fontFamily:PP, fontSize:11, color:C.mid, margin:'0 0 10px', lineHeight:1.6 }}>
            Para publicar tu propia comunidad y acceder a más herramientas, crea una cuenta gratuita.
          </p>
          <Link to="/auth" style={{ fontFamily:PP, fontWeight:700, fontSize:12, background:C.primary, color:'#fff', textDecoration:'none', borderRadius:12, padding:'12px 14px', display:'flex', alignItems:'center', justifyContent:'center', width:'100%', boxSizing:'border-box' }}>
            Crear cuenta gratis
          </Link>
        </div>
      )}
    </Modal>
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

const COMUNIDADES_CACHE_TTL = 5 * 60 * 1000
const comunidadesCache = { data: null, ts: 0 }

function applyCachedData(snapshot, setters) {
  setters.setCommunities(snapshot.communities)
  setters.setBusinesses(snapshot.businesses)
  setters.setBusinessServices(snapshot.businessServices)
  setters.setBusinessPhotos(snapshot.businessPhotos)
  setters.setBusinessReviews(snapshot.businessReviews)
  setters.setEvents(snapshot.events)
}

export default function Comunidades() {
  const { isLoggedIn } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [communities, setCommunities] = useState(() => comunidadesCache.data?.communities ?? [])
  const [businesses, setBusinesses] = useState(() => comunidadesCache.data?.businesses ?? MOCK_NEGOCIOS)
  const [businessServices, setBusinessServices] = useState(() => comunidadesCache.data?.businessServices ?? MOCK_NEGOCIO_SERVICES)
  const [businessPhotos, setBusinessPhotos] = useState(() => comunidadesCache.data?.businessPhotos ?? MOCK_NEGOCIO_PHOTOS)
  const [businessReviews, setBusinessReviews] = useState(() => comunidadesCache.data?.businessReviews ?? MOCK_NEGOCIO_REVIEWS)
  const [events, setEvents] = useState(() => comunidadesCache.data?.events ?? MOCK_EVENTOS_LATINOS)
  const [loading, setLoading] = useState(!comunidadesCache.data)
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('')
  const [negType, setNegType] = useState('')
  const [selectedCommunity, setSelectedCommunity] = useState(null)
  const [selectedBusiness, setSelectedBusiness] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)

  const view = searchParams.get('view')
  const openCommunityId = searchParams.get('openCommunity') || ''
  const openBusinessId = searchParams.get('openBusiness') || ''
  const openEventId = searchParams.get('openEvent') || ''
  const tab = MAIN_TABS.some(item => item.id === view) ? view : 'comunidades'

  useEffect(() => {
    let cancelled = false

    const setters = { setCommunities, setBusinesses, setBusinessServices, setBusinessPhotos, setBusinessReviews, setEvents }

    async function loadData() {
      if (comunidadesCache.data) {
        applyCachedData(comunidadesCache.data, setters)
        setLoading(false)
        if (Date.now() - comunidadesCache.ts <= COMUNIDADES_CACHE_TTL) return
      }

      try {
        const [communitiesRes, providersRes, photosRes, reviewsRes, eventsRes] = await Promise.all([
          supabase.from('communities').select('*').eq('active', true).order('members', { ascending:false }).limit(100),
          supabase.from('providers').select('*').eq('active', true).order('featured', { ascending:false }).order('verified', { ascending:false }).order('created_at', { ascending:false }).limit(100),
          supabase.from('provider_photos').select('*').order('is_main', { ascending:false }).order('sort_order', { ascending:true }).limit(500),
          supabase.from('reviews').select('*').eq('active', true).order('created_at', { ascending:false }).limit(300),
          supabase.from('events').select('*').eq('active', true).order('featured', { ascending:false }).order('created_at', { ascending:false }).limit(100),
        ])

        if (cancelled) return

        const nextCommunities = (communitiesRes.error || !communitiesRes.data?.length ? MOCK_COMMUNITIES : communitiesRes.data)
          .map(normalizeCommunity)
          .filter(Boolean)
        setCommunities(nextCommunities)

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

        if (!cancelled) {
          comunidadesCache.data = {
            communities: nextCommunities,
            businesses: nextBusinesses,
            businessServices: nextServices,
            businessPhotos: nextPhotos,
            businessReviews: nextReviews,
            events: nextEvents,
          }
          comunidadesCache.ts = Date.now()
        }
      } catch {
        if (cancelled) return
        setCommunities(MOCK_COMMUNITIES.map(normalizeCommunity).filter(Boolean))
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
    params.delete('openCommunity')
    params.delete('openBusiness')
    params.delete('openEvent')
    setSearchParams(params, { replace:true })
    setSearch('')
    setCat('')
    setNegType('')
  }

  const updateOpenState = (key, value, nextView='comunidades') => {
    const params = new URLSearchParams(searchParams)
    params.delete('openCommunity')
    params.delete('openBusiness')
    params.delete('openEvent')

    if (nextView === 'comunidades') params.delete('view')
    else params.set('view', nextView)

    if (value) params.set(key, value)
    setSearchParams(params, { replace:true })
  }

  const openCommunityDetails = (community) => {
    setSelectedCommunity(community)
    updateOpenState('openCommunity', community.id, 'comunidades')
  }

  const closeCommunityDetails = () => {
    setSelectedCommunity(null)
    updateOpenState('openCommunity', '', 'comunidades')
  }

  const openBusinessDetails = (business) => {
    setSelectedBusiness(business)
    updateOpenState('openBusiness', business.id, 'negocios')
  }

  const closeBusinessDetails = () => {
    setSelectedBusiness(null)
    updateOpenState('openBusiness', '', 'negocios')
  }

  const closeEventDetails = () => {
    setSelectedEvent(null)
    updateOpenState('openEvent', '', 'eventos')
  }

  const catOptions = useMemo(() => [{ id:'', label:'Todas' }, ...COMMUNITY_OPTIONS.map(item => ({ id:item.id, label:`${item.emoji} ${item.label}` }))], [])

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


  useEffect(() => {
    if (loading) return

    if (!openCommunityId) setSelectedCommunity(null)
    else {
      const community = communities.find(entry => String(entry.id) === openCommunityId)
      if (community) setSelectedCommunity(community)
    }

    if (!openBusinessId) setSelectedBusiness(null)
    else {
      const business = businesses.find(entry => String(entry.id) === openBusinessId)
      if (business) setSelectedBusiness(business)
    }

    if (!openEventId) setSelectedEvent(null)
    else {
      const event = events.find(entry => String(entry.id) === openEventId)
      if (event) setSelectedEvent(event)
    }
  }, [businesses, communities, events, loading, openBusinessId, openCommunityId, openEventId])

  return (
    <div style={{ maxWidth:1000, margin:'0 auto', padding:'32px 24px 100px' }}>
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:26, color:C.text, marginBottom:6, letterSpacing:-0.5 }}>🤝 Comunidad latina</h1>
      <p style={{ fontFamily:PP, fontSize:13, color:C.light, marginBottom:20 }}>Grupos, negocios y eventos para latinos en Suiza</p>

      <SegmentedTabs tabs={MAIN_TABS} value={tab} onChange={handleTabChange} />

      {!isLoggedIn && (
        <div style={{ background:'#EFF6FF', border:`1px solid ${C.primaryMid}`, borderRadius:16, padding:'14px 16px', marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <div>
            <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.primaryDark, margin:'0 0 4px' }}>
              Estás viendo la versión pública
            </p>
            <p style={{ fontFamily:PP, fontSize:11, color:C.mid, margin:0, lineHeight:1.6 }}>
              Explora comunidades, negocios y eventos públicos. Para publicar y acceder a más herramientas, crea una cuenta gratuita.
            </p>
          </div>
          <Link to="/auth" style={{ fontFamily:PP, fontWeight:700, fontSize:12, background:C.primary, color:'#fff', textDecoration:'none', borderRadius:12, padding:'11px 16px', whiteSpace:'nowrap' }}>
            Crear cuenta gratis
          </Link>
        </div>
      )}

      {/* Search bar — hidden in eventos tab */}
      {tab !== 'eventos' && (
        <div style={{ position:'relative', marginBottom:12 }}>
          <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:C.light }}>🔍</span>
          <input
            style={{ width:'100%', border:`1.5px solid ${C.border}`, borderRadius:13, padding:'11px 13px 11px 36px', fontSize:12, fontFamily:PP, outline:'none', background:'#fff', boxSizing:'border-box' }}
            placeholder={
              tab === 'comunidades'
                ? 'Buscar comunidad...'
                : 'Buscar negocio latino...'
            }
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      )}

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
                <Card key={group.id} onClick={() => openCommunityDetails(group)}>
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
                  <div style={{ fontFamily:PP, fontWeight:700, fontSize:12, background:C.primary, color:'#fff', padding:'10px 0', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                    Ver comunidad →
                  </div>
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
                  onClick={() => openBusinessDetails(business)}
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
          <div style={{ borderRadius:20, overflow:'hidden', border:`1px solid ${C.border}`, marginBottom:24 }}>
            <iframe
              title="Eventos latinos en Suiza"
              width="100%"
              height="680"
              style={{ border:'none', display:'block' }}
              src="https://embed.eventfrog.ch/en/events.html?key=77224CCC-2A95-41B2-A934-4DA743FC30CA&color=2563eb&showSearch=false&disableAddEntry=true&excludeOrgs=false&searchTerm=latino&geoRadius=60"
              loading="lazy"
              allow="fullscreen"
            />
          </div>

          <div style={{ borderRadius:20, overflow:'hidden', border:`1px solid ${C.border}`, marginBottom:24 }}>
            <iframe
              title="Eventos en español en Suiza"
              width="100%"
              height="680"
              style={{ border:'none', display:'block' }}
              src="https://embed.eventfrog.ch/en/events.html?key=77224CCC-2A95-41B2-A934-4DA743FC30CA&color=2563eb&showSearch=false&disableAddEntry=true&excludeOrgs=false&searchTerm=spanish&geoRadius=60"
              loading="lazy"
              allow="fullscreen"
            />
          </div>

          <div style={{ border:`2px dashed ${C.border}`, borderRadius:20, padding:24, textAlign:'center', background:C.primaryLight }}>
            <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:17, color:C.text, marginBottom:8 }}>🎉 ¿Organizas un evento latino?</h3>
            <p style={{ fontFamily:PP, fontSize:12, color:C.mid, marginBottom:14 }}>Conciertos, fiestas, networking, festivales o quedadas: publícalo aquí para la comunidad.</p>
            <Link to="/publicar-evento" style={{ fontFamily:PP, fontWeight:700, fontSize:13, background:C.primary, color:'#fff', textDecoration:'none', padding:'12px 24px', borderRadius:14, display:'inline-flex' }}>Publicar evento</Link>
          </div>
        </>
      )}

      <CommunityDetail community={selectedCommunity} onClose={closeCommunityDetails} isLoggedIn={isLoggedIn} />

      {selectedBusiness && (
        <BusinessDetail
          key={selectedBusiness.id}
          business={selectedBusiness}
          onClose={closeBusinessDetails}
          servicesMap={businessServices}
          photosMap={businessPhotos}
          reviewsMap={businessReviews}
        />
      )}
      <EventDetail event={selectedEvent} onClose={closeEventDetails} />
    </div>
  )
}
