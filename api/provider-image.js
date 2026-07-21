const PROVIDER_IMAGES = {
  'colombia-cancilleria': 'https://suiza.embajada.gov.co/sites/default/files/inline-images/logo-cancilleria.png',
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    res.status(204).end()
    return
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD, OPTIONS')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const requestedKey = Array.isArray(req.query.key) ? req.query.key[0] : req.query.key
  const sourceUrl = PROVIDER_IMAGES[requestedKey]

  if (!sourceUrl) {
    res.status(404).json({ error: 'Provider image not found' })
    return
  }

  try {
    const imageResponse = await fetch(sourceUrl, {
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; Latido.ch/1.0)',
      },
      redirect: 'follow',
    })

    const contentType = imageResponse.headers.get('content-type') || ''
    if (!imageResponse.ok || !contentType.startsWith('image/')) {
      res.status(502).json({ error: 'Provider image unavailable' })
      return
    }

    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000')
    res.setHeader('X-Content-Type-Options', 'nosniff')

    if (req.method === 'HEAD') {
      res.status(200).end()
      return
    }

    const body = Buffer.from(await imageResponse.arrayBuffer())
    res.setHeader('Content-Length', String(body.length))
    res.status(200).send(body)
  } catch {
    res.status(502).json({ error: 'Provider image request failed' })
  }
}
