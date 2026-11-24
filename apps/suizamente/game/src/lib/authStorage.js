import { clearDisposableLocalStorage } from './storageBudget.js'

const memoryStorage = new Map()

function getWindowStorage(name) {
  try { return window?.[name] ?? null } catch { return null }
}

function readStorage(storage, key) {
  try { return storage?.getItem(key) ?? null } catch { return null }
}

function removeStorage(storage, key) {
  try { storage?.removeItem(key) } catch {}
}

function writeStorage(storage, key, value) {
  if (!storage) return false
  try {
    storage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export const resilientAuthStorage = {
  getItem(key) {
    if (typeof window === 'undefined') return memoryStorage.get(key) ?? null
    return readStorage(getWindowStorage('localStorage'), key)
      ?? readStorage(getWindowStorage('sessionStorage'), key)
      ?? memoryStorage.get(key)
      ?? null
  },

  setItem(key, value) {
    const serialized = String(value ?? '')
    if (typeof window !== 'undefined') {
      const localStorage = getWindowStorage('localStorage')
      const sessionStorage = getWindowStorage('sessionStorage')
      if (!writeStorage(localStorage, key, serialized)) {
        clearDisposableLocalStorage()
      }

      if (readStorage(localStorage, key) !== serialized
        && writeStorage(localStorage, key, serialized)) {
        removeStorage(sessionStorage, key)
        memoryStorage.delete(key)
        return
      }

      if (readStorage(localStorage, key) === serialized) {
        removeStorage(sessionStorage, key)
        memoryStorage.delete(key)
        return
      }

      // Storage can be unavailable or unusually constrained in an installed
      // PWA. Remove a stale local value before using the per-window fallback.
      removeStorage(localStorage, key)
      if (writeStorage(sessionStorage, key, serialized)) {
        memoryStorage.delete(key)
        return
      }
    }

    memoryStorage.set(key, serialized)
  },

  removeItem(key) {
    if (typeof window !== 'undefined') {
      removeStorage(getWindowStorage('localStorage'), key)
      removeStorage(getWindowStorage('sessionStorage'), key)
    }
    memoryStorage.delete(key)
  },
}
