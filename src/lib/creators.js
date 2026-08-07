// Seis destacados, no un tope: el creador elige que seis encabezan su perfil y
// el resto se sigue publicando y aparece en "Ultimos contenidos".
export const CREATOR_FEATURED_CONTENTS = 6
// Se conserva por compatibilidad con consumidores antiguos. La interfaz ya no
// presenta los destacados como un limite para publicar contenido.
export const CREATOR_MAX_CONTENTS = Number.MAX_SAFE_INTEGER

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
const TIKTOK_RESOLVE_ENDPOINT = '/api/tiktok-resolve'
const tiktokResolutionCache = new Map()

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

export function getTikTokVideoId(value = '') {
  const normalized = normalizeCreatorUrl(value)
  if (!normalized) return ''

  try {
    const url = new URL(normalized)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    if (host !== 'tiktok.com' && !host.endsWith('.tiktok.com')) return ''
    return url.pathname.match(/\/video\/(\d+)/i)?.[1] || ''
  } catch {
    return ''
  }
}

function normalizeTikTokVideoId(value = '') {
  return String(value || '').trim().match(/^\d{6,}$/)?.[0] || ''
}

function getTikTokEmbedUrl(videoId) {
  return videoId ? `https://www.tiktok.com/player/v1/${videoId}` : ''
}

