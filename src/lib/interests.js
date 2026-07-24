export const INTEREST_OPTIONS = [
  { id:'vivienda', emoji:'🏠', label:'Vivienda' },
  { id:'empleo', emoji:'💼', label:'Empleo' },
  { id:'servicios', emoji:'🛠️', label:'Servicios' },
  { id:'cuidados', emoji:'❤️', label:'Cuidados' },
  { id:'venta', emoji:'🛍️', label:'Mercado' },
  { id:'documentos', emoji:'📄', label:'Trámites' },
  { id:'regalo', emoji:'🎁', label:'Regalos' },
]

const INTEREST_IDS = new Set(INTEREST_OPTIONS.map(option => option.id))
const INTEREST_LABELS = Object.fromEntries(
  INTEREST_OPTIONS.map(option => [option.id, option.label])
)
const AFFINITY_STORAGE_PREFIX = 'latido_content_affinity'
const PERSONALIZED_MIX_PATTERN = [
  'relevant', 'relevant', 'relevant', 'relevant', 'relevant', 'relevant',
  'national', 'national',
  'relevant', 'relevant', 'relevant',
  'discovery',
  'national',
  'relevant', 'relevant',
  'discovery',
  'national',
  'relevant',
  'national',
  'discovery',
]

export function normalizeInterestIds(value) {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : []

  return Array.from(new Set(
    values
      .map(item => String(item || '').trim().toLowerCase())
      .filter(item => INTEREST_IDS.has(item))
  ))
}

function normalizePlace(value) {
  return String(value || '').trim().toLocaleUpperCase('de-CH')
}

function isNationwide(item={}) {
  const place = `${item.city || ''} ${item.canton || ''}`.toLowerCase()
  return place.includes('toda suiza') || place.includes('suiza')
}

function isNearby(item, canton) {
  const normalizedCanton = normalizePlace(canton)
  if (!normalizedCanton) return false
  return normalizePlace(item?.canton) === normalizedCanton
}

function byNewest(a, b) {
  return String(b?.createdAt || '').localeCompare(String(a?.createdAt || ''))
}

function getRecencyScore(value, now) {
  const createdAt = new Date(value || '').getTime()
  if (!Number.isFinite(createdAt)) return 0
  const ageDays = Math.max(0, (now - createdAt) / 86400000)
  if (ageDays <= 3) return 20
  if (ageDays <= 7) return 16
  if (ageDays <= 30) return 10
  if (ageDays <= 90) return 5
  return 0
}

function getQualityScore(item={}) {
  const rating = Number(item.rating || 0)
  const reviewCount = Number(item.reviewCount || 0)
  if (rating >= 4.5 && reviewCount >= 3) return 10
  if (rating >= 4 && reviewCount > 0) return 6
  if (item.img) return 2
  return 0
}

function byScoreThenNewest(a, b) {
  return (b.recommendationScore || 0) - (a.recommendationScore || 0)
    || byNewest(a, b)
}

function diversifyCategoryRuns(items=[], maxRun=2) {
  const remaining = [...items]
  const diversified = []
  let previousCategory = ''
  let runLength = 0

  while (remaining.length) {
    let nextIndex = 0
    const firstCategory = String(remaining[0]?.cat || 'otros')
    if (firstCategory === previousCategory && runLength >= maxRun) {
      const alternativeIndex = remaining.findIndex(item =>
        String(item?.cat || 'otros') !== previousCategory
      )
      if (alternativeIndex > 0) nextIndex = alternativeIndex
    }

    const [next] = remaining.splice(nextIndex, 1)
    const category = String(next?.cat || 'otros')
    runLength = category === previousCategory ? runLength + 1 : 1
    previousCategory = category
    diversified.push(next)
  }

  return diversified
}

function takeBestAvailable(pools) {
  return Object.values(pools)
    .filter(pool => pool.length)
    .map(pool => pool[0])
    .sort(byScoreThenNewest)[0]
}

function mixPersonalizedPools(pools) {
  const mixed = []
  const total = Object.values(pools).reduce((sum, pool) => sum + pool.length, 0)

  while (mixed.length < total) {
    for (const poolName of PERSONALIZED_MIX_PATTERN) {
      if (mixed.length >= total) break
      let item = pools[poolName].shift()
      if (!item) {
        item = takeBestAvailable(pools)
        if (item) {
          const sourcePool = Object.values(pools).find(pool => pool[0] === item)
          sourcePool?.shift()
        }
      }
      if (item) mixed.push(item)
    }
  }

  return mixed
}

