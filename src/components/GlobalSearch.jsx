import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { trackAnalyticsEvent, trackSearchEvent } from '../lib/analytics'
import { createSearchAttemptId, rememberSearchResultForResolution } from '../lib/searchResolution'
import {
  clearRecentSearches,
  readRecentSearches,
  rememberRecentSearch,
  removeRecentSearch,
} from '../lib/searchHistory'
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
  AD_CATS,
  CANTONS,
  formatAdLocation,
  getCantonForCity,
  getAdCategoryId,
  getAdDisplayCat,
  getAdDisplayEmoji,
  getJobCategoryEmoji,
  getJobIntentMeta,
  getNegocioTypeMeta,
  EVENTO_TYPES,
} from '../lib/constants'
import { SEARCHABLE_SITE_PAGES, getAdPath, getBusinessPath, getEventPath, getGuidePath, getJobPath } from '../lib/seo'
import { getThumbnailImageUrl, resolveImageUrl } from '../lib/imageVariants'
import { rotateItems, takeNextRotationOffset } from '../lib/rotation'
import { buildSearchProfile, normalizeSearchText, profileHasIntent, scoreSearchFields } from '../lib/naturalSearch'
import { isPublicationOpen } from '../lib/publicationLifecycle'
import {
  employmentProfileFromJob,
  getEmploymentProfileRows,
  getEmploymentProfileLevel,
} from '../lib/employmentProfile'
import { FilterIcon } from './FilterWorkspace'
import {
  buildLatidoSearchRpcParams,
  matchesLatidoAssistantResult,
  parseLatidoAssistantQuery,
  parseResultAmount,
  parseResultRooms,
} from '../lib/latidoAssistantSearch'

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

const EMPTY_SEARCH_FILTERS = Object.freeze({ category:'', canton:'', location:'', intent:'' })

const TYPE_COLORS = {
  ad:{ bg:'#DBEAFE', color:'#1D4ED8', label:'Anuncio' },
  job:{ bg:'#E0F2FE', color:'#0369A1', label:'Empleo' },
  community:{ bg:'#D1FAE5', color:'#065F46', label:'Grupo' },
  business:{ bg:'#FEF3C7', color:'#92400E', label:'Negocio' },
  event:{ bg:'#FCE7F3', color:'#9D174D', label:'Evento' },
  guide:{ bg:'#EDE9FE', color:'#6D28D9', label:'Guía' },
  page:{ bg:'#F1F5F9', color:'#475569', label:'Página' },
}

const SEARCH_INTENT_LABELS = {
  employment:'Empleo',
  cleaning:'Limpieza',
  translation:'Traducciones',
  moving:'Mudanzas',
  plumbing:'Fontanería',
  electrical:'Electricidad',
  locksmith:'Cerrajería',
  painting:'Pintura',
  carpentry:'Carpintería',
  gardening:'Jardinería',
  appliance_repair:'Reparación de electrodomésticos',
  repairs:'Reparaciones y mantenimiento',
  childcare:'Cuidado infantil',
  eldercare:'Cuidado de mayores',
  paperwork:'Trámites y asesoría',
  housing:'Vivienda',
  health:'Salud',
  beauty:'Belleza',
  food:'Comida y restaurantes',
  vehicle:'Vehículos',
  marketplace:'Compra y venta',
}

const SPECIALIZED_HOME_INTENTS = new Set([
  'plumbing', 'electrical', 'locksmith', 'painting', 'carpentry', 'gardening', 'appliance_repair',
])

function getSearchInterpretation(profile) {
  const hasSpecializedHomeIntent = profile?.intents?.some(intent => SPECIALIZED_HOME_INTENTS.has(intent.id))
  return profile?.intents
    ?.filter(intent => !(hasSpecializedHomeIntent && intent.id === 'repairs'))
    ?.map(intent => SEARCH_INTENT_LABELS[intent.id])
    .filter(Boolean)
    .join(' · ') || ''
}

function escapeSearchRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function HighlightSearchText({ text: value, tokens }) {
  const text = String(value || '')
  if (!text || !tokens.length) return text

  const pattern = tokens
    .filter(token => token.length >= 3)
    .sort((a, b) => b.length - a.length)
    .map(escapeSearchRegExp)
    .join('|')
  if (!pattern) return text

  const matcher = new RegExp(`(${pattern})`, 'gi')
  return text.split(matcher).map((part, index) => (
    tokens.some(token => part.toLowerCase() === token.toLowerCase())
      ? <mark key={`${part}-${index}`} style={{ background:'#FEF3C7', color:'inherit', borderRadius:3, padding:'0 1px' }}>{part}</mark>
      : part
  ))
}

