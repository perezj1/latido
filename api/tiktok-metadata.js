import { resolveTikTokLink } from './tiktok-resolve.js'

const IMAGE_DOMAINS = ['tiktokcdn.com', 'tiktokcdn-eu.com', 'tiktokcdn-us.com', 'muscdn.com']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

function httpError(message, statusCode = 502) {
  return Object.assign(new Error(message), { statusCode })
}

function parseThumbnailUrl(value) {
  try {
    const url = new URL(value)
    if (url.protocol === 'https:' && !url.username && !url.password && !url.port
      && IMAGE_DOMAINS.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) return url
  } catch { /* Missing or invalid thumbnail. */ }
  throw httpError('TikTok no devolvió una portada válida.')
}

export async function getTikTokMetadata(value, { fetchImpl=fetch, signal=AbortSignal.timeout(12000) } = {}) {
  const resolved = await resolveTikTokLink(value, { fetchImpl, signal })
  const metadataUrl = new URL(resolved.resolved_url)
  // oEmbed rejects /photo/ even though the same post ID works via /video/.
  metadataUrl.pathname = metadataUrl.pathname.replace('/photo/', '/video/')
  metadataUrl.search = ''
  metadataUrl.hash = ''
  const response = await fetchImpl(`https://www.tiktok.com/oembed?url=${encodeURIComponent(metadataUrl.href)}`, {
    signal, redirect:'error', headers:{ Accept:'application/json' },
  })
  if (!response.ok) throw httpError('No se pudieron obtener el título y la portada de TikTok.')
  const data = await response.json()
  if (data?.code || data?.error || (!data?.title && !data?.thumbnail_url)) {
    throw httpError('TikTok no devolvió los datos de esta publicación.')
  }
  return {
    ...resolved,
    title:String(data.title || '').trim(),
    thumbnail_url:data.thumbnail_url ? parseThumbnailUrl(data.thumbnail_url).href : '',
  }
}

export async function getTikTokThumbnail(value, { fetchImpl=fetch, signal=AbortSignal.timeout(12000) } = {}) {
  // Resolve a fresh signed CDN URL each time; never persist expiring TikTok URLs.
  const metadata = await getTikTokMetadata(value, { fetchImpl, signal })
  let url = parseThumbnailUrl(metadata.thumbnail_url)
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await fetchImpl(url, {
      signal, redirect:'manual', headers:{ Accept:'image/jpeg,image/png,image/webp', Referer:'https://www.tiktok.com/' },
    })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) throw httpError('TikTok no pudo cargar la portada.')
      url = parseThumbnailUrl(new URL(location, url).href)
      continue
    }
    const contentType = response.headers.get('content-type')?.split(';')[0].trim()
    if (!response.ok || !['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
      throw httpError('TikTok no pudo cargar la portada.')
    }
    const chunks = []
    let size = 0
    for await (const chunk of response.body) {
      size += chunk.byteLength
      if (size > MAX_IMAGE_BYTES) throw httpError('La portada de TikTok es demasiado grande.')
      chunks.push(chunk)
    }
    if (!size) throw httpError('TikTok devolvió una portada vacía.')
    return { body:Buffer.concat(chunks), contentType }
  }
  throw httpError('TikTok no pudo cargar la portada.')
}

export default async function handler(req, res) {
  const sendJson = (status, data) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(data))
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    sendJson(405, { error:'Método no permitido.' })
    return
  }
  const query = new URL(req.url, 'http://localhost').searchParams
  const value = query.get('url')
  if (!value || value.length > 2048) {
    sendJson(400, { error:'Añade un enlace válido de TikTok.' })
    return
  }
  try {
    if (query.get('thumbnail') === '1') {
      const image = await getTikTokThumbnail(value)
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')
      res.setHeader('Content-Type', image.contentType)
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.statusCode = 200
      res.end(image.body)
      return
    }
    const metadata = await getTikTokMetadata(value)
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
    sendJson(200, {
      ...metadata,
      thumbnail_url:metadata.thumbnail_url
        ? `/api/tiktok-metadata?thumbnail=1&url=${encodeURIComponent(metadata.resolved_url)}` : '',
    })
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store')
    sendJson(error?.statusCode || 502, { error:error?.message || 'No se pudieron leer los datos de TikTok.' })
  }
}
