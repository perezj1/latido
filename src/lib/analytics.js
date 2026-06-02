import { supabase } from './supabase'

const SESSION_KEY = 'latido_analytics_session_id'
let lastEventKey = ''
let lastEventAt = 0
let analyticsDisabled = false

function getSessionId() {
  try {
    const existing = window.localStorage.getItem(SESSION_KEY)
    if (existing) return existing

    const next = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`

    window.localStorage.setItem(SESSION_KEY, next)
    return next
  } catch {
    return 'session-unavailable'
  }
}

function shouldSkipDuplicate(eventType, payload) {
  const key = JSON.stringify({
    eventType,
    path: payload.path,
    search: payload.search,
    query: payload.metadata?.query,
    scope: payload.metadata?.scope,
  })
  const now = Date.now()
  if (key === lastEventKey && now - lastEventAt < 1500) return true
  lastEventKey = key
  lastEventAt = now
  return false
}

export async function trackAnalyticsEvent(eventType, payload = {}) {
  if (!eventType || analyticsDisabled || typeof window === 'undefined') return

  const path = payload.path || window.location.pathname
  const search = payload.search ?? window.location.search
  const metadata = payload.metadata || {}

  if (shouldSkipDuplicate(eventType, { path, search, metadata })) return

  try {
    const { error } = await supabase
      .from('analytics_events')
      .insert({
        event_type: eventType,
        path,
        search,
        user_id: payload.user_id || null,
        session_id: getSessionId(),
        metadata,
      })

    if (error) {
      analyticsDisabled = true
      console.warn('Analytics event not saved:', error.message)
    }
  } catch (error) {
    analyticsDisabled = true
    console.warn('Analytics event failed:', error)
  }
}

export function trackSearchEvent({ query, scope, user_id, metadata = {} }) {
  const cleanQuery = String(query || '').trim()
  if (cleanQuery.length < 2) return

  return trackAnalyticsEvent('search', {
    user_id,
    metadata: {
      ...metadata,
      query: cleanQuery.slice(0, 120),
      scope,
    },
  })
}
