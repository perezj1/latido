// Locality centers derived from the official directory. Source: ©swisstopo.
import coordinates from './swissLocalityCoordinates.json' with { type: 'json' }

const aliases = {
  berna: 'bern',
  basilea: 'basel',
  bale: 'basel',
  ginebra: 'geneve',
  geneva: 'geneve',
  genf: 'geneve',
  zurich: 'zurich',
  lucerna: 'luzern',
  lucerne: 'luzern',
  sangalo: 'stgallen',
  sanktgallen: 'stgallen',
  saintgall: 'stgallen',
  biel: 'bielbienne',
  bienne: 'bielbienne',
  neuenburg: 'neuchatel',
  freiburg: 'fribourg',
  rischrotkreuz: 'rotkreuz'
}

export function cardCityKey(city) {
  const key = String(city || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/^\d{4}\s+/, '')
    .replace(/[^a-z0-9]/g, '')
  const canonical = Object.hasOwn(aliases, key) ? aliases[key] : key
  if (Object.hasOwn(coordinates, canonical)) return canonical
  const plain = canonical.replace(
    /(?:ag|ai|ar|be|bl|bs|fr|ge|gl|gr|ju|lu|ne|nw|ow|sg|sh|so|sz|tg|ti|ur|vd|vs|zg|zh)$/,
    ''
  )
  const unqualified = Object.hasOwn(aliases, plain) ? aliases[plain] : plain
  return Object.hasOwn(coordinates, unqualified) ? unqualified : canonical
}

export function sameCardCity(first, second) {
  const key = cardCityKey(first)
  return Boolean(key) && key === cardCityKey(second)
}

export function cardCityCoordinates(city) {
  const key = cardCityKey(city)
  return Object.hasOwn(coordinates, key) ? coordinates[key] : null
}

function distanceKm(first, second) {
  const radians = (degrees) => (degrees * Math.PI) / 180
  const latitude = Math.sin(radians(second[0] - first[0]) / 2) ** 2
  const longitude = Math.sin(radians(second[1] - first[1]) / 2) ** 2
  const chord = latitude + Math.cos(radians(first[0])) * Math.cos(radians(second[0])) * longitude
  return 12742 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, chord))))
}

export function groupCardResultsByCity(items, city) {
  if (!city) return { local: items, nearby: [], other: [] }
  const origin = cardCityCoordinates(city)
  const local = [],
    nearby = [],
    other = []
  items.forEach((item, index) => {
    if (sameCardCity(item.city, city)) local.push(item)
    else {
      const point = cardCityCoordinates(item.city)
      if (origin && point) nearby.push({ item, distance: distanceKm(origin, point), index })
      else other.push(item)
    }
  })
  nearby.sort((a, b) => a.distance - b.distance || a.index - b.index)
  return { local, nearby: nearby.map(({ item }) => item), other }
}
