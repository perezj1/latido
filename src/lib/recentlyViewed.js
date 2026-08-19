const RECENTLY_VIEWED_KEY_PREFIX = 'latido_recently_viewed_v1:'
const RECENTLY_VIEWED_EVENT = 'latido:recently-viewed'
const MAX_RECENTLY_VIEWED = 12

const ALLOWED_TYPES = new Set([
  'ad',
  'job',
  'business',
  'community',
  'event',
  'guide',
  'creator',
  'creator_content',
])

function getStorageKey(userId) {
  const scope = String(userId || 'guest')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 80) || 'guest'
  return `${RECENTLY_VIEWED_KEY_PREFIX}${scope}`
}

function cleanText(value, maxLength) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength)
}

function cleanImage(value) {
  const image = String(value || '').trim()
  if (!image || /^data:/i.test(image)) return ''
  return image.slice(0, 1000)
}

function normalizeEntry(entry) {
  const type = cleanText(entry?.type, 40)
  const id = cleanText(entry?.id, 120)
  const label = cleanText(entry?.label, 160)
  const href = cleanText(entry?.href, 1000)

  if (!ALLOWED_TYPES.has(type) || !id || !label) return null
  if (!href.startsWith('/') && !/^https?:\/\//i.test(href)) return null

  return {
    type,
    id,
    label,
    sub:cleanText(entry?.sub, 220),
    href,
    image:cleanImage(entry?.image),
    imageFit:entry?.imageFit === 'contain' ? 'contain' : 'cover',
    icon:cleanText(entry?.icon, 12),
    viewedAt:Number.isFinite(Number(entry?.viewedAt)) ? Number(entry.viewedAt) : Date.now(),
  }
}

function emitRecentlyViewedChange(storageKey, items) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(RECENTLY_VIEWED_EVENT, {
    detail:{ storageKey, items },
  }))
}

export function readRecentlyViewed(userId) {
  if (typeof window === 'undefined') return []

  try {
    const stored = JSON.parse(window.localStorage.getItem(getStorageKey(userId)) || '[]')
    if (!Array.isArray(stored)) return []
    return stored.map(normalizeEntry).filter(Boolean).slice(0, MAX_RECENTLY_VIEWED)
  } catch {
    return []
  }
}

export function rememberRecentlyViewed(entry, userId) {
  if (typeof window === 'undefined') return []

  const nextEntry = normalizeEntry({ ...entry, viewedAt:Date.now() })
  if (!nextEntry) return readRecentlyViewed(userId)

  const next = [
    nextEntry,
    ...readRecentlyViewed(userId).filter(item => (
      `${item.type}:${item.id}` !== `${nextEntry.type}:${nextEntry.id}`
    )),
  ].slice(0, MAX_RECENTLY_VIEWED)
  const storageKey = getStorageKey(userId)

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(next))
  } catch {}
  emitRecentlyViewedChange(storageKey, next)
  return next
}

export function clearRecentlyViewed(userId) {
  if (typeof window === 'undefined') return []
  const storageKey = getStorageKey(userId)

  try {
    window.localStorage.removeItem(storageKey)
  } catch {}
  emitRecentlyViewedChange(storageKey, [])
  return []
}

export function subscribeRecentlyViewed(userId, callback) {
  if (typeof window === 'undefined' || typeof callback !== 'function') return () => {}
  const storageKey = getStorageKey(userId)

  const handleLocalChange = event => {
    if (event.detail?.storageKey !== storageKey) return
    callback(Array.isArray(event.detail.items) ? event.detail.items : readRecentlyViewed(userId))
  }
  const handleStorageChange = event => {
    if (event.key !== storageKey) return
    callback(readRecentlyViewed(userId))
  }

  window.addEventListener(RECENTLY_VIEWED_EVENT, handleLocalChange)
  window.addEventListener('storage', handleStorageChange)
  return () => {
    window.removeEventListener(RECENTLY_VIEWED_EVENT, handleLocalChange)
    window.removeEventListener('storage', handleStorageChange)
  }
}
