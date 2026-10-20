import { cardRpc } from './latidoCard'

const KEY = 'lc-public-catalog-v1'
const MAX_AGE = 60_000
let cached = null,
  fetchedAt = 0,
  pending = null,
  generation = 0
const listeners = new Set()

export function getCachedCardCatalog() {
  if (cached) return cached
  try {
    const stored = JSON.parse(sessionStorage.getItem(KEY))
    if (Array.isArray(stored?.offers) && Number.isFinite(stored.fetchedAt)) {
      cached = stored.offers
      fetchedAt = stored.fetchedAt
    }
  } catch {}
  return cached
}

export function loadCardCatalog({ revalidate = false } = {}) {
  const current = getCachedCardCatalog()
  if (!revalidate && current && Date.now() - fetchedAt < MAX_AGE)
    return Promise.resolve(current)
  if (!pending) {
    const version = generation
    pending = cardRpc('lc_catalog')
      .then((offers) => {
        if (version === generation) {
          cached = offers
          fetchedAt = Date.now()
          try {
            sessionStorage.setItem(KEY, JSON.stringify({ offers, fetchedAt }))
          } catch {}
          listeners.forEach((listener) => listener())
        }
        return offers
      })
      .finally(() => {
        if (version === generation) pending = null
      })
  }
  return pending
}

export function invalidateCardCatalog() {
  generation++
  pending = null
  cached = null
  fetchedAt = 0
  try {
    sessionStorage.removeItem(KEY)
  } catch {}
  listeners.forEach((listener) => listener())
}

export const subscribeCardCatalog = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
