import assert from 'node:assert/strict'
import { MOCK_DOCS } from '../src/lib/constants.js'
import { GUIDE_REVIEW_DATE } from '../src/lib/guides.js'
import { getGuideById, getGuideBySlug, getGuidePath, getBusinessPath, getSeoForLocation, getPublicSeoPages, SEARCHABLE_SITE_PAGES } from '../src/lib/seo.js'
import { RESOURCE_PACKAGES, getResourcePackage, getResourcePackagePath, getPackageResourcePath } from '../src/lib/resourcePackages.js'
import { getGuideBusinesses, getBusinessGuideMatches, isBusinessRelatedToGuide } from '../src/lib/guideBusinesses.js'
import { EDITORIAL_PREMIUM_PARTNERS, getEditorialDirectoryPartner, getEditorialPremiumPartner } from '../src/lib/editorialBusinessPartners.js'
import { BUSINESS_ROTATION_INTERVAL_MS } from '../src/lib/businessPromotion.js'
import { JOBLI_PROVIDER_ID } from '../src/lib/businessPartnerOverrides.js'
import { PUNTO_HISPANO_PROVIDER_ID } from '../src/lib/puntoHispano.js'
import { compareDirectoryBusinesses, getDirectoryBusinessPlan, rankDirectoryBusinesses } from '../src/lib/businessDirectoryRanking.js'
import { getPackageSteps } from '../src/lib/packageSteps.js'

const guide = id => MOCK_DOCS.find(item => item.id === id)
assert.equal(MOCK_DOCS.length, 19)
assert.equal(new Set(MOCK_DOCS.map(item => item.id)).size, 19)
const newGuideIds = ['d15', 'd16', 'd17', 'd18', 'd19']
for (const item of MOCK_DOCS) {
  assert.equal(item.reviewedAt, newGuideIds.includes(item.id) ? '2026-10-08' : GUIDE_REVIEW_DATE)
  assert.ok(item.sections.length >= 4, item.id)
  assert.ok(item.sources.length >= 2, item.id)
  assert.ok(item.relatedBusinessTerms.length, item.id)
  assert.ok(item.content.includes(item.sections[0].heading), item.id)
  assert.equal(getGuideBySlug(getGuidePath(item).split('/').at(-1))?.id, item.id)
  assert.equal(getGuideBySlug(`${item.id}-old-title`)?.id, item.id)
  for (const source of item.sources) assert.equal(new URL(source.url).protocol, 'https:')
}
assert.match(guide('d13').content, /12 meses/)
assert.match(guide('d8').content, /1\.260.*2\.520/)
assert.match(guide('d8').content, /7\.258/)
assert.match(guide('d8').content, /diciembre de 2026/)
assert.match(guide('d2').content, /31 de marzo de 2027/)
assert.match(guide('d7').content, /menores de 21 años/)
assert.match(guide('d15').content, /12 meses.*dos años/)
assert.match(guide('d16').content, /14 días/)
assert.match(guide('d17').content, /14 semanas.*98 días/)
assert.match(guide('d17').content, /CHF 220/)
assert.match(guide('d17').content, /16 semanas/)
assert.match(guide('d18').content, /parte obligatoria normalmente no se paga/)
assert.match(guide('d19').content, /cantones.*gratuita/)

