import { supabase } from './supabase'
import { normalizeExternalUrl } from './links'
import { getBusinessLandingPath } from './seo'
import { getBusinessPhone, getBusinessWhatsapp, getNavigationUrl, getPhoneDigits } from './businessContact'

const ACTIVE_PARTNER_PLANS = new Set(['basic', 'premium'])
const PLAN_ORDER = { premium:0, basic:1 }

export function getBusinessPartnerAnalyticsId(providerId) {
  return `business:${providerId}`
}

export function getBusinessPartnerAccent(planKey = 'basic') {
  return planKey === 'premium'
    ? ['#2563EB', '#1D4ED8']
    : ['#2563EB', '#00BCD4']
}

function cleanText(value = '', fallback = '') {
  const text = String(value || '').trim()
  return text || fallback
}

function toTimestamp(value) {
  if (!value) return null
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

export function hasActiveBusinessLanding(provider = {}, now = Date.now()) {
  if (provider.partner_landing_enabled !== true) return false
  const startsAt = toTimestamp(provider.partner_landing_starts_at)
  const endsAt = toTimestamp(provider.partner_landing_ends_at)
  if (startsAt && startsAt > now) return false
  if (endsAt && endsAt <= now) return false
  return true
}

function getWhatsappUrl(value = '') {
  const digits = getPhoneDigits(value)
  if (!digits) return ''

  return `https://wa.me/${digits}`
}

function getPhoneDisplay(value = '') {
  const digits = getPhoneDigits(value)
  if (!digits) return ''
  if (digits.startsWith('41') && digits.length >= 11) {
    return `+41 ${digits.slice(2, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9, 11)}`.trim()
  }
  return String(value || `+${digits}`).trim()
}

function getUrlDisplay(value = '') {
  try {
    const url = new URL(normalizeExternalUrl(value) || value)
    return `${url.hostname.replace(/^www\./, '')}${url.pathname === '/' ? '' : url.pathname}`.replace(/\/$/, '')
  } catch {
    return String(value || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '')
  }
}

function getInstagramAction(value = '') {
  const text = String(value || '').trim()
  if (!text) return null

  const href = normalizeExternalUrl(text)
    || `https://instagram.com/${text.replace(/^@/, '')}`
  const valueLabel = text.startsWith('http')
    ? getUrlDisplay(text)
    : text.startsWith('@') ? text : `@${text}`

  return {
    id:'instagram',
    type:'instagram',
    icon:'IG',
    label:'Instagram',
    value:valueLabel,
    href,
    external:true,
  }
}

function getBusinessPartnerContactActions(provider = {}) {
  const actions = []
  const phone = getBusinessPhone(provider)
  const whatsapp = getBusinessWhatsapp(provider)
  const phoneDigits = getPhoneDigits(phone)
  const whatsappDigits = getPhoneDigits(whatsapp)
  const phoneDisplay = getPhoneDisplay(phone)
  const email = String(provider.email || '').trim()
  const websiteUrl = normalizeExternalUrl(provider.website)
  const customUrl = normalizeExternalUrl(provider.partner_cta_url)
  const webUrl = websiteUrl || (
    customUrl && !customUrl.includes('wa.me') && !customUrl.startsWith('mailto:')
      ? customUrl
      : ''
  )

  if (whatsappDigits) {
    actions.push({
      id:'whatsapp',
      type:'whatsapp',
      icon:'WA',
      label:'WhatsApp',
      value:getPhoneDisplay(whatsapp),
      href:`https://wa.me/${whatsappDigits}`,
      external:true,
    })
  }
  if (phoneDigits) {
    actions.push({
      id:'phone',
      type:'phone',
      icon:'Tel',
      label:'Llamadas',
      value:phoneDisplay,
      href:`tel:+${phoneDigits}`,
      external:false,
    })
  }

  if (provider.address) {
    actions.push({
      id:'address',
      type:'address',
      icon:'Map',
      label:'Dirección',
      value:provider.address,
      href:getNavigationUrl(provider.address, provider.city, provider.canton),
      external:true,
    })
  }

  if (email) {
    actions.push({
      id:'email',
      type:'email',
      icon:'@',
      label:'Email',
      value:email,
      href:`mailto:${email}`,
      external:false,
    })
  }

  if (webUrl) {
    actions.push({
      id:'website',
      type:'website',
      icon:'Web',
      label:'Web',
      value:getUrlDisplay(webUrl),
      href:webUrl,
      external:true,
    })
  }

  const instagramAction = getInstagramAction(provider.instagram)
  if (instagramAction) actions.push(instagramAction)

  return actions
}

export function getBusinessPartnerDestination(provider = {}) {
  if (hasActiveBusinessLanding(provider)) {
    return {
      href:getBusinessLandingPath(provider),
      label:cleanText(provider.partner_cta_label, 'Ver landing en Latido'),
      external:false,
    }
  }

  const customUrl = normalizeExternalUrl(provider.partner_cta_url)
  const websiteUrl = normalizeExternalUrl(provider.website)
  const whatsappUrl = getWhatsappUrl(provider.whatsapp)
  const email = String(provider.email || '').trim()

  if (customUrl) {
    return {
      href:customUrl,
      label:cleanText(provider.partner_cta_label, 'Contactar'),
      external:true,
    }
  }

  if (websiteUrl) {
    return {
      href:websiteUrl,
      label:cleanText(provider.partner_cta_label, 'Ver web'),
      external:true,
    }
  }

  if (whatsappUrl) {
    return {
      href:whatsappUrl,
      label:cleanText(provider.partner_cta_label, 'WhatsApp'),
      external:true,
    }
  }

  if (email) {
    return {
      href:`mailto:${email}`,
      label:cleanText(provider.partner_cta_label, 'Escribir'),
      external:true,
    }
  }

  return {
    href:`/negocios/${provider.id}`,
    label:cleanText(provider.partner_cta_label, 'Ver negocio'),
    external:false,
  }
}

export function normalizeBusinessPartner(provider = {}) {
  const services = Array.isArray(provider.services)
    ? provider.services.map(service => String(service || '').trim()).filter(Boolean)
    : []
  const planKey = ACTIVE_PARTNER_PLANS.has(provider.promotion_plan)
    ? provider.promotion_plan
    : 'basic'
  const destination = getBusinessPartnerDestination(provider)

  return {
    id:provider.id,
    analyticsId:getBusinessPartnerAnalyticsId(provider.id),
    planKey,
    name:cleanText(provider.name, 'Colaborador'),
    logoUrl:cleanText(provider.partner_logo_url, cleanText(provider.photo_url, '/favicon.svg')),
    title:cleanText(provider.partner_card_title, cleanText(provider.name, 'Colaborador de Latido')),
    description:cleanText(
      provider.partner_card_description,
      cleanText(provider.description, 'Servicio recomendado para la comunidad hispanohablante en Suiza.'),
    ),
    services:services.slice(0, 3),
    destination,
    contactActions:getBusinessPartnerContactActions(provider),
    accent:getBusinessPartnerAccent(planKey),
    city:provider.city || provider.canton || '',
    landingUrl:hasActiveBusinessLanding(provider) ? getBusinessLandingPath(provider) : '',
  }
}

export async function fetchActiveBusinessPartners({
  plans = ['basic', 'premium'],
  limit = 8,
} = {}) {
  const allowedPlans = plans.filter(plan => ACTIVE_PARTNER_PLANS.has(plan))
  if (!allowedPlans.length) return []

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('providers')
    .select(`
      id,
      name,
      category,
      city,
      canton,
      description,
      services,
      website,
      address,
      phone,
      whatsapp,
      instagram,
      email,
      photo_url,
      promotion_plan,
      promotion_starts_at,
      promotion_ends_at,
      partner_logo_url,
      partner_card_title,
      partner_card_description,
      partner_cta_label,
      partner_cta_url,
      partner_landing_enabled,
      partner_landing_starts_at,
      partner_landing_ends_at,
      partner_published
    `)
    .eq('active', true)
    .eq('partner_published', true)
    .in('promotion_plan', allowedPlans)
    .lte('promotion_starts_at', now)
    .gt('promotion_ends_at', now)
    .order('promotion_plan', { ascending:false })
    .order('name', { ascending:true })
    .limit(limit)

  if (error) {
    console.warn('Could not load business partners:', error.message)
    return []
  }

  return (data || [])
    .map(normalizeBusinessPartner)
    .sort((a, b) => {
      const planDiff = (PLAN_ORDER[a.planKey] ?? 9) - (PLAN_ORDER[b.planKey] ?? 9)
      if (planDiff !== 0) return planDiff
      return a.name.localeCompare(b.name, 'es')
    })
}
