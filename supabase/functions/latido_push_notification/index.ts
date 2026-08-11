import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

type WebhookPayload = {
  type?: 'INSERT' | 'UPDATE' | 'DELETE'
  table?: string
  schema?: string
  record?: Record<string, unknown>
  old_record?: Record<string, unknown> | null
}

type PushSubscriptionRow = {
  endpoint: string
  p256dh: string
  auth: string
  user_id: string
}

type PushPayload = {
  title: string
  body: string
  url: string
  tag: string
  icon?: string
  badge?: string
  data?: Record<string, unknown>
}

type SavedSearchRow = {
  id: string
  user_id: string
  name: string
  query: string
  entity_kinds: string[]
  category: string | null
  intent: string | null
  canton: string | null
  city: string | null
  plz: string | null
  filters: Record<string, unknown> | null
  result_path: string
  push_enabled: boolean
  last_delivery_attempt_at: string | null
  last_notified_at: string | null
}

type SavedSearchMatch = {
  id: string
  saved_search_id: string
  user_id: string
  entity_kind: string
  entity_id: string
  search_name: string
  result_title: string
  result_location: string | null
  result_path: string
  matched_at: string
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || ''
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:hola@latido.ch'
const WEBHOOK_SECRET = Deno.env.get('PUSH_WEBHOOK_SECRET') || ''

const encoder = new TextEncoder()
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const JSON_HEADERS = {
  'Content-Type': 'application/json',
}

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || ''
  const allowed = new Set([
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'https://latido.ch',
    'https://www.latido.ch',
    'https://latidoch.vercel.app',
  ])

  return {
    'Access-Control-Allow-Origin': allowed.has(origin) ? origin : 'https://www.latido.ch',
    'Access-Control-Allow-Headers': 'authorization, content-type, x-latido-webhook-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function json(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...corsHeaders(req) },
  })
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  return Uint8Array.from(atob(padded), char => char.charCodeAt(0))
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function concatBytes(...parts: Uint8Array[]) {
  const length = parts.reduce((total, part) => total + part.length, 0)
  const output = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

async function hmac(key: Uint8Array, data: Uint8Array) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, data))
}

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array) {
  return hmac(salt, ikm)
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number) {
  let previous = new Uint8Array()
  const output: number[] = []
  let counter = 1

  while (output.length < length) {
    previous = await hmac(prk, concatBytes(previous, info, new Uint8Array([counter])))
    output.push(...previous)
    counter += 1
  }

  return new Uint8Array(output.slice(0, length))
}

async function createVapidJwt(audience: string) {
  const publicKey = base64UrlToBytes(VAPID_PUBLIC_KEY)
  if (publicKey.length !== 65 || publicKey[0] !== 4) {
    throw new Error('VAPID_PUBLIC_KEY must be an uncompressed P-256 public key.')
  }

  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: bytesToBase64Url(publicKey.slice(1, 33)),
    y: bytesToBase64Url(publicKey.slice(33, 65)),
    d: VAPID_PRIVATE_KEY,
    ext: false,
  }

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )

  const header = bytesToBase64Url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: VAPID_SUBJECT,
  })))
  const input = `${header}.${payload}`
  const signature = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    encoder.encode(input),
  ))

  return `${input}.${bytesToBase64Url(signature)}`
}

async function encryptPushPayload(subscription: PushSubscriptionRow, payload: PushPayload) {
  const userPublicKeyBytes = base64UrlToBytes(subscription.p256dh)
  const authSecret = base64UrlToBytes(subscription.auth)
  const salt = crypto.getRandomValues(new Uint8Array(16))

  const userPublicKey = await crypto.subtle.importKey(
    'raw',
    userPublicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    [],
  )
  const appServerKeys = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  )
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'ECDH', public: userPublicKey },
    appServerKeys.privateKey,
    256,
  ))
  const serverPublicKey = new Uint8Array(await crypto.subtle.exportKey('raw', appServerKeys.publicKey))

  const prkKey = await hkdfExtract(authSecret, sharedSecret)
  const context = concatBytes(
    encoder.encode('WebPush: info\0'),
    userPublicKeyBytes,
    serverPublicKey,
  )
  const ikm = await hkdfExpand(prkKey, context, 32)
  const prk = await hkdfExtract(salt, ikm)
  const cek = await hkdfExpand(prk, encoder.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdfExpand(prk, encoder.encode('Content-Encoding: nonce\0'), 12)

  const key = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt'])
  const plaintext = concatBytes(encoder.encode(JSON.stringify(payload)), new Uint8Array([2]))
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plaintext))

  const recordSize = new Uint8Array(4)
  new DataView(recordSize.buffer).setUint32(0, 4096, false)

  return concatBytes(
    salt,
    recordSize,
    new Uint8Array([serverPublicKey.length]),
    serverPublicKey,
    ciphertext,
  )
}

