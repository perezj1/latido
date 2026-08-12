import assert from 'node:assert/strict'

class FakeStorage {
  constructor({ entries={}, limit=Infinity, failWrites=false }={}) {
    this.entries = new Map(Object.entries(entries))
    this.limit = limit
    this.failWrites = failWrites
  }

  get length() { return this.entries.size }
  key(index) { return [...this.entries.keys()][index] ?? null }
  getItem(key) { return this.entries.get(key) ?? null }
  removeItem(key) { this.entries.delete(key) }
  setItem(key, value) {
    if (this.failWrites) throw new DOMException('Storage is full', 'QuotaExceededError')
    const next = new Map(this.entries)
    next.set(key, String(value))
    const size = [...next].reduce((sum, [entryKey, entryValue]) => sum + entryKey.length + entryValue.length, 0)
    if (size > this.limit) throw new DOMException('Storage is full', 'QuotaExceededError')
    this.entries = next
  }
}

const localStorage = new FakeStorage({
  entries: {
    'latido:offline:v1:home-public':'x'.repeat(420),
    latido_cookie_consent:'{"accepted":true}',
  },
  limit:560,
})
const sessionStorage = new FakeStorage()
globalThis.window = { localStorage, sessionStorage }

const { resilientAuthStorage } = await import('../src/lib/authStorage.js')

const authKey = 'sb-project-auth-token'
const authValue = JSON.stringify({ access_token:'a'.repeat(120), user:{ id:'user-1' } })
resilientAuthStorage.setItem(authKey, authValue)

assert.equal(localStorage.getItem(authKey), authValue)
assert.equal(localStorage.getItem('latido:offline:v1:home-public'), null)
assert.equal(localStorage.getItem('latido_cookie_consent'), '{"accepted":true}')

const unavailableLocalStorage = new FakeStorage({ failWrites:true })
const fallbackSessionStorage = new FakeStorage()
globalThis.window = { localStorage:unavailableLocalStorage, sessionStorage:fallbackSessionStorage }

const fallbackKey = 'sb-project-fallback-auth-token'
resilientAuthStorage.setItem(fallbackKey, authValue)
assert.equal(resilientAuthStorage.getItem(fallbackKey), authValue)
assert.equal(fallbackSessionStorage.getItem(fallbackKey), authValue)

resilientAuthStorage.removeItem(fallbackKey)
assert.equal(resilientAuthStorage.getItem(fallbackKey), null)

console.log('Resilient auth storage tests passed')
