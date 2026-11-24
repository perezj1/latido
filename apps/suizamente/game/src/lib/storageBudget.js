const DISPOSABLE_STORAGE_PREFIXES = [
  'latido:offline:v1:',
  'latido:eventfrog:v2:',
]

const DISPOSABLE_STORAGE_KEYS = new Set([
  'latido_creator_directory_cache_v1',
])

const MAX_DISPOSABLE_STORAGE_CHARS = 1_200_000
const MAX_DISPOSABLE_ENTRY_CHARS = 600_000

export function isDisposableStorageKey(key='') {
  return DISPOSABLE_STORAGE_KEYS.has(key)
    || DISPOSABLE_STORAGE_PREFIXES.some(prefix => key.startsWith(prefix))
}

function getDisposableEntries(storage, exceptKey='') {
  const entries = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (!key || key === exceptKey || !isDisposableStorageKey(key)) continue
    const value = storage.getItem(key) || ''
    entries.push({ key, size:key.length + value.length })
  }
  return entries
}

export function clearDisposableLocalStorage(exceptKey='') {
  if (typeof window === 'undefined') return 0

  let removed = 0
  try {
    const keys = getDisposableEntries(window.localStorage, exceptKey).map(entry => entry.key)
    keys.forEach(key => {
      window.localStorage.removeItem(key)
      removed += 1
    })
  } catch {}
  return removed
}

export function writeDisposableLocalStorage(key, value) {
  if (typeof window === 'undefined') return false

  const serialized = String(value ?? '')
  if (serialized.length > MAX_DISPOSABLE_ENTRY_CHARS) {
    try { window.localStorage.removeItem(key) } catch {}
    return false
  }

  try {
    const entries = getDisposableEntries(window.localStorage, key)
      .sort((left, right) => right.size - left.size)
    let total = serialized.length + entries.reduce((sum, entry) => sum + entry.size, 0)

    for (const entry of entries) {
      if (total <= MAX_DISPOSABLE_STORAGE_CHARS) break
      window.localStorage.removeItem(entry.key)
      total -= entry.size
    }

    window.localStorage.setItem(key, serialized)
    return true
  } catch {
    clearDisposableLocalStorage(key)
    try {
      window.localStorage.setItem(key, serialized)
      return true
    } catch {
      try { window.localStorage.removeItem(key) } catch {}
      return false
    }
  }
}
