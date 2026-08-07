import { normalizeExternalUrl } from './links.js'
import { getNavigationUrl, getPhoneDigits } from './businessContact.js'

export const MAX_PARTNER_CONTACT_OPTIONS = 12

export const BUSINESS_PARTNER_CONTACT_TYPES = [
  { id:'address', label:'Dirección', placeholder:'Bahnhofstrasse 10, 8001 Zürich' },
  { id:'phone', label:'Teléfono', placeholder:'+41 44 000 00 00' },
  { id:'whatsapp', label:'WhatsApp', placeholder:'+41 79 000 00 00' },
  { id:'email', label:'Email', placeholder:'zurich@empresa.ch' },
  { id:'website', label:'Web', placeholder:'https://empresa.ch/zurich' },
  { id:'instagram', label:'Instagram', placeholder:'@empresa_zurich' },
  { id:'tiktok', label:'TikTok', placeholder:'@empresa_zurich' },
]

const CONTACT_TYPE_IDS = new Set(BUSINESS_PARTNER_CONTACT_TYPES.map(type => type.id))

function cleanText(value = '') {
  return String(value || '').trim()
}

export function normalizePartnerContactOptions(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((option, index) => ({
      id:cleanText(option?.id) || `contact-${index + 1}`,
      type:CONTACT_TYPE_IDS.has(option?.type) ? option.type : 'address',
      label:cleanText(option?.label),
      value:cleanText(option?.value),
    }))
    .filter(option => option.value)
    .slice(0, MAX_PARTNER_CONTACT_OPTIONS)
}

export function getPartnerContactType(type = '') {
  return BUSINESS_PARTNER_CONTACT_TYPES.find(option => option.id === type)
    || BUSINESS_PARTNER_CONTACT_TYPES[0]
}

function getSocialUrl(value = '', platform = '') {
  const text = cleanText(value)
  if (!text) return ''
  const externalUrl = normalizeExternalUrl(text)
  if (externalUrl) return externalUrl
  const handle = text.replace(/^@/, '')
  return platform === 'tiktok'
    ? `https://tiktok.com/@${handle}`
    : `https://instagram.com/${handle}`
}

export function getPartnerContactOptionHref(option = {}) {
  const value = cleanText(option.value)
  if (!value) return ''

  if (option.type === 'address') return getNavigationUrl(value, option.label)
  if (option.type === 'phone') {
    const digits = getPhoneDigits(value)
    return digits ? `tel:+${digits}` : ''
  }
  if (option.type === 'whatsapp') {
    const digits = getPhoneDigits(value)
    return digits ? `https://wa.me/${digits}` : ''
  }
  if (option.type === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? `mailto:${value}` : ''
  if (option.type === 'website') return normalizeExternalUrl(value)
  if (option.type === 'instagram' || option.type === 'tiktok') {
    return getSocialUrl(value, option.type)
  }
  return ''
}

export function isPartnerContactExternal(type = '') {
  return ['address', 'whatsapp', 'website', 'instagram', 'tiktok'].includes(type)
}
