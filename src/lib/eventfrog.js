const EVENTFROG_API_URL = import.meta.env.VITE_EVENTFROG_PROXY_URL || '/api/eventfrog'
const EVENTFROG_EMBED_URL = 'https://embed.eventfrog.ch/en/events.html'
const EVENTFROG_CACHE_TTL = 5 * 60 * 1000
const EVENTFROG_STALE_CACHE_TTL = 60 * 60 * 1000
const EVENTFROG_CACHE_MAX_ITEMS = 80
const EVENTFROG_PER_PAGE = 1000
const EVENTFROG_STORAGE_PREFIX = 'latido:eventfrog:v2:'

export const EVENTFROG_EMBED_KEY =
  import.meta.env.VITE_EVENTFROG_EMBED_KEY ||
  ''

const PREFERRED_LANGS = ['es', 'en', 'de', 'fr', 'it']
const rawPageCache = new Map()
const filteredEventsCache = new Map()
const locationCache = new Map()
const rawPageInFlight = new Map()
const filteredEventsInFlight = new Map()
const locationInFlight = new Map()

export const EVENTFROG_FILTERS = [
  {
    id: 'latino',
    label: 'Latino',
    embedTerm: 'latino',
    terms: [
      'latino', 'latina', 'latin', 'latein', 'lateinamerika', 'latinoamerica',
      'hispano', 'hispanic', 'español', 'espanol', 'spanish', 'spanisch',
      'espagnol', 'fiesta latina', 'noche latina', 'latin night', 'latin party',
      'latinos', 'latinas', 'latinoamericano', 'latinoamericana',
      'salsa', 'bachata', 'reggaeton', 'reggaetón', 'cumbia', 'merengue',
      'flamenco', 'tango', 'vallenato', 'mariachi', 'son cubano', 'musica latina',
      'música latina', 'colombia', 'colombiano', 'colombiana', 'mexico',
      'méxico', 'mexicano', 'mexicana', 'peru', 'perú', 'peruano', 'peruana',
      'argentina', 'argentino', 'venezuela', 'venezolano', 'venezolana',
      'ecuador', 'ecuatoriano', 'ecuatoriana', 'chile', 'chileno', 'chilena',
      'bolivia', 'boliviano', 'boliviana', 'dominicana', 'dominicano',
      'cuba', 'cubano', 'cubana', 'costa rica', 'costarricense', 'brasil',
      'brasileño', 'brasileno', 'brazil', 'brazilian',
    ],
  },
  {
    id: 'espanol',
    label: 'Español',
    embedTerm: 'spanish',
    terms: [
      'español', 'espanol', 'spanish', 'spanisch', 'spanische', 'spanischer',
      'espagnol', 'espagnole', 'espagne', 'spanien', 'hispano', 'hispanic',
      'castellano',
    ],
  },
  {
    id: 'musica',
    label: 'Música',
    embedTerm: 'salsa',
    terms: [
      'salsa', 'bachata', 'reggaeton', 'reggaetón', 'cumbia', 'merengue',
      'tango', 'flamenco', 'latin music', 'musica latina', 'música latina',
      'latin pop', 'urbano', 'dembow', 'vallenato', 'mariachi', 'bossa nova',
    ],
  },
  {
    id: 'familia',
    label: 'Familia',
    embedTerm: 'familia latina',
    terms: [
      'familia', 'family', 'familien', 'niños', 'niñas', 'ninos', 'kids',
      'children', 'kinder', 'latino kids', 'familias latinas',
    ],
  },
]

const SWISS_CANTON_CODES = new Set([
  'AG', 'AI', 'AR', 'BE', 'BL', 'BS', 'FR', 'GE', 'GL', 'GR', 'JU', 'LU', 'NE',
  'NW', 'OW', 'SG', 'SH', 'SO', 'SZ', 'TG', 'TI', 'UR', 'VD', 'VS', 'ZG', 'ZH',
])

