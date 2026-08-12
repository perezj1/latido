import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useFavorites } from '../hooks/useFavorites'
import {
  MOCK_COMMUNITIES,
  MOCK_NEGOCIOS,
  MOCK_NEGOCIO_PHOTOS,
  MOCK_NEGOCIO_REVIEWS,
  MOCK_NEGOCIO_SERVICES,
  MOCK_EVENTOS_LATINOS,
  CANTONS,
  CITIES_BY_CANTON,
  COMMUNITY_CATS,
  VISIBLE_NEGOCIO_TYPES,
  getNegocioTypeMeta,
  normalizeNegocioType,
  EVENTO_TYPES,
} from '../lib/constants'
import { C, PP } from '../lib/theme'
import { Tag, EmptyState, Sheet, FullPageOverlay, InfoBanner, Stars, ReviewForm, ReviewList, PhotoGallery, ImageLightbox, Modal, ChevronLeftIcon } from '../components/UI'
import EventfrogCalendar from '../components/EventfrogCalendar'
import CreatorCommunityView, { CreatorCommunityToolbar } from '../components/CreatorCommunityView'
import SectionTabs from '../components/SectionTabs'
import GlobalSearch from '../components/GlobalSearch'
import SavedSearchButton from '../components/SavedSearchButton'
import { FilterButton, FilterChips, FilterResultSummary, FILTER_PANEL_TITLE_STYLE } from '../components/FilterWorkspace'
import { buildShareUrl } from '../components/ShareButton'
import DetailActionBar from '../components/DetailActionBar'
import { getBusinessVerificationStatus } from '../lib/businessVerification'
import { getBusinessPath, getEventPath, getIdFromSlug } from '../lib/seo'
import { getMissingColumnName } from '../lib/supabaseCompat'
import { normalizeExternalUrl } from '../lib/links'
import { readOfflineSnapshot, writeOfflineSnapshot } from '../lib/offlineCache'
import { BUSINESS_ROTATION_INTERVAL_MS, getBusinessPromotionDisplayLabel, getEffectiveBusinessPromotionPlan } from '../lib/businessPromotion'
import { getThumbnailImageUrl, handleThumbnailImageError, resolveImageUrl } from '../lib/imageVariants'
import { isNationwideLocation, matchesCantonOrNationwide } from '../lib/locationScope'
import { buildSearchProfile, scoreSearchFields } from '../lib/naturalSearch'
import { rotateItems } from '../lib/rotation'
import { useTimedRotationBucket } from '../hooks/useTimedRotationBucket'
import {
  getBusinessAddress,
  getBusinessPhone,
  getBusinessWhatsapp,
  getNavigationUrl,
  getPhoneHref,
  getWhatsappHref,
  isLikelySwissMobilePhone,
} from '../lib/businessContact'
import toast from 'react-hot-toast'
import { markSavedSearchDigestOpened, markSavedSearchMatchOpened } from '../lib/savedSearches'

