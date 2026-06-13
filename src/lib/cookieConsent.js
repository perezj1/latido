export const COOKIE_CONSENT_STORAGE_KEY = 'latido_cookie_consent'
export const COOKIE_CONSENT_EVENT = 'latido:cookie-consent-changed'
export const OPEN_COOKIE_SETTINGS_EVENT = 'latido:open-cookie-settings'

const POLICY_VERSION = '2026-06-13'
const CONSENT_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000
const ANALYTICS_SESSION_KEY = 'latido_analytics_session_id'

function isValidConsent(value) {
  if (!value || value.policyVersion !== POLICY_VERSION) return false
  if (!value.expiresAt || Date.parse(value.expiresAt) <= Date.now()) return false
  return typeof value.categories?.analytics === 'boolean'
}

export function getCookieConsent() {
  if (typeof window === 'undefined') return null

  try {
    const value = JSON.parse(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) || 'null')
    if (isValidConsent(value)) return value
    window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY)
  } catch {
    // A blocked or malformed store is treated as no consent.
  }

  return null
}

export function hasAnalyticsConsent() {
  return getCookieConsent()?.categories.analytics === true
}

export function clearAnalyticsStorage() {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.removeItem(ANALYTICS_SESSION_KEY)
    window.localStorage.removeItem('latido_partner_attribution')
    window.localStorage.removeItem('latido_partner_first_touch')
    window.sessionStorage.removeItem(ANALYTICS_SESSION_KEY)
  } catch {
    // Consent still applies even when browser storage cannot be accessed.
  }
}

export function saveCookieConsent({ analytics }) {
  if (typeof window === 'undefined') return null

  const savedAt = new Date()
  const consent = {
    policyVersion: POLICY_VERSION,
    savedAt: savedAt.toISOString(),
    expiresAt: new Date(savedAt.getTime() + CONSENT_MAX_AGE_MS).toISOString(),
    categories: {
      necessary: true,
      analytics: analytics === true,
    },
  }

  try {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(consent))
  } catch {
    // The in-memory event still lets the current page respect the decision.
  }

  if (!consent.categories.analytics) clearAnalyticsStorage()
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: consent }))
  return consent
}

export function subscribeCookieConsent(listener) {
  if (typeof window === 'undefined') return () => {}

  const onConsent = event => listener(event.detail || getCookieConsent())
  const onStorage = event => {
    if (event.key === COOKIE_CONSENT_STORAGE_KEY) listener(getCookieConsent())
  }

  window.addEventListener(COOKIE_CONSENT_EVENT, onConsent)
  window.addEventListener('storage', onStorage)

  return () => {
    window.removeEventListener(COOKIE_CONSENT_EVENT, onConsent)
    window.removeEventListener('storage', onStorage)
  }
}

export function openCookieSettings() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))
}