const SWISS_CANTON_BY_NAME = {
  aargau: 'AG',
  appenzell: 'AI',
  'appenzell innerrhoden': 'AI',
  'appenzell ausserrhoden': 'AR',
  bern: 'BE',
  berne: 'BE',
  'basel landschaft': 'BL',
  baselland: 'BL',
  'basel stadt': 'BS',
  freiburg: 'FR',
  fribourg: 'FR',
  geneva: 'GE',
  geneve: 'GE',
  glarus: 'GL',
  graubunden: 'GR',
  grisons: 'GR',
  jura: 'JU',
  lucerne: 'LU',
  luzern: 'LU',
  neuchatel: 'NE',
  nidwalden: 'NW',
  obwalden: 'OW',
  'sankt gallen': 'SG',
  'st gallen': 'SG',
  schaffhausen: 'SH',
  solothurn: 'SO',
  schwyz: 'SZ',
  thurgau: 'TG',
  ticino: 'TI',
  tessin: 'TI',
  uri: 'UR',
  vaud: 'VD',
  valais: 'VS',
  wallis: 'VS',
  zug: 'ZG',
  zurich: 'ZH',
}

const SWISS_CANTON_BY_CITY = {
  aarau: 'AG',
  baden: 'AG',
  boswil: 'AG',
  brugg: 'AG',
  lenzburg: 'AG',
  rheinfelden: 'AG',
  wohlen: 'AG',
  appenzell: 'AI',
  herisau: 'AR',
  bern: 'BE',
  biel: 'BE',
  bienne: 'BE',
  burgdorf: 'BE',
  interlaken: 'BE',
  thun: 'BE',
  basel: 'BS',
  liestal: 'BL',
  fribourg: 'FR',
  freiburg: 'FR',
  bulle: 'FR',
  geneva: 'GE',
  geneve: 'GE',
  glarus: 'GL',
  chur: 'GR',
  davos: 'GR',
  'st moritz': 'GR',
  delemont: 'JU',
  lucerne: 'LU',
  luzern: 'LU',
  neuchatel: 'NE',
  'la chaux de fonds': 'NE',
  stans: 'NW',
  sarnen: 'OW',
  'st gallen': 'SG',
  'sankt gallen': 'SG',
  rapperswil: 'SG',
  schaffhausen: 'SH',
  solothurn: 'SO',
  olten: 'SO',
  schwyz: 'SZ',
  frauenfeld: 'TG',
  kreuzlingen: 'TG',
  weinfelden: 'TG',
  bellinzona: 'TI',
  locarno: 'TI',
  lugano: 'TI',
  altdorf: 'UR',
  lausanne: 'VD',
  montreux: 'VD',
  nyon: 'VD',
  vevey: 'VD',
  'yverdon les bains': 'VD',
  martigny: 'VS',
  sion: 'VS',
  zermatt: 'VS',
  zug: 'ZG',
  zuri: 'ZH',
  zueri: 'ZH',
  winterthur: 'ZH',
  zurich: 'ZH',
  uster: 'ZH',
}

const SWISS_CITY_ALIASES = {
  geneve: 'Genève',
  'sankt gallen': 'St. Gallen',
  'st gallen': 'St. Gallen',
  zueri: 'Zürich',
  zuri: 'Zürich',
  zurich: 'Zürich',
}

const SWISS_CITY_ZIP_RANGES = [
  [3000, 3030, 'Bern'],
  [4000, 4059, 'Basel'],
  [6000, 6009, 'Luzern'],
  [8000, 8099, 'Zürich'],
  [9000, 9029, 'St. Gallen'],
]

