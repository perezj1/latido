const NEW_ACCOUNT_WINDOW_MS = 10 * 60 * 1000

export function isGoogleAuthUser(user) {
  if (!user) return false
  const providers = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers
    : [user.app_metadata?.provider]
  return providers.includes('google')
}

export function needsGoogleProfileOnboarding(user) {
  return isGoogleAuthUser(user)
    && user?.user_metadata?.latido_onboarding_completed !== true
}

export function isRecentlyCreatedAuthUser(user, now=Date.now()) {
  const createdAt = Date.parse(user?.created_at || '')
  return Number.isFinite(createdAt)
    && now >= createdAt
    && now - createdAt <= NEW_ACCOUNT_WINDOW_MS
}

export function getGooglePostAuthPath(user, nextPath='/') {
  if (!needsGoogleProfileOnboarding(user) || !isRecentlyCreatedAuthUser(user)) return nextPath
  return `/auth/onboarding?next=${encodeURIComponent(nextPath)}`
}
