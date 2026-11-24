function normalizeLocationScope(value='') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

const NATIONWIDE_LOCATION_VALUES = new Set([
  'ch',
  'suiza',
  'toda suiza',
  'schweiz',
  'ganze schweiz',
  'suisse',
  'toute la suisse',
  'svizzera',
  'tutta la svizzera',
  'switzerland',
  'all switzerland',
])

export function isNationwideLocation(item={}) {
  const values = typeof item === 'string'
    ? [item]
    : [item?.city, item?.canton, item?.location]

  return values.some(value => {
    const normalized = normalizeLocationScope(value)
    if (!normalized) return false
    if (NATIONWIDE_LOCATION_VALUES.has(normalized)) return true
    return normalized.startsWith('toda suiza ')
      || normalized.startsWith('ganze schweiz ')
      || normalized.startsWith('toute la suisse ')
      || normalized.startsWith('tutta la svizzera ')
      || normalized.startsWith('all switzerland ')
  })
}

export function matchesCantonOrNationwide(item={}, canton='') {
  const normalizedCanton = String(canton || '').trim().toUpperCase()
  if (!normalizedCanton) return true
  if (String(item?.canton || '').trim().toUpperCase() === normalizedCanton) return true
  return isNationwideLocation(item)
}
