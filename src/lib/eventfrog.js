const EVENTFROG_API_URL = import.meta.env.VITE_EVENTFROG_PROXY_URL || '/api/eventfrog'
const EVENTFROG_EMBED_URL = 'https://embed.eventfrog.ch/en/events.html'

export const EVENTFROG_EMBED_KEY =
  import.meta.env.VITE_EVENTFROG_EMBED_KEY ||
  ''

const PREFERRED_LANGS = ['es', 'en', 'de', 'fr', 'it']

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

  for (const lang of PREFERRED_LANGS) {
    if (value[lang]) return value[lang]
  }

  return Object.values(value).find(Boolean) || ''
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

function normalizeSearch(value = '') {
  return stripHtml(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
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
    event.city,
  ].join(' '))

  return terms.some(term => hasSearchTerm(haystack, term))
}

function getRangeDayCount(from, to) {
  const fromDate = from ? new Date(`${from}T00:00:00`) : null
  const toDate = to ? new Date(`${to}T00:00:00`) : null
  if (!fromDate || !toDate || Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return 1

  const diff = toDate.getTime() - fromDate.getTime()
  return Math.max(1, Math.floor(diff / 86400000) + 1)
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

function normalizeEventfrogEvent(event) {
  const begin = event.begin ? new Date(event.begin) : null
  const title = localizedText(event.title) || 'Evento'
  const shortDescription = localizedText(event.shortDescription)
  const description = stripHtml(localizedText(event.descriptionAsHTML))
  const city = localizedText(event.locationAlias) || 'Suiza'
  const img = event.emblemToShow?.url || ''

  return {
    id: `eventfrog_${event.id}`,
    sourceId: event.id,
    title,
    desc: shortDescription || description,
    organizer: event.organizerName || 'Eventfrog',
    city,
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

export async function fetchEventfrogEvents({ from, to, filterId = 'latino', signal, limit = 18 } = {}) {
  const filter = EVENTFROG_FILTERS.find(item => item.id === filterId) || EVENTFROG_FILTERS[0]
  const perPage = 1000
  const maxPages = 20
  const matches = []
  let total = Infinity
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
  const fromDate = from ? new Date(`${from}T00:00:00`) : null
  const fromTime = fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate.getTime() : 0
  const targetDayCount = Math.min(getRangeDayCount(from, to), limit)

  for (let page = 1; page <= maxPages && (page - 1) * perPage < total; page += 1) {
    const url = new URL(EVENTFROG_API_URL, origin)
    url.searchParams.set('country', 'CH')
    url.searchParams.set('from', from)
    url.searchParams.set('to', to)
    url.searchParams.set('page', String(page))
    url.searchParams.set('perPage', String(perPage))

    const response = await fetch(url, { signal })
    if (!response.ok) {
      throw new Error(`Eventfrog ${response.status}`)
    }

    const data = await response.json()
    total = Number(data.totalNumberOfResources || 0)
    const pageMatches = (data.events || [])
      .map(normalizeEventfrogEvent)
      .filter(event => {
        const eventTime = event.date?.getTime() || 0
        return !event.cancelled && eventTime >= fromTime && matchesLatidoTerms(event, filter.terms)
      })

    matches.push(...pageMatches)

    if (matches.length >= limit && countEventDays(matches) >= targetDayCount) break
  }

  return pickEventsAcrossDates(matches, limit)
}