const expectedPackages = ['acabo-de-llegar','busco-trabajo','planes-y-comunidad','busco-piso','llego-con-ninos','sin-trabajo','me-mudo','viene-un-bebe','vuelvo-a-mi-pais']
assert.deepEqual(RESOURCE_PACKAGES.map(item => item.slug), expectedPackages)
assert.deepEqual(RESOURCE_PACKAGES.filter(item => item.featured).map(item => item.slug), expectedPackages.slice(0, 3))
const seoPages = getPublicSeoPages()
assert.equal(getSeoForLocation({pathname:'/paquetes'}).path, '/paquetes')
assert.ok(seoPages.some(page => page.path === '/paquetes'))
assert.ok(SEARCHABLE_SITE_PAGES.some(page => page.href === '/paquetes'))
const linkedGuides = new Set()
for (const item of RESOURCE_PACKAGES) {
  assert.equal(getResourcePackage(item.slug), item)
  assert.equal(getSeoForLocation({pathname:getResourcePackagePath(item)}).path, getResourcePackagePath(item))
  assert.ok(seoPages.some(page => page.path === getResourcePackagePath(item)))
  assert.ok(SEARCHABLE_SITE_PAGES.some(page => page.href === getResourcePackagePath(item)))
  assert.ok(item.resources.length >= 4)
  assert.equal(new Set(item.resources.map(resource => resource.id)).size, item.resources.length)
  for (const resource of item.resources) {
    const original = new URL(resource.href, 'https://latido.ch')
    const local = new URL(getPackageResourcePath(resource, 'ZH'), 'https://latido.ch')
    assert.equal(local.origin, 'https://latido.ch')
    assert.equal(local.pathname, original.pathname)
    for (const [key, value] of original.searchParams) assert.equal(local.searchParams.get(key), value)
    assert.equal(local.searchParams.get('canton'), resource.local ? 'ZH' : null)
    assert.equal(getPackageResourcePath(resource, 'invalid'), resource.href)
    const guideId = original.searchParams.get('openGuide')
    if (guideId) { assert.ok(getGuideById(guideId), resource.href); linkedGuides.add(guideId) }
  }
}
for (const id of newGuideIds) assert.ok(linkedGuides.has(id), `${id} must be reachable from a package`)
assert.equal(new URL(getResourcePackage('sin-trabajo').resources.find(resource => resource.id === 'ofertas').href, 'https://latido.ch').searchParams.get('jobIntent'), 'ofrece')
assert.equal(getResourcePackage('unknown'), null)

const now = Date.parse('2026-10-07T12:00:00Z')
const business = (id, plan = 'free', overrides = {}) => ({
  id, name:`Asesoría ${id}`, category:'asesoria_tramites', active:true,
  services:['Declaración fiscal'], promotion_plan:plan,
  promotion_starts_at:'2026-09-01T00:00:00Z', promotion_ends_at:'2026-11-01T00:00:00Z',
  ...overrides,
})
assert.ok(isBusinessRelatedToGuide(business('tax'), guide('d2')))
assert.ok(isBusinessRelatedToGuide(business('tax', 'free', {services:['DECLARACION FISCAL']}), guide('d2')))
assert.ok(!isBusinessRelatedToGuide(business('not-tax', 'exclusive', {services:['Manicura']}), guide('d2')))
assert.ok(!isBusinessRelatedToGuide(business('inactive', 'exclusive', {active:false}), guide('d2')))
assert.ok(!isBusinessRelatedToGuide(business('job', 'exclusive', {category:'empleo'}), guide('d2')))
assert.ok(!isBusinessRelatedToGuide(business('word-boundary', 'free', {services:['Banco de impuestosos']}), guide('d2')))
assert.ok(isBusinessRelatedToGuide(business('language', 'free', {services:['Clases de alemán']}), guide('d6')))
assert.ok(!isBusinessRelatedToGuide(business('language', 'premium', {services:['Clases de alemán']}), guide('d12')))
assert.ok(isBusinessRelatedToGuide(business('driving', 'free', {services:['Canje de carnet']}), guide('d13')))
assert.ok(!isBusinessRelatedToGuide(business('driving', 'free', {services:['Canje de carnet']}), guide('d1')))
assert.ok(isBusinessRelatedToGuide(business('immigration', 'free', {services:['Permiso de residencia']}), guide('d1')))
assert.ok(isBusinessRelatedToGuide(business('labor', 'premium', {services:['Asesoría laboral']}), guide('d15')))
assert.ok(isBusinessRelatedToGuide(business('moving', 'free', {services:['Mudanzas']}), guide('d16')))
assert.ok(isBusinessRelatedToGuide(business('baby', 'free', {services:['Matrona']}), guide('d17')))
assert.ok(isBusinessRelatedToGuide(business('return', 'free', {services:['Segundo pilar']}), guide('d18')))
assert.ok(isBusinessRelatedToGuide(business('family', 'free', {services:['Cuidado infantil']}), guide('d19')))

