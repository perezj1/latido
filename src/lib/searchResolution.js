const STORAGE_KEY = 'latido_pending_search_resolution'
const CONTEXT_EVENT = 'latido:search-resolution-context'
const MAX_PENDING_AGE_MS = 24 * 60 * 60 * 1000

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function emitContextChange(context) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(CONTEXT_EVENT, { detail:context }))
}

export function createSearchAttemptId() {
  return createId()
}

export function readPendingSearchResolution() {
  if (typeof window === 'undefined') return null

  try {
    const context = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || 'null')
    const openedAt = Number(context?.opened_at || 0)
    if (
      !context?.search_attempt_id
      || !context?.query
      || !openedAt
      || Date.now() - openedAt > MAX_PENDING_AGE_MS
    ) {
      window.sessionStorage.removeItem(STORAGE_KEY)
      return null
    }
    return context
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function rememberSearchResultForResolution(context) {
  if (typeof window === 'undefined' || !context?.search_attempt_id || !context?.query) return null

  const nextContext = {
    search_attempt_id:String(context.search_attempt_id),
    query:String(context.query).trim().slice(0, 120),
    result_id:String(context.result_id || ''),
    result_type:String(context.result_type || ''),
    result_label:String(context.result_label || '').slice(0, 160),
    result_href:String(context.result_href || ''),
    source_path:String(context.source_path || ''),
    opened_at:Number(context.opened_at || Date.now()),
    action_recorded_at:null,
    action:'',
  }

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextContext))
    emitContextChange(nextContext)
    return nextContext
  } catch {
    return null
  }
}

export function updatePendingSearchResolution(updates) {
  const current = readPendingSearchResolution()
  if (!current) return null

  const nextContext = { ...current, ...updates }
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextContext))
    emitContextChange(nextContext)
    return nextContext
  } catch {
    return current
  }
}

export function clearPendingSearchResolution() {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {}
  emitContextChange(null)
}

export function subscribeSearchResolutionContext(callback) {
  if (typeof window === 'undefined') return () => {}

  const handler = event => callback(event.detail ?? readPendingSearchResolution())
  window.addEventListener(CONTEXT_EVENT, handler)
  return () => window.removeEventListener(CONTEXT_EVENT, handler)
}
