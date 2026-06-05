export const BUSINESS_VERIFICATION_STATUSES = {
  unverified: {
    label: 'No verificada',
    color: '#64748B',
    bg: '#F1F5F9',
  },
  pending: {
    label: 'Pendiente',
    color: '#92400E',
    bg: '#FEF3C7',
  },
  verified: {
    label: 'Verificada',
    color: '#065F46',
    bg: '#D1FAE5',
  },
  rejected: {
    label: 'Rechazado',
    color: '#B91C1C',
    bg: '#FEE2E2',
  },
}

const VALID_PHONE_PREFIXES = ['41', '34', '33', '39', '49', '43', '351', '44', '31', '32']
const BLOCKED_EMAILS = new Set(['test@test.com', 'test@example.com', 'demo@demo.com', 'fake@fake.com'])
const BLOCKED_DOMAINS = new Set(['example.com', 'test.com', 'localhost'])

function normalizeText(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

export function normalizePhone(value = '') {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (raw.startsWith('00')) return raw.slice(2).replace(/\D/g, '')
  return raw.replace(/\D/g, '')
}

export function isValidPhone(value = '') {
  const raw = String(value || '').trim()
  const digits = normalizePhone(raw)
  if (digits.length < 9 || digits.length > 15) return false
  if (!raw.startsWith('+') && !raw.startsWith('00')) return false
  return VALID_PHONE_PREFIXES.some(prefix => digits.startsWith(prefix))
}

export function isValidEmail(value = '') {
  const email = String(value || '').trim().toLowerCase()
  if (!email || BLOCKED_EMAILS.has(email)) return false
  const match = email.match(/^[^\s@]+@([^\s@]+\.[^\s@]{2,})$/)
  if (!match) return false
  const domain = match[1].replace(/^www\./, '')
  if (BLOCKED_DOMAINS.has(domain)) return false
  return !domain.includes('example') && !domain.includes('test')
}

export function normalizeWebsiteHost(value = '') {
  const raw = String(value || '').trim()
  if (!raw) return ''
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    return url.hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function isValidWebsite(value = '') {
  const raw = String(value || '').trim()
  if (!raw) return false
  const host = normalizeWebsiteHost(raw)
  if (!host || !host.includes('.')) return false
  if (BLOCKED_DOMAINS.has(host)) return false
  return !host.includes('example') && !host.includes('test')
}

function getBusinessField(business, ...keys) {
  for (const key of keys) {
    const value = business?.[key]
    if (Array.isArray(value)) {
      if (value.length) return value
    } else if (value != null && String(value).trim()) {
      return value
    }
  }
  return ''
}

export function isLikelyDuplicateBusiness(business, existingBusinesses = []) {
  const id = business?.id ? String(business.id) : ''
  const name = normalizeText(getBusinessField(business, 'name'))
  const city = normalizeText(getBusinessField(business, 'city', 'canton'))
  const phone = normalizePhone(getBusinessField(business, 'phone', 'whatsapp'))
  const email = String(getBusinessField(business, 'email') || '').trim().toLowerCase()
  const websiteHost = normalizeWebsiteHost(getBusinessField(business, 'website'))

  return existingBusinesses.some(existing => {
    if (!existing) return false
    if (id && String(existing.id) === id) return false

    const existingName = normalizeText(getBusinessField(existing, 'name'))
    const existingCity = normalizeText(getBusinessField(existing, 'city', 'canton'))
    const existingPhone = normalizePhone(getBusinessField(existing, 'phone', 'whatsapp'))
    const existingEmail = String(getBusinessField(existing, 'email') || '').trim().toLowerCase()
    const existingWebsiteHost = normalizeWebsiteHost(getBusinessField(existing, 'website'))

    if (phone && existingPhone && phone === existingPhone) return true
    if (email && existingEmail && email === existingEmail) return true
    if (websiteHost && existingWebsiteHost && websiteHost === existingWebsiteHost) return true
    return !!name && !!existingName && name === existingName && !!city && city === existingCity
  })
}

export function calculateBusinessVerification(business, { existingBusinesses = [] } = {}) {
  const name = String(getBusinessField(business, 'name') || '').trim()
  const category = String(getBusinessField(business, 'category', 'type') || '').trim()
  const city = String(getBusinessField(business, 'city') || '').trim()
  const canton = String(getBusinessField(business, 'canton') || '').trim()
  const phone = String(getBusinessField(business, 'phone', 'whatsapp') || '').trim()
  const email = String(getBusinessField(business, 'email') || '').trim()
  const website = String(getBusinessField(business, 'website') || '').trim()
  const description = String(getBusinessField(business, 'description', 'desc') || '').trim()
  const gallery = getBusinessField(business, 'gallery', 'photos')
  const hasImage = !!String(getBusinessField(business, 'photo_url', 'logo_url') || '').trim()
    || (Array.isArray(gallery) && gallery.length > 0)

  const hasValidPhone = isValidPhone(phone)
  const hasValidEmail = isValidEmail(email)
  const hasValidWeb = isValidWebsite(website)
  const duplicate = isLikelyDuplicateBusiness(business, existingBusinesses)
  const hasValidContact = hasValidPhone || hasValidEmail || hasValidWeb

  const criteria = [
    { id: 'name', label: 'Nombre completo', points: 10, passed: name.length >= 3 },
    { id: 'category', label: 'Categoria', points: 10, passed: !!category },
    { id: 'location', label: 'Ciudad o canton', points: 10, passed: !!(city || canton) },
    { id: 'phone', label: 'Telefono o WhatsApp valido', points: 15, passed: hasValidPhone },
    { id: 'email_or_web', label: 'Email valido o web', points: 15, passed: hasValidEmail || hasValidWeb },
    { id: 'description', label: 'Descripcion de mas de 80 caracteres', points: 10, passed: description.length > 80 },
    { id: 'image', label: 'Imagen o logo', points: 10, passed: hasImage },
    { id: 'duplicate', label: 'No parece duplicado', points: 20, passed: !duplicate },
  ]

  const score = criteria.reduce((sum, item) => sum + (item.passed ? item.points : 0), 0)
  const status = score >= 80 && hasValidContact ? 'pending' : 'unverified'

  return {
    score,
    status,
    hasValidContact,
    duplicate,
    criteria,
  }
}

export function getBusinessVerificationStatus(business) {
  if (business?.verification_status && BUSINESS_VERIFICATION_STATUSES[business.verification_status]) {
    return business.verification_status
  }
  return business?.verified ? 'verified' : 'unverified'
}