// Public employment offices, providers with description-only services and unions
// must remain eligible without admitting unrelated high-priority businesses.
const rav = business('rav', 'free', {name:'RAV (Oficina de empleo)', category:'empleo', services:null, description:'Servicio público suizo de empleo.'})
const ayuda = business('ayuda', 'free', {name:'Tu Ayuda en Suiza', services:null, description:'Gestiones relacionadas con RAV y desempleo.'})
const syna = business('syna', 'free', {name:'SYNA', category:'otro', services:null, description:'Sindicato para trabajadores.'})
const legal = business('legal', 'free', {services:['Derecho y asesoría legal']})
assert.ok(isBusinessRelatedToGuide(rav, guide('d15')))
assert.ok(isBusinessRelatedToGuide(ayuda, guide('d15')))
assert.ok(isBusinessRelatedToGuide(syna, guide('d15')))
assert.ok(isBusinessRelatedToGuide(syna, guide('d10')))
assert.ok(isBusinessRelatedToGuide(legal, guide('d10')))
assert.ok(!isBusinessRelatedToGuide(rav, guide('d2')))
assert.ok(isBusinessRelatedToGuide(business('ett', 'free', {category:'empleo', services:null, description:'Agencia de colocación de personal y trabajo temporal.'}), guide('d14')))
assert.ok(isBusinessRelatedToGuide(business('housing', 'free', {category:'vivienda', services:null, description:'Portal inmobiliario con alquiler de pisos.'}), guide('d9')))
assert.ok(isBusinessRelatedToGuide(business('partner-description', 'premium', {services:null, partner_card_description:'Asesoría laboral en español'}), guide('d10')))
assert.ok(isBusinessRelatedToGuide(business('string-services', 'free', {services:'Asesoría laboral'}), guide('d10')))
assert.ok(isBusinessRelatedToGuide(business('structured-services', 'free', {services:[{name:'Asesoría laboral'}]}), guide('d10')))
assert.ok(isBusinessRelatedToGuide(business('both-descriptions', 'free', {services:null, description:'Atención en español', desc:'Trámites RAV'}), guide('d15')))
assert.ok(!isBusinessRelatedToGuide(business('hairdresser', 'premium', {category:'belleza', services:['Corte de cabello'], description:'Atención en alemán y español'}), guide('d6')))
assert.ok(!isBusinessRelatedToGuide(business('dance', 'premium', {category:'otro', services:['Alquiler de estudio'], description:'Las clases de baile pueden ser en alemán.'}), guide('d16')))
assert.ok(!isBusinessRelatedToGuide(business('car-rental', 'premium', {category:'vehiculos', services:['Alquiler de coches']}), guide('d9')))
assert.ok(!isBusinessRelatedToGuide(business('car-insurance', 'premium', {services:['Seguros de coche']}), guide('d3')))
assert.ok(!isBusinessRelatedToGuide(business('criminal-only', 'premium', {name:'Abogado penalista', services:['Derecho penal', 'Defensa de oficio']}), guide('d10')))
const catalogProvider = business(PUNTO_HISPANO_PROVIDER_ID, 'premium', {services:['Gestoría']})
for (const id of ['d1', 'd2', 'd3', 'd4', 'd10', 'd12', 'd15', 'd16', 'd17']) {
  assert.ok(isBusinessRelatedToGuide(catalogProvider, guide(id)), `${id} should read the published service catalogue`)
}
assert.ok(!isBusinessRelatedToGuide(business('another-provider', 'premium', {services:['Gestoría']}), guide('d3')))
assert.ok(!isBusinessRelatedToGuide({...catalogProvider, active:false}, guide('d3')))

