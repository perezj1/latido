import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useFavorites } from '../hooks/useFavorites'
import { trackSearchEvent } from '../lib/analytics'
import {
  MOCK_COMMUNITIES,
  MOCK_NEGOCIOS,
  MOCK_NEGOCIO_PHOTOS,
  MOCK_NEGOCIO_REVIEWS,
  MOCK_NEGOCIO_SERVICES,
  MOCK_EVENTOS_LATINOS,
  CANTONS,
  COMMUNITY_CATS,
  VISIBLE_NEGOCIO_TYPES,
  getNegocioTypeMeta,
  normalizeNegocioType,
  EVENTO_TYPES,
} from '../lib/constants'
import { C, PP } from '../lib/theme'
import { Tag, EmptyState, SegmentedTabs, FullPageOverlay, InfoBanner, Stars, ReviewForm, ReviewList, PhotoGallery, ImageLightbox } from '../components/UI'
import EventfrogCalendar from '../components/EventfrogCalendar'
import CompactFilterSelect from '../components/CompactFilterSelect'
import ShareButton, { buildShareUrl } from '../components/ShareButton'
import FavoriteButton from '../components/FavoriteButton'
import { getBusinessVerificationStatus } from '../lib/businessVerification'
import { getBusinessPath, getEventPath, getIdFromSlug } from '../lib/seo'
import { getMissingColumnName } from '../lib/supabaseCompat'
import { normalizeExternalUrl } from '../lib/links'
import toast from 'react-hot-toast'

const MAIN_TABS = [
  { id:'negocios', label:'🏪 Negocios' },
  { id:'comunidades', label:'👥 Grupos' },
  { id:'eventos', label:'🎉 Eventos' },
]

const TAB_COPY = {
  negocios:{
    title:'🏪 Negocios',
    subtitle:'Restaurantes, tiendas, profesionales y servicios hispanohablantes.',
    search:'Buscar negocio, servicio o ciudad...',
    emptyTitle:'No hay negocios con estos filtros',
    emptyText:'Prueba otra categoría o registra tu negocio gratis.',
  },
  comunidades:{
    title:'👥 Grupos',
    subtitle:'Comunidades, chats y redes de apoyo por ciudad o interés.',
    search:'Buscar grupo, país, interés o ciudad...',
    emptyTitle:'No hay grupos con estos filtros',
    emptyText:'Prueba otra categoría o registra un grupo para la comunidad.',
  },
  eventos:{
    title:'🎉 Eventos',
    subtitle:'Actividades con fecha: conciertos, fiestas, quedadas y planes familiares.',
    emptyTitle:'Sin eventos de la comunidad aún',
    emptyText:'Publica el primer evento para que otros puedan encontrarlo.',
  },
}

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

const COMMUNITY_SELECT = {
  withPhoto:'id, cat, name, city, members, emoji, verified, desc, contact, photo_url, created_at',
  safe:'id, cat, name, city, members, emoji, verified, desc, contact, created_at',
}

async function fetchCommunitiesForDirectory() {
  const buildQuery = columns => supabase
    .from('communities')
    .select(columns)
    .eq('active', true)
    .order('created_at', { ascending:false })
    .limit(80)

  const response = await buildQuery(COMMUNITY_SELECT.withPhoto)
  if (getMissingColumnName(response.error, 'communities') === 'photo_url') {
    return buildQuery(COMMUNITY_SELECT.safe)
  }
  return response
}

const EVENT_EMOJI = {
  concierto:'🎵',
  festival:'🎪',
  quedada:'🤝',
  fiesta:'💃',
  networking:'💼',
  familia:'👨‍👩‍👧',
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

const COMMUNITY_OPTIONS = COMMUNITY_CATS
  .filter(item => item.id !== 'fe')
  .map(item => item.id === 'mamas'
    ? { ...item, id:'familia', emoji:'👨‍👩‍👧', label:'Familia' }
    : item)

const CHAT_HOSTS = ['chat.whatsapp.com','wa.me','t.me','telegram.me','facebook.com','discord.gg','instagram.com','meetup.com']
function normalizeCommunityContactUrl(contact='') {
  const raw = String(contact || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  if (/^(chat\.whatsapp\.com|wa\.me|t\.me|telegram\.me|facebook\.com|discord\.gg|instagram\.com|meetup\.com)\//i.test(raw)) {
    return `https://${raw}`
  }
  if (/^www\./i.test(raw)) return `https://${raw}`
  if (/^\+?\d[\d\s().-]{6,}$/.test(raw)) {
    return `https://wa.me/${normalizePhoneForWhatsapp(raw)}`
  }
  return raw
}

function isWebCommunity(contact='') {
  const url = normalizeCommunityContactUrl(contact)
  if (!url || !/^https?:\/\//i.test(url)) return false
  return !CHAT_HOSTS.some(h => url.includes(h))
}

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
    name: (group.name || 'Grupo').replace(/Mam[aá]s Latinas/gi, 'Familias Latinas'),
    city: group.city || 'Suiza',
    members: group.members || 0,
    emoji: group.emoji || category?.emoji || '👥',
    verified: !!group.verified,
    desc: group.desc || group.description || '',
    contact: group.contact || '',
    photo_url: group.photo_url || '',
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
  const digits = value.replace(/\D/g, '')
  return /^07\d{8}$/.test(digits) ? `41${digits.slice(1)}` : digits
}

function formatInstagramHandle(value='') {
  if (!value) return ''
  return value.startsWith('@') ? value : `@${value}`
}

function normalizeProvider(provider) {
  const verificationStatus = getBusinessVerificationStatus(provider)
  return {
    id: provider.id,
    created_at: provider.created_at || '',
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
    verified: verificationStatus === 'verified',
    verification_status: verificationStatus,
    featured: !!provider.featured && verificationStatus === 'verified',
    services: Array.isArray(provider.services) ? provider.services : [],
    photo_url: provider.photo_url || '',
    contacts: Array.isArray(provider.contacts) ? provider.contacts : null,
  }
}

function normalizeEvent(event) {
  const link = normalizeExternalUrl(event.link)

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
    link,
  }
}

function averageRating(reviews) {
  if (!reviews?.length) return null
  return +(reviews.reduce((sum, review) => sum + review.stars, 0) / reviews.length).toFixed(1)
}

function normalizeProviderReview(review) {
  return {
    id: review.id,
    provider_id: review.provider_id,
    user_id: review.user_id || '',
    author: review.author_name || 'Usuario',
    canton: review.canton || '',
    stars: Number(review.stars || 0),
    date: formatRelativeDate(review.created_at),
    text: review.text || '',
  }
}

function getRecommendationCopy(count=0) {
  if (count <= 0) {
    return {
      title:'Sé la primera persona en recomendarlo',
      helper:'Tu recomendación ayuda a otros en la comunidad.',
    }
  }
  if (count === 1) return { title:'1 persona lo recomienda' }
  return { title:`${count} personas lo recomiendan.` }
}

function RecommendationBox({ count=0, recommended=false, loading=false, onToggle }) {
  const buttonLabel = recommended ? 'Quitar recomendación' : 'Recomendar este negocio'
  const copy = getRecommendationCopy(count)
  return (
    <div style={{ background:'#fff', border:`1px solid ${C.borderLight}`, borderRadius:12, padding:'8px 9px', marginBottom:14, display:'grid', gridTemplateColumns:'1fr auto', alignItems:'center', gap:8 }}>
      <div style={{ minWidth:0 }}>
        <p style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:C.mid, lineHeight:1.35, margin:0, ...WRAPPING_TEXT }}>{copy.title}</p>
        {copy.helper && (
          <p style={{ fontFamily:PP, fontWeight:500, fontSize:10.5, color:C.light, lineHeight:1.35, margin:'2px 0 0', ...WRAPPING_TEXT }}>{copy.helper}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={loading}
        aria-label={buttonLabel}
        title={buttonLabel}
        style={{ width:38, height:38, display:'inline-flex', alignItems:'center', justifyContent:'center', fontFamily:PP, fontWeight:800, fontSize:18, color:recommended ? '#065F46' : C.primary, background:'#fff', border:`1px solid ${recommended ? '#86EFAC' : C.border}`, borderRadius:'50%', padding:0, cursor:loading ? 'wait' : 'pointer', whiteSpace:'nowrap', flexShrink:0, boxShadow:'0 4px 14px rgba(15,23,42,0.06)', opacity:loading ? 0.7 : 1 }}
      >
        <span aria-hidden="true">👍</span>
      </button>
    </div>
  )
}

function getContentShareText(kind, location) {
  const base = `Mira este ${kind} en Latido.`
  return location ? `${base}\n${location}` : base
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

function getLocationContacts(business) {
  if (!Array.isArray(business.contacts) || !business.contacts.length) return null
  return business.contacts
    .map(loc => ({ city: loc.city || '', address: loc.address || '', phone: loc.phone || '', email: loc.email || '' }))
    .filter(loc => loc.phone || loc.email)
}

function LocationContactsPanel({ locations }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {locations.map((loc, i) => (
        <div key={i} style={{ background:'#fff', border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden' }}>
          <div style={{ background:C.primaryLight, padding:'7px 12px', display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:12 }}>📍</span>
            <span style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:C.primaryDark }}>{loc.city}</span>
            {loc.address && <span style={{ fontFamily:PP, fontSize:10, color:C.mid }}>— {loc.address}</span>}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
            {loc.phone && (
              <a
                href={`tel:${loc.phone.replace(/\s/g,'')}`}
                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 12px', textDecoration:'none', borderBottom: loc.email ? `1px solid ${C.border}` : 'none' }}
              >
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:14 }}>📞</span>
                  <span style={{ fontFamily:PP, fontSize:12, color:C.mid }}>{loc.phone}</span>
                </div>
                <span style={{ fontFamily:PP, fontSize:11, fontWeight:700, color:C.primary }}>Llamar →</span>
              </a>
            )}
            {loc.email && (
              <a
                href={`mailto:${loc.email}`}
                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 12px', textDecoration:'none' }}
              >
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:14 }}>✉️</span>
                  <span style={{ fontFamily:PP, fontSize:12, color:C.mid, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:180 }}>{loc.email}</span>
                </div>
                <span style={{ fontFamily:PP, fontSize:11, fontWeight:700, color:C.primary }}>Email →</span>
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function RelatedRail({ title, children, empty=false }) {
  if (empty) return null
  return (
    <div style={{ marginTop:22, paddingTop:18, borderTop:`1px solid ${C.border}` }}>
      <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:18, color:C.text, margin:'0 0 12px' }}>{title}</h2>
      <div className="no-scroll" style={{ display:'flex', gap:10, overflowX:'auto', margin:'0 -20px', padding:'0 20px 4px' }}>
        {children}
      </div>
    </div>
  )
}

function RelatedCommunityCard({ group, onClick }) {
  const category = getCommunityMeta(group.cat)
  return (
    <button type="button" onClick={onClick} style={{ width:156, flex:'0 0 156px', background:'#fff', border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden', padding:0, textAlign:'left', cursor:'pointer' }}>
      <div style={{ height:112, background:C.primaryLight, display:'flex', alignItems:'center', justifyContent:'center', fontSize:34 }}>
        {group.photo_url ? <img src={group.photo_url} alt={group.name} loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:'contain', display:'block' }} /> : group.emoji}
      </div>
      <div style={{ padding:10 }}>
        <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.text, lineHeight:1.35, margin:'0 0 6px', ...CLAMP_2 }}>{group.name}</p>
        <p style={{ fontFamily:PP, fontSize:10, color:C.light, margin:'0 0 4px', ...CLAMP_1 }}>{category?.label || 'Grupo'}</p>
        <p style={{ fontFamily:PP, fontSize:10, color:C.light, margin:0, ...CLAMP_1 }}>{group.city}</p>
      </div>
    </button>
  )
}

