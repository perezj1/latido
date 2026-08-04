export const CREATOR_MAX_CONTENTS = 6

export const CREATOR_FOLLOWER_RANGES = [
  { id:'menos_1k', label:'Menos de 1 K', short:'< 1 K' },
  { id:'1k_5k', label:'De 1 K a 5 K', short:'1–5 K' },
  { id:'5k_20k', label:'De 5 K a 20 K', short:'5–20 K' },
  { id:'20k_100k', label:'De 20 K a 100 K', short:'20–100 K' },
  { id:'mas_100k', label:'Más de 100 K', short:'+100 K' },
]

export const CREATOR_TOPICS = [
  { id:'tramites', label:'Trámites y permisos', emoji:'📄', color:'#2563EB', bg:'#DBEAFE' },
  { id:'trabajo', label:'Trabajo y profesión', emoji:'💼', color:'#0F766E', bg:'#CCFBF1' },
  { id:'negocios', label:'Negocios y emprendimiento', emoji:'🏪', color:'#0E7490', bg:'#CFFAFE' },
  { id:'vivienda', label:'Vivienda', emoji:'🏠', color:'#1D4ED8', bg:'#E0E7FF' },
  { id:'familia', label:'Familia y educación', emoji:'👨‍👩‍👧', color:'#9D174D', bg:'#FCE7F3' },
  { id:'dinero', label:'Dinero e impuestos', emoji:'💰', color:'#92400E', bg:'#FEF3C7' },
  { id:'planes', label:'Planes, viajes y ocio', emoji:'🏔️', color:'#166534', bg:'#DCFCE7' },
  { id:'gastronomia', label:'Gastronomía', emoji:'🍲', color:'#9A3412', bg:'#FFEDD5' },
  { id:'integracion', label:'Experiencias y vida en Suiza', emoji:'🤝', color:'#6D28D9', bg:'#EDE9FE' },
]

const CREATOR_TOPIC_BY_INTEREST = {
  empleo:'trabajo',
  vivienda:'vivienda',
  servicios:'negocios',
  eventos:'planes',
  comunidad:'integracion',
  documentos:'tramites',
  cuidados:'familia',
  venta:'negocios',
  regalo:'integracion',
}

export function getCreatorTopicsFromInterests(interests = []) {
  return Array.from(new Set(
    (Array.isArray(interests) ? interests : [])
      .map(interest => CREATOR_TOPIC_BY_INTEREST[String(interest || '').trim().toLowerCase()])
      .filter(Boolean)
  )).slice(0, 4)
}

export const CREATOR_PLATFORMS = [
  { id:'youtube', label:'YouTube', short:'YT', color:'#DC2626', bg:'#FEF2F2', hasFollowerRange:true },
  { id:'instagram', label:'Instagram', short:'IG', color:'#BE185D', bg:'#FDF2F8', hasFollowerRange:true },
  { id:'facebook', label:'Facebook', short:'FB', color:'#1D4ED8', bg:'#EFF6FF', hasFollowerRange:true },
  { id:'tiktok', label:'TikTok', short:'TK', color:'#111827', bg:'#F3F4F6', hasFollowerRange:true },
  { id:'linkedin', label:'LinkedIn', short:'IN', color:'#0369A1', bg:'#E0F2FE', hasFollowerRange:true },
  { id:'spotify', label:'Podcast', short:'SP', color:'#047857', bg:'#ECFDF5', hasFollowerRange:true },
  { id:'web', label:'Web / blog', short:'WEB', color:'#1D4ED8', bg:'#EFF6FF', hasFollowerRange:false },
]

const CREATOR_STORE_KEY = 'latido_creator_studio_v1'
const CREATOR_METRICS_KEY = 'latido_creator_metrics_v1'
const CREATOR_INTERACTIONS_KEY = 'latido_creator_interactions_v1'
const CREATOR_IMPRESSIONS_SESSION_KEY = 'latido_creator_impressions_v1'
const CREATOR_UPDATE_EVENT = 'latido:creators-updated'
const CREATOR_INTERACTIONS_EVENT = 'latido:creator-interactions-updated'

