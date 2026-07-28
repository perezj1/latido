import assert from 'node:assert/strict'
import {
  buildSearchProfile,
  normalizeSearchText,
  scoreSearchFields,
} from '../src/lib/naturalSearch.js'
import { parseLatidoAssistantQuery } from '../src/lib/latidoAssistantSearch.js'

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

const neutralEmploymentSearch = parseLatidoAssistantQuery('trabajo')
assert.equal(neutralEmploymentSearch.scope?.id, 'employment')
assert.deepEqual(neutralEmploymentSearch.resultIntents, [])

console.log('Search quality checks passed')