function RelatedBusinessCard({ business, photosMap={}, onClick }) {
  const category = getNegocioTypeMeta(business.type)
  const photos = photosMap[business.id] || (business.photo_url ? [business.photo_url] : [])
  return (
    <button type="button" onClick={onClick} style={{ width:156, flex:'0 0 156px', background:'#fff', border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden', padding:0, textAlign:'left', cursor:'pointer' }}>
      <div style={{ height:112, background:C.primaryLight, display:'flex', alignItems:'center', justifyContent:'center', fontSize:34 }}>
        {photos[0] ? <img src={photos[0]} alt={business.name} loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:'contain', display:'block' }} /> : business.emoji}
      </div>
      <div style={{ padding:10 }}>
        <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.text, lineHeight:1.35, margin:'0 0 6px', ...CLAMP_2 }}>{business.name}</p>
        <p style={{ fontFamily:PP, fontSize:10, color:C.light, margin:'0 0 4px', ...CLAMP_1 }}>{category?.label || 'Negocio'}</p>
        <p style={{ fontFamily:PP, fontSize:10, color:C.light, margin:0, ...CLAMP_1 }}>{business.city}</p>
      </div>
    </button>
  )
}

function RelatedEventCard({ event, onClick }) {
  const category = EVENTO_TYPES.find(type => type.id === event.type)
  return (
    <button type="button" onClick={onClick} style={{ width:156, flex:'0 0 156px', background:'#fff', border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden', padding:0, textAlign:'left', cursor:'pointer' }}>
      <div style={{ height:112, background:C.primaryLight, display:'flex', alignItems:'center', justifyContent:'center', fontSize:34 }}>
        {event.img ? <img src={event.img} alt={event.title} loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:'contain', display:'block' }} /> : event.emoji}
      </div>
      <div style={{ padding:10 }}>
        <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.text, lineHeight:1.35, margin:'0 0 6px', ...CLAMP_2 }}>{event.title}</p>
        <p style={{ fontFamily:PP, fontSize:10, color:C.light, margin:'0 0 4px', ...CLAMP_1 }}>{category?.label || 'Evento'}</p>
        <p style={{ fontFamily:PP, fontSize:10, color:C.light, margin:0, ...CLAMP_1 }}>{event.city}</p>
      </div>
    </button>
  )
}

function CommunityCard({ group, onClick }) {
  const hasImage = !!group.photo_url
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      style={{ ...LIST_CARD_STYLE, minHeight:126 }}
    >
      <div style={{ ...LIST_THUMB_STYLE, background:hasImage ? '#fff' : C.primaryLight }}>
        {hasImage ? (
          <img src={group.photo_url} alt={group.name} loading="lazy" decoding="async" style={LIST_MEDIA_STYLE} />
        ) : (
          <div style={LIST_FALLBACK_STYLE}>{group.emoji}</div>
        )}
      </div>
      <div style={{ flex:1, minWidth:0, padding:'1px 0', display:'flex', flexDirection:'column' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom:5 }}>
          {group.verified && <Tag bg="#D1FAE5" color="#065F46">✓ Verificada</Tag>}
          <Tag bg={C.bg} color={C.mid}>{group.city}</Tag>
        </div>
        <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:14, color:C.text, margin:'0 0 4px', lineHeight:1.32, ...CLAMP_2 }}>{group.name}</h3>
        {!isWebCommunity(group.contact) && <p style={{ fontFamily:PP, fontSize:11, color:C.light, lineHeight:1.3, margin:'0 0 5px', ...CLAMP_1 }}>{group.members} miembros</p>}
        <p style={{ fontFamily:PP, fontSize:12, color:C.mid, lineHeight:1.45, margin:0, whiteSpace:'pre-line', ...CLAMP_2 }}>{group.desc}</p>
      </div>
    </div>
  )
}