for (const resourcePackage of RESOURCE_PACKAGES) {
  for (const step of getPackageSteps(resourcePackage)) {
    if (step.guide) assert.equal(step.businessContext, step.guide)
    if (step.businessContext) assert.ok(step.businessContext.relatedBusinessTerms.length)
  }
}
const unemployedSteps = getPackageSteps(getResourcePackage('sin-trabajo'))
assert.ok(isBusinessRelatedToGuide(rav, unemployedSteps.find(step => step.id === 'guia').businessContext))
assert.ok(isBusinessRelatedToGuide(syna, unemployedSteps.find(step => step.id === 'derechos').businessContext))
assert.ok(isBusinessRelatedToGuide(rav, unemployedSteps.find(step => step.id === 'ofertas').businessContext))
assert.ok(isBusinessRelatedToGuide(ayuda, unemployedSteps.find(step => step.id === 'tramites').businessContext))
assert.ok(isBusinessRelatedToGuide(rav, unemployedSteps.find(step => step.id === 'tramites').businessContext))
const childcare = getPackageSteps(getResourcePackage('llego-con-ninos')).find(step => step.id === 'cuidados').businessContext
assert.ok(isBusinessRelatedToGuide(business('childcare', 'free', {services:['Cuidado de niños']}), childcare))
assert.ok(!isBusinessRelatedToGuide(business('insurance', 'premium', {services:['Seguro de salud']}), childcare))
assert.equal(getPackageSteps(getResourcePackage('me-mudo')).find(step => step.id === 'muebles').businessContext, null)

const rows = [
  business('free'), business('featured','featured'), business('basic','basic'),
  business('premium','premium'), business('exclusive','exclusive'),
  business('expired','exclusive',{promotion_ends_at:'2026-10-06T00:00:00Z'}),
  business('future','exclusive',{promotion_starts_at:'2026-10-08T00:00:00Z'}),
  business('unrelated','exclusive',{services:['Manicura']}),
]
const ordered = getGuideBusinesses(guide('d2'), rows, [], now)
assert.deepEqual(ordered.slice(0,4).map(row => row.id), ['exclusive','premium','basic','featured'])
assert.ok(!ordered.some(row => row.id === 'unrelated'))
assert.equal(getDirectoryBusinessPlan(ordered.find(row => row.id === 'expired'), now), 'free')
assert.equal(getDirectoryBusinessPlan(ordered.find(row => row.id === 'future'), now), 'free')
assert.deepEqual(ordered, getGuideBusinesses(guide('d2'), [...rows].reverse(), [], now))
assert.deepEqual(ordered, rankDirectoryBusinesses(rows.filter(row => isBusinessRelatedToGuide(row, guide('d2'))), {}, now).slice(0, 12))
const highlighted = business('highlighted', 'free', {featured:true})
assert.equal(getDirectoryBusinessPlan(highlighted, now), 'featured')
assert.equal(getGuideBusinesses(guide('d2'), [business('free'), highlighted], {}, now)[0].id, 'highlighted')
assert.equal(getDirectoryBusinessPlan(business('legacy', 'free', {promotion_plan:undefined, featured:true}), now), 'featured')
assert.ok(compareDirectoryBusinesses(business('most-recommended'), business('few-recommendations'), {'most-recommended':20, 'few-recommendations':1}, now) < 0)
const partnerOrder = getGuideBusinesses(guide('d2'), [business(JOBLI_PROVIDER_ID,'premium'), business('basic','basic'), business('premium','premium')], {}, now).map(row => row.id)
assert.equal(partnerOrder.at(-1), 'basic')
assert.ok(partnerOrder.slice(0,2).includes(JOBLI_PROVIDER_ID))
assert.ok(partnerOrder.slice(0,2).includes('premium'))

