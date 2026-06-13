import { track as trackVercelEvent } from '@vercel/analytics'
import { supabase } from './supabase'
import { hasAnalyticsConsent } from './cookieConsent'

const SESSION_KEY = 'latido_analytics_session_id'
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])
const DYNAMIC_ROUTES = [
  [/^\/anuncios\/[^/]+\/?$/, '/anuncios/[adSlug]'],
  [/^\/empleos\/[^/]+\/?$/, '/empleos/[jobSlug]'],
  [/^\/negocios\/[^/]+\/?$/, '/negocios/[businessSlug]'],
  [/^\/eventos\/[^/]+\/?$/, '/eventos/[eventSlug]'],
  [/^\/guias\/[^/]+\/?$/, '/guias/[guideSlug]'],
]
const VERCEL_EVENT_PROPERTIES = {
  search: ['scope', 'cat', 'category', 'active_filter'],
  search_result_open: ['result_type'],
  partner_page_view: ['partner_id', 'placement'],
  partner_service_click: ['partner_id', 'placement', 'service'],
  partner_cross_click: ['partner_id', 'placement'],
  partner_outbound_click: ['partner_id', 'placement', 'action', 'service'],
}
let lastEventKey = ''
let lastEventAt = 0
let analyticsRetryAfter = 0

export function isAnalyticsEnabled() {
  if (!import.meta.env.PROD || typeof window === 'undefined') return false

  const hostname = window.location.hostname.toLowerCase()
  return hasAnalyticsConsent() &&
    !LOCAL_HOSTNAMES.has(hostname) &&
    !hostname.endsWith('.localhost')
}

export function getAnalyticsRoute(pathname = '/') {
  const route = pathname || '/'
  return DYNAMIC_ROUTES.find(([pattern]) => pattern.test(route))?.[1] || route
}

export function sanitizeVercelAnalyticsEvent(event) {
  if (!hasAnalyticsConsent()) return null
  if (!event?.url || typeof window === 'undefined') return event

  try {
    const url = new URL(event.url, window.location.origin)
    url.pathname = getAnalyticsRoute(url.pathname)
    url.search = ''
    url.hash = ''
    return { ...event, url: url.toString() }
  } catch {
    return event
  }
}

function getSessionId() {
  try {
    window.localStorage.removeItem(SESSION_KEY)
    const existing = window.sessionStorage.getItem(SESSION_KEY)
    if (existing) return existing

    const next = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`

    window.sessionStorage.setItem(SESSION_KEY, next)
    return next
  } catch {
    return 'session-unavailable'
  }
}

function shouldSkipDuplicate(eventType, payload) {
  if (eventType === 'partner_outbound_click') return false

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

function getVercelProperties(eventType, metadata) {
  const keys = VERCEL_EVENT_PROPERTIES[eventType] || []

  return Object.fromEntries(keys.flatMap(key => {
    const value = metadata[key]
    if (value === null || value === undefined || value === '') return []
    if (typeof value === 'number' && Number.isFinite(value)) return [[key, value]]
    if (typeof value === 'boolean') return [[key, value]]
    if (typeof value === 'string') return [[key, value.slice(0, 255)]]
    return []
  }))
}

function sendVercelCustomEvent(eventType, metadata) {
  if (eventType === 'page_view') return

  try {
    trackVercelEvent(eventType.slice(0, 255), getVercelProperties(eventType, metadata))
  } catch (error) {
    console.warn('Vercel analytics event failed:', error)
  }
}

export async function trackAnalyticsEvent(eventType, payload = {}) {
  if (!eventType || !isAnalyticsEnabled()) return

  const path = payload.path || window.location.pathname
  const search = payload.search ?? window.location.search
  const metadata = payload.metadata || {}

  if (shouldSkipDuplicate(eventType, { path, search, metadata })) return
  sendVercelCustomEvent(eventType, metadata)

  if (Date.now() < analyticsRetryAfter) return

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
      analyticsRetryAfter = Date.now() + 30_000
      console.warn('Analytics event not saved:', error.message)
    } else {
      analyticsRetryAfter = 0
    }
  } catch (error) {
    analyticsRetryAfter = Date.now() + 30_000
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
