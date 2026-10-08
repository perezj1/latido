import { normalizeSearchText } from './naturalSearch.js'
import { rankDirectoryBusinesses } from './businessDirectoryRanking.js'

export function isBusinessRelatedToGuide(business, guide) {
  if (!business?.id || business.active === false) return false
  if (['empleo', 'vivienda'].includes(business.category || business.type)) return false
  const services = Array.isArray(business.services) ? business.services : [business.services]
  const fields = [business.name, business.description || business.desc, ...services]
    .filter(Boolean).map(value => ` ${normalizeSearchText(value)} `)
  return (guide?.relatedBusinessTerms || []).some(term => {
    const phrase = ` ${normalizeSearchText(term)} `
    return fields.some(field => field.includes(phrase))
  })
}

// Filter by topic before applying exactly the directory's priority and rotation.
export function getGuideBusinesses(guide, businesses = [], recommendations = {}, now = Date.now()) {
  return rankDirectoryBusinesses(
    businesses.filter(business => isBusinessRelatedToGuide(business, guide)),
    recommendations,
    now,
  ).slice(0, 12)
}
