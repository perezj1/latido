const SAFE_EXTERNAL_PROTOCOL = /^(https?:|mailto:|tel:|sms:|whatsapp:)/i
const ANY_PROTOCOL = /^[a-z][a-z0-9+.-]*:/i
const DOMAIN_LIKE_URL = /^(?:www\.)?[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?::\d+)?(?:[/?#].*)?$/i
const INSTAGRAM_HANDLE = /^@([a-z0-9._]{1,30})\/?$/i
const INSTAGRAM_PROFILE = /^(?:www\.)?instagram\.com\/@?([a-z0-9._]{1,30})(?:\/)?$/i

export function normalizeExternalUrl(value = '') {
  const raw = String(value || '').trim()
  if (!raw || raw === '#') return ''

  if (SAFE_EXTERNAL_PROTOCOL.test(raw)) return raw
  if (ANY_PROTOCOL.test(raw)) return ''

  const handle = raw.match(INSTAGRAM_HANDLE)
  if (handle) return `https://instagram.com/${handle[1]}`

  const instagramProfile = raw.match(INSTAGRAM_PROFILE)
  if (instagramProfile) return `https://instagram.com/${instagramProfile[1]}`

  if (DOMAIN_LIKE_URL.test(raw)) return `https://${raw}`

  return ''
}