function PremiumPartnerSearchList({ partners, onOpen, highlightTokens, horizontal=false }) {
  const trackRef = useRef(null)
  const firstPartnerId = partners[0]?.id

  useEffect(() => {
    if (!horizontal || !trackRef.current) return
    trackRef.current.scrollLeft = 0
  }, [firstPartnerId, horizontal])

  return (
    <section className={`latido-search-partners${horizontal ? ' is-horizontal' : ''}`}>
      <div className="latido-search-partners__heading">
        <span>
          Partners premium
        </span>
        <small>
          {partners.length} recomendados
        </small>
      </div>
      <div ref={trackRef} className="latido-search-partners__track">
        {partners.map(partner => (
          <div
            key={`premium-partner-${partner.id}`}
            className="latido-search-partners__card"
          >
            <span className="latido-search-partners__logo">
              {partner.image ? (
                <img src={getThumbnailImageUrl(partner.image)} alt="" loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:'contain', display:'block', background:'#fff' }} />
              ) : partner.icon}
            </span>
            <div className="latido-search-partners__copy">
              <p>
                <HighlightSearchText text={partner.label} tokens={highlightTokens} />
              </p>
              <small>
                <HighlightSearchText text={partner.sub} tokens={highlightTokens} />
              </small>
            </div>
            <button
              type="button"
              onClick={() => onOpen(partner)}
              aria-label={`Ver ${partner.label}`}
            >
              Ver <span aria-hidden="true">→</span>
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

const SEARCH_SERVICE_BUSINESS_TYPES = new Set(['hogar', 'salud', 'asesoria_tramites', 'belleza'])
const SEARCH_SERVICE_JOB_SECTORS = new Set(['cuidados', 'limpieza', 'construccion', 'transporte', 'servicios', 'salud'])

function getBusinessCategoryKeys(business) {
  const normalizedType = getNegocioTypeMeta(business.type)?.id || business.type
  const keys = ['negocios', business.type, normalizedType, ...(business.partnerCategories || [])].filter(Boolean)
  const searchText = normalizeSearchText([
    business.name,
    business.desc,
    ...(business.services || []),
  ].filter(Boolean).join(' '))
  if (SEARCH_SERVICE_BUSINESS_TYPES.has(normalizedType)) keys.push('servicios')
  if (normalizedType === 'asesoria_tramites') keys.push('documentos')
  if ([
    'guarderia', 'kita', 'kinderkrippe', 'ninera', 'ninero', 'canguro', 'au pair',
    'cuidado de ninos', 'cuidado infantil', 'cuidado de mayores', 'spitex',
  ].some(term => searchText.includes(term))) keys.push('cuidados')
  return [...new Set(keys)]
}

function getJobCategoryKeys(job) {
  const keys = ['empleo']
  if (job.sector === 'cuidados') keys.push('cuidados')
  if (SEARCH_SERVICE_JOB_SECTORS.has(job.sector)) keys.push('servicios')
  return keys
}

function getPageCategoryKeys(page) {
  if (page.id === 'tablon') return ['anuncios']
  if (page.id === 'vivienda') return ['vivienda']
  if (page.id === 'empleo') return ['empleo']
  if (page.id === 'mercado') return ['venta']
  if (page.id === 'servicios') return ['servicios']
  if (page.id === 'cuidados') return ['cuidados', 'servicios']
  if (page.id === 'tramites') return ['documentos', 'servicios']
  if (['servicios-suiza', 'servicios-virtus360'].includes(page.id)) return ['servicios']
  if (page.id === 'negocios') return ['negocios']
  if (page.id === 'comunidades') return ['grupos']
  if (page.id === 'eventos') return ['eventos']
  if (page.id === 'guias') return ['guias']
  return []
}

function matchesCanton(filterMeta, cantonCode) {
  if (!cantonCode) return true

  const location = normalizeSearchText(`${filterMeta?.canton || ''} ${filterMeta?.location || ''}`)
  if (!location) return false
  if (location === 'suiza' || location.includes('toda suiza') || location.split(' ').includes('nacional')) return true

  const canton = CANTONS.find(item => item.code === cantonCode)
  const words = location.split(' ')
  return getCantonForCity(filterMeta?.location) === cantonCode ||
    words.includes(normalizeSearchText(cantonCode)) || (
    canton?.name && location.includes(normalizeSearchText(canton.name))
  )
}

function matchesSearchFilters(result, filters) {
  const meta = result.filterMeta || {}
  if (filters?.category && !meta.categories?.includes(filters.category)) return false
  if (filters?.canton && !matchesCanton(meta, filters.canton)) return false
  if (filters?.location && normalizeSearchText(meta.location) !== normalizeSearchText(filters.location)) return false
  if (filters?.intent) {
    const intentMatches = filters.intent === 'ofrece'
      ? !['busca', 'compra'].includes(meta.intent)
      : filters.intent === 'busca'
        ? ['busca', 'compra'].includes(meta.intent)
        : meta.intent === filters.intent
    if (!intentMatches) return false
  }
  return true
}

function hasActiveSearchFilters(filters) {
  return !!(filters?.category || filters?.canton || filters?.location || filters?.intent)
}

const SEARCH_PAGE_SIZE = 1000
const INITIAL_SEARCH_RESULTS = 12
const MAX_SEARCH_RESULTS = 120
const FULL_SEARCH_PAGE_SIZE = 24
const SEARCH_SORT_OPTIONS = [
  { id:'relevance', label:'Más relevantes' },
  { id:'newest', label:'Más recientes' },
  { id:'oldest', label:'Más antiguos' },
  { id:'price_asc', label:'Precio más bajo' },
  { id:'price_desc', label:'Precio más alto' },
]
const SEARCH_DESTINATION_PREFETCHES = new Map()

function getSearchDestinationLoader(result) {
  const href = String(result?.href || '')
  if (href.startsWith('/servicios-virtus360')) {
    return { key:'virtus360', load:() => import('../pages/Virtus360Services') }
  }
  if (href.startsWith('/colaboradores/bellini')) {
    return { key:'bellini', load:() => import('../pages/BelliniPartnerContact') }
  }
  if (href.startsWith('/colaboradores/syna')) {
    return { key:'syna', load:() => import('../pages/SynaPartnerContact') }
  }
  if (href.startsWith('/colaboradores/mira')) {
    return { key:'mira', load:() => import('../pages/PartnerContact') }
  }
  if (result?.type === 'ad' || result?.type === 'job') {
    return { key:'tablon', load:() => import('../pages/Tablon') }
  }
  if (['business', 'community', 'event'].includes(result?.type)) {
    return { key:'comunidades', load:() => import('../pages/Comunidades') }
  }
  if (result?.type === 'guide') {
    return { key:'guias', load:() => import('../pages/Guias') }
  }
  return null
}

function prefetchSearchDestination(result) {
  const destination = getSearchDestinationLoader(result)
  if (!destination || SEARCH_DESTINATION_PREFETCHES.has(destination.key)) return

  const request = destination.load().catch(() => null)
  SEARCH_DESTINATION_PREFETCHES.set(destination.key, request)
}

const SEARCH_SELECTS = {
  ads: 'id, cat, sub, type, title, desc, city, canton, plz, price, price_amount, price_unit, rooms, available_from, privacy, active, img_url, photo_urls, created_at',
  jobs: 'id, title, company, city, canton, type, sector, category, job_intent, salary, salary_amount, salary_unit, lang, languages, desc, emoji, logo_url, employment_profile, employment_level, experience_years, available_from, driving_license, german_level, german_required, spanish_supported, active, created_at',
  communities: 'id, name, city, members, emoji, cat, desc, photo_url, active, created_at',
  providers: 'id, name, category, city, canton, description, services, languages, active, featured, verified, promotion_plan, promotion_starts_at, promotion_ends_at, photo_url, created_at',
  events: 'id, type, title, day, month, year, price, city, canton, venue, host, desc, emoji, img_url, active, featured, created_at',
}

const QUICK_SEARCHES = {
  empleos:['Trabajo de limpieza', 'Construcción', 'Logística', 'Empleo sin alemán'],
  tablon:['Piso en Zürich', 'Trabajo', 'Servicios de limpieza', 'Muebles'],
  comunidad_negocios:['Restaurante', 'Asesoría', 'Seguros', 'Limpieza'],
  comunidad_grupos:['Latinos en Zürich', 'Familias', 'Fútbol', 'Intercambio de idiomas'],
  global:['Piso en Zürich', 'Trabajo de limpieza', 'Traducciones', 'Restaurantes'],
  pregunta_latido:['Piso en Zürich', 'Trabajo de limpieza', 'Traducciones', 'Restaurantes'],
}

const SEARCH_SUGGESTION_CATALOG = [
  { label:'Comida y restaurantes', meta:'Negocios', terms:'comida comer restaurante restaurantes cocina tapas gastronomia catering' },
  { label:'Trabajo de limpieza', meta:'Empleo', terms:'trabajo empleo limpieza limpiar hoteles casas' },
  { label:'Trabajo en construcción', meta:'Empleo', terms:'trabajo empleo construccion obra albanil temporal' },
  { label:'Piso o habitación', meta:'Vivienda', terms:'piso vivienda habitacion apartamento alquiler sublet' },
  { label:'Traducciones y trámites', meta:'Servicios', terms:'traduccion traductor documentos tramites gestoria permisos' },
  { label:'Seguros y asesoría', meta:'Partners', terms:'seguros asesoria finanzas impuestos contabilidad gestoria' },
  { label:'Mudanzas y transporte', meta:'Servicios', terms:'mudanza mudanzas transporte traslado taxi conductor chofer' },
  { label:'Coches y vehículos', meta:'Compraventa', terms:'coche coches carro auto vehiculo vehiculos moto mecanica taller' },
  { label:'Grupos cerca de ti', meta:'Comunidad', terms:'grupo grupos comunidad latinos familias cerca' },
]

function getSuggestionCatalogMatches(query) {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return []

  const profile = buildSearchProfile(query)
  return SEARCH_SUGGESTION_CATALOG
    .map((suggestion, index) => {
      const searchableText = normalizeSearchText(`${suggestion.label} ${suggestion.terms}`)
      const words = searchableText.split(' ')
      const prefixMatch = normalizedQuery.length >= 2
        && words.some(word => word.startsWith(normalizedQuery))
      const phraseMatch = searchableText.includes(normalizedQuery)
      const semanticScore = scoreSearchFields(profile, [
        { value:suggestion.label, weight:5 },
        { value:suggestion.terms, weight:4 },
      ])
      const score = semanticScore + (phraseMatch ? 160 : 0) + (prefixMatch ? 120 : 0)
      return { ...suggestion, score, index }
    })
    .filter(suggestion => suggestion.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
}

function scorePartnerEntry(query, partner) {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return 0

  const profile = buildSearchProfile(query)
  const fields = [
    { value:partner.label, weight:6 },
    { value:partner.servicesText, weight:5 },
    { value:partner.description, weight:4 },
    { value:partner.categoryText, weight:3 },
    { value:partner.locationText, weight:2 },
    { value:partner.aliasesText, weight:2 },
  ]
  const semanticScore = scoreSearchFields(profile, fields)
  const queryTokens = normalizedQuery.split(' ').filter(Boolean)
  const partnerWords = normalizeSearchText(fields.map(field => field.value).join(' ')).split(' ')
  const partialMatch = queryTokens.length > 0
    && queryTokens.every(token => (
      token.length >= 2
      && partnerWords.some(word => word.startsWith(token))
    ))

  return semanticScore + (partialMatch ? 100 : 0)
}

function SearchGlyph({ size=22 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  )
}

function BackGlyph({ size=22 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

function HistoryGlyph({ size=21 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </svg>
  )
}

function CloseGlyph({ size=18 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

function SortGlyph({ size=16 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 4v16M5 17l3 3 3-3M16 20V4M13 7l3-3 3 3" />
    </svg>
  )
}

function getSearchResultPrice(result) {
  const raw = result?.filterMeta?.priceAmount ?? result?.filterMeta?.salaryAmount
  const numeric = Number(raw)
  return raw === null || raw === undefined || raw === '' || !Number.isFinite(numeric)
    ? null
    : numeric
}

function getSearchResultTimestamp(result) {
  const timestamp = Date.parse(result?.createdAt || '')
  return Number.isFinite(timestamp) ? timestamp : 0
}

function sortImmersiveResults(results, order) {
  return [...results].sort((left, right) => {
    const commercialDifference = Number(left.commercialPriority ?? BUSINESS_SEARCH_PRIORITY.free)
      - Number(right.commercialPriority ?? BUSINESS_SEARCH_PRIORITY.free)
    if (commercialDifference) return commercialDifference

    if (order === 'price_asc' || order === 'price_desc') {
      const leftPrice = getSearchResultPrice(left)
      const rightPrice = getSearchResultPrice(right)
      if (leftPrice === null && rightPrice !== null) return 1
      if (leftPrice !== null && rightPrice === null) return -1
      if (leftPrice !== null && rightPrice !== null && leftPrice !== rightPrice) {
        return order === 'price_asc' ? leftPrice - rightPrice : rightPrice - leftPrice
      }
    }

    if (order === 'newest' || order === 'oldest') {
      const dateDifference = getSearchResultTimestamp(right) - getSearchResultTimestamp(left)
      if (dateDifference) return order === 'oldest' ? -dateDifference : dateDifference
    }

    const relevanceDifference = Number(right.searchRelevance || 0) - Number(left.searchRelevance || 0)
    if (relevanceDifference) return relevanceDifference
    return getSearchResultTimestamp(right) - getSearchResultTimestamp(left)
  })
}

const BUSINESS_SEARCH_PRIORITY = {
  premium:0,
  basic:1,
  featured:2,
  free:3,
}

const EDITORIAL_PREMIUM_PARTNERS = [
  {
    id:'virtus360',
    name:'Virtus360',
    aliases:['360 virtus gmbh', 'virtus360'],
    type:'asesoria_tramites',
    city:'Horgen',
    canton:'ZH',
    description:'Gestoría, finanzas, seguros, impuestos, contabilidad y trámites para vivir o emprender en Suiza.',
    services:['Gestoría', 'Finanzas', 'Seguros', 'Impuestos', 'Contabilidad'],
    categories:['negocios', 'servicios', 'documentos'],
    image:'/partners/virtus360/logo.svg',
    href:'/servicios-virtus360',
  },
  {
    id:'bellini',
    name:'Bellini Personal AG',
    aliases:['bellini', 'bellini personal ag'],
    type:'empleo',
    city:'Luzern',
    canton:'LU',
    description:'Empleo temporal, selección de personal y oportunidades laborales en construcción en Suiza.',
    services:['Empleo', 'Trabajo temporal', 'Construcción', 'Asesoramiento laboral'],
    categories:['negocios', 'empleo', 'servicios'],
    image:'/partners/bellini/logo-wide.svg',
    href:'/colaboradores/bellini',
  },
  {
    id:'syna',
    name:'Syna',
    aliases:['syna'],
    type:'empleo',
    city:'Luzern',
    canton:'LU',
    description:'Acompañamiento para trabajadores sobre empleo, contratos, salarios, derechos laborales y sindicatos en Suiza.',
    services:['Trabajo', 'Derechos laborales', 'Contratos', 'Salarios', 'Sindicato'],
    categories:['negocios', 'empleo', 'servicios'],
    image:'/partners/syna/logo.svg',
    href:'/colaboradores/syna',
  },
  {
    id:'gilda',
    name:'GILDA by de Matos',
    aliases:['gilda', 'gilda by de matos', 'de matos'],
    type:'restaurante',
    city:'Luzern',
    canton:'LU',
    description:'Tapas de autor, cocina española, wine bar, lunch y platos para compartir en Lucerna.',
    services:['Tapas', 'Cocina española', 'Wine bar', 'Lunch'],
    categories:['negocios'],
    image:'/partners/gilda/logo.png',
    href:'https://www.dematos-luzern.ch/cafeweinbar',
  },
  {
    id:'mira',
    name:'mira',
    aliases:['mira'],
    type:'asesoria_tramites',
    city:'Suiza',
    canton:'',
    description:'Información, asesoramiento y acompañamiento intercultural para personas migrantes en Suiza.',
    services:['Información', 'Asesoramiento', 'Migración', 'Intercambio'],
    categories:['negocios', 'servicios', 'documentos'],
    image:'/partners/mira/mira-removebg-preview.png',
    href:'/colaboradores/mira',
  },
]

function getEditorialPremiumPartner(business) {
  const normalizedName = normalizeSearchText(business?.name)
  if (!normalizedName) return null
  return EDITORIAL_PREMIUM_PARTNERS.find(partner => partner.aliases.includes(normalizedName)) || null
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
    rawCategory:group.cat || '',
    category: group.cat === 'mamas' ? 'familia' : (group.cat || ''),
    desc: group.desc || group.description || '',
    image: group.photo_url || '',
    createdAt:group.created_at || '',
  }
}

function normalizeBusiness(provider) {
  const editorialPartner = getEditorialPremiumPartner(provider)
  const promotionPlan = editorialPartner ? 'premium' : getEffectiveBusinessPromotionPlan(provider)
  const providerServices = Array.isArray(provider.services) ? provider.services : []

  return {
    id: provider.id,
    name: editorialPartner?.name || provider.name || 'Negocio',
    type: provider.type || provider.category || editorialPartner?.type || '',
    city: provider.city || provider.canton || editorialPartner?.city || 'Suiza',
    canton: provider.canton || editorialPartner?.canton || '',
    desc: provider.desc || provider.description || editorialPartner?.description || '',
    emoji: provider.emoji || BUSINESS_EMOJI[provider.category] || '🏪',
    services: providerServices.length ? providerServices : (editorialPartner?.services || []),
    languages: Array.isArray(provider.languages) ? provider.languages : [],
    spanishSupported:provider.spanish_supported === true,
    featured: !!provider.featured,
    verified: !!provider.verified,
    promotionPlan,
    editorialPartnerId:editorialPartner?.id || '',
    partnerCategories:editorialPartner?.categories || [],
    href:editorialPartner?.href || '',
    photoUrl: resolveImageUrl(editorialPartner?.image || provider.photo_url || provider.img),
    created_at: provider.created_at || '',
    createdAt:provider.created_at || '',
  }
}

function getBusinessSearchPlan(business) {
  if (business?.editorialPartnerId || getEditorialPremiumPartner(business)) return 'premium'
  if (business.promotionPlan) return business.promotionPlan
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
    canton: event.canton || '',
    venue: event.venue || '',
    host: event.host || '',
    desc: event.desc || event.description || '',
    day:event.day || '',
    month:event.month || '',
    year:event.year || '',
    price:event.price || '',
    emoji: event.emoji || EVENT_EMOJI[event.type] || '🎉',
    image: event.img_url || event.img || event.photo_url || '',
    createdAt:event.created_at || '',
  }
}

function normalizeAd(ad) {
  const priceAmount = Number(ad.price_amount)
  const rooms = Number(ad.rooms)
  const hasPriceAmount = ad.price_amount != null && ad.price_amount !== '' && Number.isFinite(priceAmount)
  const hasRooms = ad.rooms != null && ad.rooms !== '' && Number.isFinite(rooms)
  return {
    id: ad.id,
    cat: getAdCategoryId(ad) || '',
    intent: ad.type || '',
    title: ad.title || '',
    desc: ad.desc || ad.description || '',
    sub:ad.sub || '',
    city: ad.city || '',
    canton: ad.canton || 'Toda Suiza',
    plz: ad.plz || '',
    price: ad.price || '',
    priceAmount:hasPriceAmount ? priceAmount : parseResultAmount(ad.price),
    priceUnit:ad.price_unit || '',
    rooms:hasRooms ? rooms : parseResultRooms(ad.sub, ad.title, ad.desc),
    availableFrom:ad.available_from || '',
    privacy: ad.privacy || 'public',
    image: getFirstImage(normalizePhotoUrls(ad.photo_urls), ad.img_url, ad.img),
    open:isPublicationOpen(ad),
    createdAt:ad.created_at || '',
  }
}

function normalizeJob(job) {
  const intent = getJobIntentMeta(job)
  const salaryAmount = Number(job.salary_amount)
  const hasSalaryAmount = job.salary_amount != null && job.salary_amount !== '' && Number.isFinite(salaryAmount)
  const employmentProfile = employmentProfileFromJob(job)
  const employmentProfileRows = getEmploymentProfileRows(employmentProfile)
  const employmentLevel = getEmploymentProfileLevel(employmentProfile)
  return {
    id: job.id,
    title: job.title || '',
    company: job.company || (intent.id === 'busca' ? 'Solicitud de empleo' : 'Empresa'),
    city: job.city || job.canton || 'Suiza',
    canton: job.canton || '',
    type: job.type || 'Trabajo',
    sector: job.sector || job.category || '',
    desc:job.desc || job.description || '',
    salary:job.salary || '',
    salaryAmount:hasSalaryAmount ? salaryAmount : parseResultAmount(job.salary),
    salaryUnit:job.salary_unit || '',
    languages:Array.isArray(job.languages) ? job.languages : [],
    languageText:job.lang || '',
    germanLevel:job.german_level || '',
    germanRequired:job.german_required,
    spanishSupported:job.spanish_supported === true,
    employmentProfile,
    employmentProfileText:employmentProfileRows.map(row => `${row.label} ${row.value}`).join(' '),
    employmentLevelId:job.employment_level || employmentLevel?.id || '',
    employmentLevelLabel:employmentLevel?.label || '',
    intentId: intent.id,
    intentLabel: intent.label,
    emoji: getJobCategoryEmoji(job),
    image: job.logo_url || job.img || '',
    open:isPublicationOpen(job),
    createdAt:job.created_at || '',
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

function buildRpcDatasets(rows, fallbackDatasets) {
  const next = {
    ads:[],
    jobs:[],
    communities:[],
    businesses:[],
    events:[],
    guides:fallbackDatasets.guides,
    pages:fallbackDatasets.pages,
  }

  for (const row of rows || []) {
    const payload = row?.payload
    if (!payload || typeof payload !== 'object') continue
    if (row.entity_type === 'ad') {
      const ad = normalizeAd(payload)
      if (ad.open) next.ads.push(ad)
    }
    else if (row.entity_type === 'job') {
      const job = normalizeJob(payload)
      if (job.open) next.jobs.push(job)
    }
    else if (row.entity_type === 'community') {
      const community = normalizeCommunity(payload)
      if (community) next.communities.push(community)
    } else if (row.entity_type === 'business') next.businesses.push(normalizeBusiness(payload))
    else if (row.entity_type === 'event') next.events.push(normalizeEvent(payload))
  }

  next.businesses.sort(sortBusinessesByPromotion)
  return next
}

function mergeSearchDatasets(primary, secondary) {
  const merged = {}
  for (const key of Object.keys(EMPTY_DATASETS)) {
    const seen = new Set()
    merged[key] = []
    for (const item of [...(primary?.[key] || []), ...(secondary?.[key] || [])]) {
      const id = String(item?.id || '')
      if (!id || seen.has(id)) continue
      seen.add(id)
      merged[key].push(item)
    }
  }
  return merged
}

function sortMatchingBusinesses(a, b) {
  const planDiff = getBusinessSearchPriority(a) - getBusinessSearchPriority(b)
  if (planDiff) return planDiff
  const relevanceDiff = (b.searchScore || 0) - (a.searchScore || 0)
  if (relevanceDiff) return relevanceDiff
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

function searchAll(query, datasets, isLoggedIn, allowBrowse = false, assistantQuery = null) {
  const semanticQuery = assistantQuery?.active ? assistantQuery.semanticQuery : query
  const profile = buildSearchProfile(semanticQuery)
  const hasSearchQuery = profile.normalized.length >= 2
  const browseAll = (allowBrowse && !hasSearchQuery) || (!!assistantQuery?.hasStructuredCriteria && !hasSearchQuery)
  if (!hasSearchQuery && !browseAll) return []
  const getSearchScore = fields => browseAll ? 1 : scoreSearchFields(profile, fields)
  const matchReason = browseAll
    ? ''
    : (assistantQuery?.scope?.professionalLabel || getSearchInterpretation(profile))

  const results = []
  const metaSeparator = ' \u00B7 '

  for (const ad of datasets.ads) {
    if (isLoggedIn || ad.privacy === 'public') {
      const cat = getAdDisplayCat(ad)
      const location = formatAdLocation(ad)
      const searchScore = getSearchScore([
        { value:ad.title, weight:6 },
        { value:ad.desc, weight:4 },
        { value:ad.sub, weight:3 },
        { value:cat?.label, weight:2 },
        { value:ad.cat, weight:2 },
        { value:location, weight:2 },
        { value:ad.canton, weight:1 },
      ])
      if (!searchScore) continue

      results.push({
        type:'ad',
        id:ad.id,
        icon:getAdDisplayEmoji(ad),
        image:ad.image,
        imageFit:'cover',
        label:ad.title,
        sub:[cat?.label || 'Anuncio', location, ad.price].filter(Boolean).join(metaSeparator),
        href:getAdPath(ad),
        createdAt:ad.createdAt,
        privacy:ad.privacy,
        filterMeta:{
          categories:['anuncios', getAdCategoryId(ad)].filter(Boolean),
          searchText:[ad.title, ad.desc, cat?.label, ad.cat, ad.sub].filter(Boolean).join(' '),
          title:ad.title,
          description:ad.desc,
          subcategory:ad.sub,
          canton:ad.canton,
          city:ad.city,
          location,
          postalCode:ad.plz,
          intent:ad.intent,
          priceAmount:ad.priceAmount,
          priceUnit:ad.priceUnit,
          rooms:ad.rooms,
          availableFrom:ad.availableFrom,
        },
        searchScore,
      })
    }
  }

  for (const job of datasets.jobs) {
    let searchScore = getSearchScore([
      { value:job.title, weight:6 },
      { value:job.company, weight:4 },
      { value:job.sector, weight:4 },
      { value:job.city, weight:2 },
      { value:job.intentLabel, weight:2 },
      { value:job.type, weight:2 },
      { value:job.desc, weight:3 },
      { value:job.languageText, weight:2 },
      { value:job.languages.join(' '), weight:2 },
      { value:job.employmentProfileText, weight:4 },
      { value:job.employmentLevelLabel, weight:3 },
      { value:'empleo trabajo oferta laboral vacante puesto', weight:3 },
    ])
    if (searchScore) {
      if (profileHasIntent(profile, 'employment') && job.intentId === 'ofrece') searchScore += 24
      results.push({
        type:'job',
        id:job.id,
        icon:job.emoji || '\u{1F4BC}',
        image:job.image,
        imageFit:'contain',
        label:job.title,
        sub:[job.intentLabel, job.employmentLevelLabel, job.company, job.city, job.type].filter(Boolean).join(metaSeparator),
        href:getJobPath(job),
        createdAt:job.createdAt,
        filterMeta:{
          categories:getJobCategoryKeys(job),
          canton:job.canton,
          city:job.city,
          location:job.city,
          intent:job.intentId,
          salaryAmount:job.salaryAmount,
          salaryUnit:job.salaryUnit,
          languages:job.languages,
          languageText:job.languageText,
          germanLevel:job.germanLevel,
          germanRequired:job.germanRequired,
          spanishSupported:job.spanishSupported,
          employmentLevel:job.employmentLevelId,
          employmentProfileText:job.employmentProfileText,
        },
        searchScore,
      })
    }
  }

  for (const group of datasets.communities) {
    const searchScore = getSearchScore([
      { value:group.name, weight:6 },
      { value:group.desc, weight:4 },
      { value:group.category, weight:3 },
      { value:group.city, weight:2 },
      { value:'grupo comunidad', weight:1 },
    ])
    if (searchScore) {
      results.push({
        type:'community',
        id:group.id,
        icon:group.emoji || '\u{1F465}',
        image:group.image,
        imageFit:'cover',
        label:group.name,
        sub:['Grupo', group.city, `${group.members} miembros`].filter(Boolean).join(metaSeparator),
        href:`/comunidades?openCommunity=${encodeURIComponent(group.id)}`,
        createdAt:group.createdAt,
        filterMeta:{
          categories:['grupos', group.rawCategory, group.category].filter(Boolean),
          location:group.city,
        },
        searchScore,
      })
    }
  }

  const matchingBusinesses = []
  for (const business of datasets.businesses) {
    const businessType = getNegocioTypeMeta(business.type)
    const searchScore = getSearchScore([
      { value:business.name, weight:6 },
      { value:business.services.join(' '), weight:5 },
      { value:business.desc, weight:4 },
      { value:businessType?.label, weight:2 },
      { value:business.type, weight:2 },
      { value:business.city, weight:2 },
      { value:business.languages.join(' '), weight:2 },
      { value:'negocio profesional servicio', weight:1 },
    ])
    if (searchScore) {
      const categories = getBusinessCategoryKeys(business)
      if (profileHasIntent(profile, 'employment')) categories.push('empleo')
      matchingBusinesses.push({
        ...business,
        filterMeta:{
          categories,
          searchText:[business.name, business.services.join(' '), business.desc, businessType?.label, business.type].filter(Boolean).join(' '),
          canton:business.canton,
          city:business.city,
          location:business.city,
          intent:'ofrece',
          languages:business.languages,
          languageText:business.desc,
          spanishSupported:business.spanishSupported,
        },
        searchScore,
      })
    }
  }

  const availableEditorialPartnerIds = new Set(
    datasets.businesses.map(business => business.editorialPartnerId).filter(Boolean)
  )
  for (const partner of EDITORIAL_PREMIUM_PARTNERS) {
    if (availableEditorialPartnerIds.has(partner.id)) continue
    const businessType = getNegocioTypeMeta(partner.type)
    const searchScore = getSearchScore([
      { value:partner.name, weight:6 },
      { value:partner.services.join(' '), weight:5 },
      { value:partner.description, weight:4 },
      { value:businessType?.label, weight:2 },
      { value:partner.type, weight:2 },
      { value:partner.city, weight:2 },
    ])
    if (!searchScore) continue

    matchingBusinesses.push({
      id:`editorial-${partner.id}`,
      name:partner.name,
      type:partner.type,
      city:partner.city,
      canton:partner.canton,
      desc:partner.description,
      emoji:'✨',
      services:partner.services,
      languages:['Español'],
      spanishSupported:true,
      featured:true,
      verified:true,
      promotionPlan:'premium',
      editorialPartnerId:partner.id,
      partnerCategories:partner.categories,
      href:partner.href,
      photoUrl:partner.image,
      created_at:'',
      createdAt:'',
      filterMeta:{
        categories:partner.categories,
        searchText:[partner.name, partner.services.join(' '), partner.description, businessType?.label, partner.type].filter(Boolean).join(' '),
        canton:partner.canton,
        city:partner.city,
        location:partner.city,
        intent:'ofrece',
        languages:['Español'],
        languageText:partner.description,
        spanishSupported:true,
      },
      searchScore,
    })
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
      href:recommendedPartner.href || getBusinessPath(recommendedPartner),
      createdAt:recommendedPartner.createdAt || recommendedPartner.created_at,
      isPartnerRecommendation:true,
      filterMeta:recommendedPartner.filterMeta,
      partnerPlan:getBusinessSearchPlan(recommendedPartner),
      searchPriority:-2,
      searchScore:recommendedPartner.searchScore,
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
      href:business.href || getBusinessPath(business),
      createdAt:business.createdAt || business.created_at,
      featured:business.featured,
      filterMeta:business.filterMeta,
      partnerPlan:getBusinessSearchPlan(business),
      searchPriority:getBusinessSearchPriority(business),
      searchScore:business.searchScore,
    })
  }

  for (const event of datasets.events) {
    const eventType = EVENTO_TYPES.find(type => type.id === event.type)
    const searchScore = getSearchScore([
      { value:event.title, weight:6 },
      { value:event.desc, weight:4 },
      { value:eventType?.label, weight:3 },
      { value:event.venue, weight:2 },
      { value:event.host, weight:2 },
      { value:event.city, weight:2 },
      { value:'evento plan actividad', weight:1 },
    ])
    if (searchScore) {
      results.push({
        type:'event',
        id:event.id,
        icon:event.emoji || '\u{1F389}',
        image:event.image,
        imageFit:'cover',
        label:event.title,
        sub:[eventType?.label || 'Evento', event.city].filter(Boolean).join(metaSeparator),
        href:getEventPath(event),
        createdAt:event.createdAt,
        filterMeta:{
          categories:['eventos'],
          searchText:[event.title, event.desc, eventType?.label, event.type, event.venue, event.host].filter(Boolean).join(' '),
          canton:event.canton,
          city:event.city,
          location:event.city,
        },
        searchScore,
      })
    }
  }

  for (const guide of datasets.guides || []) {
    const searchScore = getSearchScore([
      { value:guide.title, weight:6 },
      { value:guide.summary, weight:4 },
      { value:guide.cat, weight:3 },
      { value:guide.content, weight:1 },
      { value:guide.time, weight:1 },
      { value:guide.level, weight:1 },
      { value:'guia informacion ayuda', weight:1 },
    ])
    if (searchScore) {
      results.push({
        type:'guide',
        id:guide.id,
        icon:guide.emoji || '\u{1F4DA}',
        image:guide.image,
        imageFit:'cover',
        label:guide.title,
        sub:['Gu\u00EDa', guide.cat, guide.time, guide.level].filter(Boolean).join(metaSeparator),
        href:getGuidePath(guide),
        filterMeta:{ categories:['guias'] },
        searchScore,
      })
    }
  }

  for (const page of datasets.pages || []) {
    const searchScore = getSearchScore([
      { value:page.title, weight:6 },
      { value:page.desc, weight:4 },
      { value:page.section, weight:3 },
      { value:page.id, weight:2 },
    ])
    if (searchScore) {
      results.push({
        type:'page',
        id:page.id,
        icon:page.icon || '\u{1F50E}',
        label:page.title,
        sub:[page.section, page.desc].filter(Boolean).join(metaSeparator),
        href:page.href,
        filterMeta:{ categories:getPageCategoryKeys(page) },
        searchScore,
      })
    }
  }

  let assistantFocusFallback = false
  let eligibleResults = results
  if (assistantQuery?.active) {
    eligibleResults = results.filter(result => matchesLatidoAssistantResult(result, assistantQuery))
    if (!eligibleResults.length && ['home-trade', 'gardening'].includes(assistantQuery.scope?.focusKind)) {
      eligibleResults = results.filter(result => matchesLatidoAssistantResult(
        result,
        assistantQuery,
        { allowGeneralScopeFallback:true },
      ))
      assistantFocusFallback = eligibleResults.length > 0
    }
  }
  const rankedResults = []
  for (let index = 0; index < eligibleResults.length; index += 1) {
    rankedResults.push({ ...eligibleResults[index], searchIndex:index })
  }
  rankedResults.sort((a, b) => (
    (a.searchPriority ?? BUSINESS_SEARCH_PRIORITY.free) - (b.searchPriority ?? BUSINESS_SEARCH_PRIORITY.free) ||
    (b.searchScore || 0) - (a.searchScore || 0) ||
    a.searchIndex - b.searchIndex
  ))

  const cleanResults = []
  for (const { searchPriority, searchScore, searchIndex, ...result } of rankedResults) {
    const displayedMatchReason = assistantFocusFallback
      ? `${assistantQuery.scope?.fallbackLabel || 'Servicio relacionado'} (alternativa)`
      : matchReason
    const enrichedResult = {
      ...result,
      commercialPriority:searchPriority ?? BUSINESS_SEARCH_PRIORITY.free,
      searchRelevance:searchScore || 0,
    }
    cleanResults.push(displayedMatchReason
      ? { ...enrichedResult, matchReason:displayedMatchReason }
      : enrichedResult)
  }
  return cleanResults
}

export default function GlobalSearch({
  size = 'lg',
  placeholder,
  onClose,
  value,
  onValueChange,
  resultTypes = null,
  analyticsScope = 'global',
  showResultsDropdown = true,
  searchFilters = EMPTY_SEARCH_FILTERS,
  onSearchFiltersChange,
  onResolvedResultsChange,
  filtersContent = null,
  endContent = null,
  assistantMode = false,
  assistantLabelColor = '#fff',
  immersive = false,
  searchEmoji = null,
  onFiltersRequest,
  filterCount = 0,
  clearOnClose = false,
  showImmersiveFilterButton = true,
}) {
  const { isLoggedIn, user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const overlayInputRef = useRef(null)
  const loadPromiseRef = useRef(null)
  const mountedRef = useRef(true)
  const accessLevelRef = useRef(getCacheKey(isLoggedIn))
  const blurCloseTimerRef = useRef(null)
  const assistantRequestRef = useRef(0)
  const assistantRpcUnavailableRef = useRef(false)
  const premiumRotationArmedRef = useRef(true)
  const searchAttemptRef = useRef({ key:'', id:'' })
  const trackedSearchAttemptsRef = useRef(new Set())

  const [datasets, setDatasets] = useState(() => getCachedSearchData(isLoggedIn) || EMPTY_DATASETS)
  const [dataReady, setDataReady] = useState(() => !!getCachedSearchData(isLoggedIn))
  const [loadingData, setLoadingData] = useState(false)
  const [internalQuery, setInternalQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [activeFilter, setActiveFilter] = useState(null)
  const [expandedResults, setExpandedResults] = useState(false)
  const [assistantRpc, setAssistantRpc] = useState({ status:'idle', datasets:null })
  const [premiumRotationOffset, setPremiumRotationOffset] = useState(0)
  const [startPartnerRotationOffset, setStartPartnerRotationOffset] = useState(0)
  const [immersiveOpen, setImmersiveOpen] = useState(false)
  const [immersiveView, setImmersiveView] = useState('start')
  const [immersiveSort, setImmersiveSort] = useState('relevance')
  const [immersiveLimit, setImmersiveLimit] = useState(FULL_SEARCH_PAGE_SIZE)
  const [immersiveFiltersOpen, setImmersiveFiltersOpen] = useState(false)
  const [immersiveResultFiltersOpen, setImmersiveResultFiltersOpen] = useState(false)
  const [dismissedIntentForQuery, setDismissedIntentForQuery] = useState(null)
  const [recentSearches, setRecentSearches] = useState([])
  const q = value === undefined ? internalQuery : String(value || '')
  const intentDismissed = dismissedIntentForQuery !== null
    && dismissedIntentForQuery === q.trim()
  const effectiveSearchFilters = intentDismissed
    ? { ...searchFilters, intent:'' }
    : searchFilters
  const searchFilterKey = `${effectiveSearchFilters.category || ''}|${effectiveSearchFilters.canton || ''}|${effectiveSearchFilters.location || ''}|${effectiveSearchFilters.intent || ''}`
  const setQ = useCallback(nextQuery => {
    setInternalQuery(nextQuery)
    onValueChange?.(nextQuery)
  }, [onValueChange])
  const resultTypesKey = Array.isArray(resultTypes) ? resultTypes.join('|') : ''
  const allowedResultTypes = useMemo(
    () => resultTypesKey ? new Set(resultTypesKey.split('|')) : null,
    [resultTypesKey]
  )
  const hasPageScope = !!allowedResultTypes

  const deferredQuery = useDeferredValue(q)
  const fallbackDatasets = useMemo(() => buildFallbackData(isLoggedIn), [isLoggedIn])
  const assistantQuery = useMemo(() => {
    if (!assistantMode) return null
    const parsed = parseLatidoAssistantQuery(deferredQuery)
    if (!parsed?.active || !effectiveSearchFilters.intent) return parsed

    const intentLabel = ['busca', 'compra'].includes(effectiveSearchFilters.intent)
      ? 'Solicitudes'
      : 'Ofertas'
    return {
      ...parsed,
      resultIntents:[effectiveSearchFilters.intent],
      criteria:[
        ...(parsed.criteria || []).filter(criterion => criterion.key !== 'result-intent'),
        { key:'result-intent', icon:'✓', label:intentLabel },
      ],
    }
  }, [assistantMode, deferredQuery, searchFilterKey])
  const accessLevel = getCacheKey(isLoggedIn)
  const searchDatasets = useMemo(
    () => assistantRpc.status === 'ready' && assistantRpc.datasets
      ? mergeSearchDatasets(assistantRpc.datasets, dataReady ? datasets : fallbackDatasets)
      : (dataReady ? datasets : fallbackDatasets),
    [assistantRpc.datasets, assistantRpc.status, dataReady, datasets, fallbackDatasets]
  )
  const results = useMemo(
    () => searchAll(
      deferredQuery,
      searchDatasets,
      isLoggedIn,
      hasActiveSearchFilters(effectiveSearchFilters),
      assistantQuery,
    ),
    [assistantQuery, deferredQuery, isLoggedIn, searchDatasets, searchFilterKey]
  )

  const searchFilteredResults = useMemo(
    () => results.filter(result => (
      (!allowedResultTypes || allowedResultTypes.has(result.type)) &&
      matchesSearchFilters(result, effectiveSearchFilters)
    )),
    [allowedResultTypes, results, searchFilterKey]
  )

  const availableTypes = useMemo(() => {
    const seen = new Set()
    const types = []
    for (const r of searchFilteredResults) {
      if (!seen.has(r.type)) { seen.add(r.type); types.push(r.type) }
    }
    return types
  }, [searchFilteredResults])

  const resultPool = useMemo(
    () => activeFilter ? searchFilteredResults.filter(r => r.type === activeFilter) : searchFilteredResults,
    [activeFilter, searchFilteredResults]
  )
  const partnerService = useMemo(
    () => getPartnerServiceMatch(deferredQuery),
    [deferredQuery]
  )
  const hasSearchFilters = hasActiveSearchFilters(effectiveSearchFilters)
  const showPartnerService = partnerService && !hasSearchFilters && (!allowedResultTypes || allowedResultTypes.has('business'))
  const premiumBusinessResults = useMemo(
    () => resultPool.filter(result => result.type === 'business' && result.partnerPlan === 'premium'),
    [resultPool]
  )
  const premiumPartnerEntries = useMemo(() => {
    const entries = []
    if (showPartnerService) {
      entries.push({
        type:'business',
        id:'suiza-en-espanol',
        label:'Suiza en Español',
        sub:partnerService?.label ? `${partnerService.label} · Atención en español` : 'Seguros, previsión y llegada a Suiza',
        image:'/partners/suiza-en-espanol/logo-see.webp',
        href:`/servicios-suiza${partnerService?.id ? `?service=${encodeURIComponent(partnerService.id)}` : ''}`,
        partnerPlan:'premium',
      })
    }
    entries.push(...premiumBusinessResults)
    return entries
  }, [partnerService, premiumBusinessResults, showPartnerService])
  const rotatedPremiumPartnerEntries = useMemo(
    () => rotateItems(premiumPartnerEntries, premiumRotationOffset),
    [premiumPartnerEntries, premiumRotationOffset]
  )
  const showPremiumPartnerList = premiumPartnerEntries.length > 1
  const visibleResultPool = useMemo(
    () => showPremiumPartnerList
      ? resultPool.filter(result => !(result.type === 'business' && result.partnerPlan === 'premium'))
      : resultPool,
    [resultPool, showPremiumPartnerList]
  )
  const filteredResults = useMemo(
    () => visibleResultPool.slice(0, expandedResults ? MAX_SEARCH_RESULTS : INITIAL_SEARCH_RESULTS),
    [expandedResults, visibleResultPool]
  )
  const displayedResultCount = filteredResults.length + (showPremiumPartnerList ? premiumBusinessResults.length : 0)
  const currentSearchProfile = useMemo(
    () => buildSearchProfile(assistantQuery?.active ? assistantQuery.semanticQuery : deferredQuery),
    [assistantQuery, deferredQuery]
  )
  const searchInterpretation = getSearchInterpretation(currentSearchProfile)
  const highlightTokens = currentSearchProfile.tokens
  const assistantCriteria = assistantQuery?.criteria || []
  const assistantLoading = assistantRpc.status === 'loading'
  const assistantMetadata = useMemo(() => assistantQuery?.active ? {
    intent:assistantQuery.scope?.id || 'unknown',
    category:assistantQuery.category || null,
    canton:assistantQuery.canton || null,
    municipality:assistantQuery.municipality || null,
    postal_code:assistantQuery.postalCode || null,
    price_min:assistantQuery.priceMin,
    price_max:assistantQuery.priceMax,
    rooms_min:assistantQuery.roomsMin,
    available_on:assistantQuery.dateFrom || null,
    spanish_required:assistantQuery.spanishRequired,
    german_level:assistantQuery.germanLevel || null,
    confidence:assistantQuery.confidence,
  } : null, [assistantQuery])
  const resolvedAnalyticsScope = assistantMode && !hasPageScope
    ? 'pregunta_latido'
    : analyticsScope
  const quickSearches = QUICK_SEARCHES[analyticsScope]
    || QUICK_SEARCHES[resolvedAnalyticsScope]
    || QUICK_SEARCHES.global
  const allPartnerEntries = useMemo(() => {
    const entries = []
    const seen = new Set()

    for (const business of datasets.businesses || []) {
      if (getBusinessSearchPlan(business) !== 'premium') continue
      const editorialPartner = getEditorialPremiumPartner(business)
      const partnerKey = editorialPartner?.id || String(business.id)
      if (seen.has(partnerKey)) continue
      seen.add(partnerKey)
      const businessType = getNegocioTypeMeta(business.type)
      entries.push({
        type:'business',
        id:business.id,
        label:business.name,
        sub:business.services?.slice(0, 3).join(' · ') || business.desc || 'Servicios para la comunidad',
        image:business.photoUrl,
        href:business.href || getBusinessPath(business),
        partnerPlan:'premium',
        servicesText:business.services?.join(' ') || '',
        description:business.desc || '',
        categoryText:[
          business.type,
          businessType?.label,
          ...(business.partnerCategories || []),
        ].filter(Boolean).join(' '),
        locationText:[business.city, business.canton].filter(Boolean).join(' '),
        aliasesText:editorialPartner?.aliases?.join(' ') || '',
      })
    }

    for (const partner of EDITORIAL_PREMIUM_PARTNERS) {
      if (seen.has(partner.id)) continue
      seen.add(partner.id)
      entries.push({
        type:'business',
        id:`editorial-${partner.id}`,
        label:partner.name,
        sub:partner.services.slice(0, 3).join(' · '),
        image:partner.image,
        href:partner.href,
        partnerPlan:'premium',
        servicesText:partner.services.join(' '),
        description:partner.description,
        categoryText:[
          partner.type,
          getNegocioTypeMeta(partner.type)?.label,
          ...partner.categories,
        ].filter(Boolean).join(' '),
        locationText:[partner.city, partner.canton].filter(Boolean).join(' '),
        aliasesText:partner.aliases.join(' '),
      })
    }

    return entries
  }, [datasets.businesses])
  const startPartnerEntries = useMemo(
    () => rotateItems(allPartnerEntries, startPartnerRotationOffset),
    [allPartnerEntries, startPartnerRotationOffset]
  )
  const matchingPartnerEntries = useMemo(() => {
    const query = deferredQuery.trim()
    if (!query) return []

    return allPartnerEntries
      .map((partner, index) => ({
        ...partner,
        partnerSearchScore:scorePartnerEntry(query, partner),
        partnerOrder:index,
      }))
      .filter(partner => partner.partnerSearchScore > 0)
      .sort((left, right) => (
        right.partnerSearchScore - left.partnerSearchScore
        || left.partnerOrder - right.partnerOrder
      ))
  }, [allPartnerEntries, deferredQuery])
  const liveSuggestions = useMemo(() => {
    const query = deferredQuery.trim()
    if (!query) return []

    const normalizedSeen = new Set()
    const suggestions = []
    const addSuggestion = (label, meta='') => {
      const cleanLabel = String(label || '').trim()
      const key = normalizeSearchText(cleanLabel)
      if (!key || normalizedSeen.has(key)) return
      normalizedSeen.add(key)
      suggestions.push({ label:cleanLabel, meta })
    }

    const resultIds = new Set(resultPool.map(result => `${result.type}:${result.id}`))
    const additionalPartnerCount = matchingPartnerEntries.filter(
      partner => !resultIds.has(`business:${partner.id}`)
    ).length
    const currentResultCount = resultPool.length + additionalPartnerCount
    if (currentResultCount > 0) {
      addSuggestion(
        query,
        searchInterpretation || `${currentResultCount} coincidencia${currentResultCount === 1 ? '' : 's'}`,
      )
    }

    getSuggestionCatalogMatches(query).forEach(suggestion => {
      addSuggestion(suggestion.label, suggestion.meta)
    })

    return suggestions.slice(0, 6)
  }, [
    deferredQuery,
    matchingPartnerEntries,
    resultPool,
    searchInterpretation,
  ])
  const immersiveResults = useMemo(
    () => sortImmersiveResults(resultPool, immersiveSort),
    [immersiveSort, resultPool]
  )
  const immersivePartnerEntries = useMemo(
    () => deferredQuery.trim() ? matchingPartnerEntries : startPartnerEntries,
    [deferredQuery, matchingPartnerEntries, startPartnerEntries]
  )
  const previewPartnerEntries = useMemo(
    () => immersivePartnerEntries.slice(0, 2),
    [immersivePartnerEntries]
  )
  const immersiveOrganicResults = useMemo(() => {
    if (!immersivePartnerEntries.length) return immersiveResults

    const partnerIds = new Set(immersivePartnerEntries.map(partner => String(partner.id)))
    return immersiveResults.filter(result => !(
      result.type === 'business'
      && result.partnerPlan === 'premium'
      && partnerIds.has(String(result.id))
    ))
  }, [immersivePartnerEntries, immersiveResults])
  const visibleImmersiveResults = useMemo(
    () => immersiveOrganicResults.slice(0, immersiveLimit),
    [immersiveLimit, immersiveOrganicResults]
  )
  const immersiveResultCount = immersivePartnerEntries.length + immersiveOrganicResults.length
  const blockingSearchLoad = (
    (loadingData && !dataReady)
    || assistantLoading
  ) && immersiveResultCount === 0
  useEffect(() => {
    if (!immersiveOpen || deferredQuery.trim().length < 2) return undefined

    const destinations = [
      ...previewPartnerEntries,
      ...immersiveOrganicResults.slice(0, 8),
    ]
    const timer = window.setTimeout(() => {
      destinations.forEach(prefetchSearchDestination)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [deferredQuery, immersiveOpen, immersiveOrganicResults, previewPartnerEntries])
  const recoverySuggestions = liveSuggestions
    .filter(suggestion => normalizeSearchText(suggestion.label) !== normalizeSearchText(q))
    .slice(0, 3)
  const appliedSearchChips = [
    effectiveSearchFilters.category && {
      key:'category',
      label:AD_CATS.find(category => category.id === effectiveSearchFilters.category)?.label
        || getNegocioTypeMeta(effectiveSearchFilters.category)?.label
        || effectiveSearchFilters.category,
    },
    (effectiveSearchFilters.canton || effectiveSearchFilters.location) && {
      key:effectiveSearchFilters.canton ? 'canton' : 'location',
      label:CANTONS.find(canton => canton.code === effectiveSearchFilters.canton)?.name
        || effectiveSearchFilters.location
        || effectiveSearchFilters.canton,
    },
    effectiveSearchFilters.intent && {
      key:'intent',
      label:['busca', 'compra'].includes(effectiveSearchFilters.intent) ? 'Solicitudes' : 'Ofertas',
    },
  ].filter(Boolean)
  const showingRelatedAlternatives = resultPool.length > 0
    && resultPool.every(result => String(result.matchReason || '').includes('(alternativa)'))

  const getSearchAttemptId = useCallback(query => {
    const attemptKey = [
      String(query || '').trim().toLowerCase(),
      resolvedAnalyticsScope,
      searchFilterKey,
      activeFilter || '',
    ].join('|')

    if (searchAttemptRef.current.key !== attemptKey) {
      searchAttemptRef.current = {
        key:attemptKey,
        id:createSearchAttemptId(),
      }
    }
    return searchAttemptRef.current.id
  }, [activeFilter, resolvedAnalyticsScope, searchFilterKey])

  const trackCurrentSearch = useCallback((query, searchAttemptId) => {
    if (!searchAttemptId || trackedSearchAttemptsRef.current.has(searchAttemptId)) return
    trackedSearchAttemptsRef.current.add(searchAttemptId)

    trackSearchEvent({
      query,
      scope:resolvedAnalyticsScope,
      user_id:user?.id || null,
      metadata:{
        search_attempt_id:searchAttemptId,
        results_count:resultPool.length,
        active_filter:activeFilter || null,
        search_filters:effectiveSearchFilters,
        assistant:assistantMetadata,
      },
    })

    if (assistantMode && assistantMetadata) {
      trackAnalyticsEvent(resultPool.length ? 'natural_search' : 'natural_search_no_results', {
        user_id:user?.id || null,
        metadata:{
          search_attempt_id:searchAttemptId,
          query:query.slice(0, 120),
          result_count:resultPool.length,
          ...assistantMetadata,
        },
      })
    }
  }, [activeFilter, assistantMetadata, assistantMode, effectiveSearchFilters, resolvedAnalyticsScope, resultPool.length, user?.id])

  const ph = placeholder || (size === 'lg'
    ? (assistantMode ? 'Ej.: piso en Zürich hasta 3.000 CHF' : 'Encuentra lo que buscas')
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
              .or('active.is.null,active.eq.true')
              .order('created_at', { ascending:false })

            if (!isLoggedIn) query = query.eq('privacy', 'public')
            return query
          }),
          fetchAllRows(() => supabase.from('jobs').select(SEARCH_SELECTS.jobs).or('active.is.null,active.eq.true').order('created_at', { ascending:false })),
          fetchAllRows(() => supabase.from('communities').select(SEARCH_SELECTS.communities).or('active.is.null,active.eq.true').order('members', { ascending:false })),
          fetchAllRows(() => supabase
            .from('providers')
            .select(SEARCH_SELECTS.providers)
            .or('active.is.null,active.eq.true')
            .order('featured', { ascending:false })
            .order('verified', { ascending:false })
            .order('created_at', { ascending:false })),
          fetchAllRows(() => supabase
            .from('events')
            .select(SEARCH_SELECTS.events)
            .or('active.is.null,active.eq.true')
            .order('featured', { ascending:false })
            .order('created_at', { ascending:false })),
        ])

        const nextDatasets = {
          ads: adsRes.error || !adsRes.data?.length ? fallbackDatasets.ads : adsRes.data.map(normalizeAd).filter(item => item.open),
          jobs: jobsRes.error || !jobsRes.data?.length ? fallbackDatasets.jobs : jobsRes.data.map(normalizeJob).filter(item => item.open),
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

  useEffect(() => {
    const requestId = assistantRequestRef.current + 1
    assistantRequestRef.current = requestId
    let cancelled = false

    if (
      !assistantMode ||
      !assistantQuery?.active ||
      (!assistantQuery.scope && !assistantQuery.searchTerms.length) ||
      assistantRpcUnavailableRef.current
    ) {
      setAssistantRpc({ status:'idle', datasets:null })
      return undefined
    }

    setAssistantRpc(current => ({ status:'loading', datasets:current.datasets }))
    const timer = window.setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc(
          'search_latido',
          buildLatidoSearchRpcParams(assistantQuery)
        )
        if (cancelled || requestId !== assistantRequestRef.current) return
        if (error) {
          if (['42883', 'PGRST202', 'PGRST205'].includes(error.code)) {
            assistantRpcUnavailableRef.current = true
          }
          setAssistantRpc({ status:'fallback', datasets:null })
          return
        }

        setAssistantRpc({
          status:'ready',
          datasets:buildRpcDatasets(data, fallbackDatasets),
        })
      } catch {
        if (!cancelled && requestId === assistantRequestRef.current) {
          setAssistantRpc({ status:'fallback', datasets:null })
        }
      }
    }, 260)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [assistantMode, assistantQuery, fallbackDatasets])

  const cancelBlurClose = useCallback(() => {
    if (!blurCloseTimerRef.current) return
    window.clearTimeout(blurCloseTimerRef.current)
    blurCloseTimerRef.current = null
  }, [])

  const dismissImmersiveKeyboard = useCallback(event => {
    const input = overlayInputRef.current
    if (!input || document.activeElement !== input) return
    if (
      event?.type === 'pointerdown'
      && event.target?.closest?.('.latido-search-experience__form')
    ) return

    input.blur()
  }, [])

  const closeImmersive = useCallback(() => {
    setImmersiveOpen(false)
    setImmersiveFiltersOpen(false)
    setFocused(false)
    setActiveIdx(-1)
    if (clearOnClose) setQ('')
    onClose?.()
  }, [clearOnClose, onClose, setQ])

  const handleFocus = useCallback(() => {
    cancelBlurClose()
    setFocused(true)
    ensureDataLoaded()
    if (immersive) {
      if (!immersiveOpen && allPartnerEntries.length > 1) {
        setStartPartnerRotationOffset(
          takeNextRotationOffset('global-search-start-partners', allPartnerEntries.length)
        )
      }
      setRecentSearches(readRecentSearches(analyticsScope))
      setImmersiveView(q.trim().length > 0 ? 'preview' : 'start')
      setImmersiveLimit(FULL_SEARCH_PAGE_SIZE)
      setImmersiveFiltersOpen(false)
      setImmersiveOpen(true)
    }
  }, [
    allPartnerEntries.length,
    analyticsScope,
    cancelBlurClose,
    ensureDataLoaded,
    immersive,
    immersiveOpen,
    q,
  ])

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
    setImmersiveView('start')
    setImmersiveLimit(FULL_SEARCH_PAGE_SIZE)
    setImmersiveFiltersOpen(false)
    ;(immersiveOpen ? overlayInputRef : inputRef).current?.focus()
  }, [cancelBlurClose, immersiveOpen, setQ])

  useEffect(() => {
    if (!immersiveOpen) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => {
      overlayInputRef.current?.focus()
      const valueLength = overlayInputRef.current?.value?.length || 0
      overlayInputRef.current?.setSelectionRange(valueLength, valueLength)
    }, 40)

    return () => {
      window.clearTimeout(focusTimer)
      document.body.style.overflow = previousOverflow
    }
  }, [immersiveOpen])

  useEffect(() => {
    setActiveFilter(null)
    setActiveIdx(-1)
    setExpandedResults(false)
  }, [searchFilterKey])

  useEffect(() => {
    if (q.trim().length < 2) {
      searchAttemptRef.current = { key:'', id:'' }
    }
  }, [q])

  useEffect(() => {
    if (focused || deferredQuery.trim().length >= 2) {
      ensureDataLoaded()
    }
  }, [deferredQuery, ensureDataLoaded, focused])

  useEffect(() => {
    setActiveIdx(-1)
    setActiveFilter(null)
    setExpandedResults(false)
  }, [deferredQuery, searchFilterKey])

  useEffect(() => {
    if (!onResolvedResultsChange) return

    const normalizedQuery = deferredQuery.trim()
    const active = normalizedQuery.length >= 2 || hasSearchFilters
    onResolvedResultsChange({
      active,
      ready:dataReady || assistantRpc.status === 'ready',
      loading:loadingData || assistantLoading,
      query:normalizedQuery,
      results:active ? resultPool : [],
      assistant:assistantMetadata,
    })
  }, [
    assistantLoading,
    assistantMetadata,
    assistantRpc.status,
    dataReady,
    deferredQuery,
    hasSearchFilters,
    loadingData,
    onResolvedResultsChange,
    resultPool,
  ])

  useEffect(() => {
    if (isAdmin) return undefined

    const query = q.trim()
    if (query.length < 2) return undefined

    const timer = window.setTimeout(() => {
      const searchAttemptId = getSearchAttemptId(query)
      trackCurrentSearch(query, searchAttemptId)
    }, 900)

    return () => window.clearTimeout(timer)
  }, [getSearchAttemptId, isAdmin, q, trackCurrentSearch])

  const saveCurrentSearch = useCallback((query=q.trim()) => {
    if (query.length < 2) return
    const next = rememberRecentSearch({
      query,
      scope:analyticsScope,
      category:effectiveSearchFilters.category,
      canton:effectiveSearchFilters.canton || effectiveSearchFilters.location,
      intent:effectiveSearchFilters.intent,
    })
    setRecentSearches(next)
  }, [analyticsScope, effectiveSearchFilters, q])

  const showAllResults = useCallback((query=q.trim()) => {
    if (query.length < 2 && !hasSearchFilters) return
    saveCurrentSearch(query)
    setImmersiveView('results')
    setImmersiveLimit(FULL_SEARCH_PAGE_SIZE)
    setImmersiveFiltersOpen(false)
    setImmersiveResultFiltersOpen(false)
    setActiveIdx(-1)
  }, [hasSearchFilters, q, saveCurrentSearch])

  const selectSearchSuggestion = useCallback((query, showResults=false) => {
    const nextQuery = String(query || '').trim()
    setQ(nextQuery)
    setActiveIdx(-1)
    setImmersiveLimit(FULL_SEARCH_PAGE_SIZE)
    if (showResults) {
      saveCurrentSearch(nextQuery)
      setImmersiveView('results')
      setImmersiveResultFiltersOpen(false)
    } else {
      setImmersiveView(nextQuery.length > 0 ? 'preview' : 'start')
      window.setTimeout(() => overlayInputRef.current?.focus(), 0)
    }
  }, [saveCurrentSearch, setQ])

  const goTo = target => {
    const result = typeof target === 'string' ? null : target
    const href = result?.href || target
    const query = q.trim()

    if (result && query.length >= 2) {
      saveCurrentSearch(query)
      const searchAttemptId = getSearchAttemptId(query)
      if (!isAdmin) {
        trackCurrentSearch(query, searchAttemptId)
        trackAnalyticsEvent('search_result_open', {
          user_id: user?.id || null,
          metadata: {
            search_attempt_id: searchAttemptId,
            query: query.slice(0, 120),
            result_type: result.type || '',
            result_id: result.id || '',
            result_label: result.label || '',
            search_filters:effectiveSearchFilters,
            href,
          },
        })
      }

      rememberSearchResultForResolution({
        search_attempt_id:searchAttemptId,
        query,
        result_id:result.id || '',
        result_type:result.type || '',
        result_label:result.label || '',
        result_href:href,
        source_path:`${window.location.pathname}${window.location.search}`,
      })
    }

    if (/^https?:\/\//i.test(href)) {
      window.open(href, '_blank', 'noopener,noreferrer')
    } else {
      navigate(href)
    }
    cancelBlurClose()
    setQ('')
    setFocused(false)
    setImmersiveOpen(false)
    onClose?.()
  }

  const handleKey = e => {
    if (e.key === 'ArrowDown') {
      if (!filteredResults.length) return
      e.preventDefault()
      setActiveIdx(idx => Math.min(idx + 1, filteredResults.length - 1))
    }

    if (e.key === 'ArrowUp') {
      if (!filteredResults.length) return
      e.preventDefault()
      setActiveIdx(idx => Math.max(idx - 1, 0))
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIdx >= 0 && filteredResults[activeIdx]) goTo(filteredResults[activeIdx])
      else showAllResults()
    }

    if (e.key === 'Escape') {
      cancelBlurClose()
      if (immersiveOpen) closeImmersive()
      else {
        setQ('')
        setFocused(false)
        onClose?.()
      }
    }
  }

  const showDropdown = !immersiveOpen && showResultsDropdown && focused && (q.length >= 2 || hasSearchFilters)

  const removeSearchFilter = key => {
    onSearchFiltersChange?.({ ...searchFilters, [key]:'' })
  }

  const removeAssistantCriterion = criterionKey => {
    let nextQuery = q
    if (criterionKey === 'result-intent') {
      setDismissedIntentForQuery(q.trim())
      if (searchFilters.intent) removeSearchFilter('intent')
      nextQuery = nextQuery.replace(/\b(busco|buscando|necesito|quiero|compro|ofrezco|ofrecemos|vendo|regalo|procuro|preciso|ofereço|ofereco)\b/gi, ' ')
    } else if (criterionKey === 'location') {
      const places = [assistantQuery?.municipality, assistantQuery?.canton].filter(Boolean)
      places.forEach(place => {
        nextQuery = nextQuery.replace(new RegExp(escapeSearchRegExp(place), 'gi'), ' ')
      })
    } else if (criterionKey === 'postal') {
      nextQuery = nextQuery.replace(new RegExp(`\\b${escapeSearchRegExp(assistantQuery?.postalCode || '')}\\b`, 'g'), ' ')
    } else if (criterionKey.startsWith('price')) {
      nextQuery = nextQuery
        .replace(/\b(?:hasta|max(?:imo)?|desde|min(?:imo)?|entre)?\s*(?:chf|francos?)?\s*\d[\d.'’ ]*(?:,\d+)?\s*(?:chf|francos?)?\b/gi, ' ')
        .replace(/\b(?:chf|francos?)\b/gi, ' ')
    } else if (criterionKey === 'rooms') {
      nextQuery = nextQuery.replace(/\b\d+(?:[.,]\d+)?\s*(?:hab(?:itaciones?)?|cuartos?|zimmer)\b/gi, ' ')
    } else if (criterionKey === 'spanish') {
      nextQuery = nextQuery.replace(/\b(?:en|que\s+hable)?\s*(?:espanol|español|castellano|spanish)\b/gi, ' ')
    } else if (criterionKey === 'german') {
      nextQuery = nextQuery.replace(/\b(?:sin|con)?\s*(?:aleman|alemán|deutsch)(?:\s*[abc][12])?\b/gi, ' ')
    } else if (criterionKey === 'date') {
      nextQuery = nextQuery.replace(/\b(?:hoy|manana|mañana|esta semana|este mes|desde ahora)\b/gi, ' ')
    }

    const cleaned = nextQuery.trim().replace(/\s+/g, ' ')
    setQ(cleaned)
    setImmersiveView(cleaned.length > 0 ? 'preview' : 'start')
    setImmersiveLimit(FULL_SEARCH_PAGE_SIZE)
  }

  const handleImmersiveFilters = () => {
    if (filtersContent) {
      setImmersiveFiltersOpen(open => !open)
      return
    }
    if (onFiltersRequest && endContent) {
      onFiltersRequest()
      setImmersiveFiltersOpen(true)
      return
    }
    closeImmersive()
    window.setTimeout(() => onFiltersRequest?.(), 0)
  }

  useEffect(() => {
    const hasSearchPrompt = q.trim().length >= 2 || hasSearchFilters
    if (!showDropdown || !hasSearchPrompt) {
      premiumRotationArmedRef.current = true
      return
    }
    if (!showPremiumPartnerList || !premiumRotationArmedRef.current) return

    premiumRotationArmedRef.current = false
    setPremiumRotationOffset(takeNextRotationOffset('global-search-premium', premiumPartnerEntries.length))
  }, [hasSearchFilters, premiumPartnerEntries.length, q, showDropdown, showPremiumPartnerList])

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
        boxShadow: focused ? `0 0 0 2px ${C.primaryLight}, 0 4px 14px rgba(15,23,42,0.08)` : '0 2px 12px rgba(0,0,0,0.06)',
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
    <>
    <div style={{ position:'relative', width:'100%', zIndex:showDropdown ? 80 : 1 }}>
      {/* {assistantMode && size === 'lg' && (
        <div style={{ display:'flex', alignItems:'baseline', flexWrap:'wrap', gap:'3px 8px', margin:'0 2px 8px', color:assistantLabelColor, fontFamily:PP }}>
          <span style={{ fontSize:13, fontWeight:400 }}>✨ Dile lo que necesitas a Latido</span>
        </div>
      )} */}
      <div
        onFocusCapture={!immersive && endContent ? handleFocus : undefined}
        style={{ display:endContent ? 'flex' : 'block', alignItems:'center', gap:endContent ? 8 : 0 }}
      >
        <div style={{ position:'relative', flex:endContent ? 1 : undefined, minWidth:0 }}>
          <span aria-hidden="true" style={{ position:'absolute', left:size === 'lg' ? 16 : 12, top:'50%', transform:'translateY(-50%)', display:'flex', alignItems:'center', fontSize:size === 'lg' ? 20 : 16, lineHeight:1, color:focused ? C.primary : C.light, transition:'color .15s', pointerEvents:'none' }}>
            {searchEmoji || <SearchGlyph size={size === 'lg' ? 21 : 17} />}
          </span>
          <input
            ref={inputRef}
            style={inputStyle}
            placeholder={ph}
            value={q}
            onChange={e => setQ(e.target.value)}
            onFocus={handleFocus}
            onBlur={immersive ? undefined : handleBlur}
            onKeyDown={handleKey}
            autoComplete="off"
            aria-label={assistantMode && !hasPageScope
              ? 'Pregunta a Latido'
              : (hasPageScope ? 'Buscar en esta sección' : 'Buscar en Latido')}
          />
          {q && (
            <button onMouseDown={e => e.preventDefault()} onClick={clearSearch} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:C.border, border:'none', borderRadius:'50%', width:20, height:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:C.mid }}>
              ✕
            </button>
          )}
        </div>
        {endContent}
      </div>

      {filtersContent && !immersiveOpen && (
        <div onFocusCapture={!immersive ? handleFocus : undefined}>
          {filtersContent}
        </div>
      )}

      {showDropdown && (
        <div className="fade-up" onMouseDown={e => e.preventDefault()} style={{ position:'absolute', top:'100%', left:0, right:0, marginTop:10, background:'#fff', borderRadius:20, boxShadow:'0 18px 48px rgba(15,23,42,0.18)', border:`1px solid ${C.border}`, zIndex:200, overflow:'hidden', maxHeight:'min(420px, 62vh)', overflowY:'auto' }}>
          {assistantMode && assistantQuery?.active ? (
            <div style={{ padding:'11px 14px', background:'linear-gradient(135deg, #EFF6FF 0%, #F8FAFF 100%)', borderBottom:`1px solid ${C.borderLight}` }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginBottom:8 }}>
                <p style={{ fontFamily:PP, fontSize:10, fontWeight:900, letterSpacing:0.7, textTransform:'uppercase', color:C.primary, margin:0 }}>
                  {assistantCriteria.length ? 'Latido ha entendido' : 'Cuéntame un poco más'}
                </p>
                <span style={{ fontFamily:PP, fontSize:9.5, fontWeight:700, color:C.light }}>
                  {assistantLoading
                    ? 'Consultando la base de datos…'
                    : assistantCriteria.length
                      ? `${resultPool.length} coincidencia${resultPool.length !== 1 ? 's' : ''}`
                      : 'Escribe una necesidad concreta'}
                </span>
              </div>
              {assistantCriteria.length > 0 ? (
                <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                  {assistantCriteria.map(criterion => (
                    <span key={criterion.key} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 8px', borderRadius:999, border:'1px solid #BFDBFE', background:'#fff', fontFamily:PP, fontSize:9.5, fontWeight:750, color:'#1E3A8A' }}>
                      <span aria-hidden="true" style={{ fontSize:10, fontWeight:900 }}>{criterion.icon}</span>
                      {criterion.label}
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                  {['Busco piso', 'Busco trabajo', 'Necesito una traducción', 'Busco un evento'].map(suggestion => (
                    <button key={suggestion} type="button" onClick={() => { setQ(suggestion); inputRef.current?.focus() }} style={{ border:'1px solid #BFDBFE', borderRadius:999, background:'#fff', color:'#1E3A8A', padding:'5px 8px', fontFamily:PP, fontSize:9.5, fontWeight:750, cursor:'pointer' }}>
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
              {assistantQuery?.missingFields?.length > 0 && (
                <p style={{ fontFamily:PP, fontSize:9.5, color:C.mid, margin:'7px 0 0' }}>
                  Para afinar más, añade {assistantQuery.missingFields.join(' y ')}.
                </p>
              )}
            </div>
          ) : searchInterpretation && (
            <div style={{ padding:'10px 16px', background:'#F5F8FF', borderBottom:`1px solid ${C.borderLight}`, fontFamily:PP, fontSize:11, color:C.mid }}>
              Interpretamos <strong style={{ color:C.text }}>“{q.trim()}”</strong> como{' '}
              <strong style={{ color:C.primary }}>{searchInterpretation}</strong>
            </div>
          )}
          {filteredResults.length === 0 && !showPremiumPartnerList ? (
            <div style={{ padding:'20px 18px', textAlign:'center' }}>
              {(loadingData && !dataReady) || assistantLoading ? (
                <>
                  <p style={{ fontFamily:PP, fontSize:13, color:C.text, fontWeight:700, margin:'0 0 6px' }}>Buscando en Latido...</p>
                  <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>
                    {hasPageScope ? 'Consultando el contenido de esta sección.' : 'Consultando publicaciones, empleos, negocios y eventos.'}
                  </p>
                </>
              ) : (
                <>
                  <p style={{ fontFamily:PP, fontSize:13, color:C.light, margin:0 }}>
                    {assistantMode
                      ? (assistantQuery?.scope ? 'No encontré resultados que cumplan todos los criterios' : 'Elige una necesidad para empezar')
                      : 'Sin resultados para'}{' '}
                    {!assistantMode && <strong style={{ color:C.text }}>{q || 'los filtros seleccionados'}</strong>}
                  </p>
                  <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:'6px 0 0' }}>
                    {assistantMode && !assistantQuery?.scope ? (
                      <>Puedes usar una de las opciones sugeridas arriba o escribir más detalles.</>
                    ) : assistantMode ? (
                      <>
                        Prueba a ampliar la ubicación o el presupuesto, o{' '}
                        <button onClick={clearSearch} style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:C.primary, background:'none', border:'none', cursor:'pointer', padding:0 }}>
                          haz otra pregunta
                        </button>
                      </>
                    ) : hasSearchFilters ? (
                      <button onClick={() => onSearchFiltersChange?.({ category:'', canton:'', location:'', intent:'' })} style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:C.primary, background:'none', border:'none', cursor:'pointer', padding:0 }}>
                        {hasPageScope ? 'Quitar los filtros de esta sección' : 'Quitar los filtros y buscar en todo Latido'}
                      </button>
                    ) : (
                      <>
                        Prueba con otras palabras o{' '}
                        <button onClick={() => goTo('/')} style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:C.primary, background:'none', border:'none', cursor:'pointer', padding:0 }}>
                          explora Latido
                        </button>
                      </>
                    )}
                  </p>
                  {showPartnerService && (
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
              {showPremiumPartnerList ? (
                <PremiumPartnerSearchList
                  partners={rotatedPremiumPartnerEntries}
                  onOpen={goTo}
                  highlightTokens={highlightTokens}
                />
              ) : showPartnerService && (
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
                            <img src={getThumbnailImageUrl(result.image)} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" style={{ width:'100%', height:'100%', objectFit:result.imageFit || 'contain', display:'block', background:'#fff' }} />
                          ) : result.icon}
                        </span>
                        <div style={{ minWidth:0 }}>
                          <p style={{ fontFamily:PP, fontSize:10, fontWeight:800, letterSpacing:1.2, color:C.primary, margin:'0 0 6px', textTransform:'uppercase' }}>
                            Colaborador recomendado
                          </p>
                          <p style={{ fontFamily:PP, fontWeight:800, fontSize:14, color:C.text, margin:'0 0 5px', lineHeight:1.25, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                            <HighlightSearchText text={result.label} tokens={highlightTokens} />
                          </p>
                          <p style={{ fontFamily:PP, fontSize:11, color:C.mid, margin:0, lineHeight:1.45, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                            <HighlightSearchText text={result.sub} tokens={highlightTokens} />
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
                        <img src={getThumbnailImageUrl(result.image)} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" style={{ width:'100%', height:'100%', objectFit:result.imageFit || 'cover', display:'block', background:'#fff' }} />
                      ) : result.icon}
                    </span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10, marginBottom:3 }}>
                        <p style={{ fontFamily:PP, fontWeight:700, fontSize:14, color:C.text, margin:0, lineHeight:1.3, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}><HighlightSearchText text={result.label} tokens={highlightTokens} /></p>
                        <span style={{ fontFamily:PP, fontSize:10, fontWeight:700, background:color.bg, color:color.color, padding:'4px 8px', borderRadius:999, flexShrink:0, whiteSpace:'nowrap' }}>{color.label}</span>
                      </div>
                      {result.matchReason && (
                        <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.primary, margin:'0 0 2px', lineHeight:1.35 }}>
                          Coincide por: {result.matchReason}
                        </p>
                      )}
                      <p style={{ fontFamily:PP, fontSize:11, color:C.mid, margin:0, lineHeight:1.45, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}><HighlightSearchText text={result.sub} tokens={highlightTokens} /></p>
                    </div>
                    {result.privacy === 'private' && <span style={{ fontSize:12, marginTop:6, flexShrink:0 }}>🔒</span>}
                  </div>
                )
              })}
              <div style={{ borderTop:`1px solid ${C.border}`, background:'#FCFDFF', position:'sticky', bottom:0 }}>
                {!filtersContent && availableTypes.length > 1 && (
                  <div style={{ padding:'8px 16px', display:'flex', gap:6, flexWrap:'wrap', borderBottom:`1px solid ${C.borderLight}` }}>
                    {availableTypes.map(type => {
                      const color = TYPE_COLORS[type] || TYPE_COLORS.ad
                      const isActive = activeFilter === type
                      return (
                        <button
                          key={type}
                          onClick={() => {
                            setActiveFilter(isActive ? null : type)
                            setActiveIdx(-1)
                          }}
                          style={{ fontFamily:PP, fontSize:10, fontWeight:700, padding:'4px 10px', borderRadius:999, border:`1.5px solid ${isActive ? color.color : C.border}`, background: isActive ? color.bg : '#fff', color: isActive ? color.color : C.text, cursor:'pointer', transition:'all .15s' }}
                        >
                          {color.label}
                        </button>
                      )
                    })}
                  </div>
                )}
                <div style={{ padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
                  <span style={{ fontFamily:PP, fontSize:10, color:C.light }}>
                    {resultPool.length > displayedResultCount
                      ? `Mostrando ${displayedResultCount} de ${resultPool.length} resultados`
                      : `${resultPool.length} resultado${resultPool.length !== 1 ? 's' : ''} ${hasPageScope ? 'en esta sección' : 'en Latido'}`}
                  </span>
                  {!expandedResults && visibleResultPool.length > filteredResults.length ? (
                    <button type="button" onClick={() => { setExpandedResults(true); setActiveIdx(-1) }} style={{ fontFamily:PP, fontWeight:800, fontSize:10, color:C.primary, background:'none', border:'none', padding:0, cursor:'pointer' }}>
                      Ver más
                    </button>
                  ) : expandedResults && visibleResultPool.length > INITIAL_SEARCH_RESULTS ? (
                    <button type="button" onClick={() => { setExpandedResults(false); setActiveIdx(-1) }} style={{ fontFamily:PP, fontWeight:800, fontSize:10, color:C.primary, background:'none', border:'none', padding:0, cursor:'pointer' }}>
                      Ver menos
                    </button>
                  ) : activeFilter ? (
                    <button type="button" onClick={() => { setActiveFilter(null); setActiveIdx(-1) }} style={{ fontFamily:PP, fontWeight:700, fontSize:10, color:C.primary, background:'none', border:'none', padding:0, cursor:'pointer' }}>
                      Mostrar todos
                    </button>
                  ) : null}
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
    {immersiveOpen && typeof document !== 'undefined' && createPortal(
      <div
        className="latido-search-experience"
        role="dialog"
        aria-modal="true"
        aria-label="Buscar en Latido"
        onPointerDownCapture={dismissImmersiveKeyboard}
        onTouchMoveCapture={dismissImmersiveKeyboard}
        onScrollCapture={dismissImmersiveKeyboard}
      >
        <div className="latido-search-experience__shell">
          <header className="latido-search-experience__header">
            <button
              type="button"
              className="latido-search-experience__back"
              onClick={() => {
                if (immersiveView === 'results') {
                  setImmersiveView(q.trim().length > 0 ? 'preview' : 'start')
                  window.setTimeout(() => overlayInputRef.current?.focus(), 0)
                } else {
                  closeImmersive()
                }
              }}
              aria-label={immersiveView === 'results' ? 'Volver a las sugerencias' : 'Cerrar búsqueda'}
            >
              <BackGlyph />
            </button>

            <form
              className="latido-search-experience__form"
              onSubmit={event => {
                event.preventDefault()
                showAllResults()
              }}
            >
              {searchEmoji
                ? <span aria-hidden="true" style={{ fontSize:20, lineHeight:1 }}>{searchEmoji}</span>
                : <SearchGlyph size={22} />}
              <input
                ref={overlayInputRef}
                value={q}
                onChange={event => {
                  const nextQuery = event.target.value
                  setQ(nextQuery)
                  setActiveIdx(-1)
                  setImmersiveLimit(FULL_SEARCH_PAGE_SIZE)
                  setImmersiveView(nextQuery.trim().length > 0 ? 'preview' : 'start')
                }}
                onKeyDown={handleKey}
                placeholder={ph}
                autoComplete="off"
                enterKeyHint="search"
                aria-label="Buscar en Latido"
              />
              {q && (
                <button type="button" className="latido-search-experience__clear" onClick={clearSearch} aria-label="Borrar búsqueda">
                  <CloseGlyph />
                </button>
              )}
            </form>

            {showImmersiveFilterButton && (filtersContent || onFiltersRequest || endContent) && (
              <button
                type="button"
                className={`latido-search-experience__filter${filterCount ? ' is-active' : ''}`}
                onClick={handleImmersiveFilters}
                aria-label={`Filtros${filterCount ? `, ${filterCount} activos` : ''}`}
                aria-expanded={filtersContent ? immersiveFiltersOpen : undefined}
              >
                <FilterIcon size={19} />
                {filterCount > 0 && <strong>{filterCount}</strong>}
              </button>
            )}
          </header>

          {immersiveFiltersOpen && filtersContent && (
            <div className="latido-search-experience__inline-filters">
              {filtersContent}
            </div>
          )}

          <main className="latido-search-experience__content">
            {immersiveView === 'start' ? (
              <div className="latido-search-start">
                {startPartnerEntries.length > 0 && (
                  <section className="latido-search-section" aria-labelledby="search-partners-title">
                    <div className="latido-search-section__heading">
                      <div>
                        <h2 id="search-partners-title">Partners de Latido</h2>
                        <p>Servicios verificados para ayudarte en Suiza.</p>
                      </div>
                    </div>
                    <PremiumPartnerSearchList
                      partners={startPartnerEntries}
                      onOpen={goTo}
                      highlightTokens={[]}
                      horizontal
                    />
                  </section>
                )}

                {recentSearches.length > 0 && (
                  <section className="latido-search-section" aria-labelledby="recent-searches-title">
                    <div className="latido-search-section__heading">
                      <h2 id="recent-searches-title">Búsquedas recientes</h2>
                      <button
                        type="button"
                        onClick={() => {
                          clearRecentSearches()
                          setRecentSearches([])
                        }}
                      >
                        Borrar todo
                      </button>
                    </div>
                    <div className="latido-search-history">
                      {recentSearches.map(entry => (
                        <div className="latido-search-history__row" key={`${entry.query}-${entry.createdAt}`}>
                          <button type="button" className="latido-search-history__open" onClick={() => selectSearchSuggestion(entry.query, true)}>
                            <HistoryGlyph />
                            <span>{entry.query}</span>
                          </button>
                          <button
                            type="button"
                            className="latido-search-history__remove"
                            aria-label={`Quitar ${entry.query} del historial`}
                            onClick={() => setRecentSearches(removeRecentSearch(entry.query))}
                          >
                            <CloseGlyph size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section className="latido-search-section" aria-labelledby="quick-searches-title">
                  <div className="latido-search-section__heading">
                    <div>
                      <h2 id="quick-searches-title">Explora rápidamente</h2>
                      <p>Sugerencias habituales en esta sección.</p>
                    </div>
                  </div>
                  <div className="latido-search-quick">
                    {quickSearches.map(suggestion => (
                      <button key={suggestion} type="button" onClick={() => selectSearchSuggestion(suggestion)}>
                        <SearchGlyph size={17} />
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            ) : immersiveView === 'preview' ? (
              <div className="latido-search-preview">
                {assistantCriteria.length > 0 && (
                  <section className="latido-search-understood" aria-label="Interpretación de la búsqueda">
                    <div>
                      <strong>Latido ha entendido</strong>
                      <span>{assistantLoading ? 'Buscando…' : `${resultPool.length} coincidencia${resultPool.length === 1 ? '' : 's'}`}</span>
                    </div>
                    <div className="latido-search-chips">
                      {assistantCriteria.map(criterion => (
                        <button
                          key={criterion.key}
                          type="button"
                          className={criterion.key === 'scope' ? 'is-static' : ''}
                          onClick={criterion.key === 'scope' ? undefined : () => removeAssistantCriterion(criterion.key)}
                        >
                          <span>{criterion.label}</span>
                          {criterion.key !== 'scope' && <CloseGlyph size={13} />}
                        </button>
                      ))}
                      {appliedSearchChips.map(chip => (
                        <button key={chip.key} type="button" onClick={() => removeSearchFilter(chip.key)}>
                          <span>{chip.label}</span>
                          <CloseGlyph size={13} />
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {liveSuggestions.length > 0 && (
                  <section className="latido-search-suggestions" aria-labelledby="search-suggestions-title">
                    <h2 id="search-suggestions-title">Sugerencias</h2>
                    {liveSuggestions.map((suggestion, index) => (
                      <button
                        type="button"
                        key={`${suggestion.label}-${index}`}
                        onClick={() => selectSearchSuggestion(suggestion.label, index === 0)}
                      >
                        <SearchGlyph size={19} />
                        <span><strong>{suggestion.label}</strong>{suggestion.meta && <small>{suggestion.meta}</small>}</span>
                      </button>
                    ))}
                  </section>
                )}

                {blockingSearchLoad ? (
                  <div className="latido-search-status" aria-live="polite">
                    <span className="latido-search-status__spinner" />
                    <strong>Buscando en todo Latido…</strong>
                    <p>Comprobando publicaciones, empleo, negocios y grupos.</p>
                  </div>
                ) : (
                  <>
                    <div className="latido-search-matches-heading">
                      <strong>Coincidencias</strong>
                    </div>
                    {showingRelatedAlternatives && (
                      <div className="latido-search-related-note">
                        <strong>No hay coincidencias exactas.</strong>
                        <span>Mostramos alternativas claramente relacionadas.</span>
                      </div>
                    )}
                    {previewPartnerEntries.length > 0 && (
                      <PremiumPartnerSearchList
                        partners={previewPartnerEntries}
                        onOpen={goTo}
                        highlightTokens={highlightTokens}
                      />
                    )}
                    {immersiveOrganicResults.slice(0, 5).map(result => {
                      const color = TYPE_COLORS[result.type] || TYPE_COLORS.ad
                      return (
                        <button
                          type="button"
                          className="latido-search-result"
                          key={`preview-${result.type}-${result.id}`}
                          onClick={() => goTo(result)}
                        >
                          <span className="latido-search-result__media">
                            {result.image
                              ? <img src={getThumbnailImageUrl(result.image)} alt="" loading="lazy" decoding="async" style={{ objectFit:result.imageFit || 'cover' }} />
                              : result.icon}
                          </span>
                          <span className="latido-search-result__body">
                            <span className="latido-search-result__topline">
                              <strong><HighlightSearchText text={result.label} tokens={highlightTokens} /></strong>
                              <small style={{ '--result-pill-bg':color.bg, '--result-pill-color':color.color }}>{color.label}</small>
                            </span>
                            {result.matchReason && <em>Coincide por: {result.matchReason}</em>}
                            <span><HighlightSearchText text={result.sub} tokens={highlightTokens} /></span>
                          </span>
                        </button>
                      )
                    })}
                    {immersiveResultCount > 0 ? (
                      <button type="button" className="latido-search-show-all" onClick={() => showAllResults()}>
                        Ver todos los resultados
                        <span>{immersiveResultCount}</span>
                      </button>
                    ) : (
                      <div className="latido-search-empty">
                        <SearchGlyph size={28} />
                        <strong>No encontramos resultados exactos</strong>
                        <p>Elige una sugerencia de arriba o prueba una ubicación más amplia.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="latido-search-results-page">
                <div className="latido-search-results-toolbar">
                  <div className="latido-search-results-toolbar__summary">
                    <strong>{immersiveResultCount} resultado{immersiveResultCount === 1 ? '' : 's'}</strong>
                  </div>
                  <div className="latido-search-results-toolbar__actions">
                    <button
                      type="button"
                      className={immersiveResultFiltersOpen ? 'is-active' : ''}
                      aria-expanded={immersiveResultFiltersOpen}
                      onClick={() => {
                        if (filtersContent || onFiltersRequest) {
                          handleImmersiveFilters()
                        } else {
                          setImmersiveResultFiltersOpen(open => !open)
                        }
                      }}
                    >
                      <FilterIcon size={14} />
                      Filtrar
                    </button>
                    <label className="latido-search-sort-control">
                      <span className="sr-only">Ordenar resultados</span>
                      <SortGlyph size={15} />
                      <select
                        value={immersiveSort}
                        onChange={event => {
                          setImmersiveSort(event.target.value)
                          setImmersiveLimit(FULL_SEARCH_PAGE_SIZE)
                        }}
                      >
                        {SEARCH_SORT_OPTIONS.map(option => (
                          <option key={option.id} value={option.id}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                {immersiveResultFiltersOpen && (availableTypes.length > 1 || appliedSearchChips.length > 0 || assistantCriteria.length > 0) && (
                  <div className="latido-search-result-filters">
                    {availableTypes.length > 1 && (
                      <div className="latido-search-type-tabs" role="tablist" aria-label="Tipo de resultado">
                        <button type="button" className={!activeFilter ? 'is-active' : ''} onClick={() => setActiveFilter(null)}>Todos</button>
                        {availableTypes.map(type => (
                          <button
                            type="button"
                            role="tab"
                            aria-selected={activeFilter === type}
                            className={activeFilter === type ? 'is-active' : ''}
                            key={type}
                            onClick={() => setActiveFilter(type)}
                          >
                            {(TYPE_COLORS[type] || TYPE_COLORS.ad).label}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="latido-search-chips">
                      {assistantCriteria.map(criterion => (
                        <button
                          key={criterion.key}
                          type="button"
                          className={criterion.key === 'scope' ? 'is-static' : ''}
                          onClick={criterion.key === 'scope' ? undefined : () => removeAssistantCriterion(criterion.key)}
                        >
                          <span>{criterion.label}</span>
                          {criterion.key !== 'scope' && <CloseGlyph size={13} />}
                        </button>
                      ))}
                      {appliedSearchChips.map(chip => (
                        <button key={chip.key} type="button" onClick={() => removeSearchFilter(chip.key)}>
                          <span>{chip.label}</span>
                          <CloseGlyph size={13} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {showingRelatedAlternatives && (
                  <div className="latido-search-related-note">
                    <strong>No hay coincidencias exactas.</strong>
                    <span>Estos son resultados relacionados, separados de una coincidencia directa.</span>
                  </div>
                )}

                {immersivePartnerEntries.length > 0 && (
                  <PremiumPartnerSearchList
                    partners={immersivePartnerEntries}
                    onOpen={goTo}
                    highlightTokens={highlightTokens}
                  />
                )}

                <div className="latido-search-results-list">
                  {visibleImmersiveResults.map(result => {
                    const color = TYPE_COLORS[result.type] || TYPE_COLORS.ad
                    return (
                      <button
                        type="button"
                        className="latido-search-result"
                        key={`all-${result.type}-${result.id}`}
                        onClick={() => goTo(result)}
                      >
                        <span className="latido-search-result__media">
                          {result.image
                            ? <img src={getThumbnailImageUrl(result.image)} alt="" loading="lazy" decoding="async" style={{ objectFit:result.imageFit || 'cover' }} />
                            : result.icon}
                        </span>
                        <span className="latido-search-result__body">
                          <span className="latido-search-result__topline">
                            <strong><HighlightSearchText text={result.label} tokens={highlightTokens} /></strong>
                            <small style={{ '--result-pill-bg':color.bg, '--result-pill-color':color.color }}>{color.label}</small>
                          </span>
                          {result.matchReason && <em>Coincide por: {result.matchReason}</em>}
                          <span><HighlightSearchText text={result.sub} tokens={highlightTokens} /></span>
                        </span>
                      </button>
                    )
                  })}
                </div>

                {immersiveOrganicResults.length > visibleImmersiveResults.length && (
                  <button
                    type="button"
                    className="latido-search-load-more"
                    onClick={() => setImmersiveLimit(limit => limit + FULL_SEARCH_PAGE_SIZE)}
                  >
                    Mostrar más resultados
                  </button>
                )}

                {immersiveResultCount === 0 && (
                  <div className="latido-search-empty">
                    <SearchGlyph size={28} />
                    <strong>No hay resultados con estos criterios</strong>
                    <p>Quita algún filtro o prueba una búsqueda diferente.</p>
                    <div className="latido-search-quick is-centered" aria-label="Búsquedas sugeridas">
                      {(recoverySuggestions.length
                        ? recoverySuggestions
                        : quickSearches.slice(0, 3).map(label => ({ label }))
                      ).map(suggestion => (
                        <button key={suggestion.label} type="button" onClick={() => selectSearchSuggestion(suggestion.label)}>
                          {suggestion.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>,
      document.body
    )}
    </>
  )
}
