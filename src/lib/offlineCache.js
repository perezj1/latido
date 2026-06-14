const CACHE_PREFIX = 'latido:offline:v1:'

export function readOfflineSnapshot(name) {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(`${CACHE_PREFIX}${name}`)
    if (!raw) return null

    const snapshot = JSON.parse(raw)
    if (!snapshot || typeof snapshot !== 'object' || !('data' in snapshot)) return null

    return {
      data: snapshot.data,
      savedAt: Number(snapshot.savedAt) || 0,
    }
  } catch {
    return null
  }
}

export function writeOfflineSnapshot(name, data) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(`${CACHE_PREFIX}${name}`, JSON.stringify({
      savedAt: Date.now(),
      data,
    }))
  } catch (error) {
    console.warn(`Could not persist offline snapshot "${name}":`, error)
  }
}
