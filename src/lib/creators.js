import { supabase } from './supabase.js'
import { hasAnalyticsConsent } from './cookieConsent.js'

// Seis destacados, no un tope: el creador elige que seis encabezan su perfil y
// el resto se sigue publicando y aparece en "Ultimos contenidos".
export const CREATOR_FEATURED_CONTENTS = 6

// TikTok requires the fullscreen feature policy even when its fullscreen button is
// hidden. Without it, the player can render normally but fail as soon as playback
// starts. Keep the iframe permissions shared and tested so every social player gets
// the same interactive capabilities.
export const CREATOR_VIDEO_IFRAME_PERMISSIONS = Object.freeze({
  allow:'accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share',
  allowFullScreen:true,
})
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

const CREATOR_IMPRESSIONS_SESSION_KEY = 'latido_creator_impressions_v1'
const CREATOR_DIRECTORY_CACHE_KEY = 'latido_creator_directory_cache_v1'
const CREATOR_UPDATE_EVENT = 'latido:creators-updated'
const CREATOR_INTERACTIONS_EVENT = 'latido:creator-interactions-updated'
const TIKTOK_RESOLVE_ENDPOINT = '/api/tiktok-resolve'
const tiktokResolutionCache = new Map()
let creatorCache = []
let creatorMetricsCache = {}
let creatorInteractionsCache = []
let creatorDirectoryState = { loaded:false, loading:false, error:null, userId:'' }
let creatorRefreshPromise = null
let creatorCacheHydrated = false

function safeParse(raw, fallback) {
  try {
    return JSON.parse(raw) ?? fallback
  } catch {
    return fallback
  }
}

function readLocalCreators() {
  if (!creatorCacheHydrated && typeof window !== 'undefined') {
    creatorCacheHydrated = true
    const stored = safeParse(window.localStorage.getItem(CREATOR_DIRECTORY_CACHE_KEY), [])
    if (Array.isArray(stored)) creatorCache = stored
  }
  return creatorCache
}

function writeLocalCreators(creators) {
  creatorCache = Array.isArray(creators) ? creators : []
  creatorCacheHydrated = true
  if (typeof window !== 'undefined') {
    const publicSnapshot = creatorCache
      .filter(creator => creator.status === 'published' && creator.active !== false)
      .map(creator => ({
        ...creator,
        socials:(creator.socials || []).map(social => ({
          platform:social.platform,
          url:social.url,
          label:social.label,
        })),
        contents:(creator.contents || []).filter(content => content.status === 'published' && content.active !== false),
      }))
    try {
      window.localStorage.setItem(CREATOR_DIRECTORY_CACHE_KEY, JSON.stringify(publicSnapshot))
    } catch {}
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CREATOR_UPDATE_EVENT))
}