function BusinessCard({ business, onClick, servicesMap, photosMap, reviewsMap, recommendationCount=0 }) {
  const category = getNegocioTypeMeta(business.type)
  const services = servicesMap[business.id] || business.services || []
  const photos = photosMap[business.id] || (business.photo_url ? [business.photo_url] : [])
  const reviews = reviewsMap[business.id] || []
  const rating = averageRating(reviews)
  const cover = photos[0] || business.photo_url
  const contactMethods = getBusinessContactMethods(business)
  const locationContacts = getLocationContacts(business)
  const hasContact = locationContacts ? locationContacts.length > 0 : contactMethods.length > 0
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [showContacts, setShowContacts] = useState(false)

  return (
    <div
      onClick={onClick}
      style={{ ...LIST_CARD_STYLE, display:'grid', gridTemplateColumns:'96px minmax(0,1fr)', alignItems:'start', gap:'10px 12px', minHeight:132, transition:'all .2s' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(37,99,235,0.1)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <div style={{ ...LIST_THUMB_STYLE, background:C.primaryLight, overflow:'visible' }}>
        {cover ? (
          <button
            type="button"
            onClick={event => {
              event.stopPropagation()
              setLightboxOpen(true)
            }}
            aria-label="Ampliar fotos del negocio"
            style={{ width:'100%', height:'100%', padding:0, border:'none', background:'transparent', cursor:'zoom-in', display:'block', borderRadius:14, overflow:'hidden' }}
          >
            <img src={cover} alt={business.name} loading="lazy" decoding="async" style={LIST_MEDIA_STYLE} />
          </button>
        ) : (
          <div style={LIST_FALLBACK_STYLE}>{business.emoji}</div>
        )}
        {photos.length > 1 && (
          <span style={{ position:'absolute', bottom:8, left:8, fontFamily:PP, fontSize:9, fontWeight:700, background:'rgba(15,23,42,0.72)', color:'#fff', padding:'3px 7px', borderRadius:999 }}>
            Fotos {photos.length}
          </span>
        )}
        {business.featured && (
          <span style={{ position:'absolute', left:'50%', bottom:-10, transform:'translateX(-50%)', zIndex:2, display:'inline-flex', alignItems:'center', justifyContent:'center', fontFamily:PP, fontSize:9, fontWeight:800, color:C.primary, background:'#fff', border:`1.5px solid ${C.primaryMid}`, borderRadius:999, padding:'5px 10px', boxShadow:'0 8px 18px rgba(37,99,235,0.14)', whiteSpace:'nowrap' }}>
            Destacado
          </span>
        )}
      </div>
      {cover && (
        <ImageLightbox
          open={lightboxOpen}
          photos={photos}
          initialIndex={0}
          onClose={() => setLightboxOpen(false)}
          title={business.name || 'Foto del negocio'}
        />
      )}

      <div style={{ flex:1, minWidth:0, padding:'1px 0', display:'flex', flexDirection:'column' }}>
        <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap', marginBottom:5, minWidth:0 }}>
          <Tag bg={C.primaryLight} color={C.primary} title={category?.label || 'Negocio'}>{category?.label || 'Negocio'}</Tag>
          {business.verified && <Tag bg="#D1FAE5" color="#065F46">✓ Verificada</Tag>}
        </div>
        <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:14, color:C.text, margin:'0 0 4px', lineHeight:1.32, ...CLAMP_2 }}>{business.name}</h3>
        <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:6, flexWrap:'wrap', minWidth:0 }}>
          {rating !== null ? (
            <Stars rating={rating} size={13} showNumber count={reviews.length} />
          ) : (
            <span style={{ fontFamily:PP, fontSize:10, color:C.light }}>Sin reseñas aún</span>
          )}
          {recommendationCount > 0 && <span style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.mid, display:'inline-flex', alignItems:'center', gap:3 }}>👍 {recommendationCount}</span>}
          <span style={{ fontFamily:PP, fontSize:10, color:C.light, ...CLAMP_1 }}>{business.city}</span>
        </div>
        <p style={{ fontFamily:PP, fontSize:12, color:C.mid, lineHeight:1.45, margin:0, whiteSpace:'pre-line', display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden', ...WRAPPING_TEXT }}>{business.desc}</p>
      </div>

      <div style={{ gridColumn:'1 / -1', display:'flex', flexDirection:'column', gap:8, minWidth:0 }}>
        {services.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:5, minWidth:0, overflow:'hidden' }}>
            {services.slice(0, 4).map(service => <Tag key={service} bg={C.bg} color={C.mid} title={service}>{service}</Tag>)}
            {services.length > 4 && <Tag bg={C.bg} color={C.mid} style={{ flexShrink:0 }}>+{services.length - 4}</Tag>}
          </div>
        )}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, borderTop:`1px solid ${C.borderLight}`, paddingTop:10, marginTop:2 }}>
          <span style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:C.primary, flexShrink:0 }}>Ver perfil</span>
          {hasContact && (
            <button
              onClick={e => { e.stopPropagation(); setShowContacts(v => !v) }}
              style={{ fontFamily:PP, fontWeight:700, fontSize:11, background:showContacts ? C.primaryDark : C.primaryLight, color:showContacts ? '#fff' : C.primary, border:'none', padding:'7px 11px', borderRadius:999, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}
            >
              Contacto
            </button>
          )}
        </div>
        {showContacts && (
          <div onClick={e => e.stopPropagation()}>
            {locationContacts ? (
              <LocationContactsPanel locations={locationContacts} />
            ) : (
              <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:14, padding:8, display:'flex', flexDirection:'column', gap:6 }}>
                {contactMethods.map(method => (
                  <a
                    key={method.id}
                    href={method.href}
                    target={method.external ? '_blank' : undefined}
                    rel={method.external ? 'noreferrer' : undefined}
                    style={{ background:'#fff', border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 12px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, textDecoration:'none' }}
                  >
                    <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
                      <span style={{ fontSize:15, flexShrink:0 }}>{method.icon}</span>
                      <div style={{ minWidth:0 }}>
                        <p style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:C.text, margin:'0 0 1px' }}>{method.label}</p>
                        <p style={{ fontFamily:PP, fontSize:11, color:C.mid, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{method.value}</p>
                      </div>
                    </div>
                    <span style={{ fontFamily:PP, fontSize:11, fontWeight:700, color:C.primary, flexShrink:0 }}>
                      {method.external ? 'Abrir ↗' : 'Abrir →'}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function BusinessDetail({ business, onClose, servicesMap, photosMap, reviewsMap, onReviewsChange, relatedBusinesses=[], onOpenRelatedBusiness, recommendationCount=0, recommended=false, recommendationLoading=false, onToggleRecommend }) {
  const { isLoggedIn, user, displayName, userCanton } = useAuth()
  const { isFavorite, toggleFavorite } = useFavorites()
  const category = getNegocioTypeMeta(business.type)
  const services = servicesMap[business.id] || business.services || []
  const photos = photosMap[business.id] || (business.photo_url ? [business.photo_url] : [])
  const [reviews, setReviews] = useState(reviewsMap[business.id] || [])
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [savingReview, setSavingReview] = useState(false)
  const [showContacts, setShowContacts] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [tab, setTab] = useState('info')
  const rating = averageRating(reviews)
  const ownReview = user?.id ? reviews.find(review => review.user_id === user.id) : null
  const contactMethods = getBusinessContactMethods(business)
  const locationContacts = getLocationContacts(business)
  const hasContact = locationContacts ? locationContacts.length > 0 : contactMethods.length > 0
  const websiteLabel = business.website ? formatUrlLabel(business.website) : ''
  const websiteHref = business.website ? ensureUrl(business.website) : ''

  useEffect(() => {
    setReviews(reviewsMap[business.id] || [])
    setShowContacts(false)
    setShowReviewForm(false)
    setSavingReview(false)
  }, [business.id, reviewsMap])

  const handleAddReview = async review => {
    if (!isLoggedIn || !user?.id) {
      toast.error('Inicia sesión para escribir una reseña')
      return
    }

    const payload = {
      provider_id: business.id,
      user_id: user.id,
      author_name: displayName || review.name?.trim() || 'Usuario',
      canton: userCanton || review.canton?.trim() || '',
      stars: review.stars,
      text: review.text?.trim(),
      active: true,
    }
    const existingReview = reviews.find(item => item.user_id === user.id)

    setSavingReview(true)
    try {
      const query = existingReview?.id && !String(existingReview.id).startsWith('new-')
        ? supabase
          .from('reviews')
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
          .from('reviews')
          .insert(payload)

      const { data, error } = await query
        .select('id, provider_id, user_id, author_name, canton, stars, created_at, text')
        .single()

      if (error) throw error

      const normalized = normalizeProviderReview(data || {
        ...payload,
        id:`new-${Date.now()}`,
        created_at:new Date().toISOString(),
      })
      const mergeReviews = current => [normalized, ...(current || []).filter(item => item.id !== normalized.id && item.user_id !== user.id)]

      setReviews(prev => mergeReviews(prev))
      onReviewsChange?.(business.id, mergeReviews)
      setShowReviewForm(false)
      toast.success(existingReview ? 'Reseña actualizada' : 'Reseña publicada')
    } catch (error) {
      console.error('Could not save provider review:', error)
      toast.error('No se pudo guardar la reseña')
    } finally {
      setSavingReview(false)
    }
  }

  return (
    <FullPageOverlay
      show={!!business}
      onClose={onClose}
      title="Negocio"
      syncHistory={false}
      actions={(
        <>
          <ShareButton
            title={business.name || 'Negocio en Latido'}
            text={getContentShareText('negocio', business.city)}
            url={getBusinessPath(business)}
            ariaLabel="Compartir negocio"
          />
          <FavoriteButton
            isFav={isFavorite('businesses', business.id)}
            onClick={() => toggleFavorite('businesses', business.id)}
            style={{ width:38, height:38, fontSize:18, border:`1px solid ${C.border}`, boxShadow:'0 4px 14px rgba(15,23,42,0.06)' }}
          />
        </>
      )}
    >
      <div style={{ background:'#fff' }}>
        <div style={{ display:'flex', borderBottom:`1px solid ${C.border}`, background:'#fff', position:'sticky', top:59, zIndex:12 }}>
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

        <div style={{ padding:'16px 20px 28px' }}>
          {tab === 'info' && (
            <>
              {photos[0] && (
                <div style={{ position:'relative', overflow:'visible', marginBottom:business.featured ? 26 : 14 }}>
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    className="provider-detail-img"
                    aria-label="Ampliar fotos del negocio"
                    style={{ width:'100%', border:'none', padding:0, background:'transparent', borderRadius:16, overflow:'hidden', marginBottom:0, display:'flex', alignItems:'center', justifyContent:'center', cursor:'zoom-in', position:'relative' }}
                  >
                    <img src={photos[0]} alt={business.name} loading="lazy" decoding="async" style={{ width:'100%', height:'auto', maxHeight:'340px', objectFit:'contain', display:'block' }} />
                  </button>
                  {business.featured && (
                    <span style={{ position:'absolute', left:'50%', bottom:-13, transform:'translateX(-50%)', zIndex:2, display:'inline-flex', alignItems:'center', justifyContent:'center', fontFamily:PP, fontSize:11, fontWeight:800, color:C.primary, background:'#fff', border:`1.5px solid ${C.primaryMid}`, borderRadius:999, padding:'7px 14px', boxShadow:'0 10px 22px rgba(37,99,235,0.16)', whiteSpace:'nowrap' }}>
                      Destacado
                    </span>
                  )}
                </div>
              )}
              {photos[0] && (
                <ImageLightbox
                  open={lightboxOpen}
                  photos={photos}
                  initialIndex={0}
                  onClose={() => setLightboxOpen(false)}
                  title={business.name || 'Foto del negocio'}
                />
              )}
              <div style={{ borderBottom:`1px solid ${C.borderLight}`, paddingBottom:10, marginBottom:9 }}>
                <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:21, color:C.text, lineHeight:1.25, margin:0, ...WRAPPING_TEXT }}>{business.name}</h1>
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', borderBottom:`1px solid ${C.borderLight}`, paddingBottom:10, marginBottom:12 }}>
                {category && <Tag bg="#DBEAFE" color={C.primaryDark}>{category.label}</Tag>}
                <Tag bg={C.bg} color={C.mid}>📍 {business.city}</Tag>
                {business.verified && <Tag bg="#D1FAE5" color="#065F46">✓ Verificada</Tag>}
              </div>
              <RecommendationBox
                count={recommendationCount}
                recommended={recommended}
                loading={recommendationLoading}
                onToggle={onToggleRecommend}
              />
              <p style={{ fontFamily:PP, fontSize:13, color:C.mid, lineHeight:1.75, marginBottom:business.website ? 8 : 14, whiteSpace:'pre-line' }}>{business.desc}</p>
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
              {reviews.length > 0 && (
                <button onClick={() => setTab('resenas')} style={{ width:'100%', background:C.bg, border:`1px solid ${C.border}`, borderRadius:13, padding:'11px 14px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <Stars rating={rating} size={14} />
                    <span style={{ fontFamily:PP, fontSize:12, fontWeight:600, color:C.text }}>{rating} de 5</span>
                  </div>
                  <span style={{ fontFamily:PP, fontSize:11, color:C.primary, fontWeight:600 }}>Ver {reviews.length} reseñas →</span>
                </button>
              )}
              <RelatedRail title="Negocios parecidos" empty={!relatedBusinesses.length}>
                {relatedBusinesses.map(item => (
                  <RelatedBusinessCard
                    key={item.id}
                    business={item}
                    photosMap={photosMap}
                    onClick={() => onOpenRelatedBusiness?.(item)}
                  />
                ))}
              </RelatedRail>
            </>
          )}

          {tab === 'fotos' && (
            <div style={{ minHeight:'calc(100vh - 290px)', display:'flex', flexDirection:'column', justifyContent:'center', padding:'24px 0 48px' }}>
              <PhotoGallery photos={photos.slice(1)} mainPhoto={photos[0]} />
              <p style={{ fontFamily:PP, fontSize:11, color:C.light, textAlign:'center' }}>
                {photos.length} foto{photos.length !== 1 ? 's' : ''} · Desliza para ver más
              </p>
            </div>
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
                <button
                  onClick={() => {
                    if (!isLoggedIn) {
                      toast.error('Inicia sesión para escribir una reseña')
                      return
                    }
                    setShowReviewForm(true)
                  }}
                  style={{ width:'100%', background:C.primaryLight, border:`1.5px dashed ${C.primary}`, borderRadius:14, padding:'12px 0', fontFamily:PP, fontWeight:700, fontSize:13, color:C.primary, cursor:'pointer', marginBottom:14 }}
                >
                  {ownReview ? 'Editar mi reseña' : '✍️ Escribir una reseña'}
                </button>
              ) : (
                <div style={{ opacity:savingReview ? 0.7 : 1, pointerEvents:savingReview ? 'none' : 'auto' }}>
                  <ReviewForm
                    initialReview={ownReview}
                    defaultName={displayName}
                    defaultCanton={userCanton}
                    lockName
                    lockCanton
                    submitLabel={ownReview ? 'Guardar cambios' : 'Publicar reseña'}
                    onSubmit={handleAddReview}
                    onCancel={() => setShowReviewForm(false)}
                  />
                </div>
              )}

              <ReviewList
                reviews={reviews}
                emptyTitle="Sin reseñas todavía"
                emptyText="¡Sé la primera persona en dejar una reseña!"
              />
            </>
          )}
        </div>
      </div>

      {tab === 'info' && hasContact && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:96 }}>
          {showContacts && (
            <div style={{ background:C.bg, borderTop:`1px solid ${C.border}`, padding:'10px 16px', maxHeight:'60vh', overflowY:'auto' }}>
              {locationContacts ? (
                <LocationContactsPanel locations={locationContacts} />
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
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
          <div style={{ background:'#fff', borderTop:`1px solid ${C.border}`, padding:`12px 16px calc(12px + env(safe-area-inset-bottom))` }}>
            <button
              onClick={() => setShowContacts(current => !current)}
              style={{ width:'100%', fontFamily:PP, fontWeight:700, fontSize:13, background:C.primary, color:'#fff', border:'none', padding:'13px 16px', borderRadius:13, display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, cursor:'pointer' }}
            >
              <span>📬 Contacto</span>
              <span style={{ fontSize:12 }}>{showContacts ? 'Ocultar' : locationContacts ? `${locationContacts.length} sedes` : 'Ver opciones'}</span>
            </button>
          </div>
        </div>
      )}
    </FullPageOverlay>
  )
}

function CommunityDetail({ community, onClose, isLoggedIn, relatedCommunities=[], onOpenRelatedCommunity }) {
  const { isFavorite, toggleFavorite } = useFavorites()
  if (!community) return null

  const category = getCommunityMeta(community.cat)

  return (
    <FullPageOverlay
      show={!!community}
      onClose={onClose}
      title="Grupo"
      syncHistory={false}
      actions={(
        <>
          <ShareButton
            title={community.name || 'Grupo en Latido'}
            text={getContentShareText('grupo', community.city)}
            url={buildShareUrl('/comunidades', { openCommunity:community.id })}
            ariaLabel="Compartir grupo"
          />
          <FavoriteButton
            isFav={isFavorite('communities', community.id)}
            onClick={() => toggleFavorite('communities', community.id)}
            style={{ width:38, height:38, fontSize:18, border:`1px solid ${C.border}`, boxShadow:'0 4px 14px rgba(15,23,42,0.06)' }}
          />
        </>
      )}
    >
      <div style={{ background:'#fff', padding:'16px 20px 28px' }}>
      {community.photo_url && (
        <div style={{ width:'calc(100% + 40px)', margin:'-16px -20px 18px', borderBottom:`1px solid ${C.border}`, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
          <img src={community.photo_url} alt={community.name} loading="lazy" decoding="async" style={{ width:'100%', height:'auto', maxHeight:380, objectFit:'contain', display:'block' }} />
        </div>
      )}
      <div style={{ borderBottom:`1px solid ${C.borderLight}`, paddingBottom:10, marginBottom:9 }}>
        <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:21, color:C.text, lineHeight:1.25, margin:0, ...WRAPPING_TEXT }}>{community.name}</h1>
      </div>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', borderBottom:`1px solid ${C.borderLight}`, paddingBottom:10, marginBottom:12 }}>
        {category && <Tag bg="#DBEAFE" color={C.primaryDark}>{category.emoji} {category.label}</Tag>}
        <Tag bg={C.bg} color={C.mid}>📍 {community.city}</Tag>
        {!isWebCommunity(community.contact) && <Tag bg={C.bg} color={C.mid}>👥 {community.members} miembros</Tag>}
        {community.verified && <Tag bg="#D1FAE5" color="#065F46">✓ Verificada</Tag>}
      </div>

      <p style={{ fontFamily:PP, fontSize:13, color:C.mid, lineHeight:1.8, marginBottom:18, whiteSpace:'pre-line' }}>
        {community.desc || 'Grupo hispanohablante en Suiza.'}
      </p>

      <RelatedRail title="Grupos parecidos" empty={!relatedCommunities.length}>
        {relatedCommunities.map(item => (
          <RelatedCommunityCard key={item.id} group={item} onClick={() => onOpenRelatedCommunity?.(item)} />
        ))}
      </RelatedRail>

      </div>

      {community.contact && (() => {
        const url = normalizeCommunityContactUrl(community.contact)
        const urlKey = url.toLowerCase()
        const isWeb = /^https?:\/\//i.test(url) && !CHAT_HOSTS.some(host => urlKey.includes(host))
        let icon = '🔗', label = 'Unirme al grupo', bg = C.primary
        if (isWeb)                                                                    { icon = '🌐'; label = 'Acceder a la web'; bg = C.primary }
        else if (url.includes('chat.whatsapp.com') || url.includes('wa.me'))         { icon = '💬'; label = 'Unirme por WhatsApp'; bg = '#25D366' }
        else if (url.includes('t.me') || url.includes('telegram'))                   { icon = '✈️'; label = 'Unirme por Telegram'; bg = '#229ED9' }
        else if (url.includes('meetup.com'))                                          { icon = '📅'; label = 'Unirme en Meetup'; bg = '#E0393E' }
        else if (url.includes('facebook.com'))                                        { icon = '👥'; label = 'Ver en Facebook'; bg = '#1877F2' }
        else if (url.includes('instagram.com'))                                       { icon = '📸'; label = 'Seguir en Instagram'; bg = '#E1306C' }
        else if (url.includes('discord.gg'))                                          { icon = '🎮'; label = 'Unirme por Discord'; bg = '#5865F2' }
        return (
          <div key="join-bar" style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:96, background:'#fff', borderTop:`1px solid ${C.border}`, padding:`12px 16px calc(12px + env(safe-area-inset-bottom))` }}>
            <a href={url} target="_blank" rel="noreferrer" style={{ fontFamily:PP, fontWeight:700, fontSize:13, background:bg, color:'#fff', textDecoration:'none', padding:'13px 18px', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', gap:8, width:'100%', boxSizing:'border-box' }}>
              <span>{icon}</span>{label}
            </a>
          </div>
        )
      })()}
    </FullPageOverlay>
  )
}


function EventDetail({ event, onClose, relatedEvents=[], onOpenRelatedEvent }) {
  const { isFavorite, toggleFavorite } = useFavorites()
  if (!event) return null

  return (
    <FullPageOverlay
      show={!!event}
      onClose={onClose}
      title="Evento"
      syncHistory={false}
      actions={(
        <>
          <ShareButton
            title={event.title || 'Evento en Latido'}
            text={getContentShareText('evento', [event.day, event.month, event.city].filter(Boolean).join(' - '))}
            url={getEventPath(event)}
            ariaLabel="Compartir evento"
          />
          <FavoriteButton
            isFav={isFavorite('events', event.id)}
            onClick={() => toggleFavorite('events', event.id)}
            style={{ width:38, height:38, fontSize:18, border:`1px solid ${C.border}`, boxShadow:'0 4px 14px rgba(15,23,42,0.06)' }}
          />
        </>
      )}
    >
      <div style={{ background:'#fff', padding:'16px 20px 28px' }}>
      {event.img && (
        <div style={{ width:'calc(100% + 40px)', margin:'-16px -20px 18px', borderBottom:`1px solid ${C.border}`, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
          <img src={event.img} alt={event.title} loading="lazy" decoding="async" style={{ width:'100%', height:'auto', maxHeight:380, objectFit:'contain', display:'block' }} />
        </div>
      )}
      <div style={{ borderBottom:`1px solid ${C.borderLight}`, paddingBottom:10, marginBottom:9 }}>
        <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:21, color:C.text, lineHeight:1.25, margin:0, ...WRAPPING_TEXT }}>{event.title}</h1>
      </div>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', borderBottom:`1px solid ${C.borderLight}`, paddingBottom:10, marginBottom:12 }}>
        <Tag bg="#DBEAFE" color={C.primaryDark}>{EVENTO_TYPES.find(type => type.id === event.type)?.label || 'Evento'}</Tag>
        <Tag bg={C.bg} color={C.mid}>📍 {event.city}</Tag>
        <Tag bg={C.bg} color={C.mid}>🕒 {event.time}</Tag>
        <Tag bg={C.bg} color={C.mid}>🎟 {event.price}</Tag>
      </div>
      <InfoBanner emoji={event.emoji} title={`${event.day} ${event.month} · ${event.venue}`} text={`Organiza ${event.host}`} bg={C.primaryLight} border={C.primaryMid} color={C.primaryDark} />
      <p style={{ fontFamily:PP, fontSize:13, color:C.mid, lineHeight:1.8, marginBottom:18, whiteSpace:'pre-line' }}>{event.desc}</p>
      {event.link && (
        <a href={event.link} target="_blank" rel="noreferrer" style={{ fontFamily:PP, fontWeight:700, fontSize:13, background:C.primary, color:'#fff', textDecoration:'none', padding:'13px 18px', borderRadius:14, display:'inline-flex' }}>
          Ver detalles / reservar
        </a>
      )}
      <RelatedRail title="Eventos parecidos" empty={!relatedEvents.length}>
        {relatedEvents.map(item => (
          <RelatedEventCard key={item.id} event={item} onClick={() => onOpenRelatedEvent?.(item)} />
        ))}
      </RelatedRail>
      </div>
    </FullPageOverlay>
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
  const navigate = useNavigate()
  const { businessSlug, eventSlug } = useParams()
  const { isLoggedIn, user, isAdmin } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [communities, setCommunities] = useState(() => comunidadesCache.data?.communities ?? [])
  const [businesses, setBusinesses] = useState(() => comunidadesCache.data?.businesses ?? MOCK_NEGOCIOS)
  const [businessServices, setBusinessServices] = useState(() => comunidadesCache.data?.businessServices ?? MOCK_NEGOCIO_SERVICES)
  const [businessPhotos, setBusinessPhotos] = useState(() => comunidadesCache.data?.businessPhotos ?? MOCK_NEGOCIO_PHOTOS)
  const [businessReviews, setBusinessReviews] = useState(() => comunidadesCache.data?.businessReviews ?? MOCK_NEGOCIO_REVIEWS)
  const [events, setEvents] = useState(() => comunidadesCache.data?.events ?? MOCK_EVENTOS_LATINOS)
  const [loading, setLoading] = useState(!comunidadesCache.data)
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState(() => searchParams.get('cat') || '')
  const [negType, setNegType] = useState('')
  const [eventType, setEventType] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [selectedCommunity, setSelectedCommunity] = useState(null)
  const [selectedBusiness, setSelectedBusiness] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [eventfrogOpen, setEventfrogOpen] = useState(true)
  const [businessRecommendations, setBusinessRecommendations] = useState({})
  const [recommendedBusinessIds, setRecommendedBusinessIds] = useState(() => new Set())
  const [recommendationLoading, setRecommendationLoading] = useState({})

  const handleBusinessReviewsChange = (businessId, updater) => {
    setBusinessReviews(prev => {
      const current = prev[businessId] || []
      const nextReviews = typeof updater === 'function' ? updater(current) : updater
      const nextMap = { ...prev, [businessId]: nextReviews }
      if (comunidadesCache.data) comunidadesCache.data = { ...comunidadesCache.data, businessReviews: nextMap }
      return nextMap
    })
  }

  const openCommunityId = searchParams.get('openCommunity') || ''
  const openBusinessId = searchParams.get('openBusiness') || ''
  const openEventId = searchParams.get('openEvent') || ''
  const routeBusinessId = businessSlug ? getIdFromSlug(businessSlug) : ''
  const routeEventId = eventSlug ? getIdFromSlug(eventSlug) : ''
  const targetOpenBusinessId = openBusinessId || routeBusinessId
  const targetOpenEventId = openEventId || routeEventId
  const routeView = routeBusinessId ? 'negocios' : routeEventId ? 'eventos' : ''
  const view = searchParams.get('view') || routeView || (openCommunityId || searchParams.get('cat') ? 'comunidades' : 'negocios')
  const tab = MAIN_TABS.some(item => item.id === view) ? view : 'negocios'
  const isCleanBusinessRoute = !!routeBusinessId
  const isCleanEventRoute = !!routeEventId

  useEffect(() => {
    let cancelled = false

    const setters = { setCommunities, setBusinesses, setBusinessServices, setBusinessPhotos, setBusinessReviews, setEvents }

    async function loadData() {
      if (comunidadesCache.data) {
        applyCachedData(comunidadesCache.data, setters)
        setLoading(false)
      }

      try {
        const [communitiesRes, providersRes, photosRes, reviewsRes, eventsRes] = await Promise.all([
          fetchCommunitiesForDirectory(),
          supabase.from('providers').select('id, created_at, category, name, city, canton, description, whatsapp, instagram, email, website, verified, featured, services, photo_url').eq('active', true).order('featured', { ascending:false }).order('created_at', { ascending:false }).limit(100),
          supabase.from('provider_photos').select('provider_id, url, is_main, sort_order').order('is_main', { ascending:false }).order('sort_order', { ascending:true }).limit(300),
          supabase.from('reviews').select('id, provider_id, user_id, author_name, canton, stars, created_at, text').eq('active', true).order('created_at', { ascending:false }).limit(200),
          supabase.from('events').select('id, type, emoji, title, city, canton, venue, day, month, time, price, host, featured, desc, img_url, link, created_at').eq('active', true).order('featured', { ascending:false }).order('created_at', { ascending:false }).limit(60),
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
              normalizeProviderReview(review),
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

  useEffect(() => {
    let cancelled = false

    async function loadBusinessRecommendations() {
      try {
        const countsRes = await supabase.rpc('get_business_recommendation_counts')
        if (!cancelled && !countsRes.error && Array.isArray(countsRes.data)) {
          const nextCounts = {}
          countsRes.data.forEach(row => {
            if (row?.business_id) nextCounts[row.business_id] = Number(row.recommendation_count || 0)
          })
          setBusinessRecommendations(nextCounts)
        }

        if (!user?.id) {
          if (!cancelled) setRecommendedBusinessIds(new Set())
          return
        }

        const mineRes = await supabase.rpc('get_my_business_recommendations')
        if (!cancelled && !mineRes.error && Array.isArray(mineRes.data)) {
          setRecommendedBusinessIds(new Set(mineRes.data.map(row => row.business_id).filter(Boolean)))
        }
      } catch {}
    }

    loadBusinessRecommendations()
    return () => { cancelled = true }
  }, [user?.id])

  const handleToggleBusinessRecommendation = async business => {
    const businessId = business?.id
    if (!businessId) return

    if (!isLoggedIn) {
      toast.error('Inicia sesión para recomendar negocios')
      return
    }

    if (recommendationLoading[businessId]) return

    const wasRecommended = recommendedBusinessIds.has(businessId)
    const previousCount = businessRecommendations[businessId] || 0
    const optimisticRecommended = !wasRecommended
    const optimisticCount = Math.max(0, previousCount + (optimisticRecommended ? 1 : -1))

    setRecommendationLoading(prev => ({ ...prev, [businessId]: true }))
    setRecommendedBusinessIds(prev => {
      const next = new Set(prev)
      optimisticRecommended ? next.add(businessId) : next.delete(businessId)
      return next
    })
    setBusinessRecommendations(prev => ({ ...prev, [businessId]: optimisticCount }))

    try {
      const { data, error } = await supabase.rpc('toggle_business_recommendation', { p_business_id: businessId })
      if (error) throw error

      const result = Array.isArray(data) ? data[0] : data
      const confirmedRecommended = !!result?.recommended
      const confirmedCount = Number(result?.recommendation_count ?? optimisticCount)

      setRecommendedBusinessIds(prev => {
        const next = new Set(prev)
        confirmedRecommended ? next.add(businessId) : next.delete(businessId)
        return next
      })
      setBusinessRecommendations(prev => ({ ...prev, [businessId]: confirmedCount }))
      toast.success(confirmedRecommended ? 'Gracias por recomendar este negocio' : 'Has dejado de recomendar este negocio')
    } catch {
      setRecommendedBusinessIds(prev => {
        const next = new Set(prev)
        wasRecommended ? next.add(businessId) : next.delete(businessId)
        return next
      })
      setBusinessRecommendations(prev => ({ ...prev, [businessId]: previousCount }))
      toast.error('No se pudo actualizar la recomendación')
    } finally {
      setRecommendationLoading(prev => {
        const next = { ...prev }
        delete next[businessId]
        return next
      })
    }
  }

  const handleTabChange = nextTab => {
    const params = new URLSearchParams(searchParams)
    if (nextTab === 'negocios') params.delete('view')
    else params.set('view', nextTab)
    params.delete('openCommunity')
    params.delete('openBusiness')
    params.delete('openEvent')
    params.delete('cat')
    setSearchParams(params, { replace:true })
    setSearch('')
    setCat('')
    setNegType('')
    setEventType('')
    setLocationFilter('')
    scrollPageTop()
  }

  const updateOpenState = (key, value, nextView='comunidades', replace=true) => {
    const params = new URLSearchParams(searchParams)
    params.delete('openCommunity')
    params.delete('openBusiness')
    params.delete('openEvent')

    if (nextView === 'negocios') params.delete('view')
    else params.set('view', nextView)

    if (value) params.set(key, value)
    setSearchParams(params, { replace })
  }

  const openCommunityDetails = (community) => {
    setSelectedCommunity(community)
    updateOpenState('openCommunity', community.id, 'comunidades', false)
  }

  const closeCommunityDetails = () => {
    setSelectedCommunity(null)
    updateOpenState('openCommunity', '', 'comunidades')
  }

  const openBusinessDetails = (business) => {
    setSelectedBusiness(business)
    setSelectedEvent(null)
    if (isCleanBusinessRoute || isCleanEventRoute) {
      navigate(getBusinessPath(business))
      return
    }
    updateOpenState('openBusiness', business.id, 'negocios', false)
  }

  const closeBusinessDetails = () => {
    setSelectedBusiness(null)
    if (isCleanBusinessRoute) {
      navigate('/comunidades?view=negocios', { replace:true })
      return
    }
    updateOpenState('openBusiness', '', 'negocios')
  }

  const openEventDetails = (event) => {
    setSelectedEvent(event)
    setSelectedBusiness(null)
    if (isCleanBusinessRoute || isCleanEventRoute) {
      navigate(getEventPath(event))
      return
    }
    updateOpenState('openEvent', event.id, 'eventos', false)
  }

  const closeEventDetails = () => {
    setSelectedEvent(null)
    if (isCleanEventRoute) {
      navigate('/comunidades?view=eventos', { replace:true })
      return
    }
    updateOpenState('openEvent', '', 'eventos')
  }

  const scrollPageTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }

  const handleCommunityCategoryChange = nextCat => {
    setCat(nextCat)
    scrollPageTop()
  }

  const handleBusinessTypeChange = nextType => {
    setNegType(nextType)
    scrollPageTop()
  }

  const catOptions = useMemo(() => [{ id:'', label:'Todas' }, ...COMMUNITY_OPTIONS.map(item => ({ id:item.id, label:`${item.emoji} ${item.label}` }))], [])
  const cantonOptions = useMemo(() => [
    { id:'', label:'Toda Suiza' },
    ...CANTONS.map(cantonOption => ({ id:cantonOption.code, label:`${cantonOption.code} · ${cantonOption.name}` })),
  ], [])
  const communityCityOptions = useMemo(() => {
    const cities = [...new Set(communities.map(group => group.city).filter(city => city && city !== 'Suiza'))]
      .sort((a, b) => a.localeCompare(b, 'es'))
    return [{ id:'', label:'Todas las ciudades' }, ...cities.map(city => ({ id:city, label:`📍 ${city}` }))]
  }, [communities])
  const eventTypeOptions = useMemo(() => EVENTO_TYPES.map(item => ({ id:item.id, label:item.label })), [])
  const activeDirectoryFilters = tab === 'negocios'
    ? [negType, locationFilter].filter(Boolean).length
    : tab === 'comunidades'
      ? [cat, locationFilter].filter(Boolean).length
      : [eventType, locationFilter].filter(Boolean).length

  const clearDirectoryFilters = () => {
    setCat('')
    setNegType('')
    setEventType('')
    setLocationFilter('')
    scrollPageTop()
  }

  const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const normSearch = norm(search)

  useEffect(() => {
    if (isAdmin) return undefined

    const query = search.trim()
    if (query.length < 2 || tab === 'eventos') return undefined

    const timer = window.setTimeout(() => {
      trackSearchEvent({
        query,
        scope: tab === 'comunidades' ? 'comunidad_grupos' : 'comunidad_negocios',
        user_id: user?.id || null,
        metadata: {
          tab,
          category: cat || null,
          business_type: negType || null,
          location: locationFilter || null,
        },
      })
    }, 900)

    return () => window.clearTimeout(timer)
  }, [cat, isAdmin, locationFilter, negType, search, tab, user?.id])

  const filteredComm = communities.filter(group =>
    (!cat || group.cat === cat) &&
    (!locationFilter || group.city === locationFilter) &&
    (!normSearch || norm(group.name).includes(normSearch) || norm(group.desc).includes(normSearch))
  )

  const filteredNeg = [...businesses]
    .filter(business =>
      business.type !== 'empleo' && business.type !== 'vivienda' &&
      (!negType || normalizeNegocioType(business.type) === negType) &&
      (!locationFilter || business.canton === locationFilter) &&
      (!normSearch ||
        norm(business.name).includes(normSearch) ||
        norm(business.desc).includes(normSearch) ||
        norm(business.city).includes(normSearch) ||
        (businessServices[business.id] || business.services || []).some(service => norm(service).includes(normSearch)))
    )
    .sort((a, b) => {
      if (a.featured !== b.featured) return b.featured ? 1 : -1
      const recommendationDiff = (businessRecommendations[b.id] || 0) - (businessRecommendations[a.id] || 0)
      if (recommendationDiff) return recommendationDiff
      return String(b.created_at || '').localeCompare(String(a.created_at || ''))
    })

  const filteredEvents = events.filter(event =>
    (!eventType || event.type === eventType) &&
    (!locationFilter || event.canton === locationFilter)
  )

  const relatedCommunitiesForSelected = useMemo(() => {
    if (!selectedCommunity) return []
    return communities
      .filter(group => String(group.id) !== String(selectedCommunity.id) && group.cat === selectedCommunity.cat)
      .sort((a, b) => {
        if (a.verified !== b.verified) return b.verified ? 1 : -1
        return String(b.created_at || '').localeCompare(String(a.created_at || ''))
      })
      .slice(0, 12)
  }, [communities, selectedCommunity])

  const relatedBusinessesForSelected = useMemo(() => {
    if (!selectedBusiness) return []
    const selectedServices = new Set((businessServices[selectedBusiness.id] || selectedBusiness.services || []).map(service => service.toLowerCase()))
    const sharedServicesCount = business => (businessServices[business.id] || business.services || [])
      .filter(service => selectedServices.has(service.toLowerCase())).length
    const score = business => {
      const typeScore = normalizeNegocioType(business.type) === normalizeNegocioType(selectedBusiness.type) ? 4 : 0
      const serviceScore = sharedServicesCount(business)
      const featuredScore = business.featured ? 2 : 0
      const recommendationScore = Math.min((businessRecommendations[business.id] || 0) / 4, 4)
      return typeScore + serviceScore + featuredScore + recommendationScore
    }

    return businesses
      .filter(business =>
        String(business.id) !== String(selectedBusiness.id) &&
        business.type !== 'empleo' &&
        business.type !== 'vivienda' &&
        (normalizeNegocioType(business.type) === normalizeNegocioType(selectedBusiness.type) || sharedServicesCount(business) > 0)
      )
      .sort((a, b) => {
        const scoreDiff = score(b) - score(a)
        if (scoreDiff) return scoreDiff
        return String(b.created_at || '').localeCompare(String(a.created_at || ''))
      })
      .slice(0, 12)
  }, [businessRecommendations, businessServices, businesses, selectedBusiness])

  const relatedEventsForSelected = useMemo(() => {
    if (!selectedEvent) return []
    return events
      .filter(event => String(event.id) !== String(selectedEvent.id) && event.type === selectedEvent.type)
      .sort((a, b) => {
        if (a.featured !== b.featured) return b.featured ? 1 : -1
        return String(b.created_at || '').localeCompare(String(a.created_at || ''))
      })
      .slice(0, 12)
  }, [events, selectedEvent])


  useEffect(() => {
    if (loading) return

    if (!openCommunityId) setSelectedCommunity(null)
    else {
      const community = communities.find(entry => String(entry.id) === openCommunityId)
      if (community) setSelectedCommunity(community)
    }

    if (!targetOpenBusinessId) setSelectedBusiness(null)
    else {
      const business = businesses.find(entry => String(entry.id) === targetOpenBusinessId)
      if (business) setSelectedBusiness(business)
    }

    if (!targetOpenEventId) setSelectedEvent(null)
    else {
      const event = events.find(entry => String(entry.id) === targetOpenEventId)
      if (event) setSelectedEvent(event)
    }
  }, [businesses, communities, events, loading, openCommunityId, targetOpenBusinessId, targetOpenEventId])

  const tabCopy = TAB_COPY[tab] || TAB_COPY.negocios

  return (
    <div style={{ maxWidth:1000, margin:'0 auto', padding:'0 24px 100px' }}>
      <div style={{ width:'100vw', marginLeft:'calc(50% - 50vw)', marginRight:'calc(50% - 50vw)', background:C.bg }}>
        <div style={{ width:'100%', maxWidth:1048, margin:'0 auto', padding:'24px 24px 0' }}>
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:26, color:C.text, marginBottom:6, letterSpacing:0 }}>{tabCopy.title}</h1>
      <p style={{ fontFamily:PP, fontSize:13, color:C.light, marginBottom:isLoggedIn ? 14 : 20 }}>{tabCopy.subtitle}</p>


      {/* Search bar — hidden in eventos tab */}
        </div>
      </div>

      <div className="cat-bar sticky-toolbar-shell" style={{ width:'100vw', marginLeft:'calc(50% - 50vw)', marginRight:'calc(50% - 50vw)', marginBottom:16, padding:'10px 0 12px' }}>
        <div style={{ width:'100%', maxWidth:1048, margin:'0 auto', padding:'0 8px' }}>
          <div style={{ background:'#fff', border:`1px solid ${C.border}`, borderRadius:22, padding:12, boxShadow:'0 10px 24px rgba(15,23,42,0.06)' }}>
          <SegmentedTabs tabs={MAIN_TABS} value={tab} onChange={handleTabChange} />
          {tab !== 'eventos' && (
            <div style={{ position:'relative', marginBottom:10 }}>
          <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:C.light }}>🔍</span>
          <input
            style={{ width:'100%', border:`1.5px solid ${C.border}`, borderRadius:13, padding:'11px 13px 11px 36px', fontSize:12, fontFamily:PP, outline:'none', background:'#fff', boxSizing:'border-box' }}
            placeholder={
              tab === 'comunidades'
                ? TAB_COPY.comunidades.search
                : TAB_COPY.negocios.search
            }
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
            </div>
          )}

          {tab !== 'eventos' && (
            <div className="community-filter-row no-scroll">
              {tab === 'negocios' && (
                <CompactFilterSelect
                  className="community-filter-control"
                  label="Categoría"
                  value={negType}
                  options={VISIBLE_NEGOCIO_TYPES}
                  onChange={handleBusinessTypeChange}
                />
              )}
              {tab === 'comunidades' && (
                <CompactFilterSelect
                  className="community-filter-control"
                  label="Categoría"
                  value={cat}
                  options={catOptions}
                  onChange={handleCommunityCategoryChange}
                />
              )}
              <CompactFilterSelect
                className="community-filter-control community-filter-location"
                label={tab === 'comunidades' ? 'Ciudad' : 'Cantón'}
                value={locationFilter}
                options={tab === 'comunidades' ? communityCityOptions : cantonOptions}
                onChange={value => {
                  setLocationFilter(value)
                  scrollPageTop()
                }}
              />
              {activeDirectoryFilters > 0 && (
                <button
                  type="button"
                  className="tablon-clear-filter-button"
                  onClick={clearDirectoryFilters}
                  aria-label="Limpiar filtros"
                >
                  ✕
                </button>
              )}
            </div>
          )}
          </div>
        </div>
      </div>

      {tab === 'comunidades' && (
        <>
          {loading ? (
            <div className="skeleton" style={{ height:200, borderRadius:20 }} />
          ) : filteredComm.length === 0 ? (
            <EmptyState emoji="👥" title={TAB_COPY.comunidades.emptyTitle} sub={TAB_COPY.comunidades.emptyText} action="Ver todos" onAction={() => { clearDirectoryFilters(); setSearch('') }} />
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:CARD_STACK_GAP }}>
              {filteredComm.map(group => (
                <CommunityCard key={group.id} group={group} onClick={() => openCommunityDetails(group)} />
              ))}
            </div>
          )}

          <div style={{ marginTop:28, border:`2px dashed ${C.border}`, borderRadius:20, padding:24, textAlign:'center', background:C.primaryLight }}>
            <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:17, color:C.text, marginBottom:8 }}>➕ ¿Tienes un grupo hispanohablante?</h3>
            <p style={{ fontFamily:PP, fontSize:12, color:C.mid, marginBottom:14 }}>Regístralo aquí y llega a más personas en Suiza. Gratis.</p>
            <Link to="/registrar-comunidad" style={{ fontFamily:PP, fontWeight:700, fontSize:13, background:C.primary, color:'#fff', textDecoration:'none', padding:'12px 24px', borderRadius:14, display:'inline-flex' }}>Registrar grupo</Link>
          </div>
        </>
      )}

      {tab === 'negocios' && (
        <>
          {loading ? (
            <div className="skeleton" style={{ height:260, borderRadius:20 }} />
          ) : filteredNeg.length === 0 ? (
            <EmptyState emoji="🏪" title={TAB_COPY.negocios.emptyTitle} sub={TAB_COPY.negocios.emptyText} action="Ver todos" onAction={() => { clearDirectoryFilters(); setSearch('') }} />
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:CARD_STACK_GAP }}>
              {filteredNeg.map(business => (
                <BusinessCard
                  key={business.id}
                  business={business}
                  onClick={() => openBusinessDetails(business)}
                  servicesMap={businessServices}
                  photosMap={businessPhotos}
                  reviewsMap={businessReviews}
                  recommendationCount={businessRecommendations[business.id] || 0}
                />
              ))}
            </div>
          )}

          <div style={{ marginTop:28, border:`2px dashed ${C.border}`, borderRadius:20, padding:24, textAlign:'center', background:C.primaryLight }}>
            <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:17, color:C.text, marginBottom:8 }}>🏪 ¿Tienes un negocio?</h3>
            <p style={{ fontFamily:PP, fontSize:12, color:C.mid, marginBottom:14 }}>Regístralo gratis, sube fotos y recibe reseñas de la comunidad.</p>
            <Link to="/registrar-negocio" style={{ fontFamily:PP, fontWeight:700, fontSize:13, background:C.primary, color:'#fff', textDecoration:'none', padding:'12px 24px', borderRadius:14, display:'inline-flex' }}>Registrar negocio</Link>
          </div>
        </>
      )}

      {tab === 'eventos' && (
        <>
          {/* Eventos en Suiza — collapsible eventfrog */}
          <div style={{ marginBottom:24 }}>
            <button
              onClick={() => setEventfrogOpen(o => !o)}
              style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, background:'none', border:'none', cursor:'pointer', padding:'0 0 10px', width:'100%', textAlign:'left' }}
            >
              <p style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:C.light, letterSpacing:1, margin:0 }}>EVENTOS EN SUIZA</p>
              <span style={{ fontFamily:PP, fontSize:10, fontWeight:800, color:C.primary, letterSpacing:0, textTransform:'none' }}>{eventfrogOpen ? 'Ocultar' : 'Mostrar'}</span>
            </button>
            {eventfrogOpen && <EventfrogCalendar />}
          </div>

          {/* Eventos de la comunidad */}
          <div style={{ marginBottom:24 }}>
            <p style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:C.light, letterSpacing:1, marginBottom:12 }}>EVENTOS DE LA COMUNIDAD</p>
            <div className="community-filter-row community-event-filter-row no-scroll">
              <CompactFilterSelect
                className="community-filter-control"
                label="Tipo de evento"
                value={eventType}
                options={eventTypeOptions}
                onChange={value => setEventType(value)}
              />
              <CompactFilterSelect
                className="community-filter-control community-filter-location"
                label="Cantón"
                value={locationFilter}
                options={cantonOptions}
                onChange={value => setLocationFilter(value)}
              />
              {activeDirectoryFilters > 0 && (
                <button
                  type="button"
                  className="tablon-clear-filter-button"
                  onClick={clearDirectoryFilters}
                  aria-label="Limpiar filtros de eventos"
                >
                  ✕
                </button>
              )}
            </div>
            {loading ? (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[1,2].map(i => <div key={i} className="skeleton" style={{ height:120, borderRadius:16 }} />)}
              </div>
            ) : filteredEvents.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 20px', background:C.bg, borderRadius:20 }}>
                <div style={{ fontSize:48, marginBottom:12 }}>🎉</div>
                <p style={{ fontFamily:PP, fontWeight:700, fontSize:15, color:C.text, marginBottom:6 }}>{TAB_COPY.eventos.emptyTitle}</p>
                <p style={{ fontFamily:PP, fontSize:12, color:C.light }}>{TAB_COPY.eventos.emptyText}</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:CARD_STACK_GAP }}>
                {filteredEvents.map(event => (
                  <div
                    key={event.id}
                    onClick={() => openEventDetails(event)}
                    style={{ ...LIST_CARD_STYLE, minHeight:118 }}
                  >
                    {event.img ? (
                      <div style={LIST_THUMB_STYLE}>
                        <img src={event.img} alt={event.title} loading="lazy" decoding="async" style={LIST_MEDIA_STYLE} />
                      </div>
                    ) : (
                      <div style={{ ...LIST_THUMB_STYLE, background:C.primaryLight, fontSize:32 }}>
                        {event.emoji}
                      </div>
                    )}
                    <div style={{ flex:1, minWidth:0, padding:'1px 0', display:'flex', flexDirection:'column' }}>
                      <div style={{ display:'flex', gap:6, marginBottom:5, flexWrap:'wrap' }}>
                        <Tag bg={C.primaryLight} color={C.primary}>{EVENTO_TYPES.find(item => item.id === event.type)?.label || `${event.emoji} Evento`}</Tag>
                        <Tag bg={C.bg} color={C.mid}>{event.city}</Tag>
                      </div>
                      <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:14, color:C.text, margin:'0 0 5px', lineHeight:1.32, ...CLAMP_2 }}>{event.title}</h3>
                      <p style={{ fontFamily:PP, fontSize:11, color:C.light, lineHeight:1.35, margin:'auto 0 0', ...CLAMP_1 }}>{event.day} {event.month} - {event.time} - {event.price}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ border:`2px dashed ${C.border}`, borderRadius:20, padding:24, textAlign:'center', background:C.primaryLight }}>
            <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:17, color:C.text, marginBottom:8 }}>🎉 ¿Organizas un evento?</h3>
            <p style={{ fontFamily:PP, fontSize:12, color:C.mid, marginBottom:14 }}>Conciertos, fiestas, networking, festivales o quedadas: publícalo aquí para la comunidad.</p>
            <Link to="/publicar-evento" style={{ fontFamily:PP, fontWeight:700, fontSize:13, background:C.primary, color:'#fff', textDecoration:'none', padding:'12px 24px', borderRadius:14, display:'inline-flex' }}>Publicar evento</Link>
          </div>
        </>
      )}

      <CommunityDetail
        community={selectedCommunity}
        onClose={closeCommunityDetails}
        isLoggedIn={isLoggedIn}
        relatedCommunities={relatedCommunitiesForSelected}
        onOpenRelatedCommunity={openCommunityDetails}
      />

      {selectedBusiness && (
        <BusinessDetail
          key={selectedBusiness.id}
          business={selectedBusiness}
          onClose={closeBusinessDetails}
          servicesMap={businessServices}
          photosMap={businessPhotos}
          reviewsMap={businessReviews}
          onReviewsChange={handleBusinessReviewsChange}
          relatedBusinesses={relatedBusinessesForSelected}
          onOpenRelatedBusiness={openBusinessDetails}
          recommendationCount={businessRecommendations[selectedBusiness.id] || 0}
          recommended={recommendedBusinessIds.has(selectedBusiness.id)}
          recommendationLoading={!!recommendationLoading[selectedBusiness.id]}
          onToggleRecommend={() => handleToggleBusinessRecommendation(selectedBusiness)}
        />
      )}
      <EventDetail
        event={selectedEvent}
        onClose={closeEventDetails}
        relatedEvents={relatedEventsForSelected}
        onOpenRelatedEvent={openEventDetails}
      />
    </div>
  )
}