const SWISS_CANTON_ZIP_RANGES = [
  [1000, 1199, 'VD'],
  [1200, 1299, 'GE'],
  [1300, 1499, 'VD'],
  [1700, 1799, 'FR'],
  [1800, 1899, 'VD'],
  [1900, 1999, 'VS'],
  [2000, 2099, 'NE'],
  [2300, 2399, 'NE'],
  [2500, 2599, 'BE'],
  [2800, 2899, 'JU'],
  [3000, 3899, 'BE'],
  [3900, 3999, 'VS'],
  [4000, 4099, 'BS'],
  [4100, 4499, 'BL'],
  [4500, 4799, 'SO'],
  [4800, 4899, 'AG'],
  [5000, 5999, 'AG'],
  [6000, 6299, 'LU'],
  [6300, 6399, 'ZG'],
  [6400, 6499, 'SZ'],
  [6500, 6999, 'TI'],
  [7000, 7299, 'GR'],
  [7300, 7399, 'SG'],
  [7400, 7599, 'GR'],
  [8000, 8199, 'ZH'],
  [8200, 8299, 'SH'],
  [8300, 8499, 'ZH'],
  [8500, 8599, 'TG'],
  [8600, 8799, 'ZH'],
  [9000, 9099, 'SG'],
  [9100, 9199, 'AR'],
  [9200, 9499, 'SG'],
  [9500, 9599, 'TG'],
  [9600, 9699, 'SG'],
]

export function toISODate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getEventfrogRange(rangeKey, customDate) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const from = new Date(today)
  const to = new Date(today)

  if (rangeKey === 'today') {
    return { from: toISODate(from), to: toISODate(to) }
  }

  if (rangeKey === 'week') {
    to.setDate(to.getDate() + 7)
    return { from: toISODate(from), to: toISODate(to) }
  }

  if (rangeKey === 'custom' && customDate) {
    return { from: customDate, to: customDate }
  }

  to.setDate(to.getDate() + 30)
  return { from: toISODate(from), to: toISODate(to) }
}

export function buildEventfrogEmbedUrl({ term = 'latino', from, to } = {}) {
  const filter = EVENTFROG_FILTERS.find(item => item.id === term) || EVENTFROG_FILTERS[0]
  const url = new URL(EVENTFROG_EMBED_URL)

  if (EVENTFROG_EMBED_KEY) url.searchParams.set('key', EVENTFROG_EMBED_KEY)
  url.searchParams.set('color', '2563eb')
  url.searchParams.set('showSearch', 'false')
  url.searchParams.set('disableAddEntry', 'true')
  url.searchParams.set('excludeOrgs', 'false')
  url.searchParams.set('country', 'CH')
  url.searchParams.set('searchTerm', filter.embedTerm)
  url.searchParams.set('geoRadius', '60')
  if (from) url.searchParams.set('from', from)
  if (to) url.searchParams.set('to', to)

  return url.toString()
}

function localizedText(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (typeof value !== 'object') return ''

  for (const lang of PREFERRED_LANGS) {
    const text = localizedText(value[lang])
    if (text) return text
  }

  return Object.values(value).map(localizedText).find(Boolean) || ''
}