const MAIN_TABS = [
  { id:'negocios', label:'🏪 Negocios' },
  { id:'creadores', label:'🎙️ Creadores' },
  { id:'eventos', label:'🎉 Eventos' },
  { id:'comunidades', label:'👥 Grupos' },
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
  creadores:{
    title:'🎙️ Creadores',
    subtitle:'Personas, profesionales y negocios que comparten sobre Suiza en sus redes.',
    search:'Buscar perfil, tema o ciudad...',
    emptyTitle:'Todavía no hay creadores',
    emptyText:'Crea el primer perfil y conecta tus redes con la comunidad.',
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
  withPhoto:'id, user_id, cat, name, city, members, emoji, verified, desc, contact, photo_url, created_at',
  safe:'id, user_id, cat, name, city, members, emoji, verified, desc, contact, created_at',
}

const PROVIDER_DIRECTORY_SELECT = {
  withContactDetails:'id, user_id, created_at, category, name, city, canton, address, description, phone, whatsapp, instagram, email, website, verified, featured, services, photo_url, promotion_plan, promotion_starts_at, promotion_ends_at',
  safe:'id, user_id, created_at, category, name, city, canton, description, whatsapp, instagram, email, website, verified, featured, services, photo_url, promotion_plan, promotion_starts_at, promotion_ends_at',
}

const PROVIDER_DIRECTORY_PAGE_SIZE = 500
const BUSINESS_CLAIM_EMAIL = 'latidoch@gmail.com'
const BUSINESS_CLAIM_SUBJECT = 'Encontre mi negocio en latido'

async function fetchAllProviderDirectoryRows(columns) {
  const rows = []

  for (let from = 0; ; from += PROVIDER_DIRECTORY_PAGE_SIZE) {
    const response = await supabase
      .from('providers')
      .select(columns)
      .eq('active', true)
      .order('featured', { ascending:false })
      .order('created_at', { ascending:false })
      .order('id', { ascending:false })
      .range(from, from + PROVIDER_DIRECTORY_PAGE_SIZE - 1)

    if (response.error) return response

    const page = response.data || []
    rows.push(...page)
    if (page.length < PROVIDER_DIRECTORY_PAGE_SIZE) return { data:rows, error:null }
  }
}

async function fetchProvidersForDirectory() {
  const response = await fetchAllProviderDirectoryRows(PROVIDER_DIRECTORY_SELECT.withContactDetails)
  if (['address', 'phone'].includes(getMissingColumnName(response.error, 'providers'))) {
    return fetchAllProviderDirectoryRows(PROVIDER_DIRECTORY_SELECT.safe)
  }
  return response
}

async function fetchCommunitiesForDirectory() {
  const fetchAllRows = async columns => {
    const rows = []
    for (let from = 0; ; from += PROVIDER_DIRECTORY_PAGE_SIZE) {
      const response = await supabase
        .from('communities')
        .select(columns)
        .eq('active', true)
        .order('created_at', { ascending:false })
        .order('id', { ascending:false })
        .range(from, from + PROVIDER_DIRECTORY_PAGE_SIZE - 1)

      if (response.error) return response
      const page = response.data || []
      rows.push(...page)
      if (page.length < PROVIDER_DIRECTORY_PAGE_SIZE) return { data:rows, error:null }
    }
  }

  const response = await fetchAllRows(COMMUNITY_SELECT.withPhoto)
  if (getMissingColumnName(response.error, 'communities') === 'photo_url') {
    return fetchAllRows(COMMUNITY_SELECT.safe)
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
const BUSINESS_DIRECTORY_PRIORITY = {
  premium:0,
  basic:1,
  featured:2,
  free:3,
}
const BUSINESS_DIRECTORY_PLAN_ORDER = ['premium', 'basic', 'featured', 'free']

const DIRECTORY_SEARCH_RESULT_TYPES = {
  negocios:['business'],
  comunidades:['community'],
}

const BUSINESS_SORT_OPTIONS = [
  { id:'recommended', label:'Recomendados' },
  { id:'newest', label:'Más recientes' },
  { id:'oldest', label:'Más antiguos' },
  { id:'rating', label:'Mejor valorados' },
]

const COMMUNITY_SORT_OPTIONS = [
  { id:'newest', label:'Más recientes' },
  { id:'oldest', label:'Más antiguos' },
  { id:'members', label:'Más miembros' },
]

const DIRECTORY_FILTER_CONTROL_STYLE = {
  width:'100%',
  boxSizing:'border-box',
  border:`1.5px solid ${C.border}`,
  borderRadius:13,
  padding:'12px 14px',
  fontFamily:PP,
  fontSize:12,
  fontWeight:600,
  background:'#fff',
  outline:'none',
}

function getDirectoryFilterControlStyle(value, defaultValue='') {
  return {
    ...DIRECTORY_FILTER_CONTROL_STYLE,
    color:String(value ?? '') === String(defaultValue ?? '') ? C.light : C.text,
  }
}

const COMMUNITY_OPTIONS = []
for (const item of COMMUNITY_CATS) {
  if (item.id === 'fe') continue
  COMMUNITY_OPTIONS.push(item.id === 'mamas'
    ? { ...item, id:'familia', emoji:'\u{1F468}\u200D\u{1F469}\u200D\u{1F467}', label:'Familia' }
    : item)
}


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
    user_id: group.user_id || '',
    cat: normalizedCat || '',
    name: (group.name || 'Grupo').replace(/Mam[aá]s Latinas/gi, 'Familias Latinas'),
    city: group.city || 'Suiza',
    members: group.members || 0,
    emoji: group.emoji || category?.emoji || '👥',
    verified: !!group.verified,
    desc: group.desc || group.description || '',
    contact: group.contact || '',
    photo_url: group.photo_url || '',
    created_at: group.created_at || '',
  }
}

function normalizeDirectoryPlace(value='') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function communityMatchesLocation(group={}, location='') {
  if (!location) return true
  if (isNationwideLocation(group)) return true

  const canton = CANTONS.find(item => item.code === location)
  if (!canton) return normalizeDirectoryPlace(group.city) === normalizeDirectoryPlace(location)

  const groupCity = normalizeDirectoryPlace(group.city)
  if (!groupCity) return false
  if (groupCity === normalizeDirectoryPlace(canton.name)) return true

  return (CITIES_BY_CANTON[canton.code] || [])
    .some(city => normalizeDirectoryPlace(city) === groupCity)
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

function formatInstagramHandle(value='') {
  if (!value) return ''
  return value.startsWith('@') ? value : `@${value}`
}

function normalizeProvider(provider) {
  const verificationStatus = getBusinessVerificationStatus(provider)
  const promotionPlan = getEffectiveBusinessPromotionPlan(provider)
  const supportsSeparatePhone = Object.prototype.hasOwnProperty.call(provider, 'phone')
  const legacyWhatsapp = getBusinessWhatsapp(provider)

  return {
    id: provider.id,
    user_id: provider.user_id || '',
    created_at: provider.created_at || '',
    emoji: BUSINESS_EMOJI[provider.category] || '🏪',
    name: provider.name,
    type: provider.category,
    city: provider.city || provider.canton || 'Suiza',
    canton: provider.canton || '',
    desc: provider.description || 'Negocio latino en Suiza.',
    address: getBusinessAddress(provider),
    phone: getBusinessPhone(provider),
    whatsapp: supportsSeparatePhone
      ? legacyWhatsapp
      : isLikelySwissMobilePhone(legacyWhatsapp) ? legacyWhatsapp : '',
    instagram: provider.instagram || '',
    email: provider.email || '',
    website: provider.website || '',
    verified: verificationStatus === 'verified',
    verification_status: verificationStatus,
    featured: !!provider.featured,
    promotion_plan: provider.promotion_plan || 'free',
    promotion_starts_at: provider.promotion_starts_at || null,
    promotion_ends_at: provider.promotion_ends_at || null,
    promotionPlan,
    services: Array.isArray(provider.services) ? provider.services : [],
    photo_url: resolveImageUrl(provider.photo_url),
    contacts: Array.isArray(provider.contacts) ? provider.contacts : null,
  }
}

function getDirectoryBusinessPlan(business) {
  if (business.promotionPlan && business.promotionPlan !== 'free') return business.promotionPlan
  return business.featured ? 'featured' : 'free'
}

function getDirectoryBusinessPriority(business) {
  return BUSINESS_DIRECTORY_PRIORITY[getDirectoryBusinessPlan(business)] ?? BUSINESS_DIRECTORY_PRIORITY.free
}

function getDirectoryBusinessPlanLabel(business) {
  const plan = getDirectoryBusinessPlan(business)
  return getBusinessPromotionDisplayLabel(business, plan)
}

function normalizeEvent(event) {
  const link = normalizeExternalUrl(event.link)

  return {
    id: event.id,
    user_id: event.user_id || '',
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

function getContentShareText(kind, location) {
  const base = `Mira este ${kind} en Latido.`
  return location ? `${base}\n${location}` : base
}

function getBusinessContactMethods(business) {
  const phone = (business.phone || business.whatsapp || '').trim()
  const whatsapp = (business.whatsapp || '').trim()
  const address = (business.address || '').trim()
  const email = (business.email || '').trim()
  const instagram = formatInstagramHandle((business.instagram || '').trim())

  const methods = []

  if (address) {
    methods.push({
      id:'address',
      icon:'🧭',
      label:'Dirección',
      value:address,
      href:getNavigationUrl(address, business.city, business.canton),
      external:true,
    })
  }

  if (phone) {
    methods.push({
      id:'phone',
      icon:'📞',
      label:'Teléfono',
      value:phone,
      href:getPhoneHref(phone),
      external:false,
    })
  }

  if (whatsapp) {
    methods.push({
      id:'whatsapp',
      icon:'💬',
      label:'WhatsApp',
      value:whatsapp,
      href:getWhatsappHref(whatsapp),
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
  const contacts = []
  for (const loc of business.contacts) {
    const contact = { city: loc.city || '', address: loc.address || '', phone: loc.phone || '', email: loc.email || '' }
    if (contact.address || contact.phone || contact.email) contacts.push(contact)
  }
  return contacts
}


function LocationContactsPanel({ locations }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {locations.map((loc, i) => (
        <div key={i} style={{ background:'#fff', border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden' }}>
          <div style={{ background:C.primaryLight, padding:'7px 12px', display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:12 }}>📍</span>
            <span style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:C.primaryDark }}>{loc.city}</span>
            {loc.address && (
              <a
                href={getNavigationUrl(loc.address, loc.city)}
                target="_blank"
                rel="noreferrer"
                onClick={event => event.stopPropagation()}
                style={{ fontFamily:PP, fontSize:10, color:C.primary, textDecoration:'none' }}
              >
                — {loc.address} ↗
              </a>
            )}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
            {loc.phone && (
              <a
                href={getPhoneHref(loc.phone)}
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

function BusinessDescription({ business }) {
  const description = String(business.desc || '')
    .replace(/\s*(?:\.\s*)?Web profesional verificada(?:\s+el\s+\d{4}-\d{2}-\d{2})?\s*:\s*https?:\/\/\S+\s*$/i, '')
    .trim()
  const address = String(business.address || '').trim()
  const addressIndex = address
    ? description.toLocaleLowerCase('es').indexOf(address.toLocaleLowerCase('es'))
    : -1
  let visibleDescription = description

  if (addressIndex >= 0) {
    const beforeAddress = description.slice(0, addressIndex)
    const labelMatch = beforeAddress.match(/Direcci[oó]n(?:\s+profesional)?\s*:\s*$/i)
    const removeStart = labelMatch?.index ?? addressIndex
    let removeEnd = addressIndex + address.length
    if (description[removeEnd] === '.') removeEnd += 1
    while (/\s/.test(description[removeEnd] || '')) removeEnd += 1
    visibleDescription = `${description.slice(0, removeStart)}${description.slice(removeEnd)}`.trim()
  }

  const paragraphStyle = {
    fontFamily:PP,
    fontSize:13,
    color:C.mid,
    lineHeight:1.75,
    margin:'0 0 10px',
    whiteSpace:'pre-line',
  }
  return <p style={paragraphStyle}>{visibleDescription}</p>
}

function RelatedCommunityCard({ group, onClick }) {
  const category = getCommunityMeta(group.cat)
  return (
    <button type="button" onClick={onClick} style={{ width:156, flex:'0 0 156px', background:'#fff', border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden', padding:0, textAlign:'left', cursor:'pointer' }}>
      <div style={{ height:112, background:C.primaryLight, display:'flex', alignItems:'center', justifyContent:'center', fontSize:34 }}>
        {group.photo_url ? <img src={getThumbnailImageUrl(group.photo_url)} alt={group.name} loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:'contain', display:'block' }} /> : group.emoji}
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
        {photos[0] ? <img src={getThumbnailImageUrl(photos[0])} onError={event => handleThumbnailImageError(event, photos[0])} alt={business.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" style={{ width:'100%', height:'100%', objectFit:'contain', display:'block' }} /> : business.emoji}
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
        {event.img ? <img src={getThumbnailImageUrl(event.img)} alt={event.title} loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:'contain', display:'block' }} /> : event.emoji}
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
          <img src={getThumbnailImageUrl(group.photo_url)} alt={group.name} loading="lazy" decoding="async" style={LIST_MEDIA_STYLE} />
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

function BusinessCard({ business, onClick, photosMap, reviewsMap, recommendationCount=0 }) {
  const category = getNegocioTypeMeta(business.type)
  const photos = photosMap[business.id] || (business.photo_url ? [business.photo_url] : [])
  const reviews = reviewsMap[business.id] || []
  const planLabel = getDirectoryBusinessPlanLabel(business)
  const rating = averageRating(reviews)
  const cover = photos[0] || business.photo_url
  const [lightboxOpen, setLightboxOpen] = useState(false)

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
            <img src={getThumbnailImageUrl(cover)} onError={event => handleThumbnailImageError(event, cover)} alt={business.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" style={LIST_MEDIA_STYLE} />
          </button>
        ) : (
          <div style={LIST_FALLBACK_STYLE}>{business.emoji}</div>
        )}
        {photos.length > 1 && (
          <span style={{ position:'absolute', bottom:8, left:8, fontFamily:PP, fontSize:9, fontWeight:700, background:'rgba(15,23,42,0.72)', color:'#fff', padding:'3px 7px', borderRadius:999 }}>
            Fotos {photos.length}
          </span>
        )}
        {planLabel && (
          <span style={{ position:'absolute', left:'50%', bottom:-10, transform:'translateX(-50%)', zIndex:2, display:'inline-flex', alignItems:'center', justifyContent:'center', fontFamily:PP, fontSize:9, fontWeight:800, color:C.primary, background:'#fff', border:`1.5px solid ${C.primaryMid}`, borderRadius:999, padding:'5px 10px', boxShadow:'0 8px 18px rgba(37,99,235,0.14)', whiteSpace:'nowrap' }}>
            {planLabel}
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

    </div>
  )
}

function BusinessDetail({ business, onClose, servicesMap, photosMap, reviewsMap, onReviewsChange, relatedBusinesses=[], onOpenRelatedBusiness, recommendationCount=0, recommended=false, recommendationLoading=false, onToggleRecommend }) {
  const { isLoggedIn, user, displayName, userCanton } = useAuth()
  const { isFavorite, toggleFavorite } = useFavorites()
  const category = getNegocioTypeMeta(business.type)
  const planLabel = getDirectoryBusinessPlanLabel(business)
  const services = servicesMap[business.id] || business.services || []
  const photos = photosMap[business.id] || (business.photo_url ? [business.photo_url] : [])
  const [reviews, setReviews] = useState(reviewsMap[business.id] || [])
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [savingReview, setSavingReview] = useState(false)
  const [showContacts, setShowContacts] = useState(false)
  const [claimModalOpen, setClaimModalOpen] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [tab, setTab] = useState('info')
  const rating = averageRating(reviews)
  const ownReview = user?.id ? reviews.find(review => review.user_id === user.id) : null
  const contactMethods = getBusinessContactMethods(business)
  const locationContacts = getLocationContacts(business)
  const hasContact = locationContacts ? locationContacts.length > 0 : contactMethods.length > 0
  const websiteLabel = business.website ? formatUrlLabel(business.website) : ''
  const websiteHref = business.website ? ensureUrl(business.website) : ''
  const addressHref = business.address ? getNavigationUrl(business.address, business.city, business.canton) : ''
  const claimEmailBody = [
    'Hola Latido,',
    '',
    `He encontrado mi negocio "${business.name}" en Latido y quiero solicitar que se asigne a mi cuenta.`,
    `Negocio: ${business.name}`,
    `Ubicación: ${business.city}`,
    `Enlace: ${buildShareUrl(getBusinessPath(business))}`,
  ].join('\n')
  const claimEmailHref = `mailto:${BUSINESS_CLAIM_EMAIL}?subject=${encodeURIComponent(BUSINESS_CLAIM_SUBJECT)}&body=${encodeURIComponent(claimEmailBody)}`
  const googleReviewsUrl = getNavigationUrl(
    [business.name, business.address].filter(Boolean).join(', '),
    business.city,
    business.canton,
  )
  const mainPhoto = photos[0] || ''
  const tabItems = [
    { id:'info', label:'Info' },
    { id:'servicios', label:'Servicios' },
    { id:'fotos', label:'Galería' },
    { id:'resenas', label:'Reseñas' },
  ]
  const floatingButtonStyle = {
    width:38,
    height:38,
    borderRadius:'50%',
    border:`1px solid ${C.border}`,
    background:'#fff',
    color:C.text,
    boxShadow:'0 8px 22px rgba(15,23,42,0.16)',
  }

  useEffect(() => {
    setReviews(reviewsMap[business.id] || [])
    setShowContacts(false)
    setClaimModalOpen(false)
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
      showHeader={false}
      contentStyle={{
        maxWidth:560,
        minHeight:'100vh',
        background:'#fff',
        padding:'0 0 calc(118px + env(safe-area-inset-bottom))',
        boxShadow:'0 24px 70px rgba(15,23,42,0.12)',
      }}
    >
      <div style={{ background:'#fff' }}>
        <div style={{ position:'relative', height:'clamp(270px, 44vh, 430px)', minHeight:270, background:'linear-gradient(135deg,#F8FAFC 0%,#EEF4FF 100%)', overflow:'hidden' }}>
          {mainPhoto ? (
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="provider-detail-img"
              aria-label="Ampliar fotos del negocio"
              style={{ width:'100%', height:'100%', border:'none', padding:0, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'zoom-in', position:'relative', boxSizing:'border-box' }}
            >
              <img src={mainPhoto} onError={event => handleThumbnailImageError(event, mainPhoto)} alt={business.name} loading="eager" fetchpriority="high" decoding="async" referrerPolicy="no-referrer" style={{ width:'100%', height:'100%', objectFit:'contain', display:'block' }} />
            </button>
          ) : (
            <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:56 }}>
              {business.emoji}
            </div>
          )}
          <div style={{ position:'absolute', inset:0, pointerEvents:'none', background:'linear-gradient(180deg,rgba(15,23,42,0.08) 0%,rgba(15,23,42,0) 42%,rgba(15,23,42,0.06) 100%)' }} />
          <button
            onClick={onClose}
            aria-label="Volver"
            style={{ ...floatingButtonStyle, position:'absolute', top:'calc(16px + env(safe-area-inset-top))', left:16, cursor:'pointer', fontSize:20, lineHeight:1, display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}
          >
            <ChevronLeftIcon size={22} />
          </button>
          {planLabel && (
            <span style={{ position:'absolute', left:'50%', bottom:14, transform:'translateX(-50%)', zIndex:2, display:'inline-flex', alignItems:'center', justifyContent:'center', fontFamily:PP, fontSize:11, fontWeight:800, color:C.primary, background:'#fff', border:`1.5px solid ${C.primaryMid}`, borderRadius:999, padding:'7px 14px', boxShadow:'0 10px 22px rgba(37,99,235,0.16)', whiteSpace:'nowrap' }}>
              {planLabel}
            </span>
          )}
        </div>

        {mainPhoto && (
          <ImageLightbox
            open={lightboxOpen}
            photos={photos}
            initialIndex={0}
            onClose={() => setLightboxOpen(false)}
            title={business.name || 'Foto del negocio'}
          />
        )}

        <div style={{ padding:'18px 20px 14px' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:14 }}>
            <div style={{ minWidth:0, flex:1 }}>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
                {category && <Tag bg="#DBEAFE" color={C.primaryDark}>{category.label}</Tag>}
                {business.verified && <Tag bg="#D1FAE5" color="#065F46">✓ Verificada</Tag>}
              </div>
              <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:C.text, lineHeight:1.18, margin:'0 0 8px', ...WRAPPING_TEXT }}>{business.name}</h1>
              <Tag bg={C.bg} color={C.mid}>📍 {business.city}</Tag>
            </div>
            {rating !== null && (
              <button
                type="button"
                onClick={() => setTab('resenas')}
                style={{ flexShrink:0, background:'transparent', border:'none', padding:'3px 0 0', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'flex-end' }}
              >
                <Stars rating={rating} size={13} showNumber count={reviews.length} />
              </button>
            )}
          </div>
        </div>

        <div className="no-scroll" style={{ display:'flex', gap:28, overflowX:'auto', borderBottom:`1px solid ${C.border}`, background:'#fff', position:'sticky', top:0, zIndex:12, padding:'0 20px' }}>
          {tabItems.map(item => (
            <button key={item.id} onClick={() => setTab(item.id)} style={{ flex:'0 0 auto', fontFamily:PP, fontWeight:700, fontSize:13, padding:'13px 0 12px', background:'none', border:'none', borderBottom:`2px solid ${tab === item.id ? C.primary : 'transparent'}`, cursor:'pointer', color:tab === item.id ? C.primary : C.light, transition:'all .15s', minWidth:0, whiteSpace:'nowrap' }}>
              {item.label}
            </button>
          ))}
        </div>

        <div style={{ padding:'18px 20px 28px' }}>
          {tab === 'info' && (
            <>
              <BusinessDescription business={business} />
              {business.website && (
                <a
                  href={websiteHref}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontFamily:PP, fontWeight:600, fontSize:12, color:C.primary, textDecoration:'none', display:'flex', alignItems:'center', gap:6, width:'fit-content', marginBottom:business.address ? 8 : 16 }}
                >
                  🌐 {websiteLabel}
                </a>
              )}
              {business.address && (
                <a
                  href={addressHref}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontFamily:PP, fontWeight:600, fontSize:12, color:C.primary, textDecoration:'none', display:'flex', alignItems:'flex-start', gap:6, width:'fit-content', lineHeight:1.55, marginBottom:16 }}
                >
                  <span aria-hidden="true">🧭</span>
                  <span>{business.address}</span>
                </a>
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

          {tab === 'servicios' && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {services.map(service => <span key={service} style={{ fontFamily:PP, fontSize:12, fontWeight:600, background:C.primaryLight, color:C.primary, padding:'7px 14px', borderRadius:10 }}>{service}</span>)}
            </div>
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
                googleReviewsUrl={googleReviewsUrl}
              />
            </>
          )}
        </div>
      </div>

      <DetailActionBar
        maxWidth={560}
        primaryLabel={hasContact ? 'Contactar' : ''}
        onPrimaryClick={hasContact ? () => setShowContacts(current => !current) : undefined}
        onMenuOpen={() => setShowContacts(false)}
        onExpandedClose={() => setShowContacts(false)}
        expandedContent={showContacts ? (locationContacts ? (
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
        )) : null}
        share={{
          title:business.name || 'Negocio en Latido',
          text:getContentShareText('negocio', business.city),
          url:getBusinessPath(business),
          ariaLabel:'Enviar negocio',
        }}
        favorite={{
          isFav:isFavorite('businesses', business.id),
          onClick:() => toggleFavorite('businesses', business.id),
        }}
        like={{
          active:recommended,
          loading:recommendationLoading,
          onClick:onToggleRecommend,
          label:'Me gusta',
          hint:recommendationCount === 1 ? '1 persona lo recomienda' : `${recommendationCount} personas lo recomiendan`,
        }}
        ownershipClaim={!business.user_id ? {
          label:'Este negocio es mío',
          icon:'🏪',
          onClick:() => setClaimModalOpen(true),
        } : null}
        report={{
          contentType:'business',
          contentId:business.id,
          ownerId:business.user_id,
          title:'Reportar negocio',
          metadata:{ title:business.name, category:business.type, city:business.city },
        }}
      />

      <Modal
        show={claimModalOpen}
        onClose={() => setClaimModalOpen(false)}
        title="¡Enhorabuena!"
        syncHistory={false}
        zIndex={120}
      >
        <div style={{ textAlign:'center' }}>
          <div aria-hidden="true" style={{ width:64, height:64, borderRadius:'50%', margin:'0 auto 16px', display:'grid', placeItems:'center', background:C.primaryLight, color:C.primary, fontSize:30 }}>
            🏪
          </div>
          <p style={{ fontFamily:PP, fontSize:14, color:C.mid, lineHeight:1.7, margin:'0 0 20px' }}>
            Tu negocio está llegando a cientos de posibles clientes. Si este es tu negocio, contáctanos para asignarlo a tu cuenta y que puedas administrarlo.
          </p>
          <button
            type="button"
            onClick={() => window.location.assign(claimEmailHref)}
            style={{ width:'100%', minHeight:50, display:'flex', alignItems:'center', justifyContent:'center', boxSizing:'border-box', border:'none', borderRadius:15, background:C.primary, color:'#fff', padding:'13px 18px', fontFamily:PP, fontWeight:800, fontSize:13, cursor:'pointer', boxShadow:'0 12px 26px rgba(37,99,235,0.22)' }}
          >
            Enviar email a Latido
          </button>
        </div>
      </Modal>
    </FullPageOverlay>
  )
}

function CommunityDetail({ community, onClose, relatedCommunities=[], onOpenRelatedCommunity }) {
  const { isFavorite, toggleFavorite } = useFavorites()
  if (!community) return null

  const category = getCommunityMeta(community.cat)
  const contactUrl = normalizeCommunityContactUrl(community.contact)
  const contactUrlKey = contactUrl.toLowerCase()
  const isWeb = /^https?:\/\//i.test(contactUrl) && !CHAT_HOSTS.some(host => contactUrlKey.includes(host))
  let primaryLabel = contactUrl ? 'Unirme al grupo' : ''
  let primaryColor = C.primary
  if (isWeb)                                                                  primaryLabel = 'Acceder a la web'
  else if (contactUrl.includes('chat.whatsapp.com') || contactUrl.includes('wa.me')) { primaryLabel = 'Unirme por WhatsApp'; primaryColor = '#25D366' }
  else if (contactUrl.includes('t.me') || contactUrl.includes('telegram'))           { primaryLabel = 'Unirme por Telegram'; primaryColor = '#229ED9' }
  else if (contactUrl.includes('meetup.com'))                                        { primaryLabel = 'Unirme en Meetup'; primaryColor = '#E0393E' }
  else if (contactUrl.includes('facebook.com'))                                      { primaryLabel = 'Ver en Facebook'; primaryColor = '#1877F2' }
  else if (contactUrl.includes('instagram.com'))                                     { primaryLabel = 'Seguir en Instagram'; primaryColor = '#E1306C' }
  else if (contactUrl.includes('discord.gg'))                                        { primaryLabel = 'Unirme por Discord'; primaryColor = '#5865F2' }

  return (
    <FullPageOverlay
      show={!!community}
      onClose={onClose}
      title="Grupo"
      syncHistory={false}
      headerVariant="floating"
    >
      <div style={{ background:'#fff', padding:'16px 20px 28px' }}>
      {community.photo_url && (
        <div style={{ width:'calc(100% + 40px)', height:'min(58vh, 460px)', minHeight:260, margin:'-16px -20px 18px', borderBottom:`1px solid ${C.border}`, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', padding:0, boxSizing:'border-box' }}>
          <img src={community.photo_url} alt={community.name} loading="eager" fetchpriority="high" decoding="async" style={{ width:'100%', height:'100%', objectFit:'contain', display:'block' }} />
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

      <DetailActionBar
        primaryLabel={primaryLabel}
        primaryHref={contactUrl}
        primaryExternal
        primaryColor={primaryColor}
        share={{
          title:community.name || 'Grupo en Latido',
          text:getContentShareText('grupo', community.city),
          url:buildShareUrl('/comunidades', { openCommunity:community.id }),
          ariaLabel:'Enviar grupo',
        }}
        favorite={{
          isFav:isFavorite('communities', community.id),
          onClick:() => toggleFavorite('communities', community.id),
        }}
        report={{
          contentType:'community',
          contentId:community.id,
          ownerId:community.user_id,
          title:'Reportar grupo',
          metadata:{ title:community.name, category:community.cat, city:community.city },
        }}
      />
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
      headerVariant="floating"
    >
      <div style={{ background:'#fff', padding:'16px 20px 28px' }}>
      {event.img && (
        <div style={{ width:'calc(100% + 40px)', height:'min(58vh, 460px)', minHeight:260, margin:'-16px -20px 18px', borderBottom:`1px solid ${C.border}`, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', padding:0, boxSizing:'border-box' }}>
          <img src={event.img} alt={event.title} loading="eager" fetchpriority="high" decoding="async" style={{ width:'100%', height:'100%', objectFit:'contain', display:'block' }} />
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
      <RelatedRail title="Eventos parecidos" empty={!relatedEvents.length}>
        {relatedEvents.map(item => (
          <RelatedEventCard key={item.id} event={item} onClick={() => onOpenRelatedEvent?.(item)} />
        ))}
      </RelatedRail>
      </div>
      <DetailActionBar
        primaryLabel={event.link ? 'Ver detalles / reservar' : ''}
        primaryHref={event.link}
        primaryExternal
        share={{
          title:event.title || 'Evento en Latido',
          text:getContentShareText('evento', [event.day, event.month, event.city].filter(Boolean).join(' - ')),
          url:getEventPath(event),
          ariaLabel:'Enviar evento',
        }}
        favorite={{
          isFav:isFavorite('events', event.id),
          onClick:() => toggleFavorite('events', event.id),
        }}
        report={{
          contentType:'event',
          contentId:event.id,
          ownerId:event.user_id,
          title:'Reportar evento',
          metadata:{ title:event.title, type:event.type, city:event.city },
        }}
      />
    </FullPageOverlay>
  )
}

const COMUNIDADES_CACHE_TTL = 5 * 60 * 1000
const REVIEWS_QUERY_PAGE_SIZE = 500

async function fetchAllActiveBusinessReviews() {
  const rows = []

  for (let from = 0; ; from += REVIEWS_QUERY_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('reviews')
      .select('id, provider_id, user_id, author_name, canton, stars, created_at, text')
      .eq('active', true)
      .order('created_at', { ascending:false })
      .order('id', { ascending:false })
      .range(from, from + REVIEWS_QUERY_PAGE_SIZE - 1)

    if (error) return { data:null, error }

    const page = data || []
    rows.push(...page)
    if (page.length < REVIEWS_QUERY_PAGE_SIZE) return { data:rows, error:null }
  }
}

const persistedComunidadesSnapshot = readOfflineSnapshot('comunidades-public')
const sanitizeCachedBusinesses = businesses => (businesses || []).map(business => {
  const phone = getBusinessPhone(business)
  const whatsapp = getBusinessWhatsapp(business)
  const isLegacySharedNumber = Boolean(phone && whatsapp && phone === whatsapp)

  return {
    ...business,
    address:getBusinessAddress({ address:business.address, description:business.desc }),
    phone,
    whatsapp:isLegacySharedNumber && !isLikelySwissMobilePhone(whatsapp) ? '' : whatsapp,
    photo_url:resolveImageUrl(business.photo_url),
  }
})
const sanitizeCachedBusinessPhotos = photosByBusiness => Object.fromEntries(
  Object.entries(photosByBusiness || {}).map(([providerId, photos]) => [
    providerId,
    [...new Set((photos || []).map(resolveImageUrl).filter(Boolean))],
  ]),
)
const comunidadesCache = {
  data:persistedComunidadesSnapshot?.data
    ? {
        ...persistedComunidadesSnapshot.data,
        businesses:sanitizeCachedBusinesses(persistedComunidadesSnapshot.data.businesses),
        businessPhotos:sanitizeCachedBusinessPhotos(persistedComunidadesSnapshot.data.businessPhotos),
      }
    : null,
  ts:persistedComunidadesSnapshot?.savedAt || 0,
}

function applyCachedData(snapshot, setters) {
  setters.setCommunities(snapshot.communities)
  setters.setBusinesses(sanitizeCachedBusinesses(snapshot.businesses))
  setters.setBusinessServices(snapshot.businessServices)
  setters.setBusinessPhotos(sanitizeCachedBusinessPhotos(snapshot.businessPhotos))
  setters.setBusinessReviews(snapshot.businessReviews)
  setters.setEvents(snapshot.events)
}

export default function Comunidades() {
  const navigate = useNavigate()
  const { businessSlug, eventSlug } = useParams()
  const { isLoggedIn, user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedCanton = CANTONS.some(item => item.code === searchParams.get('canton'))
    ? searchParams.get('canton')
    : ''
  const requestedLocation = searchParams.get('location') || requestedCanton
  const requestedSearch = searchParams.get('q') || ''
  const requestedCreatorView = ['contenidos', 'creadores'].includes(searchParams.get('creatorView'))
    ? searchParams.get('creatorView')
    : 'contenidos'
  const requestedCreatorTopic = searchParams.get('creatorTopic') || ''
  const requestedCreatorPlatform = searchParams.get('creatorPlatform') || ''
  const [communities, setCommunities] = useState(() => comunidadesCache.data?.communities ?? [])
  const [businesses, setBusinesses] = useState(() => comunidadesCache.data?.businesses ?? MOCK_NEGOCIOS)
  const [businessServices, setBusinessServices] = useState(() => comunidadesCache.data?.businessServices ?? MOCK_NEGOCIO_SERVICES)
  const [businessPhotos, setBusinessPhotos] = useState(() => comunidadesCache.data?.businessPhotos ?? MOCK_NEGOCIO_PHOTOS)
  const [businessReviews, setBusinessReviews] = useState(() => comunidadesCache.data?.businessReviews ?? MOCK_NEGOCIO_REVIEWS)
  const [events, setEvents] = useState(() => comunidadesCache.data?.events ?? MOCK_EVENTOS_LATINOS)
  const [loading, setLoading] = useState(!comunidadesCache.data)
  const [search, setSearch] = useState(requestedSearch)
  const [resolvedSearch, setResolvedSearch] = useState({
    active:false,
    ready:false,
    query:'',
    results:[],
  })
  const [cat, setCat] = useState(() => searchParams.get('cat') || '')
  const [negType, setNegType] = useState(() => searchParams.get('businessType') || '')
  const [eventType, setEventType] = useState(() => searchParams.get('eventType') || '')
  const [locationFilter, setLocationFilter] = useState(() => requestedLocation)
  const [businessSort, setBusinessSort] = useState('recommended')
  const [communitySort, setCommunitySort] = useState('newest')
  const [creatorSearch, setCreatorSearch] = useState(requestedSearch)
  const [creatorTopic, setCreatorTopic] = useState(requestedCreatorTopic)
  const [creatorPlatform, setCreatorPlatform] = useState(requestedCreatorPlatform)
  const [creatorLocation, setCreatorLocation] = useState(requestedCanton)
  const [creatorSort, setCreatorSort] = useState('newest')
  const [creatorView, setCreatorView] = useState(requestedCreatorView)
  const [creatorResultCount, setCreatorResultCount] = useState(0)
  const [showDirectoryFilters, setShowDirectoryFilters] = useState(false)
  const [directoryFilterDraft, setDirectoryFilterDraft] = useState({
    category:'',
    location:requestedCanton,
    sort:'recommended',
  })
  const [selectedCommunity, setSelectedCommunity] = useState(null)
  const [selectedBusiness, setSelectedBusiness] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [eventfrogOpen, setEventfrogOpen] = useState(true)
  const [businessRecommendations, setBusinessRecommendations] = useState({})
  const [recommendedBusinessIds, setRecommendedBusinessIds] = useState(() => new Set())
  const [recommendationLoading, setRecommendationLoading] = useState({})
  const businessDirectoryRotationBucket = useTimedRotationBucket(BUSINESS_ROTATION_INTERVAL_MS)

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
  const savedMatchId = searchParams.get('savedMatch') || ''
  const savedSearchId = searchParams.get('savedSearch') || ''
  const routeView = routeBusinessId ? 'negocios' : routeEventId ? 'eventos' : ''
  const view = searchParams.get('view') || routeView || (openCommunityId || searchParams.get('cat') ? 'comunidades' : 'negocios')
  const tab = MAIN_TABS.some(item => item.id === view) ? view : 'negocios'
  const previousTabRef = useRef(tab)
  const isCleanBusinessRoute = !!routeBusinessId
  const isCleanEventRoute = !!routeEventId

  useEffect(() => {
    if (requestedSearch) setSearch(requestedSearch)
  }, [requestedSearch])

  useEffect(() => {
    setCreatorView(requestedCreatorView)
  }, [requestedCreatorView])

  useEffect(() => {
    if (tab !== 'creadores') return
    setCreatorSearch(requestedSearch)
    setCreatorTopic(requestedCreatorTopic)
    setCreatorPlatform(requestedCreatorPlatform)
    setCreatorLocation(requestedCanton)
  }, [requestedCanton, requestedCreatorPlatform, requestedCreatorTopic, requestedSearch, tab])

  useEffect(() => {
    if (!user?.id) return
    if (savedMatchId) void markSavedSearchMatchOpened(savedMatchId, user.id)
    else if (savedSearchId) void markSavedSearchDigestOpened(savedSearchId, user.id)
  }, [savedMatchId, savedSearchId, user?.id])

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
          fetchProvidersForDirectory(),
          supabase.from('provider_photos').select('provider_id, url, is_main, sort_order').order('is_main', { ascending:false }).order('sort_order', { ascending:true }).limit(300),
          fetchAllActiveBusinessReviews(),
          supabase.from('events').select('id, user_id, type, emoji, title, city, canton, venue, day, month, time, price, host, featured, desc, img_url, link, created_at').eq('active', true).order('featured', { ascending:false }).order('created_at', { ascending:false }).limit(60),
        ])

        if (cancelled) return
        if (comunidadesCache.data && [communitiesRes, providersRes, photosRes, reviewsRes, eventsRes].every(result => result.error)) {
          return
        }

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
            nextPhotos[photo.provider_id] = [...(nextPhotos[photo.provider_id] || []), resolveImageUrl(photo.url)]
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
          writeOfflineSnapshot('comunidades-public', comunidadesCache.data)
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

  const handleCreatorViewChange = nextCreatorView => {
    setCreatorView(nextCreatorView)
    const params = new URLSearchParams(searchParams)
    params.set('view', 'creadores')
    params.set('creatorView', nextCreatorView)
    setSearchParams(params, { replace:true })
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

  // SectionTabs navega con enlaces, asi que la pagina no se desmonta al cambiar
  // de seccion. Limpiamos aqui los filtros de la anterior para que no se peguen,
  // igual que hacia handleTabChange. Se ignora el primer render para respetar
  // los enlaces profundos (?cat, ?businessType, ?canton...).
  useEffect(() => {
    if (previousTabRef.current === tab) return
    previousTabRef.current = tab

    setSearch('')
    setCat('')
    setNegType('')
    setEventType('')
    setLocationFilter('')
    setBusinessSort('recommended')
    setCommunitySort('newest')
    setCreatorSearch('')
    setCreatorTopic('')
    setCreatorPlatform('')
    setCreatorLocation('')
    setCreatorSort('newest')
    setShowDirectoryFilters(false)
    scrollPageTop()
  }, [tab])

  const openDirectoryFilters = () => {
    setDirectoryFilterDraft({
      category:tab === 'negocios' ? negType : tab === 'eventos' ? eventType : cat,
      location:locationFilter,
      sort:tab === 'negocios' ? businessSort : communitySort,
    })
    setShowDirectoryFilters(true)
  }

  const toggleDirectoryFilters = () => {
    if (showDirectoryFilters) {
      setShowDirectoryFilters(false)
      return
    }
    openDirectoryFilters()
  }

  const handleDirectorySortChange = value => {
    if (tab === 'negocios') setBusinessSort(value || 'recommended')
    else setCommunitySort(value || 'newest')
    scrollPageTop()
  }

  const applyDirectoryFilters = () => {
    if (tab === 'negocios') setNegType(directoryFilterDraft.category)
    if (tab === 'comunidades') setCat(directoryFilterDraft.category)
    if (tab === 'eventos') setEventType(directoryFilterDraft.category)
    setLocationFilter(directoryFilterDraft.location)
    if (tab === 'negocios') setBusinessSort(directoryFilterDraft.sort || 'recommended')
    if (tab === 'comunidades') setCommunitySort(directoryFilterDraft.sort || 'newest')
    setShowDirectoryFilters(false)
    scrollPageTop()
  }

  const clearDirectoryFilterDraft = () => {
    setDirectoryFilterDraft({
      category:'',
      location:'',
      sort:tab === 'negocios' ? 'recommended' : 'newest',
    })
  }

  const catOptions = useMemo(() => [{ id:'', label:'Todos' }, ...COMMUNITY_OPTIONS.map(item => ({ id:item.id, label:`${item.emoji} ${item.label}` }))], [])
  const cantonOptions = useMemo(() => [
    { id:'', label:'Toda Suiza' },
    ...CANTONS.map(cantonOption => ({ id:cantonOption.code, label:`${cantonOption.code} · ${cantonOption.name}` })),
  ], [])
  const communityCityOptions = useMemo(() => {
    const citySet = new Set()
    for (const group of communities) {
      if (group.city && group.city !== 'Suiza') citySet.add(group.city)
    }
    const cities = [...citySet].sort((a, b) => a.localeCompare(b, 'es'))
    const requestedCantonMeta = CANTONS.find(item => item.code === requestedCanton)
    return [
      { id:'', label:'Todas las ciudades' },
      ...(requestedCantonMeta
        ? [{ id:requestedCantonMeta.code, label:`📍 Cerca de ti · ${requestedCantonMeta.name}` }]
        : []),
      ...cities.map(city => ({ id:city, label:`\u{1F4CD} ${city}` })),
    ]
  }, [communities, requestedCanton])
  const eventTypeOptions = useMemo(() => EVENTO_TYPES.map(item => ({ id:item.id, label:item.label })), [])

  const buildDirectoryFilterChips = values => {
    const chips = []

    if (values.location) {
      const canton = CANTONS.find(item => item.code === values.location)
      chips.push({ key:'location', label:canton?.name || values.location })
    }
    return chips
  }

  const appliedDirectoryFilterChips = tab === 'eventos'
    ? []
    : buildDirectoryFilterChips({
        location:locationFilter,
        sort:tab === 'negocios' ? businessSort : communitySort,
      })
  const visibleDirectoryFilterChips = appliedDirectoryFilterChips
  const activeDirectoryFilters = tab === 'eventos'
    ? [eventType, locationFilter].filter(Boolean).length
    : appliedDirectoryFilterChips.length + Number(Boolean(tab === 'negocios' ? negType : cat))

  const clearDirectoryFilters = () => {
    setLocationFilter('')
    if (tab === 'eventos') setEventType('')
    if (tab === 'negocios') {
      setNegType('')
      setBusinessSort('recommended')
    }
    if (tab === 'comunidades') {
      setCat('')
      setCommunitySort('newest')
    }
    scrollPageTop()
  }

  const removeVisibleDirectoryFilter = key => {
    const defaultSort = tab === 'negocios' ? 'recommended' : 'newest'
    if (showDirectoryFilters) {
      setDirectoryFilterDraft(current => ({
        ...current,
        [key]:key === 'sort' ? defaultSort : '',
      }))
      return
    }

    if (key === 'location') setLocationFilter('')
    if (key === 'sort') {
      if (tab === 'negocios') setBusinessSort('recommended')
      if (tab === 'comunidades') setCommunitySort('newest')
    }
    scrollPageTop()
  }

  const clearVisibleDirectoryFilters = () => {
    if (showDirectoryFilters) {
      clearDirectoryFilterDraft()
      return
    }
    clearDirectoryFilters()
  }

  const clearAllDirectoryFilters = () => {
    clearDirectoryFilters()
  }

  const searchProfile = useMemo(() => buildSearchProfile(search), [search])
  const hasSearch = searchProfile.normalized.length >= 2
  const hasResolvedSearch = Boolean(
    hasSearch
    && resolvedSearch.active
    && resolvedSearch.ready
    && resolvedSearch.query === search.trim()
  )
  const resolvedSearchRank = useMemo(() => {
    const ranks = new Map()
    ;(resolvedSearch.results || []).forEach((result, index) => {
      ranks.set(`${result.type}:${result.id}`, index)
    })
    return ranks
  }, [resolvedSearch.results])

  const filteredComm = communities
    .filter(group =>
      (!cat || group.cat === cat) &&
      communityMatchesLocation(group, locationFilter) &&
      (!hasSearch || (
        hasResolvedSearch
          ? resolvedSearchRank.has(`community:${group.id}`)
          : scoreSearchFields(searchProfile, [
            { value:group.name, weight:6 },
            { value:group.desc, weight:4 },
            { value:getCommunityMeta(group.cat)?.label, weight:3 },
            { value:group.city, weight:2 },
            { value:'grupo comunidad', weight:1 },
          ])
      ))
    )
    .sort((a, b) => {
      if (communitySort === 'relevance' && hasSearch) {
        if (hasResolvedSearch) {
          return (
            (resolvedSearchRank.get(`community:${a.id}`) ?? Number.MAX_SAFE_INTEGER)
            - (resolvedSearchRank.get(`community:${b.id}`) ?? Number.MAX_SAFE_INTEGER)
          )
        }
        const getScore = group => scoreSearchFields(searchProfile, [
          { value:group.name, weight:6 },
          { value:group.desc, weight:4 },
          { value:getCommunityMeta(group.cat)?.label, weight:3 },
          { value:group.city, weight:2 },
          { value:'grupo comunidad', weight:1 },
        ])
        const relevanceDifference = getScore(b) - getScore(a)
        if (relevanceDifference) return relevanceDifference
      }
      if (communitySort === 'members') {
        const memberDiff = Number(b.members || 0) - Number(a.members || 0)
        if (memberDiff) return memberDiff
      }

      const dateDiff = String(b.created_at || '').localeCompare(String(a.created_at || ''))
      if (dateDiff) return communitySort === 'oldest' ? -dateDiff : dateDiff

      if (hasResolvedSearch) {
        return (
          (resolvedSearchRank.get(`community:${a.id}`) ?? Number.MAX_SAFE_INTEGER)
          - (resolvedSearchRank.get(`community:${b.id}`) ?? Number.MAX_SAFE_INTEGER)
        )
      }
      return String(a.name || '').localeCompare(String(b.name || ''), 'es')
    })

  const eligibleBusinesses = businesses.filter(business =>
    business.type !== 'empleo' && business.type !== 'vivienda' &&
    (!negType || normalizeNegocioType(business.type) === negType) &&
    matchesCantonOrNationwide(business, locationFilter)
  )
  const getBusinessSearchFields = business => [
    { value:business.name, weight:6 },
    { value:(businessServices[business.id] || business.services || []).join(' '), weight:5 },
    { value:business.desc, weight:4 },
    { value:getNegocioTypeMeta(business.type)?.label, weight:3 },
    { value:business.type, weight:2 },
    { value:business.city, weight:2 },
  ]
  const exactBusinessMatches = hasSearch
    ? hasResolvedSearch
      ? eligibleBusinesses
        .filter(business => resolvedSearchRank.has(`business:${business.id}`))
        .map(business => ({
          business,
          searchScore:(resolvedSearch.results.length + 1)
            - resolvedSearchRank.get(`business:${business.id}`),
        }))
      : eligibleBusinesses
        .map(business => ({ business, searchScore:scoreSearchFields(searchProfile, getBusinessSearchFields(business)) }))
        .filter(item => item.searchScore > 0)
    : eligibleBusinesses.map(business => ({ business, searchScore:0 }))
  const businessMatches = hasSearch && !hasResolvedSearch && exactBusinessMatches.length === 0
    ? eligibleBusinesses
      .map(business => ({
        business,
        searchScore:scoreSearchFields(searchProfile, getBusinessSearchFields(business), { allowIntentFallback:true }),
      }))
      .filter(item => item.searchScore > 0)
    : exactBusinessMatches

  const baseOrderedBusinesses = businessMatches
    .sort((a, b) => {
      const planDiff = getDirectoryBusinessPriority(a.business) - getDirectoryBusinessPriority(b.business)
      if (planDiff) return planDiff
      const searchDiff = b.searchScore - a.searchScore
      if (searchDiff) return searchDiff
      if (a.business.featured !== b.business.featured) return b.business.featured ? 1 : -1
      const recommendationDiff = (businessRecommendations[b.business.id] || 0) - (businessRecommendations[a.business.id] || 0)
      if (recommendationDiff) return recommendationDiff
      return String(b.business.created_at || '').localeCompare(String(a.business.created_at || ''))
    })
    .map(item => item.business)
  const filteredNeg = businessSort === 'recommended'
    ? hasSearch
      ? baseOrderedBusinesses
      : BUSINESS_DIRECTORY_PLAN_ORDER.flatMap(plan =>
        rotateItems(
          baseOrderedBusinesses.filter(business => getDirectoryBusinessPlan(business) === plan),
          businessDirectoryRotationBucket,
        )
      )
    : [...baseOrderedBusinesses].sort((a, b) => {
      if (businessSort === 'rating') {
        const ratingDiff = (averageRating(businessReviews[b.id] || []) ?? -1) - (averageRating(businessReviews[a.id] || []) ?? -1)
        if (ratingDiff) return ratingDiff
        const recommendationDiff = (businessRecommendations[b.id] || 0) - (businessRecommendations[a.id] || 0)
        if (recommendationDiff) return recommendationDiff
      }

      const dateDiff = String(b.created_at || '').localeCompare(String(a.created_at || ''))
      if (dateDiff) return businessSort === 'oldest' ? -dateDiff : dateDiff
      return String(a.name || '').localeCompare(String(b.name || ''), 'es')
    })

  const draftDirectoryResultCount = useMemo(() => {
    if (tab === 'eventos') {
      return events.filter(event =>
        (!directoryFilterDraft.category || event.type === directoryFilterDraft.category) &&
        matchesCantonOrNationwide(event, directoryFilterDraft.location)
      ).length
    }

    if (tab === 'comunidades') {
      return communities.filter(group =>
        (!directoryFilterDraft.category || group.cat === directoryFilterDraft.category) &&
        communityMatchesLocation(group, directoryFilterDraft.location) &&
        (!hasSearch || (
          hasResolvedSearch
            ? resolvedSearchRank.has(`community:${group.id}`)
            : scoreSearchFields(searchProfile, [
              { value:group.name, weight:6 },
              { value:group.desc, weight:4 },
              { value:getCommunityMeta(group.cat)?.label, weight:3 },
              { value:group.city, weight:2 },
              { value:'grupo comunidad', weight:1 },
            ])
        ))
      ).length
    }

    const eligible = businesses.filter(business =>
      business.type !== 'empleo' &&
      business.type !== 'vivienda' &&
      (!directoryFilterDraft.category || normalizeNegocioType(business.type) === directoryFilterDraft.category) &&
      matchesCantonOrNationwide(business, directoryFilterDraft.location)
    )
    if (!hasSearch) return eligible.length
    if (hasResolvedSearch) {
      return eligible.filter(business => resolvedSearchRank.has(`business:${business.id}`)).length
    }

    const exact = eligible.filter(business => scoreSearchFields(searchProfile, [
      { value:business.name, weight:6 },
      { value:(businessServices[business.id] || business.services || []).join(' '), weight:5 },
      { value:business.desc, weight:4 },
      { value:getNegocioTypeMeta(business.type)?.label, weight:3 },
      { value:business.type, weight:2 },
      { value:business.city, weight:2 },
    ]) > 0)
    if (exact.length) return exact.length

    return eligible.filter(business => scoreSearchFields(searchProfile, [
      { value:business.name, weight:6 },
      { value:(businessServices[business.id] || business.services || []).join(' '), weight:5 },
      { value:business.desc, weight:4 },
      { value:getNegocioTypeMeta(business.type)?.label, weight:3 },
      { value:business.type, weight:2 },
      { value:business.city, weight:2 },
    ], { allowIntentFallback:true }) > 0).length
  }, [
    businessServices,
    businesses,
    communities,
    directoryFilterDraft.category,
    directoryFilterDraft.location,
    events,
    hasResolvedSearch,
    hasSearch,
    resolvedSearchRank,
    searchProfile,
    tab,
  ])

  const visibleDirectoryResultCount = tab === 'negocios' ? filteredNeg.length : filteredComm.length
  const activeDirectorySort = tab === 'negocios' ? businessSort : communitySort
  const currentDirectorySortLabel = (tab === 'negocios' ? BUSINESS_SORT_OPTIONS : COMMUNITY_SORT_OPTIONS)
    .find(option => option.id === activeDirectorySort)?.label || 'Más recientes'

  const filteredEvents = events.filter(event =>
    (!eventType || event.type === eventType) &&
    matchesCantonOrNationwide(event, locationFilter)
  )
  const savedSearchDraft = useMemo(() => {
    const cleanQuery = search.trim()
    const hasUsefulContext = Boolean(
      cleanQuery.length >= 2
      || locationFilter
      || (tab === 'negocios' && negType)
      || (tab === 'comunidades' && cat)
      || (tab === 'eventos' && eventType)
    )
    if (!hasUsefulContext) return null

    const params = new URLSearchParams({ view:tab })
    if (cleanQuery.length >= 2 && tab !== 'eventos') params.set('q', cleanQuery)
    if (tab === 'negocios' && negType) params.set('businessType', negType)
    if (tab === 'comunidades' && cat) params.set('cat', cat)
    if (tab === 'eventos' && eventType) params.set('eventType', eventType)
    if (locationFilter) {
      if (CANTONS.some(item => item.code === locationFilter)) params.set('canton', locationFilter)
      else params.set('location', locationFilter)
    }

    const section = tab === 'negocios'
      ? 'Negocios'
      : tab === 'comunidades'
        ? 'Grupos'
        : 'Eventos'
    const subject = cleanQuery.length >= 2 ? `“${cleanQuery}”` : section
    return {
      name:`${section}: ${subject}${locationFilter ? ` · ${locationFilter}` : ''}`.slice(0, 100),
      query:tab !== 'eventos' && cleanQuery.length >= 2 ? cleanQuery : '',
      entityKinds:[tab === 'negocios' ? 'provider' : tab === 'comunidades' ? 'community' : 'event'],
      category:tab === 'negocios' ? 'servicios' : tab === 'comunidades' ? 'comunidad' : 'eventos',
      canton:tab === 'comunidades' ? '' : locationFilter,
      city:tab === 'comunidades' ? locationFilter : '',
      filters:{
        businessType:tab === 'negocios' ? negType : '',
        communityCategory:tab === 'comunidades' ? cat : '',
        eventType:tab === 'eventos' ? eventType : '',
      },
      resultPath:`/comunidades?${params.toString()}`,
    }
  }, [cat, eventType, locationFilter, negType, search, tab])
  const filterSavedSearchDraft = useMemo(() => {
    const cleanQuery = search.trim()
    const category = directoryFilterDraft.category
    const location = directoryFilterDraft.location

    const params = new URLSearchParams({ view:tab })
    if (cleanQuery.length >= 2 && tab !== 'eventos') params.set('q', cleanQuery)
    if (tab === 'negocios' && category) params.set('businessType', category)
    if (tab === 'comunidades' && category) params.set('cat', category)
    if (tab === 'eventos' && category) params.set('eventType', category)
    if (location) {
      if (CANTONS.some(item => item.code === location)) params.set('canton', location)
      else params.set('location', location)
    }

    const section = tab === 'negocios'
      ? 'Negocios'
      : tab === 'comunidades'
        ? 'Grupos'
        : 'Eventos'
    const subject = cleanQuery.length >= 2 ? `“${cleanQuery}”` : section
    return {
      name:`${section}: ${subject}${location ? ` · ${location}` : ''}`.slice(0, 100),
      query:tab !== 'eventos' && cleanQuery.length >= 2 ? cleanQuery : '',
      entityKinds:[
        tab === 'negocios' ? 'provider' : tab === 'comunidades' ? 'community' : 'event',
      ],
      category:tab === 'negocios' ? 'servicios' : tab === 'comunidades' ? 'comunidad' : 'eventos',
      canton:tab === 'comunidades' ? '' : location,
      city:tab === 'comunidades' ? location : '',
      filters:{
        businessType:tab === 'negocios' ? category : '',
        communityCategory:tab === 'comunidades' ? category : '',
        eventType:tab === 'eventos' ? category : '',
      },
      resultPath:`/comunidades?${params.toString()}`,
    }
  }, [directoryFilterDraft.category, directoryFilterDraft.location, search, tab])

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
    <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 24px 100px' }}>
      <div style={{ width:'100vw', marginLeft:'calc(50% - 50vw)', marginRight:'calc(50% - 50vw)', background:'#fff' }}>
        <div style={{ width:'100%', maxWidth:1240, margin:'0 auto', padding:'16px 24px 0' }}>
      <div className="section-page-head">
        <h1>{tabCopy.title}</h1>
        <p>{tabCopy.subtitle}</p>
      </div>


      {/* Search bar — hidden in eventos tab */}
        </div>
      </div>

      <div className="cat-bar sticky-toolbar-shell" style={{ width:'100vw', marginLeft:'calc(50% - 50vw)', marginRight:'calc(50% - 50vw)', marginBottom:16, padding:'10px 0 12px' }}>
        <div style={{ width:'100%', maxWidth:1240, margin:'0 auto', padding:'0 8px', boxSizing:'border-box' }}>
          <div style={{ background:'#fff', border:`1px solid ${C.border}`, borderRadius:22, padding:12, boxShadow:'0 10px 24px rgba(15,23,42,0.06)', boxSizing:'border-box' }}>
          <SectionTabs />
          {tab !== 'eventos' && tab !== 'creadores' && (
            <div key={`${tab}-directory-toolbar`} className="segmented-content-transition">
              <div style={{ display:'flex', alignItems:'center', gap:8, width:'100%', minWidth:0, marginTop:10 }}>
                <div style={{ flex:'1 1 0', minWidth:0 }}>
                  <GlobalSearch
                    size="sm"
                    placeholder={TAB_COPY[tab].search}
                    value={search}
                    onValueChange={setSearch}
                    resultTypes={DIRECTORY_SEARCH_RESULT_TYPES[tab]}
                    analyticsScope={tab === 'comunidades' ? 'comunidad_grupos' : 'comunidad_negocios'}
                    assistantMode
                    showResultsDropdown={false}
                    onResolvedResultsChange={setResolvedSearch}
                    searchFilters={{
                      category:tab === 'comunidades' ? cat : negType,
                      canton:tab === 'negocios' ? locationFilter : '',
                      location:tab === 'comunidades' ? locationFilter : '',
                      intent:'',
                    }}
                    onSearchFiltersChange={clearDirectoryFilters}
                    filterCount={activeDirectoryFilters}
                    onFiltersRequest={openDirectoryFilters}
                  />
                </div>
                <FilterButton
                  count={activeDirectoryFilters}
                  open={showDirectoryFilters}
                  onClick={toggleDirectoryFilters}
                />
              </div>
              {visibleDirectoryFilterChips.length > 0 && (
                <div style={{ marginTop:9 }}>
                  <FilterChips
                    items={visibleDirectoryFilterChips}
                    onRemove={removeVisibleDirectoryFilter}
                    onClear={clearVisibleDirectoryFilters}
                  />
                </div>
              )}
              <FilterResultSummary
                count={visibleDirectoryResultCount}
                sortLabel={currentDirectorySortLabel}
                sortOptions={tab === 'negocios' ? BUSINESS_SORT_OPTIONS : COMMUNITY_SORT_OPTIONS}
                sortValue={activeDirectorySort}
                onSortChange={handleDirectorySortChange}
              />
              {savedSearchDraft && (
                <div className="saved-search-prompt saved-search-prompt--toolbar">
                  <span>Avísame cuando haya nuevos resultados.</span>
                  <SavedSearchButton draft={savedSearchDraft} compact />
                </div>
              )}
            </div>
          )}
          {tab === 'eventos' && (
            <div className="segmented-content-transition" style={{ marginTop:10 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
                <span style={{ fontFamily:PP, fontSize:11, fontWeight:700, color:C.light }}>
                  {filteredEvents.length} {filteredEvents.length === 1 ? 'resultado' : 'resultados'}
                </span>
                <FilterButton
                  count={activeDirectoryFilters}
                  open={showDirectoryFilters}
                  onClick={toggleDirectoryFilters}
                  controls="event-filter-sheet"
                />
              </div>
              {savedSearchDraft && (
                <div className="saved-search-prompt saved-search-prompt--toolbar">
                  <span>Avísame cuando haya nuevos resultados.</span>
                  <SavedSearchButton draft={savedSearchDraft} compact />
                </div>
              )}
            </div>
          )}
          {tab === 'creadores' && (
            <CreatorCommunityToolbar
              search={creatorSearch}
              onSearchChange={setCreatorSearch}
              topic={creatorTopic}
              onTopicChange={setCreatorTopic}
              platform={creatorPlatform}
              onPlatformChange={setCreatorPlatform}
              location={creatorLocation}
              onLocationChange={setCreatorLocation}
              sort={creatorSort}
              onSortChange={setCreatorSort}
              resultCount={creatorResultCount}
              view={creatorView}
              onViewChange={handleCreatorViewChange}
            />
          )}
          </div>
        </div>
      </div>

      <div key={`${tab}-directory-results`} className="segmented-content-transition">
      {tab === 'comunidades' && (
        <>
          {loading ? (
            <div className="skeleton" style={{ height:200, borderRadius:20 }} />
          ) : filteredComm.length === 0 ? (
            <EmptyState emoji="👥" title={TAB_COPY.comunidades.emptyTitle} sub={TAB_COPY.comunidades.emptyText} action="Ver todo" onAction={() => { clearAllDirectoryFilters(); setSearch('') }} />
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
            <EmptyState emoji="🏪" title={TAB_COPY.negocios.emptyTitle} sub={TAB_COPY.negocios.emptyText} action="Ver todo" onAction={() => { clearAllDirectoryFilters(); setSearch('') }} />
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:CARD_STACK_GAP }}>
              {filteredNeg.map(business => (
                <BusinessCard
                  key={business.id}
                  business={business}
                  onClick={() => openBusinessDetails(business)}
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

      {tab === 'creadores' && (
        <CreatorCommunityView
          search={creatorSearch}
          topic={creatorTopic}
          platform={creatorPlatform}
          location={creatorLocation}
          sort={creatorSort}
          view={creatorView}
          onResultCountChange={setCreatorResultCount}
          onClearFilters={() => {
            setCreatorSearch('')
            setCreatorTopic('')
            setCreatorPlatform('')
            setCreatorLocation('')
          }}
        />
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
            {eventfrogOpen && <EventfrogCalendar initialCanton={requestedCanton} />}
          </div>

          {/* Eventos de la comunidad */}
          <div style={{ marginBottom:24 }}>
            <p style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:C.light, letterSpacing:1, marginBottom:12 }}>EVENTOS DE LA COMUNIDAD</p>
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
                        <img src={getThumbnailImageUrl(event.img)} alt={event.title} loading="lazy" decoding="async" style={LIST_MEDIA_STYLE} />
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
      </div>

      {(tab === 'negocios' || tab === 'comunidades' || tab === 'eventos') && (
        <Sheet show={showDirectoryFilters} onClose={() => setShowDirectoryFilters(false)}>
          <form
            id={tab === 'eventos' ? 'event-filter-sheet' : 'directory-filter-sheet'}
            className="filter-sheet-content"
            onSubmit={event => {
              event.preventDefault()
              applyDirectoryFilters()
            }}
          >
            <div className="filter-sheet-heading">
              <h2>Filtros</h2>
              <button type="button" onClick={clearDirectoryFilterDraft}>Restablecer</button>
            </div>

            <div className="filter-sheet-options-grid">
              <label>
                <span style={FILTER_PANEL_TITLE_STYLE}>{tab === 'eventos' ? 'Tipo de evento' : 'Categoría'}</span>
                <select
                  className="filter-sheet-control"
                  value={directoryFilterDraft.category}
                  onChange={event => setDirectoryFilterDraft(current => ({ ...current, category:event.target.value }))}
                  style={getDirectoryFilterControlStyle(directoryFilterDraft.category)}
                >
                  {(tab === 'negocios' ? VISIBLE_NEGOCIO_TYPES : tab === 'eventos' ? eventTypeOptions : catOptions).map(option => (
                    <option key={option.id || 'all'} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label>
                <span style={FILTER_PANEL_TITLE_STYLE}>
                  {tab === 'comunidades' ? 'Ubicación' : 'Cantón'}
                </span>
                <select
                  className="filter-sheet-control"
                  value={directoryFilterDraft.location}
                  onChange={event => setDirectoryFilterDraft(current => ({ ...current, location:event.target.value }))}
                  style={getDirectoryFilterControlStyle(directoryFilterDraft.location)}
                >
                  {(tab === 'comunidades' ? communityCityOptions : cantonOptions).map(option => (
                    <option key={option.id || 'all'} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>

              {tab !== 'eventos' && (
                <label>
                  <span style={FILTER_PANEL_TITLE_STYLE}>Ordenar por</span>
                  <select
                    className="filter-sheet-control"
                    value={directoryFilterDraft.sort}
                    onChange={event => setDirectoryFilterDraft(current => ({ ...current, sort:event.target.value }))}
                    style={getDirectoryFilterControlStyle(
                      directoryFilterDraft.sort,
                      tab === 'negocios' ? 'recommended' : 'newest'
                    )}
                  >
                    {(tab === 'negocios' ? BUSINESS_SORT_OPTIONS : COMMUNITY_SORT_OPTIONS).map(option => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <SavedSearchButton
              draft={filterSavedSearchDraft}
              idleLabel="Guardar esta búsqueda y avisarme"
              panel
            />

            <button type="submit" className="filter-show-results filter-sheet-submit">
              Mostrar {draftDirectoryResultCount} {draftDirectoryResultCount === 1 ? 'resultado' : 'resultados'}
            </button>
          </form>
        </Sheet>
      )}

      <CommunityDetail
        community={selectedCommunity}
        onClose={closeCommunityDetails}
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