const DEMO_CREATORS = [
  {
    id:'demo-lucia-suiza',
    owner_id:null,
    slug:'lucia-en-suiza',
    name:'Lucía en Suiza',
    handle:'@luciaensuiza',
    tagline:'Trámites y vida práctica explicados sin complicaciones.',
    bio:'Contenido claro para quienes están llegando a Suiza o quieren entender mejor sus permisos, su trabajo y el día a día. Este es un perfil ficticio creado para probar la experiencia de Latido.',
    city:'Zürich',
    canton:'ZH',
    reach:'Suiza alemana',
    topics:['tramites', 'trabajo', 'integracion'],
    socials:[
      { platform:'youtube', url:'https://www.youtube.com', label:'YouTube', follower_range:'20k_100k' },
      { platform:'instagram', url:'https://www.instagram.com', label:'Instagram', follower_range:'20k_100k' },
    ],
    verified:true,
    demo:true,
    status:'published',
    accent:'#2563EB',
    created_at:'2026-06-14T10:00:00.000Z',
    selection_updated_at:'2026-07-24T09:00:00.000Z',
    helpful_count:38,
    saved_count:21,
    contents:[
      {
        id:'demo-content-permiso-b',
        title:'Permiso B: lo que conviene preparar antes de solicitarlo',
        summary:'Documentos habituales, orden recomendado y errores que suelen retrasar el trámite.',
        url:'https://www.youtube.com',
        platform:'youtube',
        format:'video',
        topic:'tramites',
        canton:'Toda Suiza',
        duration:'8 min',
        status:'published',
        published_at:'2026-07-24T09:00:00.000Z',
        sort_order:1,
        helpful_count:24,
        demo:true,
      },
      {
        id:'demo-content-nomina',
        title:'Cómo leer una nómina suiza por primera vez',
        summary:'Una explicación visual de las deducciones, seguros y conceptos más frecuentes.',
        url:'https://www.instagram.com',
        platform:'instagram',
        format:'reel',
        topic:'trabajo',
        canton:'Toda Suiza',
        duration:'2 min',
        status:'published',
        published_at:'2026-07-18T18:30:00.000Z',
        sort_order:2,
        helpful_count:16,
        demo:true,
      },
      {
        id:'demo-content-primer-mes',
        title:'Mi lista para el primer mes viviendo en Suiza',
        summary:'Registro, seguro médico, banco, teléfono y pequeñas gestiones para empezar con orden.',
        url:'https://www.youtube.com',
        platform:'youtube',
        format:'video',
        topic:'integracion',
        canton:'Toda Suiza',
        duration:'11 min',
        status:'published',
        published_at:'2026-07-08T12:00:00.000Z',
        sort_order:3,
        helpful_count:11,
        demo:true,
      },
    ],
  },
  {
    id:'demo-sabores-sin-fronteras',
    owner_id:null,
    slug:'sabores-sin-fronteras-ch',
    name:'Sabores sin fronteras CH',
    handle:'@saboressinfronterasch',
    tagline:'Restaurantes, mercados y rincones latinos para descubrir.',
    bio:'Recorridos gastronómicos y planes locales por la Suiza francófona. Perfil ficticio de demostración para visualizar diferentes personas y proyectos.',
    city:'Genève',
    canton:'GE',
    reach:'Suiza francófona',
    topics:['gastronomia', 'planes'],
    socials:[
      { platform:'instagram', url:'https://www.instagram.com', label:'Instagram', follower_range:'5k_20k' },
      { platform:'tiktok', url:'https://www.tiktok.com', label:'TikTok', follower_range:'5k_20k' },
    ],
    verified:true,
    demo:true,
    status:'published',
    accent:'#EA580C',
    created_at:'2026-06-20T10:00:00.000Z',
    selection_updated_at:'2026-07-29T16:00:00.000Z',
    helpful_count:19,
    saved_count:13,
    contents:[
      {
        id:'demo-content-mercado-ginebra',
        title:'Un mercado latino para visitar en Ginebra',
        summary:'Productos, ambiente y tres cosas que merece la pena probar durante la visita.',
        url:'https://www.tiktok.com',
        platform:'tiktok',
        format:'video corto',
        topic:'gastronomia',
        canton:'GE',
        duration:'1 min',
        status:'published',
        published_at:'2026-07-29T16:00:00.000Z',
        sort_order:1,
        helpful_count:15,
        demo:true,
      },
      {
        id:'demo-content-lausanne-gratis',
        title:'Cinco planes gratuitos cerca de Lausanne',
        summary:'Ideas para una salida de fin de semana con transporte público y poco presupuesto.',
        url:'https://www.instagram.com',
        platform:'instagram',
        format:'carrusel',
        topic:'planes',
        canton:'VD',
        duration:'5 min',
        status:'published',
        published_at:'2026-07-16T10:30:00.000Z',
        sort_order:2,
        helpful_count:9,
        demo:true,
      },
    ],
  },
  {
    id:'demo-familia-alpina',
    owner_id:null,
    slug:'familia-alpina',
    name:'Familia Alpina',
    handle:'@familiaalpina',
    tagline:'Colegio, vivienda y vida familiar en Suiza.',
    bio:'Experiencias y recursos para familias hispanohablantes que se instalan en Suiza. Perfil ficticio utilizado para probar esta sección.',
    city:'Lausanne',
    canton:'VD',
    reach:'Toda Suiza',
    topics:['familia', 'vivienda', 'integracion'],
    socials:[
      { platform:'youtube', url:'https://www.youtube.com', label:'YouTube', follower_range:'1k_5k' },
      { platform:'web', url:'https://example.com', label:'Blog' },
    ],
    verified:false,
    demo:true,
    status:'published',
    accent:'#7C3AED',
    created_at:'2026-07-01T10:00:00.000Z',
    selection_updated_at:'2026-07-21T14:00:00.000Z',
    helpful_count:12,
    saved_count:8,
    contents:[
      {
        id:'demo-content-escuela',
        title:'Así funciona la escuela pública suiza',
        summary:'Etapas, horarios, comunicación con el colegio y las primeras semanas de adaptación.',
        url:'https://www.youtube.com',
        platform:'youtube',
        format:'video',
        topic:'familia',
        canton:'Toda Suiza',
        duration:'13 min',
        status:'published',
        published_at:'2026-07-21T14:00:00.000Z',
        sort_order:1,
        helpful_count:10,
        demo:true,
      },
      {
        id:'demo-content-visita-piso',
        title:'Qué mirar durante la visita a un piso',
        summary:'Una lista breve para comparar viviendas y hacer preguntas importantes antes de solicitar.',
        url:'https://example.com',
        platform:'web',
        format:'artículo',
        topic:'vivienda',
        canton:'Toda Suiza',
        duration:'6 min',
        status:'published',
        published_at:'2026-07-12T08:00:00.000Z',
        sort_order:2,
        helpful_count:7,
        demo:true,
      },
    ],
  },
]

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function safeParse(raw, fallback) {
  try {
    return JSON.parse(raw) ?? fallback
  } catch {
    return fallback
  }
}