async function sendOne(subscription: PushSubscriptionRow, payload: PushPayload) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

  try {
    const response = await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload),
      {
        TTL: 86400,
        urgency: 'normal',
      },
    )

    return { ok: response.statusCode >= 200 && response.statusCode < 300, status: response.statusCode }
  } catch (error) {
    const pushError = error as { statusCode?: number, status?: number, body?: string, message?: string }
    const status = Number(pushError.statusCode || pushError.status || 0)
    const responseText = String(pushError.body || pushError.message || '')
    const isInvalidSubscription = [404, 410].includes(status)
      || (status === 403 && /VAPID credentials/i.test(responseText))

    if (isInvalidSubscription) {
      await supabase
        .from('push_subscriptions')
        .update({ enabled: false, updated_at: new Date().toISOString() })
        .eq('endpoint', subscription.endpoint)
    }

    console.error('push_send_failed', {
      status,
      endpointHost: new URL(subscription.endpoint).host,
      response: responseText.slice(0, 500),
      userId: subscription.user_id,
    })

    return { ok: false, status }
  }
}

function text(value: unknown, fallback = '') {
  const next = String(value || '').trim()
  return next || fallback
}

function truncate(value: string, max = 140) {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value
}

function normalizeCategory(value: unknown) {
  const raw = String(value || '').toLowerCase().trim()
  const map: Record<string, string> = {
    hogar: 'servicios',
    servicio: 'servicios',
    services: 'servicios',
    trabajo: 'empleo',
    jobs: 'empleo',
    market: 'venta',
    mercado: 'venta',
    documentacion: 'documentos',
    tramite: 'documentos',
    tramites: 'documentos',
    regalos: 'regalo',
    regala: 'regalo',
    gratis: 'regalo',
  }
  return map[raw] || raw
}

