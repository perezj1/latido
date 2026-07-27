const DAY_MS = 24 * 60 * 60 * 1000

export const REQUEST_LIFETIME_DAYS = 30
export const PROFESSIONAL_PROFILE_LIFETIME_DAYS = 45

export function getPublicationLifetimeDays({ kind='listing', intent='' }={}) {
  if (intent !== 'busca') return null
  return kind === 'job' ? PROFESSIONAL_PROFILE_LIFETIME_DAYS : REQUEST_LIFETIME_DAYS
}
export function getPublicationExpiresAt({ kind='listing', intent='', from=new Date() }={}) {
  const days = getPublicationLifetimeDays({ kind, intent })
  if (!days) return null
  return new Date(new Date(from).getTime() + days * DAY_MS).toISOString()
}

export function isPublicationExpired(publication={}, now=Date.now()) {
  if (!publication?.expires_at) return false
  const expiresAt = new Date(publication.expires_at).getTime()
  return Number.isFinite(expiresAt) && expiresAt <= Number(now)
}

export function isPublicationOpen(publication={}, now=Date.now()) {
  if (publication?.active === false) return false
  if (['resolved', 'expired', 'closed'].includes(publication?.lifecycle_status)) return false
  return !isPublicationExpired(publication, now)
}

export function getLifecycleLabel(publication={}) {
  if (publication?.lifecycle_status === 'resolved') return 'Resuelta'
  if (publication?.lifecycle_status === 'closed') return 'Cerrada'
  if (isPublicationExpired(publication) || publication?.lifecycle_status === 'expired') return 'Caducada'
  if (publication?.active === false) return 'Inactiva'
  return 'Activa'
}
