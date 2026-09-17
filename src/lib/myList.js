import { supabase } from './supabase.js'
import {
  buildLatidoSearchRpcParams,
  matchesLatidoAssistantResult,
  parseLatidoAssistantQuery,
} from './latidoAssistantSearch.js'
import { buildSearchProfile, scoreSearchFields } from './naturalSearch.js'
import {
  getAdPath,
  getBusinessPath,
  getEventPath,
  getJobPath,
} from './seo.js'
import { getAllCreatorContents, getAllCreators } from './creators.js'

const KIND_BY_RESULT_TYPE = Object.freeze({
  ad:'listing',
  job:'job',
  business:'provider',
  event:'event',
  community:'community',
  creator:'creator',
  creator_content:'creator_content',
})

const RESULT_TYPE_BY_KIND = Object.freeze(Object.fromEntries(
  Object.entries(KIND_BY_RESULT_TYPE).map(([type, kind]) => [kind, type]),
))

const ALL_RESULT_TYPES = Object.freeze(['ad', 'job', 'business', 'event', 'community'])
const RPC_RESULT_TYPES = new Set(ALL_RESULT_TYPES)
const OFFER_RESULT_INTENTS = Object.freeze(['ofrece', 'vende', 'regala'])
const GENERIC_NEED_TERMS = new Set([
  'algo', 'buscar', 'busco', 'comprar', 'encontrar', 'hacer', 'mejorar', 'necesito',
  'necesita', 'necesitar', 'quiero', 'quisiera', 'tener', 'para', 'por', 'una', 'uno',
  'unos', 'unas', 'con', 'del', 'desde', 'este', 'esta', 'esto', 'muy', 'mas', 'mi',
])

function normalizeText(value='') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function getMyListMatchTerms(parsed) {
  if (parsed?.scope?.focusTerms?.length) {
    return [...new Set(parsed.scope.focusTerms.map(normalizeText).filter(Boolean))]
  }
  const scopeTerms = new Set((parsed.scope?.searchTerms || []).flatMap(term => normalizeText(term).split(' ')))
  const customTerms = normalizeText(parsed.semanticQuery || parsed.originalQuery)
    .split(' ')
    .filter(term => term.length >= 3 && !GENERIC_NEED_TERMS.has(term) && !scopeTerms.has(term))

  if (customTerms.length) return [...new Set(customTerms)]

  return [...new Set(
    (parsed.searchTerms || [])
      .flatMap(term => normalizeText(term).split(' '))
      .filter(term => term.length >= 3 && !GENERIC_NEED_TERMS.has(term)),
  )]
}

