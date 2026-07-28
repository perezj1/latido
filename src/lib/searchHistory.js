const SEARCH_HISTORY_KEY = 'latido_recent_searches_v1'
const MAX_RECENT_SEARCHES = 8

function normalizeEntry(entry) {
  const query = String(entry?.query || '').trim().replace(/\s+/g, ' ').slice(0, 120)
  if (query.length < 2) return null

  return {
    query,
    scope:String(entry?.scope || 'global').slice(0, 40),
    category:String(entry?.category || '').slice(0, 40),
    canton:String(entry?.canton || '').slice(0, 20),
    intent:String(entry?.intent || '').slice(0, 30),
    createdAt:Number(entry?.createdAt || Date.now()),
  }
}

export function readRecentSearches(scope='') {
  if (typeof window === 'undefined') return []

  try {
    const stored = JSON.parse(window.localStorage.getItem(SEARCH_HISTORY_KEY) || '[]')
    if (!Array.isArray(stored)) return []

    const entries = stored.map(normalizeEntry).filter(Boolean)
    if (!scope || scope === 'global') return entries.slice(0, MAX_RECENT_SEARCHES)

    const scoped = entries.filter(entry => entry.scope === scope)
    const remaining = entries.filter(entry => entry.scope !== scope)
    return [...scoped, ...remaining].slice(0, MAX_RECENT_SEARCHES)
  } catch {
    return []
  }
}

export function rememberRecentSearch(entry) {
  if (typeof window === 'undefined') return []

  const nextEntry = normalizeEntry(entry)
  if (!nextEntry) return readRecentSearches()

  const normalizedQuery = nextEntry.query.toLocaleLowerCase('es')
  const next = [
    nextEntry,
    ...readRecentSearches().filter(item => item.query.toLocaleLowerCase('es') !== normalizedQuery),
  ].slice(0, MAX_RECENT_SEARCHES)

  try {
    window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next))
  } catch {}
  return next
}

export function removeRecentSearch(query) {
  if (typeof window === 'undefined') return []
  const normalizedQuery = String(query || '').trim().toLocaleLowerCase('es')
  const next = readRecentSearches()
    .filter(item => item.query.toLocaleLowerCase('es') !== normalizedQuery)

  try {
    window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next))
  } catch {}
  return next
}

export function clearRecentSearches() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(SEARCH_HISTORY_KEY)
  } catch {}
}
