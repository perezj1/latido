const STORAGE_PREFIX = 'latido:rotation:'
const memoryOffsets = new Map()

export function rotateItems(items = [], offset = 0) {
  if (!Array.isArray(items) || items.length < 2) return items || []

  const normalizedOffset = ((Number(offset) || 0) % items.length + items.length) % items.length
  if (!normalizedOffset) return items

  return [...items.slice(normalizedOffset), ...items.slice(0, normalizedOffset)]
}

export function mixRecentWithOlder(items = [], rotationBucket = 0, getCreatedAt = item => item?.created_at) {
  if (!Array.isArray(items) || items.length < 3) return items || []

  const sorted = [...items].sort((a, b) => {
    const aTime = new Date(getCreatedAt(a) || 0).getTime()
    const bTime = new Date(getCreatedAt(b) || 0).getTime()
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0)
  })
  const recentCount = Math.ceil(sorted.length / 2)
  const recent = sorted.slice(0, recentCount)
  const older = rotateItems(sorted.slice(recentCount), rotationBucket)
  const mixed = []

  for (let index = 0; index < recent.length; index += 1) {
    mixed.push(recent[index])
    if (older[index]) mixed.push(older[index])
  }

  return mixed
}

export function takeNextRotationOffset(key, itemCount) {
  const count = Math.max(0, Number(itemCount) || 0)
  if (count < 2) return 0

  const storageKey = `${STORAGE_PREFIX}${key}`
  let previousOffset = memoryOffsets.get(storageKey) ?? 0

  try {
    const storedOffset = window.localStorage.getItem(storageKey)
    if (storedOffset != null && Number.isFinite(Number(storedOffset))) {
      previousOffset = Number(storedOffset)
    }
  } catch {
    // La rotación sigue funcionando en memoria si el navegador bloquea storage.
  }

  const nextOffset = (previousOffset + 1) % count
  memoryOffsets.set(storageKey, nextOffset)

  try {
    window.localStorage.setItem(storageKey, String(nextOffset))
  } catch {
    // Sin persistencia, el contador en memoria mantiene la sesión estable.
  }

  return nextOffset
}