export async function resolveTikTokVideo(value = '', { signal } = {}) {
  const originalUrl = normalizeCreatorUrl(value)
  if (!originalUrl || detectCreatorPlatform(originalUrl) !== 'tiktok') {
    throw new Error('Añade un enlace válido de TikTok.')
  }

  const directVideoId = getTikTokVideoId(originalUrl)
  if (directVideoId) {
    return {
      original_url:originalUrl,
      resolved_url:originalUrl,
      video_id:directVideoId,
      embed_url:getTikTokEmbedUrl(directVideoId),
    }
  }

  if (tiktokResolutionCache.has(originalUrl)) return tiktokResolutionCache.get(originalUrl)

  const response = await fetch(`${TIKTOK_RESOLVE_ENDPOINT}?url=${encodeURIComponent(originalUrl)}`, {
    signal,
    headers:{ Accept:'application/json' },
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error || 'No se pudo resolver el enlace corto de TikTok.')

  const videoId = normalizeTikTokVideoId(data?.video_id)
  const resolvedUrl = normalizeCreatorUrl(data?.resolved_url)
  if (!videoId || getTikTokVideoId(resolvedUrl) !== videoId) {
    throw new Error('TikTok no devolvió un vídeo válido para este enlace.')
  }

  const result = {
    original_url:originalUrl,
    resolved_url:resolvedUrl,
    video_id:videoId,
    embed_url:getTikTokEmbedUrl(videoId),
  }
  tiktokResolutionCache.set(originalUrl, result)
  return result
}

export function getInstagramPostPath(value = '') {
  const normalized = normalizeCreatorUrl(value)
  if (!normalized) return ''

  try {
    const url = new URL(normalized)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    if (host !== 'instagram.com' && !host.endsWith('.instagram.com')) return ''
    const match = url.pathname.match(/^\/(p|reel|tv)\/([a-zA-Z0-9_-]+)/i)
    return match ? `${match[1].toLowerCase()}/${match[2]}` : ''
  } catch {
    return ''
  }
}

export function getCreatorVideoEmbed(content = {}) {
  const url = normalizeCreatorUrl(content.url)
  const platform = detectCreatorPlatform(url)
  if (!url) return null

  if (platform === 'youtube') {
    const videoId = getYouTubeVideoId(url)
    if (!videoId) return null
    return {
      platform,
      src:`https://www.youtube-nocookie.com/embed/${videoId}?playsinline=1&rel=0&hl=es`,
      vertical:false,
    }
  }

  if (platform === 'tiktok') {
    const videoId = getTikTokVideoId(url)
      || normalizeTikTokVideoId(content.video_id)
      || getTikTokVideoId(content.resolved_url)
    if (!videoId) return null
    return {
      platform,
      src:`https://www.tiktok.com/player/v1/${videoId}?autoplay=0&loop=0`,
      vertical:true,
    }
  }

  if (platform === 'instagram') {
    const postPath = getInstagramPostPath(url)
    if (!postPath) return null
    return {
      platform,
      src:`https://www.instagram.com/${postPath}/embed/?locale=es`,
      vertical:true,
    }
  }

  return null
}

export async function resolveCreatorVideoEmbed(content = {}, { signal } = {}) {
  const existingEmbed = getCreatorVideoEmbed(content)
  if (existingEmbed) return existingEmbed
  if (detectCreatorPlatform(content.url) !== 'tiktok') return null

  const resolved = await resolveTikTokVideo(content.url, { signal })
  return {
    platform:'tiktok',
    src:`${resolved.embed_url}?autoplay=0&loop=0`,
    vertical:true,
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

  const tiktokResolution = platform === 'tiktok'
    ? await resolveTikTokVideo(url, { signal })
    : null
  const metadataUrl = tiktokResolution?.resolved_url || url

  const endpoint = platform === 'youtube'
    ? `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    : `https://www.tiktok.com/oembed?url=${encodeURIComponent(metadataUrl)}`
  const response = await fetch(endpoint, { signal })
  if (!response.ok) throw new Error('No se han podido leer los datos de este enlace.')
  const data = await response.json()
  return {
    title:String(data?.title || '').trim(),
    thumbnail_url:normalizeCreatorThumbnail(data?.thumbnail_url),
    video_id:tiktokResolution?.video_id || '',
    resolved_url:tiktokResolution?.resolved_url || '',
    embed_url:tiktokResolution?.embed_url || '',
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

function getNextCreatorPublishedAt(contents = []) {
  const latestTimestamp = (Array.isArray(contents) ? contents : []).reduce((latest, content) => {
    const timestamp = new Date(content?.published_at || 0).getTime()
    return Number.isFinite(timestamp) ? Math.max(latest, timestamp) : latest
  }, 0)
  return new Date(Math.max(Date.now(), latestTimestamp + 1)).toISOString()
}

export function getOrderedCreatorContents(creator, { publishedOnly = false } = {}) {
  const contents = normalizeContentOrder(creator?.contents)
  return publishedOnly ? contents.filter(content => content.status === 'published') : contents
}

export function getCreatorContentsNewestFirst(creator, { publishedOnly = false } = {}) {
  return getOrderedCreatorContents(creator, { publishedOnly })
    .sort((first, second) => {
      const dateDiff = new Date(second.published_at || second.created_at || 0).getTime()
        - new Date(first.published_at || first.created_at || 0).getTime()
      return dateDiff || (Number(second.sort_order) || 0) - (Number(first.sort_order) || 0)
    })
}

export function getCreatorFeaturedContentIds(creator) {
  const publishedContents = getCreatorContentsNewestFirst(creator, { publishedOnly:true })
  const publishedIds = new Set(publishedContents.map(content => String(content.id)))

  if (!Array.isArray(creator?.featured_content_ids)) {
    return publishedContents
      .slice(0, CREATOR_FEATURED_CONTENTS)
      .map(content => String(content.id))
  }

  return [...new Set(creator.featured_content_ids.map(id => String(id || '')).filter(id => publishedIds.has(id)))]
    .slice(0, CREATOR_FEATURED_CONTENTS)
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
  const contents = normalizeContentOrder(creator?.contents)
  return {
    ...creator,
    contents,
    featured_content_ids:getCreatorFeaturedContentIds({ ...creator, contents }),
  }
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
  const creator = readLocalCreators().find(item => item.owner_id === userId)
  return creator ? normalizeCreatorRecord(creator) : null
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
    featured_content_ids:existing ? getCreatorFeaturedContentIds(existing) : [],
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

  const url = normalizeCreatorUrl(input.url)
  if (!url) throw new Error('Añade un enlace válido que empiece por https://')
  const platform = input.platform || detectCreatorPlatform(url)
  const existing = existingIndex >= 0 ? contents[existingIndex] : null
  const suppliedResolvedUrl = normalizeCreatorUrl(input.resolved_url || existing?.resolved_url)
  const tiktokVideoId = platform === 'tiktok'
    ? getTikTokVideoId(url)
      || normalizeTikTokVideoId(input.video_id || existing?.video_id)
      || getTikTokVideoId(suppliedResolvedUrl)
    : ''
  const resolvedUrl = tiktokVideoId && getTikTokVideoId(suppliedResolvedUrl) === tiktokVideoId
    ? suppliedResolvedUrl
    : tiktokVideoId && getTikTokVideoId(url) === tiktokVideoId ? url : ''
  const content = {
    id:existing?.id || makeId('content'),
    title:String(input.title || '').trim(),
    summary:String(input.summary || '').trim(),
    url,
    platform,
    video_id:tiktokVideoId,
    resolved_url:resolvedUrl,
    embed_url:getTikTokEmbedUrl(tiktokVideoId),
    format:String(input.format || 'video').trim(),
    topic:String(input.topic || '').trim(),
    canton:String(input.canton || 'Toda Suiza').trim(),
    duration:String(input.duration || '').trim(),
    thumbnail_url:normalizeCreatorThumbnail(input.thumbnail_url),
    thumbnail_kind:input.thumbnail_kind === 'auto' ? 'auto' : input.thumbnail_url ? 'custom' : '',
    status:input.status === 'draft' ? 'draft' : 'published',
    published_at:existing?.published_at || getNextCreatorPublishedAt(contents),
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
  const currentFeaturedIds = getCreatorFeaturedContentIds(creator)
  const featuredWithoutCurrent = currentFeaturedIds.filter(id => id !== content.id)
  const nextFeaturedIds = content.status !== 'published'
    ? featuredWithoutCurrent
    : existingIndex < 0 && featuredWithoutCurrent.length < CREATOR_FEATURED_CONTENTS
      ? [content.id, ...featuredWithoutCurrent]
      : currentFeaturedIds
  const now = new Date().toISOString()
  creators[creatorIndex] = {
    ...creator,
    contents:orderedContents,
    featured_content_ids:nextFeaturedIds,
    selection_updated_at:now,
    updated_at:now,
  }
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
  const currentFeaturedIds = getCreatorFeaturedContentIds(creator).filter(id => id !== contentId)
  const nextFeaturedIds = status === 'draft' || currentFeaturedIds.length >= CREATOR_FEATURED_CONTENTS
    ? currentFeaturedIds
    : [contentId, ...currentFeaturedIds]
  const now = new Date().toISOString()
  creators[creatorIndex] = { ...creator, contents, featured_content_ids:nextFeaturedIds, selection_updated_at:now, updated_at:now }
  writeLocalCreators(creators)
  return creators[creatorIndex]
}

export function setCreatorContentFeatured(userId, contentId, featured) {
  const creators = readLocalCreators()
  const creatorIndex = creators.findIndex(creator => creator.owner_id === userId)
  if (creatorIndex < 0) return null

  const creator = creators[creatorIndex]
  const content = getOrderedCreatorContents(creator).find(item => item.id === contentId)
  if (!content || content.status !== 'published') {
    throw new Error('Solo puedes destacar publicaciones publicadas.')
  }

  const currentFeaturedIds = getCreatorFeaturedContentIds(creator)
  const withoutCurrent = currentFeaturedIds.filter(id => id !== contentId)
  if (featured && withoutCurrent.length >= CREATOR_FEATURED_CONTENTS) {
    throw new Error(`Puedes destacar un máximo de ${CREATOR_FEATURED_CONTENTS} publicaciones.`)
  }

  const now = new Date().toISOString()
  creators[creatorIndex] = {
    ...creator,
    featured_content_ids:featured ? [contentId, ...withoutCurrent] : withoutCurrent,
    selection_updated_at:now,
    updated_at:now,
  }
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
    featured_content_ids:getCreatorFeaturedContentIds(creator).filter(id => id !== contentId),
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

// Los votos se guardaban como lista de actores sin fecha, asi que no habia
// forma de saber si un "me ayudo" era de hoy o del ano pasado. Ahora se guarda
// { actor, at }, y se sigue leyendo el formato viejo tratandolo como sin fecha.
function readInteractionEntries(action, targetType, targetId) {
  const stored = readInteractions()[getInteractionKey(action, targetType, targetId)]
  if (!Array.isArray(stored)) return []
  return stored.map(entry => (
    entry && typeof entry === 'object'
      ? { actor:String(entry.actor || ''), at:Number(entry.at) || 0 }
      : { actor:String(entry), at:0 }
  )).filter(entry => entry.actor)
}

function getInteractionActors(action, targetType, targetId) {
  return readInteractionEntries(action, targetType, targetId).map(entry => entry.actor)
}

// Votos dentro de una ventana temporal. Los sin fecha (los previos al cambio)
// quedan fuera: no podemos afirmar que sean recientes.
function countRecentInteractions(action, targetType, targetId, sinceMs) {
  if (!sinceMs) return readInteractionEntries(action, targetType, targetId).length
  return readInteractionEntries(action, targetType, targetId)
    .filter(entry => entry.at >= sinceMs)
    .length
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
  const current = readInteractionEntries(action, targetType, targetId)
  store[key] = current.some(entry => entry.actor === actor)
    ? current.filter(entry => entry.actor !== actor)
    : [...current, { actor, at:Date.now() }]
  window.localStorage.setItem(CREATOR_INTERACTIONS_KEY, JSON.stringify(store))
  window.dispatchEvent(new CustomEvent(CREATOR_INTERACTIONS_EVENT))
  return getCreatorInteractionState({ action, targetType, targetId, actorId, baseCount })
}

export function getFollowedCreatorIds(actorId = '') {
  if (!actorId) return []
  const actor = getInteractionActor(actorId)
  const prefix = 'saved:creator:'
  return Object.entries(readInteractions())
    .filter(([key, stored]) => {
      if (!key.startsWith(prefix) || !Array.isArray(stored)) return false
      // Entradas nuevas { actor, at } y antiguas (solo el actor como texto).
      return stored.some(entry => (entry && typeof entry === 'object' ? String(entry.actor) : String(entry)) === actor)
    })
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

// Reduce la imagen hasta el tamano maximo indicado conservando su proporcion
// original. El archivo resultante no se fuerza a un lienzo cuadrado o 16:9:
// las cards se encargan de centrarlo con object-fit: contain.
export function prepareLocalImage(file, { width, height, quality = .8 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) {
      reject(new Error('Selecciona una imagen JPG, PNG o WebP.'))
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      reject(new Error('La imagen pesa más de 10 MB. Elige una más ligera.'))
      return
    }

    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      const scale = Math.min(width / image.width, height / image.height)
      const drawWidth = image.width * scale
      const drawHeight = image.height * scale
      canvas.width = Math.max(1, Math.round(drawWidth))
      canvas.height = Math.max(1, Math.round(drawHeight))
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(objectUrl)
      resolve(canvas.toDataURL('image/webp', quality))
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('No se pudo leer la imagen seleccionada.'))
    }
    image.src = objectUrl
  })
}

// Formato editorial deducido del enlace. La usan el panel del creador y la
// pagina de publicar contenido, asi que vive aqui y no en una de las dos.
export function detectCreatorFormat(value, platform) {
  const url = String(value || '').toLowerCase()
  if (platform === 'tiktok') return 'reel'
  if (platform === 'instagram') return url.includes('/reel') ? 'reel' : 'publicacion'
  if (platform === 'spotify') return 'podcast'
  if (platform === 'web') return 'artículo'
  if (platform === 'facebook' || platform === 'linkedin') return 'publicacion'
  return 'video'
}

// ── Descubrimiento por tema y por utilidad ─────────────────────
// El directorio deja de ser "creador -> sus videos" para poder responder
// "que necesito saber de Suiza -> quien lo ha explicado bien".

const DAY_MS = 24 * 60 * 60 * 1000

export function getContentHelpfulCount(content, { days = 0 } = {}) {
  const base = Math.max(0, Number(content?.helpful_count) || 0)
  const since = days ? Date.now() - days * DAY_MS : 0
  // La base historica solo cuenta cuando no se pide ventana temporal.
  return (since ? 0 : base) + countRecentInteractions('helpful', 'content', content?.id, since)
}

export function getCreatorHelpfulCount(creator, { days = 0 } = {}) {
  const since = days ? Date.now() - days * DAY_MS : 0
  const profile = (since ? 0 : Math.max(0, Number(creator?.helpful_count) || 0))
    + countRecentInteractions('helpful', 'creator', creator?.id, since)
  const contents = getOrderedCreatorContents(creator, { publishedOnly:true })
    .reduce((total, content) => total + getContentHelpfulCount(content, { days }), 0)
  return profile + contents
}

// Todas las publicaciones publicadas, con su creador al lado.
export function getAllCreatorContents({ topic = '' } = {}) {
  return getAllCreators().flatMap(creator => (
    getOrderedCreatorContents(creator, { publishedOnly:true })
      .filter(content => !topic || content.topic === topic)
      .map(content => ({ content, creator }))
  ))
}

export function getMostHelpfulContents({ topic = '', days = 0, limit = 8 } = {}) {
  return getAllCreatorContents({ topic })
    .map(entry => ({ ...entry, helpful:getContentHelpfulCount(entry.content, { days }) }))
    .filter(entry => entry.helpful > 0)
    .sort((first, second) => second.helpful - first.helpful
      || new Date(second.content.published_at) - new Date(first.content.published_at))
    .slice(0, limit)
}

export function getLatestContents({ topic = '', limit = 8 } = {}) {
  return getAllCreatorContents({ topic })
    .sort((first, second) => new Date(second.content.published_at) - new Date(first.content.published_at))
    .slice(0, limit)
}

export function getTopHelpfulCreators({ topic = '', days = 0, limit = 5 } = {}) {
  return getAllCreators()
    .filter(creator => !topic || (creator.topics || []).includes(topic))
    .map(creator => ({ creator, helpful:getCreatorHelpfulCount(creator, { days }) }))
    .filter(entry => entry.helpful > 0)
    .sort((first, second) => second.helpful - first.helpful
      || String(first.creator.name).localeCompare(String(second.creator.name), 'es'))
    .slice(0, limit)
}

// Posicion del creador dentro de un tema, para el "#3 en Trabajo" del perfil.
// Sin tema devuelve la posicion global; con tema, la de ese tema.
export function getCreatorHelpRank(creator, { topic = '' } = {}) {
  if (!creator) return 0
  const ranking = getTopHelpfulCreators({ topic, limit:Number.MAX_SAFE_INTEGER })
  const position = ranking.findIndex(entry => entry.creator.id === creator.id)
  return position < 0 ? 0 : position + 1
}

export function getCreatorTopicRank(creator, topic) {
  return topic ? getCreatorHelpRank(creator, { topic }) : 0
}

// Los seis que encabezan el perfil. El resto sigue publicado y aparece en "Todos".
export function getFeaturedCreatorContents(creator) {
  const publishedById = new Map(
    getCreatorContentsNewestFirst(creator, { publishedOnly:true })
      .map(content => [String(content.id), content]),
  )
  return getCreatorFeaturedContentIds(creator)
    .map(id => publishedById.get(String(id)))
    .filter(Boolean)
    .slice(0, CREATOR_FEATURED_CONTENTS)
}
