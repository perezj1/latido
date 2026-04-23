const EVENTFROG_API_URL = 'https://api.eventfrog.net/public/v1/events'
const EVENTFROG_EMBED_URL = 'https://embed.eventfrog.ch/en/events.html'

export const EVENTFROG_PUBLIC_API_KEY =
  import.meta.env.VITE_EVENTFROG_PUBLIC_API_KEY ||
  import.meta.env.VITE_EVENTFROG_CALENDAR_KEY ||
  ''

export const EVENTFROG_EMBED_KEY =
  import.meta.env.VITE_EVENTFROG_EMBED_KEY ||
  import.meta.env.VITE_EVENTFROG_CALENDAR_KEY ||
  EVENTFROG_PUBLIC_API_KEY

const PREFERRED_LANGS = ['es', 'en', 'de', 'fr', 'it']

export const EVENTFROG_FILTERS = [
  {
    id: 'latino',
    label: 'Latino',
    embedTerm: 'latino',
    terms: [
      'latino', 'latina', 'latin', 'hispano', 'hispanic', 'español', 'spanish',
      'salsa', 'bachata', 'reggaeton', 'reggaetón', 'cumbia', 'merengue',
      'flamenco', 'tango', 'colombia', 'colombiano', 'mexico', 'méxico',
      'peru', 'perú', 'argentina', 'venezuela', 'ecuador', 'chile', 'bolivia',
      'dominicana', 'cuba', 'costa rica',
    ],
  },
  {
    id: 'espanol',
    label: 'Español',
    embedTerm: 'spanish',
    terms: ['español', 'espanol', 'spanish', 'hispano', 'hispanic', 'castellano'],
  },
  {
    id: 'musica',
    label: 'Música',
    embedTerm: 'salsa',
    terms: ['salsa', 'bachata', 'reggaeton', 'reggaetón', 'cumbia', 'merengue', 'tango', 'flamenco', 'latin music'],
  },
  {
    id: 'familia',
    label: 'Familia',
    embedTerm: 'familia latina',
    terms: ['familia', 'family', 'niños', 'ninos', 'kinder', 'latino kids', 'familias latinas'],
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

function matchesLatidoTerms(event, terms) {
  const haystack = normalizeSearch([
    event.title,
    event.desc,
    event.organizer,
    event.city,
  ].join(' '))

  return terms.some(term => haystack.includes(normalizeSearch(term)))
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

async function requestEventfrog(url, signal) {
  const headers = EVENTFROG_PUBLIC_API_KEY
    ? { Authorization: `Bearer ${EVENTFROG_PUBLIC_API_KEY}` }
    : {}

  const response = await fetch(url, { headers, signal })
  if (!EVENTFROG_PUBLIC_API_KEY || (response.status !== 401 && response.status !== 403)) {
    return response
  }

  const fallbackUrl = new URL(url)
  fallbackUrl.searchParams.set('apiKey', EVENTFROG_PUBLIC_API_KEY)
  return fetch(fallbackUrl, { signal })
}

export async function fetchEventfrogEvents({ from, to, filterId = 'latino', signal, limit = 18 } = {}) {
  if (!EVENTFROG_PUBLIC_API_KEY) {
    throw new Error('Missing Eventfrog API key')
  }

  const filter = EVENTFROG_FILTERS.find(item => item.id === filterId) || EVENTFROG_FILTERS[0]
  const perPage = 1000
  const maxPages = 5
  const matches = []
  let total = Infinity

  for (let page = 1; page <= maxPages && matches.length < limit && (page - 1) * perPage < total; page += 1) {
    const url = new URL(EVENTFROG_API_URL)
    url.searchParams.set('country', 'CH')
    url.searchParams.set('from', from)
    url.searchParams.set('to', to)
    url.searchParams.set('page', String(page))
    url.searchParams.set('perPage', String(perPage))

    const response = await requestEventfrog(url, signal)
    if (!response.ok) {
      throw new Error(`Eventfrog ${response.status}`)
    }

    const data = await response.json()
    total = Number(data.totalNumberOfResources || 0)
    const pageMatches = (data.events || [])
      .map(normalizeEventfrogEvent)
      .filter(event => !event.cancelled && matchesLatidoTerms(event, filter.terms))

    matches.push(...pageMatches)
  }

  return matches
    .sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0))
    .slice(0, limit)
}
