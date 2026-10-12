import { normalizeSearchText } from './naturalSearch.js'
import { rankDirectoryBusinesses } from './businessDirectoryRanking.js'
import { PUNTO_HISPANO_PROVIDER_ID } from './puntoHispano.js'
import { PUNTO_HISPANO_SERVICES } from './puntoHispanoServices.js'

export function getBusinessGuideMatches(business, guide) {
  if (!business?.id || business.active === false) return []
  const category = business.category || business.type
  // Employment offices and housing portals are useful in their own journeys.
  // They still must match the topic; their category alone is not a recommendation.
  if (['empleo', 'vivienda'].includes(category)
    && !(guide?.relatedBusinessCategories || []).includes(category)) return []
  const services = Array.isArray(business.services) ? business.services : [business.services]
  // Use the existing published service catalogue too; the directory row only
  // stores a short selection of services for this provider. This adds relevance,
  // never a promotion or a synthetic business when the provider is absent.
  const catalogServices = business.id === PUNTO_HISPANO_PROVIDER_ID
    ? PUNTO_HISPANO_SERVICES.flatMap(group => group.services.map(service => service.label))
    : []
  const fields = [business.name, business.description, business.desc,
    business.partner_card_title, business.partner_card_description,
    ...catalogServices,
    ...services.map(service => typeof service === 'string' ? service : service?.label || service?.name)]
    .filter(Boolean).map(value => ` ${normalizeSearchText(value)} `)
  return (guide?.relatedBusinessTerms || []).filter(term => {
    const phrase = ` ${normalizeSearchText(term)} `
    return fields.some(field => field.includes(phrase))
  })
}

export function isBusinessRelatedToGuide(business, guide) {
  return getBusinessGuideMatches(business, guide).length > 0
}

// Filter by topic before applying exactly the directory's priority and rotation.
export function getGuideBusinesses(guide, businesses = [], recommendations = {}, now = Date.now()) {
  return rankDirectoryBusinesses(
    businesses.filter(business => isBusinessRelatedToGuide(business, guide)),
    recommendations,
    now,
  ).slice(0, 12)
}
