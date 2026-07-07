import { supabase } from './supabase'

const SESSION_KEY = 'latido_email_presence_session_id'
const HEARTBEAT_MS = 20_000
const ACTIVE_WINDOW_MS = 45_000

function isLocalDevelopment() {
  if (typeof window === 'undefined') return true

  return import.meta.env.DEV ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '::1' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.endsWith('.localhost')
}

function getSessionId() {
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY)
    if (existing) return existing

    const next = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`

    window.sessionStorage.setItem(SESSION_KEY, next)
    return next
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
}

export function startEmailNotificationPresence(userId) {
  if (!userId || isLocalDevelopment()) return () => {}

  const sessionId = getSessionId()
  let stopped = false
  let requestInFlight = false

  const sync = async active => {
    if (stopped || requestInFlight) return
    requestInFlight = true

    const now = Date.now()
    try {
      const { error } = await supabase
        .rpc('upsert_app_presence_session', {
          p_session_id: sessionId,
          p_active_until: new Date(active ? now + ACTIVE_WINDOW_MS : now).toISOString(),
          p_last_seen_at: new Date(now).toISOString(),
        })

      if (error && !stopped) {
        console.warn('Could not sync email notification presence:', error.message)
      }
    } catch (error) {
      if (!stopped) {
        console.warn('Could not sync email notification presence:', error?.message || error)
      }
    } finally {
      requestInFlight = false
    }
  }

  const syncVisibility = () => {
    void sync(document.visibilityState === 'visible')
  }
  const deactivate = () => {
    void sync(false)
  }

  syncVisibility()
  const heartbeat = window.setInterval(() => {
    if (document.visibilityState === 'visible') void sync(true)
  }, HEARTBEAT_MS)

  window.addEventListener('focus', syncVisibility)
  window.addEventListener('pagehide', deactivate)
  document.addEventListener('visibilitychange', syncVisibility)

  return () => {
    window.clearInterval(heartbeat)
    window.removeEventListener('focus', syncVisibility)
    window.removeEventListener('pagehide', deactivate)
    document.removeEventListener('visibilitychange', syncVisibility)
    void sync(false)
    stopped = true
  }
}
