import assert from 'node:assert/strict'
import {
  cardCityCoordinates,
  groupCardResultsByCity,
  sameCardCity
} from '../src/lib/latidoCardLocation.js'

const items = [
  { id: 'unknown', city: 'Ciudad sin coordenadas' },
  { id: 'far', city: 'Genève' },
  { id: 'medium', city: 'Bern' },
  { id: 'near', city: 'Winterthur' },
  { id: 'local-1', city: 'Zürich' },
  { id: 'near-again', city: 'Winterthur' },
  { id: 'local-2', city: 'Zurich' },
  { id: 'empty', city: '' }
]
assert.deepEqual(groupCardResultsByCity(items, ''), { local: items, nearby: [], other: [] })
const groups = groupCardResultsByCity(items, 'Zúrich')
assert.deepEqual(
  groups.local.map((item) => item.id),
  ['local-1', 'local-2']
)
assert.deepEqual(
  groups.nearby.map((item) => item.id),
  ['near', 'near-again', 'medium', 'far']
)
assert.deepEqual(
  groups.other.map((item) => item.id),
  ['unknown', 'empty']
)
assert.equal(
  new Set([...groups.local, ...groups.nearby, ...groups.other].map((item) => item.id)).size,
  items.length
)
assert.equal(items[0].id, 'unknown', 'Sorting must not mutate the server catalog')
assert.equal(sameCardCity('Berna', 'Bern'), true)
assert.equal(sameCardCity('Ginebra', 'Genève'), true)
assert.equal(sameCardCity('Basilea', 'Basel'), true)
assert.equal(sameCardCity('Zürich ZH', '8001 Zürich'), true)
assert.equal(sameCardCity('Zürich', 'Zug'), false)
assert.equal(sameCardCity('', ''), false)
assert.equal(cardCityCoordinates('Reinach'), null, 'Ambiguous localities need a canton')
assert.ok(cardCityCoordinates('Reinach BL'))
assert.ok(cardCityCoordinates('Reinach AG'))
assert.notDeepEqual(cardCityCoordinates('Reinach BL'), cardCityCoordinates('Reinach AG'))
assert.equal(cardCityCoordinates('Ciudad sin coordenadas'), null)
assert.equal(cardCityCoordinates('__proto__'), null)
assert.equal(cardCityCoordinates('constructor'), null)
for (const city of ['Basel', 'St. Gallen', 'Herisau', 'Dietikon', 'Gonten', 'Olten', 'Risch-Rotkreuz']) {
  assert.ok(cardCityCoordinates(city), `Recognize official localities spanning cantonal boundaries: ${city}`)
}
assert.deepEqual(groupCardResultsByCity(items, 'Ciudad sin coordenadas'), {
  local: [items[0]],
  nearby: [],
  other: items.slice(1)
})
assert.deepEqual(groupCardResultsByCity([], 'Zürich'), { local: [], nearby: [], other: [] })
assert.deepEqual(
  groupCardResultsByCity(
    [{ city: 'Zürich' }, { city: 'Lausanne' }, { city: 'Bern' }],
    'Genève'
  ).nearby.map((item) => item.city),
  ['Lausanne', 'Bern', 'Zürich']
)
console.log(
  'Card proximity: local first, geographic order, aliases, stable ties, unknown/ambiguous cities and no lost or duplicate results passed'
)
