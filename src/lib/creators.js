export const CREATOR_MAX_CONTENTS = 6

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

export const CREATOR_PLATFORMS = [
  { id:'youtube', label:'YouTube', short:'YT', color:'#DC2626', bg:'#FEF2F2' },
  { id:'instagram', label:'Instagram', short:'IG', color:'#BE185D', bg:'#FDF2F8' },
  { id:'facebook', label:'Facebook', short:'FB', color:'#1D4ED8', bg:'#EFF6FF' },
  { id:'tiktok', label:'TikTok', short:'TK', color:'#111827', bg:'#F3F4F6' },
  { id:'linkedin', label:'LinkedIn', short:'IN', color:'#0369A1', bg:'#E0F2FE' },
  { id:'spotify', label:'Podcast', short:'SP', color:'#047857', bg:'#ECFDF5' },
  { id:'web', label:'Web / blog', short:'WEB', color:'#1D4ED8', bg:'#EFF6FF' },
]

const CREATOR_STORE_KEY = 'latido_creator_studio_v1'
const CREATOR_METRICS_KEY = 'latido_creator_metrics_v1'
const CREATOR_UPDATE_EVENT = 'latido:creators-updated'

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
      { platform:'youtube', url:'https://www.youtube.com', label:'YouTube' },
      { platform:'instagram', url:'https://www.instagram.com', label:'Instagram' },
    ],
    verified:true,
    demo:true,
    status:'published',
    accent:'#2563EB',
    created_at:'2026-06-14T10:00:00.000Z',
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
      { platform:'instagram', url:'https://www.instagram.com', label:'Instagram' },
      { platform:'tiktok', url:'https://www.tiktok.com', label:'TikTok' },
    ],
    verified:true,
    demo:true,
    status:'published',
    accent:'#EA580C',
    created_at:'2026-06-20T10:00:00.000Z',
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
      { platform:'youtube', url:'https://www.youtube.com', label:'YouTube' },
      { platform:'web', url:'https://example.com', label:'Blog' },
    ],
    verified:false,
    demo:true,
    status:'published',
    accent:'#7C3AED',
    created_at:'2026-07-01T10:00:00.000Z',
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

export function getAllCreators({ includeUnpublished = false } = {}) {
  const all = [...DEMO_CREATORS, ...readLocalCreators()]
  return includeUnpublished ? all : all.filter(creator => creator.status === 'published')
}

export function getCreatorBySlug(slug = '') {
  return getAllCreators({ includeUnpublished:true }).find(creator => creator.slug === slug) || null
}

export function getCreatorForUser(userId) {
  if (!userId) return null
  return readLocalCreators().find(creator => creator.owner_id === userId) || null
}

export function saveCreatorProfile(userId, input = {}) {
  if (!userId) throw new Error('Necesitas iniciar sesión para crear un perfil.')

  const creators = readLocalCreators()
  const existingIndex = creators.findIndex(creator => creator.owner_id === userId)
  const existing = existingIndex >= 0 ? creators[existingIndex] : null
  const name = String(input.name || '').trim()
  const baseSlug = slugifyCreator(name) || 'creador'
  const usedSlugs = new Set(getAllCreators({ includeUnpublished:true }).filter(creator => creator.owner_id !== userId).map(creator => creator.slug))
  let slug = existing?.slug || baseSlug
  if (usedSlugs.has(slug)) slug = `${baseSlug}-${String(userId).slice(0, 6).toLowerCase()}`

  const profile = {
    id:existing?.id || makeId('creator'),
    owner_id:userId,
    slug,
    name,
    handle:String(input.handle || '').trim(),
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
        }))
        .filter(social => social.url)
      : [],
    verified:false,
    demo:false,
    status:input.status === 'draft' ? 'draft' : 'published',
    accent:existing?.accent || '#2563EB',
    created_at:existing?.created_at || new Date().toISOString(),
    updated_at:new Date().toISOString(),
    contents:existing?.contents || [],
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
  const contents = Array.isArray(creator.contents) ? [...creator.contents] : []
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
    status:input.status === 'draft' ? 'draft' : 'published',
    published_at:existing?.published_at || new Date().toISOString(),
    updated_at:new Date().toISOString(),
    demo:false,
  }

  if (existingIndex >= 0) contents[existingIndex] = content
  else contents.unshift(content)
  creators[creatorIndex] = { ...creator, contents, updated_at:new Date().toISOString() }
  writeLocalCreators(creators)
  return content
}

export function setCreatorContentStatus(userId, contentId, status) {
  const creators = readLocalCreators()
  const creatorIndex = creators.findIndex(creator => creator.owner_id === userId)
  if (creatorIndex < 0) return null

  const creator = creators[creatorIndex]
  const contents = (creator.contents || []).map(content => (
    content.id === contentId ? { ...content, status:status === 'draft' ? 'draft' : 'published', updated_at:new Date().toISOString() } : content
  ))
  creators[creatorIndex] = { ...creator, contents, updated_at:new Date().toISOString() }
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
    contents:(creator.contents || []).filter(content => content.id !== contentId),
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

export function getCreatorMetrics(creator) {
  const metrics = readMetrics()
  const contentClicks = (creator?.contents || []).reduce(
    (total, content) => total + Number(metrics[`${creator.id}:content_click:${content.id}`] || 0),
    0,
  )
  const socialClicks = (creator?.socials || []).reduce(
    (total, social) => total + Number(metrics[`${creator.id}:social_click:${social.platform}`] || 0),
    0,
  )

  return {
    profileViews:Number(metrics[`${creator?.id}:profile_view`] || 0),
    contentClicks,
    socialClicks,
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
