const TIKTOK_VIDEO_PATH = /\/video\/(\d+)/i

function httpError(message, statusCode) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

function parseTikTokUrl(value) {
  let url
  try {
    url = new URL(String(value || '').trim())
  } catch {
    throw httpError('Invalid TikTok URL', 400)
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  const isTikTokHost = host === 'tiktok.com' || host.endsWith('.tiktok.com')
  if (url.protocol !== 'https:' || !isTikTokHost) throw httpError('Only TikTok HTTPS URLs are allowed', 400)
  return url
}

export function getTikTokIdFromUrl(value) {
  try {
    return parseTikTokUrl(value).pathname.match(TIKTOK_VIDEO_PATH)?.[1] || ''
  } catch {
    return ''
  }
}

export async function resolveTikTokLink(value, { fetchImpl=fetch, signal } = {}) {
  const originalUrl = parseTikTokUrl(value)
  const directVideoId = getTikTokIdFromUrl(originalUrl.href)
  if (directVideoId) {
    return {
      original_url:originalUrl.href,
      resolved_url:originalUrl.href,
      video_id:directVideoId,
      embed_url:`https://www.tiktok.com/player/v1/${directVideoId}`,
    }
  }

  const response = await fetchImpl(originalUrl, {
    method:'HEAD',
    redirect:'follow',
    signal:signal || AbortSignal.timeout(10000),
    headers:{
      Accept:'text/html,application/xhtml+xml',
      'User-Agent':'Mozilla/5.0 (compatible; Latido.ch/1.0)',
    },
  })

  if (!response.ok) throw httpError('TikTok could not resolve this link', 502)

  const resolvedUrl = parseTikTokUrl(response.url)
  const videoId = getTikTokIdFromUrl(resolvedUrl.href)
  if (!videoId) throw httpError('TikTok did not return a video URL', 422)

  return {
    original_url:originalUrl.href,
    resolved_url:resolvedUrl.href,
    video_id:videoId,
    embed_url:`https://www.tiktok.com/player/v1/${videoId}`,
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.status(204).end()
    return
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    res.status(405).json({ error:'Method not allowed' })
    return
  }

  const requestedUrl = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url
  if (!requestedUrl) {
    res.status(400).json({ error:'Missing TikTok URL' })
    return
  }

  try {
    const result = await resolveTikTokLink(requestedUrl)
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800')
    res.status(200).json(result)
  } catch (error) {
    res.status(error?.statusCode || 502).json({ error:error?.message || 'TikTok link resolution failed' })
  }
}
