import { getAdCategoryId, getJobIntentId } from './constants.js'
import { normalizeSearchText } from './naturalSearch.js'
import { matchesCantonOrNationwide } from './locationScope.js'
import { isPublicationOpen } from './publicationLifecycle.js'

const CHILDCARE = ['cuidado infantil', 'cuidado de niños', 'niñera', 'niñeras', 'niñero', 'guardería', 'guarderías', 'kita', 'au pair', 'babysitter', 'canguro']
const MOVING = ['mudanza', 'mudanzas', 'transporte de muebles', 'limpieza final', 'limpieza de fin de alquiler', 'umzug', 'umzüge', 'déménagement', 'déménagements']
const rule = (category, terms=null) => ({category, terms})

// A step defines its own topic. A package about work must not put job offers
// inside the labor-law step, or eldercare ads inside the childcare step.
export function getRelatedAdContext(guide, resource) {
  const terms = guide?.relatedBusinessTerms || []
  const url = resource?.href ? new URL(resource.href, 'https://latido.ch') : null
  const category = url?.searchParams.get('cat')
  const guideId = guide?.id
  if (category === 'empleo' || url?.pathname === '/publicar-empleo' || ['d14','d15'].includes(guideId)) {
    return {rules:[rule('empleo'),rule('documentos',terms),rule('servicios',terms)], jobs:true, adsFirst:guideId !== 'd15', href:'/tablon?cat=empleo&jobIntent=ofrece'}
  }
  if (category === 'vivienda' || guideId === 'd9') {
    return {rules:[rule('vivienda'),rule('documentos',terms),rule('servicios',terms)], adsFirst:true, href:'/tablon?cat=vivienda&type=ofrece'}
  }
  if (category === 'cuidados' || ['d5','d19'].includes(guideId)) {
    return {rules:[rule('cuidados',CHILDCARE),rule('servicios',CHILDCARE)], adsFirst:true, href:'/tablon?cat=cuidados&type=ofrece'}
  }
  if ((category === 'servicios' && url.searchParams.get('q') === 'mudanza') || guideId === 'd16') {
    return {rules:[rule('servicios',MOVING)], adsFirst:true, href:'/tablon?cat=servicios&type=ofrece&q=mudanza'}
  }
  if (category === 'documentos') {
    return {rules:[rule('documentos',terms),rule('servicios',terms)], adsFirst:true, href:'/tablon?cat=documentos&type=ofrece'}
  }
  if (!terms.length) return null
  if (guideId === 'd17') {
    return {rules:[rule('cuidados',['matrona','matronas','postparto','maternidad','cuidado infantil','cuidado del bebé','hebamme']),rule('documentos',['registro del nacimiento','permiso de maternidad','prestaciones de maternidad'])], adsFirst:false, href:'/tablon?cat=cuidados&type=ofrece'}
  }
  const servicesFirst = ['d3','d4','d6','d11','d13'].includes(guideId)
  return {
    rules:[rule('documentos',terms),rule('servicios',terms)],
    adsFirst:false,
    href:servicesFirst ? `/tablon?cat=servicios&type=ofrece${guideId === 'd6' ? '&q=alem%C3%A1n' : ''}` : '/tablon?cat=documentos&type=ofrece',
  }
}

function matchesTerms(row, terms) {
  if (!terms) return true
  const fields = [row.title,row.desc,row.sub].filter(Boolean).map(value => ` ${normalizeSearchText(value)} `)
  return terms.some(term => {
    const normalized = normalizeSearchText(term)
    return normalized && fields.some(field => field.includes(` ${normalized} `))
  })
}

export function selectRelatedAds(context, listings=[], jobs=[], canton='', now=Date.now()) {
  if (!context) return []
  const rows = [
    ...listings.map(row => ({...row,resourceKind:'listing'})),
    ...(context.jobs ? jobs.map(row => ({...row,resourceKind:'job'})) : []),
  ]
  const seen = new Set()
  return rows.filter(row => {
    const key = `${row.resourceKind}:${row.id}`
    if (!row.id || !row.title?.trim() || seen.has(key) || !isPublicationOpen(row,now)) return false
    if (row.privacy && row.privacy !== 'public') return false
    if (row.profile_visibility && row.profile_visibility !== 'public') return false
    if (!matchesCantonOrNationwide(row,canton)) return false
    const category = row.resourceKind === 'job' ? 'empleo' : getAdCategoryId(row)
    if (category === 'empleo' ? getJobIntentId(row) !== 'ofrece' : row.type !== 'ofrece') return false
    if (!context.rules.some(rule => rule.category === category && matchesTerms(row,rule.terms))) return false
    seen.add(key)
    return true
  }).sort((a,b) => String(b.created_at || '').localeCompare(String(a.created_at || '')) || String(b.id).localeCompare(String(a.id)))
    .slice(0,12)
}

// Interleave both types without changing the order inside either list. Paid
// business tiers retain their priority; current ads also get visible space.
export function mergeRelatedResources(ads=[], businesses=[], adsFirst=false) {
  const result = []
  for (let i=0; i<Math.max(ads.length,businesses.length); i++) {
    const ad = ads[i] && {kind:'ad',row:ads[i]}
    const business = businesses[i] && {kind:'business',row:businesses[i]}
    for (const item of adsFirst ? [ad,business] : [business,ad]) if (item) result.push(item)
  }
  return result
}

export function getRelatedAdsExplorePath(context, canton='') {
  const url = new URL(context?.href || '/tablon', 'https://latido.ch')
  if (canton) url.searchParams.set('canton',canton)
  return url.pathname+url.search
}
