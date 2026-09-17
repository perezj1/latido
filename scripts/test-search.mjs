import assert from 'node:assert/strict'
import {
  buildSearchProfile,
  normalizeSearchText,
  scoreSearchFields,
} from '../src/lib/naturalSearch.js'
import { parseLatidoAssistantQuery } from '../src/lib/latidoAssistantSearch.js'
import {
  buildMyListDraft,
  compareMyListSearchEntries,
  getMyListCommercialPriority,
  scoreMyListRow,
} from '../src/lib/myList.js'

function score(query, fields) {
  return scoreSearchFields(buildSearchProfile(query), fields)
}

assert.equal(normalizeSearchText('  Zürich, LIMPIEZA  '), 'zurich limpieza')
assert.ok(score('limpiesa', [{ value:'Servicio profesional de limpieza', weight:4 }]) > 0)
assert.ok(score('construcion', [{ value:'Trabajo en construcción', weight:4 }]) > 0)
assert.ok(score('habitasion', [{ value:'Habitación disponible en Zürich', weight:4 }]) > 0)
assert.equal(score('noche', [{ value:'Coche de segunda mano', weight:4 }]), 0)
assert.equal(score('fontanero', [{ value:'Oferta de empleo en una tienda', weight:4 }]), 0)
assert.ok(score('limpeza', [{ value:'Limpieza de oficinas y viviendas', weight:4 }]) > 0)
assert.ok(score('wohnung', [{ value:'Piso y apartamento en alquiler', weight:4 }]) > 0)
assert.ok(score('servicios', [{ value:'Negocio profesional de servicio', weight:2 }]) > 0)
assert.ok(score('chofer profesional carnet', [{
  value:'Conductor y chofer profesional con carnet de conducir',
  weight:5,
}]) > 0)
assert.equal(score('pintor zurich', [{ value:'Pintor profesional en Bern', weight:5 }]), 0)
assert.equal(score('moto', [{ value:'Pintor de carros', weight:5 }]), 0)
assert.equal(score('moto', [{ value:'Transporte con motorista', weight:5 }]), 0)
assert.ok(score('moto', [{ value:'Moto Yamaha 125 en venta', weight:5 }]) > 0)
assert.equal(score('alquilar coche', [{ value:'Salón de belleza y maquillaje', weight:5 }]), 0)
assert.ok(score('alquilar coche', [{ value:'Alquiler de coches en Zürich', weight:5 }]) > 0)

const jobSeeker = parseLatidoAssistantQuery('Busco trabajo de chofer')
assert.equal(jobSeeker.scope?.id, 'employment')
assert.deepEqual(jobSeeker.resultIntents, ['ofrece'])

const employer = parseLatidoAssistantQuery('Busco chofer para mi empresa')
assert.equal(employer.scope?.id, 'employment')
assert.deepEqual(employer.resultIntents, ['busca'])

const serviceProvider = parseLatidoAssistantQuery('Ofrezco limpieza en Zürich')
assert.equal(serviceProvider.scope?.id, 'cleaning')
assert.deepEqual(serviceProvider.resultIntents, ['busca'])

const serviceCustomer = parseLatidoAssistantQuery('Necesito limpieza en Zürich')
assert.equal(serviceCustomer.scope?.id, 'cleaning')
assert.deepEqual(serviceCustomer.resultIntents, ['ofrece'])

const neutralVehicleSearch = parseLatidoAssistantQuery('coche')
assert.equal(neutralVehicleSearch.scope?.id, 'vehicle')
assert.deepEqual(neutralVehicleSearch.resultIntents, [])

const motorcycleSearch = parseLatidoAssistantQuery('moto')
assert.equal(motorcycleSearch.scope?.focusKind, 'motorcycle')
assert.ok(motorcycleSearch.searchTerms.includes('motocicleta'))
assert.ok(!motorcycleSearch.searchTerms.includes('coche'))

const vehicleRentalSearch = parseLatidoAssistantQuery('alquilar coche')
assert.equal(vehicleRentalSearch.scope?.focusKind, 'vehicle-rental')

const neutralEmploymentSearch = parseLatidoAssistantQuery('trabajo')
assert.equal(neutralEmploymentSearch.scope?.id, 'employment')
assert.deepEqual(neutralEmploymentSearch.resultIntents, [])

const housingNeed = buildMyListDraft('piso en Zürich por 2000 CHF')
assert.equal(housingNeed.name, 'piso en Zürich por 2000 CHF')
assert.equal(housingNeed.category, 'vivienda')
assert.equal(housingNeed.canton, 'ZH')
assert.equal(housingNeed.filters.priceMax, 2000)
assert.equal(housingNeed.intent, 'ofrece')

const bicycleNeed = buildMyListDraft('comprar bicicleta')
assert.equal(bicycleNeed.category, 'venta')
assert.equal(bicycleNeed.intent, 'ofrece')
assert.deepEqual(bicycleNeed.filters.matchTerms, ['bicicleta'])

const insuranceNeed = buildMyListDraft('mejorar mi seguro')
assert.equal(insuranceNeed.category, 'documentos')
assert.ok(insuranceNeed.filters.matchTerms.includes('seguro'))

const motorcycleNeed = buildMyListDraft('moto')
assert.ok(motorcycleNeed.filters.matchTerms.includes('moto'))
assert.ok(!motorcycleNeed.filters.matchTerms.includes('coche'))
assert.deepEqual(motorcycleNeed.filters.resultIntents, ['ofrece', 'vende', 'regala'])
assert.equal(scoreMyListRow({
  entity_type:'ad',
  payload:{ title:'Pintor de carros', cat:'venta', type:'ofrece' },
}, motorcycleNeed, motorcycleSearch), 0)
assert.ok(scoreMyListRow({
  entity_type:'ad',
  payload:{ title:'Moto Yamaha 125', cat:'venta', type:'ofrece' },
}, motorcycleNeed, motorcycleSearch) > 0)
assert.equal(scoreMyListRow({
  entity_type:'ad',
  payload:{
    title:'Transporte y Mudanza',
    desc:'Llevamos cajas, muebles, bicicletas y motos',
    cat:'servicios',
    type:'ofrece',
  },
}, motorcycleNeed, motorcycleSearch), 0)

const legacyScooterNeed = {
  ...buildMyListDraft('scooter'),
  filters:{ ...buildMyListDraft('scooter').filters, resultIntents:undefined },
  intent:'ofrece',
}
assert.ok(scoreMyListRow({
  entity_type:'ad',
  payload:{ title:'Vendo una scooter nueva', cat:'venta', type:'vende' },
}, legacyScooterNeed) > 0)

const highlyRelevantOrganic = {
  relevance:500,
  row:{ entity_type:'ad', commercial_priority:1, created_at:'2026-01-02' },
}
const relevantPremiumPartner = {
  relevance:100,
  row:{ entity_type:'business', commercial_priority:0, created_at:'2026-01-01' },
}
assert.equal(getMyListCommercialPriority(highlyRelevantOrganic.row), 3)
assert.ok(compareMyListSearchEntries(relevantPremiumPartner, highlyRelevantOrganic) < 0)

console.log('Search quality checks passed')