function dispatchCreatorInteractionsUpdate() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CREATOR_INTERACTIONS_EVENT))
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
  const normalized = normalizeCreatorUrl(value)
  if (!normalized) return 'web'

  const host = new URL(normalized).hostname.toLowerCase().replace(/^www\./, '')
  const belongsTo = domain => host === domain || host.endsWith(`.${domain}`)
  if (host === 'youtu.be' || belongsTo('youtube.com')) return 'youtube'
  if (belongsTo('instagram.com')) return 'instagram'
  if (host === 'fb.watch' || belongsTo('facebook.com')) return 'facebook'
  if (belongsTo('tiktok.com')) return 'tiktok'
  if (belongsTo('linkedin.com')) return 'linkedin'
  if (belongsTo('spotify.com') || host === 'podcasts.apple.com' || belongsTo('ivoox.com')) return 'spotify'
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
      src:`https://www.tiktok.com/player/v1/${videoId}?autoplay=0&loop=0&fullscreen_button=0`,
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
    src:`${resolved.embed_url}?autoplay=0&loop=0&fullscreen_button=0`,
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
  return publishedOnly
    ? contents.filter(content => content.status === 'published' && content.active !== false && normalizeCreatorUrl(content.url))
    : contents
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
  const publishedContents = getCreatorContentsNewestFirst(creator, { publishedOnly:true })
  const checks = [
    {
      id:'profile',
      done:Boolean(creator?.bio?.trim() && creator?.tagline?.trim()),
      label:'Completa tu presentación',
      detail:'Cuenta quién eres y qué compartes',
      to:'/creadores/alta?section=info',
    },
    {
      id:'topics',
      done:Boolean(creator?.topics?.length && creator?.canton),
      label:'Indica tus temas y ubicación',
      detail:'Ayuda a encontrarte en Latido',
      to:'/creadores/alta?section=topics',
    },
    {
      id:'socials',
      done:(creator?.socials || []).length >= 2,
      label:'Conecta al menos 2 redes',
      detail:`${Math.min((creator?.socials || []).length, 2)}/2 conectadas`,
      to:'/creadores/alta?section=networks',
    },
    {
      id:'contents',
      done:publishedContents.length >= CREATOR_FEATURED_CONTENTS,
      label:`Añade al menos ${CREATOR_FEATURED_CONTENTS} contenidos`,
      detail:`${Math.min(publishedContents.length, CREATOR_FEATURED_CONTENTS)}/${CREATOR_FEATURED_CONTENTS} publicados`,
      to:'/publicar-contenido',
    },
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

function normalizeCreatorContentRow(row = {}) {
  const url = normalizeCreatorUrl(row.url)
  const platform = detectCreatorPlatform(url)
  return {
    ...row,
    url,
    platform,
    video_id:platform === 'tiktok' ? normalizeTikTokVideoId(row.video_id) : '',
    resolved_url:normalizeCreatorUrl(row.resolved_url),
    embed_url:platform === 'tiktok' ? getTikTokEmbedUrl(normalizeTikTokVideoId(row.video_id)) : '',
    thumbnail_url:normalizeCreatorThumbnail(row.thumbnail_url),
  }
}

function mapCreatorRows(profileRows = [], contentRows = [], privateRows = []) {
  const contentsByCreator = new Map()
  const privateByCreator = new Map((privateRows || []).map(row => [row.creator_id, row]))
  for (const row of contentRows || []) {
    const creatorContents = contentsByCreator.get(row.creator_id) || []
    creatorContents.push(normalizeCreatorContentRow(row))
    contentsByCreator.set(row.creator_id, creatorContents)
  }

  return (profileRows || []).map(profile => {
    const followerRanges = privateByCreator.get(profile.id)?.follower_ranges || {}
    return normalizeCreatorRecord({
      ...profile,
      slug:slugifyCreator(profile.slug),
      handle:/^@[a-z0-9._-]{3,}$/.test(String(profile.handle || '').toLowerCase())
        ? normalizeCreatorHandle(profile.handle)
        : '',
      avatar_url:normalizeCreatorThumbnail(profile.avatar_url),
      topics:Array.isArray(profile.topics) ? profile.topics : [],
      socials:(Array.isArray(profile.socials) ? profile.socials : [])
        .map(social => {
          const url = normalizeCreatorUrl(social?.url)
          if (!url) return null
          const platform = detectCreatorPlatform(url)
          return {
            platform,
            url,
            label:getCreatorPlatform(platform).label,
            follower_range:getCreatorFollowerRange(followerRanges?.[platform])?.id || '',
          }
        })
        .filter(Boolean),
      featured_content_ids:Array.isArray(profile.featured_content_ids) ? profile.featured_content_ids : [],
      contents:contentsByCreator.get(profile.id) || [],
    })
  })
}

export function getCreatorDirectoryState() {
  return { ...creatorDirectoryState }
}

export async function refreshCreatorDirectory(userId = '', { force = false } = {}) {
  const normalizedUserId = String(userId || '')
  if (!force && creatorDirectoryState.loaded && creatorDirectoryState.userId === normalizedUserId) {
    return getAllCreators({ includeUnpublished:true })
  }
  if (creatorRefreshPromise) {
    if (creatorDirectoryState.userId === normalizedUserId) return creatorRefreshPromise
    return creatorRefreshPromise.catch(() => null).then(() => refreshCreatorDirectory(normalizedUserId, { force:true }))
  }

  if (creatorDirectoryState.userId !== normalizedUserId) {
    creatorCache = readLocalCreators()
      .filter(creator => creator.status === 'published' && creator.active !== false)
      .map(creator => ({
        ...creator,
        contents:(creator.contents || []).filter(content => content.status === 'published' && content.active !== false),
      }))
    creatorInteractionsCache = []
    creatorMetricsCache = {}
  }

  creatorDirectoryState = { ...creatorDirectoryState, loading:true, error:null, userId:normalizedUserId }
  creatorRefreshPromise = (async () => {
    const profileRequest = supabase.from('creator_profiles').select('*').order('updated_at', { ascending:false })
    const contentRequest = supabase.from('creator_contents').select('*').order('published_at', { ascending:false })
    const interactionRequest = normalizedUserId
      ? supabase.from('creator_interactions').select('action,target_type,target_id,created_at').eq('actor_id', normalizedUserId)
      : Promise.resolve({ data:[], error:null })
    const metricsRequest = normalizedUserId
      ? supabase.from('creator_metrics').select('creator_id,metric,content_id,count')
      : Promise.resolve({ data:[], error:null })
    const privateRequest = normalizedUserId
      ? supabase.from('creator_private_data').select('creator_id,follower_ranges')
      : Promise.resolve({ data:[], error:null })

    const [profiles, contents, interactions, metrics, privateData] = await Promise.all([
      profileRequest,
      contentRequest,
      interactionRequest,
      metricsRequest,
      privateRequest,
    ])
    const error = profiles.error || contents.error || interactions.error || metrics.error || privateData.error
    if (error) throw error

    creatorCache = mapCreatorRows(profiles.data, contents.data, privateData.data)
    creatorInteractionsCache = interactions.data || []
    creatorMetricsCache = Object.fromEntries((metrics.data || []).map(row => [
      [row.creator_id, row.metric, row.content_id].filter(Boolean).join(':'),
      Number(row.count) || 0,
    ]))
    creatorDirectoryState = { loaded:true, loading:false, error:null, userId:normalizedUserId }
    writeLocalCreators(creatorCache)
    dispatchCreatorInteractionsUpdate()
    return getAllCreators({ includeUnpublished:true })
  })().catch(error => {
    creatorDirectoryState = { loaded:true, loading:false, error, userId:normalizedUserId }
    writeLocalCreators(creatorCache)
    throw error
  }).finally(() => {
    creatorRefreshPromise = null
  })

  return creatorRefreshPromise
}

export function getAllCreators({ includeUnpublished = false } = {}) {
  const all = readLocalCreators().map(normalizeCreatorRecord)
  return includeUnpublished
    ? all
    : all.filter(creator => creator.status === 'published' && creator.active !== false)
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

export async function saveCreatorProfile(userId, input = {}) {
  if (!userId) throw new Error('Necesitas iniciar sesión para crear un perfil.')

  const existing = getCreatorForUser(userId)
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

  const normalizedSocials = Array.isArray(input.socials)
    ? input.socials
      .map(social => {
        const url = normalizeCreatorUrl(social.url)
        const platform = detectCreatorPlatform(url)
        return url ? {
          platform,
          url,
          label:getCreatorPlatform(platform).label,
          follower_range:getCreatorFollowerRange(social.follower_range)?.id || '',
        } : null
      })
      .filter(Boolean)
    : []
  const followerRanges = Object.fromEntries(
    normalizedSocials
      .filter(social => social.follower_range)
      .map(social => [social.platform, social.follower_range]),
  )
  const profile = {
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
    socials:normalizedSocials.map(social => ({
      platform:social.platform,
      url:social.url,
      label:social.label,
    })),
    active:input.active !== false,
    status:input.status === 'draft' ? 'draft' : 'published',
    updated_at:new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('creator_profiles')
    .upsert(profile, { onConflict:'owner_id' })
    .select('*')
    .single()
  if (error) {
    if (error.code === '23505' || /duplicate|unique/i.test(error.message || '')) {
      throw new Error('Ese usuario o nombre de perfil ya está en uso. Elige uno diferente.')
    }
    throw error
  }

  const { error:privateError } = await supabase.from('creator_private_data').upsert({
    creator_id:data.id,
    owner_id:userId,
    follower_ranges:followerRanges,
    updated_at:new Date().toISOString(),
  }, { onConflict:'creator_id' })
  if (privateError) throw privateError

  await refreshCreatorDirectory(userId, { force:true })
  return getCreatorForUser(userId) || data
}

export async function saveCreatorContent(userId, input = {}) {
  const creator = getCreatorForUser(userId)
  if (!creator) throw new Error('Primero tienes que crear tu perfil público.')
  const contents = normalizeContentOrder(creator.contents)
  const existingIndex = input.id ? contents.findIndex(content => content.id === input.id) : -1

  const url = normalizeCreatorUrl(input.url)
  if (!url) throw new Error('Añade un enlace válido que empiece por https://')
  const platform = detectCreatorPlatform(url)
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
    ...(existing?.id ? { id:existing.id } : {}),
    creator_id:creator.id,
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
    active:input.active !== false,
    status:input.status === 'draft' ? 'draft' : 'published',
    published_at:existing?.published_at || getNextCreatorPublishedAt(contents),
    updated_at:new Date().toISOString(),
    sort_order:Number(existing?.sort_order) || contents.length + 1,
  }

  const query = existing?.id
    ? supabase.from('creator_contents').update(content).eq('id', existing.id).eq('creator_id', creator.id)
    : supabase.from('creator_contents').insert(content)
  const { data, error } = await query.select('*').single()
  if (error) throw error

  const currentFeaturedIds = getCreatorFeaturedContentIds(creator).filter(id => id !== data.id)
  const nextFeaturedIds = data.status === 'published' && data.active !== false && existingIndex < 0 && currentFeaturedIds.length < CREATOR_FEATURED_CONTENTS
    ? [data.id, ...currentFeaturedIds]
    : existingIndex >= 0 && data.status === 'published' && data.active !== false && getCreatorFeaturedContentIds(creator).includes(data.id)
      ? [data.id, ...currentFeaturedIds]
      : currentFeaturedIds
  const now = new Date().toISOString()
  const { error:profileError } = await supabase
    .from('creator_profiles')
    .update({ featured_content_ids:nextFeaturedIds, selection_updated_at:now, updated_at:now })
    .eq('id', creator.id)
    .eq('owner_id', userId)
  // El contenido ya está guardado. Un fallo secundario al actualizar la
  // selección no debe provocar que el usuario repita la publicación y cree un
  // duplicado; podrá destacarlo manualmente después.
  if (profileError && import.meta.env?.DEV) console.warn('Creator featured selection could not be updated:', profileError.message)

  await refreshCreatorDirectory(userId, { force:true })
  return getCreatorForUser(userId)?.contents.find(item => item.id === data.id) || data
}

export async function moveCreatorContent(userId, contentId, direction) {
  const creator = getCreatorForUser(userId)
  if (!creator) return null
  const contents = normalizeContentOrder(creator.contents)
  const currentIndex = contents.findIndex(content => content.id === contentId)
  const offset = direction === 'up' ? -1 : direction === 'down' ? 1 : Number(direction) || 0
  const targetIndex = Math.max(0, Math.min(contents.length - 1, currentIndex + offset))
  if (currentIndex < 0 || currentIndex === targetIndex) return creator

  const [selected] = contents.splice(currentIndex, 1)
  contents.splice(targetIndex, 0, selected)
  const now = new Date().toISOString()
  const ordered = applyContentOrder(contents)
  const updates = await Promise.all(ordered.map(content => supabase
    .from('creator_contents')
    .update({ sort_order:content.sort_order })
    .eq('id', content.id)
    .eq('creator_id', creator.id)))
  const updateError = updates.find(result => result.error)?.error
  if (updateError) throw updateError
  const { error } = await supabase.from('creator_profiles')
    .update({ selection_updated_at:now, updated_at:now })
    .eq('id', creator.id)
    .eq('owner_id', userId)
  if (error) throw error
  await refreshCreatorDirectory(userId, { force:true })
  return getCreatorForUser(userId)
}

export async function setCreatorContentStatus(userId, contentId, status) {
  const creator = getCreatorForUser(userId)
  if (!creator) return null
  const nextStatus = status === 'draft' ? 'draft' : 'published'
  const currentFeaturedIds = getCreatorFeaturedContentIds(creator).filter(id => id !== contentId)
  const nextFeaturedIds = nextStatus === 'draft' || currentFeaturedIds.length >= CREATOR_FEATURED_CONTENTS
    ? currentFeaturedIds
    : [contentId, ...currentFeaturedIds]
  const now = new Date().toISOString()
  const { error:contentError } = await supabase.from('creator_contents')
    .update({ status:nextStatus, updated_at:now })
    .eq('id', contentId)
    .eq('creator_id', creator.id)
  if (contentError) throw contentError
  const { error:profileError } = await supabase.from('creator_profiles')
    .update({ featured_content_ids:nextFeaturedIds, selection_updated_at:now, updated_at:now })
    .eq('id', creator.id)
    .eq('owner_id', userId)
  // El estado principal ya se confirmó; no hacemos que el usuario repita la
  // acción si únicamente falla la selección secundaria de destacados.
  if (profileError && import.meta.env?.DEV) console.warn('Creator featured selection could not be updated:', profileError.message)
  await refreshCreatorDirectory(userId, { force:true })
  return getCreatorForUser(userId)
}

export async function setCreatorContentFeatured(userId, contentId, featured) {
  const creator = getCreatorForUser(userId)
  if (!creator) return null
  const content = getOrderedCreatorContents(creator).find(item => item.id === contentId)
  if (!content || content.status !== 'published' || content.active === false) {
    throw new Error('Solo puedes destacar contenido publicado.')
  }

  const currentFeaturedIds = getCreatorFeaturedContentIds(creator)
  const withoutCurrent = currentFeaturedIds.filter(id => id !== contentId)
  if (featured && withoutCurrent.length >= CREATOR_FEATURED_CONTENTS) {
    throw new Error(`Puedes destacar un máximo de ${CREATOR_FEATURED_CONTENTS} contenidos.`)
  }

  const now = new Date().toISOString()
  const { error } = await supabase.from('creator_profiles')
    .update({
      featured_content_ids:featured ? [contentId, ...withoutCurrent] : withoutCurrent,
      selection_updated_at:now,
      updated_at:now,
    })
    .eq('id', creator.id)
    .eq('owner_id', userId)
  if (error) throw error
  await refreshCreatorDirectory(userId, { force:true })
  return getCreatorForUser(userId)
}

export async function removeCreatorContent(userId, contentId) {
  const creator = getCreatorForUser(userId)
  if (!creator) return null
  const { error:deleteError } = await supabase.from('creator_contents')
    .delete()
    .eq('id', contentId)
    .eq('creator_id', creator.id)
  if (deleteError) throw deleteError
  const now = new Date().toISOString()
  const { error:profileError } = await supabase.from('creator_profiles')
    .update({
      featured_content_ids:getCreatorFeaturedContentIds(creator).filter(id => id !== contentId),
      selection_updated_at:now,
      updated_at:now,
    })
    .eq('id', creator.id)
    .eq('owner_id', userId)
  // La eliminación principal ya se confirmó; una selección obsoleta se filtra
  // al leer y se corregirá en la siguiente actualización del perfil.
  if (profileError && import.meta.env?.DEV) console.warn('Creator featured selection could not be cleaned:', profileError.message)
  await refreshCreatorDirectory(userId, { force:true })
  return getCreatorForUser(userId)
}

function readMetrics() {
  return creatorMetricsCache
}

export function trackCreatorMetric(creatorId, metric, contentId = '') {
  if (!creatorId || !metric || (typeof window !== 'undefined' && !hasAnalyticsConsent())) return
  const metrics = readMetrics()
  const key = [creatorId, metric, contentId].filter(Boolean).join(':')
  metrics[key] = Number(metrics[key] || 0) + 1
  supabase.rpc('increment_creator_metric', {
    p_creator_id:String(creatorId),
    p_metric:String(metric),
    p_content_id:String(contentId || ''),
  }).then(({ error }) => {
    if (error && import.meta.env?.DEV) console.warn('Creator metric could not be recorded:', error.message)
  })
}

export function trackCreatorImpression(creatorId, targetType, targetId) {
  if (!creatorId || !targetType || !targetId || typeof window === 'undefined' || !hasAnalyticsConsent()) return
  const impressionKey = `${targetType}:${targetId}`
  try {
    const seen = safeParse(window.sessionStorage.getItem(CREATOR_IMPRESSIONS_SESSION_KEY), [])
    if (Array.isArray(seen) && seen.includes(impressionKey)) return
    window.sessionStorage.setItem(CREATOR_IMPRESSIONS_SESSION_KEY, JSON.stringify([...(Array.isArray(seen) ? seen : []), impressionKey]))
  } catch {}
  trackCreatorMetric(creatorId, `${targetType}_impression`, targetId)
}

function readInteractions() {
  return creatorInteractionsCache
}

// La caché contiene únicamente las interacciones del usuario autenticado; los
// contadores públicos agregados llegan en cada perfil y contenido.
function readInteractionEntries(action, targetType, targetId) {
  return readInteractions()
    .filter(entry => entry.action === action
      && entry.target_type === targetType
      && String(entry.target_id) === String(targetId))
    .map(entry => ({ actor:String(entry.actor_id || creatorDirectoryState.userId || ''), at:new Date(entry.created_at || 0).getTime() || 0 }))
    .filter(entry => entry.actor)
}

function getInteractionActors(action, targetType, targetId) {
  return readInteractionEntries(action, targetType, targetId).map(entry => entry.actor)
}

export function getCreatorInteractionState({ action, targetType, targetId, actorId = '', baseCount = 0 }) {
  const actors = getInteractionActors(action, targetType, targetId)
  return {
    active:Boolean(actorId) && actors.includes(String(actorId)),
    count:Math.max(0, Number(baseCount) || 0),
  }
}

export async function toggleCreatorInteraction({ action, targetType, targetId, actorId = '', baseCount = 0 }) {
  if (!actorId) throw new Error('Inicia sesión para guardar esta valoración.')
  if (!action || !targetType || !targetId) {
    return getCreatorInteractionState({ action, targetType, targetId, actorId, baseCount })
  }

  const { data, error } = await supabase.rpc('toggle_creator_interaction', {
    p_action:action,
    p_target_type:targetType,
    p_target_id:String(targetId),
  })
  if (error) throw error

  const active = Boolean(data?.active)
  const count = Math.max(0, Number(data?.count) || 0)
  creatorInteractionsCache = creatorInteractionsCache.filter(entry => !(
    entry.action === action
    && entry.target_type === targetType
    && String(entry.target_id) === String(targetId)
  ))
  if (active) creatorInteractionsCache.push({
    actor_id:actorId,
    action,
    target_type:targetType,
    target_id:String(targetId),
    created_at:new Date().toISOString(),
  })

  creatorCache = creatorCache.map(creator => {
    if (targetType === 'creator' && creator.id === targetId) {
      return {
        ...creator,
        ...(action === 'helpful' ? { helpful_count:count } : {}),
        ...(action === 'saved' ? { saved_count:count } : {}),
      }
    }
    if (targetType === 'content') {
      return {
        ...creator,
        contents:(creator.contents || []).map(content => content.id === targetId && action === 'helpful'
          ? { ...content, helpful_count:count }
          : content),
      }
    }
    return creator
  })
  writeLocalCreators(creatorCache)
  dispatchCreatorInteractionsUpdate()
  return { active, count }
}

export function getFollowedCreatorIds(actorId = '') {
  if (!actorId) return []
  return readInteractions()
    .filter(entry => entry.action === 'saved' && entry.target_type === 'creator' && String(entry.actor_id || actorId) === String(actorId))
    .map(entry => String(entry.target_id))
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
  const contentHelpful = contents.reduce((total, content) => (
    total + Math.max(0, Number(content.helpful_count) || 0)
  ), 0)
  const saved = Math.max(0, Number(creator?.saved_count) || 0)
  const byContent = Object.fromEntries(contents.map(content => {
    const impressions = Number(metrics[`${creator.id}:content_impression:${content.id}`] || 0)
    const clicks = Number(metrics[`${creator.id}:content_click:${content.id}`] || 0)
    const helpful = Math.max(0, Number(content.helpful_count) || 0)
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
  return () => {
    window.removeEventListener(CREATOR_INTERACTIONS_EVENT, handler)
  }
}

export function subscribeCreatorUpdates(callback) {
  if (typeof window === 'undefined') return () => {}
  const handler = () => callback?.()
  window.addEventListener(CREATOR_UPDATE_EVENT, handler)
  return () => {
    window.removeEventListener(CREATOR_UPDATE_EVENT, handler)
  }
}

export function startCreatorDirectorySync(userId = '') {
  if (typeof window === 'undefined') return () => {}
  let stopped = false
  let refreshTimer = null
  const refresh = () => {
    if (stopped) return
    window.clearTimeout(refreshTimer)
    refreshTimer = window.setTimeout(() => {
      refreshCreatorDirectory(userId, { force:true }).catch(error => {
        if (import.meta.env?.DEV) console.warn('Creator directory could not be refreshed:', error.message)
      })
    }, 80)
  }

  refreshCreatorDirectory(userId, { force:true }).catch(error => {
    if (import.meta.env?.DEV) console.warn('Creator directory could not be loaded:', error.message)
  })
  window.addEventListener('focus', refresh)
  window.addEventListener('online', refresh)

  const channel = supabase.channel(`creator-directory:${userId || 'public'}:${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event:'*', schema:'public', table:'creator_profiles' }, refresh)
    .on('postgres_changes', { event:'*', schema:'public', table:'creator_contents' }, refresh)
    .subscribe()

  return () => {
    stopped = true
    window.clearTimeout(refreshTimer)
    window.removeEventListener('focus', refresh)
    window.removeEventListener('online', refresh)
    supabase.removeChannel(channel)
  }
}

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

export function getContentHelpfulCount(content) {
  return Math.max(0, Number(content?.helpful_count) || 0)
}

export function getCreatorHelpfulCount(creator) {
  const profile = Math.max(0, Number(creator?.helpful_count) || 0)
  const contents = getOrderedCreatorContents(creator, { publishedOnly:true })
    .reduce((total, content) => total + getContentHelpfulCount(content), 0)
  return profile + contents
}

// Todo el contenido publicado, con su creador al lado.
export function getAllCreatorContents({ topic = '' } = {}) {
  return getAllCreators().flatMap(creator => (
    getOrderedCreatorContents(creator, { publishedOnly:true })
      .filter(content => !topic || content.topic === topic)
      .map(content => ({ content, creator }))
  ))
}

export function getMostHelpfulContents({ topic = '', limit = 8 } = {}) {
  return getAllCreatorContents({ topic })
    .map(entry => ({ ...entry, helpful:getContentHelpfulCount(entry.content) }))
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

export function getTopHelpfulCreators({ topic = '', limit = 5 } = {}) {
  return getAllCreators()
    .filter(creator => !topic || (creator.topics || []).includes(topic))
    .map(creator => ({ creator, helpful:getCreatorHelpfulCount(creator) }))
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