const equals = Array.from({length:20}, (_, i) => business(`same-${i}`, 'premium'))
const rotations = new Set(Array.from({length:8}, (_, i) => getGuideBusinesses(guide('d2'), equals, [], now + i * BUSINESS_ROTATION_INTERVAL_MS).map(row=>row.id).join(',')))
assert.ok(rotations.size > 1, 'Equal-priority businesses must rotate across buckets')
assert.equal(getGuideBusinesses(guide('d2'), equals, {}, now).length, 12)
const firstPositions = new Set(equals.map((_, i) => getGuideBusinesses(guide('d2'), equals, {}, now + i * BUSINESS_ROTATION_INTERVAL_MS)[0].id))
assert.equal(firstPositions.size, equals.length, 'Each business in the same tier gets equal access to first position')
const manyFree = Array.from({length:25}, (_, i) => business('free-' + i))
assert.equal(getGuideBusinesses(guide('d2'), [...manyFree, highlighted], {}, now)[0].id, 'highlighted')
assert.match(getBusinessPath(ordered[0]), /^\/negocios\/exclusive--/)
assert.deepEqual(getGuideBusinesses(guide('d2'), [], [], now), [])
console.log('19 guides and 9 packages: sources, review dates, linked guides, local filters, catalogue/search/SEO routes, relevance, directory priority and rotation passed')

const editorial = id => EDITORIAL_PREMIUM_PARTNERS.find(partner => partner.id === id)
const virtus = {id:editorial('virtus360').providerId,name:'360 Virtus GmbH',category:'asesoria_tramites',active:true,promotion_plan:'free',featured:false,description:'Gestoría y trámites y papeleo para particulares'}
const bellini = {id:editorial('bellini').providerId,name:'Bellini Personal AG',category:'otro',active:true,promotion_plan:'featured',promotion_starts_at:'2020-01-01',promotion_ends_at:'2100-01-01',description:'Trabajo temporal en construcción'}
const arrivalPaperwork = getPackageSteps(getResourcePackage('acabo-de-llegar')).find(step => step.id === 'tramites').businessContext
assert.equal(getDirectoryBusinessPlan(virtus,now), 'premium')
assert.equal(getDirectoryBusinessPlan(bellini,now), 'premium')
assert.equal(getEditorialPremiumPartner({id:editorial('syna').providerId,name:'SYNA Luzern'}).id, 'syna', 'Search and directory recognise the existing SYNA row')
assert.equal(getEditorialDirectoryPartner({...virtus,id:'unverified-copy'}),null, 'A copied name must not grant directory Premium placement')
assert.equal(getDirectoryBusinessPlan({...virtus,id:'unverified-copy'},now),'free')
assert.equal(getEditorialDirectoryPartner({...virtus,active:false}),null)
assert.equal(getDirectoryBusinessPlan({...virtus,promotion_plan:'exclusive',promotion_starts_at:'2020-01-01',promotion_ends_at:'2100-01-01'},now),'exclusive')
assert.equal(getGuideBusinesses(arrivalPaperwork,[virtus,business('free', 'free', {services:['Gestoría']})],{},now)[0].id,virtus.id)
assert.equal(getGuideBusinesses(guide('d14'),[bellini,business('free', 'free', {services:['Trabajo temporal']})],{},now)[0].id,bellini.id)
assert.ok(!isBusinessRelatedToGuide(virtus,guide('d10')), 'Premium does not bypass the labor-law relevance filter')
assert.ok(!isBusinessRelatedToGuide(bellini,arrivalPaperwork), 'Employment partner does not appear in general paperwork')
assert.deepEqual(getBusinessGuideMatches(virtus,{relatedBusinessTerms:['gestoría','gestoria','']}),['gestoría'])
console.log('Verified editorial partners: Premium consistency, no duplicated rows, topic filtering, higher tier preservation and unique match labels passed')