export function getMyListTitle(search) {
  const query = String(search?.query || '').trim()
  if (query) return query
  return String(search?.name || 'Algo que necesito')
    .replace(/^B[uú]squeda:\s*[“"]?/i, '')
    .replace(/[”"](?:\s*·.*)?$/, '')
    .trim()
}

export function buildMyListDraft(phrase) {
  const query = String(phrase || '').trim().replace(/\s+/g, ' ').slice(0, 120)
  if (query.length < 2) return null

  const parsed = parseLatidoAssistantQuery(query)
  // En la interfaz, "Ofertas" incluye servicios, artículos en venta y regalos.
  // Guardamos la familia completa para que Mi lista no descarte una venta por
  // estar etiquetada como `vende` en vez de `ofrece`.
  const usesDefaultOfferFamily = !parsed.resultIntents?.length
  const resultIntents = usesDefaultOfferFamily ? OFFER_RESULT_INTENTS : parsed.resultIntents
  const storedIntent = usesDefaultOfferFamily
    ? 'ofrece'
    : resultIntents.length === 1 ? resultIntents[0] : ''
  const resultTypes = parsed.entityTypes?.length
    ? parsed.entityTypes.filter(type => KIND_BY_RESULT_TYPE[type])
    : ALL_RESULT_TYPES
  const entityKinds = [...new Set(resultTypes.map(type => KIND_BY_RESULT_TYPE[type]).filter(Boolean))].sort()
  if (!entityKinds.length) return null

  const params = new URLSearchParams({ search:'results', q:query })
  if (parsed.canton) params.set('canton', parsed.canton)
  if (parsed.municipality) params.set('location', parsed.municipality)
  if (parsed.postalCode) params.set('plz', parsed.postalCode)
  if (parsed.category) params.set('cat', parsed.category)
  if (storedIntent) params.set('intent', storedIntent)

  return {
    name:query,
    query,
    entityKinds,
    category:parsed.category || '',
    intent:storedIntent,
    canton:parsed.canton || '',
    city:parsed.municipality || '',
    plz:parsed.postalCode || '',
    filters:{
      entityTypes:resultTypes,
      resultIntents,
      searchTerms:parsed.searchTerms || [],
      matchTerms:getMyListMatchTerms(parsed),
      priceMin:parsed.priceMin,
      priceMax:parsed.priceMax,
      roomsMin:parsed.roomsMin,
      dateFrom:parsed.dateFrom || '',
      spanishRequired:Boolean(parsed.spanishRequired),
      germanLevel:parsed.germanLevel || '',
    },
    resultPath:`/?${params.toString()}`,
  }
}

function parsedSearchFromRow(search) {
  const parsed = parseLatidoAssistantQuery(getMyListTitle(search))
  const filters = search?.filters || {}
  const storedTypes = Array.isArray(filters.entityTypes) && filters.entityTypes.length
    ? filters.entityTypes
    : (search?.entity_kinds || []).map(kind => RESULT_TYPE_BY_KIND[kind]).filter(Boolean)

  const storedResultIntents = Array.isArray(filters.resultIntents)
    ? filters.resultIntents.filter(Boolean)
    : []
  const resultIntents = parsed.resultIntents?.length
    ? parsed.resultIntents
    : storedResultIntents.length
      ? storedResultIntents
      // Compatibilidad con entradas creadas antes de guardar la familia de
      // ofertas: `ofrece` también significa venta o regalo.
      : search?.intent === 'ofrece'
        ? OFFER_RESULT_INTENTS
        : search?.intent
          ? [search.intent]
          : OFFER_RESULT_INTENTS

  return {
    ...parsed,
    entityTypes:storedTypes.length ? storedTypes : parsed.entityTypes,
    category:search?.category || parsed.category,
    resultIntents,
    canton:search?.canton || parsed.canton,
    municipality:search?.city || parsed.municipality,
    postalCode:search?.plz || parsed.postalCode,
    // Reinterpretamos siempre la frase con el motor actual. Así, las entradas
    // antiguas de Mi lista también reciben las mejoras de relevancia.
    searchTerms:parsed.searchTerms?.length
      ? parsed.searchTerms
      : Array.isArray(filters.searchTerms) ? filters.searchTerms : [],
    priceMin:filters.priceMin ?? parsed.priceMin,
    priceMax:filters.priceMax ?? parsed.priceMax,
    roomsMin:filters.roomsMin ?? parsed.roomsMin,
    dateFrom:filters.dateFrom || parsed.dateFrom,
    spanishRequired:filters.spanishRequired ?? parsed.spanishRequired,
    germanLevel:filters.germanLevel || parsed.germanLevel,
  }
}

function resultHaystack(payload={}) {
  return normalizeText([
    payload.title,
    payload.name,
    payload.company,
    payload.desc,
    payload.description,
    payload.summary,
    payload.services,
    payload.sector,
    payload.category,
    payload.cat,
    payload.sub,
    payload.type,
    payload.city,
    payload.canton,
  ].flat().filter(Boolean).join(' '))
}

function rowMatchesSpecificTerms(row, search, parsed) {
  const stored = Array.isArray(search?.filters?.matchTerms) ? search.filters.matchTerms : []
  const focusedTerms = parsed?.scope?.focusTerms || []
  const terms = focusedTerms.length ? focusedTerms : stored.length ? stored : getMyListMatchTerms(parsed)
  if (!terms.length) return true
  const haystack = resultHaystack(row?.payload)
  return terms.some(term => haystack.includes(normalizeText(term)))
}

function getRowSearchFields(entityType, payload={}) {
  if (entityType === 'job') return [
    { value:payload.title, weight:6 },
    { value:payload.company, weight:4 },
    { value:payload.sector, weight:4 },
    { value:payload.desc || payload.description, weight:3 },
    { value:payload.category, weight:3 },
    { value:payload.city, weight:2 },
    { value:payload.type, weight:2 },
    { value:Array.isArray(payload.languages) ? payload.languages.join(' ') : payload.languages, weight:2 },
    { value:'empleo trabajo oferta laboral vacante puesto', weight:3 },
  ]
  if (entityType === 'business') return [
    { value:payload.name, weight:6 },
    { value:Array.isArray(payload.services) ? payload.services.join(' ') : payload.services, weight:5 },
    { value:payload.desc || payload.description, weight:4 },
    { value:payload.category, weight:3 },
    { value:payload.type, weight:2 },
    { value:payload.city, weight:2 },
    { value:'negocio profesional servicio', weight:1 },
  ]
  if (entityType === 'community') return [
    { value:payload.name, weight:6 },
    { value:payload.desc || payload.description, weight:4 },
    { value:payload.cat || payload.category, weight:3 },
    { value:payload.city, weight:2 },
    { value:'grupo comunidad', weight:1 },
  ]
  if (entityType === 'event') return [
    { value:payload.title, weight:6 },
    { value:payload.desc || payload.description, weight:4 },
    { value:payload.type, weight:3 },
    { value:payload.venue, weight:2 },
    { value:payload.host, weight:2 },
    { value:payload.city, weight:2 },
    { value:'evento plan actividad', weight:1 },
  ]
  if (entityType === 'creator') return [payload.name, payload.handle, payload.tagline, payload.bio, payload.city, payload.canton]
  if (entityType === 'creator_content') return [payload.title, payload.summary, payload.topic, payload.creator_name, payload.canton]
  return [
    { value:payload.title, weight:6 },
    { value:payload.desc || payload.description, weight:4 },
    { value:payload.sub, weight:3 },
    { value:payload.cat || payload.category, weight:2 },
    { value:payload.city, weight:2 },
    { value:payload.canton, weight:1 },
  ]
}

function getRowAssistantResult(row, parsed) {
  const payload = row?.payload || {}
  const entityType = row?.entity_type || ''
  const categories = entityType === 'ad'
    ? ['anuncios', payload.cat, payload.category]
    : entityType === 'job'
      ? ['empleo', payload.category, payload.sector]
      : entityType === 'business'
        ? ['negocios', 'servicios', parsed.category, payload.category, payload.type]
        : entityType === 'community'
          ? ['grupos', payload.cat, payload.category]
          : entityType === 'event'
            ? ['eventos', payload.type]
            : ['creadores', payload.category, payload.topic]

  return {
    type:entityType,
    label:payload.title || payload.name || '',
    sub:payload.sub || payload.description || payload.desc || '',
    filterMeta:{
      categories:categories.filter(Boolean),
      searchText:resultHaystack(payload),
      title:payload.title || payload.name || '',
      description:payload.desc || payload.description || payload.summary || '',
      subcategory:payload.sub || payload.category || payload.type || '',
      canton:payload.canton,
      city:payload.city,
      location:payload.city || payload.canton,
      postalCode:payload.plz,
      intent:entityType === 'business' ? 'ofrece' : payload.intent || payload.job_intent || payload.type,
      priceAmount:payload.price_amount,
      salaryAmount:payload.salary_amount,
      rooms:payload.rooms,
      availableFrom:payload.available_from,
      languages:payload.languages,
      languageText:payload.lang || payload.description || payload.desc,
      germanLevel:payload.german_level,
      germanRequired:payload.german_required,
      spanishSupported:payload.spanish_supported,
    },
  }
}

export function scoreMyListRow(row, search, parsedInput=null) {
  const parsed = parsedInput || parsedSearchFromRow(search)
  const profile = buildSearchProfile(parsed.semanticQuery || getMyListTitle(search))
  const relevance = scoreSearchFields(profile, getRowSearchFields(row?.entity_type, row?.payload || {}))
  if (!relevance) return 0
  if (!rowMatchesSpecificTerms(row, search, parsed)) return 0
  if (!matchesLatidoAssistantResult(getRowAssistantResult(row, parsed), parsed)) return 0
  return relevance
}

export function getMyListCommercialPriority(row) {
  // El buscador general reserva 0/1/2 para Premium, Básico y Destacado.
  // Todo resultado orgánico, incluidos anuncios, empleo y creadores, ocupa el
  // nivel 3. No usamos el antiguo valor 1 de esos tipos porque competiría como
  // si fuese una colaboración básica.
  if (row?.entity_type !== 'business') return 3
  const priority = Number(row?.commercial_priority)
  return Number.isFinite(priority) ? Math.min(Math.max(priority, 0), 3) : 3
}

export function compareMyListSearchEntries(left, right) {
  return (
    getMyListCommercialPriority(left.row) - getMyListCommercialPriority(right.row)
    || right.relevance - left.relevance
    || String(right.row.created_at || '').localeCompare(String(left.row.created_at || ''))
  )
}

function getResultMeta(entityType, payload={}) {
  if (entityType === 'creator') return {
    title:payload.name || payload.handle || 'Creador',
    subtitle:[payload.tagline, payload.city || payload.canton].filter(Boolean).join(' · '),
    path:payload.slug ? `/creadores/${payload.slug}` : '/comunidades?view=creadores&creatorView=creadores',
    emoji:'🎙️',
    typeLabel:'Creador',
  }
  if (entityType === 'creator_content') return {
    title:payload.title || 'Contenido',
    subtitle:[payload.creator_name, payload.topic].filter(Boolean).join(' · '),
    path:payload.creator_slug
      ? `/creadores/${payload.creator_slug}?contenido=${encodeURIComponent(payload.id || '')}`
      : '/comunidades?view=creadores&creatorView=contenidos',
    emoji:'🎬',
    typeLabel:'Contenido',
  }
  if (entityType === 'job') return {
    title:payload.title || payload.company || 'Empleo',
    subtitle:[payload.company, payload.city || payload.canton, payload.salary].filter(Boolean).join(' · '),
    path:getJobPath(payload),
    emoji:'💼',
    typeLabel:'Empleo',
  }
  if (entityType === 'business') return {
    title:payload.name || 'Negocio',
    subtitle:[payload.category, payload.city || payload.canton].filter(Boolean).join(' · '),
    path:getBusinessPath(payload),
    emoji:'🏪',
    typeLabel:'Negocio',
  }
  if (entityType === 'event') return {
    title:payload.title || 'Evento',
    subtitle:[payload.city || payload.canton, payload.price].filter(Boolean).join(' · '),
    path:getEventPath(payload),
    emoji:'🎉',
    typeLabel:'Evento',
  }
  if (entityType === 'community') return {
    title:payload.name || 'Grupo',
    subtitle:[payload.city, payload.cat].filter(Boolean).join(' · '),
    path:`/comunidades?view=comunidades&openCommunity=${encodeURIComponent(payload.id || '')}`,
    emoji:'👥',
    typeLabel:'Comunidad',
  }
  return {
    title:payload.title || 'Anuncio',
    subtitle:[payload.city || payload.canton, payload.price].filter(Boolean).join(' · '),
    path:getAdPath(payload),
    emoji:payload.cat === 'vivienda' ? '🏠' : '📣',
    typeLabel:payload.cat === 'vivienda' ? 'Vivienda' : 'Anuncio',
  }
}

export async function searchMyListResults(search, limit=60) {
  const parsed = parsedSearchFromRow(search)
  const requestedTypes = parsed.entityTypes || []
  const rpcTypes = requestedTypes.filter(type => RPC_RESULT_TYPES.has(type))
  let rpcRows = []
  if (!requestedTypes.length || rpcTypes.length) {
    const { data, error } = await supabase.rpc(
      'search_latido',
      buildLatidoSearchRpcParams({
        ...parsed,
        entityTypes:requestedTypes.length ? rpcTypes : [],
      }, limit),
    )
    if (error) throw error
    rpcRows = data || []
  }

  const localRows = []
  if (requestedTypes.includes('creator')) {
    getAllCreators().forEach(creator => localRows.push({
      entity_type:'creator',
      entity_id:creator.id,
      payload:creator,
    }))
  }
  if (requestedTypes.includes('creator_content')) {
    getAllCreatorContents().forEach(entry => {
      const content = entry?.content || entry
      const creator = entry?.creator || {}
      localRows.push({
        entity_type:'creator_content',
        entity_id:content.id,
        payload:{
          ...content,
          creator_name:content.creator_name || creator.name,
          creator_slug:content.creator_slug || creator.slug,
        },
      })
    })
  }

  return [...rpcRows, ...localRows]
    .map(row => ({ row, relevance:scoreMyListRow(row, search, parsed) }))
    .filter(entry => entry.relevance > 0)
    .sort(compareMyListSearchEntries)
    .map(({ row }) => {
      const payload = row.payload || {}
      return {
        id:`${row.entity_type}:${row.entity_id}`,
        entityType:row.entity_type,
        entityId:row.entity_id,
        payload,
        ...getResultMeta(row.entity_type, payload),
      }
    })
}

export async function listMyListUnreadCounts(userId) {
  if (!userId) return {}
  const { data, error } = await supabase
    .from('saved_search_matches')
    .select('saved_search_id')
    .eq('user_id', userId)
    .is('read_at', null)
    .limit(500)

  if (error) {
    if (/saved_search_matches|schema cache|does not exist/i.test(error.message || '')) return {}
    throw error
  }

  return (data || []).reduce((counts, match) => {
    counts[match.saved_search_id] = (counts[match.saved_search_id] || 0) + 1
    return counts
  }, {})
}
