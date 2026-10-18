import { cardRpc } from './latidoCard'

const KEY = 'lc-public-catalog-v1'
let cached = null,
  pending = null,
  generation = 0
const listeners = new Set()

export function getCachedCardCatalog() {
  if (cached) return cached
  try {
    const stored = JSON.parse(sessionStorage.getItem(KEY))
    if (Array.isArray(stored)) cached = stored
  } catch {}
  return cached
}

export function loadCardCatalog() {
  const current = getCachedCardCatalog()
  if (current) return Promise.resolve(current)
  if (!pending) {
    const version = generation
    pending = cardRpc('lc_catalog')
      .then((offers) => {
        if (version === generation) {
          cached = offers
          try {
            sessionStorage.setItem(KEY, JSON.stringify(offers))
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
  try {
    sessionStorage.removeItem(KEY)
  } catch {}
  listeners.forEach((listener) => listener())
}

export const subscribeCardCatalog = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
