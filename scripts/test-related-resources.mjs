import assert from 'node:assert/strict'
import { getGuideById } from '../src/lib/seo.js'
import { getResourcePackage } from '../src/lib/resourcePackages.js'
import { getPackageSteps } from '../src/lib/packageSteps.js'
import { getRelatedAdContext, selectRelatedAds, mergeRelatedResources, getRelatedAdsExplorePath } from '../src/lib/relatedResources.js'

const now = Date.parse('2026-10-12T12:00:00Z')
const step = (slug,index) => getPackageSteps(getResourcePackage(slug),'ZH')[index]
const context = (slug,index) => {
  const item = step(slug,index)
  return getRelatedAdContext(item.businessContext,item.resource)
}
const ad = (id,extra={}) => ({id,title:'Piso disponible',cat:'vivienda',type:'ofrece',city:'Zürich',canton:'ZH',privacy:'public',active:true,created_at:'2026-10-01',...extra})
const housing = context('busco-piso',1)
const housingRows = [ad('old'),ad('new',{created_at:'2026-10-10'}),ad('private',{privacy:'private'}),ad('closed',{lifecycle_status:'resolved'}),ad('expired',{expires_at:'2026-10-01'}),ad('request',{type:'busca'}),ad('inactive',{active:false}),ad('elsewhere',{canton:'GE'}),ad('wrong',{cat:'venta'}),ad('nameless',{title:''}),ad('rental-help',{cat:'servicios',title:'Ayuda con contratos de alquiler'})]
assert.deepEqual(selectRelatedAds(housing,housingRows,[],'ZH',now).map(row=>row.id),['new','rental-help','old'])
const nationwide = ad('national',{city:'Toda Suiza',canton:''})
assert.equal(selectRelatedAds(housing,[nationwide],[],'ZH',now)[0].id,'national')
const employment = context('busco-trabajo',0)
const job = (id,extra={}) => ({id,title:'Cocinero',job_intent:'ofrece',active:true,city:'Zürich',canton:'ZH',...extra})
const jobs = [job('offer'),job('seeker',{job_intent:'busca'}),job('inferred',{title:'Busco trabajo de cocinero'}),job('private',{profile_visibility:'private'}),job('expired',{expires_at:'2026-10-01'})]
const legacyJobs = [ad('legacy',{cat:'empleo',title:'Se necesita camarero'}),ad('legacy-seeker',{cat:'empleo',title:'Busco trabajo'}),ad('cv',{cat:'documentos',title:'Ayuda con tu CV'}),ad('cv-service',{cat:'servicios',title:'Preparación de currículum'})]
assert.deepEqual(new Set(selectRelatedAds(employment,legacyJobs,jobs,'ZH',now).map(row=>row.id)),new Set(['offer','legacy','cv','cv-service']))
const laborLaw = getRelatedAdContext(getGuideById('d10'))
assert.equal(laborLaw.jobs,undefined)
assert.deepEqual(selectRelatedAds(laborLaw,[ad('legal',{cat:'documentos',title:'Asesoría laboral y contratos de trabajo'}),ad('tax',{cat:'documentos',title:'Declaración de impuestos'}),ad('jobs',{cat:'empleo',title:'Oferta de empleo'})],jobs,'ZH',now).map(row=>row.id),['legal'])
const moving = context('me-mudo',1)
assert.deepEqual(selectRelatedAds(moving,[ad('move',{cat:'servicios',title:'Mudanzas económicas'}),ad('pc',{cat:'servicios',title:'Reparación de ordenadores'})],[],'ZH',now).map(row=>row.id),['move'])
const care = context('llego-con-ninos',3)
assert.deepEqual(selectRelatedAds(care,[ad('child',{cat:'cuidados',title:'Niñera con experiencia'}),ad('elder',{cat:'cuidados',title:'Cuidado de personas mayores'})],[],'ZH',now).map(row=>row.id),['child'])
const paperwork = context('acabo-de-llegar',3)
assert.deepEqual(selectRelatedAds(paperwork,[ad('translation',{cat:'documentos',title:'Traducciones certificadas'}),ad('service',{cat:'servicios',title:'Gestoría en español'}),ad('car',{cat:'servicios',title:'Mecánica del automóvil'})],[],'ZH',now).map(row=>row.id),['translation','service'])
const mixed = mergeRelatedResources([{id:'a1'},{id:'a2'}],[{id:'premium'},{id:'featured'},{id:'free'}],true)
assert.deepEqual(mixed.map(item=>item.row.id),['a1','premium','a2','featured','free'])
assert.deepEqual(mixed.filter(item=>item.kind==='business').map(item=>item.row.id),['premium','featured','free'])
assert.equal(new Set(mixed.map(item=>`${item.kind}:${item.row.id}`)).size,mixed.length)
assert.equal(getRelatedAdsExplorePath(employment,'ZH'),'/tablon?cat=empleo&jobIntent=ofrece&canton=ZH')
assert.match(step('busco-piso',0).path,/canton=ZH/)
console.log('Related resources: housing, employment from both tables, related services, topic, privacy, intent, expiry, local scope and mixed business priority passed')