function normalizeSearchText(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const SEARCH_STOP_WORDS = new Set([
  'con', 'del', 'desde', 'el', 'en', 'la', 'las', 'los', 'para', 'por', 'que', 'una', 'uno', 'unos', 'unas',
])

function queryMatches(query: string, record: Record<string, unknown>) {
  const tokens = normalizeSearchText(query)
    .split(' ')
    .filter(token => token.length >= 2 && !SEARCH_STOP_WORDS.has(token))
  if (!tokens.length) return true

  const haystack = normalizeSearchText([
    record.title,
    record.name,
    record.company,
    record.desc,
    record.description,
    record.summary,
    record.tagline,
    record.bio,
    record.handle,
    record.creator_name,
    record.services,
    record.sector,
    record.category,
    record.cat,
    record.sub,
    record.type,
    record.city,
    record.canton,
    record.venue,
    record.host,
    record.topic,
    record.topics,
    record.platform,
    record.reach,
    record.socials ? JSON.stringify(record.socials) : '',
  ].flat().filter(Boolean).join(' '))

  return tokens.every(token => {
    const stems = [token]
    if (token.length > 4 && token.endsWith('es')) stems.push(token.slice(0, -2))
    if (token.length > 3 && token.endsWith('s')) stems.push(token.slice(0, -1))
    return stems.some(stem => stem.length >= 2 && haystack.includes(stem))
  })
}

function isNationwide(value: unknown) {
  const normalized = normalizeSearchText(value)
  return ['suiza', 'toda suiza', 'toda la suiza', 'todo suiza'].includes(normalized)
}

function locationMatches(search: SavedSearchRow, record: Record<string, unknown>) {
  const preferredCanton = normalizeSearchText(search.canton)
  const preferredCity = normalizeSearchText(search.city)
  const preferredPlz = normalizeSearchText(search.plz)
  if (!preferredCanton && !preferredCity && !preferredPlz) return true

  const publicationCanton = normalizeSearchText(record.canton)
  const publicationCity = normalizeSearchText(record.city)
  const publicationPlz = normalizeSearchText(record.plz)
  const publicationAddress = normalizeSearchText(record.address)
  if (
    isNationwide(record.canton)
    || isNationwide(record.city)
    || isNationwide(record.address)
    || isNationwide(record.reach)
    || isNationwide(record.creator_reach)
  ) return true

  if (preferredPlz && publicationPlz !== preferredPlz && !publicationAddress.includes(preferredPlz)) {
    return false
  }
  if (
    preferredCanton
    && publicationCanton !== preferredCanton
    && !publicationCity.split(' ').includes(preferredCanton)
    && !publicationAddress.split(' ').includes(preferredCanton)
  ) return false
  if (
    preferredCity
    && !publicationCity.includes(preferredCity)
    && !publicationAddress.includes(preferredCity)
    && publicationCanton !== preferredCity
  ) return false

  return true
}

function exactNormalizedMatch(expected: unknown, values: unknown[]) {
  const normalizedExpected = normalizeSearchText(expected)
  if (!normalizedExpected) return true
  return values.some(value => {
    const normalizedValue = normalizeSearchText(value)
    return normalizedValue === normalizedExpected
      || normalizedValue.split(' ').includes(normalizedExpected)
      || normalizedExpected.split(' ').includes(normalizedValue)
  })
}

function priceRangeMatches(range: unknown, record: Record<string, unknown>) {
  const id = text(range)
  if (!id) return true

  const amount = Number(record.price_amount ?? record.salary_amount)
  if (!Number.isFinite(amount)) return false
  if (id === '0-50') return amount <= 50
  if (id === '50-150') return amount >= 50 && amount <= 150
  if (id === '150-500') return amount >= 150 && amount <= 500
  if (id === '500-1000') return amount >= 500 && amount <= 1000
  if (id === '1000-plus') return amount >= 1000
  return true
}

function filtersMatch(search: SavedSearchRow, record: Record<string, unknown>) {
  const filters = search.filters || {}
  const creatorTopics = [
    record.topic,
    ...(Array.isArray(record.topics) ? record.topics : []),
  ]
  const creatorPlatforms = [
    record.platform,
    ...(Array.isArray(record.socials)
      ? record.socials.map(social => (
          social && typeof social === 'object'
            ? (social as Record<string, unknown>).platform
            : social
        ))
      : []),
  ]
  if (!exactNormalizedMatch(filters.jobType, [record.type])) return false
  if (!exactNormalizedMatch(filters.employmentLevel, [record.employment_level])) return false
  if (!exactNormalizedMatch(filters.businessType, [record.category])) return false
  if (!exactNormalizedMatch(filters.communityCategory, [record.cat])) return false
  if (!exactNormalizedMatch(filters.eventType, [record.type])) return false
  if (!exactNormalizedMatch(filters.creatorTopic, creatorTopics)) return false
  if (!exactNormalizedMatch(filters.creatorPlatform, creatorPlatforms)) return false
  if (!exactNormalizedMatch(filters.sub, [record.sub, record.sector, record.category])) return false
  if (!exactNormalizedMatch(filters.privacy, [record.privacy])) return false
  return priceRangeMatches(filters.priceRange, record)
}

function entityKindForTable(table: string) {
  if (['listings', 'ads'].includes(table)) return 'listing'
  if (table === 'jobs') return 'job'
  if (table === 'providers') return 'provider'
  if (table === 'events') return 'event'
  if (table === 'communities') return 'community'
  if (table === 'creator_profiles') return 'creator'
  if (table === 'creator_contents') return 'creator_content'
  return ''
}

function publicationCategory(table: string, record: Record<string, unknown>) {
  if (table === 'jobs') return 'empleo'
  if (table === 'providers') return 'servicios'
  if (table === 'events') return 'eventos'
  if (table === 'communities') return 'comunidad'
  if (['creator_profiles', 'creator_contents'].includes(table)) return 'creadores'
  return normalizeCategory(record.cat || record.category)
}

function publicationIntent(table: string, record: Record<string, unknown>) {
  if (table === 'jobs') return text(record.job_intent, 'ofrece')
  if (['listings', 'ads'].includes(table)) return text(record.type)
  return ''
}

function savedSearchMatchesPublication(
  search: SavedSearchRow,
  table: string,
  record: Record<string, unknown>,
) {
  const kind = entityKindForTable(table)
  if (!kind || !search.entity_kinds?.includes(kind)) return false
  if (text(record.user_id || record.owner_id) === search.user_id) return false
  if (search.category && normalizeCategory(search.category) !== normalizeCategory(publicationCategory(table, record))) {
    return false
  }
  if (search.intent && !exactNormalizedMatch(search.intent, [publicationIntent(table, record)])) return false
  if (!locationMatches(search, record)) return false
  if (!filtersMatch(search, record)) return false
  return queryMatches(search.query, record)
}

function appendSearchParam(path: string, key: string, value: string) {
  if (!value) return path
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`
}

function savedSearchResultPath(table: string, record: Record<string, unknown>) {
  const id = text(record.id)
  if (table === 'jobs') return `/tablon?cat=empleo&openJob=${encodeURIComponent(id)}`
  if (table === 'providers') return `/comunidades?view=negocios&openBusiness=${encodeURIComponent(id)}`
  if (table === 'events') return `/comunidades?view=eventos&openEvent=${encodeURIComponent(id)}`
  if (table === 'communities') return `/comunidades?view=comunidades&openCommunity=${encodeURIComponent(id)}`
  if (table === 'creator_profiles') return '/comunidades?view=creadores&creatorView=creadores'
  if (table === 'creator_contents') return '/comunidades?view=creadores&creatorView=contenidos'
  return `/tablon?openAd=${encodeURIComponent(id)}`
}

function savedSearchResultTitle(record: Record<string, unknown>) {
  return text(record.title || record.name || record.company, 'Nuevo resultado')
}

function savedSearchResultLocation(record: Record<string, unknown>) {
  return text(record.city || record.canton || record.plz)
}

function deliveryIsDue(search: SavedSearchRow) {
  const last = search.last_delivery_attempt_at
  if (!last) return true
  const lastTime = new Date(last).getTime()
  return !Number.isFinite(lastTime) || Date.now() - lastTime >= 24 * 60 * 60 * 1000
}

function categoryMatches(table: string, record: Record<string, unknown>, categories: string[] = []) {
  const normalizedCategories = [...new Set(categories.map(normalizeCategory).filter(Boolean))]
  if (['creator_profiles', 'creator_contents'].includes(table)) {
    return normalizedCategories.includes('creadores')
  }
  if (!normalizedCategories.length) return true
  if (table === 'jobs') return normalizedCategories.includes('empleo')
  if (table === 'providers') return normalizedCategories.includes('servicios')
  if (table === 'events') return normalizedCategories.includes('eventos')
  if (table === 'communities') return normalizedCategories.includes('comunidad')

  const publicationCategory = normalizeCategory(record.cat || record.category)
  const publicationType = normalizeCategory(record.type)

  if (publicationType === 'regalo' && normalizedCategories.includes('regalo')) return true
  return normalizedCategories.includes(publicationCategory)
}

function cantonMatches(preferredCanton: string, publicationCanton: string) {
  if (!preferredCanton) return true
  if (!publicationCanton) return true
  if (isNationwide(publicationCanton)) return true
  return preferredCanton === publicationCanton
}

function zonePushPayload(table: string, record: Record<string, unknown>): PushPayload | null {
  const id = text(record.id)
  const canton = text(record.canton || record.city)

  if (table === 'jobs') {
    const intent = text(record.job_intent) === 'busca' ? 'búsqueda de empleo' : 'oferta de empleo'
    const body = truncate([record.title, record.company, canton].map(value => text(value)).filter(Boolean).join(' - '))
    return {
      title: `Nueva ${intent} en tu zona`,
      body: body || `Hay una nueva ${intent} cerca de ti.`,
      url: `/tablon?cat=empleo&openJob=${encodeURIComponent(id)}`,
      tag: `job:${id}`,
      data: { kind: 'job', id },
    }
  }

  if (table === 'providers') {
    const body = truncate([record.name, record.city || canton].map(value => text(value)).filter(Boolean).join(' - '))
    return {
      title: 'Nuevo negocio en tu zona',
      body: body || 'Hay un nuevo negocio publicado cerca de ti.',
      url: `/comunidades?view=negocios&openBusiness=${encodeURIComponent(id)}`,
      tag: `business:${id}`,
      data: { kind: 'business', id },
    }
  }

  if (table === 'events') {
    const body = truncate([record.title, record.city || canton].map(value => text(value)).filter(Boolean).join(' - '))
    return {
      title: 'Nuevo evento en tu zona',
      body: body || 'Hay un nuevo evento publicado cerca de ti.',
      url: `/comunidades?view=eventos&openEvent=${encodeURIComponent(id)}`,
      tag: `event:${id}`,
      data: { kind: 'event', id },
    }
  }

  if (table === 'communities') {
    const body = truncate([record.name, record.city || canton].map(value => text(value)).filter(Boolean).join(' - '))
    return {
      title: 'Nuevo grupo para la comunidad',
      body: body || 'Hay un nuevo grupo que puede interesarte.',
      url: `/comunidades?view=comunidades&openCommunity=${encodeURIComponent(id)}`,
      tag: `community:${id}`,
      data: { kind: 'community', id },
    }
  }

  if (table === 'creator_profiles') {
    const body = truncate([record.name, record.tagline, record.city || canton].map(value => text(value)).filter(Boolean).join(' - '))
    return {
      title: 'Nuevo creador en Latido',
      body: body || 'Hay un nuevo creador que puede interesarte.',
      url: '/comunidades?view=creadores&creatorView=creadores',
      tag: `creator:${id}`,
      data: { kind: 'creator', id },
    }
  }

  if (table === 'creator_contents') {
    const body = truncate([record.title, record.creator_name, canton].map(value => text(value)).filter(Boolean).join(' - '))
    return {
      title: 'Nuevo contenido de un creador',
      body: body || 'Hay nuevo contenido que puede interesarte.',
      url: '/comunidades?view=creadores&creatorView=contenidos',
      tag: `creator-content:${id}`,
      data: { kind: 'creator_content', id },
    }
  }

  const body = truncate([record.title, canton].map(value => text(value)).filter(Boolean).join(' - '))
  return {
    title: 'Nuevo anuncio en tu zona',
    body: body || 'Hay un nuevo anuncio cerca de ti.',
    url: `/tablon?openAd=${encodeURIComponent(id)}`,
    tag: `ad:${id}`,
    data: { kind: 'ad', id },
  }
}

function isVisiblePublication(record: Record<string, unknown> | null | undefined) {
  if (!record || record.active === false) return false
  return !Object.prototype.hasOwnProperty.call(record, 'status') || text(record.status) === 'published'
}

function shouldNotifyPublication(payload: WebhookPayload) {
  if (!payload.record) return false
  if (payload.type === 'INSERT') return isVisiblePublication(payload.record)
  if (payload.type === 'UPDATE') return !isVisiblePublication(payload.old_record) && isVisiblePublication(payload.record)
  return false
}

async function fetchActiveSubscriptions(userIds: string[]) {
  const ids = [...new Set(userIds.filter(Boolean))]
  if (!ids.length) return []

  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint,p256dh,auth,user_id')
    .eq('enabled', true)
    .in('user_id', ids)

  if (error) throw error
  return (data || []) as PushSubscriptionRow[]
}

async function notifySubscriptions(subscriptions: PushSubscriptionRow[], payload: PushPayload) {
  const fullPayload = {
    icon: '/icon-192.png',
    ...payload,
  }

  const results = await Promise.allSettled(
    subscriptions.map(subscription => sendOne(subscription, fullPayload)),
  )

  const sent = results.filter(result => result.status === 'fulfilled' && result.value.ok).length
  const failed = results.length - sent
  const statuses = results.map(result => result.status === 'fulfilled' ? result.value.status : 'thrown')
  console.log('push_delivery_result', {
    tag: payload.tag,
    attempted: subscriptions.length,
    sent,
    failed,
    statuses,
  })
  return { sent, attempted: subscriptions.length, failed, statuses }
}

function isMissingSavedSearchSchema(error: unknown) {
  const message = String((error as { message?: string })?.message || error || '')
  return /saved_search|schema cache|does not exist|42P01/i.test(message)
}

function savedSearchSpecificity(search: SavedSearchRow) {
  return normalizeSearchText(search.query).length
    + Object.values(search.filters || {}).filter(Boolean).length * 8
    + [search.canton, search.city, search.plz, search.category, search.intent].filter(Boolean).length * 4
}

async function findSavedSearchMatches(table: string, record: Record<string, unknown>) {
  const entityKind = entityKindForTable(table)
  if (!entityKind) return { recipientIds:[] as string[], matches:[] as Array<{ search:SavedSearchRow, match:SavedSearchMatch }> }

  const { data, error } = await supabase
    .from('saved_searches')
    .select('id,user_id,name,query,entity_kinds,category,intent,canton,city,plz,filters,result_path,push_enabled,last_delivery_attempt_at,last_notified_at')
    .eq('active', true)
    .eq('in_app_enabled', true)
    .contains('entity_kinds', [entityKind])

  if (error) {
    if (isMissingSavedSearchSchema(error)) {
      console.warn('saved_search_schema_unavailable', { message:error.message })
      return { recipientIds:[] as string[], matches:[] as Array<{ search:SavedSearchRow, match:SavedSearchMatch }> }
    }
    throw error
  }

  const matching = ((data || []) as SavedSearchRow[])
    .filter(search => savedSearchMatchesPublication(search, table, record))
  const recipientIds = [...new Set(matching.map(search => search.user_id))]

  // Una misma publicación puede coincidir con varias búsquedas de la misma
  // persona. Conservamos solo la más específica para no duplicar avisos.
  const bestByUser = new Map<string, SavedSearchRow>()
  for (const search of matching) {
    const current = bestByUser.get(search.user_id)
    if (
      !current
      || (deliveryIsDue(search) && !deliveryIsDue(current))
      || (deliveryIsDue(search) === deliveryIsDue(current) && savedSearchSpecificity(search) > savedSearchSpecificity(current))
    ) {
      bestByUser.set(search.user_id, search)
    }
  }

  const created: Array<{ search:SavedSearchRow, match:SavedSearchMatch }> = []
  for (const search of bestByUser.values()) {
    const resultPath = savedSearchResultPath(table, record)
    const { data: match, error: insertError } = await supabase
      .from('saved_search_matches')
      .insert({
        saved_search_id:search.id,
        user_id:search.user_id,
        entity_kind:entityKind,
        entity_id:text(record.id),
        search_name:search.name,
        result_title:savedSearchResultTitle(record),
        result_location:savedSearchResultLocation(record) || null,
        result_path:resultPath,
      })
      .select('id,saved_search_id,user_id,entity_kind,entity_id,search_name,result_title,result_location,result_path,matched_at')
      .maybeSingle()

    if (insertError) {
      if (insertError.code === '23505') continue
      throw insertError
    }
    if (match) created.push({ search, match:match as SavedSearchMatch })
  }

  return { recipientIds, matches:created }
}

async function deliverImmediateSavedSearchMatches(
  pairs: Array<{ search:SavedSearchRow, match:SavedSearchMatch }>,
) {
  const duePairs = pairs.filter(pair => pair.search.push_enabled && deliveryIsDue(pair.search))
  if (!duePairs.length) return { attempted:0, sent:0 }

  let attempted = 0
  let sent = 0
  for (const { search, match } of duePairs) {
    const now = new Date().toISOString()
    const subscriptions = await fetchActiveSubscriptions([search.user_id])
    const path = appendSearchParam(
      appendSearchParam(match.result_path, 'savedSearch', search.id),
      'savedMatch',
      match.id,
    )
    const result = await notifySubscriptions(subscriptions, {
      title:`Nuevo resultado para ${truncate(search.name, 70)}`,
      body:truncate([match.result_title, match.result_location].filter(Boolean).join(' - '), 140),
      url:path,
      tag:`saved-search:${search.id}`,
      data:{
        kind:'saved_search',
        savedSearchId:search.id,
        savedMatchId:match.id,
        entityKind:match.entity_kind,
        entityId:match.entity_id,
      },
    })

    attempted += result.attempted
    sent += result.sent
    await Promise.all([
      supabase
        .from('saved_search_matches')
        .update({
          notified_at:now,
          push_sent_at:result.sent > 0 ? now : null,
        })
        .eq('id', match.id),
      supabase
        .from('saved_searches')
        .update({
          last_delivery_attempt_at:now,
          ...(result.sent > 0 ? { last_notified_at:now } : {}),
        })
        .eq('id', search.id),
    ])
  }

  return { attempted, sent }
}

async function handleSavedSearchDigest(req: Request) {
  const { data: pending, error: pendingError } = await supabase
    .from('saved_search_matches')
    .select('id,saved_search_id,user_id,entity_kind,entity_id,search_name,result_title,result_location,result_path,matched_at')
    .is('notified_at', null)
    .order('matched_at', { ascending:true })
    .limit(500)

  if (pendingError) throw pendingError
  if (!pending?.length) return json(req, { ok:true, kind:'saved_search_digest', searches:0, matches:0, sent:0 })

  const searchIds = [...new Set(pending.map(match => match.saved_search_id))]
  const { data: searches, error: searchError } = await supabase
    .from('saved_searches')
    .select('id,user_id,name,query,entity_kinds,category,intent,canton,city,plz,filters,result_path,push_enabled,last_delivery_attempt_at,last_notified_at')
    .in('id', searchIds)
    .eq('active', true)
    .eq('push_enabled', true)

  if (searchError) throw searchError
  const searchMap = new Map(((searches || []) as SavedSearchRow[]).map(search => [search.id, search]))
  const dueMatches = (pending as SavedSearchMatch[]).filter(match => {
    const search = searchMap.get(match.saved_search_id)
    return Boolean(search && deliveryIsDue(search))
  })

  const bySearch = new Map<string, SavedSearchMatch[]>()
  for (const match of dueMatches) {
    const matches = bySearch.get(match.saved_search_id) || []
    matches.push(match)
    bySearch.set(match.saved_search_id, matches)
  }

  let sent = 0
  let attempted = 0
  for (const [searchId, matches] of bySearch) {
    const search = searchMap.get(searchId)
    if (!search) continue
    const now = new Date().toISOString()
    const first = matches[0]
    const subscriptions = await fetchActiveSubscriptions([search.user_id])
    const result = await notifySubscriptions(subscriptions, {
      title:matches.length === 1
        ? `Nuevo resultado para ${truncate(search.name, 70)}`
        : `${matches.length} nuevos resultados para ti`,
      body:matches.length === 1
        ? truncate([first.result_title, first.result_location].filter(Boolean).join(' - '), 140)
        : truncate(`${search.name}. Abre Latido para ver las novedades.`, 140),
      url:matches.length === 1
        ? appendSearchParam(
            appendSearchParam(first.result_path, 'savedSearch', search.id),
            'savedMatch',
            first.id,
          )
        : appendSearchParam(search.result_path, 'savedSearch', search.id),
      tag:`saved-search:${search.id}`,
      data:{ kind:'saved_search_digest', savedSearchId:search.id, count:matches.length },
    })

    sent += result.sent
    attempted += result.attempted
    const matchIds = matches.map(match => match.id)
    await Promise.all([
      supabase
        .from('saved_search_matches')
        .update({
          notified_at:now,
          push_sent_at:result.sent > 0 ? now : null,
        })
        .in('id', matchIds),
      supabase
        .from('saved_searches')
        .update({
          last_delivery_attempt_at:now,
          ...(result.sent > 0 ? { last_notified_at:now } : {}),
        })
        .eq('id', search.id),
    ])
  }

  console.log('saved_search_digest', {
    pending:pending.length,
    due:dueMatches.length,
    searches:bySearch.size,
    attempted,
    sent,
  })
  return json(req, {
    ok:true,
    kind:'saved_search_digest',
    matches:dueMatches.length,
    searches:bySearch.size,
    attempted,
    sent,
  })
}

async function handleTest(req: Request, record: Record<string, unknown>) {
  const userId = text(record.user_id)
  const subscriptions = await fetchActiveSubscriptions([userId])
  console.log('push_test', { userId, subscriptions: subscriptions.length })
  const result = await notifySubscriptions(subscriptions, {
    title: text(record.title, 'Prueba Latido'),
    body: text(record.body, 'Las notificaciones están funcionando.'),
    url: text(record.url, '/'),
    tag: `test:${Date.now()}`,
    data: { kind: 'test' },
  })
  return json(req, { ok: true, ...result })
}

async function handleMessage(req: Request, record: Record<string, unknown>) {
  const conversationId = text(record.conversation_id)
  const senderId = text(record.sender_id)
  if (!conversationId || !senderId) {
    return json(req, { ok: true, kind: 'message', skipped: 'missing_message_fields' })
  }

  let conversationResult = await supabase
    .from('conversations')
    .select('id,sender_id,owner_id,sender_name,owner_name,title,deleted_by_sender,deleted_by_owner')
    .eq('id', conversationId)
    .maybeSingle()

  if (conversationResult.error && /column|schema cache/i.test(conversationResult.error.message || '')) {
    conversationResult = await supabase
      .from('conversations')
      .select('id,sender_id,owner_id,sender_name,owner_name,title')
      .eq('id', conversationId)
      .maybeSingle()
  }

  if (conversationResult.error && /column|schema cache/i.test(conversationResult.error.message || '')) {
    conversationResult = await supabase
      .from('conversations')
      .select('id,sender_id,owner_id')
      .eq('id', conversationId)
      .maybeSingle()
  }

  const { data: conversation, error } = conversationResult

  if (error) throw error
  if (!conversation) return json(req, { ok: true, kind: 'message', skipped: 'conversation_not_found', conversationId })

  const recipientId = senderId === conversation.sender_id ? conversation.owner_id : conversation.sender_id
  if (!recipientId || recipientId === senderId) {
    return json(req, { ok: true, kind: 'message', skipped: 'no_recipient', conversationId, senderId, recipientId })
  }
  if (recipientId === conversation.sender_id && conversation.deleted_by_sender) {
    return json(req, { ok: true, kind: 'message', skipped: 'recipient_deleted_thread', conversationId, recipientId })
  }
  if (recipientId === conversation.owner_id && conversation.deleted_by_owner) {
    return json(req, { ok: true, kind: 'message', skipped: 'recipient_deleted_thread', conversationId, recipientId })
  }

  const { data: preference, error: preferenceError } = await supabase
    .from('push_notification_preferences')
    .select('messages_enabled')
    .eq('user_id', recipientId)
    .maybeSingle()

  if (preferenceError) throw preferenceError
  if (preference?.messages_enabled === false) {
    return json(req, { ok: true, kind: 'message', skipped: 'messages_disabled', conversationId, recipientId })
  }

  const senderName = senderId === conversation.sender_id
    ? text(conversation.sender_name, 'Latido')
    : text(conversation.owner_name, 'Latido')
  const conversationTitle = text(conversation.title, 'tu anuncio')
  const body = truncate(text(record.body, `Nuevo mensaje sobre ${conversationTitle}`), 140)

  const subscriptions = await fetchActiveSubscriptions([recipientId])
  console.log('push_message', {
    conversationId,
    senderId,
    recipientId,
    subscriptions: subscriptions.length,
  })
  const result = await notifySubscriptions(subscriptions, {
    title: `Nuevo mensaje de ${senderName}`,
    body,
    url: `/mensajes?conv=${encodeURIComponent(conversationId)}`,
    tag: `message:${conversationId}`,
    data: { kind: 'message', conversationId },
  })

  return json(req, { ok: true, kind: 'message', conversationId, recipientId, ...result })
}

async function enrichPublicationRecord(table: string, record: Record<string, unknown>) {
  if (table !== 'creator_contents' || !record.creator_id) return record

  const { data: creator, error } = await supabase
    .from('creator_profiles')
    .select('owner_id,slug,name,city,canton,reach')
    .eq('id', text(record.creator_id))
    .maybeSingle()

  if (error) throw error
  if (!creator) return record
  return {
    ...record,
    owner_id:creator.owner_id,
    creator_slug:creator.slug,
    creator_name:creator.name,
    creator_city:creator.city,
    creator_canton:creator.canton,
    creator_reach:creator.reach,
  }
}

async function handlePublication(req: Request, table: string, payload: WebhookPayload) {
  const rawRecord = payload.record || {}
  if (!shouldNotifyPublication(payload)) return json(req, { ok: true, skipped: 'not_active_publication' })
  const record = await enrichPublicationRecord(table, rawRecord)

  const notification = zonePushPayload(table, record)
  if (!notification) return json(req, { ok: true, skipped: 'unsupported_publication' })

  const savedSearchResult = await findSavedSearchMatches(table, record)
  const savedSearchDelivery = await deliverImmediateSavedSearchMatches(savedSearchResult.matches)
  const specificRecipients = new Set(savedSearchResult.recipientIds)

  const publicationCanton = text(record.canton || record.city)
  const authorId = text(record.user_id || record.owner_id)

  const { data: preferences, error } = await supabase
    .from('push_notification_preferences')
    .select('user_id,canton,categories,zone_enabled')
    .eq('zone_enabled', true)

  if (error) throw error

  const activePreferences = preferences || []
  const cantonMatched = activePreferences.filter((preference: Record<string, unknown>) => (
    text(preference.user_id) !== authorId
    && cantonMatches(text(preference.canton), publicationCanton)
  ))
  const categoryMatched = cantonMatched.filter((preference: Record<string, unknown>) => categoryMatches(
    table,
    record,
    Array.isArray(preference.categories) ? preference.categories.map(String) : [],
  ))

  const recipients: string[] = []
  for (const preference of categoryMatched) {
    const recipientId = text(preference.user_id)
    if (recipientId !== authorId && !specificRecipients.has(recipientId)) recipients.push(recipientId)
  }

  const subscriptions = await fetchActiveSubscriptions(recipients)
  console.log('push_publication', {
    table,
    id: text(record.id),
    canton: publicationCanton,
    category: normalizeCategory(record.cat || record.category),
    type: normalizeCategory(record.type),
    activePreferences: activePreferences.length,
    cantonMatched: cantonMatched.length,
    categoryMatched: categoryMatched.length,
    recipients: recipients.length,
    subscriptions: subscriptions.length,
    savedSearchRecipients:specificRecipients.size,
    savedSearchMatches:savedSearchResult.matches.length,
  })
  const result = await notifySubscriptions(subscriptions, notification)
  return json(req, {
    ok:true,
    kind:'publication',
    table,
    ...result,
    savedSearchMatches:savedSearchResult.matches.length,
    savedSearchAttempted:savedSearchDelivery.attempted,
    savedSearchSent:savedSearchDelivery.sent,
  })
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, { ok: false, error: 'Method not allowed' }, 405)

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json(req, { ok: false, error: 'Missing Supabase function secrets' }, 500)
    }
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return json(req, { ok: false, error: 'Missing VAPID secrets' }, 500)
    }
    if (!WEBHOOK_SECRET) {
      return json(req, { ok: false, error: 'Missing PUSH_WEBHOOK_SECRET' }, 500)
    }
    if (req.headers.get('x-latido-webhook-secret') !== WEBHOOK_SECRET) {
      console.error('push_unauthorized', {
        hasHeader: Boolean(req.headers.get('x-latido-webhook-secret')),
      })
      return json(req, { ok: false, error: 'Unauthorized' }, 401)
    }

    const payload = await req.json() as WebhookPayload
    const table = text(payload.table).toLowerCase()
    const record = payload.record || {}
    console.log('push_webhook_received', {
      table,
      type: payload.type,
      id: text(record.id),
    })

    if (table === 'test') return handleTest(req, record)
    if (table === 'saved_search_digest') return handleSavedSearchDigest(req)
    if (table === 'messages' && payload.type === 'INSERT') return handleMessage(req, record)
    if (['listings', 'ads', 'jobs', 'providers', 'events', 'communities', 'creator_profiles', 'creator_contents'].includes(table)) {
      return handlePublication(req, table, payload)
    }

    return json(req, { ok: true, skipped: 'unsupported_event', table })
  } catch (error) {
    console.error(error)
    return json(req, { ok: false, error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