export function sortRecentFeed(items=[]) {
  return [...items].sort(byNewest)
}

export function buildNearbyFeed(items=[], canton='') {
  const recent = sortRecentFeed(items)
  if (!normalizePlace(canton)) return recent

  return recent
    .map((item, index) => ({
      item,
      index,
      distanceRank:isNearby(item, canton) ? 0 : isNationwide(item) ? 1 : 2,
    }))
    .sort((a, b) => a.distanceRank - b.distanceRank || a.index - b.index)
    .map(entry => entry.item)
}

export function buildPersonalizedFeed(items=[], {
  interests=[],
  canton='',
  activityInterests=[],
  now=Date.now(),
}={}) {
  const normalizedInterests = normalizeInterestIds(interests)
  const interestSet = new Set(normalizedInterests)
  const normalizedActivityInterests = normalizeInterestIds(activityInterests)
  const activitySet = new Set(normalizedActivityInterests)
  const interestMatches = []
  const pools = { relevant:[], national:[], discovery:[] }

  for (const item of items) {
    const category = String(item?.cat || '').toLowerCase()
    const matchesInterest = interestSet.has(category)
    const matchesActivity = activitySet.has(category)
    const sameCanton = isNearby(item, canton)
    const nationwide = isNationwide(item)
    const recencyScore = getRecencyScore(item?.createdAt, now)
    const qualityScore = getQualityScore(item)
    const recommendationScore =
      (matchesInterest ? 35 : 0)
      + (sameCanton ? 25 : nationwide ? 5 : 0)
      + recencyScore
      + qualityScore
      + (matchesActivity ? 10 : 0)

    let recommendationReason = 'Para descubrir'
    if (matchesInterest) recommendationReason = `Por tu interés: ${INTEREST_LABELS[category] || category}`
    else if (matchesActivity) recommendationReason = 'Basado en tu actividad'
    else if (sameCanton) recommendationReason = 'Cerca de ti'
    else if (qualityScore >= 6) recommendationReason = 'Bien valorado'
    else if (recencyScore >= 10) recommendationReason = 'Novedad en Suiza'

    const rankedItem = {
      ...item,
      recommendationReason,
      recommendationScore,
    }

    if (matchesInterest) {
      interestMatches.push({ ...rankedItem, recommendationGroup:'interest' })
    } else if (matchesActivity || sameCanton) {
      pools.relevant.push({ ...rankedItem, recommendationGroup:'relevant' })
    } else if (nationwide || recencyScore >= 10 || qualityScore >= 6) {
      pools.national.push({ ...rankedItem, recommendationGroup:'national' })
    } else {
      pools.discovery.push({ ...rankedItem, recommendationGroup:'discovery' })
    }
  }

  const rankedInterestMatches = diversifyCategoryRuns(
    interestMatches.sort(byScoreThenNewest)
  )
  pools.relevant = diversifyCategoryRuns(pools.relevant.sort(byScoreThenNewest))
  pools.national = diversifyCategoryRuns(pools.national.sort(byScoreThenNewest))
  pools.discovery = diversifyCategoryRuns(pools.discovery.sort(byScoreThenNewest))

  // Explicit choices are a hard ordering preference, never a hidden filter:
  // show every selected-interest match before introducing other categories.
  return [...rankedInterestMatches, ...mixPersonalizedPools(pools)]
}

function getAffinityStorageKey(userId='') {
  return `${AFFINITY_STORAGE_PREFIX}:${userId || 'guest'}`
}

export function getInterestAffinityIds(userId='', limit=3) {
  if (typeof localStorage === 'undefined') return []
  try {
    const values = JSON.parse(localStorage.getItem(getAffinityStorageKey(userId)) || '{}')
    return Object.entries(values)
      .filter(([category]) => INTEREST_IDS.has(category))
      .sort(([, a], [, b]) => Number(b || 0) - Number(a || 0))
      .slice(0, limit)
      .map(([category]) => category)
  } catch {
    return []
  }
}

export function recordInterestAffinity(category, userId='') {
  const normalizedCategory = normalizeInterestIds([category])[0]
  if (!normalizedCategory || typeof localStorage === 'undefined') return
  const key = getAffinityStorageKey(userId)
  try {
    const values = JSON.parse(localStorage.getItem(key) || '{}')
    localStorage.setItem(key, JSON.stringify({
      ...values,
      [normalizedCategory]:Math.min(Number(values[normalizedCategory] || 0) + 1, 20),
    }))
  } catch {}
}