function readLocalCreators() {
  if (!canUseStorage()) return []
  const stored = safeParse(window.localStorage.getItem(CREATOR_STORE_KEY), [])
  return Array.isArray(stored) ? stored : []
}

function writeLocalCreators(creators) {
  if (!canUseStorage()) return
  window.localStorage.setItem(CREATOR_STORE_KEY, JSON.stringify(creators))
  window.dispatchEvent(new CustomEvent(CREATOR_UPDATE_EVENT))
}

function makeId(prefix) {
  const uuid = globalThis.crypto?.randomUUID?.()
  return uuid ? `${prefix}-${uuid}` : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function slugifyCreator(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

export function normalizeCreatorUrl(value = '') {
  const clean = String(value || '').trim()
  if (!clean) return ''

  try {
    const url = new URL(/^https?:\/\//i.test(clean) ? clean : `https://${clean}`)
    const isWebProtocol = ['http:', 'https:'].includes(url.protocol)
    const hasPublicHostname = url.hostname.includes('.') && !url.hostname.startsWith('.') && !url.hostname.endsWith('.')
    return isWebProtocol && hasPublicHostname ? url.href : ''
  } catch {
    return ''
  }
}

export function detectCreatorPlatform(value = '') {
  const url = normalizeCreatorUrl(value).toLowerCase()
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('instagram.com')) return 'instagram'
  if (url.includes('facebook.com') || url.includes('fb.watch')) return 'facebook'
  if (url.includes('tiktok.com')) return 'tiktok'
  if (url.includes('linkedin.com')) return 'linkedin'
  if (url.includes('spotify.com') || url.includes('podcasts.apple.com') || url.includes('ivoox.com')) return 'spotify'
  return 'web'
}

export function getYouTubeVideoId(value = '') {
  const normalized = normalizeCreatorUrl(value)
  if (!normalized) return ''

  try {
    const url = new URL(normalized)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    let candidate = ''

    if (host === 'youtu.be') candidate = url.pathname.split('/').filter(Boolean)[0] || ''
    else if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      candidate = url.searchParams.get('v') || ''
      if (!candidate) {
        const parts = url.pathname.split('/').filter(Boolean)
        if (['shorts', 'embed', 'live'].includes(parts[0])) candidate = parts[1] || ''
      }
    }

    const clean = candidate.match(/^[a-zA-Z0-9_-]{6,}$/)?.[0] || ''
    return clean
  } catch {
    return ''
  }
}

export function getAutomaticCreatorThumbnail(value = '', platform = '') {
  const detectedPlatform = platform || detectCreatorPlatform(value)
  if (detectedPlatform !== 'youtube') return ''
  const videoId = getYouTubeVideoId(value)
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : ''
}

export async function getCreatorOEmbedMetadata(value = '', { signal } = {}) {
  const url = normalizeCreatorUrl(value)
  const platform = detectCreatorPlatform(url)
  if (!url || !['youtube', 'tiktok'].includes(platform)) return null

  const endpoint = platform === 'youtube'
    ? `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    : `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
  const response = await fetch(endpoint, { signal })
  if (!response.ok) throw new Error('No se han podido leer los datos de este enlace.')
  const data = await response.json()
  return {
    title:String(data?.title || '').trim(),
    thumbnail_url:normalizeCreatorThumbnail(data?.thumbnail_url),
  }
}

function normalizeCreatorThumbnail(value = '') {
  const clean = String(value || '').trim()
  if (/^data:image\/(?:png|jpe?g|webp);base64,/i.test(clean)) return clean
  return normalizeCreatorUrl(clean)
}

export function getCreatorThumbnailUrl(content = {}) {
  return normalizeCreatorThumbnail(content.thumbnail_url)
    || getAutomaticCreatorThumbnail(content.url, content.platform)
}

export function getCreatorTopic(topicId) {
  return CREATOR_TOPICS.find(topic => topic.id === topicId) || CREATOR_TOPICS[CREATOR_TOPICS.length - 1]
}

export function getCreatorPlatform(platformId) {
  return CREATOR_PLATFORMS.find(platform => platform.id === platformId) || CREATOR_PLATFORMS[CREATOR_PLATFORMS.length - 1]
}

export function getCreatorFollowerRange(rangeId) {
  return CREATOR_FOLLOWER_RANGES.find(range => range.id === rangeId) || null
}

function normalizeContentOrder(contents = []) {
  return (Array.isArray(contents) ? contents : [])
    .map((content, index) => ({ content, index }))
    .sort((first, second) => {
      const firstOrder = Number(first.content?.sort_order) || first.index + 1
      const secondOrder = Number(second.content?.sort_order) || second.index + 1
      return firstOrder - secondOrder || first.index - second.index
    })
    .map(({ content }, index) => ({ ...content, sort_order:index + 1 }))
}

function applyContentOrder(contents = []) {
  return (Array.isArray(contents) ? contents : []).map((content, index) => ({ ...content, sort_order:index + 1 }))
}

export function getOrderedCreatorContents(creator, { publishedOnly = false } = {}) {
  const contents = normalizeContentOrder(creator?.contents)
  return publishedOnly ? contents.filter(content => content.status === 'published') : contents
}

export function getCreatorProfileCompleteness(creator) {
  const checks = [
    { id:'profile', done:Boolean(creator?.bio?.trim() && creator?.tagline?.trim()), label:'Presentación completa' },
    { id:'socials', done:(creator?.socials || []).length >= 2, label:'Dos redes conectadas' },
    { id:'topics', done:Boolean(creator?.topics?.length), label:'Temas seleccionados' },
    { id:'location', done:Boolean(creator?.canton), label:'Cantón indicado' },
  ]
  const completed = checks.filter(check => check.done).length
  return { checks, percent:Math.round((completed / checks.length) * 100) }
}

function normalizeCreatorRecord(creator) {
  return { ...creator, contents:normalizeContentOrder(creator?.contents) }
}

export function getAllCreators({ includeUnpublished = false } = {}) {
  const all = [...DEMO_CREATORS, ...readLocalCreators()].map(normalizeCreatorRecord)
  return includeUnpublished ? all : all.filter(creator => creator.status === 'published')
}

export function getCreatorBySlug(slug = '') {
  return getAllCreators({ includeUnpublished:true }).find(creator => creator.slug === slug) || null
}

export function getCreatorForUser(userId) {
  if (!userId) return null
  return readLocalCreators().find(creator => creator.owner_id === userId) || null
}

export function normalizeCreatorHandle(value = '') {
  return formatCreatorHandle(value).toLowerCase()
}

export function formatCreatorHandle(value = '') {
  const alias = String(value || '').trim().replace(/^@+/, '')
  return alias ? `@${alias}` : ''
}

export function isCreatorHandleAvailable(value, userId = '') {
  const handle = normalizeCreatorHandle(value)
  if (!handle) return false
  return !getAllCreators({ includeUnpublished:true }).some(creator => (
    normalizeCreatorHandle(creator.handle) === handle
    && String(creator.owner_id || '') !== String(userId || '')
  ))
}

export function saveCreatorProfile(userId, input = {}) {
  if (!userId) throw new Error('Necesitas iniciar sesión para crear un perfil.')

  const creators = readLocalCreators()
  const existingIndex = creators.findIndex(creator => creator.owner_id === userId)
  const existing = existingIndex >= 0 ? creators[existingIndex] : null
  const name = String(input.name || '').trim()
  const handle = normalizeCreatorHandle(input.handle)
  if (!/^@[a-z0-9._-]{3,}$/.test(handle)) {
    throw new Error('El usuario debe empezar por @ y tener al menos 3 caracteres sin espacios.')
  }
  if (!isCreatorHandleAvailable(handle, userId)) {
    throw new Error('Ese usuario ya pertenece a otro perfil. Elige uno diferente.')
  }
  const baseSlug = slugifyCreator(name) || 'creador'
  const usedSlugs = new Set(getAllCreators({ includeUnpublished:true }).filter(creator => creator.owner_id !== userId).map(creator => creator.slug))
  let slug = existing?.slug || baseSlug
  if (usedSlugs.has(slug)) slug = `${baseSlug}-${String(userId).slice(0, 6).toLowerCase()}`

  const profile = {
    id:existing?.id || makeId('creator'),
    owner_id:userId,
    slug,
    name,
    avatar_url:Object.hasOwn(input, 'avatar_url') ? String(input.avatar_url || '') : existing?.avatar_url || '',
    handle,
    tagline:String(input.tagline || '').trim(),
    bio:String(input.bio || '').trim(),
    city:String(input.city || '').trim(),
    canton:String(input.canton || '').trim(),
    reach:String(input.reach || 'Toda Suiza').trim(),
    topics:Array.isArray(input.topics) ? input.topics.slice(0, 4) : [],
    socials:Array.isArray(input.socials)
      ? input.socials
        .map(social => ({
          platform:social.platform || detectCreatorPlatform(social.url),
          url:normalizeCreatorUrl(social.url),
          label:social.label || getCreatorPlatform(social.platform).label,
          follower_range:getCreatorFollowerRange(social.follower_range)?.id || '',
        }))
        .filter(social => social.url)
      : [],
    verified:false,
    demo:false,
    status:input.status === 'draft' ? 'draft' : 'published',
    review_status:existing?.review_status || 'pending',
    accent:existing?.accent || '#2563EB',
    created_at:existing?.created_at || new Date().toISOString(),
    updated_at:new Date().toISOString(),
    selection_updated_at:existing?.selection_updated_at || '',
    contents:normalizeContentOrder(existing?.contents),
  }

  if (existingIndex >= 0) creators[existingIndex] = profile
  else creators.push(profile)
  writeLocalCreators(creators)
  return profile
}

export function saveCreatorContent(userId, input = {}) {
  const creators = readLocalCreators()
  const creatorIndex = creators.findIndex(creator => creator.owner_id === userId)
  if (creatorIndex < 0) throw new Error('Primero tienes que crear tu perfil público.')

  const creator = creators[creatorIndex]
  const contents = normalizeContentOrder(creator.contents)
  const existingIndex = input.id ? contents.findIndex(content => content.id === input.id) : -1
  if (existingIndex < 0 && contents.length >= CREATOR_MAX_CONTENTS) {
    throw new Error(`El prototipo permite hasta ${CREATOR_MAX_CONTENTS} publicaciones por perfil.`)
  }

  const url = normalizeCreatorUrl(input.url)
  if (!url) throw new Error('Añade un enlace válido que empiece por https://')
  const platform = input.platform || detectCreatorPlatform(url)
  const existing = existingIndex >= 0 ? contents[existingIndex] : null
  const content = {
    id:existing?.id || makeId('content'),
    title:String(input.title || '').trim(),
    summary:String(input.summary || '').trim(),
    url,
    platform,
    format:String(input.format || 'video').trim(),
    topic:String(input.topic || '').trim(),
    canton:String(input.canton || 'Toda Suiza').trim(),
    duration:String(input.duration || '').trim(),
    thumbnail_url:normalizeCreatorThumbnail(input.thumbnail_url),
    thumbnail_kind:input.thumbnail_kind === 'auto' ? 'auto' : input.thumbnail_url ? 'custom' : '',
    status:input.status === 'draft' ? 'draft' : 'published',
    published_at:existing?.published_at || new Date().toISOString(),
    updated_at:new Date().toISOString(),
    demo:false,
  }

  const withoutCurrent = existingIndex >= 0
    ? contents.filter((_, index) => index !== existingIndex)
    : [...contents]
  const fallbackPosition = existingIndex >= 0 ? existingIndex + 1 : withoutCurrent.length + 1
  const requestedPosition = Number(input.position) || Number(existing?.sort_order) || fallbackPosition
  const targetIndex = Math.max(0, Math.min(withoutCurrent.length, requestedPosition - 1))
  withoutCurrent.splice(targetIndex, 0, content)
  const orderedContents = applyContentOrder(withoutCurrent)
  const now = new Date().toISOString()
  creators[creatorIndex] = { ...creator, contents:orderedContents, selection_updated_at:now, updated_at:now }
  writeLocalCreators(creators)
  return orderedContents[targetIndex]
}

export function moveCreatorContent(userId, contentId, direction) {
  const creators = readLocalCreators()
  const creatorIndex = creators.findIndex(creator => creator.owner_id === userId)
  if (creatorIndex < 0) return null

  const creator = creators[creatorIndex]
  const contents = normalizeContentOrder(creator.contents)
  const currentIndex = contents.findIndex(content => content.id === contentId)
  const offset = direction === 'up' ? -1 : direction === 'down' ? 1 : Number(direction) || 0
  const targetIndex = Math.max(0, Math.min(contents.length - 1, currentIndex + offset))
  if (currentIndex < 0 || currentIndex === targetIndex) return creator

  const [selected] = contents.splice(currentIndex, 1)
  contents.splice(targetIndex, 0, selected)
  const now = new Date().toISOString()
  creators[creatorIndex] = { ...creator, contents:applyContentOrder(contents), selection_updated_at:now, updated_at:now }
  writeLocalCreators(creators)
  return creators[creatorIndex]
}

export function setCreatorContentStatus(userId, contentId, status) {
  const creators = readLocalCreators()
  const creatorIndex = creators.findIndex(creator => creator.owner_id === userId)
  if (creatorIndex < 0) return null

  const creator = creators[creatorIndex]
  const contents = normalizeContentOrder(creator.contents).map(content => (
    content.id === contentId ? { ...content, status:status === 'draft' ? 'draft' : 'published', updated_at:new Date().toISOString() } : content
  ))
  const now = new Date().toISOString()
  creators[creatorIndex] = { ...creator, contents, selection_updated_at:now, updated_at:now }
  writeLocalCreators(creators)
  return creators[creatorIndex]
}

export function removeCreatorContent(userId, contentId) {
  const creators = readLocalCreators()
  const creatorIndex = creators.findIndex(creator => creator.owner_id === userId)
  if (creatorIndex < 0) return null

  const creator = creators[creatorIndex]
  creators[creatorIndex] = {
    ...creator,
    contents:applyContentOrder(normalizeContentOrder(creator.contents).filter(content => content.id !== contentId)),
    selection_updated_at:new Date().toISOString(),
    updated_at:new Date().toISOString(),
  }
  writeLocalCreators(creators)
  return creators[creatorIndex]
}

function readMetrics() {
  if (!canUseStorage()) return {}
  const stored = safeParse(window.localStorage.getItem(CREATOR_METRICS_KEY), {})
  return stored && typeof stored === 'object' ? stored : {}
}

export function trackCreatorMetric(creatorId, metric, contentId = '') {
  if (!creatorId || !metric || !canUseStorage()) return
  const metrics = readMetrics()
  const key = [creatorId, metric, contentId].filter(Boolean).join(':')
  metrics[key] = Number(metrics[key] || 0) + 1
  window.localStorage.setItem(CREATOR_METRICS_KEY, JSON.stringify(metrics))
}

export function trackCreatorImpression(creatorId, targetType, targetId) {
  if (!creatorId || !targetType || !targetId || typeof window === 'undefined') return
  const impressionKey = `${targetType}:${targetId}`
  try {
    const seen = safeParse(window.sessionStorage.getItem(CREATOR_IMPRESSIONS_SESSION_KEY), [])
    if (Array.isArray(seen) && seen.includes(impressionKey)) return
    window.sessionStorage.setItem(CREATOR_IMPRESSIONS_SESSION_KEY, JSON.stringify([...(Array.isArray(seen) ? seen : []), impressionKey]))
  } catch {}
  trackCreatorMetric(creatorId, `${targetType}_impression`, targetId)
}

function readInteractions() {
  if (!canUseStorage()) return {}
  const stored = safeParse(window.localStorage.getItem(CREATOR_INTERACTIONS_KEY), {})
  return stored && typeof stored === 'object' ? stored : {}
}

function getInteractionKey(action, targetType, targetId) {
  return `${action}:${targetType}:${targetId}`
}

function getInteractionActors(action, targetType, targetId) {
  const actors = readInteractions()[getInteractionKey(action, targetType, targetId)]
  return Array.isArray(actors) ? actors.map(String) : []
}

function getInteractionActor(actorId = '') {
  return actorId ? `user:${actorId}` : 'local-device'
}

export function getCreatorInteractionState({ action, targetType, targetId, actorId = '', baseCount = 0 }) {
  const actors = getInteractionActors(action, targetType, targetId)
  return {
    active:actors.includes(getInteractionActor(actorId)),
    count:Math.max(0, Number(baseCount) || 0) + actors.length,
  }
}

export function toggleCreatorInteraction({ action, targetType, targetId, actorId = '', baseCount = 0 }) {
  if (!action || !targetType || !targetId || !canUseStorage()) {
    return getCreatorInteractionState({ action, targetType, targetId, actorId, baseCount })
  }
  const store = readInteractions()
  const key = getInteractionKey(action, targetType, targetId)
  const actor = getInteractionActor(actorId)
  const current = Array.isArray(store[key]) ? store[key].map(String) : []
  store[key] = current.includes(actor) ? current.filter(item => item !== actor) : [...current, actor]
  window.localStorage.setItem(CREATOR_INTERACTIONS_KEY, JSON.stringify(store))
  window.dispatchEvent(new CustomEvent(CREATOR_INTERACTIONS_EVENT))
  return getCreatorInteractionState({ action, targetType, targetId, actorId, baseCount })
}

export function getFollowedCreatorIds(actorId = '') {
  if (!actorId) return []
  const actor = getInteractionActor(actorId)
  const prefix = 'saved:creator:'
  return Object.entries(readInteractions())
    .filter(([key, actors]) => key.startsWith(prefix) && Array.isArray(actors) && actors.map(String).includes(actor))
    .map(([key]) => key.slice(prefix.length))
}

export function getCreatorMetrics(creator) {
  const metrics = readMetrics()
  const contents = getOrderedCreatorContents(creator)
  const contentClicks = contents.reduce(
    (total, content) => total + Number(metrics[`${creator.id}:content_click:${content.id}`] || 0),
    0,
  )
  const contentImpressions = contents.reduce(
    (total, content) => total + Number(metrics[`${creator.id}:content_impression:${content.id}`] || 0),
    0,
  )
  const socialClicks = (creator?.socials || []).reduce(
    (total, social) => total + Number(metrics[`${creator.id}:social_click:${social.platform}`] || 0),
    0,
  )
  const profileHelpful = Math.max(0, Number(creator?.helpful_count) || 0)
    + getInteractionActors('helpful', 'creator', creator?.id).length
  const contentHelpful = contents.reduce((total, content) => (
    total + Math.max(0, Number(content.helpful_count) || 0)
      + getInteractionActors('helpful', 'content', content.id).length
  ), 0)
  const saved = Math.max(0, Number(creator?.saved_count) || 0)
    + getInteractionActors('saved', 'creator', creator?.id).length
  const byContent = Object.fromEntries(contents.map(content => {
    const impressions = Number(metrics[`${creator.id}:content_impression:${content.id}`] || 0)
    const clicks = Number(metrics[`${creator.id}:content_click:${content.id}`] || 0)
    const helpful = Math.max(0, Number(content.helpful_count) || 0)
      + getInteractionActors('helpful', 'content', content.id).length
    return [content.id, { impressions, clicks, helpful, clickRate:impressions ? Math.round((clicks / impressions) * 100) : 0 }]
  }))

  return {
    profileViews:Number(metrics[`${creator?.id}:profile_view`] || 0),
    contentClicks,
    contentImpressions,
    clickRate:contentImpressions ? Math.round((contentClicks / contentImpressions) * 100) : 0,
    socialClicks,
    profileHelpful,
    contentHelpful,
    helpfulReceived:profileHelpful + contentHelpful,
    saved,
    byContent,
  }
}

export function subscribeCreatorInteractions(callback) {
  if (typeof window === 'undefined') return () => {}
  const handler = () => callback?.()
  window.addEventListener(CREATOR_INTERACTIONS_EVENT, handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener(CREATOR_INTERACTIONS_EVENT, handler)
    window.removeEventListener('storage', handler)
  }
}

export function subscribeCreatorUpdates(callback) {
  if (typeof window === 'undefined') return () => {}
  const handler = () => callback?.()
  window.addEventListener(CREATOR_UPDATE_EVENT, handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener(CREATOR_UPDATE_EVENT, handler)
    window.removeEventListener('storage', handler)
  }
}

export function resetCreatorPrototype(userId) {
  if (!userId) return
  const creators = readLocalCreators().filter(creator => creator.owner_id !== userId)
  writeLocalCreators(creators)
}
