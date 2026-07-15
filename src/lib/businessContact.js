export function getPhoneDigits(value = '') {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('00')) return digits.slice(2)
  if (digits.startsWith('0')) return `41${digits.slice(1)}`
  return digits
}

export function getPhoneHref(value = '') {
  const digits = getPhoneDigits(value)
  return digits ? `tel:+${digits}` : ''
}

export function getWhatsappHref(value = '') {
  const digits = getPhoneDigits(value)
  return digits ? `https://wa.me/${digits}` : ''
}

export function isLikelySwissMobilePhone(value = '') {
  const digits = getPhoneDigits(value)
  return /^417[5-9]\d{7}$/.test(digits)
}

export function canUseWhatsappNumber(value = '') {
  const digits = getPhoneDigits(value)
  if (!digits) return false
  if (digits.startsWith('41')) return isLikelySwissMobilePhone(value)
  return true
}

export function getBusinessPhone(provider = {}) {
  return String(provider.phone || provider.whatsapp || '').trim()
}

export function getBusinessWhatsapp(provider = {}) {
  const whatsapp = String(provider.whatsapp || '').trim()
  return canUseWhatsappNumber(whatsapp) ? whatsapp : ''
}

export function extractBusinessAddress(description = '') {
  const text = String(description || '')
  const match = text.match(/Direcci[oó]n(?:\s+profesional)?\s*:\s*(.+?)(?=\.\s*(?:Web|Sitio|Tel[eé]fono|Email)\b|$)/i)
  return match?.[1]?.trim() || ''
}

export function getBusinessAddress(provider = {}) {
  return String(provider.address || extractBusinessAddress(provider.description) || '').trim()
}

export function getNavigationUrl(address = '', city = '', canton = '') {
  const destination = [address, city, canton, 'Suiza']
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .join(', ')

  return destination
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`
    : ''
}
