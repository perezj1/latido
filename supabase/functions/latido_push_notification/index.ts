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
    const status = Number(error?.statusCode || error?.status || 0)
    const responseText = String(error?.body || error?.message || '')
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
  }
  return map[raw] || raw
}

function categoryMatches(table: string, record: Record<string, unknown>, categories: string[] = []) {
  if (!categories.length) return true
  if (table === 'jobs') return categories.includes('empleo')
  if (table === 'providers') return categories.includes('servicios')
  if (table === 'events') return categories.includes('eventos')
  return categories.includes(normalizeCategory(record.cat))
}

function zonePushPayload(table: string, record: Record<string, unknown>): PushPayload | null {
  const id = text(record.id)
  const canton = text(record.canton || record.city)

  if (table === 'jobs') {
    const body = truncate([record.title, record.company, canton].map(value => text(value)).filter(Boolean).join(' - '))
    return {
      title: 'Nuevo trabajo en tu zona',
      body: body || 'Hay una nueva oferta de empleo cerca de ti.',
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

  const body = truncate([record.title, canton].map(value => text(value)).filter(Boolean).join(' - '))
  return {
    title: 'Nuevo anuncio en tu zona',
    body: body || 'Hay un nuevo anuncio cerca de ti.',
    url: `/tablon?openAd=${encodeURIComponent(id)}`,
    tag: `ad:${id}`,
    data: { kind: 'ad', id },
  }
}

function shouldNotifyPublication(payload: WebhookPayload) {
  if (!payload.record) return false
  if (payload.type === 'INSERT') return payload.record.active !== false
  if (payload.type === 'UPDATE') return payload.old_record?.active !== true && payload.record.active === true
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
    badge: '/icon-192.png',
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

async function handleTest(req: Request, record: Record<string, unknown>) {
  const userId = text(record.user_id)
  const subscriptions = await fetchActiveSubscriptions([userId])
  console.log('push_test', { userId, subscriptions: subscriptions.length })
  const result = await notifySubscriptions(subscriptions, {
    title: text(record.title, 'Prueba Latido'),
    body: text(record.body, 'Las notificaciones push estan funcionando.'),
    url: text(record.url, '/'),
    tag: `test:${Date.now()}`,
    data: { kind: 'test' },
  })
  return json(req, { ok: true, ...result })
}

async function handleMessage(req: Request, record: Record<string, unknown>) {
  const conversationId = text(record.conversation_id)
  const senderId = text(record.sender_id)
  if (!conversationId || !senderId) return json(req, { ok: true, skipped: 'missing_message_fields' })

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
  if (!conversation) return json(req, { ok: true, skipped: 'conversation_not_found' })

  const recipientId = senderId === conversation.sender_id ? conversation.owner_id : conversation.sender_id
  if (!recipientId || recipientId === senderId) return json(req, { ok: true, skipped: 'no_recipient' })
  if (recipientId === conversation.sender_id && conversation.deleted_by_sender) return json(req, { ok: true, skipped: 'recipient_deleted_thread' })
  if (recipientId === conversation.owner_id && conversation.deleted_by_owner) return json(req, { ok: true, skipped: 'recipient_deleted_thread' })

  const { data: preference, error: preferenceError } = await supabase
    .from('push_notification_preferences')
    .select('messages_enabled')
    .eq('user_id', recipientId)
    .maybeSingle()

  if (preferenceError) throw preferenceError
  if (preference?.messages_enabled === false) return json(req, { ok: true, skipped: 'messages_disabled' })

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

  return json(req, { ok: true, ...result })
}

async function handlePublication(req: Request, table: string, payload: WebhookPayload) {
  const record = payload.record || {}
  if (!shouldNotifyPublication(payload)) return json(req, { ok: true, skipped: 'not_active_publication' })

  const notification = zonePushPayload(table, record)
  if (!notification) return json(req, { ok: true, skipped: 'unsupported_publication' })

  const publicationCanton = text(record.canton)
  const authorId = text(record.user_id)

  const { data: preferences, error } = await supabase
    .from('push_notification_preferences')
    .select('user_id,canton,categories,zone_enabled')
    .eq('zone_enabled', true)

  if (error) throw error

  const recipients = (preferences || [])
    .filter((preference: Record<string, unknown>) => text(preference.user_id) !== authorId)
    .filter((preference: Record<string, unknown>) => {
      const preferredCanton = text(preference.canton)
      return !preferredCanton || preferredCanton === publicationCanton
    })
    .filter((preference: Record<string, unknown>) => categoryMatches(
      table,
      record,
      Array.isArray(preference.categories) ? preference.categories.map(String) : [],
    ))
    .map((preference: Record<string, unknown>) => text(preference.user_id))

  const subscriptions = await fetchActiveSubscriptions(recipients)
  console.log('push_publication', {
    table,
    id: text(record.id),
    canton: publicationCanton,
    recipients: recipients.length,
    subscriptions: subscriptions.length,
  })
  const result = await notifySubscriptions(subscriptions, notification)
  return json(req, { ok: true, ...result })
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
    if (table === 'messages' && payload.type === 'INSERT') return handleMessage(req, record)
    if (['listings', 'ads', 'jobs', 'providers', 'events'].includes(table)) {
      return handlePublication(req, table, payload)
    }

    return json(req, { ok: true, skipped: 'unsupported_event', table })
  } catch (error) {
    console.error(error)
    return json(req, { ok: false, error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