function stripHtml(value = '') {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function getPathValue(source, path) {
  return path.reduce((current, key) => {
    if (!current) return ''
    const target = Array.isArray(current) ? current[0] : current
    return target?.[key]
  }, source)
}

function cleanLocationPart(value = '') {
  const text = stripHtml(localizedText(value))
    .replace(/\s*\((CH|CHE|Switzerland|Schweiz|Suisse|Svizzera|Suiza)\)\s*$/i, '')
    .replace(/\s*,?\s*(CH|CHE|Switzerland|Schweiz|Suisse|Svizzera|Suiza)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  return text
}

function isGenericLocation(value = '') {
  const normalized = normalizeSearch(value)
  return !normalized || ['ch', 'che', 'switzerland', 'schweiz', 'suisse', 'svizzera', 'suiza', 'eventfrog'].includes(normalized)
}

function firstLocationValue(event, paths) {
  for (const path of paths) {
    const value = cleanLocationPart(getPathValue(event, path))
    if (!isGenericLocation(value)) return value
  }
  return ''
}

function parseLocationLabel(label = '') {
  const clean = cleanLocationPart(label)
  if (!clean) return { venue:'', city:'' }

  const parts = clean.split(',').map(part => part.trim()).filter(Boolean)
  if (parts.length < 2) return { venue:clean, city:'' }

  return {
    venue: parts[0],
    city: parts.slice(1).join(', '),
  }
}

function compactLocationParts(parts) {
  return parts.reduce((result, part) => {
    const clean = cleanLocationPart(part)
    if (isGenericLocation(clean)) return result
    const normalized = normalizeSearch(clean)
    if (result.some(existing => normalizeSearch(existing) === normalized)) return result
    if (result.some(existing => normalizeSearch(existing).includes(normalized))) return result
    return [...result, clean]
  }, [])
}

function getEventfrogLocation(event) {
  const rawLabel = firstLocationValue(event, [
    ['locationLabel'],
    ['locationAlias'],
    ['address'],
    ['locationAddress'],
    ['venueAddress'],
    ['location', 'label'],
    ['location', 'alias'],
    ['location', 'displayName'],
    ['location', 'formattedAddress'],
    ['venue', 'formattedAddress'],
    ['addressText'],
    ['address', 'label'],
  ])
  const parsedLabel = parseLocationLabel(rawLabel)

  const venue = firstLocationValue(event, [
    ['locationName'],
    ['venueName'],
    ['placeName'],
    ['location', 'name'],
    ['location', 'title'],
    ['venue', 'name'],
    ['place', 'name'],
    ['eventLocation', 'name'],
  ]) || parsedLabel.venue

  const organizerAsVenue = firstLocationValue(event, [
    ['organizerName'],
    ['organizer', 'name'],
  ])

  const city = firstLocationValue(event, [
    ['locationCity'],
    ['venueCity'],
    ['city'],
    ['location', 'city'],
    ['venue', 'city'],
    ['place', 'city'],
    ['eventLocation', 'city'],
    ['location', 'address', 'city'],
    ['venue', 'address', 'city'],
    ['address', 'city'],
  ]) || parsedLabel.city

  const resolvedVenue = venue || organizerAsVenue
  const locationParts = compactLocationParts([resolvedVenue, city])
  const locationLabel = locationParts.join(', ') || rawLabel || 'Suiza'

  return {
    venue: resolvedVenue,
    city: city || locationLabel,
    locationLabel,
  }
}

function normalizeSearch(value = '') {
  return stripHtml(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function normalizeLocationKey(value = '') {
  return normalizeSearch(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function getSwissCityFromZip(zip = '') {
  const number = Number(String(zip).match(/\d{4}/)?.[0] || '')
  if (!number) return ''

  return SWISS_CITY_ZIP_RANGES.find(([from, to]) => number >= from && number <= to)?.[2] || ''
}

function normalizeSwissCityName(city = '') {
  const cleanCity = cleanLocationPart(city)
  if (!cleanCity || SWISS_CANTON_CODES.has(cleanCity.toUpperCase())) return ''

  return SWISS_CITY_ALIASES[normalizeLocationKey(cleanCity)] || cleanCity
}

function inferSwissCityFromText(value = '') {
  const key = normalizeLocationKey(value)
  if (!key) return ''

  for (const [alias, city] of Object.entries(SWISS_CITY_ALIASES)) {
    const pattern = new RegExp(`(^|\\s)${escapeRegExp(alias)}(\\s|$)`)
    if (pattern.test(key)) return city
  }

  return ''
}

function getSwissCantonFromZip(zip = '') {
  const number = Number(String(zip).match(/\d{4}/)?.[0] || '')
  if (!number) return ''

  return SWISS_CANTON_ZIP_RANGES.find(([from, to]) => number >= from && number <= to)?.[2] || ''
}

function getSwissCantonCode(location = {}) {
  const explicit = firstLocationValue(location, [
    ['canton'],
    ['kanton'],
    ['state'],
    ['region'],
    ['province'],
    ['address', 'canton'],
    ['address', 'state'],
    ['address', 'region'],
  ]).toUpperCase()

  if (SWISS_CANTON_CODES.has(explicit)) return explicit
  const explicitByName = SWISS_CANTON_BY_NAME[normalizeLocationKey(explicit)]
  if (explicitByName) return explicitByName

  const city = normalizeSwissCityName(firstLocationValue(location, [
    ['city'],
    ['address', 'city'],
  ]))
  const cityCanton = SWISS_CANTON_BY_CITY[normalizeLocationKey(city)]
  if (cityCanton) return cityCanton

  const zip = firstLocationValue(location, [
    ['zip'],
    ['postalCode'],
    ['postcode'],
    ['address', 'zip'],
    ['address', 'postalCode'],
  ])
  return getSwissCantonFromZip(zip)
}

function formatCityCanton(city = '', canton = '') {
  const cleanCity = normalizeSwissCityName(city)
  const cleanCanton = String(canton || '').trim().toUpperCase()
  if (!cleanCity) return cleanCanton ? `Cantón ${cleanCanton}` : ''
  if (!cleanCanton || normalizeLocationKey(cleanCity).endsWith(normalizeLocationKey(cleanCanton))) return cleanCity
  return `${cleanCity} ${cleanCanton}`
}

function getEventfrogLocationIds(event = {}) {
  const ids = [
    ...(Array.isArray(event.locationIds) ? event.locationIds : []),
    event.locationId,
    event.locId,
    event.location?.id,
    event.venue?.id,
  ]

  return [...new Set(ids.filter(Boolean).map(String))]
}

function normalizeEventfrogLocation(location = {}) {
  const venue = firstLocationValue(location, [
    ['title'],
    ['name'],
    ['displayName'],
    ['label'],
  ])
  const zip = firstLocationValue(location, [
    ['zip'],
    ['postalCode'],
    ['postcode'],
    ['address', 'zip'],
    ['address', 'postalCode'],
  ])
  const rawCity = firstLocationValue(location, [
    ['city'],
    ['address', 'city'],
  ])
  const city = normalizeSwissCityName(rawCity) || getSwissCityFromZip(zip)
  const country = firstLocationValue(location, [
    ['country'],
    ['address', 'country'],
  ])
  const canton = getSwissCantonCode(location)
  const shortLabel = formatCityCanton(city, canton)
  const venueAsCity = normalizeSwissCityName(venue)
  const venueLabel = venue &&
    !SWISS_CANTON_CODES.has(cleanLocationPart(venue).toUpperCase()) &&
    normalizeLocationKey(venueAsCity || venue) !== normalizeLocationKey(city)
    ? venue
    : ''
  const locationLabel = compactLocationParts([venueLabel, shortLabel]).join(', ') || shortLabel || venue || country || 'Suiza'

  return {
    id: String(location.id || ''),
    venue,
    city,
    canton,
    zip,
    country,
    locationLabel,
    locationShortLabel: shortLabel || locationLabel,
  }
}

async function fetchEventfrogLocations({ ids, origin }) {
  const uniqueIds = [...new Set(ids.filter(Boolean).map(String))]
  const locationMap = new Map()
  const missingIds = []

  for (const id of uniqueIds) {
    const cached = getCachedValue(locationCache, id)
    if (cached) {
      locationMap.set(id, cached)
    } else {
      missingIds.push(id)
    }
  }

  if (missingIds.length === 0) return locationMap

  const inFlightKey = missingIds.sort().join('|')
  const inFlight = locationInFlight.get(inFlightKey)
  if (inFlight) {
    const inFlightLocations = await inFlight
    inFlightLocations.forEach((value, key) => locationMap.set(key, value))
    return locationMap
  }

  const url = new URL(EVENTFROG_API_URL, origin)
  url.searchParams.set('resource', 'locations')
  url.searchParams.set('country', 'CH')
  url.searchParams.set('page', '1')
  url.searchParams.set('perPage', String(Math.max(100, missingIds.length)))
  missingIds.forEach(id => url.searchParams.append('id', id))

  const request = (async () => {
    const response = await fetch(url)
    if (!response.ok) return locationMap

    const data = await response.json()
    const nextLocations = new Map()
    const locations = Array.isArray(data.locations) ? data.locations : []

    for (const location of locations) {
      const normalizedLocation = normalizeEventfrogLocation(location)
      if (!normalizedLocation.id) continue
      setCachedValue(locationCache, normalizedLocation.id, normalizedLocation)
      nextLocations.set(normalizedLocation.id, normalizedLocation)
    }

    return nextLocations
  })()

  locationInFlight.set(inFlightKey, request)

  try {
    const nextLocations = await request
    nextLocations.forEach((value, key) => locationMap.set(key, value))
  } catch {
    // Keep the event list usable even if location enrichment is rate-limited.
  } finally {
    locationInFlight.delete(inFlightKey)
  }

  return locationMap
}

function enrichEventfrogEventLocation(event, locationMap) {
  const location = event.locationIds.map(id => locationMap.get(id)).find(Boolean)
  if (!location) return event
  const inferredCity = normalizeSwissCityName(location.city) || inferSwissCityFromText([
    event.title,
    event.desc,
    event.venue,
    location.venue,
    location.locationLabel,
  ].join(' '))
  const city = inferredCity || location.city || event.city
  const canton = location.canton || SWISS_CANTON_BY_CITY[normalizeLocationKey(city)] || event.canton || ''
  const shortLabel = formatCityCanton(city, canton)

  return {
    ...event,
    venue: location.venue || event.venue,
    city,
    canton,
    zip: location.zip || event.zip || '',
    locationLabel: location.locationLabel || shortLabel || event.locationLabel,
    locationShortLabel: shortLabel || location.locationShortLabel || event.locationShortLabel || location.locationLabel || event.locationLabel,
  }
}

function escapeRegExp(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hasSearchTerm(haystack, term) {
  const normalizedTerm = normalizeSearch(term)
  if (!normalizedTerm) return false

  const pattern = normalizedTerm.split(/\s+/).map(escapeRegExp).join('[\\s-]+')
  return new RegExp(`(^|[^a-z0-9])${pattern}([^a-z0-9]|$)`).test(haystack)
}

function matchesLatidoTerms(event, terms) {
  const haystack = normalizeSearch([
    event.title,
    event.desc,
    event.organizer,
    event.venue,
    event.city,
    event.locationLabel,
  ].join(' '))

  return terms.some(term => hasSearchTerm(haystack, term))
}

function getCachedValue(cache, key) {
  const cached = cache.get(key)
  if (!cached) return null

  if (Date.now() - cached.createdAt > EVENTFROG_CACHE_TTL) {
    cache.delete(key)
    return null
  }

  return cached.value
}

function setCachedValue(cache, key, value) {
  cache.set(key, { value, createdAt:Date.now() })

  if (cache.size > EVENTFROG_CACHE_MAX_ITEMS) {
    cache.delete(cache.keys().next().value)
  }
}

function hydrateStoredEvent(event) {
  return {
    ...event,
    date: event.date ? new Date(event.date) : null,
  }
}

function serializeStoredEvent(event) {
  return {
    ...event,
    date: event.date instanceof Date ? event.date.toISOString() : event.date || '',
  }
}

function getStoredEvents(key, { allowStale = false } = {}) {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(`${EVENTFROG_STORAGE_PREFIX}${key}`)
    if (!raw) return null

    const cached = JSON.parse(raw)
    const ttl = allowStale ? EVENTFROG_STALE_CACHE_TTL : EVENTFROG_CACHE_TTL
    if (!cached?.createdAt || Date.now() - cached.createdAt > ttl) return null
    if (!Array.isArray(cached.events)) return null

    return cached.events.map(hydrateStoredEvent)
  } catch {
    return null
  }
}

function setStoredEvents(key, events) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(
      `${EVENTFROG_STORAGE_PREFIX}${key}`,
      JSON.stringify({
        createdAt: Date.now(),
        events: events.map(serializeStoredEvent),
      })
    )
  } catch {
    // Local storage may be unavailable in private mode or full storage contexts.
  }
}

function getRangeDayCount(from, to) {
  const fromDate = from ? new Date(`${from}T00:00:00`) : null
  const toDate = to ? new Date(`${to}T00:00:00`) : null
  if (!fromDate || !toDate || Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return 1

  const diff = toDate.getTime() - fromDate.getTime()
  return Math.max(1, Math.floor(diff / 86400000) + 1)
}

function buildEventfrogFetchWindows(from, to) {
  const fromDate = from ? new Date(`${from}T00:00:00`) : null
  const toDate = to ? new Date(`${to}T00:00:00`) : null

  if (!fromDate || !toDate || Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return [{ from, to }]
  }

  const windows = []
  const current = new Date(fromDate)

  while (current <= toDate) {
    const day = toISODate(current)
    windows.push({ from:day, to:day })
    current.setDate(current.getDate() + 1)
  }

  return windows
}

function getEventDateKey(event) {
  return event.date ? toISODate(event.date) : 'sin-fecha'
}

function countEventDays(events) {
  return new Set(events.map(getEventDateKey)).size
}

function pickEventsAcrossDates(events, limit) {
  const sorted = [...events].sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0))
  const groups = new Map()

  for (const event of sorted) {
    const key = getEventDateKey(event)
    const group = groups.get(key) || []
    group.push(event)
    groups.set(key, group)
  }

  const selected = []
  const buckets = Array.from(groups.values())
  let bucketIndex = 0

  while (selected.length < limit && buckets.some(bucket => bucket.length > 0)) {
    const bucket = buckets[bucketIndex % buckets.length]
    if (bucket.length > 0) selected.push(bucket.shift())
    bucketIndex += 1
  }

  return selected.sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0))
}

function dedupeEventsById(events) {
  const seen = new Set()
  return events.filter(event => {
    if (!event?.id || seen.has(event.id)) return false
    seen.add(event.id)
    return true
  })
}

function normalizeEventfrogEvent(event) {
  const begin = event.begin ? new Date(event.begin) : null
  const title = localizedText(event.title) || 'Evento'
  const shortDescription = localizedText(event.shortDescription)
  const description = stripHtml(localizedText(event.descriptionAsHTML))
  const location = getEventfrogLocation(event)
  const locationIds = getEventfrogLocationIds(event)
  const img = event.emblemToShow?.url || ''

  return {
    id: `eventfrog_${event.id}`,
    sourceId: event.id,
    title,
    desc: shortDescription || description,
    organizer: event.organizerName || 'Eventfrog',
    city: location.city,
    venue: location.venue,
    canton: '',
    zip: '',
    locationIds,
    locationLabel: location.locationLabel,
    locationShortLabel: location.city,
    begin: event.begin || '',
    end: event.end || '',
    date: begin,
    day: begin ? begin.toLocaleDateString('es-CH', { day: '2-digit' }) : '',
    month: begin ? begin.toLocaleDateString('es-CH', { month: 'short' }).replace('.', '').toUpperCase() : '',
    time: begin ? begin.toLocaleTimeString('es-CH', { hour: '2-digit', minute: '2-digit' }) : '',
    price: typeof event.lowestTicketPrice === 'number' ? `Desde CHF ${event.lowestTicketPrice.toFixed(0)}` : 'Ver precio',
    img,
    link: event.url || event.presaleLink || '',
    soldOut: !!event.soldOut,
    cancelled: !!event.cancelled,
  }
}

async function fetchEventfrogPage({ from, to, page, perPage, origin }) {
  const cacheKey = `${EVENTFROG_API_URL}|${origin}|${from}|${to}|${page}|${perPage}`
  const cached = getCachedValue(rawPageCache, cacheKey)
  if (cached) return cached
  const inFlight = rawPageInFlight.get(cacheKey)
  if (inFlight) return inFlight

  const url = new URL(EVENTFROG_API_URL, origin)
  url.searchParams.set('country', 'CH')
  url.searchParams.set('from', from)
  url.searchParams.set('to', to)
  url.searchParams.set('page', String(page))
  url.searchParams.set('perPage', String(perPage))

  const request = (async () => {
    const response = await fetch(url)
    if (!response.ok) {
      let message = `Eventfrog ${response.status}`
      try {
        const errorData = await response.json()
        if (errorData?.error) message = errorData.error
      } catch {
        // Ignore non-JSON error bodies and keep the status-based message.
      }
      throw new Error(message)
    }

    const data = await response.json()
    setCachedValue(rawPageCache, cacheKey, data)
    return data
  })()

  rawPageInFlight.set(cacheKey, request)

  try {
    return await request
  } finally {
    rawPageInFlight.delete(cacheKey)
  }
}

export async function fetchEventfrogEvents({ from, to, filterId = 'latino', signal, limit = 18, onProgress } = {}) {
  const filter = EVENTFROG_FILTERS.find(item => item.id === filterId) || EVENTFROG_FILTERS[0]
  const perPage = EVENTFROG_PER_PAGE
  const matches = []
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
  const fromDate = from ? new Date(`${from}T00:00:00`) : null
  const fromTime = fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate.getTime() : 0
  const filteredCacheKey = `${EVENTFROG_API_URL}|${origin}|${from}|${to}|${filterId}|${limit}`
  const cachedEvents = getCachedValue(filteredEventsCache, filteredCacheKey)

  if (cachedEvents) return [...cachedEvents]
  const storedEvents = getStoredEvents(filteredCacheKey)
  if (storedEvents) {
    setCachedValue(filteredEventsCache, filteredCacheKey, storedEvents)
    return [...storedEvents]
  }
  const inFlight = filteredEventsInFlight.get(filteredCacheKey)
  if (inFlight) return [...(await inFlight)]

  function emitProgress() {
    if (typeof onProgress !== 'function' || matches.length === 0 || signal?.aborted) return
    onProgress(pickEventsAcrossDates(dedupeEventsById(matches), limit))
  }

  const request = (async () => {
    try {
      for (const window of buildEventfrogFetchWindows(from, to)) {
        let data
        try {
          data = await fetchEventfrogPage({ from:window.from, to:window.to, page:1, perPage, origin })
        } catch (error) {
          if (matches.length > 0) break
          throw error
        }

        const normalizedMatches = (data.events || [])
          .map(normalizeEventfrogEvent)
          .filter(event => {
            const eventTime = event.date?.getTime() || 0
            return !event.cancelled && eventTime >= fromTime && matchesLatidoTerms(event, filter.terms)
          })

        matches.push(...normalizedMatches)
        emitProgress()
      }

      const locations = await fetchEventfrogLocations({
        ids: matches.flatMap(event => event.locationIds || []),
        origin,
      })
      const enrichedMatches = matches.map(event => enrichEventfrogEventLocation(event, locations))
      const finalEvents = pickEventsAcrossDates(dedupeEventsById(enrichedMatches), limit)
      setCachedValue(filteredEventsCache, filteredCacheKey, finalEvents)
      setStoredEvents(filteredCacheKey, finalEvents)
      return finalEvents
    } catch (error) {
      const staleEvents = getStoredEvents(filteredCacheKey, { allowStale:true })
      if (staleEvents) {
        setCachedValue(filteredEventsCache, filteredCacheKey, staleEvents)
        return staleEvents
      }
      throw error
    }
  })()

  filteredEventsInFlight.set(filteredCacheKey, request)

  try {
    return [...await request]
  } finally {
    filteredEventsInFlight.delete(filteredCacheKey)
  }
}
