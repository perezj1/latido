const EVENTFROG_API_URL = 'https://api.eventfrog.net/public/v1/events'

const ALLOWED_QUERY_PARAMS = [
  'id',
  'lat',
  'lng',
  'r',
  'zip',
  'modifiedSince',
  'from',
  'to',
  'page',
  'perPage',
  'country',
  'ownPublic',
  'withOwnHiddens',
  'stream',
  'locId',
  'orgId',
  'rubId',
  'extSrcId',
  'excludeLocs',
  'excludeOrgs',
  'excludeRubrics',
  'excludeExtSrcIds',
]

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.status(204).end()
    return
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey =
    process.env.EVENTFROG_API_KEY ||
    process.env.VITE_EVENTFROG_PUBLIC_API_KEY ||
    process.env.VITE_EVENTFROG_CALENDAR_KEY

  if (!apiKey) {
    res.status(500).json({ error: 'Missing Eventfrog API key' })
    return
  }

  const url = new URL(EVENTFROG_API_URL)

  for (const param of ALLOWED_QUERY_PARAMS) {
    const value = req.query[param]
    if (Array.isArray(value)) {
      value.forEach(item => url.searchParams.append(param, item))
    } else if (value !== undefined && value !== '') {
      url.searchParams.set(param, value)
    }
  }

  if (!url.searchParams.has('country')) url.searchParams.set('country', 'CH')
  if (!url.searchParams.has('page')) url.searchParams.set('page', '1')
  if (!url.searchParams.has('perPage')) url.searchParams.set('perPage', '100')

  try {
    const eventfrogResponse = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    })

    const contentType = eventfrogResponse.headers.get('content-type') || 'application/json'
    const body = await eventfrogResponse.text()

    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    res.status(eventfrogResponse.status).send(body)
  } catch (error) {
    res.status(502).json({ error: 'Eventfrog request failed' })
  }
}
