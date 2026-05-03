import { supabase } from './supabase'
import { normalizeAdCat } from './constants'

export const PUSH_SETTINGS_KEY = 'latido_alerts'
export const PUSH_STATUS_EVENT = 'latido_push_status_changed'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY
const VAPID_KEY_STORAGE_KEY = 'latido_vapid_public_key'
const PUSH_MANUAL_DISABLED_KEY = 'latido_push_manual_disabled'

export function notifyPushStatusChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PUSH_STATUS_EVENT))
  }
}

function isManuallyDisabled() {
  return localStorage.getItem(PUSH_MANUAL_DISABLED_KEY) === '1'
}

export function normalizePushCategories(categories = []) {
  return Array.from(new Set((categories || []).map(normalizeAdCat).filter(Boolean)))
}

export function loadPushSettings() {
  try {
    const settings = JSON.parse(localStorage.getItem(PUSH_SETTINGS_KEY) || '{}')
    return {
      messagesEnabled: settings.messagesEnabled !== false,
      ...settings,
      categories: normalizePushCategories(settings.categories),
    }
  } catch {
    return { messagesEnabled: true, categories: [] }
  }
}

export function isPushSupported() {
  return Boolean(
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window,
  )
}

function urlBase64ToUint8Array(value) {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map(char => char.charCodeAt(0)))
}

async function ensureServiceWorkerRegistration() {
  if (!isPushSupported()) throw new Error('Este navegador no soporta push web en este contexto.')

  const current = await navigator.serviceWorker.getRegistration('/')
  if (current) {
    await current.update().catch(() => {})
    return navigator.serviceWorker.ready
  }

  await navigator.serviceWorker.register('/sw.js')
  return navigator.serviceWorker.ready
}

async function disableStoredSubscription(subscription, user) {
  if (!subscription) return

  if (user?.id) {
    await supabase
      .from('push_subscriptions')
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq('endpoint', subscription.endpoint)
      .eq('user_id', user.id)
  }

  await subscription.unsubscribe().catch(() => {})
}

async function getCurrentVapidSubscription(registration, user) {
  let subscription = await registration.pushManager.getSubscription()
  const storedVapidKey = localStorage.getItem(VAPID_KEY_STORAGE_KEY)

  if (subscription && storedVapidKey !== VAPID_PUBLIC_KEY) {
    await disableStoredSubscription(subscription, user)
    subscription = null
  }

  return subscription
}

function getExpirationIso(subscription) {
  if (!subscription.expirationTime) return null
  const date = new Date(subscription.expirationTime)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function buildSubscriptionRecord(subscription, user) {
  const json = subscription.toJSON()
  const keys = json.keys || {}

  return {
    user_id: user.id,
    endpoint: json.endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    expiration_time: getExpirationIso(subscription),
    origin: window.location.origin,
    user_agent: navigator.userAgent,
    enabled: true,
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

function buildPreferenceRecord({ user, settings = {}, userCanton = '', messagesEnabled = true }) {
  const canton = settings.canton || userCanton || null
  const categories = normalizePushCategories(settings.categories)

  return {
    user_id: user.id,
    messages_enabled: messagesEnabled,
    zone_enabled: Boolean(settings.enabled),
    canton,
    categories,
    updated_at: new Date().toISOString(),
  }
}

export async function syncPushPreferences({ user, settings, userCanton, messagesEnabled = true }) {
  if (!user?.id) return

  const { error } = await supabase
    .from('push_notification_preferences')
    .upsert(buildPreferenceRecord({ user, settings, userCanton, messagesEnabled }), { onConflict: 'user_id' })

  if (error) throw error
}

export async function getPushStatus() {
  if (!isPushSupported()) {
    return { supported: false, permission: 'unsupported', subscribed: false }
  }

  const registration = await ensureServiceWorkerRegistration()
  const subscription = await registration.pushManager.getSubscription()

  return {
    supported: true,
    permission: Notification.permission,
    subscribed: Boolean(subscription) && !isManuallyDisabled(),
  }
}

export async function subscribeToPushNotifications({ user, settings, userCanton }) {
  if (!user?.id) throw new Error('Inicia sesión para activar las notificaciones.')
  if (!VAPID_PUBLIC_KEY) throw new Error('Falta VITE_VAPID_PUBLIC_KEY en el entorno de la app.')
  if (!isPushSupported()) throw new Error('Este navegador no soporta push web en este contexto.')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Activa las notificaciones desde los ajustes del navegador para recibir alertas.')

  const registration = await ensureServiceWorkerRegistration()
  let subscription = await getCurrentVapidSubscription(registration, user)

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }

  const record = buildSubscriptionRecord(subscription, user)
  if (!record.endpoint || !record.p256dh || !record.auth) {
    throw new Error('El navegador no entrego una suscripcion push completa.')
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(record, { onConflict: 'endpoint' })

  if (error) throw error

  localStorage.removeItem(PUSH_MANUAL_DISABLED_KEY)
  localStorage.setItem(VAPID_KEY_STORAGE_KEY, VAPID_PUBLIC_KEY)
  await syncPushPreferences({ user, settings, userCanton, messagesEnabled: true })
  notifyPushStatusChanged()

  return { supported: true, permission, subscribed: true }
}

export async function syncExistingPushRegistration({ user, settings, userCanton }) {
  if (!user?.id || !isPushSupported() || Notification.permission !== 'granted' || !VAPID_PUBLIC_KEY) return
  if (isManuallyDisabled()) return

  const registration = await ensureServiceWorkerRegistration()
  const subscription = await getCurrentVapidSubscription(registration, user)

  if (!subscription) return

  await supabase
    .from('push_subscriptions')
    .upsert(buildSubscriptionRecord(subscription, user), { onConflict: 'endpoint' })

  localStorage.setItem(VAPID_KEY_STORAGE_KEY, VAPID_PUBLIC_KEY)
  await syncPushPreferences({ user, settings, userCanton, messagesEnabled: true })
  notifyPushStatusChanged()
}

export async function unsubscribeFromPushNotifications({ user }) {
  if (!isPushSupported()) return { supported: false, permission: 'unsupported', subscribed: false }

  const registration = await ensureServiceWorkerRegistration()
  const subscription = await registration.pushManager.getSubscription()

  if (subscription && user?.id) {
    await supabase
      .from('push_subscriptions')
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq('endpoint', subscription.endpoint)
      .eq('user_id', user.id)

    await subscription.unsubscribe().catch(() => {})
  } else if (subscription) {
    await subscription.unsubscribe().catch(() => {})
  }

  localStorage.removeItem(VAPID_KEY_STORAGE_KEY)
  localStorage.setItem(PUSH_MANUAL_DISABLED_KEY, '1')

  if (user?.id) {
    await supabase
      .from('push_notification_preferences')
      .upsert({
        user_id: user.id,
        messages_enabled: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
  }

  notifyPushStatusChanged()
  return { supported: true, permission: Notification.permission, subscribed: false }
}
